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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { API_BASE, AttendancePermissionsDto, AttendanceSettingsDto, HolidayDto } from '../teachers/teacher.models';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { CoachingService } from '../../core/services/coaching.service';
import { SchoolService, SchoolClassDto, SchoolSectionDto } from '../../core/services/school.service';
import { AuthService } from '../../core/services/auth.service';
import { ApplyStudentRegularizationDialogComponent, ReviewStudentRegularizationDialogComponent, StudentAttendanceRegularizationDto } from './student-regularization-dialog.component';
import { AttendanceShiftSettingsDialogComponent } from '../../shared/components/attendance-shift-settings-dialog.component';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';

interface StudentItem {
  id: string;
  rollNumber: string;
  studentName: string;
  batchId?: string;
  batchName: string;
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  schoolRollNumber?: string;
  admissionNumber?: string;
  isSchoolStudent?: boolean;
  isCoachingStudent?: boolean;
  joiningDate?: string;
}

interface BatchStudentRow {
  studentId: string;
  studentName: string;
  rollNumber: string;
  schoolRollNumber?: string | null;
  admissionNumber?: string | null;
  className?: string | null;
  sectionName?: string | null;
  profilePhoto?: string | null;
  parentWhatsAppPhone?: string | null;
  status: string;
  remarks?: string | null;
  attendanceId?: string | null;
  capturedAt?: string | null;
  captureSource?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
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
  capturedAt?: string | null;
  CapturedAt?: string | null;
  createdAt?: string | null;
  CreatedAt?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  CheckInTime?: string | null;
  CheckOutTime?: string | null;
}

interface AttendanceSummary {
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  holidayDays: number;
  totalWorkingDays: number;
  attendancePercentage: number;
  elapsedWorkingDays?: number;
}

interface CalendarDay {
  dayNumber: number;
  dateStr: string;
  dayOfWeek: string;
  isToday: boolean;
  isSunday: boolean;
  isSaturday: boolean;
  isWeeklyOffDay?: boolean;
  isFuture: boolean;
  isPriorToAdmission?: boolean;
  holiday?: HolidayDto;
  record?: StudentAttendance;
  status: string;
  capturedTime?: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  workDuration?: string | null;
}

