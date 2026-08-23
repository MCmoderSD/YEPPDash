import { Service } from '@angular/core';
import { ApiService } from './api.service';
import { SubathonTimer, SubathonTimerResponse, TimerStyle, timerFrom } from '../data/subathon-timer';

@Service()
export class TimerService extends ApiService {

  constructor() {
    super('timer');
  }

  getTimer(channelId: string): Promise<SubathonTimer> {
    return this.timed((path: string): Promise<SubathonTimerResponse> => this.get<SubathonTimerResponse>(path), encodeURIComponent(channelId));
  }

  start(channelId: string): Promise<SubathonTimer> {
    return this.command(channelId, 'start');
  }

  pause(channelId: string): Promise<SubathonTimer> {
    return this.command(channelId, 'pause');
  }

  reset(channelId: string): Promise<SubathonTimer> {
    return this.command(channelId, 'reset');
  }

  // One call for add and remove: a negative delta is the only difference between them.
  adjust(channelId: string, seconds: number): Promise<SubathonTimer> {
    return this.command(channelId, 'adjust', { seconds });
  }

  set(channelId: string, seconds: number): Promise<SubathonTimer> {
    return this.command(channelId, 'set', { seconds });
  }

  saveConfig(channelId: string, startSeconds: number): Promise<SubathonTimer> {
    return this.timed(
      (path: string): Promise<SubathonTimerResponse> => this.put<SubathonTimerResponse>(path, { startSeconds }),
      `${encodeURIComponent(channelId)}/config`);
  }

  saveStyle(channelId: string, style: TimerStyle): Promise<SubathonTimer> {
    return this.timed(
      (path: string): Promise<SubathonTimerResponse> => this.put<SubathonTimerResponse>(path, { style: JSON.stringify(style) }),
      `${encodeURIComponent(channelId)}/style`);
  }

  private command(channelId: string, action: string, body: unknown = null): Promise<SubathonTimer> {
    return this.timed(
      (path: string): Promise<SubathonTimerResponse> => this.post<SubathonTimerResponse>(path, body),
      `${encodeURIComponent(channelId)}/${action}`);
  }

  // Notes when the request left so the reply's server time can be corrected for half the round trip.
  private async timed(
    call: (path: string) => Promise<SubathonTimerResponse>, path: string
  ): Promise<SubathonTimer> {
    const sentAt: number = Date.now();

    return timerFrom(await call(path), sentAt);
  }
}
