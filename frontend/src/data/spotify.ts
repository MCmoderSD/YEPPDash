export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: string;
  artistIds: readonly string[];
  durationMs: number;
  artworkUrl: string | null;
}

export interface SpotifyQueueEntry {
  track: SpotifyTrack;

  // Absent for anything the broadcaster queued in Spotify itself, which is normal rather than a gap.
  requestedBy: string | null;
}

export type SpotifyConnectionStatus = 'Connected' | 'Revoked' | 'Error';

export interface SpotifyStatus {
  // False on a deployment that never got Spotify credentials — nothing a broadcaster can fix.
  configured: boolean;
  connected: boolean;
  displayName: string | null;
  status: SpotifyConnectionStatus | null;
  connectedAt: string | null;
}

export interface SpotifyPlayback {
  connected: boolean;
  isPlaying: boolean;
  track: SpotifyTrack | null;
  progressMs: number;
  device: string | null;
}

export interface SpotifySettings {
  channelId: number;
  requestsEnabled: boolean;
  cooldownSeconds: number;
  maxDurationMs: number;
  requestsLiveOnly: boolean;
}

export type SpotifyBlocklistType = 'Track' | 'Artist';

export interface SpotifyBlocklistEntry {
  id: number;
  channelId: number;
  entryType: SpotifyBlocklistType;
  entryId: string;
  name: string;
  reason: string | null;
}

export interface SongRequest {
  id: number;
  channelId: number;
  trackId: string;
  trackName: string;
  artists: string;
  durationMs: number;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  source: 'Chat' | 'Dashboard';
}

/**
 * Why a request was refused, as a code rather than a sentence. The backend deliberately never sends
 * prose: chat answers in German and this page in English, and neither should be parsing the other's.
 */
export type SongRequestReason =
  | 'COOLDOWN'
  | 'TOO_LONG'
  | 'DUPLICATE'
  | 'BLOCKED'
  | 'NOT_FOUND'
  | 'NO_DEVICE'
  | 'NOT_CONNECTED'
  | 'PREMIUM_REQUIRED'
  | 'DISABLED'
  | 'NOT_A_TRACK'
  | 'NOT_LIVE'
  | 'RATE_LIMITED';

export interface SongRequestRejection {
  reason: SongRequestReason;
  retryAfterSeconds: number | null;
}

export const EMPTY_PLAYBACK: SpotifyPlayback = {
  connected: false,
  isPlaying: false,
  track: null,
  progressMs: 0,
  device: null,
};

export const UNKNOWN_STATUS: SpotifyStatus = {
  configured: true,
  connected: false,
  displayName: null,
  status: null,
  connectedAt: null,
};

export const DEFAULT_SETTINGS: SpotifySettings = {
  channelId: 0,
  requestsEnabled: true,
  cooldownSeconds: 60,
  maxDurationMs: 600_000,
  requestsLiveOnly: false,
};

/** The same ceilings the backend clamps to, so the form cannot offer a value it would reject. */
export const MAX_COOLDOWN_SECONDS: number = 3600;
export const MAX_DURATION_MINUTES: number = 60;

/**
 * What the overlay stream carries. Deliberately less than the dashboard's: that link is public, so
 * the device name and the requester names never reach it. Structurally a subset of SpotifyTrack
 * rather than an alias of it, so widening the payload has to be a deliberate edit here.
 */
export interface SpotifyOverlayTrack {
  id: string;
  name: string;
  artists: string;
  durationMs: number;
  artworkUrl: string | null;
}

export interface SpotifyOverlayPlayback {
  isPlaying: boolean;
  track: SpotifyOverlayTrack | null;
  progressMs: number;
}

export const EMPTY_OVERLAY_PLAYBACK: SpotifyOverlayPlayback = {
  isPlaying: false,
  track: null,
  progressMs: 0,
};

export type SpotifyOverlayMessage =
  | { type: 'playback'; isPlaying: boolean; track: SpotifyOverlayTrack | null; progressMs: number }
  | { type: 'disconnected' };

/**
 * Where playback has got to, counted on from the last measurement the server sent. Between pushes
 * the bar has to move by itself, or it would sit still for seconds at a time and then jump.
 *
 * Takes plain numbers rather than a playback object so the dashboard card and the overlay — which
 * receive deliberately different payloads — can share it without sharing a type.
 */
