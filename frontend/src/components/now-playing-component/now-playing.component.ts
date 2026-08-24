import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, effect, EffectCleanupRegisterFn, inject, input, InputSignal, signal, Signal, WritableSignal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { playbackProgress, SpotifyPlayback, trackDuration } from '../../data/spotify';

const TICK_MS: number = 500;

@Component({
  selector: 'app-now-playing',
  imports: [MatIconModule, MatProgressBarModule],
  template: `
    <div class="now-playing">
      @if (playback().track; as track) {
        @if (track.artworkUrl; as artwork) {
          <img class="now-playing-art" [src]="artwork" alt="" width="96" height="96"/>
        } @else {
          <span class="now-playing-art now-playing-art-empty">
            <mat-icon aria-hidden="true">music_note</mat-icon>
          </span>
        }

        <div class="now-playing-body">
          <p class="now-playing-title">{{ track.name }}</p>
          <p class="now-playing-artist">{{ track.artists }}</p>

          <mat-progress-bar
            class="now-playing-bar"
            mode="determinate"
            [value]="percent()"
            [attr.aria-label]="'Track progress: ' + elapsed() + ' of ' + total()"
          />

          <p class="now-playing-meta">
            <span>{{ elapsed() }} / {{ total() }}</span>
            @if (playback().device; as device) {
              <span class="now-playing-device">
                <mat-icon aria-hidden="true">speaker</mat-icon>
                <span>{{ device }}</span>
              </span>
            }
          </p>
        </div>
      } @else {
        <p class="now-playing-idle">
          <mat-icon aria-hidden="true">music_off</mat-icon>
          <span>Nothing is playing. Start something in Spotify and it shows up here.</span>
        </p>
      }
    </div>
  `,
  styles: `
    .now-playing {
      display: flex;
      align-items: center;
      gap: 1rem;
      min-width: 0;
    }

    .now-playing-art {
      flex: none;
      inline-size: 6rem;
      block-size: 6rem;
      border-radius: var(--app-radius-sm);
      object-fit: cover;
    }

    // Same footprint as the artwork it stands in for, so a track without a cover does not make the
    // whole card jump a hundred pixels narrower.
    .now-playing-art-empty {
      display: grid;
      place-items: center;
      background: var(--app-tint-hover);
      color: var(--mat-sys-on-surface-variant);
    }

    .now-playing-body {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      flex: 1;
      min-width: 0;
    }

    .now-playing-title {
      margin: 0;
      font: var(--mat-sys-title-medium);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .now-playing-artist {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .now-playing-bar {
      margin-block-start: 0.5rem;
      border-radius: var(--app-radius-sm);
    }

    .now-playing-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
      font-variant-numeric: tabular-nums;
    }

    .now-playing-device {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      min-width: 0;
    }

    .now-playing-device span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .now-playing-device mat-icon {
      font-size: 1rem;
      inline-size: 1rem;
      block-size: 1rem;
    }

    .now-playing-idle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class NowPlayingComponent {

  readonly playback: InputSignal<SpotifyPlayback> = input.required<SpotifyPlayback>();

  private readonly document: Document = inject(DOCUMENT);

  private readonly now: WritableSignal<number> = signal(0);

  private readonly rendered: WritableSignal<boolean> = signal(false);

  /**
   * When the progress that is now being counted from was measured. The server sends one number every
   * few seconds; between those the bar has to move on its own, or it would sit still for four
   * seconds and then jump.
   */
  private readonly since: WritableSignal<number> = signal(0);

  protected readonly progress: Signal<number> = computed((): number => {
    const playback: SpotifyPlayback = this.playback();

    return playbackProgress(
      playback.isPlaying, playback.progressMs, playback.track?.durationMs ?? 0, this.since(), this.now());
  });

  protected readonly percent: Signal<number> = computed((): number => {
    const duration: number = this.playback().track?.durationMs ?? 0;
    return duration === 0 ? 0 : (this.progress() / duration) * 100;
  });

  protected readonly elapsed: Signal<string> = computed((): string => trackDuration(this.progress()));

  protected readonly total: Signal<string> = computed((): string => trackDuration(this.playback().track?.durationMs ?? 0));

  constructor() {
    afterNextRender((): void => this.rendered.set(true));

    effect((onCleanup: EffectCleanupRegisterFn): void => {
      // Reading the whole object rather than a field: every push replaces it, and every push is a
      // fresh measurement to count from.
      const playing: boolean = this.playback().isPlaying;

      if (!this.rendered()) return;

      const view: (Window & typeof globalThis) | null = this.document.defaultView;
      if (!view) return;

      this.since.set(Date.now());
      this.now.set(Date.now());

      if (!playing) return;

      const handle: number = view.setInterval((): void => this.now.set(Date.now()), TICK_MS);
      onCleanup((): void => view.clearInterval(handle));
    });
  }
}
