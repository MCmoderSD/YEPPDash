import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { LandingPageComponent } from './landing-page/landing-page.component';
import { FaqPageComponent } from './faq-page/faq-page.component';
import { ImprintPageComponent } from './imprint-page/imprint-page.component';
import { PrivacyPageComponent } from './privacy-page/privacy-page.component';
import { TermsPageComponent } from './terms-page/terms-page.component';
import { ComponentsModule } from '../components/components.module';
import { FaqEntryComponent } from '../components/faq-entry-component/faq-entry.component';

const components: any[] = [
  LandingPageComponent,
  FaqPageComponent,
  ImprintPageComponent,
  PrivacyPageComponent,
  TermsPageComponent
];

@NgModule({
  declarations: [components],
  imports: [
    ComponentsModule,
    FaqEntryComponent,
    MatButtonModule,
    MatCardModule,
    MatIconModule
  ],
  exports: [components]
})
export class PagesModule { }