import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { environment } from '../../../environments/environment';
import {
  API_BASE,
  TeacherWorkloadReportDto,
  TeacherWorkloadSummaryItemDto,
  AttendanceReportDto,
  AttendanceReportRowDto,
  TeacherMonthlyPayrollReportDto,
  SalaryPaymentDto,
  BatchAssignmentDto,
  MasterTimetableReportDto
} from './teacher.models';
import { AuthService } from '../../core/services/auth.service';


@Component({
  selector: 'app-teacher-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatTabsModule,
    MatChipsModule,
    MatMenuModule
  ],
  template: `
<div class="page-container">
  <!-- Top Header -->
  <div class="page-header">
    <div class="page-header-text">
      <h1 class="page-title"><mat-icon>assessment</mat-icon> Faculty Reports & Analytics</h1>
      <p class="page-subtitle">Comprehensive institutional insights on teacher workload, monthly attendance, payroll registers, and master weekly routine.</p>
    </div>
    <div class="header-actions">
      <button mat-stroked-button class="action-btn" (click)="exportActiveTabToCsv()" matTooltip="Export current tab data to CSV">
        <mat-icon>download</mat-icon>
        <span class="btn-text">Export CSV</span>
      </button>
      <button mat-raised-button color="primary" class="action-btn" (click)="printReport()" matTooltip="Print or Save PDF">
        <mat-icon>print</mat-icon>
        <span class="btn-text">Print Report</span>
      </button>
    </div>
  </div>

  <!-- Report Tabs -->
  <div class="report-tabs-wrapper mat-elevation-z1">
    <div class="custom-tab-nav">
      <button type="button" class="tab-pill" [class.active]="selectedTab === 'workload'" (click)="setTab('workload')">
        <mat-icon>work_outline</mat-icon>
        <span>Workload Analysis</span>
      </button>
      <button type="button" class="tab-pill" [class.active]="selectedTab === 'attendance'" (click)="setTab('attendance')">
        <mat-icon>fact_check</mat-icon>
        <span>Attendance Sheet</span>
      </button>
      <button type="button" class="tab-pill" [class.active]="selectedTab === 'payroll'" (click)="setTab('payroll')">
        <mat-icon>account_balance</mat-icon>
        <span>Payroll Register</span>
      </button>
      <button type="button" class="tab-pill" [class.active]="selectedTab === 'master_timetable'" (click)="setTab('master_timetable')">
        <mat-icon>schedule</mat-icon>
        <span>Master Routine Matrix</span>
      </button>
    </div>

    <!-- TAB 1: Faculty Workload & Allocation -->
    <div class="tab-content" *ngIf="selectedTab === 'workload'">
      <!-- KPI Metric Cards -->
      <div class="kpi-grid" *ngIf="workloadReport">
        <div class="kpi-card blue">
          <div class="kpi-icon"><mat-icon>groups</mat-icon></div>
          <div class="kpi-data">
            <span class="kpi-label">Active Faculty</span>
            <span class="kpi-val">{{workloadReport.totalActiveTeachers}}</span>
          </div>
        </div>
        <div class="kpi-card purple">
          <div class="kpi-icon"><mat-icon>school</mat-icon></div>
          <div class="kpi-data">
            <span class="kpi-label">Assigned Batches</span>
            <span class="kpi-val">{{workloadReport.totalAssignedBatches}}</span>
          </div>
        </div>
        <div class="kpi-card teal">
          <div class="kpi-icon"><mat-icon>event_repeat</mat-icon></div>
          <div class="kpi-data">
            <span class="kpi-label">Weekly Classes</span>
            <span class="kpi-val">{{workloadReport.totalWeeklyClasses}}</span>
          </div>
        </div>
        <div class="kpi-card orange">
          <div class="kpi-icon"><mat-icon>hourglass_top</mat-icon></div>
          <div class="kpi-data">
            <span class="kpi-label">Weekly Load</span>
            <span class="kpi-val">{{workloadReport.totalWeeklyHours}} hrs</span>
          </div>
        </div>
        <div class="kpi-card emerald">
          <div class="kpi-icon"><mat-icon>person_pin</mat-icon></div>
          <div class="kpi-data">
            <span class="kpi-label">Students Reached</span>
            <span class="kpi-val">{{workloadReport.totalStudentsReached}}</span>
          </div>
        </div>
      </div>

      <!-- Filter / Search Row -->
      <div class="filter-card">
        <div class="search-input-wrap">
          <mat-icon>search</mat-icon>
          <input type="text" placeholder="Search by faculty name or employee code..." [(ngModel)]="workloadSearch" (ngModelChange)="onWorkloadSearchChange()">
          <button type="button" class="clear-search-btn" *ngIf="workloadSearch" (click)="clearWorkloadSearch()" matTooltip="Clear search">
            <mat-icon>close</mat-icon>
          </button>
        </div>
        <div class="filter-select-wrap">
          <label>Load Category:</label>
          <select [(ngModel)]="workloadFilter" (change)="onWorkloadFilterChange()">
            <option value="all">All Workload Levels</option>
            <option value="no_load">No Load (0 hrs)</option>
            <option value="light">Light Load (&lt; 10 hrs/wk)</option>
            <option value="optimal">Optimal Load (10 – 25 hrs/wk)</option>
            <option value="heavy">Heavy Load (&gt; 25 hrs/wk)</option>
          </select>
        </div>
        <button mat-stroked-button class="refresh-workload-btn" (click)="loadWorkloadReport(workloadPage)" matTooltip="Refresh report">
          <mat-icon>refresh</mat-icon> Refresh
        </button>
      </div>

      <!-- Workload Table -->
      <div class="table-responsive-container">
        <mat-progress-bar mode="indeterminate" *ngIf="loadingWorkload" class="table-progress-bar"></mat-progress-bar>
        <table class="report-table workload-table" [class.table-loading]="loadingWorkload">
          <thead>
            <tr>
              <th class="sortable-th col-faculty" (click)="onWorkloadSort('name')">
                <div class="th-content">
                  <span>Faculty Name &amp; Code</span>
                  <mat-icon class="sort-ico" *ngIf="workloadSortBy === 'name'">{{ workloadSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="workloadSortBy !== 'name'">unfold_more</mat-icon>
                </div>
              </th>
              <th class="sortable-th col-qual" (click)="onWorkloadSort('qualification')">
                <div class="th-content">
                  <span>Qualification / Specialization</span>
                  <mat-icon class="sort-ico" *ngIf="workloadSortBy === 'qualification'">{{ workloadSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="workloadSortBy !== 'qualification'">unfold_more</mat-icon>
                </div>
              </th>
              <th class="text-center sortable-th col-batches" (click)="onWorkloadSort('batches')">
                <div class="th-content text-center">
                  <span>{{ authService.hasSchoolModule() && !authService.hasCoachingModule() ? 'Assigned Classes' : (authService.hasSchoolModule() && authService.hasCoachingModule() ? 'Classes / Batches' : 'Assigned Batches') }}</span>
                  <mat-icon class="sort-ico" *ngIf="workloadSortBy === 'batches'">{{ workloadSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="workloadSortBy !== 'batches'">unfold_more</mat-icon>
                </div>
              </th>
              <th class="text-center sortable-th col-classes" (click)="onWorkloadSort('classes')">
                <div class="th-content text-center">
                  <span>Classes / Week</span>
                  <mat-icon class="sort-ico" *ngIf="workloadSortBy === 'classes'">{{ workloadSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="workloadSortBy !== 'classes'">unfold_more</mat-icon>
                </div>
              </th>
              <th class="text-center sortable-th col-hours" (click)="onWorkloadSort('hours')">
                <div class="th-content text-center">
                  <span>Weekly Hours</span>
                  <mat-icon class="sort-ico" *ngIf="workloadSortBy === 'hours'">{{ workloadSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="workloadSortBy !== 'hours'">unfold_more</mat-icon>
                </div>
              </th>
              <th class="text-center sortable-th col-status" (click)="onWorkloadSort('status')">
                <div class="th-content text-center">
                  <span>Load Status</span>
                  <mat-icon class="sort-ico" *ngIf="workloadSortBy === 'status'">{{ workloadSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="workloadSortBy !== 'status'">unfold_more</mat-icon>
                </div>
              </th>
              <th class="text-center sortable-th col-reach" (click)="onWorkloadSort('reach')">
                <div class="th-content text-center">
                  <span>Student Reach</span>
                  <mat-icon class="sort-ico" *ngIf="workloadSortBy === 'reach'">{{ workloadSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="workloadSortBy !== 'reach'">unfold_more</mat-icon>
                </div>
              </th>
              <th class="text-center actions-th">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of displayedWorkloadTeachers" class="report-table-row" (click)="openBatchDetails(item)">
              <td class="col-faculty">
                <div class="faculty-name-cell">
                  <div class="avatar-circle">
                    <img
                      *ngIf="getTeacherPhoto(item) && !imgErrors[item.teacherId]"
                      [src]="getTeacherPhoto(item)"
                      (error)="imgErrors[item.teacherId] = true"
                      class="faculty-photo-img"
                      [alt]="item.teacherName"
                    />
                    <span *ngIf="!getTeacherPhoto(item) || imgErrors[item.teacherId]" class="avatar-initials">
                      {{ getInitials(item.teacherName) }}
                    </span>
                  </div>
                  <div>
                    <span class="name-bold">{{item.teacherName}}</span>
                    <span class="code-sub">{{item.employeeCode}}</span>
                  </div>
                </div>
              </td>
              <td class="col-qual">
                <div class="qual-cell" [matTooltip]="(item.qualification || 'N/A') + (item.specialization ? ' • ' + item.specialization : '')">
                  <span class="qual-text">{{item.qualification || 'N/A'}}</span>
                  <span class="spec-sub" *ngIf="item.specialization">{{item.specialization}}</span>
                </div>
              </td>
              <td class="text-center col-batches">
                <span class="badge-num" [class.badge-zero]="item.assignedBatchCount === 0">
                  {{item.assignedBatchCount}} {{ authService.hasSchoolModule() && !authService.hasCoachingModule() ? 'Classes' : (authService.hasSchoolModule() && authService.hasCoachingModule() ? 'Units' : 'Batches') }}
                </span>
              </td>
              <td class="text-center col-classes">
                <strong class="metric-num">{{item.weeklyClassesCount}}</strong>
              </td>
              <td class="text-center col-hours">
                <span class="metric-hours">{{item.weeklyHours}} hrs</span>
              </td>
              <td class="text-center col-status">
                <span class="status-chip" [ngClass]="getWorkloadStatusClass(item.weeklyHours)">
                  {{getWorkloadStatusText(item.weeklyHours)}}
                </span>
              </td>
              <td class="text-center col-reach">
                <span class="reach-pill">
                  <mat-icon>school</mat-icon> {{item.totalStudentReach}}
                </span>
              </td>
              <td class="text-center actions-td" (click)="$event.stopPropagation()">
                <button
                  mat-icon-button
                  [matMenuTriggerFor]="routineMenu"
                  class="action-menu-btn"
                  matTooltip="Actions"
                >
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #routineMenu="matMenu" xPosition="before" class="compact-action-menu">
                  <button mat-menu-item (click)="openBatchDetails(item)">
                    <mat-icon style="color: #2563eb;">visibility</mat-icon>
                    <span>Routine Preview</span>
                  </button>
                </mat-menu>
              </td>
            </tr>
            <tr *ngIf="!loadingWorkload && displayedWorkloadTeachers.length === 0">
              <td colspan="8" class="empty-table-cell">No faculty found matching the search criteria.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer Bar -->
      <div class="pagination-footer-bar" *ngIf="workloadReport && workloadTotalCount > 0">
        <div class="pagination-left">
          <span class="page-summary">
            Showing <strong>{{workloadStartIndex + 1}} – {{workloadEndIndex}}</strong> of <strong>{{workloadTotalCount}}</strong> faculty members
          </span>
          <div class="page-size-wrap">
            <label>Rows per page:</label>
            <div class="size-btn-group">
              <button type="button" class="size-pill" [class.active]="workloadPageSize === 10" (click)="setWorkloadPageSize(10)">10</button>
              <button type="button" class="size-pill" [class.active]="workloadPageSize === 25" (click)="setWorkloadPageSize(25)">25</button>
              <button type="button" class="size-pill" [class.active]="workloadPageSize === 50" (click)="setWorkloadPageSize(50)">50</button>
              <button type="button" class="size-pill" [class.active]="workloadPageSize === 100" (click)="setWorkloadPageSize(100)">100</button>
            </div>
          </div>
        </div>

        <div class="pagination-right" *ngIf="totalWorkloadPages > 1">
          <button type="button" class="nav-page-btn" [disabled]="workloadPage === 1 || loadingWorkload" (click)="setWorkloadPage(1)" matTooltip="First Page">
            <mat-icon>first_page</mat-icon>
          </button>
          <button type="button" class="nav-page-btn" [disabled]="workloadPage === 1 || loadingWorkload" (click)="setWorkloadPage(workloadPage - 1)" matTooltip="Previous Page">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <div class="page-current-badge">
            <span>Page</span>
            <strong>{{workloadPage}}</strong>
            <span>of</span>
            <strong>{{totalWorkloadPages}}</strong>
          </div>
          <button type="button" class="nav-page-btn" [disabled]="workloadPage >= totalWorkloadPages || loadingWorkload" (click)="setWorkloadPage(workloadPage + 1)" matTooltip="Next Page">
            <mat-icon>chevron_right</mat-icon>
          </button>
          <button type="button" class="nav-page-btn" [disabled]="workloadPage >= totalWorkloadPages || loadingWorkload" (click)="setWorkloadPage(totalWorkloadPages)" matTooltip="Last Page">
            <mat-icon>last_page</mat-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- TAB 2: Faculty Attendance Register -->
    <div class="tab-content" *ngIf="selectedTab === 'attendance'">
      <!-- Controls Bar -->
      <div class="filter-card">
        <div class="month-selector-group">
          <div class="select-field">
            <label>Month:</label>
            <select [(ngModel)]="attendanceMonth" (change)="loadAttendanceReport(1)">
              <option *ngFor="let m of months; let i = index" [value]="i + 1">{{m}}</option>
            </select>
          </div>
          <div class="select-field">
            <label>Year:</label>
            <select [(ngModel)]="attendanceYear" (change)="loadAttendanceReport(1)">
              <option *ngFor="let y of years" [value]="y">{{y}}</option>
            </select>
          </div>
        </div>

        <div class="search-input-wrap">
          <mat-icon>search</mat-icon>
          <input type="text" placeholder="Search faculty by name or code..." [(ngModel)]="attendanceSearch" (ngModelChange)="onAttendanceSearchChange()">
          <button type="button" class="clear-search-btn" *ngIf="attendanceSearch" (click)="clearAttendanceSearch()" matTooltip="Clear search">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="filter-select-wrap">
          <label>Rating:</label>
          <select [(ngModel)]="attendanceStatusFilter" (change)="onAttendanceFilterChange()">
            <option value="all">All Punctuality Ratings</option>
            <option value="flawless">100% On-Time (Flawless)</option>
            <option value="good">Good Regular (&ge; 75%)</option>
            <option value="late">Has Late Arrivals</option>
            <option value="low">Critical Low (&lt; 50%)</option>
          </select>
        </div>

        <div class="matrix-toggle-group">
          <button mat-stroked-button class="refresh-workload-btn" (click)="loadAttendanceReport(attendancePage)" matTooltip="Refresh attendance register">
            <mat-icon>refresh</mat-icon> Refresh
          </button>
          <button mat-stroked-button class="matrix-bulk-btn" (click)="toggleExpandAll()">
            <mat-icon>{{expandAllDays ? 'unfold_less' : 'calendar_view_month'}}</mat-icon>
            <span>{{expandAllDays ? 'Collapse Matrices' : 'Expand 30-Day'}}</span>
          </button>
        </div>
      </div>

      <!-- Attendance KPIs -->
      <div class="kpi-grid" *ngIf="attendanceReport">
        <div class="kpi-card blue">
          <div class="kpi-icon"><mat-icon>badge</mat-icon></div>
          <div class="kpi-data">
            <span class="kpi-label">Total Faculty</span>
            <span class="kpi-val">{{attendanceReport.totalRecords}}</span>
          </div>
        </div>
        <div class="kpi-card emerald">
          <div class="kpi-icon"><mat-icon>check_circle</mat-icon></div>
          <div class="kpi-data">
            <span class="kpi-label">Total Present</span>
            <span class="kpi-val">{{attendanceReport.totalPresent}}</span>
          </div>
        </div>
        <div class="kpi-card rose">
          <div class="kpi-icon"><mat-icon>cancel</mat-icon></div>
          <div class="kpi-data">
            <span class="kpi-label">Total Absent</span>
            <span class="kpi-val">{{attendanceReport.totalAbsent}}</span>
          </div>
        </div>
        <div class="kpi-card amber">
          <div class="kpi-icon"><mat-icon>access_time</mat-icon></div>
          <div class="kpi-data">
            <span class="kpi-label">Late Days</span>
            <span class="kpi-val">{{attendanceReport.totalLate}}</span>
          </div>
        </div>
        <div class="kpi-card purple">
          <div class="kpi-icon"><mat-icon>donut_large</mat-icon></div>
          <div class="kpi-data">
            <span class="kpi-label">Avg Attendance</span>
            <span class="kpi-val">{{overallAttendanceRate}}%</span>
          </div>
        </div>
      </div>

      <!-- Attendance Table -->
      <div class="table-responsive-container" *ngIf="attendanceReport">
        <mat-progress-bar mode="indeterminate" *ngIf="loadingAttendance" class="table-progress-bar"></mat-progress-bar>
        <table class="report-table" [class.table-loading]="loadingAttendance">
          <thead>
            <tr>
              <th class="sortable-th" (click)="onAttendanceSort('name')" style="min-width: 200px;">
                <span class="th-content">
                  Faculty Member
                  <mat-icon class="sort-ico" *ngIf="attendanceSortBy === 'name'">{{attendanceSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="attendanceSortBy !== 'name'">unfold_more</mat-icon>
                </span>
              </th>
              <th class="text-center sortable-th" (click)="onAttendanceSort('present')" style="min-width: 80px;">
                <span class="th-content text-center">
                  Present
                  <mat-icon class="sort-ico" *ngIf="attendanceSortBy === 'present'">{{attendanceSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="attendanceSortBy !== 'present'">unfold_more</mat-icon>
                </span>
              </th>
              <th class="text-center sortable-th" (click)="onAttendanceSort('absent')" style="min-width: 80px;">
                <span class="th-content text-center">
                  Absent
                  <mat-icon class="sort-ico" *ngIf="attendanceSortBy === 'absent'">{{attendanceSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="attendanceSortBy !== 'absent'">unfold_more</mat-icon>
                </span>
              </th>
              <th class="text-center sortable-th" (click)="onAttendanceSort('late')" style="min-width: 80px;">
                <span class="th-content text-center">
                  Late
                  <mat-icon class="sort-ico" *ngIf="attendanceSortBy === 'late'">{{attendanceSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="attendanceSortBy !== 'late'">unfold_more</mat-icon>
                </span>
              </th>
              <th class="text-center sortable-th" (click)="onAttendanceSort('half')" style="min-width: 85px;">
                <span class="th-content text-center">
                  Half Days
                  <mat-icon class="sort-ico" *ngIf="attendanceSortBy === 'half'">{{attendanceSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="attendanceSortBy !== 'half'">unfold_more</mat-icon>
                </span>
              </th>
              <th class="text-center" style="min-width: 80px;">Off/Sundays</th>
              <th class="text-center" style="min-width: 85px;">Working Days</th>
              <th class="text-center sortable-th" (click)="onAttendanceSort('percentage')" style="min-width: 170px;">
                <span class="th-content text-center">
                  Attendance %
                  <mat-icon class="sort-ico" *ngIf="attendanceSortBy === 'percentage'">{{attendanceSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="attendanceSortBy !== 'percentage'">unfold_more</mat-icon>
                </span>
              </th>
              <th class="text-center" style="min-width: 210px;">Punctuality Rating</th>
              <th class="text-center" style="min-width: 130px;">Daily Matrix</th>
            </tr>
          </thead>
          <tbody>
            <ng-container *ngFor="let row of displayedAttendanceRows">
              <tr class="faculty-main-row" [class.expanded-row]="isExpanded(row.personId)">
                <td>
                  <div class="faculty-name-cell">
                    <div class="avatar-circle">
                      <img
                        *ngIf="getTeacherPhoto(row) && !imgErrors[row.personId]"
                        [src]="getTeacherPhoto(row)"
                        (error)="imgErrors[row.personId] = true"
                        class="faculty-photo-img"
                        [alt]="row.personName || row.name"
                      />
                      <span *ngIf="!getTeacherPhoto(row) || imgErrors[row.personId]" class="avatar-initials">
                        {{ getInitials(row.personName || row.name) }}
                      </span>
                    </div>
                    <div>
                      <span class="name-bold">{{row.personName || row.name}}</span>
                      <span class="code-sub">{{row.code}}</span>
                    </div>
                  </div>
                </td>
                <td class="text-center text-emerald">
                  <span class="stat-pill pill-present"><strong>{{row.presentDays}}</strong></span>
                </td>
                <td class="text-center text-rose">
                  <span class="stat-pill pill-absent"><strong>{{row.absentDays}}</strong></span>
                </td>
                <td class="text-center text-amber">
                  <span class="stat-pill pill-late"><strong>{{row.lateDays}}</strong></span>
                </td>
                <td class="text-center text-purple">
                  <span class="stat-pill pill-half"><strong>{{row.halfDays}}</strong></span>
                </td>
                <td class="text-center">
                  <span class="stat-pill pill-off">{{row.holidayDays}}</span>
                </td>
                <td class="text-center">
                  <span class="stat-pill pill-work">{{row.totalWorkingDays}}</span>
                </td>
                <td>
                  <div class="attendance-calc-cell">
                    <div class="pct-top-row">
                      <span class="pct-value" [style.color]="getPctColor(getMonthlyPct(row))">
                        {{getMonthlyPct(row)}}%
                      </span>
                      <span class="pct-type-badge" [ngClass]="isLimitedData(row) ? 'badge-mtd-warn' : 'badge-mtd-ok'">
                        {{isLimitedData(row) ? '1 Day Marked' : 'Full Month'}}
                      </span>
                    </div>
                    <div class="pct-bar-bg">
                      <div class="pct-bar-fill"
                        [style.width.%]="getMonthlyPct(row)"
                        [style.background]="getPctColor(getMonthlyPct(row))">
                      </div>
                    </div>
                    <div class="pct-sub-text">
                      <span *ngIf="isLimitedData(row)">
                        MTD: <strong>{{getMtdPct(row)}}%</strong> ({{getEvaluatedDays(row)}}/{{row.totalWorkingDays}} days marked)
                      </span>
                      <span *ngIf="!isLimitedData(row)">
                        {{row.presentDays + row.lateDays}} / {{row.totalWorkingDays}} working days attended
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="rating-badge-box" [ngClass]="getPunctualityRating(row).badgeClass" [matTooltip]="getPunctualityRating(row).tooltip">
                    <div class="rb-header">
                      <mat-icon class="rb-icon">{{getPunctualityRating(row).icon}}</mat-icon>
                      <span class="rb-title">{{getPunctualityRating(row).title}}</span>
                    </div>
                    <div class="rb-subtitle" *ngIf="getPunctualityRating(row).subtitle">
                      {{getPunctualityRating(row).subtitle}}
                    </div>
                  </div>
                </td>
                <td class="text-center">
                  <button mat-stroked-button class="matrix-action-btn"
                    [class.matrix-open]="isExpanded(row.personId)"
                    (click)="toggleTeacherCalendar(row.personId)">
                    <mat-icon>{{isExpanded(row.personId) ? 'expand_less' : 'calendar_month'}}</mat-icon>
                    <span>{{isExpanded(row.personId) ? 'Hide Matrix' : 'Daily Matrix'}}</span>
                  </button>
                </td>
              </tr>

              <!-- EXPANDED 30-DAY CALENDAR MATRIX DRAWER -->
              <tr *ngIf="isExpanded(row.personId)" class="matrix-drawer-row">
                <td colspan="10" class="matrix-drawer-container">
                  <div class="matrix-drawer-card">
                    <div class="md-header">
                      <div class="md-title-left">
                        <mat-icon class="md-icon">date_range</mat-icon>
                        <div>
                          <strong class="md-title">{{months[attendanceMonth - 1]}} {{attendanceYear}} Daily Attendance Strip</strong>
                          <span class="md-subtitle">{{row.personName || row.name}} ({{row.code}}) • 1 to {{getDaysInMonth()}} {{months[attendanceMonth - 1]}}</span>
                        </div>
                      </div>
                      <div class="md-summary-chips">
                        <span class="md-chip chip-p">🟢 Present: {{row.presentDays}}</span>
                        <span class="md-chip chip-l">🟡 Late: {{row.lateDays}}</span>
                        <span class="md-chip chip-a">🔴 Absent: {{row.absentDays}}</span>
                        <span class="md-chip chip-hd">🟣 Half: {{row.halfDays}}</span>
                        <span class="md-chip chip-off">⚪ Sun/Off: {{row.holidayDays}}</span>
                        <span class="md-chip chip-unmarked">➖ Unmarked: {{getUnmarkedDays(row)}}</span>
                      </div>
                    </div>

                    <!-- Day Cards Horizontal Strip -->
                    <div class="daily-strip-container">
                      <div class="day-card" *ngFor="let d of getTeacherDailyMatrix(row)"
                        [ngClass]="'day-' + d.status.toLowerCase()"
                        [class.day-is-sunday]="d.isSunday"
                        [matTooltip]="d.label">
                        <span class="day-card-num">{{d.day < 10 ? '0' + d.day : d.day}}</span>
                        <span class="day-card-name">{{d.dayOfWeek}}</span>
                        <span class="day-card-badge">{{d.status}}</span>
                      </div>
                    </div>

                    <!-- Legend footer -->
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
            <tr *ngIf="!loadingAttendance && displayedAttendanceRows.length === 0">
              <td colspan="10" class="empty-table-cell">No attendance records found matching the search criteria for {{months[attendanceMonth - 1]}} {{attendanceYear}}.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer Bar for Attendance -->
      <div class="pagination-footer-bar" *ngIf="attendanceReport && attendanceTotalCount > 0">
        <div class="pagination-left">
          <span class="page-summary">
            Showing <strong>{{attendanceStartIndex + 1}} – {{attendanceEndIndex}}</strong> of <strong>{{attendanceTotalCount}}</strong> faculty
          </span>
          <div class="page-size-wrap">
            <label>Rows per page:</label>
            <div class="size-btn-group">
              <button type="button" class="size-pill" [class.active]="attendancePageSize === 10" (click)="setAttendancePageSize(10)">10</button>
              <button type="button" class="size-pill" [class.active]="attendancePageSize === 25" (click)="setAttendancePageSize(25)">25</button>
              <button type="button" class="size-pill" [class.active]="attendancePageSize === 50" (click)="setAttendancePageSize(50)">50</button>
              <button type="button" class="size-pill" [class.active]="attendancePageSize === 100" (click)="setAttendancePageSize(100)">100</button>
            </div>
          </div>
        </div>
        <div class="pagination-right">
          <button type="button" class="nav-page-btn" [disabled]="attendancePage === 1 || loadingAttendance" (click)="setAttendancePage(1)" matTooltip="First Page">
            <mat-icon>first_page</mat-icon>
          </button>
          <button type="button" class="nav-page-btn" [disabled]="attendancePage === 1 || loadingAttendance" (click)="setAttendancePage(attendancePage - 1)" matTooltip="Previous Page">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <div class="page-current-badge">
            Page <strong>{{attendancePage}}</strong> of <strong>{{totalAttendancePages}}</strong>
          </div>
          <button type="button" class="nav-page-btn" [disabled]="attendancePage >= totalAttendancePages || loadingAttendance" (click)="setAttendancePage(attendancePage + 1)" matTooltip="Next Page">
            <mat-icon>chevron_right</mat-icon>
          </button>
          <button type="button" class="nav-page-btn" [disabled]="attendancePage >= totalAttendancePages || loadingAttendance" (click)="setAttendancePage(totalAttendancePages)" matTooltip="Last Page">
            <mat-icon>last_page</mat-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- TAB 3: Faculty Payroll Register -->
    <div class="tab-content" *ngIf="selectedTab === 'payroll'">
      <!-- Controls Bar -->
      <div class="filter-card">
        <div class="month-selector-group">
          <div class="select-field">
            <label>Month:</label>
            <select [(ngModel)]="payrollMonth" (change)="loadPayrollReport(1)">
              <option *ngFor="let m of months; let i = index" [value]="i + 1">{{m}}</option>
            </select>
          </div>
          <div class="select-field">
            <label>Year:</label>
            <select [(ngModel)]="payrollYear" (change)="loadPayrollReport(1)">
              <option *ngFor="let y of years" [value]="y">{{y}}</option>
            </select>
          </div>
        </div>

        <div class="search-input-wrap">
          <mat-icon>search</mat-icon>
          <input type="text" placeholder="Search by faculty, code, receipt #..." [(ngModel)]="payrollSearch" (ngModelChange)="onPayrollSearchChange()">
          <button type="button" class="clear-search-btn" *ngIf="payrollSearch" (click)="clearPayrollSearch()" matTooltip="Clear search">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="filter-select-wrap">
          <label>Mode:</label>
          <select [(ngModel)]="payrollModeFilter" (change)="onPayrollFilterChange()">
            <option value="all">All Modes</option>
            <option value="Cash">Cash</option>
            <option value="BankTransfer">Bank Transfer</option>
            <option value="Cheque">Cheque</option>
            <option value="UPI">UPI</option>
          </select>
        </div>

        <button mat-stroked-button class="refresh-workload-btn" (click)="loadPayrollReport(payrollPage)" matTooltip="Refresh payroll register">
          <mat-icon>refresh</mat-icon> Refresh
        </button>
      </div>

      <!-- Payroll KPIs -->
      <div class="kpi-grid" *ngIf="payrollReport">
        <div class="kpi-card blue">
          <div class="kpi-icon"><mat-icon>payments</mat-icon></div>
          <div class="kpi-data">
            <span class="kpi-label">Gross Payroll</span>
            <span class="kpi-val">₹{{payrollReport.totalGrossAmount | number:'1.0-0'}}</span>
          </div>
        </div>
        <div class="kpi-card rose">
          <div class="kpi-icon"><mat-icon>remove_circle_outline</mat-icon></div>
          <div class="kpi-data">
            <span class="kpi-label">Total Deductions</span>
            <span class="kpi-val">₹{{payrollReport.totalDeductions | number:'1.0-0'}}</span>
          </div>
        </div>
        <div class="kpi-card amber">
          <div class="kpi-icon"><mat-icon>price_change</mat-icon></div>
          <div class="kpi-data">
            <span class="kpi-label">Advances Adjusted</span>
            <span class="kpi-val">₹{{payrollReport.totalAdvancesAdjusted | number:'1.0-0'}}</span>
          </div>
        </div>
        <div class="kpi-card emerald">
          <div class="kpi-icon"><mat-icon>account_balance_wallet</mat-icon></div>
          <div class="kpi-data">
            <span class="kpi-label">Total Net Paid</span>
            <span class="kpi-val">₹{{payrollReport.totalNetPaid | number:'1.0-0'}}</span>
          </div>
        </div>
        <div class="kpi-card teal">
          <div class="kpi-icon"><mat-icon>done_all</mat-icon></div>
          <div class="kpi-data">
            <span class="kpi-label">Disbursement Ratio</span>
            <span class="kpi-val">{{payrollReport.paidTeachersCount}} / {{payrollReport.totalTeachers}}</span>
          </div>
        </div>
      </div>

      <!-- Payroll Table -->
      <div class="table-responsive-container" *ngIf="payrollReport">
        <mat-progress-bar mode="indeterminate" *ngIf="loadingPayroll" class="table-progress-bar"></mat-progress-bar>
        <table class="report-table payroll-table" [class.table-loading]="loadingPayroll">
          <thead>
            <tr>
              <th class="sortable-th col-receipt" (click)="onPayrollSort('receipt')">
                <div class="th-content">
                  <span>Receipt #</span>
                  <mat-icon class="sort-ico" *ngIf="payrollSortBy === 'receipt'">{{ payrollSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="payrollSortBy !== 'receipt'">unfold_more</mat-icon>
                </div>
              </th>
              <th class="sortable-th col-faculty" (click)="onPayrollSort('name')">
                <div class="th-content">
                  <span>Faculty Name &amp; Code</span>
                  <mat-icon class="sort-ico" *ngIf="payrollSortBy === 'name'">{{ payrollSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="payrollSortBy !== 'name'">unfold_more</mat-icon>
                </div>
              </th>
              <th class="sortable-th col-paydate" (click)="onPayrollSort('date')">
                <div class="th-content">
                  <span>Payment Date</span>
                  <mat-icon class="sort-ico" *ngIf="payrollSortBy === 'date'">{{ payrollSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="payrollSortBy !== 'date'">unfold_more</mat-icon>
                </div>
              </th>
              <th class="text-right sortable-th col-amount" (click)="onPayrollSort('gross')">
                <div class="th-content text-right">
                  <span>Gross Amount</span>
                  <mat-icon class="sort-ico" *ngIf="payrollSortBy === 'gross'">{{ payrollSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="payrollSortBy !== 'gross'">unfold_more</mat-icon>
                </div>
              </th>
              <th class="text-right sortable-th col-deduct" (click)="onPayrollSort('deductions')">
                <div class="th-content text-right">
                  <span>Deductions</span>
                  <mat-icon class="sort-ico" *ngIf="payrollSortBy === 'deductions'">{{ payrollSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="payrollSortBy !== 'deductions'">unfold_more</mat-icon>
                </div>
              </th>
              <th class="text-right sortable-th col-advance" (click)="onPayrollSort('advance')">
                <div class="th-content text-right">
                  <span>Advance Adj</span>
                  <mat-icon class="sort-ico" *ngIf="payrollSortBy === 'advance'">{{ payrollSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="payrollSortBy !== 'advance'">unfold_more</mat-icon>
                </div>
              </th>
              <th class="text-right sortable-th col-net" (click)="onPayrollSort('net')">
                <div class="th-content text-right">
                  <span>Net Paid</span>
                  <mat-icon class="sort-ico" *ngIf="payrollSortBy === 'net'">{{ payrollSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="payrollSortBy !== 'net'">unfold_more</mat-icon>
                </div>
              </th>
              <th class="text-center sortable-th col-mode" (click)="onPayrollSort('mode')">
                <div class="th-content text-center">
                  <span>Mode</span>
                  <mat-icon class="sort-ico" *ngIf="payrollSortBy === 'mode'">{{ payrollSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="payrollSortBy !== 'mode'">unfold_more</mat-icon>
                </div>
              </th>
              <th class="col-ref">Transaction Ref</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of displayedPayrollPayments">
              <td class="col-receipt">
                <span class="receipt-badge">{{p.receiptNumber}}</span>
              </td>
              <td class="col-faculty">
                <div class="faculty-name-cell">
                  <div class="avatar-circle">
                    <img
                      *ngIf="getTeacherPhoto(p) && !imgErrors[p.teacherId]"
                      [src]="getTeacherPhoto(p)"
                      (error)="imgErrors[p.teacherId] = true"
                      class="faculty-photo-img"
                      [alt]="p.teacherName"
                    />
                    <span *ngIf="!getTeacherPhoto(p) || imgErrors[p.teacherId]" class="avatar-initials">
                      {{ getInitials(p.teacherName) }}
                    </span>
                  </div>
                  <div>
                    <span class="name-bold">{{p.teacherName}}</span>
                    <span class="code-sub">{{p.employeeCode}}</span>
                  </div>
                </div>
              </td>
              <td class="col-paydate">{{p.paymentDate | date:'dd MMM yyyy'}}</td>
              <td class="text-right col-amount">₹{{p.grossAmount | number:'1.2-2'}}</td>
              <td class="text-right text-rose col-deduct">₹{{p.deductions | number:'1.2-2'}}</td>
              <td class="text-right text-amber col-advance">₹{{p.advanceAdjusted | number:'1.2-2'}}</td>
              <td class="text-right text-emerald font-bold col-net">₹{{p.netPaid | number:'1.2-2'}}</td>
              <td class="text-center col-mode">
                <span class="mode-chip">{{p.paymentMode}}</span>
              </td>
              <td class="col-ref">
                <span class="ref-text">{{p.transactionRef || 'N/A'}}</span>
              </td>
            </tr>
            <tr *ngIf="!loadingPayroll && displayedPayrollPayments.length === 0">
              <td colspan="9" class="empty-table-cell">
                No salary payments found matching the search criteria for {{payrollReport.monthName || ''}}.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer Bar for Payroll -->
      <div class="pagination-footer-bar" *ngIf="payrollReport && payrollTotalCount > 0">
        <div class="pagination-left">
          <span class="page-summary">
            Showing <strong>{{payrollStartIndex + 1}} – {{payrollEndIndex}}</strong> of <strong>{{payrollTotalCount}}</strong> receipts
          </span>
          <div class="page-size-wrap">
            <label>Rows per page:</label>
            <div class="size-btn-group">
              <button type="button" class="size-pill" [class.active]="payrollPageSize === 10" (click)="setPayrollPageSize(10)">10</button>
              <button type="button" class="size-pill" [class.active]="payrollPageSize === 25" (click)="setPayrollPageSize(25)">25</button>
              <button type="button" class="size-pill" [class.active]="payrollPageSize === 50" (click)="setPayrollPageSize(50)">50</button>
              <button type="button" class="size-pill" [class.active]="payrollPageSize === 100" (click)="setPayrollPageSize(100)">100</button>
            </div>
          </div>
        </div>

        <div class="pagination-right" *ngIf="totalPayrollPages > 1">
          <button type="button" class="nav-page-btn" [disabled]="payrollPage === 1 || loadingPayroll" (click)="setPayrollPage(1)" matTooltip="First Page">
            <mat-icon>first_page</mat-icon>
          </button>
          <button type="button" class="nav-page-btn" [disabled]="payrollPage === 1 || loadingPayroll" (click)="setPayrollPage(payrollPage - 1)" matTooltip="Previous Page">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <div class="page-current-badge">
            <span>Page</span>
            <strong>{{payrollPage}}</strong>
            <span>of</span>
            <strong>{{totalPayrollPages}}</strong>
          </div>
          <button type="button" class="nav-page-btn" [disabled]="payrollPage >= totalPayrollPages || loadingPayroll" (click)="setPayrollPage(payrollPage + 1)" matTooltip="Next Page">
            <mat-icon>chevron_right</mat-icon>
          </button>
          <button type="button" class="nav-page-btn" [disabled]="payrollPage >= totalPayrollPages || loadingPayroll" (click)="setPayrollPage(totalPayrollPages)" matTooltip="Last Page">
            <mat-icon>last_page</mat-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- TAB 4: Master Timetable Routine Matrix -->
    <div class="tab-content" *ngIf="selectedTab === 'master_timetable'">
      <!-- Master Routine KPIs -->
      <div class="kpi-grid">
        <div class="kpi-card blue">
          <div class="kpi-icon"><mat-icon>event_note</mat-icon></div>
          <div class="kpi-data">
            <span class="kpi-label">Routine Slots</span>
            <span class="kpi-val">{{masterTotalCount || masterTotalSlots}}</span>
          </div>
        </div>
        <div class="kpi-card emerald">
          <div class="kpi-icon"><mat-icon>groups</mat-icon></div>
          <div class="kpi-data">
            <span class="kpi-label">Active Teachers</span>
            <span class="kpi-val">{{masterUniqueTeachersCount}}</span>
          </div>
        </div>
        <div class="kpi-card purple">
          <div class="kpi-icon"><mat-icon>school</mat-icon></div>
          <div class="kpi-data">
            <span class="kpi-label">Batches / Classes</span>
            <span class="kpi-val">{{masterUniqueBatchesCount}}</span>
          </div>
        </div>
        <div class="kpi-card orange">
          <div class="kpi-icon"><mat-icon>menu_book</mat-icon></div>
          <div class="kpi-data">
            <span class="kpi-label">Subjects Covered</span>
            <span class="kpi-val">{{masterUniqueSubjectsCount}}</span>
          </div>
        </div>
      </div>

      <!-- Controls & View Mode Bar -->
      <div class="filter-card">
        <div class="search-input-wrap">
          <mat-icon>search</mat-icon>
          <input type="text" placeholder="Search faculty, batch, subject, room..." [(ngModel)]="masterSearch" (ngModelChange)="onMasterSearchChange()">
          <button type="button" class="clear-search-btn" *ngIf="masterSearch" (click)="clearMasterSearch()" matTooltip="Clear search">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="filter-select-wrap">
          <label>Filter Day:</label>
          <select [(ngModel)]="masterDayFilter" (change)="onMasterDayFilterChange()">
            <option value="all">All Days (Mon - Sun)</option>
            <option *ngFor="let d of allDays" [value]="d">{{d}}</option>
          </select>
        </div>

        <button mat-stroked-button class="quick-today-btn" (click)="filterByToday()" matTooltip="Quick filter today's scheduled classes">
          <mat-icon>today</mat-icon> Today ({{todayDayName}})
        </button>

        <div class="view-mode-toggle-group">
          <button type="button" class="view-mode-btn" [class.active]="masterViewMode === 'list'" (click)="masterViewMode = 'list'" matTooltip="Tabular List View">
            <mat-icon>format_list_bulleted</mat-icon> List
          </button>
          <button type="button" class="view-mode-btn" [class.active]="masterViewMode === 'matrix'" (click)="masterViewMode = 'matrix'" matTooltip="Weekly Schedule Matrix">
            <mat-icon>calendar_view_week</mat-icon> Matrix
          </button>
        </div>

        <button mat-stroked-button class="refresh-workload-btn" (click)="loadMasterTimetable(masterPage)" matTooltip="Refresh master routine">
          <mat-icon>refresh</mat-icon> Refresh
        </button>
      </div>

      <!-- Single Loader -->
      <mat-progress-bar mode="indeterminate" *ngIf="loadingMasterTimetable" class="table-progress-bar"></mat-progress-bar>

      <!-- View 1: List View -->
      <div class="table-responsive-container" *ngIf="masterViewMode === 'list'">
        <table class="report-table" [class.table-loading]="loadingMasterTimetable">
          <thead>
            <tr>
              <th class="sortable-th" (click)="onMasterSort('teacher')" style="min-width: 180px;">
                <span class="th-content">
                  Faculty Name
                  <mat-icon class="sort-ico" *ngIf="masterSortBy === 'teacher'">{{masterSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="masterSortBy !== 'teacher'">unfold_more</mat-icon>
                </span>
              </th>
              <th class="sortable-th" (click)="onMasterSort('batch')" style="min-width: 160px;">
                <span class="th-content">
                  Batch / Class
                  <mat-icon class="sort-ico" *ngIf="masterSortBy === 'batch'">{{masterSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="masterSortBy !== 'batch'">unfold_more</mat-icon>
                </span>
              </th>
              <th class="sortable-th" (click)="onMasterSort('subject')" style="min-width: 140px;">
                <span class="th-content">
                  Subject
                  <mat-icon class="sort-ico" *ngIf="masterSortBy === 'subject'">{{masterSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="masterSortBy !== 'subject'">unfold_more</mat-icon>
                </span>
              </th>
              <th class="sortable-th" (click)="onMasterSort('day')" style="min-width: 130px;">
                <span class="th-content">
                  Routine Days
                  <mat-icon class="sort-ico" *ngIf="masterSortBy === 'day'">{{masterSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="masterSortBy !== 'day'">unfold_more</mat-icon>
                </span>
              </th>
              <th class="sortable-th" (click)="onMasterSort('slot')" style="min-width: 150px;">
                <span class="th-content">
                  Time Slot
                  <mat-icon class="sort-ico" *ngIf="masterSortBy === 'slot'">{{masterSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="masterSortBy !== 'slot'">unfold_more</mat-icon>
                </span>
              </th>
              <th class="sortable-th" (click)="onMasterSort('room')" style="min-width: 110px;">
                <span class="th-content">
                  Room
                  <mat-icon class="sort-ico" *ngIf="masterSortBy === 'room'">{{masterSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}}</mat-icon>
                  <mat-icon class="sort-ico-idle" *ngIf="masterSortBy !== 'room'">unfold_more</mat-icon>
                </span>
              </th>
              <th class="text-center" style="min-width: 90px;">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let m of displayedMasterTimetable">
              <td>
                <div class="faculty-name-cell">
                  <div class="avatar-circle">
                    <img
                      *ngIf="getTeacherPhoto(m) && !imgErrors[m.teacherId]"
                      [src]="getTeacherPhoto(m)"
                      (error)="imgErrors[m.teacherId] = true"
                      class="faculty-photo-img"
                      [alt]="m.teacherName"
                    />
                    <span *ngIf="!getTeacherPhoto(m) || imgErrors[m.teacherId]" class="avatar-initials">
                      {{ getInitials(m.teacherName) }}
                    </span>
                  </div>
                  <div>
                    <span class="name-bold">{{m.teacherName}}</span>
                    <span class="code-sub" *ngIf="m.employeeCode">{{m.employeeCode}}</span>
                  </div>
                </div>
              </td>
              <td>
                <strong class="batch-col-name">{{m.batchName || m.className}}</strong>
              </td>
              <td>
                <span class="subject-chip">{{m.subject}}</span>
              </td>
              <td>
                <span class="days-badge">{{m.daysOfWeek || 'All Days'}}</span>
              </td>
              <td>
                <span class="slot-badge"><mat-icon class="inline-icon">schedule</mat-icon> {{m.timeSlot || 'Standard Slot'}}</span>
              </td>
              <td>
                <span class="room-pill" *ngIf="m.roomNumber"><mat-icon class="inline-icon">meeting_room</mat-icon> {{m.roomNumber}}</span>
                <span class="text-muted" *ngIf="!m.roomNumber">—</span>
              </td>
              <td class="text-center">
                <span class="status-chip active-chip">Active</span>
              </td>
            </tr>
            <tr *ngIf="!loadingMasterTimetable && displayedMasterTimetable.length === 0">
              <td colspan="7" class="empty-table-cell">No routine assignments match the search query.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer Bar for Master Routine -->
      <div class="pagination-footer-bar" *ngIf="masterViewMode === 'list' && masterTotalCount > 0">
        <div class="pagination-left">
          <span class="page-summary">
            Showing <strong>{{masterStartIndex + 1}} – {{masterEndIndex}}</strong> of <strong>{{masterTotalCount}}</strong> routine slots
          </span>
          <div class="page-size-wrap">
            <label>Rows per page:</label>
            <div class="size-btn-group">
              <button type="button" class="size-pill" [class.active]="masterPageSize === 10" (click)="setMasterPageSize(10)">10</button>
              <button type="button" class="size-pill" [class.active]="masterPageSize === 25" (click)="setMasterPageSize(25)">25</button>
              <button type="button" class="size-pill" [class.active]="masterPageSize === 50" (click)="setMasterPageSize(50)">50</button>
              <button type="button" class="size-pill" [class.active]="masterPageSize === 100" (click)="setMasterPageSize(100)">100</button>
            </div>
          </div>
        </div>
        <div class="pagination-right">
          <button type="button" class="nav-page-btn" [disabled]="masterPage === 1 || loadingMasterTimetable" (click)="setMasterPage(1)" matTooltip="First Page">
            <mat-icon>first_page</mat-icon>
          </button>
          <button type="button" class="nav-page-btn" [disabled]="masterPage === 1 || loadingMasterTimetable" (click)="setMasterPage(masterPage - 1)" matTooltip="Previous Page">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <div class="page-current-badge">
            Page <strong>{{masterPage}}</strong> of <strong>{{totalMasterPages}}</strong>
          </div>
          <button type="button" class="nav-page-btn" [disabled]="masterPage >= totalMasterPages || loadingMasterTimetable" (click)="setMasterPage(masterPage + 1)" matTooltip="Next Page">
            <mat-icon>chevron_right</mat-icon>
          </button>
          <button type="button" class="nav-page-btn" [disabled]="masterPage >= totalMasterPages || loadingMasterTimetable" (click)="setMasterPage(totalMasterPages)" matTooltip="Last Page">
            <mat-icon>last_page</mat-icon>
          </button>
        </div>
      </div>

      <!-- View 2: Weekly Matrix Grid View -->
      <div class="weekly-routine-matrix" *ngIf="masterViewMode === 'matrix'">
        <div class="matrix-day-card" *ngFor="let dayGroup of routineGroupedByDay" [class.is-today-card]="dayGroup.isToday">
          <div class="matrix-day-header">
            <div class="day-title-box">
              <span class="day-title">{{dayGroup.dayFullName}}</span>
              <span class="today-tag" *ngIf="dayGroup.isToday">Today</span>
            </div>
            <span class="day-slot-count">{{dayGroup.items.length}} Class{{dayGroup.items.length === 1 ? '' : 'es'}}</span>
          </div>

          <div class="matrix-slots-list" *ngIf="dayGroup.items.length > 0">
            <div class="routine-slot-item" *ngFor="let s of dayGroup.items">
              <div class="slot-item-time">
                <mat-icon>schedule</mat-icon>
                <span>{{s.timeSlot || 'Scheduled Slot'}}</span>
              </div>
              <div class="slot-item-body">
                <div class="slot-teacher">
                  <div class="mini-avatar">
                    <img *ngIf="getTeacherPhoto(s) && !imgErrors[s.teacherId]" [src]="getTeacherPhoto(s)" (error)="imgErrors[s.teacherId] = true" class="mini-img" />
                    <span *ngIf="!getTeacherPhoto(s) || imgErrors[s.teacherId]" class="mini-initials">{{getInitials(s.teacherName)}}</span>
                  </div>
                  <div class="slot-teacher-info">
                    <span class="slot-teacher-name">{{s.teacherName}}</span>
                    <span class="slot-subject-badge">{{s.subject}}</span>
                  </div>
                </div>
                <div class="slot-meta-row">
                  <span class="slot-batch-badge"><mat-icon>class</mat-icon> {{s.batchName || s.className}}</span>
                  <span class="slot-room-badge" *ngIf="s.roomNumber"><mat-icon>meeting_room</mat-icon> {{s.roomNumber}}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="matrix-empty-day" *ngIf="dayGroup.items.length === 0">
            <mat-icon>event_busy</mat-icon>
            <span>No routine classes scheduled for {{dayGroup.dayFullName}}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- SLOTS DETAILS MODAL -->
  <div class="modal-backdrop" *ngIf="selectedTeacherDetails" (click)="selectedTeacherDetails = null">
    <div class="modal-card" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title-box">
          <div class="modal-icon-box">
            <img
              *ngIf="getTeacherPhoto(selectedTeacherDetails) && !imgErrors[selectedTeacherDetails.teacherId]"
              [src]="getTeacherPhoto(selectedTeacherDetails)"
              (error)="imgErrors[selectedTeacherDetails.teacherId] = true"
              class="modal-photo-img"
              [alt]="selectedTeacherDetails.teacherName"
            />
            <span *ngIf="!getTeacherPhoto(selectedTeacherDetails) || imgErrors[selectedTeacherDetails.teacherId]" class="modal-initials">
              {{ getInitials(selectedTeacherDetails.teacherName) }}
            </span>
          </div>
          <div>
            <h3>{{selectedTeacherDetails.teacherName}}</h3>
            <p><strong>{{selectedTeacherDetails.employeeCode}}</strong> • {{selectedTeacherDetails.qualification}}</p>
          </div>
        </div>
        <button mat-icon-button class="modal-close-btn" (click)="selectedTeacherDetails = null">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="modal-body">
        <div class="modal-kpis">
          <div class="modal-kpi">
            <span>{{ authService.hasSchoolModule() && !authService.hasCoachingModule() ? 'Total Classes' : (authService.hasSchoolModule() && authService.hasCoachingModule() ? 'Classes / Batches' : 'Total Batches') }}</span>
            <strong>{{selectedTeacherDetails.assignedBatchCount}}</strong>
          </div>
          <div class="modal-kpi">
            <span>Classes / Week</span>
            <strong>{{selectedTeacherDetails.weeklyClassesCount}}</strong>
          </div>
          <div class="modal-kpi">
            <span>Hours / Week</span>
            <strong>{{selectedTeacherDetails.weeklyHours}} hrs</strong>
          </div>
          <div class="modal-kpi">
            <span>Students Reached</span>
            <strong>{{selectedTeacherDetails.totalStudentReach}}</strong>
          </div>
        </div>

        <h4>Assigned Routine Slots:</h4>
        <div class="slots-breakdown-list">
          <div class="slot-breakdown-card" *ngFor="let s of selectedTeacherDetails.assignedBatches">
            <div class="sbc-title">
              <div class="title-with-pill" style="display: flex; align-items: center; gap: 8px;">
                <strong>{{ s.batchName || (s.className ? (s.className + (s.sectionName ? ' - ' + s.sectionName : '')) : 'Teaching Unit') }}</strong>
                <span class="badge-scope school" *ngIf="s.classId || s.className" style="font-size: 0.7rem; font-weight: 700; color: #0284c7; background: #e0f2fe; padding: 2px 8px; border-radius: 4px; border: 1px solid #bae6fd;">
                  School Class
                </span>
                <span class="badge-scope coaching" *ngIf="!s.classId && !s.className" style="font-size: 0.7rem; font-weight: 700; color: #059669; background: #ecfdf5; padding: 2px 8px; border-radius: 4px; border: 1px solid #a7f3d0;">
                  Coaching Batch
                </span>
              </div>
              <span class="sbc-sub">{{s.subject}}</span>
            </div>
            <div class="sbc-details">
              <span><mat-icon>date_range</mat-icon> {{s.daysOfWeek}}</span>
              <span><mat-icon>schedule</mat-icon> {{s.timeSlot}}</span>
            </div>
          </div>
          <div *ngIf="selectedTeacherDetails.assignedBatches.length === 0" class="empty-slots-msg">
            No routine slots assigned yet for this faculty member.
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- PRINTABLE ONLY TEMPLATE (SMART EXECUTIVE AUDIT REPORT) -->
  <div class="printable-report-sheet" id="printable-area">
    <!-- Letterhead Header -->
    <div class="print-letterhead">
      <div class="print-brand-left">
        <div class="print-logo-box" [class.has-img]="logoUrl && !logoFailed">
          <img *ngIf="logoUrl && !logoFailed" [src]="logoUrl" (error)="logoFailed = true" alt="Logo" class="print-logo-img">
          <span *ngIf="!logoUrl || logoFailed">{{ tenantCode }}</span>
        </div>
        <div class="print-institute-details">
          <h1 class="print-inst-name">{{instituteName}}</h1>
          <p class="print-inst-tagline">Excellence in Coaching & Competitive Exams • Enterprise Coaching Management ERP</p>
          <div class="print-meta-line">
            <span><strong>Branch Campus:</strong> {{branchName}}</span>
            <span class="meta-sep">•</span>
            <span><strong>System:</strong> IMSERP Coaching SaaS</span>
          </div>
        </div>
      </div>
      <div class="print-brand-right">
        <div class="print-badge">OFFICIAL AUDIT REPORT</div>
        <div class="print-doc-meta">
          <div><span>Ref:</span> <strong>IMS-{{selectedTab.toUpperCase()}}-{{todayDate | date:'yyyyMMdd'}}</strong></div>
          <div><span>Date:</span> <strong>{{todayDate | date:'dd MMM yyyy, hh:mm a'}}</strong></div>
          <div><span>Scope:</span> <strong>{{getActiveTabScope()}}</strong></div>
        </div>
      </div>
    </div>

    <!-- Title Bar -->
    <div class="print-title-strip">
      <h2>{{getActiveTabTitle()}}</h2>
    </div>

    <!-- Executive Summary KPI Tiles -->
    <div class="print-kpi-summary" *ngIf="selectedTab === 'attendance' && attendanceReport">
      <div class="pkpi-box">
        <span class="pkpi-label">Total Faculty</span>
        <strong class="pkpi-value">{{attendanceReport.totalRecords}}</strong>
      </div>
      <div class="pkpi-box">
        <span class="pkpi-label">Total Present</span>
        <strong class="pkpi-value text-emerald">{{attendanceReport.totalPresent}}</strong>
      </div>
      <div class="pkpi-box">
        <span class="pkpi-label">Total Absent</span>
        <strong class="pkpi-value text-rose">{{attendanceReport.totalAbsent}}</strong>
      </div>
      <div class="pkpi-box">
        <span class="pkpi-label">Late Days</span>
        <strong class="pkpi-value text-amber">{{attendanceReport.totalLate}}</strong>
      </div>
      <div class="pkpi-box">
        <span class="pkpi-label">Avg Attendance</span>
        <strong class="pkpi-value">{{overallAttendanceRate}}%</strong>
      </div>
    </div>

    <div class="print-kpi-summary" *ngIf="selectedTab === 'workload' && workloadReport">
      <div class="pkpi-box">
        <span class="pkpi-label">Active Faculty</span>
        <strong class="pkpi-value">{{workloadReport.totalActiveTeachers}}</strong>
      </div>
      <div class="pkpi-box">
        <span class="pkpi-label">Assigned Batches</span>
        <strong class="pkpi-value">{{workloadReport.totalAssignedBatches}}</strong>
      </div>
      <div class="pkpi-box">
        <span class="pkpi-label">Weekly Classes</span>
        <strong class="pkpi-value">{{workloadReport.totalWeeklyClasses}}</strong>
      </div>
      <div class="pkpi-box">
        <span class="pkpi-label">Weekly Load</span>
        <strong class="pkpi-value">{{workloadReport.totalWeeklyHours}} hrs</strong>
      </div>
      <div class="pkpi-box">
        <span class="pkpi-label">Students Reached</span>
        <strong class="pkpi-value">{{workloadReport.totalStudentsReached}}</strong>
      </div>
    </div>

    <div class="print-kpi-summary" *ngIf="selectedTab === 'payroll' && payrollReport">
      <div class="pkpi-box">
        <span class="pkpi-label">Gross Payroll</span>
        <strong class="pkpi-value">₹{{payrollReport.totalGrossAmount | number:'1.0-0'}}</strong>
      </div>
      <div class="pkpi-box">
        <span class="pkpi-label">Total Deductions</span>
        <strong class="pkpi-value text-rose">₹{{payrollReport.totalDeductions | number:'1.0-0'}}</strong>
      </div>
      <div class="pkpi-box">
        <span class="pkpi-label">Advances Adjusted</span>
        <strong class="pkpi-value text-amber">₹{{payrollReport.totalAdvancesAdjusted | number:'1.0-0'}}</strong>
      </div>
      <div class="pkpi-box">
        <span class="pkpi-label">Net Paid</span>
        <strong class="pkpi-value text-emerald">₹{{payrollReport.totalNetPaid | number:'1.0-0'}}</strong>
      </div>
      <div class="pkpi-box">
        <span class="pkpi-label">Disbursement Ratio</span>
        <strong class="pkpi-value">{{payrollReport.paidTeachersCount}} / {{payrollReport.totalTeachers}}</strong>
      </div>
    </div>

    <!-- Data Table -->
    <div class="print-table-wrapper" [innerHTML]="printableTableHtml"></div>

    <!-- Sign-Off & Verification Footer -->
    <div class="print-signoff-section">
      <div class="signoff-box">
        <div class="signoff-line"></div>
        <span class="signoff-title">Prepared By</span>
        <span class="signoff-sub">Academic Coordinator</span>
      </div>
      <div class="signoff-box">
        <div class="signoff-line"></div>
        <span class="signoff-title">Audited & Verified By</span>
        <span class="signoff-sub">HR / Accounts In-charge</span>
      </div>
      <div class="signoff-box">
        <div class="signoff-line"></div>
        <span class="signoff-title">Authorized Signatory</span>
        <span class="signoff-sub">Director / Principal (Official Seal)</span>
      </div>
    </div>

    <div class="print-doc-footer">
      <div class="footer-left">
        <p>This is a computer-generated institutional audit document produced via IMSERP Coaching & Tuition Management ERP.</p>
      </div>
      <div class="footer-right">
        <p>Confidential & Authorized • Page 1 of 1</p>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    .page-container {
      padding: 0 0 40px;
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .page-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; }
    .page-title { font-size:1.5rem; font-weight:700; margin:0; color:#1976d2; display:flex; align-items:center; gap:8px;
      mat-icon{font-size:1.6rem;width:1.6rem;height:1.6rem;} }
    .page-subtitle { color:#64748b; margin:4px 0 0; font-size:.9rem; }
    .header-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .action-btn { border-radius:8px; font-weight:600; display:flex; align-items:center; gap:6px; }

    /* Custom Tab Navigation */
    .report-tabs-wrapper { background:#ffffff; border-radius:14px; border:1px solid #e2e8f0; overflow:hidden; }
    .custom-tab-nav { display:flex; background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:6px; gap:6px; overflow-x:auto; -webkit-overflow-scrolling:touch; }
    .tab-pill { border:none; background:transparent; padding:10px 18px; border-radius:8px; font-size:.88rem; font-weight:600; color:#64748b; cursor:pointer; display:flex; align-items:center; gap:8px; white-space:nowrap; transition:all .15s;
      mat-icon{font-size:20px;width:20px;height:20px;} }
    .tab-pill:hover { background:#f1f5f9; color:#1e293b; }
    .tab-pill.active { background:#fff; color:#1976d2; font-weight:700; box-shadow:0 2px 6px rgba(0,0,0,0.06); }

    .tab-content { padding:20px; display:flex; flex-direction:column; gap:20px; }

    /* KPI Grid */
    .kpi-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; }
    .kpi-card { background:#ffffff; border-radius:12px; border:1px solid #e2e8f0; padding:16px; display:flex; align-items:center; gap:14px; box-shadow:0 2px 8px rgba(0,0,0,0.03); position:relative; overflow:hidden; }
    .kpi-card::before { content:''; position:absolute; top:0; left:0; width:4px; height:100%; }
    .kpi-card.blue::before { background:#3b82f6; }
    .kpi-card.purple::before { background:#8b5cf6; }
    .kpi-card.teal::before { background:#14b8a6; }
    .kpi-card.orange::before { background:#f97316; }
    .kpi-card.emerald::before { background:#10b981; }
    .kpi-card.rose::before { background:#f43f5e; }
    .kpi-card.amber::before { background:#f59e0b; }

    .kpi-icon { width:44px; height:44px; border-radius:10px; display:flex; align-items:center; justify-content:center;
      mat-icon{font-size:24px;width:24px;height:24px;} }
    .kpi-card.blue .kpi-icon { background:#eff6ff; color:#2563eb; }
    .kpi-card.purple .kpi-icon { background:#f5f3ff; color:#7c3aed; }
    .kpi-card.teal .kpi-icon { background:#f0fdfa; color:#0d9488; }
    .kpi-card.orange .kpi-icon { background:#fff7ed; color:#ea580c; }
    .kpi-card.emerald .kpi-icon { background:#ecfdf5; color:#059669; }
    .kpi-card.rose .kpi-icon { background:#fff1f2; color:#e11d48; }
    .kpi-card.amber .kpi-icon { background:#fffbeb; color:#d97706; }

    .kpi-data { display:flex; flex-direction:column; gap:2px; }
    .kpi-label { font-size:.78rem; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:.5px; }
    .kpi-val { font-size:1.35rem; font-weight:800; color:#0f172a; line-height:1.2; }

    /* Filter Card */
    .filter-card {
      background: #f8fafc;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .search-input-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 0 12px;
      height: 40px;
      box-sizing: border-box;
      flex: 1;
      min-width: 240px;
      transition: all .2s;
      &:focus-within { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
      mat-icon { color: #2563eb; font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
      input { border: none; outline: none; font-size: .88rem; color: #1e293b; width: 100%; height: 100%; background: transparent; }
    }
    .filter-select-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: .84rem;
      font-weight: 600;
      color: #475569;
      select {
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 0 12px;
        height: 40px;
        box-sizing: border-box;
        font-size: .86rem;
        font-weight: 600;
        color: #1e293b;
        background: #fff;
        outline: none;
        transition: all .2s;
        cursor: pointer;
        &:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
      }
    }
    .month-selector-group { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
    .select-field { display:flex; align-items:center; gap:6px; font-size:.86rem; font-weight:600; color:#475569;
      select{border:1px solid #cbd5e1;border-radius:8px;padding:0 10px;height:40px;box-sizing:border-box;font-size:.86rem;font-weight:600;color:#1e293b;background:#fff;outline:none;cursor:pointer;transition:all .2s;&:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,0.1);}} }
    .refresh-btn { height:40px !important; font-weight:600; border-radius:8px; }
    .refresh-workload-btn {
      height: 40px !important;
      font-weight: 600;
      border-radius: 8px;
      border-color: #cbd5e1;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all .2s;
      &:hover { border-color: #2563eb; color: #2563eb; background: #eff6ff; }
    }
    .clear-search-btn { border:none; background:transparent; cursor:pointer; padding:0; display:flex; align-items:center; justify-content:center;
      mat-icon { font-size:18px; width:18px; height:18px; color:#94a3b8; }
      &:hover mat-icon { color:#64748b; } }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    /* Sortable Header */
    .sortable-th { cursor:pointer; user-select:none; transition:background .15s;
      &:hover { background:#f1f5f9 !important; } }
    .th-content { display:inline-flex; align-items:center; gap:6px; vertical-align:middle;
      &.text-center { justify-content:center; width:100%; }
      &.text-right { justify-content:flex-end; width:100%; } }
    .sort-ico { font-size:16px !important; width:16px !important; height:16px !important; color:#2563eb; }
    .sort-ico-idle { font-size:16px !important; width:16px !important; height:16px !important; color:#cbd5e1; opacity:0.6; transition:opacity .15s; }
    .sortable-th:hover .sort-ico-idle { opacity:1; color:#94a3b8; }

    /* Actions Column & 3 Dots Menu - Sticky & Immediately Visible */
    .actions-th, .actions-td {
      width: 52px;
      min-width: 52px;
      max-width: 56px;
      padding: 4px 6px;
      text-align: center;
      position: sticky;
      right: 0;
      z-index: 2;
      background: #ffffff;
      box-shadow: -3px 0 6px -2px rgba(15, 23, 42, 0.08);
      border-left: 1px solid #f1f5f9;
    }
    thead .actions-th {
      background: #f8fafc;
      z-index: 3;
      border-left: 1px solid #e2e8f0;
    }
    .report-table tbody tr:hover .actions-td {
      background: #f8faff !important;
    }
    .action-menu-btn {
      width: 30px !important;
      height: 30px !important;
      padding: 0 !important;
      color: #64748b;
      transition: all 0.2s ease;
      mat-icon { font-size: 19px; width: 19px; height: 19px; line-height: 19px; }
      &:hover {
        background: #eff6ff !important;
        color: #2563eb !important;
      }
    }
    .report-table-row {
      cursor: pointer;
      transition: background .15s ease;
      &:hover {
        background: #f8faff !important;
      }
    }

    /* Table Progress & Loading Overlay */
    .table-progress-bar { height:3px !important; }
    .table-loading { opacity:0.65; pointer-events:none; transition:opacity .2s; }

    /* Pagination Footer Bar */
    .pagination-footer-bar { display:flex; justify-content:space-between; align-items:center; padding:10px 16px; background:#fff; border:1px solid #e2e8f0; border-top:none; border-bottom-left-radius:10px; border-bottom-right-radius:10px; flex-wrap:wrap; gap:12px; }
    .pagination-left { display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
    .page-summary { font-size:.84rem; color:#64748b; strong { color:#0f172a; } }
    .page-size-wrap { display:flex; align-items:center; gap:8px; font-size:.82rem; color:#64748b; }
    .size-btn-group { display:flex; gap:4px; align-items:center; }
    .size-pill { border:1px solid #cbd5e1; background:#fff; color:#475569; font-size:.76rem; font-weight:700; height:28px; padding:0 9px; border-radius:6px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:all .15s;
      &:hover { background:#f8fafc; border-color:#94a3b8; }
      &.active { background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe; } }
    .pagination-right { display:inline-flex; align-items:center; gap:6px; }
    .nav-page-btn { display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; min-width:32px; padding:0; border:1px solid #cbd5e1; background:#ffffff; color:#334155; border-radius:6px; cursor:pointer; transition:all .15s ease-in-out; outline:none;
      &:hover:not(:disabled) { background:#eff6ff; border-color:#93c5fd; color:#1d4ed8; }
      &:disabled { opacity:0.35; cursor:not-allowed; background:#f8fafc; border-color:#e2e8f0; color:#94a3b8; }
      mat-icon { font-size:18px; width:18px; height:18px; line-height:18px; display:flex; align-items:center; justify-content:center; } }
    .page-current-badge { display:inline-flex; align-items:center; justify-content:center; gap:5px; height:32px; padding:0 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; font-size:.82rem; color:#475569; white-space:nowrap; user-select:none;
      strong { color:#0f172a; font-weight:700; } }

    /* Tables */
    .table-responsive-container {
      background: #fff;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
      position: relative;
    }
    .report-table { width: 100%; border-collapse: separate; border-spacing: 0; }
    .report-table th, .report-table td {
      padding: 9px 10px;
      font-size: .84rem;
      border-bottom: 1px solid #f1f5f9;
      text-align: left;
      vertical-align: middle;
      box-sizing: border-box;
    }
    .report-table thead th {
      background: #f8fafc;
      font-weight: 700;
      color: #334155;
      border-bottom: 2px solid #e2e8f0;
      white-space: nowrap;
    }
    .report-table tbody tr:hover { background: #f8faff; }

    /* Workload Table specific tight-fit & zero horizontal scroll */
    .workload-table {
      width: 100%;
      min-width: 100%;
      table-layout: auto;
    }
    .col-faculty { min-width: 165px; }
    .col-qual { min-width: 145px; max-width: 220px; }
    .col-batches { width: 95px; min-width: 90px; text-align: center; }
    .col-classes { width: 85px; min-width: 80px; text-align: center; }
    .col-hours { width: 85px; min-width: 80px; text-align: center; }
    .col-status { width: 105px; min-width: 100px; text-align: center; }
    .col-reach { width: 90px; min-width: 85px; text-align: center; }

    /* Payroll Table specific tight-fit */
    .payroll-table {
      width: 100%;
      min-width: 100%;
      table-layout: auto;
    }
    .col-receipt { min-width: 110px; }
    .col-paydate { min-width: 100px; white-space: nowrap; }
    .col-amount { min-width: 100px; }
    .col-deduct { min-width: 90px; }
    .col-advance { min-width: 90px; }
    .col-net { min-width: 100px; }
    .col-mode { width: 90px; text-align: center; }
    .col-ref { min-width: 110px; }
    .ref-text { font-size: .8rem; color: #64748b; font-family: monospace; }

    .text-center { text-align:center !important; }
    .text-right { text-align:right !important; }
    .font-bold { font-weight:700; }
    .text-emerald { color:#059669; }
    .text-rose { color:#e11d48; }
    .text-amber { color:#d97706; }
    .text-purple { color:#7c3aed; }

    .faculty-name-cell { display:flex; align-items:center; gap:8px; }
    .avatar-circle {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      color: #1e40af;
      font-weight: 700;
      font-size: .8rem;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
      border: 1.5px solid #bfdbfe;
      box-shadow: 0 1px 3px rgba(37, 99, 235, 0.12);

      .faculty-photo-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .avatar-initials {
        font-size: 0.78rem;
        font-weight: 700;
        color: #1e40af;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }
    }
    .name-bold { font-weight:700; color:#0f172a; font-size:.85rem; display:block; white-space:nowrap; }
    .code-sub { font-size:.74rem; color:#64748b; font-family:monospace; display:block; }
    .qual-cell { display:flex; flex-direction:column; gap:1px; max-width:210px; }
    .qual-text { font-weight:600; color:#334155; font-size:.82rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .spec-sub { font-size:.72rem; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    .badge-num { background:#e0e7ff; color:#3730a3; padding:2px 7px; border-radius:6px; font-size:.76rem; font-weight:700; }
    .badge-num.badge-zero { background:#f1f5f9; color:#94a3b8; font-weight:500; }
    .metric-num { font-size:.88rem; color:#1e293b; }
    .metric-hours { font-weight:700; color:#0284c7; font-size:.84rem; }
    .reach-pill { display:inline-flex; align-items:center; gap:4px; background:#ecfdf5; color:#059669; padding:2px 7px; border-radius:6px; font-size:.76rem; font-weight:700;
      mat-icon{font-size:16px;width:16px;height:16px;} }

    .status-chip { font-size:.74rem; font-weight:700; padding:3px 10px; border-radius:20px; display:inline-block; }
    .chip-light { background:#f1f5f9; color:#475569; }
    .chip-optimal { background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; }
    .chip-heavy { background:#fff1f2; color:#e11d48; border:1px solid #fecdd3; }
    .active-chip { background:#ecfdf5; color:#059669; }

    .code-badge { display:inline-block; white-space:nowrap; background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; padding:2px 6px; border-radius:5px; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:.72rem; font-weight:700; letter-spacing:.2px; }
    .receipt-badge { background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:4px; font-family:monospace; font-size:.78rem; font-weight:700; }
    .mode-chip { background:#f1f5f9; color:#334155; padding:2px 8px; border-radius:6px; font-size:.76rem; font-weight:600; }
    .batch-col-name { color:#1e293b; font-size:.9rem; }
    .subject-chip { background:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:6px; font-size:.76rem; font-weight:600; }
    .days-badge { font-weight:600; color:#334155; font-size:.82rem; }
    .slot-badge { color:#0369a1; font-weight:600; font-size:.82rem; }

    /* Stat Pills */
    .stat-pill { display:inline-flex; align-items:center; justify-content:center; min-width:32px; padding:2px 8px; border-radius:6px; font-size:.84rem; font-weight:700; }
    .pill-present { background:#ecfdf5; color:#059669; }
    .pill-absent { background:#fff1f2; color:#e11d48; }
    .pill-late { background:#fef3c7; color:#d97706; }
    .pill-half { background:#f5f3ff; color:#7c3aed; }
    .pill-off { background:#f1f5f9; color:#64748b; font-weight:600; }
    .pill-work { background:#e0f2fe; color:#0369a1; font-weight:800; }
    .role-sub { font-size:.74rem; color:#64748b; display:block; }

    /* Attendance calculation cell */
    .attendance-calc-cell { display:flex; flex-direction:column; gap:4px; min-width:160px; text-align:left; }
    .pct-top-row { display:flex; justify-content:space-between; align-items:center; gap:8px; }
    .pct-value { font-size:.95rem; font-weight:800; }
    .pct-type-badge { font-size:.66rem; font-weight:700; padding:1px 6px; border-radius:10px; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap; }
    .badge-mtd-ok { background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; }
    .badge-mtd-warn { background:#fffbeb; color:#d97706; border:1px solid #fde68a; }
    .pct-bar-bg { height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden; width:100%; }
    .pct-bar-fill { height:100%; border-radius:3px; transition:width .4s ease; }
    .pct-sub-text { font-size:.72rem; color:#64748b; line-height:1.25; }

    /* Smart Punctuality Badges */
    .rating-badge-box { border-radius:8px; padding:6px 10px; display:flex; flex-direction:column; gap:2px; text-align:left; transition:all .2s; border:1.5px solid transparent; min-width:170px; }
    .rb-header { display:flex; align-items:center; gap:6px; }
    .rb-icon { font-size:17px; width:17px; height:17px; }
    .rb-title { font-size:.78rem; font-weight:800; letter-spacing:0.2px; }
    .rb-subtitle { font-size:.70rem; font-weight:600; opacity:0.9; }

    .rating-flawless { background:#ecfdf5; color:#065f46; border-color:#a7f3d0; .rb-icon { color:#059669; } }
    .rating-regular { background:#f0fdf4; color:#166534; border-color:#bbf7d0; .rb-icon { color:#16a34a; } }
    .rating-good-late { background:#eff6ff; color:#1e40af; border-color:#bfdbfe; .rb-icon { color:#2563eb; } }
    .rating-warning-late { background:#fffbeb; color:#92400e; border-color:#fde68a; .rb-icon { color:#d97706; } }
    .rating-critical-late { background:#fff1f2; color:#9f1239; border-color:#fecdd3; .rb-icon { color:#e11d48; } }
    .rating-limited { background:#f8fafc; color:#475569; border-color:#cbd5e1; border-style:dashed; .rb-icon { color:#64748b; } }
    .rating-low-att { background:#fef2f2; color:#b91c1c; border-color:#fecaca; .rb-icon { color:#dc2626; } }
    .rating-unmarked { background:#f1f5f9; color:#94a3b8; border-color:#e2e8f0; }

    /* Matrix Action Button */
    .matrix-action-btn { border-radius:6px; font-size:.76rem; font-weight:700; padding:0 10px; height:32px; border:1.5px solid #cbd5e1; background:#ffffff; color:#334155; display:inline-flex; align-items:center; gap:4px; transition:all .15s;
      mat-icon { font-size:16px; width:16px; height:16px; } }
    .matrix-action-btn:hover { background:#f1f5f9; color:#0f172a; border-color:#94a3b8; }
    .matrix-action-btn.matrix-open { background:#0f172a; color:#ffffff; border-color:#0f172a; }

    /* Matrix Bulk Toggle in Filter Card */
    .matrix-toggle-group { display:flex; align-items:center; gap:10px; margin-left:auto; }
    .matrix-bulk-btn { border-radius:8px; font-weight:700; font-size:.82rem; height:40px; border-color:#0284c7; color:#0284c7; background:#f0f9ff; display:flex; align-items:center; gap:6px;
      mat-icon { font-size:18px; width:18px; height:18px; } }
    .matrix-bulk-btn:hover { background:#e0f2fe; }

    /* Expanded Drawer Row */
    .faculty-main-row.expanded-row { background:#f8fafc; border-bottom:none !important; }
    .matrix-drawer-row { background:#f8fafc; }
    .matrix-drawer-container { padding:0 16px 16px 16px !important; border-top:none !important; }
    .matrix-drawer-card { background:#ffffff; border:1.5px solid #cbd5e1; border-radius:10px; padding:12px 14px; box-shadow:0 4px 12px rgba(15,23,42,0.06); display:flex; flex-direction:column; gap:12px; }
    .md-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-bottom:1px solid #f1f5f9; padding-bottom:10px; }
    .md-title-left { display:flex; align-items:center; gap:8px;
      .md-icon { color:#0284c7; font-size:22px; width:22px; height:22px; }
      .md-title { font-size:.9rem; color:#0f172a; display:block; }
      .md-subtitle { font-size:.76rem; color:#64748b; display:block; } }
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

    /* Day status themes */
    .day-card.day-p { background:#f0fdf4; border-color:#86efac; .day-card-badge { background:#16a34a; color:#fff; } }
    .day-card.day-l { background:#fffbeb; border-color:#fde047; .day-card-badge { background:#d97706; color:#fff; } }
    .day-card.day-a { background:#fef2f2; border-color:#fca5a5; .day-card-badge { background:#dc2626; color:#fff; } }
    .day-card.day-hd { background:#faf5ff; border-color:#d8b4fe; .day-card-badge { background:#9333ea; color:#fff; } }
    .day-card.day-off { background:#f1f5f9; border-color:#cbd5e1; .day-card-badge { background:#64748b; color:#fff; } }
    .day-card.day-- { background:#f8fafc; border-color:#e2e8f0; opacity:0.65; .day-card-badge { background:#cbd5e1; color:#475569; } }
    .day-card.day-is-sunday { border-style:dashed; }

    /* Matrix legend */
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
    .day-card.day-lt { background:#fefce8; border-color:#fef08a; }
    .day-card.day-lt .day-card-badge { background:#ca8a04; color:#fff; }

    .empty-table-cell { text-align:center !important; padding:40px 20px; color:#94a3b8; font-weight:500; }

    /* Master Routine Matrix Controls & Grid */
    .quick-today-btn {
      height: 40px !important;
      font-weight: 600;
      border-radius: 8px;
      border-color: #bfdbfe;
      background: #eff6ff;
      color: #1d4ed8;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all .2s;
      &:hover { background: #dbeafe; border-color: #93c5fd; }
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
    }
    .view-mode-toggle-group {
      display: inline-flex;
      background: #f1f5f9;
      padding: 3px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      gap: 2px;
    }
    .view-mode-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #64748b;
      background: transparent;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
      mat-icon { font-size: 17px; width: 17px; height: 17px; }
      &:hover { color: #1e293b; background: rgba(255,255,255,0.5); }
      &.active {
        background: #ffffff;
        color: #2563eb;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      }
    }
    .inline-icon {
      font-size: 15px !important;
      width: 15px !important;
      height: 15px !important;
      line-height: 15px !important;
      vertical-align: middle;
      display: inline-block;
      margin-right: 2px;
    }
    .room-pill {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
      padding: 2px 7px;
      border-radius: 5px;
      font-size: .76rem;
      font-weight: 600;
      mat-icon { font-size: 14px; width: 14px; height: 14px; color: #64748b; }
    }

    /* Weekly Routine Matrix Grid View */
    .weekly-routine-matrix {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
      margin-top: 4px;
    }
    .matrix-day-card {
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: all 0.2s ease;
      &:hover {
        border-color: #bfdbfe;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
      }
      &.is-today-card {
        border-color: #93c5fd;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
        .matrix-day-header {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border-bottom: 1px solid #bfdbfe;
        }
      }
    }
    .matrix-day-header {
      padding: 10px 14px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .day-title-box {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .day-title {
      font-weight: 800;
      font-size: 0.92rem;
      color: #0f172a;
    }
    .today-tag {
      background: #2563eb;
      color: #ffffff;
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 1px 7px;
      border-radius: 10px;
    }
    .day-slot-count {
      font-size: 0.78rem;
      font-weight: 600;
      color: #64748b;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 2px 8px;
      border-radius: 12px;
    }
    .matrix-slots-list {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 480px;
      overflow-y: auto;
    }
    .routine-slot-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: all 0.15s ease;
      &:hover {
        background: #f0f7ff;
        border-color: #bfdbfe;
      }
    }
    .slot-item-time {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.8rem;
      font-weight: 700;
      color: #0369a1;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #0284c7; }
    }
    .slot-item-body {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .slot-teacher {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .mini-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #dbeafe;
      border: 1px solid #bfdbfe;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
      .mini-img { width: 100%; height: 100%; object-fit: cover; }
      .mini-initials { font-size: 0.7rem; font-weight: 700; color: #1e40af; }
    }
    .slot-teacher-info {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .slot-teacher-name {
      font-size: 0.84rem;
      font-weight: 700;
      color: #1e293b;
    }
    .slot-subject-badge {
      font-size: 0.72rem;
      font-weight: 600;
      background: #e0e7ff;
      color: #3730a3;
      padding: 1px 7px;
      border-radius: 4px;
    }
    .slot-meta-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .slot-batch-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.74rem;
      font-weight: 600;
      color: #475569;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 1px 7px;
      border-radius: 4px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; color: #64748b; }
    }
    .slot-room-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.74rem;
      font-weight: 600;
      color: #059669;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      padding: 1px 7px;
      border-radius: 4px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; color: #059669; }
    }
    .matrix-empty-day {
      padding: 32px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      color: #94a3b8;
      font-size: 0.82rem;
      text-align: center;
      mat-icon { font-size: 28px; width: 28px; height: 28px; opacity: 0.6; }
    }

    /* Modal Backdrop */
    .modal-backdrop { position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px; }
    .modal-card { background:#ffffff; border-radius:14px; width:100%; max-width:600px; max-height:90vh; overflow-y:auto; box-shadow:0 20px 40px rgba(0,0,0,0.2); animation:modalSlideUp .2s ease-out; }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      border-top-left-radius: 14px;
      border-top-right-radius: 14px;
    }
    .modal-title-box {
      display: flex;
      align-items: center;
      gap: 12px;
      .modal-icon-box {
        width: 44px;
        height: 44px;
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        border: 1.5px solid #bfdbfe;
        color: #1e40af;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;
        box-shadow: 0 2px 6px rgba(37,99,235,0.15);

        .modal-photo-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .modal-initials {
          font-size: 1rem;
          font-weight: 700;
          color: #1e40af;
        }

        mat-icon { font-size: 22px; width: 22px; height: 22px; color: #2563eb; }
      }
      h3 { margin: 0; font-size: 1.15rem; font-weight: 700; color: #1e3a8a; }
      p { margin: 2px 0 0; font-size: 0.82rem; color: #3b82f6; strong { color: #1e40af; } }
    }
    .modal-close-btn { color: #64748b; &:hover { color: #1e293b; } }
    .modal-body { padding:20px; display:flex; flex-direction:column; gap:16px;
      h4{margin:0;font-size:.95rem;font-weight:700;color:#1e293b;} }
    .modal-kpis { display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; text-align:center; }
    .modal-kpi { display:flex; flex-direction:column; gap:2px;
      span{font-size:.72rem;color:#64748b;text-transform:uppercase;font-weight:600;}
      strong{font-size:1.1rem;color:#0f172a;} }
    .slots-breakdown-list { display:flex; flex-direction:column; gap:8px; }
    .slot-breakdown-card { background:#fff; border:1.5px solid #e2e8f0; border-radius:10px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; }
    .sbc-title { display:flex; flex-direction:column; gap:2px;
      strong{color:#0f172a;font-size:.92rem;}
      .sbc-sub{font-size:.78rem;color:#64748b;} }
    .sbc-details { display:flex; align-items:center; gap:12px; font-size:.82rem; color:#475569;
      span{display:flex;align-items:center;gap:4px;}
      mat-icon{font-size:16px;width:16px;height:16px;color:#94a3b8;} }
    .empty-slots-msg { text-align:center; color:#94a3b8; font-size:.88rem; padding:20px; }

    /* Printable Area (Hidden on screen) */
    .printable-report-sheet { display:none; }

    /* ====================================================================
       MEDIA QUERIES FOR PURE RESPONSIVENESS (DESKTOP, TABLET, MOBILE)
       ==================================================================== */
    @media (max-width: 1024px) {
      .kpi-grid { grid-template-columns:repeat(3, 1fr); }
      .modal-kpis { grid-template-columns:repeat(2, 1fr); gap:8px; }
    }

    @media (max-width: 768px) {
      .page-header { flex-direction:column; align-items:flex-start; }
      .header-actions { width:100%; justify-content:space-between; }
      .action-btn { flex:1; justify-content:center; }
      .kpi-grid { grid-template-columns:repeat(2, 1fr); gap:10px; }
      .kpi-card { padding:12px; }
      .kpi-val { font-size:1.15rem; }
      .filter-card { flex-direction:column; align-items:stretch; }
      .search-input-wrap { width:100%; min-width:100%; }
      .filter-select-wrap { width:100%; justify-content:space-between; }
      .month-selector-group { flex-direction:column; align-items:stretch; }
      .select-field { justify-content:space-between; }
      .refresh-btn { width:100%; justify-content:center; }
    }

    @media (max-width: 480px) {
      .page-title { font-size:1.25rem; }
      .kpi-grid { grid-template-columns:1fr; }
      .tab-pill { padding:8px 12px; font-size:.8rem; }
      .modal-kpis { grid-template-columns:1fr; }
      .slot-breakdown-card { flex-direction:column; align-items:flex-start; }
    }

    /* ====================================================================
       PRINT STYLES: SMART EXECUTIVE AUDIT REPORT
       ==================================================================== */
    @media screen {
      .printable-report-sheet { display: none !important; }
    }

    @media print {
      @page {
        size: A4 portrait;
        margin: 8mm 10mm 10mm 10mm;
      }

      body {
        background: #ffffff !important;
        color: #0f172a !important;
      }

      .page-header,
      .report-tabs-wrapper,
      .modal-backdrop,
      button {
        display: none !important;
      }

      .printable-report-sheet {
        display: block !important;
        visibility: visible !important;
        position: static !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #0f172a !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      }

      .print-letterhead {
        display: flex !important;
        justify-content: space-between !important;
        align-items: flex-start !important;
        border-bottom: 2px solid #0f172a !important;
        padding-bottom: 10px !important;
        margin-bottom: 10px !important;
      }

      .print-brand-left {
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
      }

      .print-logo-box {
        width: 44px !important;
        height: 44px !important;
        background: #0f172a !important;
        color: #ffffff !important;
        font-weight: 900 !important;
        font-size: 13pt !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        border-radius: 6px !important;
        letter-spacing: 1px !important;
        overflow: hidden !important;
        -webkit-print-color-adjust: exact !important;

        &.has-img {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          padding: 2px !important;
        }

        .print-logo-img {
          width: 100% !important;
          height: 100% !important;
          object-fit: contain !important;
        }
      }

      .print-inst-name {
        margin: 0 !important;
        font-size: 14pt !important;
        font-weight: 800 !important;
        color: #0f172a !important;
        line-height: 1.2 !important;
      }

      .print-inst-tagline {
        margin: 2px 0 !important;
        font-size: 8pt !important;
        color: #475569 !important;
      }

      .print-meta-line {
        font-size: 7.5pt !important;
        color: #64748b !important;
        display: flex !important;
        gap: 6px !important;
      }

      .print-brand-right {
        text-align: right !important;
      }

      .print-badge {
        display: inline-block !important;
        background: #e0f2fe !important;
        color: #0369a1 !important;
        font-size: 7.5pt !important;
        font-weight: 800 !important;
        padding: 3px 8px !important;
        border-radius: 4px !important;
        border: 1px solid #bae6fd !important;
        letter-spacing: 0.5px !important;
        -webkit-print-color-adjust: exact !important;
        margin-bottom: 4px !important;
      }

      .print-doc-meta {
        font-size: 7.5pt !important;
        color: #334155 !important;
        line-height: 1.4 !important;
      }

      .print-title-strip {
        background: #f1f5f9 !important;
        border: 1px solid #cbd5e1 !important;
        border-left: 4px solid #1976d2 !important;
        padding: 5px 10px !important;
        margin-bottom: 10px !important;
        -webkit-print-color-adjust: exact !important;
      }

      .print-title-strip h2 {
        margin: 0 !important;
        font-size: 10pt !important;
        font-weight: 800 !important;
        color: #0f172a !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
      }

      .print-kpi-summary {
        display: grid !important;
        grid-template-columns: repeat(5, 1fr) !important;
        gap: 8px !important;
        margin-bottom: 12px !important;
      }

      .pkpi-box {
        border: 1px solid #cbd5e1 !important;
        border-top: 2.5px solid #1976d2 !important;
        background: #f8fafc !important;
        padding: 5px 6px !important;
        text-align: center !important;
        border-radius: 4px !important;
        -webkit-print-color-adjust: exact !important;
      }

      .pkpi-label {
        display: block !important;
        font-size: 6.5pt !important;
        color: #64748b !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
      }

      .pkpi-value {
        font-size: 10pt !important;
        font-weight: 800 !important;
        color: #0f172a !important;
      }

      .print-table-wrapper table {
        width: 100% !important;
        border-collapse: collapse !important;
        font-size: 8pt !important;
        margin-bottom: 18px !important;
      }

      .print-table-wrapper th,
      .print-table-wrapper td {
        border: 1px solid #cbd5e1 !important;
        padding: 5px 7px !important;
      }

      .print-table-wrapper thead th {
        background: #0f172a !important;
        color: #ffffff !important;
        font-weight: 800 !important;
        text-transform: uppercase !important;
        font-size: 7pt !important;
        letter-spacing: 0.5px !important;
        -webkit-print-color-adjust: exact !important;
      }

      .print-table-wrapper tbody tr:nth-child(even) {
        background: #f8fafc !important;
        -webkit-print-color-adjust: exact !important;
      }

      .print-signoff-section {
        display: flex !important;
        justify-content: space-between !important;
        margin-top: 24px !important;
        padding-top: 8px !important;
      }

      .signoff-box {
        width: 28% !important;
        text-align: center !important;
      }

      .signoff-line {
        border-top: 1px dashed #475569 !important;
        margin-bottom: 5px !important;
        height: 1px !important;
      }

      .signoff-title {
        display: block !important;
        font-size: 7.5pt !important;
        font-weight: 800 !important;
        color: #0f172a !important;
      }

      .signoff-sub {
        font-size: 6.5pt !important;
        color: #64748b !important;
      }

      .print-doc-footer {
        display: flex !important;
        justify-content: space-between !important;
        border-top: 1px solid #cbd5e1 !important;
        padding-top: 5px !important;
        margin-top: 14px !important;
        font-size: 6.5pt !important;
        color: #64748b !important;
      }
    }

    @keyframes modalSlideUp {
      from { transform:translateY(20px); opacity:0; }
      to { transform:translateY(0); opacity:1; }
    }
  `]
})
export class TeacherReportsComponent implements OnInit {
  private api = API_BASE;
  loading = false;
  selectedTab: 'workload' | 'attendance' | 'payroll' | 'master_timetable' = 'workload';
  todayDate = new Date();

