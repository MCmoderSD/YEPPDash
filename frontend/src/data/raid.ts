import { TwitchUser } from './twitch-user';

export interface Raid {
  id: string;
  raider: TwitchUser;
  viewers: number;
  firedAt: string;
}