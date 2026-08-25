import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { NgOptimizedImage } from '@angular/common';
import { Component, computed, DestroyRef, effect, EffectCleanupRegisterFn, inject, signal, Signal, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { ConfirmActionDialogComponent } from '../../components/confirm-action-dialog-component/confirm-action-dialog.component';
import { UserInfoDialogComponent } from '../../components/user-info-dialog-component/user-info-dialog.component';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { QueueService } from '../../services/queue.service';
import { QueueListener, QueueSyncService } from '../../services/queue-sync.service';
import { TwitchService } from '../../services/twitch.service';
import { EMPTY_QUEUE, Queue, QUEUE_REQUIREMENT_HINTS, QUEUE_REQUIREMENT_LABELS, QUEUE_REQUIREMENTS, QueueRequirement } from '../../data/queue';
import { TwitchUser } from '../../data/twitch-user';

export interface QueueRow {
  position: number;
  userId: string;
  user: TwitchUser | null;
}

@Component({
  selector: 'app-queue-page',
  templateUrl: './queue-page.component.html',
  styleUrl: './queue-page.component.scss',
  imports: [CdkDrag, CdkDragHandle, CdkDropList, MatButtonModule, MatFormFieldModule, MatIconModule, MatSelectModule, NgOptimizedImage],
})
export class QueuePageComponent {

  private readonly auth: AuthService = inject(AuthService);
  private readonly queues: QueueService = inject(QueueService);
  private readonly sync: QueueSyncService = inject(QueueSyncService);
  private readonly twitch: TwitchService = inject(TwitchService);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly dialog: MatDialog = inject(MatDialog);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  private readonly channelId: Signal<string | null> = computed((): string | null => this.auth.currentUser()?.id ?? null);

  private listener: QueueListener | null = null;

  private writing: Promise<void> = Promise.resolve();

  // IDs we have already asked Twitch about, whether or not it had anything to say. A deleted
  // account is never going to resolve, and without this it would be looked up again on every event.
  private readonly attempted: Set<string> = new Set<string>();

  protected readonly queue: WritableSignal<Queue> = signal<Queue>(EMPTY_QUEUE);
  protected readonly busy: WritableSignal<boolean> = signal(false);
  protected readonly missing: WritableSignal<boolean> = signal(false);

  private readonly profiles: WritableSignal<ReadonlyMap<string, TwitchUser>> =
    signal<ReadonlyMap<string, TwitchUser>>(new Map<string, TwitchUser>());

  protected readonly rows: Signal<QueueRow[]> = computed((): QueueRow[] => {
    const profiles: ReadonlyMap<string, TwitchUser> = this.profiles();

    return this.queue().entries.map((userId: string, index: number): QueueRow => ({
      position: index + 1,
      userId,
      user: profiles.get(userId) ?? null,
    }));
  });

  protected readonly current: Signal<QueueRow | null> = computed((): QueueRow | null => this.rows()[0] ?? null);

  protected readonly requirementHint: Signal<string> =
    computed((): string => QUEUE_REQUIREMENT_HINTS[this.queue().requirement]);

  protected readonly requirements: readonly QueueRequirement[] = QUEUE_REQUIREMENTS;
  protected readonly labels: Readonly<Record<QueueRequirement, string>> = QUEUE_REQUIREMENT_LABELS;

  constructor() {
    effect((onCleanup: EffectCleanupRegisterFn): void => {
      const channelId: string | null = this.channelId();
      if (channelId === null) return;

      const listener: QueueListener = this.sync.listen(
        channelId, (queue: Queue): void => this.show(queue),
        (): void => void this.load(channelId)
      );

      this.listener = listener;

      void this.load(channelId);

      onCleanup((): void => {
        this.listener = null;
        listener.close();
      });
    });

    this.destroyRef.onDestroy((): void => this.listener?.close());
  }

  protected toggle(): void {
    const channelId: string | null = this.channelId();
    if (channelId === null) return;

    void this.run(this.queue().isOpen
      ? this.queues.close(channelId)
      : this.queues.open(channelId));
  }

  protected next(): void {
    const channelId: string | null = this.channelId();
    if (channelId === null) return;

    void this.run(this.queues.next(channelId));
  }

  protected drop(event: CdkDragDrop<QueueRow[]>): void {
    this.moveTo(event.item.data as QueueRow, event.currentIndex);
  }

  // The keyboard's way in. Dragging is a mouse gesture and the CDK gives it no keyboard equivalent,
  // so the handle is a button that also answers to the arrows, Home and End.
  protected nudge(event: KeyboardEvent, row: QueueRow): void {
    const last: number = this.rows().length - 1;

    const target: number | null =
      event.key === 'ArrowUp' ? row.position - 2 :
      event.key === 'ArrowDown' ? row.position :
      event.key === 'Home' ? 0 :
      event.key === 'End' ? last : null;

    if (target === null) return;

    event.preventDefault();
    this.moveTo(row, Math.max(0, Math.min(target, last)));
  }

  private moveTo(row: QueueRow, index: number): void {
    const channelId: string | null = this.channelId();
    if (channelId === null || index === row.position - 1) return;

    // Shown in the new order straight away rather than after the round trip, so the row does not
    // spring back under the cursor. Whatever the server answers replaces this a moment later.
    this.queue.update((queue: Queue): Queue => {
      const entries: string[] = [...queue.entries];
      moveItemInArray(entries, row.position - 1, index);
      return { ...queue, entries };
    });

    void this.run(this.queues.move(channelId, row.userId, index + 1));
  }

  protected remove(row: QueueRow): void {
    const channelId: string | null = this.channelId();
    if (channelId === null) return;

    void this.run(this.queues.remove(channelId, row.userId));
  }

  protected async clear(): Promise<void> {
    const channelId: string | null = this.channelId();
    if (channelId === null) return;

    const waiting: number = this.rows().length;

    const confirmed: boolean = await ConfirmActionDialogComponent.confirm(this.dialog, {
      title: 'Clear the queue?',
      message: `Everyone in it loses their place — ${waiting} in total — and has to join again.`,
      confirmLabel: 'Clear',
    });

    if (!confirmed) return;

    void this.run(this.queues.clear(channelId), 'Queue cleared.');
  }

  protected changeRequirement(requirement: QueueRequirement): void {
    const channelId: string | null = this.channelId();
    if (channelId === null || requirement === this.queue().requirement) return;

    void this.run(this.queues.saveRequirement(channelId, requirement), 'Requirement saved.');
  }

  // Clicking anywhere on the row opens the details. The guard is what keeps the buttons inside it
  // working: their own click has already run and bubbled up to here, and without this the dialog
  // would open a second time on top of itself — or open at all when somebody meant to remove a row.
  protected open(event: MouseEvent, row: QueueRow): void {
    if ((event.target as HTMLElement).closest('button') !== null) return;

    this.details(row);
  }

  protected details(row: QueueRow): void {
    if (row.user !== null) UserInfoDialogComponent.open(this.dialog, row.user);
  }

  protected name(row: QueueRow): string {
    return row.user?.displayName ?? row.userId;
  }

  private async load(channelId: string): Promise<void> {
    try {
      this.show(await this.queues.getQueue(channelId));
    } catch {
      this.notifications.failure('Could not load your queue.');
    }
  }

  private show(queue: Queue): void {
    this.queue.set(queue);
    void this.resolve(queue.entries);
  }

  // Only ever the names we do not have yet. Re-resolving the whole list on every event would turn
  // one person joining in chat into a Helix call for everybody already waiting.
  private async resolve(userIds: readonly string[]): Promise<void> {
    const missing: string[] = userIds.filter((userId: string): boolean => !this.attempted.has(userId));
    if (missing.length === 0) return;

    missing.forEach((userId: string): void => void this.attempted.add(userId));

    try {
      const users: TwitchUser[] = await this.twitch.getUsers(missing);

      this.profiles.update((profiles: ReadonlyMap<string, TwitchUser>): ReadonlyMap<string, TwitchUser> => {
        const next: Map<string, TwitchUser> = new Map<string, TwitchUser>(profiles);
        users.forEach((user: TwitchUser): void => void next.set(user.id, user));
        return next;
      });
    } catch {
      // Let a later change try again rather than leaving these as bare IDs for the session. Events
      // only arrive when the queue actually changes, so this cannot turn into a retry storm.
      missing.forEach((userId: string): void => void this.attempted.delete(userId));
    }
  }

  private run(command: Promise<Queue>, success?: string): Promise<void> {
    this.busy.set(true);

    this.writing = this.writing
      .then((): Promise<Queue> => command)
      .then((queue: Queue): void => {
        this.missing.set(false);
        this.show(queue);
        if (success) this.notifications.success(success);
      })
      .catch((error: unknown): void => {
        // A 400 from this controller only ever means the one thing: there is no row to change,
        // because YEPPBot has never been in the channel. Anything else is a request that did not
        // arrive, which is not something to explain with a wrong reason.
        this.missing.set((error as { status?: number } | null)?.status === 400);
        this.notifications.failure('The queue would not take that.');

        // Dragging shows the new order before the server has agreed to it. Without this the page
        // would keep showing an order that only ever existed in this browser.
        const channelId: string | null = this.channelId();
        if (channelId !== null) void this.load(channelId);
      })
      .finally((): void => this.busy.set(false));

    return this.writing;
  }
}
