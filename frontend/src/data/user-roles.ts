import { BadgePreset } from './badge';

export interface UserRoles {
  broadcaster: boolean;
  moderator: boolean;
  vip: boolean;
  editor: boolean;
  verified: boolean;
}

// Verified first, then what the account is in this channel, then the bot marker last.
//
// Editor is left out on purpose: there is no editor artwork, so it could only ever be a word among
// icons. The flag still arrives from the backend, so showing it again is a line in here.
//
// Being the bot is not a channel role and does not come from the enrichment, so it stands apart:
// the account is the bot whether or not anybody looked its roles up.
export function roleBadges(roles: UserRoles | null, isBot: boolean): BadgePreset[] {
  const shown: BadgePreset[] = [];

  if (roles?.verified) shown.push(BadgePreset.Verified);
  if (roles?.broadcaster) shown.push(BadgePreset.Broadcaster);
  if (roles?.moderator) shown.push(BadgePreset.Moderator);
  if (roles?.vip) shown.push(BadgePreset.Vip);
  if (isBot) shown.push(BadgePreset.ChatBot);

  return shown;
}
