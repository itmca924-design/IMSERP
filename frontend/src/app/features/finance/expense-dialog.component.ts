import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FinanceService, ExpenseVoucherDto, ExpenseCategoryDto, CreateExpenseVoucherDto, UpdateExpenseVoucherDto, ExpensePaymentMode } from '../../core/services/finance.service';
import { BranchService } from '../../core/services/branch.service';

export interface ExpenseDialogData {
  voucher?: ExpenseVoucherDto;
  categories: ExpenseCategoryDto[];
}

@Component({
  selector: 'app-expense-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressBarModule
  ],
  template: `
<div class="expense-modal-container">
  <!-- Strictly compliant light-blue gradient header (AGENTS.md) -->
  <div class="modal-header">
    <div class="header-left">
      <div class="header-icon-box">
        <mat-icon>{{ isEdit ? 'edit_note' : 'receipt_long' }}</mat-icon>
      </div>
      <div>
        <h2 class="modal-title">{{ isEdit ? 'Update Expense Voucher' : 'Record New Expense Voucher' }}</h2>
        <p class="modal-subtitle">खर्च वाउचर प्रविष्टि &bull; <strong>{{ isEdit ? data.voucher?.voucherNo : 'New General / Operating Expense' }}</strong></p>
      </div>
    </div>
    <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
      <mat-icon>close</mat-icon>
    </button>
  </div>

  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

  <div class="modal-body">
    <div class="form-grid">
      <!-- Title -->
      <mat-form-field appearance="outline" class="col-span-2">
        <mat-label>Expense Title / Purpose *</mat-label>
        <input matInput [(ngModel)]="title" placeholder="e.g. Electricity Bill - Main Campus, Bus Diesel, Printer Cartridges" required>
        <mat-icon matPrefix>description</mat-icon>
      </mat-form-field>

      <!-- Category -->
      <mat-form-field appearance="outline">
        <mat-label>Expense Category *</mat-label>
        <mat-select [(ngModel)]="selectedCategoryId" required>
          <mat-option *ngFor="let cat of categories" [value]="cat.id">
            {{ cat.name }} ({{ cat.code }})
          </mat-option>
        </mat-select>
        <mat-icon matPrefix>category</mat-icon>
      </mat-form-field>

      <!-- Amount -->
      <mat-form-field appearance="outline">
        <mat-label>Amount (₹) *</mat-label>
        <input matInput type="number" [(ngModel)]="amount" min="1" placeholder="0.00" required>
        <span matPrefix class="currency-prefix">₹&nbsp;</span>
      </mat-form-field>

      <!-- Expense Date -->
      <mat-form-field appearance="outline">
        <mat-label>Expense Date *</mat-label>
        <input matInput [matDatepicker]="picker" [(ngModel)]="expenseDate" required>
        <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
        <mat-datepicker #picker></mat-datepicker>
      </mat-form-field>

      <!-- Payment Mode -->
      <mat-form-field appearance="outline">
        <mat-label>Payment Mode *</mat-label>
        <mat-select [(ngModel)]="paymentMode" required>
          <mat-option [value]="1">Cash</mat-option>
          <mat-option [value]="2">UPI / QR</mat-option>
          <mat-option [value]="3">Bank Transfer (NEFT/IMPS)</mat-option>
          <mat-option [value]="4">Cheque</mat-option>
          <mat-option [value]="5">Card</mat-option>
        </mat-select>
        <mat-icon matPrefix>payments</mat-icon>
      </mat-form-field>

      <!-- Branch (if branches exist) -->
      <mat-form-field appearance="outline" *ngIf="branches.length > 0">
        <mat-label>Campus / Branch</mat-label>
        <mat-select [(ngModel)]="selectedBranchId">
          <mat-option [value]="null">Main Branch / Default</mat-option>
          <mat-option *ngFor="let b of branches" [value]="b.id">
            {{ b.name }}
          </mat-option>
        </mat-select>
        <mat-icon matPrefix>apartment</mat-icon>
      </mat-form-field>

      <!-- Vendor Name -->
      <mat-form-field appearance="outline">
        <mat-label>Vendor / Payee Name</mat-label>
        <input matInput [(ngModel)]="vendorName" placeholder="e.g. State Electricity Board, Bharat Petroleum, ABC Stationery">
        <mat-icon matPrefix>store</mat-icon>
      </mat-form-field>

      <!-- Bill / Invoice No -->
      <mat-form-field appearance="outline">
        <mat-label>Bill / Invoice Reference #</mat-label>
        <input matInput [(ngModel)]="billInvoiceNo" placeholder="e.g. BILL-98231, REC-4410">
        <mat-icon matPrefix>tag</mat-icon>
      </mat-form-field>

      <!-- Receipt Attachment URL -->
      <mat-form-field appearance="outline" class="col-span-2">
        <mat-label>Receipt / Document URL (Optional)</mat-label>
        <input matInput [(ngModel)]="receiptAttachmentUrl" placeholder="https://... or link to bill scan">
        <mat-icon matPrefix>link</mat-icon>
      </mat-form-field>

      <!-- Remarks / Description -->
      <mat-form-field appearance="outline" class="col-span-2">
        <mat-label>Description / Additional Notes</mat-label>
        <textarea matInput [(ngModel)]="description" rows="2" placeholder="Itemized breakdown, approval notes or reason..."></textarea>
      </mat-form-field>
    </div>

    <div class="alert-error" *ngIf="errorMessage">
      <mat-icon>error_outline</mat-icon>
      <span>{{ errorMessage }}</span>
    </div>
  </div>

  <div class="modal-footer">
    <button mat-button (click)="dialogRef.close()" [disabled]="loading">Cancel</button>
    <button mat-raised-button color="primary" (click)="saveExpense()" [disabled]="loading || !isValid()">
      <mat-icon>{{ isEdit ? 'save' : 'check_circle' }}</mat-icon>
      <span>{{ isEdit ? 'Save Changes' : 'Save Expense Voucher' }}</span>
    </button>
  </div>
</div>
  `,
  styles: [`
    .expense-modal-container {
      width: 100%;
      min-width: 620px;
      max-width: 720px;
    }

    /* Strict Header (AGENTS.md) */
    .modal-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-icon-box {
      width: 42px;
      height: 42px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }

    .modal-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #1e3a8a;
    }

    .modal-subtitle {
      margin: 2px 0 0;
      font-size: 12px;
      color: #3b82f6;

      strong {
        color: #1e40af;
      }
    }

    .close-btn {
      color: #64748b;
      &:hover { color: #1e293b; }
    }

    .modal-body {
      padding: 20px;
      max-height: 72vh;
      overflow-y: auto;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .col-span-2 {
      grid-column: span 2;
    }

    .currency-prefix {
      font-weight: 700;
      color: #2563eb;
    }

    .alert-error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
      border-radius: 8px;
      margin-top: 12px;
      font-size: 13px;
    }

    .modal-footer {
      padding: 14px 20px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      background: #f8fafc;
    }
  `]
})
export class ExpenseDialogComponent implements OnInit {
  isEdit = false;
  loading = false;
  errorMessage = '';

