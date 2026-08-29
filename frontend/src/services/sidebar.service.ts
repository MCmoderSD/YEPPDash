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

  private readonly storage: Storage | undefined = inject(DOCUMENT).defaultView?.localStorage;

  private readonly breakpoints: BreakpointObserver = inject(BreakpointObserver);

  readonly wide: Signal<boolean> = toSignal(
    this.breakpoints.observe(WIDE).pipe(map((state): boolean => state.matches)),
    { initialValue: false },
  );

  private readonly pinned: WritableSignal<boolean> = signal(this.restore());

  private readonly overlay: WritableSignal<boolean> = signal(false);

  readonly expanded: Signal<boolean> = this.pinned.asReadonly();

  readonly opened: Signal<boolean> = computed((): boolean => this.wide() || this.overlay());

  toggle(): void {
    if (this.wide()) {
      this.pinned.update((pinned: boolean): boolean => !pinned);
      this.persist(this.pinned());
      return;
    }

    this.overlay.update((open: boolean): boolean => !open);
  }

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