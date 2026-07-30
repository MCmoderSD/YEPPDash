import { LocaleDatePipe } from './locale-date.pipe';

describe('LocaleDatePipe', () => {
  const pipe = new LocaleDatePipe();

  function expected(date: Date, dateStyle: 'long' | 'short' | 'medium' = 'long'): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle }).format(date);
  }

  it('should format a date the way the platform writes dates', () => {
    const date = new Date(2000, 4, 17);

    expect(pipe.transform(date)).toBe(expected(date));
  });

  // The whole point: no locale is handed to Intl, so the platform's own decides the order. Asserted
  // against whichever locale the platform actually resolves to rather than a guessed shortlist —
  // this environment resolves to en-GB, another machine would not.
  it('should follow the locale the platform resolves to', () => {
    const date = new Date(2000, 4, 17);
    const platform: string = new Intl.DateTimeFormat().resolvedOptions().locale;

    expect(pipe.transform(date))
      .toBe(new Intl.DateTimeFormat(platform, { dateStyle: 'long' }).format(date));
  });

  it('should take the style it is given', () => {
    const date = new Date(2000, 4, 17);

    expect(pipe.transform(date, 'short')).toBe(expected(date, 'short'));
  });

  it('should accept the string a server sent', () => {
    expect(pipe.transform('2000-05-17T00:00:00Z')).toBe(expected(new Date('2000-05-17T00:00:00Z')));
  });

  it('should render nothing rather than a placeholder for a missing date', () => {
    expect([pipe.transform(null), pipe.transform(undefined)]).toEqual(['', '']);
  });

  // Intl throws a RangeError on an invalid date, which would take the whole render down with it.
  it('should render nothing for a date it cannot read', () => {
    expect(pipe.transform('not a date')).toBe('');
    expect(pipe.transform(new Date(Number.NaN))).toBe('');
  });
});
