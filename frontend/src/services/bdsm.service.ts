import { Service } from '@angular/core';
import { BdsmMatchScore, BdsmResult } from '../data/bdsm-result';
import { ApiService } from './api.service';

@Service()
export class BdsmService extends ApiService {

  constructor() {
    super('bdsm');
  }

  getResults(userId: string): Promise<BdsmResult[]> {
    return this.get<BdsmResult[]>(encodeURIComponent(userId));
  }

  getResultsFor(userIds: string[]): Promise<BdsmResult[]> {
    return this.post<BdsmResult[]>('', userIds);
  }

  getMatchScores(userId: string, partnerIds: string[]): Promise<BdsmMatchScore[]> {
    return this.post<BdsmMatchScore[]>(`match/${encodeURIComponent(userId)}/scores`, partnerIds);
  }
}