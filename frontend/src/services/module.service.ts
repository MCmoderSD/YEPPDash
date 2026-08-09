import { Service } from '@angular/core';
import { BotModule } from '../data/bot-module';
import { ApiService } from './api.service';

@Service()
export class ModuleService extends ApiService {

  constructor() {
    super('modules');
  }

  getModules(channelId: string): Promise<BotModule[]> {
    return this.get<BotModule[]>(encodeURIComponent(channelId));
  }

  enableModule(channelId: string, moduleId: string): Promise<BotModule> {
    return this.post<BotModule>(`${this.path(channelId, moduleId)}/enable`);
  }

  disableModule(channelId: string, moduleId: string): Promise<BotModule> {
    return this.post<BotModule>(`${this.path(channelId, moduleId)}/disable`);
  }

  private path(channelId: string, moduleId: string): string {
    return `${encodeURIComponent(channelId)}/${encodeURIComponent(moduleId)}`;
  }
}