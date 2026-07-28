import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { UserComponentsModule } from '../user-components.module';
import { UserInfoDialogComponent } from './user-info-dialog.component';
import { environment } from '../../environments/environment';
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

  it('should paint the name in the chat colour of that user', async () => {
    const fixture = await open(USER);

    http.expectOne(`${environment.apiBaseUrl}/api/twitch/chat-color/164284617`)
      .flush({ id: USER.id, color: '#9146FF' });

    // The colour arrives through a promise chain the fixture does not track, so let the
    // microtask queue drain before looking at the DOM.
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    const name = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.user-info-name')!;
    expect(name.style.getPropertyValue('--chat-color')).toBe('#9146FF');
  });

  it('should leave the name at the default colour when the user has none', async () => {
    const fixture = await open(USER);

    http.expectOne(`${environment.apiBaseUrl}/api/twitch/chat-color/164284617`)
      .flush({ id: USER.id, color: null });

    // The colour arrives through a promise chain the fixture does not track, so let the
    // microtask queue drain before looking at the DOM.
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    // No inline custom property means the stylesheet's own --chat-color fallback wins.
    const name = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.user-info-name')!;
    expect(name.style.getPropertyValue('--chat-color')).toBe('');
  });
});
