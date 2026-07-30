import { Component, computed, inject, signal, Signal, WritableSignal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { BirthdayService } from '../../services/birthday.service';
import { TwitchService } from '../../services/twitch.service';
import { Birthday, birthdayToDate } from '../../data/birthday';
import { TwitchUser } from '../../data/twitch-user';

@Component({
  selector: 'app-user-info-dialog',
  templateUrl: './user-info-dialog.component.html',
  styleUrl: './user-info-dialog.component.scss',
  standalone: false,
})
export class UserInfoDialogComponent {

  private readonly twitch: TwitchService = inject(TwitchService);
  private readonly birthdays: BirthdayService = inject(BirthdayService);

  protected readonly user: TwitchUser = inject<TwitchUser>(MAT_DIALOG_DATA);

  private readonly color: WritableSignal<string | null> = signal<string | null>(null);

  private readonly born: WritableSignal<Birthday | null> = signal<Birthday | null>(null);

  protected readonly chatColor: Signal<string | null> = this.color.asReadonly();

  protected readonly birthdayDate: Signal<Date | null> = computed((): Date | null => {
    const birthday: Birthday | null = this.born();
    return birthday ? birthdayToDate(birthday) : null;
  });

  constructor() {
    void this.loadChatColor();
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

  private async loadChatColor(): Promise<void> {
    this.color.set(await this.twitch.getChatColor(this.user.id));
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
