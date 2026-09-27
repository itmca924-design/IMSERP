import { Component, OnInit, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import {
  API_BASE,
  TeacherDto,
  LeaveDto,
  TeacherAttendanceRegularizationDto,
  TeacherLeaveBalancesSummaryDto,
  LeavePolicySettingsDto,
  HolidayDto
} from './teacher.models';
import {
  ApplyTeacherRegularizationDialogComponent,
  ReviewTeacherRegularizationDialogComponent
} from './teacher-regularization-dialog.component';
import {
  RequestLeaveCancellationDialogComponent,
  ReviewLeaveCancellationDialogComponent
} from './teacher-leave-cancel-dialog.component';
import { LeavePolicySettingsDialogComponent } from './leave-policy-settings-dialog.component';

// ═══════════════════════════════════════════════════════════════════
// REJECT TEACHER LEAVE DIALOG
// ═══════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-reject-teacher-leave-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="fd-dialog-sm">
      <div class="fd-dialog-header">
        <div class="fd-dialog-icon">
          <mat-icon>cancel</mat-icon>
        </div>
        <div class="fd-dialog-title-group">
          <h2 class="fd-dialog-title">Reject Faculty Leave Request</h2>
          <span class="fd-dialog-sub">{{data.teacherName}} ({{data.employeeCode}}) — <strong>{{data.leaveType}}</strong></span>
        </div>
        <button mat-icon-button class="fd-dialog-close" (click)="cancel()"><mat-icon>close</mat-icon></button>
      </div>

      <div class="fd-dialog-body">
        <div class="rejection-notice">
          <mat-icon>info</mat-icon>
          <div>
            <strong>Rejection Reason Required:</strong> Please specify the cause for rejecting this faculty leave application. This reason will be recorded and visible to the faculty member.
          </div>
        </div>

        <div class="quick-causes">
          <div class="quick-causes-label">Common Rejection Reasons:</div>
          <div class="causes-chips">
            <button type="button" class="cause-chip" (click)="setReason('No substitute faculty available for assigned lectures')">
              👨‍🏫 No Substitute Available
            </button>
            <button type="button" class="cause-chip" (click)="setReason('Scheduled school examination / assessment duty')">
              📝 Exam Duty Scheduled
            </button>
            <button type="button" class="cause-chip" (click)="setReason('Exceeded permissible casual / medical leave limit')">
              ⚠️ Leave Quota Exceeded
            </button>
            <button type="button" class="cause-chip" (click)="setReason('Short notice / Prior approval required')">
              ⏱️ Short Notice
            </button>
          </div>
        </div>

        <mat-form-field appearance="outline" class="fd-field-full">
          <mat-label>Rejection Reason / Cause *</mat-label>
          <textarea matInput [(ngModel)]="reason" rows="3" placeholder="Explain the reason for rejecting this leave..."></textarea>
          <mat-hint *ngIf="!reason.trim()" class="rejection-error-hint">
            * Please enter or select a rejection reason before rejecting
          </mat-hint>
        </mat-form-field>
      </div>

      <div class="fd-dialog-footer">
        <button mat-stroked-button (click)="cancel()">Cancel</button>
        <button mat-flat-button color="warn" (click)="confirm()" [disabled]="saving || !reason.trim()">
          <mat-icon>block</mat-icon>
          {{saving ? 'Rejecting...' : 'Reject Leave Application'}}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .fd-dialog-sm { width: 100%; max-width: 480px; box-sizing: border-box; }
    .fd-dialog-header {
      display: flex; align-items: center; gap: 14px; padding: 20px 24px 14px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
    }
    .fd-dialog-icon {
      background: #ef4444; color: #fff; border-radius: 10px; width: 44px; height: 44px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(239,68,68,0.25); flex-shrink: 0;
    }
    .fd-dialog-title { color: #1e3a8a; font-weight: 700; font-size: 1.05rem; margin: 0; line-height: 1.2; }
    .fd-dialog-sub { color: #3b82f6; font-size: 0.82rem; }
    .fd-dialog-sub strong { color: #1e40af; }
    .fd-dialog-title-group { flex: 1; min-width: 0; }
    .fd-dialog-close { color: #64748b; margin-left: auto; flex-shrink: 0; }
    .fd-dialog-body { padding: 18px 24px; display: flex; flex-direction: column; gap: 14px; box-sizing: border-box; }
    .fd-dialog-footer { display: flex; gap: 12px; justify-content: flex-end; padding: 14px 24px; border-top: 1px solid #e2e8f0; }
    .fd-field-full { width: 100%; display: block; }

    .rejection-notice {
      display: flex; gap: 10px; align-items: flex-start;
      background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
      padding: 10px 14px; color: #991b1b; font-size: 0.82rem; line-height: 1.4;
    }
    .rejection-notice mat-icon { font-size: 18px; width: 18px; height: 18px; color: #dc2626; flex-shrink: 0; margin-top: 1px; }

    .quick-causes-label {
      font-size: 0.76rem; font-weight: 600; color: #64748b;
      text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 6px;
    }
    .causes-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .cause-chip {
      background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 16px;
      padding: 4px 10px; font-size: 0.76rem; color: #334155; cursor: pointer;
      transition: all 0.15s ease; white-space: nowrap;
    }
    .cause-chip:hover { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }
    .rejection-error-hint { color: #dc2626; font-size: 0.75rem; font-weight: 500; }

    @media (max-width: 520px) {
      .fd-dialog-header { padding: 14px 16px 12px; gap: 10px; }
      .fd-dialog-icon { width: 36px; height: 36px; }
      .fd-dialog-title { font-size: 0.95rem; }
      .fd-dialog-body { padding: 14px 16px; gap: 10px; }
      .fd-dialog-footer { padding: 10px 16px; gap: 8px; }
      .fd-dialog-footer button { flex: 1 1 auto; }
    }
  `]
})
export class RejectTeacherLeaveDialogComponent {
  saving = false;
  reason = '';

  constructor(
    private dialogRef: MatDialogRef<RejectTeacherLeaveDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { id: string; teacherName: string; employeeCode: string; leaveType: string },
    private http: HttpClient
  ) {}

  setReason(r: string) { this.reason = r; }

  confirm() {
    if (!this.reason.trim()) return;
    this.saving = true;
    this.http.put(`${API_BASE}/teachers/leaves/${this.data.id}/approve`, {
      approve: false,
      rejectionReason: this.reason.trim()
    }).subscribe({
      next: () => { this.saving = false; this.dialogRef.close(true); },
      error: () => { this.saving = false; }
    });
  }

  cancel() { this.dialogRef.close(false); }
}

// ═══════════════════════════════════════════════════════════════════
// APPLY TEACHER LEAVE DIALOG
// ═══════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-apply-teacher-leave-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <div class="fd-dialog-md">
      <div class="fd-dialog-header">
        <div class="fd-dialog-icon">
          <mat-icon>beach_access</mat-icon>
        </div>
        <div class="fd-dialog-title-group">
          <h2 class="fd-dialog-title">{{dialogTitle}}</h2>
          <span class="fd-dialog-sub">{{dialogSub}}</span>
        </div>
        <button mat-icon-button class="fd-dialog-close" (click)="cancel()"><mat-icon>close</mat-icon></button>
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="fd-dialog-body">

          <!-- Option B: Smart Mode Switcher for HR & Staff Managers -->
          <div class="apply-mode-switcher" *ngIf="hasLinkedProfile && !isTeacherSelf">
            <button type="button" class="mode-btn" [class.active]="applyMode === 'self'" (click)="setMode('self')">
              <mat-icon>person</mat-icon>
              <span>Apply for Myself ({{myProfile?.fullName?.split(' ')?.[0] || 'Self'}})</span>
            </button>
            <button type="button" class="mode-btn" [class.active]="applyMode === 'behalf'" (click)="setMode('behalf')">
              <mat-icon>groups</mat-icon>
              <span>On Behalf of Faculty Member</span>
            </button>
          </div>

          <!-- Self Profile Banner: When Teacher applies OR HR applies for self -->
          <div class="profile-strip self-active" *ngIf="applyMode === 'self' && myProfile">
            <div class="profile-avatar"><mat-icon>account_circle</mat-icon></div>
            <div class="profile-info">
              <div class="profile-name">{{myProfile.fullName}}</div>
              <div class="profile-meta">
                <span>Code: <strong>{{userEmployeeCode}}</strong></span>
                <span *ngIf="myProfile.department">Dept: <strong>{{myProfile.department}}</strong></span>
                <span *ngIf="myProfile.designation">Role: <strong>{{myProfile.designation}}</strong></span>
              </div>
              <div class="self-sub-note" *ngIf="!isTeacherSelf">
                <mat-icon>verified_user</mat-icon>
                <span>HR Personal Application • Forwarded to School Admin / Director for sanction</span>
              </div>
            </div>
          </div>

          <!-- Faculty Member Dropdown: When Admin OR applying on behalf -->
          <mat-form-field appearance="outline" class="fd-field-full" *ngIf="applyMode === 'behalf'">
            <mat-label>Select Faculty Member</mat-label>
            <mat-select formControlName="teacherId">
              <mat-option *ngFor="let t of otherTeachers" [value]="t.id">
                {{t.fullName}} ({{t.employeeCode}}){{t.department ? ' — ' + t.department : ''}}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Live Leave Quota Balances Strip -->
          <div class="quota-ledger-strip" *ngIf="leaveBalances">
            <div class="quota-header-row">
              <span class="quota-title"><mat-icon>account_balance_wallet</mat-icon> Live Leave Balance:</span>
              <span class="quota-sub">Session entitlement & monthly accrual</span>
            </div>
            <div class="quota-chips-grid">
              <div *ngFor="let b of leaveBalances.balances" 
                class="quota-chip"
                [class.active-type]="form.get('leaveType')?.value === b.leaveType"
                [class.low-bal]="b.availableBalance <= 2 && b.leaveType !== 'UnpaidLeave'"
                [class.zero-bal]="b.availableBalance <= 0 && b.leaveType !== 'UnpaidLeave'"
                (click)="selectLeaveType(b.leaveType)">
                <span class="chip-label">{{b.leaveType === 'CasualLeave' ? 'Casual (CL)' : (b.leaveType === 'SickLeave' ? 'Sick (SL)' : (b.leaveType === 'EarnedLeave' ? 'Earned (EL)' : 'LWP (Unpaid)'))}}</span>
                <span class="chip-val">{{b.leaveType === 'UnpaidLeave' ? 'Unlimited' : (b.availableBalance + ' Left')}}</span>
              </div>
            </div>
          </div>

          <!-- Conflict / Backend Error Banner -->
          <div class="conflict-error-banner" *ngIf="backendError">
            <mat-icon>error_outline</mat-icon>
            <div>
              <strong>Action Blocked:</strong> {{backendError}}
            </div>
          </div>

          <div class="form-row">
            <mat-form-field appearance="outline" class="form-col">
              <mat-label>Leave Type</mat-label>
              <mat-select formControlName="leaveType">
                <mat-option value="CasualLeave">Casual Leave</mat-option>
                <mat-option value="SickLeave">Sick Leave</mat-option>
                <mat-option value="EarnedLeave">Earned Leave</mat-option>
                <mat-option value="UnpaidLeave">Unpaid Leave</mat-option>
                <mat-option value="EmergencyLeave">Emergency Leave</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="form-col">
              <mat-label>From Date</mat-label>
              <input matInput type="date" formControlName="fromDate"
                (change)="onFromDateChange()" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="form-col">
              <mat-label>To Date</mat-label>
              <input matInput type="date" formControlName="toDate"
                [min]="form.get('fromDate')?.value || null"
                (change)="onToDateChange()" />
            </mat-form-field>
          </div>

          <!-- Date Validation Error Banner -->
          <div class="date-error-banner" *ngIf="form.hasError('dateRangeInvalid')">
            <mat-icon>warning</mat-icon>
            <span><strong>Invalid Date Range:</strong> "To Date" must be on or after "From Date".</span>
          </div>

          <!-- SMART HOLIDAY & WEEK-OFF REMINDER BANNER -->
          <div class="holiday-reminder-card" *ngIf="(holidaysInRange.length > 0 || sundaysInRange.length > 0) && !form.hasError('dateRangeInvalid') && calendarDays > 0">
            <div class="reminder-header">
              <div class="reminder-icon-box">
                <mat-icon>celebration</mat-icon>
              </div>
              <div class="reminder-text-group">
                <div class="reminder-heading">Holiday & Week-Off Notice</div>
                <div class="reminder-subheading">
                  These days will not be <strong>deducted from your leave quota</strong> due to school holidays / weekly offs:
                </div>
              </div>
            </div>

            <!-- List of detected holidays & Sundays -->
            <div class="reminder-dates-grid">
              <div class="date-pill holiday-pill" *ngFor="let h of holidaysInRange">
                <span class="pill-badge pill-holiday">🏖️ Holiday</span>
                <span class="pill-date">{{h.date | date:'dd MMM (EEE)'}}:</span>
                <strong class="pill-name">{{h.title}}</strong>
              </div>
              <div class="date-pill sunday-pill" *ngFor="let s of sundaysInRange">
                <span class="pill-badge pill-sunday">☀️ Week-Off</span>
                <span class="pill-date">{{s | date:'dd MMM'}}:</span>
                <strong class="pill-name">Sunday</strong>
              </div>
            </div>

            <!-- Calculation Breakdown Formula -->
            <div class="breakdown-strip">
              <div class="b-item">
                <span class="b-lbl">Total Span</span>
                <span class="b-val">{{calendarDays}} Days</span>
              </div>
              <span class="b-math">−</span>
              <div class="b-item">
                <span class="b-lbl">Holidays & Sundays</span>
                <span class="b-val text-exempt">{{holidaysInRange.length + sundaysInRange.length}} Days Exempt</span>
              </div>
              <span class="b-math">=</span>
              <div class="b-item b-final">
                <span class="b-lbl">Actual Leave Deducted</span>
                <span class="b-val text-primary">{{deductibleDays}} Working Day(s)</span>
              </div>
            </div>
          </div>

          <!-- Notice if entire range is holidays/Sundays -->
          <div class="zero-deductible-notice" *ngIf="calendarDays > 0 && deductibleDays === 0 && !form.hasError('dateRangeInvalid')">
            <mat-icon>info</mat-icon>
            <span>All selected dates fall on official holidays/Sundays. Therefore, <strong>0 days</strong> will be deducted from your leave quota.</span>
          </div>

          <!-- Total Duration Badge & Live Quota Match -->
          <div class="days-badge-wrap" [class.badge-danger]="isInsufficientBalance" *ngIf="calendarDays > 0 && !form.hasError('dateRangeInvalid')">
            <mat-icon [style.color]="isInsufficientBalance ? '#dc2626' : '#2563eb'" style="font-size:16px;width:16px;height:16px;">
              {{isInsufficientBalance ? 'warning' : 'date_range'}}
            </mat-icon>
            <span>Net Leave Count: <strong>{{deductibleDays}} Working Day(s)</strong></span>
            <span class="cal-span-sub" *ngIf="calendarDays !== deductibleDays">({{calendarDays}} calendar days span)</span>
            <span *ngIf="currentAvailableBalance !== null" class="balance-limit-text">
              • Quota Balance: <strong>{{currentAvailableBalance}} Day(s)</strong>
            </span>
          </div>

          <!-- Prominent Quota Exceeded Warning Banner -->
          <div class="quota-exceeded-banner" *ngIf="isInsufficientBalance">
            <div class="banner-top">
              <mat-icon>block</mat-icon>
              <div class="banner-msg">
                <strong>Insufficient {{selectedLeaveTypeName}} Balance!</strong>
                <p>
                  Aapke paas sirf <strong>{{currentAvailableBalance}} din</strong> bache hain, lekin aapne <strong>{{totalDays}} din</strong> select kiya hai (Excess: <strong>{{balanceShortfall}} din</strong>).
                </p>
              </div>
            </div>
            <div class="banner-actions">
              <button type="button" class="btn-switch-unpaid" (click)="switchToUnpaid()">
                <mat-icon>swap_horiz</mat-icon>
                <span>Switch to Unpaid Leave (LWP)</span>
              </button>
              <span class="or-text">or adjust From/To dates to maximum {{currentAvailableBalance}} day(s)</span>
            </div>
          </div>

          <mat-form-field appearance="outline" class="fd-field-full">
            <mat-label>Reason for Leave</mat-label>
            <textarea matInput formControlName="reason" rows="3" placeholder="Provide medical reason, personal emergency, family function, etc..."></textarea>
          </mat-form-field>
        </div>

        <div class="fd-dialog-footer">
          <button mat-stroked-button type="button" (click)="cancel()">Cancel</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || isInsufficientBalance || saving">
            <mat-icon>{{isInsufficientBalance ? 'block' : 'send'}}</mat-icon>
            {{saving ? 'Submitting...' : (isInsufficientBalance ? 'Insufficient Balance' : 'Submit Application')}}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .fd-dialog-md { width: 100%; max-width: 680px; box-sizing: border-box; }
    .fd-dialog-header {
      display: flex; align-items: center; gap: 14px; padding: 20px 24px 14px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
    }
    .fd-dialog-icon {
      background: #2563eb; color: #fff; border-radius: 10px; width: 44px; height: 44px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25); flex-shrink: 0;
    }
    .fd-dialog-title { color: #1e3a8a; font-weight: 700; font-size: 1.05rem; margin: 0; }
    .fd-dialog-sub { color: #3b82f6; font-size: 0.82rem; margin-top: 2px; }
    .fd-dialog-title-group { flex: 1; min-width: 0; }
    .fd-dialog-close { color: #64748b; margin-left: auto; flex-shrink: 0; }
    .fd-dialog-body { padding: 18px 24px; display: flex; flex-direction: column; gap: 14px; box-sizing: border-box; }
    .fd-dialog-footer { display: flex; gap: 12px; justify-content: flex-end; padding: 14px 24px; border-top: 1px solid #e2e8f0; }
    .fd-field-full { width: 100%; display: block; }
    .form-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .form-col { flex: 1; min-width: 140px; }

    .quota-ledger-strip {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .quota-header-row {
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;
    }
    .quota-title {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 0.78rem; font-weight: 700; color: #1e40af; text-transform: uppercase; letter-spacing: 0.3px;
    }
    .quota-title mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2563eb; }
    .quota-sub { font-size: 0.72rem; color: #64748b; }
    .quota-chips-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    .quota-chip {
      background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px;
      padding: 8px 10px; display: flex; flex-direction: column; cursor: pointer;
      transition: all 0.15s ease; min-width: 0;
    }
    .quota-chip:hover { border-color: #93c5fd; background: #eff6ff; }
    .quota-chip.active-type {
      background: #eff6ff; border-color: #3b82f6; box-shadow: 0 0 0 1px #3b82f6;
    }
    .quota-chip .chip-label { font-size: 0.74rem; color: #64748b; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .quota-chip .chip-val { font-size: 0.95rem; font-weight: 700; color: #1e293b; margin-top: 3px; }
    .quota-chip.low-bal .chip-val { color: #d97706; }
    .quota-chip.zero-bal { background: #fef2f2; border-color: #fecaca; }
    .quota-chip.zero-bal .chip-val { color: #dc2626; }

    @media (max-width: 600px) {
      .quota-chips-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .conflict-error-banner {
      display: flex; gap: 10px; align-items: flex-start;
      background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px;
      padding: 10px 14px; color: #991b1b; font-size: 0.82rem; line-height: 1.4;
    }
    .conflict-error-banner mat-icon { font-size: 20px; width: 20px; height: 20px; color: #dc2626; flex-shrink: 0; }

    .apply-mode-switcher {
      display: flex; gap: 6px;
      background: #f1f5f9; padding: 4px; border-radius: 10px; border: 1px solid #e2e8f0;
    }
    .mode-btn {
      flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      padding: 8px 12px; border-radius: 7px; border: none; background: transparent;
      font-size: 0.82rem; font-weight: 600; color: #64748b; cursor: pointer; transition: all 0.15s ease;
    }
    .mode-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .mode-btn:hover { color: #1e293b; background: rgba(255,255,255,0.7); }
    .mode-btn.active {
      background: #ffffff; color: #2563eb;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
    }
    .self-sub-note {
      display: flex; align-items: center; gap: 5px;
      margin-top: 6px; font-size: 0.72rem; color: #2563eb; font-weight: 600;
    }
    .self-sub-note mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .profile-strip {
      display: flex; align-items: center; gap: 12px;
      background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 10px 14px;
    }
    .profile-avatar {
      width: 38px; height: 38px; border-radius: 8px; background: #16a34a; color: #fff;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .profile-name { font-size: 14px; font-weight: 700; color: #14532d; }
    .profile-meta { font-size: 12px; color: #166534; display: flex; gap: 12px; flex-wrap: wrap; margin-top: 2px; }
    .profile-meta strong { color: #0f172a; }

    .days-badge-wrap {
      display: inline-flex; align-items: center; gap: 6px;
      background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;
      padding: 6px 12px; font-size: 13px; color: #1e40af; width: fit-content;
      transition: all 0.2s ease;
    }
    .days-badge-wrap.badge-danger {
      background: #fef2f2; border-color: #fca5a5; color: #991b1b;
    }
    .balance-limit-text {
      font-size: 12px; opacity: 0.85; margin-left: 4px;
    }

    .quota-exceeded-banner {
      background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #dc2626;
      border-radius: 8px; padding: 10px 14px; display: flex; flex-direction: column; gap: 8px;
    }
    .quota-exceeded-banner .banner-top {
      display: flex; align-items: flex-start; gap: 10px;
    }
    .quota-exceeded-banner .banner-top mat-icon {
      color: #dc2626; font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; margin-top: 1px;
    }
    .quota-exceeded-banner .banner-msg {
      font-size: 0.82rem; color: #991b1b; line-height: 1.4;
    }
    .quota-exceeded-banner .banner-msg strong {
      color: #7f1d1d;
    }
    .quota-exceeded-banner .banner-msg p {
      margin: 3px 0 0; font-size: 0.8rem; color: #7f1d1d;
    }
    .quota-exceeded-banner .banner-actions {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding-left: 30px;
    }
    .btn-switch-unpaid {
      display: inline-flex; align-items: center; gap: 5px;
      background: #2563eb; color: #ffffff; border: none; border-radius: 6px;
      padding: 5px 10px; font-size: 0.78rem; font-weight: 600; cursor: pointer;
      transition: background 0.15s ease;
    }
    .btn-switch-unpaid:hover { background: #1d4ed8; }
    .btn-switch-unpaid mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .quota-exceeded-banner .or-text {
      font-size: 0.75rem; color: #991b1b; font-style: italic;
    }

    .date-error-banner {
      display: flex; align-items: center; gap: 8px;
      background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
      padding: 8px 12px; font-size: 13px; color: #b91c1c;
    }
    .date-error-banner mat-icon { font-size: 18px; width: 18px; height: 18px; color: #ef4444; flex-shrink: 0; }

    /* Smart Holiday & Week-Off Reminder Banner */
    .holiday-reminder-card {
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
      border: 1px solid #a7f3d0;
      border-radius: 10px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-shadow: 0 1px 3px rgba(16, 185, 129, 0.08);
    }
    .reminder-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .reminder-icon-box {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #059669;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 2px 4px rgba(5, 150, 105, 0.25);
    }
    .reminder-icon-box mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .reminder-text-group { flex: 1; }
    .reminder-heading {
      font-size: 0.85rem;
      font-weight: 700;
      color: #065f46;
    }
    .reminder-subheading {
      font-size: 0.74rem;
      color: #047857;
      margin-top: 1px;
    }
    .reminder-dates-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .date-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #ffffff;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 0.76rem;
      border: 1px solid #d1fae5;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    }
    .pill-badge {
      font-size: 0.68rem;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.2px;
    }
    .pill-holiday {
      background: #fef3c7;
      color: #92400e;
    }
    .pill-sunday {
      background: #e0f2fe;
      color: #0369a1;
    }
    .pill-date {
      color: #374151;
      font-weight: 600;
    }
    .pill-name {
      color: #0f172a;
    }
    .breakdown-strip {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.85);
      border: 1px solid #a7f3d0;
      border-radius: 8px;
      flex-wrap: wrap;
    }
    .b-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .b-lbl {
      font-size: 0.68rem;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
    }
    .b-val {
      font-size: 0.88rem;
      font-weight: 700;
      color: #1e293b;
    }
    .b-val.text-exempt {
      color: #059669;
    }
    .b-val.text-primary {
      color: #2563eb;
      font-size: 0.95rem;
    }
    .b-math {
      font-size: 1.1rem;
      font-weight: 700;
      color: #94a3b8;
    }
    .b-item.b-final {
      margin-left: auto;
    }
    .cal-span-sub {
      font-size: 0.75rem;
      color: #64748b;
      margin-left: 2px;
    }
    .zero-deductible-notice {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 0.8rem;
      color: #1e40af;
    }
    .zero-deductible-notice mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; flex-shrink: 0; }

    @media (max-width: 520px) {
      .fd-dialog-header { padding: 14px 16px 12px; }
      .fd-dialog-body { padding: 14px 16px; gap: 10px; }
      .form-row { flex-direction: column; gap: 8px; }
      .form-col { min-width: 100%; }
      .fd-dialog-footer { padding: 10px 16px; }
      .fd-dialog-footer button { flex: 1; }
    }
  `]
})
export class ApplyTeacherLeaveDialogComponent implements OnInit {
  form!: FormGroup;
  saving = false;
  totalDays = 0;
  calendarDays = 0;
  deductibleDays = 0;
  holidays: HolidayDto[] = [];
  holidaysInRange: { date: string; title: string; type: string }[] = [];
  sundaysInRange: string[] = [];
  isTeacherSelf = false;
  hasLinkedProfile = false;
  applyMode: 'self' | 'behalf' = 'self';
  teachers: TeacherDto[] = [];
  myProfile: any = null;
  leaveBalances: TeacherLeaveBalancesSummaryDto | null = null;
  loadingBalances = false;
  backendError = '';

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ApplyTeacherLeaveDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { isTeacher: boolean; teachers: TeacherDto[]; myProfile: any },
    private http: HttpClient
  ) {
    this.isTeacherSelf = data.isTeacher;
    this.teachers = data.teachers || [];
    this.myProfile = data.myProfile;
  }

  get userEmployeeCode(): string {
    return this.myProfile?.employeeCode 
      || this.leaveBalances?.employeeCode 
      || this.teachers?.find(t => t.id === this.myProfile?.id)?.employeeCode 
      || '—';
  }

  get otherTeachers(): TeacherDto[] {
    if (!this.myProfile?.id) return this.teachers;
    return this.teachers.filter(t => t.id !== this.myProfile.id);
  }

  get dialogTitle(): string {
    if (this.isTeacherSelf || this.applyMode === 'self') {
      return 'Apply for Leave';
    }
    return 'Submit Faculty Leave Application';
  }

  get dialogSub(): string {
    if (this.isTeacherSelf || this.applyMode === 'self') {
      return 'Application will be submitted to School Administration / Principal for approval';
    }
    return 'Submit leave on behalf of a faculty member';
  }

  get currentAvailableBalance(): number | null {
    const currentType = this.form?.get('leaveType')?.value;
    if (!currentType || currentType === 'UnpaidLeave') return null;
    if (!this.leaveBalances?.balances) return null;
    const b = this.leaveBalances.balances.find(x => x.leaveType.toLowerCase() === currentType.toLowerCase());
    return b !== undefined ? b.availableBalance : null;
  }

  get isInsufficientBalance(): boolean {
    if (this.form?.get('leaveType')?.value === 'UnpaidLeave') return false;
    const bal = this.currentAvailableBalance;
    if (bal === null) return false;
    return this.totalDays > bal;
  }

  get balanceShortfall(): number {
    const bal = this.currentAvailableBalance;
    if (bal === null) return 0;
    return Number((this.totalDays - bal).toFixed(1));
  }

  get selectedLeaveTypeName(): string {
    const type = this.form?.get('leaveType')?.value;
    if (type === 'SickLeave') return 'Sick Leave';
    if (type === 'CasualLeave') return 'Casual Leave';
    if (type === 'EarnedLeave') return 'Earned Leave';
    if (type === 'EmergencyLeave') return 'Emergency Leave';
    return 'Leave';
  }

  switchToUnpaid() {
    this.form.patchValue({ leaveType: 'UnpaidLeave' });
  }

  ngOnInit() {
    this.hasLinkedProfile = !!(this.myProfile?.id);

    if (this.isTeacherSelf || this.hasLinkedProfile) {
      this.applyMode = 'self';
    } else {
      this.applyMode = 'behalf';
    }

    const defaultTeacherId = this.applyMode === 'self' ? (this.myProfile?.id || '') : '';

    this.form = this.fb.group({
      teacherId: [defaultTeacherId, Validators.required],
      leaveType: ['CasualLeave', Validators.required],
      fromDate: ['', Validators.required],
      toDate: ['', Validators.required],
      reason: ['', Validators.required]
    }, {
      validators: [this.dateRangeValidator]
    });

    this.form.valueChanges.subscribe(() => {
      this.calcDays();
    });

    if (defaultTeacherId) {
      this.loadBalances(defaultTeacherId);
    }

    this.form.get('teacherId')?.valueChanges.subscribe(val => {
      if (val) this.loadBalances(val);
    });

    // Fetch active holidays for holiday reminder & smart deductible calculation
    this.http.get<HolidayDto[]>(`${API_BASE}/holidays?activeOnly=true`).subscribe({
      next: h => {
        this.holidays = h || [];
        this.calcDays();
      },
      error: () => {}
    });

    // If myProfile was not yet loaded from parent, fetch it dynamically
    if (!this.myProfile) {
      this.http.get<any>(`${API_BASE}/teachers/my-profile`).subscribe({
        next: p => {
          if (p?.isLinked) {
            this.myProfile = p;
            this.hasLinkedProfile = true;
            if (this.applyMode === 'self') {
              this.form.patchValue({ teacherId: p.id });
              this.loadBalances(p.id);
            }
          }
        },
        error: () => {}
      });
    }
  }

  loadBalances(teacherId: string) {
    if (!teacherId) {
      this.leaveBalances = null;
      return;
    }
    this.loadingBalances = true;
    this.http.get<TeacherLeaveBalancesSummaryDto>(`${API_BASE}/teachers/${teacherId}/leave-balances`).subscribe({
      next: res => {
        this.leaveBalances = res;
        this.loadingBalances = false;
        if (this.myProfile && !this.myProfile.employeeCode && res?.employeeCode) {
          this.myProfile.employeeCode = res.employeeCode;
        }
      },
      error: () => {
        this.loadingBalances = false;
      }
    });
  }

  selectLeaveType(type: string) {
    this.form.patchValue({ leaveType: type });
  }

  dateRangeValidator(control: AbstractControl): ValidationErrors | null {
    const from = control.get('fromDate')?.value;
    const to = control.get('toDate')?.value;
    if (from && to && to < from) {
      return { dateRangeInvalid: true };
    }
    return null;
  }

  setMode(mode: 'self' | 'behalf') {
    this.applyMode = mode;
    if (mode === 'self') {
      const id = this.myProfile?.id || '';
      this.form.patchValue({ teacherId: id });
      if (id) this.loadBalances(id);
    } else {
      this.form.patchValue({ teacherId: '' });
      this.leaveBalances = null;
    }
  }

  onFromDateChange() {
    const from = this.form.get('fromDate')?.value;
    const to = this.form.get('toDate')?.value;
    if (from && (!to || to < from)) {
      this.form.patchValue({ toDate: from });
    }
    this.calcDays();
  }

  onToDateChange() {
    this.calcDays();
  }

  calcDays() {
    const fromStr = this.form.get('fromDate')?.value;
    const toStr = this.form.get('toDate')?.value;
    if (!fromStr || !toStr || toStr < fromStr) {
      this.totalDays = 0;
      this.calendarDays = 0;
      this.deductibleDays = 0;
      this.holidaysInRange = [];
      this.sundaysInRange = [];
      return;
    }

    const d1 = new Date(fromStr + 'T00:00:00');
    const d2 = new Date(toStr + 'T00:00:00');
    let count = 0;
    const hList: { date: string; title: string; type: string }[] = [];
    const sList: string[] = [];

    for (let cur = new Date(d1); cur <= d2; cur.setDate(cur.getDate() + 1)) {
      count++;
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      const isSunday = cur.getDay() === 0;
      const matched = this.holidays.find(h => {
        const hStart = (h.startDate || '').split('T')[0];
        const hEnd = (h.endDate || '').split('T')[0] || hStart;
        return dateStr >= hStart && dateStr <= hEnd;
      });

      if (isSunday) {
        sList.push(dateStr);
      } else if (matched) {
        hList.push({
          date: dateStr,
          title: matched.title,
          type: matched.holidayType || 'Holiday'
        });
      }
    }

    this.calendarDays = count;
    this.holidaysInRange = hList;
    this.sundaysInRange = sList;
    this.deductibleDays = Math.max(0, count - hList.length - sList.length);
    this.totalDays = this.deductibleDays; // Deductible days used for live balance quota match & validation
  }

  submit() {
    if (this.form.invalid) return;
    this.saving = true;
    this.backendError = '';
    this.http.post(`${API_BASE}/teachers/leaves`, this.form.value).subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close(true);
      },
      error: err => {
        this.saving = false;
        this.backendError = err.error?.message || 'Failed to submit leave application. Please check details.';
      }
    });
  }

  cancel() { this.dialogRef.close(false); }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN TEACHER LEAVES COMPONENT
// ═══════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-teacher-leaves',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, MatCardModule, MatButtonModule,
    MatIconModule, MatInputModule, MatFormFieldModule, MatSelectModule,
    MatProgressBarModule, MatTooltipModule, MatDialogModule
  ],
  template: `
    <div class="fd-page">

      <!-- ── Page Header ── -->
      <div class="page-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>beach_access</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Faculty Leave Management</h1>
            <p class="page-subtitle">
              {{ isTeacher 
                ? 'Apply for leave, track application status, and view your sanctioned leave records' 
                : 'Review and approve faculty leave requests, track attendance linkage, and manage leave records' }}
            </p>
          </div>
        </div>

        <div class="header-actions">
          <button mat-stroked-button class="refresh-btn" (click)="loadAll()" [disabled]="loading">
            <mat-icon [class.spin]="loading">refresh</mat-icon>
            <span>Refresh</span>
          </button>
          <button mat-stroked-button class="policy-btn" *ngIf="canApproveLeave" (click)="openPolicySettingsDialog()" matTooltip="Configure institutional leave quotas, monthly accruals & conflict rules">
            <mat-icon>tune</mat-icon>
            <span>Policy & Quotas</span>
          </button>
          <button mat-stroked-button class="reg-btn" (click)="openRegularizationDialog()">
            <mat-icon>build_circle</mat-icon>
            <span>Request Regularization</span>
          </button>
          <button mat-flat-button class="btn-primary" (click)="openApplyDialog()">
            <mat-icon>add</mat-icon>
            <span>Apply Leave</span>
          </button>
        </div>
      </div>

      <mat-progress-bar *ngIf="loading || loadingRegs" mode="indeterminate" class="fd-loader"></mat-progress-bar>

      <!-- ── Sub Navigation Tabs ── -->
      <div class="tabs-nav-strip">
        <button type="button" class="tab-pill" [class.active]="activeTab === 'leaves'" (click)="activeTab = 'leaves'">
          <mat-icon>beach_access</mat-icon>
          <span>Leave Applications ({{leaves.length}})</span>
        </button>
        <button type="button" class="tab-pill" [class.active]="activeTab === 'regularizations'" (click)="activeTab = 'regularizations'; loadRegularizations()">
          <mat-icon>build_circle</mat-icon>
          <span>Attendance Regularizations ({{regularizations.length}})</span>
          <span class="pill-badge" *ngIf="pendingRegCount > 0">{{pendingRegCount}}</span>
        </button>
      </div>

      <!-- ── Teacher Scope Notice Banner ── -->
      <div class="role-scope-notice teacher" *ngIf="isTeacher">
        <mat-icon>account_circle</mat-icon>
        <span>
          <strong>Faculty Portal View:</strong> Displaying records for <strong>{{myProfile?.fullName || 'Your Account'}}</strong>{{(myProfile?.employeeCode || currentEmployeeCode) ? ' (Code: ' + (myProfile?.employeeCode || currentEmployeeCode) + ')' : ''}}. Applications are forwarded to School Administration / Principal for review.
        </span>
      </div>

      <!-- ── Stats Cards (Full Width Edge to Edge) ── -->
      <div class="stats-grid" [class.stats-teacher]="isTeacher" *ngIf="activeTab === 'leaves'">
        <div class="stat-card stat-amber">
          <mat-icon class="stat-icon">pending_actions</mat-icon>
          <div class="stat-body">
            <div class="stat-num">{{stats.pending}}</div>
            <div class="stat-label">Pending Review</div>
          </div>
          <div class="pulse-badge" *ngIf="stats.pending > 0 && canApproveLeave">Action Required</div>
        </div>

        <div class="stat-card stat-green">
          <mat-icon class="stat-icon">check_circle</mat-icon>
          <div class="stat-body">
            <div class="stat-num">{{stats.approvedThisMonth}}</div>
            <div class="stat-label">Approved (This Month)</div>
          </div>
        </div>

        <div class="stat-card stat-slate" *ngIf="!isTeacher">
          <mat-icon class="stat-icon">person_off</mat-icon>
          <div class="stat-body">
            <div class="stat-num">{{stats.onLeaveToday}}</div>
            <div class="stat-label">On Leave Today</div>
          </div>
        </div>

        <div class="stat-card stat-blue">
          <mat-icon class="stat-icon">event_note</mat-icon>
          <div class="stat-body">
            <div class="stat-num">{{stats.totalThisYear}}</div>
            <div class="stat-label">Total Applications (Year)</div>
          </div>
        </div>
      </div>

      <!-- ── Live Leave Quota & Balances Ledger ── -->
      <div class="leave-balance-ledger-card" *ngIf="activeTab === 'leaves'">
        <div class="ledger-header">
          <div class="ledger-header-left">
            <div class="ledger-icon-box">
              <mat-icon>account_balance_wallet</mat-icon>
            </div>
            <div>
              <div class="ledger-title-line">
                <h3 class="ledger-title">Live Leave Balance & Quota Ledger</h3>
                <span class="ledger-tag faculty-tag" *ngIf="currentTeacherBalances">
                  {{currentTeacherBalances.teacherName}} ({{currentTeacherBalances.employeeCode}})
                </span>
                <span class="ledger-tag admin-hint-tag" *ngIf="!isTeacher && !filterTeacherId && !currentTeacherBalances">
                  Select a faculty member below to inspect individual quota
                </span>
              </div>
              <p class="ledger-sub" *ngIf="currentTeacherBalances">
                Real-time session quota, leaves consumed, and available balance (auto-credited upon leave cancellation).
              </p>
              <p class="ledger-sub" *ngIf="!currentTeacherBalances">
                Track sanctioned leave entitlements, casual leave, sick leave, earned leave & attendance regularizations.
              </p>
            </div>
          </div>

          <div class="ledger-header-right" *ngIf="currentTeacherBalances">
            <button mat-stroked-button class="ledger-refresh-btn" (click)="loadTeacherBalances()" [disabled]="loadingBalances" matTooltip="Refresh Balance">
              <mat-icon [class.spin-icon]="loadingBalances">sync</mat-icon>
              <span>Refresh Balance</span>
            </button>
          </div>
        </div>

        <!-- Balances Grid -->
        <div class="ledger-grid" *ngIf="currentTeacherBalances">
          <div *ngFor="let b of currentTeacherBalances.balances"
            class="ledger-chip-card"
            [class.card-cl]="b.leaveType === 'CasualLeave'"
            [class.card-sl]="b.leaveType === 'SickLeave'"
            [class.card-el]="b.leaveType === 'EarnedLeave'"
            [class.card-lwp]="b.leaveType === 'UnpaidLeave'">
            
            <div class="chip-card-top">
              <div class="chip-type-badge">
                <mat-icon>{{getLeaveIcon(b.leaveType)}}</mat-icon>
                <span>{{formatBalanceLeaveType(b.leaveType)}}</span>
              </div>
              <span class="chip-avail-pill" *ngIf="b.leaveType !== 'UnpaidLeave'" [class.pill-zero]="b.availableBalance <= 0" [class.pill-low]="b.availableBalance > 0 && b.availableBalance <= 2">
                {{b.availableBalance > 0 ? (b.availableBalance + ' Days Left') : 'Quota Exhausted'}}
              </span>
              <span class="chip-avail-pill pill-lwp" *ngIf="b.leaveType === 'UnpaidLeave'">
                Loss of Pay
              </span>
            </div>

            <div class="chip-card-center">
              <div class="chip-big-num" *ngIf="b.leaveType !== 'UnpaidLeave'">
                {{b.availableBalance}} <span class="chip-unit">Days</span>
              </div>
              <div class="chip-big-num" *ngIf="b.leaveType === 'UnpaidLeave'">
                {{b.usedDays}} <span class="chip-unit">Days Taken</span>
              </div>
              <div class="chip-caption">
                {{b.leaveType === 'UnpaidLeave' ? 'Total Unpaid Leave Availed' : 'Available for Application'}}
              </div>
            </div>

            <!-- Progress Meter & Ledger stats -->
            <div class="chip-card-footer" *ngIf="b.leaveType !== 'UnpaidLeave'">
              <div class="chip-meter">
                <div class="chip-meter-fill" [style.width.%]="getBalMeterPercent(b)"></div>
              </div>
              <div class="chip-stats-row">
                <span class="stat-item">Used: <strong>{{b.usedDays}}d</strong></span>
                <span class="stat-item" *ngIf="b.pendingDays > 0" style="color:#d97706;">Pending: <strong>{{b.pendingDays}}d</strong></span>
                <span class="stat-item">Total: <strong>{{b.allocatedDays}}d</strong></span>
              </div>
            </div>

            <div class="chip-card-footer lwp-footer" *ngIf="b.leaveType === 'UnpaidLeave'">
              <div class="lwp-hint-text">
                <mat-icon>monetization_on</mat-icon>
                <span>Salary deduction calculated in Monthly Payroll</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Monthly Regularization Summary Strip -->
        <div class="regularization-quota-strip" *ngIf="currentTeacherBalances && currentTeacherBalances.maxRegularizationsAllowedPerMonth > 0">
          <div class="rq-left">
            <mat-icon>fact_check</mat-icon>
            <span>
              <strong>Attendance Regularization Policy:</strong>
              Monthly Quota: <strong>{{currentTeacherBalances.maxRegularizationsAllowedPerMonth}} requests/month</strong>.
              Consumed: <strong>{{currentTeacherBalances.regularizationsUsedThisMonth}}</strong>.
              Available: <strong>{{currentTeacherBalances.maxRegularizationsAllowedPerMonth - currentTeacherBalances.regularizationsUsedThisMonth}}</strong>.
            </span>
          </div>
          <button mat-button class="rq-action-btn" (click)="openRegularizationDialog()">
            <mat-icon>build_circle</mat-icon> Request Regularization
          </button>
        </div>
      </div>

      <!-- ── Regularization Stats (When regularizations tab active) ── -->
      <div class="stats-grid" [class.stats-teacher]="isTeacher" *ngIf="activeTab === 'regularizations'">
        <div class="stat-card stat-amber">
          <mat-icon class="stat-icon">hourglass_top</mat-icon>
          <div class="stat-body">
            <div class="stat-num">{{pendingRegCount}}</div>
            <div class="stat-label">Pending Regularizations</div>
          </div>
          <div class="pulse-badge" *ngIf="pendingRegCount > 0 && canApproveLeave">Action Required</div>
        </div>

        <div class="stat-card stat-green">
          <mat-icon class="stat-icon">task_alt</mat-icon>
          <div class="stat-body">
            <div class="stat-num">{{approvedRegCount}}</div>
            <div class="stat-label">Approved (Total)</div>
          </div>
        </div>

        <div class="stat-card stat-blue">
          <mat-icon class="stat-icon">history</mat-icon>
          <div class="stat-body">
            <div class="stat-num">{{regularizations.length}}</div>
            <div class="stat-label">Total Requests</div>
          </div>
        </div>
      </div>

      <!-- ── Main Card for Leave Applications ── -->
      <div class="content-card" *ngIf="activeTab === 'leaves'">

        <!-- ── Filter Bar ── -->
        <div class="filter-bar">
          <mat-form-field appearance="outline" class="filter-field" subscriptSizing="dynamic">
            <mat-label>Status</mat-label>
            <mat-select [(ngModel)]="filterStatus" (selectionChange)="loadLeaves()">
              <mat-option value="All">All Statuses</mat-option>
              <mat-option value="Pending">⏳ Pending Review</mat-option>
              <mat-option value="Approved">✅ Approved</mat-option>
              <mat-option value="Rejected">❌ Rejected</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field" subscriptSizing="dynamic">
            <mat-label>Leave Type</mat-label>
            <mat-select [(ngModel)]="filterLeaveType" (selectionChange)="loadLeaves()">
              <mat-option value="All">All Types</mat-option>
              <mat-option value="CasualLeave">Casual Leave</mat-option>
              <mat-option value="SickLeave">Sick Leave</mat-option>
              <mat-option value="EarnedLeave">Earned Leave</mat-option>
              <mat-option value="UnpaidLeave">Unpaid Leave</mat-option>
              <mat-option value="EmergencyLeave">Emergency Leave</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field filter-field-full-mobile" *ngIf="!isTeacher" subscriptSizing="dynamic">
            <mat-label>Faculty Member</mat-label>
            <mat-select [(ngModel)]="filterTeacherId" (selectionChange)="onTeacherFilterChange()">
              <mat-option value="">All Faculty</mat-option>
              <mat-option *ngFor="let t of teachers" [value]="t.id">{{t.fullName}} ({{t.employeeCode}})</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field-search" subscriptSizing="dynamic">
            <mat-icon matPrefix class="filter-icon">search</mat-icon>
            <input matInput [(ngModel)]="searchQuery" (input)="loadLeaves()" placeholder="Search faculty name, code, reason..." />
            <button mat-icon-button matSuffix *ngIf="searchQuery" (click)="searchQuery=''; loadLeaves()" style="color:#94a3b8;">
              <mat-icon style="font-size:18px;">close</mat-icon>
            </button>
          </mat-form-field>
        </div>

        <!-- ── Leaves Table ── -->
        <div class="fd-table-wrap" *ngIf="filteredLeaves.length > 0; else noLeaves">
          <table class="fd-table">
            <thead>
              <tr>
                <th *ngIf="!isTeacher">Faculty Member</th>
                <th>Leave Type</th>
                <th>Duration & Dates</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Reviewed By</th>
                <th>Applied On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let l of filteredLeaves" [class.row-pending]="l.status === 'Pending'">
                <!-- Faculty Member (Admin View) -->
                <td *ngIf="!isTeacher">
                  <div class="teacher-info-cell">
                    <div class="teacher-avatar"><mat-icon>person</mat-icon></div>
                    <div>
                      <div class="teacher-name">{{l.teacherName}}</div>
                      <div class="teacher-code">{{l.employeeCode}}</div>
                    </div>
                  </div>
                </td>

                <!-- Leave Type -->
                <td>
                  <span class="leave-type-chip type-{{l.leaveType.toLowerCase()}}">
                    {{formatLeaveType(l.leaveType)}}
                  </span>
                </td>

                <!-- Dates -->
                <td>
                  <div class="date-range-text">
                    <span class="date-bold">{{l.fromDate | date:'dd MMM yyyy'}}</span>
                    <span class="date-sep">to</span>
                    <span class="date-bold">{{l.toDate | date:'dd MMM yyyy'}}</span>
                  </div>
                </td>

                <!-- Days -->
                <td>
                  <span class="days-badge">{{l.totalDays}} Day{{l.totalDays > 1 ? 's' : ''}}</span>
                </td>

                <!-- Reason -->
                <td>
                  <div class="reason-cell">
                    <span class="reason-text">{{l.reason || '—'}}</span>
                  </div>
                </td>

                <!-- Status -->
                <td>
                  <span *ngIf="l.status === 'CancellationRequested' || l.isCancellationRequested" class="status-badge status-cancel-req"
                    matTooltip="Cancellation requested: awaiting Admin review">
                    <mat-icon>hourglass_top</mat-icon> Cancel Pending
                  </span>
                  <span *ngIf="l.status === 'PartiallyCancelled'" class="status-badge status-partially-cancelled">
                    <mat-icon>event_repeat</mat-icon> Partially Cancelled
                  </span>
                  <span *ngIf="l.status !== 'CancellationRequested' && !l.isCancellationRequested && l.status !== 'PartiallyCancelled'" class="status-badge status-{{l.status.toLowerCase()}}">
                    <mat-icon>{{getStatusIcon(l.status)}}</mat-icon>
                    {{l.status}}
                  </span>
                </td>

                <!-- Approver / Rejection Reason -->
                <td>
                  <div *ngIf="l.status === 'Approved' || l.status === 'PartiallyCancelled'" class="approver-info">
                    <div class="approver-name">✅ {{l.approvedBy || 'Admin'}}</div>
                    <div class="approver-date" *ngIf="l.approvedAt">{{toUtc(l.approvedAt) | date:'dd MMM, hh:mm a'}}</div>
                    <div *ngIf="l.isCancellationRequested" class="rejection-reason-text" style="color:#c2410c;">
                      Cancel Requested: {{l.cancellationReason}}
                    </div>
                    <div *ngIf="l.status === 'PartiallyCancelled' && l.cancellationReviewedBy" class="cancel-partial-sub">
                      <mat-icon style="font-size:12px;width:12px;height:12px;vertical-align:middle;color:#ea580c;">event_repeat</mat-icon>
                      Partially Revoked by {{l.cancellationReviewedBy}}
                      <span *ngIf="l.cancellationReviewedAt">({{toUtc(l.cancellationReviewedAt) | date:'dd MMM, hh:mm a'}})</span>
                    </div>
                  </div>
                  <div *ngIf="l.status === 'Rejected'" class="rejection-info">
                    <div class="rejection-name">❌ {{l.approvedBy || 'Admin'}}</div>
                    <div class="rejection-reason-text" *ngIf="l.rejectionReason" [matTooltip]="l.rejectionReason">
                      {{l.rejectionReason | slice:0:30}}{{l.rejectionReason.length > 30 ? '...' : ''}}
                    </div>
                  </div>
                  <span class="na-text" *ngIf="l.status === 'Pending'">⏳ Awaiting Review</span>
                  <div *ngIf="l.status === 'Cancelled'" class="approver-info cancel-info">
                    <div class="approver-name cancel-name">
                      <mat-icon class="cancel-icon-inline">event_busy</mat-icon>
                      <span>Revoked by {{l.cancellationReviewedBy || l.approvedBy || 'Admin'}}</span>
                    </div>
                    <div class="approver-date" *ngIf="l.cancellationReviewedAt || l.approvedAt">
                      {{toUtc(l.cancellationReviewedAt || l.approvedAt) | date:'dd MMM, hh:mm a'}}
                    </div>
                    <div class="rejection-reason-text cancel-remarks-text" *ngIf="l.cancellationReviewRemarks" [matTooltip]="l.cancellationReviewRemarks">
                      "{{l.cancellationReviewRemarks}}"
                    </div>
                  </div>
                </td>

                <!-- Applied Date -->
                <td>
                  <div class="applied-date">{{toUtc(l.createdAt) | date:'dd MMM yyyy'}}</div>
                </td>

                <!-- Actions -->
                <td>
                  <div class="action-btns">
                    <!-- ADMIN / HR ACTIONS (Approving other staff's leaves) -->
                    <ng-container *ngIf="canApproveLeave && !isSelfLeave(l)">
                      <button mat-icon-button class="btn-approve" *ngIf="l.status === 'Pending'"
                        (click)="quickApprove(l)" matTooltip="Approve Leave (Syncs Attendance)">
                        <mat-icon>check_circle</mat-icon>
                      </button>
                      <button mat-icon-button class="btn-reject" *ngIf="l.status === 'Pending'"
                        (click)="openRejectDialog(l)" matTooltip="Reject Leave Application">
                        <mat-icon>cancel</mat-icon>
                      </button>
                      <button mat-icon-button color="warn" *ngIf="l.status === 'Pending'" (click)="deleteLeave(l)" matTooltip="Delete Application">
                        <mat-icon>delete</mat-icon>
                      </button>

                      <!-- Review Cancellation Request (Admin/HR for other staff) -->
                      <button mat-stroked-button class="btn-review-cancel" *ngIf="l.status === 'CancellationRequested' || l.isCancellationRequested"
                        (click)="openReviewCancellationDialog(l)" matTooltip="Review cancellation request submitted by employee">
                        <mat-icon>fact_check</mat-icon> Review Cancel
                      </button>
                    </ng-container>

                    <!-- Request Cancellation Button (Available for approved leaves) -->
                    <button mat-icon-button class="btn-cancel-req"
                      *ngIf="(l.status === 'Approved' || l.status === 'PartiallyCancelled') && !l.isCancellationRequested"
                      (click)="openRequestCancellationDialog(l)" matTooltip="Request Full or Partial Cancellation for this Leave">
                      <mat-icon>event_busy</mat-icon>
                    </button>

                    <!-- SELF ACTIONS (Staff or HR viewing their OWN application) -->
                    <ng-container *ngIf="isSelfLeave(l)">
                      <span class="self-tag" *ngIf="l.status === 'Pending'" matTooltip="Self-approval not permitted. Awaiting Admin / Director sanction.">
                        <mat-icon>hourglass_top</mat-icon> Awaiting Admin
                      </span>
                      <span class="self-tag" *ngIf="l.status === 'CancellationRequested' || l.isCancellationRequested" matTooltip="Self-approval not permitted. Cancellation request awaiting Admin sanction.">
                        <mat-icon>hourglass_top</mat-icon> Cancel Awaiting Admin
                      </span>
                      <button mat-icon-button color="warn" *ngIf="l.status === 'Pending'"
                        (click)="deleteLeave(l)" matTooltip="Cancel My Application">
                        <mat-icon>close</mat-icon>
                      </button>
                    </ng-container>

                    <!-- TEACHER ACTIONS -->
                    <button mat-icon-button color="warn" *ngIf="isTeacher && !isSelfLeave(l) && l.status === 'Pending'"
                      (click)="deleteLeave(l)" matTooltip="Cancel Leave Application">
                      <mat-icon>close</mat-icon>
                    </button>

                    <!-- Completed / Finalized Status -->
                    <span class="na-text" *ngIf="l.status !== 'Pending' && !l.isCancellationRequested && l.status !== 'Approved' && l.status !== 'PartiallyCancelled'">—</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ng-template #noLeaves>
          <div class="empty-state">
            <mat-icon>beach_access</mat-icon>
            <p>No faculty leave records found for the selected criteria.</p>
            <button mat-stroked-button (click)="openApplyDialog()">
              <mat-icon>add</mat-icon> Apply First Leave
            </button>
          </div>
        </ng-template>

      </div>

      <!-- ── Main Card for Attendance Regularizations ── -->
      <div class="content-card" *ngIf="activeTab === 'regularizations'">

        <!-- Filter Bar -->
        <div class="filter-bar">
          <mat-form-field appearance="outline" class="filter-field" subscriptSizing="dynamic">
            <mat-label>Status</mat-label>
            <mat-select [(ngModel)]="filterRegStatus" (selectionChange)="loadRegularizations()">
              <mat-option value="All">All Statuses</mat-option>
              <mat-option value="Pending">⏳ Pending Review</mat-option>
              <mat-option value="Approved">✅ Approved</mat-option>
              <mat-option value="Rejected">❌ Rejected</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field filter-field-full-mobile" *ngIf="!isTeacher" subscriptSizing="dynamic">
            <mat-label>Faculty Member</mat-label>
            <mat-select [(ngModel)]="filterRegTeacherId" (selectionChange)="loadRegularizations()">
              <mat-option value="">All Faculty</mat-option>
              <mat-option *ngFor="let t of teachers" [value]="t.id">{{t.fullName}} ({{t.employeeCode}})</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field-search" subscriptSizing="dynamic">
            <mat-icon matPrefix class="filter-icon">search</mat-icon>
            <input matInput [(ngModel)]="regSearchQuery" placeholder="Search teacher, employee code, reason..." />
            <button mat-icon-button matSuffix *ngIf="regSearchQuery" (click)="regSearchQuery=''" style="color:#94a3b8;">
              <mat-icon style="font-size:18px;">close</mat-icon>
            </button>
          </mat-form-field>
        </div>

        <!-- Regularizations Table -->
        <div class="fd-table-wrap" *ngIf="filteredRegularizations.length > 0; else noRegs">
          <table class="fd-table">
            <thead>
              <tr>
                <th *ngIf="!isTeacher">Faculty Member</th>
                <th>Occurrence Date</th>
                <th>Target Mark</th>
                <th>Timestamps</th>
                <th>Reason / Justification</th>
                <th>Attachment</th>
                <th>Status</th>
                <th>Reviewed By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of filteredRegularizations" [class.row-pending]="r.status === 'Pending'">
                <!-- Faculty Member -->
                <td *ngIf="!isTeacher">
                  <div class="teacher-info-cell">
                    <div class="teacher-avatar"><mat-icon>person</mat-icon></div>
                    <div>
                      <div class="teacher-name">{{r.teacherName}}</div>
                      <div class="teacher-code">{{r.employeeCode}}</div>
                    </div>
                  </div>
                </td>

                <!-- Occurrence Date -->
                <td>
                  <span class="date-bold">{{r.attendanceDate | date:'dd MMM yyyy'}}</span>
                </td>

                <!-- Target Mark -->
                <td>
                  <span class="reg-status-chip" [class.chip-present]="r.requestedStatus === 'Present'" [class.chip-halfday]="r.requestedStatus === 'HalfDay'">
                    {{r.requestedStatus}}
                  </span>
                </td>

                <!-- Timestamps -->
                <td>
                  <div class="time-text">
                    {{r.requestedCheckIn || '—'}} to {{r.requestedCheckOut || '—'}}
                  </div>
                </td>

                <!-- Reason -->
                <td>
                  <div class="reason-cell">
                    <span class="reason-text">{{r.reason}}</span>
                  </div>
                </td>

                <!-- Attachment -->
                <td>
                  <a *ngIf="r.attachmentUrl" [href]="r.attachmentUrl" target="_blank" rel="noopener noreferrer" class="doc-link">
                    <mat-icon>attach_file</mat-icon> Doc
                  </a>
                  <span *ngIf="!r.attachmentUrl" class="na-text">—</span>
                </td>

                <!-- Status -->
                <td>
                  <span class="status-badge status-{{r.status.toLowerCase()}}">
                    <mat-icon>{{getStatusIcon(r.status)}}</mat-icon>
                    {{r.status}}
                  </span>
                </td>

                <!-- Reviewed By -->
                <td>
                  <div *ngIf="r.status === 'Approved'" class="approver-info">
                    <div class="approver-name">✅ {{r.reviewedBy || 'Admin'}}</div>
                    <div class="approver-date" *ngIf="r.reviewedAt">{{toUtc(r.reviewedAt) | date:'dd MMM, hh:mm a'}}</div>
                  </div>
                  <div *ngIf="r.status === 'Rejected'" class="rejection-info">
                    <div class="rejection-name">❌ {{r.reviewedBy || 'Admin'}}</div>
                    <div class="rejection-reason-text" *ngIf="r.reviewRemarks" [matTooltip]="r.reviewRemarks">
                      {{r.reviewRemarks}}
                    </div>
                  </div>
                  <span class="na-text" *ngIf="r.status === 'Pending'">⏳ Awaiting Review</span>
                </td>

                <!-- Actions -->
                <td>
                  <div class="action-btns">
                    <!-- Admin / HR Review Actions -->
                    <ng-container *ngIf="canApproveLeave && !isSelfReg(r)">
                      <button mat-icon-button class="btn-approve" *ngIf="r.status === 'Pending'"
                        (click)="openReviewRegularizationDialog(r, true)" matTooltip="Approve Regularization">
                        <mat-icon>check_circle</mat-icon>
                      </button>
                      <button mat-icon-button class="btn-reject" *ngIf="r.status === 'Pending'"
                        (click)="openReviewRegularizationDialog(r, false)" matTooltip="Reject Regularization">
                        <mat-icon>cancel</mat-icon>
                      </button>
                    </ng-container>

                    <span class="self-tag" *ngIf="isSelfReg(r) && r.status === 'Pending'" matTooltip="Self-approval not permitted. Awaiting Admin sanction.">
                      <mat-icon>hourglass_top</mat-icon> Awaiting Admin
                    </span>

                    <span class="na-text" *ngIf="r.status !== 'Pending'">—</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ng-template #noRegs>
          <div class="empty-state">
            <mat-icon>build_circle</mat-icon>
            <p>No attendance regularization records found.</p>
            <button mat-stroked-button (click)="openRegularizationDialog()">
              <mat-icon>add</mat-icon> Request Regularization
            </button>
          </div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    .fd-page {
      font-family: 'Inter', sans-serif;
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding-bottom: 40px;
    }

    /* ── Page Header ── */
    .page-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px; background: #fff;
      border: 1px solid #e2e8f0; border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,.05);
      flex-wrap: wrap; gap: 16px;
    }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-icon-box {
      width: 48px; height: 48px; border-radius: 12px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 10px rgba(37,99,235,.28); color: #fff;
    }
    .page-title { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0; }
    .page-subtitle { font-size: 0.82rem; color: #64748b; margin: 2px 0 0; }
    .header-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .refresh-btn { color: #64748b !important; border-color: #e2e8f0 !important; }
    .btn-primary { background: linear-gradient(135deg, #2563eb, #1d4ed8) !important; color: #fff !important; }

    .fd-loader { margin: 0; border-radius: 4px; }

    /* ── Role Scope Notice ── */
    .role-scope-notice {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 18px; border-radius: 10px; font-size: 0.84rem; line-height: 1.4;
    }
    .role-scope-notice.teacher {
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 1px solid #bbf7d0; color: #166534;
    }
    .role-scope-notice.teacher mat-icon { color: #16a34a; font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }

    /* ── Stats Grid ── */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      width: 100%;
    }
    .stats-grid.stats-teacher {
      grid-template-columns: repeat(3, 1fr);
    }
    @media (max-width: 1024px) {
      .stats-grid, .stats-grid.stats-teacher {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    @media (max-width: 600px) {
      .stats-grid, .stats-grid.stats-teacher {
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }
    }
    @media (max-width: 420px) {
      .stats-grid, .stats-grid.stats-teacher {
        grid-template-columns: 1fr;
      }
    }

    .stat-card {
      background: #fff; border-radius: 12px; padding: 18px 20px;
      display: flex; align-items: center; gap: 14px;
      box-shadow: 0 1px 4px rgba(0,0,0,.05); border: 1px solid #e2e8f0;
      position: relative; transition: transform .2s, box-shadow .2s;
    }
    .stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 14px rgba(0,0,0,.08); }
    .stat-icon {
      font-size: 30px; width: 36px; height: 36px; line-height: 36px;
      display: inline-flex; align-items: center; justify-content: center;
      overflow: visible !important; flex-shrink: 0;
    }
    .stat-num { font-size: 1.8rem; font-weight: 700; line-height: 1; }
    .stat-label { font-size: 0.72rem; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: .3px; font-weight: 600; }
    .stat-blue .stat-icon  { color: #2563eb; }  .stat-blue .stat-num  { color: #2563eb; }
    .stat-green .stat-icon { color: #16a34a; }  .stat-green .stat-num { color: #16a34a; }
    .stat-slate .stat-icon { color: #475569; }  .stat-slate .stat-num { color: #475569; }
    .stat-amber .stat-icon  { color: #d97706; } .stat-amber .stat-num  { color: #d97706; }

    .pulse-badge {
      position: absolute; top: 12px; right: 14px;
      background: #f59e0b; color: #fff; font-size: 10px; font-weight: 800;
      padding: 2px 7px; border-radius: 10px; letter-spacing: 0.3px;
    }

    /* ── Main Content Card ── */
    .content-card {
      background: #fff; border-radius: 12px; border: 1px solid #e2e8f0;
      box-shadow: 0 1px 4px rgba(0,0,0,.05); overflow: hidden; width: 100%;
    }

    /* ── Filter Bar ── */
    .filter-bar {
      display: flex; gap: 12px; align-items: center;
      padding: 16px 20px 10px; flex-wrap: wrap;
    }
    .filter-field { flex: 0 0 170px; min-width: 140px; }
    .filter-field-search { flex: 1 1 240px; min-width: 200px; }
    .filter-icon {
      color: #64748b; margin-right: 8px; margin-left: 2px;
      font-size: 20px; width: 20px; height: 20px;
      display: inline-flex; align-items: center; justify-content: center;
    }

    @media (max-width: 768px) {
      .filter-bar { padding: 12px 14px 6px; gap: 8px; }
      .filter-field { flex: 1 1 calc(50% - 4px); min-width: 140px; width: auto; }
      .filter-field.filter-field-full-mobile { flex: 1 1 100%; min-width: 100%; }
      .filter-field-search { flex: 1 1 100%; min-width: 100%; }
      .page-header { padding: 14px 16px; flex-direction: column; align-items: flex-start; gap: 12px; }
      .header-actions { width: 100%; justify-content: flex-start; }
    }

    /* ── Table ── */
    .fd-table-wrap { padding: 0 20px 20px; overflow-x: auto; }
    .fd-table { width: 100%; border-collapse: collapse; font-size: 0.83rem; }
    .fd-table th {
      padding: 10px 12px; text-align: left; background: #f1f5f9; color: #475569;
      font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: .3px;
      border-bottom: 2px solid #e2e8f0; white-space: nowrap;
    }
    .fd-table td { padding: 12px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .fd-table tr:hover td { background: #f8fafc; }
    .fd-table tr.row-pending td { background: #fffdf5; }

    .teacher-info-cell { display: flex; align-items: center; gap: 10px; }
    .teacher-avatar {
      width: 32px; height: 32px; border-radius: 8px; background: #eff6ff; color: #2563eb;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .teacher-avatar mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .teacher-name { font-weight: 600; color: #0f172a; font-size: 0.84rem; }
    .teacher-code { font-size: 0.72rem; color: #64748b; font-family: monospace; }

    .leave-type-chip {
      display: inline-block; font-size: 0.7rem; font-weight: 600; padding: 2px 8px;
      border-radius: 8px; white-space: nowrap; text-transform: capitalize;
    }
    .type-casualleave    { background: #e0e7ff; color: #3730a3; }
    .type-sickleave      { background: #fee2e2; color: #991b1b; }
    .type-earnedleave    { background: #fef3c7; color: #92400e; }
    .type-unpaidleave    { background: #f1f5f9; color: #475569; }
    .type-emergencyleave { background: #ffedd5; color: #9a3412; }

    .date-range-text { display: flex; align-items: center; gap: 4px; font-size: 0.8rem; }
    .date-bold { font-weight: 600; color: #0f172a; }
    .date-sep { color: #94a3b8; font-size: 0.75rem; }

    .days-badge {
      display: inline-block; background: #f1f5f9; color: #334155; font-size: 0.72rem;
      font-weight: 700; padding: 2px 7px; border-radius: 6px; border: 1px solid #cbd5e1;
    }

    .reason-cell { max-width: 220px; }
    .reason-text { font-size: 0.78rem; color: #475569; word-break: break-word; }

    .status-badge {
      display: inline-flex; align-items: center; gap: 3px; font-size: 0.72rem;
      font-weight: 600; padding: 3px 8px; border-radius: 20px; white-space: nowrap;
    }
    .status-badge mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .status-pending  { background: #fef3c7; color: #92400e; }
    .status-approved { background: #d1fae5; color: #065f46; }
    .status-rejected { background: #fee2e2; color: #991b1b; }

    .approver-info { font-size: 0.76rem; }
    .approver-name { font-weight: 600; color: #166534; }
    .approver-date { font-size: 0.7rem; color: #64748b; }
    .rejection-info { font-size: 0.76rem; }
    .rejection-name { font-weight: 600; color: #991b1b; }
    .rejection-reason-text { font-size: 0.7rem; color: #b91c1c; font-style: italic; }
    .na-text { color: #94a3b8; font-size: 0.76rem; }
    .applied-date { font-size: 0.76rem; color: #64748b; }

    .action-btns { display: flex; align-items: center; gap: 4px; }
    .btn-approve { color: #16a34a !important; }
    .btn-reject { color: #dc2626 !important; }
    .self-tag {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 600;
      background: #fef3c7; color: #92400e; border: 1px solid #fde68a;
    }
    .status-cancel-req { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
    .status-partially-cancelled { background: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe; }
    .btn-cancel-req { color: #d97706 !important; }
    .btn-review-cancel {
      font-size: 0.74rem !important; padding: 2px 8px !important; line-height: 24px !important;
      color: #c2410c !important; border-color: #fdba74 !important; background: #fff7ed !important;
    }
    .btn-review-cancel mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 4px; }

    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      padding: 40px; color: #94a3b8; background: #fff;
    }
    .empty-state mat-icon { font-size: 40px; width: 40px; height: 40px; margin-bottom: 8px; color: #cbd5e1; }
    .empty-state p { margin: 0 0 14px; font-size: 0.88rem; }

    /* Tabs Navigation Strip */
    .tabs-nav-strip {
      display: flex; gap: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;
    }
    .tab-pill {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1;
      background: #f8fafc; color: #475569; font-weight: 600; font-size: 0.84rem;
      cursor: pointer; transition: all 0.15s ease;
    }
    .tab-pill mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .tab-pill:hover { background: #eff6ff; color: #2563eb; border-color: #93c5fd; }
    .tab-pill.active {
      background: #2563eb; color: #fff; border-color: #2563eb;
      box-shadow: 0 2px 4px rgba(37,99,235,0.25);
    }
    .tab-pill.active mat-icon { color: #fff; }
    .pill-badge {
      background: #ef4444; color: #fff; border-radius: 10px;
      font-size: 0.7rem; font-weight: 700; padding: 1px 6px;
    }
    .tab-pill.active .pill-badge {
      background: #fff; color: #dc2626;
    }

    .policy-btn { color: #475569 !important; border-color: #cbd5e1 !important; }
    .policy-btn:hover { background: #f1f5f9 !important; color: #1e293b !important; }
    .reg-btn { color: #2563eb !important; border-color: #bfdbfe !important; background: #eff6ff !important; }
    .reg-btn:hover { background: #dbeafe !important; }

    .reg-status-chip {
      display: inline-block; font-size: 0.72rem; font-weight: 700; padding: 2px 8px;
      border-radius: 6px; background: #f1f5f9; color: #475569;
    }
    .reg-status-chip.chip-present { background: #dcfce7; color: #15803d; }
    .reg-status-chip.chip-halfday { background: #fef3c7; color: #b45309; }

    .time-text { font-size: 0.78rem; font-family: monospace; color: #334155; font-weight: 600; }
    .doc-link {
      display: inline-flex; align-items: center; gap: 4px; font-size: 0.76rem;
      color: #2563eb; text-decoration: none; font-weight: 600;
    }
    .cancel-info { font-size: 0.76rem; }
    .cancel-name { font-weight: 600; color: #c2410c; display: flex; align-items: center; gap: 4px; }
    .cancel-icon-inline { font-size: 14px; width: 14px; height: 14px; color: #ea580c; vertical-align: middle; }
    .cancel-remarks-text { font-size: 0.7rem; color: #9a3412; font-style: italic; margin-top: 1px; }
    .cancel-partial-sub { font-size: 0.69rem; color: #7c2d12; margin-top: 2px; font-weight: 500; }

    /* ── Live Leave Balance & Quota Ledger ── */
    .leave-balance-ledger-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .ledger-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .ledger-header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .ledger-icon-box {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
      flex-shrink: 0;
    }
    .ledger-icon-box mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .ledger-title-line {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .ledger-title {
      margin: 0;
      font-size: 1.02rem;
      font-weight: 700;
      color: #0f172a;
    }
    .ledger-tag {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 2px 10px;
      border-radius: 9999px;
    }
    .ledger-tag.faculty-tag {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }
    .ledger-tag.admin-hint-tag {
      background: #f8fafc;
      color: #64748b;
      border: 1px dashed #cbd5e1;
    }
    .ledger-sub {
      margin: 2px 0 0 0;
      font-size: 0.78rem;
      color: #64748b;
    }
    .ledger-refresh-btn {
      font-size: 0.78rem !important;
      border-color: #cbd5e1 !important;
      color: #334155 !important;
    }
    .ledger-refresh-btn mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
    .spin-icon { animation: spin 1s infinite linear; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    /* Balances Grid */
    .ledger-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
    }
    @media (max-width: 1024px) {
      .ledger-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 640px) {
      .ledger-grid { grid-template-columns: 1fr; }
    }

    .ledger-chip-card {
      border-radius: 12px;
      padding: 14px 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .ledger-chip-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    }
    .chip-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }
    .chip-type-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      font-weight: 700;
      color: #1e293b;
    }
    .chip-type-badge mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .chip-avail-pill {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 6px;
      background: #dcfce7;
      color: #15803d;
    }
    .chip-avail-pill.pill-low {
      background: #fef3c7;
      color: #b45309;
    }
    .chip-avail-pill.pill-zero {
      background: #fee2e2;
      color: #b91c1c;
    }
    .chip-avail-pill.pill-lwp {
      background: #f1f5f9;
      color: #475569;
    }

    .chip-card-center {
      margin-bottom: 12px;
    }
    .chip-big-num {
      font-size: 1.6rem;
      font-weight: 800;
      line-height: 1.1;
      letter-spacing: -0.02em;
    }
    .chip-unit {
      font-size: 0.85rem;
      font-weight: 600;
      color: #64748b;
      margin-left: 2px;
    }
    .chip-caption {
      font-size: 0.72rem;
      color: #64748b;
      margin-top: 2px;
    }

    /* Color variations */
    .card-cl {
      background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%);
      border-color: #bbf7d0;
    }
    .card-cl .chip-big-num { color: #15803d; }
    .card-cl .chip-type-badge mat-icon { color: #16a34a; }
    .card-cl .chip-meter-fill { background: #22c55e; }

    .card-sl {
      background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
      border-color: #bfdbfe;
    }
    .card-sl .chip-big-num { color: #1d4ed8; }
    .card-sl .chip-type-badge mat-icon { color: #2563eb; }
    .card-sl .chip-meter-fill { background: #3b82f6; }

    .card-el {
      background: linear-gradient(180deg, #faf5ff 0%, #ffffff 100%);
      border-color: #e9d5ff;
    }
    .card-el .chip-big-num { color: #7e22ce; }
    .card-el .chip-type-badge mat-icon { color: #9333ea; }
    .card-el .chip-meter-fill { background: #a855f7; }

    .card-lwp {
      background: linear-gradient(180deg, #fff7ed 0%, #ffffff 100%);
      border-color: #fed7aa;
    }
    .card-lwp .chip-big-num { color: #c2410c; }
    .card-lwp .chip-type-badge mat-icon { color: #ea580c; }

    .chip-card-footer {
      border-top: 1px solid rgba(0, 0, 0, 0.06);
      padding-top: 8px;
    }
    .chip-meter {
      height: 5px;
      background: #e2e8f0;
      border-radius: 9999px;
      overflow: hidden;
      margin-bottom: 6px;
    }
    .chip-meter-fill {
      height: 100%;
      border-radius: 9999px;
      transition: width 0.3s ease;
    }
    .chip-stats-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.72rem;
      color: #64748b;
    }
    .chip-stats-row strong { color: #1e293b; }
    .lwp-hint-text {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.72rem;
      color: #9a3412;
      font-weight: 500;
    }
    .lwp-hint-text mat-icon { font-size: 15px; width: 15px; height: 15px; color: #ea580c; }

    .regularization-quota-strip {
      margin-top: 14px;
      padding: 10px 14px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .rq-left {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.78rem;
      color: #1e40af;
    }
    .rq-left mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
    .rq-left strong { color: #1e3a8a; }
    .rq-action-btn {
      font-size: 0.76rem !important;
      font-weight: 600 !important;
      color: #2563eb !important;
      padding: 0 10px !important;
    }
    .rq-action-btn mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
  `]
})
export class TeacherLeavesComponent implements OnInit {
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);
  private confirm = inject(ConfirmDialogService);

  activeTab: 'leaves' | 'regularizations' = 'leaves';
  leaves: LeaveDto[] = [];
  regularizations: TeacherAttendanceRegularizationDto[] = [];
  teachers: TeacherDto[] = [];
  myProfile: any = null;
  currentTeacherBalances: TeacherLeaveBalancesSummaryDto | null = null;
  loading = false;
  loadingRegs = false;
  loadingBalances = false;

  // Filters (Leaves)
  filterStatus = 'All';
  filterLeaveType = 'All';
  filterTeacherId = '';
  searchQuery = '';

  // Filters (Regularizations)
  filterRegStatus = 'All';
  filterRegTeacherId = '';
  regSearchQuery = '';

  // Stats
  stats = {
    pending: 0,
    approvedThisMonth: 0,
    onLeaveToday: 0,
    totalThisYear: 0
  };

  get isTeacher(): boolean {
    return this.authService.isTeacher();
  }

  get canApproveLeave(): boolean {
    return this.authService.isAdmin() || this.authService.isHR();
  }

  isSelfLeave(l: LeaveDto): boolean {
    return !!(this.myProfile?.id && l.teacherId === this.myProfile.id);
  }

  isSelfReg(r: TeacherAttendanceRegularizationDto): boolean {
    return !!(this.myProfile?.id && r.teacherId === this.myProfile.id);
  }

  get pendingRegCount(): number {
    return this.regularizations.filter(r => r.status === 'Pending').length;
  }

  get approvedRegCount(): number {
    return this.regularizations.filter(r => r.status === 'Approved').length;
  }

  get filteredLeaves(): LeaveDto[] {
    return this.leaves.filter(l => {
      // Status filter
      if (this.filterStatus !== 'All' && l.status !== this.filterStatus) return false;
      // Leave Type filter
      if (this.filterLeaveType !== 'All' && l.leaveType !== this.filterLeaveType) return false;
      // Search query
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const matchName = l.teacherName?.toLowerCase().includes(q);
        const matchCode = l.employeeCode?.toLowerCase().includes(q);
        const matchReason = l.reason?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchReason) return false;
      }
      return true;
    });
  }

  get filteredRegularizations(): TeacherAttendanceRegularizationDto[] {
    return this.regularizations.filter(r => {
      if (this.filterRegStatus !== 'All' && r.status !== this.filterRegStatus) return false;
      if (this.filterRegTeacherId && r.teacherId !== this.filterRegTeacherId) return false;
      if (this.regSearchQuery) {
        const q = this.regSearchQuery.toLowerCase();
        const mTeacher = r.teacherName?.toLowerCase().includes(q);
        const mCode = r.employeeCode?.toLowerCase().includes(q);
        const mReason = r.reason?.toLowerCase().includes(q);
        if (!mTeacher && !mCode && !mReason) return false;
      }
      return true;
    });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(p => {
      if (p['teacherId']) this.filterTeacherId = p['teacherId'];
    });
    this.loadAll();
  }

  loadAll() {
    this.loadStats();
    this.loadLeaves();
    this.loadRegularizations();
    this.loadMyProfile();
    this.loadTeachers();
    this.loadTeacherBalances();
  }

  loadMyProfile() {
    this.http.get<any>(`${API_BASE}/teachers/my-profile`).subscribe({
      next: p => {
        if (p?.isLinked) {
          this.myProfile = p;
          this.loadTeacherBalances();
        }
      },
      error: () => {}
    });
  }

  loadTeachers() {
    this.http.get<TeacherDto[]>(`${API_BASE}/teachers?activeOnly=true`).subscribe({
      next: t => this.teachers = t.filter(x => x.isActive !== false && !x.leavingDate),
      error: () => {}
    });
  }

  loadStats() {
    this.http.get<any>(`${API_BASE}/teachers/leaves/stats`).subscribe({
      next: s => {
        this.stats.pending = s.pending || 0;
        this.stats.approvedThisMonth = s.approvedThisMonth || 0;
        this.stats.onLeaveToday = s.onLeaveToday || 0;
        this.stats.totalThisYear = s.totalThisYear || 0;
        if (s.isTeacher && s.teacherName) {
          this.myProfile = {
            ...this.myProfile,
            fullName: s.teacherName,
            id: s.teacherId,
            employeeCode: s.employeeCode || this.myProfile?.employeeCode
          };
          this.loadTeacherBalances();
        }
      },
      error: () => {}
    });
  }

  loadTeacherBalances() {
    let targetId = '';
    if (this.isTeacher) {
      targetId = this.myProfile?.id || (this.stats as any)?.teacherId || '';
    } else {
      targetId = this.filterTeacherId || this.myProfile?.id || '';
    }

    if (!targetId) {
      this.currentTeacherBalances = null;
      return;
    }

    this.loadingBalances = true;
    this.http.get<TeacherLeaveBalancesSummaryDto>(`${API_BASE}/teachers/${targetId}/leave-balances`).subscribe({
      next: res => {
        this.currentTeacherBalances = res;
        this.loadingBalances = false;
        if (!this.myProfile?.employeeCode && res?.employeeCode) {
          if (this.myProfile) this.myProfile.employeeCode = res.employeeCode;
        }
      },
      error: () => {
        this.loadingBalances = false;
      }
    });
  }

  onTeacherFilterChange() {
    this.loadLeaves();
    this.loadTeacherBalances();
  }

  loadLeaves() {
    this.loading = true;
    const params: any = {};
    if (this.filterStatus && this.filterStatus !== 'All') params.status = this.filterStatus;
    if (this.filterTeacherId) params.teacherId = this.filterTeacherId;
    if (this.searchQuery) params.search = this.searchQuery;

    this.http.get<LeaveDto[]>(`${API_BASE}/teachers/all-leaves`, { params }).subscribe({
      next: r => {
        this.leaves = r;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  get currentEmployeeCode(): string {
    return this.myProfile?.employeeCode || this.teachers?.find(t => t.id === this.myProfile?.id)?.employeeCode || '';
  }

  openApplyDialog() {
    if (this.myProfile?.id && !this.myProfile.employeeCode) {
      const match = this.teachers.find(t => t.id === this.myProfile.id);
      if (match?.employeeCode) {
        this.myProfile.employeeCode = match.employeeCode;
      }
    }
    const ref = this.dialog.open(ApplyTeacherLeaveDialogComponent, {
      data: {
        isTeacher: this.isTeacher,
        teachers: this.teachers,
        myProfile: this.myProfile
      },
      disableClose: true,
      maxWidth: '94vw',
      width: '680px'
    });
    ref.afterClosed().subscribe(res => {
      if (res) {
        this.loadAll();
      }
    });
  }

  quickApprove(l: LeaveDto) {
    this.confirm.confirm(
      'Approve Faculty Leave',
      `Approve <strong>${l.leaveType}</strong> application for <strong>${l.teacherName}</strong> (${l.totalDays} days: ${l.fromDate.substring(0, 10)} to ${l.toDate.substring(0, 10)})?<br><br><span style="color:#16a34a; font-size:12px;">Attendance for these days will automatically be synchronized as "Leave".</span>`,
      'Approve & Sync', 'cancel'
    ).subscribe(ok => {
      if (!ok) return;
      this.http.put(`${API_BASE}/teachers/leaves/${l.id}/approve`, {
        approve: true
      }).subscribe({
        next: () => {
          this.loadAll();
        },
        error: () => {}
      });
    });
  }

  openRejectDialog(l: LeaveDto) {
    const ref = this.dialog.open(RejectTeacherLeaveDialogComponent, {
      data: {
        id: l.id,
        teacherName: l.teacherName,
        employeeCode: l.employeeCode,
        leaveType: l.leaveType
      },
      disableClose: true,
      maxWidth: '92vw',
      width: '460px'
    });
    ref.afterClosed().subscribe(res => {
      if (res) {
        this.loadAll();
      }
    });
  }

  deleteLeave(l: LeaveDto) {
    const isSelfCancel = this.isTeacher && l.status === 'Pending';
    const title = isSelfCancel ? 'Cancel Leave Application' : 'Delete Leave Record';
    const msg = isSelfCancel 
      ? `Are you sure you want to cancel your leave application for <strong>${l.fromDate.substring(0, 10)}</strong>?`
      : `Delete leave record for <strong>${l.teacherName}</strong>?`;

    this.confirm.confirm(title, msg, isSelfCancel ? 'Cancel Leave' : 'Delete', 'Dismiss').subscribe(ok => {
      if (!ok) return;
      this.http.delete(`${API_BASE}/teachers/leaves/${l.id}`).subscribe({
        next: () => {
          this.loadAll();
        },
        error: () => {}
      });
    });
  }

  loadRegularizations() {
    this.loadingRegs = true;
    const params: any = {};
    if (this.filterRegStatus && this.filterRegStatus !== 'All') params.status = this.filterRegStatus;
    if (this.filterRegTeacherId) params.teacherId = this.filterRegTeacherId;

    this.http.get<TeacherAttendanceRegularizationDto[]>(`${API_BASE}/teachers/regularizations`, { params }).subscribe({
      next: res => {
        this.regularizations = res;
        this.loadingRegs = false;
      },
      error: () => {
        this.loadingRegs = false;
      }
    });
  }

  openRegularizationDialog(teacherId?: string, targetDate?: string) {
    if (this.myProfile?.id && !this.myProfile.employeeCode) {
      const match = this.teachers.find(t => t.id === this.myProfile.id);
      if (match?.employeeCode) {
        this.myProfile.employeeCode = match.employeeCode;
      }
    }
    const ref = this.dialog.open(ApplyTeacherRegularizationDialogComponent, {
      data: {
        isTeacherSelf: this.isTeacher,
        isTeacher: this.isTeacher,
        teachers: this.teachers.filter(t => t.isActive !== false && !t.leavingDate),
        myProfile: this.myProfile,
        preSelectTeacherId: teacherId || this.myProfile?.id,
        targetTeacherId: teacherId || this.myProfile?.id,
        preSelectDate: targetDate,
        targetDate: targetDate
      },
      disableClose: true,
      maxWidth: '92vw',
      width: '560px'
    });
    ref.afterClosed().subscribe(res => {
      if (res) {
        this.loadRegularizations();
      }
    });
  }

  openReviewRegularizationDialog(r: TeacherAttendanceRegularizationDto, isApproved: boolean) {
    const ref = this.dialog.open(ReviewTeacherRegularizationDialogComponent, {
      data: {
        regularization: r,
        isApproved: isApproved
      },
      disableClose: true,
      maxWidth: '92vw',
      width: '480px'
    });
    ref.afterClosed().subscribe(res => {
      if (res) {
        this.loadRegularizations();
      }
    });
  }

  openPolicySettingsDialog() {
    const ref = this.dialog.open(LeavePolicySettingsDialogComponent, {
      disableClose: true,
      width: '680px',
      maxWidth: '95vw',
      panelClass: 'no-overflow-dialog'
    });
    ref.afterClosed().subscribe(res => {
      if (res) {
        this.loadAll();
      }
    });
  }

  openRequestCancellationDialog(l: LeaveDto) {
    const ref = this.dialog.open(RequestLeaveCancellationDialogComponent, {
      data: { leave: l },
      disableClose: true,
      maxWidth: '95vw',
      width: '640px',
      panelClass: 'no-overflow-dialog'
    });
    ref.afterClosed().subscribe(res => {
      if (res) {
        this.loadAll();
      }
    });
  }

  openReviewCancellationDialog(l: LeaveDto) {
    const ref = this.dialog.open(ReviewLeaveCancellationDialogComponent, {
      data: { leave: l },
      disableClose: true,
      maxWidth: '94vw',
      width: '600px'
    });
    ref.afterClosed().subscribe(res => {
      if (res) {
        this.loadAll();
      }
    });
  }

  formatLeaveType(type: string): string {
    if (!type) return 'Leave';
    return type.replace(/([A-Z])/g, ' $1').trim();
  }

  formatBalanceLeaveType(type: string): string {
    switch (type) {
      case 'CasualLeave': return 'Casual Leave (CL)';
      case 'SickLeave': return 'Sick Leave (SL)';
      case 'EarnedLeave': return 'Earned Leave (EL)';
      case 'UnpaidLeave': return 'Unpaid Leave (LWP)';
      default: return this.formatLeaveType(type);
    }
  }

  getLeaveIcon(type: string): string {
    switch (type) {
      case 'CasualLeave': return 'beach_access';
      case 'SickLeave': return 'medical_services';
      case 'EarnedLeave': return 'flight_takeoff';
      case 'UnpaidLeave': return 'money_off';
      default: return 'event_note';
    }
  }

  getBalMeterPercent(b: any): number {
    if (!b || !b.allocatedDays || b.allocatedDays <= 0) return 0;
    const pct = Math.round((b.availableBalance / b.allocatedDays) * 100);
    return Math.max(0, Math.min(100, pct));
  }

  toUtc(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Date) return val;
    let str = String(val).trim();
    if (!str) return null;
    // Pure date without time (e.g. 2026-09-27)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return new Date(str + 'T00:00:00');
    }
    // Standardize space separator to ISO 'T'
    str = str.replace(' ', 'T');
    // If timestamp string lacks timezone indicator (no 'Z' and no offset +/-HH:mm), mark as UTC ('Z')
    if (!str.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(str)) {
      str = str + 'Z';
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'Approved': return 'check_circle';
      case 'Rejected': return 'cancel';
      default: return 'hourglass_top';
    }
  }
}
