import { Component, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { FeesService, FeeInvoicePagedItem, FeeInvoiceItem } from '../../core/services/fees.service';

export interface FeeInvoiceBreakdownDialogData {
  invoice: FeeInvoicePagedItem;
  instituteName?: string;
  branchName?: string;
}

export interface BreakdownDialogResult {
  action: 'collect' | 'upi' | 'receipt' | 'due-slip' | 'ledger' | 'whatsapp';
  invoice?: FeeInvoicePagedItem;
  studentId?: string;
}

interface CategorizedHeadItem extends FeeInvoiceItem {
  icon: string;
  iconBg: string;
  iconColor: string;
  note: string;
  isTuition: boolean;
}

@Component({
  selector: 'app-fee-invoice-breakdown-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule
  ],
  template: `
    <div class="breakdown-dialog-container">
      <!-- Standard Light-Blue Gradient Header (AGENTS.md Rule) -->
      <div class="dialog-header">
        <div class="header-icon-wrap">
          <mat-icon>receipt_long</mat-icon>
        </div>
        <div class="header-titles">
          <h2 mat-dialog-title class="main-title">Fee Heads & Invoice Breakdown</h2>
          <p class="subtitle">
            Invoice <strong>#{{ inv.invoiceNumber }}</strong> • <strong>{{ inv.studentName }}</strong>
            @if (inv.rollNumber) {
              <span> (Roll: {{ inv.rollNumber }})</span>
            }
          </p>
        </div>
        <button mat-icon-button type="button" class="close-btn" (click)="onClose()" matTooltip="Close (Esc)">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    
      <!-- Scrollable Dialog Content -->
      <mat-dialog-content class="dialog-content">
        <!-- 1. Student & Invoice Meta Deck -->
        <div class="meta-deck-card">
          <div class="meta-deck-left">
            <div class="student-avatar-box">
              {{ getStudentInitials(inv.studentName) }}
            </div>
            <div class="student-meta-details">
              <div class="student-name-row">
                <span class="student-name">{{ inv.studentName }}</span>
                @if (inv.rollNumber) {
                  <span class="roll-pill">Roll: {{ inv.rollNumber }}</span>
                }
              </div>
              <div class="academic-badges-row">
                @if (inv.className) {
                  <span class="academic-badge class-badge">
                    <mat-icon class="badge-ic">school</mat-icon>
                    {{ inv.className }}@if (inv.sectionName) {
                    <span> - {{ inv.sectionName }}</span>
                  }
                </span>
              }
              @if (inv.batchName) {
                <span class="academic-badge batch-badge">
                  <mat-icon class="badge-ic">track_changes</mat-icon>
                  {{ inv.batchName }}
                </span>
              }
              @if (data.branchName) {
                <span class="academic-badge branch-badge">
                  <mat-icon class="badge-ic">location_on</mat-icon>
                  {{ data.branchName }}
                </span>
              }
            </div>
          </div>
        </div>
    
        <div class="meta-deck-right">
          <!-- Invoice Status Pill -->
          <span class="status-pill" [ngClass]="getStatusClass(inv.status)">
            <mat-icon class="pill-ic">{{ getStatusIcon(inv.status) }}</mat-icon>
            <span>{{ inv.status }}</span>
          </span>
    
          <!-- Period Badge -->
          @if (inv.title) {
            <span class="period-badge">
              <mat-icon class="period-ic">calendar_month</mat-icon>
              <span>{{ inv.title }}</span>
            </span>
          }
        </div>
      </div>
    
      <!-- 2. Billed Months Detail Strip (if present) -->
      @if (billedMonths.length > 0) {
        <div class="months-strip">
          <div class="months-strip-label">
            <mat-icon>event_repeat</mat-icon>
            <span>Billed Cycle ({{ billedMonths.length }} Month{{ billedMonths.length > 1 ? 's' : '' }}):</span>
          </div>
          <div class="months-chips">
            @for (m of billedMonths; track m; let i = $index) {
              <span class="month-chip">
                <span class="m-idx">{{ i + 1 }}.</span> {{ m }}
              </span>
            }
          </div>
        </div>
      }
    
      <!-- 3. Cancellation / Waived Audit Banner -->
      @if (inv.cancellationReason) {
        <div class="audit-banner">
          <mat-icon class="audit-banner-ic">info</mat-icon>
          <div class="audit-banner-body">
            <strong>Invoice Note / Audit Flag:</strong>
            <span>{{ inv.cancellationReason }}</span>
          </div>
        </div>
      }
    
      <!-- 4. Fee Heads Breakdown Card -->
      <div class="breakdown-card">
        <div class="breakdown-card-header">
          <div class="breakdown-title-wrap">
            <mat-icon class="sec-ic">format_list_bulleted</mat-icon>
            <span class="sec-title">Fee Heads Itemized Breakdown</span>
          </div>
          @if (itemsList && itemsList.length > 0) {
            <span class="heads-count-pill">
              {{ itemsList.length }} Head{{ itemsList.length > 1 ? 's' : '' }}
            </span>
          }
        </div>
    
        <div class="breakdown-table-wrap">
          @if (itemsList && itemsList.length > 0) {
            <table class="heads-table">
              <thead>
                <tr>
                  <th class="th-num">#</th>
                  <th class="th-head">Fee Head Description</th>
                  <th class="th-note">Cycle / Frequency</th>
                  <th class="th-amt text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                @for (it of itemsList; track it; let idx = $index) {
                  <tr [class.tuition-row]="it.isTuition">
                    <td class="td-num">
                      <span class="index-num">{{ idx + 1 }}</span>
                    </td>
                    <td class="td-head">
                      <div class="head-item-cell">
                        <div class="head-icon-circle" [style.background]="it.iconBg" [style.color]="it.iconColor">
                          <mat-icon>{{ it.icon }}</mat-icon>
                        </div>
                        <div class="head-names">
                          <span class="head-name" [class.tuition-title]="it.isTuition">{{ it.headName || 'Fee Head' }}</span>
                          @if (it.isTuition) {
                            <span class="tuition-pill">TUITION</span>
                          }
                        </div>
                      </div>
                    </td>
                    <td class="td-note">
                      @if (it.note) {
                        <span class="cycle-note-pill">{{ it.note }}</span>
                      }
                      @if (!it.note) {
                        <span class="text-muted-dash">—</span>
                      }
                    </td>
                    <td class="td-amt text-right">
                      <strong class="amt-val">₹{{ (it.amount || 0) | number:'1.2-2' }}</strong>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            @if (!loadingHeads) {
              <div class="empty-heads-notice">
                <mat-icon>info</mat-icon>
                <span>No itemized breakdown heads recorded for this invoice. Total billed amount is ₹{{ (inv.totalAmount || 0) | number:'1.2-2' }}.</span>
              </div>
            }
            @if (loadingHeads) {
              <div class="empty-heads-notice loading-notice">
                <mat-icon class="spin-ic">sync</mat-icon>
                <span>Loading fee breakdown heads...</span>
              </div>
            }
          }
    
        </div>
      </div>
    
      <!-- 5. Financial Summary Grid Deck (3 Cards) -->
      <div class="totals-summary-grid">
        <div class="summary-box total-box">
          <div class="box-top">
            <span class="box-label">Total Fee</span>
            <mat-icon class="box-ic">account_balance_wallet</mat-icon>
          </div>
          <div class="box-amount">₹{{ inv.totalAmount | number:'1.2-2' }}</div>
          <div class="box-caption">Gross Invoiced</div>
        </div>
    
        <div class="summary-box paid-box">
          <div class="box-top">
            <span class="box-label">Paid So Far</span>
            <mat-icon class="box-ic">check_circle</mat-icon>
          </div>
          <div class="box-amount green-text">₹{{ inv.paidAmount | number:'1.2-2' }}</div>
          <div class="box-caption">Realized Payments</div>
        </div>
    
        <div class="summary-box due-box" [class.zero-due]="inv.dueAmount <= 0">
          <div class="box-top">
            <span class="box-label">Balance Due</span>
            <mat-icon class="box-ic">{{ inv.dueAmount <= 0 ? 'verified' : 'pending_actions' }}</mat-icon>
          </div>
          <div class="box-amount" [class.red-text]="inv.dueAmount > 0" [class.green-text]="inv.dueAmount <= 0">
            ₹{{ inv.dueAmount | number:'1.2-2' }}
          </div>
          <div class="box-caption">{{ inv.dueAmount <= 0 ? 'Fully Settled' : 'Outstanding Balance' }}</div>
        </div>
      </div>
    </mat-dialog-content>
    
    <!-- Dialog Action Footer -->
    <div class="dialog-actions">
      <div class="actions-left">
        <button mat-stroked-button type="button" class="action-btn-secondary" (click)="onOpenLedger()">
          <mat-icon>menu_book</mat-icon>
          <span>Passbook</span>
        </button>
        @if (inv.status !== 'Cancelled') {
          <button mat-stroked-button type="button" class="action-btn-secondary" (click)="onSendWhatsApp()">
            <mat-icon class="whatsapp-ic">chat</mat-icon>
            <span>WhatsApp</span>
          </button>
        }
      </div>
    
      <div class="actions-right">
        <button mat-stroked-button type="button" class="close-action-btn" (click)="onClose()">
          Close
        </button>
    
        <!-- Pay via UPI QR -->
        @if (inv.dueAmount > 0 && inv.status !== 'Cancelled') {
          <button
            mat-stroked-button
            type="button"
            class="upi-action-btn"
            (click)="onOpenUpi()">
            <mat-icon>qr_code_2</mat-icon>
            <span>UPI QR</span>
          </button>
        }
    
        <!-- Print Due Slip (if due) -->
        @if (inv.dueAmount > 0 && inv.status !== 'Cancelled') {
          <button
            mat-stroked-button
            type="button"
            class="due-slip-btn"
            (click)="onOpenDueSlip()">
            <mat-icon>receipt_long</mat-icon>
            <span>Due Slip</span>
          </button>
        }
    
        <!-- Print Payment Receipt (if paid) -->
        @if (inv.status === 'Paid') {
          <button
            mat-raised-button
            color="primary"
            type="button"
            class="primary-action-btn"
            (click)="onOpenReceipt()">
            <mat-icon>receipt</mat-icon>
            <span>Print Receipt</span>
          </button>
        }
    
        <!-- Collect Fee (if pending) -->
        @if (inv.dueAmount > 0 && inv.status !== 'Cancelled') {
          <button
            mat-raised-button
            color="primary"
            type="button"
            class="primary-action-btn"
            (click)="onCollectFee()">
            <mat-icon>payments</mat-icon>
            <span>Collect Fee</span>
          </button>
        }
      </div>
    </div>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .breakdown-dialog-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      background: #ffffff;
      border-radius: 14px;
      overflow: hidden;
      box-sizing: border-box;
    }

    /* Standard Light-Blue Gradient Header (AGENTS.md Strict Rule) */
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
      flex-shrink: 0;

      .header-icon-wrap {
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

      .header-titles {
        flex: 1;
        min-width: 0;

        .main-title {
          color: #1e3a8a;
          font-weight: 700;
          font-size: 1.15rem;
          margin: 0;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .subtitle {
          color: #3b82f6;
          font-size: 0.82rem;
          margin: 3px 0 0;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;

          strong {
            color: #1e40af;
          }
        }
      }

      .close-btn {
        color: #64748b;
        margin-left: auto;
        flex-shrink: 0;
        &:hover {
          color: #1e293b;
          background: rgba(0, 0, 0, 0.04);
        }
      }
    }

    /* Scrollable Dialog Content */
    .dialog-content {
      padding: 18px 20px;
      max-height: 72vh;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      display: block;
      background: #fafafa;
      box-sizing: border-box;

      .meta-deck-card {
        margin-bottom: 14px;
      }

      .months-strip {
        margin-bottom: 14px;
      }

      .audit-banner {
        margin-bottom: 14px;
      }

      .breakdown-card {
        margin-bottom: 16px;
      }

      .totals-summary-grid {
        margin-bottom: 4px;
      }
    }

    /* 1. Student & Invoice Meta Deck */
    .meta-deck-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

      .meta-deck-left {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        min-width: 0;
        flex: 1;
        box-sizing: border-box;

        .student-avatar-box {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: #ffffff;
          font-weight: 800;
          font-size: 1.05rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);
        }

        .student-meta-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;

          .student-name-row {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;

            .student-name {
              font-size: 1.02rem;
              font-weight: 700;
              color: #0f172a;
              line-height: 1.25;
            }

            .roll-pill {
              font-size: 0.72rem;
              font-weight: 700;
              background: #f1f5f9;
              color: #475569;
              padding: 2px 8px;
              border-radius: 10px;
              border: 1px solid #e2e8f0;
            }
          }

          .academic-badges-row {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;

            .academic-badge {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              font-size: 0.74rem;
              font-weight: 600;
              padding: 2px 8px;
              border-radius: 6px;

              .badge-ic {
                font-size: 13px;
                width: 13px;
                height: 13px;
              }

              &.class-badge {
                background: #eff6ff;
                color: #1e40af;
                border: 1px solid #bfdbfe;
              }

              &.batch-badge {
                background: #faf5ff;
                color: #7e22ce;
                border: 1px solid #e9d5ff;
              }

              &.branch-badge {
                background: #f0fdf4;
                color: #15803d;
                border: 1px solid #bbf7d0;
              }
            }
          }
        }
      }

      .meta-deck-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
        flex-shrink: 0;

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 14px;
          font-size: 0.76rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.02em;

          .pill-ic {
            font-size: 14px;
            width: 14px;
            height: 14px;
          }

          &.status-paid {
            background: #dcfce7;
            color: #15803d;
            border: 1px solid #86efac;
          }

          &.status-pending {
            background: #fef2f2;
            color: #b91c1c;
            border: 1px solid #fecaca;
          }

          &.status-partial {
            background: #fffbeb;
            color: #b45309;
            border: 1px solid #fde68a;
          }

          &.status-waived {
            background: #f1f5f9;
            color: #475569;
            border: 1px solid #cbd5e1;
          }

          &.status-cancelled {
            background: #f3f4f6;
            color: #6b7280;
            border: 1px solid #d1d5db;
          }
        }

        .period-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.76rem;
          color: #475569;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 3px 8px;
          border-radius: 6px;
          font-weight: 600;

          .period-ic {
            font-size: 14px;
            width: 14px;
            height: 14px;
            color: #2563eb;
          }
        }
      }
    }

    /* 2. Billed Months Detail Strip */
    .months-strip {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;

      .months-strip-label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #1e40af;
        font-weight: 700;
        font-size: 0.8rem;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }

      .months-chips {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;

        .month-chip {
          background: #ffffff;
          border: 1px solid #93c5fd;
          color: #1e3a8a;
          font-weight: 600;
          font-size: 0.74rem;
          padding: 2px 8px;
          border-radius: 6px;

          .m-idx {
            color: #3b82f6;
            font-weight: 700;
          }
        }
      }
    }

    /* 3. Audit Banner */
    .audit-banner {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 10px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      color: #92400e;
      font-size: 0.8rem;

      .audit-banner-ic {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #d97706;
        flex-shrink: 0;
      }

      .audit-banner-body {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
    }

    /* 4. Fee Heads Breakdown Card */
    .breakdown-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      width: 100%;
      box-sizing: border-box;

      .breakdown-card-header {
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        border-bottom: 1px solid #e2e8f0;
        padding: 10px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;

        .breakdown-title-wrap {
          display: flex;
          align-items: center;
          gap: 8px;

          .sec-ic {
            font-size: 18px;
            width: 18px;
            height: 18px;
            color: #2563eb;
          }

          .sec-title {
            font-size: 0.88rem;
            font-weight: 700;
            color: #1e293b;
          }
        }

        .heads-count-pill {
          font-size: 0.74rem;
          font-weight: 700;
          color: #2563eb;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          padding: 2px 8px;
          border-radius: 10px;
        }
      }

      .breakdown-table-wrap {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        background: #ffffff;
      }

      .heads-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.84rem;
        display: table;

        thead {
          display: table-header-group;
        }

        th {
          background: #f8fafc;
          color: #64748b;
          font-weight: 700;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          padding: 11px 14px;
          border-bottom: 1px solid #e2e8f0;
        }

        tbody {
          display: table-row-group;
        }

        tr {
          display: table-row;
          transition: background-color 0.15s ease;
        }

        td {
          padding: 10px 14px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
          color: #1e293b;
        }

        tr:last-child td {
          border-bottom: none;
        }

        tr:hover td {
          background: #f8fafc;
        }

        tr.tuition-row td {
          background: #fbfdff;
        }

        .th-num, .td-num {
          width: 44px;
          text-align: center;
        }

        .index-num {
          font-size: 0.74rem;
          font-weight: 700;
          color: #94a3b8;
        }

        .head-item-cell {
          display: flex;
          align-items: center;
          gap: 10px;

          .head-icon-circle {
            width: 30px;
            height: 30px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;

            mat-icon {
              font-size: 16px;
              width: 16px;
              height: 16px;
            }
          }

          .head-names {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;

            .head-name {
              font-weight: 600;
              color: #0f172a;
              line-height: 1.3;

              &.tuition-title {
                color: #1d4ed8;
                font-weight: 700;
              }
            }

            .tuition-pill {
              font-size: 0.62rem;
              font-weight: 800;
              background: #dbeafe;
              color: #1e40af;
              padding: 1px 6px;
              border-radius: 4px;
              letter-spacing: 0.04em;
            }
          }
        }

        .cycle-note-pill {
          display: inline-block;
          font-size: 0.72rem;
          color: #475569;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          padding: 2px 7px;
          border-radius: 6px;
          font-weight: 500;
          white-space: nowrap;
        }

        .text-muted-dash {
          color: #94a3b8;
        }

        .amt-val {
          font-size: 0.92rem;
          color: #0f172a;
          font-weight: 700;
          white-space: nowrap;
        }
      }

      .empty-heads-notice {
        padding: 24px 16px;
        text-align: center;
        color: #64748b;
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;

        mat-icon {
          color: #3b82f6;
        }

        &.loading-notice .spin-ic {
          animation: spin 1s linear infinite;
        }
      }
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    /* 5. Financial Totals Summary Grid Deck */
    .totals-summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;

      .summary-box {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);

        .box-top {
          display: flex;
          align-items: center;
          justify-content: space-between;

          .box-label {
            font-size: 0.72rem;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.03em;
          }

          .box-ic {
            font-size: 18px;
            width: 18px;
            height: 18px;
            color: #94a3b8;
          }
        }

        .box-amount {
          font-size: 1.25rem;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.2;

          &.green-text {
            color: #15803d;
          }

          &.red-text {
            color: #dc2626;
          }
        }

        .box-caption {
          font-size: 0.68rem;
          color: #94a3b8;
          font-weight: 500;
        }

        &.total-box {
          background: #f8fafc;
          border-color: #e2e8f0;
          .box-ic { color: #2563eb; }
        }

        &.paid-box {
          background: #f0fdf4;
          border-color: #bbf7d0;
          .box-ic { color: #16a34a; }
        }

        &.due-box {
          background: #fef2f2;
          border-color: #fecaca;
          .box-ic { color: #dc2626; }

          &.zero-due {
            background: #f8fafc;
            border-color: #e2e8f0;
            .box-ic { color: #16a34a; }
          }
        }
      }
    }

    /* Dialog Action Footer */
    .dialog-actions {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: nowrap;
      flex-shrink: 0;
      width: 100%;
      box-sizing: border-box;

      .actions-left, .actions-right {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: nowrap;
        box-sizing: border-box;
      }

      button {
        font-weight: 600;
        border-radius: 8px;
        height: 36px;
        padding: 0 10px !important;
        min-width: unset !important;
        font-size: 0.76rem;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        box-sizing: border-box;

        mat-icon,
        ::ng-deep .mat-icon {
          font-size: 16px !important;
          width: 16px !important;
          height: 16px !important;
          margin: 0 4px 0 0 !important;
        }
      }

      .action-btn-secondary {
        color: #475569;
        border-color: #cbd5e1;
        &:hover {
          background: #f1f5f9;
          color: #1e293b;
        }
      }

      .whatsapp-ic {
        color: #16a34a;
      }

      .close-action-btn {
        color: #64748b;
        border-color: #cbd5e1;
      }

      .upi-action-btn {
        color: #15803d;
        border-color: #86efac;
        background: #f0fdf4;
        &:hover {
          background: #dcfce7;
        }
      }

      .due-slip-btn {
        color: #d97706;
        border-color: #fde68a;
        background: #fffbeb;
        &:hover {
          background: #fef3c7;
        }
      }

      .primary-action-btn {
        background: #2563eb !important;
        color: #ffffff !important;
        box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);
      }
    }

    .text-right {
      text-align: right;
    }

    /* Responsive Mobile & Small Tablet Breakpoint */
    @media (max-width: 768px) {
      .dialog-header {
        padding: 12px 14px;
        gap: 10px;

        .header-icon-wrap {
          width: 38px;
          height: 38px;
          mat-icon { font-size: 20px; width: 20px; height: 20px; }
        }

        .header-titles {
          .main-title { font-size: 1.02rem; }
          .subtitle { font-size: 0.74rem; }
        }
      }

      .dialog-content {
        padding: 12px 14px;
        gap: 12px;
      }

      .meta-deck-card {
        padding: 12px;
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
        box-sizing: border-box;

        .meta-deck-left {
          width: 100%;
          gap: 10px;
          align-items: flex-start;

          .student-avatar-box {
            width: 38px;
            height: 38px;
            font-size: 0.92rem;
          }

          .student-meta-details {
            flex: 1;
            min-width: 0;

            .student-name-row {
              min-height: 38px;
              align-content: center;
            }

            .academic-badges-row {
              margin-left: -48px;
              width: calc(100% + 48px);
              margin-top: 4px;
              gap: 5px;
              box-sizing: border-box;

              .academic-badge {
                font-size: 0.71rem;
                padding: 2px 7px;
                max-width: 100%;
                box-sizing: border-box;
              }
            }
          }
        }

        .meta-deck-right {
          align-items: center;
          flex-direction: row;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 6px;
          width: 100%;
          border-top: 1px dashed #e2e8f0;
          padding-top: 8px;
          box-sizing: border-box;
        }
      }

      .breakdown-card {
        .heads-table {
          th, td {
            padding: 8px 6px;
          }
          .th-num, .td-num {
            width: 24px;
            padding-left: 6px;
            padding-right: 2px;
          }
          .head-item-cell {
            gap: 6px;
            .head-icon-circle {
              width: 24px;
              height: 24px;
              border-radius: 6px;
              mat-icon { font-size: 14px; width: 14px; height: 14px; }
            }
            .head-names .head-name {
              font-size: 0.76rem;
            }
          }
          .cycle-note-pill {
            white-space: normal;
            font-size: 0.66rem;
            padding: 2px 5px;
            line-height: 1.25;
          }
          .amt-val {
            font-size: 0.8rem;
          }
        }
      }

      .totals-summary-grid {
        grid-template-columns: 1fr;
        gap: 8px;
      }

      .dialog-actions {
        padding: 10px 14px;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;

        .actions-left {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;

          button {
            width: 100%;
            justify-content: center;
          }
        }

        .actions-right {
          width: 100%;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;

          button {
            flex: 1 1 calc(33.333% - 6px);
            min-width: 80px !important;
            justify-content: center;
          }

          .primary-action-btn {
            flex: 1 1 100%;
            height: 40px;
            font-size: 0.85rem;
          }
        }
      }
    }
  `]
})
export class FeeInvoiceBreakdownDialogComponent implements OnInit {
  inv: FeeInvoicePagedItem;
  itemsList: CategorizedHeadItem[] = [];
  billedMonths: string[] = [];
  loadingHeads = false;

