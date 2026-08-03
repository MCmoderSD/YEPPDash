import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { DashModule } from '../dash.module';
import { WheelPageComponent } from './wheel-page.component';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { WheelService } from '../../services/wheel.service';
import { WHEEL_OVERLAY_PARAM } from '../../data/wheel-overlay';
import { separatorMessage, StoredWheel, WheelType } from '../../data/wheel';
import { TwitchUser } from '../../data/twitch-user';

const USER = '644984959';

class FakeWheelService {
  stored: string[] = [];
  saved: string[][] = [];
  spins: { channel: string; index: number }[] = [];
  dismissed: string[] = [];
  failSave = false;

  getWheel = vi.fn(async (): Promise<StoredWheel> => ({ entries: this.stored, type: WheelType.Wheel }));

  saveWheel = vi.fn(async (_channel: string, entries: readonly string[]): Promise<StoredWheel> => {
    if (this.failSave) throw new Error('nope');

    this.saved.push([...entries]);
    this.stored = [...entries];

    return { entries: this.stored, type: WheelType.Wheel };
  });

  spin = vi.fn(async (channel: string, index: number): Promise<void> => {
    this.spins.push({ channel, index });
  });

  dismiss = vi.fn(async (channel: string): Promise<void> => {
    this.dismissed.push(channel);
  });
}

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

