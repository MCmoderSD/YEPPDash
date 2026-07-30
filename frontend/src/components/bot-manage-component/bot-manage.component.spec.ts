import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { vi } from 'vitest';
import { DashModule } from '../../pages/dash.module';
import { BotManageComponent } from './bot-manage.component';
import { TwitchService } from '../../services/twitch.service';
import { NotificationService } from '../../services/notification.service';
import { ChannelUser } from '../../data/channel-user';
import { TwitchUser } from '../../data/twitch-user';

const BOT_ID = '644984959';

const BOT: TwitchUser = {
  id: BOT_ID,
  login: 'yeppbot',
  displayName: 'YEPPBot',
  type: '',
  broadcasterType: '',
  description: '',
  profileImageUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/avatar-300x300.png',
  offlineImageUrl: null,
  createdAt: '2021-01-01T00:00:00Z',
  email: null,
};

function channelUser(id: string): ChannelUser {
  return { id, login: 'yeppbot', displayName: 'YEPPBot' };
}

class FakeTwitchService {
  getUsers = vi.fn(async () => [BOT]);
  getChatColor = vi.fn(async () => '#9146FF');
  getBanStatus = vi.fn(async () => ({ banned: false, ban: null }));
  getBlocked = vi.fn(async (): Promise<ChannelUser[]> => []);
  getModerators = vi.fn(async (): Promise<ChannelUser[]> => [channelUser(BOT_ID)]);
  getChatters = vi.fn(async (): Promise<ChannelUser[]> => [channelUser(BOT_ID)]);
  unbanUser = vi.fn(async () => undefined);
  unblockUser = vi.fn(async () => undefined);
  addModerator = vi.fn(async () => undefined);
}

class FakeNotificationService {
  readonly successes: string[] = [];
  readonly failures: string[] = [];

  success(message: string): void { this.successes.push(message); }
  failure(message: string): void { this.failures.push(message); }
}

describe('BotManageComponent', () => {
  let fixture: ComponentFixture<BotManageComponent>;
  let element: HTMLElement;
  let twitch: FakeTwitchService;
  let notifications: FakeNotificationService;

  async function render(): Promise<void> {
    fixture.componentRef.setInput('botUserId', BOT_ID);
    fixture.detectChanges();
    await settle();
  }

  async function settle(): Promise<void> {
    // The component loads through promises the fixture does not track.
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  function issues(): string[] {
    return [...element.querySelectorAll('.bot-manage-issue')].map((row) => row.textContent ?? '');
  }

  function buttonLabelled(label: string): HTMLButtonElement {
    const match = [...element.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === label);

    if (!match) throw new Error(`No button labelled "${label}". Found: ${issues().join(' | ')}`);
    return match as HTMLButtonElement;
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

    fixture = TestBed.createComponent(BotManageComponent);
    element = fixture.nativeElement as HTMLElement;
  });

  it('should show the bot identity for the id it was handed', async () => {
    await render();

    expect(twitch.getUsers).toHaveBeenCalledWith([BOT_ID]);
    expect(element.querySelector('.bot-manage-name')!.textContent).toContain('YEPPBot');
    expect(element.querySelector<HTMLElement>('.bot-manage-name')!.style.getPropertyValue('--chat-color'))
      .toBe('#9146FF');
  });

  it('should report a healthy bot without raising any warnings', async () => {
    await render();

    expect(element.querySelector('.bot-manage-healthy')).not.toBeNull();
    // Only the in-chat row, which is always present because it carries the Join/Leave button.
    expect(issues()).toHaveLength(1);
    expect(buttonLabelled('Leave')).toBeTruthy();
  });

  it('should offer an unban when the bot is banned', async () => {
    twitch.getBanStatus.mockResolvedValueOnce({ banned: true, ban: null });
    await render();

    expect(issues().join(' ')).toContain('is banned from your channel');

    buttonLabelled('Unban').click();
    await settle();

    expect(twitch.unbanUser).toHaveBeenCalledWith(BOT_ID);
    expect(notifications.successes[0]).toContain('no longer banned');
  });

  it('should offer an unblock when the bot is on the block list', async () => {
    twitch.getBlocked.mockResolvedValueOnce([channelUser(BOT_ID)]);
    await render();

    expect(issues().join(' ')).toContain('You have blocked');

    buttonLabelled('Unblock').click();
    await settle();

    expect(twitch.unblockUser).toHaveBeenCalledWith(BOT_ID);
    expect(notifications.successes[0]).toContain('no longer blocked');
  });

  it('should offer moderator promotion when the bot is not a moderator', async () => {
    twitch.getModerators.mockResolvedValueOnce([]);
    await render();

    expect(issues().join(' ')).toContain('is not a moderator');

    buttonLabelled('Make moderator').click();
    await settle();

    expect(twitch.addModerator).toHaveBeenCalledWith(BOT_ID);
    expect(notifications.successes[0]).toContain('is now a moderator');
  });

  it('should offer a join when the bot is absent from chat', async () => {
    twitch.getChatters.mockResolvedValueOnce([]);
    await render();

    expect(issues().join(' ')).toContain('is not in your chat');
    expect(buttonLabelled('Join')).toBeTruthy();
  });

  // The bot only appears among the chatters under its own id, so a busy chat must not read as
  // "the bot is here" just because somebody else is.
  it('should not count other chatters as the bot being present', async () => {
    twitch.getChatters.mockResolvedValueOnce([channelUser('999')]);
    await render();

    expect(buttonLabelled('Join')).toBeTruthy();
  });

  it('should re-read the status after an action so the warning clears', async () => {
    twitch.getBanStatus.mockResolvedValueOnce({ banned: true, ban: null });
    await render();

    buttonLabelled('Unban').click();
    await settle();

    // Second read reports the default, unbanned status.
    expect(twitch.getBanStatus).toHaveBeenCalledTimes(2);
    expect(issues().join(' ')).not.toContain('is banned from your channel');
  });

  it('should report a failed action instead of pretending it worked', async () => {
    twitch.getBanStatus.mockResolvedValueOnce({ banned: true, ban: null });
    await render();

    twitch.unbanUser.mockRejectedValueOnce(new Error('403'));
    buttonLabelled('Unban').click();
    await settle();

    expect(notifications.successes).toEqual([]);
    expect(notifications.failures[0]).toContain('Could not unban');
  });

  it('should say so when the configured id matches no Twitch account', async () => {
    twitch.getUsers.mockResolvedValueOnce([]);
    await render();

    expect(element.querySelector('.bot-manage-empty')!.textContent).toContain('No Twitch account matches');
  });

  it('should distinguish an unreachable Twitch from an unknown bot id', async () => {
    twitch.getChatters.mockRejectedValueOnce(new Error('502'));
    await render();

    expect(element.querySelector('.bot-manage-empty')!.textContent).toContain('Could not reach Twitch');
    expect(notifications.failures[0]).toContain('Could not load the bot status');
  });

  it('should require the bot id rather than rendering without one', () => {
    expect(() => fixture.detectChanges()).toThrow();
  });
});
