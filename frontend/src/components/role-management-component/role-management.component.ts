import { Component, computed, effect, inject, input, InputSignalWithTransform, Signal, signal, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { UserAddDialogComponent } from '../user-add-dialog-component/user-add-dialog.component';
import { UserTableMode } from '../user-table-component/user-table.component';
import { TwitchService } from '../../services/twitch.service';
import { NotificationService } from '../../services/notification.service';
import { ChannelUser } from '../../data/channel-user';
import { RoleManagementMode } from '../../data/role-management-mode';
import { TwitchUser } from '../../data/twitch-user';

function titleFor(mode: RoleManagementMode): string {
  switch (mode) {
    case RoleManagementMode.Moderator: return 'Moderator Management';
    case RoleManagementMode.Vip: return 'VIP Management';
    default: throw new Error(`Unknown RoleManagementMode: ${mode}`);
  }
}

function roleNameFor(mode: RoleManagementMode): string {
  switch (mode) {
    case RoleManagementMode.Moderator: return 'moderator';
    case RoleManagementMode.Vip: return 'VIP';
    default: throw new Error(`Unknown RoleManagementMode: ${mode}`);
  }
}

function tableModeFor(mode: RoleManagementMode): UserTableMode {
  switch (mode) {
    case RoleManagementMode.Moderator: return 'moderator';
    case RoleManagementMode.Vip: return 'vip';
    default: throw new Error(`Unknown RoleManagementMode: ${mode}`);
  }
}

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

  // The router hands this in as the raw query-string value ("0"/"1"), so the transform is what
  // turns it into the enum. There is no default: a missing or malformed ?mode= is a hard failure
  // (Angular's own "required input" error, or the throw in the functions below) rather than a
  // silent fallback to Moderator.
  readonly mode: InputSignalWithTransform<RoleManagementMode, string | RoleManagementMode> = input.required({
    transform: (value: string | RoleManagementMode): RoleManagementMode =>
      typeof value === 'string' ? Number(value) : value,
  });

  protected readonly title: Signal<string> = computed(() => titleFor(this.mode()));

  protected readonly roleName: Signal<string> = computed(() => roleNameFor(this.mode()));

  protected readonly tableMode: Signal<UserTableMode> = computed(() => tableModeFor(this.mode()));

  protected readonly users: WritableSignal<TwitchUser[]> = signal<TwitchUser[]>([]);

  protected readonly loading: WritableSignal<boolean> = signal(false);

  protected readonly busy: WritableSignal<boolean> = signal(false);

  constructor() {
    effect(() => void this.load(this.mode()));
  }

  protected async openAddDialog(): Promise<void> {
    const dialogRef = UserAddDialogComponent.open(this.dialog, `Add ${this.roleName()}`);
    const user: TwitchUser | undefined = await firstValueFrom(dialogRef.afterClosed());

    // Closed with Cancel, Escape or a backdrop click — nothing was picked, so nothing happens.
    if (user) await this.add(user);
  }

  protected async remove(user: TwitchUser): Promise<void> {
    const mode: RoleManagementMode = this.mode();
    const roleName: string = roleNameFor(mode);

    this.busy.set(true);
    try {
      if (mode === RoleManagementMode.Vip) await this.twitch.removeVip(user.id);
      else await this.twitch.removeModerator(user.id);

      this.notifications.success(`${user.displayName} is no longer a ${roleName}.`);
      await this.load(mode);
    } catch {
      this.notifications.failure(`Could not remove ${user.displayName} as ${roleName}.`);
    } finally {
      this.busy.set(false);
    }
  }

  // The dialog has already resolved the name to a real account, so this only has to act on it.
  private async add(user: TwitchUser): Promise<void> {
    const mode: RoleManagementMode = this.mode();
    const roleName: string = roleNameFor(mode);

    this.busy.set(true);
    try {
      if (mode === RoleManagementMode.Vip) await this.twitch.addVip(user.id);
      else await this.twitch.addModerator(user.id);

      this.notifications.success(`${user.displayName} is now a ${roleName}.`);
      await this.load(mode);
    } catch {
      this.notifications.failure(`Could not add ${user.displayName} as ${roleName}.`);
    } finally {
      this.busy.set(false);
    }
  }

  // The role list only carries ids and names, so the avatars the table shows need a second call —
  // that is what the batched Get Users endpoint is for, one request per 100 entries.
  private async load(mode: RoleManagementMode): Promise<void> {
    this.loading.set(true);
    try {
      const entries: ChannelUser[] = mode === RoleManagementMode.Vip
        ? await this.twitch.loadVips()
        : await this.twitch.loadModerators();

      this.users.set(await this.twitch.getUsers(entries.map((entry) => entry.id)));
    } catch {
      this.users.set([]);
      this.notifications.failure(`Could not load the ${roleNameFor(mode)} list.`);
    } finally {
      this.loading.set(false);
    }
  }
}
