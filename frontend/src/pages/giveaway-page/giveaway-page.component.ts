import { DecimalPipe, NgOptimizedImage, PercentPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, effect, EffectCleanupRegisterFn, inject, input, InputSignal, signal, Signal, untracked, viewChild, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { RewardSwitchesComponent } from '../../components/reward-switches-component/reward-switches.component';
import { EntryRulesComponent } from '../../components/entry-rules-component/entry-rules.component';
import { GiveawayGridComponent } from '../../components/giveaway-grid-component/giveaway-grid.component';
import { ConfirmActionDialogComponent } from '../../components/confirm-action-dialog-component/confirm-action-dialog.component';
import { NumberStepperComponent } from '../../components/number-stepper-component/number-stepper.component';
import { OverlayLinkComponent } from '../../components/overlay-link-component/overlay-link.component';
import { RegistrationControlsComponent } from '../../components/registration-controls-component/registration-controls.component';
import { RewardLimitsComponent } from '../../components/reward-limits-component/reward-limits.component';
import { RewardPreviewComponent } from '../../components/reward-preview-component/reward-preview.component';
import { StatusBadgeComponent } from '../../components/status-badge-component/status-badge.component';
import { ScrollBarComponent } from '../../components/scroll-bar-component/scroll-bar.component';
import { UserBadgesComponent } from '../../components/user-badges-component/user-badges.component';
import { UserInfoDialogComponent } from '../../components/user-info-dialog-component/user-info-dialog.component';
import { WheelComponent, WheelSpin } from '../../components/wheel-component/wheel.component';
import { WheelWinnerDialogComponent } from '../../components/wheel-winner-dialog-component/wheel-winner-dialog.component';
import { LocaleDatePipe } from '../../pipes/locale-date.pipe';
import { wireDataSource } from '../../services/data-source';
import { GiveawayService } from '../../services/giveaway.service';
import { GiveawayDashboardMessage, GiveawayListener, GiveawaySyncService } from '../../services/giveaway-sync.service';
import { NotificationService } from '../../services/notification.service';
import { GIVEAWAY_OVERLAY_PATH, GIVEAWAY_PARAM, overlayUrl } from '../../data/overlay';
import { TwitchUser } from '../../data/twitch-user';
import {
  DEFAULT_MULTIPLIERS,
  GiveawayDrawResult,
  GiveawayMultipliers,
  GiveawayOverlaySlice,
  GiveawayParticipant,
  GiveawayRequirements,
  GiveawaySettings,
  GiveawayStatus,
  GiveawaySummary,
  GiveawayUpdate,
  GiveawayWinner,
  IGNORED_REQUIREMENTS,
  multipliersInvalid,
  NEW_GIVEAWAY,
  participantLabel,
  rewardImage,
  STATUS_LABELS,
  tierLabel,
  winnerLabel,
} from '../../data/giveaway';

const MAX_TITLE_LENGTH: number = 45;
const MAX_DESCRIPTION_LENGTH: number = 200;

const DEFAULT_COST: number = 1_000;
const DEFAULT_COLOR: string = '#9147FF';

@Component({
  selector: 'app-giveaway-page',
  templateUrl: './giveaway-page.component.html',
  styleUrl: './giveaway-page.component.scss',
  imports: [
    DecimalPipe, PercentPipe, NgOptimizedImage, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressBarModule, MatSortModule, MatTableModule, MatTabsModule, MatTooltipModule,
    EntryRulesComponent, GiveawayGridComponent, NumberStepperComponent, OverlayLinkComponent, RegistrationControlsComponent,
    RewardLimitsComponent, RewardPreviewComponent, RewardSwitchesComponent,
    ScrollBarComponent, StatusBadgeComponent, UserBadgesComponent, WheelComponent, LocaleDatePipe,
  ],
})
export class GiveawayPageComponent {

  readonly giveaway: InputSignal<string | undefined> = input<string>();

  private readonly giveaways: GiveawayService = inject(GiveawayService);
  private readonly sync: GiveawaySyncService = inject(GiveawaySyncService);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly dialog: MatDialog = inject(MatDialog);
  private readonly router: Router = inject(Router);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  protected readonly statusLabels: Readonly<Record<GiveawayStatus, string>> = STATUS_LABELS;

  protected readonly maxTitleLength: number = MAX_TITLE_LENGTH;
  protected readonly maxDescriptionLength: number = MAX_DESCRIPTION_LENGTH;
  protected readonly participantColumns: readonly string[] = ['user', 'roles', 'multiplier', 'entered', 'actions'];
  protected readonly winnerColumns: readonly string[] = ['order', 'user', 'multiplier', 'won'];

  protected readonly summaries: WritableSignal<GiveawaySummary[]> = signal<GiveawaySummary[]>([]);
  protected readonly selected: WritableSignal<GiveawaySettings | null> = signal<GiveawaySettings | null>(null);

  private readonly loaded: WritableSignal<boolean> = signal(false);

  protected readonly expected: WritableSignal<number | null> = signal<number | null>(null);
  protected readonly skeleton: Signal<boolean> = computed((): boolean => !this.loaded());
  protected readonly busy: WritableSignal<boolean> = signal(false);

  protected readonly title: WritableSignal<string> = signal('');
  protected readonly cost: WritableSignal<number> = signal(DEFAULT_COST);
  protected readonly description: WritableSignal<string> = signal('');
  protected readonly color: WritableSignal<string> = signal(DEFAULT_COLOR);
  protected readonly cooldownSeconds: WritableSignal<number> = signal(0);
  protected readonly maxPerStream: WritableSignal<number> = signal(0);
  protected readonly maxPerUserPerStream: WritableSignal<number> = signal(0);
  protected readonly requirements: WritableSignal<GiveawayRequirements> = signal<GiveawayRequirements>(IGNORED_REQUIREMENTS);
  protected readonly multipliers: WritableSignal<GiveawayMultipliers> = signal<GiveawayMultipliers>(DEFAULT_MULTIPLIERS);

  private readonly board: WritableSignal<GiveawayOverlaySlice[]> = signal<GiveawayOverlaySlice[]>([]);

  private readonly pending: WritableSignal<GiveawayWinner | null> = signal<GiveawayWinner | null>(null);

  private readonly drawing: WritableSignal<boolean> = signal(false);

  private held: GiveawayWinner | null = null;

  private readonly wheel: Signal<WheelComponent | undefined> = viewChild(WheelComponent);

  private readonly participantSort: Signal<MatSort | undefined> = viewChild('participantSort', { read: MatSort });
  private readonly winnerSort: Signal<MatSort | undefined> = viewChild('winnerSort', { read: MatSort });
  private readonly noPager: Signal<MatPaginator | undefined> = signal<MatPaginator | undefined>(undefined);

  protected readonly participantSource: MatTableDataSource<GiveawayParticipant> = new MatTableDataSource<GiveawayParticipant>([]);
  protected readonly winnerSource: MatTableDataSource<GiveawayWinner> = new MatTableDataSource<GiveawayWinner>([]);

  protected readonly creating: Signal<boolean> = computed((): boolean => this.giveaway() === NEW_GIVEAWAY);

  protected readonly selectedId: Signal<string | null> = computed((): string | null => {
    const raw: string | undefined = this.giveaway();
    return raw === undefined || raw.length === 0 || raw === NEW_GIVEAWAY ? null : raw;
  });

  protected readonly detail: Signal<boolean> = computed((): boolean => this.creating() || this.selectedId() !== null);

  protected readonly status: Signal<GiveawayStatus | null> = computed((): GiveawayStatus | null => this.selected()?.status ?? null);

  protected readonly editable: Signal<boolean> = computed((): boolean => this.status() !== 'Open');

  protected readonly participants: Signal<GiveawayParticipant[]> = computed((): GiveawayParticipant[] => this.selected()?.participants ?? []);
  protected readonly winners: Signal<GiveawayWinner[]> = computed((): GiveawayWinner[] => this.selected()?.winners ?? []);

  protected readonly slices: Signal<string[]> = computed((): string[] =>
    this.board().map((slice: GiveawayOverlaySlice): string => slice.label));

  protected readonly weights: Signal<number[]> = computed((): number[] =>
    this.board().map((slice: GiveawayOverlaySlice): number => slice.weight));

  protected readonly chance: Signal<Map<string, number>> = computed((): Map<string, number> => {
    const rows: GiveawayParticipant[] = this.participants();
    const total: number = rows.reduce((sum: number, row: GiveawayParticipant): number => sum + row.multiplier, 0);

    return new Map<string, number>(rows.map((row: GiveawayParticipant): [string, number] =>
      [row.userId, total > 0 ? row.multiplier / total : 0]));
  });

  protected readonly overlayUrl: Signal<string | null> = computed((): string | null => {
    const id: string | null = this.selectedId();

    return id === null ? null : overlayUrl(GIVEAWAY_OVERLAY_PATH, GIVEAWAY_PARAM, id);
  });

  protected readonly descriptionLeft: Signal<number> = computed((): number => MAX_DESCRIPTION_LENGTH - this.description().length);

  protected readonly colorInvalid: Signal<boolean> = computed(
    (): boolean => !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(this.color().trim())
  );

  protected readonly valid: Signal<boolean> = computed((): boolean => {
    const title: string = this.title().trim();

    return title.length > 0 && title.length <= MAX_TITLE_LENGTH
      && Number.isFinite(this.cost()) && this.cost() >= 1
      && this.description().length <= MAX_DESCRIPTION_LENGTH
      && !this.colorInvalid()
      && !multipliersInvalid(this.multipliers());
  });

  private readonly fingerprint: Signal<string> = computed((): string => JSON.stringify([
    this.title().trim(),
    Math.floor(this.cost()),
    this.description().trim(),
    this.color().trim().toLowerCase(),
    this.cooldownSeconds(),
    this.maxPerStream(),
    this.maxPerUserPerStream(),
    this.requirements(),
    this.multipliers(),
  ]));

  private readonly baseline: WritableSignal<string> = signal('');

  protected readonly canSave: Signal<boolean> = computed((): boolean =>
    !this.busy() && this.valid() && this.editable() && (this.creating() || this.fingerprint() !== this.baseline()));

  protected readonly canDraw: Signal<boolean> = computed((): boolean =>
    !this.busy() && this.status() === 'Closed' && this.participants().length > 0 && !this.spinning());

  protected readonly spinning: Signal<boolean> = computed((): boolean => this.wheel()?.spinning() ?? false);

  protected readonly tileImage: Signal<string> = computed((): string => rewardImage(this.selected()?.reward ?? null));

  protected readonly costText: Signal<string> = computed((): string => {
    const cost: number = this.cost();
    return Number.isFinite(cost) && cost > 0 ? cost.toLocaleString('en-US') : '';
  });

  private listener: GiveawayListener | null = null;

  constructor() {
    wireDataSource(this.participantSource, this.participants, this.participantSort, this.noPager);
    wireDataSource(this.winnerSource, this.winners, this.winnerSort, this.noPager);

    this.participantSource.sortingDataAccessor = (row: GiveawayParticipant, column: string): string | number => {
      if (column === 'multiplier') return row.multiplier;
      if (column === 'entered') return row.enteredAt;
      return participantLabel(row).toLowerCase();
    };

    this.winnerSource.sortingDataAccessor = (row: GiveawayWinner, column: string): string | number => {
      if (column === 'order') return row.drawOrder;
      if (column === 'multiplier') return row.multiplier;
      if (column === 'won') return row.wonAt;
      return winnerLabel(row).toLowerCase();
    };

    void this.loadCount();
    void this.loadList();

    effect((): void => {
      const id: string | null = this.selectedId();
      untracked((): void => void this.loadGiveaway(id));
    });

    effect((onCleanup: EffectCleanupRegisterFn): void => {
      const listener: GiveawayListener = this.sync.listenDashboard((message: GiveawayDashboardMessage): void => this.receive(message));

      this.listener = listener;

      onCleanup((): void => {
        this.listener = null;
        listener.close();
      });
    });

    this.destroyRef.onDestroy((): void => this.listener?.close());
  }

  protected label(participant: GiveawayParticipant): string {
    return participantLabel(participant);
  }

  protected winnerName(winner: GiveawayWinner): string {
    return winnerLabel(winner);
  }

  protected tier(participant: GiveawayParticipant): string | null {
    return tierLabel(participant.subTier);
  }

  protected odds(participant: GiveawayParticipant): number {
    return this.chance().get(participant.userId) ?? 0;
  }

  protected setCost(value: string): void {
    const digits: string = value.replace(/[^0-9]/g, '');
    this.cost.set(digits.length === 0 ? 0 : Math.min(+digits, Number.MAX_SAFE_INTEGER));
  }

  protected openNew(): void {
    this.select(NEW_GIVEAWAY);
  }

  protected back(): void {
    this.select(null);
  }

  protected select(id: string | null): void {
    if (id === (this.giveaway() ?? null)) {
      if (id === NEW_GIVEAWAY) this.reset();
      return;
    }

    void this.router.navigate([], {
      queryParams: { giveaway: id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected showDetails(user: TwitchUser | null, event?: Event): void {
    if (user === null) return;

    event?.stopPropagation();
    UserInfoDialogComponent.open(this.dialog, user);
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) return;

    const id: string | null = this.selectedId();

    this.busy.set(true);
    try {
      const saved: GiveawaySettings = id === null
        ? await this.giveaways.create(this.buildUpdate())
        : await this.giveaways.save(id, this.buildUpdate());

      this.apply(saved);
      await this.loadList();

      if (id === null) {
        this.select(saved.id);
        this.notifications.success(`“${saved.title}” is created — open it when registration should start.`);
      } else {
        this.notifications.success(`“${saved.title}” is saved.`);
      }
    } catch (error: unknown) {
      this.notifications.failure(this.messageFrom(error, id === null
        ? 'Could not create the giveaway.'
        : 'Could not save the giveaway.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async open(): Promise<void> {
    const settings: GiveawaySettings | null = this.selected();
    if (settings === null) return;

    this.busy.set(true);
    try {
      this.apply(await this.giveaways.open(settings.id));
      await this.loadList();

      this.notifications.success(`“${settings.title}” is open — the reward is live in your channel.`);
    } catch (error: unknown) {
      this.notifications.failure(this.messageFrom(error, 'Could not open the giveaway.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async close(): Promise<void> {
    const settings: GiveawaySettings | null = this.selected();
    if (settings === null) return;

    this.busy.set(true);
    try {
      this.apply(await this.giveaways.close(settings.id));
      await this.loadList();

      this.notifications.success(`“${settings.title}” is closed — the reward is hidden again.`);
    } catch (error: unknown) {
      this.notifications.failure(this.messageFrom(error, 'Could not close the giveaway.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const settings: GiveawaySettings | null = this.selected();
    if (settings === null) return;

    const confirmed: boolean | undefined = await firstValueFrom(ConfirmActionDialogComponent.open(this.dialog, {
      title: 'Delete this giveaway',
      message: `This deletes “${settings.title}”, its channel point reward, and everybody who entered or won. Points already spent are not refunded.`,
      confirmLabel: 'Delete giveaway',
    }).afterClosed());

    if (!confirmed) return;

    this.busy.set(true);
    try {
      await this.giveaways.remove(settings.id);
      await this.loadList();

      this.select(null);
      this.notifications.success(`“${settings.title}” and its history are gone.`);
    } catch (error: unknown) {
      this.notifications.failure(this.messageFrom(error, 'Could not delete the giveaway.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async removeParticipant(participant: GiveawayParticipant): Promise<void> {
    const settings: GiveawaySettings | null = this.selected();
    if (settings === null) return;

    const confirmed: boolean | undefined = await firstValueFrom(ConfirmActionDialogComponent.open(this.dialog, {
      title: 'Take this entry off the wheel',
      message: `${this.label(participant)} will not be drawn again. The points they spent are not refunded, and they cannot enter a second time.`,
      confirmLabel: 'Remove entry',
    }).afterClosed());

    if (!confirmed) return;

    await this.dropParticipant(settings.id, participant.userId);
  }

  protected async resetToDraft(): Promise<void> {
    const settings: GiveawaySettings | null = this.selected();
    if (settings === null) return;

    const confirmed: boolean | undefined = await firstValueFrom(ConfirmActionDialogComponent.open(this.dialog, {
      title: 'Start this giveaway over',
      message: `“${settings.title}” goes back to a draft, and everybody who entered or won is cleared. The reward and its settings stay. Points already spent are not refunded.`,
      confirmLabel: 'Reset to draft',
    }).afterClosed());

    if (!confirmed) return;

    this.busy.set(true);
    try {
      this.apply(await this.giveaways.reset(settings.id));
      await this.loadList();

      this.notifications.success(`“${settings.title}” is a draft again.`);
    } catch (error: unknown) {
      this.notifications.failure(this.messageFrom(error, 'Could not reset the giveaway.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async draw(): Promise<void> {
    const settings: GiveawaySettings | null = this.selected();
    if (settings === null || !this.canDraw()) return;

    this.drawing.set(true);
    this.busy.set(true);

    try {
      const result: GiveawayDrawResult = await this.giveaways.draw(settings.id);

      this.board.set(result.slices);
      this.pending.set(result.winner);

      const wheel: WheelComponent | undefined = this.wheel();

      if (wheel === undefined) this.settleDraw(settings.id);
      else wheel.spin(result.index);
    } catch (error: unknown) {
      this.settleDraw(settings.id);
      this.notifications.failure(this.messageFrom(error, 'Could not draw a winner.'));
    } finally {
      this.busy.set(false);
    }
  }

  private settleDraw(giveawayId: string): GiveawayWinner | null {
    const winner: GiveawayWinner | null = this.pending() ?? this.held;

    this.pending.set(null);
    this.held = null;
    this.drawing.set(false);

    if (winner !== null) this.won(giveawayId, winner);

    return winner;
  }

  protected async landed(spin: WheelSpin): Promise<void> {
    const settings: GiveawaySettings | null = this.selected();
    const winner: GiveawayWinner | null = settings === null ? null : this.settleDraw(settings.id);

    const choice: 'close' | 'remove' = await WheelWinnerDialogComponent.announce(
      this.dialog, winner === null ? spin.label : this.winnerName(winner));

    if (choice !== 'remove' || winner === null || settings === null) return;

    await this.dropParticipant(settings.id, winner.userId);
  }

  private async dropParticipant(giveawayId: string, userId: string): Promise<void> {
    this.busy.set(true);
    try {
      await this.giveaways.removeParticipant(giveawayId, userId);

      this.selected.update((current: GiveawaySettings | null): GiveawaySettings | null => current === null ? null : {
        ...current,
        participants: current.participants.filter((entry: GiveawayParticipant): boolean => entry.userId !== userId),
      });

      this.syncBoard();
      await this.loadList();
    } catch (error: unknown) {
      this.notifications.failure(this.messageFrom(error, 'Could not remove the entry.'));
    } finally {
      this.busy.set(false);
    }
  }

  private buildUpdate(): GiveawayUpdate {
    return {
      title: this.title().trim(),
      cost: Math.floor(this.cost()),
      description: this.description().trim() || null,
      backgroundColor: this.color().trim(),
      cooldownSeconds: this.cooldownSeconds() || null,
      maxPerStream: this.maxPerStream() || null,
      maxPerUserPerStream: this.maxPerUserPerStream() || null,
      requirements: this.requirements(),
      multipliers: this.multipliers(),
    };
  }

  private apply(settings: GiveawaySettings): void {
    this.selected.set(settings);

    this.title.set(settings.title);
    this.cost.set(settings.cost);
    this.description.set(settings.description);
    this.color.set(settings.reward?.backgroundColor || DEFAULT_COLOR);
    this.cooldownSeconds.set(settings.cooldownSeconds ?? 0);
    this.maxPerStream.set(settings.maxPerStream ?? 0);
    this.maxPerUserPerStream.set(settings.maxPerUserPerStream ?? 0);
    this.requirements.set(settings.requirements);

    this.multipliers.set({ ...DEFAULT_MULTIPLIERS, ...settings.multipliers });

    this.baseline.set(this.fingerprint());
    this.syncBoard();
  }

  private reset(): void {
    this.selected.set(null);

    this.title.set('');
    this.cost.set(DEFAULT_COST);
    this.description.set('');
    this.color.set(DEFAULT_COLOR);
    this.cooldownSeconds.set(0);
    this.maxPerStream.set(0);
    this.maxPerUserPerStream.set(0);
    this.requirements.set(IGNORED_REQUIREMENTS);
    this.multipliers.set(DEFAULT_MULTIPLIERS);

    this.baseline.set(this.fingerprint());
    this.board.set([]);
  }

  private syncBoard(): void {
    if (this.wheel()?.spinning()) return;

    this.board.set(this.participants().map((participant: GiveawayParticipant): GiveawayOverlaySlice => ({
      label: participantLabel(participant),
      weight: participant.multiplier,
    })));
  }

  private async loadCount(): Promise<void> {
    try {
      this.expected.set(await this.giveaways.count());
    } catch {
      this.expected.set(null);
    }
  }

  private async loadList(): Promise<void> {
    try {
      const summaries: GiveawaySummary[] = await this.giveaways.list();

      this.summaries.set(summaries);
      this.expected.set(summaries.length);
    } catch (error: unknown) {
      this.notifications.failure(this.messageFrom(error, 'Could not load your giveaways.'));
    } finally {
      this.loaded.set(true);
    }
  }

  private async loadGiveaway(id: string | null): Promise<void> {
    if (id === null) {
      this.reset();
      return;
    }

    try {
      this.apply(await this.giveaways.getGiveaway(id));
    } catch (error: unknown) {
      this.notifications.failure(this.messageFrom(error, 'Could not load that giveaway.'));
      this.select(null);
    }
  }

  private receive(message: GiveawayDashboardMessage): void {
    if (message.type === 'participant') {
      this.entered(message.giveawayId, message.participant);
      return;
    }

    if (message.type === 'status') {
      this.restated(message.giveawayId, message.status);
      return;
    }

    this.won(message.giveawayId, message.winner);
  }

  private entered(giveawayId: string, participant: GiveawayParticipant): void {
    this.summaries.update((current: GiveawaySummary[]): GiveawaySummary[] =>
      current.map((summary: GiveawaySummary): GiveawaySummary =>
        summary.id === giveawayId ? { ...summary, participantCount: summary.participantCount + 1 } : summary));

    this.selected.update((current: GiveawaySettings | null): GiveawaySettings | null => {
      if (current === null || current.id !== giveawayId) return current;
      if (current.participants.some((entry: GiveawayParticipant): boolean => entry.userId === participant.userId)) return current;

      return { ...current, participants: [...current.participants, participant] };
    });

    this.syncBoard();
  }

  private restated(giveawayId: string, status: GiveawayStatus): void {
    this.summaries.update((current: GiveawaySummary[]): GiveawaySummary[] =>
      current.map((summary: GiveawaySummary): GiveawaySummary =>
        summary.id === giveawayId ? { ...summary, status } : summary));

    this.selected.update((current: GiveawaySettings | null): GiveawaySettings | null =>
      current === null || current.id !== giveawayId ? current : { ...current, status });
  }

  private won(giveawayId: string, winner: GiveawayWinner): void {
    if (this.drawing()) {
      this.held = winner;
      return;
    }

    this.summaries.update((current: GiveawaySummary[]): GiveawaySummary[] =>
      current.map((summary: GiveawaySummary): GiveawaySummary =>
        summary.id === giveawayId ? { ...summary, winnerCount: Math.max(summary.winnerCount, winner.drawOrder) } : summary));

    this.selected.update((current: GiveawaySettings | null): GiveawaySettings | null => {
      if (current === null || current.id !== giveawayId) return current;
      if (current.winners.some((entry: GiveawayWinner): boolean => entry.drawOrder === winner.drawOrder)) return current;

      return { ...current, winners: [...current.winners, winner] };
    });
  }

  private messageFrom(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;

    return typeof error.error === 'string' && error.error.trim().length > 0 ? error.error : fallback;
  }
}