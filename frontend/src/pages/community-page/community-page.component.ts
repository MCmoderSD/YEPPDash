import { Component, inject, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { BusyBarComponent } from '../../components/busy-bar-component/busy-bar.component';
import { TableFrameComponent } from '../../components/table-frame-component/table-frame.component';
import { UserIdentityComponent } from '../../components/user-identity-component/user-identity.component';
import { LocaleDatePipe } from '../../pipes/locale-date.pipe';
import { TABLE_PAGE_SIZES, filterRows, wireDataSource } from '../../services/data-source';
import { NotificationService } from '../../services/notification.service';
import { TwitchService } from '../../services/twitch.service';
import { FollowerProfile } from '../../data/follower';
import { ListState } from '../../services/list-state';
import { TableSearchComponent } from '../../components/table-search-component/table-search.component';
import { UserDetailsDirective } from '../../directives/user-details.directive';

export interface CommunityEntry {
  user: FollowerProfile;
  followedAt: Date;
}

@Component({
  selector: 'app-community-page',
  templateUrl: './community-page.component.html',
  styleUrl: './community-page.component.scss',
  imports: [UserDetailsDirective, TableSearchComponent, BusyBarComponent, DatePipe, MatButtonModule, MatIconModule, MatPaginatorModule, MatSortModule, MatTableModule, TableFrameComponent, UserIdentityComponent, LocaleDatePipe],
})
export class CommunityPageComponent {

  private readonly twitch: TwitchService = inject(TwitchService);
  private readonly notifications: NotificationService = inject(NotificationService);

  private readonly state: ListState<CommunityEntry> = new ListState<CommunityEntry>();

  private readonly rows: Signal<CommunityEntry[]> = this.state.rows.asReadonly();

  protected readonly loading: Signal<boolean> = this.state.loading.asReadonly();
  protected readonly unreachable: Signal<boolean> = this.state.failed.asReadonly();
  protected readonly count: Signal<number> = this.state.count;
  protected readonly skeleton: Signal<boolean> = this.state.skeleton;
  protected readonly refreshing: Signal<boolean> = this.state.refreshing;
  protected readonly ghostRows: Signal<readonly number[]> = this.state.ghostRows;

  protected readonly ghostNameWidths: readonly string[] = ['min(9rem, 50%)', 'min(6rem, 40%)', 'min(12rem, 60%)'];
  protected readonly columns: string[] = ['user', 'followedAt'];

  protected readonly pageSizes: readonly number[] = TABLE_PAGE_SIZES;

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
    filterRows(this.dataSource, value);
  }


  protected reload(): Promise<void> {
    return this.load();
  }

  private async load(): Promise<void> {
    await this.state.load(
      async (): Promise<CommunityEntry[]> => (await this.twitch.getFollowers())
        .map((user: FollowerProfile): CommunityEntry => ({ user, followedAt: new Date(user.followedAt) })),
      (): void => this.notifications.failure('Could not load your community.'),
      (): Promise<number> => this.twitch.countFollowers(),
    );
  }
}