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

  /** Asks the bot to join the channel's chat. Asking twice is not an error. */
  joinChannel(channelId: string): Promise<BotResult> {
    return this.post<BotResult>(`${encodeURIComponent(channelId)}/join`);
  }

  leaveChannel(channelId: string): Promise<BotResult> {
    return this.post<BotResult>(`${encodeURIComponent(channelId)}/leave`);
  }
}
