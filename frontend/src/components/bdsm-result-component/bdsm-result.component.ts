import { Component, computed, input, InputSignal, Signal } from '@angular/core';
import { BdsmResult, BdsmTraitScore, rankedTraits } from '../../data/bdsm-result';

@Component({
  selector: 'app-bdsm-result',
  templateUrl: './bdsm-result.component.html',
  styleUrl: './bdsm-result.component.scss',
  standalone: false,
})
export class BdsmResultComponent {

  readonly result: InputSignal<BdsmResult> = input.required<BdsmResult>();

  protected readonly traits: Signal<BdsmTraitScore[]> = computed(
    (): BdsmTraitScore[] => rankedTraits(this.result()),
  );
}