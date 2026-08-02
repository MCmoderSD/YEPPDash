import { Component, computed, inject, signal, Signal, WritableSignal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { BirthdayService } from '../../services/birthday.service';
import { Birthday, birthdayToDate } from '../../data/birthday';
import { TwitchUser } from '../../data/twitch-user';
import { BadgeSize } from '../../data/badge';

@Component({
  selector: 'app-user-info-dialog',
  templateUrl: './user-info-dialog.component.html',
  styleUrl: './user-info-dialog.component.scss',
  standalone: false,
})
export class UserInfoDialogComponent {

  private readonly birthdays: BirthdayService = inject(BirthdayService);

  protected readonly user: TwitchUser = inject<TwitchUser>(MAT_DIALOG_DATA);

  private readonly born: WritableSignal<Birthday | null> = signal<Birthday | null>(null);

  protected readonly chatColor: string | null = this.user.color ?? null;

  // Bigger than in a list: the dialog is where a profile is read rather than scanned, and the name
  // beside them is a headline rather than a table row.
  protected readonly badgeSize: BadgeSize = BadgeSize.Medium;

  protected readonly birthdayDate: Signal<Date | null> = computed((): Date | null => {
    const birthday: Birthday | null = this.born();
    return birthday ? birthdayToDate(birthday) : null;
  });

  constructor() {
    void this.loadBirthday();
  }

  static open(dialog: MatDialog, user: TwitchUser): MatDialogRef<UserInfoDialogComponent> {
    return dialog.open(UserInfoDialogComponent, {
      data: user,
      width: '33vw',
      minWidth: 'min(22rem, 92vw)',
      maxWidth: '92vw',
    });
  }

  // Read only here: anybody signed in may look a birthday up, but only its owner may change it, and
  // this dialog is opened for other people. Changing your own lives in the account menu.
  private async loadBirthday(): Promise<void> {
    try {
      this.born.set(await this.birthdays.getBirthday(this.user.id));
    } catch {
      this.born.set(null);
    }
  }
}
