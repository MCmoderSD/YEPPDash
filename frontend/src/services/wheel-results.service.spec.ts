import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { WheelResultsService } from './wheel-results.service';

const CHANNEL = '164284617';

// A plain object stands in for the browser's Storage rather than the real localStorage: whether that
// global is even reachable depends on the test runner's own environment, which is not what these
// tests are about. Mirrors how WheelSyncService's spec stands in for EventSource the same way.
class FakeStorage {
  private readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

describe('WheelResultsService', () => {
  let storage: FakeStorage;

  beforeEach(() => {
    storage = new FakeStorage();

    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: { defaultView: { localStorage: storage } } }],
    });
  });

  function service(): WheelResultsService {
    return TestBed.inject(WheelResultsService);
  }

  it('should start out with no results for a channel that has never recorded one', () => {
    expect(service().list(CHANNEL)).toEqual([]);
  });

  it('should hand back what it just recorded', () => {
    const results = service().record(CHANNEL, 'Ali');

    expect(results).toEqual([{ label: 'Ali', wonAt: expect.any(String) }]);
    expect(service().list(CHANNEL)).toEqual(results);
  });

  it('should append rather than replace on a second win', () => {
    service().record(CHANNEL, 'Ali');
    const results = service().record(CHANNEL, 'Beatriz');

    expect(results.map((result) => result.label)).toEqual(['Ali', 'Beatriz']);
  });

  it('should keep a repeated name as two separate wins rather than merging them', () => {
    service().record(CHANNEL, 'Ali');
    const results = service().record(CHANNEL, 'Ali');

    expect(results).toHaveLength(2);
  });

  it('should keep the results of one channel out of another', () => {
    service().record(CHANNEL, 'Ali');
    service().record('other-channel', 'Beatriz');

    expect(service().list(CHANNEL).map((result) => result.label)).toEqual(['Ali']);
    expect(service().list('other-channel').map((result) => result.label)).toEqual(['Beatriz']);
  });

  it('should empty the list and hand back the empty result', () => {
    service().record(CHANNEL, 'Ali');

    expect(service().clear(CHANNEL)).toEqual([]);
    expect(service().list(CHANNEL)).toEqual([]);
  });

  it('should survive storage that holds something other than a result list', () => {
    storage.setItem('yeppdash.wheel-results.164284617', 'not json');

    expect(service().list(CHANNEL)).toEqual([]);
  });

  // Prerendering runs this service against a document with no window at all, and a browser can
  // refuse storage outright — neither should throw partway through the page.
  describe('without a window', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [{ provide: DOCUMENT, useValue: { defaultView: undefined } }],
      });
    });

    it('should read as having no results', () => {
      expect(service().list(CHANNEL)).toEqual([]);
    });

    it('should still hand back the recorded result even though nothing was written', () => {
      expect(service().record(CHANNEL, 'Ali')).toEqual([{ label: 'Ali', wonAt: expect.any(String) }]);
    });

    it('should not throw when asked to clear', () => {
      expect(() => service().clear(CHANNEL)).not.toThrow();
    });
  });

  it('should not throw when storage refuses the write', () => {
    const refusing = {
      getItem: (): null => null,
      setItem: (): void => { throw new Error('quota'); },
      removeItem: (): void => undefined,
    };

    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: { defaultView: { localStorage: refusing } } }],
    });

    expect(() => service().record(CHANNEL, 'Ali')).not.toThrow();
  });
});
