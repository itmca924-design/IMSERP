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
import { MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TeacherSelectorComponent } from './teacher-selector.component';
import { API_BASE, AttendancePermissionsDto, AttendanceSettingsDto, TeacherDto, AttendanceDto, AttendanceSummaryDto, HolidayDto } from './teacher.models';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { LocalDatetimePipe } from '../../shared/pipes/local-datetime.pipe';

export interface CalendarDayItem {
  dayNumber: number;
  dateStr: string;
  dayOfWeek: string;
  isToday: boolean;
  isSunday: boolean;
  isSaturday: boolean;
  isDeclaredHoliday?: boolean;
  holidayTitle?: string;
  status: 'Present' | 'Absent' | 'Late' | 'HalfDay' | 'Holiday' | 'Unmarked';
  record?: AttendanceDto;
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
        <div class="teacher-info-badge">
          <mat-icon color="primary">account_circle</mat-icon>
          <div class="teacher-meta-text">
            <strong>{{selectedTeacher.fullName}}</strong>
            <span class="emp-code">{{selectedTeacher.employeeCode}}</span>
          </div>
        </div>

        <div class="period-selectors">
          <!-- Month Dropdown with wide width to fit September without truncation -->
          <mat-form-field appearance="outline" class="month-select-field">
            <mat-label>Month</mat-label>
            <mat-select [(ngModel)]="attMonth" (ngModelChange)="loadAttendance()">
              <mat-option *ngFor="let m of months; let i = index" [value]="i+1">{{m}}</mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Year Dropdown -->
          <mat-form-field appearance="outline" class="year-select-field">
            <mat-label>Year</mat-label>
            <mat-select [(ngModel)]="attYear" (ngModelChange)="loadAttendance()">
              <mat-option *ngFor="let y of years" [value]="y">{{y}}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </div>

      <div class="toolbar-right">
        <!-- Quick 1-Click Today Action -->
        <mat-form-field appearance="outline" class="mode-select"><mat-label>Teacher Attendance Mode</mat-label><mat-select [(ngModel)]="attendanceMode" (selectionChange)="saveAttendanceMode()" [disabled]="!attendancePermissions.canChangeMode"><mat-option value="Both">Manual + Biometric</mat-option><mat-option value="Manual">Manual Only</mat-option><mat-option value="Biometric">Biometric Only</mat-option></mat-select></mat-form-field>
        <button mat-stroked-button color="accent" class="quick-today-btn" (click)="quickMarkTodayPresent()" [disabled]="!attendancePermissions.canManualMark || attendanceMode === 'Biometric'" matTooltip="Manual marking is disabled by permission or mode">
          <mat-icon>verified</mat-icon> Today Present
        </button>

        <button mat-raised-button color="primary" class="mark-btn" (click)="showMarkForm = !showMarkForm" [disabled]="!attendancePermissions.canManualMark || attendanceMode === 'Biometric'">
          <mat-icon>{{showMarkForm ? 'close' : 'add_task'}}</mat-icon>
          {{showMarkForm ? 'Close Form' : 'Mark Attendance'}}
        </button>
      </div>
    </div>

    <!-- Mark Attendance Form Drawer -->
    <mat-card class="mark-form-card mat-elevation-z2" *ngIf="showMarkForm">
      <div class="form-card-header">
        <div class="card-title">
          <mat-icon color="primary">edit_calendar</mat-icon>
          <div>
            <strong>Log Attendance Record</strong>
            <p>Enter date, status, and punch-in/out timestamps.</p>
          </div>
        </div>
        <button mat-icon-button (click)="showMarkForm = false">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="form-row">
        <mat-form-field appearance="outline" class="field-date">
          <mat-label>Attendance Date *</mat-label>
          <input matInput type="date" [(ngModel)]="markData.attendanceDate" [max]="todayStr">
        </mat-form-field>

