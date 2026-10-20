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
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FeesService } from '../../core/services/fees.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

export interface CancelInvoiceDialogData {
  invoiceId: string;
  invoiceNumber: string;
  title: string;
  studentName: string;
  rollNumber: string;
  batchName: string;
  totalAmount: number;
  paidAmount: number;
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
    MatIconModule,
    MatRadioModule,
    MatTooltipModule
  ],
  template: `
    <div class="cancel-dialog-container">
      <!-- Standard Light-Blue Gradient Header -->
      <div class="dialog-header">
        <div class="icon-circle">
          <mat-icon>{{ data.paidAmount > 0 ? 'rule_folder' : 'delete_forever' }}</mat-icon>
        </div>
        <div class="header-text">
          <h2 mat-dialog-title>
            {{ data.paidAmount > 0 ? 'Invoice Cancellation & Settlement' : 'Cancel / Void Fee Invoice' }}
          </h2>
          <p class="subtitle">
            {{ data.paidAmount > 0 
              ? 'Handle partial collected fees, Day Book entries & student due clearance' 
              : 'Select reason for marking this unpaid invoice as cancelled & voiding dues' }}
          </p>
        </div>
        <button mat-icon-button type="button" class="close-btn" (click)="onClose()" [disabled]="submitting">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="cancelForm" (ngSubmit)="onSubmit()">
        <mat-dialog-content class="dialog-content">
          <!-- Invoice & Student Summary Strip -->
          <div class="summary-card">
            <div class="summary-top">
              <div class="summary-item">
                <span class="label">Invoice No:</span>
                <span class="val inv-badge">{{ data.invoiceNumber }}</span>
              </div>
              <div class="summary-item">
                <span class="label">Student:</span>
                <span class="val font-semibold">{{ data.studentName }} (Roll #{{ data.rollNumber || 'N/A' }})</span>
              </div>
              <div class="summary-item" *ngIf="data.batchName">
                <span class="label">Course / Batch:</span>
                <span class="val text-muted">{{ data.batchName }}</span>
              </div>
              <div class="summary-item" *ngIf="data.title">
                <span class="label">Particular:</span>
                <span class="val">{{ data.title }}</span>
              </div>
            </div>

            <div class="amount-strip">
              <div class="amt-box">
                <span class="amt-lbl">Total Billed</span>
                <span class="amt-val">₹{{ data.totalAmount | number:'1.2-2' }}</span>
              </div>
              <div class="amt-box paid-box">
                <span class="amt-lbl">Collected Fees</span>
                <span class="amt-val text-green">₹{{ data.paidAmount | number:'1.2-2' }}</span>
              </div>
              <div class="amt-box due-box">
                <span class="amt-lbl">Pending Due</span>
                <span class="amt-val text-red">₹{{ data.dueAmount | number:'1.2-2' }}</span>
              </div>
            </div>
          </div>

          <!-- PARTIAL PAYMENT OPTIONS (When Paid > 0) -->
          <div class="partial-options-section" *ngIf="data.paidAmount > 0">
            <h4 class="section-title">
              <mat-icon>tune</mat-icon>
              Choose Settlement Action for Collected Fees (₹{{ data.paidAmount | number:'1.2-2' }})
            </h4>

            <div class="action-cards-grid">
              <!-- Option A: Retain & Waive Remaining Due -->
              <div 
                class="action-card" 
                [class.selected]="selectedAction === 'WaiveAndClose'"
                (click)="setAction('WaiveAndClose')"
              >
                <div class="card-radio-header">
                  <div class="radio-indicator">
                    <mat-icon *ngIf="selectedAction === 'WaiveAndClose'">check_circle</mat-icon>
                    <mat-icon *ngIf="selectedAction !== 'WaiveAndClose'">radio_button_unchecked</mat-icon>
                  </div>
                  <div class="card-title-group">
                    <div class="card-title">Retain Collected &amp; Waive Remaining Due</div>
                    <div class="card-subtitle-hi">जमा ₹{{ data.paidAmount | number:'1.2-2' }} रखें और बाकी ₹{{ data.dueAmount | number:'1.2-2' }} माफ करें</div>
                  </div>
                  <span class="badge-recommended">Recommended</span>
                </div>

                <div class="card-body">
                  <ul class="impact-list">
                    <li>
                      <mat-icon class="bullet-icon check-green">check</mat-icon>
                      <span><strong>School retains ₹{{ data.paidAmount | number:'1.2-2' }}</strong> in accounts. Existing receipts &amp; Day Book entries remain intact.</span>
                    </li>
                    <li>
                      <mat-icon class="bullet-icon check-green">check</mat-icon>
                      <span>Remaining balance due of <strong>₹{{ data.dueAmount | number:'1.2-2' }} is waived off</strong> (no future dues or collection reminders).</span>
                    </li>
                    <li>
                      <mat-icon class="bullet-icon check-green">check</mat-icon>
                      <span>Invoice is marked <strong>"Paid / Settled"</strong>, clearing the student's ledger.</span>
                    </li>
                  </ul>
                </div>
              </div>

              <!-- Option B: Refund to Parent & Void Invoice -->
              <div 
                class="action-card" 
                [class.selected]="selectedAction === 'RefundAndCancel'"
                [class.card-danger]="true"
                (click)="setAction('RefundAndCancel')"
              >
                <div class="card-radio-header">
                  <div class="radio-indicator danger-radio">
                    <mat-icon *ngIf="selectedAction === 'RefundAndCancel'">check_circle</mat-icon>
                    <mat-icon *ngIf="selectedAction !== 'RefundAndCancel'">radio_button_unchecked</mat-icon>
                  </div>
                  <div class="card-title-group">
                    <div class="card-title">Refund to Parent &amp; Void Invoice</div>
                    <div class="card-subtitle-hi">पैरेंट को ₹{{ data.paidAmount | number:'1.2-2' }} रिफंड करें और इनवॉइस रद्द करें</div>
                  </div>
                  <span class="badge-reversal">Full Reversal</span>
                </div>

                <div class="card-body">
                  <ul class="impact-list">
                    <li>
                      <mat-icon class="bullet-icon check-red">replay</mat-icon>
                      <span>All <strong>₹{{ data.paidAmount | number:'1.2-2' }} collected payments will be reversed</strong> and removed from Day Book &amp; cash accounts.</span>
                    </li>
                    <li>
                      <mat-icon class="bullet-icon check-red">cancel</mat-icon>
                      <span>All payment receipts for this invoice are revoked and marked void.</span>
                    </li>
                    <li>
                      <mat-icon class="bullet-icon check-red">block</mat-icon>
                      <span>Invoice is marked <strong>"Cancelled"</strong> with ₹0 dues.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <!-- ZERO PAYMENT NOTICE (When Paid == 0) -->
          <div class="zero-payment-notice" *ngIf="data.paidAmount === 0">
            <mat-icon class="info-icon">info</mat-icon>
            <div class="notice-text">
              <strong>Voiding Unpaid Invoice:</strong> No payments have been collected on this invoice. 
              Confirming will mark this invoice as <em>CANCELLED / VOID</em> and eliminate the pending due of 
              <strong>₹{{ data.dueAmount | number:'1.2-2' }}</strong> from {{ data.studentName }}'s account.
            </div>
          </div>

          <!-- REASON SELECTION & REMARKS -->
          <div class="form-section">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Select Reason / Purpose (कारण चुनें)</mat-label>
              <mat-select formControlName="selectedReason">
                <mat-option *ngFor="let r of predefinedReasons" [value]="r.value">
                  {{ r.label }}
                </mat-option>
              </mat-select>
              <mat-error *ngIf="cancelForm.get('selectedReason')?.hasError('required')">
                Please select a valid reason
              </mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>
                {{ cancelForm.get('selectedReason')?.value === 'Other' ? 'Specify Custom Reason (अनिवार्य कारण)' : 'Additional Audit Remarks / Notes (टिप्पणी - वैकल्पिक)' }}
              </mat-label>
              <textarea
                matInput
                rows="2"
                formControlName="customReason"
                [placeholder]="cancelForm.get('selectedReason')?.value === 'Other' 
                  ? 'e.g. Student relocated to another city; special approval by Director...' 
                  : 'Add any specific notes for audit trail...'"
              ></textarea>
              <mat-error *ngIf="cancelForm.get('customReason')?.hasError('required')">
                Please provide details for the custom reason
              </mat-error>
            </mat-form-field>

            <div class="student-left-notice" *ngIf="cancelForm.get('selectedReason')?.value === 'Student Left / Discontinued'">
              <mat-icon>school</mat-icon>
              <span>
                <strong>Student Registry Sync:</strong> Selecting <em>Student Left / Discontinued</em> will also update the student directory to mark <strong>{{ data.studentName }}</strong> as Left/Inactive so no further monthly tuition invoices or fee reminders are generated.
              </span>
            </div>
          </div>

          <!-- Summary Confirmation Alert -->
          <div class="confirmation-summary-alert" [class.alert-danger]="selectedAction === 'RefundAndCancel'">
            <mat-icon>{{ selectedAction === 'RefundAndCancel' ? 'warning' : 'verified_user' }}</mat-icon>
            <div class="alert-content">
              <ng-container *ngIf="data.paidAmount > 0 && selectedAction === 'WaiveAndClose'">
                <strong>Summary:</strong> Retaining ₹{{ data.paidAmount | number:'1.2-2' }} collected • Waiving remaining balance ₹{{ data.dueAmount | number:'1.2-2' }} • Invoice status will be <strong>Paid / Settled</strong>.
              </ng-container>
              <ng-container *ngIf="data.paidAmount > 0 && selectedAction === 'RefundAndCancel'">
                <strong>Summary:</strong> Reversing ₹{{ data.paidAmount | number:'1.2-2' }} payments • Revoking receipts from Day Book • Invoice status will be <strong>Cancelled</strong>.
              </ng-container>
              <ng-container *ngIf="data.paidAmount === 0">
                <strong>Summary:</strong> Marking invoice as VOID • Cancelling pending balance ₹{{ data.dueAmount | number:'1.2-2' }}.
              </ng-container>
            </div>
          </div>
        </mat-dialog-content>

        <!-- ACTION BUTTONS -->
        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-button type="button" class="btn-cancel" (click)="onClose()" [disabled]="submitting">
            Go Back
          </button>
          
          <button
            mat-raised-button
            [class]="getSubmitButtonClass()"
            type="submit"
            [disabled]="cancelForm.invalid || submitting"
          >
            <mat-spinner diameter="18" *ngIf="submitting" class="spinner"></mat-spinner>
            <mat-icon *ngIf="!submitting">{{ getSubmitButtonIcon() }}</mat-icon>
            <span>{{ getSubmitButtonText() }}</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
  `,
  styles: [`
    .cancel-dialog-container {
      padding: 0;
      box-sizing: border-box;
      width: 100%;
      max-width: 680px;
    }

    /* Standard Light-Blue Gradient Header (Strict ERP UI Rule) */
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px 24px 16px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;

      .icon-circle {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);

        mat-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
        }
      }

      .header-text {
        flex: 1 1 auto;
        h2 {
          margin: 0;
          font-size: 1.18rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.3;
        }
        .subtitle {
          margin: 3px 0 0;
          font-size: 0.8rem;
          color: #3b82f6;
        }
      }

      .close-btn { 
        color: #64748b; 
        &:hover { color: #1e293b; }
      }
    }

    .dialog-content {
      padding: 18px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-height: 75vh;
      overflow-y: auto;
    }

    /* Invoice Summary Card */
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;

      .summary-top {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 8px 16px;
        font-size: 0.86rem;

        .summary-item {
          display: flex;
          align-items: center;
          gap: 6px;

          .label {
            color: #64748b;
            font-size: 0.82rem;
          }
          .val {
            color: #1e293b;
          }
          .font-semibold {
            font-weight: 600;
          }
          .text-muted {
            color: #64748b;
          }
          .inv-badge {
            font-family: monospace;
            background: #e2e8f0;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.82rem;
            font-weight: 600;
            color: #0f172a;
          }
        }
      }

      .amount-strip {
        display: flex;
        gap: 12px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 10px 14px;

        .amt-box {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;

          .amt-lbl {
            font-size: 0.72rem;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 600;
            letter-spacing: 0.4px;
          }
          .amt-val {
            font-size: 1.05rem;
            font-weight: 700;
            color: #0f172a;
            margin-top: 2px;
          }

          .text-green { color: #16a34a; }
          .text-red { color: #dc2626; }
        }

        .paid-box {
          border-left: 1px solid #e2e8f0;
          border-right: 1px solid #e2e8f0;
        }
      }
    }

    /* Partial Options Selection */
    .partial-options-section {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .section-title {
        margin: 0;
        font-size: 0.92rem;
        font-weight: 700;
        color: #1e3a8a;
        display: flex;
        align-items: center;
        gap: 6px;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #2563eb;
        }
      }
    }

    .action-cards-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .action-card {
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 16px;
      cursor: pointer;
      background: #ffffff;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;

      &:hover {
        border-color: #93c5fd;
        background: #f8fafc;
      }

      &.selected {
        border-color: #2563eb;
        background: #eff6ff;
        box-shadow: 0 4px 12px -2px rgba(37,99,235,0.15);

        .card-radio-header .radio-indicator mat-icon {
          color: #2563eb;
        }
      }

      &.card-danger.selected {
        border-color: #dc2626;
        background: #fef2f2;
        box-shadow: 0 4px 12px -2px rgba(220,38,38,0.15);

        .card-radio-header .danger-radio mat-icon {
          color: #dc2626;
        }
      }

      .card-radio-header {
        display: flex;
        align-items: flex-start;
        gap: 10px;

        .radio-indicator {
          mat-icon {
            font-size: 22px;
            width: 22px;
            height: 22px;
            color: #94a3b8;
          }
        }

        .card-title-group {
          flex: 1;

          .card-title {
            font-size: 0.94rem;
            font-weight: 700;
            color: #0f172a;
          }
          .card-subtitle-hi {
            font-size: 0.8rem;
            color: #64748b;
            margin-top: 1px;
          }
        }

        .badge-recommended {
          font-size: 0.72rem;
          font-weight: 700;
          background: #dbeafe;
          color: #1e40af;
          padding: 2px 8px;
          border-radius: 12px;
          border: 1px solid #bfdbfe;
          white-space: nowrap;
        }

        .badge-reversal {
          font-size: 0.72rem;
          font-weight: 700;
          background: #fee2e2;
          color: #991b1b;
          padding: 2px 8px;
          border-radius: 12px;
          border: 1px solid #fecaca;
          white-space: nowrap;
        }
      }

      .card-body {
        margin-top: 10px;
        padding-left: 32px;

        .impact-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 6px;

          li {
            display: flex;
            align-items: flex-start;
            gap: 6px;
            font-size: 0.82rem;
            color: #334155;
            line-height: 1.4;

            .bullet-icon {
              font-size: 16px;
              width: 16px;
              height: 16px;
              flex-shrink: 0;
              margin-top: 1px;
            }

            .check-green { color: #16a34a; }
            .check-red { color: #dc2626; }
          }
        }
      }
    }

    /* Zero Payment Notice */
    .zero-payment-notice {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 12px 14px;
      font-size: 0.84rem;
      color: #1e40af;
      line-height: 1.45;

      .info-icon {
        color: #2563eb;
        font-size: 20px;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        margin-top: 1px;
      }
    }

    /* Form Section */
    .form-section {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .full-width {
      width: 100%;
    }

    .student-left-notice {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #fef3c7;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 0.82rem;
      color: #92400e;
      line-height: 1.45;
      margin-bottom: 6px;

      mat-icon {
        color: #d97706;
        font-size: 20px;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        margin-top: 1px;
      }
    }

    /* Confirmation Summary Alert */
    .confirmation-summary-alert {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 0.83rem;
      color: #166534;

      mat-icon {
        color: #16a34a;
        font-size: 20px;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }

      &.alert-danger {
        background: #fef2f2;
        border-color: #fecaca;
        color: #991b1b;

        mat-icon {
          color: #dc2626;
        }
      }
    }

    /* Actions */
    .dialog-actions {
      padding: 14px 24px 16px;
      gap: 12px;
      border-top: 1px solid #f1f5f9;
    }

    .btn-cancel {
      color: #64748b;
    }

    .btn-settle-confirm {
      background-color: #2563eb !important;
      color: #ffffff !important;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;

      &:hover {
        background-color: #1d4ed8 !important;
      }

      &[disabled] {
        background-color: #93c5fd !important;
        color: #ffffff !important;
        opacity: 0.7;
      }
    }

    .btn-danger-confirm {
      background-color: #dc2626 !important;
      color: #ffffff !important;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;

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

    @media (max-width: 640px) {
      .cancel-dialog-container {
        min-width: 100%;
      }
      .summary-card .summary-top {
        grid-template-columns: 1fr;
      }
      .action-card .card-body {
        padding-left: 0;
      }
    }
  `]
})
export class CancelInvoiceDialogComponent implements OnInit {
  cancelForm!: FormGroup;
  submitting = false;

