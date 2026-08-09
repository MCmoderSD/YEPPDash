// A record of one spin landing on a name, kept entirely on the browser this wheel is spun from —
// there is no server for this, so the timestamp is the only thing worth trusting it to remember.
export interface WheelResult {
  label: string;

  // ISO 8601, produced by Date#toISOString: a plain string survives JSON.stringify into
  // localStorage without a reviver, and the sort column below reads it back with `new Date(...)`.
  wonAt: string;
}

function isWheelResult(value: unknown): value is WheelResult {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Partial<WheelResult>;
  return typeof candidate.label === 'string'
    && typeof candidate.wonAt === 'string'
    && !Number.isNaN(new Date(candidate.wonAt).getTime());
}

// Storage written by an older version of this page, a browser extension poking at localStorage, or
// nothing at all — none of those should take the results table down, so a value that will not parse
// as a list of results is treated the same as an empty one.
export function parseWheelResults(raw: string | null): WheelResult[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isWheelResult) : [];
  } catch {
    return [];
  }
}

export function resultWonAt(result: WheelResult): Date {
  return new Date(result.wonAt);
}
