import { Component, input, InputSignal } from '@angular/core';
import { ScrollBarComponent } from '../scroll-bar-component/scroll-bar.component';

@Component({
  selector: 'app-table-frame',
  templateUrl: './table-frame.component.html',
  styleUrl: './table-frame.component.scss',
  imports: [ScrollBarComponent],
})
export class TableFrameComponent {
  readonly maxHeight: InputSignal<string | null> = input<string | null>(null);
}