import { Component, Inject, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FeesService, FeeDueSlip, FeeDueSlipItem, FeeInvoicePagedItem, UpiPaymentSettings, SiblingPendingDue } from '../../core/services/fees.service';
import { AuthService } from '../../core/services/auth.service';
import { QuickSettingsService } from '../../core/services/quick-settings.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { FeeCollectionDialogComponent } from './fee-collection-dialog.component';
import { FeeReminderDispatchDialogComponent, FeeReminderDispatchItem } from '../dashboard/dialogs/fee-reminder-dispatch-dialog.component';
import * as QRCode from '../../shared/utils/qr-code';

export type ExtendedFeeDueSlipItem = FeeDueSlipItem & {
  advanceAdjustedAmount?: number;
  advanceAdjustedFromReceipt?: string | null;
};

export type ExtendedFeeDueSlip = Omit<FeeDueSlip, 'dueItems'> & {
  dueItems: ExtendedFeeDueSlipItem[];
  studentAdvanceBalance?: number;
};

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
  autoShareWhatsApp?: boolean;
  className?: string;
  sectionName?: string;
  isSchoolStudent?: boolean;
  isCoachingStudent?: boolean;
  initialCombinedFamilyMode?: boolean;
}

@Component({
  selector: 'app-fee-due-receipt-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatDividerModule, MatProgressBarModule, MatTooltipModule],
  template: `
    <div class="due-modal-container">
      <!-- Top Action Bar (hidden in print) -->
      <div class="modal-actions no-print">
        <div class="modal-title">
          <div class="title-badge">
            <mat-icon>receipt_long</mat-icon>
          </div>
          <div class="title-text-group">
            <span class="main-title">{{ isCombinedFamilyDueMode ? 'Combined Family Fee Demand Bill' : 'Fee Due Slip / Demand Note' }}</span>
            <span class="sub-title">{{ isCombinedFamilyDueMode ? 'संयुक्त पारिवारिक शुल्क मांग पत्र (सभी भाई-बहनों का एक साथ बकाया बिल)' : 'शुल्क मांग पत्र / बकाया पर्ची' }}</span>
          </div>
        </div>
        <div class="btn-group">
          <button
            class="header-action-btn collect-btn"
            (click)="collectNow()"
            matTooltip="Collect Fee Directly"
            matButton="filled">
            <mat-icon>payments</mat-icon>
            <span>Collect Fee</span>
          </button>
          <button
            class="header-action-btn msg-btn"
            (click)="openMessageReminder()"
            matTooltip="Send WhatsApp Due Reminder Message & Voice Note"
            matButton="filled">
            <mat-icon>chat</mat-icon>
            <span>Message</span>
          </button>
          <button
            class="header-action-btn print-btn"
            (click)="printDueSlip()"
            matTooltip="Print or Download PDF"
            matButton="filled">
            <mat-icon>print</mat-icon>
            <span>Print Slip</span>
          </button>
          <button
            class="header-close-btn"
            (click)="dialogRef.close()"
            matTooltip="Close"
            mat-icon-button>
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Dual-Mode Sibling / Family Demand Bill Switcher Bar (hidden in print) -->
      @if (!loading && dueSlip && siblingDuesList.length > 0) {
        <div class="family-due-mode-bar no-print">
          <div class="f-mode-label">
            <mat-icon>family_restroom</mat-icon>
            <span>Demand Bill Mode (मांग पर्ची मोड):</span>
          </div>
          <div class="f-mode-pills">
            <button
              type="button"
              class="f-mode-pill"
              [class.active]="!isCombinedFamilyDueMode"
              (click)="toggleFamilyDueMode(false)">
              <mat-icon>person</mat-icon>
              <span>{{ dueSlip.studentName }} Only (₹{{ dueSlip.totalOutstandingDue | number:'1.2-2' }})</span>
            </button>
            <button
              type="button"
              class="f-mode-pill combined"
              [class.active]="isCombinedFamilyDueMode"
              (click)="toggleFamilyDueMode(true)">
              <mat-icon>groups</mat-icon>
              <span>Combined Family Demand Bill ({{ siblingDuesList.length + 1 }} Siblings • Total ₹{{ combinedFamilyTotalDue | number:'1.2-2' }})</span>
            </button>
          </div>
        </div>
      }

      <!-- Loading State -->
      @if (loading) {
        <div class="loading-state">
          <mat-progress-bar mode="indeterminate"></mat-progress-bar>
          <p>Generating Fee Due Demand Slip...</p>
        </div>
      }
    
      <!-- Printable Due Slip Paper (2-in-1 Counterfoil) -->
      @if (!loading && dueSlip) {
        <div class="due-paper" id="due-paper">
          @for (copy of dueSlipCopies; track copy.title; let isLast = $last) {
            <div class="due-slip" [class.office-slip]="copy.isOffice" [id]="!copy.isOffice ? 'student-due-slip-copy' : null">
              <!-- Watermark -->
              @if (logoUrl && !logoFailed) {
                <div class="due-watermark" [style.backgroundImage]="'url(' + logoUrl + ')'"></div>
              }

              <!-- Header -->
              <div class="paper-header">
                <div class="inst-info">
                  <div class="logo-mark transparent-logo-mark" [class.has-img]="logoUrl && !logoFailed">
                    @if (logoUrl && !logoFailed) {
                      <img [src]="logoUrl" (error)="logoFailed = true" alt="Logo" class="inst-logo-img">
                    }
                    @if (!logoUrl || logoFailed) {
                      <mat-icon class="fallback-inst-icon">account_balance</mat-icon>
                    }
                  </div>
                  <div class="inst-text">
                    <h2 class="inst-name">{{ data.instituteName || authService.currentUser()?.instituteName || authService.getInstituteName() || 'Official Fee Demand Note' }}</h2>
                    <p class="inst-subtitle">Accounts &amp; Financial Clearance Department | Student Fee Demand Note</p>
                    @if (effectiveBranchName) {
                      <p class="inst-branch">
                        <span class="branch-pill">🏛️ Branch: {{ effectiveBranchName }}</span>
                        <span class="branch-dept-sep">|</span>
                        <span class="branch-dept">Official Accounts Notice</span>
                      </p>
                    }
                  </div>
                </div>
                <div class="due-badge-block">
                  <div class="badge-title-wrap">
                    <span class="badge-title">{{ isCombinedFamilyDueMode ? 'FAMILY FEE DEMAND BILL' : 'FEE DUE SLIP' }}</span>
                    <span class="badge-sub">{{ isCombinedFamilyDueMode ? 'संयुक्त पारिवारिक शुल्क मांग पत्र' : 'शुल्क बकाया पर्ची / मांग पत्र' }}</span>
                  </div>
                  <span class="copy-tag" [class.office-copy-tag]="copy.isOffice">
                    {{ copy.title }} ({{ copy.hindiTitle }})
                  </span>
                </div>
              </div>

              <!-- Meta Info Strip -->
              <div class="meta-strip">
                <div class="meta-item">
                  <span class="meta-label">Notice Ref No:</span>
                  <span class="meta-val highlight">{{ noticeNumber }}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Notice Issue Date (मांग पत्र जारी तिथि):</span>
                  <span class="meta-val">{{ dueSlip.generatedDate | date:'dd-MMM-yyyy' }}</span>
                </div>
                @if (effectiveBranchName) {
                  <div class="meta-item branch-meta-item">
                    <span class="meta-label">Branch / Centre:</span>
                    <span class="meta-val branch-val">{{ effectiveBranchName }}</span>
                  </div>
                }
                @if (invoiceNumbersDisplay) {
                  <div class="meta-item invoice-meta-item">
                    <span class="meta-label">Invoice No:</span>
                    <span class="meta-val highlight">{{ invoiceNumbersDisplay }}</span>
                  </div>
                }
                <div class="meta-item">
                  <span class="meta-label">Total Invoices:</span>
                  <span class="meta-val">{{ dueSlip.dueItems.length }} Unpaid</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Account Status:</span>
                  <span class="meta-val status-badge-due">PAYMENT OVERDUE</span>
                </div>
              </div>

              <!-- Student / Family Profile Card -->
              @if (isCombinedFamilyDueMode) {
                <div class="student-profile-card">
                  <div class="prof-col">
                    <div class="prof-row">
                      <span class="k">Father / Guardian:</span>
                      <span class="v student-highlight">{{ dueSlip.parentName || 'N/A' }}</span>
                    </div>
                    <div class="prof-row">
                      <span class="k">Registered Mobile:</span>
                      <span class="v"><strong>{{ dueSlip.parentPhone || 'N/A' }}</strong></span>
                    </div>
                    <div class="prof-row">
                      <span class="k">Settlement Policy:</span>
                      <span class="v">Combined Family FIFO Settlement</span>
                    </div>
                  </div>
                  <div class="prof-col">
                    <div class="prof-row">
                      <span class="k">Siblings Included ({{ siblingDuesList.length + 1 }}):</span>
                      <span class="v">
                        <div class="family-due-sibs-list">
                          <div><strong>1. {{ dueSlip.studentName }}</strong> ({{ effectiveClassName || effectiveBatchName || 'General' }} • Roll: {{ dueSlip.rollNumber }}) — Due: <strong>₹{{ dueSlip.totalOutstandingDue | number:'1.2-2' }}</strong></div>
                          @for (sib of siblingDuesList; track sib.studentId; let sIdx = $index) {
                            <div>
                              <strong>{{ sIdx + 2 }}. {{ sib.studentName }}</strong>
                              ({{ sib.className ? sib.className + (sib.sectionName ? '-' + sib.sectionName : '') : (sib.batchName || 'General') }} • Roll: {{ sib.rollNumber }})
                              @if (sib.discountPercent > 0) {
                                <span class="fam-due-disc-pill">🎁 {{ sib.discountPercent }}% Concession</span>
                              }
                              — Due: <strong>₹{{ sib.totalOutstandingDue | number:'1.2-2' }}</strong>
                            </div>
                          }
                        </div>
                      </span>
                    </div>
                  </div>
                </div>
              } @else {
                <div class="student-profile-card">
                  <div class="prof-col">
                    <div class="prof-row">
                      <span class="k">Student Name:</span>
                      <span class="v student-highlight">{{ dueSlip.studentName }}</span>
                    </div>
                    <div class="prof-row">
                      <span class="k">Roll / Admission No:</span>
                      <span class="v">
                        <strong>{{ dueSlip.rollNumber || 'N/A' }}</strong>
                        @if (dueSlip.admissionNumber && dueSlip.admissionNumber !== dueSlip.rollNumber) {
                          <span> (Adm: {{ dueSlip.admissionNumber }})</span>
                        }
                      </span>
                    </div>
                    <div class="prof-row">
                      <span class="k">Admission Date:</span>
                      <span class="v">
                        @if (dueSlip.admissionDate) {
                          <strong>{{ formatDateOnlyIST(dueSlip.admissionDate) }}</strong>
                        } @else {
                          <span>N/A</span>
                        }
                      </span>
                    </div>
                    @if (showClassRow) {
                      <div class="prof-row">
                        <span class="k">Class:</span>
                        <span class="v">
                          <strong>{{ effectiveClassName || 'N/A' }}</strong>
                          @if (effectiveSectionName) {
                            <span> - Section {{ effectiveSectionName }}</span>
                          }
                        </span>
                      </div>
                    }
                    @if (showBatchRow) {
                      <div class="prof-row">
                        <span class="k">Batch:</span>
                        <span class="v"><strong>{{ effectiveBatchName }}</strong></span>
                      </div>
                    }
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
                    @if (dueSlip.hostelInfo) {
                      <div class="prof-row">
                        <span class="k">🏠 Hostel:</span>
                        <span class="v hostel-info-pill">{{ dueSlip.hostelInfo }}</span>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Dues Breakdown Table -->
              <div class="table-section">
                <table class="due-table">
                  <thead>
                    <tr>
                      <th class="text-center" style="width: 28px;">#</th>
                      <th>Fee Particulars / शुल्क मद विवरण</th>
                      <th style="min-width: 95px;">Due Date (देय तिथि)</th>
                      <th class="text-right" style="min-width: 80px;">Total Fee (₹)</th>
                      <th class="text-right" style="min-width: 65px;">Paid (₹)</th>
                      <th class="text-right" style="min-width: 90px;">Outstanding Due (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    @if (isCombinedFamilyDueMode) {
                      @for (group of combinedFamilyGroups; track group.studentId; let gIdx = $index) {
                        <tr class="family-due-group-header">
                          <td colspan="5" class="fam-grp-title">
                            <strong>👦 {{ gIdx + 1 }}. {{ group.studentName }}</strong>
                            <span class="fam-grp-meta">({{ group.classOrBatch }} • Roll: {{ group.rollNumber }})</span>
                            @if (group.discountPercent > 0) {
                              <span class="fam-due-disc-pill">🎁 {{ group.discountPercent }}% Sibling Concession</span>
                            }
                          </td>
                          <td class="text-right fam-grp-sub">
                            Due: <strong>₹{{ group.totalDue | number:'1.2-2' }}</strong>
                          </td>
                        </tr>
                        @for (row of group.rows; track row.rowNum; let rIdx = $index) {
                          <tr class="due-item-row">
                            <td class="text-center row-num">{{ gIdx + 1 }}.{{ rIdx + 1 }}</td>
                            <td>
                              <div class="due-item-title">{{ row.headName }}</div>
                              <div class="due-period-sub">
                                <span>{{ row.periodTitle }}</span>
                                @if (row.invoiceNumber) {
                                  <span class="inv-ref-tag">• Ref #{{ row.invoiceNumber }}</span>
                                }
                              </div>
                            </td>
                            <td>
                              <span class="due-date-val">{{ row.dueDate | date:'dd-MMM-yyyy' }}</span>
                              @if (isOverdueDate(row.dueDate)) {
                                <span class="overdue-chip">Overdue</span>
                              }
                            </td>
                            <td class="text-right">₹{{ row.totalAmount | number:'1.2-2' }}</td>
                            <td class="text-right amount-paid">₹{{ row.paidAmount | number:'1.2-2' }}</td>
                            <td class="text-right amount-due"><strong>₹{{ row.dueAmount | number:'1.2-2' }}</strong></td>
                          </tr>
                        }
                      }
                    } @else {
                      @for (row of flattenedDueRows; track row.rowNum) {
                        <tr class="due-item-row">
                          <td class="text-center row-num">{{ row.rowNum }}</td>
                          <td>
                            <div class="due-item-title">{{ row.headName }}</div>
                            <div class="due-period-sub">
                              <span>{{ row.periodTitle }}</span>
                              @if (row.invoiceNumber) {
                                <span class="inv-ref-tag">• Ref #{{ row.invoiceNumber }}</span>
                              }
                            </div>
                          </td>
                          <td>
                            <span class="due-date-val">{{ row.dueDate | date:'dd-MMM-yyyy' }}</span>
                            @if (isOverdueDate(row.dueDate)) {
                              <span class="overdue-chip">Overdue</span>
                            }
                          </td>
                          <td class="text-right">₹{{ row.totalAmount | number:'1.2-2' }}</td>
                          <td class="text-right amount-paid">₹{{ row.paidAmount | number:'1.2-2' }}</td>
                          <td class="text-right amount-due"><strong>₹{{ row.dueAmount | number:'1.2-2' }}</strong></td>
                        </tr>
                      }
                    }
                    @if (hasAdvanceAdjusted && !isCombinedFamilyDueMode) {
                      <tr class="advance-adj-row">
                        <td colspan="5" class="text-right adv-label-cell">
                          <span class="adv-adjusted-pill">✓ Advance Paid (FIFO Adjusted):</span>
                        </td>
                        <td class="text-right adv-amount-cell">
                          -₹{{ totalAdvanceAdjusted | number:'1.2-2' }}
                        </td>
                      </tr>
                    }
                    <tr class="summary-subtotal">
                      <td colspan="3" class="text-right"><strong>{{ isCombinedFamilyDueMode ? 'TOTAL FAMILY PAYABLE (' + (siblingDuesList.length + 1) + ' Siblings):' : 'TOTAL (कुल योग):' }}</strong></td>
                      <td class="text-right"><strong>₹{{ activeTotalBilledAmount | number:'1.2-2' }}</strong></td>
                      <td class="text-right amount-paid"><strong>₹{{ activeTotalPaidAmount | number:'1.2-2' }}</strong></td>
                      <td class="text-right grand-due"><strong>₹{{ activeTotalOutstandingDue | number:'1.2-2' }}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Amount In Words Strip -->
              <div class="amount-words-strip">
                <div class="words-left">
                  <span class="w-label">Total Payable in Words:</span>
                  <span class="w-text">{{ getAmountInWords(activeTotalOutstandingDue) }}</span>
                </div>
                <div class="words-right">
                  <div class="due-stamp">
                    <mat-icon>warning</mat-icon>
                    <span>DUES PENDING</span>
                  </div>
                  @if (payeeUpiId) {
                    <span class="upi-payee-pill">UPI Payee: <strong>{{ payeeUpiId }}</strong></span>
                  }
                </div>
              </div>

              <!-- Family Sibling Dues Summary Notice on Single Slip (when not in combined view) -->
              @if (!isCombinedFamilyDueMode && siblingDuesList.length > 0) {
                <div class="lib-due-notice-strip family-summary-strip">
                  <span class="lib-text">
                    👨‍👩‍👧‍👦 <strong>Family Sibling Dues Info:</strong>
                    @for (sib of siblingDuesList; track sib.studentId; let isLastSib = $last) {
                      <span>{{ sib.studentName }} ({{ sib.className || sib.batchName || 'General' }}): <strong>₹{{ sib.totalOutstandingDue | number:'1.0-0' }}</strong>{{ !isLastSib ? ' • ' : '' }}</span>
                    }
                  </span>
                  <span class="lib-amt">Total Family Payable: ₹{{ combinedFamilyTotalDue | number:'1.2-2' }}</span>
                </div>
              }

              <!-- Library Dues Notice Strip (if any) -->
              @if (dueSlip.pendingLibraryFine && dueSlip.pendingLibraryFine > 0) {
                <div class="lib-due-notice-strip">
                  <span class="lib-text">⚠️ Additional Institutional Dues: Unsettled Library Overdue Fine</span>
                  <span class="lib-amt">₹{{ dueSlip.pendingLibraryFine | number:'1.2-2' }}</span>
                </div>
              }

              <!-- Signatures Row with Mini UPI QR Scanner -->
              <div class="signatures-row">
                <div class="sig-col">
                  <div class="sig-line"></div>
                  <span class="sig-text">Parent / Student Signature</span>
                  <small class="auth-sub">Received fee due demand copy</small>
                </div>
                <div class="sig-col text-center">
                  @if (officialSealUrl) {
                    <img [src]="officialSealUrl" alt="Official Seal" class="uploaded-official-seal-img" />
                  }
                  @if (!officialSealUrl) {
                    <div class="digital-seal">
                      <span>★ OFFICIALLY ISSUED ★</span>
                      <small>{{ dueSlip.generatedDate | date:'dd-MMM-yyyy' }}</small>
                    </div>
                  }
                </div>
                @if (qrDataUrl) {
                  <div class="sig-col-qr text-center">
                    <img [src]="qrDataUrl" alt="Scan to Pay via UPI" class="receipt-mini-qr" />
                    <span class="qr-label">Scan to Pay UPI</span>
                  </div>
                }
                <div class="sig-col text-right">
                  @if (digitalSignatureUrl) {
                    <div class="digital-sign-wrapper">
                      <img [src]="digitalSignatureUrl" alt="Authorized Signature" class="digital-sign-img" />
                    </div>
                  }
                  <div class="sig-line"></div>
                  <span class="sig-text">Accounts In-charge / Cashier</span>
                  <small class="auth-sub">{{ data.instituteName || authService.currentUser()?.instituteName || authService.getInstituteName() || 'Institution' }}</small>
                </div>
              </div>

              <!-- Dynamic Bilingual Policy Footer Notes (100% Dynamic UI Configurable) -->
              @if (footerNoteEnglish || footerNoteHindi) {
                <div class="receipt-note-box">
                  @if (footerNoteEnglish) {
                    <div class="note-row note-en">
                      <strong class="note-tag-en">Note:</strong>
                      <span>{{ footerNoteEnglish }}</span>
                    </div>
                  }
                  @if (footerNoteHindi) {
                    <div class="note-row note-hi">
                      <strong class="note-tag-hi">नोट:</strong>
                      <span>{{ footerNoteHindi }}</span>
                    </div>
                  }
                </div>
              }

              <!-- Footer Notice -->
              <div class="paper-footer">
                <span>Official Computer-Generated Fee Due Slip • {{ copy.title }} • IMSERP Management Suite</span>
              </div>
            </div>

            <!-- Scissor Cut / Perforation Divider -->
            @if (!isLast) {
              <div class="tear-divider">
                <div class="tear-scissor">✂</div>
                <div class="tear-line"></div>
                <div class="tear-badge">
                  <span class="tear-cut-text">TEAR / CUT HERE</span>
                  <span class="tear-hindi">(यहाँ से फाड़कर छात्र / अभिभावक को दें — कार्यालय प्रति नीचे सुरक्षित रखें)</span>
                </div>
                <div class="tear-line"></div>
                <div class="tear-scissor flip">✂</div>
              </div>
            }
          }
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
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
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      color: #1e3a8a;
      border-bottom: 1px solid #bfdbfe;
      flex-shrink: 0;

      .modal-title {
        display: flex;
        align-items: center;
        gap: 10px;

        .title-badge {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          background: #b91c1c;
          color: #ffffff;
          box-shadow: 0 4px 6px -1px rgba(185, 28, 28, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
        }

        .title-text-group {
          display: flex;
          flex-direction: column;
          .main-title {
            font-weight: 700;
            font-size: 1rem;
            color: #1e3a8a;
            letter-spacing: -0.01em;
          }
          .sub-title {
            font-size: 0.72rem;
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
          height: 32px !important;
          padding: 0 12px !important;
          border-radius: 6px !important;
          font-size: 0.78rem !important;
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
            &:hover:not(:disabled) { background: #0369a1 !important; transform: translateY(-1px); }
          }

          &.msg-btn {
            background: #16a34a !important;
            color: #ffffff !important;
            &:hover:not(:disabled) { background: #15803d !important; transform: translateY(-1px); }
          }

          &.print-btn {
            background: #2563eb !important;
            color: #ffffff !important;
            &:hover:not(:disabled) { background: #1d4ed8 !important; transform: translateY(-1px); }
          }

          /* PROPER VISIBLE DISABLED STYLING FOR ALL BUTTONS */
          &:disabled, &[disabled], &.btn-disabled {
            background: #e2e8f0 !important;
            color: #94a3b8 !important;
            border: 1px solid #cbd5e1 !important;
            opacity: 0.6 !important;
            cursor: not-allowed !important;
            pointer-events: none !important;
            box-shadow: none !important;
            transform: none !important;

            mat-icon, span {
              color: #94a3b8 !important;
            }
          }
        }

        .header-close-btn {
          color: #64748b;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          &:hover:not(:disabled) { color: #1e293b; background: rgba(0, 0, 0, 0.05); }
          &:disabled, &[disabled] {
            opacity: 0.4 !important;
            pointer-events: none !important;
            cursor: not-allowed !important;
          }
        }
      }
    }

    .loading-state {
      padding: 40px;
      text-align: center;
      color: #64748b;
      font-size: 0.9rem;
      p { margin-top: 16px; }
    }

    .due-paper {
      position: relative;
      padding: 12px 16px;
      background: #f8fafc;
      color: #0f172a;
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 11.5px;
      line-height: 1.35;
      overflow-y: auto;
      max-height: calc(88vh - 54px);
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .due-slip {
      position: relative;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 14px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      page-break-inside: avoid;

      &.office-slip {
        border-color: #cbd5e1;
      }
    }

    .due-watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 180px;
      height: 180px;
      opacity: 0.035;
      pointer-events: none;
      background-size: contain;
      background-position: center;
      background-repeat: no-repeat;
      z-index: 0;
    }

    /* Tear Divider with Scissor */
    .tear-divider {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin: 16px 0;
      user-select: none;
      page-break-inside: avoid;

      .tear-line {
        flex: 1;
        border-top: 1.5px dashed #94a3b8;
        height: 0;
      }
      .tear-scissor {
        font-size: 14px;
        color: #475569;
        line-height: 1;
        &.flip {
          transform: scaleX(-1);
        }
      }
      .tear-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #f1f5f9;
        border: 1px dashed #cbd5e1;
        border-radius: 20px;
        padding: 2px 12px;
        font-size: 0.65rem;
        font-weight: 700;
        color: #475569;
        letter-spacing: 0.04em;
        .tear-hindi {
          color: #64748b;
          font-weight: 600;
        }
      }
    }

    /* Paper Header */
    .paper-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 6px;
      border-bottom: 1.5px solid #b91c1c;
      position: relative;
      z-index: 1;

      .inst-info {
        display: flex;
        align-items: center;
        gap: 8px;

        .logo-mark {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          background: #eff6ff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;

          &.transparent-logo-mark {
            background: transparent !important;
            border: none !important;
          }

          .inst-logo-img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }

          .fallback-inst-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
            color: #b91c1c;
          }
        }

        .inst-text {
          .inst-name {
            font-size: 0.95rem;
            font-weight: 800;
            color: #0f172a;
            line-height: 1.15;
            margin: 0;
          }
          .inst-subtitle {
            font-size: 0.6rem;
            color: #475569;
            margin: 1px 0 0;
          }
          .inst-branch {
            font-size: 0.6rem;
            color: #b91c1c;
            font-weight: 600;
            margin: 2px 0 0;
            display: flex;
            align-items: center;
            gap: 4px;

            .branch-pill {
              background: #fef2f2;
              color: #b91c1c;
              padding: 0 4px;
              border-radius: 2px;
              border: 1px solid #fecaca;
              font-weight: 700;
            }
            .branch-dept-sep { color: #94a3b8; }
            .branch-dept { color: #64748b; font-weight: 500; }
          }
        }
      }

      .due-badge-block {
        text-align: right;
        .badge-title-wrap {
          .badge-title {
            font-size: 0.88rem;
            font-weight: 800;
            color: #b91c1c;
            letter-spacing: 0.04em;
            display: block;
            line-height: 1.1;
          }
          .badge-sub {
            font-size: 0.6rem;
            color: #64748b;
            font-weight: 600;
            display: block;
          }
        }
        .copy-tag {
          display: inline-block;
          margin-top: 2px;
          font-size: 0.6rem;
          font-weight: 800;
          background: #fee2e2;
          color: #b91c1c;
          padding: 0 6px;
          border-radius: 3px;
          border: 1px solid #fca5a5;
          letter-spacing: 0.02em;

          &.office-copy-tag {
            background: #f5f3ff;
            color: #6d28d9;
            border-color: #ddd6fe;
          }
        }
      }
    }

    /* Meta Info Strip */
    .meta-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 3px 10px;
      padding: 3px 6px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      margin: 4px 0;
      position: relative;
      z-index: 1;

      .meta-item {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 0.67rem;

        .meta-label {
          color: #64748b;
          font-weight: 600;
        }
        .meta-val {
          color: #0f172a;
          font-weight: 700;

          &.highlight { color: #b91c1c; }
          &.branch-val { color: #b91c1c; }
          &.status-badge-due {
            background: #fee2e2;
            color: #991b1b;
            padding: 0 4px;
            border-radius: 2px;
            font-size: 0.62rem;
            font-weight: 800;
          }
        }
      }
    }

    /* Student Profile Box */
    .student-profile-card {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px 12px;
      padding: 4px 6px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 4px;
      margin-bottom: 4px;
      position: relative;
      z-index: 1;

      .prof-col {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .prof-row {
        display: flex;
        align-items: baseline;
        gap: 6px;
        font-size: 0.68rem;
        line-height: 1.35;

        .k {
          min-width: 85px;
          color: #475569;
          font-weight: 600;
          flex-shrink: 0;
        }
        .v {
          color: #0f172a;
          flex: 1;
          min-width: 0;
        }
        .student-highlight {
          font-weight: 800;
          color: #991b1b;
        }
        .hostel-info-pill {
          background: #e0f2fe;
          color: #0369a1;
          padding: 0 4px;
          border-radius: 2px;
          font-size: 0.62rem;
          font-weight: 700;
        }
      }
    }

    /* Table Section */
    .table-section {
      margin-bottom: 3px;
      position: relative;
      z-index: 1;

      .due-table {
        width: 100%;
        border-collapse: collapse;

        th {
          background: #eff6ff !important;
          color: #1e3a8a !important;
          border-top: 1px solid #bfdbfe;
          border-bottom: 1.5px solid #bfdbfe;
          padding: 3px 5px;
          font-size: 0.67rem;
          font-weight: 700;
          text-align: left;
        }

        td {
          padding: 3px 5px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 0.7rem;
          line-height: 1.2;
        }

        .due-item-title {
          font-size: 0.7rem;
          color: #0f172a;
          font-weight: 700;
        }

        .due-adv-adjusted-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 2px;
          padding: 1px 6px;
          background: #ecfdf5;
          border: 1px solid #6ee7b7;
          border-radius: 3px;
          color: #065f46;
          font-size: 0.6rem;
          font-weight: 600;
        }

        .row-num {
          font-weight: 700;
          color: #475569;
          font-size: 0.65rem;
        }

        .due-period-sub {
          font-size: 0.54rem;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 1px;
          line-height: 1.1;
        }

        .inv-ref-tag {
          color: #2563eb;
          font-weight: 600;
        }

        .due-date-val {
          font-size: 0.65rem;
          color: #1e293b;
        }

        .overdue-chip {
          display: inline-block;
          font-size: 0.50rem;
          font-weight: 800;
          background: #fee2e2;
          color: #dc2626;
          border: 1px solid #fecaca;
          padding: 0 3px;
          border-radius: 2px;
          margin-left: 3px;
          line-height: 1.1;
          vertical-align: middle;
          text-transform: uppercase;
        }

        .advance-adj-row td {
          padding: 2px 4px;
          font-size: 0.65rem;
          background: #f0fdf4;
          border-bottom: 1px solid #bbf7d0;
        }

        .adv-adjusted-pill {
          color: #065f46;
          font-weight: 600;
          font-size: 0.62rem;
        }

        .adv-amount-cell {
          color: #059669;
          font-weight: 700;
          font-size: 0.68rem;
        }

        .amount-paid {
          color: #16a34a;
          font-weight: 600;
        }

        .amount-due {
          color: #dc2626;
          font-weight: 700;
        }

        .summary-subtotal {
          background: #f8fafc;
          border-top: 1.5px solid #cbd5e1;

          td {
            padding: 4px 5px;
            font-size: 0.72rem;
          }

          .grand-due {
            font-size: 0.84rem;
            font-weight: 800;
            color: #dc2626;
          }
        }
      }
    }

    /* Amount In Words Strip */
    .amount-words-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3px 6px;
      background: #fff1f2;
      border: 1px dashed #fca5a5;
      border-radius: 4px;
      margin-bottom: 3px;
      position: relative;
      z-index: 1;

      .words-left {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.67rem;

        .w-label {
          color: #b91c1c;
          font-weight: 700;
          text-transform: uppercase;
        }
        .w-text {
          color: #991b1b;
          font-weight: 700;
        }
      }

      .words-right {
        display: flex;
        align-items: center;
        gap: 6px;

        .due-stamp {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: #dc2626;
          color: #ffffff;
          padding: 1px 6px;
          border-radius: 10px;
          font-weight: 800;
          font-size: 0.62rem;
          letter-spacing: 0.03em;
          mat-icon { font-size: 11px; width: 11px; height: 11px; }
        }

        .upi-payee-pill {
          font-size: 0.6rem;
          color: #065f46;
          background: #d1fae5;
          padding: 1px 5px;
          border-radius: 3px;
          border: 1px solid #a7f3d0;
        }
      }
    }

    /* Library Fine Notice Strip */
    .lib-due-notice-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2px 6px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 3px;
      font-size: 0.62rem;
      color: #92400e;
      margin-bottom: 3px;
      position: relative;
      z-index: 1;
      .lib-amt { font-weight: 800; color: #b45309; }
    }

    /* Signatures Row */
    .signatures-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 8px;
      margin-bottom: 2px;
      position: relative;
      z-index: 1;

      .sig-col {
        width: 140px;

        .sig-line {
          height: 1px;
          background: #475569;
          margin-bottom: 2px;
        }
        .sig-text {
          font-size: 0.66rem;
          font-weight: 700;
          color: #334155;
          display: block;
          line-height: 1.1;
        }
        .auth-sub {
          font-size: 0.58rem;
          color: #64748b;
          display: block;
        }
        .uploaded-official-seal-img {
          max-width: 38px;
          max-height: 38px;
          object-fit: contain;
          display: block;
          margin: 0 auto;
        }
        .digital-seal {
          border: 1px dashed #b91c1c;
          border-radius: 3px;
          padding: 2px 5px;
          background: #fef2f2;
          color: #b91c1c;
          font-size: 0.6rem;
          font-weight: 800;
          text-align: center;
          display: inline-block;
          small { display: block; font-size: 0.55rem; font-weight: 600; }
        }
        .digital-sign-wrapper {
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          height: 20px;
          margin-bottom: 1px;

          .digital-sign-img {
            max-height: 20px;
            max-width: 80px;
            object-fit: contain;
            mix-blend-mode: multiply;
          }
        }
      }

      .sig-col-qr {
        width: 104px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;

        .receipt-mini-qr {
          width: 96px;
          height: 96px;
          object-fit: contain;
          border: none;
          border-radius: 0;
          padding: 0;
          background: #ffffff;
          box-shadow: none;
        }
        .qr-label {
          font-size: 0.56rem;
          font-weight: 700;
          color: #334155;
          margin-top: 2px;
          white-space: nowrap;
          text-align: center;
        }
      }
    }

    .receipt-note-box {
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 4px;
      padding: 3px 6px;
      margin-top: 4px;
      margin-bottom: 2px;
      font-size: 0.6rem;
      line-height: 1.25;

      .note-row {
        display: flex;
        align-items: baseline;
        gap: 4px;
      }

      .note-tag-en {
        color: #1d4ed8;
        font-weight: 700;
        white-space: nowrap;
      }

      .note-tag-hi {
        color: #b91c1c;
        font-weight: 700;
        white-space: nowrap;
      }
    }

    /* Paper Footer */
    .paper-footer {
      text-align: center;
      font-size: 0.58rem;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 2px;
      margin-top: 2px;
      position: relative;
      z-index: 1;
    }

    .text-center { text-align: center; }
    .text-right { text-align: right; }

    @media (max-width: 640px) {
      .modal-actions {
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 8px !important;
        padding: 8px 12px !important;

        .modal-title {
          width: 100%;
          .title-badge {
            width: 32px;
            height: 32px;
            min-width: 32px;
            mat-icon { font-size: 16px; width: 16px; height: 16px; }
          }
          .title-text-group {
            .main-title { font-size: 0.92rem; }
            .sub-title { font-size: 0.65rem; }
          }
        }

        .btn-group {
          width: 100%;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: flex-start;

          .header-action-btn {
            flex: 1 1 auto;
            min-width: 70px;
            height: 30px !important;
            padding: 0 8px !important;
            font-size: 0.72rem !important;
            justify-content: center;
          }

          .header-close-btn {
            margin-left: auto;
          }
        }
      }

      .due-paper {
        padding: 8px !important;
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch !important;
      }

      .due-slip {
        min-width: 540px !important;
      }
    }

    /* Family Demand Bill Switcher Bar */
    .family-due-mode-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      padding: 8px 18px;
      background: #fff1f2;
      border-bottom: 1px solid #fecdd3;

      .f-mode-label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.78rem;
        font-weight: 700;
        color: #9f1239;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }

      .f-mode-pills {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }

      .f-mode-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 11px;
        border-radius: 16px;
        border: 1px solid #fda4af;
        background: #ffffff;
        color: #9f1239;
        font-size: 0.74rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s ease;
        mat-icon { font-size: 15px; width: 15px; height: 15px; }

        &:hover {
          background: #ffe4e6;
          border-color: #e11d48;
        }

        &.active {
          background: #dc2626;
          color: #ffffff;
          border-color: #b91c1c;
          box-shadow: 0 2px 6px rgba(220, 38, 38, 0.25);
        }
      }
    }

    .family-due-sibs-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 0.7rem;
      line-height: 1.3;
    }

    .fam-due-disc-pill {
      display: inline-block;
      margin-left: 4px;
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #86efac;
      padding: 0 4px;
      border-radius: 3px;
      font-size: 0.62rem;
      font-weight: 700;
    }

    .family-due-group-header {
      background: #eff6ff !important;
      td {
        border-top: 1px solid #bfdbfe !important;
        border-bottom: 1px solid #bfdbfe !important;
        padding: 3px 6px !important;
        color: #1e3a8a !important;
      }
      .fam-grp-meta {
        font-size: 0.68rem;
        color: #1d4ed8;
        margin-left: 4px;
      }
      .fam-grp-sub {
        font-size: 0.72rem;
        color: #b91c1c !important;
        white-space: nowrap;
      }
    }

    .family-summary-strip {
      background: #eff6ff !important;
      border-color: #93c5fd !important;
      color: #1e3a8a !important;
      .lib-amt {
        color: #b91c1c !important;
        font-weight: 800;
      }
    }

    @media print {
      .no-print { display: none !important; }
      .due-paper {
        padding: 0 !important;
        max-height: none !important;
        overflow: visible !important;
        background: transparent !important;
      }
      .due-slip {
        box-shadow: none !important;
        border: 1px solid #cbd5e1 !important;
        page-break-inside: avoid !important;
      }
      .tear-divider {
        page-break-inside: avoid !important;
      }
      .uploaded-official-seal-img, .digital-sign-img {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .receipt-mini-qr {
        width: 96px !important;
        height: 96px !important;
        border: none !important;
        border-radius: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        box-shadow: none !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  `]
})
export class FeeDueReceiptDialogComponent implements OnInit {
  dueSlipCopies = [
    { title: 'STUDENT COPY', hindiTitle: 'छात्र प्रति', isOffice: false },
    { title: 'OFFICE COPY', hindiTitle: 'कार्यालय प्रति', isOffice: true }
  ];
  logoUrl: string | null = null;
  logoFailed = false;

