import { Component, inject, input, InputSignal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { TwitchUser } from '../../data/twitch-user';

@Component({
  selector: 'app-user-menu',
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.scss',
  standalone: false,
})
export class UserMenuComponent {

  private readonly auth: AuthService = inject(AuthService);

  readonly user:InputSignal<TwitchUser> = input.required<TwitchUser>();

  protected async logout(): Promise<void> {
    await this.auth.logout();
    location.href = '/';
  }
}