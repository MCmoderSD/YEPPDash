import { Component, computed, input, InputSignal, Signal } from '@angular/core';
import { BadgeComponent } from '../badge-component/badge.component';
import { TwitchUser } from '../../data/twitch-user';
import { roleBadges } from '../../data/user-roles';
import { BadgePreset, BadgeSize, DEFAULT_BADGE_SIZE } from '../../data/badge';
import { isBotUser } from '../../data/bot-users';

@Component({
  selector: 'app-user-badges',
  imports: [BadgeComponent],
  templateUrl: './user-badges.component.html',
  styleUrl: './user-badges.component.scss',
})
export class UserBadgesComponent {

  readonly user: InputSignal<TwitchUser> = input.required<TwitchUser>();

  readonly size: InputSignal<BadgeSize> = input<BadgeSize>(DEFAULT_BADGE_SIZE);

  protected readonly badges: Signal<BadgePreset[]> = computed((): BadgePreset[] => {
    const user: TwitchUser = this.user();
    return roleBadges(user.roles ?? null, isBotUser(user.id));
  });
}
