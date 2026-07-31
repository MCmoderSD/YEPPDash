import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, ElementRef, inject, input, InputSignal, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { BotResult, BotService } from '../../services/bot.service';
import { TwitchService } from '../../services/twitch.service';
import { NotificationService } from '../../services/notification.service';
import { ChannelUser } from '../../data/channel-user';
import { TwitchUser } from '../../data/twitch-user';
import { BanStatus } from '../../data/banned-user';

function contains(users: readonly ChannelUser[], userId: string): boolean {
  return users.some((user: ChannelUser): boolean => user.id === userId);
}

// A refused bot call answers with the bot's own words, which say more than anything this page could
// write — whether it is down, unconfigured, or turned the request down itself.
function reasonFor(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;

  const message: unknown = (error.error as BotResult | null)?.message;
  return typeof message === 'string' && message.trim() ? message.trim() : null;
}

@Component({
  selector: 'app-bot-manage',
  templateUrl: './bot-manage.component.html',
  styleUrl: './bot-manage.component.scss',
  standalone: false,
})
export class BotManageComponent {

  private readonly twitch: TwitchService = inject(TwitchService);
  // Not `bot`: that name already belongs to the signal holding the bot's Twitch account below.
  private readonly botApi: BotService = inject(BotService);
  private readonly auth: AuthService = inject(AuthService);
  private readonly notifications: NotificationService = inject(NotificationService);

  readonly botUserId: InputSignal<string> = input.required<string>();

  private readonly statusHeading: Signal<ElementRef<HTMLElement> | undefined> = viewChild<ElementRef<HTMLElement>>('statusHeading');

  protected readonly bot: WritableSignal<TwitchUser | null> = signal<TwitchUser | null>(null);

  protected readonly chatColor: WritableSignal<string | null> = signal<string | null>(null);

  protected readonly banned: WritableSignal<boolean> = signal(false);

  protected readonly blocked: WritableSignal<boolean> = signal(false);

  protected readonly moderator: WritableSignal<boolean> = signal(false);

  protected readonly inChat: WritableSignal<boolean> = signal(false);

  protected readonly loading: WritableSignal<boolean> = signal(false);

  protected readonly busy: WritableSignal<boolean> = signal(false);

  protected readonly unreachable: WritableSignal<boolean> = signal(false);

  protected readonly botName: Signal<string> = computed((): string => this.bot()?.displayName ?? 'The bot');

  protected readonly healthy: Signal<boolean> = computed(
    (): boolean => !this.banned() && !this.blocked() && this.moderator() && this.inChat(),
  );

  constructor() {
    effect((): undefined => void this.load(this.botUserId()));
  }

  protected unban(): Promise<void> {
    return this.act(
      (): Promise<void> => this.twitch.unbanUser(this.botUserId()),
      `${this.botName()} is no longer banned.`,
      `Could not unban ${this.botName()}.`,
    );
  }

  protected unblock(): Promise<void> {
    return this.act(
      (): Promise<void> => this.twitch.unblockUser(this.botUserId()),
      `${this.botName()} is no longer blocked.`,
      `Could not unblock ${this.botName()}.`,
    );
  }

  protected makeModerator(): Promise<void> {
    return this.act(
      (): Promise<void> => this.twitch.addModerator(this.botUserId()),
      `${this.botName()} is now a moderator.`,
      `Could not make ${this.botName()} a moderator.`,
    );
  }

  // Join and leave name the channel rather than the bot: it is this channel the bot is being asked
  // to come to, and the id the bot's API keys on is the channel owner's.
  protected join(): Promise<void> {
    return this.act(
      async (channelId: string): Promise<void> => void await this.botApi.joinChannel(channelId),
      `${this.botName()} was asked to join your chat.`,
      `Could not bring ${this.botName()} into your chat.`,
    );
  }

  protected leave(): Promise<void> {
    return this.act(
      async (channelId: string): Promise<void> => void await this.botApi.leaveChannel(channelId),
      `${this.botName()} was asked to leave your chat.`,
      `Could not send ${this.botName()} out of your chat.`,
    );
  }

  protected reload(): Promise<void> {
    return this.load(this.botUserId());
  }

  /**
   * @param action Handed the signed-in channel's id, which is what the bot's own routes key on.
   *               Anything acting on the bot's Twitch account reads {@link botUserId} instead.
   */
  private async act(
    action: (channelId: string) => Promise<void>,
    success: string,
    failure: string,
  ): Promise<void> {
    const channelId: string | undefined = this.auth.currentUser()?.id;
    if (!channelId) return;

    this.busy.set(true);
    try {
      await action(channelId);
      this.notifications.success(success);
      await this.load(this.botUserId());
      this.statusHeading()?.nativeElement.focus();
    } catch (error: unknown) {
      this.notifications.failure(reasonFor(error) ?? failure);
    } finally {
      this.busy.set(false);
    }
  }

  private async load(botUserId: string): Promise<void> {
    this.loading.set(true);
    try {
      const [users, color, ban, blocked, moderators, chatters]:
        [TwitchUser[], string | null, BanStatus, ChannelUser[], ChannelUser[], ChannelUser[]] =
        await Promise.all([
          this.twitch.getUsers([botUserId]),
          this.twitch.getChatColor(botUserId),
          this.twitch.getBanStatus(botUserId),
          this.twitch.getBlocked(),
          this.twitch.getModerators(),
          this.twitch.getChatters(),
        ]);

      this.bot.set(users[0] ?? null);
      this.chatColor.set(color);
      this.banned.set(ban.banned);
      this.blocked.set(contains(blocked, botUserId));
      this.moderator.set(contains(moderators, botUserId));
      this.inChat.set(contains(chatters, botUserId));
      this.unreachable.set(false);
    } catch {
      this.bot.set(null);
      this.unreachable.set(true);
      this.notifications.failure('Could not load the bot status.');
    } finally {
      this.loading.set(false);
    }
  }
}