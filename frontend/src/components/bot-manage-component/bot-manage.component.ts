import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  InputSignal,
  Signal,
  signal,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { TwitchService } from '../../services/twitch.service';
import { NotificationService } from '../../services/notification.service';
import { ChannelUser } from '../../data/channel-user';
import { TwitchUser } from '../../data/twitch-user';
import { BanStatus } from '../../data/ban-status';

function contains(users: readonly ChannelUser[], userId: string): boolean {
  return users.some((user: ChannelUser): boolean => user.id === userId);
}

@Component({
  selector: 'app-bot-manage',
  templateUrl: './bot-manage.component.html',
  styleUrl: './bot-manage.component.scss',
  standalone: false,
})
export class BotManageComponent {

  private readonly twitch: TwitchService = inject(TwitchService);
  private readonly notifications: NotificationService = inject(NotificationService);

  readonly botUserId: InputSignal<string> = input.required<string>();

  // Acting on a status makes its row disappear, which would drop focus to the body. Moving it to
  // the status heading instead keeps keyboard and screen reader users where they were working.
  private readonly statusHeading: Signal<ElementRef<HTMLElement> | undefined> =
    viewChild<ElementRef<HTMLElement>>('statusHeading');

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
      (botUserId: string): Promise<void> => this.twitch.unbanUser(botUserId),
      `${this.botName()} is no longer banned.`,
      `Could not unban ${this.botName()}.`,
    );
  }

  protected unblock(): Promise<void> {
    return this.act(
      (botUserId: string): Promise<void> => this.twitch.unblockUser(botUserId),
      `${this.botName()} is no longer blocked.`,
      `Could not unblock ${this.botName()}.`,
    );
  }

  protected makeModerator(): Promise<void> {
    return this.act(
      (botUserId: string): Promise<void> => this.twitch.addModerator(botUserId),
      `${this.botName()} is now a moderator.`,
      `Could not make ${this.botName()} a moderator.`,
    );
  }

  // Joining and leaving chat is not part of the Twitch API — it needs YEPPBot itself to act, and
  // there is no endpoint for that yet. The buttons say so rather than failing silently.
  protected notWiredUp(action: string): void {
    this.notifications.failure(`${action} is not wired up yet.`);
  }

  protected reload(): Promise<void> {
    return this.load(this.botUserId());
  }

  private async act(
    action: (botUserId: string) => Promise<void>,
    success: string,
    failure: string,
  ): Promise<void> {
    const botUserId: string = this.botUserId();

    this.busy.set(true);
    try {
      await action(botUserId);
      this.notifications.success(success);
      await this.load(botUserId);
      this.statusHeading()?.nativeElement.focus();
    } catch {
      this.notifications.failure(failure);
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
          this.twitch.loadBlocked(),
          this.twitch.loadModerators(),
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
