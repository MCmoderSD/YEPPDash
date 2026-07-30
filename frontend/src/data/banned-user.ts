import { ChannelUser } from './channel-user';

export interface BannedUser {
  id: string;
  login: string;
  displayName: string;
  expiresAt: string | null; // null means permanent ban
  createdAt: string;
  reason: string | null;
  moderator: ChannelUser;
}

export interface BanStatus {
  banned: boolean;
  ban: BannedUser | null;
}