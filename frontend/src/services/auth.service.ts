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

  // The last attempt ended without an answer rather than with "not signed in" — the API was
  // unreachable, or it could not reach Twitch and said so with a 502. Nobody is signed out here;
  // the question simply went unanswered.
  readonly unreachable: Signal<boolean> = this.failed.asReadonly();

  loginUrl(returnPath: string): string {
    const returnUrl = `${environment.frontendBaseUrl}${returnPath}`;
    return `${this.url('login')}?returnUrl=${encodeURIComponent(returnUrl)}`;
  }

  async logout(): Promise<void> {
    await this.post('logout');

    // A definite answer of its own, so it clears any earlier failure to reach one.
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
      // 401 is the API answering the question: there is no session. Anything else — the API down,
      // the network gone, a 502 because Twitch would not answer — is no answer at all, and
      // treating it as "signed out" is what threw a signed-in viewer off the dashboard.
      const signedOut: boolean = error instanceof HttpErrorResponse && error.status === 401;

      this.user.set(null);
      this.failed.set(!signedOut);

      // Only a definite answer is worth remembering. Without one, the next navigation asks again
      // rather than holding on to a verdict that was never reached.
      this.loaded.set(signedOut);
    }

    return this.user();
  }
}