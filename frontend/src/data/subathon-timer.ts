// What the API sends. Times arrive as ISO strings and become epoch milliseconds here, because
// everything downstream only ever subtracts them.
export interface SubathonTimerResponse {
  running: boolean;
  endsAt: string | null;
  remaining: number;
  startSeconds: number;
  style: string;
  serverNow: string;
}

export interface TimerStyle {
  color: string;
  fontFamily: string;
  // In vmin, the same measure the overlay is sized by — see the overlay's stylesheet for why not rem.
  fontSize: number;
  label: string;
  shadow: boolean;
}

export interface SubathonTimer {
  running: boolean;

  // Epoch milliseconds on the *server's* clock, and only meaningful while running.
  endsAt: number | null;

  // Seconds, and only meaningful while paused.
  remaining: number;

  startSeconds: number;
  style: TimerStyle;

  // How far the server's clock was ahead of this machine's when this arrived, in milliseconds.
  //
  // Carried on the snapshot rather than kept in a service: it belongs to this reading and no other,
  // and a shared offset would quietly go stale the moment two pages disagreed about who sampled last.
  offset: number;
}

export const DEFAULT_TIMER_STYLE: TimerStyle = {
  color: '#ffffff',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 18,
  label: '',
  shadow: true,
};

export const EMPTY_TIMER: SubathonTimer = {
  running: false,
  endsAt: null,
  remaining: 0,
  startSeconds: 0,
  style: DEFAULT_TIMER_STYLE,
  offset: 0,
};

export const TIMER_MAX_SECONDS: number = 365 * 24 * 60 * 60;

/**
 * `sentAt` is the moment the request left, where there is one. Splitting the round trip in half
 * cancels a delay that is symmetric, which an HTTP call's roughly is. An event pushed over SSE has
 * no such pair, so its sample is one network hop pessimistic — tens of milliseconds, against a
 * readout that changes once a second.
 */
export function timerFrom(response: SubathonTimerResponse, sentAt?: number): SubathonTimer {
  const arrivedAt: number = Date.now();
  const serverNow: number = Date.parse(response.serverNow);
  const sampledAt: number = sentAt === undefined ? arrivedAt : (sentAt + arrivedAt) / 2;

  return {
    running: response.running,
    endsAt: response.endsAt === null ? null : Date.parse(response.endsAt),
    remaining: response.remaining,
    startSeconds: response.startSeconds,
    style: parseTimerStyle(response.style),
    offset: Number.isNaN(serverNow) ? 0 : serverNow - sampledAt,
  };
}

/**
 * How much is left, in milliseconds, at the given moment on *this* machine's clock — the offset is
 * applied here so no caller has to remember to.
 *
 * Clamped at zero. A deadline that has passed is a finished subathon, not negative time, and letting
 * it run below zero would mean the next minute added had to pay off the overrun before it showed.
 */
export function remainingMs(timer: SubathonTimer, nowMs: number): number {
  if (!timer.running) return Math.max(0, timer.remaining * 1000);

  return Math.max(0, (timer.endsAt ?? nowMs) - (nowMs + timer.offset));
}

/**
 * Rounded up, not down. With rounding down a timer reads 00:00 for a whole second before it is
 * actually over, which on an overlay looks like it has crashed.
 */
export function formatDuration(ms: number): string {
  const total: number = Math.ceil(ms / 1000);
  const pad = (value: number): string => value.toString().padStart(2, '0');

  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

// Tolerant on purpose: the column is free text as far as the database is concerned, and an overlay
// is the last place that should go blank over a field somebody hand-edited.
export function parseTimerStyle(raw: string): TimerStyle {
  if (!raw) return DEFAULT_TIMER_STYLE;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_TIMER_STYLE;

    const source = parsed as Partial<Record<keyof TimerStyle, unknown>>;

    return {
      color: text(source.color, DEFAULT_TIMER_STYLE.color),
      fontFamily: text(source.fontFamily, DEFAULT_TIMER_STYLE.fontFamily),
      fontSize: size(source.fontSize),
      label: text(source.label, DEFAULT_TIMER_STYLE.label),
      shadow: typeof source.shadow === 'boolean' ? source.shadow : DEFAULT_TIMER_STYLE.shadow,
    };
  } catch {
    return DEFAULT_TIMER_STYLE;
  }
}

/**
 * The same settings as a snippet for OBS' own "Custom CSS" box, starting from the rule OBS puts
 * there by default so pasting this replaces it wholesale rather than sitting awkwardly beside it.
 *
 * `!important` is what makes it worth pasting at all: the overlay applies the stored settings inline,
 * and only an important declaration outranks that. So the copy is a genuine override — useful when
 * OBS is holding an older build of the overlay in its cache, or for anything this page cannot offer.
 */
export function timerStyleCss(style: TimerStyle): string {
  return [
    'body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }',
    '',
    'app-timer-overlay-page {',
    `  --timer-color: ${style.color} !important;`,
    `  --timer-font-family: ${style.fontFamily} !important;`,
    `  --timer-font-size: ${style.fontSize}vmin !important;`,
    `  --timer-shadow: ${style.shadow ? '0 0.4vmin 0.8vmin rgb(0 0 0 / 80%)' : 'none'} !important;`,
    '}',
  ].join('\n');
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function size(value: unknown): number {
  // Bounded rather than trusted: a zero would make the timer invisible and a huge one would push the
  // digits off every edge of the source, and both look like the overlay is broken.
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(60, Math.max(2, value))
    : DEFAULT_TIMER_STYLE.fontSize;
}

/**
 * Reads the durations a person actually types: `300`, `90s`, `5m`, `1h30m`, `2h`, `01:30:00`, `5:00`.
 *
 * Returns null for anything it cannot make sense of, so a caller can say so rather than quietly
 * acting on a number nobody meant. Bare digits are seconds, which is what the chat commands take.
 */
export function parseDuration(input: string): number | null {
  const value: string = input.trim().toLowerCase();
  if (!value) return null;

  // hh:mm:ss and mm:ss, the shape a stopwatch is usually written in.
  if (value.includes(':')) {
    const parts: string[] = value.split(':');
    if (parts.length > 3 || parts.some((part: string): boolean => !/^\d+$/.test(part))) return null;

    return parts.reduce((total: number, part: string): number => total * 60 + Number(part), 0);
  }

  if (/^\d+$/.test(value)) return Number(value);

  // 1h30m and friends. Anchored at both ends, or "5 bananas" would read as five.
  const parts: RegExpExecArray | null = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);

  // Every group is optional, so the pattern also matches the empty string — which cannot get here,
  // but a bare "h" would match nothing at all and must not come back as zero either.
  if (parts === null || parts[0] === '') return null;

  return Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0);
}

/** The inverse, for putting a stored value back into a field somebody can edit. */
export function durationText(seconds: number): string {
  return formatDuration(seconds * 1000);
}
