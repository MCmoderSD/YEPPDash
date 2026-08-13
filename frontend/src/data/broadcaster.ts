import { TwitchUser } from './twitch-user';
import { UserRoles } from './user-roles';

// The signed-in user, and by construction the broadcaster of the channel being managed. Colour and
// roles are optional on TwitchUser because Helix answers Get Users without them; on this one the
// backend has always filled both in, so anywhere it stands in for a TwitchUser — a row in the
// community list, a birthday, a badge — it arrives complete rather than needing a second lookup.
export interface Broadcaster extends TwitchUser {
  color: string | null;
  roles: UserRoles;
}
