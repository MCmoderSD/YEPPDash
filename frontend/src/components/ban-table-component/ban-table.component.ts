import { Component, computed, inject, input, InputSignal, output, OutputEmitterRef, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule, SortDirection } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { TableFrameComponent } from '../table-frame-component/table-frame.component';
import { UserIdentityComponent } from '../user-identity-component/user-identity.component';
import { TABLE_PAGE_SIZES, filterRows, wireDataSource } from '../../services/data-source';
import { BannedUser } from '../../data/banned-user';
import { ghostRows } from '../../data/skeleton';
import { TableSearchComponent } from '../table-search-component/table-search.component';
import { UserDetailsDirective } from '../../directives/user-details.directive';

export type BanTableMode = 'timeout' | 'ban';

const COLUMNS: readonly string[] = ['user', 'when', 'reason', 'revoke'];

@Component({
  selector: 'app-ban-table',
  templateUrl: './ban-table.component.html',
  styleUrl: './ban-table.component.scss',
  imports: [UserDetailsDirective, TableSearchComponent, DatePipe, MatButtonModule, MatIconModule, MatPaginatorModule, MatSortModule, MatTableModule, TableFrameComponent, UserIdentityComponent],
})
export class BanTableComponent {


  readonly bans: InputSignal<BannedUser[]> = input.required<BannedUser[]>();

  readonly mode: InputSignal<BanTableMode> = input.required<BanTableMode>();

  readonly loading: InputSignal<boolean> = input<boolean>(false);
  readonly expected: InputSignal<number | null> = input<number | null>(null);

  readonly revoke: OutputEmitterRef<BannedUser> = output<BannedUser>();

  protected readonly dataSource: MatTableDataSource<BannedUser> = new MatTableDataSource<BannedUser>([]);

  protected readonly query: WritableSignal<string> = signal('');

  protected readonly columns: readonly string[] = COLUMNS;

  protected readonly ghostRows: Signal<readonly number[]> = computed((): readonly number[] => ghostRows(this.expected()));

  protected readonly whenLabel: Signal<string> = computed((): string => this.mode() === 'timeout' ? 'Expires' : 'Banned');

  protected readonly defaultDirection: Signal<SortDirection> = computed((): SortDirection => this.mode() === 'timeout' ? 'asc' : 'desc');

  protected readonly loaded: Signal<boolean> = computed((): boolean => !this.loading());

  protected readonly pageSizes: readonly number[] = TABLE_PAGE_SIZES;

  private readonly sorter: Signal<MatSort | undefined> = viewChild(MatSort);
  private readonly pager: Signal<MatPaginator | undefined> = viewChild(MatPaginator);

  constructor() {
    this.dataSource.filterPredicate = (ban, filter): boolean => {
      return ban.displayName.toLowerCase().includes(filter)
        || ban.id.toLowerCase().includes(filter)
        || (ban.reason ?? '').toLowerCase().includes(filter);
    }

    this.dataSource.sortingDataAccessor = (ban, column) => {
      if (column === 'when') return Date.parse(this.whenOf(ban));
      if (column === 'reason') return (ban.reason ?? '').toLowerCase();
      return ban.displayName.toLowerCase();
    };

    wireDataSource(this.dataSource, this.bans, this.sorter, this.pager);
  }

  protected whenOf(ban: BannedUser): string {
    return ban.expiresAt ?? ban.bannedAt;
  }

  protected revokeLabel(ban: BannedUser): string {
    return this.mode() === 'timeout' ? `Lift the timeout on ${ban.displayName}` : `Unban ${ban.displayName}`;
  }

  protected filter(value: string): void {
    this.query.set(value.trim());
    filterRows(this.dataSource, value);
  }


  protected revokeBan(event: Event, ban: BannedUser): void {
    event.stopPropagation();
    this.revoke.emit(ban);
  }
}