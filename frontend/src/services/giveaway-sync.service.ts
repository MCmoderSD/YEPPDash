import { inject, Service } from '@angular/core';
import { GiveawayOverlayState, GiveawayParticipant, GiveawayStatus, GiveawayWinner } from '../data/giveaway';
import { SseService, StreamListener } from './sse.service';

export type GiveawayOverlayMessage =
  | { type: 'state'; giveaway: GiveawayOverlayState }
  | { type: 'spin'; giveawayId: string; index: number }
  | { type: 'dismiss'; giveawayId: string };

export type GiveawayDashboardMessage =
  | { type: 'participant'; giveawayId: string; participant: GiveawayParticipant }
  | { type: 'status'; giveawayId: string; status: GiveawayStatus }
  | { type: 'winner'; giveawayId: string; winner: GiveawayWinner };

@Service()
export class GiveawaySyncService {

  private readonly sse: SseService = inject(SseService);

  listenOverlay(
    giveawayId: string,
    receive: (message: GiveawayOverlayMessage) => void,
    opened: () => void = (): void => undefined
  ): StreamListener {
    return this.sse.open(`giveaway/overlay/${encodeURIComponent(giveawayId)}/stream`, false, receive, opened);
  }

  listenDashboard(
    receive: (message: GiveawayDashboardMessage) => void,
    opened: () => void = (): void => undefined
  ): StreamListener {
    return this.sse.open('giveaway/stream', true, receive, opened);
  }
}