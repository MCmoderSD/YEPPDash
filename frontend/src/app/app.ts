import { DOCUMENT } from '@angular/common';
import { Component, computed, ElementRef, inject, Signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { NavbarComponent } from '../components/navbar-component/navbar.component';
import { FooterComponent } from '../components/footer-component/footer.component';
import { NotificationsComponent } from '../components/notifications-component/notifications.component';
import { PageScrollBarComponent } from '../components/page-scroll-bar-component/page-scroll-bar.component';
import { isOverlayUrl } from '../data/overlay';

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

  protected readonly chrome: Signal<boolean> = computed((): boolean => !isOverlayUrl(this.url()));

  private readonly footer: Signal<ElementRef<HTMLElement> | undefined> =
    viewChild('footer', { read: ElementRef });

  protected readonly footerElement: Signal<HTMLElement | null> =
    computed((): HTMLElement | null => this.footer()?.nativeElement ?? null);
}