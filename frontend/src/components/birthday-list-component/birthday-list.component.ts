import { Component, effect, inject, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { BusyBarComponent } from '../busy-bar-component/busy-bar.component';
import { TableFrameComponent } from '../table-frame-component/table-frame.component';
import { UserIdentityComponent } from '../user-identity-component/user-identity.component';
import { UserInfoDialogComponent } from '../user-info-dialog-component/user-info-dialog.component';
import { LocaleDatePipe } from '../../pipes/locale-date.pipe';
import { AuthService } from '../../services/auth.service';
import { BirthdayService } from '../../services/birthday.service';
import { NotificationService } from '../../services/notification.service';
import { ageOn, Birthday, birthdayToDate, daysUntilNextBirthday, FollowerBirthday } from '../../data/birthday';
import { TwitchUser } from '../../data/twitch-user';
import { ListState } from '../../services/list-state';
import { TableSearchComponent } from '../table-search-component/table-search.component';
import { filterRows } from '../../services/data-source';

export interface BirthdayEntry {
  birthday: Birthday;
  user: TwitchUser | null;
  name: string;
  date: Date;
  age: number;
  daysUntil: number;
  nextLabel: string;
}

function labelFor(daysUntil: number): string {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  return `in ${daysUntil} days`;
}

@Component({
  selector: 'app-birthday-list',
  templateUrl: './birthday-list.component.html',
  styleUrl: './birthday-list.component.scss',
  imports: [TableSearchComponent, BusyBarComponent, DatePipe, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSortModule, MatTableModule, TableFrameComponent, UserIdentityComponent, LocaleDatePipe],
})
export class BirthdayListComponent {

  private readonly birthdays: BirthdayService = inject(BirthdayService);
  private readonly auth: AuthService = inject(AuthService);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly dialog: MatDialog = inject(MatDialog);

  private readonly state: ListState<BirthdayEntry> = new ListState<BirthdayEntry>();

  private readonly rows: Signal<BirthdayEntry[]> = this.state.rows.asReadonly();

  protected readonly loading: Signal<boolean> = this.state.loading.asReadonly();
  protected readonly unreachable: Signal<boolean> = this.state.failed.asReadonly();
  protected readonly count: Signal<number> = this.state.count;
  protected readonly initialLoad: Signal<boolean> = this.state.skeleton;
  protected readonly busy: Signal<boolean> = this.state.refreshing;
  protected readonly skeletonRows: Signal<readonly number[]> = this.state.ghostRows;

  protected readonly columns: string[] = ['user', 'date', 'age', 'next'];

  protected readonly dataSource: MatTableDataSource<BirthdayEntry> = new MatTableDataSource<BirthdayEntry>([]);

  protected readonly query: WritableSignal<string> = signal('');

  private readonly sorter: Signal<MatSort | undefined> = viewChild(MatSort);

  constructor() {
    this.dataSource.filterPredicate = (entry, filter): boolean => {
      return entry.name.toLowerCase().includes(filter) || entry.birthday.userId.includes(filter);
    };

    this.dataSource.sortingDataAccessor = (entry, column): string | number => {
      switch (column) {
        case 'date': return entry.birthday.month * 100 + entry.birthday.day;
        case 'age': return entry.age;
        case 'next': return entry.daysUntil;
        default: return entry.name.toLowerCase();
      }
    };

    effect((): BirthdayEntry[] => this.dataSource.data = this.rows());
    effect((): void => {
      const sorter: MatSort | undefined = this.sorter();
      if (sorter) this.dataSource.sort = sorter;
    });

    void this.load();
  }

  protected filter(value: string): void {
    this.query.set(value.trim());
    filterRows(this.dataSource, value);
  }

  protected showDetails(entry: BirthdayEntry): void {
    if (entry.user) UserInfoDialogComponent.open(this.dialog, entry.user);
  }

  protected reload(): Promise<void> {
    return this.load();
  }

  private async load(): Promise<void> {
    const channelId: string | undefined = this.auth.currentUser()?.id;
    if (!channelId) return;

    await this.state.load(
      (): Promise<number> => this.birthdays.countFollowerBirthdays(channelId),
      async (): Promise<BirthdayEntry[]> => {
        const birthdays: FollowerBirthday[] = await this.birthdays.getFollowerBirthdays(channelId);
        const today: Date = new Date();

        return birthdays.map((birthday: FollowerBirthday): BirthdayEntry => {
          const daysUntil: number = daysUntilNextBirthday(birthday, today);

          return {
            birthday,
            user: birthday.user,
            name: birthday.user?.displayName ?? birthday.userId,
            date: birthdayToDate(birthday),
            age: ageOn(birthday, today),
            daysUntil,
            nextLabel: labelFor(daysUntil),
          };
        });
      },
      (): void => this.notifications.failure('Could not load the birthdays of your followers.'),
    );
  }
}