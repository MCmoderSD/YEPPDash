import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, RouterModule } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DashModule } from '../../pages/dash.module';
import { SidebarComponent } from './sidebar.component';
import { SidebarService } from '../../services/sidebar.service';
import { groupForUrl, NAV_GROUPS } from '../../data/dash-nav';

describe('groupForUrl', () => {

  it('should find the group a path belongs to', () => {
    expect(groupForUrl(NAV_GROUPS, '/dash/wheel')).toBe('entertainment');
  });

  it('should ignore the query string', () => {
    // Both role entries share a path and differ only in ?mode=, and either way the group is the
    // same one — comparing the query would only make this miss.
    expect(groupForUrl(NAV_GROUPS, '/dash/role-management?mode=1')).toBe('management');
  });

  it('should find nothing for a path outside the navigation', () => {
    expect(groupForUrl(NAV_GROUPS, '/dash')).toBeUndefined();
  });
});

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

  function render(): ComponentFixture<SidebarComponent> {
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();

    return fixture;
  }

  function anchors(fixture: ComponentFixture<SidebarComponent>): HTMLAnchorElement[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll('a')];
  }

  function links(): HTMLAnchorElement[] {
    return anchors(render());
  }

  function headings(fixture: ComponentFixture<SidebarComponent>): HTMLButtonElement[] {
    return [...(fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('.sidebar-group-button')];
  }

  it('should offer every section, grouped', () => {
    expect(links().map((link) => link.textContent!.trim().replace(/\s+/g, ' ')))
      .toEqual([
        'space_dashboardOverview',
        'shieldModerators',
        'starVIPs',
        'format_quoteQuotes',
        'terminalCommands',
        'groupMembers',
        'cakeBirthdays',
        'casinoLucky Wheel',
        'psychologyBDSM Test',
      ]);
  });

  it('should head each group with a disclosure button', () => {
    expect(headings(render()).map((button) => button.textContent!.trim().replace(/\s+/g, ' ')))
      .toEqual([
        'tuneManagementexpand_more',
        'diversity_3Communityexpand_more',
        'sports_esportsEntertainmentexpand_more',
      ]);
  });

  it('should point each entry at its own section', () => {
    expect(links().map((link) => link.getAttribute('href')))
      .toEqual([
        '/dash',
        '/dash/role-management?mode=0',
        '/dash/role-management?mode=1',
        '/dash/quotes',
        '/dash/commands',
        '/dash/community',
        '/dash/birthdays',
        '/dash/wheel',
        '/dash/bdsm',
      ]);
  });

  it('should mark only the entry matching the current mode as active', async () => {
    const router = TestBed.inject(Router);
    const navigated = await router.navigateByUrl('/dash/role-management?mode=1');
    expect([navigated, router.url]).toEqual([true, '/dash/role-management?mode=1']);

    const fixture = render();

    // RouterLinkActive defers its own update to a microtask, so one round of change detection
    // straight after creating the component is too early to see the result.
    await Promise.resolve();
    fixture.detectChanges();

    const active = anchors(fixture).map((link) => link.getAttribute('aria-current'));

    // The two role entries share a path and differ only in ?mode=, so query params have to be
    // compared — matching on the path alone would light up both.
    expect(active).toEqual([null, null, 'page', null, null, null, null, null, null]);
  });

  it('should start with every group open', () => {
    expect(headings(render()).map((button) => button.getAttribute('aria-expanded')))
      .toEqual(['true', 'true', 'true']);
  });

  it('should collapse and reopen a group from its heading', () => {
    const fixture = render();
    const management = headings(fixture)[0];

    management.click();
    fixture.detectChanges();

    expect(management.getAttribute('aria-expanded')).toBe('false');

    // Kept in the DOM so the collapse can be animated. The open class is what drives both the
    // animation and the visibility that keeps the links inside out of the tab order while shut.
    const items = (fixture.nativeElement as HTMLElement).querySelector('#sidebar-group-management');
    expect(items!.classList.contains('sidebar-group-items-open')).toBe(false);

    management.click();
    fixture.detectChanges();

    expect(management.getAttribute('aria-expanded')).toBe('true');
  });

  it('should leave the other groups alone when one is collapsed', () => {
    const fixture = render();

    headings(fixture)[0].click();
    fixture.detectChanges();

    expect(headings(fixture).map((button) => button.getAttribute('aria-expanded')))
      .toEqual(['false', 'true', 'true']);
  });

  it('should reopen a collapsed group when the route moves into it', async () => {
    const fixture = render();
    const management = headings(fixture)[0];

    management.click();
    fixture.detectChanges();
    expect(management.getAttribute('aria-expanded')).toBe('false');

    // Arriving from outside the sidebar — a bookmark, a redirect, the back button — would otherwise
    // leave the entry marked as the current page hidden inside a shut group.
    await TestBed.inject(Router).navigateByUrl('/dash/role-management?mode=0');
    fixture.detectChanges();

    expect(management.getAttribute('aria-expanded')).toBe('true');
  });

  it('should minimize the drawer once an entry is picked', () => {
    const sidebar = TestBed.inject(SidebarService);
    sidebar.toggle();
    expect(sidebar.opened()).toBe(true);

    links()[0].click();

    expect(sidebar.opened()).toBe(false);
  });
});