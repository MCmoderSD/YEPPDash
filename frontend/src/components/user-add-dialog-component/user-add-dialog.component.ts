import { Component, inject, signal, Signal, WritableSignal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TwitchService } from '../../services/twitch.service';
import { TwitchUser } from '../../data/twitch-user';

export interface UserAddDialogData {
  title: string;
}

@Component({
  selector: 'app-user-add-dialog',
  templateUrl: './user-add-dialog.component.html',
  styleUrl: './user-add-dialog.component.scss',
  imports: [NgOptimizedImage, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule],
})
export class UserAddDialogComponent {

  private readonly twitch: TwitchService = inject(TwitchService);
  private readonly dialogRef: MatDialogRef<UserAddDialogComponent, TwitchUser> = inject<MatDialogRef<UserAddDialogComponent, TwitchUser>>(MatDialogRef);

  protected readonly data: UserAddDialogData = inject<UserAddDialogData>(MAT_DIALOG_DATA);

  private readonly found: WritableSignal<TwitchUser | null> = signal<TwitchUser | null>(null);
  private readonly color: WritableSignal<string | null> = signal<string | null>(null);
  private readonly term: WritableSignal<string> = signal('');
  private readonly state: WritableSignal<'idle' | 'searching' | 'empty' | 'failed'> = signal('idle');

  protected readonly user: Signal<TwitchUser | null> = this.found.asReadonly();
  protected readonly chatColor: Signal<string | null> = this.color.asReadonly();
  protected readonly query: Signal<string> = this.term.asReadonly();
  protected readonly status: Signal<'idle' | 'searching' | 'empty' | 'failed'> = this.state.asReadonly();

  static open(dialog: MatDialog, title: string): MatDialogRef<UserAddDialogComponent, TwitchUser> {
    return dialog.open<UserAddDialogComponent, UserAddDialogData, TwitchUser>(UserAddDialogComponent, {
      data: { title },
      width: '33vw',
      minWidth: 'min(22rem, 92vw)',
      maxWidth: '92vw',
    });
  }

  protected submit(event: Event, input: HTMLInputElement): void {
    event.preventDefault();
    void this.search(input.value);
  }

  protected add(): void {
    const user: TwitchUser | null = this.found();
    if (user) this.dialogRef.close(user);
  }

  private async search(value: string): Promise<void> {
    const term: string = value.trim();
    if (!term) return;

    this.term.set(term);
    this.found.set(null);
    this.color.set(null);
    this.state.set('searching');

    try {
      let [user] = await this.twitch.getUsers([], [term.toLowerCase()]);

      if (!user && /^\d+$/.test(term)) {
        [user] = await this.twitch.getUsers([term], []);
      }

      if (!user) {
        this.state.set('empty');
        return;
      }

      this.found.set(user);
      this.state.set('idle');
      this.color.set(user.color ?? null);
    } catch {
      this.state.set('failed');
    }
  }
}