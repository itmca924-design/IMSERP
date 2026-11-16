import { Component, Inject, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MySubscriptionDto, SubscriptionPricingConfig } from '../../core/services/tenant.service';

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
    MatInputModule
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

        <div class="support-contact-strip">
          <mat-icon class="support-icon">payments</mat-icon>
          <div>
            <strong>Instant Activation via Platform Admin:</strong>
            <p>Upon submitting, your renewal order is registered. Platform Super Admin will verify and activate your <strong>Premium</strong> license immediately.</p>
          </div>
        </div>
    
        @if (submitted) {
          <div class="remarks-box">
            <mat-icon color="primary">check_circle</mat-icon>
            <span>Renewal request for <strong>{{ selectedCycle }} Plan (₹{{ selectedCycle === 'Annual' ? (totalAnnualInitial | number) : (totalMonthlyInitial | number) }})</strong> submitted successfully! Platform Super Admin has been notified.</span>
          </div>
        }
      </div>
    
      <div class="dialog-actions">
        <button (click)="dialogRef.close()" matButton="filled" class="app-button-cancel">Cancel</button>
        <button color="primary" [disabled]="submitted" (click)="submitRenewal()" matButton="filled">
          <mat-icon>verified</mat-icon>
          <span>Confirm &amp; Request {{ selectedCycle }} Activation (₹{{ selectedCycle === 'Annual' ? (totalAnnualInitial | number) : (totalMonthlyInitial | number) }})</span>
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

  selectedCycle: 'Annual' | 'Monthly' = 'Annual';
  submitted = false;

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

  submitRenewal(): void {
    this.submitted = true;
    setTimeout(() => {
      this.dialogRef.close({
        renewedTier: 'Premium',
        billingCycle: this.selectedCycle,
        amount: this.selectedCycle === 'Annual' ? this.totalAnnualInitial : this.totalMonthlyInitial
      });
    }, 1200);
  }
}
