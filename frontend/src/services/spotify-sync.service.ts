import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';
import { environment } from '../environments/environment';
import { SpotifyMessage, SpotifyOverlayMessage } from '../data/spotify';

export interface SpotifyListener {
  close(): void;
}

const CLOSED: SpotifyListener = { close: (): void => undefined };

@Service()
export class SpotifySyncService {

  private readonly view: (Window & typeof globalThis) | null = inject(DOCUMENT).defaultView;

  /**
   * Unlike the wheel's and the timer's streams, this one carries what a private account is listening
   * to, so it runs under the session cookie — hence `withCredentials`, and hence the backend's
   * owner check on the other end.
   */
  listen(
    channelId: string,
    receive: (message: SpotifyMessage) => void,
    opened: () => void = (): void => undefined
  ): SpotifyListener {
    const supported: typeof EventSource | undefined = this.view?.EventSource;
    if (!supported) return CLOSED;

    const source: EventSource = new supported(
      `${environment.apiBaseUrl}/spotify/${encodeURIComponent(channelId)}/stream`,
      { withCredentials: true });

    source.onopen = (): void => opened();

    source.onmessage = (event: MessageEvent<string>): void => {
      try {
        receive(JSON.parse(event.data) as SpotifyMessage);
      } catch {
        // A payload this build does not understand is not worth taking the page down for.
      }
    };

    return { close: (): void => source.close() };
  }

  /**
   * The OBS browser source's feed. No credentials on purpose: a browser source has no session, and
   * the link has to work on whatever machine is streaming. The backend answers it with a narrower
   * payload than the dashboard gets for exactly that reason.
   */
  listenOverlay(
    channelId: string,
    receive: (message: SpotifyOverlayMessage) => void,
    opened: () => void = (): void => undefined
  ): SpotifyListener {
    const supported: typeof EventSource | undefined = this.view?.EventSource;
    if (!supported) return CLOSED;

    const source: EventSource = new supported(
      `${environment.apiBaseUrl}/spotify/${encodeURIComponent(channelId)}/overlay/stream`);

    source.onopen = (): void => opened();

    source.onmessage = (event: MessageEvent<string>): void => {
      try {
        receive(JSON.parse(event.data) as SpotifyOverlayMessage);
      } catch {
        // A payload this build does not understand is not worth taking the overlay down for.
      }
    };

    return { close: (): void => source.close() };
  }
}
