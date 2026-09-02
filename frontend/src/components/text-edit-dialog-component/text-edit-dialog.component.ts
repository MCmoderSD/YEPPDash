import { Component, computed, inject, Signal, signal, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';
import { ResizeGripComponent, RESIZE_GRIP_SIZE } from '../resize-grip-component/resize-grip.component';
import { ScrollBarComponent } from '../scroll-bar-component/scroll-bar.component';

export interface TextEditDialogData {
  title: string;
  label: string;
  maxLength: number;
  text?: string;
  confirmLabel?: string;
  hint?: string;
  multiline?: boolean;
  rows?: number;
  problem?: (text: string) => string | null;
}

@Component({
  selector: 'app-text-edit-dialog',
  templateUrl: './text-edit-dialog.component.html',
  styleUrl: './text-edit-dialog.component.scss',
  imports: [MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, ScrollBarComponent, ResizeGripComponent],
})
export class TextEditDialogComponent {

  private readonly dialogRef: MatDialogRef<TextEditDialogComponent, string> = inject<MatDialogRef<TextEditDialogComponent, string>>(MatDialogRef);

  protected readonly data: TextEditDialogData = inject<TextEditDialogData>(MAT_DIALOG_DATA);

  protected readonly gripSize: number = RESIZE_GRIP_SIZE;

  protected readonly multiline: boolean = this.data.multiline ?? true;

  protected readonly rows: number = this.data.rows ?? 5;

  protected readonly confirmLabel: string = this.data.confirmLabel ?? 'Save';

  private readonly initial: string = this.data.text ?? '';

  protected readonly text: WritableSignal<string> = signal(this.initial);

  protected readonly length: Signal<number> = computed((): number => this.text().length);

  protected readonly problem: Signal<string | null> = computed((): string | null => {
    const trimmed: string = this.text().trim();
    if (trimmed.length === 0) return null;

    if (trimmed.length > this.data.maxLength) {
      return `That is ${trimmed.length} characters — the limit is ${this.data.maxLength}.`;
    }

    return this.data.problem?.(trimmed) ?? null;
  });

  protected readonly changed: Signal<boolean> = computed((): boolean => this.text().trim() !== this.initial.trim());
  protected readonly canSave: Signal<boolean> = computed((): boolean => this.text().trim().length > 0 && this.problem() === null && this.changed());

  static ask(dialog: MatDialog, data: TextEditDialogData): Promise<string | undefined> {
    return firstValueFrom(dialog.open<TextEditDialogComponent, TextEditDialogData, string>(TextEditDialogComponent, {
      data,
      width: '40rem',
      minWidth: 'min(22rem, 92vw)',
      maxWidth: '92vw'
    }).afterClosed());
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