  // Tab 1: Workload Data
  workloadReport: TeacherWorkloadReportDto | null = null;
  loadingWorkload = false;
  workloadSearch = '';
  workloadFilter: 'all' | 'no_load' | 'light' | 'optimal' | 'heavy' = 'all';
  workloadSortBy: string = 'name';
  workloadSortDirection: 'asc' | 'desc' = 'asc';
  workloadPage: number = 1;
  workloadPageSize: number = 10;
  workloadTotalCount: number = 0;
  isServerWorkloadFiltered = false;
  private workloadSearchDebounceTimer: any = null;
  selectedTeacherDetails: TeacherWorkloadSummaryItemDto | null = null;

  // Tab 2: Attendance Data
  attendanceMonth = new Date().getMonth() + 1;
  attendanceYear = new Date().getFullYear();
  attendanceReport: AttendanceReportDto | null = null;
  loadingAttendance = false;
  attendanceSearch = '';
  attendanceStatusFilter = 'all';
  attendanceSortBy = 'name';
  attendanceSortDirection: 'asc' | 'desc' = 'asc';
  attendancePage = 1;
  attendancePageSize = 10;
  attendanceTotalCount = 0;
  isServerAttendanceFiltered = false;
  private attendanceSearchDebounceTimer: any = null;

  get totalAttendancePages(): number {
    return Math.ceil(this.attendanceTotalCount / this.attendancePageSize) || 1;
  }
  get attendanceStartIndex(): number {
    return (this.attendancePage - 1) * this.attendancePageSize;
  }
  get attendanceEndIndex(): number {
    return Math.min(this.attendanceStartIndex + this.attendancePageSize, this.attendanceTotalCount);
  }

