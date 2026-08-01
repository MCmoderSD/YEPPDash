import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { vi } from 'vitest';
import { DashModule } from '../dash.module';
import { CommunityPageComponent } from './community-page.component';
import { UserInfoDialogComponent } from '../../components/user-info-dialog-component/user-info-dialog.component';
import { TwitchService } from '../../services/twitch.service';
import { NotificationService } from '../../services/notification.service';
import { FollowerProfile } from '../../data/follower';
import { UserRoles } from '../../data/user-roles';

function follower(
  id: string,
  displayName: string,
  followedAt: string,
  roles: Partial<UserRoles> = {},
): FollowerProfile {
  return {
    id,
    login: displayName.toLowerCase(),
    displayName,
    type: '',
    broadcasterType: '',
    description: '',
    profileImageUrl: `https://static-cdn.jtvnw.net/${id}.png`,
    offlineImageUrl: null,
    createdAt: '2017-05-01T00:00:00Z',
    email: null,
    color: '#9146FF',
    followedAt,
    roles: {
      broadcaster: false,
      moderator: false,
      vip: false,
      editor: false,
      verified: false,
      ...roles,
    },
  };
}

const FOLLOWERS: FollowerProfile[] = [
  follower('9', 'zoe', '2021-03-04T10:00:00Z'),
  follower('42', 'AliceInChains', '2024-08-15T12:00:00Z', { moderator: true, vip: true }),
  follower('7', 'bob', '2019-01-20T08:00:00Z'),
];

function crowd(size: number): FollowerProfile[] {
  return Array.from({ length: size }, (_, index) =>
    follower(`${index}`, `User${index}`, new Date(Date.UTC(2020, 0, 1) + index * 86_400_000).toISOString()));
}

class FakeTwitchService {
  getFollowers = vi.fn(async (): Promise<FollowerProfile[]> => FOLLOWERS);
}

class FakeNotificationService {
  readonly failures: string[] = [];

  success(): void { }
  failure(message: string): void { this.failures.push(message); }
}

