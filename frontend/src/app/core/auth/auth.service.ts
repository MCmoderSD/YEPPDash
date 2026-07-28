import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserInfo } from './user-info';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly user = signal<UserInfo | null>(null);
  private readonly loaded = signal(false);

  readonly currentUser = this.user.asReadonly();
  readonly isAuthenticated = computed(() => this.user() !== null);

  // A plain <a href> to a Twitch-hosted consent page — never a router link or an XHR, the
  // OAuth redirect chain needs a real full-page navigation. returnUrl must be an absolute URL
  // on an origin the backend's AllowedFrontendOrigins allowlist trusts (see PLAN.md#auth),
  // otherwise it silently falls back to a backend-side default instead of an open redirect.
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

  // Called by authGuard before entering /dash. Fetches the session once and caches the result —
  // repeat navigations within the same app instance don't re-check with the server. A 401
  // (no session) is an expected, not exceptional, outcome here.
  async ensureLoaded(): Promise<UserInfo | null> {
    if (this.loaded()) return this.user();

    try {
      const info = await firstValueFrom(
        this.http.get<UserInfo>(`${environment.apiBaseUrl}/api/auth/me`, { withCredentials: true }),
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
