// Colour conversions for the picker, kept pure and free of Angular so they can be reasoned about
// (and one day tested) on their own.
//
// HSV rather than HSL, because HSV is the space every familiar picker drags in: the square is
// saturation across and brightness up, and the slider is hue. Hex is only the storage format.

export interface Hsv {
  // Degrees, 0-360.
  h: number;
  // 0-1.
  s: number;
  // 0-1.
  v: number;
}

export interface ColorPreset {
  label: string;
  value: string;
}

// Colours that read well over a stream scene, one click each. The square and slider stay available
// for anything not on this list — presets are the common case, not a cap.
//
// Fourteen on purpose: the picker lays them out seven to a row, so this count is exactly two full
// rows. Neutrals first, then the spectrum in hue order, so the grid reads like a palette rather
// than a grab bag.
export const COLOR_PRESETS: readonly ColorPreset[] = [
  { label: 'White', value: '#ffffff' },
  { label: 'Black', value: '#000000' },
  { label: 'Grey', value: '#9e9e9e' },
  { label: 'Red', value: '#e53935' },
  { label: 'Orange', value: '#fb8c00' },
  { label: 'Amber', value: '#f9a825' },
  { label: 'Yellow', value: '#fdd835' },
  { label: 'Lime', value: '#aeea00' },
  { label: 'Green', value: '#43a047' },
  { label: 'Teal', value: '#00acc1' },
  { label: 'Sky', value: '#4fc3f7' },
  { label: 'Blue', value: '#1e88e5' },
  { label: 'Twitch purple', value: '#9146ff' },
  { label: 'Pink', value: '#d81b60' },
];

export function hexToHsv(hex: string): Hsv | null {
  const match: RegExpExecArray | null = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (match === null) return null;

  const r: number = parseInt(match[1].slice(0, 2), 16) / 255;
  const g: number = parseInt(match[1].slice(2, 4), 16) / 255;
  const b: number = parseInt(match[1].slice(4, 6), 16) / 255;

  const max: number = Math.max(r, g, b);
  const min: number = Math.min(r, g, b);
  const delta: number = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;

  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

export function hsvToHex(hsv: Hsv): string {
  const h: number = clamp(hsv.h, 0, 360) % 360;
  const s: number = clamp(hsv.s, 0, 1);
  const v: number = clamp(hsv.v, 0, 1);

  const chroma: number = v * s;
  const x: number = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const base: number = v - chroma;

  const sector: number = Math.floor(h / 60);
  const [r, g, b]: [number, number, number] =
    sector === 0 ? [chroma, x, 0]
      : sector === 1 ? [x, chroma, 0]
      : sector === 2 ? [0, chroma, x]
      : sector === 3 ? [0, x, chroma]
      : sector === 4 ? [x, 0, chroma]
      : [chroma, 0, x];

  const channel = (value: number): string =>
    Math.round((value + base) * 255).toString(16).padStart(2, '0');

  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
