import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, inject, input, InputSignal } from '@angular/core';

const TRANSPARENT: string = 'app-transparent';

@Component({
  selector: 'app-overlay-frame',
  templateUrl: './overlay-frame.component.html',
  styleUrl: './overlay-frame.component.scss',
})
export class OverlayFrameComponent {

  readonly winner: InputSignal<string | null> = input<string | null>(null);

  readonly hint: InputSignal<string | null> = input<string | null>(null);

  constructor() {
    const root: HTMLElement = inject(DOCUMENT).documentElement;
    root.classList.add(TRANSPARENT);
    inject(DestroyRef).onDestroy((): void => root.classList.remove(TRANSPARENT));
  }
}