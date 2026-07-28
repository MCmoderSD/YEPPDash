import { Component, afterNextRender, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

// Error codes the backend appends when the OAuth2 flow does not complete (AuthController.RedirectToFrontend).
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Du hast den Zugriff bei Twitch abgelehnt.',
  invalid_state: 'Der Login ist abgelaufen oder wurde unterbrochen. Bitte erneut versuchen.',
  missing_code: 'Twitch hat keinen Autorisierungscode zurückgegeben. Bitte erneut versuchen.',
  twitch_error: 'Twitch hat den Login abgelehnt. Bitte später erneut versuchen.',
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
    // '/' stays statically prerendered at build time (PLAN.md#frontend-design), so this check
    // can only happen client-side, after hydration — afterNextRender guarantees it never runs
    // during the server-side prerender step, where there's no real cookie to check anyway.
    afterNextRender(() => {
      this.readAuthError();
      void this.redirectIfAlreadyAuthenticated();
    });
  }

  private readAuthError(): void {
    const error = this.route.snapshot.queryParamMap.get('error');
    if (error) {
      this.authError.set(AUTH_ERROR_MESSAGES[error] ?? 'Der Login ist fehlgeschlagen.');
    }
  }

  private async redirectIfAlreadyAuthenticated(): Promise<void> {
    const user = await this.auth.ensureLoaded();
    if (user) {
      await this.router.navigateByUrl('/dash');
    }
  }
}
