import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TwitchService } from './twitch.service';
import { environment } from '../environments/environment';
import { ChannelUser } from '../data/channel-user';

const API = environment.apiBaseUrl;

function channelUser(id: number): ChannelUser {
  return { id: `${id}`, login: `user${id}`, displayName: `User${id}` };
}

describe('TwitchService', () => {
  let service: TwitchService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(TwitchService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should keep the chat colour null when the request fails', async () => {
    const loading = service.loadChatColor();
    http.expectOne(`${API}/twitch/chat-color`).flush(null, { status: 502, statusText: 'Bad Gateway' });
    await loading;

    expect(service.chatColor()).toBeNull();
  });

  it('should publish the loaded moderator list as a signal', async () => {
    expect(service.moderators()).toBeNull();

    const loading = service.loadModerators();
    http.expectOne(`${API}/twitch/moderators`).flush([channelUser(1), channelUser(2)]);

    expect(await loading).toHaveLength(2);
    expect(service.moderators()?.map((user) => user.login)).toEqual(['user1', 'user2']);
  });

  it('should drop the cached list after a moderator change so the next read refetches', async () => {
    const loading = service.loadModerators();
    http.expectOne(`${API}/twitch/moderators`).flush([channelUser(1)]);
    await loading;

    const adding = service.addModerator('42');
    http.expectOne(`${API}/twitch/moderators/42`).flush(null, { status: 204, statusText: 'No Content' });
    await adding;

    expect(service.moderators()).toBeNull();
  });

  it('should publish the loaded blocked list as a signal', async () => {
    const loading = service.loadBlocked();
    http.expectOne(`${API}/twitch/blocked`).flush([channelUser(7)]);

    expect(await loading).toHaveLength(1);
    expect(service.blocked()?.map((user) => user.login)).toEqual(['user7']);
  });

  it('should unban a user', async () => {
    const unbanning = service.unbanUser('3');
    http.expectOne(`${API}/twitch/banned/3`).flush(null, { status: 204, statusText: 'No Content' });
    await unbanning;
  });

  // "Not banned" is a normal answer, not an error, so it arrives as a 200 with a false flag.
  it('should report an unbanned user without treating it as a failure', async () => {
    const checking = service.isBanned('42');
    http.expectOne(`${API}/twitch/banned/42`).flush({ banned: false, ban: null });

    expect(await checking).toBe(false);
  });

  it('should not touch the network when nothing was asked for', async () => {
    expect(await service.getUsers()).toEqual([]);
  });

  it('should send ids and logins as repeated query parameters', async () => {
    const loading = service.getUsers(['1', '2'], ['mcmodersd']);

    const request = http.expectOne((candidate) => candidate.url === `${API}/twitch/users`);
    expect(request.request.params.getAll('id')).toEqual(['1', '2']);
    expect(request.request.params.getAll('login')).toEqual(['mcmodersd']);

    request.flush([]);
    await loading;
  });

  // Helix caps Get Users at 100 ids/logins, so anything longer has to be split — the caller
  // still gets one flat list back.
  it('should split more than 100 users into batches and merge the results', async () => {
    const ids = Array.from({ length: 250 }, (_, index) => `${index}`);
    const loading = service.getUsers(ids);

    const requests = http.match((candidate) => candidate.url === `${API}/twitch/users`);
    expect(requests.map((request) => request.request.params.getAll('id')?.length)).toEqual([100, 100, 50]);

    requests.forEach((request, batch) => request.flush([{ id: `batch${batch}` }]));

    expect((await loading).map((user) => user.id)).toEqual(['batch0', 'batch1', 'batch2']);
  });
});