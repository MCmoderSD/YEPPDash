import { Component, computed, DestroyRef, effect, EffectCleanupRegisterFn, inject, input, InputSignal, signal, Signal, untracked, viewChild, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom } from 'rxjs';
import { RewardFieldsComponent } from '../../components/reward-fields-component/reward-fields.component';
import { RewardSwitchesComponent } from '../../components/reward-switches-component/reward-switches.component';
import { EntryRulesComponent } from '../../components/entry-rules-component/entry-rules.component';
import { GiveawayEntriesTableComponent } from '../../components/giveaway-entries-table-component/giveaway-entries-table.component';
import { GiveawayGridComponent } from '../../components/giveaway-grid-component/giveaway-grid.component';
import { GiveawayWinnersTableComponent } from '../../components/giveaway-winners-table-component/giveaway-winners-table.component';
import { ConfirmActionDialogComponent } from '../../components/confirm-action-dialog-component/confirm-action-dialog.component';
import { OverlayLinkComponent } from '../../components/overlay-link-component/overlay-link.component';
import { RegistrationControlsComponent } from '../../components/registration-controls-component/registration-controls.component';
import { RewardLimitsComponent } from '../../components/reward-limits-component/reward-limits.component';
import { RewardPreviewComponent } from '../../components/reward-preview-component/reward-preview.component';
import { StatusBadgeComponent } from '../../components/status-badge-component/status-badge.component';
import { WheelComponent, WheelSpin } from '../../components/wheel-component/wheel.component';
import { WheelWinnerDialogComponent } from '../../components/wheel-winner-dialog-component/wheel-winner-dialog.component';
import { GiveawayService } from '../../services/giveaway.service';
import { GiveawayDashboardMessage, GiveawaySyncService } from '../../services/giveaway-sync.service';
import { StreamListener } from '../../services/sse.service';
import { NotificationService } from '../../services/notification.service';
import { errorMessage } from '../../services/http-error';
import { GIVEAWAY_OVERLAY_PATH, GIVEAWAY_PARAM, overlayUrl } from '../../data/overlay';
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
  STATUS_LABELS,
  winnerLabel,
} from '../../data/giveaway';
import { DEFAULT_REWARD_COLOR, isHexColor, REWARD_PROMPT_MAX, REWARD_TITLE_MAX, rewardImage } from '../../data/custom-reward';

const DEFAULT_COST: number = 1_000;

@Component({
  selector: 'app-giveaway-page',
  templateUrl: './giveaway-page.component.html',
  styleUrl: './giveaway-page.component.scss',
  imports: [
    MatButtonModule, MatIconModule, MatProgressBarModule, MatTabsModule,
    EntryRulesComponent, GiveawayEntriesTableComponent, GiveawayGridComponent, GiveawayWinnersTableComponent,
    OverlayLinkComponent, RegistrationControlsComponent, RewardFieldsComponent, RewardLimitsComponent,
    RewardPreviewComponent, RewardSwitchesComponent, StatusBadgeComponent, WheelComponent,
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

  protected readonly defaultColor: string = DEFAULT_REWARD_COLOR;

  protected readonly summaries: WritableSignal<GiveawaySummary[]> = signal<GiveawaySummary[]>([]);
  protected readonly selected: WritableSignal<GiveawaySettings | null> = signal<GiveawaySettings | null>(null);

  private readonly loaded: WritableSignal<boolean> = signal(false);

  protected readonly detailLoading: WritableSignal<boolean> = signal(false);

  protected readonly expected: WritableSignal<number | null> = signal<number | null>(null);
  protected readonly skeleton: Signal<boolean> = computed((): boolean => !this.loaded());
  protected readonly busy: WritableSignal<boolean> = signal(false);

  protected readonly title: WritableSignal<string> = signal('');
  protected readonly cost: WritableSignal<number> = signal(DEFAULT_COST);
  protected readonly description: WritableSignal<string> = signal('');
  protected readonly color: WritableSignal<string> = signal(DEFAULT_REWARD_COLOR);
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

  private readonly noPager: Signal<MatPaginator | undefined> = signal<MatPaginator | undefined>(undefined);

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

  protected readonly overlayUrl: Signal<string | null> = computed((): string | null => {
    const id: string | null = this.selectedId();

    return id === null ? null : overlayUrl(GIVEAWAY_OVERLAY_PATH, GIVEAWAY_PARAM, id);
  });

  protected readonly colorInvalid: Signal<boolean> = computed((): boolean => !isHexColor(this.color()));

  protected readonly valid: Signal<boolean> = computed((): boolean => {
    const title: string = this.title().trim();

    return title.length > 0 && title.length <= REWARD_TITLE_MAX
      && Number.isFinite(this.cost()) && this.cost() >= 1
      && this.description().length <= REWARD_PROMPT_MAX
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

  private listener: StreamListener | null = null;

  constructor() {
    void this.loadCount();
    void this.loadList();

    effect((): void => {
      const id: string | null = this.selectedId();
      untracked((): void => void this.loadGiveaway(id));
    });

    effect((onCleanup: EffectCleanupRegisterFn): void => {
      const listener: StreamListener = this.sync.listenDashboard((message: GiveawayDashboardMessage): void => this.receive(message));

      this.listener = listener;

      onCleanup((): void => {
        this.listener = null;
        listener.close();
      });
    });

    this.destroyRef.onDestroy((): void => this.listener?.close());
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
      this.notifications.failure(errorMessage(error, id === null
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
      this.notifications.failure(errorMessage(error, 'Could not open the giveaway.'));
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
      this.notifications.failure(errorMessage(error, 'Could not close the giveaway.'));
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
      this.notifications.failure(errorMessage(error, 'Could not delete the giveaway.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async removeParticipant(participant: GiveawayParticipant): Promise<void> {
    const settings: GiveawaySettings | null = this.selected();
    if (settings === null) return;

    const confirmed: boolean | undefined = await firstValueFrom(ConfirmActionDialogComponent.open(this.dialog, {
      title: 'Take this entry off the wheel',
      message: `${participantLabel(participant)} will not be drawn again. The points they spent are not refunded, and they cannot enter a second time.`,
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
      this.notifications.failure(errorMessage(error, 'Could not reset the giveaway.'));
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
      this.notifications.failure(errorMessage(error, 'Could not draw a winner.'));
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
      this.dialog, winner === null ? spin.label : winnerLabel(winner));

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
      this.notifications.failure(errorMessage(error, 'Could not remove the entry.'));
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
    this.color.set(settings.reward?.backgroundColor || DEFAULT_REWARD_COLOR);
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
    this.color.set(DEFAULT_REWARD_COLOR);
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
      this.notifications.failure(errorMessage(error, 'Could not load your giveaways.'));
    } finally {
      this.loaded.set(true);
    }
  }

  private async loadGiveaway(id: string | null): Promise<void> {
    if (id === null) {
      this.reset();
      return;
    }

    this.detailLoading.set(true);

    try {
      this.apply(await this.giveaways.getGiveaway(id));
    } catch (error: unknown) {
      this.notifications.failure(errorMessage(error, 'Could not load that giveaway.'));
      this.select(null);
    } finally {
      this.detailLoading.set(false);
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
}