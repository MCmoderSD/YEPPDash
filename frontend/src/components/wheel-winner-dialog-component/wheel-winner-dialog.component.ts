import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

export interface WheelWinnerDialogData {
  label: string;
}

export type WheelWinnerChoice = 'close' | 'remove';

@Component({
  selector: 'app-wheel-winner-dialog',
  templateUrl: './wheel-winner-dialog.component.html',
  styleUrl: './wheel-winner-dialog.component.scss',
  standalone: false,
})
export class WheelWinnerDialogComponent {

  private readonly dialogRef: MatDialogRef<WheelWinnerDialogComponent, WheelWinnerChoice> = inject<MatDialogRef<WheelWinnerDialogComponent, WheelWinnerChoice>>(MatDialogRef);

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

    return await firstValueFrom(dialogRef.afterClosed()) ?? 'close';
  }

  protected choose(choice: WheelWinnerChoice): void {
    this.dialogRef.close(choice);
  }
}