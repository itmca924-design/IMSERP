import { Component, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import * as QRCode from '../../shared/utils/qr-code';
import { FeesService, UpiIntentResponse, PublicInvoiceDueSlip } from '../../core/services/fees.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-public-invoice-pay',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="pay-portal-page">
      @if (!loading && upiIntent) {
        <div class="pay-card">
          <!-- Smart Dynamic Brand Header -->
          <div class="card-header">
            <div class="brand-crest" [class.has-img]="!!resolvedLogoUrl">
              @if (resolvedLogoUrl) {
                <img
                  [src]="resolvedLogoUrl"
                  [alt]="upiIntent.instituteName || 'Institute Logo'"
                  class="brand-logo-img"
                  (error)="resolvedLogoUrl = null"
                  />
              }
              @if (!resolvedLogoUrl) {
                <mat-icon>account_balance</mat-icon>
              }
            </div>
            <div class="brand-text-block">
              <h2 class="institute-name">{{ upiIntent.instituteName || upiIntent.payeeName || 'Campus Fee Desk' }}</h2>
              <div class="header-meta-row">
                <span class="verified-badge">
                  <mat-icon class="badge-icon">verified</mat-icon>
                  <span>Verified Payment Desk</span>
                </span>
                @if (upiIntent.branchName) {
                  <span class="branch-pill">{{ upiIntent.branchName }}</span>
                }
              </div>
            </div>
          </div>
          <!-- Student & Invoice Details -->
          <div class="details-section">
            <div class="detail-row">
              <span class="label">Student Name:</span>
              <span class="value font-bold">{{ upiIntent.studentName }}</span>
            </div>
            @if (upiIntent.className) {
              <div class="detail-row">
                <span class="label">Academic Class:</span>
                <span class="value">{{ upiIntent.className }}</span>
              </div>
            }
            @if (upiIntent.invoiceNumber) {
              <div class="detail-row">
                <span class="label">Invoice Reference:</span>
                <span class="value">#{{ upiIntent.invoiceNumber }}</span>
              </div>
            }
          </div>

          <!-- 1-Click Slip / Receipt Download Button for Parents -->
          <div class="slip-download-action-row no-print">
            <button
              type="button"
              class="download-slip-btn"
              (click)="printOrDownloadSlip()">
              <mat-icon>download_for_offline</mat-icon>
              <span>{{ upiIntent.dueAmount <= 0 ? 'Download Official Fee Receipt (रसीद PDF)' : 'Download Fee Due Slip (मांग पत्र / पर्ची PDF)' }}</span>
            </button>
          </div>

          <!-- Status: Already Settled vs Active Due -->
          @if (upiIntent.dueAmount <= 0) {
            <div class="settled-notice">
              <mat-icon class="settled-icon">check_circle</mat-icon>
              <h3>Fee Already Settled!</h3>
              <p>This invoice has been fully cleared and verified. No outstanding balance remains.</p>
            </div>
          }
          @if (upiIntent.dueAmount > 0) {
            <div class="payment-action-block">
              <!-- Payable Amount Display -->
              <div class="amount-deck">
                <span class="amount-label">Total Payable Amount</span>
                <span class="amount-val">₹{{ upiIntent.dueAmount | number:'1.0-0' }}</span>
              </div>
              <!-- Dynamic Bharat QR Code -->
              <div class="qr-container">
                <div class="qr-frame" [class.highlight-pulse]="qrHighlighted">
                  @if (qrDataUrl) {
                    <img [src]="qrDataUrl" alt="Bharat Dynamic UPI QR" class="qr-img" />
                  }
                  @if (!qrDataUrl) {
                    <div class="qr-loading">
                      <mat-spinner diameter="32"></mat-spinner>
                    </div>
                  }
                </div>
                <span class="qr-caption">Scan with any UPI App (GPay, PhonePe, Paytm, BHIM)</span>
              </div>
              <!-- Desktop Helper Notice -->
              @if (copiedNotice) {
                <div class="notice-toast">
                  <mat-icon>info</mat-icon>
                  <span>{{ copiedNotice }}</span>
                </div>
              }
              <!-- 1-Tap Mobile Payment Buttons -->
              <div class="mobile-apps-group">
                <span class="apps-label">Or Tap to Pay Instantly:</span>
                <div class="apps-buttons-grid">
                  <a
                    [href]="upiIntent.gpayUri || upiIntent.upiIntentUri"
                    (click)="onAppClick('Google Pay', upiIntent.gpayUri || upiIntent.upiIntentUri, $event)"
                    class="app-btn gpay"
                    target="_self"
                    matButton="filled"
                    >
                    <span class="app-name">Google Pay</span>
                  </a>
                  <a
                    [href]="upiIntent.phonepeUri || upiIntent.upiIntentUri"
                    (click)="onAppClick('PhonePe', upiIntent.phonepeUri || upiIntent.upiIntentUri, $event)"
                    class="app-btn phonepe"
                    target="_self"
                    matButton="filled"
                    >
                    <span class="app-name">PhonePe</span>
                  </a>
                  <a
                    [href]="upiIntent.paytmUri || upiIntent.upiIntentUri"
                    (click)="onAppClick('Paytm', upiIntent.paytmUri || upiIntent.upiIntentUri, $event)"
                    class="app-btn paytm"
                    target="_self"
                    matButton="filled"
                    >
                    <span class="app-name">Paytm</span>
                  </a>
                  <a
                    [href]="upiIntent.upiIntentUri"
                    (click)="onAppClick('Any UPI App', upiIntent.upiIntentUri, $event)"
                    class="app-btn any-upi"
                    target="_self"
                    matButton="filled"
                    >
                    <span class="app-name">Any UPI App</span>
                  </a>
                </div>
              </div>
              <!-- Payee UPI Details with 1-Click Copy -->
              <div class="vpa-box" (click)="copyVpa()" matTooltip="Click to Copy Payee UPI ID">
                <span class="vpa-label">Payee UPI ID:</span>
                <code class="vpa-id">{{ upiIntent.payeeUpiId }}</code>
                <mat-icon class="copy-icon">content_copy</mat-icon>
              </div>
            </div>
          }
          <!-- Footer -->
          <div class="card-footer">
            <mat-icon class="secure-icon">verified_user</mat-icon>
            <span>Secured via NPCI Unified Payments Interface (UPI)</span>
          </div>
        </div>
      } @else {
        @if (loading) {
          <div class="state-card">
            <mat-spinner diameter="40"></mat-spinner>
            <p>Connecting to secure fee portal...</p>
          </div>
        }
        @if (!loading && errorMsg) {
          <div class="state-card error-card">
            <mat-icon class="err-icon">error_outline</mat-icon>
            <h3>Payment Link Error</h3>
            <p>{{ errorMsg }}</p>
          </div>
        }
      }

      <!-- Authentic Printable Fee Due Slip / Demand Note Container (Hidden on Screen, Printed on Demand) -->
      @if (dueSlip) {
        <div class="due-paper printable-slip-container" id="public-due-paper">
          @for (copy of slipCopies; track copy.title; let isLast = $last) {
            <div class="due-slip" [class.office-slip]="copy.isOffice">
              <!-- Watermark -->
              @if (resolvedLogoUrl) {
                <div class="due-watermark" [style.backgroundImage]="'url(' + resolvedLogoUrl + ')'"></div>
              }

              <!-- Header -->
              <div class="paper-header">
                <div class="inst-info">
                  <div class="logo-mark transparent-logo-mark" [class.has-img]="!!resolvedLogoUrl">
                    @if (resolvedLogoUrl) {
                      <img [src]="resolvedLogoUrl" alt="Logo" class="inst-logo-img">
                    }
                    @if (!resolvedLogoUrl) {
                      <mat-icon class="fallback-inst-icon">account_balance</mat-icon>
                    }
                  </div>
                  <div class="inst-text">
                    <h2 class="inst-name">{{ dueSlip.instituteName }}</h2>
                    <p class="inst-subtitle">Accounts &amp; Financial Clearance Department | Student Fee Demand Note</p>
                    @if (dueSlip.branchName) {
                      <p class="inst-branch">
                        <span class="branch-pill">🏛️ Branch: {{ dueSlip.branchName }}</span>
                        <span class="branch-dept-sep">|</span>
                        <span class="branch-dept">Official Accounts Notice</span>
                      </p>
                    }
                  </div>
                </div>
                <div class="due-badge-block">
                  <div class="badge-title-wrap">
                    <span class="badge-title">{{ dueSlip.dueAmount <= 0 ? 'FEE PAYMENT RECEIPT' : 'FEE DUE SLIP' }}</span>
                    <span class="badge-sub">{{ dueSlip.dueAmount <= 0 ? 'शुल्क भुगतान रसीद' : 'शुल्क बकाया पर्ची / मांग पत्र' }}</span>
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
                  <span class="meta-val highlight">{{ dueSlip.noticeNumber }}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Notice Issue Date:</span>
                  <span class="meta-val">{{ dueSlip.noticeDate | date:'dd-MMM-yyyy' }}</span>
                </div>
                @if (dueSlip.branchName) {
                  <div class="meta-item branch-meta-item">
                    <span class="meta-label">Branch / Centre:</span>
                    <span class="meta-val branch-val">{{ dueSlip.branchName }}</span>
                  </div>
                }
                <div class="meta-item invoice-meta-item">
                  <span class="meta-label">Invoice No:</span>
                  <span class="meta-val highlight">{{ dueSlip.totalUnpaidInvoices && dueSlip.totalUnpaidInvoices > 1 ? dueSlip.invoiceNumber : ('#' + dueSlip.invoiceNumber) }}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Total Invoices:</span>
                  <span class="meta-val">{{ dueSlip.totalUnpaidInvoices || 1 }} {{ dueSlip.dueAmount <= 0 ? 'Paid' : 'Unpaid' }}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Account Status:</span>
                  <span class="meta-val" [class.status-badge-due]="dueSlip.dueAmount > 0" [class.status-badge-settled]="dueSlip.dueAmount <= 0">
                    {{ dueSlip.dueAmount <= 0 ? 'SETTLED & CLEARED' : 'PAYMENT OVERDUE' }}
                  </span>
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
                    <span class="v">{{ dueSlip.batchName || dueSlip.className || 'General Batch' }}</span>
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
                    @if (dueSlip.items && dueSlip.items.length > 0) {
                      @for (item of dueSlip.items; track item.id; let i = $index) {
                        <tr>
                          <td class="text-center">{{ i + 1 }}</td>
                          <td>
                            <div class="due-item-title">{{ item.headName }}</div>
                            @if (item.description) {
                              <div class="due-item-desc">{{ item.description }}</div>
                            }
                          </td>
                          <td>{{ dueSlip.dueDate | date:'dd-MMM-yyyy' }}</td>
                          <td class="text-right">₹{{ item.amount | number:'1.2-2' }}</td>
                          <td class="text-right amount-paid">₹{{ item.paidAmount | number:'1.2-2' }}</td>
                          <td class="text-right amount-due"><strong>₹{{ (item.amount - item.paidAmount) | number:'1.2-2' }}</strong></td>
                        </tr>
                      }
                    } @else {
                      <tr>
                        <td class="text-center">1</td>
                        <td>
                          <div class="due-item-title">{{ dueSlip.title || ('Fee Invoice #' + dueSlip.invoiceNumber) }}</div>
                        </td>
                        <td>{{ dueSlip.dueDate | date:'dd-MMM-yyyy' }}</td>
                        <td class="text-right">₹{{ dueSlip.totalAmount | number:'1.2-2' }}</td>
                        <td class="text-right amount-paid">₹{{ dueSlip.paidAmount | number:'1.2-2' }}</td>
                        <td class="text-right amount-due"><strong>₹{{ dueSlip.dueAmount | number:'1.2-2' }}</strong></td>
                      </tr>
                    }
                    <tr class="summary-subtotal">
                      <td colspan="5" class="text-right"><strong>NET OUTSTANDING AMOUNT DUE:</strong></td>
                      <td class="text-right grand-due">₹{{ dueSlip.dueAmount | number:'1.2-2' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Amount In Words Strip -->
              <div class="amount-words-strip">
                <div class="words-left">
                  <span class="w-label">Total Payable in Words:</span>
                  <span class="w-text">{{ getAmountInWords(dueSlip.dueAmount) }}</span>
                </div>
                <div class="words-right">
                  <div class="due-stamp" [class.paid-stamp]="dueSlip.dueAmount <= 0">
                    <mat-icon>{{ dueSlip.dueAmount <= 0 ? 'check_circle' : 'warning' }}</mat-icon>
                    <span>{{ dueSlip.dueAmount <= 0 ? 'FEE SETTLED' : 'DUES PENDING' }}</span>
                  </div>
                  @if (dueSlip.payeeUpiId) {
                    <span class="upi-payee-pill">UPI Payee: <strong>{{ dueSlip.payeeUpiId }}</strong></span>
                  }
                </div>
              </div>

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
                      <small>{{ dueSlip.noticeDate | date:'dd-MMM-yyyy' }}</small>
                    </div>
                  }
                </div>
                @if (slipQrDataUrl) {
                  <div class="sig-col-qr text-center">
                    <img [src]="slipQrDataUrl" alt="Scan to Pay via UPI" class="receipt-mini-qr" />
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
                  <small class="auth-sub">{{ dueSlip.cashierName || dueSlip.instituteName }}</small>
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
    .pay-portal-page {
      height: 100vh;
      max-height: 100vh;
      overflow: hidden;
      background: linear-gradient(135deg, #eff6ff 0%, #e0f2fe 50%, #f0fdf4 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
      box-sizing: border-box;
      font-family: inherit;

      @media (max-height: 560px) {
        height: auto;
        min-height: 100vh;
        overflow-y: auto;
      }
    }

    .pay-card {
      width: 100%;
      max-width: 390px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 28px -4px rgba(15, 23, 42, 0.12), 0 4px 10px -2px rgba(15, 23, 42, 0.05);
      overflow: hidden;
      border: 1px solid #bfdbfe;
    }

    .card-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      padding: 12px 16px 10px;
      text-align: center;
      border-bottom: 1px solid #bfdbfe;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;

      .brand-crest {
        width: 48px;
        height: 48px;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        &.has-img {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }

        .brand-logo-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          border-radius: 50%;
          mix-blend-mode: multiply;
          background: transparent !important;
        }

        mat-icon { font-size: 28px; width: 28px; height: 28px; color: #2563eb; }
      }

      .brand-text-block {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
      }

      .institute-name {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
        color: #1e3a8a;
        line-height: 1.2;
      }

      .header-meta-row {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: center;
      }

      .verified-badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 0.66rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        background: #dbeafe;
        color: #1d4ed8;
        padding: 1px 7px;
        border-radius: 10px;

        .badge-icon {
          font-size: 12px;
          width: 12px;
          height: 12px;
          color: #16a34a;
        }
      }

      .branch-pill {
        font-size: 0.66rem;
        font-weight: 600;
        color: #64748b;
      }
    }

    .details-section {
      padding: 8px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #f1f5f9;

      .detail-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 2px 0;
        font-size: 0.8rem;

        .label { color: #64748b; }
        .value { color: #0f172a; font-weight: 600; }
        .font-bold { font-weight: 700; color: #1e293b; }
      }
    }

    .settled-notice {
      padding: 28px 16px;
      text-align: center;
      color: #15803d;

      .settled-icon {
        font-size: 44px;
        width: 44px;
        height: 44px;
        color: #16a34a;
        margin-bottom: 8px;
      }

      h3 { margin: 0 0 6px; font-size: 1.15rem; font-weight: 700; color: #166534; }
      p { margin: 0; font-size: 0.82rem; color: #15803d; }
    }

    .payment-action-block {
      padding: 10px 16px 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .amount-deck {
      text-align: center;
      width: 100%;
      padding: 6px 10px;
      background: #f0fdf4;
      border-radius: 10px;
      border: 1px solid #bbf7d0;

      .amount-label {
        display: block;
        font-size: 0.68rem;
        font-weight: 600;
        color: #166534;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }

      .amount-val {
        display: block;
        font-size: 1.45rem;
        font-weight: 800;
        color: #15803d;
        line-height: 1.2;
      }
    }

    .qr-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;

      .qr-frame {
        width: 125px;
        height: 125px;
        padding: 4px;
        background: #ffffff;
        border: 2px solid #e2e8f0;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        transition: all 0.25s ease;

        &.highlight-pulse {
          border-color: #16a34a;
          box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.25);
          transform: scale(1.04);
        }

        .qr-img { width: 100%; height: 100%; object-fit: contain; }
      }

      .qr-caption {
        font-size: 0.69rem;
        color: #64748b;
        text-align: center;
      }
    }

    .notice-toast {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 0.74rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      text-align: center;
      line-height: 1.3;

      mat-icon { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; }
    }

    .mobile-apps-group {
      width: 100%;

      .apps-label {
        display: block;
        font-size: 0.73rem;
        font-weight: 600;
        color: #475569;
        margin-bottom: 5px;
        text-align: center;
      }

      .apps-buttons-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 6px;

        .app-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 7px;
          border-radius: 8px;
          text-decoration: none;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;

          &:hover { box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
          &:active { transform: scale(0.97); }

          &.gpay { background: #1a73e8; color: #ffffff; }
          &.phonepe { background: #5f259f; color: #ffffff; }
          &.paytm { background: #002970; color: #ffffff; }
          &.any-upi { background: #16a34a; color: #ffffff; }
        }
      }
    }

    .vpa-box {
      font-size: 0.73rem;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      padding: 2px 8px;
      border-radius: 6px;
      transition: background 0.15s ease;

      &:hover { background: #f1f5f9; }

      .vpa-id {
        background: #f1f5f9;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 600;
        color: #0f172a;
      }

      .copy-icon { font-size: 14px; width: 14px; height: 14px; color: #94a3b8; }
    }

    .card-footer {
      padding: 6px 12px;
      background: #f8fafc;
      border-top: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      font-size: 0.7rem;
      color: #64748b;

      .secure-icon { font-size: 15px; width: 15px; height: 15px; color: #16a34a; }
    }

    .state-card {
      width: 100%;
      max-width: 340px;
      padding: 32px 16px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.08);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 10px;
      color: #64748b;

      &.error-card {
        color: #b91c1c;
        .err-icon { font-size: 40px; width: 40px; height: 40px; }
      }
    }

    .slip-download-action-row {
      margin: 4px 0 10px;
      display: flex;
      justify-content: center;

      .download-slip-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        color: #ffffff;
        font-weight: 700;
        font-size: 0.84rem;
        padding: 9px 16px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        box-shadow: 0 2px 6px -1px rgba(37, 99, 235, 0.35);
        transition: all 0.2s ease;

        &:hover {
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 10px -2px rgba(37, 99, 235, 0.45);
        }

        mat-icon {
          font-size: 19px;
          width: 19px;
          height: 19px;
        }
      }
    }

    /* Screen-hidden printable slip container */
    .printable-slip-container {
      display: none;
    }

    @media print {
      .no-print {
        display: none !important;
      }
      .pay-portal-page {
        height: auto !important;
        max-height: none !important;
        background: #ffffff !important;
        padding: 0 !important;
      }
      .pay-card {
        display: none !important;
      }
      .printable-slip-container {
        display: block !important;
        width: 100% !important;
      }
    }
  `]
})
export class PublicInvoicePayComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private feesService = inject(FeesService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  loading = true;
  errorMsg = '';
  upiIntent: UpiIntentResponse | null = null;
  dueSlip: PublicInvoiceDueSlip | null = null;
  qrDataUrl = '';
  slipQrDataUrl = '';
  resolvedLogoUrl: string | null = null;
  officialSealUrl: string | null = null;
  digitalSignatureUrl: string | null = null;
  copiedNotice = '';
  qrHighlighted = false;

  slipCopies = [
    { title: 'STUDENT COPY', hindiTitle: 'छात्र प्रति', isOffice: false }
  ];

  ngOnInit(): void {
    const invoiceId = this.route.snapshot.paramMap.get('invoiceId');
    if (!invoiceId) {
      this.loading = false;
      this.errorMsg = 'No invoice reference was specified.';
      return;
    }

    // 1. Fetch public UPI intent for online pay
    this.feesService.getInvoiceUpiIntent(invoiceId).subscribe({
      next: (intent) => {
        this.upiIntent = intent;
        this.loading = false;

        if (intent.instituteLogo) {
          this.resolvedLogoUrl = this.authService.resolveLogoUrl(intent.instituteLogo);
        }
        if (!this.resolvedLogoUrl) {
          this.resolvedLogoUrl = this.authService.getInstituteLogoUrl();
        }

        if (intent.upiIntentUri) {
          QRCode.toDataURL(intent.upiIntentUri, {
            margin: 4,
            width: 320,
            color: { dark: '#000000', light: '#ffffff' },
            errorCorrectionLevel: 'M'
          })
            .then((url) => (this.qrDataUrl = url))
            .catch((err) => console.error('QR generation error', err));
        }

        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.message || 'Invoice not found or expired.';
        this.cdr.markForCheck();
      }
    });

    // 2. Fetch full public due slip data for authentic slip / receipt printing
    this.feesService.getInvoicePublicDueSlip(invoiceId).subscribe({
      next: (slip) => {
        this.dueSlip = slip;

        if (slip.instituteLogo) {
          this.resolvedLogoUrl = this.authService.resolveLogoUrl(slip.instituteLogo);
        }
        if (slip.officialSealUrl) {
          this.officialSealUrl = this.authService.resolveLogoUrl(slip.officialSealUrl);
        }
        if (slip.digitalSignatureUrl) {
          this.digitalSignatureUrl = this.authService.resolveLogoUrl(slip.digitalSignatureUrl);
        }

        if (slip.upiIntentUri) {
          QRCode.toDataURL(slip.upiIntentUri, {
            margin: 2,
            width: 280,
            color: { dark: '#000000', light: '#ffffff' },
            errorCorrectionLevel: 'M'
          })
            .then((url) => (this.slipQrDataUrl = url))
            .catch((err) => console.error('Mini QR generation error', err));
        }

        this.cdr.markForCheck();
      },
      error: (err) => {
        console.warn('Could not load detailed public due slip, falling back to upi intent data:', err);
      }
    });
  }

  isMobile(): boolean {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  onAppClick(appName: string, appUri?: string, event?: Event): void {
    if (this.isMobile()) {
      if (appUri) {
        window.location.href = appUri;
      }
      return;
    }

    if (event) {
      event.preventDefault();
    }

    if (this.upiIntent?.payeeUpiId) {
      try {
        navigator.clipboard?.writeText(this.upiIntent.payeeUpiId);
      } catch {
        // clipboard fallback
      }
    }

    this.qrHighlighted = true;
    this.copiedNotice = `📱 Open ${appName} on your mobile to scan this QR! (UPI ID copied)`;

    setTimeout(() => {
      this.qrHighlighted = false;
    }, 2500);

    setTimeout(() => {
      this.copiedNotice = '';
    }, 4500);
  }

  copyVpa(): void {
    if (this.upiIntent?.payeeUpiId) {
      try {
        navigator.clipboard?.writeText(this.upiIntent.payeeUpiId);
        this.copiedNotice = `UPI ID copied: ${this.upiIntent.payeeUpiId}`;
        setTimeout(() => (this.copiedNotice = ''), 3000);
      } catch {
        // noop
      }
    }
  }

  getAmountInWords(amount: number): string {
    return convertToIndianWords(Math.round(amount)) + ' Rupees Only';
  }

  printOrDownloadSlip(): void {
    // If due slip element is already rendered in the DOM, use the dedicated iframe print
    const el = document.getElementById('public-due-paper');
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

    const isDue = (this.dueSlip?.dueAmount ?? this.upiIntent?.dueAmount ?? 0) > 0;
    const refNo = this.dueSlip?.noticeNumber || `INV-${this.upiIntent?.invoiceNumber || 'REF'}`;
    const title = isDue ? `Fee Due Slip - ${refNo}` : `Fee Receipt - #${this.upiIntent?.invoiceNumber || 'PAID'}`;

    doc.open();
    doc.write('<!DOCTYPE html><html><head><title>' + title + '</title><style>' +
      '@page { size: A4 portrait; margin: 8mm 10mm; }' +
      '* { box-sizing: border-box; margin: 0; padding: 0; }' +
      'body { font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #ffffff; font-size: 11px; line-height: 1.35; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
      'mat-icon { display: none !important; }' +
      '.due-paper { width: 100%; display: flex; flex-direction: column; padding: 0; margin: 0; }' +
      '.due-slip { position: relative; border: 1.5px solid #94a3b8; border-radius: 6px; padding: 12px 16px; background: #ffffff; box-sizing: border-box; page-break-inside: avoid !important; }' +
      '.due-watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 220px; height: 220px; opacity: 0.04; pointer-events: none; background-size: contain; background-position: center; background-repeat: no-repeat; z-index: 0; }' +
      '.paper-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 6px; border-bottom: 2px solid #b91c1c; }' +
      '.inst-info { display: flex; align-items: center; gap: 10px; }' +
      '.logo-mark { width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }' +
      '.inst-logo-img { width: 100%; height: 100%; object-fit: contain; }' +
      '.inst-name { font-size: 1.12rem; font-weight: 800; color: #0f172a; line-height: 1.15; margin: 0; }' +
      '.inst-subtitle { font-size: 0.68rem; color: #475569; margin: 2px 0 0; }' +
      '.inst-branch { font-size: 0.68rem; color: #b91c1c; font-weight: 600; margin: 2px 0 0; }' +
      '.branch-pill { background: #fef2f2; color: #b91c1c; padding: 1px 6px; border-radius: 3px; border: 1px solid #fecaca; }' +
      '.branch-dept-sep { color: #94a3b8; }' +
      '.branch-dept { color: #64748b; }' +
      '.due-badge-block { text-align: right; }' +
      '.badge-title { font-size: 1.05rem; font-weight: 800; color: #b91c1c; letter-spacing: 0.04em; display: block; line-height: 1.1; }' +
      '.badge-sub { font-size: 0.68rem; color: #64748b; display: block; }' +
      '.copy-tag { display: inline-block; margin-top: 2px; font-size: 0.68rem; font-weight: 800; background: #fee2e2; color: #b91c1c; padding: 2px 8px; border-radius: 3px; border: 1px solid #fca5a5; }' +
      '.meta-strip { display: flex; flex-wrap: wrap; gap: 4px 12px; padding: 4px 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; margin: 6px 0; }' +
      '.meta-item { display: inline-flex; align-items: center; gap: 3px; font-size: 0.72rem; }' +
      '.meta-label { color: #64748b; font-weight: 600; }' +
      '.meta-val { color: #0f172a; font-weight: 700; }' +
      '.meta-val.highlight { color: #b91c1c; }' +
      '.meta-val.branch-val { color: #b91c1c; }' +
      '.status-badge-due { background: #fee2e2; color: #991b1b; padding: 1px 6px; border-radius: 3px; font-size: 0.66rem; font-weight: 800; }' +
      '.status-badge-settled { background: #dcfce7; color: #166534; padding: 1px 6px; border-radius: 3px; font-size: 0.66rem; font-weight: 800; }' +
      '.student-profile-card { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 14px; padding: 6px 10px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; margin-bottom: 6px; }' +
      '.prof-row { display: flex; align-items: baseline; gap: 6px; font-size: 0.72rem; line-height: 1.35; }' +
      '.prof-row .k { min-width: 110px; color: #475569; font-weight: 600; flex-shrink: 0; }' +
      '.prof-row .v { color: #0f172a; flex: 1; min-width: 0; }' +
      '.student-highlight { font-weight: 800; color: #991b1b; }' +
      '.table-section { margin-bottom: 6px; }' +
      '.due-table { width: 100%; border-collapse: collapse; }' +
      '.due-table th { background: #eff6ff !important; color: #1e3a8a !important; border-top: 1px solid #bfdbfe; border-bottom: 1.5px solid #bfdbfe; padding: 4px 6px; font-size: 0.72rem; font-weight: 700; text-align: left; }' +
      '.due-table td { padding: 5px 6px; border-bottom: 1px solid #e2e8f0; font-size: 0.74rem; line-height: 1.25; }' +
      '.due-item-title { font-size: 0.76rem; color: #0f172a; font-weight: 700; }' +
      '.due-item-heads { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 3px; }' +
      '.due-head-chip { font-size: 0.62rem; background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; padding: 1px 5px; border-radius: 3px; font-weight: 600; }' +
      '.amount-paid { color: #16a34a; }' +
      '.amount-due { color: #dc2626; font-weight: 800; }' +
      '.summary-subtotal { background: #f8fafc; border-top: 1.5px solid #cbd5e1; }' +
      '.grand-due { font-size: 0.92rem; font-weight: 800; color: #dc2626; }' +
      '.amount-words-strip { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: #fff1f2; border: 1px dashed #fca5a5; border-radius: 4px; margin-bottom: 6px; }' +
      '.words-left { display: flex; align-items: center; gap: 4px; font-size: 0.72rem; }' +
      '.w-label { color: #b91c1c; font-weight: 700; text-transform: uppercase; }' +
      '.w-text { color: #991b1b; font-weight: 700; }' +
      '.words-right { display: flex; align-items: center; gap: 4px; }' +
      '.due-stamp { background: #dc2626; color: #fff; padding: 2px 6px; border-radius: 6px; font-weight: 800; font-size: 0.66rem; display: inline-flex; align-items: center; gap: 2px; }' +
      '.due-stamp.paid-stamp { background: #16a34a; }' +
      '.upi-payee-pill { font-size: 0.62rem; color: #065f46; background: #d1fae5; padding: 1px 5px; border-radius: 3px; border: 1px solid #a7f3d0; }' +
      '.signatures-row { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 16px; margin-bottom: 6px; }' +
      '.sig-col { width: 140px; }' +
      '.sig-line { height: 1px; background: #475569; margin-bottom: 4px; }' +
      '.sig-text { font-size: 0.68rem; font-weight: 700; color: #334155; display: block; line-height: 1.15; }' +
      '.auth-sub { font-size: 0.6rem; color: #64748b; display: block; }' +
      '.uploaded-official-seal-img { max-width: 44px; max-height: 44px; object-fit: contain; display: block; margin: 0 auto; }' +
      '.digital-seal { border: 1px dashed #b91c1c; border-radius: 3px; padding: 2px 6px; background: #fef2f2; color: #b91c1c; font-size: 0.62rem; font-weight: 800; text-align: center; }' +
      '.sig-col-qr { width: 120px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }' +
      '.receipt-mini-qr { width: 105px; height: 105px; object-fit: contain; border: none; background: #ffffff; padding: 0; display: block; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
      '.qr-label { font-size: 0.6rem; font-weight: 700; color: #334155; margin-top: 3px; white-space: nowrap; text-align: center; }' +
      '.digital-sign-wrapper { display: flex; align-items: flex-end; justify-content: flex-end; height: 22px; margin-bottom: 2px; }' +
      '.digital-sign-img { max-height: 22px; max-width: 85px; object-fit: contain; mix-blend-mode: multiply; }' +
      '.paper-footer { text-align: center; font-size: 0.6rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 4px; margin-top: 4px; }' +
      '.text-center { text-align: center; }' +
      '.text-right { text-align: right; }' +
      '</style></head><body>' + el.innerHTML + '</body></html>');
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
