import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TeacherSelectorComponent } from './teacher-selector.component';
import { API_BASE, AttendancePermissionsDto, AttendanceSettingsDto, TeacherDto, AttendanceDto, AttendanceSummaryDto, HolidayDto, LeaveDto } from './teacher.models';
import { ApplyTeacherRegularizationDialogComponent } from './teacher-regularization-dialog.component';
import { AttendanceShiftSettingsDialogComponent } from '../../shared/components/attendance-shift-settings-dialog.component';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { LocalDatetimePipe } from '../../shared/pipes/local-datetime.pipe';
import { AuthService } from '../../core/services/auth.service';

export interface CalendarDayItem {
  dayNumber: number;
  dateStr: string;
  dayOfWeek: string;
  isToday: boolean;
  isSunday: boolean;
  isSaturday: boolean;
  isDeclaredHoliday?: boolean;
  holidayTitle?: string;
  status: 'Present' | 'Absent' | 'Late' | 'HalfDay' | 'Holiday' | 'Leave' | 'Unmarked' | 'PriorJoining';
  record?: AttendanceDto;
  isPriorToJoining?: boolean;
  isCancellationPending?: boolean;
  cancellationDetails?: string;
}

@Component({
  selector: 'app-teacher-attendance',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatSelectModule, MatProgressBarModule,
    MatDialogModule, MatTooltipModule, TeacherSelectorComponent, LocalDatetimePipe
  ],
  template: `
<div class="page-container">
  <div class="page-header">
    <div>
      <h1 class="page-title"><mat-icon>event_available</mat-icon> Faculty Attendance & Roster</h1>
      <p class="page-subtitle">Track daily check-ins, monthly attendance registers, and automated salary deductions.</p>
    </div>
  </div>

  <app-teacher-selector [preSelectId]="preSelectId" (teacherSelected)="onTeacherSelected($event)"></app-teacher-selector>

  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

  <div *ngIf="!selectedTeacher" class="no-selection">
    <mat-icon>person_search</mat-icon>
    <p>Please select a faculty member above to view attendance records or mark attendance.</p>
  </div>

  <div *ngIf="selectedTeacher" class="attendance-wrapper">
    <!-- Sleek Horizontal Toolbar (Fixed Width Dropdowns & Non-Wrapping Bar) -->
    <div class="attendance-toolbar mat-elevation-z1">
      <div class="toolbar-left">
        <div class="period-selectors">
          <!-- Month Dropdown -->
          <mat-form-field appearance="outline" class="month-select-field" subscriptSizing="dynamic">
            <mat-label>Month</mat-label>
            <mat-select [(ngModel)]="attMonth" (ngModelChange)="loadAttendance()">
              <mat-option *ngFor="let m of months; let i = index" [value]="i+1">{{m}}</mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Year Dropdown -->
          <mat-form-field appearance="outline" class="year-select-field" subscriptSizing="dynamic">
            <mat-label>Year</mat-label>
            <mat-select [(ngModel)]="attYear" (ngModelChange)="loadAttendance()">
              <mat-option *ngFor="let y of years" [value]="y">{{y}}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </div>

      <div class="toolbar-right">
        <button mat-stroked-button color="primary" class="settings-toolbar-btn" *ngIf="canManageAttendance && attendancePermissions.canChangeMode" (click)="openShiftSettingsDialog()" matTooltip="Configure Shift Timings & Attendance Policies for Faculty and Students">
          <mat-icon>settings</mat-icon> Shift &amp; Policies
        </button>

        <button mat-stroked-button class="regularize-toolbar-btn" (click)="openRegularizationDialog()" matTooltip="Request Attendance Regularization for missed punches or duty tour">
          <mat-icon>build_circle</mat-icon> Regularize
        </button>

      </div>
    </div>

    <!-- Monthly Summary KPI Badges -->
    <div class="summary-cards-grid" *ngIf="summary">
      <div class="sum-card present">
        <div class="card-icon"><mat-icon>check_circle</mat-icon></div>
        <div class="card-data">
          <span class="val">{{summary.presentDays}}</span>
          <small>Present Days</small>
        </div>
      </div>

      <div class="sum-card absent">
        <div class="card-icon"><mat-icon>cancel</mat-icon></div>
        <div class="card-data">
          <span class="val">{{summary.absentDays}}</span>
          <small>Absent Days</small>
        </div>
      </div>

      <div class="sum-card late" [class.warning-excess]="summary.lateDays > (summary.allowedLateDays || 3)"
        [matTooltip]="getLateQuotaTooltip()">
        <div class="card-icon"><mat-icon>timelapse</mat-icon></div>
        <div class="card-data">
          <div class="val-wrapper">
            <span class="val">{{summary.lateDays}}</span>
            <span class="quota-badge" *ngIf="summary.allowedLateDays !== undefined"
              [class.grace-ok]="summary.lateDays <= (summary.allowedLateDays || 3)"
              [class.grace-exceeded]="summary.lateDays > (summary.allowedLateDays || 3)">
              {{ summary.lateDays <= (summary.allowedLateDays || 3) ? (((summary.allowedLateDays || 3) - summary.lateDays) + ' left') : (summary.excessLateDays + ' excess') }}
            </span>
          </div>
          <small>Late Marks (Max {{summary.allowedLateDays || 3}} Free)</small>
        </div>
      </div>

      <div class="sum-card half">
        <div class="card-icon"><mat-icon>hourglass_bottom</mat-icon></div>
        <div class="card-data">
          <span class="val">{{summary.halfDays}}</span>
          <small>Half Days</small>
        </div>
      </div>

      <div class="sum-card holiday">
        <div class="card-icon"><mat-icon>beach_access</mat-icon></div>
        <div class="card-data">
          <span class="val">{{summary.holidayDays}}</span>
          <small>Holidays / Off</small>
        </div>
      </div>

      <div class="sum-card pct">
        <div class="card-icon"><mat-icon>analytics</mat-icon></div>
        <div class="card-data">
          <span class="val">{{summary.attendancePercentage}}%</span>
          <small>Compliance %</small>
        </div>
      </div>

      <div class="sum-card total">
        <div class="card-icon"><mat-icon>calendar_today</mat-icon></div>
        <div class="card-data">
          <span class="val">{{summary.totalWorkingDays}}</span>
          <small>Working Days</small>
        </div>
      </div>
    </div>

    <!-- Monthly Visual Attendance Heatmap Grid (Classplus/Teachmint Standard) -->
    <div class="calendar-card mat-elevation-z1">
      <div class="calendar-header">
        <div class="cal-title">
          <mat-icon color="primary">calendar_view_month</mat-icon>
          <strong>{{months[attMonth - 1]}} {{attYear}} Monthly Day-by-Day Roster</strong>
        </div>

        <div class="legend-chips">
          <span class="leg present">● Present</span>
          <span class="leg absent">● Absent</span>
          <span class="leg late">● Late</span>
          <span class="leg half">● Half Day</span>
          <span class="leg leave">● Leave</span>
          <span class="leg cancel-req">⏳ Cancel Pending</span>
          <span class="leg pub-holiday">★ Public Holiday</span>
          <span class="leg sunday">● Sunday Off</span>
          <span class="leg prior-joining">◌ Prior to Joining</span>
          <span class="leg unmarked">○ Unmarked</span>
        </div>
      </div>

      <!-- Quick Action Selection Toolbar -->
      <div class="multi-select-toolbar" *ngIf="canManageAttendance && attendanceMode !== 'Biometric'">
        <div class="mst-left">
          <span class="mst-title"><mat-icon>checklist</mat-icon> Quick Selection:</span>
          <button type="button" class="mst-btn" (click)="selectAllWorkingDays()" matTooltip="Select all working days in this month">
            <mat-icon>fact_check</mat-icon> Select All Working Days
          </button>
          <button type="button" class="mst-btn" (click)="selectAllAbsentDays()" matTooltip="Select all unmarked / absent days">
            <mat-icon>rule</mat-icon> Select Unmarked / Absent
          </button>
          <button type="button" class="mst-btn save-month" (click)="saveFacultyMonthlyRegister()" [disabled]="batchSavingDates" matTooltip="Auto-fill entire month: Checked days as Present, Unchecked working days as Absent">
            <mat-icon>{{ batchSavingDates ? 'hourglass_empty' : 'save_as' }}</mat-icon>
            <span>{{ batchSavingDates ? 'Saving...' : 'Auto-Fill Full Month Register' }}</span>
          </button>
          <button type="button" class="mst-btn clear" *ngIf="selectedMatrixDates.size > 0" (click)="clearDateSelection()">
            <mat-icon>clear_all</mat-icon> Clear Selection ({{ selectedMatrixDates.size }})
          </button>
        </div>
        <div class="mst-right" *ngIf="selectedMatrixDates.size > 0">
          <span class="mst-counter-badge">{{ selectedMatrixDates.size === 1 ? '1 Day Selected' : selectedMatrixDates.size + ' Days Selected' }}</span>
        </div>
      </div>

      <div class="days-heatmap-grid">
        <div class="day-cell" *ngFor="let d of calendarDays"
          [class.present]="d.status === 'Present'"
          [class.absent]="d.status === 'Absent'"
          [class.late]="d.status === 'Late'"
          [class.half]="d.status === 'HalfDay'"
          [class.leave]="d.status === 'Leave'"
          [class.cancel-pending]="d.isCancellationPending"
          [class.public-holiday]="d.isDeclaredHoliday && !d.record"
          [class.sunday-off]="isWeeklyOffDay(d) && !d.record && !d.isDeclaredHoliday"
          [class.today]="d.isToday"
          [class.future-date]="d.dateStr > todayStr"
          [class.prior-joining]="d.isPriorToJoining"
          [class.selected-for-batch]="selectedMatrixDates.has(d.dateStr)"
          (click)="onDayCellClick(d)"
          [matTooltip]="getDayTooltip(d)">

          <!-- Smart Checkbox on selectable days -->
          <div class="cell-check-box" *ngIf="isSelectableWorkingDay(d)" (click)="$event.stopPropagation()">
            <input type="checkbox"
              class="day-register-checkbox"
              [checked]="selectedMatrixDates.has(d.dateStr)"
              (change)="toggleDateSelect(d)">
          </div>

          <span class="cell-num">{{d.dayNumber}}</span>
          <span class="cell-sub">{{d.dayOfWeek}}</span>
          <span class="cell-tag">{{ getCellShortTag(d) }}</span>
        </div>
      </div>

      <!-- Floating Action Bar (Unified Single & Multi-Day) -->
      <div class="matrix-floating-bar" *ngIf="selectedMatrixDates.size > 0">
        <div class="mfb-left">
          <div class="mfb-badge">{{ selectedMatrixDates.size }}</div>
          <div class="mfb-text">
            <strong>{{ getSelectedDateSummaryTitle() }}</strong>
            <small>{{ selectedMatrixDates.size === 1 ? 'Choose status, timings & click Save' : 'Apply status & timings to all ' + selectedMatrixDates.size + ' selected dates' }}</small>
          </div>
        </div>
        <div class="mfb-center">
          <button type="button" class="mfb-pill pill-p" [class.active]="batchTargetStatus === 'Present'" (click)="batchTargetStatus = 'Present'">
            <mat-icon>check_circle</mat-icon> Present
          </button>
          <button type="button" class="mfb-pill pill-a" [class.active]="batchTargetStatus === 'Absent'" (click)="batchTargetStatus = 'Absent'">
            <mat-icon>cancel</mat-icon> Absent
          </button>
          <button type="button" class="mfb-pill pill-lt" [class.active]="batchTargetStatus === 'Late'" (click)="batchTargetStatus = 'Late'">
            <mat-icon>schedule</mat-icon> Late
          </button>
          <button type="button" class="mfb-pill pill-hd" [class.active]="batchTargetStatus === 'HalfDay'" (click)="batchTargetStatus = 'HalfDay'">
            <mat-icon>hourglass_bottom</mat-icon> Half Day
          </button>
          <button type="button" class="mfb-pill pill-l" [class.active]="batchTargetStatus === 'Leave'" (click)="batchTargetStatus = 'Leave'">
            <mat-icon>event_busy</mat-icon> Leave
          </button>

          <!-- Quick Shift Presets (School Day Shift vs Coaching Morning vs Coaching Evening) -->
          <div class="mfb-shift-presets" *ngIf="batchTargetStatus !== 'Absent' && batchTargetStatus !== 'Leave'">
            <button type="button" class="mfb-shift-btn" [class.active]="activeShiftType === 'school'" (click)="setShiftType('school')" matTooltip="Standard School / Day Shift">
              <mat-icon>school</mat-icon> Day Shift
            </button>
            <button type="button" class="mfb-shift-btn morning" [class.active]="activeShiftType === 'coaching_morning'" (click)="setShiftType('coaching_morning')" matTooltip="Coaching Morning Shift">
              <mat-icon>wb_sunny</mat-icon> Morn
            </button>
            <button type="button" class="mfb-shift-btn evening" [class.active]="activeShiftType === 'coaching_evening'" (click)="setShiftType('coaching_evening')" matTooltip="Coaching Evening Shift">
              <mat-icon>nights_stay</mat-icon> Eve
            </button>
          </div>

          <!-- Timings Inputs -->
          <div class="mfb-time-wrap" *ngIf="batchTargetStatus !== 'Absent' && batchTargetStatus !== 'Leave'">
            <label>In:</label>
            <input type="time" class="mfb-time-input" [(ngModel)]="batchTargetCheckIn" title="In Time">
          </div>
          <div class="mfb-time-wrap" *ngIf="batchTargetStatus !== 'Absent' && batchTargetStatus !== 'Leave'">
            <label>Out:</label>
            <input type="time" class="mfb-time-input" [(ngModel)]="batchTargetCheckOut" title="Out Time">
          </div>

          <input type="text" class="mfb-remarks-input" [(ngModel)]="batchTargetRemarks" placeholder="Optional notes / remarks...">
        </div>
        <div class="mfb-right">
          <button type="button" class="mfb-save-btn" [disabled]="batchSavingDates" (click)="applyMultiDatesAttendance()">
            <mat-icon *ngIf="!batchSavingDates">save</mat-icon>
            <mat-icon class="spin" *ngIf="batchSavingDates">refresh</mat-icon>
            <span>{{ selectedMatrixDates.size === 1 ? 'Save Record' : 'Save (' + selectedMatrixDates.size + ' Days)' }}</span>
          </button>
          <button type="button" class="mfb-close-btn" (click)="clearDateSelection()" matTooltip="Cancel selection">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- Detailed Attendance Log Table -->
    <mat-card class="table-card mat-elevation-z1" *ngIf="records.length > 0">
      <div class="table-card-header">
        <div class="table-title-group">
          <strong>Detailed Attendance Register ({{records.length}} Records)</strong>
          <span class="table-scroll-hint"><mat-icon>swap_horiz</mat-icon> Swipe to view all columns & actions</span>
        </div>
      </div>
      <div class="table-responsive">
        <table class="att-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Day</th>
              <th>Status</th>
              <th>Source</th>
              <th>Check-in (IST)</th>
              <th>Check-out (IST)</th>
              <th>Work Duration</th>
              <th>Remarks</th>
              <th class="actions-col">{{canManageAttendance ? 'Action' : 'Request'}}</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let a of records">
              <td><strong>{{a.attendanceDate | date:'dd MMM yyyy'}}</strong></td>
              <td><span class="day-label">{{a.attendanceDate | date:'EEEE'}}</span></td>
              <td><span class="status-badge" [ngClass]="getEffectiveStatus(a).toLowerCase()">{{getEffectiveStatus(a) === 'HalfDay' ? 'Half Day' : getEffectiveStatus(a)}}</span></td>
              <td><span class="source-tag">{{ a.captureSource || 'Manual' }}</span></td>
              <td>
                <span class="time-main">{{ a.captureSource === 'Biometric' && a.capturedAt ? (a.capturedAt | localDatetime:'time24') : (a.checkInTime || '—') }}</span>
                <small class="time-sub" *ngIf="a.captureSource === 'Biometric' && a.capturedAt">
                  ({{ a.capturedAt | localDatetime:'time' }})
                </small>
                <small class="time-sub" *ngIf="a.captureSource !== 'Biometric' && formatDisplayTime(a.checkInTime) && formatDisplayTime(a.checkInTime) !== a.checkInTime">
                  ({{ formatDisplayTime(a.checkInTime) }})
                </small>
              </td>
              <td>
                <span class="time-main">{{ a.captureSource === 'Biometric' && a.checkOutTime && a.capturedAt ? (a.capturedAt | localDatetime:'time24') : (a.checkOutTime || '—') }}</span>
                <small class="time-sub" *ngIf="a.captureSource === 'Biometric' && a.checkOutTime && a.capturedAt">
                  ({{ a.capturedAt | localDatetime:'time' }})
                </small>
                <small class="time-sub" *ngIf="a.captureSource !== 'Biometric' && formatDisplayTime(a.checkOutTime) && formatDisplayTime(a.checkOutTime) !== a.checkOutTime">
                  ({{ formatDisplayTime(a.checkOutTime) }})
                </small>
              </td>
              <td>
                <span class="work-duration" *ngIf="calculateDuration(a.checkInTime, a.checkOutTime)">
                  {{calculateDuration(a.checkInTime, a.checkOutTime)}}
                </span>
                <span *ngIf="!calculateDuration(a.checkInTime, a.checkOutTime)" class="no-dur">—</span>
              </td>
              <td class="remarks-cell">{{a.remarks || '—'}}</td>
              <td class="actions-col" *ngIf="canManageAttendance">
                <span class="action-btn-wrapper" [class.is-disabled]="isEditDisabled(a)" [matTooltip]="getEditTooltip(a)" (click)="isEditDisabled(a) ? editRecord(a) : null">
                  <button mat-icon-button color="primary" (click)="editRecord(a)" [disabled]="isEditDisabled(a)">
                    <mat-icon>edit</mat-icon>
                  </button>
                </span>
                <span class="action-btn-wrapper" [class.is-disabled]="isDeleteDisabled(a)" [matTooltip]="getDeleteTooltip(a)" (click)="isDeleteDisabled(a) ? deleteRecord(a.id) : null">
                  <button mat-icon-button color="warn" (click)="deleteRecord(a.id)" [disabled]="isDeleteDisabled(a)">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </span>
              </td>
              <td class="actions-col" *ngIf="!canManageAttendance">
                <button *ngIf="canRegularizeRecord(a)" mat-stroked-button class="reg-btn-row" (click)="openRegularizationDialog(a.attendanceDate.split('T')[0])" matTooltip="Request Attendance Regularization for this date">
                  <mat-icon style="font-size:14px;width:14px;height:14px;">build_circle</mat-icon> Regularize
                </button>
                <span *ngIf="!canRegularizeRecord(a)" class="no-dur">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </mat-card>

    <div class="empty-state" *ngIf="records.length === 0 && !loading">
      <mat-icon>event_busy</mat-icon>
      <h3>No Attendance Records Found</h3>
      <p>No records found for {{months[attMonth - 1]}} {{attYear}}. Select dates on the calendar roster above to begin logging attendance.</p>
    </div>
  </div>
</div>
  `,
  styles: [`
    .page-container { display:flex; flex-direction:column; gap:20px; }
    .page-header { display:flex; justify-content:space-between; align-items:center; }
    .page-title { font-size:1.5rem; font-weight:700; margin:0; color:#1976d2; display:flex; align-items:center; gap:8px;
      mat-icon{font-size:1.6rem;width:1.6rem;height:1.6rem;} }
    .page-subtitle { color:#64748b; margin:4px 0 0; font-size:.9rem; }

    .no-selection { display:flex; flex-direction:column; align-items:center; padding:60px 20px; color:#94a3b8; background:#f8fafc; border-radius:12px; border:2px dashed #cbd5e1;
      mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px;} p{margin:0;font-size:1rem;font-weight:500;} }

    .attendance-wrapper { display:flex; flex-direction:column; gap:18px; }

    /* Fixed Horizontal Toolbar (Single Line, Non-Wrapping) */
    .attendance-toolbar {
      background: #ffffff;
      border-radius: 12px;
      padding: 10px 16px;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: nowrap;
      border: 1px solid #e2e8f0;
    }
    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .period-selectors {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    /* Compact widths ensuring everything stays in a single line */
    .month-select-field { width: 125px; min-width: 115px; }
    .year-select-field { width: 96px; min-width: 90px; }
    .mode-select { width: 215px; min-width: 200px; }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
      flex-shrink: 0;
    }
    .settings-toolbar-btn, .quick-today-btn, .regularize-toolbar-btn, .mark-btn {
      height: 38px;
      padding: 0 10px !important;
      font-size: 0.82rem;
      font-weight: 600;
      white-space: nowrap;
      flex-shrink: 0;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin: 0;
      }
    }
    .quick-today-btn { border-color: #0284c7; color: #0284c7; }
    .mark-btn { font-weight: 600; }

    /* Mark Attendance Form Card */
    .mark-form-card { padding:20px; border-radius:12px; display:flex; flex-direction:column; gap:16px; background:#fff; border:1px solid #cbd5e1; }
    .form-card-header { display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:10px; }
    .card-title { display:flex; align-items:center; gap:10px;
      strong{font-size:1.02rem;color:#1e293b;display:block;}
      p{margin:2px 0 0;font-size:.82rem;color:#64748b;} }
    .form-row { display:flex; flex-wrap:wrap; gap:14px; }
    .field-date { flex:1; min-width:160px; }
    .field-status { flex:1; min-width:160px; }
    .field-time { flex:1; min-width:130px; }
    .field-remarks { flex:2; min-width:200px; }

    .status-option { font-weight:600; font-size:.86rem;
      &.present{color:#16a34a;} &.absent{color:#dc2626;} &.late{color:#ea580c;}
      &.half{color:#9333ea;} &.holiday{color:#2563eb;} }

    .smart-rule-hint {
      display: flex; align-items: center; gap: 8px; background: #eff6ff;
      border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px 14px;
      font-size: 0.84rem; color: #1e40af; font-weight: 600;
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: #2563eb; }
    }

    .regularize-toolbar-btn {
      color: #2563eb !important;
      border-color: #bfdbfe !important;
      background: #eff6ff !important;
      font-weight: 600;
      &:hover { background: #dbeafe !important; }
    }

    .form-actions { display:flex; justify-content:flex-end; gap:12px; }

    /* Summary KPI Cards Grid */
    .summary-cards-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:12px; }
    .sum-card { padding:14px 16px; border-radius:12px; display:flex; align-items:center; gap:12px; border:1px solid transparent; }
    .sum-card .card-icon { mat-icon{font-size:24px;width:24px;height:24px;} }
    .sum-card .card-data { .val{display:block;font-size:1.35rem;font-weight:800;line-height:1.1;} small{font-size:.72rem;font-weight:600;} }
    .val-wrapper { display:flex; align-items:baseline; gap:6px; }
    .quota-badge {
      font-size:.65rem; font-weight:700; padding:1px 5px; border-radius:4px; text-transform:uppercase; letter-spacing:.3px;
      &.grace-ok { background:#fed7aa; color:#9a3412; }
      &.grace-exceeded { background:#fecaca; color:#991b1b; }
    }

    .sum-card.present { background:#f0fdf4; border-color:#bbf7d0; .val{color:#15803d;} small{color:#166534;} .card-icon mat-icon{color:#16a34a;} }
    .sum-card.absent { background:#fef2f2; border-color:#fecaca; .val{color:#b91c1c;} small{color:#991b1b;} .card-icon mat-icon{color:#dc2626;} }
    .sum-card.late {
      background:#fff7ed; border-color:#fed7aa; .val{color:#c2410c;} small{color:#9a3412;} .card-icon mat-icon{color:#ea580c;}
      &.warning-excess { background:#fff1f2; border-color:#fca5a5; }
    }
    .sum-card.half { background:#faf5ff; border-color:#e9d5ff; .val{color:#7e22ce;} small{color:#6b21a8;} .card-icon mat-icon{color:#9333ea;} }
    .sum-card.holiday { background:#eff6ff; border-color:#bfdbfe; .val{color:#1d4ed8;} small{color:#1e40af;} .card-icon mat-icon{color:#2563eb;} }
    .sum-card.pct { background:#f0f9ff; border-color:#bae6fd; .val{color:#0369a1;} small{color:#075985;} .card-icon mat-icon{color:#0284c7;} }
    .sum-card.total { background:#f8fafc; border-color:#e2e8f0; .val{color:#334155;} small{color:#475569;} .card-icon mat-icon{color:#64748b;} }

    /* Monthly Heatmap Roster */
    .calendar-card { background:#ffffff; border-radius:12px; padding:16px 20px; border:1px solid #e2e8f0; display:flex; flex-direction:column; gap:12px; }
    .calendar-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; }
    .cal-title { display:flex; align-items:center; gap:8px; font-size:.95rem; color:#1e293b; }
    .multi-select-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 12px;
      background: #f1f5f9;
      border-radius: 8px;
      margin-bottom: 12px;
      border: 1px solid #e2e8f0;
    }
    .mst-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .mst-right { display: flex; align-items: center; }
    .mst-title { font-size: 0.8rem; font-weight: 700; color: #334155; display: inline-flex; align-items: center; gap: 4px; }
    .mst-title mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
    .mst-btn {
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #334155;
      font-size: 0.74rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s ease;
      mat-icon { font-size: 15px; width: 15px; height: 15px; color: #64748b; }
      &:hover { background: #e0f2fe; color: #0284c7; border-color: #93c5fd; }
      &.clear { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }
      &.clear:hover { background: #fecaca; }
      &.save-month {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        color: #ffffff;
        border-color: #1d4ed8;
        box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
        mat-icon { color: #ffffff; }
        &:hover { background: #1d4ed8; }
        &:disabled { opacity: 0.6; cursor: not-allowed; }
      }
    }
    .mst-counter-badge {
      background: #2563eb;
      color: #ffffff;
      font-size: 0.74rem;
      font-weight: 800;
      padding: 3px 9px;
      border-radius: 12px;
    }

    .matrix-floating-bar {
      position: sticky;
      bottom: 12px;
      margin-top: 14px;
      background: #0f172a;
      color: #ffffff;
      border-radius: 12px;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      z-index: 50;
      border: 1px solid rgba(255,255,255,0.15);
      animation: mfbSlideUp 0.22s ease-out;
    }
    @keyframes mfbSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .mfb-left { display: flex; align-items: center; gap: 10px; }
    .mfb-badge {
      background: #2563eb;
      color: #fff;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 0.88rem;
    }
    .mfb-text { display: flex; flex-direction: column; }
    .mfb-text strong { font-size: 0.85rem; color: #f8fafc; }
    .mfb-text small { font-size: 0.7rem; color: #94a3b8; }
    .mfb-center { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: 1; justify-content: center; }
    .mfb-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.74rem;
      font-weight: 700;
      padding: 5px 11px;
      border-radius: 20px;
      border: 1.5px solid transparent;
      cursor: pointer;
      background: #1e293b;
      color: #cbd5e1;
      transition: all 0.15s ease;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { background: #334155; color: #ffffff; }
      &.pill-p.active { background: #16a34a; color: #fff; border-color: #22c55e; }
      &.pill-a.active { background: #dc2626; color: #fff; border-color: #ef4444; }
      &.pill-lt.active { background: #d97706; color: #fff; border-color: #f59e0b; }
      &.pill-hd.active { background: #7c3aed; color: #fff; border-color: #8b5cf6; }
      &.pill-l.active { background: #ea580c; color: #fff; border-color: #f97316; }
    }
    .mfb-remarks-input {
      background: #1e293b;
      border: 1px solid #334155;
      color: #ffffff;
      font-size: 0.76rem;
      padding: 6px 10px;
      border-radius: 6px;
      outline: none;
      min-width: 170px;
      &:focus { border-color: #3b82f6; }
    }
    .mfb-time-wrap {
      display: inline-flex; align-items: center; gap: 4px; background: #1e293b;
      padding: 3px 8px; border-radius: 6px; border: 1px solid #334155;
      label { font-size: 0.68rem; font-weight: 700; color: #94a3b8; }
    }
    .mfb-time-input {
      background: transparent; border: none; color: #ffffff; font-size: 0.74rem;
      font-weight: 700; outline: none; width: 82px;
      color-scheme: dark;
      &::-webkit-calendar-picker-indicator {
        filter: brightness(0) invert(1);
        cursor: pointer;
        opacity: 0.9;
        padding: 0;
        margin-left: 2px;
        &:hover { opacity: 1; }
      }
    }
    .mfb-right { display: flex; align-items: center; gap: 8px; }
    .mfb-save-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff;
      border: none;
      padding: 7px 16px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.82rem;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
      transition: all 0.15s ease;
      &:hover:not([disabled]) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(37, 99, 235, 0.45); }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      mat-icon.spin { animation: spin 1s linear infinite; }
    }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .mfb-close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      border-radius: 6px;
      &:hover { background: #334155; color: #ffffff; }
    }
    .legend-chips { display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:.76rem; font-weight:600;
      .leg.present{color:#16a34a;} .leg.leave{color:#d97706;font-weight:700;} .leg.cancel-req{color:#ea580c;font-weight:700;} .leg.absent{color:#dc2626;} .leg.late{color:#ea580c;}
      .leg.half{color:#9333ea;} .leg.pub-holiday{color:#b45309;font-weight:700;}
      .leg.sunday{color:#e11d48;font-weight:700;} .leg.saturday{color:#6366f1;font-weight:700;}
      .leg.prior-joining{color:#94a3b8;font-style:italic;}
      .leg.unmarked{color:#94a3b8;} }

    .days-heatmap-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(48px, 1fr)); gap:6px; }
    .day-cell {
      border:1px solid #e2e8f0; border-radius:8px; padding:6px 2px; text-align:center;
      cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:1px;
      background:#f8fafc; transition:all .15s;
      position: relative;
    }
    .cell-check-box {
      position: absolute;
      top: 2px;
      right: 2px;
      z-index: 3;
      line-height: 0;
      .day-register-checkbox {
        width: 14px;
        height: 14px;
        cursor: pointer;
        margin: 0;
        accent-color: #2563eb;
      }
    }
    .day-cell.selected-for-batch {
      border: 2.5px solid #2563eb !important;
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25) !important;
      transform: translateY(-2px);
    }
    .day-cell:hover { transform:scale(1.06); box-shadow:0 2px 8px rgba(0,0,0,0.1); }
    .day-cell.today { border:2px solid #0284c7; }
    .day-cell.present { background:#dcfce7; border-color:#86efac; .cell-num{color:#15803d;} .cell-tag{color:#166534;font-weight:700;} }
    .day-cell.leave {
      background:#fef3c7; border-color:#fcd34d;
      .cell-num{color:#92400e; font-weight:700;}
      .cell-tag{
        color:#b45309; font-weight:800; font-size:0.72rem;
        background:#fde68a; padding:1px 5px; border-radius:4px;
      }
    }
    .day-cell.cancel-pending {
      background: #fff7ed; border: 2px dashed #ea580c;
      .cell-num { color: #c2410c; font-weight: 800; }
      .cell-tag { color: #ea580c; font-weight: 800; letter-spacing: 0.5px; }
      .cell-sub { color: #ea580c; font-weight: 700; }
    }
    .day-cell.absent { background:#fee2e2; border-color:#fca5a5; .cell-num{color:#b91c1c;} .cell-tag{color:#991b1b;font-weight:700;} }
    .day-cell.late { background:#ffedd5; border-color:#fdba74; .cell-num{color:#c2410c;} .cell-tag{color:#9a3412;font-weight:700;} }
    .day-cell.half { background:#f3e8ff; border-color:#d8b4fe; .cell-num{color:#7e22ce;} .cell-tag{color:#6b21a8;font-weight:700;} }

    /* Vibrant Festive Amber/Gold for Official Public Holidays */
    .day-cell.public-holiday {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-color: #f59e0b;
      box-shadow: 0 1px 4px rgba(217, 119, 6, 0.2);
      .cell-num { color: #92400e; font-weight: 800; }
      .cell-tag { color: #b45309; font-weight: 800; letter-spacing: 0.5px; }
      .cell-sub { color: #b45309; font-weight: 700; }
    }

    /* Soft Rose / Coral for Sunday Weekly Off */
    .day-cell.sunday-off {
      background: #ffe4e6;
      border-color: #fca5a5;
      .cell-num { color: #be123c; font-weight: 700; }
      .cell-tag { color: #e11d48; font-weight: 700; }
      .cell-sub { color: #e11d48; }
    }

    /* Crisp Indigo / Lavender for Saturdays */
    .day-cell.saturday-off {
      background: #eef2ff;
      border-color: #c7d2fe;
      .cell-num { color: #4338ca; font-weight: 600; }
      .cell-tag { color: #6366f1; font-weight: 700; }
      .cell-sub { color: #6366f1; }
    }

    /* Future dates — greyed out, not clickable by default */
    .day-cell.future-date {
      background: #f1f5f9;
      border-color: #e2e8f0;
      opacity: 0.45;
      cursor: not-allowed;
      pointer-events: none;
      .cell-num { color: #94a3b8; }
      .cell-tag { color: #cbd5e1; }
      .cell-sub { color: #cbd5e1; }
    }
    .day-cell.future-date:hover { transform: none; box-shadow: none; }

    /* Prior to joining date — muted neutral grey, not counted as absent */
    .day-cell.prior-joining {
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      opacity: 0.6;
      cursor: help;
      .cell-num { color: #94a3b8; }
      .cell-tag { color: #94a3b8; font-weight: 600; }
      .cell-sub { color: #cbd5e1; }
      &:hover { transform: none; box-shadow: none; border-color: #94a3b8; }
    }

    /* When a future date has an approved Leave — do NOT grey out, keep vibrant warm amber & colorful 'L' tag */
    .day-cell.leave.future-date {
      background: #fef3c7 !important;
      border: 1.5px solid #f59e0b !important;
      opacity: 1 !important;
      cursor: pointer !important;
      pointer-events: auto !important;
      box-shadow: 0 1px 3px rgba(217, 119, 6, 0.15);
      .cell-num { color: #92400e !important; font-weight: 800 !important; }
      .cell-sub { color: #b45309 !important; font-weight: 600 !important; }
      .cell-tag {
        color: #78350f !important;
        background: #fde68a !important;
        font-weight: 900 !important;
        font-size: 0.74rem !important;
        padding: 1px 6px !important;
        border-radius: 4px !important;
        box-shadow: 0 1px 2px rgba(217, 119, 6, 0.2) !important;
      }
    }
    .day-cell.leave.future-date:hover {
      transform: scale(1.08) !important;
      box-shadow: 0 4px 10px rgba(217, 119, 6, 0.25) !important;
    }

    /* When a future date has a pending cancellation request */
    .day-cell.cancel-pending.future-date {
      background: #fff7ed !important;
      border: 2px dashed #ea580c !important;
      opacity: 1 !important;
      cursor: pointer !important;
      pointer-events: auto !important;
      .cell-num { color: #c2410c !important; font-weight: 800 !important; }
      .cell-sub { color: #ea580c !important; font-weight: 700 !important; }
      .cell-tag {
        color: #ffffff !important;
        background: #ea580c !important;
        font-weight: 800 !important;
        font-size: 0.72rem !important;
        padding: 1px 5px !important;
        border-radius: 4px !important;
      }
    }

    .cell-num { font-size:.82rem; font-weight:700; color:#334155; }
    .cell-sub { font-size:.68rem; font-weight:600; color:#64748b; line-height:1.1; }
    .cell-tag { font-size:.64rem; }

    /* Unified Multi-Date Quick Selection Toolbar */
    .multi-select-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 12px;
      background: #f1f5f9;
      border-radius: 8px;
      margin-bottom: 12px;
      border: 1px solid #e2e8f0;
    }
    .mst-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .mst-title { font-size: 0.8rem; font-weight: 700; color: #334155; display: inline-flex; align-items: center; gap: 4px; }
    .mst-title mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
    .mst-btn {
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #334155;
      font-size: 0.74rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s ease;
    }
    .mst-btn mat-icon { font-size: 15px; width: 15px; height: 15px; color: #64748b; }
    .mst-btn:hover { background: #e0f2fe; color: #0284c7; border-color: #93c5fd; }
    .mst-btn.clear { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }
    .mst-btn.clear:hover { background: #fecaca; }
    .mst-btn.save-month {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff;
      border-color: #1d4ed8;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
      mat-icon { color: #ffffff; }
      &:hover { background: #1d4ed8; }
      &:disabled { opacity: 0.6; cursor: not-allowed; }
    }
    .mst-counter-badge {
      background: #2563eb;
      color: #ffffff;
      font-size: 0.74rem;
      font-weight: 800;
      padding: 3px 9px;
      border-radius: 12px;
    }

    /* Floating Action Bar (Single & Multi-Select) */
    .matrix-floating-bar {
      position: sticky;
      bottom: 12px;
      margin-top: 14px;
      background: #0f172a;
      color: #ffffff;
      border-radius: 12px;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      z-index: 50;
      border: 1px solid rgba(255,255,255,0.15);
      animation: mfbSlideUp 0.22s ease-out;
    }
    @keyframes mfbSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .mfb-left { display: flex; align-items: center; gap: 10px; }
    .mfb-badge {
      background: #2563eb;
      color: #fff;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 0.88rem;
    }
    .mfb-text { display: flex; flex-direction: column; }
    .mfb-text strong { font-size: 0.85rem; color: #f8fafc; }
    .mfb-text small { font-size: 0.7rem; color: #94a3b8; }
    .mfb-center { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: 1; justify-content: center; }
    .mfb-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.74rem;
      font-weight: 700;
      padding: 5px 11px;
      border-radius: 20px;
      border: 1.5px solid transparent;
      cursor: pointer;
      background: #1e293b;
      color: #cbd5e1;
      transition: all 0.15s ease;
    }
    .mfb-pill mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .mfb-pill:hover { background: #334155; color: #ffffff; }
    .mfb-pill.pill-p.active { background: #16a34a; color: #fff; border-color: #22c55e; }
    .mfb-pill.pill-a.active { background: #dc2626; color: #fff; border-color: #ef4444; }
    .mfb-pill.pill-lt.active { background: #d97706; color: #fff; border-color: #f59e0b; }
    .mfb-pill.pill-hd.active { background: #7c3aed; color: #fff; border-color: #8b5cf6; }
    .mfb-pill.pill-l.active { background: #ea580c; color: #fff; border-color: #f97316; }
    .mfb-shift-presets { display: inline-flex; align-items: center; gap: 4px; background: #0f172a; padding: 2px 4px; border-radius: 8px; border: 1px solid #334155; }
    .mfb-shift-btn {
      display: inline-flex; align-items: center; gap: 4px; background: transparent; border: none;
      color: #94a3b8; font-size: 0.72rem; font-weight: 700; padding: 4px 8px; border-radius: 6px;
      cursor: pointer; transition: all 0.2s ease;
    }
    .mfb-shift-btn mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .mfb-shift-btn:hover { background: #1e293b; color: #f8fafc; }
    .mfb-shift-btn.active { background: #2563eb; color: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
    .mfb-shift-btn.morning.active { background: #d97706; color: #ffffff; }
    .mfb-shift-btn.evening.active { background: #7c3aed; color: #ffffff; }
    .mfb-remarks-input {
      background: #1e293b;
      border: 1px solid #334155;
      color: #ffffff;
      font-size: 0.76rem;
      padding: 6px 10px;
      border-radius: 6px;
      outline: none;
      min-width: 170px;
    }
    .mfb-remarks-input:focus { border-color: #3b82f6; }
    .mfb-time-wrap {
      display: inline-flex; align-items: center; gap: 4px; background: #1e293b;
      padding: 3px 8px; border-radius: 6px; border: 1px solid #334155;
    }
    .mfb-time-wrap label { font-size: 0.68rem; font-weight: 700; color: #94a3b8; }
    .mfb-time-input {
      background: transparent; border: none; color: #ffffff; font-size: 0.74rem;
      font-weight: 700; outline: none; width: 82px;
      color-scheme: dark;
    }
    .mfb-time-input::-webkit-calendar-picker-indicator {
      filter: brightness(0) invert(1);
      cursor: pointer;
      opacity: 0.9;
      padding: 0;
      margin-left: 2px;
    }
    .mfb-time-input::-webkit-calendar-picker-indicator:hover {
      opacity: 1;
    }
    .mfb-right { display: flex; align-items: center; gap: 8px; }
    .mfb-save-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff;
      border: none;
      padding: 7px 16px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.82rem;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
      transition: all 0.15s ease;
    }
    .mfb-save-btn:hover:not([disabled]) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(37, 99, 235, 0.45); }
    .mfb-save-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .mfb-close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      border-radius: 6px;
    }
    .mfb-close-btn:hover { background: #334155; color: #ffffff; }

    /* Table */
    .table-card { border-radius:12px; overflow:hidden; padding:0; border:1px solid #e2e8f0; width:100%; max-width:100%; box-sizing:border-box; }
    .table-card-header { padding:12px 18px; background:#f8fafc; border-bottom:1px solid #e2e8f0; font-size:.92rem; color:#1e293b; }
    .table-title-group { display:flex; justify-content:space-between; align-items:center; width:100%; flex-wrap:wrap; gap:8px; }
    .table-scroll-hint { display:none; align-items:center; gap:5px; font-size:.74rem; color:#0369a1; background:#e0f2fe; border:1px solid #bae6fd; padding:3px 8px; border-radius:6px; font-weight:600; mat-icon{font-size:15px;width:15px;height:15px;} }
    .table-responsive { width:100%; max-width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; }
    .att-table { width:100%; min-width:820px; border-collapse:collapse; font-size:.86rem; }
    .att-table th, .att-table td { padding:12px 14px; border-bottom:1px solid #f1f5f9; text-align:left; white-space:nowrap; }
    .att-table th { background:#f8fafc; font-weight:700; color:#64748b; font-size:.78rem; text-transform:uppercase; letter-spacing:.4px; position:sticky; top:0; z-index:1; }
    .att-table tr:hover td { background:#fbfcfd; }
    .att-table td.remarks-cell { white-space:normal; min-width:130px; max-width:220px; line-height:1.35; }
    /* Sticky first column (Date) for seamless mobile browsing */
    .att-table th:first-child, .att-table td:first-child {
      position:sticky; left:0; background:#ffffff; z-index:2; box-shadow:2px 0 6px rgba(0,0,0,0.04);
    }
    .att-table th:first-child { background:#f8fafc; z-index:3; }
    .att-table tr:hover td:first-child { background:#fbfcfd; }

    .day-label { font-size:.8rem; color:#64748b; }
    .source-tag { display:inline-block; padding:2px 8px; border-radius:6px; font-size:.76rem; font-weight:600; background:#f1f5f9; color:#475569; }
    .work-duration { background:#f1f5f9; color:#334155; padding:2px 8px; border-radius:6px; font-weight:600; font-size:.78rem; }
    .no-dur { color:#94a3b8; }
    .time-main { font-weight:600; color:#1e293b; }
    .actions-col { text-align:right; width:100px; white-space:nowrap; }
    .action-btn-wrapper {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
      &.is-disabled {
        cursor: not-allowed;
        button[disabled] {
          pointer-events: none;
        }
      }
    }

    .reg-btn-row {
      font-size: 0.72rem !important;
      padding: 0 10px !important;
      height: 28px !important;
      line-height: 28px !important;
      border-color: #818cf8 !important;
      color: #4338ca !important;
      background: #eef2ff !important;
      font-weight: 700 !important;
      border-radius: 6px !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
    }
    .reg-btn-row:hover { background: #e0e7ff !important; color: #3730a3 !important; }

    .status-badge { padding:3px 10px; border-radius:8px; font-size:.74rem; font-weight:700; text-transform:capitalize;
      &.present{background:#dcfce7;color:#15803d;}
      &.leave{background:#fef3c7;color:#92400e;}
      &.absent{background:#fee2e2;color:#b91c1c;}
      &.late{background:#ffedd5;color:#c2410c;}
      &.halfday{background:#f3e8ff;color:#7e22ce;}
      &.holiday{background:#dbeafe;color:#1d4ed8;} }

    .empty-state { display:flex; flex-direction:column; align-items:center; text-align:center; padding:50px 20px; color:#64748b; background:#f8fafc; border-radius:14px; border:2px dashed #cbd5e1;
      mat-icon{font-size:48px;width:48px;height:48px;color:#cbd5e1;margin-bottom:10px;}
      h3{margin:0 0 6px;color:#1e293b;font-size:1.1rem;font-weight:700;}
      p{margin:0;font-size:.88rem;} }

    @media (max-width: 900px) {
      .table-scroll-hint { display: inline-flex; }
      .attendance-toolbar {
        padding: 12px 14px;
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }
      .toolbar-left {
        width: 100%;
        gap: 10px;
      }
      .period-selectors {
        width: 100%;
        gap: 10px;
      }
      .month-select-field {
        flex: 1;
        width: auto;
        min-width: 0;
      }
      .year-select-field {
        width: 110px;
        min-width: 90px;
      }
      .toolbar-right {
        width: 100%;
        margin-left: 0;
        flex-wrap: wrap;
        gap: 8px;
      }
      .mode-select {
        width: 100%;
        min-width: 100%;
      }
      .quick-today-btn, .regularize-toolbar-btn, .mark-btn {
        flex: 1 1 calc(33.333% - 8px);
        min-width: 105px;
        padding: 0 8px !important;
        font-size: 0.78rem;
        justify-content: center;
      }
    }

    @media (max-width: 550px) {
      .page-container {
        padding: 8px;
      }
      .page-header {
        margin-bottom: 12px;
      }
      .table-card-header {
        padding: 10px 14px;
      }
      .att-table {
        min-width: 760px;
      }
      .att-table th, .att-table td {
        padding: 8px 10px;
        font-size: 0.78rem;
      }
      .actions-col {
        width: 80px;
        button {
          width: 32px;
          height: 32px;
          line-height: 32px;
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
        }
      }
      .quick-today-btn, .regularize-toolbar-btn, .mark-btn {
        flex: 1 1 100%;
        width: 100%;
      }
      .summary-cards-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }
      .days-heatmap-grid {
        grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
        gap: 4px;
      }
      .calendar-header {
        flex-direction: column;
        align-items: flex-start;
      }
      .legend-chips {
        font-size: 0.7rem;
        gap: 6px;
      }
      .multi-select-toolbar {
        flex-direction: column;
        align-items: stretch;
        padding: 10px;
        gap: 8px;
        width: 100%;
        box-sizing: border-box;
      }
      .mst-left {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        width: 100%;
      }
      .mst-title {
        grid-column: span 2;
        font-size: 0.84rem;
        font-weight: 700;
        margin-bottom: 2px;
      }
      .mst-btn {
        width: 100%;
        justify-content: center;
        height: 36px;
        padding: 6px 8px;
        font-size: 0.72rem;
        box-sizing: border-box;
        text-align: center;
      }
      .mst-btn.save-month {
        grid-column: span 2;
        height: 40px;
        font-size: 0.8rem;
      }
      .mst-btn.clear {
        grid-column: span 2;
        height: 34px;
      }
      .mst-right {
        justify-content: center;
        width: 100%;
      }
      .mst-counter-badge {
        width: 100%;
        text-align: center;
        box-sizing: border-box;
      }
    }
  `]
})
export class TeacherAttendanceComponent implements OnInit {
  private api = API_BASE;
  selectedTeacher: TeacherDto | null = null;
  preSelectId: string | null = null;
  records: AttendanceDto[] = [];
  holidays: HolidayDto[] = [];
  summary: AttendanceSummaryDto | null = null;
  loading = false;
  saving = false;
  showMarkForm = false;
  canEditPublicHolidayOrSunday = false;

