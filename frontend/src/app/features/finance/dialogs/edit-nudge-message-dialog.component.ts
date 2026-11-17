import { Component, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { HindiTypingDirective } from '../../../shared/directives/hindi-typing.directive';
import { FeeRecoveryPlanItemDto } from '../../../core/services/fee-recovery-agent.service';
import { UpiIntentResponse } from '../../../core/services/fees.service';

export interface EditNudgeDialogData {
  plan: FeeRecoveryPlanItemDto;
  customMessage?: string;
  upiIntent?: UpiIntentResponse;
}

@Component({
  selector: 'app-edit-nudge-message-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    HindiTypingDirective
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>psychology</mat-icon>
          </div>
          <div>
            <h2 class="main-title">AI Nudge Message Preview &amp; Dispatch</h2>
            <p class="subtitle">
              Target: <strong>{{ data.plan.studentName }}</strong> • Recipient Phone: <strong>{{ data.plan.parentPhone || 'No phone' }}</strong>
            </p>
          </div>
        </div>
        <button (click)="dialogRef.close()" class="close-btn" matTooltip="Close" mat-icon-button>
          <mat-icon>close</mat-icon>
        </button>
      </div>
    
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="dialog-form">
        <mat-dialog-content class="dialog-content">
          @if (data.plan.aiRationale) {
            <div class="ai-rationale-box">
              <div class="rationale-header">
                <mat-icon>auto_awesome</mat-icon>
                <span>AI Agent Rationale (Risk: {{ data.plan.riskLevel }})</span>
              </div>
              <p class="rationale-text">{{ data.plan.aiRationale }}</p>
            </div>
          }
    
          <div class="free-whatsapp-tip">
            <mat-icon class="tip-icon">verified</mat-icon>
            <div class="tip-text">
              <strong>100% Free WhatsApp Dispatch:</strong> No paid API key or third-party subscription required.
              Clicking <em>Send via WhatsApp</em> directly opens WhatsApp Web / App with this pre-filled personalized message.
            </div>
          </div>
    
          <div class="form-fields">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Communication Channel</mat-label>
              <mat-select formControlName="channel">
                <mat-option value="WhatsApp">WhatsApp Gateway (Official)</mat-option>
                <mat-option value="VoiceCall">Voice Call (Staff Follow-up)</mat-option>
                <mat-option value="InPersonPTM">In-Person PTM / Guardian Meeting</mat-option>
              </mat-select>
              <mat-icon matPrefix>send</mat-icon>
            </mat-form-field>
    
            <div class="lang-typing-row">
              <span class="lang-row-label">Typing Language:</span>
              <div class="lang-toggle-pill" [class.is-hindi]="isHindiTypingActive">
                <button
                  type="button"
                  class="lang-pill-btn lang-eng"
                  [class.active]="!isHindiTypingActive"
                  (click)="isHindiTypingActive = false"
                  matTooltip="English typing">
                  ENG
                </button>
                <button
                  type="button"
                  class="lang-pill-btn lang-hin"
                  [class.active]="isHindiTypingActive"
                  (click)="isHindiTypingActive = true"
                  matTooltip="हिंदी मोड: टाइप करते समय स्पेस दबाने पर स्वतः देवनागरी में बदलेगा">
                  <span>🇮🇳 HIN</span>
                  @if (isHindiTypingActive) {
                    <span class="active-dot"></span>
                  }
                </button>
              </div>
              @if (isHindiTypingActive) {
                <span class="hindi-typing-status-pill">
                  <span class="status-dot"></span>
                  <span>हिंदी टाइपिंग चालू (Hinglish ➔ देवनागरी on Space)</span>
                </span>
              }
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Personalized Message Body</mat-label>
              <textarea matInput formControlName="message" [appHindiTyping]="isHindiTypingActive" rows="8" placeholder="Message content..."></textarea>
              <mat-icon matPrefix>chat</mat-icon>
            </mat-form-field>
          </div>
        </mat-dialog-content>
    
        <mat-dialog-actions align="end" class="dialog-actions">
          <button type="button" (click)="dialogRef.close()" class="cancel-btn app-button-cancel" matButton="filled">
            Cancel
          </button>
          <button color="primary" type="submit" [disabled]="form.invalid || !data.plan.parentPhone" class="dispatch-btn" matButton="filled">
            <mat-icon>send</mat-icon>
            <span>Send via WhatsApp (Free)</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      background: #ffffff;
      border-radius: 14px;
      overflow: hidden;
    }

    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;

      .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .header-icon-box {
        background: #2563eb;
        color: #ffffff;
        border-radius: 10px;
        box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        mat-icon {
          font-size: 22px;
          width: 22px;
          height: 22px;
        }
      }

      .main-title {
        color: #1e3a8a;
        font-weight: 700;
        font-size: 1.15rem;
        margin: 0 0 2px 0;
      }

      .subtitle {
        color: #3b82f6;
        font-size: 0.8rem;
        margin: 0;

        strong {
          color: #1e40af;
        }
      }

      .close-btn {
        color: #64748b;
        &:hover { color: #1e293b; }
      }
    }

    .dialog-form {
      display: flex;
      flex-direction: column;
    }

    .dialog-content {
      padding: 18px 20px;
      max-height: 70vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .ai-rationale-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 10px 14px;

      .rationale-header {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #15803d;
        font-weight: 700;
        font-size: 0.82rem;
        margin-bottom: 4px;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }

      .rationale-text {
        color: #166534;
        font-size: 0.82rem;
        line-line: 1.45;
        margin: 0;
      }
    }

    .free-whatsapp-tip {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 14px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      margin-bottom: 14px;

      .tip-icon {
        color: #16a34a;
        font-size: 20px;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        margin-top: 1px;
      }

      .tip-text {
        color: #15803d;
        font-size: 0.82rem;
        line-height: 1.4;

        strong {
          color: #166534;
        }

        em {
          font-style: normal;
          font-weight: 600;
          color: #047857;
        }
      }
    }

    .form-fields {
      display: flex;
      flex-direction: column;
      gap: 10px;

      .full-width {
        width: 100%;
      }

      textarea {
        font-family: inherit;
        font-size: 0.88rem;
        line-height: 1.5;
      }
    }

    .lang-typing-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 8px;

      .lang-row-label {
        font-size: 0.78rem;
        font-weight: 700;
        color: #475569;
      }

      .lang-toggle-pill {
        display: inline-flex;
        align-items: center;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 20px;
        padding: 2px;
        gap: 2px;

        &.is-hindi {
          background: #f0fdf4;
          border-color: #86efac;
        }

        .lang-pill-btn {
          background: transparent;
          border: none;
          border-radius: 16px;
          padding: 3px 8px;
          font-size: 0.72rem;
          font-weight: 700;
          color: #64748b;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.18s ease;

          &:hover { color: #1e293b; }

          &.active {
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);

            &.lang-hin {
              background: #16a34a;
              color: #ffffff;
            }

            &.lang-eng {
              background: #2563eb;
              color: #ffffff;
            }
          }

          .active-dot {
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: #ffffff;
          }
        }
      }

      .hindi-typing-status-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 2px 8px;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 12px;
        font-size: 0.7rem;
        font-weight: 600;
        color: #166534;

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #16a34a;
          box-shadow: 0 0 4px #86efac;
        }
      }
    }

    .dialog-actions {
      padding: 12px 20px 16px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      gap: 10px;

      button {
        border-radius: 8px;
        font-weight: 600;
        height: 38px;
      }

      .dispatch-btn {
        background: #16a34a;
        color: #ffffff;
      }
    }
  `]
})
export class EditNudgeMessageDialogComponent implements OnInit {
  form!: FormGroup;
  isHindiTypingActive = true;

  constructor(
    public dialogRef: MatDialogRef<EditNudgeMessageDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EditNudgeDialogData,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    const initialMsg = this.data.customMessage || this.data.plan.generatedMessage || '';
    this.form = this.fb.group({
      channel: [this.data.plan.recommendedChannel || 'WhatsApp', Validators.required],
      message: [initialMsg, Validators.required]
    });
  }

  insertUpiPayLink(): void {
    if (!this.data.upiIntent) return;
    const upi = this.data.upiIntent;
    const current = this.form.get('message')?.value || '';
    const payPortalUrl = `${window.location.origin}/pay/${this.data.plan.invoiceId}`;
    if (current.includes(payPortalUrl)) return;

    const paymentBlock =
      `\n\n💳 *Instant Online UPI Payment:*\n` +
      `• Payee UPI ID (VPA): \`${upi.payeeUpiId}\`\n` +
      `• Payee Name: *${upi.payeeName}*\n` +
      `• Payable Amount: *₹${this.data.plan.totalOverdueAmount}*\n\n` +
      `👉 *Click to Pay Online (GPay / PhonePe / Paytm / QR):*\n` +
      `${payPortalUrl}\n`;

    this.form.patchValue({ message: current + paymentBlock });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value);
  }
}

