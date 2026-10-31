import { Component, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
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
    MatSelectModule
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
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn" matTooltip="Close">
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
    
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Personalized Message Body</mat-label>
              <textarea matInput formControlName="message" rows="8" placeholder="Message content..."></textarea>
              <mat-icon matPrefix>chat</mat-icon>
            </mat-form-field>
          </div>
        </mat-dialog-content>
    
        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-stroked-button type="button" (click)="dialogRef.close()" class="cancel-btn">
            Cancel
          </button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || !data.plan.parentPhone" class="dispatch-btn">
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

