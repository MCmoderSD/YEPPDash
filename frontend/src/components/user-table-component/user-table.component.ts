import { Component, computed, effect, inject, input, InputSignal, output, OutputEmitterRef, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { TableFrameComponent } from '../table-frame-component/table-frame.component';
import { UserIdentityComponent } from '../user-identity-component/user-identity.component';
import { UserInfoDialogComponent } from '../user-info-dialog-component/user-info-dialog.component';
import { TwitchUser } from '../../data/twitch-user';
import { ghostRows } from '../../data/skeleton';

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
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSortModule, MatTableModule, TableFrameComponent, UserIdentityComponent],
})
export class UserTableComponent {

  private readonly dialog: MatDialog = inject(MatDialog);

  readonly users: InputSignal<TwitchUser[]> = input.required<TwitchUser[]>();

  readonly mode: InputSignal<UserTableMode> = input<UserTableMode>('user');

  readonly showId: InputSignal<boolean> = input<boolean>(true);

  readonly loading: InputSignal<boolean> = input<boolean>(false);
  readonly expected: InputSignal<number | null> = input<number | null>(null);

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

  protected readonly ghostColumns: Signal<string> = computed((): string => this.columns().map((column): string => {
    if (column === 'id') return '7rem';
    if (column === 'remove') return '3.5rem';
    return 'minmax(0, 1fr)';
  }).join(' '));

  protected readonly ghostRows: Signal<readonly number[]> = computed((): readonly number[] => ghostRows(this.expected()));

  protected readonly loaded: Signal<boolean> = computed((): boolean => !this.loading());

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

  protected showDetails(user: TwitchUser): void {
    UserInfoDialogComponent.open(this.dialog, user);
  }

  protected removeUser(event: Event, user: TwitchUser): void {
    event.stopPropagation();
    this.remove.emit(user);
  }
}