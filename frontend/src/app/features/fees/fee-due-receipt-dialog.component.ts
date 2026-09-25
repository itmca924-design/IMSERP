import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FeesService, FeeDueSlip, FeeDueSlipItem, FeeInvoicePagedItem } from '../../core/services/fees.service';
import { AuthService } from '../../core/services/auth.service';
import { FeeCollectionDialogComponent } from './fee-collection-dialog.component';

export interface FeeDueReceiptDialogData {
  studentId: string;
  invoiceId?: string;
  studentName?: string;
  rollNumber?: string;
  batchName?: string;
  parentWhatsAppPhone?: string;
  invoice?: FeeInvoicePagedItem;
  instituteName?: string;
  branchName?: string;
  logoUrl?: string;
}

@Component({
  selector: 'app-fee-due-receipt-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatDividerModule, MatProgressBarModule],
  template: `
    <div class="due-modal-container">
      <!-- Top Action Bar (hidden in print) -->
      <div class="modal-actions no-print">
        <div class="modal-title">
          <div class="title-badge">
            <mat-icon>receipt_long</mat-icon>
          </div>
          <div class="title-text-group">
            <span class="main-title">Fee Due Slip / Demand Note</span>
            <span class="sub-title">शुल्क मांग पत्र / बकाया पर्ची</span>
          </div>
        </div>
        <div class="btn-group">
          <button mat-flat-button class="header-action-btn collect-btn" (click)="collectNow()" matTooltip="Collect Fee Directly">
            <mat-icon>payments</mat-icon>
            <span>Collect Fee</span>
          </button>
          <button mat-flat-button class="header-action-btn wa-btn" (click)="shareWhatsApp()" *ngIf="dueSlip?.parentPhone || data.parentWhatsAppPhone" matTooltip="Send WhatsApp Due Notice">
            <svg class="wa-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            <span>WhatsApp</span>
          </button>
          <button mat-flat-button class="header-action-btn print-btn" (click)="printDueSlip()" matTooltip="Print or Download PDF">
            <mat-icon>print</mat-icon>
            <span>Print Slip</span>
          </button>
          <button mat-icon-button class="header-close-btn" (click)="dialogRef.close()" matTooltip="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

      <!-- Printable Due Slip Paper -->
      <div class="due-paper" id="due-paper" *ngIf="!loading && dueSlip">
        <!-- Header -->
        <div class="paper-header">
          <div class="inst-info">
            <div class="logo-mark" [class.has-img]="logoUrl && !logoFailed">
              <img *ngIf="logoUrl && !logoFailed" [src]="logoUrl" (error)="logoFailed = true" alt="Logo" class="inst-logo-img">
              <mat-icon *ngIf="!logoUrl || logoFailed">account_balance</mat-icon>
            </div>
            <div>
              <h2 class="inst-name">{{ data.instituteName || authService.currentUser()?.instituteName || 'Apex Coaching Academy' }}</h2>
              <p class="inst-subtitle">Accounts & Financial Clearance Department | Student Fee Demand Note</p>
              <p class="inst-branch" *ngIf="effectiveBranchName">
                <span class="branch-pill">🏛️ Branch: {{ effectiveBranchName }}</span>
                <span class="branch-dept-sep">|</span>
                <span class="branch-dept">Official Accounts Notice</span>
              </p>
            </div>
          </div>
          <div class="due-badge-block">
            <span class="badge-title">FEE DUE SLIP</span>
            <span class="badge-sub">शुल्क बकाया पर्ची / मांग पत्र</span>
            <span class="urgency-tag">PAYMENT DEMAND NOTE</span>
          </div>
        </div>

        <!-- Meta Info Strip -->
        <div class="meta-strip">
          <div class="meta-item">
            <span class="meta-label">Notice Reference No:</span>
            <span class="meta-val highlight">{{ noticeNumber }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Notice Issue Date:</span>
            <span class="meta-val">{{ dueSlip.generatedDate | date:'dd-MMM-yyyy' }}</span>
          </div>
          <div class="meta-item branch-meta-item" *ngIf="effectiveBranchName">
            <span class="meta-label">Branch / Centre:</span>
            <span class="meta-val branch-val">🏛️ {{ effectiveBranchName }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Total Unpaid Invoices:</span>
            <span class="meta-val">{{ dueSlip.dueItems.length }} Invoice(s)</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Account Status:</span>
            <span class="meta-val status-badge-due">PAYMENT OVERDUE</span>
          </div>
        </div>

        <!-- Student Profile Box -->
        <div class="student-profile-card">
          <div class="prof-col">
            <div class="prof-row">
              <span class="k">Student Name:</span>
              <span class="v student-highlight">{{ dueSlip.studentName }}</span>
            </div>
            <div class="prof-row">
              <span class="k">Roll / Admission No:</span>
              <span class="v"><strong>{{ dueSlip.rollNumber || 'N/A' }}</strong></span>
            </div>
            <div class="prof-row">
              <span class="k">Assigned Batch / Class:</span>
              <span class="v">{{ dueSlip.batchName || 'General Coaching Batch' }}</span>
            </div>
          </div>
          <div class="prof-col">
            <div class="prof-row">
              <span class="k">Father / Guardian:</span>
              <span class="v">{{ dueSlip.parentName || 'N/A' }}</span>
            </div>
            <div class="prof-row">
              <span class="k">Registered Mobile:</span>
              <span class="v">{{ dueSlip.parentPhone || 'N/A' }}</span>
            </div>
            <div class="prof-row">
              <span class="k">Settlement Policy:</span>
              <span class="v">FIFO (Oldest Dues Settled First)</span>
            </div>
            <div class="prof-row" *ngIf="dueSlip.hostelInfo">
              <span class="k">🏠 Hostel Facility:</span>
              <span class="v hostel-info-pill">{{ dueSlip.hostelInfo }}</span>
            </div>
          </div>
        </div>

        <!-- Dues Breakdown Table -->
        <div class="table-section">
          <table class="due-table">
            <thead>
              <tr>
                <th class="text-center" style="width: 40px;">#</th>
                <th>Invoice No</th>
                <th>Billing Period / Fee Head</th>
                <th>Due Date</th>
                <th class="text-right">Total Fee (₹)</th>
                <th class="text-right">Paid (₹)</th>
                <th class="text-right">Outstanding Due (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of dueSlip.dueItems; let i = index">
                <td class="text-center">{{ i + 1 }}</td>
                <td><strong>{{ item.invoiceNumber }}</strong></td>
                <td>
                  <div class="due-item-title">{{ item.title }}</div>
                  <div class="due-item-heads" *ngIf="item.breakdown && item.breakdown.length > 0">
                    <span *ngFor="let h of item.breakdown" class="due-head-chip">
                      {{ h.headName }}: ₹{{ h.amount | number:'1.0-0' }}
                    </span>
                  </div>
                </td>
                <td>{{ item.dueDate | date:'dd-MMM-yyyy' }}</td>
                <td class="text-right">₹{{ item.totalAmount | number:'1.2-2' }}</td>
                <td class="text-right amount-paid">₹{{ item.paidAmount | number:'1.2-2' }}</td>
                <td class="text-right amount-due"><strong>₹{{ item.dueAmount | number:'1.2-2' }}</strong></td>
              </tr>
              <tr class="summary-subtotal">
                <td colspan="6" class="text-right"><strong>NET OUTSTANDING AMOUNT DUE:</strong></td>
                <td class="text-right grand-due">₹{{ dueSlip.totalOutstandingDue | number:'1.2-2' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Amount In Words Strip -->
        <div class="amount-words-strip">
          <div class="words-left">
            <span class="w-label">Total Payable Amount in Words:</span>
            <span class="w-text">{{ getAmountInWords(dueSlip.totalOutstandingDue) }}</span>
          </div>
          <div class="words-right">
            <div class="due-stamp">
              <mat-icon>warning</mat-icon>
              <span>DUES PENDING</span>
            </div>
          </div>
        </div>

        <!-- Library Dues Notice Strip (if student has library fine) -->
        <div class="lib-due-notice-strip" *ngIf="dueSlip.pendingLibraryFine && dueSlip.pendingLibraryFine > 0">
          <div class="lib-notice-left">
            <mat-icon class="lib-icon">local_library</mat-icon>
            <div>
              <strong>Additional Institutional Dues: Unsettled Library Overdue Fine</strong>
              <div class="lib-sub">Student has a pending library fine of ₹{{ dueSlip.pendingLibraryFine | number:'1.2-2' }}. Can be settled together at the Fee Counter.</div>
            </div>
          </div>
          <div class="lib-amt">₹{{ dueSlip.pendingLibraryFine | number:'1.2-2' }}</div>
        </div>

        <!-- Payment Instructions Box -->
        <div class="payment-options-box">
          <div class="opt-col">
            <span class="opt-title"><mat-icon>storefront</mat-icon> Counter Payment:</span>
            <p>Visit Institute Office Counter between <strong>10:00 AM to 06:00 PM</strong> (Monday - Saturday) to pay via Cash, Card, or Cheque.</p>
          </div>
          <div class="opt-col">
            <span class="opt-title"><mat-icon>qr_code_scanner</mat-icon> Digital / UPI Payment:</span>
            <p>Pay instantly via UPI (GPay, PhonePe, Paytm). After payment, please share transaction screenshot with Accounts Desk.</p>
          </div>
        </div>

        <!-- Terms & Advisory -->
        <div class="notice-advisory">
          <span class="advisory-title">Important Notice / महत्वपूर्ण सूचना:</span>
          <p>
            Dear Parent/Student, this is an official fee demand statement. Please clear the pending fee arrears at the earliest to ensure uninterrupted classroom sessions, examination admit cards, and performance report updates.
          </p>
        </div>

        <!-- Signatures & Official Stamp -->
        <div class="signatures-row">
          <div class="sig-col">
            <div class="sig-line"></div>
            <span class="sig-text">Parent / Student Signature</span>
            <small>Received copy of fee due demand</small>
          </div>
          <div class="sig-col text-center">
            <div class="digital-seal">
              <mat-icon>verified</mat-icon>
              <span>OFFICIALLY ISSUED</span>
              <small>{{ dueSlip.generatedDate | date:'dd-MMM-yyyy' }}</small>
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
          <span>This is an official computer-generated fee due slip from IMSERP Coaching Management Suite.</span>
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

    .due-modal-container {
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
      padding: 10px 18px;
      background: #0f172a;
      color: #ffffff;
      border-bottom: 1px solid #1e293b;
      flex-shrink: 0;

      .modal-title {
        display: flex;
        align-items: center;
        gap: 10px;

        .title-badge {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: rgba(220, 38, 38, 0.2);
          border: 1px solid rgba(220, 38, 38, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f87171;
          mat-icon { font-size: 20px; width: 20px; height: 20px; }
        }

        .title-text-group {
          display: flex;
          flex-direction: column;
          .main-title {
            font-weight: 700;
            font-size: 0.98rem;
            color: #ffffff;
            letter-spacing: -0.01em;
          }
          .sub-title {
            font-size: 0.72rem;
            color: #94a3b8;
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

          &.collect-btn {
            background: #0284c7 !important;
            color: #ffffff !important;
            &:hover { background: #0369a1 !important; transform: translateY(-1px); }
          }

          &.wa-btn {
            background: #16a34a !important;
            color: #ffffff !important;
            .wa-icon { width: 15px; height: 15px; fill: #ffffff; }
            &:hover { background: #15803d !important; transform: translateY(-1px); }
          }

          &.print-btn {
            background: #3b82f6 !important;
            color: #ffffff !important;
            &:hover { background: #2563eb !important; transform: translateY(-1px); }
          }
        }

        .header-close-btn {
          color: #94a3b8 !important;
          width: 34px !important;
          height: 34px !important;
          border-radius: 6px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: color 0.15s ease, background 0.15s ease !important;
          mat-icon { font-size: 20px; width: 20px; height: 20px; }
          &:hover {
            color: #ffffff !important;
            background: rgba(255, 255, 255, 0.1) !important;
          }
        }
      }
    }

    .due-paper {
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
      border-bottom: 2px solid #b91c1c;

      .inst-info {
        display: flex;
        align-items: center;
        gap: 16px;

        .logo-mark {
          width: 54px;
          height: 54px;
          border-radius: 12px;
          background: linear-gradient(135deg, #b91c1c, #dc2626);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;

          &.has-img {
            background: #ffffff;
            border: 1px solid #fecaca;
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
          color: #dc2626;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;

          .branch-pill {
            background: #fef2f2;
            color: #b91c1c;
            padding: 2px 8px;
            border-radius: 6px;
            border: 1px solid #fecaca;
            font-weight: 700;
            font-size: 0.76rem;
          }
          .branch-dept-sep { color: #94a3b8; }
          .branch-dept { color: #64748b; font-weight: 500; font-size: 0.74rem; }
        }
      }

      .due-badge-block {
        display: flex;
        flex-direction: column;
        align-items: flex-end;

        .badge-title {
          font-size: 1.15rem;
          font-weight: 800;
          color: #b91c1c;
          letter-spacing: 0.05em;
        }

        .badge-sub {
          font-size: 0.8rem;
          color: #64748b;
          font-weight: 600;
        }

        .urgency-tag {
          margin-top: 4px;
          font-size: 0.68rem;
          font-weight: 700;
          background: #fee2e2;
          color: #b91c1c;
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid #fca5a5;
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
          color: #b91c1c;
          font-weight: 700;
        }
        .meta-label { font-size: 0.72rem; color: #64748b; font-weight: 600; text-transform: uppercase; white-space: nowrap; }
        .meta-val { font-size: 0.88rem; font-weight: 700; color: #1e293b; margin-top: 2px; }
        .meta-val.highlight { color: #b91c1c; }
        .status-badge-due {
          display: inline-block;
          background: #fee2e2;
          color: #991b1b;
          padding: 1px 8px;
          border-radius: 4px;
          width: fit-content;
          font-size: 0.76rem;
        }
      }
    }

    .student-profile-card {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      padding: 14px 18px;
      background: #fef2f2;
      border: 1px solid #fecaca;
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
          .student-highlight { font-weight: 800; color: #991b1b; font-size: 0.95rem; }
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

      .due-table {
        width: 100%;
        border-collapse: collapse;

        th {
          background: #1e293b;
          color: #ffffff;
          padding: 8px 12px;
          font-size: 0.8rem;
          font-weight: 700;
          text-align: left;
        }

        td {
          padding: 9px 12px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 0.88rem;
        }

        .amount-paid { color: #16a34a; }
        .amount-due { color: #dc2626; font-size: 0.95rem; }

        .due-item-title {
          font-weight: 600;
          color: #0f172a;
        }

        .due-heads-list {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 4px;
        }

        .due-head-chip {
          font-size: 0.72rem;
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fecaca;
          padding: 1px 7px;
          border-radius: 4px;
          font-weight: 600;
          display: inline-block;
          white-space: nowrap;
        }

        .summary-subtotal {
          background: #f8fafc;
          border-top: 2px solid #cbd5e1;
          font-size: 0.92rem;
          .grand-due {
            font-size: 1.2rem;
            font-weight: 800;
            color: #dc2626;
          }
        }
      }
    }

    .amount-words-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      background: #fff1f2;
      border: 1px dashed #fca5a5;
      border-radius: 6px;
      margin-bottom: 14px;

      .words-left {
        display: flex;
        flex-direction: column;
        .w-label { font-size: 0.72rem; color: #b91c1c; font-weight: 700; text-transform: uppercase; }
        .w-text { font-size: 0.92rem; font-weight: 700; color: #991b1b; }
      }

      .due-stamp {
        display: flex;
        align-items: center;
        gap: 6px;
        background: #dc2626;
        color: #ffffff;
        padding: 4px 14px;
        border-radius: 20px;
        font-weight: 800;
        font-size: 0.82rem;
        letter-spacing: 0.05em;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
    }

    .lib-due-notice-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #fdf4ff;
      border: 1px solid #f0abfc;
      border-radius: 6px;
      padding: 10px 16px;
      margin-bottom: 14px;

      .lib-notice-left {
        display: flex;
        align-items: center;
        gap: 10px;
        .lib-icon { color: #a21caf; font-size: 22px; width: 22px; height: 22px; }
        strong { color: #86198f; font-size: 0.88rem; }
        .lib-sub { color: #a21caf; font-size: 0.76rem; }
      }
      .lib-amt {
        font-size: 1.15rem;
        font-weight: 700;
        color: #c026d3;
      }
    }

    .payment-options-box {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 14px;

      .opt-col {
        .opt-title {
          font-weight: 700;
          font-size: 0.82rem;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; color: #3b82f6; }
        }
        p { margin: 0; font-size: 0.76rem; color: #475569; line-height: 1.4; }
      }
    }

    .notice-advisory {
      font-size: 0.76rem;
      color: #64748b;
      background: #fffbeb;
      border: 1px solid #fef3c7;
      padding: 8px 14px;
      border-radius: 6px;
      margin-bottom: 24px;

      .advisory-title { font-weight: 700; color: #92400e; display: block; margin-bottom: 2px; }
      p { margin: 0; color: #78350f; line-height: 1.4; }
    }

    .signatures-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 24px;
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
          border: 1.5px dashed #dc2626;
          border-radius: 8px;
          padding: 6px 12px;
          background: #fef2f2;
          color: #dc2626;
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
      .due-paper {
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
        .due-badge-block {
          align-items: flex-start;
        }
      }
      .meta-strip {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 8px 10px;
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
      .due-paper {
        padding: 0 !important;
        max-height: none !important;
        overflow: visible !important;
      }
    }
  `]
})
export class FeeDueReceiptDialogComponent implements OnInit {
  loading = true;
  dueSlip?: FeeDueSlip;
  noticeNumber = '';
  logoUrl: string | null = null;
  logoFailed = false;

