import { ImageLoaderConfig } from '@angular/common';

// The sizes Twitch's CDN renders for a profile image. Probed against the CDN rather than assumed —
// every integer size from 1 to 4096 was requested, and this is exactly what came back as a real
// image rather than a 404, identical across two different avatars and the default picture. There
// is no documented list of these; asking for anything else answers 404 and the avatar goes missing.
const SIZES: readonly number[] = [28, 50, 70, 96, 150, 300, 600];

// Only the profile images, and only ones already carrying a size to swap. Anything else — a local
// asset, another host, a URL shaped differently than this — is handed back untouched.
const PROFILE_IMAGE =
  /^(https:\/\/static-cdn\.jtvnw\.net\/jtv_user_pictures\/.+-profile_image-)\d+x\d+(\.[a-z]+)$/i;

/**
 * Asks Twitch for an avatar at roughly the size it will be drawn at. Helix hands out the 300x300
 * variant for everyone, which is around 100 kB to fill a 32 px circle — the same picture at 50x50
 * is closer to 4 kB.
 */
export function twitchImageLoader(config: ImageLoaderConfig): string {
  const match: RegExpExecArray | null = PROFILE_IMAGE.exec(config.src);
  if (match === null || config.width === undefined) return config.src;

  // The first size that still covers the drawn width, so the picture is never scaled up. Angular
  // asks twice per image — once at the drawn width and once at double it, for the 2x descriptor.
  const size: number = SIZES.find((candidate: number): boolean => candidate >= config.width!)
    ?? SIZES[SIZES.length - 1];

  return `${match[1]}${size}x${size}${match[2]}`;
}
