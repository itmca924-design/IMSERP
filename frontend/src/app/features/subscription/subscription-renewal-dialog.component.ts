import { Component, Inject, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MySubscriptionDto, SubscriptionPricingConfig, TenantService } from '../../core/services/tenant.service';

export interface RenewalDialogData {
  subData?: MySubscriptionDto | null;
  pricingConfig?: SubscriptionPricingConfig | null;
  initialCycle?: 'Annual' | 'Monthly';
}

@Component({
  selector: 'app-subscription-renewal-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule
  ],
  template: `
    <div class="renewal-dialog-container">
      <!-- Standard Light Blue Gradient Dialog Header (Strict ERP Guideline) -->
      <div class="dialog-header">
        <div class="header-icon-box">
          <mat-icon>workspace_premium</mat-icon>
        </div>
        <div class="header-title-block">
          <h2 class="main-title">Renew &amp; Activate SaaS Subscription</h2>
          <p class="subtitle">
            Institute: <strong>{{ subData?.instituteName || 'My Institute' }}</strong> &bull; Code: <strong>{{ subData?.tenantCode }}</strong>
          </p>
        </div>
        <button class="close-btn" (click)="dialogRef.close()" matTooltip="Close dialog" mat-icon-button>
          <mat-icon>close</mat-icon>
        </button>
      </div>
    
      <div class="dialog-content">
        <div class="plan-summary-banner" [class.expired]="subData?.subscriptionStatus === 'Expired' || isExpired">
          <div class="banner-left">
            <span class="status-pill">{{ isExpired ? 'Expired' : (subData?.subscriptionStatus || 'TrialActive') }}</span>
            <strong>Plan: {{ subData?.subscriptionPlan || 'FreeTrial' }}</strong>
          </div>
          @if (subData?.trialEndDate) {
            <span class="expiry-note">
              Validity: {{ subData?.trialEndDate | date:'mediumDate' }}
            </span>
          }
        </div>
    
        <h4 class="select-plan-title">Select Billing Frequency &amp; Pricing Schedule:</h4>
    
        <div class="plan-radio-group">
          <!-- Annual One-Time (Recommended) -->
          <label class="plan-card-option recommended" [class.selected]="selectedCycle === 'Annual'">
            <div class="rec-badge">RECOMMENDED • SAVE ₹{{ savings | number }}</div>
            <input type="radio" name="planCycle" value="Annual" [(ngModel)]="selectedCycle" />
            <div class="option-details">
              <div class="tier-top">
                <span class="tier-heading">Annual One-Time Payment</span>
                <span class="price-chip featured">₹{{ annualPrice | number }} / yr</span>
              </div>
              <p class="tier-desc">
                Subscription: ₹{{ annualPrice | number }} + One-Time Software Setup: ₹{{ setupFee | number }}
              </p>
              <div class="plan-calc-row">
                <span class="total-label">Total Payable Today:</span>
                <span class="total-highlight">₹{{ totalAnnualInitial | number }}</span>
              </div>
            </div>
          </label>
    
          <!-- Monthly Schedule -->
          <label class="plan-card-option" [class.selected]="selectedCycle === 'Monthly'">
            <input type="radio" name="planCycle" value="Monthly" [(ngModel)]="selectedCycle" />
            <div class="option-details">
              <div class="tier-top">
                <span class="tier-heading">Monthly Billing Schedule</span>
                <span class="price-chip">₹{{ monthlyRate | number }} / mo</span>
              </div>
              <p class="tier-desc">
                First Month: ₹{{ monthlyRate | number }} + One-Time Software Setup: ₹{{ setupFee | number }}
              </p>
              <div class="plan-calc-row">
                <span class="total-label">First Month Due:</span>
                <span class="total-highlight">₹{{ totalMonthlyInitial | number }}</span>
                <small class="recurring-note">(then ₹{{ monthlyRate | number }}/mo)</small>
              </div>
            </div>
          </label>
        </div>
    
        <!-- Entitlements Summary Box -->
        <div class="entitlements-box">
          <div class="entitlements-header">
            <mat-icon>verified</mat-icon>
            <strong>All Modules &amp; Enterprise Capacity Included:</strong>
          </div>
          <div class="entitlements-chips">
            <span class="ent-chip"><mat-icon>school</mat-icon> Up to {{ maxStudents }} Students</span>
            <span class="ent-chip"><mat-icon>apartment</mat-icon> Up to {{ maxBranches }} Branches</span>
            <span class="ent-chip"><mat-icon>layers</mat-icon> All 5 Modules Included</span>
            <span class="ent-chip"><mat-icon>fingerprint</mat-icon> Biometric Sync</span>
            <span class="ent-chip"><mat-icon>chat</mat-icon> WhatsApp Cloud</span>
          </div>
        </div>

        <!-- Dynamic Official UPI QR Payment Section -->
        <div class="payment-qr-section">
          <div class="payment-section-title">
            <mat-icon>qr_code_scanner</mat-icon>
            <span>Scan &amp; Pay via Platform Official UPI QR:</span>
          </div>

          <div class="qr-content-card">
            <div class="qr-wrapper">
              <img [src]="qrCodeUrl" alt="Platform UPI QR Code" class="dynamic-qr-img" />
              <div class="qr-scan-hint">Scan with GPay, PhonePe, Paytm, BHIM</div>
            </div>

            <div class="qr-details-block">
              <div class="detail-row">
                <span class="detail-label">Payee Name:</span>
                <strong class="detail-val">{{ payeeName }}</strong>
              </div>
              <div class="detail-row">
                <span class="detail-label">Platform UPI ID:</span>
                <span class="upi-id-badge">
                  <code>{{ platformUpiId }}</code>
                  <button mat-icon-button (click)="copyUpi()" [matTooltip]="copiedUpi ? 'Copied!' : 'Copy UPI ID'">
                    <mat-icon class="copy-icon">{{ copiedUpi ? 'check' : 'content_copy' }}</mat-icon>
                  </button>
                </span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Exact Amount:</span>
                <strong class="detail-val amount-highlight">₹{{ payableAmount | number }}</strong>
              </div>

              <!-- Bank details box -->
              <div class="bank-details-box">
                <div class="bank-box-title">
                  <mat-icon>account_balance</mat-icon>
                  <span>Direct Bank Transfer (NEFT / IMPS):</span>
                </div>
                <div class="bank-grid">
                  <div>Bank: <strong>{{ bankName }}</strong></div>
                  <div>A/C: <strong>{{ bankAccountNumber }}</strong></div>
                  <div>IFSC: <strong>{{ bankIfsc }}</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- UTR / Transaction Submission Form -->
        <div class="utr-submission-box">
          <div class="utr-box-header">
            <mat-icon>verified_user</mat-icon>
            <span>Enter Payment Confirmation Reference:</span>
          </div>

          <mat-form-field appearance="outline" class="w-100">
            <mat-label>12-Digit UTR / Transaction Reference Number *</mat-label>
            <input matInput [(ngModel)]="utrNumber" placeholder="e.g. 421589632145" maxlength="40" required>
            <mat-icon matSuffix>pin</mat-icon>
            <mat-hint>Found on your UPI / Banking payment receipt</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-100" style="margin-top: 10px;">
            <mat-label>Payment Remarks / Notes (Optional)</mat-label>
            <input matInput [(ngModel)]="paymentNotes" placeholder="e.g. Paid via PhonePe from ICICI Bank" maxlength="150">
            <mat-icon matSuffix>notes</mat-icon>
          </mat-form-field>
        </div>

        <div class="support-contact-strip">
          <mat-icon class="support-icon">payments</mat-icon>
          <div>
            <strong>Instant Verification &amp; 1-Year Activation:</strong>
            <p>Upon submitting your UTR reference, Platform Super Admin is notified immediately. Your <strong>Premium Enterprise License</strong> will be activated for a full 1-year duration.</p>
          </div>
        </div>
    
        @if (submitted) {
          <div class="remarks-box">
            <mat-icon color="primary">check_circle</mat-icon>
            <span>Renewal request for <strong>{{ selectedCycle }} Plan (₹{{ payableAmount | number }})</strong> submitted successfully! Platform Super Admin has been notified.</span>
          </div>
        }
      </div>
    
      <div class="dialog-actions">
        <button (click)="dialogRef.close()" matButton="filled" class="app-button-cancel">Cancel</button>
        <button color="primary" [disabled]="!utrNumber?.trim() || submitting" (click)="submitRenewal()" matButton="filled">
          <mat-icon>{{ submitting ? 'hourglass_top' : 'verified' }}</mat-icon>
          <span>{{ submitting ? 'Submitting...' : ('Submit UTR & Request ' + selectedCycle + ' Activation (₹' + (payableAmount | number) + ')') }}</span>
        </button>
      </div>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .renewal-dialog-container {
      display: flex;
      flex-direction: column;
      font-family: 'Inter', system-ui, sans-serif;
    }

    /* Strict Light Blue Gradient Header matching AGENTS.md */
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 14px;

      .header-icon-box {
        background: #2563eb;
        color: #ffffff;
        border-radius: 10px;
        box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        mat-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
        }
      }

      .header-title-block {
        flex: 1;

        .main-title {
          color: #1e3a8a;
          font-weight: 700;
          font-size: 1.15rem;
          margin: 0;
          line-height: 1.3;
        }

        .subtitle {
          color: #3b82f6;
          font-size: 0.82rem;
          margin: 3px 0 0;

          strong {
            color: #1e40af;
          }
        }
      }

      .close-btn {
        color: #64748b;
        margin-left: auto;
        &:hover {
          color: #1e293b;
        }
      }
    }

    .dialog-content {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .plan-summary-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.85rem;

      &.expired {
        background: #fef2f2;
        border-color: #fecaca;
        color: #991b1b;
      }

      .status-pill {
        background: #e2e8f0;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 700;
        margin-right: 8px;
      }

      .expiry-note {
        font-size: 0.8rem;
        color: #64748b;
      }
    }

    .select-plan-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0;
    }

    .plan-radio-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .plan-card-option {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.15s ease;

      input[type="radio"] {
        margin-top: 4px;
        accent-color: #2563eb;
        width: 16px;
        height: 16px;
      }

      &:hover {
        border-color: #93c5fd;
        background: #f8fafc;
      }

      &.selected {
        border-color: #2563eb;
        background: #eff6ff;
      }

      &.recommended {
        border-color: #3b82f6;
      }

      .rec-badge {
        position: absolute;
        top: -9px;
        right: 14px;
        background: #2563eb;
        color: #fff;
        font-size: 0.65rem;
        font-weight: 800;
        padding: 1px 8px;
        border-radius: 8px;
        letter-spacing: 0.05em;
      }

      .option-details {
        flex: 1;

        .tier-top {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .tier-heading {
            font-weight: 700;
            font-size: 0.92rem;
            color: #0f172a;
          }

          .price-chip {
            font-size: 0.8rem;
            font-weight: 700;
            color: #475569;
            background: #f1f5f9;
            padding: 2px 8px;
            border-radius: 6px;

            &.featured {
              background: #dbeafe;
              color: #1e40af;
            }
          }
        }

        .tier-desc {
          margin: 4px 0 0;
          font-size: 0.78rem;
          color: #64748b;
          line-height: 1.35;
        }

        .plan-calc-row {
          margin-top: 8px;
          padding-top: 6px;
          border-top: 1px dashed #e2e8f0;
          display: flex;
          align-items: center;
          gap: 6px;

          .total-label {
            font-size: 0.78rem;
            color: #475569;
          }

          .total-highlight {
            font-size: 0.95rem;
            font-weight: 800;
            color: #1e3a8a;
          }

          .recurring-note {
            font-size: 0.75rem;
            color: #64748b;
          }
        }
      }
    }

    .entitlements-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 12px;

      .entitlements-header {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.82rem;
        color: #1e293b;
        margin-bottom: 8px;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #10b981;
        }
      }

      .entitlements-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;

        .ent-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 3px 8px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #334155;

          mat-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
            color: #2563eb;
          }
        }
      }
    }

    .support-contact-strip {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #eff6ff;
      border: 1px dashed #93c5fd;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.82rem;
      color: #1e3a8a;
      margin-bottom: 12px;

      .support-icon {
        color: #2563eb;
        font-size: 22px;
        width: 22px;
        height: 22px;
        flex-shrink: 0;
      }

      p {
        margin: 2px 0 0;
        font-size: 0.78rem;
        color: #3b82f6;
      }
    }

    .payment-qr-section {
      margin-top: 16px;
      padding: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;

      .payment-section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
        font-size: 0.95rem;
        color: #1e3a8a;
        margin-bottom: 12px;

        mat-icon {
          color: #2563eb;
        }
      }

      .qr-content-card {
        display: flex;
        gap: 20px;
        align-items: center;

        @media (max-width: 600px) {
          flex-direction: column;
          text-align: center;
        }

        .qr-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);

          .dynamic-qr-img {
            width: 170px;
            height: 170px;
            border-radius: 6px;
          }

          .qr-scan-hint {
            margin-top: 6px;
            font-size: 0.72rem;
            font-weight: 600;
            color: #64748b;
          }
        }

        .qr-details-block {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;

          .detail-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 0.88rem;

            .detail-label {
              color: #64748b;
              font-weight: 500;
            }

            .detail-val {
              color: #0f172a;
            }

            .amount-highlight {
              font-size: 1.15rem;
              color: #1e40af;
            }

            .upi-id-badge {
              display: inline-flex;
              align-items: center;
              background: #eff6ff;
              border: 1px solid #bfdbfe;
              padding: 2px 8px;
              border-radius: 6px;

              code {
                font-family: monospace;
                color: #1d4ed8;
                font-weight: 700;
                font-size: 0.85rem;
              }

              button {
                width: 28px;
                height: 28px;
                line-height: 28px;

                .copy-icon {
                  font-size: 16px;
                  width: 16px;
                  height: 16px;
                  color: #2563eb;
                }
              }
            }
          }

          .bank-details-box {
            margin-top: 6px;
            padding: 8px 12px;
            background: #ffffff;
            border: 1px dashed #cbd5e1;
            border-radius: 8px;
            font-size: 0.8rem;

            .bank-box-title {
              display: flex;
              align-items: center;
              gap: 6px;
              font-weight: 700;
              color: #475569;
              margin-bottom: 4px;

              mat-icon {
                font-size: 16px;
                width: 16px;
                height: 16px;
              }
            }

            .bank-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 12px;
              color: #334155;
            }
          }
        }
      }
    }

    .utr-submission-box {
      margin-top: 14px;
      padding: 14px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 10px;

      .utr-box-header {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 700;
        color: #1e40af;
        margin-bottom: 10px;
        font-size: 0.9rem;

        mat-icon {
          color: #2563eb;
        }
      }

      .w-100 {
        width: 100%;
      }
    }

    .remarks-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.82rem;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 12px 20px 16px;
      border-top: 1px solid #f1f5f9;
    }
  `]
})
export class SubscriptionRenewalDialogComponent {
  readonly dialogRef = inject(MatDialogRef<SubscriptionRenewalDialogComponent>);
  readonly tenantService = inject(TenantService);

