import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { 
  CoachingService, 
  StudentWeeklyTimetableDto, 
  StudentTimetableSlotDto,
  StudentFacultyContactDto 
} from '../../core/services/coaching.service';
import { AuthService } from '../../core/services/auth.service';
import { 
  SchoolService, 
  SchoolClassDto, 
  SchoolSectionDto, 
  SectionPeriodRoutineDto 
} from '../../core/services/school.service';
import { BatchesService, BatchDto } from '../../core/services/batches.service';
import { SectionRoutineDialogComponent } from '../school/section-routine-dialog.component';

@Component({
  selector: 'app-student-timetable',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDialogModule
],
  template: `
    <div class="timetable-page-container">
      <div class="no-print screen-ui-wrapper">
        <!-- Top Portal Navigation & Action Bar -->
        <div class="portal-header-bar">
          <div class="header-left">
            <div class="header-icon-box">
              <mat-icon>calendar_view_week</mat-icon>
            </div>
            <div>
              <div class="breadcrumb-row">
                <a routerLink="/dashboard" class="bc-link"><mat-icon>home</mat-icon> Dashboard</a>
                <span class="bc-sep">/</span>
                <a routerLink="/students/my-profile" class="bc-link">Student 360°</a>
                <span class="bc-sep">/</span>
                <span class="bc-current">Live Routine &amp; Timetable</span>
              </div>
              <h1 class="page-title">Live Class Routine &amp; Timetable</h1>
              <p class="page-subtitle">Real-time daily period sequence, live classroom tracking, faculty directory &amp; substitution updates</p>
            </div>
          </div>
    
          @if (timetableData) {
            <div class="header-actions">
              <!-- IST Digital Clock -->
              <div class="live-clock-badge">
                <div class="live-pulse-dot"></div>
                <div class="clock-details">
                  <span class="clock-label">IST LOCAL TIME</span>
                  <span class="clock-time">{{ liveClockTime }}</span>
                </div>
              </div>
              <button mat-stroked-button class="header-btn" (click)="toggleViewMode()">
                <mat-icon>{{ viewMode === 'daily' ? 'grid_view' : 'view_day' }}</mat-icon>
                {{ viewMode === 'daily' ? 'Weekly Matrix Grid' : 'Daily Timeline View' }}
              </button>
              <button mat-stroked-button class="header-btn" (click)="showFacultyModal = true">
                <mat-icon>groups</mat-icon> Faculty Directory ({{ timetableData.facultyContacts.length || 0 }})
              </button>
              <button mat-raised-button color="primary" class="primary-gradient-btn" (click)="triggerPrint()">
                <mat-icon>print</mat-icon> Print Routine
              </button>
            </div>
          }
        </div>
    
        <!-- Scope Navigation Pills (School Classes vs Coaching Batches) -->
        @if (isAdminOrStaff && (hasSchoolModule && hasCoachingModule)) {
          <div class="scope-nav-container">
            <div class="scope-pills">
              <button
                type="button"
                class="scope-pill-btn"
                [class.active]="targetScope === 'school'"
                (click)="setScope('school')">
                <mat-icon class="pill-icon">account_balance</mat-icon>
                <span>School Classes (स्कूल कक्षाएं)</span>
              </button>
              <button
                type="button"
                class="scope-pill-btn"
                [class.active]="targetScope === 'coaching'"
                (click)="setScope('coaching')">
                <mat-icon class="pill-icon">groups</mat-icon>
                <span>Coaching Batches (कोचिंग बैचेस)</span>
              </button>
            </div>
            <div class="scope-meta-badge">
              <mat-icon>verified_user</mat-icon>
              @if (targetScope === 'coaching') {
                <span>Scope: <strong>Coaching Batch Routine</strong> (बैच रूटीन)</span>
              }
              @if (targetScope === 'school') {
                <span>Scope: <strong>School Section Routine</strong> (कक्षा वर्ग रूटीन)</span>
              }
            </div>
          </div>
        }
    
        <!-- Academic Class & Section Selector for Staff/Admin (School Mode) -->
        @if (isAdminOrStaff && targetScope === 'school' && classes.length > 0) {
          <div class="admin-selector-bar">
            <div class="selector-left">
              <div class="selector-badge">
                <mat-icon>tune</mat-icon>
                <span>School Routine</span>
              </div>
              <div class="select-group">
                <label class="select-label">Class (कक्षा):</label>
                <select [(ngModel)]="selectedClassId" (change)="onClassSelect()" class="header-select">
                  @for (c of classes; track c) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
              </div>
              @if (currentSections.length > 0) {
                <div class="select-group">
                  <label class="select-label">Section (वर्ग):</label>
                  <select [(ngModel)]="selectedSectionId" (change)="onSectionSelect()" class="header-select">
                    @for (s of currentSections; track s) {
                      <option [value]="s.id">{{ s.name }}</option>
                    }
                  </select>
                </div>
              }
            </div>
            <div class="selector-right">
              <button type="button" class="setup-routine-btn" (click)="openConfigureRoutineDialog()" matTooltip="Add / edit periods and assign teachers for this section">
                <mat-icon>edit_calendar</mat-icon>
                <span>Configure Section Routine</span>
              </button>
            </div>
          </div>
        }
    
        <!-- Coaching Batch Selector for Staff/Admin (Coaching Mode) -->
        @if (isAdminOrStaff && targetScope === 'coaching') {
          <div class="admin-selector-bar coaching-bar">
            <div class="selector-left">
              <div class="selector-badge coaching-badge">
                <mat-icon>groups</mat-icon>
                <span>Batch Routine</span>
              </div>
              @if (classes.length > 0) {
                <div class="select-group">
                  <label class="select-label">Class (कक्षा):</label>
                  <select [(ngModel)]="coachingClassId" (change)="onCoachingClassChange()" class="header-select">
                    <option value="">All Classes (सभी कक्षाएं)</option>
                    @for (c of classes; track c) {
                      <option [value]="c.id">{{ c.name }}</option>
                    }
                  </select>
                </div>
              }
              <div class="select-group">
                <label class="select-label">Batch (कोचिंग बैच):</label>
                <select [(ngModel)]="selectedBatchId" (change)="onBatchSelect()" class="header-select batch-select">
                  @if (filteredBatches.length === 0) {
                    <option value="">No batches for this class</option>
                  }
                  @for (b of filteredBatches; track b) {
                    <option [value]="b.id">
                      {{ b.name }}{{ b.className ? ' [' + b.className + ']' : '' }}{{ b.subject ? ' - ' + b.subject : '' }}
                    </option>
                  }
                </select>
              </div>
            </div>
            <div class="selector-right">
              <button type="button" class="setup-routine-btn coaching-routine-btn" (click)="openConfigureBatchRoutineDialog()" [disabled]="!selectedBatchId" matTooltip="Add / edit lectures and assign faculty for this batch">
                <mat-icon>edit_calendar</mat-icon>
                <span>Configure Batch Routine</span>
              </button>
            </div>
          </div>
        }
    
    
        <!-- Error State -->
        @if (!loading && errorMessage) {
          <div class="error-state-card">
            <mat-icon class="err-icon">error_outline</mat-icon>
            <h3>Unable to Load Timetable</h3>
            <p>{{ errorMessage }}</p>
            <button mat-stroked-button color="primary" (click)="loadTimetable()">
              <mat-icon>refresh</mat-icon> Retry Loading
            </button>
          </div>
        }
    
        <!-- Main Timetable Content -->
        @if (!loading && timetableData) {
          <div class="content-wrapper">
            <!-- No Routine Configured Alert Banner -->
            @if (totalWeeklyPeriodsCount === 0) {
              <div class="no-routine-configured-banner">
                <div class="banner-left">
                  <mat-icon>event_busy</mat-icon>
                  <div>
                    <strong>No Periods Scheduled Yet for {{ targetScope === 'coaching' ? (timetableData.batchName || 'this Batch') : (timetableData.className + (timetableData.sectionName ? ' - ' + timetableData.sectionName : '')) }}</strong>
                    <p>Configure weekly routine, subjects, and period timings for {{ targetScope === 'coaching' ? 'this coaching batch' : 'this section' }}.</p>
                  </div>
                </div>
                <button type="button" class="btn-create-routine" (click)="targetScope === 'coaching' ? openConfigureBatchRoutineDialog() : openConfigureRoutineDialog()">
                  <mat-icon>add_circle_outline</mat-icon> Setup Weekly Routine
                </button>
              </div>
            }
            <!-- Student & Academic Identity Strip -->
            <div class="student-identity-bar">
              <div class="student-info-col">
                <div class="student-avatar-box">
                  <mat-icon>school</mat-icon>
                </div>
                <div class="student-text">
                  <h2 class="student-name">{{ timetableData.studentName }}</h2>
                  <div class="student-pills">
                    @if (timetableData.className) {
                      <span class="id-pill">
                        <mat-icon>domain</mat-icon> Class: <strong>{{ timetableData.className }}{{ timetableData.sectionName ? ' - ' + timetableData.sectionName : '' }}</strong>
                      </span>
                    }
                    @if (timetableData.batchName) {
                      <span class="id-pill">
                        <mat-icon>class</mat-icon> Batch: <strong>{{ timetableData.batchName }}</strong>
                      </span>
                    }
                    <span class="id-pill">
                      <mat-icon>pin</mat-icon> Roll No: <strong>{{ timetableData.rollNumber }}</strong>
                    </span>
                    @if (timetableData.branchName) {
                      <span class="id-pill">
                        <mat-icon>store</mat-icon> Campus: <strong>{{ timetableData.branchName }}</strong>
                      </span>
                    }
                  </div>
                </div>
              </div>
              @if (timetableData.classTeacherName) {
                <div class="class-teacher-card">
                  <div class="ct-avatar">
                    <mat-icon>supervisor_account</mat-icon>
                  </div>
                  <div class="ct-info">
                    <span class="ct-role">Class Teacher / Incharge</span>
                    <strong class="ct-name">{{ timetableData.classTeacherName }}</strong>
                    @if (timetableData.classTeacherPhone) {
                      <a [href]="'tel:' + timetableData.classTeacherPhone" class="ct-phone">
                        <mat-icon>phone</mat-icon> {{ timetableData.classTeacherPhone }}
                      </a>
                    }
                  </div>
                </div>
              }
            </div>
            <!-- 🔴 LIVE CLASS SPOTLIGHT BANNER (Only on today's view) -->
            @if (selectedDay === timetableData.todayDayOfWeek && currentLivePeriod) {
              <div class="live-spotlight-banner">
                <div class="spotlight-left">
                  <div class="live-badge-glow">
                    <span class="dot-beacon"></span>
                    LIVE CLASS IN SESSION
                  </div>
                  <h3 class="live-subject">{{ currentLivePeriod.subject }}</h3>
                  <div class="live-meta-row">
                    <span class="live-meta-item">
                      <mat-icon>schedule</mat-icon> Period {{ currentLivePeriod.periodNumber }} &bull; {{ currentLivePeriod.timeSlot }}
                    </span>
                    <span class="live-meta-item room-tag">
                      <mat-icon>meeting_room</mat-icon> Room: <strong>{{ currentLivePeriod.roomNumber }}</strong>
                    </span>
                    <span class="live-meta-item faculty-tag">
                      <mat-icon>person</mat-icon> {{ currentLivePeriod.teacherName }}
                      @if (currentLivePeriod.isClassTeacher) {
                        <span class="ct-crown" matTooltip="Class Teacher">👑</span>
                      }
                    </span>
                  </div>
                </div>
                <!-- Proxy alert if substituted -->
                @if (currentLivePeriod.isSubstituted) {
                  <div class="spotlight-sub-alert">
                    <div class="sub-alert-head">
                      <mat-icon>swap_horiz</mat-icon>
                      <span>Substitute Faculty Active Today</span>
                    </div>
                    <div class="sub-alert-body">
                      <strong>{{ currentLivePeriod.substituteTeacherName }}</strong> is conducting this session.
                      @if (currentLivePeriod.substituteTopic) {
                        <span class="sub-topic">Topic: "{{ currentLivePeriod.substituteTopic }}"</span>
                      }
                    </div>
                  </div>
                }
              </div>
            }
            <!-- Day Selector Navigation Bar -->
            <div class="day-navigation-strip">
              <div class="day-pills-row">
                <button
                  type="button"
                  class="day-pill-btn today-highlight-btn"
                  [class.active]="selectedDay === timetableData.todayDayOfWeek"
                  (click)="selectDay(timetableData.todayDayOfWeek)">
                  <mat-icon>bolt</mat-icon>
                  <span>Today ({{ timetableData.todayDayOfWeek }})</span>
                  <span class="period-count-badge">{{ (timetableData.weeklySchedule[timetableData.todayDayOfWeek] || []).length }}</span>
                </button>
                @for (day of daysList; track day) {
                  <button
                    type="button"
                    class="day-pill-btn"
                    [class.active]="selectedDay === day"
                    [class.today-day]="day === timetableData.todayDayOfWeek"
                    (click)="selectDay(day)">
                    <span>{{ day }}</span>
                    <span class="period-count-badge">{{ (timetableData.weeklySchedule[day] || []).length }}</span>
                  </button>
                }
              </div>
              <div class="view-toggle-btns">
                <button
                  type="button"
                  class="mode-btn"
                  [class.active]="viewMode === 'daily'"
                  (click)="viewMode = 'daily'"
                  matTooltip="Daily Timeline View">
                  <mat-icon>view_day</mat-icon> Daily Timeline
                </button>
                <button
                  type="button"
                  class="mode-btn"
                  [class.active]="viewMode === 'weekly'"
                  (click)="viewMode = 'weekly'"
                  matTooltip="Weekly Full Routine Matrix">
                  <mat-icon>grid_view</mat-icon> Full Week Grid
                </button>
              </div>
            </div>
            <!-- MODE 1: DAILY TIMELINE VIEW -->
            @if (viewMode === 'daily') {
              <div class="daily-timeline-section">
                <div class="timeline-day-header">
                  <div class="day-heading-group">
                    <h3 class="current-day-title">
                      {{ selectedDay }}'s Schedule
                      @if (selectedDay === timetableData.todayDayOfWeek) {
                        <span class="today-tag">Today's Live Routine</span>
                      }
                    </h3>
                    <p class="current-day-sub">
                      Total {{ currentDaySlots.length }} academic lectures / practical sessions scheduled for {{ selectedDay }}
                    </p>
                  </div>
                  <div class="timeline-legend">
                    <span class="legend-item"><span class="legend-dot completed"></span> Completed</span>
                    <span class="legend-item"><span class="legend-dot live"></span> Live Now</span>
                    <span class="legend-item"><span class="legend-dot upcoming"></span> Upcoming</span>
                    <span class="legend-item"><span class="legend-dot sub"></span> Substitute / Proxy</span>
                  </div>
                </div>
                <!-- Empty State for Day -->
                @if (currentDaySlots.length === 0) {
                  <div class="empty-day-card">
                    <div class="empty-illustration">
                      <mat-icon>weekend</mat-icon>
                    </div>
                    <h4>No Classes Scheduled on {{ selectedDay }}</h4>
                    <p>Enjoy your break or use this time for self-study and pending homework assignments!</p>
                    <a routerLink="/school/homework" class="view-hw-btn">
                      <mat-icon>auto_stories</mat-icon> Check Homework &amp; Diary
                    </a>
                  </div>
                }
                <!-- Period Cards Flow -->
                @if (currentDaySlots.length > 0) {
                  <div class="period-cards-flow">
                    @for (slot of currentDaySlots; track slot; let idx = $index) {
                      <div
                        class="period-card"
                        [class.live-card]="slot.isLiveNow"
                        [class.completed-card]="slot.isCompleted"
                        [class.upcoming-card]="slot.isUpcoming"
                        [class.has-proxy]="slot.isSubstituted">
                        <!-- Left Number / Time Column -->
                        <div class="period-time-col">
                          <div class="period-badge">
                            <span class="period-num">P{{ slot.periodNumber }}</span>
                            <span class="period-word">Period</span>
                          </div>
                          <div class="time-range-box">
                            <mat-icon>schedule</mat-icon>
                            <span class="time-text">{{ slot.timeSlot }}</span>
                          </div>
                          <div class="status-indicator-pill" [class.live]="slot.isLiveNow" [class.completed]="slot.isCompleted" [class.upcoming]="slot.isUpcoming">
                            <span class="status-dot"></span>
                            @if (slot.isLiveNow) {
                              <span class="status-name">LIVE NOW</span>
                            }
                            @if (slot.isCompleted) {
                              <span class="status-name">Completed</span>
                            }
                            @if (slot.isUpcoming) {
                              <span class="status-name">Upcoming</span>
                            }
                          </div>
                        </div>
                        <!-- Center Details Column -->
                        <div class="period-body-col">
                          <div class="subject-header-row">
                            <div class="subject-title-wrap">
                              <span class="subject-color-bar" [style.background-color]="getSubjectColor(slot.subject)"></span>
                              <h4 class="subject-name">{{ slot.subject }}</h4>
                              <span class="stream-pill" [class.coaching]="slot.stream === 'Coaching'">{{ slot.stream }}</span>
                            </div>
                            <div class="room-pill">
                              <mat-icon>meeting_room</mat-icon>
                              <span>Room: <strong>{{ slot.roomNumber }}</strong></span>
                            </div>
                          </div>
                          <!-- Teacher Profile Info -->
                          <div class="faculty-profile-strip">
                            <div class="fac-avatar" [style.background-color]="getSubjectColor(slot.subject)">
                              @if (!slot.teacherPhoto) {
                                <span>{{ getInitials(slot.teacherName) }}</span>
                              }
                              @if (slot.teacherPhoto) {
                                <img [src]="slot.teacherPhoto" [alt]="slot.teacherName" />
                              }
                            </div>
                            <div class="fac-details">
                              <div class="fac-name-row">
                                <strong class="fac-name">{{ slot.teacherName }}</strong>
                                @if (slot.isClassTeacher) {
                                  <span class="ct-badge">
                                    <mat-icon>verified</mat-icon> Class Teacher
                                  </span>
                                }
                              </div>
                              <span class="fac-sub-label">Subject Faculty</span>
                            </div>
                            @if (slot.teacherPhone) {
                              <div class="fac-quick-actions">
                                <a [href]="'tel:' + slot.teacherPhone" class="action-circle-btn" matTooltip="Call Teacher">
                                  <mat-icon>phone</mat-icon>
                                </a>
                                <a [href]="'https://wa.me/' + cleanPhone(slot.teacherPhone)" target="_blank" class="action-circle-btn wa" matTooltip="WhatsApp Faculty">
                                  <mat-icon>chat</mat-icon>
                                </a>
                              </div>
                            }
                          </div>
                          <!-- ⚠️ Substitute / Proxy Teacher Callout -->
                          @if (slot.isSubstituted) {
                            <div class="proxy-callout-banner">
                              <div class="proxy-header">
                                <mat-icon>swap_horiz</mat-icon>
                                <span>Teacher Substitution / Proxy Notice</span>
                              </div>
                              <div class="proxy-body">
                                <p>
                                  Regular faculty is away today. Class will be conducted by
                                  <strong>{{ slot.substituteTeacherName }}</strong>.
                                </p>
                                @if (slot.substituteTopic || slot.substituteReason) {
                                  <div class="proxy-meta">
                                    @if (slot.substituteTopic) {
                                      <span><strong>Topic to cover:</strong> {{ slot.substituteTopic }}</span>
                                    }
                                    @if (slot.substituteReason) {
                                      <span class="reason">({{ slot.substituteReason }})</span>
                                    }
                                  </div>
                                }
                              </div>
                            </div>
                          }
                        </div>
                        <!-- Right Quick Action Column -->
                        <div class="period-action-col">
                          <a routerLink="/school/homework" class="period-hw-link" matTooltip="View Homework for this subject">
                            <mat-icon>assignment</mat-icon>
                            <span>Homework</span>
                          </a>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            }
            <!-- MODE 2: FULL WEEKLY GRID MATRIX (Google Calendar Aesthetic) -->
            @if (viewMode === 'weekly') {
              <div class="weekly-matrix-section">
                <div class="matrix-header-bar">
                  <div class="matrix-header-title-box">
                    <div class="calendar-icon-chip">
                      <mat-icon>calendar_month</mat-icon>
                    </div>
                    <div>
                      <h3 class="matrix-title">Weekly Routine Matrix (Mon &ndash; Sat)</h3>
                      <p class="matrix-sub">Dynamic color-coded timetable grid &bull; Synchronized with real-time academic schedule</p>
                    </div>
                  </div>
                  <!-- Subject Color Legend Strip -->
                  <div class="matrix-header-right">
                    @if (activeSubjects.length > 0) {
                      <div class="subject-legend-strip">
                        @for (subj of activeSubjects; track subj) {
                          <span class="legend-badge-item"
                            [style.background]="getSubjectTheme(subj).bg"
                            [style.border-color]="getSubjectTheme(subj).border"
                            [style.color]="getSubjectTheme(subj).darkText">
                            <span class="subj-dot" [style.background]="getSubjectTheme(subj).border"></span>
                            <mat-icon class="legend-icon">{{ getSubjectTheme(subj).icon }}</mat-icon>
                            <span>{{ subj }}</span>
                          </span>
                        }
                      </div>
                    }
                    <div class="matrix-actions">
                      <button mat-stroked-button class="matrix-print-btn" (click)="triggerPrint()">
                        <mat-icon>print</mat-icon> Print Grid
                      </button>
                    </div>
                  </div>
                </div>
                <div class="matrix-table-wrap">
                  <table class="routine-grid-table">
                    <thead>
                      <tr>
                        <th class="day-col-th">
                          <div class="th-day-label">
                            <mat-icon>event</mat-icon>
                            <span>Day / Period</span>
                          </div>
                        </th>
                        @for (p of maxPeriodsList; track p) {
                          <th class="period-th">
                            <div class="th-google-header">
                              <div class="th-period-badge">
                                <span class="p-num-pill">P{{ p }}</span>
                                <span class="p-text">Period {{ p }}</span>
                              </div>
                              @if (getPeriodTimeHeader(p)) {
                                <div class="th-ptime">
                                  <mat-icon>schedule</mat-icon>
                                  <span>{{ getPeriodTimeHeader(p) }}</span>
                                </div>
                              }
                              @if (!getPeriodTimeHeader(p)) {
                                <div class="th-ptime empty-time">
                                  <span>Standard Slot</span>
                                </div>
                              }
                            </div>
                          </th>
                        }
                      </tr>
                    </thead>
                    <tbody>
                      @for (day of daysList; track day) {
                        <tr [class.highlight-today]="day === timetableData.todayDayOfWeek">
                          <td class="day-name-cell" [class.is-today-cell]="day === timetableData.todayDayOfWeek">
                            <div class="google-day-badge-col">
                              <div class="day-circle" [class.today-circle]="day === timetableData.todayDayOfWeek">
                                <span class="day-abbr">{{ day.substring(0, 3).toUpperCase() }}</span>
                              </div>
                              <div class="day-meta">
                                <span class="day-full-name">{{ day }}</span>
                                @if (day === timetableData.todayDayOfWeek) {
                                  <span class="today-chip">
                                    <span class="pulse-indicator"></span> TODAY
                                  </span>
                                }
                                @if (day !== timetableData.todayDayOfWeek) {
                                  <span class="period-count-sub">
                                    {{ getPeriodCountForDay(day) === 0 ? 'No Lectures' : getPeriodCountForDay(day) + (getPeriodCountForDay(day) === 1 ? ' Lecture' : ' Lectures') }}
                                  </span>
                                }
                              </div>
                            </div>
                          </td>
                          @for (p of maxPeriodsList; track p) {
                            <td class="slot-cell">
                              @if (getSlotForDayAndPeriod(day, p); as slot) {
                                <div class="google-event-card"
                                  [style.background]="getSubjectTheme(slot.subject).bg"
                                  [style.border-left-color]="getSubjectTheme(slot.subject).border"
                                  [class.is-live-slot]="slot.isLiveNow"
                                  [class.is-sub-slot]="slot.isSubstituted">
                                  <!-- Top Row: Subject Icon + Title + Live Dot -->
                                  <div class="gec-head">
                                    <div class="gec-subj-wrap">
                                      <span class="gec-subj-icon" [style.color]="getSubjectTheme(slot.subject).border">
                                        <mat-icon>{{ getSubjectTheme(slot.subject).icon }}</mat-icon>
                                      </span>
                                      <span class="gec-subject" [style.color]="getSubjectTheme(slot.subject).darkText" [title]="slot.subject">
                                        {{ slot.subject }}
                                      </span>
                                    </div>
                                    @if (slot.isLiveNow) {
                                      <span class="gec-live-badge" matTooltip="Live Lecture Right Now">
                                        <span class="gec-live-dot"></span> LIVE
                                      </span>
                                    }
                                  </div>
                                  <!-- Teacher Row with micro avatar -->
                                  <div class="gec-teacher-row" [style.color]="getSubjectTheme(slot.subject).darkText">
                                    <div class="gec-avatar" [style.background]="getSubjectTheme(slot.subject).border">
                                      {{ getInitials(slot.teacherName) }}
                                    </div>
                                    <span class="gec-teacher-name">{{ slot.teacherName }}</span>
                                  </div>
                                  <!-- Bottom: Room & Time Chips -->
                                  <div class="gec-chips-row">
                                    @if (slot.roomNumber) {
                                      <span class="gec-pill room-pill">
                                        <mat-icon>meeting_room</mat-icon>
                                        <span>{{ formatRoom(slot.roomNumber) }}</span>
                                      </span>
                                    }
                                    @if (slot.timeSlot) {
                                      <span class="gec-pill time-pill">
                                        <mat-icon>schedule</mat-icon>
                                        <span>{{ formatSlotTime(slot.timeSlot) }}</span>
                                      </span>
                                    }
                                  </div>
                                  <!-- Substitute / Proxy Badge -->
                                  @if (slot.isSubstituted) {
                                    <div class="gec-proxy-flag" [title]="'Substituted by ' + slot.substituteTeacherName">
                                      <mat-icon>swap_horiz</mat-icon>
                                      <span>Proxy: {{ slot.substituteTeacherName }}</span>
                                    </div>
                                  }
                                </div>
                              }
                              @if (!getSlotForDayAndPeriod(day, p)) {
                                <div class="google-empty-cell">
                                  <span class="empty-dot">&bull;</span>
                                  <span class="empty-text">Free</span>
                                </div>
                              }
                            </td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          </div>
        }
    
        <!-- 👥 FACULTY DIRECTORY MODAL OVERLAY -->
        @if (showFacultyModal) {
          <div class="modal-backdrop" (click)="showFacultyModal = false">
            <div class="faculty-modal-window" (click)="$event.stopPropagation()">
              <div class="modal-header">
                <div class="modal-header-icon">
                  <mat-icon>groups</mat-icon>
                </div>
                <div>
                  <h3 class="modal-title">Assigned Faculty &amp; Teacher Directory</h3>
                  <p class="modal-sub">Direct contact coordinates for class teachers and subject instructors</p>
                </div>
                <button mat-icon-button class="modal-close-btn" (click)="showFacultyModal = false">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
              <div class="modal-body">
                @if (timetableData?.facultyContacts?.length) {
                  <div class="faculty-cards-grid">
                    @for (fac of timetableData?.facultyContacts; track fac) {
                      <div class="faculty-contact-card" [class.ct-card]="fac.isClassTeacher">
                        <div class="f-top">
                          <div class="f-avatar" [style.background-color]="getSubjectColor(fac.subject)">
                            @if (!fac.photoUrl) {
                              <span>{{ getInitials(fac.teacherName) }}</span>
                            }
                            @if (fac.photoUrl) {
                              <img [src]="fac.photoUrl" [alt]="fac.teacherName" />
                            }
                          </div>
                          <div class="f-titles">
                            <div class="f-name-row">
                              <h4 class="f-name">{{ fac.teacherName }}</h4>
                              @if (fac.isClassTeacher) {
                                <span class="f-ct-crown" matTooltip="Class Teacher">👑 Class Teacher</span>
                              }
                            </div>
                            <span class="f-subject-badge">{{ fac.subject }}</span>
                          </div>
                        </div>
                        <div class="f-info-list">
                          @if (fac.roomNumber) {
                            <div class="f-info-item">
                              <mat-icon>meeting_room</mat-icon>
                              <span>Staff Room: <strong>{{ fac.roomNumber }}</strong></span>
                            </div>
                          }
                          @if (fac.phone) {
                            <div class="f-info-item">
                              <mat-icon>phone</mat-icon>
                              <a [href]="'tel:' + fac.phone">{{ fac.phone }}</a>
                            </div>
                          }
                          @if (fac.email) {
                            <div class="f-info-item">
                              <mat-icon>email</mat-icon>
                              <a [href]="'mailto:' + fac.email">{{ fac.email }}</a>
                            </div>
                          }
                        </div>
                        @if (fac.phone) {
                          <div class="f-footer">
                            <a [href]="'tel:' + fac.phone" mat-stroked-button class="f-call-btn">
                              <mat-icon>call</mat-icon> Call Teacher
                            </a>
                            <a [href]="'https://wa.me/' + cleanPhone(fac.phone)" target="_blank" mat-stroked-button class="f-wa-btn">
                              <mat-icon>chat</mat-icon> WhatsApp
                            </a>
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
                @if (!timetableData?.facultyContacts?.length) {
                  <div class="empty-state-strip">
                    <mat-icon>info</mat-icon>
                    <span>No faculty assignments linked to this class yet.</span>
                  </div>
                }
              </div>
            </div>
          </div>
        }
      </div> <!-- End no-print screen-ui-wrapper -->
    
      <!-- 🖨️ PRINTABLE TIMETABLE SHEET (Hidden on screen, visible during window.print) -->
      @if (timetableData) {
        <div class="printable-timetable-sheet" id="printTimetableArea">
          <div class="print-header">
            <div class="print-institute-name">{{ timetableData.branchName || 'INTERNATIONAL ACADEMY OF EXCELLENCE' }}</div>
            <h2 class="print-doc-title">OFFICIAL CLASS ROUTINE &amp; TIMETABLE</h2>
            <div class="print-meta-grid">
              <div>Student Name: <strong>{{ timetableData.studentName }}</strong></div>
              <div>Class &amp; Section: <strong>{{ timetableData.className }} {{ timetableData.sectionName }}</strong></div>
              <div>Roll Number: <strong>{{ timetableData.rollNumber }}</strong></div>
              <div>Class Teacher: <strong>{{ timetableData.classTeacherName || 'N/A' }}</strong></div>
            </div>
          </div>
          <table class="print-table">
            <thead>
              <tr>
                <th style="width: 100px;">Day</th>
                @for (p of maxPeriodsList; track p) {
                  <th>Period {{ p }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (day of daysList; track day) {
                <tr>
                  <td class="print-day-name"><strong>{{ day }}</strong></td>
                  @for (p of maxPeriodsList; track p) {
                    <td>
                      @if (getSlotForDayAndPeriod(day, p); as slot) {
                        <div class="print-slot">
                          <strong class="ps-subj">{{ slot.subject }}</strong>
                          <div class="ps-fac">{{ slot.teacherName }}</div>
                          <small class="ps-room">Rm: {{ slot.roomNumber }}</small>
                          <small class="ps-time">{{ slot.timeSlot }}</small>
                        </div>
                      }
                      @if (!getSlotForDayAndPeriod(day, p)) {
                        <span>&mdash;</span>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
          <div class="print-footer-signatures">
            <div class="print-sign-col">
              <div class="sign-line"></div>
              <span>Class Teacher Signature</span>
            </div>
            <div class="print-sign-col">
              <div class="sign-line"></div>
              <span>Academic Coordinator</span>
            </div>
            <div class="print-sign-col">
              <div class="sign-line"></div>
              <span>Principal / Director</span>
            </div>
          </div>
        </div>
      }
    
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    /* =========================================================================
       CONTAINER & PORTAL HEADER (Strict Standard ERP Styling)
       ========================================================================= */
    .timetable-page-container {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 0 0 32px;
      width: 100%;
      box-sizing: border-box;
    }

    .screen-ui-wrapper {
      display: flex;
      flex-direction: column;
      gap: 20px;
      width: 100%;
    }

    .content-wrapper {
      display: flex;
      flex-direction: column;
      gap: 20px;
      width: 100%;
    }

    .portal-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 4px;
      box-shadow: 0 1px 3px rgba(37, 99, 235, 0.08);
      flex-wrap: wrap;
      gap: 16px;
    }

    /* Scope Switcher Pill Tabs */
    .scope-nav-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 2px;
      flex-wrap: wrap;
    }

    .scope-pills {
      display: inline-flex;
      background: #e2e8f0;
      padding: 4px;
      border-radius: 10px;
      gap: 4px;
    }

    .scope-pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: none;
      background: transparent;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        color: #1e293b;
      }

      &.active {
        background: #ffffff;
        color: #2563eb;
        box-shadow: 0 2px 4px rgba(0,0,0,0.06);
      }
    }

    .pill-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .scope-meta-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      color: #1e40af;
      background: #dbeafe;
      padding: 6px 12px;
      border-radius: 20px;
      font-weight: 500;
      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .admin-selector-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      border: 1.5px solid #bfdbfe;
      border-radius: 12px;
      padding: 12px 18px;
      box-shadow: 0 4px 12px -2px rgba(37, 99, 235, 0.08);
      flex-wrap: wrap;
      gap: 14px;

      &.coaching-bar {
        border-color: #cbd5e1;
        background: #ffffff;
      }
    }

    .selector-left {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .selector-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      font-size: 0.8rem;
      font-weight: 700;
      padding: 6px 12px;
      border-radius: 8px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2563eb; }

      &.coaching-badge {
        background: #f0fdf4;
        border-color: #bbf7d0;
        color: #166534;
        mat-icon { color: #16a34a; }
      }
    }

    .select-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .select-label {
      font-size: 0.8rem;
      font-weight: 700;
      color: #334155;
      white-space: nowrap;
    }

    .header-select {
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      color: #0f172a;
      font-size: 0.86rem;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 8px;
      outline: none;
      cursor: pointer;
      min-width: 140px;
      transition: all 0.15s;
      &:focus {
        border-color: #2563eb;
        background: #ffffff;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
      }

      &.batch-select {
        min-width: 220px;
        max-width: 380px;
      }
    }

    .selector-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .setup-routine-btn {
      background: #2563eb;
      color: #ffffff;
      border: none;
      font-size: 0.82rem;
      font-weight: 700;
      padding: 7px 14px;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
      transition: all 0.15s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover:not(:disabled) { background: #1d4ed8; transform: translateY(-1px); }
      &:disabled { opacity: 0.5; cursor: not-allowed; }

      &.coaching-routine-btn {
        background: #059669;
        box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);
        &:hover:not(:disabled) { background: #047857; }
      }
    }

    .no-routine-configured-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #fffbeb;
      border: 1.5px solid #fde68a;
      border-radius: 12px;
      padding: 14px 18px;
      gap: 16px;
      flex-wrap: wrap;

      .banner-left {
        display: flex;
        align-items: center;
        gap: 12px;
        mat-icon { font-size: 28px; width: 28px; height: 28px; color: #d97706; }
        strong { display: block; font-size: 0.92rem; color: #92400e; margin-bottom: 2px; }
        p { margin: 0; font-size: 0.82rem; color: #b45309; }
      }

      .btn-create-routine {
        background: #f59e0b;
        color: #ffffff;
        border: none;
        font-size: 0.82rem;
        font-weight: 700;
        padding: 7px 14px;
        border-radius: 8px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: background 0.15s;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
        &:hover { background: #d97706; }
      }
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .header-icon-box {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      background: #2563eb;
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

    .breadcrumb-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #3b82f6;
      margin-bottom: 2px;
    }

    .bc-link {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      color: #3b82f6;
      text-decoration: none;
      transition: color 0.15s;
    }

    .bc-link:hover {
      color: #1d4ed8;
    }

    .bc-link mat-icon {
      font-size: 13px;
      width: 13px;
      height: 13px;
    }

    .bc-sep {
      color: #93c5fd;
    }

    .bc-current {
      color: #1e3a8a;
      font-weight: 700;
    }

    .page-title {
      font-size: 1.35rem;
      font-weight: 700;
      color: #1e3a8a;
      margin: 0;
      letter-spacing: -0.01em;
    }

    .page-subtitle {
      font-size: 0.85rem;
      color: #3b82f6;
      margin: 0.25rem 0 0 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    /* IST Digital Clock Badge */
    .live-clock-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #ffffff;
      border: 1px solid #bfdbfe;
      padding: 6px 12px;
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(37, 99, 235, 0.05);
    }

    .live-pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
      animation: pulse 1.6s infinite cubic-bezier(0.66, 0, 0, 1);
    }

    @keyframes pulse {
      to {
        box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
      }
    }

    .clock-details {
      display: flex;
      flex-direction: column;
    }

    .clock-label {
      font-size: 8px;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.05em;
    }

    .clock-time {
      font-size: 12px;
      font-weight: 800;
      color: #1e3a8a;
      font-variant-numeric: tabular-nums;
    }

    .header-btn {
      border-radius: 8px !important;
      font-weight: 600 !important;
      border-color: #2563eb !important;
      color: #1e40af !important;
      background: #ffffff !important;
      height: 38px !important;
    }

    .header-btn:hover {
      background: #eff6ff !important;
    }

    .primary-gradient-btn {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
      color: #ffffff !important;
      font-weight: 600 !important;
      border-radius: 8px !important;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25) !important;
      height: 38px !important;
    }

    /* =========================================================================
       STUDENT IDENTITY STRIP
       ========================================================================= */
    .student-identity-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      flex-wrap: wrap;
    }

    .student-info-col {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .student-avatar-box {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      color: #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .student-avatar-box mat-icon {
      font-size: 26px;
      width: 26px;
      height: 26px;
    }

    .student-name {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 6px 0;
    }

    .student-pills {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .id-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #475569;
      background: #f1f5f9;
      padding: 3px 10px;
      border-radius: 8px;
    }

    .id-pill mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: #64748b;
    }

    .class-teacher-card {
      display: flex;
      align-items: center;
      gap: 12px;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 1px solid #bbf7d0;
      padding: 10px 16px;
      border-radius: 12px;
    }

    .ct-avatar {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: #16a34a;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .ct-info {
      display: flex;
      flex-direction: column;
    }

    .ct-role {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #15803d;
      letter-spacing: 0.04em;
    }

    .ct-name {
      font-size: 13px;
      color: #14532d;
    }

    .ct-phone {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 11px;
      color: #16a34a;
      text-decoration: none;
      font-weight: 600;
      margin-top: 2px;
    }

    .ct-phone mat-icon {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }

    /* =========================================================================
       🔴 LIVE CLASS SPOTLIGHT BANNER
       ========================================================================= */
    .live-spotlight-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      background: linear-gradient(135deg, #052e16 0%, #064e3b 100%);
      border: 1px solid #10b981;
      border-radius: 16px;
      padding: 20px 24px;
      color: #ffffff;
      margin-bottom: 24px;
      box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.25);
      flex-wrap: wrap;
    }

    .live-badge-glow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid rgba(16, 185, 129, 0.4);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: #6ee7b7;
      margin-bottom: 8px;
    }

    .dot-beacon {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
    }

    .live-subject {
      font-size: 22px;
      font-weight: 800;
      margin: 0 0 8px 0;
      color: #ffffff;
      letter-spacing: -0.01em;
    }

    .live-meta-row {
      display: flex;
      align-items: center;
      gap: 14px;
      font-size: 13px;
      color: #a7f3d0;
      flex-wrap: wrap;
    }

    .live-meta-item {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }

    .live-meta-item mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .room-tag {
      background: rgba(255, 255, 255, 0.12);
      padding: 3px 10px;
      border-radius: 8px;
      color: #ffffff;
    }

    .faculty-tag {
      color: #ecfdf5;
      font-weight: 600;
    }

    .ct-crown {
      margin-left: 4px;
      font-size: 14px;
    }

    .spotlight-sub-alert {
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.4);
      padding: 12px 18px;
      border-radius: 12px;
      max-width: 380px;
    }

    .sub-alert-head {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 800;
      color: #fde68a;
      margin-bottom: 4px;
    }

    .sub-alert-head mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .sub-alert-body {
      font-size: 12px;
      color: #fef3c7;
      line-height: 1.4;
    }

    .sub-topic {
      display: block;
      margin-top: 4px;
      font-style: italic;
      color: #fde68a;
    }

    /* =========================================================================
       DAY NAVIGATION STRIP
       ========================================================================= */
    .day-navigation-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 0;
      flex-wrap: wrap;
    }

    .day-pills-row {
      display: flex;
      align-items: center;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 4px;
    }

    .day-pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      padding: 8px 16px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      white-space: nowrap;
    }

    .day-pill-btn:hover {
      background: #f1f5f9;
      color: #1e293b;
      border-color: #cbd5e1;
    }

    .day-pill-btn.active {
      background: #0f172a;
      color: #ffffff;
      border-color: #0f172a;
      box-shadow: 0 4px 10px rgba(15, 23, 42, 0.2);
    }

    .today-highlight-btn {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      color: #1d4ed8;
      border-color: #bfdbfe;
    }

    .today-highlight-btn:hover {
      background: #bfdbfe;
      color: #1e40af;
    }

    .today-highlight-btn.active {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff;
      border-color: #2563eb;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    }

    .period-count-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      background: rgba(0, 0, 0, 0.08);
      padding: 1px 6px;
      border-radius: 10px;
    }

    .active .period-count-badge {
      background: rgba(255, 255, 255, 0.25);
      color: #ffffff;
    }

    .view-toggle-btns {
      display: flex;
      align-items: center;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 3px;
    }

    .mode-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: transparent;
      border: none;
      padding: 6px 14px;
      border-radius: 9px;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      transition: all 0.15s;
    }

    .mode-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .mode-btn:hover {
      color: #0f172a;
    }

    .mode-btn.active {
      background: #f1f5f9;
      color: #0f172a;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    /* =========================================================================
       TIMELINE DAY HEADER & LEGEND
       ========================================================================= */
    .timeline-day-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .current-day-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .today-tag {
      font-size: 11px;
      font-weight: 700;
      background: #dbeafe;
      color: #1d4ed8;
      padding: 2px 10px;
      border-radius: 12px;
      letter-spacing: 0.02em;
    }

    .current-day-sub {
      font-size: 13px;
      color: #64748b;
      margin: 3px 0 0 0;
    }

    .timeline-legend {
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 12px;
      color: #64748b;
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .legend-dot.completed { background: #94a3b8; }
    .legend-dot.live { background: #10b981; }
    .legend-dot.upcoming { background: #0ea5e9; }
    .legend-dot.sub { background: #f59e0b; }

    /* =========================================================================
       PERIOD CARDS FLOW
       ========================================================================= */
    .period-cards-flow {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .period-card {
      display: grid;
      grid-template-columns: 160px 1fr auto;
      gap: 20px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 18px 22px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
      align-items: center;
    }

    .period-card:hover {
      border-color: #cbd5e1;
      box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.06);
      transform: translateY(-1px);
    }

    .period-card.live-card {
      border-color: #10b981;
      background: #f0fdf4;
      box-shadow: 0 8px 20px -4px rgba(16, 185, 129, 0.15);
    }

    .period-card.completed-card {
      opacity: 0.85;
      background: #fafafa;
    }

    .period-card.has-proxy {
      border-left: 4px solid #f59e0b;
    }

    /* Left Time Column */
    .period-time-col {
      display: flex;
      flex-direction: column;
      gap: 6px;
      border-right: 1px dashed #e2e8f0;
      padding-right: 16px;
    }

    .period-badge {
      display: flex;
      align-items: baseline;
      gap: 4px;
    }

    .period-num {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
    }

    .period-word {
      font-size: 12px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
    }

    .time-range-box {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      color: #475569;
      font-weight: 600;
    }

    .time-range-box mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: #64748b;
    }

    .status-indicator-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 8px;
      width: fit-content;
      margin-top: 4px;
    }

    .status-indicator-pill.completed {
      background: #f1f5f9;
      color: #64748b;
    }

    .status-indicator-pill.completed .status-dot {
      background: #94a3b8;
    }

    .status-indicator-pill.upcoming {
      background: #e0f2fe;
      color: #0369a1;
    }

    .status-indicator-pill.upcoming .status-dot {
      background: #0284c7;
    }

    .status-indicator-pill.live {
      background: #dcfce7;
      color: #15803d;
      animation: pulse 1.6s infinite cubic-bezier(0.66, 0, 0, 1);
    }

    .status-indicator-pill.live .status-dot {
      background: #16a34a;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    /* Center Details Column */
    .period-body-col {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .subject-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .subject-title-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .subject-color-bar {
      width: 4px;
      height: 22px;
      border-radius: 2px;
    }

    .subject-name {
      font-size: 17px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
    }

    .stream-pill {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: 6px;
      background: #eff6ff;
      color: #2563eb;
    }

    .stream-pill.coaching {
      background: #faf5ff;
      color: #7c3aed;
    }

    .room-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      color: #475569;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 4px 10px;
      border-radius: 8px;
    }

    .room-pill mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
      color: #64748b;
    }

    /* Faculty Profile Strip */
    .faculty-profile-strip {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      padding: 8px 14px;
      border-radius: 12px;
    }

    .fac-avatar {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      color: #ffffff;
      font-weight: 700;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }

    .fac-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .fac-details {
      flex: 1;
    }

    .fac-name-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .fac-name {
      font-size: 13px;
      color: #1e293b;
    }

    .ct-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      font-weight: 700;
      background: #dcfce7;
      color: #15803d;
      padding: 1px 6px;
      border-radius: 6px;
    }

    .ct-badge mat-icon {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }

    .fac-sub-label {
      font-size: 11px;
      color: #64748b;
    }

    .fac-quick-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .action-circle-btn {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      color: #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      transition: all 0.15s;
    }

    .action-circle-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .action-circle-btn:hover {
      background: #eff6ff;
      border-color: #bfdbfe;
    }

    .action-circle-btn.wa {
      color: #16a34a;
    }

    .action-circle-btn.wa:hover {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }

    /* Proxy Callout */
    .proxy-callout-banner {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 10px;
      padding: 10px 14px;
    }

    .proxy-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 700;
      color: #b45309;
      margin-bottom: 4px;
    }

    .proxy-header mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
    }

    .proxy-body p {
      margin: 0;
      font-size: 12px;
      color: #92400e;
    }

    .proxy-meta {
      font-size: 11px;
      color: #b45309;
      margin-top: 4px;
    }

    .proxy-meta .reason {
      color: #78350f;
      margin-left: 6px;
    }

    /* Right Quick Action Column */
    .period-action-col {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .period-hw-link {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 8px 12px;
      border-radius: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #475569;
      text-decoration: none;
      font-size: 11px;
      font-weight: 600;
      transition: all 0.15s;
    }

    .period-hw-link mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #2563eb;
    }

    .period-hw-link:hover {
      background: #eff6ff;
      border-color: #bfdbfe;
      color: #1e40af;
    }

    /* Empty Day Card */
    .empty-day-card {
      background: #ffffff;
      border: 1px dashed #cbd5e1;
      border-radius: 16px;
      padding: 48px 24px;
      text-align: center;
    }

    .empty-illustration {
      width: 64px;
      height: 64px;
      border-radius: 20px;
      background: #f1f5f9;
      color: #94a3b8;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px auto;
    }

    .empty-illustration mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .empty-day-card h4 {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 6px 0;
    }

    .empty-day-card p {
      font-size: 13px;
      color: #64748b;
      margin: 0 0 20px 0;
    }

    .view-hw-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #2563eb;
      color: #ffffff;
      padding: 8px 18px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
    }

    .view-hw-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    /* =========================================================================
       MODE 2: WEEKLY MATRIX GRID
       ========================================================================= */
    .weekly-matrix-section {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03);
    }

    .matrix-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 24px;
      border-bottom: 1px solid #e2e8f0;
      background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
      gap: 16px;
      flex-wrap: wrap;
    }

    .matrix-header-title-box {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .calendar-icon-chip {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #1a73e8 0%, #1557b0 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(26, 115, 232, 0.28);
      flex-shrink: 0;
    }

    .calendar-icon-chip mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .matrix-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      letter-spacing: -0.02em;
    }

    .matrix-sub {
      font-size: 12px;
      color: #64748b;
      margin: 3px 0 0 0;
    }

    .matrix-header-right {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }

    .subject-legend-strip {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      background: #f8fafc;
      padding: 4px 10px;
      border-radius: 30px;
      border: 1px solid #e2e8f0;
    }

    .legend-badge-item {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 9px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      border: 1px solid;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    }

    .subj-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
    }

    .legend-icon {
      font-size: 13px !important;
      width: 13px !important;
      height: 13px !important;
    }

    .matrix-print-btn {
      border-color: #cbd5e1 !important;
      color: #1e293b !important;
      font-weight: 700 !important;
      border-radius: 10px !important;
      background: #ffffff !important;
    }

    .matrix-print-btn mat-icon {
      color: #2563eb;
    }

    .matrix-table-wrap {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      background: #ffffff;
    }

    .routine-grid-table {
      width: 100%;
      min-width: 920px;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 12px;
      table-layout: fixed;
    }

    .routine-grid-table th {
      background: #f8fafc;
      padding: 10px 8px;
      text-align: left;
      font-weight: 700;
      color: #334155;
      border-bottom: 2px solid #e2e8f0;
      border-right: 1px solid #edf2f7;
      vertical-align: middle;
    }

    .day-col-th {
      width: 110px;
    }

    .th-day-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .th-day-label mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #1a73e8;
    }

    .th-google-header {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .th-period-badge {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .p-num-pill {
      background: #e8f0fe;
      color: #1a73e8;
      font-weight: 800;
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 5px;
    }

    .p-text {
      font-weight: 800;
      color: #0f172a;
      font-size: 13px;
    }

    .th-ptime {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
    }

    .th-ptime mat-icon {
      font-size: 13px;
      width: 13px;
      height: 13px;
      color: #94a3b8;
    }

    .th-ptime.empty-time {
      color: #94a3b8;
      font-style: italic;
      font-weight: 500;
    }

    .routine-grid-table td {
      padding: 6px;
      border-bottom: 1px solid #edf2f7;
      border-right: 1px solid #edf2f7;
      vertical-align: top;
      min-height: 100px;
      height: auto;
      background: #ffffff;
    }

    .routine-grid-table tr:hover td {
      background: #fafbfd;
    }

    .routine-grid-table tr.highlight-today td {
      background: #f8faff;
    }

    .routine-grid-table tr.highlight-today td.day-name-cell {
      background: #eff6ff !important;
    }

    /* Day Column Cell (Google Calendar Day Badge) */
    .day-name-cell {
      background: #fafafa;
      border-right: 2px solid #e2e8f0 !important;
      padding: 8px 6px !important;
    }

    .day-name-cell.is-today-cell {
      background: #eff6ff !important;
    }

    .google-day-badge-col {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 100%;
    }

    .day-circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #f1f5f9;
      color: #475569;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 10.5px;
      letter-spacing: 0.02em;
      flex-shrink: 0;
      transition: all 0.2s ease;
      border: 1.5px solid #e2e8f0;
    }

    .day-circle.today-circle {
      background: #1a73e8;
      border-color: #1a73e8;
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(26, 115, 232, 0.4);
    }

    .day-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .day-full-name {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
    }

    .today-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 9px;
      font-weight: 800;
      background: #2563eb;
      color: #ffffff;
      padding: 1px 6px;
      border-radius: 10px;
      letter-spacing: 0.05em;
      width: fit-content;
    }

    .pulse-indicator {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #ffffff;
      animation: pulse-dot 1.5s infinite;
    }

    .period-count-sub {
      font-size: 10px;
      font-weight: 600;
      color: #64748b;
    }

    /* Google Event Card inside Grid */
    .google-event-card {
      border-radius: 8px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-left-width: 3.5px;
      border-left-style: solid;
      padding: 6px 7px;
      min-height: 94px;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 5px;
      box-shadow: 0 1px 3px rgba(60, 64, 67, 0.08), 0 1px 2px rgba(60, 64, 67, 0.04);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      cursor: default;
      box-sizing: border-box;
    }

    .google-event-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 14px rgba(60, 64, 67, 0.14), 0 2px 4px rgba(60, 64, 67, 0.08);
      z-index: 2;
    }

    .google-event-card.is-live-slot {
      border-left-color: #16a34a !important;
      box-shadow: 0 0 0 2px #22c55e, 0 4px 12px rgba(34, 197, 94, 0.25) !important;
      animation: live-slot-pulse 2s infinite;
    }

    @keyframes live-slot-pulse {
      0% { box-shadow: 0 0 0 2px #22c55e, 0 4px 12px rgba(34, 197, 94, 0.25); }
      50% { box-shadow: 0 0 0 3px #16a34a, 0 6px 16px rgba(22, 163, 74, 0.4); }
      100% { box-shadow: 0 0 0 2px #22c55e, 0 4px 12px rgba(34, 197, 94, 0.25); }
    }

    .gec-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 4px;
    }

    .gec-subj-wrap {
      display: flex;
      align-items: flex-start;
      gap: 4px;
      flex: 1;
      min-width: 0;
    }

    .gec-subj-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .gec-subj-icon mat-icon {
      font-size: 13px;
      width: 13px;
      height: 13px;
    }

    .gec-subject {
      font-weight: 750;
      font-size: 10.5px;
      line-height: 1.25;
      letter-spacing: -0.01em;
      word-break: break-word;
      overflow: visible;
      white-space: normal;
    }

    .gec-live-badge {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-size: 7.5px;
      font-weight: 800;
      background: #16a34a;
      color: #ffffff;
      padding: 1px 3px;
      border-radius: 3px;
      letter-spacing: 0.05em;
      flex-shrink: 0;
    }

    .gec-live-dot {
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: #ffffff;
      animation: pulse-dot 1.2s infinite;
    }

    .gec-teacher-row {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      font-weight: 600;
      white-space: nowrap;
    }

    .gec-avatar {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      color: #ffffff;
      font-size: 8px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .gec-teacher-name {
      font-size: 10.5px;
      font-weight: 600;
      color: #1e293b;
      white-space: nowrap;
    }

    .ct-crown-mini {
      font-size: 9.5px;
      flex-shrink: 0;
    }

    .gec-chips-row {
      display: flex;
      align-items: center;
      gap: 3px;
      flex-wrap: wrap;
      margin-top: 1px;
    }

    .gec-pill {
      display: inline-flex;
      align-items: center;
      gap: 2.5px;
      font-size: 8.5px;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(0, 0, 0, 0.08);
      padding: 1.5px 4.5px;
      border-radius: 4px;
      color: #334155;
      white-space: nowrap;
      max-width: 100%;
      box-sizing: border-box;
    }

    .gec-pill mat-icon {
      font-size: 9.5px;
      width: 9.5px;
      height: 9.5px;
      color: #64748b;
      flex-shrink: 0;
    }

    .gec-proxy-flag {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 9px;
      font-weight: 700;
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
      padding: 1px 5px;
      border-radius: 4px;
      width: fit-content;
    }

    .gec-proxy-flag mat-icon {
      font-size: 11px;
      width: 11px;
      height: 11px;
    }

    .google-empty-cell {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 85px;
      border-radius: 8px;
      color: #cbd5e1;
      transition: all 0.15s ease;
      cursor: default;
    }

    .google-empty-cell:hover {
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      color: #94a3b8;
    }

    .empty-dot {
      font-size: 16px;
      color: #cbd5e1;
    }

    .empty-text {
      display: none;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .google-empty-cell:hover .empty-dot {
      display: none;
    }

    .google-empty-cell:hover .empty-text {
      display: block;
    }

    /* =========================================================================
       👥 FACULTY DIRECTORY MODAL
       ========================================================================= */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .faculty-modal-window {
      background: #ffffff;
      border-radius: 20px;
      max-width: 760px;
      width: 100%;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }

    /* Header styling adheres strictly to IMSERP light blue gradient rule */
    .modal-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 20px 24px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .modal-header-icon {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: #2563eb;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
    }

    .modal-header-icon mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .modal-title {
      font-size: 18px;
      font-weight: 700;
      color: #1e3a8a;
      margin: 0;
    }

    .modal-sub {
      font-size: 12px;
      color: #3b82f6;
      margin: 2px 0 0 0;
    }

    .modal-close-btn {
      margin-left: auto;
      color: #64748b;
    }

    .modal-close-btn:hover {
      color: #1e293b;
    }

    .modal-body {
      padding: 24px;
    }

    .faculty-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }

    .faculty-contact-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
    }

    .faculty-contact-card.ct-card {
      border-color: #86efac;
      background: #f0fdf4;
    }

    .f-top {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .f-avatar {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      color: #ffffff;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }

    .f-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .f-titles {
      flex: 1;
    }

    .f-name-row {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .f-name {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
    }

    .f-ct-crown {
      font-size: 10px;
      font-weight: 700;
      background: #dcfce7;
      color: #15803d;
      padding: 1px 6px;
      border-radius: 6px;
    }

    .f-subject-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      color: #2563eb;
      margin-top: 2px;
    }

    .f-info-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 12px;
      color: #475569;
    }

    .f-info-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .f-info-item mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
      color: #64748b;
    }

    .f-info-item a {
      color: #2563eb;
      text-decoration: none;
      font-weight: 600;
    }

    .f-footer {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }

    .f-call-btn {
      flex: 1;
      border-radius: 8px !important;
      color: #2563eb !important;
      border-color: #bfdbfe !important;
      font-size: 12px !important;
    }

    .f-wa-btn {
      flex: 1;
      border-radius: 8px !important;
      color: #16a34a !important;
      border-color: #bbf7d0 !important;
      font-size: 12px !important;
    }

    /* =========================================================================
       🖨️ PRINTABLE TIMETABLE SHEET
       ========================================================================= */
    .printable-timetable-sheet {
      display: none;
    }

    @media print {
      .no-print,
      .screen-ui-wrapper,
      .portal-header-bar,
      .content-wrapper,
      .student-identity-bar,
      .live-spotlight-banner,
      .day-navigation-strip,
      .daily-timeline-section,
      .weekly-matrix-section,
      .modal-backdrop,
      .loading-state-card,
      .error-state-card {
        display: none !important;
      }

      ::ng-deep .mat-toolbar,
      ::ng-deep .sidenav,
      ::ng-deep app-footer,
      ::ng-deep app-quick-settings-drawer {
        display: none !important;
      }

      ::ng-deep .main-content {
        padding: 0 !important;
        margin: 0 !important;
        overflow: visible !important;
        background: #ffffff !important;
      }

      .timetable-page-container {
        padding: 0 !important;
        margin: 0 !important;
        background: #ffffff !important;
        display: block !important;
      }

      .printable-timetable-sheet {
        display: block !important;
        position: static !important;
        width: 100% !important;
        padding: 20px 24px !important;
        margin: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        box-sizing: border-box !important;
      }

      .print-header {
        text-align: center;
        margin-bottom: 16px;
        border-bottom: 2px solid #000000;
        padding-bottom: 10px;
      }

      .print-institute-name {
        font-size: 18px;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .print-doc-title {
        font-size: 14px;
        font-weight: 700;
        margin: 4px 0 8px 0;
      }

      .print-meta-grid {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        flex-wrap: wrap;
        gap: 8px;
      }

      .print-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 10px;
        table-layout: fixed;
        margin-top: 12px;
      }

      .print-table th, .print-table td {
        border: 1px solid #000000;
        padding: 6px;
        text-align: left;
        vertical-align: top;
      }

      .print-table th {
        background: #f0f0f0;
        font-weight: 700;
        text-align: center;
      }

      .print-day-name {
        text-align: center !important;
        vertical-align: middle !important;
        background: #f9f9f9;
        font-weight: 700;
      }

      .print-slot {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .ps-subj {
        font-size: 10px;
        font-weight: 700;
      }

      .ps-fac, .ps-room, .ps-time {
        font-size: 9px;
      }

      .print-footer-signatures {
        display: flex;
        justify-content: space-between;
        margin-top: 40px;
        padding-top: 10px;
      }

      .print-sign-col {
        text-align: center;
        width: 160px;
        font-size: 11px;
      }

      .sign-line {
        border-top: 1px solid #000000;
        margin-bottom: 4px;
      }
    }

    /* =========================================================================
       LOADER & ERROR CARDS
       ========================================================================= */
    .loading-state-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      gap: 16px;
      color: #64748b;
    }

    .error-state-card {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 16px;
      padding: 32px;
      text-align: center;
      max-width: 480px;
      margin: 40px auto;
    }

    .err-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #ef4444;
      margin-bottom: 8px;
    }

    .error-state-card h3 {
      font-size: 18px;
      font-weight: 800;
      color: #991b1b;
      margin: 0 0 6px 0;
    }

    .error-state-card p {
      font-size: 13px;
      color: #b91c1c;
      margin: 0 0 16px 0;
    }

    /* =========================================================================
       📱 MOBILE & TABLET RESPONSIVE STYLES
       ========================================================================= */
    @media (max-width: 768px) {
      .portal-header-bar {
        padding: 12px 14px;
        gap: 12px;
        flex-direction: column;
        align-items: stretch;
      }

      .header-left {
        gap: 10px;
        width: 100%;
      }

      .header-icon-box {
        width: 38px;
        height: 38px;
        min-width: 38px;
        border-radius: 8px;
        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }

      .breadcrumb-row {
        font-size: 11px;
        gap: 4px;
        margin-bottom: 2px;
        flex-wrap: wrap;
      }

      .page-title {
        font-size: 1.15rem;
        line-height: 1.25;
      }

      .page-subtitle {
        font-size: 0.72rem;
        line-height: 1.25;
        margin-top: 2px;
      }

      .header-actions {
        width: 100%;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        align-items: center;
      }

      .live-clock-badge {
        grid-column: 1 / -1;
        justify-content: center;
        padding: 4px 10px;
        gap: 6px;

        .clock-label { font-size: 8px; }
        .clock-time { font-size: 12px; }
      }

      .header-btn {
        width: 100% !important;
        height: 36px !important;
        font-size: 0.76rem !important;
        padding: 0 8px !important;
        justify-content: center !important;
        gap: 4px !important;

        mat-icon { font-size: 16px; width: 16px; height: 16px; margin: 0; }
      }

      .primary-gradient-btn {
        grid-column: 1 / -1;
        width: 100% !important;
        height: 38px !important;
        font-size: 0.82rem !important;
        justify-content: center !important;
        gap: 4px !important;

        mat-icon { font-size: 18px; width: 18px; height: 18px; margin: 0; }
      }

      .scope-nav-container {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }

      .scope-pills {
        width: 100%;
        display: flex;
        gap: 4px;
      }

      .scope-pill-btn {
        flex: 1;
        justify-content: center;
        padding: 7px 8px;
        font-size: 0.78rem;
        border-radius: 8px;
        gap: 4px;

        .pill-icon { font-size: 16px; width: 16px; height: 16px; }
      }

      .scope-meta-badge {
        align-self: flex-start;
        font-size: 0.72rem;
        padding: 4px 10px;
      }

      .admin-selector-bar {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
        padding: 12px;
      }

      .selector-left {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        width: 100%;
      }

      .selector-badge {
        align-self: flex-start;
        padding: 4px 10px;
        font-size: 0.76rem;
      }

      .select-group {
        flex-direction: column;
        align-items: stretch;
        gap: 3px;
        width: 100%;
      }

      .select-label {
        font-size: 0.75rem;
      }

      .header-select {
        width: 100% !important;
        min-width: 100% !important;
        max-width: 100% !important;
        height: 38px;
        font-size: 0.82rem;
        box-sizing: border-box;
      }

      .selector-right {
        width: 100%;
      }

      .setup-routine-btn {
        width: 100%;
        height: 38px;
        justify-content: center;
        font-size: 0.8rem;
      }

      /* Student Identity Strip */
      .student-identity-bar {
        padding: 12px 14px;
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }

      .student-info-col {
        gap: 10px;
      }

      .student-avatar-box {
        width: 38px;
        height: 38px;
        min-width: 38px;
        border-radius: 10px;
        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }

      .student-name {
        font-size: 1.05rem;
        margin-bottom: 4px;
      }

      .student-pills {
        gap: 6px;
      }

      .id-pill {
        font-size: 0.7rem;
        padding: 2px 7px;
        border-radius: 6px;
        mat-icon { font-size: 12px; width: 12px; height: 12px; }
      }

      .class-teacher-card {
        width: 100%;
        box-sizing: border-box;
        padding: 8px 12px;
      }

      /* Live Class Spotlight Banner */
      .live-spotlight-banner {
        padding: 14px 16px;
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 16px;
      }

      .live-subject {
        font-size: 1.15rem;
        margin-bottom: 6px;
      }

      .live-meta-row {
        gap: 8px;
        font-size: 11.5px;
      }

      .spotlight-sub-alert {
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
      }

      /* Day Navigation Strip */
      .day-navigation-strip {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }

      .day-pills-row {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        padding-bottom: 6px;
        gap: 6px;
      }

      .day-pill-btn {
        padding: 6px 12px;
        font-size: 0.78rem;
        border-radius: 8px;
        flex-shrink: 0;
      }

      .view-toggle-btns {
        width: 100%;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }

      .mode-btn {
        justify-content: center;
        padding: 8px;
        font-size: 0.78rem;
      }

      /* Timeline Day Header */
      .timeline-day-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }

      .current-day-title {
        font-size: 1.1rem;
      }

      .timeline-legend {
        gap: 10px;
        flex-wrap: wrap;
        font-size: 11px;
      }

      /* Period Card in Daily Flow */
      .period-card {
        grid-template-columns: 1fr;
        padding: 12px 14px;
        gap: 10px;
      }

      .period-time-col {
        border-right: none;
        border-bottom: 1px dashed #e2e8f0;
        padding-bottom: 8px;
        padding-right: 0;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
      }

      .period-body-col {
        padding: 0;
      }

      .subject-header-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
      }

      .period-action-col {
        justify-content: flex-start;
        padding-top: 4px;
        border-top: 1px dashed #f1f5f9;
      }

      /* Weekly Routine Matrix Table */
      .matrix-header-bar {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
      }

      .matrix-actions {
        width: 100%;

        .matrix-print-btn {
          width: 100%;
          justify-content: center;
        }
      }

      .matrix-table-wrap {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
      }

      .routine-grid-table {
        min-width: 900px;
        font-size: 11px;
      }

      /* Faculty Modal */
      .modal-card {
        width: 95vw !important;
        max-width: 95vw !important;
        max-height: 90vh !important;
        margin: 10px;
      }

      .modal-header {
        padding: 14px 16px;
      }

      .modal-body {
        padding: 14px;
      }

      .faculty-cards-grid {
        grid-template-columns: 1fr !important;
        gap: 12px;
      }
    }
  `]
})
export class StudentTimetableComponent implements OnInit, OnDestroy {
  loading = true;
  errorMessage = '';
  timetableData: StudentWeeklyTimetableDto | null = null;
  
