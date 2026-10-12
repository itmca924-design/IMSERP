import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TeacherSelectorComponent } from './teacher-selector.component';
import {
  API_BASE,
  TeacherDto,
  SalaryPaymentDto,
  PayrollPreviewDto,
  AdvanceDto,
  MonthlyPayrollSummaryDto,
  MonthlyPayrollStaffItemDto,
  BulkSalaryPaymentRequestDto
} from './teacher.models';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { TeacherPayslipDialogComponent } from './teacher-payslip-dialog.component';

@Component({
  selector: 'app-teacher-payments',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterModule, MatCardModule, MatButtonModule,
    MatIconModule, MatInputModule, MatFormFieldModule, MatSelectModule,
    MatProgressBarModule, MatProgressSpinnerModule, MatCheckboxModule,
    MatTooltipModule, MatDialogModule, TeacherSelectorComponent
  ],
  template: `
<div class="page-container">
  <!-- Modern Responsive Page Header -->
  <div class="page-header">
    <div class="header-left">
      <div class="header-icon-box">
        <mat-icon>payments</mat-icon>
      </div>
      <div>
        <h1 class="page-title">Faculty &amp; Staff Salary Payments</h1>
        <p class="page-subtitle">Disburse monthly staff salaries individually or execute bulk payroll runs with automated attendance deductions.</p>
      </div>
    </div>

    <!-- Mode Selector Pills -->
    <div class="mode-pills">
      <button
        type="button"
        class="mode-pill"
        [class.active]="viewMode === 'single'"
        (click)="switchViewMode('single')"
      >
        <mat-icon>person</mat-icon>
        <span>Individual Staff View</span>
      </button>
      <button
        type="button"
        class="mode-pill"
        [class.active]="viewMode === 'bulk'"
        (click)="switchViewMode('bulk')"
      >
        <mat-icon>groups</mat-icon>
        <span>Monthly Bulk Payroll Run</span>
        <span class="badge-pill" *ngIf="bulkSummary && bulkSummary.pendingCount > 0">{{ bulkSummary.pendingCount }} Ready</span>
      </button>
    </div>
  </div>

  <!-- Loading Bar -->
  <mat-progress-bar mode="indeterminate" *ngIf="loading || bulkLoading || bulkDisbursing"></mat-progress-bar>

  <!-- ========================================================================= -->
  <!-- 1. INDIVIDUAL STAFF VIEW MODE -->
  <!-- ========================================================================= -->
  <div *ngIf="viewMode === 'single'" class="single-view-container">
    <app-teacher-selector [preSelectId]="preSelectId" [activeOnly]="false" (teacherSelected)="onTeacherSelected($event)"></app-teacher-selector>

    <div *ngIf="!selectedTeacher" class="no-selection">
      <mat-icon>person_search</mat-icon>
      <p>Please select a faculty member above to view salary payments and history.</p>
    </div>

    <div *ngIf="selectedTeacher">
      <!-- Exited Teacher Notice -->
      <div class="exited-notice" *ngIf="!selectedTeacher.isActive">
        <mat-icon>lock</mat-icon>
        <div>
          <strong>Faculty Member Relieved / Inactive</strong>
          <p>{{selectedTeacher.fullName}} ({{selectedTeacher.employeeCode}}) has been offboarded{{selectedTeacher.leavingDate ? ' on ' + (selectedTeacher.leavingDate | date:'dd MMM yyyy') : ''}}. Full &amp; Final Settlement has been processed. Regular monthly payments are locked.</p>
        </div>
      </div>

      <div class="section-header">
        <div class="section-hdr-left">
          <h3>{{selectedTeacher.fullName}} — Payment History</h3>
          <span class="staff-sub-badge" *ngIf="selectedTeacher.designation">{{selectedTeacher.designation}} &bull; {{selectedTeacher.department || 'Faculty'}}</span>
          <span class="status-chip missing-header-chip" *ngIf="preview && !hasSalaryConfigured" (click)="goToSalaryStructure()" matTooltip="Click to configure salary structure">
            <mat-icon>warning_amber</mat-icon> Salary Structure Not Configured
          </span>
        </div>
        <button mat-raised-button color="primary" [disabled]="!selectedTeacher.isActive" (click)="toggleForm()" [matTooltip]="!selectedTeacher.isActive ? 'Exited teacher cannot receive regular salary payments' : ''">
          <mat-icon>{{showForm ? 'close' : 'add'}}</mat-icon>
          {{showForm ? 'Cancel' : 'Record Salary Payment'}}
        </button>
      </div>

      <!-- Payment Form -->
      <mat-card class="form-card mat-elevation-z1" *ngIf="showForm">

        <!-- 1. When Salary Structure is Configured: Smart Payroll Auto-Calculation Banner (Only for completed past months) -->
        <div class="payroll-preview-banner" *ngIf="hasSalaryConfigured && !isSelectedMonthOngoing && !isSelectedMonthFuture" [class.applied-banner]="calculationsApplied">
          <div class="banner-top">
            <div class="banner-title">
              <mat-icon>calculate</mat-icon>
              <div>
                <strong>Automated Attendance &amp; Salary Calculation ({{months[preview!.month - 1]}} {{preview!.year}})</strong>
                <p>Per-day rate: ₹{{preview!.perDayRate | number}} ({{preview!.totalWorkingDays}} working days in month)</p>
              </div>
            </div>
            <button mat-flat-button type="button" class="autofill-btn" [class.applied]="calculationsApplied" (click)="applyPreviewToForm()">
              <mat-icon>{{calculationsApplied ? 'check_circle' : 'auto_fix_high'}}</mat-icon>
              {{calculationsApplied ? 'Calculations Verified &amp; Applied ✓' : 'Auto-Fill Calculated Deductions'}}
            </button>
          </div>

          <!-- Stats Grid -->
          <div class="banner-grid">
            <div class="stat-box">
              <span class="lbl">Gross Salary</span>
              <span class="num">₹{{preview!.grossSalary | number}}</span>
              <small>Base monthly gross</small>
            </div>
            <div class="stat-box">
              <span class="lbl">Present &amp; Half Days</span>
              <span class="num">{{preview!.presentDays}}P / {{preview!.halfDays}}HD</span>
              <small [class.red]="preview!.halfDayDeduction > 0">
                {{preview!.halfDayDeduction > 0 ? '-₹' + (preview!.halfDayDeduction | number) + ' (Half Day cut)' : '0 Half Day cut'}}
              </small>
            </div>
            <div class="stat-box" [class.highlight-warn]="preview!.latePenaltyDays > 0">
              <span class="lbl">Late Marks</span>
              <span class="num">{{preview!.lateDays}} Lates ({{preview!.allowedLateDays}} Free)</span>
              <small [class.red]="preview!.latePenaltyDays > 0" [class.green]="preview!.latePenaltyDays === 0">
                {{preview!.latePenaltyDays > 0 ? '-₹' + (preview!.latePenaltyDeduction | number) + ' (' + preview!.excessLateDays + ' excess: ' + preview!.latePenaltyDays + 'd cut)' : 'Within Grace Quota (₹0 Cut)'}}
              </small>
            </div>
            <div class="stat-box">
              <span class="lbl">Absent Days</span>
              <span class="num">{{preview!.absentDays}} Absent</span>
              <small [class.red]="preview!.absentDeduction > 0">
                {{preview!.absentDeduction > 0 ? '-₹' + (preview!.absentDeduction | number) + ' (Loss of Pay)' : '0 Absents'}}
              </small>
            </div>

            <!-- Sanctioned Leaves Breakdown Card -->
            <div class="stat-box" *ngIf="(preview!.unpaidLeaveDays || 0) > 0 || (preview!.paidLeaveDays || 0) > 0" style="border-color:#f59e0b;background:#fffbeb;">
              <span class="lbl" style="color:#b45309;">Sanctioned Leaves</span>
              <span class="num" style="color:#d97706;">{{ (preview!.unpaidLeaveDays || 0) + (preview!.paidLeaveDays || 0) }} Days</span>
              <small style="color:#92400e;">
                <span *ngIf="(preview!.unpaidLeaveDays || 0) > 0" style="color:#dc2626;font-weight:600;">{{preview!.unpaidLeaveDays}}d Unpaid (LOP)</span>
                <span *ngIf="(preview!.unpaidLeaveDays || 0) > 0 && (preview!.paidLeaveDays || 0) > 0"> &bull; </span>
                <span *ngIf="(preview!.paidLeaveDays || 0) > 0" style="color:#16a34a;font-weight:600;">{{preview!.paidLeaveDays}}d Paid</span>
              </small>
            </div>

            <!-- Hostel Rent Deduction Card -->
            <div class="stat-box" *ngIf="preview!.hostelRentDeduction > 0" style="border-color:#f97316;background:#fff7ed;">
              <span class="lbl" style="color:#9a3412;">Hostel / Mess Rent</span>
              <span class="num" style="color:#c2410c;">-₹{{preview!.hostelRentDeduction | number}}</span>
              <small style="color:#ea580c;">{{preview!.hostelRentInfo || 'Monthly rent deduction'}}</small>
            </div>

            <!-- Transport Fare Deduction Card -->
            <div class="stat-box" *ngIf="preview!.transportFareDeduction > 0" style="border-color:#8b5cf6;background:#faf5ff;">
              <span class="lbl" style="color:#5b21b6;">Transport Fare</span>
              <span class="num" style="color:#7c3aed;">-₹{{preview!.transportFareDeduction | number}}</span>
              <small style="color:#8b5cf6;">{{preview!.transportFareInfo || 'Monthly transport fare'}}</small>
            </div>

            <!-- Advance Adjustment Card -->
            <div class="stat-box advance-box" *ngIf="preview!.pendingAdvance > 0" [class.highlight-advance]="preview!.pendingAdvance > 0">
              <span class="lbl advance-lbl">
                <mat-icon class="adv-icon">account_balance_wallet</mat-icon>
                Advance to Adjust
              </span>
              <span class="num advance-num">-₹{{preview!.pendingAdvance | number}}</span>
              <small class="red">{{pendingAdvances.length}} advance(s) pending — will be deducted</small>
            </div>
            <!-- No Pending Advance -->
            <div class="stat-box" *ngIf="preview!.pendingAdvance === 0">
              <span class="lbl">Advance Adjusted</span>
              <span class="num" style="color:#15803d">₹0</span>
              <small class="green">No pending advance</small>
            </div>

            <!-- Arrears Card (when arrearsAmount > 0) -->
            <div class="stat-box" *ngIf="(preview!.arrearsAmount || 0) > 0" style="border-color:#10b981;background:#ecfdf5;">
              <span class="lbl" style="color:#047857;">Joining Arrears (पिछला बकाया)</span>
              <span class="num" style="color:#059669;">+₹{{preview!.arrearsAmount | number}}</span>
              <small style="color:#065f46;">{{preview!.arrearsRemarks || 'Previous month joining arrears'}}</small>
            </div>

            <div class="stat-box net-box">
              <span class="lbl">Net Suggested Pay</span>
              <span class="num net">₹{{preview!.recommendedNetPaid | number}}</span>
              <small *ngIf="(preview!.arrearsAmount || 0) > 0">Gross ₹{{preview!.grossSalary | number}} + Arrears ₹{{preview!.arrearsAmount | number}} &bull; Ded: -₹{{preview!.totalAttendanceDeduction + preview!.pfDeduction + preview!.tdsDeduction + preview!.otherDeductions + preview!.pendingAdvance + (preview!.hostelRentDeduction || 0) + (preview!.transportFareDeduction || 0) | number}}</small>
              <small *ngIf="!preview!.arrearsAmount || preview!.arrearsAmount === 0">Deductions: -₹{{preview!.totalAttendanceDeduction + preview!.pfDeduction + preview!.tdsDeduction + preview!.otherDeductions + preview!.pendingAdvance + (preview!.hostelRentDeduction || 0) + (preview!.transportFareDeduction || 0) | number}}</small>
            </div>
          </div>

          <!-- Advance Detail Breakdown -->
          <div class="advance-detail-strip" *ngIf="preview!.pendingAdvance > 0 && pendingAdvances.length > 0">
            <mat-icon>info</mat-icon>
            <span>
              <strong>Advance Breakdown:</strong>
              <span *ngFor="let a of pendingAdvances; let last = last">
                ₹{{a.amount | number}} ({{a.requestDate | date:'dd MMM yyyy'}} — {{a.reason || 'No reason'}}){{!last ? ', ' : ''}}
              </span>
              → Total: <strong>₹{{preview!.pendingAdvance | number}}</strong> will be auto-adjusted from salary.
            </span>
          </div>
        </div>

        <!-- Ongoing Month Warning Banner -->
        <div class="month-status-banner ongoing-banner mat-elevation-z1" *ngIf="isSelectedMonthOngoing">
          <div class="status-banner-icon"><mat-icon>schedule</mat-icon></div>
          <div class="status-banner-content">
            <h4>{{ ongoingMonthInfo?.monthName }} {{ ongoingMonthInfo?.year }} is In Progress (माह अभी जारी है)</h4>
            <p>
              Today is <strong>Day {{ ongoingMonthInfo?.currentDay }} of {{ ongoingMonthInfo?.totalDays }}</strong>. Monthly attendance register is incomplete.
              Per standard institutional payroll rules, regular monthly salary can only be processed on or after the last day of the month (<strong>{{ ongoingMonthInfo?.totalDays }} {{ ongoingMonthInfo?.monthName }} {{ ongoingMonthInfo?.year }}</strong>).
            </p>
          </div>
        </div>

        <!-- Future Month Warning Banner -->
        <div class="month-status-banner future-banner mat-elevation-z1" *ngIf="isSelectedMonthFuture">
          <div class="status-banner-icon"><mat-icon>event_busy</mat-icon></div>
          <div class="status-banner-content">
            <h4>Future Month Selected (भविष्य का महीना)</h4>
            <p>Salary payment cannot be processed for a future month. Please select a past completed month.</p>
          </div>
        </div>

        <!-- 2. When Salary Structure is NOT Configured: Prominent Warning Banner -->
        <div class="missing-salary-card mat-elevation-z1" *ngIf="!hasSalaryConfigured && !previewLoading && !isSelectedMonthOngoing && !isSelectedMonthFuture">
          <div class="missing-salary-icon-wrap">
            <mat-icon>warning_amber</mat-icon>
          </div>
          <div class="missing-salary-content">
            <h4>Salary Structure Not Configured (वेतन संरचना कॉन्फ़िगर नहीं है)</h4>
            <p>
              Salary structure (Basic Salary, HRA, Allowances) has not been configured for
              <strong>{{ selectedTeacher.fullName }}</strong> ({{ selectedTeacher.employeeCode }}).
              Gross salary is <strong>₹0</strong>. Monthly salary payments cannot be recorded until a valid salary structure is configured.
            </p>
          </div>
          <button mat-raised-button color="primary" type="button" class="config-now-btn" (click)="goToSalaryStructure()">
            <mat-icon>tune</mat-icon>
            <span>Configure Salary Structure</span>
          </button>
        </div>

        <form [formGroup]="paymentForm" (ngSubmit)="recordPayment()">
          <div class="form-grid">
            <!-- Row 1: Period & Earnings (4 columns) -->
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Month *</mat-label>
              <mat-select formControlName="paymentMonth">
                <mat-option *ngFor="let m of months; let i=index" [value]="i+1">{{m}}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Year *</mat-label>
              <input matInput type="number" formControlName="paymentYear" min="2020" max="2099">
              <mat-error *ngIf="paymentForm.get('paymentYear')?.hasError('required')">Year required</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Gross Amount ₹ *</mat-label>
              <input matInput type="number" formControlName="grossAmount" min="0">
              <mat-error *ngIf="paymentForm.get('grossAmount')?.hasError('required')">Gross amount required</mat-error>
              <mat-error *ngIf="paymentForm.get('grossAmount')?.hasError('min')">Must be ≥ 0</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Arrears ₹ (पिछला बकाया)</mat-label>
              <input matInput type="number" formControlName="arrearsAmount" min="0">
              <mat-hint *ngIf="preview?.arrearsRemarks" class="hint-arrears" align="start" [matTooltip]="preview?.arrearsRemarks || ''">
                ⚡ {{preview?.arrearsRemarks}}
              </mat-hint>
            </mat-form-field>

            <!-- Row 2: Deductions, Advance, Net & Mode (4 columns) -->
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Deductions ₹</mat-label>
              <input matInput type="number" formControlName="deductions" min="0">
              <mat-error *ngIf="paymentForm.get('deductions')?.hasError('min')">Must be ≥ 0</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Advance Adjusted ₹</mat-label>
              <input matInput type="number" formControlName="advanceAdjusted" min="0">
              <mat-hint *ngIf="preview && preview.pendingAdvance > 0" class="hint-advance" align="start">
                ⚡ Auto-filled: ₹{{preview.pendingAdvance | number}}
              </mat-hint>
              <mat-error *ngIf="paymentForm.get('advanceAdjusted')?.hasError('min')">Must be ≥ 0</mat-error>
              <mat-error *ngIf="paymentForm.get('advanceAdjusted')?.hasError('advanceExceedsGross')">Advance cannot exceed total earnings</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Net Paid ₹ *</mat-label>
              <input matInput type="number" formControlName="netPaid" min="0">
              <mat-hint class="single-line-hint" title="Gross + Arrears − Deductions − Advance">Gross + Arr. − Ded. − Adv.</mat-hint>
              <mat-error *ngIf="paymentForm.get('netPaid')?.hasError('required')">Net paid required</mat-error>
              <mat-error *ngIf="paymentForm.get('netPaid')?.hasError('min')">Must be ≥ 0</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Payment Mode</mat-label>
              <mat-select formControlName="paymentMode">
                <mat-option value="Cash">Cash</mat-option>
                <mat-option value="BankTransfer">Bank Transfer</mat-option>
                <mat-option value="UPI">UPI</mat-option>
                <mat-option value="Cheque">Cheque</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Row 3: Present Days, Absent Days, Payment Date, Transaction Ref (4 columns) -->
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Present Days</mat-label>
              <input matInput type="number" formControlName="presentDays" min="0">
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Absent Days</mat-label>
              <input matInput type="number" formControlName="absentDays" min="0">
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Payment Date *</mat-label>
              <input matInput type="date" formControlName="paymentDate">
              <mat-error *ngIf="paymentForm.get('paymentDate')?.hasError('required')">Date required</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Transaction Ref</mat-label>
              <input matInput formControlName="transactionRef" placeholder="UTR / Cheque No.">
            </mat-form-field>

            <!-- Row 4: Remarks (spans all 4 columns) -->
            <mat-form-field appearance="outline" class="remarks-col-4" subscriptSizing="dynamic">
              <mat-label>Remarks</mat-label>
              <input matInput formControlName="remarks" placeholder="Optional notes, deductions explanation, or attendance calculation remarks...">
              <mat-icon matSuffix color="primary">notes</mat-icon>
            </mat-form-field>
          </div>
          <div class="form-actions">
            <!-- Ongoing Month Lock Hint -->
            <div class="mandatory-hint warn-hint" *ngIf="isSelectedMonthOngoing">
              <mat-icon>lock_clock</mat-icon>
              <span>"Record Payment" is locked — {{ ongoingMonthInfo?.monthName }} is in progress (Day {{ ongoingMonthInfo?.currentDay }}/{{ ongoingMonthInfo?.totalDays }}). Allowed on or after {{ ongoingMonthInfo?.totalDays }} {{ ongoingMonthInfo?.monthName }}.</span>
            </div>

            <!-- Future Month Lock Hint -->
            <div class="mandatory-hint warn-hint" *ngIf="isSelectedMonthFuture">
              <mat-icon>block</mat-icon>
              <span>"Record Payment" is locked — Cannot process future month.</span>
            </div>

            <!-- 1. If Salary Structure is NOT configured -->
            <div class="mandatory-hint warn-hint" *ngIf="!hasSalaryConfigured && !isSelectedMonthOngoing && !isSelectedMonthFuture">
              <mat-icon>warning_amber</mat-icon>
              <span>"Record Payment" is locked — Salary structure is not configured (Gross amount is ₹0). Please configure Salary Structure first.</span>
            </div>

            <!-- 2. If Salary Structure IS configured, but auto-fill not clicked -->
            <div class="mandatory-hint" *ngIf="hasSalaryConfigured && !calculationsApplied && !isSelectedMonthOngoing && !isSelectedMonthFuture">
              <mat-icon>lock</mat-icon>
              <span>"Record Payment" is disabled — Please click <strong>"Auto-Fill Calculated Deductions"</strong> above first.</span>
            </div>

            <!-- 3. If Salary Structure IS configured, and auto-fill clicked -->
            <div class="mandatory-hint success-hint" *ngIf="hasSalaryConfigured && calculationsApplied && !isSelectedMonthOngoing && !isSelectedMonthFuture">
              <mat-icon>check_circle</mat-icon>
              <span>Calculations verified! You can now record the payment.</span>
            </div>

            <button mat-button type="button" (click)="toggleForm()">Cancel</button>

            <!-- Configure Structure Shortcut Button when unconfigured -->
            <button mat-stroked-button color="warn" type="button" *ngIf="!hasSalaryConfigured" (click)="goToSalaryStructure()">
              <mat-icon>tune</mat-icon>
              <span>Configure Structure</span>
            </button>

            <button mat-raised-button color="primary" type="submit"
                    [disabled]="paymentForm.invalid || !calculationsApplied || saving || !hasSalaryConfigured || isSelectedMonthOngoing || isSelectedMonthFuture"
                    [matTooltip]="isSelectedMonthOngoing ? 'Cannot record payment for ongoing month until month-end' : (isSelectedMonthFuture ? 'Cannot record payment for future month' : (!hasSalaryConfigured ? 'Cannot record payment: Salary structure is not configured (Gross amount is ₹0)' : (!calculationsApplied ? 'Please click Auto-Fill above to apply deductions' : (paymentForm.invalid ? 'Please resolve validation errors in form' : ''))))">
              <mat-icon>{{saving ? 'hourglass_empty' : 'save'}}</mat-icon>
              {{saving ? 'Saving...' : 'Record Payment'}}
            </button>
          </div>
        </form>
      </mat-card>

      <!-- Payments Table -->
      <mat-card class="table-card mat-elevation-z1" *ngIf="payments.length > 0">
        <table class="pay-table">
          <thead>
            <tr>
              <th>Month / Year</th><th>Gross</th><th>Deductions</th>
              <th>Advance Adj.</th><th>Net Paid</th><th>Mode</th><th>Receipt</th><th>Date</th><th class="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of payments">
              <td><strong>{{p.monthName}}</strong></td>
              <td>
                <div>₹{{p.grossAmount | number}}</div>
                <span *ngIf="(p.arrearsAmount || 0) > 0" class="arrears-pill" [matTooltip]="p.arrearsRemarks || 'Joining arrears'">
                  +₹{{p.arrearsAmount | number}} Arr.
                </span>
              </td>
              <td>₹{{p.deductions | number}}</td>
              <td>
                <span *ngIf="p.advanceAdjusted > 0" class="advance-adj-chip">
                  <mat-icon class="inline-icon">account_balance_wallet</mat-icon>
                  ₹{{p.advanceAdjusted | number}}
                </span>
                <span *ngIf="p.advanceAdjusted === 0" style="color:#94a3b8">—</span>
              </td>
              <td><strong class="net-amount">₹{{p.netPaid | number}}</strong></td>
              <td><span class="mode-chip">{{p.paymentMode}}</span></td>
              <td>
                <span class="receipt-tag clickable" (click)="openPayslip(p)" matTooltip="Click to view Payslip">
                  <mat-icon class="inline-icon">receipt</mat-icon> {{p.receiptNumber}}
                </span>
              </td>
              <td>{{p.paymentDate | date:'dd MMM yyyy'}}</td>
              <td class="text-center" style="white-space:nowrap;">
                <button mat-flat-button color="primary" class="payslip-btn" (click)="openPayslip(p)" matTooltip="View &amp; Print Payslip">
                  <mat-icon>receipt_long</mat-icon> Payslip
                </button>
                <button mat-icon-button color="warn" (click)="deletePayment(p)" matTooltip="Delete Voucher">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </mat-card>

      <!-- Summary Bar -->
      <mat-card class="summary-bar mat-elevation-z1" *ngIf="payments.length > 0">
        <span>Total Payments: <strong>{{payments.length}}</strong></span>
        <span>Total Gross Paid: <strong>₹{{totalGross | number}}</strong></span>
        <span>Total Advance Recovered: <strong class="orange">₹{{totalAdvanceAdjusted | number}}</strong></span>
        <span>Total Net Paid: <strong class="green">₹{{totalPaid | number}}</strong></span>
      </mat-card>

      <div class="empty-state" *ngIf="payments.length === 0 && !loading && !showForm">
        <mat-icon>payments</mat-icon>
        <p>No salary payments recorded yet for this faculty member.</p>
      </div>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- 2. MONTHLY BULK PAYROLL RUN MODE -->
  <!-- ========================================================================= -->
  <div *ngIf="viewMode === 'bulk'" class="bulk-view-container">

    <!-- Bulk Control Bar (Month & Year Selector) -->
    <div class="bulk-header-bar">
      <div class="bulk-filter-controls">
        <mat-form-field appearance="outline" class="bulk-select-field" subscriptSizing="dynamic">
          <mat-label>Payroll Month</mat-label>
          <mat-select [(ngModel)]="bulkMonth" (selectionChange)="loadBulkPreview()">
            <mat-option *ngFor="let m of months; let i=index" [value]="i+1">{{m}}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="bulk-year-field" subscriptSizing="dynamic">
          <mat-label>Payroll Year</mat-label>
          <input matInput type="number" [(ngModel)]="bulkYear" (change)="loadBulkPreview()" min="2020" max="2099">
        </mat-form-field>

        <button mat-flat-button color="primary" class="refresh-preview-btn" (click)="loadBulkPreview()"
                [disabled]="bulkLoading || isBulkMonthOngoing || isBulkMonthFuture"
                [matTooltip]="isBulkMonthOngoing ? 'Payroll calculation is locked until month-end' : (isBulkMonthFuture ? 'Cannot calculate payroll for future month' : 'Recalculate monthly payroll preview')">
          <mat-icon [class.spin-anim]="bulkLoading">{{ isBulkMonthOngoing ? 'lock' : 'refresh' }}</mat-icon>
          <span>{{ bulkLoading ? 'Calculating...' : (isBulkMonthOngoing ? 'Payroll Locked (In Progress)' : (isBulkMonthFuture ? 'Future Month (Locked)' : 'Load Payroll Preview')) }}</span>
        </button>
      </div>

      <!-- Quick Search & Status Filter -->
      <div class="bulk-filter-right">
        <div class="search-box">
          <mat-icon>search</mat-icon>
          <input type="text" [(ngModel)]="bulkSearchQuery" placeholder="Filter staff name, code, dept..." />
          <button mat-icon-button *ngIf="bulkSearchQuery" (click)="bulkSearchQuery = ''"><mat-icon>close</mat-icon></button>
        </div>

        <mat-form-field appearance="outline" class="bulk-status-filter" subscriptSizing="dynamic">
          <mat-label>Status Filter</mat-label>
          <mat-select [(ngModel)]="bulkStatusFilter">
            <mat-option value="all">All Staff</mat-option>
            <mat-option value="pending">Ready to Disburse</mat-option>
            <mat-option value="paid">Already Paid</mat-option>
            <mat-option value="missing">Missing Structure</mat-option>
          </mat-select>
        </mat-form-field>
      </div>
    </div>

    <!-- Ongoing Month Warning Banner in Bulk View -->
    <div class="month-status-banner ongoing-banner mat-elevation-z1" *ngIf="isBulkMonthOngoing">
      <div class="status-banner-icon"><mat-icon>lock_clock</mat-icon></div>
      <div class="status-banner-content">
        <h4>{{ months[bulkMonth - 1] }} {{ bulkYear }} Payroll is Locked (माह अभी जारी है)</h4>
        <p>
          Today is <strong>Day {{ bulkOngoingMonthInfo?.currentDay }} of {{ bulkOngoingMonthInfo?.totalDays }}</strong>. Monthly attendance register is currently in progress.
          Per standard institutional payroll rules, monthly payroll calculation will unlock on or after the last day of the month (<strong>{{ bulkOngoingMonthInfo?.totalDays }} {{ bulkOngoingMonthInfo?.monthName }} {{ bulkOngoingMonthInfo?.year }}</strong>).
          Please select a completed past month (e.g. <strong>{{ months[getDefaultPayrollMonth().month - 1] }} {{ getDefaultPayrollMonth().year }}</strong>) to review and disburse monthly staff salaries.
        </p>
      </div>
    </div>

    <!-- Future Month Warning Banner in Bulk View -->
    <div class="month-status-banner future-banner mat-elevation-z1" *ngIf="isBulkMonthFuture">
      <div class="status-banner-icon"><mat-icon>event_busy</mat-icon></div>
      <div class="status-banner-content">
        <h4>Future Month Selected (भविष्य का महीना)</h4>
        <p>Bulk salary disbursement cannot be processed for a future month. Please select a past completed month.</p>
      </div>
    </div>

    <!-- Bulk KPI Cards (Only for completed past months) -->
    <div class="stats-grid" *ngIf="bulkSummary && !isBulkMonthOngoing && !isBulkMonthFuture">
      <div class="stat-card total">
        <div class="stat-icon-wrap"><mat-icon>people</mat-icon></div>
        <div class="stat-data">
          <span class="stat-val">{{ bulkSummary.totalStaff }}</span>
          <span class="stat-lbl">Total Active Faculty</span>
        </div>
      </div>
      <div class="stat-card configured">
        <div class="stat-icon-wrap"><mat-icon>task_alt</mat-icon></div>
        <div class="stat-data">
          <span class="stat-val">{{ bulkSummary.alreadyPaidCount }}</span>
          <span class="stat-lbl">Already Paid ({{ months[bulkMonth - 1] }})</span>
        </div>
      </div>
      <div class="stat-card missing">
        <div class="stat-icon-wrap"><mat-icon>pending_actions</mat-icon></div>
        <div class="stat-data">
          <span class="stat-val">{{ bulkSummary.pendingCount }}</span>
          <span class="stat-lbl">Ready to Disburse</span>
        </div>
      </div>
      <div class="stat-card average">
        <div class="stat-icon-wrap"><mat-icon>account_balance_wallet</mat-icon></div>
        <div class="stat-data">
          <span class="stat-val">₹{{ bulkSummary.totalNetPayable | number:'1.0-0' }}</span>
          <span class="stat-lbl">Total Net Disbursement</span>
        </div>
      </div>
    </div>

    <!-- Bulk Action & Disbursement Banner (Only for completed past months) -->
    <mat-card class="bulk-action-card mat-elevation-z1" *ngIf="bulkSummary && !isBulkMonthOngoing && !isBulkMonthFuture">
      <div class="action-card-header">
        <div class="selection-indicator">
          <mat-checkbox
            [checked]="allEligibleSelected"
            [indeterminate]="hasSomeEligibleSelected"
            (change)="toggleSelectAll($event.checked)"
            color="primary"
          >
            <strong>Select All Eligible Pending Staff</strong>
          </mat-checkbox>
          <div class="selection-count-pill" *ngIf="selectedBulkStaff.length > 0">
            <mat-icon>check</mat-icon>
            <span><strong>{{ selectedBulkStaff.length }}</strong> Selected &bull; Total Net: <strong>₹{{ selectedTotalNet | number:'1.0-0' }}</strong></span>
          </div>
        </div>

        <div class="batch-disburse-btn-wrap">
          <button
            mat-raised-button
            color="primary"
            class="disburse-btn"
            [disabled]="selectedBulkStaff.length === 0 || bulkDisbursing || isBulkMonthOngoing || isBulkMonthFuture"
            [matTooltip]="isBulkMonthOngoing ? 'Cannot disburse salary for ongoing month until month-end' : (isBulkMonthFuture ? 'Cannot disburse salary for future month' : '')"
            (click)="disburseBulkPayments()"
          >
            <mat-icon>{{ bulkDisbursing ? 'hourglass_empty' : 'send_and_archive' }}</mat-icon>
            <span>{{ bulkDisbursing ? 'Processing Disbursement...' : 'Disburse Salary for ' + selectedBulkStaff.length + ' Staff' }}</span>
          </button>
        </div>
      </div>

      <!-- Batch Disbursement Settings Row -->
      <div class="batch-inputs-row">
        <mat-form-field appearance="outline" class="batch-input">
          <mat-label>Payment Date *</mat-label>
          <input matInput type="date" [(ngModel)]="bulkPaymentDate">
        </mat-form-field>

        <mat-form-field appearance="outline" class="batch-input">
          <mat-label>Payment Mode *</mat-label>
          <mat-select [(ngModel)]="bulkPaymentMode">
            <mat-option value="BankTransfer">Bank Transfer (NEFT/RTGS)</mat-option>
            <mat-option value="UPI">UPI</mat-option>
            <mat-option value="Cash">Cash</mat-option>
            <mat-option value="Cheque">Cheque</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="batch-input">
          <mat-label>Batch Transaction / UTR Ref</mat-label>
          <input matInput [(ngModel)]="bulkTransactionRef" placeholder="e.g. NEFT-BATCH-{{ bulkYear }}{{ bulkMonth }}">
        </mat-form-field>

        <mat-form-field appearance="outline" class="batch-input-wide">
          <mat-label>Disbursement Remarks</mat-label>
          <input matInput [(ngModel)]="bulkRemarks" placeholder="Monthly staff salary disbursement for {{ months[bulkMonth - 1] }} {{ bulkYear }}">
        </mat-form-field>
      </div>
    </mat-card>

    <!-- Bulk Staff Payroll Table (Only for completed past months) -->
    <mat-card class="table-card mat-elevation-z1" *ngIf="filteredBulkItems.length > 0 && !isBulkMonthOngoing && !isBulkMonthFuture">
      <div class="table-responsive">
        <table class="bulk-pay-table">
          <thead>
            <tr>
              <th style="width: 48px;" class="text-center">
                <mat-checkbox
                  [checked]="allEligibleSelected"
                  [indeterminate]="hasSomeEligibleSelected"
                  (change)="toggleSelectAll($event.checked)"
                  color="primary"
                  matTooltip="Toggle selection of all eligible pending faculty"
                ></mat-checkbox>
              </th>
              <th>Faculty Member</th>
              <th>Attendance &amp; Working Days</th>
              <th>Gross Amount</th>
              <th>Deductions</th>
              <th>Advance Adj.</th>
              <th>Net Payable</th>
              <th>Payment Status</th>
              <th class="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of filteredBulkItems" [class.row-paid]="item.isAlreadyPaid" [class.row-selected]="item.selected">
              <!-- Select Checkbox -->
              <td class="text-center">
                <mat-checkbox
                  [(ngModel)]="item.selected"
                  [disabled]="item.isAlreadyPaid || !item.hasSalaryStructure"
                  [matTooltip]="item.isAlreadyPaid ? 'Already paid for this month' : (!item.hasSalaryStructure ? 'Salary structure not configured' : 'Select to disburse')"
                  color="primary"
                ></mat-checkbox>
              </td>

              <!-- Faculty Details -->
              <td>
                <div class="staff-info-cell">
                  <div class="staff-avatar-initial">{{ item.teacherName.charAt(0) }}</div>
                  <div>
                    <div class="staff-primary-name clickable-link" (click)="quickSelectTeacher(item.teacherId)" matTooltip="Switch to individual view for this staff">
                      {{ item.teacherName }}
                    </div>
                    <div class="staff-secondary-meta">
                      <span class="code-badge">{{ item.employeeCode }}</span>
                      <span *ngIf="item.designation">{{ item.designation }}</span>
                      <span *ngIf="item.department">&bull; {{ item.department }}</span>
                    </div>
                  </div>
                </div>
              </td>

              <!-- Attendance Metrics -->
              <td>
                <div class="attendance-metrics-cell">
                  <span class="badge-working">{{ item.totalWorkingDays }} Total Days</span>
                  <div class="att-detail-row">
                    <span class="text-present"><strong>{{ item.presentDays }}</strong> Present</span>
                    <span class="text-absent" *ngIf="item.absentDays > 0">&bull; <strong>{{ item.absentDays }}</strong> Absent</span>
                  </div>
                </div>
              </td>

              <!-- Gross Salary -->
              <td>
                <span class="amount-cell">₹{{ item.grossAmount | number:'1.0-0' }}</span>
                <div *ngIf="(item.arrearsAmount || 0) > 0" class="arrears-pill" [matTooltip]="item.arrearsRemarks || 'Joining arrears'">
                  +₹{{ item.arrearsAmount | number:'1.0-0' }} Arr.
                </div>
              </td>

              <!-- Deductions Breakdown -->
              <td>
                <div class="deductions-cell">
                  <span class="ded-total" [class.red]="item.totalDeductions > 0">-₹{{ item.totalDeductions | number:'1.0-0' }}</span>
                  <small class="ded-breakdown" *ngIf="item.totalDeductions > 0">
                    <span *ngIf="item.attendanceDeductions > 0">Attn: ₹{{ item.attendanceDeductions | number:'1.0-0' }}</span>
                    <span *ngIf="item.statutoryDeductions > 0">&bull; PF/TDS: ₹{{ item.statutoryDeductions | number:'1.0-0' }}</span>
                  </small>
                </div>
              </td>

              <!-- Advance Adjusted -->
              <td>
                <span *ngIf="item.advanceAdjusted > 0" class="advance-adj-chip">
                  <mat-icon class="inline-icon">account_balance_wallet</mat-icon>
                  ₹{{ item.advanceAdjusted | number:'1.0-0' }}
                </span>
                <span *ngIf="item.advanceAdjusted === 0" style="color: #94a3b8;">₹0</span>
              </td>

              <!-- Net Payable -->
              <td>
                <strong class="net-payable-amount">₹{{ item.netPaid | number:'1.0-0' }}</strong>
              </td>

              <!-- Status Badge -->
              <td style="white-space: nowrap; min-width: 140px;">
                <span *ngIf="item.isAlreadyPaid" class="status-chip paid">
                  <mat-icon>check_circle</mat-icon> Paid ✓
                </span>
                <span *ngIf="!item.isAlreadyPaid && item.hasSalaryStructure" class="status-chip ready">
                  <mat-icon>pending</mat-icon> Ready to Disburse
                </span>
                <span *ngIf="!item.hasSalaryStructure" class="status-chip missing" matTooltip="Configure salary structure in Salary Structure tab">
                  <mat-icon>warning_amber</mat-icon> Missing Structure
                </span>
              </td>

              <!-- Row Action -->
              <td class="text-center">
                <button
                  *ngIf="item.isAlreadyPaid && item.paidPaymentId"
                  mat-flat-button
                  color="primary"
                  class="payslip-btn"
                  (click)="openPayslipForStaff(item)"
                  matTooltip="View &amp; Print Payslip"
                >
                  <mat-icon>receipt_long</mat-icon> Payslip
                </button>

                <button
                  *ngIf="!item.isAlreadyPaid"
                  mat-stroked-button
                  class="single-jump-btn"
                  (click)="quickSelectTeacher(item.teacherId)"
                  matTooltip="Open individual staff payment workspace"
                >
                  <mat-icon>edit_calendar</mat-icon> Individual
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </mat-card>

    <!-- Empty Table State -->
    <div class="empty-state" *ngIf="filteredBulkItems.length === 0 && !bulkLoading && bulkSummary && !isBulkMonthOngoing && !isBulkMonthFuture">
      <mat-icon>search_off</mat-icon>
      <p>No faculty members match the current filter criteria for {{ months[bulkMonth - 1] }} {{ bulkYear }}.</p>
    </div>
  </div>
</div>
  `,
  styles: [`
    .page-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Page Header */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;

      .header-left {
        display: flex;
        align-items: center;
        gap: 14px;

        .header-icon-box {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: #2563eb;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
          mat-icon { font-size: 26px; width: 26px; height: 26px; }
        }

        .page-title {
          font-size: 1.45rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          line-height: 1.2;
        }

        .page-subtitle {
          color: #64748b;
          margin: 3px 0 0;
          font-size: 0.85rem;
        }
      }

      /* Mode Selector Pills */
      .mode-pills {
        display: flex;
        background: #f1f5f9;
        padding: 4px;
        border-radius: 12px;
        gap: 4px;

        .mode-pill {
          border: none;
          background: transparent;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 0.82rem;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;

          mat-icon { font-size: 18px; width: 18px; height: 18px; color: #64748b; }

          &:hover { color: #0f172a; }

          &.active {
            background: #ffffff;
            color: #2563eb;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
            mat-icon { color: #2563eb; }
          }

          .badge-pill {
            background: #eff6ff;
            color: #2563eb;
            font-size: 0.7rem;
            padding: 1px 7px;
            border-radius: 8px;
            font-weight: 700;
            border: 1px solid #bfdbfe;
          }
        }
      }
    }

    /* KPI Summary Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      width: 100%;
    }

    .stat-card {
      background: #ffffff;
      border-radius: 12px;
      padding: 12px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
      min-width: 0;

      .stat-icon-wrap {
        width: 42px;
        height: 42px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        mat-icon { font-size: 22px; width: 22px; height: 22px; color: #ffffff; }
      }

      .stat-data {
        display: flex;
        flex-direction: column;
        .stat-val { font-size: 1.45rem; font-weight: 800; color: #0f172a; line-height: 1.2; }
        .stat-lbl { font-size: 0.76rem; color: #64748b; font-weight: 600; margin-top: 2px; }
      }

      &.total .stat-icon-wrap { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); }
      &.configured .stat-icon-wrap { background: linear-gradient(135deg, #10b981 0%, #047857 100%); }
      &.missing .stat-icon-wrap { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
      &.average .stat-icon-wrap { background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); }
    }

    @media (max-width: 900px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    /* Single View Workspace */
    .single-view-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .no-selection {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 60px;
      color: #94a3b8;
      background: #f8fafc;
      border-radius: 12px;
      mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 12px; }
      p { margin: 0; font-size: 0.95rem; }
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
      margin-bottom: 12px;

      .section-hdr-left {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        h3 { margin: 0; font-weight: 700; font-size: 1.1rem; color: #0f172a; }
        .staff-sub-badge { font-size: 0.8rem; color: #64748b; font-weight: 500; }
      }
    }

    .form-card {
      padding: 24px;
      border-radius: 12px;
      margin-top: 8px;
      margin-bottom: 20px;
    }

    /* Smart Payroll Banner */
    .payroll-preview-banner {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      transition: background 0.3s, border-color 0.3s;

      &.applied-banner {
        background: #f0fdf4;
        border-color: #4ade80;
      }
    }

    .banner-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }

    .banner-title {
      display: flex;
      align-items: center;
      gap: 10px;
      mat-icon { font-size: 24px; width: 24px; height: 24px; color: #16a34a; }
      strong { font-size: 1rem; color: #14532d; display: block; }
      p { margin: 2px 0 0; font-size: .8rem; color: #166534; }
    }

    .banner-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
    }

    .stat-box {
      background: #ffffff;
      border: 1px solid #dcfce7;
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      .lbl { font-size: .72rem; color: #64748b; font-weight: 600; text-transform: uppercase; }
      .num { font-size: 1.05rem; font-weight: 800; color: #1e293b; }
      small { font-size: .72rem; color: #64748b; }
      .red { color: #b91c1c; font-weight: 700; }
      .green { color: #15803d; font-weight: 700; }
      &.highlight-warn { border-color: #fdba74; background: #fff7ed; }
      &.net-box { border-color: #86efac; background: #f0fdf4; .num.net { color: #15803d; font-size: 1.2rem; } }
    }

    .advance-box {
      border: 2px solid #fbbf24 !important;
      background: #fffbeb !important;
      .advance-lbl { display: flex; align-items: center; gap: 4px; color: #92400e !important; }
      .adv-icon { font-size: 14px; width: 14px; height: 14px; color: #d97706; }
      .advance-num { color: #b45309 !important; font-size: 1.1rem !important; }
    }

    .arrears-pill {
      display: inline-block;
      margin-top: 3px;
      font-size: 0.72rem;
      font-weight: 700;
      color: #047857;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 4px;
      padding: 1px 6px;
      line-height: 1.3;
    }

    .hint-arrears {
      color: #047857 !important;
      font-size: 0.72rem !important;
      white-space: nowrap !important;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
      max-width: 100%;
    }

    .advance-detail-strip {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      background: #fef3c7;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 0.82rem;
      color: #78350f;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #d97706; flex-shrink: 0; margin-top: 1px; }
      strong { color: #92400e; }
    }

    .no-preview-warn {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 16px;
      font-size: .9rem;
      color: #9a3412;
      mat-icon { color: #ea580c; font-size: 22px; width: 22px; height: 22px; }
    }

    /* Month Status Banners */
    .month-status-banner {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      border-radius: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;

      &.ongoing-banner {
        background: #f0f9ff;
        border: 1.5px solid #7dd3fc;
        .status-banner-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: #e0f2fe;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          mat-icon { color: #0284c7; font-size: 26px; width: 26px; height: 26px; }
        }
        .status-banner-content {
          flex: 1;
          h4 { margin: 0 0 4px; font-size: 0.96rem; font-weight: 700; color: #0369a1; }
          p { margin: 0; font-size: 0.83rem; color: #075985; line-height: 1.4; strong { color: #0369a1; } }
        }
      }

      &.future-banner {
        background: #fef2f2;
        border: 1.5px solid #fca5a5;
        .status-banner-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: #fee2e2;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          mat-icon { color: #dc2626; font-size: 26px; width: 26px; height: 26px; }
        }
        .status-banner-content {
          flex: 1;
          h4 { margin: 0 0 4px; font-size: 0.96rem; font-weight: 700; color: #991b1b; }
          p { margin: 0; font-size: 0.83rem; color: #7f1d1d; line-height: 1.4; }
        }
      }
    }

    /* Missing Salary Card */
    .missing-salary-card {
      background: #fffbeb;
      border: 1.5px solid #fcd34d;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;

      .missing-salary-icon-wrap {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        background: #fef3c7;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        mat-icon { color: #d97706; font-size: 26px; width: 26px; height: 26px; }
      }

      .missing-salary-content {
        flex: 1;
        min-width: 250px;
        h4 {
          margin: 0 0 4px;
          font-size: 0.96rem;
          font-weight: 700;
          color: #92400e;
        }
        p {
          margin: 0;
          font-size: 0.83rem;
          color: #78350f;
          line-height: 1.4;
          strong { color: #92400e; }
        }
      }

      .config-now-btn {
        font-weight: 700;
        border-radius: 8px;
        background: #2563eb;
        color: #ffffff;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
    }

    .missing-header-chip {
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fde68a;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.76rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      cursor: pointer;
      transition: all 0.2s ease;
      mat-icon { font-size: 15px; width: 15px; height: 15px; color: #d97706; }
      &:hover {
        background: #fde68a;
        color: #78350f;
      }
    }

    .autofill-btn {
      font-weight: 700;
      border-radius: 8px;
      background: #1976d2;
      color: #fff;
      &.applied { background: #16a34a !important; color: #fff !important; }
    }

    .hint-advance { color: #d97706 !important; font-size: 0.72rem; white-space: nowrap; text-align: left; }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      column-gap: 16px;
      row-gap: 20px;
      align-items: start;
    }

    .single-line-hint {
      font-size: 0.73rem !important;
      white-space: nowrap !important;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #64748b;
    }

    .remarks-col-4 { grid-column: span 4; width: 100%; }

    @media (max-width: 1200px) {
      .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .remarks-col-4 { grid-column: span 2; }
    }

    @media (max-width: 600px) {
      .form-grid { grid-template-columns: 1fr; }
      .remarks-col-4 { grid-column: 1 / -1; }
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      margin-top: 8px;
      flex-wrap: wrap;
    }

    .mandatory-hint {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #b45309;
      background: #fef3c7;
      border: 1px solid #fde68a;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 0.84rem;
      margin-right: auto;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #d97706; }
      &.warn-hint {
        color: #991b1b;
        background: #fef2f2;
        border-color: #fecaca;
        mat-icon { color: #dc2626; }
      }
      &.success-hint {
        color: #15803d;
        background: #dcfce7;
        border-color: #bbf7d0;
        mat-icon { color: #16a34a; }
      }
    }

    /* Common Table Styling */
    .table-card {
      border-radius: 12px;
      overflow: hidden;
      padding: 0;
      border: 1px solid #e2e8f0;
    }

    .table-responsive {
      overflow-x: auto;
      width: 100%;
    }

    .pay-table, .bulk-pay-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;

      th, td {
        padding: 12px 14px;
        border-bottom: 1px solid #f1f5f9;
        text-align: left;
      }

      th {
        background: #f8fafc;
        font-weight: 700;
        color: #475569;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        border-bottom: 1px solid #e2e8f0;
      }

      tr:last-child td { border-bottom: none; }
      tr:hover td { background: #f8fafc; }
      tr.row-selected td { background: #f0fdf4; }
      tr.row-paid td { background: #fdfdfd; opacity: 0.9; }
    }

    .net-amount { color: #15803d; }
    .mode-chip { background: #e8eaf6; color: #3949ab; font-size: .72rem; padding: 2px 8px; border-radius: 8px; font-weight: 600; }

    .advance-adj-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #fef3c7;
      color: #92400e;
      font-size: .72rem;
      padding: 2px 8px;
      border-radius: 8px;
      font-weight: 600;
      border: 1px solid #fde68a;
      .inline-icon { font-size: 12px; width: 12px; height: 12px; }
    }

    .receipt-tag {
      background: #e3f2fd;
      color: #1565c0;
      font-size: .72rem;
      padding: 3px 8px;
      border-radius: 8px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      &.clickable {
        cursor: pointer;
        transition: all .15s;
        &:hover { background: #bbdefb; color: #0d47a1; text-decoration: underline; }
      }
    }

    .inline-icon { font-size: 14px; width: 14px; height: 14px; }

    .payslip-btn {
      font-size: .75rem !important;
      height: 32px !important;
      line-height: 32px !important;
      padding: 0 12px !important;
      border-radius: 6px;
      box-shadow: none !important;
      mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
    }

    .single-jump-btn {
      font-size: .75rem !important;
      height: 32px !important;
      line-height: 32px !important;
      padding: 0 10px !important;
      border-radius: 6px;
      border-color: #cbd5e1 !important;
      color: #475569 !important;
      mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; color: #64748b; }
      &:hover { background: #f1f5f9; color: #0f172a !important; }
    }

    .text-center { text-align: center; }

    .summary-bar {
      margin-top: 4px;
      padding: 14px 22px;
      border-radius: 10px;
      display: flex;
      gap: 32px;
      flex-wrap: wrap;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      align-items: center;
      span { font-size: .9rem; color: #64748b; }
      strong { color: #1e293b; font-size: .95rem; }
      .green { color: #16a34a; font-weight: 700; font-size: 1.05rem; }
      .orange { color: #d97706; font-weight: 700; }
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
      color: #94a3b8;
      background: #f8fafc;
      border-radius: 12px;
      mat-icon { font-size: 40px; width: 40px; height: 40px; margin-bottom: 8px; }
      p { margin: 0; }
    }

    .exited-notice {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #fef2f2;
      border: 1.5px solid #fca5a5;
      border-radius: 8px;
      margin-bottom: 12px;
      mat-icon { font-size: 24px; width: 24px; height: 24px; color: #dc2626; flex-shrink: 0; }
      strong { display: block; color: #991b1b; font-size: 0.9rem; }
      p { margin: 2px 0 0; color: #b91c1c; font-size: 0.8rem; }
    }

    /* ========================================================================= */
    /* BULK MODE SPECIFIC STYLES */
    /* ========================================================================= */
    .bulk-view-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .bulk-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      background: #ffffff;
      padding: 12px 16px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;

      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none !important;
      }
      ::ng-deep .mat-mdc-form-field-bottom-align::before {
        display: none !important;
      }

      .bulk-filter-controls {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;

        .bulk-select-field { width: 160px; margin-bottom: 0; }
        .bulk-year-field { width: 120px; margin-bottom: 0; }
        .refresh-preview-btn {
          height: 48px;
          border-radius: 8px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          align-self: center;
          mat-icon { font-size: 20px; width: 20px; height: 20px; }
        }
      }

      .bulk-filter-right {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;

        .search-box {
          display: flex;
          align-items: center;
          background: #f1f5f9;
          border-radius: 8px;
          padding: 0 8px 0 12px;
          height: 48px;
          box-sizing: border-box;
          border: 1px solid #e2e8f0;
          align-self: center;

          mat-icon { color: #94a3b8; font-size: 20px; width: 20px; height: 20px; margin-right: 6px; }
          input {
            border: none;
            background: transparent;
            outline: none;
            font-size: 0.85rem;
            color: #0f172a;
            width: 200px;
          }
          button { width: 32px; height: 32px; mat-icon { font-size: 16px; } }
        }

        .bulk-status-filter { width: 170px; margin-bottom: 0; }
      }
    }

    /* Bulk Action & Settings Card */
    .bulk-action-card {
      padding: 16px 20px;
      border-radius: 12px;
      border: 1.5px solid #bfdbfe;
      background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%);
      display: flex;
      flex-direction: column;
      gap: 14px;

      .action-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;

        .selection-indicator {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;

          .selection-count-pill {
            background: #dcfce7;
            color: #15803d;
            border: 1px solid #86efac;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.82rem;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            mat-icon { font-size: 16px; width: 16px; height: 16px; }
          }
        }

        .disburse-btn {
          height: 44px;
          font-weight: 700;
          font-size: 0.9rem;
          border-radius: 8px;
          padding: 0 20px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          mat-icon { font-size: 20px; width: 20px; height: 20px; }
        }
      }

      .batch-inputs-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        align-items: start;
        margin-top: 4px;

        .batch-input { width: 100%; }
        .batch-input-wide { width: 100%; }
      }
    }

    @media (max-width: 900px) {
      .bulk-action-card .batch-inputs-row {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 600px) {
      .bulk-action-card .batch-inputs-row {
        grid-template-columns: 1fr;
      }
    }

    /* Bulk Table Cell Details */
    .staff-info-cell {
      display: flex;
      align-items: center;
      gap: 10px;

      .staff-avatar-initial {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        background: #e2e8f0;
        color: #1e293b;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.9rem;
        flex-shrink: 0;
      }

      .staff-primary-name {
        font-weight: 700;
        color: #0f172a;
        font-size: 0.88rem;
        &.clickable-link {
          cursor: pointer;
          &:hover { color: #2563eb; text-decoration: underline; }
        }
      }

      .staff-secondary-meta {
        font-size: 0.74rem;
        color: #64748b;
        display: flex;
        align-items: center;
        gap: 5px;
        margin-top: 1px;

        .code-badge {
          background: #f1f5f9;
          padding: 1px 5px;
          border-radius: 4px;
          font-weight: 600;
          color: #334155;
        }
      }
    }

    .attendance-metrics-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .badge-working {
        font-size: 0.75rem;
        font-weight: 700;
        color: #334155;
      }

      .att-detail-row {
        font-size: 0.72rem;
        color: #64748b;
        display: flex;
        gap: 4px;

        .text-present { color: #16a34a; }
        .text-absent { color: #dc2626; }
      }
    }

    .amount-cell {
      font-weight: 700;
      color: #1e293b;
      font-size: 0.9rem;
    }

    .deductions-cell {
      display: flex;
      flex-direction: column;
      gap: 1px;

      .ded-total {
        font-weight: 700;
        font-size: 0.88rem;
        color: #64748b;
        &.red { color: #b91c1c; }
      }

      .ded-breakdown {
        font-size: 0.7rem;
        color: #94a3b8;
      }
    }

    .net-payable-amount {
      color: #15803d;
      font-size: 0.98rem;
      font-weight: 800;
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.74rem;
      font-weight: 700;
      white-space: nowrap;
      line-height: 1;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        min-width: 16px;
        min-height: 16px;
        line-height: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        overflow: visible;
        vertical-align: middle;
      }

      &.paid {
        background: #dcfce7;
        color: #15803d;
        border: 1px solid #86efac;
      }

      &.ready {
        background: #dbeafe;
        color: #1d4ed8;
        border: 1px solid #93c5fd;
      }

      &.missing {
        background: #fef3c7;
        color: #b45309;
        border: 1px solid #fde68a;
      }
    }

    .spin-anim {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }
  `]
})
export class TeacherPaymentsComponent implements OnInit {
  private api = API_BASE;

