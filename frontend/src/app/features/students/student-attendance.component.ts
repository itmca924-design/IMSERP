import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { API_BASE, AttendancePermissionsDto, AttendanceSettingsDto, HolidayDto } from '../teachers/teacher.models';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { CoachingService } from '../../core/services/coaching.service';

interface StudentItem {
  id: string;
  rollNumber: string;
  studentName: string;
  batchName: string;
}

interface BatchStudentRow {
  studentId: string;
  studentName: string;
  rollNumber: string;
  profilePhoto?: string | null;
  parentWhatsAppPhone?: string | null;
  status: string;
  remarks?: string | null;
  attendanceId?: string | null;
}

interface StudentAttendance {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  attendanceDate: string;
  status: string;
  remarks?: string;
  captureSource?: string;
}

interface AttendanceSummary {
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  holidayDays: number;
  totalWorkingDays: number;
  attendancePercentage: number;
}

interface CalendarDay {
  dayNumber: number;
  dateStr: string;
  dayOfWeek: string;
  isToday: boolean;
  isSunday: boolean;
  isSaturday: boolean;
  holiday?: HolidayDto;
  record?: StudentAttendance;
  status: string;
}

@Component({
  selector: 'app-student-attendance',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, MatCardModule, MatButtonModule,
    MatIconModule, MatInputModule, MatFormFieldModule, MatSelectModule,
    MatProgressBarModule, MatTooltipModule, MatCheckboxModule
  ],
  template: `
<div class="page-container">
  <div class="page-header">
    <div>
      <h1 class="page-title"><mat-icon>event_available</mat-icon> Student Attendance Management</h1>
      <p class="page-subtitle">Mark daily batch roll call in bulk or view detailed individual student monthly registers.</p>
    </div>
    <div class="header-actions">
      <a mat-stroked-button routerLink="/students"><mat-icon>people</mat-icon> Student Directory</a>
    </div>
  </div>

  <!-- Dual Mode Tab Switcher -->
  <div class="view-mode-tabs">
    <button type="button" class="tab-btn" [class.active]="activeTab === 'batch'" (click)="activeTab = 'batch'">
      <mat-icon>groups</mat-icon>
      <div class="tab-text">
        <strong>Batch Roll Call (Bulk)</strong>
        <small>Mark attendance for 50+ students in 1 click</small>
      </div>
    </button>
    <button type="button" class="tab-btn" [class.active]="activeTab === 'single'" (click)="activeTab = 'single'">
      <mat-icon>person_search</mat-icon>
      <div class="tab-text">
        <strong>Individual Student Register</strong>
        <small>Monthly calendar, leave logs & compliance</small>
      </div>
    </button>
  </div>

  <!-- Loading Bar -->
  <mat-progress-bar mode="indeterminate" *ngIf="loading || batchLoading || batchSaving"></mat-progress-bar>

  <!-- ================= TAB 1: BATCH ROLL CALL (BULK) ================= -->
  <div *ngIf="activeTab === 'batch'" class="batch-view">
    <!-- Controls Card -->
    <mat-card class="batch-controls-card mat-elevation-z1">
      <div class="controls-row">
        <!-- Batch Dropdown -->
        <mat-form-field appearance="outline" class="batch-select">
          <mat-label>Select Batch</mat-label>
          <mat-select [(ngModel)]="selectedBatchId" (selectionChange)="onBatchChanged()">
            <mat-option *ngFor="let b of batches" [value]="b.id">
              {{ b.name }} ({{ b.subject || b.academicYear || 'General' }})
            </mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Date Controls -->
        <div class="date-controls">
          <button mat-icon-button (click)="prevDay()" matTooltip="Previous Day">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <mat-form-field appearance="outline" class="date-input">
            <mat-label>Attendance Date</mat-label>
            <input matInput type="date" [(ngModel)]="selectedBatchDate" (change)="loadBatchAttendance()">
          </mat-form-field>
          <button mat-icon-button (click)="nextDay()" matTooltip="Next Day">
            <mat-icon>chevron_right</mat-icon>
          </button>
          <button mat-stroked-button class="today-btn" (click)="setToday()">Today</button>
        </div>

        <!-- Search in batch -->
        <mat-form-field appearance="outline" class="search-input">
          <mat-label>Search student or roll no</mat-label>
          <input matInput [(ngModel)]="batchSearchQuery" placeholder="Filter list...">
          <mat-icon matPrefix>search</mat-icon>
        </mat-form-field>
      </div>

      <!-- Live Counters & Bulk Actions -->
      <div class="stats-and-actions">
        <div class="stats-counters">
          <span class="stat-pill total">Total: <strong>{{ totalBatchStudents }}</strong></span>
          <span class="stat-pill present">Present: <strong>{{ presentBatchCount }}</strong></span>
          <span class="stat-pill absent">Absent: <strong>{{ absentBatchCount }}</strong></span>
          <span class="stat-pill late">Late: <strong>{{ lateBatchCount }}</strong></span>
          <span class="stat-pill halfday">Half-Day: <strong>{{ halfDayBatchCount }}</strong></span>
        </div>

        <div class="fast-actions">
          <button mat-stroked-button class="btn-bulk-present" (click)="markAllStatus('Present')" matTooltip="Set all students to Present">
            <mat-icon>done_all</mat-icon> Mark All Present
          </button>
          <button mat-stroked-button class="btn-bulk-absent" (click)="markAllStatus('Absent')" matTooltip="Set all students to Absent">
            <mat-icon>highlight_off</mat-icon> Mark All Absent
          </button>
        </div>
      </div>
    </mat-card>

    <!-- Success Message Banner -->
    <div *ngIf="batchSuccessMsg" class="success-banner">
      <mat-icon>check_circle</mat-icon>
      <span>{{ batchSuccessMsg }}</span>
      <button mat-icon-button (click)="batchSuccessMsg = ''"><mat-icon>close</mat-icon></button>
    </div>

    <!-- Empty State -->
    <mat-card class="mat-elevation-z1 empty-card" *ngIf="!selectedBatchId">
      <mat-icon class="empty-icon">groups</mat-icon>
      <h3>No Batch Selected</h3>
      <p>Please select a batch from the dropdown above to mark attendance.</p>
    </mat-card>

    <mat-card class="mat-elevation-z1 empty-card" *ngIf="selectedBatchId && !batchLoading && filteredBatchStudents.length === 0">
      <mat-icon class="empty-icon">person_off</mat-icon>
      <h3>No Students Found</h3>
      <p *ngIf="batchStudents.length === 0">No active students are enrolled in this batch.</p>
      <p *ngIf="batchStudents.length > 0">No students match your search filter "{{ batchSearchQuery }}".</p>
    </mat-card>

    <!-- Students Roll Call Table Card -->
    <mat-card class="roll-call-card mat-elevation-z1" *ngIf="filteredBatchStudents.length > 0">
      <div class="table-responsive">
        <table class="roll-call-table">
          <thead>
            <tr>
              <th style="width: 50px;">#</th>
              <th>Student Details</th>
              <th>Roll Number</th>
              <th>Parent WhatsApp</th>
              <th style="width: 280px; text-align: center;">Attendance Status</th>
              <th>Remarks / Note</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of filteredBatchStudents; let i = index" [class.row-absent]="s.status === 'Absent'" [class.row-present]="s.status === 'Present'">
              <td class="index-cell">{{ i + 1 }}</td>
              <td class="student-cell">
                <div class="avatar-box" [style.background]="getAvatarColor(s.studentName)">
                  {{ getInitials(s.studentName) }}
                </div>
                <div class="student-meta">
                  <span class="name">{{ s.studentName }}</span>
                  <span class="sub" *ngIf="s.attendanceId"><mat-icon class="saved-dot">check</mat-icon> Previously Saved</span>
                </div>
              </td>
              <td><span class="roll-pill">{{ s.rollNumber }}</span></td>
              <td class="whatsapp-cell">
                <a *ngIf="s.parentWhatsAppPhone" [href]="'https://wa.me/' + cleanPhone(s.parentWhatsAppPhone)" target="_blank" class="wa-link" matTooltip="Chat on WhatsApp">
                  <img src="assets/images/whatsapp-icon.png" onerror="this.style.display='none'" class="wa-icon-img" alt="WA">
                  <mat-icon *ngIf="!hasWaImg">chat</mat-icon>
                  <span>{{ s.parentWhatsAppPhone }}</span>
                </a>
                <span *ngIf="!s.parentWhatsAppPhone" class="text-muted">—</span>
              </td>
              <td class="status-cell">
                <div class="status-btn-group">
                  <button type="button" class="status-pill p-btn" [class.selected]="s.status === 'Present'" (click)="s.status = 'Present'" matTooltip="Mark Present">
                    <span class="badge">P</span>
                    <span class="label">Present</span>
                  </button>
                  <button type="button" class="status-pill a-btn" [class.selected]="s.status === 'Absent'" (click)="s.status = 'Absent'" matTooltip="Mark Absent">
                    <span class="badge">A</span>
                    <span class="label">Absent</span>
                  </button>
                  <button type="button" class="status-pill l-btn" [class.selected]="s.status === 'Late'" (click)="s.status = 'Late'" matTooltip="Mark Late">
                    <span class="badge">L</span>
                    <span class="label">Late</span>
                  </button>
                  <button type="button" class="status-pill h-btn" [class.selected]="s.status === 'HalfDay'" (click)="s.status = 'HalfDay'" matTooltip="Mark Half Day">
                    <span class="badge">H</span>
                    <span class="label">Half</span>
                  </button>
                </div>
              </td>
              <td class="remarks-cell">
                <input type="text" [(ngModel)]="s.remarks" placeholder="Add note (optional)" class="remarks-input" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Bottom Save Action Bar -->
      <div class="save-bar">
        <div class="whatsapp-alert-toggle">
          <mat-checkbox [(ngModel)]="sendWhatsAppAlerts" color="primary">
            <span class="wa-checkbox-label">
              Send WhatsApp attendance SMS / alert to absent students' parents
              <strong *ngIf="absentBatchCount > 0" class="wa-badge">({{ absentBatchCount }} Absent)</strong>
            </span>
          </mat-checkbox>
        </div>

        <div class="save-actions">
          <button mat-raised-button color="primary" class="btn-save-batch" (click)="saveBatchAttendance()" [disabled]="batchSaving || batchLoading">
            <mat-icon>save</mat-icon>
            <span>{{ batchSaving ? 'Saving Attendance...' : 'Save Batch Attendance (' + totalBatchStudents + ' Students)' }}</span>
          </button>
        </div>
      </div>
    </mat-card>
  </div>

  <!-- ================= TAB 2: INDIVIDUAL STUDENT REGISTER ================= -->
  <div *ngIf="activeTab === 'single'" class="single-view">
    <mat-card class="selector-card mat-elevation-z1">
      <mat-icon color="primary" class="selector-icon">person_search</mat-icon>
      <mat-form-field appearance="outline" class="student-select">
        <mat-label>Select Student</mat-label>
        <mat-select [(ngModel)]="selectedStudentId" (selectionChange)="onStudentChanged()">
          <mat-option *ngFor="let student of students" [value]="student.id">
            {{ student.rollNumber }} - {{ student.studentName }} ({{ student.batchName }})
          </mat-option>
        </mat-select>
      </mat-form-field>
      <div class="student-context" *ngIf="selectedStudent">
        <strong>{{ selectedStudent.studentName }}</strong>
        <span>{{ selectedStudent.rollNumber }}</span>
        <span>{{ selectedStudent.batchName }}</span>
      </div>
    </mat-card>

    <div *ngIf="selectedStudent" class="attendance-wrapper">
      <mat-card class="period-card mat-elevation-z1">
        <div class="period-student">
          <mat-icon>account_circle</mat-icon>
          <div>
            <strong>{{ selectedStudent.studentName }}</strong>
            <small>{{ selectedStudent.rollNumber }}</small>
          </div>
        </div>
        <div class="period-selectors">
          <mat-form-field appearance="outline"><mat-label>Month</mat-label><mat-select [(ngModel)]="attMonth" (selectionChange)="loadAttendance()"><mat-option *ngFor="let month of months; let i = index" [value]="i + 1">{{ month }}</mat-option></mat-select></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Year</mat-label><mat-select [(ngModel)]="attYear" (selectionChange)="loadAttendance()"><mat-option *ngFor="let year of years" [value]="year">{{ year }}</mat-option></mat-select></mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="mode-select"><mat-label>Student Attendance Mode</mat-label><mat-select [(ngModel)]="attendanceMode" (selectionChange)="saveAttendanceMode()" [disabled]="!attendancePermissions.canChangeMode"><mat-option value="Both">Manual + Biometric</mat-option><mat-option value="Manual">Manual Only</mat-option><mat-option value="Biometric">Biometric Only</mat-option></mat-select></mat-form-field>
        <button mat-raised-button color="primary" (click)="openNewRecord()" [disabled]="!attendancePermissions.canManualMark || attendanceMode === 'Biometric'" matTooltip="Manual marking is disabled by permission or mode"><mat-icon>add_task</mat-icon> Mark Attendance</button>
      </mat-card>

      <div class="summary-grid" *ngIf="summary">
        <div class="summary-card present"><mat-icon>check_circle</mat-icon><strong>{{ summary.presentDays }}</strong><small>Present Days</small></div>
        <div class="summary-card absent"><mat-icon>cancel</mat-icon><strong>{{ summary.absentDays }}</strong><small>Absent Days</small></div>
        <div class="summary-card late"><mat-icon>schedule</mat-icon><strong>{{ summary.lateDays }}</strong><small>Late Marks</small></div>
        <div class="summary-card half"><mat-icon>hourglass_bottom</mat-icon><strong>{{ summary.halfDays }}</strong><small>Half Days</small></div>
        <div class="summary-card holiday"><mat-icon>beach_access</mat-icon><strong>{{ summary.holidayDays }}</strong><small>Holidays / Off</small></div>
        <div class="summary-card compliance"><mat-icon>analytics</mat-icon><strong>{{ summary.attendancePercentage }}%</strong><small>Compliance</small></div>
        <div class="summary-card working"><mat-icon>calendar_today</mat-icon><strong>{{ summary.totalWorkingDays }}</strong><small>Working Days</small></div>
      </div>

      <mat-card class="form-card mat-elevation-z1" *ngIf="showForm">
        <div class="form-heading"><div><strong>{{ editingRecordId ? 'Edit Attendance Record' : 'Log Attendance Record' }}</strong><small>Enter date, status, and remarks.</small></div><button mat-icon-button (click)="showForm = false"><mat-icon>close</mat-icon></button></div>
        <div class="form-row">
          <mat-form-field appearance="outline"><mat-label>Attendance Date</mat-label><input matInput type="date" [(ngModel)]="formData.attendanceDate"></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Attendance Status</mat-label><mat-select [(ngModel)]="formData.status"><mat-option value="Present">● Present</mat-option><mat-option value="Absent">● Absent</mat-option><mat-option value="Late">● Late</mat-option><mat-option value="HalfDay">● Half Day</mat-option><mat-option value="Holiday">● Holiday / Off</mat-option></mat-select></mat-form-field>
          <mat-form-field appearance="outline" class="remarks-field"><mat-label>Remarks / Notes</mat-label><input matInput [(ngModel)]="formData.remarks" placeholder="e.g. Medical leave"></mat-form-field>
        </div>
        <div class="form-actions"><button mat-button (click)="showForm = false">Cancel</button><button mat-raised-button color="primary" (click)="saveAttendance()" [disabled]="!formData.attendanceDate || !formData.status || saving"><mat-icon>save</mat-icon> Save Record</button></div>
      </mat-card>

      <mat-card class="calendar-card mat-elevation-z1">
        <div class="calendar-heading"><strong><mat-icon>calendar_view_month</mat-icon>{{ months[attMonth - 1] }} {{ attYear }} Monthly Day-by-Day Roster</strong><div class="legend"><span class="present-dot">● Present</span><span class="absent-dot">● Absent</span><span class="holiday-dot">★ Public Holiday</span><span class="sunday-dot">● Sunday</span><span class="saturday-dot">● Saturday</span></div></div>
        <div class="calendar-grid">
          <button *ngFor="let day of calendarDays" type="button" class="day-cell" [class.present]="day.status === 'Present'" [class.absent]="day.status === 'Absent'" [class.late]="day.status === 'Late'" [class.half]="day.status === 'HalfDay'" [class.holiday]="day.holiday && !day.record" [class.sunday]="day.isSunday && !day.record && !day.holiday" [class.saturday]="day.isSaturday && !day.record && !day.holiday" [class.today]="day.isToday" [class.locked]="isPublicHolidayOrSunday(day.dateStr) && !canEditPublicHolidayOrSunday" [matTooltip]="getDayTooltip(day)" (click)="openDay(day)"><span>{{ day.dayNumber }}</span><small>{{ day.dayOfWeek }}</small><b>{{ getShortTag(day) }}</b></button>
        </div>
      </mat-card>

      <mat-card class="records-card mat-elevation-z1" *ngIf="records.length">
        <div class="records-heading"><strong>Detailed Attendance Register</strong><span>{{ records.length }} Records</span></div>
        <div class="record-row" *ngFor="let record of records"><div><strong>{{ record.attendanceDate | date:'dd MMM yyyy' }}</strong><small>{{ record.attendanceDate | date:'EEEE' }}</small></div><span class="status" [ngClass]="record.status.toLowerCase()">{{ record.status === 'HalfDay' ? 'Half Day' : record.status }}</span><span class="source-tag">{{ record.captureSource || 'Manual' }}</span><span class="remarks">{{ record.remarks || '—' }}</span><div class="record-actions"><button mat-icon-button color="primary" (click)="editRecord(record)" [disabled]="!attendancePermissions.canCorrectAttendance || attendanceMode === 'Biometric' || (isPublicHolidayOrSunday(record.attendanceDate) && !canEditPublicHolidayOrSunday)" matTooltip="Edit record"><mat-icon>edit</mat-icon></button><button mat-icon-button color="warn" (click)="deleteRecord(record.id)" [disabled]="!attendancePermissions.canCorrectAttendance || attendanceMode === 'Biometric' || (isPublicHolidayOrSunday(record.attendanceDate) && !canEditPublicHolidayOrSunday)" matTooltip="Delete record"><mat-icon>delete_outline</mat-icon></button></div></div>
      </mat-card>
    </div>
  </div>
</div>
  `,
  styles: [`
    .page-container { display: flex; flex-direction: column; gap: 16px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; }
    .page-title { margin: 0; color: #1976d2; font-size: 1.45rem; display: flex; align-items: center; gap: 8px; }
    .page-subtitle { margin: 4px 0 0; color: #64748b; font-size: .88rem; }
    
    /* View Mode Tabs */
    .view-mode-tabs { display: flex; gap: 12px; margin-bottom: 4px; }
    .tab-btn {
      flex: 1; max-width: 320px; display: flex; align-items: center; gap: 12px;
      padding: 12px 18px; border: 1.5px solid #cbd5e1; border-radius: 12px;
      background: #ffffff; cursor: pointer; transition: all 0.2s ease-in-out;
      text-align: left; color: #475569;
    }
    .tab-btn mat-icon { font-size: 28px; width: 28px; height: 28px; color: #64748b; }
    .tab-text strong { display: block; font-size: 0.95rem; color: #1e293b; }
    .tab-text small { font-size: 0.75rem; color: #64748b; }
    .tab-btn.active {
      border-color: #2563eb; background: #eff6ff; color: #1d4ed8;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.12);
    }
    .tab-btn.active mat-icon { color: #2563eb; }
    .tab-btn.active .tab-text strong { color: #1e40af; }

    /* Batch View & Controls Card */
    .batch-view { display: flex; flex-direction: column; gap: 16px; }
    .batch-controls-card { padding: 16px 20px; border-radius: 12px; background: #ffffff; margin-bottom: 6px; }
    .controls-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .batch-select { flex: 1 1 260px; min-width: 220px; margin: 0; }
    .date-controls { display: flex; align-items: center; gap: 6px; }
    .date-input { width: 170px; margin: 0; }
    .today-btn { height: 48px; border-radius: 8px; font-weight: 600; color: #2563eb; }
    .search-input { flex: 1 1 200px; min-width: 180px; margin: 0; }

    /* Stats & Bulk Fast-Actions */
    .stats-and-actions {
      display: flex; justify-content: space-between; align-items: center;
      flex-wrap: wrap; gap: 12px; margin-top: 14px; padding-top: 14px;
      border-top: 1px solid #f1f5f9;
    }
    .stats-counters { display: flex; gap: 8px; flex-wrap: wrap; }
    .stat-pill {
      display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px;
      border-radius: 20px; font-size: 0.82rem; font-weight: 500;
    }
    .stat-pill.total { background: #f1f5f9; color: #334155; }
    .stat-pill.present { background: #dcfce7; color: #15803d; }
    .stat-pill.absent { background: #fee2e2; color: #b91c1c; }
    .stat-pill.late { background: #ffedd5; color: #c2410c; }
    .stat-pill.halfday { background: #f3e8ff; color: #7e22ce; }

    .fast-actions { display: flex; gap: 10px; }
    .btn-bulk-present {
      color: #15803d !important; border-color: #86efac !important; background: #f0fdf4 !important;
      font-weight: 600; border-radius: 8px;
    }
    .btn-bulk-present:hover { background: #dcfce7 !important; }
    .btn-bulk-absent {
      color: #b91c1c !important; border-color: #fca5a5 !important; background: #fef2f2 !important;
      font-weight: 600; border-radius: 8px;
    }
    .btn-bulk-absent:hover { background: #fee2e2 !important; }

    /* Success Banner */
    .success-banner {
      display: flex; align-items: center; justify-content: space-between;
      background: #ecfdf5; border: 1px solid #6ee7b7; color: #065f46;
      padding: 10px 18px; border-radius: 10px; font-weight: 500; font-size: 0.9rem;
    }
    .success-banner mat-icon { color: #059669; margin-right: 8px; }

    /* Empty Card */
    .empty-card {
      text-align: center; padding: 48px 24px; border-radius: 12px; color: #64748b;
    }
    .empty-icon { font-size: 48px; width: 48px; height: 48px; color: #94a3b8; margin-bottom: 8px; }

    /* Roll Call Table */
    .roll-call-card { padding: 0; border-radius: 12px; overflow: hidden; background: #ffffff; }
    .table-responsive { overflow-x: auto; }
    .roll-call-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    .roll-call-table th {
      background: #f8fafc; color: #475569; font-weight: 700; text-align: left;
      padding: 14px 16px; border-bottom: 2px solid #e2e8f0; font-size: 0.82rem;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .roll-call-table td {
      padding: 12px 16px; border-bottom: 1px solid #f1f5f9; vertical-align: middle;
    }
    .roll-call-table tr:hover { background: #f8fafc; }
    .roll-call-table tr.row-absent { background: #fff5f5; }
    .roll-call-table tr.row-present { background: #fcfdfc; }

    .index-cell { font-weight: 600; color: #94a3b8; }
    .student-cell { display: flex; align-items: center; gap: 12px; }
    .avatar-box {
      width: 36px; height: 36px; border-radius: 50%; color: #ffffff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 0.85rem; flex-shrink: 0;
    }
    .student-meta { display: flex; flex-direction: column; }
    .student-meta .name { font-weight: 600; color: #1e293b; font-size: 0.92rem; }
    .student-meta .sub { font-size: 0.72rem; color: #16a34a; display: flex; align-items: center; gap: 2px; }
    .saved-dot { font-size: 14px; width: 14px; height: 14px; }
    .roll-pill {
      background: #e2e8f0; color: #334155; padding: 3px 8px; border-radius: 6px;
      font-weight: 600; font-size: 0.78rem; font-family: monospace;
    }
    
    .whatsapp-cell .wa-link {
      display: inline-flex; align-items: center; gap: 6px; color: #16a34a;
      text-decoration: none; font-weight: 500; font-size: 0.85rem;
    }
    .whatsapp-cell .wa-link:hover { text-decoration: underline; }
    .whatsapp-cell mat-icon { font-size: 16px; width: 16px; height: 16px; color: #16a34a; }

    /* Interactive Status Quick-Pills Group */
    .status-btn-group {
      display: inline-flex; border: 1.5px solid #cbd5e1; border-radius: 8px;
      overflow: hidden; background: #ffffff;
    }
    .status-pill {
      border: none; background: #ffffff; padding: 6px 14px; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 0.8rem;
      color: #64748b; transition: all 0.15s; border-right: 1px solid #e2e8f0;
    }
    .status-pill:last-child { border-right: none; }
    .status-pill .badge { font-weight: 800; font-size: 0.82rem; }

    .status-pill.p-btn:hover { background: #dcfce7; color: #15803d; }
    .status-pill.p-btn.selected { background: #16a34a; color: #ffffff; }

    .status-pill.a-btn:hover { background: #fee2e2; color: #b91c1c; }
    .status-pill.a-btn.selected { background: #dc2626; color: #ffffff; }

    .status-pill.l-btn:hover { background: #ffedd5; color: #c2410c; }
    .status-pill.l-btn.selected { background: #ea580c; color: #ffffff; }

    .status-pill.h-btn:hover { background: #f3e8ff; color: #7e22ce; }
    .status-pill.h-btn.selected { background: #9333ea; color: #ffffff; }

    .remarks-input {
      width: 100%; max-width: 200px; padding: 6px 10px; border: 1px solid #cbd5e1;
      border-radius: 6px; font-size: 0.82rem; outline: none; transition: border-color 0.2s;
    }
    .remarks-input:focus { border-color: #2563eb; }

    /* Save Bar */
    .save-bar {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0;
      flex-wrap: wrap; gap: 14px;
    }
    .whatsapp-alert-toggle { display: flex; align-items: center; }
    .wa-checkbox-label { font-weight: 500; font-size: 0.9rem; color: #1e293b; }
    .wa-badge {
      background: #dc2626; color: #ffffff; padding: 2px 7px;
      border-radius: 12px; font-size: 0.75rem; margin-left: 6px;
    }
    .btn-save-batch {
      height: 46px; padding: 0 24px !important; font-size: 0.95rem !important;
      font-weight: 600 !important; border-radius: 8px !important; display: inline-flex;
      align-items: center; gap: 8px;
    }

    /* Tab 2 Single Student Styles */
    .selector-card, .period-card {
      display: flex; flex-direction: row !important; flex-wrap: nowrap !important;
      align-items: center; gap: 16px; padding: 10px 18px; border-radius: 10px;
      min-height: 78px; box-sizing: border-box;
    }
    .selector-icon { font-size: 28px; width: 28px; height: 28px; flex: 0 0 28px; }
    .student-select { flex: 1 1 auto; min-width: 280px; margin: 0; }
    .student-context { display: flex; flex: 0 0 250px; flex-direction: column; gap: 2px; color: #64748b; font-size: .78rem; }
    .student-context strong { color: #1e293b; font-size: .9rem; }
    .period-card { justify-content: space-between; min-height: 82px; margin-bottom: 8px; }
    .period-student { display: flex; align-items: center; gap: 10px; color: #2563eb; flex: 1 1 auto; min-width: 180px; }
    .period-student mat-icon { font-size: 28px; width: 28px; height: 28px; }
    .period-student div { display: flex; flex-direction: column; }
    .period-student small { color: #64748b; }
    .period-selectors { display: flex; gap: 10px; flex: 0 0 auto; }
    .period-selectors mat-form-field { width: 155px; margin: 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 18px; margin: 4px 0 10px; }
    .summary-card {
      min-height: 80px; border: 1px solid #dbeafe; border-radius: 10px; padding: 10px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 2px; background: #f8fafc;
    }
    .summary-card mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .summary-card strong { font-size: 1.2rem; }
    .summary-card small { font-size: .68rem; }
    .summary-card.present { color: #15803d; background: #f0fdf4; }
    .summary-card.absent { color: #b91c1c; background: #fef2f2; }
    .summary-card.late { color: #c2410c; background: #fff7ed; }
    .summary-card.half { color: #7e22ce; background: #faf5ff; }
    .summary-card.holiday { color: #1d4ed8; background: #eff6ff; }
    .summary-card.compliance { color: #0369a1; background: #ecfeff; }
    .summary-card.working { color: #334155; background: #f8fafc; }
    .form-card { padding: 14px 18px; border-radius: 10px; }
    .form-heading, .form-actions, .calendar-heading, .records-heading { display: flex; align-items: center; justify-content: space-between; }
    .form-heading div { display: flex; flex-direction: column; }
    .form-heading small { color: #64748b; margin-top: 3px; }
    .form-row { display: flex; gap: 12px; margin-top: 12px; }
    .form-row mat-form-field { flex: 1; }
    .form-row .remarks-field { flex: 1.5; }
    .form-actions { justify-content: flex-end; gap: 8px; }
    .calendar-card, .records-card { padding: 16px; border-radius: 10px; margin-bottom: 12px; }
    .calendar-heading { margin-bottom: 14px; gap: 10px; }
    .calendar-heading strong { display: flex; align-items: center; gap: 7px; color: #1e293b; }
    .calendar-heading mat-icon { color: #2563eb; }
    .legend { display: flex; gap: 10px; font-size: .7rem; }
    .present-dot { color: #15803d; }
    .absent-dot { color: #dc2626; }
    .holiday-dot { color: #b45309; }
    .sunday-dot { color: #e11d48; }
    .saturday-dot { color: #4f46e5; }
    .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 9px; }
    .day-cell {
      min-height: 66px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 2px; cursor: pointer; color: #334155;
    }
    .day-cell span { font-weight: 800; }
    .day-cell small { color: #94a3b8; font-size: .66rem; }
    .day-cell b { font-size: .66rem; }
    .day-cell.present { background: #dcfce7; border-color: #86efac; color: #15803d; }
    .day-cell.absent { background: #fee2e2; border-color: #fca5a5; color: #b91c1c; }
    .day-cell.late { background: #ffedd5; border-color: #fdba74; color: #c2410c; }
    .day-cell.half { background: #f3e8ff; border-color: #d8b4fe; color: #7e22ce; }
    .day-cell.holiday { background: #fef3c7; border-color: #fbbf24; color: #b45309; }
    .day-cell.sunday { background: #ffe4e6; color: #be123c; }
    .day-cell.saturday { background: #e0e7ff; color: #4338ca; }
    .day-cell.today { box-shadow: 0 0 0 2px #2563eb inset; }
    .records-heading { padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
    .records-heading span { color: #64748b; font-size: .78rem; }
    .record-row {
      display: grid; grid-template-columns: 190px 120px 100px minmax(100px, 1fr) 104px;
      align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f1f5f9;
    }
    .record-row > div { display: flex; flex-direction: column; }
    .record-row small { color: #64748b; font-size: .72rem; }
    .status { font-size: .75rem; font-weight: 700; }
    .status.present { color: #15803d; }
    .status.absent { color: #b91c1c; }
    .status.late { color: #c2410c; }
    .status.halfday { color: #7e22ce; }
    .status.holiday { color: #1d4ed8; }
    .remarks { color: #64748b; font-size: .82rem; }
    .record-actions {
      display: flex !important; flex-direction: row !important; align-items: center;
      justify-content: flex-end; gap: 0; white-space: nowrap; width: 104px; min-width: 104px;
    }
    .record-actions button { display: inline-flex; flex: 0 0 48px; width: 48px; height: 48px; }

    @media (max-width: 900px) {
      .summary-grid { grid-template-columns: repeat(4, 1fr); gap: 14px; }
      .period-card { flex-wrap: wrap !important; }
      .legend { flex-wrap: wrap; }
      .form-row { flex-wrap: wrap; }
      .view-mode-tabs { flex-direction: column; }
      .tab-btn { max-width: 100%; }
    }
    @media (max-width: 600px) {
      .page-header, .selector-card, .period-card { align-items: stretch; flex-direction: column !important; flex-wrap: nowrap !important; }
      .student-select { min-width: 0; }
      .student-context, .period-student { flex-basis: auto; }
      .summary-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
      .calendar-grid { gap: 5px; }
      .day-cell { min-height: 54px; }
      .record-row { grid-template-columns: 1fr 90px 40px 40px; }
      .remarks { display: none; }
      .stats-and-actions { flex-direction: column; align-items: flex-start; }
      .save-bar { flex-direction: column; align-items: stretch; }
      .btn-save-batch { width: 100%; justify-content: center; }
    }
  `]
})
export class StudentAttendanceComponent implements OnInit {
  private api = API_BASE;
  hasWaImg = false;

