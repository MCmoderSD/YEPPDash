import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { vi } from 'vitest';
import { DashModule } from '../dash.module';
import { BdsmPageComponent } from './bdsm-page.component';
import { AuthService } from '../../services/auth.service';
import { BdsmService } from '../../services/bdsm.service';
import { NotificationService } from '../../services/notification.service';
import { TwitchService } from '../../services/twitch.service';
import { BDSM_TRAITS, BdsmResult, BdsmTraitKey } from '../../data/bdsm-result';
import { TwitchUser } from '../../data/twitch-user';

const USER = '644984959';

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

function result(
  id: string,
  timestamp: string,
  scores: Partial<Record<BdsmTraitKey, number>> = {},
  userId: string = USER,
): BdsmResult {
  const traits = Object.fromEntries(
    BDSM_TRAITS.map((trait) => [trait.key, scores[trait.key] ?? 0]),
  ) as Record<BdsmTraitKey, number>;

  return { id, userId, timestamp, version: 3, gender: 'Female', ageGroup: '23-25', traits };
}

class FakeBdsmService {
  entries: BdsmResult[] = [];
  followers: BdsmResult[] = [];
  getResults = vi.fn(async (): Promise<BdsmResult[]> => this.entries);
  getFollowerResults = vi.fn(async (): Promise<BdsmResult[]> => this.followers);
}

class FakeTwitchService {
  users: TwitchUser[] = [];
  getUsers = vi.fn(async (): Promise<TwitchUser[]> => this.users);
  getChatColor = vi.fn(async (): Promise<string | null> => null);
}

