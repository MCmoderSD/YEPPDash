import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { vi } from 'vitest';
import { ComponentsModule } from '../components.module';
import { NavbarComponent } from './navbar.component';
import { AuthService } from '../../services/auth.service';
import { TwitchService } from '../../services/twitch.service';
import { SidebarService } from '../../services/sidebar.service';
import { TwitchUser } from '../../data/twitch-user';

const USER: TwitchUser = {
  id: '164284617',
  login: 'mcmodersd',
  displayName: 'MCmoderSD',
  type: '',
  broadcasterType: 'affiliate',
  description: 'Just a dev',
  profileImageUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/avatar-300x300.png',
  offlineImageUrl: null,
  createdAt: '2017-05-01T00:00:00Z',
  email: 'mail@mcmodersd.de',
};

class FakeAuthService {
  readonly currentUser = signal<TwitchUser | null>(null);

  loginUrl(returnPath: string): string {
    return `https://api.test/auth/login?returnUrl=${returnPath}`;
  }

  async logout(): Promise<void> { }
}

describe('NavbarComponent', () => {
  let auth: FakeAuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComponentsModule, RouterModule.forRoot([])],
      providers: [
        { provide: AuthService, useClass: FakeAuthService },
        // The user menu pulls in TwitchService, which needs an HttpClient — declared here
        // rather than relying on it happening to resolve from somewhere else.
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
      ],
    }).compileComponents();

    auth = TestBed.inject(AuthService) as unknown as FakeAuthService;
  });

  it('should hide the dashboard menu toggle while signed out', () => {
    const fixture = TestBed.createComponent(NavbarComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement)
      .querySelector('[aria-label="Toggle dashboard navigation"]')).toBeNull();
  });

  it('should toggle the shared sidebar state once signed in', () => {
    const fixture = TestBed.createComponent(NavbarComponent);
    auth.currentUser.set(USER);
    fixture.detectChanges();

    const toggle = vi.spyOn(TestBed.inject(SidebarService), 'toggle');

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[aria-label="Toggle dashboard navigation"]')!.click();

    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('should show a login link while signed out', () => {
    const fixture = TestBed.createComponent(NavbarComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('a[href*="/auth/login"]')).toBeTruthy();
    expect(compiled.querySelector('app-user-menu')).toBeNull();
  });

  // A narrow bar drops "with Twitch" from the visible label, which the stylesheet does and jsdom
  // therefore cannot see. What is checkable here is that both halves are in the DOM for a wide bar
  // to show, and that the accessible name keeps saying the whole thing at either width.
  it('should keep the full login wording as the accessible name', () => {
    const fixture = TestBed.createComponent(NavbarComponent);
    fixture.detectChanges();

    const login = (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLAnchorElement>('a[href*="/auth/login"]')!;

    expect(login.getAttribute('aria-label')).toBe('Login with Twitch');
    expect(login.textContent).toContain('Login with Twitch');
  });

  it('should sit the FAQ link ahead of the login link', () => {
    const fixture = TestBed.createComponent(NavbarComponent);
    fixture.detectChanges();

    const end = (fixture.nativeElement as HTMLElement).querySelector('.navbar-end')!;
    const order = [...end.querySelectorAll('.navbar-faq, a[href*="/auth/login"]')]
      .map((link) => link.classList.contains('navbar-faq') ? 'faq' : 'login');

    expect(order).toEqual(['faq', 'login']);
  });

  it('should keep the FAQ link once signed in', () => {
    const fixture = TestBed.createComponent(NavbarComponent);
    auth.currentUser.set(USER);
    fixture.detectChanges();

    const end = (fixture.nativeElement as HTMLElement).querySelector('.navbar-end')!;
    expect(end.querySelector('.navbar-faq')).toBeTruthy();

    const order = [...end.children].map((child) => child.classList.contains('navbar-faq'));
    expect(order[0]).toBe(true);

    // Signed in, a narrow bar hands the FAQ over to the account menu, which the stylesheet keys off
    // this class. The link stays in the DOM either way, so the class is the part to pin down.
    expect(end.classList).toContain('navbar-end-authed');
  });

  // Whatever the bar hides on a phone still has to be reachable there, and the account menu is the
  // only thing left holding navigation once the FAQ link is gone.
  it('should offer the FAQ from the account menu', () => {
    const fixture = TestBed.createComponent(NavbarComponent);
    auth.currentUser.set(USER);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.user-menu-trigger')!.click();
    fixture.detectChanges();

    expect(document.querySelector<HTMLAnchorElement>('.user-menu-faq')!.getAttribute('href'))
      .toBe('/faq');
  });

  // Not the production host under test, so the FAQ stays a routed link rather than an absolute one.
  it('should route to the FAQ rather than reload the page', () => {
    const fixture = TestBed.createComponent(NavbarComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement)
      .querySelector<HTMLAnchorElement>('.navbar-faq')!.getAttribute('href')).toBe('/faq');
  });

  it('should swap the login link for the user menu once signed in', () => {
    const fixture = TestBed.createComponent(NavbarComponent);
    auth.currentUser.set(USER);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('a[href*="/auth/login"]')).toBeNull();

    const trigger = compiled.querySelector('.user-menu-trigger');
    expect(trigger?.textContent).toContain('MCmoderSD');
    expect(compiled.querySelector<HTMLImageElement>('.user-menu-avatar')?.src)
      .toContain('avatar-300x300.png');
  });

  it('should reveal id, email and logout when the user menu is opened', () => {
    const fixture = TestBed.createComponent(NavbarComponent);
    auth.currentUser.set(USER);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.user-menu-trigger')!.click();
    fixture.detectChanges();

    // mat-menu renders into the CDK overlay container, outside the fixture's own element.
    const panel = document.querySelector('.mat-mdc-menu-panel');
    expect(panel).toBeTruthy();
    expect(panel!.textContent).toContain('164284617');
    expect(panel!.textContent).toContain('mail@mcmodersd.de');
    expect(panel!.textContent).toContain('Log out');
  });

  it('should fall back to a placeholder when Twitch shared no email', () => {
    const fixture = TestBed.createComponent(NavbarComponent);
    auth.currentUser.set({ ...USER, email: null });
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.user-menu-trigger')!.click();
    fixture.detectChanges();

    expect(document.querySelector('.mat-mdc-menu-panel')!.textContent).toContain('Not shared');
  });

  it('should keep avatar, name and chevron in that DOM order inside the trigger', () => {
    // mat-button re-projects plain <mat-icon> content ahead of the label regardless of source
    // order (see button.mjs's ng-content select). Content projection physically relocates nodes,
    // so checking DOM order here is a real regression test for that — a jsdom layout/bounding-box
    // check would not be, since jsdom does not run a layout engine.
    const fixture = TestBed.createComponent(NavbarComponent);
    auth.currentUser.set(USER);
    fixture.detectChanges();

    const trigger = (fixture.nativeElement as HTMLElement).querySelector('.user-menu-trigger')!;
    const tags = [...trigger.querySelectorAll('img, span.user-menu-name, mat-icon')]
      .map((el) => el.tagName.toLowerCase());

    expect(tags).toEqual(['img', 'span', 'mat-icon']);
  });

  it('should show label and value inline for the account details', () => {
    const fixture = TestBed.createComponent(NavbarComponent);
    auth.currentUser.set(USER);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.user-menu-trigger')!.click();
    fixture.detectChanges();

    const rows = [...document.querySelectorAll('.user-menu-detail')].map((row) => row.textContent?.trim());
    expect(rows).toContain('User ID:164284617');
    expect(rows).toContain('Email:mail@mcmodersd.de');
  });

  it('should expose the Twitch chat colour to the name as a custom property', () => {
    const fixture = TestBed.createComponent(NavbarComponent);
    auth.currentUser.set(USER);
    fixture.detectChanges();

    TestBed.inject(TwitchService)['color'].set('#9146FF');
    fixture.detectChanges();

    // The stylesheet reads --chat-color and clamps it for contrast, so the binding is the part
    // worth asserting here — jsdom applies no stylesheet and resolves no oklch().
    const name = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.user-menu-name')!;
    expect(name.style.getPropertyValue('--chat-color')).toBe('#9146FF');
  });

  it('should leave the name uncoloured for users without a chat colour', () => {
    const fixture = TestBed.createComponent(NavbarComponent);
    auth.currentUser.set(USER);
    fixture.detectChanges();

    const name = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.user-menu-name')!;
    expect(name.style.getPropertyValue('--chat-color')).toBe('');
  });
});
