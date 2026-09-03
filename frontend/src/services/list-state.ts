import { computed, signal, Signal, WritableSignal } from '@angular/core';
import { ghostRows } from '../data/skeleton';

export class ListState<T> {

  readonly rows: WritableSignal<T[]> = signal<T[]>([]);
  readonly loading: WritableSignal<boolean> = signal(false);
  readonly failed: WritableSignal<boolean> = signal(false);
  readonly expected: WritableSignal<number | null> = signal<number | null>(null);

  readonly count: Signal<number> = computed((): number => this.rows().length);
  readonly skeleton: Signal<boolean> = computed((): boolean => this.loading() && this.count() === 0);
  readonly refreshing: Signal<boolean> = computed((): boolean => this.loading() && this.count() > 0);

  readonly ghostRows: Signal<readonly number[]> = computed((): readonly number[] => ghostRows(this.expected()));

  async load(count: () => Promise<number>, list: () => Promise<T[]>, onFailure: () => void): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    this.expected.set(null);

    if (this.count() === 0) {
      void count()
        .then((expected: number): void => {
          if (this.loading()) this.expected.set(expected);
        })
        .catch((): void => void 0);
    }

    try {
      this.rows.set(await list());
    } catch {
      this.rows.set([]);
      this.failed.set(true);
      onFailure();
    } finally {
      this.loading.set(false);
    }
  }
}