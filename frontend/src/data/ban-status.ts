import { BannedUser } from './banned-user';

export interface BanStatus {
  banned: boolean;
  ban: BannedUser | null;
}
