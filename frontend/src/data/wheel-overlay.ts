import { environment } from '../environments/environment';

export const WHEEL_OVERLAY_PATH: string = 'wheel/overlay';
export const WHEEL_OVERLAY_PARAM: string = 'channel';

export function isWheelOverlayUrl(url: string): boolean {
  const path: string = url.split(/[?#]/)[0].replace(/\/+$/, '');

  return path === `/${WHEEL_OVERLAY_PATH}`;
}

export function wheelOverlayUrl(channelId: string): string {
  const query = new URLSearchParams({ [WHEEL_OVERLAY_PARAM]: channelId });

  return `${environment.frontendBaseUrl}/${WHEEL_OVERLAY_PATH}?${query}`;
}