  get effectiveBranchName(): string {
    if (this.data?.branchName) return this.data.branchName;
    const authBranch = this.authService.getCurrentBranchName();
    if (authBranch) return authBranch;
    const batch = this.dueSlip?.batchName || this.data?.batchName || this.data?.invoice?.batchName || '';
    const match = batch.match(/\(([^)]+)\)/);
    if (match) return match[1];
    return '';
  }

  constructor(
    public dialogRef: MatDialogRef<FeeDueReceiptDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FeeDueReceiptDialogData,
    private feesService: FeesService,
    private dialog: MatDialog,
    public authService: AuthService
  ) {
    this.logoUrl = data.logoUrl || this.authService.getInstituteLogoUrl();
  }

  ngOnInit(): void {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    this.noticeNumber = `DUE-${yearMonth}-${rand}`;

    this.feesService.getStudentDueSlip(this.data.studentId, this.data.invoiceId).subscribe({
      next: (slip) => {
        this.dueSlip = slip;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching due slip:', err);
        // Fallback using passed invoice data if available
        if (this.data.invoice) {
          this.dueSlip = {
            studentId: this.data.invoice.studentId,
            studentName: this.data.invoice.studentName,
            rollNumber: this.data.invoice.rollNumber,
            batchName: this.data.invoice.batchName,
            parentName: this.data.studentName || 'Parent / Guardian',
            parentPhone: this.data.invoice.parentWhatsAppPhone,
            totalOutstandingDue: this.data.invoice.dueAmount,
            generatedDate: new Date().toISOString(),
            dueItems: [{
              invoiceId: this.data.invoice.id,
              invoiceNumber: this.data.invoice.invoiceNumber,
              title: this.data.invoice.title,
              dueDate: this.data.invoice.dueDate,
              totalAmount: this.data.invoice.totalAmount,
              paidAmount: this.data.invoice.paidAmount,
              dueAmount: this.data.invoice.dueAmount,
              breakdown: this.data.invoice.items
            }]
          };
        }
        this.loading = false;
      }
    });
  }

  getAmountInWords(amount: number): string {
    return convertToIndianWords(Math.round(amount)) + ' Rupees Only';
  }

  collectNow(): void {
    if (!this.dueSlip) return;
    this.dialogRef.close('COLLECT_NOW');
  }

  printDueSlip(): void {
    const el = document.getElementById('due-paper');
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
          <title>Fee Due Slip - ${this.noticeNumber}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 15mm; color: #0f172a; font-size: 13px; line-height: 1.45; }
            .paper-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #b91c1c; }
            .inst-info { display: flex; align-items: center; gap: 14px; }
            .logo-mark { width: 48px; height: 48px; border-radius: 8px; background: #b91c1c; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 24px; overflow: hidden; flex-shrink: 0; }
            .logo-mark.has-img { background: #fff; border: 1px solid #fecaca; padding: 2px; }
            .inst-logo-img { width: 100%; height: 100%; object-fit: contain; }
            .inst-name { font-size: 1.35rem; font-weight: 800; color: #0f172a; }
            .inst-subtitle { font-size: 0.8rem; color: #475569; margin-top: 2px; }
            .inst-branch { font-size: 0.74rem; color: #b91c1c; font-weight: 600; margin-top: 3px; display: flex; align-items: center; gap: 6px; }
            .branch-pill { background: #fef2f2; color: #b91c1c; padding: 2px 7px; border-radius: 4px; border: 1px solid #fecaca; font-weight: 700; font-size: 0.72rem; }
            .branch-dept-sep { color: #94a3b8; }
            .branch-dept { color: #64748b; font-weight: 500; font-size: 0.7rem; }
            .due-badge-block { text-align: right; }
            .badge-title { font-size: 1.1rem; font-weight: 800; color: #b91c1c; }
            .badge-sub { font-size: 0.78rem; color: #64748b; font-weight: 600; display: block; }
            .urgency-tag { display: inline-block; margin-top: 4px; font-size: 0.65rem; font-weight: 700; background: #fee2e2; color: #b91c1c; padding: 2px 8px; border-radius: 4px; border: 1px solid #fca5a5; }
            .meta-strip { display: flex; flex-wrap: wrap; gap: 10px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin: 14px 0; }
            .meta-item { display: flex; flex-direction: column; min-width: 100px; flex: 1 1 auto; }
            .meta-label { font-size: 0.7rem; color: #64748b; font-weight: 600; text-transform: uppercase; display: block; }
            .meta-val { font-size: 0.85rem; font-weight: 700; color: #1e293b; margin-top: 2px; display: block; }
            .meta-val.highlight { color: #b91c1c; }
            .meta-val.branch-val { color: #b91c1c; }
            .status-badge-due { display: inline-block; background: #fee2e2; color: #991b1b; padding: 1px 8px; border-radius: 4px; font-size: 0.76rem; }
            .student-profile-card { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 12px 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; margin-bottom: 14px; }
            .prof-row { display: flex; font-size: 0.82rem; margin-bottom: 4px; }
            .prof-row .k { width: 140px; color: #475569; font-weight: 600; }
            .prof-row .v { color: #0f172a; flex: 1; }
            .student-highlight { font-weight: 800; color: #991b1b; font-size: 0.92rem; }
            .table-section { margin-bottom: 12px; }
            .due-table { width: 100%; border-collapse: collapse; }
            .due-table th { background: #1e293b; color: #fff; padding: 8px 10px; font-size: 0.78rem; font-weight: 700; text-align: left; }
            .due-table td { padding: 9px 10px; border-bottom: 1px solid #e2e8f0; font-size: 0.84rem; }
            .due-item-title { font-weight: 600; color: #0f172a; }
            .due-heads-list { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
            .due-head-chip { font-size: 0.72rem; background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; padding: 1px 7px; border-radius: 4px; font-weight: 600; display: inline-block; }
            .amount-paid { color: #16a34a; }
            .amount-due { color: #dc2626; font-size: 0.92rem; }
            .summary-subtotal { background: #f8fafc; border-top: 2px solid #cbd5e1; }
            .grand-due { font-size: 1.15rem; font-weight: 800; color: #dc2626; }
            .amount-words-strip { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; background: #fff1f2; border: 1px dashed #fca5a5; border-radius: 6px; margin-bottom: 12px; }
            .w-label { font-size: 0.7rem; color: #b91c1c; font-weight: 700; text-transform: uppercase; display: block; }
            .w-text { font-size: 0.88rem; font-weight: 700; color: #991b1b; }
            .due-stamp { background: #dc2626; color: #fff; padding: 3px 12px; border-radius: 16px; font-weight: 800; font-size: 0.8rem; }
            .payment-options-box { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; }
            .opt-title { font-weight: 700; font-size: 0.8rem; color: #0f172a; margin-bottom: 3px; display: block; }
            .opt-col p { margin: 0; font-size: 0.74rem; color: #475569; }
            .notice-advisory { font-size: 0.74rem; color: #78350f; background: #fffbeb; border: 1px solid #fef3c7; padding: 6px 12px; border-radius: 6px; margin-bottom: 20px; }
            .advisory-title { font-weight: 700; color: #92400e; margin-bottom: 2px; display: block; }
            .signatures-row { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 24px; margin-bottom: 12px; }
            .sig-col { width: 180px; }
            .sig-line { height: 1px; background: #475569; margin-bottom: 4px; }
            .sig-text { font-size: 0.75rem; font-weight: 700; color: #334155; display: block; }
            .auth-sub { font-size: 0.68rem; color: #64748b; display: block; }
            .digital-seal { border: 1.5px dashed #dc2626; border-radius: 6px; padding: 4px 10px; background: #fef2f2; color: #dc2626; font-size: 0.68rem; font-weight: 800; text-align: center; }
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

  shareWhatsApp(): void {
    const phone = this.dueSlip?.parentPhone || this.data.parentWhatsAppPhone;
    if (!phone || !this.dueSlip) return;

    const rawPhone = phone.replace(/\D/g, '');
    const formattedPhone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;

    const invDetails = this.dueSlip.dueItems.map(d => `• ${d.title}: Due *₹${d.dueAmount}* (Due Date: ${new Date(d.dueDate).toLocaleDateString('en-IN')})`).join('\n');

    const branchLine = this.effectiveBranchName ? `*Branch*: ${this.effectiveBranchName}\n` : '';
    const instName = this.data.instituteName || this.authService.currentUser()?.instituteName || 'Apex Coaching Academy';

    const textMsg = `*OFFICIAL FEE DUE DEMAND SLIP*\n` +
      `*Institute*: ${instName}\n` +
      branchLine +
      `*Notice No*: #${this.noticeNumber}\n` +
      `*Date*: ${new Date().toLocaleDateString('en-IN')}\n\n` +
      `Dear Parent, this is an official reminder regarding pending fees for *${this.dueSlip.studentName}* (${this.dueSlip.batchName || 'General'}).\n\n` +
      `*Outstanding Dues Breakdown*:\n${invDetails}\n\n` +
      `*Total Outstanding Balance*: *₹${this.dueSlip.totalOutstandingDue}*\n\n` +
      `Please clear the dues at the institute counter or via UPI at your earliest convenience to avoid any disruption in classes.\n\n` +
      `Thank you,\n*Accounts Department*`;

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
