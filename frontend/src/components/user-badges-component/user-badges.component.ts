import { Component, computed, input, InputSignal, Signal } from '@angular/core';
import { BadgeComponent } from '../badge-component/badge.component';
import { TwitchUser } from '../../data/twitch-user';
import { roleBadges } from '../../data/user-roles';
import { BadgePreset, BadgeSize, DEFAULT_BADGE_SIZE } from '../../data/badge';
import { environment } from '../../environments/environment';

// Kept out of the button it sits beside: those carry an aria-label naming the whole control, which
// would swallow every badge nested inside them.
@Component({
  selector: 'app-user-badges',
  imports: [BadgeComponent],
  template: `
    @if (badges().length > 0) {
      <ul class="user-badges" [attr.aria-label]="'Roles of ' + user().displayName">
        @for (preset of badges(); track preset) {
          <li>
            <app-badge [preset]="preset" [size]="size()" />
          </li>
        }
      </ul>
    }
  `,
  styles: `
    // Never wrapped: badges breaking onto a second line would make their row tower over the rest,
    // and every list that shows them scrolls sideways when it runs out of room.
    .user-badges {
      display: flex;
      flex: none;
      gap: 0.25rem;

      margin: 0;
      padding: 0;
      list-style: none;
    }
  `,
})
export class UserBadgesComponent {

  readonly user: InputSignal<TwitchUser> = input.required<TwitchUser>();

  readonly size: InputSignal<BadgeSize> = input<BadgeSize>(DEFAULT_BADGE_SIZE);

  protected readonly badges: Signal<BadgePreset[]> = computed((): BadgePreset[] => {
    const user: TwitchUser = this.user();
    return roleBadges(user.roles ?? null, user.id === environment.botUserId);
  });
}