  private static getTodayIstDateParts(): { year: number; month: number; day: number; str: string } {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(new Date());
      const year = parseInt(parts.find(p => p.type === 'year')?.value || '2026', 10);
      const month = parseInt(parts.find(p => p.type === 'month')?.value || '10', 10);
      const day = parseInt(parts.find(p => p.type === 'day')?.value || '13', 10);
      const str = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { year, month, day, str };
    } catch {
      const d = new Date();
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      return { year, month, day, str: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
    }
  }

  get todayStr(): string {
    return TeacherAttendanceComponent.getTodayIstDateParts().str;
  }

  attendanceMode: AttendanceSettingsDto['teacherMode'] = 'Both';
  private attendanceSettings: AttendanceSettingsDto = { studentMode: 'Both', teacherMode: 'Both' };
  attendancePermissions: AttendancePermissionsDto = { canChangeMode: false, canManualMark: false, canBiometricCapture: false, canMapBiometric: false, canCorrectAttendance: false };

  attMonth = TeacherAttendanceComponent.getTodayIstDateParts().month;
  attYear = TeacherAttendanceComponent.getTodayIstDateParts().year;

  months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  years = [2024, 2025, 2026, 2027];

  markData: any = {
    attendanceDate: TeacherAttendanceComponent.getTodayIstDateParts().str,
    status: 'Present',
    checkInTime: '08:00',
    checkOutTime: '17:00',
    remarks: ''
  };

