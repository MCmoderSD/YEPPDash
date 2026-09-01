import { Component, computed, input, InputSignal, Signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

interface ErrorCopy {
  icon: string;
  heading: string;
  body: string;
}

const COPY: Readonly<Record<number, ErrorCopy>> = {
  404: {
    icon: 'travel_explore',
    heading: 'This page does not exist',
    body: 'The address may have a typo in it, or it may point at something that has since been '
      + 'renamed or removed.',
  },
};

const FALLBACK: ErrorCopy = {
  icon: 'error_outline',
  heading: 'Something went wrong',
  body: 'The page could not be shown. Trying again in a moment is usually enough.',
};

@Component({
  selector: 'app-error-page',
  templateUrl: './error-page.component.html',
  styleUrl: './error-page.component.scss',
  imports: [RouterLink, MatIconModule],
})
export class ErrorPageComponent {

  readonly status: InputSignal<number> = input(404);

  protected readonly copy: Signal<ErrorCopy> = computed((): ErrorCopy => COPY[this.status()] ?? FALLBACK);
}