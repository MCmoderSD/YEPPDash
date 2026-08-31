import { CustomReward } from './custom-reward';

export type ProtectedRole =
  | 'Follower'
  | 'Subscriber'
  | 'Tier2Subscriber'
  | 'Tier3Subscriber'
  | 'Vip'
  | 'Editor'
  | 'Moderator';

export interface TimeoutRewardSettings {
  reward: CustomReward;
  durationSeconds: number;
  protected: ProtectedRole[];
}

export interface TimeoutRewardUpdate {
  title: string;
  cost: number;
  prompt: string | null;
  backgroundColor: string | null;
  isEnabled: boolean;
  cooldownSeconds: number | null;
  maxPerStream: number | null;
  maxPerUserPerStream: number | null;
  durationSeconds: number;
  protected: ProtectedRole[];
}