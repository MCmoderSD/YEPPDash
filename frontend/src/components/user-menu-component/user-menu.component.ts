import { Component, inject, input, InputSignal, Signal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { TwitchService } from '../../services/twitch.service';
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

  readonly user:InputSignal<TwitchUser> = input.required<TwitchUser>();

  // AuthService.ensureLoaded() kicks this off in parallel with /me, so it is usually
  // already resolved by the time this component exists at all.
  protected readonly chatColor: Signal<string | null> = this.twitch.chatColor;

  protected async logout(): Promise<void> {
    await this.auth.logout();
    location.href = '/';
  }
}