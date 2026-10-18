import { Component, Inject, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import * as QRCode from 'qrcode';
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
}

export interface FeeCollectionItemRow {
  id: string;
  headName: string;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  selected: boolean;
  payingAmount: number;
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
      <button mat-icon-button type="button" class="close-x-btn" (click)="onCancel()" [disabled]="saving" matTooltip="Close">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <form [formGroup]="feeForm" (ngSubmit)="onSubmit()">
      <mat-dialog-content class="dialog-content">
        <!-- Student Info Header Card -->
        <div class="student-info-box">
          <div class="info-details">
            <span class="st-name">{{ data.studentName }} ({{ data.rollNumber }})</span>
            <span class="st-sub">
              <span *ngIf="data.className" class="st-school-chip">
                🏫 {{ data.className }}<span *ngIf="data.sectionName"> ({{ data.sectionName }})</span>
              </span>
              <span *ngIf="data.className && data.batchName" class="st-sep">•</span>
              <span *ngIf="data.batchName" class="st-batch-chip">
                🎯 {{ data.batchName }}
              </span>
              <span *ngIf="effectiveBranchName" class="st-branch-chip">
                🏛️ {{ effectiveBranchName }}
              </span>
              <span class="st-sep">|</span>
              <span class="st-wa-text">WA: {{ data.parentWhatsAppPhone }}</span>
            </span>
            <div *ngIf="data.hostelInfo" class="hostel-badge">
              <mat-icon class="hostel-icon">home</mat-icon>
              <span>🏠 Hosteler: <strong>{{ data.hostelInfo }}</strong></span>
            </div>
            <div *ngIf="data.selectedInvoicesCount && data.selectedInvoicesCount > 1" class="multi-select-pill">
              <mat-icon class="mini-icon">layers</mat-icon>
              <span>Settling <strong>{{ data.selectedInvoicesCount }} Invoices</strong> in this payment</span>
            </div>
          </div>
          <div class="due-badge">
            <span class="due-label">{{ data.selectedInvoicesCount && data.selectedInvoicesCount > 1 ? 'Selected Invoices Total:' : 'Total Net Outstanding:' }}</span>
            <strong class="due-amount">₹{{ (data.initialAmount !== undefined ? data.initialAmount : data.totalOutstandingDue) | number:'1.2-2' }}</strong>
          </div>
        </div>

