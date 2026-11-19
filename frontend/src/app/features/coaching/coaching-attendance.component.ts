import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { BatchesService, BatchDto } from '../../core/services/batches.service';
import { SchoolService } from '../../core/services/school.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AttendanceShiftSettingsDialogComponent } from '../../shared/components/attendance-shift-settings-dialog.component';
import { CoachingAttendanceCalendarDialogComponent } from './coaching-attendance-calendar-dialog.component';
import { CoachingMultiDateDialogComponent } from './coaching-multi-date-dialog.component';
import { ApplyStudentLeaveDialogComponent } from '../students/student-leaves.component';
import { ApplyStudentRegularizationDialogComponent } from '../students/student-regularization-dialog.component';
import { environment } from '../../../environments/environment';

export interface ClassOption {
  id: string;
  name: string;
}

export interface AttendanceStudentRow {
  studentId: string;
  studentName: string;
  rollNumber?: string;
  coachingRollNumber?: string;
  admissionNumber?: string;
  profilePhoto?: string;
  photoFailed?: boolean;
  parentWhatsAppPhone?: string;
  status: 'Present' | 'Absent' | 'Late' | 'HalfDay' | 'Leave';
  checkInTime?: string;
  checkOutTime?: string;
  remarks?: string;
}

@Component({
  selector: 'app-coaching-attendance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatButtonToggleModule,
    MatDialogModule,
    RouterModule
  ],
  template: `
    <div class="page-container">
      <!-- Page Header -->
      <div class="page-header">
        <div class="title-area">
          <div class="header-icon-box">
            <mat-icon>fact_check</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Batch Daily Attendance (दैनिक उपस्थिति)</h1>
            <p class="page-subtitle">Track and mark daily attendance for coaching batches with Class ➔ Batch cascade and smart compliance metrics.</p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-stroked-button class="smart-btn regularize-smart-btn" (click)="openApplyRegularization()" matTooltip="Submit or review student attendance regularization / OD request">
            <mat-icon class="btn-ic">history_toggle_off</mat-icon>
            <span class="btn-lbl">Regularize</span>
          </button>
          <button mat-stroked-button class="smart-btn settings-smart-btn" (click)="openShiftSettingsDialog()" matTooltip="Configure Shift Timings & Policies for Coaching Batches and Faculty">
            <mat-icon class="btn-ic">schedule</mat-icon>
            <span class="btn-lbl">Batch Shift Settings</span>
          </button>
        </div>
      </div>

      <!-- Single Prominent Loading Bar -->
      @if (loading) {
        <mat-progress-bar mode="indeterminate" class="global-loader"></mat-progress-bar>
      }

      <!-- Cascading Filter Deck (Class ➔ Batches ➔ Date) -->
      <mat-card class="filter-card mat-elevation-z1">
        <form [formGroup]="filterForm" class="filter-form">
          <!-- Step 1: Class Selector -->
          <mat-form-field appearance="outline" class="filter-control">
            <mat-label>Academic Class (कक्षा)</mat-label>
            <mat-select formControlName="classId" (selectionChange)="onClassChange($event.value)">
              <mat-option value="">-- All Classes (सभी कक्षाएं) --</mat-option>
              @for (c of classes; track c.id) {
                <mat-option [value]="c.id">{{ c.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <!-- Step 2: Cascading Batch Selector -->
          <mat-form-field appearance="outline" class="filter-control highlight-control">
            <mat-label>Coaching Batch (बैच चयन) *</mat-label>
            <mat-select formControlName="batchId" (selectionChange)="onBatchChange($event.value)">
              @if (filteredBatches.length === 0) {
                <mat-option disabled>No batches available for selected class</mat-option>
              }
              @for (b of filteredBatches; track b.id) {
                <mat-option [value]="b.id">
                  <strong>{{ b.name }}</strong> ({{ b.subject || 'All Subjects' }} • {{ b.studentCount || 0 }} Students)
                </mat-option>
              }
            </mat-select>
          </mat-form-field>

          <!-- Step 3: Attendance Date (IST) -->
          <mat-form-field appearance="outline" class="filter-control date-control">
            <mat-label>Attendance Date (दिनांक)</mat-label>
            <input matInput type="date" formControlName="date" (change)="loadAttendance()" />
          </mat-form-field>
        </form>

        <!-- Selected Batch Shift Meta Strip -->
        @if (selectedBatch) {
          <div class="batch-meta-strip">
            <div class="meta-pill">
              <mat-icon>class</mat-icon>
              <span>Batch: <strong>{{ selectedBatch.name }}</strong></span>
            </div>
            <div class="meta-pill">
              <mat-icon>schedule</mat-icon>
              <span>Shift: <strong>{{ selectedBatch.shift || 'General' }}</strong> ({{ selectedBatch.startTime || '08:00' }} - {{ selectedBatch.endTime || '12:00' }})</span>
            </div>
            <div class="meta-pill count-pill">
              <mat-icon>people</mat-icon>
              <span>Total Strength: <strong>{{ students.length }}</strong></span>
            </div>
          </div>
        }
      </mat-card>

      <!-- KPI Summary Deck & Bulk Quick Actions -->
      @if (selectedBatchId && students.length > 0) {
        <div class="kpi-deck">
          <mat-card class="kpi-card total">
            <div class="kpi-content">
              <div class="kpi-info">
                <span class="kpi-label">Total Strength</span>
                <span class="kpi-value">{{ students.length }}</span>
              </div>
              <div class="kpi-icon total"><mat-icon>groups</mat-icon></div>
            </div>
          </mat-card>

          <mat-card class="kpi-card present">
            <div class="kpi-content">
              <div class="kpi-info">
                <span class="kpi-label">Present</span>
                <span class="kpi-value text-green">{{ presentCount }}</span>
              </div>
              <div class="kpi-icon present"><mat-icon>check_circle</mat-icon></div>
            </div>
          </mat-card>

          <mat-card class="kpi-card absent">
            <div class="kpi-content">
              <div class="kpi-info">
                <span class="kpi-label">Absent</span>
                <span class="kpi-value text-red">{{ absentCount }}</span>
              </div>
              <div class="kpi-icon absent"><mat-icon>cancel</mat-icon></div>
            </div>
          </mat-card>

          <mat-card class="kpi-card late">
            <div class="kpi-content">
              <div class="kpi-info">
                <span class="kpi-label">Late / Partial</span>
                <span class="kpi-value text-amber">{{ lateCount + halfDayCount }}</span>
              </div>
              <div class="kpi-icon late"><mat-icon>schedule</mat-icon></div>
            </div>
          </mat-card>

          <mat-card class="kpi-card compliance">
            <div class="kpi-content">
              <div class="kpi-info">
                <span class="kpi-label">Compliance</span>
                <span class="kpi-value text-blue">{{ complianceRate }}%</span>
              </div>
              <div class="kpi-icon compliance"><mat-icon>query_stats</mat-icon></div>
            </div>
          </mat-card>
        </div>

        <!-- Attendance Workspace Card -->
        <mat-card class="attendance-card mat-elevation-z1">
          <div class="attendance-toolbar">
            <div class="quick-btn-group">
              <button mat-flat-button class="quick-btn mark-present" (click)="markAll('Present')">
                <mat-icon>done_all</mat-icon> Mark All Present
              </button>
              <button mat-button class="quick-btn mark-absent" (click)="markAll('Absent')">
                <mat-icon>close</mat-icon> Mark All Absent
              </button>
              <button mat-stroked-button class="quick-btn cal-tool-btn" (click)="openAttendanceCalendar()">
                <mat-icon>calendar_month</mat-icon> Monthly Calendar
              </button>
              <button mat-stroked-button class="quick-btn multi-date-tool-btn" (click)="openMultiDateDialog()">
                <mat-icon>date_range</mat-icon> Multi-Date Bulk Entry
              </button>
              <button mat-stroked-button class="quick-btn leave-tool-btn" (click)="openStudentLeaves()" matTooltip="Apply or review student leave applications for this batch">
                <mat-icon>beach_access</mat-icon> Student Leaves
              </button>
              <button mat-stroked-button class="quick-btn reg-tool-btn" (click)="openApplyRegularization()" matTooltip="Submit attendance regularization or correction request for this batch">
                <mat-icon>history_toggle_off</mat-icon> Regularize
              </button>
              <button mat-flat-button color="primary" class="save-attendance-btn" [disabled]="saving" (click)="saveAttendance()">
                <mat-icon>save</mat-icon> Save Attendance
              </button>
            </div>
          </div>

          <div class="table-responsive">
            <table mat-table [dataSource]="students" class="erp-table">
              <!-- Roll No -->
              <ng-container matColumnDef="rollNo">
                <th mat-header-cell *matHeaderCellDef style="width: 100px;">Roll No</th>
                <td mat-cell *matCellDef="let s">
                  <span class="roll-badge">{{ s.coachingRollNumber || s.rollNumber || '—' }}</span>
                </td>
              </ng-container>

              <!-- Student Name -->
              <ng-container matColumnDef="studentName">
                <th mat-header-cell *matHeaderCellDef>Student Name & Contact</th>
                <td mat-cell *matCellDef="let s">
                  <div class="student-info-cell">
                    <div class="avatar-box" [style.background]="!s.profilePhoto || s.photoFailed ? getAvatarBg(s.studentName) : '#f1f5f9'">
                      @if (s.profilePhoto && !s.photoFailed) {
                        <img [src]="getPhotoUrl(s.profilePhoto)" (error)="s.photoFailed = true" [alt]="s.studentName" class="avatar-img" />
                      } @else {
                        <span class="avatar-initials">{{ getInitials(s.studentName) }}</span>
                      }
                    </div>
                    <div class="info-texts">
                      <span class="name-text">{{ s.studentName }}</span>
                      <span class="sub-text">WhatsApp: {{ s.parentWhatsAppPhone || 'N/A' }}</span>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- Attendance Status Toggles -->
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef style="min-width: 280px; text-align: center;">Attendance Status</th>
                <td mat-cell *matCellDef="let s" style="text-align: center;">
                  <div class="status-toggle-wrapper">
                    <button type="button" class="status-btn" [class.active-present]="s.status === 'Present'" (click)="s.status = 'Present'">P</button>
                    <button type="button" class="status-btn" [class.active-absent]="s.status === 'Absent'" (click)="s.status = 'Absent'">A</button>
                    <button type="button" class="status-btn" [class.active-late]="s.status === 'Late'" (click)="s.status = 'Late'">L</button>
                    <button type="button" class="status-btn" [class.active-half]="s.status === 'HalfDay'" (click)="s.status = 'HalfDay'">HD</button>
                    <button type="button" class="status-btn" [class.active-leave]="s.status === 'Leave'" (click)="s.status = 'Leave'">LV</button>
                  </div>
                </td>
              </ng-container>

              <!-- Remarks -->
              <ng-container matColumnDef="remarks">
                <th mat-header-cell *matHeaderCellDef style="min-width: 200px;">Remarks / Note</th>
                <td mat-cell *matCellDef="let s">
                  <input type="text" class="remarks-input" placeholder="Optional notes..." [(ngModel)]="s.remarks" />
                </td>
              </ng-container>

              <!-- Monthly Calendar & Regularize Column -->
              <ng-container matColumnDef="calendar">
                <th mat-header-cell *matHeaderCellDef style="width: 100px; text-align: center;">Actions</th>
                <td mat-cell *matCellDef="let s" style="text-align: center;">
                  <div class="row-actions-group">
                    <button type="button" class="row-cal-btn" (click)="openAttendanceCalendar(s.studentId)" matTooltip="View Monthly Google Calendar for {{ s.studentName }}">
                      <mat-icon>calendar_month</mat-icon>
                    </button>
                    <button type="button" class="row-cal-btn row-reg-btn" (click)="openApplyRegularization(s)" matTooltip="Regularize attendance for {{ s.studentName }}">
                      <mat-icon>history_toggle_off</mat-icon>
                    </button>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns;"></tr>
            </table>
          </div>

          <div class="attendance-footer">
            <span class="footer-hint">All records will be synchronized in Indian Standard Time (IST).</span>
            <button mat-flat-button color="primary" class="save-attendance-btn" [disabled]="saving" (click)="saveAttendance()">
              <mat-icon>save</mat-icon> Save Attendance
            </button>
          </div>
        </mat-card>
      } @else if (selectedBatchId && !loading && students.length === 0) {
        <mat-card class="notice-card mat-elevation-z1">
          <mat-icon class="notice-icon">group_off</mat-icon>
          <h3>No Students in Selected Batch</h3>
          <p>Please allocate students to <strong>{{ selectedBatch?.name }}</strong> using the Batch Allocation module first.</p>
          <a mat-flat-button color="primary" routerLink="/coaching/batch-allocation">
            <mat-icon>group_add</mat-icon> Go to Batch Allocation
          </a>
        </mat-card>
      } @else if (!selectedBatchId) {
        <mat-card class="notice-card mat-elevation-z1">
          <mat-icon class="notice-icon">touch_app</mat-icon>
          <h3>Please Select an Academic Class and Coaching Batch</h3>
          <p>Select a coaching batch from the filter deck above to open the roll-call register and log attendance.</p>
        </mat-card>
      }
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
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      padding: 18px 24px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }

    .title-area {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .smart-btn {
      display: inline-flex !important;
      align-items: center !important;
      gap: 8px !important;
      height: 42px !important;
      padding: 0 16px !important;
      border-radius: 10px !important;
      font-size: 0.84rem !important;
      font-weight: 700 !important;
      letter-spacing: 0.2px !important;
      cursor: pointer !important;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
      white-space: nowrap !important;

      .btn-ic {
        font-size: 19px !important;
        width: 19px !important;
        height: 19px !important;
      }

      &:hover {
        transform: translateY(-1.5px) !important;
      }
    }

    .multi-date-smart-btn {
      background: linear-gradient(135deg, #059669 0%, #047857 100%) !important;
      color: #ffffff !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      box-shadow: 0 4px 10px -1px rgba(5, 150, 105, 0.35) !important;

      .btn-ic {
        color: #ffffff !important;
      }

      &:hover {
        background: linear-gradient(135deg, #047857 0%, #065f46 100%) !important;
        box-shadow: 0 6px 14px -2px rgba(5, 150, 105, 0.45) !important;
      }
    }

    .calendar-smart-btn {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
      color: #ffffff !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      box-shadow: 0 4px 10px -1px rgba(37, 99, 235, 0.35) !important;

      .btn-ic {
        color: #ffffff !important;
      }

      &:hover {
        background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%) !important;
        box-shadow: 0 6px 14px -2px rgba(37, 99, 235, 0.45) !important;
      }
    }

    .settings-smart-btn {
      background: #ffffff !important;
      color: #1e3a8a !important;
      border: 1.5px solid #bfdbfe !important;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.08) !important;

      .btn-ic {
        color: #2563eb !important;
      }

      &:hover {
        background: #eff6ff !important;
        border-color: #93c5fd !important;
        box-shadow: 0 4px 10px rgba(37, 99, 235, 0.16) !important;
      }
    }

    .regularize-smart-btn {
      background: #faf5ff !important;
      color: #6b21a8 !important;
      border: 1.5px solid #e9d5ff !important;
      box-shadow: 0 2px 6px rgba(124, 58, 237, 0.08) !important;

      .btn-ic {
        color: #7c3aed !important;
      }

      &:hover {
        background: #f3e8ff !important;
        border-color: #d8b4fe !important;
        box-shadow: 0 4px 10px rgba(124, 58, 237, 0.16) !important;
      }
    }

    .reg-tool-btn {
      color: #7c3aed !important;
      border-color: #ddd6fe !important;
      background: #faf5ff !important;
      font-weight: 600;

      mat-icon {
        color: #7c3aed !important;
      }

      &:hover {
        background: #f3e8ff !important;
        border-color: #c4b5fd !important;
      }
    }

    .row-actions-group {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .row-reg-btn {
      border-color: #e9d5ff !important;
      background: #faf5ff !important;
      color: #7c3aed !important;

      &:hover {
        background: #7c3aed !important;
        color: #ffffff !important;
        border-color: #7c3aed !important;
      }
    }

    .multi-date-tool-btn {
      color: #059669 !important;
      border-color: #a7f3d0 !important;
      background: #ecfdf5 !important;
      font-weight: 600;

      &:hover {
        background: #d1fae5 !important;
      }
    }

    .leave-tool-btn {
      color: #0284c7 !important;
      border-color: #bae6fd !important;
      background: #f0f9ff !important;
      font-weight: 600;

      &:hover {
        background: #e0f2fe !important;
      }
    }

    .cal-tool-btn {
      color: #2563eb !important;
      border-color: #bfdbfe !important;
      background: #eff6ff !important;
      font-weight: 600;

      &:hover {
        background: #dbeafe !important;
      }
    }

    .row-cal-btn {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      border: 1px solid #bfdbfe;
      background: #eff6ff;
      color: #2563eb;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: #2563eb;
        color: #ffffff;
        border-color: #2563eb;
        transform: scale(1.05);
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .header-icon-box {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: #2563eb;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
      mat-icon { font-size: 26px; width: 26px; height: 26px; }
    }

    .page-title {
      font-size: 1.4rem;
      font-weight: 700;
      color: #1e3a8a;
      margin: 0;
    }

    .page-subtitle {
      font-size: 0.86rem;
      color: #64748b;
      margin: 3px 0 0;
    }

    .global-loader {
      border-radius: 4px;
      overflow: hidden;
    }

    .filter-card {
      padding: 18px 22px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
    }

    .filter-form {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
    }

    .filter-control {
      flex: 1 1 240px;
      min-width: 220px;
    }

    .highlight-control {
      flex: 1 1 300px;
    }

    .date-control {
      flex: 1 1 200px;
    }

    .batch-meta-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px dashed #e2e8f0;
    }

    .meta-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f1f5f9;
      color: #334155;
      padding: 5px 12px;
      border-radius: 8px;
      font-size: 0.82rem;
      border: 1px solid #e2e8f0;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2563eb; }
    }

    .count-pill {
      background: #eff6ff;
      border-color: #bfdbfe;
      color: #1e40af;
      mat-icon { color: #2563eb; }
    }

    .kpi-deck {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 14px;
    }

    .kpi-card {
      border-radius: 12px;
      padding: 14px 18px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
    }

    .kpi-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .kpi-info {
      display: flex;
      flex-direction: column;
    }

    .kpi-label {
      font-size: 0.76rem;
      text-transform: uppercase;
      font-weight: 600;
      color: #64748b;
      letter-spacing: 0.03em;
    }

    .kpi-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1e293b;
      line-height: 1.2;
      margin-top: 2px;
    }

    .text-green { color: #16a34a; }
    .text-red { color: #dc2626; }
    .text-amber { color: #d97706; }
    .text-blue { color: #2563eb; }

    .kpi-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      mat-icon { font-size: 22px; width: 22px; height: 22px; }
      &.total { background: #f1f5f9; color: #475569; }
      &.present { background: #dcfce7; color: #16a34a; }
      &.absent { background: #fee2e2; color: #dc2626; }
      &.late { background: #fef3c7; color: #d97706; }
      &.compliance { background: #dbeafe; color: #2563eb; }
    }

    .attendance-card {
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      padding: 20px;
    }

    .attendance-toolbar {
      display: flex;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e2e8f0;
      width: 100%;
    }

    .quick-btn-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      width: 100%;
    }

    .quick-btn {
      font-weight: 600;
      font-size: 12.5px;
      height: 36px;
      padding: 0 11px;
      border-radius: 8px;
      white-space: nowrap;
      mat-icon { font-size: 17px; width: 17px; height: 17px; margin-right: 4px; }
      &.mark-present {
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
      }
      &.mark-absent {
        background: #fef2f2;
        color: #991b1b;
        border: 1px solid #fecaca;
      }
    }

    .save-attendance-btn {
      font-weight: 700;
      font-size: 12.5px;
      height: 36px;
      padding: 0 14px;
      border-radius: 8px;
      white-space: nowrap;
      background: #059669 !important;
      color: #ffffff !important;
      mat-icon { margin-right: 5px; font-size: 17px; width: 17px; height: 17px; }
    }

    .table-responsive {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }

    .erp-table {
      width: 100%;
      background: #ffffff;
      border-collapse: collapse;

      th {
        background: #f8fafc;
        color: #475569;
        font-weight: 600;
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        padding: 12px 16px;
        border-bottom: 1px solid #e2e8f0;
        white-space: nowrap;
      }

      td {
        padding: 12px 16px;
        border-bottom: 1px solid #f1f5f9;
        font-size: 0.88rem;
        color: #1e293b;
        white-space: nowrap;
      }

      tr:hover td {
        background: #f8fafc;
      }
    }

    .student-info-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .avatar-box {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      color: #64748b;
      flex-shrink: 0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
      border: 1.5px solid #ffffff;

      .avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .avatar-initials {
        font-size: 13px;
        font-weight: 700;
        color: #ffffff;
        letter-spacing: 0.5px;
        user-select: none;
        text-transform: uppercase;
      }
    }

    .info-texts {
      display: flex;
      flex-direction: column;
    }

    .name-text {
      font-weight: 600;
      color: #0f172a;
    }

    .sub-text {
      font-size: 0.74rem;
      color: #64748b;
    }

    .roll-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      background: #eff6ff;
      color: #1d4ed8;
      font-weight: 700;
      font-size: 0.82rem;
      border: 1px solid #bfdbfe;
    }

    .status-toggle-wrapper {
      display: inline-flex;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
    }

    .status-btn {
      border: none;
      background: transparent;
      padding: 6px 14px;
      font-size: 0.82rem;
      font-weight: 700;
      color: #64748b;
      cursor: pointer;
      border-right: 1px solid #e2e8f0;
      transition: all 0.15s ease;

      &:last-child {
        border-right: none;
      }

      &.active-present {
        background: #16a34a;
        color: #ffffff;
      }
      &.active-absent {
        background: #dc2626;
        color: #ffffff;
      }
      &.active-late {
        background: #d97706;
        color: #ffffff;
      }
      &.active-half {
        background: #9333ea;
        color: #ffffff;
      }
      &.active-leave {
        background: #2563eb;
        color: #ffffff;
      }
    }

    .remarks-input {
      width: 100%;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 0.84rem;
      color: #1e293b;
      outline: none;
      box-sizing: border-box;

      &:focus {
        border-color: #2563eb;
      }
    }

    .attendance-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      flex-wrap: wrap;
      gap: 12px;
    }

    .footer-hint {
      font-size: 0.82rem;
      color: #64748b;
    }

    .notice-card {
      padding: 48px 24px;
      text-align: center;
      border-radius: 12px;
      border: 1px dashed #cbd5e1;
      background: #f8fafc;
      color: #64748b;
      .notice-icon { font-size: 48px; width: 48px; height: 48px; color: #3b82f6; margin-bottom: 8px; }
      h3 { font-size: 1.15rem; color: #1e3a8a; margin: 0 0 6px; font-weight: 700; }
      p { font-size: 0.88rem; max-width: 500px; margin: 0 auto 16px; line-height: 1.5; }
    }

    @media (max-width: 1024px) {
      .page-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 14px;
      }
      .header-actions {
        width: 100%;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .kpi-deck {
        grid-template-columns: repeat(3, 1fr);
      }
      .quick-btn-group {
        flex-wrap: wrap;
      }
    }

    @media (max-width: 640px) {
      .page-container {
        padding: 0 0 24px;
        gap: 14px;
      }
      .page-header {
        flex-direction: column;
        align-items: stretch;
        padding: 14px 14px;
        gap: 12px;
      }
      .title-area {
        gap: 10px;
      }
      .header-icon-box {
        width: 38px;
        height: 38px;
        min-width: 38px;
        border-radius: 10px;
        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }
      .page-title {
        font-size: 1.15rem;
        line-height: 1.25;
      }
      .page-subtitle {
        font-size: 0.76rem;
      }
      .header-actions {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 8px;
        .smart-btn {
          width: 100%;
          justify-content: center;
          height: 38px !important;
          font-size: 0.8rem !important;
        }
      }
      .filter-card {
        padding: 12px 14px;
      }
      .filter-form {
        gap: 10px;
      }
      .filter-control, .highlight-control, .date-control {
        flex: 1 1 100%;
        min-width: 100%;
      }
      .batch-meta-strip {
        gap: 6px;
        margin-top: 10px;
        padding-top: 10px;
      }
      .meta-pill {
        font-size: 0.74rem;
        padding: 4px 8px;
      }
      .kpi-deck {
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }
      .kpi-card {
        padding: 10px 12px;
      }
      .kpi-label {
        font-size: 0.68rem;
      }
      .kpi-value {
        font-size: 1.25rem;
      }
      .kpi-icon {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
      .attendance-card {
        padding: 12px 10px;
      }
      .attendance-toolbar {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
        margin-bottom: 12px;
        padding-bottom: 12px;
      }
      .quick-btn-group {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 6px;
        width: 100%;
      }
      .quick-btn {
        width: 100%;
        justify-content: center;
        font-size: 0.74rem;
        padding: 0 6px !important;
        height: 36px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 3px; }
      }
      .save-attendance-btn {
        grid-column: span 2;
        width: 100%;
        height: 42px;
        font-size: 0.88rem;
        justify-content: center;
      }
      .erp-table {
        min-width: 620px;
      }
      .attendance-footer {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
        text-align: center;
        .save-attendance-btn {
          width: 100%;
        }
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachingAttendanceComponent implements OnInit {
  filterForm: FormGroup;
  classes: ClassOption[] = [];
  allBatches: BatchDto[] = [];
  filteredBatches: BatchDto[] = [];
  selectedBatch: BatchDto | null = null;
  selectedBatchId: string = '';

  students: AttendanceStudentRow[] = [];
  columns: string[] = ['rollNo', 'studentName', 'status', 'remarks', 'calendar'];

  loading = false;
  saving = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private batchesService: BatchesService,
    private schoolService: SchoolService,
    private confirmDialog: ConfirmDialogService,
    private dialog: MatDialog,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    const today = new Date().toISOString().split('T')[0];
    this.filterForm = this.fb.group({
      classId: [''],
      batchId: [''],
      date: [today]
    });
  }

  ngOnInit(): void {
    this.loadClasses();
    this.loadBatches();
  }

  loadClasses(): void {
    this.schoolService.getClasses(true, 'Coaching').subscribe({
      next: res => {
        this.classes = (res || []).map(c => ({ id: c.id, name: c.name }));
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  loadBatches(): void {
    this.loading = true;
    this.batchesService.getBatches().subscribe({
      next: batches => {
        this.allBatches = batches || [];
        this.filterBatchesByClass();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  openShiftSettingsDialog(): void {
    const ref = this.dialog.open(AttendanceShiftSettingsDialogComponent, {
      width: '960px',
      maxWidth: '96vw',
      data: {
        initialTab: 'coaching',
        allowedTabs: ['teacher', 'coaching'],
        title: 'Coaching Shift & Policy Settings',
        subtitle: 'Configure coaching batch shifts (Morning/Evening), biometric/turnstile mode, and faculty rules.'
      }
    });
    ref.afterClosed().subscribe(res => {
      if (res?.saved) {
        this.confirmDialog.alert('Settings Saved', 'Coaching batch shift timings and policies updated successfully.', 'success');
        this.loadBatches();
      }
    });
  }

  openAttendanceCalendar(studentId?: string): void {
    if (!this.selectedBatchId) {
      this.confirmDialog.alert('Select Coaching Batch', 'Please select a coaching batch from the filter deck first to view the attendance calendar.', 'info');
      return;
    }

    const dateVal = this.filterForm.get('date')?.value;
    let m = new Date().getMonth() + 1;
    let y = new Date().getFullYear();
    if (dateVal) {
      const parts = dateVal.split('-');
      if (parts.length === 3) {
        y = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10);
      }
    }

    const selectedClass = this.classes.find(c => c.id === this.filterForm.get('classId')?.value);

    this.dialog.open(CoachingAttendanceCalendarDialogComponent, {
      width: 'min(1320px, 96vw)',
      maxWidth: '96vw',
      height: '94vh',
      maxHeight: '94vh',
      panelClass: 'coaching-calendar-dialog-panel',
      data: {
        batchId: this.selectedBatchId,
        batchName: this.selectedBatch?.name || 'Coaching Batch',
        className: selectedClass?.name,
        shift: this.selectedBatch?.shift,
        startTime: this.selectedBatch?.startTime,
        endTime: this.selectedBatch?.endTime,
        students: this.students.map(s => ({
          studentId: s.studentId,
          studentName: s.studentName,
          coachingRollNumber: s.coachingRollNumber,
          rollNumber: s.rollNumber,
          admissionNumber: s.admissionNumber,
          profilePhoto: s.profilePhoto
        })),
        initialStudentId: studentId,
        initialMonth: m,
        initialYear: y
      }
    });
  }

  onClassChange(classId: string): void {
    this.filterBatchesByClass();
    this.filterForm.patchValue({ batchId: '' });
    this.selectedBatchId = '';
    this.selectedBatch = null;
    this.students = [];
    this.cdr.markForCheck();
  }

  filterBatchesByClass(): void {
    const selectedClassId = this.filterForm.get('classId')?.value;
    if (!selectedClassId) {
      this.filteredBatches = [...this.allBatches];
    } else {
      this.filteredBatches = this.allBatches.filter(b => b.classId === selectedClassId || !b.classId);
    }
  }

  onBatchChange(batchId: string): void {
    this.selectedBatchId = batchId;
    this.selectedBatch = this.allBatches.find(b => b.id === batchId) || null;
    if (batchId) {
      this.loadAttendance();
    } else {
      this.students = [];
    }
    this.cdr.markForCheck();
  }

  loadAttendance(): void {
    if (!this.selectedBatchId) return;
    const date = this.filterForm.get('date')?.value;
    this.loading = true;

    this.http.get<any[]>(`${environment.apiUrl}/students/batch/${this.selectedBatchId}/attendance?date=${date}`).subscribe({
      next: res => {
        this.students = (res || []).map(r => ({
          studentId: r.studentId || r.id,
          studentName: r.studentName,
          rollNumber: r.rollNumber,
          coachingRollNumber: r.coachingRollNumber,
          admissionNumber: r.admissionNumber,
          profilePhoto: r.profilePhoto,
          parentWhatsAppPhone: r.parentWhatsAppPhone,
          status: (r.status as any) || 'Present',
          checkInTime: r.checkInTime || this.selectedBatch?.startTime || '08:30',
          checkOutTime: r.checkOutTime || this.selectedBatch?.endTime || '12:30',
          remarks: r.remarks || ''
        }));
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  markAll(status: 'Present' | 'Absent'): void {
    this.students.forEach(s => s.status = status);
    this.cdr.markForCheck();
  }

  get presentCount(): number {
    return this.students.filter(s => s.status === 'Present').length;
  }

  get absentCount(): number {
    return this.students.filter(s => s.status === 'Absent').length;
  }

  get lateCount(): number {
    return this.students.filter(s => s.status === 'Late').length;
  }

  get halfDayCount(): number {
    return this.students.filter(s => s.status === 'HalfDay').length;
  }

  get complianceRate(): number {
    if (this.students.length === 0) return 0;
    const presentTotal = this.presentCount + (this.lateCount * 0.8) + (this.halfDayCount * 0.5);
    return Math.round((presentTotal / this.students.length) * 100);
  }

  openMultiDateDialog(): void {
    if (!this.selectedBatchId) {
      this.confirmDialog.alert('Select Coaching Batch', 'Please select a coaching batch from the filter deck first to mark multi-date attendance.', 'info');
      return;
    }

    const selectedClass = this.classes.find(c => c.id === this.filterForm.get('classId')?.value);

    const ref = this.dialog.open(CoachingMultiDateDialogComponent, {
      width: 'min(1280px, 96vw)',
      maxWidth: '96vw',
      maxHeight: '92vh',
      panelClass: 'coaching-multi-date-dialog-panel',
      data: {
        batchId: this.selectedBatchId,
        batchName: this.selectedBatch?.name || 'Coaching Batch',
        className: selectedClass?.name,
        shift: this.selectedBatch?.shift,
        startTime: this.selectedBatch?.startTime,
        endTime: this.selectedBatch?.endTime,
        students: this.students.map(s => ({
          studentId: s.studentId,
          studentName: s.studentName,
          coachingRollNumber: s.coachingRollNumber,
          rollNumber: s.rollNumber,
          admissionNumber: s.admissionNumber,
          profilePhoto: s.profilePhoto,
          status: s.status,
          remarks: s.remarks
        }))
      }
    });

    ref.afterClosed().subscribe(res => {
      if (res?.saved) {
        this.loadAttendance();
      }
    });
  }

  openStudentLeaves(): void {
    const classId = this.filterForm.value.classId;
    const batchId = this.selectedBatchId;
    if (batchId) {
      this.router.navigate(['/students/leaves'], {
        queryParams: {
          scope: 'Coaching',
          classId: classId,
          batchId: batchId
        }
      });
    } else {
      this.router.navigate(['/students/leaves'], {
        queryParams: { scope: 'Coaching' }
      });
    }
  }

  applyStudentLeave(student?: any): void {
    const ref = this.dialog.open(ApplyStudentLeaveDialogComponent, {
      width: 'min(720px, 94vw)',
      data: {
        scope: 'Coaching',
        classId: this.filterForm.value.classId,
        batchId: this.selectedBatchId,
        studentId: student?.studentId
      }
    });

    ref.afterClosed().subscribe(res => {
      if (res) {
        this.loadAttendance();
      }
    });
  }

  openApplyRegularization(student?: any): void {
    const dialogRef = this.dialog.open(ApplyStudentRegularizationDialogComponent, {
      width: '650px',
      data: {
        studentId: student?.studentId || student?.id,
        studentName: student?.studentName,
        rollNumber: student?.coachingRollNumber || student?.rollNumber,
        className: this.selectedBatch?.name || student?.className,
        attendanceDate: this.filterForm.value.date
      }
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res) {
        this.loadAttendance();
      }
    });
  }

  saveAttendance(): void {
    if (!this.selectedBatchId || this.students.length === 0) return;

    const date = this.filterForm.get('date')?.value;
    const payload = {
      batchId: this.selectedBatchId,
      attendanceDate: date,
      date: date,
      sendWhatsAppAlerts: false,
      items: this.students.map(s => ({
        studentId: s.studentId,
        status: s.status,
        checkInTime: s.status === 'Absent' ? null : s.checkInTime,
        checkOutTime: s.status === 'Absent' ? null : s.checkOutTime,
        remarks: s.remarks
      }))
    };

    this.saving = true;
    this.http.post<any>(`${environment.apiUrl}/students/batch/${this.selectedBatchId}/attendance/bulk`, payload).subscribe({
      next: () => {
        this.saving = false;
        this.confirmDialog.alert(
          'Attendance Saved',
          `Attendance for ${this.students.length} students in batch '${this.selectedBatch?.name}' on ${date} has been successfully recorded.`,
          'success'
        );
        this.loadAttendance();
        this.cdr.markForCheck();
      },
      error: err => {
        this.saving = false;
        this.confirmDialog.alert('Error', err.error?.message || 'Failed to save batch attendance.', 'warning');
        this.cdr.markForCheck();
      }
    });
  }

  getPhotoUrl(path?: string | null): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      return path;
    }
    const clean = path.startsWith('/') ? path : `/${path}`;
    return `${environment.apiBaseUrl}${clean}`;
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  getAvatarBg(name: string): string {
    if (!name) return '#64748b';
    const colors = [
      '#2563eb', '#4f46e5', '#7c3aed', '#059669', '#0891b2', 
      '#d97706', '#dc2626', '#db2777', '#0284c7', '#16a34a'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }
}
