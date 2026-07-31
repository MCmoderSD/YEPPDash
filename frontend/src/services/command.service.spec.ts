import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CommandService } from './command.service';
import { environment } from '../environments/environment';
import { CommandResponseType, CommandUserLevel, CustomCommand } from '../data/custom-command';

const API = environment.apiBaseUrl;
const CHANNEL = '644984959';

function command(overrides: Partial<CustomCommand> = {}): CustomCommand {
  return {
    name: 'hug',
    aliases: ['cuddle'],
    message: 'YEPP',
    active: true,
    responseType: CommandResponseType.Reply,
    userLevel: CommandUserLevel.Everyone,
    ...overrides,
  };
}

describe('CommandService', () => {
  let service: CommandService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(CommandService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should read the commands of the given channel', async () => {
    const loading = service.getCommands(CHANNEL);

    const request = http.expectOne(`${API}/commands/${CHANNEL}`);
    expect(request.request.method).toBe('GET');
    request.flush([command()]);

    expect((await loading).map((entry) => entry.name)).toEqual(['hug']);
  });

  // A channel that never added one — not an error, and not a 404.
  it('should answer with an empty list when the channel has no commands', async () => {
    const loading = service.getCommands(CHANNEL);
    http.expectOne(`${API}/commands/${CHANNEL}`).flush([]);

    expect(await loading).toEqual([]);
  });

  it('should post a new command to the channel route', async () => {
    const adding = service.addCommand(CHANNEL, command());

    const request = http.expectOne(`${API}/commands/${CHANNEL}`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(command());
    request.flush(command());

    expect((await adding).name).toBe('hug');
  });

  // The name in the path is the one it is stored under; the body may carry a different one, which
  // is how a command is renamed.
  it('should patch an update onto the name it is stored under', async () => {
    const updating = service.updateCommand(CHANNEL, 'hug', command({ name: 'squeeze' }));

    const request = http.expectOne(`${API}/commands/${CHANNEL}/hug`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body.name).toBe('squeeze');
    request.flush(command({ name: 'squeeze' }));

    expect((await updating).name).toBe('squeeze');
  });

  it('should flip a command on its own route rather than sending the whole command back', async () => {
    const flipping = service.setActive(CHANNEL, 'hug', false);

    http.expectNone(`${API}/commands/${CHANNEL}/hug`);
    const request = http.expectOne(`${API}/commands/${CHANNEL}/hug/active`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ active: false });
    request.flush(command({ active: false }));

    expect((await flipping).active).toBe(false);
  });

  it('should delete a command by name', async () => {
    const deleting = service.deleteCommand(CHANNEL, 'hug');

    const request = http.expectOne(`${API}/commands/${CHANNEL}/hug`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);

    await deleting;
  });

  it('should pass on a failure', async () => {
    const loading = service.getCommands(CHANNEL);
    http.expectOne(`${API}/commands/${CHANNEL}`)
      .flush('nope', { status: 500, statusText: 'Server Error' });

    await expect(loading).rejects.toBeTruthy();
  });

  // Both go into the path, so neither may break out of it.
  it('should escape the channel id it is handed', async () => {
    const loading = service.getCommands('a/b');
    http.expectOne(`${API}/commands/a%2Fb`).flush([]);

    await loading;
  });

  it('should escape the command name it is handed', async () => {
    const deleting = service.deleteCommand(CHANNEL, 'a/b');
    http.expectOne(`${API}/commands/${CHANNEL}/a%2Fb`).flush(null);

    await deleting;
  });
});
