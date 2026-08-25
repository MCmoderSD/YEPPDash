import { Service } from '@angular/core';
import { ApiService } from './api.service';
import { Queue, QueueRequirement } from '../data/queue';

@Service()
export class QueueService extends ApiService {

  constructor() {
    super('queue');
  }

  getQueue(channelId: string): Promise<Queue> {
    return this.get<Queue>(encodeURIComponent(channelId));
  }

  open(channelId: string): Promise<Queue> {
    return this.post<Queue>(`${encodeURIComponent(channelId)}/open`);
  }

  close(channelId: string): Promise<Queue> {
    return this.post<Queue>(`${encodeURIComponent(channelId)}/close`);
  }

  next(channelId: string): Promise<Queue> {
    return this.post<Queue>(`${encodeURIComponent(channelId)}/next`);
  }

  clear(channelId: string): Promise<Queue> {
    return this.delete<Queue>(`${encodeURIComponent(channelId)}/entries`);
  }

  remove(channelId: string, userId: string): Promise<Queue> {
    return this.delete<Queue>(`${encodeURIComponent(channelId)}/entries/${encodeURIComponent(userId)}`);
  }

  move(channelId: string, userId: string, position: number): Promise<Queue> {
    return this.put<Queue>(
      `${encodeURIComponent(channelId)}/entries/${encodeURIComponent(userId)}/position`,
      { position });
  }

  saveRequirement(channelId: string, requirement: QueueRequirement): Promise<Queue> {
    return this.put<Queue>(`${encodeURIComponent(channelId)}/requirement`, { requirement });
  }
}
