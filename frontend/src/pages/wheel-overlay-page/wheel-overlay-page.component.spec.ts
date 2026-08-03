import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WheelOverlayPageComponent } from './wheel-overlay-page.component';
import { WheelService } from '../../services/wheel.service';
import { WheelListener, WheelMessage, WheelSyncService } from '../../services/wheel-sync.service';
import { StoredWheel, WheelType } from '../../data/wheel';

const CHANNEL = '164284617';

class FakeWheelService {
  stored: string[] = [];
  fail = false;

  getWheel = vi.fn(async (): Promise<StoredWheel> => {
    if (this.fail) throw new Error('nope');

    return { entries: this.stored, type: WheelType.Wheel };
  });
}

class FakeWheelSyncService {
  channels: string[] = [];
  closed = 0;

  private receive: ((message: WheelMessage) => void) | null = null;
  private opened: (() => void) | null = null;

  listen(
    channelId: string,
    receive: (message: WheelMessage) => void,
    opened: () => void = (): void => undefined,
  ): WheelListener {
    this.channels.push(channelId);
    this.receive = receive;
    this.opened = opened;

    return { close: (): number => (this.closed += 1) };
  }

  // Stands in for the server pushing something out on this channel.
  deliver(message: WheelMessage): void {
    this.receive?.(message);
  }

  // Stands in for the stream connecting, which EventSource also does again after a drop.
  reconnect(): void {
    this.opened?.();
  }
}

