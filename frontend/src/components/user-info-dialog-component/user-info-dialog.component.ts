import { Component, computed, inject, signal, Signal, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ScrollBarComponent } from '../scroll-bar-component/scroll-bar.component';
import { UserProfileComponent } from '../user-profile-component/user-profile.component';
import { LocaleDatePipe } from '../../pipes/locale-date.pipe';
import { BirthdayService } from '../../services/birthday.service';
import { Birthday, birthdayToDate } from '../../data/birthday';
import { TwitchUser } from '../../data/twitch-user';
import { openDialog } from '../../services/dialog';

@Component({
  selector: 'app-user-info-dialog',
  templateUrl: './user-info-dialog.component.html',
  styleUrl: './user-info-dialog.component.scss',
  imports: [MatButtonModule, MatDialogModule, ScrollBarComponent, UserProfileComponent, LocaleDatePipe],
})
export class UserInfoDialogComponent {

  private readonly birthdays: BirthdayService = inject(BirthdayService);

  protected readonly user: TwitchUser = inject<TwitchUser>(MAT_DIALOG_DATA);

  private readonly born: WritableSignal<Birthday | null> = signal<Birthday | null>(null);

  protected readonly pending: WritableSignal<boolean> = signal(true);

  protected readonly birthdayDate: Signal<Date | null> = computed((): Date | null => {
    const birthday: Birthday | null = this.born();
    return birthday ? birthdayToDate(birthday) : null;
  });

  constructor() {
    void this.loadBirthday();
  }

  static open(dialog: MatDialog, user: TwitchUser): MatDialogRef<UserInfoDialogComponent> {
    return openDialog<UserInfoDialogComponent, TwitchUser, void>(
      dialog, UserInfoDialogComponent, user, { width: '33vw' });
  }

  private async loadBirthday(): Promise<void> {
    try {
      this.born.set(await this.birthdays.getBirthday(this.user.id));
    } catch {
      this.born.set(null);
    } finally {
      this.pending.set(false);
    }
  }
}