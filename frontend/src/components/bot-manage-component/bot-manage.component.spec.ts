import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { vi } from 'vitest';
import { DashModule } from '../../pages/dash.module';
import { BotManageComponent } from './bot-manage.component';
import { AuthService } from '../../services/auth.service';
import { BotResult, BotService } from '../../services/bot.service';
import { TwitchService } from '../../services/twitch.service';
import { NotificationService } from '../../services/notification.service';
import { ChannelUser } from '../../data/channel-user';
import { TwitchUser } from '../../data/twitch-user';

const BOT_ID = '644984959';

// The channel the reader is signed in as — not the bot. Join and leave key on this one.
const CHANNEL_ID = '123456789';

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
  color: '#9146FF',
};

function channelUser(id: string): ChannelUser {
  return { id, login: 'yeppbot', displayName: 'YEPPBot' };
}

class FakeTwitchService {
  getUsers = vi.fn(async () => [BOT]);
  getBanStatus = vi.fn(async () => ({ banned: false, ban: null }));
  getBlocked = vi.fn(async (): Promise<ChannelUser[]> => []);
  getModerators = vi.fn(async (): Promise<ChannelUser[]> => [channelUser(BOT_ID)]);
  getChatters = vi.fn(async (): Promise<ChannelUser[]> => [channelUser(BOT_ID)]);
  unbanUser = vi.fn(async () => undefined);
  unblockUser = vi.fn(async () => undefined);
  addModerator = vi.fn(async () => undefined);
}

function botResult(message: string): BotResult {
  return { success: true, status: 200, message };
}

class FakeBotService {
  joinChannel = vi.fn(async (): Promise<BotResult> => botResult('Joined channel: SomeChannel'));
  leaveChannel = vi.fn(async (): Promise<BotResult> => botResult('Left channel: SomeChannel'));
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
  let bot: FakeBotService;
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
        { provide: BotService, useClass: FakeBotService },
        { provide: NotificationService, useClass: FakeNotificationService },
        { provide: AuthService, useValue: { currentUser: signal({ ...BOT, id: CHANNEL_ID }) } },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
      ],
    }).compileComponents();

    twitch = TestBed.inject(TwitchService) as unknown as FakeTwitchService;
    bot = TestBed.inject(BotService) as unknown as FakeBotService;
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

  // The bot's own API keys on the channel being joined, not on the bot's account — handing it the
  // bot id would ask the bot to join its own chat.
  it('should ask the bot to join the signed-in channel', async () => {
    twitch.getChatters.mockResolvedValueOnce([]);
    await render();

    buttonLabelled('Join').click();
    await settle();

    expect(bot.joinChannel).toHaveBeenCalledWith(CHANNEL_ID);
    expect(notifications.successes[0]).toContain('join your chat');
  });

  it('should ask the bot to leave the signed-in channel', async () => {
    await render();

    buttonLabelled('Leave').click();
    await settle();

    expect(bot.leaveChannel).toHaveBeenCalledWith(CHANNEL_ID);
    expect(notifications.successes[0]).toContain('leave your chat');
  });

  it('should re-read the status after the bot is asked to move', async () => {
    twitch.getChatters.mockResolvedValueOnce([]);
    await render();

    buttonLabelled('Join').click();
    await settle();

    expect(twitch.getChatters).toHaveBeenCalledTimes(2);
  });

  // The bot explains itself in its own words — down, unconfigured, or refusing — and that beats
  // anything this page could write.
  it('should report the reason the bot gave for refusing', async () => {
    await render();

    bot.leaveChannel.mockRejectedValueOnce(new HttpErrorResponse({
      status: 502,
      error: { success: false, status: 0, message: 'Could not reach YEPPBot.' },
    }));

    buttonLabelled('Leave').click();
    await settle();

    expect(notifications.successes).toEqual([]);
    expect(notifications.failures[0]).toBe('Could not reach YEPPBot.');
  });

  it('should fall back to its own words when the bot explains nothing', async () => {
    await render();

    bot.leaveChannel.mockRejectedValueOnce(new Error('offline'));

    buttonLabelled('Leave').click();
    await settle();

    expect(notifications.failures[0]).toContain('out of your chat');
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
