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