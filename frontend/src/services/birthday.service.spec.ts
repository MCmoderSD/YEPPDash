import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BirthdayService } from './birthday.service';
import { environment } from '../environments/environment';
import { Birthday } from '../data/birthday';

const API = environment.apiBaseUrl;
const USER = '644984959';

const BIRTHDAY: Birthday = { userId: USER, day: 17, month: 5, year: 2000 };

describe('BirthdayService', () => {
  let service: BirthdayService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(BirthdayService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should read the birthday of the given user', async () => {
    const loading = service.getBirthday(USER);
    http.expectOne(`${API}/birthday/${USER}`).flush(BIRTHDAY);

    expect(await loading).toEqual(BIRTHDAY);
  });

  // The ordinary answer for somebody who never set one, so it must not reach the caller as an error.
  it('should answer with null when the user has no birthday', async () => {
    const loading = service.getBirthday(USER);
    http.expectOne(`${API}/birthday/${USER}`)
      .flush(null, { status: 404, statusText: 'Not Found' });

    expect(await loading).toBeNull();
  });

  it('should pass on a failure that is not a missing birthday', async () => {
    const loading = service.getBirthday(USER);
    http.expectOne(`${API}/birthday/${USER}`)
      .flush('nope', { status: 500, statusText: 'Server Error' });

    await expect(loading).rejects.toBeTruthy();
  });

  // No cache: opening the same lookup twice hits the network twice. See birthday.service.ts for why
  // that is fine here.
  it('should ask again for the same user rather than caching', async () => {
    const first = service.getBirthday(USER);
    http.expectOne(`${API}/birthday/${USER}`).flush(BIRTHDAY);
    await first;

    const second = service.getBirthday(USER);
    http.expectOne(`${API}/birthday/${USER}`).flush(BIRTHDAY);

    expect(await second).toEqual(BIRTHDAY);
  });

  it('should post a birthday for a user who has none', async () => {
    const adding = service.addBirthday(USER, { day: 17, month: 5, year: 2000 });

    const request = http.expectOne(`${API}/birthday/${USER}`);
    expect([request.request.method, request.request.body])
      .toEqual(['POST', { day: 17, month: 5, year: 2000 }]);
    request.flush(BIRTHDAY);

    expect(await adding).toEqual(BIRTHDAY);
  });

  it('should patch the birthday of a user who has one', async () => {
    const changed: Birthday = { ...BIRTHDAY, day: 1, month: 3 };
    const updating = service.updateBirthday(USER, { day: 1, month: 3, year: 2000 });

    const request = http.expectOne(`${API}/birthday/${USER}`);
    expect([request.request.method, request.request.body])
      .toEqual(['PATCH', { day: 1, month: 3, year: 2000 }]);
    request.flush(changed);

    expect(await updating).toEqual(changed);
  });

  // The id goes into the path, so one that is not plain digits must not break out of it.
  it('should escape the user id it is handed', async () => {
    const loading = service.getBirthday('a/b');
    http.expectOne(`${API}/birthday/a%2Fb`).flush(null, { status: 404, statusText: 'Not Found' });

    await loading;
  });

  // A different route from the single-birthday read: plural, and the id names the channel whose
  // followers to look at rather than the person the birthday belongs to.
  it('should read the follower birthdays off the plural route', async () => {
    const loading = service.getFollowerBirthdays(USER);

    http.expectNone(`${API}/birthday/${USER}`);
    const request = http.expectOne(`${API}/birthdays/${USER}`);
    expect(request.request.method).toBe('GET');
    request.flush([BIRTHDAY, { userId: '1', day: 1, month: 3, year: 1999 }]);

    expect((await loading).map((birthday) => birthday.userId)).toEqual([USER, '1']);
  });

  it('should answer with an empty list when no follower has a birthday', async () => {
    const loading = service.getFollowerBirthdays(USER);
    http.expectOne(`${API}/birthdays/${USER}`).flush([]);

    expect(await loading).toEqual([]);
  });

  it('should escape the channel id in a follower birthday lookup', async () => {
    const loading = service.getFollowerBirthdays('a/b');
    http.expectOne(`${API}/birthdays/a%2Fb`).flush([]);

    await loading;
  });
});
