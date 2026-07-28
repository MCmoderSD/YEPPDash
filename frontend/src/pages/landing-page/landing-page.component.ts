import { Component, afterNextRender, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

// Error codes the backend appends when the OAuth2 flow does not complete (AuthController.RedirectToFrontend).
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
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loginUrl = this.auth.loginUrl('/dash');
  protected readonly authError = signal<string | null>(null);

  constructor() {
    afterNextRender(() => {
      this.readAuthError();
      void this.redirectIfAlreadyAuthenticated();
    });
  }

  private readAuthError(): void {
    const error = this.route.snapshot.queryParamMap.get('error');
    if (error) {
      this.authError.set(AUTH_ERROR_MESSAGES[error] ?? 'The login failed.');
    }
  }

  private async redirectIfAlreadyAuthenticated(): Promise<void> {
    const user = await this.auth.ensureLoaded();
    if (user) {
      await this.router.navigateByUrl('/dash');
    }
  }
}
