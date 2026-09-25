import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TenantService, MySubscriptionDto } from '../../core/services/tenant.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-manage-subscription-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    <div class="dialog-container">
      <!-- Strict Light Blue Gradient Dialog Header (ERP Global UI Rule) -->
      <div class="dialog-header">
        <div class="header-icon-box">
          <mat-icon>verified_user</mat-icon>
        </div>
        <div class="header-title-block">
          <h2 class="main-title">SuperAdmin: Manage Plan &amp; Extend Validity</h2>
          <p class="subtitle">
            Institute: <strong>{{ data.instituteName }}</strong> &bull; Code: <strong>{{ data.tenantCode }}</strong>
          </p>
        </div>
        <button mat-icon-button class="close-btn" (click)="dialogRef.close()" matTooltip="Close dialog">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="dialog-content">

          <!-- Current Status Callout Strip -->
          <div class="current-strip">
            <div class="strip-item">
              <span class="strip-label">Current Edition:</span>
              <strong class="strip-val">{{ data.subscriptionPlan || 'FreeTrial' }}</strong>
            </div>
            <div class="strip-item">
              <span class="strip-label">Status:</span>
              <span class="status-chip" [ngClass]="(data.subscriptionStatus || '').toLowerCase()">
                {{ data.subscriptionStatus || 'TrialActive' }}
              </span>
            </div>
            <div class="strip-item">
              <span class="strip-label">Current Expiry:</span>
              <span class="expiry-val">{{ (data.trialEndDate | date:'mediumDate') || 'Not set' }}</span>
            </div>
          </div>

          <!-- Quick Validity Extension Buttons -->
          <div class="extension-section">
            <label class="section-title">
              <mat-icon class="sec-icon">update</mat-icon>
              <span>Quick Extension (Days / Months):</span>
            </label>
            <div class="quick-days-chips">
              <button type="button" mat-stroked-button class="quick-btn" [class.active]="selectedDaysToAdd === 15" (click)="addDays(15)">
                +15 Days
              </button>
              <button type="button" mat-stroked-button class="quick-btn" [class.active]="selectedDaysToAdd === 30" (click)="addDays(30)">
                +1 Month (30 Days)
              </button>
              <button type="button" mat-stroked-button class="quick-btn" [class.active]="selectedDaysToAdd === 60" (click)="addDays(60)">
                +2 Months (60 Days)
              </button>
              <button type="button" mat-stroked-button class="quick-btn" [class.active]="selectedDaysToAdd === 90" (click)="addDays(90)">
                +3 Months (90 Days)
              </button>
              <button type="button" mat-stroked-button class="quick-btn" [class.active]="selectedDaysToAdd === 365" (click)="addDays(365)">
                +1 Year (365 Days)
              </button>
            </div>

            <!-- Dynamic Projected Expiry Alert -->
            <div class="projected-preview" *ngIf="previewDate">
              <mat-icon class="preview-icon">event_available</mat-icon>
              <span>New Expiration Date will be: <strong>{{ previewDate | date:'fullDate' }}</strong> ({{ daysRemainingPreview }} days from today)</span>
            </div>
          </div>

          <!-- Form Fields Grid: Plan, Status, Quotas -->
          <div class="form-grid">
            
            <mat-form-field appearance="outline" class="form-col" subscriptSizing="dynamic">
              <mat-label>Subscription Edition / Tier</mat-label>
              <mat-select formControlName="newPlan">
                <mat-option value="FreeTrial">FreeTrial (Complimentary)</mat-option>
                <mat-option value="Starter">Starter Edition</mat-option>
                <mat-option value="Growth">Growth / Pro Edition (Premium)</mat-option>
                <mat-option value="Enterprise">Enterprise Suite (Unlimited)</mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">workspace_premium</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="form-col" subscriptSizing="dynamic">
              <mat-label>Subscription Status</mat-label>
              <mat-select formControlName="newStatus">
                <mat-option value="Active">Active (Full ERP Access)</mat-option>
                <mat-option value="TrialActive">TrialActive (Complimentary Active)</mat-option>
                <mat-option value="Expired">Expired (Locked Out)</mat-option>
                <mat-option value="GracePeriod">GracePeriod (Warning Mode)</mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">verified</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="form-col" subscriptSizing="dynamic">
              <mat-label>Max Students Quota</mat-label>
              <input matInput type="number" formControlName="maxStudentsLimit" placeholder="e.g. 50, 150, 500, 2000" />
              <mat-icon matSuffix color="primary">school</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="form-col" subscriptSizing="dynamic">
              <mat-label>Max Branch Campuses</mat-label>
              <input matInput type="number" formControlName="maxBranchesLimit" placeholder="e.g. 2, 3, 5, 10" />
              <mat-icon matSuffix color="primary">apartment</mat-icon>
            </mat-form-field>

          </div>

          <div class="note-box">
            <mat-icon class="note-icon">info</mat-icon>
            <span>Setting status to <strong>Active</strong> and extending the date immediately unlocks all ERP pages for the tenant and lifts any lockout screen.</span>
          </div>

        </div>

        <div class="dialog-actions">
          <button mat-stroked-button type="button" (click)="dialogRef.close()" [disabled]="saving">Cancel</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="saving || form.invalid" class="save-btn">
            <mat-spinner diameter="18" *ngIf="saving" style="display:inline-block; margin-right:6px;"></mat-spinner>
            <mat-icon *ngIf="!saving">save</mat-icon>
            <span>Save &amp; Update Subscription</span>
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .dialog-container {
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

        mat-icon { font-size: 24px; width: 24px; height: 24px; }
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
        &:hover { color: #1e293b; }
      }
    }

    .dialog-content {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .current-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.84rem;

      .strip-item {
        display: flex;
        align-items: center;
        gap: 6px;

        .strip-label { color: #64748b; font-size: 0.8rem; }
        .strip-val { color: #1e293b; font-weight: 700; }
        .expiry-val { color: #0284c7; font-weight: 600; }

        .status-chip {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.74rem;
          font-weight: 700;

          &.active { background: #dcfce7; color: #15803d; }
          &.trialactive { background: #eff6ff; color: #2563eb; }
          &.expired { background: #fee2e2; color: #b91c1c; }
        }
      }
    }

    .extension-section {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .section-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.88rem;
        font-weight: 700;
        color: #1e3a8a;

        .sec-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
      }

      .quick-days-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        .quick-btn {
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.82rem;
          border-color: #cbd5e1;
          color: #334155;

          &:hover {
            border-color: #2563eb;
            color: #2563eb;
            background: #eff6ff;
          }

          &.active {
            background: #2563eb;
            color: #ffffff;
            border-color: #2563eb;
            box-shadow: 0 2px 6px rgba(37,99,235,0.3);
          }
        }
      }

      .projected-preview {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        color: #065f46;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 0.82rem;
        margin-top: 4px;

        .preview-icon { font-size: 18px; width: 18px; height: 18px; color: #059669; }
      }
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
      }

      .form-col {
        width: 100%;
      }
    }

    .note-box {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.82rem;
      line-height: 1.4;

      .note-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; flex-shrink: 0; margin-top: 1px; }
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 12px 20px 16px;
      border-top: 1px solid #f1f5f9;

      .save-btn {
        background: #2563eb;
        color: #ffffff;
        font-weight: 700;
        padding: 0 20px;
      }
    }
  `]
})
export class ManageSubscriptionDialogComponent implements OnInit {
  readonly dialogRef = inject(MatDialogRef<ManageSubscriptionDialogComponent>);
  private tenantService = inject(TenantService);
  private confirmDialog = inject(ConfirmDialogService);
  private fb = inject(FormBuilder);

  form!: FormGroup;
  selectedDaysToAdd: number | null = null;
  previewDate: Date | null = null;
  daysRemainingPreview = 0;
  saving = false;

  constructor(@Inject(MAT_DIALOG_DATA) public data: MySubscriptionDto) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      newPlan: [this.data.subscriptionPlan || 'Growth', Validators.required],
      newStatus: ['Active', Validators.required],
      maxStudentsLimit: [this.data.maxStudentsLimit || 500, [Validators.required, Validators.min(1)]],
      maxBranchesLimit: [this.data.maxBranchesLimit || 3, [Validators.required, Validators.min(1)]]
    });

    // Default select 30 days extension
    this.addDays(30);
  }

  addDays(days: number): void {
    this.selectedDaysToAdd = days;
    const base = this.data.trialEndDate && new Date(this.data.trialEndDate) > new Date()
      ? new Date(this.data.trialEndDate)
      : new Date();
    const future = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    this.previewDate = future;
    this.daysRemainingPreview = Math.ceil((future.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000));
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.saving = true;
    const formVal = this.form.value;

    const payload = {
      daysToAdd: this.selectedDaysToAdd ?? undefined,
      newPlan: formVal.newPlan,
      newStatus: formVal.newStatus,
      maxStudentsLimit: formVal.maxStudentsLimit,
      maxBranchesLimit: formVal.maxBranchesLimit
    };

    this.tenantService.extendSubscription(this.data.tenantId, payload).subscribe({
      next: (res) => {
        this.saving = false;
        this.dialogRef.close({ updated: true, res });
      },
      error: (err) => {
        this.saving = false;
        console.error('Failed to extend subscription:', err);
        const errMsg = err?.error?.message || err?.error?.detail || 'Failed to extend subscription. Please try again.';
        this.confirmDialog.alert('Subscription Update Failed', errMsg, 'danger');
      }
    });
  }
}
