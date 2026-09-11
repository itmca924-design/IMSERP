import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { FeesService } from '../../core/services/fees.service';

export interface CancelInvoiceDialogData {
  invoiceId: string;
  invoiceNumber: string;
  title: string;
  studentName: string;
  rollNumber: string;
  batchName: string;
  totalAmount: number;
  dueAmount: number;
}

@Component({
  selector: 'app-cancel-invoice-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
  template: `
    <div class="cancel-dialog-container">
      <div class="dialog-header">
        <div class="icon-circle">
          <mat-icon>delete_forever</mat-icon>
        </div>
        <div class="header-text">
          <h2>Cancel / Void Invoice</h2>
          <p class="subtitle">Select reason for marking this invoice as cancelled</p>
        </div>
      </div>

      <form [formGroup]="cancelForm" (ngSubmit)="onSubmit()">
        <mat-dialog-content class="dialog-content">
          <!-- Invoice & Student Summary Card -->
          <div class="summary-card">
            <div class="card-row">
              <span class="label">Invoice No:</span>
              <span class="val inv-badge">{{ data.invoiceNumber }}</span>
            </div>
            <div class="card-row">
              <span class="label">Fee Particular:</span>
              <span class="val font-semibold">{{ data.title }}</span>
            </div>
            <div class="card-row">
              <span class="label">Student:</span>
              <span class="val">{{ data.studentName }} (Roll #{{ data.rollNumber }})</span>
            </div>
            <div class="card-row">
              <span class="label">Batch:</span>
              <span class="val text-muted">{{ data.batchName }}</span>
            </div>
            <div class="card-divider"></div>
            <div class="card-row amount-row">
              <span class="label">Pending Due Amount:</span>
              <span class="val amount-due">₹{{ data.dueAmount | number:'1.2-2' }}</span>
            </div>
          </div>

          <!-- Reason Selection -->
          <div class="form-section">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Cancellation Reason</mat-label>
              <mat-select formControlName="selectedReason">
                <mat-option *ngFor="let r of predefinedReasons" [value]="r.value">
                  {{ r.label }}
                </mat-option>
              </mat-select>
              <mat-error *ngIf="cancelForm.get('selectedReason')?.hasError('required')">
                Please select a reason
              </mat-error>
            </mat-form-field>

            <!-- Custom reason textarea if 'Other' is chosen -->
            <mat-form-field
              *ngIf="cancelForm.get('selectedReason')?.value === 'Other'"
              appearance="outline"
              class="full-width"
            >
              <mat-label>Specify Custom Reason Details</mat-label>
              <textarea
                matInput
                rows="2"
                formControlName="customReason"
                placeholder="e.g. Student relocated to another city..."
              ></textarea>
              <mat-error *ngIf="cancelForm.get('customReason')?.hasError('required')">
                Please provide details for the reason
              </mat-error>
            </mat-form-field>
          </div>

          <!-- Warning Notice -->
          <div class="warning-alert">
            <mat-icon class="warn-icon">warning</mat-icon>
            <div class="warn-text">
              <strong>Permanent Action:</strong> This invoice will be permanently marked as <em>VOID</em>. 
              The pending due of <strong>₹{{ data.dueAmount | number:'1.2-2' }}</strong> will be completely excluded from {{ data.studentName }}'s total outstanding balance.
            </div>
          </div>
        </mat-dialog-content>

        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-button type="button" (click)="onClose()" [disabled]="submitting">
            Go Back
          </button>
          <button
            mat-raised-button
            class="btn-danger-confirm"
            type="submit"
            [disabled]="cancelForm.invalid || submitting"
          >
            <mat-spinner diameter="18" *ngIf="submitting" class="spinner"></mat-spinner>
            <mat-icon *ngIf="!submitting">block</mat-icon>
            <span>Confirm & Cancel Invoice</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
  `,
  styles: [`
    .cancel-dialog-container {
      padding: 8px 4px;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 24px 8px;

      .icon-circle {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #fee2e2;
        color: #dc2626;
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

      .header-text {
        h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: #1e293b;
        }
        .subtitle {
          margin: 2px 0 0;
          font-size: 0.82rem;
          color: #64748b;
        }
      }
    }

    .dialog-content {
      padding: 16px 24px;
      min-width: 460px;
    }

    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .card-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.88rem;

        .label {
          color: #64748b;
        }
        .val {
          color: #1e293b;
        }
        .font-semibold {
          font-weight: 600;
        }
        .text-muted {
          color: #64748b;
          font-size: 0.82rem;
        }
        .inv-badge {
          font-family: monospace;
          background: #e2e8f0;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.82rem;
          font-weight: 600;
        }
      }

      .card-divider {
        height: 1px;
        background: #e2e8f0;
        margin: 4px 0;
      }

      .amount-row {
        .amount-due {
          font-size: 1.15rem;
          font-weight: 700;
          color: #dc2626;
        }
      }
    }

    .form-section {
      margin-bottom: 8px;
    }

    .full-width {
      width: 100%;
    }

    .warning-alert {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #fffbeb;
      border: 1px solid #fef3c7;
      border-radius: 8px;
      padding: 12px 14px;
      font-size: 0.82rem;
      color: #92400e;
      line-height: 1.45;

      .warn-icon {
        color: #d97706;
        font-size: 20px;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        margin-top: 1px;
      }
    }

    .dialog-actions {
      padding: 16px 24px 12px;
      gap: 10px;
    }

    .btn-danger-confirm {
      background-color: #dc2626 !important;
      color: #ffffff !important;
      display: inline-flex;
      align-items: center;
      gap: 6px;

      &:hover {
        background-color: #b91c1c !important;
      }

      &[disabled] {
        background-color: #fca5a5 !important;
        color: #ffffff !important;
        opacity: 0.7;
      }
    }

    .spinner {
      display: inline-block;
      margin-right: 6px;
    }
  `]
})
export class CancelInvoiceDialogComponent implements OnInit {
  cancelForm!: FormGroup;
  submitting = false;

