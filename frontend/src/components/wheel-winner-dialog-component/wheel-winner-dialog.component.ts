import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

export interface WheelWinnerDialogData {
  label: string;
}

// What the dialog was dismissed with. Removing is the common follow-up to a draw — the name that
// just won should not be able to win again — so it is offered here rather than left to be found in
// the table afterwards.
export type WheelWinnerChoice = 'close' | 'remove';

@Component({
  selector: 'app-wheel-winner-dialog',
  templateUrl: './wheel-winner-dialog.component.html',
  styleUrl: './wheel-winner-dialog.component.scss',
  standalone: false,
})
export class WheelWinnerDialogComponent {

  private readonly dialogRef: MatDialogRef<WheelWinnerDialogComponent, WheelWinnerChoice> =
    inject<MatDialogRef<WheelWinnerDialogComponent, WheelWinnerChoice>>(MatDialogRef);

  protected readonly data: WheelWinnerDialogData = inject<WheelWinnerDialogData>(MAT_DIALOG_DATA);

  static async announce(dialog: MatDialog, label: string): Promise<WheelWinnerChoice> {
    const dialogRef = dialog.open<WheelWinnerDialogComponent, WheelWinnerDialogData, WheelWinnerChoice>(
      WheelWinnerDialogComponent,
      {
        data: { label },
        width: '26rem',
        minWidth: 'min(18rem, 92vw)',
        maxWidth: '92vw',
        autoFocus: 'dialog',
      },
    );

    // Escape and the backdrop both count as closing, which is the harmless one of the two.
    return await firstValueFrom(dialogRef.afterClosed()) ?? 'close';
  }

  protected choose(choice: WheelWinnerChoice): void {
    this.dialogRef.close(choice);
  }
}
