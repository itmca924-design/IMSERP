import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FeesService, StudentLedger, StudentLedgerPaymentItem, FeePaymentReceipt } from '../../core/services/fees.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { FeeCollectionDialogComponent } from './fee-collection-dialog.component';
import { FeeReceiptDialogComponent } from './fee-receipt-dialog.component';
import { FeeDueReceiptDialogComponent } from './fee-due-receipt-dialog.component';

@Component({
  selector: 'app-student-ledger-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatTabsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTooltipModule
  ],
  template: `
    <div class="ledger-dialog-container">
      <div class="dialog-header">
        <div class="header-left">
          <mat-icon color="primary" class="header-icon">menu_book</mat-icon>
          <div>
            <h2 class="title">Student Financial Passbook & Ledger</h2>
            <p class="subtitle">Complete month-wise fee statement, arrears, and payment receipts audit trail.</p>
          </div>
        </div>
        <button mat-icon-button (click)="onClose()" class="close-btn" aria-label="Close dialog">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

      <div class="ledger-body" *ngIf="ledger">
        <!-- Student Info & Outstanding KPI Card -->
        <div class="ledger-kpi-card mat-elevation-z1">
          <div class="student-profile">
            <div class="profile-avatar">
              <mat-icon>person</mat-icon>
            </div>
            <div class="profile-info">
              <h3 class="st-name">{{ ledger.studentName }}</h3>
              <div class="st-meta-row">
                <span class="st-roll">Roll: <strong>{{ ledger.rollNumber }}</strong></span>
                <span class="st-sep">|</span>
                <span class="st-batch">Batch: <strong>{{ ledger.batchName }}</strong></span>
              </div>
              <span class="st-parent">Parent: {{ ledger.parentName }} (WA: {{ ledger.parentWhatsAppPhone }})</span>
            </div>
          </div>

          <div class="kpi-metrics">
            <div class="metric-box">
              <span class="m-label">
                <span class="d-only">Total Charged:</span>
                <span class="m-only">Total Fee</span>
              </span>
              <strong class="m-value charged">₹{{ ledger.totalFeesCharged | number:'1.2-2' }}</strong>
            </div>
            <div class="metric-box">
              <span class="m-label">
                <span class="d-only">Total Fees Paid:</span>
                <span class="m-only">Fee Paid</span>
              </span>
              <strong class="m-value paid">₹{{ ledger.totalFeesPaid | number:'1.2-2' }}</strong>
            </div>
            <div class="metric-box due-highlight">
              <span class="m-label">
                <span class="d-only">Net Outstanding Due:</span>
                <span class="m-only">Net Due</span>
              </span>
              <strong class="m-value due">₹{{ ledger.totalOutstandingDue | number:'1.2-2' }}</strong>
            </div>
            <div class="metric-box lib-due-box" *ngIf="ledger.pendingLibraryFine && ledger.pendingLibraryFine > 0">
              <span class="m-label">
                <span class="d-only">Library Fine Due:</span>
                <span class="m-only">Lib Fine</span>
              </span>
              <strong class="m-value lib-fine">₹{{ ledger.pendingLibraryFine | number:'1.2-2' }}</strong>
            </div>
          </div>
        </div>

        <!-- Ledger Tabs (Invoices & Receipts) -->
        <mat-tab-group class="ledger-tabs" animationDuration="0ms">
          <!-- Tab 1: Month-Wise Invoices & Arrears -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-label-icon">receipt</mat-icon>
              <span class="tab-label-desktop">Month-Wise Invoices & Arrears ({{ ledger.invoices.length }})</span>
              <span class="tab-label-mobile">Invoices ({{ ledger.invoices.length }})</span>
            </ng-template>
            <div class="tab-content">
              <div class="mobile-swipe-hint">
                <mat-icon>swipe_left</mat-icon>
                <span>Swipe horizontally to view full table details</span>
              </div>
              <table class="ledger-table">
                <thead>
                  <tr>
                    <th class="nowrap-col text-left">Invoice No</th>
                    <th class="text-left">Month / Billing Period</th>
                    <th class="nowrap-col text-left">Due Date</th>
                    <th class="text-right nowrap-col">Total Fee (₹)</th>
                    <th class="text-right nowrap-col">Paid (₹)</th>
                    <th class="text-right nowrap-col">Balance Due (₹)</th>
                    <th class="text-center nowrap-col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let inv of ledger.invoices" [class.cancelled-row]="inv.status === 'Cancelled'">
                    <td class="nowrap-col"><strong>{{ inv.invoiceNumber }}</strong></td>
                    <td>
                      <div>{{ inv.title }}</div>
                      <div *ngIf="inv.items && inv.items.length > 0" class="mini-heads-row">
                        <span *ngFor="let it of inv.items" class="mini-head-chip">
                          {{ it.headName }}: ₹{{ it.amount | number:'1.0-0' }}
                        </span>
                      </div>
                      <span *ngIf="inv.status === 'Cancelled'" class="cancelled-label" [matTooltip]="'Cancelled' + (inv.cancelledAt ? ' on ' + (inv.cancelledAt | date:'mediumDate') : '') + (inv.cancellationReason ? ' | Reason: ' + inv.cancellationReason : '')">VOID</span>
                    </td>
                    <td class="nowrap-col">{{ inv.dueDate | date:'mediumDate' }}</td>
                    <td class="text-right amount-col nowrap-col">{{ inv.status === 'Cancelled' ? '—' : ('₹' + (inv.totalAmount | number:'1.2-2')) }}</td>
                    <td class="text-right text-success amount-col nowrap-col">{{ inv.status === 'Cancelled' ? '—' : ('₹' + (inv.paidAmount | number:'1.2-2')) }}</td>
                    <td class="text-right text-danger amount-col nowrap-col">
                      <strong>{{ inv.status === 'Cancelled' ? '—' : ('₹' + (inv.dueAmount | number:'1.2-2')) }}</strong>
                    </td>
                    <td class="text-center nowrap-col">
                      <span class="status-badge" [ngClass]="inv.status.toLowerCase()" [matTooltip]="inv.status === 'Cancelled' ? ('Cancelled' + (inv.cancelledAt ? ' on ' + (inv.cancelledAt | date:'mediumDate') : '') + (inv.cancellationReason ? ' | Reason: ' + inv.cancellationReason : '')) : ''">
                        {{ inv.status }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </mat-tab>

          <!-- Tab 2: Payment Receipts History -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-label-icon">history_edu</mat-icon>
              <span class="tab-label-desktop">Payment Receipts History ({{ ledger.payments.length }})</span>
              <span class="tab-label-mobile">Receipts ({{ ledger.payments.length }})</span>
            </ng-template>
            <div class="tab-content">
              <div class="mobile-swipe-hint">
                <mat-icon>swipe_left</mat-icon>
                <span>Swipe horizontally to view full table details</span>
              </div>
              <table class="ledger-table">
                <thead>
                  <tr>
                    <th class="nowrap-col text-left">Receipt No</th>
                    <th class="nowrap-col text-left">Payment Date (IST)</th>
                    <th class="nowrap-col text-left">Invoice Ref</th>
                    <th class="nowrap-col text-left">Payment Mode</th>
                    <th class="text-right nowrap-col">Amount Paid (₹)</th>
                    <th class="text-left">Remarks</th>
                    <th class="text-center nowrap-col" style="width: 70px;">Print</th>
                    <th class="text-center nowrap-col" style="width: 90px;">Reverse</th>
                  </tr>
                </thead>
                <tbody>
                  <ng-container *ngFor="let p of ledger.payments">
                    <tr [class.reversing-row]="reversingPaymentId === p.paymentId">
                      <td class="nowrap-col"><strong class="receipt-no-text">{{ p.receiptNumber }}</strong></td>
                      <td class="nowrap-col date-col">{{ formatToIST(p.paymentDate) }}</td>
                      <td class="nowrap-col inv-ref-text">{{ p.invoiceNumber || '—' }}</td>
                      <td class="nowrap-col">
                        <span class="mode-badge">{{ getPaymentModeName(p.mode) }}</span>
                      </td>
                      <td class="text-right text-success nowrap-col amount-text"><strong>₹{{ p.amountPaid | number:'1.2-2' }}</strong></td>
                      <td class="remarks-cell"><small>{{ p.transactionRef || 'N/A' }} ({{ p.remarks || '-' }})</small></td>
                      <td class="text-center nowrap-col">
                        <button mat-icon-button color="primary" (click)="openPaymentReceipt(p)" matTooltip="Print / View Payment Receipt">
                          <mat-icon>print</mat-icon>
                        </button>
                      </td>
                      <td class="text-center nowrap-col">
                        <button
                          mat-icon-button
                          color="warn"
                          (click)="startReversePayment(p)"
                          matTooltip="Reverse / Undo this payment"
                          *ngIf="reversingPaymentId !== p.paymentId"
                        >
                          <mat-icon>undo</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          color="warn"
                          (click)="cancelReverse()"
                          matTooltip="Cancel reversal"
                          *ngIf="reversingPaymentId === p.paymentId"
                        >
                          <mat-icon>close</mat-icon>
                        </button>
                      </td>
                    </tr>
                    <!-- Inline confirmation row -->
                    <tr *ngIf="reversingPaymentId === p.paymentId" class="confirm-reverse-row">
                      <td colspan="8">
                        <div class="reverse-confirm-box">
                          <mat-icon class="rev-warn-icon">warning_amber</mat-icon>
                          <div class="rev-confirm-text">
                            <strong>Reverse ₹{{ p.amountPaid | number:'1.2-2' }} ({{ p.receiptNumber }})?</strong>
                            <span>This payment will be permanently deleted and the invoice balance will be restored to due.</span>
                          </div>
                          <div class="rev-confirm-actions">
                            <button mat-stroked-button (click)="cancelReverse()" [disabled]="reversingInProgress">Cancel</button>
                            <button mat-raised-button color="warn" (click)="confirmReversePayment(p)" [disabled]="reversingInProgress">
                              <mat-icon *ngIf="!reversingInProgress">delete_forever</mat-icon>
                              <mat-icon class="spinning-icon" *ngIf="reversingInProgress">sync</mat-icon>
                              <span>{{ reversingInProgress ? 'Reversing...' : 'Confirm Reverse' }}</span>
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </ng-container>
                  <tr *ngIf="ledger.payments.length === 0">
                    <td colspan="8" class="text-center empty-cell">No payment receipts issued yet.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>

      <div class="dialog-actions">
        <button mat-stroked-button color="warn" (click)="openDueSlip()" *ngIf="ledger && ledger.totalOutstandingDue > 0">
          <mat-icon>receipt_long</mat-icon>
          <span>Print Due Slip (बकाया पर्ची)</span>
        </button>
        <button mat-stroked-button color="primary" (click)="collectFeeModal()" *ngIf="ledger && ledger.totalOutstandingDue > 0">
          <mat-icon>payments</mat-icon>
          <span>Collect Fee</span>
        </button>
        <button mat-raised-button color="primary" (click)="onClose()">
          Done
        </button>
      </div>
    </div>
  `,
  styles: [`
    .ledger-dialog-container {
      padding: 18px 22px;
      max-width: 1020px;
      width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      overflow: hidden;

      @media (min-width: 960px) {
        min-width: 920px;
      }
      @media (max-width: 959px) and (min-width: 600px) {
        min-width: auto;
        padding: 16px;
      }
      @media (max-width: 599px) {
        min-width: auto;
        padding: 10px 12px;
        max-height: 95vh;
      }
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      flex-shrink: 0;

      .header-left {
        display: flex;
        align-items: center;
        gap: 10px;
        .header-icon {
          font-size: 30px;
          width: 30px;
          height: 30px;
          flex-shrink: 0;
        }
        .title {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.25;
        }
        .subtitle {
          margin: 2px 0 0 0;
          font-size: 0.8rem;
          color: #64748b;
        }
      }

      .close-btn {
        flex-shrink: 0;
      }

      @media (max-width: 600px) {
        margin-bottom: 8px;
        .header-left {
          gap: 8px;
          .header-icon {
            font-size: 22px;
            width: 22px;
            height: 22px;
          }
          .title {
            font-size: 1.02rem;
          }
          .subtitle {
            display: none;
          }
        }
      }
    }

    .ledger-body {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .ledger-kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      gap: 12px;
      flex-shrink: 0;

      .student-profile {
        display: flex;
        align-items: center;
        gap: 12px;

        .profile-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #e0f2fe;
          color: #0284c7;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          mat-icon { font-size: 26px; width: 26px; height: 26px; }
        }
        .profile-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
          .st-name { margin: 0; font-size: 1.05rem; font-weight: 700; color: #0f172a; }
          .st-meta-row {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.8rem;
            color: #475569;
            .st-sep { color: #cbd5e1; }
          }
          .st-parent { font-size: 0.76rem; color: #64748b; }
        }
      }

      .kpi-metrics {
        display: flex;
        gap: 14px;
        flex-shrink: 0;

        .metric-box {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          padding: 8px 12px;
          background: #f8fafc;
          border-radius: 6px;
          min-width: 0;

          &.due-highlight {
            background: #fef2f2;
            border: 1px solid #fecaca;
          }
          .m-label {
            font-size: 0.74rem;
            color: #64748b;
            .d-only { display: inline; }
            .m-only { display: none; }
          }
          .m-value {
            font-size: 1.1rem;
            white-space: nowrap;
            &.charged { color: #334155; }
            &.paid { color: #16a34a; }
            &.due { color: #dc2626; }
            &.lib-fine { color: #a21caf; }
          }
          &.lib-due-box {
            background: #fdf4ff;
            border-color: #f0abfc;
          }
        }
      }

      @media (max-width: 768px) {
        flex-direction: column;
        align-items: stretch;
        padding: 10px 12px;
        gap: 10px;
        margin-bottom: 8px;

        .student-profile {
          gap: 10px;
          .profile-avatar {
            width: 36px;
            height: 36px;
            mat-icon { font-size: 20px; width: 20px; height: 20px; }
          }
          .profile-info {
            .st-name { font-size: 0.95rem; }
            .st-meta-row { font-size: 0.75rem; }
            .st-parent { font-size: 0.72rem; }
          }
        }

        .kpi-metrics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          width: 100%;

          .metric-box {
            align-items: center;
            text-align: center;
            padding: 6px 4px;

            .m-label {
              font-size: 0.68rem;
              line-height: 1.15;
              .d-only { display: none; }
              .m-only { display: inline; font-weight: 600; }
            }
            .m-value {
              font-size: 0.92rem;
              font-weight: 700;
            }
          }
        }
      }
    }

    .ledger-tabs {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;

      .tab-label-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-right: 6px;
        vertical-align: middle;
      }
      .tab-label-desktop { display: inline; }
      .tab-label-mobile { display: none; }

      @media (max-width: 680px) {
        .tab-label-desktop { display: none; }
        .tab-label-mobile { display: inline; font-size: 0.82rem; font-weight: 600; }
      }
    }

    .mobile-swipe-hint {
      display: none;
      align-items: center;
      gap: 6px;
      font-size: 0.72rem;
      color: #3b82f6;
      background: #eff6ff;
      border: 1px dashed #bfdbfe;
      padding: 4px 10px;
      border-radius: 4px;
      margin-bottom: 6px;
      mat-icon {
        font-size: 15px;
        width: 15px;
        height: 15px;
        color: #2563eb;
      }
      @media (max-width: 768px) {
        display: flex;
      }
    }

    .tab-content {
      padding-top: 6px;
      max-height: 46vh;
      min-height: 150px;
      overflow-y: auto;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scroll-behavior: smooth;

      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 #f8fafc;

      &::-webkit-scrollbar {
        width: 6px;
        height: 6px;
        display: block;
      }
      &::-webkit-scrollbar-track {
        background: #f8fafc;
        border-radius: 4px;
      }
      &::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
      }
      &::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
    }

    .ledger-table {
      width: 100%;
      min-width: 680px;
      border-collapse: collapse;
      th, td {
        padding: 9px 12px;
        border-bottom: 1px solid #f1f5f9;
        font-size: 0.84rem;
        text-align: left;
      }
      th {
        text-align: left !important;
        background-color: #f8fafc;
        font-weight: 600;
        color: #475569;
        position: sticky;
        top: 0;
        z-index: 5;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      }

      .mini-heads-row {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 4px;

        .mini-head-chip {
          font-size: 0.7rem;
          background: #f0f9ff;
          color: #0369a1;
          border: 1px solid #bae6fd;
          padding: 1px 6px;
          border-radius: 10px;
          font-weight: 600;
          display: inline-block;
          white-space: nowrap;
        }
      }
    }

    .nowrap-col {
      white-space: nowrap !important;
    }
    .receipt-no-text {
      color: #0f172a;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .date-col {
      color: #334155;
      font-variant-numeric: tabular-nums;
      white-space: nowrap !important;
      min-width: 180px;
    }
    .inv-ref-text {
      color: #475569;
      font-weight: 600;
    }
    .amount-text {
      font-size: 0.95rem;
    }
    .remarks-cell {
      color: #64748b;
      max-width: 200px;
    }
    .text-left { text-align: left !important; }
    .text-right { text-align: right !important; }
    .text-center { text-align: center !important; }
    .text-success { color: #16a34a; }
    .text-danger { color: #dc2626; }
    .empty-cell { padding: 24px; color: #94a3b8; }
    .mode-badge {
      background: #e2e8f0;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .status-badge {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.72rem;
      font-weight: 600;
      display: inline-block;
      &.pending   { background: #fef3c7; color: #92400e; }
      &.partial   { background: #dbeafe; color: #1e40af; }
      &.paid      { background: #dcfce7; color: #166534; }
      &.overdue   { background: #fee2e2; color: #991b1b; }
      &.cancelled { background: #f1f5f9; color: #94a3b8; text-decoration: line-through; }
    }
    .cancelled-row {
      opacity: 0.55;
      background: #f8fafc;
      td { text-decoration: line-through; color: #94a3b8; }
      .amount-col {
        text-decoration: none !important;
        font-weight: normal;
        strong { text-decoration: none !important; font-weight: normal; }
      }
    }
    .cancelled-label {
      background: #e2e8f0;
      color: #64748b;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 3px;
      margin-left: 6px;
      vertical-align: middle;
      letter-spacing: 0.05em;
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      flex-shrink: 0;

      @media (max-width: 600px) {
        flex-direction: column-reverse;
        gap: 6px;
        margin-top: 8px;
        padding-top: 8px;

        button {
          width: 100%;
          justify-content: center;
        }
      }
    }

    .reversing-row td {
      background: #fff7ed;
    }

    .confirm-reverse-row td {
      padding: 0 !important;
      background: #fff7ed;
      border-bottom: 2px solid #f97316;
    }

    .reverse-confirm-box {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      flex-wrap: wrap;

      .rev-warn-icon {
        color: #f97316;
        font-size: 22px;
        width: 22px;
        height: 22px;
        flex-shrink: 0;
      }

      .rev-confirm-text {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 0.82rem;
        color: #7c2d12;

        strong {
          font-size: 0.9rem;
        }
      }

      .rev-confirm-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }

      .spinning-icon {
        animation: spin 1s linear infinite;
        display: inline-block;
      }
      @keyframes spin {
        100% { transform: rotate(360deg); }
      }
    }
  `]
})
export class StudentLedgerDialogComponent implements OnInit {
  ledger?: StudentLedger;
  loading = false;
  reversingPaymentId: string | null = null;
  reversingInProgress = false;
  hasReversedPayment = false;

