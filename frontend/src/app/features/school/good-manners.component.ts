import { Component, OnInit, inject, Inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';
import { environment } from '../../../environments/environment';

const API_BASE = environment.apiUrl;

export interface DailyStudentBehaviourRow {
  studentId: string;
  studentName: string;
  rollNumber: string;
  admissionNumber?: string;
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  isAbsent: boolean;
  uniformCleanliness: string;
  disciplineConduct: string;
  politenessRespect: string;
  booksAndDiary: string;
  starRating: number;
  badges: string[];
  remarks?: string;
  recordId?: string;
  attendanceStatus: string;
  parentWhatsAppPhone?: string;
}

export interface DailyBehaviourReportHeader {
  institutionName: string;
  subtitleOrAddress: string;
  reportTitle: string;
  recordDate: string;
  className?: string;
  sectionName?: string;
  rows: DailyStudentBehaviourRow[];
  classTeacherName?: string;
  totalStudents: number;
  presentStudents: number;
  fiveStarStudents: number;
  attentionNeededCount: number;
}

@Component({
  selector: 'app-good-manners',
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
    MatChipsModule,
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
            <mat-icon>hotel_class</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Daily Good Manners &amp; Behaviour Diary</h1>
            <p class="page-subtitle">
              Record daily conduct, etiquette, uniform hygiene, star ratings &amp; print parent reports
            </p>
          </div>
        </div>

        <div class="header-actions">
          <!-- 3-Way Feature Navigation Switcher -->
          <div class="module-nav-pills notranslate" translate="no">
            <a mat-button routerLink="/school/homework" class="nav-pill-btn">
              <mat-icon>menu_book</mat-icon>
              <span>1. CW &amp; HW Diary</span>
            </a>
            <a mat-button routerLink="/school/good-manners" class="nav-pill-btn active">
              <mat-icon>hotel_class</mat-icon>
              <span>2. Good Manners &amp; Behaviour</span>
            </a>
            <a mat-button routerLink="/school/monthly-performance" class="nav-pill-btn">
              <mat-icon>insights</mat-icon>
              <span>3. Monthly Performance</span>
            </a>
          </div>

          <button mat-stroked-button class="refresh-btn" (click)="loadBehaviourList()" [disabled]="loading">
            <mat-icon [class.spin]="loading">refresh</mat-icon>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <!-- Reactive Filter & Actions Deck -->
      <mat-card class="filter-card">
        <form [formGroup]="filterForm" class="filter-form-row">
          <mat-form-field appearance="outline" class="filter-control date-control" subscriptSizing="dynamic">
            <mat-label>Record Date (तारीख)</mat-label>
            <input matInput type="date" formControlName="date" (change)="loadBehaviourList()">
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-control class-control" subscriptSizing="dynamic">
            <mat-label>Select Class (कक्षा) *</mat-label>
            <mat-select formControlName="classId" (selectionChange)="onClassChange()">
              <mat-option *ngFor="let c of classes" [value]="c.id">
                {{c.name}}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-control section-control" *ngIf="sections.length > 0" subscriptSizing="dynamic">
            <mat-label>Section (वर्ग)</mat-label>
            <mat-select formControlName="sectionId" (selectionChange)="loadBehaviourList()">
              <mat-option value="">All Sections</mat-option>
              <mat-option *ngFor="let s of sections" [value]="s.id">{{s.name}}</mat-option>
            </mat-select>
          </mat-form-field>

          <div class="deck-actions-group">
            <button mat-stroked-button class="quick-all-good-btn" type="button" (click)="setAllGoodManners()" [disabled]="students.length === 0">
              <mat-icon>done_all</mat-icon>
              <span>1-Click All 5-Star ⭐</span>
            </button>

            <button mat-stroked-button class="print-report-btn" type="button" (click)="openReportDialog()" [disabled]="students.length === 0">
              <mat-icon>print</mat-icon>
              <span>Print / WhatsApp Report</span>
            </button>

            <button mat-raised-button class="save-btn" type="button" (click)="saveDailyBehaviour()" [disabled]="saving || students.length === 0">
              <mat-icon *ngIf="!saving">save</mat-icon>
              <mat-icon *ngIf="saving" class="spin">sync</mat-icon>
              <span>{{ saving ? 'Saving...' : 'Save Manners Sheet' }}</span>
            </button>
          </div>
        </form>
      </mat-card>

      <!-- Loading Bar -->
      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

      <!-- Summary KPI Bar -->
      <div class="summary-kpis" *ngIf="students.length > 0">
        <div class="kpi-pill kpi-total">
          <mat-icon>groups</mat-icon>
          <span>Total: <strong>{{ students.length }}</strong></span>
        </div>
        <div class="kpi-pill kpi-present">
          <mat-icon>check_circle</mat-icon>
          <span>Present: <strong>{{ presentCount }}</strong></span>
        </div>
        <div class="kpi-pill kpi-stars">
          <mat-icon>star</mat-icon>
          <span>5-Star Students: <strong>{{ fiveStarCount }}</strong></span>
        </div>
        <div class="kpi-pill kpi-attention" *ngIf="attentionCount > 0">
          <mat-icon>warning</mat-icon>
          <span>Needs Attention: <strong>{{ attentionCount }}</strong></span>
        </div>
      </div>

      <!-- Empty State -->
      <div class="empty-state-card" *ngIf="!loading && students.length === 0 && filterForm.get('classId')?.value">
        <mat-icon class="empty-icon">person_search</mat-icon>
        <h3>No Students Found</h3>
        <p>No active students enrolled in the selected class and section.</p>
      </div>

      <!-- Main Student Manners Entry Table / Card Grid -->
      <div class="table-container" *ngIf="students.length > 0">
        <table class="manners-table">
          <thead>
            <tr>
              <th class="th-sno">#</th>
              <th class="th-student">Student Details</th>
              <th class="th-uniform">Cleanliness &amp; Uniform</th>
              <th class="th-discipline">Discipline &amp; Conduct</th>
              <th class="th-politeness">Manners &amp; Respect</th>
              <th class="th-books">Diary &amp; Books</th>
              <th class="th-stars">Stars (1-5)</th>
              <th class="th-remarks">Teacher Remarks</th>
              <th class="th-action text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of students; let i = index" [class.absent-row]="s.isAbsent">
              <td class="col-sno">{{ i + 1 }}</td>

              <!-- Student Profile Column -->
              <td class="col-student">
                <div class="student-name-box">
                  <span class="st-name">{{ s.studentName }}</span>
                  <span class="st-roll" *ngIf="s.rollNumber">Roll: {{ s.rollNumber }}</span>
                </div>
                <div class="st-meta-row">
                  <span class="att-badge" [ngClass]="'att-' + s.attendanceStatus.toLowerCase()">
                    {{ s.attendanceStatus }}
                  </span>
                  <span class="phone-tag" *ngIf="s.parentWhatsAppPhone">
                    📱 {{ s.parentWhatsAppPhone }}
                  </span>
                </div>
              </td>

              <!-- Absent student row spanned -->
              <ng-container *ngIf="s.isAbsent">
                <td colspan="7" class="col-absent-notice">
                  <div class="absent-alert-box">
                    <mat-icon>event_busy</mat-icon>
                    <span>Student marked <strong>Absent / On Leave</strong> today in daily attendance. Good manners evaluation skipped.</span>
                  </div>
                </td>
              </ng-container>

              <!-- Present Student Interactive Form Cells -->
              <ng-container *ngIf="!s.isAbsent">
                <!-- Uniform & Cleanliness -->
                <td class="col-select">
                  <select class="custom-status-select" [(ngModel)]="s.uniformCleanliness" [ngClass]="getUniformClass(s.uniformCleanliness)">
                    <option value="NeatAndClean">🧼 Neat &amp; Clean</option>
                    <option value="IncompleteUniform">👔 Incomplete Uniform</option>
                    <option value="NailsHaircutIssue">✂️ Nails / Haircut</option>
                    <option value="ShoesUnpolished">👞 Shoes Unpolished</option>
                    <option value="DirtyClothes">⚠️ Untidy Dress</option>
                  </select>
                </td>

                <!-- Discipline & Conduct -->
                <td class="col-select">
                  <select class="custom-status-select" [(ngModel)]="s.disciplineConduct" [ngClass]="getDisciplineClass(s.disciplineConduct)">
                    <option value="Disciplined">🧘 Well Behaved</option>
                    <option value="AttentiveActive">🌟 Attentive &amp; Active</option>
                    <option value="Talkative">💬 Talkative in Class</option>
                    <option value="Restless">🏃 Restless / Fidgety</option>
                    <option value="Aggressive">⚠️ Disruptive / Quarrel</option>
                  </select>
                </td>

                <!-- Politeness & Respect -->
                <td class="col-select">
                  <select class="custom-status-select" [(ngModel)]="s.politenessRespect" [ngClass]="getPolitenessClass(s.politenessRespect)">
                    <option value="PoliteAndRespectful">🙏 Polite &amp; Respectful</option>
                    <option value="FriendlyHelpful">🤝 Helping Others</option>
                    <option value="UsesRudeWords">⚠️ Rude / Harsh Words</option>
                    <option value="Disobedient">⚠️ Disobedient</option>
                  </select>
                </td>

                <!-- Diary & Books -->
                <td class="col-select">
                  <select class="custom-status-select" [(ngModel)]="s.booksAndDiary" [ngClass]="getBooksClass(s.booksAndDiary)">
                    <option value="BroughtAll">🎒 Brought All Books</option>
                    <option value="ForgotDiary">📖 Forgot Diary</option>
                    <option value="ForgotBooks">📚 Missing Books</option>
                    <option value="IncompleteKit">✏️ Missing Stationery</option>
                  </select>
                </td>

                <!-- Star Rating -->
                <td class="col-stars">
                  <div class="stars-picker" [matTooltip]="'Click to change rating: ' + s.starRating + ' Stars'">
                    <span *ngFor="let star of [1,2,3,4,5]" 
                          class="star-icon" 
                          [class.filled]="star <= s.starRating" 
                          (click)="s.starRating = star">
                      ★
                    </span>
                  </div>
                </td>

                <!-- Remarks -->
                <td class="col-remarks">
                  <input type="text" class="remark-input" [(ngModel)]="s.remarks" placeholder="Optional teacher note...">
                </td>

                <!-- Actions 3-dots -->
                <td class="col-action text-center">
                  <button mat-icon-button [matMenuTriggerFor]="mannersRowMenu" class="row-3dots-btn" matTooltip="More Actions">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #mannersRowMenu="matMenu" class="smart-action-menu">
                    <button mat-menu-item (click)="sendIndividualStudentWhatsApp(s)">
                      <mat-icon class="menu-icon-green">chat</mat-icon>
                      <span>Send WhatsApp to Parent</span>
                    </button>
                    <button mat-menu-item (click)="quickSetFiveStar(s)">
                      <mat-icon class="menu-icon-gold">star</mat-icon>
                      <span>Set 5-Star &amp; Well Behaved</span>
                    </button>
                    <button mat-menu-item (click)="quickSetNeedsAttention(s)">
                      <mat-icon class="menu-icon-red">warning</mat-icon>
                      <span>Mark Needs Attention</span>
                    </button>
                  </mat-menu>
                </td>
              </ng-container>
            </tr>
          </tbody>
        </table>
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

    /* Page Header */
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
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
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

    /* Navigation Pills between 3 Reports */
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
      color: #1e40af;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      border: 1px solid #bfdbfe;
    }

    .refresh-btn {
      height: 40px;
      border-color: #cbd5e1;
      color: #334155;
    }

    /* Filter Card */
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
      flex: 1 1 180px;
      min-width: 160px;
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

    .quick-all-good-btn {
      color: #166534;
      border-color: #bbf7d0;
      background: #f0fdf4;
      height: 48px;
      display: inline-flex;
      align-items: center;
      font-weight: 600;
      border-radius: 8px;
    }

    .print-report-btn {
      color: #1e40af;
      border-color: #bfdbfe;
      background: #eff6ff;
      height: 48px;
      display: inline-flex;
      align-items: center;
      font-weight: 600;
      border-radius: 8px;
    }

    .save-btn {
      background: #2563eb !important;
      color: #ffffff !important;
      height: 48px;
      display: inline-flex;
      align-items: center;
      font-weight: 600;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);
    }

    /* Summary KPIs */
    .summary-kpis {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .kpi-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
    }

    .kpi-pill mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .kpi-total { color: #334155; }
    .kpi-present { color: #166534; background: #f0fdf4; border-color: #bbf7d0; }
    .kpi-stars { color: #b45309; background: #fefce8; border-color: #fef08a; }
    .kpi-attention { color: #b91c1c; background: #fef2f2; border-color: #fecaca; }

    /* Manners Table Container */
    .table-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .manners-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      text-align: left;
    }

    .manners-table th {
      background: #f8fafc;
      color: #475569;
      font-weight: 700;
      padding: 10px 8px;
      border-bottom: 2px solid #e2e8f0;
      white-space: nowrap;
      font-size: 11px;
    }

    .manners-table td {
      padding: 8px 6px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }

    .manners-table tr:hover:not(.absent-row) {
      background: #f8fafc;
    }

    .absent-row {
      background: #fff8f8;
    }

    .col-sno {
      text-align: center;
      font-weight: 600;
      color: #64748b;
      width: 40px;
    }

    .student-name-box {
      display: flex;
      flex-direction: column;
    }

    .st-name {
      font-weight: 600;
      color: #0f172a;
    }

    .st-roll {
      font-size: 11px;
      color: #64748b;
    }

    .st-meta-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
    }

    .att-badge {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .att-present { background: #dcfce7; color: #15803d; }
    .att-absent { background: #fee2e2; color: #b91c1c; }
    .att-late { background: #fef3c7; color: #b45309; }
    .att-halfday { background: #e0e7ff; color: #3730a3; }
    .att-notmarked { background: #f1f5f9; color: #64748b; }

    .phone-tag {
      font-size: 11px;
      color: #475569;
    }

    .col-absent-notice {
      padding: 14px;
    }

    .absent-alert-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fef2f2;
      color: #991b1b;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      border: 1px dashed #fca5a5;
    }

    .custom-status-select {
      width: 100%;
      min-width: 95px;
      max-width: 125px;
      padding: 5px 6px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      font-size: 11px;
      font-weight: 500;
      background: #ffffff;
      outline: none;
      cursor: pointer;
    }

    .st-neat { color: #15803d; background: #f0fdf4; border-color: #86efac; }
    .st-warn { color: #b45309; background: #fffbeb; border-color: #fde68a; }
    .st-danger { color: #b91c1c; background: #fef2f2; border-color: #fca5a5; }

    .stars-picker {
      display: flex;
      gap: 2px;
      cursor: pointer;
      font-size: 15px;
      line-height: 1;
      justify-content: center;
    }

    .star-icon {
      color: #cbd5e1;
      transition: transform 0.15s ease, color 0.15s ease;
    }

    .star-icon.filled {
      color: #eab308;
    }

    .star-icon:hover {
      transform: scale(1.2);
    }

    .col-remarks {
      min-width: 110px;
      padding: 8px 6px;
    }

    .remark-input {
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

    .remark-input:focus {
      background: #ffffff;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
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
      color: #2563eb !important;
      box-shadow: 0 0 0 5px #eff6ff, 0 2px 6px rgba(37, 99, 235, 0.15) !important;
    }

    .menu-icon-green { color: #16a34a !important; }
    .menu-icon-gold { color: #d97706 !important; }
    .menu-icon-red { color: #dc2626 !important; }

    .empty-state-card {
      text-align: center;
      padding: 40px 20px;
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
    }

    .empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #94a3b8;
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
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
        flex: 1 1 200px;
      }
      .deck-actions-group {
        width: 100%;
        margin-left: 0;
        justify-content: flex-start;
      }
      .summary-kpis {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        width: 100%;
      }
      .kpi-pill {
        width: 100%;
        box-sizing: border-box;
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
      .quick-all-good-btn,
      .print-report-btn,
      .save-btn {
        width: 100% !important;
        justify-content: center;
      }
      .summary-kpis {
        grid-template-columns: 1fr;
      }
      .table-container {
        border-radius: 8px;
      }
    }
  `]
})
export class GoodMannersComponent implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private confirmDialog = inject(ConfirmDialogService);
  public authService = inject(AuthService);

  filterForm!: FormGroup;
  classes: any[] = [];
  sections: any[] = [];
  students: DailyStudentBehaviourRow[] = [];
  loading = false;
  saving = false;

  get presentCount(): number {
    return this.students.filter(s => !s.isAbsent).length;
  }

  get fiveStarCount(): number {
    return this.students.filter(s => !s.isAbsent && s.starRating === 5).length;
  }

  get attentionCount(): number {
    return this.students.filter(s => !s.isAbsent && (
      s.starRating <= 3 ||
      s.uniformCleanliness !== 'NeatAndClean' ||
      s.disciplineConduct !== 'Disciplined' ||
      s.politenessRespect !== 'PoliteAndRespectful' ||
      s.booksAndDiary !== 'BroughtAll'
    )).length;
  }

  ngOnInit(): void {
    const today = new Date().toISOString().substring(0, 10);
    this.filterForm = this.fb.group({
      date: [today],
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
          this.loadBehaviourList();
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
    this.loadBehaviourList();
  }

  loadBehaviourList(): void {
    const formVal = this.filterForm.value;
    if (!formVal.classId) return;

    this.loading = true;
    let url = `${API_BASE}/homework/daily-behaviour?date=${formVal.date}&classId=${formVal.classId}`;
    if (formVal.sectionId) {
      url += `&sectionId=${formVal.sectionId}`;
    }

    this.http.get<DailyStudentBehaviourRow[]>(url).subscribe({
      next: (data) => {
        this.students = data || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.confirmDialog.alert('Fetch Error', 'Failed to load behaviour records for the selected date.', 'danger');
      }
    });
  }

  setAllGoodManners(): void {
    let updatedCount = 0;
    for (const s of this.students) {
      if (!s.isAbsent) {
        s.uniformCleanliness = 'NeatAndClean';
        s.disciplineConduct = 'Disciplined';
        s.politenessRespect = 'PoliteAndRespectful';
        s.booksAndDiary = 'BroughtAll';
        s.starRating = 5;
        updatedCount++;
      }
    }
    this.confirmDialog.alert(
      'Applied ⭐',
      `All ${updatedCount} present students set to 5-Star & Well Behaved! Click "Save Manners Sheet" to save to the database.`,
      'success'
    );
  }

  saveDailyBehaviour(): void {
    const formVal = this.filterForm.value;
    if (this.students.length === 0) return;

    this.saving = true;
    const payload = {
      recordDate: formVal.date,
      classId: formVal.classId,
      sectionId: formVal.sectionId || null,
      items: this.students.map(s => ({
        studentId: s.studentId,
        isAbsent: s.isAbsent,
        uniformCleanliness: s.uniformCleanliness,
        disciplineConduct: s.disciplineConduct,
        politenessRespect: s.politenessRespect,
        booksAndDiary: s.booksAndDiary,
        starRating: s.starRating,
        badges: s.badges || [],
        remarks: s.remarks,
        attendanceStatus: s.attendanceStatus
      }))
    };

    this.http.post(`${API_BASE}/homework/daily-behaviour/bulk`, payload).subscribe({
      next: () => {
        this.saving = false;
        this.confirmDialog.alert(
          'Saved 🎉',
          `Daily Good Manners & Behaviour records for ${formVal.date} have been saved successfully! Click "Print / WhatsApp Report" to view or share the printable report.`,
          'success'
        );
      },
      error: (err) => {
        this.saving = false;
        this.confirmDialog.alert('Save Failed', err.error?.message || 'Could not save behaviour records.', 'danger');
      }
    });
  }

  openReportDialog(): void {
    const formVal = this.filterForm.value;
    const selectedClass = this.classes.find(c => c.id === formVal.classId);
    const selectedSection = this.sections.find(s => s.id === formVal.sectionId);

    this.dialog.open(GoodMannersReportDialogComponent, {
      width: '1320px',
      maxWidth: '96vw',
      maxHeight: '94vh',
      data: {
        date: formVal.date,
        classId: formVal.classId,
        sectionId: formVal.sectionId,
        className: selectedClass?.name || 'Class',
        sectionName: selectedSection?.name || '',
        students: this.students
      }
    });
  }

  getUniformClass(status: string): string {
    if (status === 'NeatAndClean') return 'st-neat';
    if (status === 'DirtyClothes') return 'st-danger';
    return 'st-warn';
  }

  getDisciplineClass(status: string): string {
    if (status === 'Disciplined' || status === 'AttentiveActive') return 'st-neat';
    if (status === 'Aggressive') return 'st-danger';
    return 'st-warn';
  }

  getPolitenessClass(status: string): string {
    if (status === 'PoliteAndRespectful' || status === 'FriendlyHelpful') return 'st-neat';
    return 'st-danger';
  }

  getBooksClass(status: string): string {
    if (status === 'BroughtAll') return 'st-neat';
    return 'st-warn';
  }

  sendIndividualStudentWhatsApp(s: DailyStudentBehaviourRow): void {
    const inst = this.authService.getInstituteName() || 'School';
    const date = this.filterForm.get('date')?.value;
    let msg = `🌟 *${inst} - Daily Manners & Conduct*\n`;
    msg += `📅 Date: ${date}\n`;
    msg += `👤 Student: *${s.studentName}* ${s.rollNumber ? '(Roll: ' + s.rollNumber + ')' : ''}\n\n`;
    msg += `🧼 Cleanliness & Uniform: *${this.formatStatus(s.uniformCleanliness)}*\n`;
    msg += `🧘 Classroom Discipline: *${this.formatStatus(s.disciplineConduct)}*\n`;
    msg += `🙏 Politeness & Ethics: *${this.formatStatus(s.politenessRespect)}*\n`;
    msg += `🎒 Books & Diary: *${this.formatStatus(s.booksAndDiary)}*\n`;
    msg += `⭐ Daily Rating: *${'★'.repeat(s.starRating)} (${s.starRating}/5)*\n`;
    if (s.remarks) {
      msg += `📝 Teacher's Note: _${s.remarks}_\n`;
    }
    msg += `\nThank you for supporting your child's moral & character development!`;

    const phone = s.parentWhatsAppPhone?.replace(/[^0-9]/g, '') || '';
    const cleanPhone = phone.length === 10 ? '91' + phone : phone;
    const waUrl = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  }

  quickSetFiveStar(s: DailyStudentBehaviourRow): void {
    s.uniformCleanliness = 'NeatAndClean';
    s.disciplineConduct = 'Disciplined';
    s.politenessRespect = 'PoliteAndRespectful';
    s.booksAndDiary = 'BroughtAll';
    s.starRating = 5;
  }

  quickSetNeedsAttention(s: DailyStudentBehaviourRow): void {
    s.starRating = 3;
    if (s.uniformCleanliness === 'NeatAndClean') s.uniformCleanliness = 'IncompleteUniform';
    if (s.disciplineConduct === 'Disciplined') s.disciplineConduct = 'Talkative';
  }

  formatStatus(key: string): string {
    const map: Record<string, string> = {
      NeatAndClean: 'Neat & Clean',
      IncompleteUniform: 'Incomplete Uniform',
      NailsHaircutIssue: 'Nails/Haircut Issue',
      ShoesUnpolished: 'Shoes Unpolished',
      DirtyClothes: 'Untidy Dress',
      Disciplined: 'Well Behaved',
      AttentiveActive: 'Attentive & Active',
      Talkative: 'Talkative',
      Restless: 'Restless',
      Aggressive: 'Disruptive',
      PoliteAndRespectful: 'Polite & Respectful',
      FriendlyHelpful: 'Helping Others',
      UsesRudeWords: 'Rude Language',
      Disobedient: 'Disobedient',
      BroughtAll: 'Brought All',
      ForgotDiary: 'Forgot Diary',
      ForgotBooks: 'Missing Books',
      IncompleteKit: 'Missing Stationery'
    };
    return map[key] || key;
  }
}

// =============================================================================
// PRINTABLE & WHATSAPP REPORT DIALOG COMPONENT
// =============================================================================
@Component({
  selector: 'app-good-manners-report-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    MatMenuModule
  ],
  template: `
    <div class="report-dialog-container">
      <!-- Strict Light Blue Header matching guidelines -->
      <div class="modal-header">
        <div class="header-main-row">
          <div class="header-left">
            <div class="header-icon-box">
              <mat-icon>hotel_class</mat-icon>
            </div>
            <div class="header-title-box">
              <h2 class="dialog-title">Daily Good Manners &amp; Behaviour Report</h2>
              <div class="dialog-quick-meta">
                <span class="meta-pill"><mat-icon>event</mat-icon> Date: <strong>{{ data.date }}</strong></span>
                <span class="meta-pill"><mat-icon>domain</mat-icon> Class: <strong>{{ reportHeader?.className || data.className }}</strong></span>
                <span *ngIf="reportHeader?.sectionName || data.sectionName" class="meta-pill">Sec <strong>{{ reportHeader?.sectionName || data.sectionName }}</strong></span>
                <span class="meta-pill count-pill"><mat-icon>groups</mat-icon> <strong>{{ rows.length }} Students</strong></span>
              </div>
            </div>
          </div>

          <div class="header-actions">
            <button mat-flat-button class="auto-wa-btn" (click)="sendWhatsAppAll()" [disabled]="sendingWhatsApp || rows.length === 0">
              <mat-icon *ngIf="!sendingWhatsApp">bolt</mat-icon>
              <mat-icon *ngIf="sendingWhatsApp" class="spin">sync</mat-icon>
              <span>{{ sendingWhatsApp ? 'Sending...' : '⚡ Auto Send Parents' }}</span>
            </button>

            <button mat-flat-button class="group-wa-btn" (click)="shareClassGroupWhatsApp()">
              <mat-icon>send</mat-icon>
              <span>📲 Send Group</span>
            </button>

            <button mat-flat-button class="print-btn" (click)="printReport()">
              <mat-icon>print</mat-icon>
              <span>Print (A4)</span>
            </button>

            <button mat-icon-button class="close-btn" (click)="dialogRef.close()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>
      </div>

      <!-- Printable Report Paper Sheet -->
      <div class="modal-body-scroll">
        <div class="print-paper-sheet" id="printableMannersReport">
          <!-- Institute Header -->
          <div class="report-top-header">
            <h1 class="school-title">{{ reportHeader?.institutionName || authService.getInstituteName() || 'School Manners Report' }}</h1>
            <div class="school-address-text" *ngIf="reportHeader?.subtitleOrAddress">{{ reportHeader?.subtitleOrAddress }}</div>
          </div>

          <!-- Main Navy Banner -->
          <div class="navy-title-banner">
            <span>STUDENT DAILY GOOD MANNERS &amp; BEHAVIOUR REPORT</span>
          </div>

          <!-- Meta Bar -->
          <div class="report-meta-bar">
            <div class="meta-class">
              <span class="lbl">Class:</span>
              <span class="val">{{ reportHeader?.className || data.className }}</span>
              <span class="sec-val" *ngIf="reportHeader?.sectionName || data.sectionName">({{ reportHeader?.sectionName || data.sectionName }})</span>
            </div>
            <div class="meta-summary-pills">
              <span class="sm-pill">Present: <strong>{{ reportHeader?.presentStudents || rows.length }}</strong></span>
              <span class="sm-pill gold">5-Star ⭐: <strong>{{ reportHeader?.fiveStarStudents || 0 }}</strong></span>
              <span class="sm-pill red" *ngIf="(reportHeader?.attentionNeededCount || 0) > 0">Needs Attention: <strong>{{ reportHeader?.attentionNeededCount }}</strong></span>
            </div>
            <div class="meta-date-pill">
              <span class="date-lbl">Date :</span>
              <span class="date-val">{{ data.date }}</span>
            </div>
          </div>

          <!-- Report Data Table -->
          <table class="report-data-table">
            <thead>
              <tr>
                <th style="width: 4%;">S.No</th>
                <th style="width: 18%;">Student Name</th>
                <th style="width: 14%;">Cleanliness &amp; Uniform</th>
                <th style="width: 14%;">Discipline &amp; Conduct</th>
                <th style="width: 14%;">Manners &amp; Respect</th>
                <th style="width: 14%;">Books &amp; Diary</th>
                <th style="width: 8%;">Stars</th>
                <th style="width: 14%;">Teacher Remarks</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of rows; let i = index" [class.absent-row]="row.isAbsent">
                <td class="text-center">{{ i + 1 }}</td>
                <td>
                  <div class="name-box">
                    <span class="name-bold">{{ row.studentName }}</span>
                    <button type="button" class="row-wa-btn hide-on-print" (click)="sendSingleWhatsApp(row)" [matTooltip]="'Open WhatsApp for ' + row.studentName">
                      <mat-icon>chat</mat-icon>
                      <span>WhatsApp</span>
                    </button>
                  </div>
                  <div class="sub-roll" *ngIf="row.rollNumber">Roll: {{ row.rollNumber }}</div>
                </td>

                <!-- Absent Student row -->
                <ng-container *ngIf="row.isAbsent">
                  <td colspan="6" class="absent-bracket-cell text-center">
                    <span class="absent-text-red">Absent / Leave</span>
                  </td>
                </ng-container>

                <!-- Present Student Row -->
                <ng-container *ngIf="!row.isAbsent">
                  <td>
                    <span class="status-chip" [ngClass]="getChipClass(row.uniformCleanliness)">
                      {{ formatStatus(row.uniformCleanliness) }}
                    </span>
                  </td>
                  <td>
                    <span class="status-chip" [ngClass]="getChipClass(row.disciplineConduct)">
                      {{ formatStatus(row.disciplineConduct) }}
                    </span>
                  </td>
                  <td>
                    <span class="status-chip" [ngClass]="getChipClass(row.politenessRespect)">
                      {{ formatStatus(row.politenessRespect) }}
                    </span>
                  </td>
                  <td>
                    <span class="status-chip" [ngClass]="getChipClass(row.booksAndDiary)">
                      {{ formatStatus(row.booksAndDiary) }}
                    </span>
                  </td>
                  <td class="text-center">
                    <div class="stars-view">
                      <span class="star-gold" *ngFor="let s of [1,2,3,4,5].slice(0, row.starRating)">★</span>
                    </div>
                  </td>
                  <td>
                    <span class="remark-text">{{ row.remarks || '—' }}</span>
                  </td>
                </ng-container>
              </tr>
            </tbody>
          </table>

          <!-- Footer Signature Area -->
          <div class="report-footer-signatures">
            <div class="sig-box">
              <div class="sig-line"></div>
              <span>Class Teacher Signature</span>
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
              <span>Principal / Headmaster Signature</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .report-dialog-container {
      display: flex;
      flex-direction: column;
      height: 90vh;
      background: #f8fafc;
      border-radius: 12px;
      overflow: hidden;
    }

    /* Light Blue Gradient Header matching strict UI guidelines */
    .modal-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 14px 20px;
    }

    .header-main-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-icon-box {
      width: 42px;
      height: 42px;
      border-radius: 10px;
      background: #2563eb;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
    }

    .dialog-title {
      font-size: 18px;
      font-weight: 700;
      color: #1e3a8a;
      margin: 0;
    }

    .dialog-quick-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }

    .meta-pill {
      font-size: 11px;
      color: #3b82f6;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .meta-pill strong {
      color: #1e40af;
    }

    .meta-pill mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .auto-wa-btn {
      background: #16a34a !important;
      color: #ffffff !important;
      font-weight: 600;
      height: 38px;
    }

    .group-wa-btn {
      background: #2563eb !important;
      color: #ffffff !important;
      height: 38px;
    }

    .print-btn {
      background: #0f172a !important;
      color: #ffffff !important;
      height: 38px;
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
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      justify-content: center;
    }

    .print-paper-sheet {
      width: 100%;
      max-width: 1100px;
      background: #ffffff;
      padding: 24px 32px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      box-sizing: border-box;
    }

    .report-top-header {
      text-align: center;
      margin-bottom: 12px;
    }

    .school-title {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .school-address-text {
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
    }

    .navy-title-banner {
      background: #1e3a8a;
      color: #ffffff;
      text-align: center;
      padding: 6px 12px;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 0.5px;
      border-radius: 4px;
      margin-bottom: 12px;
    }

    .report-meta-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 8px;
      margin-bottom: 12px;
      font-size: 12px;
    }

    .meta-class .val {
      font-weight: 700;
      color: #0f172a;
    }

    .meta-summary-pills {
      display: flex;
      gap: 12px;
    }

    .sm-pill {
      font-size: 11px;
      color: #475569;
    }

    .sm-pill.gold strong { color: #b45309; }
    .sm-pill.red strong { color: #b91c1c; }

    .date-val {
      font-weight: 700;
      color: #0f172a;
    }

    .report-data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }

    .report-data-table th, .report-data-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      vertical-align: middle;
    }

    .report-data-table th {
      background: #f1f5f9;
      font-weight: 700;
      color: #1e293b;
      text-align: left;
    }

    .text-center { text-align: center !important; }

    .name-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .name-bold {
      font-weight: 700;
      color: #0f172a;
    }

    .sub-roll {
      font-size: 10px;
      color: #64748b;
    }

    .row-wa-btn {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #86efac;
      border-radius: 4px;
      font-size: 9px;
      padding: 1px 4px;
      cursor: pointer;
    }

    .row-wa-btn mat-icon {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }

    .absent-bracket-cell {
      background: #fef2f2;
    }

    .absent-text-red {
      color: #b91c1c;
      font-weight: 700;
    }

    .status-chip {
      display: inline-block;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .chip-green { background: #dcfce7; color: #166534; }
    .chip-amber { background: #fef3c7; color: #b45309; }
    .chip-red { background: #fee2e2; color: #991b1b; }

    .stars-view {
      color: #eab308;
      font-size: 13px;
      letter-spacing: 1px;
    }

    .remark-text {
      color: #334155;
    }

    .report-footer-signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 40px;
      padding: 0 40px;
    }

    .sig-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
    }

    .sig-line {
      width: 180px;
      border-top: 1px solid #0f172a;
    }

    @media print {
      body * {
        visibility: hidden;
      }
      #printableMannersReport, #printableMannersReport * {
        visibility: visible;
      }
      #printableMannersReport {
        position: absolute;
        left: 0;
        top: 0;
        width: 100% !important;
        max-width: 100% !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
      }
      .hide-on-print {
        display: none !important;
      }
      @page {
        size: A4 landscape;
        margin: 6mm;
      }
    }
  `]
})
export class GoodMannersReportDialogComponent implements OnInit {
  reportHeader?: DailyBehaviourReportHeader;
  rows: DailyStudentBehaviourRow[] = [];
  sendingWhatsApp = false;

  constructor(
    public dialogRef: MatDialogRef<GoodMannersReportDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService,
    public authService: AuthService
  ) {
    if (data?.students) {
      this.rows = data.students;
    }
  }

  ngOnInit(): void {
    this.loadReportHeader();
  }

  loadReportHeader(): void {
    let url = `${API_BASE}/homework/daily-behaviour/report?date=${this.data.date}&classId=${this.data.classId}`;
    if (this.data.sectionId) {
      url += `&sectionId=${this.data.sectionId}`;
    }

    this.http.get<DailyBehaviourReportHeader>(url).subscribe({
      next: (res) => {
        this.reportHeader = res;
        if (res.rows && res.rows.length > 0) {
          this.rows = res.rows;
        }
      }
    });
  }

  printReport(): void {
    const el = document.getElementById('printableMannersReport');
    if (!el) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1100,height=850');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Daily Good Manners Report - ${this.data.date}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #ffffff; color: #0f172a; padding: 6mm 8mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 12px; }
            .report-top-header { text-align: center; margin-bottom: 8px; }
            .school-title { font-size: 20px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; margin-bottom: 2px; }
            .school-address-text { font-size: 11px; color: #64748b; }
            .navy-title-banner { background: #0f172a; color: #ffffff; padding: 6px 12px; font-weight: 700; text-align: center; font-size: 13px; letter-spacing: 0.5px; margin: 8px 0; border-radius: 4px; }
            .report-meta-bar { display: flex; justify-content: space-between; align-items: center; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; background: #f8fafc; font-size: 11px; margin-bottom: 12px; }
            .meta-class .val { font-weight: 700; color: #0f172a; }
            .meta-summary-pills { display: flex; gap: 8px; }
            .sm-pill { padding: 2px 6px; border-radius: 4px; background: #e2e8f0; font-size: 10px; font-weight: 600; }
            .sm-pill.gold { background: #fef9c3; color: #854d0e; }
            .sm-pill.red { background: #fee2e2; color: #991b1b; }
            .report-data-table { width: 100%; border-collapse: collapse; font-size: 11px; border: 1.5px solid #0f172a; }
            .report-data-table th, .report-data-table td { border: 1px solid #94a3b8; padding: 5px 6px; vertical-align: middle; }
            .report-data-table th { background: #f1f5f9; font-weight: 700; color: #0f172a; }
            .text-center { text-align: center; }
            .status-chip { font-weight: 600; font-size: 10px; display: inline-block; padding: 2px 6px; border-radius: 4px; }
            .chip-green { background: #dcfce7; color: #166534; }
            .chip-amber { background: #fef3c7; color: #b45309; }
            .chip-red { background: #fee2e2; color: #991b1b; }
            .stars-view { color: #d97706; font-size: 12px; font-weight: 700; }
            .report-footer-signatures { display: flex; justify-content: space-between; margin-top: 36px; padding: 0 40px; }
            .sig-box { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; }
            .sig-line { width: 160px; border-top: 1px solid #0f172a; margin-bottom: 4px; }
            .absent-note-text { color: #991b1b; font-style: italic; }
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

  sendWhatsAppAll(): void {
    const presentRows = this.rows.filter(r => !r.isAbsent);
    if (presentRows.length === 0) {
      this.confirmDialog.alert('No Students', 'No present students to send report.', 'danger');
      return;
    }

    this.sendingWhatsApp = true;
    const items = presentRows.map(r => ({
      studentId: r.studentId,
      studentName: r.studentName,
      rollNumber: r.rollNumber,
      phone: r.parentWhatsAppPhone,
      messageText: this.buildStudentMessage(r)
    }));

    this.http.post<any>(`${API_BASE}/homework/daily-behaviour/send-whatsapp-all`, {
      recordDate: this.data.date,
      classId: this.data.classId,
      sectionId: this.data.sectionId || null,
      items
    }).subscribe({
      next: (res) => {
        this.sendingWhatsApp = false;
        this.confirmDialog.alert('WhatsApp Dispatched', res.message || 'Dispatched successfully!', 'success');
      },
      error: (err) => {
        this.sendingWhatsApp = false;
        this.confirmDialog.alert('Dispatch Error', err.error?.message || 'Failed to dispatch WhatsApp messages.', 'danger');
      }
    });
  }

  shareClassGroupWhatsApp(): void {
    const className = this.reportHeader?.className || this.data.className;
    const sec = this.reportHeader?.sectionName || this.data.sectionName;
    const inst = this.reportHeader?.institutionName || this.authService.getInstituteName() || 'School';
    
    let text = `🌟 *${inst}*\n`;
    text += `📋 *DAILY GOOD MANNERS & BEHAVIOUR REPORT*\n`;
    text += `📅 Date: *${this.data.date}*\n`;
    text += `🏫 Class: *${className}${sec ? ' (' + sec + ')' : ''}*\n`;
    text += `👥 Total Evaluated: *${this.rows.length}* | Present: *${this.reportHeader?.presentStudents || this.rows.length}*\n`;
    text += `⭐ 5-Star Champions: *${this.reportHeader?.fiveStarStudents || 0}*\n\n`;

    const topStars = this.rows.filter(r => !r.isAbsent && r.starRating === 5);
    if (topStars.length > 0) {
      text += `🏆 *Stars of the Day:*\n`;
      topStars.slice(0, 5).forEach((s, idx) => {
        text += `${idx + 1}. ${s.studentName} ⭐⭐⭐⭐⭐\n`;
      });
      text += `\n`;
    }

    text += `Kindly encourage students to follow school ethics, clean uniform, and politeness daily. Thank you!`;

    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  }

  sendSingleWhatsApp(row: DailyStudentBehaviourRow): void {
    const text = this.buildStudentMessage(row);
    const phone = row.parentWhatsAppPhone?.replace(/[^0-9]/g, '') || '';
    const cleanPhone = phone.length === 10 ? '91' + phone : phone;
    const waUrl = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  }

  buildStudentMessage(r: DailyStudentBehaviourRow): string {
    const inst = this.reportHeader?.institutionName || this.authService.getInstituteName() || 'School';
    let msg = `🌟 *${inst} - Daily Manners & Conduct*\n`;
    msg += `📅 Date: ${this.data.date}\n`;
    msg += `👤 Student: *${r.studentName}* ${r.rollNumber ? '(Roll: ' + r.rollNumber + ')' : ''}\n\n`;
    msg += `🧼 Cleanliness & Uniform: *${this.formatStatus(r.uniformCleanliness)}*\n`;
    msg += `🧘 Classroom Discipline: *${this.formatStatus(r.disciplineConduct)}*\n`;
    msg += `🙏 Politeness & Ethics: *${this.formatStatus(r.politenessRespect)}*\n`;
    msg += `🎒 Books & Diary: *${this.formatStatus(r.booksAndDiary)}*\n`;
    msg += `⭐ Daily Rating: *${'★'.repeat(r.starRating)} (${r.starRating}/5)*\n`;
    if (r.remarks) {
      msg += `📝 Teacher's Note: _${r.remarks}_\n`;
    }
    msg += `\nThank you for supporting your child's moral & character development!`;
    return msg;
  }

  formatStatus(key: string): string {
    const map: Record<string, string> = {
      NeatAndClean: 'Neat & Clean',
      IncompleteUniform: 'Incomplete Uniform',
      NailsHaircutIssue: 'Nails/Haircut Issue',
      ShoesUnpolished: 'Shoes Unpolished',
      DirtyClothes: 'Untidy Dress',
      Disciplined: 'Well Behaved',
      AttentiveActive: 'Attentive & Active',
      Talkative: 'Talkative',
      Restless: 'Restless',
      Aggressive: 'Disruptive',
      PoliteAndRespectful: 'Polite & Respectful',
      FriendlyHelpful: 'Helping Others',
      UsesRudeWords: 'Rude Language',
      Disobedient: 'Disobedient',
      BroughtAll: 'Brought All',
      ForgotDiary: 'Forgot Diary',
      ForgotBooks: 'Missing Books',
      IncompleteKit: 'Missing Stationery'
    };
    return map[key] || key;
  }

  getChipClass(key: string): string {
    if (['NeatAndClean', 'Disciplined', 'AttentiveActive', 'PoliteAndRespectful', 'FriendlyHelpful', 'BroughtAll'].includes(key)) {
      return 'chip-green';
    }
    if (['DirtyClothes', 'Aggressive', 'UsesRudeWords', 'Disobedient'].includes(key)) {
      return 'chip-red';
    }
    return 'chip-amber';
  }
}
