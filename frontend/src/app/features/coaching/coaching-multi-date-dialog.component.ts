import { Component, Inject, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { environment } from '../../../environments/environment';

export interface MultiDateStudentRow {
  studentId: string;
  studentName: string;
  coachingRollNumber?: string;
  rollNumber?: string;
  admissionNumber?: string;
  profilePhoto?: string;
  photoFailed?: boolean;
  status: 'Present' | 'Absent' | 'Late' | 'HalfDay' | 'Leave';
  remarks?: string;
  monthMarkedDays?: number;
  monthPresentDays?: number;
  monthAbsentDays?: number;
  monthLeaveDays?: number;
  attendanceRate?: number;
  isLoggedForMonth?: boolean;
}

export interface CoachingMultiDateDialogData {
  batchId: string;
  batchName: string;
  className?: string;
  shift?: string;
  startTime?: string;
  endTime?: string;
  students: MultiDateStudentRow[];
}

export interface CalendarDayItem {
  day: number;
  dateStr: string;
  dateObj: Date;
  isSunday: boolean;
  isHoliday: boolean;
  holidayTitle?: string;
  isFuture: boolean;
  isSelected: boolean;
  isToday: boolean;
  isMarked?: boolean;
  isFullyMarked?: boolean;
  markedCount?: number;
  totalStudents?: number;
  hasLeave?: boolean;
  leaveCount?: number;
  isPending?: boolean;
  isLocked?: boolean;
}

@Component({
  selector: 'app-coaching-multi-date-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatChipsModule,
    MatButtonToggleModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="multi-date-dialog-container">
      <!-- Strict ERP Light Blue Gradient Header -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>date_range</mat-icon>
          </div>
          <div class="header-titles">
            <div class="title-row">
              <h2 mat-dialog-title class="dialog-title">Multi-Date Bulk Attendance (मल्टी-डेट उपस्थिति चयन)</h2>
              <span class="batch-badge">{{ data.batchName }}</span>
            </div>
            <p class="dialog-subtitle">
              Select multiple dates from the Google-style calendar to log attendance for all <strong>{{ students.length }} batch students</strong> in one click.
            </p>
          </div>
        </div>
        <button type="button" class="close-btn" (click)="closeDialog()" [disabled]="saving" mat-icon-button matTooltip="Close (Esc)">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Single Prominent Loading Bar -->
      @if (loading || saving) {
        <mat-progress-bar mode="indeterminate" class="prominent-loader"></mat-progress-bar>
      }

      <mat-dialog-content class="dialog-body">
        <div class="multi-date-layout">
          <!-- Left Column: Google-style Material Calendar Date Picker -->
          <div class="calendar-column">
            <div class="cal-card mat-elevation-z1">
              <!-- Calendar Navigation Header -->
              <div class="cal-nav-bar">
                <button type="button" class="nav-btn" (click)="changeMonth(-1)" mat-icon-button matTooltip="Previous Month">
                  <mat-icon>chevron_left</mat-icon>
                </button>
                <div class="month-title">
                  <mat-icon class="cal-ic">event</mat-icon>
                  <span>{{ monthNames[selectedMonth - 1] }} {{ selectedYear }}</span>
                </div>
                <button type="button" class="nav-btn" (click)="changeMonth(1)" mat-icon-button matTooltip="Next Month">
                  <mat-icon>chevron_right</mat-icon>
                </button>
              </div>

              <!-- Quick Date Selection Presets -->
              <div class="quick-presets">
                <button type="button" class="preset-btn pending-btn" (click)="selectPendingDaysOnly()" [disabled]="pendingDaysCount === 0" matTooltip="Select only un-marked working days up to today">
                  <mat-icon>pending_actions</mat-icon> Pending Only ({{ pendingDaysCount }})
                </button>
                <button type="button" class="preset-btn" (click)="selectAllWorkingDaysUpToToday()">
                  <mat-icon>bolt</mat-icon> All Working Days
                </button>
                <button type="button" class="preset-btn" (click)="selectThisWeek()">
                  <mat-icon>view_week</mat-icon> This Week
                </button>
                <button type="button" class="preset-btn clear" (click)="clearSelection()" [disabled]="selectedDates.size === 0">
                  <mat-icon>clear</mat-icon> Clear ({{ selectedDates.size }})
                </button>
              </div>

              <!-- 7-Column Day Names -->
              <div class="cal-grid-header">
                @for (dName of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; track dName) {
                  <div class="dname-cell" [class.is-sun]="dName === 'Sun'">{{ dName }}</div>
                }
              </div>

              <!-- Calendar Day Cells -->
              <div class="cal-grid-body">
                @for (week of calendarWeeks; track $index) {
                  @for (cell of week; track $index) {
                    <div
                      class="day-cell"
                      [class.cell-empty]="!cell"
                      [class.is-sunday]="cell?.isSunday"
                      [class.is-holiday]="cell?.isHoliday"
                      [class.is-future]="cell?.isFuture"
                      [class.is-locked]="cell?.isLocked"
                      [class.is-selected]="cell && isDateSelected(cell.dateStr)"
                      [class.is-today]="cell?.isToday"
                      [class.is-logged]="cell?.isMarked"
                      [class.is-pending]="cell?.isPending"
                      (click)="toggleDateSelection(cell)">
                      
                      @if (cell) {
                        <div class="day-top">
                          <span class="day-num" [class.today-ring]="cell.isToday">{{ cell.day }}</span>
                          @if (cell && cell.isLocked) {
                            <mat-icon class="lock-mini-ic" matTooltip="Attendance already logged (Locked to prevent duplicate entry)">lock</mat-icon>
                          } @else if (cell && isDateSelected(cell.dateStr)) {
                            <mat-icon class="check-ic">check_circle</mat-icon>
                          }
                        </div>

                        <div class="day-status-indicator">
                          @if (cell.isHoliday) {
                            <span class="hol-tag" [matTooltip]="cell.holidayTitle || 'Declared Holiday'">🎉 {{ cell.holidayTitle || 'Holiday' }}</span>
                          } @else if (cell.isSunday) {
                            <span class="off-tag">Off</span>
                          } @else if (cell.hasLeave) {
                            <span class="leave-tag" [matTooltip]="cell.leaveCount + ' student(s) on approved leave'">🏖️ Leave ({{ cell.leaveCount }})</span>
                          } @else if (cell.isFuture) {
                            <span class="fut-tag">Future</span>
                          } @else if (cell.isLocked) {
                            <span class="logged-tag" [matTooltip]="'Recorded for ' + cell.markedCount + '/' + cell.totalStudents + ' students. Locked to prevent duplicate entry.'">✓ Logged</span>
                          } @else if (isDateSelected(cell.dateStr)) {
                            <span class="sel-tag">Selected</span>
                          } @else if (cell.isMarked) {
                            <span class="partial-tag" [matTooltip]="'Partially recorded: ' + cell.markedCount + '/' + cell.totalStudents + ' students'">⚠ {{ cell.markedCount }}/{{ cell.totalStudents }}</span>
                          } @else if (cell.isPending) {
                            <span class="pending-tag" matTooltip="Attendance not marked yet">Pending</span>
                          }
                        </div>
                      }
                    </div>
                  }
                }
              </div>

              <!-- Mini Legend -->
              <div class="cal-mini-legend">
                <span class="legend-item"><span class="legend-dot locked"></span> 🔒 Logged (Locked)</span>
                <span class="legend-item"><span class="legend-dot pending"></span> Pending</span>
                <span class="legend-item"><span class="legend-dot holiday"></span> 🎉 Holiday</span>
                <span class="legend-item"><span class="legend-dot leave"></span> 🏖️ Leave</span>
                <span class="legend-item"><span class="legend-dot off"></span> Sunday</span>
              </div>
            </div>

            <!-- Selected Dates Strip -->
            <div class="selected-summary-box mat-elevation-z1">
              <div class="sum-header">
                <mat-icon class="sum-ic">checklist</mat-icon>
                <strong>{{ selectedDates.size }} Date(s) Selected</strong>
              </div>
              <div class="chips-wrap">
                @if (selectedDates.size === 0) {
                  <span class="empty-hint">Please click dates on the calendar above or use quick buttons to select dates.</span>
                }
                @for (dStr of sortedSelectedDates; track dStr) {
                  <span class="date-chip">
                    {{ formatDisplayChip(dStr) }}
                    <mat-icon class="remove-chip-ic" (click)="removeDate(dStr); $event.stopPropagation()">close</mat-icon>
                  </span>
                }
              </div>
            </div>
          </div>

          <!-- Right Column: Batch Attendance Controls & Student Roster -->
          <div class="controls-column">
            <mat-card class="settings-card mat-elevation-z1">
              <h3 class="sec-title"><mat-icon>tune</mat-icon> Attendance Configuration</h3>

              <!-- Bulk Mark All Selector -->
              <div class="bulk-mark-strip">
                <label class="lbl">Bulk Mark Status for Selected Dates:</label>
                <div class="status-btn-group">
                  <button type="button" class="bulk-st-btn p" [class.active]="bulkStatus === 'Present'" (click)="setBulkStatus('Present')">
                    <mat-icon>check_circle</mat-icon> Mark All Present (P)
                  </button>
                  <button type="button" class="bulk-st-btn a" [class.active]="bulkStatus === 'Absent'" (click)="setBulkStatus('Absent')">
                    <mat-icon>cancel</mat-icon> Mark All Absent (A)
                  </button>
                  <button type="button" class="bulk-st-btn l" [class.active]="bulkStatus === 'Late'" (click)="setBulkStatus('Late')">
                    <mat-icon>schedule</mat-icon> Mark All Late (L)
                  </button>
                  <button type="button" class="bulk-st-btn hd" [class.active]="bulkStatus === 'HalfDay'" (click)="setBulkStatus('HalfDay')">
                    <mat-icon>timelapse</mat-icon> Mark Half Day (HD)
                  </button>
                </div>
              </div>

              <!-- Shift Timings Preview -->
              <div class="shift-preview-row">
                <div class="meta-field">
                  <span class="m-lbl">Batch Shift</span>
                  <span class="m-val">{{ data.shift || 'Evening' }}</span>
                </div>
                <div class="meta-field">
                  <span class="m-lbl">Check In</span>
                  <span class="m-val">{{ data.startTime || '16:00' }}</span>
                </div>
                <div class="meta-field">
                  <span class="m-lbl">Check Out</span>
                  <span class="m-val">{{ data.endTime || '19:00' }}</span>
                </div>
                <div class="meta-field">
                  <span class="m-lbl">Method</span>
                  <span class="m-val bio"><mat-icon>fingerprint</mat-icon> Auto Sync</span>
                </div>
              </div>
            </mat-card>

            <!-- Student Roster Review -->
            <mat-card class="roster-card mat-elevation-z1">
              <div class="roster-header">
                <div class="roster-title-row">
                  <h3 class="sec-title"><mat-icon>groups</mat-icon> Batch Student Roster ({{ students.length }})</h3>

                  <!-- Student Roster Quick Filter Chips -->
                  <div class="roster-filter-chips">
                    <button type="button" class="rf-chip" [class.active]="studentFilter === 'all'" (click)="setStudentFilter('all')">
                      All ({{ students.length }})
                    </button>
                    <button type="button" class="rf-chip pending" [class.active]="studentFilter === 'pending'" (click)="setStudentFilter('pending')">
                      ⏳ Pending ({{ pendingStudentsCount }})
                    </button>
                    <button type="button" class="rf-chip logged" [class.active]="studentFilter === 'logged'" (click)="setStudentFilter('logged')">
                      ✓ Logged ({{ loggedStudentsCount }})
                    </button>
                    <button type="button" class="rf-chip absent" [class.active]="studentFilter === 'absent'" (click)="setStudentFilter('absent')">
                      ❌ Absent ({{ absentStudentsCount }})
                    </button>
                  </div>
                </div>
                <span class="roster-sub">Customize individual status if any student has a different status across selected dates.</span>
              </div>

              <div class="roster-scroll-list">
                @if (filteredStudents.length === 0) {
                  <div class="empty-roster-state">
                    <mat-icon>filter_list_off</mat-icon>
                    <span>No students match the '{{ studentFilter }}' filter.</span>
                    <button type="button" class="reset-filter-btn" (click)="setStudentFilter('all')">Show All ({{ students.length }})</button>
                  </div>
                }
                @for (s of filteredStudents; track s.studentId) {
                  <div class="roster-item">
                    <div class="st-left">
                      <div class="st-avatar" [style.background]="!s.profilePhoto || s.photoFailed ? getAvatarBg(s.studentName) : '#f1f5f9'">
                        @if (s.profilePhoto && !s.photoFailed) {
                          <img [src]="getPhotoUrl(s.profilePhoto)" (error)="s.photoFailed = true" [alt]="s.studentName" />
                        } @else {
                          <span>{{ getInitials(s.studentName) }}</span>
                        }
                      </div>
                      <div class="st-info">
                        <div class="st-name-row">
                          <span class="st-name">{{ s.studentName }}</span>
                          @if ((s.monthMarkedDays || 0) >= totalElapsedWorkingDays && totalElapsedWorkingDays > 0) {
                            <span class="st-status-tag logged" [matTooltip]="(s.monthMarkedDays || 0) + '/' + totalElapsedWorkingDays + ' working days marked'">
                              <mat-icon class="tag-ic">check_circle</mat-icon> Logged
                            </span>
                          } @else if ((s.monthMarkedDays || 0) > 0) {
                            <span class="st-status-tag partial" [matTooltip]="(s.monthMarkedDays || 0) + '/' + totalElapsedWorkingDays + ' working days marked'">
                              <mat-icon class="tag-ic">timelapse</mat-icon> {{ s.monthMarkedDays }}/{{ totalElapsedWorkingDays }}
                            </span>
                          } @else {
                            <span class="st-status-tag pending" matTooltip="No attendance marked yet this month">
                              <mat-icon class="tag-ic">schedule</mat-icon> Pending
                            </span>
                          }
                        </div>
                        <div class="st-pills">
                          <span class="st-roll">{{ s.coachingRollNumber || s.rollNumber || '—' }}</span>
                          @if (s.admissionNumber) {
                            <span class="st-adm">Adm: {{ s.admissionNumber }}</span>
                          }
                          @if (s.attendanceRate !== undefined && s.attendanceRate > 0) {
                            <span class="st-rate" [class.rate-high]="s.attendanceRate >= 75" [class.rate-low]="s.attendanceRate < 75">
                              {{ s.attendanceRate }}%
                            </span>
                          }
                        </div>
                      </div>
                    </div>

                    <!-- Individual Status Buttons -->
                    <div class="st-status-toggles">
                      <button type="button" class="s-btn p" [class.active]="s.status === 'Present'" (click)="s.status = 'Present'" matTooltip="Present">P</button>
                      <button type="button" class="s-btn a" [class.active]="s.status === 'Absent'" (click)="s.status = 'Absent'" matTooltip="Absent">A</button>
                      <button type="button" class="s-btn l" [class.active]="s.status === 'Late'" (click)="s.status = 'Late'" matTooltip="Late">L</button>
                      <button type="button" class="s-btn hd" [class.active]="s.status === 'HalfDay'" (click)="s.status = 'HalfDay'" matTooltip="Half Day">HD</button>
                      <button type="button" class="s-btn lv" [class.active]="s.status === 'Leave'" (click)="s.status = 'Leave'" matTooltip="Leave">LV</button>
                    </div>
                  </div>
                }
              </div>
            </mat-card>
          </div>
        </div>
      </mat-dialog-content>

      <!-- Dialog Footer -->
      <div class="dialog-footer">
        <div class="footer-left">
          <span class="footer-hint">
            <mat-icon class="hint-ic">info</mat-icon>
            Will record <strong>{{ selectedDates.size * students.length }} total student attendance entries</strong> in Indian Standard Time (IST).
          </span>
        </div>
        <div class="footer-actions">
          <button mat-flat-button class="cancel-btn" (click)="closeDialog()" [disabled]="saving">
            <mat-icon>close</mat-icon>
            Cancel
          </button>
          <button
            mat-flat-button
            color="primary"
            class="save-btn"
            [disabled]="saving || selectedDates.size === 0"
            (click)="saveMultiDateAttendance()">
            <mat-icon>save</mat-icon>
            Save Attendance ({{ selectedDates.size }} Dates)
          </button>
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
      box-sizing: border-box;
    }

    .multi-date-dialog-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      max-height: 92vh;
      background: #ffffff;
      border-radius: 14px;
      overflow: hidden;
      box-sizing: border-box;
    }

    /* Strict ERP Header styling */
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .header-icon-box {
      width: 44px;
      height: 44px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
    }

    .header-icon-box mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .dialog-title {
      margin: 0;
      color: #1e3a8a;
      font-size: 1.22rem;
      font-weight: 700;
      line-height: 1.3;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .batch-badge {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.76rem;
      font-weight: 700;
    }

    .dialog-subtitle {
      margin: 4px 0 0;
      color: #3b82f6;
      font-size: 0.84rem;
    }

    .dialog-subtitle strong {
      color: #1e40af;
    }

    .close-btn {
      color: #64748b;
    }

    .prominent-loader {
      height: 3px;
    }

    /* Body */
    .dialog-body {
      padding: 14px 20px;
      overflow-y: auto;
      overflow-x: hidden;
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-sizing: border-box;
    }

    .multi-date-layout {
      display: grid;
      grid-template-columns: minmax(350px, 420px) minmax(0, 1fr);
      gap: 16px;
      align-items: start;
      width: 100%;
      box-sizing: border-box;
    }

    /* Calendar Column */
    .calendar-column {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
      width: 100%;
      box-sizing: border-box;
    }

    .cal-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-sizing: border-box;
      width: 100%;
    }

    .cal-nav-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .month-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 1.05rem;
      font-weight: 700;
      color: #0f172a;
    }

    .cal-ic {
      color: #2563eb;
    }

    .quick-presets {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
    }

    .preset-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 0.74rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;

      mat-icon { font-size: 14px; width: 14px; height: 14px; color: #2563eb; }

      &:hover {
        background: #e2e8f0;
        border-color: #94a3b8;
      }

      &.clear {
        color: #dc2626;
        border-color: #fecaca;
        background: #fef2f2;
        mat-icon { color: #dc2626; }
      }

      &.pending-btn {
        background: #fff7ed;
        color: #c2410c;
        border-color: #fed7aa;
        mat-icon { color: #ea580c; }
        &:hover {
          background: #ffedd5;
          border-color: #fdba74;
        }
      }
    }

    .cal-grid-header {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      text-align: center;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      gap: 4px;
      width: 100%;
      box-sizing: border-box;
    }

    .dname-cell {
      font-size: 0.74rem;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      &.is-sun { color: #dc2626; }
    }

    .cal-grid-body {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 4px;
      width: 100%;
      box-sizing: border-box;
    }

    .day-cell {
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 6px;
      min-height: 48px;
      padding: 3px 4px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      cursor: pointer;
      transition: all 0.15s ease;
      position: relative;
      min-width: 0;
      box-sizing: border-box;
      overflow: hidden;

      &:hover:not(.cell-empty):not(.is-future):not(.is-locked) {
        border-color: #93c5fd;
        background: #f0fdf4;
      }

      &.cell-empty {
        background: #f8fafc;
        border-color: transparent;
        cursor: default;
      }

      &.is-sunday {
        background: #fff5f5;
        border-color: #fed7d7;
      }

      &.is-logged:not(.is-selected):not(.is-locked) {
        background: #f0fdf4;
        border-color: #bbf7d0;
      }

      &.is-locked {
        background: #f0fdf4 !important;
        border-color: #86efac !important;
        cursor: not-allowed !important;
        opacity: 0.95;
        &:hover {
          background: #f0fdf4 !important;
          border-color: #86efac !important;
        }
      }

      &.is-pending:not(.is-selected) {
        background: #fffbeb;
        border-color: #fde68a;
      }

      &.is-future {
        background: #f8fafc;
        opacity: 0.5;
        cursor: not-allowed;
      }

      &.is-selected {
        background: #eff6ff !important;
        border-color: #2563eb !important;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
        .day-num {
          color: #1d4ed8;
          font-weight: 800;
        }
      }
    }

    .day-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .lock-mini-ic {
      font-size: 13px;
      width: 13px;
      height: 13px;
      color: #16a34a;
    }

    .day-num {
      font-size: 0.8rem;
      font-weight: 700;
      color: #334155;
    }

    .today-ring {
      background: #2563eb;
      color: #ffffff !important;
      width: 20px;
      height: 20px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }

    .check-ic {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #2563eb;
    }

    .day-status-indicator {
      font-size: 0.6rem;
      font-weight: 700;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      overflow: hidden;
    }

    .off-tag { color: #94a3b8; }
    .hol-tag {
      color: #b45309;
      background: #fef3c7;
      padding: 1px 3px;
      border-radius: 3px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: block;
      box-sizing: border-box;
    }
    .fut-tag { color: #cbd5e1; }
    .sel-tag { color: #16a34a; font-weight: 800; }
    .logged-tag {
      color: #15803d;
      background: #dcfce7;
      padding: 1px 3px;
      border-radius: 3px;
      font-weight: 800;
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      box-sizing: border-box;
    }
    .partial-tag {
      color: #b45309;
      background: #fef3c7;
      padding: 1px 3px;
      border-radius: 3px;
      font-weight: 800;
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      box-sizing: border-box;
    }
    .pending-tag {
      color: #c2410c;
      background: #ffedd5;
      padding: 1px 3px;
      border-radius: 3px;
      font-weight: 700;
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      box-sizing: border-box;
    }
    .leave-tag {
      color: #0369a1;
      background: #e0f2fe;
      padding: 1px 3px;
      border-radius: 3px;
      font-weight: 700;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: block;
      box-sizing: border-box;
    }

    .cal-mini-legend {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding-top: 8px;
      margin-top: 4px;
      border-top: 1px solid #f1f5f9;
      font-size: 0.7rem;
      color: #64748b;
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 600;
    }

    .legend-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      display: inline-block;
      &.logged, &.locked { background: #16a34a; }
      &.pending { background: #ea580c; }
      &.holiday { background: #d97706; }
      &.leave { background: #0284c7; }
      &.off { background: #94a3b8; }
    }

    /* Selected Summary Box */
    .selected-summary-box {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      box-sizing: border-box;
      width: 100%;
    }

    .sum-header {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #1e293b;
      font-size: 0.85rem;
    }

    .sum-ic {
      color: #2563eb;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .chips-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      max-height: 110px;
      overflow-y: auto;
    }

    .empty-hint {
      font-size: 0.78rem;
      color: #94a3b8;
    }

    .date-chip {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      padding: 3px 8px;
      font-size: 0.74rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .remove-chip-ic {
      font-size: 14px;
      width: 14px;
      height: 14px;
      cursor: pointer;
      color: #64748b;
      &:hover { color: #dc2626; }
    }

    /* Controls Column */
    .controls-column {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
      width: 100%;
      box-sizing: border-box;
    }

    .settings-card, .roster-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 14px;
      box-sizing: border-box;
      width: 100%;
    }

    .sec-title {
      margin: 0 0 10px;
      font-size: 0.92rem;
      font-weight: 700;
      color: #1e3a8a;
      display: flex;
      align-items: center;
      gap: 6px;
      mat-icon { color: #2563eb; font-size: 18px; width: 18px; height: 18px; }
    }

    .bulk-mark-strip {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 10px;
    }

    .bulk-mark-strip .lbl {
      font-size: 0.78rem;
      font-weight: 600;
      color: #475569;
    }

    .status-btn-group {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 6px;
      width: 100%;
      box-sizing: border-box;
    }

    .bulk-st-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      border-radius: 8px;
      padding: 7px 10px;
      font-size: 0.76rem;
      font-weight: 700;
      cursor: pointer;
      border: 1.5px solid transparent;
      transition: all 0.15s ease;
      white-space: nowrap;
      box-sizing: border-box;
      min-width: 0;

      mat-icon { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; }

      &.p {
        background: #f0fdf4;
        color: #15803d;
        border-color: #bbf7d0;
        &.active, &:hover { background: #16a34a; color: #ffffff; border-color: #16a34a; mat-icon { color: #fff; } }
      }
      &.a {
        background: #fef2f2;
        color: #b91c1c;
        border-color: #fecaca;
        &.active, &:hover { background: #dc2626; color: #ffffff; border-color: #dc2626; mat-icon { color: #fff; } }
      }
      &.l {
        background: #fffbeb;
        color: #b45309;
        border-color: #fde68a;
        &.active, &:hover { background: #d97706; color: #ffffff; border-color: #d97706; mat-icon { color: #fff; } }
      }
      &.hd {
        background: #faf5ff;
        color: #7e22ce;
        border-color: #e9d5ff;
        &.active, &:hover { background: #9333ea; color: #ffffff; border-color: #9333ea; mat-icon { color: #fff; } }
      }
    }

    .shift-preview-row {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      background: #f8fafc;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      box-sizing: border-box;
      width: 100%;
    }

    .meta-field {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .m-lbl {
      font-size: 0.65rem;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
    }

    .m-val {
      font-size: 0.85rem;
      font-weight: 700;
      color: #0f172a;
      &.bio {
        color: #7c3aed;
        display: inline-flex;
        align-items: center;
        gap: 2px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
      }
    }

    /* Roster */
    .roster-header {
      margin-bottom: 12px;
    }

    .roster-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 6px;
    }

    .roster-filter-chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .rf-chip {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #cbd5e1;
      border-radius: 20px;
      padding: 3px 10px;
      font-size: 0.72rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: #e2e8f0;
        border-color: #94a3b8;
      }

      &.active {
        background: #2563eb;
        color: #ffffff;
        border-color: #2563eb;
      }

      &.pending.active {
        background: #ea580c;
        color: #ffffff;
        border-color: #ea580c;
      }

      &.logged.active {
        background: #16a34a;
        color: #ffffff;
        border-color: #16a34a;
      }

      &.absent.active {
        background: #dc2626;
        color: #ffffff;
        border-color: #dc2626;
      }
    }

    .roster-sub {
      font-size: 0.74rem;
      color: #64748b;
      display: block;
    }

    .roster-scroll-list {
      max-height: 380px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 8px 10px;
      background: #fafbfc;
      box-sizing: border-box;
    }

    .roster-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      gap: 10px;
      min-height: 52px;
      box-sizing: border-box;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
      transition: all 0.15s ease;

      &:hover {
        border-color: #cbd5e1;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
      }
    }

    .st-left {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
      min-width: 0;
    }

    .st-avatar {
      width: 36px;
      height: 36px;
      min-width: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.8rem;
      color: #ffffff;
      overflow: hidden;
      flex-shrink: 0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      img { width: 100%; height: 100%; object-fit: cover; }
    }

    .st-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      min-width: 0;
      justify-content: center;
    }

    .st-name-row {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .st-name {
      font-weight: 700;
      color: #0f172a;
      font-size: 0.88rem;
      line-height: 1.25;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .st-status-tag {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 1px 6px;
      border-radius: 5px;
      font-size: 0.68rem;
      font-weight: 700;

      .tag-ic { font-size: 12px; width: 12px; height: 12px; }

      &.logged {
        background: #dcfce7;
        color: #15803d;
        border: 1px solid #bbf7d0;
      }
      &.partial {
        background: #fef3c7;
        color: #b45309;
        border: 1px solid #fde68a;
      }
      &.pending {
        background: #ffedd5;
        color: #c2410c;
        border: 1px solid #fed7aa;
      }
    }

    .st-pills {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .st-roll {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 700;
    }

    .st-adm {
      background: #f8fafc;
      color: #475569;
      border: 1px solid #e2e8f0;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 0.7rem;
    }

    .st-rate {
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 700;
      &.rate-high { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
      &.rate-low { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
    }

    .empty-roster-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      gap: 8px;
      color: #94a3b8;
      font-size: 0.82rem;
      mat-icon { font-size: 28px; width: 28px; height: 28px; color: #cbd5e1; }
    }

    .reset-filter-btn {
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
      &:hover { background: #dbeafe; }
    }

    .st-status-toggles {
      display: inline-flex;
      background: #f1f5f9;
      border-radius: 8px;
      padding: 2px;
      gap: 2px;
      border: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    .s-btn {
      border: none;
      background: transparent;
      padding: 3px 8px;
      min-width: 28px;
      height: 26px;
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 800;
      cursor: pointer;
      color: #64748b;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;

      &:hover:not(.active) {
        background: #e2e8f0;
        color: #1e293b;
      }

      &.p.active { background: #16a34a; color: #ffffff; box-shadow: 0 2px 4px rgba(22, 163, 74, 0.3); }
      &.a.active { background: #dc2626; color: #ffffff; box-shadow: 0 2px 4px rgba(220, 38, 38, 0.3); }
      &.l.active { background: #d97706; color: #ffffff; box-shadow: 0 2px 4px rgba(217, 119, 6, 0.3); }
      &.hd.active { background: #9333ea; color: #ffffff; box-shadow: 0 2px 4px rgba(147, 51, 234, 0.3); }
      &.lv.active { background: #0284c7; color: #ffffff; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.3); }
    }

    /* Dialog Footer */
    .dialog-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 24px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }

    .footer-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      color: #64748b;
    }

    .hint-ic {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #2563eb;
    }

    .footer-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .cancel-btn {
      height: 42px !important;
      padding: 0 22px !important;
      border-radius: 8px !important;
      font-size: 0.88rem !important;
      font-weight: 700 !important;
      border: none !important;
      color: #334155 !important;
      background: #f1f5f9 !important;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08) !important;
      cursor: pointer !important;
      transition: all 0.15s ease !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;

      mat-icon {
        margin-right: 6px;
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #64748b;
      }

      &:hover:not([disabled]) {
        background: #e2e8f0 !important;
        color: #0f172a !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12) !important;
        mat-icon { color: #0f172a; }
      }

      &[disabled] {
        opacity: 0.55 !important;
        box-shadow: none !important;
        cursor: not-allowed !important;
      }
    }

    .save-btn {
      height: 42px !important;
      padding: 0 22px !important;
      border-radius: 8px !important;
      font-size: 0.88rem !important;
      font-weight: 700 !important;
      background: linear-gradient(135deg, #16a34a 0%, #15803d 100%) !important;
      color: #ffffff !important;
      border: none !important;
      box-shadow: 0 4px 6px -1px rgba(22, 163, 74, 0.3) !important;
      cursor: pointer !important;
      transition: all 0.15s ease !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;

      mat-icon { margin-right: 6px; font-size: 18px; width: 18px; height: 18px; }

      &:hover:not([disabled]) {
        background: linear-gradient(135deg, #15803d 0%, #166534 100%) !important;
        box-shadow: 0 6px 12px -2px rgba(22, 163, 74, 0.4) !important;
      }

      &[disabled] {
        opacity: 0.55 !important;
        box-shadow: none !important;
        cursor: not-allowed !important;
      }
    }

    /* ══════════════ RESPONSIVE ADAPTATIONS ══════════════ */
    @media (max-width: 1080px) {
      .multi-date-layout {
        grid-template-columns: 1fr;
      }
      .calendar-column {
        position: static;
      }
    }

    @media (max-width: 640px) {
      .dialog-header {
        padding: 12px 14px;
        position: relative;
        gap: 8px;
      }
      .header-left {
        width: 100%;
        padding-right: 42px;
        box-sizing: border-box;
        min-width: 0;
        align-items: flex-start;
        gap: 10px;
      }
      .header-icon-box {
        width: 34px;
        height: 34px;
        min-width: 34px;
        border-radius: 8px;
        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }
      .title-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
        width: 100%;
      }
      .dialog-title {
        font-size: 0.92rem;
        line-height: 1.3;
        white-space: normal;
        word-break: break-word;
      }
      .batch-badge {
        font-size: 0.68rem;
        padding: 2px 7px;
        display: inline-block;
      }
      .dialog-subtitle {
        font-size: 0.72rem;
        line-height: 1.35;
        margin-top: 3px;
        white-space: normal;
        word-break: break-word;
      }
      .close-btn {
        position: absolute;
        top: 10px;
        right: 8px;
        width: 32px;
        height: 32px;
      }
      .dialog-body {
        padding: 8px 10px 12px;
        gap: 12px;
      }
      .calendar-column {
        position: static;
        width: 100%;
      }
      .cal-card {
        padding: 10px 6px;
        width: 100%;
        box-sizing: border-box;
      }
      .quick-presets {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 4px;
      }
      .preset-btn {
        padding: 5px 4px;
        font-size: 0.68rem;
        gap: 3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        mat-icon { font-size: 13px; width: 13px; height: 13px; }
      }
      .cal-grid-header {
        gap: 2px;
      }
      .dname-cell {
        font-size: 0.65rem;
        padding: 2px 0;
      }
      .cal-grid-body {
        gap: 2px;
      }
      .day-cell {
        min-height: 48px;
        padding: 2px;
        border-radius: 6px;
      }
      .day-top {
        margin-bottom: 1px;
      }
      .day-num {
        font-size: 0.72rem;
      }
      .today-ring {
        width: 17px;
        height: 17px;
      }
      .lock-mini-ic {
        font-size: 11px;
        width: 11px;
        height: 11px;
      }
      .check-ic {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }
      .day-status-indicator {
        font-size: 0.52rem;
        line-height: 1.1;
      }
      .logged-tag, .partial-tag, .pending-tag, .leave-tag, .sel-tag, .fut-tag, .hol-tag, .off-tag {
        font-size: 0.52rem;
        padding: 1px 2px;
        text-align: center;
        border-radius: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cal-mini-legend {
        font-size: 0.64rem;
        gap: 6px;
        padding-top: 6px;
      }
      .controls-column {
        width: 100%;
        gap: 12px;
      }
      .settings-card, .roster-card {
        padding: 12px 10px;
        width: 100%;
        box-sizing: border-box;
      }
      .bulk-st-btn {
        padding: 6px 10px;
        font-size: 0.74rem;
        mat-icon { font-size: 15px; width: 15px; height: 15px; }
      }
      .shift-preview-row {
        gap: 8px;
        padding: 8px 10px;
      }
      .roster-title-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }
      .roster-filter-chips {
        width: 100%;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .rf-chip {
        padding: 2px 8px;
        font-size: 0.68rem;
      }
      .roster-scroll-list {
        max-height: 400px;
        padding: 8px 6px;
        gap: 10px;
      }
      .roster-item {
        flex-direction: column;
        align-items: stretch;
        padding: 12px 12px;
        min-height: auto;
        gap: 10px;
      }
      .st-left {
        width: 100%;
        gap: 12px;
        align-items: flex-start;
      }
      .st-avatar {
        width: 40px;
        height: 40px;
        min-width: 40px;
        font-size: 0.82rem;
      }
      .st-info {
        width: 100%;
        gap: 6px;
      }
      .st-name-row {
        gap: 6px;
        width: 100%;
      }
      .st-name {
        font-size: 0.92rem;
      }
      .st-status-tag {
        font-size: 0.68rem;
        padding: 2px 7px;
      }
      .st-pills {
        gap: 6px;
        width: 100%;
      }
      .st-roll, .st-adm, .st-rate {
        font-size: 0.7rem;
        padding: 2px 7px;
      }
      .st-status-toggles {
        width: 100%;
        display: flex;
        padding: 3px;
        gap: 3px;
        box-sizing: border-box;
      }
      .s-btn {
        flex: 1;
        padding: 6px 0;
        min-width: 0;
        height: 32px;
        font-size: 0.74rem;
        font-weight: 700;
        text-align: center;
      }
      .dialog-footer {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        padding: 10px 14px;
      }
      .footer-left {
        width: 100%;
      }
      .footer-hint {
        display: block;
        font-size: 0.72rem;
        line-height: 1.35;
        text-align: center;
        .hint-ic {
          vertical-align: sub;
          font-size: 15px;
          width: 15px;
          height: 15px;
        }
      }
      .footer-actions {
        width: 100%;
        display: flex;
        gap: 8px;
        align-items: center;
        button {
          flex: 1;
          height: 40px !important;
          padding: 0 10px !important;
          font-size: 0.8rem !important;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }
    }
  `]
})
export class CoachingMultiDateDialogComponent implements OnInit {
  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();

  monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  holidays: any[] = [];
  calendarWeeks: (CalendarDayItem | null)[][] = [];
  selectedDates = new Set<string>();
  daysStatusMap: { [day: number]: { totalStudents: number; markedCount: number; leaveCount: number; presentCount: number; absentCount: number } } = {};

  students: MultiDateStudentRow[] = [];
  bulkStatus: 'Present' | 'Absent' | 'Late' | 'HalfDay' = 'Present';
  studentFilter: 'all' | 'pending' | 'logged' | 'absent' = 'all';

  loading = false;
  saving = false;

  constructor(
    public dialogRef: MatDialogRef<CoachingMultiDateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CoachingMultiDateDialogData,
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Clone students array so changes don't mutate parent until saved
    this.students = (this.data.students || []).map(s => ({
      ...s,
      status: s.status || 'Present',
      remarks: s.remarks || '',
      monthMarkedDays: 0,
      monthPresentDays: 0,
      monthAbsentDays: 0,
      monthLeaveDays: 0,
      attendanceRate: 0,
      isLoggedForMonth: false
    }));

    this.loadHolidaysAndExistingAttendance();
  }

  get sortedSelectedDates(): string[] {
    return Array.from(this.selectedDates).sort();
  }

  get totalElapsedWorkingDays(): number {
    let count = 0;
    for (const week of this.calendarWeeks) {
      for (const cell of week) {
        if (cell && !cell.isSunday && !cell.isHoliday && !cell.isFuture) {
          count++;
        }
      }
    }
    return count;
  }

  get pendingDaysCount(): number {
    let count = 0;
    for (const week of this.calendarWeeks) {
      for (const cell of week) {
        if (cell?.isPending) count++;
      }
    }
    return count;
  }

  get pendingStudentsCount(): number {
    const totalDays = this.totalElapsedWorkingDays;
    return this.students.filter(s => (s.monthMarkedDays || 0) < totalDays).length;
  }

  get loggedStudentsCount(): number {
    const totalDays = this.totalElapsedWorkingDays;
    return this.students.filter(s => (s.monthMarkedDays || 0) >= totalDays && totalDays > 0).length;
  }

  get absentStudentsCount(): number {
    return this.students.filter(s => s.status === 'Absent' || (s.monthAbsentDays || 0) > 0).length;
  }

  get filteredStudents(): MultiDateStudentRow[] {
    const totalDays = this.totalElapsedWorkingDays;
    if (this.studentFilter === 'pending') {
      return this.students.filter(s => (s.monthMarkedDays || 0) < totalDays);
    }
    if (this.studentFilter === 'logged') {
      return this.students.filter(s => (s.monthMarkedDays || 0) >= totalDays && totalDays > 0);
    }
    if (this.studentFilter === 'absent') {
      return this.students.filter(s => s.status === 'Absent' || (s.monthAbsentDays || 0) > 0);
    }
    return this.students;
  }

  setStudentFilter(f: 'all' | 'pending' | 'logged' | 'absent'): void {
    this.studentFilter = f;
    this.cdr.markForCheck();
  }

  isDateSelected(dStr: string): boolean {
    return this.selectedDates.has(dStr);
  }

  toggleDateSelection(cell: CalendarDayItem | null): void {
    // Lock dates that are already logged or in future to prevent duplicate entry
    if (!cell || cell.isFuture || cell.isLocked) return;
    if (this.selectedDates.has(cell.dateStr)) {
      this.selectedDates.delete(cell.dateStr);
    } else {
      this.selectedDates.add(cell.dateStr);
    }
    this.cdr.markForCheck();
  }

  removeDate(dStr: string): void {
    this.selectedDates.delete(dStr);
    this.cdr.markForCheck();
  }

  clearSelection(): void {
    this.selectedDates.clear();
    this.cdr.markForCheck();
  }

  selectPendingDaysOnly(): void {
    this.selectedDates.clear();
    for (const week of this.calendarWeeks) {
      for (const cell of week) {
        if (cell && cell.isPending) {
          this.selectedDates.add(cell.dateStr);
        }
      }
    }
    this.cdr.markForCheck();
  }

  selectAllWorkingDaysUpToToday(): void {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const daysInMonth = new Date(this.selectedYear, this.selectedMonth, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dt = new Date(this.selectedYear, this.selectedMonth - 1, day);
      const isSun = dt.getDay() === 0;
      const ymd = `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      // Skip future dates
      if (ymd > todayStr) continue;

      // Skip Sunday
      if (isSun) continue;

      // Skip holidays
      const isH = this.holidays.some(h => {
        const start = (h.startDate || '').split('T')[0];
        const end = (h.endDate || h.startDate || '').split('T')[0];
        return ymd >= start && ymd <= end;
      });
      if (isH) continue;

      // Skip already logged / locked dates to prevent duplicate entry
      const stInfo = this.daysStatusMap[day];
      if (stInfo && stInfo.markedCount > 0) continue;

      this.selectedDates.add(ymd);
    }
    this.cdr.markForCheck();
  }

  selectThisWeek(): void {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const curDay = today.getDay(); // 0 is Sun
    const sunOffset = curDay; // days from Sunday
    const sundayDate = new Date(today);
    sundayDate.setDate(today.getDate() - sunOffset);

    for (let i = 1; i <= 6; i++) { // Mon to Sat
      const target = new Date(sundayDate);
      target.setDate(sundayDate.getDate() + i);

      // Only within current selected month
      if (target.getMonth() + 1 !== this.selectedMonth || target.getFullYear() !== this.selectedYear) continue;

      const ymd = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
      if (ymd > todayStr) continue;

      // Skip already logged / locked dates
      const stInfo = this.daysStatusMap[target.getDate()];
      if (stInfo && stInfo.markedCount > 0) continue;

      this.selectedDates.add(ymd);
    }
    this.cdr.markForCheck();
  }

  setBulkStatus(st: 'Present' | 'Absent' | 'Late' | 'HalfDay'): void {
    this.bulkStatus = st;
    this.students.forEach(s => s.status = st);
    this.cdr.markForCheck();
  }

  changeMonth(delta: number): void {
    let m = this.selectedMonth + delta;
    let y = this.selectedYear;
    if (m < 1) { m = 12; y--; }
    else if (m > 12) { m = 1; y++; }
    this.selectedMonth = m;
    this.selectedYear = y;
    this.loadHolidaysAndExistingAttendance();
  }

  loadHolidaysAndExistingAttendance(): void {
    this.loading = true;
    this.cdr.markForCheck();

    const holidays$ = this.http.get<any[]>(`${environment.apiUrl}/holidays?activeOnly=true`);
    const reportUrl = `${environment.apiUrl}/students/attendance/report?month=${this.selectedMonth}&year=${this.selectedYear}&batchId=${this.data.batchId}&stream=coaching`;
    const report$ = this.http.get<any>(reportUrl);

    forkJoin({
      holidays: holidays$.pipe(catchError(() => of([]))),
      report: report$.pipe(catchError(() => of({ rows: [] })))
    }).subscribe({
      next: ({ holidays, report }) => {
        this.holidays = holidays || [];
        this.processAttendanceReport(report);
        this.loading = false;
        this.buildCalendarGrid();
      },
      error: () => {
        this.holidays = [];
        this.daysStatusMap = {};
        this.loading = false;
        this.buildCalendarGrid();
      }
    });
  }

  private processAttendanceReport(report: any): void {
    this.daysStatusMap = {};
    const rows: any[] = report?.rows || [];
    const daysInMonth = new Date(this.selectedYear, this.selectedMonth, 0).getDate();
    const total = rows.length > 0 ? rows.length : this.students.length;

    for (let day = 1; day <= daysInMonth; day++) {
      let marked = 0;
      let leave = 0;
      let present = 0;
      let absent = 0;

      rows.forEach(r => {
        if (r.dailyStatuses) {
          const statuses = r.dailyStatuses.split(',');
          const st = statuses[day - 1];
          if (st && st !== '-' && st !== 'Off') {
            marked++;
            if (st === 'P') present++;
            else if (st === 'A') absent++;
            else if (st === 'LV') leave++;
          }
        }
      });

      this.daysStatusMap[day] = {
        totalStudents: total,
        markedCount: marked,
        leaveCount: leave,
        presentCount: present,
        absentCount: absent
      };
    }

    // Populate student-level statistics
    this.students.forEach(st => {
      const match = rows.find((r: any) => r.personId === st.studentId);
      if (match) {
        st.monthMarkedDays = (match.presentDays || 0) + (match.absentDays || 0) + (match.lateDays || 0) + (match.halfDays || 0);
        st.monthPresentDays = match.presentDays || 0;
        st.monthAbsentDays = match.absentDays || 0;
        st.monthLeaveDays = match.leaveDays || 0;
        st.attendanceRate = match.attendancePercentage || 0;
        st.isLoggedForMonth = (st.monthMarkedDays || 0) > 0;
      }
    });
  }

  buildCalendarGrid(): void {
    const daysInMonth = new Date(this.selectedYear, this.selectedMonth, 0).getDate();
    const firstDayOfWeek = new Date(this.selectedYear, this.selectedMonth - 1, 1).getDay();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const weeks: (CalendarDayItem | null)[][] = [];
    let currentWeek: (CalendarDayItem | null)[] = Array(firstDayOfWeek).fill(null);

    for (let day = 1; day <= daysInMonth; day++) {
      const curDate = new Date(this.selectedYear, this.selectedMonth - 1, day);
      const isSun = curDate.getDay() === 0;
      const ymd = `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const matchedH = this.holidays.find(h => {
        const start = (h.startDate || '').split('T')[0];
        const end = (h.endDate || h.startDate || '').split('T')[0];
        return ymd >= start && ymd <= end;
      });

      const isFuture = ymd > todayStr;
      const isToday = ymd === todayStr;

      const statusInfo = this.daysStatusMap[day] || {
        totalStudents: this.students.length,
        markedCount: 0,
        leaveCount: 0,
        presentCount: 0,
        absentCount: 0
      };

      const isMarked = statusInfo.markedCount > 0;
      const isFullyMarked = statusInfo.totalStudents > 0 && statusInfo.markedCount >= statusInfo.totalStudents;
      const hasLeave = statusInfo.leaveCount > 0;
      const isPending = !isMarked && !isSun && !matchedH && !isFuture;
      const isLocked = isMarked; // Lock dates where attendance is already recorded to prevent duplicate entry

      const item: CalendarDayItem = {
        day,
        dateStr: ymd,
        dateObj: curDate,
        isSunday: isSun,
        isHoliday: !!matchedH,
        holidayTitle: matchedH ? (matchedH.title || matchedH.name) : undefined,
        isFuture,
        isSelected: this.selectedDates.has(ymd),
        isToday,
        isMarked,
        isFullyMarked,
        markedCount: statusInfo.markedCount,
        totalStudents: statusInfo.totalStudents,
        hasLeave,
        leaveCount: statusInfo.leaveCount,
        isPending,
        isLocked
      };

      currentWeek.push(item);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }

    this.calendarWeeks = weeks;
    this.cdr.markForCheck();
  }

  formatDisplayChip(dStr: string): string {
    const parts = dStr.split('-');
    if (parts.length === 3) {
      const d = parseInt(parts[2], 10);
      const m = parseInt(parts[1], 10);
      return `${d} ${this.monthNames[m - 1].slice(0, 3)} ${parts[0]}`;
    }
    return dStr;
  }

  saveMultiDateAttendance(): void {
    if (this.selectedDates.size === 0) {
      this.confirmDialog.alert('No Dates Selected', 'Please select at least one date from the calendar to save attendance.', 'warning');
      return;
    }

    const payload = {
      batchId: this.data.batchId,
      attendanceDates: Array.from(this.selectedDates),
      sendWhatsAppAlerts: false,
      items: this.students.map(s => ({
        studentId: s.studentId,
        status: s.status,
        checkInTime: this.data.startTime || '16:00',
        checkOutTime: this.data.endTime || '19:00',
        remarks: s.remarks || 'Multi-Date Bulk Entry'
      }))
    };

    this.saving = true;
    this.cdr.markForCheck();

    this.http.post<any>(`${environment.apiUrl}/students/batch/${this.data.batchId}/attendance/multi-dates`, payload).subscribe({
      next: (res) => {
        this.saving = false;
        this.confirmDialog.alert(
          'Multi-Date Attendance Saved',
          res?.message || `Successfully recorded attendance for ${this.students.length} students across ${this.selectedDates.size} date(s).`,
          'success'
        );
        this.dialogRef.close({ saved: true, datesCount: this.selectedDates.size });
      },
      error: (err) => {
        this.saving = false;
        this.confirmDialog.alert('Error Saving Attendance', err?.error?.message || 'Failed to record multi-date attendance.', 'warning');
        this.cdr.markForCheck();
      }
    });
  }

  getPhotoUrl(photoPath: string): string {
    if (!photoPath) return '';
    if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) return photoPath;
    const base = environment.apiBaseUrl?.replace(/\/$/, '') || 'http://localhost:5000';
    const cleanPath = photoPath.startsWith('/') ? photoPath : `/${photoPath}`;
    return `${base}${cleanPath}`;
  }

  getInitials(name: string): string {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  getAvatarBg(name: string): string {
    const colors = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#059669', '#0284c7', '#4f46e5', '#d97706'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  closeDialog(): void {
    this.dialogRef.close();
  }
}
