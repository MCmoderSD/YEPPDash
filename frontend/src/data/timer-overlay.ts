import { environment } from '../environments/environment';

export const TIMER_OVERLAY_PATH: string = 'timer/overlay';
export const TIMER_OVERLAY_PARAM: string = 'channel';

export function isTimerOverlayUrl(url: string): boolean {
  const path: string = url.split(/[?#]/)[0].replace(/\/+$/, '');

  return path === `/${TIMER_OVERLAY_PATH}`;
}

export function timerOverlayUrl(channelId: string): string {
  const query = new URLSearchParams({ [TIMER_OVERLAY_PARAM]: channelId });

  return `${environment.frontendBaseUrl}/${TIMER_OVERLAY_PATH}?${query}`;
}
