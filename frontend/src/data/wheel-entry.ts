export interface WheelEntry {
  label: string;
  count: number;
}

export const WHEEL_LABEL_MAX_LENGTH: number = 500;

const ENTRY_SPLIT: RegExp = /[\r\n,]+/;

export function splitLabels(text: string): string[] {
  return text.split(ENTRY_SPLIT)
    .map((piece: string): string => piece.trim().replace(/\s+/g, ' '))
    .filter((piece: string): boolean => piece.length > 0);
}

export function splitEntries(text: string): string[] {
  return splitLabels(text).map(cleanLabel);
}

export function entryProblem(text: string): string | null {
  if (!text.trim()) return null;

  const labels: string[] = splitLabels(text);

  if (labels.length === 0) return 'That is only separators — write a name to add.';

  const overlong: string | undefined = labels.find(
    (label: string): boolean => label.length > WHEEL_LABEL_MAX_LENGTH);

  return overlong === undefined
    ? null
    : `An entry cannot be longer than ${WHEEL_LABEL_MAX_LENGTH} characters — that one is ${overlong.length}.`;
}

export function labelProblem(label: string): string | null {
  return label.includes(',') ? 'An entry cannot contain a comma.' : null;
}

export const WHEEL_MAX_SLICES: number = 200;

export function cleanLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, WHEEL_LABEL_MAX_LENGTH);
}

export function sameLabel(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

export function entryText(entry: WheelEntry): string {
  return entry.count > 1 ? `${entry.count}x ${entry.label}` : entry.label;
}

export function sliceCount(entries: readonly WheelEntry[]): number {
  return entries.reduce((total: number, entry: WheelEntry): number => total + entry.count, 0);
}

export function findEntry(entries: readonly WheelEntry[], label: string): WheelEntry | undefined {
  return entries.find((entry: WheelEntry): boolean => sameLabel(entry.label, label));
}

export function addEntry(entries: readonly WheelEntry[], label: string, count = 1): WheelEntry[] {
  const clean: string = cleanLabel(label);
  if (!clean || count < 1) return [...entries];

  const existing: WheelEntry | undefined = findEntry(entries, clean);
  if (!existing) return [...entries, { label: clean, count }];

  return entries.map((entry: WheelEntry): WheelEntry => entry === existing ? { ...entry, count: entry.count + count } : entry);
}

export function renameEntry(entries: readonly WheelEntry[], from: string, to: string): WheelEntry[] {
  const clean: string = cleanLabel(to);
  if (!clean) return [...entries];

  const existing: WheelEntry | undefined = findEntry(entries, from);
  if (!existing) return [...entries];

  const collision: WheelEntry | undefined = sameLabel(existing.label, clean) ? undefined : findEntry(entries, clean);

  const renamed: WheelEntry[] = entries.map((entry: WheelEntry): WheelEntry => entry === existing
    ? { ...entry, label: clean, count: entry.count + (collision?.count ?? 0) }
    : entry);

  return collision === undefined ? renamed : renamed.filter((entry: WheelEntry): boolean => entry !== collision);
}

export function removeEntry(entries: readonly WheelEntry[], label: string): WheelEntry[] {
  return entries.filter((entry: WheelEntry): boolean => !sameLabel(entry.label, label));
}

export function removeOne(entries: readonly WheelEntry[], label: string): WheelEntry[] {
  const existing: WheelEntry | undefined = findEntry(entries, label);
  if (!existing) return [...entries];
  if (existing.count <= 1) return removeEntry(entries, label);

  return entries.map((entry: WheelEntry): WheelEntry => entry === existing ? { ...entry, count: entry.count - 1 } : entry);
}

export function sortEntries(entries: readonly WheelEntry[]): WheelEntry[] {
  return [...entries].sort((left: WheelEntry, right: WheelEntry): number => left.label.localeCompare(right.label, undefined, { sensitivity: 'base', numeric: true }));
}

export function shuffleEntries(entries: readonly WheelEntry[], random: () => number = Math.random): WheelEntry[] {
  const shuffled: WheelEntry[] = [...entries];

  for (let index: number = shuffled.length - 1; index > 0; index--) {
    const swap: number = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }

  return shuffled;
}

export function flattenEntries(entries: readonly WheelEntry[]): string[] {
  return entries.flatMap((entry: WheelEntry): string[] => Array.from({ length: entry.count }, (): string => entry.label));
}

export function entriesFrom(labels: readonly string[]): WheelEntry[] {
  return labels.reduce(
    (list: WheelEntry[], label: string): WheelEntry[] => addEntry(list, label),
    [],
  );
}

export function wheelSlices(entries: readonly WheelEntry[]): string[] {
  const most: number = entries.reduce((max: number, entry: WheelEntry): number => Math.max(max, entry.count), 0);

  const slices: string[] = [];

  for (let round = 0; round < most; round++) {
    for (const entry of entries) {
      if (entry.count > round) slices.push(entry.label);
    }
  }

  return slices;
}

// The flat list the server stores is what both the dashboard and the overlay are handed, and both
// want slices out of it rather than the table in between.
export function slicesFrom(labels: readonly string[]): string[] {
  return wheelSlices(entriesFrom(labels));
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

  for (const label of splitEntries(text)) {
    if (entries.length >= WHEEL_MAX_SLICES) {
      rejected.push(label);
      continue;
    }

    entries.push(label);
  }

  return { entries, rejected };
}