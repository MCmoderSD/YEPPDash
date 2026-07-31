import { Service } from '@angular/core';
import { ApiService } from './api.service';

/** What YEPPBot answered, passed through by the dashboard's own bot routes. */
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

  /** Asks the bot to leave the channel's chat. */
  leaveChannel(channelId: string): Promise<BotResult> {
    return this.post<BotResult>(`${encodeURIComponent(channelId)}/leave`);
  }
}
