import { Component, computed, inject, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { TableFrameComponent } from '../../components/table-frame-component/table-frame.component';
import { UserIdentityComponent } from '../../components/user-identity-component/user-identity.component';
import { UserInfoDialogComponent } from '../../components/user-info-dialog-component/user-info-dialog.component';
import { LocaleDatePipe } from '../../pipes/locale-date.pipe';
import { wireDataSource } from '../../services/data-source';
import { NotificationService } from '../../services/notification.service';
import { TwitchService } from '../../services/twitch.service';
import { FollowerProfile } from '../../data/follower';
import { ghostRows } from '../../data/skeleton';

export interface CommunityEntry {
  user: FollowerProfile;
  followedAt: Date;
}

@Component({
  selector: 'app-community-page',
  templateUrl: './community-page.component.html',
  styleUrl: './community-page.component.scss',
  imports: [DatePipe, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule, MatProgressBarModule, MatSortModule, MatTableModule, TableFrameComponent, UserIdentityComponent, LocaleDatePipe],
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
  protected readonly skeleton: Signal<boolean> = computed((): boolean => this.isLoading() && this.rows().length === 0);
  protected readonly refreshing: Signal<boolean> = computed((): boolean => this.isLoading() && this.rows().length > 0);

  protected readonly expected: WritableSignal<number | null> = signal<number | null>(null);

  protected readonly ghostRows: Signal<readonly number[]> = computed((): readonly number[] => ghostRows(this.expected()));

  protected readonly columns: string[] = ['user', 'followedAt'];

  protected readonly pageSizes: number[] = [10, 25, 50, 100];

  protected readonly dataSource: MatTableDataSource<CommunityEntry> = new MatTableDataSource<CommunityEntry>([]);

  protected readonly query: WritableSignal<string> = signal('');

  private readonly sorter: Signal<MatSort | undefined> = viewChild(MatSort);

  private readonly pager: Signal<MatPaginator | undefined> = viewChild(MatPaginator);

  constructor() {
    this.dataSource.filterPredicate = (entry: CommunityEntry, filter: string): boolean => {
      return entry.user.displayName.toLowerCase().includes(filter)
        || entry.user.login.toLowerCase().includes(filter)
        || entry.user.id.includes(filter);
    };

    this.dataSource.sortingDataAccessor = (entry: CommunityEntry, column: string): string | number => {
      return column === 'followedAt'
        ? entry.followedAt.getTime()
        : entry.user.displayName.toLowerCase();
    };

    wireDataSource(this.dataSource, this.rows, this.sorter, this.pager);

    void this.load();
  }

  protected filter(value: string): void {
    this.query.set(value.trim());
    this.dataSource.filter = value.trim().toLowerCase();
    this.dataSource.paginator?.firstPage();
  }

  protected showDetails(entry: CommunityEntry): void {
    UserInfoDialogComponent.open(this.dialog, entry.user);
  }

  protected reload(): Promise<void> {
    return this.load();
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    this.failed.set(false);
    this.expected.set(null);

    if (this.rows().length === 0) {
      void this.twitch.countFollowers()
        .then((count: number): void => {
          if (this.isLoading()) this.expected.set(count);
        })
        .catch((): void => void 0);
    }

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