  // Dual Tabs
  activeTab: 'batch' | 'single' = 'batch';

  // Batch Bulk Roll Call State
  batches: any[] = [];
  selectedBatchId = '';
  selectedBatchDate = new Date().toISOString().split('T')[0];
  batchStudents: BatchStudentRow[] = [];
  batchSearchQuery = '';
  batchLoading = false;
  batchSaving = false;
  sendWhatsAppAlerts = false;
  batchSuccessMsg = '';

  // Single Student Mode State
  students: StudentItem[] = [];
  selectedStudentId = '';
  selectedStudent?: StudentItem;
  records: StudentAttendance[] = [];
  holidays: HolidayDto[] = [];
  calendarDays: CalendarDay[] = [];
  summary: AttendanceSummary | null = null;
  loading = false;
  saving = false;
  showForm = false;
  canEditPublicHolidayOrSunday = false;
  editingRecordId: string | null = null;
  attMonth = new Date().getMonth() + 1;
  attYear = new Date().getFullYear();
  months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  years = [2024, 2025, 2026, 2027];
  formData = { attendanceDate: new Date().toISOString().split('T')[0], status: 'Present', remarks: '' };
  attendanceMode: AttendanceSettingsDto['studentMode'] = 'Both';
  private attendanceSettings: AttendanceSettingsDto = { studentMode: 'Both', teacherMode: 'Both' };
  attendancePermissions: AttendancePermissionsDto = { canChangeMode: false, canManualMark: false, canBiometricCapture: false, canMapBiometric: false, canCorrectAttendance: false };

