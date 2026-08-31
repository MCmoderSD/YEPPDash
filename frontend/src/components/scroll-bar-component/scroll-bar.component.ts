import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, effect, ElementRef, inject, input, InputSignal, NgZone, Signal, signal, viewChild, WritableSignal } from '@angular/core';

const NATIVE_BAR_HIDDEN: string = 'app-native-scrollbar-hidden';

const MIN_THUMB_SIZE: number = 24;
const REVEAL_DISTANCE: number = 72;
const SCROLL_REVEAL_MS: number = 900;

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

export function scrollBarAxis(track: number, viewport: number, content: number, scroll: number): ScrollBarAxis {
  const overflow: number = content - viewport;

  if (track <= 0 || overflow <= 1) return { ...HIDDEN_AXIS, trackSize: Math.max(track, 0) };

  const thumbSize: number = clamp(
    Math.round((track * viewport) / content),
    Math.min(MIN_THUMB_SIZE, track),
    track
  );

  const progress: number = clamp(scroll / overflow, 0, 1);

  return {
    visible: true,
    trackSize: track,
    thumbSize,
    thumbOffset: Math.round((track - thumbSize) * progress)
  };
}

export function scrollForThumbOffset(offset: number, axis: ScrollBarAxis, viewport: number, content: number): number {
  const room: number = axis.trackSize - axis.thumbSize;
  if (room <= 0) return 0;

  return clamp(offset / room, 0, 1) * (content - viewport);
}

export function nearEdge(
  pointer: { x: number; y: number },
  box: ScrollBarBox,
  vertical: boolean,
  horizontal: boolean,
  distance: number = REVEAL_DISTANCE
): boolean {
  const inside: boolean =
    pointer.x >= box.left && pointer.x <= box.left + box.width &&
    pointer.y >= box.top && pointer.y <= box.top + box.height;

  if (!inside) return false;

  const toRight: number = box.left + box.width - pointer.x;
  const toBottom: number = box.top + box.height - pointer.y;

  return (vertical && toRight <= distance) || (horizontal && toBottom <= distance);
}

