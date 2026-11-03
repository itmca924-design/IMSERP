import { Component, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { FeePaymentReceipt, FeesService, UpiPaymentSettings } from '../../core/services/fees.service';
import { AuthService } from '../../core/services/auth.service';
import * as QRCode from '../../shared/utils/qr-code';

export interface FeeReceiptDialogData {
  receipt: FeePaymentReceipt;
  instituteName?: string;
  branchName?: string;
  logoUrl?: string | null;
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
          @if (data.receipt.parentPhone) {
            <button class="header-action-btn wa-btn" (click)="shareWhatsApp()" matTooltip="Send WhatsApp Receipt" matButton="filled">
              <svg class="wa-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              <span>WhatsApp</span>
            </button>
          }
          <button class="header-action-btn print-btn" (click)="printReceipt()" matTooltip="Print or Download PDF" matButton="filled">
            <mat-icon>print</mat-icon>
            <span>Print Receipt</span>
          </button>
          <button class="header-close-btn" (click)="dialogRef.close()" matTooltip="Close" mat-icon-button>
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>
    
      <!-- Printable Receipt Document -->
      <div class="receipt-paper" id="receipt-paper">
        @for (copy of receiptCopies; track copy.title; let isLast = $last) {
          <div class="receipt-slip" [class.office-slip]="copy.isOffice">
            <!-- Transparent Dynamic Watermark in background -->
            @if (logoUrl && !logoFailed) {
              <div class="receipt-watermark" [style.backgroundImage]="'url(' + logoUrl + ')'"></div>
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
                  <h2 class="inst-name">{{ data.instituteName || authService.currentUser()?.instituteName || authService.getInstituteName() || 'Official Fee Receipt' }}</h2>
                  <p class="inst-subtitle">Premier Center for Academic Excellence &amp; Education</p>
                  @if (effectiveBranchName) {
                    <p class="inst-branch">
                      <span class="branch-pill">🏛️ Branch: {{ effectiveBranchName }}</span>
                      <span class="branch-dept-sep">|</span>
                      <span class="branch-dept">Authorized Accounts Department</span>
                    </p>
                  }
                </div>
              </div>
              <div class="receipt-badge">
                <div class="badge-title-wrap">
                  <span class="badge-title">FEE RECEIPT</span>
                  <span class="badge-sub">शुल्क भुगतान रसीद</span>
                </div>
                <span class="copy-tag" [class.office-copy-tag]="copy.isOffice">
                  {{ copy.title }} ({{ copy.hindiTitle }})
                </span>
              </div>
            </div>

            <!-- Meta Info Strip -->
            <div class="meta-strip" [class.has-ref]="!!data.receipt.transactionRef">
              <div class="meta-item">
                <span class="meta-label">Receipt Number:</span>
                <span class="meta-val highlight">{{ data.receipt.receiptNumber }}</span>
              </div>
              @if (feeMonthDisplay) {
                <div class="meta-item month-meta-item">
                  <span class="meta-label">Fee Month / Period:</span>
                  <span class="meta-val month-pill">{{ feeMonthDisplay }}</span>
                </div>
              }
              <div class="meta-item">
                <span class="meta-label">Academic Session:</span>
                <span class="meta-val session-pill">{{ effectiveSession }}</span>
              </div>
              <div class="meta-item time-item">
                <span class="meta-label">Date &amp; Time (IST):</span>
                <span class="meta-val date-time-val">{{ formatToIST(data.receipt.paymentDate) }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Payment Mode:</span>
                <span class="meta-val mode-pill">{{ getPaymentModeName(data.receipt.mode) }}</span>
              </div>
              @if (data.receipt.transactionRef) {
                <div class="meta-item">
                  <span class="meta-label">Txn / UTR Ref:</span>
                  <span class="meta-val">{{ data.receipt.transactionRef }}</span>
                </div>
              }
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
                @if (data.receipt.className && !data.receipt.batchName) {
                  <div class="prof-row">
                    <span class="k">Class &amp; Section:</span>
                    <span class="v"><strong>{{ data.receipt.className }}@if (data.receipt.sectionName) {
                      <span> (Section {{ data.receipt.sectionName }})</span>
                    }</strong></span>
                  </div>
                }
                @if (data.receipt.className && data.receipt.batchName) {
                  <div class="prof-row">
                    <span class="k">Coaching:</span>
                    <span class="v"><strong>{{ data.receipt.className }}</strong></span>
                  </div>
                }
                @if (!data.receipt.className && data.receipt.batchName) {
                  <div class="prof-row">
                    <span class="k">Coaching:</span>
                    <span class="v"><strong>Coaching</strong></span>
                  </div>
                }
                @if (!data.receipt.className && !data.receipt.batchName) {
                  <div class="prof-row">
                    <span class="k">Academic Stream:</span>
                    <span class="v">General Academic</span>
                  </div>
                }
                @if (feeMonthDisplay) {
                  <div class="prof-row fee-month-row">
                    <span class="k">Fee Month (शुल्क माह):</span>
                    <span class="v fee-month-badge" [title]="feeMonthTooltip">
                      <strong>{{ feeMonthDisplay }}</strong>
                    </span>
                  </div>
                }
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
                @if (data.receipt.batchName) {
                  <div class="prof-row">
                    <span class="k">Batch:</span>
                    <span class="v"><strong>{{ data.receipt.batchName }}</strong></span>
                  </div>
                }
                <div class="prof-row">
                  <span class="k">Settlement Type:</span>
                  <span class="v status-pill">FIFO Auto-Settlement</span>
                </div>
                @if (data.receipt.hostelInfo) {
                  <div class="prof-row">
                    <span class="k">🏠 Hostel Facility:</span>
                    <span class="v hostel-info-pill">{{ data.receipt.hostelInfo }}</span>
                  </div>
                }
              </div>
            </div>

            <!-- Fees Breakdown Table -->
            <div class="table-section">
              <table class="receipt-table">
                <thead>
                  <tr>
                    <th class="text-center" style="width: 36px;">#</th>
                    <th>Fee Head / Particulars</th>
                    <th class="text-right" style="width: 160px;">Amount Received (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  @if (data.receipt.items && data.receipt.items.length > 0) {
                    @for (item of data.receipt.items; track item) {
                      <tr>
                        <td class="text-center">{{ item.itemIndex }}</td>
                        <td>
                          <strong class="fee-head-title">{{ item.particulars }}</strong>
                          @if (formatSubTitle(item.subTitle)) {
                            <div class="fee-head-sub">{{ formatSubTitle(item.subTitle) }}</div>
                          }
                        </td>
                        <td class="text-right amount-col">
                          <strong>₹{{ item.amount | number:'1.2-2' }}</strong>
                        </td>
                      </tr>
                    }
                  } @else {
                    <tr>
                      <td class="text-center">1</td>
                      <td>
                        <strong class="fee-head-title">Tuition &amp; Coaching Fee Settlement</strong>
                        <div class="fee-head-sub">{{ data.receipt.remarks || 'Standard Monthly Tuition Fee installment' }}</div>
                      </td>
                      <td class="text-right amount-col">
                        <strong>₹{{ (data.receipt.tuitionAmountPaid !== undefined && data.receipt.tuitionAmountPaid > 0 ? data.receipt.tuitionAmountPaid : data.receipt.amountPaid) | number:'1.2-2' }}</strong>
                      </td>
                    </tr>
                    @if (data.receipt.libraryFineAmountPaid && data.receipt.libraryFineAmountPaid > 0) {
                      <tr>
                        <td class="text-center">2</td>
                        <td>
                          <strong class="fee-head-title">Library Overdue Fine Settlement</strong>
                          <div class="fee-head-sub">{{ data.receipt.libraryFineParticulars || 'Late Return Fine Settlement' }}</div>
                        </td>
                        <td class="text-right amount-col">
                          <strong>₹{{ data.receipt.libraryFineAmountPaid | number:'1.2-2' }}</strong>
                        </td>
                      </tr>
                    }
                  }

                  <tr class="summary-subtotal">
                    <td colspan="2" class="text-right"><strong>Total Amount Received:</strong></td>
                    <td class="text-right grand-paid">₹{{ data.receipt.amountPaid | number:'1.2-2' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Amount In Words & Status Box -->
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
                @if (data.receipt.remainingDue === 0) {
                  <span class="cleared-tag">✓ All Dues Cleared</span>
                }
                @if (data.receipt.remainingDue > 0) {
                  <span class="balance-due-tag">Bal Due: ₹{{ data.receipt.remainingDue | number:'1.2-2' }}</span>
                }
              </div>
            </div>

            <!-- Compact Dues Notice if remaining dues exist -->
            @if (data.receipt.remainingDue > 0) {
              <div class="compact-due-notice">
                <span>⚠️ Note: Outstanding balance of <strong>₹{{ data.receipt.remainingDue | number:'1.2-2' }}</strong> remains due for payment.</span>
                @if (payeeUpiId) {
                  <span class="upi-hint">UPI Payee: <strong>{{ payeeUpiId }}</strong></span>
                }
              </div>
            }

            <!-- Compact Arrears Table (if any pending arrears exist) -->
            @if (data.receipt.pendingArrears && data.receipt.pendingArrears.length > 0) {
              <div class="arrears-compact-section">
                <div class="arrears-header-row">
                  <span class="arrears-title">⚠️ Pending Arrears / शेष बकाया</span>
                  <span class="arrears-total">₹{{ totalArrearsAmount | number:'1.2-2' }}</span>
                </div>
                <div class="arrears-items-row">
                  @for (arr of data.receipt.pendingArrears; track arr.invoiceNumber) {
                    <span class="arrears-chip">
                      <span class="arr-name">{{ arr.title || arr.period }}</span>
                      <span class="arr-amt">₹{{ arr.dueAmount | number:'1.0-0' }}</span>
                    </span>
                  }
                </div>
              </div>
            }

            <!-- Signature Blocks + QR Code -->
            <div class="signatures-row">
              <div class="sig-col">
                <div class="sig-line"></div>
                <span class="sig-text">Student / Depositor Signature</span>
              </div>
              <div class="sig-col text-center">
                @if (officialSealUrl) {
                  <img [src]="officialSealUrl" alt="Official Seal" class="uploaded-official-seal-img" />
                }
                @if (!officialSealUrl) {
                  <div class="digital-seal">
                    <span>★ OFFICIAL RECEIPT ★</span>
                    <small>{{ data.receipt.paymentDate | date:'dd-MMM-yyyy' }}</small>
                  </div>
                }
              </div>
              @if (qrDataUrl) {
                <div class="sig-col-qr text-center">
                  <img [src]="qrDataUrl" alt="QR Code" class="receipt-mini-qr" />
                  <span class="qr-label">{{ data.receipt.remainingDue > 0 ? 'Scan to Pay' : 'Verify' }}</span>
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

            <!-- Footer Notice -->
            <div class="paper-footer">
              <span>Official Computer-Generated Receipt • {{ copy.title }} • IMSERP Management Suite</span>
            </div>
          </div>

          <!-- Perforation / Scissor Cut Divider -->
          @if (!isLast) {
            <div class="tear-divider">
              <div class="tear-scissor">✂</div>
              <div class="tear-line"></div>
              <div class="tear-badge">
                <span class="tear-cut-text">TEAR / CUT HERE</span>
                <span class="tear-hindi">(यहाँ से फाड़कर छात्र को दें — कार्यालय प्रति नीचे सुरक्षित रखें)</span>
              </div>
              <div class="tear-line"></div>
              <div class="tear-scissor flip">✂</div>
            </div>
          }
        }
      </div>
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
          border-radius: 8px;
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
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
          gap: 5px !important;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }

          &.wa-btn {
            background: #16a34a !important;
            color: #ffffff !important;
            &:hover { background: #15803d !important; }
            .wa-icon { width: 16px; height: 16px; fill: currentColor; }
          }
          &.print-btn {
            background: #2563eb !important;
            color: #ffffff !important;
            &:hover { background: #1d4ed8 !important; }
          }
        }

        .header-close-btn {
          color: #64748b !important;
          width: 32px !important;
          height: 32px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
          &:hover {
            color: #1e293b !important;
            background: rgba(30, 41, 59, 0.08) !important;
          }
        }
      }
    }

    .receipt-paper {
      position: relative;
      padding: 12px 16px;
      background: #f8fafc;
      color: #0f172a;
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.35;
      overflow-y: auto;
      max-height: calc(88vh - 54px);
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .receipt-slip {
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

    .receipt-watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 200px;
      height: 200px;
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
      margin: 10px 0;
      user-select: none;
      page-break-inside: avoid;

      .tear-line {
        flex: 1;
        border-top: 1.5px dashed #94a3b8;
        height: 0;
      }
      .tear-scissor {
        font-size: 15px;
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
        font-size: 0.68rem;
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
      border-bottom: 1.5px solid #0f172a;
      position: relative;
      z-index: 1;

      .inst-info {
        display: flex;
        align-items: center;
        gap: 10px;

        .logo-mark {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;

          .inst-logo-img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          mat-icon { font-size: 26px; width: 26px; height: 26px; color: #2563eb; }
        }

        .inst-text {
          .inst-name {
            margin: 0;
            font-size: 1.05rem;
            font-weight: 800;
            color: #0f172a;
            line-height: 1.15;
          }
          .inst-subtitle {
            margin: 1px 0 0;
            font-size: 0.68rem;
            color: #475569;
          }
          .inst-branch {
            margin: 2px 0 0;
            font-size: 0.65rem;
            color: #3b82f6;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 4px;
            .branch-pill {
              background: #eff6ff;
              color: #1e40af;
              padding: 1px 5px;
              border-radius: 4px;
              border: 1px solid #bfdbfe;
              font-weight: 700;
            }
            .branch-dept-sep { color: #94a3b8; }
            .branch-dept { color: #64748b; }
          }
        }
      }

      .receipt-badge {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;

        .badge-title-wrap {
          text-align: right;
          .badge-title {
            font-size: 0.92rem;
            font-weight: 800;
            color: #1e40af;
            letter-spacing: 0.05em;
            display: block;
            line-height: 1.1;
          }
          .badge-sub {
            font-size: 0.65rem;
            color: #64748b;
            font-weight: 600;
            display: block;
          }
        }

        .copy-tag {
          display: inline-block;
          font-size: 0.65rem;
          font-weight: 800;
          background: #eff6ff;
          color: #1d4ed8;
          padding: 1px 7px;
          border-radius: 4px;
          border: 1px solid #bfdbfe;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          white-space: nowrap;

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
      align-items: center;
      gap: 6px 14px;
      padding: 4px 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      margin: 5px 0;
      position: relative;
      z-index: 1;

      .meta-item {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.72rem;

        .meta-label {
          color: #64748b;
          font-weight: 600;
        }
        .meta-val {
          color: #0f172a;
          font-weight: 700;

          &.highlight {
            color: #1d4ed8;
          }
          &.month-pill {
            background: #e0f2fe;
            color: #0369a1;
            padding: 0 5px;
            border-radius: 3px;
          }
          &.session-pill {
            background: #eff6ff;
            color: #1e40af;
            padding: 0 5px;
            border-radius: 3px;
            border: 1px solid #bfdbfe;
          }
          &.date-time-val {
            color: #334155;
          }
          &.mode-pill {
            background: #dcfce7;
            color: #15803d;
            padding: 0 5px;
            border-radius: 3px;
          }
        }
      }
    }

    /* Student Profile Box */
    .student-profile-card {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 16px;
      padding: 5px 8px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 4px;
      margin-bottom: 5px;
      position: relative;
      z-index: 1;

      .prof-row {
        display: flex;
        font-size: 0.72rem;
        line-height: 1.35;
        .k {
          width: 135px;
          white-space: nowrap;
          color: #475569;
          font-weight: 600;
          flex-shrink: 0;
        }
        .v {
          color: #0f172a;
          flex: 1;
          &.student-highlight {
            color: #15803d;
            font-weight: 800;
          }
          &.fee-month-badge {
            color: #1e40af;
          }
          &.status-pill {
            display: inline-block;
            background: #e0f2fe;
            color: #0369a1;
            padding: 0 5px;
            border-radius: 3px;
            font-size: 0.65rem;
          }
          &.hostel-info-pill {
            color: #b45309;
            font-weight: 700;
          }
        }
      }
    }

    /* Fees Breakdown Table */
    .table-section {
      margin-bottom: 4px;
      position: relative;
      z-index: 1;
    }
    .receipt-table {
      width: 100%;
      border-collapse: collapse;

      th {
        background: #eff6ff !important;
        color: #1e3a8a !important;
        border-top: 1px solid #bfdbfe;
        border-bottom: 1.5px solid #bfdbfe;
        padding: 3px 6px;
        font-size: 0.72rem;
        font-weight: 700;
        text-align: left;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      td {
        padding: 3px 6px;
        border-bottom: 1px solid #e2e8f0;
        font-size: 0.75rem;
        line-height: 1.25;

        .fee-head-title {
          font-size: 0.76rem;
          color: #0f172a;
          font-weight: 700;
        }
        .fee-head-sub {
          font-size: 0.65rem;
          color: #64748b;
        }
        &.amount-col {
          color: #0f172a;
        }
      }
      .summary-subtotal {
        background: #f8fafc;
        border-top: 1.5px solid #cbd5e1;
        td {
          padding: 4px 6px;
          font-size: 0.78rem;
        }
      }
      .grand-paid {
        font-size: 0.88rem;
        font-weight: 800;
        color: #16a34a;
      }
    }

    /* Amount Words & Status Box */
    .amount-words-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3px 8px;
      background: #eff6ff;
      border: 1px dashed #93c5fd;
      border-radius: 4px;
      margin-bottom: 4px;
      position: relative;
      z-index: 1;

      .words-left {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.7rem;
        .w-label {
          color: #3b82f6;
          font-weight: 700;
          text-transform: uppercase;
        }
        .w-text {
          color: #1e3a8a;
          font-weight: 700;
        }
      }

      .words-right {
        display: flex;
        align-items: center;
        gap: 6px;

        .paid-stamp {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: #16a34a;
          color: #ffffff;
          padding: 1px 7px;
          border-radius: 12px;
          font-weight: 800;
          font-size: 0.68rem;
          mat-icon { font-size: 13px; width: 13px; height: 13px; }
        }
        .cleared-tag {
          font-size: 0.68rem;
          font-weight: 700;
          color: #15803d;
        }
        .balance-due-tag {
          font-size: 0.68rem;
          font-weight: 800;
          color: #b91c1c;
          background: #fef2f2;
          border: 1px solid #fecaca;
          padding: 1px 5px;
          border-radius: 3px;
        }
      }
    }

    .compact-due-notice {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2px 6px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 3px;
      font-size: 0.65rem;
      color: #92400e;
      margin-bottom: 4px;
      position: relative;
      z-index: 1;
      .upi-hint {
        color: #047857;
      }
    }

    /* Signatures Row */
    .signatures-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 10px;
      margin-bottom: 3px;
      position: relative;
      z-index: 1;

      .sig-col {
        width: 160px;

        .sig-line {
          height: 1px;
          background: #475569;
          margin-bottom: 2px;
        }
        .sig-text {
          font-size: 0.68rem;
          font-weight: 700;
          color: #334155;
          display: block;
          line-height: 1.1;
        }
        .auth-sub {
          font-size: 0.62rem;
          color: #64748b;
          display: block;
        }
        .uploaded-official-seal-img {
          max-width: 44px;
          max-height: 44px;
          object-fit: contain;
          display: block;
          margin: 0 auto;
        }
        .digital-seal {
          border: 1px dashed #0284c7;
          border-radius: 4px;
          padding: 2px 6px;
          background: #f0f9ff;
          color: #0284c7;
          font-size: 0.62rem;
          font-weight: 800;
          text-align: center;
          display: inline-block;
          small { display: block; font-size: 0.58rem; font-weight: 600; }
        }
        .digital-sign-wrapper {
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          height: 22px;
          margin-bottom: 2px;
          .digital-sign-img {
            max-height: 22px;
            max-width: 100px;
            object-fit: contain;
            mix-blend-mode: multiply;
          }
        }
      }
    }

    .paper-footer {
      text-align: center;
      font-size: 0.6rem;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 2px;
      margin-top: 2px;
      position: relative;
      z-index: 1;
    }

    .text-center { text-align: center; }
    .text-right { text-align: right; }

    /* Compact Arrears Section */
    .arrears-compact-section {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 3px;
      padding: 2px 5px;
      margin-bottom: 3px;
      position: relative;
      z-index: 1;
    }
    .arrears-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2px;
    }
    .arrears-title {
      font-size: 0.62rem;
      font-weight: 700;
      color: #b91c1c;
    }
    .arrears-total {
      font-size: 0.68rem;
      font-weight: 800;
      color: #dc2626;
    }
    .arrears-items-row {
      display: flex;
      flex-wrap: wrap;
      gap: 2px 4px;
    }
    .arrears-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: #fff;
      border: 1px solid #fecaca;
      border-radius: 2px;
      padding: 0 4px;
      font-size: 0.58rem;
      line-height: 1.4;
    }
    .arr-name {
      color: #92400e;
      font-weight: 600;
    }
    .arr-amt {
      color: #dc2626;
      font-weight: 800;
    }

    /* Mini QR in Signatures Row */
    .sig-col-qr {
      width: 52px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
    }
    .receipt-mini-qr {
      width: 48px;
      height: 48px;
      object-fit: contain;
      border: 1px solid #e2e8f0;
      border-radius: 2px;
    }
    .qr-label {
      font-size: 0.5rem;
      font-weight: 700;
      color: #475569;
      margin-top: 1px;
      white-space: nowrap;
    }

    @media print {
      .no-print { display: none !important; }
      .receipt-paper {
        padding: 0 !important;
        max-height: none !important;
        overflow: visible !important;
        background: transparent !important;
      }
      .receipt-slip {
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
    }

  `]
})
export class FeeReceiptDialogComponent implements OnInit {
  receiptCopies = [
    { title: 'STUDENT COPY', hindiTitle: 'छात्र प्रति', isOffice: false },
    { title: 'OFFICE COPY', hindiTitle: 'कार्यालय प्रति', isOffice: true }
  ];
  logoUrl: string | null = null;
  logoFailed = false;

  payeeUpiId = 'imserp.fees@sbi';
  payeeMerchantName = '';
  bankAccountDisplay = '';
  qrDataUrl: string | null = null;

  get effectiveSession(): string {
    if (this.data?.receipt?.academicSession) return this.data.receipt.academicSession;
    const dateStr = this.data?.receipt?.paymentDate;
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const startYear = d.getMonth() >= 3 ? year : year - 1;
        return `${startYear}-${startYear + 1}`;
      }
    }
    const current = new Date();
    const startYear = current.getMonth() >= 3 ? current.getFullYear() : current.getFullYear() - 1;
    return `${startYear}-${startYear + 1}`;
  }

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

  get feeMonthTooltip(): string {
    const r = this.data?.receipt;
    if (!r) return '';
    return (r as any).feePeriod || (r as any).feeMonth || this.feeMonthDisplay;
  }

  get feeMonthDisplay(): string {
    const r = this.data?.receipt;
    if (!r) return '';
    let raw = '';
    if ((r as any).feePeriod && (r as any).feePeriod.trim()) {
      raw = (r as any).feePeriod.trim();
    } else if ((r as any).feeMonth && (r as any).feeMonth.trim()) {
      raw = (r as any).feeMonth.trim();
    } else {
      const periodsFound: string[] = [];
      const monthRegex = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi;

      // 1. Extract from line items (subTitle and particulars)
      if (r.items && r.items.length > 0) {
        for (const item of r.items) {
          const textToSearch = `${item.subTitle || ''} ${item.particulars || ''}`;
          let match: RegExpExecArray | null;
          while ((match = monthRegex.exec(textToSearch)) !== null) {
            const cap = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() + ' ' + match[2];
            if (!periodsFound.includes(cap)) {
              periodsFound.push(cap);
            }
          }
        }
      }

      // 2. Extract from remarks
      if (periodsFound.length === 0 && r.remarks) {
        let match: RegExpExecArray | null;
        while ((match = monthRegex.exec(r.remarks)) !== null) {
          const cap = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() + ' ' + match[2];
          if (!periodsFound.includes(cap)) {
            periodsFound.push(cap);
          }
        }
      }

      // 3. Extract from invoice number (e.g. INV-202611-825 -> November 2026)
      if (periodsFound.length === 0 && r.invoiceNumber) {
        const invMatch = r.invoiceNumber.match(/INV-(\d{4})(\d{2})-/i);
        if (invMatch) {
          const year = parseInt(invMatch[1], 10);
          const monthIdx = parseInt(invMatch[2], 10) - 1;
          const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          if (monthIdx >= 0 && monthIdx < 12) {
            periodsFound.push(`${months[monthIdx]} ${year}`);
          }
        }
      }

      // 4. Check pendingArrears if available
      if (periodsFound.length === 0 && r.pendingArrears && r.pendingArrears.length > 0) {
        for (const arr of r.pendingArrears) {
          if (arr.period) {
            let match: RegExpExecArray | null;
            while ((match = monthRegex.exec(arr.period)) !== null) {
              const cap = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() + ' ' + match[2];
              if (!periodsFound.includes(cap)) {
                periodsFound.push(cap);
              }
            }
          }
        }
      }

      if (periodsFound.length > 0) {
        raw = periodsFound.join(', ');
      } else if (r.paymentDate) {
        const d = new Date(r.paymentDate);
        if (!isNaN(d.getTime())) {
          const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          raw = `${months[d.getMonth()]} ${d.getFullYear()}`;
        }
      }
    }

    return this.formatCleanFeePeriod(raw);
  }

  formatCleanFeePeriod(raw: string): string {
    if (!raw) return '';
    // Strip redundant suffixes like " Fee (Monthly)", " Fee", " (Monthly)"
    let text = raw.replace(/\s+Fee\s*\((Monthly|Quarterly|Annual|One-time)\)/gi, '')
                  .replace(/\s+Fee\b/gi, '')
                  .replace(/\s+\(Monthly\)/gi, '')
                  .trim();

    const monthRegex = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const matches: { month: string, year: number, monthIdx: number }[] = [];
    let match: RegExpExecArray | null;
    while ((match = monthRegex.exec(text)) !== null) {
      const mName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      const yr = parseInt(match[2], 10);
      const idx = monthNames.indexOf(mName);
      if (idx !== -1 && !matches.some(x => x.monthIdx === idx && x.year === yr)) {
        matches.push({ month: mName, year: yr, monthIdx: idx });
      }
    }

    if (matches.length === 0) {
      return text;
    }
    if (matches.length === 1) {
      return `${matches[0].month} ${matches[0].year}`;
    }
    if (matches.length === 2) {
      return `${shortMonths[matches[0].monthIdx]} ${matches[0].year} & ${shortMonths[matches[1].monthIdx]} ${matches[1].year}`;
    }

    // Sort chronologically
    matches.sort((a, b) => (a.year * 12 + a.monthIdx) - (b.year * 12 + b.monthIdx));

    // Check if consecutive
    let isConsecutive = true;
    for (let i = 1; i < matches.length; i++) {
      if ((matches[i].year * 12 + matches[i].monthIdx) !== (matches[i - 1].year * 12 + matches[i - 1].monthIdx + 1)) {
        isConsecutive = false;
        break;
      }
    }

    if (isConsecutive) {
      const first = matches[0];
      const last = matches[matches.length - 1];
      if (first.year === last.year) {
        return `${shortMonths[first.monthIdx]} – ${shortMonths[last.monthIdx]} ${first.year} (${matches.length} M)`;
      } else {
        return `${shortMonths[first.monthIdx]} ${first.year} – ${shortMonths[last.monthIdx]} ${last.year} (${matches.length} M)`;
      }
    } else {
      return matches.map(m => `${shortMonths[m.monthIdx]} '${String(m.year).slice(-2)}`).join(', ');
    }
  }

  getItemMonthTag(item: any): string {
    if (!item) return '';
    const textToSearch = `${item.subTitle || ''} ${item.particulars || ''}`;
    const monthRegex = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i;
    const match = textToSearch.match(monthRegex);
    if (match) {
      return `${match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()} ${match[2]}`;
    }
    const qMatch = textToSearch.match(/\b(Q[1-4]|Quarter\s+[1-4])\s*\(?([^\)]*)\)?/i);
    if (qMatch) {
      return qMatch[0].trim();
    }
    const part = (item.particulars || '').toLowerCase();
    if (!part.includes('library') && !part.includes('fine') && this.feeMonthDisplay && !this.feeMonthDisplay.includes(',')) {
      return this.feeMonthDisplay;
    }
    return '';
  }

  constructor(
    public dialogRef: MatDialogRef<FeeReceiptDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FeeReceiptDialogData,
    private feesService: FeesService,
    public authService: AuthService
  ) {
    if (this.data) {
      let r: any = (this.data as any).receipt || this.data;
      if (r && r.receipt) {
        r = r.receipt;
      }
      const rawLogo = this.data.logoUrl || r?.instituteLogoUrl || r?.tenantProfilePhoto || this.authService.currentUser()?.profilePhoto;
      this.data = {
        receipt: r,
        instituteName: this.data.instituteName || r?.tenantName || r?.instituteName || this.authService.currentUser()?.instituteName || 'Official Fee Receipt',
        branchName: this.data.branchName || r?.branchName,
        logoUrl: this.authService.resolveLogoUrl(rawLogo) || null
      };
    }
    this.logoUrl = this.data?.logoUrl || this.authService.getInstituteLogoUrl();
  }

  get officialSealUrl(): string | null {
    return this.authService.getOfficialSealUrl();
  }

  get digitalSignatureUrl(): string | null {
    return this.authService.getDigitalSignatureUrl();
  }

  get totalArrearsAmount(): number {
    return this.data?.receipt?.pendingArrears
      ? this.data.receipt.pendingArrears.reduce((sum, a) => sum + a.dueAmount, 0)
      : 0;
  }

  get totalDemandAmount(): number {
    if (this.data?.receipt?.totalDemandBeforePayment && this.data.receipt.totalDemandBeforePayment > 0) {
      return this.data.receipt.totalDemandBeforePayment;
    }
    return (this.data?.receipt?.amountPaid || 0) + (this.data?.receipt?.remainingDue || 0);
  }

  formatSubTitle(sub?: string | null): string {
    if (!sub || !sub.trim()) return '';
    const trimmed = sub.trim();
    // Suppress internal system tags containing GUIDs or IDs
    if (trimmed.startsWith('Coaching:') || trimmed.startsWith('School:')) {
      const tagPart = trimmed.substring(trimmed.indexOf(':') + 1).trim();
      if (/^[0-9a-fA-F-]{32,36}$/.test(tagPart) || tagPart.length >= 30) {
        return '';
      }
    }
    if (/^[0-9a-fA-F-]{32,36}$/.test(trimmed)) {
      return '';
    }
    if (trimmed.toLowerCase() === 'latefeefine') {
      return 'Late Payment Penalty';
    }
    return trimmed;
  }

  ngOnInit(): void {
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
        this.payeeMerchantName = this.data.instituteName || this.authService.currentUser()?.instituteName || 'Fee Collection';
        this.generateQrCode();
      }
    });
  }

  generateQrCode(): void {
    const rcpt = this.data?.receipt;
    if (!rcpt) return;

    if (rcpt.remainingDue > 0) {
      const amount = rcpt.remainingDue;
      const payee = this.payeeUpiId;
      const name = this.payeeMerchantName || this.data.instituteName || this.authService.currentUser()?.instituteName || 'Apex Coaching Academy';
      const student = rcpt.studentName;
      const roll = rcpt.rollNumber || '';
      const note = `Fee Bal ${student}${roll ? ' Roll ' + roll : ''} ${rcpt.receiptNumber}`;

      const upiUri = `upi://pay?pa=${encodeURIComponent(payee)}&pn=${encodeURIComponent(name)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note.substring(0, 50))}`;

      QRCode.toDataURL(upiUri, {
        width: 140,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      }).then(url => {
        this.qrDataUrl = url;
      }).catch(err => {
        console.error('Failed to generate QR Code for Receipt:', err);
      });
    } else {
      const verifyPayload = `IMSERP_FEE_VERIFIED|${rcpt.receiptNumber}|${rcpt.studentName}|Roll:${rcpt.rollNumber || 'NA'}|Paid:INR_${rcpt.amountPaid}|Date:${rcpt.paymentDate}|Status:CLEARED`;

      QRCode.toDataURL(verifyPayload, {
        width: 110,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      }).then(url => {
        this.qrDataUrl = url;
      }).catch(err => {
        console.error('Failed to generate verify QR Code:', err);
      });
    }
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
    if (!el) {
      window.print();
      return;
    }

    // Modern rock-solid printing via hidden iframe
    let printIframe = document.getElementById('receipt-print-frame') as HTMLIFrameElement;
    if (printIframe) {
      printIframe.remove();
    }

    printIframe = document.createElement('iframe');
    printIframe.id = 'receipt-print-frame';
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

    const title = `Fee Receipt - ${this.data?.receipt?.receiptNumber || 'Receipt'}`;

    doc.open();
    doc.write('<!DOCTYPE html><html><head><title>' + title + '</title><style>' +
      '@page { size: A4 portrait; margin: 4mm 6mm; }' +
      '* { box-sizing: border-box; margin: 0; padding: 0; }' +
      'body { font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #ffffff; font-size: 10.5px; line-height: 1.25; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
      'mat-icon { display: none !important; }' +
      '.receipt-paper { width: 100%; display: flex; flex-direction: column; padding: 0; margin: 0; }' +
      '.receipt-slip { position: relative; border: 1px solid #94a3b8; border-radius: 4px; padding: 5px 8px; background: #ffffff; box-sizing: border-box; page-break-inside: avoid !important; }' +
      '.receipt-watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 170px; height: 170px; opacity: 0.035; pointer-events: none; background-size: contain; background-position: center; background-repeat: no-repeat; z-index: 0; }' +
      '.tear-divider { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 4px 0; color: #475569; font-size: 8px; font-weight: 700; letter-spacing: 0.5px; page-break-inside: avoid !important; }' +
      '.tear-line { flex: 1; border-top: 1.5px dashed #64748b; height: 0; }' +
      '.tear-scissor { font-size: 13px; color: #334155; line-height: 1; }' +
      '.tear-scissor.flip { transform: scaleX(-1); }' +
      '.tear-badge { display: inline-flex; align-items: center; gap: 4px; background: #f1f5f9; border: 1px dashed #94a3b8; border-radius: 12px; padding: 1px 8px; white-space: nowrap; }' +
      '.tear-hindi { color: #64748b; }' +
      '.paper-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 3px; border-bottom: 1.5px solid #0f172a; }' +
      '.inst-info { display: flex; align-items: center; gap: 7px; }' +
      '.logo-mark { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }' +
      '.inst-logo-img { width: 100%; height: 100%; object-fit: contain; }' +
      '.inst-name { font-size: 0.92rem; font-weight: 800; color: #0f172a; line-height: 1.1; margin: 0; }' +
      '.inst-subtitle { font-size: 0.58rem; color: #475569; margin: 1px 0 0; }' +
      '.inst-branch { font-size: 0.58rem; color: #3b82f6; font-weight: 600; margin: 1px 0 0; }' +
      '.branch-pill { background: #eff6ff; color: #1e40af; padding: 0 4px; border-radius: 2px; border: 1px solid #bfdbfe; }' +
      '.branch-dept-sep { color: #94a3b8; }' +
      '.branch-dept { color: #64748b; }' +
      '.receipt-badge { text-align: right; }' +
      '.badge-title { font-size: 0.84rem; font-weight: 800; color: #1e40af; letter-spacing: 0.04em; display: block; line-height: 1.1; }' +
      '.badge-sub { font-size: 0.58rem; color: #64748b; display: block; }' +
      '.copy-tag { display: inline-block; margin-top: 1px; font-size: 0.58rem; font-weight: 800; background: #eff6ff; color: #1d4ed8; padding: 0 5px; border-radius: 2px; border: 1px solid #bfdbfe; }' +
      '.copy-tag.office-copy-tag { background: #f5f3ff; color: #6d28d9; border-color: #ddd6fe; }' +
      '.meta-strip { display: flex; flex-wrap: wrap; gap: 3px 8px; padding: 2.5px 5px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 3px; margin: 3px 0; }' +
      '.meta-item { display: inline-flex; align-items: center; gap: 2px; font-size: 0.65rem; }' +
      '.meta-label { color: #64748b; font-weight: 600; }' +
      '.meta-val { color: #0f172a; font-weight: 700; }' +
      '.meta-val.highlight { color: #1d4ed8; }' +
      '.month-pill { background: #e0f2fe; color: #0369a1; padding: 0 3px; border-radius: 2px; }' +
      '.session-pill { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 0 3px; border-radius: 2px; }' +
      '.mode-pill { background: #dcfce7; color: #15803d; padding: 0 3px; border-radius: 2px; }' +
      '.student-profile-card { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 10px; padding: 3px 5px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 3px; margin-bottom: 3px; }' +
      '.prof-row { display: flex; font-size: 0.65rem; line-height: 1.25; }' +
      '.prof-row .k { width: 110px; white-space: nowrap; color: #475569; font-weight: 600; flex-shrink: 0; }' +
      '.prof-row .v { color: #0f172a; flex: 1; }' +
      '.student-highlight { font-weight: 800; color: #15803d; }' +
      '.status-pill { background: #e0f2fe; color: #0369a1; padding: 0 3px; border-radius: 2px; font-size: 0.6rem; }' +
      '.table-section { margin-bottom: 2px; }' +
      '.receipt-table { width: 100%; border-collapse: collapse; }' +
      '.receipt-table th { background: #eff6ff !important; color: #1e3a8a !important; border-top: 1px solid #bfdbfe; border-bottom: 1.5px solid #bfdbfe; padding: 2px 4px; font-size: 0.65rem; font-weight: 700; text-align: left; }' +
      '.receipt-table td { padding: 2px 4px; border-bottom: 1px solid #e2e8f0; font-size: 0.67rem; line-height: 1.15; }' +
      '.fee-head-title { font-size: 0.68rem; color: #0f172a; font-weight: 700; }' +
      '.fee-head-sub { font-size: 0.58rem; color: #64748b; }' +
      '.summary-subtotal { background: #f8fafc; border-top: 1.5px solid #cbd5e1; }' +
      '.grand-paid { font-size: 0.8rem; font-weight: 800; color: #16a34a; }' +
      '.amount-words-strip { display: flex; justify-content: space-between; align-items: center; padding: 2px 5px; background: #eff6ff; border: 1px dashed #93c5fd; border-radius: 3px; margin-bottom: 2px; }' +
      '.words-left { display: flex; align-items: center; gap: 3px; font-size: 0.64rem; }' +
      '.w-label { color: #3b82f6; font-weight: 700; text-transform: uppercase; }' +
      '.w-text { color: #1e3a8a; font-weight: 700; }' +
      '.words-right { display: flex; align-items: center; gap: 3px; }' +
      '.paid-stamp { background: #16a34a; color: #fff; padding: 1px 4px; border-radius: 6px; font-weight: 800; font-size: 0.6rem; }' +
      '.cleared-tag { font-size: 0.62rem; font-weight: 700; color: #15803d; }' +
      '.balance-due-tag { font-size: 0.62rem; font-weight: 800; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; padding: 0 3px; border-radius: 2px; }' +
      '.compact-due-notice { display: flex; justify-content: space-between; align-items: center; padding: 1px 4px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 2px; font-size: 0.6rem; color: #92400e; margin-bottom: 2px; }' +
      '.signatures-row { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 6px; margin-bottom: 2px; }' +
      '.sig-col { width: 130px; }' +
      '.sig-line { height: 1px; background: #475569; margin-bottom: 2px; }' +
      '.sig-text { font-size: 0.62rem; font-weight: 700; color: #334155; display: block; line-height: 1.1; }' +
      '.auth-sub { font-size: 0.55rem; color: #64748b; display: block; }' +
      '.uploaded-official-seal-img { max-width: 32px; max-height: 32px; object-fit: contain; display: block; margin: 0 auto; }' +
      '.digital-seal { border: 1px dashed #0284c7; border-radius: 2px; padding: 1px 3px; background: #f0f9ff; color: #0284c7; font-size: 0.55rem; font-weight: 800; text-align: center; }' +
      '.digital-sign-wrapper { display: flex; align-items: flex-end; justify-content: flex-end; height: 16px; margin-bottom: 1px; }' +
      '.digital-sign-img { max-height: 16px; max-width: 70px; object-fit: contain; mix-blend-mode: multiply; }' +
      '.arrears-compact-section { background: #fef2f2 !important; border: 1px solid #fecaca; border-radius: 3px; padding: 2px 5px; margin-bottom: 3px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
      '.arrears-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }' +
      '.arrears-title { font-size: 0.62rem; font-weight: 700; color: #b91c1c; }' +
      '.arrears-total { font-size: 0.68rem; font-weight: 800; color: #dc2626; }' +
      '.arrears-items-row { display: flex; flex-wrap: wrap; gap: 2px 4px; }' +
      '.arrears-chip { display: inline-flex; align-items: center; gap: 3px; background: #fff; border: 1px solid #fecaca; border-radius: 2px; padding: 0 4px; font-size: 0.58rem; line-height: 1.4; }' +
      '.arr-name { color: #92400e; font-weight: 600; }' +
      '.arr-amt { color: #dc2626; font-weight: 800; }' +
      '.sig-col-qr { width: 52px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }' +
      '.receipt-mini-qr { width: 48px; height: 48px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 2px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
      '.qr-label { font-size: 0.5rem; font-weight: 700; color: #475569; margin-top: 1px; white-space: nowrap; }' +
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
    const classOrBatch = this.data.receipt.className
      ? `${this.data.receipt.className}${this.data.receipt.sectionName ? ' (' + this.data.receipt.sectionName + ')' : ''}`
      : (this.data.receipt.batchName || 'General');
    const instName = this.data.receipt.instituteName || this.data.instituteName || this.authService.currentUser()?.instituteName || 'School & Coaching ERP';
    let origin = window.location.origin;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      const port = window.location.port ? `:${window.location.port}` : '';
      origin = `${window.location.protocol}//localhost.nip.io${port}`;
    }
    const receiptPublicUrl = `${origin}/receipt/${this.data.receipt.receiptNumber}`;

    const textMsg = `*OFFICIAL FEE PAYMENT RECEIPT*\n` +
      `*Institute*: ${instName}\n` +
      branchLine +
      `*Receipt No*: #${this.data.receipt.receiptNumber}\n` +
      `*Date*: ${this.formatToIST(this.data.receipt.paymentDate)}\n\n` +
      `Dear Parent, we have received payment of *₹${this.data.receipt.amountPaid}* for student *${this.data.receipt.studentName}* (${classOrBatch}).\n` +
      `*Mode*: ${this.getPaymentModeName(this.data.receipt.mode)}\n` +
      headsSection +
      `*Remaining Balance Due*: ₹${this.data.receipt.remainingDue}\n\n` +
      `📄 *Download / View Official PDF Receipt*:\n${receiptPublicUrl}\n\n` +
      `Thank you for trusting ${instName}!`;
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
