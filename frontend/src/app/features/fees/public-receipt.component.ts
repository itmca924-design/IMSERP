import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FeesService, FeePaymentReceipt } from '../../core/services/fees.service';
import { AuthService } from '../../core/services/auth.service';
import { UpiPaymentDialogComponent, UpiPaymentDialogData } from './upi-payment-dialog.component';

@Component({
  selector: 'app-public-receipt',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatDialogModule
  ],
  template: `
    <div class="public-receipt-page">
      <!-- Loading State -->
      <div class="state-container" *ngIf="loading">
        <mat-spinner diameter="44"></mat-spinner>
        <p class="state-text">Loading official fee receipt...</p>
      </div>

      <!-- Error State -->
      <div class="state-container error-state" *ngIf="!loading && error">
        <mat-icon class="err-icon">error_outline</mat-icon>
        <h2>Receipt Not Found</h2>
        <p>{{ error }}</p>
      </div>

      <!-- Receipt Content -->
      <div class="receipt-wrapper" *ngIf="!loading && receipt">
        <!-- Floating Action Header (Hidden in Print) -->
        <header class="public-actions-bar no-print">
          <div class="bar-left">
            <div class="verified-chip">
              <mat-icon class="verified-icon">verified</mat-icon>
              <span>Verified Official E-Receipt</span>
            </div>
            <span class="receipt-id">#{{ receipt.receiptNumber }}</span>
          </div>

          <div class="bar-actions">
            <button mat-flat-button class="action-btn upi-pay-btn" (click)="openUpiPayment()" *ngIf="receipt.remainingDue > 0">
              <mat-icon>qr_code_2</mat-icon>
              <span>Pay Due via UPI</span>
            </button>
            <button mat-flat-button color="primary" class="action-btn download-btn" (click)="printReceipt()">
              <mat-icon>download</mat-icon>
              <span>Download PDF / Print</span>
            </button>
            <button mat-stroked-button class="action-btn wa-share-btn" (click)="shareWhatsApp()" *ngIf="receipt.parentPhone">
              <mat-icon class="wa-icon">chat</mat-icon>
              <span>WhatsApp</span>
            </button>
          </div>
        </header>

        <!-- Printable Official Receipt Paper -->
        <div class="receipt-paper" id="public-receipt-paper">
          <!-- Institute Header -->
          <div class="paper-header">
            <div class="inst-info">
              <div class="logo-box" [class.has-img]="receipt.instituteLogoUrl && !logoFailed">
                <img
                  *ngIf="receipt.instituteLogoUrl && !logoFailed"
                  [src]="receipt.instituteLogoUrl"
                  alt="Institute Logo"
                  class="inst-logo-img"
                  (error)="logoFailed = true" />
                <mat-icon *ngIf="!receipt.instituteLogoUrl || logoFailed" class="fallback-icon">school</mat-icon>
              </div>
              <div class="inst-text">
                <h1 class="inst-name">{{ receipt.instituteName || 'Jnandeep Campus' }}</h1>
                <p class="inst-sub">
                  <span *ngIf="receipt.instituteAddress">{{ receipt.instituteAddress }} • </span>
                  <span *ngIf="receipt.instituteContactPhone">Helpline: {{ receipt.instituteContactPhone }}</span>
                </p>
                <div class="inst-branch" *ngIf="receipt.branchName">
                  <mat-icon class="branch-icon">location_city</mat-icon>
                  <span>Branch: {{ receipt.branchName }}</span>
                </div>
              </div>
            </div>

            <div class="receipt-badge">
              <div class="badge-title">FEE RECEIPT</div>
              <div class="badge-sub">शुल्क भुगतान रसीद</div>
              <span class="copy-tag">STUDENT ORIGINAL</span>
            </div>
          </div>

          <!-- Transaction & Metadata Strip -->
          <div class="meta-strip">
            <div class="meta-item">
              <span class="meta-label">Receipt Number:</span>
              <span class="meta-val highlight">{{ receipt.receiptNumber }}</span>
            </div>
            <div class="meta-item month-meta-item" *ngIf="feeMonthDisplay">
              <span class="meta-label">Fee Month / Period:</span>
              <span class="meta-val month-pill">{{ feeMonthDisplay }}</span>
            </div>
            <div class="meta-item time-item">
              <span class="meta-label">Date & Time (IST):</span>
              <span class="meta-val">{{ formatToIST(receipt.paymentDate) }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Payment Mode:</span>
              <span class="meta-val mode-pill">{{ getPaymentModeName(receipt.mode) }}</span>
            </div>
            <div class="meta-item" *ngIf="receipt.transactionRef">
              <span class="meta-label">Txn / UTR Ref:</span>
              <span class="meta-val">{{ receipt.transactionRef }}</span>
            </div>
          </div>

          <!-- Student Profile Card -->
          <div class="student-profile-card">
            <div class="prof-col">
              <div class="prof-row">
                <span class="k">Student Name:</span>
                <span class="v student-highlight">{{ receipt.studentName }}</span>
              </div>
              <div class="prof-row">
                <span class="k">Roll / Admission No:</span>
                <span class="v"><strong>{{ receipt.rollNumber || 'N/A' }}</strong></span>
              </div>
              <div class="prof-row" *ngIf="receipt.className && !receipt.batchName">
                <span class="k">Class & Section:</span>
                <span class="v"><strong>{{ receipt.className }}<span *ngIf="receipt.sectionName"> (Section {{ receipt.sectionName }})</span></strong></span>
              </div>
              <div class="prof-row" *ngIf="receipt.className && receipt.batchName">
                <span class="k">Coaching:</span>
                <span class="v"><strong>{{ receipt.className }}</strong></span>
              </div>
              <div class="prof-row" *ngIf="!receipt.className && receipt.batchName">
                <span class="k">Coaching:</span>
                <span class="v"><strong>Coaching</strong></span>
              </div>
              <div class="prof-row" *ngIf="!receipt.className && !receipt.batchName">
                <span class="k">Academic Stream:</span>
                <span class="v">General Academic</span>
              </div>
              <div class="prof-row fee-month-row" *ngIf="feeMonthDisplay">
                <span class="k">Fee Month (शुल्क माह):</span>
                <span class="v fee-month-badge" [title]="feeMonthTooltip">
                  <strong>{{ feeMonthDisplay }}</strong>
                </span>
              </div>
            </div>
            <div class="prof-col">
              <div class="prof-row">
                <span class="k">Father / Guardian:</span>
                <span class="v">{{ receipt.parentName || 'N/A' }}</span>
              </div>
              <div class="prof-row">
                <span class="k">Contact / WhatsApp:</span>
                <span class="v">{{ receipt.parentPhone || 'N/A' }}</span>
              </div>
              <div class="prof-row" *ngIf="receipt.batchName">
                <span class="k">Batch:</span>
                <span class="v"><strong>{{ receipt.batchName }}</strong></span>
              </div>
              <div class="prof-row">
                <span class="k">Settlement Type:</span>
                <span class="v status-pill">FIFO Auto-Settlement</span>
              </div>
              <div class="prof-row" *ngIf="receipt.hostelInfo">
                <span class="k">🏠 Hostel Facility:</span>
                <span class="v hostel-info-pill">{{ receipt.hostelInfo }}</span>
              </div>
            </div>
          </div>

          <!-- Fee Particulars Breakdown Table -->
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
                <ng-container *ngIf="receipt.items && receipt.items.length > 0; else fallbackReceiptRows">
                  <tr *ngFor="let item of receipt.items">
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
                      <strong class="fee-head-title">Fee Installment Settlement</strong>
                      <div class="fee-head-sub">{{ receipt.remarks || 'Tuition & Academic installment' }}</div>
                    </td>
                    <td class="text-right amount-col">
                      <strong>₹{{ receipt.amountPaid | number:'1.2-2' }}</strong>
                    </td>
                  </tr>
                </ng-template>

                <tr class="summary-subtotal">
                  <td colspan="2" class="text-right"><strong>Total Amount Received:</strong></td>
                  <td class="text-right grand-paid">₹{{ receipt.amountPaid | number:'1.2-2' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Amount In Words Strip -->
          <div class="amount-words-strip">
            <div class="words-left">
              <span class="w-label">Amount in Words:</span>
              <span class="w-text">{{ getAmountInWords(receipt.amountPaid) }}</span>
            </div>
            <div class="paid-stamp">
              <mat-icon>check_circle</mat-icon>
              <span>PAID</span>
            </div>
          </div>

          <!-- Account Due Status Strip -->
          <div class="due-status-strip" [class.cleared]="receipt.remainingDue <= 0" [class.due-alert]="receipt.remainingDue > 0">
            <div class="due-text-group">
              <div class="due-title">
                <mat-icon class="status-icon">{{ receipt.remainingDue <= 0 ? 'check_circle' : 'info' }}</mat-icon>
                <span>{{ receipt.remainingDue <= 0 ? 'Account Status: All Dues Cleared' : 'Current Account Status: Partial Payment Recorded' }}</span>
              </div>
              <small class="due-desc" *ngIf="receipt.remainingDue > 0">
                Please clear the remaining balance before the next installment cycle.
              </small>
            </div>
            <div class="due-amount-box">
              <span class="due-lbl">Remaining Balance Due:</span>
              <span class="due-num">₹{{ receipt.remainingDue | number:'1.2-2' }}</span>
            </div>
            <div class="due-actions-box no-print" *ngIf="receipt.remainingDue > 0">
              <button mat-flat-button class="pay-now-action-btn" (click)="openUpiPayment()">
                <mat-icon>qr_code_scanner</mat-icon>
                <span>Pay Now</span>
              </button>
            </div>
          </div>

          <!-- Terms & Signatures -->
          <div class="receipt-terms">
            <strong>Terms & Conditions / महत्वपूर्ण सूचना:</strong>
            <ol>
              <li>This digital receipt is an official acknowledgment of payment received by {{ receipt.instituteName || 'Jnandeep Campus' }}.</li>
              <li>Fees once deposited are subject to the academy's official fee cancellation & refund policy.</li>
              <li>All payments are securely audited in the IMSERP Cloud Management Suite.</li>
            </ol>
          </div>

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
                <small>{{ receipt.paymentDate | date:'dd-MMM-yyyy' }}</small>
              </div>
            </div>
            <div class="sig-col text-right">
              <div class="digital-sign-wrapper" *ngIf="digitalSignatureUrl">
                <img [src]="digitalSignatureUrl" alt="Authorized Signature" class="digital-sign-img" />
              </div>
              <div class="sig-line"></div>
              <span class="sig-text">Accounts In-charge / Cashier</span>
              <small class="auth-sub">{{ receipt.instituteName || authService.getInstituteName() || 'Institution' }}</small>
            </div>
          </div>

          <div class="paper-footer">
            <span>This is an official computer-generated receipt from IMSERP Education ERP Suite.</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: #f1f5f9;
      padding: 24px 16px;
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }

    .public-receipt-page {
      max-width: 860px;
      margin: 0 auto;
    }

    .state-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 20px;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      text-align: center;

      .state-text {
        margin-top: 16px;
        color: #475569;
        font-weight: 600;
        font-size: 1rem;
      }

      &.error-state {
        .err-icon {
          font-size: 54px;
          width: 54px;
          height: 54px;
          color: #ef4444;
          margin-bottom: 8px;
        }
        h2 { color: #1e293b; margin: 0 0 6px; font-weight: 700; }
        p { color: #64748b; margin: 0; }
      }
    }

    .public-actions-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 12px 18px;
      margin-bottom: 16px;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.08);

      .bar-left {
        display: flex;
        align-items: center;
        gap: 12px;

        .verified-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: #2563eb;
          color: #ffffff;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.02em;

          .verified-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
          }
        }

        .receipt-id {
          font-weight: 700;
          color: #1e3a8a;
          font-size: 0.95rem;
        }
      }

      .bar-actions {
        display: flex;
        align-items: center;
        gap: 10px;

        .action-btn {
          height: 38px !important;
          border-radius: 8px !important;
          font-weight: 700 !important;
          font-size: 0.85rem !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);

          mat-icon { font-size: 19px; width: 19px; height: 19px; }
        }

        .download-btn {
          background: #2563eb !important;
          color: #ffffff !important;
          &:hover { background: #1d4ed8 !important; }
        }

        .upi-pay-btn {
          background: linear-gradient(135deg, #059669 0%, #10b981 100%) !important;
          color: #ffffff !important;
          &:hover { background: #047857 !important; }
        }

        .wa-share-btn {
          color: #15803d !important;
          border-color: #86efac !important;
          background: #f0fdf4 !important;
          .wa-icon { color: #16a34a; }
          &:hover { background: #dcfce7 !important; }
        }
      }
    }

    .receipt-paper {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 32px 36px;
      box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.08);

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

          .logo-box {
            width: 56px;
            height: 56px;
            border-radius: 10px;
            background: #1e40af;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            overflow: hidden;

            &.has-img {
              background: #ffffff;
              border: 1px solid #e2e8f0;
              padding: 2px;
            }

            .inst-logo-img {
              width: 100%;
              height: 100%;
              object-fit: contain;
            }

            .fallback-icon {
              font-size: 30px;
              width: 30px;
              height: 30px;
            }
          }

          .inst-text {
            .inst-name {
              margin: 0;
              font-size: 1.45rem;
              font-weight: 800;
              color: #0f172a;
              letter-spacing: -0.01em;
            }
            .inst-sub {
              margin: 3px 0 0;
              font-size: 0.82rem;
              color: #475569;
            }
            .inst-branch {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              margin-top: 4px;
              font-size: 0.78rem;
              color: #64748b;
              font-weight: 600;
              .branch-icon { font-size: 15px; width: 15px; height: 15px; color: #2563eb; }
            }
          }
        }

        .receipt-badge {
          text-align: right;
          .badge-title {
            font-size: 1.25rem;
            font-weight: 800;
            color: #1e40af;
            letter-spacing: 0.05em;
          }
          .badge-sub {
            font-size: 0.84rem;
            color: #64748b;
            font-weight: 600;
          }
          .copy-tag {
            display: inline-block;
            margin-top: 4px;
            font-size: 0.68rem;
            font-weight: 700;
            background: #e0f2fe;
            color: #0369a1;
            padding: 2px 8px;
            border-radius: 4px;
            border: 1px solid #bae6fd;
          }
        }
      }

      .meta-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
        padding: 12px 16px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        margin: 18px 0;

        .meta-item {
          .meta-label {
            font-size: 0.72rem;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            display: block;
          }
          .meta-val {
            font-size: 0.9rem;
            font-weight: 700;
            color: #1e293b;
            margin-top: 3px;
            display: block;

            &.highlight { color: #1e40af; }
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
            margin-top: 2px;
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
            padding: 2px 10px;
            border-radius: 4px;
            font-size: 0.82rem;
            font-weight: 700;
          }
        }
      }

      .student-profile-card {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        padding: 14px 18px;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 8px;
        margin-bottom: 18px;

        .prof-row {
          display: flex;
          align-items: center;
          font-size: 0.85rem;
          margin-bottom: 5px;
          &:last-child { margin-bottom: 0; }

          .k { width: 155px; white-space: nowrap; color: #475569; font-weight: 600; flex-shrink: 0; }
          .v { color: #0f172a; flex: 1; min-width: 0; }
          .student-highlight { font-weight: 800; color: #15803d; font-size: 0.96rem; }
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
            font-size: 0.75rem;
            font-weight: 600;
          }
          .hostel-info-pill {
            display: inline-block;
            background: #fef3c7;
            color: #92400e;
            padding: 1px 8px;
            border-radius: 4px;
            font-size: 0.76rem;
            font-weight: 600;
          }
        }
      }

      .table-section {
        margin-bottom: 16px;

        .receipt-table {
          width: 100%;
          border-collapse: collapse;

          th {
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            color: #1e3a8a;
            border-top: 1px solid #bfdbfe;
            border-bottom: 2px solid #bfdbfe;
            padding: 10px 12px;
            font-size: 0.82rem;
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

          .fee-head-title { font-size: 0.92rem; color: #0f172a; font-weight: 700; }
          .fee-head-sub { font-size: 0.76rem; color: #64748b; margin-top: 2px; }

          .summary-subtotal {
            background: #f8fafc;
            border-top: 2px solid #cbd5e1;
            font-size: 0.95rem;

            .grand-paid {
              font-size: 1.18rem;
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
        border-radius: 8px;
        margin-bottom: 16px;

        .words-left {
          .w-label { font-size: 0.72rem; color: #3b82f6; font-weight: 700; text-transform: uppercase; }
          .w-text { font-size: 0.94rem; font-weight: 700; color: #1e3a8a; }
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
          font-size: 0.86rem;
          letter-spacing: 0.05em;
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
        }
      }

      .due-status-strip {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 16px;
        border-radius: 8px;
        margin-bottom: 16px;

        &.cleared {
          background: #f0fdf4;
          border: 1px solid #86efac;
          .due-title { color: #166534; font-weight: 700; font-size: 0.9rem; display: flex; align-items: center; gap: 6px; }
          .due-num { color: #166534; font-size: 1.12rem; font-weight: 800; }
          .status-icon { color: #16a34a; font-size: 19px; width: 19px; height: 19px; }
        }

        &.due-alert {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          .due-title { color: #9f1239; font-weight: 700; font-size: 0.9rem; display: flex; align-items: center; gap: 6px; }
          .due-desc { font-size: 0.78rem; color: #be123c; margin-top: 2px; display: block; }
          .due-num { color: #e11d48; font-size: 1.12rem; font-weight: 800; }
          .status-icon { color: #e11d48; font-size: 19px; width: 19px; height: 19px; }
        }

        .due-amount-box {
          text-align: right;
          .due-lbl { font-size: 0.72rem; color: #64748b; font-weight: 600; text-transform: uppercase; display: block; }
        }

        .due-actions-box {
          margin-left: 16px;
          display: flex;
          align-items: center;

          .pay-now-action-btn {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
            color: #ffffff !important;
            font-weight: 700 !important;
            border-radius: 8px !important;
            padding: 0 16px !important;
            height: 38px !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25) !important;
            &:hover { background: #1e40af !important; }
          }
        }
      }

      .receipt-terms {
        font-size: 0.76rem;
        color: #64748b;
        background: #f8fafc;
        padding: 8px 14px;
        border-radius: 6px;
        margin-bottom: 24px;
        ol { margin: 4px 0 0 16px; padding: 0; }
      }

      .signatures-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        padding-top: 20px;
        margin-bottom: 12px;

        .sig-col {
          width: 200px;
          display: flex;
          flex-direction: column;
          .sig-line { height: 1px; background: #475569; margin-bottom: 4px; }
          .sig-text { font-size: 0.76rem; font-weight: 700; color: #334155; display: block; }
          .auth-sub { font-size: 0.7rem; color: #64748b; display: block; }

          .uploaded-official-seal-img {
            max-width: 68px;
            max-height: 68px;
            object-fit: contain;
            display: block;
            margin: 0 auto;
            opacity: 0.95;
            filter: drop-shadow(0 1px 2px rgba(2, 132, 199, 0.25));
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
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
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        }

        .digital-seal {
          border: 1.5px dashed #0284c7;
          border-radius: 8px;
          padding: 6px 14px;
          background: #f0f9ff;
          color: #0284c7;
          font-size: 0.72rem;
          font-weight: 800;
          text-align: center;
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          mat-icon { font-size: 20px; width: 20px; height: 20px; color: #0284c7; }
        }
      }

      .paper-footer {
        text-align: center;
        font-size: 0.68rem;
        color: #94a3b8;
        border-top: 1px solid #e2e8f0;
        padding-top: 8px;
      }
    }

    .text-center { text-align: center; }
    .text-right { text-align: right; }

    @media (max-width: 640px) {
      :host { padding: 12px 8px; }
      .public-actions-bar {
        flex-direction: column;
        gap: 10px;
        align-items: stretch;
        .bar-actions { justify-content: stretch; .action-btn { flex: 1; } }
      }
      .receipt-paper {
        padding: 16px 14px;
        .paper-header { flex-direction: column; gap: 12px; .receipt-badge { text-align: left; } }
        .student-profile-card { grid-template-columns: 1fr; gap: 10px; }
        .signatures-row { flex-direction: column; gap: 16px; align-items: flex-start; .sig-col { width: 100%; } }
      }
    }

    @media print {
      :host { background: #ffffff !important; padding: 0 !important; }
      .public-receipt-page { max-width: none !important; width: 100% !important; margin: 0 !important; }
      .no-print { display: none !important; }
      .receipt-paper {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        border-radius: 0 !important;
      }
      @page {
        margin: 10mm;
        size: A4 portrait;
      }
    }
  `]
})
export class PublicReceiptComponent implements OnInit {
  receiptNumber: string = '';
  receipt: FeePaymentReceipt | null = null;
  loading: boolean = true;
  error: string | null = null;
  logoFailed = false;

