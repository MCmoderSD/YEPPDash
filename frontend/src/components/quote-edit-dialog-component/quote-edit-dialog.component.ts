import { Component, computed, inject, signal, Signal, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ResizeGripComponent, RESIZE_GRIP_SIZE } from '../resize-grip-component/resize-grip.component';
import { ScrollBarComponent } from '../scroll-bar-component/scroll-bar.component';
import { Quote } from '../../data/quote';

export const QUOTE_MAX_LENGTH: number = 500;

export interface QuoteEditDialogData {
  quote: Quote | null;
}

@Component({
  selector: 'app-quote-edit-dialog',
  templateUrl: './quote-edit-dialog.component.html',
  styleUrl: './quote-edit-dialog.component.scss',
  imports: [MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, ScrollBarComponent, ResizeGripComponent],
})
export class QuoteEditDialogComponent {

  private readonly dialogRef: MatDialogRef<QuoteEditDialogComponent, string> = inject<MatDialogRef<QuoteEditDialogComponent, string>>(MatDialogRef);

  private readonly data: QuoteEditDialogData = inject<QuoteEditDialogData>(MAT_DIALOG_DATA);

  protected readonly maxLength: number = QUOTE_MAX_LENGTH;

  // How much of the textarea's trailing corner the scroll bar has to leave to the resize grip
  // drawn into it.
  protected readonly gripSize: number = RESIZE_GRIP_SIZE;

  protected readonly editing: boolean = this.data.quote !== null;

  protected readonly title: string = this.editing ? `Edit quote ${this.data.quote!.id}` : 'Add quote';

  protected readonly text: WritableSignal<string> = signal(this.data.quote?.quote ?? '');

  protected readonly length: Signal<number> = computed((): number => this.text().length);

  protected readonly valid: Signal<boolean> = computed((): boolean => {
    const trimmed: string = this.text().trim();
    return trimmed.length > 0 && trimmed.length <= QUOTE_MAX_LENGTH;
  });

  protected readonly changed: Signal<boolean> = computed((): boolean => {
    return this.text().trim() !== (this.data.quote?.quote ?? '').trim();
  });

  protected readonly canSave: Signal<boolean> = computed((): boolean => this.valid() && this.changed());

  static open(dialog: MatDialog, quote: Quote | null): MatDialogRef<QuoteEditDialogComponent, string> {
    return dialog.open<QuoteEditDialogComponent, QuoteEditDialogData, string>(QuoteEditDialogComponent, {
      data: { quote },
      width: '40rem',
      minWidth: 'min(22rem, 92vw)',
      maxWidth: '92vw'
    });
  }

  protected edit(value: string): void {
    this.text.set(value);
  }

  protected save(): void {
    if (this.canSave()) this.dialogRef.close(this.text().trim());
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}