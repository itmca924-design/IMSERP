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
import { FeesService, StudentLibraryDues } from '../../core/services/fees.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

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

        <!-- Library Dues Card (if student has pending library fines) -->
        <div class="library-fine-box" *ngIf="libraryDues && libraryDues.pendingFineAmount > 0">
          <div class="fine-header">
            <div class="fine-badge">
              <div class="icon-circle">
                <mat-icon class="book-icon">local_library</mat-icon>
              </div>
              <div class="fine-badge-text">
                <span class="fine-title">Pending Library Overdue Fine</span>
                <span class="fine-sub">{{ libraryDues.pendingFinesCount }} returned book(s) have unsettled late fines</span>
              </div>
            </div>
            <div class="fine-amt">₹{{ libraryDues.pendingFineAmount | number:'1.2-2' }}</div>
          </div>

          <div class="fine-books-list">
            <div *ngFor="let item of libraryDues.pendingFines" class="book-chip">
              <mat-icon class="chip-icon">menu_book</mat-icon>
              <span class="book-title">{{ item.bookTitle }}</span>
              <span class="chip-sep">•</span>
              <span class="acc-tag">{{ item.accessionNumber }}</span>
              <span class="chip-sep">•</span>
              <span class="overdue-tag">{{ item.overdueDays }}d late</span>
              <span class="unreturned-pill" *ngIf="!item.returnDate">Not Returned Yet</span>
              <strong class="chip-fine">₹{{ item.fineAmount | number:'1.2-2' }}</strong>
            </div>
          </div>

          <div class="include-fine-row">
            <mat-checkbox formControlName="includeLibraryFine" color="primary" (change)="onIncludeFineToggle($event.checked)">
              <span class="chk-label">
                <strong>Collect & Settle Library Fine (₹{{ libraryDues.pendingFineAmount | number:'1.2-2' }})</strong>
                <small class="chk-subtext">Will be added as a separate line item on the official fee receipt</small>
              </span>
            </mat-checkbox>
          </div>
        </div>

        <!-- Active Borrowed Overdue Warning (Books not yet returned) -->
        <div class="active-overdue-alert" *ngIf="libraryDues && libraryDues.activeOverdueBooksCount > 0">
          <mat-icon class="alert-icon">info</mat-icon>
          <div class="alert-text">
            <strong>Advisory:</strong> Student has <strong>{{ libraryDues.activeOverdueBooksCount }} active borrowed book(s) overdue</strong> not yet returned to the library. Accrued late fine till today is computed above. Please remind parent/student to return the physical book to the shelf.
          </div>
        </div>

        <div class="form-grid">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Total Amount to Collect (₹)</mat-label>
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
      min-width: 520px;
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
      margin-bottom: 14px;

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
          font-size: 1.25rem;
          color: #dc2626;
        }
      }
    }
    .library-fine-box {
      background: #fdf4ff;
      border: 1px solid #f0abfc;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 14px;

      .fine-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;

        .fine-badge {
          display: flex;
          align-items: center;
          gap: 8px;

          .icon-circle {
            background: #fae8ff;
            color: #a21caf;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            .book-icon {
              font-size: 17px;
              width: 17px;
              height: 17px;
            }
          }

          .fine-badge-text {
            display: flex;
            flex-direction: column;
            .fine-title {
              font-size: 0.88rem;
              font-weight: 700;
              color: #86198f;
            }
            .fine-sub {
              font-size: 0.74rem;
              color: #a21caf;
            }
          }
        }

        .fine-amt {
          font-size: 1.15rem;
          font-weight: 700;
          color: #c026d3;
        }
      }

      .fine-books-list {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin-bottom: 10px;

        .book-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #ffffff;
          border: 1px solid #f5d0fe;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 0.78rem;
          color: #475569;

          .chip-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
            color: #a21caf;
          }
          .book-title {
            font-weight: 600;
            color: #1e293b;
          }
          .chip-sep {
            color: #cbd5e1;
          }
          .acc-tag {
            background: #f1f5f9;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 0.72rem;
            color: #64748b;
          }
          .overdue-tag {
            color: #dc2626;
            font-size: 0.72rem;
            font-weight: 500;
          }
          .unreturned-pill {
            font-size: 0.68rem;
            padding: 1px 6px;
            border-radius: 4px;
            background: #fef3c7;
            color: #b45309;
            font-weight: 600;
          }
          .chip-fine {
            margin-left: auto;
            color: #a21caf;
            font-weight: 700;
          }
        }
      }

      .include-fine-row {
        background: #ffffff;
        border-radius: 6px;
        padding: 6px 10px;
        border: 1px solid #f5d0fe;

        .chk-label {
          display: flex;
          flex-direction: column;
          color: #86198f;
          .chk-subtext {
            color: #64748b;
            font-size: 0.72rem;
          }
        }
      }
    }
    .active-overdue-alert {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 14px;
      font-size: 0.8rem;
      color: #92400e;

      .alert-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #d97706;
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
      width: 100%;
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
  libraryDues?: StudentLibraryDues;
  baseTuitionAmount: number = 0;

  constructor(
    private fb: FormBuilder,
    private feesService: FeesService,
    private confirmDialog: ConfirmDialogService,
    private dialogRef: MatDialogRef<FeeCollectionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FeeDialogData
  ) {}

  ngOnInit(): void {
    this.baseTuitionAmount = this.data.initialAmount !== undefined
      ? this.data.initialAmount
      : (this.data.totalOutstandingDue > 0 ? this.data.totalOutstandingDue : 3500);

    const defaultRemarks = this.data.selectedInvoicesCount && this.data.selectedInvoicesCount > 1
      ? `Multi-Invoice Settlement (${this.data.selectedInvoicesCount} Invoices)`
      : 'Fee Payment';

    this.feeForm = this.fb.group({
      amountPaid: [this.baseTuitionAmount, [Validators.required, Validators.min(1)]],
      mode: [1, [Validators.required]], // Default to UPI
      transactionRef: [''],
      remarks: [defaultRemarks],
      sendWhatsAppReceipt: [true],
      includeLibraryFine: [true]
    });

    // Fetch student's pending library fines in background
    this.loadStudentLibraryDues();
  }

  loadStudentLibraryDues(): void {
    this.feesService.getStudentLibraryDues(this.data.studentId).subscribe({
      next: (dues) => {
        console.log('Fetched student library dues:', dues);
        this.libraryDues = dues;
        if (dues && dues.pendingFineAmount > 0) {
          // If library fine exists and toggle is checked, auto-adjust total amount
          if (this.feeForm.get('includeLibraryFine')?.value) {
            this.feeForm.patchValue({
              amountPaid: this.baseTuitionAmount + dues.pendingFineAmount
            });
          }
        }
      },
      error: (err) => {
        console.warn('Library dues endpoint error (backend may need restart):', err);
      }
    });
  }

  onIncludeFineToggle(included: boolean): void {
    const libFine = this.libraryDues?.pendingFineAmount || 0;
    if (included) {
      this.feeForm.patchValue({
        amountPaid: this.baseTuitionAmount + libFine
      });
    } else {
      this.feeForm.patchValue({
        amountPaid: this.baseTuitionAmount
      });
    }
  }

  onSubmit(): void {
    if (this.feeForm.invalid) return;

    this.saving = true;
    const formVal = this.feeForm.value;
    const includeLibFine = this.libraryDues && this.libraryDues.pendingFineAmount > 0 && formVal.includeLibraryFine;

    const payload = {
      studentId: this.data.studentId,
      amountPaid: formVal.amountPaid,
      mode: formVal.mode,
      transactionRef: formVal.transactionRef,
      remarks: formVal.remarks,
      sendWhatsAppReceipt: formVal.sendWhatsAppReceipt,
      includeLibraryFine: includeLibFine,
      libraryCirculationIds: includeLibFine && this.libraryDues ? this.libraryDues.pendingFines.map(f => f.circulationId) : []
    };

    this.feesService.collectFeeFifo(payload).subscribe({
      next: (res) => {
        this.saving = false;
        this.dialogRef.close(res);
      },
      error: (err) => {
        this.saving = false;
        this.confirmDialog.alert('Collection Failed', err?.error?.message || 'Error processing fee collection', 'danger');
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

