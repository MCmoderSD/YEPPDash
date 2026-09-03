import { CustomReward } from './custom-reward';
import { TwitchUser } from './twitch-user';

export type GiveawayStatus = 'Draft' | 'Open' | 'Closed';

export type RequirementState = 'Ignored' | 'Required' | 'Excluded';

export type SubTier = 'None' | 'Tier1' | 'Tier2' | 'Tier3';

export type GiveawayRole = 'follower' | 'subscriber' | 'tier2' | 'tier3' | 'vip' | 'moderator';

export type GiveawayRequirements = Record<GiveawayRole, RequirementState>;

export type GiveawayMultipliers = Record<GiveawayRole, number> & { base: number };

export interface GiveawaySummary {
  id: string;
  title: string;
  description: string;
  status: GiveawayStatus;
  cost: number;
  updatedAt: string;
  participantCount: number;
  winnerCount: number;
  rewardMissing: boolean;
  reward: CustomReward | null;
}

export const NEW_GIVEAWAY: string = 'new';

export interface GiveawayParticipant {
  userId: string;
  userName: string;
  redemptionId: string;
  isFollower: boolean;
  subTier: SubTier;
  isVip: boolean;
  isModerator: boolean;
  multiplier: number;
  enteredAt: string;
  user: TwitchUser | null;
}

export interface GiveawayWinner {
  drawOrder: number;
  userId: string;
  userName: string;
  multiplier: number;
  wonAt: string;
  user: TwitchUser | null;
}

export interface GiveawaySettings {
  id: string;
  status: GiveawayStatus;
  updatedAt: string;
  reward: CustomReward | null;
  rewardMissing: boolean;
  title: string;
  description: string;
  cost: number;
  cooldownSeconds: number | null;
  maxPerStream: number | null;
  maxPerUserPerStream: number | null;
  requirements: GiveawayRequirements;
  multipliers: GiveawayMultipliers;
  participants: GiveawayParticipant[];
  winners: GiveawayWinner[];
}

export interface GiveawayUpdate {
  title: string;
  cost: number;
  description: string | null;
  backgroundColor: string | null;
  cooldownSeconds: number | null;
  maxPerStream: number | null;
  maxPerUserPerStream: number | null;
  requirements: GiveawayRequirements;
  multipliers: GiveawayMultipliers;
}

export interface GiveawayOverlaySlice {
  label: string;
  weight: number;
}

export interface GiveawayOverlayState {
  giveawayId: string;
  title: string;
  slices: GiveawayOverlaySlice[];
}

export interface GiveawayDrawResult {
  index: number;
  winner: GiveawayWinner;
  slices: GiveawayOverlaySlice[];
}

export const MULTIPLIER_MIN: number = 0;
export const MULTIPLIER_MAX: number = 1_000_000_000;
export const MULTIPLIER_STEP: number = 0.1;

export const GIVEAWAY_ROLES: readonly GiveawayRole[] = ['follower', 'subscriber', 'tier2', 'tier3', 'vip', 'moderator'];

export const ROLE_LABELS: Readonly<Record<GiveawayRole, string>> = {
  follower: 'Follower',
  subscriber: 'Subscriber',
  tier2: 'Tier 2 subscriber',
  tier3: 'Tier 3 subscriber',
  vip: 'VIP',
  moderator: 'Moderator',
};

export const ROLE_HINTS: Readonly<Record<GiveawayRole, string>> = {
  follower: 'Anybody following the channel.',
  subscriber: 'Any subscription, whatever the tier.',
  tier2: 'A Tier 2 subscription or higher.',
  tier3: 'A Tier 3 subscription.',
  vip: 'Anybody holding VIP.',
  moderator: 'Anybody moderating the channel.',
};

export const REQUIREMENT_STATES: readonly RequirementState[] = ['Ignored', 'Required', 'Excluded'];

export const REQUIREMENT_LABELS: Readonly<Record<RequirementState, string>> = {
  Ignored: 'Ignored',
  Required: 'Required',
  Excluded: 'Excluded',
};

export const TIER_LABELS: Readonly<Record<SubTier, string>> = {
  None: 'No subscription',
  Tier1: 'Tier 1',
  Tier2: 'Tier 2',
  Tier3: 'Tier 3',
};

export const STATUS_LABELS: Readonly<Record<GiveawayStatus, string>> = {
  Draft: 'Draft',
  Open: 'Open',
  Closed: 'Closed',
};

export const IGNORED_REQUIREMENTS: GiveawayRequirements = {
  follower: 'Ignored',
  subscriber: 'Ignored',
  tier2: 'Ignored',
  tier3: 'Ignored',
  vip: 'Ignored',
  moderator: 'Ignored',
};

export const DEFAULT_MULTIPLIERS: GiveawayMultipliers = {
  base: 1,
  follower: 1,
  subscriber: 1,
  tier2: 1,
  tier3: 1,
  vip: 1,
  moderator: 1,
};

export function baseInvalid(multipliers: GiveawayMultipliers): boolean {
  const value: number = multipliers.base;
  return !Number.isFinite(value) || value <= 0 || value > MULTIPLIER_MAX;
}

export function multipliersInvalid(multipliers: GiveawayMultipliers): boolean {
  return baseInvalid(multipliers) || GIVEAWAY_ROLES.some((role: GiveawayRole): boolean => {
    const value: number = multipliers[role];
    return !Number.isFinite(value) || value < MULTIPLIER_MIN || value > MULTIPLIER_MAX;
  });
}

export function participantLabel(participant: GiveawayParticipant): string {
  return participant.user?.displayName ?? participant.userName;
}

export function winnerLabel(winner: GiveawayWinner): string {
  return winner.user?.displayName ?? winner.userName;
}

export function tierLabel(subTier: SubTier): string | null {
  return subTier === 'None' ? null : TIER_LABELS[subTier];
}