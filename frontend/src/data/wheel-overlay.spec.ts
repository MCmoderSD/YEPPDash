import { environment } from '../environments/environment';
import { isWheelOverlayUrl, WHEEL_OVERLAY_PARAM, wheelOverlayUrl } from './wheel-overlay';

describe('isWheelOverlayUrl', () => {
  it('should recognise the overlay route', () => {
    expect(isWheelOverlayUrl('/wheel/overlay')).toBe(true);
  });

  it('should still recognise it with the channel hanging off it', () => {
    expect(isWheelOverlayUrl('/wheel/overlay?channel=164284617')).toBe(true);
  });

  // The dashboard page is where the wheel is set up, and that one keeps the navbar and footer.
  it('should not mistake the dashboard page for the overlay', () => {
    expect(isWheelOverlayUrl('/wheel')).toBe(false);
    expect(isWheelOverlayUrl('/dash/wheel')).toBe(false);
  });

  // What the dash host's rewrite used to make of the overlay before it was taught to skip it:
  // no route answers this, so the wildcard bounced it to '/' and the guard sent OBS to the
  // marketing site. The server checks the incoming URL, which is why this has to stay false.
  it('should not recognise the overlay once it has been rewritten under the dashboard', () => {
    expect(isWheelOverlayUrl('/dash/wheel/overlay?channel=164284617')).toBe(false);
  });
});

describe('wheelOverlayUrl', () => {
  it('should point at the overlay on the host the dashboard is served from', () => {
    expect(wheelOverlayUrl('164284617').startsWith(`${environment.frontendBaseUrl}/wheel/overlay?`))
      .toBe(true);
  });

  // Saved into OBS once and left there, so it may name the channel but never the entries.
  it('should name the channel and nothing else', () => {
    const url = new URL(wheelOverlayUrl('164284617'));

    expect([...url.searchParams]).toEqual([[WHEEL_OVERLAY_PARAM, '164284617']]);
  });
});
