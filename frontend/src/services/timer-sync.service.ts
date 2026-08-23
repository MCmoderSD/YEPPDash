import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';
import { environment } from '../environments/environment';
import { SubathonTimer, SubathonTimerResponse, timerFrom } from '../data/subathon-timer';

export interface TimerListener {
  close(): void;
}

const CLOSED: TimerListener = { close: (): void => undefined };

@Service()
export class TimerSyncService {

  private readonly view: (Window & typeof globalThis) | null = inject(DOCUMENT).defaultView;

  listen(
    channelId: string,
    receive: (timer: SubathonTimer) => void,
    opened: () => void = (): void => undefined
  ): TimerListener {
    const supported: typeof EventSource | undefined = this.view?.EventSource;
    if (!supported) return CLOSED;

    const source: EventSource = new supported(`${environment.apiBaseUrl}/timer/${encodeURIComponent(channelId)}/stream`);

    source.onopen = (): void => opened();

    source.onmessage = (event: MessageEvent<string>): void => {
      try {
        // Converted here rather than by each caller, so nobody can take the state and forget the
        // clock reading that came with it — which is what keeps a viewer's own clock out of the sum.
        receive(timerFrom(JSON.parse(event.data) as SubathonTimerResponse));
      } catch {
        // A payload this build does not understand is not worth taking the overlay down for.
      }
    };

    return { close: (): void => source.close() };
  }
}