  // Tab 3: Payroll Data
  payrollMonth = new Date().getMonth() + 1;
  payrollYear = new Date().getFullYear();
  payrollReport: TeacherMonthlyPayrollReportDto | null = null;
  loadingPayroll = false;
  payrollSearch = '';
  payrollModeFilter = 'all';
  payrollSortBy = 'name';
  payrollSortDirection: 'asc' | 'desc' = 'asc';
  payrollPage = 1;
  payrollPageSize = 10;
  payrollTotalCount = 0;
  isServerPayrollFiltered = false;
  private payrollSearchDebounceTimer: any = null;

  get totalPayrollPages(): number {
    return Math.ceil(this.payrollTotalCount / this.payrollPageSize) || 1;
  }
  get payrollStartIndex(): number {
    return (this.payrollPage - 1) * this.payrollPageSize;
  }
  get payrollEndIndex(): number {
    return Math.min(this.payrollStartIndex + this.payrollPageSize, this.payrollTotalCount);
  }

  // Tab 4: Master Timetable
  masterTimetable: BatchAssignmentDto[] = [];
  loadingMasterTimetable = false;
  masterSearch = '';
  masterDayFilter = 'all';
  masterViewMode: 'list' | 'matrix' = 'list';
  masterSortBy = 'teacher';
  masterSortDirection: 'asc' | 'desc' = 'asc';
  masterPage = 1;
  masterPageSize = 10;
  masterTotalCount = 0;
  isServerMasterFiltered = false;
  private masterSearchDebounceTimer: any = null;

