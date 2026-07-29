import { Component, computed, inject, signal, Signal, WritableSignal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Quote } from '../../data/quote';

// Mirrors the CHECK constraint on the Quote table, so an over-long quote is caught here rather
// than coming back as a failed request.
export const QUOTE_MAX_LENGTH = 500;

export interface QuoteEditDialogData {
  quote: Quote | null;
}

@Component({
  selector: 'app-quote-edit-dialog',
  templateUrl: './quote-edit-dialog.component.html',
  styleUrl: './quote-edit-dialog.component.scss',
  standalone: false,
})
export class QuoteEditDialogComponent {

  private readonly dialogRef: MatDialogRef<QuoteEditDialogComponent, string> =
    inject<MatDialogRef<QuoteEditDialogComponent, string>>(MatDialogRef);

  private readonly data: QuoteEditDialogData = inject<QuoteEditDialogData>(MAT_DIALOG_DATA);

  protected readonly maxLength: number = QUOTE_MAX_LENGTH;

  protected readonly editing: boolean = this.data.quote !== null;

  protected readonly title: string = this.editing ? `Edit quote ${this.data.quote!.id}` : 'Add quote';

  protected readonly text: WritableSignal<string> = signal(this.data.quote?.quote ?? '');

  protected readonly length: Signal<number> = computed((): number => this.text().length);

  protected readonly valid: Signal<boolean> = computed((): boolean => {
    const trimmed: string = this.text().trim();
    return trimmed.length > 0 && trimmed.length <= QUOTE_MAX_LENGTH;
  });

  static open(dialog: MatDialog, quote: Quote | null): MatDialogRef<QuoteEditDialogComponent, string> {
    return dialog.open<QuoteEditDialogComponent, QuoteEditDialogData, string>(QuoteEditDialogComponent, {
      data: { quote },
      width: '40rem',
      minWidth: 'min(22rem, 92vw)',
      maxWidth: '92vw',
    });
  }

  protected edit(value: string): void {
    this.text.set(value);
  }

  protected save(): void {
    if (this.valid()) this.dialogRef.close(this.text().trim());
  }
}
