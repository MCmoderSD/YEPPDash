import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  InputSignal,
  NgZone,
  Signal,
  signal,
  viewChild,
  WritableSignal,
} from '@angular/core';

// Applied to the scrolled element for as long as this component is attached to it. It lives in
// styles.scss rather than here because the element it belongs to sits outside this component.
const NATIVE_BAR_HIDDEN = 'app-native-scrollbar-hidden';

// Smallest thumb in pixels. Below this a long document leaves nothing a pointer can grab.
const MIN_THUMB_SIZE = 24;

// How close to the element's trailing edge the pointer has to come before the bars appear. Wide
// enough that reaching for the bar reveals it before the pointer arrives — a band only as wide as
// the bar itself would mean aiming at something invisible.
const REVEAL_DISTANCE = 72;

// How long the bars stay up after the last scroll event. Scrolling is the one case where the bars
// are worth showing away from the edge: they are the only indication of how far through the
// content the view has got.
const SCROLL_REVEAL_MS = 900;

export type ScrollBarAxisName = 'x' | 'y';

export interface ScrollBarAxis {
  visible: boolean;
  trackSize: number;
  thumbSize: number;
  thumbOffset: number;
}

interface ScrollBarBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

const HIDDEN_AXIS: ScrollBarAxis = { visible: false, trackSize: 0, thumbSize: 0, thumbOffset: 0 };
const EMPTY_BOX: ScrollBarBox = { top: 0, left: 0, width: 0, height: 0 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function scrollBarAxis(
  track: number, viewport: number, content: number, scroll: number,
): ScrollBarAxis {
  const overflow: number = content - viewport;

  // A single pixel of overflow is what sub-pixel layout and page zoom produce on their own, so it
  // does not count as something worth showing a bar for.
  if (track <= 0 || overflow <= 1) return { ...HIDDEN_AXIS, trackSize: Math.max(track, 0) };

  const thumbSize: number = clamp(
    Math.round((track * viewport) / content),
    // A track shorter than the minimum wins over the minimum, otherwise the thumb would hang out
    // of its own bar.
    Math.min(MIN_THUMB_SIZE, track),
    track,
  );

  // Clamped because overscroll — rubber banding, a trackpad pushed past the end — reports a
  // scroll offset outside the range the content actually has.
  const progress: number = clamp(scroll / overflow, 0, 1);

  return {
    visible: true,
    trackSize: track,
    thumbSize,
    thumbOffset: Math.round((track - thumbSize) * progress),
  };
}

export function scrollForThumbOffset(
  offset: number, axis: ScrollBarAxis, viewport: number, content: number,
): number {
  const room: number = axis.trackSize - axis.thumbSize;
  if (room <= 0) return 0;

  return clamp(offset / room, 0, 1) * (content - viewport);
}

// How near the pointer is to whichever edge carries a bar. Split out from the component so the
// arithmetic can be reasoned about — and tested — without a layout to measure.
export function nearEdge(
  pointer: { x: number; y: number },
  box: ScrollBarBox,
  vertical: boolean,
  horizontal: boolean,
  distance: number = REVEAL_DISTANCE,
): boolean {
  // Only counts while the pointer is actually over the element: past the edge it belongs to
  // whatever is next to the element, and reaching there should put the bars away.
  const inside: boolean =
    pointer.x >= box.left && pointer.x <= box.left + box.width &&
    pointer.y >= box.top && pointer.y <= box.top + box.height;

  if (!inside) return false;

  const toRight: number = box.left + box.width - pointer.x;
  const toBottom: number = box.top + box.height - pointer.y;

  return (vertical && toRight <= distance) || (horizontal && toBottom <= distance);
}

// Used from two different NgModules, so it has to be standalone rather than declared in either.
@Component({
  selector: 'app-scroll-bar',
  templateUrl: './scroll-bar.component.html',
  styleUrl: './scroll-bar.component.scss',
  host: {
    // The bars only restate scrolling the element underneath already offers, so there is nothing
    // here for a screen reader to announce — and nothing focusable inside to hide from it either.
    'aria-hidden': 'true',
    '[class.scroll-bar-dragging]': 'dragging()',
    '[class.scroll-bar-revealed]': 'revealed()',
    '[style.top.px]': 'box().top',
    '[style.left.px]': 'box().left',
    '[style.width.px]': 'box().width',
    '[style.height.px]': 'box().height',
  },
})
export class ScrollBarComponent {

  readonly target: InputSignal<HTMLElement> = input.required<HTMLElement>();

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly zone: NgZone = inject(NgZone);
  private readonly document: Document = inject(DOCUMENT);

  private readonly verticalTrack: Signal<ElementRef<HTMLElement> | undefined> =
    viewChild<ElementRef<HTMLElement>>('verticalTrack');

  private readonly horizontalTrack: Signal<ElementRef<HTMLElement> | undefined> =
    viewChild<ElementRef<HTMLElement>>('horizontalTrack');

  private readonly rendered: WritableSignal<boolean> = signal(false);

  private readonly pointerNear: WritableSignal<boolean> = signal(false);
  private readonly pointerOnBar: WritableSignal<boolean> = signal(false);
  private readonly scrolling: WritableSignal<boolean> = signal(false);

  private scrollTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly vertical: WritableSignal<ScrollBarAxis> = signal(HIDDEN_AXIS);
  protected readonly horizontal: WritableSignal<ScrollBarAxis> = signal(HIDDEN_AXIS);
  protected readonly box: WritableSignal<ScrollBarBox> = signal(EMPTY_BOX);
  protected readonly dragging: WritableSignal<boolean> = signal(false);

  // The four ways a bar earns its place on screen. Reaching for it and holding it are the obvious
  // two; the pointer merely nearing the edge is what makes it reachable in the first place, and a
  // scroll in progress is the one moment the position it reports is worth reading on its own.
  protected readonly revealed: Signal<boolean> = computed((): boolean =>
    this.dragging() || this.pointerOnBar() || this.pointerNear() || this.scrolling(),
  );

  constructor() {
    // Measuring reads layout, which exists only once the view is in a document — and never on the
    // server, where afterNextRender does not run at all.
    afterNextRender((): void => this.rendered.set(true));

    effect((onCleanup): void => {
      const target: HTMLElement = this.target();
      if (!this.rendered()) return;

      onCleanup(this.attach(target));
    });
  }

  protected grab(event: PointerEvent, axis: ScrollBarAxisName): void {
    // Secondary buttons open the platform's own scroll menu on a native bar; there is nothing to
    // imitate there, so they are left alone.
    if (event.button !== 0) return;

    const track: HTMLElement | undefined = this.trackFor(axis)?.nativeElement;
    if (!track) return;

    // Read per event rather than once: the track can move under the pointer if anything around it
    // reflows during the drag.
    const along = (pointer: PointerEvent): number => {
      const rect: DOMRect = track.getBoundingClientRect();
      return axis === 'y' ? pointer.clientY - rect.top : pointer.clientX - rect.left;
    };

    const state: ScrollBarAxis = axis === 'y' ? this.vertical() : this.horizontal();
    const pointer: number = along(event);
    const onThumb: boolean =
      pointer >= state.thumbOffset && pointer <= state.thumbOffset + state.thumbSize;

    // Grabbing the thumb keeps the spot it was grabbed by under the pointer; pressing the bare
    // track instead jumps the thumb to the pointer and centres it there. That way the bar answers
    // both ways of using it — click a spot, or grab and drag.
    const held: number = onThumb ? pointer - state.thumbOffset : state.thumbSize / 2;
    if (!onThumb) this.scrollTo(axis, pointer - held);

    // Capture keeps the drag alive while the pointer wanders off the bar, which is most of a drag.
    track.setPointerCapture(event.pointerId);
    this.dragging.set(true);

    const move = (moved: PointerEvent): void => this.scrollTo(axis, along(moved) - held);
    const release = (): void => {
      track.removeEventListener('pointermove', move);
      track.removeEventListener('pointerup', release);
      track.removeEventListener('pointercancel', release);
      this.dragging.set(false);
    };

    track.addEventListener('pointermove', move);
    track.addEventListener('pointerup', release);
    track.addEventListener('pointercancel', release);

    // Without this the press starts selecting the text it is drawn over.
    event.preventDefault();
  }

  private attach(target: HTMLElement): () => void {
    target.classList.add(NATIVE_BAR_HIDDEN);

    const measure = (): void => this.measure();

    // Registered outside Angular deliberately: one scroll gesture fires dozens of events, and in
    // the zone every one of them would drag the whole application through change detection. The
    // signals that measure() writes schedule a render by themselves, which is all this needs.
    const cleanups: (() => void)[] = this.zone.runOutsideAngular((): (() => void)[] => {
      const scrolled = (): void => {
        this.measure();
        this.flashOnScroll();
      };

      target.addEventListener('scroll', scrolled, { passive: true });

      // A textarea grows its own content without a single element changing size, so typing is a
      // content change that no observer would report.
      target.addEventListener('input', measure);

      // Watched on the element rather than the document: a page can hold several of these, and
      // every one of them waking on every pointer move across the whole page is a cost none of
      // them needs to pay.
      const track = (event: PointerEvent): void => this.trackPointer(event);
      const leave = (): void => this.pointerNear.set(false);

      target.addEventListener('pointermove', track, { passive: true });
      target.addEventListener('pointerleave', leave);

      // The bars sit above the element and swallow the pointer, so once it is over one of them the
      // element itself stops hearing about it. Without this the bar would vanish the moment it was
      // reached for.
      const enterBar = (): void => this.pointerOnBar.set(true);
      const leaveBar = (): void => this.pointerOnBar.set(false);
      const bars: HTMLElement = this.host.nativeElement;

      bars.addEventListener('pointerenter', enterBar);
      bars.addEventListener('pointerleave', leaveBar);

      const stop: (() => void)[] = [
        (): void => target.removeEventListener('scroll', scrolled),
        (): void => target.removeEventListener('input', measure),
        (): void => target.removeEventListener('pointermove', track),
        (): void => target.removeEventListener('pointerleave', leave),
        (): void => bars.removeEventListener('pointerenter', enterBar),
        (): void => bars.removeEventListener('pointerleave', leaveBar),
      ];

      // Missing in the jsdom the unit tests run in, and in browsers old enough not to have it the
      // bar simply stops following live size changes rather than failing to appear.
      if (typeof ResizeObserver !== 'function') return stop;

      const sizes: ResizeObserver = new ResizeObserver(measure);

      const observe = (): void => {
        sizes.disconnect();
        sizes.observe(target);

        // Whether a bar is needed is decided by the content's size, and that lives in the
        // children — a table growing a row does not resize the box it scrolls inside.
        for (const child of target.children) sizes.observe(child);

        // Watched as well because it is what this component is positioned against, so its size
        // changing can move the target without the target itself resizing.
        const parent: Element | null = this.host.nativeElement.offsetParent;
        if (parent) sizes.observe(parent);
      };

      // Content replaced wholesale — an @if switching branches, a new table — brings along a new
      // set of children to watch.
      const children: MutationObserver = new MutationObserver((): void => {
        observe();
        measure();
      });

      observe();
      children.observe(target, { childList: true });

      stop.push((): void => sizes.disconnect(), (): void => children.disconnect());
      return stop;
    });

    this.measure();

    return (): void => {
      target.classList.remove(NATIVE_BAR_HIDDEN);
      for (const cleanup of cleanups) cleanup();

      clearTimeout(this.scrollTimer);
      this.scrollTimer = undefined;

      this.box.set(EMPTY_BOX);
      this.vertical.set(HIDDEN_AXIS);
      this.horizontal.set(HIDDEN_AXIS);
      this.pointerNear.set(false);
      this.pointerOnBar.set(false);
      this.scrolling.set(false);
    };
  }

  private trackPointer(event: PointerEvent): void {
    this.pointerNear.set(nearEdge(
      { x: event.clientX, y: event.clientY },
      this.viewportBox(),
      this.vertical().visible,
      this.horizontal().visible,
    ));
  }

  // Held up for a moment after the last scroll event rather than cleared with it, so the bars do
  // not strobe through a gesture that arrives as a burst of separate events.
  private flashOnScroll(): void {
    this.scrolling.set(true);

    clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout((): void => this.scrolling.set(false), SCROLL_REVEAL_MS);
  }

  // In viewport coordinates, which is what a PointerEvent reports. The box() signal is in the
  // offset parent's space and cannot be compared against one.
  private viewportBox(): ScrollBarBox {
    const target: HTMLElement = this.target();
    const rect: DOMRect = target.getBoundingClientRect();

    return {
      top: rect.top + target.clientTop,
      left: rect.left + target.clientLeft,
      width: target.clientWidth,
      height: target.clientHeight,
    };
  }

  // Called straight from the events rather than batched into an animation frame: it only reads
  // layout, and reads without an intervening write are free. Angular coalesces the renders that
  // the signal writes schedule, so a burst of events still repaints once.
  private measure(): void {
    const vertical: HTMLElement | undefined = this.verticalTrack()?.nativeElement;
    const horizontal: HTMLElement | undefined = this.horizontalTrack()?.nativeElement;
    if (!vertical || !horizontal) return;

    const target: HTMLElement = this.target();

    // How thick the bars are is CSS's business, so it is read back instead of repeated here. That
    // keeps --scroll-bar-size, rem sizing and page zoom working without a second source of truth.
    const thickness: number = vertical.offsetWidth || horizontal.offsetHeight;

    // Settled before the lengths below, because each bar shortens the other by the corner they
    // would otherwise both want to occupy.
    const needsVertical: boolean = target.scrollHeight - target.clientHeight > 1;
    const needsHorizontal: boolean = target.scrollWidth - target.clientWidth > 1;

    this.box.set(this.boxOf(target));

    this.vertical.set(scrollBarAxis(
      target.clientHeight - (needsHorizontal ? thickness : 0),
      target.clientHeight,
      target.scrollHeight,
      target.scrollTop,
    ));

    this.horizontal.set(scrollBarAxis(
      target.clientWidth - (needsVertical ? thickness : 0),
      target.clientWidth,
      target.scrollWidth,
      target.scrollLeft,
    ));
  }

  // The bars are laid over the target's padding box rather than its border box — clientTop and
  // clientLeft are the border widths — because that is where a native bar lives too. Anything else
  // would draw the bar on top of the element's own outline.
  private boxOf(target: HTMLElement): ScrollBarBox {
    const rect: DOMRect = target.getBoundingClientRect();
    const size = { width: target.clientWidth, height: target.clientHeight };
    const parent: Element | null = this.host.nativeElement.offsetParent;

    if (!parent) {
      // Nothing positioned above us, so the bars are placed against the page itself.
      const view: (Window & typeof globalThis) | null = this.document.defaultView;
      return {
        top: rect.top + target.clientTop + (view?.scrollY ?? 0),
        left: rect.left + target.clientLeft + (view?.scrollX ?? 0),
        ...size,
      };
    }

    const origin: DOMRect = parent.getBoundingClientRect();

    // An absolutely positioned element starts at its offset parent's padding box, and that box
    // travels with the parent's content — hence subtracting the border and adding the scroll.
    return {
      top: rect.top - origin.top - parent.clientTop + parent.scrollTop + target.clientTop,
      left: rect.left - origin.left - parent.clientLeft + parent.scrollLeft + target.clientLeft,
      ...size,
    };
  }

  private scrollTo(axis: ScrollBarAxisName, offset: number): void {
    const target: HTMLElement = this.target();

    if (axis === 'y') {
      target.scrollTop = scrollForThumbOffset(
        offset, this.vertical(), target.clientHeight, target.scrollHeight,
      );
    } else {
      target.scrollLeft = scrollForThumbOffset(
        offset, this.horizontal(), target.clientWidth, target.scrollWidth,
      );
    }

    // The scroll event that follows a programmatic scroll only arrives at the next frame, which
    // would leave the thumb trailing the pointer by a frame for the whole drag.
    this.measure();
  }

  private trackFor(axis: ScrollBarAxisName): ElementRef<HTMLElement> | undefined {
    return axis === 'y' ? this.verticalTrack() : this.horizontalTrack();
  }
}