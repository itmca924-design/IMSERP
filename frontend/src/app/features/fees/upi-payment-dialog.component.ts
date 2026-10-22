import { Component, Inject, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import * as QRCode from 'qrcode';
import { firstValueFrom } from 'rxjs';
import {
  FeesService,
  UpiIntentResponse,
  FeePaymentReceipt,
  CollectUpiPaymentPayload,
  CollectStudentFifoUpiPayload
} from '../../core/services/fees.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { FeeReceiptDialogComponent } from './fee-receipt-dialog.component';
import { AuthService } from '../../core/services/auth.service';

export interface UpiPaymentDialogData {
  mode: 'invoice' | 'fifo_student';
  invoiceId?: string;
  studentId?: string;
  studentName?: string;
  rollNumber?: string;
  className?: string;
  batchName?: string;
  dueAmount?: number;
  invoiceNumber?: string;
  pendingLibraryFine?: number;
}

@Component({
  selector: 'app-upi-payment-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatChipsModule
  ],
  template: `
    <div class="upi-dialog-container">
      <!-- Strict IMSERP UI Rule: Light blue gradient header -->
      <header class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>qr_code_scanner</mat-icon>
          </div>
          <div class="header-titles">
            <h2 class="main-title">Dynamic Bharat UPI Instant Fee Payment</h2>
            <p class="subtitle">
              Scan &amp; pay with <strong>Google Pay, PhonePe, Paytm, or BHIM</strong> • Zero Gateway Surcharge
            </p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="closeDialog()" aria-label="Close dialog">
          <mat-icon>close</mat-icon>
        </button>
      </header>

      <!-- Dialog Body -->
      <div class="dialog-content">
        <!-- Error Banner -->
        <div class="error-banner" *ngIf="errorMessage">
          <mat-icon>error_outline</mat-icon>
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Success Screen -->
        <div class="success-screen" *ngIf="paymentSuccess && receipt">
          <div class="success-icon-wrap">
            <mat-icon>check_circle</mat-icon>
          </div>
          <h3 class="success-title">Payment Verified &amp; Settled!</h3>
          <p class="success-sub">
            Official E-Receipt <strong>#{{ receipt.receiptNumber }}</strong> has been generated and dues have been updated in real-time.
          </p>

          <div class="receipt-summary-box">
            <div class="summary-row">
              <span class="lbl">Student Name:</span>
              <span class="val">{{ receipt.studentName }} (Roll: {{ receipt.rollNumber }})</span>
            </div>
            <div class="summary-row">
              <span class="lbl">Amount Settled:</span>
              <span class="val highlight text-success">₹{{ receipt.amountPaid | number:'1.2-2' }}</span>
            </div>
            <div class="summary-row">
              <span class="lbl">Bank UTR / Ref:</span>
              <span class="val font-mono">{{ receipt.transactionRef || 'UPI-ONLINE' }}</span>
            </div>
            <div class="summary-row">
              <span class="lbl">Remaining Net Balance:</span>
              <span class="val" [class.text-danger]="receipt.remainingDue > 0" [class.text-success]="receipt.remainingDue <= 0">
                ₹{{ receipt.remainingDue | number:'1.2-2' }}
              </span>
            </div>
          </div>

          <div class="success-actions">
            <button mat-flat-button color="primary" class="primary-action-btn" (click)="openOfficialReceipt()">
              <mat-icon>receipt</mat-icon>
              <span>View &amp; Print Official Receipt</span>
            </button>
            <button mat-stroked-button class="secondary-btn" (click)="closeWithSuccess()">
              <mat-icon>done_all</mat-icon>
              <span>Done / Close</span>
            </button>
          </div>
        </div>

        <!-- Main Payment & QR Section -->
        <div class="payment-grid" *ngIf="!paymentSuccess">
          <!-- Left Column: Interactive Dynamic Bharat QR Code -->
          <div class="qr-column">
            <div class="qr-card">
              <!-- Verified Merchant Badge -->
              <div class="merchant-badge">
                <img *ngIf="merchantLogoUrl && !merchantLogoFailed" [src]="merchantLogoUrl" (error)="merchantLogoFailed = true" alt="Logo" class="merchant-logo-img" />
                <mat-icon *ngIf="!merchantLogoUrl || merchantLogoFailed" class="verified-icon">verified_user</mat-icon>
                <div class="merchant-info">
                  <span class="merchant-name">{{ upiIntent?.payeeName || data.studentName || authService.currentUser()?.instituteName || 'School Fee Collection' }}</span>
                  <span class="merchant-tag">Verified Institute UPI</span>
                </div>
              </div>

              <!-- Canvas QR Code Frame -->
              <div class="qr-canvas-wrapper">
                <div class="qr-border-box">
                  <canvas #qrCanvas class="upi-qr-canvas"></canvas>
                  <div class="qr-center-logo">
                    <span class="upi-logo-text">UPI</span>
                  </div>
                </div>
                <div class="scan-hint">
                  <mat-icon>crop_free</mat-icon>
                  <span>Scan with Any UPI App</span>
                </div>
              </div>

              <!-- VPA Copy Strip -->
              <div class="upi-id-box">
                <div class="vpa-text">
                  <span class="vpa-label">UPI ID (VPA):</span>
                  <strong class="vpa-val font-mono">{{ upiIntent?.payeeUpiId || 'fees@upi' }}</strong>
                </div>
                <button
                  mat-icon-button
                  class="copy-btn"
                  [matTooltip]="copiedVpa ? 'Copied to Clipboard!' : 'Copy UPI ID'"
                  (click)="copyVpa()"
                  type="button"
                >
                  <mat-icon>{{ copiedVpa ? 'check' : 'content_copy' }}</mat-icon>
                </button>
              </div>

              <!-- Quick Mobile Deep Links (1-Tap Payment) -->
              <div class="mobile-apps-container">
                <span class="mobile-launch-label">Or Pay Directly with Mobile App:</span>
                <div class="upi-apps-row">
                  <a [href]="upiIntent?.gpayUri || upiIntent?.upiIntentUri" class="upi-app-btn gpay" target="_self">
                    <span class="app-icon">G</span>
                    <span>GPay</span>
                  </a>
                  <a [href]="upiIntent?.phonepeUri || upiIntent?.upiIntentUri" class="upi-app-btn phonepe" target="_self">
                    <span class="app-icon">पे</span>
                    <span>PhonePe</span>
                  </a>
                  <a [href]="upiIntent?.paytmUri || upiIntent?.upiIntentUri" class="upi-app-btn paytm" target="_self">
                    <span class="app-icon">₹</span>
                    <span>Paytm</span>
                  </a>
                  <a [href]="upiIntent?.upiIntentUri" class="upi-app-btn any" target="_self">
                    <mat-icon>open_in_new</mat-icon>
                    <span>Any App</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Billing Particulars & 12-digit UTR Verification Form -->
          <div class="form-column">
            <!-- Student & Fee Meta Card (Spacious Flex Row) -->
            <div class="billing-summary-card">
              <div class="st-left">
                <div class="st-avatar">
                  <mat-icon>school</mat-icon>
                </div>
                <div class="st-info">
                  <div class="st-name-row">
                    <h4 class="st-name">{{ upiIntent?.studentName || data.studentName }}</h4>
                    <span class="st-status-tag">Active Student</span>
                  </div>
                  <div class="st-chips">
                    <span class="mini-chip">Roll: <strong>{{ upiIntent?.rollNumber || data.rollNumber || 'N/A' }}</strong></span>
                    <span class="mini-chip" *ngIf="upiIntent?.className || data.className">Class: <strong>{{ upiIntent?.className || data.className }}</strong></span>
                    <span class="mini-chip invoice-chip" *ngIf="upiIntent?.invoiceNumber || data.invoiceNumber">
                      Inv: <strong>{{ upiIntent?.invoiceNumber || data.invoiceNumber }}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div class="amount-deck">
                <div class="amount-pill">
                  <span class="amt-lbl">PAYABLE NOW</span>
                  <span class="amt-val">₹{{ paymentForm.get('amount')?.value | number:'1.2-2' }}</span>
                </div>
              </div>
            </div>

            <!-- Settlement Form -->
            <form [formGroup]="paymentForm" (ngSubmit)="onSubmitPayment()" class="settle-form">
              <div class="form-section-title">
                <mat-icon>verified</mat-icon>
                <span>Step 2: Enter Transaction Details &amp; Verify</span>
              </div>

              <div class="step-guide-box">
                <mat-icon class="guide-icon">info</mat-icon>
                <span>After paying via UPI, enter the <strong>12-digit UTR / Bank Reference No.</strong> from your payment receipt to instantly verify and issue the official fee receipt.</span>
              </div>

              <!-- Amount Input (Readonly) -->
              <mat-form-field appearance="outline" class="w-100 field-unit amount-field-readonly">
                <mat-label>Settlement Amount (₹)</mat-label>
                <input matInput type="number" formControlName="amount" [readonly]="true" />
                <span matPrefix class="prefix-sym">₹&nbsp;</span>
                <mat-icon matSuffix class="readonly-lock-icon" matTooltip="Settlement amount is fixed to current payable due">lock</mat-icon>
                <mat-hint>Total outstanding due: ₹{{ maxPayableAmount | number:'1.2-2' }}</mat-hint>
              </mat-form-field>

              <!-- 12-Digit UTR / Bank Reference Number -->
              <mat-form-field appearance="outline" class="w-100 field-unit utr-field">
                <mat-label>12-Digit UPI Reference ID / UTR No.</mat-label>
                <input
                  matInput
                  type="text"
                  formControlName="upiRrn"
                  placeholder="e.g. 428912345678 (12-digit UTR)"
                  maxlength="22"
                  autocomplete="off"
                />
                <mat-icon matSuffix class="field-icon">dialpad</mat-icon>
                <mat-hint class="utr-hint">Found under "UPI Ref No", "UTR", or "Bank Ref No" in your payment app</mat-hint>
                <mat-error *ngIf="paymentForm.get('upiRrn')?.hasError('required')">
                  UPI Reference ID / UTR is strictly required to verify payment.
                </mat-error>
                <mat-error *ngIf="paymentForm.get('upiRrn')?.hasError('minlength')">
                  UTR must contain at least 8 alphanumeric characters.
                </mat-error>
              </mat-form-field>

              <!-- Optional Payer Details in 2 Wide Columns -->
              <div class="form-row-2">
                <mat-form-field appearance="outline" class="field-unit">
                  <mat-label>Payer Name (Optional)</mat-label>
                  <input matInput type="text" formControlName="payerName" placeholder="e.g. Ramesh Kumar" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="field-unit">
                  <mat-label>Payer Phone / WhatsApp (Optional)</mat-label>
                  <input matInput type="tel" formControlName="payerPhone" placeholder="e.g. 9876543210" />
                </mat-form-field>
              </div>

              <!-- Options -->
              <div class="checkbox-row">
                <mat-checkbox formControlName="sendWhatsAppReceipt" color="primary">
                  <span>Send instant digital fee receipt on WhatsApp to parent phone</span>
                </mat-checkbox>
                <mat-checkbox *ngIf="data.pendingLibraryFine && data.pendingLibraryFine > 0" formControlName="includeLibraryFine" color="primary">
                  <span>Include pending Library Fine (₹{{ data.pendingLibraryFine | number:'1.2-2' }})</span>
                </mat-checkbox>
              </div>

              <!-- Submit Action Button -->
              <div class="submit-action-wrap">
                <button
                  mat-flat-button
                  color="primary"
                  type="submit"
                  class="verify-submit-btn"
                  [disabled]="paymentForm.invalid || submitting || loading"
                >
                  <mat-icon *ngIf="!submitting">check_circle_outline</mat-icon>
                  <span>{{ submitting ? 'Verifying & Generating Receipt...' : 'Verify Payment & Generate Receipt' }}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .upi-dialog-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      background: #ffffff;
      border-radius: 16px;
      box-sizing: border-box;
      max-height: 92vh;
      overflow-y: auto;
    }

    /* Strict IMSERP UI Header Standard */
    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 22px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-icon-box {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 42px;
      height: 42px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }

    .header-icon-box mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .header-titles .main-title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      color: #1e3a8a;
      letter-spacing: -0.01em;
    }

    .header-titles .subtitle {
      margin: 2px 0 0;
      font-size: 0.82rem;
      color: #3b82f6;
    }

    .header-titles .subtitle strong {
      color: #1e40af;
      font-weight: 600;
    }

    .close-btn {
      color: #64748b;
      transition: color 0.15s ease;
    }
    .close-btn:hover {
      color: #1e293b;
    }

    .top-loader {
      height: 3px;
    }

    .dialog-content {
      padding: 18px 22px 22px;
      box-sizing: border-box;
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #b91c1c;
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 14px;
      font-size: 0.88rem;
    }

    /* 2-Column Responsive Layout */
    .payment-grid {
      display: grid;
      grid-template-columns: 310px 1fr;
      gap: 22px;
      align-items: start;
    }

    @media (max-width: 768px) {
      .payment-grid {
        grid-template-columns: 1fr;
      }
    }

    /* Left Column: QR Card */
    .qr-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }

    .merchant-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      background: #eff6ff;
      border: 1px solid #dbeafe;
      border-radius: 8px;
      padding: 6px 10px;
      box-sizing: border-box;
      margin-bottom: 12px;
    }

    .merchant-logo-img {
      width: 32px;
      height: 32px;
      object-fit: contain;
      background: transparent;
      filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.15));
      flex-shrink: 0;
    }

    .verified-icon {
      color: #2563eb;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .merchant-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .merchant-name {
      font-size: 0.85rem;
      font-weight: 700;
      color: #1e3a8a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 230px;
    }

    .merchant-tag {
      font-size: 0.7rem;
      color: #64748b;
    }

    .qr-canvas-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 12px;
    }

    .qr-border-box {
      position: relative;
      background: #ffffff;
      padding: 10px;
      border-radius: 12px;
      border: 2px dashed #93c5fd;
      box-shadow: 0 4px 10px rgba(37,99,235,0.06);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .upi-qr-canvas {
      width: 175px !important;
      height: 175px !important;
      display: block;
    }

    .qr-center-logo {
      position: absolute;
      width: 34px;
      height: 34px;
      background: #ffffff;
      border: 2px solid #2563eb;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 5px rgba(0,0,0,0.15);
    }

    .upi-logo-text {
      font-size: 9px;
      font-weight: 900;
      color: #2563eb;
      letter-spacing: -0.5px;
    }

    .scan-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.76rem;
      color: #64748b;
      margin-top: 6px;
      font-weight: 500;
    }

    .scan-hint mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #3b82f6;
    }

    .upi-id-box {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 4px 8px 4px 10px;
      box-sizing: border-box;
      margin-bottom: 12px;
    }

    .vpa-text {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .vpa-label {
      font-size: 0.68rem;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 700;
    }

    .vpa-val {
      font-size: 0.82rem;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 210px;
    }

    .copy-btn {
      color: #2563eb;
    }

    .mobile-apps-container {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .mobile-launch-label {
      font-size: 0.72rem;
      color: #64748b;
      font-weight: 600;
      text-align: center;
    }

    .upi-apps-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      width: 100%;
    }

    .upi-app-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      padding: 6px 2px;
      border-radius: 8px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      text-decoration: none;
      color: #1e293b;
      font-size: 0.7rem;
      font-weight: 600;
      transition: all 0.15s ease;
      cursor: pointer;
    }

    .upi-app-btn:hover {
      background: #eff6ff;
      border-color: #93c5fd;
      transform: translateY(-1px);
    }

    .app-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      font-size: 11px;
      font-weight: 800;
      color: #ffffff;
    }

    .gpay .app-icon { background: #4285f4; }
    .phonepe .app-icon { background: #5f259f; }
    .paytm .app-icon { background: #00b9f5; }
    .any mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }

    /* Right Column: Form */
    .form-column {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .billing-summary-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 10px 14px;
    }

    .st-left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .st-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #2563eb;
      flex-shrink: 0;
    }

    .st-name-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .st-name {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .st-status-tag {
      font-size: 0.65rem;
      font-weight: 700;
      color: #166534;
      background: #dcfce7;
      border: 1px solid #bbf7d0;
      padding: 1px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .st-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 3px;
    }

    .mini-chip {
      font-size: 0.72rem;
      background: #e2e8f0;
      color: #334155;
      padding: 2px 7px;
      border-radius: 4px;
    }

    .invoice-chip {
      background: #e0e7ff;
      color: #3730a3;
    }

    .amount-deck {
      flex-shrink: 0;
    }

    .amount-pill {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      padding: 6px 14px;
      border-radius: 8px;
    }

    .amt-lbl {
      font-size: 0.65rem;
      font-weight: 800;
      color: #15803d;
      letter-spacing: 0.6px;
    }

    .amt-val {
      font-size: 1.25rem;
      font-weight: 800;
      color: #166534;
      font-feature-settings: 'tnum';
      line-height: 1.2;
    }

    .settle-form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .form-section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.92rem;
      font-weight: 700;
      color: #1e3a8a;
      padding-top: 2px;
    }

    .form-section-title mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #2563eb;
    }

    .step-guide-box {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      background: #eff6ff;
      border: 1px solid #dbeafe;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 0.78rem;
      color: #1e40af;
      line-height: 1.4;
    }

    .guide-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #2563eb;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .w-100 {
      width: 100%;
    }

    .field-unit {
      margin-bottom: 0px;
    }

    .amount-field-readonly {
      input {
        font-weight: 700;
        color: #0f172a;
        cursor: not-allowed;
      }
      .readonly-lock-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #64748b;
      }
      input[type=number]::-webkit-inner-spin-button,
      input[type=number]::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      input[type=number] {
        -moz-appearance: textfield;
      }
    }

    .utr-field input {
      font-family: monospace;
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: 1px;
      color: #1e3a8a;
    }

    .utr-field {
      mat-hint,
      ::ng-deep .mat-mdc-form-field-hint {
        white-space: nowrap !important;
        font-size: 0.72rem !important;
        letter-spacing: -0.12px !important;
        display: block !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        color: #64748b;
      }
    }

    .prefix-sym {
      font-weight: 700;
      color: #64748b;
    }

    .form-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    @media (max-width: 600px) {
      .form-row-2 {
        grid-template-columns: 1fr;
      }
    }

    .checkbox-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 0.85rem;
      margin: 2px 0 4px;
    }

    .submit-action-wrap {
      margin-top: 4px;
    }

    .verify-submit-btn {
      width: 100%;
      height: 46px;
      font-size: 0.95rem;
      font-weight: 700;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff;
      box-shadow: 0 4px 10px rgba(37,99,235,0.25);
      transition: all 0.2s ease;
    }

    .verify-submit-btn:hover:not([disabled]) {
      box-shadow: 0 6px 16px rgba(37,99,235,0.35);
      transform: translateY(-1px);
    }

    /* Success Screen */
    .success-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 30px 20px;
    }

    .success-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: #dcfce7;
      color: #16a34a;
      margin-bottom: 16px;
    }

    .success-icon-wrap mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }

    .success-title {
      margin: 0;
      font-size: 1.4rem;
      font-weight: 800;
      color: #1e3a8a;
    }

    .success-sub {
      font-size: 0.92rem;
      color: #64748b;
      margin: 8px 0 20px;
      max-width: 480px;
    }

    .receipt-summary-box {
      width: 100%;
      max-width: 460px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 24px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .summary-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.88rem;
    }

    .summary-row .lbl {
      color: #64748b;
    }

    .summary-row .val {
      font-weight: 600;
      color: #0f172a;
    }

    .summary-row .highlight {
      font-size: 1.1rem;
      font-weight: 800;
    }

    .success-actions {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .primary-action-btn {
      height: 44px;
      padding: 0 20px;
      font-weight: 700;
    }

    .secondary-btn {
      height: 44px;
      padding: 0 20px;
    }

    .font-mono {
      font-family: monospace;
    }

    .text-success { color: #16a34a !important; }
    .text-danger { color: #dc2626 !important; }
  `]
})
export class UpiPaymentDialogComponent implements OnInit, AfterViewInit {
  @ViewChild('qrCanvas') qrCanvasRef!: ElementRef<HTMLCanvasElement>;

