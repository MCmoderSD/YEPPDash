import { Component } from '@angular/core';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-dash-home-page',
  templateUrl: './dash-home-page.component.html',
  styleUrl: './dash-home-page.component.scss',
  standalone: false,
})
export class DashHomePageComponent {

  // Templates cannot reach the environment directly, so it is surfaced as a field here.
  protected readonly botUserId: string = environment.botUserId;
}
