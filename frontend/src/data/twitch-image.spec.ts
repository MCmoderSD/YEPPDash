import { twitchImageLoader } from './twitch-image';

const AVATAR = 'https://static-cdn.jtvnw.net/jtv_user_pictures/c2c3a227-profile_image-300x300.png';

function load(src: string, width?: number): string {
  return twitchImageLoader({ src, width });
}

describe('twitchImageLoader', () => {

  it('should ask for the first size that still covers the drawn width', () => {
    expect(load(AVATAR, 32)).toContain('-profile_image-50x50.png');
  });

  it('should never scale a picture up', () => {
    // 64 is what Angular asks for to fill a 32px image on a 2x display.
    expect(load(AVATAR, 64)).toContain('-profile_image-70x70.png');
  });

  it('should cover the largest avatar the app draws', () => {
    expect(load(AVATAR, 128)).toContain('-profile_image-150x150.png');
  });

  it('should stop at the largest size Twitch renders', () => {
    expect(load(AVATAR, 4000)).toContain('-profile_image-300x300.png');
  });

  it('should keep the rest of the URL exactly as it was', () => {
    expect(load(AVATAR, 24))
      .toBe('https://static-cdn.jtvnw.net/jtv_user_pictures/c2c3a227-profile_image-28x28.png');
  });

  it('should keep the file extension it was given', () => {
    const jpeg = AVATAR.replace('.png', '.jpeg');

    expect(load(jpeg, 32)).toBe(jpeg.replace('300x300', '50x50'));
  });

  // Every ngSrc in the app goes through this, not just the avatars.
  it('should leave a local asset alone', () => {
    expect(load('Moderator-Icon.png', 32)).toBe('Moderator-Icon.png');
  });

  it('should leave another host alone', () => {
    const other = 'https://example.com/jtv_user_pictures/x-profile_image-300x300.png';

    expect(load(other, 32)).toBe(other);
  });

  it('should leave a Twitch URL that carries no size alone', () => {
    const sizeless = 'https://static-cdn.jtvnw.net/jtv_user_pictures/c2c3a227-profile_image.png';

    expect(load(sizeless, 32)).toBe(sizeless);
  });

  // Fill-mode images are laid out by CSS, so there is no width to pick a size from.
  it('should hand back the source untouched when no width is asked for', () => {
    expect(load(AVATAR)).toBe(AVATAR);
  });
});
