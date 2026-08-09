import { parseWheelResults, resultWonAt, WheelResult } from './wheel-result';

describe('parseWheelResults', () => {
  it('should read back what it was given', () => {
    const results: WheelResult[] = [{ label: 'Ali', wonAt: '2026-08-09T12:00:00.000Z' }];

    expect(parseWheelResults(JSON.stringify(results))).toEqual(results);
  });

  it('should treat a missing value as no results', () => {
    expect(parseWheelResults(null)).toEqual([]);
  });

  it('should treat text that is not JSON as no results', () => {
    expect(parseWheelResults('not json')).toEqual([]);
  });

  it('should treat JSON that is not an array as no results', () => {
    expect(parseWheelResults('{"label":"Ali"}')).toEqual([]);
  });

  // A stray write from something else that shares the origin, or storage left over from an earlier
  // shape of this feature, should not take the whole table down with it.
  it('should drop entries that are not a label and a parseable date', () => {
    const raw = JSON.stringify([
      { label: 'Ali', wonAt: '2026-08-09T12:00:00.000Z' },
      { label: 'Beatriz', wonAt: 'not a date' },
      { label: 42, wonAt: '2026-08-09T12:00:00.000Z' },
      { wonAt: '2026-08-09T12:00:00.000Z' },
      'Ali',
      null,
    ]);

    expect(parseWheelResults(raw)).toEqual([{ label: 'Ali', wonAt: '2026-08-09T12:00:00.000Z' }]);
  });
});

describe('resultWonAt', () => {
  it('should parse the stored timestamp back into a date', () => {
    const date = resultWonAt({ label: 'Ali', wonAt: '2026-08-09T12:00:00.000Z' });

    expect(date.toISOString()).toBe('2026-08-09T12:00:00.000Z');
  });
});
