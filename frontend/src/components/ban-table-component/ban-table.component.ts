import { Component, computed, inject, input, InputSignal, output, OutputEmitterRef, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { DatePipe, NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule, SortDirection } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { ScrollBarComponent } from '../scroll-bar-component/scroll-bar.component';
import { UserBadgesComponent } from '../user-badges-component/user-badges.component';
import { UserInfoDialogComponent } from '../user-info-dialog-component/user-info-dialog.component';
import { wireDataSource } from '../../services/data-source';
import { BannedUser } from '../../data/banned-user';

export type BanTableMode = 'timeout' | 'ban';

const COLUMNS: readonly string[] = ['user', 'when', 'reason', 'revoke'];

const MAX_GHOST_ROWS: number = 25;

@Component({
  selector: 'app-ban-table',
  templateUrl: './ban-table.component.html',
  styleUrl: './ban-table.component.scss',
  imports: [DatePipe, NgOptimizedImage, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule, MatSortModule, MatTableModule, ScrollBarComponent, UserBadgesComponent],
})
export class BanTableComponent {

  private readonly dialog: MatDialog = inject(MatDialog);

  readonly bans: InputSignal<BannedUser[]> = input.required<BannedUser[]>();

  readonly mode: InputSignal<BanTableMode> = input.required<BanTableMode>();

  readonly loading: InputSignal<boolean> = input<boolean>(false);
  readonly expected: InputSignal<number | null> = input<number | null>(null);

  readonly revoke: OutputEmitterRef<BannedUser> = output<BannedUser>();

  protected readonly dataSource: MatTableDataSource<BannedUser> = new MatTableDataSource<BannedUser>([]);

  protected readonly query: WritableSignal<string> = signal('');

  protected readonly columns: readonly string[] = COLUMNS;

  protected readonly ghostRows: Signal<readonly number[]> = computed((): readonly number[] => {
    const expected: number | null = this.expected();
    if (expected === null || expected <= 0) return [];

    return Array.from({ length: Math.min(expected, MAX_GHOST_ROWS) }, (_: unknown, index: number): number => index);
  });

  protected readonly whenLabel: Signal<string> = computed((): string => this.mode() === 'timeout' ? 'Expires' : 'Banned');

  protected readonly defaultDirection: Signal<SortDirection> = computed((): SortDirection => this.mode() === 'timeout' ? 'asc' : 'desc');

  protected readonly loaded: Signal<boolean> = computed((): boolean => !this.loading());

  protected readonly pageSizes: number[] = [10, 25, 50, 100];

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
    this.dataSource.filter = value.trim().toLowerCase();
    this.dataSource.paginator?.firstPage();
  }

  protected showDetails(ban: BannedUser, event?: Event): void {
    event?.stopPropagation();
    UserInfoDialogComponent.open(this.dialog, ban);
  }

  protected revokeBan(event: Event, ban: BannedUser): void {
    event.stopPropagation();
    this.revoke.emit(ban);
  }
}