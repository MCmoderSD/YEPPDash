import { environment } from '../environments/environment';

// Top level rather than under the dashboard: OBS loads this in a browser source of its own, with no
// session and nothing around it, so it must not sit behind the dashboard's auth guard.
export const WHEEL_OVERLAY_PATH = 'wheel/overlay';

export const WHEEL_OVERLAY_PARAM = 'channel';

export function isWheelOverlayUrl(url: string): boolean {
  const path: string = url.split(/[?#]/)[0].replace(/\/+$/, '');

  return path === `/${WHEEL_OVERLAY_PATH}`;
}

// Names the broadcaster rather than the entries, so the link is worth saving in OBS once: it keeps
// working as the list is edited, and a spin on the dashboard is a spin here.
export function wheelOverlayUrl(channelId: string): string {
  const query = new URLSearchParams({ [WHEEL_OVERLAY_PARAM]: channelId });

  return `${environment.frontendBaseUrl}/${WHEEL_OVERLAY_PATH}?${query}`;
}
