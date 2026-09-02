import { Component, inject, signal, WritableSignal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ScrollBarComponent } from '../scroll-bar-component/scroll-bar.component';
import { UserTableComponent } from '../user-table-component/user-table.component';
import { TwitchUser } from '../../data/twitch-user';

export interface UserListDialogData {
  title: string;
  load: () => Promise<TwitchUser[]>;
  expected?: number | null;
  failure?: string;
  showId?: boolean;
}

@Component({
  selector: 'app-user-list-dialog',
  templateUrl: './user-list-dialog.component.html',
  styleUrl: './user-list-dialog.component.scss',
  imports: [MatDialogModule, ScrollBarComponent, UserTableComponent],
})
export class UserListDialogComponent {

  protected readonly data: UserListDialogData = inject<UserListDialogData>(MAT_DIALOG_DATA);

  protected readonly users: WritableSignal<TwitchUser[]> = signal<TwitchUser[]>([]);
  protected readonly loading: WritableSignal<boolean> = signal(true);
  protected readonly failed: WritableSignal<boolean> = signal(false);

  constructor() {
    void this.load();
  }

  static open(dialog: MatDialog, data: UserListDialogData): MatDialogRef<UserListDialogComponent> {
    return dialog.open(UserListDialogComponent, {
      data,
      width: '39rem',
      minWidth: 'min(22rem, 92vw)',
      maxWidth: '92vw'
    });
  }

  private async load(): Promise<void> {
    try {
      this.users.set(await this.data.load());
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}