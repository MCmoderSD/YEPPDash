import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { AuthService } from '../../core/auth/auth.service';

// Placeholder shell (ROADMAP Phase 1, step 6) — just proves the login round-trip end to end.
// The actual channel status/join-leave card is Phase 2 (IBotClient).
@Component({
  selector: 'app-dash',
  imports: [MatButtonModule, MatCardModule],
  templateUrl: './dash.html',
  styleUrl: './dash.scss',
})
export class Dash {
  protected readonly auth = inject(AuthService);

  protected async logout(): Promise<void> {
    await this.auth.logout();
    location.href = '/';
  }
}
