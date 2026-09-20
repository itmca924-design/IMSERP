import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FeesService, StudentLibraryDues, FeeInvoiceItem, FeeItemPayment } from '../../core/services/fees.service';
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
  hostelInfo?: string;
  items?: FeeInvoiceItem[];
}

export interface FeeCollectionItemRow {
  id: string;
  headName: string;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  selected: boolean;
  payingAmount: number;
}

@Component({
  selector: 'app-fee-collection-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <div class="dialog-header-wrap">
      <div class="header-titles">
        <mat-icon class="header-icon">payments</mat-icon>
        <div>
          <h2 mat-dialog-title class="dialog-header">Collect Fee &amp; Settle Dues</h2>
          <p class="dialog-sub">Itemized Fee Heads Settlement &amp; Official Receipt Generation</p>
        </div>
      </div>
      <button mat-icon-button type="button" class="close-x-btn" (click)="onCancel()" [disabled]="saving">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <form [formGroup]="feeForm" (ngSubmit)="onSubmit()">
      <mat-dialog-content class="dialog-content">
        <!-- Student Info Header Card -->
        <div class="student-info-box">
          <div class="info-details">
            <span class="st-name">{{ data.studentName }} ({{ data.rollNumber }})</span>
            <span class="st-sub">{{ data.batchName }} | WA: {{ data.parentWhatsAppPhone }}</span>
            <div *ngIf="data.hostelInfo" class="hostel-badge">
              <mat-icon class="hostel-icon">home</mat-icon>
              <span>🏠 Hosteler: <strong>{{ data.hostelInfo }}</strong></span>
            </div>
            <div *ngIf="data.selectedInvoicesCount && data.selectedInvoicesCount > 1" class="multi-select-pill">
              <mat-icon class="mini-icon">layers</mat-icon>
              <span>Settling <strong>{{ data.selectedInvoicesCount }} Invoices</strong> in this payment</span>
            </div>
          </div>
          <div class="due-badge">
            <span class="due-label">{{ data.selectedInvoicesCount && data.selectedInvoicesCount > 1 ? 'Selected Invoices Total:' : 'Total Net Outstanding:' }}</span>
            <strong class="due-amount">₹{{ (data.initialAmount !== undefined ? data.initialAmount : data.totalOutstandingDue) | number:'1.2-2' }}</strong>
          </div>
        </div>

        <!-- Fee Heads Itemized Checklist Table -->
        <div class="heads-breakdown-card" *ngIf="itemRows.length > 0">
          <div class="breakdown-header">
            <div class="header-left">
              <mat-checkbox
                color="primary"
                [checked]="isAllSelected()"
                [indeterminate]="isSomeSelected()"
                (change)="onMasterCheckboxToggle($event.checked)">
                <span class="card-title">Select Fee Heads to Settle ({{ selectedCount }} of {{ itemRows.length }})</span>
              </mat-checkbox>
            </div>
            <div class="header-right">
              <span class="heads-total-badge">
                Selected Heads: <strong>₹{{ selectedItemsTotal | number:'1.2-2' }}</strong>
              </span>
            </div>
          </div>

          <div class="heads-table-wrap">
            <table class="heads-table">
              <thead>
                <tr>
                  <th style="width: 40px; text-align: center;">Pay</th>
                  <th>Fee Head Particulars</th>
                  <th class="text-right">Total Fee</th>
                  <th class="text-right">Due Balance</th>
                  <th class="text-right" style="width: 140px;">Paying Now (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of itemRows" [class.row-selected]="row.selected" [class.row-disabled]="row.dueAmount <= 0">
                  <td class="chk-cell" style="text-align: center;">
                    <mat-checkbox
                      color="primary"
                      [checked]="row.selected"
                      (change)="onItemCheckboxToggle(row, $event.checked)"
                      [disabled]="row.dueAmount <= 0">
                    </mat-checkbox>
                  </td>
                  <td>
                    <div class="head-info">
                      <span class="head-name">{{ row.headName }}</span>
                      <span class="head-stream-badge" [ngClass]="getStreamBadgeClass(row.headName)">
                        {{ getStreamBadgeText(row.headName) }}
                      </span>
                    </div>
                  </td>
                  <td class="text-right fee-col">₹{{ row.amount | number:'1.2-2' }}</td>
                  <td class="text-right due-col">
                    <strong [class.due-positive]="row.dueAmount > 0" [class.due-zero]="row.dueAmount === 0">
                      ₹{{ row.dueAmount | number:'1.2-2' }}
                    </strong>
                  </td>
                  <td class="text-right pay-col">
                    <div class="paying-input-wrap">
                      <span class="curr-symbol">₹</span>
                      <input
                        type="number"
                        class="paying-input"
                        [disabled]="!row.selected || row.dueAmount <= 0"
                        [value]="row.payingAmount"
                        (input)="onItemPayingAmountChange(row, +$any($event.target).value)"
                        [max]="row.dueAmount"
                        min="0" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
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
                <strong>Collect &amp; Settle Library Fine (₹{{ libraryDues.pendingFineAmount | number:'1.2-2' }})</strong>
                <small class="chk-subtext">Will be added as a separate line item on the official fee receipt</small>
              </span>
            </mat-checkbox>
          </div>
        </div>

        <!-- Payment Details Form Grid -->
        <div class="form-grid">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Total Amount to Collect (₹)</mat-label>
            <input matInput type="number" formControlName="amountPaid" placeholder="e.g. 4500" />
            <mat-icon matSuffix color="primary">currency_rupee</mat-icon>
            <mat-hint *ngIf="itemRows.length > 0">Automatically computed from selected fee heads above</mat-hint>
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
        <button mat-raised-button color="primary" type="submit" [disabled]="feeForm.invalid || saving || (feeForm.get('amountPaid')?.value || 0) <= 0">
          <mat-spinner diameter="20" *ngIf="saving" class="spinner"></mat-spinner>
          <mat-icon *ngIf="!saving">receipt_long</mat-icon>
          <span>Confirm &amp; Issue Receipt</span>
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`
    .dialog-header-wrap {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%);
      border-bottom: 1px solid #bfdbfe;

      .header-titles {
        display: flex;
        align-items: center;
        gap: 12px;

        .header-icon {
          font-size: 28px;
          width: 28px;
          height: 28px;
          color: #0284c7;
        }

        .dialog-header {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 700;
          color: #0f172a;
        }

        .dialog-sub {
          margin: 2px 0 0;
          font-size: 0.8rem;
          color: #64748b;
        }
      }

      .close-x-btn {
        color: #64748b;
      }
    }

    .dialog-content {
      min-width: 580px;
      max-width: 680px;
      padding: 16px 24px;
      max-height: 80vh;
      overflow-y: auto;
    }

    .student-info-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
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
          font-size: 1.05rem;
          color: #0f172a;
        }
        .st-sub {
          font-size: 0.82rem;
          color: #64748b;
        }
        .hostel-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          margin-top: 4px;
          background: #fdf2f8;
          color: #be185d;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.78rem;
          border: 1px solid #fbcfe8;
          .hostel-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
          }
        }
        .multi-select-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
          background: #eff6ff;
          color: #1d4ed8;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.78rem;
          .mini-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
          }
        }
      }

      .due-badge {
        text-align: right;
        .due-label {
          display: block;
          font-size: 0.75rem;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 600;
        }
        .due-amount {
          font-size: 1.35rem;
          color: #dc2626;
          font-weight: 800;
        }
      }
    }

    /* Fee Heads Breakdown Card */
    .heads-breakdown-card {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 16px;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);

      .breakdown-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;

        .card-title {
          font-size: 0.9rem;
          font-weight: 700;
          color: #1e293b;
        }

        .heads-total-badge {
          font-size: 0.85rem;
          color: #0369a1;
          background: #e0f2fe;
          padding: 3px 10px;
          border-radius: 6px;
          border: 1px solid #bae6fd;
        }
      }

      .heads-table-wrap {
        max-height: 250px;
        overflow-y: auto;
      }

      .heads-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;

        thead {
          background: #f1f5f9;
          position: sticky;
          top: 0;
          z-index: 1;

          th {
            padding: 8px 10px;
            font-size: 0.75rem;
            font-weight: 600;
            color: #475569;
            text-transform: uppercase;
            border-bottom: 1px solid #cbd5e1;
          }
        }

        tbody {
          tr {
            border-bottom: 1px solid #f1f5f9;
            transition: background 0.15s ease;

            &:hover {
              background: #f8fafc;
            }

            &.row-selected {
              background: #f0fdf4;
            }

            &.row-disabled {
              opacity: 0.5;
            }

            td {
              padding: 8px 10px;
              vertical-align: middle;
            }
          }
        }

        .head-info {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;

          .head-name {
            font-weight: 600;
            color: #1e293b;
          }

          .head-stream-badge {
            font-size: 0.68rem;
            padding: 1px 6px;
            border-radius: 4px;
            font-weight: 500;

            &.badge-school {
              background: #e0f2fe;
              color: #0369a1;
            }
            &.badge-coaching {
              background: #fdf4ff;
              color: #9333ea;
            }
            &.badge-hostel {
              background: #fef2f2;
              color: #dc2626;
            }
            &.badge-general {
              background: #f1f5f9;
              color: #475569;
            }
          }
        }

        .fee-col {
          color: #64748b;
        }

        .due-col {
          .due-positive {
            color: #dc2626;
          }
          .due-zero {
            color: #16a34a;
          }
        }

        .pay-col {
          .paying-input-wrap {
            display: inline-flex;
            align-items: center;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 2px 6px;
            width: 120px;

            &:focus-within {
              border-color: #2563eb;
              box-shadow: 0 0 0 2px rgba(37,99,235,0.15);
            }

            .curr-symbol {
              font-size: 0.8rem;
              color: #64748b;
              margin-right: 2px;
            }

            .paying-input {
              width: 100%;
              border: none;
              outline: none;
              text-align: right;
              font-weight: 600;
              font-size: 0.88rem;
              color: #0f172a;
              background: transparent;

              &:disabled {
                color: #94a3b8;
              }
            }
          }
        }
      }
    }

    /* Library fine box */
    .library-fine-box {
      background: #fdf4ff;
      border: 1px solid #f0abfc;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 16px;

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
              font-size: 0.76rem;
              color: #a21caf;
            }
          }
        }

        .fine-amt {
          font-size: 1.1rem;
          font-weight: 700;
          color: #a21caf;
        }
      }

      .fine-books-list {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin-bottom: 8px;

        .book-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #ffffff;
          border: 1px solid #f5d0fe;
          border-radius: 5px;
          padding: 4px 8px;
          font-size: 0.78rem;

          .chip-icon {
            font-size: 15px;
            width: 15px;
            height: 15px;
            color: #c026d3;
          }
          .book-title {
            font-weight: 600;
            color: #374151;
          }
          .chip-sep {
            color: #d1d5db;
          }
          .acc-tag {
            color: #6b7280;
            font-family: monospace;
          }
          .overdue-tag {
            color: #dc2626;
            font-weight: 600;
          }
          .unreturned-pill {
            background: #fee2e2;
            color: #b91c1c;
            padding: 1px 5px;
            border-radius: 3px;
            font-size: 0.7rem;
            font-weight: 500;
          }
          .chip-fine {
            margin-left: auto;
            color: #a21caf;
          }
        }
      }

      .include-fine-row {
        padding-top: 4px;
        border-top: 1px dashed #f5d0fe;

        .chk-label {
          display: flex;
          flex-direction: column;
          strong {
            font-size: 0.84rem;
            color: #701a75;
          }
          .chk-subtext {
            font-size: 0.74rem;
            color: #9d174d;
          }
        }
      }
    }

    .form-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;

      .full-width {
        flex: 1 1 100%;
        width: 100%;
      }
      .half-width {
        flex: 1 1 calc(50% - 6px);
        min-width: 200px;
      }
    }

    .whatsapp-toggle-box {
      background: #f0f9ff;
      border: 1px dashed #7dd3fc;
      border-radius: 6px;
      padding: 6px 12px;
      margin-top: 4px;
    }

    .dialog-actions {
      padding: 12px 24px 16px;
      border-top: 1px solid #e2e8f0;
      gap: 8px;

      .spinner {
        margin-right: 8px;
      }
    }
  `]
})
export class FeeCollectionDialogComponent implements OnInit {
  feeForm!: FormGroup;
  saving = false;
  libraryDues?: StudentLibraryDues;
  baseTuitionAmount: number = 0;
  itemRows: FeeCollectionItemRow[] = [];

