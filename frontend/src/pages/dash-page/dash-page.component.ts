import { Component, effect, inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { map } from 'rxjs';
import { SidebarComponent } from '../../components/sidebar-component/sidebar.component';
import { SidebarService } from '../../services/sidebar.service';

// Below this the drawer has to be an overlay: the content column left beside a 17.5rem drawer is
// too narrow for the tables the dashboard is mostly made of.
const WIDE = '(min-width: 60rem)';

@Component({
  selector: 'app-dash-page',
  templateUrl: './dash-page.component.html',
  styleUrl: './dash-page.component.scss',
  imports: [RouterOutlet, MatSidenavModule, SidebarComponent],
})
export class DashPageComponent {

  protected readonly sidebar: SidebarService = inject(SidebarService);

  private readonly breakpoints: BreakpointObserver = inject(BreakpointObserver);

  // Server-side there is no viewport to measure, and BreakpointObserver reports no match. Starting
  // narrow means the drawer is rendered closed in the prerendered HTML and opens once the browser
  // takes over, rather than flashing open on a phone.
  protected readonly wide: Signal<boolean> = toSignal(
    this.breakpoints.observe(WIDE).pipe(map((state): boolean => state.matches)),
    { initialValue: false },
  );

  constructor() {
    // The drawer is permanent furniture once there is room for it, and closed by default when
    // there is not. Either way the toolbar button still toggles it from there.
    effect((): void => {
      if (this.wide()) this.sidebar.open();
      else this.sidebar.close();
    });
  }
}