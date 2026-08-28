import { Component, computed, inject, signal, Signal, WritableSignal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { UserBadgesComponent } from '../user-badges-component/user-badges.component';
import { LocaleDatePipe } from '../../pipes/locale-date.pipe';
import { BirthdayService } from '../../services/birthday.service';
import { Birthday, birthdayToDate } from '../../data/birthday';
import { TwitchUser } from '../../data/twitch-user';
import { BadgeSize } from '../../data/badge';

@Component({
  selector: 'app-user-info-dialog',
  templateUrl: './user-info-dialog.component.html',
  styleUrl: './user-info-dialog.component.scss',
  imports: [NgOptimizedImage, MatButtonModule, MatDialogModule, UserBadgesComponent, LocaleDatePipe],
})
export class UserInfoDialogComponent {

  private readonly birthdays: BirthdayService = inject(BirthdayService);

  protected readonly user: TwitchUser = inject<TwitchUser>(MAT_DIALOG_DATA);

  private readonly born: WritableSignal<Birthday | null> = signal<Birthday | null>(null);

  protected readonly pending: WritableSignal<boolean> = signal(true);

  protected readonly chatColor: string | null = this.user.color ?? null;

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