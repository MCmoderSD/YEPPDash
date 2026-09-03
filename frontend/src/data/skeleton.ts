export function ghostRows(expected: number | null, cap = 25): readonly number[] {
  if (expected === null || expected <= 0) return [];
  return Array.from({ length: Math.min(expected, cap) }, (_: unknown, index: number): number => index);
}