  dueSlip: ExtendedFeeDueSlip | null = null;
  loading = true;
  noticeNumber = '';
  payeeUpiId = 'imserp.fees@sbi';
  payeeMerchantName = '';
  bankAccountDisplay = '';
  qrDataUrl: string | null = null;
  siblingDuesList: SiblingPendingDue[] = [];
  isCombinedFamilyDueMode = false;

  toggleFamilyDueMode(combined: boolean): void {
    this.isCombinedFamilyDueMode = combined;
    this.generateQrCode();
    this.cdr.markForCheck();
  }

  get combinedFamilyTotalDue(): number {
    const primaryDue = this.dueSlip?.totalOutstandingDue || 0;
    const sibsDue = this.siblingDuesList.reduce((s, x) => s + (x.totalOutstandingDue || 0), 0);
    return Math.round((primaryDue + sibsDue) * 100) / 100;
  }

  get activeTotalOutstandingDue(): number {
    return this.isCombinedFamilyDueMode ? this.combinedFamilyTotalDue : (this.dueSlip?.totalOutstandingDue || 0);
  }

  get activeTotalBilledAmount(): number {
    if (!this.isCombinedFamilyDueMode) return this.totalBilledAmount;
    return this.combinedFamilyGroups.reduce((s, g) => s + g.rows.reduce((rS, r) => rS + (r.totalAmount || 0), 0), 0);
  }