  constructor(
    private fb: FormBuilder,
    private feesService: FeesService,
    private confirmDialog: ConfirmDialogService,
    private dialogRef: MatDialogRef<FeeCollectionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FeeDialogData
  ) {}

  ngOnInit(): void {
    // The actual invoice-level outstanding due (ground truth from server)
    const invoiceDue = this.data.totalOutstandingDue > 0 ? this.data.totalOutstandingDue : 0;

    if (this.data.items && this.data.items.length > 0) {
      this.itemRows = this.data.items.map(it => {
        const due = Math.max(0, it.amount - it.paidAmount);
        return {
          id: it.id,
          headName: it.headName,
          amount: it.amount,
          paidAmount: it.paidAmount,
          dueAmount: due,
          selected: due > 0,
          payingAmount: due
        };
      });

      // Sum of all item-level dues as reported by server
      const itemsDueSum = this.itemRows.reduce((sum, r) => sum + r.dueAmount, 0);

      // ── PERMANENT FIX ──────────────────────────────────────────────────────
      // Scenario: Invoice is Partial (e.g. ₹12,000 paid out of ₹13,000 → due ₹1,000).
      // But item-level PaidAmounts may not be individually broken down yet,
      // causing ALL items to show dueAmount=0 → itemsDueSum=0 → textbox shows 0.
      // Fix: If items sum is 0 but invoice still has outstanding due, we
      // distribute the remaining invoiceDue across item heads using FIFO order.
      if (itemsDueSum === 0 && invoiceDue > 0) {
        let remaining = invoiceDue;
        for (const row of this.itemRows) {
          if (remaining <= 0) break;
          // Items that are not yet fully paid at invoice level
          const headCapacity = Math.max(0, row.amount - row.paidAmount);
          // Re-derive: treat items proportionally if item paidAmount=0 (old invoices)
          // Use item total as capacity if no paidAmount tracked
          const capacity = headCapacity > 0 ? headCapacity : row.amount;
          if (capacity <= 0) continue;
          const allocate = Math.min(remaining, capacity);
          row.dueAmount = allocate;
          row.selected = true;
          row.payingAmount = allocate;
          remaining -= allocate;
        }
      } else if (itemsDueSum > 0 && Math.abs(itemsDueSum - invoiceDue) > 0.01) {
        // Items sum doesn't match invoice due (rounding / sync lag):
        // Scale the paying amounts proportionally so total matches invoiceDue
        const scale = invoiceDue / itemsDueSum;
        let distributed = 0;
        this.itemRows.forEach((r, idx) => {
          if (r.selected && r.dueAmount > 0) {
            if (idx === this.itemRows.length - 1) {
              // Last selected item gets remainder to avoid rounding drift
              r.payingAmount = Math.max(0, invoiceDue - distributed);
            } else {
              r.payingAmount = Math.round(r.dueAmount * scale * 100) / 100;
              distributed += r.payingAmount;
            }
          }
        });
      }
      // ───────────────────────────────────────────────────────────────────────

      this.baseTuitionAmount = this.itemRows.reduce((sum, r) => sum + (r.selected ? r.payingAmount : 0), 0);

      // Safety net: if baseTuitionAmount is still 0 but invoice has a due, bind it directly
      if (this.baseTuitionAmount === 0 && invoiceDue > 0) {
        this.baseTuitionAmount = invoiceDue;
      }
    } else {
      this.baseTuitionAmount = this.data.initialAmount !== undefined
        ? this.data.initialAmount
        : (invoiceDue > 0 ? invoiceDue : 3500);
    }

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

  get selectedCount(): number {
    return this.itemRows.filter(r => r.selected).length;
  }

  get selectedItemsTotal(): number {
    return this.itemRows.reduce((sum, r) => sum + (r.selected ? r.payingAmount : 0), 0);
  }

  isAllSelected(): boolean {
    return this.itemRows.length > 0 && this.itemRows.every(r => r.selected);
  }

  isSomeSelected(): boolean {
    const selected = this.itemRows.filter(r => r.selected).length;
    return selected > 0 && selected < this.itemRows.length;
  }

  onMasterCheckboxToggle(checked: boolean): void {
    this.itemRows.forEach(r => {
      r.selected = checked && r.dueAmount > 0;
      r.payingAmount = r.selected ? r.dueAmount : 0;
    });
    this.recalculateTotal();
  }

  onItemCheckboxToggle(row: FeeCollectionItemRow, checked: boolean): void {
    row.selected = checked;
    row.payingAmount = checked ? row.dueAmount : 0;
    this.recalculateTotal();
  }

  onItemPayingAmountChange(row: FeeCollectionItemRow, amount: number): void {
    const val = Number(amount);
    row.payingAmount = isNaN(val) ? 0 : Math.min(row.dueAmount, Math.max(0, val));
    row.selected = row.payingAmount > 0;
    this.recalculateTotal();
  }

  recalculateTotal(): void {
    const tuitionTotal = this.itemRows.reduce((sum, r) => sum + (r.selected ? r.payingAmount : 0), 0);
    this.baseTuitionAmount = tuitionTotal;
    const libFine = (this.libraryDues && this.libraryDues.pendingFineAmount > 0 && this.feeForm.get('includeLibraryFine')?.value)
      ? this.libraryDues.pendingFineAmount
      : 0;
    // Safety net: if all items are unselected (e.g. user manually unchecked all), don't leave textbox at 0
    // unless they genuinely set it to 0 deliberately
    const newAmount = tuitionTotal + libFine;
    this.feeForm.patchValue({ amountPaid: newAmount }, { emitEvent: false });
  }

  getStreamBadgeClass(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('hostel') || lower.includes('bed') || lower.includes('mess')) return 'badge-hostel';
    if (lower.includes('coaching') || lower.includes('guidance') || lower.includes('study material')) return 'badge-coaching';
    if (lower.includes('computer') || lower.includes('exam') || lower.includes('tuition')) return 'badge-school';
    return 'badge-general';
  }