  // View Mode: 'single' (individual faculty) vs 'bulk' (monthly payroll run)
  viewMode: 'single' | 'bulk' = 'single';

  // Individual mode state
  selectedTeacher: TeacherDto | null = null;
  preSelectId: string | null = null;
  payments: SalaryPaymentDto[] = [];
  preview: PayrollPreviewDto | null = null;
  pendingAdvances: AdvanceDto[] = [];
  loading = false;
  showForm = false;
  saving = false;
  previewLoading = false;
  calculationsApplied = false;
  paymentForm!: FormGroup;

  // Bulk mode state (Defaults to previous completed month)
  bulkMonth: number = new Date().getMonth() === 0 ? 12 : new Date().getMonth();
  bulkYear: number = new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear();
  bulkPaymentDate: string = new Date().toISOString().split('T')[0];
  bulkPaymentMode: string = 'BankTransfer';
  bulkTransactionRef: string = '';
  bulkRemarks: string = '';
  bulkSummary: MonthlyPayrollSummaryDto | null = null;
  bulkLoading = false;
  bulkDisbursing = false;
  bulkSearchQuery = '';
  bulkStatusFilter: 'all' | 'pending' | 'paid' | 'missing' = 'all';

  months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  get totalPaid()            { return this.payments.reduce((s, p) => s + p.netPaid, 0); }
  get totalGross()           { return this.payments.reduce((s, p) => s + p.grossAmount, 0); }
  get totalAdvanceAdjusted() { return this.payments.reduce((s, p) => s + p.advanceAdjusted, 0); }

