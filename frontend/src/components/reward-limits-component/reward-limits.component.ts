import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, input, InputSignal, model, ModelSignal, signal, Signal, untracked, WritableSignal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { NumberStepperComponent } from '../number-stepper-component/number-stepper.component';
import { bestUnit, COOLDOWN_MAX_SECONDS, DURATION_UNITS, DurationUnit } from '../../data/duration';

@Component({
  selector: 'app-reward-limits',
  templateUrl: './reward-limits.component.html',
  styleUrl: './reward-limits.component.scss',
  imports: [DecimalPipe, MatFormFieldModule, MatInputModule, MatSelectModule, NumberStepperComponent],
})
export class RewardLimitsComponent {

  readonly cooldownSeconds: ModelSignal<number> = model<number>(0);
  readonly maxPerStream: ModelSignal<number> = model<number>(0);
  readonly maxPerUserPerStream: ModelSignal<number> = model<number>(0);

  readonly disabled: InputSignal<boolean> = input<boolean>(false);
  readonly group: InputSignal<string> = input<string>('limits');

  protected readonly units: readonly DurationUnit[] = DURATION_UNITS;

  protected readonly unit: WritableSignal<number> = signal(60);

  protected readonly amount: Signal<number> = computed((): number => this.cooldownSeconds() / this.unit());

  protected readonly maxAmount: Signal<number> = computed((): number => Math.floor(COOLDOWN_MAX_SECONDS / this.unit()));

  protected readonly invalid: Signal<boolean> = computed((): boolean => {
    const seconds: number = this.cooldownSeconds();
    return !Number.isFinite(seconds) || seconds < 0 || seconds > COOLDOWN_MAX_SECONDS;
  });

  private written: number | null = null;

  constructor() {
    effect((): void => {
      const seconds: number = this.cooldownSeconds();

      untracked((): void => {
        if (seconds === this.written || seconds <= 0) return;
        this.unit.set(bestUnit(seconds).seconds);
      });
    });
  }

  protected setAmount(value: number): void {
    this.commit(Math.max(0, Math.floor(value)) * this.unit());
  }

  protected setUnit(seconds: number): void {
    const amount: number = Math.floor(this.amount());

    this.unit.set(seconds);
    this.commit(amount * seconds);
  }

  protected setPerStream(value: number): void {
    this.maxPerStream.set(Math.max(0, Math.floor(value)));
  }

  protected setPerUser(value: number): void {
    this.maxPerUserPerStream.set(Math.max(0, Math.floor(value)));
  }

  private commit(seconds: number): void {
    this.written = seconds;
    this.cooldownSeconds.set(seconds);
  }
}