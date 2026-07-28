import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';

// Placeholder shell (ROADMAP Phase 1, step 6) — just proves the login round-trip end to end.
// The actual channel status/join-leave card is Phase 2 (IBotClient).
@Component({
  selector: 'app-dash-page',
  templateUrl: './dash-page.component.html',
  styleUrl: './dash-page.component.scss',
  standalone: false,
})
export class DashPageComponent {
  protected readonly auth = inject(AuthService);

  protected async logout(): Promise<void> {
    await this.auth.logout();
    location.href = '/';
  }
}
