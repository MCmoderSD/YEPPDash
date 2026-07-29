import { Component } from '@angular/core';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-dash-home-page',
  templateUrl: './dash-home-page.component.html',
  styleUrl: './dash-home-page.component.scss',
  standalone: false,
})
export class DashHomePageComponent {
  protected readonly botUserId: string = environment.botUserId;
}