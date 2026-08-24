import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, effect, EffectCleanupRegisterFn, inject, input, InputSignal, signal, Signal, WritableSignal } from '@angular/core';
import { formatDuration, remainingMs, SubathonTimer } from '../../data/subathon-timer';

const TICK_MS: number = 250;

@Component({
  selector: 'app-timer-display',
  template: `
    <span class="timer-display-value">
      @for (slot of slots(); track $index) {
        <span class="timer-display-slot">
          @for (character of slot; track character) {
            <span class="timer-display-character" animate.enter="timer-display-enter">{{ character }}</span>
          }
        </span>
      }
    </span>
  `,
  styleUrl: './timer-display.component.scss',
})
export class TimerDisplayComponent {

  readonly timer: InputSignal<SubathonTimer> = input.required<SubathonTimer>();

  private readonly document: Document = inject(DOCUMENT);

  private readonly now: WritableSignal<number> = signal(Date.now());

  private readonly rendered: WritableSignal<boolean> = signal(false);

  readonly remaining: Signal<number> = computed((): number => remainingMs(this.timer(), this.now()));
  readonly over: Signal<boolean> = computed((): boolean => this.remaining() === 0);

  protected readonly text: Signal<string> = computed((): string => formatDuration(this.remaining()));

  protected readonly slots: Signal<string[][]> = computed((): string[][] => [...this.text()].map((character: string): string[] => [character]));

  constructor() {
    afterNextRender((): void => this.rendered.set(true));

    effect((onCleanup: EffectCleanupRegisterFn): void => {
      if (!this.rendered() || !this.timer().running) return;

      const view: (Window & typeof globalThis) | null = this.document.defaultView;
      if (!view) return;

      this.now.set(Date.now());

      const handle: number = view.setInterval((): void => this.now.set(Date.now()), TICK_MS);
      onCleanup((): void => view.clearInterval(handle));
    });
  }
}