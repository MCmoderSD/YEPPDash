import { inject, Service } from '@angular/core';
import { WheelOverlayState } from '../data/wheel';
import { SseService, StreamListener } from './sse.service';

export type WheelMessage =
  | { type: 'state'; wheelId: string; wheel: WheelOverlayState | null }
  | { type: 'spin'; wheelId: string; index: number }
  | { type: 'dismiss'; wheelId: string };

@Service()
export class WheelSyncService {

  private readonly sse: SseService = inject(SseService);

  listenOverlay(
    wheelId: string,
    receive: (message: WheelMessage) => void,
    opened: () => void = (): void => undefined
  ): StreamListener {
    return this.sse.open(`wheel/overlay/${encodeURIComponent(wheelId)}/stream`, false, receive, opened);
  }
}