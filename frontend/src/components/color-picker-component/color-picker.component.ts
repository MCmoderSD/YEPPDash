import { Component, computed, effect, input, InputSignal, output, OutputEmitterRef, Signal, signal, WritableSignal } from '@angular/core';
import { clamp, COLOR_PRESETS, ColorPreset, hexToHsv, Hsv, hsvToHex } from '../../data/color';

// How far one arrow press moves the square's thumb (of the 0-1 range) and the hue slider (degrees).
// Big enough that crossing the whole range is not a hundred presses, small enough to land on a shade.
const KEY_STEP: number = 0.04;
const KEY_STEP_HUE: number = 6;

/**
 * The whole colour choice in one panel: the presets that are usually the answer, and a
 * saturation/brightness square with a hue slider for everything else. Replaces the browser's own
 * picker, which cannot be styled and drags a native window over the page.
 */
@Component({
  selector: 'app-color-picker',
  templateUrl: './color-picker.component.html',
  styleUrl: './color-picker.component.scss',
})
export class ColorPickerComponent {

  readonly color: InputSignal<string> = input.required<string>();
  readonly presets: InputSignal<readonly ColorPreset[]> = input<readonly ColorPreset[]>(COLOR_PRESETS);

  // Every change as it happens — a drag emits continuously, so the field beside the menu tracks live.
  readonly colorChange: OutputEmitterRef<string> = output<string>();

  // A deliberate single choice (a preset click), which is the caller's cue to close whatever this
  // picker is sitting in. Drags do not fire it: closing mid-drag would tear the panel out from
  // under the pointer.
  readonly picked: OutputEmitterRef<string> = output<string>();

  // Held as HSV rather than re-derived from the hex, because hex cannot carry a hue once saturation
  // is zero: dragged to white and back, a derived hue would have snapped to red. The stored one
  // survives the trip.
  private readonly hsv: WritableSignal<Hsv> = signal<Hsv>({ h: 0, s: 0, v: 1 });

  private draggingArea = false;
  private draggingHue = false;

  protected readonly hex: Signal<string> = computed((): string => hsvToHex(this.hsv()));

  // The square's base colour: the current hue at full strength. Saturation and brightness are the
  // gradients painted over it, so only the hue moves this.
  protected readonly hueColor: Signal<string> = computed((): string =>
    hsvToHex({ h: this.hsv().h, s: 1, v: 1 }));

  protected readonly areaBackground: Signal<string> = computed((): string =>
    `linear-gradient(to top, rgb(0 0 0), rgb(0 0 0 / 0%)), linear-gradient(to right, rgb(255 255 255), ${this.hueColor()})`);

  protected readonly thumbLeft: Signal<number> = computed((): number => this.hsv().s * 100);
  protected readonly thumbTop: Signal<number> = computed((): number => (1 - this.hsv().v) * 100);
  protected readonly huePercent: Signal<number> = computed((): number => (this.hsv().h / 360) * 100);
  protected readonly hueDegrees: Signal<number> = computed((): number => Math.round(this.hsv().h));

  protected readonly areaText: Signal<string> = computed((): string =>
    `Saturation ${Math.round(this.hsv().s * 100)}%, brightness ${Math.round(this.hsv().v * 100)}%`);

  constructor() {
    effect((): void => {
      const incoming: string = this.color().toLowerCase();
      const current: Hsv = this.hsv();

      // Our own emission coming back around — same colour, nothing to sync.
      if (hsvToHex(current) === incoming) return;

      const parsed: Hsv | null = hexToHsv(incoming);
      if (parsed === null) return;

      // An achromatic colour arriving from outside (typed "#ffffff", or a reset) keeps the hue the
      // slider is on, for the same reason the state is HSV in the first place.
      this.hsv.set(parsed.s === 0 ? { ...parsed, h: current.h } : parsed);
    });
  }

  protected pick(value: string): void {
    const parsed: Hsv | null = hexToHsv(value);
    if (parsed === null) return;

    this.hsv.set(parsed.s === 0 ? { ...parsed, h: this.hsv().h } : parsed);
    this.colorChange.emit(this.hex());
    this.picked.emit(this.hex());
  }

  protected areaDown(event: PointerEvent): void {
    this.draggingArea = true;
    this.applyArea(event);
    capture(event);
  }

  protected areaMove(event: PointerEvent): void {
    if (this.draggingArea) this.applyArea(event);
  }

  protected hueDown(event: PointerEvent): void {
    this.draggingHue = true;
    this.applyHue(event);
    capture(event);
  }

  protected hueMove(event: PointerEvent): void {
    if (this.draggingHue) this.applyHue(event);
  }

  protected dragEnd(): void {
    this.draggingArea = false;
    this.draggingHue = false;
  }

  // The square is a two-axis control, which ARIA has no native shape for; arrows moving both axes is
  // the convention pickers settle on. Stopped from bubbling because this sits inside a menu, and the
  // menu's own arrow-key handling would move focus away mid-adjustment.
  protected areaKey(event: KeyboardEvent): void {
    const step: number = this.stepFor(event);
    if (step === 0) return;

    event.preventDefault();
    event.stopPropagation();

    this.change((current: Hsv): Hsv => {
      if (event.key === 'ArrowLeft') return { ...current, s: clamp(current.s - step, 0, 1) };
      if (event.key === 'ArrowRight') return { ...current, s: clamp(current.s + step, 0, 1) };
      if (event.key === 'ArrowUp') return { ...current, v: clamp(current.v + step, 0, 1) };
      return { ...current, v: clamp(current.v - step, 0, 1) };
    });
  }

  protected hueKey(event: KeyboardEvent): void {
    if (this.stepFor(event) === 0) return;

    event.preventDefault();
    event.stopPropagation();

    const delta: number = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -KEY_STEP_HUE : KEY_STEP_HUE;

    this.change((current: Hsv): Hsv => ({ ...current, h: (current.h + delta + 360) % 360 }));
  }

  private stepFor(event: KeyboardEvent): number {
    const arrows: string[] = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

    return arrows.includes(event.key) ? KEY_STEP : 0;
  }

  private applyArea(event: PointerEvent): void {
    const rect: DOMRect = (event.currentTarget as HTMLElement).getBoundingClientRect();

    this.change((current: Hsv): Hsv => ({
      ...current,
      s: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      v: clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1),
    }));
  }

  private applyHue(event: PointerEvent): void {
    const rect: DOMRect = (event.currentTarget as HTMLElement).getBoundingClientRect();

    this.change((current: Hsv): Hsv => ({
      ...current,
      h: clamp((event.clientX - rect.left) / rect.width, 0, 1) * 360,
    }));
  }

  private change(update: (current: Hsv) => Hsv): void {
    this.hsv.update(update);
    this.colorChange.emit(this.hex());
  }
}

// What keeps a drag delivering moves after the pointer leaves the control. Applied after the press
// has already taken effect, and allowed to fail quietly: a pointer that vanished between the press
// and this call (or a synthetic event from a test) should cost the drag, never the click.
function capture(event: PointerEvent): void {
  try {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  } catch {
    // The press stands on its own.
  }
}
