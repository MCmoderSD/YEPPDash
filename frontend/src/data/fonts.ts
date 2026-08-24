/**
 * Families offered as a starting point for the overlay. Not a whitelist - the field takes any CSS
 * font-family value, including a stack like the default one - just the ones worth suggesting.
 *
 * Deliberately weighted towards faces that suit a countdown read at a glance from a stream: wide
 * digits, heavy weights, clear zeros. Ordered so the safest bets come first rather than
 * alphabetically, because the list is read top to bottom before it is searched.
 */
export const FONT_FAMILIES: readonly string[] = [
  // Present on effectively every desktop.
  'Arial',
  'Arial Black',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Impact',

  // Windows.
  'Segoe UI',
  'Segoe UI Black',
  'Bahnschrift',
  'Calibri',
  'Cambria',
  'Candara',
  'Consolas',
  'Constantia',
  'Corbel',
  'Franklin Gothic Medium',
  'Lucida Console',
  'Lucida Sans Unicode',
  'Palatino Linotype',
  'Comic Sans MS',

  // macOS.
  'Helvetica',
  'Helvetica Neue',
  'Avenir',
  'Avenir Next',
  'Futura',
  'Optima',
  'Menlo',
  'Monaco',

  // Not shipped with any OS, but common enough on a streaming machine to be worth probing for.
  'Roboto',
  'Roboto Mono',
  'Open Sans',
  'Montserrat',
  'Oswald',
  'Bebas Neue',
  'Anton',
  'Rubik',
  'Inter',
  'Poppins',
];

// Mixed widths and a zero, so a family that only differs from the fallback in a few glyphs still
// moves the measurement.
const PROBE: string = 'mmmwwwiiil0O';

// Large enough that a difference of a fraction of a pixel per glyph adds up past rounding.
const PROBE_SIZE: string = '72px';

/**
 * Three fallbacks with genuinely different metrics. A family that is installed overrides all three
 * and measures the same every time; a missing one falls through to the fallback itself and measures
 * differently in each - so a single width matching its fallback is enough to rule it out, and one
 * that differs anywhere proves the family was actually used.
 */
const FALLBACKS: readonly string[] = ['monospace', 'sans-serif', 'serif'];

/**
 * Which of the suggested families this machine can actually render.
 *
 * Worth doing rather than offering the list blind, because the preview beside each entry is the
 * whole point: an uninstalled family would quietly draw in the fallback face, showing every missing
 * font as the same one and promising the streamer something OBS cannot deliver.
 *
 * Falls back to the full list wherever the measurement cannot run - on the server during rendering,
 * or without a 2D context - so the field is never left with nothing to suggest.
 */
export function installedFonts(document: Document, families: readonly string[] = FONT_FAMILIES): readonly string[] {
  const context: CanvasRenderingContext2D | null = document.createElement('canvas').getContext('2d');
  if (!context) return families;

  const baselines: Map<string, number> = new Map<string, number>();

  for (const fallback of FALLBACKS) {
    context.font = `${PROBE_SIZE} ${fallback}`;
    baselines.set(fallback, context.measureText(PROBE).width);
  }

  return families.filter((family: string): boolean => FALLBACKS.some((fallback: string): boolean => {
    context.font = `${PROBE_SIZE} "${family}", ${fallback}`;

    return context.measureText(PROBE).width !== baselines.get(fallback);
  }));
}