  get hasSalaryConfigured(): boolean {
    return !!this.preview && (this.preview.grossSalary || 0) > 0;
  }

  // Standard Institutional Rule: Default month is previous completed month (unless today is >= last day of month)
  getDefaultPayrollMonth(): { month: number, year: number } {
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth() + 1; // 1-12
    const curDate = today.getDate();
    const lastDayOfCurMonth = new Date(curYear, curMonth, 0).getDate();

    if (curDate >= lastDayOfCurMonth) {
      return { month: curMonth, year: curYear };
    }
    if (curMonth === 1) {
      return { month: 12, year: curYear - 1 };
    }
    return { month: curMonth - 1, year: curYear };
  }

  // Returns: 'past' | 'ongoing' | 'future'
  getMonthStatus(month: number, year: number): 'past' | 'ongoing' | 'future' {
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth() + 1;
    const curDate = today.getDate();

    if (year > curYear || (year === curYear && month > curMonth)) {
      return 'future';
    }
    if (year === curYear && month === curMonth) {
      const lastDayOfCurMonth = new Date(curYear, curMonth, 0).getDate();
      if (curDate < lastDayOfCurMonth) {
        return 'ongoing';
      }
      return 'past';
    }
    return 'past';
  }

  get isSelectedMonthOngoing(): boolean {
    const m = this.paymentForm?.get('paymentMonth')?.value;
    const y = this.paymentForm?.get('paymentYear')?.value;
    if (!m || !y) return false;
    return this.getMonthStatus(m, y) === 'ongoing';
  }