  viewMode: 'daily' | 'weekly' = 'daily';
  selectedDay: string = 'Monday';
  daysList: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  maxPeriodsList: number[] = [1, 2, 3, 4, 5, 6, 7, 8];

  showFacultyModal = false;
  liveClockTime = '';
  private clockIntervalId: any = null;

  // Vibrant palette for academic subjects
  private subjectColors: { [key: string]: string } = {
    'mathematics': '#2563eb',
    'maths': '#2563eb',
    'physics': '#7c3aed',
    'chemistry': '#059669',
    'biology': '#10b981',
    'english': '#d97706',
    'hindi': '#dc2626',
    'social science': '#0891b2',
    'computer science': '#4f46e5',
    'economics': '#b45309',
    'accountancy': '#0284c7',
    'business studies': '#9333ea',
    'physical education': '#16a34a'
  };

  classes: SchoolClassDto[] = [];
  selectedClassId = '';
  selectedSectionId = '';

  targetScope: 'school' | 'coaching' = 'school';
  hasSchoolModule = true;
  hasCoachingModule = true;
  batches: BatchDto[] = [];
  filteredBatches: BatchDto[] = [];
  coachingClassId = '';
  selectedBatchId = '';

  get currentSections(): SchoolSectionDto[] {
    const cls = this.classes.find(c => c.id === this.selectedClassId);
    return cls?.sections || [];
  }

