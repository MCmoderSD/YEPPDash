export enum BadgePreset {
  Prime = 'Prime',
  ChatBot = 'Chat Bot',
  Verified = 'Verified',
  Artist = 'Artist',
  Vip = 'VIP',
  Moderator = 'Moderator',
  LeadModerator = 'Lead Moderator',
  Broadcaster = 'Broadcaster'
}

export enum BadgeSize {
  Small = 18,
  Medium = 36,
  Large = 72
}

export const DEFAULT_BADGE_SIZE: BadgeSize = BadgeSize.Small;

export function badgeIconUrl(preset: BadgePreset, size: BadgeSize): string {
  return `/${preset.replaceAll(' ', '-')}-${size}px.png`;
}