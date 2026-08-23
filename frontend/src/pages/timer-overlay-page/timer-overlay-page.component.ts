import { DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, effect, EffectCleanupRegisterFn, inject, input, InputSignal, signal, Signal, WritableSignal } from '@angular/core';
import { TimerDisplayComponent } from '../../components/timer-display-component/timer-display.component';
import { EMPTY_TIMER, SubathonTimer, TimerStyle } from '../../data/subathon-timer';
import { TimerService } from '../../services/timer.service';
import { TimerListener, TimerSyncService } from '../../services/timer-sync.service';

const TRANSPARENT: string = 'app-transparent';

@Component({
  selector: 'app-timer-overlay-page',
  templateUrl: './timer-overlay-page.component.html',
  styleUrl: './timer-overlay-page.component.scss',
  imports: [TimerDisplayComponent],
  // The saved settings are handed to the stylesheet as custom properties rather than applied to the
  // elements directly, so the stylesheet keeps deciding how they are used and this only says what
  // they are. Pasting the copied CSS into OBS overrides them, because an important declaration
  // outranks the inline ones written here.
  host: {
    '[style.--timer-color]': 'style().color',
    '[style.--timer-font-family]': 'style().fontFamily',
    '[style.--timer-font-size]': 'fontSize()',
    '[style.--timer-shadow]': 'shadow()',
  },
})
export class TimerOverlayPageComponent {

  readonly channel: InputSignal<string | undefined> = input<string>();

  private readonly timers: TimerService = inject(TimerService);
  private readonly sync: TimerSyncService = inject(TimerSyncService);
  private readonly document: Document = inject(DOCUMENT);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  private listener: TimerListener | null = null;

  protected readonly timer: WritableSignal<SubathonTimer> = signal<SubathonTimer>(EMPTY_TIMER);

  protected readonly style: Signal<TimerStyle> = computed((): TimerStyle => this.timer().style);
  protected readonly fontSize: Signal<string> = computed((): string => `${this.style().fontSize}vmin`);
  protected readonly shadow: Signal<string> = computed((): string =>
    this.style().shadow ? '0 0.4vmin 0.8vmin rgb(0 0 0 / 80%)' : 'none');

  constructor() {
    const root: HTMLElement = this.document.documentElement;
    root.classList.add(TRANSPARENT);
    this.destroyRef.onDestroy((): void => root.classList.remove(TRANSPARENT));

    effect((onCleanup: EffectCleanupRegisterFn): void => {
      const channelId: string | undefined = this.channel();
      if (!channelId) return;

      const listener: TimerListener = this.sync.listen(
        channelId, (timer: SubathonTimer): void => this.timer.set(timer),
        (): void => void this.refresh(channelId)
      );

      this.listener = listener;

      void this.refresh(channelId);

      onCleanup((): void => {
        this.listener = null;
        listener.close();
      });
    });

    this.destroyRef.onDestroy((): void => this.listener?.close());
  }

  private async refresh(channelId: string): Promise<void> {
    try {
      this.timer.set(await this.timers.getTimer(channelId));
    } catch {
      // Fetched again on every connect, so a stream that outlives a restart of the API picks the
      // timer back up by itself rather than sitting on an error for the rest of the stream.
    }
  }
}
