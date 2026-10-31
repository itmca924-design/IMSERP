import { Component, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { InventoryVendor, InventoryItem, CreateInwardDto, InventoryBillSequenceDto } from '../inventory.models';
import { InventoryService } from '../inventory.service';
import { InventoryBillSequenceDialogComponent } from './inventory-bill-sequence-dialog.component';
import { InventoryInwardConfirmDialogComponent } from './inventory-inward-confirm-dialog.component';

export interface InventoryInwardDialogData {
  vendors: InventoryVendor[];
  items: InventoryItem[];
  branchId?: string;
  prefill?: {
    itemId: string;
    quantity: number;
    unitPrice: number;
    vendorId?: string;
    remarks?: string;
  };
}

@Component({
  selector: 'app-inventory-inward-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    <div class="dialog-container">
      <!-- Strict ERP Light-Blue Gradient Header -->
      <div class="dialog-header">
        <div class="dialog-header-left">
          <div class="header-icon-box">
            <mat-icon>add_shopping_cart</mat-icon>
          </div>
          <div class="header-title-wrap">
            <h2>Stock Inward (GRN / Purchase Entry)</h2>
            <p>Record stock arrival from vendor to automatically increase inventory count</p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="onCancel()" type="button">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-dialog-content class="dialog-body">
          <!-- Top Vendor & Invoice Details -->
          <div class="section-title">
            <mat-icon>receipt_long</mat-icon>
            <span>Vendor & Invoice Details</span>
          </div>
    
          <div class="form-grid top-grid">
            <mat-form-field appearance="outline">
              <mat-label>Supplier / Vendor</mat-label>
              <mat-select formControlName="vendorId">
                <mat-option [value]="null">-- Direct Market Purchase --</mat-option>
                @for (v of data.vendors; track v) {
                  <mat-option [value]="v.id">
                    {{ v.vendorName }} {{ v.phone ? '(' + v.phone + ')' : '' }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>
    
            <mat-form-field appearance="outline" class="bill-input-field">
              <mat-label>Vendor Invoice / Bill No.</mat-label>
              <input
                matInput
                formControlName="invoiceBillNumber"
                placeholder="e.g. BILL-2627-0001"
                readonly
                [readonly]="true"
                tabindex="-1"
                (keydown)="$event.preventDefault()"
                class="readonly-bill-input"
                matTooltip="Auto-generated sequential bill number. Click ⚙️ to configure." />
              <button mat-icon-button matSuffix (click)="openSequenceSettings()" type="button" matTooltip="Configure Bill Sequencer">
                <mat-icon class="icon-sm">settings</mat-icon>
              </button>
            </mat-form-field>
    
            <mat-form-field appearance="outline">
              <mat-label>Inward Date</mat-label>
              <input matInput type="date" formControlName="inwardDate" />
            </mat-form-field>
    
            <mat-form-field appearance="outline">
              <mat-label>Payment Status</mat-label>
              <mat-select formControlName="paymentStatus">
                <mat-option value="Paid">Paid (Full)</mat-option>
                <mat-option value="Pending">Credit / Pending</mat-option>
                <mat-option value="Partial">Partial Paid</mat-option>
              </mat-select>
            </mat-form-field>
    
            <mat-form-field appearance="outline">
              <mat-label>Payment Mode</mat-label>
              <mat-select formControlName="paymentMode">
                <mat-option value="Cash">Cash</mat-option>
                <mat-option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</mat-option>
                <mat-option value="UPI">UPI / QR</mat-option>
                <mat-option value="Cheque">Cheque</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
    
          <!-- Existing Credit Note Auto-Adjustment Notice -->
          @if (selectedVendorAdvanceCredit > 0) {
            <div class="credit-banner">
              <mat-icon class="credit-banner-icon">info</mat-icon>
              <div class="credit-banner-content">
                <strong>Existing Supplier Credit Balance: ₹{{ selectedVendorAdvanceCredit | number:'1.2-2' }}</strong>
                <p>This supplier has an advance credit from previous purchase returns (Debit Notes). It will be automatically adjusted against this invoice in the vendor ledger.</p>
              </div>
            </div>
          }
    
          <!-- Dynamic Item Rows Section -->
          <div class="items-header-row">
            <div class="section-title">
              <mat-icon>inventory_2</mat-icon>
              <span>Items to Inward / Receive</span>
            </div>
            <button mat-stroked-button color="primary" type="button" (click)="addItemRow()" class="add-row-btn">
              <mat-icon>add</mat-icon>
              <span>Add Item Row</span>
            </button>
          </div>
    
          <div formArrayName="items" class="items-table-wrapper">
            @for (line of itemRows.controls; track line; let i = $index) {
              <div class="item-line-card" [formGroupName]="i">
                <div class="line-index-badge">#{{ i + 1 }}</div>
                <!-- Item selection -->
                <mat-form-field appearance="outline" class="item-select-field">
                  <mat-label>Select Item</mat-label>
                  <mat-select formControlName="itemId" (selectionChange)="onItemSelect(i, $event.value)">
                    <mat-select-trigger>
                      @if (getSelectedItem(i); as sel) {
                        <span class="trigger-item-wrap">
                          <span class="trigger-name">{{ sel.itemName }}</span>
                          <span class="trigger-code">({{ sel.itemCode }})</span>
                          <span class="stock-pill" [ngClass]="getStockBadgeClass(sel)">
                            Current: {{ sel.currentStock }} {{ sel.unitOfMeasurement }}
                          </span>
                        </span>
                      }
                    </mat-select-trigger>
                    @for (itm of data.items; track itm) {
                      <mat-option [value]="itm.id">
                        <div class="option-item-row">
                          <div class="option-name-code">
                            <strong>{{ itm.itemName }}</strong>
                            <span class="option-code">({{ itm.itemCode }})</span>
                          </div>
                          <span class="stock-pill" [ngClass]="getStockBadgeClass(itm)">
                            Current: {{ itm.currentStock }} {{ itm.unitOfMeasurement }}
                          </span>
                        </div>
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <!-- Quantity -->
                <mat-form-field appearance="outline" class="qty-field">
                  <mat-label>Qty</mat-label>
                  <input matInput type="number" formControlName="quantity" min="1" (input)="computeTotals()" />
                </mat-form-field>
                <!-- Unit Purchase Price -->
                <mat-form-field appearance="outline" class="rate-field">
                  <mat-label>Unit Price (₹)</mat-label>
                  <input matInput type="number" formControlName="unitPrice" min="0" step="0.5" (input)="computeTotals()" />
                </mat-form-field>
                <!-- Batch / Serial -->
                <mat-form-field appearance="outline" class="batch-field">
                  <mat-label>Batch / Serial No.</mat-label>
                  <input matInput formControlName="batchOrSerialNo" placeholder="Optional" />
                </mat-form-field>
                <!-- Line Total Computed -->
                <div class="line-total-box">
                  <span class="sub-label">Total</span>
                  <span class="val">₹{{ getLineTotal(i) | number:'1.2-2' }}</span>
                </div>
                <!-- Remove button -->
                <button mat-icon-button color="warn" type="button" (click)="removeItemRow(i)" [disabled]="itemRows.length === 1" matTooltip="Remove Line">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>
            }
          </div>
    
          <!-- Bottom Summary & Amounts -->
          <div class="summary-section">
            <div class="remarks-wrap">
              <mat-form-field appearance="outline" class="remarks-form-field">
                <mat-label>Purchase Notes / Remarks</mat-label>
                <textarea matInput formControlName="remarks" rows="3" placeholder="e.g. Auto-reorder for low stock threshold, batch notes, or delivery remarks"></textarea>
              </mat-form-field>
            </div>
    
            <div class="totals-card">
              <div class="total-row">
                <span>Sub-Total Items:</span>
                <strong>₹{{ subTotal | number:'1.2-2' }}</strong>
              </div>
              <div class="total-row discount-row">
                <span>Discount (₹):</span>
                <input type="number" formControlName="discountAmount" min="0" (input)="computeTotals()" class="mini-input" />
              </div>
              <div class="total-row tax-row">
                <span>Tax / GST (₹):</span>
                <input type="number" formControlName="taxAmount" min="0" (input)="computeTotals()" class="mini-input" />
              </div>
              <div class="total-row net-row">
                <span>Inward Bill Total:</span>
                <strong class="net-val">₹{{ netTotal | number:'1.2-2' }}</strong>
              </div>
              @if (selectedVendorAdvanceCredit > 0) {
                <div class="total-row credit-adj-row">
                  <span>Less Credit Note Adj:</span>
                  <strong class="text-emerald">-₹{{ Math.min(selectedVendorAdvanceCredit, netTotal) | number:'1.2-2' }}</strong>
                </div>
              }
              @if (selectedVendorAdvanceCredit > 0) {
                <div class="total-row final-payable-row">
                  <span>Net Cash/Bank Payable:</span>
                  <strong class="final-payable-val">₹{{ Math.max(0, netTotal - selectedVendorAdvanceCredit) | number:'1.2-2' }}</strong>
                </div>
              }
            </div>
          </div>
        </mat-dialog-content>
    
        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-button type="button" (click)="onCancel()" [disabled]="submitting">
            Cancel
          </button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting || itemRows.length === 0">
            @if (submitting) {
              <mat-spinner diameter="18" class="spinner-btn"></mat-spinner>
            }
            <span>Confirm & Receive Stock</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      max-height: 92vh;
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
    .close-btn {
      color: #64748b;
      &:hover { color: #1e293b; }
    }
    .dialog-body {
      padding: 16px 20px;
      max-height: 70vh;
      overflow-y: auto;
    }
    .section-title {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #1e3a8a;
      font-weight: 600;
      font-size: 0.92rem;
      margin-bottom: 10px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
    }
    .top-grid {
      display: grid;
      grid-template-columns: 2.2fr 1.4fr 1.3fr 1.3fr 1.2fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    .items-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px dashed #cbd5e1;
      padding-top: 14px;
      margin-bottom: 10px;
    }
    .items-table-wrapper {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 16px;
    }
    .item-line-card {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 14px;
    }
    .line-index-badge {
      font-size: 0.75rem;
      font-weight: 700;
      color: #64748b;
      background: #e2e8f0;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .item-select-field {
      flex: 3.5;
      min-width: 280px;
      margin-bottom: -1.25em;
    }
    .trigger-item-wrap {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: 100%;
      vertical-align: middle;
    }
    .trigger-name {
      font-weight: 600;
      color: #0f172a;
    }
    .trigger-code {
      color: #64748b;
      font-size: 0.82rem;
    }
    .option-item-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      gap: 12px;
    }
    .option-name-code {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .option-code {
      color: #64748b;
      font-size: 0.82rem;
    }
    .stock-pill {
      display: inline-flex;
      align-items: center;
      font-size: 0.74rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 9999px;
      letter-spacing: 0.02em;
      white-space: nowrap;
      line-height: 1.3;
    }
    .stock-pill-low {
      background-color: #fee2e2;
      color: #dc2626;
      border: 1px solid #fca5a5;
    }
    .stock-pill-out {
      background-color: #fef2f2;
      color: #991b1b;
      border: 1px solid #f87171;
    }
    .stock-pill-good {
      background-color: #ecfdf5;
      color: #059669;
      border: 1px solid #a7f3d0;
    }
    .qty-field {
      flex: 0.9;
      min-width: 85px;
      margin-bottom: -1.25em;
    }
    .rate-field {
      flex: 1.1;
      min-width: 110px;
      margin-bottom: -1.25em;
    }
    .batch-field {
      flex: 1.2;
      min-width: 120px;
      margin-bottom: -1.25em;
    }
    .line-total-box {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      min-width: 90px;
      padding-right: 6px;
      .sub-label { font-size: 0.7rem; color: #64748b; text-transform: uppercase; }
      .val { font-weight: 700; color: #0f172a; font-size: 0.95rem; }
    }
    .summary-section {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: 24px;
      border-top: 1px solid #e2e8f0;
      padding-top: 16px;
      align-items: flex-start;
      width: 100%;
      box-sizing: border-box;
    }
    .remarks-wrap {
      width: 100%;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }
    .remarks-form-field {
      width: 100% !important;
      display: block !important;
      ::ng-deep .mat-mdc-form-field-flex {
        width: 100% !important;
      }
      ::ng-deep textarea.mat-mdc-input-element {
        width: 100% !important;
        min-height: 84px !important;
        line-height: 1.5;
        resize: vertical;
        box-sizing: border-box;
      }
    }
    .totals-card {
      width: 360px;
      box-sizing: border-box;
      background: #f1f5f9;
      border-radius: 8px;
      padding: 14px 18px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .total-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.88rem;
      color: #334155;
    }
    .mini-input {
      width: 90px;
      padding: 3px 6px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      text-align: right;
      font-weight: 600;
    }
    .net-row {
      border-top: 1px solid #cbd5e1;
      padding-top: 6px;
      margin-top: 4px;
      font-size: 1rem;
      font-weight: 700;
      color: #1e3a8a;
    }
    .net-val {
      font-size: 1.15rem;
      color: #16a34a;
    }
    .credit-banner {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 14px;
      margin-top: 12px;
      margin-bottom: 8px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 8px;
      color: #065f46;
    }
    .credit-banner-icon {
      color: #059669;
      font-size: 20px;
      width: 20px;
      height: 20px;
      margin-top: 2px;
    }
    .credit-banner-content {
      font-size: 12px;
      line-height: 1.4;
      p { margin: 2px 0 0; color: #047857; }
    }
    .credit-adj-row {
      color: #059669 !important;
      font-weight: 600;
    }
    .final-payable-row {
      border-top: 2px dashed #bfdbfe !important;
      padding-top: 6px !important;
      margin-top: 4px !important;
      font-size: 0.95rem;
      font-weight: 700;
      color: #1e3a8a;
    }
    .final-payable-val {
      color: #1e40af !important;
      font-size: 1.15rem !important;
      font-weight: 800;
    }
    .dialog-actions {
      padding: 12px 20px 16px;
      border-top: 1px solid #f1f5f9;
      gap: 8px;
    }
    .bill-input-field {
      ::ng-deep .mat-mdc-text-field-wrapper {
        background-color: #f8fafc !important;
      }
      ::ng-deep .mat-mdc-icon-button.mat-mdc-button-base {
        width: 32px;
        height: 32px;
        padding: 4px;
        color: #2563eb;
      }
    }
    .readonly-bill-input {
      font-weight: 700 !important;
      font-family: 'Consolas', 'Courier New', monospace !important;
      color: #1e3a8a !important;
      letter-spacing: 0.05em !important;
      cursor: not-allowed !important;
      caret-color: transparent !important;
    }
    .icon-sm {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `]
})
export class InventoryInwardDialogComponent implements OnInit {
  form!: FormGroup;
  submitting = false;
  subTotal = 0;
  netTotal = 0;
  currentSequence: InventoryBillSequenceDto | null = null;

  readonly Math = Math;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<InventoryInwardDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: InventoryInwardDialogData,
    private readonly inventoryService: InventoryService,
    private readonly dialog: MatDialog
  ) {}

  get selectedVendor(): InventoryVendor | undefined {
    const vId = this.form?.get('vendorId')?.value;
    return this.data.vendors.find(v => v.id === vId);
  }

  get selectedVendorAdvanceCredit(): number {
    const bal = this.selectedVendor?.balanceDue ?? 0;
    return bal < 0 ? Math.abs(bal) : 0;
  }

  get itemRows(): FormArray {
    return this.form.get('items') as FormArray;
  }

  ngOnInit(): void {
    const today = new Date().toISOString().substring(0, 10);
    const preferredVendor = (this.data.vendors || []).find(v => !v.vendorName.toLowerCase().includes('direct')) || (this.data.vendors || [])[0];
    const initialVendorId = this.data.prefill?.vendorId || preferredVendor?.id || null;

    this.form = this.fb.group({
      vendorId: [initialVendorId],
      invoiceBillNumber: [''],
      inwardDate: [today, [Validators.required]],
      discountAmount: [0, [Validators.min(0)]],
      taxAmount: [0, [Validators.min(0)]],
      paymentStatus: ['Paid', [Validators.required]],
      paymentMode: ['Cash', [Validators.required]],
      remarks: [this.data.prefill?.remarks || ''],
      items: this.fb.array([])
    });

    // If vendors list was empty or not yet loaded, fetch directly and auto-select
    if (!this.data.vendors || this.data.vendors.length === 0) {
      this.inventoryService.getVendors(this.data.branchId).subscribe({
        next: (vList) => {
          this.data.vendors = vList;
          if (vList.length > 0 && !this.form.get('vendorId')?.value) {
            const pref = vList.find(x => !x.vendorName.toLowerCase().includes('direct')) || vList[0];
            const chosenId = this.data.prefill?.vendorId || pref.id;
            this.form.patchValue({ vendorId: chosenId });
          }
        }
      });
    }

    // Load Sequencer for Next Bill Number
    this.inventoryService.getBillSequence(this.data.branchId).subscribe({
      next: (seq) => {
        this.currentSequence = seq;
        if (!this.form.get('invoiceBillNumber')?.value) {
          this.form.patchValue({ invoiceBillNumber: seq.nextBillNumberPreview });
        }
      },
      error: () => {
        // Fallback dynamic sequence if endpoint not available
        const now = new Date();
        const m = now.getMonth() + 1;
        const y = now.getFullYear();
        const fy = m >= 4 ? `${String(y).slice(-2)}${String(y + 1).slice(-2)}` : `${String(y - 1).slice(-2)}${String(y).slice(-2)}`;
        if (!this.form.get('invoiceBillNumber')?.value) {
          this.form.patchValue({ invoiceBillNumber: `BILL-${fy}-0001` });
        }
      }
    });

    // Check if auto-fill reorder data is passed
    if (this.data.prefill) {
      const row = this.fb.group({
        itemId: [this.data.prefill.itemId, [Validators.required]],
        quantity: [this.data.prefill.quantity, [Validators.required, Validators.min(0.01)]],
        unitPrice: [this.data.prefill.unitPrice, [Validators.required, Validators.min(0)]],
        batchOrSerialNo: [''],
        remarks: [this.data.prefill.remarks || '']
      });
      this.itemRows.push(row);
      this.computeTotals();
    } else {
      // Add first empty/default row
      this.addItemRow();
    }
  }

  openSequenceSettings(): void {
    const dialogRef = this.dialog.open(InventoryBillSequenceDialogComponent, {
      width: '520px',
      data: {
        sequence: this.currentSequence || {
          id: '',
          prefix: 'BILL-',
          nextNumber: 1,
          paddingDigits: 4,
          includeFinancialYear: true,
          nextBillNumberPreview: this.form.get('invoiceBillNumber')?.value || 'BILL-0001'
        },
        branchId: this.data.branchId
      }
    });

    dialogRef.afterClosed().subscribe((result: InventoryBillSequenceDto | undefined) => {
      if (result) {
        this.currentSequence = result;
        this.form.patchValue({ invoiceBillNumber: result.nextBillNumberPreview });
      }
    });
  }

  addItemRow(): void {
    const defaultItem = this.data.items.length > 0 ? this.data.items[0] : null;
    const row = this.fb.group({
      itemId: [defaultItem?.id || '', [Validators.required]],
      quantity: [1, [Validators.required, Validators.min(0.01)]],
      unitPrice: [defaultItem?.purchasePrice || 0, [Validators.required, Validators.min(0)]],
      batchOrSerialNo: [''],
      remarks: ['']
    });
    this.itemRows.push(row);
    this.computeTotals();
  }

  removeItemRow(index: number): void {
    if (this.itemRows.length > 1) {
      this.itemRows.removeAt(index);
      this.computeTotals();
    }
  }

  onItemSelect(index: number, itemId: string): void {
    const found = this.data.items.find(i => i.id === itemId);
    if (found) {
      const row = this.itemRows.at(index);
      row.patchValue({
        unitPrice: found.purchasePrice || 0
      });
      this.computeTotals();
    }
  }

  getSelectedItem(index: number): InventoryItem | undefined {
    const itemId = this.itemRows?.at(index)?.get('itemId')?.value;
    if (!itemId) return undefined;
    return this.data.items?.find(it => it.id === itemId);
  }

  getStockBadgeClass(item: InventoryItem): string {
    if (!item) return 'stock-pill-good';
    if (item.currentStock <= 0) return 'stock-pill-out';
    if (item.currentStock <= item.minStockAlertLevel) return 'stock-pill-low';
    return 'stock-pill-good';
  }

  getLineTotal(index: number): number {
    const row = this.itemRows.at(index);
    const qty = Number(row.get('quantity')?.value) || 0;
    const price = Number(row.get('unitPrice')?.value) || 0;
    return qty * price;
  }

  computeTotals(): void {
    let sum = 0;
    for (let i = 0; i < this.itemRows.length; i++) {
      sum += this.getLineTotal(i);
    }
    this.subTotal = sum;
    const disc = Number(this.form?.get('discountAmount')?.value) || 0;
    const tax = Number(this.form?.get('taxAmount')?.value) || 0;
    this.netTotal = Math.max(0, sum - disc + tax);
  }

  onSubmit(): void {
    if (this.form.invalid || this.itemRows.length === 0) return;

    const val = this.form.value;
    const lines = val.items.map((row: any) => ({
      itemId: row.itemId,
      quantity: Number(row.quantity) || 1,
      unitPrice: Number(row.unitPrice) || 0,
      batchOrSerialNo: row.batchOrSerialNo?.trim() || undefined,
      remarks: row.remarks?.trim() || undefined
    }));

    const result: CreateInwardDto = {
      vendorId: val.vendorId || undefined,
      invoiceBillNumber: val.invoiceBillNumber?.trim() || undefined,
      inwardDate: val.inwardDate,
      discountAmount: Number(val.discountAmount) || 0,
      taxAmount: Number(val.taxAmount) || 0,
      paymentStatus: val.paymentStatus,
      paymentMode: val.paymentMode,
      remarks: val.remarks?.trim() || undefined,
      branchId: this.data.branchId,
      items: lines
    };

    // Open Confirmation Dialog to Review Payment Settlement & Inward Quantities
    const confirmRef = this.dialog.open(InventoryInwardConfirmDialogComponent, {
      width: '640px',
      data: {
        vendorName: this.selectedVendor?.vendorName || 'Direct Market Purchase',
        invoiceBillNumber: val.invoiceBillNumber || this.currentSequence?.nextBillNumberPreview,
        inwardDate: val.inwardDate,
        paymentStatus: val.paymentStatus,
        paymentMode: val.paymentMode,
        subTotal: this.subTotal,
        discountAmount: Number(val.discountAmount) || 0,
        taxAmount: Number(val.taxAmount) || 0,
        netTotal: this.netTotal,
        selectedVendorAdvanceCredit: this.selectedVendorAdvanceCredit,
        items: lines.map((l: any) => {
          const itm = this.data.items.find(i => i.id === l.itemId);
          return {
            itemName: itm?.itemName || 'Item',
            itemCode: itm?.itemCode,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            totalAmount: l.quantity * l.unitPrice
          };
        })
      }
    });

    confirmRef.afterClosed().subscribe((confirmed: boolean | undefined) => {
      if (confirmed) {
        this.dialogRef.close(result);
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
