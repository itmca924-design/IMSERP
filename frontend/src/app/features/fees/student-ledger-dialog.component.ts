import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { FeesService, StudentLedger } from '../../core/services/fees.service';
import { FeeCollectionDialogComponent } from './fee-collection-dialog.component';

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
    MatChipsModule
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
        <button mat-icon-button (click)="onClose()">
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
              <span class="st-roll">Roll No: <strong>{{ ledger.rollNumber }}</strong> | Batch: <strong>{{ ledger.batchName }}</strong></span>
              <span class="st-parent">Parent: {{ ledger.parentName }} (WA: {{ ledger.parentWhatsAppPhone }})</span>
            </div>
          </div>

          <div class="kpi-metrics">
            <div class="metric-box">
              <span class="m-label">Total Charged:</span>
              <strong class="m-value charged">₹{{ ledger.totalFeesCharged | number:'1.2-2' }}</strong>
            </div>
            <div class="metric-box">
              <span class="m-label">Total Fees Paid:</span>
              <strong class="m-value paid">₹{{ ledger.totalFeesPaid | number:'1.2-2' }}</strong>
            </div>
            <div class="metric-box due-highlight">
              <span class="m-label">Net Outstanding Due:</span>
              <strong class="m-value due">₹{{ ledger.totalOutstandingDue | number:'1.2-2' }}</strong>
            </div>
          </div>
        </div>

        <!-- Ledger Tabs (Invoices & Receipts) -->
        <mat-tab-group class="ledger-tabs">
          <!-- Tab 1: Month-Wise Invoices & Arrears -->
          <mat-tab label="Month-Wise Invoices & Arrears ({{ ledger.invoices.length }})">
            <div class="tab-content">
              <table class="ledger-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Month / Billing Period</th>
                    <th>Due Date</th>
                    <th class="text-right">Total Fee (₹)</th>
                    <th class="text-right">Paid (₹)</th>
                    <th class="text-right">Balance Due (₹)</th>
                    <th class="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let inv of ledger.invoices" [class.cancelled-row]="inv.status === 'Cancelled'">
                    <td><strong>{{ inv.invoiceNumber }}</strong></td>
                    <td>{{ inv.title }}
                      <span *ngIf="inv.status === 'Cancelled'" class="cancelled-label">VOID</span>
                    </td>
                    <td>{{ inv.dueDate | date:'mediumDate' }}</td>
                    <td class="text-right amount-col">{{ inv.status === 'Cancelled' ? '—' : ('₹' + (inv.totalAmount | number:'1.2-2')) }}</td>
                    <td class="text-right text-success amount-col">{{ inv.status === 'Cancelled' ? '—' : ('₹' + (inv.paidAmount | number:'1.2-2')) }}</td>
                    <td class="text-right text-danger amount-col">
                      <strong>{{ inv.status === 'Cancelled' ? '—' : ('₹' + (inv.dueAmount | number:'1.2-2')) }}</strong>
                    </td>
                    <td class="text-center">
                      <span class="status-badge" [ngClass]="inv.status.toLowerCase()">
                        {{ inv.status }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </mat-tab>

          <!-- Tab 2: Payment Receipts History -->
          <mat-tab label="Payment Receipts History ({{ ledger.payments.length }})">
            <div class="tab-content">
              <table class="ledger-table">
                <thead>
                  <tr>
                    <th>Receipt No</th>
                    <th>Payment Date</th>
                    <th>Invoice Ref</th>
                    <th>Payment Mode</th>
                    <th class="text-right">Amount Paid (₹)</th>
                    <th>Transaction Ref / Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let p of ledger.payments">
                    <td><strong>{{ p.receiptNumber }}</strong></td>
                    <td>{{ p.paymentDate | date:'medium' }}</td>
                    <td>{{ p.invoiceNumber }}</td>
                    <td>
                      <span class="mode-badge">{{ getPaymentModeName(p.mode) }}</span>
                    </td>
                    <td class="text-right text-success"><strong>₹{{ p.amountPaid | number:'1.2-2' }}</strong></td>
                    <td><small>{{ p.transactionRef || 'N/A' }} ({{ p.remarks || '-' }})</small></td>
                  </tr>
                  <tr *ngIf="ledger.payments.length === 0">
                    <td colspan="6" class="text-center empty-cell">No payment receipts issued yet.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>

      <div class="dialog-actions">
        <button mat-raised-button color="primary" (click)="onClose()">
          Done
        </button>
      </div>
    </div>
  `,
  styles: [`
    .ledger-dialog-container {
      padding: 20px 24px;
      min-width: 740px;
      max-width: 820px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      overflow: hidden;
      -ms-overflow-style: none;
      scrollbar-width: none;
      &::-webkit-scrollbar {
        display: none;
        width: 0;
      }
      @media (max-width: 768px) {
        min-width: auto;
        padding: 14px;
      }
    }
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      flex-shrink: 0;

      .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
        .header-icon {
          font-size: 32px;
          width: 32px;
          height: 32px;
        }
        .title {
          margin: 0;
          font-size: 1.3rem;
          font-weight: 700;
          color: #0f172a;
        }
        .subtitle {
          margin: 2px 0 0 0;
          font-size: 0.82rem;
          color: #64748b;
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
      padding: 14px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      flex-wrap: wrap;
      gap: 14px;
      flex-shrink: 0;

      .student-profile {
        display: flex;
        align-items: center;
        gap: 12px;

        .profile-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #e0f2fe;
          color: #0284c7;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 28px; width: 28px; height: 28px; }
        }
        .profile-info {
          display: flex;
          flex-direction: column;
          .st-name { margin: 0; font-size: 1.1rem; font-weight: 700; color: #0f172a; }
          .st-roll { font-size: 0.82rem; color: #475569; }
          .st-parent { font-size: 0.78rem; color: #64748b; }
        }
      }
      .kpi-metrics {
        display: flex;
        gap: 16px;
        .metric-box {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          padding: 8px 12px;
          background: #f8fafc;
          border-radius: 6px;

          &.due-highlight {
            background: #fef2f2;
            border: 1px solid #fecaca;
          }
          .m-label { font-size: 0.75rem; color: #64748b; }
          .m-value {
            font-size: 1.1rem;
            &.charged { color: #334155; }
            &.paid { color: #16a34a; }
            &.due { color: #dc2626; }
          }
        }
      }
    }
    .ledger-tabs {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .tab-content {
      padding-top: 10px;
      max-height: 42vh;
      min-height: 140px;
      overflow-y: auto;
      overflow-x: auto;
      -ms-overflow-style: none;  /* IE and Edge */
      scrollbar-width: none;     /* Firefox */

      &::-webkit-scrollbar {
        display: none;           /* Chrome, Safari, Edge */
        width: 0;
        height: 0;
      }
    }
    .ledger-table {
      width: 100%;
      border-collapse: collapse;
      th, td {
        padding: 10px 12px;
        border-bottom: 1px solid #f1f5f9;
        font-size: 0.85rem;
      }
      th {
        background-color: #f8fafc;
        font-weight: 600;
        color: #475569;
        position: sticky;
        top: 0;
        z-index: 5;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      }
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
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
      gap: 12px;
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      flex-shrink: 0;
    }
  `]
})
export class StudentLedgerDialogComponent implements OnInit {
  ledger?: StudentLedger;
  loading = false;

  constructor(
    private feesService: FeesService,
    private dialog: MatDialog,
    private dialogRef: MatDialogRef<StudentLedgerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { studentId: string }
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

  collectFeeModal(): void {
    if (!this.ledger) return;

    const dialogRef = this.dialog.open(FeeCollectionDialogComponent, {
      width: '540px',
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
      }
    });
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
