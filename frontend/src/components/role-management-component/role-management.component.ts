import { Component, computed, effect, inject, input, InputSignalWithTransform, Signal, signal, untracked, WritableSignal } from '@angular/core';
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

  protected readonly expected: WritableSignal<number | null> = signal<number | null>(null);
  protected readonly busy: WritableSignal<boolean> = signal(false);


  protected readonly initialLoading: Signal<boolean> = computed((): boolean => this.loading() && this.users().length === 0);
  protected readonly showProgress: Signal<boolean> = computed((): boolean => (this.loading() || this.busy()) && !this.initialLoading());

  constructor() {
    // The mode is the only thing this effect reacts to. Everything it then does is a side effect,
    // and it runs untracked so nothing load() happens to read on its way to the first await — the
    // row count, for one — becomes a dependency: load() ends by writing users(), so an effect that
    // had read it would wake itself, clear the list and start over, forever.
    effect((): void => {
      const mode: RoleManagementMode = this.mode();

      untracked((): void => {
        this.users.set([]);
        void this.load(mode);
      });
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
    if (this.mode() === mode) {
      this.loading.set(true);
      this.expected.set(null);
    }

    if (this.users().length === 0) {
      void this.twitch[mode === RoleManagementMode.Vip ? 'countVips' : 'countModerators']()
        .then((count: number): void => {
          if (this.mode() === mode && this.loading()) this.expected.set(count);
        })
        .catch((): void => void 0);
    }

    try {
      const users: TwitchUser[] = mode === RoleManagementMode.Vip
        ? await this.twitch.getVips()
        : await this.twitch.getModerators();

      if (this.mode() !== mode) return;

      this.users.set(users);
    } catch {
      if (this.mode() !== mode) return;

      this.users.set([]);
      this.notifications.failure(`Could not load the ${roleNameFor(mode)} list.`);
    } finally {
      if (this.mode() === mode) this.loading.set(false);
    }
  }
}