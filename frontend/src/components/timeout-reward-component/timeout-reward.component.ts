import { Component, computed, inject, signal, Signal, WritableSignal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';
import { RewardSwitchesComponent } from '../reward-switches-component/reward-switches.component';
import { ConfirmActionDialogComponent } from '../confirm-action-dialog-component/confirm-action-dialog.component';
import { NumberStepperComponent } from '../number-stepper-component/number-stepper.component';
import { RewardLimitsComponent } from '../reward-limits-component/reward-limits.component';
import { bestUnit, COOLDOWN_MAX_SECONDS, DURATION_UNITS, DurationUnit } from '../../data/duration';
import { RewardPreviewComponent } from '../reward-preview-component/reward-preview.component';
import { NotificationService } from '../../services/notification.service';
import { TimeoutRewardService } from '../../services/timeout-reward.service';
import { ProtectedRole, TimeoutRewardSettings, TimeoutRewardUpdate } from '../../data/timeout-reward';

interface ProtectedRoleOption {
  role: ProtectedRole;
  label: string;
  hint?: string;
}

interface ProtectedRoleGroup {
  label: string;
  options: readonly ProtectedRoleOption[];
}

const MAX_TIMEOUT_SECONDS: number = 1_209_600;

const MAX_TITLE_LENGTH: number = 45;
const MAX_PROMPT_LENGTH: number = 200;

const DEFAULT_COLOR: string = '#A8E02F';

const DEFAULT_IMAGE: string = 'https://static-cdn.jtvnw.net/custom-reward-images/default-2.png';

const PROTECTED_GROUPS: readonly ProtectedRoleGroup[] = [
  {
    label: 'Channel roles',
    options: [
      { role: 'Editor', label: 'Editors' },
      { role: 'Moderator', label: 'Moderators' },
      { role: 'Vip', label: 'VIPs' },
    ],
  },
  {
    label: 'Viewers',
    options: [
      { role: 'Tier3Subscriber', label: 'Tier 3 subscribers', hint: 'Tier 3 only' },
      { role: 'Tier2Subscriber', label: 'Tier 2 subscribers', hint: 'Tier 2 and up' },
      { role: 'Subscriber', label: 'Tier 1 subscribers', hint: 'Tier 1 and up' },
      { role: 'Follower', label: 'Followers' },
    ],
  },
];

@Component({
  selector: 'app-timeout-reward',
  templateUrl: './timeout-reward.component.html',
  styleUrl: './timeout-reward.component.scss',
  imports: [
    DecimalPipe, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressBarModule, MatSelectModule,
    NumberStepperComponent, RewardLimitsComponent, RewardPreviewComponent, RewardSwitchesComponent
  ],
})
export class TimeoutRewardComponent {

  private readonly rewards: TimeoutRewardService = inject(TimeoutRewardService);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly dialog: MatDialog = inject(MatDialog);

  protected readonly units: readonly DurationUnit[] = DURATION_UNITS;
  protected readonly protectedGroups: readonly ProtectedRoleGroup[] = PROTECTED_GROUPS;
  protected readonly maxTitleLength: number = MAX_TITLE_LENGTH;
  protected readonly maxPromptLength: number = MAX_PROMPT_LENGTH;

  private readonly settings: WritableSignal<TimeoutRewardSettings | null> = signal<TimeoutRewardSettings | null>(null);

  private readonly loaded: WritableSignal<boolean> = signal(false);

  protected readonly skeleton: Signal<boolean> = computed((): boolean => !this.loaded());
  protected readonly busy: WritableSignal<boolean> = signal(false);

  protected readonly exists: Signal<boolean> = computed((): boolean => this.settings() !== null);

  protected readonly title: WritableSignal<string> = signal('');
  protected readonly cost: WritableSignal<number> = signal(10_000);
  protected readonly prompt: WritableSignal<string> = signal('');
  protected readonly color: WritableSignal<string> = signal(DEFAULT_COLOR);
  protected readonly enabled: WritableSignal<boolean> = signal(true);

  protected readonly durationAmount: WritableSignal<number> = signal(90);
  protected readonly durationUnit: WritableSignal<number> = signal(1);

  protected readonly cooldownSeconds: WritableSignal<number> = signal(0);
  protected readonly maxPerStream: WritableSignal<number> = signal(0);
  protected readonly maxPerUser: WritableSignal<number> = signal(0);

  protected readonly shielded: WritableSignal<ReadonlySet<ProtectedRole>> = signal<ReadonlySet<ProtectedRole>>(new Set(['Moderator', 'Editor']));

  protected readonly promptLeft: Signal<number> = computed((): number => MAX_PROMPT_LENGTH - this.prompt().length);
  protected readonly editorAtRisk: Signal<boolean> = computed((): boolean => !this.shielded().has('Editor'));
  protected readonly leadModeratorAtRisk: Signal<boolean> = computed((): boolean => !this.shielded().has('Moderator'));

  protected readonly costText: Signal<string> = computed((): string => {
    const cost: number = this.cost();
    return Number.isFinite(cost) && cost > 0 ? cost.toLocaleString('en-US') : '';
  });

  private readonly durationSeconds: Signal<number> = computed((): number => Math.floor(this.durationAmount()) * this.durationUnit());


  protected readonly maxDurationAmount: Signal<number> = computed((): number => Math.floor(MAX_TIMEOUT_SECONDS / this.durationUnit()));


  protected readonly durationInvalid: Signal<boolean> = computed((): boolean => {
    const seconds: number = this.durationSeconds();
    return !Number.isFinite(seconds) || seconds < 1 || seconds > MAX_TIMEOUT_SECONDS;
  });

  protected readonly cooldownInvalid: Signal<boolean> = computed((): boolean => {
    const seconds: number = this.cooldownSeconds();
    return !Number.isFinite(seconds) || seconds < 0 || seconds > COOLDOWN_MAX_SECONDS;
  });

  protected readonly colorInvalid: Signal<boolean> = computed(
    (): boolean => !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(this.color().trim()),
  );

  protected readonly valid: Signal<boolean> = computed((): boolean => {
    const title: string = this.title().trim();

    return title.length > 0 && title.length <= MAX_TITLE_LENGTH
      && Number.isFinite(this.cost()) && this.cost() >= 1
      && this.prompt().length <= MAX_PROMPT_LENGTH
      && !this.colorInvalid()
      && !this.durationInvalid()
      && !this.cooldownInvalid()
      && this.maxPerStream() >= 0
      && this.maxPerUser() >= 0;
  });

  private readonly fingerprint: Signal<string> = computed((): string => JSON.stringify([
    this.title().trim(),
    Math.floor(this.cost()),
    this.prompt().trim(),
    this.color().trim().toLowerCase(),
    this.enabled(),
    this.durationSeconds(),
    this.cooldownSeconds(),
    Math.floor(this.maxPerStream()),
    Math.floor(this.maxPerUser()),
    [...this.shielded()].sort(),
  ]));

  private readonly baseline: WritableSignal<string> = signal('');

  protected readonly canSave: Signal<boolean> = computed((): boolean =>
    !this.busy() && this.valid() && (!this.exists() || this.fingerprint() !== this.baseline()));

  protected readonly tileImage: Signal<string> = computed((): string => {
    const reward = this.settings()?.reward;
    return reward?.image?.url_2x ?? reward?.defaultImage?.url_2x ?? DEFAULT_IMAGE;
  });

  constructor() {
    void this.load();
  }

  protected setCost(value: string): void {
    const digits: string = value.replace(/[^0-9]/g, '');
    this.cost.set(digits.length === 0 ? 0 : Math.min(+digits, Number.MAX_SAFE_INTEGER));
  }

  protected has(role: ProtectedRole): boolean {
    return this.shielded().has(role);
  }

  protected toggle(role: ProtectedRole, checked: boolean): void {
    this.shielded.update((current: ReadonlySet<ProtectedRole>): ReadonlySet<ProtectedRole> => {
      const next = new Set(current);
      checked ? next.add(role) : next.delete(role);
      return next;
    });
  }

  protected async save(): Promise<void> {
    if (!this.valid()) return;

    const creating: boolean = !this.exists();

    this.busy.set(true);
    try {
      const saved: TimeoutRewardSettings = await this.rewards.save(this.buildUpdate());

      this.settings.set(saved);
      this.apply(saved);

      this.notifications.success(!creating
        ? `“${saved.reward.title}” is updated.`
        : saved.reward.isEnabled
          ? `“${saved.reward.title}” is live in your channel.`
          : `“${saved.reward.title}” is created and stays hidden until it is enabled.`);
    } catch {
      this.notifications.failure(creating
        ? 'Could not create the reward.'
        : 'Could not save the reward.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const settings: TimeoutRewardSettings | null = this.settings();
    if (settings === null) return;

    const dialogRef = ConfirmActionDialogComponent.open(this.dialog, {
      title: 'Remove the timeout reward',
      message: `This deletes “${settings.reward.title}” from your channel. Twitch marks open redemptions as fulfilled, so points already spent are not refunded.`,
      confirmLabel: 'Remove reward',
    });

    const confirmed: boolean | undefined = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) return;

    this.busy.set(true);
    try {
      await this.rewards.remove();

      this.settings.set(null);
      this.reset();

      this.notifications.success('The timeout reward is gone from your channel.');
    } catch {
      this.notifications.failure('Could not remove the reward.');
    } finally {
      this.busy.set(false);
    }
  }

  private buildUpdate(): TimeoutRewardUpdate {
    return {
      title: this.title().trim(),
      cost: Math.floor(this.cost()),
      prompt: this.prompt().trim() || null,
      backgroundColor: this.color().trim(),
      isEnabled: this.enabled(),
      cooldownSeconds: this.cooldownSeconds() || null,
      maxPerStream: Math.floor(this.maxPerStream()) || null,
      maxPerUserPerStream: Math.floor(this.maxPerUser()) || null,
      durationSeconds: this.durationSeconds(),
      protected: [...this.shielded()],
    };
  }

  private apply(settings: TimeoutRewardSettings): void {
    const reward = settings.reward;

    this.title.set(reward.title);
    this.cost.set(reward.cost);
    this.prompt.set(reward.prompt);
    this.color.set(reward.backgroundColor || DEFAULT_COLOR);
    this.enabled.set(reward.isEnabled);

    const duration: DurationUnit = bestUnit(settings.durationSeconds);
    this.durationUnit.set(duration.seconds);
    this.durationAmount.set(settings.durationSeconds / duration.seconds);

    this.cooldownSeconds.set(reward.globalCooldownSetting.isEnabled ? reward.globalCooldownSetting.globalCooldownSeconds : 0);

    this.maxPerStream.set(reward.maxPerStreamSetting.isEnabled ? reward.maxPerStreamSetting.maxPerStream : 0);
    this.maxPerUser.set(reward.maxPerUserPerStreamSetting.isEnabled ? reward.maxPerUserPerStreamSetting.maxPerUserPerStream : 0);

    this.shielded.set(new Set(settings.protected));
    this.baseline.set(this.fingerprint());
  }

  private reset(): void {
    this.title.set('');
    this.cost.set(10_000);
    this.prompt.set('');
    this.color.set(DEFAULT_COLOR);
    this.enabled.set(true);
    this.durationAmount.set(90);
    this.durationUnit.set(1);
    this.cooldownSeconds.set(0);
    this.maxPerStream.set(0);
    this.maxPerUser.set(0);
    this.shielded.set(new Set(['Moderator', 'Editor']));
    this.baseline.set(this.fingerprint());
  }

  private async load(): Promise<void> {
    try {
      const settings: TimeoutRewardSettings | null = await this.rewards.getSettings();

      this.settings.set(settings);
      if (settings !== null) this.apply(settings);
    } catch {
      this.notifications.failure('Could not load the timeout reward.');
    } finally {
      this.loaded.set(true);
    }
  }
}