import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BdsmService } from './bdsm.service';
import { environment } from '../environments/environment';
import { BDSM_TRAITS, BdsmResult, BdsmTraitKey } from '../data/bdsm-result';

const API = environment.apiBaseUrl;
const USER = '644984959';

function result(overrides: Partial<BdsmResult> = {}): BdsmResult {
  const traits = Object.fromEntries(
    BDSM_TRAITS.map((trait) => [trait.key, 0.5]),
  ) as Record<BdsmTraitKey, number>;

  return {
    id: 'abc123',
    userId: USER,
    timestamp: '2026-07-31T12:34:56Z',
    version: 3,
    gender: 'Female',
    ageGroup: '23-25',
    traits,
    ...overrides,
  };
}

describe('BdsmService', () => {
  let service: BdsmService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(BdsmService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should read the results of the given user', async () => {
    const loading = service.getResults(USER);

    const request = http.expectOne(`${API}/bdsm/${USER}`);
    expect(request.request.method).toBe('GET');
    request.flush([result()]);

    expect((await loading).map((entry) => entry.id)).toEqual(['abc123']);
  });

  // A user can take the test more than once, so the endpoint answers with a history rather than one.
  it('should keep the order the backend sends results in', async () => {
    const loading = service.getResults(USER);
    http.expectOne(`${API}/bdsm/${USER}`).flush([
      result({ id: 'newer', timestamp: '2026-07-31T12:00:00Z' }),
      result({ id: 'older', timestamp: '2024-01-01T12:00:00Z' }),
    ]);

    expect((await loading).map((entry) => entry.id)).toEqual(['newer', 'older']);
  });

  // The ordinary answer for somebody who never took the test — not an error, and not a 404.
  it('should answer with an empty list when the user has no results', async () => {
    const loading = service.getResults(USER);
    http.expectOne(`${API}/bdsm/${USER}`).flush([]);

    expect(await loading).toEqual([]);
  });

  it('should pass on a failure', async () => {
    const loading = service.getResults(USER);
    http.expectOne(`${API}/bdsm/${USER}`)
      .flush('nope', { status: 500, statusText: 'Server Error' });

    await expect(loading).rejects.toBeTruthy();
  });

  // A different route from the single-user read: the id names the channel whose followers to look at
  // rather than the person the result belongs to.
  it('should read the follower results off the followers route', async () => {
    const loading = service.getFollowerResults(USER);

    http.expectNone(`${API}/bdsm/${USER}`);
    const request = http.expectOne(`${API}/bdsm/followers/${USER}`);
    expect(request.request.method).toBe('GET');
    request.flush([result(), result({ id: 'other', userId: '1' })]);

    expect((await loading).map((entry) => entry.userId)).toEqual([USER, '1']);
  });

  it('should answer with an empty list when no follower has a result', async () => {
    const loading = service.getFollowerResults(USER);
    http.expectOne(`${API}/bdsm/followers/${USER}`).flush([]);

    expect(await loading).toEqual([]);
  });

  // The id goes into the path, so one that is not plain digits must not break out of it.
  it('should escape the user id it is handed', async () => {
    const loading = service.getResults('a/b');
    http.expectOne(`${API}/bdsm/a%2Fb`).flush([]);

    await loading;
  });

  it('should escape the channel id in a follower lookup', async () => {
    const loading = service.getFollowerResults('a/b');
    http.expectOne(`${API}/bdsm/followers/a%2Fb`).flush([]);

    await loading;
  });
});