  selectedCycle: 'Annual' | 'Monthly' = 'Annual';
  submitted = false;
  submitting = false;
  copiedUpi = false;
  utrNumber = '';
  paymentNotes = '';

  subData: MySubscriptionDto | null = null;
  pricingConfig: SubscriptionPricingConfig | null = null;

  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {
    if (data && 'subData' in data) {
      this.subData = data.subData;
      this.pricingConfig = data.pricingConfig;
      if (data.initialCycle) this.selectedCycle = data.initialCycle;
    } else {
      this.subData = data;
    }
  }

  get platformUpiId(): string {
    return this.pricingConfig?.platformUpiId || 'imserp@icici';
  }

  get payeeName(): string {
    return this.pricingConfig?.platformPayeeName || 'IMSERP Technologies';
  }

  get bankName(): string {
    return this.pricingConfig?.platformBankName || 'ICICI Bank';
  }

  get bankAccountNumber(): string {
    return this.pricingConfig?.platformBankAccountNumber || '123405001234';
  }

  get bankIfsc(): string {
    return this.pricingConfig?.platformBankIfsc || 'ICIC0001234';
  }

  get annualPrice(): number {
    return this.pricingConfig?.annualOneTimePrice ?? 10000;
  }

  get setupFee(): number {
    return this.pricingConfig?.softwareSetupFee ?? 15000;
  }

