import { TestBed } from '@angular/core/testing';
import { Router, RouterModule } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DashModule } from '../../pages/dash.module';
import { SidebarComponent } from './sidebar.component';
import { SidebarService } from '../../services/sidebar.service';

describe('SidebarComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        DashModule,
        // The real route lives in DashModule's forChild config, which only reaches the router
        // through lazy loading, so the target is restated here to make navigation possible.
        RouterModule.forRoot([{ path: 'dash/role-management', component: SidebarComponent }]),
      ],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()],
    }).compileComponents();
  });

  function links(): HTMLAnchorElement[] {
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();

    return [...(fixture.nativeElement as HTMLElement).querySelectorAll('a')];
  }

  it('should offer both role management sections', () => {
    expect(links().map((link) => link.textContent!.trim().replace(/\s+/g, ' ')))
      .toEqual(['shieldModerator Management', 'starVIP Management']);
  });

  it('should point both entries at role management in their own mode', () => {
    expect(links().map((link) => link.getAttribute('href')))
      .toEqual(['/dash/role-management?mode=moderator', '/dash/role-management?mode=vip']);
  });

  it('should mark only the entry matching the current mode as active', async () => {
    const router = TestBed.inject(Router);
    const navigated = await router.navigateByUrl('/dash/role-management?mode=vip');
    expect([navigated, router.url]).toEqual([true, '/dash/role-management?mode=vip']);

    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();

    // RouterLinkActive defers its own update to a microtask, so one round of change detection
    // straight after creating the component is too early to see the result.
    await Promise.resolve();
    fixture.detectChanges();

    const active = [...(fixture.nativeElement as HTMLElement).querySelectorAll('a')]
      .map((link) => link.getAttribute('aria-current'));

    // Both entries share a path and differ only in ?mode=, so query params have to be compared.
    expect(active).toEqual([null, 'page']);
  });

  it('should minimize the drawer once an entry is picked', () => {
    const sidebar = TestBed.inject(SidebarService);
    sidebar.toggle();
    expect(sidebar.opened()).toBe(true);

    links()[0].click();

    expect(sidebar.opened()).toBe(false);
  });
});
