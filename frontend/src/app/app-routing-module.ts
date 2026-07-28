import { NgModule } from '@angular/core';
import { RouterModule, type Routes } from '@angular/router';
import { LandingPageComponent } from '../pages/landing-page/landing-page.component';
import { DashPageComponent } from '../pages/dash-page/dash-page.component';
import { ImprintPageComponent } from '../pages/imprint-page/imprint-page.component';
import { PrivacyPageComponent } from '../pages/privacy-page/privacy-page.component';
import { TermsPageComponent } from '../pages/terms-page/terms-page.component';
import { authGuard } from '../services/auth.guard';

const routes: Routes = [
  { path: '', component: LandingPageComponent, title: 'YEPPDash' },
  { path: 'dash', component: DashPageComponent, canActivate: [authGuard], title: 'Dashboard — YEPPDash' },
  { path: 'imprint', component: ImprintPageComponent, title: 'Imprint — YEPPDash' },
  { path: 'privacy', component: PrivacyPageComponent, title: 'Privacy Policy — YEPPDash' },
  { path: 'terms', component: TermsPageComponent, title: 'Terms of Service — YEPPDash' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
