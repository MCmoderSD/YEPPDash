import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';
import { isDashHost } from '../../services/dash-host';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  standalone: false,
})
export class NavbarComponent {
  protected readonly auth: AuthService = inject(AuthService);
  protected readonly sidebar: SidebarService = inject(SidebarService);
  protected readonly loginUrl: string = this.auth.loginUrl(environment.production ? '/' : '/dash');
  protected readonly faqUrl: string | null = isDashHost() ? `${environment.marketingBaseUrl}/faq` : null;
}