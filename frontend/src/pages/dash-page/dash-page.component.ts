import { Component, inject } from '@angular/core';
import { SidebarService } from '../../services/sidebar.service';

@Component({
  selector: 'app-dash-page',
  templateUrl: './dash-page.component.html',
  styleUrl: './dash-page.component.scss',
  standalone: false,
})
export class DashPageComponent {
  protected readonly sidebar: SidebarService = inject(SidebarService);
}