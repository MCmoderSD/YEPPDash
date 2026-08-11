import { Component, computed, effect, inject, input, InputSignal, Signal, signal, WritableSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IsActiveMatchOptions, NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { filter, map } from 'rxjs';
import { SidebarService } from '../../services/sidebar.service';
import { groupForUrl, NAV_GROUPS, NavGroup, OVERVIEW_PATH } from '../../data/dash-nav';

const ACTIVE_MATCH: IsActiveMatchOptions = {
  paths: 'exact',
  queryParams: 'exact',
  matrixParams: 'ignored',
  fragment: 'ignored',
};

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  imports: [RouterLink, RouterLinkActive, MatIconModule],
})
export class SidebarComponent {

  // Collapsed to icons only. Every label stays in the markup either way — an icon on its own gives
  // a screen reader nothing to announce — and is taken off the screen in CSS.
  readonly rail: InputSignal<boolean> = input(false);

  private readonly sidebar: SidebarService = inject(SidebarService);
  private readonly router: Router = inject(Router);

  protected readonly activeMatch: IsActiveMatchOptions = ACTIVE_MATCH;

  protected readonly overviewPath: string = OVERVIEW_PATH;

  protected readonly groups: readonly NavGroup[] = NAV_GROUPS;


  private readonly collapsed: WritableSignal<ReadonlySet<string>> = signal(new Set<string>());

  private readonly url: Signal<string> = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event: NavigationEnd): string => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  private readonly activeGroup: Signal<string | undefined> =
    computed((): string | undefined => groupForUrl(this.groups, this.url()));

  constructor() {
    effect((): void => {
      const active: string | undefined = this.activeGroup();
      if (!active) return;

      this.collapsed.update((collapsed: ReadonlySet<string>): ReadonlySet<string> => {
        if (!collapsed.has(active)) return collapsed;

        const next = new Set(collapsed);
        next.delete(active);
        return next;
      });
    });
  }

  // Shut groups stay shut, except in the rail: there the strip is only worth having if every icon
  // is on it, and a group's own heading is down to an icon too small to explain what it hides.
  protected expanded(group: NavGroup): boolean {
    return this.rail() || !this.collapsed().has(group.id);
  }

  protected toggle(group: NavGroup): void {
    this.collapsed.update((collapsed: ReadonlySet<string>): ReadonlySet<string> => {
      const next = new Set(collapsed);
      next.has(group.id) ? next.delete(group.id) : next.add(group.id);
      return next;
    });
  }

  protected close(): void {
    this.sidebar.close();
  }
}