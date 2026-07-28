import { HttpClient } from "@angular/common/http";
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { TwitchUser } from '../data/twitch-user';
import { TwitchService } from './twitch.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly twitch: TwitchService = inject(TwitchService);

  private readonly user = signal<TwitchUser | null>(null);
  private readonly loaded = signal(false);

  readonly currentUser = this.user.asReadonly();
  readonly isAuthenticated = computed(() => this.user() !== null);

  loginUrl(returnPath: string): string {
    const returnUrl = `${environment.frontendBaseUrl}${returnPath}`;
    return `${environment.apiBaseUrl}/api/auth/login?returnUrl=${encodeURIComponent(returnUrl)}`;
  }

  async logout(): Promise<void> {
    await firstValueFrom(
      this.http.post(`${environment.apiBaseUrl}/api/auth/logout`, null, { withCredentials: true }),
    );
    this.user.set(null);
  }

  async ensureLoaded(): Promise<TwitchUser | null> {
    if (this.loaded()) return this.user();
    void this.twitch.loadChatColor();

    try {
      const info = await firstValueFrom(
        this.http.get<TwitchUser>(`${environment.apiBaseUrl}/api/auth/me`, { withCredentials: true }),
      );
      this.user.set(info);
    } catch {
      this.user.set(null);
    } finally {
      this.loaded.set(true);
    }

    return this.user();
  }
}