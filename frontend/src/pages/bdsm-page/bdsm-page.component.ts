import { Component, computed, inject, signal, Signal, WritableSignal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { BdsmService } from '../../services/bdsm.service';
import { NotificationService } from '../../services/notification.service';
import { BdsmResult, BdsmTraitScore, dominantTrait, resultTakenAt } from '../../data/bdsm-result';

/** One panel: the result, plus the little of it the collapsed header shows. */
export interface BdsmResultEntry {
  result: BdsmResult;
  takenAt: Date;
  dominant: BdsmTraitScore | null;
}

@Component({
  selector: 'app-bdsm-page',
  templateUrl: './bdsm-page.component.html',
  styleUrl: './bdsm-page.component.scss',
  standalone: false,
})
export class BdsmPageComponent {

  private readonly bdsm: BdsmService = inject(BdsmService);
  private readonly auth: AuthService = inject(AuthService);
  private readonly notifications: NotificationService = inject(NotificationService);

  private readonly rows: WritableSignal<BdsmResultEntry[]> = signal<BdsmResultEntry[]>([]);
  private readonly isLoading: WritableSignal<boolean> = signal(false);
  private readonly failed: WritableSignal<boolean> = signal(false);

  protected readonly entries: Signal<BdsmResultEntry[]> = this.rows.asReadonly();
  protected readonly loading: Signal<boolean> = this.isLoading.asReadonly();
  protected readonly unreachable: Signal<boolean> = this.failed.asReadonly();

  protected readonly count: Signal<number> = computed((): number => this.rows().length);

  constructor() {
    void this.load();
  }

  protected reload(): Promise<void> {
    return this.load();
  }

  private async load(): Promise<void> {
    const userId: string | undefined = this.auth.currentUser()?.id;
    if (!userId) return;

    this.isLoading.set(true);
    this.failed.set(false);
    try {
      const results: BdsmResult[] = await this.bdsm.getResults(userId);

      this.rows.set(results
        .map((result: BdsmResult): BdsmResultEntry => ({
          result,
          takenAt: resultTakenAt(result),
          dominant: dominantTrait(result),
        }))
        // The endpoint already answers newest first. Sorted again here because "the newest one is at
        // the top, open" is this page's own promise, and it should not rest on the order a response
        // happened to arrive in.
        .sort((left, right) => right.takenAt.getTime() - left.takenAt.getTime()));
    } catch {
      this.rows.set([]);
      this.failed.set(true);
      this.notifications.failure('Could not load your BDSM test results.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
