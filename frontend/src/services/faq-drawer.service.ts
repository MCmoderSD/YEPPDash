import { DOCUMENT } from '@angular/common';
import { computed, inject, Service, signal, Signal, WritableSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { FaqTopic } from '../data/faq';
import { itemForUrl, NAV_GROUPS, NavItem } from '../data/dash-nav';

interface Chosen {
  readonly topic: FaqTopic | null;
}

@Service()
export class FaqDrawerService {

  private readonly router: Router = inject(Router);
  private readonly document: Document = inject(DOCUMENT);

  private readonly url: Signal<string> = toSignal(
    this.router.events.pipe(
      filter((event: unknown): event is NavigationEnd => event instanceof NavigationEnd),
      map((event: NavigationEnd): string => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  private readonly present: WritableSignal<boolean> = signal(false);

  private readonly showing: WritableSignal<boolean> = signal(false);
  private readonly chosen: WritableSignal<Chosen | null> = signal<Chosen | null>(null);
  private readonly query: WritableSignal<string> = signal('');

  private trigger: HTMLElement | null = null;

  readonly available: Signal<boolean> = this.present.asReadonly();
  readonly opened: Signal<boolean> = this.showing.asReadonly();
  readonly search: Signal<string> = this.query.asReadonly();

  readonly contextTopic: Signal<FaqTopic | null> = computed((): FaqTopic | null => {
    const item: NavItem | undefined = itemForUrl(NAV_GROUPS, this.url());
    return item?.id ?? null;
  });

  readonly topic: Signal<FaqTopic | null> = computed((): FaqTopic | null => {
    const chosen: Chosen | null = this.chosen();
    return chosen ? chosen.topic : this.contextTopic();
  });

  readonly following: Signal<boolean> = computed((): boolean => this.chosen() === null);

  register(): () => void {
    this.present.set(true);

    return (): void => {
      this.present.set(false);
      this.showing.set(false);
    };
  }

  toggle(trigger?: HTMLElement | null): void {
    if (this.showing()) {
      this.close();
      return;
    }

    this.open(trigger);
  }

  open(trigger?: HTMLElement | null): void {
    if (this.showing()) return;

    this.trigger = trigger ?? null;
    this.showing.set(true);
  }

  close(): void {
    this.shut(true);
  }

  dismiss(): void {
    this.shut(false);
  }

  pick(topic: FaqTopic | null): void {
    this.chosen.set({ topic });
  }

  changeSearch(search: string): void {
    this.query.set(search);
  }

  private shut(restoreFocus: boolean): void {
    if (!this.showing()) return;

    this.showing.set(false);
    this.chosen.set(null);
    this.query.set('');

    if (restoreFocus) (this.trigger ?? this.document.querySelector<HTMLElement>('[aria-controls="faq-drawer"]'))?.focus();
    this.trigger = null;
  }
}