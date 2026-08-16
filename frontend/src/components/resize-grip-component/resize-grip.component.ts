import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, effect, EffectCleanupRegisterFn, ElementRef, inject, input, InputSignal, NgZone, signal, WritableSignal } from "@angular/core";

export const RESIZE_GRIP_SIZE: number = 14;

const MIN_HEIGHT: number = 72;

interface GripCorner {
  top: number;
  left: number;
}

const NO_CORNER: GripCorner = { top: 0, left: 0 };

@Component({
  selector: 'app-resize-grip',
  host: {
    'aria-hidden': 'true',
    '[style.top.px]': 'corner().top',
    '[style.left.px]': 'corner().left',
    '[style.width.px]': 'size',
    '[style.height.px]': 'size',
    '[class.resize-grip-dragging]': 'dragging()',
    '(pointerdown)': 'grab($event)'
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
  `
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
    afterNextRender((): void => this.rendered.set(true));

    effect((onCleanup: EffectCleanupRegisterFn): void => {
      const target: HTMLElement = this.target();
      if (!this.rendered()) return;
      onCleanup(this.attach(target));
    });
  }

  protected grab(event: PointerEvent): void {
    if (event.button !== 0) return;

    const target: HTMLElement = this.target();
    const host: HTMLElement = this.host.nativeElement;

    const startY: number = event.clientY;
    const startHeight: number = target.offsetHeight;

    host.setPointerCapture(event.pointerId);
    this.dragging.set(true);

    const move: (moved: PointerEvent) => void = (moved: PointerEvent): void => {
      const height: number = Math.max(MIN_HEIGHT, startHeight + (moved.clientY - startY));

      target.style.height = `${height}px`;

      this.place(target);
    };

    const release: () => void = (): void => {
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerup', release);
      host.removeEventListener('pointercancel', release);
      this.dragging.set(false);
    };

    host.addEventListener('pointermove', move);
    host.addEventListener('pointerup', release);
    host.addEventListener('pointercancel', release);

    event.preventDefault();
  }

  private attach(target: HTMLElement): () => void {
    this.place(target);

    const place: () => void = (): void => this.place(target);

    return this.zone.runOutsideAngular((): (() => void) => {
      target.addEventListener('input', place);

      const view: (Window & typeof globalThis) | null = this.document.defaultView;
      view?.addEventListener('resize', place, { passive: true });

      const sizes: ResizeObserver | undefined =
        typeof ResizeObserver === 'function' ? new ResizeObserver(place) : undefined;

      sizes?.observe(target);

      const settling: number = view?.requestAnimationFrame(place) ?? 0;

      const parent: Element | null = this.host.nativeElement.offsetParent;
      if (parent) sizes?.observe(parent);

      const settled: Element = parent ?? target;
      settled.addEventListener('transitionend', place);
      settled.addEventListener('animationend', place);
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

    this.corner.set({
      top: bottom - origin.top - parent.clientTop + parent.scrollTop - RESIZE_GRIP_SIZE,
      left: right - origin.left - parent.clientLeft + parent.scrollLeft - RESIZE_GRIP_SIZE,
    });
  }
}