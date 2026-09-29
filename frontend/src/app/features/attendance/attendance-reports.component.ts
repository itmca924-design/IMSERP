import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { API_BASE } from '../teachers/teacher.models';
import { AuthService } from '../../core/services/auth.service';
import { SchoolService, SchoolClassDto, SchoolSectionDto } from '../../core/services/school.service';

interface ReportRow {
  personId: string;
  personName: string;
  code: string;
  groupName: string;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  holidayDays: number;
  totalWorkingDays: number;
  attendancePercentage: number;
  schoolClass?: string | null;
  coachingBatch?: string | null;
  schoolRoll?: string | null;
  coachingRoll?: string | null;
  isSchoolStudent?: boolean;
  isCoachingStudent?: boolean;
}

interface AttendanceReport {
  reportType: string;
  month: number;
  year: number;
  totalPeople: number;
  totalPresentDays: number;
  totalAbsentDays: number;
  totalLateDays: number;
  totalHalfDays: number;
  totalHolidayDays: number;
  totalWorkingDaysInMonth?: number;
  rows: ReportRow[];
  isDualEnrolled?: boolean;
  defaultStream?: string | null;
}

interface DailyDayItem {
  day: number;
  dayOfWeek: string;
  isSunday: boolean;
  status: string;
  label: string;
}

