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

  private readonly url: Signal<string> = toSignal(
    this.router.events.pipe(
      filter((event: unknown): event is NavigationEnd => event instanceof NavigationEnd),
      map((event: NavigationEnd): string => event.urlAfterRedirects),
    ),
    { initialValue: this.document.location?.pathname ?? '/' },
  );

  protected readonly chrome: Signal<boolean> = computed((): boolean => !isWheelOverlayUrl(this.url()));
}