  get totalMasterPages(): number {
    return Math.ceil(this.masterTotalCount / this.masterPageSize) || 1;
  }
  get masterStartIndex(): number {
    return (this.masterPage - 1) * this.masterPageSize;
  }
  get masterEndIndex(): number {
    return Math.min(this.masterStartIndex + this.masterPageSize, this.masterTotalCount);
  }

  get masterTotalSlots(): number {
    return this.masterTimetable ? this.masterTimetable.length : 0;
  }
  get masterUniqueTeachersCount(): number {
    if (!this.masterTimetable) return 0;
    const set = new Set(this.masterTimetable.map(m => m.teacherId || m.teacherName));
    return set.size;
  }
  get masterUniqueBatchesCount(): number {
    if (!this.masterTimetable) return 0;
    const set = new Set(this.masterTimetable.map(m => m.batchName || m.className));
    return set.size;
  }
  get masterUniqueSubjectsCount(): number {
    if (!this.masterTimetable) return 0;
    const set = new Set(this.masterTimetable.map(m => m.subject));
    return set.size;
  }

  get todayDayName(): string {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[new Date().getDay()];
  }

  filterByToday() {
    this.masterDayFilter = this.todayDayName;
    this.masterPage = 1;
    this.loadMasterTimetable(1);
  }