export function playbackProgress(
  isPlaying: boolean, progressMs: number, durationMs: number, measuredAt: number, now: number
): number {
  // Paused, or before the first browser render, there is nothing to extrapolate from.
  const drift: number = isPlaying && measuredAt > 0 ? now - measuredAt : 0;

  return Math.max(0, Math.min(durationMs, progressMs + drift));
}

export type SpotifyMessage =
  | { type: 'playback'; isPlaying: boolean; track: SpotifyTrack | null; progressMs: number; device: string | null; queue?: SpotifyQueueEntry[] }
  | { type: 'disconnected' };

export function trackDuration(ms: number): string {
  const total: number = Math.max(0, Math.round(ms / 1000));
  const minutes: number = Math.floor(total / 60);

  return `${minutes}:${(total % 60).toString().padStart(2, '0')}`;
}

/**
 * What to actually tell someone. Every one of these is a state they can do something about, so the
 * text says what to do rather than what went wrong.
 */
export function rejectionText(rejection: SongRequestRejection): string {
  switch (rejection.reason) {
    case 'COOLDOWN':
      return `That is one request per cooldown — ${rejection.retryAfterSeconds ?? 0}s to go.`;
    case 'TOO_LONG':
      return 'That track is longer than this channel allows.';
    case 'DUPLICATE':
      return 'That track is already playing or in the queue.';
    case 'BLOCKED':
      return 'That track is on the blocklist.';
    case 'NOT_FOUND':
      return 'Spotify has nothing matching that.';
    case 'NOT_A_TRACK':
      return 'That is a podcast episode, not a track.';
    case 'NO_DEVICE':
      return 'Spotify is not playing anywhere right now — start it on a device first.';
    case 'NOT_CONNECTED':
      return 'Spotify is not connected for this channel.';
    case 'PREMIUM_REQUIRED':
      return 'Spotify refused this — controlling playback needs a Premium account.';
    case 'DISABLED':
      return 'Song requests are switched off.';
    case 'NOT_LIVE':
      return 'Requests are set to work only while the stream is live.';
    case 'RATE_LIMITED':
      return 'Spotify is rate-limiting this channel — give it a moment.';
  }
}

/**
 * Pulls the machine-readable half out of a failed call. Anything that is not one of our own
 * rejections returns null, so the caller can tell "Spotify said no" from "the request never
 * arrived" and say something different about each.
 */
export function rejectionOf(error: unknown): SongRequestRejection | null {
  const body: unknown = (error as { error?: unknown } | null)?.error;

  if (typeof body !== 'object' || body === null) return null;

  const reason: unknown = (body as { reason?: unknown }).reason;
  if (typeof reason !== 'string') return null;

  const retryAfter: unknown = (body as { retryAfterSeconds?: unknown }).retryAfterSeconds;

  return {
    reason: reason as SongRequestReason,
    retryAfterSeconds: typeof retryAfter === 'number' ? retryAfter : null,
  };
}

/**
 * A starting point for OBS's "Custom CSS" box, carrying the overlay's own defaults so there is
 * something to edit rather than something to remember. It is also the way round anything the
 * dashboard does not offer a setting for — and it still applies when OBS is holding an older copy
 * of the page in its cache.
 */
export function spotifyOverlayCss(): string {
  return [
    'body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }',
    '',
    'app-spotify-overlay-page {',
    '  --spotify-color: #ffffff;',
    '  --spotify-muted: #b3b3b3;',
    '  --spotify-accent: #1db954;',
    '  --spotify-font-family: system-ui, sans-serif;',
    '',
    '  /* The whole card scales off this one value. */',
    '  --spotify-scale: 6vmin;',
    '',
    '  /* Set a background and it is worth padding the card; transparent, it is not. */',
    '  --spotify-background: transparent;',
    '  --spotify-card-padding: 0;',
    '',
    '  --spotify-radius: 1vmin;',
    '  --spotify-padding: 2vmin;',
    '  --spotify-shadow: 0 0.4vmin 0.8vmin rgb(0 0 0 / 80%);',
    '  --spotify-fade: 400ms;',
    '}',
  ].join('\n');
}
