import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';
import { environment } from '../environments/environment';
import { Queue } from '../data/queue';

export interface QueueListener {
  close(): void;
}

const CLOSED: QueueListener = { close: (): void => undefined };

@Service()
export class QueueSyncService {

  private readonly view: (Window & typeof globalThis) | null = inject(DOCUMENT).defaultView;

  listen(
    channelId: string,
    receive: (queue: Queue) => void,
    opened: () => void = (): void => undefined
  ): QueueListener {
    const supported: typeof EventSource | undefined = this.view?.EventSource;
    if (!supported) return CLOSED;

    // Unlike the wheel and the timer, this stream sits behind the owner check — without the session
    // cookie it answers 401 rather than a queue.
    const source: EventSource = new supported(
      `${environment.apiBaseUrl}/queue/${encodeURIComponent(channelId)}/stream`,
      { withCredentials: true });

    source.onopen = (): void => opened();

    source.onmessage = (event: MessageEvent<string>): void => {
      try {
        receive(JSON.parse(event.data) as Queue);
      } catch {
        // A payload this build does not understand is not worth taking the page down for.
      }
    };

    return { close: (): void => source.close() };
  }
}
