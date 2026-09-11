import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { FeesService } from '../../core/services/fees.service';

export interface FeeDialogData {
  studentId: string;
  studentName: string;
  rollNumber: string;
  batchName: string;
  parentWhatsAppPhone: string;
  totalOutstandingDue: number;
  initialAmount?: number;
  selectedInvoicesCount?: number;
  selectedInvoicesDetails?: string;
}

@Component({
  selector: 'app-fee-collection-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title class="dialog-header">
      <mat-icon color="primary">payments</mat-icon>
      <span>Collect Fee (FIFO Settlement)</span>
    </h2>

    <form [formGroup]="feeForm" (ngSubmit)="onSubmit()">
      <mat-dialog-content class="dialog-content">
        <!-- Student Info Header Card -->
        <div class="student-info-box">
          <div class="info-details">
            <span class="st-name">{{ data.studentName }} ({{ data.rollNumber }})</span>
            <span class="st-sub">{{ data.batchName }} | WA: {{ data.parentWhatsAppPhone }}</span>
            <div *ngIf="data.selectedInvoicesCount && data.selectedInvoicesCount > 1" class="multi-select-pill">
              <mat-icon class="mini-icon">layers</mat-icon>
              <span>Settling <strong>{{ data.selectedInvoicesCount }} Invoices</strong> in this single payment</span>
            </div>
          </div>
          <div class="due-badge">
            <span class="due-label">{{ data.selectedInvoicesCount && data.selectedInvoicesCount > 1 ? 'Selected Invoices Total:' : 'Total Net Outstanding:' }}</span>
            <strong class="due-amount">₹{{ (data.initialAmount !== undefined ? data.initialAmount : data.totalOutstandingDue) | number:'1.2-2' }}</strong>
          </div>
        </div>

        <div class="form-grid">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Amount to Collect (₹)</mat-label>
            <input matInput type="number" formControlName="amountPaid" placeholder="e.g. 4500" />
            <mat-icon matSuffix color="primary">currency_rupee</mat-icon>
            <mat-error *ngIf="feeForm.get('amountPaid')?.hasError('required')">Amount is required</mat-error>
            <mat-error *ngIf="feeForm.get('amountPaid')?.hasError('min')">Amount must be greater than 0</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Payment Mode</mat-label>
            <mat-select formControlName="mode">
              <mat-option [value]="0">Cash</mat-option>
              <mat-option [value]="1">UPI / GPay / PhonePe</mat-option>
              <mat-option [value]="2">Bank Transfer / NetBanking</mat-option>
              <mat-option [value]="3">Cheque</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Transaction / UTR Ref No</mat-label>
            <input matInput formControlName="transactionRef" placeholder="e.g. UPI/2093849204" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Remarks / Notes</mat-label>
            <input matInput formControlName="remarks" placeholder="Optional notes (e.g. Received at desk)" />
          </mat-form-field>

          <div class="full-width whatsapp-toggle-box">
            <mat-checkbox formControlName="sendWhatsAppReceipt" color="primary">
              <strong style="color: #0284c7;">📲 Send Instant WhatsApp Digital Payment Receipt to Parent</strong>
            </mat-checkbox>
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button type="button" (click)="onCancel()" [disabled]="saving">Cancel</button>
        <button mat-raised-button color="primary" type="submit" [disabled]="feeForm.invalid || saving">
          <mat-spinner diameter="20" *ngIf="saving" class="spinner"></mat-spinner>
          <span>Confirm & Issue Receipt</span>
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
    }
    .dialog-content {
      min-width: 480px;
      padding-top: 12px;
    }
    .student-info-box {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;

      .info-details {
        display: flex;
        flex-direction: column;
        .st-name {
          font-weight: 700;
          font-size: 1rem;
          color: #0369a1;
        }
        .st-sub {
          font-size: 0.8rem;
          color: #64748b;
        }
        .multi-select-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          margin-top: 6px;
          font-size: 0.76rem;
          color: #0369a1;
          background: #e0f2fe;
          padding: 3px 8px;
          border-radius: 4px;
          border: 1px solid #bae6fd;
          width: fit-content;
          .mini-icon {
            font-size: 15px;
            width: 15px;
            height: 15px;
          }
        }
      }
      .due-badge {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        .due-label {
          font-size: 0.75rem;
          color: #64748b;
        }
        .due-amount {
          font-size: 1.2rem;
          color: #dc2626;
        }
      }
    }
    .form-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .full-width {
      width: 100%;
    }
    .half-width {
      flex: 1 1 45%;
    }
    .whatsapp-toggle-box {
      background: #f8fafc;
      padding: 10px;
      border-radius: 6px;
    }
    .dialog-actions {
      padding: 16px 24px;
    }
    .spinner {
      display: inline-block;
      margin-right: 8px;
    }
  `]
})
export class FeeCollectionDialogComponent implements OnInit {
  feeForm!: FormGroup;
  saving = false;

  constructor(
    private fb: FormBuilder,
    private feesService: FeesService,
    private dialogRef: MatDialogRef<FeeCollectionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FeeDialogData
  ) {}

  ngOnInit(): void {
    const defaultAmount = this.data.initialAmount !== undefined
      ? this.data.initialAmount
      : (this.data.totalOutstandingDue > 0 ? this.data.totalOutstandingDue : 3500);

    const defaultRemarks = this.data.selectedInvoicesCount && this.data.selectedInvoicesCount > 1
      ? `Multi-Invoice Settlement (${this.data.selectedInvoicesCount} Invoices)`
      : 'Fee Payment';

    this.feeForm = this.fb.group({
      amountPaid: [defaultAmount, [Validators.required, Validators.min(1)]],
      mode: [1, [Validators.required]], // Default to UPI
      transactionRef: [''],
      remarks: [defaultRemarks],
      sendWhatsAppReceipt: [true]
    });
  }

  onSubmit(): void {
    if (this.feeForm.invalid) return;

    this.saving = true;
    const formVal = this.feeForm.value;

    const payload = {
      studentId: this.data.studentId,
      amountPaid: formVal.amountPaid,
      mode: formVal.mode,
      transactionRef: formVal.transactionRef,
      remarks: formVal.remarks,
      sendWhatsAppReceipt: formVal.sendWhatsAppReceipt
    };

    this.feesService.collectFeeFifo(payload).subscribe({
      next: (res) => {
        this.saving = false;
        this.dialogRef.close(res);
      },
      error: (err) => {
        this.saving = false;
        alert(err?.error?.message || 'Error processing fee collection');
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
