import { Component, input, InputSignal } from '@angular/core';

@Component({
  selector: 'app-reward-editor-skeleton',
  templateUrl: './reward-editor-skeleton.component.html',
  styleUrl: './reward-editor-skeleton.component.scss',
  host: {
    role: 'status',
    class: 'app-skeleton-appear',
  },
})
export class RewardEditorSkeletonComponent {

  readonly label: InputSignal<string> = input.required<string>();
  readonly panels: InputSignal<readonly string[]> = input.required<readonly string[]>();

  readonly statusRow: InputSignal<boolean> = input<boolean>(false);
}