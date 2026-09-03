import { Service } from '@angular/core';
import { Wheel, WheelOverlayState, WheelSummary, WheelUpdate } from '../data/wheel';
import { ApiService } from './api.service';

interface OverlayResponse {
  wheel: WheelOverlayState | null;
}

@Service()
export class WheelService extends ApiService {

  constructor() {
    super('wheel');
  }

  list(): Promise<WheelSummary[]> {
    return this.get<WheelSummary[]>('');
  }

  count(): Promise<number> {
    return this.get<number>('count');
  }

  getWheel(id: string): Promise<Wheel> {
    return this.get<Wheel>(encodeURIComponent(id));
  }

  create(update: WheelUpdate): Promise<Wheel> {
    return this.post<Wheel>('', update);
  }

  save(id: string, update: WheelUpdate): Promise<Wheel> {
    return this.put<Wheel>(encodeURIComponent(id), update);
  }

  remove(id: string): Promise<void> {
    return this.delete(encodeURIComponent(id));
  }

  async spin(id: string, index: number): Promise<void> {
    await this.post(`${encodeURIComponent(id)}/spin`, { index });
  }

  async dismiss(id: string): Promise<void> {
    await this.post(`${encodeURIComponent(id)}/dismiss`);
  }

  async getOverlay(id: string): Promise<WheelOverlayState | null> {
    const response: OverlayResponse = await this.get<OverlayResponse>(`overlay/${encodeURIComponent(id)}`);
    return response.wheel;
  }
}