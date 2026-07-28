import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { LandingPageComponent } from './landing-page/landing-page.component';
import { DashPageComponent } from './dash-page/dash-page.component';
import { ImprintPageComponent } from './imprint-page/imprint-page.component';
import { PrivacyPageComponent } from './privacy-page/privacy-page.component';
import { TermsPageComponent } from './terms-page/terms-page.component';
import { ComponentsModule } from '../components/components.module';

const components: any[] = [
  LandingPageComponent,
  DashPageComponent,
  ImprintPageComponent,
  PrivacyPageComponent,
  TermsPageComponent
];

@NgModule({
  declarations: [components],
  imports: [
    ComponentsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule
  ],
  exports: [components]
})
export class PagesModule { }