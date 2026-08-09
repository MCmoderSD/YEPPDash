import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { vi } from 'vitest';
import { DashModule } from '../dash.module';
import { ModulePageComponent } from './module-page.component';
import { AuthService } from '../../services/auth.service';
import { ModuleService } from '../../services/module.service';
import { NotificationService } from '../../services/notification.service';
import { BotModule } from '../../data/bot-module';
import { TwitchUser } from '../../data/twitch-user';

const USER = '644984959';

function twitchUser(): TwitchUser {
  return {
    id: USER,
    login: 'mcmodersd',
    displayName: 'MCmoderSD',
    type: '',
    broadcasterType: '',
    description: '',
    profileImageUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/avatar-300x300.png',
    offlineImageUrl: null,
    createdAt: '2017-05-01T00:00:00Z',
    email: null,
  };
}

function module(overrides: Partial<BotModule> = {}): BotModule {
  return {
    id: 'weather',
    name: 'Weather',
    description: 'Shows the current weather report.',
    aliases: ['wetter', 'wetterbericht'],
    enabled: true,
    ...overrides,
  };
}

class FakeModuleService {
  entries: BotModule[] = [module()];
  getModules = vi.fn(async (): Promise<BotModule[]> => this.entries);
  enableModule = vi.fn(async (_channel: string, id: string): Promise<BotModule> =>
    module({ id, enabled: true }));
  disableModule = vi.fn(async (_channel: string, id: string): Promise<BotModule> =>
    module({ id, enabled: false }));
}