@Component({
  selector: 'app-attendance-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule
  ],
  template: `
<div class="report-page">
  <!-- Page Header -->
  <div class="page-header no-print">
    <div class="header-titles">
      <h1>
        <mat-icon>summarize</mat-icon>
        {{ isStudentOrParent ? 'My Monthly Attendance Report' : (reportType === 'student' ? 'Student Attendance Reports & Analytics' : 'Faculty Attendance Reports & Analytics') }}
      </h1>
      <p>{{ isStudentOrParent ? 'Your personal monthly attendance percentage, working days, and day-by-day status matrix.' : 'Comprehensive monthly attendance matrix, compliance tracking, and register analytics.' }}</p>
    </div>
    <div class="header-actions">
      <button mat-stroked-button class="action-btn" (click)="exportCsv()">
        <mat-icon>download</mat-icon> Export CSV
      </button>
      <button mat-raised-button color="primary" class="action-btn" (click)="printReport()">
        <mat-icon>print</mat-icon> Print Report
      </button>
    </div>
  </div>

  <!-- Dual Mode Switcher (Student vs Teacher) - Hidden for Student/Parent -->
  @if (!isStudentOrParent) {
    <div class="report-type-bar no-print">
      <button type="button" class="type-btn" [class.active]="reportType === 'student'" (click)="changeReportType('student')">
        <mat-icon>groups</mat-icon>
        <div class="type-text">
          <strong>Student Attendance Register</strong>
          <small>Batch-wise monthly registers, roll numbers &amp; daily matrix</small>
        </div>
      </button>
      <button type="button" class="type-btn" [class.active]="reportType === 'teacher'" (click)="changeReportType('teacher')">
        <mat-icon>badge</mat-icon>
        <div class="type-text">
          <strong>Teacher / Faculty Register</strong>
          <small>Faculty attendance, punctuality &amp; working days</small>
        </div>
      </button>
    </div>
  }

  <!-- Filter & Control Card -->
  <div class="filter-card no-print">
    <div class="filters-row">
      <!-- Search Box (only for staff/teachers with multiple students) -->
      @if (!isStudentOrParent) {
        <div class="search-input-wrap">
          <mat-icon>search</mat-icon>
          <input type="text" [(ngModel)]="searchQuery" [placeholder]="reportType === 'student' ? 'Search student by name, roll no, batch...' : 'Search teacher by name, code...'">
          <button *ngIf="searchQuery" class="clear-search-btn" (click)="searchQuery = ''">✕</button>
        </div>
      }

      <!-- Month Selector -->
      <div class="filter-select-wrap">
        <label>Month:</label>
        <select [(ngModel)]="selectedMonth" (change)="loadReport()">
          <option *ngFor="let month of months; let i = index" [value]="i + 1">{{ month }}</option>
        </select>
      </div>

      <!-- Year Selector -->
      <div class="filter-select-wrap">
        <label>Year:</label>
        <select [(ngModel)]="selectedYear" (change)="loadReport()">
          <option *ngFor="let year of years" [value]="year">{{ year }}</option>
        </select>
      </div>

      <!-- Dual Enrolled Student Stream Switcher (School vs Coaching vs Combined) -->
      @if (isStudentOrParent && isDualStudent) {
        <div class="filter-stream-pill-wrap">
          <label>Stream:</label>
          <div class="stream-pill-group">
            <button type="button" class="stream-tab-btn" [class.active]="studentStreamMode === 'all'" (click)="setStudentStream('all')">
              <mat-icon>hub</mat-icon>
              <span>🌐 All (Combined)</span>
            </button>
            <button type="button" class="stream-tab-btn" [class.active]="studentStreamMode === 'school'" (click)="setStudentStream('school')">
              <mat-icon>domain</mat-icon>
              <span>🏫 School Class</span>
            </button>
            <button type="button" class="stream-tab-btn" [class.active]="studentStreamMode === 'coaching'" (click)="setStudentStream('coaching')">
              <mat-icon>school</mat-icon>
              <span>📚 Coaching Batch</span>
            </button>
          </div>
        </div>
      }

      <!-- Category / Stream Filter (Staff/Teacher only) -->
      @if (!isStudentOrParent && reportType === 'student') {
        <div class="filter-select-wrap">
          <label>Category:</label>
          <select [(ngModel)]="studentFilterMode" (change)="onFilterModeChanged()">
            <option value="all">All Students</option>
            <option value="school">🏫 School Classes</option>
            <option value="coaching">📚 Coaching Batches</option>
          </select>
        </div>

        <!-- School Class Filter -->
        <div class="filter-select-wrap" *ngIf="studentFilterMode === 'school'">
          <label>Class:</label>
          <select [(ngModel)]="selectedClassId" (change)="onClassFilterChanged()">
            <option value="">All Classes</option>
            <option *ngFor="let c of schoolClasses" [value]="c.id">{{ c.name }}</option>
          </select>
        </div>

        <!-- School Section Filter -->
        <div class="filter-select-wrap" *ngIf="studentFilterMode === 'school' && selectedClassId">
          <label>Section:</label>
          <select [(ngModel)]="selectedSectionId" (change)="loadReport()">
            <option value="">All Sections</option>
            <option *ngFor="let s of classSections" [value]="s.id">Section {{ s.name }}</option>
          </select>
        </div>

        <!-- Batch Filter (Coaching only) -->
        <div class="filter-select-wrap" *ngIf="studentFilterMode === 'coaching'">
          <label>Batch:</label>
          <select [(ngModel)]="selectedBatchId" (change)="loadReport()">
            <option value="">All Batches</option>
            <option *ngFor="let batch of batches" [value]="batch.id">{{ batch.name }}</option>
          </select>
        </div>
      }

      <!-- Bulk Expand / Collapse Matrix Button -->
      <button mat-stroked-button class="matrix-bulk-btn" (click)="toggleExpandAll()">
        <mat-icon>{{ expandAll ? 'unfold_less' : 'grid_view' }}</mat-icon>
        <span>{{ expandAll ? 'Collapse Matrix' : 'Expand 30-Day Matrix' }}</span>
      </button>
    </div>
  </div>

  <!-- Print Heading (Only visible in Print) -->
  <div class="print-heading">
    <div class="print-brand-info">
      <div class="print-logo-mark" [class.has-img]="logoUrl && !logoFailed">
        <img *ngIf="logoUrl && !logoFailed" [src]="logoUrl" (error)="logoFailed = true" alt="Logo" class="inst-logo-img">
        <mat-icon *ngIf="!logoUrl || logoFailed">school</mat-icon>
      </div>
      <div>
        <h2>{{ instituteName }}</h2>
        <div class="print-report-title">{{ isStudentOrParent ? 'Student Attendance Report' : (reportType === 'student' ? 'Student Attendance Report' : 'Faculty Attendance Report') }}</div>
        <span *ngIf="reportType === 'student'" class="print-batch-sub">{{ getSelectedFilterSubTitle() }}</span>
      </div>
    </div>
    <div class="print-period-badge">{{ months[selectedMonth - 1] }} {{ selectedYear }}</div>
  </div>

  <!-- Progress Bar -->
  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

  <!-- KPI Analytics Cards -->
  <div class="kpi-grid" *ngIf="report">
    <div class="kpi-card kpi-total">
      <div class="kpi-icon-box"><mat-icon>{{ isStudentOrParent ? 'calendar_month' : (reportType === 'student' ? 'school' : 'badge') }}</mat-icon></div>
      <div class="kpi-data">
        <span class="kpi-label">{{ isStudentOrParent ? 'Total Working Days' : ('Total ' + (reportType === 'student' ? 'Students' : 'Faculty')) }}</span>
        <span class="kpi-val">{{ isStudentOrParent ? (totalWorkingDaysInMonth + ' Days') : report.totalPeople }}</span>
      </div>
    </div>

    <div class="kpi-card kpi-present">
      <div class="kpi-icon-box"><mat-icon>check_circle</mat-icon></div>
      <div class="kpi-data">
        <span class="kpi-label">{{ isStudentOrParent ? 'My Present Days' : 'Total Present' }}</span>
        <span class="kpi-val">{{ isStudentOrParent ? (report.totalPresentDays + ' Days') : report.totalPresentDays }}</span>
      </div>
    </div>

    <div class="kpi-card kpi-absent">
      <div class="kpi-icon-box"><mat-icon>cancel</mat-icon></div>
      <div class="kpi-data">
        <span class="kpi-label">{{ isStudentOrParent ? 'My Absent Days' : 'Total Absent' }}</span>
        <span class="kpi-val">{{ isStudentOrParent ? (report.totalAbsentDays + ' Days') : report.totalAbsentDays }}</span>
      </div>
    </div>

    <div class="kpi-card kpi-late">
      <div class="kpi-icon-box"><mat-icon>schedule</mat-icon></div>
      <div class="kpi-data">
        <span class="kpi-label">{{ isStudentOrParent ? 'My Late Days' : 'Late Days' }}</span>
        <span class="kpi-val">{{ isStudentOrParent ? (report.totalLateDays + ' Days') : report.totalLateDays }}</span>
      </div>
    </div>

    <div class="kpi-card kpi-avg">
      <div class="kpi-icon-box"><mat-icon>donut_large</mat-icon></div>
      <div class="kpi-data">
        <span class="kpi-label">{{ isStudentOrParent ? 'My Attendance %' : 'Avg Attendance' }}</span>
        <span class="kpi-val">{{ overallAttendanceRate }}%</span>
      </div>
    </div>
  </div>

  <!-- Attendance Table Card -->
  <div class="table-responsive-container" *ngIf="report">
    <div class="table-toolbar no-print">
      <div class="toolbar-left">
        <strong>{{ reportType === 'student' ? 'Student Monthly Register' : 'Faculty Monthly Register' }}</strong>
        <span class="count-chip">{{ filteredRows.length }} {{ reportType === 'student' ? 'students' : 'teachers' }}</span>
      </div>
      <div class="toolbar-right" *ngIf="searchQuery">
        <span class="search-hint">Showing results for "{{ searchQuery }}"</span>
      </div>
    </div>

    <table class="report-table">
      <thead>
        <tr>
          <th style="min-width: 220px;">{{ reportType === 'student' ? 'Student Name' : 'Faculty Name' }}</th>
          <th style="min-width: 110px;">{{ reportType === 'student' ? 'Roll No.' : 'Code' }}</th>
          <th class="text-center" style="min-width: 70px;">Present</th>
          <th class="text-center" style="min-width: 70px;">Absent</th>
          <th class="text-center" style="min-width: 70px;">Late</th>
          <th class="text-center" style="min-width: 75px;">Half Days</th>
          <th class="text-center" style="min-width: 80px;">Off/Sundays</th>
          <th class="text-center" style="min-width: 85px;">Working Days</th>
          <th class="text-center" style="min-width: 170px;">Attendance %</th>
          <th class="text-center no-print" style="min-width: 130px;">Daily Matrix</th>
        </tr>
      </thead>
      <tbody>
        <ng-container *ngFor="let row of filteredRows">
          <tr class="person-main-row" [class.expanded-row]="isExpanded(row.personId)">
            <td>
              <div class="person-name-cell">
                <div class="avatar-circle">{{ getInitials(row.personName) }}</div>
                <div>
                  <div class="name-line">
                    <span class="name-bold">{{ row.personName }}</span>
                    <span class="badge-dual-enrolled" *ngIf="isStudentOrParent && row.isSchoolStudent && row.isCoachingStudent">
                      ★ Dual Enrolled
                    </span>
                  </div>
                  <span class="role-sub">{{ row.groupName || (reportType === 'student' ? 'No Batch' : 'Faculty') }}</span>
                  <div class="dual-extra-note" *ngIf="isStudentOrParent && row.isSchoolStudent && row.isCoachingStudent">
                    <span class="other-stream-text" *ngIf="studentStreamMode === 'school' && row.coachingBatch">
                      📚 Evening Batch: <strong>{{ row.coachingBatch }}</strong> (Roll: {{ row.coachingRoll || 'N/A' }})
                    </span>
                    <span class="other-stream-text" *ngIf="studentStreamMode === 'coaching' && row.schoolClass">
                      🏫 Morning School: <strong>{{ row.schoolClass }}</strong> (Roll: {{ row.schoolRoll || 'N/A' }})
                    </span>
                  </div>
                </div>
              </div>
            </td>
            <td style="white-space: nowrap;">
              <span class="code-badge">{{ row.code || 'N/A' }}</span>
            </td>
            <td class="text-center text-emerald">
              <span class="stat-pill pill-present"><strong>{{ row.presentDays }}</strong></span>
            </td>
            <td class="text-center text-rose">
              <span class="stat-pill pill-absent"><strong>{{ row.absentDays }}</strong></span>
            </td>
            <td class="text-center text-amber">
              <span class="stat-pill pill-late"><strong>{{ row.lateDays }}</strong></span>
            </td>
            <td class="text-center text-purple">
              <span class="stat-pill pill-half"><strong>{{ row.halfDays }}</strong></span>
            </td>
            <td class="text-center">
              <span class="stat-pill pill-off">{{ row.holidayDays }}</span>
            </td>
            <td class="text-center">
              <span class="stat-pill pill-work">{{ row.totalWorkingDays }}</span>
            </td>
            <td>
              <div class="attendance-calc-cell">
                <div class="pct-top-row">
                  <span class="pct-value" [style.color]="getPctColor(row.attendancePercentage)">
                    {{ row.attendancePercentage }}%
                  </span>
                  <span class="pct-compliance-badge" [ngClass]="row.attendancePercentage >= 75 ? 'badge-good' : row.attendancePercentage >= 50 ? 'badge-warn' : 'badge-low'">
                    {{ row.attendancePercentage >= 75 ? 'Good' : row.attendancePercentage >= 50 ? 'Moderate' : 'Low' }}
                  </span>
                </div>
                <div class="pct-bar-bg">
                  <div class="pct-bar-fill"
                    [style.width.%]="row.attendancePercentage"
                    [style.background]="getPctColor(row.attendancePercentage)">
                  </div>
                </div>
                <div class="pct-sub-text">
                  {{ row.presentDays + row.lateDays }} / {{ row.totalWorkingDays }} days attended
                </div>
              </div>
            </td>
            <td class="text-center no-print">
              <button mat-stroked-button class="matrix-action-btn"
                [class.matrix-open]="isExpanded(row.personId)"
                (click)="toggleCalendar(row.personId)">
                <mat-icon>{{ isExpanded(row.personId) ? 'expand_less' : 'calendar_month' }}</mat-icon>
                <span>{{ isExpanded(row.personId) ? 'Hide Matrix' : 'Daily Matrix' }}</span>
              </button>
            </td>
          </tr>

          <!-- EXPANDED 30-DAY CALENDAR MATRIX DRAWER -->
          <tr *ngIf="isExpanded(row.personId)" class="matrix-drawer-row no-print">
            <td colspan="10" class="matrix-drawer-container">
              <div class="matrix-drawer-card">
                <div class="md-header">
                  <div class="md-title-left">
                    <mat-icon class="md-icon">date_range</mat-icon>
                    <div>
                      <strong class="md-title">{{ months[selectedMonth - 1] }} {{ selectedYear }} Daily Attendance Strip</strong>
                      <span class="md-subtitle">{{ row.personName }} ({{ row.code }}) • 1 to {{ getDaysInMonth() }} {{ months[selectedMonth - 1] }}</span>
                    </div>
                  </div>
                  <div class="md-summary-chips">
                    <span class="md-chip chip-p">🟢 Present: {{ row.presentDays }}</span>
                    <span class="md-chip chip-leave" *ngIf="getLeaveDays(row) > 0">🟠 Leave: {{ getLeaveDays(row) }}</span>
                    <span class="md-chip chip-l">🟡 Late: {{ row.lateDays }}</span>
                    <span class="md-chip chip-a">🔴 Absent: {{ row.absentDays }}</span>
                    <span class="md-chip chip-hd">🟣 Half: {{ row.halfDays }}</span>
                    <span class="md-chip chip-off">⚪ Sun/Off: {{ row.holidayDays }}</span>
                    <span class="md-chip chip-unmarked">➖ Unmarked: {{ getUnmarkedDays(row) }}</span>
                  </div>
                </div>

                <!-- Day Cards Horizontal Strip -->
                <div class="daily-strip-container">
                  <div class="day-card" *ngFor="let d of getDailyMatrix(row)"
                    [ngClass]="'day-' + d.status.toLowerCase()"
                    [class.day-is-sunday]="d.isSunday"
                    [matTooltip]="d.label">
                    <span class="day-card-num">{{ d.day < 10 ? '0' + d.day : d.day }}</span>
                    <span class="day-card-name">{{ d.dayOfWeek }}</span>
                    <span class="day-card-badge">{{ d.status }}</span>
                  </div>
                </div>

                <!-- Legend Footer -->
                <div class="matrix-legend">
                  <span class="leg-item"><span class="leg-dot dot-p"></span> <strong>P</strong> = Present</span>
                  <span class="leg-item"><span class="leg-dot dot-l"></span> <strong>L</strong> = Sanctioned Leave</span>
                  <span class="leg-item"><span class="leg-dot dot-lt"></span> <strong>LT</strong> = Late Arrival</span>
                  <span class="leg-item"><span class="leg-dot dot-a"></span> <strong>A</strong> = Absent</span>
                  <span class="leg-item"><span class="leg-dot dot-hd"></span> <strong>HD</strong> = Half Day</span>
                  <span class="leg-item"><span class="leg-dot dot-off"></span> <strong>OFF</strong> = Sunday / Holiday</span>
                  <span class="leg-item"><span class="leg-dot dot-unmarked"></span> <strong>—</strong> = Unmarked / Future Date</span>
                </div>
              </div>
            </td>
          </tr>
        </ng-container>

        <tr *ngIf="filteredRows.length === 0">
          <td colspan="10" class="empty-table-cell">
            <div class="empty-state">
              <mat-icon>search_off</mat-icon>
              <strong>No attendance records found</strong>
              <p *ngIf="searchQuery">No results match your search "{{ searchQuery }}". Try clearing the filter.</p>
              <p *ngIf="!searchQuery">No attendance marked for this month/batch yet.</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
  `,
  styles: [`
    .report-page { display:flex; flex-direction:column; gap:16px; padding-bottom:30px; }

    /* Page Header */
    .page-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; }
    .header-titles h1 { display:flex; align-items:center; gap:8px; margin:0; color:#0284c7; font-size:1.4rem; font-weight:800; }
    .header-titles h1 mat-icon { font-size:26px; width:26px; height:26px; color:#0284c7; }
    .header-titles p { margin:3px 0 0; color:#64748b; font-size:.86rem; }
    .header-actions { display:flex; align-items:center; gap:8px; }
    .action-btn { display:inline-flex; align-items:center; gap:6px; font-weight:600; border-radius:8px; }

    /* Dual Mode Switcher Bar */
    .report-type-bar { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .type-btn { display:flex; align-items:center; gap:12px; padding:12px 18px; border:1.5px solid #e2e8f0; background:#fff; border-radius:10px; cursor:pointer; text-align:left; transition:all .2s; }
    .type-btn:hover { border-color:#93c5fd; background:#f8fafc; }
    .type-btn.active { border-color:#0284c7; background:#f0f9ff; box-shadow:0 2px 8px rgba(2,132,199,0.12); }
    .type-btn mat-icon { font-size:28px; width:28px; height:28px; color:#64748b; }
    .type-btn.active mat-icon { color:#0284c7; }
    .type-text strong { display:block; font-size:.92rem; color:#1e293b; font-weight:700; }
    .type-btn.active .type-text strong { color:#0284c7; }
    .type-text small { font-size:.76rem; color:#64748b; }

    /* Filter Card */
    .filter-card { background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0; padding:12px 16px; }
    .filters-row { display:flex; align-items:center; flex-wrap:wrap; gap:12px; }
    .search-input-wrap { display:flex; align-items:center; gap:8px; background:#fff; border:1.5px solid #cbd5e1; border-radius:8px; padding:6px 12px; flex:1; min-width:240px; }
    .search-input-wrap mat-icon { color:#94a3b8; font-size:20px; width:20px; height:20px; }
    .search-input-wrap input { border:none; outline:none; font-size:.88rem; color:#1e293b; width:100%; }
    .clear-search-btn { border:none; background:transparent; cursor:pointer; font-size:.8rem; color:#94a3b8; padding:0 4px; }
    .clear-search-btn:hover { color:#1e293b; }

    .filter-select-wrap { display:flex; align-items:center; gap:8px; font-size:.84rem; font-weight:600; color:#475569; }
    .filter-select-wrap select { border:1.5px solid #cbd5e1; border-radius:8px; padding:6px 12px; font-size:.86rem; font-weight:600; color:#1e293b; background:#fff; outline:none; }

    .matrix-bulk-btn { border-radius:8px; font-weight:700; font-size:.82rem; height:38px; border-color:#0284c7; color:#0284c7; background:#f0f9ff; display:flex; align-items:center; gap:6px; margin-left:auto; }
    .matrix-bulk-btn:hover { background:#e0f2fe; }
    .matrix-bulk-btn mat-icon { font-size:18px; width:18px; height:18px; }

    /* KPI Cards Grid */
    .kpi-grid { display:grid; grid-template-columns:repeat(5, 1fr); gap:12px; }
    .kpi-card { background:#fff; border-radius:10px; border:1px solid #e2e8f0; padding:12px 14px; display:flex; align-items:center; gap:12px; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
    .kpi-icon-box { width:42px; height:42px; border-radius:8px; display:flex; align-items:center; justify-content:center; }
    .kpi-icon-box mat-icon { font-size:22px; width:22px; height:22px; }
    .kpi-total .kpi-icon-box { background:#eff6ff; color:#2563eb; }
    .kpi-present .kpi-icon-box { background:#ecfdf5; color:#059669; }
    .kpi-absent .kpi-icon-box { background:#fff1f2; color:#e11d48; }
    .kpi-late .kpi-icon-box { background:#fffbeb; color:#d97706; }
    .kpi-avg .kpi-icon-box { background:#faf5ff; color:#7c3aed; }
    .kpi-data { display:flex; flex-direction:column; gap:2px; }
    .kpi-label { font-size:.74rem; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.4px; }
    .kpi-val { font-size:1.35rem; font-weight:800; color:#0f172a; line-height:1.2; }

    /* Table Toolbar */
    .table-responsive-container { background:#fff; border-radius:10px; border:1px solid #e2e8f0; overflow-x:auto; -webkit-overflow-scrolling:touch; box-shadow:0 1px 3px rgba(0,0,0,0.03); }
    .table-toolbar { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:#f8fafc; border-bottom:1px solid #e2e8f0; }
    .toolbar-left { display:flex; align-items:center; gap:8px; font-size:.9rem; color:#1e293b; }
    .count-chip { background:#e2e8f0; color:#334155; font-size:.75rem; font-weight:700; padding:2px 8px; border-radius:12px; }
    .search-hint { font-size:.8rem; color:#0284c7; font-weight:600; }

    /* Table Styles */
    .report-table { width:100%; border-collapse:collapse; min-width:1120px; }
    .report-table th, .report-table td { padding:12px 14px; font-size:.86rem; border-bottom:1px solid #f1f5f9; text-align:left; vertical-align:middle; }
    .report-table thead th { background:#f8fafc; font-weight:700; color:#334155; border-bottom:2px solid #e2e8f0; white-space:nowrap; }
    .report-table tbody tr:hover { background:#f8faff; }

    .text-center { text-align:center !important; }
    .text-emerald { color:#059669; }
    .text-rose { color:#e11d48; }
    .text-amber { color:#d97706; }
    .text-purple { color:#7c3aed; }

    /* Person Cell & Avatar */
    .person-name-cell { display:flex; align-items:center; gap:10px; }
    .avatar-circle { width:36px; height:36px; border-radius:50%; background:#e0f2fe; color:#0284c7; font-weight:700; font-size:.88rem; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .name-bold { font-weight:700; color:#0f172a; display:block; font-size:.9rem; }
    .role-sub { font-size:.74rem; color:#64748b; display:block; }

    /* Code / Roll Badge (Single Line Crisp) */
    .code-badge { display:inline-block; white-space:nowrap; background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; padding:2px 6px; border-radius:5px; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:.72rem; font-weight:700; letter-spacing:.2px; }

    /* Stat Pills */
    .stat-pill { display:inline-flex; align-items:center; justify-content:center; min-width:32px; padding:2px 8px; border-radius:6px; font-size:.84rem; font-weight:700; }
    .pill-present { background:#ecfdf5; color:#059669; }
    .pill-absent { background:#fff1f2; color:#e11d48; }
    .pill-late { background:#fef3c7; color:#d97706; }
    .pill-half { background:#f5f3ff; color:#7c3aed; }
    .pill-off { background:#f1f5f9; color:#64748b; font-weight:600; }
    .pill-work { background:#e0f2fe; color:#0369a1; font-weight:800; }

    /* Attendance % Progress Cell */
    .attendance-calc-cell { display:flex; flex-direction:column; gap:4px; min-width:140px; }
    .pct-top-row { display:flex; justify-content:space-between; align-items:center; }
    .pct-value { font-weight:800; font-size:.95rem; }
    .pct-compliance-badge { font-size:.68rem; font-weight:700; padding:1px 6px; border-radius:4px; }
    .badge-good { background:#dcfce7; color:#15803d; }
    .badge-warn { background:#fef3c7; color:#b45309; }
    .badge-low { background:#fee2e2; color:#b91c1c; }
    .pct-bar-bg { height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden; width:100%; }
    .pct-bar-fill { height:100%; border-radius:3px; transition:width .4s ease; }
    .pct-sub-text { font-size:.72rem; color:#64748b; line-height:1.2; }

    /* Matrix Action Button */
    .matrix-action-btn { border-radius:6px; font-size:.76rem; font-weight:700; padding:0 10px; height:32px; border:1.5px solid #cbd5e1; background:#ffffff; color:#334155; display:inline-flex; align-items:center; gap:4px; transition:all .15s; }
    .matrix-action-btn:hover { background:#f1f5f9; color:#0f172a; border-color:#94a3b8; }
    .matrix-action-btn.matrix-open { background:#0f172a; color:#ffffff; border-color:#0f172a; }
    .matrix-action-btn mat-icon { font-size:16px; width:16px; height:16px; }

    /* Expanded Drawer Row */
    .person-main-row.expanded-row { background:#f8fafc; border-bottom:none !important; }
    .matrix-drawer-row { background:#f8fafc; }
    .matrix-drawer-container { padding:0 16px 16px 16px !important; border-top:none !important; }
    .matrix-drawer-card { background:#ffffff; border:1.5px solid #cbd5e1; border-radius:10px; padding:12px 14px; box-shadow:0 4px 12px rgba(15,23,42,0.06); display:flex; flex-direction:column; gap:12px; }
    .md-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-bottom:1px solid #f1f5f9; padding-bottom:10px; }
    .md-title-left { display:flex; align-items:center; gap:8px; }
    .md-title-left .md-icon { color:#0284c7; font-size:22px; width:22px; height:22px; }
    .md-title { font-size:.9rem; color:#0f172a; display:block; }
    .md-subtitle { font-size:.76rem; color:#64748b; display:block; }
    .md-summary-chips { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .md-chip { font-size:.72rem; font-weight:700; padding:2px 8px; border-radius:12px; }
    .chip-p { background:#ecfdf5; color:#065f46; }
    .chip-l { background:#fffbeb; color:#92400e; }
    .chip-a { background:#fff1f2; color:#9f1239; }
    .chip-hd { background:#f5f3ff; color:#6b21a8; }
    .chip-off { background:#f1f5f9; color:#475569; }
    .chip-unmarked { background:#f8fafc; color:#94a3b8; border:1px dashed #cbd5e1; }

    /* Daily Strip Container */
    .daily-strip-container { display:flex; gap:6px; overflow-x:auto; padding:4px 2px 8px 2px; -webkit-overflow-scrolling:touch; scrollbar-width:thin; }
    .day-card { flex:0 0 38px; display:flex; flex-direction:column; align-items:center; gap:2px; padding:6px 2px; border-radius:8px; border:1px solid #e2e8f0; background:#f8fafc; cursor:pointer; transition:transform .1s, box-shadow .1s; }
    .day-card:hover { transform:translateY(-2px); box-shadow:0 3px 6px rgba(0,0,0,0.08); }
    .day-card-num { font-size:.75rem; font-weight:800; color:#1e293b; font-family:monospace; }
    .day-card-name { font-size:.65rem; font-weight:600; color:#64748b; text-transform:uppercase; }
    .day-card-badge { font-size:.68rem; font-weight:800; border-radius:4px; padding:2px 4px; min-width:24px; text-align:center; }

    /* Day Status Themes */
    .day-card.day-p { background:#f0fdf4; border-color:#86efac; }
    .day-card.day-p .day-card-badge { background:#16a34a; color:#fff; }
    .day-card.day-l { background:#fffbeb; border-color:#fde047; }
    .day-card.day-l .day-card-badge { background:#d97706; color:#fff; }
    .day-card.day-lt { background:#fefce8; border-color:#fef08a; }
    .day-card.day-lt .day-card-badge { background:#ca8a04; color:#fff; }
    .day-card.day-a { background:#fef2f2; border-color:#fca5a5; }
    .day-card.day-a .day-card-badge { background:#dc2626; color:#fff; }
    .day-card.day-hd { background:#faf5ff; border-color:#d8b4fe; }
    .day-card.day-hd .day-card-badge { background:#9333ea; color:#fff; }
    .day-card.day-off { background:#f1f5f9; border-color:#cbd5e1; }
    .day-card.day-off .day-card-badge { background:#64748b; color:#fff; }
    .day-card.day-- { background:#f8fafc; border-color:#e2e8f0; opacity:0.65; }
    .day-card.day-- .day-card-badge { background:#cbd5e1; color:#475569; }
    .day-card.day-is-sunday { border-style:dashed; }

    /* Matrix Legend */
    .matrix-legend { display:flex; align-items:center; gap:14px; flex-wrap:wrap; font-size:.74rem; color:#475569; padding-top:6px; border-top:1px dashed #e2e8f0; }
    .leg-item { display:inline-flex; align-items:center; gap:5px; }
    .leg-dot { width:8px; height:8px; border-radius:50%; display:inline-block; }
    .dot-p { background:#16a34a; }
    .dot-l { background:#d97706; }
    .dot-lt { background:#ca8a04; }
    .dot-a { background:#dc2626; }
    .dot-hd { background:#9333ea; }
    .dot-off { background:#64748b; }
    .dot-unmarked { background:#cbd5e1; }
    .md-chip.chip-leave { background:#fffbeb; color:#b45309; border:1px solid #fde68a; }

    /* Empty Table State */
    .empty-table-cell { text-align:center; padding:36px 16px !important; }
    .empty-state { display:flex; flex-direction:column; align-items:center; gap:6px; color:#64748b; }
    .empty-state mat-icon { font-size:36px; width:36px; height:36px; color:#94a3b8; }
    .empty-state strong { font-size:1rem; color:#1e293b; }
    .empty-state p { margin:0; font-size:.84rem; color:#64748b; }

    /* Dual Stream Pill Switcher */
    .filter-stream-pill-wrap { display:flex; align-items:center; gap:8px; }
    .filter-stream-pill-wrap label { font-size:0.8rem; font-weight:700; color:#475569; }
    .stream-pill-group { display:inline-flex; background:#e2e8f0; padding:3px; border-radius:10px; gap:4px; }
    .stream-tab-btn {
      display:inline-flex; align-items:center; gap:6px; border:none; background:transparent;
      padding:6px 14px; border-radius:8px; font-size:0.82rem; font-weight:600; color:#475569;
      cursor:pointer; transition:all 0.15s ease-in-out;
    }
    .stream-tab-btn mat-icon { font-size:18px; width:18px; height:18px; color:#64748b; }
    .stream-tab-btn.active {
      background:#ffffff; color:#1d4ed8; font-weight:700;
      box-shadow:0 2px 6px rgba(0,0,0,0.08);
    }
    .stream-tab-btn.active mat-icon { color:#2563eb; }
    .name-line { display:flex; align-items:center; gap:8px; }
    .badge-dual-enrolled {
      display:inline-block; font-size:0.68rem; font-weight:700; padding:2px 7px;
      border-radius:12px; background:linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%);
      color:#9333ea; border:1px solid #f0abfc;
    }
    .dual-extra-note { margin-top:3px; font-size:0.75rem; color:#64748b; }
    .other-stream-text { background:#f8fafc; padding:3px 8px; border-radius:6px; border:1px solid #e2e8f0; display:inline-block; }

    /* Print Specific Styles */
    .print-heading { display:none; }
    @media print {
      .no-print { display:none !important; }
      .report-page { gap:10px !important; margin:0 !important; padding:0 !important; }
      .print-heading { display:flex !important; justify-content:space-between !important; align-items:center !important; padding-bottom:8px !important; border-bottom:2px solid #0f172a !important; margin-bottom:12px !important; }
      .print-brand-info { display:flex !important; align-items:center !important; gap:12px !important; }
      .print-logo-mark { width:46px !important; height:46px !important; border-radius:8px !important; background:#0284c7 !important; color:#fff !important; display:flex !important; align-items:center !important; justify-content:center !important; overflow:hidden !important; flex-shrink:0 !important; }
      .print-logo-mark.has-img { background:#fff !important; border:1px solid #cbd5e1 !important; padding:2px !important; }
      .print-logo-mark .inst-logo-img { width:100% !important; height:100% !important; object-fit:contain !important; }
      .print-report-title { font-size:0.92rem !important; color:#0284c7 !important; font-weight:700 !important; }
      .print-heading h2 { margin:0 !important; color:#0f172a !important; font-size:1.35rem !important; font-weight:800 !important; }
      .print-batch-sub { display:block !important; font-size:0.88rem !important; color:#475569 !important; font-weight:600 !important; margin-top:3px !important; }
      .print-period-badge { font-size:0.95rem !important; color:#0f172a !important; font-weight:700 !important; border:1px solid #cbd5e1 !important; padding:4px 10px !important; border-radius:6px !important; background:#f8fafc !important; }
      .kpi-grid { grid-template-columns:repeat(5, 1fr) !important; gap:8px !important; margin-bottom:12px !important; }
      .kpi-card { padding:8px 4px !important; border:1px solid #cbd5e1 !important; box-shadow:none !important; }
      .kpi-icon-box { display:none !important; }
      .kpi-val { font-size:1.15rem !important; }
      .table-responsive-container { box-shadow:none !important; border:1px solid #cbd5e1 !important; }
      table { width:100% !important; min-width:0 !important; font-size:0.76rem !important; }
      th, td { padding:6px 8px !important; border:1px solid #e2e8f0 !important; text-align:left !important; }
      th { background:#f8fafc !important; font-weight:700 !important; }
    }

    @media (max-width: 900px) {
      .kpi-grid { grid-template-columns:repeat(2, 1fr); }
      .report-type-bar { grid-template-columns:1fr; }
      .filters-row { flex-direction:column; align-items:stretch; }
      .matrix-bulk-btn { margin-left:0; }
    }
  `]
})
export class AttendanceReportsComponent implements OnInit {
  private api = API_BASE;
  reportType: 'student' | 'teacher' = 'student';
  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  selectedBatchId = '';
  searchQuery = '';
  months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  years = [2024, 2025, 2026, 2027];
  batches: Array<{ id: string; name: string }> = [];
  schoolClasses: SchoolClassDto[] = [];
  studentFilterMode: 'all' | 'school' | 'coaching' = 'all';
  selectedClassId = '';
  selectedSectionId = '';
  classSections: SchoolSectionDto[] = [];
  report: AttendanceReport | null = null;
  loading = false;
  studentStreamMode: 'all' | 'school' | 'coaching' = 'all';
  streamInitialized = false;