  upiIntent: UpiIntentResponse | null = null;
  receipt: FeePaymentReceipt | null = null;
  paymentForm: FormGroup;
  loading = false;
  submitting = false;
  paymentSuccess = false;
  errorMessage = '';
  copiedVpa = false;
  maxPayableAmount = 0;
  merchantLogoFailed = false;

  get merchantLogoUrl(): string | null {
    return this.authService.getInstituteLogoUrl();
  }

  constructor(
    public dialogRef: MatDialogRef<UpiPaymentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UpiPaymentDialogData,
    private fb: FormBuilder,
    private feesService: FeesService,
    private confirmDialog: ConfirmDialogService,
    private dialog: MatDialog,
    public authService: AuthService
  ) {
    this.maxPayableAmount = (data.dueAmount || 0) + (data.pendingLibraryFine || 0);

    this.paymentForm = this.fb.group({
      amount: [data.dueAmount || 0, [Validators.required, Validators.min(1), Validators.max(this.maxPayableAmount)]],
      upiRrn: ['', [Validators.required, Validators.minLength(8)]],
      payerName: [''],
      payerPhone: [''],
      sendWhatsAppReceipt: [true],
      includeLibraryFine: [false]
    });
  }

  ngOnInit(): void {
    this.loadUpiIntent();

    // Listen for includeLibraryFine changes to adjust amount
    this.paymentForm.get('includeLibraryFine')?.valueChanges.subscribe(includeFine => {
      const baseDue = this.data.dueAmount || 0;
      const fine = (includeFine && this.data.pendingLibraryFine) ? this.data.pendingLibraryFine : 0;
      const total = baseDue + fine;
      this.maxPayableAmount = total;
      this.paymentForm.get('amount')?.setValidators([Validators.required, Validators.min(1), Validators.max(total)]);
      this.paymentForm.get('amount')?.setValue(total);
      this.paymentForm.get('amount')?.updateValueAndValidity();
      this.regenerateQr();
    });

    // Listen for amount changes to regenerate dynamic QR in real time
    this.paymentForm.get('amount')?.valueChanges.subscribe(() => {
      this.regenerateQr();
    });
  }

