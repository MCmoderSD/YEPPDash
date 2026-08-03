import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { environment } from '../environments/environment';
import { WheelMessage, WheelSyncService } from './wheel-sync.service';

// Stands in for the browser's EventSource, so the tests can decide what the server says and when.
class FakeEventSource {
  static opened: FakeEventSource[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    FakeEventSource.opened.push(this);
  }

  connect(): void {
    this.onopen?.();
  }

  say(payload: unknown): void {
    this.onmessage?.(new MessageEvent<string>('message', { data: JSON.stringify(payload) }));
  }

  sayRaw(data: string): void {
    this.onmessage?.(new MessageEvent<string>('message', { data }));
  }

  close(): void {
    this.closed = true;
  }
}

describe('WheelSyncService', () => {
  let view: { EventSource: unknown };

  beforeEach(() => {
    FakeEventSource.opened = [];
    view = { EventSource: FakeEventSource };

    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: { defaultView: view } }],
    });
  });

  function listen(receive: (message: WheelMessage) => void = (): void => undefined, opened?: () => void) {
    return TestBed.inject(WheelSyncService).listen('164284617', receive, opened);
  }

  function source(): FakeEventSource {
    return FakeEventSource.opened[0];
  }

  // Server-sent events rather than anything same-browser: OBS runs a browser of its own, and that
  // is the whole reason this exists.
  it('should open the stream of the channel it was given', () => {
    listen();

    expect(source().url).toBe(`${environment.apiBaseUrl}/wheel/164284617/stream`);
  });

  it('should hand on what the server says', () => {
    const heard: WheelMessage[] = [];
    listen((message: WheelMessage): number => heard.push(message));

    source().say({ type: 'spin', index: 3 });
    source().say({ type: 'dismiss' });

    expect(heard).toEqual([{ type: 'spin', index: 3 }, { type: 'dismiss' }]);
  });

  // A build that does not know an event yet should keep showing the wheel, not fall over.
  it('should ignore a payload it cannot read', () => {
    const heard: WheelMessage[] = [];
    listen((message: WheelMessage): number => heard.push(message));

    expect((): void => source().sayRaw('not json')).not.toThrow();
    expect(heard).toEqual([]);
  });

  // EventSource reconnects by itself, and anything said while it was away was said to nobody — so
  // every connect, not just the first, is a reason to read the list again.
  it('should report every connect, including the reconnects', () => {
    let opens = 0;
    listen((): void => undefined, (): number => (opens += 1));

    source().connect();
    source().connect();

    expect(opens).toBe(2);
  });

  it('should close the stream when it is done with', () => {
    listen().close();

    expect(source().closed).toBe(true);
  });

  // Server rendering has no EventSource at all, and the overlay still has to render there.
  it('should do nothing where there is no EventSource', () => {
    view.EventSource = undefined;

    expect((): void => listen().close()).not.toThrow();
    expect(FakeEventSource.opened).toEqual([]);
  });
});
