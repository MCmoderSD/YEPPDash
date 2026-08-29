import { ImageLoaderConfig } from '@angular/common';

const SIZES: readonly number[] = [28, 50, 70, 96, 150, 300, 600];

const PROFILE_IMAGE: RegExp = /^(https:\/\/static-cdn\.jtvnw\.net\/jtv_user_pictures\/.+-profile_image-)\d+x\d+(\.[a-z]+)$/i;

export function twitchImageLoader(config: ImageLoaderConfig): string {
  const match: RegExpExecArray | null = PROFILE_IMAGE.exec(config.src);
  if (match === null || config.width === undefined) return config.src;

  const size: number = SIZES.find((candidate: number): boolean => candidate >= config.width!) ?? SIZES[SIZES.length - 1];

  return `${match[1]}${size}x${size}${match[2]}`;
}

export function fullSizeUrl(template: string): string {
  return template.replace(/-?\{width}x\{height}/, '');
}