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

  it('should offer every management section', () => {
    expect(links().map((link) => link.textContent!.trim().replace(/\s+/g, ' ')))
      .toEqual([
        'shieldModerator Management',
        'starVIP Management',
        'format_quoteQuote Management',
        'cakeFollower Birthdays',
      ]);
  });

  it('should point each entry at its own section', () => {
    expect(links().map((link) => link.getAttribute('href')))
      .toEqual([
        '/dash/role-management?mode=0',
        '/dash/role-management?mode=1',
        '/dash/quotes',
        '/dash/birthdays',
      ]);
  });

  it('should mark only the entry matching the current mode as active', async () => {
    const router = TestBed.inject(Router);
    const navigated = await router.navigateByUrl('/dash/role-management?mode=1');
    expect([navigated, router.url]).toEqual([true, '/dash/role-management?mode=1']);

    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();

    // RouterLinkActive defers its own update to a microtask, so one round of change detection
    // straight after creating the component is too early to see the result.
    await Promise.resolve();
    fixture.detectChanges();

    const active = [...(fixture.nativeElement as HTMLElement).querySelectorAll('a')]
      .map((link) => link.getAttribute('aria-current'));

    // The two role entries share a path and differ only in ?mode=, so query params have to be
    // compared — matching on the path alone would light up both.
    expect(active).toEqual([null, 'page', null, null]);
  });

  it('should minimize the drawer once an entry is picked', () => {
    const sidebar = TestBed.inject(SidebarService);
    sidebar.toggle();
    expect(sidebar.opened()).toBe(true);

    links()[0].click();

    expect(sidebar.opened()).toBe(false);
  });
});
