import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import * as QRCode from 'qrcode';
import { FeesService, UpiIntentResponse } from '../../core/services/fees.service';
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
                    >
                    <span class="app-name">Google Pay</span>
                  </a>
                  <a
                    [href]="upiIntent.phonepeUri || upiIntent.upiIntentUri"
                    (click)="onAppClick('PhonePe', upiIntent.phonepeUri || upiIntent.upiIntentUri, $event)"
                    class="app-btn phonepe"
                    target="_self"
                    >
                    <span class="app-name">PhonePe</span>
                  </a>
                  <a
                    [href]="upiIntent.paytmUri || upiIntent.upiIntentUri"
                    (click)="onAppClick('Paytm', upiIntent.paytmUri || upiIntent.upiIntentUri, $event)"
                    class="app-btn paytm"
                    target="_self"
                    >
                    <span class="app-name">Paytm</span>
                  </a>
                  <a
                    [href]="upiIntent.upiIntentUri"
                    (click)="onAppClick('Any UPI App', upiIntent.upiIntentUri, $event)"
                    class="app-btn any-upi"
                    target="_self"
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
    
      <!-- Loading / Error Template -->
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
  `]
})
export class PublicInvoicePayComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private feesService = inject(FeesService);
  private authService = inject(AuthService);

  loading = true;
  errorMsg = '';
  upiIntent: UpiIntentResponse | null = null;
  qrDataUrl = '';
  resolvedLogoUrl: string | null = null;
  copiedNotice = '';
  qrHighlighted = false;

  ngOnInit(): void {
    const invoiceId = this.route.snapshot.paramMap.get('invoiceId');
    if (!invoiceId) {
      this.loading = false;
      this.errorMsg = 'No invoice reference was specified.';
      return;
    }

    this.feesService.getInvoiceUpiIntent(invoiceId).subscribe({
      next: (intent) => {
        this.upiIntent = intent;
        this.loading = false;

        // Dynamically resolve institute logo
        if (intent.instituteLogo) {
          this.resolvedLogoUrl = this.authService.resolveLogoUrl(intent.instituteLogo);
        }
        if (!this.resolvedLogoUrl) {
          this.resolvedLogoUrl = this.authService.getInstituteLogoUrl();
        }

        if (intent.upiIntentUri) {
          QRCode.toDataURL(intent.upiIntentUri, { margin: 1, width: 220 })
            .then((url) => (this.qrDataUrl = url))
            .catch((err) => console.error('QR generation error', err));
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.message || 'Invoice not found or expired.';
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
}