  get isDualStudent(): boolean {
    if (!this.isStudentOrParent) return false;
    if (this.report?.isDualEnrolled) return true;
    const r = this.report?.rows?.[0];
    return !!(r && r.isSchoolStudent && r.isCoachingStudent);
  }

  setStudentStream(stream: 'all' | 'school' | 'coaching'): void {
    if (this.studentStreamMode === stream) return;
    this.studentStreamMode = stream;
    this.dailyMatrixCache = {};
    this.loadingDaily.clear();
    this.loadReport();
  }

  // 30-Day Daily Matrix State
  expandedPersonIds = new Set<string>();
  expandAll = false;
  dailyMatrixCache: { [personId: string]: DailyDayItem[] } = {};
  loadingDaily = new Set<string>();

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private schoolService: SchoolService
  ) {}

  logoFailed = false;

  get logoUrl(): string | null {
    return this.authService.getInstituteLogoUrl();
  }

  get instituteName(): string {
    return this.authService.currentUser()?.instituteName || 'Apex Coaching Academy';
  }

  get isStudentOrParent(): boolean {
    return this.authService.isStudentOrParent();
  }

  ngOnInit(): void {
    if (this.isStudentOrParent) {
      this.reportType = 'student';
    } else {
      this.loadBatches();
      this.loadSchoolClasses();
    }
    this.loadReport();
  }

  loadBatches(): void {
    this.http.get<Array<{ id: string; name: string }>>(`${this.api}/batches`).subscribe({
      next: batches => this.batches = batches || [],
      error: () => this.batches = []
    });
  }

  loadSchoolClasses(): void {
    this.schoolService.getClasses(true).subscribe({
      next: classes => this.schoolClasses = classes || [],
      error: () => this.schoolClasses = []
    });
  }

  onFilterModeChanged(): void {
    this.selectedClassId = '';
    this.selectedSectionId = '';
    this.classSections = [];
    this.selectedBatchId = '';
    this.loadReport();
  }

  onClassFilterChanged(): void {
    const found = this.schoolClasses.find(c => c.id === this.selectedClassId);
    this.classSections = found?.sections || [];
    this.selectedSectionId = '';
    this.loadReport();
  }

  changeReportType(type: 'student' | 'teacher'): void {
    if (this.isStudentOrParent) return;
    this.reportType = type;
    if (type === 'teacher') {
      this.selectedBatchId = '';
      this.selectedClassId = '';
      this.selectedSectionId = '';
    }
    this.searchQuery = '';
    this.expandedPersonIds.clear();
    this.expandAll = false;
    this.dailyMatrixCache = {};
    this.loadReport();
  }

  loadReport(): void {
    this.loading = true;
    this.expandedPersonIds.clear();
    this.expandAll = false;
    this.dailyMatrixCache = {};
    this.loadingDaily.clear();

    if (this.isStudentOrParent) {
      this.reportType = 'student';
    }

    const endpoint = this.reportType === 'student'
      ? `${this.api}/students/attendance/report`
      : `${this.api}/teachers/attendance/report`;

    const params: Record<string, string | number> = {
      month: this.selectedMonth,
      year: this.selectedYear
    };
    if (this.reportType === 'student') {
      if (this.isStudentOrParent) {
        params['stream'] = this.studentStreamMode;
      } else {
        if (this.studentFilterMode === 'school') {
          params['stream'] = 'school';
          if (this.selectedClassId) params['classId'] = this.selectedClassId;
          if (this.selectedSectionId) params['sectionId'] = this.selectedSectionId;
        } else if (this.studentFilterMode === 'coaching') {
          params['stream'] = 'coaching';
          if (this.selectedBatchId) params['batchId'] = this.selectedBatchId;
        }
      }
    }

    this.http.get<AttendanceReport>(endpoint, { params }).subscribe({
      next: report => {
        this.report = report;
        this.loading = false;
        if (this.isStudentOrParent && report?.rows && report.rows.length > 0) {
          const firstRow = report.rows[0];
          if (!this.streamInitialized) {
            this.streamInitialized = true;
            if (report.defaultStream) {
              this.studentStreamMode = report.defaultStream as 'all' | 'school' | 'coaching';
            } else if (firstRow.isSchoolStudent && firstRow.isCoachingStudent) {
              this.studentStreamMode = 'all';
            } else if (!firstRow.isSchoolStudent && firstRow.isCoachingStudent) {
              this.studentStreamMode = 'coaching';
            }
          }
          this.expandedPersonIds.add(firstRow.personId);
          this.loadDailyAttendanceIfNeeded(firstRow.personId);
        }
      },
      error: () => {
        this.report = null;
        this.loading = false;
      }
    });
  }

  get filteredRows(): ReportRow[] {
    if (!this.report?.rows) return [];
    if (!this.searchQuery.trim()) return this.report.rows;
    const q = this.searchQuery.toLowerCase().trim();
    return this.report.rows.filter(r =>
      (r.personName && r.personName.toLowerCase().includes(q)) ||
      (r.code && r.code.toLowerCase().includes(q)) ||
      (r.groupName && r.groupName.toLowerCase().includes(q))
    );
  }

  get overallAttendanceRate(): number {
    if (!this.report || this.report.rows.length === 0) return 0;
    const sum = this.report.rows.reduce((acc, row) => acc + (row.attendancePercentage || 0), 0);
    return Math.round(sum / this.report.rows.length);
  }

  get totalWorkingDaysInMonth(): number {
    if (this.report?.rows?.length) {
      return this.report.rows[0].totalWorkingDays;
    }
    const daysInMonth = this.getDaysInMonth();
    let sundays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(this.selectedYear, this.selectedMonth - 1, d).getDay() === 0) {
        sundays++;
      }
    }
    return Math.max(0, daysInMonth - sundays);
  }

  getDaysInMonth(): number {
    return new Date(this.selectedYear, this.selectedMonth, 0).getDate();
  }

  getEvaluatedDays(row: ReportRow): number {
    return (row.presentDays || 0) + (row.absentDays || 0) + (row.lateDays || 0) + (row.halfDays || 0) + this.getLeaveDays(row);
  }

  getLeaveDays(row: ReportRow): number {
    const matrix = this.dailyMatrixCache[row.personId];
    if (!matrix) return 0;
    return matrix.filter(d => d.status === 'L').length;
  }

  getUnmarkedDays(row: ReportRow): number {
    const evaluated = this.getEvaluatedDays(row);
    const working = row.totalWorkingDays || 25;
    return Math.max(0, working - evaluated);
  }

  getInitials(name?: string): string {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return (name || '').slice(0, 2).toUpperCase();
  }

  getPctColor(pct: number): string {
    if (pct >= 85) return '#059669';
    if (pct >= 75) return '#16a34a';
    if (pct >= 50) return '#d97706';
    return '#e11d48';
  }

  // Daily Calendar Matrix Handlers
  isExpanded(personId: string): boolean {
    return this.expandedPersonIds.has(personId);
  }

  toggleCalendar(personId: string): void {
    if (this.expandedPersonIds.has(personId)) {
      this.expandedPersonIds.delete(personId);
    } else {
      this.expandedPersonIds.add(personId);
      this.loadDailyAttendanceIfNeeded(personId);
    }
  }

  toggleExpandAll(): void {
    this.expandAll = !this.expandAll;
    if (this.expandAll) {
      this.filteredRows.forEach(r => {
        this.expandedPersonIds.add(r.personId);
        this.loadDailyAttendanceIfNeeded(r.personId);
      });
    } else {
      this.expandedPersonIds.clear();
    }
  }

  loadDailyAttendanceIfNeeded(personId: string): void {
    if (this.dailyMatrixCache[personId] || this.loadingDaily.has(personId)) return;
    this.loadingDaily.add(personId);

    let streamQuery = '';
    if (this.reportType === 'student') {
      if (this.isStudentOrParent) {
        streamQuery = `&stream=${this.studentStreamMode}`;
      } else if (this.studentFilterMode === 'school') {
        streamQuery = '&stream=school';
      } else if (this.studentFilterMode === 'coaching') {
        streamQuery = '&stream=coaching';
      }
    }

    const endpoint = this.reportType === 'student'
      ? `${this.api}/students/${personId}/attendance?month=${this.selectedMonth}&year=${this.selectedYear}${streamQuery}`
      : `${this.api}/teachers/${personId}/attendance?month=${this.selectedMonth}&year=${this.selectedYear}`;

    this.http.get<any[]>(endpoint).subscribe({
      next: records => {
        this.loadingDaily.delete(personId);
        this.buildDailyMapFromRecords(personId, records || []);
      },
      error: () => {
        this.loadingDaily.delete(personId);
        this.buildDailyMapFromRecords(personId, []);
      }
    });
  }

  buildDailyMapFromRecords(personId: string, records: any[]): void {
    const totalDays = this.getDaysInMonth();
    const daysArr: DailyDayItem[] = [];
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(this.selectedYear, this.selectedMonth - 1, d);
      const dayOfWeek = weekdays[dateObj.getDay()];
      const isSunday = dateObj.getDay() === 0;

      if (isSunday) {
        daysArr.push({
          day: d,
          dayOfWeek,
          isSunday: true,
          status: 'OFF',
          label: `${d} ${this.months[this.selectedMonth - 1]} (${dayOfWeek}): Sunday (Off)`
        });
        continue;
      }

      const rec = records.find(r => {
        let rYear: number, rMonth: number, rDay: number;
        if (typeof r.attendanceDate === 'string' && r.attendanceDate.length >= 10) {
          const parts = r.attendanceDate.substring(0, 10).split('-');
          rYear = parseInt(parts[0], 10);
          rMonth = parseInt(parts[1], 10);
          rDay = parseInt(parts[2], 10);
        } else {
          const dt = new Date(r.attendanceDate);
          rYear = dt.getFullYear();
          rMonth = dt.getMonth() + 1;
          rDay = dt.getDate();
        }
        return rDay === d && rMonth === Number(this.selectedMonth) && rYear === Number(this.selectedYear);
      });

      if (rec) {
        let code = 'P';
        const st = (rec.status || '').toLowerCase();
        if (st.includes('absent')) code = 'A';
        else if (st.includes('leave')) code = 'L';
        else if (st.includes('late')) code = 'LT';
        else if (st.includes('half')) code = 'HD';
        else if (st.includes('present')) code = 'P';

        let statusText = rec.status || 'Present';
        if (code === 'L') {
          statusText = rec.remarks ? `Sanctioned Leave: ${rec.remarks}` : 'Sanctioned Leave';
        }

        const sourceLabel = rec.captureSource === 'ManualBulk'
          ? ' • Coaching'
          : (rec.captureSource?.startsWith('ManualSchool') ? ' • School' : (rec.captureSource ? ` • ${rec.captureSource}` : ''));

        daysArr.push({
          day: d,
          dayOfWeek,
          isSunday: false,
          status: code,
          label: `${d} ${this.months[this.selectedMonth - 1]} (${dayOfWeek}): ${statusText}${sourceLabel}${rec.checkInTime ? ' • In: ' + rec.checkInTime : ''}`
        });
      } else {
        daysArr.push({
          day: d,
          dayOfWeek,
          isSunday: false,
          status: '-',
          label: `${d} ${this.months[this.selectedMonth - 1]} (${dayOfWeek}): Not Marked / Future`
        });
      }
    }
    this.dailyMatrixCache[personId] = daysArr;
  }

  getDailyMatrix(row: ReportRow): DailyDayItem[] {
    if (this.dailyMatrixCache[row.personId]) {
      return this.dailyMatrixCache[row.personId];
    }
    this.loadDailyAttendanceIfNeeded(row.personId);
    // Return temporary skeleton if still loading
    const totalDays = this.getDaysInMonth();
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const temp: DailyDayItem[] = [];
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(this.selectedYear, this.selectedMonth - 1, d);
      const dayOfWeek = weekdays[dateObj.getDay()];
      const isSunday = dateObj.getDay() === 0;
      temp.push({
        day: d,
        dayOfWeek,
        isSunday,
        status: isSunday ? 'OFF' : '-',
        label: `${d} ${this.months[this.selectedMonth - 1]} (${dayOfWeek})`
      });
    }
    return temp;
  }

  getSelectedBatchName(): string {
    if (!this.selectedBatchId) return 'All Batches';
    const found = this.batches.find(b => b.id === this.selectedBatchId);
    return found ? found.name : 'All Batches';
  }

  getSelectedFilterSubTitle(): string {
    if (this.studentFilterMode === 'school') {
      const cls = this.schoolClasses.find(c => c.id === this.selectedClassId);
      const sec = this.classSections.find(s => s.id === this.selectedSectionId);
      if (cls && sec) return `School Class: ${cls.name} (Section ${sec.name})`;
      if (cls) return `School Class: ${cls.name}`;
      return 'All School Classes';
    }
    if (this.studentFilterMode === 'coaching') {
      return `Coaching Batch: ${this.getSelectedBatchName()}`;
    }
    return 'All Students (School & Coaching)';
  }

  exportCsv(): void {
    if (!this.report || this.filteredRows.length === 0) return;
    const typeLabel = this.reportType === 'student' ? 'Student' : 'Faculty';
    const codeLabel = this.reportType === 'student' ? 'Roll Number' : 'Code';
    const groupLabel = this.reportType === 'student' ? 'Batch / Class' : 'Department';

    let csv = `"${typeLabel} Attendance Report - ${this.months[this.selectedMonth - 1]} ${this.selectedYear}"\n`;
    if (this.reportType === 'student') csv += `"${this.getSelectedFilterSubTitle()}"\n`;
    csv += `\n"Name","${codeLabel}","${groupLabel}","Present Days","Absent Days","Late Days","Half Days","Off Days","Total Working Days","Attendance %"\n`;

    for (const r of this.filteredRows) {
      csv += `"${r.personName || ''}","${r.code || ''}","${r.groupName || ''}",${r.presentDays || 0},${r.absentDays || 0},${r.lateDays || 0},${r.halfDays || 0},${r.holidayDays || 0},${r.totalWorkingDays || 0},"${r.attendancePercentage || 0}%"\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.reportType}_attendance_report_${this.selectedYear}_${this.selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  printReport(): void {
    window.print();
  }
}
