import { NgModule } from '@angular/core';
import { CanMatchFn, RouterModule, type Routes } from '@angular/router';
import { LandingPageComponent } from '../pages/landing-page/landing-page.component';
import { FaqPageComponent } from '../pages/faq-page/faq-page.component';
import { ImprintPageComponent } from '../pages/imprint-page/imprint-page.component';
import { PrivacyPageComponent } from '../pages/privacy-page/privacy-page.component';
import { TermsPageComponent } from '../pages/terms-page/terms-page.component';
import { authGuard } from '../services/auth.guard';
import { isDashHost } from '../services/dash-host';
import { WHEEL_OVERLAY_PATH } from '../data/wheel-overlay';
import { environment } from '../environments/environment';

const dashHostMatch: CanMatchFn = (): boolean => isDashHost();
const otherHostMatch: CanMatchFn = (): boolean => !isDashHost();
const devOnlyMatch: CanMatchFn = (): boolean => !environment.production;

const routes: Routes = [
  {
    path: WHEEL_OVERLAY_PATH,
    loadComponent: () => import('../pages/wheel-overlay-page/wheel-overlay-page.component').then((module) => module.WheelOverlayPageComponent),
    title: 'Lucky Wheel',
  },
  {
    path: '',
    canActivate: [authGuard],
    canMatch: [dashHostMatch],
    loadChildren: () => import('../pages/dash.module').then((module) => module.DashModule),
  },
  {
    path: '',
    component: LandingPageComponent,
    title: 'YEPPDash',
    canMatch: [otherHostMatch],
    data: {
      description: 'Run YEPPBot from your browser. Sign in with Twitch to add the bot to your '
        + 'channel, hand out moderator and VIP roles, write custom commands, and keep quotes and '
        + 'follower birthdays in one place.',
    },
  },
  {
    path: 'faq',
    component: FaqPageComponent,
    title: 'FAQ',
    canMatch: [otherHostMatch],
    data: {
      description: 'What YEPPBot is, what YEPPDash does with your Twitch account, which permissions '
        + 'it asks for and why, and how finished any of it actually is.',
    },
  },
  {
    path: 'imprint',
    component: ImprintPageComponent,
    title: 'Imprint',
    canMatch: [otherHostMatch],
    data: { description: 'Who runs YEPPDash and YEPPBot, and how to get in touch.' },
  },
  {
    path: 'privacy',
    component: PrivacyPageComponent,
    title: 'Privacy Policy',
    canMatch: [otherHostMatch],
    data: {
      description: 'What YEPPDash processes about you and why, how your Twitch tokens are kept '
        + 'encrypted, and your rights under the GDPR. No analytics, no data brokers.',
    },
  },
  {
    path: 'terms',
    component: TermsPageComponent,
    title: 'Terms of Service',
    canMatch: [otherHostMatch],
    data: { description: 'The terms you agree to when using YEPPDash to run YEPPBot in your channel.' },
  },
  {
    path: 'dash',
    canActivate: [authGuard],
    canMatch: [devOnlyMatch],
    loadChildren: () => import('../pages/dash.module').then((module) => module.DashModule),
  },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { bindToComponentInputs: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }