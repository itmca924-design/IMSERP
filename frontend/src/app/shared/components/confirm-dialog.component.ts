import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

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
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <div class="dialog-wrapper" [ngClass]="data.type || 'info'">
      <!-- Strict Light Blue Gradient Header matching AGENTS.md rule -->
      <div class="dialog-header">
        <div class="header-icon-wrap" [ngClass]="data.type || 'info'">
          <mat-icon>{{ getIconName() }}</mat-icon>
        </div>
        <div class="header-titles">
          <h2 mat-dialog-title class="main-title">{{ data.title }}</h2>
          <p class="subtitle">{{ getSubtitleText() }}</p>
        </div>
        <button mat-icon-button type="button" class="close-btn" (click)="onCancel()" matTooltip="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Dialog Body -->
      <mat-dialog-content class="dialog-content">
        <div class="dialog-message-box">
          <p class="dialog-message">{{ data.message }}</p>
        </div>
      </mat-dialog-content>

      <!-- Dialog Footer Actions -->
      <mat-dialog-actions align="end" class="dialog-actions">
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
          [ngClass]="data.type || 'info'"
          (click)="onConfirm()">
          <mat-icon *ngIf="data.type === 'danger'">delete_outline</mat-icon>
          <mat-icon *ngIf="data.type !== 'danger'">check</mat-icon>
          <span>{{ data.confirmText || (data.isAlert ? 'OK' : 'Confirm') }}</span>
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-wrapper {
      display: flex;
      flex-direction: column;
      background: #ffffff;
      padding: 0;
      box-sizing: border-box;
      width: 100%;
    }

    /* Strict Light Blue Gradient Header matching AGENTS.md rule */
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 18px 24px;
      display: flex;
      align-items: center;
      gap: 14px;

      .header-icon-wrap {
        width: 42px;
        height: 42px;
        border-radius: 10px;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);

        mat-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
        }

        &.danger {
          background: #dc2626;
          box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.25);
        }
        &.warning {
          background: #ea580c;
          box-shadow: 0 4px 6px -1px rgba(234, 88, 12, 0.25);
        }
        &.success {
          background: #16a34a;
          box-shadow: 0 4px 6px -1px rgba(22, 163, 74, 0.25);
        }
      }

      .header-titles {
        flex: 1 1 auto;
        min-width: 0;

        .main-title {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.3;
        }

        .subtitle {
          margin: 2px 0 0;
          font-size: 0.78rem;
          color: #3b82f6;
          font-weight: 500;
        }
      }

      .close-btn {
        color: #64748b;
        &:hover {
          color: #1e293b;
        }
      }
    }

    /* Dialog Content with Line Breaks & Structured Text */
    .dialog-content {
      padding: 20px 24px;
      max-height: 70vh;
      overflow-y: auto;
      margin: 0;
    }

    .dialog-message-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px 18px;
    }

    .dialog-message {
      font-size: 0.92rem;
      color: #334155;
      line-height: 1.7;
      margin: 0;
      white-space: pre-line;
      text-align: left;
      word-break: break-word;
    }

    /* Actions */
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 14px 24px 18px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      margin: 0;

      button {
        min-width: 100px;
        height: 40px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.88rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      .cancel-btn {
        color: #475569;
        border-color: #cbd5e1;
      }

      .confirm-btn {
        &.danger {
          background-color: #dc2626 !important;
          color: #ffffff !important;
        }
      }
    }
  `]
})
export class ConfirmDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) { }

  getIconName(): string {
    switch (this.data.type) {
      case 'danger': return 'warning';
      case 'warning': return 'warning_amber';
      case 'success': return 'check_circle';
      default: return 'help_outline';
    }
  }

  getSubtitleText(): string {
    if (this.data.isAlert) return 'System Notification';
    switch (this.data.type) {
      case 'danger': return 'High-Priority Action Confirmation';
      case 'warning': return 'Attention Required Before Proceeding';
      case 'success': return 'Action Confirmation';
      default: return 'Please review and confirm below';
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
