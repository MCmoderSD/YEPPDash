import { Component, afterNextRender, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TwitchUser } from "../../data/twitch-user";
import { environment } from '../../environments/environment';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'You denied access on Twitch.',
  invalid_state: 'The login expired or was interrupted. Please try again.',
  missing_code: 'Twitch did not return an authorization code. Please try again.',
  twitch_error: 'Twitch rejected the login. Please try again later.',
};

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss',
  standalone: false,
})
export class LandingPageComponent {

  private readonly auth: AuthService = inject(AuthService);

  private readonly router: Router = inject(Router);
  private readonly route:ActivatedRoute = inject(ActivatedRoute);

  protected readonly loginUrl: string = this.auth.loginUrl(environment.production ? '/' : '/dash');
  protected readonly authError = signal<string | null>(null);

  constructor() {
    afterNextRender((): void => {
      this.readAuthError();
      void this.redirectIfAlreadyAuthenticated();
    });
  }

  private readAuthError(): void {
    const error: string | null = this.route.snapshot.queryParamMap.get('error');
    if (error) this.authError.set(AUTH_ERROR_MESSAGES[error] ?? 'The login failed.');
  }

  private async redirectIfAlreadyAuthenticated(): Promise<void> {
    const user: TwitchUser | null = await this.auth.ensureLoaded();
    if (!user) return;

    // In production the dashboard lives on its own subdomain, so this is a real cross-origin
    // navigation rather than an in-app route change.
    if (environment.production) window.location.href = environment.frontendBaseUrl;
    else await this.router.navigateByUrl('/dash');
  }
}