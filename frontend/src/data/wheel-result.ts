export interface WheelResult {
  label: string;
  wonAt: string;
}

function isWheelResult(value: unknown): value is WheelResult {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Partial<WheelResult>;
  return typeof candidate.label === 'string'
    && typeof candidate.wonAt === 'string'
    && !Number.isNaN(new Date(candidate.wonAt).getTime());
}

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