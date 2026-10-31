import { Component, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { AttendanceSettingsDto, API_BASE } from '../../features/teachers/teacher.models';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

export interface AttendanceShiftSettingsDialogData {
  initialTab?: 'teacher' | 'student' | 'coaching';
}

export interface BatchTimingRow {
  id: string;
  name: string;
  className?: string | null;
  shift: string;
  startTime: string;
  endTime: string;
  isDirty?: boolean;
}

@Component({
  selector: 'app-attendance-shift-settings-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSlideToggleModule
],
  template: `
    <div class="dialog-wrapper">
      <!-- Strict Light Blue Header matching generate-invoices-dialog & AGENTS.md rule -->
      <div class="dialog-header">
        <div class="header-icon-wrap">
          <mat-icon>schedule</mat-icon>
        </div>
        <div class="header-titles">
          <h2 mat-dialog-title class="main-title">Attendance Shift & Policy Settings</h2>
          <p class="subtitle">Configure shift start/end times, grace cutoff, half-day duration, and free late quotas.</p>
        </div>
        <button mat-icon-button type="button" class="close-btn" (click)="onClose()" [disabled]="saving">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    
      @if (loading) {
        <div class="loading-state">
          <mat-spinner diameter="36"></mat-spinner>
          <span>Loading attendance settings...</span>
        </div>
      }
    
      @if (!loading) {
        <mat-dialog-content class="dialog-content">
          <mat-tab-group [(selectedIndex)]="activeTabIndex" animationDuration="200ms" class="custom-tab-group">
            <!-- ================= TAB 1: FACULTY / TEACHER SETTINGS ================= -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-icon">school</mat-icon>
                <span>Faculty / Teacher Rules</span>
              </ng-template>
              <div class="tab-panel-body">
                <!-- Summary Banner Preview -->
                <div class="preview-banner teacher-banner">
                  <div class="banner-pill">
                    <mat-icon>info</mat-icon>
                    <strong>Live Faculty Policy Summary:</strong>
                  </div>
                  <div class="banner-text">
                    {{ getTeacherSummaryText() }}
                  </div>
                </div>
                <!-- Quick Shift Presets -->
                <div class="preset-strip">
                  <span class="preset-label">Quick Timings Presets:</span>
                  <button type="button" class="preset-chip" (click)="applyTeacherPreset('08:00', '17:00')">
                    08:00 AM – 05:00 PM (9 hrs)
                  </button>
                  <button type="button" class="preset-chip" (click)="applyTeacherPreset('09:00', '17:00')">
                    09:00 AM – 05:00 PM (8 hrs)
                  </button>
                  <button type="button" class="preset-chip" (click)="applyTeacherPreset('10:00', '17:00')">
                    10:00 AM – 05:00 PM (7 hrs)
                  </button>
                </div>
                <div class="form-grid">
                  <!-- Teacher Mode -->
                  <mat-form-field appearance="outline" class="col-full">
                    <mat-label>Teacher Attendance Mode</mat-label>
                    <mat-select [(ngModel)]="settings.teacherMode">
                      <mat-option value="Both">Manual Roster + Biometric Device</mat-option>
                      <mat-option value="Manual">Manual Register Only</mat-option>
                      <mat-option value="Biometric">Biometric Device Only</mat-option>
                    </mat-select>
                    <mat-hint>Choose whether faculty attendance is captured manually, via biometric device, or both.</mat-hint>
                  </mat-form-field>
                  <!-- Weekly Off Pattern -->
                  <mat-form-field appearance="outline" class="col-full">
                    <mat-label>Faculty Weekly Off Pattern</mat-label>
                    <mat-select [(ngModel)]="settings.teacherWeeklyOffPattern">
                      <mat-option value="SundayOnly">6-Day Week: Sunday Only Off (Mon – Sat Working)</mat-option>
                      <mat-option value="SaturdaySunday">5-Day Week: Saturday & Sunday Off (Mon – Fri Working)</mat-option>
                      <mat-option value="SecondFourthSaturday">CBSE/ICSE: 2nd & 4th Saturday + All Sundays Off</mat-option>
                    </mat-select>
                    <mat-icon matPrefix>event_available</mat-icon>
                    <mat-hint>Configures off days vs working days on faculty calendar roster & payroll.</mat-hint>
                  </mat-form-field>
                  <!-- Shift Start Time -->
                  <mat-form-field appearance="outline" class="col-half">
                    <mat-label>Shift Start Time</mat-label>
                    <input matInput type="time" [(ngModel)]="settings.teacherShiftStartTime" (ngModelChange)="onShiftTimesChanged()" required>
                    <mat-icon matPrefix>login</mat-icon>
                    <mat-hint>e.g. 08:00 or 09:00 AM</mat-hint>
                  </mat-form-field>
                  <!-- Shift End Time -->
                  <mat-form-field appearance="outline" class="col-half">
                    <mat-label>Shift End Time</mat-label>
                    <input matInput type="time" [(ngModel)]="settings.teacherShiftEndTime" (ngModelChange)="onShiftTimesChanged()" required>
                    <mat-icon matPrefix>logout</mat-icon>
                    <mat-hint>e.g. 17:00 (05:00 PM)</mat-hint>
                  </mat-form-field>
                  <!-- Grace Period (Minutes) -->
                  <mat-form-field appearance="outline" class="col-half">
                    <mat-label>Late Arrival Grace Period (Minutes)</mat-label>
                    <input matInput type="number" min="0" max="120" [(ngModel)]="settings.teacherGracePeriodMinutes" (ngModelChange)="onShiftTimesChanged()" required>
                    <mat-icon matPrefix>timer</mat-icon>
                    <mat-hint>Punches past {{ getTeacherLateCutoffFormatted() }} count as Late</mat-hint>
                  </mat-form-field>
                  <!-- Half Day Minimum Duration -->
                  <mat-form-field appearance="outline" class="col-half">
                    <mat-label>Half-Day Min Work Duration (Minutes)</mat-label>
                    <input matInput type="number" min="60" max="600" step="30" [(ngModel)]="settings.teacherHalfDayThresholdMinutes" (ngModelChange)="onShiftTimesChanged()" required>
                    <mat-icon matPrefix>hourglass_bottom</mat-icon>
                    <mat-hint>{{ getHoursFromMinutes(settings.teacherHalfDayThresholdMinutes) }} hrs minimum (Work below this = Half Day)</mat-hint>
                  </mat-form-field>
                  <!-- Allowed Free Late Days -->
                  <mat-form-field appearance="outline" class="col-full">
                    <mat-label>Free Grace Late Marks Per Month</mat-label>
                    <input matInput type="number" min="0" max="31" [(ngModel)]="settings.teacherAllowedLateDaysPerMonth" required>
                    <mat-icon matPrefix>event_busy</mat-icon>
                    <mat-hint>Number of late arrivals per calendar month before salary deduction begins.</mat-hint>
                  </mat-form-field>
                </div>
              </div>
            </mat-tab>
            <!-- ================= TAB 2: SCHOOL STUDENT SETTINGS ================= -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-icon">school</mat-icon>
                <span>School Student Shift</span>
              </ng-template>
              <div class="tab-panel-body">
                <!-- Summary Banner Preview -->
                <div class="preview-banner student-banner">
                  <div class="banner-pill">
                    <mat-icon>info</mat-icon>
                    <strong>Live Student Policy Summary:</strong>
                  </div>
                  <div class="banner-text">
                    {{ getStudentSummaryText() }}
                  </div>
                </div>
                <!-- Quick Student Shift Presets -->
                <div class="preset-strip">
                  <span class="preset-label">Quick Class Presets:</span>
                  <button type="button" class="preset-chip" (click)="applyStudentPreset('08:00', '14:00')">
                    08:00 AM – 02:00 PM (6 hrs)
                  </button>
                  <button type="button" class="preset-chip" (click)="applyStudentPreset('08:30', '14:30')">
                    08:30 AM – 02:30 PM (6 hrs)
                  </button>
                  <button type="button" class="preset-chip" (click)="applyStudentPreset('09:00', '15:00')">
                    09:00 AM – 03:00 PM (6 hrs)
                  </button>
                </div>
                <div class="form-grid">
                  <!-- Student Mode -->
                  <mat-form-field appearance="outline" class="col-full">
                    <mat-label>Student Attendance Mode</mat-label>
                    <mat-select [(ngModel)]="settings.studentMode">
                      <mat-option value="Both">Manual Roll Call + Turnstile/Biometric</mat-option>
                      <mat-option value="Manual">Manual Roll Call Only</mat-option>
                      <mat-option value="Biometric">Biometric Turnstile Only</mat-option>
                    </mat-select>
                    <mat-hint>Choose whether student roll call is manual, biometric turnstile, or hybrid.</mat-hint>
                  </mat-form-field>
                  <!-- Weekly Off Pattern -->
                  <mat-form-field appearance="outline" class="col-full">
                    <mat-label>Student Weekly Off Pattern</mat-label>
                    <mat-select [(ngModel)]="settings.studentWeeklyOffPattern">
                      <mat-option value="SundayOnly">6-Day Week: Sunday Only Off (Mon – Sat Classes)</mat-option>
                      <mat-option value="SaturdaySunday">5-Day Week: Saturday & Sunday Off (Mon – Fri Classes)</mat-option>
                      <mat-option value="SecondFourthSaturday">CBSE/ICSE: 2nd & 4th Saturday + All Sundays Off</mat-option>
                    </mat-select>
                    <mat-icon matPrefix>event_available</mat-icon>
                    <mat-hint>Configures academic class days vs weekly off days on student calendar.</mat-hint>
                  </mat-form-field>
                  <!-- Shift Start Time -->
                  <mat-form-field appearance="outline" class="col-half">
                    <mat-label>Class / Assembly Start Time</mat-label>
                    <input matInput type="time" [(ngModel)]="settings.studentShiftStartTime" (ngModelChange)="onShiftTimesChanged()" required>
                    <mat-icon matPrefix>school</mat-icon>
                    <mat-hint>e.g. 08:00 or 08:30 AM</mat-hint>
                  </mat-form-field>
                  <!-- Shift End Time -->
                  <mat-form-field appearance="outline" class="col-half">
                    <mat-label>Class / Dispersal End Time</mat-label>
                    <input matInput type="time" [(ngModel)]="settings.studentShiftEndTime" (ngModelChange)="onShiftTimesChanged()" required>
                    <mat-icon matPrefix>meeting_room</mat-icon>
                    <mat-hint>e.g. 14:00 (02:00 PM)</mat-hint>
                  </mat-form-field>
                  <!-- Grace Period (Minutes) -->
                  <mat-form-field appearance="outline" class="col-half">
                    <mat-label>Late Arrival Grace Period (Minutes)</mat-label>
                    <input matInput type="number" min="0" max="120" [(ngModel)]="settings.studentGracePeriodMinutes" (ngModelChange)="onShiftTimesChanged()" required>
                    <mat-icon matPrefix>timer</mat-icon>
                    <mat-hint>Arrival past {{ getStudentLateCutoffFormatted() }} counts as Late</mat-hint>
                  </mat-form-field>
                  <!-- Half Day Minimum Duration -->
                  <mat-form-field appearance="outline" class="col-half">
                    <mat-label>Half-Day Min Attendance (Minutes)</mat-label>
                    <input matInput type="number" min="60" max="600" step="30" [(ngModel)]="settings.studentHalfDayThresholdMinutes" (ngModelChange)="onShiftTimesChanged()" required>
                    <mat-icon matPrefix>hourglass_bottom</mat-icon>
                    <mat-hint>{{ getHoursFromMinutes(settings.studentHalfDayThresholdMinutes) }} hrs minimum required for full attendance</mat-hint>
                  </mat-form-field>
                  <!-- Allowed Free Late Days -->
                  <mat-form-field appearance="outline" class="col-full">
                    <mat-label>Allowed Late Marks Per Month</mat-label>
                    <input matInput type="number" min="0" max="31" [(ngModel)]="settings.studentAllowedLateDaysPerMonth" required>
                    <mat-icon matPrefix>warning_amber</mat-icon>
                    <mat-hint>Late occurrences allowed per month before triggering parent alerts or disciplinary note.</mat-hint>
                  </mat-form-field>
                  <!-- ================= STUDENT ABSENCE FINE POLICY (100% Dynamic UI) ================= -->
                  <div class="col-full fine-policy-card" [class.active-fine]="settings.enableStudentAbsenceFine">
                    <div class="fine-card-header">
                      <div class="fine-header-left">
                        <div class="fine-icon-badge">
                          <mat-icon>gavel</mat-icon>
                        </div>
                        <div>
                          <h4 class="fine-title">Monthly Student Absence Fine Policy</h4>
                          <p class="fine-subtitle">Auto-calculate &amp; bill absence penalty in Monthly Fee Invoices &amp; Receipts.</p>
                          <div class="applicable-tags">
                            <span class="app-tag school"><mat-icon>school</mat-icon> School Classes</span>
                            <span class="app-tag coaching"><mat-icon>menu_book</mat-icon> Coaching Batches</span>
                            <span class="app-tag hybrid"><mat-icon>auto_awesome</mat-icon> Hybrid Students</span>
                          </div>
                        </div>
                      </div>
                      <mat-slide-toggle [(ngModel)]="settings.enableStudentAbsenceFine" color="primary">
                        <span class="toggle-label font-semibold">{{ settings.enableStudentAbsenceFine ? 'Fine Active' : 'Fine Disabled' }}</span>
                      </mat-slide-toggle>
                    </div>
                    @if (settings.enableStudentAbsenceFine) {
                      <div class="fine-card-body">
                        <div class="form-grid">
                          <!-- Mode Selector: PerBlock (e.g. ₹10 per 3 days) vs Flat (e.g. flat ₹10 for 3+ days) -->
                          <mat-form-field appearance="outline" class="col-full">
                            <mat-label>Absence Fine Calculation Mode</mat-label>
                            <mat-select [(ngModel)]="settings.absenceFineMode">
                              <mat-option value="PerBlock">
                                <strong>Dynamic Slab:</strong> Har {{ settings.absenceFineDaysThreshold || 3 }} din par ₹{{ settings.absenceFineAmount || 10 }} multiply hoga (e.g. 3d = ₹10, 6d = ₹20, 9d = ₹30)
                              </mat-option>
                              <mat-option value="Flat">
                                <strong>Flat Fine:</strong> Flat ₹{{ settings.absenceFineAmount || 10 }} fine once {{ settings.absenceFineDaysThreshold || 3 }}+ din absent ho
                              </mat-option>
                            </mat-select>
                            <mat-icon matPrefix>calculate</mat-icon>
                            <mat-hint>Choose whether fine multiplies with every block of missed days or remains flat.</mat-hint>
                          </mat-form-field>
                          <!-- Absence Trigger Block Days -->
                          <mat-form-field appearance="outline" class="col-half">
                            <mat-label>Absent Days Trigger Block</mat-label>
                            <input matInput type="number" min="1" max="31" [(ngModel)]="settings.absenceFineDaysThreshold" required>
                            <mat-icon matPrefix>event_busy</mat-icon>
                            <mat-hint>Threshold days (e.g. 3 days absent)</mat-hint>
                          </mat-form-field>
                          <!-- Fine Amount (₹) -->
                          <mat-form-field appearance="outline" class="col-half">
                            <mat-label>Fine Amount (₹)</mat-label>
                            <input matInput type="number" min="1" max="5000" [(ngModel)]="settings.absenceFineAmount" required>
                            <mat-icon matPrefix>currency_rupee</mat-icon>
                            <mat-hint>Penalty amount in Rupees (e.g. ₹10)</mat-hint>
                          </mat-form-field>
                          <!-- Live Rule Summary Box -->
                          <div class="col-full fine-live-preview">
                            <mat-icon class="preview-icon">verified</mat-icon>
                            <div class="preview-content">
                              <strong style="color: #1e3a8a;">Live Rule Preview (School, Coaching &amp; Hybrid): </strong>
                              @if (settings.absenceFineMode === 'PerBlock') {
                                <span>
                                  Agar student (Class, Coaching ya Hybrid) month me <strong>{{ settings.absenceFineDaysThreshold || 3 }} din</strong> absent hoga toh <strong>₹{{ (settings.absenceFineAmount || 10) }}</strong>, agar <strong>{{ (settings.absenceFineDaysThreshold || 3) * 2 }} din</strong> absent hoga toh <strong>₹{{ (settings.absenceFineAmount || 10) * 2 }}</strong>, aur <strong>{{ (settings.absenceFineDaysThreshold || 3) * 3 }} din</strong> par <strong>₹{{ (settings.absenceFineAmount || 10) * 3 }}</strong> fine monthly fee receipt me auto-add hoga.
                                </span>
                              }
                              @if (settings.absenceFineMode === 'Flat') {
                                <span>
                                  Agar student (Class, Coaching ya Hybrid) month me <strong>{{ settings.absenceFineDaysThreshold || 3 }}+ din</strong> absent hoga, toh uske monthly bill me flat <strong>₹{{ settings.absenceFineAmount || 10 }}</strong> attendance fine auto-add hoga.
                                </span>
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </div>
            </mat-tab>
            <!-- ================= TAB 3: COACHING BATCHES SHIFT ================= -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-icon">menu_book</mat-icon>
                <span>Coaching Batches Shift</span>
              </ng-template>
              <div class="tab-panel-body">
                <!-- Summary Banner Preview -->
                <div class="preview-banner coaching-banner">
                  <div class="banner-pill">
                    <mat-icon>info</mat-icon>
                    <strong>Live Coaching Shifts Summary:</strong>
                  </div>
                  <div class="banner-text">
                    {{ getCoachingSummaryText() }}
                  </div>
                </div>
                <!-- General Coaching Mode & Off Pattern -->
                <div class="form-grid">
                  <mat-form-field appearance="outline" class="col-half">
                    <mat-label>Coaching Attendance Mode</mat-label>
                    <mat-select [(ngModel)]="settings.coachingMode">
                      <mat-option value="Both">Manual Roll Call + Turnstile/Biometric</mat-option>
                      <mat-option value="Manual">Manual Roll Call Only</mat-option>
                      <mat-option value="Biometric">Biometric Turnstile Only</mat-option>
                    </mat-select>
                    <mat-hint>Choose attendance capture method for coaching batches.</mat-hint>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="col-half">
                    <mat-label>Coaching Weekly Off Pattern</mat-label>
                    <mat-select [(ngModel)]="settings.coachingWeeklyOffPattern">
                      <mat-option value="SundayOnly">6-Day Week: Sunday Only Off (Mon – Sat Batches)</mat-option>
                      <mat-option value="SaturdaySunday">5-Day Week: Saturday & Sunday Off (Mon – Fri Batches)</mat-option>
                      <mat-option value="SecondFourthSaturday">CBSE/ICSE: 2nd & 4th Saturday + All Sundays Off</mat-option>
                    </mat-select>
                    <mat-icon matPrefix>event_available</mat-icon>
                    <mat-hint>Configures active batch days vs weekly off days.</mat-hint>
                  </mat-form-field>
                </div>
                <!-- DUAL SHIFT CARDS -->
                <div class="shifts-split-grid">
                  <!-- MORNING SHIFT CARD -->
                  <div class="shift-card morning-shift-card">
                    <div class="shift-card-header">
                      <div class="shift-icon-wrap morning">
                        <mat-icon>wb_sunny</mat-icon>
                      </div>
                      <div class="shift-title-group">
                        <h4>🌅 Morning Shift Timings</h4>
                        <p>Early batch classes & morning doubt sessions</p>
                      </div>
                    </div>
                    <!-- Quick Presets -->
                    <div class="preset-strip">
                      <span class="preset-label">Presets:</span>
                      <button type="button" class="preset-chip" (click)="applyCoachingMorningPreset('06:30', '09:30')">
                        06:30 – 09:30 AM
                      </button>
                      <button type="button" class="preset-chip" (click)="applyCoachingMorningPreset('07:00', '10:00')">
                        07:00 – 10:00 AM
                      </button>
                      <button type="button" class="preset-chip" (click)="applyCoachingMorningPreset('08:00', '11:00')">
                        08:00 – 11:00 AM
                      </button>
                    </div>
                    <div class="shift-inputs-grid">
                      <mat-form-field appearance="outline" subscriptSizing="dynamic">
                        <mat-label>Morning Start Time</mat-label>
                        <input matInput type="time" [(ngModel)]="settings.coachingMorningStartTime" (ngModelChange)="onShiftTimesChanged()" required>
                        <mat-icon matPrefix>login</mat-icon>
                      </mat-form-field>
                      <mat-form-field appearance="outline" subscriptSizing="dynamic">
                        <mat-label>Morning End Time</mat-label>
                        <input matInput type="time" [(ngModel)]="settings.coachingMorningEndTime" (ngModelChange)="onShiftTimesChanged()" required>
                        <mat-icon matPrefix>logout</mat-icon>
                      </mat-form-field>
                      <mat-form-field appearance="outline" class="col-span-2">
                        <mat-label>Morning Late Grace Cutoff (Minutes)</mat-label>
                        <input matInput type="number" min="0" max="60" [(ngModel)]="settings.coachingMorningGraceMinutes" (ngModelChange)="onShiftTimesChanged()" required>
                        <mat-icon matPrefix>timer</mat-icon>
                        <mat-hint>Arrival after {{ getCoachingMorningLateCutoffFormatted() }} counts as Late</mat-hint>
                      </mat-form-field>
                    </div>
                  </div>
                  <!-- EVENING SHIFT CARD -->
                  <div class="shift-card evening-shift-card">
                    <div class="shift-card-header">
                      <div class="shift-icon-wrap evening">
                        <mat-icon>nights_stay</mat-icon>
                      </div>
                      <div class="shift-title-group">
                        <h4>🌆 Evening Shift Timings</h4>
                        <p>Post-school batches & regular evening lectures</p>
                      </div>
                    </div>
                    <!-- Quick Presets -->
                    <div class="preset-strip">
                      <span class="preset-label">Presets:</span>
                      <button type="button" class="preset-chip" (click)="applyCoachingEveningPreset('15:30', '18:30')">
                        03:30 – 06:30 PM
                      </button>
                      <button type="button" class="preset-chip" (click)="applyCoachingEveningPreset('16:00', '19:00')">
                        04:00 – 07:00 PM
                      </button>
                      <button type="button" class="preset-chip" (click)="applyCoachingEveningPreset('17:00', '20:00')">
                        05:00 – 08:00 PM
                      </button>
                    </div>
                    <div class="shift-inputs-grid">
                      <mat-form-field appearance="outline" subscriptSizing="dynamic">
                        <mat-label>Evening Start Time</mat-label>
                        <input matInput type="time" [(ngModel)]="settings.coachingEveningStartTime" (ngModelChange)="onShiftTimesChanged()" required>
                        <mat-icon matPrefix>login</mat-icon>
                      </mat-form-field>
                      <mat-form-field appearance="outline" subscriptSizing="dynamic">
                        <mat-label>Evening End Time</mat-label>
                        <input matInput type="time" [(ngModel)]="settings.coachingEveningEndTime" (ngModelChange)="onShiftTimesChanged()" required>
                        <mat-icon matPrefix>logout</mat-icon>
                      </mat-form-field>
                      <mat-form-field appearance="outline" class="col-span-2">
                        <mat-label>Evening Late Grace Cutoff (Minutes)</mat-label>
                        <input matInput type="number" min="0" max="60" [(ngModel)]="settings.coachingEveningGraceMinutes" (ngModelChange)="onShiftTimesChanged()" required>
                        <mat-icon matPrefix>timer</mat-icon>
                        <mat-hint>Arrival after {{ getCoachingEveningLateCutoffFormatted() }} counts as Late</mat-hint>
                      </mat-form-field>
                    </div>
                  </div>
                </div>
                <!-- INDIVIDUAL BATCH SCHEDULES SECTION -->
                <div class="batches-schedule-section">
                  <div class="section-sub-header">
                    <div class="sub-header-title">
                      <mat-icon class="sec-icon">schedule</mat-icon>
                      <div>
                        <h4>📚 Individual Batch Schedules (विशिष्ट बैच टाइमिंग)</h4>
                        <p>Set independent start and end times for each batch. Roll call and registers will auto-sync with these timings.</p>
                      </div>
                    </div>
                  </div>
                  <div class="table-full-search-bar">
                    <mat-icon class="search-icon">search</mat-icon>
                    <input type="text" class="quick-batch-search-full" placeholder="Search batch or class (बैच या क्लास सर्च करें)..." [(ngModel)]="batchSearchTerm">
                    @if (batchSearchTerm) {
                      <button type="button" class="clear-search-btn" (click)="batchSearchTerm = ''" title="Clear Search">
                        <mat-icon>close</mat-icon>
                      </button>
                    }
                  </div>
                  @if (batchTimings.length > 0) {
                    <div class="batch-timings-table-wrap table-responsive">
                      <table class="batch-timings-table">
                        <thead>
                          <tr>
                            <th>Batch Name & Class</th>
                            <th style="width: 140px;">Shift</th>
                            <th style="width: 130px;">Start Time (In)</th>
                            <th style="width: 130px;">End Time (Out)</th>
                            <th style="width: 100px;">Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (b of getFilteredBatchTimings(); track b) {
                            <tr>
                              <td>
                                <div class="batch-cell-name">
                                  <strong>{{ b.name }}</strong>
                                  @if (b.className && !isCombinedBatch(b)) {
                                    <span class="batch-class-tag">{{ b.className }}</span>
                                  }
                                </div>
                              </td>
                              <td>
                                <select class="custom-shift-select" [(ngModel)]="b.shift" (change)="onBatchShiftSelected(b)">
                                  <option value="Morning">☀️ Morning</option>
                                  <option value="Afternoon">🕒 Afternoon</option>
                                  <option value="Evening">🌇 Evening</option>
                                </select>
                              </td>
                              <td>
                                <input type="time" class="custom-time-input" [(ngModel)]="b.startTime" (change)="markBatchDirty(b)" />
                              </td>
                              <td>
                                <input type="time" class="custom-time-input" [(ngModel)]="b.endTime" (change)="markBatchDirty(b)" />
                              </td>
                              <td>
                                <span class="batch-dur-pill">{{ calculateBatchDuration(b.startTime, b.endTime) }}</span>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  }
                  @if (batchTimings.length === 0 && !loadingBatches) {
                    <div class="empty-batch-notice">
                      <mat-icon>info</mat-icon>
                      <span>No active coaching batches found.</span>
                    </div>
                  }
                  @if (loadingBatches) {
                    <div class="empty-batch-notice">
                      <mat-spinner diameter="20"></mat-spinner>
                      <span>Loading batch schedules...</span>
                    </div>
                  }
                </div>
              </div>
            </mat-tab>
          </mat-tab-group>
        </mat-dialog-content>
      }
    
      <div class="dialog-actions">
        <button mat-button type="button" (click)="onClose()" [disabled]="saving">
          Cancel
        </button>
        <button mat-raised-button color="primary" class="save-btn" (click)="saveSettings()" [disabled]="saving || loading">
          @if (saving) {
            <mat-spinner diameter="18"></mat-spinner>
          }
          @if (!saving) {
            <mat-icon>save</mat-icon>
          }
          <span>{{ saving ? 'Saving Policies...' : 'Save Policies & Settings' }}</span>
        </button>
      </div>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .dialog-wrapper {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      font-family: inherit;
    }

    /* Strict Light Blue Header matching generate-invoices-dialog & AGENTS.md rule */
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 20px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;

      .header-icon-wrap {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }

      .header-titles {
        flex: 1 1 auto;
        .main-title {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.3;
        }
        .subtitle {
          margin: 3px 0 0;
          font-size: 0.79rem;
          color: #3b82f6;
        }
      }

      .close-btn { color: #64748b; &:hover { color: #1e293b; } }
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      gap: 12px;
      color: #64748b;
      font-size: 0.9rem;
    }

    .dialog-content {
      padding: 0;
      max-height: 70vh;
      overflow-y: auto;
    }

    .custom-tab-group {
      ::ng-deep .mat-mdc-tab-header {
        border-bottom: 1px solid #e2e8f0;
        background: #f8fafc;
      }
      ::ng-deep .mat-mdc-tab .mdc-tab__text-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        font-size: 0.88rem;
      }
      .tab-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .tab-panel-body {
      padding: 18px 22px;
    }

    .preview-banner {
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 16px;
      border: 1px solid #bfdbfe;
      background: #eff6ff;

      &.teacher-banner {
        border-color: #bfdbfe;
        background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
        .banner-pill { color: #1e40af; }
        .banner-text { color: #1e3a8a; }
      }

      &.student-banner {
        border-color: #ddd6fe;
        background: linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%);
        .banner-pill { color: #6d28d9; }
        .banner-text { color: #4338ca; }
      }

      .banner-pill {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.82rem;
        margin-bottom: 4px;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }

      .banner-text {
        font-size: 0.8rem;
        line-height: 1.45;
        font-weight: 500;
      }
    }

    .preset-strip {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      flex-wrap: wrap;

      .preset-label {
        font-size: 0.78rem;
        font-weight: 600;
        color: #64748b;
      }

      .preset-chip {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 20px;
        padding: 4px 10px;
        font-size: 0.74rem;
        font-weight: 600;
        color: #334155;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          background: #e2e8f0;
          border-color: #94a3b8;
          color: #0f172a;
        }
      }
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 16px;

      .col-full {
        grid-column: span 2;
      }

      .col-half {
        grid-column: span 1;
      }

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
        .col-half, .col-full { grid-column: span 1; }
      }
    }

    .fine-policy-card {
      margin-top: 8px;
      padding: 16px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      transition: all 0.2s ease;

      &.active-fine {
        background: #f8fafc;
        border-color: #3b82f6;
        box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.08);
      }

      .fine-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .fine-header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .fine-icon-badge {
        width: 38px;
        height: 38px;
        border-radius: 8px;
        background: #fee2e2;
        color: #dc2626;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }

      .fine-title {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 700;
        color: #0f172a;
      }

      .fine-subtitle {
        margin: 2px 0 0 0;
        font-size: 0.8rem;
        color: #64748b;
      }

      .applicable-tags {
        display: flex;
        gap: 8px;
        margin-top: 6px;
        flex-wrap: wrap;

        .app-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.72rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 12px;
          mat-icon { font-size: 13px; width: 13px; height: 13px; }

          &.school { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
          &.coaching { background: #fdf4ff; color: #86198f; border: 1px solid #f5d0fe; }
          &.hybrid { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
        }
      }

      .fine-live-preview {
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 8px;
        padding: 10px 14px;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        font-size: 0.85rem;
        color: #1e3a8a;
        line-height: 1.45;

        .preview-icon {
          color: #2563eb;
          font-size: 20px;
          width: 20px;
          height: 20px;
          flex-shrink: 0;
          margin-top: 1px;
        }
      }
    }

    .coaching-banner {
      background: #faf5ff !important;
      border-color: #e9d5ff !important;
      color: #6b21a8 !important;

      .banner-pill {
        color: #7e22ce !important;
        mat-icon { color: #9333ea !important; }
      }
      .banner-text {
        color: #581c87 !important;
      }
    }

    .shifts-split-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 12px;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
    }

    .shift-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

      &.morning-shift-card {
        border-top: 4px solid #ea580c;
      }

      &.evening-shift-card {
        border-top: 4px solid #4f46e5;
      }

      .shift-card-header {
        display: flex;
        align-items: center;
        gap: 12px;

        .shift-icon-wrap {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;

          &.morning {
            background: #ffedd5;
            color: #c2410c;
          }

          &.evening {
            background: #e0e7ff;
            color: #4338ca;
          }
        }

        .shift-title-group {
          h4 {
            margin: 0;
            font-size: 0.95rem;
            font-weight: 700;
            color: #0f172a;
          }
          p {
            margin: 2px 0 0;
            font-size: 0.78rem;
            color: #64748b;
          }
        }
      }

      .shift-inputs-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px 12px;

        .col-span-2 {
          grid-column: span 2;
        }

        @media (max-width: 480px) {
          grid-template-columns: 1fr;
          .col-span-2 {
            grid-column: span 1;
          }
        }
      }
    }

    .batches-schedule-section {
      margin-top: 14px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;

      .section-sub-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;

        .sub-header-title {
          display: flex;
          align-items: center;
          gap: 10px;

          .sec-icon {
            color: #2563eb;
            font-size: 24px;
            width: 24px;
            height: 24px;
          }

          h4 {
            margin: 0;
            font-size: 0.95rem;
            font-weight: 700;
            color: #1e3a8a;
          }

          p {
            margin: 2px 0 0;
            font-size: 0.76rem;
            color: #64748b;
          }
        }
      }

      .table-full-search-bar {
        position: relative;
        display: flex;
        align-items: center;
        width: 100%;
        margin-top: 2px;

        .search-icon {
          position: absolute;
          left: 12px;
          color: #64748b;
          font-size: 20px;
          width: 20px;
          height: 20px;
          pointer-events: none;
        }

        .quick-batch-search-full {
          width: 100%;
          box-sizing: border-box;
          padding: 9px 38px 9px 40px;
          font-size: 0.85rem;
          font-weight: 500;
          border: 1.5px solid #cbd5e1;
          border-radius: 8px;
          outline: none;
          background: #ffffff;
          color: #0f172a;
          transition: all 0.2s ease;

          &:focus {
            border-color: #2563eb;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
          }

          &::placeholder {
            color: #94a3b8;
          }
        }

        .clear-search-btn {
          position: absolute;
          right: 10px;
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2px;

          &:hover {
            color: #475569;
          }

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
          }
        }
      }

      .batch-timings-table-wrap {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        max-height: 280px;

        .batch-timings-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.82rem;

          th {
            background: #f1f5f9;
            color: #475569;
            font-weight: 700;
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid #cbd5e1;
            white-space: nowrap;
            position: sticky;
            top: 0;
            z-index: 1;
          }

          td {
            padding: 8px 12px;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: middle;
            white-space: nowrap;
          }

          tr:last-child td {
            border-bottom: none;
          }

          tr:hover td {
            background: #f8fafc;
          }

          .batch-cell-name {
            display: flex;
            flex-direction: column;
            gap: 2px;

            strong {
              color: #1e293b;
            }

            .batch-class-tag {
              font-size: 0.7rem;
              color: #64748b;
            }
          }

          .custom-shift-select {
            padding: 4px 8px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            font-size: 0.8rem;
            background: #ffffff;
            color: #1e293b;
            outline: none;

            &:focus {
              border-color: #2563eb;
            }
          }

          .custom-time-input {
            padding: 4px 6px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 600;
            background: #ffffff;
            color: #1e293b;
            outline: none;
            width: 105px;

            &:focus {
              border-color: #2563eb;
            }
          }

          .batch-dur-pill {
            display: inline-block;
            padding: 3px 8px;
            background: #eff6ff;
            color: #1e40af;
            border-radius: 10px;
            font-size: 0.72rem;
            font-weight: 700;
          }
        }
      }

      .empty-batch-notice {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 16px;
        color: #64748b;
        font-size: 0.82rem;
      }
    }

    .dialog-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 20px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;

      .save-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        min-width: 140px;
        justify-content: center;
      }
    }
  `]
})
export class AttendanceShiftSettingsDialogComponent implements OnInit {
  private api = API_BASE;
  loading = true;
  saving = false;
  activeTabIndex = 0;

