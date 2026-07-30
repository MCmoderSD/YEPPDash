import { NgModule } from '@angular/core';
import { RouterModule, type Routes } from '@angular/router';
import { DatePipe, NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';

import { DashPageComponent } from './dash-page/dash-page.component';
import { DashHomePageComponent } from './dash-home-page/dash-home-page.component';
import { SidebarComponent } from '../components/sidebar-component/sidebar.component';
import { RoleManagementComponent } from '../components/role-management-component/role-management.component';
import { QuoteManagementComponent } from '../components/quote-management-component/quote-management.component';
import { QuoteEditDialogComponent } from '../components/quote-edit-dialog-component/quote-edit-dialog.component';
import { ConfirmActionDialogComponent } from '../components/confirm-action-dialog-component/confirm-action-dialog.component';
import { BotManageComponent } from '../components/bot-manage-component/bot-manage.component';
import { ScrollBarComponent } from '../components/scroll-bar-component/scroll-bar.component';
import { UserComponentsModule } from '../components/user-components.module';

const routes: Routes = [
  {
    path: '',
    component: DashPageComponent,
    children: [
      { path: '', component: DashHomePageComponent, title: 'Dashboard' },
      { path: 'role-management', component: RoleManagementComponent, title: 'Role Management' },
      { path: 'quotes', component: QuoteManagementComponent, title: 'Quote Management' }
    ]
  }
];

const components: any[] = [
  DashPageComponent,
  DashHomePageComponent,
  SidebarComponent,
  RoleManagementComponent,
  QuoteManagementComponent,
  QuoteEditDialogComponent,
  ConfirmActionDialogComponent,
  BotManageComponent
];

// Loaded lazily behind /dash: everything in here — the Material table, sort, input, dialog, list
// and progress bar — is dead weight on the public pages, which is most of the traffic.
@NgModule({
  declarations: [components],
  imports: [
    RouterModule.forChild(routes),
    UserComponentsModule,
    ScrollBarComponent,
    DatePipe,
    NgOptimizedImage,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatProgressBarModule,
    MatSidenavModule,
    MatSortModule,
    MatTableModule
  ]
})
export class DashModule { }
