import { inject, Service } from '@angular/core';
import { SubathonTimer, SubathonTimerResponse, timerFrom } from '../data/subathon-timer';
import { SseService, StreamListener } from './sse.service';

@Service()
export class TimerSyncService {

  private readonly sse: SseService = inject(SseService);

  listen(
    channelId: string,
    receive: (timer: SubathonTimer) => void,
    opened: () => void = (): void => undefined
  ): StreamListener {
    return this.sse.open<SubathonTimerResponse>(
      `timer/${encodeURIComponent(channelId)}/stream`,
      false,
      (response: SubathonTimerResponse): void => receive(timerFrom(response)),
      opened);
  }
}