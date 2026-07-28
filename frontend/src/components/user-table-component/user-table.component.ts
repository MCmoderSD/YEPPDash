import { Component, computed, effect, inject, input, InputSignal, output, OutputEmitterRef, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { UserInfoDialogComponent } from '../user-info-dialog-component/user-info-dialog.component';
import { TwitchService } from '../../services/twitch.service';
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
  private readonly twitch: TwitchService = inject(TwitchService);

  readonly users: InputSignal<TwitchUser[]> = input.required<TwitchUser[]>();

  readonly mode: InputSignal<UserTableMode> = input<UserTableMode>('user');

  readonly showId: InputSignal<boolean> = input<boolean>(true);

  readonly remove: OutputEmitterRef<TwitchUser> = output<TwitchUser>();

  protected readonly dataSource: MatTableDataSource<TwitchUser> = new MatTableDataSource<TwitchUser>([]);

  protected readonly query: WritableSignal<string> = signal('');

  // Plain users cannot be removed from anything, so the column would only ever be an empty stub.
  protected readonly columns: Signal<string[]> = computed(() => {
    const columns: string[] = ['user'];
    if (this.showId()) columns.push('id');
    if (this.mode() !== 'user') columns.push('remove');
    return columns;
  });

  protected readonly role: Signal<string> = computed(() => ROLE_LABELS[this.mode()]);

  private readonly sorter: Signal<MatSort | undefined> = viewChild(MatSort);

  constructor() {
    this.dataSource.filterPredicate = (user, filter) =>
      user.displayName.toLowerCase().includes(filter) || user.id.toLowerCase().includes(filter);

    // Names sort case-insensitively; ids are numeric strings, where a plain string compare would
    // put "10" before "9". MatSort compares numbers numerically when it gets them.
    this.dataSource.sortingDataAccessor = (user, column) => {
      if (column !== 'id') return user.displayName.toLowerCase();

      const numeric: number = Number(user.id);
      return Number.isFinite(numeric) ? numeric : user.id.toLowerCase();
    };

    effect(() => this.dataSource.data = this.users());
    effect(() => {
      const sorter: MatSort | undefined = this.sorter();
      if (sorter) this.dataSource.sort = sorter;
    });

    // Warms TwitchService's per-user cache as soon as the table gets its rows, rather than
    // waiting for the details dialog to ask — that is what used to make the dialog feel slow.
    effect(() => {
      for (const user of this.users()) void this.twitch.getChatColor(user.id);
    });
  }

  protected filter(value: string): void {
    this.query.set(value.trim());
    this.dataSource.filter = value.trim().toLowerCase();
  }

  // Called from the row and from the name button inside it — the button stops the event so the
  // row does not open a second dialog on top of the first.
  protected showDetails(user: TwitchUser, event?: Event): void {
    event?.stopPropagation();
    UserInfoDialogComponent.open(this.dialog, user);
  }

  // The button sits inside a clickable row, so without this every removal would also pop the
  // details dialog for the user that just got removed.
  protected removeUser(event: Event, user: TwitchUser): void {
    event.stopPropagation();
    this.remove.emit(user);
  }
}
