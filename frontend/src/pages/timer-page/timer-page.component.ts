import { DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, effect, EffectCleanupRegisterFn, inject, signal, Signal, viewChild, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ColorPickerComponent } from '../../components/color-picker-component/color-picker.component';
import { TimerDisplayComponent } from '../../components/timer-display-component/timer-display.component';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { TimerService } from '../../services/timer.service';
import { TimerListener, TimerSyncService } from '../../services/timer-sync.service';
import { DEFAULT_TIMER_STYLE, durationText, EMPTY_TIMER, parseDuration, SubathonTimer, TIMER_MAX_SECONDS, TimerStyle, timerStyleCss } from '../../data/subathon-timer';
import { timerOverlayUrl } from '../../data/timer-overlay';

@Component({
  selector: 'app-timer-page',
  templateUrl: './timer-page.component.html',
  styleUrl: './timer-page.component.scss',
  imports: [ColorPickerComponent, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatMenuModule, MatSlideToggleModule, TimerDisplayComponent],
})
export class TimerPageComponent {

  private readonly auth: AuthService = inject(AuthService);
  private readonly timers: TimerService = inject(TimerService);
  private readonly sync: TimerSyncService = inject(TimerSyncService);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly document: Document = inject(DOCUMENT);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  private readonly channelId: Signal<string | null> =
    computed((): string | null => this.auth.currentUser()?.id ?? null);

  private listener: TimerListener | null = null;

  private writing: Promise<void> = Promise.resolve();

  protected readonly timer: WritableSignal<SubathonTimer> = signal<SubathonTimer>(EMPTY_TIMER);
  protected readonly busy: WritableSignal<boolean> = signal(false);

  protected readonly delta: WritableSignal<string> = signal('5m');
  protected readonly target: WritableSignal<string> = signal('');
  protected readonly start: WritableSignal<string> = signal('');

  protected readonly style: WritableSignal<TimerStyle> = signal<TimerStyle>(DEFAULT_TIMER_STYLE);

  // Read off the readout rather than worked out again here: it already ticks, so this follows the
  // clock down to zero on its own instead of needing a second interval to notice.
  private readonly display: Signal<TimerDisplayComponent | undefined> = viewChild(TimerDisplayComponent);

  // Starting a timer with nothing on it does nothing anyone can see — the deadline would be now, and
  // the readout would sit at 00:00 as before. Set a time first, or add some.
  protected readonly canStart: Signal<boolean> = computed((): boolean =>
    !(this.display()?.over() ?? this.timer().remaining === 0));

  protected readonly atDefaults: Signal<boolean> = computed((): boolean => {
    const style: TimerStyle = this.style();

    return (Object.keys(DEFAULT_TIMER_STYLE) as (keyof TimerStyle)[])
      .every((key: keyof TimerStyle): boolean => style[key] === DEFAULT_TIMER_STYLE[key]);
  });

  protected readonly overlayUrl: Signal<string | null> = computed((): string | null => {
    const channelId: string | null = this.channelId();

    return channelId === null ? null : timerOverlayUrl(channelId);
  });

  constructor() {
    // The page listens on the same stream the overlay does, so a `!timer add` in chat moves this
    // readout too. Without it the dashboard would quietly disagree with the overlay next to it.
    effect((onCleanup: EffectCleanupRegisterFn): void => {
      const channelId: string | null = this.channelId();
      if (channelId === null) return;

      const listener: TimerListener = this.sync.listen(
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

  // sign is +1 for add and -1 for remove; the API takes a signed delta and clamps at zero itself.
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
    if (seconds === null || seconds > TIMER_MAX_SECONDS) {
      this.notifications.failure('That is not a duration — try 1h30m or 01:30:00.');
      return;
    }

    void this.run(this.timers.set(channelId, seconds));
  }

  protected saveStart(): void {
    const channelId: string | null = this.channelId();
    const seconds: number | null = parseDuration(this.start());

    if (channelId === null) return;
    if (seconds === null || seconds > TIMER_MAX_SECONDS) {
      this.notifications.failure('That is not a duration — try 8h or 08:00:00.');
      return;
    }

    void this.run(this.timers.saveConfig(channelId, seconds), 'Start value saved.');
  }

  protected saveStyle(): void {
    const channelId: string | null = this.channelId();
    if (channelId === null) return;

    void this.run(this.timers.saveStyle(channelId, this.style()), 'Overlay settings saved.');
  }

  // Saved rather than only put back in the fields: the overlay changing is the confirmation that the
  // reset happened, and there is nothing to lose by it — the old look is four fields away.
  protected resetStyle(): void {
    const channelId: string | null = this.channelId();

    this.style.set(DEFAULT_TIMER_STYLE);

    if (channelId === null) return;

    void this.run(this.timers.saveStyle(channelId, DEFAULT_TIMER_STYLE), 'Overlay settings back to their defaults.');
  }

  protected restyle(change: Partial<TimerStyle>): void {
    this.style.update((style: TimerStyle): TimerStyle => ({ ...style, ...change }));
  }

  // The picker and the text box both write here, so a pasted hex behaves the same as a picked one.
  // Anything that is not a full six-digit hex is dropped rather than stored: the field keeps what was
  // typed either way, so half-finished input survives being ignored on its way past.
  protected recolour(value: string): void {
    if (!/^#[0-9a-f]{6}$/i.test(value.trim())) return;

    this.restyle({ color: value.trim().toLowerCase() });
  }

  protected async copyOverlayUrl(): Promise<void> {
    const url: string | null = this.overlayUrl();
    if (url === null) return;

    await this.copy(url, 'Overlay link copied.', 'Could not copy the overlay link.');
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
    }
  }

  // The fields are only filled from the server while they are untouched. Overwriting them on every
  // pushed state would take a half-typed duration out from under whoever was typing it — and this
  // page is pushed to whenever the bot does anything.
  private show(timer: SubathonTimer): void {
    this.timer.set(timer);
    this.style.set(timer.style);

    if (!this.start()) this.start.set(durationText(timer.startSeconds));
  }

  /**
   * Serialised rather than fired off as they come: two clicks in quick succession are ordinary here
   * — start then add, or add twice — and letting them race would mean the later reply could be an
   * older state and quietly undo what the newer one showed.
   */
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
