import { Component, computed, inject, Signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { UserMenuComponent } from '../user-menu-component/user-menu.component';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';
import { faqLink } from '../../services/dash-host';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  imports: [RouterLink, MatButtonModule, MatIconModule, UserMenuComponent],
})
export class NavbarComponent {
  protected readonly auth: AuthService = inject(AuthService);
  protected readonly sidebar: SidebarService = inject(SidebarService);
  protected readonly loginUrl: string = this.auth.loginUrl(environment.production ? '/' : '/dash');
  protected readonly faqUrl: string | null = faqLink();
  protected readonly pending: Signal<boolean> = computed((): boolean => this.auth.pending() && !this.auth.currentUser());
}