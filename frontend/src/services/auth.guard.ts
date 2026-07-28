import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from "@angular/router";
import { AuthService } from './auth.service';
import { TwitchUser } from "../data/twitch-user";

export const authGuard: CanActivateFn = async (): Promise<true | UrlTree> => {
  const auth: AuthService = inject(AuthService);
  const router: Router = inject(Router);

  const user: TwitchUser | null = await auth.ensureLoaded();
  return user !== null ? true : router.createUrlTree(['/']);
};