  constructor(
    private route: ActivatedRoute,
    private feesService: FeesService,
    private dialog: MatDialog,
    public authService: AuthService
  ) {}

  get officialSealUrl(): string | null {
    const raw = this.receipt?.officialSealUrl || this.authService.getOfficialSealUrl();
    return this.authService.resolveLogoUrl(raw);
  }

  get digitalSignatureUrl(): string | null {
    const raw = this.receipt?.digitalSignatureUrl || this.authService.getDigitalSignatureUrl();
    return this.authService.resolveLogoUrl(raw);
  }

  ngOnInit(): void {
    this.receiptNumber = this.route.snapshot.paramMap.get('receiptNumber') || '';
    if (!this.receiptNumber) {
      this.loading = false;
      this.error = 'Invalid or missing receipt reference';
      return;
    }
    this.fetchReceipt();
  }

  fetchReceipt(): void {
    this.loading = true;
    this.error = null;
    this.feesService.getReceiptByNumber(this.receiptNumber).subscribe({
      next: (res) => {
        this.receipt = res;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || err?.message || 'Could not load official receipt details.';
      }
    });
  }

  printReceipt(): void {
    window.print();
  }

  get feeMonthTooltip(): string {
    const r = this.receipt;
    if (!r) return '';
    return (r as any).feePeriod || (r as any).feeMonth || this.feeMonthDisplay;
  }