describe('CommunityPageComponent', () => {
  let fixture: ComponentFixture<CommunityPageComponent>;
  let element: HTMLElement;
  let twitch: FakeTwitchService;
  let notifications: FakeNotificationService;

  async function settle(): Promise<void> {
    // The page loads through promises the fixture does not track.
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(CommunityPageComponent);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await settle();
  }

  function names(): string[] {
    return [...element.querySelectorAll('.community-page-name')].map((cell) => cell.textContent!.trim());
  }

  function rows(): HTMLElement[] {
    return [...element.querySelectorAll<HTMLElement>('.community-page-row')];
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // Through DashModule rather than re-declaring the page: that is the module it really ships
      // in, so the test fails if its imports ever stop covering the template.
      imports: [DashModule, RouterModule.forRoot([])],
      providers: [
        { provide: TwitchService, useClass: FakeTwitchService },
        { provide: NotificationService, useClass: FakeNotificationService },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
      ],
    }).compileComponents();

    twitch = TestBed.inject(TwitchService) as unknown as FakeTwitchService;
    notifications = TestBed.inject(NotificationService) as unknown as FakeNotificationService;
  });

  it('should list every follower with their avatar', async () => {
    await render();

    expect(rows()).toHaveLength(3);
    expect(element.querySelectorAll('.community-page-avatar')).toHaveLength(3);
    expect(element.querySelector('.community-page-count')!.textContent).toContain('3 followers');
  });

  // The reason to open this page is to see who joined recently.
  it('should lead with the newest follower', async () => {
    await render();

    expect(names()).toEqual(['AliceInChains', 'zoe', 'bob']);
  });

  it('should show the date each of them started following', async () => {
    await render();

    const shown: string = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' })
      .format(new Date('2024-08-15T12:00:00Z'));

    expect(element.querySelector('.community-page-date')!.textContent).toContain(shown);
  });

  // The roles ride on the follower objects, so the badges are drawn without a second request.
  it('should badge a follower for every role they hold', async () => {
    await render();

    const badges = [...rows()[0].querySelectorAll('app-badge')].map((badge) => badge.textContent!.trim());
    expect(badges).toEqual(['Moderator', 'VIP']);
    expect(twitch.getFollowers).toHaveBeenCalledTimes(1);
  });

  // Right behind the name rather than in a column of their own.
  it('should hang the badges off the name', async () => {
    await render();

    const identity = rows()[0].querySelector('.community-page-identity')!;
    expect(identity.querySelector('.community-page-name')!.textContent!.trim()).toBe('AliceInChains');
    expect(identity.querySelectorAll('app-badge')).toHaveLength(2);
  });

  // Its aria-label names the whole control, so a badge inside would never be announced.
  it('should keep the badges outside the details button', async () => {
    await render();

    expect(rows()[0].querySelector('.community-page-user')!.querySelectorAll('app-badge')).toHaveLength(0);
  });

  it('should draw no badges for a follower holding no roles', async () => {
    await render();

    expect(rows()[1].querySelectorAll('app-badge')).toHaveLength(0);
  });

  it('should offer no column to sort the roles by', async () => {
    await render();

    const headers = [...element.querySelectorAll('thead th')].map((th) => th.textContent!.trim());
    expect(headers).toEqual(['Follower', 'Following since']);
  });

  it('should paint each name in that follower’s chat colour', async () => {
    await render();

    const name = element.querySelector<HTMLElement>('.community-page-name')!;
    expect(name.style.getPropertyValue('--chat-color')).toBe('#9146FF');
  });

  it('should filter by name as well as by user id', async () => {
    await render();

    const input = element.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = 'alice';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(names()).toEqual(['AliceInChains']);

    input.value = '7';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(names()).toEqual(['bob']);
  });

  it('should open the details of the follower whose row was clicked', async () => {
    await render();
    const open = vi.spyOn(TestBed.inject(MatDialog), 'open');

    rows()[0].click();

    expect(open.mock.calls[0][0]).toBe(UserInfoDialogComponent);
    expect(open.mock.calls[0][1]?.data).toEqual(FOLLOWERS[1]);
  });

  it('should re-read the list when asked to refresh', async () => {
    await render();

    element.querySelector<HTMLButtonElement>('.community-page-toolbar button')!.click();
    await settle();

    expect(twitch.getFollowers).toHaveBeenCalledTimes(2);
  });

  it('should report a failed load instead of showing an empty channel', async () => {
    twitch.getFollowers.mockRejectedValueOnce(new Error('502'));
    await render();

    expect(rows()).toHaveLength(0);
    expect(notifications.failures[0]).toContain('Could not load your community');
    expect(element.querySelector('.community-page-empty')!.textContent).toContain('Please try again');
  });

  it('should say so when nobody follows the channel yet', async () => {
    twitch.getFollowers.mockResolvedValueOnce([]);
    await render();

    expect(element.querySelector('.community-page-empty')!.textContent).toContain('Nobody follows');
  });

  it('should show only one page of followers at a time', async () => {
    twitch.getFollowers.mockResolvedValueOnce(crowd(60));
    await render();

    expect(rows()).toHaveLength(25);
    expect(element.querySelector('.mat-mdc-paginator-range-label')!.textContent).toContain('1 – 25 of 60');
  });

  it('should page through the rest of the list', async () => {
    twitch.getFollowers.mockResolvedValueOnce(crowd(60));
    await render();
    const first: string[] = names();

    element.querySelector<HTMLButtonElement>('.mat-mdc-paginator-navigation-next')!.click();
    fixture.detectChanges();

    expect(rows()).toHaveLength(25);
    expect(names()).not.toEqual(first);
    expect(element.querySelector('.mat-mdc-paginator-range-label')!.textContent).toContain('26 – 50 of 60');
  });

  // Counts the whole channel, not the page in front of the reader.
  it('should count every follower in the header while paging', async () => {
    twitch.getFollowers.mockResolvedValueOnce(crowd(60));
    await render();

    expect(element.querySelector('.community-page-count')!.textContent).toContain('60 followers');
  });

  // Staying on a later page of a list that just shrank would show an empty table.
  it('should jump back to the first page when the search narrows the list', async () => {
    twitch.getFollowers.mockResolvedValueOnce(crowd(60));
    await render();

    element.querySelector<HTMLButtonElement>('.mat-mdc-paginator-navigation-next')!.click();
    fixture.detectChanges();

    const input = element.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = 'User7';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(names()).toEqual(['User7']);
  });
});
