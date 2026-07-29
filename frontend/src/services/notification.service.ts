import { Service, signal, Signal, WritableSignal } from '@angular/core';
import { Notification, NotificationKind } from '../data/notification';

// Failures stay up longer than confirmations: they usually need reading twice, and often name a
// thing that went wrong rather than one that went right.
const LIFETIME_MS: Record<NotificationKind, number> = {
  success: 4000,
  failure: 8000,
};

// Enough to see a short burst stack up, few enough that hammering a button cannot bury the page.
// Past this the oldest fall off the top.
const MAX_VISIBLE = 5;

// Replaces MatSnackBar, which shows exactly one message at a time and dismisses the previous one
// whenever a new arrives — so a burst of actions silently ate its own feedback.
@Service()
export class NotificationService {

  private readonly entries: WritableSignal<Notification[]> = signal<Notification[]>([]);

  private readonly timers: Map<number, ReturnType<typeof setTimeout>> = new Map<number, ReturnType<typeof setTimeout>>();

  private nextId = 0;

  readonly notifications: Signal<Notification[]> = this.entries.asReadonly();

  success(message: string): void {
    this.push('success', message);
  }

  failure(message: string): void {
    this.push('failure', message);
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this.entries.update((list: Notification[]): Notification[] => list.filter((entry: Notification): boolean => entry.id !== id));
  }

  private push(kind: NotificationKind, message: string): void {
    const id: number = this.nextId++;
    const next: Notification[] = [...this.entries(), { id, kind, message }];

    // Newest goes last so the stack grows upwards from its anchor: the new message appears at the
    // bottom and pushes the older ones up rather than covering them.
    for (const dropped of next.slice(0, Math.max(0, next.length - MAX_VISIBLE))) {
      this.clearTimer(dropped.id);
    }

    this.entries.set(next.slice(-MAX_VISIBLE));
    this.timers.set(id, setTimeout((): void => this.dismiss(id), LIFETIME_MS[kind]));
  }

  private clearTimer(id: number): void {
    const timer: ReturnType<typeof setTimeout> | undefined = this.timers.get(id);
    if (timer === undefined) return;

    clearTimeout(timer);
    this.timers.delete(id);
  }
}
