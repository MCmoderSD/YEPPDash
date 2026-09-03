import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';
import { environment } from '../environments/environment';

export interface StreamListener {
  close(): void;
}

const CLOSED: StreamListener = { close: (): void => undefined };

@Service()
export class SseService {

  private readonly view: (Window & typeof globalThis) | null = inject(DOCUMENT).defaultView;

  open<T>(
    path: string,
    credentials: boolean,
    receive: (message: T) => void,
    opened: () => void = (): void => undefined,
  ): StreamListener {
    const supported: typeof EventSource | undefined = this.view?.EventSource;
    if (!supported) return CLOSED;

    const source: EventSource = new supported(
      `${environment.apiBaseUrl}/${path}`,
      { withCredentials: credentials });

    source.onopen = (): void => opened();

    source.onmessage = (event: MessageEvent<string>): void => {
      try {
        receive(JSON.parse(event.data) as T);
      } catch {
        // A payload this build does not understand is not worth taking the page down for.
      }
    };

    return { close: (): void => source.close() };
  }
}