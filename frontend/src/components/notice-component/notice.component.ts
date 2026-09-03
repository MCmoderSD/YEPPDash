import { Component, input, InputSignal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type NoticeTone = 'neutral' | 'warning' | 'error';

@Component({
  selector: 'app-notice',
  templateUrl: './notice.component.html',
  styleUrl: './notice.component.scss',
  imports: [MatIconModule],
  host: {
    '[class.notice-warning]': "tone() === 'warning'",
    '[class.notice-error]': "tone() === 'error'",
  },
})
export class NoticeComponent {

  readonly icon: InputSignal<string> = input.required<string>();

  readonly tone: InputSignal<NoticeTone> = input<NoticeTone>('neutral');
}