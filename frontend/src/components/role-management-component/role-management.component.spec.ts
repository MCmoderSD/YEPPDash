import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { vi } from 'vitest';
import { DashModule } from '../../pages/dash.module';
import { RoleManagementComponent } from './role-management.component';
import { TwitchService } from '../../services/twitch.service';
import { NotificationService } from '../../services/notification.service';
import { ChannelUser } from '../../data/channel-user';
import { TwitchUser } from '../../data/twitch-user';

function twitchUser(id: string, displayName: string): TwitchUser {
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
  };
}

const MODS: ChannelUser[] = [{ id: '9', login: 'zoe', displayName: 'zoe' }];
const VIPS: ChannelUser[] = [{ id: '42', login: 'alice', displayName: 'AliceInChains' }];

class FakeTwitchService {
  readonly calls: string[] = [];

  loadModerators = vi.fn(async () => { this.calls.push('loadModerators'); return MODS; });
  loadVips = vi.fn(async () => { this.calls.push('loadVips'); return VIPS; });
  getUsers = vi.fn(async (ids: readonly string[] = [], logins: readonly string[] = []) => {
    this.calls.push(`getUsers(${ids.join(',')}|${logins.join(',')})`);
    return [...ids, ...logins].map((key, index) => twitchUser(`${key}`, `User${index}`));
  });
  addModerator = vi.fn(async () => { this.calls.push('addModerator'); });
  removeModerator = vi.fn(async () => { this.calls.push('removeModerator'); });
  addVip = vi.fn(async () => { this.calls.push('addVip'); });
  removeVip = vi.fn(async () => { this.calls.push('removeVip'); });
}

class FakeNotificationService {
  readonly successes: string[] = [];
  readonly failures: string[] = [];

  success(message: string): void { this.successes.push(message); }
  failure(message: string): void { this.failures.push(message); }
}

describe('RoleManagementComponent', () => {
  let fixture: ComponentFixture<RoleManagementComponent>;
  let element: HTMLElement;
  let twitch: FakeTwitchService;
  let notifications: FakeNotificationService;

  async function render(mode: string): Promise<void> {
    fixture.componentRef.setInput('mode', mode);
    fixture.detectChanges();
    await settle();
  }

  async function settle(): Promise<void> {
    // The component loads through promises the fixture does not track.
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // Through DashModule rather than re-declaring the component: that is the module it really
      // ships in, so the test fails if its imports ever stop covering the template.
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

    fixture = TestBed.createComponent(RoleManagementComponent);
    element = fixture.nativeElement as HTMLElement;
  });

  it('should load the moderator list and resolve avatars in one batch', async () => {
    await render('moderator');

    expect(twitch.calls).toEqual(['loadModerators', 'getUsers(9|)']);
    expect(element.querySelector('.role-management-title')!.textContent).toContain('Moderator Management');
    expect(element.querySelectorAll('.user-table-name')).toHaveLength(1);
  });

  it('should load VIPs instead when asked for that mode', async () => {
    await render('vip');

    expect(twitch.calls).toEqual(['loadVips', 'getUsers(42|)']);
    expect(element.querySelector('.role-management-title')!.textContent).toContain('VIP Management');
  });

  it('should fall back to moderators for a mode the URL made up', async () => {
    await render('nonsense');

    expect(twitch.loadModerators).toHaveBeenCalled();
    expect(twitch.loadVips).not.toHaveBeenCalled();
  });

  it('should hand the table the matching mode so the remove column appears', async () => {
    await render('vip');

    expect(element.querySelectorAll('thead th')).toHaveLength(4);
  });

  it('should remove a VIP through the VIP endpoint and confirm it', async () => {
    await render('vip');
    twitch.calls.length = 0;

    element.querySelector<HTMLButtonElement>('.user-table-actions button')!.click();
    await settle();

    expect(twitch.removeVip).toHaveBeenCalledWith('42');
    expect(twitch.removeModerator).not.toHaveBeenCalled();
    expect(notifications.successes[0]).toContain('no longer a VIP');
    // The list is re-read so the row disappears without a manual refresh.
    expect(twitch.calls).toContain('loadVips');
  });

  it('should remove a moderator through the moderator endpoint', async () => {
    await render('moderator');

    element.querySelector<HTMLButtonElement>('.user-table-actions button')!.click();
    await settle();

    expect(twitch.removeModerator).toHaveBeenCalledWith('9');
    expect(notifications.successes[0]).toContain('no longer a moderator');
  });

  it('should report a failed removal instead of pretending it worked', async () => {
    await render('moderator');
    twitch.removeModerator.mockRejectedValueOnce(new Error('403'));

    element.querySelector<HTMLButtonElement>('.user-table-actions button')!.click();
    await settle();

    expect(notifications.successes).toEqual([]);
    expect(notifications.failures[0]).toContain('Could not remove');
  });

  it('should resolve a typed login before adding, then confirm', async () => {
    await render('moderator');

    const input = element.querySelector<HTMLInputElement>('.role-management-login input')!;
    input.value = 'someone';
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();

    expect(twitch.getUsers).toHaveBeenCalledWith([], ['someone']);
    expect(twitch.addModerator).toHaveBeenCalled();
    expect(notifications.successes[0]).toContain('is now a moderator');
    expect(input.value).toBe('');
  });

  it('should say so when Twitch does not know the login', async () => {
    await render('moderator');
    twitch.getUsers.mockResolvedValueOnce([]);

    const input = element.querySelector<HTMLInputElement>('.role-management-login input')!;
    input.value = 'ghost';
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();

    expect(twitch.addModerator).not.toHaveBeenCalled();
    expect(notifications.failures[0]).toContain('ghost');
  });

  it('should ignore an empty add', async () => {
    await render('moderator');

    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();

    expect(twitch.addModerator).not.toHaveBeenCalled();
    expect(notifications.failures).toEqual([]);
  });
});
