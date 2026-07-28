import { HttpClient } from '@angular/common/http';
import { inject, Service, signal, Signal, WritableSignal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { ChatColor } from '../data/chat-color';

@Service()
export class TwitchService {

  private readonly http: HttpClient = inject(HttpClient);

  private readonly color: WritableSignal<string | null> = signal<string | null>(null);

  readonly chatColor: Signal<string | null> = this.color.asReadonly();

  async loadChatColor(): Promise<void> {
    try {
      const response: ChatColor = await firstValueFrom(
        this.http.get<ChatColor>(`${environment.apiBaseUrl}/api/twitch/chat-color`, { withCredentials: true }),
      );
      this.color.set(response.color);
    } catch {
      this.color.set(null);
    }
  }

  // Unlike loadChatColor, these are real state-changing actions a user explicitly
  // triggered — errors are left to propagate (404 unknown user, 409 already a VIP,
  // 422 already a moderator or the broadcaster themselves) so a caller can show them.
  async addModerator(userId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${environment.apiBaseUrl}/api/twitch/moderators/${encodeURIComponent(userId)}`, null, { withCredentials: true }),
    );
  }

  async removeModerator(userId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${environment.apiBaseUrl}/api/twitch/moderators/${encodeURIComponent(userId)}`, { withCredentials: true }),
    );
  }

  async addVip(userId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${environment.apiBaseUrl}/api/twitch/vips/${encodeURIComponent(userId)}`, null, { withCredentials: true }),
    );
  }

  async removeVip(userId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${environment.apiBaseUrl}/api/twitch/vips/${encodeURIComponent(userId)}`, { withCredentials: true }),
    );
  }
}