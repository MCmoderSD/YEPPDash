import { Component, inject } from '@angular/core';
import { IsActiveMatchOptions } from '@angular/router';
import { SidebarService } from '../../services/sidebar.service';
import { RoleManagementMode } from "../role-management-component/role-management.component";
import { isDashHost } from '../../services/dash-host';

const ACTIVE_MATCH: IsActiveMatchOptions = {
  paths: 'exact',
  queryParams: 'exact',
  matrixParams: 'ignored',
  fragment: 'ignored',
};

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  standalone: false,
})
export class SidebarComponent {

  private readonly sidebar: SidebarService = inject(SidebarService);

  protected readonly activeMatch: IsActiveMatchOptions = ACTIVE_MATCH;

  protected readonly Mode = RoleManagementMode;

  protected readonly roleManagementPath: string = isDashHost() ? '/role-management' : '/dash/role-management';

  protected readonly quoteManagementPath: string = isDashHost() ? '/quotes' : '/dash/quotes';

  protected readonly commandPath: string = isDashHost() ? '/commands' : '/dash/commands';

  protected readonly birthdayListPath: string = isDashHost() ? '/birthdays' : '/dash/birthdays';

  protected readonly communityPath: string = isDashHost() ? '/community' : '/dash/community';

  protected readonly wheelPath: string = isDashHost() ? '/wheel' : '/dash/wheel';

  protected readonly bdsmPath: string = isDashHost() ? '/bdsm' : '/dash/bdsm';

  protected close(): void {
    this.sidebar.close();
  }
}