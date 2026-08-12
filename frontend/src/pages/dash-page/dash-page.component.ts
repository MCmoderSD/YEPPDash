import { Component, computed, effect, inject, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatSidenavContainer, MatSidenavModule } from '@angular/material/sidenav';
import { SidebarComponent } from '../../components/sidebar-component/sidebar.component';
import { SidebarService } from '../../services/sidebar.service';

@Component({
  selector: 'app-dash-page',
  templateUrl: './dash-page.component.html',
  styleUrl: './dash-page.component.scss',
  imports: [RouterOutlet, MatSidenavModule, SidebarComponent],
})
export class DashPageComponent {

  protected readonly sidebar: SidebarService = inject(SidebarService);

  // Optional rather than required: the effect below runs on the first change detection, which is
  // also when this resolves, and a required query throws if it is read a moment too early.
  private readonly shell: Signal<MatSidenavContainer | undefined> = viewChild(MatSidenavContainer);

  // A collapsed drawer opens far enough to read while the pointer is on it, and shuts again when it
  // leaves. Focus counts as well, so tabbing into the rail reaches labelled entries rather than a
  // column of bare icons.
  private readonly peeking: WritableSignal<boolean> = signal(false);

  // Collapsed only means anything where the drawer is permanent: an overlay is either over the page
  // in full or not there at all. True while peeking too, because a drawer that opens over the
  // content has to keep sitting above it for as long as it is open.
  protected readonly collapsed: Signal<boolean> = computed((): boolean =>
    this.sidebar.wide() && !this.sidebar.expanded());

  // The rail proper: collapsed and not currently being looked at.
  protected readonly rail: Signal<boolean> = computed((): boolean => this.collapsed() && !this.peeking());

  constructor() {
    // Material measures the drawer when it opens and never again — autosize is off by default, and
    // a width changed in CSS is not something it watches. That is what lets the drawer open back
    // over the content on hover, but it also means the content would keep a full drawer's margin
    // beside a rail. Remeasured here whenever the kept shape changes; the transition below has the
    // last word once the width has actually settled.
    effect((): void => {
      this.sidebar.expanded();
      this.shell()?.updateContentMargins();
    });
  }

  protected peek(peeking: boolean): void {
    // Only the engage side is gated on being collapsed; leaving always clears the flag. Gating both
    // sides let the pin toggle while the pointer sat still over the drawer leave `peeking` stuck at
    // true — the matching mouseleave/focusout would fire once collapsed() had already changed, and
    // the guard would block the very reset it existed to run.
    this.peeking.set(peeking && this.collapsed());
  }

  protected settled(event: TransitionEvent): void {
    // Only the drawer's own width, and only at a width it is going to keep: one the pointer pulled
    // open is meant to lie over the content, not push it aside.
    if (event.propertyName !== 'width' || event.target !== event.currentTarget) return;

    if (!this.peeking()) this.shell()?.updateContentMargins();
  }
}
