import { Directive, inject, input, InputSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { UserInfoDialogComponent } from '../components/user-info-dialog-component/user-info-dialog.component';
import { TwitchUser } from '../data/twitch-user';

@Directive({
  selector: '[appUserDetails]',
  host: {
    '[class.app-table-row-link]': 'appUserDetails() !== null',
    '(click)': 'open()',
  },
})
export class UserDetailsDirective {

  private readonly dialog: MatDialog = inject(MatDialog);

  readonly appUserDetails: InputSignal<TwitchUser | null> = input.required<TwitchUser | null>();

  protected open(): void {
    const user: TwitchUser | null = this.appUserDetails();
    if (user) UserInfoDialogComponent.open(this.dialog, user);
  }
}