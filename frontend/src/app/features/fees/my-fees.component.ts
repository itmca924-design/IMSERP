import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { FeesService, StudentLedger, StudentLedgerPaymentItem, FeePaymentReceipt } from '../../core/services/fees.service';
import { AuthService } from '../../core/services/auth.service';
import { FeeReceiptDialogComponent } from './fee-receipt-dialog.component';
import { FeeDueReceiptDialogComponent } from './fee-due-receipt-dialog.component';
import { UpiPaymentDialogComponent } from './upi-payment-dialog.component';

@Component({
  selector: 'app-my-fees',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTabsModule,
    MatTableModule,
    MatTooltipModule,
    MatChipsModule,
    MatDialogModule
  ],
  template: `
    <div class="my-fees-page">
      <!-- Standardized Dialog/Page Top Header (Strict IMSERP UI Rule: Light blue gradient header) -->
      <div class="page-top-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>receipt_long</mat-icon>
          </div>
          <div class="header-text-group">
            <h2 class="main-title">My Fee Ledger &amp; Financial Passbook</h2>
            <p class="subtitle">
              Detailed billing statement for <strong>{{ ledger?.studentName || 'Student' }}</strong>, payment receipt passbook, and dues ledger.
            </p>
          </div>
        </div>

        <div class="header-action-buttons" *ngIf="ledger">
          <button mat-flat-button class="pay-upi-btn" *ngIf="ledger.totalOutstandingDue > 0" (click)="openUpiPaymentForTotal()" matTooltip="Scan Dynamic UPI QR to Pay Outstanding Fees Instantly">
            <mat-icon>qr_code_scanner</mat-icon>
            <span>Pay via UPI (₹{{ ledger.totalOutstandingDue | number:'1.0-0' }})</span>
          </button>
          <button mat-stroked-button class="due-slip-btn" *ngIf="ledger.totalOutstandingDue > 0" (click)="openDueSlip()" matTooltip="Download / Print Official Due Slip">
            <mat-icon>receipt</mat-icon>
            <span>Print Due Slip (बकाया पर्ची)</span>
          </button>
          <button mat-raised-button class="print-passbook-btn" (click)="printPassbook()" matTooltip="Print or save fee passbook as PDF">
            <mat-icon>print</mat-icon>
            <span>Print Statement</span>
          </button>
        </div>
      </div>

      <!-- Loading Bar -->
      <mat-progress-bar mode="indeterminate" *ngIf="loading" class="page-loader"></mat-progress-bar>

      <div class="page-content-wrap" *ngIf="ledger && !loading">
        <!-- Student Information Card & KPI Metrics Row -->
        <mat-card class="student-kpi-card mat-elevation-z1">
          <div class="card-inner-grid">
            <!-- Student Meta Details -->
            <div class="student-profile-summary">
              <div class="student-avatar-box">
                <mat-icon>school</mat-icon>
              </div>
              <div class="student-details">
                <div class="st-name-row">
                  <h3 class="st-name">{{ ledger.studentName }}</h3>
                  <span class="st-status-chip">Enrolled</span>
                </div>
                <div class="st-tags-row">
                  <span class="st-tag">Roll: <strong>{{ ledger.rollNumber || 'N/A' }}</strong></span>
                  <span class="dot">•</span>
                  <span class="st-tag">Batch/Class: <strong>{{ ledger.batchName || 'General' }}</strong></span>
                  <span class="dot" *ngIf="effectiveBranchName">•</span>
                  <span class="st-tag branch" *ngIf="effectiveBranchName">🏛️ {{ effectiveBranchName }}</span>
                </div>
                <div class="parent-contact-row" *ngIf="ledger.parentName || ledger.parentWhatsAppPhone">
                  <mat-icon class="contact-icon">family_restroom</mat-icon>
                  <span>Parent / Guardian: <strong>{{ ledger.parentName || 'Guardian' }}</strong></span>
                  <span class="wa-num" *ngIf="ledger.parentWhatsAppPhone">(WA: {{ ledger.parentWhatsAppPhone }})</span>
                </div>
              </div>
            </div>

            <!-- 4 KPI Metrics -->
            <div class="financial-kpis-grid">
              <div class="kpi-box total">
                <span class="kpi-label">Total Fee Charged</span>
                <strong class="kpi-value">₹{{ ledger.totalFeesCharged | number:'1.2-2' }}</strong>
                <span class="kpi-sub">Total institutional billing</span>
              </div>

              <div class="kpi-box paid">
                <span class="kpi-label">Total Fee Paid</span>
                <strong class="kpi-value text-success">₹{{ ledger.totalFeesPaid | number:'1.2-2' }}</strong>
                <span class="kpi-sub text-success">Settled &amp; receipted</span>
              </div>

              <div class="kpi-box balance" [class.has-due]="ledger.totalOutstandingDue > 0">
                <span class="kpi-label">Net Balance Due</span>
                <strong class="kpi-value" [class.text-danger]="ledger.totalOutstandingDue > 0" [class.text-success]="ledger.totalOutstandingDue <= 0">
                  ₹{{ ledger.totalOutstandingDue | number:'1.2-2' }}
                </strong>
                <span class="kpi-sub" *ngIf="ledger.totalOutstandingDue > 0">Pending fee arrears</span>
                <span class="kpi-sub text-success" *ngIf="ledger.totalOutstandingDue <= 0">All dues cleared 🎉</span>
                <button mat-flat-button class="kpi-pay-btn" *ngIf="ledger.totalOutstandingDue > 0" (click)="openUpiPaymentForTotal()">
                  <mat-icon>qr_code_scanner</mat-icon>
                  <span>Pay Now</span>
                </button>
              </div>

              <div class="kpi-box lib-fines" *ngIf="ledger.pendingLibraryFine && ledger.pendingLibraryFine > 0">
                <span class="kpi-label">Library Fine Due</span>
                <strong class="kpi-value text-warning">₹{{ ledger.pendingLibraryFine | number:'1.2-2' }}</strong>
                <span class="kpi-sub">Book return overdue</span>
              </div>
            </div>
          </div>
        </mat-card>

        <!-- Statement Tabs -->
        <mat-card class="statement-card mat-elevation-z1">
          <mat-tab-group class="statement-tabs" animationDuration="0ms">
            <!-- Tab 1: Month-Wise Invoices & Arrears -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-label-icon">receipt</mat-icon>
                <span>Month-Wise Invoices &amp; Arrears ({{ ledger.invoices.length }})</span>
              </ng-template>

              <div class="tab-body-wrap">
                <div class="table-responsive">
                  <table class="passbook-table">
                    <thead>
                      <tr>
                        <th>Invoice No</th>
                        <th>Month / Description</th>
                        <th>Due Date (IST)</th>
                        <th class="text-right">Total Billed</th>
                        <th class="text-right">Amount Paid</th>
                        <th class="text-right">Balance Due</th>
                        <th class="text-center">Status</th>
                        <th class="text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let inv of ledger.invoices" [class.cancelled-row]="inv.status === 'Cancelled'">
                        <td class="font-mono"><strong>{{ inv.invoiceNumber }}</strong></td>
                        <td>
                          <div class="inv-title">{{ inv.title }}</div>
                          <div class="heads-wrap" *ngIf="inv.items && inv.items.length > 0">
                            <span *ngFor="let it of inv.items" class="head-chip">
                              {{ it.headName }}: ₹{{ it.amount | number:'1.0-0' }}
                            </span>
                          </div>
                          <span *ngIf="inv.status === 'Cancelled'" class="cancelled-tag" [matTooltip]="'Cancelled: ' + (inv.cancellationReason || 'Admin Action')">
                            VOID / CANCELLED
                          </span>
                        </td>
                        <td class="nowrap">{{ formatToIST(inv.dueDate, false) }}</td>
                        <td class="text-right nowrap">
                          {{ inv.status === 'Cancelled' ? '—' : ('₹' + (inv.totalAmount | number:'1.2-2')) }}
                        </td>
                        <td class="text-right text-success nowrap">
                          {{ inv.status === 'Cancelled' ? '—' : ('₹' + (inv.paidAmount | number:'1.2-2')) }}
                        </td>
                        <td class="text-right nowrap" [class.text-danger]="inv.dueAmount > 0 && inv.status !== 'Cancelled'">
                          <strong>{{ inv.status === 'Cancelled' ? '—' : ('₹' + (inv.dueAmount | number:'1.2-2')) }}</strong>
                        </td>
                        <td class="text-center nowrap">
                          <span class="status-pill" [ngClass]="inv.status.toLowerCase()">
                            {{ inv.status }}
                          </span>
                        </td>
                        <td class="text-center nowrap">
                          <button
                            mat-flat-button
                            class="row-pay-upi-btn"
                            *ngIf="inv.dueAmount > 0 && inv.status !== 'Cancelled'"
                            (click)="openUpiPaymentForInvoice(inv)"
                            matTooltip="Pay ₹{{ inv.dueAmount | number:'1.0-0' }} via Dynamic UPI QR"
                          >
                            <mat-icon>qr_code_scanner</mat-icon>
                            <span>Pay ₹{{ inv.dueAmount | number:'1.0-0' }}</span>
                          </button>
                          <span *ngIf="inv.dueAmount <= 0 && inv.status === 'Paid'" class="paid-tag">
                            <mat-icon>check_circle</mat-icon> Settled
                          </span>
                        </td>
                      </tr>
                      <tr *ngIf="ledger.invoices.length === 0">
                        <td colspan="7" class="empty-state-cell">
                          <mat-icon class="empty-icon">sentiment_satisfied_alt</mat-icon>
                          <p>No fee invoices billed for this student profile yet.</p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </mat-tab>

            <!-- Tab 2: Payment Receipts History -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-label-icon">history_edu</mat-icon>
                <span>Payment Receipts History ({{ ledger.payments.length }})</span>
              </ng-template>

              <div class="tab-body-wrap">
                <div class="table-responsive">
                  <table class="passbook-table">
                    <thead>
                      <tr>
                        <th>Receipt No</th>
                        <th>Payment Date (IST)</th>
                        <th>Invoice Ref</th>
                        <th>Payment Mode</th>
                        <th class="text-right">Amount Paid</th>
                        <th>Transaction Ref / Remarks</th>
                        <th class="text-center" style="width: 100px;">Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let p of ledger.payments">
                        <td class="font-mono"><strong class="receipt-no-tag">{{ p.receiptNumber }}</strong></td>
                        <td class="nowrap">{{ formatToIST(p.paymentDate, true) }}</td>
                        <td class="nowrap font-mono">{{ p.invoiceNumber || '—' }}</td>
                        <td class="nowrap">
                          <span class="mode-pill">{{ getPaymentModeName(p.mode) }}</span>
                        </td>
                        <td class="text-right text-success nowrap">
                          <strong>₹{{ p.amountPaid | number:'1.2-2' }}</strong>
                        </td>
                        <td class="remarks-col">
                          <span>{{ p.remarks || p.transactionRef || 'Institutional fee deposit' }}</span>
                        </td>
                        <td class="text-center nowrap">
                          <button mat-stroked-button class="view-receipt-btn" (click)="openPaymentReceipt(p)" matTooltip="View & Print Official Receipt">
                            <mat-icon>print</mat-icon>
                            <span>Receipt</span>
                          </button>
                        </td>
                      </tr>
                      <tr *ngIf="ledger.payments.length === 0">
                        <td colspan="7" class="empty-state-cell">
                          <mat-icon class="empty-icon">receipt</mat-icon>
                          <p>No fee payment receipts issued yet.</p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </mat-tab>
          </mat-tab-group>
        </mat-card>
      </div>

      <!-- Error / Empty State if no student record mapped -->
      <div class="empty-profile-box" *ngIf="!ledger && !loading">
        <mat-icon class="large-icon">contact_support</mat-icon>
        <h3>No Student Profile Linked</h3>
        <p>This parent account is not currently linked to an active student admission record. Please contact the school or coaching administration office.</p>
      </div>
    </div>
  `,
  styles: [`
    .my-fees-page {
      display: flex;
      flex-direction: column;
      gap: 20px;
      width: 100%;
      box-sizing: border-box;
    }

    /* Strict IMSERP UI Header Guideline */
    .page-top-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-radius: 14px;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      box-shadow: 0 2px 8px -2px rgba(37, 99, 235, 0.1);
      flex-wrap: wrap;

      .header-left {
        display: flex;
        align-items: center;
        gap: 14px;

        .header-icon-box {
          background: #2563eb;
          color: #ffffff;
          border-radius: 10px;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;

          mat-icon {
            font-size: 24px;
            width: 24px;
            height: 24px;
          }
        }

        .header-text-group {
          .main-title {
            color: #1e3a8a;
            font-weight: 700;
            font-size: 1.25rem;
            margin: 0 0 2px 0;
          }

          .subtitle {
            color: #3b82f6;
            margin: 0;
            font-size: 0.85rem;

            strong {
              color: #1e40af;
            }
          }
        }
      }

      .header-action-buttons {
        display: flex;
        align-items: center;
        gap: 10px;

        .pay-upi-btn {
          background: #16a34a;
          color: #ffffff;
          font-weight: 700;
          height: 38px;
          box-shadow: 0 2px 6px rgba(22, 163, 74, 0.3);

          mat-icon {
            margin-right: 4px;
          }
        }

        .due-slip-btn {
          border-color: #fca5a5;
          color: #b91c1c;
          background: #fef2f2;
          font-weight: 600;
          height: 38px;

          mat-icon {
            color: #dc2626;
            margin-right: 4px;
          }
        }

        .print-passbook-btn {
          background: #2563eb;
          color: #ffffff;
          font-weight: 600;
          height: 38px;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);

          mat-icon {
            margin-right: 4px;
          }
        }
      }
    }

    .page-loader {
      border-radius: 4px;
    }

    .page-content-wrap {
      display: flex;
      flex-direction: column;
      gap: 20px;
      width: 100%;
    }

    .student-kpi-card {
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      padding: 18px 20px;

      .card-inner-grid {
        display: grid;
        grid-template-columns: 1fr 1.6fr;
        gap: 24px;
        align-items: center;

        @media (max-width: 1024px) {
          grid-template-columns: 1fr;
        }
      }

      .student-profile-summary {
        display: flex;
        align-items: center;
        gap: 16px;

        .student-avatar-box {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;

          mat-icon {
            font-size: 32px;
            width: 32px;
            height: 32px;
          }
        }

        .student-details {
          .st-name-row {
            display: flex;
            align-items: center;
            gap: 10px;

            .st-name {
              margin: 0;
              font-size: 1.15rem;
              font-weight: 700;
              color: #0f172a;
            }

            .st-status-chip {
              background: #dcfce7;
              color: #15803d;
              font-size: 0.7rem;
              font-weight: 700;
              padding: 2px 8px;
              border-radius: 12px;
              text-transform: uppercase;
            }
          }

          .st-tags-row {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.82rem;
            color: #475569;
            margin-top: 3px;
            flex-wrap: wrap;

            .dot {
              color: #cbd5e1;
            }

            .branch {
              color: #2563eb;
              font-weight: 600;
            }
          }

          .parent-contact-row {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.8rem;
            color: #64748b;
            margin-top: 4px;

            .contact-icon {
              font-size: 16px;
              width: 16px;
              height: 16px;
              color: #94a3b8;
            }

            .wa-num {
              color: #16a34a;
              font-weight: 600;
            }
          }
        }
      }

      .financial-kpis-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;

        .kpi-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;

          .kpi-label {
            font-size: 0.72rem;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .kpi-value {
            font-size: 1.25rem;
            font-weight: 800;
            color: #0f172a;
            margin: 4px 0 2px 0;
          }

          .kpi-sub {
            font-size: 0.7rem;
            color: #94a3b8;
          }

          &.has-due {
            background: #fff1f2;
            border-color: #fecdd3;

            .kpi-label {
              color: #be123c;
            }

            .kpi-sub {
              color: #e11d48;
              font-weight: 600;
            }

            .kpi-pay-btn {
              margin-top: 8px;
              background: #16a34a;
              color: #ffffff;
              font-size: 0.75rem;
              font-weight: 700;
              height: 28px;
              line-height: 28px;
              padding: 0 10px;
              border-radius: 6px;

              mat-icon {
                font-size: 16px;
                width: 16px;
                height: 16px;
                margin-right: 2px;
              }
            }
          }
        }
      }
    }

    .statement-card {
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      overflow: hidden;

      .statement-tabs {
        ::ng-deep .mat-mdc-tab-header {
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        .tab-label-icon {
          margin-right: 6px;
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }

      .tab-body-wrap {
        padding: 16px 20px;

        @media (max-width: 768px) {
          padding: 12px 10px;
        }
      }
    }

    .table-responsive {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .passbook-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;

      thead th {
        background: #f1f5f9;
        color: #334155;
        font-weight: 700;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 10px 14px;
        border-bottom: 2px solid #e2e8f0;
        text-align: left;
      }

      tbody td {
        padding: 12px 14px;
        border-bottom: 1px solid #f1f5f9;
        color: #1e293b;
        vertical-align: middle;
      }

      tbody tr:hover {
        background: #f8fafc;
      }

      .font-mono {
        font-family: monospace;
      }

      .nowrap {
        white-space: nowrap;
      }

      .text-right {
        text-align: right;
      }

      .text-center {
        text-align: center;
      }

      .inv-title {
        font-weight: 600;
        color: #0f172a;
      }

      .heads-wrap {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 4px;

        .head-chip {
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 0.7rem;
          padding: 1px 6px;
          border-radius: 4px;
          border: 1px solid #dbeafe;
        }
      }

      .cancelled-row {
        opacity: 0.55;
        background: #f8fafc;
        text-decoration: line-through;
      }

      .cancelled-tag {
        background: #fee2e2;
        color: #b91c1c;
        font-size: 0.68rem;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        display: inline-block;
        margin-top: 4px;
        text-decoration: none;
      }

      .status-pill {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 12px;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;

        &.paid {
          background: #dcfce7;
          color: #15803d;
        }

        &.partial {
          background: #fef3c7;
          color: #b45309;
        }

        &.pending {
          background: #eff6ff;
          color: #1d4ed8;
        }

        &.overdue {
          background: #fee2e2;
          color: #b91c1c;
        }

        &.cancelled {
          background: #f1f5f9;
          color: #64748b;
        }
      }

      .receipt-no-tag {
        color: #0369a1;
      }

      .mode-pill {
        background: #f1f5f9;
        color: #334155;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
      }

      .view-receipt-btn {
        border-color: #bfdbfe;
        color: #1d4ed8;
        height: 32px;
        line-height: 30px;
        padding: 0 10px;
        font-size: 0.78rem;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          margin-right: 2px;
        }

        &:hover {
          background: #eff6ff;
        }
      }

      .row-pay-upi-btn {
        background: #16a34a;
        color: #ffffff;
        font-size: 0.76rem;
        font-weight: 700;
        height: 28px;
        line-height: 28px;
        padding: 0 10px;
        border-radius: 6px;
        box-shadow: 0 2px 4px rgba(22, 163, 74, 0.25);

        mat-icon {
          font-size: 15px;
          width: 15px;
          height: 15px;
          margin-right: 2px;
        }
      }

      .paid-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        font-weight: 700;
        color: #16a34a;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }

      .empty-state-cell {
        text-align: center;
        padding: 48px 16px;
        color: #94a3b8;

        .empty-icon {
          font-size: 40px;
          width: 40px;
          height: 40px;
          margin-bottom: 6px;
        }

        p {
          margin: 0;
          font-size: 0.9rem;
        }
      }
    }

    .text-success { color: #16a34a !important; }
    .text-danger { color: #dc2626 !important; }
    .text-warning { color: #d97706 !important; }

    .empty-profile-box {
      text-align: center;
      padding: 60px 20px;
      background: #ffffff;
      border: 1px dashed #cbd5e1;
      border-radius: 14px;
      color: #64748b;
      margin-top: 30px;

      .large-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #94a3b8;
        margin-bottom: 12px;
      }

      h3 {
        margin: 0 0 6px 0;
        color: #1e293b;
      }

      p {
        margin: 0 auto;
        max-width: 480px;
        font-size: 0.88rem;
        line-height: 1.5;
      }
    }

    @media print {
      body * {
        visibility: hidden;
      }
      .my-fees-page, .my-fees-page * {
        visibility: visible;
      }
      .my-fees-page {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        padding: 0;
      }
      .page-top-header, .header-action-buttons {
        display: none !important;
      }
    }
  `]
})
export class MyFeesComponent implements OnInit {
  ledger: StudentLedger | null = null;
  loading = true;