@Component({
  selector: 'app-student-attendance',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, MatCardModule, MatButtonModule,
    MatIconModule, MatInputModule, MatFormFieldModule, MatSelectModule,
    MatProgressBarModule, MatProgressSpinnerModule, MatTooltipModule, MatCheckboxModule,
    MatDialogModule,
    IstDatetimeDirective
  ],
  template: `
<div class="page-container">
  <!-- Top Global Page Loading Indicator -->
  <mat-progress-bar mode="indeterminate" class="global-page-loader" *ngIf="isAnyLoading"></mat-progress-bar>
  <div class="page-header">
    <div class="header-top-row">
      <h1 class="page-title"><mat-icon>event_available</mat-icon> Student Attendance Management</h1>
      <div class="header-actions">
        <button mat-stroked-button class="header-action-btn settings-btn" *ngIf="attendancePermissions.canChangeMode" (click)="openShiftSettingsDialog()" matTooltip="Configure Shift Timings & Attendance Policies for Students and Faculty">
          <mat-icon>settings</mat-icon> <span>Shift &amp; Policy Settings</span>
        </button>
        <a mat-stroked-button class="header-action-btn report-btn" routerLink="/attendance/reports">
          <mat-icon>summarize</mat-icon> <span>Attendance Reports</span>
        </a>
        <a *ngIf="!isTeacher" mat-stroked-button class="header-action-btn directory-btn" routerLink="/students">
          <mat-icon>people</mat-icon> <span>Student Directory</span>
        </a>
      </div>
    </div>
    <p class="page-subtitle">{{ hasSchool && hasCoaching ? 'Mark daily roll call for School Classes or Coaching Batches, or view individual student monthly registers.' : (hasSchool ? 'Mark daily roll call for School Classes and Sections, or view individual student monthly registers.' : 'Mark daily roll call for Coaching Batches, or view individual student monthly registers.') }}</p>
  </div>

  <!-- Mode Tab Switcher -->
  <div class="view-mode-tabs">
    <button type="button" class="tab-btn" [class.active]="activeTab === 'batch'" (click)="setTab('batch')">
      <mat-icon>groups</mat-icon>
      <div class="tab-text">
        <strong>Roll Call (Bulk)</strong>
        <small>{{ hasSchool && hasCoaching ? 'School Classes & Coaching Batches attendance in 1 click' : (hasSchool ? 'School Classes daily roll call in 1 click' : 'Coaching Batches attendance in 1 click') }}</small>
      </div>
    </button>
    <button type="button" class="tab-btn" [class.active]="activeTab === 'single'" (click)="setTab('single')">
      <mat-icon>person_search</mat-icon>
      <div class="tab-text">
        <strong>Individual Student Register</strong>
        <small>Monthly calendar, leave logs & compliance</small>
      </div>
    </button>
    <button type="button" class="tab-btn" [class.active]="activeTab === 'regularization'" (click)="setTab('regularization')">
      <mat-icon>rule_folder</mat-icon>
      <div class="tab-text">
        <strong>{{ isTeacher ? 'Regularization Approvals' : 'Attendance Regularization' }}</strong>
        <small>{{ isTeacher ? 'Review & approve student OD / leave requests' : 'Student corrections &amp; OD requests' }}</small>
      </div>
      <span class="tab-pending-badge" *ngIf="regularizationStats.pendingRequests > 0">
        {{ regularizationStats.pendingRequests }} Pending
      </span>
    </button>
  </div>

  <!-- ================= TAB 1: ROLL CALL (BULK) ================= -->
  <div *ngIf="activeTab === 'batch'" class="batch-view">

    <!-- Scope Selector: School Class vs Coaching Batch (Only shown if both modules are active) -->
    <div class="roll-call-scope-bar" *ngIf="hasSchool && hasCoaching">
      <button type="button" class="scope-pill-btn" [class.active]="rollCallScope === 'school'" (click)="setRollCallScope('school')">
        <mat-icon>school</mat-icon>
        <div class="scope-btn-text">
          <strong>School Class Roll Call</strong>
          <small>Class & Section daily attendance</small>
        </div>
      </button>
      <button type="button" class="scope-pill-btn" [class.active]="rollCallScope === 'coaching'" (click)="setRollCallScope('coaching')">
        <mat-icon>menu_book</mat-icon>
        <div class="scope-btn-text">
          <strong>Coaching Batch Roll Call</strong>
          <small>Batch & Subject attendance</small>
        </div>
      </button>
    </div>

    <!-- Controls Card -->
    <mat-card class="batch-controls-card mat-elevation-z1">
      <div class="controls-row">
        
        <!-- School Class & Section Selectors -->
        <ng-container *ngIf="rollCallScope === 'school'">
          <!-- Locked view for class teachers -->
          <ng-container *ngIf="isTeacher && teacherClassSection?.isClassTeacher; else classDropdowns">
            <div class="teacher-class-locked-badge">
              <mat-icon>lock</mat-icon>
              <div>
                <strong>{{ teacherClassSection?.className }}</strong>
                <small *ngIf="teacherClassSection?.sectionName">
                  {{ (teacherClassSection?.sectionName || '').startsWith('Section') ? teacherClassSection?.sectionName : 'Section ' + teacherClassSection?.sectionName }}
                </small>
              </div>
            </div>
          </ng-container>
          <ng-template #classDropdowns>
            <mat-form-field appearance="outline" class="class-select" subscriptSizing="dynamic">
              <mat-label>Select School Class</mat-label>
              <mat-select [(ngModel)]="selectedClassId" (selectionChange)="onClassChanged()" [disabled]="isTeacher">
                <mat-option *ngFor="let c of schoolClasses" [value]="c.id">
                  {{ c.name }} <span *ngIf="c.code">({{ c.code }})</span>
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="section-select" subscriptSizing="dynamic">
              <mat-label>Select Section</mat-label>
              <mat-select [(ngModel)]="selectedSectionId" (selectionChange)="onSectionChanged()">
                <mat-option value="">All Sections</mat-option>
                <mat-option *ngFor="let sec of classSections" [value]="sec.id">
                  Section {{ sec.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </ng-template>
        </ng-container>

        <!-- Coaching Batch Selector with Class Filter -->
        <ng-container *ngIf="rollCallScope === 'coaching'">
          <mat-form-field appearance="outline" class="class-select" subscriptSizing="dynamic" *ngIf="hasSchool">
            <mat-label>Filter Academic Class</mat-label>
            <mat-select [(ngModel)]="selectedCoachingClassId" (selectionChange)="onCoachingClassFilterChanged()">
              <mat-option value="">✨ All Academic Classes</mat-option>
              <mat-option *ngFor="let c of schoolClasses" [value]="c.id">
                🏫 {{ c.name }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="batch-select" subscriptSizing="dynamic">
            <mat-label>Select Coaching Batch</mat-label>
            <mat-select [(ngModel)]="selectedBatchId" (selectionChange)="onBatchChanged()">
              <mat-option *ngFor="let b of filteredCoachingBatches" [value]="b.id">
                🎯 {{ b.name }} ({{ b.subject || b.academicYear || 'General' }}) <span *ngIf="b.className">• {{ b.className }}</span>
              </mat-option>
            </mat-select>
          </mat-form-field>
        </ng-container>

        <!-- Date Controls (Shared) -->
        <div class="date-controls">
          <button mat-icon-button (click)="prevDay()" [disabled]="isBatchPastLocked" [matTooltip]="isBatchPastLocked ? 'Past attendance locked (Admin permission required)' : 'Previous Day'">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <mat-form-field appearance="outline" class="date-input" subscriptSizing="dynamic">
            <mat-label>Attendance Date</mat-label>
            <input matInput type="date" [(ngModel)]="selectedBatchDate" [max]="todayStr" [min]="minAttendanceDate" (change)="onBatchDateChanged()">
          </mat-form-field>
          <button mat-icon-button (click)="nextDay()" [disabled]="selectedBatchDate >= todayStr" matTooltip="Next Day">
            <mat-icon>chevron_right</mat-icon>
          </button>
          <button mat-stroked-button class="today-btn" (click)="setToday()">Today</button>
        </div>

        <!-- Search in roll call -->
        <mat-form-field appearance="outline" class="search-input" subscriptSizing="dynamic">
          <mat-label>{{ rollCallScope === 'school' ? 'Search student, roll, adm' : 'Search student, roll' }}</mat-label>
          <input matInput [(ngModel)]="batchSearchQuery" placeholder="Filter by name / roll...">
          <mat-icon matPrefix>search</mat-icon>
        </mat-form-field>
      </div>

      <!-- Live Counters & Bulk Actions -->
      <div class="stats-and-actions">
        <div class="stats-counters">
          <span class="stat-pill total">Total: <strong>{{ totalActiveStudents }}</strong></span>
          <span class="stat-pill present">Present: <strong>{{ presentActiveCount }}</strong></span>
          <span class="stat-pill absent">Absent: <strong>{{ absentActiveCount }}</strong></span>
          <span class="stat-pill late">Late: <strong>{{ lateActiveCount }}</strong></span>
          <span class="stat-pill halfday">Half-Day: <strong>{{ halfDayActiveCount }}</strong></span>
        </div>

        <div class="fast-actions">
          <button mat-stroked-button class="btn-bulk-present" (click)="markAllActiveStatus('Present')" [disabled]="isBatchPastLocked" matTooltip="Set all students to Present">
            <mat-icon>done_all</mat-icon> Mark All Present
          </button>
          <button mat-stroked-button class="btn-bulk-absent" (click)="markAllActiveStatus('Absent')" [disabled]="isBatchPastLocked" matTooltip="Set all students to Absent">
            <mat-icon>highlight_off</mat-icon> Mark All Absent
          </button>
        </div>
      </div>

      <!-- Quick Default Timings Strip -->
      <div class="roll-call-timings-bar" *ngIf="isScopeSelected">
        <div class="rct-left-group">
          <div class="rct-label">
            <mat-icon>schedule</mat-icon>
            <span>Default {{ rollCallScope === 'school' ? 'Class' : 'Batch' }} Timings:</span>
          </div>

          <!-- Coaching Shift Switcher Pills (Morning vs Evening) -->
          <div class="rct-shift-switcher" *ngIf="rollCallScope === 'coaching'">
            <button type="button" class="shift-pill morning" [class.active]="coachingActiveShift === 'morning'" (click)="setCoachingShift('morning')" matTooltip="Select Morning Coaching Shift">
              <mat-icon>wb_sunny</mat-icon> <span>🌅 Morning Shift</span>
            </button>
            <button type="button" class="shift-pill evening" [class.active]="coachingActiveShift === 'evening'" (click)="setCoachingShift('evening')" matTooltip="Select Evening Coaching Shift">
              <mat-icon>nights_stay</mat-icon> <span>🌆 Evening Shift</span>
            </button>
          </div>
        </div>

        <div class="rct-fields">
          <div class="rct-input-wrap">
            <label>In</label>
            <input type="time" [(ngModel)]="bulkCheckInTime" (ngModelChange)="onBulkTimingsChanged()" [disabled]="isBatchPastLocked" title="Default Check-In Time">
          </div>
          <div class="rct-input-wrap">
            <label>Out</label>
            <input type="time" [(ngModel)]="bulkCheckOutTime" (ngModelChange)="onBulkTimingsChanged()" [disabled]="isBatchPastLocked" title="Default Check-Out Time">
          </div>
          <button type="button" class="rct-apply-btn" (click)="applyBulkTimingsToPresent()" [disabled]="isBatchPastLocked" matTooltip="Apply these timings to all Present students">
            <mat-icon>sync</mat-icon> Apply to Present
          </button>
          <span class="rct-dur-badge" *ngIf="calculateDuration(bulkCheckInTime, bulkCheckOutTime)">
            {{ calculateDuration(bulkCheckInTime, bulkCheckOutTime) }}
          </span>
        </div>
      </div>
    </mat-card>

    <!-- Success Message Banner -->
    <div *ngIf="activeSuccessMsg" class="success-banner">
      <mat-icon>check_circle</mat-icon>
      <span>{{ activeSuccessMsg }}</span>
      <button mat-icon-button (click)="activeSuccessMsg = ''"><mat-icon>close</mat-icon></button>
    </div>

    <!-- Empty State: Not Selected -->
    <mat-card class="mat-elevation-z1 empty-card" *ngIf="rollCallScope === 'school' && !selectedClassId">
      <mat-icon class="empty-icon">school</mat-icon>
      <h3>No School Class Selected</h3>
      <p>Please select a school class from the dropdown above to mark attendance.</p>
    </mat-card>

    <mat-card class="mat-elevation-z1 empty-card" *ngIf="rollCallScope === 'coaching' && !selectedBatchId">
      <mat-icon class="empty-icon">groups</mat-icon>
      <h3>No Batch Selected</h3>
      <p>Please select a batch from the dropdown above to mark attendance.</p>
    </mat-card>


    <!-- Empty State: Zero Students -->
    <mat-card class="mat-elevation-z1 empty-card" *ngIf="isScopeSelected && !isScopeLoading && filteredActiveStudents.length === 0">
      <mat-icon class="empty-icon">person_off</mat-icon>
      <h3>No Students Found</h3>
      <p *ngIf="totalActiveStudents === 0">
        {{ rollCallScope === 'school' ? 'No active students enrolled in this class/section.' : 'No active students are enrolled in this batch.' }}
      </p>
      <p *ngIf="totalActiveStudents > 0">No students match your search filter "{{ batchSearchQuery }}".</p>
    </mat-card>

    <!-- Students Roll Call Table Card -->
    <mat-card class="roll-call-card mat-elevation-z1" *ngIf="filteredActiveStudents.length > 0">
      <div class="table-responsive">
        <table class="roll-call-table">
          <thead>
            <tr>
              <th style="width: 44px; text-align: center;">#</th>
              <th style="min-width: 185px;">Student Details</th>
              <th *ngIf="rollCallScope === 'school'" style="width: 130px;">Class & Section</th>
              <th style="width: 140px;">{{ rollCallScope === 'school' ? 'School Roll / Adm' : 'Roll Number' }}</th>
              <th style="width: 135px;">Parent WhatsApp</th>
              <th style="width: 250px; text-align: center;">Attendance Status</th>
              <th style="width: 210px; text-align: center;">Timings (In / Out)</th>
              <th class="remarks-col" style="width: 160px; text-align: left;">Remarks / Note</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of filteredActiveStudents; let i = index" [class.row-absent]="s.status === 'Absent'" [class.row-present]="s.status === 'Present'">
              <td class="index-cell">{{ i + 1 }}</td>
              <td class="student-cell">
                <div class="avatar-box" [style.background]="!s.profilePhoto ? getAvatarColor(s.studentName) : 'transparent'">
                  <img *ngIf="s.profilePhoto" [src]="getPhotoUrl(s.profilePhoto)" [alt]="s.studentName" class="avatar-photo" (error)="s.profilePhoto = null" />
                  <span *ngIf="!s.profilePhoto">{{ getInitials(s.studentName) }}</span>
                </div>
                <div class="student-meta">
                  <span class="name">{{ s.studentName }}</span>
                  <span class="adm-pill" *ngIf="s.admissionNumber && rollCallScope === 'coaching'">ADM: {{ s.admissionNumber }}</span>
                  
                  <ng-container *ngIf="s.attendanceId">
                    <!-- Biometric Machine Punch Source -->
                    <span class="sub bio-sub" *ngIf="isBiometricAttendance(s)" [matTooltip]="'Biometric machine punch captured at ' + formatCapturedTime(s.capturedAt) + ' IST'">
                      <mat-icon class="bio-dot">fingerprint</mat-icon>
                      <span class="sub-text">Punch {{ s.checkInTime ? formatTimeAmPm(s.checkInTime) : formatCapturedTime(s.capturedAt) }}</span>
                    </span>

                    <!-- Manual Roll Call Source (Single clean tooltip, no double tooltip) -->
                    <span class="sub manual-sub" *ngIf="!isBiometricAttendance(s)" [matTooltip]="'Manual roll-call entry (Saved in database at ' + formatCapturedTime(s.capturedAt) + ' IST)'">
                      <mat-icon class="saved-dot">check_circle</mat-icon>
                      <span class="sub-text">In: {{ s.checkInTime ? formatTimeAmPm(s.checkInTime) : 'Shift Time' }}</span>
                      <span class="log-pill" *ngIf="s.capturedAt">Logged</span>
                    </span>
                  </ng-container>
                </div>
              </td>
              <td *ngIf="rollCallScope === 'school'">
                <span class="class-pill">
                  {{ s.className || 'Class' }} <strong *ngIf="s.sectionName">({{ s.sectionName }})</strong>
                </span>
              </td>
              <td class="roll-adm-col">
                <div class="roll-adm-stack">
                  <span class="roll-pill" *ngIf="rollCallScope === 'school'" [matTooltip]="'School Roll No: ' + (s.schoolRollNumber || s.rollNumber || '—')">{{ s.schoolRollNumber || s.rollNumber || '—' }}</span>
                  <span class="roll-pill" *ngIf="rollCallScope === 'coaching'" [matTooltip]="'Coaching Roll No: ' + (s.rollNumber || '—')">{{ s.rollNumber || '—' }}</span>
                  <span class="adm-pill" *ngIf="s.admissionNumber" matTooltip="Admission Number">{{ s.admissionNumber }}</span>
                </div>
              </td>
              <td class="whatsapp-cell">
                <a *ngIf="s.parentWhatsAppPhone" [href]="'https://wa.me/' + cleanPhone(s.parentWhatsAppPhone)" target="_blank" class="wa-link" matTooltip="Chat on WhatsApp">
                  <mat-icon>chat</mat-icon>
                  <span>{{ s.parentWhatsAppPhone }}</span>
                </a>
                <span *ngIf="!s.parentWhatsAppPhone" class="text-muted">—</span>
              </td>
              <td class="status-cell">
                <div class="status-btn-group">
                  <button type="button" class="status-pill p-btn" [class.selected]="s.status === 'Present'" (click)="setStudentActiveStatus(s, 'Present')" [disabled]="isBatchPastLocked" matTooltip="Mark Present">
                    <span class="badge">P</span>
                    <span class="label">Present</span>
                  </button>
                  <button type="button" class="status-pill a-btn" [class.selected]="s.status === 'Absent'" (click)="setStudentActiveStatus(s, 'Absent')" [disabled]="isBatchPastLocked" matTooltip="Mark Absent">
                    <span class="badge">A</span>
                    <span class="label">Absent</span>
                  </button>
                  <button type="button" class="status-pill l-btn" [class.selected]="s.status === 'Late'" (click)="setStudentActiveStatus(s, 'Late')" [disabled]="isBatchPastLocked" matTooltip="Mark Late">
                    <span class="badge">L</span>
                    <span class="label">Late</span>
                  </button>
                  <button type="button" class="status-pill h-btn" [class.selected]="s.status === 'HalfDay'" (click)="setStudentActiveStatus(s, 'HalfDay')" [disabled]="isBatchPastLocked" matTooltip="Mark Half Day">
                    <span class="badge">H</span>
                    <span class="label">Half</span>
                  </button>
                </div>
              </td>
              <td class="timings-cell">
                <div class="row-timings" *ngIf="s.status !== 'Absent'">
                  <div class="time-field" [matTooltip]="isBiometricAttendance(s) ? 'Biometric Check-In Punch' : 'Session In Time (Policy Shift Default - Editable)'">
                    <span class="t-badge" [class.bio-badge]="isBiometricAttendance(s)">In</span>
                    <input type="time" [(ngModel)]="s.checkInTime" (ngModelChange)="onStudentRowTimeChanged(s)" [disabled]="isBatchPastLocked" class="table-time-input">
                  </div>
                  <div class="time-field" [matTooltip]="isBiometricAttendance(s) ? 'Biometric Check-Out Punch' : 'Session Out Time (Policy Shift Default - Editable)'">
                    <span class="t-badge" [class.bio-badge]="isBiometricAttendance(s)">Out</span>
                    <input type="time" [(ngModel)]="s.checkOutTime" (ngModelChange)="onStudentRowTimeChanged(s)" [disabled]="isBatchPastLocked" class="table-time-input">
                  </div>
                </div>
                <span *ngIf="s.status === 'Absent'" class="absent-timings-dash">—</span>
              </td>
              <td class="remarks-cell">
                <input type="text" [(ngModel)]="s.remarks" [disabled]="isBatchPastLocked" placeholder="Add note..." class="remarks-input" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Bottom Save Action Bar -->
      <div class="save-bar">
        <div class="whatsapp-alert-toggle">
          <mat-checkbox [(ngModel)]="sendWhatsAppAlerts" color="primary" [disabled]="isBatchPastLocked">
            <span class="wa-checkbox-label">
              Send WhatsApp attendance SMS / alert to absent students' parents
              <strong *ngIf="absentActiveCount > 0" class="wa-badge">({{ absentActiveCount }} Absent)</strong>
            </span>
          </mat-checkbox>
        </div>

        <div class="save-actions">
          <div *ngIf="isBatchPastLocked" class="batch-locked-badge">
            <mat-icon>lock</mat-icon>
            <span>Past Attendance Locked (Admin Permission Required)</span>
          </div>
          <button mat-raised-button color="primary" class="btn-save-batch" (click)="saveActiveAttendance()" [disabled]="isScopeSaving || isScopeLoading || isBatchPastLocked">
            <mat-icon>{{ isBatchPastLocked ? 'lock' : 'save' }}</mat-icon>
            <span>{{ isBatchPastLocked ? 'Locked (Past Date)' : (isScopeSaving ? 'Saving Attendance...' : 'Save ' + (rollCallScope === 'school' ? 'Class' : 'Batch') + ' Attendance (' + totalActiveStudents + ' Students)') }}</span>
          </button>
        </div>
      </div>
    </mat-card>
  </div>

  <!-- ================= TAB 2: INDIVIDUAL STUDENT REGISTER ================= -->
  <div *ngIf="activeTab === 'single'" class="single-view">
    <mat-card class="selector-card mat-elevation-z1">
      <mat-icon color="primary" class="selector-icon">person_search</mat-icon>

      <!-- Stream Filter Toggle (Only shown when both School & Coaching modules are active) -->
      <div class="stream-pill-toggle" *ngIf="hasSchool && hasCoaching">
        <button type="button" class="stream-pill" [class.active]="singleStreamFilter === 'all'" (click)="setSingleStreamFilter('all')">All</button>
        <button type="button" class="stream-pill" [class.active]="singleStreamFilter === 'school'" (click)="setSingleStreamFilter('school')">🏫 School</button>
        <button type="button" class="stream-pill" [class.active]="singleStreamFilter === 'coaching'" (click)="setSingleStreamFilter('coaching')">📚 Coaching</button>
      </div>

      <!-- School Class & Section Filter -->
      <ng-container *ngIf="singleStreamFilter === 'school'">
        <mat-form-field appearance="outline" class="single-class-select" [matTooltip]="isTeacherClassLocked ? '🔒 Assigned class for your teaching profile (Locked)' : ''">
          <mat-label>Select Class <span *ngIf="isTeacherClassLocked">🔒</span></mat-label>
          <mat-select [(ngModel)]="singleSelectedClassId" (selectionChange)="onSingleClassChanged()" [disabled]="isTeacherClassLocked">
            <mat-option value="" *ngIf="!isTeacherClassLocked">All Classes</mat-option>
            <mat-option *ngFor="let c of schoolClasses" [value]="c.id">{{ c.name }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="single-section-select" *ngIf="singleSelectedClassId && singleClassSections.length > 0" [matTooltip]="isTeacherSectionLocked ? '🔒 Assigned section locked' : ''">
          <mat-label>Section <span *ngIf="isTeacherSectionLocked">🔒</span></mat-label>
          <mat-select [(ngModel)]="singleSelectedSectionId" (selectionChange)="onSingleSectionChanged()" [disabled]="isTeacherSectionLocked">
            <mat-option value="" *ngIf="!isTeacherSectionLocked">All Sections</mat-option>
            <mat-option *ngFor="let sec of singleClassSections" [value]="sec.id">Section {{ sec.name }}</mat-option>
          </mat-select>
        </mat-form-field>
      </ng-container>

      <!-- Coaching Batch Filter with Academic Class Cascade -->
      <ng-container *ngIf="singleStreamFilter === 'coaching'">
        <mat-form-field appearance="outline" class="single-class-select" *ngIf="hasSchool">
          <mat-label>Academic Class</mat-label>
          <mat-select [(ngModel)]="singleSelectedCoachingClassId" (selectionChange)="onSingleCoachingClassChanged()">
            <mat-option value="">All Academic Classes</mat-option>
            <mat-option *ngFor="let c of schoolClasses" [value]="c.id">{{ c.name }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="single-batch-select">
          <mat-label>Select Batch</mat-label>
          <mat-select [(ngModel)]="singleSelectedBatchId" (selectionChange)="onSingleBatchChanged()">
            <mat-option value="">All Batches</mat-option>
            <mat-option *ngFor="let b of filteredSingleCoachingBatches" [value]="b.id">{{ b.name }}</mat-option>
          </mat-select>
        </mat-form-field>
      </ng-container>

      <!-- Student Selector Dropdown -->
      <mat-form-field appearance="outline" class="student-select">
        <mat-label>Select Student ({{ filteredSingleStudents.length }})</mat-label>
        <mat-select [(ngModel)]="selectedStudentId" (selectionChange)="onStudentChanged()">
          <mat-option *ngFor="let student of filteredSingleStudents" [value]="student.id">
            {{ getStudentDisplayRoll(student) }} - {{ student.studentName }} {{ getStudentDisplayGroup(student) }}
          </mat-option>
        </mat-select>
      </mat-form-field>
    </mat-card>


    <div *ngIf="selectedStudent" class="attendance-wrapper">
      <mat-card class="period-card mat-elevation-z1">
        <div class="period-student">
          <mat-icon>account_circle</mat-icon>
          <div>
            <strong>{{ selectedStudent.studentName }}</strong>
            <small>{{ getStudentDisplayRoll(selectedStudent) }} {{ getStudentDisplayGroup(selectedStudent) }}</small>
          </div>
        </div>
        <div class="period-selectors">
          <mat-form-field appearance="outline"><mat-label>Month</mat-label><mat-select [(ngModel)]="attMonth" (selectionChange)="loadAttendance()"><mat-option *ngFor="let month of months; let i = index" [value]="i + 1">{{ month }}</mat-option></mat-select></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Year</mat-label><mat-select [(ngModel)]="attYear" (selectionChange)="loadAttendance()"><mat-option *ngFor="let year of years" [value]="year">{{ year }}</mat-option></mat-select></mat-form-field>
        </div>
      </mat-card>

      <div class="summary-grid" *ngIf="effectiveSummary as sum">
        <div class="summary-card present"><mat-icon>check_circle</mat-icon><strong>{{ sum.presentDays }}</strong><small>Present Days</small></div>
        <div class="summary-card absent"><mat-icon>cancel</mat-icon><strong>{{ sum.absentDays }}</strong><small>Absent Days</small></div>
        <div class="summary-card late"><mat-icon>schedule</mat-icon><strong>{{ sum.lateDays }}</strong><small>Late Marks</small></div>
        <div class="summary-card half"><mat-icon>hourglass_bottom</mat-icon><strong>{{ sum.halfDays }}</strong><small>Half Days</small></div>
        <div class="summary-card holiday"><mat-icon>beach_access</mat-icon><strong>{{ sum.holidayDays }}</strong><small>Holidays / Off</small></div>
        <div class="summary-card compliance" [matTooltip]="(sum.elapsedWorkingDays && sum.elapsedWorkingDays < sum.totalWorkingDays) ? (sum.presentDays + sum.lateDays + (sum.halfDays * 0.5)) + ' days attended out of ' + sum.elapsedWorkingDays + ' elapsed working days held so far (' + sum.totalWorkingDays + ' total working days in month)' : ''">
          <mat-icon>analytics</mat-icon>
          <strong>{{ sum.attendancePercentage }}%</strong>
          <small *ngIf="sum.elapsedWorkingDays && sum.elapsedWorkingDays < sum.totalWorkingDays">Compliance ({{ sum.elapsedWorkingDays }} Held)</small>
          <small *ngIf="!sum.elapsedWorkingDays || sum.elapsedWorkingDays >= sum.totalWorkingDays">Compliance</small>
        </div>
        <div class="summary-card working" [matTooltip]="(sum.elapsedWorkingDays && sum.elapsedWorkingDays < sum.totalWorkingDays) ? sum.elapsedWorkingDays + ' days held to date out of ' + sum.totalWorkingDays + ' total working days this month' : ''">
          <mat-icon>calendar_today</mat-icon>
          <strong>{{ (sum.elapsedWorkingDays && sum.elapsedWorkingDays < sum.totalWorkingDays) ? (sum.elapsedWorkingDays + ' / ' + sum.totalWorkingDays) : sum.totalWorkingDays }}</strong>
          <small *ngIf="sum.elapsedWorkingDays && sum.elapsedWorkingDays < sum.totalWorkingDays">Working Days (Held / Total)</small>
          <small *ngIf="!sum.elapsedWorkingDays || sum.elapsedWorkingDays >= sum.totalWorkingDays">Working Days</small>
        </div>
      </div>

      <mat-card class="calendar-card mat-elevation-z1">
        <div class="calendar-heading">
          <strong><mat-icon>calendar_month</mat-icon> {{ months[attMonth - 1] }} {{ attYear }} Attendance Matrix</strong>
          <div class="legend">
            <span class="present-dot">● Present</span>
            <span class="absent-dot">● Absent</span>
            <span class="holiday-dot">● Holiday</span>
            <span class="sunday-dot">● Sunday</span>
            <span class="saturday-dot">● Saturday</span>
          </div>
        </div>

        <!-- Quick Action Toolbar -->
        <div class="multi-select-toolbar" *ngIf="attendancePermissions.canManualMark && attendanceMode !== 'Biometric'">
          <div class="mst-left">
            <span class="mst-title"><mat-icon>checklist</mat-icon> Quick Selection:</span>
            <button type="button" class="mst-btn" (click)="selectAllWorkingDays()" matTooltip="Select all working days in this month">
              <mat-icon>fact_check</mat-icon> Select All Working Days
            </button>
            <button type="button" class="mst-btn" (click)="selectAllAbsentDays()" matTooltip="Select all unmarked / absent days">
              <mat-icon>rule</mat-icon> Select Unmarked / Absent
            </button>
            <button type="button" class="mst-btn save-month" (click)="saveStudentMonthlyRegister()" [disabled]="batchSavingDates" matTooltip="Auto-fill entire month: Checked dates as Present, Unchecked working dates as Absent">
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

        <div class="calendar-grid">
          <div *ngFor="let day of calendarDays"
            class="day-cell"
            [class.selected-for-batch]="selectedMatrixDates.has(day.dateStr)"
            [ngClass]="[day.status.toLowerCase(), (day.isSunday || day.isWeeklyOffDay) ? 'sunday' : '', day.isSaturday ? 'saturday' : '', day.isToday ? 'today' : '', day.isFuture ? 'future' : '', (!day.isToday && !day.isFuture && !attendancePermissions.canCorrectAttendance) ? 'locked-past' : '']"
            [matTooltip]="getDayTooltip(day)"
            (click)="onDayCellClick(day, $event)">

            <!-- Smart Checkbox on selectable days -->
            <div class="cell-check-wrap" *ngIf="isDateSelectable(day)" (click)="$event.stopPropagation()">
              <input type="checkbox"
                class="cell-check-input"
                [checked]="selectedMatrixDates.has(day.dateStr)"
                (change)="toggleDateSelect(day)">
            </div>

            <span class="day-num">{{ day.dayNumber }}</span>
            <span class="day-name">{{ day.dayOfWeek }}</span>
            <span class="day-tag" *ngIf="day.status">{{ day.status === 'PriorAdmission' ? 'Unenrolled' : (day.status === 'HalfDay' ? 'Half' : day.status) }}</span>

            <!-- Rich Punch Timings & Duration Display -->
            <div class="day-times-wrap" *ngIf="day.checkInTime || day.checkOutTime || day.capturedTime">
              <span class="day-punch punch-in" *ngIf="day.checkInTime">
                <mat-icon>login</mat-icon> In {{ formatDisplayTime(day.checkInTime) }}
              </span>
              <span class="day-punch punch-out" *ngIf="day.checkOutTime">
                <mat-icon>logout</mat-icon> Out {{ formatDisplayTime(day.checkOutTime) }}
              </span>
              <span class="day-punch punch-captured" *ngIf="!day.checkInTime && !day.checkOutTime && day.capturedTime">
                {{ day.capturedTime }}
              </span>
              <span class="day-punch-dur" *ngIf="day.workDuration">
                <mat-icon>timelapse</mat-icon> {{ day.workDuration }}
              </span>
            </div>
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
      </mat-card>

      <!-- Detailed Attendance Register Table -->
      <mat-card class="table-card mat-elevation-z1" *ngIf="records.length > 0">
        <div class="table-card-header">
          <div class="table-title-group">
            <strong><mat-icon style="vertical-align:middle;margin-right:6px;font-size:1.15rem;width:1.15rem;height:1.15rem;color:#2563eb;">event_note</mat-icon>Detailed Attendance Register ({{ records.length }} Records)</strong>
            <span class="table-scroll-hint"><mat-icon>swap_horiz</mat-icon> Swipe to view all columns &amp; actions</span>
          </div>
        </div>
        <div class="table-responsive">
          <table class="att-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Status</th>
                <th>Check-in (IST)</th>
                <th>Check-out (IST)</th>
                <th>Duration</th>
                <th>Source / Mode</th>
                <th>Remarks</th>
                <th class="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let record of records">
                <td><strong>{{ record.attendanceDate | date:'dd MMM yyyy' }}</strong></td>
                <td><span class="day-label">{{ record.attendanceDate | date:'EEEE' }}</span></td>
                <td>
                  <span class="status-badge" [ngClass]="record.status.toLowerCase()">
                    {{ record.status === 'HalfDay' ? 'Half Day' : record.status }}
                  </span>
                </td>
                <td>
                  <span class="time-main">{{ record.checkInTime || record.CheckInTime || '—' }}</span>
                  <small class="time-sub" *ngIf="(record.checkInTime || record.CheckInTime) && formatDisplayTime(record.checkInTime || record.CheckInTime) !== (record.checkInTime || record.CheckInTime)">
                    ({{ formatDisplayTime(record.checkInTime || record.CheckInTime) }})
                  </small>
                </td>
                <td>
                  <span class="time-main">{{ record.checkOutTime || record.CheckOutTime || '—' }}</span>
                  <small class="time-sub" *ngIf="(record.checkOutTime || record.CheckOutTime) && formatDisplayTime(record.checkOutTime || record.CheckOutTime) !== (record.checkOutTime || record.CheckOutTime)">
                    ({{ formatDisplayTime(record.checkOutTime || record.CheckOutTime) }})
                  </small>
                </td>
                <td>
                  <span class="work-duration" *ngIf="calculateDuration(record.checkInTime || record.CheckInTime, record.checkOutTime || record.CheckOutTime)">
                    {{ calculateDuration(record.checkInTime || record.CheckInTime, record.checkOutTime || record.CheckOutTime) }}
                  </span>
                  <span *ngIf="!calculateDuration(record.checkInTime || record.CheckInTime, record.checkOutTime || record.CheckOutTime)" class="no-dur">—</span>
                </td>
                <td>
                  <span class="source-tag" [matTooltip]="getRecordCapturedTime(record) ? ('Logged at: ' + getRecordCapturedTime(record) + ' IST') : 'Logged manually'">
                    {{ record.captureSource || 'Manual' }}
                  </span>
                </td>
                <td class="remarks-cell">{{ record.remarks || '—' }}</td>
                <td class="actions-col">
                  <button mat-icon-button color="accent" (click)="openApplyRegularization(selectedStudent, record.attendanceDate)" matTooltip="Request Regularization for this date"><mat-icon>edit_calendar</mat-icon></button>
                  <button mat-icon-button color="primary" (click)="editRecord(record)" [disabled]="!attendancePermissions.canCorrectAttendance || attendanceMode === 'Biometric' || (isPublicHolidayOrSunday(record.attendanceDate) && !canEditPublicHolidayOrSunday)" matTooltip="Edit record"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button color="warn" (click)="deleteRecord(record.id)" [disabled]="!attendancePermissions.canCorrectAttendance || attendanceMode === 'Biometric' || (isPublicHolidayOrSunday(record.attendanceDate) && !canEditPublicHolidayOrSunday)" matTooltip="Delete record"><mat-icon>delete_outline</mat-icon></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </mat-card>

      <div class="empty-state" *ngIf="records.length === 0 && !loading">
        <mat-icon>event_busy</mat-icon>
        <h3>No Attendance Records Found</h3>
        <p>No records found for {{ months[attMonth - 1] }} {{ attYear }}. Select dates on the calendar matrix above to begin logging attendance.</p>
      </div>
    </div>
  </div>

  <!-- ================= TAB 3: ATTENDANCE REGULARIZATION & OD REQUESTS ================= -->
  <div *ngIf="activeTab === 'regularization'" class="regularization-view">

    <!-- Approver Header Banner for Class Teacher -->
    <div class="teacher-approval-banner" *ngIf="isTeacher">
      <div class="tab-badge-icon">
        <mat-icon>fact_check</mat-icon>
      </div>
      <div class="tab-badge-text">
        <strong>Class Teacher Review Desk • {{ teacherClassSection?.className || 'Assigned Class' }} {{ teacherClassSection?.sectionName ? '(' + ((teacherClassSection?.sectionName || '').startsWith('Section') ? teacherClassSection?.sectionName : 'Section ' + teacherClassSection?.sectionName) + ')' : '' }}</strong>
        <p>Review and approve / reject attendance regularization and OD requests submitted by students or parents of your assigned class.</p>
      </div>
    </div>

    <!-- KPI Summary Cards -->
    <div class="reg-kpi-grid">
      <div class="reg-kpi-card total">
        <div class="kpi-icon"><mat-icon>rule</mat-icon></div>
        <div class="kpi-info">
          <span class="kpi-num">{{ regularizationStats.totalRequests }}</span>
          <span class="kpi-lbl">Total Requests</span>
        </div>
      </div>
      <div class="reg-kpi-card pending">
        <div class="kpi-icon"><mat-icon>hourglass_top</mat-icon></div>
        <div class="kpi-info">
          <span class="kpi-num">{{ regularizationStats.pendingRequests }}</span>
          <span class="kpi-lbl">Pending Review</span>
        </div>
        <span class="pulse-indicator" *ngIf="regularizationStats.pendingRequests > 0">Action Required</span>
      </div>
      <div class="reg-kpi-card approved">
        <div class="kpi-icon"><mat-icon>check_circle</mat-icon></div>
        <div class="kpi-info">
          <span class="kpi-num">{{ regularizationStats.approvedRequests }}</span>
          <span class="kpi-lbl">Approved</span>
        </div>
      </div>
      <div class="reg-kpi-card rejected">
        <div class="kpi-icon"><mat-icon>cancel</mat-icon></div>
        <div class="kpi-info">
          <span class="kpi-num">{{ regularizationStats.rejectedRequests }}</span>
          <span class="kpi-lbl">Rejected</span>
        </div>
      </div>
    </div>

    <!-- Controls & Filter Bar -->
    <mat-card class="reg-controls-card mat-elevation-z1">
      <div class="reg-controls-row">
        <!-- Status Filter Pills -->
        <div class="status-filter-pills">
          <button type="button" class="pill-btn" [class.active]="regFilterStatus === 'Pending'" (click)="setRegStatusFilter('Pending')">
            Pending <span class="badge" *ngIf="regularizationStats.pendingRequests > 0">{{ regularizationStats.pendingRequests }}</span>
          </button>
          <button type="button" class="pill-btn" [class.active]="regFilterStatus === 'Approved'" (click)="setRegStatusFilter('Approved')">
            Approved
          </button>
          <button type="button" class="pill-btn" [class.active]="regFilterStatus === 'Rejected'" (click)="setRegStatusFilter('Rejected')">
            Rejected
          </button>
          <button type="button" class="pill-btn" [class.active]="regFilterStatus === 'All'" (click)="setRegStatusFilter('All')">
            All
          </button>
        </div>

        <!-- Search Input -->
        <mat-form-field appearance="outline" class="reg-search-field">
          <mat-label>Search student, roll no, reason...</mat-label>
          <input matInput [(ngModel)]="regSearchQuery" (keyup.enter)="loadRegularizations()" placeholder="Type & press Enter...">
          <mat-icon matPrefix>search</mat-icon>
          <button mat-icon-button matSuffix *ngIf="regSearchQuery" (click)="regSearchQuery = ''; loadRegularizations()">
            <mat-icon>close</mat-icon>
          </button>
        </mat-form-field>

        <div class="reg-action-btns">
          <button mat-stroked-button class="reg-refresh-btn" (click)="loadRegularizations()" [disabled]="regularizationLoading" matTooltip="Refresh Requests">
            <mat-icon [class.spin]="regularizationLoading">refresh</mat-icon>
            <span>Refresh</span>
          </button>
          <button mat-stroked-button class="reg-apply-btn secondary" *ngIf="!isTeacher" (click)="openApplyRegularization()" matTooltip="Submit Attendance Regularization">
            <mat-icon>add_circle_outline</mat-icon>
            <span>Apply Regularization</span>
          </button>
        </div>
      </div>
    </mat-card>

    <!-- Requests Data Table / List -->
    <mat-card class="reg-table-card mat-elevation-z1">

      <div *ngIf="!regularizationLoading && regularizations.length === 0" class="reg-empty-box">
        <mat-icon>task_alt</mat-icon>
        <h4>{{ isTeacher ? 'No Pending Student Requests to Review' : ('No ' + (regFilterStatus === 'All' ? '' : regFilterStatus) + ' Regularization Requests') }}</h4>
        <p>{{ isTeacher ? 'All student attendance regularization requests for your assigned class have been reviewed. New requests from students or parents will appear here.' : (regFilterStatus === 'Pending' ? 'All student attendance regularization requests have been reviewed.' : 'No records match the current filter criteria.') }}</p>
        <button mat-stroked-button color="primary" *ngIf="!isTeacher" (click)="openApplyRegularization()">
          <mat-icon>add</mat-icon> Submit New Request
        </button>
      </div>

      <div class="reg-table-container" *ngIf="!regularizationLoading && regularizations.length > 0">
        <table class="reg-table">
          <thead>
            <tr>
              <th>Student Details</th>
              <th>Class & Section</th>
              <th>Attendance Date</th>
              <th>Category & Requested</th>
              <th>Reason & Teacher Notes</th>
              <th>Proof / Doc</th>
              <th>Status</th>
              <th>Applied By</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let reg of regularizations" [class.pending-row]="reg.status === 'Pending'">
              <td>
                <div class="student-cell">
                  <div class="student-avatar">{{ getInitials(reg.studentName) }}</div>
                  <div class="student-meta">
                    <strong>{{ reg.studentName }}</strong>
                    <small>Roll: {{ reg.rollNumber }}</small>
                  </div>
                </div>
              </td>
              <td>
                <div class="class-cell">
                  <span>{{ reg.className || 'General' }}</span>
                  <small *ngIf="reg.sectionName">Sec {{ reg.sectionName }}</small>
                </div>
              </td>
              <td>
                <div class="date-cell">
                  <strong>{{ reg.attendanceDate | date:'dd MMM yyyy' }}</strong>
                  <small>{{ reg.attendanceDate | date:'EEEE' }}</small>
                </div>
              </td>
              <td>
                <div class="status-cat-cell">
                  <span class="cat-tag" [ngClass]="reg.reasonCategory.toLowerCase()">
                    {{ getRegCategoryLabel(reg.reasonCategory) }}
                  </span>
                  <span class="req-status-tag">{{ reg.requestedStatus }}</span>
                </div>
              </td>
              <td>
                <div class="reason-cell" [matTooltip]="reg.reason">
                  <p class="reason-text">{{ reg.reason }}</p>
                  <small class="reviewed-note" *ngIf="reg.reviewRemarks">
                    <strong>Note:</strong> {{ reg.reviewRemarks }} (by {{ reg.reviewedBy }})
                  </small>
                </div>
              </td>
              <td>
                <a *ngIf="reg.attachmentUrl" [href]="reg.attachmentUrl" target="_blank" class="doc-link-btn" matTooltip="Open Attachment">
                  <mat-icon>attachment</mat-icon> Proof
                </a>
                <span *ngIf="!reg.attachmentUrl" class="no-doc">—</span>
              </td>
              <td>
                <span class="status-badge-chip" [ngClass]="reg.status.toLowerCase()">
                  <mat-icon *ngIf="reg.status === 'Approved'">check</mat-icon>
                  <mat-icon *ngIf="reg.status === 'Pending'">hourglass_empty</mat-icon>
                  <mat-icon *ngIf="reg.status === 'Rejected'">close</mat-icon>
                  {{ reg.status }}
                </span>
              </td>
              <td>
                <div class="applied-cell">
                  <span class="applied-badge">{{ reg.appliedBy }}</span>
                  <small [appIstDatetime]="reg.createdAt"></small>
                </div>
              </td>
              <td style="text-align: right;">
                <div class="action-cell">
                  <!-- Class Teacher or Admin can Review if Pending -->
                  <button mat-raised-button color="primary" class="review-btn" *ngIf="reg.status === 'Pending'" (click)="openReviewRegularization(reg)" matTooltip="Review and Approve/Reject">
                    <mat-icon>fact_check</mat-icon> Review
                  </button>
                  <!-- Cancel button -->
                  <button mat-icon-button color="warn" *ngIf="reg.status === 'Pending'" (click)="deleteRegularization(reg)" matTooltip="Cancel Request">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                  <span *ngIf="reg.status !== 'Pending'" class="reviewed-done-txt">
                    <mat-icon>done_all</mat-icon>
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </mat-card>

  </div>
</div>
  `,
  styles: [`
    .page-container { display: flex; flex-direction: column; gap: 16px; position: relative; }
    .global-page-loader {
      position: sticky;
      top: -16px;
      z-index: 1000;
      height: 4px;
      border-radius: 2px;
      margin-bottom: -12px;
    }
    .loading-card {
      padding: 36px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      background: #ffffff;
      border-radius: 12px;
      color: #64748b;
      font-weight: 500;
      font-size: 0.9rem;
    }
    .page-header {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: flex-start !important;
      width: 100%;
    }
    .header-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      width: 100%;
      flex-wrap: wrap;
      box-sizing: border-box;
    }
    .page-title {
      margin: 0;
      color: #1976d2;
      font-size: 1.45rem;
      display: flex;
      align-items: center;
      gap: 8px;
      text-align: left;
    }
    .page-subtitle {
      margin: 0;
      color: #64748b;
      font-size: .88rem;
      text-align: left;
      width: 100%;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;

      .header-action-btn {
        height: 38px;
        padding: 0 12px !important;
        font-size: 0.82rem;
        font-weight: 600;
        white-space: nowrap;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        text-decoration: none;
        transition: all 0.2s ease-in-out;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          line-height: 18px;
          margin: 0 !important;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        span {
          white-space: nowrap;
          line-height: 1;
        }

        &.settings-btn {
          background: #eff6ff !important;
          color: #1e40af !important;
          border: 1px solid #bfdbfe !important;

          mat-icon {
            color: #2563eb !important;
          }

          &:hover {
            background: #dbeafe !important;
            border-color: #93c5fd !important;
          }
        }

        &.report-btn, &.directory-btn {
          background: #ffffff !important;
          color: #334155 !important;
          border: 1px solid #cbd5e1 !important;

          mat-icon {
            color: #64748b !important;
          }

          &:hover {
            background: #f8fafc !important;
            border-color: #94a3b8 !important;
            color: #0f172a !important;

            mat-icon {
              color: #334155 !important;
            }
          }
        }
      }
    }
    
    /* View Mode Tabs */
    .view-mode-tabs { display: flex; gap: 12px; margin-bottom: 4px; width: 100%; }
    .tab-btn {
      flex: 1; display: flex; align-items: center; gap: 12px;
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

    /* Scope Toggle Bar */
    .roll-call-scope-bar {
      display: flex; gap: 12px; margin-bottom: 4px;
    }
    .scope-pill-btn {
      flex: 1; max-width: 320px; display: flex; align-items: center; gap: 12px;
      padding: 10px 16px; border: 1.5px solid #cbd5e1; border-radius: 10px;
      background: #ffffff; cursor: pointer; transition: all 0.2s ease;
      text-align: left; color: #475569;
    }
    .scope-pill-btn mat-icon { font-size: 26px; width: 26px; height: 26px; color: #64748b; }
    .scope-btn-text strong { display: block; font-size: 0.92rem; color: #1e293b; }
    .scope-btn-text small { font-size: 0.72rem; color: #64748b; }
    .scope-pill-btn.active {
      border-color: #2563eb; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      color: #1d4ed8; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.12);
    }
    .scope-pill-btn.active mat-icon { color: #2563eb; }
    .scope-pill-btn.active .scope-btn-text strong { color: #1e40af; }

    /* Batch View & Controls Card */
    .batch-view { display: flex; flex-direction: column; gap: 14px; }
    .batch-controls-card { padding: 16px 20px; border-radius: 12px; background: #ffffff; margin-bottom: 4px; }
    .controls-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .batch-select { flex: 1 1 200px; min-width: 170px; margin: 0; }
    .class-select { flex: 1 1 180px; min-width: 150px; margin: 0; }
    .section-select { flex: 1 1 140px; min-width: 120px; margin: 0; }
    .date-controls { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .date-input { width: 145px; margin: 0; }
    .today-btn {
      height: 38px;
      padding: 0 14px !important;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.84rem;
      color: #2563eb;
      border: 1px solid #bfdbfe;
      background: #eff6ff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
      line-height: 1;
      transition: all 0.2s ease-in-out;
      &:hover {
        background: #dbeafe;
      }
    }
    .search-input {
      flex: 2 1 220px;
      min-width: 190px;
      margin: 0;

      ::ng-deep .mat-mdc-text-field-wrapper {
        overflow: hidden;
      }
      ::ng-deep .mat-mdc-floating-label,
      .mat-mdc-floating-label {
        max-width: calc(100% - 44px) !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }
      ::ng-deep .mat-mdc-form-field-infix,
      .mat-mdc-form-field-infix {
        min-width: 0 !important;
      }
      input {
        font-size: 0.88rem;
        text-overflow: ellipsis;
      }
    }

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

    /* Roll Call Default Timings Strip & Shift Switcher */
    .roll-call-timings-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 14px;
      padding: 10px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;

      .rct-left-group {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
      }

      .rct-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.84rem;
        font-weight: 600;
        color: #334155;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
      }

      .rct-shift-switcher {
        display: flex;
        gap: 6px;
        background: #e2e8f0;
        padding: 3px;
        border-radius: 20px;

        .shift-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 12px;
          border-radius: 16px;
          border: none;
          background: transparent;
          font-size: 0.76rem;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          transition: all 0.2s ease;

          mat-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
          }

          &.active {
            background: #ffffff;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);

            &.morning {
              color: #c2410c;
              mat-icon { color: #ea580c; }
            }

            &.evening {
              color: #4338ca;
              mat-icon { color: #6366f1; }
            }
          }
        }
      }

      .rct-fields {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .rct-input-wrap {
        display: flex;
        align-items: center;
        gap: 6px;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 3px 8px;

        label {
          font-size: 0.74rem;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
        }

        input {
          border: none;
          outline: none;
          font-size: 0.85rem;
          font-family: inherit;
          color: #0f172a;
          font-weight: 600;
          background: transparent;
        }
      }

      .rct-apply-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        color: #1d4ed8;
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;

        mat-icon { font-size: 15px; width: 15px; height: 15px; }

        &:hover:not([disabled]) {
          background: #dbeafe;
          border-color: #93c5fd;
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      .rct-dur-badge {
        display: inline-flex;
        align-items: center;
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 3px 8px;
        font-size: 0.74rem;
        font-weight: 700;
      }
    }

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
    .table-responsive { overflow-x: auto; width: 100%; box-sizing: border-box; }
    .roll-call-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    .roll-call-table th {
      background: #f8fafc; color: #475569; font-weight: 700; text-align: left;
      padding: 14px 14px; border-bottom: 2px solid #e2e8f0; font-size: 0.82rem;
      text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;
    }
    .roll-call-table td {
      padding: 12px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle;
    }
    .roll-call-table th:first-child,
    .roll-call-table td:first-child {
      padding-left: 20px !important;
    }
    .roll-call-table th:last-child,
    .roll-call-table td:last-child {
      padding-right: 32px !important;
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
      overflow: hidden; border: 1.5px solid #e2e8f0;
      .avatar-photo {
        width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;
      }
    }
    .student-meta { display: flex; flex-direction: column; min-width: 0; }
    .student-meta .name { font-weight: 600; color: #1e293b; font-size: 0.92rem; white-space: nowrap; }
    .student-meta .sub {
      font-size: 0.72rem;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 2px;
      cursor: help;
      white-space: nowrap;
      line-height: 1.2;

      &.manual-sub {
        color: #15803d;
        .saved-dot {
          color: #16a34a;
          font-size: 15px;
          width: 15px;
          height: 15px;
          line-height: 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
      }
      &.bio-sub {
        color: #1d4ed8;
        font-weight: 600;
        .bio-dot {
          color: #2563eb;
          font-size: 15px;
          width: 15px;
          height: 15px;
          line-height: 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
      }
      .sub-text {
        white-space: nowrap;
        font-weight: 600;
      }
      .log-pill {
        background: #f1f5f9;
        color: #64748b;
        font-size: 0.65rem;
        font-weight: 600;
        padding: 1px 5px;
        border-radius: 4px;
        border: 1px solid #e2e8f0;
        margin-left: 3px;
        white-space: nowrap;
      }
    }
    .adm-pill {
      display: inline-block; background: #e0e7ff; color: #3730a3;
      padding: 1px 6px; border-radius: 4px; font-size: 0.68rem; font-weight: 700;
      margin-top: 2px; width: fit-content;
    }
    .class-pill {
      background: #f1f5f9; color: #334155; padding: 4px 8px; border-radius: 6px;
      font-weight: 600; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px;
    }
    .class-pill strong { color: #2563eb; }
    .roll-adm-col { vertical-align: middle; }
    .roll-adm-stack { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
    .roll-pill {
      background: #e2e8f0; color: #1e293b; padding: 2.5px 8px; border-radius: 6px;
      font-weight: 700; font-size: 0.8rem; font-family: monospace; display: inline-flex; align-items: center;
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

    .remarks-col {
      width: 160px;
      min-width: 150px;
    }
    .remarks-cell {
      padding-right: 32px !important;
      width: 160px;
      min-width: 150px;
    }
    .remarks-input {
      width: 140px;
      max-width: 100%;
      box-sizing: border-box;
      padding: 7px 11px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.82rem;
      outline: none;
      transition: all 0.2s ease;
      background: #ffffff;
      display: block;
    }
    .remarks-input:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }

    /* Roll Call Timings Bar & Table Timings */
    .roll-call-timings-bar {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 12px; margin-top: 14px; padding: 10px 16px;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border: 1px solid #e2e8f0; border-radius: 10px;
    }
    .rct-label {
      display: inline-flex; align-items: center; gap: 6px; font-weight: 700;
      font-size: 0.84rem; color: #1e293b;
    }
    .rct-label mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
    .rct-fields { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .rct-input-wrap { display: inline-flex; align-items: center; gap: 6px; }
    .rct-input-wrap label { font-size: 0.76rem; font-weight: 700; color: #64748b; }
    .rct-input-wrap input {
      border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 8px; font-size: 0.82rem;
      background: #ffffff; color: #1e293b; font-weight: 600; outline: none;
    }
    .rct-input-wrap input:focus { border-color: #2563eb; }
    .rct-apply-btn {
      display: inline-flex; align-items: center; gap: 4px; border: 1px solid #93c5fd;
      background: #eff6ff; color: #1d4ed8; font-weight: 700; font-size: 0.76rem;
      padding: 5px 12px; border-radius: 6px; cursor: pointer; transition: all 0.15s;
    }
    .rct-apply-btn:hover { background: #dbeafe; }
    .rct-apply-btn mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .rct-dur-badge {
      background: #e0e7ff; color: #3730a3; font-size: 0.74rem; font-weight: 800;
      padding: 3px 8px; border-radius: 6px;
    }
    .timings-cell { width: 210px; min-width: 200px; text-align: center; }
    .row-timings { display: inline-flex; align-items: center; gap: 6px; justify-content: center; }
    .time-field { display: inline-flex; align-items: center; gap: 3px; }
    .time-field .t-badge {
      font-size: 0.65rem; font-weight: 800; color: #64748b; text-transform: uppercase;
      background: #f1f5f9; padding: 2px 4px; border-radius: 4px; border: 1px solid #e2e8f0;
      &.bio-badge {
        background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe;
      }
    }
    .table-time-input {
      border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 6px; font-size: 0.78rem;
      font-weight: 600; color: #1e293b; background: #ffffff; width: 80px; outline: none;
    }
    .table-time-input:focus { border-color: #2563eb; }
    .absent-timings-dash { color: #94a3b8; font-weight: 600; font-size: 0.9rem; }

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
    .save-actions { display: flex; align-items: center; gap: 12px; }
    .btn-save-batch {
      height: 38px; padding: 0 16px !important; font-size: 0.84rem !important;
      font-weight: 600 !important; border-radius: 8px !important; display: inline-flex;
      align-items: center; gap: 6px;
    }
    .batch-locked-badge {
      display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px;
      background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;
      border-radius: 8px; font-size: 0.82rem; font-weight: 600;
    }
    .batch-locked-badge mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .status-pill:disabled { opacity: 0.55; cursor: not-allowed; }
    .status-pill:disabled:hover { background: #ffffff !important; color: #64748b !important; }
    .status-pill.selected:disabled { opacity: 0.85; cursor: not-allowed; }
    .remarks-input:disabled { background: #f1f5f9; color: #94a3b8; cursor: not-allowed; }

    /* Tab 2 Single Student Styles */
    .selector-card, .period-card {
      display: flex; flex-direction: row !important; flex-wrap: nowrap !important;
      align-items: center; gap: 16px; padding: 10px 18px; border-radius: 10px;
      min-height: 78px; box-sizing: border-box;
    }
    .selector-card { margin-bottom: 16px; flex-wrap: wrap !important; }
    .selector-icon { font-size: 28px; width: 28px; height: 28px; flex: 0 0 28px; }
    .stream-pill-toggle {
      display: inline-flex; background: #f1f5f9; border-radius: 8px; padding: 3px; gap: 3px; flex-shrink: 0;
    }
    .stream-pill {
      border: none; background: transparent; padding: 6px 12px; border-radius: 6px;
      font-size: 0.8rem; font-weight: 600; color: #64748b; cursor: pointer; transition: all 0.15s ease;
    }
    .stream-pill:hover { color: #1e293b; }
    .stream-pill.active {
      background: #ffffff; color: #2563eb; box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .single-class-select { flex: 1 1 200px; min-width: 170px; margin: 0; }
    .single-section-select { flex: 1 1 160px; min-width: 130px; margin: 0; }
    .single-batch-select { flex: 1 1 220px; min-width: 180px; margin: 0; }
    .student-select { flex: 2 1 280px; min-width: 220px; margin: 0; }
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
      min-height: 74px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 1px; cursor: pointer; color: #334155; padding: 4px 2px; transition: transform 0.15s ease, box-shadow 0.15s ease;
      position: relative;
    }
    .cell-check-wrap {
      position: absolute;
      top: 4px;
      right: 5px;
      z-index: 3;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cell-check-input {
      width: 15px;
      height: 15px;
      cursor: pointer;
      accent-color: #2563eb;
      border-radius: 4px;
      margin: 0;
    }
    .day-cell.selected-for-batch {
      border: 2.5px solid #2563eb !important;
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25) !important;
      transform: translateY(-2px);
    }
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

    .day-cell { min-height: 84px !important; }
    .day-cell:hover { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(0,0,0,0.06); }
    .day-cell .day-num { font-weight: 800; font-size: 0.88rem; line-height: 1.1; }
    .day-cell .day-name { color: #94a3b8; font-size: .64rem; line-height: 1.1; }
    .day-cell .day-tag { font-size: .72rem; line-height: 1.2; font-weight: 700; }
    .day-cell .day-time {
      font-size: .62rem; font-weight: 700; line-height: 1.1; letter-spacing: -0.01em; opacity: 0.92;
      margin-top: 1px;
    }
    .day-times-wrap {
      display: flex; flex-direction: column; gap: 1px; width: 100%; margin-top: 2px;
    }
    .day-punch {
      font-size: 0.58rem; font-weight: 700; line-height: 1.15;
      display: flex; align-items: center; justify-content: center; gap: 2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .day-punch mat-icon { font-size: 10px; width: 10px; height: 10px; }
    .punch-in { color: #15803d; }
    .punch-out { color: #0284c7; }
    .punch-captured { color: #64748b; }
    .day-punch-dur {
      font-size: 0.54rem; font-weight: 800; background: rgba(0,0,0,0.06);
      padding: 0 4px; border-radius: 4px; display: inline-flex; align-items: center;
      justify-content: center; gap: 2px; align-self: center; margin-top: 1px; color: #334155;
    }
    .day-punch-dur mat-icon { font-size: 9px; width: 9px; height: 9px; }

    .day-cell.present { background: #dcfce7; border-color: #86efac; color: #15803d; }
    .day-cell.present .day-name { color: #16a34a; }
    .day-cell.absent { background: #fee2e2; border-color: #fca5a5; color: #b91c1c; }
    .day-cell.absent .day-name { color: #dc2626; }
    .day-cell.late { background: #ffedd5; border-color: #fdba74; color: #c2410c; }
    .day-cell.half { background: #f3e8ff; border-color: #d8b4fe; color: #7e22ce; }
    .day-cell.holiday { background: #fef3c7; border-color: #fbbf24; color: #b45309; }
    .day-cell.sunday { background: #ffe4e6; color: #be123c; }
    .day-cell.saturday { background: #e0e7ff; color: #4338ca; }
    .day-cell.prioradmission {
      background: #f8fafc !important;
      border-color: #e2e8f0 !important;
      color: #94a3b8 !important;
      cursor: not-allowed !important;
      opacity: 0.65;
      box-shadow: none !important;
      transform: none !important;
      .day-name { color: #94a3b8 !important; }
      .day-tag { background: #f1f5f9 !important; color: #64748b !important; font-size: 0.6rem !important; }
    }
    .day-cell.today { box-shadow: 0 0 0 2px #2563eb inset; }
    .day-cell.locked, .day-cell.locked-past {
      cursor: not-allowed !important;
    }
    .day-cell.locked:hover, .day-cell.locked-past:hover {
      transform: none !important;
      box-shadow: none !important;
    }
    .day-cell.future {
      opacity: 0.55;
      cursor: not-allowed !important;
      background: #f8fafc !important;
      border-color: #e2e8f0 !important;
      color: #94a3b8 !important;
      box-shadow: none !important;
      transform: none !important;
    }
    .day-cell.future .day-name, .day-cell.future .day-tag { color: #cbd5e1 !important; }
    .day-cell.future.sunday { background: #fff1f2 !important; border-color: #fecdd3 !important; color: #fda4af !important; }
    .day-cell.future.saturday { background: #eff6ff !important; border-color: #dbeafe !important; color: #93c5fd !important; }
    .day-cell.future.holiday { background: #fefce8 !important; border-color: #fef08a !important; color: #fde047 !important; }
    
    .form-duration-hint {
      display: flex; flex-direction: column; gap: 4px; background: #eff6ff; color: #1e40af;
      padding: 8px 12px; border-radius: 8px; font-size: 0.82rem; margin: -6px 0 12px;
      border: 1px solid #bfdbfe;
    }
    .form-hint-line, .form-hint-late { display: flex; align-items: center; gap: 6px; }
    .form-hint-line mat-icon { font-size: 17px; width: 17px; height: 17px; color: #2563eb; }
    .form-hint-late { color: #c2410c; font-weight: 600; }
    .form-hint-late mat-icon { font-size: 17px; width: 17px; height: 17px; color: #ea580c; }

    /* Detailed Attendance Table (Matching Faculty Attendance Design) */
    .table-card { border-radius: 12px; overflow: hidden; padding: 0; border: 1px solid #e2e8f0; width: 100%; max-width: 100%; box-sizing: border-box; margin-top: 14px; background: #ffffff; }
    .table-card-header { padding: 12px 18px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: .92rem; color: #1e293b; }
    .table-title-group { display: flex; justify-content: space-between; align-items: center; width: 100%; flex-wrap: wrap; gap: 8px; }
    .table-scroll-hint { display: none; align-items: center; gap: 5px; font-size: .74rem; color: #0369a1; background: #e0f2fe; border: 1px solid #bae6fd; padding: 3px 8px; border-radius: 6px; font-weight: 600; mat-icon { font-size: 15px; width: 15px; height: 15px; } }
    .table-responsive { width: 100%; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .att-table { width: 100%; min-width: 860px; border-collapse: collapse; font-size: .86rem; }
    .att-table th, .att-table td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; text-align: left; white-space: nowrap; }
    .att-table th { background: #f8fafc; font-weight: 700; color: #64748b; font-size: .78rem; text-transform: uppercase; letter-spacing: .4px; position: sticky; top: 0; z-index: 1; }
    .att-table tr:hover td { background: #fbfcfd; }
    .att-table td.remarks-cell { white-space: normal; min-width: 130px; max-width: 220px; line-height: 1.35; color: #64748b; font-size: .82rem; }
    .att-table th:first-child, .att-table td:first-child {
      position: sticky; left: 0; background: #ffffff; z-index: 2; box-shadow: 2px 0 6px rgba(0,0,0,0.04);
    }
    .att-table th:first-child { background: #f8fafc; z-index: 3; }
    .att-table tr:hover td:first-child { background: #fbfcfd; }

    .day-label { font-size: .8rem; color: #64748b; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: .76rem; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; }
    .status-badge.present { background: #dcfce7; color: #15803d; }
    .status-badge.absent { background: #fee2e2; color: #b91c1c; }
    .status-badge.late { background: #ffedd5; color: #c2410c; }
    .status-badge.halfday { background: #f3e8ff; color: #7e22ce; }
    .status-badge.leave { background: #e0e7ff; color: #3730a3; }
    .status-badge.holiday { background: #fef3c7; color: #b45309; }
    .time-main { font-weight: 600; color: #1e293b; }
    .time-sub { display: block; font-size: .72rem; color: #64748b; }
    .work-duration { background: #f1f5f9; color: #334155; padding: 2px 8px; border-radius: 6px; font-weight: 600; font-size: .78rem; }
    .no-dur { color: #94a3b8; }
    .source-tag { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: .76rem; font-weight: 600; background: #f1f5f9; color: #475569; }
    .actions-col { text-align: right; width: 120px; white-space: nowrap; button { width: 36px; height: 36px; line-height: 36px; } }

    .teacher-class-locked-badge {
      display: flex; align-items: center; gap: 10px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1.5px solid #bfdbfe; border-radius: 12px;
      padding: 10px 18px; color: #1e3a8a;
    }
    .teacher-class-locked-badge mat-icon { color: #2563eb; font-size: 20px; }
    .teacher-class-locked-badge strong { display: block; font-size: 14px; font-weight: 700; }
    .teacher-class-locked-badge small { font-size: 12px; color: #3b82f6; }

    /* Regularization Tab Styles */
    .tab-pending-badge {
      background: #f59e0b; color: #ffffff; font-size: 0.72rem; font-weight: 700;
      padding: 2px 7px; border-radius: 9999px; margin-left: auto;
      box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
    }
    .regularization-view { display: flex; flex-direction: column; gap: 14px; }
    .teacher-approval-banner {
      display: flex; align-items: center; gap: 14px;
      padding: 12px 18px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe; border-radius: 12px;
      .tab-badge-icon {
        width: 40px; height: 40px; background: #2563eb; color: #ffffff;
        border-radius: 10px; display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25); flex-shrink: 0;
        mat-icon { font-size: 22px; width: 22px; height: 22px; }
      }
      .tab-badge-text {
        strong { display: block; color: #1e3a8a; font-size: 0.92rem; font-weight: 700; }
        p { margin: 2px 0 0; color: #3b82f6; font-size: 0.78rem; font-weight: 500; }
      }
    }
    .reg-kpi-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;
    }
    .reg-kpi-card {
      background: #ffffff; border-radius: 12px; padding: 16px; display: flex; align-items: center; gap: 14px;
      border: 1px solid #e2e8f0; position: relative; overflow: hidden;
      .kpi-icon {
        width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }
      .kpi-info { display: flex; flex-direction: column; }
      .kpi-num { font-size: 1.5rem; font-weight: 800; line-height: 1; }
      .kpi-lbl { font-size: 0.8rem; color: #64748b; margin-top: 4px; font-weight: 500; }
      &.total {
        .kpi-icon { background: #eff6ff; color: #2563eb; }
        .kpi-num { color: #1e40af; }
      }
      &.pending {
        .kpi-icon { background: #fef3c7; color: #d97706; }
        .kpi-num { color: #b45309; }
      }
      &.approved {
        .kpi-icon { background: #dcfce7; color: #16a34a; }
        .kpi-num { color: #15803d; }
      }
      &.rejected {
        .kpi-icon { background: #fee2e2; color: #dc2626; }
        .kpi-num { color: #b91c1c; }
      }
      .pulse-indicator {
        position: absolute; top: 10px; right: 10px; font-size: 0.68rem; font-weight: 700;
        background: #fef3c7; color: #b45309; border: 1px solid #fde68a; padding: 2px 6px; border-radius: 4px;
      }
    }
    .reg-controls-card { padding: 14px 18px; border-radius: 12px; background: #ffffff; }
    .reg-controls-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .status-filter-pills {
      display: flex; gap: 6px; background: #f1f5f9; padding: 4px; border-radius: 8px;
      .pill-btn {
        border: none; background: transparent; padding: 6px 14px; border-radius: 6px;
        font-size: 0.84rem; font-weight: 600; color: #475569; cursor: pointer; transition: all 0.15s ease;
        display: inline-flex; align-items: center; gap: 6px;
        .badge {
          background: #f59e0b; color: #ffffff; font-size: 0.7rem; padding: 1px 5px; border-radius: 9999px;
        }
        &.active {
          background: #ffffff; color: #2563eb; box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
      }
    }
    .reg-search-field { flex: 1; min-width: 200px; margin: 0; }
    .reg-action-btns { display: flex; align-items: center; gap: 10px; margin-left: auto; }
    .reg-table-card { border-radius: 12px; overflow: hidden; padding: 0; background: #ffffff; }
    .reg-loading-box, .reg-empty-box {
      padding: 48px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #64748b;
      mat-icon { font-size: 40px; width: 40px; height: 40px; color: #94a3b8; }
      h4 { margin: 0; font-size: 1.1rem; color: #334155; }
      p { margin: 0; font-size: 0.88rem; max-width: 400px; text-align: center; }
    }
    .reg-table-container { overflow-x: auto; width: 100%; }
    .reg-table {
      width: 100%; border-collapse: collapse; font-size: 0.88rem; text-align: left;
      thead th {
        background: #f8fafc; color: #475569; font-weight: 600; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em;
      }
      tbody td {
        padding: 12px 16px; border-bottom: 1px solid #f1f5f9; vertical-align: middle;
      }
      tbody tr:hover { background: #f8fafc; }
      tbody tr.pending-row { background: #fffdf5; &:hover { background: #fefce8; } }
    }
    .student-cell {
      display: flex; align-items: center; gap: 10px;
      .student-avatar {
        width: 34px; height: 34px; border-radius: 50%; background: #2563eb; color: #ffffff;
        font-weight: 700; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .student-meta { display: flex; flex-direction: column; strong { color: #0f172a; font-size: 0.9rem; } small { color: #64748b; font-size: 0.75rem; } }
    }
    .class-cell, .date-cell, .applied-cell {
      display: flex; flex-direction: column;
      strong { color: #0f172a; font-size: 0.88rem; }
      small { color: #64748b; font-size: 0.75rem; }
    }
    .status-cat-cell {
      display: flex; flex-direction: column; gap: 4px;
      .cat-tag {
        display: inline-block; padding: 2px 7px; border-radius: 9999px; font-size: 0.72rem; font-weight: 600; width: fit-content;
        background: #eff6ff; color: #1d4ed8;
        &.onduty { background: #fef3c7; color: #92400e; }
        &.medical { background: #fee2e2; color: #991b1b; }
        &.rollcallerror { background: #e0f2fe; color: #0369a1; }
        &.punchmiss { background: #f3e8ff; color: #6b21a8; }
      }
      .req-status-tag { font-size: 0.75rem; font-weight: 600; color: #15803d; }
    }
    .reason-cell {
      max-width: 260px;
      .reason-text { margin: 0; font-size: 0.85rem; color: #334155; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .reviewed-note { display: block; margin-top: 4px; font-size: 0.75rem; color: #059669; }
    }
    .doc-link-btn {
      display: inline-flex; align-items: center; gap: 4px; font-size: 0.78rem; font-weight: 600; color: #2563eb; text-decoration: none;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { text-decoration: underline; }
    }
    .no-doc { color: #cbd5e1; }
    .status-badge-chip {
      display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 0.78rem; font-weight: 600;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &.pending { background: #fef3c7; color: #b45309; }
      &.approved { background: #dcfce7; color: #15803d; }
      &.rejected { background: #fee2e2; color: #b91c1c; }
    }
    .applied-badge {
      display: inline-block; font-size: 0.75rem; font-weight: 600; color: #475569; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; width: fit-content;
    }
    .action-cell {
      display: flex; align-items: center; justify-content: flex-end; gap: 6px;
      .review-btn {
        font-size: 0.8rem; padding: 0 12px; height: 32px; line-height: 32px;
        mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
      }
      .reviewed-done-txt { color: #10b981; mat-icon { font-size: 20px; } }
    }

    @media (max-width: 900px) {
      .summary-grid { grid-template-columns: repeat(4, 1fr); gap: 14px; }
      .period-card { flex-wrap: wrap !important; }
      .legend { flex-wrap: wrap; }
      .form-row { flex-wrap: wrap; }
      .view-mode-tabs { flex-direction: column; }
      .tab-btn { max-width: 100%; }
      .roll-call-scope-bar { flex-direction: column; }
      .scope-pill-btn { max-width: 100%; }
      .reg-kpi-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
      .table-scroll-hint { display: inline-flex !important; }
    }
    @media (max-width: 768px) {
      /* Period card — wrap on tablet */
      .period-card {
        flex-wrap: wrap !important;
        min-height: auto !important;
        gap: 12px;
        padding: 12px 14px;
      }
      .period-student { min-width: 0; flex: 1 1 100%; }
      .period-selectors { flex: 1 1 100%; }
      .period-selectors mat-form-field { flex: 1; width: auto; min-width: 120px; }
      /* Summary grid 4-col on tablet */
      .summary-grid { grid-template-columns: repeat(4, 1fr) !important; gap: 10px !important; }
      /* Calendar heading legend wraps */
      .calendar-heading { flex-wrap: wrap; gap: 8px; }
      .legend { flex-wrap: wrap; gap: 6px 12px; }
      /* Save bar on tablet */
      .save-bar {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
        padding: 12px 14px;
      }
      .whatsapp-alert-toggle { width: 100%; }
      .save-actions {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        width: 100%;
      }
      .btn-save-batch { width: 100%; justify-content: center; }
      .batch-locked-badge { justify-content: center; }
      /* Matrix floating bar — stack on tablet */
      .matrix-floating-bar {
        flex-direction: column;
        align-items: stretch;
        padding: 12px;
        gap: 10px;
      }
      .mfb-left { justify-content: flex-start; }
      .mfb-center {
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: flex-start;
        gap: 6px;
      }
      .mfb-remarks-input { width: 100%; min-width: 0; box-sizing: border-box; }
      .mfb-right {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
      }
      .mfb-save-btn { width: 100%; justify-content: center; }
      /* Reg table scroll hint visible */
      .table-scroll-hint { display: inline-flex !important; }

      .header-top-row {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }
      .page-title {
        font-size: 1.25rem;
        white-space: normal;
      }
      .header-actions {
        width: 100%;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;

        .header-action-btn {
          width: 100% !important;
          justify-content: center;
          height: 38px;
          padding: 0 8px !important;
          font-size: 0.8rem;
          margin: 0 !important;
        }
        .settings-btn {
          grid-column: span 2;
        }
      }
      .view-mode-tabs {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
      }
      .tab-btn {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 14px;
        gap: 10px;
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
        .tab-text strong { font-size: 0.88rem; }
        .tab-text small { font-size: 0.72rem; line-height: 1.2; }
      }
      .roll-call-scope-bar {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
      }
      .scope-pill-btn {
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        padding: 10px 14px;
        gap: 12px;
        mat-icon { font-size: 24px; width: 24px; height: 24px; flex-shrink: 0; }
        .scope-btn-text {
          flex: 1;
          min-width: 0;
          strong { font-size: 0.88rem; }
          small { font-size: 0.72rem; line-height: 1.2; display: block; }
        }
      }
      .controls-row {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }
      .class-select, .section-select, .batch-select, .search-input {
        width: 100% !important;
        min-width: 100% !important;
      }
      .date-controls {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        .date-input { flex: 1; }
      }
      .stats-and-actions {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }
      .stats-counters {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
        width: 100%;
      }
      .stat-pill {
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 6px 4px;
        font-size: 0.75rem;
      }
      .fast-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        width: 100%;

        .btn-bulk-present, .btn-bulk-absent {
          width: 100%;
          justify-content: center;
          height: 36px;
          font-size: 0.78rem;
        }
      }
      .roll-call-timings-bar {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
        .rct-left-group { flex-direction: column; align-items: flex-start; gap: 6px; }
        .rct-fields { flex-wrap: wrap; gap: 8px; }
      }
      .summary-grid {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 10px !important;
      }
      .reg-kpi-grid {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 10px !important;
      }
      .reg-kpi-card {
        padding: 12px;
        gap: 10px;
        .kpi-icon { width: 36px; height: 36px; mat-icon { font-size: 20px; width: 20px; height: 20px; } }
        .kpi-num { font-size: 1.25rem; }
        .kpi-lbl { font-size: 0.72rem; }
      }
      .reg-controls-row {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }
      .status-filter-pills {
        display: flex;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        width: 100%;
        padding-bottom: 4px;
      }
      .reg-search-field { width: 100% !important; }
      .reg-action-btns {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        width: 100%;
        .reg-refresh-btn, .reg-apply-btn { width: 100%; justify-content: center; }
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
    @media (max-width: 600px) {
      .page-header, .selector-card { align-items: stretch; flex-direction: column !important; flex-wrap: nowrap !important; }
      .student-select { min-width: 0; width: 100%; }
      .period-student { flex-basis: auto; }
      .calendar-grid { gap: 4px; }
      .day-cell { min-height: 54px; padding: 3px 1px; }
      .day-cell .day-num { font-size: 0.8rem; }
      .day-cell .day-name { font-size: 0.58rem; }
      .day-cell .day-tag { font-size: 0.62rem; }
      .day-times-wrap { display: none; } /* hide punch times on tiny screens */
      .record-row { grid-template-columns: 1fr 90px 40px 40px; }
      .remarks { display: none; }
      .save-bar { flex-direction: column; align-items: stretch; }
      .btn-save-batch { width: 100%; justify-content: center; }
      /* Summary grid 2-col on mobile */
      .summary-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
      .reg-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
      /* Period card fully stacked */
      .period-card {
        flex-direction: column !important;
        align-items: stretch !important;
        flex-wrap: wrap !important;
        min-height: auto !important;
        gap: 10px;
        padding: 12px;
      }
      .period-student { flex: 1 1 100%; min-width: 0; }
      .period-selectors { flex: 1 1 100%; gap: 8px; }
      .period-selectors mat-form-field { flex: 1; width: auto; }
      /* Calendar heading */
      .calendar-heading { flex-direction: column; align-items: flex-start; gap: 8px; }
      .legend { gap: 6px 10px; flex-wrap: wrap; }
      /* Roll call table compacted */
      .roll-call-table td, .roll-call-table th { padding: 8px 8px; }
      .roll-call-table th:first-child, .roll-call-table td:first-child { padding-left: 10px !important; }
      .roll-call-table th:last-child, .roll-call-table td:last-child { padding-right: 10px !important; }
      /* Matrix floating bar fully stacked */
      .matrix-floating-bar { padding: 10px; }
      .mfb-pill { padding: 4px 8px; font-size: 0.7rem; }
      /* Attendance table scroll hint */
      .table-scroll-hint { display: inline-flex !important; }
      /* Reg controls */
      .reg-controls-row { flex-direction: column; align-items: stretch; gap: 10px; }
      .reg-search-field { width: 100% !important; }
      /* Teacher banner */
      .teacher-approval-banner { flex-wrap: wrap; gap: 10px; }
    }
    @media (max-width: 480px) {
      .page-title { font-size: 1.1rem; }
      .summary-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 7px !important; }
      .summary-card { min-height: 68px; padding: 8px 6px; }
      .summary-card strong { font-size: 1.05rem; }
      .summary-card small { font-size: 0.62rem; }
      /* Day-cell on very small phones */
      .calendar-grid { grid-template-columns: repeat(7, 1fr); gap: 3px; }
      .day-cell { min-height: 46px; border-radius: 5px; }
      .day-cell .day-num { font-size: 0.74rem; }
      .day-cell .day-name { font-size: 0.52rem; }
      .day-cell .day-tag { display: none; }
      /* Status pills in roll-call table go icon-only on tiny screens */
      .status-pill .label { display: none; }
      .status-pill { padding: 6px 10px; }
      /* Reg KPI 2-col */
      .reg-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 6px !important; }
      /* Floating bar pills */
      .mfb-time-wrap { flex: 1; }
      /* View tabs text size */
      .tab-btn .tab-text strong { font-size: 0.82rem; }
      .tab-btn .tab-text small { font-size: 0.68rem; }
    }
  `]
})
export class StudentAttendanceComponent implements OnInit {
  private api = API_BASE;
  hasWaImg = false;

