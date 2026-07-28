import { Component, inject, signal, Signal, WritableSignal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { TwitchService } from '../../services/twitch.service';
import { TwitchUser } from '../../data/twitch-user';

@Component({
  selector: 'app-user-info-dialog',
  templateUrl: './user-info-dialog.component.html',
  styleUrl: './user-info-dialog.component.scss',
  standalone: false,
})
export class UserInfoDialogComponent {

  private readonly twitch: TwitchService = inject(TwitchService);

  protected readonly user: TwitchUser = inject<TwitchUser>(MAT_DIALOG_DATA);

  private readonly color: WritableSignal<string | null> = signal<string | null>(null);

  protected readonly chatColor: Signal<string | null> = this.color.asReadonly();

  constructor() {
    void this.loadChatColor();
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
}