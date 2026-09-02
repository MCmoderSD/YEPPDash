import { Component, computed, DestroyRef, inject, signal, Signal, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ScrollBarComponent } from '../scroll-bar-component/scroll-bar.component';

let nextHintId: number = 0;

export interface ConfirmActionDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  timeoutMs?: number;
}

@Component({
  selector: 'app-confirm-action-dialog',
  templateUrl: './confirm-action-dialog.component.html',
  styleUrl: './confirm-action-dialog.component.scss',
  imports: [MatButtonModule, MatDialogModule, ScrollBarComponent],
})
export class ConfirmActionDialogComponent {

  private readonly dialogRef: MatDialogRef<ConfirmActionDialogComponent, boolean> =
    inject<MatDialogRef<ConfirmActionDialogComponent, boolean>>(MatDialogRef);

  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  protected readonly data: ConfirmActionDialogData = inject<ConfirmActionDialogData>(MAT_DIALOG_DATA);

  private readonly isLocked: WritableSignal<boolean> = signal(false);
  private readonly secondsLeft: WritableSignal<number> = signal(0);

  protected readonly locked: Signal<boolean> = this.isLocked.asReadonly();
  protected readonly remaining: Signal<number> = this.secondsLeft.asReadonly();

  protected readonly timed: boolean = (this.data.timeoutMs ?? 0) > 0;

  protected readonly hintId: string = `confirm-action-hint-${nextHintId++}`;

  protected readonly confirmLabel: Signal<string> = computed((): string => {
    const label: string = this.data.confirmLabel ?? 'Confirm';
    return this.locked() ? `${label} (${this.remaining()})` : label;
  });

  constructor() {
    const timeout: number = this.data.timeoutMs ?? 0;
    if (timeout <= 0) return;

    this.isLocked.set(true);
    this.secondsLeft.set(Math.ceil(timeout / 1000));

    const deadline: number = Date.now() + timeout;
    const handle: ReturnType<typeof setInterval> = setInterval((): void => {
      const left: number = deadline - Date.now();

      if (left > 0) {
        this.secondsLeft.set(Math.ceil(left / 1000));
        return;
      }

      this.secondsLeft.set(0);
      this.isLocked.set(false);
      clearInterval(handle);
    }, 200);

    this.destroyRef.onDestroy((): void => clearInterval(handle));
  }

  static open(
    dialog: MatDialog, data: ConfirmActionDialogData,
  ): MatDialogRef<ConfirmActionDialogComponent, boolean> {
    return dialog.open<ConfirmActionDialogComponent, ConfirmActionDialogData, boolean>(
      ConfirmActionDialogComponent,
      {
        data,
        width: '32rem',
        minWidth: 'min(20rem, 92vw)',
        maxWidth: '92vw',
        autoFocus: 'dialog'
      },
    );
  }

  static async confirm(dialog: MatDialog, data: ConfirmActionDialogData): Promise<boolean> {
    return await firstValueFrom(this.open(dialog, data).afterClosed()) === true;
  }

  protected confirm(): void {
    if (!this.locked()) this.dialogRef.close(true);
  }

  protected cancel(): void {
    this.dialogRef.close(false);
  }
}