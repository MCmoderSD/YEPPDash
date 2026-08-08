import { Component, inject, Signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { TwitchUser } from '../../data/twitch-user';
import { NAV_GROUPS, NavGroup } from '../../data/dash-nav';

@Component({
  selector: 'app-dash-home-page',
  templateUrl: './dash-home-page.component.html',
  styleUrl: './dash-home-page.component.scss',
  standalone: false,
})
export class DashHomePageComponent {

  private readonly auth: AuthService = inject(AuthService);

  protected readonly botUserId: string = environment.botUserId;

  protected readonly user: Signal<TwitchUser | null> = this.auth.currentUser;

  protected readonly groups: readonly NavGroup[] = NAV_GROUPS;
}