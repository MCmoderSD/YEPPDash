import { HttpErrorResponse } from '@angular/common/http';
import { Service } from '@angular/core';
import { ShoutoutSettings } from '../data/shoutout';
import { ApiService } from './api.service';

@Service()
export class ShoutoutService extends ApiService {

  constructor() {
    super('shoutout');
  }

  async getSettings(): Promise<ShoutoutSettings | null> {
    try {
      return await this.get<ShoutoutSettings>();
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 404) return null;
      throw error;
    }
  }

  setAutoShoutout(autoShoutout: boolean): Promise<ShoutoutSettings> {
    return this.patch<ShoutoutSettings>('auto', { autoShoutout });
  }
}