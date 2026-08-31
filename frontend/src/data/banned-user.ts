import { TwitchUser } from './twitch-user';

export interface BannedUser extends TwitchUser {
  bannedAt: string;
  expiresAt: string | null; // null means permanent ban
  reason: string | null;
  moderator: TwitchUser | null;
}

export interface BanResult {
  userId: string;
  createdAt: string;
  endTime: string | null; // null means permanent ban
}

export interface BanCounts {
  timeouts: number;
  bans: number;
}