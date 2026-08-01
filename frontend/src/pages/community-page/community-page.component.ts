import { Component, computed, effect, inject, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { UserInfoDialogComponent } from '../../components/user-info-dialog-component/user-info-dialog.component';
import { NotificationService } from '../../services/notification.service';
import { TwitchService } from '../../services/twitch.service';
import { FollowerProfile } from '../../data/follower';

export interface CommunityEntry {
  user: FollowerProfile;
  followedAt: Date;
}

@Component({
  selector: 'app-community-page',
  templateUrl: './community-page.component.html',
  styleUrl: './community-page.component.scss',
  standalone: false,
})
export class CommunityPageComponent {

  private readonly twitch: TwitchService = inject(TwitchService);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly dialog: MatDialog = inject(MatDialog);

  private readonly rows: WritableSignal<CommunityEntry[]> = signal<CommunityEntry[]>([]);
  private readonly isLoading: WritableSignal<boolean> = signal(false);
  private readonly failed: WritableSignal<boolean> = signal(false);

  protected readonly loading: Signal<boolean> = this.isLoading.asReadonly();
  protected readonly unreachable: Signal<boolean> = this.failed.asReadonly();

  protected readonly count: Signal<number> = computed((): number => this.rows().length);

  protected readonly columns: string[] = ['user', 'followedAt'];

  protected readonly pageSizes: number[] = [10, 25, 50, 100];

  protected readonly dataSource: MatTableDataSource<CommunityEntry> = new MatTableDataSource<CommunityEntry>([]);

  protected readonly query: WritableSignal<string> = signal('');

  private readonly sorter: Signal<MatSort | undefined> = viewChild(MatSort);

  private readonly pager: Signal<MatPaginator | undefined> = viewChild(MatPaginator);

  constructor() {
    this.dataSource.filterPredicate = (entry, filter): boolean => {
      return entry.user.displayName.toLowerCase().includes(filter)
        || entry.user.login.toLowerCase().includes(filter)
        || entry.user.id.includes(filter);
    };

    this.dataSource.sortingDataAccessor = (entry, column): string | number => {
      return column === 'followedAt'
        ? entry.followedAt.getTime()
        : entry.user.displayName.toLowerCase();
    };

    effect((): CommunityEntry[] => this.dataSource.data = this.rows());
    effect((): void => {
      const sorter: MatSort | undefined = this.sorter();
      if (sorter) this.dataSource.sort = sorter;
    });

    effect((): void => {
      const pager: MatPaginator | undefined = this.pager();
      if (pager) this.dataSource.paginator = pager;
    });

    void this.load();
  }

  protected filter(value: string): void {
    this.query.set(value.trim());
    this.dataSource.filter = value.trim().toLowerCase();

    // Back to the front: staying on page 7 of a list that just shrank to two rows would show an
    // empty table rather than the matches.
    this.dataSource.paginator?.firstPage();
  }

  protected showDetails(entry: CommunityEntry, event?: Event): void {
    event?.stopPropagation();
    UserInfoDialogComponent.open(this.dialog, entry.user);
  }

  protected reload(): Promise<void> {
    return this.load();
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    this.failed.set(false);
    try {
      const followers: FollowerProfile[] = await this.twitch.getFollowers();

      this.rows.set(followers.map((user: FollowerProfile): CommunityEntry => ({
        user,
        followedAt: new Date(user.followedAt),
      })));
    } catch {
      this.rows.set([]);
      this.failed.set(true);
      this.notifications.failure('Could not load your community.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
