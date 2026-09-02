import { DecimalPipe, NgOptimizedImage } from '@angular/common';
import { Component, input, InputSignal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-reward-tile',
  templateUrl: './reward-tile.component.html',
  styleUrl: './reward-tile.component.scss',
  imports: [DecimalPipe, NgOptimizedImage, MatIconModule],
})
export class RewardTileComponent {

  readonly image: InputSignal<string> = input.required<string>();
  readonly cost: InputSignal<number> = input.required<number>();

  readonly color: InputSignal<string> = input<string>('#9147FF');
  readonly large: InputSignal<boolean> = input<boolean>(false);
  readonly missing: InputSignal<boolean> = input<boolean>(false);
}