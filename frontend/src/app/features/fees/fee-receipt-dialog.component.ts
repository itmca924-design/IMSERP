import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { FeePaymentReceipt } from '../../core/services/fees.service';
import { AuthService } from '../../core/services/auth.service';

export interface FeeReceiptDialogData {
  receipt: FeePaymentReceipt;
  instituteName?: string;
  branchName?: string;
  logoUrl?: string;
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
        <!-- Header -->
        <div class="paper-header">
          <div class="inst-info">
            <div class="logo-mark" [class.has-img]="logoUrl && !logoFailed">
              <img *ngIf="logoUrl && !logoFailed" [src]="logoUrl" (error)="logoFailed = true" alt="Logo" class="inst-logo-img">
              <mat-icon *ngIf="!logoUrl || logoFailed">account_balance</mat-icon>
            </div>
            <div>
              <h2 class="inst-name">{{ data.instituteName || authService.currentUser()?.instituteName || 'Apex Coaching Academy' }}</h2>
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
          <div class="meta-item time-item">
            <span class="meta-label">Date & Time (IST):</span>
            <span class="meta-val date-time-val">{{ formatToIST(data.receipt.paymentDate) }}</span>
          </div>
          <div class="meta-item branch-meta-item" *ngIf="effectiveBranchName">
            <span class="meta-label">Branch / Centre:</span>
            <span class="meta-val branch-val">🏛️ {{ effectiveBranchName }}</span>
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
            <div class="prof-row">
              <span class="k">Assigned Batch / Course:</span>
              <span class="v">{{ data.receipt.batchName || 'General Academic' }}</span>
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
                <th>Settlement Reference</th>
                <th class="text-right">Amount Received (₹)</th>
              </tr>
            </thead>
            <tbody>
              <!-- Multi-line breakdown (Tuition + Library Fine) -->
              <ng-container *ngIf="data.receipt.items && data.receipt.items.length > 0; else fallbackReceiptRows">
                <tr *ngFor="let item of data.receipt.items">
                  <td class="text-center">{{ item.itemIndex }}</td>
                  <td>
                    <strong class="fee-head-title">{{ item.particulars }}</strong>
                    <div class="fee-head-sub" *ngIf="item.subTitle">{{ item.subTitle }}</div>
                  </td>
                  <td>{{ item.reference || '-' }}</td>
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
                  <td>{{ data.receipt.invoiceNumber || 'Monthly Invoices' }}</td>
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
                  <td>Library Clearance</td>
                  <td class="text-right amount-col">
                    <strong>₹{{ data.receipt.libraryFineAmountPaid | number:'1.2-2' }}</strong>
                  </td>
                </tr>
              </ng-template>

              <tr class="summary-subtotal">
                <td colspan="3" class="text-right"><strong>Total Amount Received:</strong></td>
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

        <!-- Remaining Due Balance Strip -->
        <div class="due-status-strip" [class.cleared]="data.receipt.remainingDue === 0" [class.due-alert]="data.receipt.remainingDue > 0">
          <div class="due-info">
            <span class="due-title">
              <mat-icon class="status-icon">{{ data.receipt.remainingDue === 0 ? 'verified' : 'info' }}</mat-icon>
              {{ data.receipt.remainingDue === 0 ? 'Account Status: All Dues Cleared' : 'Current Account Status: Partial Payment Recorded' }}
            </span>
            <span class="due-desc" *ngIf="data.receipt.remainingDue > 0">
              Please clear the remaining balance before the next installment cycle.
            </span>
          </div>
          <div class="due-amount-box">
            <span class="due-lbl">Remaining Balance Due:</span>
            <span class="due-num">₹{{ data.receipt.remainingDue | number:'1.2-2' }}</span>
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
            <div class="digital-seal">
              <mat-icon>verified</mat-icon>
              <span>ELECTRONICALLY AUDITED</span>
              <small>{{ data.receipt.paymentDate | date:'dd-MMM-yyyy' }}</small>
            </div>
          </div>
          <div class="sig-col text-right">
            <div class="sig-line"></div>
            <span class="sig-text">Accounts In-charge / Cashier</span>
            <small class="auth-sub">{{ data.instituteName || 'Saraswati Coaching Classes' }}</small>
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
      padding: 24px 32px;
      background: #ffffff;
      color: #0f172a;
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 13.5px;
      line-height: 1.45;
      overflow-y: auto;
      max-height: calc(85vh - 56px);

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
          width: 54px;
          height: 54px;
          border-radius: 12px;
          background: linear-gradient(135deg, #1e40af, #3b82f6);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;

          &.has-img {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            padding: 3px;
          }

          .inst-logo-img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }

