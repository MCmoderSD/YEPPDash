import { Component, computed, inject, Signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CardCarouselComponent } from '../../components/card-carousel-component/card-carousel.component';
import { BotManageComponent } from '../../components/bot-manage-component/bot-manage.component';
import { BroadcastOverviewComponent } from '../../components/broadcast-overview-component/broadcast-overview.component';
import { environment } from '../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { TwitchUser } from '../../data/twitch-user';
import { hasChannelPoints } from '../../data/broadcaster';
import { navGroupsFor, NavGroup } from '../../data/dash-nav';

@Component({
  selector: 'app-dash-home-page',
  templateUrl: './dash-home-page.component.html',
  styleUrl: './dash-home-page.component.scss',
  imports: [MatIconModule, BotManageComponent, BroadcastOverviewComponent, CardCarouselComponent],
})
export class DashHomePageComponent {

  private readonly auth: AuthService = inject(AuthService);

  protected readonly botUserId: string = environment.botUserId;

  protected readonly user: Signal<TwitchUser | null> = this.auth.currentUser;

  protected readonly groups: Signal<readonly NavGroup[]> = computed((): readonly NavGroup[] => navGroupsFor(hasChannelPoints(this.user())));
}