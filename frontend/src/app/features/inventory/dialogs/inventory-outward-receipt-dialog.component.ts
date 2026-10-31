import { Component, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { InventoryOutward } from '../inventory.models';
import { AuthService } from '../../../core/services/auth.service';
import { IstDatetimeDirective } from '../../../shared/directives/ist-datetime.directive';
import * as QRCode from 'qrcode';

export interface InventoryOutwardReceiptDialogData {
  outward: InventoryOutward;
  instituteName?: string;
  branchName?: string;
  logoUrl?: string | null;
}

@Component({
  selector: 'app-inventory-outward-receipt-dialog',
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
            <mat-icon>inventory_2</mat-icon>
          </div>
          <div class="title-text-group">
            <span class="main-title">Store Issue Slip / Bill</span>
            <span class="sub-title">सामग्री वितरण रसीद &bull; {{ data.outward.issueNumber }}</span>
          </div>
        </div>
        <div class="btn-group">
          <button mat-flat-button class="header-action-btn print-btn" (click)="printSlip()" matTooltip="Print or Download PDF">
            <mat-icon>print</mat-icon>
            <span>Print Slip</span>
          </button>
          <button mat-icon-button class="header-close-btn" (click)="dialogRef.close()" matTooltip="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>
    
      <!-- Printable Document Container -->
      <div class="receipt-paper" id="store-issue-paper">
        <!-- Header -->
        <div class="paper-header">
          <div class="inst-info">
            <div class="logo-mark transparent-logo-mark" [class.has-img]="logoUrl && !logoFailed">
              @if (logoUrl && !logoFailed) {
                <img [src]="logoUrl" (error)="logoFailed = true" alt="Logo" class="inst-logo-img">
              }
              @if (!logoUrl || logoFailed) {
                <mat-icon class="fallback-inst-icon">store</mat-icon>
              }
            </div>
            <div>
              <h2 class="inst-name">{{ data.instituteName || authService.currentUser()?.instituteName || 'Official Store Issue' }}</h2>
              <p class="inst-subtitle">Uniforms, Books & Academic Materials Distribution Store</p>
              @if (effectiveBranchName) {
                <p class="inst-branch">
                  <span class="branch-pill">🏛️ Branch: {{ effectiveBranchName }}</span>
                  <span class="branch-dept-sep">|</span>
                  <span class="branch-dept">Inventory & Logistics Dept.</span>
                </p>
              }
            </div>
          </div>
          <div class="receipt-badge">
            <span class="badge-title">STORE ISSUE BILL</span>
            <span class="badge-sub">सामग्री वितरण पर्ची</span>
            <span class="copy-tag">STORE / STUDENT COPY</span>
          </div>
        </div>
    
        <!-- Meta Strip -->
        <div class="meta-strip">
          <div class="meta-item">
            <span class="meta-label">Issue Number:</span>
            <span class="meta-val highlight">{{ data.outward.issueNumber }}</span>
          </div>
          <div class="meta-item time-item">
            <span class="meta-label">Date (IST):</span>
            <span class="meta-val date-time-val" [appIstDatetime]="data.outward.issueDate" format="date"></span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Issue Type:</span>
            <span class="meta-val mode-pill">{{ data.outward.issueType === 'StudentKitSale' ? 'Student Issue' : 'Staff / Dept Issue' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Treatment:</span>
            <span class="meta-val status-pill" [ngClass]="getStatusPillClass()">
              {{ getTreatmentLabel() }}
            </span>
          </div>
        </div>
    
        <!-- Recipient Info Card -->
        <div class="recipient-profile-card">
          <div class="prof-col">
            <div class="prof-row">
              <span class="p-lbl">Issued To:</span>
              <span class="p-val bold-text">{{ data.outward.issuedToName }}</span>
            </div>
            @if (data.outward.studentRollNo) {
              <div class="prof-row">
                <span class="p-lbl">Roll Number:</span>
                <span class="p-val">{{ data.outward.studentRollNo }}</span>
              </div>
            }
          </div>
          <div class="prof-col">
            @if (data.outward.departmentOrClass) {
              <div class="prof-row">
                <span class="p-lbl">Class / Department:</span>
                <span class="p-val">{{ data.outward.departmentOrClass }}</span>
              </div>
            }
            <div class="prof-row">
              <span class="p-lbl">Remarks:</span>
              <span class="p-val">{{ data.outward.remarks || 'Standard stock issue' }}</span>
            </div>
          </div>
          @if (qrCodeDataUrl) {
            <div class="prof-col qr-col">
              <img [src]="qrCodeDataUrl" alt="Verification QR" class="receipt-qr-img" />
              <span class="qr-caption">Scan to Verify</span>
            </div>
          }
        </div>
    
        <!-- Items Table -->
        <table class="receipt-items-table">
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>Item Name & Description</th>
              <th style="width: 100px; text-align: center;">Qty</th>
              <th style="width: 110px; text-align: right;">Unit Price</th>
              <th style="width: 120px; text-align: right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            @for (item of data.outward.items; track item; let i = $index) {
              <tr>
                <td style="text-align: center;">{{ i + 1 }}</td>
                <td>
                  <div class="item-name-cell">
                    <span class="primary-item-name">{{ item.itemName }}</span>
                    @if (item.itemCode) {
                      <span class="item-code-tag">Code: {{ item.itemCode }}</span>
                    }
                    @if (item.remarks) {
                      <span class="item-sub-desc">{{ item.remarks }}</span>
                    }
                  </div>
                </td>
                <td style="text-align: center; font-weight: 600;">{{ item.quantity }}</td>
                <td style="text-align: right;">₹{{ item.unitPrice | number:'1.2-2' }}</td>
                <td style="text-align: right; font-weight: 700;">₹{{ item.totalAmount | number:'1.2-2' }}</td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="2" class="total-summary-label">
                Total Items: <strong>{{ data.outward.items.length }}</strong> &bull; Total Quantity: <strong>{{ getTotalQuantity() }}</strong>
              </td>
              <td colspan="2" class="grand-total-label">Grand Total:</td>
              <td class="grand-total-val">₹{{ data.outward.totalAmount | number:'1.2-2' }}</td>
            </tr>
          </tfoot>
        </table>
    
        <!-- Amount In Words -->
        @if (data.outward.totalAmount > 0) {
          <div class="words-strip">
            <div class="words-content">
              <span class="w-lbl">Amount in Words:</span>
              <span class="w-text">{{ getAmountInWords(data.outward.totalAmount) }}</span>
            </div>
          </div>
        }
    
        <!-- Payment Treatment Alert Notice -->
        <div class="notice-box" [ngClass]="getNoticeClass()">
          <mat-icon class="notice-icon">{{ getNoticeIcon() }}</mat-icon>
          <div class="notice-text">
            <strong>{{ getNoticeTitle() }}:</strong>
            <span>{{ getNoticeDescription() }}</span>
          </div>
        </div>
    
        <!-- Signatures & Authorization -->
        <div class="signatures-strip">
          <div class="sig-box">
            <div class="sig-line"></div>
            <span class="sig-role">Receiver's Signature</span>
            <span class="sig-sub">(Student / Parent / Staff)</span>
          </div>
          <div class="sig-box center-seal">
            <div class="seal-placeholder">
              <span>AUTHORIZED STORE SEAL</span>
            </div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <span class="sig-role">Store Manager / Cashier</span>
            <span class="sig-sub">Authorized Signatory</span>
          </div>
        </div>
    
        <!-- Footer Terms -->
        <div class="footer-terms">
          <p>This is a computer-generated store issue slip issued under institutional inventory management. Goods once distributed may be exchanged within 3 days in unused original condition with this slip.</p>
        </div>
      </div>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .receipt-modal-container {
      width: 100%;
      max-width: 860px;
      margin: 0 auto;
      background: #f8fafc;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* Top Action Bar matching AGENTS.md rule */
    .modal-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
    }

    .modal-title {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .title-badge {
      width: 42px;
      height: 42px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .title-text-group {
      display: flex;
      flex-direction: column;
    }

    .main-title {
      font-size: 17px;
      font-weight: 700;
      color: #1e3a8a;
    }

    .sub-title {
      font-size: 12px;
      color: #3b82f6;
      font-weight: 500;
    }

    .btn-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .print-btn {
      background: #2563eb !important;
      color: #ffffff !important;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 8px;
    }

    .header-close-btn {
      color: #64748b;
      &:hover { color: #1e293b; background: rgba(0,0,0,0.05); }
    }

    /* Paper Document */
    .receipt-paper {
      background: #ffffff;
      padding: 32px 36px;
      margin: 20px 24px 30px;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #0f172a;
    }

    .paper-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 20px;
    }

    .inst-info {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .logo-mark {
      width: 58px;
      height: 58px;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: visible;
      flex-shrink: 0;

      &.has-img,
      &.transparent-logo-mark {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
      }

      .inst-logo-img {
        max-width: 100%;
        max-height: 100%;
        width: 100%;
        height: 100%;
        object-fit: contain;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.12));
      }

      .fallback-inst-icon {
        font-size: 34px;
        width: 34px;
        height: 34px;
        color: #2563eb;
      }
    }

    .inst-name {
      margin: 0;
      font-size: 21px;
      font-weight: 800;
      color: #1e3a8a;
      letter-spacing: -0.3px;
    }

    .inst-subtitle {
      margin: 3px 0 6px;
      font-size: 13px;
      color: #475569;
    }

    .inst-branch {
      margin: 0;
      font-size: 12px;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .branch-pill {
      font-weight: 600;
      color: #1e40af;
    }

    .branch-dept-sep { color: #cbd5e1; }
    .branch-dept { font-weight: 500; }

    .receipt-badge {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      text-align: right;
    }

    .badge-title {
      font-size: 18px;
      font-weight: 900;
      color: #1e3a8a;
      letter-spacing: 0.5px;
    }

    .badge-sub {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }

    .copy-tag {
      margin-top: 8px;
      font-size: 10px;
      font-weight: 700;
      background: #f1f5f9;
      color: #475569;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Meta Strip */
    .meta-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 18px;
      margin-bottom: 20px;
      gap: 12px;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .meta-label {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .meta-val {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }

    .meta-val.highlight {
      color: #2563eb;
      font-family: monospace;
      font-size: 14px;
    }

    .mode-pill {
      display: inline-block;
      font-size: 12px;
      color: #334155;
    }

    .status-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
      display: inline-block;
      width: fit-content;
    }

    .status-paid { background: #dcfce7; color: #15803d; }
    .status-feebill { background: #e0e7ff; color: #3730a3; }
    .status-due { background: #fef3c7; color: #92400e; }
    .status-free { background: #e0f2fe; color: #0369a1; }
    .status-cancelled { background: #fee2e2; color: #b91c1c; }

    /* Recipient Profile Card */
    .recipient-profile-card {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 22px;
      gap: 16px;
      align-items: center;
    }

    .prof-col {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .prof-row {
      display: flex;
      gap: 8px;
      font-size: 13px;
    }

    .p-lbl {
      color: #64748b;
      font-weight: 500;
      min-width: 130px;
    }

    .p-val {
      color: #0f172a;
      font-weight: 600;
    }

    .p-val.bold-text {
      color: #1e3a8a;
      font-weight: 700;
      font-size: 14px;
    }

    .qr-col {
      align-items: center;
      justify-content: center;
      padding-left: 12px;
      border-left: 1px dashed #cbd5e1;
    }

    .receipt-qr-img {
      width: 72px;
      height: 72px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }

    .qr-caption {
      font-size: 9px;
      color: #64748b;
      margin-top: 4px;
      font-weight: 600;
    }

    /* Items Table */
    .receipt-items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }

    .receipt-items-table th {
      background: #f1f5f9;
      color: #334155;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
    }

    .receipt-items-table td {
      padding: 10px 14px;
      font-size: 13px;
      color: #1e293b;
      border: 1px solid #e2e8f0;
    }

    .item-name-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .primary-item-name {
      font-weight: 600;
      color: #0f172a;
    }

    .item-code-tag {
      font-size: 11px;
      color: #64748b;
      font-family: monospace;
    }

    .item-sub-desc {
      font-size: 11px;
      color: #64748b;
      font-style: italic;
    }

    .receipt-items-table tfoot td {
      border: 1px solid #cbd5e1;
      padding: 12px 14px;
    }

    .total-summary-label {
      background: #f8fafc;
      color: #475569;
      font-size: 12px;
    }

    .grand-total-label {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 800;
      font-size: 13px;
      text-align: right;
      text-transform: uppercase;
    }

    .grand-total-val {
      background: #eff6ff;
      color: #1e40af;
      font-weight: 900;
      font-size: 16px;
      text-align: right;
    }

    /* Words Strip */
    .words-strip {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 16px;
      margin-bottom: 16px;
    }

    .words-content {
      display: flex;
      gap: 10px;
      font-size: 12px;
    }

    .w-lbl {
      color: #64748b;
      font-weight: 700;
      min-width: 120px;
    }

    .w-text {
      color: #1e3a8a;
      font-weight: 700;
      font-style: italic;
    }

    /* Notice Box */
    .notice-box {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 18px;
      border-radius: 8px;
      margin-bottom: 28px;
      font-size: 12px;
    }

    .notice-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .notice-paid {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
      .notice-icon { color: #16a34a; }
    }

    .notice-feebill {
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      color: #3730a3;
      .notice-icon { color: #4f46e5; }
    }

    .notice-due {
      background: #fffbeb;
      border: 1px solid #fde68a;
      color: #92400e;
      .notice-icon { color: #d97706; }
    }

    .notice-free {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      color: #075985;
      .notice-icon { color: #0284c7; }
    }

    /* Signatures */
    .signatures-strip {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }

    .sig-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 200px;
    }

    .sig-line {
      width: 160px;
      height: 1px;
      background: #94a3b8;
      margin-bottom: 8px;
    }

    .sig-role {
      font-size: 12px;
      font-weight: 700;
      color: #1e293b;
    }

    .sig-sub {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }

    .center-seal {
      width: 140px;
    }

    .seal-placeholder {
      border: 1px dashed #cbd5e1;
      border-radius: 50%;
      width: 90px;
      height: 90px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 10px;
      color: #94a3b8;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .footer-terms {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px dashed #e2e8f0;
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
      line-height: 1.5;
    }

    /* Print Stylesheet */
    @media print {
      body * {
        visibility: hidden;
      }

      .no-print {
        display: none !important;
      }

      .receipt-modal-container {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: transparent !important;
        border-radius: 0 !important;
      }

      .receipt-paper,
      .receipt-paper * {
        visibility: visible;
      }

      .receipt-paper {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        margin: 0 !important;
        padding: 20px 24px !important;
        border: none !important;
        box-shadow: none !important;
      }
    }
  `]
})
export class InventoryOutwardReceiptDialogComponent implements OnInit {
  logoUrl: string | null = null;
  logoFailed = false;
  effectiveBranchName = '';
  qrCodeDataUrl = '';

  constructor(
    public dialogRef: MatDialogRef<InventoryOutwardReceiptDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: InventoryOutwardReceiptDialogData,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.effectiveBranchName =
      this.data.branchName ||
      this.authService.currentUser()?.branchName ||
      '';

    this.logoUrl = this.data.logoUrl || this.authService.getInstituteLogoUrl();
    this.generateQrCode();
  }

  generateQrCode(): void {
    const out = this.data.outward;
    const qrPayload = JSON.stringify({
      issueNo: out.issueNumber,
      issuedTo: out.issuedToName,
      totalAmount: out.totalAmount,
      date: out.issueDate,
      status: out.paymentStatus
    });

    QRCode.toDataURL(qrPayload, { width: 140, margin: 1 })
      .then((url: string) => {
        this.qrCodeDataUrl = url;
      })
      .catch((err: unknown) => {
        console.warn('QR Code generation skipped:', err);
      });
  }

  printSlip(): void {
    const el = document.getElementById('store-issue-paper');
    if (!el) {
      window.print();
      return;
    }

    let printIframe = document.getElementById('store-issue-print-frame') as HTMLIFrameElement;
    if (printIframe) {
      printIframe.remove();
    }

    printIframe = document.createElement('iframe');
    printIframe.id = 'store-issue-print-frame';
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
          <title>Store Issue Slip - ${this.data.outward.issueNumber}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 12mm 15mm; color: #0f172a; font-size: 13px; line-height: 1.45; background: #ffffff; }
            .paper-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 2px solid #2563eb; margin-bottom: 16px; }
            .inst-info { display: flex; align-items: center; gap: 14px; }
            .logo-mark { width: 56px; height: 56px; background: transparent !important; border: none !important; box-shadow: none !important; display: flex; align-items: center; justify-content: center; overflow: visible; flex-shrink: 0; }
            .inst-logo-img { width: 100%; height: 100%; object-fit: contain; background: transparent !important; border: none !important; box-shadow: none !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .fallback-inst-icon { font-size: 32px; width: 32px; height: 32px; color: #2563eb; }
            .inst-name { font-size: 1.35rem; font-weight: 800; color: #1e3a8a; }
            .inst-subtitle { font-size: 0.8rem; color: #475569; margin-top: 2px; }
            .inst-branch { font-size: 0.74rem; color: #64748b; font-weight: 600; margin-top: 2px; display: flex; gap: 8px; align-items: center; }
            .branch-pill { color: #1e40af; font-weight: 700; }
            .receipt-badge { text-align: right; }
            .badge-title { font-size: 1.1rem; font-weight: 800; color: #1e3a8a; }
            .badge-sub { font-size: 0.78rem; color: #64748b; font-weight: 600; display: block; margin-top: 2px; }
            .copy-tag { display: inline-block; margin-top: 6px; font-size: 0.65rem; font-weight: 700; background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; border: 1px solid #e2e8f0; }
            .meta-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 16px; }
            .meta-item { display: flex; flex-direction: column; gap: 2px; }
            .meta-label { font-size: 0.68rem; color: #64748b; font-weight: 700; text-transform: uppercase; }
            .meta-val { font-size: 0.82rem; font-weight: 700; color: #0f172a; }
            .meta-val.highlight { color: #2563eb; font-family: monospace; font-size: 0.88rem; }
            .status-pill { display: inline-block; font-size: 0.72rem; font-weight: 700; padding: 1px 7px; border-radius: 4px; width: fit-content; }
            .status-paid { background: #dcfce7; color: #15803d; }
            .status-feebill { background: #e0e7ff; color: #3730a3; }
            .status-due { background: #fef3c7; color: #92400e; }
            .status-free { background: #e0f2fe; color: #0369a1; }
            .status-cancelled { background: #fee2e2; color: #b91c1c; }
            .recipient-profile-card { display: grid; grid-template-columns: 1fr 1fr auto; gap: 14px; padding: 12px 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 16px; align-items: center; }
            .prof-col { display: flex; flex-direction: column; gap: 6px; }
            .prof-row { display: flex; gap: 8px; font-size: 0.82rem; }
            .p-lbl { color: #64748b; font-weight: 600; width: 125px; flex-shrink: 0; }
            .p-val { color: #0f172a; font-weight: 600; }
            .p-val.bold-text { color: #1e3a8a; font-weight: 700; font-size: 0.88rem; }
            .qr-col { display: flex; flex-direction: column; align-items: center; padding-left: 10px; border-left: 1px dashed #cbd5e1; }
            .receipt-qr-img { width: 68px; height: 68px; border-radius: 4px; border: 1px solid #cbd5e1; }
            .qr-caption { font-size: 0.6rem; color: #64748b; font-weight: 700; margin-top: 3px; }
            .receipt-items-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
            .receipt-items-table th { background: #f1f5f9; color: #334155; padding: 8px 10px; font-size: 0.76rem; font-weight: 700; text-transform: uppercase; border: 1px solid #cbd5e1; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .receipt-items-table td { padding: 8px 10px; border: 1px solid #e2e8f0; font-size: 0.82rem; }
            .primary-item-name { font-weight: 600; color: #0f172a; }
            .item-code-tag { font-size: 0.7rem; color: #64748b; font-family: monospace; }
            .item-sub-desc { font-size: 0.7rem; color: #64748b; font-style: italic; }
            .total-summary-label { background: #f8fafc; color: #475569; font-size: 0.76rem; }
            .grand-total-label { background: #f1f5f9; color: #1e293b; font-weight: 800; text-align: right; font-size: 0.82rem; }
            .grand-total-val { background: #eff6ff; color: #1e40af; font-weight: 900; font-size: 1rem; text-align: right; }
            .words-strip { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 8px 12px; margin-bottom: 12px; font-size: 0.78rem; }
            .w-lbl { color: #64748b; font-weight: 700; margin-right: 8px; }
            .w-text { color: #1e3a8a; font-weight: 700; font-style: italic; }
            .notice-box { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 6px; margin-bottom: 24px; font-size: 0.78rem; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .notice-paid { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
            .notice-feebill { background: #eef2ff; border: 1px solid #c7d2fe; color: #3730a3; }
            .notice-due { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
            .notice-free { background: #f0f9ff; border: 1px solid #bae6fd; color: #075985; }
            .notice-icon { display: none; }
            .signatures-strip { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
            .sig-box { display: flex; flex-direction: column; align-items: center; width: 170px; }
            .sig-line { width: 140px; height: 1px; background: #64748b; margin-bottom: 6px; }
            .sig-role { font-size: 0.76rem; font-weight: 700; color: #1e293b; }
            .sig-sub { font-size: 0.66rem; color: #64748b; margin-top: 2px; }
            .seal-placeholder { border: 1px dashed #94a3b8; border-radius: 50%; width: 75px; height: 75px; display: flex; align-items: center; justify-content: center; text-align: center; padding: 6px; color: #94a3b8; font-size: 0.6rem; font-weight: 700; }
            .footer-terms { margin-top: 18px; padding-top: 8px; border-top: 1px dashed #e2e8f0; text-align: center; font-size: 0.65rem; color: #94a3b8; line-height: 1.4; }
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

  getTotalQuantity(): number {
    return (this.data.outward.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
  }

  getStatusPillClass(): string {
    const s = (this.data.outward.paymentStatus || '').toLowerCase();
    if (s.includes('paid')) return 'status-paid';
    if (s.includes('addedtofeebill') || s.includes('feebill')) return 'status-feebill';
    if (s.includes('unpaid') || s.includes('due')) return 'status-due';
    if (s.includes('free') || s.includes('complimentary')) return 'status-free';
    if (s.includes('cancelled')) return 'status-cancelled';
    return 'status-free';
  }

  getTreatmentLabel(): string {
    const s = this.data.outward.paymentStatus || '';
    if (s === 'AddedToFeeBill') return 'Charged to Fee Card';
    if (s === 'Paid') return `Paid (${this.data.outward.paymentMode || 'Cash'})`;
    return s || 'Internal Issue';
  }

  getNoticeClass(): string {
    const s = (this.data.outward.paymentStatus || '').toLowerCase();
    if (s.includes('paid')) return 'notice-paid';
    if (s.includes('addedtofeebill') || s.includes('feebill')) return 'notice-feebill';
    if (s.includes('unpaid') || s.includes('due')) return 'notice-due';
    return 'notice-free';
  }

  getNoticeIcon(): string {
    const s = (this.data.outward.paymentStatus || '').toLowerCase();
    if (s.includes('paid')) return 'check_circle';
    if (s.includes('addedtofeebill') || s.includes('feebill')) return 'receipt_long';
    if (s.includes('unpaid') || s.includes('due')) return 'warning';
    return 'info';
  }

  getNoticeTitle(): string {
    const s = this.data.outward.paymentStatus || '';
    if (s === 'AddedToFeeBill') return 'Fee Card Linked (Added to Student Fee Bill)';
    if (s === 'Paid') return 'Payment Verified (Counter Sale)';
    if (s === 'Unpaid') return 'Payment Pending (Unpaid)';
    return 'Complimentary / Institutional Issue';
  }

  getNoticeDescription(): string {
    const s = this.data.outward.paymentStatus || '';
    if (s === 'AddedToFeeBill') {
      return 'This amount has been officially debited to the student\'s fee account. It will automatically bundle into the upcoming monthly fee bill and can be collected together with school tuition fees.';
    }
    if (s === 'Paid') {
      return `Payment of ₹${this.data.outward.totalAmount.toFixed(2)} received in full at the store counter via ${this.data.outward.paymentMode || 'Cash'}.`;
    }
    if (s === 'Unpaid') {
      return 'Payment is outstanding and due for settlement at the fee/accounts counter.';
    }
    return 'This material has been issued as complimentary institutional kit with zero financial charge.';
  }

  getAmountInWords(amount: number): string {
    if (!amount || amount === 0) return 'Zero Rupees Only';
    const rounded = Math.round(amount);

    const a = [
      '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ',
      'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const numToWords = (num: number): string => {
      if (num === 0) return '';
      if (num < 20) return a[num];
      if (num < 100) return b[Math.floor(num / 10)] + ' ' + a[num % 10];
      if (num < 1000) return a[Math.floor(num / 100)] + 'Hundred ' + numToWords(num % 100);
      if (num < 100000) return numToWords(Math.floor(num / 1000)) + 'Thousand ' + numToWords(num % 1000);
      if (num < 10000000) return numToWords(Math.floor(num / 100000)) + 'Lakh ' + numToWords(num % 100000);
      return numToWords(Math.floor(num / 10000000)) + 'Crore ' + numToWords(num % 10000000);
    };

    return numToWords(rounded).trim() + ' Rupees Only';
  }
}
