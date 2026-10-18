import { Component, OnInit, inject, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';
import { environment } from '../../../environments/environment';

const API_BASE = environment.apiUrl;

export interface MonthlySubjectTestMark {
  subjectName: string;
  maxMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade: string;
}

export interface MonthlyStudentPerformanceRow {
  studentId: string;
  studentName: string;
  rollNumber: string;
  admissionNumber?: string;
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  parentWhatsAppPhone?: string;
  profilePhoto?: string;
  photoUrl?: string;
  // 1. Attendance Metrics
  totalWorkingDays: number;
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  daysHalfDay: number;
  attendancePercentage: number;
  // 2. Homework / Classwork Metrics (Point 1)
  totalHwAssigned: number;
  totalHwCompleted: number;
  totalHwDefaulter: number;
  hwCompletionRate: number;
  // 3. Good Manners & Conduct Metrics (Point 2)
  behaviourAvgStars: number;
  totalBehaviourDays: number;
  fiveStarDays: number;
  dominantUniformStatus: string;
  dominantDisciplineStatus: string;
  // 4. Academic Tests & Assessments
  subjectTests: MonthlySubjectTestMark[];
  totalTestMaxMarks: number;
  totalTestObtainedMarks: number;
  testAveragePercentage: number;
  // 5. Consolidated Overall Index & Grade
  overallPerformanceScore: number;
  overallGrade: string;
  classRank: number;
  teacherMonthlyRemark?: string;
}

export interface MonthlyPerformanceReportHeader {
  institutionName: string;
  subtitleOrAddress: string;
  reportTitle: string;
  month: number;
  year: number;
  monthName: string;
  className?: string;
  sectionName?: string;
  classTeacherName?: string;
  totalStudentsEvaluated: number;
  classAverageAttendance: number;
  classAverageHwRate: number;
  classAverageBehaviourStars: number;
  classAverageTestScore: number;
  rows: MonthlyStudentPerformanceRow[];
}

@Component({
  selector: 'app-monthly-performance',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    MatMenuModule,
    MatProgressBarModule,
    IstDatetimeDirective
  ],
  template: `
    <div class="page-container">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>insights</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Monthly Student Performance Report</h1>
            <p class="page-subtitle">
              Comprehensive 360° scorecard: Attendance, HW consistency, Manners &amp; Ethics, Test marks &amp; Class ranks
            </p>
          </div>
        </div>

        <div class="header-actions">
          <!-- 3-Way Feature Switcher -->
          <div class="module-nav-pills notranslate" translate="no">
            <a mat-button routerLink="/school/homework" class="nav-pill-btn">
              <mat-icon>menu_book</mat-icon>
              <span>1. CW &amp; HW Diary</span>
            </a>
            <a mat-button routerLink="/school/good-manners" class="nav-pill-btn">
              <mat-icon>hotel_class</mat-icon>
              <span>2. Good Manners &amp; Behaviour</span>
            </a>
            <a mat-button routerLink="/school/monthly-performance" class="nav-pill-btn active">
              <mat-icon>insights</mat-icon>
              <span>3. Monthly Performance</span>
            </a>
          </div>

          <button mat-stroked-button class="refresh-btn" (click)="loadPerformanceReport()" [disabled]="loading">
            <mat-icon [class.spin]="loading">refresh</mat-icon>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <!-- Reactive Filters Card -->
      <mat-card class="filter-card">
        <form [formGroup]="filterForm" class="filter-form-row">
          <mat-form-field appearance="outline" class="filter-control month-control" subscriptSizing="dynamic">
            <mat-label>Month (महीना)</mat-label>
            <mat-select formControlName="month" (selectionChange)="loadPerformanceReport()">
              <mat-option *ngFor="let m of months" [value]="m.val">{{ m.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-control year-control" subscriptSizing="dynamic">
            <mat-label>Year (वर्ष)</mat-label>
            <mat-select formControlName="year" (selectionChange)="loadPerformanceReport()">
              <mat-option *ngFor="let y of years" [value]="y">{{ y }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-control class-control" subscriptSizing="dynamic">
            <mat-label>Select Class (कक्षा) *</mat-label>
            <mat-select formControlName="classId" (selectionChange)="onClassChange()">
              <mat-option *ngFor="let c of classes" [value]="c.id">{{ c.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-control section-control" *ngIf="sections.length > 0" subscriptSizing="dynamic">
            <mat-label>Section (वर्ग)</mat-label>
            <mat-select formControlName="sectionId" (selectionChange)="loadPerformanceReport()">
              <mat-option value="">All Sections</mat-option>
              <mat-option *ngFor="let s of sections" [value]="s.id">{{ s.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <div class="deck-actions-group">
            <button mat-stroked-button class="print-master-btn" type="button" (click)="printMasterRegister()" [disabled]="students.length === 0">
              <mat-icon>print</mat-icon>
              <span>Print Class Master Sheet</span>
            </button>

            <button mat-raised-button class="save-remarks-btn" type="button" (click)="saveTeacherRemarks()" [disabled]="saving || students.length === 0">
              <mat-icon *ngIf="!saving">save</mat-icon>
              <mat-icon *ngIf="saving" class="spin">sync</mat-icon>
              <span>{{ saving ? 'Saving...' : 'Save Remarks' }}</span>
            </button>
          </div>
        </form>
      </mat-card>

      <!-- Class Performance Benchmark KPI Grid -->
      <div class="kpi-grid" *ngIf="reportHeader && students.length > 0">
        <div class="kpi-card kpi-blue">
          <div class="kpi-icon-wrap"><mat-icon>groups</mat-icon></div>
          <div class="kpi-info">
            <span class="kpi-label">Students Evaluated</span>
            <span class="kpi-val">{{ reportHeader.totalStudentsEvaluated }}</span>
          </div>
        </div>

        <div class="kpi-card kpi-emerald">
          <div class="kpi-icon-wrap"><mat-icon>calendar_month</mat-icon></div>
          <div class="kpi-info">
            <span class="kpi-label">Class Avg. Attendance</span>
            <span class="kpi-val">{{ reportHeader.classAverageAttendance }}%</span>
          </div>
        </div>

        <div class="kpi-card kpi-violet">
          <div class="kpi-icon-wrap"><mat-icon>menu_book</mat-icon></div>
          <div class="kpi-info">
            <span class="kpi-label">H.W. Completion Rate</span>
            <span class="kpi-val">{{ reportHeader.classAverageHwRate }}%</span>
          </div>
        </div>

        <div class="kpi-card kpi-amber">
          <div class="kpi-icon-wrap"><mat-icon>hotel_class</mat-icon></div>
          <div class="kpi-info">
            <span class="kpi-label">Manners &amp; Conduct</span>
            <span class="kpi-val">{{ reportHeader.classAverageBehaviourStars }} / 5.0 ⭐</span>
          </div>
        </div>

        <div class="kpi-card kpi-gold" *ngIf="topPerformer">
          <div class="kpi-icon-wrap"><mat-icon>military_tech</mat-icon></div>
          <div class="kpi-info">
            <span class="kpi-label">Rank 1 (Topper)</span>
            <span class="kpi-val-sm">{{ topPerformer.studentName }} ({{ topPerformer.overallPerformanceScore }}%)</span>
          </div>
        </div>
      </div>

      <!-- Main Master Performance Table -->
      <div class="table-container" *ngIf="students.length > 0" id="monthlyMasterPrintSection">
        <!-- Print-Only School Header for Master Sheet -->
        <div class="print-master-header">
          <div class="pmh-school-name">{{ authService.getInstituteName() || 'Jnandeep Campus' }}</div>
          <div class="pmh-title">STUDENT MONTHLY PERFORMANCE MASTER REGISTER</div>
          <div class="pmh-meta-row">
            <span>Month: <strong>{{ reportHeader?.monthName }} {{ reportHeader?.year }}</strong></span>
            <span>Class: <strong>{{ reportHeader?.className }}</strong> <strong *ngIf="reportHeader?.sectionName">({{ reportHeader?.sectionName }})</strong></span>
            <span>Total Evaluated: <strong>{{ reportHeader?.totalStudentsEvaluated }}</strong></span>
            <span>Avg Attendance: <strong>{{ reportHeader?.classAverageAttendance }}%</strong></span>
            <span>HW Rate: <strong>{{ reportHeader?.classAverageHwRate }}%</strong></span>
            <span>Avg Behaviour: <strong>{{ reportHeader?.classAverageBehaviourStars }}/5.0 ⭐</strong></span>
          </div>
        </div>

        <table class="master-table">
          <thead>
            <tr>
              <th class="th-rank">Rank</th>
              <th class="th-roll">Roll</th>
              <th class="th-name">Student Name</th>
              <th class="th-metric">Attendance</th>
              <th class="th-metric">H.W. Done</th>
              <th class="th-metric">Manners ⭐</th>
              <th class="th-metric">Test Score</th>
              <th class="th-score">Overall Score</th>
              <th class="th-grade">Grade</th>
              <th class="th-remarks">Teacher Appraisal Remarks</th>
              <th class="th-action hide-on-print">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of students; let i = index">
              <td class="col-rank text-center">
                <span class="rank-badge" [class.rank-1]="s.classRank === 1" [class.rank-2]="s.classRank === 2" [class.rank-3]="s.classRank === 3">
                  {{ s.classRank === 1 ? '🥇' : (s.classRank === 2 ? '🥈' : (s.classRank === 3 ? '🥉' : '#' + s.classRank)) }}
                </span>
              </td>
              <td class="col-roll text-center">{{ s.rollNumber || '—' }}</td>
              <td class="col-name">
                <span class="st-name-txt">{{ s.studentName }}</span>
              </td>
              <td class="col-metric text-center">
                <span class="pct-pill" [ngClass]="getPercentClass(s.attendancePercentage)">
                  {{ s.attendancePercentage }}%
                </span>
                <span class="sub-detail">({{ s.daysPresent }} / {{ s.totalWorkingDays }} days)</span>
              </td>
              <td class="col-metric text-center">
                <span class="pct-pill" [ngClass]="getPercentClass(s.hwCompletionRate)">
                  {{ s.hwCompletionRate }}%
                </span>
                <span class="sub-detail">({{ s.totalHwCompleted }} / {{ s.totalHwAssigned }} HW)</span>
              </td>
              <td class="col-metric text-center">
                <span class="star-badge">
                  ★ {{ s.behaviourAvgStars }}
                </span>
                <span class="sub-detail">{{ s.fiveStarDays }} days 5★</span>
              </td>
              <td class="col-metric text-center">
                <span class="pct-pill" [ngClass]="getPercentClass(s.testAveragePercentage)">
                  {{ s.testAveragePercentage }}%
                </span>
                <span class="sub-detail" *ngIf="s.subjectTests.length > 0">{{ s.subjectTests.length }} tests</span>
                <span class="sub-detail" *ngIf="s.subjectTests.length === 0">No tests</span>
              </td>
              <td class="col-score text-center">
                <strong class="score-txt">{{ s.overallPerformanceScore }}%</strong>
              </td>
              <td class="col-grade text-center">
                <span class="print-grade-text">{{ s.overallGrade }}</span>
                <select class="grade-select hide-on-print" [(ngModel)]="s.overallGrade" [ngClass]="getGradeClass(s.overallGrade)">
                  <option value="A+">A+ (Outstanding)</option>
                  <option value="A">A (Excellent)</option>
                  <option value="B+">B+ (Very Good)</option>
                  <option value="B">B (Good)</option>
                  <option value="C">C (Needs Improvement)</option>
                </select>
              </td>
              <td class="col-remarks">
                <span class="print-remark-text">{{ s.teacherMonthlyRemark || '—' }}</span>
                <input type="text" class="remark-edit-input hide-on-print" [(ngModel)]="s.teacherMonthlyRemark" placeholder="Enter teacher note for scorecard...">
              </td>
              <td class="col-action hide-on-print text-center">
                <button mat-icon-button [matMenuTriggerFor]="studentActionMenu" class="row-3dots-btn" matTooltip="Actions">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #studentActionMenu="matMenu" class="smart-action-menu">
                  <button mat-menu-item (click)="openStudentScorecard(s)">
                    <mat-icon class="menu-icon-blue">badge</mat-icon>
                    <span>View &amp; Print Scorecard</span>
                  </button>
                  <button mat-menu-item (click)="sendStudentWhatsApp(s)">
                    <mat-icon class="menu-icon-green">chat</mat-icon>
                    <span>Share on WhatsApp</span>
                  </button>
                </mat-menu>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Print-Only Signatures -->
        <div class="print-master-signatures">
          <div class="sig-col"><div class="sig-line"></div><span>Class Teacher</span></div>
          <div class="sig-col"><div class="sig-line"></div><span>Exam Incharge / Coordinator</span></div>
          <div class="sig-col"><div class="sig-line"></div><span>Principal Sign &amp; Seal</span></div>
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

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
      background: #ffffff;
      padding: 16px 20px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-icon-box {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(2, 132, 199, 0.25);
    }

    .header-icon-box mat-icon {
      font-size: 26px;
      width: 26px;
      height: 26px;
    }

    .page-title {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
      letter-spacing: -0.02em;
    }

    .page-subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 4px 0 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .module-nav-pills {
      display: flex;
      align-items: center;
      background: #f1f5f9;
      padding: 4px;
      border-radius: 10px;
      gap: 6px;
      border: 1px solid #e2e8f0;
      overflow-x: auto;
      max-width: 100%;
      box-sizing: border-box;
      scrollbar-width: none;
      &::-webkit-scrollbar { display: none; }
    }

    .nav-pill-btn {
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      color: #475569 !important;
      padding: 6px 12px !important;
      border-radius: 8px !important;
      text-decoration: none !important;
      white-space: nowrap !important;
      flex: 0 0 auto !important;
      flex-shrink: 0 !important;
      transition: all 0.2s ease !important;
    }

    .nav-pill-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .nav-pill-btn.active {
      background: #ffffff;
      color: #0284c7;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      border: 1px solid #bae6fd;
    }

    .refresh-btn {
      height: 40px;
      border-color: #cbd5e1;
      color: #334155;
    }

    .filter-card {
      padding: 16px 20px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
    }

    .filter-form-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }

    .filter-control {
      flex: 1 1 160px;
      min-width: 140px;
      margin-bottom: 0 !important;
    }

    .filter-control ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none !important;
    }

    .deck-actions-group {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-left: auto;
      flex-wrap: wrap;
    }

    .print-master-btn {
      color: #0369a1;
      border-color: #bae6fd;
      background: #f0f9ff;
      height: 48px;
      display: inline-flex;
      align-items: center;
      font-weight: 600;
      border-radius: 8px;
    }

    .save-remarks-btn {
      background: #0284c7 !important;
      color: #ffffff !important;
      height: 48px;
      display: inline-flex;
      align-items: center;
      font-weight: 600;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(2, 132, 199, 0.25);
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 14px;
    }

    .kpi-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .kpi-icon-wrap {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .kpi-icon-wrap mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .kpi-info {
      display: flex;
      flex-direction: column;
    }

    .kpi-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .kpi-val {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
    }

    .kpi-val-sm {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }

    .kpi-blue .kpi-icon-wrap { background: #e0f2fe; color: #0284c7; }
    .kpi-emerald .kpi-icon-wrap { background: #dcfce7; color: #16a34a; }
    .kpi-violet .kpi-icon-wrap { background: #ede9fe; color: #7c3aed; }
    .kpi-amber .kpi-icon-wrap { background: #fef3c7; color: #d97706; }
    .kpi-gold .kpi-icon-wrap { background: #fef08a; color: #ca8a04; }

    /* Table Container */
    .table-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .master-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      text-align: left;
    }

    .master-table th {
      background: #f8fafc;
      color: #334155;
      font-weight: 700;
      padding: 10px 8px;
      border-bottom: 2px solid #e2e8f0;
      white-space: nowrap;
      font-size: 11px;
    }

    .master-table td {
      padding: 8px 6px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }

    .master-table tr:hover {
      background: #f8fafc;
    }

    .text-center { text-align: center !important; }

    .rank-badge {
      display: inline-block;
      font-size: 12px;
      font-weight: 700;
      color: #475569;
    }

    .rank-1 { font-size: 16px; }
    .rank-2 { font-size: 15px; }
    .rank-3 { font-size: 14px; }

    .st-name-txt {
      font-weight: 700;
      color: #0f172a;
    }

    .pct-pill {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 12px;
    }

    .sub-detail {
      display: block;
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }

    .star-badge {
      display: inline-block;
      background: #fefce8;
      color: #b45309;
      border: 1px solid #fef08a;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 12px;
    }

    .score-txt {
      font-size: 13px;
      color: #1e3a8a;
    }

    .grade-select {
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      font-size: 11px;
      font-weight: 700;
      outline: none;
    }

    .gr-a-plus { background: #dcfce7; color: #15803d; border-color: #86efac; }
    .gr-a { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
    .gr-b { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
    .gr-c { background: #fffbeb; color: #b45309; border-color: #fde68a; }

    .pct-high { background: #dcfce7; color: #15803d; }
    .pct-mid { background: #fef3c7; color: #b45309; }
    .pct-low { background: #fee2e2; color: #b91c1c; }

    .col-remarks {
      min-width: 120px;
      padding: 8px 6px;
    }

    .remark-edit-input {
      width: 100%;
      box-sizing: border-box;
      padding: 5px 8px;
      border-radius: 6px;
      border: 1.5px solid #cbd5e1;
      font-size: 11px;
      background: #f8fafc;
      outline: none;
      transition: all 0.2s ease;
    }

    .remark-edit-input:focus {
      background: #ffffff;
      border-color: #0284c7;
      box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
    }

    .col-action {
      width: 44px;
      min-width: 44px;
      text-align: center;
      padding: 4px !important;
      vertical-align: middle;
    }

    .row-3dots-btn {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 32px !important;
      height: 32px !important;
      min-width: 32px !important;
      min-height: 32px !important;
      padding: 0 !important;
      margin: 0 auto !important;
      border-radius: 50% !important;
      color: #64748b !important;
      background: transparent;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
      vertical-align: middle !important;
    }

    .row-3dots-btn ::ng-deep .mat-mdc-button-touch-target {
      display: none !important;
    }

    .row-3dots-btn ::ng-deep .mat-mdc-button-persistent-ripple,
    .row-3dots-btn ::ng-deep .mat-ripple {
      border-radius: 50% !important;
      width: 32px !important;
      height: 32px !important;
      top: 0 !important;
      left: 0 !important;
    }

    .row-3dots-btn mat-icon {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 18px !important;
      height: 18px !important;
      font-size: 18px !important;
      line-height: 18px !important;
      margin: 0 !important;
      padding: 0 !important;
      color: inherit;
    }

    .row-3dots-btn:hover {
      background: #eff6ff !important;
      color: #0284c7 !important;
      box-shadow: 0 0 0 5px #eff6ff, 0 2px 6px rgba(2, 132, 199, 0.15) !important;
    }

    .menu-icon-blue { color: #0284c7 !important; }
    .menu-icon-green { color: #16a34a !important; }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    .print-master-header { display: none; }
    .print-master-signatures { display: none; }
    .print-grade-text { display: none; }
    .print-remark-text { display: none; }

    @media print {
      .print-master-header {
        display: block !important;
        margin-bottom: 12px;
        text-align: center;
      }

      .pmh-school-name {
        font-size: 20px;
        font-weight: 800;
        color: #1e3a8a;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .pmh-title {
        font-size: 13px;
        font-weight: 700;
        color: #0f172a;
        margin-top: 2px;
        border-bottom: 1.5px solid #0f172a;
        padding-bottom: 4px;
      }

      .pmh-meta-row {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 6px;
        font-size: 11px;
        color: #334155;
      }

      .print-master-signatures {
        display: flex !important;
        justify-content: space-between;
        margin-top: 36px;
        padding: 0 30px;
      }

      .sig-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 700;
        color: #0f172a;
      }

      .sig-line {
        width: 160px;
        border-top: 1px solid #0f172a;
        margin-bottom: 4px;
      }

      .print-grade-text {
        display: inline-block !important;
        font-weight: 700;
        font-size: 11px;
      }

      .print-remark-text {
        display: inline-block !important;
        font-size: 11px;
        color: #334155;
      }

      .master-table {
        width: 100% !important;
        min-width: 100% !important;
        border: 1.5px solid #0f172a !important;
        border-collapse: collapse !important;
        font-size: 11px !important;
      }

      .master-table th, .master-table td {
        border: 1px solid #cbd5e1 !important;
        padding: 4px 6px !important;
        color: #000000 !important;
      }

      .master-table th {
        background: #f1f5f9 !important;
        font-weight: 700 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .hide-on-print {
        display: none !important;
      }

      @page {
        size: A4 landscape;
        margin: 6mm 8mm;
      }
    }

    /* =========================================================================
       RESPONSIVE ADAPTATIONS (Tablet <= 1024px & Mobile <= 640px)
       ========================================================================= */
    @media (max-width: 1024px) {
      .page-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 14px;
      }
      .header-actions {
        width: 100%;
        justify-content: space-between;
        flex-wrap: wrap;
      }
      .filter-control {
        flex: 1 1 180px;
      }
      .deck-actions-group {
        width: 100%;
        margin-left: 0;
        justify-content: flex-start;
      }
      .kpi-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 640px) {
      .page-header {
        padding: 12px 14px;
      }
      .header-left {
        gap: 10px;
      }
      .header-icon-box {
        width: 40px;
        height: 40px;
        border-radius: 10px;
      }
      .header-icon-box mat-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
      }
      .page-title {
        font-size: 16px;
      }
      .page-subtitle {
        font-size: 11px;
      }
      .header-actions {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }
      .module-nav-pills {
        width: 100% !important;
        display: flex !important;
        flex-wrap: nowrap !important;
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch !important;
        box-sizing: border-box !important;
        padding: 4px !important;
        gap: 6px !important;
      }
      .nav-pill-btn {
        flex: 0 0 auto !important;
        flex-shrink: 0 !important;
        font-size: 11px !important;
        padding: 6px 10px !important;
        white-space: nowrap !important;
      }
      .refresh-btn {
        width: 100%;
        justify-content: center;
      }
      .filter-card {
        padding: 12px 14px;
      }
      .filter-form-row {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }
      .filter-control {
        width: 100% !important;
        min-width: 100% !important;
        flex: 1 1 100% !important;
      }
      .deck-actions-group {
        width: 100% !important;
        margin-left: 0 !important;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }
      .print-master-btn,
      .save-remarks-btn {
        width: 100% !important;
        justify-content: center;
      }
      .kpi-grid {
        grid-template-columns: 1fr;
      }
      .table-container {
        border-radius: 8px;
      }
    }
  `]
})
export class MonthlyPerformanceComponent implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private confirmDialog = inject(ConfirmDialogService);
  public authService = inject(AuthService);

  filterForm!: FormGroup;
  classes: any[] = [];
  sections: any[] = [];
  students: MonthlyStudentPerformanceRow[] = [];
  reportHeader?: MonthlyPerformanceReportHeader;
  loading = false;
  saving = false;

  months = [
    { val: 1, name: 'January (जनवरी)' },
    { val: 2, name: 'February (फ़रवरी)' },
    { val: 3, name: 'March (मार्च)' },
    { val: 4, name: 'April (अप्रैल)' },
    { val: 5, name: 'May (मई)' },
    { val: 6, name: 'June (जून)' },
    { val: 7, name: 'July (जुलाई)' },
    { val: 8, name: 'August (अगस्त)' },
    { val: 9, name: 'September (सितंबर)' },
    { val: 10, name: 'October (अक्टूबर)' },
    { val: 11, name: 'November (नवंबर)' },
    { val: 12, name: 'December (दिसंबर)' }
  ];

  years: number[] = [];

  get topPerformer(): MonthlyStudentPerformanceRow | undefined {
    return this.students.find(s => s.classRank === 1);
  }

  ngOnInit(): void {
    const now = new Date();
    const currentYear = now.getFullYear();
    this.years = [currentYear - 1, currentYear, currentYear + 1];

    this.filterForm = this.fb.group({
      month: [now.getMonth() + 1],
      year: [currentYear],
      classId: [''],
      sectionId: ['']
    });

    this.loadClasses();
  }

  loadClasses(): void {
    this.http.get<any[]>(`${API_BASE}/school/classes`).subscribe({
      next: (res) => {
        this.classes = res || [];
        if (this.classes.length > 0) {
          this.filterForm.patchValue({ classId: this.classes[0].id });
          this.sections = this.classes[0].sections || [];
          this.loadPerformanceReport();
        }
      },
      error: () => {
        this.confirmDialog.alert('Error', 'Failed to load school classes.', 'danger');
      }
    });
  }

  onClassChange(): void {
    const classId = this.filterForm.get('classId')?.value;
    const selected = this.classes.find(c => c.id === classId);
    this.sections = selected?.sections || [];
    this.filterForm.patchValue({ sectionId: '' });
    this.loadPerformanceReport();
  }

  loadPerformanceReport(): void {
    const fv = this.filterForm.value;
    if (!fv.classId) return;

    this.loading = true;
    let url = `${API_BASE}/homework/monthly-performance/report?month=${fv.month}&year=${fv.year}&classId=${fv.classId}`;
    if (fv.sectionId) {
      url += `&sectionId=${fv.sectionId}`;
    }

    this.http.get<MonthlyPerformanceReportHeader>(url).subscribe({
      next: (header) => {
        this.reportHeader = header;
        this.students = header.rows || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.confirmDialog.alert('Fetch Error', 'Failed to calculate monthly performance report.', 'danger');
      }
    });
  }

  saveTeacherRemarks(): void {
    const fv = this.filterForm.value;
    if (this.students.length === 0) return;

    this.saving = true;
    const payload = {
      month: fv.month,
      year: fv.year,
      classId: fv.classId,
      sectionId: fv.sectionId || null,
      items: this.students.map(s => ({
        studentId: s.studentId,
        teacherRemarks: s.teacherMonthlyRemark,
        overallGrade: s.overallGrade
      }))
    };

    this.http.post(`${API_BASE}/homework/monthly-performance/save-remarks`, payload).subscribe({
      next: () => {
        this.saving = false;
        this.confirmDialog.alert(
          'Saved 🎉',
          `Teacher remarks and overall grades for ${this.reportHeader?.monthName} saved successfully!`,
          'success'
        );
      },
      error: () => {
        this.saving = false;
        this.confirmDialog.alert('Save Failed', 'Could not save monthly evaluation remarks.', 'danger');
      }
    });
  }

  printMasterRegister(): void {
    const el = document.getElementById('monthlyMasterPrintSection');
    if (!el) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1150,height=850');
    if (!printWindow) {
      window.print();
      return;
    }

    const schoolName = this.authService.getInstituteName() || 'Jnandeep Campus';
    const month = this.reportHeader?.monthName || '';
    const year = this.reportHeader?.year || '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Monthly Performance Master Register - ${month} ${year}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #ffffff; color: #0f172a; padding: 6mm 8mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 11px; }
            .print-master-header { display: block !important; margin-bottom: 10px; text-align: center; }
            .pmh-school-name { font-size: 20px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; }
            .pmh-title { font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px; border-bottom: 1.5px solid #0f172a; padding-bottom: 4px; }
            .pmh-meta-row { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-top: 6px; font-size: 11px; color: #334155; }
            .master-table { width: 100%; border-collapse: collapse; font-size: 11px; border: 1.5px solid #0f172a; margin-top: 8px; }
            .master-table th, .master-table td { border: 1px solid #94a3b8; padding: 5px 6px; vertical-align: middle; }
            .master-table th { background: #f1f5f9; font-weight: 700; color: #0f172a; }
            .text-center { text-align: center; }
            .print-grade-text { display: inline-block !important; font-weight: 700; font-size: 11px; }
            .print-remark-text { display: inline-block !important; font-size: 11px; color: #334155; }
            .grade-select, .remark-edit-input, .hide-on-print { display: none !important; }
            .pct-pill, .star-badge { font-weight: 600; }
            .sub-detail { font-size: 9px; color: #64748b; }
            .print-master-signatures { display: flex !important; justify-content: space-between; margin-top: 36px; padding: 0 30px; }
            .sig-col { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #0f172a; }
            .sig-line { width: 160px; border-top: 1px solid #0f172a; margin-bottom: 4px; }
            @page { size: A4 landscape; margin: 6mm 8mm; }
          </style>
        </head>
        <body>
          ${el.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 350);
  }

  openStudentScorecard(row: MonthlyStudentPerformanceRow): void {
    const instName = (this.reportHeader?.institutionName && this.reportHeader.institutionName.trim().length > 0)
      ? this.reportHeader.institutionName.trim()
      : (this.authService.getInstituteName() || 'School / College Institution');
    const instAddress = (this.reportHeader?.subtitleOrAddress && this.reportHeader.subtitleOrAddress.trim().length > 0)
      ? this.reportHeader.subtitleOrAddress.trim()
      : '';
    const logoUrl = this.authService.getInstituteLogoUrl();

    this.dialog.open(MonthlyStudentScorecardDialogComponent, {
      width: '840px',
      maxWidth: '96vw',
      height: 'auto',
      maxHeight: '94vh',
      panelClass: 'scorecard-dialog-panel',
      data: {
        student: row,
        header: {
          ...this.reportHeader,
          institutionName: instName,
          subtitleOrAddress: instAddress,
          logoUrl: logoUrl
        }
      }
    });
  }

  sendStudentWhatsApp(row: MonthlyStudentPerformanceRow): void {
    const inst = this.reportHeader?.institutionName || this.authService.getInstituteName() || 'School';
    const month = this.reportHeader?.monthName || 'Month';

    let msg = `📊 *${inst} - Monthly Performance Report*\n`;
    msg += `📅 Month: *${month}*\n`;
    msg += `👤 Student: *${row.studentName}* ${row.rollNumber ? '(Roll: ' + row.rollNumber + ')' : ''}\n`;
    msg += `🏫 Class: *${row.className || ''} ${row.sectionName ? '(' + row.sectionName + ')' : ''}*\n\n`;

    msg += `📈 *Monthly Scorecard Breakdown:*\n`;
    msg += `• 📅 Attendance: *${row.attendancePercentage}%* (${row.daysPresent}/${row.totalWorkingDays} days present)\n`;
    msg += `• 📚 H.W. Discipline: *${row.hwCompletionRate}%* completed\n`;
    msg += `• 🌟 Good Manners & Conduct: *${row.behaviourAvgStars} / 5.0 ⭐*\n`;
    if (row.subjectTests.length > 0) {
      msg += `• 📝 Academic Tests Avg: *${row.testAveragePercentage}%*\n`;
    }
    msg += `• 🏆 Performance Score: *${row.overallPerformanceScore}%*\n`;
    msg += `• 🎖️ Final Grade: *${row.overallGrade}* (Class Rank: *#${row.classRank}*)\n\n`;

    if (row.teacherMonthlyRemark) {
      msg += `👨‍🏫 Teacher's Note: _"${row.teacherMonthlyRemark}"_\n\n`;
    }

    msg += `Keep encouraging your child for consistent learning and moral values! Thank you.`;

    const phone = row.parentWhatsAppPhone?.replace(/[^0-9]/g, '') || '';
    const cleanPhone = phone.length === 10 ? '91' + phone : phone;
    const waUrl = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  }

  getPercentClass(pct: number): string {
    if (pct >= 85) return 'pct-high';
    if (pct >= 60) return 'pct-mid';
    return 'pct-low';
  }

  getGradeClass(grade: string): string {
    if (grade === 'A+') return 'gr-a-plus';
    if (grade === 'A') return 'gr-a';
    if (grade === 'B+' || grade === 'B') return 'gr-b';
    return 'gr-c';
  }
}

// =============================================================================
// INDIVIDUAL STUDENT MONTHLY SCORECARD DIALOG COMPONENT
// =============================================================================
@Component({
  selector: 'app-monthly-student-scorecard-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule
  ],
  template: `
    <div class="scorecard-dialog-container">
      <!-- Light Blue Gradient Header matching strict UI rule -->
      <div class="modal-header">
        <div class="header-main-row">
          <div class="header-left">
            <div class="header-icon-box">
              <mat-icon>workspace_premium</mat-icon>
            </div>
            <div>
              <h2 class="dialog-title">Monthly Student Progress Scorecard</h2>
              <p class="dialog-sub">Comprehensive 360° Evaluation • {{ data.header?.monthName }} • {{ data.student.studentName }}</p>
            </div>
          </div>

          <div class="header-actions">
            <button mat-flat-button class="print-action-btn" (click)="printScorecard()">
              <mat-icon>print</mat-icon>
              <span>Print A4</span>
            </button>
            <button mat-icon-button class="close-btn" (click)="dialogRef.close()" matTooltip="Close dialog">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>
      </div>

      <!-- Printable A4 Portrait Paper Sheet -->
      <div class="modal-body-scroll">
        <div class="print-card-sheet" id="printableStudentScorecard">
          <!-- Top Institution Header -->
          <div class="sc-header-block">
              <div class="sc-crest-box" [class.has-img]="logoUrl && !logoFailed">
                <img *ngIf="logoUrl && !logoFailed"
                     [src]="logoUrl"
                     (error)="logoFailed = true"
                     class="sc-crest-img"
                     alt="Company Logo" />
                <mat-icon *ngIf="!logoUrl || logoFailed" class="sc-crest-icon">school</mat-icon>
              </div>
              <div class="sc-header-text">
                <h1 class="sc-inst-name">{{ getInstitutionName() }}</h1>
                <p class="sc-inst-sub">{{ data.header?.subtitleOrAddress || 'Main Road, Jnandeep Campus' }}</p>
                <div class="sc-session-badges">
                  <span class="sc-pill-meta">Affiliated &amp; Recognized</span>
                  <span class="sc-dot">•</span>
                  <span class="sc-pill-meta">Academic Session: {{ getAcademicSession() }}</span>
                  <span class="sc-dot">•</span>
                  <span class="sc-pill-meta">Continuous Comprehensive Evaluation (CCE)</span>
                </div>
              </div>
              <div class="sc-crest-box-right">
                <div class="sc-stamp-seal">
                  <span class="seal-t">ESTD</span>
                  <span class="seal-y">2018</span>
                  <span class="seal-b">VERIFIED</span>
                </div>
              </div>
            </div>

            <!-- Royal Ribbon Tag -->
            <div class="sc-ribbon-tag">
              <div class="ribbon-text">★ 360° STUDENT MONTHLY PERFORMANCE &amp; CONDUCT SCORECARD ★</div>
              <div class="ribbon-month">MONTH: {{ (data.header?.monthName || 'OCTOBER 2026') | uppercase }}</div>
            </div>

            <!-- Student Profile Box & Achievement Shield -->
            <div class="sc-profile-wrapper">
              <div class="sc-student-details">
                <div class="student-avatar" [class.has-photo]="studentPhotoUrl && !photoFailed">
                  <img *ngIf="studentPhotoUrl && !photoFailed"
                       [src]="studentPhotoUrl"
                       (error)="photoFailed = true"
                       class="student-avatar-img"
                       alt="Student Photo" />
                  <span *ngIf="!studentPhotoUrl || photoFailed">{{ (data.student.studentName || 'S').charAt(0) }}</span>
                </div>
                <div class="student-meta-grid">
                  <div class="meta-row-name">
                    <span class="st-fullname">{{ data.student.studentName }}</span>
                    <span class="roll-pill" *ngIf="data.student.rollNumber">Roll No: <strong>#{{ data.student.rollNumber }}</strong></span>
                  </div>
                  <div class="meta-specs-grid">
                    <div class="spec-item">
                      <span class="spec-label">Class &amp; Section</span>
                      <span class="spec-value">{{ data.student.className }} {{ data.student.sectionName ? '(' + data.student.sectionName + ')' : '' }}</span>
                    </div>
                    <div class="spec-item">
                      <span class="spec-label">Evaluation Month</span>
                      <span class="spec-value highlight">{{ data.header?.monthName }}</span>
                    </div>
                    <div class="spec-item">
                      <span class="spec-label">Class Teacher / Mentor</span>
                      <span class="spec-value">{{ data.header?.classTeacherName || 'Class Mentor' }}</span>
                    </div>
                    <div class="spec-item">
                      <span class="spec-label">Admission ID</span>
                      <span class="spec-value code">{{ getStudentAdmNo() }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Achievement Trophy Shield -->
              <div class="sc-achievement-shield">
                <div class="shield-badge">
                  <span class="shield-title">OVERALL GRADE</span>
                  <span class="shield-grade">{{ data.student.overallGrade }}</span>
                  <div class="shield-rank">
                    <mat-icon class="rank-trophy">military_tech</mat-icon>
                    <span>Rank #{{ data.student.classRank }} {{ data.student.classRank === 1 ? '• TOPPER' : '' }}</span>
                  </div>
                  <div class="shield-score">{{ data.student.overallPerformanceScore }}% Composite</div>
                </div>
              </div>
            </div>

            <!-- 4 Key Performance Pillars -->
            <div class="sc-pillars-section">
              <!-- Pillar 1: Attendance -->
              <div class="sc-pillar-card p-att">
                <div class="pillar-top">
                  <div class="pillar-icon p-att-icon">
                    <mat-icon>event_available</mat-icon>
                  </div>
                  <span class="pillar-title">Attendance (उपस्थिति)</span>
                </div>
                <div class="pillar-score p-att-text">{{ data.student.attendancePercentage }}%</div>
                <div class="pillar-progress-track">
                  <div class="pillar-progress-fill p-att-fill" [style.width.%]="data.student.attendancePercentage"></div>
                </div>
                <div class="pillar-meta">Present: <strong>{{ data.student.daysPresent }}</strong> / {{ data.student.totalWorkingDays }} Days</div>
              </div>

              <!-- Pillar 2: H.W. Discipline -->
              <div class="sc-pillar-card p-hw">
                <div class="pillar-top">
                  <div class="pillar-icon p-hw-icon">
                    <mat-icon>menu_book</mat-icon>
                  </div>
                  <span class="pillar-title">H.W. Consistency</span>
                </div>
                <div class="pillar-score p-hw-text">{{ data.student.hwCompletionRate }}%</div>
                <div class="pillar-progress-track">
                  <div class="pillar-progress-fill p-hw-fill" [style.width.%]="data.student.hwCompletionRate"></div>
                </div>
                <div class="pillar-meta">Completed: <strong>{{ data.student.totalHwCompleted }}</strong> / {{ data.student.totalHwAssigned }} Tasks</div>
              </div>

              <!-- Pillar 3: Good Manners & Conduct -->
              <div class="sc-pillar-card p-beh">
                <div class="pillar-top">
                  <div class="pillar-icon p-beh-icon">
                    <mat-icon>hotel_class</mat-icon>
                  </div>
                  <span class="pillar-title">Manners &amp; Conduct</span>
                </div>
                <div class="pillar-score p-beh-text">★ {{ data.student.behaviourAvgStars }} <span class="max-star">/ 5.0</span></div>
                <div class="pillar-progress-track">
                  <div class="pillar-progress-fill p-beh-fill" [style.width.%]="(data.student.behaviourAvgStars / 5) * 100"></div>
                </div>
                <div class="pillar-meta">Uniform: <strong>{{ data.student.dominantUniformStatus }}</strong></div>
              </div>

              <!-- Pillar 4: Academic Tests -->
              <div class="sc-pillar-card p-acad">
                <div class="pillar-top">
                  <div class="pillar-icon p-acad-icon">
                    <mat-icon>assessment</mat-icon>
                  </div>
                  <span class="pillar-title">Academic Score</span>
                </div>
                <div class="pillar-score p-acad-text">{{ data.student.testAveragePercentage }}%</div>
                <div class="pillar-progress-track">
                  <div class="pillar-progress-fill p-acad-fill" [style.width.%]="data.student.testAveragePercentage"></div>
                </div>
                <div class="pillar-meta">Obt: <strong>{{ data.student.totalTestMarksObtained }}</strong> / {{ data.student.totalTestMaxMarks }}</div>
              </div>
            </div>

            <!-- Academic Subject Marks Table (if present) -->
            <div class="sc-table-section" *ngIf="data.student.subjectTests && data.student.subjectTests.length > 0">
              <div class="section-badge-header">
                <mat-icon>auto_stories</mat-icon>
                <span>Academic &amp; Monthly Unit Assessments</span>
              </div>
              <div class="sc-table-responsive">
                <table class="sc-marks-table">
                  <thead>
                    <tr>
                      <th class="th-sno">#</th>
                      <th class="th-sub">Subject</th>
                      <th class="text-center">Max Marks</th>
                      <th class="text-center">Obtained Marks</th>
                      <th class="text-center">Percentage</th>
                      <th class="text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let st of data.student.subjectTests; let i = index">
                      <td class="text-center num-muted">{{ i + 1 }}</td>
                      <td><strong class="sub-name">{{ st.subjectName }}</strong></td>
                      <td class="text-center num-col">{{ st.maxMarks }}</td>
                      <td class="text-center num-col obt-col"><strong>{{ st.obtainedMarks }}</strong></td>
                      <td class="text-center">
                        <div class="table-pct-cell">
                          <span>{{ st.percentage }}%</span>
                        </div>
                      </td>
                      <td class="text-center">
                        <span class="table-grade-badge" [ngClass]="getGradeBadgeClass(st.grade)">{{ st.grade }}</span>
                      </td>
                    </tr>
                    <!-- Summary row -->
                    <tr class="sc-total-row">
                      <td colspan="2" class="text-right"><strong>Aggregate Assessment Total:</strong></td>
                      <td class="text-center"><strong>{{ data.student.totalTestMaxMarks }}</strong></td>
                      <td class="text-center text-primary"><strong>{{ data.student.totalTestMarksObtained }}</strong></td>
                      <td class="text-center"><strong>{{ data.student.testAveragePercentage }}%</strong></td>
                      <td class="text-center"><span class="table-grade-badge" [ngClass]="getGradeBadgeClass(data.student.overallGrade)">{{ data.student.overallGrade }}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Teacher Monthly Appraisal Remark Card -->
            <div class="sc-teacher-card">
              <div class="tc-header">
                <mat-icon>rate_review</mat-icon>
                <span>Class Teacher Monthly Appraisal &amp; Remarks</span>
              </div>
              <div class="tc-quote">
                <span class="quote-symbol">“</span>
                <p class="quote-text">{{ data.student.teacherMonthlyRemark || 'Consistent performance throughout the month. Shows polite behavior, active participation, and enthusiasm in daily classroom learning.' }}</p>
                <span class="quote-symbol right">”</span>
              </div>
            </div>

            <!-- Signatures & Official Seal Block -->
            <div class="sc-signatures-block">
              <div class="sig-unit">
                <div class="sig-space"></div>
                <div class="sig-line"></div>
                <span class="sig-role">Class Teacher</span>
                <span class="sig-title">Evaluator</span>
              </div>

              <div class="sig-seal-center">
                <div class="official-seal-circle">
                  <div class="seal-inner-circle">
                    <span class="seal-star">★</span>
                    <span class="seal-campus-name">{{ getShortInstituteName() }}</span>
                    <span class="seal-status">VERIFIED</span>
                    <span class="seal-star">★</span>
                  </div>
                </div>
                <span class="seal-caption">Official Stamp</span>
              </div>

              <div class="sig-unit">
                <div class="sig-space"></div>
                <div class="sig-line"></div>
                <span class="sig-role">Parent / Guardian</span>
                <span class="sig-title">Acknowledgement</span>
              </div>

              <div class="sig-unit">
                <div class="sig-space"></div>
                <div class="sig-line"></div>
                <span class="sig-role">Principal / Head</span>
                <span class="sig-title">Authorized Signatory</span>
              </div>
            </div>

            <!-- Security & Verification Micro Footer -->
            <div class="sc-bottom-footer">
              <span>This is an authentic computer-generated scorecard verified by {{ getInstitutionName() }} IMSERP Cloud.</span>
              <span>Date: {{ todayDateIst }}</span>
            </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      max-height: 100%;
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
    }

    .scorecard-dialog-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: 100%;
      flex: 1 1 auto;
      min-height: 0;
      background: #f1f5f9;
      border-radius: 14px;
      overflow: hidden;
      width: 100%;
      box-sizing: border-box;
    }

    .modal-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 8px 16px;
      flex-shrink: 0;
    }

    .header-main-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-icon-box {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: #2563eb;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 5px rgba(37,99,235,0.25);
    }

    .dialog-title {
      font-size: 15px;
      font-weight: 700;
      color: #1e3a8a;
      margin: 0;
      letter-spacing: -0.2px;
    }

    .dialog-sub {
      font-size: 10.5px;
      color: #3b82f6;
      margin: 1px 0 0;
      font-weight: 500;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .print-action-btn {
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%) !important;
      color: #ffffff !important;
      height: 32px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 12px;
      box-shadow: 0 2px 5px rgba(37,99,235,0.2);
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 0 12px !important;
    }

    .close-btn {
      color: #64748b !important;
      width: 32px !important;
      height: 32px !important;
      min-width: 32px !important;
      max-width: 32px !important;
      padding: 0 !important;
      margin: 0 !important;
      border: none !important;
      border-radius: 50% !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      position: relative !important;
      box-sizing: border-box !important;
      cursor: pointer !important;
      line-height: 1 !important;
      transition: all 0.15s ease !important;
      --mdc-icon-button-state-layer-size: 32px !important;
      --mdc-icon-button-icon-size: 20px !important;

      mat-icon {
        font-size: 20px !important;
        width: 20px !important;
        height: 20px !important;
        line-height: 20px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      ::ng-deep .mat-mdc-button-touch-target {
        display: none !important;
      }

      ::ng-deep .mat-mdc-button-persistent-ripple,
      ::ng-deep .mdc-icon-button__ripple,
      ::ng-deep .mat-ripple,
      ::ng-deep .mat-mdc-focus-indicator {
        border-radius: 50% !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }

      &:hover {
        color: #1e293b !important;
        background: rgba(30, 41, 59, 0.08) !important;
        border-radius: 50% !important;
      }
    }

    .modal-body-scroll {
      flex: 1 1 auto;
      min-height: 0;
      height: 100%;
      overflow-y: auto !important;
      overflow-x: hidden;
      padding: 8px 12px 36px;
      display: flex;
      justify-content: center;
      background: #f1f5f9;
      width: 100%;
      box-sizing: border-box;
      -webkit-overflow-scrolling: touch;
    }

    .print-card-sheet {
      width: 100%;
      max-width: 100%;
      background: #ffffff;
      border: 2px solid #1e3a8a;
      outline: 1.5px solid #93c5fd;
      outline-offset: -4px;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
      padding: 10px 16px;
      box-sizing: border-box;
      overflow: visible;
    }

    /* School Crest Header */
    .sc-header-block {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding-bottom: 6px;
      border-bottom: 1.5px solid #e2e8f0;
    }

    .sc-crest-box {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      padding: 0 !important;
      box-sizing: border-box;
    }

    .sc-crest-box:not(.has-img) {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%) !important;
      color: #ffffff;
      box-shadow: 0 2px 5px rgba(37, 99, 235, 0.2) !important;
    }

    .sc-crest-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: transparent !important;
      display: block;
    }

    .sc-crest-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: #ffffff;
    }

    .sc-header-text {
      text-align: center;
      flex: 1;
    }

    .sc-inst-name {
      font-size: 18px;
      font-weight: 900;
      color: #1e3a8a;
      letter-spacing: 0.5px;
      margin: 0;
      text-transform: uppercase;
    }

    .sc-inst-sub {
      font-size: 10px;
      color: #475569;
      margin: 1px 0;
      font-weight: 500;
    }

    .sc-session-badges {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      font-size: 9px;
      color: #2563eb;
      font-weight: 600;
    }

    .sc-dot { color: #94a3b8; }

    .sc-crest-box-right {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .sc-stamp-seal {
      width: 40px;
      height: 40px;
      border: 1.5px dashed #1e3a8a;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
      color: #1e3a8a;
      line-height: 1.1;
    }

    .seal-t { font-size: 7px; font-weight: 800; }
    .seal-y { font-size: 9.5px; font-weight: 900; }
    .seal-b { font-size: 5px; font-weight: 800; letter-spacing: 0.5px; }

    /* Royal Ribbon Tag */
    .sc-ribbon-tag {
      background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
      color: #ffffff;
      border-radius: 4px;
      padding: 3.5px 10px;
      margin: 5px 0 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 4px rgba(30, 58, 138, 0.15);
    }

    .ribbon-text {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #fef08a;
    }

    .ribbon-month {
      font-size: 9px;
      font-weight: 700;
      background: rgba(255, 255, 255, 0.18);
      padding: 1px 6px;
      border-radius: 3px;
      color: #ffffff;
    }

    /* Student Profile Strip & Trophy */
    .sc-profile-wrapper {
      display: flex;
      align-items: stretch;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 6px;
    }

    .sc-student-details {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 5px 10px;
    }

    .student-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #1e3a8a;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      font-weight: 800;
      flex-shrink: 0;
      box-shadow: 0 2px 4px rgba(30, 58, 138, 0.18);
      overflow: hidden;
      border: 1.5px solid #bfdbfe;
      box-sizing: border-box;
    }

    .student-avatar.has-photo {
      background: transparent;
      border: 1.5px solid #2563eb;
    }

    .student-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      border-radius: 50%;
    }

    .student-meta-grid {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .meta-row-name {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .st-fullname {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
    }

    .roll-pill {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      padding: 1px 6px;
      border-radius: 8px;
      font-size: 10px;
    }

    .meta-specs-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 2px 12px;
      font-size: 10px;
    }

    .spec-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .spec-label {
      color: #64748b;
      font-size: 10px;
    }

    .spec-value {
      font-weight: 700;
      color: #1e293b;
    }

    .spec-value.highlight {
      color: #2563eb;
    }

    .spec-value.code {
      font-family: monospace;
      color: #475569;
    }

    /* Achievement Trophy Shield */
    .sc-achievement-shield {
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      color: #ffffff;
      border-radius: 6px;
      padding: 5px 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 110px;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.18);
    }

    .shield-badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .shield-title {
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #bfdbfe;
    }

    .shield-grade {
      font-size: 19px;
      font-weight: 900;
      line-height: 1.1;
      margin: 1px 0;
      color: #ffffff;
      text-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }

    .shield-rank {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      background: #fef3c7;
      color: #b45309;
      font-size: 9px;
      font-weight: 800;
      padding: 1px 4px;
      border-radius: 3px;
      margin: 1px 0;
    }

    .rank-trophy {
      font-size: 12px;
      width: 12px;
      height: 12px;
      color: #d97706;
    }

    .shield-score {
      font-size: 9px;
      font-weight: 600;
      color: #dbeafe;
    }

    /* 4 Pillars Grid */
    .sc-pillars-section {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-bottom: 6px;
    }

    .sc-pillar-card {
      border-radius: 6px;
      padding: 4px 6px;
      border: 1px solid #cbd5e1;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .pillar-top {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .pillar-icon {
      width: 18px;
      height: 18px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      flex-shrink: 0;
    }

    .pillar-icon mat-icon {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }

    .pillar-title {
      font-size: 9px;
      font-weight: 700;
      color: #334155;
      white-space: nowrap;
    }

    .pillar-score {
      font-size: 15px;
      font-weight: 800;
      margin: 1px 0 0;
      line-height: 1.1;
    }

    .max-star {
      font-size: 9.5px;
      font-weight: 600;
      color: #64748b;
    }

    .pillar-progress-track {
      height: 3px;
      background: rgba(0, 0, 0, 0.08);
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 2px;
    }

    .pillar-progress-fill {
      height: 100%;
      border-radius: 2px;
      transition: width 0.3s ease;
    }

    .pillar-meta {
      font-size: 8px;
      color: #64748b;
      white-space: nowrap;
    }

    /* Pillar color themes */
    .p-att { background: #f0fdf4; border-color: #86efac; }
    .p-att-icon { background: #16a34a; }
    .p-att-text { color: #15803d; }
    .p-att-fill { background: #16a34a; }

    .p-hw { background: #f0f9ff; border-color: #7dd3fc; }
    .p-hw-icon { background: #0284c7; }
    .p-hw-text { color: #0369a1; }
    .p-hw-fill { background: #0284c7; }

    .p-beh { background: #fffbeb; border-color: #fde68a; }
    .p-beh-icon { background: #d97706; }
    .p-beh-text { color: #b45309; }
    .p-beh-fill { background: #d97706; }

    .p-acad { background: #faf5ff; border-color: #d8b4fe; }
    .p-acad-icon { background: #7c3aed; }
    .p-acad-text { color: #6d28d9; }
    .p-acad-fill { background: #7c3aed; }

    /* Academic Marks Table */
    .sc-table-section {
      margin-bottom: 6px;
      width: 100%;
      box-sizing: border-box;
    }

    .section-badge-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10.5px;
      font-weight: 700;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 5px;
      line-height: 1;
    }

    .section-badge-header mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #1e3a8a;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      line-height: 1;
      vertical-align: middle;
    }

    .section-badge-header span {
      display: inline-flex;
      align-items: center;
      line-height: 1;
    }

    .sc-table-responsive {
      width: 100%;
      max-width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
    }

    .sc-marks-table {
      width: 100%;
      min-width: 440px;
      border-collapse: collapse;
      font-size: 10px;
    }

    .sc-marks-table th, .sc-marks-table td {
      border: 1px solid #e2e8f0;
      padding: 3px 6px;
    }

    .sc-marks-table th {
      background: #1e3a8a;
      color: #ffffff;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 9px;
      letter-spacing: 0.4px;
    }

    .th-sno { width: 28px; text-align: center; }
    .th-sub { text-align: left; }

    .sub-name {
      color: #0f172a;
      font-size: 10px;
    }

    .num-col { font-weight: 600; color: #334155; }
    .obt-col { color: #0f172a; font-weight: 700; }
    .num-muted { color: #94a3b8; font-size: 9px; }

    .table-pct-cell {
      font-weight: 700;
      color: #1e293b;
    }

    .table-grade-badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 9px;
    }

    .sc-gr-aplus { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .sc-gr-a { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .sc-gr-b { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .sc-gr-c { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }

    .sc-total-row {
      background: #f8fafc;
      font-weight: 700;
      border-top: 1.5px solid #cbd5e1;
    }

    .text-center { text-align: center !important; }
    .text-right { text-align: right !important; }
    .text-primary { color: #1e3a8a !important; }

    /* Teacher Appraisal Card */
    .sc-teacher-card {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-left: 3px solid #2563eb;
      border-radius: 5px;
      padding: 4px 8px;
      margin-bottom: 6px;
    }

    .tc-header {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 9px;
      font-weight: 700;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 2px;
    }

    .tc-header mat-icon {
      font-size: 11px;
      width: 11px;
      height: 11px;
      color: #2563eb;
    }

    .tc-quote {
      position: relative;
      padding: 0 10px;
    }

    .quote-symbol {
      position: absolute;
      top: -6px;
      left: 0;
      font-size: 16px;
      color: #94a3b8;
      font-family: Georgia, serif;
      line-height: 1;
    }

    .quote-symbol.right {
      left: auto;
      right: 0;
      top: auto;
      bottom: -6px;
    }

    .quote-text {
      margin: 0;
      font-size: 10px;
      font-style: italic;
      color: #334155;
      line-height: 1.3;
    }

    /* Signatures Block */
    .sc-signatures-block {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      margin-top: 5px;
      padding: 0 6px;
    }

    .sig-unit {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 95px;
    }

    .sig-space {
      height: 12px;
    }

    .sig-line {
      width: 100px;
      border-top: 1px solid #0f172a;
      margin-bottom: 2px;
    }

    .sig-role {
      font-size: 9px;
      font-weight: 700;
      color: #0f172a;
    }

    .sig-title {
      font-size: 8px;
      color: #64748b;
    }

    .sig-seal-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
    }

    .official-seal-circle {
      width: 44px;
      height: 44px;
      border: 1.5px dashed #1e3a8a;
      border-radius: 50%;
      padding: 1.5px;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
    }

    .seal-inner-circle {
      width: 100%;
      height: 100%;
      border: 1px solid #2563eb;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      line-height: 1.1;
      padding: 1px;
      box-sizing: border-box;
    }

    .seal-star {
      font-size: 6px;
      color: #d97706;
    }

    .seal-campus-name {
      font-size: 6px;
      font-weight: 800;
      color: #1e3a8a;
      text-transform: uppercase;
      max-width: 40px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .seal-status {
      font-size: 5px;
      font-weight: 800;
      color: #15803d;
      letter-spacing: 0.5px;
    }

    .seal-caption {
      font-size: 7px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
    }

    /* Micro Footer */
    .sc-bottom-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 5px;
      padding-top: 3px;
      border-top: 1px dashed #cbd5e1;
      font-size: 8px;
      color: #94a3b8;
    }

    /* =========================================================================
       RESPONSIVE SCORECARD MODAL (Tablet <= 860px & Mobile <= 600px)
       ========================================================================= */
    @media (max-width: 860px) {
      .modal-body-scroll {
        padding: 8px 10px;
      }
      .print-card-sheet {
        padding: 10px 14px;
      }
      .sc-pillars-section {
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }
      .sc-profile-wrapper {
        flex-direction: column;
        gap: 10px;
      }
      .sc-achievement-shield {
        width: 100%;
        min-width: 100%;
        box-sizing: border-box;
      }
      .sc-signatures-block {
        flex-wrap: wrap;
        gap: 16px;
        justify-content: center;
      }
    }

    @media (max-width: 600px) {
      .scorecard-dialog-container {
        height: 100vh;
        max-height: 100vh;
        border-radius: 0;
      }
      .modal-header {
        padding: 10px 14px;
      }
      .dialog-title {
        font-size: 15px;
      }
      .dialog-sub {
        font-size: 10px;
      }
      .print-action-btn span {
        display: none;
      }
      .modal-body-scroll {
        padding: 6px;
      }
      .print-card-sheet {
        padding: 8px 10px;
        border-radius: 6px;
        outline-offset: -3px;
      }
      .sc-header-block {
        flex-direction: column;
        gap: 8px;
        text-align: center;
      }
      .sc-crest-box-right {
        display: none;
      }
      .sc-inst-name {
        font-size: 16px;
      }
      .sc-inst-sub {
        font-size: 10px;
      }
      .sc-session-badges {
        flex-wrap: wrap;
        font-size: 9px;
      }
      .sc-ribbon-tag {
        flex-direction: column;
        gap: 4px;
        text-align: center;
      }
      .sc-student-details {
        flex-direction: column;
        align-items: flex-start;
      }
      .meta-specs-grid {
        grid-template-columns: 1fr;
      }
      .sc-pillars-section {
        grid-template-columns: 1fr;
      }
      .sig-unit {
        width: 100%;
      }
      .sig-line {
        width: 140px;
      }
      .sc-bottom-footer {
        flex-direction: column;
        gap: 4px;
        text-align: center;
      }
    }

    @media print {
      body * {
        visibility: hidden;
      }
      #printableStudentScorecard, #printableStudentScorecard * {
        visibility: visible;
      }
      #printableStudentScorecard {
        position: absolute;
        left: 0;
        top: 0;
        width: 100% !important;
        border: none !important;
        box-shadow: none !important;
      }
      @page {
        size: A4 portrait;
        margin: 8mm;
      }
    }
  `]
})
export class MonthlyStudentScorecardDialogComponent {
  public authService = inject(AuthService);
  logoFailed = false;
  photoFailed = false;

  get logoUrl(): string | null {
    const raw = this.data?.header?.logoUrl;
    if (raw && typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
    return this.authService.getInstituteLogoUrl();
  }

  get studentPhotoUrl(): string | null {
    const s = this.data?.student;
    const raw = s?.profilePhoto || s?.ProfilePhoto || s?.photoUrl || s?.PhotoUrl || s?.photo || s?.avatarUrl;
    if (!raw || typeof raw !== 'string' || raw.trim().length === 0) return null;
    const clean = raw.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:')) return clean;
    return `${environment.apiBaseUrl}${clean.startsWith('/') ? '' : '/'}${clean}`;
  }

  constructor(
    public dialogRef: MatDialogRef<MonthlyStudentScorecardDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  getInstitutionName(): string {
    const raw = this.data.header?.institutionName;
    if (raw && raw.trim().length > 0) return raw.trim();
    return this.authService.getInstituteName() || 'School / College Institution';
  }

  getShortInstituteName(): string {
    const name = this.getInstitutionName();
    return name.length > 14 ? name.substring(0, 12) + '..' : name;
  }

  getAcademicSession(): string {
    const y = this.data.header?.year || 2026;
    return `${y}-${y + 1}`;
  }

  getStudentAdmNo(): string {
    if (this.data.student?.studentId) {
      return this.data.student.studentId.substring(0, 8).toUpperCase();
    }
    return 'STU-1026';
  }

  get todayDateIst(): string {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date());
  }

  getGradeBadgeClass(grade: string): string {
    if (!grade) return 'sc-gr-b';
    if (grade.startsWith('A+')) return 'sc-gr-aplus';
    if (grade.startsWith('A')) return 'sc-gr-a';
    if (grade.startsWith('B')) return 'sc-gr-b';
    return 'sc-gr-c';
  }

  printScorecard(): void {
    const el = document.getElementById('printableStudentScorecard');
    if (!el) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=950,height=900');
    if (!printWindow) {
      window.print();
      return;
    }

    const stName = this.data.student?.studentName || '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Student Monthly Scorecard - ${stName}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              background: #ffffff;
              color: #0f172a;
              padding: 6mm;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              font-size: 11px;
            }
            .print-card-sheet {
              width: 100%;
              background: #ffffff;
              border: 2px solid #1e3a8a;
              outline: 1.5px solid #93c5fd;
              outline-offset: -5px;
              border-radius: 8px;
              padding: 14px 18px;
              box-sizing: border-box;
            }
            .sc-header-block {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding-bottom: 10px;
              border-bottom: 1.5px solid #e2e8f0;
            }
            .sc-crest-box {
              width: 44px;
              height: 44px;
              background: transparent !important;
              border: none !important;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 0 !important;
            }
            .sc-crest-box:not(.has-img) {
              background: #1e3a8a !important;
              color: #ffffff;
              border-radius: 6px;
            }
            .sc-crest-img {
              width: 100%;
              height: 100%;
              object-fit: contain;
              background: transparent !important;
              display: block;
            }
            .sc-header-text { text-align: center; flex: 1; }
            .sc-inst-name { font-size: 20px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; margin: 0; letter-spacing: 0.5px; }
            .sc-inst-sub { font-size: 10px; color: #475569; margin: 2px 0 3px; font-weight: 500; }
            .sc-session-badges { font-size: 9px; color: #2563eb; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 4px; }
            .sc-crest-box-right { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
            .sc-stamp-seal { width: 42px; height: 42px; border: 1.5px dashed #1e3a8a; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; color: #1e3a8a; line-height: 1.1; }
            .seal-t { font-size: 7px; font-weight: 800; }
            .seal-y { font-size: 10px; font-weight: 900; }
            .seal-b { font-size: 6px; font-weight: 800; }
            .sc-ribbon-tag { background: #1e3a8a; color: #ffffff; border-radius: 6px; padding: 5px 12px; margin: 8px 0 10px; display: flex; justify-content: space-between; align-items: center; }
            .ribbon-text { font-size: 10px; font-weight: 800; color: #fef08a; letter-spacing: 0.5px; }
            .ribbon-month { font-size: 9px; font-weight: 700; background: rgba(255,255,255,0.2); padding: 1px 6px; border-radius: 3px; }
            .sc-profile-wrapper { display: flex; align-items: stretch; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
            .sc-student-details { flex: 1; display: flex; align-items: center; gap: 10px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; }
            .student-avatar { width: 38px; height: 38px; border-radius: 50%; background: #1e3a8a; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 800; overflow: hidden; border: 1px solid #bfdbfe; }
            .student-avatar.has-photo { background: transparent; border: 1px solid #1e3a8a; }
            .student-avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 50%; }
            .student-meta-grid { flex: 1; display: flex; flex-direction: column; gap: 4px; }
            .meta-row-name { display: flex; align-items: center; gap: 8px; }
            .st-fullname { font-size: 14px; font-weight: 800; color: #0f172a; }
            .roll-pill { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 1px 6px; border-radius: 10px; font-size: 10px; }
            .meta-specs-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2px 12px; font-size: 10px; }
            .spec-label { color: #64748b; }
            .spec-value { font-weight: 700; color: #1e293b; }
            .spec-value.highlight { color: #2563eb; }
            .spec-value.code { font-family: monospace; }
            .sc-achievement-shield { background: #1e3a8a; color: #ffffff; border-radius: 6px; padding: 6px 12px; display: flex; align-items: center; justify-content: center; min-width: 120px; }
            .shield-badge { display: flex; flex-direction: column; align-items: center; text-align: center; }
            .shield-title { font-size: 8px; font-weight: 800; color: #bfdbfe; }
            .shield-grade { font-size: 22px; font-weight: 900; line-height: 1.1; margin: 1px 0; }
            .shield-rank { display: inline-flex; align-items: center; background: #fef3c7; color: #b45309; font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 3px; }
            .shield-score { font-size: 9px; color: #dbeafe; font-weight: 600; }
            .sc-pillars-section { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
            .sc-pillar-card { border-radius: 6px; padding: 6px 8px; border: 1px solid #cbd5e1; }
            .pillar-top { display: flex; align-items: center; gap: 4px; }
            .pillar-icon { width: 18px; height: 18px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 10px; }
            .pillar-title { font-size: 9px; font-weight: 700; color: #334155; }
            .pillar-score { font-size: 16px; font-weight: 800; margin: 3px 0 1px; }
            .max-star { font-size: 10px; color: #64748b; font-weight: 600; }
            .pillar-progress-track { height: 3px; background: rgba(0,0,0,0.08); border-radius: 2px; overflow: hidden; margin-bottom: 3px; }
            .pillar-progress-fill { height: 100%; border-radius: 2px; }
            .pillar-meta { font-size: 8.5px; color: #64748b; }
            .p-att { background: #f0fdf4; border-color: #86efac; }
            .p-att-icon { background: #16a34a; }
            .p-att-text { color: #15803d; }
            .p-att-fill { background: #16a34a; }
            .p-hw { background: #f0f9ff; border-color: #7dd3fc; }
            .p-hw-icon { background: #0284c7; }
            .p-hw-text { color: #0369a1; }
            .p-hw-fill { background: #0284c7; }
            .p-beh { background: #fffbeb; border-color: #fde68a; }
            .p-beh-icon { background: #d97706; }
            .p-beh-text { color: #b45309; }
            .p-beh-fill { background: #d97706; }
            .p-acad { background: #faf5ff; border-color: #d8b4fe; }
            .p-acad-icon { background: #7c3aed; }
            .p-acad-text { color: #6d28d9; }
            .p-acad-fill { background: #7c3aed; }
            .sc-table-section { margin-bottom: 8px; }
            .section-badge-header { font-size: 10px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; margin-bottom: 4px; display: flex; align-items: center; gap: 4px; }
            .sc-marks-table { width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #cbd5e1; }
            .sc-marks-table th, .sc-marks-table td { border: 1px solid #e2e8f0; padding: 4px 6px; }
            .sc-marks-table th { background: #1e3a8a; color: #ffffff; font-weight: 700; text-transform: uppercase; font-size: 9px; }
            .th-sno { width: 28px; text-align: center; }
            .th-sub { text-align: left; }
            .sub-name { color: #0f172a; }
            .table-grade-badge { padding: 1px 6px; border-radius: 8px; font-weight: 800; font-size: 9px; }
            .sc-gr-aplus { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
            .sc-gr-a { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
            .sc-gr-b { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
            .sc-gr-c { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
            .sc-total-row { background: #f8fafc; font-weight: 700; border-top: 1.5px solid #cbd5e1; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .sc-teacher-card { background: #f8fafc; border: 1px solid #cbd5e1; border-left: 3px solid #2563eb; border-radius: 5px; padding: 6px 10px; margin-bottom: 10px; }
            .tc-header { font-size: 9px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; margin-bottom: 2px; }
            .quote-text { margin: 0; font-size: 10px; font-style: italic; color: #334155; }
            .sc-signatures-block { display: flex; align-items: flex-end; justify-content: space-between; margin-top: 16px; padding: 0 8px; }
            .sig-unit { display: flex; flex-direction: column; align-items: center; min-width: 100px; }
            .sig-space { height: 26px; }
            .sig-line { width: 110px; border-top: 1px solid #0f172a; margin-bottom: 3px; }
            .sig-role { font-size: 9px; font-weight: 700; color: #0f172a; }
            .sig-title { font-size: 8px; color: #64748b; }
            .sig-seal-center { display: flex; flex-direction: column; align-items: center; gap: 2px; }
            .official-seal-circle { width: 50px; height: 50px; border: 1.5px dashed #1e3a8a; border-radius: 50%; padding: 2px; display: flex; align-items: center; justify-content: center; background: #f8fafc; }
            .seal-inner-circle { width: 100%; height: 100%; border: 1px solid #2563eb; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; line-height: 1.1; }
            .seal-star { font-size: 6px; color: #d97706; }
            .seal-campus-name { font-size: 6.5px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; }
            .seal-status { font-size: 5.5px; font-weight: 800; color: #15803d; }
            .seal-caption { font-size: 7.5px; font-weight: 600; color: #64748b; text-transform: uppercase; }
            .sc-bottom-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 4px; border-top: 1px dashed #cbd5e1; font-size: 8px; color: #94a3b8; }
            mat-icon { display: none !important; }
            @page { size: A4 portrait; margin: 6mm 8mm; }
          </style>
        </head>
        <body>
          ${el.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 350);
  }
}
