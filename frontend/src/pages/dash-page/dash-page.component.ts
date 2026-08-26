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

  private readonly shell: Signal<MatSidenavContainer | undefined> = viewChild(MatSidenavContainer);
  private readonly peeking: WritableSignal<boolean> = signal(false);

  protected readonly collapsed: Signal<boolean> = computed((): boolean => this.sidebar.wide() && !this.sidebar.expanded());
  protected readonly rail: Signal<boolean> = computed((): boolean => this.collapsed() && !this.peeking());

  constructor() {
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