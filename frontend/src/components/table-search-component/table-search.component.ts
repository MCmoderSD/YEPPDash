import { Component, input, InputSignal, output, OutputEmitterRef } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-table-search',
  templateUrl: './table-search.component.html',
  styleUrl: './table-search.component.scss',
  imports: [MatFormFieldModule, MatIconModule, MatInputModule],
})
export class TableSearchComponent {

  readonly placeholder: InputSignal<string> = input.required<string>();

  readonly query: OutputEmitterRef<string> = output<string>();
}