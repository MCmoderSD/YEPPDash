import { BadgePreset } from './badge';

export interface UserRoles {
  broadcaster: boolean;
  moderator: boolean;
  vip: boolean;
  editor: boolean;
  verified: boolean;
}

export function roleBadges(roles: UserRoles | null, isBot: boolean): BadgePreset[] {
  const shown: BadgePreset[] = [];

  if (roles?.verified) shown.push(BadgePreset.Verified);
  if (roles?.broadcaster) shown.push(BadgePreset.Broadcaster);
  if (roles?.moderator) shown.push(BadgePreset.Moderator);
  if (roles?.vip) shown.push(BadgePreset.Vip);
  if (isBot) shown.push(BadgePreset.ChatBot);

  return shown;
}