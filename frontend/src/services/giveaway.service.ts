import { Service } from '@angular/core';
import { GiveawayDrawResult, GiveawayOverlayState, GiveawaySettings, GiveawaySummary, GiveawayUpdate } from '../data/giveaway';
import { ApiService } from './api.service';

interface OverlayResponse {
  giveaway: GiveawayOverlayState | null;
}

@Service()
export class GiveawayService extends ApiService {

  constructor() {
    super('giveaway');
  }

  list(): Promise<GiveawaySummary[]> {
    return this.get<GiveawaySummary[]>('');
  }

  count(): Promise<number> {
    return this.get<number>('count');
  }

  getGiveaway(id: string): Promise<GiveawaySettings> {
    return this.get<GiveawaySettings>(`${encodeURIComponent(id)}`);
  }

  create(update: GiveawayUpdate): Promise<GiveawaySettings> {
    return this.post<GiveawaySettings>('', update);
  }

  save(id: string, update: GiveawayUpdate): Promise<GiveawaySettings> {
    return this.put<GiveawaySettings>(`${encodeURIComponent(id)}`, update);
  }

  open(id: string): Promise<GiveawaySettings> {
    return this.post<GiveawaySettings>(`${encodeURIComponent(id)}/open`);
  }

  close(id: string): Promise<GiveawaySettings> {
    return this.post<GiveawaySettings>(`${encodeURIComponent(id)}/close`);
  }

  remove(id: string): Promise<void> {
    return this.delete(`${encodeURIComponent(id)}`);
  }

  removeParticipant(id: string, userId: string): Promise<void> {
    return this.delete(`${encodeURIComponent(id)}/participants/${encodeURIComponent(userId)}`);
  }

  draw(id: string): Promise<GiveawayDrawResult> {
    return this.post<GiveawayDrawResult>(`${encodeURIComponent(id)}/draw`);
  }

  reset(id: string): Promise<GiveawaySettings> {
    return this.post<GiveawaySettings>(`${encodeURIComponent(id)}/reset`);
  }

  dismiss(id: string): Promise<void> {
    return this.post(`${encodeURIComponent(id)}/dismiss`);
  }

  async getOverlay(giveawayId: string): Promise<GiveawayOverlayState | null> {
    const response: OverlayResponse = await this.get<OverlayResponse>(`overlay/${encodeURIComponent(giveawayId)}`);
    return response.giveaway;
  }
}