  getStreamBadgeText(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('hostel') || lower.includes('bed')) return '🏢 Hostel';
    if (lower.includes('mess')) return '🍽️ Mess';
    if (lower.includes('coaching') || lower.includes('guidance')) return '🎯 Coaching';
    if (lower.includes('study material')) return '📚 Material';
    if (lower.includes('computer')) return '💻 Lab';
    if (lower.includes('exam')) return '📝 Exam';
    if (lower.includes('tuition')) return '🏫 School';
    return '📋 Fee';
  }

  loadStudentLibraryDues(): void {
    this.feesService.getStudentLibraryDues(this.data.studentId).subscribe({
      next: (dues) => {
        this.libraryDues = dues;
        if (dues && dues.pendingFineAmount > 0) {
          if (this.feeForm.get('includeLibraryFine')?.value) {
            this.recalculateTotal();
          }
        }
      },
      error: (err) => {
        console.warn('Library dues endpoint error:', err);
      }
    });
  }

  onIncludeFineToggle(included: boolean): void {
    this.recalculateTotal();
  }

  onSubmit(): void {
    if (this.feeForm.invalid) return;

    this.saving = true;
    const formVal = this.feeForm.value;
    const includeLibFine = this.libraryDues && this.libraryDues.pendingFineAmount > 0 && formVal.includeLibraryFine;

    const itemPayments: FeeItemPayment[] | undefined = this.itemRows.length > 0
      ? this.itemRows
          .filter(r => r.selected && r.payingAmount > 0)
          .map(r => ({ itemId: r.id, amount: r.payingAmount }))
      : undefined;

    const payload = {
      studentId: this.data.studentId,
      amountPaid: Number(formVal.amountPaid),
      mode: Number(formVal.mode),
      transactionRef: formVal.transactionRef || undefined,
      remarks: formVal.remarks || undefined,
      sendWhatsAppReceipt: !!formVal.sendWhatsAppReceipt,
      includeLibraryFine: !!includeLibFine,
      libraryCirculationIds: includeLibFine && this.libraryDues ? this.libraryDues.pendingFines.map(f => f.circulationId) : [],
      itemPayments: itemPayments
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
