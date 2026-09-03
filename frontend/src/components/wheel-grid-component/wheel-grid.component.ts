import { Component, computed, input, InputSignal, output, OutputEmitterRef, Signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LocaleDatePipe } from '../../pipes/locale-date.pipe';
import { WheelSummary } from '../../data/wheel';

@Component({
  selector: 'app-wheel-grid',
  templateUrl: './wheel-grid.component.html',
  styleUrl: './wheel-grid.component.scss',
  imports: [MatIconModule, LocaleDatePipe],
})
export class WheelGridComponent {

  readonly wheels: InputSignal<readonly WheelSummary[]> = input.required<readonly WheelSummary[]>();

  readonly loading: InputSignal<boolean> = input<boolean>(false);
  readonly expected: InputSignal<number | null> = input<number | null>(null);

  readonly opened: OutputEmitterRef<string> = output<string>();
  readonly created: OutputEmitterRef<void> = output<void>();

  protected readonly ghosts: Signal<readonly number[]> = computed((): readonly number[] => {
    const known: number | null = this.expected();
    const cards: number = known === null ? 3 : Math.max(0, known);
    return Array.from({ length: cards }, (_: unknown, index: number): number => index);
  });

  protected entries(summary: WheelSummary): string {
    return summary.entryCount === 1 ? '1 entry' : `${summary.entryCount} entries`;
  }

  protected slices(summary: WheelSummary): string {
    return summary.sliceCount === 1 ? '1 slice' : `${summary.sliceCount} slices`;
  }
}