  settings: AttendanceSettingsDto = {
    studentMode: 'Both',
    teacherMode: 'Both',
    hostelMode: 'Both',
    teacherShiftStartTime: '08:00',
    teacherShiftEndTime: '17:00',
    teacherGracePeriodMinutes: 15,
    teacherHalfDayThresholdMinutes: 240,
    teacherAllowedLateDaysPerMonth: 3,
    teacherWeeklyOffPattern: 'SundayOnly',
    studentShiftStartTime: '08:00',
    studentShiftEndTime: '14:00',
    studentGracePeriodMinutes: 15,
    studentHalfDayThresholdMinutes: 240,
    studentAllowedLateDaysPerMonth: 3,
    studentWeeklyOffPattern: 'SundayOnly',
    enableStudentAbsenceFine: true,
    absenceFineDaysThreshold: 3,
    absenceFineAmount: 10,
    absenceFineMode: 'PerBlock',
    coachingMode: 'Both',
    coachingWeeklyOffPattern: 'SundayOnly',
    coachingMorningStartTime: '07:00',
    coachingMorningEndTime: '10:00',
    coachingMorningGraceMinutes: 15,
    coachingEveningStartTime: '16:00',
    coachingEveningEndTime: '19:00',
    coachingEveningGraceMinutes: 15
  };

