import { TwitchUser } from './twitch-user';

export interface Follower {
  id: string;
  login: string;
  displayName: string;
  followedAt: string;
}

export interface FollowStatus {
  following: boolean;
  follow: Follower | null;
}

// What the follower list answers with. The single-follow check above stays lightweight: it only
// has to say whether and since when, which needs no profile behind it.
export interface FollowerProfile extends TwitchUser {
  followedAt: string;
}