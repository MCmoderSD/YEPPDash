import { Component, computed, input, InputSignal, model, ModelSignal, Signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { NumberStepperComponent } from '../number-stepper-component/number-stepper.component';
import { costText, parseCost, REWARD_PROMPT_MAX, REWARD_TITLE_MAX } from '../../data/custom-reward';

@Component({
  selector: 'app-reward-fields',
  templateUrl: './reward-fields.component.html',
  styleUrl: './reward-fields.component.scss',
  imports: [MatFormFieldModule, MatInputModule, NumberStepperComponent],
})
export class RewardFieldsComponent {

  readonly title: ModelSignal<string> = model<string>('');
  readonly cost: ModelSignal<number> = model<number>(0);
  readonly description: ModelSignal<string> = model<string>('');

  readonly disabled: InputSignal<boolean> = input<boolean>(false);
  readonly costHint: InputSignal<string> = input<string>('Channel points per redemption');

  protected readonly maxTitleLength: number = REWARD_TITLE_MAX;
  protected readonly maxDescriptionLength: number = REWARD_PROMPT_MAX;

  protected readonly costText: Signal<string> = computed((): string => costText(this.cost()));
  protected readonly titleLeft: Signal<number> = computed((): number => REWARD_TITLE_MAX - this.title().length);
  protected readonly descriptionLeft: Signal<number> = computed((): number => REWARD_PROMPT_MAX - this.description().length);

  protected setCost(value: string): void {
    this.cost.set(parseCost(value));
  }
}