import { Component, computed, effect, inject, input, InputSignalWithTransform, Signal, signal, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { firstValueFrom } from 'rxjs';
import { UserAddDialogComponent } from '../user-add-dialog-component/user-add-dialog.component';
import { UserTableComponent, UserTableMode } from '../user-table-component/user-table.component';
import { TwitchService } from '../../services/twitch.service';
import { NotificationService } from '../../services/notification.service';
import { TwitchUser } from '../../data/twitch-user';

export enum RoleManagementMode {
  Moderator = 0,
  Vip = 1,
}

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
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, UserTableComponent],
})
export class RoleManagementComponent {

  private readonly twitch: TwitchService = inject(TwitchService);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly dialog: MatDialog = inject(MatDialog);

  readonly mode: InputSignalWithTransform<RoleManagementMode, string | RoleManagementMode> = input.required({
    transform: (value: string | RoleManagementMode): RoleManagementMode =>
      typeof value === 'string' ? Number(value) : value,
  });

  protected readonly title: Signal<string> = computed((): string => titleFor(this.mode()));

  protected readonly roleName: Signal<string> = computed((): string => roleNameFor(this.mode()));

  protected readonly tableMode: Signal<UserTableMode> = computed((): UserTableMode => tableModeFor(this.mode()));

  protected readonly users: WritableSignal<TwitchUser[]> = signal<TwitchUser[]>([]);

  protected readonly loading: WritableSignal<boolean> = signal(false);

  protected readonly busy: WritableSignal<boolean> = signal(false);

  constructor() {
    effect((): void => {
      const mode: RoleManagementMode = this.mode();

      // Moderators and VIPs are the same component behind two query strings, so switching between
      // them reuses the instance — with the role it was showing a moment ago still in it. Emptied
      // here rather than inside load(), which also runs after an add or a remove, where the list
      // on screen is the right one and blanking it would only make the table flicker.
      this.users.set([]);

      void this.load(mode);
    });
  }

  protected async openAddDialog(): Promise<void> {
    const dialogRef = UserAddDialogComponent.open(this.dialog, `Add ${this.roleName()}`);
    const user: TwitchUser | undefined = await firstValueFrom(dialogRef.afterClosed());

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

  private async load(mode: RoleManagementMode): Promise<void> {
    this.loading.set(true);
    try {
      const users: TwitchUser[] = mode === RoleManagementMode.Vip
        ? await this.twitch.getVips()
        : await this.twitch.getModerators();

      // Switching tabs and back leaves two requests in flight, and nothing says they come back in
      // the order they went out. A reply for the role that is no longer on screen is dropped: the
      // load its own tab switch started is the one that gets to fill the table.
      if (this.mode() !== mode) return;

      this.users.set(users);
    } catch {
      if (this.mode() !== mode) return;

      this.users.set([]);
      this.notifications.failure(`Could not load the ${roleNameFor(mode)} list.`);
    } finally {
      // Left up for a stale reply, otherwise the bar goes out while the request that will actually
      // fill the table is still running.
      if (this.mode() === mode) this.loading.set(false);
    }
  }
}