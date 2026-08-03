import { DOCUMENT } from '@angular/common';
import { afterRenderEffect, Component, computed, DestroyRef, ElementRef, inject, input, InputSignal, NgZone, output, OutputEmitterRef, Signal, signal, viewChild, WritableSignal } from '@angular/core';

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

interface Color {
  fill: string;
  ink: string;
}

interface Label {
  text: string;
  fontSize: number;
}

const CENTRE: number = 50;
const RADIUS: number = 49;

const LABEL_RADIUS: number = RADIUS - 3;
const LABEL_ROOM: number = LABEL_RADIUS - 11;

export const LABEL_X: number = CENTRE + LABEL_RADIUS;

const CHARACTER_WIDTH: number = 0.52;

const MAX_FONT_SIZE: number = 6.5;
const MIN_FONT_SIZE: number = 1.6;

const SPIN_TURNS: number = 6;

const PALETTE: readonly Color[] = [
  { fill: '#1565c0', ink: '#ffffff' },
  { fill: '#c62828', ink: '#ffffff' },
  { fill: '#2e7d32', ink: '#ffffff' },
  { fill: '#f9a825', ink: '#1a1a1a' },
];

const EMPTY_FILL: string = '#6b6b73';

function point(angle: number, radius: number): string {
  const radians: number = (angle * Math.PI) / 180;
  return `${(CENTRE + radius * Math.cos(radians)).toFixed(3)} ${(CENTRE + radius * Math.sin(radians)).toFixed(3)}`;
}

export function sectorPath(from: number, to: number): string {
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

  if (index === count - 1 && count > 1 && colour === 0) return 1 % PALETTE.length;

  return colour;
}

export function wheelFontSize(count: number): number {
  if (count <= 0) return 0;
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, (360 / count) * 0.34));
}

export function fitLabel(label: string, fontSize: number): Label {
  const fitted: number = Math.max(fontSize * 0.5, Math.min(fontSize, LABEL_ROOM / Math.max(label.length * CHARACTER_WIDTH, 1)));

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

export function squeezeLabels(labels: Iterable<SVGTextElement>): void {
  for (const label of labels) {
    label.removeAttribute('textLength');
    label.removeAttribute('lengthAdjust');

    if (typeof label.getComputedTextLength !== 'function') continue;
    if (label.getComputedTextLength() <= LABEL_ROOM) continue;

    label.setAttribute('textLength', `${LABEL_ROOM}`);
    label.setAttribute('lengthAdjust', 'spacingAndGlyphs');
  }
}

export function sliceAtPointer(rotation: number, count: number): number {
  if (count <= 0) return -1;

  const local: number = (((-rotation % 360) + 360) % 360);

  return Math.min(count - 1, Math.floor(local / (360 / count)));
}

export function restRotation(current: number, index: number, count: number, jitter: number): number {
  const size: number = 360 / count;

  const target: number = -((index + 0.5) * size + (jitter - 0.5) * size * 0.7);
  const ahead: number = (((target - current) % 360) + 360) % 360;

  return current + SPIN_TURNS * 360 + ahead;
}


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

  readonly interactive: InputSignal<boolean> = input<boolean>(false);

  readonly spun: OutputEmitterRef<WheelSpin> = output<WheelSpin>();

  readonly spinRequested: OutputEmitterRef<void> = output<void>();

  private readonly document: Document = inject(DOCUMENT);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly zone: NgZone = inject(NgZone);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  private readonly disc: Signal<ElementRef<HTMLElement> | undefined> = viewChild<ElementRef<HTMLElement>>('disc');

  private readonly angle: WritableSignal<number> = signal(0);
  private readonly running: WritableSignal<boolean> = signal(false);
  private destroyed = false;

  private readonly live: WritableSignal<number> = signal(0);

  private readonly landed: WritableSignal<WheelSpin | null> = signal<WheelSpin | null>(null);

  readonly spinning: Signal<boolean> = this.running.asReadonly();

  protected readonly rotation: Signal<number> = this.angle.asReadonly();

  protected readonly labelX: number = LABEL_X;

  protected readonly sectors: Signal<WheelSector[]> = computed((): WheelSector[] => wheelSectors(this.slices()));

  protected readonly pointerFill: Signal<string> = computed((): string => {
    const sectors: WheelSector[] = this.sectors();
    const index: number = sliceAtPointer(this.live(), sectors.length);

    return index < 0 ? EMPTY_FILL : sectors[index].fill;
  });

  protected readonly description: Signal<string> = computed((): string => {
    const labels: readonly string[] = this.slices();
    if (labels.length === 0) return 'Wheel with no entries';

    return `Wheel with ${labels.length} ${labels.length === 1 ? 'slice' : 'slices'}: ${labels.join(', ')}`;
  });

  constructor() {
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
    if (event && event.target !== event.currentTarget) return;

    const result: WheelSpin | null = this.landed();

    if (!result) return;

    this.landed.set(null);
    this.running.set(false);

    this.live.set(this.angle());
    this.spun.emit(result);
  }

  private track(): void {
    const view: (Window & typeof globalThis) | null = this.document.defaultView;
    if (!view?.requestAnimationFrame || !view.DOMMatrix) return;

    this.zone.runOutsideAngular((): void => {
      const step: () => void = (): void => {
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