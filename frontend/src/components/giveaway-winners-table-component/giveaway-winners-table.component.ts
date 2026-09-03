import { DecimalPipe } from '@angular/common';
import { Component, computed, input, InputSignal, Signal, viewChild } from '@angular/core';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { TableFrameComponent } from '../table-frame-component/table-frame.component';
import { UserIdentityComponent } from '../user-identity-component/user-identity.component';
import { LocaleDatePipe } from '../../pipes/locale-date.pipe';
import { wireDataSource } from '../../services/data-source';
import { GiveawayWinner, winnerLabel } from '../../data/giveaway';

const COLUMNS: readonly string[] = ['order', 'user', 'multiplier', 'won'];

@Component({
  selector: 'app-giveaway-winners-table',
  templateUrl: './giveaway-winners-table.component.html',
  styleUrl: './giveaway-winners-table.component.scss',
  imports: [DecimalPipe, MatSortModule, MatTableModule, TableFrameComponent, UserIdentityComponent, LocaleDatePipe],
})
export class GiveawayWinnersTableComponent {

  readonly winners: InputSignal<GiveawayWinner[]> = input.required<GiveawayWinner[]>();

  protected readonly columns: readonly string[] = COLUMNS;

  protected readonly dataSource: MatTableDataSource<GiveawayWinner> = new MatTableDataSource<GiveawayWinner>([]);

  private readonly sorter: Signal<MatSort | undefined> = viewChild(MatSort);

  private readonly noPager: Signal<undefined> = computed((): undefined => undefined);

  constructor() {
    wireDataSource(this.dataSource, this.winners, this.sorter, this.noPager);

    this.dataSource.sortingDataAccessor = (row: GiveawayWinner, column: string): string | number => {
      if (column === 'order') return row.drawOrder;
      if (column === 'multiplier') return row.multiplier;
      if (column === 'won') return row.wonAt;
      return winnerLabel(row).toLowerCase();
    };
  }

  protected name(winner: GiveawayWinner): string {
    return winnerLabel(winner);
  }
}