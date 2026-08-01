import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { UserComponentsModule } from '../user-components.module';
import { UserInfoDialogComponent } from './user-info-dialog.component';
import { environment } from '../../environments/environment';
import { TwitchUser } from '../../data/twitch-user';
import { UserRoles } from '../../data/user-roles';

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

function roles(held: Partial<UserRoles> = {}): UserRoles {
  return {
    broadcaster: false,
    moderator: false,
    vip: false,
    editor: false,
    verified: false,
    ...held,
  };
}

describe('UserInfoDialogComponent', () => {
  let http: HttpTestingController;

  async function open(user: TwitchUser): Promise<ComponentFixture<UserInfoDialogComponent>> {
    await TestBed.configureTestingModule({
      imports: [UserComponentsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: user },
        { provide: MatDialogRef, useValue: { close: () => { } } },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(UserInfoDialogComponent);
    fixture.detectChanges();

    return fixture;
  }

  it('should show avatar, name, id and email', async () => {
    const fixture = await open(USER);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector<HTMLImageElement>('.user-info-avatar')!.src).toContain('avatar-300x300.png');
    expect(element.querySelector('.user-info-name')!.textContent!.trim()).toBe('MCmoderSD');
    expect(element.textContent).toContain('164284617');
    expect(element.textContent).toContain('mail@mcmodersd.de');
  });

  it('should drop the email row entirely when Twitch shared none', async () => {
    const fixture = await open({ ...USER, email: null });
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.user-info-detail')).toHaveLength(1);
    expect(element.textContent).not.toContain('Email');
  });

  // The colour rides on the user object itself now, so the dialog paints it without a request.
  it('should paint the name in the chat colour the user arrived with', async () => {
    const fixture = await open({ ...USER, color: '#9146FF' });

    const name = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.user-info-name')!;
    expect(name.style.getPropertyValue('--chat-color')).toBe('#9146FF');
  });

  it('should show the birthday of the user it is showing', async () => {
    const fixture = await open(USER);

    http.expectOne(`${environment.apiBaseUrl}/birthday/164284617`)
      .flush({ userId: USER.id, day: 17, month: 5, year: 2000 });

    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    // Built the way the localeDate pipe builds it: spelling a format out would pin the very thing
    // the pipe exists to leave to the reader's browser.
    const shown: string = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' })
      .format(new Date(2000, 4, 17));

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(shown);
  });

  // Dropped rather than shown as unset, matching how the email row behaves.
  it('should drop the birthday row when the user has not set one', async () => {
    const fixture = await open(USER);

    http.expectOne(`${environment.apiBaseUrl}/birthday/164284617`)
      .flush(null, { status: 404, statusText: 'Not Found' });

    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Birthday');
  });

  function badges(fixture: ComponentFixture<UserInfoDialogComponent>): string[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll('app-badge')]
      .map((badge) => badge.textContent!.trim());
  }

  // The roles ride on the user object itself, so the badges are there the moment the dialog opens
  // instead of popping in after a request.
  it('should show a badge for every role the user arrived with', async () => {
    const fixture = await open({ ...USER, roles: roles({ moderator: true, vip: true }) });

    expect(badges(fixture)).toEqual(['Moderator', 'VIP']);
  });

  // Strongest channel role first, so the list reads the way Twitch ranks them.
  it('should lead with the strongest role it was given', async () => {
    const fixture = await open({
      ...USER,
      roles: roles({ broadcaster: true, moderator: true, editor: true, vip: true, verified: true }),
    });

    expect(badges(fixture)).toEqual(['Broadcaster', 'Moderator', 'Editor', 'VIP', 'Verified']);
  });

  it('should show nothing at all for a user holding no roles', async () => {
    const fixture = await open({ ...USER, roles: roles({}) });

    expect(badges(fixture)).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).querySelector('.user-info-badges')).toBeNull();
  });

  // A badge the server never confirmed must not be drawn, so an object that was never enriched
  // shows none rather than guessing.
  it('should show no badges for a user that carries no role information', async () => {
    const fixture = await open(USER);

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('app-badge')).toHaveLength(0);
  });

  it('should leave the name at the default colour when the user has none', async () => {
    const fixture = await open({ ...USER, color: null });

    // No inline custom property means the stylesheet's own --chat-color fallback wins.
    const name = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.user-info-name')!;
    expect(name.style.getPropertyValue('--chat-color')).toBe('');
  });
});
