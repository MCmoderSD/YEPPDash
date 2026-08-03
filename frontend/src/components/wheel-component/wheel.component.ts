import { DOCUMENT } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  InputSignal,
  NgZone,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  viewChild,
  WritableSignal,
} from '@angular/core';

export interface WheelSector {
  label: string;
  text: string;
  path: string;
  fill: string;
  ink: string;
  angle: number;
  fontSize: number;
}

export interface WheelSpin {
  index: number;
  label: string;
}

// Drawn in a 100x100 viewBox so the wheel is resolution independent: the browser source in OBS can
// be dragged to any size and the slices stay sharp.
const CENTRE = 50;
const RADIUS = 49;

// Where the label ends, and how much of the radius is left for it once the middle is out of the way.
const LABEL_RADIUS = RADIUS - 3;
const LABEL_ROOM = LABEL_RADIUS - 11;

// The label is anchored at its end and runs inwards from the rim, so what the text needs is the
// point on the rim itself — not the radius it is measured by.
export const LABEL_X = CENTRE + LABEL_RADIUS;

// Roughly the width of one character relative to its font size, for Roboto.
const CHARACTER_WIDTH = 0.52;

const MAX_FONT_SIZE = 6.5;
const MIN_FONT_SIZE = 1.6;

const SPIN_TURNS = 6;

// Fixed rather than taken from the theme: the same wheel is captured over whatever the stream has
// behind it, so it has to carry its own contrast instead of the dashboard's surface tokens. Every
// pairing below clears WCAG AA for large text against its own slice.
const PALETTE: readonly { fill: string; ink: string }[] = [
  { fill: '#1565c0', ink: '#ffffff' },
  { fill: '#c62828', ink: '#ffffff' },
  { fill: '#2e7d32', ink: '#ffffff' },
  { fill: '#f9a825', ink: '#1a1a1a' },
];

// What the pointer is filled with while there is no wheel under it to take a colour from.
const EMPTY_FILL = '#6b6b73';

function point(angle: number, radius: number): string {
  const radians: number = (angle * Math.PI) / 180;

  return `${(CENTRE + radius * Math.cos(radians)).toFixed(3)} ${(CENTRE + radius * Math.sin(radians)).toFixed(3)}`;
}

// Angles run clockwise from 3 o'clock, which is where the pointer sits.
export function sectorPath(from: number, to: number): string {
  // A lone entry owns the whole disc, and an arc that ends where it starts draws nothing at all.
  if (to - from >= 360) {
    return `M ${point(0, RADIUS)} A ${RADIUS} ${RADIUS} 0 1 1 ${point(180, RADIUS)}`
      + ` A ${RADIUS} ${RADIUS} 0 1 1 ${point(0, RADIUS)} Z`;
  }

  const largeArc: number = to - from > 180 ? 1 : 0;

  return `M ${CENTRE} ${CENTRE} L ${point(from, RADIUS)}`
    + ` A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${point(to, RADIUS)} Z`;
}

export function paletteIndex(index: number, count: number): number {
  const colour: number = index % PALETTE.length;

  // The last slice touches the first one, so a count that is not a multiple of the palette would
  // otherwise put two of the same colour side by side.
  if (index === count - 1 && count > 1 && colour === 0) return 1 % PALETTE.length;

  return colour;
}

// One size for the whole wheel, from how tall a slice is where the text sits.
export function wheelFontSize(count: number): number {
  if (count <= 0) return 0;

  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, (360 / count) * 0.34));
}

// A long label shrinks to fit rather than being cut short, down to a point where shrinking further
// would make it unreadable on stream — past that it is cut. The character width this works from is
// an average, so it is only ever an estimate; squeezeLabels below is what makes it exact.
export function fitLabel(label: string, fontSize: number): { text: string; fontSize: number } {
  const fitted: number = Math.max(fontSize * 0.5, Math.min(
    fontSize, LABEL_ROOM / Math.max(label.length * CHARACTER_WIDTH, 1)));

  const room: number = Math.max(3, Math.floor(LABEL_ROOM / (fitted * CHARACTER_WIDTH)));
  const text: string = label.length <= room ? label : `${label.slice(0, room - 1)}…`;

  return { text, fontSize: Number(fitted.toFixed(2)) };
}

