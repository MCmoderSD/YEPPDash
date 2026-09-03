import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { NgOptimizedImage } from '@angular/common';
import { Component, computed, DestroyRef, effect, EffectCleanupRegisterFn, inject, signal, Signal, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { ConfirmActionDialogComponent } from '../../components/confirm-action-dialog-component/confirm-action-dialog.component';
import { QueueSkeletonComponent } from '../../components/queue-skeleton-component/queue-skeleton.component';
import { UserIdentityComponent } from '../../components/user-identity-component/user-identity.component';
import { UserInfoDialogComponent } from '../../components/user-info-dialog-component/user-info-dialog.component';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { QueueService } from '../../services/queue.service';
import { QueueSyncService } from '../../services/queue-sync.service';
import { StreamListener } from '../../services/sse.service';
import { TwitchService } from '../../services/twitch.service';
import { EMPTY_QUEUE, Queue, QUEUE_REQUIREMENT_HINTS, QUEUE_REQUIREMENT_LABELS, QUEUE_REQUIREMENTS, QueueRequirement } from '../../data/queue';
import { TwitchUser } from '../../data/twitch-user';

export interface QueueRow {
  position: number;
  userId: string;
  user: TwitchUser | null;
  pending: boolean;
}

@Component({
  selector: 'app-queue-page',
  templateUrl: './queue-page.component.html',
  styleUrl: './queue-page.component.scss',
  imports: [CdkDrag, CdkDragHandle, CdkDropList, MatButtonModule, MatFormFieldModule, MatIconModule, MatSelectModule, NgOptimizedImage, QueueSkeletonComponent, UserIdentityComponent],
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

  private listener: StreamListener | null = null;

  private writing: Promise<void> = Promise.resolve();

  private readonly attempted: Set<string> = new Set<string>();

  protected readonly queue: WritableSignal<Queue> = signal<Queue>(EMPTY_QUEUE);
  protected readonly busy: WritableSignal<boolean> = signal(false);
  protected readonly loaded: WritableSignal<boolean> = signal(false);
  protected readonly missing: WritableSignal<boolean> = signal(false);

  private readonly profiles: WritableSignal<ReadonlyMap<string, TwitchUser | null>> = signal<ReadonlyMap<string, TwitchUser | null>>(new Map<string, TwitchUser | null>());

  protected readonly rows: Signal<QueueRow[]> = computed((): QueueRow[] => {
    const profiles: ReadonlyMap<string, TwitchUser | null> = this.profiles();

    return this.queue().entries.map((userId: string, index: number): QueueRow => ({
      position: index + 1,
      userId,
      user: profiles.get(userId) ?? null,
      pending: !profiles.has(userId),
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

      let connected = false;

      const listener: StreamListener = this.sync.listen(
        channelId, (queue: Queue): void => void this.show(queue),
        (): void => {
          if (connected) void this.load(channelId);
          connected = true;
        }
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
      await this.show(await this.queues.getQueue(channelId));
    } catch {
      this.notifications.failure('Could not load your queue.');
    } finally {
      this.loaded.set(true);
    }
  }

  private async show(queue: Queue): Promise<void> {
    this.queue.set(queue);
    await this.resolve(queue.entries);
  }

  private async resolve(userIds: readonly string[]): Promise<void> {
    const missing: string[] = userIds.filter((userId: string): boolean => !this.attempted.has(userId));
    if (missing.length === 0) return;

    missing.forEach((userId: string): void => void this.attempted.add(userId));

    try {
      const users: TwitchUser[] = await this.twitch.getUsers(missing);

      this.profiles.update((profiles: ReadonlyMap<string, TwitchUser | null>): ReadonlyMap<string, TwitchUser | null> => {
        const next: Map<string, TwitchUser | null> = new Map<string, TwitchUser | null>(profiles);

        missing.forEach((userId: string): void => void next.set(userId, null));
        users.forEach((user: TwitchUser): void => void next.set(user.id, user));
        return next;
      });
    } catch {
      missing.forEach((userId: string): void => void this.attempted.delete(userId));
    }
  }

  private run(command: Promise<Queue>, success?: string): Promise<void> {
    this.busy.set(true);

    this.writing = this.writing
      .then((): Promise<Queue> => command)
      .then((queue: Queue): void => {
        this.missing.set(false);
        void this.show(queue);
        if (success) this.notifications.success(success);
      })
      .catch((error: unknown): void => {
        this.missing.set((error as { status?: number } | null)?.status === 400);
        this.notifications.failure('The queue would not take that.');

        const channelId: string | null = this.channelId();
        if (channelId !== null) void this.load(channelId);
      })
      .finally((): void => this.busy.set(false));

    return this.writing;
  }
}