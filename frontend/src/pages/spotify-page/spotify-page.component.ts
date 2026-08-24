import { DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, effect, EffectCleanupRegisterFn, inject, signal, Signal, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NowPlayingComponent } from '../../components/now-playing-component/now-playing.component';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { SpotifyService } from '../../services/spotify.service';
import { SpotifyListener, SpotifySyncService } from '../../services/spotify-sync.service';
import { LocaleDatePipe } from '../../pipes/locale-date.pipe';
import { overlayUrl, SPOTIFY_OVERLAY_PATH } from '../../data/overlay';
import { DEFAULT_SETTINGS, EMPTY_PLAYBACK, MAX_COOLDOWN_SECONDS, MAX_DURATION_MINUTES, rejectionOf, rejectionText, SongRequest, SongRequestRejection, SpotifyBlocklistEntry, SpotifyBlocklistType, SpotifyMessage, SpotifyPlayback, SpotifyQueueEntry, SpotifySettings, SpotifyStatus, SpotifyTrack, spotifyOverlayCss, trackDuration, UNKNOWN_STATUS } from '../../data/spotify';

@Component({
  selector: 'app-spotify-page',
  templateUrl: './spotify-page.component.html',
  styleUrl: './spotify-page.component.scss',
  imports: [LocaleDatePipe, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSlideToggleModule, MatTooltipModule, NowPlayingComponent],
})
export class SpotifyPageComponent {

  private readonly auth: AuthService = inject(AuthService);
  private readonly spotify: SpotifyService = inject(SpotifyService);
  private readonly sync: SpotifySyncService = inject(SpotifySyncService);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly document: Document = inject(DOCUMENT);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  private readonly channelId: Signal<string | null> = computed((): string | null => this.auth.currentUser()?.id ?? null);

  private listener: SpotifyListener | null = null;

  private writing: Promise<void> = Promise.resolve();

  protected readonly status: WritableSignal<SpotifyStatus> = signal<SpotifyStatus>(UNKNOWN_STATUS);
  protected readonly playback: WritableSignal<SpotifyPlayback> = signal<SpotifyPlayback>(EMPTY_PLAYBACK);
  protected readonly queue: WritableSignal<readonly SpotifyQueueEntry[]> = signal<readonly SpotifyQueueEntry[]>([]);
  protected readonly settings: WritableSignal<SpotifySettings> = signal<SpotifySettings>(DEFAULT_SETTINGS);
  protected readonly blocklist: WritableSignal<readonly SpotifyBlocklistEntry[]> = signal<readonly SpotifyBlocklistEntry[]>([]);
  protected readonly history: WritableSignal<readonly SongRequest[]> = signal<readonly SongRequest[]>([]);

  protected readonly query: WritableSignal<string> = signal('');
  protected readonly matches: WritableSignal<readonly SpotifyTrack[]> = signal<readonly SpotifyTrack[]>([]);
  protected readonly searching: WritableSignal<boolean> = signal(false);
  protected readonly historyFilter: WritableSignal<string> = signal('');

  protected readonly busy: WritableSignal<boolean> = signal(false);

  protected readonly connected: Signal<boolean> = computed((): boolean => this.status().connected);

  protected readonly overlayUrl: Signal<string | null> = computed((): string | null => {
    const channelId: string | null = this.channelId();
    return channelId === null ? null : overlayUrl(SPOTIFY_OVERLAY_PATH, channelId);
  });

  protected readonly maxCooldown: number = MAX_COOLDOWN_SECONDS;
  protected readonly maxDurationMinutes: number = MAX_DURATION_MINUTES;

  /**
   * Minutes rather than milliseconds in the form: nobody sets a track limit in milliseconds, and a
   * six-digit number in a field invites a typo that would turn ten minutes into three hours.
   */
  protected readonly maxDuration: Signal<number> = computed((): number => Math.round(this.settings().maxDurationMs / 60000));

  constructor() {
    effect((onCleanup: EffectCleanupRegisterFn): void => {
      const channelId: string | null = this.channelId();
      if (channelId === null) return;

      void this.load(channelId);

      // Opened even before we know whether Spotify is connected: the stream is cheap while nothing
      // is happening, and connecting in another tab should light this page up without a reload.
      const listener: SpotifyListener = this.sync.listen(
        channelId,
        (message: SpotifyMessage): void => this.apply(message),
        (): void => void this.refresh(channelId));

      this.listener = listener;

      onCleanup((): void => {
        this.listener = null;
        listener.close();
      });
    });

    this.destroyRef.onDestroy((): void => this.listener?.close());
  }

