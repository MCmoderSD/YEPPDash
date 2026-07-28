import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

import { NavbarComponent } from './navbar-component/navbar.component';
import { UserMenuComponent } from './user-menu-component/user-menu.component';
import { FooterComponent } from './footer-component/footer.component';

const components: any[] = [
  NavbarComponent,
  UserMenuComponent,
  FooterComponent
];

@NgModule({
  declarations: [components],
  imports: [
    RouterModule,
    NgOptimizedImage,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule
  ],
  exports: [components]
})
export class ComponentsModule { }
