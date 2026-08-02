import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { RouterModule } from '@angular/router';
import { vi } from 'vitest';
import { DashModule } from '../../pages/dash.module';
import { BirthdayListComponent } from './birthday-list.component';
import { AuthService } from '../../services/auth.service';
import { BirthdayService } from '../../services/birthday.service';
import { NotificationService } from '../../services/notification.service';
import { TwitchService } from '../../services/twitch.service';
import { ageOn, Birthday, daysUntilNextBirthday } from '../../data/birthday';
import { TwitchUser } from '../../data/twitch-user';

const CHANNEL = '164284617';

function twitchUser(id: string, displayName: string, extra: Partial<TwitchUser> = {}): TwitchUser {
  return {
    id,
    login: displayName.toLowerCase(),
    displayName,
    type: '',
    broadcasterType: '',
    description: '',
    profileImageUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/avatar-300x300.png',
    offlineImageUrl: null,
    createdAt: '2017-05-01T00:00:00Z',
    email: null,
    ...extra,
  };
}

function birthday(userId: string, day: number, month: number, year = 2000): Birthday {
  return { userId, day, month, year };
}

class FakeBirthdayService {
  entries: Birthday[] = [];
  getFollowerBirthdays = vi.fn(async (): Promise<Birthday[]> => this.entries);
}

class FakeTwitchService {
  users: TwitchUser[] = [];
  getUsers = vi.fn(async (): Promise<TwitchUser[]> => this.users);
}

describe('BirthdayListComponent', () => {
  let birthdays: FakeBirthdayService;
  let twitch: FakeTwitchService;
  let notifications: NotificationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashModule, RouterModule.forRoot([])],
      providers: [
        { provide: BirthdayService, useClass: FakeBirthdayService },
        { provide: TwitchService, useClass: FakeTwitchService },
        {
          provide: AuthService,
          useValue: { currentUser: signal(twitchUser(CHANNEL, 'MCmoderSD')) },
        },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
      ],
    }).compileComponents();

    birthdays = TestBed.inject(BirthdayService) as unknown as FakeBirthdayService;
    twitch = TestBed.inject(TwitchService) as unknown as FakeTwitchService;
    notifications = TestBed.inject(NotificationService);
  });

  async function render(): Promise<ComponentFixture<BirthdayListComponent>> {
    // The component loads in its constructor, so the fixture is only built once the fakes are set up.
    const fixture = TestBed.createComponent(BirthdayListComponent);
    fixture.detectChanges();

    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    return fixture;
  }

  function rows(fixture: ComponentFixture<BirthdayListComponent>): HTMLElement[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('tr.birthday-list-row')];
  }

  function cells(fixture: ComponentFixture<BirthdayListComponent>, selector: string): string[] {
    return rows(fixture).map(
      (row) => row.querySelector(selector)!.textContent!.trim().replace(/\s+/g, ' '),
    );
  }

  it('should ask for the birthdays of the signed-in channel', async () => {
    await render();

    expect(birthdays.getFollowerBirthdays).toHaveBeenCalledWith(CHANNEL);
  });

  // The endpoint answers with ids only, so the names come from a second lookup.
  it('should resolve the names of the users it was given ids for', async () => {
    birthdays.entries = [birthday('1', 17, 5), birthday('2', 3, 9)];
    twitch.users = [twitchUser('1', 'Zoe'), twitchUser('2', 'Alice')];

    const fixture = await render();

    expect(twitch.getUsers).toHaveBeenCalledWith(['1', '2']);
    expect(cells(fixture, '.birthday-list-name').sort()).toEqual(['Alice', 'Zoe']);
  });

  // Colour and roles ride on the resolved user objects, so both are drawn without a further lookup.
  it('should paint each name in that follower’s chat colour', async () => {
    birthdays.entries = [birthday('1', 17, 5)];
    twitch.users = [twitchUser('1', 'Zoe', { color: '#9146FF' })];

    const fixture = await render();

    const name = rows(fixture)[0].querySelector<HTMLElement>('.birthday-list-name')!;
    expect(name.style.getPropertyValue('--chat-color')).toBe('#9146FF');
  });

  it('should badge a follower for every role they hold', async () => {
    birthdays.entries = [birthday('1', 17, 5)];
    twitch.users = [twitchUser('1', 'Zoe', {
      roles: { broadcaster: false, moderator: true, vip: false, editor: false, verified: true },
    })];

    const fixture = await render();

    expect([...rows(fixture)[0].querySelectorAll('app-badge img')].map((badge) => badge.getAttribute('alt')))
      .toEqual(['Verified', 'Moderator']);
  });

  // A row whose account Twitch no longer resolves still belongs in the list.
  it('should fall back to the raw id when a user cannot be resolved', async () => {
    birthdays.entries = [birthday('999', 1, 1)];
    twitch.users = [];

    const fixture = await render();

    expect(cells(fixture, '.birthday-list-name')).toEqual(['999']);
    expect(rows(fixture)[0].querySelector('.birthday-list-avatar')).toBeNull();
  });

  it('should sort by the next birthday rather than alphabetically', async () => {
    const today = new Date();
    const soon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3);
    const later = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 60);

    // Named so that alphabetical order is the opposite of what is coming up next.
    birthdays.entries = [
      birthday('1', later.getDate(), later.getMonth() + 1),
      birthday('2', soon.getDate(), soon.getMonth() + 1),
    ];
    twitch.users = [twitchUser('1', 'Aaron'), twitchUser('2', 'Zoe')];

    const fixture = await render();

    expect(cells(fixture, '.birthday-list-name')).toEqual(['Zoe', 'Aaron']);
  });

  it('should call out a birthday that is today', async () => {
    const today = new Date();
    birthdays.entries = [birthday('1', today.getDate(), today.getMonth() + 1, 1990)];
    twitch.users = [twitchUser('1', 'Zoe')];

    const fixture = await render();

    expect(cells(fixture, '.birthday-list-next')).toEqual(['Today']);
    expect(rows(fixture)[0].querySelector('.birthday-list-today')).not.toBeNull();
  });

  it('should filter on name and on user id', async () => {
    birthdays.entries = [birthday('111', 17, 5), birthday('222', 3, 9)];
    twitch.users = [twitchUser('111', 'Zoe'), twitchUser('222', 'Alice')];

    const fixture = await render();
    const search = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type="search"]')!;

    search.value = 'ali';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(cells(fixture, '.birthday-list-name')).toEqual(['Alice']);

    search.value = '111';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(cells(fixture, '.birthday-list-name')).toEqual(['Zoe']);
  });

  it('should open the details of the follower whose row was clicked', async () => {
    birthdays.entries = [birthday('1', 17, 5)];
    twitch.users = [twitchUser('1', 'Zoe')];

    const fixture = await render();
    rows(fixture)[0].click();
    fixture.detectChanges();

    const dialog = document.querySelector('.cdk-overlay-container');
    expect(dialog!.textContent).toContain('Zoe');
    TestBed.inject(MatDialog).closeAll();
  });

  // The dialog is built around a user, and an unresolved row has none to hand it.
  it('should leave a row inert when its account could not be resolved', async () => {
    birthdays.entries = [birthday('999', 17, 5)];
    twitch.users = [];

    const fixture = await render();
    rows(fixture)[0].click();
    fixture.detectChanges();

    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
    expect(rows(fixture)[0].classList.contains('birthday-list-clickable')).toBe(false);
  });

  it('should say so when nobody shared a birthday', async () => {
    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).textContent)
      .toContain('None of your followers has shared a birthday');
  });

  it('should report a failure instead of showing an empty list as success', async () => {
    birthdays.getFollowerBirthdays.mockRejectedValueOnce(new Error('nope'));

    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Could not load the birthdays');
    expect(notifications.notifications()[0].kind).toBe('failure');
  });
});

