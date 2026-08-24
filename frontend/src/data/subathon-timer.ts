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
  fontSize: number;
  label: string;
  shadow: boolean;
  animate: boolean;
}

export interface SubathonTimer {
  running: boolean;
  endsAt: number | null;
  remaining: number;
  startSeconds: number;
  style: TimerStyle;
  offset: number;
}

export const DEFAULT_TIMER_STYLE: TimerStyle = {
  color: '#ffffff',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 18,
  label: '',
  shadow: true,
  animate: true,
};

export const TIMER_ANIMATION_MS: number = 260;

export const EMPTY_TIMER: SubathonTimer = {
  running: false,
  endsAt: null,
  remaining: 0,
  startSeconds: 0,
  style: DEFAULT_TIMER_STYLE,
  offset: 0,
};

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

export function remainingMs(timer: SubathonTimer, nowMs: number): number {
  if (!timer.running) return Math.max(0, timer.remaining * 1000);
  return Math.max(0, (timer.endsAt ?? nowMs) - (nowMs + timer.offset));
}

export function formatDuration(ms: number): string {
  const total: number = Math.ceil(ms / 1000);
  const pad: (value: number) => string = (value: number): string => value.toString().padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

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
      animate: typeof source.animate === 'boolean' ? source.animate : DEFAULT_TIMER_STYLE.animate,
    };
  } catch {
    return DEFAULT_TIMER_STYLE;
  }
}

export function timerStyleCss(style: TimerStyle): string {
  return [
    'body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }',
    '',
    'app-timer-overlay-page {',
    `  --timer-color: ${style.color} !important;`,
    `  --timer-font-family: ${style.fontFamily} !important;`,
    `  --timer-font-size: ${style.fontSize}vmin !important;`,
    `  --timer-shadow: ${style.shadow ? '0 0.4vmin 0.8vmin rgb(0 0 0 / 80%)' : 'none'} !important;`,
    `  --timer-animation-duration: ${style.animate ? TIMER_ANIMATION_MS : 0}ms !important;`,
    '}',
  ].join('\n');
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function size(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_TIMER_STYLE.fontSize;
}

export function parseDuration(input: string): number | null {
  const value: string = input.trim().toLowerCase();
  if (!value) return null;

  if (value.includes(':')) {
    const parts: string[] = value.split(':');
    if (parts.length > 3 || parts.some((part: string): boolean => !/^\d+$/.test(part))) return null;

    return parts.reduce((total: number, part: string): number => total * 60 + Number(part), 0);
  }

  if (/^\d+$/.test(value)) return Number(value);

  const parts: RegExpExecArray | null = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);

  if (parts === null || parts[0] === '') return null;

  return Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0);
}

export function durationText(seconds: number): string {
  return formatDuration(seconds * 1000);
}