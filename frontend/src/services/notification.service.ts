import { inject, Service } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

const POSITION: MatSnackBarConfig = {
  horizontalPosition: 'end',
  verticalPosition: 'bottom',
};

@Service()
export class NotificationService {

  private readonly snackBar: MatSnackBar = inject(MatSnackBar);

  success(message: string): void {
    this.snackBar.open(message, 'Dismiss', {
      ...POSITION,
      duration: 4000,
      panelClass: 'notification-success',
    });
  }

  failure(message: string): void {
    this.snackBar.open(message, 'Dismiss', {
      ...POSITION,
      duration: 8000,
      panelClass: 'notification-failure',
    });
  }
}