        <mat-form-field appearance="outline" class="field-status">
          <mat-label>Attendance Status *</mat-label>
          <mat-select [(ngModel)]="markData.status">
            <mat-option value="Present">
              <span class="status-option present">● Present</span>
            </mat-option>
            <mat-option value="Absent">
              <span class="status-option absent">● Absent</span>
            </mat-option>
            <mat-option value="Late">
              <span class="status-option late">● Late</span>
            </mat-option>
            <mat-option value="HalfDay">
              <span class="status-option half">● Half Day</span>
            </mat-option>
            <mat-option value="Holiday">
              <span class="status-option holiday">● Holiday / Off</span>
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="field-time">
          <mat-label>Check-in Time</mat-label>
          <input matInput type="time" [(ngModel)]="markData.checkInTime" (ngModelChange)="onTimeChanged()">
        </mat-form-field>

        <mat-form-field appearance="outline" class="field-time">
          <mat-label>Check-out Time</mat-label>
          <input matInput type="time" [(ngModel)]="markData.checkOutTime" (ngModelChange)="onTimeChanged()">
        </mat-form-field>

        <mat-form-field appearance="outline" class="field-remarks">
          <mat-label>Remarks / Notes</mat-label>
          <input matInput [(ngModel)]="markData.remarks" placeholder="e.g. Taken extra doubt lecture">
        </mat-form-field>
      </div>

      <!-- Coaching Smart Rule Auto-detection Hint -->
      <div class="smart-rule-hint" *ngIf="getTimeCalculationHint()">
        <mat-icon>lightbulb</mat-icon>
        <span>{{ getTimeCalculationHint() }}</span>
      </div>

      <div class="form-actions">
        <button mat-button (click)="showMarkForm = false">Cancel</button>
        <button mat-raised-button color="primary" (click)="saveAttendance()"
          [disabled]="!markData.attendanceDate || !markData.status || saving">
          <mat-icon>{{saving ? 'hourglass_empty' : 'save'}}</mat-icon> Save Record
        </button>
      </div>
    </mat-card>

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
          <span class="leg pub-holiday">★ Public Holiday</span>
          <span class="leg sunday">● Sunday Off</span>
          <span class="leg saturday">● Saturday</span>
          <span class="leg unmarked">○ Unmarked</span>
        </div>
      </div>

      <div class="days-heatmap-grid">
        <div class="day-cell" *ngFor="let d of calendarDays"
          [class.present]="d.status === 'Present'"
          [class.absent]="d.status === 'Absent'"
          [class.late]="d.status === 'Late'"
          [class.half]="d.status === 'HalfDay'"
          [class.public-holiday]="d.isDeclaredHoliday && !d.record"
          [class.sunday-off]="d.isSunday && !d.record && !d.isDeclaredHoliday"
          [class.saturday-off]="d.isSaturday && !d.record && !d.isDeclaredHoliday"
          [class.today]="d.isToday"
          [class.future-date]="d.dateStr > todayStr"
          (click)="onDayCellClick(d)"
          [matTooltip]="d.dateStr > todayStr ? 'Future date — attendance cannot be marked in advance' : (d.dateStr < todayStr && !attendancePermissions.canCorrectAttendance ? 'Back-date correction requires Admin permission' : (d.dateStr + ' (' + d.dayOfWeek + '): ' + (d.isDeclaredHoliday ? ('Public Holiday: ' + d.holidayTitle) : (d.isSunday ? 'Sunday Weekly Off' : (d.isSaturday ? 'Saturday' : d.status))) + (d.record?.checkInTime ? ' | Punch-in: ' + d.record?.checkInTime : '')))">
          <span class="cell-num">{{d.dayNumber}}</span>
          <span class="cell-sub">{{d.dayOfWeek.charAt(0)}}</span>
          <span class="cell-tag">{{getCellShortTag(d)}}</span>
        </div>
      </div>
    </div>

    <!-- Detailed Attendance Log Table -->
    <mat-card class="table-card mat-elevation-z1" *ngIf="records.length > 0">
      <div class="table-card-header">
        <strong>Detailed Attendance Register ({{records.length}} Records)</strong>
      </div>
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
            <th class="actions-col">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let a of records">
            <td><strong>{{a.attendanceDate | date:'dd MMM yyyy'}}</strong></td>
            <td><span class="day-label">{{a.attendanceDate | date:'EEEE'}}</span></td>
            <td><span class="status-badge" [ngClass]="getEffectiveStatus(a).toLowerCase()">{{getEffectiveStatus(a) === 'HalfDay' ? 'Half Day' : getEffectiveStatus(a)}}</span></td>
            <td>{{ a.captureSource || 'Manual' }}</td>
            <td>
              <span>{{ a.captureSource === 'Biometric' && a.capturedAt ? (a.capturedAt | localDatetime:'time24') : (a.checkInTime || '—') }}</span>
              <small class="time-sub" *ngIf="a.captureSource === 'Biometric' && a.capturedAt">
                ({{ a.capturedAt | localDatetime:'time' }})
              </small>
              <small class="time-sub" *ngIf="a.captureSource !== 'Biometric' && formatDisplayTime(a.checkInTime) && formatDisplayTime(a.checkInTime) !== a.checkInTime">
                ({{ formatDisplayTime(a.checkInTime) }})
              </small>
            </td>
            <td>
              <span>{{ a.captureSource === 'Biometric' && a.checkOutTime && a.capturedAt ? (a.capturedAt | localDatetime:'time24') : (a.checkOutTime || '—') }}</span>
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
              <span *ngIf="!calculateDuration(a.checkInTime, a.checkOutTime)">—</span>
            </td>
            <td>{{a.remarks || '—'}}</td>
            <td class="actions-col">
              <button mat-icon-button color="primary" (click)="editRecord(a)"
                [disabled]="!attendancePermissions.canCorrectAttendance || attendanceMode === 'Biometric' || (isPublicHolidayOrSunday(a.attendanceDate) && !canEditPublicHolidayOrSunday)"
                matTooltip="Edit record">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="deleteRecord(a.id)"
                [disabled]="!attendancePermissions.canCorrectAttendance || attendanceMode === 'Biometric' || (isPublicHolidayOrSunday(a.attendanceDate) && !canEditPublicHolidayOrSunday)"
                matTooltip="Delete record">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </mat-card>

    <div class="empty-state" *ngIf="records.length === 0 && !loading && !showMarkForm">
      <mat-icon>event_busy</mat-icon>
      <h3>No Attendance Records Found</h3>
      <p>No records found for {{months[attMonth - 1]}} {{attYear}}. Click "Mark Attendance" or "Today Present" to begin logging attendance.</p>
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

