import { DOCUMENT } from '@angular/common';
import { Component, computed, ElementRef, inject, Signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { NavbarComponent } from '../components/navbar-component/navbar.component';
import { FooterComponent } from '../components/footer-component/footer.component';
import { NotificationsComponent } from '../components/notifications-component/notifications.component';
import { PageScrollBarComponent } from '../components/page-scroll-bar-component/page-scroll-bar.component';
import { isWheelOverlayUrl } from '../data/wheel-overlay';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  imports: [RouterOutlet, NavbarComponent, FooterComponent, NotificationsComponent, PageScrollBarComponent],
})
export class App {

  private readonly router: Router = inject(Router);
  private readonly document: Document = inject(DOCUMENT);

  private readonly url: Signal<string> = toSignal(
    this.router.events.pipe(
      filter((event: unknown): event is NavigationEnd => event instanceof NavigationEnd),
      map((event: NavigationEnd): string => event.urlAfterRedirects),
    ),
    { initialValue: this.document.location?.pathname ?? '/' },
  );

  protected readonly chrome: Signal<boolean> = computed((): boolean => !isWheelOverlayUrl(this.url()));

  // Handed to the page's scroll bar so it can stop above the footer instead of running behind it.
  // Resolved here rather than looked up from inside that component: this is the one place that
  // knows what the page is made of, and the bar stays usable without a footer at all.
  // `read` matters: a bare viewChild on a component's element hands back the component instance,
  // not the element it sits on, and the type annotation alone would not say so.
  private readonly footer: Signal<ElementRef<HTMLElement> | undefined> =
    viewChild('footer', { read: ElementRef });

  protected readonly footerElement: Signal<HTMLElement | null> =
    computed((): HTMLElement | null => this.footer()?.nativeElement ?? null);
}