import { Component, input, InputSignal, linkedSignal, WritableSignal } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { FaqEntry } from '../../data/faq';

@Component({
  selector: 'app-faq-entry',
  templateUrl: './faq-entry.component.html',
  styleUrl: './faq-entry.component.scss',
  imports: [MatExpansionModule, MatIconModule],
})
export class FaqEntryComponent {

  readonly entry: InputSignal<FaqEntry> = input.required<FaqEntry>();

  readonly open: InputSignal<boolean> = input(false);

  protected readonly expanded: WritableSignal<boolean> = linkedSignal((): boolean => this.open());
}