  constructor(
    public dialogRef: MatDialogRef<FeeInvoiceBreakdownDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FeeInvoiceBreakdownDialogData,
    private feesService: FeesService
  ) {
    this.inv = data.invoice;
  }

  ngOnInit(): void {
    this.billedMonths = this.parseBilledMonthsList(this.inv);
    this.itemsList = this.buildCategorizedHeads(this.inv);

    // Fallback: If invoice.items is missing or empty, fetch from student ledger
    if ((!this.itemsList || this.itemsList.length === 0) && this.inv.studentId) {
      this.loadingHeads = true;
      this.feesService.getStudentLedger(this.inv.studentId).subscribe({
        next: (ledger) => {
          this.loadingHeads = false;
          const match = ledger?.invoices?.find(
            i => i.id === this.inv.id || (i.invoiceNumber && i.invoiceNumber === this.inv.invoiceNumber)
          );
          if (match && match.items && match.items.length > 0) {
            this.inv.items = match.items;
            this.itemsList = this.buildCategorizedHeads(this.inv);
          }
        },
        error: () => {
          this.loadingHeads = false;
        }
      });
    }
  }

  getStudentInitials(name?: string): string {
    if (!name) return 'S';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  getStatusClass(status?: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'paid') return 'status-paid';
    if (s === 'partial' || s === 'partially paid') return 'status-partial';
    if (s === 'waived') return 'status-waived';
    if (s === 'cancelled') return 'status-cancelled';
    return 'status-pending';
  }

