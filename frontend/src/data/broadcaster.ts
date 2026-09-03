import { TwitchUser } from './twitch-user';
import { UserRoles } from './user-roles';

export interface Broadcaster extends TwitchUser {
  color: string | null;
  roles: UserRoles;
}

const CHANNEL_POINT_TYPES: ReadonlySet<string> = new Set(['affiliate', 'partner']);

export function hasChannelPoints(user: TwitchUser | null): boolean {
  return user !== null && CHANNEL_POINT_TYPES.has(user.broadcasterType.toLowerCase());
}