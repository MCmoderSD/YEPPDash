export const REWARD_TITLE_MAX: number = 45;
export const REWARD_PROMPT_MAX: number = 200;

export const DEFAULT_REWARD_COLOR: string = '#A8E02F';
export const DEFAULT_REWARD_IMAGE: string = 'https://static-cdn.jtvnw.net/custom-reward-images/default-2.png';

export interface RewardImage {
  url_1x: string;
  url_2x: string;
  url_4x: string;
}

export interface CustomReward {
  id: string;
  title: string;
  prompt: string;
  cost: number;
  image: RewardImage | null;
  defaultImage: RewardImage | null;
  backgroundColor: string;
  isEnabled: boolean;
  isPaused: boolean;
  isInStock: boolean;
  isUserInputRequired: boolean;
  maxPerStreamSetting: { isEnabled: boolean; maxPerStream: number };
  maxPerUserPerStreamSetting: { isEnabled: boolean; maxPerUserPerStream: number };
  globalCooldownSetting: { isEnabled: boolean; globalCooldownSeconds: number };
  isManageable: boolean;
}

export function rewardImage(reward: CustomReward | null): string {
  return reward?.image?.url_2x ?? reward?.defaultImage?.url_2x ?? DEFAULT_REWARD_IMAGE;
}

export function isHexColor(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

export function parseCost(value: string): number {
  const digits: string = value.replace(/[^0-9]/g, '');
  return digits.length === 0 ? 0 : Math.min(+digits, Number.MAX_SAFE_INTEGER);
}

export function costText(cost: number): string {
  return Number.isFinite(cost) && cost > 0 ? cost.toLocaleString('en-US') : '';
}