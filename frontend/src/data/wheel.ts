import { WheelEntry } from './wheel-entry';

export interface WheelSummary {
  id: string;
  name: string;
  entryCount: number;
  sliceCount: number;
  updatedAt: string;
}

export interface Wheel {
  id: string;
  name: string;
  entries: WheelEntry[];
  updatedAt: string;
}

export interface WheelOverlayState {
  wheelId: string;
  name: string;
  entries: WheelEntry[];
}

export interface WheelUpdate {
  name: string;
  entries: readonly WheelEntry[];
}

export const WHEEL_NAME_MAX_LENGTH: number = 80;