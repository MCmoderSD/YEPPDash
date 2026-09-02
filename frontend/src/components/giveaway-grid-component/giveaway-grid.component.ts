import { Component, computed, input, InputSignal, output, OutputEmitterRef, Signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LocaleDatePipe } from '../../pipes/locale-date.pipe';
import { GiveawayStatus, GiveawaySummary, rewardImage, STATUS_LABELS } from '../../data/giveaway';
import { RewardTileComponent } from '../reward-tile-component/reward-tile.component';
import { StatusBadgeComponent } from '../status-badge-component/status-badge.component';

const DEFAULT_COLOR: string = '#9147FF';

const STAGGER_MS: number = 40;
const STAGGER_CAP: number = 6;

@Component({
  selector: 'app-giveaway-grid',
  templateUrl: './giveaway-grid.component.html',
  styleUrl: './giveaway-grid.component.scss',
  imports: [MatIconModule, LocaleDatePipe, RewardTileComponent, StatusBadgeComponent],
})
export class GiveawayGridComponent {

  readonly giveaways: InputSignal<readonly GiveawaySummary[]> = input.required<readonly GiveawaySummary[]>();

  readonly loading: InputSignal<boolean> = input<boolean>(false);

  readonly expected: InputSignal<number | null> = input<number | null>(null);

  readonly opened: OutputEmitterRef<string> = output<string>();

  readonly created: OutputEmitterRef<void> = output<void>();

  protected readonly ghosts: Signal<readonly number[]> = computed((): readonly number[] => {
    const known: number | null = this.expected();
    const cards: number = known === null ? 3 : Math.max(0, known);

    return Array.from({ length: cards }, (_: unknown, index: number): number => index);
  });

  protected readonly statusLabels: Readonly<Record<GiveawayStatus, string>> = STATUS_LABELS;

  protected delay(index: number): string {
    return `${Math.min(index, STAGGER_CAP) * STAGGER_MS}ms`;
  }

  protected image(summary: GiveawaySummary): string {
    return rewardImage(summary.reward);
  }

  protected colour(summary: GiveawaySummary): string {
    return summary.reward?.backgroundColor || DEFAULT_COLOR;
  }
}