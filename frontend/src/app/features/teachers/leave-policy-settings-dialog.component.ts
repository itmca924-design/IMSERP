import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { API_BASE, LeavePolicySettingsDto } from './teacher.models';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-leave-policy-settings-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatProgressBarModule
],
  template: `
    <div class="policy-dialog-container">
      <!-- Strict Light Blue Header matching IMSERP UI Rule -->
      <div class="policy-dialog-header">
        <div class="policy-dialog-icon">
          <mat-icon>tune</mat-icon>
        </div>
        <div class="policy-dialog-title-group">
          <h2 class="policy-dialog-title">Faculty Leave & Regularization Policy</h2>
          <span class="policy-dialog-sub">
            Configure dynamic institutional quotas, monthly accrual rates, and conflict rules
          </span>
        </div>
        <button class="policy-dialog-close" (click)="cancel()" mat-icon-button>
          <mat-icon>close</mat-icon>
        </button>
      </div>
    
      @if (loading || saving) {
        <mat-progress-bar mode="indeterminate" class="policy-loader"></mat-progress-bar>
      }
    
      @if (!loading) {
        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="policy-dialog-body">
            <!-- Section 1: Annual Leave Quotas -->
            <div class="section-title">
              <mat-icon>date_range</mat-icon>
              <span>Annual Leave Allotment (Per Academic Year)</span>
            </div>
            <div class="form-row">
              <mat-form-field appearance="outline" class="form-col">
                <mat-label>Casual Leave (CL) Quota</mat-label>
                <input matInput type="number" formControlName="annualCasualLeaveQuota" min="0" max="60" step="0.5" />
                <mat-hint>Days per year (default: 12)</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline" class="form-col">
                <mat-label>Sick / Medical Leave (SL)</mat-label>
                <input matInput type="number" formControlName="annualSickLeaveQuota" min="0" max="60" step="0.5" />
                <mat-hint>Days per year (default: 10)</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline" class="form-col">
                <mat-label>Earned / Privilege Leave (EL)</mat-label>
                <input matInput type="number" formControlName="annualEarnedLeaveQuota" min="0" max="60" step="0.5" />
                <mat-hint>Days per year (default: 15)</mat-hint>
              </mat-form-field>
            </div>
            <!-- Section 2: Accrual Frequency -->
            <div class="section-title">
              <mat-icon>timelapse</mat-icon>
              <span>Leave Accrual & Credit Schedule</span>
            </div>
            <div class="form-row">
              <mat-form-field appearance="outline" class="form-col">
                <mat-label>Accrual Frequency</mat-label>
                <mat-select formControlName="leaveAccrualFrequency">
                  <mat-option value="Monthly">Monthly Accrual (Credited on 1st of each month)</mat-option>
                  <mat-option value="AnnualUpfront">Annual Lump-Sum (Credited at Session Start)</mat-option>
                </mat-select>
                <mat-hint>How leave quotas become available</mat-hint>
              </mat-form-field>
              @if (form.get('leaveAccrualFrequency')?.value === 'Monthly') {
                <mat-form-field appearance="outline" class="form-col">
                  <mat-label>Monthly CL Accrual Rate</mat-label>
                  <input matInput type="number" formControlName="monthlyCasualLeaveAccrual" min="0.5" max="5" step="0.25" />
                  <mat-hint>CL credited per month (e.g. 1.0 or 1.25)</mat-hint>
                </mat-form-field>
              }
            </div>
            <!-- Section 3: Attendance Regularization Rules -->
            <div class="section-title">
              <mat-icon>build_circle</mat-icon>
              <span>Attendance Regularization Limits</span>
            </div>
            <div class="form-row">
              <mat-form-field appearance="outline" class="form-col">
                <mat-label>Max Backdated Days Allowed</mat-label>
                <input matInput type="number" formControlName="maxRegularizationDaysBackdated" min="1" max="90" />
                <mat-hint>Days in past a request can be raised (default: 15)</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline" class="form-col">
                <mat-label>Max Requests Per Month</mat-label>
                <input matInput type="number" formControlName="maxRegularizationPerMonth" min="1" max="15" />
                <mat-hint>Max monthly regularization requests per teacher (default: 3)</mat-hint>
              </mat-form-field>
            </div>
            <!-- Section 4: Biometric & Manual Conflict Rules -->
            <div class="section-title">
              <mat-icon>sync_problem</mat-icon>
              <span>Conflict Resolution Automation</span>
            </div>
            <div class="toggle-card">
              <div class="toggle-info">
                <strong>Auto-Cancel Leave on Biometric Punch (Recommended)</strong>
                <p>If an employee has an approved leave but punches in at turnstile/device, automatically mark Present, override leave, and restore their leave balance quota.</p>
              </div>
              <mat-slide-toggle formControlName="autoCancelLeaveOnBiometricPunch" color="primary"></mat-slide-toggle>
            </div>
            <div class="toggle-card">
              <div class="toggle-info">
                <strong>Allow Full-Day Leave when Marked Present</strong>
                <p>When disabled, teachers cannot apply for a full-day leave on dates where they are already marked Present (half-day or regularization required).</p>
              </div>
              <mat-slide-toggle formControlName="allowFullDayLeaveIfMarkedPresent" color="primary"></mat-slide-toggle>
            </div>
            <!-- Section 5: Holidays & Weekends Exclusion -->
            <div class="section-title">
              <mat-icon>celebration</mat-icon>
              <span>Holidays & Weekends Deductible Policy</span>
            </div>
            <div class="toggle-card">
              <div class="toggle-info">
                <strong>Exclude Official Holidays from Leave Count (Recommended)</strong>
                <p>When enabled, official gazetted and declared school holidays falling within the leave period are NOT deducted from the teacher's leave balance.</p>
              </div>
              <mat-slide-toggle formControlName="excludeHolidaysFromLeaveCount" color="primary"></mat-slide-toggle>
            </div>
            <div class="toggle-card">
              <div class="toggle-info">
                <strong>Exclude Sundays from Leave Count (Weekly Off)</strong>
                <p>When enabled, Sundays falling within the leave period are treated as week-off and will NOT be deducted from the leave quota.</p>
              </div>
              <mat-slide-toggle formControlName="excludeSundaysFromLeaveCount" color="primary"></mat-slide-toggle>
            </div>

            <!-- Section 6: Payroll Calculation & Daily Divisor Policy (Zero Hardcoding) -->
            <div class="section-title">
              <mat-icon>calculate</mat-icon>
              <span>Payroll Calculation & Daily Salary Divisor (Zero Hardcoding)</span>
            </div>
            <div class="form-row">
              <mat-form-field appearance="outline" class="form-col">
                <mat-label>Salary Daily Divisor Mode</mat-label>
                <mat-select formControlName="salaryDivisorMode">
                  <mat-option value="WorkingDays">Actual Monthly Working Days (Institutional Standard)</mat-option>
                  <mat-option value="Fixed30Days">Fixed 30 Days (Corporate Payroll Standard)</mat-option>
                  <mat-option value="Standard26Days">Standard 26 Days (Factories / 6-Day Work Week)</mat-option>
                  <mat-option value="CalendarDays">Total Calendar Days in Month (28, 29, 30, or 31)</mat-option>
                </mat-select>
                <mat-hint>Formula used to compute daily salary rate (PerDay = Gross / Divisor)</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline" class="form-col">
                <mat-label>Late Penalty Threshold (Days)</mat-label>
                <input matInput type="number" formControlName="latePenaltyThresholdDays" min="0" max="15" />
                <mat-hint>Allowed late days per month before penalties trigger (default: 3)</mat-hint>
              </mat-form-field>
            </div>
            <div class="form-row">
              <mat-form-field appearance="outline" class="form-col">
                <mat-label>Late Penalty Factor</mat-label>
                <mat-select formControlName="latePenaltyDeductionFactor">
                  <mat-option [value]="0.5">Half-Day Deduction (0.5x Per 3 Late Punches)</mat-option>
                  <mat-option [value]="1.0">Full-Day Deduction (1.0x Per 3 Late Punches)</mat-option>
                  <mat-option [value]="0.0">No Financial Penalty (Warnings Only)</mat-option>
                </mat-select>
                <mat-hint>Deduction multiplier per penalty cycle</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline" class="form-col">
                <mat-label>Notice Period Required (Days)</mat-label>
                <input matInput type="number" formControlName="noticePeriodDays" min="0" max="180" />
                <mat-hint>Standard notice period for staff exits / FNF settlement (default: 30)</mat-hint>
              </mat-form-field>
            </div>

            <!-- Section 7: Financial Accounting & Auto-Posting -->
            <div class="section-title">
              <mat-icon>account_balance</mat-icon>
              <span>Financial Day Book & Payslip Automation</span>
            </div>
            <div class="toggle-card">
              <div class="toggle-info">
                <strong>Auto-Post Salary Disbursals to Day Book, P&L & Balance Sheet</strong>
                <p>When enabled, every disbursed salary creates an automated Expense Voucher under 'SALARY' category, instantly reconciling Day Book, P&L operating expense, and Cash/Bank asset ledgers.</p>
              </div>
              <mat-slide-toggle formControlName="autoPostPayrollToDayBook" color="primary"></mat-slide-toggle>
            </div>
            <div class="toggle-card">
              <div class="toggle-info">
                <strong>Auto-Send WhatsApp Payslip on Payment</strong>
                <p>Instantly deliver monthly salary slips to faculty WhatsApp numbers immediately upon individual or bulk salary payment approval.</p>
              </div>
              <mat-slide-toggle formControlName="autoSendWhatsAppPayslip" color="primary"></mat-slide-toggle>
            </div>
            @if (errorMessage) {
              <div class="error-banner">
                <mat-icon>error</mat-icon>
                <span>{{errorMessage}}</span>
              </div>
            }
          </div>
          <div class="policy-dialog-footer">
            <button type="button" (click)="cancel()" matButton="filled" class="app-button-cancel">Cancel</button>
            <button class="btn-save app-button-save" type="submit" [disabled]="saving || form.invalid" matButton="filled">
              <mat-icon>{{saving ? 'hourglass_empty' : 'save'}}</mat-icon>
              {{saving ? 'Saving...' : 'Save Policy Settings'}}
            </button>
          </div>
        </form>
      }
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    .policy-dialog-container {
      width: 100%;
      max-width: 880px;
      box-sizing: border-box;
      overflow-x: hidden;
      font-family: inherit;
      color: #0f172a;
    }
    .policy-dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .policy-dialog-icon {
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .policy-dialog-title-group { flex: 1; }
    .policy-dialog-title {
      margin: 0;
      color: #1e3a8a;
      font-size: 1.15rem;
      font-weight: 700;
    }
    .policy-dialog-sub {
      color: #3b82f6;
      font-size: 0.82rem;
      font-weight: 500;
      display: block;
      margin-top: 2px;
    }
    .policy-dialog-close { color: #64748b; }
    .policy-dialog-close:hover { color: #1e293b; }
    .policy-loader { height: 3px; }
    .policy-dialog-body {
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-height: 72vh;
      overflow-y: auto;
      overflow-x: hidden;
      box-sizing: border-box;
    }
    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.9rem;
      font-weight: 700;
      color: #1e40af;
      margin-top: 10px;
      padding-bottom: 6px;
      border-bottom: 1px dashed #cbd5e1;
    }
    .section-title mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #2563eb;
    }
    .form-row {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      width: 100%;
      box-sizing: border-box;
      margin-bottom: 8px;
    }
    .form-col {
      flex: 1 1 340px;
      min-width: 0;
      max-width: 100%;
      box-sizing: border-box;
    }
    .form-col mat-hint {
      font-size: 0.74rem;
      line-height: 1.35;
      color: #64748b;
      margin-top: 3px;
      display: block;
    }
    mat-form-field {
      width: 100%;
    }
    .toggle-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
    }
    .toggle-info {
      flex: 1;
      min-width: 0;
    }
    .toggle-info strong {
      color: #1e293b;
      font-size: 0.88rem;
      display: block;
    }
    .toggle-info p {
      margin: 2px 0 0;
      color: #64748b;
      font-size: 0.78rem;
      line-height: 1.35;
    }
    .policy-dialog-footer {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      padding: 14px 20px;
      border-top: 1px solid #e2e8f0;
      background: #fafafa;
    }
    .btn-save {
      background: #2563eb;
      color: #ffffff;
    }
    .error-banner {
      display: flex;
      gap: 8px;
      align-items: center;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 10px 14px;
      color: #991b1b;
      font-size: 0.84rem;
    }
  `]
})
export class LeavePolicySettingsDialogComponent implements OnInit {
  form!: FormGroup;
  loading = true;
  saving = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private dialogRef: MatDialogRef<LeavePolicySettingsDialogComponent>,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.http.get<LeavePolicySettingsDto>(`${API_BASE}/teachers/leave-policy-settings`).subscribe({
      next: res => {
        this.form = this.fb.group({
          annualCasualLeaveQuota: [res.annualCasualLeaveQuota, [Validators.required, Validators.min(0)]],
          annualSickLeaveQuota: [res.annualSickLeaveQuota, [Validators.required, Validators.min(0)]],
          annualEarnedLeaveQuota: [res.annualEarnedLeaveQuota, [Validators.required, Validators.min(0)]],
          leaveAccrualFrequency: [res.leaveAccrualFrequency || 'Monthly', Validators.required],
          monthlyCasualLeaveAccrual: [res.monthlyCasualLeaveAccrual, [Validators.required, Validators.min(0.1)]],
          maxRegularizationDaysBackdated: [res.maxRegularizationDaysBackdated, [Validators.required, Validators.min(1)]],
          maxRegularizationPerMonth: [res.maxRegularizationPerMonth, [Validators.required, Validators.min(1)]],
          autoCancelLeaveOnBiometricPunch: [res.autoCancelLeaveOnBiometricPunch],
          allowFullDayLeaveIfMarkedPresent: [res.allowFullDayLeaveIfMarkedPresent],
          excludeHolidaysFromLeaveCount: [res.excludeHolidaysFromLeaveCount ?? true],
          excludeSundaysFromLeaveCount: [res.excludeSundaysFromLeaveCount ?? true],
          salaryDivisorMode: [res.salaryDivisorMode || 'WorkingDays', Validators.required],
          latePenaltyThresholdDays: [res.latePenaltyThresholdDays ?? 3, [Validators.required, Validators.min(0)]],
          latePenaltyDeductionFactor: [res.latePenaltyDeductionFactor ?? 0.5, Validators.required],
          noticePeriodDays: [res.noticePeriodDays ?? 30, [Validators.required, Validators.min(0)]],
          autoPostPayrollToDayBook: [res.autoPostPayrollToDayBook ?? true],
          autoSendWhatsAppPayslip: [res.autoSendWhatsAppPayslip ?? false]
        });
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  submit(): void {
    if (this.form.invalid) return;

    this.confirmDialog.confirm(
      'Confirm Policy & Calculation Rules Update',
      `Are you sure you want to update institutional <strong>Leave & Payroll Calculation Policies</strong>?<br><br>` +
      `<div style="font-size:12px; color:#475569; background:#f1f5f9; padding:10px 14px; border-radius:8px; border:1px solid #cbd5e1; line-height: 1.5;">` +
      `• <strong>Salary Divisor Mode:</strong> ${this.form.value.salaryDivisorMode}<br>` +
      `• <strong>Late Penalty Threshold:</strong> ${this.form.value.latePenaltyThresholdDays} Days (Factor: ${this.form.value.latePenaltyDeductionFactor}x)<br>` +
      `• <strong>Notice Period Required:</strong> ${this.form.value.noticePeriodDays} Days<br>` +
      `• <strong>Day Book & P&L Auto-Posting:</strong> ${this.form.value.autoPostPayrollToDayBook ? 'Enabled' : 'Disabled'}<br>` +
      `• Changes will take effect immediately for all subsequent payroll runs and attendance evaluations across all branches.</div>`,
      'Save Policies',
      'Cancel',
      'info'
    ).subscribe(confirmed => {
      if (!confirmed) return;

      this.saving = true;
      this.errorMessage = '';

      this.http.put(`${API_BASE}/teachers/leave-policy-settings`, this.form.value).subscribe({
        next: () => {
          this.saving = false;
          this.confirmDialog.alert(
            'Policy Settings Saved',
            'Institutional leave quotas, payroll divisor calculation rules, and Day Book automation settings have been successfully updated.',
            'info'
          );
          this.dialogRef.close(true);
        },
        error: err => {
          this.saving = false;
          this.errorMessage = err.error?.message || 'Failed to update policy settings.';
          this.confirmDialog.alert('Save Error', this.errorMessage, 'danger');
        }
      });
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
