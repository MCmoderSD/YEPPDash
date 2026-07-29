import { ChannelUser } from './channel-user';

export interface BannedUser {
  id: string;
  login: string;
  displayName: string;
  // Null for a permanent ban — only a timeout ever runs out.
  expiresAt: string | null;
  createdAt: string;
  reason: string | null;
  moderator: ChannelUser;
}