  get isAdminOrStaff(): boolean {
    if (this.authService.isTeacher()) return false;
    return this.authService.isAdmin() || this.authService.isSuperAdmin() || this.authService.isInstituteAdmin();
  }

  get isTeacher(): boolean {
    return this.authService.isTeacher();
  }

  get totalWeeklyPeriodsCount(): number {
    if (!this.timetableData?.weeklySchedule) return 0;
    return Object.values(this.timetableData.weeklySchedule).reduce((acc, list) => acc + (list?.length || 0), 0);
  }

  constructor(
    private coachingService: CoachingService,
    private schoolService: SchoolService,
    private batchesService: BatchesService,
    private authService: AuthService,
    private dialog: MatDialog,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.startLiveClock();
    if (this.isAdminOrStaff) {
      const scopeParam = this.route.snapshot.queryParamMap.get('scope');
      const batchIdParam = this.route.snapshot.queryParamMap.get('batchId');
      if (scopeParam === 'coaching' || batchIdParam) {
        this.targetScope = 'coaching';
        if (batchIdParam) {
          this.selectedBatchId = batchIdParam;
        }
      }
      this.loadClassesAndInitialTimetable();
      this.loadBatches(this.targetScope === 'coaching');
    } else {
      this.loadTimetable();
    }
  }