  protected connect(): void {
    const view: (Window & typeof globalThis) | null = this.document.defaultView;
    if (!view) return;

    // A full navigation, not a fetch: the next thing the visitor sees has to be Spotify's own
    // consent screen at Spotify's own address, or there is nothing for them to check before saying
    // yes to it.
    view.location.href = this.spotify.connectUrl(view.location.href);
  }

  protected disconnect(): void {
    const channelId: string | null = this.channelId();
    if (channelId === null) return;

    void this.run(async (): Promise<void> => {
      await this.spotify.disconnect(channelId);

      this.status.set({ ...this.status(), connected: false, displayName: null, status: null });
      this.playback.set(EMPTY_PLAYBACK);
      this.queue.set([]);

      this.notifications.success('Spotify disconnected.');
    });
  }

  protected toggle(): void {
    const channelId: string | null = this.channelId();
    if (channelId === null) return;

    const playing: boolean = this.playback().isPlaying;

    void this.run((): Promise<void> => playing ? this.spotify.pause(channelId) : this.spotify.play(channelId));
  }

  protected next(): void {
    const channelId: string | null = this.channelId();
    if (channelId === null) return;

    void this.run((): Promise<void> => this.spotify.next(channelId));
  }

  protected async search(): Promise<void> {
    const channelId: string | null = this.channelId();
    const query: string = this.query().trim();

    if (channelId === null || query.length === 0) {
      this.matches.set([]);
      return;
    }

    this.searching.set(true);

    try {
      this.matches.set(await this.spotify.search(channelId, query));
    } catch (error: unknown) {
      this.matches.set([]);
      this.complain(error, 'Could not search Spotify.');
    } finally {
      this.searching.set(false);
    }
  }

  /**
   * Takes the track's id rather than its name. Searching again for a track already picked from a
   * result list would be asking Spotify to guess at something already known.
   */
  protected add(track: SpotifyTrack): void {
    const channelId: string | null = this.channelId();
    if (channelId === null) return;

    void this.run(async (): Promise<void> => {
      await this.spotify.request(channelId, track.uri);
      this.notifications.success(`Queued ${track.name}.`);
    });
  }

  protected addTyped(): void {
    const channelId: string | null = this.channelId();
    const input: string = this.query().trim();

    if (channelId === null || input.length === 0) return;

    void this.run(async (): Promise<void> => {
      const queued: { track: string } = await this.spotify.request(channelId, input);

      this.query.set('');
      this.matches.set([]);
      this.notifications.success(`Queued ${queued.track}.`);
    });
  }

  protected block(entryType: SpotifyBlocklistType, entryId: string, name: string): void {
    const channelId: string | null = this.channelId();
    if (channelId === null || !entryId) return;

    void this.run(async (): Promise<void> => {
      this.blocklist.set(await this.spotify.block(channelId, entryType, entryId, name, null));
      this.notifications.success(`${name} is blocked from now on.`);
    });
  }

  protected unblock(entry: SpotifyBlocklistEntry): void {
    const channelId: string | null = this.channelId();
    if (channelId === null) return;

    void this.run(async (): Promise<void> => {
      await this.spotify.unblock(channelId, entry.id);
      this.blocklist.update((list: readonly SpotifyBlocklistEntry[]): readonly SpotifyBlocklistEntry[] =>
        list.filter((held: SpotifyBlocklistEntry): boolean => held.id !== entry.id));
    });
  }

  protected adjust(change: Partial<SpotifySettings>): void {
    this.settings.update((settings: SpotifySettings): SpotifySettings => ({ ...settings, ...change }));
  }

  protected setCooldown(value: string): void {
    this.adjust({ cooldownSeconds: this.clamp(value, 0, MAX_COOLDOWN_SECONDS) });
  }

  protected setMaxDuration(value: string): void {
    this.adjust({ maxDurationMs: this.clamp(value, 1, MAX_DURATION_MINUTES) * 60000 });
  }