          mat-icon { font-size: 32px; width: 32px; height: 32px; }
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
          font-size: 0.86rem;
          .k { width: 140px; color: #475569; font-weight: 600; flex-shrink: 0; }
          .v { color: #0f172a; flex: 1; }
          .student-highlight { font-weight: 800; color: #15803d; font-size: 0.95rem; }
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

    .due-status-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      border-radius: 6px;
      margin-bottom: 14px;

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

      .due-amount-box {
        text-align: right;
        .due-lbl { font-size: 0.72rem; color: #64748b; font-weight: 600; text-transform: uppercase; display: block; }
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
    }
  `]
})
export class FeeReceiptDialogComponent {
  logoUrl: string | null = null;
  logoFailed = false;

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

  constructor(
    public dialogRef: MatDialogRef<FeeReceiptDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FeeReceiptDialogData,
    public authService: AuthService
  ) {
    this.logoUrl = data.logoUrl || this.authService.getInstituteLogoUrl();
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
    if (!el) return;

    const printWindow = window.open('', '_blank', 'width=840,height=900');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Fee Receipt - ${this.data.receipt.receiptNumber}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 15mm; color: #0f172a; font-size: 13px; line-height: 1.45; }
            .paper-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #0f172a; }
            .inst-info { display: flex; align-items: center; gap: 14px; }
            .logo-mark { width: 48px; height: 48px; border-radius: 8px; background: #1e40af; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 24px; overflow: hidden; flex-shrink: 0; }
            .logo-mark.has-img { background: #fff; border: 1px solid #e2e8f0; padding: 2px; }
            .inst-logo-img { width: 100%; height: 100%; object-fit: contain; }
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
            .student-profile-card { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 12px 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; margin-bottom: 14px; }
            .prof-row { display: flex; font-size: 0.82rem; margin-bottom: 4px; }
            .prof-row .k { width: 140px; color: #475569; font-weight: 600; }
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
            .due-status-strip { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; border-radius: 6px; margin-bottom: 12px; }
            .due-status-strip.cleared { background: #f0fdf4; border: 1px solid #86efac; color: #166534; }
            .due-status-strip.due-alert { background: #fff1f2; border: 1px solid #fecdd3; color: #9f1239; }
            .due-title { font-weight: 700; font-size: 0.84rem; }
            .due-num { font-size: 1.05rem; font-weight: 800; }
            .due-lbl { font-size: 0.68rem; color: #64748b; font-weight: 600; text-transform: uppercase; display: block; }
            .receipt-terms { font-size: 0.72rem; color: #64748b; background: #f8fafc; padding: 6px 12px; border-radius: 6px; margin-bottom: 20px; }
            .receipt-terms ol { margin: 3px 0 0 14px; padding: 0; }
            .signatures-row { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 24px; margin-bottom: 12px; }
            .sig-col { width: 180px; }
            .sig-line { height: 1px; background: #475569; margin-bottom: 4px; }
            .sig-text { font-size: 0.75rem; font-weight: 700; color: #334155; display: block; }
            .auth-sub { font-size: 0.68rem; color: #64748b; display: block; }
            .digital-seal { border: 1.5px dashed #0284c7; border-radius: 6px; padding: 4px 10px; background: #f0f9ff; color: #0284c7; font-size: 0.68rem; font-weight: 800; text-align: center; }
            .paper-footer { text-align: center; font-size: 0.66rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 6px; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            @page { margin: 10mm; size: A4 portrait; }
          </style>
        </head>
        <body>
          ${el.outerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
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
    const textMsg = `*OFFICIAL FEE PAYMENT RECEIPT*\n` +
      `*Institute*: ${this.data.instituteName || this.authService.currentUser()?.instituteName || 'Apex Coaching Academy'}\n` +
      branchLine +
      `*Receipt No*: #${this.data.receipt.receiptNumber}\n` +
      `*Date*: ${this.formatToIST(this.data.receipt.paymentDate)}\n\n` +
      `Dear Parent, we have received payment of *₹${this.data.receipt.amountPaid}* for student *${this.data.receipt.studentName}* (${this.data.receipt.batchName || 'General'}).\n` +
      `*Mode*: ${this.getPaymentModeName(this.data.receipt.mode)}\n` +
      headsSection +
      `*Remaining Balance Due*: ₹${this.data.receipt.remainingDue}\n\n` +
      `Thank you for trusting our academy!`;
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
