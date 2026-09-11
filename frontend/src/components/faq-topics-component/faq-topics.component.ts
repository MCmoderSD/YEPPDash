import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import {
  FAQ_TOPIC_GROUPS,
  FaqTopic,
  FaqTopicGroup,
  FaqTopicMeta,
  GENERAL_TOPIC,
} from '../../data/faq';

export type FaqTopicsLayout = 'responsive' | 'chips';

@Component({
  selector: 'app-faq-topics',
  templateUrl: './faq-topics.component.html',
  styleUrl: './faq-topics.component.scss',
  imports: [MatIconModule],
})
export class FaqTopicsComponent {

  readonly selected: InputSignal<FaqTopic | null> = input<FaqTopic | null>(null);

  readonly counts: InputSignal<ReadonlyMap<FaqTopic | 'all', number>> =
    input.required<ReadonlyMap<FaqTopic | 'all', number>>();

  readonly layout: InputSignal<FaqTopicsLayout> = input<FaqTopicsLayout>('responsive');

  readonly picked: OutputEmitterRef<FaqTopic | null> = output<FaqTopic | null>();

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly document: Document = inject(DOCUMENT);

  protected readonly general: FaqTopicMeta = GENERAL_TOPIC;

  protected readonly showGeneral: Signal<boolean> = computed((): boolean =>
    this.count(GENERAL_TOPIC.id) > 0 || this.selected() === GENERAL_TOPIC.id);

  protected readonly groups: Signal<readonly FaqTopicGroup[]> = computed((): readonly FaqTopicGroup[] =>
    FAQ_TOPIC_GROUPS
      .map((group: FaqTopicGroup): FaqTopicGroup => ({
        ...group,
        topics: group.topics.filter((topic: FaqTopicMeta): boolean =>
          this.count(topic.id) > 0 || this.selected() === topic.id),
      }))
      .filter((group: FaqTopicGroup): boolean => group.topics.length > 0));

  constructor() {
    afterRenderEffect((): void => {
      this.selected();
      this.reveal();
    });
  }

  reveal(): void {
    const active: HTMLElement | null = this.host.nativeElement.querySelector('.topic-active');
    if (!active) return;

    const scroller: HTMLElement | null = this.scrollParent(active);
    if (!scroller) return;

    const item: DOMRect = active.getBoundingClientRect();
    const view: DOMRect = scroller.getBoundingClientRect();
    const margin = 8;

    if (item.top - view.top < margin) scroller.scrollTop += item.top - view.top - margin;
    else if (item.bottom - view.bottom > -margin) scroller.scrollTop += item.bottom - view.bottom + margin;

    if (item.left - view.left < margin) scroller.scrollLeft += item.left - view.left - margin;
    else if (item.right - view.right > -margin) scroller.scrollLeft += item.right - view.right + margin;
  }

  protected count(topic: FaqTopic | 'all'): number {
    return this.counts().get(topic) ?? 0;
  }

  protected pick(topic: FaqTopic | null): void {
    this.picked.emit(topic);
  }

  private scrollParent(from: HTMLElement): HTMLElement | null {
    const view: (Window & typeof globalThis) | null = this.document.defaultView;
    if (!view) return null;

    let node: HTMLElement | null = from.parentElement;

    while (node && node !== this.document.body) {
      const style: CSSStyleDeclaration = view.getComputedStyle(node);

      if (/(auto|scroll)/.test(`${style.overflowY} ${style.overflowX}`)) return node;

      node = node.parentElement;
    }

    return null;
  }
}