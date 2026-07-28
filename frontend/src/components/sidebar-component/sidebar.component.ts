import { Component } from '@angular/core';
import { IsActiveMatchOptions } from '@angular/router';

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

  protected readonly activeMatch: IsActiveMatchOptions = ACTIVE_MATCH;
}
