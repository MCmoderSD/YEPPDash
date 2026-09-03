import { Component, input, InputSignal } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'app-busy-bar',
  templateUrl: './busy-bar.component.html',
  styleUrl: './busy-bar.component.scss',
  imports: [MatProgressBarModule],
  host: {
    '[attr.aria-hidden]': '!busy()',
    '[style.visibility]': "busy() ? 'visible' : 'hidden'",
  },
})
export class BusyBarComponent {
  readonly busy: InputSignal<boolean> = input<boolean>(false);
}