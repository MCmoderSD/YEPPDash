import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, input, InputSignal, output, OutputEmitterRef, Signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StatusBadgeComponent } from '../status-badge-component/status-badge.component';
import { TableFrameComponent } from '../table-frame-component/table-frame.component';
import { UserIdentityComponent } from '../user-identity-component/user-identity.component';
import { LocaleDatePipe } from '../../pipes/locale-date.pipe';
import { wireDataSource } from '../../services/data-source';
import { GiveawayParticipant, GiveawayStatus, participantLabel, tierLabel } from '../../data/giveaway';

const COLUMNS: readonly string[] = ['user', 'roles', 'multiplier', 'entered', 'actions'];

@Component({
  selector: 'app-giveaway-entries-table',
  templateUrl: './giveaway-entries-table.component.html',
  styleUrl: './giveaway-entries-table.component.scss',
  imports: [
    DecimalPipe, PercentPipe, MatButtonModule, MatIconModule, MatSortModule, MatTableModule, MatTooltipModule,
    StatusBadgeComponent, TableFrameComponent, UserIdentityComponent, LocaleDatePipe,
  ],
})
export class GiveawayEntriesTableComponent {

  readonly participants: InputSignal<GiveawayParticipant[]> = input.required<GiveawayParticipant[]>();

  readonly status: InputSignal<GiveawayStatus | null> = input<GiveawayStatus | null>(null);

  readonly busy: InputSignal<boolean> = input<boolean>(false);

  readonly removed: OutputEmitterRef<GiveawayParticipant> = output<GiveawayParticipant>();

  protected readonly columns: readonly string[] = COLUMNS;

  protected readonly dataSource: MatTableDataSource<GiveawayParticipant> = new MatTableDataSource<GiveawayParticipant>([]);

  private readonly sorter: Signal<MatSort | undefined> = viewChild(MatSort);

  private readonly noPager: Signal<undefined> = computed((): undefined => undefined);

  private readonly chance: Signal<Map<string, number>> = computed((): Map<string, number> => {
    const rows: GiveawayParticipant[] = this.participants();
    const total: number = rows.reduce((sum: number, row: GiveawayParticipant): number => sum + row.multiplier, 0);

    return new Map<string, number>(rows.map((row: GiveawayParticipant): [string, number] =>
      [row.userId, total > 0 ? row.multiplier / total : 0]));
  });

  constructor() {
    wireDataSource(this.dataSource, this.participants, this.sorter, this.noPager);

    this.dataSource.sortingDataAccessor = (row: GiveawayParticipant, column: string): string | number => {
      if (column === 'multiplier') return row.multiplier;
      if (column === 'entered') return row.enteredAt;
      return participantLabel(row).toLowerCase();
    };
  }

  protected label(participant: GiveawayParticipant): string {
    return participantLabel(participant);
  }

  protected tier(participant: GiveawayParticipant): string | null {
    return tierLabel(participant.subTier);
  }

  protected odds(participant: GiveawayParticipant): number {
    return this.chance().get(participant.userId) ?? 0;
  }
}