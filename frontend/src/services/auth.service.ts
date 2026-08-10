import { Injectable, computed, inject, signal, Signal, WritableSignal } from "@angular/core";
import { environment } from '../environments/environment';
import { TwitchUser } from '../data/twitch-user';
import { TwitchService } from './twitch.service';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class AuthService extends ApiService {

  constructor() {
    super('auth');
  }

  private readonly twitch: TwitchService = inject(TwitchService);

  private readonly user: WritableSignal<TwitchUser | null> = signal<TwitchUser | null>(null);
  private readonly loaded: WritableSignal<boolean> = signal(false);

  readonly currentUser: Signal<TwitchUser | null> = this.user.asReadonly();
  readonly isAuthenticated: Signal<boolean> = computed((): boolean => this.user() !== null);

  loginUrl(returnPath: string): string {
    const returnUrl = `${environment.frontendBaseUrl}${returnPath}`;
    return `${this.url('login')}?returnUrl=${encodeURIComponent(returnUrl)}`;
  }

  async logout(): Promise<void> {
    await this.post('logout');
    this.user.set(null);
  }

  async ensureLoaded(): Promise<TwitchUser | null> {
    if (this.loaded()) return this.user();

    try {
      const info: TwitchUser = await this.get<TwitchUser>('me');
      this.user.set(info);
      void this.twitch.loadChatColor();
    } catch {
      this.user.set(null);
    } finally {
      this.loaded.set(true);
    }

    return this.user();
  }
}