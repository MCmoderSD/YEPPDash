import { Component, computed, input, InputSignal, output, OutputEmitterRef, Signal } from '@angular/core';

@Component({
  selector: 'app-number-stepper',
  template: `
    <!--
      Out of the tab order on purpose, exactly like the native arrows these replace. A number input
      already increments on ArrowUp and ArrowDown, so nothing here is the only way to reach a
      function - making them focusable would only put two extra stops in front of the next field.
      This is what separates them from the colour swatch beside them, which opens a picker that has
      no keyboard equivalent and therefore does have to be reachable.
    -->
    <button
      type="button"
      tabindex="-1"
      aria-label="Increase"
      [disabled]="atMax()"
      (click)="nudge(1)"
    >
      <svg viewBox="0 0 10 6" aria-hidden="true" focusable="false">
        <path d="M1 5 5 1l4 4" />
      </svg>
    </button>

    <button
      type="button"
      tabindex="-1"
      aria-label="Decrease"
      [disabled]="atMin()"
      (click)="nudge(-1)"
    >
      <svg viewBox="0 0 10 6" aria-hidden="true" focusable="false">
        <path d="M1 1 5 5l4-4" />
      </svg>
    </button>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;

      // Clear of the field's own outline, which the suffix would otherwise sit against.
      margin-inline-end: 0.25rem;
    }

    button {
      display: flex;
      align-items: center;
      justify-content: center;

      // Two of these stack inside a form field's suffix, so the pair has to stay under the row
      // height the field would have had without them.
      inline-size: 1.5rem;
      block-size: 1.125rem;

      padding: 0;
      border: none;
      border-radius: var(--app-radius-sm);
      background: none;

      color: var(--mat-sys-outline);
      cursor: pointer;

      transition: color var(--app-timing-fast), background var(--app-timing-fast);
    }

    // The same lift the rest of the app uses for a hovered control, so a chevron this small still
    // has a target the pointer can find rather than only a colour change to go by.
    button:hover:not(:disabled) {
      background: var(--app-tint-hover);
      color: var(--mat-sys-primary);
    }

    button:active:not(:disabled) {
      background: var(--app-tint-pressed);
    }

    // Dimmed rather than hidden: a chevron that disappears at the limit moves the other one, and
    // the field would twitch every time the value reached its bound.
    button:disabled {
      color: var(--mat-sys-outline-variant);
      cursor: default;
    }

    svg {
      inline-size: 0.75rem;

      fill: none;
      stroke: currentColor;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
})
export class NumberStepperComponent {

  readonly value: InputSignal<number> = input.required<number>();
  readonly min: InputSignal<number> = input(Number.NEGATIVE_INFINITY);
  readonly max: InputSignal<number> = input(Number.POSITIVE_INFINITY);
  readonly step: InputSignal<number> = input(1);

  readonly valueChange: OutputEmitterRef<number> = output<number>();

  protected readonly atMin: Signal<boolean> = computed((): boolean => this.value() <= this.min());
  protected readonly atMax: Signal<boolean> = computed((): boolean => this.value() >= this.max());

  protected nudge(direction: number): void {
    const stepped: number = this.value() + direction * this.step();

    this.valueChange.emit(Math.min(this.max(), Math.max(this.min(), stepped)));
  }
}
