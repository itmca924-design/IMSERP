import { Component, Inject, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApplyStudentRegularizationDialogComponent } from '../students/student-regularization-dialog.component';
import { ApplyStudentLeaveDialogComponent } from '../students/student-leaves.component';
import { environment } from '../../../environments/environment';

export interface CalendarStudentOption {
  studentId: string;
  studentName: string;
  coachingRollNumber?: string;
  rollNumber?: string;
  admissionNumber?: string;
  profilePhoto?: string;
  photoFailed?: boolean;
}

export interface CoachingAttendanceCalendarDialogData {
  batchId: string;
  batchName: string;
  className?: string;
  shift?: string;
  startTime?: string;
  endTime?: string;
  students: CalendarStudentOption[];
  initialStudentId?: string;
  initialMonth?: number;
  initialYear?: number;
}

export interface CalendarDayRecord {
  day: number;
  dayOfWeek: string;
  dateStr: string;
  isSunday: boolean;
  holidayTitle?: string;
  status: 'P' | 'A' | 'L' | 'HD' | 'LV' | 'H' | 'Off' | '-';
  statusFull: string;
  checkInTime?: string;
  checkOutTime?: string;
  workDuration?: string;
  captureSource?: string;
  isBiometric: boolean;
  remarks?: string;
  isRegularized?: boolean;
  hasPendingRegularization?: boolean;
  pendingRegularizationReason?: string;
  canRegularize?: boolean;
}

export interface BatchRegisterRow {
  studentId: string;
  studentName: string;
  rollNumber: string;
  profilePhoto?: string;
  photoFailed?: boolean;
  days: { [day: number]: string };
  presentCount: number;
  absentCount: number;
  lateCount: number;
  halfDayCount: number;
  leaveCount: number;
  attendanceRate: number;
}

