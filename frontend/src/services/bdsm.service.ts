import { Service } from '@angular/core';
import { BdsmResult } from '../data/bdsm-result';
import { ApiService } from './api.service';

@Service()
export class BdsmService extends ApiService {

  constructor() {
    super('bdsm');
  }

  /**
   * Every test the given user has taken, newest first.
   *
   * A list rather than a single result: somebody who took the test more than once keeps the older
   * ones, and an empty list is the ordinary answer for somebody who never took it. Only the signed-in
   * user's own results can be read — the backend refuses any other id.
   */
  getResults(userId: string): Promise<BdsmResult[]> {
    return this.get<BdsmResult[]>(encodeURIComponent(userId));
  }

  /** The most recent test of everyone following the channel, plus the channel owner's own. */
  getFollowerResults(userId: string): Promise<BdsmResult[]> {
    return this.get<BdsmResult[]>(`followers/${encodeURIComponent(userId)}`);
  }
}