  // Mode Tabs
  activeTab: 'batch' | 'single' | 'regularization' = 'batch';

  // Roll Call Scope ('school' | 'coaching')
  rollCallScope: 'school' | 'coaching' = 'school';

  // School Class State
  schoolClasses: SchoolClassDto[] = [];
  selectedClassId = '';
  selectedSectionId = '';
  classSections: SchoolSectionDto[] = [];
  schoolStudents: BatchStudentRow[] = [];
  schoolLoading = false;
  schoolSaving = false;
  schoolSuccessMsg = '';

  // Teacher's class section (if class teacher)
  teacherClassSection: { isClassTeacher: boolean; classId?: string; sectionId?: string; className?: string; sectionName?: string } | null = null;

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

  // Batch Bulk Roll Call State
  batches: any[] = [];
  selectedBatchId = '';
  selectedBatchDate = StudentAttendanceComponent.getTodayIstDateParts().str;
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
  singleStreamFilter: 'all' | 'school' | 'coaching' = 'all';
  singleSelectedClassId = '';
  singleSelectedSectionId = '';
  singleClassSections: SchoolSectionDto[] = [];
  singleSelectedBatchId = '';
  records: StudentAttendance[] = [];
  holidays: HolidayDto[] = [];
  calendarDays: CalendarDay[] = [];

