import { TwitchUser } from './twitch-user';

export interface BannedUser extends TwitchUser {
  bannedAt: string;
  expiresAt: string | null; // null means permanent ban
  reason: string | null;
  moderator: TwitchUser | null;
}

export interface BanStatus {
  banned: boolean;
  ban: BannedUser | null;
}
