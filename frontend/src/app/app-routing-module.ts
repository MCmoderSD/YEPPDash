import { NgModule } from '@angular/core';
import { RouterModule, type Routes } from '@angular/router';
import { LandingPageComponent } from '../pages/landing-page/landing-page.component';
import { DashPageComponent } from '../pages/dash-page/dash-page.component';
import { authGuard } from '../services/auth.guard';

const routes: Routes = [
  { path: '', component: LandingPageComponent },
  { path: 'dash', component: DashPageComponent, canActivate: [authGuard] },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
