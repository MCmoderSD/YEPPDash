import { isTimerOverlayUrl } from './timer-overlay';
import { isWheelOverlayUrl } from './wheel-overlay';

export function isOverlayUrl(url: string): boolean {
  return isWheelOverlayUrl(url) || isTimerOverlayUrl(url);
}