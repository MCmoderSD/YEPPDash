import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { AuthService } from './auth.service';
import { Broadcaster, hasChannelPoints } from '../data/broadcaster';

export const channelPointsMatch: CanMatchFn = async (): Promise<boolean> => {
  const user: Broadcaster | null = await inject(AuthService).ensureLoaded();
  return hasChannelPoints(user);
};