        <!-- Fee Heads Itemized Checklist Table -->
        <div class="heads-breakdown-card" *ngIf="itemRows.length > 0">
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
                  <th style="width: 40px; text-align: center;">Pay</th>
                  <th>Fee Head Particulars</th>
                  <th class="text-right">Total Fee</th>
                  <th class="text-right">Due Balance</th>
                  <th class="text-right" style="width: 140px;">Paying Now (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of itemRows" [class.row-selected]="row.selected" [class.row-disabled]="row.dueAmount <= 0">
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
                      <span class="head-name">{{ row.headName }}</span>
                      <span class="head-stream-badge" [ngClass]="getStreamBadgeClass(row.headName)">
                        {{ getStreamBadgeText(row.headName) }}
                      </span>
                    </div>
                  </td>
                  <td class="text-right fee-col">₹{{ row.amount | number:'1.2-2' }}</td>
                  <td class="text-right due-col">
                    <strong [class.due-positive]="row.dueAmount > 0" [class.due-zero]="row.dueAmount === 0">
                      ₹{{ row.dueAmount | number:'1.2-2' }}
                    </strong>
                  </td>
                  <td class="text-right pay-col">
                    <div class="paying-input-wrap">
                      <span class="curr-symbol">₹</span>
                      <input
                        type="number"
                        class="paying-input"
                        [disabled]="!row.selected || row.dueAmount <= 0"
                        [value]="formatTwoDecimals(row.payingAmount)"
                        (input)="onItemPayingAmountChange(row, +$any($event.target).value)"
                        [max]="row.dueAmount"
                        step="0.01"
                        min="0" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Advance Tuition Bundling Card (Optional) -->
        <div class="advance-payment-card" *ngIf="advanceMonthOptions.length > 1 && (!data.selectedInvoicesCount || data.selectedInvoicesCount <= 1)">
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
            <div class="adv-header-right" *ngIf="selectedAdvanceOption && selectedAdvanceOption.monthCount > 0">
              <span class="adv-added-badge">
                Advance: +₹{{ selectedAdvanceOption.totalAmount | number:'1.2-2' }}
              </span>
            </div>
          </div>

          <div class="adv-options-grid">
            <button
              type="button"
              *ngFor="let opt of advanceMonthOptions"
              class="adv-option-btn"
              [class.active]="selectedAdvanceOption?.monthCount === opt.monthCount"
              (click)="onSelectAdvanceOption(opt)">
              <div class="btn-top">
                <span class="opt-label">{{ opt.label }}</span>
                <mat-icon class="opt-check-icon" *ngIf="selectedAdvanceOption?.monthCount === opt.monthCount">check_circle</mat-icon>
              </div>
              <div class="btn-meta">
                <span class="opt-period">{{ opt.badgeLabel }}</span>
                <strong class="opt-cost" [class.free]="opt.totalAmount === 0">
                  {{ opt.totalAmount === 0 ? 'Current Only' : '+₹' + (opt.totalAmount | number:'1.0-0') }}
                </strong>
              </div>
            </button>
          </div>

          <!-- Informational Callout when an advance option is selected -->
          <div class="adv-notice-callout" *ngIf="selectedAdvanceOption && selectedAdvanceOption.monthCount > 0">
            <mat-icon class="notice-icon">verified</mat-icon>
            <div class="notice-text">
              <strong>Advance Settlement Active:</strong>
              {{ selectedAdvanceOption.periodSummary }} recurring fee (+₹{{ selectedAdvanceOption.totalAmount | number:'1.2-2' }}) will be bundled into this single receipt. Upcoming monthly invoices will be pre-generated and marked Paid automatically.
            </div>
          </div>
        </div>

        <!-- Library Dues Card (if student has pending library fines) -->
        <div class="library-fine-box" *ngIf="libraryDues && libraryDues.pendingFineAmount > 0">
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
            <div *ngFor="let item of libraryDues.pendingFines" class="book-chip">
              <mat-icon class="chip-icon">menu_book</mat-icon>
              <span class="book-title">{{ item.bookTitle }}</span>
              <span class="chip-sep">•</span>
              <span class="acc-tag">{{ item.accessionNumber }}</span>
              <span class="chip-sep">•</span>
              <span class="overdue-tag">{{ item.overdueDays }}d late</span>
              <span class="unreturned-pill" *ngIf="!item.returnDate">Not Returned Yet</span>
              <strong class="chip-fine">₹{{ item.fineAmount | number:'1.2-2' }}</strong>
            </div>
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

        <!-- Payment Details Form Grid -->
        <div class="form-grid">
          <mat-form-field appearance="outline" class="full-width" [class.amount-readonly-field]="itemRows.length > 0">
            <mat-label>Total Amount to Collect (₹)</mat-label>
            <input
              matInput
              type="number"
              formControlName="amountPaid"
              placeholder="e.g. 4500"
              [readonly]="itemRows.length > 0"
              [style.cursor]="itemRows.length > 0 ? 'not-allowed' : 'text'" />
            <mat-icon matSuffix [color]="itemRows.length > 0 ? '' : 'primary'">
              {{ itemRows.length > 0 ? 'lock' : 'currency_rupee' }}
            </mat-icon>
            <mat-hint *ngIf="itemRows.length > 0">
              🔒 Auto-computed from selected fee heads — select/deselect rows above to adjust
            </mat-hint>
            <mat-hint *ngIf="itemRows.length === 0">Enter the total amount to collect</mat-hint>
            <mat-error *ngIf="feeForm.get('amountPaid')?.hasError('required')">Amount is required</mat-error>
            <mat-error *ngIf="feeForm.get('amountPaid')?.hasError('min')">Amount must be greater than 0</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Payment Mode</mat-label>
            <mat-select formControlName="mode">
              <mat-option [value]="0">Cash</mat-option>
              <mat-option [value]="1">UPI / GPay / PhonePe</mat-option>
              <mat-option [value]="2">Bank Transfer / NetBanking</mat-option>
              <mat-option [value]="3">Cheque</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Transaction / UTR Ref No</mat-label>
            <input matInput formControlName="transactionRef" placeholder="e.g. 12-digit UPI UTR" />
          </mat-form-field>

          <!-- Dynamic UPI Counter QR Code Panel (Visible when Payment Mode is UPI = 1) -->
          <div class="dynamic-upi-counter-card full-width" *ngIf="feeForm.get('mode')?.value === 1">
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
                <button mat-button type="button" class="btn-refresh-mini" (click)="generateCounterQr()" matTooltip="Regenerate QR">
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
                <div class="vpa-compact-bar" *ngIf="activeVpa">
                  <div class="vpa-text-box">
                    <span class="vpa-label">Institute VPA:</span>
                    <strong class="vpa-id">{{ activeVpa }}</strong>
                    <span class="vpa-payee" *ngIf="merchantName">({{ merchantName }})</span>
                  </div>
                  <button mat-icon-button type="button" class="copy-vpa-btn" (click)="copyVpa()" matTooltip="Copy UPI ID">
                    <mat-icon>content_copy</mat-icon>
                  </button>
                </div>

                <!-- 3 Micro-Steps in Horizontal Flow -->
                <div class="upi-steps-row">
                  <div class="micro-step">
                    <span class="step-badge">1</span>
                    <span class="step-desc">Scan with UPI App</span>
                  </div>
                  <mat-icon class="step-arrow">chevron_right</mat-icon>
                  <div class="micro-step">
                    <span class="step-badge">2</span>
                    <span class="step-desc">Verify confirmation</span>
                  </div>
                  <mat-icon class="step-arrow">chevron_right</mat-icon>
                  <div class="micro-step highlight">
                    <span class="step-badge">3</span>
                    <span class="step-desc">Enter 12-digit UTR above</span>
                  </div>
                </div>

                <!-- Supported Apps Pills -->
                <div class="upi-apps-chips">
                  <span class="apps-label">Supported:</span>
                  <span class="app-chip">GPay</span>
                  <span class="app-chip">PhonePe</span>
                  <span class="app-chip">Paytm</span>
                  <span class="app-chip">BHIM</span>
                  <span class="app-chip">CRED / Any UPI</span>
                </div>
              </div>
            </div>
          </div>

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
        <button mat-stroked-button type="button" class="btn-cancel" (click)="onCancel()" [disabled]="saving">Cancel</button>
        <button mat-raised-button color="primary" type="submit" class="btn-confirm" [disabled]="feeForm.invalid || saving || (feeForm.get('amountPaid')?.value || 0) <= 0">
          <mat-spinner diameter="18" *ngIf="saving" class="spinner"></mat-spinner>
          <mat-icon *ngIf="!saving">receipt_long</mat-icon>
          <span *ngIf="saving && selectedAdvanceOption && selectedAdvanceOption.monthCount > 0">Bundling Advance &amp; Settling...</span>
          <span *ngIf="saving && (!selectedAdvanceOption || selectedAdvanceOption.monthCount === 0)">Processing Payment...</span>
          <span *ngIf="!saving">Confirm &amp; Issue Receipt</span>
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      overflow: hidden;
    }

    .dialog-header-wrap {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px 24px 16px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;

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

    .dialog-content {
      width: 100%;
      box-sizing: border-box;
      padding: 18px 24px;
      max-height: 75vh;
      overflow-y: auto;
      overflow-x: hidden;
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

      .info-details {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;

        .st-name {
          font-weight: 700;
          font-size: 1.05rem;
          color: #0f172a;
        }

        .st-sub {
          font-size: 0.82rem;
          color: #64748b;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 3px;

          .st-school-chip {
            color: #0369a1;
            font-weight: 600;
            background: #e0f2fe;
            padding: 1px 6px;
            border-radius: 4px;
            border: 1px solid #bae6fd;
            display: inline-flex;
            align-items: center;
            gap: 4px;
          }

          .st-batch-chip {
            color: #6d28d9;
            font-weight: 600;
            background: #ede9fe;
            padding: 1px 6px;
            border-radius: 4px;
            border: 1px solid #ddd6fe;
            display: inline-flex;
            align-items: center;
            gap: 4px;
          }

          .st-branch-chip {
            color: #1e40af;
            font-weight: 700;
            background: #eff6ff;
            padding: 1px 6px;
            border-radius: 4px;
            border: 1px solid #bfdbfe;
            display: inline-flex;
            align-items: center;
            gap: 4px;
          }

          .st-sep {
            color: #cbd5e1;
            font-weight: bold;
          }

          .st-wa-text {
            color: #16a34a;
            font-weight: 500;
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
        padding: 6px 14px;

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

      .breakdown-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;

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
        }
      }

      .heads-table-wrap {
        max-height: 250px;
        overflow-y: auto;
      }

      .heads-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;

        thead {
          background: #f1f5f9;
          position: sticky;
          top: 0;
          z-index: 1;

          th {
            padding: 8px 10px;
            font-size: 0.75rem;
            font-weight: 600;
            color: #475569;
            text-transform: uppercase;
            border-bottom: 1px solid #cbd5e1;
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
              padding: 8px 10px;
              vertical-align: middle;
            }
          }
        }

        .head-info {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;

          .head-name {
            font-weight: 600;
            color: #1e293b;
          }

          .head-stream-badge {
            font-size: 0.68rem;
            padding: 1px 6px;
            border-radius: 4px;
            font-weight: 500;

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

            &:focus-within {
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

              &:disabled {
                color: #94a3b8;
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
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: 8px;
        padding: 12px;

        .adv-option-btn {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 8px 10px;
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
            align-items: center;

            .opt-label {
              font-size: 0.76rem;
              font-weight: 700;
              color: #334155;
            }

            .opt-check-icon {
              font-size: 14px;
              width: 14px;
              height: 14px;
              color: #2563eb;
            }
          }

          .btn-meta {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: 4px;

            .opt-period {
              font-size: 0.68rem;
              color: #64748b;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .opt-cost {
              font-size: 0.8rem;
              font-weight: 700;
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

      .full-width {
        flex: 1 1 100%;
        width: 100%;
      }
      .half-width {
        flex: 1 1 calc(50% - 6px);
        min-width: 200px;
      }

      .amount-readonly-field {
        .mat-mdc-text-field-wrapper {
          background: #f8fafc !important;
        }
        input {
          color: #334155 !important;
          font-weight: 700 !important;
          font-size: 1.05rem !important;
          cursor: not-allowed !important;
        }
        .mat-mdc-floating-label {
          color: #64748b !important;
        }
      }
    }

    .whatsapp-toggle-box {
      background: #f0fdf4;
      border: 1px dashed #86efac;
      border-radius: 8px;
      padding: 8px 14px;
      margin-top: 4px;

      .wa-toggle-label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #15803d;
        font-size: 0.85rem;

        .wa-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #16a34a;
        }
      }
    }

    /* Dynamic UPI Counter Card - Compact, High-Tech, Zero-Overflow */
    .dynamic-upi-counter-card {
      background: linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%);
      border: 1px solid #86efac;
      border-radius: 12px;
      padding: 10px 14px;
      margin-bottom: 8px;
      box-shadow: 0 2px 8px rgba(22, 163, 74, 0.08);

      .upi-card-inner {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 14px;
        align-items: center;

        @media (max-width: 600px) {
          grid-template-columns: 1fr;
          gap: 10px;
        }
      }

      .qr-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;

        .qr-frame {
          position: relative;
          background: #ffffff;
          padding: 5px;
          border-radius: 8px;
          border: 1.5px solid #16a34a;
          box-shadow: 0 3px 6px rgba(0, 0, 0, 0.06);
          display: flex;
          align-items: center;
          justify-content: center;

          .counter-qr-canvas {
            display: block;
            width: 115px !important;
            height: 115px !important;
          }

          .scan-corner {
            position: absolute;
            width: 8px;
            height: 8px;
            border-color: #16a34a;
            border-style: solid;
            pointer-events: none;

            &.top-left {
              top: 2px;
              left: 2px;
              border-width: 2px 0 0 2px;
              border-top-left-radius: 3px;
            }
            &.top-right {
              top: 2px;
              right: 2px;
              border-width: 2px 2px 0 0;
              border-top-right-radius: 3px;
            }
            &.bottom-left {
              bottom: 2px;
              left: 2px;
              border-width: 0 0 2px 2px;
              border-bottom-left-radius: 3px;
            }
            &.bottom-right {
              bottom: 2px;
              right: 2px;
              border-width: 0 2px 2px 0;
              border-bottom-right-radius: 3px;
            }
          }
        }

        .btn-refresh-mini {
          height: 22px;
          line-height: 22px;
          padding: 0 6px;
          font-size: 0.7rem;
          color: #15803d;
          font-weight: 600;
          border-radius: 4px;

          mat-icon {
            font-size: 13px;
            width: 13px;
            height: 13px;
            margin-right: 3px;
          }
          &:hover {
            background: #dcfce7;
          }
        }
      }

      .upi-info-col {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;

        .upi-info-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 6px;

          .upi-brand-badge {
            display: flex;
            align-items: center;
            gap: 6px;

            .brand-icon {
              font-size: 18px;
              width: 18px;
              height: 18px;
              color: #16a34a;
            }
            strong {
              font-size: 0.86rem;
              color: #14532d;
              font-weight: 700;
            }
            .zero-fee-badge {
              background: #dcfce7;
              color: #15803d;
              font-size: 0.68rem;
              font-weight: 700;
              padding: 1px 6px;
              border-radius: 10px;
              border: 1px solid #86efac;
            }
          }

          .upi-amount-pill {
            background: #dcfce7;
            border: 1px solid #86efac;
            border-radius: 16px;
            padding: 2px 8px;
            display: inline-flex;
            align-items: center;
            gap: 4px;

            .amt-lbl {
              font-size: 0.7rem;
              color: #15803d;
              font-weight: 600;
            }
            .amt-val {
              font-size: 0.92rem;
              color: #14532d;
              font-weight: 800;
            }
          }
        }

        .vpa-compact-bar {
          background: #ffffff;
          border: 1px solid #bbf7d0;
          border-radius: 6px;
          padding: 3px 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;

          .vpa-text-box {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.78rem;
            min-width: 0;
            overflow: hidden;

            .vpa-label {
              color: #64748b;
              font-weight: 600;
              font-size: 0.7rem;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              flex-shrink: 0;
            }
            .vpa-id {
              color: #0f172a;
              font-family: 'SF Mono', Consolas, Monaco, monospace;
              font-weight: 700;
              font-size: 0.82rem;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .vpa-payee {
              color: #64748b;
              font-size: 0.72rem;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          }

          .copy-vpa-btn {
            width: 24px;
            height: 24px;
            line-height: 24px;
            flex-shrink: 0;
            color: #16a34a;
            mat-icon {
              font-size: 14px;
              width: 14px;
              height: 14px;
            }
            &:hover {
              background: #f0fdf4;
            }
          }
        }

        .upi-steps-row {
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(255, 255, 255, 0.75);
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 4px 6px;

          .micro-step {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 0.72rem;
            color: #475569;
            min-width: 0;

            .step-badge {
              width: 15px;
              height: 15px;
              border-radius: 50%;
              background: #16a34a;
              color: #ffffff;
              font-size: 0.62rem;
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
              font-weight: 600;
              .step-badge {
                background: #2563eb;
              }
            }
          }

          .step-arrow {
            font-size: 13px;
            width: 13px;
            height: 13px;
            color: #94a3b8;
            flex-shrink: 0;
          }
        }

        .upi-apps-chips {
          display: flex;
          align-items: center;
          gap: 5px;

          .apps-label {
            font-size: 0.68rem;
            color: #64748b;
            font-weight: 600;
          }

          .app-chip {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 3px;
            padding: 1px 5px;
            font-size: 0.65rem;
            font-weight: 600;
            color: #475569;
          }
        }
      }
    }

    .dialog-actions {
      padding: 14px 24px 16px;
      border-top: 1px solid #bfdbfe;
      background: #f8fafc;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin: 0;

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
  advanceMonthOptions: AdvanceMonthOption[] = [];
  selectedAdvanceOption: AdvanceMonthOption | null = null;
  advanceAmountTotal: number = 0;

  @ViewChild('counterQrCanvas') counterQrCanvas?: ElementRef<HTMLCanvasElement>;
  activeVpa: string = '';
  merchantName: string = '';

  get recurringTuitionItems(): FeeCollectionItemRow[] {
    return this.itemRows.filter(r => {
      const name = r.headName.toLowerCase();
      return name.includes('tuition') || name.includes('monthly') || name.includes('coaching fee') ||
             name.includes('transport') || name.includes('bus') || name.includes('van');
    });
  }

  get detectedMonthlyRate(): number {
    const tuitionItems = this.recurringTuitionItems;
    if (tuitionItems.length > 0) {
      return tuitionItems.reduce((sum, it) => sum + it.amount, 0);
    }
    if (this.itemRows.length === 1) {
      const name = this.itemRows[0].headName.toLowerCase();
      if (!name.includes('admission') && !name.includes('registration') && !name.includes('uniform') && !name.includes('book')) {
        return this.itemRows[0].amount;
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

  ngOnInit(): void {
    // The actual invoice-level outstanding due (ground truth from server)
    const invoiceDue = this.data.totalOutstandingDue > 0 ? this.data.totalOutstandingDue : 0;

    if (this.data.items && this.data.items.length > 0) {
      this.itemRows = this.data.items.map(it => {
        const due = Math.max(0, it.amount - it.paidAmount);
        return {
          id: it.id,
          headName: it.headName,
          amount: it.amount,
          paidAmount: it.paidAmount,
          dueAmount: due,
          selected: due > 0,
          payingAmount: due
        };
      });

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
          const headCapacity = Math.max(0, row.amount - row.paidAmount);
          // Re-derive: treat items proportionally if item paidAmount=0 (old invoices)
          // Use item total as capacity if no paidAmount tracked
          const capacity = headCapacity > 0 ? headCapacity : row.amount;
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
        : (invoiceDue > 0 ? invoiceDue : 3500);
    }

    const defaultRemarks = this.data.selectedInvoicesCount && this.data.selectedInvoicesCount > 1
      ? `Multi-Invoice Settlement (${this.data.selectedInvoicesCount} Invoices)`
      : 'Fee Payment';

    this.feeForm = this.fb.group({
      amountPaid: [this.baseTuitionAmount, [Validators.required, Validators.min(1)]],
      mode: [1, [Validators.required]], // Default to UPI
      transactionRef: [''],
      remarks: [defaultRemarks],
      sendWhatsAppReceipt: [this.quickSettings.whatsappFeeAlerts()],
      includeLibraryFine: [true]
    });

    // Fetch student's pending library fines in background
    this.loadStudentLibraryDues();

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

  get selectedCount(): number {
    return this.itemRows.filter(r => r.selected).length;
  }

  get selectedItemsTotal(): number {
    return this.itemRows.reduce((sum, r) => sum + (r.selected ? r.payingAmount : 0), 0);
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

  onItemPayingAmountChange(row: FeeCollectionItemRow, amount: number): void {
    const val = Number(amount);
    row.payingAmount = isNaN(val) ? 0 : Math.round(Math.min(row.dueAmount, Math.max(0, val)) * 100) / 100;
    row.selected = row.payingAmount > 0;
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
    const newAmount = Math.round((tuitionTotal + libFine + advanceTotal) * 100) / 100;
    this.feeForm.patchValue({ amountPaid: newAmount }, { emitEvent: false });
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

  getStreamBadgeClass(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('hostel') || lower.includes('bed') || lower.includes('mess')) return 'badge-hostel';
    if (lower.includes('coaching') || lower.includes('guidance') || lower.includes('study material')) return 'badge-coaching';
    if (lower.includes('computer') || lower.includes('exam') || lower.includes('tuition')) return 'badge-school';
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
    return '📋 Fee';
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

  onIncludeFineToggle(included: boolean): void {
    this.recalculateTotal();
  }

  async onSubmit(): Promise<void> {
    if (this.feeForm.invalid || this.saving) return;

    this.saving = true;
    const formVal = this.feeForm.value;
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
      remarks: formVal.remarks || undefined,
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
          this.merchantName = settings.upiMerchantName || this.authService.getInstituteName() || 'Jnandeep Campus';
          if (this.feeForm?.get('mode')?.value === 1) {
            setTimeout(() => this.generateCounterQr(), 100);
          }
        }
      },
      error: () => {
        this.activeVpa = 'imserp.fees@sbi';
        this.merchantName = this.authService.getInstituteName() || 'Jnandeep Campus';
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
    const payee = encodeURIComponent(this.merchantName || 'Jnandeep Campus');
    const formattedAmt = amount.toFixed(2);
    const note = encodeURIComponent(`Fee ${this.data?.studentName || ''}`);
    const txnRef = `FEE${Date.now().toString().slice(-6)}`;

    const upiUri = `upi://pay?pa=${vpa}&pn=${payee}&am=${formattedAmt}&cu=INR&tn=${note}&tr=${txnRef}&mc=8211`;

    QRCode.toCanvas(this.counterQrCanvas.nativeElement, upiUri, {
      width: 115,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    }).catch(err => console.error('Error generating counter QR canvas:', err));
  }

  copyVpa(): void {
    if (this.activeVpa) {
      navigator.clipboard?.writeText(this.activeVpa);
      this.confirmDialog.alert('Copied', `Institute VPA ${this.activeVpa} copied to clipboard.`);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
