import { Component, input, InputSignal } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';

export interface FaqEntry {
  readonly question: string;
  readonly answer: string;
  readonly details: readonly string[];
  readonly link?: FaqLink;
}

interface FaqLink {
  readonly label: string;
  readonly url: string;
}

@Component({
  selector: 'app-faq-entry',
  templateUrl: './faq-entry.component.html',
  styleUrl: './faq-entry.component.scss',
  imports: [MatExpansionModule, MatIconModule],
})
export class FaqEntryComponent {

  readonly entry: InputSignal<FaqEntry> = input.required<FaqEntry>();
}