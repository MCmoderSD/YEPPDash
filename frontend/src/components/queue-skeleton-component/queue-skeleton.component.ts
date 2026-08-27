import { Component, computed, input, InputSignal, Signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-queue-skeleton',
  templateUrl: './queue-skeleton.component.html',
  styleUrl: './queue-skeleton.component.scss',
  imports: [MatIconModule],
})
export class QueueSkeletonComponent {

  readonly rows: InputSignal<number> = input<number>(0);

  protected readonly lines: Signal<number[]> = computed((): number[] =>
    Array.from({ length: Math.min(8, Math.max(0, Math.trunc(this.rows()))) }, (_: unknown, index: number): number => index));
}