  get activeTotalPaidAmount(): number {
    if (!this.isCombinedFamilyDueMode) return this.totalPaidAmount;
    return this.combinedFamilyGroups.reduce((s, g) => s + g.rows.reduce((rS, r) => rS + (r.paidAmount || 0), 0), 0);
  }

  get combinedFamilyGroups(): Array<{
    studentId: string;
    studentName: string;
    rollNumber: string;
    classOrBatch: string;
    discountPercent: number;
    totalDue: number;
    rows: any[];
  }> {
    if (!this.dueSlip) return [];
    const buildRowsForItems = (dueItems: FeeDueSlipItem[]) => {
      const rows: any[] = [];
      let counter = 1;
      for (const inv of (dueItems || [])) {
        if (inv.breakdown && inv.breakdown.length > 0) {
          for (const b of inv.breakdown) {
            const bAmount = Number(b.amount) || 0;
            const bPaid = Number(b.paidAmount) || 0;
            rows.push({
              rowNum: counter++,
              periodTitle: inv.title || 'Fee Invoice',
              invoiceNumber: inv.invoiceNumber || '',
              headName: b.headName || 'Fee Head',
              dueDate: inv.dueDate,
              totalAmount: bAmount,
              paidAmount: bPaid,
              dueAmount: Math.max(0, bAmount - bPaid)
            });
          }
        } else {
          const invTotal = Number(inv.totalAmount) || 0;
          const invPaid = Number(inv.paidAmount) || 0;
          const invDue = Number(inv.dueAmount) || Math.max(0, invTotal - invPaid);
          rows.push({
            rowNum: counter++,
            periodTitle: inv.title || 'Fee Invoice',
            invoiceNumber: inv.invoiceNumber || '',
            headName: inv.title || 'Tuition / Educational Fee',
            dueDate: inv.dueDate,
            totalAmount: invTotal,
            paidAmount: invPaid,
            dueAmount: invDue
          });
        }
      }
      return rows;
    };

    const primaryCls = this.effectiveClassName
      ? `Class ${this.effectiveClassName}${this.effectiveSectionName ? '-' + this.effectiveSectionName : ''}`
      : (this.effectiveBatchName || 'General');

    const groups = [
      {
        studentId: this.dueSlip.studentId,
        studentName: this.dueSlip.studentName,
        rollNumber: this.dueSlip.rollNumber || 'N/A',
        classOrBatch: primaryCls,
        discountPercent: 0,
        totalDue: this.dueSlip.totalOutstandingDue,
        rows: this.flattenedDueRows
      }
    ];

    for (const sib of this.siblingDuesList) {
      const sibCls = sib.className
        ? `Class ${sib.className}${sib.sectionName ? '-' + sib.sectionName : ''}`
        : (sib.batchName || 'General');
      groups.push({
        studentId: sib.studentId,
        studentName: sib.studentName,
        rollNumber: sib.rollNumber || 'N/A',
        classOrBatch: sibCls,
        discountPercent: sib.discountPercent || 0,
        totalDue: sib.totalOutstandingDue,
        rows: buildRowsForItems(sib.dueItems)
      });
    }
    return groups;
  }

