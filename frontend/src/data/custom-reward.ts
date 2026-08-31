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