  get isSelectedMonthFuture(): boolean {
    const m = this.paymentForm?.get('paymentMonth')?.value;
    const y = this.paymentForm?.get('paymentYear')?.value;
    if (!m || !y) return false;
    return this.getMonthStatus(m, y) === 'future';
  }

  get ongoingMonthInfo(): { currentDay: number, totalDays: number, monthName: string, year: number } | null {
    const m = this.paymentForm?.get('paymentMonth')?.value;
    const y = this.paymentForm?.get('paymentYear')?.value;
    if (!m || !y || this.getMonthStatus(m, y) !== 'ongoing') return null;
    const today = new Date();
    const totalDays = new Date(y, m, 0).getDate();
    return {
      currentDay: today.getDate(),
      totalDays,
      monthName: this.months[m - 1],
      year: y
    };
  }

  get isBulkMonthOngoing(): boolean {
    return this.getMonthStatus(this.bulkMonth, this.bulkYear) === 'ongoing';
  }

  get isBulkMonthFuture(): boolean {
    return this.getMonthStatus(this.bulkMonth, this.bulkYear) === 'future';
  }

  get bulkOngoingMonthInfo(): { currentDay: number, totalDays: number, monthName: string, year: number } | null {
    if (!this.isBulkMonthOngoing) return null;
    const today = new Date();
    const totalDays = new Date(this.bulkYear, this.bulkMonth, 0).getDate();
    return {
      currentDay: today.getDate(),
      totalDays,
      monthName: this.months[this.bulkMonth - 1],
      year: this.bulkYear
    };
  }

