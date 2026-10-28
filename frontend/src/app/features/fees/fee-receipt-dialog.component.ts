import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { FeePaymentReceipt, FeesService, UpiPaymentSettings } from '../../core/services/fees.service';
import { AuthService } from '../../core/services/auth.service';
import * as QRCode from 'qrcode';

export interface FeeReceiptDialogData {
  receipt: FeePaymentReceipt;
  instituteName?: string;
  branchName?: string;
  logoUrl?: string | null;
}

@Component({
  selector: 'app-fee-receipt-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatDividerModule],
  template: `
    <div class="receipt-modal-container">
      <!-- Top Action Bar (hidden in print) -->
      <div class="modal-actions no-print">
        <div class="modal-title">
          <div class="title-badge">
            <mat-icon>receipt</mat-icon>
          </div>
          <div class="title-text-group">
            <span class="main-title">Official Fee Payment Receipt</span>
            <span class="sub-title">शुल्क भुगतान रसीद</span>
          </div>
        </div>
        <div class="btn-group">
          <button mat-flat-button class="header-action-btn wa-btn" (click)="shareWhatsApp()" *ngIf="data.receipt.parentPhone" matTooltip="Send WhatsApp Receipt">
            <svg class="wa-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            <span>WhatsApp</span>
          </button>
          <button mat-flat-button class="header-action-btn print-btn" (click)="printReceipt()" matTooltip="Print or Download PDF">
            <mat-icon>print</mat-icon>
            <span>Print Receipt</span>
          </button>
          <button mat-icon-button class="header-close-btn" (click)="dialogRef.close()" matTooltip="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Printable Receipt Document -->
      <div class="receipt-paper" id="receipt-paper">
        <!-- Transparent Dynamic Watermark in background -->
        <div class="receipt-watermark" *ngIf="logoUrl && !logoFailed" [style.backgroundImage]="'url(' + logoUrl + ')'"></div>

        <!-- Header -->
        <div class="paper-header">
          <div class="inst-info">
            <div class="logo-mark transparent-logo-mark" [class.has-img]="logoUrl && !logoFailed">
              <img *ngIf="logoUrl && !logoFailed" [src]="logoUrl" (error)="logoFailed = true" alt="Logo" class="inst-logo-img">
              <mat-icon *ngIf="!logoUrl || logoFailed" class="fallback-inst-icon">account_balance</mat-icon>
            </div>
            <div>
              <h2 class="inst-name">{{ data.instituteName || authService.currentUser()?.instituteName || 'Official Fee Receipt' }}</h2>
              <p class="inst-subtitle">Premier Center for Academic Excellence & Competitive Coaching</p>
              <p class="inst-branch" *ngIf="effectiveBranchName">
                <span class="branch-pill">🏛️ Branch: {{ effectiveBranchName }}</span>
                <span class="branch-dept-sep">|</span>
                <span class="branch-dept">Authorized Accounts Department</span>
              </p>
            </div>
          </div>
          <div class="receipt-badge">
            <span class="badge-title">FEE RECEIPT</span>
            <span class="badge-sub">शुल्क भुगतान रसीद</span>
            <span class="copy-tag">STUDENT ORIGINAL</span>
          </div>
        </div>

        <!-- Meta Info Strip -->
        <div class="meta-strip" [class.has-ref]="!!data.receipt.transactionRef">
          <div class="meta-item">
            <span class="meta-label">Receipt Number:</span>
            <span class="meta-val highlight">{{ data.receipt.receiptNumber }}</span>
          </div>
          <div class="meta-item month-meta-item" *ngIf="feeMonthDisplay">
            <span class="meta-label">Fee Month / Period:</span>
            <span class="meta-val month-pill">{{ feeMonthDisplay }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Academic Session:</span>
            <span class="meta-val session-pill">{{ effectiveSession }}</span>
          </div>
          <div class="meta-item time-item">
            <span class="meta-label">Date & Time (IST):</span>
            <span class="meta-val date-time-val">{{ formatToIST(data.receipt.paymentDate) }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Payment Mode:</span>
            <span class="meta-val mode-pill">{{ getPaymentModeName(data.receipt.mode) }}</span>
          </div>
          <div class="meta-item" *ngIf="data.receipt.transactionRef">
            <span class="meta-label">Txn / UTR Ref:</span>
            <span class="meta-val">{{ data.receipt.transactionRef }}</span>
          </div>
        </div>

        <!-- Student Profile Box -->
        <div class="student-profile-card">
          <div class="prof-col">
            <div class="prof-row">
              <span class="k">Student Name:</span>
              <span class="v student-highlight">{{ data.receipt.studentName }}</span>
            </div>
            <div class="prof-row">
              <span class="k">Roll / Admission No:</span>
              <span class="v"><strong>{{ data.receipt.rollNumber || 'N/A' }}</strong></span>
            </div>
            <div class="prof-row" *ngIf="data.receipt.className && !data.receipt.batchName">
              <span class="k">Class & Section:</span>
              <span class="v"><strong>{{ data.receipt.className }}<span *ngIf="data.receipt.sectionName"> (Section {{ data.receipt.sectionName }})</span></strong></span>
            </div>
            <div class="prof-row" *ngIf="data.receipt.className && data.receipt.batchName">
              <span class="k">Coaching:</span>
              <span class="v"><strong>{{ data.receipt.className }}</strong></span>
            </div>
            <div class="prof-row" *ngIf="!data.receipt.className && data.receipt.batchName">
              <span class="k">Coaching:</span>
              <span class="v"><strong>Coaching</strong></span>
            </div>
            <div class="prof-row" *ngIf="!data.receipt.className && !data.receipt.batchName">
              <span class="k">Academic Stream:</span>
              <span class="v">General Academic</span>
            </div>
            <div class="prof-row fee-month-row" *ngIf="feeMonthDisplay">
              <span class="k">Fee Month (शुल्क माह):</span>
              <span class="v fee-month-badge" [title]="feeMonthTooltip">
                <strong>{{ feeMonthDisplay }}</strong>
              </span>
            </div>
            <div class="prof-row" *ngIf="!feeMonthDisplay">
              <span class="k">Academic Session:</span>
              <span class="v"><strong>{{ effectiveSession }}</strong></span>
            </div>
          </div>
          <div class="prof-col">
            <div class="prof-row">
              <span class="k">Father / Guardian:</span>
              <span class="v">{{ data.receipt.parentName || 'N/A' }}</span>
            </div>
            <div class="prof-row">
              <span class="k">Contact / WhatsApp:</span>
              <span class="v">{{ data.receipt.parentPhone || 'N/A' }}</span>
            </div>
            <div class="prof-row" *ngIf="data.receipt.batchName">
              <span class="k">Batch:</span>
              <span class="v"><strong>{{ data.receipt.batchName }}</strong></span>
            </div>
            <div class="prof-row">
              <span class="k">Settlement Type:</span>
              <span class="v status-pill">FIFO Auto-Settlement</span>
            </div>
            <div class="prof-row" *ngIf="data.receipt.hostelInfo">
              <span class="k">🏠 Hostel Facility:</span>
              <span class="v hostel-info-pill">{{ data.receipt.hostelInfo }}</span>
            </div>
          </div>
        </div>

        <!-- Fees Breakdown Table -->
        <div class="table-section">
          <table class="receipt-table">
            <thead>
              <tr>
                <th class="text-center" style="width: 48px;">#</th>
                <th>Fee Head / Particulars</th>
                <th class="text-right" style="width: 180px;">Amount Received (₹)</th>
              </tr>
            </thead>
            <tbody>
              <!-- Multi-line breakdown (Tuition + Library Fine) -->
              <ng-container *ngIf="data.receipt.items && data.receipt.items.length > 0; else fallbackReceiptRows">
                <tr *ngFor="let item of data.receipt.items">
                  <td class="text-center">{{ item.itemIndex }}</td>
                  <td>
                    <strong class="fee-head-title">{{ item.particulars }}</strong>
                    <div class="fee-head-sub" *ngIf="formatSubTitle(item.subTitle)">{{ formatSubTitle(item.subTitle) }}</div>
                  </td>
                  <td class="text-right amount-col">
                    <strong>₹{{ item.amount | number:'1.2-2' }}</strong>
                  </td>
                </tr>
              </ng-container>

              <ng-template #fallbackReceiptRows>
                <tr>
                  <td class="text-center">1</td>
                  <td>
                    <strong class="fee-head-title">Tuition & Coaching Fee Settlement</strong>
                    <div class="fee-head-sub">{{ data.receipt.remarks || 'Standard Monthly Tuition Fee installment' }}</div>
                  </td>
                  <td class="text-right amount-col">
                    <strong>₹{{ (data.receipt.tuitionAmountPaid !== undefined && data.receipt.tuitionAmountPaid > 0 ? data.receipt.tuitionAmountPaid : data.receipt.amountPaid) | number:'1.2-2' }}</strong>
                  </td>
                </tr>
                <tr *ngIf="data.receipt.libraryFineAmountPaid && data.receipt.libraryFineAmountPaid > 0">
                  <td class="text-center">2</td>
                  <td>
                    <strong class="fee-head-title">Library Overdue Fine Settlement</strong>
                    <div class="fee-head-sub">{{ data.receipt.libraryFineParticulars || 'Late Return Fine Settlement' }}</div>
                  </td>
                  <td class="text-right amount-col">
                    <strong>₹{{ data.receipt.libraryFineAmountPaid | number:'1.2-2' }}</strong>
                  </td>
                </tr>
              </ng-template>

              <tr class="summary-subtotal">
                <td colspan="2" class="text-right"><strong>Total Amount Received:</strong></td>
                <td class="text-right grand-paid">₹{{ data.receipt.amountPaid | number:'1.2-2' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Amount In Words Box -->
        <div class="amount-words-strip">
          <div class="words-left">
            <span class="w-label">Amount in Words:</span>
            <span class="w-text">{{ getAmountInWords(data.receipt.amountPaid) }}</span>
          </div>
          <div class="words-right">
            <div class="paid-stamp">
              <mat-icon>check_circle</mat-icon>
              <span>PAID</span>
            </div>
          </div>
        </div>

        <!-- Statement of Previous Unpaid Arrears / पिछला बकाया विवरण -->
        <div class="arrears-card" *ngIf="data.receipt.pendingArrears && data.receipt.pendingArrears.length > 0">
          <div class="arrears-card-header">
            <div class="arr-header-title">
              <mat-icon class="arr-icon">history_toggle_off</mat-icon>
              <span>Statement of Previous Dues &amp; Arrears (पिछला बकाया विवरण)</span>
            </div>
            <span class="arr-total-pill">
              Total Previous Arrears: <strong>₹{{ totalArrearsAmount | number:'1.2-2' }}</strong>
            </span>
          </div>
          <table class="arrears-table">
            <thead>
              <tr>
                <th style="width: 35px;" class="text-center">#</th>
                <th>Billing Cycle / Month</th>
                <th>Bill / Invoice Reference</th>
                <th>Particulars</th>
                <th class="text-right" style="width: 150px;">Unsettled Due (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let arr of data.receipt.pendingArrears; let idx = index">
                <td class="text-center">{{ idx + 1 }}</td>
                <td><strong class="arr-period">{{ arr.period }}</strong></td>
                <td><code class="arr-inv-code">{{ arr.invoiceNumber }}</code></td>
                <td>{{ arr.title }}</td>
                <td class="text-right arr-due-val">
                  <strong>₹{{ arr.dueAmount | number:'1.2-2' }}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Remaining Due Balance Strip with Full Demand Reconciliation -->
        <div class="due-status-strip" [class.cleared]="data.receipt.remainingDue === 0" [class.due-alert]="data.receipt.remainingDue > 0">
          <div class="due-info">
            <span class="due-title">
              <mat-icon class="status-icon">{{ data.receipt.remainingDue === 0 ? 'verified' : 'info' }}</mat-icon>
              {{ data.receipt.remainingDue === 0 ? 'Account Status: All Dues Cleared' : 'Current Account Status: Partial Payment Recorded' }}
            </span>
            <span class="due-desc" *ngIf="data.receipt.remainingDue > 0 && data.receipt.pendingArrears && data.receipt.pendingArrears.length > 0">
              Notice: Previous billing cycles (listed above) remain unsettled. Total outstanding balance is ₹{{ data.receipt.remainingDue | number:'1.2-2' }}.
            </span>
            <span class="due-desc" *ngIf="data.receipt.remainingDue > 0 && (!data.receipt.pendingArrears || data.receipt.pendingArrears.length === 0)">
              Please clear the remaining balance before the next installment cycle.
            </span>
          </div>
          <div class="demand-reconcile-box" *ngIf="data.receipt.pendingArrears && data.receipt.pendingArrears.length > 0">
            <div class="rec-item">
              <span class="rec-lbl">Total Demand:</span>
              <span class="rec-val">₹{{ totalDemandAmount | number:'1.2-2' }}</span>
            </div>
            <div class="rec-sep">-</div>
            <div class="rec-item">
              <span class="rec-lbl">Paid Today:</span>
              <span class="rec-val paid-now">₹{{ data.receipt.amountPaid | number:'1.2-2' }}</span>
            </div>
            <div class="rec-sep">=</div>
            <div class="due-amount-box">
              <span class="due-lbl">Balance Due:</span>
              <span class="due-num">₹{{ data.receipt.remainingDue | number:'1.2-2' }}</span>
            </div>
          </div>
          <div class="due-amount-box" *ngIf="!data.receipt.pendingArrears || data.receipt.pendingArrears.length === 0">
            <span class="due-lbl">Remaining Balance Due:</span>
            <span class="due-num">₹{{ data.receipt.remainingDue | number:'1.2-2' }}</span>
          </div>
        </div>

        <!-- UPI Dynamic Scan & Pay Block for Remaining Dues -->
        <div class="upi-payment-banner" *ngIf="data.receipt.remainingDue > 0">
          <div class="upi-qr-col">
            <div class="qr-frame">
              <img *ngIf="qrDataUrl" [src]="qrDataUrl" alt="Scan to Pay Remaining Due via UPI" class="qr-img" />
              <div *ngIf="!qrDataUrl" class="qr-placeholder">
                <mat-icon>qr_code_2</mat-icon>
              </div>
            </div>
            <div class="scan-tag">
              <span>SCAN TO PAY REMAINING DUE</span>
            </div>
          </div>

          <div class="upi-info-col">
            <div class="upi-info-header">
              <div class="upi-badge">
                <mat-icon>qr_code_scanner</mat-icon>
                <span>Clear Balance Due via UPI (बकाया शुल्क क्यूआर भुगतान)</span>
              </div>
              <div class="upi-supported-apps">
                <span class="app-chip gpay">GPay</span>
                <span class="app-chip phonepe">PhonePe</span>
                <span class="app-chip paytm">Paytm</span>
                <span class="app-chip bhim">BHIM</span>
                <span class="app-chip">Any UPI</span>
              </div>
            </div>

            <div class="upi-details-grid">
              <div class="detail-box amt-box">
                <span class="d-label">Exact Balance Due:</span>
                <span class="d-val amt-val">₹{{ data.receipt.remainingDue | number:'1.2-2' }}</span>
              </div>
              <div class="detail-box">
                <span class="d-label">Payee Name:</span>
                <span class="d-val">{{ payeeMerchantName }}</span>
              </div>
              <div class="detail-box">
                <span class="d-label">Payee UPI ID (VPA):</span>
                <span class="d-val font-mono upi-id-val">{{ payeeUpiId }}</span>
              </div>
              <div class="detail-box" *ngIf="bankAccountDisplay">
                <span class="d-label">Institute Bank A/C:</span>
                <span class="d-val font-mono">{{ bankAccountDisplay }}</span>
              </div>
            </div>

            <div class="upi-help-note">
              <mat-icon>verified</mat-icon>
              <span>Scan using any UPI app to pay the remaining ₹{{ data.receipt.remainingDue | number:'1.2-2' }}. Student Roll #{{ data.receipt.rollNumber || 'N/A' }} and receipt ref {{ data.receipt.receiptNumber }} will be auto-attached.</span>
            </div>
          </div>
        </div>

        <!-- Official E-Receipt Verification Seal (When All Dues Cleared) -->
        <div class="cleared-receipt-qr-strip" *ngIf="data.receipt.remainingDue === 0 && qrDataUrl">
          <div class="qr-mini-box">
            <img [src]="qrDataUrl" alt="Verified Receipt QR" class="qr-mini-img" />
          </div>
          <div class="qr-verify-text">
            <div class="v-title"><mat-icon>verified</mat-icon> <span>Tamper-Proof Digital Verification QR</span></div>
            <p>Official cryptographic proof of payment for Receipt #<strong>{{ data.receipt.receiptNumber }}</strong>. Scan to verify transaction authenticity &amp; student clearance.</p>
          </div>
        </div>

        <!-- Library Dues Clearance Notice (Printed when student has pending library dues) -->
        <div class="library-clearance-notice" *ngIf="data.receipt.pendingLibraryFine && data.receipt.pendingLibraryFine > 0">
          <div class="notice-badge">
            <mat-icon class="notice-icon">local_library</mat-icon>
            <span>INSTITUTIONAL CLEARANCE NOTICE:</span>
          </div>
          <div class="notice-body">
            Student has an unsettled Library Fine balance of <strong>₹{{ data.receipt.pendingLibraryFine | number:'1.2-2' }}</strong>. Please clear at the library circulation desk to obtain No-Dues clearance.
          </div>
        </div>

        <!-- Terms & Notes -->
        <div class="receipt-terms">
          <span class="terms-title">Terms & Conditions / महत्वपूर्ण सूचना:</span>
          <ol>
            <li>Fees once paid is non-refundable and non-transferable under any circumstances.</li>
            <li>Please preserve this digital receipt for admit card issuance, test verification, and future clearance.</li>
            <li>In case of online/cheque payments, receipt is valid subject to actual realization in institute bank account.</li>
          </ol>
        </div>

        <!-- Signature Blocks -->
        <div class="signatures-row">
          <div class="sig-col">
            <div class="sig-line"></div>
            <span class="sig-text">Student / Depositor Signature</span>
          </div>
          <div class="sig-col text-center">
            <img *ngIf="officialSealUrl" [src]="officialSealUrl" alt="Official Seal" class="uploaded-official-seal-img" />
            <div *ngIf="!officialSealUrl" class="digital-seal">
              <mat-icon>verified</mat-icon>
              <span>ELECTRONICALLY AUDITED</span>
              <small>{{ data.receipt.paymentDate | date:'dd-MMM-yyyy' }}</small>
            </div>
          </div>
          <div class="sig-col text-right">
            <div class="digital-sign-wrapper" *ngIf="digitalSignatureUrl">
              <img [src]="digitalSignatureUrl" alt="Authorized Signature" class="digital-sign-img" />
            </div>
            <div class="sig-line"></div>
            <span class="sig-text">Accounts In-charge / Cashier</span>
            <small class="auth-sub">{{ data.instituteName || authService.currentUser()?.instituteName || authService.getInstituteName() || 'Institution' }}</small>
          </div>
        </div>

        <!-- Footer Notice -->
        <div class="paper-footer">
          <span>This is an official computer-generated receipt from IMSERP Coaching Management Suite.</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      margin: 0;
      padding: 0;
    }

    .receipt-modal-container {
      width: 100%;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }

    .modal-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      color: #1e3a8a;
      border-bottom: 1px solid #bfdbfe;
      flex-shrink: 0;

      .modal-title {
        display: flex;
        align-items: center;
        gap: 12px;

        .title-badge {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          mat-icon { font-size: 20px; width: 20px; height: 20px; }
        }

        .title-text-group {
          display: flex;
          flex-direction: column;
          .main-title {
            font-weight: 700;
            font-size: 1.05rem;
            color: #1e3a8a;
            letter-spacing: -0.01em;
          }
          .sub-title {
            font-size: 0.74rem;
            color: #3b82f6;
            font-weight: 600;
          }
        }
      }

      .btn-group {
        display: flex;
        align-items: center;
        gap: 8px;

        .header-action-btn {
          height: 34px !important;
          padding: 0 14px !important;
          border-radius: 6px !important;
          font-size: 0.8rem !important;
          font-weight: 600 !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
          letter-spacing: 0.02em !important;
          transition: transform 0.15s ease, background 0.15s ease !important;

          mat-icon { font-size: 16px; width: 16px; height: 16px; }

          &.wa-btn {
            background: #16a34a !important;
            color: #ffffff !important;
            .wa-icon { width: 15px; height: 15px; fill: #ffffff; }
            &:hover { background: #15803d !important; transform: translateY(-1px); }
          }

          &.print-btn {
            background: #2563eb !important;
            color: #ffffff !important;
            &:hover { background: #1d4ed8 !important; transform: translateY(-1px); }
          }
        }

        .header-close-btn {
          color: #64748b !important;
          width: 34px !important;
          height: 34px !important;
          border-radius: 6px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: color 0.15s ease, background 0.15s ease !important;
          mat-icon { font-size: 20px; width: 20px; height: 20px; }
          &:hover {
            color: #1e293b !important;
            background: rgba(30, 41, 59, 0.08) !important;
          }
        }
      }
    }

    .receipt-paper {
      position: relative;
      padding: 24px 32px;
      background: #ffffff;
      color: #0f172a;
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 13.5px;
      line-height: 1.45;
      overflow-y: auto;
      max-height: calc(85vh - 56px);

      .receipt-watermark {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 320px;
        height: 320px;
        opacity: 0.04;
        pointer-events: none;
        background-size: contain;
        background-position: center;
        background-repeat: no-repeat;
        z-index: 0;
      }

      &::-webkit-scrollbar {
        width: 6px;
      }
      &::-webkit-scrollbar-track {
        background: #f8fafc;
      }
      &::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
      }
      &::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
    }

    .paper-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 16px;
      border-bottom: 2px solid #0f172a;

      .inst-info {
        display: flex;
        align-items: center;
        gap: 16px;

        .logo-mark {
          width: 58px;
          height: 58px;
          border-radius: 0;
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
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15));
          }

          mat-icon { font-size: 32px; width: 32px; height: 32px; color: #2563eb; }
        }

        .inst-name {
          margin: 0;
          font-size: 1.45rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
        }

        .inst-subtitle {
          margin: 2px 0 0 0;
          font-size: 0.84rem;
          color: #475569;
        }

        .inst-branch {
          margin: 4px 0 0 0;
          font-size: 0.8rem;
          color: #3b82f6;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;

          .branch-pill {
            background: #eff6ff;
            color: #1e40af;
            padding: 2px 8px;
            border-radius: 6px;
            border: 1px solid #bfdbfe;
            font-weight: 700;
            font-size: 0.76rem;
          }
          .branch-dept-sep { color: #94a3b8; }
          .branch-dept { color: #64748b; font-weight: 500; font-size: 0.74rem; }
        }
      }

      .receipt-badge {
        display: flex;
        flex-direction: column;
        align-items: flex-end;

        .badge-title {
          font-size: 1.15rem;
          font-weight: 800;
          color: #1e40af;
          letter-spacing: 0.05em;
        }

        .badge-sub {
          font-size: 0.8rem;
          color: #64748b;
          font-weight: 600;
        }

        .copy-tag {
          margin-top: 4px;
          font-size: 0.68rem;
          font-weight: 700;
          background: #e0f2fe;
          color: #0369a1;
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid #bae6fd;
          letter-spacing: 0.04em;
        }
      }
    }

    .meta-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 18px;
      padding: 12px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      margin: 16px 0;

      .meta-item {
        display: flex;
        flex-direction: column;
        min-width: 120px;
        flex: 1 1 auto;

        .branch-val {
          color: #1e40af;
          font-weight: 700;
        }
        .meta-label {
          font-size: 0.72rem;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .meta-val {
          font-size: 0.88rem;
          font-weight: 700;
          color: #1e293b;
          margin-top: 2px;
          white-space: nowrap;
        }
        .meta-val.highlight { color: #1e40af; }
        .session-pill {
          display: inline-block;
          background: #eff6ff;
          color: #1e40af;
          border: 1px solid #bfdbfe;
          padding: 1px 8px;
          border-radius: 4px;
          width: fit-content;
          font-weight: 700;
          font-size: 0.8rem;
          white-space: nowrap;
        }
        .month-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          padding: 2px 9px;
          border-radius: 4px;
          width: fit-content;
          font-weight: 800;
          font-size: 0.82rem;
          white-space: nowrap;
          box-shadow: 0 1px 2px rgba(37, 99, 235, 0.08);

          mat-icon.pill-icon {
            font-size: 15px;
            width: 15px;
            height: 15px;
            color: #2563eb;
          }
        }
        .mode-pill {
          display: inline-block;
          background: #dcfce7;
          color: #15803d;
          padding: 1px 8px;
          border-radius: 4px;
          width: fit-content;
          font-size: 0.8rem;
          white-space: nowrap;
        }
      }
    }

    .student-profile-card {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      padding: 14px 18px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      margin-bottom: 16px;

      .prof-col {
        display: flex;
        flex-direction: column;
        gap: 6px;

        .prof-row {
          display: flex;
          align-items: center;
          font-size: 0.86rem;
          .k { width: 155px; white-space: nowrap; color: #475569; font-weight: 600; flex-shrink: 0; }
          .v { color: #0f172a; flex: 1; min-width: 0; }
          .student-highlight { font-weight: 800; color: #15803d; font-size: 0.95rem; }
          &.fee-month-row {
            white-space: nowrap;
            align-items: center;
          }
          .fee-month-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: #eff6ff;
            color: #1e40af;
            border: 1px solid #bfdbfe;
            padding: 1px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 0.74rem;
            line-height: 1.35;
            width: fit-content;
            max-width: 100%;
            white-space: nowrap;
            box-shadow: 0 1px 2px rgba(37, 99, 235, 0.06);

            strong {
              font-weight: 600;
              font-size: 0.74rem;
              white-space: nowrap;
            }

            mat-icon.pill-icon {
              font-size: 13px;
              width: 13px;
              height: 13px;
              color: #2563eb;
            }
          }
          .status-pill {
            display: inline-block;
            background: #e0f2fe;
            color: #0369a1;
            padding: 1px 8px;
            border-radius: 4px;
            font-size: 0.76rem;
            font-weight: 600;
            width: fit-content;
          }
          .hostel-info-pill {
            display: inline-block;
            background: #dcfce7;
            color: #166534;
            padding: 1px 8px;
            border-radius: 4px;
            font-size: 0.76rem;
            font-weight: 600;
            width: fit-content;
            border: 1px solid #bbf7d0;
          }
        }
      }
    }

    .table-section {
      margin-bottom: 14px;

      .receipt-table {
        width: 100%;
        border-collapse: collapse;

        th {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          color: #1e3a8a;
          border-top: 1px solid #bfdbfe;
          border-bottom: 2px solid #bfdbfe;
          padding: 9px 12px;
          font-size: 0.8rem;
          font-weight: 700;
          text-align: left;
        }

        td {
          padding: 10px 12px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 0.88rem;
        }

        .fee-head-main-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .head-period-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          padding: 1px 7px;
          border-radius: 4px;
          font-weight: 700;
          font-size: 0.74rem;
          white-space: nowrap;

          mat-icon {
            font-size: 13px;
            width: 13px;
            height: 13px;
            color: #2563eb;
          }
        }

        .fee-head-title { color: #0f172a; font-size: 0.92rem; }
        .fee-head-sub { font-size: 0.78rem; color: #64748b; margin-top: 2px; }

        .summary-subtotal {
          background: #f8fafc;
          border-top: 2px solid #cbd5e1;
          font-size: 0.95rem;
          .grand-paid {
            font-size: 1.15rem;
            font-weight: 800;
            color: #16a34a;
          }
        }
      }
    }

    .amount-words-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      background: #eff6ff;
      border: 1px dashed #93c5fd;
      border-radius: 6px;
      margin-bottom: 14px;

      .words-left {
        display: flex;
        flex-direction: column;
        .w-label { font-size: 0.72rem; color: #3b82f6; font-weight: 700; text-transform: uppercase; }
        .w-text { font-size: 0.92rem; font-weight: 700; color: #1e3a8a; }
      }

      .paid-stamp {
        display: flex;
        align-items: center;
        gap: 6px;
        background: #16a34a;
        color: #ffffff;
        padding: 4px 14px;
        border-radius: 20px;
        font-weight: 800;
        font-size: 0.85rem;
        letter-spacing: 0.05em;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
    }

    /* Statement of Previous Dues & Arrears Card */
    .arrears-card {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      margin-bottom: 14px;
      overflow: hidden;
      position: relative;
      z-index: 1;

      .arrears-card-header {
        background: #fef3c7;
        padding: 8px 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #fde68a;

        .arr-header-title {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #92400e;
          font-weight: 700;
          font-size: 0.85rem;

          .arr-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
            color: #b45309;
          }
        }

        .arr-total-pill {
          background: #fef08a;
          color: #854d0e;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.76rem;
          font-weight: 600;
          border: 1px solid #facc15;
          strong {
            color: #713f12;
            font-weight: 800;
          }
        }
      }

      .arrears-table {
        width: 100%;
        border-collapse: collapse;

        th {
          background: #fffdf5;
          color: #78350f;
          padding: 7px 12px;
          font-size: 0.76rem;
          font-weight: 700;
          text-align: left;
          border-bottom: 1px solid #fde68a;
        }

        td {
          padding: 8px 12px;
          border-bottom: 1px solid #fef3c7;
          font-size: 0.84rem;
          color: #451a03;
        }

        .arr-period {
          color: #78350f;
          font-weight: 700;
        }

        .arr-inv-code {
          background: #fef9c3;
          padding: 1px 5px;
          border-radius: 3px;
          font-family: monospace;
          font-size: 0.78rem;
          color: #854d0e;
          border: 1px solid #fef08a;
        }

        .arr-due-val {
          color: #b45309;
          font-size: 0.9rem;
          font-weight: 700;
        }
      }
    }

    .due-status-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      border-radius: 6px;
      margin-bottom: 14px;
      position: relative;
      z-index: 1;

      &.cleared {
        background: #f0fdf4;
        border: 1px solid #86efac;
        .due-title { color: #166534; font-weight: 700; font-size: 0.88rem; display: flex; align-items: center; gap: 6px; }
        .due-num { color: #166534; font-size: 1.1rem; font-weight: 800; }
        .status-icon { color: #16a34a; font-size: 18px; width: 18px; height: 18px; }
      }

      &.due-alert {
        background: #fff1f2;
        border: 1px solid #fecdd3;
        .due-title { color: #9f1239; font-weight: 700; font-size: 0.88rem; display: flex; align-items: center; gap: 6px; }
        .due-desc { font-size: 0.78rem; color: #be123c; margin-top: 2px; display: block; }
        .due-num { color: #e11d48; font-size: 1.1rem; font-weight: 800; }
        .status-icon { color: #e11d48; font-size: 18px; width: 18px; height: 18px; }
      }

      .demand-reconcile-box {
        display: flex;
        align-items: center;
        gap: 12px;
        background: #ffffff;
        padding: 4px 12px;
        border-radius: 6px;
        border: 1px solid #fecdd3;

        .rec-item {
          display: flex;
          flex-direction: column;
          text-align: right;

          .rec-lbl {
            font-size: 0.65rem;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
          }
          .rec-val {
            font-size: 0.92rem;
            font-weight: 700;
            color: #0f172a;

            &.paid-now {
              color: #16a34a;
            }
          }
        }
        .rec-sep {
          color: #94a3b8;
          font-weight: 800;
          font-size: 1rem;
        }
      }

      .due-amount-box {
        text-align: right;
        .due-lbl { font-size: 0.72rem; color: #64748b; font-weight: 600; text-transform: uppercase; display: block; }
      }
    }

    /* Dynamic UPI Payment Banner on Receipt */
    .upi-payment-banner {
      display: flex;
      gap: 16px;
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
      border: 1.5px solid #a7f3d0;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 14px;
      align-items: center;

      .upi-qr-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex-shrink: 0;

        .qr-frame {
          width: 120px;
          height: 120px;
          background: #ffffff;
          padding: 6px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.06);

          .qr-img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
          }

          .qr-placeholder {
            color: #94a3b8;
            mat-icon { font-size: 48px; width: 48px; height: 48px; }
          }
        }

        .scan-tag {
          margin-top: 4px;
          font-size: 0.62rem;
          font-weight: 800;
          color: #065f46;
          background: #d1fae5;
          padding: 1px 6px;
          border-radius: 4px;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }
      }

      .upi-info-col {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 6px;

        .upi-info-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;

          .upi-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 0.82rem;
            font-weight: 700;
            color: #065f46;

            mat-icon { font-size: 18px; width: 18px; height: 18px; color: #059669; }
          }

          .upi-supported-apps {
            display: flex;
            gap: 4px;

            .app-chip {
              font-size: 0.65rem;
              font-weight: 700;
              background: #ffffff;
              color: #334155;
              border: 1px solid #cbd5e1;
              padding: 1px 5px;
              border-radius: 4px;

              &.gpay { color: #1a73e8; border-color: #93c5fd; }
              &.phonepe { color: #5f259f; border-color: #d8b4fe; }
              &.paytm { color: #00b9f1; border-color: #7dd3fc; }
              &.bhim { color: #00796b; border-color: #80cbc4; }
            }
          }
        }

        .upi-details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 4px 10px;
          background: #ffffff;
          padding: 8px 10px;
          border-radius: 6px;
          border: 1px solid #d1fae5;

          .detail-box {
            display: flex;
            flex-direction: column;

            .d-label {
              font-size: 0.68rem;
              color: #64748b;
              font-weight: 600;
            }

            .d-val {
              font-size: 0.82rem;
              color: #0f172a;
              font-weight: 700;

              &.amt-val { color: #b91c1c; font-size: 0.95rem; }
              &.upi-id-val { color: #065f46; }
            }
          }
        }

        .upi-help-note {
          display: flex;
          align-items: flex-start;
          gap: 4px;
          font-size: 0.72rem;
          color: #047857;
          line-height: 1.35;

          mat-icon { font-size: 14px; width: 14px; height: 14px; flex-shrink: 0; margin-top: 1px; color: #059669; }
        }
      }
    }

    .cleared-receipt-qr-strip {
      display: flex;
      align-items: center;
      gap: 14px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 14px;

      .qr-mini-box {
        width: 60px;
        height: 60px;
        background: #fff;
        padding: 3px;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        flex-shrink: 0;

        .qr-mini-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
      }

      .qr-verify-text {
        flex: 1;

        .v-title {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.78rem;
          font-weight: 700;
          color: #166534;

          mat-icon { font-size: 15px; width: 15px; height: 15px; color: #16a34a; }
        }

        p {
          margin: 2px 0 0;
          font-size: 0.72rem;
          color: #475569;
          line-height: 1.35;
        }
      }
    }

    .library-clearance-notice {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #faf5ff;
      border: 1px dashed #d8b4fe;
      border-radius: 6px;
      padding: 8px 14px;
      margin-bottom: 14px;
      font-size: 0.8rem;
      color: #6b21a8;

      .notice-badge {
        display: flex;
        align-items: center;
        gap: 5px;
        font-weight: 700;
        white-space: nowrap;
        color: #7e22ce;
        .notice-icon { font-size: 17px; width: 17px; height: 17px; color: #a855f7; }
      }
      .notice-body {
        color: #581c87;
      }
    }

    .receipt-terms {
      font-size: 0.75rem;
      color: #64748b;
      background: #f8fafc;
      padding: 8px 14px;
      border-radius: 6px;
      margin-bottom: 24px;

      .terms-title { font-weight: 700; color: #334155; }
      ol { margin: 4px 0 0 16px; padding: 0; }
      li { margin-bottom: 2px; }
    }

    .signatures-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 28px;
      margin-bottom: 16px;

      .sig-col {
        width: 200px;
        display: flex;
        flex-direction: column;

        .sig-line {
          height: 1px;
          background: #475569;
          margin-bottom: 6px;
        }

        .sig-text {
          font-size: 0.78rem;
          font-weight: 700;
          color: #334155;
        }

        .auth-sub {
          font-size: 0.7rem;
          color: #64748b;
        }

        .uploaded-official-seal-img {
          max-width: 68px;
          max-height: 68px;
          object-fit: contain;
          display: block;
          margin: 0 auto;
          opacity: 0.95;
          filter: drop-shadow(0 1px 2px rgba(2, 132, 199, 0.25));
        }

        .digital-sign-wrapper {
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          height: 38px;
          margin-bottom: 2px;
          overflow: visible;

          .digital-sign-img {
            max-height: 38px;
            max-width: 130px;
            object-fit: contain;
            display: block;
            mix-blend-mode: multiply;
            filter: contrast(1.15);
          }
        }

        .digital-seal {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          border: 1.5px dashed #0284c7;
          border-radius: 8px;
          padding: 6px 12px;
          background: #f0f9ff;
          color: #0284c7;
          font-size: 0.72rem;
          font-weight: 800;
          mat-icon { font-size: 20px; width: 20px; height: 20px; margin-bottom: 2px; }
          small { font-size: 0.65rem; color: #64748b; font-weight: 500; }
        }
      }
    }

    .paper-footer {
      text-align: center;
      font-size: 0.7rem;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
    }

    .text-center { text-align: center; }
    .text-right { text-align: right; }

    @media (max-width: 680px) {
      .receipt-paper {
        padding: 14px 12px;
      }
      .paper-header {
        flex-direction: column;
        gap: 12px;
        .inst-info {
          gap: 10px;
          .logo-mark { width: 42px; height: 42px; mat-icon { font-size: 24px; width: 24px; height: 24px; } }
          .inst-name { font-size: 1.15rem; }
        }
        .receipt-badge {
          align-items: flex-start;
        }
      }
      .meta-strip {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
        padding: 8px 10px;
        &.has-ref {
          grid-template-columns: 1fr;
        }
      }
      .student-profile-card {
        grid-template-columns: 1fr;
        gap: 8px;
        padding: 10px;
      }
      .signatures-row {
        flex-direction: column;
        gap: 16px;
        align-items: flex-start;
        .sig-col { width: 100%; }
      }
      .modal-actions {
        padding: 8px 10px;
        .header-action-btn {
          padding: 0 8px !important;
          span:not(.wa-icon) { display: none; }
        }
      }
    }

    @media print {
      .no-print { display: none !important; }
      .receipt-paper {
        padding: 0 !important;
        max-height: none !important;
        overflow: visible !important;
      }
      .uploaded-official-seal-img, .digital-sign-img {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  `]
})
export class FeeReceiptDialogComponent implements OnInit {
  logoUrl: string | null = null;
  logoFailed = false;

