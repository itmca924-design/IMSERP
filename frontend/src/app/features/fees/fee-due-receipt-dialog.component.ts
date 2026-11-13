import { Component, Inject, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FeesService, FeeDueSlip, FeeDueSlipItem, FeeInvoicePagedItem, UpiPaymentSettings } from '../../core/services/fees.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { FeeCollectionDialogComponent } from './fee-collection-dialog.component';
import { shareElementOnWhatsApp, openWhatsAppTextOnly } from '../../shared/utils/whatsapp-image-share';
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
        <div class="btn-group" [class.is-busy]="isSharingWhatsApp">
          <button
            class="header-action-btn collect-btn"
            [class.btn-disabled]="isSharingWhatsApp"
            [disabled]="isSharingWhatsApp"
            (click)="collectNow()"
            matTooltip="Collect Fee Directly"
            matButton="filled">
            <mat-icon>payments</mat-icon>
            <span>Collect Fee</span>
          </button>
          <button
            class="header-action-btn wa-btn"
            [class.loading-state]="isSharingWhatsApp"
            [disabled]="isSharingWhatsApp"
            (click)="shareWhatsApp()"
            matTooltip="Send WhatsApp Due Notice"
            matButton="filled">
            @if (isSharingWhatsApp) {
              <ng-container>
                <mat-icon class="wa-spin">sync</mat-icon>
                <span>Opening WhatsApp...</span>
              </ng-container>
            } @else {
              <ng-container>
                <mat-icon class="wa-mat-icon">
                  <svg class="wa-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                </mat-icon>
                <span>WhatsApp</span>
              </ng-container>
            }
          </button>
          <button
            class="header-action-btn print-btn"
            [class.btn-disabled]="isSharingWhatsApp"
            [disabled]="isSharingWhatsApp"
            (click)="printDueSlip()"
            matTooltip="Print or Download PDF"
            matButton="filled">
            <mat-icon>print</mat-icon>
            <span>Print Slip</span>
          </button>
          <button
            class="header-close-btn"
            [disabled]="isSharingWhatsApp"
            (click)="dialogRef.close()"
            matTooltip="Close"
            mat-icon-button>
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

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
                    <span class="badge-title">FEE DUE SLIP</span>
                    <span class="badge-sub">शुल्क बकाया पर्ची / मांग पत्र</span>
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
                  <span class="meta-label">Notice Issue Date:</span>
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

              <!-- Student Profile Card -->
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
                    <span class="k">Batch / Class:</span>
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
                  @if (dueSlip.hostelInfo) {
                    <div class="prof-row">
                      <span class="k">🏠 Hostel:</span>
                      <span class="v hostel-info-pill">{{ dueSlip.hostelInfo }}</span>
                    </div>
                  }
                </div>
              </div>

              <!-- Dues Breakdown Table -->
              <div class="table-section">
                <table class="due-table">
                  <thead>
                    <tr>
                      <th class="text-center" style="width: 25px;">#</th>
                      <th>Billing Period / Fee Head</th>
                      <th>Due Date</th>
                      <th class="text-right">Total Fee (₹)</th>
                      <th class="text-right">Paid (₹)</th>
                      <th class="text-right">Outstanding Due (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of dueSlip.dueItems; track item; let i = $index) {
                      <tr>
                        <td class="text-center">{{ i + 1 }}</td>
                        <td>
                          <div class="due-item-title">{{ item.title }}</div>
                          @if (item.breakdown && item.breakdown.length > 0) {
                            <div class="due-item-heads">
                              @for (h of item.breakdown; track h) {
                                <span class="due-head-chip">
                                  {{ h.headName }}: ₹{{ h.amount | number:'1.0-0' }}
                                </span>
                              }
                            </div>
                          }
                          @if ((item.advanceAdjustedAmount || 0) > 0) {
                            <div class="due-adv-adjusted-pill">
                              ✓ Advance Paid (FIFO Adjusted): <strong>₹{{ item.advanceAdjustedAmount | number:'1.2-2' }}</strong>
                              @if (item.advanceAdjustedFromReceipt) {
                                <span>(Ref: #{{ item.advanceAdjustedFromReceipt }})</span>
                              }
                            </div>
                          }
                        </td>
                        <td>{{ item.dueDate | date:'dd-MMM-yyyy' }}</td>
                        <td class="text-right">₹{{ item.totalAmount | number:'1.2-2' }}</td>
                        <td class="text-right amount-paid">₹{{ item.paidAmount | number:'1.2-2' }}</td>
                        <td class="text-right amount-due"><strong>₹{{ item.dueAmount | number:'1.2-2' }}</strong></td>
                      </tr>
                    }
                    <tr class="summary-subtotal">
                      <td colspan="5" class="text-right"><strong>NET OUTSTANDING AMOUNT DUE:</strong></td>
                      <td class="text-right grand-due">₹{{ dueSlip.totalOutstandingDue | number:'1.2-2' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Amount In Words Strip -->
              <div class="amount-words-strip">
                <div class="words-left">
                  <span class="w-label">Total Payable in Words:</span>
                  <span class="w-text">{{ getAmountInWords(dueSlip.totalOutstandingDue) }}</span>
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

      @keyframes waSpinAnim {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .btn-group {
        display: flex;
        align-items: center;
        gap: 8px;

        &.is-busy {
          .header-action-btn.btn-disabled, .header-close-btn {
            pointer-events: none !important;
            cursor: not-allowed !important;
          }
        }

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

          .wa-spin {
            animation: waSpinAnim 0.75s linear infinite !important;
            display: inline-block !important;
          }

          &.collect-btn {
            background: #0284c7 !important;
            color: #ffffff !important;
            &:hover:not(:disabled) { background: #0369a1 !important; transform: translateY(-1px); }
          }

          &.wa-btn {
            background: #16a34a !important;
            color: #ffffff !important;
            .wa-mat-icon {
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
              width: 16px !important;
              height: 16px !important;
              margin-right: 6px !important;
              vertical-align: middle !important;
            }
            .wa-icon {
              width: 15px;
              height: 15px;
              display: block;
              fill: currentColor;
            }
            &:hover:not(:disabled) { background: #15803d !important; transform: translateY(-1px); }
            &.loading-state {
              background: #15803d !important;
              color: #ffffff !important;
              cursor: wait !important;
              pointer-events: none !important;
              opacity: 0.95 !important;
            }
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
          min-width: 110px;
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

        .due-item-heads {
          display: flex;
          flex-wrap: wrap;
          gap: 2px;
          margin-top: 1px;
        }

        .due-head-chip {
          font-size: 0.58rem;
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fecaca;
          padding: 0 3px;
          border-radius: 2px;
          font-weight: 600;
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

  get officialSealUrl(): string | null {
    return this.authService.getOfficialSealUrl();
  }

  get digitalSignatureUrl(): string | null {
    return this.authService.getDigitalSignatureUrl();
  }

  isSharingWhatsApp = false;

  constructor(
    public dialogRef: MatDialogRef<FeeDueReceiptDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FeeDueReceiptDialogData,
    private feesService: FeesService,
    private dialog: MatDialog,
    public authService: AuthService,
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

    this.feesService.getStudentDueSlip(this.data.studentId, this.data.invoiceId).subscribe({
      next: (slip) => {
        this.dueSlip = slip;
        this.loading = false;
        this.generateQrCode();
        if (this.data?.autoShareWhatsApp) {
          setTimeout(() => this.shareWhatsApp(), 350);
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
          setTimeout(() => this.shareWhatsApp(), 350);
        }
      }
    });
  }

  generateQrCode(): void {
    if (!this.dueSlip || this.dueSlip.totalOutstandingDue <= 0) {
      this.qrDataUrl = null;
      return;
    }

    const amount = this.dueSlip.totalOutstandingDue;
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
      '.due-item-heads { display: flex; flex-wrap: wrap; gap: 2px; margin-top: 1px; }' +
      '.due-head-chip { font-size: 0.55rem; background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; padding: 0 3px; border-radius: 2px; font-weight: 600; }' +
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

  shareWhatsApp(): void {
    if (this.isSharingWhatsApp) return;
    this.isSharingWhatsApp = true;
    this.cdr.detectChanges();

    const phone = this.dueSlip?.parentPhone || this.data.parentWhatsAppPhone;
    if (!this.dueSlip) {
      this.isSharingWhatsApp = false;
      this.cdr.detectChanges();
      return;
    }

    const invDetails = this.dueSlip.dueItems.map(d => `• ${d.title}: Due *₹${d.dueAmount}* (Due Date: ${new Date(d.dueDate).toLocaleDateString('en-IN')})`).join('\n');

    const branchLine = this.effectiveBranchName ? `*Branch*: ${this.effectiveBranchName}\n` : '';
    const instName = this.data.instituteName || this.authService.currentUser()?.instituteName || 'Fee Clearance Desk';

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

    // 1. Immediately launch WhatsApp
    openWhatsAppTextOnly(phone, textMsg);

    // 2. In parallel, background copy slip to clipboard if available
    const el = document.getElementById('student-due-slip-copy');
    if (el && navigator.clipboard && (window as any).ClipboardItem) {
      shareElementOnWhatsApp({
        element: el,
        fileName: `Fee_Due_Slip_${this.dueSlip.studentName.replace(/\s+/g, '_')}_${this.noticeNumber}.png`,
        phone: phone,
        messageText: textMsg,
        shareTitle: `Fee Due Demand Note - ${this.dueSlip.studentName}`
      }).catch(err => console.warn('Background copy error:', err));
    }

    // 3. Keep loading active and other buttons disabled for 2.8s so feedback is unmistakable
    setTimeout(() => {
      this.isSharingWhatsApp = false;
      this.cdr.detectChanges();
    }, 2800);
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