  ngOnDestroy(): void {
    if (this.clockIntervalId) {
      clearInterval(this.clockIntervalId);
    }
  }

  startLiveClock(): void {
    const updateTime = () => {
      // Indian Standard Time (IST - Asia/Kolkata)
      try {
        const istStr = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }).format(new Date());
        this.liveClockTime = istStr;
      } catch {
        this.liveClockTime = new Date().toLocaleTimeString();
      }
    };
    updateTime();
    this.clockIntervalId = setInterval(updateTime, 1000);
  }

  loadClassesAndInitialTimetable(): void {
    const studentIdParam = this.route.snapshot.queryParamMap.get('studentId');
    const classIdParam = this.route.snapshot.queryParamMap.get('classId');
    const sectionIdParam = this.route.snapshot.queryParamMap.get('sectionId');

    this.schoolService.getClasses(false).subscribe({
      next: (clsList) => {
        this.classes = clsList || [];
        if (this.classes.length > 0) {
          if (classIdParam && this.classes.some(c => c.id === classIdParam)) {
            this.selectedClassId = classIdParam;
          } else {
            this.selectedClassId = this.classes[0].id;
          }

          const secs = this.currentSections;
          if (sectionIdParam && secs.some(s => s.id === sectionIdParam)) {
            this.selectedSectionId = sectionIdParam;
          } else if (secs.length > 0) {
            this.selectedSectionId = secs[0].id;
          }

          if (this.selectedSectionId && !studentIdParam) {
            this.loadSectionTimetable(this.selectedSectionId);
            return;
          }
        }

        this.loadTimetable();
      },
      error: () => {
        this.loadTimetable();
      }
    });
  }

  onClassSelect(): void {
    const secs = this.currentSections;
    if (secs.length > 0) {
      this.selectedSectionId = secs[0].id;
      this.loadSectionTimetable(this.selectedSectionId);
    } else {
      this.selectedSectionId = '';
      this.timetableData = null;
      this.errorMessage = 'No sections configured for this class.';
    }
  }

  onSectionSelect(): void {
    if (this.selectedSectionId) {
      this.loadSectionTimetable(this.selectedSectionId);
    }
  }

  loadSectionTimetable(sectionId: string): void {
    const cls = this.classes.find(c => c.id === this.selectedClassId);
    const sec = this.currentSections.find(s => s.id === sectionId);
    if (!cls || !sec) return;

    this.loading = true;
    this.errorMessage = '';

    this.schoolService.getSectionRoutine(sectionId).subscribe({
      next: (routine) => {
        this.loading = false;
        this.timetableData = this.buildTimetableDtoFromSectionRoutine(cls, sec, routine || []);
        this.selectedDay = this.timetableData.todayDayOfWeek || 'Monday';
        this.computeMaxPeriods();
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Failed to load timetable for selected section.';
      }
    });
  }

  private buildTimetableDtoFromSectionRoutine(
    cls: SchoolClassDto,
    sec: SchoolSectionDto,
    routine: SectionPeriodRoutineDto[]
  ): StudentWeeklyTimetableDto {
    const daysList = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const todayIndex = new Date().getDay();
    const todayDayName = todayIndex === 0 ? 'Sunday' : daysList[todayIndex - 1];

    const weeklySchedule: { [key: string]: StudentTimetableSlotDto[] } = {};

    daysList.forEach((fullDay, idx) => {
      const shortDay = daysShort[idx];
      const daySlots: StudentTimetableSlotDto[] = [];
      let periodNum = 1;

      const matching = (routine || []).filter(r => {
        const days = (r.daysOfWeek || 'All Days').toLowerCase();
        return days.includes(shortDay.toLowerCase()) || days.includes(fullDay.toLowerCase()) || days.includes('all');
      });

      matching.forEach(r => {
        daySlots.push({
          assignmentId: r.id,
          periodNumber: periodNum++,
          subject: r.subject,
          timeSlot: r.timeSlot || `Period ${periodNum - 1}`,
          startTime: '',
          endTime: '',
          teacherId: r.teacherId,
          teacherName: r.teacherName || 'Faculty',
          teacherPhone: r.teacherPhone,
          teacherPhoto: undefined,
          isClassTeacher: r.isClassTeacher || (sec.classTeacherId === r.teacherId),
          roomNumber: sec.roomNumber || 'Classroom',
          daysOfWeek: r.daysOfWeek || 'Mon-Sat',
          stream: 'School',
          isLiveNow: false,
          isUpcoming: false,
          isCompleted: false,
          isSubstituted: false
        });
      });

      weeklySchedule[fullDay] = daySlots;
    });

    const todayPeriods = weeklySchedule[todayDayName] || [];

    const facultyMap = new Map<string, StudentFacultyContactDto>();
    (routine || []).forEach(r => {
      if (!facultyMap.has(r.teacherId)) {
        facultyMap.set(r.teacherId, {
          teacherId: r.teacherId,
          teacherName: r.teacherName,
          subject: r.subject,
          isClassTeacher: r.isClassTeacher || (sec.classTeacherId === r.teacherId),
          phone: r.teacherPhone,
          email: undefined,
          photoUrl: undefined,
          roomNumber: undefined
        });
      } else {
        const existing = facultyMap.get(r.teacherId)!;
        if (!existing.subject.includes(r.subject)) {
          existing.subject += `, ${r.subject}`;
        }
      }
    });

    const facultyContacts = Array.from(facultyMap.values());

    return {
      studentId: sec.id,
      studentName: `${cls.name} - ${sec.name}`,
      rollNumber: `Seats: ${sec.studentCount}/${sec.maxCapacity}`,
      className: cls.name,
      sectionName: sec.name,
      batchName: undefined,
      branchName: undefined,
      classTeacherName: sec.classTeacherName,
      classTeacherPhone: sec.classTeacherPhone,
      todayDayOfWeek: todayDayName,
      currentLiveTimeIst: this.liveClockTime,
      todayPeriods,
      weeklySchedule,
      facultyContacts
    };
  }

  openConfigureRoutineDialog(): void {
    const cls = this.classes.find(c => c.id === this.selectedClassId);
    const sec = this.currentSections.find(s => s.id === this.selectedSectionId);
    if (!cls || !sec) return;

    this.coachingService.getTeachers().subscribe({
      next: (teachersList) => {
        const dialogRef = this.dialog.open(SectionRoutineDialogComponent, {
          width: '880px',
          maxWidth: '96vw',
          maxHeight: '92vh',
          panelClass: 'erp-custom-dialog',
          autoFocus: false,
          data: {
            sectionId: sec.id,
            sectionName: sec.name,
            classId: cls.id,
            className: cls.name,
            classTeacherId: sec.classTeacherId,
            classTeacherName: sec.classTeacherName,
            classTeacherPhone: sec.classTeacherPhone,
            teachers: teachersList || []
          }
        });

        dialogRef.afterClosed().subscribe(() => {
          this.loadSectionTimetable(sec.id);
        });
      }
    });
  }

  setScope(scope: 'school' | 'coaching'): void {
    this.targetScope = scope;
    if (scope === 'coaching') {
      if (this.batches.length === 0) {
        this.loadBatches(true);
      } else if (this.selectedBatchId) {
        this.loadBatchTimetable(this.selectedBatchId);
      } else if (this.filteredBatches.length > 0) {
        this.selectedBatchId = this.filteredBatches[0].id;
        this.loadBatchTimetable(this.selectedBatchId);
      }
    } else {
      if (this.selectedSectionId) {
        this.loadSectionTimetable(this.selectedSectionId);
      }
    }
  }

  loadBatches(autoLoadTimetable: boolean = false): void {
    this.batchesService.getBatches().subscribe({
      next: (bList) => {
        this.batches = bList || [];
        this.filterBatches();
        if (autoLoadTimetable && this.selectedBatchId) {
          this.loadBatchTimetable(this.selectedBatchId);
        } else if (autoLoadTimetable && this.filteredBatches.length > 0) {
          this.selectedBatchId = this.filteredBatches[0].id;
          this.loadBatchTimetable(this.selectedBatchId);
        }
      },
      error: () => {
        this.batches = [];
        this.filteredBatches = [];
      }
    });
  }

  filterBatches(): void {
    if (!this.coachingClassId) {
      this.filteredBatches = [...this.batches];
    } else {
      const cls = this.classes.find(c => c.id === this.coachingClassId);
      const clsName = cls?.name?.trim().toLowerCase();
      this.filteredBatches = this.batches.filter(b => 
        (b.classId && b.classId === this.coachingClassId) ||
        (clsName && b.className && b.className.trim().toLowerCase() === clsName)
      );
    }
    if (this.filteredBatches.length > 0) {
      if (!this.filteredBatches.some(b => b.id === this.selectedBatchId)) {
        this.selectedBatchId = this.filteredBatches[0].id;
      }
    } else {
      this.selectedBatchId = '';
    }
  }

  onCoachingClassChange(): void {
    this.filterBatches();
    if (this.selectedBatchId) {
      this.loadBatchTimetable(this.selectedBatchId);
    } else {
      this.timetableData = null;
      this.errorMessage = 'No batches found for this class.';
    }
  }

  onBatchSelect(): void {
    if (this.selectedBatchId) {
      this.loadBatchTimetable(this.selectedBatchId);
    }
  }

  loadBatchTimetable(batchId: string): void {
    if (!batchId) return;
    this.loading = true;
    this.errorMessage = '';
    this.batchesService.getBatchTimetable(batchId).subscribe({
      next: (res) => {
        this.timetableData = res;
        this.selectedDay = res.todayDayOfWeek || 'Monday';
        this.computeMaxPeriods();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Failed to load timetable for selected batch.';
      }
    });
  }

  openConfigureBatchRoutineDialog(): void {
    const batch = this.batches.find(b => b.id === this.selectedBatchId);
    if (!batch) return;

    this.coachingService.getTeachers().subscribe({
      next: (teachersList) => {
        const dialogRef = this.dialog.open(SectionRoutineDialogComponent, {
          width: '1180px',
          maxWidth: '96vw',
          maxHeight: '92vh',
          panelClass: 'erp-custom-dialog',
          autoFocus: false,
          data: {
            batchId: batch.id,
            batchName: batch.name,
            classId: batch.classId,
            className: batch.className,
            mentorTeacherId: batch.mentorTeacherId,
            mentorTeacherName: batch.mentorTeacherName,
            batchSubjects: batch.subject,
            teachers: teachersList || []
          }
        });

        dialogRef.afterClosed().subscribe(() => {
          this.loadBatchTimetable(batch.id);
        });
      }
    });
  }

  loadTimetable(): void {
    this.loading = true;
    this.errorMessage = '';

    const studentIdParam = this.route.snapshot.queryParamMap.get('studentId');

    const call$ = studentIdParam
      ? this.coachingService.getStudentTimetable(studentIdParam)
      : this.coachingService.getMyTimetable();

    call$.subscribe({
      next: (res) => {
        this.timetableData = res;
        this.selectedDay = res.todayDayOfWeek || 'Monday';
        this.computeMaxPeriods();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching student timetable:', err);
        this.errorMessage = err?.error?.message || 'Could not load your class routine. Please ensure batch or class assignments are configured.';
        this.loading = false;
      }
    });
  }

  computeMaxPeriods(): void {
    if (!this.timetableData?.weeklySchedule) return;
    let maxP = 0;
    for (const day of this.daysList) {
      const slots = this.timetableData.weeklySchedule[day] || [];
      for (const s of slots) {
        if (s.periodNumber > maxP) maxP = s.periodNumber;
      }
    }
    const count = Math.max(maxP, 6);
    this.maxPeriodsList = Array.from({ length: count }, (_, i) => i + 1);
  }

  get currentDaySlots(): StudentTimetableSlotDto[] {
    if (!this.timetableData?.weeklySchedule) return [];
    return this.timetableData.weeklySchedule[this.selectedDay] || [];
  }

  get currentLivePeriod(): StudentTimetableSlotDto | undefined {
    if (!this.timetableData?.todayPeriods) return undefined;
    return this.timetableData.todayPeriods.find(s => s.isLiveNow);
  }

  selectDay(day: string): void {
    this.selectedDay = day;
    this.viewMode = 'daily';
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'daily' ? 'weekly' : 'daily';
  }

  getSlotForDayAndPeriod(day: string, periodNumber: number): StudentTimetableSlotDto | undefined {
    if (!this.timetableData?.weeklySchedule) return undefined;
    const slots = this.timetableData.weeklySchedule[day] || [];
    return slots.find(s => s.periodNumber === periodNumber);
  }

  getPeriodTimeHeader(periodNumber: number): string {
    if (!this.timetableData?.weeklySchedule) return '';
    for (const day of this.daysList) {
      const slot = this.getSlotForDayAndPeriod(day, periodNumber);
      if (slot?.timeSlot) return slot.timeSlot;
    }
    return '';
  }

  getPeriodCountForDay(day: string): number {
    if (!this.timetableData?.weeklySchedule) return 0;
    return (this.timetableData.weeklySchedule[day] || []).length;
  }

  get activeSubjects(): string[] {
    if (!this.timetableData?.weeklySchedule) return [];
    const set = new Set<string>();
    for (const day of this.daysList) {
      const slots = this.timetableData.weeklySchedule[day] || [];
      for (const s of slots) {
        if (s.subject) {
          const parts = s.subject.split(',').map(p => p.trim()).filter(Boolean);
          if (parts.length > 1) {
            parts.forEach(p => set.add(p));
          } else {
            set.add(s.subject.trim());
          }
        }
      }
    }
    return Array.from(set);
  }

  getSubjectTheme(subject: string | null | undefined): { bg: string; border: string; text: string; darkText: string; icon: string } {
    if (!subject) {
      return { bg: '#f8fafc', border: '#64748b', text: '#475569', darkText: '#0f172a', icon: 'school' };
    }
    const clean = subject.trim().toLowerCase();

    if (clean.includes('comp') || clean.includes('it') || clean.includes('cs') || clean.includes('informatic')) {
      return { bg: '#eef2ff', border: '#4f46e5', text: '#4338ca', darkText: '#1e1b4b', icon: 'terminal' };
    }
    if (clean.includes('math') || clean.includes('calc') || clean.includes('algebra') || clean.includes('stat')) {
      return { bg: '#eff6ff', border: '#2563eb', text: '#1d4ed8', darkText: '#172554', icon: 'calculate' };
    }
    if (clean.includes('physic')) {
      return { bg: '#f5f3ff', border: '#7c3aed', text: '#6d28d9', darkText: '#2e1065', icon: 'bolt' };
    }
    if (clean.includes('chem')) {
      return { bg: '#f0fdfa', border: '#0d9488', text: '#0f766e', darkText: '#042f2e', icon: 'science' };
    }
    if (clean.includes('bio') || clean.includes('botany') || clean.includes('zoolog')) {
      return { bg: '#ecfdf5', border: '#059669', text: '#047857', darkText: '#022c22', icon: 'biotech' };
    }
    if (clean.includes('eng') || clean.includes('lit')) {
      return { bg: '#fffbeb', border: '#d97706', text: '#b45309', darkText: '#451a03', icon: 'menu_book' };
    }
    if (clean.includes('hindi') || clean.includes('sanskrit') || clean.includes('urdu') || clean.includes('french')) {
      return { bg: '#fef2f2', border: '#ef4444', text: '#b91c1c', darkText: '#450a0a', icon: 'translate' };
    }
    if (clean.includes('social') || clean.includes('hist') || clean.includes('geo') || clean.includes('civic') || clean.includes('pol')) {
      return { bg: '#f0f9ff', border: '#0284c7', text: '#0369a1', darkText: '#082f49', icon: 'public' };
    }
    if (clean.includes('econ') || clean.includes('account') || clean.includes('bus') || clean.includes('comm')) {
      return { bg: '#f0fdf4', border: '#16a34a', text: '#15803d', darkText: '#052e16', icon: 'query_stats' };
    }
    if (clean.includes('draw') || clean.includes('art') || clean.includes('craft') || clean.includes('music')) {
      return { bg: '#fdf2f8', border: '#db2777', text: '#be185d', darkText: '#500724', icon: 'palette' };
    }
    if (clean.includes('sport') || clean.includes('pe') || clean.includes('physical') || clean.includes('yoga')) {
      return { bg: '#ecfeff', border: '#0891b2', text: '#0e7490', darkText: '#083344', icon: 'sports_soccer' };
    }

    // Deterministic Google Calendar pastel palette
    let hash = 0;
    for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash % 360);
    return {
      bg: `hsl(${hue}, 85%, 96%)`,
      border: `hsl(${hue}, 75%, 45%)`,
      text: `hsl(${hue}, 80%, 35%)`,
      darkText: `hsl(${hue}, 90%, 15%)`,
      icon: 'school'
    };
  }

  getSubjectColor(subject: string | null | undefined): string {
    return this.getSubjectTheme(subject).border;
  }

  getInitials(name: string | null | undefined): string {
    if (!name) return 'FC';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  cleanPhone(phone: string | null | undefined): string {
    if (!phone) return '';
    return phone.replace(/[^0-9]/g, '');
  }

  formatRoom(room: string | null | undefined): string {
    if (!room) return '';
    const trimmed = room.trim();
    if (/^room/i.test(trimmed)) return trimmed;
    return `Room ${trimmed}`;
  }

  formatSlotTime(time: string | null | undefined): string {
    if (!time) return '';
    let cleaned = time.replace(/\s*-\s*/, ' – ');
    if (cleaned.includes('AM – ') && cleaned.endsWith('AM')) {
      cleaned = cleaned.replace('AM – ', '– ');
    } else if (cleaned.includes('PM – ') && cleaned.endsWith('PM')) {
      cleaned = cleaned.replace('PM – ', '– ');
    }
    return cleaned;
  }

  triggerPrint(): void {
    window.print();
  }
}
