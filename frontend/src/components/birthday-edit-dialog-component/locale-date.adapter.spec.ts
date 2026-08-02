import { TestBed } from '@angular/core/testing';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { LocaleDateAdapter } from './locale-date.adapter';

function adapterFor(locale: string | undefined): LocaleDateAdapter {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: MAT_DATE_LOCALE, useValue: locale }, LocaleDateAdapter],
  });

  return TestBed.inject(LocaleDateAdapter);
}

function ymd(date: Date | null): [number, number, number] | null {
  return date && !isNaN(date.getTime())
    ? [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    : null;
}

describe('LocaleDateAdapter', () => {

  // The whole point: the same birthday, written the way each reader writes it.
  it('should read a date in the order its own locale writes one', () => {
    expect(ymd(adapterFor('de-DE').parse('15.8.2004'))).toEqual([2004, 8, 15]);
    expect(ymd(adapterFor('en-US').parse('8/15/2004'))).toEqual([2004, 8, 15]);
    expect(ymd(adapterFor('en-GB').parse('15/08/2004'))).toEqual([2004, 8, 15]);
  });

  // Date.parse reads this as the fifteenth of August whatever the reader meant, which is how a
  // German date used to come back as the wrong day rather than as a mistake.
  it('should not fall back to the American order for a locale that does not use it', () => {
    expect(ymd(adapterFor('de-DE').parse('8/15/2004'))).toBeNull();
  });

  it('should write a date back the way it read it', () => {
    const adapter = adapterFor('de-DE');
    const parsed = adapter.parse('15.8.2004')!;

    expect(adapter.format(parsed, { year: 'numeric', month: 'numeric', day: 'numeric' }))
      .toBe(new Intl.DateTimeFormat('de-DE', { year: 'numeric', month: 'numeric', day: 'numeric' })
        .format(new Date(2004, 7, 15)));
  });

  // A year under 100 would otherwise be read as 19xx, quietly accepting a mistyped year.
  it('should keep a short year as the year it was given', () => {
    expect(ymd(adapterFor('de-DE').parse('15.8.04'))).toEqual([4, 8, 15]);
  });

  // Rolling into September would hand back a date nobody typed.
  it('should refuse a day that does not exist in its month', () => {
    expect(ymd(adapterFor('de-DE').parse('31.2.2004'))).toBeNull();
  });

  it('should leave anything it cannot read to the native adapter', () => {
    expect(adapterFor('de-DE').parse('')).toBeNull();
    expect(ymd(adapterFor('de-DE').parse('not a date'))).toBeNull();
  });

  it('should still take a timestamp', () => {
    const stamp = new Date(2004, 7, 15).getTime();

    expect(ymd(adapterFor('de-DE').parse(stamp))).toEqual([2004, 8, 15]);
  });

  // No locale at all is what the dialog provides, so Intl falls back to the platform's own.
  it('should follow the platform when given no locale', () => {
    const adapter = adapterFor(undefined);
    const shown = adapter.format(new Date(2004, 7, 15), { year: 'numeric', month: 'numeric', day: 'numeric' });

    expect(shown).toBe(new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' })
      .format(new Date(2004, 7, 15)));
  });
});