  goToSalaryStructure() {
    if (!this.selectedTeacher) return;
    this.router.navigate(['/teachers/salary'], {
      queryParams: { teacherId: this.selectedTeacher.id }
    });
  }

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private confirmDialog: ConfirmDialogService,
    private dialog: MatDialog,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(p => {
      if (p['teacherId']) {
        this.preSelectId = p['teacherId'];
        this.viewMode = 'single';
      }
      if (p['mode'] === 'bulk') {
        this.viewMode = 'bulk';
      }
    });

    const def = this.getDefaultPayrollMonth();
    this.bulkMonth = def.month;
    this.bulkYear = def.year;

    const today = new Date().toISOString().split('T')[0];
    this.paymentForm = this.fb.group({
      paymentMonth: [def.month, Validators.required],
      paymentYear: [def.year, [Validators.required, Validators.min(2020), Validators.max(2099)]],
      grossAmount:      [0, [Validators.required, Validators.min(0)]],
      arrearsAmount:    [0, [Validators.min(0)]],
      arrearsRemarks:   [''],
      deductions:       [0, [Validators.min(0)]],
      advanceAdjusted:  [0, [Validators.min(0)]],
      netPaid:          [0, [Validators.required, Validators.min(0)]],
      paymentMode:      ['Cash', Validators.required],
      transactionRef:   [''],
      presentDays:      [0, Validators.min(0)],
      absentDays:       [0, Validators.min(0)],
      remarks:          [''],
      paymentDate:      [today, Validators.required]
    });

