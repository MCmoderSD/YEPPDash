// One row of the entry table. The same name added twice is not a second row — it raises the count,
// and the row is then shown as "2x Name". The wheel still gets one slice per count.
export interface WheelEntry {
  label: string;
  count: number;
}

export const WHEEL_LABEL_MAX_LENGTH = 60;

// Entries are stored server side as one comma-joined column, so a comma inside one would come back
// as two entries. Refused rather than quietly stripped: the name that comes back has to be the name
// that went in.
export const WHEEL_SEPARATOR = ',';

export function hasSeparator(label: string): boolean {
  return label.includes(WHEEL_SEPARATOR);
}

// A wheel with more slices than this has nothing readable left on it, and the label text is already
// down to a sliver by then.
export const WHEEL_MAX_SLICES = 200;

export function cleanLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, WHEEL_LABEL_MAX_LENGTH);
}

// Case-insensitive on purpose: "ali" and "Ali" are the same person entering twice, not two entries.
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

// Keeps the first spelling that was entered rather than the latest one, so a name already sitting in
// the table does not change under the person looking at it.
export function addEntry(entries: readonly WheelEntry[], label: string, count = 1): WheelEntry[] {
  const clean: string = cleanLabel(label);
  if (!clean || count < 1) return [...entries];

  const existing: WheelEntry | undefined = findEntry(entries, clean);
  if (!existing) return [...entries, { label: clean, count }];

  return entries.map((entry: WheelEntry): WheelEntry =>
    entry === existing ? { ...entry, count: entry.count + count } : entry);
}

export function removeEntry(entries: readonly WheelEntry[], label: string): WheelEntry[] {
  return entries.filter((entry: WheelEntry): boolean => !sameLabel(entry.label, label));
}

// Dropping the last copy drops the row: a count of zero is not a thing the table can show.
export function removeOne(entries: readonly WheelEntry[], label: string): WheelEntry[] {
  const existing: WheelEntry | undefined = findEntry(entries, label);
  if (!existing) return [...entries];
  if (existing.count <= 1) return removeEntry(entries, label);

  return entries.map((entry: WheelEntry): WheelEntry =>
    entry === existing ? { ...entry, count: entry.count - 1 } : entry);
}

export function sortEntries(entries: readonly WheelEntry[]): WheelEntry[] {
  return [...entries].sort((left: WheelEntry, right: WheelEntry): number =>
    left.label.localeCompare(right.label, undefined, { sensitivity: 'base', numeric: true }));
}

export function shuffleEntries(
  entries: readonly WheelEntry[],
  random: () => number = Math.random,
): WheelEntry[] {
  const shuffled: WheelEntry[] = [...entries];

  for (let index: number = shuffled.length - 1; index > 0; index--) {
    const swap: number = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }

  return shuffled;
}

// The flat list that is stored and exported: table order, one element per copy, because neither a
// text column nor a text file has anywhere to put a count. Folding it back with entriesFrom returns
// exactly the table it came from.
export function flattenEntries(entries: readonly WheelEntry[]): string[] {
  return entries.flatMap((entry: WheelEntry): string[] =>
    Array.from({ length: entry.count }, (): string => entry.label));
}

export function entriesFrom(labels: readonly string[]): WheelEntry[] {
  return labels.reduce(
    (list: WheelEntry[], label: string): WheelEntry[] => addEntry(list, label),
    [],
  );
}

// The slices a wheel is built from, one per count. Handed out round by round rather than one entry
// at a time, so the two copies of a "2x" entry end up spread across the wheel with the rest of the
// list between them instead of sitting next to each other as one double-sized wedge.
export function wheelSlices(entries: readonly WheelEntry[]): string[] {
  const most: number = entries.reduce(
    (max: number, entry: WheelEntry): number => Math.max(max, entry.count), 0);

  const slices: string[] = [];

  for (let round = 0; round < most; round++) {
    for (const entry of entries) {
      if (entry.count > round) slices.push(entry.label);
    }
  }

  return slices;
}