describe('WheelOverlayPageComponent', () => {
  let sync: FakeWheelSyncService;
  let api: FakeWheelService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WheelOverlayPageComponent],
      providers: [
        { provide: WheelSyncService, useClass: FakeWheelSyncService },
        { provide: WheelService, useClass: FakeWheelService },
      ],
    }).compileComponents();

    sync = TestBed.inject(WheelSyncService) as unknown as FakeWheelSyncService;
    api = TestBed.inject(WheelService) as unknown as FakeWheelService;
  });

  afterEach(() => vi.restoreAllMocks());

  // null rather than undefined for "no channel in the link": passing undefined to an argument with
  // a default is the default, so the test asking for no channel would quietly get one.
  function render(channel: string | null = CHANNEL): ComponentFixture<WheelOverlayPageComponent> {
    const fixture = TestBed.createComponent(WheelOverlayPageComponent);

    if (channel !== null) fixture.componentRef.setInput('channel', channel);
    fixture.detectChanges();

    return fixture;
  }

  function element(fixture: ComponentFixture<WheelOverlayPageComponent>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function labels(fixture: ComponentFixture<WheelOverlayPageComponent>): string[] {
    return [...element(fixture).querySelectorAll('.wheel-label')].map((label) => label.textContent!);
  }

  function state(fixture: ComponentFixture<WheelOverlayPageComponent>, slices: string[]): void {
    sync.deliver({ type: 'state', entries: slices });
    fixture.detectChanges();
  }

  // OBS lays the source over whatever the scene has behind it, so the page may not paint anything
  // of its own — and the app's own body background is dark.
  it('should take the app background off the document while it is showing', () => {
    expect(document.documentElement.classList.contains('app-transparent')).toBe(false);

    const fixture = render();

    expect(document.documentElement.classList.contains('app-transparent')).toBe(true);

    // Put back when the overlay goes away, so the dashboard behind the same app keeps its own.
    fixture.destroy();

    expect(document.documentElement.classList.contains('app-transparent')).toBe(false);
  });

  it('should listen on the channel named in the link', () => {
    render();

    expect(sync.channels).toEqual([CHANNEL]);
  });

  // EventSource reconnects by itself after the stream drops, and everything said while it was away
  // was said to nobody — so the list has to be read again, not waited for.
  it('should read the list again on every connect', async () => {
    const fixture = render();
    await fixture.whenStable();

    api.stored = ['Charles'];
    sync.reconnect();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(labels(fixture)).toEqual(['Charles']);
  });

  it('should draw the wheel the dashboard sends it', () => {
    const fixture = render();

    state(fixture, ['Ali', 'Beatriz', 'Ali']);

    expect(labels(fixture)).toEqual(['Ali', 'Beatriz', 'Ali']);
  });

  it('should follow a later change to the list', () => {
    const fixture = render();

    state(fixture, ['Ali', 'Beatriz']);
    state(fixture, ['Charles']);

    expect(labels(fixture)).toEqual(['Charles']);
  });

  it('should say it is loading until the stored wheel comes back', () => {
    const fixture = render();

    expect(element(fixture).querySelector('.overlay-hint')!.textContent!.trim()).toBe('Loading…');
  });

  it('should say the wheel is empty once nothing came back for it', async () => {
    const fixture = render();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(element(fixture).querySelector('.overlay-hint')!.textContent!.trim())
      .toBe('No entries on this wheel yet. Add some on the Lucky Wheel page.');
  });

  // OBS runs a browser of its own, so the dashboard's same-browser channel never reaches it — the
  // stored list is the only thing both of them can see.
  it('should read the stored wheel rather than wait to be told', async () => {
    api.stored = ['Ali', 'Beatriz', 'Ali'];

    const fixture = render();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.getWheel).toHaveBeenCalledWith(CHANNEL);
    expect(labels(fixture)).toEqual(['Ali', 'Beatriz', 'Ali']);
  });

  it('should keep going when a read fails', async () => {
    api.fail = true;

    const fixture = render();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element(fixture).querySelector('.overlay-hint')).toBeTruthy();
    expect(labels(fixture)).toEqual([]);
  });

  it('should say so when the link names no channel at all', () => {
    const fixture = render(null);

    expect(sync.channels).toEqual([]);
    expect(element(fixture).querySelector('.overlay-hint')!.textContent).toContain('no channel');
  });

  // The whole point of the channel: what the streamer sees and what the stream sees are one spin.
  // Math.random is pinned to the bottom of its range so a wheel drawing a slice for itself would
  // land on the first one — anything but what it was told, every run rather than most of them.
  it('should stop on the slice the dashboard says it stopped on', () => {
    const fixture = render();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    state(fixture, ['Ali', 'Beatriz', 'Charles']);
    sync.deliver({ type: 'spin', index: 2 });
    fixture.detectChanges();

    (element(fixture).querySelector('.wheel-disc') as HTMLElement)
      .dispatchEvent(new Event('transitionend'));
    fixture.detectChanges();

    expect(element(fixture).querySelector('.overlay-winner-name')!.textContent).toBe('Charles');
  });

  // There is nothing here to close it with, so the streamer closing the dialog on the dashboard is
  // what takes it off the stream.
  it('should take the winner down when the dashboard dismisses it', () => {
    const fixture = render();

    state(fixture, ['Ali', 'Beatriz']);
    sync.deliver({ type: 'spin', index: 0 });
    fixture.detectChanges();
    (element(fixture).querySelector('.wheel-disc') as HTMLElement)
      .dispatchEvent(new Event('transitionend'));
    fixture.detectChanges();

    expect(element(fixture).querySelector('.overlay-winner')).toBeTruthy();

    sync.deliver({ type: 'dismiss' });
    fixture.detectChanges();

    expect(element(fixture).querySelector('.overlay-winner')).toBeNull();
  });

  // Close and Remove belong on the dashboard: here they would be captured straight into the stream.
  it('should announce the winner without offering anything to press', () => {
    const fixture = render();

    state(fixture, ['Ali', 'Beatriz']);
    sync.deliver({ type: 'spin', index: 0 });
    fixture.detectChanges();
    (element(fixture).querySelector('.wheel-disc') as HTMLElement)
      .dispatchEvent(new Event('transitionend'));
    fixture.detectChanges();

    expect(element(fixture).querySelector('.overlay-winner')).toBeTruthy();
    expect(element(fixture).querySelectorAll('button')).toHaveLength(0);
  });

  // OBS captures the page as it is: a dashboard around the wheel would end up in the stream.
  it('should be nothing but the wheel', () => {
    const fixture = render();
    state(fixture, ['Ali', 'Beatriz']);

    expect(element(fixture).querySelector('app-navbar')).toBeNull();
    expect(element(fixture).querySelector('app-footer')).toBeNull();
    expect(element(fixture).querySelector('app-sidebar')).toBeNull();
  });

  // Nothing to press: this wheel follows the dashboard, and a spin started here would disagree with
  // what the streamer is looking at. The page is opened without a session at all, so it takes no
  // input whatsoever.
  it('should offer nothing to click', () => {
    const fixture = render();
    state(fixture, ['Ali', 'Beatriz']);

    expect(element(fixture).querySelectorAll('button')).toHaveLength(0);
  });

  it('should not spin when the wheel is clicked', () => {
    const fixture = render();
    state(fixture, ['Ali', 'Beatriz']);

    (element(fixture).querySelector('app-wheel') as HTMLElement).click();
    fixture.detectChanges();

    expect(element(fixture).querySelector('app-wheel')!.classList).not.toContain('wheel-interactive');
    expect(element(fixture).querySelector('.overlay-winner')).toBeNull();
  });

  it('should hang up when the source is closed', () => {
    const fixture = render();

    fixture.destroy();

    expect(sync.closed).toBeGreaterThan(0);
  });
});