    // Reset calculations when month/year change
    this.paymentForm.get('paymentMonth')?.valueChanges.subscribe(() => {
      this.calculationsApplied = false;
      this.loadPreview();
    });
    this.paymentForm.get('paymentYear')?.valueChanges.subscribe(() => {
      this.calculationsApplied = false;
      this.loadPreview();
    });

    // Auto-recalculate netPaid whenever gross/arrears/deductions/advance change
    const recalcNet = () => {
      const g = Number(this.paymentForm.get('grossAmount')?.value) || 0;
      const arr = Number(this.paymentForm.get('arrearsAmount')?.value) || 0;
      const d = Number(this.paymentForm.get('deductions')?.value) || 0;
      const a = Number(this.paymentForm.get('advanceAdjusted')?.value) || 0;
      const totalEarned = g + arr;

      // Validate: advance cannot exceed total earned (gross + arrears)
      if (a > totalEarned && totalEarned > 0) {
        this.paymentForm.get('advanceAdjusted')?.setErrors({ advanceExceedsGross: true });
      } else {
        const existingErrors = this.paymentForm.get('advanceAdjusted')?.errors;
        if (existingErrors?.['advanceExceedsGross']) {
          delete existingErrors['advanceExceedsGross'];
          const remaining = Object.keys(existingErrors).length === 0 ? null : existingErrors;
          this.paymentForm.get('advanceAdjusted')?.setErrors(remaining);
        }
      }

      const net = Math.max(0, totalEarned - d - a);
      this.paymentForm.get('netPaid')?.setValue(net, { emitEvent: false });
    };
    this.paymentForm.get('grossAmount')?.valueChanges.subscribe(recalcNet);
    this.paymentForm.get('arrearsAmount')?.valueChanges.subscribe(recalcNet);
    this.paymentForm.get('deductions')?.valueChanges.subscribe(recalcNet);
    this.paymentForm.get('advanceAdjusted')?.valueChanges.subscribe(recalcNet);