  ngAfterViewInit(): void {
    if (this.upiIntent) {
      this.renderQrCode(this.upiIntent.upiIntentUri);
    }
  }

  loadUpiIntent(): void {
    if (this.data.mode === 'invoice' && this.data.invoiceId) {
      this.loading = true;
      this.feesService.getInvoiceUpiIntent(this.data.invoiceId).subscribe({
        next: (res) => {
          this.upiIntent = res;
          this.loading = false;
          this.maxPayableAmount = res.dueAmount;
          this.paymentForm.get('amount')?.setValue(res.dueAmount);
          setTimeout(() => this.renderQrCode(res.upiIntentUri), 50);
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err.error?.message || 'Failed to initialize UPI QR payment. Please try again.';
        }
      });
    } else {
      // FIFO mode for entire student balance
      this.setupFifoIntent();
    }
  }

  setupFifoIntent(): void {
    this.loading = true;
    this.feesService.getUpiSettings().subscribe({
      next: (settings) => {
        this.loading = false;
        const due = this.data.dueAmount || 0;
        const payeeUpi = settings.effectiveUpiId || 'fees@upi';
        const payeeName = settings.effectiveMerchantName || 'School Fee Collection';
        const studentName = this.data.studentName || 'Student';
        const formattedAmt = due.toFixed(2);
        const encodedName = encodeURIComponent(payeeName);
        const note = encodeURIComponent(`Fee Settlement ${studentName}`);

        const upiUri = `upi://pay?pa=${payeeUpi}&pn=${encodedName}&am=${formattedAmt}&cu=INR&tn=${note}`;
        const gpay = `gpay://upi/pay?pa=${payeeUpi}&pn=${encodedName}&am=${formattedAmt}&cu=INR&tn=${note}`;
        const phonepe = `phonepe://pay?pa=${payeeUpi}&pn=${encodedName}&am=${formattedAmt}&cu=INR&tn=${note}`;
        const paytm = `paytmmp://pay?pa=${payeeUpi}&pn=${encodedName}&am=${formattedAmt}&cu=INR&tn=${note}`;
        const bhim = `bhim://pay?pa=${payeeUpi}&pn=${encodedName}&am=${formattedAmt}&cu=INR&tn=${note}`;

        this.upiIntent = {
          invoiceId: '',
          invoiceNumber: 'FIFO-SETTLEMENT',
          studentId: this.data.studentId || '',
          studentName: studentName,
          rollNumber: this.data.rollNumber,
          className: this.data.className,
          totalAmount: due,
          paidAmount: 0,
          dueAmount: due,
          payeeUpiId: payeeUpi,
          payeeName: payeeName,
          upiIntentUri: upiUri,
          gpayUri: gpay,
          phonepeUri: phonepe,
          paytmUri: paytm,
          bhimUri: bhim,
          instituteName: payeeName
        };

        setTimeout(() => this.renderQrCode(upiUri), 50);
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Could not load UPI gateway settings.';
      }
    });
  }

