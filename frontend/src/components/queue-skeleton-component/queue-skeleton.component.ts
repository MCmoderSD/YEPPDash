import { Component, computed, input, InputSignal, Signal } from '@angular/core';

@Component({
  selector: 'app-queue-skeleton',
  templateUrl: './queue-skeleton.component.html',
  styleUrl: './queue-skeleton.component.scss',
})
export class QueueSkeletonComponent {

  readonly rows: InputSignal<number> = input<number>(0);

  protected readonly lines: Signal<number[]> = computed((): number[] => Array.from({ length: Math.max(0, Math.trunc(this.rows())) }, (_: unknown, index: number): number => index));
}