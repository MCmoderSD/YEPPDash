import { NgModule } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { LandingPageComponent } from './landing-page/landing-page.component';
import { DashPageComponent } from './dash-page/dash-page.component';
import { ComponentsModule } from '../components/components.module';

const components: any[] = [
  LandingPageComponent,
  DashPageComponent
];

@NgModule({
  declarations: [components],
  imports: [
    ComponentsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    NgOptimizedImage
  ],
  exports: [components]
})
export class PagesModule { }
