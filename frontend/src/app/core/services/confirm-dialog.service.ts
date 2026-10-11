import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog.component';

export interface BilingualDialogOptions {
  titleEn: string;
  titleHi: string;
  messageEn: string;
  messageHi: string;
  confirmTextEn?: string;
  confirmTextHi?: string;
  cancelTextEn?: string;
  cancelTextHi?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
}

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
      width: '500px',
      maxWidth: '92vw',
      panelClass: 'erp-confirm-dialog-panel',
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
    type: 'danger' | 'warning' | 'info' | 'success' = 'success',
    bilingual?: Partial<BilingualDialogOptions>
  ): Observable<boolean> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '480px',
      maxWidth: '92vw',
      panelClass: 'erp-confirm-dialog-panel',
      disableClose: false,
      data: {
        title,
        message,
        titleEn: bilingual?.titleEn,
        titleHi: bilingual?.titleHi,
        messageEn: bilingual?.messageEn,
        messageHi: bilingual?.messageHi,
        confirmTextEn: bilingual?.confirmTextEn || 'OK',
        confirmTextHi: bilingual?.confirmTextHi || 'ठीक है (OK)',
        confirmText: 'OK',
        type,
        isAlert: true
      } as ConfirmDialogData
    });

    return dialogRef.afterClosed();
  }

  bilingualAlert(
    options: BilingualDialogOptions,
    defaultLang?: 'en' | 'hi'
  ): Observable<boolean> {
    const isHi = defaultLang ? defaultLang === 'hi' : (localStorage.getItem('imserp_lang') === 'hi');
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '500px',
      maxWidth: '92vw',
      panelClass: 'erp-confirm-dialog-panel',
      disableClose: false,
      data: {
        title: isHi ? options.titleHi : options.titleEn,
        message: isHi ? options.messageHi : options.messageEn,
        titleEn: options.titleEn,
        titleHi: options.titleHi,
        messageEn: options.messageEn,
        messageHi: options.messageHi,
        confirmTextEn: options.confirmTextEn || 'OK',
        confirmTextHi: options.confirmTextHi || 'ठीक है (OK)',
        confirmText: isHi ? (options.confirmTextHi || 'ठीक है (OK)') : (options.confirmTextEn || 'OK'),
        type: options.type || 'success',
        isAlert: true,
        defaultLang: defaultLang || (isHi ? 'hi' : 'en')
      } as ConfirmDialogData
    });

    return dialogRef.afterClosed();
  }

  prompt(
    title: string,
    message: string,
    options?: {
      inputLabel?: string;
      inputPlaceholder?: string;
      initialValue?: string;
      confirmText?: string;
      cancelText?: string;
      type?: 'danger' | 'warning' | 'info' | 'success';
      inputType?: 'text' | 'textarea';
    }
  ): Observable<string | null> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '520px',
      maxWidth: '92vw',
      panelClass: 'erp-confirm-dialog-panel',
      disableClose: true,
      data: {
        title,
        message,
        confirmText: options?.confirmText || 'Submit',
        cancelText: options?.cancelText || 'Cancel',
        type: options?.type || 'warning',
        isPrompt: true,
        inputLabel: options?.inputLabel || 'Reason / Remarks',
        inputPlaceholder: options?.inputPlaceholder || 'Enter remarks...',
        inputValue: options?.initialValue || '',
        inputType: options?.inputType || 'textarea'
      } as ConfirmDialogData
    });

    return dialogRef.afterClosed();
  }
}
