import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, effect, EffectCleanupRegisterFn, inject, input, InputSignal, signal, Signal, WritableSignal } from '@angular/core';
import { formatDuration, remainingMs, SubathonTimer } from '../../data/subathon-timer';

// Not a frame loop. The readout shows whole seconds, so animating it would repaint sixty times for
// every one that changes — on an OBS source, that cost is paid by the machine encoding the stream.
// Not a full second either: a 1000ms interval drifts against the deadline, and the last second would
// sit on screen for up to two. A quarter of a second is comfortably under what an eye notices.
const TICK_MS: number = 250;

@Component({
  selector: 'app-timer-display',
  template: `<span class="timer-display-value">{{ text() }}</span>`,
  styles: `
    :host {
      display: inline-block;

      // Every digit the same width, so the readout does not jitter as the seconds roll over.
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
  `,
})
export class TimerDisplayComponent {

  readonly timer: InputSignal<SubathonTimer> = input.required<SubathonTimer>();

  private readonly document: Document = inject(DOCUMENT);

  private readonly now: WritableSignal<number> = signal(Date.now());

  // afterNextRender never runs on the server, so nothing here starts an interval during SSR — one
  // started there would keep the render from ever settling.
  private readonly rendered: WritableSignal<boolean> = signal(false);

  // Public so a page can read them through viewChild, the way the wheel page reads the wheel's own
  // state rather than working it out a second time.
  readonly remaining: Signal<number> = computed((): number => remainingMs(this.timer(), this.now()));
  readonly over: Signal<boolean> = computed((): boolean => this.remaining() === 0);

  protected readonly text: Signal<string> = computed((): string => formatDuration(this.remaining()));

  constructor() {
    afterNextRender((): void => this.rendered.set(true));

    effect((onCleanup: EffectCleanupRegisterFn): void => {
      // A paused timer does not depend on the time of day, so nothing has to tick for it. That also
      // covers a subathon left paused overnight with the overlay still open.
      if (!this.rendered() || !this.timer().running) return;

      const view: (Window & typeof globalThis) | null = this.document.defaultView;
      if (!view) return;

      this.now.set(Date.now());

      const handle: number = view.setInterval((): void => this.now.set(Date.now()), TICK_MS);
      onCleanup((): void => view.clearInterval(handle));
    });
  }
}
