import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FeesService, UpiPaymentSettings, UpdateUpiPaymentSettingsPayload } from '../../core/services/fees.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-upi-settings-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatProgressBarModule,
    MatTooltipModule
],
  template: `
    <div class="upi-settings-container">
      <!-- Strict IMSERP UI Header Rule: Light blue gradient header -->
      <header class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>account_balance</mat-icon>
          </div>
          <div class="header-titles">
            <h2 class="main-title">UPI Payment Gateway Settings</h2>
            <p class="subtitle">
              Configure <strong>Zero-Fee Bharat UPI QR</strong>, Merchant VPA, and automated verification rules.
            </p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="dialogRef.close()" aria-label="Close dialog">
          <mat-icon>close</mat-icon>
        </button>
      </header>
    
      <form [formGroup]="settingsForm" (ngSubmit)="onSaveSettings()" class="settings-form">
        <div class="form-body">
          <div class="info-alert">
            <mat-icon>info</mat-icon>
            <div class="alert-text">
              <strong>Free &amp; Zero Transaction Fee UPI:</strong>
              Dynamic UPI QR uses the national NPCI standard. Parents scan with Google Pay, PhonePe, Paytm, or BHIM directly into your school bank account without any 2-3% payment gateway commission.
            </div>
          </div>
    
          <!-- Merchant VPA / UPI ID -->
          <mat-form-field appearance="outline" class="w-100 field-block">
            <mat-label>School / Campus UPI ID (VPA)</mat-label>
            <input
              matInput
              type="text"
              formControlName="upiId"
              placeholder="e.g. schoolname@sbi or fees@okhdfcbank"
              autocomplete="off"
              />
            <mat-icon matPrefix class="field-icon">alternate_email</mat-icon>
            <mat-hint>The official UPI ID linked to your institute's bank account</mat-hint>
            @if (settingsForm.get('upiId')?.hasError('required')) {
              <mat-error>
                UPI ID is required to generate payment QR codes.
              </mat-error>
            }
          </mat-form-field>
    
          <!-- Payee / Merchant Display Name -->
          <mat-form-field appearance="outline" class="w-100 field-block">
            <mat-label>Payee / Merchant Business Name</mat-label>
            <input
              matInput
              type="text"
              formControlName="upiMerchantName"
              placeholder="e.g. Jnandeep Campus"
              autocomplete="off"
              />
            <mat-icon matPrefix class="field-icon">business</mat-icon>
            <mat-hint>The verified name that appears on the parent's payment app</mat-hint>
            @if (settingsForm.get('upiMerchantName')?.hasError('required')) {
              <mat-error>
                Payee Merchant Name is required.
              </mat-error>
            }
          </mat-form-field>
    
          <div class="form-row-2">
            <!-- Merchant Category Code -->
            <mat-form-field appearance="outline" class="field-block">
              <mat-label>Merchant Category Code (MCC)</mat-label>
              <input matInput type="text" formControlName="upiMerchantCode" placeholder="8211" maxlength="6" [readonly]="true" />
              <mat-icon matSuffix matTooltip="Locked to 8211 (Official Standard Code for Schools & Educational Services)" style="font-size: 18px; color: #64748b; cursor: default;">lock</mat-icon>
              <mat-hint>🔒 Fixed: 8211 (Schools &amp; Educational Services)</mat-hint>
            </mat-form-field>
    
            <!-- Active Status Box -->
            <div class="status-summary-box">
              <span class="status-label">Gateway Status:</span>
              <span class="status-val text-success">
                <mat-icon>check_circle</mat-icon>
                <span>Direct NPCI Bharat UPI Active</span>
              </span>
            </div>
          </div>
    
          <!-- Toggles -->
          <div class="toggles-card">
            <div class="toggle-item">
              <div class="toggle-text">
                <strong class="toggle-title">Enable Dynamic UPI QR on Invoices &amp; Receipts</strong>
                <p class="toggle-sub">Shows instant scan &amp; pay QR codes on student portals, invoices, and public receipt links.</p>
              </div>
              <mat-slide-toggle formControlName="upiQrEnabled" color="primary"></mat-slide-toggle>
            </div>
    
            <div class="toggle-item">
              <div class="toggle-text">
                <strong class="toggle-title">Automated UTR Verification &amp; Instant Receipt</strong>
                <p class="toggle-sub">When parents submit a valid 12-digit UTR, automatically clear invoice dues and generate the receipt.</p>
              </div>
              <mat-slide-toggle formControlName="upiAutoVerify" color="primary"></mat-slide-toggle>
            </div>
          </div>
        </div>
    
        <div class="dialog-actions">
          <button mat-stroked-button type="button" (click)="dialogRef.close()" [disabled]="saving">
            Cancel
          </button>
          <button
            mat-flat-button
            color="primary"
            type="submit"
            class="save-btn"
            [disabled]="settingsForm.invalid || saving || loading"
            >
            @if (!saving) {
              <mat-icon>save</mat-icon>
            }
            <span>{{ saving ? 'Saving Settings...' : 'Save UPI Settings' }}</span>
          </button>
        </div>
      </form>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .upi-settings-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 600px;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-sizing: border-box;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .header-icon-box {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
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
    }

    .header-titles .subtitle {
      margin: 3px 0 0;
      font-size: 0.82rem;
      color: #3b82f6;
    }

    .header-titles .subtitle strong {
      color: #1e40af;
      font-weight: 600;
    }

    .close-btn {
      color: #64748b;
    }
    .close-btn:hover {
      color: #1e293b;
    }

    .top-loader {
      height: 3px;
    }

    .settings-form {
      display: flex;
      flex-direction: column;
    }

    .form-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-sizing: border-box;
    }

    .info-alert {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 12px 14px;
      color: #1e40af;
      font-size: 0.84rem;
      line-height: 1.45;
    }

    .info-alert mat-icon {
      color: #2563eb;
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .w-100 {
      width: 100%;
    }

    .field-block {
      margin-bottom: 2px;
    }

    .field-icon {
      color: #64748b;
      margin-right: 8px;
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

    .status-summary-box {
      display: flex;
      flex-direction: column;
      justify-content: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
    }

    .status-label {
      font-size: 0.72rem;
      color: #94a3b8;
      text-transform: uppercase;
      font-weight: 600;
    }

    .status-val {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
      font-weight: 700;
      margin-top: 4px;
    }

    .status-val mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .toggles-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .toggle-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .toggle-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .toggle-title {
      font-size: 0.88rem;
      color: #0f172a;
    }

    .toggle-sub {
      margin: 0;
      font-size: 0.78rem;
      color: #64748b;
    }

    .dialog-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      padding: 14px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }

    .save-btn {
      height: 42px;
      padding: 0 20px;
      font-weight: 700;
      background: #2563eb;
    }

    .text-success { color: #16a34a !important; }
  `]
})
export class UpiSettingsDialogComponent implements OnInit {
  settingsForm: FormGroup;
  loading = false;
  saving = false;

