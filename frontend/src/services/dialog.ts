import { ComponentType } from '@angular/cdk/portal';
import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

export interface DialogOptions {
  width: string;
  minWidth?: string;
  maxWidth?: string;
  maxHeight?: string;
  autoFocus?: MatDialogConfig['autoFocus'];
}

const DEFAULT_MIN_WIDTH: string = 'min(22rem, 92vw)';
const DEFAULT_MAX_WIDTH: string = '92vw';

export function openDialog<C, D, R>(
  dialog: MatDialog, component: ComponentType<C>, data: D, options: DialogOptions,
): MatDialogRef<C, R> {
  return dialog.open<C, D, R>(component, {
    data,
    width: options.width,
    minWidth: options.minWidth ?? DEFAULT_MIN_WIDTH,
    maxWidth: options.maxWidth ?? DEFAULT_MAX_WIDTH,
    maxHeight: options.maxHeight,
    autoFocus: options.autoFocus,
  });
}

export function askDialog<C, D, R>(dialog: MatDialog, component: ComponentType<C>, data: D, options: DialogOptions): Promise<R | undefined> {
  return firstValueFrom(openDialog<C, D, R>(dialog, component, data, options).afterClosed());
}