    /* Fixed Horizontal Toolbar (No vertical center stacking!) */
    .attendance-toolbar {
      background:#ffffff;
      border-radius:12px;
      padding:12px 20px;
      display:flex;
      flex-direction:row;
      align-items:center;
      justify-content:space-between;
      gap:16px;
      flex-wrap:wrap;
      border:1px solid #e2e8f0;
    }
    .toolbar-left {
      display:flex;
      align-items:center;
      gap:20px;
      flex-wrap:wrap;
    }
    .teacher-info-badge {
      display:flex;
      align-items:center;
      gap:10px;
      padding-right:16px;
      border-right:1.5px solid #e2e8f0;
      mat-icon{font-size:28px;width:28px;height:28px;}
    }
    .teacher-meta-text {
      strong{font-size:.98rem;color:#0f172a;display:block;}
      .emp-code{font-size:.76rem;color:#64748b;font-weight:600;}
    }
    .period-selectors {
      display:flex;
      align-items:center;
      gap:12px;
    }
    /* Fixed generous width for Month and Year */
    .month-select-field { width:180px; min-width:175px; margin-bottom:-1.25em; }
    .year-select-field { width:115px; min-width:110px; margin-bottom:-1.25em; }

    .toolbar-right {
      display:flex;
      align-items:center;
      gap:12px;
      margin-left:auto;
    }
    .quick-today-btn { font-weight:600; border-radius:8px; border-color:#0284c7; color:#0284c7; }
    .mark-btn { font-weight:600; border-radius:8px; }

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
    .legend-chips { display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:.76rem; font-weight:600;
      .leg.present{color:#16a34a;} .leg.absent{color:#dc2626;} .leg.late{color:#ea580c;}
      .leg.half{color:#9333ea;} .leg.pub-holiday{color:#b45309;font-weight:700;}
      .leg.sunday{color:#e11d48;font-weight:700;} .leg.saturday{color:#6366f1;font-weight:700;}
      .leg.unmarked{color:#94a3b8;} }

    .days-heatmap-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(42px, 1fr)); gap:6px; }
    .day-cell {
      border:1px solid #e2e8f0; border-radius:8px; padding:6px 2px; text-align:center;
      cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:1px;
      background:#f8fafc; transition:all .15s;
    }
    .day-cell:hover { transform:scale(1.06); box-shadow:0 2px 8px rgba(0,0,0,0.1); }
    .day-cell.today { border:2px solid #0284c7; }
    .day-cell.present { background:#dcfce7; border-color:#86efac; .cell-num{color:#15803d;} .cell-tag{color:#166534;font-weight:700;} }
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

    /* Future dates — greyed out, not clickable */
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

    .cell-num { font-size:.82rem; font-weight:700; color:#334155; }
    .cell-sub { font-size:.65rem; color:#94a3b8; }
    .cell-tag { font-size:.64rem; }

    /* Table */
    .table-card { border-radius:12px; overflow:hidden; padding:0; border:1px solid #e2e8f0; }
    .table-card-header { padding:14px 20px; background:#f8fafc; border-bottom:1px solid #e2e8f0; font-size:.92rem; color:#1e293b; }
    .att-table { width:100%; border-collapse:collapse; font-size:.86rem; }
    .att-table th, .att-table td { padding:12px 16px; border-bottom:1px solid #f1f5f9; text-align:left; }
    .att-table th { background:#f8fafc; font-weight:700; color:#64748b; font-size:.78rem; text-transform:uppercase; letter-spacing:.4px; }
    .att-table tr:hover td { background:#fbfcfd; }
    .day-label { font-size:.8rem; color:#64748b; }
    .work-duration { background:#f1f5f9; color:#334155; padding:2px 8px; border-radius:6px; font-weight:600; font-size:.78rem; }
    .time-sub { display:block; font-size:.72rem; color:#64748b; margin-top:2px; font-weight:600; }
    .actions-col { text-align:right; width:100px; }

    .status-badge { padding:3px 10px; border-radius:8px; font-size:.74rem; font-weight:700; text-transform:capitalize;
      &.present{background:#dcfce7;color:#15803d;}
      &.absent{background:#fee2e2;color:#b91c1c;}
      &.late{background:#ffedd5;color:#c2410c;}
      &.halfday{background:#f3e8ff;color:#7e22ce;}
      &.holiday{background:#dbeafe;color:#1d4ed8;} }

    .empty-state { display:flex; flex-direction:column; align-items:center; text-align:center; padding:50px 20px; color:#64748b; background:#f8fafc; border-radius:14px; border:2px dashed #cbd5e1;
      mat-icon{font-size:48px;width:48px;height:48px;color:#cbd5e1;margin-bottom:10px;}
      h3{margin:0 0 6px;color:#1e293b;font-size:1.1rem;font-weight:700;}
      p{margin:0;font-size:.88rem;} }
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
  todayStr = new Date().toISOString().split('T')[0];
  attendanceMode: AttendanceSettingsDto['teacherMode'] = 'Both';
  private attendanceSettings: AttendanceSettingsDto = { studentMode: 'Both', teacherMode: 'Both' };
  attendancePermissions: AttendancePermissionsDto = { canChangeMode: false, canManualMark: false, canBiometricCapture: false, canMapBiometric: false, canCorrectAttendance: false };

  attMonth = new Date().getMonth() + 1;
  attYear = new Date().getFullYear();

  months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  years = [2024, 2025, 2026, 2027];

  markData: any = {
    attendanceDate: new Date().toISOString().split('T')[0],
    status: 'Present',
    checkInTime: '08:00',
    checkOutTime: '17:00',
    remarks: ''
  };

  calendarDays: CalendarDayItem[] = [];

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit() {
    this.loadAttendanceSettings();
    this.http.get<AttendancePermissionsDto>(`${this.api}/attendance/permissions`).subscribe({ next: permissions => this.attendancePermissions = permissions });
    this.route.queryParams.subscribe(p => { if (p['teacherId']) this.preSelectId = p['teacherId']; });
  }

  loadAttendanceSettings() {
    this.http.get<AttendanceSettingsDto>(`${this.api}/attendance/settings`).subscribe({
      next: settings => { this.attendanceSettings = settings; this.attendanceMode = settings.teacherMode; },
      error: () => { this.attendanceMode = 'Both'; }
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
    const todayStr = new Date().toISOString().split('T')[0];
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

      if (found) {
        status = this.getEffectiveStatus(found) as any;
      } else if (isDeclaredHoliday) {
        status = 'Holiday';
      } else if (isSunday) {
        status = 'Holiday';
        holidayTitle = holidayTitle || 'Sunday (Weekly Off)';
      }

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
        record: found
      });
    }

    this.calendarDays = items;
  }

  getCellShortTag(d: CalendarDayItem): string {
    if (d.record) {
      return this.getStatusShortTag(d.status);
    }
    if (d.isDeclaredHoliday) {
      return 'PH'; // Public Holiday from Holiday Master
    }
    if (d.isSunday) {
      return 'SUN';
    }
    if (d.isSaturday) {
      return 'SAT';
    }
    return '—';
  }

  getStatusShortTag(status: string): string {
    switch (status) {
      case 'Present': return 'P';
      case 'Absent': return 'A';
      case 'Late': return 'L';
      case 'HalfDay': return 'HD';
      case 'Holiday': return 'H';
      default: return '—';
    }
  }

  onDayCellClick(d: CalendarDayItem) {
    // Block future dates for everyone
    if (d.dateStr > this.todayStr) {
      this.confirmDialog.alert('Future Date', 'Attendance cannot be marked in advance for future dates.', 'warning');
      return;
    }

    // Block back dates for non-admins
    if (d.dateStr < this.todayStr && !this.attendancePermissions.canCorrectAttendance) {
      this.confirmDialog.alert('Back-Date Restricted', 'You do not have permission to mark or correct past date attendance. Please contact Admin.', 'warning');
      return;
    }

    if (this.isPublicHolidayOrSunday(d.dateStr) && !this.canEditPublicHolidayOrSunday) {
      this.confirmDialog.alert('Editing Disabled', 'PH/SUN attendance editing is disabled for your role.', 'warning');
      return;
    }

    this.markData.attendanceDate = d.dateStr;
    if (d.record) {
      this.markData.status = d.record.status;
      this.markData.checkInTime = d.record.checkInTime || '08:00';
      this.markData.checkOutTime = d.record.checkOutTime || '17:00';
      this.markData.remarks = d.record.remarks || '';
    } else {
      if (d.isDeclaredHoliday) {
        this.markData.status = 'Holiday';
        this.markData.remarks = `${d.holidayTitle || 'Official Holiday'} (Academic Calendar)`;
      } else if (d.isSunday) {
        this.markData.status = 'Holiday';
        this.markData.remarks = 'Sunday Weekly Off';
      } else {
        this.markData.status = 'Present';
        this.markData.remarks = '';
      }
      this.markData.checkInTime = '08:00';
      this.markData.checkOutTime = '17:00';
    }
    this.showMarkForm = true;
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

  getEffectiveStatus(record?: { status?: string; checkInTime?: string; checkOutTime?: string }): 'Present' | 'Absent' | 'Late' | 'HalfDay' | 'Holiday' | 'Unmarked' {
    if (!record || !record.status) return 'Unmarked';
    if (record.status === 'Absent' || record.status === 'Holiday' || record.status === 'WeekOff') {
      return record.status === 'WeekOff' ? 'Holiday' : (record.status as any);
    }
    const diff = this.getDiffMinutes(record.checkInTime, record.checkOutTime);
    const inMin = this.parseTimeToMinutes(record.checkInTime);
    if (diff !== null && diff > 0 && diff < 240) return 'HalfDay';
    if (diff !== null && diff >= 240 && inMin !== null && inMin > 495 && (record.status === 'Present' || record.status === 'Late')) return 'Late';
    return record.status as any;
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

    if (diff < 240) {
      return `Work Duration: ${durStr} (< 4 hours) — Auto-detected as Half Day`;
    }
    if (inMin > 495) {
      return `Punch-in: ${this.markData.checkInTime} (After 08:15 AM grace cutoff) — Auto-detected as Late Mark (${durStr} duration)`;
    }
    return `Work Duration: ${durStr} (On-time punch-in) — Full Day Present`;
  }

  getLateQuotaTooltip(): string {
    if (!this.summary) return '';
    const allowed = this.summary.allowedLateDays || 3;
    const lates = this.summary.lateDays || 0;
    if (lates <= allowed) {
      return `Coaching Policy: 3 free grace lates/month. ${allowed - lates} grace marks remaining (₹0 penalty).`;
    }
    const excess = this.summary.excessLateDays || (lates - allowed);
    const penalty = this.summary.latePenaltyDays || 0;
    return `Grace limit exceeded by ${excess} lates! Incurring ${penalty} day loss-of-pay deduction in payroll (3 excess = 0.5 day cut).`;
  }

  quickMarkTodayPresent() {
    if (!this.selectedTeacher) return;
    const todayStr = new Date().toISOString().split('T')[0];
    this.markData.attendanceDate = todayStr;
    this.markData.status = 'Present';
    this.markData.checkInTime = '08:00';
    this.markData.checkOutTime = '17:00';
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

    this.saving = true;

    // Normalize check-in and check-out to 24-hour format seamlessly
    const inNormalized = this.normalizeTo24h(this.markData.checkInTime);
    const outNormalized = this.normalizeTo24h(this.markData.checkOutTime, this.markData.checkInTime);

    // Enforce effective smart status before saving
    this.markData.status = this.getEffectiveStatus({
      status: this.markData.status,
      checkInTime: inNormalized,
      checkOutTime: outNormalized
    });

    const payload = {
      attendanceDate: this.markData.attendanceDate,
      entries: [{
        teacherId: this.selectedTeacher.id,
        status: this.markData.status,
        checkInTime: inNormalized || null,
        checkOutTime: outNormalized || null,
        remarks: this.markData.remarks || null
      }]
    };

    // Try single teacher endpoint first, with seamless fallback to bulk endpoint
    this.http.post(`${this.api}/teachers/${this.selectedTeacher.id}/attendance`, {
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
    const date = record.attendanceDate.split('T')[0];
    if (this.isPublicHolidayOrSunday(date) && !this.canEditPublicHolidayOrSunday) {
      this.confirmDialog.alert('Editing Disabled', 'PH/SUN attendance editing is disabled for your role.', 'warning');
      return;
    }

    this.markData.attendanceDate = date;
    this.markData.checkInTime = record.checkInTime || '';
    this.markData.checkOutTime = record.checkOutTime || '';
    this.markData.status = this.getEffectiveStatus(record);
    this.markData.remarks = record.remarks || '';
    this.showMarkForm = true;
  }

  deleteRecord(id: string) {
    const record = this.records.find(item => item.id === id);
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
    if (date.getDay() === 0) return true;

    return this.holidays.some(h => {
      const start = h.startDate.split('T')[0];
      const end = h.endDate.split('T')[0];
      return dateOnly >= start && dateOnly <= end;
    });
  }
}
