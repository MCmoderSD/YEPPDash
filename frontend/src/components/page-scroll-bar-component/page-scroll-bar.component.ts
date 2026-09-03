import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, DestroyRef, ElementRef, inject, NgZone, Signal, signal, WritableSignal } from '@angular/core';
import { scrollBarAxis, ScrollBarAxis } from '../scroll-bar-component/scroll-bar.component';
import { ViewportInsetsService } from '../../services/viewport-insets.service';

const REVEAL_DISTANCE: number = 48;
const SCROLL_REVEAL_MS: number = 900;
const NO_POINTER: string = '(pointer: coarse), (hover: none)';

@Component({
  selector: 'app-page-scroll-bar',
  templateUrl: './page-scroll-bar.component.html',
  styleUrl: './page-scroll-bar.component.scss',
  host: {
    'aria-hidden': 'true',
    '[class.page-scroll-bar-revealed]': 'revealed()',
    '[class.page-scroll-bar-dragging]': 'dragging()',
    '[style.bottom.px]': 'insets.footerInset()',
  },
})
export class PageScrollBarComponent {

  protected readonly insets: ViewportInsetsService = inject(ViewportInsetsService);

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly document: Document = inject(DOCUMENT);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly zone: NgZone = inject(NgZone);

  private readonly scrollTop: WritableSignal<number> = signal(0);
  private readonly scrollHeight: WritableSignal<number> = signal(0);
  private readonly viewportHeight: WritableSignal<number> = signal(0);

  private readonly trackHeight: WritableSignal<number> = signal(0);

  private readonly pointerNear: WritableSignal<boolean> = signal(false);
  private readonly pointerOnBar: WritableSignal<boolean> = signal(false);
  private readonly scrolling: WritableSignal<boolean> = signal(false);
  private readonly untouchable: WritableSignal<boolean> = signal(true);

  protected readonly dragging: WritableSignal<boolean> = signal(false);

  private scrollTimer: ReturnType<typeof setTimeout> | undefined;
  private grabbedAt = 0;
  private grabbedScrollTop = 0;

  protected readonly axis: Signal<ScrollBarAxis> = computed((): ScrollBarAxis => scrollBarAxis(
    this.trackHeight(), this.viewportHeight(), this.scrollHeight(), this.scrollTop(),
  ));

  protected readonly scrollable: Signal<boolean> = computed((): boolean => this.untouchable() && this.axis().visible);

  protected readonly revealed: Signal<boolean> = computed((): boolean =>
    this.scrollable() &&
    (this.dragging() || this.pointerOnBar() || this.pointerNear() || this.scrolling()),
  );

  constructor() {
    afterNextRender((): void => {
      const view: (Window & typeof globalThis) | null = this.document.defaultView;
      if (!view) return;

      const query: MediaQueryList = view.matchMedia(NO_POINTER);
      const sync = (): void => this.untouchable.set(!query.matches);

      sync();
      query.addEventListener('change', sync);
      this.destroyRef.onDestroy((): void => query.removeEventListener('change', sync));

      this.listen(view);
      this.measure();
    });
  }

  protected grab(event: PointerEvent): void {
    if (event.button !== 0) return;

    this.dragging.set(true);
    this.grabbedAt = event.clientY;
    this.grabbedScrollTop = this.scrollTop();

    (event.target as Element).setPointerCapture(event.pointerId);

    event.preventDefault();
  }

  protected drag(event: PointerEvent): void {
    if (!this.dragging()) return;
    this.scrollTo(this.offsetFor(this.axis(), event.clientY - this.grabbedAt));
  }

  protected release(): void {
    this.dragging.set(false);
  }

  private offsetFor(axis: ScrollBarAxis, moved: number): number {
    const room: number = axis.trackSize - axis.thumbSize;
    if (room <= 0) return this.grabbedScrollTop;

    const travel: number = this.scrollHeight() - this.viewportHeight();
    return this.grabbedScrollTop + (moved * travel) / room;
  }

  private scrollTo(top: number): void {
    this.document.documentElement.scrollTop = top;
    this.measure();
  }

  private listen(view: Window & typeof globalThis): void {
    this.zone.runOutsideAngular((): void => {
      const scrolled = (): void => {
        this.measure();
        this.flashOnScroll();
      };

      const moved = (event: PointerEvent): void => {
        this.pointerNear.set(view.innerWidth - event.clientX <= REVEAL_DISTANCE);
      };

      const left = (): void => this.pointerNear.set(false);
      const resized = (): void => this.measure();

      view.addEventListener('scroll', scrolled, { passive: true });
      view.addEventListener('resize', resized);
      this.document.addEventListener('pointermove', moved, { passive: true });
      this.document.addEventListener('pointerleave', left);

      const sizes: ResizeObserver | undefined = typeof ResizeObserver === 'function' ? new ResizeObserver((): void => this.measure()) : undefined;

      const observe = (): void => {
        sizes?.disconnect();
        sizes?.observe(this.document.body);
        for (const child of this.document.body.children) sizes?.observe(child);
      };

      const children: MutationObserver | undefined =
        typeof MutationObserver === 'function'
          ? new MutationObserver((): void => { observe(); this.measure(); })
          : undefined;

      observe();
      children?.observe(this.document.body, { childList: true });

      this.destroyRef.onDestroy((): void => {
        children?.disconnect();
        view.removeEventListener('scroll', scrolled);
        view.removeEventListener('resize', resized);
        this.document.removeEventListener('pointermove', moved);
        this.document.removeEventListener('pointerleave', left);
        sizes?.disconnect();
        clearTimeout(this.scrollTimer);
      });
    });
  }

  private flashOnScroll(): void {
    this.scrolling.set(true);

    clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout((): void => this.scrolling.set(false), SCROLL_REVEAL_MS);
  }

  protected onBar(over: boolean): void {
    this.pointerOnBar.set(over);
  }

  private measure(): void {
    const root: HTMLElement = this.document.documentElement;

    this.scrollTop.set(root.scrollTop);
    this.scrollHeight.set(root.scrollHeight);
    this.viewportHeight.set(root.clientHeight);

    const bandTop: number = this.host.nativeElement.getBoundingClientRect().top;

    this.trackHeight.set(Math.max(0, root.clientHeight - bandTop - this.insets.footerInset()));
  }
}