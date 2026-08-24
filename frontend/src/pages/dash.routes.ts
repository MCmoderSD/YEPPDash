import { type Routes } from '@angular/router';

import { DashPageComponent } from './dash-page/dash-page.component';
import { DashHomePageComponent } from './dash-home-page/dash-home-page.component';
import { BdsmPageComponent } from './bdsm-page/bdsm-page.component';
import { CommunityPageComponent } from './community-page/community-page.component';
import { RaidPageComponent } from './raid-page/raid-page.component';
import { CommandPageComponent } from './command-page/command-page.component';
import { WheelPageComponent } from './wheel-page/wheel-page.component';
import { TimerPageComponent } from './timer-page/timer-page.component';
import { RoleManagementComponent } from '../components/role-management-component/role-management.component';
import { QuoteManagementComponent } from '../components/quote-management-component/quote-management.component';
import { BirthdayListComponent } from '../components/birthday-list-component/birthday-list.component';

export const DASH_ROUTES: Routes = [
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
      { path: 'raids', component: RaidPageComponent, title: 'Raid Overview' },
      { path: 'wheel', component: WheelPageComponent, title: 'Lucky Wheel' },
      { path: 'timer', component: TimerPageComponent, title: 'Subathon Timer' },
      { path: 'bdsm', component: BdsmPageComponent, title: 'BDSM Test' }
    ]
  }
];