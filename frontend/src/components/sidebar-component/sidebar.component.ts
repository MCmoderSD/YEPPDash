import { Component, inject } from '@angular/core';
import { IsActiveMatchOptions } from '@angular/router';
import { SidebarService } from '../../services/sidebar.service';
import { RoleManagementMode } from "../role-management-component/role-management.component";

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

  protected close(): void {
    this.sidebar.close();
  }
}