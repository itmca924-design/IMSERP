import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, NgZone, signal, computed, effect, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { skip } from 'rxjs';
import { CoachingService } from '../../core/services/coaching.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { EventsService, DashboardCelebrationsSummary, SchoolEvent, BirthdayItem } from '../../core/services/events.service';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { EventFormDialogComponent } from '../events/event-form-dialog.component';
import { EventGalleryDialogComponent } from '../events/event-gallery-dialog.component';
import ApexCharts from 'apexcharts';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    RouterModule,
    TranslatePipe
  ],
  template: `
    <div class="dashboard-wrapper">
      <!-- Header Banner -->
      <div class="header-banner">
        <div class="header-titles">
          <h2>{{ 'DASHBOARD.BANNER_TITLE' | translate }}</h2>
          <p>{{ 'DASHBOARD.BANNER_SUBTITLE' | translate }}</p>
        </div>
        <button mat-raised-button color="primary" class="refresh-btn" (click)="loadSummary()" [matTooltip]="'DASHBOARD.REFRESH_ANALYTICS' | translate">
          <mat-icon [class.spin-icon]="loading()">sync</mat-icon>
          <span>{{ 'DASHBOARD.REFRESH_ANALYTICS' | translate }}</span>
        </button>
      </div>

      @if (loading() && !summary()) {
        <div class="spinner-center">
          <mat-spinner diameter="44"></mat-spinner>
        </div>
      }

      @if (summary(); as summary) {

        <!-- 1. Top KPI Stat Cards -->
        <div class="card-container">
          <mat-card class="stat-card blue mat-elevation-z2">
            <mat-card-content class="stat-content">
              <div class="stat-header">
                <span class="label">{{ 'DASHBOARD.TOTAL_ACTIVE_STUDENTS' | translate }}</span>
                <div class="stat-icon-wrap">
                  <mat-icon class="stat-icon">people</mat-icon>
                </div>
              </div>
              <div class="stat-body">
                <span class="value">{{ summary.totalStudents }}</span>
                <div class="stat-footer">
                  <span class="stat-badge-pill">Live Roster</span>
                  <span class="sub-label">{{ 'DASHBOARD.ENROLLED_INSTITUTE' | translate }}</span>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card green mat-elevation-z2">
            <mat-card-content class="stat-content">
              <div class="stat-header">
                <span class="label">{{ 'DASHBOARD.MONTHLY_FEE_COLLECTED' | translate }}</span>
                <div class="stat-icon-wrap">
                  <mat-icon class="stat-icon">account_balance_wallet</mat-icon>
                </div>
              </div>
              <div class="stat-body">
                <span class="value">₹{{ summary.totalFeeCollectedThisMonth | number:'1.0-0' }}</span>
                <div class="stat-footer">
                  <span class="stat-badge-pill">This Month</span>
                  <span class="sub-label">{{ 'DASHBOARD.RECEIVED_THIS_MONTH' | translate }}</span>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card orange mat-elevation-z2">
            <mat-card-content class="stat-content">
              <div class="stat-header">
                <span class="label">{{ 'DASHBOARD.PENDING_FEE_DUES' | translate }}</span>
                <div class="stat-icon-wrap">
                  <mat-icon class="stat-icon">warning_amber</mat-icon>
                </div>
              </div>
              <div class="stat-body">
                <span class="value">₹{{ summary.pendingFeesTotal | number:'1.0-0' }}</span>
                <div class="stat-footer">
                  <span class="stat-badge-pill">Receivables</span>
                  <span class="sub-label">{{ 'DASHBOARD.OUTSTANDING_BALANCE' | translate }}</span>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card purple mat-elevation-z2">
            <mat-card-content class="stat-content">
              <div class="stat-header">
                <span class="label">{{ 'DASHBOARD.TESTS_CONDUCTED' | translate }}</span>
                <div class="stat-icon-wrap">
                  <mat-icon class="stat-icon">quiz</mat-icon>
                </div>
              </div>
              <div class="stat-body">
                <span class="value">{{ summary.totalTestsConducted }}</span>
                <div class="stat-footer">
                  <span class="stat-badge-pill">Academic</span>
                  <span class="sub-label">{{ 'DASHBOARD.EXAMS_EVALUATED' | translate }}</span>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card teal mat-elevation-z2">
            <mat-card-content class="stat-content">
              <div class="stat-header">
                <span class="label">{{ 'DASHBOARD.ACTIVE_BATCHES' | translate }}</span>
                <div class="stat-icon-wrap">
                  <mat-icon class="stat-icon">groups</mat-icon>
                </div>
              </div>
              <div class="stat-body">
                <span class="value">{{ summary.activeBatches }}</span>
                <div class="stat-footer">
                  <span class="stat-badge-pill">Running</span>
                  <span class="sub-label">{{ 'DASHBOARD.ACADEMIC_CLASSROOMS' | translate }}</span>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card emerald mat-elevation-z2" routerLink="/students/attendance" style="cursor: pointer;" matTooltip="Open Student Attendance & Roll Call">
            <mat-card-content class="stat-content">
              <div class="stat-header">
                <span class="label">{{ 'DASHBOARD.TODAY_ATTENDANCE' | translate }}</span>
                <div class="stat-icon-wrap">
                  <mat-icon class="stat-icon">how_to_reg</mat-icon>
                </div>
              </div>
              <div class="stat-body">
                <span class="value">{{ summary.todayAttendance ? summary.todayAttendance.attendancePercentage + '%' : 'Pending' }}</span>
                <div class="stat-footer">
                  <span class="stat-badge-pill" *ngIf="summary.todayAttendance">
                    {{ summary.todayAttendance.presentCount }}/{{ summary.todayAttendance.totalMarked }} Present
                  </span>
                  <span class="stat-badge-pill" *ngIf="!summary.todayAttendance">
                    Live Status
                  </span>
                  <span class="sub-label" *ngIf="summary.todayAttendance?.lastMarkedTime" matTooltip="Last Batch Attendance Timestamp">
                    At {{ summary.todayAttendance.lastMarkedTime }}
                  </span>
                  <span class="sub-label" *ngIf="!summary.todayAttendance?.lastMarkedTime">
                    Not marked yet
                  </span>
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
                <div class="chart-type-toggle">
                  <button type="button" class="type-btn" [class.active]="revenueChartType === 'area'" (click)="toggleRevenueChartType('area')">
                    <mat-icon>show_chart</mat-icon> Wave
                  </button>
                  <button type="button" class="type-btn" [class.active]="revenueChartType === 'bar'" (click)="toggleRevenueChartType('bar')">
                    <mat-icon>bar_chart</mat-icon> Bars
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
                  <strong class="item-val text-green">₹{{ summary.feeBreakdown?.totalPaid | number:'1.0-0' }}</strong>
                </div>
                <div class="summary-item">
                  <span class="item-lbl"><span class="legend-dot dot-pending"></span> Pending Dues</span>
                  <strong class="item-val text-orange">₹{{ summary.feeBreakdown?.totalPending | number:'1.0-0' }}</strong>
                </div>
                <div class="summary-item total-item"
                     matTooltip="Total Invoices Generated across institute history (Paid ₹{{ summary.feeBreakdown?.totalPaid | number:'1.0-0' }} + Pending ₹{{ summary.feeBreakdown?.totalPending | number:'1.0-0' }})"
                     matTooltipPosition="above">
                  <span class="item-lbl">Total Billed</span>
                  <strong class="item-val">₹{{ summary.feeBreakdown?.totalBilled | number:'1.0-0' }}</strong>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

        </div>

        <!-- 3. Batch Enrollment & Fee Potential Chart -->
        <mat-card class="chart-card full-chart-card mat-elevation-z2" *ngIf="summary.batchDistributions && summary.batchDistributions.length > 0">
          <div class="chart-header">
            <div class="chart-header-left">
              <div class="chart-icon-box purple-box">
                <mat-icon>school</mat-icon>
              </div>
              <div>
                <h3 class="chart-title">{{ 'DASHBOARD.BATCH_CHART_TITLE' | translate }}</h3>
                <p class="chart-subtitle">{{ 'DASHBOARD.BATCH_CHART_SUB' | translate }}</p>
              </div>
            </div>
            <div class="chart-header-right">
              <div class="batch-filter-toggle">
                <button type="button" class="toggle-btn" [class.active]="batchViewFilter === 'top10'" (click)="setBatchViewFilter('top10')">
                  {{ 'DASHBOARD.TOP_10_BATCHES' | translate }}
                </button>
                <button type="button" class="toggle-btn" [class.active]="batchViewFilter === 'active'" (click)="setBatchViewFilter('active')">
                  {{ 'DASHBOARD.ACTIVE_WITH_STUDENTS' | translate }}
                </button>
                <button type="button" class="toggle-btn" [class.active]="batchViewFilter === 'all'" (click)="setBatchViewFilter('all')">
                  {{ 'DASHBOARD.ALL_BATCHES' | translate }} ({{ summary.batchDistributions.length }})
                </button>
              </div>
            </div>
          </div>
          <mat-card-content class="batch-canvas-box">
            <div #batchChart class="apex-chart-wrap"></div>
          </mat-card-content>
        </mat-card>

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
                <a mat-stroked-button routerLink="/events" class="view-events-btn">
                  <span>View All</span>
                  <mat-icon>arrow_forward</mat-icon>
                </a>
                <button mat-raised-button color="primary" class="new-event-btn" (click)="openCreateEventDialog()">
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
                        <div class="meta-row" *ngIf="ev.venue">
                          <mat-icon>place</mat-icon>
                          <span>{{ ev.venue }}</span>
                        </div>
                        <div class="meta-row" *ngIf="ev.startTime">
                          <mat-icon>schedule</mat-icon>
                          <span>{{ ev.startTime }}</span>
                        </div>
                        <div class="bottom-actions">
                          <a *ngIf="ev.attachmentPdfUrl" [href]="ev.attachmentPdfUrl" target="_blank" class="pdf-tag" download>
                            <mat-icon>picture_as_pdf</mat-icon> Circular
                          </a>
                          <button class="memories-tag" (click)="openEventGallery(ev)">
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
                  <button mat-flat-button color="primary" (click)="openCreateEventDialog()">
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
                  <p class="radar-sub">Students & Teachers Celebrating Today</p>
                </div>
              </div>
              <span class="bday-count-pill" *ngIf="celebrations()?.todayBirthdays?.length">
                {{ celebrations()!.todayBirthdays.length }} Today 🎂
              </span>
            </div>

            <mat-card-content class="birthdays-content">
              @if (celebrations()?.todayBirthdays?.length) {
                <div class="today-bday-list">
                  @for (b of celebrations()!.todayBirthdays; track b.id) {
                    <div class="bday-item-card">
                      <div class="bday-avatar-wrap">
                        <img *ngIf="b.photoUrl" [src]="b.photoUrl" [alt]="b.name" class="bday-avatar" />
                        <div *ngIf="!b.photoUrl" class="bday-avatar-fallback">
                          {{ b.name.substring(0, 1) | uppercase }}
                        </div>
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
                      <button
                        mat-flat-button
                        class="wa-wish-btn"
                        (click)="sendWhatsAppWish(b)"
                        [matTooltip]="'Send Birthday Greeting via WhatsApp'"
                      >
                        <mat-icon class="wa-icon">chat</mat-icon>
                        <span>Wish</span>
                      </button>
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
                  <h3>{{ 'DASHBOARD.URGENT_REMINDERS_TITLE' | translate }}</h3>
                  <p>{{ 'DASHBOARD.URGENT_REMINDERS_SUB' | translate }}</p>
                </div>
              </div>
              <a mat-stroked-button color="warn" routerLink="/fees" class="view-all-btn">
                {{ 'COMMON.VIEW_ALL' | translate }} <mat-icon>arrow_forward</mat-icon>
              </a>
            </div>
            <mat-card-content>
              <table mat-table [dataSource]="summary.overdueInvoices" class="full-width">
                <ng-container matColumnDef="studentName">
                  <th mat-header-cell *matHeaderCellDef>{{ 'DASHBOARD.STUDENT' | translate }}</th>
                  <td mat-cell *matCellDef="let el">
                    <div class="student-cell">
                      <span class="student-avatar-badge">{{ (el.studentName || 'S').charAt(0).toUpperCase() }}</span>
                      <div class="student-info">
                        <strong>{{ el.studentName }}</strong>
                        <small>{{ el.rollNumber }}</small>
                      </div>
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="invoiceNumber">
                  <th mat-header-cell *matHeaderCellDef>{{ 'DASHBOARD.INVOICE' | translate }}</th>
                  <td mat-cell *matCellDef="let el">{{ el.invoiceNumber }}</td>
                </ng-container>

                <ng-container matColumnDef="dueAmount">
                  <th mat-header-cell *matHeaderCellDef class="text-right">{{ 'DASHBOARD.AMOUNT_DUE' | translate }}</th>
                  <td mat-cell *matCellDef="let el" class="amount-due text-right">
                    ₹{{ el.dueAmount | number:'1.0-0' }}
                  </td>
                </ng-container>

                <ng-container matColumnDef="dueDate">
                  <th mat-header-cell *matHeaderCellDef>{{ 'DASHBOARD.DUE_DATE' | translate }}</th>
                  <td mat-cell *matCellDef="let el">{{ el.dueDate | date:'mediumDate' }}</td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef class="text-right">{{ 'DASHBOARD.WHATSAPP' | translate }}</th>
                  <td mat-cell *matCellDef="let el" class="text-right">
                    <button mat-flat-button class="wa-remind-btn" (click)="sendReminder(el)" matTooltip="Send Fee Reminder on WhatsApp">
                      <mat-icon>chat</mat-icon> Remind
                    </button>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="feeColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: feeColumns;"></tr>

                <tr class="mat-row" *matNoDataRow>
                  <td class="mat-cell" [attr.colspan]="feeColumns.length">
                    <div class="empty-inline">
                      <mat-icon style="color:#16a34a">check_circle</mat-icon>
                      <span>{{ 'DASHBOARD.NO_OVERDUE_FEES' | translate }}</span>
                    </div>
                  </td>
                </tr>
              </table>
            </mat-card-content>
          </mat-card>

          <!-- Recent Tests -->
          <mat-card class="table-card mat-elevation-z2">
            <div class="section-header">
              <div class="section-title">
                <mat-icon class="section-icon test-icon">quiz</mat-icon>
                <div>
                  <h3>{{ 'DASHBOARD.RECENT_TESTS_TITLE' | translate }}</h3>
                  <p>{{ 'DASHBOARD.RECENT_TESTS_SUB' | translate }}</p>
                </div>
              </div>
              <a mat-stroked-button color="primary" routerLink="/tests" class="view-all-btn">
                {{ 'COMMON.VIEW_ALL' | translate }} <mat-icon>arrow_forward</mat-icon>
              </a>
            </div>
            <mat-card-content>
              <table mat-table [dataSource]="summary.recentTests" class="full-width recent-tests-table">

                <ng-container matColumnDef="title">
                  <th mat-header-cell *matHeaderCellDef>{{ 'DASHBOARD.TEST_TITLE' | translate }}</th>
                  <td mat-cell *matCellDef="let t">
                    <div class="test-cell">
                      <strong>{{ t.title }}</strong>
                      <small>{{ t.subject }}</small>
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="batchName">
                  <th mat-header-cell *matHeaderCellDef>{{ 'DASHBOARD.BATCH' | translate }}</th>
                  <td mat-cell *matCellDef="let t">
                    <span class="batch-badge" [matTooltip]="t.batchName">{{ t.batchName }}</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="maxMarks">
                  <th mat-header-cell *matHeaderCellDef class="text-center">{{ 'DASHBOARD.MAX_MARKS' | translate }}</th>
                  <td mat-cell *matCellDef="let t" class="text-center">
                    <span class="marks-badge">{{ t.maxMarks }}</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="marksEnteredCount">
                  <th mat-header-cell *matHeaderCellDef class="text-center">{{ 'DASHBOARD.ENTRIES' | translate }}</th>
                  <td mat-cell *matCellDef="let t" class="text-center">
                    <span class="entries-badge" [class.no-entries]="(t.totalStudentsEvaluated ?? t.marksEnteredCount ?? 0) === 0">
                      {{ (t.totalStudentsEvaluated ?? t.marksEnteredCount ?? 0) === 0 ? 'Pending' : (t.totalStudentsEvaluated ?? t.marksEnteredCount) + ' evaluated' }}
                    </span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="testDate">
                  <th mat-header-cell *matHeaderCellDef class="text-right">{{ 'DASHBOARD.DATE' | translate }}</th>
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

    .header-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;

      .header-titles h2 {
        margin: 0;
        font-size: 1.55rem;
        font-weight: 700;
        color: #0f172a;
        letter-spacing: -0.02em;
      }
      .header-titles p {
        margin: 4px 0 0;
        color: #64748b;
        font-size: 0.9rem;
      }

      .refresh-btn {
        height: 42px;
        font-weight: 600;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        letter-spacing: 0.02em;
      }
      .spin-icon {
        animation: spin 1s linear infinite;
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

    /* ─── Top KPI Stat Cards ─── */
    .card-container {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 16px;

      @media (max-width: 1440px) {
        grid-template-columns: repeat(3, 1fr);
      }
      @media (max-width: 768px) {
        grid-template-columns: repeat(2, 1fr);
      }
      @media (max-width: 480px) {
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
    }

    .chart-card {
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #f1f5f9;
      flex-wrap: wrap;
      gap: 12px;

      .chart-header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .chart-icon-box {
        width: 38px;
        height: 38px;
        border-radius: 8px;
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
        font-size: 1.05rem;
        font-weight: 700;
        color: #0f172a;
      }
      .chart-subtitle {
        margin: 2px 0 0;
        font-size: 0.78rem;
        color: #64748b;
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
      background: #f1f5f9;
      padding: 2px;
      border-radius: 8px;
      gap: 2px;
      border: 1px solid #e2e8f0;

      .type-btn {
        border: none;
        background: transparent;
        color: #64748b;
        font-size: 11px;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 6px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: all 0.15s ease;

        mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
        }

        &.active {
          background: #ffffff;
          color: #2563eb;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }
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
      padding: 16px 20px 20px;
      position: relative;
      height: 270px;
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
    }

    .table-card {
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05) !important;
      overflow: hidden;

      mat-card-content {
        padding: 0 10px 14px 10px !important;
        overflow-x: auto;
      }
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #f1f5f9;

      .section-title {
        display: flex;
        align-items: center;
        gap: 12px;

        .section-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
          &.warning-icon { color: #f59e0b; }
          &.test-icon    { color: #8b5cf6; }
        }

        h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 700;
          color: #0f172a;
        }
        p {
          margin: 2px 0 0;
          font-size: 0.78rem;
          color: #64748b;
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

    .student-cell {
      display: flex;
      align-items: center;
      gap: 10px;

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
        flex-shrink: 0;
        box-shadow: 0 2px 6px rgba(99, 102, 241, 0.35);
      }

      .student-info {
        display: flex;
        flex-direction: column;
        strong { font-size: 0.86rem; color: #0f172a; }
        small  { font-size: 0.74rem; color: #64748b; }
      }
    }

    .amount-due {
      color: #dc2626;
      font-weight: 700;
      font-size: 0.92rem;
    }

    .wa-remind-btn {
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%) !important;
      color: white !important;
      font-size: 0.76rem !important;
      font-weight: 600 !important;
      height: 32px !important;
      line-height: 32px !important;
      padding: 0 12px !important;
      border-radius: 20px !important;
      box-shadow: 0 3px 10px rgba(34, 197, 94, 0.35) !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      transition: transform 0.15s ease, box-shadow 0.15s ease !important;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 5px 14px rgba(34, 197, 94, 0.5) !important;
      }
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
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
          color: #2563eb;
          border-color: #bfdbfe;
        }

        .new-event-btn {
          font-size: 0.76rem;
          height: 32px;
          background: #2563eb;
          color: #ffffff;
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

    /* ─── Responsive ─── */
    @media (max-width: 1024px) {
      .charts-row { grid-template-columns: 1fr; }
      .celebration-radar-grid { grid-template-columns: 1fr; }
      .bottom-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  summary = signal<any>(null);
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

  feeColumns = ['studentName', 'invoiceNumber', 'dueAmount', 'dueDate', 'actions'];
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

  constructor(
    private coachingService: CoachingService,
    private confirmDialog: ConfirmDialogService,
    private authService: AuthService,
    private eventsService: EventsService,
    private dialog: MatDialog,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
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
  }

  ngOnInit(): void {
    this.loadSummary();
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  loadSummary(): void {
    this.loading.set(true);
    this.cdr.markForCheck();
    this.loadCelebrationsSummary();
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
          height: 250,
          toolbar: { show: false },
          zoom: { enabled: false },
          fontFamily: 'Inter, system-ui, sans-serif'
        },
        colors: ['#6366f1', '#10b981'],
        stroke: {
          curve: 'smooth',
          width: [3, 3]
        },
        fill: {
          type: 'gradient',
          gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.45,
            opacityTo: 0.04,
            stops: [0, 90, 100]
          }
        },
        markers: {
          size: 4,
          strokeColors: '#ffffff',
          strokeWidth: 2,
          hover: { size: 6 }
        },
        dataLabels: { enabled: false },
        xaxis: {
          categories: labels,
          axisBorder: { show: false },
          axisTicks: { show: false },
          labels: {
            style: { colors: '#64748b', fontSize: '12px', fontWeight: 600 }
          }
        },
        yaxis: {
          labels: {
            style: { colors: '#64748b', fontSize: '11px' },
            formatter: (val: number) => '₹' + Number(val || 0).toLocaleString('en-IN')
          }
        },
        grid: {
          borderColor: '#f1f5f9',
          strokeDashArray: 4,
          padding: { top: 0, right: 10, bottom: 0, left: 10 }
        },
        tooltip: {
          theme: 'dark',
          y: {
            formatter: (val: number) => '₹' + Number(val || 0).toLocaleString('en-IN')
          }
        },
        legend: { show: false }
      };
    } else {
      options = {
        series: [
          { name: 'Fees Billed', data: billedData },
          { name: 'Fees Collected', data: collectedData }
        ],
        chart: {
          type: 'bar',
          height: 250,
          toolbar: { show: false },
          fontFamily: 'Inter, system-ui, sans-serif'
        },
        colors: ['#6366f1', '#10b981'],
        plotOptions: {
          bar: {
            horizontal: false,
            columnWidth: '46%',
            borderRadius: 6,
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
            style: { colors: '#64748b', fontSize: '12px', fontWeight: 600 }
          }
        },
        yaxis: {
          labels: {
            style: { colors: '#64748b', fontSize: '11px' },
            formatter: (val: number) => '₹' + Number(val || 0).toLocaleString('en-IN')
          }
        },
        grid: {
          borderColor: '#f1f5f9',
          strokeDashArray: 4,
          padding: { top: 0, right: 10, bottom: 0, left: 10 }
        },
        fill: { opacity: 1 },
        tooltip: {
          theme: 'dark',
          y: {
            formatter: (val: number) => '₹' + Number(val || 0).toLocaleString('en-IN')
          }
        },
        legend: { show: false }
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
        height: 195,
        fontFamily: 'Inter, system-ui, sans-serif'
      },
      stroke: { width: 3, colors: ['#ffffff'] },
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
        theme: 'dark',
        y: {
          formatter: (val: number) => hasData ? '₹' + Number(val || 0).toLocaleString('en-IN') : 'N/A'
        }
      }
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
        fontFamily: 'Inter, system-ui, sans-serif'
      },
      colors: ['#2563eb', '#8b5cf6'],
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: batches.length <= 6 ? '32%' : (batches.length <= 10 ? '42%' : '60%'),
          borderRadius: 5,
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
          style: { colors: '#475569', fontSize: '11px', fontWeight: 600 }
        },
        axisBorder: { color: '#e2e8f0' },
        axisTicks: { show: false }
      },
      yaxis: [
        {
          title: {
            text: 'Students',
            style: { color: '#2563eb', fontWeight: 700, fontSize: '11px' }
          },
          labels: {
            style: { colors: '#64748b' },
            formatter: (val: number) => Number(val).toFixed(0)
          }
        },
        {
          opposite: true,
          title: {
            text: 'Fee Rate (₹)',
            style: { color: '#8b5cf6', fontWeight: 700, fontSize: '11px' }
          },
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
      tooltip: {
        theme: 'dark',
        shared: true,
        intersect: false,
        y: {
          formatter: (val: number, opts: any) =>
            opts?.seriesIndex === 0
              ? `${val} students`
              : '₹' + Number(val || 0).toLocaleString('en-IN') + '/mo'
        }
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

