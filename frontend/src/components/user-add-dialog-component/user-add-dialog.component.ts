import { Component, computed, inject, signal, Signal, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ScrollBarComponent } from '../scroll-bar-component/scroll-bar.component';
import { UserFinderComponent } from '../user-finder-component/user-finder.component';
import { BanNoticeComponent } from '../ban-notice-component/ban-notice.component';
import { BannedUser } from '../../data/banned-user';
import { TwitchUser } from '../../data/twitch-user';
import { NoticeComponent } from '../notice-component/notice.component';
import { openDialog } from '../../services/dialog';

export type ChannelRoleName = 'moderator' | 'VIP';

export interface UserAddDialogData {
  title: string;
  role: ChannelRoleName;
}

@Component({
  selector: 'app-user-add-dialog',
  templateUrl: './user-add-dialog.component.html',
  styleUrl: './user-add-dialog.component.scss',
  imports: [BanNoticeComponent, NoticeComponent, MatButtonModule, MatDialogModule, MatIconModule, ScrollBarComponent, UserFinderComponent],
})
export class UserAddDialogComponent {

  private readonly dialogRef: MatDialogRef<UserAddDialogComponent, TwitchUser> = inject<MatDialogRef<UserAddDialogComponent, TwitchUser>>(MatDialogRef);

  protected readonly data: UserAddDialogData = inject<UserAddDialogData>(MAT_DIALOG_DATA);

  protected readonly found: WritableSignal<TwitchUser | null> = signal<TwitchUser | null>(null);

  protected readonly alreadyHas: Signal<boolean> = computed((): boolean => {
    const roles = this.found()?.roles;
    return this.data.role === 'VIP' ? roles?.vip === true : roles?.moderator === true;
  });

  protected readonly swaps: Signal<boolean> = computed((): boolean => {
    const roles = this.found()?.roles;
    if (this.alreadyHas()) return false;

    return this.data.role === 'VIP' ? roles?.moderator === true : roles?.vip === true;
  });

  protected readonly otherRole: Signal<ChannelRoleName> = computed(
    (): ChannelRoleName => this.data.role === 'VIP' ? 'moderator' : 'VIP',
  );

  protected readonly broadcaster: Signal<boolean> = computed((): boolean => this.found()?.roles?.broadcaster === true);

  protected readonly restriction: WritableSignal<BannedUser | null> = signal<BannedUser | null>(null);

  protected readonly restrictionNote: Signal<string> = computed((): string => {
    const ban: BannedUser | null = this.restriction();
    if (ban === null) return '';

    const lift: string = ban.expiresAt === null ? 'Unban them' : 'Lift the timeout';

    return `Twitch does not hand a role to an account it is keeping out of the chat. ${lift} first, `
      + `then add them as a ${this.data.role}.`;
  });

  protected readonly valid: Signal<boolean> = computed(
    (): boolean => this.found() !== null && !this.alreadyHas() && !this.broadcaster() && this.restriction() === null,
  );

  static open(dialog: MatDialog, title: string, role: ChannelRoleName): MatDialogRef<UserAddDialogComponent, TwitchUser> {
    return openDialog<UserAddDialogComponent, UserAddDialogData, TwitchUser>(
      dialog, UserAddDialogComponent, { title, role }, { width: '33vw', minWidth: 'min(24rem, 92vw)' });
  }

  protected add(): void {
    const user: TwitchUser | null = this.found();
    if (user && this.valid()) this.dialogRef.close(user);
  }
}