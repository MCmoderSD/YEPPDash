import { Component, computed, effect, inject, input, InputSignal, output, OutputEmitterRef, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { UserInfoDialogComponent } from '../user-info-dialog-component/user-info-dialog.component';
import { TwitchUser } from '../../data/twitch-user';

export type UserTableMode = 'user' | 'vip' | 'editor' | 'moderator';

const ROLE_LABELS: Record<UserTableMode, string> = {
  user: 'user',
  vip: 'VIP',
  editor: 'editor',
  moderator: 'moderator',
};

@Component({
  selector: 'app-user-table',
  templateUrl: './user-table.component.html',
  styleUrl: './user-table.component.scss',
  standalone: false,
})
export class UserTableComponent {

  private readonly dialog: MatDialog = inject(MatDialog);

  readonly users: InputSignal<TwitchUser[]> = input.required<TwitchUser[]>();

  readonly mode: InputSignal<UserTableMode> = input<UserTableMode>('user');

  readonly showId: InputSignal<boolean> = input<boolean>(true);

  readonly remove: OutputEmitterRef<TwitchUser> = output<TwitchUser>();

  protected readonly dataSource: MatTableDataSource<TwitchUser> = new MatTableDataSource<TwitchUser>([]);

  protected readonly query: WritableSignal<string> = signal('');

  protected readonly columns: Signal<string[]> = computed(() => {
    const columns: string[] = ['user'];
    if (this.showId()) columns.push('id');
    if (this.mode() !== 'user') columns.push('remove');
    return columns;
  });

  protected readonly role: Signal<string> = computed(() => ROLE_LABELS[this.mode()]);

  private readonly sorter: Signal<MatSort | undefined> = viewChild(MatSort);

  constructor() {
    this.dataSource.filterPredicate = (user, filter): boolean => {
      return user.displayName.toLowerCase().includes(filter) || user.id.toLowerCase().includes(filter);
    }

    this.dataSource.sortingDataAccessor = (user, column) => {
      if (column !== 'id') return user.displayName.toLowerCase();

      const numeric: number = Number(user.id);
      return Number.isFinite(numeric) ? numeric : user.id.toLowerCase();
    };

    effect((): TwitchUser[] => this.dataSource.data = this.users());
    effect((): void => {
      const sorter: MatSort | undefined = this.sorter();
      if (sorter) this.dataSource.sort = sorter;
    });
  }

  protected filter(value: string): void {
    this.query.set(value.trim());
    this.dataSource.filter = value.trim().toLowerCase();
  }

  protected showDetails(user: TwitchUser, event?: Event): void {
    event?.stopPropagation();
    UserInfoDialogComponent.open(this.dialog, user);
  }

  protected removeUser(event: Event, user: TwitchUser): void {
    event.stopPropagation();
    this.remove.emit(user);
  }
}