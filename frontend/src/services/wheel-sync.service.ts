import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';
import { environment } from '../environments/environment';

export type WheelMessage =
  | { type: 'state'; entries: string[] }
  | { type: 'spin'; index: number }
  | { type: 'dismiss' };

export interface WheelListener {
  close(): void;
}

const CLOSED: WheelListener = { close: (): void => undefined };

@Service()
export class WheelSyncService {

  private readonly view: (Window & typeof globalThis) | null = inject(DOCUMENT).defaultView;

  listen(
    channelId: string,
    receive: (message: WheelMessage) => void,
    opened: () => void = (): void => undefined
  ): WheelListener {
    const supported: typeof EventSource | undefined = this.view?.EventSource;
    if (!supported) return CLOSED;

    const source: EventSource = new supported(`${environment.apiBaseUrl}/wheel/${encodeURIComponent(channelId)}/stream`);

    source.onopen = (): void => opened();

    source.onmessage = (event: MessageEvent<string>): void => {
      try {
        receive(JSON.parse(event.data) as WheelMessage);
      } catch {
        // A payload this build does not understand is not worth taking the overlay down for.
      }
    };

    return { close: (): void => source.close() };
  }
}