  get effectiveBranchName(): string {
    if (this.ledger?.branchName) return this.ledger.branchName;
    const authBranch = this.authService.getCurrentBranchName();
    if (authBranch) return authBranch;
    const batch = this.ledger?.batchName || '';
    const match = batch.match(/\(([^)]+)\)/);
    if (match) return match[1];
    return '';
  }

  constructor(
    private feesService: FeesService,
    private authService: AuthService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadMyLedger();
  }

  loadMyLedger(): void {
    this.loading = true;
    this.feesService.getMyLedger().subscribe({
      next: (res) => {
        this.ledger = res;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        console.warn('Could not load student ledger:', err);
      }
    });
  }

  getPaymentModeName(mode: number | string): string {
    const modeNum = Number(mode);
    switch (modeNum) {
      case 0: return 'Cash';
      case 1: return 'UPI';
      case 2: return 'Bank Transfer';
      case 3: return 'Cheque';
      default: return 'Online / Digital';
    }
  }

  formatToIST(dateVal: string | Date | undefined, withTime: boolean = true): string {
    if (!dateVal) return '-';
    let str = String(dateVal).trim();
    if (!str.endsWith('Z') && !str.includes('+') && str.includes('T')) {
      str += 'Z';
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return String(dateVal);

    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    };

    if (withTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.hour12 = true;
    }

    return new Intl.DateTimeFormat('en-IN', options).format(d);
  }

  openPaymentReceipt(payment: StudentLedgerPaymentItem): void {
    if (!this.ledger) return;

    this.feesService.getReceiptByNumber(payment.receiptNumber).subscribe({
      next: (receipt) => {
        this.dialog.open(FeeReceiptDialogComponent, {
          width: '840px',
          maxWidth: '96vw',
          panelClass: 'receipt-dialog-panel',
          data: {
            receipt,
            instituteName: this.authService.currentUser()?.instituteName || 'Apex Coaching Academy',
            branchName: this.effectiveBranchName
          }
        });
      },
      error: () => {
        const matchingInvoice = this.ledger?.invoices.find(i => i.invoiceNumber === payment.invoiceNumber);
        const fallbackItems = matchingInvoice?.items && matchingInvoice.items.length > 0
          ? matchingInvoice.items.map((it, idx) => ({
              itemIndex: idx + 1,
              particulars: it.headName,
              subTitle: matchingInvoice.title,
              reference: matchingInvoice.invoiceNumber,
              amount: it.amount
            }))
          : [{
              itemIndex: 1,
              particulars: matchingInvoice?.title || 'Tuition & Coaching Fee Settlement',
              subTitle: 'Fee Payment',
              reference: payment.invoiceNumber,
              amount: payment.amountPaid
            }];

        const fallbackReceipt: FeePaymentReceipt = {
          paymentId: payment.paymentId,
          receiptNumber: payment.receiptNumber,
          studentName: this.ledger!.studentName,
          rollNumber: this.ledger!.rollNumber,
          batchName: this.ledger!.batchName,
          parentName: this.ledger!.parentName,
          parentPhone: this.ledger!.parentWhatsAppPhone,
          invoiceNumber: payment.invoiceNumber,
          amountPaid: payment.amountPaid,
          remainingDue: this.ledger!.totalOutstandingDue,
          paymentDate: payment.paymentDate,
          mode: payment.mode,
          transactionRef: payment.transactionRef,
          remarks: payment.remarks,
          items: fallbackItems
        };

        this.dialog.open(FeeReceiptDialogComponent, {
          width: '840px',
          maxWidth: '96vw',
          panelClass: 'receipt-dialog-panel',
          data: {
            receipt: fallbackReceipt,
            instituteName: this.authService.currentUser()?.instituteName || 'Apex Coaching Academy',
            branchName: this.effectiveBranchName
          }
        });
      }
    });
  }

  openDueSlip(): void {
    if (!this.ledger) return;

    this.dialog.open(FeeDueReceiptDialogComponent, {
      width: '840px',
      maxWidth: '96vw',
      panelClass: 'receipt-dialog-panel',
      data: {
        studentId: this.ledger.studentId,
        studentName: this.ledger.studentName,
        rollNumber: this.ledger.rollNumber,
        batchName: this.ledger.batchName,
        parentWhatsAppPhone: this.ledger.parentWhatsAppPhone,
        instituteName: this.authService.currentUser()?.instituteName || 'Apex Coaching Academy',
        branchName: this.effectiveBranchName
      }
    });
  }

  printPassbook(): void {
    window.print();
  }

  openUpiPaymentForTotal(): void {
    if (!this.ledger) return;
    const ref = this.dialog.open(UpiPaymentDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      data: {
        mode: 'fifo_student',
        studentId: this.ledger.studentId,
        studentName: this.ledger.studentName,
        rollNumber: this.ledger.rollNumber,
        className: this.ledger.batchName,
        dueAmount: this.ledger.totalOutstandingDue,
        pendingLibraryFine: this.ledger.pendingLibraryFine
      },
      autoFocus: false
    });

    ref.afterClosed().subscribe(res => {
      if (res?.success) {
        this.loadMyLedger();
      }
    });
  }

  openUpiPaymentForInvoice(inv: any): void {
    if (!this.ledger) return;
    const ref = this.dialog.open(UpiPaymentDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      data: {
        mode: 'invoice',
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        dueAmount: inv.dueAmount,
        studentName: this.ledger.studentName,
        rollNumber: this.ledger.rollNumber,
        className: this.ledger.batchName
      },
      autoFocus: false
    });

    ref.afterClosed().subscribe(res => {
      if (res?.success) {
        this.loadMyLedger();
      }
    });
  }
}
