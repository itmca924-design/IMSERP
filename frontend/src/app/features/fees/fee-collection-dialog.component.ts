import { Component, Inject, OnInit, ElementRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import * as QRCode from '../../shared/utils/qr-code';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { FeesService, StudentLibraryDues, FeeInvoiceItem, FeeItemPayment } from '../../core/services/fees.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { QuickSettingsService } from '../../core/services/quick-settings.service';
import { AuthService } from '../../core/services/auth.service';

export interface FeeDialogData {
  studentId: string;
  studentName: string;
  rollNumber: string;
  batchName: string;
  className?: string | null;
  sectionName?: string | null;
  parentWhatsAppPhone: string;
  totalOutstandingDue: number;
  initialAmount?: number;
  selectedInvoicesCount?: number;
  selectedInvoicesDetails?: string;
  hostelInfo?: string;
  branchName?: string;
  items?: FeeInvoiceItem[];
  invoiceDueDate?: string;
  invoiceTitle?: string;
  isHybrid?: boolean;
}

export interface FeeCollectionItemRow {
  id: string;
  headName: string;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  selected: boolean;
  payingAmount: number;
  invoiceId?: string;
  invoiceTitle?: string;
  concessionAmount?: number;
  concessionLabel?: string;
}

export interface AdvanceMonthOption {
  monthCount: number;
  label: string;
  badgeLabel: string;
  periodSummary: string;
  monthsList: { year: number; month: number; monthName: string; dueDate: string }[];
  totalAmount: number;
}

@Component({
  selector: 'app-fee-collection-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <div class="dialog-header-wrap">
      <div class="header-icon-box">
        <mat-icon>payments</mat-icon>
      </div>
      <div class="header-titles">
        <h2 mat-dialog-title class="dialog-header">Collect Fee &amp; Settle Dues</h2>
        <p class="dialog-sub">Itemized Fee Heads Settlement &amp; Official Receipt Generation</p>
      </div>
      <button type="button" class="close-x-btn" (click)="onCancel()" [disabled]="saving" matTooltip="Close" mat-icon-button>
        <mat-icon>close</mat-icon>
      </button>
    </div>
    
    <form [formGroup]="feeForm" (ngSubmit)="onSubmit()" class="collection-form">
      <mat-dialog-content class="dialog-content">
        <!-- Student Info Header Card -->
        <div class="student-info-box">
          <div class="info-details">
            <span class="st-name">{{ data.studentName }} ({{ data.rollNumber }})</span>
            <span class="st-sub">
              @if (isHybrid) {
                <span class="st-hybrid-chip" matTooltip="Hybrid Enrolled (School + Coaching Consolidated)">
                  School + Coaching (Hybrid)
                </span>
              }
              @if (data.className) {
                <span class="st-school-chip">
                  🏫 {{ data.className }}@if (data.sectionName) {
                  <span> ({{ data.sectionName }})</span>
                }
              </span>
            }
            @if (data.className && data.batchName) {
              <span class="st-sep">•</span>
            }
            @if (data.batchName) {
              <span class="st-batch-chip">
                🎯 {{ data.batchName }}
              </span>
            }
            @if (effectiveBranchName) {
              <span class="st-branch-chip">
                🏛️ {{ effectiveBranchName }}
              </span>
            }
            <span class="st-sep">|</span>
            <span class="st-wa-text">WA: {{ data.parentWhatsAppPhone }}</span>
          </span>
          @if (data.hostelInfo) {
            <div class="hostel-badge">
              <mat-icon class="hostel-icon">home</mat-icon>
              <span>🏠 Hosteler: <strong>{{ data.hostelInfo }}</strong></span>
            </div>
          }
          @if (data.selectedInvoicesCount && data.selectedInvoicesCount > 1) {
            <div class="multi-select-pill">
              <mat-icon class="mini-icon">layers</mat-icon>
              <span>Settling <strong>{{ data.selectedInvoicesCount }} Invoices</strong> in this payment</span>
            </div>
          }
          @if ((!data.selectedInvoicesCount || data.selectedInvoicesCount <= 1) && totalInvoicesCount > 1) {
            <div class="multi-select-pill unified-dues-pill">
              <mat-icon class="mini-icon">auto_awesome</mat-icon>
              <span>Unified Dues: <strong>{{ totalInvoicesCount }} Pending Invoices</strong> (Tuition, Kit &amp; Dues)</span>
            </div>
          }
        </div>
        <div class="due-badge" [class.due-badge-settled]="remainingDueAfterPay === 0">
          <span class="due-label">{{ data.selectedInvoicesCount && data.selectedInvoicesCount > 1 ? 'Selected Invoices Bill:' : 'Current Bill Due (कुल बिल):' }}</span>
          <strong class="due-amount">₹{{ studentTotalOutstanding | number:'1.2-2' }}</strong>
          @if (totalAdvanceInPayment > 0) {
            <span class="due-live-status status-advance">
              ✓ Remaining Due: ₹0.00 | +₹{{ totalAdvanceInPayment | number:'1.2-2' }} Advance
            </span>
          } @else if (remainingDueAfterPay === 0 && studentTotalOutstanding > 0) {
            <span class="due-live-status status-cleared">
              ✓ Remaining Due: ₹0.00 (Full Bill Settled)
            </span>
          } @else if (remainingDueAfterPay > 0) {
            <span class="due-live-status status-partial">
              Balance Left After Pay: ₹{{ remainingDueAfterPay | number:'1.2-2' }}
            </span>
          }
        </div>
      </div>
    
      <!-- Fee Heads Itemized Checklist Table -->
      @if (hasUnpaidItemRows) {
        <div class="heads-breakdown-card">
          <div class="breakdown-header">
            <div class="header-left">
              <mat-checkbox
                color="primary"
                [checked]="isAllSelected()"
                [indeterminate]="isSomeSelected()"
                (change)="onMasterCheckboxToggle($event.checked)">
                <span class="card-title">Select Fee Heads to Settle ({{ selectedCount }} of {{ itemRows.length }})</span>
              </mat-checkbox>
            </div>
            <div class="header-right">
              <span class="heads-total-badge">
                Selected Heads: <strong>₹{{ selectedItemsTotal | number:'1.2-2' }}</strong>
              </span>
            </div>
          </div>
          <div class="heads-table-wrap">
            <table class="heads-table">
              <thead>
                <tr>
                  <th class="chk-th" style="width: 44px; text-align: center !important;">Pay</th>
                  <th style="text-align: left !important;">Fee Head Particulars</th>
                  <th class="text-right" style="width: 110px; text-align: right !important;">Total Fee</th>
                  <th class="text-right" style="width: 120px; text-align: right !important;">Due Balance</th>
                  <th class="text-right" style="width: 145px; text-align: right !important;">Paying Now (₹)</th>
                </tr>
              </thead>
              <tbody>
                @for (row of itemRows; track (row.id || (row.headName + '_' + $index))) {
                  <tr [class.row-selected]="row.selected" [class.row-disabled]="row.dueAmount <= 0">
                    <td class="chk-cell" style="text-align: center;">
                      <mat-checkbox
                        color="primary"
                        [checked]="row.selected"
                        (change)="onItemCheckboxToggle(row, $event.checked)"
                        [disabled]="row.dueAmount <= 0">
                      </mat-checkbox>
                    </td>
                    <td>
                      <div class="head-info">
                        <div class="head-name-row">
                          <span class="head-name">{{ cleanHeadName(row.headName) }}</span>
                          <span class="head-stream-badge" [ngClass]="getStreamBadgeClass(row.headName)">
                            {{ getStreamBadgeText(row.headName) }}
                          </span>
                        </div>
                        @if (row.invoiceTitle) {
                          <span class="head-invoice-sub">
                            <mat-icon class="mini-inv-icon">receipt_long</mat-icon>
                            {{ row.invoiceTitle }}
                          </span>
                        }
                        @if (row.concessionAmount && row.concessionAmount > 0) {
                          <span class="head-concession-pill">
                            🎁 {{ row.concessionLabel || 'Sibling Concession' }}: -₹{{ row.concessionAmount | number:'1.2-2' }} Applied
                          </span>
                        }
                      </div>
                    </td>
                    <td class="text-right fee-col">₹{{ row.amount | number:'1.2-2' }}</td>
                    <td class="text-right due-col">
                      <strong [class.due-positive]="row.dueAmount > 0" [class.due-zero]="row.dueAmount === 0">
                        ₹{{ row.dueAmount | number:'1.2-2' }}
                      </strong>
                    </td>
                    <td class="text-right pay-col">
                      <div class="paying-input-wrap" [class.wrap-disabled]="!row.selected || row.dueAmount <= 0">
                        <span class="curr-symbol">₹</span>
                        <input
                          #payInput
                          type="number"
                          class="paying-input"
                          [disabled]="!row.selected || row.dueAmount <= 0"
                          [(ngModel)]="row.payingAmount"
                          [ngModelOptions]="{standalone: true}"
                          (focus)="onItemPayingInputFocus($event)"
                          (input)="onItemPayingAmountInput(row, payInput)"
                          (blur)="onItemPayingAmountBlur(row, payInput)"
                          [max]="row.dueAmount"
                          step="0.01"
                          min="0" />
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    
      <!-- Advance Tuition Bundling Card (Optional) -->
      @if (advanceMonthOptions.length > 1 && (!data.selectedInvoicesCount || data.selectedInvoicesCount <= 1)) {
        <div class="advance-payment-card">
          <div class="adv-card-header">
            <div class="adv-header-left">
              <div class="adv-icon-wrap">
                <mat-icon>event_repeat</mat-icon>
              </div>
              <div class="adv-header-text">
                <div class="adv-title-row">
                  <span class="adv-title">Pay Advance Monthly Fees</span>
                  <span class="adv-rate-pill">
                    Recurring: <strong>₹{{ detectedMonthlyRate | number:'1.2-2' }}/mo</strong>
                  </span>
                </div>
                <span class="adv-sub">Bundle upcoming monthly recurring fees (Tuition + Transport) into this collection receipt</span>
              </div>
            </div>
            @if (selectedAdvanceOption && selectedAdvanceOption.monthCount > 0) {
              <div class="adv-header-right">
                <span class="adv-added-badge">
                  Advance: +₹{{ selectedAdvanceOption.totalAmount | number:'1.2-2' }}
                </span>
              </div>
            }
          </div>
          <div class="adv-options-grid">
            @for (opt of advanceMonthOptions; track opt.monthCount) {
              <button
                type="button"
                class="adv-option-btn"
                [class.active]="selectedAdvanceOption?.monthCount === opt.monthCount"
                (click)="onSelectAdvanceOption(opt)">
                <div class="btn-top">
                  <span class="opt-label">{{ opt.label }}</span>
                  @if (selectedAdvanceOption?.monthCount === opt.monthCount) {
                    <mat-icon class="opt-check-icon">check_circle</mat-icon>
                  }
                </div>
                <div class="btn-meta">
                  <span class="opt-period">{{ opt.badgeLabel }}</span>
                  <strong class="opt-cost" [class.free]="opt.totalAmount === 0">
                    {{ opt.totalAmount === 0 ? 'Current Only' : '+₹' + (opt.totalAmount | number:'1.0-0') }}
                  </strong>
                </div>
              </button>
            }
          </div>
          <!-- Informational Callout when an advance option is selected -->
          @if (selectedAdvanceOption && selectedAdvanceOption.monthCount > 0) {
            <div class="adv-notice-callout">
              <mat-icon class="notice-icon">verified</mat-icon>
              <div class="notice-text">
                <strong>Advance Settlement Active:</strong>
                {{ selectedAdvanceOption.periodSummary }} recurring fee (+₹{{ selectedAdvanceOption.totalAmount | number:'1.2-2' }}) will be bundled into this single receipt. Upcoming monthly invoices will be pre-generated and marked Paid automatically.
              </div>
            </div>
          }
        </div>
      }
    
      <!-- Library Dues Card (if student has pending library fines) -->
      @if (libraryDues && libraryDues.pendingFineAmount > 0) {
        <div class="library-fine-box">
          <div class="fine-header">
            <div class="fine-badge">
              <div class="icon-circle">
                <mat-icon class="book-icon">local_library</mat-icon>
              </div>
              <div class="fine-badge-text">
                <span class="fine-title">Pending Library Overdue Fine</span>
                <span class="fine-sub">{{ libraryDues.pendingFinesCount }} returned book(s) have unsettled late fines</span>
              </div>
            </div>
            <div class="fine-amt">₹{{ libraryDues.pendingFineAmount | number:'1.2-2' }}</div>
          </div>
          <div class="fine-books-list">
            @for (item of libraryDues.pendingFines; track (item.circulationId || item.accessionNumber || $index)) {
              <div class="book-chip">
                <mat-icon class="chip-icon">menu_book</mat-icon>
                <span class="book-title">{{ item.bookTitle }}</span>
                <span class="chip-sep">•</span>
                <span class="acc-tag">{{ item.accessionNumber }}</span>
                <span class="chip-sep">•</span>
                <span class="overdue-tag">{{ item.overdueDays }}d late</span>
                @if (!item.returnDate) {
                  <span class="unreturned-pill">Not Returned Yet</span>
                }
                <strong class="chip-fine">₹{{ item.fineAmount | number:'1.2-2' }}</strong>
              </div>
            }
          </div>
          <div class="include-fine-row">
            <mat-checkbox formControlName="includeLibraryFine" color="primary" (change)="onIncludeFineToggle($event.checked)">
              <span class="chk-label">
                <strong>Collect &amp; Settle Library Fine (₹{{ libraryDues.pendingFineAmount | number:'1.2-2' }})</strong>
                <small class="chk-subtext">Will be added as a separate line item on the official fee receipt</small>
              </span>
            </mat-checkbox>
          </div>
        </div>
      }
    
      <!-- Payment Details Form Grid -->
      <div class="form-grid">
        <mat-form-field appearance="outline" class="full-width amount-collect-field">
          <mat-label>Total Amount to Collect (₹)</mat-label>
          <input
            matInput
            type="number"
            formControlName="amountPaid"
            placeholder="e.g. 1000"
            (focus)="onTotalAmountFocus($event)"
            (input)="onTotalAmountInputChange($event)"
            (blur)="onTotalAmountBlur()"
            step="any"
            min="1" />
          <mat-icon matSuffix color="primary">currency_rupee</mat-icon>
          @if (itemRows.length > 0) {
            <mat-hint>
              ⚡ <strong>Quick Lump-Sum:</strong> Type any amount (e.g. ₹1,000) to auto-distribute across fee heads by priority
            </mat-hint>
          }
          @if (itemRows.length === 0) {
            <mat-hint>Enter the total amount to collect</mat-hint>
          }
          @if (feeForm.get('amountPaid')?.hasError('required')) {
            <mat-error>Amount is required</mat-error>
          }
          @if (feeForm.get('amountPaid')?.hasError('min')) {
            <mat-error>Amount must be greater than 0</mat-error>
          }
        </mat-form-field>

        @if (customAdvanceCreditAmount > 0) {
          <div class="full-width advance-credit-banner">
            <div class="adv-left">
              <mat-icon>account_balance_wallet</mat-icon>
              <div>
                <strong>Advance Fee Paid (Carried Forward): ₹{{ customAdvanceCreditAmount | number:'1.2-2' }}</strong>
                <div class="adv-sub">Excess amount above current bill will be printed as Advance Paid &amp; auto-adjusted in next month's fee invoice (FIFO)</div>
              </div>
            </div>
            <span class="adv-pill">+₹{{ customAdvanceCreditAmount | number:'1.2-2' }} Advance</span>
          </div>
        }
    
        <mat-form-field appearance="outline" class="half-width">
          <mat-label>Payment Mode</mat-label>
          <mat-select formControlName="mode">
            <mat-option [value]="0">💵 Cash</mat-option>
            <mat-option [value]="1">📱 UPI / GPay / PhonePe</mat-option>
            <mat-option [value]="2">🏦 Bank Transfer / NetBanking</mat-option>
            <mat-option [value]="3">📑 Cheque</mat-option>
          </mat-select>
        </mat-form-field>
    
        <mat-form-field appearance="outline" class="half-width transaction-ref-field">
          <mat-label>{{ getTransactionRefLabel() }}</mat-label>
          <input matInput formControlName="transactionRef" [placeholder]="getTransactionRefPlaceholder()" />
          <mat-icon matPrefix class="tx-prefix-icon">
            @switch (feeForm.get('mode')?.value) {
              @case (0) { payments }
              @case (1) { qr_code_scanner }
              @case (2) { account_balance }
              @case (3) { receipt_long }
              @default { pin }
            }
          </mat-icon>
        </mat-form-field>

        <!-- Mode 0: Cash Notice Banner -->
        @if (feeForm.get('mode')?.value === 0) {
          <div class="mode-info-banner mode-cash full-width">
            <div class="mode-info-left">
              <mat-icon class="mode-info-icon">payments</mat-icon>
              <div class="mode-info-text">
                <strong>Cash Payment at Desk Counter</strong>
                <span>Physical currency collection at billing counter. Official digital fee receipt &amp; SMS/WhatsApp alert will be issued instantly.</span>
              </div>
            </div>
            <div class="mode-amt-badge">
              <span>Collect:</span>
              <strong>₹{{ (feeForm.get('amountPaid')?.value || 0) | number:'1.2-2' }}</strong>
            </div>
          </div>
        }
    
        <!-- Dynamic UPI Counter QR Code Panel (Visible when Payment Mode is UPI = 1) -->
        @if (feeForm.get('mode')?.value === 1) {
          <div class="dynamic-upi-counter-card full-width">
            <div class="upi-card-inner">
              <!-- Left: Clean QR Frame -->
              <div class="qr-col">
                <div class="qr-frame">
                  <canvas #counterQrCanvas class="counter-qr-canvas"></canvas>
                  <div class="scan-corner top-left"></div>
                  <div class="scan-corner top-right"></div>
                  <div class="scan-corner bottom-left"></div>
                  <div class="scan-corner bottom-right"></div>
                </div>
                <button type="button" class="btn-refresh-mini" (click)="generateCounterQr()" matTooltip="Regenerate QR" matButton="filled">
                  <mat-icon>refresh</mat-icon>
                  <span>Refresh QR</span>
                </button>
              </div>
              <!-- Right: Info, VPA & Steps -->
              <div class="upi-info-col">
                <!-- Top Brand & Amount Row -->
                <div class="upi-info-top">
                  <div class="upi-brand-badge">
                    <mat-icon class="brand-icon">qr_code_scanner</mat-icon>
                    <strong>Bharat Dynamic UPI QR</strong>
                    <span class="zero-fee-badge">0% Fee Direct Bank Credit</span>
                  </div>
                  <div class="upi-amount-pill">
                    <span class="amt-lbl">Amount:</span>
                    <strong class="amt-val">₹{{ (feeForm.get('amountPaid')?.value || 0) | number:'1.2-2' }}</strong>
                  </div>
                </div>
                <!-- VPA Compact Bar -->
                @if (activeVpa) {
                  <div class="vpa-compact-bar">
                    <div class="vpa-text-box">
                      <span class="vpa-label">Institute VPA:</span>
                      <strong class="vpa-id">{{ activeVpa }}</strong>
                      @if (merchantName) {
                        <span class="vpa-payee">({{ merchantName }})</span>
                      }
                    </div>
                    <button type="button" class="copy-vpa-btn" (click)="copyVpa()" [matTooltip]="vpaCopied ? 'Copied!' : 'Copy UPI ID'">
                      <mat-icon>{{ vpaCopied ? 'check' : 'content_copy' }}</mat-icon>
                    </button>
                  </div>
                }
                <!-- 3 Micro-Steps in Horizontal / Stacked Responsive Flow -->
                <div class="upi-steps-row">
                  <div class="micro-step">
                    <span class="step-badge">1</span>
                    <span class="step-desc">Scan with any UPI App (GPay, PhonePe, Paytm, BHIM)</span>
                  </div>
                  <mat-icon class="step-arrow">chevron_right</mat-icon>
                  <div class="micro-step">
                    <span class="step-badge">2</span>
                    <span class="step-desc">Verify institute payee &amp; confirm payment</span>
                  </div>
                  <mat-icon class="step-arrow">chevron_right</mat-icon>
                  <div class="micro-step highlight">
                    <span class="step-badge">3</span>
                    <span class="step-desc">Enter 12-digit UTR in field above</span>
                  </div>
                </div>
                <!-- Supported Apps Pills -->
                <div class="upi-apps-chips">
                  <span class="apps-label">Supported:</span>
                  <span class="app-chip chip-gpay" title="Google Pay">
                    <svg class="pay-app-icon" viewBox="0 0 24 24" width="13" height="13">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"/>
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"/>
                    </svg>
                    <span class="chip-text">GPay</span>
                  </span>
                  <span class="app-chip chip-phonepe" title="PhonePe">
                    <span class="phonepe-logo-circle">पे</span>
                    <span class="chip-text">PhonePe</span>
                  </span>
                  <span class="app-chip chip-paytm" title="Paytm">
                    <svg class="pay-app-icon" viewBox="0 0 24 14" width="16" height="11">
                      <rect width="24" height="14" rx="2" fill="#002970"/>
                      <text x="3" y="10" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="900" font-size="7.5" fill="#ffffff">pay</text>
                      <text x="14.5" y="10" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="900" font-size="7.5" fill="#00b9f5">tm</text>
                    </svg>
                    <span class="chip-text paytm-brand-text"><span class="p-dark">Pay</span><span class="p-cyan">tm</span></span>
                  </span>
                  <span class="app-chip chip-bhim" title="BHIM UPI">
                    <svg class="pay-app-icon" viewBox="0 0 16 16" width="13" height="13">
                      <polygon points="3,2 8,2 5,14 0,14" fill="#007659"/>
                      <polygon points="9,2 14,2 11,14 6,14" fill="#E26A2C"/>
                    </svg>
                    <span class="chip-text">BHIM</span>
                  </span>
                  <span class="app-chip chip-upi" title="CRED / Any UPI App">
                    <svg class="pay-app-icon" viewBox="0 0 20 14" width="15" height="11">
                      <path d="M1,2 L5.5,2 L3.5,12 L-1,12 Z" fill="#007659"/>
                      <path d="M7,2 L11.5,2 L9.5,12 L5,12 Z" fill="#E26A2C"/>
                    </svg>
                    <span class="chip-text">CRED / Any UPI</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        }

        <!-- Mode 2: Bank Transfer Notice Banner -->
        @if (feeForm.get('mode')?.value === 2) {
          <div class="mode-info-banner mode-bank full-width">
            <div class="mode-info-left">
              <mat-icon class="mode-info-icon">account_balance</mat-icon>
              <div class="mode-info-text">
                <strong>Direct Bank Transfer / NEFT / IMPS / RTGS</strong>
                <span>Record the bank transaction reference number / UTR to reconcile payment directly with the institution bank account.</span>
              </div>
            </div>
            <div class="mode-amt-badge">
              <span>Transfer:</span>
              <strong>₹{{ (feeForm.get('amountPaid')?.value || 0) | number:'1.2-2' }}</strong>
            </div>
          </div>
        }

        <!-- Mode 3: Cheque Notice Banner -->
        @if (feeForm.get('mode')?.value === 3) {
          <div class="mode-info-banner mode-cheque full-width">
            <div class="mode-info-left">
              <mat-icon class="mode-info-icon">receipt_long</mat-icon>
              <div class="mode-info-text">
                <strong>Cheque / Demand Draft Collection</strong>
                <span>Enter cheque number and bank name above. Official receipt will record instrument details for clearance audit.</span>
              </div>
            </div>
            <div class="mode-amt-badge">
              <span>Instrument:</span>
              <strong>₹{{ (feeForm.get('amountPaid')?.value || 0) | number:'1.2-2' }}</strong>
            </div>
          </div>
        }
    
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Remarks / Notes</mat-label>
          <input matInput formControlName="remarks" placeholder="Optional notes (e.g. Received at desk)" />
        </mat-form-field>
    
        <div class="full-width whatsapp-toggle-box">
          <mat-checkbox formControlName="sendWhatsAppReceipt" color="primary">
            <span class="wa-toggle-label">
              <mat-icon class="wa-icon">chat</mat-icon>
              <strong>Send Instant WhatsApp Digital Payment Receipt to Parent</strong>
            </span>
          </mat-checkbox>
        </div>
      </div>
    </mat-dialog-content>
    
    <mat-dialog-actions align="end" class="dialog-actions">
      <button type="button" class="btn-cancel app-button-cancel" (click)="onCancel()" [disabled]="saving" matButton="filled">Cancel</button>
      <button color="primary" type="submit" class="btn-confirm" [disabled]="feeForm.invalid || saving || (feeForm.get('amountPaid')?.value || 0) <= 0" matButton="filled">
        @if (saving) {
          <mat-spinner diameter="18" class="spinner"></mat-spinner>
        }
        @if (!saving) {
          <mat-icon>receipt_long</mat-icon>
        }
        @if (saving && selectedAdvanceOption && selectedAdvanceOption.monthCount > 0) {
          <span>Bundling Advance &amp; Settling...</span>
        }
        @if (saving && (!selectedAdvanceOption || selectedAdvanceOption.monthCount === 0)) {
          <span>Processing Payment...</span>
        }
        @if (!saving) {
          <span>Confirm &amp; Issue Receipt</span>
        }
      </button>
    </mat-dialog-actions>
    </form>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
      width: 100%;
      height: 100%;
      max-height: 90vh;
      overflow: hidden;
      box-sizing: border-box;

      @media (max-width: 768px) {
        max-height: 100dvh;
        height: 100dvh;
      }
    }

    .dialog-header-wrap {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px 24px 16px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;

      @media (max-width: 768px) {
        padding: 12px 16px;
        gap: 10px;

        .header-icon-box {
          width: 38px;
          height: 38px;
          mat-icon { font-size: 20px; width: 20px; height: 20px; }
        }

        .header-titles {
          .dialog-header { font-size: 1.05rem; }
          .dialog-sub { font-size: 0.74rem; }
        }
      }

      .header-icon-box {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }

      .header-titles {
        flex: 1 1 auto;
        min-width: 0;

        .dialog-header {
          margin: 0;
          font-size: 1.18rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.3;
        }

        .dialog-sub {
          margin: 3px 0 0;
          font-size: 0.82rem;
          color: #3b82f6;
          font-weight: 500;
        }
      }

      .close-x-btn {
        color: #64748b;
        transition: all 0.15s ease;
        &:hover {
          color: #1e293b;
          background: rgba(0, 0, 0, 0.05);
        }
      }
    }

    form.collection-form {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
      height: 100%;
      overflow: hidden;
      box-sizing: border-box;
    }

    .dialog-content {
      width: 100%;
      box-sizing: border-box;
      padding: 18px 24px;
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;

      @media (max-width: 768px) {
        padding: 12px 14px !important;
      }
    }

    .student-info-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow: hidden;

      @media (max-width: 768px) {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
        padding: 12px 14px;
      }

      .info-details {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;

        .st-name {
          font-weight: 700;
          font-size: 1.05rem;
          color: #0f172a;
          word-break: break-word;
        }

        .st-sub {
          font-size: 0.82rem;
          color: #64748b;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 3px;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;

          .st-hybrid-chip {
            background: linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%);
            color: #7e22ce;
            border: 1px solid #f0abfc;
            box-shadow: 0 1px 2px rgba(126, 34, 206, 0.08);
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.76rem;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            max-width: 100%;
            box-sizing: border-box;
            word-break: break-word;
            line-height: 1.35;
          }

          .st-school-chip {
            color: #0369a1;
            font-weight: 600;
            background: #e0f2fe;
            padding: 2px 7px;
            border-radius: 4px;
            border: 1px solid #bae6fd;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            max-width: 100%;
            box-sizing: border-box;
            word-break: break-word;
            line-height: 1.35;
          }

          .st-batch-chip {
            color: #6d28d9;
            font-weight: 600;
            background: #ede9fe;
            padding: 2px 7px;
            border-radius: 4px;
            border: 1px solid #ddd6fe;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            max-width: 100%;
            box-sizing: border-box;
            word-break: break-word;
            line-height: 1.35;
          }

          .st-branch-chip {
            color: #1e40af;
            font-weight: 700;
            background: #eff6ff;
            padding: 2px 7px;
            border-radius: 4px;
            border: 1px solid #bfdbfe;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            max-width: 100%;
            box-sizing: border-box;
            word-break: break-word;
            line-height: 1.35;
          }

          .st-sep {
            color: #cbd5e1;
            font-weight: bold;
          }

          .st-wa-text {
            color: #047857;
            font-weight: 600;
            white-space: nowrap;
          }
        }
        .hostel-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          margin-top: 4px;
          background: #fdf2f8;
          color: #be185d;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.78rem;
          border: 1px solid #fbcfe8;
          .hostel-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
          }
        }
        .multi-select-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
          background: #eff6ff;
          color: #1d4ed8;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.78rem;

          &.unified-dues-pill {
            background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
            color: #047857;
            border: 1px solid #a7f3d0;
            font-weight: 600;
            .mini-icon { color: #059669; }
          }

          .mini-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
          }
        }
      }

      .due-badge {
        text-align: right;
        flex-shrink: 0;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 8px;
        padding: 8px 14px;
        transition: all 0.2s ease;

        @media (max-width: 768px) {
          text-align: left;
          width: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        &.due-badge-settled {
          background: #f0fdf4;
          border-color: #bbf7d0;

          .due-label {
            color: #166534;
          }

          .due-amount {
            color: #15803d;
          }
        }

        .due-label {
          display: block;
          font-size: 0.7rem;
          color: #991b1b;
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .due-amount {
          display: block;
          font-size: 1.35rem;
          color: #dc2626;
          font-weight: 800;
          line-height: 1.2;
        }

        .due-live-status {
          display: inline-block;
          margin-top: 4px;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.2px;

          &.status-advance {
            background: #dcfce7;
            color: #166534;
            border: 1px solid #86efac;
          }

          &.status-cleared {
            background: #dcfce7;
            color: #15803d;
            border: 1px solid #bbf7d0;
          }

          &.status-partial {
            background: #fff7ed;
            color: #c2410c;
            border: 1px solid #fed7aa;
          }
        }
      }
    }

    /* Fee Heads Breakdown Card */
    .heads-breakdown-card {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 16px;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      width: 100%;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;

      .breakdown-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        gap: 8px;
        flex-wrap: wrap;

        @media (max-width: 640px) {
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
          padding: 10px 12px;
        }

        .card-title {
          font-size: 0.9rem;
          font-weight: 700;
          color: #1e293b;
        }

        .heads-total-badge {
          font-size: 0.85rem;
          color: #0369a1;
          background: #e0f2fe;
          padding: 3px 10px;
          border-radius: 6px;
          border: 1px solid #bae6fd;
          white-space: nowrap;
        }
      }

      .heads-table-wrap {
        max-height: 280px;
        overflow-y: auto;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
      }

      .heads-table {
        width: 100%;
        min-width: 560px;
        border-collapse: collapse;
        font-size: 0.85rem;

        thead {
          background: #f1f5f9;
          position: sticky;
          top: 0;
          z-index: 1;

          th {
            padding: 9px 12px;
            font-size: 0.75rem;
            font-weight: 700;
            color: #334155;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            border-bottom: 1px solid #cbd5e1;
            text-align: left !important;

            &.chk-th {
              text-align: center !important;
            }

            &.text-right {
              text-align: right !important;
            }
          }
        }

        tbody {
          tr {
            border-bottom: 1px solid #f1f5f9;
            transition: background 0.15s ease;

            &:hover {
              background: #f8fafc;
            }

            &.row-selected {
              background: #f0fdf4;
            }

            &.row-disabled {
              opacity: 0.5;
            }

            td {
              padding: 9px 12px;
              vertical-align: middle;
              text-align: left !important;

              &.chk-cell {
                text-align: center !important;
              }

              &.text-right {
                text-align: right !important;
              }
            }
          }
        }

        .head-info {
          display: flex;
          flex-direction: column;
          gap: 2px;

          .head-name-row {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }

          .head-name {
            font-weight: 600;
            color: #1e293b;
          }

          .head-invoice-sub {
            font-size: 0.72rem;
            color: #64748b;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            .mini-inv-icon {
              font-size: 13px;
              width: 13px;
              height: 13px;
              color: #94a3b8;
            }
          }

          .head-concession-pill {
            font-size: 0.72rem;
            color: #047857;
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            border-radius: 4px;
            padding: 1px 6px;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            width: fit-content;
          }

          .head-stream-badge {
            font-size: 0.7rem;
            padding: 2px 7px;
            border-radius: 4px;
            font-weight: 600;
            white-space: nowrap;
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            gap: 3px;

            &.badge-school {
              background: #e0f2fe;
              color: #0369a1;
            }
            &.badge-coaching {
              background: #fdf4ff;
              color: #9333ea;
            }
            &.badge-hostel {
              background: #fef2f2;
              color: #dc2626;
            }
            &.badge-kit {
              background: #fef3c7;
              color: #b45309;
            }
            &.badge-general {
              background: #f1f5f9;
              color: #475569;
            }
          }
        }

        .fee-col {
          color: #64748b;
        }

        .due-col {
          .due-positive {
            color: #dc2626;
          }
          .due-zero {
            color: #16a34a;
          }
        }

        .pay-col {
          .paying-input-wrap {
            display: inline-flex;
            align-items: center;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 2px 6px;
            width: 120px;
            transition: all 0.15s ease;

            &.wrap-disabled {
              background: #f8fafc;
              border-color: #e2e8f0;
              cursor: not-allowed;
            }

            &:focus-within:not(.wrap-disabled) {
              border-color: #2563eb;
              box-shadow: 0 0 0 2px rgba(37,99,235,0.15);
            }

            .curr-symbol {
              font-size: 0.8rem;
              color: #64748b;
              margin-right: 2px;
            }

            .paying-input {
              width: 100%;
              border: none;
              outline: none;
              text-align: right;
              font-weight: 600;
              font-size: 0.88rem;
              color: #0f172a;
              background: transparent;
              -moz-appearance: textfield;

              &::-webkit-inner-spin-button,
              &::-webkit-outer-spin-button {
                -webkit-appearance: none;
                margin: 0;
              }

              &:disabled {
                color: #94a3b8;
                cursor: not-allowed;
              }
            }
          }
        }
      }
    }

  /* Advance Tuition Bundling Card */
  .advance-payment-card {
      background: #f8fafc;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      margin-bottom: 16px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(37,99,235,0.06);

      .adv-card-header {
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        border-bottom: 1px solid #bfdbfe;
        padding: 10px 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;

        .adv-header-left {
          display: flex;
          align-items: center;
          gap: 10px;

          .adv-icon-wrap {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: #2563eb;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            box-shadow: 0 2px 4px rgba(37,99,235,0.2);
            mat-icon { font-size: 18px; width: 18px; height: 18px; }
          }

          .adv-header-text {
            display: flex;
            flex-direction: column;

            .adv-title-row {
              display: flex;
              align-items: center;
              gap: 8px;

              .adv-title {
                font-weight: 700;
                font-size: 0.88rem;
                color: #1e3a8a;
              }

              .adv-rate-pill {
                background: #dbeafe;
                color: #1e40af;
                font-size: 0.72rem;
                padding: 1px 6px;
                border-radius: 4px;
                border: 1px solid #bfdbfe;
                strong { font-weight: 700; }
              }
            }

            .adv-sub {
              font-size: 0.72rem;
              color: #3b82f6;
              margin-top: 1px;
            }
          }
        }

        .adv-header-right {
          .adv-added-badge {
            background: #10b981;
            color: #ffffff;
            font-size: 0.75rem;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(16,185,129,0.25);
            white-space: nowrap;
          }
        }
      }

      .adv-options-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
        gap: 10px;
        padding: 12px;

        .adv-option-btn {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 6px;
          padding: 10px 12px;
          min-height: 66px;
          box-sizing: border-box;
          background: #ffffff;
          border: 1.5px solid #cbd5e1;
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
          outline: none;

          &:hover:not(.active) {
            border-color: #93c5fd;
            background: #f0f7ff;
            transform: translateY(-1px);
          }

          &.active {
            border-color: #2563eb;
            background: #eff6ff;
            box-shadow: 0 0 0 2px rgba(37,99,235,0.18);
            transform: translateY(-1px);

            .opt-label { color: #1e40af; }
            .opt-cost:not(.free) { color: #1d4ed8; }
          }

          .btn-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 6px;

            .opt-label {
              font-size: 0.78rem;
              font-weight: 700;
              color: #334155;
              line-height: 1.35;
              word-break: normal;
            }

            .opt-check-icon {
              font-size: 15px;
              width: 15px;
              height: 15px;
              color: #2563eb;
              flex-shrink: 0;
              margin-top: 2px;
            }
          }

          .btn-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 6px;
            margin-top: auto;
            padding-top: 4px;

            .opt-period {
              font-size: 0.7rem;
              color: #64748b;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .opt-cost {
              font-size: 0.82rem;
              font-weight: 800;
              color: #059669;
              white-space: nowrap;

              &.free {
                color: #94a3b8;
                font-weight: 600;
              }
            }
          }
        }
      }

      .adv-notice-callout {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 12px 12px;
        padding: 8px 12px;
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        border-radius: 6px;
        font-size: 0.77rem;
        color: #065f46;
        line-height: 1.4;

        .notice-icon {
          font-size: 17px;
          width: 17px;
          height: 17px;
          color: #059669;
          flex-shrink: 0;
        }

        .notice-text {
          strong { font-weight: 700; }
        }
      }
    }

    /* Library fine box */
    .library-fine-box {
      background: #fdf4ff;
      border: 1px solid #f0abfc;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 16px;

      .fine-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;

        .fine-badge {
          display: flex;
          align-items: center;
          gap: 8px;

          .icon-circle {
            background: #fae8ff;
            color: #a21caf;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            .book-icon {
              font-size: 17px;
              width: 17px;
              height: 17px;
            }
          }

          .fine-badge-text {
            display: flex;
            flex-direction: column;
            .fine-title {
              font-size: 0.88rem;
              font-weight: 700;
              color: #86198f;
            }
            .fine-sub {
              font-size: 0.76rem;
              color: #a21caf;
            }
          }
        }

        .fine-amt {
          font-size: 1.1rem;
          font-weight: 700;
          color: #a21caf;
        }
      }

      .fine-books-list {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin-bottom: 8px;

        .book-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #ffffff;
          border: 1px solid #f5d0fe;
          border-radius: 5px;
          padding: 4px 8px;
          font-size: 0.78rem;

          .chip-icon {
            font-size: 15px;
            width: 15px;
            height: 15px;
            color: #c026d3;
          }
          .book-title {
            font-weight: 600;
            color: #374151;
          }
          .chip-sep {
            color: #d1d5db;
          }
          .acc-tag {
            color: #6b7280;
            font-family: monospace;
          }
          .overdue-tag {
            color: #dc2626;
            font-weight: 600;
          }
          .unreturned-pill {
            background: #fee2e2;
            color: #b91c1c;
            padding: 1px 5px;
            border-radius: 3px;
            font-size: 0.7rem;
            font-weight: 500;
          }
          .chip-fine {
            margin-left: auto;
            color: #a21caf;
          }
        }
      }

      .include-fine-row {
        padding-top: 4px;
        border-top: 1px dashed #f5d0fe;

        .chk-label {
          display: flex;
          flex-direction: column;
          strong {
            font-size: 0.84rem;
            color: #701a75;
          }
          .chk-subtext {
            font-size: 0.74rem;
            color: #9d174d;
          }
        }
      }
    }

    .form-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;

      @media (max-width: 640px) {
        gap: 10px;
      }

      .full-width {
        flex: 1 1 100%;
        width: 100%;
      }
      .half-width {
        flex: 1 1 calc(50% - 6px);
        min-width: 220px;

        @media (max-width: 640px) {
          flex: 1 1 100%;
          width: 100%;
          min-width: 100%;
        }
      }

      .amount-collect-field {
        .mat-mdc-text-field-wrapper {
          background: #ffffff !important;
          border-radius: 8px;
          transition: all 0.2s ease;
        }
        input {
          color: #1e3a8a !important;
          font-weight: 800 !important;
          font-size: 1.25rem !important;
          letter-spacing: 0.5px;
        }
        .mat-mdc-floating-label {
          color: #2563eb !important;
          font-weight: 600 !important;
        }
      }

      .transaction-ref-field {
        .tx-prefix-icon {
          color: #2563eb;
          margin-right: 6px;
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
      }
    }

    /* Mode Information Banners (Cash, Bank Transfer, Cheque) */
    .mode-info-banner {
      border-radius: 10px;
      padding: 10px 14px;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);

      @media (max-width: 640px) {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        padding: 10px 12px;
      }

      .mode-info-left {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;

        .mode-info-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
          flex-shrink: 0;
        }

        .mode-info-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;

          strong {
            font-size: 0.88rem;
            font-weight: 700;
          }

          span {
            font-size: 0.76rem;
            line-height: 1.35;
          }
        }
      }

      .mode-amt-badge {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        flex-shrink: 0;
        padding: 4px 10px;
        border-radius: 8px;

        @media (max-width: 640px) {
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
        }

        span {
          font-size: 0.68rem;
          text-transform: uppercase;
          font-weight: 600;
          letter-spacing: 0.3px;
        }

        strong {
          font-size: 0.98rem;
          font-weight: 800;
        }
      }

      &.mode-cash {
        background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
        border: 1px solid #a7f3d0;
        .mode-info-icon { color: #059669; }
        .mode-info-text strong { color: #065f46; }
        .mode-info-text span { color: #047857; }
        .mode-amt-badge {
          background: #d1fae5;
          border: 1px solid #6ee7b7;
          span { color: #047857; }
          strong { color: #064e3b; }
        }
      }

      &.mode-bank {
        background: linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%);
        border: 1px solid #bfdbfe;
        .mode-info-icon { color: #2563eb; }
        .mode-info-text strong { color: #1e40af; }
        .mode-info-text span { color: #1d4ed8; }
        .mode-amt-badge {
          background: #dbeafe;
          border: 1px solid #93c5fd;
          span { color: #1e40af; }
          strong { color: #172554; }
        }
      }

      &.mode-cheque {
        background: linear-gradient(135deg, #fffbeb 0%, #fefce8 100%);
        border: 1px solid #fde68a;
        .mode-info-icon { color: #d97706; }
        .mode-info-text strong { color: #92400e; }
        .mode-info-text span { color: #b45309; }
        .mode-amt-badge {
          background: #fef3c7;
          border: 1px solid #fcd34d;
          span { color: #92400e; }
          strong { color: #78350f; }
        }
      }
    }

    .whatsapp-toggle-box {
      background: #f0fdf4;
      border: 1px dashed #86efac;
      border-radius: 8px;
      padding: 8px 14px;
      margin-top: 4px;

      @media (max-width: 640px) {
        padding: 8px 10px;
      }

      .wa-toggle-label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #15803d;
        font-size: 0.85rem;
        flex-wrap: wrap;
        line-height: 1.35;

        .wa-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #16a34a;
          flex-shrink: 0;
        }

        strong {
          word-break: normal;
        }
      }
    }

    /* Dynamic UPI Counter Card - Fully Responsive Across Mobile, Tablet & Desktop */
    .dynamic-upi-counter-card {
      background: linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%);
      border: 1px solid #86efac;
      border-radius: 12px;
      padding: 12px 16px;
      margin-bottom: 8px;
      box-shadow: 0 2px 8px rgba(22, 163, 74, 0.08);
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow: hidden;

      @media (max-width: 640px) {
        padding: 10px 12px;
        border-radius: 10px;
      }

      .upi-card-inner {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 16px;
        align-items: center;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;

        @media (max-width: 640px) {
          grid-template-columns: 1fr;
          gap: 12px;
        }
      }

      .qr-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;

        .qr-frame {
          position: relative;
          background: #ffffff;
          padding: 6px;
          border-radius: 10px;
          border: 2px solid #16a34a;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.06);
          display: flex;
          align-items: center;
          justify-content: center;

          .counter-qr-canvas {
            display: block;
            width: 120px !important;
            height: 120px !important;

            @media (max-width: 640px) {
              width: 130px !important;
              height: 130px !important;
            }
          }

          .scan-corner {
            position: absolute;
            width: 10px;
            height: 10px;
            border-color: #16a34a;
            border-style: solid;
            pointer-events: none;

            &.top-left {
              top: 3px;
              left: 3px;
              border-width: 2.5px 0 0 2.5px;
              border-top-left-radius: 4px;
            }
            &.top-right {
              top: 3px;
              right: 3px;
              border-width: 2.5px 2.5px 0 0;
              border-top-right-radius: 4px;
            }
            &.bottom-left {
              bottom: 3px;
              left: 3px;
              border-width: 0 0 2.5px 2.5px;
              border-bottom-left-radius: 4px;
            }
            &.bottom-right {
              bottom: 3px;
              right: 3px;
              border-width: 0 2.5px 2.5px 0;
              border-bottom-right-radius: 4px;
            }
          }
        }

        .btn-refresh-mini {
          height: 24px;
          line-height: 24px;
          padding: 0 8px;
          font-size: 0.72rem;
          color: #15803d;
          font-weight: 600;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #ffffff;
          border: 1px solid #86efac;

          mat-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
          }
          &:hover {
            background: #dcfce7;
          }
        }
      }

      .upi-info-col {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
        width: 100%;

        .upi-info-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;

          @media (max-width: 640px) {
            flex-direction: column;
            align-items: stretch;
            gap: 6px;
          }

          .upi-brand-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;

            @media (max-width: 640px) {
              justify-content: space-between;
              width: 100%;
            }

            .brand-icon {
              font-size: 20px;
              width: 20px;
              height: 20px;
              color: #16a34a;
            }
            strong {
              font-size: 0.9rem;
              color: #14532d;
              font-weight: 800;
            }
            .zero-fee-badge {
              background: #dcfce7;
              color: #15803d;
              font-size: 0.7rem;
              font-weight: 700;
              padding: 2px 8px;
              border-radius: 12px;
              border: 1px solid #86efac;
              white-space: nowrap;
            }
          }

          .upi-amount-pill {
            background: #dcfce7;
            border: 1px solid #86efac;
            border-radius: 16px;
            padding: 3px 10px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;

            @media (max-width: 640px) {
              width: 100%;
              box-sizing: border-box;
              justify-content: space-between;
              padding: 5px 12px;
              border-radius: 8px;
            }

            .amt-lbl {
              font-size: 0.74rem;
              color: #15803d;
              font-weight: 600;
            }
            .amt-val {
              font-size: 1rem;
              color: #14532d;
              font-weight: 800;
            }
          }
        }

        .vpa-compact-bar {
          background: #ffffff;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          padding: 6px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          min-height: 44px;
          box-sizing: border-box;

          .vpa-text-box {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 4px 8px;
            min-width: 0;
            flex: 1 1 auto;

            .vpa-label {
              color: #64748b;
              font-weight: 700;
              font-size: 0.7rem;
              text-transform: uppercase;
              letter-spacing: 0.4px;
              white-space: nowrap;
            }
            .vpa-id {
              color: #0f172a;
              font-family: 'SF Mono', Consolas, Monaco, monospace;
              font-weight: 700;
              font-size: 0.85rem;
              word-break: break-all;
            }
            .vpa-payee {
              color: #475569;
              font-size: 0.74rem;
              font-weight: 500;
            }
          }

          .copy-vpa-btn {
            width: 30px;
            height: 30px;
            flex: 0 0 30px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            align-self: center;
            margin: auto 0;
            color: #16a34a;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 6px;
            cursor: pointer;
            padding: 0;
            transition: all 0.15s ease;

            mat-icon {
              font-size: 16px;
              width: 16px;
              height: 16px;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            &:hover {
              background: #dcfce7;
              border-color: #86efac;
              color: #15803d;
            }
          }
        }

        .upi-steps-row {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 6px 8px;

          @media (max-width: 640px) {
            flex-direction: column;
            align-items: stretch;
            gap: 6px;
            padding: 8px 10px;

            .step-arrow {
              display: none !important;
            }

            .micro-step {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 0.78rem;

              .step-badge {
                width: 18px;
                height: 18px;
                font-size: 0.68rem;
              }

              .step-desc {
                white-space: normal;
                overflow: visible;
                text-overflow: unset;
                line-height: 1.35;
              }
            }
          }

          .micro-step {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 0.74rem;
            color: #475569;
            min-width: 0;

            .step-badge {
              width: 16px;
              height: 16px;
              border-radius: 50%;
              background: #16a34a;
              color: #ffffff;
              font-size: 0.65rem;
              font-weight: 800;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }

            .step-desc {
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            &.highlight {
              color: #1e293b;
              font-weight: 700;
              .step-badge {
                background: #2563eb;
              }
            }
          }

          .step-arrow {
            font-size: 14px;
            width: 14px;
            height: 14px;
            color: #94a3b8;
            flex-shrink: 0;
          }
        }

        .upi-apps-chips {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 3px;

          .apps-label {
            font-size: 0.72rem;
            color: #64748b;
            font-weight: 600;
            white-space: nowrap;
            margin-right: 2px;
          }

          .app-chip {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 5px;
            padding: 3px 8px;
            font-size: 0.70rem;
            font-weight: 600;
            color: #334155;
            white-space: nowrap;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
            transition: all 0.15s ease-in-out;
            user-select: none;

            &:hover {
              border-color: #94a3b8;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
              transform: translateY(-1px);
            }

            .pay-app-icon {
              display: inline-block;
              vertical-align: middle;
              flex-shrink: 0;
            }

            .chip-text {
              line-height: 1;
            }

            &.chip-gpay {
              &:hover {
                border-color: #4285f4;
              }
            }

            &.chip-phonepe {
              .phonepe-logo-circle {
                width: 13px;
                height: 13px;
                background: #5f259f;
                color: #ffffff;
                border-radius: 50%;
                font-size: 8px;
                font-weight: 800;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                line-height: 1;
                flex-shrink: 0;
              }
              &:hover {
                border-color: #5f259f;
                color: #5f259f;
              }
            }

            &.chip-paytm {
              .p-dark {
                color: #002970;
                font-weight: 800;
              }
              .p-cyan {
                color: #00b9f5;
                font-weight: 800;
              }
              &:hover {
                border-color: #00b9f5;
              }
            }

            &.chip-bhim {
              &:hover {
                border-color: #007659;
              }
            }

            &.chip-upi {
              &:hover {
                border-color: #e26a2c;
              }
            }
          }
        }
      }
    }

    .advance-credit-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      border: 1px solid #6ee7b7;
      border-radius: 8px;
      color: #065f46;

      .adv-left {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.82rem;
        mat-icon {
          color: #059669;
          font-size: 22px;
          width: 22px;
          height: 22px;
          flex-shrink: 0;
        }
        .adv-sub {
          font-size: 0.73rem;
          color: #047857;
          margin-top: 2px;
        }
      }

      .adv-pill {
        background: #059669;
        color: #ffffff;
        font-weight: 700;
        font-size: 0.76rem;
        padding: 4px 10px;
        border-radius: 999px;
        white-space: nowrap;
      }
    }

    .dialog-actions {
      padding: 12px 24px 14px;
      border-top: 1px solid #bfdbfe;
      background: #f8fafc;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin: 0;
      flex-shrink: 0;
      position: sticky;
      bottom: 0;
      z-index: 10;
      box-shadow: 0 -4px 12px rgba(15, 23, 42, 0.08);

      @media (max-width: 768px) {
        padding: 10px 14px;
        flex-direction: row;
        gap: 8px;

        .btn-cancel {
          flex: 0 0 auto;
        }

        .btn-confirm {
          flex: 1 1 auto;
          justify-content: center;
        }
      }

      .btn-cancel {
        color: #475569;
        font-weight: 600;
        border-color: #cbd5e1;
        &:hover {
          background: #f1f5f9;
        }
      }

      .btn-confirm {
        background: #2563eb !important;
        color: #ffffff !important;
        font-weight: 700;
        height: 42px;
        padding: 0 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
        display: inline-flex;
        align-items: center;
        gap: 6px;
        mat-icon { font-size: 19px; width: 19px; height: 19px; }
        &:hover:not([disabled]) {
          background: #1d4ed8 !important;
          box-shadow: 0 6px 10px -1px rgba(37,99,235,0.35);
        }
      }

      .spinner {
        margin-right: 8px;
      }
    }
  `]
})
export class FeeCollectionDialogComponent implements OnInit {
  feeForm!: FormGroup;
  saving = false;
  libraryDues?: StudentLibraryDues;
  baseTuitionAmount: number = 0;
  itemRows: FeeCollectionItemRow[] = [];
  studentTotalOutstanding: number = 0;
  totalInvoicesCount: number = 1;
  loadingDues: boolean = false;
  advanceMonthOptions: AdvanceMonthOption[] = [];
  selectedAdvanceOption: AdvanceMonthOption | null = null;
  advanceAmountTotal: number = 0;
  customAdvanceCreditAmount: number = 0;

  @ViewChild('counterQrCanvas') counterQrCanvas?: ElementRef<HTMLCanvasElement>;
  activeVpa: string = '';
  merchantName: string = '';

  get recurringTuitionItems(): FeeCollectionItemRow[] {
    return this.itemRows.filter(r => {
      const name = r.headName.toLowerCase();
      // Exclude one-time, kit, fines, and annual heads
      const isNonRecurring = name.includes('admission') || name.includes('registration') || 
                             name.includes('annual') || name.includes('uniform') || 
                             name.includes('kit') || name.includes('dress') || 
                             name.includes('book') || name.includes('stationery') ||
                             name.includes('fine') || name.includes('penalty') || 
                             name.includes('one-time');
      if (isNonRecurring) return false;

      // Include all recurring monthly heads (Tuition, Coaching, Computer, Lab, Smart Class, Transport, Bus, Van, or general monthly fees)
      return name.includes('tuition') || name.includes('monthly') || name.includes('coaching') ||
             name.includes('computer') || name.includes('lab') || name.includes('smart class') ||
             name.includes('transport') || name.includes('bus') || name.includes('van') ||
             name.includes('fee');
    });
  }

  get detectedMonthlyRate(): number {
    const tuitionItems = this.recurringTuitionItems;
    if (tuitionItems.length > 0) {
      return tuitionItems.reduce((sum, it) => {
        const netAmt = it.concessionAmount ? Math.max(0, it.amount - it.concessionAmount) : it.amount;
        return sum + netAmt;
      }, 0);
    }
    if (this.itemRows.length === 1) {
      const name = this.itemRows[0].headName.toLowerCase();
      if (!name.includes('admission') && !name.includes('registration') && !name.includes('uniform') && !name.includes('book')) {
        const row = this.itemRows[0];
        return row.concessionAmount ? Math.max(0, row.amount - row.concessionAmount) : row.amount;
      }
    }
    return 0;
  }

  get effectiveBranchName(): string {
    if (this.data?.branchName) return this.data.branchName;
    const authBranch = this.authService.getCurrentBranchName();
    if (authBranch) return authBranch;
    const batch = this.data?.batchName || '';
    const match = batch.match(/\(([^)]+)\)/);
    if (match) return match[1];
    return '';
  }

  constructor(
    private fb: FormBuilder,
    private feesService: FeesService,
    private confirmDialog: ConfirmDialogService,
    private quickSettings: QuickSettingsService,
    private authService: AuthService,
    private dialogRef: MatDialogRef<FeeCollectionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FeeDialogData
  ) {}

  buildReconciledRows(
    rawItems: { id: string; headName: string; amount: number; paidAmount: number }[],
    invoiceId?: string,
    invoiceTitle?: string
  ): FeeCollectionItemRow[] {
    if (!rawItems || rawItems.length === 0) return [];

    // Separate positive fee heads from negative concession / discount heads
    const positiveItems = rawItems.filter(it => it.amount > 0);
    const concessionItems = rawItems.filter(it => it.amount < 0 || it.headName.toLowerCase().includes('concession') || it.headName.toLowerCase().includes('sibling discount'));

    const totalConcession = concessionItems.reduce((sum, it) => sum + Math.abs(it.amount < 0 ? it.amount : 0), 0);
    const concessionLabel = concessionItems.map(it => it.headName.replace(/^🎁\s*/, '')).join(', ');

    const academicItems = positiveItems.filter(it => {
      const lowerName = it.headName.toLowerCase();
      return lowerName.includes('tuition') || lowerName.includes('coaching') || lowerName.includes('monthly') ||
             (!lowerName.includes('kit') && !lowerName.includes('hostel') && !lowerName.includes('mess') && !lowerName.includes('transport') && !lowerName.includes('fine'));
    });
    const totalAcademicPositive = academicItems.reduce((sum, it) => sum + it.amount, 0);

    let remainingConcession = totalConcession;

    return positiveItems.map((it, idx) => {
      let allocatedConcession = 0;
      const lowerName = it.headName.toLowerCase();
      const isAcademic = lowerName.includes('tuition') || lowerName.includes('coaching') || lowerName.includes('monthly') ||
                         (!lowerName.includes('kit') && !lowerName.includes('hostel') && !lowerName.includes('mess') && !lowerName.includes('transport') && !lowerName.includes('fine'));

      if (remainingConcession > 0 && isAcademic && totalAcademicPositive > 0) {
        // Distribute proportionally across all positive academic heads so discounts match percentages identically
        const isLastAcademic = academicItems.indexOf(it) === academicItems.length - 1;
        if (isLastAcademic) {
          allocatedConcession = Math.min(remainingConcession, it.amount);
        } else {
          allocatedConcession = Math.round(Math.min(remainingConcession, totalConcession * (it.amount / totalAcademicPositive)) * 100) / 100;
        }
        remainingConcession = Math.max(0, Math.round((remainingConcession - allocatedConcession) * 100) / 100);
      } else if (remainingConcession > 0 && idx === positiveItems.length - 1) {
        allocatedConcession = Math.min(remainingConcession, it.amount);
        remainingConcession = Math.max(0, Math.round((remainingConcession - allocatedConcession) * 100) / 100);
      }

      const netHeadTotal = Math.max(0, it.amount - allocatedConcession);
      const due = Math.max(0, netHeadTotal - it.paidAmount);

      return {
        id: it.id || ('head_' + idx + '_' + (it.headName || 'item').replace(/\s+/g, '_')),
        invoiceId: invoiceId,
        invoiceTitle: invoiceTitle,
        headName: it.headName,
        amount: it.amount,
        paidAmount: it.paidAmount,
        dueAmount: due,
        selected: due > 0,
        payingAmount: due,
        concessionAmount: allocatedConcession,
        concessionLabel: allocatedConcession > 0 ? (concessionLabel || 'Sibling Concession') : undefined
      };
    });
  }

  ngOnInit(): void {
    // The actual invoice-level outstanding due (ground truth from server)
    const invoiceDue = this.data.totalOutstandingDue > 0 ? this.data.totalOutstandingDue : 0;
    this.studentTotalOutstanding = this.data.initialAmount !== undefined
      ? this.data.initialAmount
      : (invoiceDue > 0 ? invoiceDue : 0);

    if (this.data.items && this.data.items.length > 0) {
      this.itemRows = this.buildReconciledRows(this.data.items, undefined, this.data.invoiceTitle);

      // Sum of all item-level dues as reported by server
      const itemsDueSum = this.itemRows.reduce((sum, r) => sum + r.dueAmount, 0);

      // ── PERMANENT FIX ──────────────────────────────────────────────────────
      // Scenario: Invoice is Partial (e.g. ₹12,000 paid out of ₹13,000 → due ₹1,000).
      // But item-level PaidAmounts may not be individually broken down yet,
      // causing ALL items to show dueAmount=0 → itemsDueSum=0 → textbox shows 0.
      // Fix: If items sum is 0 but invoice still has outstanding due, we
      // distribute the remaining invoiceDue across item heads using FIFO order.
      if (itemsDueSum === 0 && invoiceDue > 0) {
        let remaining = invoiceDue;
        for (const row of this.itemRows) {
          if (remaining <= 0) break;
          // Items that are not yet fully paid at invoice level
          const headCapacity = Math.max(0, (row.amount - (row.concessionAmount || 0)) - row.paidAmount);
          // Re-derive: treat items proportionally if item paidAmount=0 (old invoices)
          // Use item total as capacity if no paidAmount tracked
          const capacity = headCapacity > 0 ? headCapacity : Math.max(0, row.amount - (row.concessionAmount || 0));
          if (capacity <= 0) continue;
          const allocate = Math.round(Math.min(remaining, capacity) * 100) / 100;
          row.dueAmount = allocate;
          row.selected = true;
          row.payingAmount = allocate;
          remaining = Math.round((remaining - allocate) * 100) / 100;
        }
      } else if (itemsDueSum > 0 && Math.abs(itemsDueSum - invoiceDue) > 0.01) {
        // Items sum doesn't match invoice due (rounding / sync lag):
        // Scale the paying amounts proportionally so total matches invoiceDue
        const scale = invoiceDue / itemsDueSum;
        let distributed = 0;
        this.itemRows.forEach((r, idx) => {
          if (r.selected && r.dueAmount > 0) {
            if (idx === this.itemRows.length - 1) {
              // Last selected item gets remainder to avoid rounding drift, strictly rounded to 2 decimals
              r.payingAmount = Math.round(Math.max(0, invoiceDue - distributed) * 100) / 100;
            } else {
              r.payingAmount = Math.round(r.dueAmount * scale * 100) / 100;
              distributed = Math.round((distributed + r.payingAmount) * 100) / 100;
            }
          }
        });
      }
      // ───────────────────────────────────────────────────────────────────────

      this.baseTuitionAmount = this.itemRows.reduce((sum, r) => sum + (r.selected ? r.payingAmount : 0), 0);

      // Safety net: if baseTuitionAmount is still 0 but invoice has a due, bind it directly
      if (this.baseTuitionAmount === 0 && invoiceDue > 0) {
        this.baseTuitionAmount = invoiceDue;
      }
    } else {
      this.baseTuitionAmount = this.data.initialAmount !== undefined
        ? this.data.initialAmount
        : (invoiceDue > 0 ? invoiceDue : 0);
    }

    const isPureAdvanceMode = invoiceDue <= 0 && (this.data.initialAmount === undefined || this.data.initialAmount <= 0);
    if (isPureAdvanceMode) {
      this.customAdvanceCreditAmount = this.detectedMonthlyRate > 0 ? this.detectedMonthlyRate : 500;
    }

    const defaultRemarks = this.data.selectedInvoicesCount && this.data.selectedInvoicesCount > 1
      ? `Multi-Invoice Settlement (${this.data.selectedInvoicesCount} Invoices)`
      : (isPureAdvanceMode ? 'Advance Fee Deposit (FIFO Carry-Forward)' : 'Fee Payment');

    this.feeForm = this.fb.group({
      amountPaid: [this.baseTuitionAmount + this.customAdvanceCreditAmount, [Validators.required, Validators.min(1)]],
      mode: [1, [Validators.required]], // Default to UPI
      transactionRef: [''],
      remarks: [defaultRemarks],
      sendWhatsAppReceipt: [this.quickSettings.whatsappFeeAlerts()],
      includeLibraryFine: [true]
    });

    // Fetch student's pending library fines in background
    this.loadStudentLibraryDues();

    // Fetch unified pending invoices and item breakdown across all dues (Tuition, Kit, etc.)
    this.loadUnifiedStudentDues();

    // Initialize Advance Months options (if recurring tuition detected)
    this.initAdvanceMonthOptions();

    // Fetch Dynamic UPI parameters
    this.loadUpiSettings();

    // Re-render QR code on mode change or amount change
    this.feeForm.get('mode')?.valueChanges.subscribe(mode => {
      if (mode === 1) {
        setTimeout(() => this.generateCounterQr(), 100);
      }
    });

    this.feeForm.get('amountPaid')?.valueChanges.subscribe(() => {
      if (this.feeForm.get('mode')?.value === 1) {
        setTimeout(() => this.generateCounterQr(), 100);
      }
    });
  }

  get hasUnpaidItemRows(): boolean {
    return this.itemRows.some(r => r.dueAmount > 0);
  }

  get selectedCount(): number {
    return this.itemRows.filter(r => r.selected).length;
  }

  get selectedItemsTotal(): number {
    return this.itemRows.reduce((sum, r) => sum + (r.selected ? r.payingAmount : 0), 0);
  }

  get remainingDueAfterPay(): number {
    const billDue = Math.max(0, this.studentTotalOutstanding || 0);
    const entered = Number(this.feeForm?.get('amountPaid')?.value) || 0;
    return Math.max(0, Math.round((billDue - entered) * 100) / 100);
  }

  get totalAdvanceInPayment(): number {
    const optAdv = (this.selectedAdvanceOption && this.selectedAdvanceOption.monthCount > 0)
      ? this.selectedAdvanceOption.totalAmount
      : 0;
    return Math.round(((this.customAdvanceCreditAmount || 0) + optAdv) * 100) / 100;
  }

  isAllSelected(): boolean {
    return this.itemRows.length > 0 && this.itemRows.every(r => r.selected);
  }

  isSomeSelected(): boolean {
    const selected = this.itemRows.filter(r => r.selected).length;
    return selected > 0 && selected < this.itemRows.length;
  }

  onMasterCheckboxToggle(checked: boolean): void {
    this.itemRows.forEach(r => {
      r.selected = checked && r.dueAmount > 0;
      r.payingAmount = r.selected ? r.dueAmount : 0;
    });
    this.recalculateTotal();
  }

  onItemCheckboxToggle(row: FeeCollectionItemRow, checked: boolean): void {
    row.selected = checked;
    row.payingAmount = checked ? row.dueAmount : 0;
    this.recalculateTotal();
  }

  formatTwoDecimals(val: number): string {
    if (val === null || val === undefined || isNaN(val)) return '0.00';
    return (Math.round(val * 100) / 100).toFixed(2);
  }

  onItemPayingInputFocus(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      input.select();
    }
  }

  onItemPayingAmountInput(row: FeeCollectionItemRow, inputEl: HTMLInputElement): void {
    const raw = inputEl.value;
    if (raw === '' || raw === null || raw === undefined) {
      row.payingAmount = 0;
      this.recalculateTotal();
      return;
    }

    let val = parseFloat(raw);
    if (isNaN(val) || val < 0) {
      val = 0;
    }

    // STRICT USER REQUIREMENT:
    // User can reduce amount, but cannot enter more than the fee head due balance
    if (val > row.dueAmount) {
      val = row.dueAmount;
      inputEl.value = String(val);
    }

    row.payingAmount = Math.round(val * 100) / 100;
    // CRITICAL: row remains selected! Never auto-uncheck or auto-disable while editing!
    row.selected = true;
    this.recalculateTotal();
  }

  onItemPayingAmountBlur(row: FeeCollectionItemRow, inputEl: HTMLInputElement): void {
    if (row.payingAmount === null || row.payingAmount === undefined || isNaN(row.payingAmount) || row.payingAmount < 0) {
      row.payingAmount = 0;
    }
    row.payingAmount = Math.round(row.payingAmount * 100) / 100;
    if (inputEl) {
      inputEl.value = (Math.round(row.payingAmount * 100) / 100).toFixed(2);
    }
    this.recalculateTotal();
  }

  onItemPayingAmountChange(row: FeeCollectionItemRow, amount: number): void {
    const val = Number(amount);
    row.payingAmount = isNaN(val) ? 0 : Math.round(Math.min(row.dueAmount, Math.max(0, val)) * 100) / 100;
    this.recalculateTotal();
  }

  recalculateTotal(): void {
    const tuitionTotal = Math.round(this.itemRows.reduce((sum, r) => sum + (r.selected ? r.payingAmount : 0), 0) * 100) / 100;
    this.baseTuitionAmount = tuitionTotal;
    const libFine = (this.libraryDues && this.libraryDues.pendingFineAmount > 0 && this.feeForm.get('includeLibraryFine')?.value)
      ? Math.round(this.libraryDues.pendingFineAmount * 100) / 100
      : 0;
    const advanceTotal = (this.selectedAdvanceOption && this.selectedAdvanceOption.monthCount > 0)
      ? this.selectedAdvanceOption.totalAmount
      : 0;
    const newAmount = Math.round((tuitionTotal + libFine + advanceTotal + this.customAdvanceCreditAmount) * 100) / 100;
    this.feeForm.patchValue({ amountPaid: newAmount }, { emitEvent: false });
  }

  onTotalAmountFocus(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      input.select();
    }
  }

  onTotalAmountInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value;
    if (raw === '' || raw === null || raw === undefined) {
      this.customAdvanceCreditAmount = 0;
      return;
    }

    const entered = parseFloat(raw);
    if (isNaN(entered) || entered < 0) {
      this.customAdvanceCreditAmount = 0;
      return;
    }

    this.autoDistributeTotalAmount(entered);
  }

  onTotalAmountBlur(): void {
    const val = Number(this.feeForm.get('amountPaid')?.value);
    if (isNaN(val) || val <= 0) {
      this.customAdvanceCreditAmount = 0;
      this.recalculateTotal();
    } else {
      this.autoDistributeTotalAmount(val);
      this.recalculateTotal();
    }
  }

  autoDistributeTotalAmount(enteredTotal: number): void {
    const libFine = (this.libraryDues && this.libraryDues.pendingFineAmount > 0 && this.feeForm.get('includeLibraryFine')?.value)
      ? Math.round(this.libraryDues.pendingFineAmount * 100) / 100
      : 0;
    const advanceOptTotal = (this.selectedAdvanceOption && this.selectedAdvanceOption.monthCount > 0)
      ? this.selectedAdvanceOption.totalAmount
      : 0;

    let remaining = Math.max(0, Math.round((enteredTotal - libFine - advanceOptTotal) * 100) / 100);

    if (!this.itemRows || this.itemRows.length === 0) {
      const currentDue = Math.max(0, Math.round(((this.studentTotalOutstanding || 0) - libFine) * 100) / 100);
      this.customAdvanceCreditAmount = remaining > currentDue ? Math.round((remaining - currentDue) * 100) / 100 : 0;
      return;
    }

    const maxAvailableDues = Math.round(this.itemRows.reduce((sum, r) => sum + r.dueAmount, 0) * 100) / 100;
    if (remaining > maxAvailableDues) {
      this.customAdvanceCreditAmount = Math.round((remaining - maxAvailableDues) * 100) / 100;
      remaining = maxAvailableDues;
    } else {
      this.customAdvanceCreditAmount = 0;
    }

    // Sort items by priority for distribution:
    // 1. Oldest invoice heads first (chronological FIFO)
    // 2. Within the same invoice: Tuition > Transport > Coaching > Hostel/Mess > Exam > Supplies/Kit > Admission/Annual
    const indexed = this.itemRows.map((r, idx) => ({ row: r, originalIndex: idx }));
    indexed.sort((a, b) => {
      const invA = a.row.invoiceTitle || '';
      const invB = b.row.invoiceTitle || '';
      if (invA !== invB) {
        return a.originalIndex - b.originalIndex;
      }
      const pA = this.getFeeHeadPriority(a.row.headName);
      const pB = this.getFeeHeadPriority(b.row.headName);
      if (pA !== pB) return pA - pB;
      return a.originalIndex - b.originalIndex;
    });

    for (const item of indexed) {
      const r = item.row;
      if (r.dueAmount <= 0) {
        r.payingAmount = 0;
        r.selected = false;
        continue;
      }

      if (remaining <= 0) {
        r.payingAmount = 0;
        r.selected = false;
      } else {
        const alloc = Math.round(Math.min(remaining, r.dueAmount) * 100) / 100;
        r.payingAmount = alloc;
        r.selected = alloc > 0;
        remaining = Math.round((remaining - alloc) * 100) / 100;
      }
    }

    this.baseTuitionAmount = Math.round(this.itemRows.reduce((sum, r) => sum + (r.selected ? r.payingAmount : 0), 0) * 100) / 100;
  }

  getFeeHeadPriority(name: string): number {
    const l = (name || '').toLowerCase();
    if (l.includes('tuition')) return 1;
    if (l.includes('transport') || l.includes('bus') || l.includes('van')) return 2;
    if (l.includes('coaching')) return 3;
    if (l.includes('hostel') || l.includes('mess') || l.includes('bed')) return 4;
    if (l.includes('exam')) return 5;
    if (l.includes('book') || l.includes('syllabus') || l.includes('material')) return 6;
    if (l.includes('dress') || l.includes('uniform') || l.includes('kit') || l.includes('bag')) return 7;
    if (l.includes('admission') || l.includes('registration')) return 8;
    if (l.includes('annual') || l.includes('development')) return 9;
    return 10;
  }

  initAdvanceMonthOptions(): void {
    const rate = this.detectedMonthlyRate;
    if (rate <= 0 || (this.data.selectedInvoicesCount && this.data.selectedInvoicesCount > 1)) {
      this.advanceMonthOptions = [];
      this.selectedAdvanceOption = null;
      return;
    }

    let baseYear = new Date().getFullYear();
    let baseMonth = new Date().getMonth() + 1;

    if (this.data.invoiceDueDate) {
      const d = new Date(this.data.invoiceDueDate);
      if (!isNaN(d.getTime())) {
        baseYear = d.getFullYear();
        baseMonth = d.getMonth() + 1;
      }
    }

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const shortMonthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const makeMonthInfo = (offset: number) => {
      let m = baseMonth + offset;
      let y = baseYear;
      while (m > 12) {
        m -= 12;
        y += 1;
      }
      return {
        year: y,
        month: m,
        monthName: `${monthNames[m - 1]} ${y}`,
        shortName: `${shortMonthNames[m - 1]} ${y}`,
        dueDate: `${y}-${String(m).padStart(2, '0')}-10`
      };
    };

    const options: AdvanceMonthOption[] = [
      {
        monthCount: 0,
        label: 'Current Only',
        badgeLabel: 'None',
        periodSummary: 'No advance added',
        monthsList: [],
        totalAmount: 0
      }
    ];

    // +1 Month
    const m1 = makeMonthInfo(1);
    options.push({
      monthCount: 1,
      label: '+1 Month',
      badgeLabel: m1.shortName,
      periodSummary: m1.monthName,
      monthsList: [m1],
      totalAmount: Math.round(rate * 1 * 100) / 100
    });

    // +2 Months
    const m2 = makeMonthInfo(2);
    options.push({
      monthCount: 2,
      label: '+2 Months',
      badgeLabel: `${shortMonthNames[m1.month - 1]} & ${shortMonthNames[m2.month - 1]}`,
      periodSummary: `${m1.monthName} & ${m2.monthName}`,
      monthsList: [m1, m2],
      totalAmount: Math.round(rate * 2 * 100) / 100
    });

    // +3 Months (Quarter)
    const m3 = makeMonthInfo(3);
    options.push({
      monthCount: 3,
      label: '+3 Months (Quarter)',
      badgeLabel: `Till ${shortMonthNames[m3.month - 1]} '${String(m3.year).slice(-2)}`,
      periodSummary: `${m1.monthName} – ${m3.monthName}`,
      monthsList: [m1, m2, m3],
      totalAmount: Math.round(rate * 3 * 100) / 100
    });

    // Academic session ends in March
    let sessionEndOffset = 0;
    if (baseMonth >= 4 && baseMonth <= 10) {
      sessionEndOffset = (12 - baseMonth) + 3;
    } else if (baseMonth >= 11 && baseMonth <= 12) {
      sessionEndOffset = (12 - baseMonth) + 3;
    }

    if (sessionEndOffset > 3 && sessionEndOffset <= 11) {
      const fullList = [];
      for (let o = 1; o <= sessionEndOffset; o++) {
        fullList.push(makeMonthInfo(o));
      }
      const endMonthInfo = fullList[fullList.length - 1];
      options.push({
        monthCount: sessionEndOffset,
        label: `Till Session End (${sessionEndOffset} Mos)`,
        badgeLabel: `Till ${endMonthInfo.shortName}`,
        periodSummary: `${m1.monthName} – ${endMonthInfo.monthName}`,
        monthsList: fullList,
        totalAmount: Math.round(rate * sessionEndOffset * 100) / 100
      });
    }

    this.advanceMonthOptions = options;
    this.selectedAdvanceOption = options[0];
  }

  onSelectAdvanceOption(opt: AdvanceMonthOption): void {
    this.selectedAdvanceOption = opt;
    this.advanceAmountTotal = opt.totalAmount;
    if (opt.monthCount > 0) {
      this.customAdvanceCreditAmount = 0;
    } else if (this.baseTuitionAmount <= 0 && this.studentTotalOutstanding <= 0) {
      this.customAdvanceCreditAmount = this.detectedMonthlyRate > 0 ? this.detectedMonthlyRate : 500;
    }
    this.recalculateTotal();

    const currentRemarks = this.feeForm.get('remarks')?.value || '';
    if (opt.monthCount > 0) {
      this.feeForm.patchValue({
        remarks: `Fee Payment (Includes Advance: ${opt.badgeLabel})`
      });
    } else if (currentRemarks.includes('Includes Advance')) {
      this.feeForm.patchValue({
        remarks: 'Fee Payment'
      });
    }
  }

  get isHybrid(): boolean {
    if (this.data?.isHybrid !== undefined) return this.data.isHybrid;
    if (this.data?.className && this.data?.batchName) return true;
    const items = this.itemRows || this.data?.items || [];
    const hasCoaching = items.some(it => {
      const n = (it.headName || '').toLowerCase();
      return n.includes('coaching');
    });
    const hasSchool = items.some(it => {
      const n = (it.headName || '').toLowerCase();
      return n.includes('school') || n.includes('tuition') || n.includes('admission');
    });
    return (hasCoaching && hasSchool) || (!!this.data?.className && !!this.data?.batchName);
  }

  getStreamBadgeClass(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('hostel') || lower.includes('bed') || lower.includes('mess')) return 'badge-hostel';
    if (lower.includes('coaching') || lower.includes('guidance') || lower.includes('study material')) return 'badge-coaching';
    if (lower.includes('computer') || lower.includes('exam') || lower.includes('tuition')) return 'badge-school';
    if (lower.includes('shirt') || lower.includes('uniform') || lower.includes('dress') || lower.includes('pen') || lower.includes('kit') || lower.includes('book') || lower.includes('stationery') || lower.includes('bag') || lower.includes('belt') || lower.includes('tie')) return 'badge-kit';
    return 'badge-general';
  }

  getStreamBadgeText(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('hostel') || lower.includes('bed')) return '🏢 Hostel';
    if (lower.includes('mess')) return '🍽️ Mess';
    if (lower.includes('coaching') || lower.includes('guidance')) return '🎯 Coaching';
    if (lower.includes('study material')) return '📚 Material';
    if (lower.includes('computer')) return '💻 Lab';
    if (lower.includes('exam')) return '📝 Exam';
    if (lower.includes('tuition')) return '🏫 School';
    if (lower.includes('shirt') || lower.includes('uniform') || lower.includes('dress') || lower.includes('pen') || lower.includes('kit') || lower.includes('book') || lower.includes('stationery') || lower.includes('bag') || lower.includes('belt') || lower.includes('tie')) return '🎒 Kit';
    return '📋 Fee';
  }

  cleanHeadName(name: string): string {
    if (!name) return '';
    if (this.data?.className) {
      const rawCls = this.data.className.trim();
      const escapedRaw = rawCls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      name = name.replace(new RegExp(`\\s*\\(${escapedRaw}\\)\\s*`, 'gi'), ' ');
      const baseCls = rawCls.split('(')[0].trim();
      if (baseCls && baseCls !== rawCls) {
        const escapedBase = baseCls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        name = name.replace(new RegExp(`\\s*\\(${escapedBase}\\)\\s*`, 'gi'), ' ');
      }
    }
    name = name.replace(/\s*\(\s*(School|LKG|UKG|Nursery|Pre-Nursery|Prep)\s*\)\s*/gi, ' ');
    return name.trim();
  }

  loadStudentLibraryDues(): void {
    this.feesService.getStudentLibraryDues(this.data.studentId).subscribe({
      next: (dues) => {
        this.libraryDues = dues;
        if (dues && dues.pendingFineAmount > 0) {
          if (this.feeForm.get('includeLibraryFine')?.value) {
            this.recalculateTotal();
          }
        }
      },
      error: (err) => {
        console.warn('Library dues endpoint error:', err);
      }
    });
  }

  loadUnifiedStudentDues(): void {
    if (!this.data?.studentId) return;

    this.loadingDues = true;
    this.feesService.getStudentDueSlip(this.data.studentId).subscribe({
      next: (dueSlip) => {
        this.loadingDues = false;
        if (!dueSlip || !dueSlip.dueItems || dueSlip.dueItems.length === 0) return;

        this.studentTotalOutstanding = dueSlip.totalOutstandingDue;
        this.totalInvoicesCount = dueSlip.dueItems.length;

        const unifiedRows: FeeCollectionItemRow[] = [];
        for (const inv of dueSlip.dueItems) {
          if (inv.breakdown && inv.breakdown.length > 0) {
            const rowsForInv = this.buildReconciledRows(inv.breakdown, inv.invoiceId, inv.title);
            for (const r of rowsForInv) {
              if (r.dueAmount > 0 || r.selected) {
                unifiedRows.push(r);
              }
            }
          } else if (inv.dueAmount > 0) {
            unifiedRows.push({
              id: inv.invoiceId,
              invoiceId: inv.invoiceId,
              invoiceTitle: inv.title,
              headName: inv.title || 'Fee Bill',
              amount: inv.totalAmount,
              paidAmount: inv.paidAmount,
              dueAmount: inv.dueAmount,
              selected: true,
              payingAmount: inv.dueAmount
            });
          }
        }

        if (unifiedRows.length > 0) {
          this.itemRows = unifiedRows;
          this.recalculateTotal();
          this.initAdvanceMonthOptions();
        }
      },
      error: (err) => {
        this.loadingDues = false;
        console.warn('Could not load unified student due slip, falling back to invoice items', err);
      }
    });
  }

  onIncludeFineToggle(included: boolean): void {
    this.recalculateTotal();
  }

  getPaymentModeText(mode: number): string {
    switch (mode) {
      case 0: return 'Cash';
      case 1: return 'UPI / Online';
      case 2: return 'Bank Transfer / NetBanking';
      case 3: return 'Cheque';
      default: return 'Payment';
    }
  }

  async onSubmit(): Promise<void> {
    if (this.feeForm.invalid || this.saving) return;

    const formVal = this.feeForm.value;
    const amount = Math.round(Number(formVal.amountPaid) * 100) / 100;
    if (amount <= 0) return;

    const studentName = this.data.studentName || 'Student';
    const modeName = this.getPaymentModeText(Number(formVal.mode));
    const formattedAmount = '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const selectedRows = this.itemRows.filter(r => r.selected && r.payingAmount > 0);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const detectedPeriods: string[] = [];

    for (const r of selectedRows) {
      const text = `${r.invoiceTitle || ''} ${r.headName || ''}`;
      let foundMonth = '';
      for (const m of monthNames) {
        if (new RegExp(`\\b${m}\\b`, 'i').test(text)) {
          const matchYear = text.match(/\b(20\d\d)\b/);
          foundMonth = matchYear ? `${m} ${matchYear[1]}` : m;
          break;
        }
      }
      if (foundMonth && !detectedPeriods.includes(foundMonth)) {
        detectedPeriods.push(foundMonth);
      } else if (!foundMonth) {
        const fallback = r.invoiceTitle || r.headName;
        if (!detectedPeriods.includes(fallback)) {
          detectedPeriods.push(fallback);
        }
      }
    }

    const periodSuffix = detectedPeriods.length > 0 ? ` (${detectedPeriods.join(', ')})` : '';

    const confirmed = await firstValueFrom(this.confirmDialog.confirm(
      'Confirm Fee Collection?',
      `Are you sure you want to collect ${formattedAmount} via ${modeName} for ${studentName}${periodSuffix} and issue the official receipt?`,
      'Yes, Collect & Issue Receipt',
      'Cancel',
      'info'
    ));

    if (!confirmed) return;

    this.saving = true;
    const includeLibFine = this.libraryDues && this.libraryDues.pendingFineAmount > 0 && formVal.includeLibraryFine;

    // ── STEP 1: Pre-generate advance invoices if advance months selected ──
    if (this.selectedAdvanceOption && this.selectedAdvanceOption.monthCount > 0) {
      try {
        for (const m of this.selectedAdvanceOption.monthsList) {
          await firstValueFrom(this.feesService.generateMonthlyInvoices({
            year: m.year,
            month: m.month,
            studentId: this.data.studentId,
            dueDate: m.dueDate,
            billingCycle: 1
          }));
        }
      } catch (err: any) {
        console.error('Failed to pre-generate advance month invoices:', err);
        this.saving = false;
        this.confirmDialog.alert(
          'Advance Invoicing Failed',
          err?.error?.message || err?.message || 'Could not generate advance month invoice. Please try again.',
          'danger'
        );
        return;
      }
    }

    // ── STEP 2: Collect payment & settle dues via FIFO ──
    const itemPayments: FeeItemPayment[] | undefined = this.itemRows.length > 0
      ? this.itemRows
          .filter(r => r.selected && r.payingAmount > 0)
          .map(r => ({ itemId: r.id, amount: Math.round(r.payingAmount * 100) / 100 }))
      : undefined;

    const payload = {
      studentId: this.data.studentId,
      amountPaid: Math.round(Number(formVal.amountPaid) * 100) / 100,
      mode: Number(formVal.mode),
      transactionRef: formVal.transactionRef || undefined,
      remarks: (formVal.remarks && formVal.remarks !== 'Fee Payment')
        ? formVal.remarks
        : (detectedPeriods.length > 0 ? `Fee Payment (${detectedPeriods.join(', ')})` : formVal.remarks || undefined),
      sendWhatsAppReceipt: !!formVal.sendWhatsAppReceipt,
      includeLibraryFine: !!includeLibFine,
      libraryCirculationIds: includeLibFine && this.libraryDues ? this.libraryDues.pendingFines.map(f => f.circulationId) : [],
      itemPayments: itemPayments
    };

    this.feesService.collectFeeFifo(payload).subscribe({
      next: (res) => {
        this.saving = false;
        this.dialogRef.close(res);
      },
      error: (err) => {
        this.saving = false;
        this.confirmDialog.alert('Collection Failed', err?.error?.message || 'Error processing fee collection', 'danger');
      }
    });
  }

  loadUpiSettings(): void {
    const branchId = this.authService.selectedBranchId() || undefined;
    this.feesService.getUpiSettings(branchId).subscribe({
      next: (settings) => {
        if (settings) {
          this.activeVpa = settings.upiId || 'imserp.fees@sbi';
          this.merchantName = settings.upiMerchantName || this.authService.getInstituteName() || '';
          if (this.feeForm?.get('mode')?.value === 1) {
            setTimeout(() => this.generateCounterQr(), 100);
          }
        }
      },
      error: () => {
        this.activeVpa = 'imserp.fees@sbi';
        this.merchantName = this.authService.getInstituteName() || '';
        if (this.feeForm?.get('mode')?.value === 1) {
          setTimeout(() => this.generateCounterQr(), 100);
        }
      }
    });
  }

  generateCounterQr(): void {
    if (!this.counterQrCanvas?.nativeElement) return;
    const amount = Number(this.feeForm?.get('amountPaid')?.value || 0);
    if (amount <= 0) return;

    const vpa = this.activeVpa || 'imserp.fees@sbi';
    const payee = encodeURIComponent(this.merchantName || '');
    const formattedAmt = amount.toFixed(2);
    const note = encodeURIComponent(`Fee ${this.data?.studentName || ''}`);
    const txnRef = `FEE${Date.now().toString().slice(-6)}`;

    const upiUri = `upi://pay?pa=${vpa}&pn=${payee}&am=${formattedAmt}&cu=INR&tn=${note}&tr=${txnRef}&mc=8211`;

    QRCode.toCanvas(this.counterQrCanvas.nativeElement, upiUri, {
      width: 130,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    }).catch(err => console.error('Error generating counter QR canvas:', err));
  }

  vpaCopied = false;
  copyVpa(): void {
    if (this.activeVpa) {
      navigator.clipboard?.writeText(this.activeVpa);
      this.vpaCopied = true;
      setTimeout(() => { this.vpaCopied = false; }, 2500);
      this.confirmDialog.alert('Copied', `Institute VPA ${this.activeVpa} copied to clipboard.`);
    }
  }

  getTransactionRefLabel(): string {
    switch (this.feeForm?.get('mode')?.value) {
      case 0: return 'Cash Memo / Receipt Ref (Optional)';
      case 1: return '12-Digit UPI UTR / Transaction Ref';
      case 2: return 'Bank NEFT / RTGS / UTR Ref No';
      case 3: return 'Cheque No & Bank Details';
      default: return 'Transaction / Reference No';
    }
  }

  getTransactionRefPlaceholder(): string {
    switch (this.feeForm?.get('mode')?.value) {
      case 0: return 'Optional (e.g. Desk Cash Voucher #104)';
      case 1: return 'Enter 12-digit UPI UTR from payment app';
      case 2: return 'Enter Bank NEFT / RTGS / IMPS Ref No';
      case 3: return 'e.g. Chq #000124 - SBI Main Branch';
      default: return 'Reference or Transaction No';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
