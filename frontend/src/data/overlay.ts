import { environment } from '../environments/environment';

export const WHEEL_OVERLAY_PATH: string = 'wheel/overlay';
export const TIMER_OVERLAY_PATH: string = 'timer/overlay';
export const SPOTIFY_OVERLAY_PATH: string = 'spotify/overlay';
export const OVERLAY_PARAM: string = 'channel';

const OVERLAY_PATHS: readonly string[] = [WHEEL_OVERLAY_PATH, TIMER_OVERLAY_PATH, SPOTIFY_OVERLAY_PATH];

export function isOverlayUrl(url: string): boolean {
  const path: string = url.split(/[?#]/)[0].replace(/\/+$/, '');

  return OVERLAY_PATHS.some((overlay: string): boolean => path === `/${overlay}`);
}

export function overlayUrl(path: string, channelId: string): string {
  const query = new URLSearchParams({ [OVERLAY_PARAM]: channelId });
  return `${environment.frontendBaseUrl}/${path}?${query}`;
}