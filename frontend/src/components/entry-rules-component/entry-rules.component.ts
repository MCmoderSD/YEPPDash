import { DecimalPipe } from '@angular/common';
import { Component, computed, input, InputSignal, model, ModelSignal, Signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { NumberStepperComponent } from '../number-stepper-component/number-stepper.component';
import {
  baseInvalid,
  DEFAULT_MULTIPLIERS,
  GIVEAWAY_ROLES,
  GiveawayMultipliers,
  GiveawayRequirements,
  GiveawayRole,
  IGNORED_REQUIREMENTS,
  MULTIPLIER_MAX,
  MULTIPLIER_MIN,
  MULTIPLIER_STEP,
  multipliersInvalid,
  REQUIREMENT_LABELS,
  REQUIREMENT_STATES,
  RequirementState,
  ROLE_HINTS,
  ROLE_LABELS,
} from '../../data/giveaway';

@Component({
  selector: 'app-entry-rules',
  templateUrl: './entry-rules.component.html',
  styleUrl: './entry-rules.component.scss',
  imports: [DecimalPipe, MatFormFieldModule, MatInputModule, MatSelectModule, NumberStepperComponent],
})
export class EntryRulesComponent {

  readonly requirements: ModelSignal<GiveawayRequirements> = model<GiveawayRequirements>(IGNORED_REQUIREMENTS);

  readonly multipliers: ModelSignal<GiveawayMultipliers> = model<GiveawayMultipliers>(DEFAULT_MULTIPLIERS);

  readonly disabled: InputSignal<boolean> = input<boolean>(false);

  readonly group: InputSignal<string> = input<string>('rule');

  protected readonly roles: readonly GiveawayRole[] = GIVEAWAY_ROLES;
  protected readonly roleLabels: Readonly<Record<GiveawayRole, string>> = ROLE_LABELS;
  protected readonly roleHints: Readonly<Record<GiveawayRole, string>> = ROLE_HINTS;
  protected readonly requirementStates: readonly RequirementState[] = REQUIREMENT_STATES;
  protected readonly requirementLabels: Readonly<Record<RequirementState, string>> = REQUIREMENT_LABELS;

  protected readonly multiplierMin: number = MULTIPLIER_MIN;
  protected readonly multiplierMax: number = MULTIPLIER_MAX;
  protected readonly multiplierStep: number = MULTIPLIER_STEP;

  protected readonly baseBroken: Signal<boolean> = computed((): boolean => baseInvalid(this.multipliers()));

  protected readonly anyBroken: Signal<boolean> = computed((): boolean => multipliersInvalid(this.multipliers()));

  protected labelId(role: GiveawayRole): string {
    return `${this.group()}-${role}`;
  }

  protected requirementOf(role: GiveawayRole): RequirementState {
    return this.requirements()[role];
  }

  protected setRequirement(role: GiveawayRole, state: RequirementState): void {
    this.requirements.update((current: GiveawayRequirements): GiveawayRequirements => ({ ...current, [role]: state }));
  }

  protected baseOf(): number {
    return this.multipliers().base;
  }

  protected setBase(value: number): void {
    this.multipliers.update((current: GiveawayMultipliers): GiveawayMultipliers => ({ ...current, base: rounded(value) }));
  }

  protected setBaseText(value: string): void {
    const parsed: number | null = parse(value);
    if (parsed !== null) this.setBase(parsed);
  }

  protected multiplierOf(role: GiveawayRole): number {
    return this.multipliers()[role];
  }

  protected setMultiplier(role: GiveawayRole, value: number): void {
    this.multipliers.update((current: GiveawayMultipliers): GiveawayMultipliers => ({ ...current, [role]: rounded(value) }));
  }

  protected setMultiplierText(role: GiveawayRole, value: string): void {
    const parsed: number | null = parse(value);
    if (parsed !== null) this.setMultiplier(role, parsed);
  }

  protected multiplierInvalid(role: GiveawayRole): boolean {
    const value: number = this.multiplierOf(role);
    return !Number.isFinite(value) || value < MULTIPLIER_MIN || value > MULTIPLIER_MAX;
  }
}

function rounded(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 1;
}

function parse(value: string): number | null {
  const typed: string = value.trim().replace(',', '.');
  const parsed: number = Number(typed);

  return typed.length === 0 || !Number.isFinite(parsed) ? null : parsed;
}