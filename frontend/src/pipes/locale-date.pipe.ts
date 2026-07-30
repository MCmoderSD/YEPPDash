import { Pipe, PipeTransform } from '@angular/core';

export type DateStyle = 'full' | 'long' | 'medium' | 'short';

// Building an Intl.DateTimeFormat is not cheap and a table would otherwise build one per cell, so the
// handful of styles actually in use are kept around.
const formatters: Map<string, Intl.DateTimeFormat> = new Map<string, Intl.DateTimeFormat>();

function formatterFor(dateStyle: DateStyle, timeStyle: DateStyle | undefined): Intl.DateTimeFormat {
  const key = `${dateStyle}|${timeStyle ?? ''}`;
  const cached: Intl.DateTimeFormat | undefined = formatters.get(key);
  if (cached) return cached;

  // No locale argument on purpose: that is what makes Intl fall back to the platform's own, so the
  // reader's browser decides between 30.07.1998, 1998/07/30 and July 30, 1998.
  const formatter: Intl.DateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle, timeStyle });
  formatters.set(key, formatter);

  return formatter;
}

/**
 * Formats a date the way the reader's own browser writes dates, rather than in the one locale the
 * application happens to be built with.
 *
 * Angular's `DatePipe` renders against `LOCALE_ID`, which is fixed at build time and defaults to
 * en-US — that is what pinned every date here to the American order. This asks the platform instead.
 *
 * Only for dates a person reads. A machine-readable one, such as the `datetime` attribute of
 * `<time>`, has to stay ISO 8601 and belongs to `DatePipe` with an explicit format.
 */
@Pipe({ name: 'localeDate' })
export class LocaleDatePipe implements PipeTransform {

  transform(
    value: Date | string | number | null | undefined,
    dateStyle: DateStyle = 'long',
    timeStyle?: DateStyle,
  ): string {
    if (value === null || value === undefined) return '';

    const date: Date = value instanceof Date ? value : new Date(value);

    // An unparseable string would otherwise reach Intl and throw a RangeError mid-render.
    if (Number.isNaN(date.getTime())) return '';

    return formatterFor(dateStyle, timeStyle).format(date);
  }
}
