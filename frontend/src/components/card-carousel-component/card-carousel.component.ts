import { afterNextRender, Component, computed, ElementRef, input, InputSignal, signal, Signal, viewChild, WritableSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NavItem } from '../../data/dash-nav';

const MIN_CARD: number = 260;
const GAP: number = 12;

const EDGE_REACH: number = 72;

@Component({
  selector: 'app-card-carousel',
  templateUrl: './card-carousel.component.html',
  styleUrl: './card-carousel.component.scss',
  imports: [RouterLink, MatIconModule],
})
export class CardCarouselComponent {

  readonly items: InputSignal<readonly NavItem[]> = input.required<readonly NavItem[]>();

  readonly label: InputSignal<string> = input.required<string>();

  private readonly track: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>('track');

  protected readonly perPage: WritableSignal<number> = signal(1);
  protected readonly page: WritableSignal<number> = signal(0);

  protected readonly pages: Signal<number> = computed((): number =>
    Math.max(1, Math.ceil(this.items().length / this.perPage())));

  protected readonly edge: WritableSignal<'back' | 'forward' | null> = signal<'back' | 'forward' | null>(null);

  protected readonly dots: Signal<readonly number[]> = computed((): readonly number[] =>
    Array.from({ length: this.pages() }, (_, index: number): number => index));

  constructor() {
    afterNextRender((): void => {
      const element: HTMLElement = this.track().nativeElement;

      new ResizeObserver((): void => this.measure()).observe(element);

      this.measure();
    });
  }

  protected aim(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return;

    const rect: DOMRect = this.track().nativeElement.getBoundingClientRect();

    this.edge.set(
      event.clientX - rect.left <= EDGE_REACH ? 'back'
        : rect.right - event.clientX <= EDGE_REACH ? 'forward'
          : null);
  }

  protected release(): void {
    this.edge.set(null);
  }

  protected measure(): void {
    const element: HTMLElement = this.track().nativeElement;

    this.perPage.set(Math.max(1, Math.floor((element.clientWidth + GAP) / (MIN_CARD + GAP))));

    const room: number = element.scrollWidth - element.clientWidth;
    const last: number = this.pages() - 1;

    this.page.set(room > 0 && last > 0 ? Math.round((element.scrollLeft / room) * last) : 0);
  }

  protected step(direction: number): void {
    this.goTo(this.page() + direction);
  }

  protected goTo(page: number): void {
    const element: HTMLElement = this.track().nativeElement;
    const last: number = this.pages() - 1;
    const target: number = Math.min(Math.max(page, 0), last);
    const room: number = element.scrollWidth - element.clientWidth;

    element.scrollTo({ left: last > 0 ? (target / last) * room : 0, behavior: this.motion() });
  }

  private motion(): ScrollBehavior {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }
}