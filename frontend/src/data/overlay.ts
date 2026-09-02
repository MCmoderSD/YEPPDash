import { environment } from '../environments/environment';

export const WHEEL_OVERLAY_PATH: string = 'wheel/overlay';
export const TIMER_OVERLAY_PATH: string = 'timer/overlay';
export const GIVEAWAY_OVERLAY_PATH: string = 'giveaway/overlay';

export const CHANNEL_PARAM: string = 'channel';
export const GIVEAWAY_PARAM: string = 'giveaway';

const OVERLAY_PATHS: readonly string[] = [WHEEL_OVERLAY_PATH, TIMER_OVERLAY_PATH, GIVEAWAY_OVERLAY_PATH];

export function isOverlayUrl(url: string): boolean {
  const path: string = url.split(/[?#]/)[0].replace(/\/+$/, '');

  return OVERLAY_PATHS.some((overlay: string): boolean => path === `/${overlay}`);
}

export function overlayUrl(path: string, param: string, value: string): string {
  const query = new URLSearchParams({ [param]: value });
  return `${environment.frontendBaseUrl}/${path}?${query}`;
}