  constructor(
    public dialogRef: MatDialogRef<UpiSettingsDialogComponent>,
    private fb: FormBuilder,
    private feesService: FeesService,
    private confirmDialog: ConfirmDialogService
  ) {
    this.settingsForm = this.fb.group({
      upiId: ['', [Validators.required]],
      upiMerchantName: ['', [Validators.required]],
      upiMerchantCode: ['8211'],
      upiQrEnabled: [true],
      upiAutoVerify: [true]
    });
  }

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.loading = true;
    this.feesService.getUpiSettings().subscribe({
      next: (res) => {
        this.loading = false;
        this.settingsForm.patchValue({
          upiId: res.effectiveUpiId || res.upiId || '',
          upiMerchantName: res.effectiveMerchantName || res.upiMerchantName || '',
          upiMerchantCode: res.upiMerchantCode || '8211',
          upiQrEnabled: res.upiQrEnabled !== false,
          upiAutoVerify: res.upiAutoVerify !== false
        });
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onSaveSettings(): void {
    if (this.settingsForm.invalid || this.saving) return;

    this.saving = true;
    const formVal = this.settingsForm.value;
    const payload: UpdateUpiPaymentSettingsPayload = {
      upiId: formVal.upiId.trim(),
      upiMerchantName: formVal.upiMerchantName.trim(),
      upiMerchantCode: formVal.upiMerchantCode?.trim() || '8211',
      upiQrEnabled: !!formVal.upiQrEnabled,
      upiAutoVerify: !!formVal.upiAutoVerify
    };

    this.feesService.updateUpiSettings(payload).subscribe({
      next: () => {
        this.saving = false;
        this.confirmDialog.alert(
          'Settings Saved',
          'UPI Payment Gateway configuration has been updated successfully. Instant QR codes will now reflect your VPA.',
          'success'
        );
        this.dialogRef.close({ saved: true });
      },
      error: (err) => {
        this.saving = false;
        const msg = err.error?.message || 'Failed to save UPI settings. Please try again.';
        this.confirmDialog.alert('Save Failed', msg, 'danger');
      }
    });
  }
}