describe('BdsmPageComponent', () => {
  let bdsm: FakeBdsmService;
  let twitch: FakeTwitchService;
  let notifications: NotificationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashModule, RouterModule.forRoot([])],
      providers: [
        { provide: BdsmService, useClass: FakeBdsmService },
        { provide: TwitchService, useClass: FakeTwitchService },
        { provide: AuthService, useValue: { currentUser: signal(twitchUser(USER, 'MCmoderSD')) } },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
      ],
    }).compileComponents();

    bdsm = TestBed.inject(BdsmService) as unknown as FakeBdsmService;
    twitch = TestBed.inject(TwitchService) as unknown as FakeTwitchService;
    notifications = TestBed.inject(NotificationService);
  });

  async function settle(fixture: ComponentFixture<BdsmPageComponent>): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    // The community tab resolves names in a second request, so one turn is not always enough.
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  async function render(): Promise<ComponentFixture<BdsmPageComponent>> {
    // The component loads in its constructor, so the fixture is only built once the fakes are set up.
    const fixture = TestBed.createComponent(BdsmPageComponent);
    fixture.detectChanges();

    await settle(fixture);
    return fixture;
  }

  /** Opens the community tab the way a reader would, by clicking its label. */
  async function openCommunity(fixture: ComponentFixture<BdsmPageComponent>): Promise<void> {
    const labels = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.mat-mdc-tab')];
    labels[1].click();
    fixture.detectChanges();

    await settle(fixture);
  }

  function panels(fixture: ComponentFixture<BdsmPageComponent>): HTMLElement[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('mat-expansion-panel')];
  }

  function tabLabels(fixture: ComponentFixture<BdsmPageComponent>): string[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll('.mat-mdc-tab')]
      .map((tab) => tab.textContent!.trim());
  }

  it('should offer a tab for your own results and one for the community', async () => {
    expect(tabLabels(await render())).toEqual(['Your results', 'Community']);
  });

  it('should ask for the results of the signed-in user', async () => {
    await render();

    expect(bdsm.getResults).toHaveBeenCalledWith(USER);
  });

  it('should show a panel for every result', async () => {
    bdsm.entries = [result('a', '2026-07-31T12:00:00Z'), result('b', '2024-01-01T12:00:00Z')];

    expect(panels(await render())).toHaveLength(2);
  });

  // The page's own promise, so it must hold whatever order the response arrived in.
  it('should put the newest result at the top', async () => {
    bdsm.entries = [
      result('oldest', '2020-01-01T12:00:00Z'),
      result('newest', '2026-07-31T12:00:00Z'),
      result('middle', '2024-01-01T12:00:00Z'),
    ];

    const fixture = await render();
    const dates = panels(fixture).map((panel) => panel.querySelector('time')!.getAttribute('datetime'));

    expect(dates).toEqual(['2026-07-31', '2024-01-01', '2020-01-01']);
  });

  it('should open the newest result and leave the rest closed', async () => {
    bdsm.entries = [result('a', '2026-07-31T12:00:00Z'), result('b', '2024-01-01T12:00:00Z')];

    const fixture = await render();
    const expanded = panels(fixture).map(
      (panel) => panel.querySelector('.mat-expansion-panel-header')!.getAttribute('aria-expanded'),
    );

    expect(expanded).toEqual(['true', 'false']);
  });

  // The panel content is lazy, so the open one is also the only one whose bars exist at all.
  it('should draw the bars of the result it opened', async () => {
    bdsm.entries = [
      result('a', '2026-07-31T12:00:00Z', { switch: 0.84 }),
      result('b', '2024-01-01T12:00:00Z', { vanilla: 0.9 }),
    ];

    const fixture = await render();
    const charts = (fixture.nativeElement as HTMLElement).querySelectorAll('app-bdsm-result');

    expect(charts).toHaveLength(1);
    expect(charts[0].querySelector('.bdsm-result-label')!.textContent!.trim()).toBe('Switch');
  });

  // In the header rather than the body, so it reads without opening the panel.
  it('should show the version and demographics on the collapsed header', async () => {
    bdsm.entries = [result('a', '2026-07-31T12:00:00Z'), result('b', '2024-01-01T12:00:00Z')];

    const fixture = await render();
    const collapsed = panels(fixture)[1];

    expect(collapsed.querySelector('.mat-expansion-panel-header')!.getAttribute('aria-expanded')).toBe('false');
    const summary = collapsed.querySelector('.bdsm-page-summary')!.textContent!.replace(/\s+/g, ' ').trim();
    expect(summary).toBe('Version 3 · Female · 23-25');
  });

  // Not an accordion in the exclusive sense: opening an older result to compare it must not close
  // the newest one that was already open.
  it('should allow more than one result open at once', async () => {
    bdsm.entries = [
      result('a', '2026-07-31T12:00:00Z'),
      result('b', '2024-01-01T12:00:00Z'),
      result('c', '2020-01-01T12:00:00Z'),
    ];

    const fixture = await render();
    panels(fixture)[1].querySelector<HTMLElement>('.mat-expansion-panel-header')!.click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    const expanded = panels(fixture).map(
      (panel) => panel.querySelector('.mat-expansion-panel-header')!.getAttribute('aria-expanded'),
    );

    expect(expanded).toEqual(['true', 'true', 'false']);
  });

  it('should say so when the user never took the test', async () => {
    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).textContent)
      .toContain('You have not taken the BDSM test yet');
  });

  it('should report a failure instead of showing an empty page as success', async () => {
    bdsm.getResults.mockRejectedValueOnce(new Error('nope'));

    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Could not load your results');
    expect(notifications.notifications()[0].kind).toBe('failure');
  });

  it('should count the results it is showing', async () => {
    bdsm.entries = [result('a', '2026-07-31T12:00:00Z')];
    expect((await render()).nativeElement.textContent).toContain('You have taken the test once');

    bdsm.entries = [result('a', '2026-07-31T12:00:00Z'), result('b', '2024-01-01T12:00:00Z')];
    expect((await render()).nativeElement.textContent).toContain('You have taken the test 2 times');
  });

  describe('community tab', () => {
    // It costs a follow check per stored result, so it must not run for somebody who never opens it.
    it('should not fetch the community until its tab is opened', async () => {
      await render();

      expect(bdsm.getFollowerResults).not.toHaveBeenCalled();
    });

    it('should fetch the community once its tab is opened', async () => {
      const fixture = await render();
      await openCommunity(fixture);

      expect(bdsm.getFollowerResults).toHaveBeenCalledWith(USER);
    });

    it('should not fetch the community twice when the tab is revisited', async () => {
      bdsm.followers = [result('a', '2026-07-31T12:00:00Z', {}, '1')];
      twitch.users = [twitchUser('1', 'Zoe')];

      const fixture = await render();
      await openCommunity(fixture);
      await openCommunity(fixture);

      expect(bdsm.getFollowerResults).toHaveBeenCalledTimes(1);
    });

    // The endpoint answers with ids only, so the names come from a second lookup.
    it('should resolve the names of the people it was given ids for', async () => {
      bdsm.followers = [
        result('a', '2026-07-31T12:00:00Z', {}, '1'),
        result('b', '2024-01-01T12:00:00Z', {}, '2'),
      ];
      twitch.users = [twitchUser('1', 'Zoe'), twitchUser('2', 'Alice')];

      const fixture = await render();
      await openCommunity(fixture);

      expect(twitch.getUsers).toHaveBeenCalledWith(['1', '2']);
      expect(panels(fixture).map((panel) => panel.querySelector('.bdsm-page-name')!.textContent!.trim()))
        .toEqual(['Zoe', 'Alice']);
    });

    // A row whose account Twitch no longer resolves still belongs in the list.
    it('should fall back to the raw id when a user cannot be resolved', async () => {
      bdsm.followers = [result('a', '2026-07-31T12:00:00Z', {}, '999')];
      twitch.users = [];

      const fixture = await render();
      await openCommunity(fixture);

      expect(panels(fixture)[0].querySelector('.bdsm-page-name')!.textContent!.trim()).toBe('999');
      expect(panels(fixture)[0].querySelector('.bdsm-page-avatar')).toBeNull();
    });

    it('should put the newest test at the top', async () => {
      bdsm.followers = [
        result('older', '2020-01-01T12:00:00Z', {}, '1'),
        result('newer', '2026-07-31T12:00:00Z', {}, '2'),
      ];
      twitch.users = [twitchUser('1', 'Zoe'), twitchUser('2', 'Alice')];

      const fixture = await render();
      await openCommunity(fixture);

      expect(panels(fixture).map((panel) => panel.querySelector('time')!.getAttribute('datetime')))
        .toEqual(['2026-07-31', '2020-01-01']);
    });

    // A list to browse rather than a single result to read, so nothing opens by itself.
    it('should leave every community panel closed', async () => {
      bdsm.followers = [
        result('a', '2026-07-31T12:00:00Z', {}, '1'),
        result('b', '2024-01-01T12:00:00Z', {}, '2'),
      ];
      twitch.users = [twitchUser('1', 'Zoe'), twitchUser('2', 'Alice')];

      const fixture = await render();
      await openCommunity(fixture);

      const expanded = panels(fixture).map(
        (panel) => panel.querySelector('.mat-expansion-panel-header')!.getAttribute('aria-expanded'),
      );

      expect(expanded).toEqual(['false', 'false']);
      expect((fixture.nativeElement as HTMLElement).querySelectorAll('app-bdsm-result')).toHaveLength(0);
    });

    // Comparing two people's results is the point of a community list, and that means both of their
    // panels have to be able to stay open together.
    it('should allow more than one community result open at once', async () => {
      bdsm.followers = [
        result('a', '2026-07-31T12:00:00Z', {}, '1'),
        result('b', '2024-01-01T12:00:00Z', {}, '2'),
      ];
      twitch.users = [twitchUser('1', 'Zoe'), twitchUser('2', 'Alice')];

      const fixture = await render();
      await openCommunity(fixture);

      panels(fixture).forEach((panel) => panel.querySelector<HTMLElement>('.mat-expansion-panel-header')!.click());
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();

      const expanded = panels(fixture).map(
        (panel) => panel.querySelector('.mat-expansion-panel-header')!.getAttribute('aria-expanded'),
      );

      expect(expanded).toEqual(['true', 'true']);
    });

    it('should say so when nobody shared a result', async () => {
      const fixture = await render();
      await openCommunity(fixture);

      expect((fixture.nativeElement as HTMLElement).textContent)
        .toContain('Nobody in your channel has shared a BDSM test result');
    });

    it('should report a failure instead of showing an empty community as success', async () => {
      bdsm.getFollowerResults.mockRejectedValueOnce(new Error('nope'));

      const fixture = await render();
      await openCommunity(fixture);

      expect((fixture.nativeElement as HTMLElement).textContent)
        .toContain('Could not load the results of your followers');
      expect(notifications.notifications()[0].kind).toBe('failure');
    });

    // A failed load leaves nothing to show, so the tab has to be allowed to try again.
    it('should retry after a failure rather than staying empty', async () => {
      bdsm.getFollowerResults.mockRejectedValueOnce(new Error('nope'));

      const fixture = await render();
      await openCommunity(fixture);
      expect(bdsm.getFollowerResults).toHaveBeenCalledTimes(1);

      bdsm.followers = [result('a', '2026-07-31T12:00:00Z', {}, '1')];
      twitch.users = [twitchUser('1', 'Zoe')];

      // Back to the first tab and out again, which is the reader's own way of retrying.
      const labels = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.mat-mdc-tab')];
      labels[0].click();
      fixture.detectChanges();
      await openCommunity(fixture);

      expect(bdsm.getFollowerResults).toHaveBeenCalledTimes(2);
      expect(panels(fixture)[0].querySelector('.bdsm-page-name')!.textContent!.trim()).toBe('Zoe');
    });
  });
});