describe('birthday maths', () => {
  it('should count the birthday itself as the day the age changes', () => {
    const birthday: Birthday = { userId: '1', day: 17, month: 5, year: 2000 };

    expect(ageOn(birthday, new Date(2026, 4, 16))).toBe(25);
    expect(ageOn(birthday, new Date(2026, 4, 17))).toBe(26);
    expect(ageOn(birthday, new Date(2026, 4, 18))).toBe(26);
  });

  it('should count an age across the turn of the year', () => {
    const birthday: Birthday = { userId: '1', day: 31, month: 12, year: 1999 };

    expect(ageOn(birthday, new Date(2026, 11, 30))).toBe(26);
    expect(ageOn(birthday, new Date(2026, 11, 31))).toBe(27);
    expect(ageOn(birthday, new Date(2027, 0, 1))).toBe(27);
  });

  it('should report zero days on the birthday itself', () => {
    const birthday: Birthday = { userId: '1', day: 17, month: 5, year: 2000 };

    expect(daysUntilNextBirthday(birthday, new Date(2026, 4, 17))).toBe(0);
    expect(daysUntilNextBirthday(birthday, new Date(2026, 4, 16))).toBe(1);
  });

  // A birthday already past this year is next year's, not a negative number.
  it('should roll a passed birthday into next year', () => {
    const birthday: Birthday = { userId: '1', day: 1, month: 1, year: 2000 };

    expect(daysUntilNextBirthday(birthday, new Date(2026, 11, 31))).toBe(1);
  });

  // The 29th of February does not exist in a common year; rolling to the 1st of March beats throwing.
  it('should place a leap day on the first of March in a common year', () => {
    const birthday: Birthday = { userId: '1', day: 29, month: 2, year: 2000 };

    expect(daysUntilNextBirthday(birthday, new Date(2026, 1, 28))).toBe(1);
    expect(daysUntilNextBirthday(birthday, new Date(2024, 1, 28))).toBe(1);
  });
});