  // Multi-Date Check State
  selectedMatrixDates = new Set<string>();
  batchTargetStatus = 'Present';
  batchTargetRemarks = '';
  batchTargetCheckIn = '08:00';
  batchTargetCheckOut = '14:00';
  batchSavingDates = false;
  bulkCheckInTime = '08:00';
  bulkCheckOutTime = '14:00';
  coachingActiveShift: 'morning' | 'evening' = 'morning';
  summary: AttendanceSummary | null = null;
  loading = false;
  saving = false;
  showForm = false;
  canEditPublicHolidayOrSunday = false;
  editingRecordId: string | null = null;
  attMonth = StudentAttendanceComponent.getTodayIstDateParts().month;
  attYear = StudentAttendanceComponent.getTodayIstDateParts().year;
  months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  years = [2024, 2025, 2026, 2027];
  formData = { attendanceDate: StudentAttendanceComponent.getTodayIstDateParts().str, status: 'Present', remarks: '', checkInTime: '08:00', checkOutTime: '14:00' };
  attendanceMode: AttendanceSettingsDto['studentMode'] = 'Both';
  attendanceSettings: AttendanceSettingsDto = { studentMode: 'Both', teacherMode: 'Both' };
  attendancePermissions: AttendancePermissionsDto = { canChangeMode: false, canManualMark: false, canBiometricCapture: false, canMapBiometric: false, canCorrectAttendance: false };

