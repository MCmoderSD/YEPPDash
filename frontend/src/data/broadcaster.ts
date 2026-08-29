import { TwitchUser } from './twitch-user';
import { UserRoles } from './user-roles';

export interface Broadcaster extends TwitchUser {
  color: string | null;
  roles: UserRoles;
}