import { Service } from '@angular/core';
import { BdsmResult } from '../data/bdsm-result';
import { ApiService } from './api.service';

@Service()
export class BdsmService extends ApiService {

  constructor() {
    super('bdsm');
  }

  getResults(userId: string): Promise<BdsmResult[]> {
    return this.get<BdsmResult[]>(encodeURIComponent(userId));
  }

  getFollowerResults(userId: string): Promise<BdsmResult[]> {
    return this.get<BdsmResult[]>(`followers/${encodeURIComponent(userId)}`);
  }
}