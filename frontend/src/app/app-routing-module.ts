import { NgModule } from '@angular/core';
import { RouterModule, type Routes } from '@angular/router';
import { LandingPageComponent } from '../pages/landing-page/landing-page.component';
import { ImprintPageComponent } from '../pages/imprint-page/imprint-page.component';
import { PrivacyPageComponent } from '../pages/privacy-page/privacy-page.component';
import { TermsPageComponent } from '../pages/terms-page/terms-page.component';
import { authGuard } from '../services/auth.guard';

const routes: Routes = [
  { path: '', component: LandingPageComponent, title: 'YEPPDash' },
  {
    path: 'dash',
    canActivate: [authGuard],
    loadChildren: () => import('../pages/dash.module').then((module) => module.DashModule),
  },
  { path: 'imprint', component: ImprintPageComponent, title: 'Imprint' },
  { path: 'privacy', component: PrivacyPageComponent, title: 'Privacy Policy' },
  { path: 'terms', component: TermsPageComponent, title: 'Terms of Service' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { bindToComponentInputs: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }