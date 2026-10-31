import { Component, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
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

import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-student-ledger-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatTabsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  template: `
    <div class="ledger-dialog-container">
      <div class="dialog-header">
        <div class="header-icon-wrap">
          <mat-icon>menu_book</mat-icon>
        </div>
        <div class="header-titles">
          <h2 mat-dialog-title class="main-title">Student Financial Passbook & Ledger</h2>
          <p class="subtitle">Complete month-wise fee statement, arrears, and payment receipts audit trail.</p>
        </div>
        <button mat-icon-button (click)="onClose()" class="close-btn" aria-label="Close dialog">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    
      @if (ledger) {
        <div class="ledger-body">
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
                  @if (effectiveBranchName) {
                    <span class="st-sep">|</span>
                    <span class="st-branch">🏛️ Branch: <strong>{{ effectiveBranchName }}</strong></span>
                  }
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
              @if (ledger.pendingLibraryFine && ledger.pendingLibraryFine > 0) {
                <div class="metric-box lib-due-box">
                  <span class="m-label">
                    <span class="d-only">Library Fine Due:</span>
                    <span class="m-only">Lib Fine</span>
                  </span>
                  <strong class="m-value lib-fine">₹{{ ledger.pendingLibraryFine | number:'1.2-2' }}</strong>
                </div>
              }
            </div>
          </div>
          <!-- Ledger Tabs (Invoices, Receipts, Reversals) -->
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
                <div class="table-responsive">
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
                      @for (inv of ledger.invoices; track inv) {
                        <tr [class.cancelled-row]="inv.status === 'Cancelled'">
                          <td class="nowrap-col"><strong>{{ inv.invoiceNumber }}</strong></td>
                          <td>
                            <div class="billing-period-pill">
                              <mat-icon class="cal-mini-icon">calendar_month</mat-icon>
                              <span class="period-title-text">{{ inv.title }}</span>
                              @if (getShortMonthsSummary(inv); as shortSummary) {
                                <span class="period-months-detail">({{ shortSummary }})</span>
                              }
                            </div>
                            @if (inv.items && inv.items.length > 0) {
                              <div class="mini-heads-row">
                                @for (it of getSortedInvoiceItems(inv.items); track it) {
                                  <span class="mini-head-chip" [class.tuition-head-chip]="isTuitionHead(it.headName)">
                                    <span class="chip-head-name">{{ it.headName }}:</span>
                                    <strong class="chip-head-amt">₹{{ it.amount | number:'1.0-0' }}</strong>
                                    @if (getHeadMonthNote(it, inv); as note) {
                                      <span class="chip-month-tag">({{ note }})</span>
                                    }
                                  </span>
                                }
                              </div>
                            }
                            @if (inv.status === 'Cancelled') {
                              <span class="cancelled-label" [matTooltip]="'Cancelled' + (inv.cancelledAt ? ' on ' + (inv.cancelledAt | date:'mediumDate') : '') + (inv.cancellationReason ? ' | Reason: ' + inv.cancellationReason : '')">VOID</span>
                            }
                            @if (inv.cancellationReason && inv.cancellationReason.includes('[BALANCE WAIVED & SETTLED]')) {
                              <span class="settled-waiver-label" [matTooltip]="inv.cancellationReason">WAIVED &amp; SETTLED</span>
                            }
                          </td>
                          <td class="nowrap-col">{{ inv.dueDate | date:'mediumDate' }}</td>
                          <td class="text-right amount-col nowrap-col">{{ inv.status === 'Cancelled' ? '—' : ('₹' + (inv.totalAmount | number:'1.2-2')) }}</td>
                          <td class="text-right text-success amount-col nowrap-col">{{ inv.status === 'Cancelled' ? '—' : ('₹' + (inv.paidAmount | number:'1.2-2')) }}</td>
                          <td class="text-right text-danger amount-col nowrap-col">
                            <strong>{{ inv.status === 'Cancelled' ? '—' : ('₹' + (inv.dueAmount | number:'1.2-2')) }}</strong>
                          </td>
                          <td class="text-center nowrap-col">
                            @if (inv.cancellationReason && inv.cancellationReason.includes('[BALANCE WAIVED & SETTLED]')) {
                              <span class="status-badge settled" [matTooltip]="inv.cancellationReason">
                                Settled (Waived)
                              </span>
                            }
                            @if (!inv.cancellationReason || !inv.cancellationReason.includes('[BALANCE WAIVED & SETTLED]')) {
                              <span class="status-badge" [ngClass]="inv.status.toLowerCase()" [matTooltip]="inv.status === 'Cancelled' ? ('Cancelled' + (inv.cancelledAt ? ' on ' + (inv.cancelledAt | date:'mediumDate') : '') + (inv.cancellationReason ? ' | Reason: ' + inv.cancellationReason : '')) : ''">
                                {{ inv.status }}
                              </span>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <div class="tab-bottom-spacer"></div>
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
                <!-- DEDICATED REVERSAL WORKFLOW CARD OUTSIDE HORIZONTAL SCROLL -->
                @if (reversingPayment) {
                  <div class="reverse-confirm-box" #reversalBoxRef>
                    <div class="rev-header-bar">
                      <div class="rev-title-group">
                        <mat-icon class="rev-warn-icon">warning_amber</mat-icon>
                        <div class="rev-confirm-title">
                          <strong>Reverse Payment Receipt: {{ reversingPayment.receiptNumber }} (₹{{ reversingPayment.amountPaid | number:'1.2-2' }})</strong>
                          <span>{{ reversalLang === 'HI' ? 'रिवर्स करने का प्रकार और विवरण चुनें' : 'Choose reversal action and audit details' }}</span>
                        </div>
                      </div>
                      <div class="lang-toggle-pill" (click)="toggleLanguage()" [matTooltip]="reversalLang === 'EN' ? 'हिंदी में देखने के लिए क्लिक करें' : 'Switch to English'">
                        <mat-icon class="lang-icon">translate</mat-icon>
                        <span [class.active]="reversalLang === 'EN'">EN</span>
                        <span class="sep">/</span>
                        <span [class.active]="reversalLang === 'HI'">HI</span>
                      </div>
                    </div>
                    <!-- Options Selector Cards -->
                    <div class="rev-options-grid">
                      <div
                        class="rev-option-card"
                        [class.selected]="reversalTypeControl.value === 'ClericalCorrection'"
                        (click)="setReversalType('ClericalCorrection')"
                        >
                        <div class="card-radio">
                          <mat-icon>{{ reversalTypeControl.value === 'ClericalCorrection' ? 'radio_button_checked' : 'radio_button_unchecked' }}</mat-icon>
                        </div>
                        <div class="card-body">
                          <div class="card-title">{{ reversalLang === 'HI' ? '1. गलत प्रविष्टि सुधार (Clerical Typo / Void)' : '1. Clerical Error / Void Entry' }}</div>
                          <div class="card-desc">{{ reversalLang === 'HI' ? 'पैसे किसी को वापस नहीं दिए गए। केवल गलत एंट्री हटाई जा रही है और छात्र का इनवॉइस बकाया बहाल किया जाएगा।' : 'No money returned to anyone. Just removing wrongful clerk entry and restoring student invoice due balance.' }}</div>
                        </div>
                      </div>
                      <div
                        class="rev-option-card"
                        [class.selected]="reversalTypeControl.value === 'RefundToParent'"
                        (click)="setReversalType('RefundToParent')"
                        >
                        <div class="card-radio">
                          <mat-icon>{{ reversalTypeControl.value === 'RefundToParent' ? 'radio_button_checked' : 'radio_button_unchecked' }}</mat-icon>
                        </div>
                        <div class="card-body">
                          <div class="card-title">{{ reversalLang === 'HI' ? '2. अभिभावक को नकद/बैंक रिफंड (Refund to Parent)' : '2. Actual Fee Refund to Parent' }}</div>
                          <div class="card-desc">{{ reversalLang === 'HI' ? ('₹' + (reversingPayment.amountPaid | number:'1.2-2') + ' अभिभावक को वापस लौटाए गए। Day Book में भुगतान वापसी (Outflow) दर्ज होगी।') : ('₹' + (reversingPayment.amountPaid | number:'1.2-2') + ' returned to parent. An Outflow refund voucher will be recorded in Day Book.') }}</div>
                        </div>
                      </div>
                    </div>
                    <!-- Refund Fields (shown only when RefundToParent selected) -->
                    @if (reversalTypeControl.value === 'RefundToParent') {
                      <div class="rev-fields-row">
                        <mat-form-field appearance="outline" class="density-compact rev-field">
                          <mat-label>{{ reversalLang === 'HI' ? 'रिफंड पेमेंट मोड' : 'Refund Payment Mode' }}</mat-label>
                          <mat-select [formControl]="reversalRefundModeControl">
                            <mat-option value="Cash">{{ reversalLang === 'HI' ? 'Cash (नकद गल्ले से)' : 'Cash (Counter Drawer)' }}</mat-option>
                            <mat-option value="BankTransfer">{{ reversalLang === 'HI' ? 'Bank Transfer / NEFT' : 'Bank Transfer / NEFT' }}</mat-option>
                            <mat-option value="UPI">{{ reversalLang === 'HI' ? 'UPI / Online' : 'UPI (Google Pay / PhonePe)' }}</mat-option>
                          </mat-select>
                        </mat-form-field>
                        <mat-form-field appearance="outline" class="density-compact rev-field">
                          <mat-label>{{ reversalLang === 'HI' ? 'रिफंड प्राप्तकर्ता (अभिभावक/छात्र)' : 'Refunded To (Parent / Student Name)' }}</mat-label>
                          <input matInput [formControl]="reversalRecipientControl" [placeholder]="reversalLang === 'HI' ? 'अभिभावक या छात्र का नाम' : 'Parent or Student Name'" />
                        </mat-form-field>
                      </div>
                    }
                    <!-- Reason Field -->
                    <div class="rev-reason-row">
                      <mat-form-field appearance="outline" class="density-compact reason-field">
                        <mat-label>{{ reversalLang === 'HI' ? 'रिवर्स करने का कारण / रिमार्क्स' : 'Reversal Reason / Remarks' }}</mat-label>
                        <input matInput [formControl]="reversalReasonControl" [placeholder]="reversalLang === 'HI' ? 'जैसे: गलत छात्र पर एंट्री हो गई थी / छात्र ने नाम वापस लिया' : 'e.g. Wrong student selected / Admission withdrawn by parent'" />
                      </mat-form-field>
                    </div>
                    <div class="rev-confirm-actions">
                      <button mat-stroked-button (click)="cancelReverse()" [disabled]="reversingInProgress" class="btn-cancel-rev">
                        {{ reversalLang === 'HI' ? 'रद्द करें (Cancel)' : 'Cancel' }}
                      </button>
                      <button mat-raised-button color="warn" (click)="confirmReversePayment(reversingPayment)" [disabled]="reversingInProgress" class="btn-confirm-rev">
                        @if (!reversingInProgress) {
                          <mat-icon>undo</mat-icon>
                        }
                        @if (reversingInProgress) {
                          <mat-icon class="spinning-icon">sync</mat-icon>
                        }
                        <span>
                          {{ reversingInProgress
                          ? (reversalLang === 'HI' ? 'प्रोसेसिंग...' : 'Processing...')
                          : (reversalTypeControl.value === 'RefundToParent'
                          ? (reversalLang === 'HI' ? 'रिफंड और रिवर्स कन्फर्म करें' : 'Confirm Refund & Reverse')
                          : (reversalLang === 'HI' ? 'रिवर्स कन्फर्म करें' : 'Confirm Void & Reverse')) }}
                        </span>
                      </button>
                    </div>
                  </div>
                }
                <div class="mobile-swipe-hint">
                  <mat-icon>swipe_left</mat-icon>
                  <span>Swipe horizontally to view full table details</span>
                </div>
                <div class="table-responsive">
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
                      @for (p of ledger.payments; track p) {
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
                            @if (reversingPaymentId !== p.paymentId) {
                              <button
                                mat-icon-button
                                color="warn"
                                (click)="startReversePayment(p)"
                                matTooltip="Reverse / Undo this payment"
                                >
                                <mat-icon>undo</mat-icon>
                              </button>
                            }
                            @if (reversingPaymentId === p.paymentId) {
                              <button
                                mat-icon-button
                                color="warn"
                                (click)="cancelReverse()"
                                matTooltip="Cancel reversal"
                                >
                                <mat-icon>close</mat-icon>
                              </button>
                            }
                          </td>
                        </tr>
                      }
                      @if (ledger.payments.length === 0) {
                        <tr>
                          <td colspan="8" class="text-center empty-cell">No active payment receipts found.</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <div class="tab-bottom-spacer"></div>
              </div>
            </mat-tab>
            <!-- Tab 3: Reversed / Refunded Receipts History -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-label-icon text-warn">assignment_return</mat-icon>
                <span class="tab-label-desktop">Reversed & Refunded History ({{ ledger.reversedPayments?.length || 0 }})</span>
                <span class="tab-label-mobile">Reversals ({{ ledger.reversedPayments?.length || 0 }})</span>
              </ng-template>
              <div class="tab-content">
                <div class="mobile-swipe-hint">
                  <mat-icon>swipe_left</mat-icon>
                  <span>Swipe horizontally to view full table details</span>
                </div>
                <div class="table-responsive">
                  <table class="ledger-table reversed-table">
                    <thead>
                      <tr>
                        <th class="nowrap-col text-left">Receipt No</th>
                        <th class="nowrap-col text-left">Original Paid Date</th>
                        <th class="nowrap-col text-left">Invoice Ref</th>
                        <th class="text-right nowrap-col">Amount (₹)</th>
                        <th class="nowrap-col text-left">Action / Type</th>
                        <th class="nowrap-col text-left">Recipient & Mode</th>
                        <th class="nowrap-col text-left">Reversed At (IST)</th>
                        <th class="nowrap-col text-left">Reversed By</th>
                        <th class="text-left">Reason / Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (rp of ledger.reversedPayments; track rp) {
                        <tr>
                          <td class="nowrap-col">
                            <span class="strikethrough-receipt">{{ rp.receiptNumber }}</span>
                          </td>
                          <td class="nowrap-col date-col">{{ formatToIST(rp.paymentDate) }}</td>
                          <td class="nowrap-col inv-ref-text">{{ rp.invoiceNumber || '—' }}</td>
                          <td class="text-right nowrap-col">
                            <strong class="strikethrough-amount">₹{{ rp.amountPaid | number:'1.2-2' }}</strong>
                          </td>
                          <td class="nowrap-col">
                            <span class="reversal-type-badge" [class.is-refund]="rp.reversalType === 'RefundToParent'">
                              <mat-icon class="rev-type-icon">{{ rp.reversalType === 'RefundToParent' ? 'payments' : 'cancel' }}</mat-icon>
                              <span>{{ rp.reversalType === 'RefundToParent' ? 'Refunded to Parent' : 'Clerical Void' }}</span>
                            </span>
                          </td>
                          <td class="nowrap-col">
                            <div class="recipient-cell">
                              <span class="recip-name">{{ rp.refundRecipient || '—' }}</span>
                              @if (rp.refundMode) {
                                <small class="recip-mode">({{ rp.refundMode }})</small>
                              }
                            </div>
                          </td>
                          <td class="nowrap-col date-col">{{ rp.reversedAt ? formatToIST(rp.reversedAt) : '—' }}</td>
                          <td class="nowrap-col user-col">
                            <span class="user-pill">{{ rp.reversedBy || 'Admin' }}</span>
                          </td>
                          <td class="remarks-cell">
                            <small class="reversal-reason-text">{{ rp.reversalReason || 'Reversed by admin' }}</small>
                          </td>
                        </tr>
                      }
                      @if (!ledger.reversedPayments || ledger.reversedPayments.length === 0) {
                        <tr>
                          <td colspan="9" class="text-center empty-cell">No reversed or refunded payment records found.</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <div class="tab-bottom-spacer"></div>
              </div>
            </mat-tab>
          </mat-tab-group>
        </div>
      }
    
      <div class="dialog-actions">
        @if (ledger && ledger.totalOutstandingDue > 0) {
          <button mat-stroked-button color="warn" (click)="openDueSlip()" class="btn-due-slip">
            <mat-icon>receipt_long</mat-icon>
            <span class="btn-text-full">Print Due Slip (बकाया पर्ची)</span>
            <span class="btn-text-short">Due Slip</span>
          </button>
        }
        @if (ledger && ledger.totalOutstandingDue > 0) {
          <button mat-stroked-button color="primary" (click)="collectFeeModal()" class="btn-collect">
            <mat-icon>payments</mat-icon>
            <span>Collect Fee</span>
          </button>
        }
        <button mat-raised-button color="primary" (click)="onClose()" class="btn-done">
          Done
        </button>
      </div>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .ledger-dialog-container {
      padding: 16px 20px;
      max-width: 1240px;
      width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      overflow: hidden;

      @media (min-width: 1200px) {
        min-width: 1160px;
      }
      @media (max-width: 1199px) and (min-width: 768px) {
        min-width: 740px;
        padding: 16px;
      }
      @media (max-width: 767px) {
        min-width: auto;
        padding: 10px 12px;
        max-height: 96vh;
        height: 96vh;
      }
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 18px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      border-top-left-radius: 12px;
      border-top-right-radius: 12px;
      margin: -16px -20px 14px -20px;
      flex-shrink: 0;

      .header-icon-wrap {
        width: 42px;
        height: 42px;
        border-radius: 10px;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
        flex-shrink: 0;
        mat-icon { font-size: 22px; width: 22px; height: 22px; }
      }

      .header-titles {
        flex: 1;
        min-width: 0;
        .main-title {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.25;
        }
        .subtitle {
          margin: 2px 0 0 0;
          font-size: 0.78rem;
          color: #3b82f6;
        }
      }

      .close-btn {
        color: #64748b;
        &:hover { color: #1e293b; background: rgba(0,0,0,0.04); }
        flex-shrink: 0;
      }

      @media (max-width: 768px) {
        padding: 10px 12px;
        gap: 10px;
        margin: -10px -12px 10px -12px;

        .header-icon-wrap {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
        }
        .header-titles {
          .main-title { font-size: 0.98rem; }
          .subtitle { display: none; }
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
        min-width: 0;

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
          .st-name { margin: 0; font-size: 1.05rem; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .st-meta-row {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.8rem;
            color: #475569;
            flex-wrap: wrap;
            .st-sep { color: #cbd5e1; }
            .st-branch { color: #1e40af; font-weight: 500; }
          }
          .st-parent { font-size: 0.76rem; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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

      ::ng-deep .mat-mdc-tab-body-wrapper {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden !important;
      }

      ::ng-deep .mat-mdc-tab-body {
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden !important;
      }

      ::ng-deep .mat-mdc-tab-body-content {
        height: 100% !important;
        overflow: hidden !important;
      }

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
        .tab-label-mobile { display: inline; font-size: 0.8rem; font-weight: 600; }
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
      padding-bottom: 28px !important;
      flex: 1 1 auto;
      max-height: 52vh;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      -webkit-overflow-scrolling: touch;
      scroll-behavior: smooth;
      box-sizing: border-box;

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

      @media (max-width: 768px) {
        max-height: 48vh;
        padding-top: 4px;
        padding-bottom: 24px !important;
      }
    }

    .tab-bottom-spacer {
      height: 48px;
      min-height: 48px;
      width: 100%;
      display: block;
      flex-shrink: 0;
    }

    .table-responsive {
      width: 100%;
      overflow-x: auto !important;
      overflow-y: visible !important;
      -webkit-overflow-scrolling: touch;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      box-sizing: border-box;
      margin-bottom: 12px;

      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 #f8fafc;

      &::-webkit-scrollbar {
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

      .billing-period-pill {
        display: inline-flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 600;
        color: #1e293b;
        cursor: default;
        margin-bottom: 3px;

        .cal-mini-icon {
          font-size: 15px;
          width: 15px;
          height: 15px;
          color: #2563eb;
        }

        .period-months-detail {
          font-size: 0.72rem;
          color: #1d4ed8;
          font-weight: 700;
          background: #eff6ff;
          padding: 1px 6px;
          border-radius: 4px;
          border: 1px solid #bfdbfe;
        }
      }

      .mini-heads-row {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 4px;

        .mini-head-chip {
          font-size: 0.72rem;
          background: #f0fdf4;
          color: #166534;
          border: 1px solid #bbf7d0;
          padding: 2px 7px;
          border-radius: 6px;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);

          .chip-head-name {
            color: #334155;
            font-weight: 600;
          }
          .chip-head-amt {
            color: #0f172a;
            font-weight: 700;
          }
          .chip-month-tag {
            font-size: 0.68rem;
            color: #0284c7;
            font-weight: 600;
            background: #f0f9ff;
            padding: 1px 5px;
            border-radius: 4px;
            border: 1px solid #bae6fd;
          }

          &.tuition-head-chip {
            background: #eff6ff;
            border-color: #bfdbfe;
            color: #1e40af;

            .chip-head-name {
              color: #1e3a8a;
              font-weight: 700;
            }
            .chip-head-amt {
              color: #1e40af;
              font-weight: 800;
            }
            .chip-month-tag {
              background: #dbeafe;
              color: #1d4ed8;
              border-color: #bfdbfe;
            }
          }
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
      &.settled   { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
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
    .settled-waiver-label {
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #bfdbfe;
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
      align-items: center;
      gap: 10px;
      margin-top: 10px;
      padding-top: 12px;
      padding-bottom: 4px;
      border-top: 1px solid #e2e8f0;
      flex-shrink: 0;
      background: #ffffff;
      position: relative;
      z-index: 10;

      .btn-text-short { display: none; }
      .btn-text-full { display: inline; }

      @media (max-width: 600px) {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 6px;
        padding-top: 6px;

        .btn-text-full { display: none; }
        .btn-text-short { display: inline; }

        button {
          width: 100%;
          justify-content: center;
          font-size: 0.8rem;
          padding: 0 8px;
          height: 38px;
        }

        .btn-done {
          grid-column: span 2;
        }
      }
    }

    .reversing-row td {
      background: #fff7ed !important;
      border-top: 1px solid #fdba74;
      border-bottom: 1px solid #fdba74;
    }

    /* Dedicated Reversal Confirmation Workflow Card */
    .reverse-confirm-box {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px 16px;
      background: #fff7ed;
      border: 1.5px solid #fed7aa;
      border-radius: 10px;
      margin-bottom: 12px;
      width: 100%;
      box-sizing: border-box;
      box-shadow: 0 4px 12px rgba(234, 88, 12, 0.08);

      @media (max-width: 768px) {
        padding: 10px 12px;
        gap: 8px;
        margin-bottom: 8px;
      }

      .rev-header-bar {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        width: 100%;

        .rev-title-group {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          flex: 1;
          min-width: 0;

          .rev-warn-icon {
            color: #ea580c;
            font-size: 22px;
            width: 22px;
            height: 22px;
            flex-shrink: 0;
            margin-top: 2px;
          }

          .rev-confirm-title {
            display: flex;
            flex-direction: column;
            gap: 2px;
            flex: 1;
            min-width: 0;

            strong {
              font-size: 0.92rem;
              color: #9a3412;
              word-break: break-word;
            }

            span {
              font-size: 0.76rem;
              color: #c2410c;
              word-break: break-word;
            }
          }
        }

        .lang-toggle-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          background: #ffffff;
          border: 1.5px solid #fed7aa;
          border-radius: 20px;
          font-size: 0.72rem;
          cursor: pointer;
          user-select: none;
          transition: all 0.2s ease;
          flex-shrink: 0;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);

          &:hover {
            border-color: #ea580c;
            background: #fffaf5;
          }

          .lang-icon {
            font-size: 13px;
            width: 13px;
            height: 13px;
            color: #ea580c;
          }

          span {
            color: #64748b;
            font-weight: 500;

            &.active {
              color: #ea580c;
              font-weight: 700;
            }
          }

          .sep {
            color: #cbd5e1;
            font-size: 0.68rem;
          }
        }
      }

      .rev-options-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        width: 100%;
        box-sizing: border-box;

        @media (max-width: 768px) {
          grid-template-columns: 1fr;
          gap: 6px;
        }
      }

      .rev-option-card {
        display: flex;
        gap: 10px;
        padding: 9px 12px;
        background: #ffffff;
        border: 1.5px solid #fed7aa;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-sizing: border-box;
        width: 100%;
        min-width: 0;

        &:hover {
          border-color: #f97316;
          background: #fffaf5;
        }

        &.selected {
          border-color: #ea580c;
          background: #ffffff;
          box-shadow: 0 0 0 1px #ea580c;

          .card-radio mat-icon {
            color: #ea580c;
          }
          .card-title {
            color: #9a3412;
            font-weight: 700;
          }
        }

        .card-radio mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
          color: #94a3b8;
          margin-top: 1px;
          flex-shrink: 0;
        }

        .card-body {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          min-width: 0;

          .card-title {
            font-size: 0.82rem;
            font-weight: 600;
            color: #334155;
            word-break: break-word;
          }

          .card-desc {
            font-size: 0.73rem;
            color: #64748b;
            line-height: 1.32;
            word-break: break-word;
          }
        }
      }

      .rev-fields-row {
        display: grid;
        grid-template-columns: 1fr 1.5fr;
        gap: 10px;
        margin-top: 2px;
        width: 100%;
        box-sizing: border-box;

        @media (max-width: 768px) {
          grid-template-columns: 1fr;
          gap: 6px;
        }
      }

      .rev-reason-row {
        width: 100%;
        margin-top: 2px;
        box-sizing: border-box;
      }

      .density-compact {
        width: 100%;
        margin-bottom: 0;

        ::ng-deep .mat-mdc-form-field-subscript-wrapper {
          display: none;
        }
      }

      .rev-confirm-actions {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 10px;
        margin-top: 6px;
        padding-top: 8px;
        border-top: 1px dashed #fed7aa;
        width: 100%;
        box-sizing: border-box;

        @media (max-width: 600px) {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 8px;

          button {
            width: 100%;
            justify-content: center;
            height: 38px;
            font-size: 0.82rem;
            padding: 0 10px;
          }
        }
      }

      .spinning-icon {
        animation: spin 1s linear infinite;
        display: inline-block;
      }
      @keyframes spin {
        100% { transform: rotate(360deg); }
      }
    }

    /* Reversed Table Styles */
    .reversed-table {
      .strikethrough-receipt {
        text-decoration: line-through;
        color: #94a3b8;
        font-weight: 600;
      }

      .strikethrough-amount {
        text-decoration: line-through;
        color: #ef4444;
        font-size: 0.95rem;
      }

      .reversal-type-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #cbd5e1;

        .rev-type-icon {
          font-size: 15px;
          width: 15px;
          height: 15px;
        }

        &.is-refund {
          background: #ecfdf5;
          color: #065f46;
          border-color: #a7f3d0;
        }
      }

      .recipient-cell {
        display: flex;
        flex-direction: column;

        .recip-name {
          font-weight: 600;
          color: #1e293b;
        }

        .recip-mode {
          color: #64748b;
          font-size: 0.72rem;
        }
      }

      .user-pill {
        display: inline-block;
        padding: 2px 7px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        font-size: 0.75rem;
        color: #334155;
        font-weight: 600;
      }

      .reversal-reason-text {
        color: #475569;
        font-style: italic;
      }
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 10px;
      padding-top: 14px;
      margin-top: 4px;
      border-top: 1px solid #e2e8f0;
      flex-shrink: 0;

      .btn-due-slip {
        .btn-text-full { display: inline; }
        .btn-text-short { display: none; }
      }

      @media (max-width: 640px) {
        gap: 6px;
        padding-top: 10px;

        .btn-due-slip {
          .btn-text-full { display: none; }
          .btn-text-short { display: inline; }
        }
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

  get reversingPayment(): StudentLedgerPaymentItem | undefined {
    return this.ledger?.payments?.find(p => p.paymentId === this.reversingPaymentId);
  }

  reversalLang: 'EN' | 'HI' = 'EN';
  reversalTypeControl = new FormControl<'ClericalCorrection' | 'RefundToParent'>('ClericalCorrection', { nonNullable: true });
  reversalRefundModeControl = new FormControl<'Cash' | 'BankTransfer' | 'UPI'>('Cash', { nonNullable: true });
  reversalRecipientControl = new FormControl<string>('', { nonNullable: true });
  reversalReasonControl = new FormControl<string>('', { nonNullable: true });

  toggleLanguage(): void {
    this.reversalLang = this.reversalLang === 'EN' ? 'HI' : 'EN';
  }

  setReversalType(type: 'ClericalCorrection' | 'RefundToParent'): void {
    this.reversalTypeControl.setValue(type);
  }

  get effectiveBranchName(): string {
    if (this.ledger?.branchName) return this.ledger.branchName;
    const authBranch = this.authService.getCurrentBranchName();
    if (authBranch) return authBranch;
    const batch = this.ledger?.batchName || '';
    const match = batch.match(/\(([^)]+)\)/);
    if (match) return match[1];
    return 'Main Branch';
  }

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
    this.reversalLang = 'EN';
    this.reversalTypeControl.setValue('ClericalCorrection');
    const modeNum = Number(payment.mode);
    this.reversalRefundModeControl.setValue(modeNum === 0 ? 'Cash' : (modeNum === 1 ? 'UPI' : 'BankTransfer'));
    const defaultRecipient = this.ledger?.parentName ? `${this.ledger.parentName} (Parent)` : (this.ledger?.studentName || 'Parent / Student');
    this.reversalRecipientControl.setValue(defaultRecipient);
    this.reversalReasonControl.setValue('');

    setTimeout(() => {
      const el = document.querySelector('.reverse-confirm-box');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 60);
  }

  cancelReverse(): void {
    this.reversingPaymentId = null;
    this.reversingInProgress = false;
  }

  confirmReversePayment(payment: StudentLedgerPaymentItem): void {
    if (this.reversingInProgress) return;
    this.reversingInProgress = true;
    this.loading = true;

    const revType = this.reversalTypeControl.value;
    const refMode = this.reversalRefundModeControl.value;
    const recipient = this.reversalRecipientControl.value.trim();
    const reasonText = this.reversalReasonControl.value.trim() || 
      (revType === 'RefundToParent' ? `Fee refund of ₹${payment.amountPaid.toFixed(2)} paid to parent` : 'Clerical correction / wrongful receipt voided');

    this.feesService.reversePayment(
      payment.paymentId,
      reasonText,
      revType,
      refMode,
      revType === 'RefundToParent' ? recipient : undefined,
      undefined
    ).subscribe({
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
  isTuitionHead(headName?: string): boolean {
    return !!headName && /tuition/i.test(headName);
  }

  getSortedInvoiceItems(items?: any[]): any[] {
    if (!items || items.length === 0) return [];
    return items.slice().sort((a, b) => {
      const getPriority = (name: string): number => {
        const n = (name || '').toLowerCase();
        if (n.includes('tuition')) return 1;
        if (n.includes('computer') || n.includes('exam') || n.includes('annual') || n.includes('library') || n.includes('activity') || n.includes('development')) return 2;
        if (n.includes('hostel') || n.includes('transport') || n.includes('bus') || n.includes('mess')) return 3;
        if (n.includes('kit') || n.includes('pen') || n.includes('uniform') || n.includes('dress') || n.includes('tie') || n.includes('belt') || n.includes('bag') || n.includes('book') || n.includes('station')) return 5;
        return 4;
      };
      return getPriority(a.headName) - getPriority(b.headName);
    });
  }

  getBilledMonthsList(inv: any): string[] {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    let startYear = 0;
    let startMonth = 0; // 1-12
    let monthsCount = 1;

    // A. Parse from InvoiceNumber: e.g. INV-202605Q-853 or INV-HOSTEL-202610-123
    if (inv?.invoiceNumber) {
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

    // B. Check Title: e.g. "May 2026 – July 2026 Fee (Quarterly)"
    if (inv?.title) {
      if (/quarterly/i.test(inv.title)) monthsCount = 3;
      else if (/half\s*-?\s*yearly/i.test(inv.title)) monthsCount = 6;
      else if (/annual|yearly/i.test(inv.title)) monthsCount = 12;

      if (!startMonth) {
        for (let i = 0; i < monthNames.length; i++) {
          if (new RegExp(`\\b${monthNames[i]}\\b`, 'i').test(inv.title)) {
            startMonth = i + 1;
            break;
          }
        }
      }

      if (!startYear) {
        const yearMatch = inv.title.match(/\b(20\d{2})\b/);
        if (yearMatch) {
          startYear = parseInt(yearMatch[1], 10);
        }
      }
    }

    // C. Fallback to DueDate or CreatedAt
    if (!startMonth) {
      const refDate = inv?.dueDate ? new Date(inv.dueDate) : (inv?.createdAt ? new Date(inv.createdAt) : new Date());
      startYear = refDate.getFullYear();
      startMonth = refDate.getMonth() + 1;
    }
    if (!startYear) startYear = new Date().getFullYear();

    const result: string[] = [];
    for (let i = 0; i < monthsCount; i++) {
      const d = new Date(startYear, startMonth - 1 + i, 1);
      result.push(d.toLocaleString('en-IN', { month: 'long', year: 'numeric' }));
    }
    return result;
  }

  getShortMonthsSummary(inv: any): string {
    const months = this.getBilledMonthsList(inv);
    if (!months || months.length === 0) return '';
    if (months.length === 1) return months[0];
    const shortNames = months.map(m => m.split(' ')[0].substring(0, 3));
    return `${months.length} Months: ${shortNames.join(', ')}`;
  }

  getHeadMonthNote(it: any, inv: any): string {
    if (!it) return '';
    const name = (it.headName || '').toLowerCase();
    const isKit = /(kit|pen|tie|belt|bag|uniform|dress|book|station)/i.test(name);
    if (isKit) {
      return 'One-time Kit Item';
    }

    const months = this.getBilledMonthsList(inv);
    if (!months || months.length === 0) return '';

    if (months.length === 1) {
      return months[0];
    }

    const shortNames = months.map(m => m.split(' ')[0].substring(0, 3)).join(', ');
    if (it.amount > 0 && Math.round(it.amount % months.length) === 0) {
      const perMo = Math.round(it.amount / months.length);
      return `${months.length} Mos: ${shortNames} @ ₹${perMo.toLocaleString('en-IN')}/mo`;
    }

    return `${months.length} Mos: ${shortNames}`;
  }

  getInvoiceBillingTooltip(inv: any): string {
    if (!inv) return '';
    const lines: string[] = [];

    const months = this.getBilledMonthsList(inv);
    if (months.length > 0) {
      lines.push(months.length > 1 ? `🗓️ Billed Months (${months.length} Months):` : '🗓️ Billed Month:');
      months.forEach((m, idx) => {
        lines.push(`  ${idx + 1}. ${m}`);
      });
      lines.push('');
    }

    const sortedItems = this.getSortedInvoiceItems(inv.items);
    if (sortedItems.length > 0) {
      lines.push('📋 Fee Heads Breakdown:');
      sortedItems.forEach((it, idx) => {
        const note = this.getHeadMonthNote(it, inv);
        const noteStr = note ? ` (${note})` : '';
        lines.push(`  ${idx + 1}. ${it.headName}: ₹${Math.round(it.amount).toLocaleString('en-IN')}${noteStr}`);
      });
      lines.push('────────────────────────');
      if (inv.totalAmount !== undefined) {
        lines.push(`Total Fee: ₹${Math.round(inv.totalAmount).toLocaleString('en-IN')}`);
      }
      if (inv.paidAmount > 0) {
        lines.push(`Paid: ₹${Math.round(inv.paidAmount).toLocaleString('en-IN')}`);
      }
      if (inv.dueAmount !== undefined) {
        lines.push(`Balance Due: ₹${Math.round(inv.dueAmount).toLocaleString('en-IN')}`);
      }
    }

    return lines.join('\n');
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
      width: '740px',
      maxWidth: '96vw',
      data: {
        studentId: this.ledger.studentId,
        studentName: this.ledger.studentName,
        rollNumber: this.ledger.rollNumber,
        batchName: this.ledger.batchName,
        parentWhatsAppPhone: this.ledger.parentWhatsAppPhone,
        totalOutstandingDue: this.ledger.totalOutstandingDue,
        branchName: this.effectiveBranchName
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
            instituteName: this.authService.currentUser()?.instituteName || 'Apex Coaching Academy',
            branchName: this.effectiveBranchName
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

  onClose(): void {
    this.dialogRef.close({ refreshed: this.hasReversedPayment });
  }
}
