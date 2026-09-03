import { NgOptimizedImage } from '@angular/common';
import { Component, inject, input, InputSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { UserBadgesComponent } from '../user-badges-component/user-badges.component';
import { UserInfoDialogComponent } from '../user-info-dialog-component/user-info-dialog.component';
import { TwitchUser } from '../../data/twitch-user';

@Component({
  selector: 'app-user-identity',
  templateUrl: './user-identity.component.html',
  styleUrl: './user-identity.component.scss',
  imports: [NgOptimizedImage, UserBadgesComponent],
  host: {
    '[class.user-identity-wrap]': 'wrap()',
  },
})
export class UserIdentityComponent {

  private readonly dialog: MatDialog = inject(MatDialog);

  readonly user: InputSignal<TwitchUser | null> = input.required<TwitchUser | null>();

  readonly name: InputSignal<string> = input<string>('');
  readonly wrap: InputSignal<boolean> = input<boolean>(false);

  protected show(user: TwitchUser, event: Event): void {
    event.stopPropagation();
    UserInfoDialogComponent.open(this.dialog, user);
  }
}