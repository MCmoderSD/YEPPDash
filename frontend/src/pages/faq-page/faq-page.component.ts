import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, inject, input, InputSignal, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FaqListComponent } from '../../components/faq-list-component/faq-list.component';
import { TableSearchComponent } from '../../components/table-search-component/table-search.component';
import { FaqTopicsComponent } from '../../components/faq-topics-component/faq-topics.component';
import {
  FAQ_ENTRIES,
  FaqEntry,
  FaqSection,
  FaqTopic,
  faqCounts,
  filterFaq,
  groupFaq,
  isFaqTopic,
  topicMeta,
} from '../../data/faq';

@Component({
  selector: 'app-faq-page',
  templateUrl: './faq-page.component.html',
  styleUrl: './faq-page.component.scss',
  imports: [MatIconModule, FaqListComponent, FaqTopicsComponent, TableSearchComponent],
})
export class FaqPageComponent {

  private readonly router: Router = inject(Router);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly document: Document = inject(DOCUMENT);

  readonly topic: InputSignal<string | undefined> = input<string>();
  readonly q: InputSignal<string | undefined> = input<string>();

  protected readonly fragment: Signal<string | null> = toSignal(this.route.fragment, { initialValue: null });

  protected readonly activeTopic: Signal<FaqTopic | null> = computed((): FaqTopic | null => {
    const value: string | undefined = this.topic();
    return isFaqTopic(value) ? value : null;
  });

  protected readonly search: Signal<string> = computed((): string => (this.q() ?? '').trim());

  private readonly searched: Signal<readonly FaqEntry[]> = computed((): readonly FaqEntry[] =>
    filterFaq(FAQ_ENTRIES, { topic: null, search: this.search() }));

  protected readonly counts: Signal<ReadonlyMap<FaqTopic | 'all', number>> =
    computed((): ReadonlyMap<FaqTopic | 'all', number> => faqCounts(this.searched()));

  private readonly visible: Signal<readonly FaqEntry[]> = computed((): readonly FaqEntry[] =>
    filterFaq(this.searched(), { topic: this.activeTopic(), search: '' }));

  protected readonly sections: Signal<readonly FaqSection[]> =
    computed((): readonly FaqSection[] => groupFaq(this.visible()));

  protected readonly summary: Signal<string> = computed((): string => {
    const count: number = this.visible().length;
    const answers: string = `${count} ${count === 1 ? 'answer' : 'answers'}`;

    const topic: FaqTopic | null = this.activeTopic();
    const about: string = topic ? ` about ${topicMeta(topic).label}` : '';
    const term: string = this.search() ? ` matching “${this.search()}”` : '';

    return `${answers}${about}${term}`;
  });

  constructor() {
    afterNextRender((): void => this.reveal());
  }

  protected pickTopic(topic: FaqTopic | null): void {
    void this.apply({ topic });
  }

  protected changeSearch(search: string): void {
    void this.apply({ q: search || null });
  }

  private apply(queryParams: Record<string, string | null>): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      preserveFragment: true,
      replaceUrl: true,
    });
  }

  private reveal(): void {
    const id: string | null = this.fragment();
    if (!id) return;

    const view: (Window & typeof globalThis) | null = this.document.defaultView;

    this.document.getElementById(id)?.scrollIntoView({ block: 'start' });

    const landedAt: number | undefined = view?.scrollY;

    void this.document.fonts?.ready.then((): void => {
      if (view?.scrollY !== landedAt) return;
      this.document.getElementById(id)?.scrollIntoView({ block: 'start' });
    });
  }
}