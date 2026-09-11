import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  isAlert?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="confirm-dialog-container" [ngClass]="data.type || 'info'">
      <div class="dialog-icon-wrapper">
        <div class="icon-circle">
          <mat-icon>{{ getIconName() }}</mat-icon>
        </div>
      </div>

      <h2 mat-dialog-title class="dialog-title">{{ data.title }}</h2>

      <mat-dialog-content class="dialog-content">
        <p class="dialog-message">{{ data.message }}</p>
      </mat-dialog-content>

      <mat-dialog-actions align="center" class="dialog-actions">
        <button
          *ngIf="!data.isAlert"
          mat-stroked-button
          type="button"
          class="cancel-btn"
          (click)="onCancel()">
          {{ data.cancelText || 'Cancel' }}
        </button>

        <button
          mat-raised-button
          [color]="getButtonColor()"
          type="button"
          class="confirm-btn"
          (click)="onConfirm()">
          {{ data.confirmText || (data.isAlert ? 'OK' : 'Confirm') }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .confirm-dialog-container {
      padding: 20px 16px 8px 16px;
      text-align: center;
      border-radius: 12px;

      &.danger {
        .icon-circle { background-color: #fee2e2; color: #dc2626; }
      }
      &.warning {
        .icon-circle { background-color: #ffedd5; color: #ea580c; }
      }
      &.info {
        .icon-circle { background-color: #e0f2fe; color: #0284c7; }
      }
      &.success {
        .icon-circle { background-color: #dcfce7; color: #16a34a; }
      }
    }
    .dialog-icon-wrapper {
      display: flex;
      justify-content: center;
      margin-bottom: 12px;

      .icon-circle {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;

        mat-icon {
          font-size: 32px;
          width: 32px;
          height: 32px;
        }
      }
    }
    .dialog-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 8px 0;
      padding: 0;
    }
    .dialog-content {
      padding: 0 12px;
      margin-bottom: 16px;
    }
    .dialog-message {
      font-size: 0.92rem;
      color: #475569;
      line-height: 1.5;
      margin: 0;
    }
    .dialog-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      padding-bottom: 8px;

      button {
        min-width: 110px;
        border-radius: 6px;
        font-weight: 600;
      }
    }
  `]
})
export class ConfirmDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}

  getIconName(): string {
    switch (this.data.type) {
      case 'danger': return 'delete_forever';
      case 'warning': return 'warning_amber';
      case 'success': return 'check_circle';
      default: return 'help_outline';
    }
  }

  getButtonColor(): string {
    switch (this.data.type) {
      case 'danger': return 'warn';
      case 'success': return 'primary';
      default: return 'primary';
    }
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
