import { ApplicationRef } from '@angular/core';
import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser';
import { App } from './app/app';
import { config } from './app/app.config.server';

// noinspection JSUnusedGlobalSymbols
export default (context: BootstrapContext): Promise<ApplicationRef> => bootstrapApplication(App, config, context);