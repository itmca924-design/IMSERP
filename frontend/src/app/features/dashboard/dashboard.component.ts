import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, NgZone, signal, computed, effect, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { skip, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { CoachingService, StudentDashboardSummary, TeacherDashboardSummary } from '../../core/services/coaching.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { EventsService, DashboardCelebrationsSummary, SchoolEvent, BirthdayItem } from '../../core/services/events.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { EventFormDialogComponent } from '../events/event-form-dialog.component';
import { EventGalleryDialogComponent } from '../events/event-gallery-dialog.component';
import { StudentVoiceDialogComponent } from '../finance/dialogs/student-voice-dialog.component';
import { FeeReminderDispatchDialogComponent } from './dialogs/fee-reminder-dispatch-dialog.component';
import { AiErpCopilotService, ExecutiveQueryResult } from '../../core/services/ai-erp-copilot.service';
import { environment } from '../../../environments/environment';
import ApexCharts from 'apexcharts';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatPaginatorModule,
    MatSortModule,
    MatChipsModule,
    MatTooltipModule,
    MatMenuModule,
    MatDialogModule,
    RouterModule
  ],
  template: `
    <div class="dashboard-wrapper">
      <!-- ========================================== -->
      <!-- 🎓 1. STUDENT & PARENT ACADEMIC HUB       -->
      <!-- ========================================== -->
      @if (authService.isStudentOrParent()) {
        @if (studentSummary(); as st) {
    
          <!-- Student 6 KPI Stat Cards -->
          <div class="card-container">
            <!-- 1. Attendance -->
            <mat-card class="stat-card emerald mat-elevation-z2" routerLink="/students/my-profile">
              <mat-card-content class="stat-content">
                <div class="stat-header">
                  <span class="label">My Attendance</span>
                  <div class="stat-icon-wrap">
                    <mat-icon class="stat-icon">how_to_reg</mat-icon>
                  </div>
                </div>
                <div class="stat-body">
                  <span class="value">{{ st.attendancePercentage }}%</span>
                  <div class="stat-footer">
                    <span class="stat-badge-pill">{{ st.presentDays }}/{{ st.totalAttendanceDays }} Days</span>
                    <span class="sub-label">{{ st.attendanceStatusTag || 'Current Academic Year' }}</span>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
    
            <!-- 2. Fee Dues -->
            <mat-card class="stat-card orange mat-elevation-z2" routerLink="/students/my-profile">
              <mat-card-content class="stat-content">
                <div class="stat-header">
                  <span class="label">My Fee Balance</span>
                  <div class="stat-icon-wrap">
                    <mat-icon class="stat-icon">account_balance_wallet</mat-icon>
                  </div>
                </div>
                <div class="stat-body">
                  <span class="value">₹{{ st.totalFeeDue | number:'1.0-0' }}</span>
                  <div class="stat-footer">
                    @if (st.lastReceiptNumber) {
                      <span class="stat-badge-pill">Paid ₹{{ st.lastPaymentAmount | number:'1.0-0' }}</span>
                      <span class="sub-label">Rcpt: {{ st.lastReceiptNumber }}</span>
                    } @else if (st.totalFeeDue === 0) {
                      <span class="stat-badge-pill">All Cleared</span>
                      <span class="sub-label">No dues pending</span>
                    } @else {
                      <span class="stat-badge-pill">Pending Due</span>
                      <span class="sub-label">Due Soon</span>
                    }
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
    
            <!-- 3. Upcoming Tests -->
            <mat-card class="stat-card purple mat-elevation-z2" routerLink="/school/exams">
              <mat-card-content class="stat-content">
                <div class="stat-header">
                  <span class="label">Upcoming Tests</span>
                  <div class="stat-icon-wrap">
                    <mat-icon class="stat-icon">quiz</mat-icon>
                  </div>
                </div>
                <div class="stat-body">
                  <span class="value">{{ st.upcomingTestsCount }}</span>
                  <div class="stat-footer">
                    <span class="stat-badge-pill">Exams</span>
                    <span class="sub-label">{{ st.latestTestSubject ? 'Prep: ' + st.latestTestSubject : 'No immediate test' }}</span>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
    
            <!-- 4. Today's Homework -->
            <mat-card class="stat-card blue mat-elevation-z2" routerLink="/school/homework">
              <mat-card-content class="stat-content">
                <div class="stat-header">
                  <span class="label">Today's Homework</span>
                  <div class="stat-icon-wrap">
                    <mat-icon class="stat-icon">assignment</mat-icon>
                  </div>
                </div>
                <div class="stat-body">
                  <span class="value">{{ st.pendingHomeworkCount }}</span>
                  <div class="stat-footer">
                    <span class="stat-badge-pill">Active Diary</span>
                    <span class="sub-label">Assignments to complete</span>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
    
            <!-- 5. Library Books -->
            <mat-card class="stat-card teal mat-elevation-z2">
              <mat-card-content class="stat-content">
                <div class="stat-header">
                  <span class="label">Books Borrowed</span>
                  <div class="stat-icon-wrap">
                    <mat-icon class="stat-icon">local_library</mat-icon>
                  </div>
                </div>
                <div class="stat-body">
                  <span class="value">{{ st.issuedBooksCount }}</span>
                  <div class="stat-footer">
                    @if (st.overdueBooksCount > 0) {
                      <span class="stat-badge-pill" style="background: rgba(239, 68, 68, 0.45);">{{ st.overdueBooksCount }} Overdue</span>
                      <span class="sub-label">Return soon</span>
                    } @else {
                      <span class="stat-badge-pill">In Possession</span>
                      <span class="sub-label">0 Overdue</span>
                    }
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
    
            <!-- 6. Wall of Fame -->
            <mat-card class="stat-card whatsapp mat-elevation-z2" routerLink="/students/my-profile">
              <mat-card-content class="stat-content">
                <div class="stat-header">
                  <span class="label">Wall of Fame</span>
                  <div class="stat-icon-wrap">
                    <mat-icon class="stat-icon">military_tech</mat-icon>
                  </div>
                </div>
                <div class="stat-body">
                  <span class="value">{{ st.totalAccoladesCount }}</span>
                  <div class="stat-footer">
                    <span class="stat-badge-pill">Star Scholar</span>
                    <span class="sub-label">Medals &amp; Badges</span>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
    
          <!-- Student Identity Hero Banner -->
          <div class="role-hero-banner student-theme mat-elevation-z2">
            <div class="hero-left">
              <div class="hero-avatar-wrap">
                <span class="hero-avatar">{{ (st.studentName || 'S').charAt(0).toUpperCase() }}</span>
                <span class="online-dot" title="Active Student"></span>
              </div>
              <div class="hero-info">
                <div class="hero-name-row">
                  <h3 class="hero-name">{{ st.studentName }}</h3>
                  <span class="hero-badge badge-grade">{{ st.className ? (st.sectionName ? st.className + ' - ' + st.sectionName : st.className) : (st.batchName || 'Enrolled Student') }}</span>
                  @if (st.isStarPerformer) {
                    <span class="hero-badge badge-active">{{ st.performanceBadge || 'Star Scholar' }}</span>
                  }
                </div>
                <div class="hero-meta-row">
                  <span><mat-icon>badge</mat-icon> Roll No: <strong>{{ st.rollNumber || '-' }}</strong></span>
                  <span><mat-icon>tag</mat-icon> Adm No: <strong>{{ st.admissionNumber || '-' }}</strong></span>
                  <span><mat-icon>domain</mat-icon> Branch: <strong>{{ st.branchName || '-' }}</strong></span>
                </div>
              </div>
            </div>
            <div class="hero-actions">
              <a matButton="filled" color="primary" class="hero-action-btn" routerLink="/students/my-profile">
                <mat-icon>workspace_premium</mat-icon>
                <span>My 360° Profile &amp; Wall of Fame</span>
              </a>
            </div>
          </div>
    
          <!-- Student Row 1: Today's Routine & Timetable + Today's Homework Diary -->
          <div class="hub-grid-2col">
            <!-- Left: Today's Timetable -->
            <mat-card class="hub-card mat-elevation-z2">
              <div class="widget-header">
                <div class="widget-title-wrap">
                  <div class="widget-icon-box">
                    <mat-icon>schedule</mat-icon>
                  </div>
                  <div>
                    <h3 class="widget-title">Today's Class Timetable &amp; Schedule</h3>
                    <p class="widget-sub">Daily routine for {{ st.className || st.batchName || 'Student' }}</p>
                  </div>
                </div>
              </div>
              <mat-card-content class="widget-content">
                @if (st.todayRoutine.length) {
                  <div class="routine-list">
                    @for (item of st.todayRoutine; track $index) {
                      <div class="routine-item-card">
                        <div class="routine-time-box">
                          <span class="period-num">{{ item.periodName || ('Period ' + ($index + 1)) }}</span>
                          <span class="time-range">{{ item.timeSlot }}</span>
                        </div>
                        <div class="routine-details">
                          <div class="subj-row">
                            <span class="subj-name">{{ item.subject }}</span>
                            @if (item.roomNumber) {
                              <span class="room-chip"><mat-icon>meeting_room</mat-icon> Room {{ item.roomNumber }}</span>
                            }
                          </div>
                          @if (item.teacherName) {
                            <span class="teacher-lbl">
                              <mat-icon>person</mat-icon> {{ item.teacherName }}
                            </span>
                          }
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="hub-empty-state">
                    <mat-icon class="empty-icon">event_busy</mat-icon>
                    <p class="empty-title">No Lectures Scheduled Today</p>
                    <p class="empty-sub">Enjoy your study time or weekend! Classes will appear here automatically on academic days.</p>
                  </div>
                }
              </mat-card-content>
            </mat-card>
    
            <!-- Right: Today's Homework Diary -->
            <mat-card class="hub-card mat-elevation-z2">
              <div class="widget-header">
                <div class="widget-title-wrap">
                  <div class="widget-icon-box">
                    <mat-icon>assignment</mat-icon>
                  </div>
                  <div>
                    <h3 class="widget-title">Homework &amp; Class Diary</h3>
                    <p class="widget-sub">Teacher assignments and submissions</p>
                  </div>
                </div>
                <a matButton="filled" color="primary" routerLink="/school/homework" class="hub-link-btn">
                  <span>View All</span>
                  <mat-icon>arrow_forward</mat-icon>
                </a>
              </div>
              <mat-card-content class="widget-content">
                @if (st.recentHomework.length) {
                  <div class="homework-list">
                    @for (hw of st.recentHomework; track hw.id) {
                      <div class="hw-item-card">
                        <div class="hw-top-row">
                          <span class="hw-subj-pill">{{ hw.subject }}</span>
                          <span class="hw-due-pill">Due: {{ hw.dueDate | date:'dd MMM' }}</span>
                        </div>
                        <h4 class="hw-title">{{ hw.title }}</h4>
                        @if (hw.description) {
                          <p class="hw-desc">{{ hw.description }}</p>
                        }
                        <div class="hw-bottom-row">
                          <span class="hw-teacher"><mat-icon>school</mat-icon> By {{ hw.teacherName || 'Faculty' }}</span>
                          <span class="hw-date">Assigned {{ hw.assignedDate | date:'dd MMM' }}</span>
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="hub-empty-state">
                    <mat-icon class="empty-icon text-green">assignment_turned_in</mat-icon>
                    <p class="empty-title">All Caught Up!</p>
                    <p class="empty-sub">No pending homework assignments in your diary right now.</p>
                  </div>
                }
              </mat-card-content>
            </mat-card>
          </div>
    
          <!-- Student Row 2: Upcoming Tests & Exams + Borrowed Library Books -->
          <div class="hub-grid-2col">
            <!-- Left: Upcoming Tests -->
            <mat-card class="hub-card mat-elevation-z2">
              <div class="widget-header">
                <div class="widget-title-wrap">
                  <div class="widget-icon-box">
                    <mat-icon>quiz</mat-icon>
                  </div>
                  <div>
                    <h3 class="widget-title">Upcoming Tests &amp; Exams</h3>
                    <p class="widget-sub">Tests scheduled for your classroom</p>
                  </div>
                </div>
                <a matButton="filled" color="primary" routerLink="/school/exams" class="hub-link-btn">
                  <span>Exam Desk</span>
                  <mat-icon>arrow_forward</mat-icon>
                </a>
              </div>
              <mat-card-content class="widget-content">
                @if (st.upcomingTests.length) {
                  <div class="tests-list">
                    @for (t of st.upcomingTests; track $index) {
                      <div class="test-item-card">
                        <div class="test-date-badge">
                          <span class="m">{{ t.testDate | date:'MMM' | uppercase }}</span>
                          <span class="d">{{ t.testDate | date:'dd' }}</span>
                        </div>
                        <div class="test-details">
                          <div class="test-name-row">
                            <h4 class="test-title">{{ t.title }}</h4>
                            <span class="test-marks-chip">{{ t.maxMarks }} Marks</span>
                          </div>
                          <span class="test-subj"><mat-icon>menu_book</mat-icon> {{ t.subject }}</span>
                          @if (t.batchOrClass) {
                            <p class="test-syllabus">
                              <strong>Target:</strong> {{ t.batchOrClass }}
                            </p>
                          }
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="hub-empty-state">
                    <mat-icon class="empty-icon">verified</mat-icon>
                    <p class="empty-title">No Upcoming Tests</p>
                    <p class="empty-sub">No tests or exams are scheduled for this week.</p>
                  </div>
                }
              </mat-card-content>
            </mat-card>
    
            <!-- Right: Borrowed Library Books -->
            <mat-card class="hub-card mat-elevation-z2">
              <div class="widget-header">
                <div class="widget-title-wrap">
                  <div class="widget-icon-box">
                    <mat-icon>local_library</mat-icon>
                  </div>
                  <div>
                    <h3 class="widget-title">Borrowed Library Books</h3>
                    <p class="widget-sub">Books currently issued to your library account</p>
                  </div>
                </div>
              </div>
              <mat-card-content class="widget-content">
                @if (st.issuedBooks.length) {
                  <div class="books-list">
                    @for (b of st.issuedBooks; track b.id) {
                      <div class="book-item-card" [class.is-overdue]="b.isOverdue">
                        <div class="book-icon-badge">
                          <mat-icon>auto_stories</mat-icon>
                        </div>
                        <div class="book-details">
                          <div class="book-title-row">
                            <h4 class="book-title">{{ b.bookTitle }}</h4>
                            <span class="book-status-pill" [class.overdue]="b.isOverdue">
                              {{ b.isOverdue ? 'Overdue' : 'Issued' }}
                            </span>
                          </div>
                          @if (b.accessionNumber) {
                            <span class="book-author">Acc: {{ b.accessionNumber }}</span>
                          }
                          <div class="book-dates-row">
                            <span>Issued: {{ b.issueDate | date:'dd MMM yyyy' }}</span>
                            <span class="due-text" [class.text-red]="b.isOverdue">
                              Return Due: <strong>{{ b.dueDate | date:'dd MMM yyyy' }}</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="hub-empty-state">
                    <mat-icon class="empty-icon">menu_book</mat-icon>
                    <p class="empty-title">No Books Issued</p>
                    <p class="empty-sub">Visit the school library to borrow storybooks, course guides, and reference material.</p>
                  </div>
                }
              </mat-card-content>
            </mat-card>
          </div>
    
          <!-- Student Row 3: Official Circulars & Notices + School Celebrations Radar -->
          <div class="hub-grid-2col">
            <!-- Left: Official Notices & Circulars -->
            <mat-card class="hub-card mat-elevation-z2">
              <div class="widget-header">
                <div class="widget-title-wrap">
                  <div class="widget-icon-box">
                    <mat-icon>campaign</mat-icon>
                  </div>
                  <div>
                    <h3 class="widget-title">Official Circulars &amp; Notices</h3>
                    <p class="widget-sub">School administration announcements</p>
                  </div>
                </div>
                <a matButton="filled" color="primary" routerLink="/school-notices" class="hub-link-btn">
                  <span>Notice Board</span>
                  <mat-icon>arrow_forward</mat-icon>
                </a>
              </div>
              <mat-card-content class="widget-content">
                @if (st.recentNotices.length) {
                  <div class="notices-list">
                    @for (n of st.recentNotices; track n.id) {
                      <div class="notice-item-card">
                        <div class="notice-header-row">
                          <span class="notice-cat-chip" [ngClass]="n.category.toLowerCase()">{{ n.category }}</span>
                          <span class="notice-date">{{ n.publishedDate | date:'dd MMM yyyy' }}</span>
                        </div>
                        <h4 class="notice-title">{{ n.title }}</h4>
                        <p class="notice-desc">{{ n.content }}</p>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="hub-empty-state">
                    <mat-icon class="empty-icon">notifications_paused</mat-icon>
                    <p class="empty-title">No Active Circulars</p>
                    <p class="empty-sub">New announcements from the principal and teachers will appear here.</p>
                  </div>
                }
              </mat-card-content>
            </mat-card>
    
    
            <!-- Right: Campus Happenings & Birthday Radar -->
            <mat-card class="hub-card mat-elevation-z2">
              <div class="widget-header">
                <div class="widget-title-wrap">
                  <div class="widget-icon-box">
                    <mat-icon>celebration</mat-icon>
                  </div>
                  <div>
                    <h3 class="widget-title">Campus Happenings &amp; Birthdays</h3>
                    <p class="widget-sub">{{ birthdayRadarSubtitle() }}</p>
                  </div>
                </div>
              </div>
              <mat-card-content class="widget-content">
                @if (celebrations()?.todayBirthdays?.length) {
                  <div class="today-bday-list">
                    @for (b of celebrations()!.todayBirthdays; track b.id) {
                      <div class="bday-item-card">
                        <div class="bday-avatar-wrap">
                          @if (b.photoUrl) {
                            <img [src]="b.photoUrl" [alt]="b.name" class="bday-avatar" />
                          }
                          @if (!b.photoUrl) {
                            <div class="bday-avatar-fallback">
                              {{ b.name.substring(0, 1) | uppercase }}
                            </div>
                          }
                          <span class="confetti-emoji">🎉</span>
                        </div>
                        <div class="bday-details">
                          <div class="bday-name-row">
                            <span class="person-name">{{ b.name }}</span>
                            <span class="role-pill" [class.staff]="b.role === 'Staff'">{{ b.role }}</span>
                          </div>
                          <span class="bday-meta">
                            {{ b.classOrDepartment || 'Student' }} • Turning {{ b.ageTurning }} yrs
                          </span>
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="hub-empty-state">
                    <mat-icon class="empty-icon">sentiment_satisfied_alt</mat-icon>
                    <p class="empty-title">No Birthdays Today</p>
                    <p class="empty-sub">Check back tomorrow for campus celebrations!</p>
                  </div>
                }
              </mat-card-content>
            </mat-card>
          </div>
    
        } @else if (!loading()) {
          <div class="dashboard-fallback-state mat-elevation-z1">
            <div class="fallback-icon-box">
              <mat-icon>school</mat-icon>
            </div>
            <h3>Student Academic Hub</h3>
            <p>Unable to retrieve student profile or academic records. Please click below to refresh.</p>
            <button color="primary" (click)="loadSummary()" matButton="filled">
              <mat-icon>refresh</mat-icon> Refresh
            </button>
          </div>
        }
      }
    
      <!-- ========================================== -->
      <!-- 👨‍🏫 2. TEACHER & FACULTY OPERATIONS HUB     -->
      <!-- ========================================== -->
      @if (authService.isTeacher()) {
        @if (teacherSummary(); as tc) {
    
          <!-- Teacher 6 KPI Stat Cards -->
          <div class="card-container">
            <!-- 1. Today's Lectures -->
            <mat-card class="stat-card blue mat-elevation-z2">
              <mat-card-content class="stat-content">
                <div class="stat-header">
                  <span class="label">Today's Lectures</span>
                  <div class="stat-icon-wrap">
                    <mat-icon class="stat-icon">schedule</mat-icon>
                  </div>
                </div>
                <div class="stat-body">
                  <span class="value">{{ tc.todayLecturesCount }}</span>
                  <div class="stat-footer">
                    <span class="stat-badge-pill">Routine</span>
                    <span class="sub-label">Assigned periods today</span>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
    
            <!-- 2. Assigned Batches -->
            <mat-card class="stat-card teal mat-elevation-z2" routerLink="/batches">
              <mat-card-content class="stat-content">
                <div class="stat-header">
                  <span class="label">Assigned Batches</span>
                  <div class="stat-icon-wrap">
                    <mat-icon class="stat-icon">groups</mat-icon>
                  </div>
                </div>
                <div class="stat-body">
                  <span class="value">{{ tc.assignedBatchesCount }}</span>
                  <div class="stat-footer">
                    <span class="stat-badge-pill">Classrooms</span>
                    <span class="sub-label">Active sections under you</span>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
    
            <!-- 3. Pending Marks Entry -->
            <mat-card class="stat-card orange mat-elevation-z2" routerLink="/tests" style="cursor: pointer;">
              <mat-card-content class="stat-content">
                <div class="stat-header">
                  <span class="label">Pending Marks Entry</span>
                  <div class="stat-icon-wrap">
                    <mat-icon class="stat-icon">pending_actions</mat-icon>
                  </div>
                </div>
                <div class="stat-body">
                  <span class="value">{{ tc.pendingMarksEntryTestsCount }}</span>
                  <div class="stat-footer">
                    <span class="stat-badge-pill">Evaluation</span>
                    <span class="sub-label">Tests awaiting grading</span>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
    
            <!-- 4. Homework Given This Week -->
            <mat-card class="stat-card purple mat-elevation-z2" routerLink="/school/homework">
              <mat-card-content class="stat-content">
                <div class="stat-header">
                  <span class="label">Homework Posted</span>
                  <div class="stat-icon-wrap">
                    <mat-icon class="stat-icon">menu_book</mat-icon>
                  </div>
                </div>
                <div class="stat-body">
                  <span class="value">{{ tc.homeworkGivenThisWeekCount }}</span>
                  <div class="stat-footer">
                    <span class="stat-badge-pill">This Week</span>
                    <span class="sub-label">Active diary tasks</span>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
    
            <!-- 5. Leave Balance -->
            <mat-card class="stat-card emerald mat-elevation-z2">
              <mat-card-content class="stat-content">
                <div class="stat-header">
                  <span class="label">Leave Balance</span>
                  <div class="stat-icon-wrap">
                    <mat-icon class="stat-icon">beach_access</mat-icon>
                  </div>
                </div>
                <div class="stat-body">
                  <span class="value">{{ (tc.casualLeaveBalance || 0) + (tc.medicalLeaveBalance || 0) }} <small style="font-size: 0.9rem;">Days</small></span>
                  <div class="stat-footer">
                    <span class="stat-badge-pill">CL: {{ tc.casualLeaveBalance || 0 }} | ML: {{ tc.medicalLeaveBalance || 0 }}</span>
                    <span class="sub-label">Paid leaves remaining</span>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
    
            <!-- 6. Punch Status -->
            <mat-card class="stat-card whatsapp mat-elevation-z2">
              <mat-card-content class="stat-content">
                <div class="stat-header">
                  <span class="label">Biometric Punch</span>
                  <div class="stat-icon-wrap">
                    <mat-icon class="stat-icon">fingerprint</mat-icon>
                  </div>
                </div>
                <div class="stat-body">
                  <span class="value">{{ tc.hasPunchedInToday ? 'Punched In' : 'Not Punched' }}</span>
                  <div class="stat-footer">
                    <span class="stat-badge-pill">Live Status</span>
                    <span class="sub-label">{{ tc.todayPunchTime ? 'In at ' + tc.todayPunchTime : 'Not punched today' }}</span>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
    
          <!-- Teacher Identity Hero Banner -->
          <div class="role-hero-banner teacher-theme mat-elevation-z2">
            <div class="hero-left">
              <div class="hero-avatar-wrap">
                <span class="hero-avatar">{{ (tc.teacherName || 'T').charAt(0).toUpperCase() }}</span>
                <span class="online-dot" title="Active Faculty"></span>
              </div>
              <div class="hero-info">
                <div class="hero-name-row">
                  <h3 class="hero-name">{{ tc.teacherName }}</h3>
                  <span class="hero-badge badge-grade">{{ tc.designation || 'Faculty Member' }}</span>
                  @if (tc.department) {
                    <span class="hero-badge badge-dept">{{ tc.department }}</span>
                  }
                </div>
                <div class="hero-meta-row">
                  <span><mat-icon>badge</mat-icon> Emp Code: <strong>{{ tc.employeeCode || '-' }}</strong></span>
                  <span><mat-icon>domain</mat-icon> Branch: <strong>{{ tc.branchName || '-' }}</strong></span>
                  <span><mat-icon>schedule</mat-icon> Punch: <strong>{{ tc.hasPunchedInToday ? 'Punched In' : 'Not Punched' }}</strong> ({{ tc.todayPunchTime || 'No punch record' }})</span>
                </div>
              </div>
            </div>
            <div class="hero-actions">
              <a matButton="filled" color="primary" class="hero-action-btn" routerLink="/students/attendance">
                <mat-icon>how_to_reg</mat-icon>
                <span>Take Roll Call</span>
              </a>
            </div>
          </div>
    
          <!-- Teacher Row 1: Today's Teaching Schedule + Pending Marks Entry -->
          <div class="hub-grid-2col">
            <!-- Left: Today's Teaching Schedule -->
            <mat-card class="hub-card mat-elevation-z2">
              <div class="widget-header">
                <div class="widget-title-wrap">
                  <div class="widget-icon-box">
                    <mat-icon>schedule</mat-icon>
                  </div>
                  <div>
                    <h3 class="widget-title">Today's Teaching Schedule</h3>
                    <p class="widget-sub">Periods &amp; classrooms assigned to you today</p>
                  </div>
                </div>
              </div>
              <mat-card-content class="widget-content">
                @if (tc.todaySchedule.length) {
                  <div class="routine-list">
                    @for (lec of tc.todaySchedule; track $index) {
                      <div class="routine-item-card">
                        <div class="routine-time-box">
                          <span class="period-num">{{ lec.periodName || ('Period ' + ($index + 1)) }}</span>
                          <span class="time-range">{{ lec.timeSlot }}</span>
                        </div>
                        <div class="routine-details">
                          <div class="subj-row">
                            <span class="subj-name">{{ lec.subject }}</span>
                            @if (lec.roomNumber) {
                              <span class="room-chip"><mat-icon>meeting_room</mat-icon> Room {{ lec.roomNumber }}</span>
                            }
                          </div>
                          <span class="teacher-lbl">
                            <mat-icon>groups</mat-icon> {{ lec.classOrBatch }}
                          </span>
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="hub-empty-state">
                    <mat-icon class="empty-icon">check_circle</mat-icon>
                    <p class="empty-title">No Lectures Scheduled Today</p>
                    <p class="empty-sub">No timetable periods assigned to you for today.</p>
                  </div>
                }
              </mat-card-content>
            </mat-card>
    
            <!-- Right: Pending Marks Entry -->
            <mat-card class="hub-card mat-elevation-z2">
              <div class="widget-header">
                <div class="widget-title-wrap">
                  <div class="widget-icon-box">
                    <mat-icon>edit_note</mat-icon>
                  </div>
                  <div>
                    <h3 class="widget-title">Tests Awaiting Marks Entry</h3>
                    <p class="widget-sub">Grade your students to update progress reports</p>
                  </div>
                </div>
                <a matButton="filled" color="primary" routerLink="/tests" class="hub-link-btn">
                  <span>Exams Desk</span>
                  <mat-icon>arrow_forward</mat-icon>
                </a>
              </div>
              <mat-card-content class="widget-content">
                @if (tc.pendingTests.length) {
                  <div class="tests-list">
                    @for (pt of tc.pendingTests; track pt.testId) {
                      <div class="test-item-card" [routerLink]="['/tests']" [queryParams]="{ examId: pt.testId }" style="cursor: pointer;">
                        <div class="test-date-badge">
                          <span class="m">{{ pt.testDate | date:'MMM' | uppercase }}</span>
                          <span class="d">{{ pt.testDate | date:'dd' }}</span>
                        </div>
                        <div class="test-details">
                          <div class="test-name-row">
                            <h4 class="test-title">{{ pt.title }}</h4>
                            <span class="test-marks-chip">Pending</span>
                          </div>
                          <span class="test-subj"><mat-icon>groups</mat-icon> {{ pt.batchOrClass }} • {{ pt.subject }}</span>
                          <div class="test-eval-row">
                            <span class="eval-stat">Pending Marks Entry</span>
                            <a matButton="filled" color="primary" class="enter-marks-mini-btn" [routerLink]="['/tests']" [queryParams]="{ examId: pt.testId }" (click)="$event.stopPropagation()">
                              Enter Marks
                            </a>
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="hub-empty-state">
                    <mat-icon class="empty-icon text-green">task_alt</mat-icon>
                    <p class="empty-title">All Tests Evaluated!</p>
                    <p class="empty-sub">Great job! You have no pending marks entries waiting for your classes.</p>
                  </div>
                }
              </mat-card-content>
            </mat-card>
          </div>
    
          <!-- Teacher Row 2: Faculty Quick Operations + Campus Celebrations -->
          <div class="hub-grid-2col">
            <!-- Left: Quick Actions Grid -->
            <mat-card class="hub-card mat-elevation-z2">
              <div class="widget-header">
                <div class="widget-title-wrap">
                  <div class="widget-icon-box">
                    <mat-icon>bolt</mat-icon>
                  </div>
                  <div>
                    <h3 class="widget-title">Faculty Quick Actions</h3>
                    <p class="widget-sub">One-click operational shortcuts</p>
                  </div>
                </div>
              </div>
              <mat-card-content class="widget-content">
                <div class="quick-actions-grid">
                  <a class="action-tile blue-tile" routerLink="/students/attendance">
                    <mat-icon>how_to_reg</mat-icon>
                    <span class="tile-title">Take Roll Call</span>
                    <span class="tile-desc">Mark student daily attendance</span>
                  </a>
                  <a class="action-tile purple-tile" routerLink="/school/homework">
                    <mat-icon>assignment</mat-icon>
                    <span class="tile-title">Post Homework</span>
                    <span class="tile-desc">Add homework to student diary</span>
                  </a>
                  <a class="action-tile orange-tile" routerLink="/school/exams">
                    <mat-icon>quiz</mat-icon>
                    <span class="tile-title">Schedule Test</span>
                    <span class="tile-desc">Create classroom test &amp; enter marks</span>
                  </a>
                  <a class="action-tile teal-tile" routerLink="/teachers/substitution">
                    <mat-icon>swap_horiz</mat-icon>
                    <span class="tile-title">Substitution</span>
                    <span class="tile-desc">Check substitute teacher routine</span>
                  </a>
                </div>
              </mat-card-content>
            </mat-card>
    
            <!-- Right: Campus Happenings & Birthdays Radar -->
            <mat-card class="hub-card mat-elevation-z2">
              <div class="widget-header">
                <div class="widget-title-wrap">
                  <div class="widget-icon-box">
                    <mat-icon>celebration</mat-icon>
                  </div>
                  <div>
                    <h3 class="widget-title">Campus Happenings &amp; Birthdays</h3>
                    <p class="widget-sub">{{ birthdayRadarSubtitle() }}</p>
                  </div>
                </div>
              </div>
              <mat-card-content class="widget-content">
                @if (celebrations()?.todayBirthdays?.length) {
                  <div class="today-bday-list">
                    @for (b of celebrations()!.todayBirthdays; track b.id) {
                      <div class="bday-item-card">
                        <div class="bday-avatar-wrap">
                          @if (b.photoUrl) {
                            <img [src]="b.photoUrl" [alt]="b.name" class="bday-avatar" />
                          }
                          @if (!b.photoUrl) {
                            <div class="bday-avatar-fallback">
                              {{ b.name.substring(0, 1) | uppercase }}
                            </div>
                          }
                          <span class="confetti-emoji">🎉</span>
                        </div>
                        <div class="bday-details">
                          <div class="bday-name-row">
                            <span class="person-name">{{ b.name }}</span>
                            <span class="role-pill" [class.staff]="b.role === 'Staff'">{{ b.role }}</span>
                          </div>
                          <span class="bday-meta">
                            {{ b.classOrDepartment || 'Student' }} • Turning {{ b.ageTurning }} yrs
                          </span>
                        </div>
                        @if (b.whatsAppPhone) {
                          <button
                            class="wa-wish-btn"
                            (click)="sendWhatsAppWish(b)"
                            [matTooltip]="'Send Birthday Greeting via WhatsApp'" matButton="filled">
                            <mat-icon class="wa-icon">chat</mat-icon>
                            <span>Wish</span>
                          </button>
                        }
                      </div>
                    }
                  </div>
                } @else {
                  <div class="hub-empty-state">
                    <mat-icon class="empty-icon">sentiment_satisfied_alt</mat-icon>
                    <p class="empty-title">No Birthdays Today</p>
                    <p class="empty-sub">No student or colleague birthdays today.</p>
                  </div>
                }
              </mat-card-content>
            </mat-card>
          </div>
    
        } @else if (!loading()) {
          <div class="dashboard-fallback-state mat-elevation-z1">
            <div class="fallback-icon-box">
              <mat-icon>badge</mat-icon>
            </div>
            <h3>Faculty Operations Desk</h3>
            <p>Unable to retrieve faculty timetable or class records. Please click below to refresh.</p>
            <button color="primary" (click)="loadSummary()" matButton="filled">
              <mat-icon>refresh</mat-icon> Refresh
            </button>
          </div>
        }
      }
    
      <!-- ========================================== -->
      <!-- 🏢 3. EXECUTIVE & MANAGEMENT OVERVIEW       -->
      <!-- ========================================== -->
      @if (!authService.isStudentOrParent() && !authService.isTeacher()) {
        @if (summary(); as summary) {

          <!-- Agentic AI Executive Director Voice Copilot -->
          @if (isAiDirectorOpen) {
            <div class="ai-copilot-card">
              <div class="ai-copilot-header">
                <div class="ai-copilot-title-group">
                  <div class="ai-avatar-icon">
                    <mat-icon>psychology</mat-icon>
                  </div>
                  <div class="ai-title-text">
                    <div class="ai-main-title-row">
                      <h4>Executive Director Voice Copilot</h4>
                      <span class="ai-pill-active">⚡ Ask IMSERP Anything</span>
                    </div>
                    <p>बोलें या लिखें — जैसे "Total fee collected this month?", "Active students kitne hain?", "Pending fee dues?", AI तुरंत आंकड़े बताएगा।</p>
                  </div>
                </div>
                <div class="ai-header-controls">
                  <button type="button" class="ai-minimize-btn" (click)="isAiDirectorOpen = false" matTooltip="Hide Copilot">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
              </div>

              @if (isAiDirectorListening) {
                <div class="ai-listening-bar">
                  <div class="ai-wave-wrap">
                    <mat-icon class="ai-wave-icon">graphic_eq</mat-icon>
                    <div class="ai-listening-text">
                      <span>AI सुन रहा है... ({{ aiDirectorSpeechLang === 'hi-IN' ? 'Listening in Hindi / Hinglish' : 'Listening in English' }})</span>
                      <span class="ai-mic-hint">बोलिए: "आज का कलेक्शन, कुल छात्र संख्या, बकाया फीस, या शिक्षक विवरण..."</span>
                    </div>
                  </div>
                  <button type="button" class="ai-stop-btn" (click)="toggleAiDirectorSpeech()">
                    <mat-icon>mic_off</mat-icon>
                    <span>Stop</span>
                  </button>
                </div>
              }

              <div class="ai-input-wrap">
                <textarea
                  class="ai-textarea"
                  rows="2"
                  [(ngModel)]="aiDirectorPromptText"
                  (input)="onAiDirectorPromptInput()"
                  (keydown.enter)="$event.preventDefault(); processAiDirectorQuery(summary)"
                  placeholder="यहाँ बोलें या टाइप करें... (उदा: 'Total fee collected this month?' या 'Total active students kitne hain?')"></textarea>

                <div class="ai-footer-bar">
                  <div class="ai-footer-left">
                    <button type="button" class="ai-mic-btn" [class.listening]="isAiDirectorListening" (click)="toggleAiDirectorSpeech()">
                      <mat-icon>{{ isAiDirectorListening ? 'mic' : 'mic_none' }}</mat-icon>
                      <span>{{ isAiDirectorListening ? 'Stop Mic' : 'Start Voice' }}</span>
                    </button>
                    <button type="button" class="ai-lang-pill-btn" (click)="toggleAiDirectorLang()" matTooltip="Switch Language">
                      <mat-icon>language</mat-icon>
                      <span>{{ aiDirectorSpeechLang === 'hi-IN' ? 'हिंदी (Hindi)' : 'English' }}</span>
                    </button>
                  </div>
                  <div class="ai-footer-right">
                    @if (aiDirectorPromptText) {
                      <button type="button" class="ai-clear-btn" (click)="clearAiDirector()">Clear</button>
                    }
                    <button
                      type="button"
                      class="ai-submit-action-btn"
                      [disabled]="!aiDirectorPromptText.trim()"
                      (click)="processAiDirectorQuery(summary)">
                      <mat-icon>auto_awesome</mat-icon>
                      <span>Ask Copilot (पूछें)</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- AI Answer Box -->
              @if (aiDirectorAnswer) {
                <div class="ai-executive-answer-box" style="margin-top: 12px; padding: 12px 16px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; display: flex; align-items: flex-start; gap: 12px;">
                  <div style="width: 34px; height: 34px; border-radius: 8px; background: #2563eb; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <mat-icon style="font-size: 18px; width: 18px; height: 18px;">insights</mat-icon>
                  </div>
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
                      <span style="font-size: 0.8rem; font-weight: 700; color: #1e3a8a;">IMSERP Executive Intelligence</span>
                      @if (aiDirectorAnswer.highlightValue) {
                        <span style="font-size: 0.78rem; font-weight: 700; background: #2563eb; color: #fff; padding: 2px 8px; border-radius: 6px;">{{ aiDirectorAnswer.highlightValue }}</span>
                      }
                    </div>
                    <p style="margin: 0; font-size: 0.88rem; color: #1e293b; line-height: 1.5;">{{ aiDirectorAnswer.answer }}</p>
                  </div>
                </div>
              }
            </div>
          }

          <!-- 1. Top KPI Stat Cards -->
          <div class="card-container">
            <mat-card class="stat-card blue mat-elevation-z2">
              <mat-card-content class="stat-content">
                <div class="stat-header">
                  <span class="label">Total Active Students</span>
                  <div class="stat-icon-wrap">
                    <mat-icon class="stat-icon">people</mat-icon>
                  </div>
                </div>
                <div class="stat-body">
                  <span class="value">{{ summary.totalStudents }}</span>
                  <div class="stat-footer">
                    <span class="stat-badge-pill">Live Roster</span>
                    <span class="sub-label">Enrolled in institute</span>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
    
            <mat-card class="stat-card green mat-elevation-z2">
              <mat-card-content class="stat-content">
                <div class="stat-header">
                  <span class="label">Monthly Fee Collected</span>
                  <div class="stat-icon-wrap">
                    <mat-icon class="stat-icon">account_balance_wallet</mat-icon>
                  </div>
                </div>
                <div class="stat-body">
                  <span class="value">₹{{ summary.totalFeeCollectedThisMonth | number:'1.0-0' }}</span>
                  <div class="stat-footer">
                    <span class="stat-badge-pill">This Month</span>
                    <span class="sub-label">Received this month</span>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
    
            <mat-card class="stat-card orange mat-elevation-z2">
              <mat-card-content class="stat-content">
                <div class="stat-header">
                  <span class="label">Pending Fee Dues</span>
                  <div class="stat-icon-wrap">
                    <mat-icon class="stat-icon">warning_amber</mat-icon>
                  </div>
                </div>
                <div class="stat-body">
                  <span class="value">₹{{ summary.pendingFeesTotal | number:'1.0-0' }}</span>
                  <div class="stat-footer">
                    <span class="stat-badge-pill">Receivables</span>
                    <span class="sub-label">Outstanding balance</span>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
    
            <mat-card class="stat-card purple mat-elevation-z2">
              <mat-card-content class="stat-content">
                <div class="stat-header">
                  <span class="label">Tests Conducted</span>
                  <div class="stat-icon-wrap">
                    <mat-icon class="stat-icon">quiz</mat-icon>
                  </div>
                </div>
                <div class="stat-body">
                  <span class="value">{{ summary.totalTestsConducted }}</span>
                  <div class="stat-footer">
                    <span class="stat-badge-pill">Academic</span>
                    <span class="sub-label">Exams evaluated</span>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
    
            <mat-card class="stat-card teal mat-elevation-z2">
              <mat-card-content class="stat-content">
                <div class="stat-header">
                  <span class="label">Active Batches</span>
                  <div class="stat-icon-wrap">
                    <mat-icon class="stat-icon">groups</mat-icon>
                  </div>
                </div>
                <div class="stat-body">
                  <span class="value">{{ summary.activeBatches }}</span>
                  <div class="stat-footer">
                    <span class="stat-badge-pill">Running</span>
                    <span class="sub-label">Academic classrooms</span>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
    
            <mat-card class="stat-card emerald mat-elevation-z2" routerLink="/students/attendance" style="cursor: pointer;" matTooltip="Open Student Attendance & Roll Call">
              <mat-card-content class="stat-content">
                <div class="stat-header">
                  <span class="label">Today's Attendance</span>
                  <div class="stat-icon-wrap">
                    <mat-icon class="stat-icon">how_to_reg</mat-icon>
                  </div>
                </div>
                <div class="stat-body">
                  <span class="value">{{ summary.todayAttendance ? summary.todayAttendance.attendancePercentage + '%' : 'Pending' }}</span>
                  <div class="stat-footer">
                    @if (summary.todayAttendance) {
                      <span class="stat-badge-pill">
                        {{ summary.todayAttendance.presentCount }}/{{ summary.todayAttendance.totalMarked }} Present
                      </span>
                    }
                    @if (!summary.todayAttendance) {
                      <span class="stat-badge-pill">
                        Live Status
                      </span>
                    }
                    @if (summary.todayAttendance?.lastMarkedTime) {
                      <span class="sub-label" matTooltip="Last Batch Attendance Timestamp">
                        At {{ summary.todayAttendance.lastMarkedTime }}
                      </span>
                    }
                    @if (!summary.todayAttendance?.lastMarkedTime) {
                      <span class="sub-label">
                        Not marked yet
                      </span>
                    }
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
    
          <!-- 2. Dynamic Interactive Charts Row -->
          <div class="charts-row">
    
            <!-- Left Chart: 6-Month Fee Revenue & Collection Trend -->
            <mat-card class="chart-card large-chart-card mat-elevation-z2">
              <div class="chart-header">
                <div class="chart-header-left">
                  <div class="chart-icon-box blue-box">
                    <mat-icon>bar_chart</mat-icon>
                  </div>
                  <div>
                    <h3 class="chart-title">Monthly Revenue &amp; Collection Trend</h3>
                    <p class="chart-subtitle">6-Month database comparison: Billed Tuition Fees vs Collected Payments (₹)</p>
                  </div>
                </div>
                <div class="chart-header-actions">
                  <div class="chart-type-toggle" role="group" aria-label="Revenue chart type">
                    <button
                      type="button"
                      class="chart-type-button"
                      [class.chart-type-selected]="revenueChartType === 'area'"
                      [attr.aria-pressed]="revenueChartType === 'area'"
                      (click)="toggleRevenueChartType('area')" matButton="filled">
                      <mat-icon>show_chart</mat-icon>
                      Trend
                    </button>
                    <button
                      type="button"
                      class="chart-type-button"
                      [class.chart-type-selected]="revenueChartType === 'bar'"
                      [attr.aria-pressed]="revenueChartType === 'bar'"
                      (click)="toggleRevenueChartType('bar')" matButton="filled">
                      <mat-icon>bar_chart</mat-icon>
                      Bars
                    </button>
                  </div>
                  <div class="chart-legend-pills">
                    <span class="pill pill-billed"
                      [matTooltip]="billedTooltip()"
                      matTooltipClass="multiline-tooltip"
                      matTooltipPosition="below">
                      <span class="legend-dot dot-billed"></span>
                      <span>Billed: ₹{{ totalBilled() | number:'1.0-0' }}</span>
                      <mat-icon class="pill-info-icon">info</mat-icon>
                    </span>
                    <span class="pill pill-collected"
                      [matTooltip]="collectedTooltip()"
                      matTooltipClass="multiline-tooltip"
                      matTooltipPosition="below">
                      <span class="legend-dot dot-collected"></span>
                      <span>Collected: ₹{{ totalCollected() | number:'1.0-0' }}</span>
                      <mat-icon class="pill-info-icon">info</mat-icon>
                    </span>
                  </div>
                </div>
              </div>
              <mat-card-content class="chart-canvas-box">
                <div #revenueChart class="apex-chart-wrap"></div>
              </mat-card-content>
            </mat-card>
    
            <!-- Right Chart: Overall Fee Recovery & Dues Donut -->
            <mat-card class="chart-card small-chart-card mat-elevation-z2">
              <div class="chart-header">
                <div class="chart-header-left">
                  <div class="chart-icon-box teal-box">
                    <mat-icon>donut_large</mat-icon>
                  </div>
                  <div>
                    <h3 class="chart-title">Fee Recovery Ratio</h3>
                    <p class="chart-subtitle">Overall settled vs outstanding</p>
                  </div>
                </div>
                <span class="recovery-badge" [class.high]="(summary.feeBreakdown?.recoveryPercentage || 0) >= 50">
                  {{ summary.feeBreakdown?.recoveryPercentage || 0 }}% Settled
                </span>
              </div>
              <mat-card-content class="donut-body">
                <div class="donut-canvas-container">
                  <div #feeBreakdownChart class="apex-donut-wrap"></div>
                </div>
                <div class="donut-summary-list">
                  <div class="summary-item">
                    <span class="item-lbl"><span class="legend-dot dot-collected"></span> Total Paid</span>
                    <strong class="item-val text-green">₹{{ $safeNavigationMigration(summary.feeBreakdown?.totalPaid) | number:'1.0-0' }}</strong>
                  </div>
                  <div class="summary-item">
                    <span class="item-lbl"><span class="legend-dot dot-pending"></span> Pending Dues</span>
                    <strong class="item-val text-orange">₹{{ $safeNavigationMigration(summary.feeBreakdown?.totalPending) | number:'1.0-0' }}</strong>
                  </div>
                  <div class="summary-item total-item"
                    matTooltip="Total Invoices Generated across institute history (Paid ₹{{ $safeNavigationMigration(summary.feeBreakdown?.totalPaid) | number:'1.0-0' }} + Pending ₹{{ $safeNavigationMigration(summary.feeBreakdown?.totalPending) | number:'1.0-0' }})"
                    matTooltipPosition="above">
                    <span class="item-lbl">Total Billed</span>
                    <strong class="item-val">₹{{ $safeNavigationMigration(summary.feeBreakdown?.totalBilled) | number:'1.0-0' }}</strong>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
    
          </div>
    
          <!-- 3. Batch Enrollment & Fee Potential Chart -->
          @if (summary.batchDistributions && summary.batchDistributions.length > 0) {
            <mat-card class="chart-card full-chart-card mat-elevation-z2">
              <div class="chart-header">
                <div class="chart-header-left">
                  <div class="chart-icon-box purple-box">
                    <mat-icon>school</mat-icon>
                  </div>
                  <div>
                    <h3 class="chart-title">Batch-Wise Enrollment &amp; Monthly Revenue Capacity</h3>
                    <p class="chart-subtitle">Live student enrollment distribution across active academic batches</p>
                  </div>
                </div>
                <div class="chart-header-right">
                  <div class="batch-filter-toggle">
                    <button type="button" class="toggle-btn" [class.active]="batchViewFilter === 'top10'" (click)="setBatchViewFilter('top10')" matButton="filled">
                      Top 10 Batches
                    </button>
                    <button type="button" class="toggle-btn" [class.active]="batchViewFilter === 'active'" (click)="setBatchViewFilter('active')" matButton="filled">
                      Active (With Students)
                    </button>
                    <button type="button" class="toggle-btn" [class.active]="batchViewFilter === 'all'" (click)="setBatchViewFilter('all')" matButton="filled">
                      All Batches ({{ summary.batchDistributions.length }})
                    </button>
                  </div>
                </div>
              </div>
              <mat-card-content class="batch-canvas-box">
                <div #batchChart class="apex-chart-wrap"></div>
              </mat-card-content>
            </mat-card>
          }
    
          <!-- 3.5 School Happenings & Celebration Radar -->
          <div class="celebration-radar-grid">
            <!-- Left: Upcoming Events & Celebrations (62%) -->
            <mat-card class="radar-card events-box mat-elevation-z2">
              <div class="radar-header">
                <div class="radar-title-wrap">
                  <div class="radar-icon-badge events-badge">
                    <mat-icon>celebration</mat-icon>
                  </div>
                  <div>
                    <h3 class="radar-title">School Happenings & Upcoming Events</h3>
                    <p class="radar-sub">Annual Day, 15 Aug, Farewell, Sports Meet & Official Circulars</p>
                  </div>
                </div>
                <div class="radar-actions">
                  <a matButton="filled" color="primary" routerLink="/events" class="view-events-btn">
                    <span>View All</span>
                    <mat-icon>arrow_forward</mat-icon>
                  </a>
                  <button color="primary" class="new-event-btn" (click)="openCreateEventDialog()" matButton="filled">
                    <mat-icon>add</mat-icon>
                    <span>New Event</span>
                  </button>
                </div>
              </div>
    
              <mat-card-content class="events-content">
                @if (celebrations()?.upcomingEvents?.length) {
                  <div class="events-cards-row">
                    @for (ev of celebrations()!.upcomingEvents; track ev.id) {
                      <div class="event-mini-card">
                        <div class="event-banner" [style.background-image]="ev.bannerUrl ? 'url(' + ev.bannerUrl + ')' : getFallbackGradient(ev.category)">
                          <span class="cat-chip" [ngClass]="ev.category.toLowerCase()">
                            {{ getCategoryEmoji(ev.category) }} {{ ev.category }}
                          </span>
                          <div class="event-date-flag">
                            <span class="m">{{ ev.startDate | date:'MMM' | uppercase }}</span>
                            <span class="d">{{ ev.startDate | date:'dd' }}</span>
                          </div>
                        </div>
                        <div class="event-info">
                          <h4 class="event-name" [title]="ev.title">{{ ev.title }}</h4>
                          @if (ev.venue) {
                            <div class="meta-row">
                              <mat-icon>place</mat-icon>
                              <span>{{ ev.venue }}</span>
                            </div>
                          }
                          @if (ev.startTime) {
                            <div class="meta-row">
                              <mat-icon>schedule</mat-icon>
                              <span>{{ ev.startTime }}</span>
                            </div>
                          }
                          <div class="bottom-actions">
                            @if (ev.attachmentPdfUrl) {
                              <a [href]="ev.attachmentPdfUrl" target="_blank" class="pdf-tag" download>
                                <mat-icon>picture_as_pdf</mat-icon> Circular
                              </a>
                            }
                            <button class="memories-tag" (click)="openEventGallery(ev)" matButton="filled">
                              <mat-icon>photo_camera</mat-icon> {{ ev.photosCount }} Memories
                            </button>
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="empty-events-radar">
                    <div class="empty-events-icon">
                      <mat-icon>event_available</mat-icon>
                    </div>
                    <p class="empty-main">No Upcoming Events Scheduled</p>
                    <p class="empty-desc">Schedule your annual day, 15 Aug, sports meet, or cultural celebration to keep everyone informed.</p>
                    <button color="primary" (click)="openCreateEventDialog()" matButton="filled">
                      <mat-icon>add</mat-icon> Schedule First Event
                    </button>
                  </div>
                }
              </mat-card-content>
            </mat-card>
    
            <!-- Right: Today's Celebrations & Birthdays Radar (38%) -->
            <mat-card class="radar-card birthdays-box mat-elevation-z2">
              <div class="radar-header">
                <div class="radar-title-wrap">
                  <div class="radar-icon-badge bday-badge">
                    <mat-icon>cake</mat-icon>
                  </div>
                  <div>
                    <h3 class="radar-title">Celebrations & Birthdays</h3>
                    <p class="radar-sub">{{ birthdayRadarSubtitle() }}</p>
                  </div>
                </div>
                @if (celebrations()?.todayBirthdays?.length) {
                  <span class="bday-count-pill">
                    {{ celebrations()!.todayBirthdays.length }} Today 🎂
                  </span>
                }
              </div>
    
              <mat-card-content class="birthdays-content">
                @if (celebrations()?.todayBirthdays?.length) {
                  <div class="today-bday-list">
                    @for (b of celebrations()!.todayBirthdays; track b.id) {
                      <div class="bday-item-card">
                        <div class="bday-avatar-wrap">
                          @if (b.photoUrl) {
                            <img [src]="b.photoUrl" [alt]="b.name" class="bday-avatar" />
                          }
                          @if (!b.photoUrl) {
                            <div class="bday-avatar-fallback">
                              {{ b.name.substring(0, 1) | uppercase }}
                            </div>
                          }
                          <span class="confetti-emoji">🎉</span>
                        </div>
                        <div class="bday-details">
                          <div class="bday-name-row">
                            <span class="person-name">{{ b.name }}</span>
                            <span class="role-pill" [class.staff]="b.role === 'Staff'">{{ b.role }}</span>
                          </div>
                          <span class="bday-meta">
                            {{ b.classOrDepartment || 'Student' }} • Turning {{ b.ageTurning }} yrs
                          </span>
                        </div>
                        @if (b.whatsAppPhone) {
                          <button
                            class="wa-wish-btn"
                            (click)="sendWhatsAppWish(b)"
                            [matTooltip]="'Send Birthday Greeting via WhatsApp'" matButton="filled">
                            <mat-icon class="wa-icon">chat</mat-icon>
                            <span>Wish</span>
                          </button>
                        }
                      </div>
                    }
                  </div>
                } @else {
                  <div class="no-bday-today">
                    <div class="bday-cal-icon">
                      <mat-icon>sentiment_satisfied_alt</mat-icon>
                    </div>
                    <p class="no-bday-text">No birthdays today</p>
                    <p class="no-bday-sub">Everyone's growing a little older gracefully! Check upcoming birthdays below.</p>
                  </div>
                }
    
                <!-- Upcoming Birthdays Next 7 Days -->
                @if (celebrations()?.upcomingBirthdaysThisWeek?.length) {
                  <div class="upcoming-bdays-section">
                    <span class="upcoming-header-label">
                      <mat-icon>calendar_month</mat-icon> Next 7 Days Birthdays
                    </span>
                    <div class="upcoming-chips-row">
                      @for (ub of celebrations()!.upcomingBirthdaysThisWeek; track ub.id) {
                        <div class="upcoming-chip">
                          <span class="ub-date">{{ ub.birthdayDateFormatted }}</span>
                          <span class="ub-name">{{ ub.name }}</span>
                          <span class="ub-role">({{ ub.role }})</span>
                        </div>
                      }
                    </div>
                  </div>
                }
              </mat-card-content>
            </mat-card>
          </div>
    
          <!-- 4. Tables Row (Overdue Reminders & Recent Tests) -->
          <div class="bottom-grid">
    
            <!-- Overdue Fee Reminders -->
            <mat-card class="table-card mat-elevation-z2">
              <div class="section-header">
                <div class="section-title">
                  <mat-icon class="section-icon warning-icon">warning_amber</mat-icon>
                  <div>
                    <h3>Urgent Pending Fee Reminders</h3>
                    <p>Students with overdue fee invoices</p>
                  </div>
                </div>
                <div class="section-actions-group">
                  @if (feeTotalCount() > 0) {
                    <button
                      type="button"
                      class="bulk-wa-header-btn"
                      (click)="openBulkWhatsAppModal()"
                      matTooltip="Bulk WhatsApp Reminders (Invoice & Normal AI Message)"
                      matButton="filled">
                      <mat-icon>campaign</mat-icon>
                      <span class="bulk-text">Bulk Reminders</span>
                    </button>
                  }
                  <a matButton="filled" color="warn" routerLink="/fees" class="view-all-btn">
                    <span class="view-all-text">View All</span> <mat-icon>arrow_forward</mat-icon>
                  </a>
                </div>
              </div>

              <!-- Compact Controls Bar: Search & Scope Filter -->
              <div class="fee-control-deck">
                <div class="fee-search-box">
                  <mat-icon class="search-ico">search</mat-icon>
                  <input
                    type="text"
                    [formControl]="feeSearchControl"
                    placeholder="Search student name, roll number, class..."
                    class="fee-search-input" />
                  @if (feeSearchControl.value) {
                    <button type="button" class="clear-search-btn" (click)="feeSearchControl.setValue('')" aria-label="Clear Search">
                      <mat-icon>close</mat-icon>
                    </button>
                  }
                </div>

                <!-- Tri-Modal Division Scope Selector (All, School, Coaching) -->
                <div class="fee-scope-toggle">
                  <button
                    type="button"
                    class="scope-pill-btn"
                    [class.active]="feeScopeControl.value === 'All'"
                    (click)="feeScopeControl.setValue('All')">
                    All
                  </button>
                  <button
                    type="button"
                    class="scope-pill-btn"
                    [class.active]="feeScopeControl.value === 'School'"
                    (click)="feeScopeControl.setValue('School')">
                    School
                  </button>
                  <button
                    type="button"
                    class="scope-pill-btn"
                    [class.active]="feeScopeControl.value === 'Coaching'"
                    (click)="feeScopeControl.setValue('Coaching')">
                    Coaching
                  </button>
                </div>
              </div>

              <!-- Single Prominent Smooth Loader -->
              @if (feeRemindersLoading()) {
                <mat-progress-bar mode="indeterminate" class="fee-smooth-loader"></mat-progress-bar>
              }

              <mat-card-content class="fee-table-content">
                <div class="table-responsive">
                  <table mat-table [dataSource]="feeRemindersList()" matSort (matSortChange)="onFeeSortChange($event)" class="full-width">
                    <!-- Student Column with Dynamic Photo & Fallback Initials -->
                    <ng-container matColumnDef="studentName">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header="studentName">Student</th>
                      <td mat-cell *matCellDef="let el">
                        <div class="student-cell">
                          <div class="student-avatar-container">
                            @if (el.profilePhoto) {
                              <img [src]="getStudentPhotoUrl(el.profilePhoto)" [alt]="el.studentName" class="student-avatar-img" (error)="onAvatarError($event)" />
                            }
                            <span class="student-avatar-badge" [style.display]="el.profilePhoto ? 'none' : 'inline-flex'">
                              {{ (el.studentName || 'S').charAt(0).toUpperCase() }}
                            </span>
                          </div>
                          <div class="student-info">
                            <div class="stu-name-row">
                              <strong>{{ el.studentName }}</strong>
                              @if (isSibling(el)) {
                                <span class="sibling-badge" matTooltip="Shares phone with sibling in campus">
                                  <mat-icon>people</mat-icon> Sibling
                                </span>
                              }
                            </div>
                            <small>{{ el.rollNumber }}</small>
                          </div>
                        </div>
                      </td>
                    </ng-container>

                    <!-- Class Column with Due Date Badge & Admission Scope -->
                    <ng-container matColumnDef="className">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header="className">Class</th>
                      <td mat-cell *matCellDef="let el">
                        <div class="class-cell-wrap">
                          <div class="class-badge-row">
                            <span class="class-pill">{{ el.className || 'General' }}</span>
                            <span class="admission-scope-badge" [ngClass]="getScopeBadgeClass(el)">
                              {{ getScopeBadgeLabel(el) }}
                            </span>
                          </div>
                          @if (el.dueDate) {
                            <span class="due-date-badge">
                              <mat-icon class="due-clock-icon">event</mat-icon>
                              Due: {{ el.dueDate | date:'mediumDate' }}
                            </span>
                          }
                        </div>
                      </td>
                    </ng-container>

                    <!-- Dues Column -->
                    <ng-container matColumnDef="dueAmount">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header="dueAmount" class="text-right">Dues</th>
                      <td mat-cell *matCellDef="let el" class="amount-due text-right">
                        <div class="due-cell-stack">
                          <span>₹{{ el.dueAmount | number:'1.0-0' }}</span>
                          @if ((el.paidAmount || 0) > 0 && (el.dueAmount || 0) > 0) {
                            <span class="partial-paid-badge" [matTooltip]="'Total: ₹' + (el.totalAmount || (el.paidAmount + el.dueAmount)) + ' | Paid: ₹' + el.paidAmount">
                              Partial • Paid ₹{{ el.paidAmount | number:'1.0-0' }}
                            </span>
                          }
                        </div>
                      </td>
                    </ng-container>

                    <!-- Actions Column with Deduplication Per Day Badge -->
                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef class="text-center actions-th" matTooltip="Action Menu">
                        <mat-icon class="th-action-icon">settings</mat-icon>
                      </th>
                      <td mat-cell *matCellDef="let el" class="text-right actions-td">
                        <div class="row-actions-group">
                          @if (el.alreadyRemindedToday) {
                            <span class="reminded-today-pill" [matTooltip]="'Sent Today' + (el.lastRemindedAt ? ' (' + formatIstTime(el.lastRemindedAt) + ')' : '')">
                              <mat-icon>done_all</mat-icon>
                            </span>
                          } @else {
                            <button
                              type="button"
                              class="mini-voice-btn"
                              (click)="openVoiceReminder(el)"
                              matTooltip="AI Hindi Voice Note & Audio"
                              aria-label="AI Hindi Voice Note">
                              <mat-icon style="color: #7c3aed;">mic</mat-icon>
                            </button>
                            <button
                              type="button"
                              class="more-action-btn"
                              [matMenuTriggerFor]="remindMenu"
                              matTooltip="More Actions"
                              aria-label="More Actions">
                              <mat-icon>more_vert</mat-icon>
                            </button>
                            <mat-menu #remindMenu="matMenu" xPosition="before">
                              <button mat-menu-item (click)="openSingleWhatsAppModal(el)">
                                <mat-icon style="color: #16a34a;">chat</mat-icon>
                                <span>Send WhatsApp Reminder</span>
                              </button>
                              <button mat-menu-item (click)="openVoiceReminder(el)">
                                <mat-icon style="color: #7c3aed;">mic</mat-icon>
                                <span>AI Hindi Voice Note</span>
                              </button>
                            </mat-menu>
                          }
                        </div>
                      </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="feeColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: feeColumns;"></tr>

                    <tr class="mat-row" *matNoDataRow>
                      <td class="mat-cell" [attr.colspan]="feeColumns.length">
                        <div class="empty-inline">
                          @if (feeRemindersLoading()) {
                            <span>Loading urgent fee reminders...</span>
                          } @else {
                            <mat-icon style="color:#16a34a">check_circle</mat-icon>
                            <span>No overdue fee invoices match the filter. All fees are up to date! 🎉</span>
                          }
                        </div>
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- Server-Side Pagination -->
                <mat-paginator
                  [length]="feeTotalCount()"
                  [pageSize]="feePageSize"
                  [pageIndex]="feePageIndex"
                  [pageSizeOptions]="[5, 10, 20]"
                  (page)="onFeePageChange($event)"
                  showFirstLastButtons
                  class="compact-fee-paginator">
                </mat-paginator>
              </mat-card-content>
            </mat-card>
    
            <!-- Recent Tests -->
            <mat-card class="table-card mat-elevation-z2">
              <div class="section-header">
                <div class="section-title">
                  <mat-icon class="section-icon test-icon">quiz</mat-icon>
                  <div>
                    <h3>Recent Test Exams</h3>
                    <p>Last 5 exams conducted</p>
                  </div>
                </div>
                <a matButton="filled" color="primary" routerLink="/tests" class="view-all-btn">
                  View All <mat-icon>arrow_forward</mat-icon>
                </a>
              </div>
              <mat-card-content>
                <table mat-table [dataSource]="summary.recentTests" class="full-width recent-tests-table">
    
                  <ng-container matColumnDef="title">
                    <th mat-header-cell *matHeaderCellDef>Test Title</th>
                    <td mat-cell *matCellDef="let t">
                      <div class="test-cell">
                        <strong>{{ t.title }}</strong>
                        <small>{{ t.subject }}</small>
                      </div>
                    </td>
                  </ng-container>
    
                  <ng-container matColumnDef="batchName">
                    <th mat-header-cell *matHeaderCellDef>Batch</th>
                    <td mat-cell *matCellDef="let t">
                      <span class="batch-badge" [matTooltip]="t.batchName">{{ t.batchName }}</span>
                    </td>
                  </ng-container>
    
                  <ng-container matColumnDef="maxMarks">
                    <th mat-header-cell *matHeaderCellDef class="text-center">Max Marks</th>
                    <td mat-cell *matCellDef="let t" class="text-center">
                      <span class="marks-badge">{{ t.maxMarks }}</span>
                    </td>
                  </ng-container>
    
                  <ng-container matColumnDef="marksEnteredCount">
                    <th mat-header-cell *matHeaderCellDef class="text-center">Entries</th>
                    <td mat-cell *matCellDef="let t" class="text-center">
                      <span class="entries-badge" [class.no-entries]="(t.totalStudentsEvaluated ?? t.marksEnteredCount ?? 0) === 0">
                        {{ (t.totalStudentsEvaluated ?? t.marksEnteredCount ?? 0) === 0 ? 'Pending' : (t.totalStudentsEvaluated ?? t.marksEnteredCount) + ' evaluated' }}
                      </span>
                    </td>
                  </ng-container>
    
                  <ng-container matColumnDef="testDate">
                    <th mat-header-cell *matHeaderCellDef class="text-right">Date</th>
                    <td mat-cell *matCellDef="let t" class="date-cell text-right">{{ t.testDate | date:'dd MMM yyyy' }}</td>
                  </ng-container>
    
                  <tr mat-header-row *matHeaderRowDef="testColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: testColumns;"></tr>
    
                  <tr class="mat-row" *matNoDataRow>
                    <td class="mat-cell" [attr.colspan]="testColumns.length">
                      <div class="empty-inline">
                        <mat-icon style="color:#7c3aed">quiz</mat-icon>
                        <span>No tests scheduled yet. Go to <a routerLink="/tests">Tests</a> to schedule one.</span>
                      </div>
                    </td>
                  </tr>
                </table>
              </mat-card-content>
            </mat-card>
    
          </div>
    
        } @else if (!loading()) {
          <div class="dashboard-fallback-state mat-elevation-z1">
            <div class="fallback-icon-box">
              <mat-icon>analytics</mat-icon>
            </div>
            <h3>Institute Analytics Overview</h3>
            <p>Unable to load institutional analytics. Please make sure the backend is connected and click below to refresh.</p>
            <button color="primary" (click)="loadSummary()" matButton="filled">
              <mat-icon>refresh</mat-icon> Refresh
            </button>
          </div>
        }
      }
    </div>
    `,
  styles: [`
    .dashboard-wrapper {
      display: flex;
      flex-direction: column;
      gap: 22px;
      width: 100%;
      box-sizing: border-box;
    }

    .dashboard-fallback-state {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-radius: 16px;
      padding: 40px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      margin: 20px 0;

      .fallback-icon-box {
        width: 56px;
        height: 56px;
        border-radius: 12px;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);

        mat-icon {
          font-size: 28px;
          width: 28px;
          height: 28px;
        }
      }

      h3 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 700;
        color: #1e3a8a;
      }

      p {
        margin: 0;
        font-size: 0.9rem;
        color: #3b82f6;
        max-width: 460px;
      }

      button {
        margin-top: 6px;
      }
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .spinner-center {
      display: flex;
      justify-content: center;
      padding: 60px 0;
    }

    /* ─── Top KPI Stat Cards (Responsive Grid across all devices) ─── */
    .card-container {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 16px;
      margin-bottom: 8px;

      @media (max-width: 1440px) {
        grid-template-columns: repeat(3, 1fr);
      }
      @media (max-width: 992px) {
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
      }
      @media (max-width: 768px) {
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }
      @media (max-width: 360px) {
        grid-template-columns: 1fr;
      }
    }

    .stat-card {
      border-radius: 14px;
      border: none;
      color: #ffffff;
      overflow: hidden;
      position: relative;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, rgba(255, 255, 255, 0.5), transparent);
      }

      &:hover {
        transform: translateY(-4px);
      }

      &.blue {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 55%, #1e40af 100%);
        box-shadow: 0 10px 25px -4px rgba(37, 99, 235, 0.45) !important;
      }
      &.green {
        background: linear-gradient(135deg, #10b981 0%, #059669 55%, #047857 100%);
        box-shadow: 0 10px 25px -4px rgba(16, 185, 129, 0.45) !important;
      }
      &.orange {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 55%, #b45309 100%);
        box-shadow: 0 10px 25px -4px rgba(245, 158, 11, 0.45) !important;
      }
      &.purple {
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 55%, #6d28d9 100%);
        box-shadow: 0 10px 25px -4px rgba(139, 92, 246, 0.45) !important;
      }
      &.whatsapp {
        background: linear-gradient(135deg, #10b981 0%, #047857 100%);
      }
      &.teal {
        background: linear-gradient(135deg, #0d9488 0%, #0f766e 55%, #115e59 100%);
        box-shadow: 0 10px 25px -4px rgba(13, 148, 136, 0.45) !important;
      }
      &.emerald {
        background: linear-gradient(135deg, #059669 0%, #047857 55%, #065f46 100%);
        box-shadow: 0 10px 25px -4px rgba(5, 150, 105, 0.45) !important;
      }
    }

    .stat-content {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 11px 14px !important;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      min-height: 96px;
    }

    .stat-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 6px;
      width: 100%;

      .label {
        font-size: 0.7rem;
        font-weight: 700;
        opacity: 0.95;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        line-height: 1.25;
        flex: 1;
        min-width: 0;
      }

      .stat-icon-wrap {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.22);
        backdrop-filter: blur(8px);
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-left: 6px;

        .stat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #ffffff;
        }
      }
    }

    .stat-body {
      display: flex;
      flex-direction: column;
      margin-top: 4px;

      .value {
        font-size: 1.55rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1.1;
        margin-bottom: 3px;
      }

      .stat-footer {
        display: flex;
        align-items: center;
        gap: 5px;
        flex-wrap: wrap;

        .stat-badge-pill {
          font-size: 0.58rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 1.5px 6px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.22);
          backdrop-filter: blur(4px);
          color: #ffffff;
          white-space: nowrap;
        }

        .sub-label {
          font-size: 0.68rem;
          opacity: 0.88;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }
    }

    /* ─── Dynamic Charts Section ─── */
    .charts-row {
      display: grid;
      grid-template-columns: 1.65fr 1fr;
      gap: 18px;

      @media (max-width: 992px) {
        grid-template-columns: 1fr;
        gap: 14px;
      }
    }

    .chart-card {
      border-radius: 18px;
      background: #ffffff;
      border: 1px solid #e6ebf2;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06) !important;
      transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;

      &:hover {
        transform: translateY(-2px);
        border-color: #d5deeb;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.09) !important;
      }

      @media (prefers-reduced-motion: reduce) {
        transition: box-shadow 180ms ease, border-color 180ms ease;

        &:hover { transform: none; }
      }
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 20px;
      border-bottom: 1px solid #edf1f6;
      background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
      flex-wrap: wrap;
      gap: 12px;

      .chart-header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .chart-icon-box {
        width: 42px;
        height: 42px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        mat-icon { font-size: 22px; width: 22px; height: 22px; }

        &.blue-box   { background: #eff6ff; color: #2563eb; }
        &.teal-box   { background: #f0fdf4; color: #16a34a; }
        &.purple-box { background: #faf5ff; color: #7c3aed; }
      }

      .chart-title {
        margin: 0;
        font-size: 1.02rem;
        font-weight: 700;
        color: #0f172a;
        letter-spacing: -0.02em;
      }
      .chart-subtitle {
        margin: 2px 0 0;
        font-size: 0.78rem;
        color: #64748b;
        line-height: 1.45;
      }
    }

    .chart-header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .chart-type-toggle {
      display: inline-flex;
      align-items: center;
      gap: 4px;

      .chart-type-button {
        min-width: 0;
        height: 36px;
        padding: 0 12px;
        border-radius: 8px;
        font-size: 0.74rem;
        font-weight: 650;
        letter-spacing: 0;
        --mat-button-filled-container-color: #e2e8f0;
        --mat-button-filled-label-text-color: #475569;
      }

      .chart-type-button.chart-type-selected {
        --mat-button-filled-container-color: #2563eb;
        --mat-button-filled-label-text-color: #ffffff;
      }

      mat-icon {
        width: 16px;
        height: 16px;
        margin-right: 4px;
        font-size: 16px;
        vertical-align: middle;
      }
    }

    .chart-legend-pills {
      display: flex;
      align-items: center;
      gap: 10px;

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        border-radius: 20px;
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        user-select: none;
        transition: transform 0.15s ease, box-shadow 0.15s ease;

        &:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .pill-info-icon {
          font-size: 15px;
          width: 15px;
          height: 15px;
          opacity: 0.8;
          margin-left: 2px;
        }

        &.pill-billed    { background: #ede9fe; color: #6d28d9; }
        &.pill-collected { background: #dcfce7; color: #15803d; }
      }
    }

    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;

      &.dot-billed    { background: #6366f1; }
      &.dot-collected { background: #10b981; }
      &.dot-pending   { background: #f59e0b; }
    }

    .recovery-badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 700;
      background: #fef3c7;
      color: #b45309;

      &.high {
        background: #dcfce7;
        color: #166534;
      }
    }

    .chart-canvas-box {
      padding: 14px 18px 18px;
      position: relative;
      height: 290px;
      width: 100%;
      box-sizing: border-box;
    }

    .batch-canvas-box {
      padding: 16px 20px 20px;
      position: relative;
      min-height: 380px;
      width: 100%;
      box-sizing: border-box;
    }

    .batch-filter-toggle {
      display: inline-flex;
      align-items: center;
      background: #f1f5f9;
      padding: 3px;
      border-radius: 8px;
      gap: 2px;
      border: 1px solid #e2e8f0;

      .toggle-btn {
        border: none;
        background: transparent;
        color: #64748b;
        font-size: 11.5px;
        font-weight: 600;
        padding: 5px 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        line-height: 1.2;

        &:hover {
          color: #1e293b;
        }

        &.active {
          background: #ffffff;
          color: #2563eb;
          font-weight: 700;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }
      }
    }

    /* Donut Body */
    .donut-body {
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    .donut-canvas-container {
      position: relative;
      width: 180px;
      height: 180px;

      .donut-inner-stat {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        display: flex;
        flex-direction: column;
        pointer-events: none;

        .inner-pct {
          font-size: 1.4rem;
          font-weight: 800;
          color: #0f172a;
          line-height: 1;
        }
        .inner-lbl {
          font-size: 0.72rem;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
          margin-top: 2px;
        }
      }
    }

    .donut-summary-list {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 6px;

      .summary-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.82rem;
        padding: 4px 0;

        .item-lbl {
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .item-val {
          font-weight: 700;
          color: #1e293b;
          &.text-green { color: #16a34a; }
          &.text-orange { color: #d97706; }
        }

        &.total-item {
          border-top: 1px dashed #e2e8f0;
          padding-top: 6px;
          margin-top: 2px;
          .item-lbl { font-weight: 600; color: #334155; }
        }
      }
    }

    /* ─── Tables Row ─── */
    .bottom-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 18px;

      @media (max-width: 992px) {
        grid-template-columns: 1fr;
        gap: 14px;
      }
    }

    .table-card {
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05) !important;
      overflow: hidden;
      min-width: 0;

      mat-card-content {
        padding: 0 10px 14px 10px !important;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;

        table {
          min-width: 0;
          width: 100%;
        }
      }
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 18px;
      border-bottom: 1px solid #f1f5f9;
      gap: 12px;

      .section-title {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1 1 auto;
        min-width: 0;

        > div {
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }

        .section-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
          flex-shrink: 0;
          &.warning-icon { color: #f59e0b; }
          &.test-icon    { color: #8b5cf6; }
        }

        h3 {
          margin: 0;
          font-size: 0.94rem;
          font-weight: 700;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        p {
          margin: 2px 0 0;
          font-size: 0.74rem;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      .section-actions-group {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
        margin-left: 12px;

        @media (max-width: 640px) {
          gap: 6px;
        }
      }

      @media (max-width: 640px) {
        flex-wrap: wrap;
        .section-actions-group {
          width: 100%;
          justify-content: flex-end;
          margin-top: 6px;
          margin-left: 0;
        }
      }

      .bulk-wa-header-btn {
        background: linear-gradient(135deg, #16a34a 0%, #15803d 100%) !important;
        color: #ffffff !important;
        font-size: 0.78rem !important;
        font-weight: 700 !important;
        height: 32px !important;
        padding: 0 12px !important;
        border-radius: 6px !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 5px !important;
        box-shadow: 0 2px 6px rgba(22, 163, 74, 0.3) !important;
        border: none !important;
        cursor: pointer !important;
        transition: all 0.15s ease !important;

        &:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(22, 163, 74, 0.45) !important;
        }

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }

      .view-all-btn {
        font-size: 0.78rem;
        font-weight: 600;
        height: 32px;
        padding: 0 12px;
        border-radius: 6px;
      }
    }

    .full-width { width: 100%; }

    /* Controls Bar: Search & Scope Filter */
    .fee-control-deck {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;

      .fee-search-box {
        display: flex;
        align-items: center;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 0 8px;
        height: 32px;
        flex: 1;
        min-width: 180px;
        transition: border-color 0.15s ease;

        &:focus-within {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
        }

        .search-ico {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #94a3b8;
          margin-right: 6px;
        }

        .fee-search-input {
          border: none;
          outline: none;
          background: transparent;
          font-size: 0.78rem;
          color: #0f172a;
          width: 100%;

          &::placeholder {
            color: #94a3b8;
          }
        }

        .clear-search-btn {
          width: 22px;
          height: 22px;
          min-width: 22px;
          min-height: 22px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #f1f5f9;
          border: none;
          cursor: pointer;
          transition: background 0.15s ease;

          &:hover {
            background: #e2e8f0;
            mat-icon {
              color: #0f172a;
            }
          }

          mat-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
            line-height: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #64748b;
            margin: 0;
          }
        }
      }

      .fee-scope-toggle {
        display: inline-flex;
        background: #e2e8f0;
        border-radius: 6px;
        padding: 2px;
        gap: 2px;

        .scope-pill-btn {
          border: none;
          background: transparent;
          font-size: 0.74rem;
          font-weight: 600;
          color: #475569;
          padding: 4px 10px;
          border-radius: 5px;
          cursor: pointer;
          transition: all 0.15s ease;

          &.active {
            background: #2563eb;
            color: #ffffff;
            box-shadow: 0 1px 3px rgba(37, 99, 235, 0.25);
          }

          &:hover:not(.active) {
            background: #cbd5e1;
            color: #1e293b;
          }
        }
      }
    }

    .fee-smooth-loader {
      height: 3px !important;
    }

    .fee-table-content {
      padding: 0 !important;
      overflow-x: hidden !important;

      .table-responsive {
        overflow-x: hidden !important;
        width: 100%;
      }

      table {
        min-width: 0 !important;
        width: 100% !important;
      }

      th.mat-mdc-header-cell,
      td.mat-mdc-cell {
        padding: 6px 6px !important;
      }

      th.mat-mdc-header-cell:first-of-type,
      td.mat-mdc-cell:first-of-type {
        padding-left: 12px !important;
      }

      th.mat-mdc-header-cell:last-of-type,
      td.mat-mdc-cell:last-of-type {
        padding-right: 10px !important;
      }

      tr.mat-mdc-row {
        transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease;

        td.mat-mdc-cell {
          transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        &:hover {
          background-color: #f0f7ff !important;
          box-shadow: inset 3px 0 0 #3b82f6;

          td.mat-mdc-cell {
            background-color: transparent !important;
          }
        }
      }
    }

    .student-cell {
      display: flex;
      align-items: center;
      gap: 8px;

      .student-avatar-container {
        position: relative;
        width: 34px;
        height: 34px;
        flex-shrink: 0;

        .student-avatar-img {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          object-fit: cover;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          border: 1px solid #e2e8f0;
        }

        .student-avatar-badge {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          color: #ffffff;
          font-weight: 700;
          font-size: 0.82rem;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(99, 102, 241, 0.35);
        }
      }

      .student-info {
        display: flex;
        flex-direction: column;
        .stu-name-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        strong { font-size: 0.86rem; color: #0f172a; }
        small  { font-size: 0.74rem; color: #64748b; }
      }
    }

    .sibling-badge {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fde68a;
      line-height: 1.4;
      white-space: nowrap;

      mat-icon {
        font-size: 11px;
        width: 11px;
        height: 11px;
        line-height: 11px;
      }
    }

    .class-cell-wrap {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 3px;

      .class-badge-row {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
    }

    .admission-scope-badge {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      padding: 1px 6px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      line-height: 1.4;
      white-space: nowrap;

      &.badge-school {
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
      }

      &.badge-coaching {
        background: #f5f3ff;
        color: #6d28d9;
        border: 1px solid #ddd6fe;
      }

      &.badge-hybrid {
        background: linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%);
        color: #047857;
        border: 1px solid #86efac;
      }
    }

    .class-pill {
      display: inline-flex;
      align-items: center;
      padding: 2px 7px;
      border-radius: 5px;
      font-size: 0.74rem;
      font-weight: 600;
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #bfdbfe;
      white-space: nowrap;
    }

    .due-date-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 0.68rem;
      font-weight: 600;
      background: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
      white-space: nowrap;
      line-height: 1.2;

      .due-clock-icon {
        font-size: 11px;
        width: 11px;
        height: 11px;
        color: #ef4444;
      }
    }

    .amount-due {
      color: #dc2626;
      font-weight: 700;
      font-size: 0.92rem;

      .due-cell-stack {
        display: inline-flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
      }

      .partial-paid-badge {
        font-size: 0.62rem;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 4px;
        background: #fffbeb;
        color: #b45309;
        border: 1px solid #fde68a;
        white-space: nowrap;
        line-height: 1.25;
      }
    }

    .row-actions-group {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      white-space: nowrap;
    }

    .mini-voice-btn {
      width: 30px;
      height: 30px;
      min-width: 30px;
      min-height: 30px;
      padding: 0;
      box-sizing: border-box;
      border: 1px solid #ddd6fe;
      border-radius: 50%;
      background: #f5f3ff;
      color: #7c3aed;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(124, 58, 237, 0.15);
      transition: all 0.18s ease;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        line-height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      &:hover {
        background: #ede9fe;
        border-color: #c4b5fd;
        transform: scale(1.06);
      }
    }

    .actions-th {
      text-align: right !important;
      padding-right: 12px !important;
      width: 68px;
      min-width: 64px;
      box-sizing: border-box;

      .th-action-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #64748b;
        vertical-align: middle;
      }
    }

    .actions-td {
      padding-right: 10px !important;
      white-space: nowrap;
      width: 68px;
      min-width: 64px;
      box-sizing: border-box;
    }

    @media (max-width: 1536px) {
      .fee-table-content {
        th.mat-mdc-header-cell,
        td.mat-mdc-cell {
          padding: 6px 4px !important;
        }

        th.mat-mdc-header-cell:first-of-type,
        td.mat-mdc-cell:first-of-type {
          padding-left: 10px !important;
        }

        th.mat-mdc-header-cell:last-of-type,
        td.mat-mdc-cell:last-of-type {
          padding-right: 8px !important;
        }
      }

      .student-cell {
        gap: 6px;

        .student-avatar-container {
          width: 28px;
          height: 28px;

          .student-avatar-img,
          .student-avatar-badge {
            width: 28px;
            height: 28px;
            font-size: 0.74rem;
          }
        }

        .student-info {
          strong {
            font-size: 0.78rem;
            line-height: 1.2;
          }
          small {
            font-size: 0.68rem;
          }
        }
      }

      .class-pill {
        font-size: 0.68rem;
        padding: 1px 5px;
      }

      .admission-scope-badge {
        font-size: 0.6rem;
        padding: 1px 4px;
      }

      .due-date-badge {
        font-size: 0.62rem;
        padding: 1px 4px;
      }

      .amount-due {
        font-size: 0.82rem;

        .partial-paid-badge {
          font-size: 0.58rem;
          padding: 1px 4px;
        }
      }

      .row-actions-group {
        gap: 3px;
      }

      .mini-voice-btn,
      .more-action-btn,
      .reminded-today-pill {
        width: 27px;
        height: 27px;
        min-width: 27px;
        min-height: 27px;

        mat-icon {
          font-size: 15px;
          width: 15px;
          height: 15px;
          line-height: 15px;
        }
      }

      .actions-th,
      .actions-td {
        width: 62px;
        min-width: 60px;
      }
    }

    .more-action-btn {
      width: 30px;
      height: 30px;
      min-width: 30px;
      min-height: 30px;
      padding: 0;
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      border-radius: 50%;
      background: #f8fafc;
      color: #475569;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
      transition: all 0.18s ease;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        line-height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      &:hover {
        background: #eff6ff;
        border-color: #93c5fd;
        color: #1e40af;
        transform: scale(1.06);
      }
    }

    .wa-remind-btn {
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%) !important;
      color: white !important;
      font-size: 0.76rem !important;
      font-weight: 600 !important;
      height: 30px !important;
      line-height: 30px !important;
      padding: 0 10px !important;
      border-radius: 20px !important;
      box-shadow: 0 2px 6px rgba(34, 197, 94, 0.3) !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      transition: transform 0.15s ease, box-shadow 0.15s ease !important;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 10px rgba(34, 197, 94, 0.45) !important;
      }
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }

    .reminded-today-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      min-width: 30px;
      min-height: 30px;
      padding: 0;
      box-sizing: border-box;
      color: #047857;
      background: #ecfdf5;
      border: 1px solid #86efac;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(16, 185, 129, 0.18);
      cursor: default;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        line-height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #10b981;
      }
    }

    .compact-fee-paginator {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      font-size: 0.75rem;

      ::ng-deep .mat-mdc-paginator-container {
        min-height: 40px;
        padding: 0 12px;
      }
    }

    .test-cell {
      display: flex;
      flex-direction: column;
      strong { font-size: 0.88rem; color: #0f172a; }
      small  { font-size: 0.75rem; color: #64748b; }
    }

    .batch-badge {
      display: inline-block;
      padding: 2px 7px;
      background: #e0f2fe;
      color: #0369a1;
      border-radius: 8px;
      font-size: 0.72rem;
      font-weight: 600;
      white-space: nowrap;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: middle;
    }

    th.mat-header-cell, td.mat-cell {
      padding: 8px 6px !important;
    }

    .recent-tests-table {
      th.mat-column-title, td.mat-column-title {
        min-width: 100px;
      }
      th.mat-column-batchName, td.mat-column-batchName {
        max-width: 125px;
        padding: 8px 4px !important;
      }
      th.mat-column-maxMarks, td.mat-column-maxMarks {
        width: 65px;
        padding: 8px 4px !important;
      }
      th.mat-column-marksEnteredCount, td.mat-column-marksEnteredCount {
        width: 85px;
        padding: 8px 4px !important;
      }
      th.mat-column-testDate, td.mat-column-testDate {
        width: 95px;
        min-width: 95px;
        padding-left: 4px !important;
        padding-right: 8px !important;
        white-space: nowrap !important;
        text-align: right;
        font-size: 0.8rem;
        font-weight: 600;
        color: #475569;
      }
    }

    .apex-chart-wrap {
      width: 100%;
      height: 100%;
    }

    .apex-donut-wrap {
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .marks-badge {
      display: inline-block;
      padding: 2px 10px;
      background: #fef3c7;
      color: #b45309;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 700;
    }

    .entries-badge {
      display: inline-block;
      padding: 2px 10px;
      background: #dcfce7;
      color: #166534;
      border-radius: 8px;
      font-size: 0.78rem;
      font-weight: 600;
      &.no-entries { background: #fee2e2; color: #991b1b; }
    }

    .empty-inline {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 20px 16px;
      font-size: 0.88rem;
      color: #64748b;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
      a { color: #2563eb; text-decoration: none; font-weight: 600; }
    }

    /* ─── Celebration Radar ─── */
    .celebration-radar-grid {
      display: grid;
      grid-template-columns: 1.6fr 1fr;
      gap: 20px;
    }

    .radar-card {
      border-radius: 14px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .radar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #f1f5f9;
      background: #fafafa;
      flex-wrap: wrap;
      gap: 10px;

      .radar-title-wrap {
        display: flex;
        align-items: center;
        gap: 12px;

        .radar-icon-badge {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;

          mat-icon { font-size: 22px; width: 22px; height: 22px; }

          &.events-badge { background: #eff6ff; color: #2563eb; }
          &.bday-badge { background: #fdf2f8; color: #db2777; }
        }

        .radar-title {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.3;
        }

        .radar-sub {
          margin: 2px 0 0;
          font-size: 0.74rem;
          color: #64748b;
        }
      }

      .radar-actions {
        display: flex;
        align-items: center;
        gap: 8px;

        .view-events-btn {
          font-size: 0.76rem;
          height: 32px;
        }

        .new-event-btn {
          font-size: 0.76rem;
          height: 32px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
      }

      .bday-count-pill {
        font-size: 0.76rem;
        font-weight: 700;
        background: #ffe4e6;
        color: #be123c;
        border: 1px solid #fecdd3;
        padding: 3px 10px;
        border-radius: 20px;
      }
    }

    .events-content {
      padding: 0 !important;
      flex: 1;
    }

    .events-cards-row {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 14px;
      padding: 16px;

      .event-mini-card {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        overflow: hidden;
        background: #ffffff;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        display: flex;
        flex-direction: column;
        transition: transform 0.15s ease, box-shadow 0.15s ease;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.08);
        }

        .event-banner {
          height: 85px;
          position: relative;
          background-size: cover;
          background-position: center;

          .cat-chip {
            position: absolute;
            top: 6px;
            right: 8px;
            font-size: 0.65rem;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 10px;
            background: rgba(255,255,255,0.92);
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);

            &.national { background: #fff7ed; color: #c2410c; }
            &.cultural { background: #fdf2f8; color: #be185d; }
            &.sports { background: #f0fdf4; color: #15803d; }
            &.ptm { background: #f0f9ff; color: #0369a1; }
            &.academic { background: #f5f3ff; color: #6d28d9; }
          }

          .event-date-flag {
            position: absolute;
            bottom: 6px;
            left: 8px;
            background: rgba(255,255,255,0.95);
            border-radius: 6px;
            padding: 2px 6px;
            text-align: center;
            line-height: 1;
            box-shadow: 0 1px 4px rgba(0,0,0,0.2);

            .m { font-size: 0.58rem; font-weight: 800; color: #dc2626; display: block; }
            .d { font-size: 0.95rem; font-weight: 800; color: #0f172a; display: block; margin-top: 1px; }
          }
        }

        .event-info {
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;

          .event-name {
            margin: 0 0 4px;
            font-size: 0.88rem;
            font-weight: 700;
            color: #1e293b;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .meta-row {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 0.72rem;
            color: #64748b;

            mat-icon { font-size: 14px; width: 14px; height: 14px; color: #94a3b8; }
            span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          }

          .bottom-actions {
            display: flex;
            gap: 6px;
            margin-top: auto;
            padding-top: 8px;

            .pdf-tag {
              font-size: 0.68rem;
              font-weight: 600;
              color: #dc2626;
              background: #fef2f2;
              border: 1px solid #fecaca;
              border-radius: 4px;
              padding: 2px 6px;
              display: inline-flex;
              align-items: center;
              gap: 2px;
              text-decoration: none;

              mat-icon { font-size: 13px; width: 13px; height: 13px; }
              &:hover { background: #fee2e2; }
            }

            .memories-tag {
              font-size: 0.68rem;
              font-weight: 600;
              color: #0284c7;
              background: #f0f9ff;
              border: 1px solid #bae6fd;
              border-radius: 4px;
              padding: 2px 6px;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              gap: 2px;

              mat-icon { font-size: 13px; width: 13px; height: 13px; }
              &:hover { background: #e0f2fe; }
            }
          }
        }
      }
    }

    .empty-events-radar {
      padding: 36px 20px;
      text-align: center;

      .empty-events-icon {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #eff6ff;
        color: #2563eb;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 10px;

        mat-icon { font-size: 26px; width: 26px; height: 26px; }
      }

      .empty-main {
        font-size: 0.95rem;
        font-weight: 700;
        color: #1e293b;
        margin: 0 0 4px;
      }

      .empty-desc {
        font-size: 0.78rem;
        color: #64748b;
        margin: 0 0 14px;
        max-width: 380px;
        margin-left: auto;
        margin-right: auto;
      }
    }

    .birthdays-content {
      padding: 0 !important;
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .today-bday-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px;

      .bday-item-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
        border: 1px solid #fecdd3;
        border-radius: 10px;

        .bday-avatar-wrap {
          position: relative;
          width: 42px;
          height: 42px;
          flex-shrink: 0;

          .bday-avatar {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #fda4af;
          }

          .bday-avatar-fallback {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: #e11d48;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 1.1rem;
          }

          .confetti-emoji {
            position: absolute;
            top: -6px;
            right: -6px;
            font-size: 14px;
          }
        }

        .bday-details {
          flex: 1;
          min-width: 0;

          .bday-name-row {
            display: flex;
            align-items: center;
            gap: 6px;

            .person-name {
              font-size: 0.88rem;
              font-weight: 700;
              color: #881337;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .role-pill {
              font-size: 0.62rem;
              font-weight: 700;
              padding: 1px 6px;
              border-radius: 8px;
              background: #fecdd3;
              color: #9f1239;

              &.staff { background: #fed7aa; color: #9a3412; }
            }
          }

          .bday-meta {
            font-size: 0.72rem;
            color: #9f1239;
            margin-top: 2px;
            display: block;
          }
        }

        .wa-wish-btn {
          background: #22c55e !important;
          color: #ffffff !important;
          border-radius: 20px;
          font-size: 0.74rem;
          font-weight: 700;
          height: 32px;
          padding: 0 12px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          box-shadow: 0 2px 4px rgba(34,197,94,0.3);
          flex-shrink: 0;

          .wa-icon { font-size: 16px; width: 16px; height: 16px; }
          &:hover { background: #16a34a !important; }
        }
      }
    }

    .no-bday-today {
      padding: 24px 16px;
      text-align: center;

      .bday-cal-icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #f1f5f9;
        color: #94a3b8;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 8px;

        mat-icon { font-size: 22px; width: 22px; height: 22px; }
      }

      .no-bday-text {
        font-size: 0.88rem;
        font-weight: 700;
        color: #334155;
        margin: 0 0 3px;
      }

      .no-bday-sub {
        font-size: 0.74rem;
        color: #64748b;
        margin: 0;
      }
    }

    .upcoming-bdays-section {
      margin-top: auto;
      padding: 12px 14px;
      background: #f8fafc;
      border-top: 1px solid #f1f5f9;

      .upcoming-header-label {
        font-size: 0.72rem;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 8px;

        mat-icon { font-size: 14px; width: 14px; height: 14px; color: #2563eb; }
      }

      .upcoming-chips-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;

        .upcoming-chip {
          font-size: 0.72rem;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 3px 8px;
          display: inline-flex;
          align-items: center;
          gap: 4px;

          .ub-date { font-weight: 700; color: #2563eb; }
          .ub-name { color: #1e293b; font-weight: 600; }
          .ub-role { color: #94a3b8; font-size: 0.66rem; }
        }
      }
    }

    /* ─── Student Portal Hero Banner ─── */
    .student-portal-hero-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.25rem;
      flex-wrap: wrap;
      gap: 1rem;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.08);

      .sph-left {
        display: flex;
        align-items: center;
        gap: 1rem;

        .sph-icon {
          width: 48px;
          height: 48px;
          background: #2563eb;
          color: #ffffff;
          border-radius: 10px;
          box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
          display: flex;
          align-items: center;
          justify-content: center;

          mat-icon { font-size: 28px; width: 28px; height: 28px; }
        }

        .sph-title {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          color: #1e3a8a;
        }

        .sph-sub {
          margin: 2px 0 0;
          font-size: 0.825rem;
          color: #3b82f6;
        }
      }

      .sph-btn {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
        color: #ffffff !important;
        font-weight: 600 !important;
        border-radius: 8px !important;
        padding: 0.5rem 1.25rem !important;
      }
    }

    /* ─── Role Hero Banners (Student & Faculty) ─── */
    .role-hero-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.25rem 1.75rem;
      border-radius: 14px;
      gap: 1.5rem;
      flex-wrap: wrap;

      @media (max-width: 768px) {
        padding: 12px 14px;
        gap: 12px;
        flex-direction: column;
        align-items: stretch;

        .hero-left {
          gap: 10px;
          align-items: flex-start;
          width: 100%;
        }

        .hero-avatar-wrap {
          width: 44px;
          height: 44px;
          min-width: 44px;
          border-radius: 10px;
          .hero-avatar { font-size: 1.3rem; }
        }

        .hero-info {
          width: 100%;
          .hero-name-row {
            gap: 6px;
            .hero-name { font-size: 1.1rem; }
            .hero-badge { font-size: 0.68rem; padding: 2px 7px; }
          }
          .hero-meta-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
            font-size: 0.78rem;
          }
        }

        .hero-actions {
          width: 100%;
          .hero-action-btn {
            width: 100%;
            justify-content: center;
            font-size: 0.82rem;
            padding: 0.5rem 1rem !important;
          }
        }
      }

      &.student-theme {
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        border: 1px solid #bfdbfe;
      }

      &.teacher-theme {
        background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
        border: 1px solid #bbf7d0;
      }

      .hero-left {
        display: flex;
        align-items: center;
        gap: 1.25rem;
      }

      .hero-avatar-wrap {
        position: relative;
        width: 56px;
        height: 56px;
        border-radius: 14px;
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3);

        .hero-avatar {
          font-size: 1.6rem;
          font-weight: 800;
        }

        .online-dot {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #10b981;
          border: 2px solid #ffffff;
        }
      }

      .hero-info {
        display: flex;
        flex-direction: column;
        gap: 4px;

        .hero-name-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;

          .hero-name {
            margin: 0;
            font-size: 1.35rem;
            font-weight: 700;
            color: #1e3a8a;
          }

          .hero-badge {
            font-size: 0.72rem;
            font-weight: 700;
            padding: 3px 9px;
            border-radius: 20px;

            &.badge-grade {
              background: #dbeafe;
              color: #1d4ed8;
              border: 1px solid #bfdbfe;
            }

            &.badge-dept {
              background: #dcfce7;
              color: #15803d;
              border: 1px solid #bbf7d0;
            }

            &.badge-active {
              background: #ecfdf5;
              color: #059669;
              border: 1px solid #a7f3d0;
            }
          }
        }

        .hero-meta-row {
          display: flex;
          align-items: center;
          gap: 16px;
          color: #3b82f6;
          font-size: 0.85rem;
          flex-wrap: wrap;

          span {
            display: inline-flex;
            align-items: center;
            gap: 4px;

            mat-icon {
              font-size: 16px;
              width: 16px;
              height: 16px;
              color: #2563eb;
            }

            strong {
              color: #1e40af;
              font-weight: 700;
            }
          }
        }
      }

      .hero-actions .hero-action-btn {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
        color: #ffffff !important;
        font-weight: 600 !important;
        border-radius: 10px !important;
        padding: 0.65rem 1.4rem !important;
        box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25) !important;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
    }

    /* ─── Role Hub Grid & Cards ─── */
    .hub-grid-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;

      @media (max-width: 992px) {
        grid-template-columns: 1fr;
      }
    }

    .hub-card {
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      display: flex;
      flex-direction: column;

      @media (max-width: 600px) {
        .widget-header {
          padding: 10px 12px;
          flex-direction: column;
          align-items: stretch;
          gap: 8px;

          .widget-title-wrap {
            gap: 10px;
            .widget-icon-box {
              width: 32px;
              height: 32px;
              min-width: 32px;
              mat-icon { font-size: 18px; width: 18px; height: 18px; }
            }
            .widget-title { font-size: 0.95rem; }
            .widget-sub { font-size: 0.72rem; }
          }
          .hub-link-btn {
            width: 100%;
            justify-content: center;
          }
        }
        .widget-content {
          padding: 10px;
        }
      }

      .widget-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 18px;
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        border-bottom: 1px solid #bfdbfe;
        flex-wrap: wrap;
        gap: 10px;

        .widget-title-wrap {
          display: flex;
          align-items: center;
          gap: 12px;

          .widget-icon-box {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            background: #2563eb;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
            mat-icon { font-size: 20px; width: 20px; height: 20px; }
          }

          .widget-title {
            margin: 0;
            font-size: 1.05rem;
            font-weight: 700;
            color: #1e3a8a;
          }

          .widget-sub {
            margin: 2px 0 0;
            font-size: 0.78rem;
            color: #3b82f6;
          }
        }

        .hub-link-btn {
          border-color: #93c5fd !important;
          color: #1d4ed8 !important;
          background: #ffffff !important;
          font-weight: 600;
          font-size: 0.8rem;
          height: 32px;
          line-height: 32px;
          padding: 0 10px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
      }

      .widget-content {
        padding: 16px;
        min-height: 220px;
      }
    }

    /* ─── Routine & Timetable List ─── */
    .routine-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .routine-item-card {
      display: flex;
      align-items: center;
      padding: 10px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      gap: 14px;
      transition: all 0.2s ease;

      @media (max-width: 600px) {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        padding: 8px 10px;

        .routine-time-box {
          width: 100%;
          flex-direction: row;
          justify-content: space-between;
          padding: 4px 10px;
          min-width: auto;
          box-sizing: border-box;
        }
      }

      &:hover {
        background: #f1f5f9;
        border-color: #cbd5e1;
      }

      .routine-time-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 8px;
        padding: 6px 12px;
        min-width: 90px;
        text-align: center;

        .period-num {
          font-size: 0.72rem;
          font-weight: 700;
          color: #1d4ed8;
          text-transform: uppercase;
        }

        .time-range {
          font-size: 0.75rem;
          font-weight: 600;
          color: #1e40af;
          white-space: nowrap;
        }
      }

      .routine-details {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 3px;

        .subj-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;

          .subj-name {
            font-size: 0.95rem;
            font-weight: 700;
            color: #0f172a;
          }

          .room-chip {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            font-size: 0.72rem;
            font-weight: 600;
            color: #475569;
            background: #e2e8f0;
            padding: 2px 7px;
            border-radius: 12px;

            mat-icon { font-size: 14px; width: 14px; height: 14px; }
          }
        }

        .teacher-lbl {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.8rem;
          color: #64748b;

          mat-icon { font-size: 15px; width: 15px; height: 15px; color: #94a3b8; }
        }
      }
    }

    /* ─── Homework & Diary List ─── */
    .homework-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .hw-item-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: all 0.2s ease;

      &:hover {
        background: #f1f5f9;
        border-color: #bfdbfe;
      }

      .hw-top-row {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .hw-subj-pill {
          background: #eff6ff;
          color: #2563eb;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
          border: 1px solid #bfdbfe;
        }

        .hw-due-pill {
          font-size: 0.72rem;
          font-weight: 700;
          color: #dc2626;
          background: #fef2f2;
          padding: 2px 8px;
          border-radius: 12px;
          border: 1px solid #fecaca;
        }
      }

      .hw-title {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 700;
        color: #1e293b;
      }

      .hw-desc {
        margin: 0;
        font-size: 0.82rem;
        color: #64748b;
        line-height: 1.4;
      }

      .hw-bottom-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.75rem;
        color: #94a3b8;
        padding-top: 4px;
        border-top: 1px dashed #e2e8f0;

        .hw-teacher {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          mat-icon { font-size: 14px; width: 14px; height: 14px; }
        }
      }
    }

    /* ─── Tests & Exams List ─── */
    .tests-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .test-item-card {
      display: flex;
      align-items: center;
      padding: 12px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      gap: 14px;
      transition: all 0.2s ease;

      @media (max-width: 600px) {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        padding: 8px 10px;

        .test-date-badge {
          width: 100%;
          flex-direction: row;
          justify-content: space-between;
          padding: 4px 10px;
          min-width: auto;
          box-sizing: border-box;
          .d { font-size: 1rem; }
        }
      }

      &:hover {
        background: #f1f5f9;
        border-color: #ddd6fe;
      }

      .test-date-badge {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: #faf5ff;
        border: 1px solid #e9d5ff;
        border-radius: 8px;
        padding: 6px 12px;
        min-width: 52px;

        .m {
          font-size: 0.68rem;
          font-weight: 800;
          color: #7c3aed;
        }

        .d {
          font-size: 1.15rem;
          font-weight: 800;
          color: #6d28d9;
          line-height: 1.1;
        }
      }

      .test-details {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 3px;

        .test-name-row {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .test-title {
            margin: 0;
            font-size: 0.95rem;
            font-weight: 700;
            color: #0f172a;
          }

          .test-marks-chip {
            font-size: 0.72rem;
            font-weight: 700;
            color: #6d28d9;
            background: #ede9fe;
            padding: 2px 7px;
            border-radius: 10px;
          }
        }

        .test-subj {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.8rem;
          color: #64748b;

          mat-icon { font-size: 15px; width: 15px; height: 15px; color: #8b5cf6; }
        }

        .test-syllabus {
          margin: 2px 0 0;
          font-size: 0.78rem;
          color: #475569;
          strong { color: #1e293b; }
        }

        .test-eval-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 4px;
          padding-top: 4px;
          border-top: 1px dashed #e2e8f0;

          .eval-stat {
            font-size: 0.78rem;
            font-weight: 600;
            color: #f59e0b;
          }

          .enter-marks-mini-btn {
            height: 26px !important;
            line-height: 26px !important;
            padding: 0 10px !important;
            font-size: 0.75rem !important;
            font-weight: 600 !important;
            border-radius: 6px !important;
          }
        }
      }
    }

    /* ─── Library Books List ─── */
    .books-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .book-item-card {
      display: flex;
      align-items: center;
      padding: 12px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      gap: 12px;
      transition: all 0.2s ease;

      &.is-overdue {
        background: #fff5f5;
        border-color: #fca5a5;
      }

      .book-icon-badge {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: #ccfbf1;
        color: #0f766e;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        mat-icon { font-size: 22px; width: 22px; height: 22px; }
      }

      .book-details {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 3px;

        .book-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .book-title {
            margin: 0;
            font-size: 0.95rem;
            font-weight: 700;
            color: #0f172a;
          }

          .book-status-pill {
            font-size: 0.7rem;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 10px;
            background: #dcfce7;
            color: #15803d;

            &.overdue {
              background: #fee2e2;
              color: #dc2626;
            }
          }
        }

        .book-author {
          font-size: 0.8rem;
          color: #64748b;
        }

        .book-dates-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: #94a3b8;
          margin-top: 2px;

          .due-text {
            color: #475569;
            &.text-red { color: #dc2626; }
          }
        }
      }
    }

    /* ─── Circulars & Notices List ─── */
    .notices-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .notice-item-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 5px;

      .notice-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .notice-cat-chip {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
          background: #eff6ff;
          color: #2563eb;

          &.urgent, &.exam {
            background: #fef2f2;
            color: #dc2626;
          }
          &.holiday {
            background: #f0fdf4;
            color: #16a34a;
          }
        }

        .notice-date {
          font-size: 0.75rem;
          color: #94a3b8;
        }
      }

      .notice-title {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 700;
        color: #1e293b;
      }

      .notice-desc {
        margin: 0;
        font-size: 0.82rem;
        color: #64748b;
        line-height: 1.4;
      }
    }

    /* ─── Faculty Quick Actions Grid ─── */
    .quick-actions-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;

      @media (max-width: 580px) {
        grid-template-columns: 1fr;
      }

      .action-tile {
        display: flex;
        flex-direction: column;
        padding: 16px;
        border-radius: 12px;
        text-decoration: none;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        border: 1px solid #e2e8f0;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 15px rgba(0, 0, 0, 0.08);
        }

        mat-icon {
          font-size: 28px;
          width: 28px;
          height: 28px;
          margin-bottom: 8px;
        }

        .tile-title {
          font-size: 0.95rem;
          font-weight: 700;
          margin-bottom: 2px;
        }

        .tile-desc {
          font-size: 0.75rem;
          opacity: 0.85;
          line-height: 1.3;
        }

        &.blue-tile {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1d4ed8;
          mat-icon { color: #2563eb; }
        }

        &.purple-tile {
          background: #faf5ff;
          border-color: #e9d5ff;
          color: #6d28d9;
          mat-icon { color: #7c3aed; }
        }

        &.orange-tile {
          background: #fffbeb;
          border-color: #fde68a;
          color: #b45309;
          mat-icon { color: #f59e0b; }
        }

        &.teal-tile {
          background: #f0fdfa;
          border-color: #99f6e4;
          color: #0f766e;
          mat-icon { color: #0d9488; }
        }
      }
    }

    /* ─── Hub Empty States ─── */
    .hub-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 35px 20px;

      .empty-icon {
        font-size: 42px;
        width: 42px;
        height: 42px;
        color: #94a3b8;
        margin-bottom: 10px;

        &.text-green { color: #10b981; }
      }

      .empty-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 700;
        color: #334155;
      }

      .empty-sub {
        margin: 4px 0 0;
        font-size: 0.82rem;
        color: #94a3b8;
        max-width: 320px;
      }
    }

    .overdue-pill {
      background: rgba(239, 68, 68, 0.35) !important;
      color: #ffffff !important;
    }

    /* ─── Responsive ─── */
    @media (max-width: 1024px) {
      .charts-row { grid-template-columns: 1fr; }
      .celebration-radar-grid { grid-template-columns: 1fr; }
      .bottom-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  // Agentic AI Executive Director Voice Copilot Properties (defaults to hidden on page load)
  get isAiDirectorOpen(): boolean {
    return this.aiCopilotService.isExecutiveCopilotVisible();
  }
  set isAiDirectorOpen(val: boolean) {
    this.aiCopilotService.setExecutiveCopilotVisible(val);
    if (!val) {
      this.clearAiDirector();
    }
  }
  isAiDirectorListening = false;
  aiDirectorPromptText = '';
  aiDirectorSpeechLang = 'hi-IN';
  aiDirectorAnswer: ExecutiveQueryResult | null = null;
  private aiDirectorSub?: Subscription;

  summary = signal<any>(null);
  studentSummary = signal<StudentDashboardSummary | null>(null);
  teacherSummary = signal<TeacherDashboardSummary | null>(null);
  loading = signal<boolean>(true);

  totalBilled = computed(() => {
    const s = this.summary();
    if (!s?.revenueTrends) return 0;
    return s.revenueTrends.reduce((sum: number, t: any) => sum + (t.billedAmount || 0), 0);
  });

  totalCollected = computed(() => {
    const s = this.summary();
    if (!s?.revenueTrends) return 0;
    return s.revenueTrends.reduce((sum: number, t: any) => sum + (t.collectedAmount || 0), 0);
  });

  billedTooltip = computed(() => {
    const s = this.summary();
    if (!s?.revenueTrends) return 'No billing data available.';
    const activeTrends = s.revenueTrends.filter((t: any) => (t.billedAmount || 0) > 0);
    if (!activeTrends.length) return 'No invoices billed in the last 6 months.';
    const lines = activeTrends.map((t: any) => `  • ${t.monthName}: ₹${Number(t.billedAmount).toLocaleString('en-IN')}`);
    return `6-Month Invoices Billed Breakdown\n\n` + lines.join('\n') + `\n\nTotal Billed: ₹${this.totalBilled().toLocaleString('en-IN')}`;
  });

  collectedTooltip = computed(() => {
    const s = this.summary();
    if (!s?.revenueTrends) return 'No collection data available.';
    const activeTrends = s.revenueTrends.filter((t: any) => (t.collectedAmount || 0) > 0);
    if (!activeTrends.length) return 'No fees collected in the last 6 months.';
    const lines = activeTrends.map((t: any) => `  • ${t.monthName}: ₹${Number(t.collectedAmount).toLocaleString('en-IN')}`);
    return `6-Month Fee Collections Breakdown\n\n` + lines.join('\n') + `\n\nTotal Collected: ₹${this.totalCollected().toLocaleString('en-IN')}`;
  });

  feeColumns = ['studentName', 'className', 'dueAmount', 'actions'];

  // Server-Side Urgent Fee Reminders Signals & State
  feeRemindersList = signal<any[]>([]);
  feeTotalCount = signal<number>(0);
  feeRemindersLoading = signal<boolean>(false);
  feePageIndex = 0;
  feePageSize = 10;
  feeSearchControl = new FormControl<string>('', { nonNullable: true });
  feeScopeControl = new FormControl<'All' | 'School' | 'Coaching'>('All', { nonNullable: true });
  feeSortField = 'createdAt';
  feeSortOrder: 'asc' | 'desc' = 'desc';
  testColumns = ['title', 'batchName', 'maxMarks', 'marksEnteredCount', 'testDate'];
  batchViewFilter: 'top10' | 'active' | 'all' = 'top10';
  revenueChartType: 'area' | 'bar' = 'area';

  @ViewChild('revenueChart') revenueChartRef?: ElementRef<HTMLDivElement>;
  @ViewChild('feeBreakdownChart') feeBreakdownChartRef?: ElementRef<HTMLDivElement>;
  @ViewChild('batchChart') batchChartRef?: ElementRef<HTMLDivElement>;

  private revenueChart?: ApexCharts;
  private feeBreakdownChart?: ApexCharts;
  private batchChart?: ApexCharts;
  private destroyRef = inject(DestroyRef);

  celebrations = signal<DashboardCelebrationsSummary | null>(null);

  readonly birthdayRadarSubtitle = computed(() => {
    const role = (this.authService.currentUser()?.role || '').toLowerCase();
    if (role.includes('teacher') || role.includes('faculty')) {
      return 'Class Students & Staff Celebrating Today';
    }
    if (role.includes('account') || role.includes('finance') || role.includes('clerk')) {
      return 'Staff & Colleagues Celebrating Today';
    }
    if (role.includes('student') || role.includes('parent')) {
      return 'Classmates & Teachers Celebrating Today';
    }
    return 'Students & Teachers Celebrating Today';
  });

  constructor(
    private coachingService: CoachingService,
    private confirmDialog: ConfirmDialogService,
    public authService: AuthService,
    private eventsService: EventsService,
    private dialog: MatDialog,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private aiCopilotService: AiErpCopilotService
  ) {
    // Reactively refresh dashboard when branch changes after initial load
    toObservable(this.authService.selectedBranchId)
      .pipe(
        skip(1),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        setTimeout(() => this.loadSummary(), 0);
      });

    toObservable(this.aiCopilotService.isExecutiveCopilotVisible)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(visible => {
        if (!visible) {
          this.clearAiDirector();
        }
      });
  }

  ngOnInit(): void {
    this.loadSummary();

    this.feeSearchControl.valueChanges
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.feePageIndex = 0;
        this.loadUrgentFeeReminders();
      });

    this.feeScopeControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.feePageIndex = 0;
        this.loadUrgentFeeReminders();
      });

    this.loadUrgentFeeReminders();

    this.aiDirectorSub = this.aiCopilotService.getSpeechTranscript().subscribe(text => {
      if (this.isAiDirectorListening) {
        this.aiDirectorPromptText = text;
        this.cdr.markForCheck();
      }
    });
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.destroyCharts();
    this.aiDirectorSub?.unsubscribe();
    if (this.isAiDirectorListening) {
      this.aiCopilotService.stopListening();
    }
  }

  // ════════════════════════════════════════════════════════════
  // AGENTIC AI EXECUTIVE DIRECTOR VOICE COPILOT METHODS
  // ════════════════════════════════════════════════════════════
  onAiDirectorPromptInput(): void {
    if (!this.aiDirectorPromptText?.trim() && this.isAiDirectorListening) {
      this.aiCopilotService.restartListening(this.aiDirectorSpeechLang);
    }
  }

  toggleAiDirectorSpeech(): void {
    if (!this.aiCopilotService.isSpeechSupported()) {
      this.confirmDialog.alert(
        'Speech Recognition Unavailable',
        'Web Speech API is not supported in this browser. Please use Google Chrome or type your query directly.',
        'warning'
      );
      return;
    }
    if (this.isAiDirectorListening) {
      this.aiCopilotService.stopListening();
      this.isAiDirectorListening = false;
    } else {
      this.isAiDirectorListening = true;
      this.aiCopilotService.startListening(this.aiDirectorSpeechLang);
    }
    this.cdr.markForCheck();
  }

  toggleAiDirectorLang(): void {
    this.aiDirectorSpeechLang = this.aiDirectorSpeechLang === 'hi-IN' ? 'en-IN' : 'hi-IN';
    if (this.isAiDirectorListening) {
      this.aiCopilotService.restartWithLanguage(this.aiDirectorSpeechLang);
    }
    this.cdr.markForCheck();
  }

  clearAiDirector(): void {
    this.aiDirectorPromptText = '';
    this.aiDirectorAnswer = null;
    if (this.isAiDirectorListening) {
      this.aiCopilotService.stopListening();
      this.isAiDirectorListening = false;
    }
    this.cdr.markForCheck();
  }

  processAiDirectorQuery(summary: any): void {
    const raw = (this.aiDirectorPromptText || '').trim();
    if (!raw) return;

    const instName = this.authService.getInstituteName() || 'Our Educational Institution';
    this.aiDirectorAnswer = this.aiCopilotService.queryExecutiveDashboard(raw, summary, instName);

    if (this.isAiDirectorListening) {
      this.aiCopilotService.stopListening();
      this.isAiDirectorListening = false;
    }
    this.cdr.markForCheck();
  }

  loadSummary(): void {
    this.loading.set(true);
    this.cdr.markForCheck();
    this.loadCelebrationsSummary();

    if (this.authService.isStudentOrParent()) {
      this.coachingService.getStudentDashboardSummary()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            this.studentSummary.set(res);
            this.loading.set(false);
            this.cdr.markForCheck();
          },
          error: (err) => {
            this.loading.set(false);
            this.cdr.markForCheck();
            this.confirmDialog.alert('Error', err?.error?.message || 'Failed to load student dashboard.', 'danger');
          }
        });
    } else if (this.authService.isTeacher()) {
      this.coachingService.getTeacherDashboardSummary()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            this.teacherSummary.set(res);
            this.loading.set(false);
            this.cdr.markForCheck();
          },
          error: (err) => {
            this.loading.set(false);
            this.cdr.markForCheck();
            this.confirmDialog.alert('Error', err?.error?.message || 'Failed to load teacher dashboard.', 'danger');
          }
        });
    } else {
      this.coachingService.getDashboardSummary()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            this.summary.set(res);
            this.loading.set(false);
            this.cdr.markForCheck();
            setTimeout(() => this.initCharts(), 50);
          },
          error: () => {
            this.loading.set(false);
            this.cdr.markForCheck();
            this.confirmDialog.alert('Error', 'Failed to load dashboard analytics.', 'danger');
          }
        });
    }
  }

  private destroyCharts(): void {
    if (this.revenueChart) {
      this.revenueChart.destroy();
      this.revenueChart = undefined;
    }
    if (this.feeBreakdownChart) {
      this.feeBreakdownChart.destroy();
      this.feeBreakdownChart = undefined;
    }
    if (this.batchChart) {
      this.batchChart.destroy();
      this.batchChart = undefined;
    }
  }

  private initCharts(): void {
    this.destroyCharts();
    const s = this.summary();
    if (!s) return;

    // Run chart rendering outside Angular Zone to prevent change detection overhead on mousemove/hover
    this.ngZone.runOutsideAngular(() => {
      this.renderRevenueChart(s);
      this.renderFeeBreakdownChart(s);
      this.renderBatchChart(s);
    });
  }

  toggleRevenueChartType(type: 'area' | 'bar'): void {
    if (this.revenueChartType === type) return;
    this.revenueChartType = type;
    const s = this.summary();
    if (s) {
      if (this.revenueChart) {
        this.revenueChart.destroy();
        this.revenueChart = undefined;
      }
      this.ngZone.runOutsideAngular(() => {
        this.renderRevenueChart(s);
      });
    }
  }

  private renderRevenueChart(s: any): void {
    if (!this.revenueChartRef?.nativeElement) return;

    const trends: any[] = s.revenueTrends || [];
    const labels = trends.map(t => t.monthName);
    const billedData = trends.map(t => t.billedAmount);
    const collectedData = trends.map(t => t.collectedAmount);

    let options: any;

    if (this.revenueChartType === 'area') {
      options = {
        series: [
          { name: 'Fees Billed', data: billedData },
          { name: 'Fees Collected', data: collectedData }
        ],
        chart: {
          type: 'area',
          height: 270,
          toolbar: { show: false },
          zoom: { enabled: false },
          fontFamily: 'inherit',
          foreColor: '#64748b',
          parentHeightOffset: 0,
          animations: {
            enabled: true,
            easing: 'easeinout',
            speed: 650,
            animateGradually: { enabled: true, delay: 90 },
            dynamicAnimation: { enabled: true, speed: 300 }
          },
          dropShadow: { enabled: true, top: 5, left: 0, blur: 6, opacity: 0.08 }
        },
        colors: ['#4f46e5', '#10b981'],
        stroke: {
          curve: 'smooth',
          width: [3.5, 3]
        },
        fill: {
          type: 'gradient',
          gradient: {
            type: 'vertical',
            shadeIntensity: 0.25,
            opacityFrom: 0.34,
            opacityTo: 0.035,
            stops: [0, 85, 100]
          }
        },
        markers: {
          size: 3,
          colors: ['#4f46e5', '#10b981'],
          strokeColors: '#ffffff',
          strokeWidth: 3,
          hover: { size: 7, sizeOffset: 2 }
        },
        dataLabels: { enabled: false },
        xaxis: {
          categories: labels,
          axisBorder: { show: false },
          axisTicks: { show: false },
          labels: {
            rotate: 0,
            hideOverlappingLabels: true,
            trim: true,
            style: { colors: '#64748b', fontSize: '11px', fontWeight: 600 }
          },
          crosshairs: {
            show: true,
            position: 'back',
            stroke: { color: '#94a3b8', width: 1, dashArray: 4 }
          }
        },
        yaxis: {
          min: 0,
          tickAmount: 4,
          labels: {
            style: { colors: '#718096', fontSize: '11px', fontWeight: 500 },
            formatter: (val: number) => '₹' + Number(val || 0).toLocaleString('en-IN')
          }
        },
        grid: {
          borderColor: '#e9eef5',
          strokeDashArray: 5,
          padding: { top: 8, right: 12, bottom: 2, left: 8 }
        },
        tooltip: {
          theme: 'light',
          shared: true,
          intersect: false,
          marker: { show: true },
          y: {
            formatter: (val: number) => '₹' + Number(val || 0).toLocaleString('en-IN'),
            title: { formatter: (seriesName: string) => `${seriesName}:` }
          }
        },
        legend: { show: false },
        states: {
          hover: { filter: { type: 'lighten', value: 0.08 } },
          active: { filter: { type: 'none' } }
        },
        responsive: [{
          breakpoint: 640,
          options: {
            chart: { height: 240 },
            xaxis: { labels: { style: { fontSize: '9px' } } },
            grid: { padding: { left: 2, right: 2 } }
          }
        }]
      };
    } else {
      options = {
        series: [
          { name: 'Fees Billed', data: billedData },
          { name: 'Fees Collected', data: collectedData }
        ],
        chart: {
          type: 'bar',
          height: 270,
          toolbar: { show: false },
          fontFamily: 'inherit',
          foreColor: '#64748b',
          parentHeightOffset: 0,
          animations: { enabled: true, easing: 'easeinout', speed: 450 }
        },
        colors: ['#4f46e5', '#10b981'],
        plotOptions: {
          bar: {
            horizontal: false,
            columnWidth: '42%',
            borderRadius: 7,
            borderRadiusApplication: 'end'
          }
        },
        dataLabels: { enabled: false },
        stroke: { show: true, width: 3, colors: ['transparent'] },
        xaxis: {
          categories: labels,
          axisBorder: { show: false },
          axisTicks: { show: false },
          labels: {
            rotate: 0,
            hideOverlappingLabels: true,
            style: { colors: '#64748b', fontSize: '11px', fontWeight: 600 }
          }
        },
        yaxis: {
          labels: {
            style: { colors: '#718096', fontSize: '11px', fontWeight: 500 },
            formatter: (val: number) => '₹' + Number(val || 0).toLocaleString('en-IN')
          }
        },
        grid: {
          borderColor: '#e9eef5',
          strokeDashArray: 5,
          padding: { top: 8, right: 12, bottom: 2, left: 8 }
        },
        fill: {
          opacity: 0.95,
          type: 'gradient',
          gradient: { shadeIntensity: 0.2, opacityFrom: 1, opacityTo: 0.78, stops: [0, 100] }
        },
        tooltip: {
          theme: 'light',
          marker: { show: true },
          y: {
            formatter: (val: number) => '₹' + Number(val || 0).toLocaleString('en-IN')
          }
        },
        legend: { show: false },
        responsive: [{
          breakpoint: 640,
          options: {
            chart: { height: 240 },
            xaxis: { labels: { style: { fontSize: '9px' } } },
            grid: { padding: { left: 2, right: 2 } }
          }
        }]
      };
    }

    this.revenueChart = new ApexCharts(this.revenueChartRef.nativeElement, options);
    this.revenueChart.render();
  }

  private renderFeeBreakdownChart(s: any): void {
    if (!this.feeBreakdownChartRef?.nativeElement) return;

    const breakdown = s.feeBreakdown;
    const paid = breakdown?.totalPaid || 0;
    const pending = breakdown?.totalPending || 0;

    const hasData = paid > 0 || pending > 0;
    const series = hasData ? [paid, pending] : [1, 0];
    const labels = hasData ? ['Fees Paid', 'Pending Dues'] : ['No Invoices', ''];
    const colors = hasData ? ['#10b981', '#f59e0b'] : ['#e2e8f0', '#cbd5e1'];

    const recoveryPct = breakdown?.recoveryPercentage || 0;

    const options: any = {
      series: series,
      labels: labels,
      colors: colors,
      chart: {
        type: 'donut',
        height: 210,
        fontFamily: 'inherit',
        foreColor: '#64748b',
        animations: { enabled: true, easing: 'easeinout', speed: 500 },
        dropShadow: { enabled: true, top: 3, left: 0, blur: 5, opacity: 0.1 }
      },
      stroke: { width: 4, colors: ['#ffffff'] },
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'light',
          type: 'horizontal',
          shadeIntensity: 0.2,
          opacityFrom: 1,
          opacityTo: 0.86,
          stops: [0, 100]
        }
      },
      dataLabels: { enabled: false },
      legend: { show: false },
      plotOptions: {
        pie: {
          startAngle: -90,
          endAngle: 90,
          offsetY: 10,
          donut: {
            size: '76%',
            labels: {
              show: true,
              name: {
                show: true,
                fontSize: '11px',
                fontWeight: 600,
                color: '#64748b',
                offsetY: -18
              },
              value: {
                show: true,
                fontSize: '22px',
                fontWeight: 800,
                color: '#0f172a',
                offsetY: -8,
                formatter: () => `${recoveryPct}%`
              },
              total: {
                show: true,
                label: 'Recovery Rate',
                fontSize: '11px',
                fontWeight: 600,
                color: '#64748b',
                formatter: () => `${recoveryPct}%`
              }
            }
          }
        }
      },
      tooltip: {
        theme: 'light',
        y: {
          formatter: (val: number) => hasData ? '₹' + Number(val || 0).toLocaleString('en-IN') : 'N/A'
        }
      },
      responsive: [{
        breakpoint: 640,
        options: {
          chart: { height: 190 },
          plotOptions: { pie: { donut: { size: '72%' } } }
        }
      }]
    };

    this.feeBreakdownChart = new ApexCharts(this.feeBreakdownChartRef.nativeElement, options);
    this.feeBreakdownChart.render();
  }

  setBatchViewFilter(filter: 'top10' | 'active' | 'all'): void {
    if (this.batchViewFilter === filter) return;
    this.batchViewFilter = filter;
    const s = this.summary();
    if (s) {
      if (this.batchChart) {
        this.batchChart.destroy();
        this.batchChart = undefined;
      }
      this.ngZone.runOutsideAngular(() => {
        this.renderBatchChart(s);
      });
    }
  }

  private renderBatchChart(s: any): void {
    if (!this.batchChartRef?.nativeElement) return;

    const allBatches: any[] = s.batchDistributions || [];
    if (allBatches.length === 0) return;

    let batches: any[] = [...allBatches];
    if (this.batchViewFilter === 'top10') {
      batches = [...allBatches]
        .sort((a, b) => (b.studentCount - a.studentCount) || (b.monthlyFeeRate - a.monthlyFeeRate))
        .slice(0, 10);
    } else if (this.batchViewFilter === 'active') {
      const activeOnly = allBatches.filter(b => (b.studentCount || 0) > 0);
      batches = activeOnly.length > 0 ? activeOnly : allBatches.slice(0, 10);
    }

    // Clean and streamline batch names: remove repeated "(Batch-1)", clean separators
    const labels = batches.map(b => {
      return (b.batchName || '')
        .replace(/\s*\(Batch-\d+\)\s*/gi, ' ')
        .replace(/\s+-\s+/g, ' • ')
        .replace(/\s{2,}/g, ' ')
        .trim();
    });

    const studentCounts = batches.map(b => b.studentCount || 0);
    const feeRates = batches.map(b => b.monthlyFeeRate || 0);
    const isFewBatches = batches.length <= 8;

    const options: any = {
      series: [
        { name: 'Enrolled Students', type: 'column', data: studentCounts },
        { name: 'Monthly Fee Rate (₹)', type: 'column', data: feeRates }
      ],
      chart: {
        height: 340,
        type: 'bar',
        toolbar: { show: false },
        fontFamily: 'Inter, system-ui, sans-serif',
        dropShadow: { enabled: true, top: 3, left: 0, blur: 5, opacity: 0.08 }
      },
      colors: ['#2563eb', '#8b5cf6'],
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: batches.length <= 6 ? '36%' : (batches.length <= 10 ? '46%' : '60%'),
          borderRadius: 7,
          borderRadiusApplication: 'end'
        }
      },
      dataLabels: { enabled: false },
      stroke: { show: true, width: 2, colors: ['transparent'] },
      xaxis: {
        categories: labels,
        labels: {
          rotate: isFewBatches ? 0 : -45,
          rotateAlways: !isFewBatches,
          trim: true,
          maxHeight: 110,
          style: { colors: '#475569', fontSize: '11px', fontWeight: 600 },
          formatter: (label: string) => label.length > 24 ? `${label.slice(0, 22)}…` : label
        },
        axisBorder: { color: '#e2e8f0' },
        axisTicks: { show: false }
      },
      yaxis: [
        {
          seriesName: 'Enrolled Students',
          title: {
            text: 'Students',
            style: { color: '#2563eb', fontWeight: 700, fontSize: '11px' }
          },
          tickAmount: 4,
          labels: {
            style: { colors: '#64748b' },
            formatter: (val: number) => Number(val).toFixed(0)
          }
        },
        {
          opposite: true,
          seriesName: 'Monthly Fee Rate (₹)',
          title: {
            text: 'Fee Rate (₹)',
            style: { color: '#8b5cf6', fontWeight: 700, fontSize: '11px' }
          },
          tickAmount: 4,
          labels: {
            style: { colors: '#64748b' },
            formatter: (val: number) => '₹' + Number(val || 0).toLocaleString('en-IN')
          }
        }
      ],
      legend: {
        position: 'top',
        horizontalAlign: 'right',
        fontSize: '12px',
        fontWeight: 600,
        labels: { colors: '#475569' },
        markers: { radius: 4 }
      },
      grid: {
        borderColor: '#f1f5f9',
        strokeDashArray: 4,
        padding: { top: 0, right: 15, bottom: isFewBatches ? 15 : 35, left: 15 }
      },
      fill: {
        type: 'gradient',
        opacity: 0.96,
        gradient: {
          shade: 'light',
          type: 'vertical',
          shadeIntensity: 0.18,
          opacityFrom: 1,
          opacityTo: 0.78,
          stops: [0, 100]
        }
      },
      tooltip: {
        theme: 'light',
        shared: true,
        intersect: false,
        x: {
          formatter: (_value: string, opts: any) => labels[opts?.dataPointIndex] || _value
        },
        y: {
          formatter: (val: number, opts: any) =>
            opts?.seriesIndex === 0
              ? `${val} students`
              : '₹' + Number(val || 0).toLocaleString('en-IN') + '/mo'
        }
      },
      states: {
        hover: { filter: { type: 'lighten', value: 0.1 } },
        active: { filter: { type: 'none' } }
      }
    };

    this.batchChart = new ApexCharts(this.batchChartRef.nativeElement, options);
    this.batchChart.render();
  }

  sendReminder(invoice: any): void {
    this.confirmDialog.confirm(
      'Send WhatsApp Reminder',
      `Send fee due reminder to ${invoice.studentName}'s parent (${invoice.parentWhatsAppPhone})?`,
      'Send WhatsApp',
      'Cancel',
      'warning'
    ).subscribe((confirmed) => {
      if (!confirmed) return;

      this.coachingService.sendWhatsAppReminder(invoice.id).subscribe({
        next: () => {
          if (invoice.parentWhatsAppPhone) {
            const rawPhone = invoice.parentWhatsAppPhone.replace(/\D/g, '');
            const formattedPhone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;
            const textMsg = `*FEE DUE REMINDER*\nDear Parent, This is a gentle reminder that fee of *₹${invoice.dueAmount}* for *${invoice.studentName}* (Invoice #${invoice.invoiceNumber}) is due on ${new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.\nKindly pay at the earliest.\n\nThank you!`;
            const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(textMsg)}`;
            window.open(waUrl, '_blank');
          }
          this.confirmDialog.alert('WhatsApp Opened!', `WhatsApp message opened for ${invoice.parentWhatsAppPhone}`, 'success');
        },
        error: (err) => {
          this.confirmDialog.alert('Failed', err?.error?.message || 'Could not send WhatsApp message.', 'danger');
        }
      });
    });
  }

  loadUrgentFeeReminders(): void {
    if (this.authService.isStudentOrParent()) return;

    this.feeRemindersLoading.set(true);
    this.cdr.markForCheck();

    this.coachingService
      .getUrgentFeeReminders(
        this.feePageIndex,
        this.feePageSize,
        this.feeSearchControl.value || '',
        this.feeScopeControl.value || 'All',
        '',
        this.feeSortField,
        this.feeSortOrder
      )
      .subscribe({
        next: (res: any) => {
          this.feeRemindersList.set(res?.items || []);
          this.feeTotalCount.set(res?.totalCount || 0);
          this.feeRemindersLoading.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.feeRemindersLoading.set(false);
          this.cdr.markForCheck();
        }
      });
  }

  onFeeSortChange(sort: Sort): void {
    this.feeSortField = sort.active || 'createdAt';
    this.feeSortOrder = (sort.direction as 'asc' | 'desc') || 'desc';
    this.feePageIndex = 0;
    this.loadUrgentFeeReminders();
  }

  onFeePageChange(event: PageEvent): void {
    this.feePageIndex = event.pageIndex;
    this.feePageSize = event.pageSize;
    this.loadUrgentFeeReminders();
  }

  getStudentPhotoUrl(path: string | null | undefined): string {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    const base = environment.apiBaseUrl;
    return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  onAvatarError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.style.display = 'none';
      const parent = target.parentElement;
      if (parent) {
        const fallback = parent.querySelector('.student-avatar-badge') as HTMLElement;
        if (fallback) fallback.style.display = 'inline-flex';
      }
    }
  }

  openVoiceReminder(invoice: any): void {
    if (!invoice) return;

    if (invoice.alreadyRemindedToday) {
      this.confirmDialog.alert('Already Reminded Today', `Fee reminder has already been dispatched to ${invoice.studentName} today. Per-day single message limit is active.`, 'info');
      return;
    }

    const dialogRef = this.dialog.open(StudentVoiceDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      data: {
        plan: {
          id: invoice.id,
          studentId: invoice.studentId,
          studentName: invoice.studentName,
          rollNumber: invoice.rollNumber,
          className: invoice.className || '',
          totalOverdueAmount: invoice.dueAmount,
          parentPhone: invoice.parentWhatsAppPhone,
          invoiceNumber: invoice.invoiceNumber,
          dueDate: invoice.dueDate,
          alreadyRemindedToday: invoice.alreadyRemindedToday
        },
        instituteName: this.authService.getInstituteName(),
        dueDay: invoice.dueDate ? new Date(invoice.dueDate).getDate() : 10,
        initialGender: 'Female'
      }
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res?.dispatched) {
        invoice.alreadyRemindedToday = true;
        this.loadUrgentFeeReminders();
      }
    });
  }

  formatIstTime(rawDate: any): string {
    if (!rawDate) return '';
    let str = String(rawDate).trim();
    if (str.includes('T') && !str.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
      str += 'Z';
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toUpperCase() + ' IST';
  }

  getScopeBadgeLabel(s: any): string {
    if (s?.scopeTag) return s.scopeTag;
    if (s?.isSchoolStudent && s?.isCoachingStudent) return 'School + Coaching';
    if (s?.isCoachingStudent) return 'Coaching';
    return 'School';
  }

  getScopeBadgeClass(s: any): string {
    const label = this.getScopeBadgeLabel(s);
    if (label.includes('+')) return 'badge-hybrid';
    if (label === 'Coaching') return 'badge-coaching';
    return 'badge-school';
  }

  isSibling(s: any): boolean {
    if (!s?.parentWhatsAppPhone) return false;
    const clean = s.parentWhatsAppPhone.replace(/\D/g, '');
    if (clean.length < 10) return false;
    const target = clean.slice(-10);
    return this.feeRemindersList().filter((x: any) => x.parentWhatsAppPhone && x.parentWhatsAppPhone.replace(/\D/g, '').endsWith(target)).length > 1;
  }

  openSingleWhatsAppModal(invoice: any): void {
    if (!invoice) return;

    if (invoice.alreadyRemindedToday) {
      this.confirmDialog.alert('Already Reminded Today', `Fee reminder has already been dispatched to ${invoice.studentName} today. Per-day single message limit is active.`, 'info');
      return;
    }

    const dialogRef = this.dialog.open(FeeReminderDispatchDialogComponent, {
      width: '640px',
      maxWidth: '96vw',
      data: {
        mode: 'single',
        invoice: {
          id: invoice.id,
          studentId: invoice.studentId,
          studentName: invoice.studentName,
          rollNumber: invoice.rollNumber,
          className: invoice.className,
          profilePhoto: invoice.profilePhoto,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: invoice.totalAmount,
          paidAmount: invoice.paidAmount,
          dueAmount: invoice.dueAmount,
          status: invoice.status,
          dueDate: invoice.dueDate,
          parentWhatsAppPhone: invoice.parentWhatsAppPhone,
          alreadyRemindedToday: invoice.alreadyRemindedToday,
          isSchoolStudent: invoice.isSchoolStudent,
          isCoachingStudent: invoice.isCoachingStudent,
          scopeTag: invoice.scopeTag
        },
        instituteName: this.authService.getInstituteName()
      }
    });

    dialogRef.afterClosed().subscribe(() => {
      this.loadUrgentFeeReminders();
    });
  }

  openBulkWhatsAppModal(): void {
    const list = this.feeRemindersList().length ? this.feeRemindersList() : (this.summary()?.overdueInvoices || []);
    if (!list.length) {
      this.confirmDialog.alert('No Invoices', 'There are no overdue fee invoices to remind at this time.', 'info');
      return;
    }
    const dialogRef = this.dialog.open(FeeReminderDispatchDialogComponent, {
      width: '860px',
      maxWidth: '96vw',
      data: {
        mode: 'bulk',
        invoices: list.map((x: any) => ({
          id: x.id,
          studentId: x.studentId,
          studentName: x.studentName,
          rollNumber: x.rollNumber,
          className: x.className,
          profilePhoto: x.profilePhoto,
          invoiceNumber: x.invoiceNumber,
          totalAmount: x.totalAmount,
          paidAmount: x.paidAmount,
          dueAmount: x.dueAmount,
          status: x.status,
          dueDate: x.dueDate,
          parentWhatsAppPhone: x.parentWhatsAppPhone,
          alreadyRemindedToday: x.alreadyRemindedToday,
          lastRemindedAt: x.lastRemindedAt,
          lastReminderType: x.lastReminderType,
          isSchoolStudent: x.isSchoolStudent,
          isCoachingStudent: x.isCoachingStudent,
          scopeTag: x.scopeTag
        })),
        instituteName: this.authService.getInstituteName()
      }
    });

    dialogRef.afterClosed().subscribe(() => {
      this.loadUrgentFeeReminders();
    });
  }

  loadCelebrationsSummary(): void {
    this.eventsService.getDashboardSummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: DashboardCelebrationsSummary) => {
          this.celebrations.set(data);
          this.cdr.markForCheck();
        },
        error: () => {}
      });
  }

  openCreateEventDialog(): void {
    const dialogRef = this.dialog.open(EventFormDialogComponent, {
      width: '640px',
      data: {}
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res) {
        this.loadCelebrationsSummary();
      }
    });
  }

  openEventGallery(event: SchoolEvent): void {
    const dialogRef = this.dialog.open(EventGalleryDialogComponent, {
      width: '760px',
      data: { event }
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res && typeof res.photosCount === 'number') {
        event.photosCount = res.photosCount;
        this.cdr.markForCheck();
      }
    });
  }

  sendWhatsAppWish(b: BirthdayItem): void {
    const textMsg = `*HAPPY BIRTHDAY!* 🎂🎉\nDear *${b.name}*,\n\nWishing you a very Happy Birthday from all of us at School! ✨\nMay this year bring immense learning, joy, good health, and glorious achievements!\n\n_With warm blessings & best wishes!_`;
    const phone = b.whatsAppPhone ? b.whatsAppPhone.replace(/\D/g, '') : '';
    const formattedPhone = phone.length === 10 ? '91' + phone : phone;
    const waUrl = formattedPhone ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(textMsg)}` : `https://wa.me/?text=${encodeURIComponent(textMsg)}`;
    window.open(waUrl, '_blank');
  }

  getCategoryEmoji(category: string): string {
    switch (category) {
      case 'National': return '🇮🇳';
      case 'Cultural': return '🎭';
      case 'Sports': return '🏆';
      case 'PTM': return '🤝';
      case 'Academic': return '📚';
      case 'Celebration': return '💐';
      default: return '🎉';
    }
  }

  getFallbackGradient(category: string): string {
    switch (category) {
      case 'National': return 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #15803d 100%)';
      case 'Cultural': return 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)';
      case 'Sports': return 'linear-gradient(135deg, #10b981 0%, #047857 100%)';
      case 'PTM': return 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)';
      case 'Academic': return 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)';
      default: return 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
    }
  }
}
