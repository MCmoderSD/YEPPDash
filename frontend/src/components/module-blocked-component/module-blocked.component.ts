import { Component, input, InputSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { OVERVIEW_PATH } from '../../data/dash-nav';

@Component({
  selector: 'app-module-blocked',
  templateUrl: './module-blocked.component.html',
  styleUrl: './module-blocked.component.scss',
  imports: [RouterLink, MatIconModule],
})
export class ModuleBlockedComponent {

  readonly heading: InputSignal<string> = input.required<string>();
  readonly reason: InputSignal<string> = input.required<string>();

  readonly icon: InputSignal<string> = input<string>('lock');
  readonly mask: InputSignal<string> = input<string>('');
  readonly label: InputSignal<string> = input<string>('Unavailable');
  readonly note: InputSignal<string> = input<string>('');

  protected readonly overviewPath: string = OVERVIEW_PATH;
}