describe('ModulePageComponent', () => {
  let modules: FakeModuleService;
  let notifications: NotificationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashModule, RouterModule.forRoot([])],
      providers: [
        { provide: ModuleService, useClass: FakeModuleService },
        { provide: AuthService, useValue: { currentUser: signal(twitchUser()) } },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
      ],
    }).compileComponents();

    modules = TestBed.inject(ModuleService) as unknown as FakeModuleService;
    notifications = TestBed.inject(NotificationService);
  });

  afterEach(() => vi.restoreAllMocks());

  async function render(): Promise<ComponentFixture<ModulePageComponent>> {
    const fixture = TestBed.createComponent(ModulePageComponent);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    return fixture;
  }

  function element(fixture: ComponentFixture<ModulePageComponent>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function panels(fixture: ComponentFixture<ModulePageComponent>): HTMLElement[] {
    return Array.from(element(fixture).querySelectorAll<HTMLElement>('.module-panel'));
  }

  function summary(fixture: ComponentFixture<ModulePageComponent>, index = 0): HTMLElement {
    return panels(fixture)[index].querySelector<HTMLElement>('.module-panel-summary')!;
  }

  function toggle(fixture: ComponentFixture<ModulePageComponent>, index = 0): HTMLElement {
    return panels(fixture)[index].querySelector<HTMLElement>('mat-slide-toggle button[role="switch"]')!;
  }

  it('should render a panel for every module', async () => {
    modules.entries = [module(), module({ id: 'ping', name: 'Ping' })];
    const fixture = await render();

    expect(panels(fixture)).toHaveLength(2);
  });

  it('should load the modules of the signed-in channel', async () => {
    await render();

    expect(modules.getModules).toHaveBeenCalledWith(USER);
  });

  it('should say how many modules are on', async () => {
    modules.entries = [module(), module({ id: 'ping', name: 'Ping', enabled: false })];
    const fixture = await render();

    expect(element(fixture).querySelector('.module-page-count')!.textContent)
      .toContain('1 of 2 modules on');
  });

  // The description is what opening a panel is for, so it must not already be reachable while shut.
  it('should keep a collapsed panel out of the accessibility tree', async () => {
    const fixture = await render();

    expect(summary(fixture).getAttribute('aria-expanded')).toBe('false');
    expect(panels(fixture)[0].querySelector('.module-panel-body-inner')).not.toBeNull();
    expect(panels(fixture)[0].classList.contains('module-panel-open')).toBe(false);
  });

  it('should show the description once the panel is opened', async () => {
    const fixture = await render();

    summary(fixture).click();
    fixture.detectChanges();

    expect(summary(fixture).getAttribute('aria-expanded')).toBe('true');
    expect(panels(fixture)[0].classList.contains('module-panel-open')).toBe(true);
    expect(panels(fixture)[0].querySelector('.module-panel-description')!.textContent)
      .toContain('Shows the current weather report.');
  });

  it('should close a panel that is opened twice', async () => {
    const fixture = await render();

    summary(fixture).click();
    fixture.detectChanges();
    summary(fixture).click();
    fixture.detectChanges();

    expect(summary(fixture).getAttribute('aria-expanded')).toBe('false');
  });

  // Two panels open at once is the point of a list like this — reading one should not shut another.
  it('should leave an open panel open when another is opened', async () => {
    modules.entries = [module(), module({ id: 'ping', name: 'Ping' })];
    const fixture = await render();

    summary(fixture, 0).click();
    fixture.detectChanges();
    summary(fixture, 1).click();
    fixture.detectChanges();

    expect(summary(fixture, 0).getAttribute('aria-expanded')).toBe('true');
    expect(summary(fixture, 1).getAttribute('aria-expanded')).toBe('true');
  });

  it('should point the summary at the body it controls', async () => {
    const fixture = await render();
    const controls = summary(fixture).getAttribute('aria-controls');

    expect(controls).toBe('module-body-weather');
    expect(element(fixture).querySelector(`#${controls}`)).not.toBeNull();
  });

  it('should show the aliases the module also answers to', async () => {
    const fixture = await render();

    summary(fixture).click();
    fixture.detectChanges();

    const aliases = Array.from(panels(fixture)[0].querySelectorAll('.module-panel-alias'))
      .map((chip) => chip.textContent!.trim());

    expect(aliases).toEqual(['!wetter', '!wetterbericht']);
  });

  // The name has to land on the switch Material renders, not on the host element it is written on:
  // a plain attribute binding stays on the host and leaves the control itself unnamed.
  it('should name the switch on the control that carries the role', async () => {
    const fixture = await render();

    expect(toggle(fixture).getAttribute('aria-label')).toBe('Module Weather enabled');
  });

  it('should disable a module that is switched off', async () => {
    const fixture = await render();

    toggle(fixture).click();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    expect(modules.disableModule).toHaveBeenCalledWith(USER, 'weather');
    expect(modules.enableModule).not.toHaveBeenCalled();
  });

  it('should enable a module that is switched on', async () => {
    modules.entries = [module({ enabled: false })];
    const fixture = await render();

    toggle(fixture).click();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    expect(modules.enableModule).toHaveBeenCalledWith(USER, 'weather');
    expect(modules.disableModule).not.toHaveBeenCalled();
  });

  // The switch answers the click rather than the round trip, so it has to be back where it was if
  // the write never lands.
  it('should put the switch back when the write fails', async () => {
    const fixture = await render();
    const failure = vi.spyOn(notifications, 'failure').mockImplementation((): void => undefined);
    modules.disableModule.mockRejectedValueOnce(new Error('nope'));

    toggle(fixture).click();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    expect(toggle(fixture).getAttribute('aria-checked')).toBe('true');
    expect(failure).toHaveBeenCalledWith('Could not turn Weather off.');
  });

  it('should keep the switch where it was put when the write lands', async () => {
    const fixture = await render();

    toggle(fixture).click();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    expect(toggle(fixture).getAttribute('aria-checked')).toBe('false');
  });

  // Opening a panel and switching the module are two separate targets, which is the whole reason
  // the switch is not inside the summary button.
  it('should not open the panel when the switch is used', async () => {
    const fixture = await render();

    toggle(fixture).click();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    expect(summary(fixture).getAttribute('aria-expanded')).toBe('false');
  });

  it('should report a list it could not load', async () => {
    const failure = vi.spyOn(notifications, 'failure').mockImplementation((): void => undefined);
    modules.getModules.mockRejectedValueOnce(new Error('nope'));

    const fixture = await render();

    expect(panels(fixture)).toHaveLength(0);
    expect(element(fixture).querySelector('.module-page-empty')!.textContent)
      .toContain('Could not reach');
    expect(failure).toHaveBeenCalledWith('Could not load your modules.');
  });
});