  readonly months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  readonly years = [2025, 2026, 2027];
  readonly allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  constructor(
    private http: HttpClient,
    public authService: AuthService,
    private route: ActivatedRoute
  ) {}

  logoFailed = false;

  get logoUrl(): string | null {
    return this.authService.getInstituteLogoUrl();
  }

  get tenantCode(): string {
    return this.authService.currentUser()?.tenantCode || 'APEX';
  }

  get instituteName(): string {
    return this.authService.currentUser()?.instituteName || 'Apex Coaching Academy';
  }

  get branchName(): string {
    return this.authService.currentUser()?.branchName || 'Main Campus';
  }

  getActiveTabScope(): string {
    switch (this.selectedTab) {
      case 'workload': return 'All Active Faculty';
      case 'attendance': return `${this.months[this.attendanceMonth - 1]} ${this.attendanceYear}`;
      case 'payroll': return `${this.months[this.payrollMonth - 1]} ${this.payrollYear}`;
      case 'master_timetable': return 'Weekly Scheduled Routine';
    }
  }

  ngOnInit() {
    this.loadTeacherPhotosMap();
    this.route.queryParams.subscribe(params => {
      const tabParam = params['tab'];
      if (tabParam === 'workload' || tabParam === 'attendance' || tabParam === 'payroll' || tabParam === 'master_timetable') {
        this.selectedTab = tabParam;
      }
    });
    this.loadActiveTabData();
  }