  title = '';
  selectedCategoryId = '';
  amount: number | null = null;
  expenseDate: Date = new Date();
  paymentMode: ExpensePaymentMode = ExpensePaymentMode.Cash;
  vendorName = '';
  billInvoiceNo = '';
  receiptAttachmentUrl = '';
  description = '';
  selectedBranchId: string | null = null;

  categories: ExpenseCategoryDto[] = [];
  branches: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<ExpenseDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ExpenseDialogData,
    private financeService: FinanceService,
    private branchService: BranchService
  ) {}

  ngOnInit(): void {
    this.categories = this.data.categories || [];
    if (this.categories.length > 0 && !this.selectedCategoryId) {
      this.selectedCategoryId = this.categories[0].id;
    }

    this.branchService.getBranches().subscribe({
      next: (b) => (this.branches = b || []),
      error: () => {}
    });

    if (this.data.voucher) {
      this.isEdit = true;
      const v = this.data.voucher;
      this.title = v.title;
      this.selectedCategoryId = v.expenseCategoryId;
      this.amount = v.amount;
      this.expenseDate = new Date(v.expenseDate);
      this.paymentMode = v.paymentMode;
      this.vendorName = v.vendorName || '';
      this.billInvoiceNo = v.billInvoiceNo || '';
      this.receiptAttachmentUrl = v.receiptAttachmentUrl || '';
      this.description = v.description || '';
      this.selectedBranchId = v.branchId || null;
    }
  }

  isValid(): boolean {
    return !!this.title.trim() && !!this.selectedCategoryId && !!this.amount && this.amount > 0 && !!this.expenseDate;
  }

  saveExpense(): void {
    if (!this.isValid()) return;

    this.loading = true;
    this.errorMessage = '';

    if (this.isEdit && this.data.voucher) {
      const dto: UpdateExpenseVoucherDto = {
        title: this.title.trim(),
        expenseCategoryId: this.selectedCategoryId,
        amount: Number(this.amount),
        expenseDate: this.expenseDate.toISOString(),
        paymentMode: this.paymentMode,
        vendorName: this.vendorName ? this.vendorName.trim() : undefined,
        billInvoiceNo: this.billInvoiceNo ? this.billInvoiceNo.trim() : undefined,
        receiptAttachmentUrl: this.receiptAttachmentUrl ? this.receiptAttachmentUrl.trim() : undefined,
        description: this.description ? this.description.trim() : undefined,
        branchId: this.selectedBranchId
      };

      this.financeService.updateExpense(this.data.voucher.id, dto).subscribe({
        next: (saved) => {
          this.loading = false;
          this.dialogRef.close(saved);
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err.error?.message || 'Failed to update expense voucher.';
        }
      });
    } else {
      const dto: CreateExpenseVoucherDto = {
        title: this.title.trim(),
        expenseCategoryId: this.selectedCategoryId,
        amount: Number(this.amount),
        expenseDate: this.expenseDate.toISOString(),
        paymentMode: this.paymentMode,
        vendorName: this.vendorName ? this.vendorName.trim() : undefined,
        billInvoiceNo: this.billInvoiceNo ? this.billInvoiceNo.trim() : undefined,
        receiptAttachmentUrl: this.receiptAttachmentUrl ? this.receiptAttachmentUrl.trim() : undefined,
        description: this.description ? this.description.trim() : undefined,
        branchId: this.selectedBranchId
      };

      this.financeService.createExpense(dto).subscribe({
        next: (created) => {
          this.loading = false;
          this.dialogRef.close(created);
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err.error?.message || 'Failed to create expense voucher.';
        }
      });
    }
  }
}
