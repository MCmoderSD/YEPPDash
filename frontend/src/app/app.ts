import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { isWheelOverlayUrl } from '../data/wheel-overlay';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  standalone: false,
})
export class App {

  private readonly router: Router = inject(Router);
  private readonly document: Document = inject(DOCUMENT);

  // Seeded from the address bar rather than starting empty: the first navigation only ends after
  // the first render, and a navbar that flashes in for a frame is a navbar OBS can capture.
  private readonly url: Signal<string> = toSignal(
    this.router.events.pipe(
      filter((event: unknown): event is NavigationEnd => event instanceof NavigationEnd),
      map((event: NavigationEnd): string => event.urlAfterRedirects),
    ),
    { initialValue: this.document.location?.pathname ?? '/' },
  );

  // The overlay is a browser source in somebody's stream, so nothing that belongs to the dashboard
  // around it — navbar, footer, the notification stack — may be on screen.
  protected readonly chrome: Signal<boolean> = computed((): boolean => !isWheelOverlayUrl(this.url()));
}
