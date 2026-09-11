import { Component, input, InputSignal, output, OutputEmitterRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FaqEntryComponent } from '../faq-entry-component/faq-entry.component';
import { FaqSection } from '../../data/faq';

@Component({
  selector: 'app-faq-list',
  templateUrl: './faq-list.component.html',
  styleUrl: './faq-list.component.scss',
  imports: [MatButtonModule, MatIconModule, FaqEntryComponent],
})
export class FaqListComponent {

  readonly sections: InputSignal<readonly FaqSection[]> = input.required<readonly FaqSection[]>();

  readonly view: InputSignal<string> = input('all');
  readonly headings: InputSignal<boolean> = input(true);
  readonly open: InputSignal<string | null> = input<string | null>(null);
  readonly search: InputSignal<string> = input('');

  readonly cleared: OutputEmitterRef<void> = output<void>();
}