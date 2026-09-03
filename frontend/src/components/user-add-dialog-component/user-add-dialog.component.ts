import { Component, computed, inject, signal, Signal, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ScrollBarComponent } from '../scroll-bar-component/scroll-bar.component';
import { UserFinderComponent } from '../user-finder-component/user-finder.component';
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
  imports: [NoticeComponent, MatButtonModule, MatDialogModule, MatIconModule, ScrollBarComponent, UserFinderComponent],
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

  protected readonly valid: Signal<boolean> = computed(
    (): boolean => this.found() !== null && !this.alreadyHas() && !this.broadcaster(),
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