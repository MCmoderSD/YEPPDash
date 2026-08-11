import { Service, signal, Signal, WritableSignal } from '@angular/core';

@Service()
export class SidebarService {

  private readonly state: WritableSignal<boolean> = signal(false);

  readonly opened: Signal<boolean> = this.state.asReadonly();

  toggle(): void {
    this.state.update((open) => !open);
  }

  open(): void {
    this.state.set(true);
  }

  close(): void {
    this.state.set(false);
  }
}