import { Component, inject, signal, Signal, WritableSignal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { TwitchService } from '../../services/twitch.service';
import { TwitchUser } from '../../data/twitch-user';

export interface UserAddDialogData {
  // What the caller is adding someone as — only ever shown, never acted on.
  role: string;
}

@Component({
  selector: 'app-user-add-dialog',
  templateUrl: './user-add-dialog.component.html',
  styleUrl: './user-add-dialog.component.scss',
  standalone: false,
})
export class UserAddDialogComponent {

  private readonly twitch: TwitchService = inject(TwitchService);
  private readonly dialogRef: MatDialogRef<UserAddDialogComponent, TwitchUser> =
    inject<MatDialogRef<UserAddDialogComponent, TwitchUser>>(MatDialogRef);

  protected readonly data: UserAddDialogData = inject<UserAddDialogData>(MAT_DIALOG_DATA);

  private readonly found: WritableSignal<TwitchUser | null> = signal<TwitchUser | null>(null);
  private readonly color: WritableSignal<string | null> = signal<string | null>(null);
  private readonly term: WritableSignal<string> = signal('');
  private readonly state: WritableSignal<'idle' | 'searching' | 'empty' | 'failed'> = signal('idle');

  protected readonly user: Signal<TwitchUser | null> = this.found.asReadonly();
  protected readonly chatColor: Signal<string | null> = this.color.asReadonly();
  protected readonly query: Signal<string> = this.term.asReadonly();
  protected readonly status: Signal<'idle' | 'searching' | 'empty' | 'failed'> = this.state.asReadonly();

  // Same sizing rationale as the details dialog: the caller should not have to know how wide it
  // wants to be, and a third of a phone screen is unusable.
  static open(dialog: MatDialog, role: string): MatDialogRef<UserAddDialogComponent, TwitchUser> {
    return dialog.open<UserAddDialogComponent, UserAddDialogData, TwitchUser>(UserAddDialogComponent, {
      data: { role },
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
      // Twitch logins are lowercase, so lowercasing the term is what makes the search
      // case-insensitive — Helix matches the login exactly as given.
      let [user] = await this.twitch.getUsers([], [term.toLowerCase()]);

      // A purely numeric term is ambiguous: it is a valid login shape and a valid id. The login
      // wins when it exists, and only when it does not is the same term retried as an id.
      if (!user && /^\d+$/.test(term)) {
        [user] = await this.twitch.getUsers([term], []);
      }

      if (!user) {
        this.state.set('empty');
        return;
      }

      this.found.set(user);
      this.state.set('idle');
      this.color.set(await this.twitch.getChatColor(user.id));
    } catch {
      this.state.set('failed');
    }
  }
}
