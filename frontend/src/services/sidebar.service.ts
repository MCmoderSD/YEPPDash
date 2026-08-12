import { DOCUMENT } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { computed, inject, Service, signal, Signal, WritableSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

// Below this the drawer has to be an overlay: the content column left beside a 17.5rem drawer is
// too narrow for the tables the dashboard is mostly made of.
const WIDE = '(min-width: 60rem)';

const STORAGE_KEY = 'yeppdash.sidebar-expanded';

@Service()
export class SidebarService {

  // Undefined on the server, where prerendering runs this with no window at all, and in a browser
  // that has disabled storage — both fall back to the default rather than crashing.
  private readonly storage: Storage | undefined = inject(DOCUMENT).defaultView?.localStorage;

  private readonly breakpoints: BreakpointObserver = inject(BreakpointObserver);

  // Server-side there is no viewport to measure and BreakpointObserver reports no match. Starting
  // narrow means the drawer is rendered closed in the prerendered HTML and settles once the browser
  // takes over, rather than flashing open on a phone.
  readonly wide: Signal<boolean> = toSignal(
    this.breakpoints.observe(WIDE).pipe(map((state): boolean => state.matches)),
    { initialValue: false },
  );

  // Whether the drawer is pinned open where there is room for it. Kept across visits: which of the
  // two shapes someone wants is a preference, not something to re-decide on every page load.
  private readonly pinned: WritableSignal<boolean> = signal(this.restore());

  private readonly overlay: WritableSignal<boolean> = signal(false);

  readonly expanded: Signal<boolean> = this.pinned.asReadonly();

  // Permanent furniture once there is room for it — collapsing it leaves the rail, not nothing.
  // Narrower than that it is an overlay, and starts shut.
  readonly opened: Signal<boolean> = computed((): boolean => this.wide() || this.overlay());

  // The one control either shape has: the navbar button. On a wide viewport it decides between the
  // rail and the full drawer, on a narrow one between showing the overlay and not.
  toggle(): void {
    if (this.wide()) {
      this.pinned.update((pinned: boolean): boolean => !pinned);
      this.persist(this.pinned());
      return;
    }

    this.overlay.update((open: boolean): boolean => !open);
  }

  // Only ever the overlay: on a wide viewport `opened` is true regardless, so following a link
  // leaves the drawer where it is instead of shutting it behind you.
  close(): void {
    this.overlay.set(false);
  }

  private restore(): boolean {
    return this.storage?.getItem(STORAGE_KEY) !== 'false';
  }

  private persist(expanded: boolean): void {
    try {
      this.storage?.setItem(STORAGE_KEY, String(expanded));
    } catch {
      // A full quota or storage refused outright still leaves the drawer as it is for this session.
    }
  }
}
