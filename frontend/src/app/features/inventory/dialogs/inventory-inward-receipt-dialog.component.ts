import { Component, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { InventoryInward } from '../inventory.models';
import { AuthService } from '../../../core/services/auth.service';
import { IstDatetimeDirective } from '../../../shared/directives/ist-datetime.directive';
import * as QRCode from 'qrcode';

export interface InventoryInwardReceiptDialogData {
  inward: InventoryInward;
  instituteName?: string;
  branchName?: string;
  logoUrl?: string | null;
}

@Component({
  selector: 'app-inventory-inward-receipt-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    IstDatetimeDirective
  ],
  template: `
    <div class="receipt-modal-container">
      <!-- Top Action Bar (hidden in print) -->
      <div class="modal-actions no-print">
        <div class="modal-title">
          <div class="title-badge">
            <mat-icon>receipt_long</mat-icon>
          </div>
          <div class="title-text-group">
            <span class="main-title">Goods Receipt Note (GRN) / Purchase Bill</span>
            <span class="sub-title">सामग्री आवक रसीद &bull; {{ data.inward.inwardNumber }}</span>
          </div>
        </div>
        <div class="btn-group">
          <button mat-flat-button class="header-action-btn print-btn" (click)="printSlip()" matTooltip="Print or Download PDF">
            <mat-icon>print</mat-icon>
            <span>Print Receipt</span>
          </button>
          <button mat-icon-button class="header-close-btn" (click)="dialogRef.close()" matTooltip="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>
    
      <!-- Printable Document Container -->
      <div class="receipt-paper" id="store-inward-paper">
        <!-- Header -->
        <div class="paper-header">
          <div class="inst-info">
            <div class="logo-mark transparent-logo-mark" [class.has-img]="logoUrl && !logoFailed">
              @if (logoUrl && !logoFailed) {
                <img [src]="logoUrl" (error)="logoFailed = true" alt="Logo" class="inst-logo-img">
              }
              @if (!logoUrl || logoFailed) {
                <mat-icon class="fallback-inst-icon">local_shipping</mat-icon>
              }
            </div>
            <div>
              <h2 class="inst-name">{{ data.instituteName || authService.currentUser()?.instituteName || 'Official Store GRN' }}</h2>
              <p class="inst-subtitle">Central Store Inventory & Procurement Department</p>
              @if (effectiveBranchName) {
                <p class="inst-branch">
                  <span class="branch-pill">🏛️ Branch: {{ effectiveBranchName }}</span>
                  <span class="branch-dept-sep">|</span>
                  <span class="branch-dept">Goods Receiving & Inward Verification</span>
                </p>
              }
            </div>
          </div>
          <div class="receipt-badge">
            <span class="badge-title">GOODS RECEIPT NOTE</span>
            <span class="badge-sub">सामग्री आवक वाउचर</span>
            <span class="copy-tag">STORE / ACCOUNTS COPY</span>
          </div>
        </div>
    
        <!-- Meta Strip -->
        <div class="meta-strip">
          <div class="meta-item">
            <span class="meta-label">GRN Number:</span>
            <span class="meta-val highlight">{{ data.inward.inwardNumber }}</span>
          </div>
          <div class="meta-item time-item">
            <span class="meta-label">Inward Date (IST):</span>
            <span class="meta-val date-time-val" [appIstDatetime]="data.inward.inwardDate" format="date"></span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Vendor Bill No:</span>
            <span class="meta-val bill-code">{{ data.inward.invoiceBillNumber || 'N/A' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Payment Status:</span>
            <span class="meta-val status-pill" [ngClass]="'status-' + (data.inward.paymentStatus || 'paid').toLowerCase()">
              {{ data.inward.paymentStatus || 'Paid' }}
            </span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Payment Mode:</span>
            <span class="meta-val mode-pill">{{ data.inward.paymentMode || 'Cash' }}</span>
          </div>
        </div>
    
        <!-- Vendor & Purchase Info Card -->
        <div class="vendor-profile-card">
          <div class="prof-col">
            <div class="prof-row">
              <span class="p-lbl">Supplier / Vendor:</span>
              <span class="p-val bold-text">{{ data.inward.vendorName || 'Direct Market Purchase' }}</span>
            </div>
            @if (data.inward.remarks) {
              <div class="prof-row">
                <span class="p-lbl">Purchase Notes:</span>
                <span class="p-val notes-val">{{ data.inward.remarks }}</span>
              </div>
            }
          </div>
          @if (qrCodeUrl) {
            <div class="prof-col text-right-col">
              <div class="qr-box">
                <img [src]="qrCodeUrl" alt="QR Verification" class="qr-img" />
                <span class="qr-caption">Scan to Verify GRN</span>
              </div>
            </div>
          }
        </div>
    
        <!-- Arriving Items Table -->
        <div class="items-table-wrap">
          <table class="receipt-table">
            <thead>
              <tr>
                <th style="width: 45px; text-align: center;">#</th>
                <th style="width: 130px;">Item Code</th>
                <th>Item Description / Specification</th>
                <th style="width: 120px;">Batch / Serial</th>
                <th style="width: 100px; text-align: center;">Inward Qty</th>
                <th style="width: 110px; text-align: right;">Unit Rate (₹)</th>
                <th style="width: 120px; text-align: right;">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              @for (item of data.inward.items; track item; let i = $index) {
                <tr>
                  <td style="text-align: center;">{{ i + 1 }}</td>
                  <td><span class="code-tag">{{ item.itemCode || 'ITM' }}</span></td>
                  <td>
                    <strong>{{ item.itemName }}</strong>
                    @if (item.remarks) {
                      <span class="item-sub-desc"> &bull; {{ item.remarks }}</span>
                    }
                  </td>
                  <td>{{ item.batchOrSerialNo || '—' }}</td>
                  <td style="text-align: center;">
                    <strong class="qty-badge">{{ item.quantity }}</strong>
                  </td>
                  <td style="text-align: right;">₹{{ item.unitPrice | number:'1.2-2' }}</td>
                  <td style="text-align: right;"><strong>₹{{ item.totalAmount | number:'1.2-2' }}</strong></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
    
        <!-- Totals & Breakdown Card -->
        <div class="totals-block">
          <div class="terms-notes">
            <span class="terms-title">Verification & Stock Integrity Declaration:</span>
            <p>1. Physical quantities and packaging condition received match invoice specs.</p>
            <p>2. Stock count has been automatically incremented into store ERP inventory in real time.</p>
            <p>3. Vendor invoice is verified for accounts settlement per procurement guidelines.</p>
          </div>
          <div class="totals-table">
            <div class="t-row">
              <span>Gross Items Value:</span>
              <strong>₹{{ data.inward.totalAmount | number:'1.2-2' }}</strong>
            </div>
            @if (data.inward.discountAmount > 0) {
              <div class="t-row discount-row">
                <span>Trade Discount (-):</span>
                <strong class="text-emerald">-₹{{ data.inward.discountAmount | number:'1.2-2' }}</strong>
              </div>
            }
            @if (data.inward.taxAmount > 0) {
              <div class="t-row tax-row">
                <span>GST / Taxes (+):</span>
                <strong>₹{{ data.inward.taxAmount | number:'1.2-2' }}</strong>
              </div>
            }
            <div class="t-row grand-total-row">
              <span>Net Bill Amount:</span>
              <strong class="grand-val">₹{{ data.inward.netAmount | number:'1.2-2' }}</strong>
            </div>
          </div>
        </div>
    
        <!-- Signature Strip -->
        <div class="signatures-strip">
          <div class="sig-col">
            <div class="sig-line"></div>
            <span class="sig-role">Received & Verified By</span>
            <span class="sig-desc">Store Incharge / Logistics Officer</span>
          </div>
          <div class="sig-col">
            <div class="sig-line"></div>
            <span class="sig-role">Authorized Signatory</span>
            <span class="sig-desc">Accounts & Finance Controller</span>
          </div>
        </div>
    
        <!-- Footer Notice -->
        <div class="paper-footer">
          <span>This is an official computer-generated Goods Receipt Note (GRN) issued via IMSERP Central Store System.</span>
        </div>
      </div>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .receipt-modal-container {
      display: flex;
      flex-direction: column;
      max-height: 92vh;
      background: #f8fafc;
    }
    .modal-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 24px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      border-top-left-radius: 12px;
      border-top-right-radius: 12px;
    }
    .modal-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .title-badge {
      background: #2563eb;
      color: #ffffff;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }
    .title-text-group {
      display: flex;
      flex-direction: column;
    }
    .main-title {
      font-size: 1.12rem;
      font-weight: 700;
      color: #1e3a8a;
    }
    .sub-title {
      font-size: 0.8rem;
      color: #3b82f6;
    }
    .btn-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header-action-btn.print-btn {
      background: #2563eb;
      color: #ffffff;
      font-weight: 600;
      box-shadow: 0 2px 4px rgba(37,99,235,0.2);
      &:hover { background: #1d4ed8; }
    }
    .header-close-btn {
      color: #64748b;
      &:hover { color: #1e293b; background: rgba(0,0,0,0.05); }
    }

    /* Paper styling */
    .receipt-paper {
      margin: 16px auto;
      padding: 24px 32px;
      background: #ffffff;
      width: 820px;
      box-sizing: border-box;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.04);
      overflow-y: auto;
      max-height: calc(90vh - 80px);
    }
    .paper-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 2px solid #1e3a8a;
      padding-bottom: 14px;
      margin-bottom: 12px;
    }
    .inst-info {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .logo-mark {
      width: 58px;
      height: 58px;
      border-radius: 8px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .inst-logo-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .fallback-inst-icon {
      color: #2563eb;
      font-size: 32px;
      width: 32px;
      height: 32px;
    }
    .inst-name {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 800;
      color: #1e3a8a;
      letter-spacing: -0.01em;
    }
    .inst-subtitle {
      margin: 2px 0 0;
      font-size: 0.8rem;
      color: #475569;
    }
    .inst-branch {
      margin: 4px 0 0;
      font-size: 0.76rem;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .branch-pill {
      font-weight: 700;
      color: #1e40af;
    }
    .branch-dept-sep { color: #cbd5e1; }
    .receipt-badge {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      text-align: right;
    }
    .badge-title {
      font-size: 1rem;
      font-weight: 800;
      color: #1e3a8a;
      letter-spacing: 0.05em;
    }
    .badge-sub {
      font-size: 0.74rem;
      color: #64748b;
    }
    .copy-tag {
      margin-top: 4px;
      font-size: 0.68rem;
      font-weight: 700;
      background: #e2e8f0;
      color: #334155;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .meta-strip {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 14px;
      margin-bottom: 14px;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .meta-label {
      font-size: 0.7rem;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
    }
    .meta-val {
      font-size: 0.84rem;
      color: #0f172a;
      font-weight: 700;
    }
    .meta-val.highlight {
      color: #2563eb;
    }
    .meta-val.bill-code {
      font-family: monospace;
      color: #1e3a8a;
    }
    .status-pill {
      display: inline-block;
      width: fit-content;
      font-size: 0.72rem;
      padding: 1px 6px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .status-paid { background: #dcfce7; color: #15803d; }
    .status-pending { background: #fef3c7; color: #b45309; }
    .mode-pill {
      color: #475569;
    }

    .vendor-profile-card {
      display: flex;
      justify-content: space-between;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 14px;
      background: #ffffff;
    }
    .prof-col {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .prof-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.84rem;
    }
    .p-lbl {
      color: #64748b;
      font-weight: 600;
      min-width: 110px;
    }
    .p-val.bold-text {
      font-weight: 700;
      color: #0f172a;
      font-size: 0.92rem;
    }
    .notes-val {
      color: #334155;
      font-style: italic;
    }
    .qr-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }
    .qr-img {
      width: 64px;
      height: 64px;
    }
    .qr-caption {
      font-size: 0.65rem;
      color: #64748b;
    }

    .items-table-wrap {
      margin-bottom: 14px;
    }
    .receipt-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
      th {
        background: #f1f5f9;
        color: #1e3a8a;
        font-weight: 700;
        padding: 8px 10px;
        border: 1px solid #cbd5e1;
      }
      td {
        padding: 8px 10px;
        border: 1px solid #e2e8f0;
        color: #334155;
      }
    }
    .code-tag {
      font-family: monospace;
      font-weight: 700;
      color: #475569;
      background: #f1f5f9;
      padding: 1px 5px;
      border-radius: 3px;
    }
    .item-sub-desc {
      font-size: 0.74rem;
      color: #64748b;
      font-style: italic;
    }
    .qty-badge {
      font-size: 0.88rem;
      color: #0f172a;
    }

    .totals-block {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 24px;
      background: #f8fafc;
    }
    .terms-notes {
      flex: 1.3;
      font-size: 0.75rem;
      color: #475569;
      line-height: 1.4;
      p { margin: 2px 0; }
    }
    .terms-title {
      font-weight: 700;
      color: #1e3a8a;
      display: block;
      margin-bottom: 4px;
    }
    .totals-table {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .t-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      color: #334155;
    }
    .grand-total-row {
      border-top: 2px solid #cbd5e1;
      padding-top: 6px;
      margin-top: 4px;
      font-size: 1rem;
      font-weight: 800;
      color: #1e3a8a;
    }
    .grand-val {
      font-size: 1.15rem;
      color: #15803d;
    }

    .signatures-strip {
      display: flex;
      justify-content: space-between;
      margin-top: 36px;
      padding: 0 30px;
      margin-bottom: 16px;
    }
    .sig-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 200px;
    }
    .sig-line {
      width: 100%;
      height: 1px;
      background: #94a3b8;
      margin-bottom: 6px;
    }
    .sig-role {
      font-size: 0.8rem;
      font-weight: 700;
      color: #1e293b;
    }
    .sig-desc {
      font-size: 0.72rem;
      color: #64748b;
    }

    .paper-footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      text-align: center;
      font-size: 0.72rem;
      color: #94a3b8;
    }

    /* Print styles */
    @media print {
      .no-print { display: none !important; }
      body, html {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
      .receipt-modal-container {
        max-height: none !important;
        background: #ffffff !important;
      }
      .receipt-paper {
        margin: 0 !important;
        padding: 16px !important;
        width: 100% !important;
        max-height: none !important;
        border: none !important;
        box-shadow: none !important;
      }
    }
  `]
})
export class InventoryInwardReceiptDialogComponent implements OnInit {
  logoUrl: string | null = null;
  logoFailed = false;
  qrCodeUrl: string | null = null;

