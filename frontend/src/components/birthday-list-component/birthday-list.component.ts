import { Component, computed, effect, inject, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { UserInfoDialogComponent } from '../user-info-dialog-component/user-info-dialog.component';
import { AuthService } from '../../services/auth.service';
import { BirthdayService } from '../../services/birthday.service';
import { NotificationService } from '../../services/notification.service';
import { TwitchService } from '../../services/twitch.service';
import { ageOn, Birthday, birthdayToDate, daysUntilNextBirthday } from '../../data/birthday';
import { TwitchUser } from '../../data/twitch-user';

export interface BirthdayEntry {
  birthday: Birthday;

  // Null when Twitch no longer resolves the id — a deleted or renamed account still has a row in
  // YEPPBot's table, and dropping it would silently shorten the list.
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
  standalone: false,
})
export class BirthdayListComponent {

  private readonly birthdays: BirthdayService = inject(BirthdayService);
  private readonly twitch: TwitchService = inject(TwitchService);
  private readonly auth: AuthService = inject(AuthService);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly dialog: MatDialog = inject(MatDialog);

  private readonly rows: WritableSignal<BirthdayEntry[]> = signal<BirthdayEntry[]>([]);
  private readonly isLoading: WritableSignal<boolean> = signal(false);
  private readonly failed: WritableSignal<boolean> = signal(false);

  protected readonly loading: Signal<boolean> = this.isLoading.asReadonly();
  protected readonly unreachable: Signal<boolean> = this.failed.asReadonly();

  protected readonly count: Signal<number> = computed((): number => this.rows().length);

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
        // Month and day only: this column is about when the birthday falls in the year, so sorting
        // it by the full date would order people by age instead.
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
    this.dataSource.filter = value.trim().toLowerCase();
  }

  /**
   * Opens the details of the follower a row belongs to.
   *
   * A no-op when Twitch never resolved the account: the dialog is built around a user, and there is
   * none to hand it.
   */
  protected showDetails(entry: BirthdayEntry, event?: Event): void {
    event?.stopPropagation();
    if (entry.user) UserInfoDialogComponent.open(this.dialog, entry.user);
  }

  protected reload(): Promise<void> {
    return this.load();
  }

  private async load(): Promise<void> {
    const channelId: string | undefined = this.auth.currentUser()?.id;
    if (!channelId) return;

    this.isLoading.set(true);
    this.failed.set(false);
    try {
      const birthdays: Birthday[] = await this.birthdays.getFollowerBirthdays(channelId);

      // The endpoint answers with ids and dates only, so the names come from a second lookup — the
      // same split the role management page uses.
      const users: TwitchUser[] = await this.twitch.getUsers(birthdays.map((entry) => entry.userId));
      const byId: Map<string, TwitchUser> = new Map(users.map((user) => [user.id, user]));

      // One instant for the whole list, so every row is measured against the same day.
      const today: Date = new Date();

      this.rows.set(birthdays.map((birthday: Birthday): BirthdayEntry => {
        const user: TwitchUser | undefined = byId.get(birthday.userId);
        const daysUntil: number = daysUntilNextBirthday(birthday, today);

        return {
          birthday,
          user: user ?? null,
          name: user?.displayName ?? birthday.userId,
          date: birthdayToDate(birthday),
          age: ageOn(birthday, today),
          daysUntil,
          nextLabel: labelFor(daysUntil),
        };
      }));
    } catch {
      this.rows.set([]);
      this.failed.set(true);
      this.notifications.failure('Could not load the birthdays of your followers.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
