import { Component, computed, ElementRef, inject, Signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { UserMenuComponent } from '../user-menu-component/user-menu.component';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';
import { FaqDrawerService } from '../../services/faq-drawer.service';
import { dashboardLink, faqLink } from '../../services/dash-host';
import { OVERVIEW_PATH } from '../../data/dash-nav';
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
  protected readonly faq: FaqDrawerService = inject(FaqDrawerService);
  protected readonly loginUrl: string = this.auth.loginUrl(environment.production ? '/' : '/dash');
  protected readonly faqUrl: string | null = faqLink();
  protected readonly dashboardUrl: string | null = dashboardLink();
  protected readonly overviewPath: string = OVERVIEW_PATH;
  protected readonly pending: Signal<boolean> = computed((): boolean => this.auth.pending() && !this.auth.currentUser());

  protected readonly navigating: Signal<boolean> = toSignal(
    inject(Router).events.pipe(
      filter((event: unknown): boolean =>
        event instanceof NavigationStart
        || event instanceof NavigationEnd
        || event instanceof NavigationCancel
        || event instanceof NavigationError),
      map((event: unknown): boolean => event instanceof NavigationStart),
    ),
    { initialValue: true },
  );

  private readonly trigger: Signal<ElementRef<HTMLElement> | undefined> =
    viewChild('trigger', { read: ElementRef<HTMLElement> });

  protected toggleFaq(): void {
    this.faq.toggle(this.trigger()?.nativeElement);
  }
}