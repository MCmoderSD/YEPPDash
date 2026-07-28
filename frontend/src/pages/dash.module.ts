import { NgModule } from '@angular/core';
import { RouterModule, type Routes } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSidenavModule } from '@angular/material/sidenav';

import { DashPageComponent } from './dash-page/dash-page.component';
import { DashHomePageComponent } from './dash-home-page/dash-home-page.component';
import { SidebarComponent } from '../components/sidebar-component/sidebar.component';
import { RoleManagementComponent } from '../components/role-management-component/role-management.component';
import { UserComponentsModule } from '../components/user-components.module';

const routes: Routes = [
  {
    path: '',
    component: DashPageComponent,
    children: [
      { path: '', component: DashHomePageComponent, title: 'Dashboard' },
      { path: 'role-management', component: RoleManagementComponent, title: 'Role Management' }
    ]
  }
];

const components: any[] = [
  DashPageComponent,
  DashHomePageComponent,
  SidebarComponent,
  RoleManagementComponent
];

// Loaded lazily behind /dash: everything in here — the Material table, sort, input, dialog, list
// and progress bar — is dead weight on the public pages, which is most of the traffic.
@NgModule({
  declarations: [components],
  imports: [
    RouterModule.forChild(routes),
    UserComponentsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatProgressBarModule,
    MatSidenavModule
  ]
})
export class DashModule { }
