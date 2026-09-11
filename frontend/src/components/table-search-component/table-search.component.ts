import {
  afterRenderEffect,
  Component,
  ElementRef,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
  viewChild,
} from '@angular/core';
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

  readonly value: InputSignal<string> = input('');

  readonly query: OutputEmitterRef<string> = output<string>();

  private readonly box: Signal<ElementRef<HTMLInputElement> | undefined> =
    viewChild('search', { read: ElementRef<HTMLInputElement> });

  constructor() {
    afterRenderEffect((): void => {
      const box: HTMLInputElement | undefined = this.box()?.nativeElement;
      const wanted: string = this.value();

      if (box && box.value.trim() !== wanted) box.value = wanted;
    });
  }
}