export function wheelSectors(labels: readonly string[]): WheelSector[] {
  const count: number = labels.length;
  const size: number = 360 / count;
  const base: number = wheelFontSize(count);

  return labels.map((label: string, index: number): WheelSector => {
    const colour: { fill: string; ink: string } = PALETTE[paletteIndex(index, count)];
    const { text, fontSize } = fitLabel(label, base);

    return {
      label,
      text,
      fontSize,
      path: sectorPath(index * size, (index + 1) * size),
      fill: colour.fill,
      ink: colour.ink,
      angle: (index + 0.5) * size,
    };
  });
}

// The width every character is assumed to have is an average, and a name set in wide letters — an
// all-caps "WWW" — runs far past it and out the far side of the wheel. Rather than guess more
// carefully, the drawn text is measured and only the ones that overrun are squeezed back into the
// room they have. Measuring is the browser's job, so nothing happens where there is none: on the
// server the estimate above is all there is, and it renders again on the client.
export function squeezeLabels(labels: Iterable<SVGTextElement>): void {
  for (const label of labels) {
    // Cleared first because the element is reused as the wheel changes, and a squeeze left over
    // from a longer name would stretch a short one out to fill the same room.
    label.removeAttribute('textLength');
    label.removeAttribute('lengthAdjust');

    if (typeof label.getComputedTextLength !== 'function') continue;
    if (label.getComputedTextLength() <= LABEL_ROOM) continue;

    label.setAttribute('textLength', `${LABEL_ROOM}`);
    label.setAttribute('lengthAdjust', 'spacingAndGlyphs');
  }
}

// Which slice the pointer is over at a given rotation. The pointer is fixed at 0°, so the wheel
// turning by r puts whatever sits at -r under it.
export function sliceAtPointer(rotation: number, count: number): number {
  if (count <= 0) return -1;

  const local: number = (((-rotation % 360) + 360) % 360);

  return Math.min(count - 1, Math.floor(local / (360 / count)));
}

// Where the wheel has to come to rest for the pointer to be over the given slice, always at least
// SPIN_TURNS full turns further round than it is now so every spin looks like one.
export function restRotation(current: number, index: number, count: number, jitter: number): number {
  const size: number = 360 / count;

  // Kept off dead centre, so the wheel does not stop in visibly the same place every time.
  const target: number = -((index + 0.5) * size + (jitter - 0.5) * size * 0.7);
  const ahead: number = (((target - current) % 360) + 360) % 360;

  return current + SPIN_TURNS * 360 + ahead;
}

// Standalone because both the dashboard page, which is declared in a lazy NgModule, and the OBS
// overlay, which is a lazily loaded standalone route of its own, put the same wheel on screen.
@Component({
  selector: 'app-wheel',
  templateUrl: './wheel.component.html',
  styleUrl: './wheel.component.scss',
  host: {
    '[class.wheel-interactive]': 'interactive()',
    '(click)': 'clicked()',
  },
})
export class WheelComponent {

  readonly slices: InputSignal<readonly string[]> = input.required<readonly string[]>();

  // Off by default: the overlay is a browser source anyone can open, and a wheel that spins from
  // there would disagree with the dashboard that owns it.
  readonly interactive: InputSignal<boolean> = input<boolean>(false);

  readonly spun: OutputEmitterRef<WheelSpin> = output<WheelSpin>();

  // The wheel does not spin itself on a click: whoever owns it picks the slice, so that the same
  // one can be handed to every other wheel following along.
  readonly spinRequested: OutputEmitterRef<void> = output<void>();

  private readonly document: Document = inject(DOCUMENT);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly zone: NgZone = inject(NgZone);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  private readonly disc: Signal<ElementRef<HTMLElement> | undefined> =
    viewChild<ElementRef<HTMLElement>>('disc');

  private readonly angle: WritableSignal<number> = signal(0);
  private readonly running: WritableSignal<boolean> = signal(false);
  private destroyed = false;

  // Where the wheel is right now rather than where it is headed: the pointer takes its colour from
  // whatever is under it, and during a spin that is a different slice every few frames.
  private readonly live: WritableSignal<number> = signal(0);

