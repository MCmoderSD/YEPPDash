import { DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, effect, EffectCleanupRegisterFn, inject, signal, Signal, viewChild, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ColorPickerComponent } from '../../components/color-picker-component/color-picker.component';
import { OverlayLinkComponent } from '../../components/overlay-link-component/overlay-link.component';
import { NumberStepperComponent } from '../../components/number-stepper-component/number-stepper.component';
import { TimerDisplayComponent } from '../../components/timer-display-component/timer-display.component';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { TimerService } from '../../services/timer.service';
import { TimerSyncService } from '../../services/timer-sync.service';
import { StreamListener } from '../../services/sse.service';
import { DEFAULT_TIMER_STYLE, durationText, EMPTY_TIMER, parseDuration, SubathonTimer, TIMER_ANIMATION_MS, TimerStyle, timerStyleCss } from '../../data/subathon-timer';
import { CHANNEL_PARAM, overlayUrl, TIMER_OVERLAY_PATH } from '../../data/overlay';

@Component({
  selector: 'app-timer-page',
  templateUrl: './timer-page.component.html',
  styleUrl: './timer-page.component.scss',
  imports: [ColorPickerComponent, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatMenuModule, MatSlideToggleModule, NumberStepperComponent, OverlayLinkComponent, TimerDisplayComponent],
  host: {
    '[style.--timer-animation-duration]': 'animation()',
  },
})
export class TimerPageComponent {

  private readonly auth: AuthService = inject(AuthService);
  private readonly timers: TimerService = inject(TimerService);
  private readonly sync: TimerSyncService = inject(TimerSyncService);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly document: Document = inject(DOCUMENT);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  private readonly channelId: Signal<string | null> = computed((): string | null => this.auth.currentUser()?.id ?? null);

  private listener: StreamListener | null = null;

  private writing: Promise<void> = Promise.resolve();

  protected readonly timer: WritableSignal<SubathonTimer> = signal<SubathonTimer>(EMPTY_TIMER);
  protected readonly busy: WritableSignal<boolean> = signal(false);
  protected readonly loaded: WritableSignal<boolean> = signal(false);

  protected readonly delta: WritableSignal<string> = signal('5m');
  protected readonly target: WritableSignal<string> = signal('');
  protected readonly start: WritableSignal<string> = signal('');

  protected readonly style: WritableSignal<TimerStyle> = signal<TimerStyle>(DEFAULT_TIMER_STYLE);

  private readonly display: Signal<TimerDisplayComponent | undefined> = viewChild(TimerDisplayComponent);

  protected readonly canStart: Signal<boolean> = computed((): boolean => !(this.display()?.over() ?? this.timer().remaining === 0));

  protected readonly animation: Signal<string> = computed((): string => `${this.style().animate ? TIMER_ANIMATION_MS : 0}ms`);

  protected readonly atDefaults: Signal<boolean> = computed((): boolean => {
    const style: TimerStyle = this.style();

    return (Object.keys(DEFAULT_TIMER_STYLE) as (keyof TimerStyle)[])
      .every((key: keyof TimerStyle): boolean => style[key] === DEFAULT_TIMER_STYLE[key]);
  });

  protected readonly overlayUrl: Signal<string | null> = computed((): string | null => {
    const channelId: string | null = this.channelId();
    return channelId === null ? null : overlayUrl(TIMER_OVERLAY_PATH, CHANNEL_PARAM, channelId);
  });

  constructor() {
    effect((onCleanup: EffectCleanupRegisterFn): void => {
      const channelId: string | null = this.channelId();
      if (channelId === null) return;

      const listener: StreamListener = this.sync.listen(
        channelId, (timer: SubathonTimer): void => this.show(timer),
        (): void => void this.load(channelId)
      );

      this.listener = listener;

      void this.load(channelId);

      onCleanup((): void => {
        this.listener = null;
        listener.close();
      });
    });

    this.destroyRef.onDestroy((): void => this.listener?.close());
  }