  readonly predefinedReasons = [
    { value: 'Student Left / Discontinued', label: '🎓 Student Left / Course Discontinuation (छात्र ने छोड़ा)' },
    { value: 'Fee Waiver / Management Concession', label: '🎁 Fee Waiver / Management Concession (विशेष छूट / माफी)' },
    { value: 'Parent Financial Hardship', label: '🤝 Parent Financial Hardship (अभिभावक की आर्थिक कठिनाई)' },
    { value: 'Invoice Generated in Error / Duplicate', label: '❌ Invoice Generated in Error / Duplicate (गलती से बना)' },
    { value: 'Batch Transfer / Re-enrollment', label: '🔄 Batch / Stream Transfer (बैच या स्ट्रीम ट्रांसफर)' },
    { value: 'Other', label: '📝 Other (अन्य - नीचे विवरण लिखें)' }
  ];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CancelInvoiceDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CancelInvoiceDialogData,
    private feesService: FeesService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    // If paid > 0, default to 'WaiveAndClose' (most common and safe standard practice for dropouts)
    const defaultAction = this.data.paidAmount > 0 ? 'WaiveAndClose' : 'VoidOnly';

    this.cancelForm = this.fb.group({
      partialAction: [defaultAction, Validators.required],
      selectedReason: ['Student Left / Discontinued', Validators.required],
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

  get selectedAction(): string {
    return this.cancelForm?.get('partialAction')?.value || 'WaiveAndClose';
  }

  setAction(action: 'WaiveAndClose' | 'RefundAndCancel'): void {
    this.cancelForm.get('partialAction')?.setValue(action);
  }

  getSubmitButtonText(): string {
    if (this.data.paidAmount > 0) {
      return this.selectedAction === 'WaiveAndClose'
        ? 'Confirm Waiver & Settle Invoice'
        : 'Process Refund & Void Invoice';
    }
    return 'Confirm & Void Invoice';
  }

  getSubmitButtonIcon(): string {
    if (this.data.paidAmount > 0) {
      return this.selectedAction === 'WaiveAndClose' ? 'task_alt' : 'replay';
    }
    return 'block';
  }

  getSubmitButtonClass(): string {
    if (this.data.paidAmount > 0 && this.selectedAction === 'WaiveAndClose') {
      return 'btn-settle-confirm';
    }
    return 'btn-danger-confirm';
  }

  onSubmit(): void {
    if (this.cancelForm.invalid || this.submitting) return;

    const val = this.cancelForm.value;
    const finalReason = val.selectedReason === 'Other' && val.customReason?.trim()
      ? `Other: ${val.customReason.trim()}`
      : (val.customReason?.trim() ? `${val.selectedReason} (${val.customReason.trim()})` : val.selectedReason);

    const action = this.data.paidAmount > 0 ? val.partialAction : undefined;

    this.submitting = true;
    this.feesService.cancelInvoice(this.data.invoiceId, finalReason, action).subscribe({
      next: (res) => {
        this.submitting = false;
        this.dialogRef.close({ 
          cancelled: true, 
          action: action || 'VoidOnly', 
          reason: finalReason, 
          res 
        });
      },
      error: (err) => {
        this.submitting = false;
        this.confirmDialog.alert(
          'Action Failed', 
          err?.error?.message || 'Failed to process invoice request. Please try again.', 
          'danger'
        );
      }
    });
  }

  onClose(): void {
    this.dialogRef.close(null);
  }
}
