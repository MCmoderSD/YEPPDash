import { cleanLabel, hasSeparator, WHEEL_MAX_SLICES, WHEEL_SEPARATOR } from './wheel-entry';

export enum WheelType {
  Wheel = 'Wheel',
  Giveaway = 'Giveaway',
}

export interface StoredWheel {
  entries: string[];
  type: WheelType;
}

export const WHEEL_FILE_NAME = 'lucky-wheel.txt';

export interface WheelFile {
  entries: string[];
  rejected: string[];
}

export function wheelFileContent(entries: readonly string[]): string {
  return entries.join('\n');
}

export function parseWheelFile(text: string): WheelFile {
  const entries: string[] = [];
  const rejected: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    const label: string = cleanLabel(line);

    if (!label) continue;

    if (hasSeparator(label) || entries.length >= WHEEL_MAX_SLICES) {
      rejected.push(line.trim());
      continue;
    }

    entries.push(label);
  }

  return { entries, rejected };
}

export function separatorMessage(): string {
  return `An entry cannot contain a "${WHEEL_SEPARATOR}".`;
}