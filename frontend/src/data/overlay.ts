import { isTimerOverlayUrl } from './timer-overlay';
import { isWheelOverlayUrl } from './wheel-overlay';

// Which routes are OBS browser sources rather than pages of the site. They are the same app on the
// same host, but nothing the site wraps its pages in belongs on one — no navbar, no footer, no
// notifications, nothing that could add height to a source that must never scroll.
//
// Collected here so the shell asks one question instead of growing another clause per overlay.
export function isOverlayUrl(url: string): boolean {
  return isWheelOverlayUrl(url) || isTimerOverlayUrl(url);
}
