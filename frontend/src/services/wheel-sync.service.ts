import { inject, Service } from '@angular/core';
import { SseService, StreamListener } from './sse.service';

export type WheelMessage =
  | { type: 'state'; entries: string[] }
  | { type: 'spin'; index: number }
  | { type: 'dismiss' };

@Service()
export class WheelSyncService {

  private readonly sse: SseService = inject(SseService);

  listen(
    channelId: string,
    receive: (message: WheelMessage) => void,
    opened: () => void = (): void => undefined
  ): StreamListener {
    return this.sse.open(`wheel/${encodeURIComponent(channelId)}/stream`, false, receive, opened);
  }
}