  protected toggle(): void {
    const channelId: string | null = this.channelId();
    if (channelId === null) return;

    void this.run(this.timer().running
      ? this.timers.pause(channelId)
      : this.timers.start(channelId));
  }

  protected reset(): void {
    const channelId: string | null = this.channelId();
    if (channelId === null) return;

    void this.run(this.timers.reset(channelId));
  }

  protected adjust(sign: number): void {
    const channelId: string | null = this.channelId();
    const seconds: number | null = parseDuration(this.delta());

    if (channelId === null) return;
    if (seconds === null) {
      this.notifications.failure('That is not a duration — try 300, 5m or 1h30m.');
      return;
    }

    void this.run(this.timers.adjust(channelId, sign * seconds));
  }

  protected applyTarget(): void {
    const channelId: string | null = this.channelId();
    const seconds: number | null = parseDuration(this.target());

    if (channelId === null) return;
    if (seconds === null) {
      this.notifications.failure('That is not a duration — try 1h30m or 01:30:00.');
      return;
    }

    void this.run(this.timers.set(channelId, seconds));
  }

  protected saveStart(): void {
    const channelId: string | null = this.channelId();
    const seconds: number | null = parseDuration(this.start());

    if (channelId === null) return;
    if (seconds === null) {
      this.notifications.failure('That is not a duration — try 8h or 08:00:00.');
      return;
    }

    void this.run(this.timers.saveConfig(channelId, seconds), 'Start value saved.');
  }

  protected saveStyle(): void {
    const channelId: string | null = this.channelId();
    if (channelId === null) return;

    void this.run(this.timers.saveStyle(channelId, this.style()), 'Overlay settings are saved.');
  }

  protected resetStyle(): void {
    const channelId: string | null = this.channelId();

    this.style.set(DEFAULT_TIMER_STYLE);

    if (channelId === null) return;

    void this.run(this.timers.saveStyle(channelId, DEFAULT_TIMER_STYLE), 'Overlay settings back to their defaults.');
  }

  protected restyle(change: Partial<TimerStyle>): void {
    this.style.update((style: TimerStyle): TimerStyle => ({ ...style, ...change }));
  }

  protected recolour(value: string): void {
    if (!/^#[0-9a-f]{6}$/i.test(value.trim())) return;
    this.restyle({ color: value.trim().toLowerCase() });
  }


  protected async copyStyleCss(): Promise<void> {
    await this.copy(
      timerStyleCss(this.style()),
      'Custom CSS copied — paste it into the browser source in OBS.',
      'Could not copy the custom CSS.');
  }

  private async load(channelId: string): Promise<void> {
    try {
      this.show(await this.timers.getTimer(channelId));
    } catch {
      this.notifications.failure('Could not load your timer.');
      this.loaded.set(true);
    }
  }

  private show(timer: SubathonTimer): void {
    this.timer.set(timer);
    this.style.set(timer.style);
    this.loaded.set(true);

    if (!this.start()) this.start.set(durationText(timer.startSeconds));
  }

  private run(command: Promise<SubathonTimer>, success?: string): Promise<void> {
    this.busy.set(true);

    this.writing = this.writing
      .then((): Promise<SubathonTimer> => command)
      .then((timer: SubathonTimer): void => {
        this.show(timer);
        if (success) this.notifications.success(success);
      })
      .catch((): void => this.notifications.failure('The timer would not take that.'))
      .finally((): void => this.busy.set(false));

    return this.writing;
  }

  private async copy(text: string, success: string, failure: string): Promise<void> {
    const clipboard: Clipboard | undefined = this.document.defaultView?.navigator?.clipboard;

    if (!clipboard) {
      this.notifications.failure('This browser will not let the page copy for you — select the text instead.');
      return;
    }

    try {
      await clipboard.writeText(text);
      this.notifications.success(success);
    } catch {
      this.notifications.failure(failure);
    }
  }
}