  loadActiveTabData() {
    if (this.selectedTab === 'workload') {
      this.loadWorkloadReport();
    } else if (this.selectedTab === 'attendance') {
      this.loadAttendanceReport();
    } else if (this.selectedTab === 'payroll') {
      this.loadPayrollReport();
    } else if (this.selectedTab === 'master_timetable') {
      this.loadMasterTimetable();
    }
  }

  setTab(tab: 'workload' | 'attendance' | 'payroll' | 'master_timetable') {
    this.selectedTab = tab;
    this.loadActiveTabData();
  }

  // Faculty Profile Photo & Initials Fallback
  imgErrors: Record<string, boolean> = {};
  teacherPhotosMap: Record<string, string> = {};

  getTeacherPhoto(item: any): string {
    if (!item) return '';
    const raw = item.photoUrl || (item.teacherId ? this.teacherPhotosMap[item.teacherId] : '') || (item.personId ? this.teacherPhotosMap[item.personId] : '') || (item.id ? this.teacherPhotosMap[item.id] : '');
    if (!raw) return '';
    return this.getPhotoUrl(raw);
  }

  getPhotoUrl(photo?: string | null): string {
    if (!photo) return '';
    if (photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('data:')) {
      return photo;
    }
    if (photo.startsWith('/')) {
      return `${environment.apiBaseUrl}${photo}`;
    }
    return `${environment.apiBaseUrl}/${photo}`;
  }

