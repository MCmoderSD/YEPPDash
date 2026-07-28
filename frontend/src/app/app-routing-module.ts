import { NgModule } from '@angular/core';
import { CanMatchFn, RouterModule, type Routes } from '@angular/router';
import { LandingPageComponent } from '../pages/landing-page/landing-page.component';
import { ImprintPageComponent } from '../pages/imprint-page/imprint-page.component';
import { PrivacyPageComponent } from '../pages/privacy-page/privacy-page.component';
import { TermsPageComponent } from '../pages/terms-page/terms-page.component';
import { authGuard } from '../services/auth.guard';
import { isDashHost } from '../services/dash-host';
import { environment } from '../environments/environment';

const dashHostMatch: CanMatchFn = () => isDashHost();
const otherHostMatch: CanMatchFn = () => !isDashHost();
const devOnlyMatch: CanMatchFn = () => !environment.production;

const routes: Routes = [
  // Production: dash.yeppbot.com serves the dashboard at its own root.
  {
    path: '',
    canActivate: [authGuard],
    canMatch: [dashHostMatch],
    loadChildren: () => import('../pages/dash.module').then((module) => module.DashModule),
  },
  // Production: every other host (www / apex) serves the marketing site.
  { path: '', component: LandingPageComponent, title: 'YEPPDash', canMatch: [otherHostMatch] },
  { path: 'imprint', component: ImprintPageComponent, title: 'Imprint', canMatch: [otherHostMatch] },
  { path: 'privacy', component: PrivacyPageComponent, title: 'Privacy Policy', canMatch: [otherHostMatch] },
  { path: 'terms', component: TermsPageComponent, title: 'Terms of Service', canMatch: [otherHostMatch] },
  // Dev convenience: no separate dash hostname exists locally, so the dashboard stays reachable under /dash.
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
