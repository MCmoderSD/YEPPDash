import { Service } from '@angular/core';
import { CustomCommand, CustomCommandDraft } from '../data/custom-command';
import { ApiService } from './api.service';

@Service()
export class CommandService extends ApiService {

  constructor() {
    super('commands');
  }

  getCommands(channelId: string): Promise<CustomCommand[]> {
    return this.get<CustomCommand[]>(encodeURIComponent(channelId));
  }

  addCommand(channelId: string, command: CustomCommandDraft): Promise<CustomCommand> {
    return this.post<CustomCommand>(encodeURIComponent(channelId), command);
  }

  updateCommand(channelId: string, name: string, command: CustomCommandDraft): Promise<CustomCommand> {
    return this.patch<CustomCommand>(this.path(channelId, name), command);
  }

  setActive(channelId: string, name: string, active: boolean): Promise<CustomCommand> {
    return this.patch<CustomCommand>(`${this.path(channelId, name)}/active`, { active });
  }

  async deleteCommand(channelId: string, name: string): Promise<void> {
    await this.delete(this.path(channelId, name));
  }

  private path(channelId: string, name: string): string {
    return `${encodeURIComponent(channelId)}/${encodeURIComponent(name)}`;
  }
}