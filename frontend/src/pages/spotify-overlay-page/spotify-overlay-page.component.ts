import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, DestroyRef, effect, EffectCleanupRegisterFn, inject, input, InputSignal, signal, Signal, WritableSignal } from '@angular/core';
import { SpotifyListener, SpotifySyncService } from '../../services/spotify-sync.service';
import { EMPTY_OVERLAY_PLAYBACK, playbackProgress, SpotifyOverlayMessage, SpotifyOverlayPlayback, trackDuration } from '../../data/spotify';

const TRANSPARENT: string = 'app-transparent';

const TICK_MS: number = 500;

@Component({
  selector: 'app-spotify-overlay-page',
  templateUrl: './spotify-overlay-page.component.html',
  styleUrl: './spotify-overlay-page.component.scss',
})
export class SpotifyOverlayPageComponent {

  readonly channel: InputSignal<string | undefined> = input<string>();

  private readonly sync: SpotifySyncService = inject(SpotifySyncService);
  private readonly document: Document = inject(DOCUMENT);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  private listener: SpotifyListener | null = null;

  protected readonly playback: WritableSignal<SpotifyOverlayPlayback> =
    signal<SpotifyOverlayPlayback>(EMPTY_OVERLAY_PLAYBACK);

  private readonly now: WritableSignal<number> = signal(0);

  private readonly rendered: WritableSignal<boolean> = signal(false);

  /** When the progress currently being counted on from was measured. */
  private readonly measuredAt: WritableSignal<number> = signal(0);

  /**
   * Nothing playing means nothing to show. A browser source that painted an empty card whenever the
   * music stopped would be a rectangle the streamer has to remember to hide by hand.
   */
  protected readonly visible: Signal<boolean> = computed((): boolean => this.playback().track !== null);

  protected readonly progress: Signal<number> = computed((): number => {
    const playback: SpotifyOverlayPlayback = this.playback();

    return playbackProgress(
      playback.isPlaying, playback.progressMs, playback.track?.durationMs ?? 0, this.measuredAt(), this.now());
  });

  protected readonly percent: Signal<number> = computed((): number => {
    const duration: number = this.playback().track?.durationMs ?? 0;
    return duration === 0 ? 0 : (this.progress() / duration) * 100;
  });

  protected readonly elapsed: Signal<string> = computed((): string => trackDuration(this.progress()));

  protected readonly total: Signal<string> = computed((): string => trackDuration(this.playback().track?.durationMs ?? 0));

  constructor() {
    // OBS strips the page background through its own custom CSS, but the link is also opened in a
    // normal browser to check it — without this that would be a white page around the card.
    const root: HTMLElement = this.document.documentElement;
    root.classList.add(TRANSPARENT);
    this.destroyRef.onDestroy((): void => root.classList.remove(TRANSPARENT));

    afterNextRender((): void => this.rendered.set(true));

    effect((onCleanup: EffectCleanupRegisterFn): void => {
      const channelId: string | undefined = this.channel();
      if (!channelId) return;

      // No initial fetch, unlike the timer's overlay: subscribing is itself what makes the backend
      // start polling this channel, and it answers with the last known state as its first message.
      const listener: SpotifyListener = this.sync.listenOverlay(
        channelId, (message: SpotifyOverlayMessage): void => this.apply(message));

      this.listener = listener;

      onCleanup((): void => {
        this.listener = null;
        listener.close();
      });
    });

    effect((onCleanup: EffectCleanupRegisterFn): void => {
      const playing: boolean = this.playback().isPlaying;

      if (!this.rendered()) return;

      const view: (Window & typeof globalThis) | null = this.document.defaultView;
      if (!view) return;

      // Every push is a fresh measurement, so the baseline moves with it.
      this.measuredAt.set(Date.now());
      this.now.set(Date.now());

      if (!playing) return;

      const handle: number = view.setInterval((): void => this.now.set(Date.now()), TICK_MS);
      onCleanup((): void => view.clearInterval(handle));
    });

    this.destroyRef.onDestroy((): void => this.listener?.close());
  }

  private apply(message: SpotifyOverlayMessage): void {
    if (message.type === 'disconnected') {
      this.playback.set(EMPTY_OVERLAY_PLAYBACK);
      return;
    }

    this.playback.set({
      isPlaying: message.isPlaying,
      track: message.track,
      progressMs: message.progressMs,
    });
  }
}
