import { NativeDateAdapter } from '@angular/material/core';

type DateField = 'day' | 'month' | 'year';

function isDateField(type: string): type is DateField {
  return type === 'day' || type === 'month' || type === 'year';
}

// Which of day, month and year comes first in this locale, read off Intl rather than assumed.
function fieldOrder(locale: string | undefined): DateField[] {
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(new Date())
    .map((part) => part.type)
    .filter(isDateField);
}

/**
 * Reads a typed date in the same order it is written back out.
 *
 * `NativeDateAdapter` formats through `Intl`, which follows the reader's own locale, but parses
 * through `Date.parse`, which only understands the American order. That split is what let the field
 * show 15.8.2004 and then refuse to take it back.
 */
export class LocaleDateAdapter extends NativeDateAdapter {

  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (typeof value !== 'string' || !value.trim()) return super.parse(value, parseFormat);

    const numbers: RegExpMatchArray | null = value.match(/\d+/g);
    if (numbers === null || numbers.length < 3) return super.parse(value, parseFormat);

    const order: DateField[] = fieldOrder(this.locale);
    const parts: Record<DateField, number> = { day: 0, month: 0, year: 0 };
    order.forEach((field: DateField, index: number): void => {
      parts[field] = Number(numbers[index]);
    });

    // setFullYear rather than the constructor: that reads a year under 100 as 19xx, which would
    // quietly turn a mistyped year into a date the field then accepts.
    const parsed: Date = new Date();
    parsed.setFullYear(parts.year, parts.month - 1, parts.day);
    parsed.setHours(0, 0, 0, 0);

    // A day past the end of its month rolls into the next one, so what came back has to be the same
    // date that went in. Anything else is invalid rather than silently moved.
    const intact: boolean = parsed.getFullYear() === parts.year
      && parsed.getMonth() === parts.month - 1
      && parsed.getDate() === parts.day;

    return intact ? parsed : this.invalid();
  }
}
