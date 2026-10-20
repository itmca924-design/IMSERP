import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { IstDatetimeDirective } from '../../../shared/directives/ist-datetime.directive';

export interface InventoryInwardConfirmDialogData {
  vendorName: string;
  invoiceBillNumber?: string;
  inwardDate: string;
  paymentStatus: string;
  paymentMode: string;
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  netTotal: number;
  selectedVendorAdvanceCredit: number;
  items: {
    itemName: string;
    itemCode?: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  }[];
}

@Component({
  selector: 'app-inventory-inward-confirm-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    IstDatetimeDirective
  ],
  template: `
    <div class="confirm-dialog-container">
      <!-- Strict ERP Light-Blue Gradient Header -->
      <div class="dialog-header">
        <div class="dialog-header-left">
          <div class="header-icon-box">
            <mat-icon>payments</mat-icon>
          </div>
          <div class="header-title-wrap">
            <h2>Confirm Stock Inward &amp; Payment Settlement</h2>
            <p>Review payment disbursement and inventory receipt before finalizing</p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="onCancel()" type="button">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content class="dialog-body">
        <!-- 1. Vendor & Inward Meta Strip -->
        <div class="meta-strip">
          <div class="meta-item">
            <span class="meta-lbl">SUPPLIER / VENDOR</span>
            <strong class="meta-val">{{ data.vendorName }}</strong>
          </div>
          <div class="meta-item">
            <span class="meta-lbl">BILL / INVOICE #</span>
            <strong class="meta-val font-mono">{{ data.invoiceBillNumber || 'Auto-Generated' }}</strong>
          </div>
          <div class="meta-item">
            <span class="meta-lbl">INWARD DATE</span>
            <span class="meta-val" [appIstDatetime]="data.inwardDate"></span>
          </div>
        </div>

        <!-- 2. Prominent Financial Settlement Callout -->
        <div
          class="payment-callout-card"
          [class.card-paid]="data.paymentStatus === 'Paid'"
          [class.card-pending]="data.paymentStatus === 'Pending'"
          [class.card-partial]="data.paymentStatus === 'Partial'">

          <div class="callout-header">
            <div class="callout-title-row">
              <mat-icon class="callout-icon">
                {{ data.paymentStatus === 'Paid' ? 'verified' : (data.paymentStatus === 'Pending' ? 'schedule' : 'pie_chart') }}
              </mat-icon>
              <div>
                <span class="callout-tag">FINANCIAL PAYMENT TREATMENT</span>
                <h3 class="callout-heading">
                  {{ data.paymentStatus === 'Paid' ? 'Full Immediate Payment Disbursed' : (data.paymentStatus === 'Pending' ? 'Credit Purchase (Payable to Vendor)' : 'Partial Payment Settlement') }}
                </h3>
              </div>
            </div>

            <div class="callout-amount-wrap">
              <span class="amt-lbl">NET INWARD BILL</span>
              <span class="amt-val">₹{{ data.netTotal | number:'1.2-2' }}</span>
            </div>
          </div>

          <div class="callout-body">
            <!-- If Paid Full -->
            <div *ngIf="data.paymentStatus === 'Paid'" class="treatment-line">
              <mat-icon class="sub-ic text-emerald">check_circle</mat-icon>
              <span>
                <strong>₹{{ (data.selectedVendorAdvanceCredit > 0 ? Math.max(0, data.netTotal - data.selectedVendorAdvanceCredit) : data.netTotal) | number:'1.2-2' }}</strong>
                will be disbursed immediately to <strong>{{ data.vendorName }}</strong> via <strong>{{ data.paymentMode }}</strong>.
              </span>
            </div>

            <!-- If Pending / Credit -->
            <div *ngIf="data.paymentStatus === 'Pending'" class="treatment-line">
              <mat-icon class="sub-ic text-danger">pending_actions</mat-icon>
              <span>
                <strong>₹{{ data.netTotal | number:'1.2-2' }}</strong> will be recorded as <strong>Unpaid Credit Bill</strong> and added to <strong>{{ data.vendorName }}'s</strong> outstanding credit balance in Vendor Ledger.
              </span>
            </div>

            <!-- If Partial -->
            <div *ngIf="data.paymentStatus === 'Partial'" class="treatment-line">
              <mat-icon class="sub-ic text-blue">payments</mat-icon>
              <span>
                Partial settlement recorded via <strong>{{ data.paymentMode }}</strong>. Balance liability tracked in Vendor Ledger.
              </span>
            </div>

            <!-- Existing Debit Note Advance Credit Adjustment Notice -->
            <div *ngIf="data.selectedVendorAdvanceCredit > 0" class="credit-adj-notice">
              <mat-icon class="sub-ic text-emerald">auto_fix_high</mat-icon>
              <span>
                Supplier has <strong>₹{{ data.selectedVendorAdvanceCredit | number:'1.2-2' }}</strong> advance credit from previous Debit Notes.
                <strong>-₹{{ Math.min(data.selectedVendorAdvanceCredit, data.netTotal) | number:'1.2-2' }}</strong> adjusted automatically.
                Net cash outflow: <strong>₹{{ Math.max(0, data.netTotal - data.selectedVendorAdvanceCredit) | number:'1.2-2' }}</strong>.
              </span>
            </div>
          </div>
        </div>

        <!-- 3. Items Arriving into Store Summary -->
        <div class="items-summary-card">
          <div class="items-card-header">
            <span class="items-title">
              <mat-icon class="ic-xs">inventory_2</mat-icon> Items Adding to Live Stock ({{ data.items.length }} Line(s))
            </span>
            <span class="total-pcs-pill">
              Total: {{ totalQuantity }} Units
            </span>
          </div>

          <div class="items-mini-table">
            <div *ngFor="let it of data.items; let idx = index" class="mini-table-row">
              <span class="row-num">#{{ idx + 1 }}</span>
              <div class="row-item-info">
                <strong>{{ it.itemName }}</strong>
                <span *ngIf="it.itemCode" class="row-code">({{ it.itemCode }})</span>
              </div>
              <span class="row-qty">{{ it.quantity }} Pcs &times; ₹{{ it.unitPrice | number:'1.2-2' }}</span>
              <strong class="row-total">₹{{ it.totalAmount | number:'1.2-2' }}</strong>
            </div>
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button type="button" (click)="onCancel()" class="btn-cancel">
          Back to Edit
        </button>
        <button mat-flat-button color="primary" type="button" (click)="onConfirm()" class="btn-confirm">
          <mat-icon>verified</mat-icon>
          <span>Confirm &amp; Receive Stock</span>
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .confirm-dialog-container {
      display: flex;
      flex-direction: column;
      width: 100%;
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
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
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
    }
    .close-btn { color: #64748b; }
    .close-btn:hover { color: #1e293b; }

    .dialog-body {
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-height: 75vh;
      overflow-y: auto;
    }

    .meta-strip {
      display: grid;
      grid-template-columns: 1.5fr 1.2fr 1fr;
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 16px;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .meta-lbl {
      font-size: 10.5px;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.04em;
    }
    .meta-val {
      font-size: 13px;
      color: #0f172a;
    }

    .payment-callout-card {
      border-radius: 10px;
      padding: 14px 16px;
      border: 1px solid #e2e8f0;
      background: #ffffff;

      &.card-paid {
        background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
        border-color: #86efac;
        .callout-heading { color: #166534; }
        .amt-val { color: #15803d; }
      }
      &.card-pending {
        background: linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%);
        border-color: #fecaca;
        .callout-heading { color: #991b1b; }
        .amt-val { color: #dc2626; }
      }
      &.card-partial {
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        border-color: #bfdbfe;
        .callout-heading { color: #1e40af; }
        .amt-val { color: #2563eb; }
      }
    }

    .callout-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px dashed rgba(0, 0, 0, 0.1);
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
    .callout-title-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .callout-icon {
      font-size: 26px;
      width: 26px;
      height: 26px;
    }
    .callout-tag {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      opacity: 0.8;
    }
    .callout-heading {
      margin: 1px 0 0;
      font-size: 15px;
      font-weight: 800;
    }
    .callout-amount-wrap {
      text-align: right;
    }
    .amt-lbl {
      display: block;
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
    }
    .amt-val {
      font-size: 22px;
      font-weight: 800;
      font-family: monospace, monospace;
    }

    .callout-body {
      font-size: 12.5px;
      line-height: 1.45;
      color: #334155;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .treatment-line {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sub-ic {
      font-size: 18px;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }
    .credit-adj-notice {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      background: rgba(16, 185, 129, 0.1);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12px;
      color: #065f46;
    }

    .items-summary-card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: #ffffff;
      overflow: hidden;
    }
    .items-card-header {
      background: #f8fafc;
      padding: 8px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e2e8f0;
    }
    .items-title {
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .ic-xs {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .total-pcs-pill {
      font-size: 11px;
      font-weight: 700;
      background: #e2e8f0;
      color: #334155;
      padding: 2px 8px;
      border-radius: 12px;
    }

    .items-mini-table {
      max-height: 160px;
      overflow-y: auto;
    }
    .mini-table-row {
      display: flex;
      align-items: center;
      padding: 8px 14px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 12px;
      gap: 10px;
      &:last-child { border-bottom: none; }
    }
    .row-num {
      color: #94a3b8;
      font-size: 11px;
      width: 22px;
    }
    .row-item-info {
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .row-code {
      color: #64748b;
      font-size: 11px;
      margin-left: 4px;
    }
    .row-qty {
      color: #475569;
      font-family: monospace, monospace;
    }
    .row-total {
      color: #0f172a;
      font-family: monospace, monospace;
      min-width: 75px;
      text-align: right;
    }

    .dialog-actions {
      padding: 12px 20px 16px;
      border-top: 1px solid #f1f5f9;
      gap: 10px;
    }
    .btn-confirm {
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .text-emerald { color: #059669 !important; }
    .text-danger { color: #dc2626 !important; }
    .text-blue { color: #2563eb !important; }
    .font-mono { font-family: monospace, monospace; }
  `]
})
export class InventoryInwardConfirmDialogComponent {
  readonly Math = Math;

  constructor(
    private readonly dialogRef: MatDialogRef<InventoryInwardConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: InventoryInwardConfirmDialogData
  ) {}

  get totalQuantity(): number {
    return this.data.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
