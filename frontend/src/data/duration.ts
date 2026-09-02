export interface DurationUnit {
  label: string;
  seconds: number;
}

export const DURATION_UNITS: readonly DurationUnit[] = [
  { label: 'Seconds', seconds: 1 },
  { label: 'Minutes', seconds: 60 },
  { label: 'Hours', seconds: 3_600 },
  { label: 'Days', seconds: 86_400 },
];

export const COOLDOWN_MAX_SECONDS: number = 604_800;

export function bestUnit(seconds: number): DurationUnit {
  for (let index = DURATION_UNITS.length - 1; index > 0; index--) {
    if (seconds % DURATION_UNITS[index].seconds === 0 && seconds >= DURATION_UNITS[index].seconds) {
      return DURATION_UNITS[index];
    }
  }

  return DURATION_UNITS[0];
}