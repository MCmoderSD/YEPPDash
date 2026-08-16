import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from "@angular/router";
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { TwitchUser } from "../data/twitch-user";
import { environment } from '../environments/environment';
import { isDashHost } from './dash-host';

export const authGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const auth: AuthService = inject(AuthService);
  const router: Router = inject(Router);
  const notifications: NotificationService = inject(NotificationService);

  const user: TwitchUser | null = await auth.ensureLoaded();
  if (user !== null) return true;

  // Being told there is no session is a reason to leave. Not being able to ask is not: sending
  // someone to another domain over a request that timed out loses the page they were on, and the
  // session they still have. The navigation is refused and they stay where they are, free to try
  // again once the API answers.
  if (auth.unreachable()) {
    notifications.failure('Could not reach YEPPDash. Please try again.');
    return false;
  }

  if (isDashHost()) {
    window.location.href = environment.marketingBaseUrl;
    return false;
  }

  return router.createUrlTree(['/']);
};