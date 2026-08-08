import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  inject,
  NgZone,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { scrollBarAxis, ScrollBarAxis } from '../scroll-bar-component/scroll-bar.component';

// How close to the right edge the pointer has to come before the bar reveals itself. Wider than the
// bar's own hit area so it can be found without pixel-perfect aim, narrow enough that it still
// reads as having gone to the edge rather than merely hovering the page.
const REVEAL_DISTANCE = 48;

// How long the bar stays up after the last scroll. Scrolling is the one moment the position it
// reports is worth reading on its own.
const SCROLL_REVEAL_MS = 900;

// A touch screen scrolls the content directly and has no pointer that could reach the edge to
// reveal this, so there it would be dead weight floating over the page.
const NO_POINTER = '(pointer: coarse), (hover: none)';

// Draws the page's own scroll bar, replacing the platform one that styles.scss takes away. The
// element-level ScrollBarComponent cannot stand in for this: it is positioned against the box it is
// pointed at, whereas this floats over the viewport and is driven by the document's scroll.
//
// The geometry itself is shared with that component rather than restated, so how a thumb is sized
// and where it sits is decided in exactly one place.
@Component({
  selector: 'app-page-scroll-bar',
  templateUrl: './page-scroll-bar.component.html',
  styleUrl: './page-scroll-bar.component.scss',
  standalone: false,
  host: {
    // It only restates scrolling the page already offers, so there is nothing here to announce.
    'aria-hidden': 'true',
    '[class.page-scroll-bar-revealed]': 'revealed()',
    '[class.page-scroll-bar-dragging]': 'dragging()',
  },
})
export class PageScrollBarComponent {

  private readonly document: Document = inject(DOCUMENT);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly zone: NgZone = inject(NgZone);

  private readonly scrollTop: WritableSignal<number> = signal(0);
  private readonly scrollHeight: WritableSignal<number> = signal(0);
  private readonly viewportHeight: WritableSignal<number> = signal(0);

  private readonly pointerNear: WritableSignal<boolean> = signal(false);
  private readonly pointerOnBar: WritableSignal<boolean> = signal(false);
  private readonly scrolling: WritableSignal<boolean> = signal(false);
  private readonly untouchable: WritableSignal<boolean> = signal(true);

  protected readonly dragging: WritableSignal<boolean> = signal(false);

  private scrollTimer: ReturnType<typeof setTimeout> | undefined;
  private grabbedAt = 0;
  private grabbedScrollTop = 0;

  protected readonly axis: Signal<ScrollBarAxis> = computed((): ScrollBarAxis => scrollBarAxis(
    this.viewportHeight(), this.viewportHeight(), this.scrollHeight(), this.scrollTop(),
  ));

  // Only worth drawing where there is a pointer that could reach for it and something to scroll.
  protected readonly scrollable: Signal<boolean> =
    computed((): boolean => this.untouchable() && this.axis().visible);

  protected readonly revealed: Signal<boolean> = computed((): boolean =>
    this.scrollable() &&
    (this.dragging() || this.pointerOnBar() || this.pointerNear() || this.scrolling()),
  );

  constructor() {
    // Measuring reads layout, which exists only once the view is in a document — and never on the
    // server, where afterNextRender does not run at all.
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
    // Secondary buttons open the platform's own scroll menu on a native bar; there is nothing to
    // imitate there, so they are left alone.
    if (event.button !== 0) return;

    this.dragging.set(true);
    this.grabbedAt = event.clientY;
    this.grabbedScrollTop = this.scrollTop();

    (event.target as Element).setPointerCapture(event.pointerId);

    // Otherwise the press starts selecting the text the bar is drawn over.
    event.preventDefault();
  }

  protected drag(event: PointerEvent): void {
    if (!this.dragging()) return;

    this.scrollTo(this.offsetFor(this.axis(), event.clientY - this.grabbedAt));
  }

  protected release(): void {
    this.dragging.set(false);
  }

  // The thumb is dragged from where it was grabbed, so the scroll it maps to is measured from the
  // offset it had then rather than from wherever it has been dragged to since.
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
    // Registered outside Angular deliberately: a scroll fires dozens of events and a mouse well
    // over a hundred a second, and in the zone every one would drag the whole application through
    // change detection. The signals written below schedule a render by themselves.
    this.zone.runOutsideAngular((): void => {
      const scrolled = (): void => {
        this.measure();
        this.flashOnScroll();
      };

      const moved = (event: PointerEvent): void => {
        // innerWidth rather than the document element's width: with the platform bar gone there is
        // no gutter, but measuring against the element would still be the wrong edge if one
        // returned.
        this.pointerNear.set(view.innerWidth - event.clientX <= REVEAL_DISTANCE);
      };

      // Without this the last position — possibly inside the reveal zone — would linger forever
      // once the pointer leaves the window, since no further move fires to correct it.
      const left = (): void => this.pointerNear.set(false);
      const resized = (): void => this.measure();

      view.addEventListener('scroll', scrolled, { passive: true });
      view.addEventListener('resize', resized);
      this.document.addEventListener('pointermove', moved, { passive: true });
      this.document.addEventListener('pointerleave', left);

      // The page grows and shrinks without anything scrolling or resizing — a table loading its
      // rows, a panel opening — and the thumb has to follow.
      //
      // Watching the body itself is not enough: this app pins html and body to `height: 100%`, so
      // their boxes stay exactly one viewport tall however long the content gets and the observer
      // would never fire. What actually grows is the app root inside them, and anything else the
      // body may come to hold, so every child is watched instead.
      const sizes: ResizeObserver | undefined =
        typeof ResizeObserver === 'function' ? new ResizeObserver((): void => this.measure()) : undefined;

      const observe = (): void => {
        sizes?.disconnect();
        sizes?.observe(this.document.body);
        for (const child of this.document.body.children) sizes?.observe(child);
      };

      // A route change replaces what the body holds, bringing a new set of children to watch.
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

  // Held up for a moment after the last scroll event rather than cleared with it, so the bar does
  // not strobe through a gesture that arrives as a burst of separate events.
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
  }
}