  get feeMonthDisplay(): string {
    const r = this.receipt;
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

  openUpiPayment(): void {
    if (!this.receipt || this.receipt.remainingDue <= 0) return;

    const data: UpiPaymentDialogData = {
      mode: this.receipt.invoiceId ? 'invoice' : 'fifo_student',
      invoiceId: this.receipt.invoiceId,
      studentId: this.receipt.studentId,
      studentName: this.receipt.studentName,
      rollNumber: this.receipt.rollNumber,
      className: this.receipt.className,
      batchName: this.receipt.batchName,
      dueAmount: this.receipt.remainingDue,
      invoiceNumber: this.receipt.invoiceNumber
    };

    const dialogRef = this.dialog.open(UpiPaymentDialogComponent, {
      width: '880px',
      maxWidth: '96vw',
      panelClass: ['upi-dialog-panel', 'no-overflow-dialog'],
      data,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((res: FeePaymentReceipt | undefined) => {
      if (res && res.receiptNumber) {
        this.receiptNumber = res.receiptNumber;
      }
      this.fetchReceipt();
    });
  }

  formatSubTitle(sub?: string | null): string {
    if (!sub || !sub.trim()) return '';
    const trimmed = sub.trim();
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

  getPaymentModeName(mode: number | string | undefined): string {
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
    if (!this.receipt?.parentPhone) return;
    const rawPhone = this.receipt.parentPhone.replace(/\D/g, '');
    const formattedPhone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;
    let origin = window.location.origin;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      const port = window.location.port ? `:${window.location.port}` : '';
      origin = `${window.location.protocol}//localhost.nip.io${port}`;
    }
    const receiptUrl = `${origin}/receipt/${this.receipt.receiptNumber}`;

    let headsSection = '';
    if (this.receipt.items && this.receipt.items.length > 0) {
      const list = this.receipt.items
        .map(it => `  • ${it.particulars}: ₹${it.amount.toLocaleString('en-IN')}`)
        .join('\n');
      headsSection = `\n*Fee Heads Breakdown*:\n${list}\n`;
    }

    const branchLine = this.receipt.branchName ? `*Branch*: ${this.receipt.branchName}\n` : '';
    const classOrBatch = this.receipt.className
      ? `${this.receipt.className}${this.receipt.sectionName ? ' (' + this.receipt.sectionName + ')' : ''}`
      : (this.receipt.batchName || 'General');

    const instName = this.receipt.instituteName || 'Jnandeep Campus';

    const textMsg = `*OFFICIAL FEE PAYMENT RECEIPT*\n` +
      `*Institute*: ${instName}\n` +
      branchLine +
      `*Receipt No*: #${this.receipt.receiptNumber}\n` +
      `*Date*: ${this.formatToIST(this.receipt.paymentDate)}\n\n` +
      `Dear Parent, we have received payment of *₹${this.receipt.amountPaid}* for student *${this.receipt.studentName}* (${classOrBatch}).\n` +
      `*Mode*: ${this.getPaymentModeName(this.receipt.mode)}\n` +
      headsSection +
      `*Remaining Balance Due*: ₹${this.receipt.remainingDue}\n\n` +
      `📄 *Download / View Official PDF Receipt*:\n${receiptUrl}\n\n` +
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

  return numToWords(n).trim();
}
