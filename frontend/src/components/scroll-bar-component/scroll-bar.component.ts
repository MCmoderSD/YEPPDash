import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  Component,
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

/**
 * Geometry for one axis. `track` is the room left for the bar once the other bar's corner is taken
 * out of it; `viewport` and `content` are the element's client and scroll size along the axis.
 */
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

/** The inverse of the above: how far to scroll for the thumb to come to rest at `offset`. */
export function scrollForThumbOffset(
  offset: number, axis: ScrollBarAxis, viewport: number, content: number,
): number {
  const room: number = axis.trackSize - axis.thumbSize;
  if (room <= 0) return 0;

  return clamp(offset / room, 0, 1) * (content - viewport);
}

/**
 * A scroll bar in the app's own colours, drawn over an element that keeps scrolling natively.
 *
 * Only the bar is replaced, never the scrolling: the target keeps its own overflow, so the wheel,
 * the keyboard, touch momentum, auto-scroll while selecting text and the platform's accessibility
 * affordances all still come from the browser. That is the whole reason this sits on top of the
 * element instead of taking its content over.
 *
 * Place it as a sibling of the element it points at, inside an ancestor that establishes a
 * containing block:
 *
 *     <div #scroll class="panel"> … </div>
 *     <app-scroll-bar [target]="scroll"/>
 *
 * Standalone rather than declared in a module: it is used from two different NgModules and is not
 * worth a module of its own.
 */
@Component({
  selector: 'app-scroll-bar',
  templateUrl: './scroll-bar.component.html',
  styleUrl: './scroll-bar.component.scss',
  host: {
    // The bars only restate scrolling the element underneath already offers, so there is nothing
    // here for a screen reader to announce — and nothing focusable inside to hide from it either.
    'aria-hidden': 'true',
    '[class.scroll-bar-dragging]': 'dragging()',
    '[style.top.px]': 'box().top',
    '[style.left.px]': 'box().left',
    '[style.width.px]': 'box().width',
    '[style.height.px]': 'box().height',
  },
})
export class ScrollBarComponent {

  /** The element that scrolls. Its native bar stays hidden for as long as this component lives. */
  readonly target: InputSignal<HTMLElement> = input.required<HTMLElement>();

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly zone: NgZone = inject(NgZone);
  private readonly document: Document = inject(DOCUMENT);

  private readonly verticalTrack: Signal<ElementRef<HTMLElement> | undefined> =
    viewChild<ElementRef<HTMLElement>>('verticalTrack');

  private readonly horizontalTrack: Signal<ElementRef<HTMLElement> | undefined> =
    viewChild<ElementRef<HTMLElement>>('horizontalTrack');

  private readonly rendered: WritableSignal<boolean> = signal(false);

  protected readonly vertical: WritableSignal<ScrollBarAxis> = signal(HIDDEN_AXIS);
  protected readonly horizontal: WritableSignal<ScrollBarAxis> = signal(HIDDEN_AXIS);
  protected readonly box: WritableSignal<ScrollBarBox> = signal(EMPTY_BOX);
  protected readonly dragging: WritableSignal<boolean> = signal(false);

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
      target.addEventListener('scroll', measure, { passive: true });

      // A textarea grows its own content without a single element changing size, so typing is a
      // content change that no observer would report.
      target.addEventListener('input', measure);

      const stop: (() => void)[] = [
        (): void => target.removeEventListener('scroll', measure),
        (): void => target.removeEventListener('input', measure),
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

      this.box.set(EMPTY_BOX);
      this.vertical.set(HIDDEN_AXIS);
      this.horizontal.set(HIDDEN_AXIS);
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