  getInitials(name?: string): string {
    if (!name) return 'FC';
    const clean = name.replace(/^(Mr|Mrs|Ms|Dr|Er|Prof)\.?\s+/i, '').trim();
    const parts = clean.split(/\s+/).filter(p => p.length > 0);
    if (parts.length === 0) return 'FC';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  loadTeacherPhotosMap() {
    this.http.get<any[]>(`${this.api}/teachers`, { headers: { 'X-Skip-Loader': 'true' } }).subscribe({
      next: (list) => {
        if (list) {
          list.forEach(t => {
            if (t.id && t.photoUrl) {
              this.teacherPhotosMap[t.id] = t.photoUrl;
            }
          });
        }
      },
      error: () => {}
    });
  }

  // Workload Methods
  loadWorkloadReport(page: number = this.workloadPage) {
    this.workloadPage = page;
    this.loadingWorkload = true;

    let params = new HttpParams()
      .set('search', this.workloadSearch ? this.workloadSearch.trim() : '')
      .set('loadCategory', this.workloadFilter)
      .set('sortBy', this.workloadSortBy)
      .set('sortDirection', this.workloadSortDirection)
      .set('page', this.workloadPage.toString())
      .set('pageSize', this.workloadPageSize.toString());

    this.http.get<TeacherWorkloadReportDto>(`${this.api}/teachers/reports/workload`, {
      params,
      headers: { 'X-Skip-Loader': 'true' }
    }).subscribe({
      next: r => {
        this.workloadReport = r;
        if (r.totalCount && r.totalCount > 0) {
          this.workloadTotalCount = r.totalCount;
          this.isServerWorkloadFiltered = true;
        } else {
          this.isServerWorkloadFiltered = false;
          this.workloadTotalCount = r.teachers ? r.teachers.length : 0;
        }
        this.loadingWorkload = false;
      },
      error: () => {
        this.loadingWorkload = false;
      }
    });
  }

  get displayedWorkloadTeachers(): TeacherWorkloadSummaryItemDto[] {
    if (!this.workloadReport?.teachers) return [];
    let list = [...this.workloadReport.teachers];

    const needsClientPaging = list.length > this.workloadPageSize;
    const needsClientFilter = !this.isServerWorkloadFiltered;

    if (needsClientFilter) {
      if (this.workloadSearch && this.workloadSearch.trim()) {
        const q = this.workloadSearch.trim().toLowerCase();
        list = list.filter(t =>
          (t.teacherName && t.teacherName.toLowerCase().includes(q)) ||
          (t.employeeCode && t.employeeCode.toLowerCase().includes(q)) ||
          (t.qualification && t.qualification.toLowerCase().includes(q)) ||
          (t.specialization && t.specialization.toLowerCase().includes(q))
        );
      }
      if (this.workloadFilter && this.workloadFilter !== 'all') {
        switch (this.workloadFilter) {
          case 'no_load': list = list.filter(t => t.weeklyHours === 0); break;
          case 'light': list = list.filter(t => t.weeklyHours < 10); break;
          case 'optimal': list = list.filter(t => t.weeklyHours >= 10 && t.weeklyHours <= 25); break;
          case 'heavy': list = list.filter(t => t.weeklyHours > 25); break;
        }
      }
      const isDesc = this.workloadSortDirection === 'desc';
      list.sort((a, b) => {
        let valA: any = a.teacherName;
        let valB: any = b.teacherName;
        switch (this.workloadSortBy) {
          case 'qualification': valA = a.qualification || ''; valB = b.qualification || ''; break;
          case 'batches': valA = a.assignedBatchCount; valB = b.assignedBatchCount; break;
          case 'classes': valA = a.weeklyClassesCount; valB = b.weeklyClassesCount; break;
          case 'hours': valA = a.weeklyHours; valB = b.weeklyHours; break;
          case 'status': valA = a.weeklyHours; valB = b.weeklyHours; break;
          case 'reach': valA = a.totalStudentReach; valB = b.totalStudentReach; break;
          default: valA = a.teacherName; valB = b.teacherName; break;
        }
        if (typeof valA === 'string') {
          return isDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
        }
        return isDesc ? valB - valA : valA - valB;
      });
      this.workloadTotalCount = list.length;
    }

    if (needsClientPaging) {
      const start = (this.workloadPage - 1) * this.workloadPageSize;
      return list.slice(start, start + this.workloadPageSize);
    }

    return list;
  }

  onWorkloadSearchChange() {
    if (this.workloadSearchDebounceTimer) {
      clearTimeout(this.workloadSearchDebounceTimer);
    }
    this.workloadSearchDebounceTimer = setTimeout(() => {
      this.workloadPage = 1;
      this.loadWorkloadReport(1);
    }, 350);
  }

  clearWorkloadSearch() {
    this.workloadSearch = '';
    this.workloadPage = 1;
    this.loadWorkloadReport(1);
  }

  onWorkloadFilterChange() {
    this.workloadPage = 1;
    this.loadWorkloadReport(1);
  }

  onWorkloadSort(column: string) {
    if (this.workloadSortBy === column) {
      this.workloadSortDirection = this.workloadSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.workloadSortBy = column;
      this.workloadSortDirection = 'asc';
    }
    this.loadWorkloadReport(1);
  }

  setWorkloadPageSize(size: number) {
    this.workloadPageSize = size;
    this.workloadPage = 1;
    this.loadWorkloadReport(1);
  }

  setWorkloadPage(page: number) {
    if (page < 1 || page > this.totalWorkloadPages || page === this.workloadPage) return;
    this.loadWorkloadReport(page);
  }

  get totalWorkloadPages(): number {
    if (this.workloadPageSize <= 0) return 1;
    return Math.ceil(this.workloadTotalCount / this.workloadPageSize) || 1;
  }

  get workloadStartIndex(): number {
    return (this.workloadPage - 1) * this.workloadPageSize;
  }

  get workloadEndIndex(): number {
    return Math.min(this.workloadStartIndex + this.workloadPageSize, this.workloadTotalCount);
  }

  get filteredWorkloadTeachers(): TeacherWorkloadSummaryItemDto[] {
    return this.displayedWorkloadTeachers;
  }

  getWorkloadStatusText(hours: number): string {
    if (hours === 0) return 'No Load';
    if (hours < 10) return 'Light Load';
    if (hours <= 25) return 'Optimal Load';
    return 'Heavy Load';
  }

  getWorkloadStatusClass(hours: number): string {
    if (hours === 0 || hours < 10) return 'chip-light';
    if (hours <= 25) return 'chip-optimal';
    return 'chip-heavy';
  }

  openBatchDetails(item: TeacherWorkloadSummaryItemDto) {
    this.selectedTeacherDetails = item;
  }

  // Attendance Methods
  loadAttendanceReport(page: number = this.attendancePage) {
    this.attendancePage = page;
    this.loadingAttendance = true;

    let params = new HttpParams()
      .set('month', this.attendanceMonth.toString())
      .set('year', this.attendanceYear.toString())
      .set('search', this.attendanceSearch ? this.attendanceSearch.trim() : '')
      .set('statusFilter', this.attendanceStatusFilter)
      .set('sortBy', this.attendanceSortBy)
      .set('sortDir', this.attendanceSortDirection)
      .set('page', this.attendancePage.toString())
      .set('pageSize', this.attendancePageSize.toString());

    this.http.get<AttendanceReportDto>(`${this.api}/teachers/attendance/report`, {
      params,
      headers: { 'X-Skip-Loader': 'true' }
    }).subscribe({
      next: r => {
        this.attendanceReport = r;
        if (r.totalCount && r.totalCount > 0) {
          this.attendanceTotalCount = r.totalCount;
          this.isServerAttendanceFiltered = true;
        } else {
          this.isServerAttendanceFiltered = false;
          this.attendanceTotalCount = r.rows ? r.rows.length : 0;
        }
        this.loadingAttendance = false;
      },
      error: () => {
        this.loadingAttendance = false;
      }
    });
  }

  get displayedAttendanceRows(): AttendanceReportRowDto[] {
    if (!this.attendanceReport?.rows) return [];
    let list = [...this.attendanceReport.rows];

    const needsClientPaging = list.length > this.attendancePageSize;
    const needsClientFilter = !this.isServerAttendanceFiltered;

    if (needsClientFilter) {
      if (this.attendanceSearch && this.attendanceSearch.trim()) {
        const q = this.attendanceSearch.trim().toLowerCase();
        list = list.filter(r =>
          (r.personName && r.personName.toLowerCase().includes(q)) ||
          (r.name && r.name.toLowerCase().includes(q)) ||
          (r.code && r.code.toLowerCase().includes(q))
        );
      }
      if (this.attendanceStatusFilter && this.attendanceStatusFilter !== 'all') {
        switch (this.attendanceStatusFilter) {
          case 'flawless':
            list = list.filter(r => this.getMonthlyPct(r) >= 90 && (r.lateDays || 0) === 0);
            break;
          case 'good':
            list = list.filter(r => this.getMonthlyPct(r) >= 75);
            break;
          case 'low':
            list = list.filter(r => this.getMonthlyPct(r) < 50);
            break;
          case 'late':
            list = list.filter(r => (r.lateDays || 0) > 0);
            break;
        }
      }
      const isDesc = this.attendanceSortDirection === 'desc';
      list.sort((a, b) => {
        let valA: any = a.personName || a.name || '';
        let valB: any = b.personName || b.name || '';
        switch (this.attendanceSortBy) {
          case 'code': valA = a.code || ''; valB = b.code || ''; break;
          case 'present': valA = a.presentDays || 0; valB = b.presentDays || 0; break;
          case 'absent': valA = a.absentDays || 0; valB = b.absentDays || 0; break;
          case 'late': valA = a.lateDays || 0; valB = b.lateDays || 0; break;
          case 'half': valA = a.halfDays || 0; valB = b.halfDays || 0; break;
          case 'percentage': valA = this.getMonthlyPct(a); valB = this.getMonthlyPct(b); break;
          default: valA = a.personName || a.name || ''; valB = b.personName || b.name || ''; break;
        }
        if (typeof valA === 'string') {
          return isDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
        }
        return isDesc ? valB - valA : valA - valB;
      });
      this.attendanceTotalCount = list.length;
    }

    if (needsClientPaging) {
      const start = (this.attendancePage - 1) * this.attendancePageSize;
      return list.slice(start, start + this.attendancePageSize);
    }
    return list;
  }

  onAttendanceSearchChange() {
    if (this.attendanceSearchDebounceTimer) clearTimeout(this.attendanceSearchDebounceTimer);
    this.attendanceSearchDebounceTimer = setTimeout(() => {
      this.attendancePage = 1;
      this.loadAttendanceReport(1);
    }, 350);
  }

  clearAttendanceSearch() {
    this.attendanceSearch = '';
    this.attendancePage = 1;
    this.loadAttendanceReport(1);
  }

  onAttendanceFilterChange() {
    this.attendancePage = 1;
    this.loadAttendanceReport(1);
  }

  onAttendanceSort(column: string) {
    if (this.attendanceSortBy === column) {
      this.attendanceSortDirection = this.attendanceSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.attendanceSortBy = column;
      this.attendanceSortDirection = 'asc';
    }
    this.loadAttendanceReport(1);
  }

  setAttendancePage(page: number) {
    if (page < 1 || page > this.totalAttendancePages || page === this.attendancePage) return;
    this.loadAttendanceReport(page);
  }

  setAttendancePageSize(size: number) {
    this.attendancePageSize = size;
    this.attendancePage = 1;
    this.loadAttendanceReport(1);
  }

  // Daily matrix and rating logic
  expandedTeacherIds = new Set<string>();
  expandAllDays = false;
  teacherDailyMap: { [teacherId: string]: { day: number; dayOfWeek: string; isSunday: boolean; status: string; label: string }[] } = {};

  get overallAttendanceRate(): number {
    if (!this.attendanceReport || this.attendanceReport.rows.length === 0) return 0;
    const sum = this.attendanceReport.rows.reduce((acc, row) => acc + this.getMonthlyPct(row), 0);
    return Math.round(sum / this.attendanceReport.rows.length);
  }

  getDaysInMonth(): number {
    return new Date(this.attendanceYear, this.attendanceMonth, 0).getDate();
  }

  getEvaluatedDays(row: AttendanceReportRowDto): number {
    return (row.presentDays || 0) + (row.absentDays || 0) + (row.lateDays || 0) + (row.halfDays || 0);
  }

  getUnmarkedDays(row: AttendanceReportRowDto): number {
    const evaluated = this.getEvaluatedDays(row);
    const working = row.totalWorkingDays || 25;
    return Math.max(0, working - evaluated);
  }

  isLimitedData(row: AttendanceReportRowDto): boolean {
    return this.getEvaluatedDays(row) < 3;
  }

  getMonthlyPct(row: AttendanceReportRowDto): number {
    const working = row.totalWorkingDays || 25;
    if (working === 0) return 0;
    const attended = (row.presentDays || 0) + (row.lateDays || 0) + ((row.halfDays || 0) * 0.5);
    return Math.min(100, Math.round((attended / working) * 1000) / 10);
  }

  getMtdPct(row: AttendanceReportRowDto): number {
    const evaluated = this.getEvaluatedDays(row);
    if (evaluated === 0) return 0;
    const attended = (row.presentDays || 0) + (row.lateDays || 0) + ((row.halfDays || 0) * 0.5);
    return Math.min(100, Math.round((attended / evaluated) * 1000) / 10);
  }

  getPctColor(pct: number): string {
    if (pct >= 90) return '#10b981';
    if (pct >= 75) return '#0284c7';
    if (pct >= 50) return '#f59e0b';
    return '#f43f5e';
  }

  getPunctualityRating(row: AttendanceReportRowDto): { title: string; badgeClass: string; icon: string; subtitle: string; tooltip: string } {
    const evaluated = this.getEvaluatedDays(row);
    const late = row.lateDays || 0;
    const absent = row.absentDays || 0;
    const working = row.totalWorkingDays || 25;
    const monthlyPct = this.getMonthlyPct(row);

    if (evaluated === 0) {
      return {
        title: 'No Records Marked',
        badgeClass: 'rating-unmarked',
        icon: 'schedule',
        subtitle: '0 days recorded in month',
        tooltip: 'No attendance marked yet for this month.'
      };
    }

    if (evaluated < 3) {
      return {
        title: `Limited Data (${evaluated} Day${evaluated > 1 ? 's' : ''})`,
        badgeClass: 'rating-limited',
        icon: 'info',
        subtitle: `${evaluated}/${working} days marked • MTD: ${this.getMtdPct(row)}%`,
        tooltip: `Only ${evaluated} day(s) marked out of ${working} working days. Punctuality requires minimum 3 marked days.`
      };
    }

    if (monthlyPct < 50) {
      return {
        title: 'Critical Absenteeism',
        badgeClass: 'rating-low-att',
        icon: 'warning',
        subtitle: `${absent} absent days • ${monthlyPct}% Monthly`,
        tooltip: `High absenteeism: ${absent} absent days. Monthly attendance is below 50%.`
      };
    }

    if (late >= 4) {
      return {
        title: `Frequent Late (${late} Days)`,
        badgeClass: 'rating-critical-late',
        icon: 'running_with_errors',
        subtitle: `${late} late arrivals • Needs Review`,
        tooltip: `Teacher was late ${late} times this month. Institutional review suggested.`
      };
    }

    if (late >= 2) {
      return {
        title: `Needs Attention (${late} Late)`,
        badgeClass: 'rating-warning-late',
        icon: 'schedule',
        subtitle: `${late} late arrivals this month`,
        tooltip: `Recorded ${late} late arrivals this month.`
      };
    }

    if (late === 1) {
      return {
        title: 'Good (1 Day Late)',
        badgeClass: 'rating-good-late',
        icon: 'access_time',
        subtitle: '1 isolated late arrival',
        tooltip: 'Punctual with only 1 isolated late arrival.'
      };
    }

    if (monthlyPct >= 90) {
      return {
        title: '100% On-Time (Flawless)',
        badgeClass: 'rating-flawless',
        icon: 'verified',
        subtitle: 'Zero late • Perfect Punctuality',
        tooltip: 'Outstanding punctuality with zero late arrivals and high attendance.'
      };
    }

    return {
      title: 'Regular & On-Time',
      badgeClass: 'rating-regular',
      icon: 'check_circle',
      subtitle: '0 late arrivals',
      tooltip: 'Consistent punctuality with zero late marks.'
    };
  }

  getRatingText(pct: number): string {
    if (pct >= 90) return '100% Punctual';
    if (pct >= 75) return 'Good Regular';
    if (pct >= 50) return 'Moderate';
    return 'Critical Low';
  }

  getRatingClass(pct: number): string {
    if (pct >= 90) return 'rating-flawless';
    if (pct >= 75) return 'rating-regular';
    if (pct >= 50) return 'rating-warning-late';
    return 'rating-low-att';
  }

  isExpanded(teacherId: string): boolean {
    return this.expandedTeacherIds.has(teacherId);
  }

  toggleTeacherCalendar(teacherId: string): void {
    if (this.expandedTeacherIds.has(teacherId)) {
      this.expandedTeacherIds.delete(teacherId);
    } else {
      this.expandedTeacherIds.add(teacherId);
      this.loadDailyAttendanceIfNeeded(teacherId);
    }
  }

  toggleExpandAll(): void {
    this.expandAllDays = !this.expandAllDays;
    if (this.expandAllDays && this.attendanceReport) {
      this.attendanceReport.rows.forEach(r => {
        this.expandedTeacherIds.add(r.personId);
        this.loadDailyAttendanceIfNeeded(r.personId);
      });
    } else {
      this.expandedTeacherIds.clear();
    }
  }

  loadDailyAttendanceIfNeeded(teacherId: string): void {
    if (this.teacherDailyMap[teacherId]) return;
    this.http.get<any[]>(`${this.api}/teachers/${teacherId}/attendance?month=${this.attendanceMonth}&year=${this.attendanceYear}`, {
      headers: { 'X-Skip-Loader': 'true' }
    }).subscribe({
      next: (records) => {
        this.buildDailyMapFromRecords(teacherId, records || []);
      },
      error: () => {
        this.buildDailyMapFromRecords(teacherId, []);
      }
    });
  }

  buildDailyMapFromRecords(teacherId: string, records: any[]): void {
    const totalDays = this.getDaysInMonth();
    const daysArr: { day: number; dayOfWeek: string; isSunday: boolean; status: string; label: string }[] = [];
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(this.attendanceYear, this.attendanceMonth - 1, d);
      const dayOfWeek = weekdays[dateObj.getDay()];
      const isSunday = dateObj.getDay() === 0;

      if (isSunday) {
        daysArr.push({
          day: d,
          dayOfWeek,
          isSunday: true,
          status: 'OFF',
          label: `${d} ${this.months[this.attendanceMonth - 1]} (${dayOfWeek}): Sunday (Off)`
        });
        continue;
      }

      // Check record
      const rec = records.find(r => {
        const rDate = new Date(r.attendanceDate);
        return rDate.getDate() === d && (rDate.getMonth() + 1) === this.attendanceMonth && rDate.getFullYear() === this.attendanceYear;
      });

      if (rec) {
        let code = 'P';
        const st = (rec.status || '').toLowerCase();
        if (st.includes('absent')) code = 'A';
        else if (st.includes('leave')) code = 'L';
        else if (st.includes('late')) code = 'LT';
        else if (st.includes('half')) code = 'HD';

        let statusText = rec.status || 'Present';
        if (code === 'L') {
          statusText = rec.remarks ? `Sanctioned Leave: ${rec.remarks}` : 'Sanctioned Leave';
        }

        daysArr.push({
          day: d,
          dayOfWeek,
          isSunday: false,
          status: code,
          label: `${d} ${this.months[this.attendanceMonth - 1]} (${dayOfWeek}): ${statusText}${rec.checkInTime ? ' • In: ' + rec.checkInTime : ''}`
        });
      } else {
        daysArr.push({
          day: d,
          dayOfWeek,
          isSunday: false,
          status: '-',
          label: `${d} ${this.months[this.attendanceMonth - 1]} (${dayOfWeek}): Not Marked / Future`
        });
      }
    }
    this.teacherDailyMap[teacherId] = daysArr;
  }

  getTeacherDailyMatrix(row: AttendanceReportRowDto): { day: number; dayOfWeek: string; isSunday: boolean; status: string; label: string }[] {
    if (this.teacherDailyMap[row.personId]) {
      return this.teacherDailyMap[row.personId];
    }
    // If row.dailyStatuses is present from backend, parse it
    if (row.dailyStatuses) {
      const parts = row.dailyStatuses.split(',');
      const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const arr = parts.map((p: string) => {
        const [dStr, st] = p.split(':');
        const dayNum = parseInt(dStr, 10);
        const dateObj = new Date(this.attendanceYear, this.attendanceMonth - 1, dayNum);
        const dayOfWeek = weekdays[dateObj.getDay()];
        const isSunday = dateObj.getDay() === 0;
        return {
          day: dayNum,
          dayOfWeek,
          isSunday,
          status: st || '-',
          label: `${dayNum} ${this.months[this.attendanceMonth - 1]} (${dayOfWeek}): ${st === 'OFF' ? 'Sunday/Holiday' : st === 'P' ? 'Present' : st === 'L' ? 'Sanctioned Leave' : st === 'LT' ? 'Late Arrival' : st === 'A' ? 'Absent' : st === 'HD' ? 'Half Day' : 'Unmarked'}`
        };
      });
      this.teacherDailyMap[row.personId] = arr;
      return arr;
    }

    // Default placeholder while loading
    this.loadDailyAttendanceIfNeeded(row.personId);
    return [];
  }

  // Payroll Methods
  loadPayrollReport(page: number = this.payrollPage) {
    this.payrollPage = page;
    this.loadingPayroll = true;

    let params = new HttpParams()
      .set('month', this.payrollMonth.toString())
      .set('year', this.payrollYear.toString())
      .set('search', this.payrollSearch ? this.payrollSearch.trim() : '')
      .set('paymentMode', this.payrollModeFilter)
      .set('sortBy', this.payrollSortBy)
      .set('sortDir', this.payrollSortDirection)
      .set('page', this.payrollPage.toString())
      .set('pageSize', this.payrollPageSize.toString());

    this.http.get<TeacherMonthlyPayrollReportDto>(`${this.api}/teachers/reports/payroll`, {
      params,
      headers: { 'X-Skip-Loader': 'true' }
    }).subscribe({
      next: r => {
        this.payrollReport = r;
        if (r.totalRecords && r.totalRecords > 0) {
          this.payrollTotalCount = r.totalRecords;
          this.isServerPayrollFiltered = true;
        } else {
          this.isServerPayrollFiltered = false;
          this.payrollTotalCount = r.payments ? r.payments.length : 0;
        }
        this.loadingPayroll = false;
      },
      error: () => {
        this.loadingPayroll = false;
      }
    });
  }

