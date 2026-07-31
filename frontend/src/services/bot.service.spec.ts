import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BotResult, BotService } from './bot.service';
import { environment } from '../environments/environment';

const API = environment.apiBaseUrl;
const CHANNEL = '644984959';

function result(overrides: Partial<BotResult> = {}): BotResult {
  return { success: true, status: 200, message: 'Joined channel: SomeChannel', ...overrides };
}

describe('BotService', () => {
  let service: BotService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(BotService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should ask the channel to be joined', async () => {
    const joining = service.joinChannel(CHANNEL);

    const request = http.expectOne(`${API}/bot/${CHANNEL}/join`);
    expect(request.request.method).toBe('POST');
    request.flush(result());

    expect((await joining).message).toBe('Joined channel: SomeChannel');
  });

  it('should ask the channel to be left', async () => {
    const leaving = service.leaveChannel(CHANNEL);

    const request = http.expectOne(`${API}/bot/${CHANNEL}/leave`);
    expect(request.request.method).toBe('POST');
    request.flush(result({ message: 'Left channel: SomeChannel' }));

    expect((await leaving).message).toBe('Left channel: SomeChannel');
  });

  // The bot takes no body — the channel is the whole request.
  it('should send no body', async () => {
    const joining = service.joinChannel(CHANNEL);

    const request = http.expectOne(`${API}/bot/${CHANNEL}/join`);
    expect(request.request.body).toBeNull();
    request.flush(result());

    await joining;
  });

  it('should pass on a refusal', async () => {
    const joining = service.joinChannel(CHANNEL);
    http.expectOne(`${API}/bot/${CHANNEL}/join`)
      .flush(result({ success: false, status: 0, message: 'Could not reach YEPPBot.' }),
        { status: 502, statusText: 'Bad Gateway' });

    await expect(joining).rejects.toBeTruthy();
  });

  // The id goes into the path, so one that is not plain digits must not break out of it.
  it('should escape the channel id it is handed', async () => {
    const joining = service.joinChannel('a/b');
    http.expectOne(`${API}/bot/a%2Fb/join`).flush(result());

    await joining;
  });
});
