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
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import {
  API_BASE,
  TeacherWorkloadReportDto,
  TeacherWorkloadSummaryItemDto,
  AttendanceReportDto,
  AttendanceReportRowDto,
  TeacherMonthlyPayrollReportDto,
  BatchAssignmentDto
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
    MatChipsModule
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

  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

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
          <input type="text" placeholder="Search by faculty name or employee code..." [(ngModel)]="workloadSearch">
        </div>
        <div class="filter-select-wrap">
          <label>Load Category:</label>
          <select [(ngModel)]="workloadFilter">
            <option value="all">All Workload Levels</option>
            <option value="light">Light Load (&lt; 10 hrs/wk)</option>
            <option value="optimal">Optimal Load (10 – 25 hrs/wk)</option>
            <option value="heavy">Heavy Load (&gt; 25 hrs/wk)</option>
          </select>
        </div>
      </div>

      <!-- Workload Table -->
      <div class="table-responsive-container">
        <table class="report-table">
          <thead>
            <tr>
              <th>Faculty Name & Code</th>
              <th>Qualification / Specialization</th>
              <th class="text-center">Assigned Batches</th>
              <th class="text-center">Classes / Week</th>
              <th class="text-center">Weekly Hours</th>
              <th class="text-center">Load Status</th>
              <th class="text-center">Student Reach</th>
              <th class="text-center">Routine Preview</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of filteredWorkloadTeachers">
              <td>
                <div class="faculty-name-cell">
                  <div class="avatar-circle">{{item.teacherName.charAt(0).toUpperCase()}}</div>
                  <div>
                    <span class="name-bold">{{item.teacherName}}</span>
                    <span class="code-sub">{{item.employeeCode}}</span>
                  </div>
                </div>
              </td>
              <td>
                <div class="qual-cell">
                  <span class="qual-text">{{item.qualification || 'N/A'}}</span>
                  <span class="spec-sub" *ngIf="item.specialization">{{item.specialization}}</span>
                </div>
              </td>
              <td class="text-center">
                <span class="badge-num" [class.badge-zero]="item.assignedBatchCount === 0">
                  {{item.assignedBatchCount}} Batches
                </span>
              </td>
              <td class="text-center">
                <strong class="metric-num">{{item.weeklyClassesCount}}</strong>
              </td>
              <td class="text-center">
                <span class="metric-hours">{{item.weeklyHours}} hrs</span>
              </td>
              <td class="text-center">
                <span class="status-chip" [ngClass]="getWorkloadStatusClass(item.weeklyHours)">
                  {{getWorkloadStatusText(item.weeklyHours)}}
                </span>
              </td>
              <td class="text-center">
                <span class="reach-pill">
                  <mat-icon>school</mat-icon> {{item.totalStudentReach}}
                </span>
              </td>
              <td class="text-center">
                <button mat-icon-button color="primary" (click)="openBatchDetails(item)" matTooltip="View assigned batch slots">
                  <mat-icon>visibility</mat-icon>
                </button>
              </td>
            </tr>
            <tr *ngIf="filteredWorkloadTeachers.length === 0">
              <td colspan="8" class="empty-table-cell">No faculty found matching the search criteria.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 2: Faculty Attendance Register -->
    <div class="tab-content" *ngIf="selectedTab === 'attendance'">
      <!-- Controls Bar -->
      <div class="filter-card">
        <div class="month-selector-group">
          <div class="select-field">
            <label>Month:</label>
            <select [(ngModel)]="attendanceMonth" (change)="loadAttendanceReport()">
              <option *ngFor="let m of months; let i = index" [value]="i + 1">{{m}}</option>
            </select>
          </div>
          <div class="select-field">
            <label>Year:</label>
            <select [(ngModel)]="attendanceYear" (change)="loadAttendanceReport()">
              <option *ngFor="let y of years" [value]="y">{{y}}</option>
            </select>
          </div>
          <button mat-raised-button color="primary" class="refresh-btn" (click)="loadAttendanceReport()">
            <mat-icon>refresh</mat-icon> Load Sheet
          </button>
        </div>
        <div class="matrix-toggle-group">
          <button mat-stroked-button class="matrix-bulk-btn" (click)="toggleExpandAll()">
            <mat-icon>{{expandAllDays ? 'unfold_less' : 'calendar_view_month'}}</mat-icon>
            <span>{{expandAllDays ? 'Collapse All Matrices' : 'Expand All 30-Day Matrices'}}</span>
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
        <table class="report-table">
          <thead>
            <tr>
              <th style="min-width: 220px;">Faculty Name</th>
              <th style="min-width: 110px;">Code</th>
              <th class="text-center" style="min-width: 70px;">Present</th>
              <th class="text-center" style="min-width: 70px;">Absent</th>
              <th class="text-center" style="min-width: 70px;">Late</th>
              <th class="text-center" style="min-width: 75px;">Half Days</th>
              <th class="text-center" style="min-width: 80px;">Off/Sundays</th>
              <th class="text-center" style="min-width: 85px;">Working Days</th>
              <th class="text-center" style="min-width: 170px;">Attendance %</th>
              <th class="text-center" style="min-width: 210px;">Punctuality Rating</th>
              <th class="text-center" style="min-width: 130px;">Daily Matrix</th>
            </tr>
          </thead>
          <tbody>
            <ng-container *ngFor="let row of attendanceReport.rows">
              <tr class="faculty-main-row" [class.expanded-row]="isExpanded(row.personId)">
                <td>
                  <div class="faculty-name-cell">
                    <div class="avatar-circle">{{(row.personName || row.name || '').slice(0, 2).toUpperCase()}}</div>
                    <div>
                      <span class="name-bold">{{row.personName || row.name}}</span>
                      <span class="role-sub">Teacher • Faculty</span>
                    </div>
                  </div>
                </td>
                <td style="white-space: nowrap;">
                  <span class="code-badge">{{row.code}}</span>
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
                <td colspan="11" class="matrix-drawer-container">
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
            <tr *ngIf="attendanceReport.rows.length === 0">
              <td colspan="11" class="empty-table-cell">No attendance records found for this month.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 3: Faculty Payroll Register -->
    <div class="tab-content" *ngIf="selectedTab === 'payroll'">
      <!-- Controls Bar -->
      <div class="filter-card">
        <div class="month-selector-group">
          <div class="select-field">
            <label>Month:</label>
            <select [(ngModel)]="payrollMonth" (change)="loadPayrollReport()">
              <option *ngFor="let m of months; let i = index" [value]="i + 1">{{m}}</option>
            </select>
          </div>
          <div class="select-field">
            <label>Year:</label>
            <select [(ngModel)]="payrollYear" (change)="loadPayrollReport()">
              <option *ngFor="let y of years" [value]="y">{{y}}</option>
            </select>
          </div>
          <button mat-raised-button color="primary" class="refresh-btn" (click)="loadPayrollReport()">
            <mat-icon>refresh</mat-icon> Load Payroll
          </button>
        </div>
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
        <table class="report-table">
          <thead>
            <tr>
              <th>Receipt #</th>
              <th>Faculty Name & Code</th>
              <th>Payment Date</th>
              <th class="text-right">Gross Amount</th>
              <th class="text-right">Deductions</th>
              <th class="text-right">Advance Adj</th>
              <th class="text-right">Net Paid</th>
              <th class="text-center">Mode</th>
              <th>Transaction Ref</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of payrollReport.payments">
              <td>
                <span class="receipt-badge">{{p.receiptNumber}}</span>
              </td>
              <td>
                <div class="faculty-name-cell">
                  <span class="name-bold">{{p.teacherName}}</span>
                  <span class="code-sub">{{p.employeeCode}}</span>
                </div>
              </td>
              <td>{{p.paymentDate | date:'dd MMM yyyy'}}</td>
              <td class="text-right">₹{{p.grossAmount | number:'1.2-2'}}</td>
              <td class="text-right text-rose">₹{{p.deductions | number:'1.2-2'}}</td>
              <td class="text-right text-amber">₹{{p.advanceAdjusted | number:'1.2-2'}}</td>
              <td class="text-right text-emerald font-bold">₹{{p.netPaid | number:'1.2-2'}}</td>
              <td class="text-center">
                <span class="mode-chip">{{p.paymentMode}}</span>
              </td>
              <td>
                <span class="ref-text">{{p.transactionRef || 'N/A'}}</span>
              </td>
            </tr>
            <tr *ngIf="payrollReport.payments.length === 0">
              <td colspan="9" class="empty-table-cell">
                No salary payments recorded yet for {{payrollReport.monthName}}.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 4: Master Timetable Routine Matrix -->
    <div class="tab-content" *ngIf="selectedTab === 'master_timetable'">
      <div class="filter-card">
        <div class="search-input-wrap">
          <mat-icon>search</mat-icon>
          <input type="text" placeholder="Filter master timetable by faculty or batch name..." [(ngModel)]="masterSearch">
        </div>
        <div class="filter-select-wrap">
          <label>Filter Day:</label>
          <select [(ngModel)]="masterDayFilter">
            <option value="all">All Days</option>
            <option *ngFor="let d of allDays" [value]="d">{{d}}</option>
          </select>
        </div>
      </div>

      <div class="table-responsive-container">
        <table class="report-table">
          <thead>
            <tr>
              <th>Faculty Name</th>
              <th>Batch Name</th>
              <th>Subject</th>
              <th>Routine Days</th>
              <th>Scheduled Time Slot</th>
              <th class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let m of filteredMasterTimetable">
              <td>
                <span class="name-bold">{{m.teacherName}}</span>
              </td>
              <td>
                <strong class="batch-col-name">{{m.batchName}}</strong>
              </td>
              <td>
                <span class="subject-chip">{{m.subject}}</span>
              </td>
              <td>
                <span class="days-badge">{{m.daysOfWeek || 'Not set'}}</span>
              </td>
              <td>
                <span class="slot-badge">{{m.timeSlot || 'Not set'}}</span>
              </td>
              <td class="text-center">
                <span class="status-chip active-chip">Active</span>
              </td>
            </tr>
            <tr *ngIf="filteredMasterTimetable.length === 0">
              <td colspan="6" class="empty-table-cell">No routine assignments match the search query.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- SLOTS DETAILS MODAL -->
  <div class="modal-backdrop" *ngIf="selectedTeacherDetails" (click)="selectedTeacherDetails = null">
    <div class="modal-card" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title-box">
          <mat-icon color="primary">assignment_ind</mat-icon>
          <div>
            <h3>{{selectedTeacherDetails.teacherName}}</h3>
            <p>{{selectedTeacherDetails.employeeCode}} • {{selectedTeacherDetails.qualification}}</p>
          </div>
        </div>
        <button mat-icon-button (click)="selectedTeacherDetails = null">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="modal-body">
        <div class="modal-kpis">
          <div class="modal-kpi">
            <span>Total Batches</span>
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
              <strong>{{s.batchName}}</strong>
              <span class="sbc-sub">{{s.subject}}</span>
            </div>
            <div class="sbc-details">
              <span><mat-icon>date_range</mat-icon> {{s.daysOfWeek}}</span>
              <span><mat-icon>schedule</mat-icon> {{s.timeSlot}}</span>
            </div>
          </div>
          <div *ngIf="selectedTeacherDetails.assignedBatches.length === 0" class="empty-slots-msg">
            No batch routine slots assigned yet for this faculty member.
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
    .page-container { display:flex; flex-direction:column; gap:20px; }
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
    .filter-card { background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; }
    .search-input-wrap { display:flex; align-items:center; gap:8px; background:#fff; border:1.5px solid #cbd5e1; border-radius:8px; padding:6px 12px; flex:1; min-width:240px;
      mat-icon{color:#94a3b8;font-size:20px;width:20px;height:20px;}
      input{border:none;outline:none;font-size:.88rem;color:#1e293b;width:100%;} }
    .filter-select-wrap { display:flex; align-items:center; gap:8px; font-size:.84rem; font-weight:600; color:#475569;
      select{border:1.5px solid #cbd5e1;border-radius:8px;padding:6px 12px;font-size:.86rem;font-weight:600;color:#1e293b;background:#fff;outline:none;} }
    .month-selector-group { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
    .select-field { display:flex; align-items:center; gap:6px; font-size:.86rem; font-weight:600; color:#475569;
      select{border:1.5px solid #cbd5e1;border-radius:8px;padding:6px 10px;font-size:.88rem;font-weight:600;background:#fff;} }
    .refresh-btn { font-weight:600; border-radius:8px; }

    /* Tables */
    .table-responsive-container { background:#fff; border-radius:10px; border:1px solid #e2e8f0; overflow-x:auto; -webkit-overflow-scrolling:touch; box-shadow:0 1px 3px rgba(0,0,0,0.03); }
    .report-table { width:100%; border-collapse:collapse; min-width:1120px; }
    .report-table th, .report-table td { padding:12px 14px; font-size:.86rem; border-bottom:1px solid #f1f5f9; text-align:left; vertical-align:middle; }
    .report-table thead th { background:#f8fafc; font-weight:700; color:#334155; border-bottom:2px solid #e2e8f0; white-space:nowrap; }
    .report-table tbody tr:hover { background:#f8faff; }

    .text-center { text-align:center !important; }
    .text-right { text-align:right !important; }
    .font-bold { font-weight:700; }
    .text-emerald { color:#059669; }
    .text-rose { color:#e11d48; }
    .text-amber { color:#d97706; }
    .text-purple { color:#7c3aed; }

    .faculty-name-cell { display:flex; align-items:center; gap:10px; }
    .avatar-circle { width:36px; height:36px; border-radius:50%; background:#e0f2fe; color:#0284c7; font-weight:700; font-size:.9rem; display:flex; align-items:center; justify-content:center; }
    .name-bold { font-weight:700; color:#0f172a; display:block; }
    .code-sub { font-size:.76rem; color:#64748b; font-family:monospace; }
    .qual-cell { display:flex; flex-direction:column; gap:2px; }
    .qual-text { font-weight:600; color:#334155; }
    .spec-sub { font-size:.76rem; color:#64748b; }

    .badge-num { background:#e0e7ff; color:#3730a3; padding:3px 8px; border-radius:6px; font-size:.78rem; font-weight:700; }
    .badge-num.badge-zero { background:#f1f5f9; color:#94a3b8; font-weight:500; }
    .metric-num { font-size:.92rem; color:#1e293b; }
    .metric-hours { font-weight:700; color:#0284c7; }
    .reach-pill { display:inline-flex; align-items:center; gap:4px; background:#ecfdf5; color:#059669; padding:2px 8px; border-radius:6px; font-size:.78rem; font-weight:700;
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
    .matrix-toggle-group { display:flex; align-items:center; margin-left:auto; }
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

    /* Modal Backdrop */
    .modal-backdrop { position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px; }
    .modal-card { background:#ffffff; border-radius:14px; width:100%; max-width:600px; max-height:90vh; overflow-y:auto; box-shadow:0 20px 40px rgba(0,0,0,0.2); animation:modalSlideUp .2s ease-out; }
    .modal-header { display:flex; justify-content:space-between; align-items:center; padding:18px 20px; border-bottom:1px solid #f1f5f9; }
    .modal-title-box { display:flex; align-items:center; gap:12px;
      mat-icon{font-size:30px;width:30px;height:30px;}
      h3{margin:0;font-size:1.15rem;font-weight:700;color:#0f172a;}
      p{margin:2px 0 0;font-size:.82rem;color:#64748b;} }
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
  workloadSearch = '';
  workloadFilter: 'all' | 'light' | 'optimal' | 'heavy' = 'all';
  selectedTeacherDetails: TeacherWorkloadSummaryItemDto | null = null;

  // Tab 2: Attendance Data
  attendanceMonth = new Date().getMonth() + 1;
  attendanceYear = new Date().getFullYear();
  attendanceReport: AttendanceReportDto | null = null;

  // Tab 3: Payroll Data
  payrollMonth = new Date().getMonth() + 1;
  payrollYear = new Date().getFullYear();
  payrollReport: TeacherMonthlyPayrollReportDto | null = null;

  // Tab 4: Master Timetable
  masterTimetable: BatchAssignmentDto[] = [];
  masterSearch = '';
  masterDayFilter = 'all';

  readonly months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  readonly years = [2025, 2026, 2027];
  readonly allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  constructor(
    private http: HttpClient,
    private authService: AuthService,
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
    this.route.queryParams.subscribe(params => {
      const tabParam = params['tab'];
      if (tabParam === 'workload' || tabParam === 'attendance' || tabParam === 'payroll' || tabParam === 'master_timetable') {
        this.selectedTab = tabParam;
      }
    });
    this.loadWorkloadReport();
    this.loadAttendanceReport();
    this.loadPayrollReport();
    this.loadMasterTimetable();
  }

  setTab(tab: 'workload' | 'attendance' | 'payroll' | 'master_timetable') {
    this.selectedTab = tab;
  }

  // Workload Methods
  loadWorkloadReport() {
    this.loading = true;
    this.http.get<TeacherWorkloadReportDto>(`${this.api}/teachers/reports/workload`).subscribe({
      next: r => {
        this.workloadReport = r;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  get filteredWorkloadTeachers(): TeacherWorkloadSummaryItemDto[] {
    if (!this.workloadReport) return [];
    return this.workloadReport.teachers.filter(t => {
      const q = this.workloadSearch.trim().toLowerCase();
      const matchSearch = !q ||
        t.teacherName.toLowerCase().includes(q) ||
        t.employeeCode.toLowerCase().includes(q) ||
        (t.specialization && t.specialization.toLowerCase().includes(q));

      let matchFilter = true;
      if (this.workloadFilter === 'light') matchFilter = t.weeklyHours < 10;
      else if (this.workloadFilter === 'optimal') matchFilter = t.weeklyHours >= 10 && t.weeklyHours <= 25;
      else if (this.workloadFilter === 'heavy') matchFilter = t.weeklyHours > 25;

      return matchSearch && matchFilter;
    });
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
  loadAttendanceReport() {
    this.loading = true;
    this.http.get<AttendanceReportDto>(`${this.api}/teachers/attendance/report?month=${this.attendanceMonth}&year=${this.attendanceYear}`)
      .subscribe({
        next: r => {
          this.attendanceReport = r;
          this.loading = false;
        },
        error: () => this.loading = false
      });
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
    this.http.get<any[]>(`${this.api}/teachers/${teacherId}/attendance?month=${this.attendanceMonth}&year=${this.attendanceYear}`)
      .subscribe({
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
  loadPayrollReport() {
    this.loading = true;
    this.http.get<TeacherMonthlyPayrollReportDto>(`${this.api}/teachers/reports/payroll?month=${this.payrollMonth}&year=${this.payrollYear}`)
      .subscribe({
        next: r => {
          this.payrollReport = r;
          this.loading = false;
        },
        error: () => this.loading = false
      });
  }

  // Master Timetable Methods
  loadMasterTimetable() {
    this.http.get<BatchAssignmentDto[]>(`${this.api}/teachers/reports/master-timetable`).subscribe({
      next: r => this.masterTimetable = r,
      error: () => {}
    });
  }

  get filteredMasterTimetable(): BatchAssignmentDto[] {
    return this.masterTimetable.filter(m => {
      const q = this.masterSearch.trim().toLowerCase();
      const matchSearch = !q ||
        m.teacherName.toLowerCase().includes(q) ||
        (m.batchName || '').toLowerCase().includes(q) ||
        (m.className || '').toLowerCase().includes(q) ||
        m.subject.toLowerCase().includes(q);

      let matchDay = true;
      if (this.masterDayFilter !== 'all') {
        matchDay = !!(m.daysOfWeek && m.daysOfWeek.toLowerCase().includes(this.masterDayFilter.toLowerCase()));
      }

      return matchSearch && matchDay;
    });
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
