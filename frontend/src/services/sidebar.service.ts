import { Service, signal, Signal, WritableSignal } from '@angular/core';

@Service()
export class SidebarService {

  private readonly state: WritableSignal<boolean> = signal(false);

  readonly opened: Signal<boolean> = this.state.asReadonly();

  toggle(): void {
    this.state.update((open) => !open);
  }

  // Called when the layout gains the room to keep the drawer alongside the content, where it is
  // permanent furniture rather than something the user opens.
  open(): void {
    this.state.set(true);
  }

  close(): void {
    this.state.set(false);
  }
}