import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';
import { environment } from '../environments/environment';

// What the server sends to whoever is watching a wheel. The dashboard owns it: it stores the list,
// draws the slice and says when the winner has been seen. An overlay only ever follows along.
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

  // Server-sent events rather than anything same-browser: OBS runs a browser of its own, so a
  // channel between two pages of one browser never reaches it. This is the only path both the
  // dashboard and the browser source can see.
  //
  // `opened` fires on every connect, including the reconnects EventSource makes by itself after the
  // API restarts or the stream drops — which is exactly when a listener has to read the list again,
  // since anything sent while it was away is gone.
  listen(
    channelId: string,
    receive: (message: WheelMessage) => void,
    opened: () => void = (): void => undefined,
  ): WheelListener {
    const supported: typeof EventSource | undefined = this.view?.EventSource;
    if (!supported) return CLOSED;

    const source: EventSource =
      new supported(`${environment.apiBaseUrl}/wheel/${encodeURIComponent(channelId)}/stream`);

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
