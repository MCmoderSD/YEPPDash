import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ModuleService } from './module.service';
import { environment } from '../environments/environment';
import { BotModule } from '../data/bot-module';

const API = environment.apiBaseUrl;
const CHANNEL = '644984959';

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

describe('ModuleService', () => {
  let service: ModuleService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ModuleService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should read the modules of the given channel', async () => {
    const loading = service.getModules(CHANNEL);

    const request = http.expectOne(`${API}/modules/${CHANNEL}`);
    expect(request.request.method).toBe('GET');
    request.flush([module(), module({ id: 'ping', name: 'Ping', enabled: false })]);

    expect((await loading).map((entry) => entry.id)).toEqual(['weather', 'ping']);
  });

  it('should enable a module on its own route', async () => {
    const enabling = service.enableModule(CHANNEL, 'weather');

    const request = http.expectOne(`${API}/modules/${CHANNEL}/weather/enable`);
    expect(request.request.method).toBe('POST');
    request.flush(module({ enabled: true }));

    expect((await enabling).enabled).toBe(true);
  });

  it('should disable a module on its own route', async () => {
    const disabling = service.disableModule(CHANNEL, 'weather');

    const request = http.expectOne(`${API}/modules/${CHANNEL}/weather/disable`);
    expect(request.request.method).toBe('POST');
    request.flush(module({ enabled: false }));

    expect((await disabling).enabled).toBe(false);
  });

  // Which one runs is the route, not the body — there is nothing else to send.
  it('should send no body when flipping a module', async () => {
    const enabling = service.enableModule(CHANNEL, 'weather');

    const request = http.expectOne(`${API}/modules/${CHANNEL}/weather/enable`);
    expect(request.request.body).toBeNull();
    request.flush(module());

    await enabling;
  });

  it('should not reach the disable route when asked to enable', async () => {
    const enabling = service.enableModule(CHANNEL, 'weather');

    http.expectNone(`${API}/modules/${CHANNEL}/weather/disable`);
    http.expectOne(`${API}/modules/${CHANNEL}/weather/enable`).flush(module());

    await enabling;
  });

  it('should pass on a failure', async () => {
    const loading = service.getModules(CHANNEL);
    http.expectOne(`${API}/modules/${CHANNEL}`)
      .flush('nope', { status: 500, statusText: 'Server Error' });

    await expect(loading).rejects.toBeTruthy();
  });

  // Both go into the path, so neither may break out of it.
  it('should escape the channel id it is handed', async () => {
    const loading = service.getModules('a/b');
    http.expectOne(`${API}/modules/a%2Fb`).flush([]);

    await loading;
  });

  it('should escape the module id it is handed', async () => {
    const disabling = service.disableModule(CHANNEL, 'a/b');
    http.expectOne(`${API}/modules/${CHANNEL}/a%2Fb/disable`).flush(module());

    await disabling;
  });
});