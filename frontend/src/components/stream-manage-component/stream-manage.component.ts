import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, signal, Signal, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { ManageBroadcastDialogComponent } from '../manage-broadcast-dialog-component/manage-broadcast-dialog.component';
import { NotificationService } from '../../services/notification.service';
import { TwitchService } from '../../services/twitch.service';
import { boxArtUrl, BROADCAST_LANGUAGES, ChannelCategory, ChannelInformation, CONTENT_LABELS, delayText, EMPTY_CHANNEL } from '../../data/channel';

@Component({
  selector: 'app-stream-manage',
  templateUrl: './stream-manage.component.html',
  styleUrl: './stream-manage.component.scss',
  imports: [NgOptimizedImage, MatButtonModule, MatIconModule, MatTooltipModule],
})
export class StreamManageComponent {

  private readonly twitch: TwitchService = inject(TwitchService);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly dialog: MatDialog = inject(MatDialog);

  protected readonly channel: WritableSignal<ChannelInformation> = signal<ChannelInformation>(EMPTY_CHANNEL);
  protected readonly loading: WritableSignal<boolean> = signal(true);
  protected readonly game: WritableSignal<ChannelCategory | null> = signal<ChannelCategory | null>(null);

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

  protected readonly delayText: Signal<string> = computed((): string => delayText(this.channel().delay));

  constructor() {
    void this.load();
  }

  protected art(category: ChannelCategory): string {
    return boxArtUrl(category.boxArtUrl);
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

  private async load(): Promise<void> {
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

  private category(channel: ChannelInformation): ChannelCategory | null {
    return channel.gameId ? { id: channel.gameId, name: channel.gameName, boxArtUrl: channel.boxArtUrl } : null;
  }
}