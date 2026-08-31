import { Service } from '@angular/core';
import { CountResponse } from '../data/count';
import { Raid } from '../data/raid';
import { ApiService } from './api.service';

@Service()
export class RaidService extends ApiService {

  constructor() {
    super('raids');
  }

  getRaids(): Promise<Raid[]> {
    return this.get<Raid[]>();
  }

  async countRaids(): Promise<number> {
    return (await this.get<CountResponse>('count')).count;
  }
}