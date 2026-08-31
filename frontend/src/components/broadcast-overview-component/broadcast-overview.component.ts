import { NgOptimizedImage } from '@angular/common';
import { Component, computed, effect, inject, Signal, signal, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ManageBroadcastDialogComponent } from '../manage-broadcast-dialog-component/manage-broadcast-dialog.component';
import { UserListDialogComponent } from '../user-list-dialog-component/user-list-dialog.component';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { TwitchService } from '../../services/twitch.service';
import { BROADCAST_LANGUAGES, ChannelCategory, ChannelInformation, CONTENT_LABELS, delayShort, EMPTY_CHANNEL } from '../../data/channel';
import { COMMUNITY_PATH } from '../../data/dash-nav';
import { StreamStatus } from '../../data/stream';
import { fullSizeUrl } from '../../data/twitch-image';
import { TwitchUser } from '../../data/twitch-user';


const NO_VALUE: string = '—';
const TICK_MS: number = 30_000;

function counted(value: number | null): string {
  return value === null ? NO_VALUE : value.toLocaleString();
}

function elapsed(fromIso: string, now: number): string | null {
  const started: number = new Date(fromIso).getTime();
  if (Number.isNaN(started)) return null;

  const minutes: number = Math.floor((now - started) / 60_000);
  if (minutes < 0) return null;

  const hours: number = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

@Component({
  selector: 'app-broadcast-overview',
  templateUrl: './broadcast-overview.component.html',
  styleUrl: './broadcast-overview.component.scss',
  imports: [NgOptimizedImage, MatButtonModule, MatIconModule, MatTooltipModule, RouterLink],
})
export class BroadcastOverviewComponent {

  private readonly twitch: TwitchService = inject(TwitchService);
  private readonly auth: AuthService = inject(AuthService);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly dialog: MatDialog = inject(MatDialog);

  protected readonly channel: WritableSignal<ChannelInformation> = signal<ChannelInformation>(EMPTY_CHANNEL);
  protected readonly loading: WritableSignal<boolean> = signal(true);
  protected readonly game: WritableSignal<ChannelCategory | null> = signal<ChannelCategory | null>(null);

  private readonly stream: WritableSignal<StreamStatus | null> = signal<StreamStatus | null>(null);
  private readonly chatters: WritableSignal<number | null> = signal<number | null>(null);
  private readonly followers: WritableSignal<number | null> = signal<number | null>(null);

  protected readonly streamPending: WritableSignal<boolean> = signal(true);
  protected readonly chattersPending: WritableSignal<boolean> = signal(true);
  protected readonly followersPending: WritableSignal<boolean> = signal(true);

  private readonly now: WritableSignal<number> = signal(Date.now());
  private readonly previewFailed: WritableSignal<boolean> = signal(false);

  private readonly name: Signal<string | null> = computed(
    (): string | null => this.auth.currentUser()?.displayName ?? null,
  );

  protected readonly channelUrl: Signal<string | null> = computed((): string | null => {
    const name: string | null = this.name();
    return name ? `https://www.twitch.tv/${encodeURIComponent(name)}` : null;
  });

  protected readonly dashboardUrl: Signal<string | null> = computed((): string | null => {
    const name: string | null = this.name();
    return name ? `https://dashboard.twitch.tv/u/${encodeURIComponent(name)}` : null;
  });

  protected readonly communityPath: string = COMMUNITY_PATH;

  protected readonly chatterCount: Signal<number | null> = this.chatters.asReadonly();

  protected readonly pending: Signal<boolean> = computed(
    (): boolean => this.streamPending() || this.chattersPending() || this.followersPending(),
  );

  protected readonly live: Signal<boolean> = computed((): boolean => this.stream()?.live ?? false);

  protected readonly uptime: Signal<string | null> = computed((): string | null => {
    const started: string | undefined = this.stream()?.stream?.startedAt;
    return started ? elapsed(started, this.now()) : null;
  });

  protected readonly viewers: Signal<string> = computed((): string => {
    const status: StreamStatus | null = this.stream();
    return status?.live && status.stream ? status.stream.viewerCount.toLocaleString() : NO_VALUE;
  });

  protected readonly boxed: Signal<boolean> = computed((): boolean => this.streamPending() || !this.live());
  protected readonly inChat: Signal<string> = computed((): string => counted(this.chatters()));
  protected readonly followerCount: Signal<string> = computed((): string => counted(this.followers()));

  protected readonly preview: Signal<string | null> = computed((): string | null => {
    if (this.previewFailed()) return null;

    const template: string = this.stream()?.stream?.thumbnailUrl ?? '';
    return template ? fullSizeUrl(template) : null;
  });

  protected readonly languageName: Signal<string> = computed((): string => {
    const code: string = this.channel().broadcasterLanguage;
    return BROADCAST_LANGUAGES.find((option): boolean => option.code === code)?.name ?? code;
  });

  protected readonly labelNames: Signal<string[]> = computed((): string[] => {
    const enabled: string[] = this.channel().contentClassificationLabels;

    return CONTENT_LABELS
      .filter((label: typeof CONTENT_LABELS[number]): boolean => enabled.includes(label.id))
      .map((label: typeof CONTENT_LABELS[number]): string => label.label);
  });

  protected readonly delay: Signal<string> = computed((): string => delayShort(this.channel().delay));

  constructor() {
    void this.loadChannel();
    void this.settle(this.twitch.getStreamStatus(), this.stream, this.streamPending);
    void this.settle(this.twitch.countChatters(), this.chatters, this.chattersPending);
    void this.settle(this.twitch.countFollowers(), this.followers, this.followersPending);

    effect((onCleanup: (fn: () => void) => void): void => {
      if (!this.live()) return;

      const timer: ReturnType<typeof setInterval> = setInterval((): void => this.now.set(Date.now()), TICK_MS);
      onCleanup((): void => clearInterval(timer));
    });
  }

  protected art(category: ChannelCategory): string {
    return fullSizeUrl(category.boxArtUrl);
  }

  protected async manage(): Promise<void> {
    const saved: ChannelInformation | undefined = await firstValueFrom(
      ManageBroadcastDialogComponent
        .open(this.dialog, { channel: this.channel(), game: this.game() })
        .afterClosed());

    if (!saved) return;

    this.channel.set(saved);
    this.game.set(this.category(saved));
  }

  protected showChatters(): void {
    UserListDialogComponent.open(this.dialog, {
      title: 'In chat',
      load: (): Promise<TwitchUser[]> => this.twitch.getChatters(),
      expected: this.chatterCount(),
      failure: 'Could not read who is in your chat.',
    });
  }

  protected dropPreview(): void {
    this.previewFailed.set(true);
  }

  private async loadChannel(): Promise<void> {
    this.loading.set(true);

    try {
      const channel: ChannelInformation = await this.twitch.getChannel();

      this.channel.set(channel);
      this.game.set(this.category(channel));
    } catch {
      this.notifications.failure('Could not read your channel information.');
    } finally {
      this.loading.set(false);
    }
  }

  private async settle<T>(request: Promise<T>, value: WritableSignal<T | null>, pending: WritableSignal<boolean>): Promise<void> {
    try {
      value.set(await request);
    } catch {
      value.set(null);
    } finally {
      pending.set(false);
    }
  }

  private category(channel: ChannelInformation): ChannelCategory | null {
    return channel.gameId ? { id: channel.gameId, name: channel.gameName, boxArtUrl: channel.boxArtUrl } : null;
  }
}