@Component({
  selector: 'app-coaching-attendance-calendar-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCardModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatChipsModule,
    MatButtonToggleModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="calendar-dialog-container">
      <!-- Strict ERP Light Blue Gradient Header matching AGENTS.md rule -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>calendar_month</mat-icon>
          </div>
          <div class="header-titles">
            <div class="title-row">
              <h2 mat-dialog-title class="dialog-title">Monthly Attendance Calendar (मासिक उपस्थिति कैलेंडर)</h2>
              <span class="live-biometric-pill">
                <mat-icon class="pulse-dot">fingerprint</mat-icon> Biometric Push Sync Active
              </span>
            </div>
            <p class="dialog-subtitle">
              Batch: <strong>{{ data.batchName }}</strong>
              @if (data.className) { &bull; Class: <strong>{{ data.className }}</strong> }
              @if (data.shift) { &bull; Shift: <strong>{{ data.shift }} ({{ data.startTime || '08:00' }} - {{ data.endTime || '12:00' }})</strong> }
            </p>
          </div>
        </div>
        <button type="button" class="close-btn" (click)="closeDialog()" mat-icon-button matTooltip="Close (Esc)">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Single Prominent Loading Bar -->
      @if (loading) {
        <mat-progress-bar mode="indeterminate" class="prominent-loader"></mat-progress-bar>
      }

      <mat-dialog-content class="dialog-body">
        <!-- Top Control Deck: View Switcher, Student Selector & Month/Year Navigation -->
        <div class="control-deck">
          <div class="deck-left">
            <!-- View Mode Switcher -->
            <div class="view-mode-toggle">
              <button
                type="button"
                class="mode-btn"
                [class.active]="viewMode === 'calendar'"
                (click)="switchViewMode('calendar')">
                <mat-icon>calendar_view_month</mat-icon>
                <span>Google Calendar View</span>
              </button>
              <button
                type="button"
                class="mode-btn"
                [class.active]="viewMode === 'register'"
                (click)="switchViewMode('register')">
                <mat-icon>table_chart</mat-icon>
                <span>Batch Register Matrix</span>
              </button>
            </div>

            <!-- Student Selector (in Calendar View) -->
            @if (viewMode === 'calendar') {
              <div class="student-select-box">
                <mat-form-field appearance="outline" class="student-dropdown-field" subscriptSizing="dynamic">
                  <mat-label>Select Batch Student</mat-label>
                  <mat-select [value]="selectedStudentId" (selectionChange)="onStudentChange($event.value)">
                    @for (s of data.students; track s.studentId) {
                      <mat-option [value]="s.studentId">
                        <div class="student-option-row">
                          <span class="opt-roll">{{ s.coachingRollNumber || s.rollNumber || '—' }}</span>
                          <span class="opt-name">{{ s.studentName }}</span>
                        </div>
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <!-- Next / Previous Student Quick Nav -->
                <div class="student-nav-buttons">
                  <button mat-icon-button (click)="navigateStudent(-1)" matTooltip="Previous Student" [disabled]="isFirstStudent">
                    <mat-icon>chevron_left</mat-icon>
                  </button>
                  <button mat-icon-button (click)="navigateStudent(1)" matTooltip="Next Student" [disabled]="isLastStudent">
                    <mat-icon>chevron_right</mat-icon>
                  </button>
                </div>
              </div>
            }
          </div>

          <!-- Month & Year Navigation (IST) -->
          <div class="deck-right">
            <div class="month-nav-group">
              <button mat-icon-button (click)="changeMonth(-1)" matTooltip="Previous Month" class="nav-arrow-btn">
                <mat-icon>chevron_left</mat-icon>
              </button>

              <div class="current-month-badge">
                <mat-icon class="cal-mini-icon">event</mat-icon>
                <span class="month-text">{{ monthNames[selectedMonth - 1] }} {{ selectedYear }}</span>
              </div>

              <button mat-icon-button (click)="changeMonth(1)" matTooltip="Next Month" class="nav-arrow-btn">
                <mat-icon>chevron_right</mat-icon>
              </button>

              @if (!isCurrentMonth) {
                <button mat-stroked-button (click)="goToToday()" class="today-jump-btn">
                  Today
                </button>
              }

              <button mat-icon-button (click)="refreshData()" matTooltip="Refresh Attendance" class="refresh-btn">
                <mat-icon>sync</mat-icon>
              </button>
            </div>
          </div>
        </div>

        <!-- ================= MODE A: INDIVIDUAL STUDENT GOOGLE CALENDAR VIEW ================= -->
        @if (viewMode === 'calendar') {
          <!-- Selected Student Profile & Summary Strip -->
          @if (currentStudent) {
            <div class="student-hero-banner">
              <div class="hero-left">
                <div class="student-avatar" [style.background]="!currentStudent.profilePhoto || currentStudent.photoFailed ? getAvatarBg(currentStudent.studentName) : '#e2e8f0'">
                  @if (currentStudent.profilePhoto && !currentStudent.photoFailed) {
                    <img [src]="getPhotoUrl(currentStudent.profilePhoto)" (error)="currentStudent.photoFailed = true" [alt]="currentStudent.studentName" />
                  } @else {
                    <span>{{ getInitials(currentStudent.studentName) }}</span>
                  }
                </div>
                <div class="student-meta">
                  <div class="name-line">
                    <span class="student-display-name">{{ currentStudent.studentName }}</span>
                    <span class="roll-pill">{{ currentStudent.coachingRollNumber || currentStudent.rollNumber || 'No Roll' }}</span>
                    @if (currentStudent.admissionNumber) {
                      <span class="adm-pill">Adm: {{ currentStudent.admissionNumber }}</span>
                    }
                  </div>
                  <div class="sub-line">
                    <span>Batch: {{ data.batchName }}</span>
                    <span>&bull;</span>
                    <span>Coaching Division</span>
                    <span>&bull;</span>
                    <span class="ist-tag">Timezone: IST (UTC+05:30)</span>
                  </div>
                </div>
              </div>

              <!-- Top KPI Metrics -->
              <div class="hero-kpis">
                <div class="kpi-mini-card total">
                  <span class="kpi-num">{{ totalWorkingDays }}</span>
                  <span class="kpi-lbl">Working Days</span>
                </div>
                <div class="kpi-mini-card present">
                  <span class="kpi-num text-green">{{ presentDays }}</span>
                  <span class="kpi-lbl">Present (P)</span>
                </div>
                <div class="kpi-mini-card absent">
                  <span class="kpi-num text-red">{{ absentDays }}</span>
                  <span class="kpi-lbl">Absent (A)</span>
                </div>
                <div class="kpi-mini-card late">
                  <span class="kpi-num text-amber">{{ lateDays + halfDays }}</span>
                  <span class="kpi-lbl">Late / Half (L)</span>
                </div>
                <div class="kpi-mini-card rate">
                  <span class="kpi-num text-blue">{{ attendanceRate }}%</span>
                  <span class="kpi-lbl">Attendance Rate</span>
                </div>
                <div class="kpi-mini-card bio">
                  <span class="kpi-num text-purple">{{ biometricPunchCount }}</span>
                  <span class="kpi-lbl">Bio Punches</span>
                </div>
              </div>
            </div>
          }

          <!-- Google Calendar 7-Column Grid (Responsive Scroll-Wrapped) -->
          <div class="calendar-scroll-wrap">
            <div class="google-calendar-card mat-elevation-z1">
            <!-- Day of Week Header Strip -->
            <div class="cal-days-header">
              @for (dayName of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; track dayName) {
                <div class="header-day-cell" [class.is-sun]="dayName === 'Sun'">
                  {{ dayName }}
                </div>
              }
            </div>

            <!-- Calendar Cells Grid -->
            <div class="cal-days-grid">
              @for (week of calendarWeeks; track $index; let weekIdx = $index) {
                @for (cell of week; track $index; let colIdx = $index) {
                  <div
                    class="cal-day-cell"
                    [class.cell-empty]="!cell"
                    [class.is-sunday]="cell?.isSunday"
                    [class.is-today]="cell && isCellToday(cell.day)"
                    [class.has-punch]="cell && (cell.checkInTime || cell.checkOutTime)"
                    [class.status-p]="cell?.status === 'P'"
                    [class.status-a]="cell?.status === 'A'"
                    [class.status-l]="cell?.status === 'L'"
                    [class.status-hd]="cell?.status === 'HD'"
                    [class.status-lv]="cell?.status === 'LV'"
                    [class.status-off]="cell?.status === 'Off'"
                    (click)="onDayCellClick(cell)">
                    
                    @if (cell) {
                      <!-- Cell Top Bar: Date Number + Sunday / Holiday Label + Mini Status Badges -->
                      <div class="cell-top-bar">
                        <div class="top-bar-left">
                          <span class="day-number" [class.today-circle]="isCellToday(cell.day)">{{ cell.day }}</span>
                          @if (cell.isSunday) {
                            <span class="off-tag">Sunday</span>
                          } @else if (cell.holidayTitle) {
                            <span class="holiday-tag" [matTooltip]="cell.holidayTitle">🎉 {{ cell.holidayTitle }}</span>
                          }
                        </div>
                        <div class="top-bar-right">
                          @if (cell.isRegularized) {
                            <span class="source-tag reg-tag" [matTooltip]="cell.remarks || 'Regularized Attendance'" matTooltipPosition="above" matTooltipClass="cal-note-tooltip">
                              <mat-icon class="tag-ic">verified</mat-icon>
                              <span class="tag-txt">REG</span>
                            </span>
                          }
                          @if (cell.hasPendingRegularization) {
                            <span class="source-tag pending-reg-tag" [matTooltip]="'Regularization Pending Review: ' + (cell.pendingRegularizationReason || 'Awaiting Review')" matTooltipPosition="above" matTooltipClass="cal-note-tooltip">
                              <mat-icon class="tag-ic">hourglass_top</mat-icon>
                              <span class="tag-txt">PENDING</span>
                            </span>
                          }
                          @if (cell.isBiometric) {
                            <span class="source-tag bio-tag" [matTooltip]="getBiometricTooltip(cell)" matTooltipPosition="above" matTooltipClass="cal-note-tooltip">
                              <mat-icon class="tag-ic">fingerprint</mat-icon>
                              <span class="tag-txt">BIO</span>
                            </span>
                          }
                          @if (cell.remarks && !cell.isRegularized) {
                            <span class="source-tag note-tag" [matTooltip]="cell.remarks" matTooltipPosition="above" matTooltipClass="cal-note-tooltip">
                              <mat-icon class="tag-ic">sticky_note_2</mat-icon>
                              @if (!cell.isBiometric) {
                                <span class="tag-txt">NOTE</span>
                              }
                            </span>
                          }
                        </div>
                      </div>

                      <!-- Status Event Chip (Google Calendar Event Style) -->
                      <div class="status-event-wrap">
                        @if (cell.status === 'P') {
                          <div class="event-chip chip-present">
                            <span class="chip-dot"></span>
                            <span class="chip-text">Present</span>
                          </div>
                        } @else if (cell.status === 'A') {
                          <div class="event-chip chip-absent">
                            <span class="chip-dot"></span>
                            <span class="chip-text">Absent</span>
                          </div>
                        } @else if (cell.status === 'L') {
                          <div class="event-chip chip-late">
                            <span class="chip-dot"></span>
                            <span class="chip-text">Late</span>
                          </div>
                        } @else if (cell.status === 'HD') {
                          <div class="event-chip chip-half">
                            <span class="chip-dot"></span>
                            <span class="chip-text">Half Day</span>
                          </div>
                        } @else if (cell.status === 'LV') {
                          <div class="event-chip chip-leave" [matTooltip]="cell.remarks || 'Sanctioned Student Leave'">
                            <span class="chip-dot"></span>
                            <span class="chip-text">🏖️ Leave</span>
                          </div>
                        } @else if (cell.status === 'Off') {
                          <div class="event-chip chip-off">
                            <span class="chip-text">Weekly Off</span>
                          </div>
                        } @else if (cell.status === 'H' || cell.holidayTitle) {
                          <div class="event-chip chip-holiday" [matTooltip]="cell.holidayTitle">
                            <span class="chip-text">🎉 {{ cell.holidayTitle }}</span>
                          </div>
                        } @else {
                          <div class="event-chip chip-unmarked">
                            <span class="dash">&bull;</span>
                          </div>
                        }
                      </div>

                      <!-- Interactive Regularize Action for Past Missed/Absent Punch -->
                      @if (cell.canRegularize) {
                        <button type="button" class="reg-btn-cell" (click)="openRegularizeDialog(cell, $event)" matTooltip="Biometric punch missed or marked absent. Click to apply attendance regularization.">
                          <mat-icon class="reg-btn-ic">edit_calendar</mat-icon>
                          <span>Regularize</span>
                        </button>
                      }

                      <!-- Compact Shift & Punch Timing Pill -->
                      @if (cell.checkInTime || cell.checkOutTime) {
                        <div class="cell-time-pill" [class.bio-time-pill]="cell.isBiometric">
                          <mat-icon class="time-ic">{{ cell.isBiometric ? 'fingerprint' : 'schedule' }}</mat-icon>
                          <span class="time-txt">
                            @if (cell.checkInTime && cell.checkOutTime) {
                              {{ formatTime(cell.checkInTime) }} - {{ formatTime(cell.checkOutTime) }}
                            } @else if (cell.checkInTime) {
                              In {{ formatTime(cell.checkInTime) }}
                            } @else {
                              Out {{ formatTime(cell.checkOutTime) }}
                            }
                          </span>
                          @if (cell.isBiometric) {
                            <span class="mini-bio-label">BIO</span>
                          }
                        </div>
                      }
                    }
                  </div>
                }
              }
            </div>
          </div>
        </div>
      }

        <!-- ================= MODE B: BATCH MONTHLY REGISTER MATRIX ================= -->
        @if (viewMode === 'register') {
          <mat-card class="register-matrix-card mat-elevation-z1">
            <div class="register-toolbar">
              <div class="reg-title-wrap">
                <mat-icon class="reg-icon">table_chart</mat-icon>
                <div>
                  <h3 class="reg-title">Batch Attendance Register & Compliance Matrix</h3>
                  <p class="reg-subtitle">Day-by-day status overview for all {{ data.students.length }} students in {{ data.batchName }}.</p>
                </div>
              </div>
              <div class="reg-legend">
                <span class="legend-item"><span class="dot p"></span> P: Present</span>
                <span class="legend-item"><span class="dot a"></span> A: Absent</span>
                <span class="legend-item"><span class="dot l"></span> L: Late</span>
                <span class="legend-item"><span class="dot hd"></span> HD: Half Day</span>
                <span class="legend-item"><span class="dot lv"></span> LV: Leave</span>
                <span class="legend-item"><span class="dot hol"></span> H: Holiday</span>
                <span class="legend-item"><span class="dot off"></span> Off: Sunday</span>
              </div>
            </div>

            <div class="table-responsive register-scroll-container">
              <table class="batch-matrix-table">
                <thead>
                  <tr>
                    <th class="col-sticky col-roll">Roll No</th>
                    <th class="col-sticky col-name">Student Name</th>
                    @for (d of daysInMonthArray; track d) {
                      <th class="col-day" [class.is-sun-head]="isSunday(d)" [class.is-hol-head]="isHoliday(d)" [matTooltip]="getHolidayTitle(d) || ''">
                        <span class="d-num">{{ d }}</span>
                        <span class="d-dow">{{ isHoliday(d) ? '🎉' : getDayOfWeekShort(d) }}</span>
                      </th>
                    }
                    <th class="col-stat col-p">P</th>
                    <th class="col-stat col-a">A</th>
                    <th class="col-stat col-l">L/HD</th>
                    <th class="col-stat col-lv">LV</th>
                    <th class="col-stat col-rate">Rate %</th>
                    <th class="col-stat col-action">Calendar</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of batchRegisterRows; track row.studentId) {
                    <tr class="student-matrix-row">
                      <td class="col-sticky col-roll">
                        <span class="matrix-roll-pill">{{ row.rollNumber }}</span>
                      </td>
                      <td class="col-sticky col-name">
                        <div class="matrix-student-info">
                          <div class="mini-avatar" [style.background]="!row.profilePhoto || row.photoFailed ? getAvatarBg(row.studentName) : '#f1f5f9'">
                            @if (row.profilePhoto && !row.photoFailed) {
                              <img [src]="getPhotoUrl(row.profilePhoto)" (error)="row.photoFailed = true" [alt]="row.studentName" />
                            } @else {
                              <span>{{ getInitials(row.studentName) }}</span>
                            }
                          </div>
                          <span class="st-name">{{ row.studentName }}</span>
                        </div>
                      </td>

                      @for (d of daysInMonthArray; track d) {
                        <td class="col-day-cell" [class.is-sun-cell]="isSunday(d)" [class.is-hol-cell]="isHoliday(d)">
                          <span class="matrix-badge status-{{ (row.days[d] || '-').toLowerCase() }}">
                            {{ row.days[d] || '—' }}
                          </span>
                        </td>
                      }

                      <td class="col-stat col-p text-green"><strong>{{ row.presentCount }}</strong></td>
                      <td class="col-stat col-a text-red"><strong>{{ row.absentCount }}</strong></td>
                      <td class="col-stat col-l text-amber"><strong>{{ row.lateCount + row.halfDayCount }}</strong></td>
                      <td class="col-stat col-lv text-blue"><strong>{{ row.leaveCount }}</strong></td>
                      <td class="col-stat col-rate">
                        <span class="compliance-chip" [class.comp-high]="row.attendanceRate >= 80" [class.comp-mid]="row.attendanceRate >= 50 && row.attendanceRate < 80" [class.comp-low]="row.attendanceRate < 50">
                          {{ row.attendanceRate }}%
                        </span>
                      </td>
                      <td class="col-stat col-action">
                        <button mat-icon-button (click)="openStudentInCalendar(row.studentId)" matTooltip="Open Google Calendar for {{ row.studentName }}">
                          <mat-icon class="cal-link-ic">calendar_month</mat-icon>
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </mat-card>
        }
      </mat-dialog-content>

      <!-- Dialog Footer -->
      <div class="dialog-footer">
        <div class="footer-left">
          <span class="footer-note">
            <mat-icon class="info-ic">info</mat-icon>
            All timestamps and shifts are synchronized in Indian Standard Time (IST - Asia/Kolkata).
          </span>
          <div class="footer-legends">
            <span class="legend-pill bio"><mat-icon>fingerprint</mat-icon> <strong>BIO</strong>: Biometric Push (Hikvision)</span>
            <span class="legend-pill note"><mat-icon>sticky_note_2</mat-icon> <strong>NOTE</strong>: Manual / Bulk Entry</span>
          </div>
        </div>
        <div class="footer-actions">
          <button mat-stroked-button class="leave-btn-footer" (click)="openApplyLeaveDialog()" matTooltip="Apply student leave for {{ currentStudent?.studentName || 'batch student' }}">
            <mat-icon>beach_access</mat-icon> Apply Student Leave
          </button>
          <button mat-flat-button color="primary" (click)="closeDialog()">Close</button>
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

    .calendar-dialog-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      max-height: 94vh;
      background: #ffffff;
      border-radius: 14px;
      overflow: hidden;
      box-sizing: border-box;
    }

    /* Strict ERP Header styling matching generate-invoices-dialog */
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      flex-shrink: 0;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-icon-box {
      width: 38px;
      height: 38px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
    }

    .header-icon-box mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .dialog-title {
      margin: 0;
      color: #1e3a8a;
      font-size: 1.15rem;
      font-weight: 700;
      line-height: 1.3;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .live-biometric-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.72rem;
      font-weight: 600;
      background: #e0e7ff;
      color: #3730a3;
      padding: 2px 8px;
      border-radius: 12px;
      border: 1px solid #c7d2fe;
    }

    .live-biometric-pill .pulse-dot {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: #4f46e5;
    }

    .dialog-subtitle {
      margin: 3px 0 0;
      color: #3b82f6;
      font-size: 0.82rem;
    }

    .dialog-subtitle strong {
      color: #1e40af;
    }

    .close-btn {
      color: #64748b;
      transition: color 0.15s ease;
    }

    .close-btn:hover {
      color: #1e293b;
    }

    .prominent-loader {
      height: 3px;
    }

    /* Dialog Body */
    .dialog-body {
      padding: 10px 18px 14px;
      flex: 1 1 auto;
      min-height: 0;
      max-height: none !important;
      overflow-y: auto !important;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-sizing: border-box;
      scrollbar-width: thin;
      scrollbar-color: #94a3b8 #f1f5f9;
    }

    .dialog-body::-webkit-scrollbar {
      width: 7px;
    }
    .dialog-body::-webkit-scrollbar-track {
      background: #f1f5f9;
      border-radius: 4px;
    }
    .dialog-body::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }
    .dialog-body::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }

    /* Control Deck */
    .control-deck {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      background: #f8fafc;
      padding: 6px 12px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    .deck-left {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .view-mode-toggle {
      display: flex;
      background: #e2e8f0;
      border-radius: 8px;
      padding: 3px;
      gap: 3px;
    }

    .mode-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      background: transparent;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.82rem;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .mode-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .mode-btn.active {
      background: #ffffff;
      color: #1d4ed8;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .student-select-box {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .student-dropdown-field {
      width: 260px;
    }

    .student-option-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .opt-roll {
      background: #eff6ff;
      color: #1d4ed8;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 700;
      border: 1px solid #bfdbfe;
    }

    .opt-name {
      font-weight: 500;
    }

    .student-nav-buttons {
      display: flex;
      gap: 2px;
    }

    .deck-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .month-nav-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .current-month-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .cal-mini-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #2563eb;
    }

    .month-text {
      font-weight: 700;
      color: #1e293b;
      font-size: 0.95rem;
    }

    .nav-arrow-btn, .refresh-btn {
      color: #475569;
    }

    .today-jump-btn {
      font-size: 0.8rem;
      font-weight: 600;
      color: #2563eb;
      border-color: #bfdbfe;
    }

    /* Student Hero Banner */
    .student-hero-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      flex-wrap: wrap;
      flex-shrink: 0;
    }

    .hero-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .student-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.95rem;
      color: #ffffff;
      overflow: hidden;
      flex-shrink: 0;
      border: 2px solid #ffffff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .student-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .name-line {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .student-display-name {
      font-size: 0.98rem;
      font-weight: 700;
      color: #0f172a;
    }

    .roll-pill {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      padding: 1px 6px;
      border-radius: 10px;
      font-size: 0.72rem;
      font-weight: 700;
    }

    .adm-pill {
      background: #f1f5f9;
      color: #475569;
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 0.68rem;
    }

    .sub-line {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 1px;
    }

    .ist-tag {
      color: #0284c7;
      font-weight: 500;
    }

    .hero-kpis {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .kpi-mini-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 3px 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 52px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    }

    .kpi-num {
      font-size: 0.95rem;
      font-weight: 800;
      line-height: 1.1;
    }

    .kpi-lbl {
      font-size: 0.58rem;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.3px;
    }

    .text-green { color: #16a34a; }
    .text-red { color: #dc2626; }
    .text-amber { color: #d97706; }
    .text-blue { color: #2563eb; }
    .text-purple { color: #7c3aed; }

    /* ================= GOOGLE CALENDAR CARD ================= */
    .google-calendar-card {
      background: #ffffff;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .cal-days-header {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }

    .header-day-cell {
      padding: 6px 8px;
      text-align: center;
      font-size: 0.78rem;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .header-day-cell.is-sun {
      color: #dc2626;
      background: #fef2f2;
    }

    .cal-days-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 1px;
      background: #e2e8f0;
    }

    .cal-day-cell {
      background: #ffffff;
      min-height: 60px;
      padding: 3px 5px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      position: relative;
      cursor: pointer;
      transition: background 0.12s ease;
      box-sizing: border-box;
    }

    .cal-day-cell:hover {
      background: #f8fafc;
    }

    .cal-day-cell.cell-empty {
      background: #fafafa;
      cursor: default;
    }

    .cal-day-cell.is-sunday {
      background: #fffafa;
    }

    .cell-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    }

    .top-bar-left {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .top-bar-right {
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .mini-status-ic {
      font-size: 13px;
      width: 13px;
      height: 13px;
    }

    .mini-status-ic.bio {
      color: #6366f1;
    }

    .mini-status-ic.note {
      color: #f59e0b;
    }

    .day-number {
      font-size: 0.8rem;
      font-weight: 700;
      color: #334155;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }

    .day-number.today-circle {
      background: #2563eb;
      color: #ffffff;
      font-weight: 800;
    }

    .off-tag {
      font-size: 0.62rem;
      color: #94a3b8;
      font-weight: 600;
    }

    .holiday-tag {
      font-size: 0.62rem;
      color: #d97706;
      font-weight: 600;
      background: #fef3c7;
      padding: 1px 4px;
      border-radius: 3px;
      max-width: 75px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Event Chip (Google Style) */
    .status-event-wrap {
      display: flex;
      width: 100%;
    }

    .event-chip {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 0.68rem;
      font-weight: 700;
      width: 100%;
      box-sizing: border-box;
      line-height: 1.2;
    }

    .chip-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .chip-present {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }
    .chip-present .chip-dot { background: #16a34a; }

    .chip-absent {
      background: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fecaca;
    }
    .chip-absent .chip-dot { background: #dc2626; }

    .chip-late {
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fde68a;
    }
    .chip-late .chip-dot { background: #d97706; }

    .chip-half {
      background: #f3e8ff;
      color: #7e22ce;
      border: 1px solid #e9d5ff;
    }
    .chip-half .chip-dot { background: #9333ea; }

    .chip-leave {
      background: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }
    .chip-leave .chip-dot { background: #0284c7; }

    .chip-off {
      background: #f1f5f9;
      color: #64748b;
      font-size: 0.67rem;
    }

    .chip-holiday {
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fde68a;
      font-weight: 700;
      font-size: 0.68rem;
      padding: 1px 5px;
      border-radius: 4px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chip-unmarked {
      color: #cbd5e1;
      font-size: 0.72rem;
      padding: 0 3px;
    }

    /* Single-line Compact Shift & Timing Pill */
    .cell-time-pill {
      display: flex;
      align-items: center;
      gap: 3px;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #dbeafe;
      border-radius: 3px;
      padding: 1px 4px;
      font-size: 0.65rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 1px;
    }

    .cell-time-pill .time-ic {
      font-size: 11px;
      width: 11px;
      height: 11px;
      flex-shrink: 0;
      color: #3b82f6;
    }

    .cell-time-pill .time-txt {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Responsive Scroll Wrapper for Google Calendar Grid */
    .calendar-scroll-wrap {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: 10px;
    }

    /* Source Tags: BIO and NOTE badges */
    .source-tag {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 1px 4px;
      border-radius: 4px;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.3px;
      cursor: pointer;
      transition: all 0.15s ease;
      line-height: 1;
    }

    .source-tag:hover {
      transform: scale(1.1);
    }

    .source-tag .tag-ic {
      font-size: 11px;
      width: 11px;
      height: 11px;
    }

    /* Biometric Badge (Purple / Indigo) */
    .source-tag.bio-tag {
      background: #ede9fe;
      color: #6366f1;
      border: 1px solid #c4b5fd;
    }
    .source-tag.bio-tag:hover {
      background: #ddd6fe;
      color: #4f46e5;
    }

    /* Manual Note Badge (Amber / Gold) */
    .source-tag.note-tag {
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fde68a;
    }
    .source-tag.note-tag:hover {
      background: #fde047;
      color: #92400e;
    }

    /* Regularized Attendance Badge (Emerald Green) */
    .source-tag.reg-tag {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #86efac;
    }
    .source-tag.reg-tag:hover {
      background: #bbf7d0;
      color: #166534;
    }

    /* Regularization Pending Review Badge (Amber) */
    .source-tag.pending-reg-tag {
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fde68a;
    }
    .source-tag.pending-reg-tag:hover {
      background: #fde047;
      color: #92400e;
    }

    /* In-Cell Regularize Action Button */
    .reg-btn-cell {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: #eff6ff;
      color: #2563eb;
      border: 1px dashed #93c5fd;
      border-radius: 4px;
      padding: 1px 5px;
      font-size: 0.65rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.12s ease;
      margin-top: 2px;
      width: fit-content;
      line-height: 1.2;

      .reg-btn-ic {
        font-size: 11px;
        width: 11px;
        height: 11px;
      }

      &:hover {
        background: #2563eb;
        color: #ffffff;
        border-color: #2563eb;
      }
    }

    /* Biometric Time Pill Accent */
    .cell-time-pill.bio-time-pill {
      background: #f5f3ff;
      border-color: #ddd6fe;
      color: #5b21b6;
    }
    .cell-time-pill.bio-time-pill .time-ic {
      color: #7c3aed;
    }
    .mini-bio-label {
      background: #7c3aed;
      color: #ffffff;
      font-size: 0.55rem;
      font-weight: 800;
      padding: 0 3px;
      border-radius: 3px;
      margin-left: 2px;
      letter-spacing: 0.4px;
    }

    /* ================= REGISTER MATRIX TABLE (MODE B) ================= */
    .register-matrix-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
    }

    .register-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .reg-title-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .reg-icon {
      color: #2563eb;
    }

    .reg-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: #1e293b;
    }

    .reg-subtitle {
      margin: 2px 0 0;
      font-size: 0.78rem;
      color: #64748b;
    }

    .reg-legend {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      color: #475569;
    }

    .legend-item .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .legend-item .dot.p { background: #16a34a; }
    .legend-item .dot.a { background: #dc2626; }
    .legend-item .dot.l { background: #d97706; }
    .legend-item .dot.hd { background: #9333ea; }
    .legend-item .dot.lv { background: #0284c7; }
    .legend-item .dot.hol { background: #d97706; }
    .legend-item .dot.off { background: #94a3b8; }

    .register-scroll-container {
      max-height: 500px;
      width: 100%;
      overflow-x: auto;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-sizing: border-box;
    }

    .batch-matrix-table {
      min-width: 100%;
      width: max-content;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 0.8rem;
    }

    .batch-matrix-table th, .batch-matrix-table td {
      padding: 8px 6px;
      text-align: center;
      border-bottom: 1px solid #f1f5f9;
      border-right: 1px solid #f1f5f9;
      white-space: nowrap;
    }

    .batch-matrix-table th {
      background: #f8fafc;
      font-weight: 700;
      color: #334155;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .col-sticky {
      position: sticky;
      z-index: 5;
      background: #ffffff;
      text-align: left !important;
    }

    .col-roll {
      left: 0;
      width: 90px;
      min-width: 90px;
    }

    .col-name {
      left: 90px;
      min-width: 160px;
      border-right: 2px solid #cbd5e1 !important;
    }

    th.col-roll, th.col-name {
      z-index: 15 !important;
      background: #f1f5f9 !important;
    }

    .matrix-roll-pill {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.72rem;
      font-weight: 700;
    }

    .matrix-student-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .mini-avatar {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.7rem;
      color: #ffffff;
      overflow: hidden;
      flex-shrink: 0;
    }

    .mini-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .st-name {
      font-weight: 600;
      color: #0f172a;
    }

    .col-day {
      min-width: 32px;
      padding: 4px 2px !important;
    }

    .col-day .d-num {
      display: block;
      font-weight: 700;
    }

    .col-day .d-dow {
      display: block;
      font-size: 0.65rem;
      color: #64748b;
    }

    .is-sun-head {
      background: #fef2f2 !important;
      color: #b91c1c !important;
    }

    .is-hol-head {
      background: #fef3c7 !important;
      color: #b45309 !important;
      .d-dow { color: #d97706; font-weight: 800; }
    }

    .is-sun-cell {
      background: #fffafa;
    }

    .is-hol-cell {
      background: #fffbeb;
    }

    .matrix-badge {
      display: inline-block;
      width: 22px;
      height: 22px;
      line-height: 22px;
      text-align: center;
      border-radius: 4px;
      font-weight: 700;
      font-size: 0.7rem;
    }

    .matrix-badge.status-p { background: #dcfce7; color: #15803d; }
    .matrix-badge.status-a { background: #fee2e2; color: #b91c1c; }
    .matrix-badge.status-l { background: #fef3c7; color: #b45309; }
    .matrix-badge.status-hd { background: #f3e8ff; color: #7e22ce; }
    .matrix-badge.status-lv { background: #e0f2fe; color: #0369a1; }
    .matrix-badge.status-h { background: #fef3c7; color: #b45309; }
    .matrix-badge.status-off { background: #f1f5f9; color: #94a3b8; }
    .matrix-badge.status-- { color: #cbd5e1; }

    .compliance-chip {
      padding: 2px 6px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 0.72rem;
    }

    .comp-high { background: #dcfce7; color: #15803d; }
    .comp-mid { background: #fef3c7; color: #b45309; }
    .comp-low { background: #fee2e2; color: #b91c1c; }

    .cal-link-ic {
      color: #2563eb;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    /* Dialog Footer */
    .dialog-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 18px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    .footer-left {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }

    .footer-note {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      color: #64748b;
    }

    .info-ic {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #3b82f6;
    }

    .footer-legends {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .legend-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.72rem;
      mat-icon { font-size: 13px; width: 13px; height: 13px; }
      strong { font-weight: 700; }
    }

    .legend-pill.bio {
      background: #ede9fe;
      color: #5b21b6;
      border: 1px solid #c4b5fd;
    }

    .legend-pill.note {
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
    }

    .footer-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .leave-btn-footer {
      color: #0284c7 !important;
      border-color: #bae6fd !important;
      background: #f0f9ff !important;
      font-weight: 600;
      mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
      &:hover {
        background: #e0f2fe !important;
        border-color: #7dd3fc !important;
      }
    }

    /* ══════════════ RESPONSIVE ADAPTATIONS (MOBILE & TABLET) ══════════════ */
    @media (max-width: 900px) {
      .control-deck {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }
      .deck-left, .deck-right {
        width: 100%;
        justify-content: space-between;
      }
      .student-select-box {
        flex: 1;
      }
      .student-dropdown-field {
        width: 100%;
      }
      .hero-kpis {
        width: 100%;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
      }
    }

    @media (max-width: 640px) {
      .dialog-header {
        padding: 10px 12px;
        gap: 8px;
        position: relative;
      }
      .header-left {
        width: 100%;
        padding-right: 42px;
        box-sizing: border-box;
        min-width: 0;
        align-items: flex-start;
      }
      .header-titles {
        min-width: 0;
        flex: 1;
      }
      .header-icon-box {
        width: 32px;
        height: 32px;
        min-width: 32px;
        border-radius: 8px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
      .dialog-title {
        font-size: 0.92rem;
        line-height: 1.25;
        white-space: normal;
        word-break: break-word;
      }
      .live-biometric-pill {
        display: none;
      }
      .dialog-subtitle {
        font-size: 0.72rem;
        margin-top: 2px;
        white-space: normal;
        word-break: break-word;
        max-width: 100%;
      }
      .close-btn {
        position: absolute;
        top: 8px;
        right: 8px;
      }
      .dialog-body {
        padding: 8px 10px 14px;
        gap: 8px;
      }
      .view-mode-toggle {
        width: 100%;
        .mode-btn {
          flex: 1;
          justify-content: center;
          padding: 6px 8px;
          font-size: 0.74rem;
        }
      }
      .student-hero-banner {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        padding: 8px 10px;
      }
      .hero-left {
        width: 100%;
        gap: 8px;
        align-items: flex-start;
      }
      .student-meta {
        width: 100%;
        flex: 1;
        min-width: 0;
      }
      .name-line {
        flex-wrap: wrap;
        gap: 4px;
      }
      .sub-line {
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        font-size: 0.72rem;
        span:nth-child(2), span:nth-child(4) {
          display: none;
        }
      }
      .hero-kpis {
        width: 100%;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 4px;
      }
      .kpi-mini-card {
        min-width: auto;
        width: 100%;
        padding: 3px 4px;
        box-sizing: border-box;
      }
      .kpi-num {
        font-size: 0.88rem;
      }
      .kpi-lbl {
        font-size: 0.55rem;
      }
      .google-calendar-card {
        min-width: 620px;
      }
      .cal-day-cell {
        min-height: 58px;
        padding: 2px 4px;
      }
      .header-day-cell {
        padding: 6px 4px;
        font-size: 0.74rem;
      }
      .col-roll {
        width: 70px !important;
        min-width: 70px !important;
      }
      .col-name {
        left: 70px !important;
        min-width: 120px !important;
      }
      .dialog-footer {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        padding: 8px 12px;
      }
      .footer-left {
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
        width: 100%;
      }
      .footer-note {
        font-size: 0.68rem;
        line-height: 1.3;
      }
      .footer-legends {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        width: 100%;
      }
      .legend-pill {
        font-size: 0.68rem;
        padding: 1px 6px;
      }
      .footer-actions {
        width: 100%;
        button {
          width: 100%;
          height: 38px;
          border-radius: 8px;
          font-weight: 700;
        }
      }
    }
  `]
})
export class CoachingAttendanceCalendarDialogComponent implements OnInit {
  viewMode: 'calendar' | 'register' = 'calendar';
  selectedStudentId = '';
  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();

  monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  loading = false;
  holidays: any[] = [];
  studentAttendanceRecords: any[] = [];
  studentRegularizations: any[] = [];
  calendarWeeks: (CalendarDayRecord | null)[][] = [];

  // Summary Metrics
  totalWorkingDays = 0;
  presentDays = 0;
  absentDays = 0;
  lateDays = 0;
  halfDays = 0;
  leaveDays = 0;
  attendanceRate = 0;
  biometricPunchCount = 0;

  // Batch Register Data
  daysInMonthArray: number[] = [];
  batchRegisterRows: BatchRegisterRow[] = [];

  constructor(
    public dialogRef: MatDialogRef<CoachingAttendanceCalendarDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CoachingAttendanceCalendarDialogData,
    private http: HttpClient,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.data.initialMonth) this.selectedMonth = this.data.initialMonth;
    if (this.data.initialYear) this.selectedYear = this.data.initialYear;

    if (this.data.initialStudentId) {
      this.selectedStudentId = this.data.initialStudentId;
    } else if (this.data.students && this.data.students.length > 0) {
      this.selectedStudentId = this.data.students[0].studentId;
    }

    this.loadHolidaysAndData();
  }

  get currentStudent(): CalendarStudentOption | undefined {
    return this.data.students.find(s => s.studentId === this.selectedStudentId);
  }

  get isFirstStudent(): boolean {
    if (!this.data.students.length) return true;
    return this.data.students[0].studentId === this.selectedStudentId;
  }

  get isLastStudent(): boolean {
    if (!this.data.students.length) return true;
    return this.data.students[this.data.students.length - 1].studentId === this.selectedStudentId;
  }

  get isCurrentMonth(): boolean {
    const now = new Date();
    return this.selectedMonth === (now.getMonth() + 1) && this.selectedYear === now.getFullYear();
  }

  switchViewMode(mode: 'calendar' | 'register'): void {
    this.viewMode = mode;
    if (mode === 'register' && this.batchRegisterRows.length === 0) {
      this.loadBatchRegisterMatrix();
    }
    this.cdr.markForCheck();
  }

  onStudentChange(studentId: string): void {
    this.selectedStudentId = studentId;
    this.loadStudentCalendar();
  }

  navigateStudent(delta: number): void {
    const idx = this.data.students.findIndex(s => s.studentId === this.selectedStudentId);
    if (idx >= 0) {
      const nextIdx = idx + delta;
      if (nextIdx >= 0 && nextIdx < this.data.students.length) {
        this.selectedStudentId = this.data.students[nextIdx].studentId;
        this.loadStudentCalendar();
      }
    }
  }

  openStudentInCalendar(studentId: string): void {
    this.selectedStudentId = studentId;
    this.viewMode = 'calendar';
    this.loadStudentCalendar();
  }

  changeMonth(delta: number): void {
    let m = this.selectedMonth + delta;
    let y = this.selectedYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    this.selectedMonth = m;
    this.selectedYear = y;
    this.refreshData();
  }

  goToToday(): void {
    const now = new Date();
    this.selectedMonth = now.getMonth() + 1;
    this.selectedYear = now.getFullYear();
    this.refreshData();
  }

  refreshData(): void {
    if (this.viewMode === 'calendar') {
      this.loadStudentCalendar();
    } else {
      this.loadBatchRegisterMatrix();
    }
  }

  loadHolidaysAndData(): void {
    this.http.get<any[]>(`${environment.apiUrl}/holidays?activeOnly=true`).subscribe({
      next: (h) => {
        this.holidays = h || [];
        this.loadStudentCalendar();
      },
      error: () => {
        this.holidays = [];
        this.loadStudentCalendar();
      }
    });
  }

  loadStudentCalendar(): void {
    if (!this.selectedStudentId) {
      this.calendarWeeks = [];
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    const attUrl = `${environment.apiUrl}/students/${this.selectedStudentId}/attendance?month=${this.selectedMonth}&year=${this.selectedYear}&stream=coaching`;
    const regUrl = `${environment.apiUrl}/student-regularizations?studentId=${this.selectedStudentId}&month=${this.selectedMonth}&year=${this.selectedYear}`;

    forkJoin({
      records: this.http.get<any[]>(attUrl).pipe(catchError(() => of([]))),
      regularizations: this.http.get<any[]>(regUrl).pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ records, regularizations }) => {
        this.studentAttendanceRecords = records || [];
        this.studentRegularizations = regularizations || [];
        this.buildCalendarGrid();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.studentAttendanceRecords = [];
        this.studentRegularizations = [];
        this.buildCalendarGrid();
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  buildCalendarGrid(): void {
    const daysInMonth = new Date(this.selectedYear, this.selectedMonth, 0).getDate();
    const firstDayOfWeek = new Date(this.selectedYear, this.selectedMonth - 1, 1).getDay(); // 0 = Sun

    const dayMap: { [day: number]: any } = {};
    for (const r of this.studentAttendanceRecords) {
      if (r.attendanceDate) {
        const dt = new Date(r.attendanceDate);
        dayMap[dt.getDate()] = r;
      }
    }

    const regMap: { [day: number]: any } = {};
    for (const reg of this.studentRegularizations) {
      if (reg.attendanceDate) {
        const dt = new Date(reg.attendanceDate);
        regMap[dt.getDate()] = reg;
      }
    }

    const weeks: (CalendarDayRecord | null)[][] = [];
    let currentWeek: (CalendarDayRecord | null)[] = Array(firstDayOfWeek).fill(null);

    // Reset metrics
    this.totalWorkingDays = 0;
    this.presentDays = 0;
    this.absentDays = 0;
    this.lateDays = 0;
    this.halfDays = 0;
    this.leaveDays = 0;
    this.biometricPunchCount = 0;

    const wdNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayYmd = this.getIstTodayYmd();

    for (let day = 1; day <= daysInMonth; day++) {
      const curDate = new Date(this.selectedYear, this.selectedMonth - 1, day);
      const isSun = curDate.getDay() === 0;
      const ymd = `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      // Check Holiday
      const matchedH = this.holidays.find(h => {
        const start = (h.startDate || '').split('T')[0];
        const end = (h.endDate || h.startDate || '').split('T')[0];
        return ymd >= start && ymd <= end;
      });

      const holidayTitle = matchedH ? (matchedH.title || matchedH.name) : undefined;
      const rec = dayMap[day];

      let status: 'P' | 'A' | 'L' | 'HD' | 'LV' | 'H' | 'Off' | '-' = '-';
      let statusFull = 'Unmarked';
      let inTime: string | undefined;
      let outTime: string | undefined;
      let duration: string | undefined;
      let captureSource: string | undefined;
      let remarks: string | undefined;
      let isBio = false;

      if (rec) {
        inTime = rec.checkInTime;
        outTime = rec.checkOutTime;
        captureSource = rec.captureSource;
        remarks = rec.remarks;

        const csLower = (captureSource || '').toLowerCase();
        const mbLower = (rec.markedBy || '').toLowerCase();
        if (
          csLower.includes('hikvision') ||
          csLower.includes('biometric') ||
          csLower.includes('rfid') ||
          csLower.includes('device') ||
          csLower.includes('terminal') ||
          mbLower.includes('biometric') ||
          mbLower.includes('hikvision')
        ) {
          isBio = true;
          this.biometricPunchCount++;
        }

        const rawStatus = (rec.status || '').toLowerCase();
        if (rawStatus === 'present' || rawStatus === 'p') {
          status = 'P';
          statusFull = 'Present';
          this.presentDays++;
        } else if (rawStatus === 'absent' || rawStatus === 'a') {
          status = 'A';
          statusFull = 'Absent';
          this.absentDays++;
        } else if (rawStatus === 'late' || rawStatus === 'l') {
          status = 'L';
          statusFull = 'Late Mark';
          this.lateDays++;
        } else if (rawStatus === 'halfday' || rawStatus === 'hd') {
          status = 'HD';
          statusFull = 'Half Day';
          this.halfDays++;
        } else if (rawStatus === 'leave' || rawStatus === 'lv') {
          status = 'LV';
          statusFull = 'Leave';
          this.leaveDays++;
        }

        if (inTime && outTime) {
          duration = this.calculateDuration(inTime, outTime);
        }
      } else if (isSun) {
        status = 'Off';
        statusFull = 'Sunday (Weekly Off)';
      } else if (holidayTitle) {
        status = 'H';
        statusFull = `Holiday: ${holidayTitle}`;
      }

      if (!isSun && !holidayTitle) {
        this.totalWorkingDays++;
      }

      const regInfo = regMap[day];
      const isRegPending = regInfo?.status === 'Pending';
      const isRegApproved = regInfo?.status === 'Approved';
      const isRegularized = (captureSource === 'Regularization') || isRegApproved;
      const hasPendingRegularization = isRegPending;
      const pendingRegularizationReason = isRegPending ? regInfo?.reason : undefined;

      const isPastDate = ymd < todayYmd;
      const canRegularize = isPastDate && !isSun && !holidayTitle && (status === 'A' || status === '-') && !hasPendingRegularization && !isRegularized;

      const dayItem: CalendarDayRecord = {
        day,
        dayOfWeek: wdNames[curDate.getDay()],
        dateStr: ymd,
        isSunday: isSun,
        holidayTitle,
        status,
        statusFull,
        checkInTime: inTime,
        checkOutTime: outTime,
        workDuration: duration,
        captureSource,
        isBiometric: isBio,
        remarks,
        isRegularized,
        hasPendingRegularization,
        pendingRegularizationReason,
        canRegularize
      };

      currentWeek.push(dayItem);
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

    // Calculate Attendance %
    const attended = this.presentDays + this.lateDays + (this.halfDays * 0.5);
    const markedTotal = this.presentDays + this.absentDays + this.lateDays + this.halfDays;
    this.attendanceRate = markedTotal > 0 ? Math.round((attended / markedTotal) * 100) : 0;
  }

  loadBatchRegisterMatrix(): void {
    this.loading = true;
    this.cdr.markForCheck();

    const daysInMonth = new Date(this.selectedYear, this.selectedMonth, 0).getDate();
    this.daysInMonthArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const reportUrl = `${environment.apiUrl}/students/attendance/report?month=${this.selectedMonth}&year=${this.selectedYear}&batchId=${this.data.batchId}&stream=coaching`;

    this.http.get<any>(reportUrl).subscribe({
      next: (res) => {
        const rows = res?.rows || [];
        this.batchRegisterRows = this.data.students.map(st => {
          const matchedReport = rows.find((r: any) => r.personId === st.studentId);
          const daysMap: { [day: number]: string } = {};

          if (matchedReport?.dailyStatuses) {
            const parts = matchedReport.dailyStatuses.split(',');
            parts.forEach((stCode: string, idx: number) => {
              daysMap[idx + 1] = stCode;
            });
          }

          for (const d of this.daysInMonthArray) {
            if (!daysMap[d]) {
              if (this.isSunday(d)) {
                daysMap[d] = 'Off';
              } else if (this.isHoliday(d)) {
                daysMap[d] = 'H';
              } else {
                daysMap[d] = '-';
              }
            }
          }

          const lvCount = Object.values(daysMap).filter(s => s === 'LV').length;

          return {
            studentId: st.studentId,
            studentName: st.studentName,
            rollNumber: st.coachingRollNumber || st.rollNumber || '—',
            profilePhoto: st.profilePhoto,
            photoFailed: false,
            days: daysMap,
            presentCount: matchedReport?.presentDays || 0,
            absentCount: matchedReport?.absentDays || 0,
            lateCount: matchedReport?.lateDays || 0,
            halfDayCount: matchedReport?.halfDays || 0,
            leaveCount: lvCount,
            attendanceRate: matchedReport?.attendancePercentage || 0
          };
        });

        // Also fetch individual daily map if needed
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.batchRegisterRows = [];
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  getIstTodayYmd(): string {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const ist = new Date(utc + (3600000 * 5.5));
    return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}-${String(ist.getDate()).padStart(2, '0')}`;
  }

  openRegularizeDialog(cell: CalendarDayRecord, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (!this.currentStudent) return;

    const dialogRef = this.dialog.open(ApplyStudentRegularizationDialogComponent, {
      width: '600px',
      data: {
        studentId: this.currentStudent.studentId,
        studentName: this.currentStudent.studentName,
        rollNumber: this.currentStudent.coachingRollNumber || this.currentStudent.rollNumber,
        className: this.data.className,
        sectionName: this.data.batchName,
        attendanceDate: cell.dateStr
      }
    });

    dialogRef.afterClosed().subscribe(saved => {
      if (saved) {
        this.loadStudentCalendar();
      }
    });
  }

  onDayCellClick(cell: CalendarDayRecord | null): void {
    if (cell && cell.canRegularize) {
      this.openRegularizeDialog(cell);
    }
  }

  isCellToday(day: number): boolean {
    const now = new Date();
    return now.getDate() === day && (now.getMonth() + 1) === this.selectedMonth && now.getFullYear() === this.selectedYear;
  }

  isSunday(day: number): boolean {
    return new Date(this.selectedYear, this.selectedMonth - 1, day).getDay() === 0;
  }

  isHoliday(day: number): boolean {
    const ymd = `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return this.holidays.some(h => {
      const start = (h.startDate || '').split('T')[0];
      const end = (h.endDate || h.startDate || '').split('T')[0];
      return ymd >= start && ymd <= end;
    });
  }

  getHolidayTitle(day: number): string | undefined {
    const ymd = `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const h = this.holidays.find(h => {
      const start = (h.startDate || '').split('T')[0];
      const end = (h.endDate || h.startDate || '').split('T')[0];
      return ymd >= start && ymd <= end;
    });
    return h ? (h.title || h.name) : undefined;
  }

  getDayOfWeekShort(day: number): string {
    const wd = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    return wd[new Date(this.selectedYear, this.selectedMonth - 1, day).getDay()];
  }

  formatTime(timeStr?: string): string {
    if (!timeStr) return '';
    // If format is HH:mm
    if (timeStr.includes(':') && !timeStr.toLowerCase().includes('m')) {
      const parts = timeStr.split(':');
      let h = parseInt(parts[0], 10);
      const m = parts[1];
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      h = h ? h : 12;
      return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
    }
    return timeStr;
  }

  calculateDuration(inTime: string, outTime: string): string {
    try {
      const parseMins = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };
      const diff = parseMins(outTime) - parseMins(inTime);
      if (diff > 0) {
        const hrs = Math.floor(diff / 60);
        const mins = diff % 60;
        return `${hrs}h ${mins}m`;
      }
    } catch {
      // Fallback
    }
    return '';
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
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  getAvatarBg(name: string): string {
    const colors = [
      '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#059669',
      '#0284c7', '#4f46e5', '#d97706', '#0d9488', '#e11d48'
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  getBiometricTooltip(cell: CalendarDayRecord): string {
    const source = cell.captureSource || 'Hikvision DS-K1A802AEF';
    const lines = [`⚡ Biometric Punch Verified (${source})`];
    if (cell.checkInTime && cell.checkOutTime) {
      lines.push(`⏱ ${this.formatTime(cell.checkInTime)} - ${this.formatTime(cell.checkOutTime)} (IST)`);
    } else if (cell.checkInTime) {
      lines.push(`⏱ Check-In: ${this.formatTime(cell.checkInTime)} (IST)`);
    } else if (cell.checkOutTime) {
      lines.push(`⏱ Check-Out: ${this.formatTime(cell.checkOutTime)} (IST)`);
    }
    return lines.join('\n');
  }

  openApplyLeaveDialog(): void {
    const dialogRef = this.dialog.open(ApplyStudentLeaveDialogComponent, {
      width: 'min(720px, 94vw)',
      data: {
        dialogScope: 'Coaching',
        classId: this.data.className,
        batchId: this.data.batchId,
        studentId: this.currentStudent?.studentId
      }
    });

    dialogRef.afterClosed().subscribe(res => {
      if (res) {
        this.refreshData();
      }
    });
  }

  closeDialog(): void {
    this.dialogRef.close();
  }
}
