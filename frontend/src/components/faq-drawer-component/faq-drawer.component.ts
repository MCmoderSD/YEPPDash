import { afterRenderEffect, Component, computed, ElementRef, inject, Signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FaqListComponent } from '../faq-list-component/faq-list.component';
import { FaqTopicsComponent } from '../faq-topics-component/faq-topics.component';
import { TableSearchComponent } from '../table-search-component/table-search.component';
import { FaqDrawerService } from '../../services/faq-drawer.service';
import { faqLink } from '../../services/dash-host';
import {
  FAQ_ENTRIES,
  FaqEntry,
  FaqSection,
  FaqTopic,
  faqCounts,
  filterFaq,
  groupFaq,
  topicMeta,
} from '../../data/faq';

@Component({
  selector: 'app-faq-drawer',
  templateUrl: './faq-drawer.component.html',
  styleUrl: './faq-drawer.component.scss',
  imports: [RouterLink, MatButtonModule, MatIconModule, FaqListComponent, FaqTopicsComponent, TableSearchComponent],
  host: {
    'class': 'faq-drawer',
    '[class.faq-drawer-open]': 'faq.opened()',
    '[attr.inert]': 'faq.opened() ? null : ""',
    'role': 'complementary',
    'aria-label': 'FAQ',
    'id': 'faq-drawer',
    '(keydown.escape)': 'faq.close()',
    '(document:click)': 'dismissOutside($event)',
  },
})
export class FaqDrawerComponent {

  protected readonly faq: FaqDrawerService = inject(FaqDrawerService);

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  private readonly closer: Signal<ElementRef<HTMLElement> | undefined> =
    viewChild('closer', { read: ElementRef<HTMLElement> });

  private readonly topics: Signal<FaqTopicsComponent | undefined> = viewChild(FaqTopicsComponent);

  private readonly searched: Signal<readonly FaqEntry[]> = computed((): readonly FaqEntry[] =>
    filterFaq(FAQ_ENTRIES, { topic: null, search: this.faq.search() }));

  protected readonly counts: Signal<ReadonlyMap<FaqTopic | 'all', number>> =
    computed((): ReadonlyMap<FaqTopic | 'all', number> => faqCounts(this.searched()));

  private readonly visible: Signal<readonly FaqEntry[]> = computed((): readonly FaqEntry[] =>
    filterFaq(this.searched(), { topic: this.faq.topic(), search: '' }));

  protected readonly sections: Signal<readonly FaqSection[]> =
    computed((): readonly FaqSection[] => groupFaq(this.visible()));

  protected readonly grouped: Signal<boolean> = computed((): boolean => this.faq.topic() === null);

  protected readonly topicLabel: Signal<string | null> = computed((): string | null => {
    const topic: FaqTopic | null = this.faq.topic();
    return topic ? topicMeta(topic).label : null;
  });

  protected readonly count: Signal<number> = computed((): number => this.visible().length);

  private readonly query: Signal<Record<string, string>> = computed((): Record<string, string> => {
    const query: Record<string, string> = {};

    const topic: FaqTopic | null = this.faq.topic();
    if (topic) query['topic'] = topic;
    if (this.faq.search()) query['q'] = this.faq.search();

    return query;
  });

  protected readonly fullPageUrl: Signal<string | null> = computed((): string | null => faqLink(this.query()));

  protected readonly fullPageParams: Signal<Record<string, string>> = this.query;

  constructor() {
    afterRenderEffect((): void => {
      if (!this.faq.opened()) return;
      this.closer()?.nativeElement.focus();
      this.topics()?.reveal();
    });
  }

  protected dismissOutside(event: MouseEvent): void {
    if (!this.faq.opened() || event.composedPath().includes(this.host.nativeElement)) return;

    const target: EventTarget | null = event.target;
    if (target instanceof Element && target.closest('[aria-controls="faq-drawer"], .cdk-overlay-container')) return;

    this.faq.dismiss();
  }
}