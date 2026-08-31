import { Service } from '@angular/core';
import { TimeoutRewardSettings, TimeoutRewardUpdate } from '../data/timeout-reward';
import { ApiService } from './api.service';

@Service()
export class TimeoutRewardService extends ApiService {

  constructor() {
    super('timeout-reward');
  }

  async getSettings(): Promise<TimeoutRewardSettings | null> {
    return (await this.get<TimeoutRewardSettings | null>('')) ?? null;
  }

  save(update: TimeoutRewardUpdate): Promise<TimeoutRewardSettings> {
    return this.put<TimeoutRewardSettings>('', update);
  }

  remove(): Promise<void> {
    return this.delete('');
  }
}