import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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

@Component({
  selector: 'app-leave-policy-settings-dialog',
  standalone: true,
  imports: [
    CommonModule,
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
        <button mat-icon-button class="policy-dialog-close" (click)="cancel()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-progress-bar *ngIf="loading || saving" mode="indeterminate" class="policy-loader"></mat-progress-bar>

      <form [formGroup]="form" (ngSubmit)="submit()" *ngIf="!loading">
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

            <mat-form-field appearance="outline" class="form-col" *ngIf="form.get('leaveAccrualFrequency')?.value === 'Monthly'">
              <mat-label>Monthly CL Accrual Rate</mat-label>
              <input matInput type="number" formControlName="monthlyCasualLeaveAccrual" min="0.5" max="5" step="0.25" />
              <mat-hint>CL credited per month (e.g. 1.0 or 1.25)</mat-hint>
            </mat-form-field>
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

          <div class="error-banner" *ngIf="errorMessage">
            <mat-icon>error</mat-icon>
            <span>{{errorMessage}}</span>
          </div>
        </div>

        <div class="policy-dialog-footer">
          <button mat-stroked-button type="button" (click)="cancel()">Cancel</button>
          <button mat-flat-button class="btn-save" type="submit" [disabled]="saving || form.invalid">
            <mat-icon>{{saving ? 'hourglass_empty' : 'save'}}</mat-icon>
            {{saving ? 'Saving...' : 'Save Policy Settings'}}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .policy-dialog-container {
      width: 100%;
      max-width: 680px;
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
      padding: 18px 22px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 72vh;
      overflow-y: auto;
    }
    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.88rem;
      font-weight: 700;
      color: #1e40af;
      margin-top: 8px;
      padding-bottom: 4px;
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
      gap: 12px;
      flex-wrap: wrap;
    }
    .form-col {
      flex: 1 1 200px;
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
    private dialogRef: MatDialogRef<LeavePolicySettingsDialogComponent>
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
          allowFullDayLeaveIfMarkedPresent: [res.allowFullDayLeaveIfMarkedPresent]
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
    this.saving = true;
    this.errorMessage = '';

    this.http.put(`${API_BASE}/teachers/leave-policy-settings`, this.form.value).subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close(true);
      },
      error: err => {
        this.saving = false;
        this.errorMessage = err.error?.message || 'Failed to update policy settings.';
      }
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
