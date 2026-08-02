import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TwitchService } from './twitch.service';
import { environment } from '../environments/environment';

const API = environment.apiBaseUrl;

function twitchUser(id: number, color: string | null = null): object {
  return {
    id: `${id}`,
    login: `user${id}`,
    displayName: `User${id}`,
    type: '',
    broadcasterType: '',
    description: '',
    profileImageUrl: `https://static-cdn.jtvnw.net/user${id}.png`,
    offlineImageUrl: null,
    createdAt: '2020-01-01T00:00:00Z',
    email: null,
    color,
  };
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

  // A moderator arrives as a full user profile — avatar, colour, roles and all — so nothing has
  // to be looked up a second time to draw one.
  it('should list the moderators as ready-to-show user profiles', async () => {
    const loading = service.getModerators();
    http.expectOne(`${API}/twitch/moderators`).flush([
      {
        ...twitchUser(1, '#9146FF'),
        roles: { broadcaster: false, moderator: true, vip: false, editor: false, verified: false },
      },
      twitchUser(2),
    ]);

    const moderators = await loading;
    expect(moderators.map((user) => user.login)).toEqual(['user1', 'user2']);
    expect(moderators.map((user) => user.color)).toEqual(['#9146FF', null]);
    expect(moderators[0].profileImageUrl).toContain('user1.png');
    expect(moderators[0].roles?.moderator).toBe(true);
  });

  it('should add a moderator', async () => {
    const adding = service.addModerator('42');
    const request = http.expectOne(`${API}/twitch/moderators/42`);
    expect(request.request.method).toBe('POST');
    request.flush(null, { status: 204, statusText: 'No Content' });

    await adding;
  });

  it('should remove a moderator', async () => {
    const removing = service.removeModerator('42');
    const request = http.expectOne(`${API}/twitch/moderators/42`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    await removing;
  });

  // Chatters are never cached, so two reads have to hit the network twice.
  it('should refetch the chatters on every call', async () => {
    const first = service.getChatters();
    http.expectOne(`${API}/twitch/chatters`).flush([twitchUser(1)]);
    expect(await first).toHaveLength(1);

    const second = service.getChatters();
    http.expectOne(`${API}/twitch/chatters`).flush([twitchUser(1), twitchUser(2)]);
    expect(await second).toHaveLength(2);
  });

  it('should list the blocked users', async () => {
    const loading = service.getBlocked();
    http.expectOne(`${API}/twitch/blocked`).flush([twitchUser(7)]);

    expect((await loading).map((user) => user.login)).toEqual(['user7']);
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

  // Splitting for Helix is the backend's job now, so however long the list, this asks once.
  it('should ask for more than 100 users in a single request', async () => {
    const ids = Array.from({ length: 250 }, (_, index) => `${index}`);
    const loading = service.getUsers(ids);

    const requests = http.match((candidate) => candidate.url === `${API}/twitch/users`);
    expect(requests).toHaveLength(1);
    expect(requests[0].request.params.getAll('id')).toHaveLength(250);

    requests[0].flush([{ id: 'whatever' }]);
    await loading;
  });

  it('should list the editors with the date they were granted the role', async () => {
    const loading = service.getEditors();
    http.expectOne(`${API}/twitch/editors`)
      .flush([{ ...twitchUser(1), editorSince: '2019-02-15T04:40:59Z' }]);

    const editors = await loading;
    expect(editors.map((editor) => editor.displayName)).toEqual(['User1']);
    expect(editors[0].editorSince).toBe('2019-02-15T04:40:59Z');
  });

  it('should check moderators as repeated id parameters', async () => {
    const checking = service.getModeratorsById(['1', '2']);

    const request = http.expectOne((candidate) => candidate.url === `${API}/twitch/moderators/check`);
    expect(request.request.params.getAll('id')).toEqual(['1', '2']);

    request.flush([twitchUser(1)]);

    // Only the ids that really are moderators come back, which is what makes this a membership check.
    expect((await checking).map((user) => user.id)).toEqual(['1']);
  });

  it('should check more than 100 moderators in a single request', async () => {
    const ids = Array.from({ length: 150 }, (_, index) => `${index}`);
    const checking = service.getModeratorsById(ids);

    const requests = http.match((candidate) => candidate.url === `${API}/twitch/moderators/check`);
    expect(requests).toHaveLength(1);
    expect(requests[0].request.params.getAll('id')).toHaveLength(150);

    requests[0].flush([twitchUser(1)]);
    await checking;
  });

  // The endpoint rejects an empty list, and the answer is knowable without asking.
  it('should not touch the network for a moderator check of nobody', async () => {
    expect(await service.getModeratorsById([])).toEqual([]);
  });

  it('should report a user who does not moderate', async () => {
    const checking = service.isModerator('42');
    http.expectOne((candidate) => candidate.url === `${API}/twitch/moderators/check`).flush([]);

    expect(await checking).toBe(false);
  });

  it('should report a user who does moderate', async () => {
    const checking = service.isModerator('1');
    http.expectOne((candidate) => candidate.url === `${API}/twitch/moderators/check`).flush([twitchUser(1)]);

    expect(await checking).toBe(true);
  });

  it('should check VIPs as repeated id parameters', async () => {
    const checking = service.getVipsById(['1', '2']);

    const request = http.expectOne((candidate) => candidate.url === `${API}/twitch/vips/check`);
    expect(request.request.params.getAll('id')).toEqual(['1', '2']);

    request.flush([twitchUser(2)]);

    expect((await checking).map((user) => user.id)).toEqual(['2']);
  });

  it('should check more than 100 VIPs in a single request', async () => {
    const ids = Array.from({ length: 150 }, (_, index) => `${index}`);
    const checking = service.getVipsById(ids);

    const requests = http.match((candidate) => candidate.url === `${API}/twitch/vips/check`);
    expect(requests).toHaveLength(1);
    expect(requests[0].request.params.getAll('id')).toHaveLength(150);

    requests[0].flush([twitchUser(2)]);
    await checking;
  });

  it('should not touch the network for a VIP check of nobody', async () => {
    expect(await service.getVipsById([])).toEqual([]);
  });

  it('should report a user who is not a VIP', async () => {
    const checking = service.isVip('42');
    http.expectOne((candidate) => candidate.url === `${API}/twitch/vips/check`).flush([]);

    expect(await checking).toBe(false);
  });

  it('should report a user who is a VIP', async () => {
    const checking = service.isVip('2');
    http.expectOne((candidate) => candidate.url === `${API}/twitch/vips/check`).flush([twitchUser(2)]);

    expect(await checking).toBe(true);
  });

  // The two checks are different endpoints, so a VIP must not be reported as a moderator.
  it('should keep the moderator and VIP checks on separate endpoints', async () => {
    const moderators = service.isModerator('1');
    http.expectOne((candidate) => candidate.url === `${API}/twitch/moderators/check`).flush([]);

    const vips = service.isVip('1');
    http.expectOne((candidate) => candidate.url === `${API}/twitch/vips/check`).flush([twitchUser(1)]);

    expect([await moderators, await vips]).toEqual([false, true]);
  });

  it('should check editors as repeated id parameters', async () => {
    const checking = service.getEditorsById(['1', '2']);

    const request = http.expectOne((candidate) => candidate.url === `${API}/twitch/editors/check`);
    expect(request.request.params.getAll('id')).toEqual(['1', '2']);

    request.flush([{ id: '2', displayName: 'Editor', createdAt: '2019-02-15T04:40:59Z' }]);

    expect((await checking).map((editor) => editor.id)).toEqual(['2']);
  });

  // Twitch has no filtered form of Get Channel Editors, so the backend matches the whole list — the
  // ids never reach Twitch and nothing here has to be split.
  it('should check any number of editors in a single request', async () => {
    const ids = Array.from({ length: 150 }, (_, index) => `${index}`);
    const checking = service.getEditorsById(ids);

    const requests = http.match((candidate) => candidate.url === `${API}/twitch/editors/check`);
    expect(requests).toHaveLength(1);
    expect(requests[0].request.params.getAll('id')).toHaveLength(150);

    requests[0].flush([]);
    await checking;
  });

  it('should not touch the network for an editor check of nobody', async () => {
    expect(await service.getEditorsById([])).toEqual([]);
  });

  it('should report a user who is not an editor', async () => {
    const checking = service.isEditor('42');
    http.expectOne((candidate) => candidate.url === `${API}/twitch/editors/check`).flush([]);

    expect(await checking).toBe(false);
  });

  it('should report a user who is an editor', async () => {
    const checking = service.isEditor('1');
    http.expectOne((candidate) => candidate.url === `${API}/twitch/editors/check`)
      .flush([{ id: '1', displayName: 'Editor', createdAt: '2019-02-15T04:40:59Z' }]);

    expect(await checking).toBe(true);
  });

  // The check must not collide with the full editor list on the neighbouring route.
  it('should keep the editor check off the plain editors route', async () => {
    const checking = service.isEditor('1');

    http.expectNone(`${API}/twitch/editors`);
    http.expectOne((candidate) => candidate.url === `${API}/twitch/editors/check`).flush([]);

    await checking;
  });

  it('should list the followers', async () => {
    const loading = service.getFollowers();
    http.expectOne(`${API}/twitch/followers`).flush([
      { id: '1', login: 'user1', displayName: 'User1', followedAt: '2022-05-24T22:22:08Z' },
    ]);

    expect((await loading).map((follower) => follower.login)).toEqual(['user1']);
  });

  // "Does not follow" is a normal answer, not an error, so it arrives as a 200 with a false flag.
  it('should report a user who does not follow without treating it as a failure', async () => {
    const checking = service.isFollower('42');
    http.expectOne(`${API}/twitch/followers/42`).flush({ following: false, follow: null });

    expect(await checking).toBe(false);
  });

  it('should report a user who does follow', async () => {
    const checking = service.getFollowStatus('1');
    http.expectOne(`${API}/twitch/followers/1`).flush({
      following: true,
      follow: { id: '1', login: 'user1', displayName: 'User1', followedAt: '2022-05-24T22:22:08Z' },
    });

    const status = await checking;
    expect([status.following, status.follow?.followedAt]).toEqual([true, '2022-05-24T22:22:08Z']);
  });

  // The id goes into the path, so one that is not plain digits must not break out of it.
  it('should escape the user id in a follow check', async () => {
    const checking = service.getFollowStatus('a/b');
    http.expectOne(`${API}/twitch/followers/a%2Fb`).flush({ following: false, follow: null });

    await checking;
  });

});