import { Component, input, InputSignal } from '@angular/core';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'app-status-badge',
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.scss',
  host: {
    'class': 'status-badge',
    '[class.status-badge-success]': "tone() === 'success'",
    '[class.status-badge-warning]': "tone() === 'warning'",
    '[class.status-badge-danger]': "tone() === 'danger'",
  },
})
export class StatusBadgeComponent {

  readonly label: InputSignal<string> = input.required<string>();

  readonly tone: InputSignal<BadgeTone> = input<BadgeTone>('neutral');
}