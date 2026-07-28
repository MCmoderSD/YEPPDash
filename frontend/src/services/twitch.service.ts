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

  // Purely decorative, so a failure here stays silent and simply leaves the name in the
  // default colour rather than surfacing an error the user can do nothing about.
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
}