@Component({
  selector: 'app-scroll-bar',
  templateUrl: './scroll-bar.component.html',
  styleUrl: './scroll-bar.component.scss',
  host: {
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

  readonly endInset: InputSignal<number> = input(0);

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

  protected readonly revealed: Signal<boolean> = computed((): boolean =>
    this.dragging() || this.pointerOnBar() || this.pointerNear() || this.scrolling(),
  );

  constructor() {
    afterNextRender((): void => this.rendered.set(true));

    effect((onCleanup): void => {
      const target: HTMLElement = this.target();
      if (!this.rendered()) return;

      onCleanup(this.attach(target));
    });
  }

  protected grab(event: PointerEvent, axis: ScrollBarAxisName): void {
    if (event.button !== 0) return;

    const track: HTMLElement | undefined = this.trackFor(axis)?.nativeElement;
    if (!track) return;

    const along: (pointer: PointerEvent) => number = (pointer: PointerEvent): number => {
      const rect: DOMRect = track.getBoundingClientRect();
      return axis === 'y' ? pointer.clientY - rect.top : pointer.clientX - rect.left;
    };

    const state: ScrollBarAxis = axis === 'y' ? this.vertical() : this.horizontal();
    const pointer: number = along(event);
    const onThumb: boolean = pointer >= state.thumbOffset && pointer <= state.thumbOffset + state.thumbSize;

    const held: number = onThumb ? pointer - state.thumbOffset : state.thumbSize / 2;
    if (!onThumb) this.scrollTo(axis, pointer - held);

    track.setPointerCapture(event.pointerId);
    this.dragging.set(true);

    const move: (moved: PointerEvent) => void = (moved: PointerEvent): void => this.scrollTo(axis, along(moved) - held);
    const release: () => void = (): void => {
      track.removeEventListener('pointermove', move);
      track.removeEventListener('pointerup', release);
      track.removeEventListener('pointercancel', release);
      this.dragging.set(false);
    };

    track.addEventListener('pointermove', move);
    track.addEventListener('pointerup', release);
    track.addEventListener('pointercancel', release);

    event.preventDefault();
  }

  private attach(target: HTMLElement): () => void {
    target.classList.add(NATIVE_BAR_HIDDEN);

    const measure: () => void = (): void => this.measure();

    const cleanups: (() => void)[] = this.zone.runOutsideAngular((): (() => void)[] => {
      const scrolled: () => void = (): void => {
        this.measure();
        this.flashOnScroll();
      };

      target.addEventListener('scroll', scrolled, { passive: true });

      target.addEventListener('input', measure);

      const track: (event: PointerEvent) => void = (event: PointerEvent): void => this.trackPointer(event);
      const leave: () => void = (): void => this.pointerNear.set(false);

      target.addEventListener('pointermove', track, { passive: true });
      target.addEventListener('pointerleave', leave);

      const enterBar: () => void = (): void => this.pointerOnBar.set(true);
      const leaveBar: () => void = (): void => this.pointerOnBar.set(false);
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

      if (typeof ResizeObserver !== 'function') return stop;

      const sizes: ResizeObserver = new ResizeObserver(measure);

      const observe: () => void = (): void => {
        sizes.disconnect();
        sizes.observe(target);

        for (const child of target.children) sizes.observe(child);

        const parent: Element | null = this.host.nativeElement.offsetParent;
        if (parent) sizes.observe(parent);
      };

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
      this.horizontal().visible
    ));
  }

  private flashOnScroll(): void {
    this.scrolling.set(true);

    clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout((): void => this.scrolling.set(false), SCROLL_REVEAL_MS);
  }

  private viewportBox(): ScrollBarBox {
    const target: HTMLElement = this.target();
    const rect: DOMRect = target.getBoundingClientRect();

    return {
      top: rect.top + target.clientTop,
      left: rect.left + target.clientLeft,
      width: target.clientWidth,
      height: target.clientHeight
    };
  }

  private measure(): void {
    const vertical: HTMLElement | undefined = this.verticalTrack()?.nativeElement;
    const horizontal: HTMLElement | undefined = this.horizontalTrack()?.nativeElement;
    if (!vertical || !horizontal) return;

    const target: HTMLElement = this.target();

    const thickness: number = vertical.offsetWidth || horizontal.offsetHeight;

    const style: CSSStyleDeclaration | undefined = this.document.defaultView?.getComputedStyle(target);
    const scrollableY: boolean = !style || style.overflowY === 'auto' || style.overflowY === 'scroll';
    const scrollableX: boolean = !style || style.overflowX === 'auto' || style.overflowX === 'scroll';

    const scrollHeight: number = scrollableY ? target.scrollHeight : target.clientHeight;
    const scrollWidth: number = scrollableX ? target.scrollWidth : target.clientWidth;

    const needsVertical: boolean = scrollHeight - target.clientHeight > 1;
    const needsHorizontal: boolean = scrollWidth - target.clientWidth > 1;

    this.box.set(this.boxOf(target));

    const inset: number = this.endInset();

    this.vertical.set(scrollBarAxis(
      target.clientHeight - (needsHorizontal ? thickness : 0) - inset,
      target.clientHeight,
      scrollHeight,
      target.scrollTop
    ));

    this.horizontal.set(scrollBarAxis(
      target.clientWidth - (needsVertical ? thickness : 0) - inset,
      target.clientWidth,
      scrollWidth,
      target.scrollLeft
    ));
  }

  private boxOf(target: HTMLElement): ScrollBarBox {
    const rect: DOMRect = target.getBoundingClientRect();
    const size = { width: target.clientWidth, height: target.clientHeight };
    const parent: Element | null = this.host.nativeElement.offsetParent;

    if (!parent) {
      const view: (Window & typeof globalThis) | null = this.document.defaultView;
      return {
        top: rect.top + target.clientTop + (view?.scrollY ?? 0),
        left: rect.left + target.clientLeft + (view?.scrollX ?? 0),
        ...size
      };
    }

    const origin: DOMRect = parent.getBoundingClientRect();

    return {
      top: rect.top - origin.top - parent.clientTop + parent.scrollTop + target.clientTop,
      left: rect.left - origin.left - parent.clientLeft + parent.scrollLeft + target.clientLeft,
      ...size
    };
  }

  private scrollTo(axis: ScrollBarAxisName, offset: number): void {
    const target: HTMLElement = this.target();

    if (axis === 'y') {
      target.scrollTop = scrollForThumbOffset(
        offset, this.vertical(), target.clientHeight, target.scrollHeight
      );
    } else {
      target.scrollLeft = scrollForThumbOffset(
        offset, this.horizontal(), target.clientWidth, target.scrollWidth
      );
    }

    this.measure();
  }

  private trackFor(axis: ScrollBarAxisName): ElementRef<HTMLElement> | undefined {
    return axis === 'y' ? this.verticalTrack() : this.horizontalTrack();
  }
}