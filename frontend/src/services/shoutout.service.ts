import { HttpErrorResponse } from '@angular/common/http';
import { Service } from '@angular/core';
import { ShoutoutSettings } from '../data/shoutout';
import { ApiService } from './api.service';

@Service()
export class ShoutoutService extends ApiService {

  constructor() {
    super('shoutout');
  }

  // Null when YEPPBot does not know the channel yet: the row belongs to the bot, and nothing on this
  // side creates one.
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