  protected saveSettings(): void {
    const channelId: string | null = this.channelId();
    if (channelId === null) return;

    void this.run(async (): Promise<void> => {
      this.settings.set(await this.spotify.saveSettings(channelId, this.settings()));
      this.notifications.success('Request rules saved.');
    });
  }

  protected async filterHistory(): Promise<void> {
    const channelId: string | null = this.channelId();
    if (channelId === null) return;

    try {
      this.history.set(await this.spotify.getHistory(channelId, this.historyFilter().trim() || undefined));
    } catch (error: unknown) {
      this.complain(error, 'Could not load the request history.');
    }
  }

  protected duration(ms: number): string {
    return trackDuration(ms);
  }

  protected async copyOverlayUrl(): Promise<void> {
    const url: string | null = this.overlayUrl();
    if (url === null) return;

    await this.copy(url, 'Overlay link copied.', 'Could not copy the overlay link.');
  }

  protected async copyOverlayCss(): Promise<void> {
    await this.copy(
      spotifyOverlayCss(),
      'Custom CSS copied — paste it into the browser source in OBS.',
      'Could not copy the custom CSS.');
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

  private async load(channelId: string): Promise<void> {
    try {
      const status: SpotifyStatus = await this.spotify.getStatus(channelId);
      this.status.set(status);

      if (!status.connected) return;

      await Promise.all([
        this.refresh(channelId),
        this.loadSettings(channelId),
      ]);
    } catch (error: unknown) {
      this.complain(error, 'Could not load your Spotify settings.');
    }
  }

  private async loadSettings(channelId: string): Promise<void> {
    const [settings, blocklist, history]: [SpotifySettings, SpotifyBlocklistEntry[], SongRequest[]] = await Promise.all([
      this.spotify.getSettings(channelId),
      this.spotify.getBlocklist(channelId),
      this.spotify.getHistory(channelId),
    ]);

    this.settings.set(settings);
    this.blocklist.set(blocklist);
    this.history.set(history);
  }

  /**
   * Re-reads what the stream would otherwise only tell us at the next change. Also what runs when a
   * dropped stream reconnects, so a page that sat through an API restart heals itself instead of
   * showing whatever was playing before it.
   */
  private async refresh(channelId: string): Promise<void> {
    try {
      const [playback, queue]: [SpotifyPlayback, SpotifyQueueEntry[]] = await Promise.all([
        this.spotify.getPlayback(channelId),
        this.spotify.getQueue(channelId),
      ]);

      this.playback.set(playback);
      this.queue.set(queue);
    } catch (error: unknown) {
      // A channel with nothing playing is the ordinary case, not a failure worth a red banner.
      const rejection: SongRequestRejection | null = rejectionOf(error);
      if (rejection === null || rejection.reason === 'NO_DEVICE') return;

      if (rejection.reason === 'NOT_CONNECTED') this.status.set({ ...this.status(), connected: false });
    }
  }

  private apply(message: SpotifyMessage): void {
    if (message.type === 'disconnected') {
      this.status.set({ ...this.status(), connected: false, displayName: null, status: null });
      this.playback.set(EMPTY_PLAYBACK);
      this.queue.set([]);
      return;
    }

    this.playback.set({
      connected: true,
      isPlaying: message.isPlaying,
      track: message.track,
      progressMs: message.progressMs,
      device: message.device,
    });

    // Left out of the payload rather than sent as null when it was not re-read, so "no queue field"
    // and "an empty queue" stay distinguishable.
    if (message.queue !== undefined) this.queue.set(message.queue);
  }

  /**
   * One write at a time, in the order the buttons were pressed. Two playback commands racing would
   * leave Spotify in whichever state answered last rather than whichever was asked for last.
   */
  private run(command: () => Promise<void>): Promise<void> {
    this.busy.set(true);

    this.writing = this.writing
      .then(command)
      .catch((error: unknown): void => this.complain(error, 'Spotify would not take that.'))
      .finally((): void => this.busy.set(false));

    return this.writing;
  }

  private complain(error: unknown, fallback: string): void {
    const rejection: SongRequestRejection | null = rejectionOf(error);

    this.notifications.failure(rejection === null ? fallback : rejectionText(rejection));
  }

  private clamp(value: string, min: number, max: number): number {
    const parsed: number = Number(value);

    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : min;
  }
}
