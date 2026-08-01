import { Component, computed, input, InputSignal, Signal } from '@angular/core';
import { BadgeComponent } from '../badge-component/badge.component';
import { TwitchUser } from '../../data/twitch-user';
import { RoleBadge, roleBadges } from '../../data/user-roles';

// Kept out of the button it usually sits next to: those carry an aria-label naming the whole
// control, which would swallow every badge nested inside them.
@Component({
  selector: 'app-user-badges',
  imports: [BadgeComponent],
  template: `
    @if (badges().length > 0) {
      <ul class="user-badges" [attr.aria-label]="'Roles of ' + user().displayName">
        @for (badge of badges(); track badge.label ?? badge.preset) {
          <li>
            <app-badge [preset]="badge.preset" [label]="badge.label" />
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

  protected readonly badges: Signal<RoleBadge[]> = computed((): RoleBadge[] => {
    const user: TwitchUser = this.user();
    return user.roles ? roleBadges(user.roles) : [];
  });
}