  get invoiceNumbersDisplay(): string {
    if (!this.dueSlip?.dueItems?.length) {
      return this.data.invoice?.invoiceNumber || '';
    }
    const invs = Array.from(new Set(this.dueSlip.dueItems.map(d => d.invoiceNumber).filter(Boolean)));
    return invs.join(', ');
  }

  get effectiveBranchName(): string {
    if (this.dueSlip?.branchName) return this.dueSlip.branchName;
    if (this.data?.branchName && this.data.branchName !== 'All Branches / Head Office') return this.data.branchName;
    if (this.data?.invoice?.branchName) return this.data.invoice.branchName;
    const authBranch = this.authService.getCurrentBranchName();
    if (authBranch) return authBranch;
    const batch = this.data?.batchName || this.dueSlip?.batchName || '';
    const match = batch.match(/\(([^)]+)\)/);
    if (match) return match[1];
    return 'Main Branch';
  }

  get effectiveClassName(): string {
    return this.dueSlip?.className || this.data?.invoice?.className || this.data?.invoice?.currentClassName || this.data?.className || '';
  }

  get effectiveSectionName(): string {
    return this.dueSlip?.sectionName || this.data?.invoice?.sectionName || this.data?.invoice?.currentSectionName || this.data?.sectionName || '';
  }

  get showClassRow(): boolean {
    return !!this.effectiveClassName || this.authService.hasSchoolModule() || !this.authService.hasCoachingModule();
  }

  get showBatchRow(): boolean {
    if (!this.authService.hasCoachingModule()) return false;
    return !!(this.dueSlip?.batchName || this.data?.batchName);
  }

  get effectiveBatchName(): string {
    return this.dueSlip?.batchName || this.data?.batchName || '';
  }

  get officialSealUrl(): string | null {
    return this.authService.getOfficialSealUrl();
  }

  get digitalSignatureUrl(): string | null {
    return this.authService.getDigitalSignatureUrl();
  }

  get footerNoteEnglish(): string {
    if (this.quickSettingsService.showFooterNoteOnDueSlip() === false) return '';
    const d: any = this.dueSlip;
    return d?.footerNoteEnglish || this.quickSettingsService.receiptFooterNoteEnglish() || '';
  }

  get footerNoteHindi(): string {
    if (this.quickSettingsService.showFooterNoteOnDueSlip() === false) return '';
    const d: any = this.dueSlip;
    return d?.footerNoteHindi || this.quickSettingsService.receiptFooterNoteHindi() || '';
  }

  isOverdueDate(dateStr?: string | Date): boolean {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  }

  formatDateOnlyIST(dateVal: string | Date | undefined): string {
    if (!dateVal) return 'N/A';
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
      year: 'numeric'
    }).formatToParts(d);

    let day = '', month = '', year = '';
    for (const p of parts) {
      if (p.type === 'day') day = p.value;
      else if (p.type === 'month') month = p.value;
      else if (p.type === 'year') year = p.value;
    }
    return `${day}-${month}-${year}`;
  }

  get flattenedDueRows(): {
    rowNum: number;
    periodTitle: string;
    invoiceNumber: string;
    headName: string;
    description?: string;
    dueDate: string | Date;
    totalAmount: number;
    paidAmount: number;
    dueAmount: number;
  }[] {
    if (!this.dueSlip?.dueItems?.length) return [];
    const rows: any[] = [];
    let counter = 1;

    for (const inv of this.dueSlip.dueItems) {
      if (inv.breakdown && inv.breakdown.length > 0) {
        for (const b of inv.breakdown) {
          const bAmount = Number(b.amount) || 0;
          const bPaid = Number(b.paidAmount) || 0;
          rows.push({
            rowNum: counter++,
            periodTitle: inv.title || 'Fee Invoice',
            invoiceNumber: inv.invoiceNumber || '',
            headName: b.headName || 'Fee Head',
            description: b.description || '',
            dueDate: inv.dueDate,
            totalAmount: bAmount,
            paidAmount: bPaid,
            dueAmount: Math.max(0, bAmount - bPaid)
          });
        }
      } else {
        const invTotal = Number(inv.totalAmount) || 0;
        const invPaid = Number(inv.paidAmount) || 0;
        const invDue = Number(inv.dueAmount) || Math.max(0, invTotal - invPaid);
        rows.push({
          rowNum: counter++,
          periodTitle: inv.title || 'Fee Invoice',
          invoiceNumber: inv.invoiceNumber || '',
          headName: inv.title || 'Tuition / Educational Fee',
          description: '',
          dueDate: inv.dueDate,
          totalAmount: invTotal,
          paidAmount: invPaid,
          dueAmount: invDue
        });
      }
    }
    return rows;
  }

  get totalBilledAmount(): number {
    return this.flattenedDueRows.reduce((acc, r) => acc + (r.totalAmount || 0), 0);
  }

  get totalPaidAmount(): number {
    return this.flattenedDueRows.reduce((acc, r) => acc + (r.paidAmount || 0), 0);
  }

  get totalAdvanceAdjusted(): number {
    return this.dueSlip?.dueItems?.reduce((acc, i) => acc + (i.advanceAdjustedAmount || 0), 0) || 0;
  }

  get hasAdvanceAdjusted(): boolean {
    return this.totalAdvanceAdjusted > 0;
  }

  constructor(
    public dialogRef: MatDialogRef<FeeDueReceiptDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FeeDueReceiptDialogData,
    private feesService: FeesService,
    private dialog: MatDialog,
    public authService: AuthService,
    public quickSettingsService: QuickSettingsService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {
    const rawLogo = data.logoUrl || this.authService.currentUser()?.profilePhoto;
    this.logoUrl = this.authService.resolveLogoUrl(rawLogo);
  }

  ngOnInit(): void {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    this.noticeNumber = `DUE-${yearMonth}-${rand}`;

    this.feesService.getUpiPaymentSettings().subscribe({
      next: (settings: UpiPaymentSettings) => {
        this.payeeUpiId = settings.effectiveUpiId || settings.upiId || 'imserp.fees@sbi';
        this.payeeMerchantName = settings.effectiveMerchantName || settings.upiMerchantName || this.data.instituteName || this.authService.currentUser()?.instituteName || 'Fee Collection';
        if (settings.effectiveBankName && settings.effectiveAccountNumber) {
          this.bankAccountDisplay = `${settings.effectiveBankName} - A/C: ${settings.effectiveAccountNumber} (IFSC: ${settings.effectiveIfsc || 'N/A'})`;
        }
        this.generateQrCode();
      },
      error: () => {
        this.payeeMerchantName = this.data.instituteName || this.authService.getInstituteName();
        this.generateQrCode();
      }
    });

    if (this.data?.initialCombinedFamilyMode) {
      this.isCombinedFamilyDueMode = true;
    }

    if (this.data?.studentId) {
      this.feesService.getStudentSiblingDues(this.data.studentId).subscribe({
        next: (sibs) => {
          this.siblingDuesList = (sibs || []).filter(s => s.totalOutstandingDue > 0);
          if (this.siblingDuesList.length === 0) {
            this.isCombinedFamilyDueMode = false;
          }
          this.generateQrCode();
          this.cdr.markForCheck();
        },
        error: () => {
          this.siblingDuesList = [];
        }
      });
    }

    this.feesService.getStudentDueSlip(this.data.studentId, this.data.invoiceId).subscribe({
      next: (slip) => {
        this.dueSlip = slip;
        this.loading = false;
        this.generateQrCode();
        if (this.data?.autoShareWhatsApp) {
          setTimeout(() => this.openMessageReminder(), 350);
        }
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
            className: this.data.invoice.className || this.data.invoice.currentClassName,
            sectionName: this.data.invoice.sectionName || this.data.invoice.currentSectionName,
            isSchoolStudent: this.data.invoice.isSchoolStudent,
            isCoachingStudent: this.data.invoice.isCoachingStudent,
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
        this.generateQrCode();
        if (this.data?.autoShareWhatsApp) {
          setTimeout(() => this.openMessageReminder(), 350);
        }
      }
    });
  }

  generateQrCode(): void {
    const amount = this.activeTotalOutstandingDue;
    if (!this.dueSlip || amount <= 0) {
      this.qrDataUrl = null;
      return;
    }

    const payee = (this.payeeUpiId || '').trim();
    if (!payee) {
      this.qrDataUrl = null;
      return;
    }

    const name = (this.payeeMerchantName || this.data.instituteName || this.authService.getInstituteName() || 'Institute').trim();
    // Compact reference note so QR matrix remains low-density (larger modules, instant scan on printed paper)
    const shortRef = (this.noticeNumber || '').replace(/[^a-zA-Z0-9]/g, '').slice(-12);
    const cleanNote = shortRef ? `Fee Due ${shortRef}` : 'Fee Payment';

    // Universal NPCI standard UPI URI (omitting mc allows both personal and merchant VPAs to scan cleanly in PhonePe/GPay/Paytm)
    const upiUri = `upi://pay?pa=${payee}&pn=${encodeURIComponent(name)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(cleanNote)}`;

    QRCode.toDataURL(upiUri, {
      width: 420,
      margin: 4,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    }).then(url => {
      this.qrDataUrl = url;
    }).catch(err => {
      console.error('Failed to generate QR Code for Due Slip:', err);
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
    if (!el) {
      window.print();
      return;
    }

    let printIframe = document.getElementById('due-print-frame') as HTMLIFrameElement;
    if (printIframe) {
      printIframe.remove();
    }

    printIframe = document.createElement('iframe');
    printIframe.id = 'due-print-frame';
    printIframe.style.position = 'fixed';
    printIframe.style.right = '0';
    printIframe.style.bottom = '0';
    printIframe.style.width = '0';
    printIframe.style.height = '0';
    printIframe.style.border = '0';
    document.body.appendChild(printIframe);

    const doc = printIframe.contentWindow?.document || printIframe.contentDocument;
    if (!doc) {
      window.print();
      return;
    }

    const title = `Fee Due Slip - ${this.noticeNumber}`;

    doc.open();
    doc.write('<!DOCTYPE html><html><head><title>' + title + '</title><style>' +
      '@page { size: A4 portrait; margin: 4mm 6mm; }' +
      '* { box-sizing: border-box; margin: 0; padding: 0; }' +
      'body { font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #ffffff; font-size: 10.5px; line-height: 1.25; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
      'mat-icon { display: none !important; }' +
      '.due-paper { width: 100%; display: flex; flex-direction: column; padding: 0; margin: 0; }' +
      '.due-slip { position: relative; border: 1px solid #94a3b8; border-radius: 4px; padding: 5px 8px; background: #ffffff; box-sizing: border-box; page-break-inside: avoid !important; }' +
      '.due-watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 160px; height: 160px; opacity: 0.035; pointer-events: none; background-size: contain; background-position: center; background-repeat: no-repeat; z-index: 0; }' +
      '.tear-divider { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 14px 0; color: #475569; font-size: 8px; font-weight: 700; letter-spacing: 0.5px; page-break-inside: avoid !important; }' +
      '.tear-line { flex: 1; border-top: 1.5px dashed #64748b; height: 0; }' +
      '.tear-scissor { font-size: 13px; color: #334155; line-height: 1; }' +
      '.tear-scissor.flip { transform: scaleX(-1); }' +
      '.tear-badge { display: inline-flex; align-items: center; gap: 4px; background: #f1f5f9; border: 1px dashed #94a3b8; border-radius: 12px; padding: 1px 8px; white-space: nowrap; }' +
      '.tear-hindi { color: #64748b; }' +
      '.paper-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 3px; border-bottom: 1.5px solid #b91c1c; }' +
      '.inst-info { display: flex; align-items: center; gap: 7px; }' +
      '.logo-mark { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }' +
      '.inst-logo-img { width: 100%; height: 100%; object-fit: contain; }' +
      '.inst-name { font-size: 0.92rem; font-weight: 800; color: #0f172a; line-height: 1.1; margin: 0; }' +
      '.inst-subtitle { font-size: 0.58rem; color: #475569; margin: 1px 0 0; }' +
      '.inst-branch { font-size: 0.58rem; color: #b91c1c; font-weight: 600; margin: 1px 0 0; }' +
      '.branch-pill { background: #fef2f2; color: #b91c1c; padding: 0 4px; border-radius: 2px; border: 1px solid #fecaca; }' +
      '.branch-dept-sep { color: #94a3b8; }' +
      '.branch-dept { color: #64748b; }' +
      '.due-badge-block { text-align: right; }' +
      '.badge-title { font-size: 0.84rem; font-weight: 800; color: #b91c1c; letter-spacing: 0.04em; display: block; line-height: 1.1; }' +
      '.badge-sub { font-size: 0.58rem; color: #64748b; display: block; }' +
      '.copy-tag { display: inline-block; margin-top: 1px; font-size: 0.58rem; font-weight: 800; background: #fee2e2; color: #b91c1c; padding: 0 5px; border-radius: 2px; border: 1px solid #fca5a5; }' +
      '.copy-tag.office-copy-tag { background: #f5f3ff; color: #6d28d9; border-color: #ddd6fe; }' +
      '.meta-strip { display: flex; flex-wrap: wrap; gap: 3px 8px; padding: 2.5px 5px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 3px; margin: 3px 0; }' +
      '.meta-item { display: inline-flex; align-items: center; gap: 2px; font-size: 0.65rem; }' +
      '.meta-label { color: #64748b; font-weight: 600; }' +
      '.meta-val { color: #0f172a; font-weight: 700; }' +
      '.meta-val.highlight { color: #b91c1c; }' +
      '.meta-val.branch-val { color: #b91c1c; }' +
      '.status-badge-due { background: #fee2e2; color: #991b1b; padding: 0 3px; border-radius: 2px; font-size: 0.6rem; font-weight: 800; }' +
      '.student-profile-card { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 10px; padding: 3px 5px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 3px; margin-bottom: 3px; }' +
      '.prof-row { display: flex; align-items: baseline; gap: 6px; font-size: 0.65rem; line-height: 1.25; }' +
      '.prof-row .k { min-width: 110px; color: #475569; font-weight: 600; flex-shrink: 0; }' +
      '.prof-row .v { color: #0f172a; flex: 1; min-width: 0; }' +
      '.student-highlight { font-weight: 800; color: #991b1b; }' +
      '.hostel-info-pill { background: #e0f2fe; color: #0369a1; padding: 0 3px; border-radius: 2px; font-size: 0.6rem; }' +
      '.table-section { margin-bottom: 2px; }' +
      '.due-table { width: 100%; border-collapse: collapse; }' +
      '.due-table th { background: #eff6ff !important; color: #1e3a8a !important; border-top: 1px solid #bfdbfe; border-bottom: 1.5px solid #bfdbfe; padding: 2px 4px; font-size: 0.65rem; font-weight: 700; text-align: left; }' +
      '.due-table td { padding: 2px 4px; border-bottom: 1px solid #e2e8f0; font-size: 0.67rem; line-height: 1.15; }' +
      '.due-item-title { font-size: 0.68rem; color: #0f172a; font-weight: 700; }' +
      '.family-due-sibs-list { display: flex; flex-direction: column; gap: 1px; font-size: 0.63rem; line-height: 1.25; }' +
      '.fam-due-disc-pill { display: inline-block; margin-left: 3px; background: #dcfce7; color: #15803d; border: 1px solid #86efac; padding: 0 3px; border-radius: 2px; font-size: 0.56rem; font-weight: 700; }' +
      '.family-due-group-header { background: #eff6ff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
      '.family-due-group-header td { border-top: 1px solid #bfdbfe !important; border-bottom: 1px solid #bfdbfe !important; padding: 2px 4px !important; color: #1e3a8a !important; font-size: 0.64rem !important; }' +
      '.fam-grp-meta { font-size: 0.58rem; color: #1d4ed8; margin-left: 3px; }' +
      '.fam-grp-sub { font-size: 0.64rem; color: #b91c1c !important; white-space: nowrap; }' +
      '.family-summary-strip { background: #eff6ff !important; border-color: #93c5fd !important; color: #1e3a8a !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
      '.row-num { font-weight: 700; color: #475569; font-size: 0.62rem; }' +
      '.due-period-sub { font-size: 0.50rem; color: #64748b; display: flex; align-items: center; gap: 3px; margin-top: 0.5px; }' +
      '.inv-ref-tag { color: #2563eb; font-weight: 600; }' +
      '.due-date-val { font-size: 0.62rem; color: #1e293b; }' +
      '.overdue-chip { display: inline-block; font-size: 0.48rem; font-weight: 800; background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; padding: 0 2px; border-radius: 2px; margin-left: 2px; line-height: 1.1; vertical-align: middle; text-transform: uppercase; }' +
      '.advance-adj-row td { padding: 1.5px 4px; font-size: 0.60rem; background: #f0fdf4 !important; border-bottom: 1px solid #bbf7d0; }' +
      '.adv-adjusted-pill { color: #065f46; font-weight: 600; font-size: 0.56rem; }' +
      '.adv-amount-cell { color: #059669; font-weight: 700; font-size: 0.62rem; }' +
      '.amount-paid { color: #16a34a; }' +
      '.amount-due { color: #dc2626; font-weight: 800; }' +
      '.summary-subtotal { background: #f8fafc; border-top: 1.5px solid #cbd5e1; }' +
      '.grand-due { font-size: 0.8rem; font-weight: 800; color: #dc2626; }' +
      '.amount-words-strip { display: flex; justify-content: space-between; align-items: center; padding: 2px 5px; background: #fff1f2; border: 1px dashed #fca5a5; border-radius: 3px; margin-bottom: 2px; }' +
      '.words-left { display: flex; align-items: center; gap: 3px; font-size: 0.64rem; }' +
      '.w-label { color: #b91c1c; font-weight: 700; text-transform: uppercase; }' +
      '.w-text { color: #991b1b; font-weight: 700; }' +
      '.words-right { display: flex; align-items: center; gap: 3px; }' +
      '.due-stamp { background: #dc2626; color: #fff; padding: 1px 4px; border-radius: 6px; font-weight: 800; font-size: 0.6rem; }' +
      '.upi-payee-pill { font-size: 0.55rem; color: #065f46; background: #d1fae5; padding: 0 3px; border-radius: 2px; border: 1px solid #a7f3d0; }' +
      '.lib-due-notice-strip { display: flex; justify-content: space-between; align-items: center; padding: 1px 4px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 2px; font-size: 0.6rem; color: #92400e; margin-bottom: 2px; }' +
      '.signatures-row { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 6px; margin-bottom: 2px; }' +
      '.sig-col { width: 130px; }' +
      '.sig-line { height: 1px; background: #475569; margin-bottom: 2px; }' +
      '.sig-text { font-size: 0.62rem; font-weight: 700; color: #334155; display: block; line-height: 1.1; }' +
      '.auth-sub { font-size: 0.55rem; color: #64748b; display: block; }' +
      '.uploaded-official-seal-img { max-width: 32px; max-height: 32px; object-fit: contain; display: block; margin: 0 auto; }' +
      '.digital-seal { border: 1px dashed #b91c1c; border-radius: 2px; padding: 1px 3px; background: #fef2f2; color: #b91c1c; font-size: 0.55rem; font-weight: 800; text-align: center; }' +
      '.sig-col-qr { width: 104px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }' +
      '.receipt-mini-qr { width: 96px; height: 96px; object-fit: contain; border: none; background: #ffffff; padding: 0; display: block; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
      '.qr-label { font-size: 0.54rem; font-weight: 700; color: #334155; margin-top: 2px; white-space: nowrap; text-align: center; }' +
      '.digital-sign-wrapper { display: flex; align-items: flex-end; justify-content: flex-end; height: 16px; margin-bottom: 1px; }' +
      '.digital-sign-img { max-height: 16px; max-width: 70px; object-fit: contain; mix-blend-mode: multiply; }' +
      '.receipt-note-box { background: #f8fafc !important; border: 1px dashed #94a3b8 !important; border-radius: 2px; padding: 2px 5px; margin-top: 2px; margin-bottom: 2px; font-size: 0.54rem; line-height: 1.2; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
      '.note-row { display: flex; align-items: baseline; gap: 3px; }' +
      '.note-tag-en { color: #1d4ed8; font-weight: 700; white-space: nowrap; }' +
      '.note-tag-hi { color: #b91c1c; font-weight: 700; white-space: nowrap; }' +
      '.paper-footer { text-align: center; font-size: 0.54rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 1px; margin-top: 1px; }' +
      '.text-center { text-align: center; }' +
      '.text-right { text-align: right; }' +
      '</style></head><body>' + el.outerHTML + '</body></html>');
    doc.close();

    setTimeout(() => {
      try {
        printIframe.contentWindow?.focus();
        printIframe.contentWindow?.print();
      } catch {
        window.print();
      }
    }, 250);
  }

  openMessageReminder(): void {
    const inv = this.data.invoice;
    const isSchool = inv?.isSchoolStudent ?? this.dueSlip?.isSchoolStudent ?? (!this.dueSlip?.batchName);
    const isCoaching = inv?.isCoachingStudent ?? this.dueSlip?.isCoachingStudent ?? (!!this.dueSlip?.batchName);
    const scopeTag = (isSchool && isCoaching) ? 'Hybrid' : (isCoaching ? 'Coaching' : 'School');

    let resolvedDueDate: string | Date = new Date();
    const dueItems = this.dueSlip?.dueItems || [];
    const now = new Date();
    const sortedItems = [...dueItems].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const overdueItems = sortedItems.filter(it => it.dueDate && new Date(it.dueDate) < now);
    const upcomingItems = sortedItems.filter(it => it.dueDate && new Date(it.dueDate) >= now);

    if (inv?.dueDate) {
      resolvedDueDate = inv.dueDate;
    } else if (overdueItems.length > 0) {
      // Use latest overdue dueDate (e.g. 10-Nov-2026) instead of oldest (10-Feb-2026)
      resolvedDueDate = overdueItems[overdueItems.length - 1].dueDate;
    } else if (sortedItems.length > 0) {
      resolvedDueDate = sortedItems[0].dueDate || new Date();
    }

    const fmtEnMo = (dt: string | Date) => new Date(dt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const fmtShortMo = (dt: string | Date) => new Date(dt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    const hiMonths = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
    const fmtHiMo = (dt: string | Date) => {
      const d = new Date(dt);
      return `${hiMonths[d.getMonth()]} ${d.getFullYear()}`;
    };

    const overdueFromHi = overdueItems.length > 0 ? fmtHiMo(overdueItems[0].dueDate) : undefined;
    const overdueToHi = overdueItems.length > 0 ? fmtHiMo(overdueItems[overdueItems.length - 1].dueDate) : undefined;
    const overdueFromEn = overdueItems.length > 0 ? fmtEnMo(overdueItems[0].dueDate) : undefined;
    const overdueToEn = overdueItems.length > 0 ? fmtEnMo(overdueItems[overdueItems.length - 1].dueDate) : undefined;
    const upcomingHi = upcomingItems.length > 0 ? fmtHiMo(upcomingItems[upcomingItems.length - 1].dueDate) : undefined;
    const upcomingEn = upcomingItems.length > 0 ? fmtEnMo(upcomingItems[upcomingItems.length - 1].dueDate) : undefined;

    let billingPeriodLabel: string | undefined;
    if (sortedItems.length > 1) {
      const firstShort = fmtShortMo(sortedItems[0].dueDate);
      const lastShort = fmtShortMo(sortedItems[sortedItems.length - 1].dueDate);
      billingPeriodLabel = firstShort === lastShort ? firstShort : `${firstShort} – ${lastShort}`;
    } else if (sortedItems.length === 1) {
      billingPeriodLabel = fmtShortMo(sortedItems[0].dueDate);
    }

    const totalFee = dueItems.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0) || (inv?.totalAmount || this.dueSlip?.totalOutstandingDue || 0);
    const totalPaid = dueItems.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0) || (inv?.paidAmount || 0);

    const reminderItem: FeeReminderDispatchItem = {
      id: inv?.id || this.data.invoiceId,
      studentId: this.data.studentId || inv?.studentId,
      studentName: this.dueSlip?.studentName || this.data.studentName || inv?.studentName || 'Student',
      rollNumber: this.dueSlip?.rollNumber || this.data.rollNumber || inv?.rollNumber,
      className: this.effectiveClassName || this.dueSlip?.batchName || this.data.batchName || inv?.className || 'General',
      invoiceNumber: this.invoiceNumbersDisplay || inv?.invoiceNumber || this.noticeNumber,
      totalAmount: totalFee,
      paidAmount: totalPaid,
      dueAmount: this.dueSlip?.totalOutstandingDue ?? (inv?.dueAmount || 0),
      status: (this.dueSlip?.totalOutstandingDue ?? inv?.dueAmount ?? 0) > 0 ? 'Overdue' : 'Paid',
      dueDate: resolvedDueDate,
      parentWhatsAppPhone: this.dueSlip?.parentPhone || this.data.parentWhatsAppPhone || inv?.parentWhatsAppPhone,
      isSchoolStudent: isSchool,
      isCoachingStudent: isCoaching,
      scopeTag: scopeTag,
      overdueMonthsCount: overdueItems.length,
      overdueFromHi,
      overdueToHi,
      overdueFromEn,
      overdueToEn,
      upcomingHi,
      upcomingEn,
      billingPeriodLabel
    };

    this.dialog.open(FeeReminderDispatchDialogComponent, {
      width: '780px',
      maxWidth: '96vw',
      panelClass: 'fee-reminder-dispatch-dialog-panel',
      data: {
        mode: 'single',
        invoice: reminderItem,
        instituteName: this.data.instituteName || this.authService.currentUser()?.instituteName || this.authService.getInstituteName() || 'Institute'
      }
    });
  }

  shareWhatsApp(): void {
    this.openMessageReminder();
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
