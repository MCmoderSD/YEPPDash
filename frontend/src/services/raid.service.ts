import { Service } from '@angular/core';
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
}