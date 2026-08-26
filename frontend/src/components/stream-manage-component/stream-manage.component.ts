import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, signal, Signal, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { ManageBroadcastDialogComponent } from '../manage-broadcast-dialog-component/manage-broadcast-dialog.component';
import { NotificationService } from '../../services/notification.service';
import { TwitchService } from '../../services/twitch.service';
import {
  boxArtUrl, BROADCAST_LANGUAGES, ChannelCategory, ChannelInformation, CONTENT_LABELS, delayText,
  EMPTY_CHANNEL,
} from '../../data/channel';

@Component({
  selector: 'app-stream-manage',
  templateUrl: './stream-manage.component.html',
  styleUrl: './stream-manage.component.scss',
  imports: [NgOptimizedImage, MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule],
})
export class StreamManageComponent {

  private readonly twitch: TwitchService = inject(TwitchService);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly dialog: MatDialog = inject(MatDialog);

  protected readonly channel: WritableSignal<ChannelInformation> = signal<ChannelInformation>(EMPTY_CHANNEL);
  protected readonly loading: WritableSignal<boolean> = signal(true);

  // The cover for the category that is set. Kept beside the channel rather than in it, because Get
  // Channel Information does not carry one and it takes a second request to find.
  protected readonly game: WritableSignal<ChannelCategory | null> = signal<ChannelCategory | null>(null);

  protected readonly languageName: Signal<string> = computed((): string => {
    const code: string = this.channel().broadcasterLanguage;
    return BROADCAST_LANGUAGES.find((option): boolean => option.code === code)?.name ?? code;
  });

  // Only the labels this dashboard can set. Twitch adds others of its own — MatureGame comes from
  // the category's age rating — and listing those here read as a setting somebody had made, when
  // nothing on this page can touch them. Viewers still see them; this card simply does not.
  protected readonly labelNames: Signal<string[]> = computed((): string[] => {
    const enabled: string[] = this.channel().contentClassificationLabels;

    return CONTENT_LABELS
      .filter((label): boolean => enabled.includes(label.id))
      .map((label): string => label.label);
  });

  protected readonly delayText: Signal<string> = computed((): string => delayText(this.channel().delay));

  constructor() {
    void this.load();
  }

  protected art(category: ChannelCategory, width: number, height: number): string {
    return boxArtUrl(category.boxArtUrl, width, height);
  }

  protected async manage(): Promise<void> {
    const saved: ChannelInformation | undefined = await firstValueFrom(
      ManageBroadcastDialogComponent
        .open(this.dialog, { channel: this.channel(), game: this.game() })
        .afterClosed());

    // Undefined means the dialog was dismissed without saving, and nothing on the channel moved.
    if (!saved) return;

    this.channel.set(saved);
    this.game.set(saved.gameId ? { id: saved.gameId, name: saved.gameName, boxArtUrl: '' } : null);

    await this.loadBoxArt();
  }

  private async load(): Promise<void> {
    this.loading.set(true);

    try {
      const channel: ChannelInformation = await this.twitch.getChannel();

      this.channel.set(channel);
      this.game.set(channel.gameId ? { id: channel.gameId, name: channel.gameName, boxArtUrl: '' } : null);
    } catch {
      this.notifications.failure('Could not read your channel information.');
    } finally {
      this.loading.set(false);
    }

    await this.loadBoxArt();
  }

  // A second call on purpose, and only when there is a category: the cover is the one thing the
  // channel does not carry, and the preview would otherwise sit empty. A failure here costs the
  // artwork, not the page.
  private async loadBoxArt(): Promise<void> {
    const current: ChannelCategory | null = this.game();
    if (current === null || current.boxArtUrl) return;

    try {
      const [game] = await this.twitch.getGames([current.id]);
      if (game && this.game()?.id === game.id) this.game.set(game);
    } catch {
      // Left without a cover rather than reported: nothing the viewer of this page can act on.
    }
  }
}
