import { Component, computed, effect, inject, input, InputSignal, Signal, signal, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { UserAddDialogComponent } from '../user-add-dialog-component/user-add-dialog.component';
import { TwitchService } from '../../services/twitch.service';
import { NotificationService } from '../../services/notification.service';
import { ChannelUser } from '../../data/channel-user';
import { TwitchUser } from '../../data/twitch-user';

export type RoleManagementMode = 'moderator' | 'vip';

const TITLES: Record<RoleManagementMode, string> = {
  moderator: 'Moderator Management',
  vip: 'VIP Management',
};

const ROLE_NAMES: Record<RoleManagementMode, string> = {
  moderator: 'moderator',
  vip: 'VIP',
};

@Component({
  selector: 'app-role-management',
  templateUrl: './role-management.component.html',
  styleUrl: './role-management.component.scss',
  standalone: false,
})
export class RoleManagementComponent {

  private readonly twitch: TwitchService = inject(TwitchService);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly dialog: MatDialog = inject(MatDialog);

  // Typed loosely because the router binds this straight from ?mode=, where anything can show up.
  readonly mode: InputSignal<string> = input<string>('moderator');

  protected readonly role: Signal<RoleManagementMode> = computed(() => this.mode() === 'vip' ? 'vip' : 'moderator');

  protected readonly title: Signal<string> = computed(() => TITLES[this.role()]);

  protected readonly roleName: Signal<string> = computed(() => ROLE_NAMES[this.role()]);

  protected readonly users: WritableSignal<TwitchUser[]> = signal<TwitchUser[]>([]);

  protected readonly loading: WritableSignal<boolean> = signal(false);

  protected readonly busy: WritableSignal<boolean> = signal(false);

  constructor() {
    effect(() => void this.load(this.role()));
  }

  protected async openAddDialog(): Promise<void> {
    const dialogRef = UserAddDialogComponent.open(this.dialog, this.roleName());
    const user: TwitchUser | undefined = await firstValueFrom(dialogRef.afterClosed());

    // Closed with Cancel, Escape or a backdrop click — nothing was picked, so nothing happens.
    if (user) await this.add(user);
  }

  protected async remove(user: TwitchUser): Promise<void> {
    const role: RoleManagementMode = this.role();
    const roleName: string = ROLE_NAMES[role];

    this.busy.set(true);
    try {
      if (role === 'vip') await this.twitch.removeVip(user.id);
      else await this.twitch.removeModerator(user.id);

      this.notifications.success(`${user.displayName} is no longer a ${roleName}.`);
      await this.load(role);
    } catch {
      this.notifications.failure(`Could not remove ${user.displayName} as ${roleName}.`);
    } finally {
      this.busy.set(false);
    }
  }

  // The dialog has already resolved the name to a real account, so this only has to act on it.
  private async add(user: TwitchUser): Promise<void> {
    const role: RoleManagementMode = this.role();
    const roleName: string = ROLE_NAMES[role];

    this.busy.set(true);
    try {
      if (role === 'vip') await this.twitch.addVip(user.id);
      else await this.twitch.addModerator(user.id);

      this.notifications.success(`${user.displayName} is now a ${roleName}.`);
      await this.load(role);
    } catch {
      this.notifications.failure(`Could not add ${user.displayName} as ${roleName}.`);
    } finally {
      this.busy.set(false);
    }
  }

  // The role list only carries ids and names, so the avatars the table shows need a second call —
  // that is what the batched Get Users endpoint is for, one request per 100 entries.
  private async load(role: RoleManagementMode): Promise<void> {
    this.loading.set(true);
    try {
      const entries: ChannelUser[] = role === 'vip'
        ? await this.twitch.loadVips()
        : await this.twitch.loadModerators();

      this.users.set(await this.twitch.getUsers(entries.map((entry) => entry.id)));
    } catch {
      this.users.set([]);
      this.notifications.failure(`Could not load the ${ROLE_NAMES[role]} list.`);
    } finally {
      this.loading.set(false);
    }
  }
}
