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
): BdsmResult {
  const traits = Object.fromEntries(
    BDSM_TRAITS.map((trait) => [trait.key, scores[trait.key] ?? 0]),
  ) as Record<BdsmTraitKey, number>;

  return { id, userId: USER, timestamp, version: 3, gender: 'Female', ageGroup: '23-25', traits };
}

class FakeBdsmService {
  entries: BdsmResult[] = [];
  getResults = vi.fn(async (): Promise<BdsmResult[]> => this.entries);
  getFollowerResults = vi.fn(async (): Promise<BdsmResult[]> => []);
}

describe('BdsmPageComponent', () => {
  let bdsm: FakeBdsmService;
  let notifications: NotificationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashModule, RouterModule.forRoot([])],
      providers: [
        { provide: BdsmService, useClass: FakeBdsmService },
        { provide: AuthService, useValue: { currentUser: signal(twitchUser(USER, 'MCmoderSD')) } },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
      ],
    }).compileComponents();

    bdsm = TestBed.inject(BdsmService) as unknown as FakeBdsmService;
    notifications = TestBed.inject(NotificationService);
  });

  async function render(): Promise<ComponentFixture<BdsmPageComponent>> {
    // The component loads in its constructor, so the fixture is only built once the fake is set up.
    const fixture = TestBed.createComponent(BdsmPageComponent);
    fixture.detectChanges();

    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    return fixture;
  }

  function panels(fixture: ComponentFixture<BdsmPageComponent>): HTMLElement[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('mat-expansion-panel')];
  }

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
    const years = panels(fixture).map((panel) => panel.querySelector('time')!.getAttribute('datetime'));

    expect(years).toEqual(['2026-07-31', '2024-01-01', '2020-01-01']);
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

  it('should summarise a collapsed result by its strongest trait', async () => {
    bdsm.entries = [result('a', '2026-07-31T12:00:00Z', { switch: 0.84 })];

    const fixture = await render();

    expect(panels(fixture)[0].querySelector('.bdsm-page-dominant')!.textContent!.trim())
      .toBe('84% Switch');
  });

  it('should show the version and demographics of an open result', async () => {
    bdsm.entries = [result('a', '2026-07-31T12:00:00Z')];

    const fixture = await render();
    const meta = (fixture.nativeElement as HTMLElement).querySelector('.bdsm-page-meta')!.textContent!;

    expect(meta).toContain('Version 3');
    expect(meta).toContain('Female');
    expect(meta).toContain('23-25');
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
});