  private avatarColors = [
    '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#059669',
    '#0891b2', '#4f46e5', '#d97706', '#dc2626', '#0d9488'
  ];

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private confirmDialog: ConfirmDialogService,
    private coachingService: CoachingService
  ) {}

  ngOnInit(): void {
    this.loadAttendanceSettings();
    this.http.get<AttendancePermissionsDto>(`${this.api}/attendance/permissions`).subscribe({
      next: permissions => this.attendancePermissions = permissions
    });

    // Load Batches for Tab 1
    this.loadBatches();

    // Load Students for Tab 2
    this.http.get<any[]>(`${this.api}/students`).subscribe({
      next: students => {
        this.students = students || [];
        const requestedStudentId = this.route.snapshot.queryParamMap.get('studentId');
        if (requestedStudentId && this.students.some(s => s.id === requestedStudentId)) {
          this.activeTab = 'single';
          this.selectedStudentId = requestedStudentId;
        } else {
          this.selectedStudentId = this.students[0]?.id || '';
        }
        if (this.selectedStudentId) {
          this.onStudentChanged();
        }
      }
    });
  }

  // ================= BATCH ROLL CALL METHODS =================

  loadBatches(): void {
    this.coachingService.getBatches().subscribe({
      next: batches => {
        this.batches = batches || [];
        const requestedBatchId = this.route.snapshot.queryParamMap.get('batchId');
        if (requestedBatchId && this.batches.some(b => b.id === requestedBatchId)) {
          this.selectedBatchId = requestedBatchId;
        } else if (this.batches.length > 0) {
          this.selectedBatchId = this.batches[0].id;
        }
        if (this.selectedBatchId) {
          this.loadBatchAttendance();
        }
      },
      error: () => {
        this.batches = [];
      }
    });
  }

  onBatchChanged(): void {
    this.batchSuccessMsg = '';
    this.loadBatchAttendance();
  }

  loadBatchAttendance(): void {
    if (!this.selectedBatchId) return;
    this.batchLoading = true;
    this.coachingService.getBatchAttendance(this.selectedBatchId, this.selectedBatchDate).subscribe({
      next: rows => {
        this.batchStudents = (rows || []).map(r => ({
          studentId: r.studentId,
          studentName: r.studentName,
          rollNumber: r.rollNumber,
          profilePhoto: r.profilePhoto,
          parentWhatsAppPhone: r.parentWhatsAppPhone,
          status: r.status || 'Present',
          remarks: r.remarks || '',
          attendanceId: r.attendanceId
        }));
        this.batchLoading = false;
      },
      error: () => {
        this.batchStudents = [];
        this.batchLoading = false;
      }
    });
  }

  prevDay(): void {
    const d = new Date(this.selectedBatchDate);
    d.setDate(d.getDate() - 1);
    this.selectedBatchDate = d.toISOString().split('T')[0];
    this.loadBatchAttendance();
  }

  nextDay(): void {
    const d = new Date(this.selectedBatchDate);
    d.setDate(d.getDate() + 1);
    this.selectedBatchDate = d.toISOString().split('T')[0];
    this.loadBatchAttendance();
  }

  setToday(): void {
    this.selectedBatchDate = new Date().toISOString().split('T')[0];
    this.loadBatchAttendance();
  }

  markAllStatus(status: string): void {
    for (const student of this.batchStudents) {
      student.status = status;
    }
  }

  get totalBatchStudents(): number {
    return this.batchStudents.length;
  }

  get presentBatchCount(): number {
    return this.batchStudents.filter(s => s.status === 'Present').length;
  }

  get absentBatchCount(): number {
    return this.batchStudents.filter(s => s.status === 'Absent').length;
  }

  get lateBatchCount(): number {
    return this.batchStudents.filter(s => s.status === 'Late').length;
  }

  get halfDayBatchCount(): number {
    return this.batchStudents.filter(s => s.status === 'HalfDay').length;
  }

  get filteredBatchStudents(): BatchStudentRow[] {
    if (!this.batchSearchQuery.trim()) return this.batchStudents;
    const q = this.batchSearchQuery.toLowerCase();
    return this.batchStudents.filter(s =>
      s.studentName.toLowerCase().includes(q) ||
      (s.rollNumber && s.rollNumber.toLowerCase().includes(q))
    );
  }

  saveBatchAttendance(): void {
    if (!this.selectedBatchId) {
      this.confirmDialog.alert('Selection Missing', 'Please select a batch first.', 'warning');
      return;
    }
    if (!this.selectedBatchDate) {
      this.confirmDialog.alert('Date Missing', 'Please select an attendance date.', 'warning');
      return;
    }
    if (!this.attendancePermissions.canManualMark) {
      this.confirmDialog.alert('Permission Denied', 'You do not have permission to mark manual attendance.', 'warning');
      return;
    }
    if (this.attendanceMode === 'Biometric') {
      this.confirmDialog.alert('Biometric Mode', 'Manual student attendance is disabled in Biometric Only mode.', 'warning');
      return;
    }
    if (this.batchStudents.length === 0) {
      this.confirmDialog.alert('No Students', 'There are no students to save attendance for.', 'warning');
      return;
    }

    this.batchSaving = true;
    this.batchSuccessMsg = '';

    const payload = {
      batchId: this.selectedBatchId,
      attendanceDate: this.selectedBatchDate,
      sendWhatsAppAlerts: this.sendWhatsAppAlerts,
      items: this.batchStudents.map(s => ({
        studentId: s.studentId,
        status: s.status,
        remarks: s.remarks || null
      }))
    };

    this.coachingService.saveBulkBatchAttendance(this.selectedBatchId, payload).subscribe({
      next: res => {
        this.batchSaving = false;
        const msg = res?.message || `Attendance saved successfully: ${this.presentBatchCount} Present, ${this.absentBatchCount} Absent.`;
        this.batchSuccessMsg = msg;
        this.confirmDialog.alert('Attendance Saved', msg, 'success');
        this.loadBatchAttendance();
      },
      error: err => {
        this.batchSaving = false;
        this.confirmDialog.alert('Save Failed', err?.error?.message || 'Failed to save batch attendance.', 'danger');
      }
    });
  }

  getInitials(name: string): string {
    if (!name) return 'S';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  getAvatarColor(name: string): string {
    if (!name) return this.avatarColors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % this.avatarColors.length;
    return this.avatarColors[index];
  }

  cleanPhone(phone: string): string {
    if (!phone) return '';
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 10) cleaned = '91' + cleaned;
    return cleaned;
  }

  // ================= SINGLE STUDENT ATTENDANCE METHODS =================

  loadAttendanceSettings(): void {
    this.http.get<AttendanceSettingsDto>(`${this.api}/attendance/settings`).subscribe({
      next: settings => { this.attendanceSettings = settings; this.attendanceMode = settings.studentMode; },
      error: () => { this.attendanceMode = 'Both'; }
    });
  }

  saveAttendanceMode(): void {
    this.attendanceSettings.studentMode = this.attendanceMode;
    this.http.put<AttendanceSettingsDto>(`${this.api}/attendance/settings`, this.attendanceSettings).subscribe({
      next: settings => this.attendanceSettings = settings,
      error: err => { this.attendanceMode = this.attendanceSettings.studentMode; this.confirmDialog.alert('Error', err?.error?.message || 'Failed to update attendance mode.', 'danger'); }
    });
  }

  onStudentChanged(): void {
    this.selectedStudent = this.students.find(student => student.id === this.selectedStudentId);
    if (this.selectedStudent) {
      this.loadPublicHolidaySundayPermission();
      this.loadAttendance();
    }
  }

  loadPublicHolidaySundayPermission(): void {
    this.http.get<{ canEdit: boolean }>(`${this.api}/students/attendance/ph-sun-edit-permission`).subscribe({
      next: result => this.canEditPublicHolidayOrSunday = result.canEdit,
      error: () => this.canEditPublicHolidayOrSunday = false
    });
  }

  loadAttendance(): void {
    if (!this.selectedStudentId) return;
    this.loading = true;
    const params = { month: this.attMonth, year: this.attYear };
    this.http.get<StudentAttendance[]>(`${this.api}/students/${this.selectedStudentId}/attendance`, { params }).subscribe({
      next: records => { this.records = records || []; this.loading = false; this.loadHolidaysAndCalendar(); },
      error: () => { this.records = []; this.loading = false; this.loadHolidaysAndCalendar(); }
    });
    this.http.get<AttendanceSummary>(`${this.api}/students/${this.selectedStudentId}/attendance/summary`, { params }).subscribe({
      next: summary => this.summary = summary,
      error: () => this.summary = null
    });
  }

  loadHolidaysAndCalendar(): void {
    this.http.get<HolidayDto[]>(`${this.api}/holidays`, { params: { month: this.attMonth, year: this.attYear, activeOnly: true } }).subscribe({
      next: holidays => { this.holidays = holidays || []; this.buildCalendar(); },
      error: () => { this.holidays = []; this.buildCalendar(); }
    });
  }

  buildCalendar(): void {
    const daysInMonth = new Date(this.attYear, this.attMonth, 0).getDate();
    const today = new Date().toISOString().split('T')[0];
    const week = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    this.calendarDays = Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(this.attYear, this.attMonth - 1, index + 1);
      const dateStr = `${this.attYear}-${String(this.attMonth).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
      const record = this.records.find(item => item.attendanceDate.split('T')[0] === dateStr);
      const holiday = this.holidays.find(item => dateStr >= item.startDate.split('T')[0] && dateStr <= item.endDate.split('T')[0]);
      return { dayNumber: index + 1, dateStr, dayOfWeek: week[date.getDay()], isToday: dateStr === today, isSunday: date.getDay() === 0, isSaturday: date.getDay() === 6, holiday, record, status: record?.status || (holiday || date.getDay() === 0 ? 'Holiday' : 'Unmarked') };
    });
  }

  getShortTag(day: CalendarDay): string {
    if (day.record) return day.status === 'HalfDay' ? 'HD' : day.status.substring(0, 1);
    if (day.holiday) return 'PH';
    if (day.isSunday) return 'SUN';
    if (day.isSaturday) return 'SAT';
    return '—';
  }

  getDayTooltip(day: CalendarDay): string {
    const details: string[] = [];
    if (day.holiday) details.push(`${day.holiday.title} (${day.holiday.holidayType})${day.holiday.description ? ` - ${day.holiday.description}` : ''}`);
    if (day.isSunday) details.push('Sunday Weekly Off');
    if (day.isSaturday) details.push('Saturday');
    if (day.record) details.push(`Status: ${day.status}${day.record.remarks ? ` | ${day.record.remarks}` : ''}`);
    return details.join(' | ') || `${day.dateStr} - Unmarked`;
  }

  openDay(day: CalendarDay): void {
    if (this.isPublicHolidayOrSunday(day.dateStr) && !this.canEditPublicHolidayOrSunday) {
      this.confirmDialog.alert('Editing Disabled', 'Sunday/Public Holiday attendance editing is disabled for this role.', 'warning');
      return;
    }
    this.formData = { attendanceDate: day.dateStr, status: day.record?.status || (day.holiday || day.isSunday ? 'Holiday' : 'Present'), remarks: day.record?.remarks || (day.holiday?.title || (day.isSunday ? 'Sunday Weekly Off' : '')) };
    this.editingRecordId = day.record?.id || null;
    this.showForm = true;
  }

  openNewRecord(): void {
    this.formData = { attendanceDate: new Date().toISOString().split('T')[0], status: 'Present', remarks: '' };
    this.editingRecordId = null;
    this.showForm = true;
  }

  editRecord(record: StudentAttendance): void {
    const date = record.attendanceDate.split('T')[0];
    if (this.isPublicHolidayOrSunday(date) && !this.canEditPublicHolidayOrSunday) {
      this.confirmDialog.alert('Editing Disabled', 'Sunday/Public Holiday attendance editing is disabled for this role.', 'warning');
      return;
    }
    this.formData = { attendanceDate: date, status: record.status, remarks: record.remarks || '' };
    this.editingRecordId = record.id;
    this.showForm = true;
  }

  saveAttendance(): void {
    if (!this.selectedStudentId || !this.formData.attendanceDate) return;
    if (!this.attendancePermissions.canManualMark) {
      this.confirmDialog.alert('Permission Denied', 'You do not have permission to mark manual attendance.', 'warning');
      return;
    }
    if (this.attendanceMode === 'Biometric') {
      this.confirmDialog.alert('Biometric Mode', 'Manual student attendance is disabled in Biometric Only mode.', 'warning');
      return;
    }
    if (this.isPublicHolidayOrSunday(this.formData.attendanceDate) && !this.canEditPublicHolidayOrSunday) {
      this.confirmDialog.alert('Editing Disabled', 'Sunday/Public Holiday attendance editing is disabled for this role.', 'warning');
      return;
    }
    this.saving = true;
    this.http.post(`${this.api}/students/${this.selectedStudentId}/attendance`, this.formData).subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.loadAttendance();
        this.confirmDialog.alert('Attendance Saved', 'Student attendance saved successfully.', 'success');
      },
      error: err => {
        this.saving = false;
        this.confirmDialog.alert('Error', err?.error?.message || 'Failed to save attendance.', 'danger');
      }
    });
  }

  deleteRecord(id: string): void {
    const record = this.records.find(item => item.id === id);
    if (record && this.isPublicHolidayOrSunday(record.attendanceDate) && !this.canEditPublicHolidayOrSunday) {
      this.confirmDialog.alert('Editing Disabled', 'Sunday/Public Holiday attendance editing is disabled for this role.', 'warning');
      return;
    }
    this.confirmDialog.danger('Delete Attendance Record', 'Are you sure you want to delete this student attendance record?', 'Delete Record').subscribe(confirmed => {
      if (!confirmed) return;
      this.http.delete(`${this.api}/students/attendance/${id}`).subscribe({
        next: () => {
          this.loadAttendance();
          this.confirmDialog.alert('Deleted', 'Attendance record deleted.', 'success');
        },
        error: err => this.confirmDialog.alert('Error', err?.error?.message || 'Failed to delete attendance.', 'danger')
      });
    });
  }

  isPublicHolidayOrSunday(dateValue: string): boolean {
    const dateOnly = dateValue.split('T')[0];
    if (new Date(`${dateOnly}T00:00:00`).getDay() === 0) return true;
    return this.holidays.some(holiday => dateOnly >= holiday.startDate.split('T')[0] && dateOnly <= holiday.endDate.split('T')[0]);
  }
}
