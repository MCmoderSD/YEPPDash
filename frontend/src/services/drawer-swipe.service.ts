import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';
import { FaqDrawerService } from './faq-drawer.service';
import { SidebarService } from './sidebar.service';

export type SwipeDirection = 'left' | 'right';

export type SwipeOrigin = 'nav' | 'faq' | 'left-edge' | 'right-edge' | 'page';

export type SwipeAction = 'show-nav' | 'hide-nav' | 'open-faq' | 'close-faq';

export interface SwipeState {
  readonly navOverlay: boolean;
  readonly faqAvailable: boolean;
  readonly faqOpened: boolean;
}

export interface SwipePoint {
  readonly x: number;
  readonly y: number;
  readonly time: number;
}

interface SwipeStart extends SwipePoint {
  readonly origin: SwipeOrigin;
}

const EDGE_SHARE: number = 0.2;
const EDGE_MIN: number = 64;
const EDGE_MAX: number = 160;
const MIN_DISTANCE: number = 56;
const MAX_DURATION: number = 1000;

export function edgeWidth(viewport: number): number {
  return Math.min(Math.max(viewport * EDGE_SHARE, EDGE_MIN), EDGE_MAX);
}

export function swipeDirection(start: SwipePoint, end: SwipePoint): SwipeDirection | null {
  const dx: number = end.x - start.x;
  const dy: number = end.y - start.y;

  if (Math.abs(dx) < MIN_DISTANCE) return null;
  if (Math.abs(dy) * 2 > Math.abs(dx)) return null;
  if (end.time - start.time > MAX_DURATION) return null;

  return dx > 0 ? 'right' : 'left';
}

export function swipeAction(origin: SwipeOrigin, direction: SwipeDirection, state: SwipeState): SwipeAction | null {
  if (origin === 'faq') return direction === 'right' && state.faqOpened ? 'close-faq' : null;

  if (direction === 'right') return origin === 'nav' || origin === 'left-edge' ? 'show-nav' : null;

  if (origin === 'nav' || state.navOverlay) return 'hide-nav';
  if (origin === 'right-edge' && state.faqAvailable && !state.faqOpened) return 'open-faq';

  return null;
}

@Service()
export class DrawerSwipeService {

  private readonly document: Document = inject(DOCUMENT);
  private readonly sidebar: SidebarService = inject(SidebarService);
  private readonly faq: FaqDrawerService = inject(FaqDrawerService);

  attach(): () => void {
    const view: (Window & typeof globalThis) | null = this.document.defaultView;
    if (!view) return (): void => undefined;

    let start: SwipeStart | null = null;

    const began = (event: TouchEvent): void => {
      const touch: Touch | undefined = event.touches.length === 1 ? event.touches[0] : undefined;

      start = touch && !this.scrollsSideways(event.target)
        ? {
          x: touch.clientX,
          y: touch.clientY,
          time: event.timeStamp,
          origin: this.originOf(touch.clientX, event.target, view.innerWidth),
        }
        : null;
    };

    const ended = (event: TouchEvent): void => {
      const from: SwipeStart | null = start;
      const touch: Touch | undefined = event.changedTouches[0];

      start = null;
      if (!from || !touch || event.touches.length > 0) return;

      const direction: SwipeDirection | null =
        swipeDirection(from, { x: touch.clientX, y: touch.clientY, time: event.timeStamp });

      if (direction) this.apply(swipeAction(from.origin, direction, this.state()));
    };

    const cancelled = (): void => {
      start = null;
    };

    this.document.addEventListener('touchstart', began, { passive: true });
    this.document.addEventListener('touchend', ended, { passive: true });
    this.document.addEventListener('touchcancel', cancelled, { passive: true });

    return (): void => {
      this.document.removeEventListener('touchstart', began);
      this.document.removeEventListener('touchend', ended);
      this.document.removeEventListener('touchcancel', cancelled);
    };
  }

  private originOf(x: number, target: EventTarget | null, width: number): SwipeOrigin {
    const element: Element | null = target instanceof Element ? target : null;

    if (this.faq.opened() && element?.closest('app-faq-drawer')) return 'faq';
    if (element?.closest('.dash-drawer')) return 'nav';
    const edge: number = edgeWidth(width);

    if (x <= edge) return 'left-edge';
    if (x >= width - edge) return 'right-edge';

    return 'page';
  }

  private scrollsSideways(target: EventTarget | null): boolean {
    const view: (Window & typeof globalThis) | null = this.document.defaultView;
    let node: Element | null = target instanceof Element ? target : null;

    while (view && node && node !== this.document.body) {
      const overflow: string = view.getComputedStyle(node).overflowX;
      if ((overflow === 'auto' || overflow === 'scroll') && node.scrollWidth > node.clientWidth + 1) return true;

      node = node.parentElement;
    }

    return false;
  }

  private state(): SwipeState {
    return {
      navOverlay: !this.sidebar.wide() && this.sidebar.opened(),
      faqAvailable: this.faq.available(),
      faqOpened: this.faq.opened(),
    };
  }

  private apply(action: SwipeAction | null): void {
    switch (action) {
      case 'show-nav':
        this.sidebar.show();
        break;
      case 'hide-nav':
        this.sidebar.hide();
        break;
      case 'open-faq':
        this.faq.open();
        break;
      case 'close-faq':
        this.faq.dismiss();
        break;
    }
   }
}