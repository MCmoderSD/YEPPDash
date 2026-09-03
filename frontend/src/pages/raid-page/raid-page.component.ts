import { Component, computed, inject, Signal, signal, viewChild, WritableSignal } from '@angular/core';
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
import { RaidService } from '../../services/raid.service';
import { Raid } from '../../data/raid';
import { ListState } from '../../services/list-state';
import { TableSearchComponent } from '../../components/table-search-component/table-search.component';
import { UserDetailsDirective } from '../../directives/user-details.directive';

export interface RaidEntry {
  raid: Raid;
  firedAt: Date;
}

@Component({
  selector: 'app-raid-page',
  templateUrl: './raid-page.component.html',
  styleUrl: './raid-page.component.scss',
  imports: [UserDetailsDirective, TableSearchComponent, BusyBarComponent, MatButtonModule, MatIconModule, MatPaginatorModule, MatSortModule, MatTableModule, TableFrameComponent, UserIdentityComponent, LocaleDatePipe],
})
export class RaidPageComponent {

  private readonly raids: RaidService = inject(RaidService);
  private readonly notifications: NotificationService = inject(NotificationService);

  private readonly state: ListState<RaidEntry> = new ListState<RaidEntry>();

  private readonly rows: Signal<RaidEntry[]> = this.state.rows.asReadonly();

  protected readonly loading: Signal<boolean> = this.state.loading.asReadonly();
  protected readonly unreachable: Signal<boolean> = this.state.failed.asReadonly();
  protected readonly count: Signal<number> = this.state.count;
  protected readonly skeleton: Signal<boolean> = this.state.skeleton;
  protected readonly ghostRows: Signal<readonly number[]> = this.state.ghostRows;

  protected readonly viewers: Signal<number> = computed((): number =>
    this.rows().reduce((total: number, entry: RaidEntry): number => total + entry.raid.viewers, 0),
  );


  // Three widths cycled down the ghost rows, so the waiting list reads as names of different
  // lengths rather than as one bar repeated.
  protected readonly ghostNameWidths: readonly string[] = ['min(9rem, 60%)', 'min(6rem, 45%)', 'min(11rem, 70%)'];
  protected readonly columns: string[] = ['raider', 'viewers', 'firedAt'];

  protected readonly pageSizes: readonly number[] = TABLE_PAGE_SIZES;

  protected readonly dataSource: MatTableDataSource<RaidEntry> = new MatTableDataSource<RaidEntry>([]);

  protected readonly query: WritableSignal<string> = signal('');

  private readonly sorter: Signal<MatSort | undefined> = viewChild(MatSort);

  private readonly pager: Signal<MatPaginator | undefined> = viewChild(MatPaginator);

  constructor() {
    this.dataSource.filterPredicate = (entry: RaidEntry, filter: string): boolean => {
      return entry.raid.raider.displayName.toLowerCase().includes(filter)
        || entry.raid.raider.login.toLowerCase().includes(filter)
        || entry.raid.raider.id.includes(filter);
    };

    this.dataSource.sortingDataAccessor = (entry: RaidEntry, column: string): string | number => {
      switch (column) {
        case 'firedAt':
          return entry.firedAt.getTime();
        case 'viewers':
          return entry.raid.viewers;
        default:
          return entry.raid.raider.displayName.toLowerCase();
      }
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
      async (): Promise<RaidEntry[]> => (await this.raids.getRaids())
        .map((raid: Raid): RaidEntry => ({ raid, firedAt: new Date(raid.firedAt) })),
      (): void => this.notifications.failure('Could not load your raids.'),
      (): Promise<number> => this.raids.countRaids(),
    );
  }
}