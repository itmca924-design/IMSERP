import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TeacherSelectorComponent } from './teacher-selector.component';
import { API_BASE, TeacherDto, SalaryPaymentDto, PayrollPreviewDto, AdvanceDto } from './teacher.models';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { TeacherPayslipDialogComponent } from './teacher-payslip-dialog.component';

@Component({
  selector: 'app-teacher-payments',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, MatCardModule, MatButtonModule,
    MatIconModule, MatInputModule, MatFormFieldModule, MatSelectModule,
    MatProgressBarModule, MatTooltipModule, MatDialogModule, TeacherSelectorComponent
  ],
  template: `
<div class="page-container">
  <div class="page-header">
    <div>
      <h1 class="page-title"><mat-icon>payments</mat-icon> Salary Payments</h1>
      <p class="page-subtitle">Track faculty salary disbursements, payslips, and payment history.</p>
    </div>
  </div>

  <app-teacher-selector [preSelectId]="preSelectId" [activeOnly]="false" (teacherSelected)="onTeacherSelected($event)"></app-teacher-selector>

  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

  <div *ngIf="!selectedTeacher" class="no-selection">
    <mat-icon>person_search</mat-icon>
    <p>Please select a faculty member above to view salary payments.</p>
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
      <h3>{{selectedTeacher.fullName}} — Payment History</h3>
      <button mat-raised-button color="primary" [disabled]="!selectedTeacher.isActive" (click)="toggleForm()" [matTooltip]="!selectedTeacher.isActive ? 'Exited teacher cannot receive regular salary payments' : ''">
        <mat-icon>{{showForm ? 'close' : 'add'}}</mat-icon>
        {{showForm ? 'Cancel' : 'Record Salary Payment'}}
      </button>
    </div>

    <!-- Payment Form -->
    <mat-card class="form-card mat-elevation-z1" *ngIf="showForm">

      <!-- Smart Payroll Auto-Calculation Banner -->
      <div class="payroll-preview-banner" *ngIf="preview" [class.applied-banner]="calculationsApplied">
        <div class="banner-top">
          <div class="banner-title">
            <mat-icon>calculate</mat-icon>
            <div>
              <strong>Automated Attendance &amp; Salary Calculation ({{months[preview.month - 1]}} {{preview.year}})</strong>
              <p>Per-day rate: ₹{{preview.perDayRate | number}} ({{preview.totalWorkingDays}} working days in month)</p>
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
            <span class="num">₹{{preview.grossSalary | number}}</span>
            <small>Base monthly gross</small>
          </div>
          <div class="stat-box">
            <span class="lbl">Present &amp; Half Days</span>
            <span class="num">{{preview.presentDays}}P / {{preview.halfDays}}HD</span>
            <small [class.red]="preview.halfDayDeduction > 0">
              {{preview.halfDayDeduction > 0 ? '-₹' + (preview.halfDayDeduction | number) + ' (Half Day cut)' : '0 Half Day cut'}}
            </small>
          </div>
          <div class="stat-box" [class.highlight-warn]="preview.latePenaltyDays > 0">
            <span class="lbl">Late Marks</span>
            <span class="num">{{preview.lateDays}} Lates ({{preview.allowedLateDays}} Free)</span>
            <small [class.red]="preview.latePenaltyDays > 0" [class.green]="preview.latePenaltyDays === 0">
              {{preview.latePenaltyDays > 0 ? '-₹' + (preview.latePenaltyDeduction | number) + ' (' + preview.excessLateDays + ' excess: ' + preview.latePenaltyDays + 'd cut)' : 'Within Grace Quota (₹0 Cut)'}}
            </small>
          </div>
          <div class="stat-box">
            <span class="lbl">Absent Days</span>
            <span class="num">{{preview.absentDays}} Absent</span>
            <small [class.red]="preview.absentDeduction > 0">
              {{preview.absentDeduction > 0 ? '-₹' + (preview.absentDeduction | number) + ' (Loss of Pay)' : '0 Absents'}}
            </small>
          </div>

          <!-- ── Hostel Rent Deduction Card ── -->
          <div class="stat-box" *ngIf="preview.hostelRentDeduction > 0" style="border-color:#f97316;background:#fff7ed;">
            <span class="lbl" style="color:#9a3412;">Hostel / Mess Rent</span>
            <span class="num" style="color:#c2410c;">-₹{{preview.hostelRentDeduction | number}}</span>
            <small style="color:#ea580c;">{{preview.hostelRentInfo || 'Monthly rent deduction'}}</small>
          </div>

          <!-- ── Transport Fare Deduction Card ── -->
          <div class="stat-box" *ngIf="preview.transportFareDeduction > 0" style="border-color:#8b5cf6;background:#faf5ff;">
            <span class="lbl" style="color:#5b21b6;">Transport Fare</span>
            <span class="num" style="color:#7c3aed;">-₹{{preview.transportFareDeduction | number}}</span>
            <small style="color:#8b5cf6;">{{preview.transportFareInfo || 'Monthly transport fare'}}</small>
          </div>

          <!-- ── Advance Adjustment Card ── -->
          <div class="stat-box advance-box" *ngIf="preview.pendingAdvance > 0" [class.highlight-advance]="preview.pendingAdvance > 0">
            <span class="lbl advance-lbl">
              <mat-icon class="adv-icon">account_balance_wallet</mat-icon>
              Advance to Adjust
            </span>
            <span class="num advance-num">-₹{{preview.pendingAdvance | number}}</span>
            <small class="red">{{pendingAdvances.length}} advance(s) pending — will be deducted</small>
          </div>
          <!-- ── No Pending Advance ── -->
          <div class="stat-box" *ngIf="preview.pendingAdvance === 0">
            <span class="lbl">Advance Adjusted</span>
            <span class="num" style="color:#15803d">₹0</span>
            <small class="green">No pending advance</small>
          </div>

          <div class="stat-box net-box">
            <span class="lbl">Net Suggested Pay</span>
            <span class="num net">₹{{preview.recommendedNetPaid | number}}</span>
            <small>Deductions: -₹{{preview.totalAttendanceDeduction + preview.pfDeduction + preview.tdsDeduction + preview.otherDeductions + preview.pendingAdvance + (preview.hostelRentDeduction || 0) + (preview.transportFareDeduction || 0) | number}}</small>
          </div>
        </div>

        <!-- Advance Detail Breakdown (shown only when advance exists) -->
        <div class="advance-detail-strip" *ngIf="preview.pendingAdvance > 0 && pendingAdvances.length > 0">
          <mat-icon>info</mat-icon>
          <span>
            <strong>Advance Breakdown:</strong>
            <span *ngFor="let a of pendingAdvances; let last = last">
              ₹{{a.amount | number}} ({{a.requestDate | date:'dd MMM yyyy'}} — {{a.reason || 'No reason'}}){{!last ? ', ' : ''}}
            </span>
            → Total: <strong>₹{{preview.pendingAdvance | number}}</strong> will be auto-adjusted from salary.
          </span>
        </div>
      </div>

      <!-- No Salary Structure Warning -->
      <div class="no-preview-warn" *ngIf="!preview && !previewLoading">
        <mat-icon>warning_amber</mat-icon>
        <span>Salary structure is not configured for this faculty member or attendance data is missing. Please define <strong>Salary Structure</strong> first.</span>
      </div>

      <form [formGroup]="paymentForm" (ngSubmit)="recordPayment()">
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label>Month *</mat-label>
            <mat-select formControlName="paymentMonth">
              <mat-option *ngFor="let m of months; let i=index" [value]="i+1">{{m}}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Year *</mat-label>
            <input matInput type="number" formControlName="paymentYear" min="2020" max="2099">
            <mat-error *ngIf="paymentForm.get('paymentYear')?.hasError('required')">Year required</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Gross Amount ₹ *</mat-label>
            <input matInput type="number" formControlName="grossAmount" min="0">
            <mat-error *ngIf="paymentForm.get('grossAmount')?.hasError('required')">Gross amount required</mat-error>
            <mat-error *ngIf="paymentForm.get('grossAmount')?.hasError('min')">Must be ≥ 0</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Deductions ₹</mat-label>
            <input matInput type="number" formControlName="deductions" min="0">
            <mat-error *ngIf="paymentForm.get('deductions')?.hasError('min')">Must be ≥ 0</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Advance Adjusted ₹</mat-label>
            <input matInput type="number" formControlName="advanceAdjusted" min="0">
            <mat-hint *ngIf="preview && preview.pendingAdvance > 0" class="hint-advance" align="start">
              ⚡ Auto-filled: ₹{{preview.pendingAdvance | number}} ({{pendingAdvances.length}} advance(s))
            </mat-hint>
            <mat-error *ngIf="paymentForm.get('advanceAdjusted')?.hasError('min')">Must be ≥ 0</mat-error>
            <mat-error *ngIf="paymentForm.get('advanceAdjusted')?.hasError('advanceExceedsGross')">Advance cannot exceed gross amount</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Net Paid ₹ *</mat-label>
            <input matInput type="number" formControlName="netPaid" min="0">
            <mat-hint>Auto-calculated: Gross − Deductions − Advance</mat-hint>
            <mat-error *ngIf="paymentForm.get('netPaid')?.hasError('required')">Net paid required</mat-error>
            <mat-error *ngIf="paymentForm.get('netPaid')?.hasError('min')">Must be ≥ 0</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Payment Mode</mat-label>
            <mat-select formControlName="paymentMode">
              <mat-option value="Cash">Cash</mat-option>
              <mat-option value="BankTransfer">Bank Transfer</mat-option>
              <mat-option value="UPI">UPI</mat-option>
              <mat-option value="Cheque">Cheque</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Present Days</mat-label>
            <input matInput type="number" formControlName="presentDays" min="0">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Absent Days</mat-label>
            <input matInput type="number" formControlName="absentDays" min="0">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Transaction Ref</mat-label>
            <input matInput formControlName="transactionRef" placeholder="UTR / Cheque No.">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Payment Date *</mat-label>
            <input matInput type="date" formControlName="paymentDate">
            <mat-error *ngIf="paymentForm.get('paymentDate')?.hasError('required')">Date required</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Remarks</mat-label>
            <input matInput formControlName="remarks">
          </mat-form-field>
        </div>
        <div class="form-actions">
          <div class="mandatory-hint" *ngIf="!calculationsApplied">
            <mat-icon>lock</mat-icon>
            <span>"Record Payment" is disabled — Please click <strong>"Auto-Fill Calculated Deductions"</strong> above first.</span>
          </div>
          <div class="mandatory-hint success-hint" *ngIf="calculationsApplied">
            <mat-icon>check_circle</mat-icon>
            <span>Calculations verified! You can now record the payment.</span>
          </div>
          <button mat-button type="button" (click)="toggleForm()">Cancel</button>
          <button mat-raised-button color="primary" type="submit"
                  [disabled]="paymentForm.invalid || !calculationsApplied || saving"
                  [matTooltip]="!calculationsApplied ? 'Please click Auto-Fill above to apply deductions' : (paymentForm.invalid ? 'Please resolve validation errors in form' : '')">
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
            <th>Advance Adj.</th><th>Net Paid</th><th>Mode</th><th>Receipt</th><th>Date</th><th class="text-center">Payslip</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let p of payments">
            <td><strong>{{p.monthName}}</strong></td>
            <td>₹{{p.grossAmount | number}}</td>
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
            <td class="text-center">
              <button mat-flat-button color="primary" class="payslip-btn" (click)="openPayslip(p)" matTooltip="View &amp; Print Payslip">
                <mat-icon>receipt_long</mat-icon> Payslip
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
  `,
  styles: [`
    .page-container { display:flex; flex-direction:column; gap:20px; }
    .page-header { display:flex; justify-content:space-between; align-items:center; }
    .page-title { font-size:1.5rem; font-weight:700; margin:0; color:#1976d2; display:flex; align-items:center; gap:8px;
      mat-icon{font-size:1.5rem;width:1.5rem;height:1.5rem;} }
    .page-subtitle { color:#666; margin:4px 0 0; font-size:.9rem; }
    .no-selection { display:flex; flex-direction:column; align-items:center; padding:60px; color:#94a3b8; background:#f8fafc; border-radius:12px;
      mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px;} p{margin:0;font-size:.95rem;} }
    .section-header { display:flex; justify-content:space-between; align-items:center;
      h3{margin:0;font-weight:700;font-size:1.05rem;} }
    .form-card { padding:24px; border-radius:12px; }

    /* Smart Payroll Banner */
    .payroll-preview-banner {
      background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;
      padding: 16px 20px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 14px;
      transition: background 0.3s, border-color 0.3s;
    }
    .payroll-preview-banner.applied-banner {
      background: #f0fdf4; border-color: #4ade80;
    }
    .banner-top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .banner-title {
      display: flex; align-items: center; gap: 10px;
      mat-icon { font-size: 24px; width: 24px; height: 24px; color: #16a34a; }
      strong { font-size: 1rem; color: #14532d; display: block; }
      p { margin: 2px 0 0; font-size: .8rem; color: #166534; }
    }
    .banner-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
    .stat-box {
      background: #ffffff; border: 1px solid #dcfce7; border-radius: 8px; padding: 10px 12px;
      display: flex; flex-direction: column; gap: 2px;
      .lbl { font-size: .72rem; color: #64748b; font-weight: 600; text-transform: uppercase; }
      .num { font-size: 1.05rem; font-weight: 800; color: #1e293b; }
      small { font-size: .72rem; color: #64748b; }
      .red { color: #b91c1c; font-weight: 700; }
      .green { color: #15803d; font-weight: 700; }
      &.highlight-warn { border-color: #fdba74; background: #fff7ed; }
      &.net-box { border-color: #86efac; background: #f0fdf4; .num.net { color: #15803d; font-size: 1.2rem; } }
    }
    /* Advance Box */
    .advance-box {
      border: 2px solid #fbbf24 !important;
      background: #fffbeb !important;
      .advance-lbl { display: flex; align-items: center; gap: 4px; color: #92400e !important; }
      .adv-icon { font-size: 14px; width: 14px; height: 14px; color: #d97706; }
      .advance-num { color: #b45309 !important; font-size: 1.1rem !important; }
    }

    /* Advance Detail Strip */
    .advance-detail-strip {
      display: flex; align-items: flex-start; gap: 8px;
      background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px;
      padding: 10px 14px; font-size: 0.82rem; color: #78350f;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #d97706; flex-shrink: 0; margin-top: 1px; }
      strong { color: #92400e; }
    }

    /* No preview warning */
    .no-preview-warn {
      display: flex; align-items: center; gap: 10px; background: #fff7ed; border: 1px solid #fed7aa;
      border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; font-size: .9rem; color: #9a3412;
      mat-icon { color: #ea580c; font-size: 22px; width: 22px; height: 22px; }
    }

    .autofill-btn { font-weight: 700; border-radius: 8px; background: #1976d2; color: #fff;
      &.applied { background: #16a34a !important; color: #fff !important; }
    }
    .hint-advance { color: #d97706 !important; font-size: 0.72rem; white-space: nowrap; text-align: left; }

    .form-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:0 16px; }
    .form-actions { display:flex; justify-content:flex-end; align-items:center; gap:12px; margin-top:8px; flex-wrap:wrap; }
    .mandatory-hint {
      display: flex; align-items: center; gap: 8px; color: #b45309; background: #fef3c7;
      border: 1px solid #fde68a; padding: 6px 14px; border-radius: 8px; font-size: 0.84rem; margin-right: auto;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #d97706; }
      &.success-hint { color: #15803d; background: #dcfce7; border-color: #bbf7d0;
        mat-icon { color: #16a34a; }
      }
    }
    .table-card { border-radius:10px; overflow:hidden; padding:0; }
    .pay-table { width:100%; border-collapse:collapse; font-size:.85rem;
      th,td{padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:left;}
      th{background:#f8fafc;font-weight:600;color:#64748b;font-size:.78rem;}
      tr:last-child td{border-bottom:none;} tr:hover td{background:#f8fafc;} }
    .net-amount { color:#2e7d32; }
    .mode-chip { background:#e8eaf6; color:#3949ab; font-size:.72rem; padding:2px 8px; border-radius:8px; font-weight:600; }
    .advance-adj-chip {
      display: inline-flex; align-items: center; gap: 4px;
      background: #fef3c7; color: #92400e; font-size: .72rem; padding: 2px 8px;
      border-radius: 8px; font-weight: 600; border: 1px solid #fde68a;
      .inline-icon { font-size: 12px; width: 12px; height: 12px; }
    }
    .receipt-tag {
      background:#e3f2fd; color:#1565c0; font-size:.72rem; padding:3px 8px; border-radius:8px; font-weight:600;
      display: inline-flex; align-items: center; gap: 4px;
      &.clickable { cursor: pointer; transition: all .15s; &:hover { background: #bbdefb; color: #0d47a1; text-decoration: underline; } }
    }
    .inline-icon { font-size: 14px; width: 14px; height: 14px; }
    .payslip-btn {
      font-size: .75rem !important; height: 30px !important; line-height: 30px !important; padding: 0 12px !important;
      border-radius: 6px; box-shadow: none !important;
      mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
    }
    .text-center { text-align: center; }
    .summary-bar {
      margin-top: 4px; padding: 14px 22px; border-radius: 10px; display: flex; gap: 32px; flex-wrap: wrap;
      background: #f8fafc; border: 1px solid #e2e8f0; align-items: center;
      span{font-size:.9rem;color:#64748b;} strong{color:#1e293b;font-size:.95rem;}
      .green{color:#16a34a;font-weight:700;font-size:1.05rem;}
      .orange{color:#d97706;font-weight:700;}
    }
    .empty-state { display:flex; flex-direction:column; align-items:center; padding:40px; color:#94a3b8; background:#f8fafc; border-radius:12px;
      mat-icon{font-size:40px;width:40px;height:40px;margin-bottom:8px;} p{margin:0;} }
    .exited-notice {
      display: flex; align-items: center; gap: 12px; padding: 12px 16px;
      background: #fef2f2; border: 1.5px solid #fca5a5; border-radius: 8px; margin-bottom: 12px;
      mat-icon { font-size: 24px; width: 24px; height: 24px; color: #dc2626; flex-shrink: 0; }
      strong { display: block; color: #991b1b; font-size: 0.9rem; }
      p { margin: 2px 0 0; color: #b91c1c; font-size: 0.8rem; }
    }
  `]
})
export class TeacherPaymentsComponent implements OnInit {
  private api = API_BASE;
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
  months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  get totalPaid()            { return this.payments.reduce((s, p) => s + p.netPaid, 0); }
  get totalGross()           { return this.payments.reduce((s, p) => s + p.grossAmount, 0); }
  get totalAdvanceAdjusted() { return this.payments.reduce((s, p) => s + p.advanceAdjusted, 0); }

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private confirmDialog: ConfirmDialogService,
    private dialog: MatDialog,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(p => { if (p['teacherId']) this.preSelectId = p['teacherId']; });
    const today = new Date().toISOString().split('T')[0];
    this.paymentForm = this.fb.group({
      paymentMonth: [new Date().getMonth() + 1, Validators.required],
      paymentYear: [new Date().getFullYear(), [Validators.required, Validators.min(2020), Validators.max(2099)]],
      grossAmount:      [0, [Validators.required, Validators.min(0)]],
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

    // Auto-recalculate netPaid whenever gross/deductions/advance change
    const recalcNet = () => {
      const g = Number(this.paymentForm.get('grossAmount')?.value) || 0;
      const d = Number(this.paymentForm.get('deductions')?.value) || 0;
      const a = Number(this.paymentForm.get('advanceAdjusted')?.value) || 0;

      // Validate: advance cannot exceed gross
      if (a > g && g > 0) {
        this.paymentForm.get('advanceAdjusted')?.setErrors({ advanceExceedsGross: true });
      } else {
        const existingErrors = this.paymentForm.get('advanceAdjusted')?.errors;
        if (existingErrors?.['advanceExceedsGross']) {
          delete existingErrors['advanceExceedsGross'];
          const remaining = Object.keys(existingErrors).length === 0 ? null : existingErrors;
          this.paymentForm.get('advanceAdjusted')?.setErrors(remaining);
        }
      }

      const net = Math.max(0, g - d - a);
      this.paymentForm.get('netPaid')?.setValue(net, { emitEvent: false });
    };
    this.paymentForm.get('grossAmount')?.valueChanges.subscribe(recalcNet);
    this.paymentForm.get('deductions')?.valueChanges.subscribe(recalcNet);
    this.paymentForm.get('advanceAdjusted')?.valueChanges.subscribe(recalcNet);
  }

  onTeacherSelected(t: TeacherDto) {
    this.selectedTeacher = t;
    this.calculationsApplied = false;
    this.preview = null;
    this.pendingAdvances = [];
    this.loadPayments();
    if (this.showForm) this.loadPreview();
  }

  toggleForm() {
    this.showForm = !this.showForm;
    this.calculationsApplied = false;
    if (this.showForm) {
      this.paymentForm.patchValue({
        grossAmount: 0, deductions: 0, advanceAdjusted: 0, netPaid: 0,
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
    this.previewLoading = true;
    this.preview = null;
    this.pendingAdvances = [];

    // Load payroll preview
    this.http.get<PayrollPreviewDto>(`${this.api}/teachers/${this.selectedTeacher.id}/salary-preview?month=${m}&year=${y}`).subscribe({
      next: p => {
        this.preview = p;
        this.previewLoading = false;
        // Also load pending advances detail for breakdown display
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

    this.paymentForm.patchValue({
      grossAmount:     this.preview.grossSalary,
      deductions:      totalDeductions,
      advanceAdjusted: this.preview.pendingAdvance,
      netPaid:         this.preview.recommendedNetPaid,
      presentDays:     this.preview.presentDays,
      absentDays:      this.preview.absentDays,
      remarks: `Attendance: ${this.preview.presentDays}P, ${this.preview.halfDays}HD, ${this.preview.absentDays}A, ${this.preview.lateDays}L (${this.preview.latePenaltyDays}d late penalty)` +
        (this.preview.hostelRentDeduction > 0 ? ` | Hostel: -₹${this.preview.hostelRentDeduction}` : '') +
        (this.preview.transportFareDeduction > 0 ? ` | Transport: -₹${this.preview.transportFareDeduction}` : '')
    }, { emitEvent: false });

    this.calculationsApplied = true;

    const extras: string[] = [];
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
      width: '820px',
      maxWidth: '96vw',
      panelClass: 'payslip-dialog-panel',
      data: {
        payment,
        teacher: this.selectedTeacher,
        instituteName: this.authService.currentUser()?.instituteName || 'Apex Coaching Academy'
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

    // Final validation: advance cannot exceed gross
    if (v.advanceAdjusted > v.grossAmount) {
      this.confirmDialog.alert('Validation Error', 'Advance deduction cannot exceed gross salary amount.', 'danger');
      return;
    }
    // Final validation: net must be non-negative
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
        this.confirmDialog.confirm(
          'Payment Recorded ✓',
          'Salary payment record ho gayi! Kya aap abhi is payment ki Payslip dekhna / print karna chahte hain?',
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
