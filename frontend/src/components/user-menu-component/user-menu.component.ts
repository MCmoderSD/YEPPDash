import { Component, inject, input } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { TwitchUser } from '../../data/twitch-user';

@Component({
  selector: 'app-user-menu',
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.scss',
  standalone: false,
})
export class UserMenuComponent {
  private readonly auth = inject(AuthService);

  readonly user = input.required<TwitchUser>();

  protected async logout(): Promise<void> {
    await this.auth.logout();
    location.href = '/';
  }
}