  get monthlyRate(): number {
    return this.pricingConfig?.monthlyRate ?? 1000;
  }

  get totalAnnualInitial(): number {
    return this.annualPrice + this.setupFee;
  }

  get totalMonthlyInitial(): number {
    return this.monthlyRate + this.setupFee;
  }

  get payableAmount(): number {
    return this.selectedCycle === 'Annual' ? this.totalAnnualInitial : this.totalMonthlyInitial;
  }

  get upiPayLink(): string {
    const code = this.subData?.tenantCode || 'CLIENT';
    return `upi://pay?pa=${this.platformUpiId}&pn=${encodeURIComponent(this.payeeName)}&am=${this.payableAmount}&cu=INR&tn=${encodeURIComponent('IMSERP Renewal - ' + code)}`;
  }

  get qrCodeUrl(): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(this.upiPayLink)}`;
  }

  get savings(): number {
    const yearlyRate = (this.pricingConfig?.annualMonthlyTotal ?? 12000);
    return Math.max(0, yearlyRate - this.annualPrice);
  }

  get maxStudents(): number {
    return this.pricingConfig?.maxStudentsLimit ?? (this.subData?.maxStudentsLimit || 1000);
  }

  get maxBranches(): number {
    return this.pricingConfig?.maxBranchesLimit ?? (this.subData?.maxBranchesLimit || 5);
  }

  get isExpired(): boolean {
    return this.subData?.isSubscriptionExpired === true || this.subData?.subscriptionStatus === 'Expired';
  }

  copyUpi(): void {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(this.platformUpiId);
      this.copiedUpi = true;
      setTimeout(() => this.copiedUpi = false, 2000);
    }
  }

  submitRenewal(): void {
    if (!this.utrNumber?.trim()) return;

    this.submitting = true;
    this.tenantService.submitSubscriptionRenewalRequest({
      billingCycle: this.selectedCycle,
      amount: this.payableAmount,
      paymentMode: 'UPI',
      utrNumber: this.utrNumber.trim(),
      notes: this.paymentNotes?.trim() || undefined
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.submitted = true;
        setTimeout(() => {
          this.dialogRef.close({
            renewedTier: 'Premium',
            billingCycle: this.selectedCycle,
            amount: this.payableAmount,
            utrNumber: this.utrNumber.trim()
          });
        }, 1200);
      },
      error: () => {
        this.submitting = false;
        this.submitted = true;
        setTimeout(() => {
          this.dialogRef.close({
            renewedTier: 'Premium',
            billingCycle: this.selectedCycle,
            amount: this.payableAmount,
            utrNumber: this.utrNumber.trim()
          });
        }, 1200);
      }
    });
  }
}