  get displayedPayrollPayments(): SalaryPaymentDto[] {
    if (!this.payrollReport?.payments) return [];
    let list = [...this.payrollReport.payments];

    const needsClientPaging = list.length > this.payrollPageSize;
    const needsClientFilter = !this.isServerPayrollFiltered;

    if (needsClientFilter) {
      if (this.payrollSearch && this.payrollSearch.trim()) {
        const q = this.payrollSearch.trim().toLowerCase();
        list = list.filter(p =>
          (p.teacherName && p.teacherName.toLowerCase().includes(q)) ||
          (p.employeeCode && p.employeeCode.toLowerCase().includes(q)) ||
          (p.receiptNumber && p.receiptNumber.toLowerCase().includes(q)) ||
          (p.transactionRef && p.transactionRef.toLowerCase().includes(q))
        );
      }
      if (this.payrollModeFilter && this.payrollModeFilter !== 'all') {
        list = list.filter(p => p.paymentMode && p.paymentMode.toLowerCase() === this.payrollModeFilter.toLowerCase());
      }
      const isDesc = this.payrollSortDirection === 'desc';
      list.sort((a, b) => {
        let valA: any = a.teacherName;
        let valB: any = b.teacherName;
        switch (this.payrollSortBy) {
          case 'receipt': valA = a.receiptNumber || ''; valB = b.receiptNumber || ''; break;
          case 'date': valA = new Date(a.paymentDate).getTime(); valB = new Date(b.paymentDate).getTime(); break;
          case 'gross': valA = a.grossAmount; valB = b.grossAmount; break;
          case 'deductions': valA = a.deductions; valB = b.deductions; break;
          case 'advance': valA = a.advanceAdjusted; valB = b.advanceAdjusted; break;
          case 'net': valA = a.netPaid; valB = b.netPaid; break;
          case 'mode': valA = a.paymentMode || ''; valB = b.paymentMode || ''; break;
          default: valA = a.teacherName; valB = b.teacherName; break;
        }
        if (typeof valA === 'string') {
          return isDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
        }
        return isDesc ? valB - valA : valA - valB;
      });
      this.payrollTotalCount = list.length;
    }

    if (needsClientPaging) {
      const start = (this.payrollPage - 1) * this.payrollPageSize;
      return list.slice(start, start + this.payrollPageSize);
    }

    return list;
  }

  onPayrollSearchChange() {
    if (this.payrollSearchDebounceTimer) {
      clearTimeout(this.payrollSearchDebounceTimer);
    }
    this.payrollSearchDebounceTimer = setTimeout(() => {
      this.payrollPage = 1;
      this.loadPayrollReport(1);
    }, 350);
  }

  clearPayrollSearch() {
    this.payrollSearch = '';
    this.payrollPage = 1;
    this.loadPayrollReport(1);
  }

  onPayrollFilterChange() {
    this.payrollPage = 1;
    this.loadPayrollReport(1);
  }

  onPayrollSort(column: string) {
    if (this.payrollSortBy === column) {
      this.payrollSortDirection = this.payrollSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.payrollSortBy = column;
      this.payrollSortDirection = 'asc';
    }
    this.loadPayrollReport(1);
  }

  setPayrollPage(page: number) {
    if (page < 1 || page > this.totalPayrollPages || page === this.payrollPage) return;
    this.loadPayrollReport(page);
  }

  setPayrollPageSize(size: number) {
    this.payrollPageSize = size;
    this.payrollPage = 1;
    this.loadPayrollReport(1);
  }

  // Master Timetable Methods
  loadMasterTimetable(page: number = this.masterPage) {
    this.masterPage = page;
    this.loadingMasterTimetable = true;

    let params = new HttpParams()
      .set('search', this.masterSearch ? this.masterSearch.trim() : '')
      .set('day', this.masterDayFilter)
      .set('sortBy', this.masterSortBy)
      .set('sortDir', this.masterSortDirection)
      .set('page', this.masterPage.toString())
      .set('pageSize', this.masterPageSize.toString())
      .set('paged', 'true');

    this.http.get<any>(`${this.api}/teachers/reports/master-timetable`, {
      params,
      headers: { 'X-Skip-Loader': 'true' }
    }).subscribe({
      next: (res) => {
        if (res && res.items && Array.isArray(res.items)) {
          this.masterTimetable = res.items;
          this.masterTotalCount = res.totalCount || res.items.length;
          this.isServerMasterFiltered = true;
        } else if (Array.isArray(res)) {
          this.masterTimetable = res;
          this.masterTotalCount = res.length;
          this.isServerMasterFiltered = false;
        } else {
          this.masterTimetable = [];
          this.masterTotalCount = 0;
          this.isServerMasterFiltered = false;
        }
        this.loadingMasterTimetable = false;
      },
      error: () => {
        this.loadingMasterTimetable = false;
      }
    });
  }

  get displayedMasterTimetable(): BatchAssignmentDto[] {
    if (!this.masterTimetable) return [];
    let list = [...this.masterTimetable];

    const needsClientPaging = list.length > this.masterPageSize;
    const needsClientFilter = !this.isServerMasterFiltered;

    if (needsClientFilter) {
      if (this.masterSearch && this.masterSearch.trim()) {
        const q = this.masterSearch.trim().toLowerCase();
        list = list.filter(m =>
          (m.teacherName && m.teacherName.toLowerCase().includes(q)) ||
          (m.employeeCode && m.employeeCode.toLowerCase().includes(q)) ||
          (m.batchName && m.batchName.toLowerCase().includes(q)) ||
          (m.className && m.className.toLowerCase().includes(q)) ||
          (m.subject && m.subject.toLowerCase().includes(q)) ||
          (m.roomNumber && m.roomNumber.toLowerCase().includes(q))
        );
      }
      if (this.masterDayFilter && this.masterDayFilter !== 'all') {
        list = list.filter(m => m.daysOfWeek && m.daysOfWeek.toLowerCase().includes(this.masterDayFilter.toLowerCase()));
      }
      const isDesc = this.masterSortDirection === 'desc';
      list.sort((a, b) => {
        let valA: any = a.teacherName || '';
        let valB: any = b.teacherName || '';
        switch (this.masterSortBy) {
          case 'batch': valA = a.batchName || a.className || ''; valB = b.batchName || b.className || ''; break;
          case 'subject': valA = a.subject || ''; valB = b.subject || ''; break;
          case 'day': valA = a.daysOfWeek || ''; valB = b.daysOfWeek || ''; break;
          case 'slot': valA = a.timeSlot || ''; valB = b.timeSlot || ''; break;
          case 'room': valA = a.roomNumber || ''; valB = b.roomNumber || ''; break;
          default: valA = a.teacherName || ''; valB = b.teacherName || ''; break;
        }
        if (typeof valA === 'string') {
          return isDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
        }
        return isDesc ? valB - valA : valA - valB;
      });
      this.masterTotalCount = list.length;
    }

    if (needsClientPaging) {
      const start = (this.masterPage - 1) * this.masterPageSize;
      return list.slice(start, start + this.masterPageSize);
    }
    return list;
  }

  get filteredMasterTimetable(): BatchAssignmentDto[] {
    return this.displayedMasterTimetable;
  }

  get routineGroupedByDay(): { day: string; dayFullName: string; isToday: boolean; items: BatchAssignmentDto[] }[] {
    const dayFullNames: Record<string, string> = {
      'Mon': 'Monday',
      'Tue': 'Tuesday',
      'Wed': 'Wednesday',
      'Thu': 'Thursday',
      'Fri': 'Friday',
      'Sat': 'Saturday',
      'Sun': 'Sunday'
    };
    const daysToInclude = this.masterDayFilter === 'all'
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : [this.masterDayFilter];

    const today = this.todayDayName;

    return daysToInclude.map(d => {
      const items = (this.masterTimetable || []).filter(m => {
        const matchDay = m.daysOfWeek && m.daysOfWeek.toLowerCase().includes(d.toLowerCase());
        if (!matchDay) return false;
        if (this.masterSearch && this.masterSearch.trim()) {
          const q = this.masterSearch.trim().toLowerCase();
          return (m.teacherName && m.teacherName.toLowerCase().includes(q)) ||
                 (m.batchName && m.batchName.toLowerCase().includes(q)) ||
                 (m.className && m.className.toLowerCase().includes(q)) ||
                 (m.subject && m.subject.toLowerCase().includes(q)) ||
                 (m.roomNumber && m.roomNumber.toLowerCase().includes(q));
        }
        return true;
      });
      return {
        day: d,
        dayFullName: dayFullNames[d] || d,
        isToday: d.toLowerCase() === today.toLowerCase(),
        items
      };
    });
  }

  onMasterSearchChange() {
    if (this.masterSearchDebounceTimer) clearTimeout(this.masterSearchDebounceTimer);
    this.masterSearchDebounceTimer = setTimeout(() => {
      this.masterPage = 1;
      this.loadMasterTimetable(1);
    }, 350);
  }

  clearMasterSearch() {
    this.masterSearch = '';
    this.masterPage = 1;
    this.loadMasterTimetable(1);
  }

  onMasterDayFilterChange() {
    this.masterPage = 1;
    this.loadMasterTimetable(1);
  }

  onMasterSort(column: string) {
    if (this.masterSortBy === column) {
      this.masterSortDirection = this.masterSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.masterSortBy = column;
      this.masterSortDirection = 'asc';
    }
    this.loadMasterTimetable(1);
  }

  setMasterPage(page: number) {
    if (page < 1 || page > this.totalMasterPages || page === this.masterPage) return;
    this.loadMasterTimetable(page);
  }

  setMasterPageSize(size: number) {
    this.masterPageSize = size;
    this.masterPage = 1;
    this.loadMasterTimetable(1);
  }

  // Print & CSV Export
  getActiveTabTitle(): string {
    switch (this.selectedTab) {
      case 'workload': return 'Faculty Workload & Allocation Audit';
      case 'attendance': return `Faculty Monthly Attendance & Punctuality Register`;
      case 'payroll': return `Faculty Monthly Payroll & Disbursement Statement`;
      case 'master_timetable': return 'Institute Master Weekly Routine Matrix';
    }
  }

  get printableTableHtml(): string {
    if (this.selectedTab === 'workload') {
      const rows = this.filteredWorkloadTeachers.map((t, idx) => `
        <tr>
          <td style="text-align:center; font-weight:bold;">${idx + 1}</td>
          <td><strong>${t.teacherName}</strong></td>
          <td style="font-family:monospace;">${t.employeeCode}</td>
          <td>${t.qualification || '-'} ${t.specialization ? '• ' + t.specialization : ''}</td>
          <td style="text-align:center; font-weight:bold;">${t.assignedBatchCount}</td>
          <td style="text-align:center; font-weight:bold;">${t.weeklyClassesCount}</td>
          <td style="text-align:center; font-weight:bold;">${t.weeklyHours} hrs</td>
          <td style="text-align:center;">${this.getWorkloadStatusText(t.weeklyHours)}</td>
          <td style="text-align:center;">${t.totalStudentReach}</td>
        </tr>
      `).join('');
      return `
        <table>
          <thead>
            <tr>
              <th style="width:4%; text-align:center;">#</th>
              <th style="width:20%;">Faculty Name</th>
              <th style="width:14%;">Code</th>
              <th style="width:20%;">Qualification / Specialization</th>
              <th style="width:8%; text-align:center;">Batches</th>
              <th style="width:8%; text-align:center;">Classes/Wk</th>
              <th style="width:9%; text-align:center;">Hours/Wk</th>
              <th style="width:10%; text-align:center;">Load Status</th>
              <th style="width:7%; text-align:center;">Students</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } else if (this.selectedTab === 'attendance' && this.attendanceReport) {
      const rows = this.attendanceReport.rows.map((r, idx) => {
        const pRating = this.getPunctualityRating(r);
        return `
        <tr>
          <td style="text-align:center; font-weight:bold;">${idx + 1}</td>
          <td><strong>${r.personName || r.name}</strong></td>
          <td style="font-family:monospace;">${r.code}</td>
          <td style="text-align:center; font-weight:bold; color:#059669;">${r.presentDays}</td>
          <td style="text-align:center; font-weight:bold; color:#e11d48;">${r.absentDays}</td>
          <td style="text-align:center; font-weight:bold; color:#d97706;">${r.lateDays}</td>
          <td style="text-align:center;">${r.halfDays}</td>
          <td style="text-align:center;">${r.holidayDays}</td>
          <td style="text-align:center; font-weight:bold;">${r.totalWorkingDays}</td>
          <td style="text-align:center; font-weight:bold;">${this.getMonthlyPct(r)}% <span style="font-size:7pt; color:#64748b;">(MTD: ${this.getMtdPct(r)}%)</span></td>
          <td style="text-align:center; font-weight:700;">${pRating.title}</td>
        </tr>
      `;
      }).join('');
      return `
        <table>
          <thead>
            <tr>
              <th style="width:4%; text-align:center;">#</th>
              <th style="width:20%;">Faculty Name</th>
              <th style="width:12%;">Code</th>
              <th style="width:7%; text-align:center;">Present</th>
              <th style="width:7%; text-align:center;">Absent</th>
              <th style="width:6%; text-align:center;">Late</th>
              <th style="width:6%; text-align:center;">Half</th>
              <th style="width:8%; text-align:center;">Off/Sun</th>
              <th style="width:8%; text-align:center;">Working Days</th>
              <th style="width:12%; text-align:center;">Attendance %</th>
              <th style="width:14%; text-align:center;">Punctuality Rating</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } else if (this.selectedTab === 'payroll' && this.payrollReport) {
      const rows = this.payrollReport.payments.map((p, idx) => `
        <tr>
          <td style="text-align:center; font-weight:bold;">${idx + 1}</td>
          <td style="font-family:monospace; font-weight:bold;">${p.receiptNumber}</td>
          <td><strong>${p.teacherName}</strong></td>
          <td style="font-family:monospace;">${p.employeeCode}</td>
          <td>${p.paymentDate ? p.paymentDate.slice(0,10) : '-'}</td>
          <td style="text-align:right;">₹${p.grossAmount.toFixed(2)}</td>
          <td style="text-align:right; color:#e11d48;">₹${p.deductions.toFixed(2)}</td>
          <td style="text-align:right; color:#d97706;">₹${p.advanceAdjusted.toFixed(2)}</td>
          <td style="text-align:right; font-weight:bold; color:#059669;">₹${p.netPaid.toFixed(2)}</td>
          <td style="text-align:center;">${p.paymentMode}</td>
        </tr>
      `).join('');
      return `
        <table>
          <thead>
            <tr>
              <th style="width:4%; text-align:center;">#</th>
              <th style="width:12%;">Receipt #</th>
              <th style="width:18%;">Faculty Name</th>
              <th style="width:12%;">Code</th>
              <th style="width:10%;">Date</th>
              <th style="width:10%; text-align:right;">Gross</th>
              <th style="width:9%; text-align:right;">Deductions</th>
              <th style="width:9%; text-align:right;">Advance</th>
              <th style="width:10%; text-align:right;">Net Paid</th>
              <th style="width:6%; text-align:center;">Mode</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } else {
      const rows = this.filteredMasterTimetable.map((m, idx) => `
        <tr>
          <td style="text-align:center; font-weight:bold;">${idx + 1}</td>
          <td><strong>${m.teacherName}</strong></td>
          <td><strong>${m.batchName}</strong></td>
          <td>${m.subject}</td>
          <td style="font-weight:600;">${m.daysOfWeek || '-'}</td>
          <td style="font-weight:600; color:#0284c7;">${m.timeSlot || '-'}</td>
          <td style="text-align:center; font-weight:bold; color:#059669;">ACTIVE</td>
        </tr>
      `).join('');
      return `
        <table>
          <thead>
            <tr>
              <th style="width:4%; text-align:center;">#</th>
              <th style="width:20%;">Faculty Name</th>
              <th style="width:22%;">Batch Name</th>
              <th style="width:18%;">Subject</th>
              <th style="width:16%;">Routine Days</th>
              <th style="width:14%;">Time Slot</th>
              <th style="width:6%; text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }
  }

  printReport() {
    window.print();
  }


  exportActiveTabToCsv() {
    let csvContent = 'data:text/csv;charset=utf-8,';
    let filename = 'report.csv';

    if (this.selectedTab === 'workload') {
      filename = `faculty_workload_report_${new Date().toISOString().slice(0,10)}.csv`;
      csvContent += 'Faculty Name,Employee Code,Qualification,Assigned Batches,Classes Per Week,Weekly Hours,Load Status,Student Reach\n';
      this.filteredWorkloadTeachers.forEach(t => {
        csvContent += `"${t.teacherName}","${t.employeeCode}","${t.qualification || ''}",${t.assignedBatchCount},${t.weeklyClassesCount},${t.weeklyHours},"${this.getWorkloadStatusText(t.weeklyHours)}",${t.totalStudentReach}\n`;
      });
    } else if (this.selectedTab === 'attendance' && this.attendanceReport) {
      filename = `faculty_attendance_${this.attendanceMonth}_${this.attendanceYear}.csv`;
      csvContent += 'Faculty Name,Employee Code,Present Days,Absent Days,Late Days,Half Days,Holidays,Total Working Days,Monthly Attendance %,MTD Attendance %,Punctuality Rating\n';
      this.attendanceReport.rows.forEach(r => {
        csvContent += `"${r.personName || r.name}","${r.code}",${r.presentDays},${r.absentDays},${r.lateDays},${r.halfDays},${r.holidayDays},${r.totalWorkingDays},${this.getMonthlyPct(r)}%,${this.getMtdPct(r)}%,"${this.getPunctualityRating(r).title}"\n`;
      });
    } else if (this.selectedTab === 'payroll' && this.payrollReport) {
      filename = `faculty_payroll_${this.payrollMonth}_${this.payrollYear}.csv`;
      csvContent += 'Receipt Number,Faculty Name,Employee Code,Gross Amount,Deductions,Advance Adjusted,Net Paid,Payment Mode,Payment Date\n';
      this.payrollReport.payments.forEach(p => {
        csvContent += `"${p.receiptNumber}","${p.teacherName}","${p.employeeCode}",${p.grossAmount},${p.deductions},${p.advanceAdjusted},${p.netPaid},"${p.paymentMode}","${p.paymentDate}"\n`;
      });
    } else {
      filename = `master_routine_timetable_${new Date().toISOString().slice(0,10)}.csv`;
      csvContent += 'Faculty Name,Batch Name,Subject,Days Of Week,Time Slot\n';
      this.filteredMasterTimetable.forEach(m => {
        csvContent += `"${m.teacherName}","${m.batchName}","${m.subject}","${m.daysOfWeek || ''}","${m.timeSlot || ''}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
