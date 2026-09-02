import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';
import { environment } from '../environments/environment';
import { GiveawayOverlayState, GiveawayParticipant, GiveawayStatus, GiveawayWinner } from '../data/giveaway';

export type GiveawayOverlayMessage =
  | { type: 'state'; giveaway: GiveawayOverlayState }
  | { type: 'spin'; giveawayId: string; index: number }
  | { type: 'dismiss'; giveawayId: string };

export type GiveawayDashboardMessage =
  | { type: 'participant'; giveawayId: string; participant: GiveawayParticipant }
  | { type: 'status'; giveawayId: string; status: GiveawayStatus }
  | { type: 'winner'; giveawayId: string; winner: GiveawayWinner };

export interface GiveawayListener {
  close(): void;
}

const CLOSED: GiveawayListener = { close: (): void => undefined };

@Service()
export class GiveawaySyncService {

  private readonly view: (Window & typeof globalThis) | null = inject(DOCUMENT).defaultView;

  listenOverlay(
    giveawayId: string,
    receive: (message: GiveawayOverlayMessage) => void,
    opened: () => void = (): void => undefined
  ): GiveawayListener {
    return this.listen(`giveaway/overlay/${encodeURIComponent(giveawayId)}/stream`, false, receive, opened);
  }

  listenDashboard(
    receive: (message: GiveawayDashboardMessage) => void,
    opened: () => void = (): void => undefined
  ): GiveawayListener {
    return this.listen('giveaway/stream', true, receive, opened);
  }

  private listen<T>(
    path: string,
    credentials: boolean,
    receive: (message: T) => void,
    opened: () => void
  ): GiveawayListener {
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