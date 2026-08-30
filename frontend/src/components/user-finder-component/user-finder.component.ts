import { Component, inject, model, ModelSignal, signal, Signal, WritableSignal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { UserBadgesComponent } from '../user-badges-component/user-badges.component';
import { TwitchService } from '../../services/twitch.service';
import { TwitchUser } from '../../data/twitch-user';
import { BadgeSize } from '../../data/badge';

export type UserFinderState = 'idle' | 'searching' | 'empty' | 'failed';

@Component({
  selector: 'app-user-finder',
  templateUrl: './user-finder.component.html',
  styleUrl: './user-finder.component.scss',
  imports: [NgOptimizedImage, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule, UserBadgesComponent],
})
export class UserFinderComponent {

  private readonly twitch: TwitchService = inject(TwitchService);

  readonly user: ModelSignal<TwitchUser | null> = model<TwitchUser | null>(null);

  protected readonly badgeSize: BadgeSize = BadgeSize.Medium;

  private readonly term: WritableSignal<string> = signal('');
  private readonly state: WritableSignal<UserFinderState> = signal<UserFinderState>('idle');

  protected readonly query: Signal<string> = this.term.asReadonly();
  protected readonly status: Signal<UserFinderState> = this.state.asReadonly();

  protected submit(event: Event, input: HTMLInputElement): void {
    event.preventDefault();
    void this.search(input.value);
  }

  private async search(value: string): Promise<void> {
    const term: string = value.trim();
    if (!term) return;

    this.term.set(term);
    this.user.set(null);
    this.state.set('searching');

    try {
      let [found] = await this.twitch.getUsers([], [term.toLowerCase()]);

      if (!found && /^\d+$/.test(term)) {
        [found] = await this.twitch.getUsers([term], []);
      }

      if (!found) {
        this.state.set('empty');
        return;
      }

      this.user.set(found);
      this.state.set('idle');
    } catch {
      this.state.set('failed');
    }
  }
}