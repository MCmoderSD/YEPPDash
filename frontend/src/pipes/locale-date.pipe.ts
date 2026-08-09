import { Pipe, PipeTransform } from '@angular/core';

export type DateStyle = 'full' | 'long' | 'medium' | 'short';

const formatters: Map<string, Intl.DateTimeFormat> = new Map<string, Intl.DateTimeFormat>();

function formatterFor(dateStyle: DateStyle, timeStyle: DateStyle | undefined): Intl.DateTimeFormat {
  const key = `${dateStyle}|${timeStyle ?? ''}`;
  const cached: Intl.DateTimeFormat | undefined = formatters.get(key);
  if (cached) return cached;

  const formatter: Intl.DateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle, timeStyle });
  formatters.set(key, formatter);

  return formatter;
}

@Pipe({ name: 'localeDate' })
export class LocaleDatePipe implements PipeTransform {

  transform(
    value: Date | string | number | null | undefined,
    dateStyle: DateStyle = 'long',
    timeStyle?: DateStyle,
  ): string {
    if (value === null || value === undefined) return '';

    const date: Date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    return formatterFor(dateStyle, timeStyle).format(date);
  }
}