  payeeUpiId = 'imserp.fees@sbi';
  payeeMerchantName = '';
  bankAccountDisplay = '';
  qrDataUrl: string | null = null;

  get effectiveSession(): string {
    if (this.data?.receipt?.academicSession) return this.data.receipt.academicSession;
    const dateStr = this.data?.receipt?.paymentDate;
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const startYear = d.getMonth() >= 3 ? year : year - 1;
        return `${startYear}-${startYear + 1}`;
      }
    }
    const current = new Date();
    const startYear = current.getMonth() >= 3 ? current.getFullYear() : current.getFullYear() - 1;
    return `${startYear}-${startYear + 1}`;
  }

  get effectiveBranchName(): string {
    if (this.data?.receipt?.branchName) return this.data.receipt.branchName;
    if (this.data?.branchName && this.data.branchName !== 'All Branches / Head Office') return this.data.branchName;
    const authBranch = this.authService.getCurrentBranchName();
    if (authBranch) return authBranch;
    const batch = this.data?.receipt?.batchName || '';
    const match = batch.match(/\(([^)]+)\)/);
    if (match) return match[1];
    return 'Main Branch';
  }

  get feeMonthTooltip(): string {
    const r = this.data?.receipt;
    if (!r) return '';
    return (r as any).feePeriod || (r as any).feeMonth || this.feeMonthDisplay;
  }

  get feeMonthDisplay(): string {
    const r = this.data?.receipt;
    if (!r) return '';
    let raw = '';
    if ((r as any).feePeriod && (r as any).feePeriod.trim()) {
      raw = (r as any).feePeriod.trim();
    } else if ((r as any).feeMonth && (r as any).feeMonth.trim()) {
      raw = (r as any).feeMonth.trim();
    } else {
      const periodsFound: string[] = [];
      const monthRegex = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi;

      // 1. Extract from line items (subTitle and particulars)
      if (r.items && r.items.length > 0) {
        for (const item of r.items) {
          const textToSearch = `${item.subTitle || ''} ${item.particulars || ''}`;
          let match: RegExpExecArray | null;
          while ((match = monthRegex.exec(textToSearch)) !== null) {
            const cap = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() + ' ' + match[2];
            if (!periodsFound.includes(cap)) {
              periodsFound.push(cap);
            }
          }
        }
      }

      // 2. Extract from remarks
      if (periodsFound.length === 0 && r.remarks) {
        let match: RegExpExecArray | null;
        while ((match = monthRegex.exec(r.remarks)) !== null) {
          const cap = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() + ' ' + match[2];
          if (!periodsFound.includes(cap)) {
            periodsFound.push(cap);
          }
        }
      }

      // 3. Extract from invoice number (e.g. INV-202611-825 -> November 2026)
      if (periodsFound.length === 0 && r.invoiceNumber) {
        const invMatch = r.invoiceNumber.match(/INV-(\d{4})(\d{2})-/i);
        if (invMatch) {
          const year = parseInt(invMatch[1], 10);
          const monthIdx = parseInt(invMatch[2], 10) - 1;
          const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          if (monthIdx >= 0 && monthIdx < 12) {
            periodsFound.push(`${months[monthIdx]} ${year}`);
          }
        }
      }

      // 4. Check pendingArrears if available
      if (periodsFound.length === 0 && r.pendingArrears && r.pendingArrears.length > 0) {
        for (const arr of r.pendingArrears) {
          if (arr.period) {
            let match: RegExpExecArray | null;
            while ((match = monthRegex.exec(arr.period)) !== null) {
              const cap = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() + ' ' + match[2];
              if (!periodsFound.includes(cap)) {
                periodsFound.push(cap);
              }
            }
          }
        }
      }

      if (periodsFound.length > 0) {
        raw = periodsFound.join(', ');
      } else if (r.paymentDate) {
        const d = new Date(r.paymentDate);
        if (!isNaN(d.getTime())) {
          const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          raw = `${months[d.getMonth()]} ${d.getFullYear()}`;
        }
      }
    }

    return this.formatCleanFeePeriod(raw);
  }

  formatCleanFeePeriod(raw: string): string {
    if (!raw) return '';
    // Strip redundant suffixes like " Fee (Monthly)", " Fee", " (Monthly)"
    let text = raw.replace(/\s+Fee\s*\((Monthly|Quarterly|Annual|One-time)\)/gi, '')
                  .replace(/\s+Fee\b/gi, '')
                  .replace(/\s+\(Monthly\)/gi, '')
                  .trim();

    const monthRegex = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const matches: { month: string, year: number, monthIdx: number }[] = [];
    let match: RegExpExecArray | null;
    while ((match = monthRegex.exec(text)) !== null) {
      const mName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      const yr = parseInt(match[2], 10);
      const idx = monthNames.indexOf(mName);
      if (idx !== -1 && !matches.some(x => x.monthIdx === idx && x.year === yr)) {
        matches.push({ month: mName, year: yr, monthIdx: idx });
      }
    }

    if (matches.length === 0) {
      return text;
    }
    if (matches.length === 1) {
      return `${matches[0].month} ${matches[0].year}`;
    }
    if (matches.length === 2) {
      return `${shortMonths[matches[0].monthIdx]} ${matches[0].year} & ${shortMonths[matches[1].monthIdx]} ${matches[1].year}`;
    }

    // Sort chronologically
    matches.sort((a, b) => (a.year * 12 + a.monthIdx) - (b.year * 12 + b.monthIdx));

    // Check if consecutive
    let isConsecutive = true;
    for (let i = 1; i < matches.length; i++) {
      if ((matches[i].year * 12 + matches[i].monthIdx) !== (matches[i - 1].year * 12 + matches[i - 1].monthIdx + 1)) {
        isConsecutive = false;
        break;
      }
    }

    if (isConsecutive) {
      const first = matches[0];
      const last = matches[matches.length - 1];
      if (first.year === last.year) {
        return `${shortMonths[first.monthIdx]} – ${shortMonths[last.monthIdx]} ${first.year} (${matches.length} M)`;
      } else {
        return `${shortMonths[first.monthIdx]} ${first.year} – ${shortMonths[last.monthIdx]} ${last.year} (${matches.length} M)`;
      }
    } else {
      return matches.map(m => `${shortMonths[m.monthIdx]} '${String(m.year).slice(-2)}`).join(', ');
    }
  }

  getItemMonthTag(item: any): string {
    if (!item) return '';
    const textToSearch = `${item.subTitle || ''} ${item.particulars || ''}`;
    const monthRegex = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i;
    const match = textToSearch.match(monthRegex);
    if (match) {
      return `${match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()} ${match[2]}`;
    }
    const qMatch = textToSearch.match(/\b(Q[1-4]|Quarter\s+[1-4])\s*\(?([^\)]*)\)?/i);
    if (qMatch) {
      return qMatch[0].trim();
    }
    const part = (item.particulars || '').toLowerCase();
    if (!part.includes('library') && !part.includes('fine') && this.feeMonthDisplay && !this.feeMonthDisplay.includes(',')) {
      return this.feeMonthDisplay;
    }
    return '';
  }

  constructor(
    public dialogRef: MatDialogRef<FeeReceiptDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FeeReceiptDialogData,
    private feesService: FeesService,
    public authService: AuthService
  ) {
    if (this.data) {
      let r: any = (this.data as any).receipt || this.data;
      if (r && r.receipt) {
        r = r.receipt;
      }
      const rawLogo = this.data.logoUrl || r?.instituteLogoUrl || r?.tenantProfilePhoto || this.authService.currentUser()?.profilePhoto;
      this.data = {
        receipt: r,
        instituteName: this.data.instituteName || r?.tenantName || r?.instituteName || this.authService.currentUser()?.instituteName || 'Official Fee Receipt',
        branchName: this.data.branchName || r?.branchName,
        logoUrl: this.authService.resolveLogoUrl(rawLogo) || null
      };
    }
    this.logoUrl = this.data?.logoUrl || this.authService.getInstituteLogoUrl();
  }

  get officialSealUrl(): string | null {
    return this.authService.getOfficialSealUrl();
  }

  get digitalSignatureUrl(): string | null {
    return this.authService.getDigitalSignatureUrl();
  }

  get totalArrearsAmount(): number {
    return this.data?.receipt?.pendingArrears
      ? this.data.receipt.pendingArrears.reduce((sum, a) => sum + a.dueAmount, 0)
      : 0;
  }

  get totalDemandAmount(): number {
    if (this.data?.receipt?.totalDemandBeforePayment && this.data.receipt.totalDemandBeforePayment > 0) {
      return this.data.receipt.totalDemandBeforePayment;
    }
    return (this.data?.receipt?.amountPaid || 0) + (this.data?.receipt?.remainingDue || 0);
  }

  formatSubTitle(sub?: string | null): string {
    if (!sub || !sub.trim()) return '';
    const trimmed = sub.trim();
    // Suppress internal system tags containing GUIDs or IDs
    if (trimmed.startsWith('Coaching:') || trimmed.startsWith('School:')) {
      const tagPart = trimmed.substring(trimmed.indexOf(':') + 1).trim();
      if (/^[0-9a-fA-F-]{32,36}$/.test(tagPart) || tagPart.length >= 30) {
        return '';
      }
    }
    if (/^[0-9a-fA-F-]{32,36}$/.test(trimmed)) {
      return '';
    }
    if (trimmed.toLowerCase() === 'latefeefine') {
      return 'Late Payment Penalty';
    }
    return trimmed;
  }

  ngOnInit(): void {
    this.feesService.getUpiPaymentSettings().subscribe({
      next: (settings: UpiPaymentSettings) => {
        this.payeeUpiId = settings.effectiveUpiId || settings.upiId || 'imserp.fees@sbi';
        this.payeeMerchantName = settings.effectiveMerchantName || settings.upiMerchantName || this.data.instituteName || this.authService.currentUser()?.instituteName || 'Fee Collection';
        if (settings.effectiveBankName && settings.effectiveAccountNumber) {
          this.bankAccountDisplay = `${settings.effectiveBankName} - A/C: ${settings.effectiveAccountNumber} (IFSC: ${settings.effectiveIfsc || 'N/A'})`;
        }
        this.generateQrCode();
      },
      error: () => {
        this.payeeMerchantName = this.data.instituteName || this.authService.currentUser()?.instituteName || 'Fee Collection';
        this.generateQrCode();
      }
    });
  }

  generateQrCode(): void {
    const rcpt = this.data?.receipt;
    if (!rcpt) return;

    if (rcpt.remainingDue > 0) {
      const amount = rcpt.remainingDue;
      const payee = this.payeeUpiId;
      const name = this.payeeMerchantName || this.data.instituteName || this.authService.currentUser()?.instituteName || 'Apex Coaching Academy';
      const student = rcpt.studentName;
      const roll = rcpt.rollNumber || '';
      const note = `Fee Bal ${student}${roll ? ' Roll ' + roll : ''} ${rcpt.receiptNumber}`;

      const upiUri = `upi://pay?pa=${encodeURIComponent(payee)}&pn=${encodeURIComponent(name)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note.substring(0, 50))}`;

      QRCode.toDataURL(upiUri, {
        width: 140,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      }).then(url => {
        this.qrDataUrl = url;
      }).catch(err => {
        console.error('Failed to generate QR Code for Receipt:', err);
      });
    } else {
      const verifyPayload = `IMSERP_FEE_VERIFIED|${rcpt.receiptNumber}|${rcpt.studentName}|Roll:${rcpt.rollNumber || 'NA'}|Paid:INR_${rcpt.amountPaid}|Date:${rcpt.paymentDate}|Status:CLEARED`;

      QRCode.toDataURL(verifyPayload, {
        width: 110,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      }).then(url => {
        this.qrDataUrl = url;
      }).catch(err => {
        console.error('Failed to generate verify QR Code:', err);
      });
    }
  }

  getPaymentModeName(mode: number | string): string {
    const m = typeof mode === 'string' ? parseInt(mode, 10) : mode;
    switch (m) {
      case 0: return 'Cash';
      case 1: return 'UPI / Online';
      case 2: return 'Bank Transfer / NEFT';
      case 3: return 'Cheque';
      default: return 'Online / Cash';
    }
  }

  getAmountInWords(amount: number): string {
    return convertToIndianWords(Math.round(amount)) + ' Rupees Only';
  }

  printReceipt(): void {
    const el = document.getElementById('receipt-paper');
    if (!el) {
      window.print();
      return;
    }

    // Modern rock-solid printing via hidden iframe (never blocked by popup blockers or closed prematurely)
    let printIframe = document.getElementById('receipt-print-frame') as HTMLIFrameElement;
    if (printIframe) {
      printIframe.remove();
    }

    printIframe = document.createElement('iframe');
    printIframe.id = 'receipt-print-frame';
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
          <title>Fee Receipt - ${this.data?.receipt?.receiptNumber || 'Receipt'}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            mat-icon { display: none !important; }
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 15mm; color: #0f172a; font-size: 13px; line-height: 1.45; }
            .paper-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #0f172a; }
            .inst-info { display: flex; align-items: center; gap: 14px; }
            .logo-mark { width: 52px; height: 52px; background: transparent !important; border: none !important; display: flex; align-items: center; justify-content: center; overflow: visible; flex-shrink: 0; }
            .logo-mark.has-img { background: transparent !important; border: none !important; padding: 0 !important; }
            .inst-logo-img { width: 100%; height: 100%; object-fit: contain; background: transparent !important; border: none !important; }
            .inst-name { font-size: 1.35rem; font-weight: 800; color: #0f172a; }
            .inst-subtitle { font-size: 0.8rem; color: #475569; margin-top: 2px; }
            .inst-branch { font-size: 0.74rem; color: #64748b; font-weight: 600; margin-top: 2px; }
            .receipt-badge { text-align: right; }
            .badge-title { font-size: 1.1rem; font-weight: 800; color: #1e40af; }
            .badge-sub { font-size: 0.78rem; color: #64748b; font-weight: 600; display: block; }
            .copy-tag { display: inline-block; margin-top: 4px; font-size: 0.65rem; font-weight: 700; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; border: 1px solid #bae6fd; }
            .meta-strip { display: grid; grid-template-columns: 1fr 1.4fr 1fr; gap: 10px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin: 14px 0; }
            .meta-strip.has-ref { grid-template-columns: 1fr 1.35fr 0.85fr 1fr; }
            .meta-label { font-size: 0.7rem; color: #64748b; font-weight: 600; text-transform: uppercase; display: block; white-space: nowrap; }
            .meta-val { font-size: 0.85rem; font-weight: 700; color: #1e293b; margin-top: 2px; display: block; white-space: nowrap; }
            .meta-val.highlight { color: #1e40af; }
            .mode-pill { display: inline-block; background: #dcfce7; color: #15803d; padding: 1px 8px; border-radius: 4px; font-size: 0.78rem; white-space: nowrap; }
            .session-pill { display: inline-block; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 1px 8px; border-radius: 4px; font-size: 0.78rem; font-weight: 700; white-space: nowrap; }
            .student-profile-card { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 12px 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; margin-bottom: 14px; }
            .prof-row { display: flex; font-size: 0.82rem; margin-bottom: 4px; }
            .prof-row .k { width: 165px; white-space: nowrap; color: #475569; font-weight: 600; flex-shrink: 0; }
            .prof-row .v { color: #0f172a; flex: 1; }
            .student-highlight { font-weight: 800; color: #15803d; font-size: 0.92rem; }
            .status-pill { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 1px 8px; border-radius: 4px; font-size: 0.74rem; font-weight: 600; }
            .table-section { margin-bottom: 12px; }
            .receipt-table { width: 100%; border-collapse: collapse; }
            .receipt-table th { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important; color: #1e3a8a !important; border-top: 1px solid #bfdbfe; border-bottom: 2px solid #bfdbfe; padding: 8px 10px; font-size: 0.78rem; font-weight: 700; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .receipt-table td { padding: 9px 10px; border-bottom: 1px solid #e2e8f0; font-size: 0.84rem; }
            .fee-head-title { font-size: 0.88rem; color: #0f172a; font-weight: 700; }
            .fee-head-sub { font-size: 0.75rem; color: #64748b; margin-top: 2px; }
            .summary-subtotal { background: #f8fafc; border-top: 2px solid #cbd5e1; }
            .grand-paid { font-size: 1.1rem; font-weight: 800; color: #16a34a; }
            .amount-words-strip { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; background: #eff6ff; border: 1px dashed #93c5fd; border-radius: 6px; margin-bottom: 12px; }
            .w-label { font-size: 0.7rem; color: #3b82f6; font-weight: 700; text-transform: uppercase; display: block; }
            .w-text { font-size: 0.88rem; font-weight: 700; color: #1e3a8a; }
            .paid-stamp { background: #16a34a; color: #fff; padding: 3px 12px; border-radius: 16px; font-weight: 800; font-size: 0.8rem; }
            .receipt-paper { position: relative; }
            .receipt-watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 300px; height: 300px; opacity: 0.04; pointer-events: none; background-size: contain; background-position: center; background-repeat: no-repeat; z-index: 0; }
            .arrears-card { background: #fffbeb !important; border: 1px solid #fde68a !important; border-radius: 6px; margin-bottom: 12px; overflow: hidden; position: relative; z-index: 1; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .arrears-card-header { background: #fef3c7 !important; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #fde68a; font-size: 0.78rem; font-weight: 700; color: #92400e; }
            .arr-total-pill { background: #fef08a; color: #854d0e; padding: 1px 6px; border-radius: 10px; font-size: 0.72rem; font-weight: 600; border: 1px solid #facc15; }
            .arrears-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
            .arrears-table th { background: #fffdf5 !important; color: #78350f; padding: 5px 8px; text-align: left; border-bottom: 1px solid #fde68a; font-weight: 700; }
            .arrears-table td { padding: 6px 8px; border-bottom: 1px solid #fef3c7; }
            .arr-due-val { color: #b45309; font-weight: 700; }
            .demand-reconcile-box { display: flex; align-items: center; gap: 8px; background: #fff; padding: 3px 8px; border-radius: 4px; border: 1px solid #fecdd3; }
            .rec-item { display: flex; flex-direction: column; text-align: right; }
            .rec-lbl { font-size: 0.6rem; color: #64748b; font-weight: 600; text-transform: uppercase; }
            .rec-val { font-size: 0.85rem; font-weight: 700; color: #0f172a; }
            .rec-val.paid-now { color: #16a34a; }
            .rec-sep { color: #94a3b8; font-weight: 800; font-size: 0.9rem; }
            .due-status-strip { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; border-radius: 6px; margin-bottom: 12px; }
            .due-status-strip.cleared { background: #f0fdf4 !important; border: 1px solid #86efac; color: #166534; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .due-status-strip.due-alert { background: #fff1f2 !important; border: 1px solid #fecdd3; color: #9f1239; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .due-title { font-weight: 700; font-size: 0.84rem; }
            .due-num { font-size: 1.05rem; font-weight: 800; }
            .due-lbl { font-size: 0.68rem; color: #64748b; font-weight: 600; text-transform: uppercase; display: block; }
            .upi-payment-banner { display: flex; gap: 14px; background: #f0fdf4; border: 1.5px solid #a7f3d0; border-radius: 6px; padding: 10px 12px; margin-bottom: 12px; align-items: center; }
            .upi-qr-col { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
            .qr-frame { width: 110px; height: 110px; background: #fff; padding: 4px; border-radius: 4px; border: 1px solid #cbd5e1; }
            .qr-img { width: 100%; height: 100%; object-fit: contain; }
            .scan-tag { margin-top: 3px; font-size: 0.58rem; font-weight: 800; color: #065f46; background: #d1fae5; padding: 1px 5px; border-radius: 3px; }
            .upi-info-col { flex: 1; display: flex; flex-direction: column; gap: 4px; }
            .upi-info-header { display: flex; justify-content: space-between; align-items: center; }
            .upi-badge { font-size: 0.78rem; font-weight: 700; color: #065f46; }
            .upi-supported-apps { display: flex; gap: 3px; }
            .app-chip { font-size: 0.6rem; font-weight: 700; background: #fff; border: 1px solid #cbd5e1; padding: 1px 4px; border-radius: 3px; }
            .upi-details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; background: #fff; padding: 6px 8px; border-radius: 4px; border: 1px solid #d1fae5; }
            .detail-box .d-label { font-size: 0.64rem; color: #64748b; font-weight: 600; display: block; }
            .detail-box .d-val { font-size: 0.78rem; font-weight: 700; color: #0f172a; display: block; }
            .detail-box .amt-val { color: #b91c1c; font-size: 0.88rem; }
            .detail-box .upi-id-val { color: #065f46; font-family: monospace; }
            .upi-help-note { font-size: 0.68rem; color: #047857; margin-top: 2px; }
            .cleared-receipt-qr-strip { display: flex; align-items: center; gap: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; }
            .qr-mini-box { width: 55px; height: 55px; background: #fff; padding: 2px; border: 1px solid #cbd5e1; border-radius: 4px; flex-shrink: 0; }
            .qr-mini-img { width: 100%; height: 100%; object-fit: contain; }
            .qr-verify-text .v-title { font-size: 0.75rem; font-weight: 700; color: #166534; }
            .qr-verify-text p { margin: 2px 0 0; font-size: 0.7rem; color: #475569; }
            .receipt-terms { font-size: 0.72rem; color: #64748b; background: #f8fafc; padding: 6px 12px; border-radius: 6px; margin-bottom: 20px; }
            .receipt-terms ol { margin: 3px 0 0 14px; padding: 0; }
            .signatures-row { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 18px; margin-bottom: 8px; }
            .sig-col { width: 180px; }
            .sig-line { height: 1px; background: #475569; margin-bottom: 4px; }
            .sig-text { font-size: 0.75rem; font-weight: 700; color: #334155; display: block; }
            .auth-sub { font-size: 0.68rem; color: #64748b; display: block; }
            .uploaded-official-seal-img { max-width: 68px; max-height: 68px; object-fit: contain; display: block; margin: 0 auto; }
            .digital-sign-wrapper { display: flex; align-items: flex-end; justify-content: flex-end; height: 38px; margin-bottom: 2px; }
            .digital-sign-img { max-height: 38px; max-width: 130px; object-fit: contain; display: block; mix-blend-mode: multiply; }
            .digital-seal { border: 1.5px dashed #0284c7; border-radius: 6px; padding: 4px 10px; background: #f0f9ff; color: #0284c7; font-size: 0.68rem; font-weight: 800; text-align: center; }
            .paper-footer { text-align: center; font-size: 0.66rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 6px; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            @page { margin: 6mm 8mm; size: A4 portrait; }
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

  formatToIST(dateVal: string | Date | undefined): string {
    if (!dateVal) return '-';
    let str = String(dateVal).trim();
    if (!str.endsWith('Z') && !str.includes('+') && str.includes('T')) {
      str += 'Z';
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return String(dateVal);

    const parts = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).formatToParts(d);

    let day = '', month = '', year = '', hour = '', minute = '', second = '', dayPeriod = '';
    for (const p of parts) {
      if (p.type === 'day') day = p.value;
      else if (p.type === 'month') month = p.value;
      else if (p.type === 'year') year = p.value;
      else if (p.type === 'hour') hour = p.value;
      else if (p.type === 'minute') minute = p.value;
      else if (p.type === 'second') second = p.value;
      else if (p.type === 'dayPeriod') dayPeriod = p.value.toUpperCase();
    }
    return `${day} ${month} ${year}, ${hour}:${minute}:${second}\u00A0${dayPeriod}`;
  }

  shareWhatsApp(): void {
    if (!this.data.receipt.parentPhone) return;
    const rawPhone = this.data.receipt.parentPhone.replace(/\D/g, '');
    const formattedPhone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;

    let headsSection = '';
    if (this.data.receipt.items && this.data.receipt.items.length > 0) {
      const list = this.data.receipt.items
        .map(it => `  • ${it.particulars}: ₹${it.amount.toLocaleString('en-IN')}`)
        .join('\n');
      headsSection = `\n*Fee Heads Breakdown*:\n${list}\n`;
    }

    const branchLine = this.effectiveBranchName ? `*Branch*: ${this.effectiveBranchName}\n` : '';
    const classOrBatch = this.data.receipt.className
      ? `${this.data.receipt.className}${this.data.receipt.sectionName ? ' (' + this.data.receipt.sectionName + ')' : ''}`
      : (this.data.receipt.batchName || 'General');
    const instName = this.data.receipt.instituteName || this.data.instituteName || this.authService.currentUser()?.instituteName || 'School & Coaching ERP';
    let origin = window.location.origin;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      const port = window.location.port ? `:${window.location.port}` : '';
      origin = `${window.location.protocol}//localhost.nip.io${port}`;
    }
    const receiptPublicUrl = `${origin}/receipt/${this.data.receipt.receiptNumber}`;

    const textMsg = `*OFFICIAL FEE PAYMENT RECEIPT*\n` +
      `*Institute*: ${instName}\n` +
      branchLine +
      `*Receipt No*: #${this.data.receipt.receiptNumber}\n` +
      `*Date*: ${this.formatToIST(this.data.receipt.paymentDate)}\n\n` +
      `Dear Parent, we have received payment of *₹${this.data.receipt.amountPaid}* for student *${this.data.receipt.studentName}* (${classOrBatch}).\n` +
      `*Mode*: ${this.getPaymentModeName(this.data.receipt.mode)}\n` +
      headsSection +
      `*Remaining Balance Due*: ₹${this.data.receipt.remainingDue}\n\n` +
      `📄 *Download / View Official PDF Receipt*:\n${receiptPublicUrl}\n\n` +
      `Thank you for trusting ${instName}!`;
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(textMsg)}`;
    window.open(waUrl, '_blank');
  }
}

function convertToIndianWords(n: number): string {
  if (n === 0) return 'Zero';
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
                 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function numToWords(num: number): string {
    let str = '';
    if (num >= 10000000) {
      str += numToWords(Math.floor(num / 10000000)) + ' Crore ';
      num %= 10000000;
    }
    if (num >= 100000) {
      str += numToWords(Math.floor(num / 100000)) + ' Lakh ';
      num %= 100000;
    }
    if (num >= 1000) {
      str += numToWords(Math.floor(num / 1000)) + ' Thousand ';
      num %= 1000;
    }
    if (num >= 100) {
      str += numToWords(Math.floor(num / 100)) + ' Hundred ';
      num %= 100;
    }
    if (num > 0) {
      if (num < 20) str += units[num] + ' ';
      else str += tens[Math.floor(num / 10)] + ' ' + (num % 10 > 0 ? units[num % 10] + ' ' : '');
    }
    return str.trim();
  }

  return numToWords(n);
}