  constructor(
    private http: HttpClient,
    public dialogRef: MatDialogRef<AttendanceShiftSettingsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AttendanceShiftSettingsDialogData,
    private confirmDialog: ConfirmDialogService
  ) {
    if (data?.initialTab === 'student') {
      this.activeTabIndex = 1;
    } else if (data?.initialTab === 'coaching') {
      this.activeTabIndex = 2;
    }
  }

  ngOnInit(): void {
    this.loadSettings();
    this.loadBatches();
  }

  batchTimings: BatchTimingRow[] = [];
  batchSearchTerm = '';
  loadingBatches = false;

  loadBatches(): void {
    this.loadingBatches = true;
    this.http.get<any[]>(`${this.api}/batches`).subscribe({
      next: (batches) => {
        this.loadingBatches = false;
        this.batchTimings = (batches || []).map(b => ({
          id: b.id,
          name: b.name,
          className: b.className,
          shift: b.shift || 'Morning',
          startTime: b.startTime || (b.shift === 'Evening' ? '16:00' : '07:00'),
          endTime: b.endTime || (b.shift === 'Evening' ? '19:00' : '10:00'),
          isDirty: false
        }));
      },
      error: () => {
        this.loadingBatches = false;
      }
    });
  }

  getFilteredBatchTimings(): BatchTimingRow[] {
    const term = (this.batchSearchTerm || '').trim().toLowerCase();
    if (!term) return this.batchTimings;
    return this.batchTimings.filter(b =>
      b.name.toLowerCase().includes(term) ||
      (b.className && b.className.toLowerCase().includes(term))
    );
  }

