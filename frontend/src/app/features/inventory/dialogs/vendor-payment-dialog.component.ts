import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { InventoryVendor, RecordVendorPaymentDto } from '../inventory.models';
import { InventoryService } from '../inventory.service';

export interface VendorPaymentDialogData {
  vendor: InventoryVendor;
  vendorsList?: InventoryVendor[];
  mode: 'Disbursement' | 'Refund';
  branchId?: string;
}

export interface VendorPaymentDialogResult {
  success: boolean;
  voucherNumber: string;
  isRefund: boolean;
  amount: number;
  vendorId: string;
}

@Component({
  selector: 'app-vendor-payment-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="dialog-container">
      <!-- Strict ERP Light-Blue Gradient Header -->
      <div class="dialog-header">
        <div class="dialog-header-left">
          <div class="header-icon-box" [ngClass]="isRefund ? 'bg-emerald-box' : 'bg-blue-box'">
            <mat-icon>{{ isRefund ? 'call_received' : 'payments' }}</mat-icon>
          </div>
          <div class="header-title-wrap">
            <h2>{{ isRefund ? 'Record Supplier Refund Receipt (रिफंड वापसी)' : 'Disburse Supplier Payment Voucher (भुगतान वाउचर)' }}</h2>
            <p>
              Supplier: <strong>{{ currentVendor?.vendorName || currentVendor?.name || 'Vendor' }}</strong> • 
              {{ isRefund ? 'Record cash, UPI or bank refund received against Debit Notes' : 'Record payment disbursed to settle supplier ledger' }}
            </p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="onCancel()" type="button" [disabled]="submitting">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-dialog-content class="dialog-body">

          <!-- Voucher Type Segmented Toggle -->
          <div class="voucher-type-switch-row">
            <mat-button-toggle-group formControlName="paymentType" class="voucher-type-toggle" (change)="onTypeChange($event.value)">
              <mat-button-toggle value="Disbursement">
                <mat-icon class="toggle-ic">payments</mat-icon>
                <span>Disburse Payment (भुगतान करें)</span>
              </mat-button-toggle>
              <mat-button-toggle value="Refund">
                <mat-icon class="toggle-ic">call_received</mat-icon>
                <span>Receive Refund (रिफंड प्राप्त करें)</span>
              </mat-button-toggle>
            </mat-button-toggle-group>
          </div>

          <div class="form-grid">
            <!-- Vendor Select -->
            <mat-form-field appearance="outline" class="col-span-2">
              <mat-label>Supplier / Vendor *</mat-label>
              <mat-select formControlName="vendorId">
                <mat-option *ngFor="let v of vendorsList" [value]="v.id">
                  {{ v.vendorName || v.name }} 
                  <span *ngIf="(v.balanceDue ?? 0) < 0" class="opt-credit">(Credit: ₹{{ Math.abs(v.balanceDue ?? 0) | number:'1.2-2' }})</span>
                  <span *ngIf="(v.balanceDue ?? 0) > 0" class="opt-due">(Due: ₹{{ (v.balanceDue ?? 0) | number:'1.2-2' }})</span>
                  <span *ngIf="(v.balanceDue ?? 0) === 0" class="opt-nil">(Settled)</span>
                </mat-option>
              </mat-select>
              <mat-error *ngIf="form.get('vendorId')?.hasError('required')">Vendor is required</mat-error>
            </mat-form-field>

            <!-- Date -->
            <mat-form-field appearance="outline">
              <mat-label>{{ isRefund ? 'Refund Receipt Date *' : 'Payment Date *' }}</mat-label>
              <input matInput type="date" formControlName="paymentDate" />
              <mat-error *ngIf="form.get('paymentDate')?.hasError('required')">Date is required</mat-error>
            </mat-form-field>

            <!-- Amount -->
            <mat-form-field appearance="outline">
              <mat-label>{{ isRefund ? 'Refund Amount Received (₹) *' : 'Payment Amount (₹) *' }}</mat-label>
              <input matInput type="number" formControlName="amount" placeholder="0.00" min="0.01" step="0.01" />
              <mat-error *ngIf="form.get('amount')?.hasError('required')">Amount is required</mat-error>
              <mat-error *ngIf="form.get('amount')?.hasError('min')">Amount must be greater than 0</mat-error>
            </mat-form-field>

            <!-- Payment Mode -->
            <mat-form-field appearance="outline">
              <mat-label>{{ isRefund ? 'Refund Mode *' : 'Payment Mode *' }}</mat-label>
              <mat-select formControlName="paymentMode">
                <mat-option value="Cash">Cash Voucher</mat-option>
                <mat-option value="UPI">UPI / QR Code</mat-option>
                <mat-option value="BankTransfer">Bank Transfer / NEFT / RTGS</mat-option>
                <mat-option value="Cheque">Cheque</mat-option>
                <mat-option value="DemandDraft">Demand Draft (DD)</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Reference / UTR -->
            <mat-form-field appearance="outline">
              <mat-label>Reference / UTR / Cheque No.</mat-label>
              <input matInput formControlName="referenceNumber" placeholder="e.g. UTR891238912" />
            </mat-form-field>

            <!-- Bank Name -->
            <mat-form-field appearance="outline">
              <mat-label>Bank Name (Optional)</mat-label>
              <input matInput formControlName="bankName" placeholder="e.g. State Bank of India" />
            </mat-form-field>

            <!-- Remarks -->
            <mat-form-field appearance="outline" class="col-span-2">
              <mat-label>Remarks / Notes</mat-label>
              <input matInput formControlName="notes" [placeholder]="isRefund ? 'e.g. Refund against Debit Note / Purchase Return' : 'e.g. Part payment against invoice'" />
            </mat-form-field>
          </div>

          <!-- Live Dynamic Settlement Preview Banner -->
          <div class="settlement-preview-card" [class.refund-preview-card]="isRefund">
            <div class="preview-metric">
              <span class="metric-label">{{ isRefund ? 'Current Advance Credit:' : 'Current Outstanding Due:' }}</span>
              <strong class="metric-val" [class.text-emerald]="isRefund" [class.text-danger]="!isRefund">
                ₹{{ Math.abs(currentVendor?.balanceDue ?? 0) | number:'1.2-2' }}
                <small *ngIf="(currentVendor?.balanceDue ?? 0) < 0"> (Cr)</small>
                <small *ngIf="(currentVendor?.balanceDue ?? 0) > 0"> (Dr)</small>
              </strong>
            </div>

            <mat-icon class="preview-arrow">trending_flat</mat-icon>

            <div class="preview-metric">
              <span class="metric-label">{{ isRefund ? 'Receiving Refund Now:' : 'Disbursing Amount:' }}</span>
              <strong class="metric-val" [class.text-emerald]="isRefund" [class.text-blue]="!isRefund">
                ₹{{ (form.get('amount')?.value || 0) | number:'1.2-2' }}
              </strong>
            </div>

            <mat-icon class="preview-arrow">trending_flat</mat-icon>

            <div class="preview-metric">
              <span class="metric-label">Remaining Balance:</span>
              <strong class="metric-val" [class.text-emerald]="remainingBalance <= 0" [class.text-danger]="remainingBalance > 0">
                ₹{{ Math.abs(remainingBalance) | number:'1.2-2' }}
                <span *ngIf="remainingBalance === 0" class="status-pill pill-settled">Settled</span>
                <span *ngIf="remainingBalance < 0" class="status-pill pill-credit">Credit (Cr)</span>
                <span *ngIf="remainingBalance > 0" class="status-pill pill-due">Due (Dr)</span>
              </strong>
            </div>
          </div>

          <div *ngIf="errorMessage" class="error-banner">
            <mat-icon>error_outline</mat-icon>
            <span>{{ errorMessage }}</span>
          </div>

        </mat-dialog-content>

        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-button type="button" (click)="onCancel()" [disabled]="submitting">
            Cancel
          </button>
          <button
            mat-flat-button
            [color]="isRefund ? 'accent' : 'primary'"
            type="submit"
            [disabled]="form.invalid || submitting"
            class="submit-btn"
            [class.btn-emerald-submit]="isRefund">
            <mat-spinner diameter="18" *ngIf="submitting" class="spinner-btn"></mat-spinner>
            <mat-icon *ngIf="!submitting">{{ isRefund ? 'call_received' : 'receipt_long' }}</mat-icon>
            <span>{{ submitting ? 'Processing...' : (isRefund ? 'Record Refund & Settle Credit' : 'Disburse Voucher & Debit Ledger') }}</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
  `,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
    }

    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top-left-radius: 12px;
      border-top-right-radius: 12px;
    }

    .dialog-header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-icon-box {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }

    .bg-blue-box {
      background: #2563eb;
    }

    .bg-emerald-box {
      background: #059669;
      box-shadow: 0 4px 6px -1px rgba(5,150,105,0.25);
    }

    .header-title-wrap h2 {
      color: #1e3a8a;
      font-weight: 700;
      margin: 0;
      font-size: 1.15rem;
    }

    .header-title-wrap p {
      color: #3b82f6;
      margin: 2px 0 0;
      font-size: 0.82rem;
      strong {
        color: #1e40af;
      }
    }

    .close-btn {
      color: #64748b;
      &:hover { color: #1e293b; }
    }

    .dialog-body {
      padding: 20px !important;
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;
    }

    .voucher-type-switch-row {
      display: flex;
      justify-content: flex-start;
      margin-bottom: 4px;
    }

    .voucher-type-toggle {
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #cbd5e1;
      background: #ffffff;
    }

    .voucher-type-toggle mat-button-toggle {
      padding: 2px 12px;
      font-weight: 600;
      font-size: 13px;
    }

    .toggle-ic {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: 6px;
      vertical-align: middle;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .col-span-2 {
      grid-column: span 2;
    }

    .opt-credit { color: #059669; font-weight: 600; font-size: 12px; }
    .opt-due { color: #dc2626; font-weight: 600; font-size: 12px; }
    .opt-nil { color: #94a3b8; font-size: 12px; }

    .settlement-preview-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 18px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #2563eb;
      border-radius: 8px;
    }

    .refund-preview-card {
      border-left-color: #059669 !important;
      background: #f0fdf4 !important;
    }

    .preview-metric {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .metric-label {
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 600;
      color: #64748b;
    }

    .metric-val {
      font-size: 15px;
      font-family: monospace, monospace;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .preview-arrow {
      color: #94a3b8;
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .status-pill {
      font-size: 10px;
      font-family: sans-serif;
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 700;
    }

    .pill-settled { background: #dcfce7; color: #166534; }
    .pill-credit { background: #dbeafe; color: #1e40af; }
    .pill-due { background: #fee2e2; color: #991b1b; }

    .text-emerald { color: #059669 !important; }
    .text-danger { color: #dc2626 !important; }
    .text-blue { color: #2563eb !important; }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      color: #dc2626;
      font-size: 13px;
      font-weight: 600;
    }

    .dialog-actions {
      padding: 12px 20px 16px;
      border-top: 1px solid #f1f5f9;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .btn-emerald-submit {
      background: #059669 !important;
      color: #ffffff !important;
      &:hover { background: #047857 !important; }
    }

    .submit-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      padding: 0 18px;
      height: 40px;
    }

    .spinner-btn {
      display: inline-block;
      margin-right: 6px;
    }
  `]
})
export class VendorPaymentDialogComponent implements OnInit {
  readonly Math = Math;
  form!: FormGroup;
  submitting = false;
  errorMessage = '';

