import { Component, computed, inject, signal, Signal, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { NumberStepperComponent } from '../number-stepper-component/number-stepper.component';
import { ScrollBarComponent } from '../scroll-bar-component/scroll-bar.component';
import { UserFinderComponent } from '../user-finder-component/user-finder.component';
import { BanNoticeComponent } from '../ban-notice-component/ban-notice.component';
import { BannedUser } from '../../data/banned-user';
import { TwitchUser } from '../../data/twitch-user';
import { UserRoles } from '../../data/user-roles';
import { environment } from '../../environments/environment';
import { NoticeComponent } from '../notice-component/notice.component';
import { openDialog } from '../../services/dialog';

export interface BanChoice {
  user: TwitchUser;
  duration: number | null; // seconds, null for a permanent ban
  reason: string | null;
}

export interface BanUserDialogData {
  permanent: boolean;
}

interface DurationUnit {
  label: string;
  seconds: number;
}

const MIN_TIMEOUT_SECONDS: number = 1;
const MAX_TIMEOUT_SECONDS: number = 1_209_600;
const MAX_REASON_LENGTH: number = 500;
const PERMANENT: number = 0;

const UNITS: readonly DurationUnit[] = [
  { label: 'Seconds', seconds: 1 },
  { label: 'Minutes', seconds: 60 },
  { label: 'Hours', seconds: 3_600 },
  { label: 'Days', seconds: 86_400 },
  { label: 'Permanent', seconds: PERMANENT },
];

@Component({
  selector: 'app-ban-user-dialog',
  templateUrl: './ban-user-dialog.component.html',
  styleUrl: './ban-user-dialog.component.scss',
  imports: [BanNoticeComponent, NoticeComponent, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, NumberStepperComponent, ScrollBarComponent, UserFinderComponent],
})
export class BanUserDialogComponent {

  private readonly dialogRef: MatDialogRef<BanUserDialogComponent, BanChoice> = inject<MatDialogRef<BanUserDialogComponent, BanChoice>>(MatDialogRef);

  protected readonly found: WritableSignal<TwitchUser | null> = signal<TwitchUser | null>(null);

  protected readonly units: readonly DurationUnit[] = UNITS;

  private readonly data: BanUserDialogData = inject<BanUserDialogData>(MAT_DIALOG_DATA);

  protected readonly amount: WritableSignal<number> = signal(10);
  protected readonly unit: WritableSignal<number> = signal(this.data.permanent ? PERMANENT : 60);
  protected readonly reason: WritableSignal<string> = signal('');

  protected readonly maxReasonLength: number = MAX_REASON_LENGTH;

  protected readonly reasonLeft: Signal<number> = computed((): number => MAX_REASON_LENGTH - this.reason().length);

  protected readonly maxAmount: Signal<number> = computed((): number => {
    const unit: number = this.unit();
    return unit === PERMANENT ? 0 : Math.floor(MAX_TIMEOUT_SECONDS / unit);
  });

  protected readonly tooLong: Signal<boolean> = computed((): boolean => {
    const duration: number | null = this.durationSeconds();
    return duration !== null && duration > MAX_TIMEOUT_SECONDS;
  });

  protected readonly tooShort: Signal<boolean> = computed((): boolean => {
    const duration: number | null = this.durationSeconds();
    return duration !== null && (!Number.isFinite(duration) || duration < MIN_TIMEOUT_SECONDS);
  });

  protected readonly unitName: Signal<string> = computed((): string => {
    const unit: number = this.unit();
    return UNITS.find((option: DurationUnit): boolean => option.seconds === unit)?.label.toLowerCase() ?? '';
  });

  protected readonly limitText: Signal<string> = computed((): string => {
    const unit: string = this.unitName();
    if (unit === 'days') return 'at most 14 days';
    return `at most ${this.maxAmount().toLocaleString('en-US')} ${unit}, which is 14 days`;
  });

  protected readonly floorText: Signal<string> = computed(
    (): string => `at least 1 ${this.unitName().replace(/s$/, '')}`,
  );

  protected readonly permanent: Signal<boolean> = computed((): boolean => this.unit() === PERMANENT);

  private readonly durationSeconds: Signal<number | null> = computed((): number | null => {
    const unit: number = this.unit();
    return unit === PERMANENT ? null : Math.floor(this.amount()) * unit;
  });

  protected readonly broadcaster: Signal<boolean> = computed((): boolean => this.found()?.roles?.broadcaster === true);

  protected readonly droppedRoles: Signal<readonly string[]> = computed((): readonly string[] => {
    const roles: UserRoles | null | undefined = this.found()?.roles;
    if (!roles) return [];

    const dropped: string[] = [];
    if (roles.moderator) dropped.push('a moderator');
    if (roles.vip) dropped.push('a VIP');

    return dropped;
  });

  protected readonly editor: Signal<boolean> = computed((): boolean => this.found()?.roles?.editor === true);

  protected readonly bot: Signal<boolean> = computed(
    (): boolean => this.found()?.id === environment.botUserId,
  );

  protected readonly restriction: WritableSignal<BannedUser | null> = signal<BannedUser | null>(null);

  protected readonly banned: Signal<boolean> = computed((): boolean => {
    const ban: BannedUser | null = this.restriction();
    return ban !== null && ban.expiresAt === null;
  });

  protected readonly restrictionNote: Signal<string> = computed((): string => {
    if (!this.banned()) return '';

    return this.permanent()
      ? 'The ban already holds until it is lifted, so there is nothing left for this one to add.'
      : 'A timeout cannot be laid on top of a ban. Unban them first, then time them out.';
  });

  protected readonly roleWarning: Signal<string | null> = computed((): string | null => {
    const dropped: readonly string[] = this.droppedRoles();
    if (dropped.length === 0) return null;

    const name: string = this.found()?.displayName ?? '';
    const roles: string = dropped.join(' and ');
    const subject: string = dropped.length === 1 ? 'That role is' : 'Those roles are';

    return `${name} is ${roles}. ${subject} dropped when the ban goes through, and would have to be granted again.`;
  });

  protected readonly valid: Signal<boolean> = computed((): boolean => {
    if (!this.found() || this.broadcaster() || this.banned()) return false;

    const duration: number | null = this.durationSeconds();
    return duration === null
      || (Number.isFinite(duration) && duration >= MIN_TIMEOUT_SECONDS && duration <= MAX_TIMEOUT_SECONDS);
  });

  protected readonly actionLabel: Signal<string> = computed((): string => this.permanent() ? 'Ban user' : 'Timeout user');
  protected readonly unitLabel: Signal<string> = computed((): string => this.permanent() ? 'Duration' : 'Unit');

  static open(dialog: MatDialog, permanent: boolean = false): MatDialogRef<BanUserDialogComponent, BanChoice> {
    return openDialog<BanUserDialogComponent, BanUserDialogData, BanChoice>(
      dialog, BanUserDialogComponent, { permanent }, { width: '33vw', minWidth: 'min(24rem, 92vw)' });
  }

  protected confirm(): void {
    const user: TwitchUser | null = this.found();
    if (!user || !this.valid()) return;

    this.dialogRef.close({
      user,
      duration: this.durationSeconds(),
      reason: this.reason().trim() || null,
    });
  }
}