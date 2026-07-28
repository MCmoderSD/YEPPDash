import { Component, afterNextRender, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-landing',
  imports: [MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loginUrl = this.auth.loginUrl('/dash');

  constructor() {
    // '/' stays statically prerendered at build time (PLAN.md#frontend-design), so this check
    // can only happen client-side, after hydration — afterNextRender guarantees it never runs
    // during the server-side prerender step, where there's no real cookie to check anyway.
    afterNextRender(() => {
      void this.redirectIfAlreadyAuthenticated();
    });
  }

  private async redirectIfAlreadyAuthenticated(): Promise<void> {
    const user = await this.auth.ensureLoaded();
    if (user) {
      await this.router.navigateByUrl('/dash');
    }
  }
}