  onBatchShiftSelected(b: BatchTimingRow): void {
    b.isDirty = true;
    if (b.shift === 'Morning') {
      b.startTime = this.settings.coachingMorningStartTime || '07:00';
      b.endTime = this.settings.coachingMorningEndTime || '10:00';
    } else if (b.shift === 'Afternoon') {
      b.startTime = '12:00';
      b.endTime = '15:00';
    } else if (b.shift === 'Evening') {
      b.startTime = this.settings.coachingEveningStartTime || '16:00';
      b.endTime = this.settings.coachingEveningEndTime || '19:00';
    }
  }

  markBatchDirty(b: BatchTimingRow): void {
    b.isDirty = true;
  }

  calculateBatchDuration(start?: string, end?: string): string {
    if (!start || !end) return '-';
    const sMin = this.parseTimeToMinutes(start);
    let eMin = this.parseTimeToMinutes(end);
    if (sMin === null || eMin === null) return '-';
    if (eMin <= sMin) eMin += 720;
    const diff = eMin - sMin;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  isCombinedBatch(b: any): boolean {
    if (!b?.name) return false;
    const n = b.name.toLowerCase();
    return !!b.name.match(/class\s*\d+.*(?:to|-).*\d+/i) || n.includes(' to ') || n.includes('to class') || n.includes('combined') || n.includes('all class');
  }

  loadSettings(): void {
    this.loading = true;
    this.http.get<AttendanceSettingsDto>(`${this.api}/attendance/settings`).subscribe({
      next: (res) => {
        this.settings = {
          studentMode: res.studentMode || 'Both',
          teacherMode: res.teacherMode || 'Both',
          hostelMode: res.hostelMode || 'Both',
          teacherShiftStartTime: res.teacherShiftStartTime || '08:00',
          teacherShiftEndTime: res.teacherShiftEndTime || '17:00',
          teacherGracePeriodMinutes: res.teacherGracePeriodMinutes ?? 15,
          teacherHalfDayThresholdMinutes: res.teacherHalfDayThresholdMinutes ?? 240,
          teacherAllowedLateDaysPerMonth: res.teacherAllowedLateDaysPerMonth ?? 3,
          teacherWeeklyOffPattern: res.teacherWeeklyOffPattern || 'SundayOnly',
          studentShiftStartTime: res.studentShiftStartTime || '08:00',
          studentShiftEndTime: res.studentShiftEndTime || '14:00',
          studentGracePeriodMinutes: res.studentGracePeriodMinutes ?? 15,
          studentHalfDayThresholdMinutes: res.studentHalfDayThresholdMinutes ?? 240,
          studentAllowedLateDaysPerMonth: res.studentAllowedLateDaysPerMonth ?? 3,
          studentWeeklyOffPattern: res.studentWeeklyOffPattern || 'SundayOnly',
          enableStudentAbsenceFine: res.enableStudentAbsenceFine ?? true,
          absenceFineDaysThreshold: res.absenceFineDaysThreshold ?? 3,
          absenceFineAmount: res.absenceFineAmount ?? 10,
          absenceFineMode: res.absenceFineMode || 'PerBlock',
          coachingMode: res.coachingMode || 'Both',
          coachingWeeklyOffPattern: res.coachingWeeklyOffPattern || 'SundayOnly',
          coachingMorningStartTime: res.coachingMorningStartTime || '07:00',
          coachingMorningEndTime: res.coachingMorningEndTime || '10:00',
          coachingMorningGraceMinutes: res.coachingMorningGraceMinutes ?? 15,
          coachingEveningStartTime: res.coachingEveningStartTime || '16:00',
          coachingEveningEndTime: res.coachingEveningEndTime || '19:00',
          coachingEveningGraceMinutes: res.coachingEveningGraceMinutes ?? 15
        };
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  applyTeacherPreset(start: string, end: string): void {
    this.settings.teacherShiftStartTime = start;
    this.settings.teacherShiftEndTime = end;
  }

  applyStudentPreset(start: string, end: string): void {
    this.settings.studentShiftStartTime = start;
    this.settings.studentShiftEndTime = end;
  }

  applyCoachingMorningPreset(start: string, end: string): void {
    this.settings.coachingMorningStartTime = start;
    this.settings.coachingMorningEndTime = end;
  }

  applyCoachingEveningPreset(start: string, end: string): void {
    this.settings.coachingEveningStartTime = start;
    this.settings.coachingEveningEndTime = end;
  }

  onShiftTimesChanged(): void {
    // triggers change detection for hints
  }

  parseTimeToMinutes(timeStr?: string): number | null {
    if (!timeStr) return null;
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
    if (!match) return null;
    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const meridiem = match[3] ? match[3].toUpperCase() : null;
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    return hour * 60 + minute;
  }

  minutesToTimeStr(mins: number): string {
    const wrapped = (mins % 1440 + 1440) % 1440;
    const h = Math.floor(wrapped / 60);
    const m = wrapped % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  getTeacherLateCutoffFormatted(): string {
    const startMins = this.parseTimeToMinutes(this.settings.teacherShiftStartTime || '08:00') ?? 480;
    const cutoff = startMins + (this.settings.teacherGracePeriodMinutes || 0);
    return this.minutesToTimeStr(cutoff);
  }

  getStudentLateCutoffFormatted(): string {
    const startMins = this.parseTimeToMinutes(this.settings.studentShiftStartTime || '08:00') ?? 480;
    const cutoff = startMins + (this.settings.studentGracePeriodMinutes || 0);
    return this.minutesToTimeStr(cutoff);
  }

  getCoachingMorningLateCutoffFormatted(): string {
    const startMins = this.parseTimeToMinutes(this.settings.coachingMorningStartTime || '07:00') ?? 420;
    const cutoff = startMins + (this.settings.coachingMorningGraceMinutes || 0);
    return this.minutesToTimeStr(cutoff);
  }

  getCoachingEveningLateCutoffFormatted(): string {
    const startMins = this.parseTimeToMinutes(this.settings.coachingEveningStartTime || '16:00') ?? 960;
    const cutoff = startMins + (this.settings.coachingEveningGraceMinutes || 0);
    return this.minutesToTimeStr(cutoff);
  }

  getHoursFromMinutes(mins?: number): string {
    if (!mins) return '0';
    return (mins / 60).toFixed(1).replace('.0', '');
  }

  getTeacherSummaryText(): string {
    const start = this.settings.teacherShiftStartTime || '08:00';
    const end = this.settings.teacherShiftEndTime || '17:00';
    const sMin = this.parseTimeToMinutes(start) ?? 480;
    let eMin = this.parseTimeToMinutes(end) ?? 1020;
    if (eMin <= sMin) eMin += 720;
    const durHours = ((eMin - sMin) / 60).toFixed(1).replace('.0', '');
    const cutoff = this.getTeacherLateCutoffFormatted();
    const halfH = this.getHoursFromMinutes(this.settings.teacherHalfDayThresholdMinutes);
    const freeLates = this.settings.teacherAllowedLateDaysPerMonth ?? 3;

    return `Shift: ${this.minutesToTimeStr(sMin)} – ${this.minutesToTimeStr(eMin)} (${durHours} hrs). ` +
      `Arrival up to ${cutoff} is Present. Arrival after ${cutoff} is Late Mark. ` +
      `Work duration < ${halfH} hrs (${this.settings.teacherHalfDayThresholdMinutes}m) is Half-Day. ` +
      `${freeLates} free late mark(s) per month.`;
  }

  getStudentSummaryText(): string {
    const start = this.settings.studentShiftStartTime || '08:00';
    const end = this.settings.studentShiftEndTime || '14:00';
    const sMin = this.parseTimeToMinutes(start) ?? 480;
    let eMin = this.parseTimeToMinutes(end) ?? 840;
    if (eMin <= sMin) eMin += 720;
    const durHours = ((eMin - sMin) / 60).toFixed(1).replace('.0', '');
    const cutoff = this.getStudentLateCutoffFormatted();
    const halfH = this.getHoursFromMinutes(this.settings.studentHalfDayThresholdMinutes);
    const freeLates = this.settings.studentAllowedLateDaysPerMonth ?? 3;

    return `Classes: ${this.minutesToTimeStr(sMin)} – ${this.minutesToTimeStr(eMin)} (${durHours} hrs). ` +
      `Arrival up to ${cutoff} is Present. Arrival after ${cutoff} is Late Mark. ` +
      `Attendance duration < ${halfH} hrs is Half-Day. ` +
      `${freeLates} allowed late mark(s) per month.`;
  }

  getCoachingSummaryText(): string {
    const mStart = this.settings.coachingMorningStartTime || '07:00';
    const mEnd = this.settings.coachingMorningEndTime || '10:00';
    const mSMin = this.parseTimeToMinutes(mStart) ?? 420;
    let mEMin = this.parseTimeToMinutes(mEnd) ?? 600;
    if (mEMin <= mSMin) mEMin += 720;
    const mDurHours = ((mEMin - mSMin) / 60).toFixed(1).replace('.0', '');
    const mCutoff = this.getCoachingMorningLateCutoffFormatted();

    const eStart = this.settings.coachingEveningStartTime || '16:00';
    const eEnd = this.settings.coachingEveningEndTime || '19:00';
    const eSMin = this.parseTimeToMinutes(eStart) ?? 960;
    let eEMin = this.parseTimeToMinutes(eEnd) ?? 1140;
    if (eEMin <= eSMin) eEMin += 720;
    const eDurHours = ((eEMin - eSMin) / 60).toFixed(1).replace('.0', '');
    const eCutoff = this.getCoachingEveningLateCutoffFormatted();

    return `🌅 Morning: ${this.minutesToTimeStr(mSMin)} – ${this.minutesToTimeStr(mEMin)} (${mDurHours} hrs, Late after ${mCutoff}) | ` +
           `🌆 Evening: ${this.minutesToTimeStr(eSMin)} – ${this.minutesToTimeStr(eEMin)} (${eDurHours} hrs, Late after ${eCutoff}). ` +
           `Policy: Full Present (≥70% session), Half-Day (35%–69%), Absent (<35%).`;
  }

  saveSettings(): void {
    this.saving = true;
    const dirtyBatches = this.batchTimings.filter(b => b.isDirty).map(b => ({
      batchId: b.id,
      shift: b.shift,
      startTime: b.startTime,
      endTime: b.endTime
    }));

    const updateSettings$ = this.http.put<AttendanceSettingsDto>(`${this.api}/attendance/settings`, this.settings);
    const updateBatches$ = dirtyBatches.length > 0 
      ? this.http.put(`${this.api}/batches/timings/bulk`, dirtyBatches)
      : of(null);

    forkJoin({ settingsRes: updateSettings$, batchesRes: updateBatches$ }).subscribe({
      next: ({ settingsRes }) => {
        this.saving = false;
        this.dialogRef.close({ saved: true, settings: settingsRes, updatedBatchesCount: dirtyBatches.length });
      },
      error: (err) => {
        this.saving = false;
        this.confirmDialog.alert('Error', err?.error?.message || 'Failed to save shift and policy settings.', 'danger');
      }
    });
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
