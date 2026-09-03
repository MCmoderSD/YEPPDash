import { Component, computed, effect, inject, input, InputSignal, model, ModelSignal, Signal, signal, untracked, WritableSignal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { NoticeComponent, NoticeTone } from '../notice-component/notice.component';
import { TwitchService } from '../../services/twitch.service';
import { NotificationService } from '../../services/notification.service';
import { errorMessage } from '../../services/http-error';
import { BannedUser } from '../../data/banned-user';
import { TwitchUser } from '../../data/twitch-user';

@Component({
  selector: 'app-ban-notice',
  templateUrl: './ban-notice.component.html',
  styleUrl: './ban-notice.component.scss',
  imports: [DatePipe, MatButtonModule, NoticeComponent],
})
export class BanNoticeComponent {

  private readonly twitch: TwitchService = inject(TwitchService);
  private readonly notifications: NotificationService = inject(NotificationService);

  readonly user: InputSignal<TwitchUser | null> = input<TwitchUser | null>(null);
  readonly note: InputSignal<string> = input<string>('');
  readonly tone: InputSignal<NoticeTone> = input<NoticeTone>('warning');

  readonly ban: ModelSignal<BannedUser | null> = model<BannedUser | null>(null);

  protected readonly lifting: WritableSignal<boolean> = signal(false);

  protected readonly timedOut: Signal<boolean> = computed((): boolean => {
    const ban: BannedUser | null = this.ban();
    return ban !== null && ban.expiresAt !== null;
  });

  protected readonly icon: Signal<string> = computed((): string => this.timedOut() ? 'timer_off' : 'gavel');

  protected readonly actionText: Signal<string> = computed((): string => this.timedOut() ? 'Lift timeout' : 'Unban');

  protected readonly actionLabel: Signal<string> = computed((): string => {
    const name: string = this.ban()?.displayName ?? '';
    return this.timedOut() ? `${this.actionText()} on ${name}` : `${this.actionText()} ${name}`;
  });

  constructor() {
    effect((): void => {
      const user: TwitchUser | null = this.user();

      untracked((): void => void this.check(user));
    });
  }

  protected async lift(): Promise<void> {
    const ban: BannedUser | null = this.ban();
    if (ban === null || this.lifting()) return;

    const timeout: boolean = this.timedOut();

    this.lifting.set(true);
    try {
      await this.twitch.unbanUser(ban.id);
      this.ban.set(null);

      this.notifications.success(timeout
        ? `The timeout on ${ban.displayName} is lifted.`
        : `${ban.displayName} is unbanned.`);
    } catch (error: unknown) {
      this.notifications.failure(errorMessage(error, timeout
        ? `Could not lift the timeout on ${ban.displayName}.`
        : `Could not unban ${ban.displayName}.`));
    } finally {
      this.lifting.set(false);
    }
  }

  private async check(user: TwitchUser | null): Promise<void> {
    this.ban.set(null);
    if (user === null) return;

    try {
      const ban: BannedUser | null = await this.twitch.getBan(user.id);
      if (this.user()?.id === user.id) this.ban.set(ban);
    } catch {
      // Left as unrestricted, see above.
    }
  }
}