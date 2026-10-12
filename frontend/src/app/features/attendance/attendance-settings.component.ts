import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AttendanceSettingsDto, API_BASE } from '../teachers/teacher.models';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-attendance-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title"><mat-icon>settings_suggest</mat-icon> Attendance Shift & Policy Settings</h1>
          <p class="page-subtitle">Configure school & faculty shift timings, late arrival grace cutoff, half-day thresholds, and attendance modes.</p>
        </div>
      </div>

      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

      <mat-card class="settings-card mat-elevation-z1" *ngIf="!loading">
        <mat-tab-group animationDuration="200ms" class="custom-tab-group">

          <!-- ================= TAB 1: FACULTY / TEACHER SETTINGS ================= -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">school</mat-icon>
              <span>Faculty / Teacher Shift Rules</span>
            </ng-template>

            <div class="tab-panel-body">
              <div class="preview-banner teacher-banner">
                <div class="banner-pill">
                  <mat-icon>info</mat-icon>
                  <strong>Live Faculty Policy Summary:</strong>
                </div>
                <div class="banner-text">
                  {{ getTeacherSummaryText() }}
                </div>
              </div>

              <!-- Quick Presets -->
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

                <!-- Shift Start Time -->
                <mat-form-field appearance="outline" class="col-half">
                  <mat-label>Shift Start Time</mat-label>
                  <input matInput type="time" [(ngModel)]="settings.teacherShiftStartTime" required>
                  <mat-icon matPrefix>login</mat-icon>
                  <mat-hint>e.g. 08:00 or 09:00 AM</mat-hint>
                </mat-form-field>

                <!-- Shift End Time -->
                <mat-form-field appearance="outline" class="col-half">
                  <mat-label>Shift End Time</mat-label>
                  <input matInput type="time" [(ngModel)]="settings.teacherShiftEndTime" required>
                  <mat-icon matPrefix>logout</mat-icon>
                  <mat-hint>e.g. 17:00 (05:00 PM)</mat-hint>
                </mat-form-field>

                <!-- Grace Period -->
                <mat-form-field appearance="outline" class="col-half">
                  <mat-label>Late Arrival Grace Period (Minutes)</mat-label>
                  <input matInput type="number" min="0" max="120" [(ngModel)]="settings.teacherGracePeriodMinutes" required>
                  <mat-icon matPrefix>timer</mat-icon>
                  <mat-hint>Punches past {{ getTeacherLateCutoffFormatted() }} count as Late</mat-hint>
                </mat-form-field>

                <!-- Half Day Min Work Duration -->
                <mat-form-field appearance="outline" class="col-half">
                  <mat-label>Half-Day Min Work Duration (Minutes)</mat-label>
                  <input matInput type="number" min="60" max="600" step="30" [(ngModel)]="settings.teacherHalfDayThresholdMinutes" required>
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

          <!-- ================= TAB 2: STUDENT SETTINGS ================= -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">groups</mat-icon>
              <span>Student Shift Rules</span>
            </ng-template>

            <div class="tab-panel-body">
              <div class="preview-banner student-banner">
                <div class="banner-pill">
                  <mat-icon>info</mat-icon>
                  <strong>Live Student Policy Summary:</strong>
                </div>
                <div class="banner-text">
                  {{ getStudentSummaryText() }}
                </div>
              </div>

              <!-- Quick Student Presets -->
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

                <!-- Shift Start Time -->
                <mat-form-field appearance="outline" class="col-half">
                  <mat-label>Class / Assembly Start Time</mat-label>
                  <input matInput type="time" [(ngModel)]="settings.studentShiftStartTime" required>
                  <mat-icon matPrefix>school</mat-icon>
                  <mat-hint>e.g. 08:00 or 08:30 AM</mat-hint>
                </mat-form-field>

                <!-- Shift End Time -->
                <mat-form-field appearance="outline" class="col-half">
                  <mat-label>Class / Dispersal End Time</mat-label>
                  <input matInput type="time" [(ngModel)]="settings.studentShiftEndTime" required>
                  <mat-icon matPrefix>meeting_room</mat-icon>
                  <mat-hint>e.g. 14:00 (02:00 PM)</mat-hint>
                </mat-form-field>

                <!-- Grace Period -->
                <mat-form-field appearance="outline" class="col-half">
                  <mat-label>Late Arrival Grace Period (Minutes)</mat-label>
                  <input matInput type="number" min="0" max="120" [(ngModel)]="settings.studentGracePeriodMinutes" required>
                  <mat-icon matPrefix>timer</mat-icon>
                  <mat-hint>Arrival past {{ getStudentLateCutoffFormatted() }} counts as Late</mat-hint>
                </mat-form-field>

                <!-- Half Day Min Duration -->
                <mat-form-field appearance="outline" class="col-half">
                  <mat-label>Half-Day Min Attendance (Minutes)</mat-label>
                  <input matInput type="number" min="60" max="600" step="30" [(ngModel)]="settings.studentHalfDayThresholdMinutes" required>
                  <mat-icon matPrefix>hourglass_bottom</mat-icon>
                  <mat-hint>{{ getHoursFromMinutes(settings.studentHalfDayThresholdMinutes) }} hrs minimum required for full attendance</mat-hint>
                </mat-form-field>

                <!-- Allowed Late Marks -->
                <mat-form-field appearance="outline" class="col-full">
                  <mat-label>Allowed Late Marks Per Month</mat-label>
                  <input matInput type="number" min="0" max="31" [(ngModel)]="settings.studentAllowedLateDaysPerMonth" required>
                  <mat-icon matPrefix>warning_amber</mat-icon>
                  <mat-hint>Late occurrences allowed per month before triggering parent alerts or disciplinary note.</mat-hint>
                </mat-form-field>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>

        <div class="card-footer-actions">
          <button mat-raised-button color="primary" class="save-btn" (click)="saveSettings()" [disabled]="saving">
            <mat-spinner diameter="18" *ngIf="saving"></mat-spinner>
            <mat-icon *ngIf="!saving">save</mat-icon>
            <span>{{ saving ? 'Saving Changes...' : 'Save All Settings' }}</span>
          </button>
        </div>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container {
      padding: 24px;
      max-width: 900px;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: 20px;
      .page-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 1.5rem;
        font-weight: 700;
        color: #1e3a8a;
        margin: 0;
        mat-icon { font-size: 28px; width: 28px; height: 28px; color: #2563eb; }
      }
      .page-subtitle {
        margin: 4px 0 0;
        color: #64748b;
        font-size: 0.9rem;
      }
    }

    .settings-card {
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }

    .custom-tab-group {
      ::ng-deep .mat-mdc-tab-header {
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }
      ::ng-deep .mat-mdc-tab .mdc-tab__text-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
      }
      .tab-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .tab-panel-body {
      padding: 24px;
    }

    .preview-banner {
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 20px;
      border: 1px solid #bfdbfe;

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
        font-size: 0.85rem;
        margin-bottom: 6px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }

      .banner-text {
        font-size: 0.85rem;
        line-height: 1.5;
        font-weight: 500;
      }
    }

    .preset-strip {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
      flex-wrap: wrap;

      .preset-label {
        font-size: 0.82rem;
        font-weight: 600;
        color: #64748b;
      }

      .preset-chip {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 20px;
        padding: 5px 12px;
        font-size: 0.78rem;
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
      gap: 16px 20px;

      .col-full { grid-column: span 2; }
      .col-half { grid-column: span 1; }

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
        .col-half, .col-full { grid-column: span 1; }
      }
    }

    .card-footer-actions {
      display: flex;
      justify-content: flex-end;
      padding: 16px 24px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;

      .save-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 160px;
        font-weight: 600;
        justify-content: center;
      }
    }
  `]
})
export class AttendanceSettingsComponent implements OnInit {
  private api = API_BASE;
  loading = true;
  saving = false;

  settings: AttendanceSettingsDto = {
    studentMode: 'Both',
    teacherMode: 'Both',
    hostelMode: 'Both',
    teacherShiftStartTime: '08:00',
    teacherShiftEndTime: '17:00',
    teacherGracePeriodMinutes: 15,
    teacherHalfDayThresholdMinutes: 240,
    teacherAllowedLateDaysPerMonth: 3,
    studentShiftStartTime: '08:00',
    studentShiftEndTime: '14:00',
    studentGracePeriodMinutes: 15,
    studentHalfDayThresholdMinutes: 240,
    studentAllowedLateDaysPerMonth: 3
  };

  constructor(
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
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
          studentShiftStartTime: res.studentShiftStartTime || '08:00',
          studentShiftEndTime: res.studentShiftEndTime || '14:00',
          studentGracePeriodMinutes: res.studentGracePeriodMinutes ?? 15,
          studentHalfDayThresholdMinutes: res.studentHalfDayThresholdMinutes ?? 240,
          studentAllowedLateDaysPerMonth: res.studentAllowedLateDaysPerMonth ?? 3
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
      `Work duration < ${halfH} hrs is Half-Day. ` +
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

  saveSettings(): void {
    this.saving = true;
    this.http.put<AttendanceSettingsDto>(`${this.api}/attendance/settings`, this.settings).subscribe({
      next: (res) => {
        this.saving = false;
        this.settings = res;
        this.confirmDialog.alert('Settings Saved', 'Attendance shift timings and policies updated successfully.', 'success');
      },
      error: (err) => {
        this.saving = false;
        this.confirmDialog.alert('Error', err?.error?.message || 'Failed to save shift and policy settings.', 'danger');
      }
    });
  }
}
