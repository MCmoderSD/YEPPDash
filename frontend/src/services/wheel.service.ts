import { Service } from '@angular/core';
import { StoredWheel, WheelType } from '../data/wheel';
import { ApiService } from './api.service';

@Service()
export class WheelService extends ApiService {

  constructor() {
    super('wheel');
  }

  getWheel(channelId: string): Promise<StoredWheel> {
    return this.get<StoredWheel>(encodeURIComponent(channelId));
  }

  saveWheel(channelId: string, entries: readonly string[], type: WheelType = WheelType.Wheel): Promise<StoredWheel> {
    return this.put<StoredWheel>(encodeURIComponent(channelId), { entries, type });
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