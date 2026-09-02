import { Component, input, InputSignal, model, ModelSignal } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ColorPickerComponent } from '../color-picker-component/color-picker.component';

@Component({
  selector: 'app-reward-switches',
  templateUrl: './reward-switches.component.html',
  styleUrl: './reward-switches.component.scss',
  imports: [MatMenuModule, MatSlideToggleModule, MatTooltipModule, ColorPickerComponent],
})
export class RewardSwitchesComponent {

  readonly enabled: ModelSignal<boolean> = model<boolean>(false);
  readonly color: ModelSignal<string> = model<string>('#9147FF');

  readonly enabledLocked: InputSignal<boolean> = input<boolean>(false);
  readonly enabledHint: InputSignal<string> = input<string>('');
  readonly colorLocked: InputSignal<boolean> = input<boolean>(false);
  readonly group: InputSignal<string> = input<string>('reward');

  protected labelId(): string {
    return `${this.group()}-colour-label`;
  }
}