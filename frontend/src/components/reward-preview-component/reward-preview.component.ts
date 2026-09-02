import { Component, input, InputSignal } from '@angular/core';
import { RewardTileComponent } from '../reward-tile-component/reward-tile.component';

const TWITCH_REWARDS: string = 'https://dashboard.twitch.tv/viewer-rewards/channel-points/rewards';

@Component({
  selector: 'app-reward-preview',
  templateUrl: './reward-preview.component.html',
  styleUrl: './reward-preview.component.scss',
  imports: [RewardTileComponent],
})
export class RewardPreviewComponent {

  readonly image: InputSignal<string> = input.required<string>();
  readonly cost: InputSignal<number> = input.required<number>();
  readonly color: InputSignal<string> = input.required<string>();

  readonly name: InputSignal<string> = input<string>('');
  readonly placeholder: InputSignal<string> = input<string>('Name the reward');
  readonly heading: InputSignal<string> = input<string>('What your viewers will see:');

  protected readonly rewards: string = TWITCH_REWARDS;
}