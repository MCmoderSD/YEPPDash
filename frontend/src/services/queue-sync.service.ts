import { inject, Service } from '@angular/core';
import { Queue } from '../data/queue';
import { SseService, StreamListener } from './sse.service';

@Service()
export class QueueSyncService {

  private readonly sse: SseService = inject(SseService);

  listen(
    channelId: string,
    receive: (queue: Queue) => void,
    opened: () => void = (): void => undefined
  ): StreamListener {
    return this.sse.open(`queue/${encodeURIComponent(channelId)}/stream`, true, receive, opened);
  }
}