  regenerateQr(): void {
    if (!this.upiIntent) return;
    const currentAmt = parseFloat(this.paymentForm.get('amount')?.value) || 0;
    if (currentAmt <= 0) return;

    const payeeUpi = this.upiIntent.payeeUpiId;
    const payeeName = encodeURIComponent(this.upiIntent.payeeName);
    const formattedAmt = currentAmt.toFixed(2);
    const note = encodeURIComponent(`Fee ${this.upiIntent.invoiceNumber || 'Payment'} ${this.upiIntent.studentName}`);

    const dynamicUri = `upi://pay?pa=${payeeUpi}&pn=${payeeName}&am=${formattedAmt}&cu=INR&tn=${note}&tr=${this.upiIntent.invoiceNumber}`;
    this.upiIntent.upiIntentUri = dynamicUri;
    this.upiIntent.gpayUri = `gpay://upi/pay?pa=${payeeUpi}&pn=${payeeName}&am=${formattedAmt}&cu=INR&tn=${note}&tr=${this.upiIntent.invoiceNumber}`;
    this.upiIntent.phonepeUri = `phonepe://pay?pa=${payeeUpi}&pn=${payeeName}&am=${formattedAmt}&cu=INR&tn=${note}&tr=${this.upiIntent.invoiceNumber}`;
    this.upiIntent.paytmUri = `paytmmp://pay?pa=${payeeUpi}&pn=${payeeName}&am=${formattedAmt}&cu=INR&tn=${note}&tr=${this.upiIntent.invoiceNumber}`;
    this.upiIntent.bhimUri = `bhim://pay?pa=${payeeUpi}&pn=${payeeName}&am=${formattedAmt}&cu=INR&tn=${note}&tr=${this.upiIntent.invoiceNumber}`;

    this.renderQrCode(dynamicUri);
  }

