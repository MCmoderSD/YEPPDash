import { Component, computed, input, InputSignal, output, OutputEmitterRef, Signal } from '@angular/core';

@Component({
  selector: 'app-number-stepper',
  templateUrl: './number-stepper.component.html',
  styleUrl: './number-stepper.component.scss',
})
export class NumberStepperComponent {

  readonly value: InputSignal<number> = input.required<number>();
  readonly min: InputSignal<number> = input(Number.NEGATIVE_INFINITY);
  readonly max: InputSignal<number> = input(Number.POSITIVE_INFINITY);
  readonly step: InputSignal<number> = input(1);

  readonly valueChange: OutputEmitterRef<number> = output<number>();

  protected readonly atMin: Signal<boolean> = computed((): boolean => this.value() <= this.min());
  protected readonly atMax: Signal<boolean> = computed((): boolean => this.value() >= this.max());

  protected nudge(direction: number): void {
    const stepped: number = this.value() + direction * this.step();
    this.valueChange.emit(Math.min(this.max(), Math.max(this.min(), stepped)));
  }
}