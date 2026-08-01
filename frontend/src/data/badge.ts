export enum BadgePreset {
  Prime = 'Prime',
  Verified = 'Verified',
  Artist = 'Artist',
  Vip = 'VIP',
  Moderator = 'Moderator',
  LeadModerator = 'Lead Moderator',
  Broadcaster = 'Broadcaster',
}

export const BADGE_PRESETS: readonly BadgePreset[] = [
  BadgePreset.Prime,
  BadgePreset.Verified,
  BadgePreset.Artist,
  BadgePreset.Vip,
  BadgePreset.Moderator,
  BadgePreset.LeadModerator,
  BadgePreset.Broadcaster,
];

export enum BadgeSize {
  Small = 18,
  Medium = 36,
  Large = 72,
}

export const BADGE_SIZES: readonly BadgeSize[] = [
  BadgeSize.Small,
  BadgeSize.Medium,
  BadgeSize.Large,
];

export const DEFAULT_BADGE_SIZE: BadgeSize = BadgeSize.Small;

export function badgeIconUrl(preset: BadgePreset, size: BadgeSize): string {
  return `/${preset.replaceAll(' ', '-')}-${size}px.png`;
}