  // Held from the moment the wheel is sent off until it stops: picking the winner up front is what
  // decides where to stop, and it is only announced once it is actually under the pointer.
  private readonly landed: WritableSignal<WheelSpin | null> = signal<WheelSpin | null>(null);

  readonly spinning: Signal<boolean> = this.running.asReadonly();

  protected readonly rotation: Signal<number> = this.angle.asReadonly();

  protected readonly labelX: number = LABEL_X;

  protected readonly sectors: Signal<WheelSector[]> = computed((): WheelSector[] =>
    wheelSectors(this.slices()));

  protected readonly pointerFill: Signal<string> = computed((): string => {
    const sectors: WheelSector[] = this.sectors();
    const index: number = sliceAtPointer(this.live(), sectors.length);

    return index < 0 ? EMPTY_FILL : sectors[index].fill;
  });

  // The slices are one picture to a screen reader, not a list of shapes to walk through.
  protected readonly description: Signal<string> = computed((): string => {
    const labels: readonly string[] = this.slices();
    if (labels.length === 0) return 'Wheel with no entries';

    return `Wheel with ${labels.length} ${labels.length === 1 ? 'slice' : 'slices'}: ${labels.join(', ')}`;
  });

  constructor() {
    // Reads and writes layout in one phase on purpose: each label has to be measured with the
    // squeeze from the last wheel already taken off it, which the loop does one element at a time.
    afterRenderEffect({
      mixedReadWrite: (): void => {
        this.sectors();
        squeezeLabels(this.host.nativeElement.querySelectorAll<SVGTextElement>('.wheel-label'));
      },
    });

    this.destroyRef.onDestroy((): void => {
      this.destroyed = true;
    });
  }

  spin(index?: number): void {
    const labels: readonly string[] = this.slices();
    if (this.running() || labels.length === 0) return;

    const winner: number = index ?? Math.floor(Math.random() * labels.length);
    if (!Number.isInteger(winner) || winner < 0 || winner >= labels.length) return;

    this.landed.set({ index: winner, label: labels[winner] });
    this.angle.set(restRotation(this.angle(), winner, labels.length, Math.random()));

    // Nothing is animated when motion is turned down, so there is no transition end to wait for.
    if (this.reducedMotion()) {
      this.settle();
      return;
    }

    this.running.set(true);
    this.track();
  }

  protected clicked(): void {
    if (this.interactive()) this.spinRequested.emit();
  }

  protected settle(event?: TransitionEvent): void {
    // transitionend bubbles, so anything inside the disc that ever grows a transition of its own
    // would otherwise stop the spin early and announce a winner that is not under the pointer yet.
    if (event && event.target !== event.currentTarget) return;

    const result: WheelSpin | null = this.landed();

    // A stray event should not announce a second winner for a spin that is already over either.
    if (!result) return;

    this.landed.set(null);
    this.running.set(false);

    // The last frame the tracker saw is a frame short of where the wheel actually stopped.
    this.live.set(this.angle());
    this.spun.emit(result);
  }

  // Follows the disc while it turns so the pointer can be recoloured as slices pass under it.
  // Registered outside Angular deliberately: this fires every frame of a five second spin, and in
  // the zone each one would drag the whole application through change detection. Writing the signal
  // schedules a render by itself, which is all this needs.
  private track(): void {
    const view: (Window & typeof globalThis) | null = this.document.defaultView;
    if (!view?.requestAnimationFrame || !view.DOMMatrix) return;

    this.zone.runOutsideAngular((): void => {
      const step = (): void => {
        const disc: HTMLElement | undefined = this.disc()?.nativeElement;
        if (this.destroyed || !this.running() || !disc) return;

        const transform: string = view.getComputedStyle(disc).transform;
        if (transform && transform !== 'none') {
          const matrix: DOMMatrix = new view.DOMMatrix(transform);
          this.live.set((Math.atan2(matrix.b, matrix.a) * 180) / Math.PI);
        }

        view.requestAnimationFrame(step);
      };

      view.requestAnimationFrame(step);
    });
  }

  private reducedMotion(): boolean {
    return this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  }
}
