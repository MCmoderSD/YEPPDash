import { Service, signal, Signal, WritableSignal } from '@angular/core';

// The toggle button lives in the navbar (always rendered) while the drawer it controls only
// exists inside the lazy dashboard module, so a shared singleton is what connects the two.
@Service()
export class SidebarService {

  private readonly state: WritableSignal<boolean> = signal(false);

  readonly opened: Signal<boolean> = this.state.asReadonly();

  toggle(): void {
    this.state.update((open) => !open);
  }

  close(): void {
    this.state.set(false);
  }
}
