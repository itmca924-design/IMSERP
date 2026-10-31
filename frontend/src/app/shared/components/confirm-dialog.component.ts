import { Component, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

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
  isPrompt?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  inputValue?: string;
  inputType?: 'text' | 'textarea';
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule
  ],
  template: `
    <div class="dialog-wrapper" [ngClass]="data.type || 'info'">
      <!-- Strict Sharp Light Blue Gradient Header matching AGENTS.md rule -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-wrap" [ngClass]="data.type || 'info'">
            <mat-icon>{{ getIconName() }}</mat-icon>
          </div>
          <div class="header-titles">
            <h2 mat-dialog-title class="main-title">{{ currentTitle }}</h2>
            <p class="subtitle">{{ getSubtitleText() }}</p>
          </div>
        </div>
    
        <div class="header-right-actions">
          <!-- HIN / EN Switch Pills in Header -->
          @if (hasBilingual()) {
            <div class="lang-switch-wrap">
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
          }
    
          <button type="button" class="close-btn" (click)="onCancel()" aria-label="Close dialog">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>
    
      <!-- Dialog Body -->
      <mat-dialog-content class="dialog-content">
        <div class="dialog-message-box">
          <!-- Inline Bilingual Lang Bar -->
          @if (hasBilingual()) {
            <div class="message-lang-bar">
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
          }
          <div class="dialog-message" [innerHTML]="currentMessage"></div>
        </div>
    
        <!-- Material Standard Prompt Input Field -->
        @if (data.isPrompt) {
          <div class="prompt-field-wrap">
            <mat-form-field appearance="outline" class="prompt-form-field" subscriptSizing="dynamic">
              <mat-label>{{ data.inputLabel || 'Reason / Remarks' }}</mat-label>
              @if (data.inputType === 'textarea') {
                <textarea
                  matInput
                  rows="3"
                  [(ngModel)]="promptValue"
                  [placeholder]="data.inputPlaceholder || 'Enter remarks...'">
                </textarea>
              }
              @if (data.inputType !== 'textarea') {
                <input
                  matInput
                  [(ngModel)]="promptValue"
                  [placeholder]="data.inputPlaceholder || 'Enter remarks...'"
                  (keyup.enter)="onConfirm()" />
              }
              <mat-icon matPrefix>edit_note</mat-icon>
            </mat-form-field>
          </div>
        }
      </mat-dialog-content>
    
      <!-- Dialog Footer Actions -->
      <mat-dialog-actions align="end" class="dialog-actions">
        @if (!data.isAlert) {
          <button
            mat-stroked-button
            type="button"
            class="cancel-btn"
            (click)="onCancel()">
            {{ currentCancelText }}
          </button>
        }
    
        <button
          mat-raised-button
          [color]="getButtonColor()"
          type="button"
          class="confirm-btn"
          [ngClass]="data.type || 'info'"
          (click)="onConfirm()">
          @if (data.type === 'danger') {
            <mat-icon>delete_outline</mat-icon>
          }
          @if (data.type !== 'danger') {
            <mat-icon>check</mat-icon>
          }
          <span>{{ currentConfirmText }}</span>
        </button>
      </mat-dialog-actions>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .dialog-wrapper {
      display: flex;
      flex-direction: column;
      background: #ffffff;
      padding: 0;
      box-sizing: border-box;
      width: 100%;
    }

    /* Strict Sharp Light Blue Gradient Header matching AGENTS.md rule */
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1.5px solid #bfdbfe;
      padding: 12px 14px 12px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;

      .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1 1 auto;
        min-width: 0;
      }

      .header-icon-wrap {
        width: 38px;
        height: 38px;
        border-radius: 8px;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);

        mat-icon {
          font-size: 22px;
          width: 22px;
          height: 22px;
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
          font-size: 1.14rem;
          font-weight: 700;
          color: #1e3a8a;
          letter-spacing: -0.01em;
          line-height: 1.25;
        }

        .subtitle {
          margin: 2px 0 0;
          font-size: 0.76rem;
          color: #2563eb;
          font-weight: 600;
          line-height: 1.2;
        }
      }

      .header-right-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
        margin-left: auto;
      }

      /* Language Switcher in Header */
      .lang-switch-wrap {
        display: inline-flex;
        align-items: center;
        background: #ffffff;
        border: 1px solid #bfdbfe;
        border-radius: 6px;
        padding: 2px;
        gap: 2px;
        box-shadow: 0 1px 2px rgba(37, 99, 235, 0.06);

        .lang-pill-btn {
          border: none;
          background: transparent;
          font-size: 0.7rem;
          font-weight: 700;
          color: #3b82f6;
          padding: 2px 8px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
          line-height: 1.2;

          &:hover {
            color: #1e3a8a;
            background: #eff6ff;
          }

          &.active {
            background: #2563eb;
            color: #ffffff;
            box-shadow: 0 1px 3px rgba(37, 99, 235, 0.25);
          }
        }
      }

      .close-btn {
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        color: #1e3a8a;
        background: #ffffff;
        border: 1.5px solid #bfdbfe;
        padding: 0;
        cursor: pointer;
        transition: all 0.15s ease-in-out;
        box-shadow: 0 1px 2px rgba(30, 58, 138, 0.08);
        flex-shrink: 0;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          line-height: 16px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        &:hover {
          background: #fee2e2;
          border-color: #ef4444;
          color: #dc2626;
          box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);
          transform: translateY(-1px);
        }

        &:active {
          transform: translateY(0);
          box-shadow: none;
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
      white-space: pre-line;
      animation: fadeIn 0.15s ease-in-out;

      &:has(.pwa-install-guide) {
        white-space: normal;
      }

      ul {
        margin: 8px 0 0;
        padding-left: 20px;
        white-space: normal;

        li {
          margin-bottom: 6px;
          line-height: 1.5;
        }
      }
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
        &.warning {
          background: linear-gradient(135deg, #d97706 0%, #ea580c 100%) !important;
          color: #ffffff !important;
        }
        &.success {
          background: linear-gradient(135deg, #059669 0%, #10b981 100%) !important;
          color: #ffffff !important;
        }
        &.info {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
          color: #ffffff !important;
        }
      }
    }

    /* Prompt Input Styling */
    .prompt-field-wrap {
      margin-top: 14px;
      width: 100%;
      box-sizing: border-box;

      .prompt-form-field {
        width: 100%;
        display: block;

        textarea {
          font-size: 0.9rem;
          color: #0f172a;
          line-height: 1.5;
          min-height: 72px;
          resize: vertical;
        }

        input {
          font-size: 0.9rem;
          color: #0f172a;
        }
      }
    }

    @media (max-width: 600px) {
      .dialog-header {
        padding: 10px 12px;
      }
      .dialog-content {
        padding: 14px 16px;
      }
      .dialog-actions {
        padding: 12px 16px;
        flex-direction: column-reverse;
        gap: 8px;

        button {
          width: 100%;
          min-width: 0;
        }
      }
    }
  `]
})
export class ConfirmDialogComponent implements OnInit {
  activeLang: 'en' | 'hi' = 'hi';
  promptValue: string = '';

  constructor(
    private dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) { }

  ngOnInit(): void {
    if (this.data.isPrompt) {
      this.promptValue = this.data.inputValue || '';
    }
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
    if (this.data.isPrompt) {
      this.dialogRef.close(this.promptValue?.trim() || '');
    } else {
      this.dialogRef.close(true);
    }
  }

  onCancel(): void {
    if (this.data.isPrompt) {
      this.dialogRef.close(null);
    } else {
      this.dialogRef.close(false);
    }
  }
}

