import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ScrollBarComponent } from '../scroll-bar-component/scroll-bar.component';
import { askDialog } from '../../services/dialog';

export interface WheelWinnerDialogData {
  label: string;
}

export type WheelWinnerChoice = 'close' | 'remove';

@Component({
  selector: 'app-wheel-winner-dialog',
  templateUrl: './wheel-winner-dialog.component.html',
  styleUrl: './wheel-winner-dialog.component.scss',
  imports: [MatButtonModule, MatDialogModule, ScrollBarComponent],
})
export class WheelWinnerDialogComponent {

  private readonly dialogRef: MatDialogRef<WheelWinnerDialogComponent, WheelWinnerChoice> = inject<MatDialogRef<WheelWinnerDialogComponent, WheelWinnerChoice>>(MatDialogRef);

  protected readonly data: WheelWinnerDialogData = inject<WheelWinnerDialogData>(MAT_DIALOG_DATA);

  static async announce(dialog: MatDialog, label: string): Promise<WheelWinnerChoice> {
    return await askDialog<WheelWinnerDialogComponent, WheelWinnerDialogData, WheelWinnerChoice>(
      dialog, WheelWinnerDialogComponent, { label },
      { width: '26rem', minWidth: 'min(18rem, 92vw)', autoFocus: 'dialog' }) ?? 'close';
  }

  protected choose(choice: WheelWinnerChoice): void {
    this.dialogRef.close(choice);
  }
}