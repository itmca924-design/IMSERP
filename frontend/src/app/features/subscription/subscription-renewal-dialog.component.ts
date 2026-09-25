import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MySubscriptionDto } from '../../core/services/tenant.service';

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
          <h2 class="main-title">Renew &amp; Upgrade SaaS Subscription</h2>
          <p class="subtitle">
            Institute: <strong>{{ data?.instituteName || 'My Institute' }}</strong> &bull; Code: <strong>{{ data?.tenantCode }}</strong>
          </p>
        </div>
        <button mat-icon-button class="close-btn" (click)="dialogRef.close()" matTooltip="Close dialog">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <div class="plan-summary-banner" [class.expired]="data?.subscriptionStatus === 'Expired'">
          <div class="banner-left">
            <span class="status-pill">{{ data?.subscriptionStatus || 'TrialActive' }}</span>
            <strong>Current: {{ data?.subscriptionPlan || 'FreeTrial' }}</strong>
          </div>
          <span class="expiry-note" *ngIf="data?.trialEndDate">
            Validity: {{ data?.trialEndDate | date:'mediumDate' }}
          </span>
        </div>

        <h4 class="select-plan-title">Select Subscription Plan to Activate:</h4>

        <div class="plan-radio-group">
          <!-- Starter -->
          <label class="plan-card-option" [class.selected]="selectedTier === 'Starter'">
            <input type="radio" name="planTier" value="Starter" [(ngModel)]="selectedTier" />
            <div class="option-details">
              <div class="tier-top">
                <span class="tier-heading">Starter Plan</span>
                <span class="price-chip">₹1,999 / mo</span>
              </div>
              <p class="tier-desc">Up to 150 students &bull; 1 campus &bull; School or Coaching module.</p>
            </div>
          </label>

          <!-- Growth / Pro -->
          <label class="plan-card-option recommended" [class.selected]="selectedTier === 'Growth'">
            <div class="rec-badge">RECOMMENDED</div>
            <input type="radio" name="planTier" value="Growth" [(ngModel)]="selectedTier" />
            <div class="option-details">
              <div class="tier-top">
                <span class="tier-heading">Growth / Pro Plan</span>
                <span class="price-chip featured">₹4,499 / mo</span>
              </div>
              <p class="tier-desc">Up to 500 students &bull; 3 branches &bull; Biometric &amp; WhatsApp included.</p>
            </div>
          </label>

          <!-- Enterprise -->
          <label class="plan-card-option" [class.selected]="selectedTier === 'Enterprise'">
            <input type="radio" name="planTier" value="Enterprise" [(ngModel)]="selectedTier" />
            <div class="option-details">
              <div class="tier-top">
                <span class="tier-heading">Enterprise Suite</span>
                <span class="price-chip">Custom Quota</span>
              </div>
              <p class="tier-desc">Unlimited capacity &bull; All 5 modules (Hostel, Library, Transport) &bull; Priority SLA.</p>
            </div>
          </label>
        </div>

        <div class="support-contact-strip">
          <mat-icon class="support-icon">headset_mic</mat-icon>
          <div>
            <strong>Instant Activation &amp; Support:</strong>
            <p>Call or WhatsApp Platform Support at <strong>+91 98765 43210</strong> or ping your Super Admin to approve immediate renewal.</p>
          </div>
        </div>

        <div class="remarks-box" *ngIf="submitted">
          <mat-icon color="primary">check_circle</mat-icon>
          <span>Renewal request submitted! Platform Super Admin has been notified to activate your <strong>{{ selectedTier }}</strong> tier.</span>
        </div>
      </div>

      <div class="dialog-actions">
        <button mat-stroked-button (click)="dialogRef.close()">Cancel</button>
        <button mat-raised-button color="primary" [disabled]="submitted" (click)="submitRenewal()">
          <mat-icon>send</mat-icon>
          <span>Confirm &amp; Request Renewal</span>
        </button>
      </div>
    </div>
  `,
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
      }
    }

    .support-contact-strip {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.82rem;
      color: #334155;

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
        color: #64748b;
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

  selectedTier: 'Starter' | 'Growth' | 'Enterprise' = 'Growth';
  submitted = false;

  constructor(@Inject(MAT_DIALOG_DATA) public data: MySubscriptionDto | null) {}

  submitRenewal(): void {
    this.submitted = true;
    setTimeout(() => {
      this.dialogRef.close({ renewedTier: this.selectedTier });
    }, 1200);
  }
}