  renderQrCode(uri: string): void {
    if (!this.qrCanvasRef || !this.qrCanvasRef.nativeElement) return;
    QRCode.toCanvas(this.qrCanvasRef.nativeElement, uri, {
      width: 175,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    }, (error) => {
      if (error) {
        console.error('QR generation error:', error);
      }
    });
  }

  copyVpa(): void {
    const vpa = this.upiIntent?.payeeUpiId;
    if (!vpa) return;
    navigator.clipboard.writeText(vpa).then(() => {
      this.copiedVpa = true;
      setTimeout(() => this.copiedVpa = false, 3000);
    });
  }

  async onSubmitPayment(): Promise<void> {
    if (this.paymentForm.invalid || this.submitting) return;

    const formVal = this.paymentForm.value;
    const cleanUtr = (formVal.upiRrn || '').trim();

    if (cleanUtr.length < 8) {
      this.confirmDialog.alert('Invalid UTR', 'Please enter a valid 12-digit UPI Reference ID / UTR from your payment app.', 'warning');
      return;
    }

    const amount = parseFloat(formVal.amount);
    const confirmed = await firstValueFrom(this.confirmDialog.confirm(
      'Verify & Settle UPI Payment?',
      `Are you sure you want to verify UTR ${cleanUtr} and settle ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} for ${this.data.studentName || 'Student'}?`,
      'Yes, Settle & Issue Receipt',
      'Cancel',
      'info'
    ));

    if (!confirmed) return;

    this.submitting = true;
    this.errorMessage = '';

    if (this.data.mode === 'invoice' && this.data.invoiceId) {
      const payload: CollectUpiPaymentPayload = {
        amount: parseFloat(formVal.amount),
        upiRrn: cleanUtr,
        payerName: formVal.payerName?.trim() || undefined,
        payerPhone: formVal.payerPhone?.trim() || undefined,
        sendWhatsAppReceipt: !!formVal.sendWhatsAppReceipt
      };

      this.feesService.collectInvoiceUpiPayment(this.data.invoiceId, payload).subscribe({
        next: (receiptRes) => {
          this.submitting = false;
          this.receipt = receiptRes;
          this.paymentSuccess = true;
        },
        error: (err) => {
          this.submitting = false;
          const msg = err.error?.message || 'Payment verification failed. Please verify your UTR and try again.';
          this.confirmDialog.alert('Payment Error', msg, 'danger');
        }
      });
    } else if (this.data.studentId) {
      const payload: CollectStudentFifoUpiPayload = {
        studentId: this.data.studentId,
        amount: parseFloat(formVal.amount),
        upiRrn: cleanUtr,
        payerName: formVal.payerName?.trim() || undefined,
        payerPhone: formVal.payerPhone?.trim() || undefined,
        sendWhatsAppReceipt: !!formVal.sendWhatsAppReceipt,
        includeLibraryFine: !!formVal.includeLibraryFine
      };

      this.feesService.collectStudentFifoUpiPayment(this.data.studentId, payload).subscribe({
        next: (receiptRes) => {
          this.submitting = false;
          this.receipt = receiptRes;
          this.paymentSuccess = true;
        },
        error: (err) => {
          this.submitting = false;
          const msg = err.error?.message || 'Payment verification failed. Please verify your UTR and try again.';
          this.confirmDialog.alert('Payment Error', msg, 'danger');
        }
      });
    }
  }

  openOfficialReceipt(): void {
    if (!this.receipt) return;
    this.dialog.open(FeeReceiptDialogComponent, {
      width: '840px',
      maxWidth: '96vw',
      panelClass: 'receipt-dialog-panel',
      data: {
        receipt: this.receipt,
        instituteName: this.receipt.instituteName || this.upiIntent?.instituteName,
        branchName: this.receipt.branchName
      },
      autoFocus: false
    });
  }

  closeWithSuccess(): void {
    this.dialogRef.close(this.receipt);
  }

  closeDialog(): void {
    this.dialogRef.close(this.paymentSuccess ? this.receipt : null);
  }
}