  calendarDays: CalendarDayItem[] = [];
  teacherLeaves: LeaveDto[] = [];

  // Unified Multi-Date Matrix Selection & Floating Action Bar
  selectedMatrixDates = new Set<string>();
  batchTargetStatus: 'Present' | 'Absent' | 'Late' | 'HalfDay' | 'Leave' = 'Present';
  activeShiftType: 'school' | 'coaching_morning' | 'coaching_evening' = 'school';
  batchTargetCheckIn = '08:00';
  batchTargetCheckOut = '17:00';
  batchTargetRemarks = '';
  batchSavingDates = false;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private confirmDialog: ConfirmDialogService,
    private dialog: MatDialog,
    public auth: AuthService
  ) {}

  get isTeacher(): boolean {
    return this.auth.isTeacher();
  }

  get canManageAttendance(): boolean {
    return !this.auth.isTeacher() && (this.auth.isAdmin() || this.auth.isHR() || this.attendancePermissions.canCorrectAttendance);
  }

  setShiftType(shift: 'school' | 'coaching_morning' | 'coaching_evening'): void {
    this.activeShiftType = shift;
    if (shift === 'coaching_morning') {
      this.batchTargetCheckIn = this.attendanceSettings?.coachingMorningStartTime || '07:00';
      this.batchTargetCheckOut = this.attendanceSettings?.coachingMorningEndTime || '10:00';
    } else if (shift === 'coaching_evening') {
      this.batchTargetCheckIn = this.attendanceSettings?.coachingEveningStartTime || '16:00';
      this.batchTargetCheckOut = this.attendanceSettings?.coachingEveningEndTime || '19:00';
    } else {
      this.batchTargetCheckIn = this.attendanceSettings?.teacherShiftStartTime || '08:00';
      this.batchTargetCheckOut = this.attendanceSettings?.teacherShiftEndTime || '17:00';
    }
  }

  // ================= UNIFIED MULTI-DATE SELECTION METHODS =================
  isWeeklyOffDay(d: CalendarDayItem | Date): boolean {
    const date: Date = d instanceof Date ? d : new Date(`${d.dateStr}T00:00:00`);
    const p = this.attendanceSettings?.teacherWeeklyOffPattern || 'SundayOnly';
    const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat
    if (dayOfWeek === 0) return true; // Sunday is always weekly off

    if (p === 'SaturdaySunday') {
      return dayOfWeek === 6; // Every Saturday is off
    }

    if (p === 'SecondFourthSaturday' && dayOfWeek === 6) {
      const dayOfMonth = date.getDate();
      const saturdayIndex = Math.ceil(dayOfMonth / 7);
      return saturdayIndex === 2 || saturdayIndex === 4;
    }

    return false;
  }

  isSelectableWorkingDay(d: CalendarDayItem): boolean {
    if (this.isWeeklyOffDay(d) || d.isDeclaredHoliday) return false;
    if (d.status === 'Leave' || (d.record && (d.record.status === 'Leave' || d.record.captureSource === 'LeaveApplication'))) return false;
    if (d.dateStr > this.todayStr) return false;
    if (!this.canManageAttendance) return false;
    if (this.attendanceMode === 'Biometric') return false;
    if (d.dateStr < this.todayStr && !this.attendancePermissions.canCorrectAttendance) return false;
    if (this.selectedTeacher?.joiningDate) {
      const joinStr = this.selectedTeacher.joiningDate.split('T')[0];
      if (d.dateStr < joinStr) return false;
    }
    return true;
  }

  toggleDateSelect(d: CalendarDayItem): void {
    if (!this.isSelectableWorkingDay(d)) return;
    if (this.selectedMatrixDates.has(d.dateStr)) {
      this.selectedMatrixDates.delete(d.dateStr);
    } else {
      this.selectedMatrixDates.add(d.dateStr);
      if (this.selectedMatrixDates.size === 1) {
        if (d.record?.status) {
          this.batchTargetStatus = this.getEffectiveStatus(d.record) as any;
        } else if (d.status && d.status !== 'Unmarked' && d.status !== 'Holiday') {
          this.batchTargetStatus = d.status as any;
        } else {
          this.batchTargetStatus = 'Present';
        }
        if (d.record?.checkInTime) this.batchTargetCheckIn = d.record.checkInTime;
        else this.batchTargetCheckIn = this.attendanceSettings?.teacherShiftStartTime || '08:00';
        if (d.record?.checkOutTime) this.batchTargetCheckOut = d.record.checkOutTime;
        else this.batchTargetCheckOut = this.attendanceSettings?.teacherShiftEndTime || '17:00';
        if (d.record?.remarks) this.batchTargetRemarks = d.record.remarks;
      }
    }
    this.selectedMatrixDates = new Set(this.selectedMatrixDates);
  }

  selectAllWorkingDays(): void {
    const selectable = this.calendarDays.filter(d => this.isSelectableWorkingDay(d));
    this.selectedMatrixDates = new Set(selectable.map(d => d.dateStr));
  }

  selectAllAbsentDays(): void {
    const absentSelectable = this.calendarDays.filter(d =>
      this.isSelectableWorkingDay(d) && (d.status === 'Absent' || !d.record)
    );
    this.selectedMatrixDates = new Set(absentSelectable.map(d => d.dateStr));
  }

  clearDateSelection(): void {
    this.selectedMatrixDates = new Set();
    this.batchTargetStatus = 'Present';
    this.batchTargetRemarks = '';
  }

  getSelectedDateSummaryTitle(): string {
    if (this.selectedMatrixDates.size === 1) {
      const dateStr = Array.from(this.selectedMatrixDates)[0];
      return `${dateStr} (Single Day)`;
    }
    return `${this.selectedMatrixDates.size} Dates Selected (Multi)`;
  }

  applyMultiDatesAttendance(): void {
    if (this.selectedMatrixDates.size === 0) {
      this.confirmDialog.alert('No Dates Selected', 'Please select at least one date to apply attendance.', 'warning');
      return;
    }
    if (!this.selectedTeacher) {
      this.confirmDialog.alert('No Faculty Selected', 'Please select a faculty member first.', 'warning');
      return;
    }

    const dates = Array.from(this.selectedMatrixDates).sort();
    this.batchSavingDates = true;

    const payload = {
      attendanceDates: dates,
      status: this.batchTargetStatus,
      remarks: this.batchTargetRemarks || null,
      checkInTime: this.batchTargetStatus !== 'Absent' && this.batchTargetStatus !== 'Leave' ? (this.batchTargetCheckIn || null) : null,
      checkOutTime: this.batchTargetStatus !== 'Absent' && this.batchTargetStatus !== 'Leave' ? (this.batchTargetCheckOut || null) : null
    };

    this.http.post(
      `${this.api}/teachers/${this.selectedTeacher.id}/attendance/multi-dates`,
      payload
    ).subscribe({
      next: (res: any) => {
        this.batchSavingDates = false;
        const isSingle = dates.length === 1;
        const msg = res?.message || (isSingle
          ? `Attendance for ${dates[0]} saved as "${this.batchTargetStatus}" successfully.`
          : `Attendance marked as "${this.batchTargetStatus}" for ${dates.length} date(s) successfully.`);
        this.clearDateSelection();
        this.loadAttendance();
        this.confirmDialog.alert(isSingle ? 'Attendance Saved' : 'Bulk Attendance Saved', msg, 'success');
      },
      error: err => {
        if (err?.status === 404) {
          // Seamless fallback: save through existing monthly-register endpoint if backend hasn't been restarted yet
          const inTime = (this.batchTargetStatus !== 'Absent' && this.batchTargetStatus !== 'Leave') ? this.batchTargetCheckIn : null;
          const outTime = (this.batchTargetStatus !== 'Absent' && this.batchTargetStatus !== 'Leave') ? this.batchTargetCheckOut : null;
          const inNorm = inTime ? this.normalizeTo24h(inTime) : null;
          const outNorm = outTime ? this.normalizeTo24h(outTime, inTime || undefined) : null;

          const fallbackPayload = {
            month: this.attMonth,
            year: this.attYear,
            defaultCheckInTime: inNorm || '08:00',
            defaultCheckOutTime: outNorm || '17:00',
            days: dates.map(d => ({
              date: d,
              isPresent: this.batchTargetStatus !== 'Absent',
              checkInTime: inNorm,
              checkOutTime: outNorm,
              remarks: this.batchTargetRemarks || `Marked as ${this.batchTargetStatus}`
            }))
          };

          this.http.post<any>(`${this.api}/teachers/${this.selectedTeacher!.id}/attendance/monthly-register`, fallbackPayload).subscribe({
            next: (res: any) => {
              this.batchSavingDates = false;
              const isSingle = dates.length === 1;
              const msg = res?.message || (isSingle
                ? `Attendance for ${dates[0]} saved successfully.`
                : `Attendance marked for ${dates.length} date(s) successfully.`);
              this.clearDateSelection();
              this.loadAttendance();
              this.confirmDialog.alert(isSingle ? 'Attendance Saved' : 'Bulk Attendance Saved', msg, 'success');
            },
            error: fErr => {
              this.batchSavingDates = false;
              this.confirmDialog.alert(
                'Save Failed',
                fErr?.error?.message || 'Failed to save attendance. Please restart backend in Visual Studio to load updated endpoints.',
                'danger'
              );
            }
          });
          return;
        }

        this.batchSavingDates = false;
        this.confirmDialog.alert(
          'Save Failed',
          err?.error?.message || 'Failed to save attendance. Please try again.',
          'danger'
        );
      }
    });
  }

  saveFacultyMonthlyRegister(): void {
    if (!this.selectedTeacher) return;
    const selectableDays = this.calendarDays.filter(d => this.isSelectableWorkingDay(d));
    if (selectableDays.length === 0) {
      this.confirmDialog.alert('No Eligible Days', 'There are no eligible working days to save for this month.', 'warning');
      return;
    }

    const hasSelection = this.selectedMatrixDates.size > 0;
    const confirmPrompt = hasSelection
      ? `Save Monthly Register for ${this.selectedTeacher.fullName}?\n\n• ${this.selectedMatrixDates.size} Selected Day(s) will be marked as ${this.batchTargetStatus}.\n• Remaining ${selectableDays.length - this.selectedMatrixDates.size} Working Day(s) will be marked as Absent.`
      : `Save Monthly Register for ${this.selectedTeacher.fullName}?\n\nNo specific days are checked: all ${selectableDays.length} working days will be saved based on their current register state.`;

    this.confirmDialog.confirm('Auto-Fill Monthly Register', confirmPrompt, 'Proceed & Save', 'Cancel').subscribe(confirmed => {
      if (!confirmed) return;

      this.batchSavingDates = true;
      const defaultIn = this.attendanceSettings?.teacherShiftStartTime || '08:00';
      const defaultOut = this.attendanceSettings?.teacherShiftEndTime || '17:00';

      const payload = {
        month: this.attMonth,
        year: this.attYear,
        defaultCheckInTime: defaultIn,
        defaultCheckOutTime: defaultOut,
        days: selectableDays.map(d => {
          const isPresent = hasSelection ? this.selectedMatrixDates.has(d.dateStr) : (d.record ? d.record.status !== 'Absent' : true);
          return {
            date: d.dateStr,
            isPresent,
            checkInTime: isPresent ? defaultIn : null,
            checkOutTime: isPresent ? defaultOut : null,
            remarks: isPresent ? 'Monthly Register (Present)' : 'Monthly Register (Absent)'
          };
        })
      };

      this.http.post<any>(`${this.api}/teachers/${this.selectedTeacher!.id}/attendance/monthly-register`, payload).subscribe({
        next: (res) => {
          this.batchSavingDates = false;
          this.clearDateSelection();
          this.loadAttendance();
          this.confirmDialog.alert('Register Saved', res?.message || 'Monthly attendance register saved successfully!', 'success');
        },
        error: (err) => {
          this.batchSavingDates = false;
          this.confirmDialog.alert('Save Failed', err?.error?.message || 'Failed to save monthly attendance register.', 'danger');
        }
      });
    });
  }

  canRegularizeRecord(a: AttendanceDto): boolean {
    if (!a) return false;
    const dateStr = a.attendanceDate.split('T')[0];
    // Cannot regularize future dates
    if (dateStr > this.todayStr) return false;
    // Cannot regularize already approved leaves
    if (a.status === 'Leave' || a.captureSource === 'LeaveApplication') return false;
    const hasApprovedLeave = this.teacherLeaves.some(l => {
      if (l.status !== 'Approved' && l.status !== 'PartiallyCancelled') return false;
      const s = l.fromDate.split('T')[0];
      const e = l.toDate.split('T')[0];
      if (dateStr < s || dateStr > e) return false;
      if (l.isCancellationApproved && l.cancellationFromDate && l.cancellationToDate) {
        const cFrom = l.cancellationFromDate.split('T')[0];
        const cTo = l.cancellationToDate.split('T')[0];
        if (dateStr >= cFrom && dateStr <= cTo) return false;
      }
      return true;
    });
    if (hasApprovedLeave) return false;
    // Cannot regularize declared public holidays or sundays
    if (a.status === 'Holiday' || this.isPublicHolidayOrSunday(dateStr)) return false;
    return true;
  }

  openRegularizationDialog(targetDate?: string) {
    if (targetDate) {
      if (targetDate > this.todayStr) {
        this.confirmDialog.alert('Future Date', 'Attendance Regularization cannot be submitted for future dates.', 'warning');
        return;
      }
      const rec = this.records.find(r => r.attendanceDate.startsWith(targetDate));
      const hasApprovedLeave = (rec && (rec.status === 'Leave' || rec.captureSource === 'LeaveApplication')) || this.teacherLeaves.some(l => {
        if (l.status !== 'Approved' && l.status !== 'PartiallyCancelled') return false;
        const s = l.fromDate.split('T')[0];
        const e = l.toDate.split('T')[0];
        if (targetDate < s || targetDate > e) return false;
        if (l.isCancellationApproved && l.cancellationFromDate && l.cancellationToDate) {
          const cFrom = l.cancellationFromDate.split('T')[0];
          const cTo = l.cancellationToDate.split('T')[0];
          if (targetDate >= cFrom && targetDate <= cTo) return false;
        }
        return true;
      });
      if (hasApprovedLeave) {
        this.confirmDialog.alert('Leave Already Approved', `Date ${targetDate} is already an Approved Leave. Regularization is not applicable on approved leaves. To cancel this leave, please go to the Leave Management section.`, 'info');
        return;
      }
      if (this.isPublicHolidayOrSunday(targetDate)) {
        this.confirmDialog.alert('Holiday / Weekly Off', `Date ${targetDate} is an official holiday or weekly off. Regularization is not applicable.`, 'info');
        return;
      }
    }

    const ref = this.dialog.open(ApplyTeacherRegularizationDialogComponent, {
      data: {
        isTeacher: this.isTeacher,
        teachers: this.selectedTeacher ? [this.selectedTeacher] : [],
        myProfile: this.selectedTeacher,
        targetTeacherId: this.selectedTeacher?.id,
        targetDate: targetDate || (this.markData?.attendanceDate <= this.todayStr ? this.markData?.attendanceDate : this.todayStr)
      },
      disableClose: true,
      maxWidth: '92vw',
      width: '540px'
    });
    ref.afterClosed().subscribe(res => {
      if (res) {
        this.loadAttendance();
        this.confirmDialog.alert('Regularization Submitted', 'Attendance regularization request submitted successfully!', 'success');
      }
    });
  }

  ngOnInit() {
    this.loadAttendanceSettings();
    this.http.get<AttendancePermissionsDto>(`${this.api}/attendance/permissions`).subscribe({ next: permissions => this.attendancePermissions = permissions });
    this.route.queryParams.subscribe(p => { if (p['teacherId']) this.preSelectId = p['teacherId']; });
  }

  loadAttendanceSettings() {
    this.http.get<AttendanceSettingsDto>(`${this.api}/attendance/settings`).subscribe({
      next: settings => {
        this.attendanceSettings = settings;
        this.attendanceMode = settings.teacherMode;
        if (settings.teacherShiftStartTime) {
          this.batchTargetCheckIn = settings.teacherShiftStartTime;
          this.markData.checkInTime = settings.teacherShiftStartTime;
        }
        if (settings.teacherShiftEndTime) {
          this.batchTargetCheckOut = settings.teacherShiftEndTime;
          this.markData.checkOutTime = settings.teacherShiftEndTime;
        }
      },
      error: () => { this.attendanceMode = 'Both'; }
    });
  }

  openShiftSettingsDialog() {
    const ref = this.dialog.open(AttendanceShiftSettingsDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: { initialTab: 'teacher' }
    });
    ref.afterClosed().subscribe(res => {
      if (res?.saved && res?.settings) {
        this.attendanceSettings = res.settings;
        this.attendanceMode = res.settings.teacherMode;
        if (res.settings.teacherShiftStartTime) {
          this.batchTargetCheckIn = res.settings.teacherShiftStartTime;
          this.markData.checkInTime = res.settings.teacherShiftStartTime;
        }
        if (res.settings.teacherShiftEndTime) {
          this.batchTargetCheckOut = res.settings.teacherShiftEndTime;
          this.markData.checkOutTime = res.settings.teacherShiftEndTime;
        }
        this.loadAttendance();
        this.confirmDialog.alert('Settings Saved', 'Attendance shift timings and policies updated successfully.', 'success');
      }
    });
  }

  saveAttendanceMode() {
    this.attendanceSettings.teacherMode = this.attendanceMode;
    this.http.put<AttendanceSettingsDto>(`${this.api}/attendance/settings`, this.attendanceSettings).subscribe({
      next: settings => this.attendanceSettings = settings,
      error: err => { this.attendanceMode = this.attendanceSettings.teacherMode; this.confirmDialog.alert('Error', err?.error?.message || 'Failed to update attendance mode.', 'danger'); }
    });
  }

  onTeacherSelected(t: TeacherDto) {
    this.selectedTeacher = t;
    this.loadPublicHolidaySundayPermission();
    this.loadAttendance();
  }

  loadPublicHolidaySundayPermission() {
    this.http.get<{ canEdit: boolean }>(`${this.api}/teachers/attendance/ph-sun-edit-permission`).subscribe({
      next: result => this.canEditPublicHolidayOrSunday = result.canEdit,
      error: () => this.canEditPublicHolidayOrSunday = false
    });
  }

  loadAttendance() {
    if (!this.selectedTeacher) return;
    this.loading = true;
    const id = this.selectedTeacher.id;

    // Fetch teacher attendance records
    this.http.get<AttendanceDto[]>(`${this.api}/teachers/${id}/attendance`, {
      params: { month: this.attMonth, year: this.attYear }
    }).subscribe({
      next: r => {
        this.records = r || [];
        this.loading = false;
        this.buildCalendarGrid();
      },
      error: () => {
        this.loading = false;
        this.records = [];
        this.buildCalendarGrid();
      }
    });

    // Fetch official declared holidays for the month
    this.http.get<HolidayDto[]>(`${this.api}/holidays`, {
      params: { month: this.attMonth, year: this.attYear, activeOnly: true }
    }).subscribe({
      next: hList => {
        this.holidays = hList || [];
        this.buildCalendarGrid();
      },
      error: () => {
        this.holidays = [];
        this.buildCalendarGrid();
      }
    });

    // Fetch teacher's leaves to detect any pending cancellation requests
    this.http.get<LeaveDto[]>(`${this.api}/teachers/${id}/leaves`).subscribe({
      next: leaves => {
        this.teacherLeaves = leaves || [];
        this.buildCalendarGrid();
      },
      error: () => {
        this.teacherLeaves = [];
        this.buildCalendarGrid();
      }
    });

    // Fetch dynamic attendance summary KPI counters
    this.http.get<AttendanceSummaryDto>(`${this.api}/teachers/${id}/attendance/summary`, {
      params: { month: this.attMonth, year: this.attYear }
    }).subscribe({
      next: r => this.summary = r,
      error: () => this.summary = null
    });
  }

  buildCalendarGrid() {
    const daysInMonth = new Date(this.attYear, this.attMonth, 0).getDate();
    const todayStr = this.todayStr;
    const items: CalendarDayItem[] = [];

    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(this.attYear, this.attMonth - 1, day);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const dayOfWeek = weekdays[d.getDay()];
      const isSunday = d.getDay() === 0;
      const isSaturday = d.getDay() === 6;

      // Check if this date falls into any declared holiday
      const matchedHoliday = this.holidays.find(h => {
        const s = h.startDate.split('T')[0];
        const e = h.endDate.split('T')[0];
        return dateStr >= s && dateStr <= e;
      });

      const isDeclaredHoliday = !!matchedHoliday;
      let holidayTitle = matchedHoliday?.title;

      // Find record in logged attendance records
      const found = this.records.find(r => r.attendanceDate.split('T')[0] === dateStr);
      let status: CalendarDayItem['status'] = 'Unmarked';
      const isOff = this.isWeeklyOffDay(d);

      // Check if date is prior to teacher joining date
      const joinStr = this.selectedTeacher?.joiningDate ? this.selectedTeacher.joiningDate.split('T')[0] : null;
      const isPriorToJoining = !!(joinStr && dateStr < joinStr);

      if (found) {
        status = this.getEffectiveStatus(found) as any;
      } else if (isPriorToJoining) {
        status = 'PriorJoining';
      } else if (isDeclaredHoliday) {
        status = 'Holiday';
      } else if (isOff) {
        status = 'Holiday';
        holidayTitle = holidayTitle || (isSunday ? 'Sunday (Weekly Off)' : 'Saturday (Weekly Off)');
      } else if (dateStr < todayStr) {
        status = 'Absent';
      }

      // Check if this date has a pending leave cancellation request
      const pendingCancelLeave = this.teacherLeaves.find(l => 
        (l.status === 'CancellationRequested' || l.isCancellationRequested) &&
        dateStr >= (l.cancellationFromDate || l.fromDate).split('T')[0] &&
        dateStr <= (l.cancellationToDate || l.toDate).split('T')[0]
      );
      const isCancellationPending = !!pendingCancelLeave;
      const cancellationDetails = pendingCancelLeave?.cancellationReason;

      items.push({
        dayNumber: day,
        dateStr,
        dayOfWeek,
        isToday: dateStr === todayStr,
        isSunday,
        isSaturday,
        isDeclaredHoliday,
        holidayTitle,
        status,
        record: found,
        isPriorToJoining,
        isCancellationPending,
        cancellationDetails
      });
    }

    this.calendarDays = items;
  }

  getDayTooltip(d: CalendarDayItem): string {
    if (d.isPriorToJoining) {
      const joinStr = this.selectedTeacher?.joiningDate ? this.selectedTeacher.joiningDate.split('T')[0] : '';
      return `Prior to Joining (Joined on ${joinStr || d.dateStr}) — Attendance not applicable`;
    }
    if (d.status === 'Leave' && d.dateStr > this.todayStr) {
      return `Approved Leave — ${d.dateStr} (${d.dayOfWeek})`;
    }
    if (d.dateStr > this.todayStr) {
      return 'Future date — attendance cannot be marked in advance';
    }
    if (d.dateStr < this.todayStr && !this.attendancePermissions.canCorrectAttendance) {
      return 'Back-date correction requires Admin permission';
    }
    const cancelPrefix = d.isCancellationPending ? `[Cancellation Requested: ${d.cancellationDetails} (Pending Admin Review)] | ` : '';
    const mainStatus = d.isDeclaredHoliday ? `Public Holiday: ${d.holidayTitle}` : (this.isWeeklyOffDay(d) ? 'Weekly Off' : d.status);
    const punchStr = d.record?.checkInTime ? ` | Punch-in: ${d.record.checkInTime}` : '';
    return `${cancelPrefix}${d.dateStr} (${d.dayOfWeek}): ${mainStatus}${punchStr}`;
  }

  getCellShortTag(d: CalendarDayItem): string {
    if (d.isCancellationPending) {
      return 'L-REQ';
    }
    if (d.isPriorToJoining) {
      return '—';
    }
    const isOff = this.isWeeklyOffDay(d);
    // Configured Weekly Off — always display 'OFF' unless specifically worked (Present/Late/HalfDay)
    if (isOff && (d.status === 'Holiday' || !d.record || (d.record && (d.record.status === 'Holiday' || (d.record.status as string) === 'WeekOff')))) {
      return 'OFF';
    }
    if (d.record) {
      return this.getStatusShortTag(d.status);
    }
    if (d.isDeclaredHoliday) {
      return 'PH'; // Public Holiday from Holiday Master
    }
    if (isOff) {
      return 'OFF';
    }
    if (d.dateStr < this.todayStr) {
      return 'A'; // Past working day unmarked -> Absent
    }
    return '—';
  }

  getStatusShortTag(status: string): string {
    switch (status) {
      case 'Present': return 'P';
      case 'Absent': return 'A';
      case 'Leave': return 'L';
      case 'Late': return 'LT';
      case 'HalfDay': return 'HD';
      case 'Holiday': return 'PH';
      default: return '—';
    }
  }

  onDayCellClick(d: CalendarDayItem) {
    // 1. If it's a sanctioned leave date, provide clear information
    const hasApprovedLeave = d.status === 'Leave' || (d.record && (d.record.status === 'Leave' || d.record.captureSource === 'LeaveApplication')) || this.teacherLeaves.some(l => {
      if (l.status !== 'Approved' && l.status !== 'PartiallyCancelled') return false;
      const s = l.fromDate.split('T')[0];
      const e = l.toDate.split('T')[0];
      if (d.dateStr < s || d.dateStr > e) return false;
      if (l.isCancellationApproved && l.cancellationFromDate && l.cancellationToDate) {
        const cFrom = l.cancellationFromDate.split('T')[0];
        const cTo = l.cancellationToDate.split('T')[0];
        if (d.dateStr >= cFrom && d.dateStr <= cTo) return false;
      }
      return true;
    });
    if (hasApprovedLeave) {
      this.confirmDialog.alert('Sanctioned Leave', `Date ${d.dateStr} is already marked as Approved Leave. If you wish to cancel or modify it, please go to the Leave Management section.`, 'info');
      return;
    }

    // 2. Block future dates for everyone
    if (d.dateStr > this.todayStr) {
      this.confirmDialog.alert('Future Date', 'Attendance cannot be marked in advance for future dates.', 'warning');
      return;
    }

    // 3. If Teacher clicks:
    if (this.isTeacher) {
      if (d.dateStr < this.todayStr) {
        this.openRegularizationDialog(d.dateStr);
        return;
      }
      if (d.dateStr === this.todayStr) {
        this.quickMarkTodayPresent();
        return;
      }
    }

    // 4. If selectable working day, toggle selection
    if (this.isSelectableWorkingDay(d)) {
      this.toggleDateSelect(d);
      return;
    }

    // 5. Informative alerts when day is not selectable
    if (d.isPriorToJoining) {
      const joinFmt = this.selectedTeacher?.joiningDate ? this.selectedTeacher.joiningDate.split('T')[0] : '';
      this.confirmDialog.alert(
        'Prior to Joining',
        `Teacher joined on ${joinFmt || d.dateStr}. Attendance prior to the joining date is not applicable.`,
        'info'
      );
      return;
    }
    if (d.isDeclaredHoliday) {
      this.confirmDialog.alert('Public Holiday', `${d.holidayTitle || 'Official Holiday'} on ${d.dateStr}. Attendance marking is not applicable on official holidays.`, 'info');
      return;
    }
    if (d.isSunday) {
      this.confirmDialog.alert('Sunday Weekly Off', `Date ${d.dateStr} is Sunday Weekly Off.`, 'info');
      return;
    }
    if (d.dateStr < this.todayStr && !this.attendancePermissions.canCorrectAttendance) {
      this.confirmDialog.alert('Back-Date Restricted', 'You do not have permission to mark or correct past date attendance. Please contact Admin.', 'warning');
      return;
    }
  }

  parseTimeToMinutes(timeStr?: string): number | null {
    if (!timeStr) return null;
    const str = timeStr.trim();
    if (!str) return null;

    // Match formats like "08:00", "8:00", "08:00:00", "05:00 PM", "5:30pm", "17:00"
    const regex = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i;
    const match = str.match(regex);
    if (!match) return null;

    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const meridiem = match[3] ? match[3].toUpperCase() : null;

    if (isNaN(hour) || isNaN(minute)) return null;

    if (meridiem === 'PM') {
      if (hour < 12) hour += 12;
    } else if (meridiem === 'AM') {
      if (hour === 12) hour = 0;
    }

    return hour * 60 + minute;
  }

  getDiffMinutes(inTime?: string, outTime?: string): number | null {
    if (!inTime || !outTime) return null;
    let inMin = this.parseTimeToMinutes(inTime);
    let outMin = this.parseTimeToMinutes(outTime);
    if (inMin === null || outMin === null) return null;

    // If outMin <= inMin, check if adding 12 hours (720 min) resolves standard 12-hour format
    // (e.g. In: 08:00 / 8 AM, Out: 05:00 / 5 PM -> 17:00)
    if (outMin <= inMin) {
      const outHasMeridiem = /AM|PM/i.test(outTime);
      if (!outHasMeridiem) {
        if (outMin + 720 > inMin && outMin + 720 <= 1440) {
          outMin += 720;
        }
      }
    }

    const diff = outMin - inMin;
    return diff > 0 ? diff : null;
  }

  calculateDuration(inTime?: string, outTime?: string): string {
    const diff = this.getDiffMinutes(inTime, outTime);
    if (!diff) return '';
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  formatDisplayTime(timeStr?: string): string {
    if (!timeStr) return '';
    const minutes = this.parseTimeToMinutes(timeStr);
    if (minutes === null) return '';

    let h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    return `${hh}:${mm} ${ampm}`;
  }

  normalizeTo24h(timeStr?: string, referenceInTime?: string): string {
    if (!timeStr) return '';
    let minutes = this.parseTimeToMinutes(timeStr);
    if (minutes === null) return timeStr;

    if (referenceInTime) {
      const inMin = this.parseTimeToMinutes(referenceInTime);
      if (inMin !== null && minutes <= inMin && !/AM|PM/i.test(timeStr)) {
        if (minutes + 720 > inMin && minutes + 720 <= 1440) {
          minutes += 720;
        }
      }
    }

    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  minutesToTimeString(mins: number): string {
    const wrapped = (mins % 1440 + 1440) % 1440;
    const h = Math.floor(wrapped / 60);
    const m = wrapped % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  getEffectiveStatus(record?: { status?: string; checkInTime?: string; checkOutTime?: string; captureSource?: string }, shiftHint?: 'school' | 'coaching_morning' | 'coaching_evening'): 'Present' | 'Absent' | 'Late' | 'HalfDay' | 'Holiday' | 'Leave' | 'Unmarked' {
    if (!record || !record.status) return 'Unmarked';
    if (record.status === 'Absent' || record.status === 'Holiday' || record.status === 'WeekOff' || record.status === 'Leave') {
      return record.status === 'WeekOff' ? 'Holiday' : (record.status as any);
    }
    const diff = this.getDiffMinutes(record.checkInTime, record.checkOutTime);
    const inMin = this.parseTimeToMinutes(record.checkInTime);

    const isCoaching = shiftHint?.startsWith('coaching') ||
                       this.activeShiftType?.startsWith('coaching') ||
                       (record.captureSource && record.captureSource.toLowerCase().includes('coaching')) ||
                       (inMin !== null && (inMin < 450 || inMin >= 930));

    let shiftStart: number;
    let shiftEnd: number;
    let graceMin: number;

    if (isCoaching) {
      if (shiftHint === 'coaching_evening' || this.activeShiftType === 'coaching_evening' || (inMin !== null && inMin >= 720)) {
        // Coaching Evening Shift
        shiftStart = this.parseTimeToMinutes(this.batchTargetCheckIn || this.attendanceSettings?.coachingEveningStartTime || '16:00') ?? 960;
        shiftEnd = this.parseTimeToMinutes(this.batchTargetCheckOut || this.attendanceSettings?.coachingEveningEndTime || '19:00') ?? 1140;
        graceMin = this.attendanceSettings?.coachingEveningGraceMinutes ?? 15;
      } else {
        // Coaching Morning Shift
        shiftStart = this.parseTimeToMinutes(this.batchTargetCheckIn || this.attendanceSettings?.coachingMorningStartTime || '07:00') ?? 420;
        shiftEnd = this.parseTimeToMinutes(this.batchTargetCheckOut || this.attendanceSettings?.coachingMorningEndTime || '10:00') ?? 600;
        graceMin = this.attendanceSettings?.coachingMorningGraceMinutes ?? 15;
      }
    } else {
      // School Day Shift / General Shift
      shiftStart = this.parseTimeToMinutes(this.batchTargetCheckIn || this.attendanceSettings?.teacherShiftStartTime || '08:00') ?? 480;
      shiftEnd = this.parseTimeToMinutes(this.batchTargetCheckOut || this.attendanceSettings?.teacherShiftEndTime || '17:00') ?? 1020;
      graceMin = this.attendanceSettings?.teacherGracePeriodMinutes ?? 15;
    }

    const lateCutoff = shiftStart + graceMin;

    // Solution B: Dynamic Duration & Ratio-Based Thresholds (Zero hardcoding)
    let shiftDuration = shiftEnd - shiftStart;
    if (shiftDuration <= 0) {
      shiftDuration = isCoaching ? 150 : 540;
    }
    const expectedDuration = shiftDuration;

    let fullDayMinThreshold = Math.round(expectedDuration * 0.70);
    let halfDayMinThreshold = Math.round(expectedDuration * 0.35);

    if (!isCoaching && (this.attendanceSettings?.teacherHalfDayThresholdMinutes ?? 0) > 0) {
      fullDayMinThreshold = this.attendanceSettings?.teacherHalfDayThresholdMinutes || 240;
      halfDayMinThreshold = Math.round(fullDayMinThreshold / 2);
    }

    if (diff !== null && diff > 0) {
      if (diff < halfDayMinThreshold) return 'Absent';
      if (diff < fullDayMinThreshold) return 'HalfDay';
    }

    if (inMin !== null && inMin > lateCutoff) {
      return 'Late';
    }
    return 'Present';
  }

  onTimeChanged() {
    if (!this.markData.checkInTime || !this.markData.checkOutTime) return;
    if (this.markData.status === 'Absent' || this.markData.status === 'Holiday') return;

    this.markData.status = this.getEffectiveStatus({
      status: this.markData.status || 'Present',
      checkInTime: this.markData.checkInTime,
      checkOutTime: this.markData.checkOutTime
    });
  }

  getTimeCalculationHint(): string {
    if (!this.markData.checkInTime || !this.markData.checkOutTime) return '';
    if (this.markData.status === 'Absent' || this.markData.status === 'Holiday') return '';

    const diff = this.getDiffMinutes(this.markData.checkInTime, this.markData.checkOutTime);
    const inMin = this.parseTimeToMinutes(this.markData.checkInTime);
    if (diff === null || inMin === null) return '';

    const h = Math.floor(diff / 60);
    const m = diff % 60;
    const durStr = m > 0 ? `${h}h ${m}m` : `${h}h`;

    const isCoaching = this.activeShiftType !== 'school' || inMin < 450 || inMin >= 930;
    let shiftStart: number;
    let shiftEnd: number;
    let graceMin: number;

    if (isCoaching) {
      if (this.activeShiftType === 'coaching_evening' || inMin >= 720) {
        shiftStart = this.parseTimeToMinutes(this.batchTargetCheckIn || this.attendanceSettings?.coachingEveningStartTime || '16:00') ?? 960;
        shiftEnd = this.parseTimeToMinutes(this.batchTargetCheckOut || this.attendanceSettings?.coachingEveningEndTime || '19:00') ?? 1140;
        graceMin = this.attendanceSettings?.coachingEveningGraceMinutes ?? 15;
      } else {
        shiftStart = this.parseTimeToMinutes(this.batchTargetCheckIn || this.attendanceSettings?.coachingMorningStartTime || '07:00') ?? 420;
        shiftEnd = this.parseTimeToMinutes(this.batchTargetCheckOut || this.attendanceSettings?.coachingMorningEndTime || '10:00') ?? 600;
        graceMin = this.attendanceSettings?.coachingMorningGraceMinutes ?? 15;
      }
    } else {
      shiftStart = this.parseTimeToMinutes(this.batchTargetCheckIn || this.attendanceSettings?.teacherShiftStartTime || '08:00') ?? 480;
      shiftEnd = this.parseTimeToMinutes(this.batchTargetCheckOut || this.attendanceSettings?.teacherShiftEndTime || '17:00') ?? 1020;
      graceMin = this.attendanceSettings?.teacherGracePeriodMinutes ?? 15;
    }

    const lateCutoff = shiftStart + graceMin;
    const cutoffFormatted = this.formatDisplayTime(this.minutesToTimeString(lateCutoff));

    let shiftDuration = shiftEnd - shiftStart;
    if (shiftDuration <= 0) shiftDuration = isCoaching ? 150 : 540;
    const expectedDuration = shiftDuration;

    let fullDayMin = Math.round(expectedDuration * 0.70);
    let halfDayMin = Math.round(expectedDuration * 0.35);

    if (!isCoaching && (this.attendanceSettings?.teacherHalfDayThresholdMinutes ?? 0) > 0) {
      fullDayMin = this.attendanceSettings?.teacherHalfDayThresholdMinutes || 240;
      halfDayMin = Math.round(fullDayMin / 2);
    }

    if (diff < halfDayMin) {
      return `Work Duration: ${durStr} (< 35% of session) — Auto-detected as Absent`;
    }
    if (diff < fullDayMin) {
      return `Work Duration: ${durStr} (35%–69% of session) — Auto-detected as Half Day`;
    }
    if (inMin > lateCutoff) {
      return `Punch-in: ${this.markData.checkInTime} (After ${cutoffFormatted} grace cutoff) — Auto-detected as Late Mark (${durStr} duration)`;
    }
    return `Work Duration: ${durStr} (≥70% completed on-time) — Full Day Present`;
  }

  getLateQuotaTooltip(): string {
    if (!this.summary) return '';
    const allowed = this.summary.allowedLateDays ?? this.attendanceSettings?.teacherAllowedLateDaysPerMonth ?? 3;
    const lates = this.summary.lateDays || 0;
    if (lates <= allowed) {
      return `Attendance Policy: ${allowed} free grace lates/month. ${allowed - lates} grace marks remaining (₹0 penalty).`;
    }
    const excess = this.summary.excessLateDays || (lates - allowed);
    const penalty = this.summary.latePenaltyDays || 0;
    return `Grace limit exceeded by ${excess} lates! Incurring ${penalty} day loss-of-pay deduction in payroll (${allowed} free lates allowed).`;
  }

  quickMarkTodayPresent() {
    if (!this.selectedTeacher) return;
    const todayStr = this.todayStr;
    this.markData.attendanceDate = todayStr;
    this.markData.status = 'Present';
    this.markData.checkInTime = this.attendanceSettings?.teacherShiftStartTime || '08:00';
    this.markData.checkOutTime = this.attendanceSettings?.teacherShiftEndTime || '17:00';
    this.markData.remarks = 'Marked via Quick Present';
    this.saveAttendance();
  }

  saveAttendance() {
    if (!this.selectedTeacher || !this.markData.attendanceDate) return;

    // Block future dates for everyone
    if (this.markData.attendanceDate > this.todayStr) {
      this.confirmDialog.alert('Future Date Not Allowed', 'Attendance cannot be marked in advance for future dates.', 'warning');
      return;
    }

    // Block back dates for non-admins
    if (this.markData.attendanceDate < this.todayStr && !this.attendancePermissions.canCorrectAttendance) {
      this.confirmDialog.alert('Back-Date Restricted', 'You do not have permission to mark or correct past date attendance. Please contact Admin.', 'warning');
      return;
    }

    if (!this.attendancePermissions.canManualMark) {
      this.confirmDialog.alert('Permission Denied', 'You do not have permission to mark manual attendance.', 'warning');
      return;
    }
    if (this.attendanceMode === 'Biometric') {
      this.confirmDialog.alert('Biometric Mode', 'Manual teacher attendance is disabled in Biometric Only mode.', 'warning');
      return;
    }

    if (this.isPublicHolidayOrSunday(this.markData.attendanceDate) && !this.canEditPublicHolidayOrSunday) {
      this.confirmDialog.alert('Editing Disabled', 'PH/SUN attendance editing is disabled for your role.', 'warning');
      return;
    }

    // Normalize check-in and check-out to 24-hour format seamlessly
    const inNormalized = this.normalizeTo24h(this.markData.checkInTime);
    const outNormalized = this.normalizeTo24h(this.markData.checkOutTime, this.markData.checkInTime);

    // Enforce effective smart status before saving
    this.markData.status = this.getEffectiveStatus({
      status: this.markData.status,
      checkInTime: inNormalized,
      checkOutTime: outNormalized
    });

    // Check if faculty already has an approved leave for this date
    const existingLeave = this.records.find(r => r.attendanceDate.split('T')[0] === this.markData.attendanceDate && r.status === 'Leave');
    if (existingLeave) {
      this.confirmDialog.confirm(
        'Override Approved Leave?',
        `Faculty member already has an <strong>approved Leave</strong> recorded on <strong>${this.markData.attendanceDate}</strong>.<br><br>Manually marking attendance as <strong>${this.markData.status}</strong> will override this leave. Do you want to proceed?`,
        'Yes, Override & Mark', 'Cancel'
      ).subscribe(ok => {
        if (ok) {
          this.executeSaveAttendance(inNormalized, outNormalized);
        }
      });
      return;
    }

    this.executeSaveAttendance(inNormalized, outNormalized);
  }

  executeSaveAttendance(inNormalized: string, outNormalized: string) {
    this.saving = true;

    const payload = {
      attendanceDate: this.markData.attendanceDate,
      entries: [{
        teacherId: this.selectedTeacher!.id,
        status: this.markData.status,
        checkInTime: inNormalized || null,
        checkOutTime: outNormalized || null,
        remarks: this.markData.remarks || null
      }]
    };

    // Try single teacher endpoint first, with seamless fallback to bulk endpoint
    this.http.post(`${this.api}/teachers/${this.selectedTeacher!.id}/attendance`, {
      attendanceDate: this.markData.attendanceDate,
      status: this.markData.status,
      checkInTime: inNormalized,
      checkOutTime: outNormalized,
      remarks: this.markData.remarks
    }).subscribe({
      next: () => {
        this.saving = false;
        this.showMarkForm = false;
        this.loadAttendance();
        this.confirmDialog.alert('Attendance Saved', 'Faculty attendance marked successfully!', 'success');
      },
      error: () => {
        // Fallback to bulk endpoint (guaranteed to work with existing backend)
        this.http.post(`${this.api}/teachers/attendance/bulk`, payload).subscribe({
          next: () => {
            this.saving = false;
            this.showMarkForm = false;
            this.loadAttendance();
            this.confirmDialog.alert('Attendance Saved', 'Faculty attendance marked successfully!', 'success');
          },
          error: err => {
            this.saving = false;
            this.confirmDialog.alert('Error', err?.error?.message || 'Error marking attendance.', 'danger');
          }
        });
      }
    });
  }

  editRecord(record: AttendanceDto) {
    if (record.captureSource === 'LeaveApplication' || record.status === 'Leave') {
      this.confirmDialog.alert(
        'Manage in Leave Management',
        'This attendance log was generated by an Approved Leave Application. To modify or cancel this leave and adjust leave quotas, please go to HRMS -> Leave Management.',
        'info'
      );
      return;
    }

    const date = record.attendanceDate.split('T')[0];
    if (this.isPublicHolidayOrSunday(date) && !this.canEditPublicHolidayOrSunday) {
      this.confirmDialog.alert('Editing Disabled', 'PH/SUN attendance editing is disabled for your role.', 'warning');
      return;
    }

    this.selectedMatrixDates = new Set([date]);
    this.batchTargetStatus = this.getEffectiveStatus(record) as any;
    this.batchTargetCheckIn = record.checkInTime || this.attendanceSettings?.teacherShiftStartTime || '08:00';
    this.batchTargetCheckOut = record.checkOutTime || this.attendanceSettings?.teacherShiftEndTime || '17:00';
    this.batchTargetRemarks = record.remarks || '';
    const calEl = document.querySelector('.calendar-card');
    if (calEl) {
      calEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  deleteRecord(id: string) {
    const record = this.records.find(item => item.id === id);
    if (record && (record.captureSource === 'LeaveApplication' || record.status === 'Leave')) {
      this.confirmDialog.alert(
        'Protected Leave Record',
        'This attendance entry was created from an Approved Leave Application. Direct deletion here will break leave quotas and payroll calculations. Please cancel or revoke this leave from HRMS -> Leave Management.',
        'warning'
      );
      return;
    }

    if (record && this.isPublicHolidayOrSunday(record.attendanceDate.split('T')[0]) && !this.canEditPublicHolidayOrSunday) {
      this.confirmDialog.alert('Editing Disabled', 'PH/SUN attendance editing is disabled for your role.', 'warning');
      return;
    }

    this.confirmDialog.danger(
      'Delete Attendance Record',
      'Are you sure you want to delete this attendance log? This will update the monthly summary and payroll calculations.',
      'Delete Record'
    ).subscribe(confirmed => {
      if (confirmed) {
        this.http.delete(`${this.api}/teachers/attendance/${id}`).subscribe({
          next: () => {
            this.loadAttendance();
            this.confirmDialog.alert('Deleted', 'Attendance record deleted successfully.', 'success');
          },
          error: () => {
            this.confirmDialog.alert('Error', 'Unable to delete attendance record.', 'danger');
          }
        });
      }
    });
  }

  isPublicHolidayOrSunday(dateValue: string): boolean {
    const dateOnly = dateValue.split('T')[0];
    const date = new Date(`${dateOnly}T00:00:00`);
    if (this.isWeeklyOffDay(date)) return true;

    return this.holidays.some(h => {
      const start = h.startDate.split('T')[0];
      const end = h.endDate.split('T')[0];
      return dateOnly >= start && dateOnly <= end;
    });
  }

  isEditDisabled(a: AttendanceDto): boolean {
    return !this.attendancePermissions.canCorrectAttendance ||
      this.attendanceMode === 'Biometric' ||
      (this.isPublicHolidayOrSunday(a.attendanceDate) && !this.canEditPublicHolidayOrSunday) ||
      a.captureSource === 'LeaveApplication' ||
      a.status === 'Leave';
  }

  isDeleteDisabled(a: AttendanceDto): boolean {
    return !this.attendancePermissions.canCorrectAttendance ||
      this.attendanceMode === 'Biometric' ||
      (this.isPublicHolidayOrSunday(a.attendanceDate) && !this.canEditPublicHolidayOrSunday) ||
      a.captureSource === 'LeaveApplication' ||
      a.status === 'Leave';
  }

  getEditTooltip(a: AttendanceDto): string {
    if (a.captureSource === 'LeaveApplication' || a.status === 'Leave') {
      return 'Approved Leave cannot be edited here. Manage via HRMS > Leave Management';
    }
    if (this.attendanceMode === 'Biometric') {
      return 'Attendance editing is disabled in Biometric-Only mode';
    }
    if (!this.attendancePermissions.canCorrectAttendance) {
      return 'You do not have permission to edit attendance records';
    }
    if (this.isPublicHolidayOrSunday(a.attendanceDate) && !this.canEditPublicHolidayOrSunday) {
      return 'Attendance editing on Sunday / Public Holiday is restricted';
    }
    return 'Edit attendance record';
  }

  getDeleteTooltip(a: AttendanceDto): string {
    if (a.captureSource === 'LeaveApplication' || a.status === 'Leave') {
      return 'Approved Leave cannot be deleted here. To cancel and restore leave quota, go to HRMS > Leave Management';
    }
    if (this.attendanceMode === 'Biometric') {
      return 'Attendance deleting is disabled in Biometric-Only mode';
    }
    if (!this.attendancePermissions.canCorrectAttendance) {
      return 'You do not have permission to delete attendance records';
    }
    if (this.isPublicHolidayOrSunday(a.attendanceDate) && !this.canEditPublicHolidayOrSunday) {
      return 'Attendance deleting on Sunday / Public Holiday is restricted';
    }
    return 'Delete attendance record';
  }
}