  readonly predefinedReasons = [
    { value: 'Student Left Coaching', label: '🎓 Student Left Coaching / Discontinued' },
    { value: 'Invoice Generated in Error', label: '❌ Invoice Generated in Error / Duplicate' },
    { value: 'Fee Waiver / Scholarship', label: '🎁 Fee Waiver / Scholarship Concession' },
    { value: 'Batch Transfer / Re-enrollment', label: '🔄 Batch Transfer / Re-enrollment' },
    { value: 'Other', label: '📝 Other (Specify below)' }
  ];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CancelInvoiceDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CancelInvoiceDialogData,
    private feesService: FeesService
  ) {}

  ngOnInit(): void {
    this.cancelForm = this.fb.group({
      selectedReason: ['Student Left Coaching', Validators.required],
      customReason: ['']
    });

    // Toggle required validator on customReason when 'Other' is selected
    this.cancelForm.get('selectedReason')?.valueChanges.subscribe((val) => {
      const customControl = this.cancelForm.get('customReason');
      if (val === 'Other') {
        customControl?.setValidators([Validators.required]);
      } else {
        customControl?.clearValidators();
      }
      customControl?.updateValueAndValidity();
    });
  }

  onSubmit(): void {
    if (this.cancelForm.invalid || this.submitting) return;

    const val = this.cancelForm.value;
    const finalReason = val.selectedReason === 'Other' && val.customReason?.trim()
      ? `Other: ${val.customReason.trim()}`
      : val.selectedReason;

    this.submitting = true;
    this.feesService.cancelInvoice(this.data.invoiceId, finalReason).subscribe({
      next: (res) => {
        this.submitting = false;
        this.dialogRef.close({ cancelled: true, reason: finalReason, res });
      },
      error: (err) => {
        this.submitting = false;
        alert(err?.error?.message || 'Failed to cancel invoice. Please try again.');
      }
    });
  }

  onClose(): void {
    this.dialogRef.close(null);
  }
}
