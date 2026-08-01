import { Service } from '@angular/core';
import { ApiService } from './api.service';

export interface BotResult {
  success: boolean;
  status: number;
  message: string;
}

@Service()
export class BotService extends ApiService {

  constructor() {
    super('bot');
  }

  joinChannel(channelId: string): Promise<BotResult> {
    return this.post<BotResult>(`${encodeURIComponent(channelId)}/join`);
  }

  leaveChannel(channelId: string): Promise<BotResult> {
    return this.post<BotResult>(`${encodeURIComponent(channelId)}/leave`);
  }
}