  constructor(
    private feesService: FeesService,
    private authService: AuthService,
    private dialog: MatDialog,
    private dialogRef: MatDialogRef<StudentLedgerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { studentId: string },
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.loadLedger();
  }

  loadLedger(): void {
    this.loading = true;
    this.feesService.getStudentLedger(this.data.studentId).subscribe({
      next: (res) => {
        this.ledger = res;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  startReversePayment(payment: StudentLedgerPaymentItem): void {
    this.reversingPaymentId = payment.paymentId;
  }

  cancelReverse(): void {
    this.reversingPaymentId = null;
    this.reversingInProgress = false;
  }

  confirmReversePayment(payment: StudentLedgerPaymentItem): void {
    if (this.reversingInProgress) return;
    this.reversingInProgress = true;
    this.loading = true;

    this.feesService.reversePayment(payment.paymentId, 'Payment reversed by admin').subscribe({
      next: (res) => {
        this.reversingPaymentId = null;
        this.reversingInProgress = false;
        this.hasReversedPayment = true;

        // Immediately notify background fees dashboard/grid to refresh with loader
        this.feesService.notifyRefreshRequired();

        // Reload the ledger data to update cards and payment table
        this.loadLedger();

        // Show Angular Material success alert
        this.confirmDialog.alert('Payment Reversed', res.message || 'Payment reversed successfully.', 'success');
      },
      error: (err) => {
        this.loading = false;
        this.reversingInProgress = false;
        this.confirmDialog.alert('Reversal Failed', err?.error?.message || 'Failed to reverse payment. Please try again.', 'danger');
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
      default: return 'Online';
    }
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

  collectFeeModal(): void {
    if (!this.ledger) return;

    const dialogRef = this.dialog.open(FeeCollectionDialogComponent, {
      width: '640px',
      maxWidth: '96vw',
      data: {
        studentId: this.ledger.studentId,
        studentName: this.ledger.studentName,
        rollNumber: this.ledger.rollNumber,
        batchName: this.ledger.batchName,
        parentWhatsAppPhone: this.ledger.parentWhatsAppPhone,
        totalOutstandingDue: this.ledger.totalOutstandingDue
      }
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res) {
        this.loadLedger();
        this.dialog.open(FeeReceiptDialogComponent, {
          width: '840px',
          maxWidth: '96vw',
          panelClass: 'receipt-dialog-panel',
          data: {
            receipt: res,
            instituteName: this.authService.currentUser()?.instituteName || 'Saraswati Coaching Classes'
          }
        });
      }
    });
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
            instituteName: this.authService.currentUser()?.instituteName || 'Saraswati Coaching Classes'
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
            instituteName: this.authService.currentUser()?.instituteName || 'Apex Coaching Academy'
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
        instituteName: this.authService.currentUser()?.instituteName || 'Saraswati Coaching Classes'
      }
    });
  }

  onClose(): void {
    this.dialogRef.close({ refreshed: this.hasReversedPayment });
  }
}
