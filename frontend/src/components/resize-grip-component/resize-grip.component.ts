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
  signal,
  WritableSignal,
} from '@angular/core';

// The side of the square the grip occupies, in pixels. Matched to the native resizer it replaces:
// small enough to stay out of the way of the text, large enough to be aimed at.
//
// Exported because whoever draws a scroll bar over the same element has to keep this much of the
// corner free — see the endInset input on ScrollBarComponent.
export const RESIZE_GRIP_SIZE = 14;

// Nothing useful is left of a text box shorter than this, and a drag that can collapse one to a
// sliver is a drag that can lose the caret off the bottom of it.
const MIN_HEIGHT = 72;

interface GripCorner {
  top: number;
  left: number;
}

const NO_CORNER: GripCorner = { top: 0, left: 0 };

/**
 * The app's own resize handle, drawn over the bottom corner of the element it is pointed at.
 *
 * Native `resize` is the last place the browser's own chrome shows through a dashboard that draws
 * its own scroll bars, and it cannot be styled anywhere but Blink — `::-webkit-resizer` has no
 * counterpart in Firefox. So the element is given `resize: none` by whoever attaches this, and the
 * corner is drawn and dragged here instead, which looks the same in every engine.
 *
 * Positioned like ScrollBarComponent — absolutely, against the nearest positioned ancestor — and
 * sits a layer above it, so the corner belongs to the grip rather than to the bar that used to
 * swallow it.
 */
@Component({
  selector: 'app-resize-grip',
  host: {
    // A convenience over the element underneath, which scrolls perfectly well at whatever height it
    // already has. There is nothing here to announce and nothing to focus, the same stance the
    // scroll bars take over the scrolling they restate.
    'aria-hidden': 'true',
    '[style.top.px]': 'corner().top',
    '[style.left.px]': 'corner().left',

    // Sized from the same constant the corner is measured with, rather than restated in the CSS
    // below where the two could drift apart.
    '[style.width.px]': 'size',
    '[style.height.px]': 'size',
    '[class.resize-grip-dragging]': 'dragging()',
    '(pointerdown)': 'grab($event)',
  },
  template: `
    <svg viewBox="0 0 12 12" focusable="false" aria-hidden="true">
      <path d="M11 4 4 11M11 8 8 11" />
    </svg>
  `,
  styles: `
    :host {
      position: absolute;

      // One above ScrollBarComponent, which is on 2: the two overlap in exactly this corner, and
      // the bar taking the pointer here is what made the native resizer unreachable.
      z-index: 3;

      display: flex;

      // Vertical only. The width belongs to the form field the box sits in, and a text box dragged
      // narrower than its own label reads as broken rather than as resized.
      cursor: ns-resize;

      color: var(--mat-sys-outline);

      transition: color var(--app-motion-fast) var(--app-ease);
    }

    // Takes the brand colour under the pointer and keeps it for the whole drag, which is mostly
    // spent away from the corner where :hover no longer holds. The same rule and the same colour
    // as both scroll bars, since the grip sits right beside one of them.
    :host(:hover),
    :host(.resize-grip-dragging) {
      color: var(--mat-sys-primary);
    }

    svg {
      width: 100%;
      height: 100%;

      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
    }

    @media (prefers-reduced-motion: reduce) {
      :host {
        transition: none;
      }
    }
  `,
})
export class ResizeGripComponent {

  readonly target: InputSignal<HTMLElement> = input.required<HTMLElement>();

  protected readonly size: number = RESIZE_GRIP_SIZE;

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly zone: NgZone = inject(NgZone);
  private readonly document: Document = inject(DOCUMENT);

  private readonly rendered: WritableSignal<boolean> = signal(false);

  protected readonly corner: WritableSignal<GripCorner> = signal(NO_CORNER);
  protected readonly dragging: WritableSignal<boolean> = signal(false);

  constructor() {
    // Placing the grip reads layout, which exists only once the view is in a document — and never
    // on the server, where afterNextRender does not run at all.
    afterNextRender((): void => this.rendered.set(true));

    effect((onCleanup): void => {
      const target: HTMLElement = this.target();
      if (!this.rendered()) return;

      onCleanup(this.attach(target));
    });
  }