  vendorsList: InventoryVendor[] = [];
  currentVendor: InventoryVendor | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<VendorPaymentDialogComponent>,
    private readonly inventoryService: InventoryService,
    @Inject(MAT_DIALOG_DATA) public readonly data: VendorPaymentDialogData
  ) {}

  get isRefund(): boolean {
    return this.form?.get('paymentType')?.value === 'Refund';
  }

  get remainingBalance(): number {
    if (!this.currentVendor) return 0;
    const current = this.currentVendor.balanceDue ?? 0;
    const amt = Number(this.form?.get('amount')?.value || 0);
    if (this.isRefund) {
      return current + amt;
    } else {
      return current - amt;
    }
  }

  ngOnInit(): void {
    this.currentVendor = this.data.vendor;
    this.vendorsList = this.data.vendorsList && this.data.vendorsList.length > 0
      ? this.data.vendorsList
      : [this.data.vendor];

    const todayStr = new Date().toISOString().substring(0, 10);
    const initialType = this.data.mode || 'Disbursement';

    let initialAmount: number | null = null;
    if (initialType === 'Refund') {
      const credit = (this.currentVendor.balanceDue ?? 0) < 0 ? Math.abs(this.currentVendor.balanceDue!) : null;
      initialAmount = credit;
    } else {
      const due = (this.currentVendor.balanceDue ?? 0) > 0 ? this.currentVendor.balanceDue! : null;
      initialAmount = due;
    }

    const defaultMode = initialType === 'Refund' ? 'Cash' : 'BankTransfer';
    const defaultNotes = initialType === 'Refund' ? 'Vendor refund against credit note / purchase return' : '';

    this.form = this.fb.group({
      paymentType: [initialType, [Validators.required]],
      vendorId: [this.currentVendor.id, [Validators.required]],
      paymentDate: [todayStr, [Validators.required]],
      amount: [initialAmount, [Validators.required, Validators.min(0.01)]],
      paymentMode: [defaultMode, [Validators.required]],
      referenceNumber: [''],
      bankName: [''],
      notes: [defaultNotes]
    });

    this.form.get('vendorId')?.valueChanges.subscribe(vId => {
      this.currentVendor = this.vendorsList.find(v => v.id === vId) || null;
      if (this.currentVendor) {
        this.syncAmountWithVendor();
      }
    });
  }

  onTypeChange(type: 'Disbursement' | 'Refund'): void {
    if (!this.currentVendor) return;
    this.syncAmountWithVendor();
  }

  private syncAmountWithVendor(): void {
    if (!this.currentVendor) return;
    const type = this.form.get('paymentType')?.value;
    if (type === 'Refund') {
      const credit = (this.currentVendor.balanceDue ?? 0) < 0 ? Math.abs(this.currentVendor.balanceDue!) : null;
      this.form.patchValue({
        amount: credit,
        paymentMode: 'Cash',
        notes: 'Vendor refund against debit note / credit balance'
      });
    } else {
      const due = (this.currentVendor.balanceDue ?? 0) > 0 ? this.currentVendor.balanceDue : null;
      this.form.patchValue({
        amount: due,
        paymentMode: 'BankTransfer',
        notes: ''
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage = '';
    this.submitting = true;

    const val = this.form.value;
    const dto: RecordVendorPaymentDto = {
      vendorId: val.vendorId,
      branchId: this.data.branchId,
      paymentDate: val.paymentDate,
      amount: Number(val.amount),
      paymentMode: val.paymentMode,
      referenceNumber: val.referenceNumber?.trim() || undefined,
      bankName: val.bankName?.trim() || undefined,
      remarks: val.notes?.trim() || undefined,
      notes: val.notes?.trim() || undefined,
      paymentType: val.paymentType || 'Disbursement'
    };

    this.inventoryService.recordVendorPayment(dto).subscribe({
      next: (res) => {
        this.submitting = false;
        const result: VendorPaymentDialogResult = {
          success: true,
          voucherNumber: res.voucherNumber,
          isRefund: val.paymentType === 'Refund',
          amount: dto.amount,
          vendorId: dto.vendorId
        };
        this.dialogRef.close(result);
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err?.error?.message || (val.paymentType === 'Refund' ? 'Failed to record refund receipt.' : 'Failed to disburse payment voucher.');
      }
    });
  }
}
