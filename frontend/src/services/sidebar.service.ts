import { DOCUMENT } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { computed, inject, Service, signal, Signal, WritableSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';


const WIDE: string = '(min-width: 60rem)';
const STORAGE_KEY: string = 'yeppdash.sidebar-expanded';

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

  private readonly present: WritableSignal<boolean> = signal(false);

  readonly available: Signal<boolean> = this.present.asReadonly();

  readonly expanded: Signal<boolean> = this.pinned.asReadonly();

  readonly opened: Signal<boolean> = computed((): boolean => this.wide() || this.overlay());

  register(): () => void {
    this.present.set(true);

    return (): void => {
      this.present.set(false);
      this.overlay.set(false);
    };
  }

  toggle(): void {
    if (this.wide()) {
      this.pin(!this.pinned());
      return;
    }

    this.overlay.update((open: boolean): boolean => !open);
  }

  show(): void {
    if (this.wide()) this.pin(true);
    else this.overlay.set(true);
  }

  hide(): void {
    if (this.wide()) this.pin(false);
    else this.overlay.set(false);
  }

  close(): void {
    this.overlay.set(false);
  }

  private pin(expanded: boolean): void {
    this.pinned.set(expanded);
    this.persist(expanded);
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