  protected grab(event: PointerEvent): void {
    // Secondary buttons belong to the platform's own menu, as they do on the scroll bars.
    if (event.button !== 0) return;

    const target: HTMLElement = this.target();
    const host: HTMLElement = this.host.nativeElement;

    const startY: number = event.clientY;
    const startHeight: number = target.offsetHeight;

    // Capture keeps the drag alive once the pointer leaves the 14 pixels it started on, which it
    // does immediately.
    host.setPointerCapture(event.pointerId);
    this.dragging.set(true);

    const move = (moved: PointerEvent): void => {
      const height: number = Math.max(MIN_HEIGHT, startHeight + (moved.clientY - startY));

      // Written straight to the element rather than kept in a signal: the height belongs to the
      // element being resized, which outlives this component and is not ours to own.
      target.style.height = `${height}px`;

      this.place(target);
    };

    const release = (): void => {
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerup', release);
      host.removeEventListener('pointercancel', release);
      this.dragging.set(false);
    };

    host.addEventListener('pointermove', move);
    host.addEventListener('pointerup', release);
    host.addEventListener('pointercancel', release);

    // Without this the press starts selecting the text the grip is drawn over.
    event.preventDefault();
  }

  private attach(target: HTMLElement): () => void {
    this.place(target);

    const place = (): void => this.place(target);

    // Outside Angular for the same reason the scroll bars do it: these fire in bursts, and the
    // signal written at the end of them schedules the only render that is needed.
    return this.zone.runOutsideAngular((): (() => void) => {
      // A text box grows with what is typed into it without any element changing size, so typing
      // moves the corner without an observer hearing about it.
      target.addEventListener('input', place);

      const view: (Window & typeof globalThis) | null = this.document.defaultView;
      view?.addEventListener('resize', place, { passive: true });

      const sizes: ResizeObserver | undefined =
        typeof ResizeObserver === 'function' ? new ResizeObserver(place) : undefined;

      sizes?.observe(target);

      // Measured again on the frame after this one. The first pass runs as soon as the view is in
      // the document, which is not yet the moment the layout around it has finished settling —
      // and a grip drawn at the wrong corner is wrong on sight, before anyone reaches for it.
      const settling: number = view?.requestAnimationFrame(place) ?? 0;

      // The offset parent is what the corner is measured against, so its size moving matters as
      // much as the target's. Resolved here rather than kept from earlier: an absolutely
      // positioned element has no offset parent worth reading until it has been laid out once.
      const parent: Element | null = this.host.nativeElement.offsetParent;
      if (parent) sizes?.observe(parent);

      // A ResizeObserver hears about sizes, not about positions, and the corner moves for both.
      // Neither of the two boxes this is attached to changes size while the panel it lives in
      // slides open or the dialog around it animates in — the whole thing simply travels, and the
      // grip would be left behind at wherever it was first measured.
      //
      // Both events bubble, so watching the offset parent covers everything inside it.
      const settled: Element = parent ?? target;
      settled.addEventListener('transitionend', place);
      settled.addEventListener('animationend', place);

      // The last resort, and the one that actually guarantees a correct corner: the grip is a
      // pointer-only affordance, so re-measuring as the pointer arrives means it is right by the
      // time anyone can grab it, whatever moved it in the meantime.
      settled.addEventListener('pointerenter', place, { passive: true });

      return (): void => {
        view?.cancelAnimationFrame(settling);
        target.removeEventListener('input', place);
        view?.removeEventListener('resize', place);
        settled.removeEventListener('transitionend', place);
        settled.removeEventListener('animationend', place);
        settled.removeEventListener('pointerenter', place);
        sizes?.disconnect();
      };
    });
  }

  // The trailing bottom corner of the target's padding box — where a native resizer sits, and the
  // same box ScrollBarComponent lays its bars over.
  private place(target: HTMLElement): void {
    const rect: DOMRect = target.getBoundingClientRect();
    const right: number = rect.left + target.clientLeft + target.clientWidth;
    const bottom: number = rect.top + target.clientTop + target.clientHeight;

    const parent: Element | null = this.host.nativeElement.offsetParent;

    if (!parent) {
      const view: (Window & typeof globalThis) | null = this.document.defaultView;

      this.corner.set({
        top: bottom - RESIZE_GRIP_SIZE + (view?.scrollY ?? 0),
        left: right - RESIZE_GRIP_SIZE + (view?.scrollX ?? 0),
      });

      return;
    }

    const origin: DOMRect = parent.getBoundingClientRect();

    // An absolutely positioned element starts at its offset parent's padding box, and that box
    // travels with the parent's content — hence subtracting the border and adding the scroll.
    this.corner.set({
      top: bottom - origin.top - parent.clientTop + parent.scrollTop - RESIZE_GRIP_SIZE,
      left: right - origin.left - parent.clientLeft + parent.scrollLeft - RESIZE_GRIP_SIZE,
    });
  }
}
