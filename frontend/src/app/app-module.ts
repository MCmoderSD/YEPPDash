import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { IMAGE_LOADER } from '@angular/common';
import { TitleStrategy } from '@angular/router';

import { App } from './app';
import { AppRoutingModule } from './app-routing-module';
import { ComponentsModule } from '../components/components.module';
import { PagesModule } from '../pages/pages.module';
import { PageMetaStrategy } from '../services/page-meta.strategy';
import { twitchImageLoader } from '../data/twitch-image';

@NgModule({
  declarations: [App],
  imports: [BrowserModule, AppRoutingModule, ComponentsModule, PagesModule],
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideClientHydration(),
    provideAnimationsAsync(),
    provideHttpClient(withFetch()),

    // Replaces the router's own strategy, which sets the title and nothing else.
    { provide: TitleStrategy, useClass: PageMetaStrategy },

    // Every ngSrc in the app goes through this; it only rewrites Twitch avatars and hands anything
    // else straight back.
    { provide: IMAGE_LOADER, useValue: twitchImageLoader },
  ],
  bootstrap: [App],
})
export class AppModule { }