import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
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
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { HttpClient } from '@angular/common/http';
import { BatchesService, BatchDto } from '../../core/services/batches.service';
import { SchoolService } from '../../core/services/school.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { RolesService } from '../../core/services/roles.service';
import { AuthService } from '../../core/services/auth.service';
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
  captureSource?: string;
  remarks?: string;
  hasPendingRegularization?: boolean;
  pendingRegularizationReason?: string;
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
    MatPaginatorModule,
    MatSortModule,
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
          @if (canEditAttendance) {
            <button mat-stroked-button class="smart-btn settings-smart-btn" (click)="openShiftSettingsDialog()" matTooltip="Configure Shift Timings & Policies for Coaching Batches and Faculty">
              <mat-icon class="btn-ic">schedule</mat-icon>
              <span class="btn-lbl">Batch Shift Settings</span>
            </button>
          }
        </div>
      </div>

      <!-- Single Prominent Loading Bar (AGENTS.md Strict Single Loader Rule) -->
      @if (loading) {
        <mat-progress-bar mode="indeterminate" class="global-loader"></mat-progress-bar>
      }

      <!-- Cascading Filter Deck (Batch Scope ➔ Class ➔ Batches ➔ Date) -->
      <mat-card class="filter-card mat-elevation-z1">
        <!-- Batch Grouping Scope Switcher (All / Single Class / Multi-Class Combined) -->
        <div class="batch-scope-bar">
          <span class="scope-label"><mat-icon>hub</mat-icon> Batch Grouping:</span>
          <div class="scope-pills">
            <button type="button" class="scope-pill" [class.active]="batchScope === 'all'" (click)="setBatchScope('all')">
              <mat-icon>apps</mat-icon> All Batches <span class="scope-count">{{ allBatches.length }}</span>
            </button>
            <button type="button" class="scope-pill" [class.active]="batchScope === 'single'" (click)="setBatchScope('single')">
              <mat-icon>class</mat-icon> Single Class <span class="scope-count">{{ singleClassBatchCount }}</span>
            </button>
            <button type="button" class="scope-pill combined-pill" [class.active]="batchScope === 'combined'" (click)="setBatchScope('combined')">
              <mat-icon>layers</mat-icon> Multi-Class Combined <span class="scope-count">{{ combinedBatchCount }}</span>
            </button>
          </div>
        </div>

        <form [formGroup]="filterForm" class="filter-form">
          <!-- Step 1: Class Selector (Shown for All & Single Class scopes) -->
          @if (batchScope !== 'combined') {
            <mat-form-field appearance="outline" class="filter-control">
              <mat-label>Academic Class (कक्षा)</mat-label>
              <mat-select formControlName="classId" (selectionChange)="onClassChange($event.value)">
                <mat-option value="">-- All Classes (सभी कक्षाएं) --</mat-option>
                @for (c of classes; track c.id) {
                  <mat-option [value]="c.id">{{ c.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          }

          <!-- Step 2: Cascading Batch Selector -->
          <mat-form-field appearance="outline" class="filter-control highlight-control">
            <mat-label>Coaching Batch (बैच चयन) *</mat-label>
            <mat-select formControlName="batchId" (selectionChange)="onBatchChange($event.value)">
              @if (filteredBatches.length === 0) {
                <mat-option disabled>No batches available for selected filter</mat-option>
              }
              @for (b of filteredBatches; track b.id) {
                <mat-option [value]="b.id">
                  <strong>{{ b.name }}</strong>
                  @if (isCombinedBatch(b)) { [Combined] }
                  ({{ b.subject || 'All Subjects' }} • {{ b.studentCount || 0 }} Students)
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
            <div class="meta-pill" [class.combined-meta-pill]="isCombinedBatch(selectedBatch)">
              <mat-icon>{{ isCombinedBatch(selectedBatch) ? 'layers' : 'school' }}</mat-icon>
              <span>Type: <strong>{{ isCombinedBatch(selectedBatch) ? 'Multi-Class Combined' : 'Single Class' }}</strong></span>
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
              @if (canMarkAttendance) {
                <button mat-flat-button class="quick-btn mark-present" (click)="markAll('Present')">
                  <mat-icon>done_all</mat-icon> Mark All Present
                </button>
                <button mat-button class="quick-btn mark-absent" (click)="markAll('Absent')">
                  <mat-icon>close</mat-icon> Mark All Absent
                </button>
              }
              <button mat-stroked-button class="quick-btn cal-tool-btn" (click)="openAttendanceCalendar()" matTooltip="Open Individual Coaching Student Register & Monthly Calendar">
                <mat-icon>calendar_month</mat-icon> Individual &amp; Monthly Register
              </button>
              @if (canMarkAttendance) {
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
                  <mat-icon>save</mat-icon> Save
                </button>
              }
            </div>
          </div>

          <!-- Searching & Status Filter Bar -->
          <div class="search-filter-bar">
            <mat-form-field appearance="outline" class="table-search-field">
              <mat-label>Search student (Name / Roll / Phone)</mat-label>
              <mat-icon matPrefix class="search-ic">search</mat-icon>
              <input matInput [formControl]="searchControl" placeholder="Type to filter..." />
              @if (searchTerm) {
                <button matSuffix mat-icon-button type="button" (click)="clearSearch()">
                  <mat-icon>close</mat-icon>
                </button>
              }
            </mat-form-field>

            <div class="status-filter-pills">
              <button type="button" class="filter-pill" [class.active]="selectedStatusFilter === 'ALL'" (click)="setStatusFilter('ALL')">
                All ({{ students.length }})
              </button>
              <button type="button" class="filter-pill pill-present" [class.active]="selectedStatusFilter === 'Present'" (click)="setStatusFilter('Present')">
                Present ({{ presentCount }})
              </button>
              <button type="button" class="filter-pill pill-absent" [class.active]="selectedStatusFilter === 'Absent'" (click)="setStatusFilter('Absent')">
                Absent ({{ absentCount }})
              </button>
              <button type="button" class="filter-pill pill-late" [class.active]="selectedStatusFilter === 'Late'" (click)="setStatusFilter('Late')">
                Late ({{ lateCount }})
              </button>
              <button type="button" class="filter-pill pill-half" [class.active]="selectedStatusFilter === 'HalfDay'" (click)="setStatusFilter('HalfDay')">
                Half Day ({{ halfDayCount }})
              </button>
              <button type="button" class="filter-pill pill-leave" [class.active]="selectedStatusFilter === 'Leave'" (click)="setStatusFilter('Leave')">
                Leave ({{ leaveCount }})
              </button>
            </div>
          </div>

          <!-- Resizable Table with Header Sorting -->
          <div class="table-responsive">
            <table mat-table [dataSource]="pagedStudents" matSort (matSortChange)="onSortChange($event)" class="erp-table resizable-table">
              <!-- Roll No Column -->
              <ng-container matColumnDef="rollNo">
                <th mat-header-cell *matHeaderCellDef mat-sort-header="rollNo" [style.width.px]="colWidths['rollNo']" class="resizable-header">
                  <div class="header-inner">Roll No</div>
                  <div class="col-resizer" (mousedown)="startResize($event, 'rollNo')"></div>
                </th>
                <td mat-cell *matCellDef="let s">
                  <span class="roll-badge">{{ s.coachingRollNumber || s.rollNumber || '—' }}</span>
                </td>
              </ng-container>

              <!-- Student Name Column -->
              <ng-container matColumnDef="studentName">
                <th mat-header-cell *matHeaderCellDef mat-sort-header="studentName" [style.width.px]="colWidths['studentName']" class="resizable-header">
                  <div class="header-inner">Student Name & Contact</div>
                  <div class="col-resizer" (mousedown)="startResize($event, 'studentName')"></div>
                </th>
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
                      @if (s.checkInTime || s.checkOutTime) {
                        <div class="punch-time-row">
                          @if (s.captureSource === 'Biometric') {
                            <span class="bio-chip" matTooltip="Captured via Biometric Device">
                              <mat-icon>fingerprint</mat-icon> Bio
                            </span>
                          }
                          @if (s.checkInTime) {
                            <span class="punch-in-chip">In: {{ formatTime12h(s.checkInTime) }}</span>
                          }
                          @if (s.checkOutTime) {
                            <span class="punch-out-chip">Out: {{ formatTime12h(s.checkOutTime) }}</span>
                          }
                        </div>
                      }
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- Attendance Status Toggles Column -->
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef mat-sort-header="status" [style.width.px]="colWidths['status']" class="resizable-header text-center">
                  <div class="header-inner">Attendance Status</div>
                  <div class="col-resizer" (mousedown)="startResize($event, 'status')"></div>
                </th>
                <td mat-cell *matCellDef="let s" class="text-center">
                  <div class="status-cell-wrap">
                    <div class="status-toggle-wrapper">
                      <button type="button" class="status-btn" [disabled]="!canMarkAttendance" [class.active-present]="s.status === 'Present'" (click)="setStatus(s, 'Present')">P</button>
                      <button type="button" class="status-btn" [disabled]="!canMarkAttendance" [class.active-absent]="s.status === 'Absent'" (click)="setStatus(s, 'Absent')">A</button>
                      <button type="button" class="status-btn" [disabled]="!canMarkAttendance" [class.active-late]="s.status === 'Late'" (click)="setStatus(s, 'Late')">L</button>
                      <button type="button" class="status-btn" [disabled]="!canMarkAttendance" [class.active-half]="s.status === 'HalfDay'" (click)="setStatus(s, 'HalfDay')">HD</button>
                      <button type="button" class="status-btn" [disabled]="!canMarkAttendance" [class.active-leave]="s.status === 'Leave'" (click)="setStatus(s, 'Leave')">LV</button>
                    </div>
                    @if (s.hasPendingRegularization) {
                      <div class="status-pending-tag" [matTooltip]="'Regularization Pending Review: ' + (s.pendingRegularizationReason || 'Awaiting Review')">
                        <mat-icon class="pending-ic">hourglass_top</mat-icon>
                        <span>Reg. Pending</span>
                      </div>
                    }
                  </div>
                </td>
              </ng-container>

              <!-- Remarks Column -->
              <ng-container matColumnDef="remarks">
                <th mat-header-cell *matHeaderCellDef [style.width.px]="colWidths['remarks']" class="resizable-header">
                  <div class="header-inner">Remarks / Note</div>
                  <div class="col-resizer" (mousedown)="startResize($event, 'remarks')"></div>
                </th>
                <td mat-cell *matCellDef="let s">
                  <input type="text" class="remarks-input" placeholder="Optional notes..." [(ngModel)]="s.remarks" [disabled]="!canMarkAttendance" />
                </td>
              </ng-container>

              <!-- Monthly Calendar & Regularize Actions Column -->
              <ng-container matColumnDef="calendar">
                <th mat-header-cell *matHeaderCellDef [style.width.px]="colWidths['calendar']" class="resizable-header text-center">
                  <div class="header-inner">Actions</div>
                </th>
                <td mat-cell *matCellDef="let s" class="text-center">
                  <div class="row-actions-group">
                    <button type="button" class="row-cal-btn" (click)="openAttendanceCalendar(s.studentId)" matTooltip="View Monthly Google Calendar for {{ s.studentName }}">
                      <mat-icon>calendar_month</mat-icon>
                    </button>
                    @if (s.hasPendingRegularization) {
                      <span class="row-pending-badge" [matTooltip]="'Regularization Pending Review: ' + (s.pendingRegularizationReason || 'Awaiting Review')">
                        <mat-icon class="badge-ic">hourglass_top</mat-icon>
                        <span>Pending</span>
                      </span>
                    } @else {
                      <button type="button" class="row-cal-btn row-reg-btn" (click)="openApplyRegularization(s)" matTooltip="Regularize attendance for {{ s.studentName }}">
                        <mat-icon>history_toggle_off</mat-icon>
                      </button>
                    }
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns;"></tr>
            </table>
          </div>

          <!-- Paginator -->
          <mat-paginator
            [length]="filteredStudents.length"
            [pageSize]="pageSize"
            [pageSizeOptions]="[10, 25, 50, 100]"
            [pageIndex]="pageIndex"
            (page)="onPageChange($event)"
            showFirstLastButtons
            class="erp-paginator">
          </mat-paginator>

          <div class="attendance-footer">
            <span class="footer-hint">All records will be synchronized in Indian Standard Time (IST). Showing {{ filteredStudents.length }} of {{ students.length }} students.</span>
            @if (canMarkAttendance) {
              <button mat-flat-button color="primary" class="save-attendance-btn" [disabled]="saving" (click)="saveAttendance()">
                <mat-icon>save</mat-icon> Save
              </button>
            }
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
      flex-wrap: wrap;
      gap: 16px;
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

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .smart-btn {
      font-weight: 600;
      border-radius: 8px;
      height: 40px !important;
      padding: 0 14px !important;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .settings-smart-btn {
      border: 1px solid #93c5fd;
      color: #1d4ed8;
      background: #eff6ff;
      &:hover { background: #dbeafe; }
      .btn-ic { color: #2563eb; }
    }

    .btn-ic {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .global-loader {
      border-radius: 4px;
      overflow: hidden;
      height: 4px;
    }

    .filter-card {
      padding: 18px 22px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
    }

    .batch-scope-bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px 14px;
      margin-bottom: 16px;
      padding-bottom: 14px;
      border-bottom: 1px dashed #e2e8f0;
    }

    .scope-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.82rem;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      mat-icon { font-size: 17px; width: 17px; height: 17px; color: #2563eb; }
    }

    .scope-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .scope-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #334155;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.16s ease;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #64748b; }
      .scope-count {
        background: #e2e8f0;
        color: #334155;
        padding: 1px 7px;
        border-radius: 10px;
        font-size: 0.72rem;
        font-weight: 700;
      }
      &:hover {
        background: #eff6ff;
        border-color: #93c5fd;
        color: #1d4ed8;
      }
      &.active {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        border-color: #1d4ed8;
        color: #ffffff;
        box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
        mat-icon { color: #ffffff; }
        .scope-count {
          background: rgba(255, 255, 255, 0.22);
          color: #ffffff;
        }
      }
      &.combined-pill.active {
        background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
        border-color: #6d28d9;
        box-shadow: 0 2px 6px rgba(124, 58, 237, 0.25);
      }
    }

    .combined-meta-pill {
      background: #f5f3ff !important;
      border-color: #ddd6fe !important;
      color: #5b21b6 !important;
      mat-icon { color: #7c3aed !important; }
    }

    .punch-time-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 3px;
    }

    .bio-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 1px 6px;
      border-radius: 6px;
      background: #ecfeff;
      border: 1px solid #a5f3fc;
      color: #0e7490;
      font-size: 0.7rem;
      font-weight: 700;
      mat-icon { font-size: 12px; width: 12px; height: 12px; }
    }

    .punch-in-chip {
      font-size: 0.72rem;
      font-weight: 600;
      color: #15803d;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      padding: 1px 6px;
      border-radius: 6px;
    }

    .punch-out-chip {
      font-size: 0.72rem;
      font-weight: 600;
      color: #1d4ed8;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 1px 6px;
      border-radius: 6px;
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
      padding: 16px 18px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      }
    }

    .kpi-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .kpi-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .kpi-label {
      font-size: 0.76rem;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: #64748b;
    }

    .kpi-value {
      font-size: 1.6rem;
      font-weight: 800;
      color: #0f172a;
      line-height: 1;
    }

    .kpi-icon {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      mat-icon { font-size: 24px; width: 24px; height: 24px; }
      &.total { background: #eff6ff; color: #2563eb; }
      &.present { background: #ecfdf5; color: #059669; }
      &.absent { background: #fef2f2; color: #dc2626; }
      &.late { background: #fffbeb; color: #d97706; }
      &.compliance { background: #f0fdf4; color: #16a34a; }
    }

    .text-green { color: #059669 !important; }
    .text-red { color: #dc2626 !important; }
    .text-amber { color: #d97706 !important; }
    .text-blue { color: #2563eb !important; }

    .attendance-card {
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      padding: 20px 24px;
    }

    .attendance-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 14px;
      padding-bottom: 14px;
      border-bottom: 1px solid #f1f5f9;
    }

    .quick-btn-group {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .quick-btn {
      font-weight: 600;
      font-size: 0.82rem;
      border-radius: 8px;
      height: 38px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .mark-present {
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
      &:hover { background: #d1fae5; }
    }

    .mark-absent {
      background: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
      &:hover { background: #fee2e2; }
    }

    .cal-tool-btn, .multi-date-tool-btn, .leave-tool-btn, .reg-tool-btn {
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #334155;
      &:hover { background: #f1f5f9; }
    }

    .reg-tool-btn {
      border-color: #ddd6fe;
      background: #f5f3ff;
      color: #6d28d9;
      mat-icon { color: #7c3aed; }
      &:hover { background: #ede9fe; }
    }

    .save-attendance-btn {
      font-weight: 700;
      border-radius: 8px;
      height: 38px;
      padding: 0 18px !important;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #059669 !important;
      color: #ffffff !important;
      box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);
      &:hover { background: #047857 !important; }
    }

    .search-filter-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 14px;
    }

    .table-search-field {
      flex: 1 1 280px;
      max-width: 380px;
      margin-bottom: -18px;
    }

    .search-ic {
      color: #64748b;
      margin-right: 4px;
    }

    .status-filter-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }

    .filter-pill {
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #475569;
      font-size: 0.78rem;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 20px;
      cursor: pointer;
      transition: all 0.15s ease;
      &:hover { background: #f1f5f9; }
      &.active {
        background: #1e3a8a;
        color: #ffffff;
        border-color: #1e3a8a;
      }
      &.pill-present.active { background: #059669; border-color: #059669; }
      &.pill-absent.active { background: #dc2626; border-color: #dc2626; }
      &.pill-late.active { background: #d97706; border-color: #d97706; }
      &.pill-half.active { background: #7c3aed; border-color: #7c3aed; }
      &.pill-leave.active { background: #0284c7; border-color: #0284c7; }
    }

    .table-responsive {
      overflow-x: auto;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
    }

    .erp-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .resizable-table th.mat-header-cell {
      position: relative;
      background: #f8fafc;
      color: #475569;
      font-weight: 700;
      font-size: 0.80rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1px solid #cbd5e1;
      padding: 12px 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      user-select: none;
    }

    .header-inner {
      display: inline-block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .col-resizer {
      position: absolute;
      top: 0;
      right: 0;
      width: 6px;
      height: 100%;
      cursor: col-resize;
      user-select: none;
      z-index: 2;
      background: transparent;
      transition: background 0.15s ease;
      &:hover, &.resizing {
        background: #2563eb;
      }
    }

    .erp-table td.mat-cell {
      padding: 12px 14px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
      font-size: 0.88rem;
      vertical-align: middle;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .erp-table tr.mat-row:hover {
      background: #f8fafc;
    }

    .text-center { text-align: center; }

    .roll-badge {
      display: inline-block;
      padding: 4px 8px;
      background: #eff6ff;
      color: #1d4ed8;
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.82rem;
      border: 1px solid #dbeafe;
    }

    .student-info-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .avatar-box {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
    }

    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .avatar-initials {
      color: #ffffff;
      font-weight: 700;
      font-size: 0.85rem;
    }

    .info-texts {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .name-text {
      font-weight: 600;
      color: #0f172a;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sub-text {
      font-size: 0.76rem;
      color: #64748b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .status-toggle-wrapper {
      display: inline-flex;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      overflow: hidden;
      background: #f8fafc;
    }

    .status-btn {
      border: none;
      background: transparent;
      padding: 6px 12px;
      font-size: 0.82rem;
      font-weight: 700;
      color: #64748b;
      cursor: pointer;
      transition: all 0.15s ease;
      border-right: 1px solid #e2e8f0;

      &:last-child {
        border-right: none;
      }

      &:hover {
        background: #f1f5f9;
        color: #1e293b;
      }

      &.active-present {
        background: #059669;
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
        background: #7c3aed;
        color: #ffffff;
      }

      &.active-leave {
        background: #0284c7;
        color: #ffffff;
      }
    }

    .row-actions-group {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .row-cal-btn {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #3b82f6;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      &:hover {
        background: #2563eb;
        color: #ffffff;
      }
    }

    .row-reg-btn {
      color: #7c3aed;
      border-color: #ddd6fe;
      background: #f5f3ff;
      &:hover {
        background: #7c3aed;
        color: #ffffff;
      }
    }

    .row-pending-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fcd34d;
      border-radius: 6px;
      padding: 3px 8px;
      font-size: 0.72rem;
      font-weight: 700;
      line-height: 1.2;
      box-shadow: 0 1px 2px rgba(245, 158, 11, 0.15);
      cursor: default;

      .badge-ic {
        font-size: 13px;
        width: 13px;
        height: 13px;
        color: #d97706;
      }
    }

    .status-cell-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .status-pending-tag {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fde68a;
      border-radius: 4px;
      padding: 1px 6px;
      font-size: 0.65rem;
      font-weight: 700;

      .pending-ic {
        font-size: 11px;
        width: 11px;
        height: 11px;
        color: #d97706;
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

    .erp-paginator {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
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
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachingAttendanceComponent implements OnInit, OnDestroy {
  filterForm: FormGroup;
  classes: ClassOption[] = [];
  allBatches: BatchDto[] = [];
  filteredBatches: BatchDto[] = [];
  selectedBatch: BatchDto | null = null;
  selectedBatchId: string = '';

  students: AttendanceStudentRow[] = [];
  filteredStudents: AttendanceStudentRow[] = [];
  pagedStudents: AttendanceStudentRow[] = [];
  columns: string[] = ['rollNo', 'studentName', 'status', 'remarks', 'calendar'];

  // Dynamic Role-Based Permissions (loaded from RolePermissions)
  canMarkAttendance = false;
  canEditAttendance = false;

  // Batch Grouping Scope ('all' | 'single' | 'combined')
  batchScope: 'all' | 'single' | 'combined' = 'all';

  // Search & Filter state
  searchControl = new FormControl('');
  searchTerm: string = '';
  selectedStatusFilter: 'ALL' | 'Present' | 'Absent' | 'Late' | 'HalfDay' | 'Leave' = 'ALL';

  // Sorting & Pagination state
  pageIndex: number = 0;
  pageSize: number = 25;
  sortBy: string = 'rollNo';
  sortDesc: boolean = false;

  // Column Resizing state
  colWidths: Record<string, number> = {
    rollNo: 120,
    studentName: 320,
    status: 290,
    remarks: 220,
    calendar: 120
  };
  private resizingCol: string | null = null;
  private startX: number = 0;
  private startWidth: number = 0;
  private onMouseMoveBound = this.onMouseMove.bind(this);
  private onMouseUpBound = this.onMouseUp.bind(this);

  loading = false;
  saving = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private batchesService: BatchesService,
    private schoolService: SchoolService,
    private confirmDialog: ConfirmDialogService,
    private rolesService: RolesService,
    private authService: AuthService,
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
    this.loadPermissions();
    this.searchControl.valueChanges.subscribe(val => {
      this.searchTerm = val || '';
      this.pageIndex = 0;
      this.applyLocalFilters();
    });
    this.loadClasses();
    this.loadBatches();
  }

  private loadPermissions(): void {
    const isSuper = this.authService.isSuperAdmin();
    this.canMarkAttendance = isSuper;
    this.canEditAttendance = isSuper;

    const currentRoute = (this.router.url || '/coaching/attendance').split('?')[0];
    this.rolesService.getMyPermissions().subscribe({
      next: perms => {
        const p = perms?.[currentRoute] || perms?.['/coaching/attendance'];
        if (p) {
          this.canMarkAttendance = isSuper || !!p.canCreate || !!p.canEdit;
          this.canEditAttendance = isSuper || !!p.canEdit;
        } else {
          this.canMarkAttendance = isSuper;
          this.canEditAttendance = isSuper;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.cdr.markForCheck();
      }
    });
  }

  isCombinedBatch(b: any): boolean {
    if (!b) return false;
    if (!b.classId) return true;
    return !!(b.name && (
      /class\s*\d+.*(?:to|-).*\d+/i.test(b.name) ||
      b.name.toLowerCase().includes('combined') ||
      b.name.toLowerCase().includes('foundation')
    ));
  }

  get singleClassBatchCount(): number {
    return (this.allBatches || []).filter(b => !this.isCombinedBatch(b)).length;
  }

  get combinedBatchCount(): number {
    return (this.allBatches || []).filter(b => this.isCombinedBatch(b)).length;
  }

  setBatchScope(scope: 'all' | 'single' | 'combined'): void {
    if (this.batchScope === scope) return;
    this.batchScope = scope;
    if (scope === 'combined') {
      this.filterForm.patchValue({ classId: '', batchId: '' }, { emitEvent: false });
    } else {
      this.filterForm.patchValue({ batchId: '' }, { emitEvent: false });
    }
    this.selectedBatchId = '';
    this.selectedBatch = null;
    this.students = [];
    this.filteredStudents = [];
    this.pagedStudents = [];
    this.filterBatchesByClass();
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    window.removeEventListener('mousemove', this.onMouseMoveBound);
    window.removeEventListener('mouseup', this.onMouseUpBound);
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

  openMultiDateDialog(): void {
    if (!this.selectedBatchId) {
      this.confirmDialog.alert('Select Coaching Batch', 'Please select a coaching batch from the filter deck first.', 'info');
      return;
    }

    const selectedClass = this.classes.find(c => c.id === this.filterForm.get('classId')?.value);

    const ref = this.dialog.open(CoachingMultiDateDialogComponent, {
      width: 'min(1280px, 96vw)',
      maxWidth: '96vw',
      height: '92vh',
      maxHeight: '92vh',
      panelClass: 'coaching-multi-date-dialog-panel',
      data: {
        batchId: this.selectedBatchId,
        batchName: this.selectedBatch?.name || 'Coaching Batch',
        className: selectedClass?.name,
        students: this.students.map(s => ({
          studentId: s.studentId,
          studentName: s.studentName,
          coachingRollNumber: s.coachingRollNumber,
          rollNumber: s.rollNumber,
          admissionNumber: s.admissionNumber,
          profilePhoto: s.profilePhoto
        }))
      }
    });

    ref.afterClosed().subscribe(saved => {
      if (saved) {
        this.loadAttendance();
      }
    });
  }

  openStudentLeaves(): void {
    const dialogRef = this.dialog.open(ApplyStudentLeaveDialogComponent, {
      width: '750px',
      maxWidth: '96vw',
      panelClass: 'erp-custom-dialog',
      data: {
        batchId: this.selectedBatchId || undefined,
        scope: 'coaching'
      }
    });

    dialogRef.afterClosed().subscribe(res => {
      if (res) {
        this.loadAttendance();
      }
    });
  }

  openApplyRegularization(student?: AttendanceStudentRow): void {
    const dialogRef = this.dialog.open(ApplyStudentRegularizationDialogComponent, {
      width: '640px',
      maxWidth: '96vw',
      panelClass: 'erp-custom-dialog',
      data: {
        studentId: student?.studentId || undefined,
        studentName: student?.studentName || undefined,
        batchId: this.selectedBatchId || undefined,
        attendanceDate: this.filterForm.get('date')?.value || undefined,
        scope: 'coaching'
      }
    });

    dialogRef.afterClosed().subscribe(res => {
      if (res) {
        this.loadAttendance();
      }
    });
  }

  onClassChange(classId: string): void {
    this.filterBatchesByClass();
    this.filterForm.patchValue({ batchId: '' });
    this.selectedBatchId = '';
    this.selectedBatch = null;
    this.students = [];
    this.filteredStudents = [];
    this.pagedStudents = [];
    this.cdr.markForCheck();
  }

  filterBatchesByClass(): void {
    let list = [...this.allBatches];
    if (this.batchScope === 'single') {
      list = list.filter(b => !this.isCombinedBatch(b));
    } else if (this.batchScope === 'combined') {
      list = list.filter(b => this.isCombinedBatch(b));
    }

    const selectedClassId = this.filterForm.get('classId')?.value;
    if (selectedClassId && this.batchScope !== 'combined') {
      list = list.filter(b => b.classId === selectedClassId || (this.batchScope === 'all' && !b.classId));
    }
    this.filteredBatches = list;
  }

  onBatchChange(batchId: string): void {
    this.selectedBatchId = batchId;
    this.selectedBatch = this.allBatches.find(b => b.id === batchId) || null;
    this.pageIndex = 0;
    if (batchId) {
      this.loadAttendance();
    } else {
      this.students = [];
      this.filteredStudents = [];
      this.pagedStudents = [];
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
          checkInTime: r.checkInTime || '',
          checkOutTime: r.checkOutTime || '',
          captureSource: r.captureSource || '',
          remarks: r.remarks || '',
          hasPendingRegularization: !!r.hasPendingRegularization,
          pendingRegularizationReason: r.pendingRegularizationReason
        }));
        this.applyLocalFilters();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // Searching & Status Filtering
  clearSearch(): void {
    this.searchTerm = '';
    this.searchControl.setValue('', { emitEvent: false });
    this.applyLocalFilters();
  }

  formatTime12h(timeStr?: string | null): string {
    if (!timeStr) return '';
    const cleaned = timeStr.trim();
    if (cleaned.toUpperCase().includes('AM') || cleaned.toUpperCase().includes('PM')) return cleaned;
    const parts = cleaned.split(':');
    if (parts.length < 2) return cleaned;
    let h = parseInt(parts[0], 10);
    const m = parts[1].substring(0, 2);
    if (isNaN(h)) return cleaned;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }

  onSearchChange(): void {
    this.pageIndex = 0;
    this.applyLocalFilters();
  }

  setStatusFilter(filter: 'ALL' | 'Present' | 'Absent' | 'Late' | 'HalfDay' | 'Leave'): void {
    this.selectedStatusFilter = filter;
    this.pageIndex = 0;
    this.applyLocalFilters();
  }

  applyLocalFilters(): void {
    let list = [...this.students];

    // Status filter
    if (this.selectedStatusFilter !== 'ALL') {
      list = list.filter(s => s.status === this.selectedStatusFilter);
    }

    // Search term filter
    const term = (this.searchTerm || '').trim().toLowerCase();
    if (term) {
      list = list.filter(s =>
        (s.studentName || '').toLowerCase().includes(term) ||
        (s.rollNumber || '').toLowerCase().includes(term) ||
        (s.coachingRollNumber || '').toLowerCase().includes(term) ||
        (s.admissionNumber || '').toLowerCase().includes(term) ||
        (s.parentWhatsAppPhone || '').toLowerCase().includes(term)
      );
    }

    // Sorting
    list.sort((a, b) => {
      let valA: string = '';
      let valB: string = '';
      if (this.sortBy === 'rollNo') {
        valA = a.coachingRollNumber || a.rollNumber || '';
        valB = b.coachingRollNumber || b.rollNumber || '';
      } else if (this.sortBy === 'studentName') {
        valA = a.studentName || '';
        valB = b.studentName || '';
      } else if (this.sortBy === 'status') {
        valA = a.status || '';
        valB = b.status || '';
      }
      const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      return this.sortDesc ? -cmp : cmp;
    });

    this.filteredStudents = list;
    this.updatePagedStudents();
  }

  updatePagedStudents(): void {
    const start = this.pageIndex * this.pageSize;
    const end = start + this.pageSize;
    this.pagedStudents = this.filteredStudents.slice(start, end);
    this.cdr.markForCheck();
  }

  onSortChange(sort: Sort): void {
    this.sortBy = sort.active || 'rollNo';
    this.sortDesc = sort.direction === 'desc';
    this.applyLocalFilters();
  }

  onPageChange(e: PageEvent): void {
    this.pageIndex = e.pageIndex;
    this.pageSize = e.pageSize;
    this.updatePagedStudents();
  }

  // Column Resizing Logic
  startResize(event: MouseEvent, column: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizingCol = column;
    this.startX = event.pageX;
    this.startWidth = this.colWidths[column] || 150;

    window.addEventListener('mousemove', this.onMouseMoveBound);
    window.addEventListener('mouseup', this.onMouseUpBound);
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.resizingCol) return;
    const delta = event.pageX - this.startX;
    const newWidth = Math.max(80, this.startWidth + delta);
    this.colWidths[this.resizingCol] = newWidth;
    this.cdr.markForCheck();
  }

  private onMouseUp(): void {
    this.resizingCol = null;
    window.removeEventListener('mousemove', this.onMouseMoveBound);
    window.removeEventListener('mouseup', this.onMouseUpBound);
  }

  // Status updates
  setStatus(s: AttendanceStudentRow, status: 'Present' | 'Absent' | 'Late' | 'HalfDay' | 'Leave'): void {
    if (!this.canMarkAttendance) return;
    s.status = status;
    this.cdr.markForCheck();
  }

  markAll(status: 'Present' | 'Absent'): void {
    if (!this.canMarkAttendance) return;
    this.students.forEach(s => s.status = status);
    this.applyLocalFilters();
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

  get leaveCount(): number {
    return this.students.filter(s => s.status === 'Leave').length;
  }

  get complianceRate(): number {
    if (this.students.length === 0) return 100;
    const attended = this.presentCount + this.lateCount + (this.halfDayCount * 0.5);
    return Math.round((attended / this.students.length) * 100);
  }

  saveAttendance(): void {
    if (!this.canMarkAttendance || !this.selectedBatchId || this.students.length === 0) return;

    const date = this.filterForm.get('date')?.value;
    const payload = {
      batchId: this.selectedBatchId,
      attendanceDate: date,
      items: this.students.map(s => ({
        studentId: s.studentId,
        status: s.status,
        checkInTime: s.checkInTime || (s.status !== 'Absent' && s.status !== 'Leave' ? (this.selectedBatch?.startTime || '08:30') : null),
        checkOutTime: s.checkOutTime || null,
        remarks: s.remarks || ''
      }))
    };

    this.saving = true;
    this.http.post<any>(`${environment.apiUrl}/students/batch/${this.selectedBatchId}/attendance/bulk`, payload).subscribe({
      next: res => {
        this.saving = false;
        this.confirmDialog.alert('Attendance Saved', `Daily attendance for batch '${this.selectedBatch?.name}' saved successfully.`, 'success');
        this.loadAttendance();
        this.cdr.markForCheck();
      },
      error: err => {
        this.saving = false;
        this.confirmDialog.alert('Save Failed', err.error?.message || 'Failed to save attendance.', 'warning');
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
