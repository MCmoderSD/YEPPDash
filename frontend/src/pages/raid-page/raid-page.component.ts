import { Component, computed, effect, inject, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { ScrollBarComponent } from '../../components/scroll-bar-component/scroll-bar.component';
import { UserBadgesComponent } from '../../components/user-badges-component/user-badges.component';
import { UserInfoDialogComponent } from '../../components/user-info-dialog-component/user-info-dialog.component';
import { LocaleDatePipe } from '../../pipes/locale-date.pipe';
import { NotificationService } from '../../services/notification.service';
import { RaidService } from '../../services/raid.service';
import { Raid } from '../../data/raid';

export interface RaidEntry {
  raid: Raid;
  firedAt: Date;
}

@Component({
  selector: 'app-raid-page',
  templateUrl: './raid-page.component.html',
  styleUrl: './raid-page.component.scss',
  imports: [NgOptimizedImage, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule, MatProgressBarModule, MatSortModule, MatTableModule, ScrollBarComponent, UserBadgesComponent, LocaleDatePipe],
})
export class RaidPageComponent {

  private readonly raids: RaidService = inject(RaidService);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly dialog: MatDialog = inject(MatDialog);

  private readonly rows: WritableSignal<RaidEntry[]> = signal<RaidEntry[]>([]);
  private readonly isLoading: WritableSignal<boolean> = signal(false);
  private readonly failed: WritableSignal<boolean> = signal(false);

  protected readonly loading: Signal<boolean> = this.isLoading.asReadonly();
  protected readonly unreachable: Signal<boolean> = this.failed.asReadonly();

  protected readonly count: Signal<number> = computed((): number => this.rows().length);

  protected readonly viewers: Signal<number> = computed((): number =>
    this.rows().reduce((total: number, entry: RaidEntry): number => total + entry.raid.viewers, 0),
  );

  protected readonly skeleton: Signal<boolean> = computed((): boolean => this.loading() && this.count() === 0);

  protected readonly columns: string[] = ['raider', 'viewers', 'firedAt'];

  protected readonly expected: WritableSignal<number | null> = signal<number | null>(null);

  protected readonly ghostRows: Signal<readonly number[]> = computed((): readonly number[] => {
    const expected: number | null = this.expected();
    if (expected === null || expected <= 0) return [];
    return Array.from({ length: Math.min(expected, 25) }, (_: unknown, index: number): number => index);
  });

  protected readonly pageSizes: number[] = [10, 25, 50, 100];

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

    effect((): RaidEntry[] => this.dataSource.data = this.rows());
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
    this.dataSource.paginator?.firstPage();
  }

  protected showDetails(entry: RaidEntry, event?: Event): void {
    event?.stopPropagation();
    UserInfoDialogComponent.open(this.dialog, entry.raid.raider);
  }

  protected reload(): Promise<void> {
    return this.load();
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    this.failed.set(false);
    this.expected.set(null);

    if (this.rows().length === 0) {
      void this.raids.countRaids()
        .then((count: number): void => {
          if (this.isLoading()) this.expected.set(count);
        })
        .catch((): void => void 0);
    }

    try {
      const raids: Raid[] = await this.raids.getRaids();

      this.rows.set(raids.map((raid: Raid): RaidEntry => ({
        raid,
        firedAt: new Date(raid.firedAt),
      })));
    } catch {
      this.rows.set([]);
      this.failed.set(true);
      this.notifications.failure('Could not load your raids.');
    } finally {
      this.isLoading.set(false);
    }
  }
}