describe('WheelPageComponent', () => {
  let api: FakeWheelService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashModule, RouterModule.forRoot([])],
      providers: [
        { provide: AuthService, useValue: { currentUser: signal(twitchUser()) } },
        { provide: WheelService, useClass: FakeWheelService },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
      ],
    }).compileComponents();

    api = TestBed.inject(WheelService) as unknown as FakeWheelService;
  });

  afterEach(() => vi.restoreAllMocks());

  // The page reads the stored wheel as it opens and disables itself until that comes back, so every
  // test has to let it finish before touching anything.
  async function render(): Promise<ComponentFixture<WheelPageComponent>> {
    const fixture = TestBed.createComponent(WheelPageComponent);
    fixture.detectChanges();

    await fixture.whenStable();
    fixture.detectChanges();

    return fixture;
  }

  function element(fixture: ComponentFixture<WheelPageComponent>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function add(fixture: ComponentFixture<WheelPageComponent>, label: string): void {
    const input = element(fixture).querySelector('.wheel-page-add input') as HTMLInputElement;

    input.value = label;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (element(fixture).querySelector('.wheel-page-add button[type="submit"]') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  // The count is its own badge beside the name, so the cell is read part by part rather than as one
  // run of text — Angular drops the whitespace between them.
  function rows(fixture: ComponentFixture<WheelPageComponent>): string[] {
    return [...element(fixture).querySelectorAll('.wheel-page-entry-content')]
      .map((cell) => [...cell.children].map((part) => part.textContent!.trim()).join(' '));
  }

  function slices(fixture: ComponentFixture<WheelPageComponent>): string[] {
    return [...element(fixture).querySelectorAll('.wheel-label')].map((label) => label.textContent!);
  }

  function press(fixture: ComponentFixture<WheelPageComponent>, name: string): void {
    const button = [...element(fixture).querySelectorAll('button')]
      .find((candidate) => candidate.textContent!.includes(name)) as HTMLButtonElement;

    button.click();
    fixture.detectChanges();
  }

  function stop(fixture: ComponentFixture<WheelPageComponent>): void {
    (element(fixture).querySelector('.wheel-disc') as HTMLElement)
      .dispatchEvent(new Event('transitionend'));
    fixture.detectChanges();
  }

  // Writes are chained one behind the other, so a single turn of the microtask queue only reaches
  // the first of them.
  async function saved(fixture: ComponentFixture<WheelPageComponent>): Promise<void> {
    for (let turn = 0; turn < 5; turn++) {
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
    }

    fixture.detectChanges();
  }

  // The dialog is rendered into Material's overlay container on the body, not inside the fixture.
  function dialog(): HTMLElement | null {
    return document.querySelector('mat-dialog-container');
  }

  async function dismiss(fixture: ComponentFixture<WheelPageComponent>, label: string): Promise<void> {
    const button = [...dialog()!.querySelectorAll('button')]
      .find((candidate) => candidate.textContent!.trim() === label) as HTMLButtonElement;

    button.click();
    fixture.detectChanges();

    // The page waits on afterClosed() before it acts on the choice, and that only resolves once the
    // dialog has finished closing — a task later than whenStable() alone settles.
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('should start out empty', async () => {
    const fixture = await render();

    expect(rows(fixture)).toEqual([]);
    expect(element(fixture).querySelector('.wheel-page-empty')).toBeTruthy();
  });

  it('should add a typed entry to the table and to the wheel', async () => {
    const fixture = await render();

    add(fixture, 'Ali');

    expect(rows(fixture)).toEqual(['Ali']);
    expect(slices(fixture)).toEqual(['Ali']);
  });

  it('should clear the field after adding, so the next name can just be typed', async () => {
    const fixture = await render();

    add(fixture, 'Ali');

    expect((element(fixture).querySelector('.wheel-page-add input') as HTMLInputElement).value).toBe('');
  });

  // The point of the counted rows: a name entered twice must not turn the table into two rows.
  it('should count a repeated name in one row instead of adding a second', async () => {
    const fixture = await render();

    add(fixture, 'Ali');
    add(fixture, 'Beatriz');
    add(fixture, 'Ali');

    expect(rows(fixture)).toEqual(['2x Ali', 'Beatriz']);
  });

  it('should still put the repeated name on the wheel twice, spread apart', async () => {
    const fixture = await render();

    add(fixture, 'Ali');
    add(fixture, 'Beatriz');
    add(fixture, 'Ali');

    expect(slices(fixture)).toEqual(['Ali', 'Beatriz', 'Ali']);
  });

  // Taking the last copy away is what removes an entry, so there is no delete button beside it.
  it('should offer only adding and removing one copy per row', async () => {
    const fixture = await render();

    add(fixture, 'Ali');

    const actions = [...element(fixture).querySelectorAll('.wheel-page-actions button')]
      .map((button) => button.getAttribute('aria-label'));

    expect(actions).toEqual(['Add another Ali', 'Remove Ali from the wheel']);
  });

  it('should take an entry off the wheel with the last copy of it', async () => {
    const fixture = await render();

    add(fixture, 'Ali');
    add(fixture, 'Ali');

    const removeOne = (): void => {
      ([...element(fixture).querySelectorAll('.wheel-page-actions button')][1] as HTMLButtonElement).click();
      fixture.detectChanges();
    };

    removeOne();
    expect(rows(fixture)).toEqual(['Ali']);

    removeOne();
    expect(rows(fixture)).toEqual([]);
  });

  it('should sort the entries by name', async () => {
    const fixture = await render();

    add(fixture, 'Charles');
    add(fixture, 'Ali');
    add(fixture, 'Beatriz');
    press(fixture, 'Sort');

    expect(rows(fixture)).toEqual(['Ali', 'Beatriz', 'Charles']);
  });

  it('should keep every entry when shuffling', async () => {
    const fixture = await render();

    add(fixture, 'Ali');
    add(fixture, 'Beatriz');
    add(fixture, 'Charles');
    press(fixture, 'Shuffle');

    expect([...rows(fixture)].sort()).toEqual(['Ali', 'Beatriz', 'Charles']);
  });

  it('should keep shuffle, sort and clear together above the list', async () => {
    const fixture = await render();

    // The first row; import and export sit in a second one below it.
    const toolbar = [...element(fixture).querySelectorAll('.wheel-page-toolbar')[0].querySelectorAll('button')]
      .map((button) => button.textContent!.trim());

    expect(toolbar).toEqual(['shuffleShuffle', 'sort_by_alphaSort', 'delete_sweepClear']);
  });

  // Under the wheel rather than in that row, because it is about the wheel and not about the list.
  it('should put the spin button with the wheel', async () => {
    const fixture = await render();

    expect(element(fixture).querySelector('.wheel-page-stage .wheel-page-spin')).toBeTruthy();
    expect(element(fixture).querySelector('.wheel-page-toolbar .wheel-page-spin')).toBeNull();
  });

  // A wheel is a thing you expect to be able to hit, so the button is not the only way to spin it.
  it('should spin when the wheel itself is clicked', async () => {
    const fixture = await render();

    add(fixture, 'Ali');
    add(fixture, 'Beatriz');

    (element(fixture).querySelector('app-wheel') as HTMLElement).click();
    fixture.detectChanges();

    expect(api.spins.at(-1)?.channel).toBe(USER);

    stop(fixture);
    await fixture.whenStable();
    await dismiss(fixture, 'Close');
  });

  it('should not invite a click while it is already turning', async () => {
    const fixture = await render();

    add(fixture, 'Ali');
    add(fixture, 'Beatriz');
    press(fixture, 'Spin');

    expect(element(fixture).querySelector('app-wheel')!.classList).not.toContain('wheel-interactive');
  });

  it('should announce the winner in a dialog once the wheel stops', async () => {
    const fixture = await render();

    add(fixture, 'Ali');
    add(fixture, 'Beatriz');
    press(fixture, 'Spin');

    expect(dialog()).toBeNull();

    stop(fixture);
    await fixture.whenStable();

    expect(dialog()!.querySelector('.wheel-winner-title')!.textContent).toContain('We have a winner!');
    expect(['Ali', 'Beatriz']).toContain(dialog()!.querySelector('.wheel-winner-name')!.textContent);
  });

  it('should close the dialog again and leave the wheel as it was', async () => {
    const fixture = await render();

    add(fixture, 'Ali');
    add(fixture, 'Beatriz');
    press(fixture, 'Spin');
    stop(fixture);
    await fixture.whenStable();

    await dismiss(fixture, 'Close');

    expect(dialog()).toBeNull();
    expect(rows(fixture).length).toBe(2);
  });

  // Removing the name that just won is the usual next step of a draw, so it is offered where the
  // winner is announced rather than left to be found in the table.
  it('should take the winner off the wheel when asked to', async () => {
    const fixture = await render();

    add(fixture, 'Ali');
    add(fixture, 'Beatriz');
    press(fixture, 'Spin');
    stop(fixture);
    await fixture.whenStable();

    const winner = dialog()!.querySelector('.wheel-winner-name')!.textContent;
    await dismiss(fixture, 'Remove');

    expect(rows(fixture)).toEqual([winner === 'Ali' ? 'Beatriz' : 'Ali']);
  });

  // A name on the wheel twice has had one of its two slices come up, not both.
  it('should take only the one copy that won', async () => {
    const fixture = await render();

    add(fixture, 'Ali');
    add(fixture, 'Ali');
    add(fixture, 'Beatriz');

    // Pinned so the first slice — one of Ali's two — is the one that comes up.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    press(fixture, 'Spin');
    stop(fixture);
    await fixture.whenStable();

    expect(dialog()!.querySelector('.wheel-winner-name')!.textContent).toBe('Ali');

    await dismiss(fixture, 'Remove');

    expect(rows(fixture)).toEqual(['Ali', 'Beatriz']);
  });

  it('should refuse to spin a wheel with fewer than two slices', async () => {
    const fixture = await render();

    add(fixture, 'Ali');

    expect((element(fixture).querySelector('.wheel-page-spin') as HTMLButtonElement).disabled).toBe(true);
  });

  describe('overlay', () => {
    it('should hand out a link naming the signed-in channel', async () => {
      const fixture = await render();
      const link = element(fixture).querySelector('.wheel-page-overlay-link input') as HTMLInputElement;

      expect(new URL(link.value).searchParams.get(WHEEL_OVERLAY_PARAM)).toBe(USER);
    });

    it('should keep the link unchanged as the list is edited', async () => {
      const fixture = await render();
      const link = (): string =>
        (element(fixture).querySelector('.wheel-page-overlay-link input') as HTMLInputElement).value;

      const before = link();
      add(fixture, 'Ali');

      expect(link()).toBe(before);
    });

    // Both wheels have to stop on the same name, so the slice is drawn once and sent through the
    // server, rather than each wheel drawing one for itself. The server is the only path OBS —
    // which runs a browser of its own — can be reached by.
    it('should send the slice it landed on to the server, and land on it', async () => {
      const fixture = await render();

      add(fixture, 'Ali');
      add(fixture, 'Beatriz');
      add(fixture, 'Charles');
      press(fixture, 'Spin');
      await fixture.whenStable();

      expect(api.spins).toHaveLength(1);
      expect(api.spins[0].channel).toBe(USER);

      stop(fixture);
      await fixture.whenStable();

      const winner = dialog()!.querySelector('.wheel-winner-name')!.textContent;
      expect(winner).toBe(['Ali', 'Beatriz', 'Charles'][api.spins[0].index]);

      await dismiss(fixture, 'Close');
    });

    // The overlay has no controls of its own, so the winner would otherwise stay on the stream for
    // good.
    it('should tell the server when the winner has been dismissed', async () => {
      const fixture = await render();

      add(fixture, 'Ali');
      add(fixture, 'Beatriz');
      press(fixture, 'Spin');
      stop(fixture);
      await fixture.whenStable();

      expect(api.dismissed).toEqual([]);

      await dismiss(fixture, 'Close');

      expect(api.dismissed).toEqual([USER]);
    });

    // The streamer is watching this wheel; waiting for the round trip before turning it would put a
    // stutter on the thing they are looking at.
    it('should turn its own wheel without waiting for the server', async () => {
      const fixture = await render();

      add(fixture, 'Ali');
      add(fixture, 'Beatriz');
      api.spin.mockImplementation((): Promise<void> => new Promise((): void => undefined));

      press(fixture, 'Spin');

      expect(element(fixture).querySelector('.wheel-disc')!.getAttribute('style'))
        .toContain('rotate(');
    });

    // A spin the server never heard about still has to leave the dashboard usable.
    it('should keep going when the server cannot be told', async () => {
      const fixture = await render();

      add(fixture, 'Ali');
      add(fixture, 'Beatriz');
      api.spin.mockRejectedValue(new Error('nope'));

      press(fixture, 'Spin');
      await fixture.whenStable();
      stop(fixture);
      await fixture.whenStable();

      expect(dialog()).toBeTruthy();
      await dismiss(fixture, 'Close');
    });
  });

  describe('storage', () => {
    it('should put the stored wheel on screen when the page opens', async () => {
      api.stored = ['Ali', 'Beatriz', 'Ali'];

      const fixture = await render();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(rows(fixture)).toEqual(['2x Ali', 'Beatriz']);
      expect(api.getWheel).toHaveBeenCalledWith(USER);
    });

    // A count has nowhere to live in a comma-joined column, so a doubled entry goes out twice — in
    // the order the table lists it, not the order the wheel lays it out.
    it('should send a doubled entry twice, in table order', async () => {
      const fixture = await render();

      add(fixture, 'Ali');
      add(fixture, 'Beatriz');
      add(fixture, 'Ali');
      await saved(fixture);

      expect(api.saved.at(-1)).toEqual(['Ali', 'Ali', 'Beatriz']);
    });

    it('should save after every change to the list', async () => {
      const fixture = await render();

      add(fixture, 'Charles');
      add(fixture, 'Ali');
      press(fixture, 'Sort');
      await saved(fixture);

      expect(api.saved.at(-1)).toEqual(['Ali', 'Charles']);
    });

    it('should say so when the wheel cannot be saved', async () => {
      const fixture = await render();
      api.failSave = true;

      add(fixture, 'Ali');
      await saved(fixture);

      expect(TestBed.inject(NotificationService).notifications().at(-1)?.message)
        .toContain('Could not save');
    });

    // The comma is what separates the entries in storage, so one inside a name would come back as
    // two names.
    it('should refuse an entry containing a comma', async () => {
      const fixture = await render();

      add(fixture, 'Ali, the first');
      await saved(fixture);

      expect(rows(fixture)).toEqual([]);
      expect(api.saved).toEqual([]);
      expect(TestBed.inject(NotificationService).notifications().at(-1)?.message)
        .toBe(separatorMessage());
    });
  });

  describe('import and export', () => {
    function pick(fixture: ComponentFixture<WheelPageComponent>, content: string): Promise<void> {
      const input = element(fixture).querySelector('.wheel-page-file') as HTMLInputElement;
      const file = new File([content], 'wheel.txt', { type: 'text/plain' });

      // A file input's list cannot be assigned, so the picked file is put there directly.
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change'));

      return fixture.whenStable();
    }

    it('should put the entries of a picked file on the wheel', async () => {
      const fixture = await render();

      await pick(fixture, 'Ali\nBeatriz\nAli\n');
      fixture.detectChanges();

      expect(rows(fixture)).toEqual(['2x Ali', 'Beatriz']);
    });

    it('should store what it imported', async () => {
      const fixture = await render();

      await pick(fixture, 'Ali\nBeatriz');
      await fixture.whenStable();

      expect(api.saved.at(-1)).toEqual(['Ali', 'Beatriz']);
    });

    it('should say which lines it could not take', async () => {
      const fixture = await render();

      await pick(fixture, 'Ali\nBeatriz, the second');
      fixture.detectChanges();

      expect(rows(fixture)).toEqual(['Ali']);
      expect(TestBed.inject(NotificationService).notifications().some((note) => note.message.includes('Skipped 1 line')))
        .toBe(true);
    });

    it('should ask before replacing a wheel that already holds entries', async () => {
      const fixture = await render();

      add(fixture, 'Charles');
      await pick(fixture, 'Ali\nBeatriz');
      fixture.detectChanges();

      expect(dialog()).toBeTruthy();
      expect(rows(fixture)).toEqual(['Charles']);

      await dismiss(fixture, 'Replace');

      expect(rows(fixture)).toEqual(['Ali', 'Beatriz']);
    });

    // Both are about the list as a whole, so they sit after it rather than among the buttons that
    // edit it.
    it('should offer import and export below the table', async () => {
      const fixture = await render();

      const table = element(fixture).querySelector('.wheel-page-table')!;
      const importButton = [...element(fixture).querySelectorAll('button')]
        .find((button) => button.textContent!.includes('Import'))!;

      expect(table.compareDocumentPosition(importButton) & Node.DOCUMENT_POSITION_FOLLOWING)
        .toBeTruthy();
    });

    it('should mark import and export with an arrow each way', async () => {
      const fixture = await render();

      const icons = [...element(fixture).querySelectorAll('button')]
        .filter((button) => /Import|Export/.test(button.textContent!))
        .map((button) => button.querySelector('mat-icon')!.textContent);

      expect(icons).toEqual(['arrow_upward', 'arrow_downward']);
    });

    it('should write one entry per line, doubled entries twice', async () => {
      const fixture = await render();
      const written: string[] = [];

      // jsdom has no object URLs, and the download is a click on a link carrying one.
      vi.spyOn(URL, 'createObjectURL').mockImplementation((file: Blob | MediaSource): string => {
        void (file as Blob).text().then((text: string): number => written.push(text));
        return 'blob:wheel';
      });
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation((): void => undefined);

      add(fixture, 'Ali');
      add(fixture, 'Beatriz');
      add(fixture, 'Ali');
      press(fixture, 'Export');

      return fixture.whenStable().then((): void => {
        expect(written).toEqual(['Ali\nAli\nBeatriz']);
      });
    });
  });
});