  constructor(
    public readonly dialogRef: MatDialogRef<InventoryInwardReceiptDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: InventoryInwardReceiptDialogData,
    public readonly authService: AuthService
  ) {}

  get effectiveBranchName(): string | undefined {
    return this.data.branchName || this.authService.currentUser()?.branchName || undefined;
  }

  ngOnInit(): void {
    this.logoUrl = this.data.logoUrl || this.authService.getInstituteLogoUrl();

    // Generate Verification QR Code
    const verifyString = `IMSERP-GRN|${this.data.inward.inwardNumber}|BILL:${this.data.inward.invoiceBillNumber || 'NA'}|DATE:${this.data.inward.inwardDate}|AMT:${this.data.inward.netAmount}`;
    QRCode.toDataURL(verifyString, { width: 120, margin: 1 })
      .then(url => { this.qrCodeUrl = url; })
      .catch(() => { this.qrCodeUrl = null; });
  }

  printSlip(): void {
    const el = document.getElementById('store-inward-paper');
    if (!el) {
      window.print();
      return;
    }

    let printIframe = document.getElementById('store-inward-print-frame') as HTMLIFrameElement;
    if (printIframe) {
      printIframe.remove();
    }

    printIframe = document.createElement('iframe');
    printIframe.id = 'store-inward-print-frame';
    printIframe.style.position = 'fixed';
    printIframe.style.right = '0';
    printIframe.style.bottom = '0';
    printIframe.style.width = '0';
    printIframe.style.height = '0';
    printIframe.style.border = '0';
    document.body.appendChild(printIframe);

    const doc = printIframe.contentWindow?.document || printIframe.contentDocument;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Goods Receipt Note - ${this.data.inward.inwardNumber}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 10mm 12mm; color: #0f172a; font-size: 13px; line-height: 1.45; background: #ffffff; }
            .paper-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #1e3a8a; margin-bottom: 14px; }
            .inst-info { display: flex; align-items: center; gap: 14px; }
            .logo-mark { width: 56px; height: 56px; background: transparent !important; border: 1px solid #bfdbfe; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
            .inst-logo-img { width: 100%; height: 100%; object-fit: contain; }
            .fallback-inst-icon { font-size: 32px; width: 32px; height: 32px; color: #2563eb; }
            .inst-name { font-size: 1.3rem; font-weight: 800; color: #1e3a8a; }
            .inst-subtitle { font-size: 0.8rem; color: #475569; margin-top: 2px; }
            .inst-branch { font-size: 0.74rem; color: #64748b; font-weight: 600; margin-top: 2px; display: flex; gap: 8px; align-items: center; }
            .branch-pill { color: #1e40af; font-weight: 700; }
            .receipt-badge { text-align: right; }
            .badge-title { font-size: 1.05rem; font-weight: 800; color: #1e3a8a; letter-spacing: 0.5px; }
            .badge-sub { font-size: 0.76rem; color: #64748b; font-weight: 600; display: block; margin-top: 2px; }
            .copy-tag { display: inline-block; margin-top: 4px; font-size: 0.65rem; font-weight: 700; background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; border: 1px solid #e2e8f0; }
            .meta-strip { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 14px; }
            .meta-item { display: flex; flex-direction: column; gap: 2px; }
            .meta-label { font-size: 0.68rem; color: #64748b; font-weight: 700; text-transform: uppercase; }
            .meta-val { font-size: 0.82rem; font-weight: 700; color: #0f172a; }
            .meta-val.highlight { color: #2563eb; font-family: monospace; font-size: 0.88rem; }
            .meta-val.bill-code { font-family: monospace; color: #1e3a8a; }
            .status-pill { display: inline-block; font-size: 0.72rem; font-weight: 700; padding: 1px 7px; border-radius: 4px; width: fit-content; text-transform: uppercase; }
            .status-paid { background: #dcfce7; color: #15803d; }
            .status-pending { background: #fef3c7; color: #b45309; }
            .mode-pill { color: #475569; }
            .vendor-profile-card { display: flex; justify-content: space-between; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; background: #ffffff; }
            .prof-col { display: flex; flex-direction: column; gap: 4px; }
            .prof-row { display: flex; gap: 8px; font-size: 0.82rem; }
            .p-lbl { color: #64748b; font-weight: 600; width: 120px; flex-shrink: 0; }
            .p-val.bold-text { color: #0f172a; font-weight: 700; font-size: 0.9rem; }
            .notes-val { color: #334155; font-style: italic; }
            .qr-box { display: flex; flex-direction: column; align-items: center; gap: 2px; }
            .qr-img { width: 64px; height: 64px; }
            .qr-caption { font-size: 0.65rem; color: #64748b; }
            .items-table-wrap { margin-bottom: 14px; }
            .receipt-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
            .receipt-table th { background: #f1f5f9; color: #1e3a8a; font-weight: 700; padding: 8px 10px; border: 1px solid #cbd5e1; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .receipt-table td { padding: 8px 10px; border: 1px solid #e2e8f0; color: #334155; }
            .code-tag { font-family: monospace; font-weight: 700; color: #475569; background: #f1f5f9; padding: 1px 5px; border-radius: 3px; }
            .item-sub-desc { font-size: 0.74rem; color: #64748b; font-style: italic; }
            .qty-badge { font-size: 0.88rem; color: #0f172a; }
            .totals-block { display: flex; justify-content: space-between; gap: 20px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px; background: #f8fafc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .terms-notes { flex: 1.3; font-size: 0.74rem; color: #475569; line-height: 1.4; }
            .terms-notes p { margin: 2px 0; }
            .terms-title { font-weight: 700; color: #1e3a8a; display: block; margin-bottom: 4px; }
            .totals-table { flex: 1; display: flex; flex-direction: column; gap: 6px; }
            .t-row { display: flex; justify-content: space-between; font-size: 0.84rem; color: #334155; }
            .grand-total-row { border-top: 2px solid #cbd5e1; padding-top: 6px; margin-top: 4px; font-size: 0.96rem; font-weight: 800; color: #1e3a8a; }
            .grand-val { font-size: 1.15rem; color: #15803d; }
            .signatures-strip { display: flex; justify-content: space-between; margin-top: 36px; padding: 0 30px; margin-bottom: 16px; }
            .sig-col { display: flex; flex-direction: column; align-items: center; width: 200px; }
            .sig-line { width: 100%; height: 1px; background: #94a3b8; margin-bottom: 6px; }
            .sig-role { font-size: 0.8rem; font-weight: 700; color: #1e293b; }
            .sig-desc { font-size: 0.72rem; color: #64748b; }
            .paper-footer { border-top: 1px solid #e2e8f0; padding-top: 8px; text-align: center; font-size: 0.72rem; color: #94a3b8; }
            @page { margin: 10mm; size: A4 portrait; }
          </style>
        </head>
        <body>
          ${el.outerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        printIframe.contentWindow?.focus();
        printIframe.contentWindow?.print();
      } catch {
        window.print();
      }
    }, 250);
  }
}
