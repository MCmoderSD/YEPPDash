import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from "@angular/router";
import { AuthService } from './auth.service';
import { TwitchUser } from "../data/twitch-user";
import { environment } from '../environments/environment';
import { isDashHost } from './dash-host';

export const authGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const auth: AuthService = inject(AuthService);
  const router: Router = inject(Router);

  const user: TwitchUser | null = await auth.ensureLoaded();
  if (user !== null) return true;

  if (isDashHost()) {
    window.location.href = environment.marketingBaseUrl;
    return false;
  }

  return router.createUrlTree(['/']);
};