  private avatarColors = [
    '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#059669',
    '#0891b2', '#4f46e5', '#d97706', '#dc2626', '#0d9488'
  ];

  // Tab 3: Attendance Regularization State
  regularizations: StudentAttendanceRegularizationDto[] = [];
  regularizationStats = { totalRequests: 0, pendingRequests: 0, approvedRequests: 0, rejectedRequests: 0 };
  regularizationLoading = false;
  regFilterStatus: string = 'Pending';
  regSearchQuery: string = '';

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private confirmDialog: ConfirmDialogService,
    private coachingService: CoachingService,
    private schoolService: SchoolService,
    public authService: AuthService,
    private dialog: MatDialog
  ) {}

  pageLoading = true;

  get isAnyLoading(): boolean {
    return this.pageLoading || this.loading || this.batchLoading || this.batchSaving || this.schoolLoading || this.schoolSaving;
  }

  get hasSchool(): boolean {
    return this.authService.hasSchoolModule();
  }

  get hasCoaching(): boolean {
    return this.authService.hasCoachingModule();
  }

  get isTeacher(): boolean {
    return this.authService.isTeacher();
  }

  get isTeacherClassLocked(): boolean {
    return !!(this.isTeacher && this.teacherClassSection?.isClassTeacher);
  }

  get isTeacherSectionLocked(): boolean {
    return !!(this.isTeacher && this.teacherClassSection?.isClassTeacher && this.teacherClassSection?.sectionId);
  }

  ngOnInit(): void {
    this.coachingActiveShift = new Date().getHours() < 13 ? 'morning' : 'evening';
    this.pageLoading = true;
    if (!this.hasSchool && this.hasCoaching) {
      this.rollCallScope = 'coaching';
      this.singleStreamFilter = 'coaching';
    } else if (this.hasSchool && !this.hasCoaching) {
      this.rollCallScope = 'school';
      this.singleStreamFilter = 'school';
    } else if (this.isTeacher) {
      this.rollCallScope = 'school';
      this.singleStreamFilter = 'school';
    } else {
      this.singleStreamFilter = 'all';
    }

    this.loadAttendanceSettings();
    this.http.get<AttendancePermissionsDto>(`${this.api}/attendance/permissions`, {
      headers: { 'X-Skip-Loader': 'true' }
    }).subscribe({
      next: permissions => this.attendancePermissions = permissions
    });

    this.loadRegularizationStats();

    const requestedTab = this.route.snapshot.queryParamMap.get('tab');
    const requestedStudentId = this.route.snapshot.queryParamMap.get('studentId');

    if (requestedTab === 'regularization') {
      this.activeTab = 'regularization';
      this.loadRegularizations();
    } else if (requestedStudentId) {
      this.activeTab = 'single';
      this.loadStudents(false);
    } else {
      // In background, prefetch student lookup silently with X-Skip-Loader
      this.loadStudents(true);
    }

    // If teacher, load their assigned class section first
    if (this.isTeacher) {
      this.loadTeacherClassSection();
    }

    // Load School Classes only if School Module is active
    if (this.hasSchool) {
      this.loadSchoolClasses();
      if (this.hasCoaching) {
        this.loadBatches(true);
      }
    } else if (this.hasCoaching) {
      this.loadBatches(false);
    }
  }

  // ================= SCOPE SWITCHER & ACTIVE GETTERS =================

  setRollCallScope(scope: 'school' | 'coaching'): void {
    this.rollCallScope = scope;
    this.batchSearchQuery = '';
    this.syncScopeDefaultTimings();
    if (scope === 'school') {
      if (this.schoolClasses.length > 0 && !this.selectedClassId) {
        this.selectedClassId = this.schoolClasses[0].id;
        this.onClassChanged();
      } else if (this.selectedClassId) {
        this.loadSchoolAttendance();
      }
    } else {
      if (this.batches.length === 0) {
        this.loadBatches(false);
      } else if (!this.selectedBatchId) {
        this.selectedBatchId = this.batches[0].id;
        this.loadBatchAttendance();
      } else if (this.selectedBatchId) {
        this.loadBatchAttendance();
      }
    }
  }

  get isScopeSelected(): boolean {
    return this.rollCallScope === 'school' ? !!this.selectedClassId : !!this.selectedBatchId;
  }

  get isScopeLoading(): boolean {
    return this.rollCallScope === 'school' ? this.schoolLoading : this.batchLoading;
  }

  get isScopeSaving(): boolean {
    return this.rollCallScope === 'school' ? this.schoolSaving : this.batchSaving;
  }

  get activeSuccessMsg(): string {
    return this.rollCallScope === 'school' ? this.schoolSuccessMsg : this.batchSuccessMsg;
  }

  set activeSuccessMsg(val: string) {
    if (this.rollCallScope === 'school') {
      this.schoolSuccessMsg = val;
    } else {
      this.batchSuccessMsg = val;
    }
  }

  get activeStudents(): BatchStudentRow[] {
    return this.rollCallScope === 'school' ? this.schoolStudents : this.batchStudents;
  }

  get filteredActiveStudents(): BatchStudentRow[] {
    const list = this.activeStudents;
    if (!this.batchSearchQuery.trim()) return list;
    const q = this.batchSearchQuery.toLowerCase();
    return list.filter(s =>
      (s.studentName && s.studentName.toLowerCase().includes(q)) ||
      (s.rollNumber && s.rollNumber.toLowerCase().includes(q)) ||
      (s.schoolRollNumber && s.schoolRollNumber.toLowerCase().includes(q)) ||
      (s.admissionNumber && s.admissionNumber.toLowerCase().includes(q)) ||
      (s.sectionName && s.sectionName.toLowerCase().includes(q))
    );
  }

  get totalActiveStudents(): number {
    return this.activeStudents.length;
  }

  get presentActiveCount(): number {
    return this.activeStudents.filter(s => s.status === 'Present').length;
  }

  get absentActiveCount(): number {
    return this.activeStudents.filter(s => s.status === 'Absent').length;
  }

  get lateActiveCount(): number {
    return this.activeStudents.filter(s => s.status === 'Late').length;
  }

  get halfDayActiveCount(): number {
    return this.activeStudents.filter(s => s.status === 'HalfDay').length;
  }

  markAllActiveStatus(status: string): void {
    if (this.isBatchPastLocked) {
      this.confirmDialog.alert('Permission Denied', 'Past date attendance cannot be marked or modified without Admin Attendance Correction permission.', 'warning');
      return;
    }
    for (const student of this.activeStudents) {
      student.status = status;
      if (status === 'Absent') {
        student.checkInTime = null;
        student.checkOutTime = null;
      } else {
        if (!student.checkInTime) student.checkInTime = this.bulkCheckInTime;
        if (!student.checkOutTime) student.checkOutTime = this.bulkCheckOutTime;
      }
    }
  }

  setStudentActiveStatus(student: BatchStudentRow, status: string): void {
    if (this.isBatchPastLocked) {
      this.confirmDialog.alert('Permission Denied', 'Past date attendance cannot be marked or modified without Admin Attendance Correction permission.', 'warning');
      return;
    }
    student.status = status;
    if (status === 'Absent') {
      student.checkInTime = null;
      student.checkOutTime = null;
    } else {
      if (!student.checkInTime) student.checkInTime = this.bulkCheckInTime;
      if (!student.checkOutTime) student.checkOutTime = this.bulkCheckOutTime;
    }
  }

  onBulkTimingsChanged(): void {
    // If teachers adjust bulk timings, keep consistency
  }

  parseTimeToMinutes(timeStr?: string | null): number | null {
    if (!timeStr) return null;
    const parts = timeStr.trim().split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }

  getDiffMinutes(inTime?: string | null, outTime?: string | null): number | null {
    const inM = this.parseTimeToMinutes(inTime);
    const outM = this.parseTimeToMinutes(outTime);
    if (inM === null || outM === null) return null;
    const diff = outM - inM;
    return diff >= 0 ? diff : null;
  }

  calculateDuration(inTime?: string | null, outTime?: string | null): string {
    const diff = this.getDiffMinutes(inTime, outTime);
    if (diff === null) return '';
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    if (hours === 0) return `${mins}m`;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  formatDisplayTime(timeStr?: string | null): string {
    if (!timeStr) return '';
    const parts = timeStr.trim().split(':');
    if (parts.length < 2) return timeStr;
    let h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    const mStr = m < 10 ? '0' + m : m;
    return `${h}:${mStr} ${ampm}`;
  }

  getStudentSmartStatus(declaredStatus: string, inTime?: string | null, outTime?: string | null): string {
    if (declaredStatus === 'Absent' || declaredStatus === 'Holiday' || declaredStatus === 'Leave') {
      return declaredStatus;
    }
    if (!inTime) return declaredStatus;

    const inMin = this.parseTimeToMinutes(inTime);
    if (inMin === null) return declaredStatus;

    const isCoaching = this.rollCallScope === 'coaching' || inMin < 450 || inMin >= 930;

    let shiftStart: number;
    let shiftEnd: number;
    let grace: number;

    if (isCoaching) {
      if (this.coachingActiveShift === 'evening' || inMin >= 720) {
        shiftStart = this.parseTimeToMinutes(this.bulkCheckInTime || this.attendanceSettings?.coachingEveningStartTime || '16:00') ?? 960;
        shiftEnd = this.parseTimeToMinutes(this.bulkCheckOutTime || this.attendanceSettings?.coachingEveningEndTime || '19:00') ?? 1140;
        grace = this.attendanceSettings?.coachingEveningGraceMinutes ?? 15;
      } else {
        shiftStart = this.parseTimeToMinutes(this.bulkCheckInTime || this.attendanceSettings?.coachingMorningStartTime || '07:00') ?? 420;
        shiftEnd = this.parseTimeToMinutes(this.bulkCheckOutTime || this.attendanceSettings?.coachingMorningEndTime || '10:00') ?? 600;
        grace = this.attendanceSettings?.coachingMorningGraceMinutes ?? 15;
      }
    } else {
      shiftStart = this.parseTimeToMinutes(this.bulkCheckInTime || this.attendanceSettings?.studentShiftStartTime || '08:00') ?? 480;
      shiftEnd = this.parseTimeToMinutes(this.bulkCheckOutTime || this.attendanceSettings?.studentShiftEndTime || '14:00') ?? 840;
      grace = this.attendanceSettings?.studentGracePeriodMinutes ?? 15;
    }

    const lateCutoff = shiftStart + grace;

    // Solution B: Dynamic Duration & Ratio-Based Thresholds (Zero hardcoding)
    let shiftDuration = shiftEnd - shiftStart;
    if (shiftDuration <= 0) {
      shiftDuration = isCoaching ? 150 : 360;
    }
    const expectedDuration = shiftDuration;

    // Dynamic thresholds:
    // Full Day: >= 70% of expected duration
    // Half Day: 35% to 69% of expected duration
    // Absent: < 35% of expected duration
    let fullDayMinThreshold = Math.round(expectedDuration * 0.70);
    let halfDayMinThreshold = Math.round(expectedDuration * 0.35);

    if (!isCoaching && (this.attendanceSettings?.studentHalfDayThresholdMinutes ?? 0) > 0) {
      fullDayMinThreshold = this.attendanceSettings?.studentHalfDayThresholdMinutes || 240;
      halfDayMinThreshold = Math.round(fullDayMinThreshold / 2);
    }

    if (outTime) {
      let outMin = this.parseTimeToMinutes(outTime);
      if (outMin !== null) {
        if (outMin <= inMin) {
          if (outMin + 720 > inMin && outMin + 720 <= 1440) {
            outMin += 720;
          }
        }
        const diff = outMin - inMin;
        if (diff > 0) {
          if (diff < halfDayMinThreshold) {
            return 'Absent';
          }
          if (diff < fullDayMinThreshold) {
            return 'HalfDay';
          }
        }
      }
    }

    if (inMin > lateCutoff) {
      return 'Late';
    } else if (inMin <= lateCutoff && declaredStatus === 'Late') {
      return 'Present';
    }

    return declaredStatus;
  }

  onStudentRowTimeChanged(student: BatchStudentRow): void {
    if (student.status === 'Absent') return;
    student.status = this.getStudentSmartStatus(student.status, student.checkInTime, student.checkOutTime);
  }

  onFormTimeChanged(): void {
    if (this.formData.status === 'Absent' || this.formData.status === 'Holiday') return;
    this.formData.status = this.getStudentSmartStatus(this.formData.status, this.formData.checkInTime, this.formData.checkOutTime);
  }

  onFormStatusChanged(): void {
    if (this.formData.status === 'Absent' || this.formData.status === 'Holiday') {
      this.formData.checkInTime = '';
      this.formData.checkOutTime = '';
    } else {
      if (!this.formData.checkInTime) this.formData.checkInTime = this.bulkCheckInTime || '08:00';
      if (!this.formData.checkOutTime) this.formData.checkOutTime = this.bulkCheckOutTime || '14:00';
      this.formData.status = this.getStudentSmartStatus(this.formData.status, this.formData.checkInTime, this.formData.checkOutTime);
    }
  }

  applyBulkTimingsToPresent(): void {
    let count = 0;
    for (const student of this.activeStudents) {
      if (student.status !== 'Absent') {
        student.checkInTime = this.bulkCheckInTime;
        student.checkOutTime = this.bulkCheckOutTime;
        student.status = this.getStudentSmartStatus(student.status, student.checkInTime, student.checkOutTime);
        count++;
      }
    }
    this.confirmDialog.alert('Timings Applied', `Applied In: ${this.formatDisplayTime(this.bulkCheckInTime)} and Out: ${this.formatDisplayTime(this.bulkCheckOutTime)} to ${count} students.`, 'success');
  }

  saveActiveAttendance(): void {
    if (this.rollCallScope === 'school') {
      this.saveSchoolAttendance();
    } else {
      this.saveBatchAttendance();
    }
  }

  loadActiveScopeAttendance(): void {
    if (this.rollCallScope === 'school') {
      this.loadSchoolAttendance();
    } else {
      this.loadBatchAttendance();
    }
  }

  // ================= SCHOOL CLASS ROLL CALL METHODS =================

  syncTeacherClassSection(): void {
    if (this.isTeacher) {
      // If teacherClassSection was not populated from backend endpoint, find match from schoolClasses
      if (!this.teacherClassSection?.isClassTeacher && this.schoolClasses?.length > 0) {
        const user: any = this.authService.currentUser();
        const userFullName = (user?.fullName || user?.name || '').trim().toLowerCase();
        for (const c of this.schoolClasses) {
          const sec = c.sections?.find((s: any) =>
            (s.classTeacherName && s.classTeacherName.trim().toLowerCase() === userFullName)
          );
          if (sec) {
            this.teacherClassSection = {
              isClassTeacher: true,
              classId: c.id,
              className: c.name,
              sectionId: sec.id,
              sectionName: sec.name
            };
            break;
          }
        }
      }

      if (this.teacherClassSection?.isClassTeacher && this.teacherClassSection.classId) {
        const classId = this.teacherClassSection.classId;
        const sectionId = this.teacherClassSection.sectionId || '';

        // Tab 1: Roll Call Bulk
        this.rollCallScope = 'school';
        this.selectedClassId = classId;
        const selectedClass = this.schoolClasses.find(c => c.id === classId);
        this.classSections = selectedClass?.sections || [];
        this.selectedSectionId = sectionId;
        if (this.activeTab === 'batch') {
          this.loadSchoolAttendance();
        }

        // Tab 2: Individual Student Register
        this.singleStreamFilter = 'school';
        this.singleSelectedClassId = classId;
        const singleClass = this.schoolClasses.find(c => c.id === classId);
        this.singleClassSections = singleClass?.sections || [];
        this.singleSelectedSectionId = sectionId;
        this.syncSingleSelectedStudent();
      }
    }
  }

  loadTeacherClassSection(): void {
    this.http.get<any>(`${this.api}/teachers/my-class-section`, {
      headers: { 'X-Skip-Loader': 'true' }
    }).subscribe({
      next: info => {
        this.teacherClassSection = info;
        this.syncTeacherClassSection();
      },
      error: () => {
        this.teacherClassSection = { isClassTeacher: false };
        this.syncTeacherClassSection();
      }
    });
  }

  loadSchoolClasses(): void {
    this.schoolLoading = true;
    this.schoolService.getClasses(true).subscribe({
      next: classes => {
        this.schoolLoading = false;
        this.pageLoading = false;
        this.schoolClasses = classes || [];
        const requestedClassId = this.route.snapshot.queryParamMap.get('classId');
        const requestedSectionId = this.route.snapshot.queryParamMap.get('sectionId');

        // If teacher is a class teacher, lock to their assigned class/section
        if (this.isTeacher) {
          this.syncTeacherClassSection();
        } else if (requestedClassId && this.schoolClasses.some(c => c.id === requestedClassId)) {
          this.rollCallScope = 'school';
          this.selectedClassId = requestedClassId;
          this.onClassChanged();
          if (requestedSectionId) {
            this.selectedSectionId = requestedSectionId;
            this.loadSchoolAttendance();
          }
        } else if (!this.isTeacher && this.schoolClasses.length > 0) {
          // If classes exist and user is admin/staff, default to first class
          this.selectedClassId = this.schoolClasses[0].id;
          this.onClassChanged();
        } else if (this.schoolClasses.length === 0) {
          this.rollCallScope = 'coaching';
          if (this.batches.length === 0) {
            this.loadBatches(false);
          }
        }
      },
      error: () => {
        this.schoolLoading = false;
        this.pageLoading = false;
        this.schoolClasses = [];
      }
    });
  }

  onClassChanged(): void {
    const selectedClass = this.schoolClasses.find(c => c.id === this.selectedClassId);
    this.classSections = selectedClass?.sections || [];
    this.selectedSectionId = '';
    this.schoolSuccessMsg = '';
    this.loadSchoolAttendance();
  }

  onSectionChanged(): void {
    this.schoolSuccessMsg = '';
    this.loadSchoolAttendance();
  }

  loadSchoolAttendance(): void {
    if (!this.selectedClassId) return;
    this.schoolLoading = true;
    this.schoolService.getSchoolAttendance(this.selectedClassId, this.selectedSectionId || undefined, this.selectedBatchDate).subscribe({
      next: rows => {
        const parseRoll = (val?: string | null): number => {
          if (!val) return 999999;
          const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
          return isNaN(num) ? 999999 : num;
        };
        const mapped = (rows || []).map(r => ({
          studentId: r.studentId,
          studentName: r.studentName,
          rollNumber: r.schoolRollNumber || '',
          schoolRollNumber: r.schoolRollNumber,
          admissionNumber: r.admissionNumber,
          className: r.className,
          sectionName: r.sectionName,
          profilePhoto: r.profilePhoto,
          parentWhatsAppPhone: r.parentWhatsAppPhone,
          status: r.status || 'Present',
          remarks: r.remarks || '',
          attendanceId: r.attendanceId,
          capturedAt: r.capturedAt,
          captureSource: r.captureSource,
          checkInTime: r.checkInTime || (r as any).CheckInTime || (r.status !== 'Absent' ? this.bulkCheckInTime : null),
          checkOutTime: r.checkOutTime || (r as any).CheckOutTime || (r.status !== 'Absent' ? this.bulkCheckOutTime : null)
        }));
        mapped.sort((a, b) => {
          const rA = parseRoll(a.schoolRollNumber || a.rollNumber);
          const rB = parseRoll(b.schoolRollNumber || b.rollNumber);
          if (rA !== rB) return rA - rB;
          return (a.studentName || '').localeCompare(b.studentName || '');
        });
        this.schoolStudents = mapped;
        this.schoolLoading = false;
        this.pageLoading = false;
      },
      error: () => {
        this.schoolStudents = [];
        this.schoolLoading = false;
        this.pageLoading = false;
      }
    });
  }

  saveSchoolAttendance(): void {
    if (!this.selectedClassId) {
      this.confirmDialog.alert('Selection Missing', 'Please select a class first.', 'warning');
      return;
    }
    if (!this.selectedBatchDate) {
      this.confirmDialog.alert('Date Missing', 'Please select an attendance date.', 'warning');
      return;
    }
    if (this.selectedBatchDate > this.todayStr) {
      this.confirmDialog.alert('Future Date', 'Cannot save attendance for future dates.', 'warning');
      return;
    }
    if (this.selectedBatchDate < this.todayStr && !this.attendancePermissions.canCorrectAttendance) {
      this.confirmDialog.alert('Permission Denied', 'Past date attendance cannot be marked or modified without Admin Attendance Correction permission.', 'warning');
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
    if (this.schoolStudents.length === 0) {
      this.confirmDialog.alert('No Students', 'There are no students to save attendance for.', 'warning');
      return;
    }

    this.schoolSaving = true;
    this.schoolSuccessMsg = '';

    const payload = {
      classId: this.selectedClassId,
      sectionId: this.selectedSectionId || null,
      attendanceDate: this.selectedBatchDate,
      sendWhatsAppAlerts: this.sendWhatsAppAlerts,
      items: this.schoolStudents.map(s => {
        const effStatus = this.getStudentSmartStatus(s.status, s.checkInTime, s.checkOutTime);
        s.status = effStatus;
        return {
          studentId: s.studentId,
          status: effStatus,
          remarks: s.remarks || null,
          checkInTime: effStatus !== 'Absent' && effStatus !== 'Holiday' ? (s.checkInTime || null) : null,
          checkOutTime: effStatus !== 'Absent' && effStatus !== 'Holiday' ? (s.checkOutTime || null) : null
        };
      })
    };

    this.schoolService.saveBulkSchoolAttendance(payload).subscribe({
      next: res => {
        this.schoolSaving = false;
        const msg = res?.message || `Class attendance saved successfully for ${this.schoolStudents.length} students.`;
        this.schoolSuccessMsg = msg;
        this.confirmDialog.alert('Attendance Saved', msg, 'success');
        this.loadSchoolAttendance();
      },
      error: err => {
        this.schoolSaving = false;
        this.confirmDialog.alert('Save Failed', err?.error?.message || 'Failed to save class attendance.', 'danger');
      }
    });
  }

  // ================= BATCH ROLL CALL METHODS =================

  loadBatches(silent: boolean = false): void {
    if (!silent) {
      this.batchLoading = true;
    }
    const headers: any = silent ? { 'X-Skip-Loader': 'true' } : {};
    this.http.get<any[]>(`${this.api}/batches`, { headers }).subscribe({
      next: batches => {
        this.batchLoading = false;
        this.pageLoading = false;
        this.batches = batches || [];
        const requestedBatchId = this.route.snapshot.queryParamMap.get('batchId');
        if (requestedBatchId && this.batches.some(b => b.id === requestedBatchId)) {
          this.rollCallScope = 'coaching';
          this.selectedBatchId = requestedBatchId;
        } else if (this.batches.length > 0 && !this.selectedBatchId) {
          this.selectedBatchId = this.batches[0].id;
        }
        if (this.selectedBatchId && this.rollCallScope === 'coaching') {
          this.loadBatchAttendance();
        }
      },
      error: () => {
        this.batchLoading = false;
        this.pageLoading = false;
        this.batches = [];
      }
    });
  }

  selectedCoachingClassId: string = '';
  singleSelectedCoachingClassId: string = '';

  get filteredCoachingBatches(): any[] {
    if (!this.selectedCoachingClassId) return this.batches || [];
    return (this.batches || []).filter(b => (b.classId || '').toLowerCase() === this.selectedCoachingClassId.toLowerCase());
  }

  get filteredSingleCoachingBatches(): any[] {
    if (!this.singleSelectedCoachingClassId) return this.batches || [];
    return (this.batches || []).filter(b => (b.classId || '').toLowerCase() === this.singleSelectedCoachingClassId.toLowerCase());
  }

  onCoachingClassFilterChanged(): void {
    if (this.selectedBatchId) {
      const b = this.batches.find(x => x.id === this.selectedBatchId);
      if (b && this.selectedCoachingClassId && (b.classId || '').toLowerCase() !== this.selectedCoachingClassId.toLowerCase()) {
        const matching = this.filteredCoachingBatches;
        this.selectedBatchId = matching.length > 0 ? matching[0].id : '';
        this.onBatchChanged();
      }
    }
  }

  onSingleCoachingClassChanged(): void {
    const matching = this.filteredSingleCoachingBatches;
    if (matching.length > 0) {
      if (!matching.some(b => b.id === this.singleSelectedBatchId)) {
        this.singleSelectedBatchId = matching[0].id;
      }
    } else {
      this.singleSelectedBatchId = '';
    }
    this.onSingleBatchChanged();
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
          attendanceId: r.attendanceId,
          capturedAt: r.capturedAt,
          captureSource: r.captureSource,
          checkInTime: r.checkInTime || (r as any).CheckInTime || (r.status !== 'Absent' ? this.bulkCheckInTime : null),
          checkOutTime: r.checkOutTime || (r as any).CheckOutTime || (r.status !== 'Absent' ? this.bulkCheckOutTime : null)
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
    if (this.selectedBatchDate <= this.todayStr && !this.attendancePermissions.canCorrectAttendance) {
      this.confirmDialog.alert('Permission Denied', 'Past date attendance cannot be viewed or modified without Admin Attendance Correction permission.', 'warning');
      return;
    }
    const [y, m, d] = this.selectedBatchDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() - 1);
    this.selectedBatchDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    this.loadActiveScopeAttendance();
  }

  nextDay(): void {
    if (this.selectedBatchDate >= this.todayStr) return;
    const [y, m, d] = this.selectedBatchDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + 1);
    const nextStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    if (nextStr > this.todayStr) return;
    this.selectedBatchDate = nextStr;
    this.loadActiveScopeAttendance();
  }

  onBatchDateChanged(): void {
    if (this.selectedBatchDate > this.todayStr) {
      this.confirmDialog.alert('Future Date', 'Cannot select a future date for attendance.', 'warning');
      this.selectedBatchDate = this.todayStr;
    } else if (this.selectedBatchDate < this.todayStr && !this.attendancePermissions.canCorrectAttendance) {
      this.confirmDialog.alert('Permission Denied', 'Past date attendance cannot be marked or modified without Admin Attendance Correction permission.', 'warning');
      this.selectedBatchDate = this.todayStr;
    }
    this.loadActiveScopeAttendance();
  }

  setToday(): void {
    this.selectedBatchDate = this.todayStr;
    this.loadActiveScopeAttendance();
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
    if (this.selectedBatchDate > this.todayStr) {
      this.confirmDialog.alert('Future Date', 'Cannot save attendance for future dates.', 'warning');
      return;
    }
    if (this.selectedBatchDate < this.todayStr && !this.attendancePermissions.canCorrectAttendance) {
      this.confirmDialog.alert('Permission Denied', 'Past date batch attendance cannot be marked or modified without Admin Attendance Correction permission.', 'warning');
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
      items: this.batchStudents.map(s => {
        const effStatus = this.getStudentSmartStatus(s.status, s.checkInTime, s.checkOutTime);
        s.status = effStatus;
        return {
          studentId: s.studentId,
          status: effStatus,
          remarks: s.remarks || null,
          checkInTime: effStatus !== 'Absent' && effStatus !== 'Holiday' ? (s.checkInTime || null) : null,
          checkOutTime: effStatus !== 'Absent' && effStatus !== 'Holiday' ? (s.checkOutTime || null) : null
        };
      })
    };

    this.coachingService.saveBulkBatchAttendance(this.selectedBatchId, payload).subscribe({
      next: res => {
        this.batchSaving = false;
        const msg = res?.message || `Attendance saved successfully for ${this.batchStudents.length} students.`;
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

  // ================= SINGLE STUDENT ATTENDANCE METHODS =================

  loadStudents(silent: boolean = false): void {
    if (!silent) {
      this.loading = true;
    }
    const headers: any = silent ? { 'X-Skip-Loader': 'true' } : {};
    this.http.get<any[]>(`${this.api}/students/lookup`, { headers }).subscribe({
      next: students => {
        this.loading = false;
        this.pageLoading = false;
        this.students = (students || []).map(s => ({
          id: s.id,
          rollNumber: s.schoolRollNumber || s.rollNumber || s.coachingRollNumber || '',
          studentName: s.studentName,
          batchId: s.batchId,
          batchName: s.batchName || '',
          classId: s.classId,
          className: s.className || '',
          sectionId: s.sectionId,
          sectionName: s.sectionName || '',
          schoolRollNumber: s.schoolRollNumber || '',
          admissionNumber: s.admissionNumber || '',
          isSchoolStudent: s.isSchoolStudent,
          isCoachingStudent: s.isCoachingStudent,
          joiningDate: s.joiningDate || s.JoiningDate || ''
        }));
        const requestedStudentId = this.route.snapshot.queryParamMap.get('studentId');
        if (requestedStudentId && this.students.some(s => s.id === requestedStudentId)) {
          this.activeTab = 'single';
          this.selectedStudentId = requestedStudentId;
          const found = this.students.find(s => s.id === requestedStudentId);
          if (found?.isSchoolStudent && found.classId) {
            this.singleStreamFilter = 'school';
            this.singleSelectedClassId = found.classId;
            const cls = this.schoolClasses.find(c => c.id === found.classId);
            this.singleClassSections = cls?.sections || [];
            this.singleSelectedSectionId = found.sectionId || '';
          } else if (found?.isCoachingStudent && found.batchId) {
            this.singleStreamFilter = 'coaching';
            this.singleSelectedBatchId = found.batchId;
          }
          this.onStudentChanged();
        } else {
          if (this.isTeacher && this.teacherClassSection?.isClassTeacher && this.teacherClassSection.classId) {
            this.singleStreamFilter = 'school';
            this.singleSelectedClassId = this.teacherClassSection.classId;
            const singleClass = this.schoolClasses.find(c => c.id === this.singleSelectedClassId);
            this.singleClassSections = singleClass?.sections || [];
            if (this.teacherClassSection.sectionId) {
              this.singleSelectedSectionId = this.teacherClassSection.sectionId;
            }
          } else {
            if (!this.hasSchool && this.hasCoaching) {
              this.singleStreamFilter = 'coaching';
            } else if (this.hasSchool && !this.hasCoaching) {
              this.singleStreamFilter = 'school';
            }
          }
          this.selectedStudentId = this.filteredSingleStudents[0]?.id || '';
          // Only trigger single student attendance calls if the user is actively on Tab 2
          if (this.activeTab === 'single' && this.selectedStudentId) {
            this.onStudentChanged();
          }
        }
      },
      error: () => {
        this.loading = false;
        this.pageLoading = false;
        this.students = [];
      }
    });
  }

  setSingleStreamFilter(filter: 'all' | 'school' | 'coaching'): void {
    this.singleStreamFilter = filter;
    this.singleSelectedClassId = '';
    this.singleSelectedSectionId = '';
    this.singleClassSections = [];
    this.singleSelectedBatchId = '';

    if (filter === 'school') {
      if (this.isTeacher && this.teacherClassSection?.isClassTeacher && this.teacherClassSection.classId) {
        this.singleSelectedClassId = this.teacherClassSection.classId;
        const found = this.schoolClasses.find(c => c.id === this.singleSelectedClassId);
        this.singleClassSections = found?.sections || [];
        this.singleSelectedSectionId = this.teacherClassSection.sectionId || '';
      } else if (this.schoolClasses.length > 0) {
        this.singleSelectedClassId = this.schoolClasses[0].id;
        const found = this.schoolClasses.find(c => c.id === this.singleSelectedClassId);
        this.singleClassSections = found?.sections || [];
      }
    } else if (filter === 'coaching' && this.batches.length > 0) {
      this.singleSelectedBatchId = this.batches[0].id;
    }

    this.clearDateSelection();
    this.syncSingleSelectedStudent();
  }

  onSingleClassChanged(): void {
    const found = this.schoolClasses.find(c => c.id === this.singleSelectedClassId);
    this.singleClassSections = found?.sections || [];
    this.singleSelectedSectionId = '';
    this.clearDateSelection();
    this.syncSingleSelectedStudent();
  }

  onSingleSectionChanged(): void {
    this.clearDateSelection();
    this.syncSingleSelectedStudent();
  }

  onSingleBatchChanged(): void {
    this.clearDateSelection();
    this.syncSingleSelectedStudent();
  }

  syncSingleSelectedStudent(): void {
    const list = this.filteredSingleStudents;
    const currentStillMatches = list.some(s => s.id === this.selectedStudentId);
    if (!currentStillMatches) {
      this.selectedStudentId = list[0]?.id || '';
    }
    if (this.selectedStudentId) {
      this.onStudentChanged();
    } else {
      this.selectedStudent = undefined;
      this.records = [];
      this.summary = null;
      this.buildCalendar();
    }
  }

  get filteredSingleStudents(): StudentItem[] {
    let list = this.students;
    if (this.singleStreamFilter === 'school') {
      list = list.filter(s => s.isSchoolStudent);
      if (this.singleSelectedClassId) {
        list = list.filter(s => s.classId === this.singleSelectedClassId);
      }
      if (this.singleSelectedSectionId) {
        list = list.filter(s => s.sectionId === this.singleSelectedSectionId);
      }
    } else if (this.singleStreamFilter === 'coaching') {
      list = list.filter(s => s.isCoachingStudent);
      if (this.singleSelectedBatchId) {
        list = list.filter(s => s.batchId === this.singleSelectedBatchId);
      }
    }
    return list;
  }

  getStudentDisplayRoll(student: StudentItem): string {
    if (student.schoolRollNumber) return `Roll #${student.schoolRollNumber}`;
    if (student.rollNumber) return student.rollNumber;
    if (student.admissionNumber) return `Adm: ${student.admissionNumber}`;
    return '—';
  }

  getStudentDisplayGroup(student: StudentItem): string {
    if (student.className && student.batchName) {
      return `(${student.className}${student.sectionName ? ' - Sec ' + student.sectionName : ''} • 📚 ${student.batchName})`;
    }
    if (student.className) {
      return `(${student.className}${student.sectionName ? ' - Sec ' + student.sectionName : ''})`;
    }
    if (student.batchName) {
      return `(${student.batchName})`;
    }
    return '';
  }

  syncScopeDefaultTimings(): void {
    if (this.rollCallScope === 'school') {
      this.bulkCheckInTime = this.attendanceSettings?.studentShiftStartTime || '08:00';
      this.bulkCheckOutTime = this.attendanceSettings?.studentShiftEndTime || '14:00';
    } else {
      if (this.coachingActiveShift === 'morning') {
        this.bulkCheckInTime = this.attendanceSettings?.coachingMorningStartTime || '07:00';
        this.bulkCheckOutTime = this.attendanceSettings?.coachingMorningEndTime || '10:00';
      } else {
        this.bulkCheckInTime = this.attendanceSettings?.coachingEveningStartTime || '16:00';
        this.bulkCheckOutTime = this.attendanceSettings?.coachingEveningEndTime || '19:00';
      }
    }
    this.batchTargetCheckIn = this.bulkCheckInTime;
    this.batchTargetCheckOut = this.bulkCheckOutTime;
    this.formData.checkInTime = this.bulkCheckInTime;
    this.formData.checkOutTime = this.bulkCheckOutTime;
  }

  setCoachingShift(shift: 'morning' | 'evening'): void {
    this.coachingActiveShift = shift;
    this.syncScopeDefaultTimings();
  }

  loadAttendanceSettings(): void {
    this.http.get<AttendanceSettingsDto>(`${this.api}/attendance/settings`, {
      headers: { 'X-Skip-Loader': 'true' }
    }).subscribe({
      next: settings => {
        this.attendanceSettings = settings;
        this.attendanceMode = settings.studentMode;
        this.syncScopeDefaultTimings();
      },
      error: () => { this.attendanceMode = 'Both'; }
    });
  }

  openShiftSettingsDialog(): void {
    const isCoaching = this.rollCallScope === 'coaching';
    const ref = this.dialog.open(AttendanceShiftSettingsDialogComponent, {
      width: '760px',
      maxWidth: '95vw',
      data: { initialTab: isCoaching ? 'coaching' : 'student' }
    });
    ref.afterClosed().subscribe(res => {
      if (res?.saved && res?.settings) {
        this.attendanceSettings = res.settings;
        this.attendanceMode = res.settings.studentMode;
        this.syncScopeDefaultTimings();
        if (this.selectedStudent) {
          this.loadAttendance();
        }
        this.confirmDialog.alert('Settings Saved', 'Student shift timings and policies updated successfully.', 'success');
      }
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
      this.clearDateSelection();
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
    const params: any = { month: this.attMonth, year: this.attYear };
    if (this.singleStreamFilter && this.singleStreamFilter !== 'all') {
      params.stream = this.singleStreamFilter;
    }
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

  formatRosterTime(isoStr?: string | null): string {
    if (!isoStr) return '';
    try {
      let str = isoStr.trim();
      if (str.includes('T') || str.includes(' ')) {
        const hasTimezone = /[zZ]|[+-]\d{2}(?::?\d{2})?$/.test(str);
        if (!hasTimezone) {
          str = str.replace(' ', 'T') + 'Z';
        }
      }
      const d = new Date(str);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '';
    }
  }

  getRecordCapturedTime(record?: StudentAttendance | null): string {
    if (!record) return '';
    const raw = record.capturedAt || record.CapturedAt || record.createdAt || record.CreatedAt;
    return raw ? this.formatRosterTime(raw) : '';
  }

  get effectiveSummary(): AttendanceSummary | null {
    if (!this.summary) return null;
    const pastUnmarkedAbsents = this.calendarDays.filter(d => d.status === 'Absent' && !d.record).length;
    if (pastUnmarkedAbsents === 0) return this.summary;
    const totalAbsent = this.summary.absentDays + pastUnmarkedAbsents;
    const denominator = (this.summary.elapsedWorkingDays && this.summary.elapsedWorkingDays > 0)
      ? this.summary.elapsedWorkingDays
      : (this.summary.presentDays + totalAbsent + this.summary.lateDays + this.summary.halfDays);
    const percentage = denominator === 0 ? 0 : Math.round(((this.summary.presentDays + this.summary.lateDays + (this.summary.halfDays * 0.5)) / denominator) * 100);
    return {
      ...this.summary,
      absentDays: totalAbsent,
      attendancePercentage: percentage
    };
  }

  get todayStr(): string {
    return StudentAttendanceComponent.getTodayIstDateParts().str;
  }

  get currentSelectedStudent(): StudentItem | undefined {
    return this.students.find(s => s.id === this.selectedStudentId);
  }

  get studentJoiningDateStr(): string | null {
    const raw = this.currentSelectedStudent?.joiningDate;
    if (!raw) return null;
    return raw.split('T')[0];
  }

  formatDateDisplay(dateStr?: string | null): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr.split('T')[0] + 'T00:00:00Z');
      return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  get minAttendanceDate(): string | null {
    const jDate = this.studentJoiningDateStr;
    if (this.attendancePermissions.canCorrectAttendance) {
      return jDate || null;
    }
    return jDate && jDate > this.todayStr ? jDate : this.todayStr;
  }

  get isBatchPastLocked(): boolean {
    return this.selectedBatchDate < this.todayStr && !this.attendancePermissions.canCorrectAttendance;
  }

  buildCalendar(): void {
    const daysInMonth = new Date(this.attYear, this.attMonth, 0).getDate();
    const today = this.todayStr;
    const week = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    this.calendarDays = Array.from({ length: daysInMonth }, (_, index) => {
      const dayNum = index + 1;
      const dateStr = `${this.attYear}-${String(this.attMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayOfWeek = week[new Date(this.attYear, this.attMonth - 1, dayNum).getDay()];
      const isSunday = dayOfWeek === 'Sun';
      const isSaturday = dayOfWeek === 'Sat';
      const isToday = dateStr === today;
      const isFuture = dateStr > today;
      const holiday = this.holidays.find(item => dateStr >= item.startDate.split('T')[0] && dateStr <= item.endDate.split('T')[0]);
      const record = this.records.find(item => item.attendanceDate.split('T')[0] === dateStr);
      const jDate = this.studentJoiningDateStr;
      const isPriorToAdmission = !!(jDate && dateStr < jDate);

      let status = '';
      const isOff = this.isWeeklyOff(new Date(this.attYear, this.attMonth - 1, dayNum));
      if (record) {
        status = record.status;
      } else if (isPriorToAdmission) {
        status = 'PriorAdmission';
      } else if (holiday) {
        status = 'Holiday';
      } else if (isOff) {
        status = 'Sunday';
      } else if (!isFuture && dateStr < today) {
        status = 'Absent';
      }
      const checkIn = record?.checkInTime || (record as any)?.CheckInTime || null;
      const checkOut = record?.checkOutTime || (record as any)?.CheckOutTime || null;
      const duration = this.calculateDuration(checkIn, checkOut);

      return {
        dayNumber: dayNum,
        dateStr,
        dayOfWeek,
        isToday,
        isSunday,
        isSaturday,
        isWeeklyOffDay: isOff,
        isFuture,
        isPriorToAdmission,
        holiday,
        record,
        status,
        capturedTime: this.getRecordCapturedTime(record),
        checkInTime: checkIn,
        checkOutTime: checkOut,
        workDuration: duration
      };
    });
  }

  getDayTooltip(day: CalendarDay): string {
    if (day.isPriorToAdmission) {
      const joinFmt = this.currentSelectedStudent?.joiningDate ? this.formatDateDisplay(this.currentSelectedStudent.joiningDate) : '';
      return `${day.dateStr} (${day.dayOfWeek}) - Prior to Admission${joinFmt ? ` (Student admitted on ${joinFmt})` : ''} — Attendance not applicable`;
    }
    if (day.isFuture) {
      if (day.holiday) return `${day.dateStr} - ${day.holiday.title} (Future Holiday)`;
      if (day.isWeeklyOffDay || day.isSunday) return `${day.dateStr} - Weekly Off (${day.dayOfWeek}) (Future)`;
      if (day.isSaturday) return `${day.dateStr} - Saturday (Future - Class ON)`;
      return `${day.dateStr} (${day.dayOfWeek}) - Future Date (Attendance cannot be marked in advance)`;
    }
    const details: string[] = [];
    if (day.holiday) details.push(`${day.holiday.title} (${day.holiday.holidayType})${day.holiday.description ? ` - ${day.holiday.description}` : ''}`);
    if (day.isWeeklyOffDay || day.isSunday) details.push(`Weekly Off (${day.dayOfWeek})`);
    if (day.isSaturday && !day.isWeeklyOffDay && !day.record && day.status !== 'Absent') details.push('Saturday (Class ON)');
    if (day.record) {
      const timeStr = day.capturedTime ? ` (${day.capturedTime} IST)` : '';
      const punchDetails = (day.checkInTime || day.checkOutTime) ? ` [In: ${this.formatDisplayTime(day.checkInTime) || '—'}, Out: ${this.formatDisplayTime(day.checkOutTime) || '—'}${day.workDuration ? ` (${day.workDuration})` : ''}]` : '';
      details.push(`Status: ${day.status}${punchDetails}${timeStr}${day.record.remarks ? ` | ${day.record.remarks}` : ''}`);
    } else if (day.status === 'Absent') {
      const dayType = day.isSaturday ? 'Saturday class' : 'Working day';
      details.push(`Status: Absent (${dayType} passed without attendance)`);
    }

    if (!day.isToday && !day.isFuture && !this.attendancePermissions.canCorrectAttendance) {
      details.push('Locked: Past attendance requires Admin correction permission');
    }

    return details.join(' | ') || `${day.dateStr} - Unmarked`;
  }

  openDay(day: CalendarDay): void {
    if (day.isFuture) {
      this.confirmDialog.alert('Future Date', 'Advance attendance cannot be marked for future dates.', 'warning');
      return;
    }
    if (!day.isToday && !this.attendancePermissions.canCorrectAttendance) {
      this.confirmDialog.alert('Permission Denied', 'Past date attendance cannot be marked or modified without Admin Attendance Correction permission.', 'warning');
      return;
    }
    if (this.isPublicHolidayOrSunday(day.dateStr) && !this.canEditPublicHolidayOrSunday) {
      this.confirmDialog.alert('Editing Disabled', 'Sunday/Public Holiday attendance editing is disabled for this role.', 'warning');
      return;
    }
    const status = day.record?.status || (day.holiday || day.isSunday ? 'Holiday' : (day.status === 'Absent' ? 'Absent' : 'Present'));
    this.formData = {
      attendanceDate: day.dateStr,
      status: status,
      remarks: day.record?.remarks || (day.holiday?.title || (day.isSunday ? 'Sunday Weekly Off' : '')),
      checkInTime: day.checkInTime || (status !== 'Absent' && status !== 'Holiday' ? this.bulkCheckInTime : ''),
      checkOutTime: day.checkOutTime || (status !== 'Absent' && status !== 'Holiday' ? this.bulkCheckOutTime : '')
    };
    this.editingRecordId = day.record?.id || null;
    this.showForm = true;
  }

  openNewRecord(): void {
    this.formData = {
      attendanceDate: this.todayStr,
      status: 'Present',
      remarks: '',
      checkInTime: this.bulkCheckInTime || this.attendanceSettings?.studentShiftStartTime || '08:00',
      checkOutTime: this.bulkCheckOutTime || this.attendanceSettings?.studentShiftEndTime || '14:00'
    };
    this.editingRecordId = null;
    this.showForm = true;
  }

  editRecord(record: StudentAttendance): void {
    const date = record.attendanceDate.split('T')[0];
    if (this.isPublicHolidayOrSunday(date) && !this.canEditPublicHolidayOrSunday) {
      this.confirmDialog.alert('Editing Disabled', 'Sunday/Public Holiday attendance editing is disabled for this role.', 'warning');
      return;
    }
    const checkIn = record.checkInTime || (record as any).CheckInTime || '';
    const checkOut = record.checkOutTime || (record as any).CheckOutTime || '';
    this.selectedMatrixDates = new Set([date]);
    this.batchTargetStatus = record.status;
    this.batchTargetCheckIn = checkIn;
    this.batchTargetCheckOut = checkOut;
    this.batchTargetRemarks = record.remarks || '';
    const calEl = document.querySelector('.calendar-card');
    if (calEl) {
      calEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  saveAttendance(): void {
    if (!this.selectedStudentId || !this.formData.attendanceDate) return;
    const joinDateStr = this.studentJoiningDateStr;
    if (joinDateStr && this.formData.attendanceDate < joinDateStr) {
      const joinFmt = this.formatDateDisplay(joinDateStr);
      this.confirmDialog.alert(
        'Before Admission Date',
        `Cannot mark attendance for ${this.formData.attendanceDate}. Student was admitted on ${joinFmt}. Attendance prior to admission date is not allowed.`,
        'warning'
      );
      return;
    }
    if (this.formData.attendanceDate > this.todayStr) {
      this.confirmDialog.alert('Future Date', 'Cannot mark attendance for future dates.', 'warning');
      return;
    }
    if (this.formData.attendanceDate < this.todayStr && !this.attendancePermissions.canCorrectAttendance) {
      this.confirmDialog.alert('Permission Denied', 'You do not have permission to mark or modify past attendance records.', 'warning');
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
    if (this.isPublicHolidayOrSunday(this.formData.attendanceDate) && !this.canEditPublicHolidayOrSunday) {
      this.confirmDialog.alert('Editing Disabled', 'Sunday/Public Holiday attendance editing is disabled for this role.', 'warning');
      return;
    }
    this.saving = true;
    const effStatus = this.getStudentSmartStatus(this.formData.status, this.formData.checkInTime, this.formData.checkOutTime);
    this.formData.status = effStatus;
    const payload = {
      attendanceDate: this.formData.attendanceDate,
      status: effStatus,
      remarks: this.formData.remarks || null,
      checkInTime: effStatus !== 'Absent' && effStatus !== 'Holiday' ? (this.formData.checkInTime || null) : null,
      checkOutTime: effStatus !== 'Absent' && effStatus !== 'Holiday' ? (this.formData.checkOutTime || null) : null,
      stream: this.singleStreamFilter !== 'all' ? this.singleStreamFilter : null
    };
    this.http.post(`${this.api}/students/${this.selectedStudentId}/attendance`, payload).subscribe({
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
    if (this.isWeeklyOff(new Date(`${dateOnly}T00:00:00`))) return true;
    return this.holidays.some(holiday => dateOnly >= holiday.startDate.split('T')[0] && dateOnly <= holiday.endDate.split('T')[0]);
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

  formatCapturedTime(isoStr?: string | null): string {
    if (!isoStr) return 'Previously';
    try {
      let str = isoStr.trim();
      if (str.includes('T') || str.includes(' ')) {
        const hasTimezone = /[zZ]|[+-]\d{2}(?::?\d{2})?$/.test(str);
        if (!hasTimezone) {
          str = str.replace(' ', 'T') + 'Z';
        }
      }
      const d = new Date(str);
      if (isNaN(d.getTime())) return 'Previously';
      return 'at ' + d.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Previously';
    }
  }

  getPhotoUrl(path?: string | null): string {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    const base = (API_BASE || '').endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    return `${base}${cleanPath}`;
  }

  formatTimeAmPm(timeStr?: string | null): string {
    if (!timeStr) return '';
    try {
      const parts = timeStr.trim().split(':');
      if (parts.length < 2) return timeStr;
      let h = parseInt(parts[0], 10);
      const m = parts[1].padStart(2, '0');
      if (isNaN(h)) return timeStr;
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      h = h ? h : 12;
      return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
    } catch {
      return timeStr || '';
    }
  }

  isBiometricAttendance(s: BatchStudentRow | any): boolean {
    if (!s) return false;
    const src = (s.captureSource || '').toLowerCase();
    return src.includes('bio') || src.includes('hik') || src.includes('device') || src.includes('mach');
  }

  setTab(tab: 'batch' | 'single' | 'regularization'): void {
    this.activeTab = tab;
    if (tab === 'single') {
      if (this.students.length === 0) {
        this.loadStudents(false);
      } else if (this.selectedStudentId && !this.selectedStudent) {
        this.onStudentChanged();
      }
    }
    if (tab === 'regularization') {
      this.loadRegularizations();
      this.loadRegularizationStats();
    }
  }

  setRegStatusFilter(status: string): void {
    this.regFilterStatus = status;
    this.loadRegularizations();
  }

  getRegCategoryLabel(cat: string): string {
    switch (cat) {
      case 'OnDuty': return '🏆 On-Duty (OD)';
      case 'Medical': return '🩺 Medical';
      case 'RollCallError': return '📋 Roll Call Error';
      case 'PunchMiss': return '⏱️ RFID Miss';
      default: return '📝 ' + cat;
    }
  }

  loadRegularizations(): void {
    this.regularizationLoading = true;
    let params: any = {};
    if (this.regFilterStatus !== 'All') params.status = this.regFilterStatus;
    if (this.regSearchQuery.trim()) params.search = this.regSearchQuery.trim();

    this.http.get<StudentAttendanceRegularizationDto[]>(`${this.api}/student-regularizations`, { params }).subscribe({
      next: (list) => {
        this.regularizations = list || [];
        this.regularizationLoading = false;
      },
      error: () => {
        this.regularizations = [];
        this.regularizationLoading = false;
      }
    });

    this.loadRegularizationStats();
  }

  loadRegularizationStats(): void {
    this.http.get<{ totalRequests: number; pendingRequests: number; approvedRequests: number; rejectedRequests: number }>(
      `${this.api}/student-regularizations/stats`,
      { headers: { 'X-Skip-Loader': 'true' } }
    ).subscribe({
      next: (stats) => {
        if (stats) this.regularizationStats = stats;
      },
      error: () => {}
    });
  }

  openApplyRegularization(student?: any, dateStr?: string): void {
    const dialogRef = this.dialog.open(ApplyStudentRegularizationDialogComponent, {
      width: '650px',
      data: {
        studentId: student?.id || student?.studentId,
        studentName: student?.studentName,
        rollNumber: student?.rollNumber,
        className: student?.className,
        sectionName: student?.sectionName,
        attendanceDate: dateStr
      }
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res) {
        this.loadRegularizations();
        this.loadRegularizationStats();
        if (this.activeTab === 'single' && this.selectedStudentId) {
          this.loadAttendance();
        }
      }
    });
  }

  openReviewRegularization(reg: StudentAttendanceRegularizationDto): void {
    const dialogRef = this.dialog.open(ReviewStudentRegularizationDialogComponent, {
      width: '600px',
      data: reg
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res) {
        this.loadRegularizations();
        this.loadRegularizationStats();
        if (this.rollCallScope === 'school' && this.selectedClassId) {
          this.loadSchoolAttendance();
        }
        if (this.selectedStudentId) {
          this.loadAttendance();
        }
      }
    });
  }

  deleteRegularization(reg: StudentAttendanceRegularizationDto): void {
    if (!confirm(`Are you sure you want to cancel the regularization request for ${reg.studentName} on ${reg.attendanceDate}?`)) {
      return;
    }

    this.http.delete(`${this.api}/student-regularizations/${reg.id}`).subscribe({
      next: () => {
        this.loadRegularizations();
        this.loadRegularizationStats();
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to cancel request.');
      }
    });
  }

  // ================= MULTI-DATE SELECTION METHODS =================

  isWeeklyOff(day: CalendarDay | Date): boolean {
    const date: Date = day instanceof Date ? day : new Date(`${day.dateStr}T00:00:00`);
    const p = this.attendanceSettings?.studentWeeklyOffPattern || 'SundayOnly';
    const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat
    if (dayOfWeek === 0) return true; // Sunday is always off

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

  isDateSelectable(day: CalendarDay): boolean {
    if (day.isPriorToAdmission) return false;
    const jDate = this.studentJoiningDateStr;
    if (jDate && day.dateStr < jDate) return false;
    if (day.isFuture) return false;
    if (this.isWeeklyOff(day)) return false;
    if (day.holiday) return false;
    if (!this.attendancePermissions.canManualMark) return false;
    if (this.attendanceMode === 'Biometric') return false;
    if (!day.isToday && !this.attendancePermissions.canCorrectAttendance) return false;
    return true;
  }

  /** Click on a calendar day cell: if selectable toggle selection, else show informative alert */
  onDayCellClick(day: CalendarDay, event: MouseEvent): void {
    if (day.isPriorToAdmission) {
      const joinFmt = this.currentSelectedStudent?.joiningDate ? this.formatDateDisplay(this.currentSelectedStudent.joiningDate) : '';
      this.confirmDialog.alert(
        'Prior to Admission',
        `Student was admitted on ${joinFmt || day.dateStr}. Attendance prior to the admission date is not applicable.`,
        'info'
      );
      return;
    }
    if (this.isDateSelectable(day)) {
      this.toggleDateSelect(day);
    } else {
      if (day.isFuture) {
        this.confirmDialog.alert('Future Date', 'Advance attendance cannot be marked for future dates.', 'warning');
      } else if (day.holiday) {
        this.confirmDialog.alert('Official Holiday', `${day.holiday.title || 'Official Holiday'} on ${this.formatDateDisplay(day.dateStr)}.`, 'info');
      } else if (day.isWeeklyOffDay || day.isSunday) {
        this.confirmDialog.alert('Weekly Off', `${day.dayOfWeek} Weekly Off on ${this.formatDateDisplay(day.dateStr)}.`, 'info');
      } else if (!this.attendancePermissions.canCorrectAttendance) {
        this.confirmDialog.alert('Permission Denied', 'Past date attendance cannot be modified without Attendance Correction permission.', 'warning');
      }
    }
  }

  getSelectedDateSummaryTitle(): string {
    if (this.selectedMatrixDates.size === 1) {
      const dateStr = Array.from(this.selectedMatrixDates)[0];
      return `${this.formatDateDisplay(dateStr)} (Single Day)`;
    }
    return `${this.selectedMatrixDates.size} Dates Selected (Multi)`;
  }

  toggleDateSelect(day: CalendarDay): void {
    if (!this.isDateSelectable(day)) return;
    if (this.selectedMatrixDates.has(day.dateStr)) {
      this.selectedMatrixDates.delete(day.dateStr);
    } else {
      this.selectedMatrixDates.add(day.dateStr);
      // Pre-fill floating bar if single day selected
      if (this.selectedMatrixDates.size === 1) {
        if (day.record?.status) {
          this.batchTargetStatus = day.record.status;
        } else if (day.status && day.status !== 'Unmarked' && day.status !== '-') {
          this.batchTargetStatus = day.status === 'HalfDay' ? 'HalfDay' : (day.status as any);
        }
        if (day.checkInTime) this.batchTargetCheckIn = day.checkInTime;
        if (day.checkOutTime) this.batchTargetCheckOut = day.checkOutTime;
        if (day.record?.remarks) this.batchTargetRemarks = day.record.remarks;
      }
    }
    // Trigger change detection on the Set
    this.selectedMatrixDates = new Set(this.selectedMatrixDates);
  }

  selectAllWorkingDays(): void {
    const selectable = this.calendarDays.filter(d => this.isDateSelectable(d));
    this.selectedMatrixDates = new Set(selectable.map(d => d.dateStr));
  }

  selectAllAbsentDays(): void {
    const absentSelectable = this.calendarDays.filter(d =>
      this.isDateSelectable(d) && (d.status === 'Absent' || !d.record)
    );
    this.selectedMatrixDates = new Set(absentSelectable.map(d => d.dateStr));
  }

  clearDateSelection(): void {
    this.selectedMatrixDates = new Set();
    this.batchTargetStatus = 'Present';
    this.batchTargetRemarks = '';
  }

  applyMultiDatesAttendance(): void {
    if (this.selectedMatrixDates.size === 0) {
      this.confirmDialog.alert('No Dates Selected', 'Please select at least one date to apply attendance.', 'warning');
      return;
    }
    if (!this.batchTargetStatus) {
      this.confirmDialog.alert('Status Required', 'Please choose an attendance status (Present, Absent, etc.).', 'warning');
      return;
    }
    if (!this.selectedStudentId) {
      this.confirmDialog.alert('No Student', 'Please select a student first.', 'warning');
      return;
    }

    const dates = Array.from(this.selectedMatrixDates).sort();

    this.batchSavingDates = true;

    const effStatus = this.getStudentSmartStatus(this.batchTargetStatus, this.batchTargetCheckIn, this.batchTargetCheckOut);
    this.batchTargetStatus = effStatus;

    const payload = {
      attendanceDates: dates,
      status: effStatus,
      remarks: this.batchTargetRemarks || null,
      checkInTime: effStatus !== 'Absent' && effStatus !== 'Leave' ? (this.batchTargetCheckIn || null) : null,
      checkOutTime: effStatus !== 'Absent' && effStatus !== 'Leave' ? (this.batchTargetCheckOut || null) : null,
      stream: this.singleStreamFilter !== 'all' ? this.singleStreamFilter : null
    };

    this.http.post(
      `${this.api}/students/${this.selectedStudentId}/attendance/multi-dates`,
      payload
    ).subscribe({
      next: (res: any) => {
        this.batchSavingDates = false;
        const isSingle = dates.length === 1;
        const msg = res?.message || (isSingle
          ? `Attendance for ${this.formatDateDisplay(dates[0])} saved as "${this.batchTargetStatus}" successfully.`
          : `Attendance marked as "${this.batchTargetStatus}" for ${dates.length} date(s) successfully.`);
        this.clearDateSelection();
        this.loadAttendance();
        this.confirmDialog.alert(isSingle ? 'Attendance Saved' : 'Bulk Attendance Saved', msg, 'success');
      },
      error: err => {
        this.batchSavingDates = false;
        this.confirmDialog.alert(
          'Save Failed',
          err?.error?.message || 'Failed to save attendance. Please try again.',
          'danger'
        );
      }
    });
  }

  getSelectableDaysCount(): number {
    return this.calendarDays.filter(d => this.isDateSelectable(d)).length;
  }

  saveStudentMonthlyRegister(): void {
    if (!this.selectedStudentId) {
      this.confirmDialog.alert('No Student', 'Please select a student first.', 'warning');
      return;
    }
    const selectableDays = this.calendarDays.filter(d => this.isDateSelectable(d));
    if (selectableDays.length === 0) {
      this.confirmDialog.alert('No Working Days', 'No eligible working days found in this month.', 'warning');
      return;
    }

    const presentCount = this.selectedMatrixDates.size;
    const absentCount = selectableDays.length - presentCount;

    this.batchSavingDates = true;
    const payload = {
      month: this.attMonth,
      year: this.attYear,
      defaultCheckInTime: this.batchTargetCheckIn || '08:00',
      defaultCheckOutTime: this.batchTargetCheckOut || '14:00',
      stream: this.singleStreamFilter !== 'all' ? this.singleStreamFilter : null,
      days: selectableDays.map(d => ({
        date: d.dateStr,
        isPresent: this.selectedMatrixDates.has(d.dateStr),
        checkInTime: this.selectedMatrixDates.has(d.dateStr) ? (this.batchTargetCheckIn || '08:00') : null,
        checkOutTime: this.selectedMatrixDates.has(d.dateStr) ? (this.batchTargetCheckOut || '14:00') : null,
        remarks: this.selectedMatrixDates.has(d.dateStr) ? 'Monthly Register (Present)' : 'Monthly Register (Absent)'
      }))
    };

    this.http.post(
      `${this.api}/students/${this.selectedStudentId}/attendance/monthly-register`,
      payload
    ).subscribe({
      next: (res: any) => {
        this.batchSavingDates = false;
        this.clearDateSelection();
        this.loadAttendance();
        this.confirmDialog.alert('Monthly Register Saved', res?.message || `Saved: ${presentCount} Present, ${absentCount} Absent.`, 'success');
      },
      error: err => {
        this.batchSavingDates = false;
        this.confirmDialog.alert('Save Failed', err?.error?.message || 'Failed to save monthly register.', 'danger');
      }
    });
  }
}