  getStatusIcon(status?: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'paid') return 'check_circle';
    if (s === 'partial' || s === 'partially paid') return 'timelapse';
    if (s === 'waived') return 'verified_user';
    if (s === 'cancelled') return 'block';
    return 'pending';
  }

  buildCategorizedHeads(inv: FeeInvoicePagedItem): CategorizedHeadItem[] {
    const rawItems = inv?.items || [];
    if (!rawItems || rawItems.length === 0) return [];

    // Sort priority
    const sorted = rawItems.slice().sort((a, b) => {
      const getPriority = (name: string): number => {
        const n = (name || '').toLowerCase();
        if (n.includes('tuition')) return 1;
        if (n.includes('exam') || n.includes('annual') || n.includes('development') || n.includes('computer')) return 2;
        if (n.includes('transport') || n.includes('bus') || n.includes('hostel') || n.includes('mess')) return 3;
        if (n.includes('coaching')) return 4;
        if (n.includes('admission') || n.includes('registration')) return 5;
        if (n.includes('kit') || n.includes('pen') || n.includes('uniform') || n.includes('dress') || n.includes('book')) return 6;
        return 7;
      };
      return getPriority(a.headName) - getPriority(b.headName);
    });

    return sorted.map((it) => {
      const n = (it.headName || '').toLowerCase();
      let icon = 'receipt';
      let iconBg = '#eff6ff';
      let iconColor = '#2563eb';
      const isTuition = n.includes('tuition');

      if (isTuition) {
        icon = 'school';
        iconBg = '#eff6ff';
        iconColor = '#1d4ed8';
      } else if (n.includes('transport') || n.includes('bus') || n.includes('van')) {
        icon = 'directions_bus';
        iconBg = '#fffbeb';
        iconColor = '#d97706';
      } else if (n.includes('coaching')) {
        icon = 'psychology';
        iconBg = '#faf5ff';
        iconColor = '#7e22ce';
      } else if (n.includes('hostel') || n.includes('room') || n.includes('mess')) {
        icon = 'hotel';
        iconBg = '#ecfdf5';
        iconColor = '#059669';
      } else if (n.includes('book') || n.includes('syllabus') || n.includes('library')) {
        icon = 'auto_stories';
        iconBg = '#faf5ff';
        iconColor = '#9333ea';
      } else if (n.includes('uniform') || n.includes('dress') || n.includes('belt') || n.includes('tie')) {
        icon = 'checkroom';
        iconBg = '#fff7ed';
        iconColor = '#ea580c';
      } else if (n.includes('admission') || n.includes('registration')) {
        icon = 'how_to_reg';
        iconBg = '#f0fdf4';
        iconColor = '#16a34a';
      } else if (n.includes('exam') || n.includes('test')) {
        icon = 'quiz';
        iconBg = '#f5f3ff';
        iconColor = '#6d28d9';
      } else if (n.includes('development') || n.includes('annual') || n.includes('activity')) {
        icon = 'apartment';
        iconBg = '#f0f9ff';
        iconColor = '#0284c7';
      }

      // Compute note
      const isKit = /(kit|pen|tie|belt|bag|uniform|dress|book|station)/i.test(n);
      let note = '';
      if (isKit) {
        note = 'One-time Kit';
      } else if (this.billedMonths.length === 1) {
        note = this.billedMonths[0];
      } else if (this.billedMonths.length > 1) {
        const shortMonths = this.billedMonths.map(m => m.split(' ')[0].substring(0, 3)).join(', ');
        const amt = Number(it.amount) || 0;
        if (amt > 0 && Math.round(amt % this.billedMonths.length) === 0) {
          const perMo = Math.round(amt / this.billedMonths.length);
          note = `${this.billedMonths.length} Mos: ${shortMonths} @ ₹${perMo.toLocaleString('en-IN')}/mo`;
        } else {
          note = `${this.billedMonths.length} Mos: ${shortMonths}`;
        }
      }

      return {
        ...it,
        headName: it.headName || 'Fee Head',
        amount: Number(it.amount) || 0,
        paidAmount: Number(it.paidAmount) || 0,
        icon,
        iconBg,
        iconColor,
        note,
        isTuition
      };
    });
  }

  parseBilledMonthsList(inv: FeeInvoicePagedItem): string[] {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    let startYear = 0;
    let startMonth = 0;
    let monthsCount = 1;

    if (inv.invoiceNumber) {
      const match = inv.invoiceNumber.match(/^INV-(?:HOSTEL-)?(\d{4})(\d{2})([QHY])?-/i);
      if (match) {
        startYear = parseInt(match[1], 10);
        startMonth = parseInt(match[2], 10);
        const cycle = (match[3] || '').toUpperCase();
        if (cycle === 'Q') monthsCount = 3;
        else if (cycle === 'H') monthsCount = 6;
        else if (cycle === 'Y') monthsCount = 12;
      }
    }

    if (startYear === 0 && inv.title) {
      const titleMatch = inv.title.match(/(\w+)\s+(\d{4})/);
      if (titleMatch) {
        const idx = monthNames.findIndex(m => m.toLowerCase().startsWith(titleMatch[1].toLowerCase()));
        if (idx >= 0) {
          startMonth = idx + 1;
          startYear = parseInt(titleMatch[2], 10);
          if (/quarterly/i.test(inv.title)) monthsCount = 3;
          else if (/half\s*-?\s*yearly/i.test(inv.title)) monthsCount = 6;
          else if (/annual|yearly/i.test(inv.title)) monthsCount = 12;
        }
      }
    }

    if (startYear > 0 && startMonth >= 1 && startMonth <= 12) {
      const result: string[] = [];
      let curM = startMonth - 1;
      let curY = startYear;
      for (let i = 0; i < monthsCount; i++) {
        result.push(`${monthNames[curM]} ${curY}`);
        curM++;
        if (curM >= 12) {
          curM = 0;
          curY++;
        }
      }
      return result;
    }

    return [];
  }

  onCollectFee(): void {
    this.dialogRef.close({ action: 'collect', invoice: this.inv });
  }

  onOpenUpi(): void {
    this.dialogRef.close({ action: 'upi', invoice: this.inv });
  }

  onOpenReceipt(): void {
    this.dialogRef.close({ action: 'receipt', invoice: this.inv });
  }

  onOpenDueSlip(): void {
    this.dialogRef.close({ action: 'due-slip', invoice: this.inv });
  }

  onOpenLedger(): void {
    this.dialogRef.close({ action: 'ledger', studentId: this.inv.studentId });
  }

  onSendWhatsApp(): void {
    this.dialogRef.close({ action: 'whatsapp', invoice: this.inv });
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
