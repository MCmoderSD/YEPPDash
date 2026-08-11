import { Service } from '@angular/core';
import { BdsmResult } from '../data/bdsm-result';
import { ApiService } from './api.service';

@Service()
export class BdsmService extends ApiService {

  constructor() {
    super('bdsm');
  }

  // Every result the user has, newest first.
  getResults(userId: string): Promise<BdsmResult[]> {
    return this.get<BdsmResult[]>(encodeURIComponent(userId));
  }

  // The newest result of everyone in the list who has one; the rest are simply left out.
  getResultsFor(userIds: string[]): Promise<BdsmResult[]> {
    return this.post<BdsmResult[]>('', userIds);
  }
}