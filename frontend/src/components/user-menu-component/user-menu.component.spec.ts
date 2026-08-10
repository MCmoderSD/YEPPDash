import { TestBed, ComponentFixture } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { IMAGE_LOADER } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ComponentsModule } from '../components.module';
import { twitchImageLoader } from '../../data/twitch-image';
import { UserMenuComponent } from './user-menu.component';
import { NotificationService } from '../../services/notification.service';
import { environment } from '../../environments/environment';
import { Birthday, BirthdayDraft } from '../../data/birthday';
import { TwitchUser } from '../../data/twitch-user';

const API = environment.apiBaseUrl;

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

const BIRTHDAY: Birthday = { userId: USER.id, day: 17, month: 5, year: 2000 };
const DRAFT: BirthdayDraft = { day: 1, month: 3, year: 1999 };

// Built the way the localeDate pipe builds it, so these assertions follow whatever locale the test
// environment resolves to. Spelling one out would only pin the very thing the pipe exists to unpin.
function shown(day: number, month: number, year: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'long' })
    .format(new Date(year, month - 1, day));
}

describe('UserMenuComponent', () => {
  let http: HttpTestingController;
  let notifications: NotificationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComponentsModule, RouterModule.forRoot([])],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        // Wired the same way AppModule wires it, so what the avatar below asks for is what the
        // running app asks for.
        { provide: IMAGE_LOADER, useValue: twitchImageLoader },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    notifications = TestBed.inject(NotificationService);
  });

  // The birthday is fetched from an effect, so it takes a first change detection pass to go out.
  function render(): ComponentFixture<UserMenuComponent> {
    const fixture = TestBed.createComponent(UserMenuComponent);
    fixture.componentRef.setInput('user', USER);
    fixture.detectChanges();

    return fixture;
  }

  async function settle(fixture: ComponentFixture<UserMenuComponent>): Promise<void> {
    // The value arrives through a promise chain the fixture does not track.
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  function menu(fixture: ComponentFixture<UserMenuComponent>): HTMLElement {
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.user-menu-trigger')!.click();
    fixture.detectChanges();

    return document.querySelector<HTMLElement>('.cdk-overlay-container')!;
  }

  function save(fixture: ComponentFixture<UserMenuComponent>, draft: BirthdayDraft): Promise<void> {
    // Called past the dialog on purpose: what is worth pinning down here is which verb the menu
    // picks for a draft, not the picker that produced it.
    return (fixture.componentInstance as unknown as {
      save(value: BirthdayDraft): Promise<void>;
    }).save(draft);
  }

  it('should look up the birthday of the user it was given', async () => {
    const fixture = render();

    const request = http.expectOne(`${API}/birthday/${USER.id}`);
    expect(request.request.method).toBe('GET');
    request.flush(BIRTHDAY);

    await settle(fixture);
  });

  // Material closes the panel on any click that reaches it, so a click landing on the account
  // details — the end of dragging across an id or an address to copy it — used to shut the menu and
  // drop the selection with it. The details swallow the click; the items below still let theirs by.
  it('should keep a click on the account details from reaching the panel', async () => {
    const fixture = render();
    http.expectOne(`${API}/birthday/${USER.id}`).flush(BIRTHDAY);
    await settle(fixture);

    const overlay = menu(fixture);
    const reachedPanel: string[] = [];
    overlay.querySelector('.mat-mdc-menu-panel')!
      .addEventListener('click', (event: Event) => reachedPanel.push(
        (event.target as HTMLElement).className));

    overlay.querySelector('.user-menu-value')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(reachedPanel).toEqual([]);

    // Anywhere else in the panel still reaches it, so only the details are held back. Checked on the
    // divider rather than an item: the items run real actions the moment they are clicked.
    overlay.querySelector('mat-divider')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(reachedPanel).toHaveLength(1);
  });

  it('should show the birthday it found', async () => {
    const fixture = render();
    http.expectOne(`${API}/birthday/${USER.id}`).flush(BIRTHDAY);
    await settle(fixture);

    expect(menu(fixture).textContent).toContain(shown(17, 5, 2000));
  });

  it('should say the birthday is not set when the user has none', async () => {
    const fixture = render();
    http.expectOne(`${API}/birthday/${USER.id}`).flush(null, { status: 404, statusText: 'Not Found' });
    await settle(fixture);

    const content = menu(fixture).textContent!;
    expect(content).toContain('Not set');
    expect(content).toContain('Set birthday');
  });

  it('should offer to change the birthday once there is one', async () => {
    const fixture = render();
    http.expectOne(`${API}/birthday/${USER.id}`).flush(BIRTHDAY);
    await settle(fixture);

    expect(menu(fixture).textContent).toContain('Change birthday');
  });

  // A failed lookup is not worth a notification the user never asked for, and must not leave the
  // menu claiming a birthday it does not have.
  it('should fall back to unset when the lookup fails', async () => {
    const fixture = render();
    http.expectOne(`${API}/birthday/${USER.id}`).flush('nope', { status: 500, statusText: 'Server Error' });
    await settle(fixture);

    expect(menu(fixture).textContent).toContain('Not set');
    expect(notifications.notifications()).toHaveLength(0);
  });

  it('should post a first birthday', async () => {
    const fixture = render();
    http.expectOne(`${API}/birthday/${USER.id}`).flush(null, { status: 404, statusText: 'Not Found' });
    await settle(fixture);

    const saving = save(fixture, DRAFT);

    const request = http.expectOne(`${API}/birthday/${USER.id}`);
    expect([request.request.method, request.request.body]).toEqual(['POST', DRAFT]);
    request.flush({ ...DRAFT, userId: USER.id });
    await saving;

    expect(notifications.notifications()[0].kind).toBe('success');
  });

  // The endpoint refuses a POST over an existing birthday rather than overwriting it, so the verb
  // has to follow what is already there.
  it('should patch a birthday that already exists', async () => {
    const fixture = render();
    http.expectOne(`${API}/birthday/${USER.id}`).flush(BIRTHDAY);
    await settle(fixture);

    const saving = save(fixture, DRAFT);

    const request = http.expectOne(`${API}/birthday/${USER.id}`);
    expect([request.request.method, request.request.body]).toEqual(['PATCH', DRAFT]);
    request.flush({ ...DRAFT, userId: USER.id });
    await saving;

    expect(notifications.notifications()[0].kind).toBe('success');
  });

  it('should show the birthday it just saved', async () => {
    const fixture = render();
    http.expectOne(`${API}/birthday/${USER.id}`).flush(null, { status: 404, statusText: 'Not Found' });
    await settle(fixture);

    const saving = save(fixture, DRAFT);
    http.expectOne(`${API}/birthday/${USER.id}`).flush({ ...DRAFT, userId: USER.id });
    await saving;
    fixture.detectChanges();

    expect(menu(fixture).textContent).toContain(shown(1, 3, 1999));
  });

  it('should report a save that did not go through', async () => {
    const fixture = render();
    http.expectOne(`${API}/birthday/${USER.id}`).flush(BIRTHDAY);
    await settle(fixture);

    const saving = save(fixture, DRAFT);
    http.expectOne(`${API}/birthday/${USER.id}`)
      .flush('nope', { status: 500, statusText: 'Server Error' });
    await saving;

    expect(notifications.notifications()[0].kind).toBe('failure');
  });

  // Losing the save must not leave the menu showing a date the server never took.
  it('should keep showing the old birthday after a failed save', async () => {
    const fixture = render();
    http.expectOne(`${API}/birthday/${USER.id}`).flush(BIRTHDAY);
    await settle(fixture);

    const saving = save(fixture, DRAFT);
    http.expectOne(`${API}/birthday/${USER.id}`)
      .flush('nope', { status: 500, statusText: 'Server Error' });
    await saving;
    fixture.detectChanges();

    expect(menu(fixture).textContent).toContain(shown(17, 5, 2000));
  });

  // Helix hands out the 300x300 variant for everyone, which is around 100 kB behind a 32 px circle.
  // This is the one place the loader is proven to reach NgOptimizedImage rather than only to work
  // on its own.
  it('should ask Twitch for an avatar the size it is actually drawn at', () => {
    const fixture = TestBed.createComponent(UserMenuComponent);
    fixture.componentRef.setInput('user', {
      ...USER,
      profileImageUrl:
        'https://static-cdn.jtvnw.net/jtv_user_pictures/c2c3a227-profile_image-300x300.png',
    });
    fixture.detectChanges();

    const avatar = (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLImageElement>('.user-menu-avatar')!;

    // The srcset is what the browser actually picks from, and both descriptors have to come down —
    // sizing only the 1x would pull the 300x300 straight back in on a retina display.
    expect(avatar.getAttribute('srcset'))
      .toBe('https://static-cdn.jtvnw.net/jtv_user_pictures/c2c3a227-profile_image-50x50.png 1x, '
        + 'https://static-cdn.jtvnw.net/jtv_user_pictures/c2c3a227-profile_image-70x70.png 2x');

    // src keeps the original: Angular asks the loader for it without a width, which is its way of
    // saying "no particular size" — it is the fallback for a browser that ignores srcset, and no
    // browser that matters does.
    expect(avatar.getAttribute('src')).toContain('-profile_image-300x300.png');
  });
});
