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

const MIN_READABLE_FONT_SIZE: number = 2.4;

const MIN_LABEL_ANGLE: number = 3;

const SPIN_TURNS: number = 6;

const SPIN_TIMEOUT_MS: number = 7_000;

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

function usableWeights(count: number, weights?: readonly number[]): readonly number[] | null {
  if (!weights || weights.length !== count) return null;
  if (!weights.every((weight: number): boolean => Number.isFinite(weight) && weight >= 0)) return null;
  if (weights.reduce((sum: number, weight: number): number => sum + weight, 0) <= 0) return null;

  return weights;
}

export function sectorBoundaries(count: number, weights?: readonly number[]): number[] {
  if (count <= 0) return [0];

  const shares: readonly number[] | null = usableWeights(count, weights);
  const total: number = shares ? shares.reduce((sum: number, weight: number): number => sum + weight, 0) : count;

  const boundaries: number[] = [0];

  for (let index = 0; index < count; index++) {
    boundaries.push(boundaries[index] + ((shares ? shares[index] : 1) / total) * 360);
  }

  boundaries[count] = 360;

  return boundaries;
}

export function fontForSpan(span: number): number {
  if (span <= 0) return 0;
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, span * 0.34));
}

export function fitLabel(label: string, fontSize: number): Label {
  const floor: number = Math.min(fontSize, MIN_READABLE_FONT_SIZE);
  const wanted: number = LABEL_ROOM / Math.max(label.length * CHARACTER_WIDTH, 1);

  const fitted: number = Math.max(floor, Math.min(fontSize, wanted));

  const room: number = Math.max(3, Math.floor(LABEL_ROOM / (fitted * CHARACTER_WIDTH)));
  const text: string = label.length <= room ? label : `${label.slice(0, room - 1).trimEnd()}…`;

  return { text, fontSize: Number(fitted.toFixed(2)) };
}

export function wheelSectors(labels: readonly string[], weights?: readonly number[]): WheelSector[] {
  const count: number = labels.length;
  const boundaries: number[] = sectorBoundaries(count, weights);

  return labels.map((label: string, index: number): WheelSector => {
    const from: number = boundaries[index];
    const to: number = boundaries[index + 1];
    const span: number = to - from;

    const colour: { fill: string; ink: string } = PALETTE[paletteIndex(index, count)];
    const { text, fontSize } = fitLabel(label, fontForSpan(span));

    return {
      label,
      text: span < MIN_LABEL_ANGLE ? '' : text,
      fontSize,
      path: sectorPath(from, to),
      fill: colour.fill,
      ink: colour.ink,
      angle: (from + to) / 2,
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

export function sliceAtPointer(rotation: number, boundaries: readonly number[]): number {
  const count: number = boundaries.length - 1;
  if (count <= 0) return -1;

  const local: number = (((-rotation % 360) + 360) % 360);

  for (let index = count - 1; index > 0; index--) {
    if (local >= boundaries[index]) return index;
  }

  return 0;
}

export function restRotation(current: number, index: number, boundaries: readonly number[], jitter: number): number {
  const from: number = boundaries[index];
  const span: number = boundaries[index + 1] - from;

  const target: number = -(from + span / 2 + (jitter - 0.5) * span * 0.7);
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

  readonly weights: InputSignal<readonly number[] | undefined> = input<readonly number[]>();

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
  private fallback: ReturnType<Window['setTimeout']> | null = null;

  private readonly live: WritableSignal<number> = signal(0);

  private readonly landed: WritableSignal<WheelSpin | null> = signal<WheelSpin | null>(null);

  readonly spinning: Signal<boolean> = this.running.asReadonly();

  protected readonly rotation: Signal<number> = this.angle.asReadonly();

  protected readonly labelX: number = LABEL_X;

  private readonly boundaries: Signal<number[]> =
    computed((): number[] => sectorBoundaries(this.slices().length, this.weights()));

  protected readonly sectors: Signal<WheelSector[]> =
    computed((): WheelSector[] => wheelSectors(this.slices(), this.weights()));

  protected readonly pointerFill: Signal<string> = computed((): string => {
    const sectors: WheelSector[] = this.sectors();
    const index: number = sliceAtPointer(this.live(), this.boundaries());

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
      this.disarmFallback();
    });
  }

  spin(index?: number): void {
    const labels: readonly string[] = this.slices();
    if (this.running() || labels.length === 0) return;

    const winner: number = index ?? Math.floor(Math.random() * labels.length);
    if (!Number.isInteger(winner) || winner < 0 || winner >= labels.length) return;

    this.landed.set({ index: winner, label: labels[winner] });
    this.angle.set(restRotation(this.angle(), winner, this.boundaries(), Math.random()));

    if (this.reducedMotion()) {
      this.settle();
      return;
    }

    this.running.set(true);
    this.armFallback();
    this.track();
  }

  protected clicked(): void {
    if (this.interactive()) this.spinRequested.emit();
  }

  protected settle(event?: TransitionEvent): void {
    if (event && event.target !== event.currentTarget) return;

    const result: WheelSpin | null = this.landed();

    if (!result) return;

    this.disarmFallback();

    this.landed.set(null);
    this.running.set(false);

    this.live.set(this.angle());
    this.spun.emit(result);
  }

  private armFallback(): void {
    this.disarmFallback();

    const view: (Window & typeof globalThis) | null = this.document.defaultView;
    if (!view) return;

    this.fallback = view.setTimeout((): void => this.settle(), SPIN_TIMEOUT_MS);
  }

  private disarmFallback(): void {
    if (this.fallback === null) return;

    this.document.defaultView?.clearTimeout(this.fallback);
    this.fallback = null;
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