import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, signal, Signal, WritableSignal } from "@angular/core";
import { environment } from '../environments/environment';
import { Broadcaster } from '../data/broadcaster';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class AuthService extends ApiService {

  constructor() {
    super('auth');
  }

  private readonly user: WritableSignal<Broadcaster | null> = signal<Broadcaster | null>(null);
  private readonly loaded: WritableSignal<boolean> = signal(false);
  private readonly failed: WritableSignal<boolean> = signal(false);

  readonly currentUser: Signal<Broadcaster | null> = this.user.asReadonly();
  readonly isAuthenticated: Signal<boolean> = computed((): boolean => this.user() !== null);
  readonly unreachable: Signal<boolean> = this.failed.asReadonly();

  loginUrl(returnPath: string): string {
    const returnUrl = `${environment.frontendBaseUrl}${returnPath}`;
    return `${this.url('login')}?returnUrl=${encodeURIComponent(returnUrl)}`;
  }

  async logout(): Promise<void> {
    await this.post('logout');

    this.user.set(null);
    this.failed.set(false);
    this.loaded.set(true);
  }

  async ensureLoaded(): Promise<Broadcaster | null> {
    if (this.loaded()) return this.user();

    try {
      this.user.set(await this.get<Broadcaster>('me'));
      this.failed.set(false);
      this.loaded.set(true);
    } catch (error: unknown) {
      const signedOut: boolean = error instanceof HttpErrorResponse && error.status === 401;

      this.user.set(null);
      this.failed.set(!signedOut);
      this.loaded.set(signedOut);
    }

    return this.user();
  }
}