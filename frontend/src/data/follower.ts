import { TwitchUser } from './twitch-user';

export interface FollowerProfile extends TwitchUser {
  followedAt: string;
}

export interface FollowStatus {
  following: boolean;
  follow: FollowerProfile | null;
}
