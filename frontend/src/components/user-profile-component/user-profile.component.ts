import { Component, input, InputSignal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { UserBadgesComponent } from '../user-badges-component/user-badges.component';
import { TwitchUser } from '../../data/twitch-user';
import { BadgeSize } from '../../data/badge';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss',
  imports: [NgOptimizedImage, UserBadgesComponent],
})
export class UserProfileComponent {

  readonly user: InputSignal<TwitchUser> = input.required<TwitchUser>();

  protected readonly badgeSize: BadgeSize = BadgeSize.Medium;
}