    // Initial bulk load in background so stats pill displays count
    this.loadBulkPreview();
  }

  // -------------------------------------------------------------
  // Mode Switching
  // -------------------------------------------------------------
  switchViewMode(mode: 'single' | 'bulk') {
    this.viewMode = mode;
    if (mode === 'bulk' && !this.bulkSummary) {
      this.loadBulkPreview();
    }
  }

  quickSelectTeacher(teacherId: string) {
    this.viewMode = 'single';
    this.preSelectId = teacherId;
    this.http.get<TeacherDto>(`${this.api}/teachers/${teacherId}`).subscribe({
      next: t => {
        this.onTeacherSelected(t);
      }
    });
  }

  // -------------------------------------------------------------
  // Bulk Mode Calculations & Methods
  // -------------------------------------------------------------
  get filteredBulkItems(): MonthlyPayrollStaffItemDto[] {
    if (!this.bulkSummary?.items) return [];
    let list = this.bulkSummary.items;

    if (this.bulkSearchQuery?.trim()) {
      const q = this.bulkSearchQuery.trim().toLowerCase();
      list = list.filter(i =>
        i.teacherName.toLowerCase().includes(q) ||
        i.employeeCode.toLowerCase().includes(q) ||
        (i.designation && i.designation.toLowerCase().includes(q)) ||
        (i.department && i.department.toLowerCase().includes(q))
      );
    }

    if (this.bulkStatusFilter === 'pending') {
      list = list.filter(i => !i.isAlreadyPaid && i.hasSalaryStructure);
    } else if (this.bulkStatusFilter === 'paid') {
      list = list.filter(i => i.isAlreadyPaid);
    } else if (this.bulkStatusFilter === 'missing') {
      list = list.filter(i => !i.hasSalaryStructure);
    }

    return list;
  }

  get selectedBulkStaff(): MonthlyPayrollStaffItemDto[] {
    return this.bulkSummary?.items.filter(i => i.selected && !i.isAlreadyPaid && i.hasSalaryStructure) || [];
  }

  get selectedTotalGross(): number {
    return this.selectedBulkStaff.reduce((s, i) => s + i.grossAmount, 0);
  }

  get selectedTotalDeductions(): number {
    return this.selectedBulkStaff.reduce((s, i) => s + i.totalDeductions, 0);
  }

  get selectedTotalNet(): number {
    return this.selectedBulkStaff.reduce((s, i) => s + i.netPaid, 0);
  }

  get allEligibleSelected(): boolean {
    const eligible = this.filteredBulkItems.filter(i => !i.isAlreadyPaid && i.hasSalaryStructure);
    return eligible.length > 0 && eligible.every(i => i.selected);
  }

  get hasSomeEligibleSelected(): boolean {
    const eligible = this.filteredBulkItems.filter(i => !i.isAlreadyPaid && i.hasSalaryStructure);
    const selectedCount = eligible.filter(i => i.selected).length;
    return selectedCount > 0 && selectedCount < eligible.length;
  }

  toggleSelectAll(checked: boolean) {
    this.filteredBulkItems.forEach(i => {
      if (!i.isAlreadyPaid && i.hasSalaryStructure) {
        i.selected = checked;
      }
    });
  }

  loadBulkPreview() {
    if (!this.bulkMonth || !this.bulkYear) return;
    if (this.isBulkMonthOngoing || this.isBulkMonthFuture) {
      this.bulkSummary = null;
      this.bulkLoading = false;
      return;
    }
    this.bulkLoading = true;
    this.http.get<MonthlyPayrollSummaryDto>(
      `${this.api}/teachers/monthly-payroll-preview?month=${this.bulkMonth}&year=${this.bulkYear}`
    ).subscribe({
      next: res => {
        this.bulkSummary = res;
        // Auto-select eligible pending staff by default for ease of disbursement
        this.bulkSummary.items.forEach(i => {
          i.selected = !i.isAlreadyPaid && i.hasSalaryStructure;
        });
        this.bulkLoading = false;
      },
      error: err => {
        this.bulkLoading = false;
        this.confirmDialog.alert('Preview Error', err?.error?.message || 'Failed to load monthly payroll calculation preview.', 'danger');
      }
    });
  }

  disburseBulkPayments() {
    if (this.isBulkMonthOngoing) {
      this.confirmDialog.alert(
        'Month In Progress',
        `Cannot disburse bulk salary: ${this.bulkOngoingMonthInfo?.monthName} ${this.bulkOngoingMonthInfo?.year} is currently in progress. Bulk disbursement is locked until the last day of the month.`,
        'warning'
      );
      return;
    }
    if (this.isBulkMonthFuture) {
      this.confirmDialog.alert(
        'Future Month',
        'Cannot disburse salary for a future month.',
        'warning'
      );
      return;
    }

    const selected = this.selectedBulkStaff;
    if (selected.length === 0) {
      this.confirmDialog.alert('No Staff Selected', 'Please select at least one eligible staff member to disburse salary.', 'warning');
      return;
    }

    const totalAmount = this.selectedTotalNet;
    const monthName = this.months[this.bulkMonth - 1];

    this.confirmDialog.confirm(
      'Confirm Bulk Payroll Disbursement',
      `Are you sure you want to disburse monthly salary for ${selected.length} staff member(s) for ${monthName} ${this.bulkYear}?\n\nTotal Net Disbursement: ₹${totalAmount.toLocaleString('en-IN')}\nPayment Mode: ${this.bulkPaymentMode}\nPayment Date: ${this.bulkPaymentDate}`,
      'Yes, Disburse Now',
      'Cancel',
      'info'
    ).subscribe(confirmed => {
      if (confirmed) {
        this.bulkDisbursing = true;
        const payload: BulkSalaryPaymentRequestDto = {
          paymentMonth: this.bulkMonth,
          paymentYear: this.bulkYear,
          paymentDate: this.bulkPaymentDate,
          paymentMode: this.bulkPaymentMode,
          transactionRef: this.bulkTransactionRef?.trim() || undefined,
          remarks: this.bulkRemarks?.trim() || `Monthly staff payroll disbursement for ${monthName} ${this.bulkYear}`,
          payments: selected.map(s => ({
            teacherId: s.teacherId,
            grossAmount: s.grossAmount,
            arrearsAmount: s.arrearsAmount || 0,
            arrearsRemarks: s.arrearsRemarks || undefined,
            deductions: s.totalDeductions,
            advanceAdjusted: s.advanceAdjusted,
            netPaid: s.netPaid,
            presentDays: s.presentDays,
            absentDays: s.absentDays,
            transactionRef: this.bulkTransactionRef?.trim() || undefined,
            remarks: undefined
          }))
        };

        this.http.post<any>(`${this.api}/teachers/bulk-salary-payments`, payload).subscribe({
          next: (res) => {
            this.bulkDisbursing = false;
            this.confirmDialog.alert(
              'Disbursement Successful ✓',
              res?.message || `Successfully disbursed salary for ${res?.successCount || selected.length} staff member(s).`,
              'success'
            );
            this.loadBulkPreview();
          },
          error: (err) => {
            this.bulkDisbursing = false;
            this.confirmDialog.alert(
              'Disbursement Failed',
              err?.error?.message || 'Failed to process bulk salary payments. Please try again.',
              'danger'
            );
          }
        });
      }
    });
  }

  openPayslipForStaff(item: MonthlyPayrollStaffItemDto) {
    if (!item.paidPaymentId) return;
    this.bulkLoading = true;
    this.http.get<TeacherDto>(`${this.api}/teachers/${item.teacherId}`).subscribe({
      next: teacher => {
        this.http.get<SalaryPaymentDto[]>(`${this.api}/teachers/${item.teacherId}/salary-payments`).subscribe({
          next: payments => {
            this.bulkLoading = false;
            const match = payments.find(p => p.id === item.paidPaymentId) || payments[0];
            if (match) {
              this.dialog.open(TeacherPayslipDialogComponent, {
                width: '860px',
                maxWidth: '96vw',
                autoFocus: false,
                panelClass: 'payslip-dialog-panel',
                data: {
                  payment: match,
                  teacher: teacher,
                  instituteName: this.authService.currentUser()?.instituteName || 'Apex Coaching Academy',
                  branchName: this.authService.getCurrentBranchName()
                }
              });
            } else {
              this.confirmDialog.alert('Payslip Not Found', 'Could not locate matching payment voucher for this staff.', 'warning');
            }
          },
          error: () => {
            this.bulkLoading = false;
            this.confirmDialog.alert('Error', 'Failed to retrieve payment record.', 'danger');
          }
        });
      },
      error: () => {
        this.bulkLoading = false;
        this.confirmDialog.alert('Error', 'Failed to retrieve staff member record.', 'danger');
      }
    });
  }

  // -------------------------------------------------------------
  // Single Staff View Methods
  // -------------------------------------------------------------
  onTeacherSelected(t: TeacherDto) {
    this.selectedTeacher = t;
    this.calculationsApplied = false;
    this.preview = null;
    this.pendingAdvances = [];
    this.paymentForm.patchValue({
      grossAmount: 0,
      arrearsAmount: 0,
      arrearsRemarks: '',
      deductions: 0,
      advanceAdjusted: 0,
      netPaid: 0,
      presentDays: 0,
      absentDays: 0,
      remarks: ''
    }, { emitEvent: false });
    this.loadPayments();
    this.loadPreview();
  }

  toggleForm() {
    this.showForm = !this.showForm;
    this.calculationsApplied = false;
    if (this.showForm) {
      this.paymentForm.patchValue({
        grossAmount: 0, arrearsAmount: 0, arrearsRemarks: '', deductions: 0, advanceAdjusted: 0, netPaid: 0,
        presentDays: 0, absentDays: 0, remarks: ''
      }, { emitEvent: false });
      this.loadPreview();
    }
  }

  loadPreview() {
    if (!this.selectedTeacher) return;
    const m = this.paymentForm.get('paymentMonth')?.value;
    const y = this.paymentForm.get('paymentYear')?.value;
    if (!m || !y) return;
    if (this.isSelectedMonthOngoing || this.isSelectedMonthFuture) {
      this.preview = null;
      this.previewLoading = false;
      this.pendingAdvances = [];
      return;
    }
    this.previewLoading = true;
    this.preview = null;
    this.pendingAdvances = [];

    this.http.get<PayrollPreviewDto>(`${this.api}/teachers/${this.selectedTeacher.id}/salary-preview?month=${m}&year=${y}`).subscribe({
      next: p => {
        this.preview = p;
        this.previewLoading = false;
        if (p.pendingAdvance > 0) {
          this.loadPendingAdvances();
        }
      },
      error: () => {
        this.preview = null;
        this.previewLoading = false;
      }
    });
  }

  loadPendingAdvances() {
    if (!this.selectedTeacher) return;
    this.http.get<AdvanceDto[]>(`${this.api}/teachers/${this.selectedTeacher.id}/advances`).subscribe({
      next: list => {
        this.pendingAdvances = list.filter(a => a.status === 'Approved');
      },
      error: () => { this.pendingAdvances = []; }
    });
  }

  applyPreviewToForm() {
    if (!this.hasSalaryConfigured) {
      this.confirmDialog.alert(
        'Salary Structure Not Configured',
        `Salary structure is not configured for ${this.selectedTeacher?.fullName || 'this staff member'} (Gross amount is ₹0). Please configure their salary structure first.`,
        'warning'
      );
      return;
    }
    if (!this.preview) {
      this.confirmDialog.alert('No Preview', 'Payroll preview could not be loaded. Please verify Month/Year and ensure salary structure is configured.', 'warning');
      return;
    }
    const totalDeductions = this.preview.totalAttendanceDeduction
      + this.preview.pfDeduction
      + this.preview.tdsDeduction
      + this.preview.otherDeductions
      + (this.preview.hostelRentDeduction || 0)
      + (this.preview.transportFareDeduction || 0);

    const leaveRemarksParts: string[] = [];
    if (this.preview.unpaidLeaveDays && this.preview.unpaidLeaveDays > 0) {
      leaveRemarksParts.push(`${this.preview.unpaidLeaveDays}d Unpaid Leave (LOP)`);
    }
    if (this.preview.paidLeaveDays && this.preview.paidLeaveDays > 0) {
      leaveRemarksParts.push(`${this.preview.paidLeaveDays}d Paid Leave`);
    }
    const leaveRemarksStr = leaveRemarksParts.length > 0 ? ` | Leaves: ${leaveRemarksParts.join(', ')}` : '';

    this.paymentForm.patchValue({
      grossAmount:     this.preview.grossSalary,
      arrearsAmount:   this.preview.arrearsAmount || 0,
      arrearsRemarks:  this.preview.arrearsRemarks || '',
      deductions:      totalDeductions,
      advanceAdjusted: this.preview.pendingAdvance,
      netPaid:         this.preview.recommendedNetPaid,
      presentDays:     this.preview.presentDays,
      absentDays:      this.preview.absentDays,
      remarks: `Attendance: ${this.preview.presentDays}P, ${this.preview.halfDays}HD, ${this.preview.absentDays}A, ${this.preview.lateDays}L (${this.preview.latePenaltyDays}d late penalty)` +
        leaveRemarksStr +
        ((this.preview.arrearsAmount || 0) > 0 ? ` | Arrears: +₹${this.preview.arrearsAmount}` : '') +
        (this.preview.hostelRentDeduction > 0 ? ` | Hostel: -₹${this.preview.hostelRentDeduction}` : '') +
        (this.preview.transportFareDeduction > 0 ? ` | Transport: -₹${this.preview.transportFareDeduction}` : '')
    }, { emitEvent: false });

    this.calculationsApplied = true;

    const extras: string[] = [];
    if ((this.preview.arrearsAmount || 0) > 0) extras.push(`Arrears +₹${(this.preview.arrearsAmount || 0).toLocaleString('en-IN')} added`);
    if (this.preview.pendingAdvance > 0) extras.push(`Advance ₹${this.preview.pendingAdvance.toLocaleString('en-IN')} adjusted`);
    if (this.preview.hostelRentDeduction > 0) extras.push(`Hostel ₹${this.preview.hostelRentDeduction.toLocaleString('en-IN')} deducted`);
    if (this.preview.transportFareDeduction > 0) extras.push(`Transport ₹${this.preview.transportFareDeduction.toLocaleString('en-IN')} deducted`);
    const extMsg = extras.length > 0 ? ' ' + extras.join(', ') + '.' : '';
    this.confirmDialog.alert(
      'Calculations Applied ✓',
      `Attendance calculations verified and applied!${extMsg} "Record Payment" button is now enabled.`,
      'success'
    );
  }

  deletePayment(payment: SalaryPaymentDto) {
    this.confirmDialog.confirm(
      'Delete Payment Voucher',
      `Are you sure you want to delete the salary payment voucher for ${payment.monthName} (${payment.receiptNumber})? Any adjusted advance will be restored to Approved.`,
      'Delete',
      'Cancel',
      'danger'
    ).subscribe(confirmed => {
      if (confirmed) {
        this.http.delete(`${this.api}/teachers/salary-payments/${payment.id}`).subscribe({
          next: () => {
            this.confirmDialog.alert('Deleted', 'Salary payment deleted successfully.', 'success');
            this.loadPayments();
            this.loadPreview();
            this.loadBulkPreview();
          },
          error: (err: any) => {
            this.confirmDialog.alert('Error', err?.error?.message || 'Failed to delete payment.', 'danger');
          }
        });
      }
    });
  }

  loadPayments() {
    if (!this.selectedTeacher) return;
    this.loading = true;
    this.http.get<SalaryPaymentDto[]>(`${this.api}/teachers/${this.selectedTeacher.id}/salary-payments`).subscribe({
      next: r => { this.payments = r; this.loading = false; },
      error: () => this.loading = false
    });
  }

  openPayslip(payment: SalaryPaymentDto) {
    if (!this.selectedTeacher) return;
    this.dialog.open(TeacherPayslipDialogComponent, {
      width: '860px',
      maxWidth: '96vw',
      autoFocus: false,
      panelClass: 'payslip-dialog-panel',
      data: {
        payment,
        teacher: this.selectedTeacher,
        instituteName: this.authService.currentUser()?.instituteName || 'Apex Coaching Academy',
        branchName: this.authService.getCurrentBranchName()
      }
    });
  }

  recordPayment() {
    if (!this.selectedTeacher) {
      this.confirmDialog.alert('Error', 'Please select a faculty member first.', 'danger');
      return;
    }
    if (!this.selectedTeacher.isActive) {
      this.confirmDialog.alert('Exited Faculty Member', 'Regular salary payment cannot be processed for inactive or relieved faculty members.', 'warning');
      return;
    }
    if (this.isSelectedMonthOngoing) {
      this.confirmDialog.alert(
        'Month In Progress',
        `Cannot record salary: ${this.ongoingMonthInfo?.monthName} ${this.ongoingMonthInfo?.year} is currently in progress (Day ${this.ongoingMonthInfo?.currentDay} of ${this.ongoingMonthInfo?.totalDays}). Full-month attendance is incomplete. Regular salary can only be processed on or after ${this.ongoingMonthInfo?.totalDays} ${this.ongoingMonthInfo?.monthName}.`,
        'warning'
      );
      return;
    }
    if (this.isSelectedMonthFuture) {
      this.confirmDialog.alert(
        'Future Month',
        'Cannot record salary payment for a future month.',
        'warning'
      );
      return;
    }
    if (!this.hasSalaryConfigured) {
      this.confirmDialog.alert(
        'Salary Structure Not Configured',
        `Cannot record payment: Salary structure is not configured for ${this.selectedTeacher.fullName}. Gross salary is ₹0. Please configure their salary structure first.`,
        'warning'
      );
      return;
    }
    if (!this.calculationsApplied) {
      this.confirmDialog.alert('Mandatory Step', 'Please click "Auto-Fill Calculated Deductions" first to apply calculated deductions before recording payment.', 'warning');
      return;
    }
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      this.confirmDialog.alert('Form Invalid', 'Required fields are missing or contain invalid values. Please check and retry.', 'warning');
      return;
    }

    const v = this.paymentForm.value;

    if (v.advanceAdjusted > (v.grossAmount + (v.arrearsAmount || 0))) {
      this.confirmDialog.alert('Validation Error', 'Advance deduction cannot exceed total earnings (Gross + Arrears).', 'danger');
      return;
    }
    if (v.netPaid < 0) {
      this.confirmDialog.alert('Validation Error', 'Net payable amount cannot be negative.', 'danger');
      return;
    }

    this.saving = true;
    this.http.post<SalaryPaymentDto>(`${this.api}/teachers/salary-payments`, {
      teacherId: this.selectedTeacher.id, ...v
    }).subscribe({
      next: (res) => {
        this.saving = false;
        this.showForm = false;
        this.calculationsApplied = false;
        this.pendingAdvances = [];
        this.loadPayments();
        this.loadBulkPreview();
        this.confirmDialog.confirm(
          'Payment Recorded ✓',
          'Salary payment has been recorded successfully! Would you like to view or print the payslip now?',
          'View Payslip',
          'Done',
          'success'
        ).subscribe(view => {
          if (view && res) this.openPayslip(res);
        });
      },
      error: e => {
        this.saving = false;
        this.confirmDialog.alert('Payment Error', e?.error?.message || 'Error recording salary payment. Please try again.', 'danger');
      }
    });
  }
}
