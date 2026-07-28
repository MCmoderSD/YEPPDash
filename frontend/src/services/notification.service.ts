import { inject, Service } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

// Bottom right, out of the way of the content — the same corner for every confirmation so the eye
// learns where to look.
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

  // Failures stay twice as long: they usually carry something the user has to act on, and losing
  // that after four seconds means losing the only explanation of what went wrong.
  failure(message: string): void {
    this.snackBar.open(message, 'Dismiss', {
      ...POSITION,
      duration: 8000,
      panelClass: 'notification-failure',
    });
  }
}
