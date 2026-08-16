import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { IMAGE_LOADER } from '@angular/common';
import { provideRouter, TitleStrategy, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { PageMetaStrategy } from '../services/page-meta.strategy';
import { twitchImageLoader } from '../data/twitch-image';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideClientHydration(),
    provideHttpClient(withFetch()),
    provideRouter(routes, withComponentInputBinding()),

    { provide: TitleStrategy, useClass: PageMetaStrategy },

    { provide: IMAGE_LOADER, useValue: twitchImageLoader },
  ],
};