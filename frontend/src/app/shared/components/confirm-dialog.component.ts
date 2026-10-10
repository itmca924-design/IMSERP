import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface ConfirmDialogData {
  title: string;
  message: string;
  titleEn?: string;
  titleHi?: string;
  messageEn?: string;
  messageHi?: string;
  confirmText?: string;
  confirmTextEn?: string;
  confirmTextHi?: string;
  cancelText?: string;
  cancelTextEn?: string;
  cancelTextHi?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  isAlert?: boolean;
  defaultLang?: 'en' | 'hi';
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
          <h2 mat-dialog-title class="main-title">{{ currentTitle }}</h2>
          <p class="subtitle">{{ getSubtitleText() }}</p>
        </div>

        <!-- HIN / EN Switch Pills in Header -->
        <div class="lang-switch-wrap" *ngIf="hasBilingual()">
          <button 
            type="button" 
            class="lang-pill-btn" 
            [class.active]="activeLang === 'hi'" 
            (click)="setLang('hi')"
            matTooltip="हिन्दी भाषा में देखें">
            HIN
          </button>
          <button 
            type="button" 
            class="lang-pill-btn" 
            [class.active]="activeLang === 'en'" 
            (click)="setLang('en')"
            matTooltip="View in English">
            EN
          </button>
        </div>

        <button mat-icon-button type="button" class="close-btn" (click)="onCancel()" matTooltip="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Dialog Body -->
      <mat-dialog-content class="dialog-content">
        <div class="dialog-message-box">
          <!-- Inline Bilingual Lang Bar -->
          <div class="message-lang-bar" *ngIf="hasBilingual()">
            <span class="lang-indicator">
              <mat-icon>{{ activeLang === 'hi' ? 'translate' : 'language' }}</mat-icon>
              {{ activeLang === 'hi' ? 'हिन्दी विवरण (Hindi Mode)' : 'English Details (EN Mode)' }}
            </span>
            <div class="inline-lang-pills">
              <button 
                type="button" 
                class="inline-pill" 
                [class.active]="activeLang === 'hi'" 
                (click)="setLang('hi')">
                हिन्दी (HIN)
              </button>
              <button 
                type="button" 
                class="inline-pill" 
                [class.active]="activeLang === 'en'" 
                (click)="setLang('en')">
                English (EN)
              </button>
            </div>
          </div>
          <div class="dialog-message" [innerHTML]="currentMessage"></div>
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
          {{ currentCancelText }}
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
          <span>{{ currentConfirmText }}</span>
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
          font-size: 1.12rem;
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

      /* Language Switcher in Header */
      .lang-switch-wrap {
        display: inline-flex;
        align-items: center;
        background: #ffffff;
        border: 1px solid #bfdbfe;
        border-radius: 20px;
        padding: 2px;
        gap: 2px;
        flex-shrink: 0;
        box-shadow: 0 1px 3px rgba(37, 99, 235, 0.08);

        .lang-pill-btn {
          border: none;
          background: transparent;
          font-size: 0.72rem;
          font-weight: 700;
          color: #3b82f6;
          padding: 3px 10px;
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          line-height: 1.2;

          &:hover {
            color: #1e3a8a;
            background: #eff6ff;
          }

          &.active {
            background: #2563eb;
            color: #ffffff;
            box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);
          }
        }
      }

      .close-btn {
        color: #64748b;
        flex-shrink: 0;
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

    .message-lang-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #cbd5e1;

      .lang-indicator {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.76rem;
        font-weight: 600;
        color: #475569;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #2563eb;
        }
      }

      .inline-lang-pills {
        display: inline-flex;
        align-items: center;
        gap: 4px;

        .inline-pill {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          font-size: 0.72rem;
          font-weight: 700;
          color: #475569;
          padding: 2px 8px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s ease;

          &:hover {
            border-color: #93c5fd;
            color: #1e40af;
          }

          &.active {
            background: #2563eb;
            color: #ffffff;
            border-color: #2563eb;
            box-shadow: 0 1px 3px rgba(37, 99, 235, 0.2);
          }
        }
      }
    }

    .dialog-message {
      font-size: 0.92rem;
      color: #334155;
      line-height: 1.7;
      margin: 0;
      text-align: left;
      word-break: break-word;
      animation: fadeIn 0.15s ease-in-out;
    }

    @keyframes fadeIn {
      from { opacity: 0.6; transform: translateY(-1px); }
      to { opacity: 1; transform: translateY(0); }
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
export class ConfirmDialogComponent implements OnInit {
  activeLang: 'en' | 'hi' = 'hi';

  constructor(
    private dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) { }

  ngOnInit(): void {
    if (this.data.defaultLang) {
      this.activeLang = this.data.defaultLang;
    } else {
      const savedLang = localStorage.getItem('imserp_lang');
      if (savedLang === 'hi' || savedLang === 'en') {
        this.activeLang = savedLang;
      } else if (this.data.messageHi) {
        this.activeLang = 'hi';
      } else {
        this.activeLang = 'en';
      }
    }
  }

  hasBilingual(): boolean {
    return !!(this.data.messageEn && this.data.messageHi) || !!(this.data.titleEn && this.data.titleHi);
  }

  setLang(lang: 'en' | 'hi'): void {
    this.activeLang = lang;
  }

  get currentTitle(): string {
    if (this.hasBilingual()) {
      return this.activeLang === 'hi'
        ? (this.data.titleHi || this.data.title)
        : (this.data.titleEn || this.data.title);
    }
    return this.data.title;
  }

  get currentMessage(): string {
    if (this.hasBilingual()) {
      return this.activeLang === 'hi'
        ? (this.data.messageHi || this.data.message)
        : (this.data.messageEn || this.data.message);
    }
    return this.data.message;
  }

  get currentConfirmText(): string {
    if (this.hasBilingual()) {
      if (this.activeLang === 'hi') {
        return this.data.confirmTextHi || this.data.confirmText || (this.data.isAlert ? 'ठीक है (OK)' : 'स्वीकार करें');
      } else {
        return this.data.confirmTextEn || this.data.confirmText || (this.data.isAlert ? 'OK' : 'Confirm');
      }
    }
    return this.data.confirmText || (this.data.isAlert ? 'OK' : 'Confirm');
  }

  get currentCancelText(): string {
    if (this.hasBilingual()) {
      if (this.activeLang === 'hi') {
        return this.data.cancelTextHi || this.data.cancelText || 'रद्द करें';
      } else {
        return this.data.cancelTextEn || this.data.cancelText || 'Cancel';
      }
    }
    return this.data.cancelText || 'Cancel';
  }

  getIconName(): string {
    switch (this.data.type) {
      case 'danger': return 'warning';
      case 'warning': return 'warning_amber';
      case 'success': return 'check_circle';
      default: return 'help_outline';
    }
  }

  getSubtitleText(): string {
    if (this.activeLang === 'hi') {
      if (this.data.isAlert) return 'सिस्टम सूचना (System Notification)';
      switch (this.data.type) {
        case 'danger': return 'उच्च प्राथमिकता कार्रवाई पुष्टि';
        case 'warning': return 'आगे बढ़ने से पहले ध्यान दें';
        case 'success': return 'कार्रवाई सफलतापूर्वक संपन्न';
        default: return 'कृपया नीचे समीक्षा करें और पुष्टि करें';
      }
    }
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

