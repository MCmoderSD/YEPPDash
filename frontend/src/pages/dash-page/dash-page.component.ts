import { afterNextRender, Component, computed, DestroyRef, effect, inject, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatSidenavContainer, MatSidenavModule } from '@angular/material/sidenav';
import { SidebarComponent } from '../../components/sidebar-component/sidebar.component';
import { SidebarService } from '../../services/sidebar.service';
import { FaqDrawerComponent } from '../../components/faq-drawer-component/faq-drawer.component';
import { FaqDrawerService } from '../../services/faq-drawer.service';
import { DrawerSwipeService } from '../../services/drawer-swipe.service';

@Component({
  selector: 'app-dash-page',
  templateUrl: './dash-page.component.html',
  styleUrl: './dash-page.component.scss',
  imports: [RouterOutlet, MatSidenavModule, SidebarComponent, FaqDrawerComponent],
})
export class DashPageComponent {

  protected readonly sidebar: SidebarService = inject(SidebarService);

  private readonly faq: FaqDrawerService = inject(FaqDrawerService);

  private readonly swipes: DrawerSwipeService = inject(DrawerSwipeService);

  private readonly shell: Signal<MatSidenavContainer | undefined> = viewChild(MatSidenavContainer);
  private readonly peeking: WritableSignal<boolean> = signal(false);

  protected readonly collapsed: Signal<boolean> = computed((): boolean => this.sidebar.wide() && !this.sidebar.expanded());
  protected readonly rail: Signal<boolean> = computed((): boolean => this.collapsed() && !this.peeking());

  constructor() {
    const destroyRef: DestroyRef = inject(DestroyRef);

    destroyRef.onDestroy(this.sidebar.register());
    destroyRef.onDestroy(this.faq.register());
    afterNextRender((): void => {
      destroyRef.onDestroy(this.swipes.attach());
    });

    effect((): void => {
      this.sidebar.expanded();
      this.shell()?.updateContentMargins();
    });
  }

  protected peek(peeking: boolean): void {
    this.peeking.set(peeking && this.collapsed());
  }

  protected settled(event: TransitionEvent): void {
    if (event.propertyName !== 'width' || event.target !== event.currentTarget) return;
    if (!this.peeking()) this.shell()?.updateContentMargins();
  }
}