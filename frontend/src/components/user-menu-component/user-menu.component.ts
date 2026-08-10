import { Component, computed, effect, inject, input, InputSignal, Signal, signal, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { faqLink } from '../../services/dash-host';
import { BirthdayService } from '../../services/birthday.service';
import { NotificationService } from '../../services/notification.service';
import { TwitchService } from '../../services/twitch.service';
import { Birthday, BirthdayDraft, birthdayToDate } from '../../data/birthday';
import { TwitchUser } from '../../data/twitch-user';

@Component({
  selector: 'app-user-menu',
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.scss',
  standalone: false,
})
export class UserMenuComponent {

  private readonly auth: AuthService = inject(AuthService);
  private readonly twitch: TwitchService = inject(TwitchService);
  private readonly birthdays: BirthdayService = inject(BirthdayService);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly dialog: MatDialog = inject(MatDialog);

  readonly user:InputSignal<TwitchUser> = input.required<TwitchUser>();

  protected readonly faqUrl: string | null = faqLink();

  protected readonly chatColor: Signal<string | null> = this.twitch.chatColor;

  private readonly stored: WritableSignal<Birthday | null> = signal<Birthday | null>(null);

  protected readonly birthday: Signal<Birthday | null> = this.stored.asReadonly();

  protected readonly birthdayDate: Signal<Date | null> = computed((): Date | null => {
    const birthday: Birthday | null = this.birthday();
    return birthday ? birthdayToDate(birthday) : null;
  });

  constructor() {
    effect((): void => void this.load(this.user().id));
  }

  protected async editBirthday(): Promise<void> {
    const { BirthdayEditDialogComponent } = await import(
      '../birthday-edit-dialog-component/birthday-edit-dialog.component'
    );

    const draft: BirthdayDraft | undefined = await firstValueFrom(
      BirthdayEditDialogComponent.open(this.dialog, this.birthday()).afterClosed(),
    );

    if (!draft) return;
    await this.save(draft);
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    location.href = '/';
  }

  private async save(draft: BirthdayDraft): Promise<void> {
    const userId: string = this.user().id;

    try {
      this.stored.set(this.birthday()
        ? await this.birthdays.updateBirthday(userId, draft)
        : await this.birthdays.addBirthday(userId, draft));

      this.notifications.success('Saved your birthday.');
    } catch {
      this.notifications.failure('Could not save your birthday.');
    }
  }

  private async load(userId: string): Promise<void> {
    try {
      this.stored.set(await this.birthdays.getBirthday(userId));
    } catch {
      this.stored.set(null);
    }
  }
}