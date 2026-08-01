import { NgModule } from '@angular/core';
import { RouterModule, type Routes } from '@angular/router';
import { DatePipe, NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';

import { DashPageComponent } from './dash-page/dash-page.component';
import { DashHomePageComponent } from './dash-home-page/dash-home-page.component';
import { BdsmPageComponent } from './bdsm-page/bdsm-page.component';
import { BdsmResultComponent } from '../components/bdsm-result-component/bdsm-result.component';
import { CommunityPageComponent } from './community-page/community-page.component';
import { CommandPageComponent } from './command-page/command-page.component';
import { CommandTableComponent } from '../components/command-table-component/command-table.component';
import { CommandEditComponent } from '../components/command-edit-component/command-edit.component';
import { SidebarComponent } from '../components/sidebar-component/sidebar.component';
import { RoleManagementComponent } from '../components/role-management-component/role-management.component';
import { QuoteManagementComponent } from '../components/quote-management-component/quote-management.component';
import { BirthdayListComponent } from '../components/birthday-list-component/birthday-list.component';
import { QuoteEditDialogComponent } from '../components/quote-edit-dialog-component/quote-edit-dialog.component';
import { ConfirmActionDialogComponent } from '../components/confirm-action-dialog-component/confirm-action-dialog.component';
import { BotManageComponent } from '../components/bot-manage-component/bot-manage.component';
import { BadgeComponent } from '../components/badge-component/badge.component';
import { UserBadgesComponent } from '../components/user-badges-component/user-badges.component';
import { ScrollBarComponent } from '../components/scroll-bar-component/scroll-bar.component';
import { LocaleDatePipe } from '../pipes/locale-date.pipe';
import { UserComponentsModule } from '../components/user-components.module';

const routes: Routes = [
  {
    path: '',
    component: DashPageComponent,
    children: [
      { path: '', component: DashHomePageComponent, title: 'Dashboard' },
      { path: 'role-management', component: RoleManagementComponent, title: 'Role Management' },
      { path: 'quotes', component: QuoteManagementComponent, title: 'Quote Management' },
      { path: 'commands', component: CommandPageComponent, title: 'Custom Commands' },
      { path: 'birthdays', component: BirthdayListComponent, title: 'Follower Birthdays' },
      { path: 'community', component: CommunityPageComponent, title: 'Community' },
      { path: 'bdsm', component: BdsmPageComponent, title: 'BDSM Test' }
    ]
  }
];

const components: any[] = [
  DashPageComponent,
  DashHomePageComponent,
  BdsmPageComponent,
  BdsmResultComponent,
  SidebarComponent,
  RoleManagementComponent,
  QuoteManagementComponent,
  CommandPageComponent,
  CommandTableComponent,
  CommandEditComponent,
  BirthdayListComponent,
  CommunityPageComponent,
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
    BadgeComponent,
    UserBadgesComponent,
    ScrollBarComponent,
    LocaleDatePipe,
    DatePipe,
    NgOptimizedImage,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSidenavModule,
    MatSlideToggleModule,
    MatSortModule,
    MatTableModule,
    MatTabsModule
  ]
})
export class DashModule { }
