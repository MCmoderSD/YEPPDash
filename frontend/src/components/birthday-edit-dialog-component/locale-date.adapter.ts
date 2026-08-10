import { NativeDateAdapter } from '@angular/material/core';

type DateField = 'day' | 'month' | 'year';

function isDateField(type: string): type is DateField {
  return type === 'day' || type === 'month' || type === 'year';
}

function fieldOrder(locale: string | undefined): DateField[] {
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(new Date())
    .map((part) => part.type)
    .filter(isDateField);
}

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

    const parsed: Date = new Date();
    parsed.setFullYear(parts.year, parts.month - 1, parts.day);
    parsed.setHours(0, 0, 0, 0);

    const intact: boolean = parsed.getFullYear() === parts.year
      && parsed.getMonth() === parts.month - 1
      && parsed.getDate() === parts.day;

    return intact ? parsed : this.invalid();
  }
}