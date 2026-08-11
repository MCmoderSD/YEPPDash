import { Service } from '@angular/core';
import { BdsmMatchScore, BdsmResult } from '../data/bdsm-result';
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

  // How well the user matches each of the others, newest result on either side. Scores only —
  // the results themselves are already on screen wherever this is used.
  getMatchScores(userId: string, partnerIds: string[]): Promise<BdsmMatchScore[]> {
    return this.post<BdsmMatchScore[]>(`match/${encodeURIComponent(userId)}/scores`, partnerIds);
  }
}