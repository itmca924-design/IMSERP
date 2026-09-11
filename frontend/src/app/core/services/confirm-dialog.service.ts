import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class ConfirmDialogService {
  constructor(private dialog: MatDialog) {}

  confirm(
    title: string,
    message: string,
    confirmText: string = 'Confirm',
    cancelText: string = 'Cancel',
    type: 'danger' | 'warning' | 'info' | 'success' = 'info'
  ): Observable<boolean> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      disableClose: true,
      data: {
        title,
        message,
        confirmText,
        cancelText,
        type,
        isAlert: false
      } as ConfirmDialogData
    });

    return dialogRef.afterClosed();
  }

  danger(
    title: string,
    message: string,
    confirmText: string = 'Delete'
  ): Observable<boolean> {
    return this.confirm(title, message, confirmText, 'Cancel', 'danger');
  }

  alert(
    title: string,
    message: string,
    type: 'danger' | 'warning' | 'info' | 'success' = 'success'
  ): Observable<boolean> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      disableClose: false,
      data: {
        title,
        message,
        confirmText: 'OK',
        type,
        isAlert: true
      } as ConfirmDialogData
    });

    return dialogRef.afterClosed();
  }
}
