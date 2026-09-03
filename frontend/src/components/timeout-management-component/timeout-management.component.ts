import { Component, computed, effect, inject, Signal, signal, untracked, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { BusyBarComponent } from '../busy-bar-component/busy-bar.component';
import { firstValueFrom } from 'rxjs';
import { BanChoice, BanUserDialogComponent } from '../ban-user-dialog-component/ban-user-dialog.component';
import { BanTableComponent } from '../ban-table-component/ban-table.component';
import { TwitchService } from '../../services/twitch.service';
import { NotificationService } from '../../services/notification.service';
import { BanCounts, BannedUser } from '../../data/banned-user';

export enum BanTab {
  Timeouts = 0,
  Bans = 1,
}

@Component({
  selector: 'app-timeout-management',
  templateUrl: './timeout-management.component.html',
  styleUrl: './timeout-management.component.scss',
  imports: [BusyBarComponent, MatButtonModule, MatIconModule, MatTabsModule, BanTableComponent],
})
export class TimeoutManagementComponent {

  private readonly twitch: TwitchService = inject(TwitchService);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly dialog: MatDialog = inject(MatDialog);

  private readonly bans: WritableSignal<BannedUser[]> = signal<BannedUser[]>([]);

  private readonly counts: WritableSignal<BanCounts | null> = signal<BanCounts | null>(null);

  protected readonly loading: WritableSignal<boolean> = signal(false);
  protected readonly busy: WritableSignal<boolean> = signal(false);

  protected readonly selected: WritableSignal<BanTab> = signal(BanTab.Timeouts);

  protected readonly timeouts: Signal<BannedUser[]> = computed((): BannedUser[] => this.bans().filter((ban: BannedUser): boolean => ban.expiresAt !== null));
  protected readonly permanent: Signal<BannedUser[]> = computed((): BannedUser[] => this.bans().filter((ban: BannedUser): boolean => ban.expiresAt === null));

  protected readonly initialLoading: Signal<boolean> = computed((): boolean => this.loading() && this.bans().length === 0);
  protected readonly showProgress: Signal<boolean> = computed((): boolean => (this.loading() || this.busy()) && !this.initialLoading());

  protected readonly expectedTimeouts: Signal<number | null> = computed((): number | null => this.counts()?.timeouts ?? null);
  protected readonly expectedBans: Signal<number | null> = computed((): number | null => this.counts()?.bans ?? null);

  protected readonly timeoutLabel: Signal<string> = computed((): string => this.tabLabel('Timeouts', this.timeouts().length, this.expectedTimeouts()));
  protected readonly banLabel: Signal<string> = computed((): string => this.tabLabel('Bans', this.permanent().length, this.expectedBans()));

  protected readonly banning: Signal<boolean> = computed((): boolean => this.selected() === BanTab.Bans);
  protected readonly addLabel: Signal<string> = computed((): string => this.banning() ? 'Ban user' : 'Timeout user');

  constructor() {
    effect((): void => {
      this.twitch.bansChanged();
      untracked((): void => void this.load());
    });
  }

  protected select(index: BanTab): void {
    this.selected.set(index);
  }

  protected async openBanDialog(): Promise<void> {
    const dialogRef = BanUserDialogComponent.open(this.dialog, this.banning());
    const choice: BanChoice | undefined = await firstValueFrom(dialogRef.afterClosed());

    if (choice) await this.ban(choice);
  }

  protected async revoke(ban: BannedUser): Promise<void> {
    const timeout: boolean = ban.expiresAt !== null;

    this.busy.set(true);
    try {
      await this.twitch.unbanUser(ban.id);

      this.notifications.success(timeout
        ? `The timeout on ${ban.displayName} is lifted.`
        : `${ban.displayName} is unbanned.`);
    } catch {
      this.notifications.failure(timeout
        ? `Could not lift the timeout on ${ban.displayName}.`
        : `Could not unban ${ban.displayName}.`);
    } finally {
      this.busy.set(false);
    }
  }

  private async ban(choice: BanChoice): Promise<void> {
    const timeout: boolean = choice.duration !== null;

    this.busy.set(true);
    try {
      await this.twitch.banUser(choice.user.id, choice.duration, choice.reason);

      this.notifications.success(timeout
        ? `${choice.user.displayName} is timed out.`
        : `${choice.user.displayName} is banned.`);

      this.select(timeout ? BanTab.Timeouts : BanTab.Bans);
    } catch {
      this.notifications.failure(timeout
        ? `Could not time out ${choice.user.displayName}.`
        : `Could not ban ${choice.user.displayName}.`);
    } finally {
      this.busy.set(false);
    }
  }

  private tabLabel(name: string, loaded: number, expected: number | null): string {
    const count: number | null = this.initialLoading() ? expected : loaded;
    return count === null ? name : `${name} (${count})`;
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.counts.set(null);

    if (this.bans().length === 0) {
      void this.twitch.countBans()
        .then((counts: BanCounts): void => {
          if (this.loading()) this.counts.set(counts);
        })
        .catch((): void => void 0);
    }

    try {
      this.bans.set(await this.twitch.getBannedUsers());
    } catch {
      this.bans.set([]);
      this.notifications.failure('Could not load the banlist.');
    } finally {
      this.loading.set(false);
    }
  }
}