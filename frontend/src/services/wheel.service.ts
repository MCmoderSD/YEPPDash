import { Service } from '@angular/core';
import { ApiService } from './api.service';

interface WheelResponse {
  entries: string[];
}

@Service()
export class WheelService extends ApiService {

  constructor() {
    super('wheel');
  }

  async getWheel(channelId: string): Promise<string[]> {
    return (await this.get<WheelResponse>(encodeURIComponent(channelId))).entries;
  }

  async saveWheel(channelId: string, entries: readonly string[]): Promise<string[]> {
    return (await this.put<WheelResponse>(encodeURIComponent(channelId), { entries })).entries;
  }

  // The slice is drawn here and handed out, so every wheel watching this channel stops on the same
  // name rather than each picking one for itself.
  async spin(channelId: string, index: number): Promise<void> {
    await this.post(`${encodeURIComponent(channelId)}/spin`, { index });
  }

  async dismiss(channelId: string): Promise<void> {
    await this.post(`${encodeURIComponent(channelId)}/dismiss`);
  }
}