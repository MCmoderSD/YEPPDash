import { Component, inject } from '@angular/core';
import { IsActiveMatchOptions } from '@angular/router';
import { SidebarService } from '../../services/sidebar.service';
import { RoleManagementMode } from '../../data/role-management-mode';

// Both entries point at the same path and differ only in ?mode=, so the active one can only be
// told apart by comparing query parameters as well.
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

  // Exposed so the template can write RoleManagementMode.Moderator/.Vip directly into
  // [queryParams] instead of retyping the raw 0/1 (or the old 'moderator'/'vip' strings) by hand.
  protected readonly Mode = RoleManagementMode;

  protected close(): void {
    this.sidebar.close();
  }
}