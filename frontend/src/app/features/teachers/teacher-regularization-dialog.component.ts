import { Component, Inject, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, provideNativeDateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import {
  API_BASE,
  TeacherDto,
  TeacherAttendanceRegularizationDto,
  LeavePolicySettingsDto
} from './teacher.models';

// ═══════════════════════════════════════════════════════════════════
// APPLY ATTENDANCE REGULARIZATION DIALOG
// ═══════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-apply-teacher-regularization-dialog',
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
    MatProgressBarModule,
    MatTooltipModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'en-IN' }
  ],
  template: `
    <div class="reg-dialog-container">
      <!-- Strict Light Blue Header matching IMSERP AGENTS.md UI Rule -->
      <div class="reg-dialog-header">
        <div class="reg-dialog-icon">
          <mat-icon>build_circle</mat-icon>
        </div>
        <div class="reg-dialog-title-group">
          <h2 class="reg-dialog-title">Request Attendance Regularization</h2>
          <span class="reg-dialog-sub">
            Rectify missed punches, device offline events, or official duty records
          </span>
        </div>
        <button class="reg-dialog-close" (click)="cancel()" mat-icon-button>
          <mat-icon>close</mat-icon>
        </button>
      </div>
    
      @if (loadingPolicy || saving) {
        <mat-progress-bar mode="indeterminate" class="reg-loader"></mat-progress-bar>
      }
    
      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="reg-dialog-body">
    
          <!-- Policy Guidance Banner -->
          @if (policy) {
            <div class="policy-notice">
              <mat-icon>info</mat-icon>
              <div>
                <strong>Regularization Guidelines:</strong> Requests must be submitted within
                <strong>{{policy.maxRegularizationDaysBackdated}} days</strong> of the occurrence.
                Maximum <strong>{{policy.maxRegularizationPerMonth}} requests</strong> allowed per calendar month.
              </div>
            </div>
          }
    
          <!-- Error Alert Banner -->
          @if (errorMessage) {
            <div class="error-banner">
              <mat-icon>error</mat-icon>
              <span>{{errorMessage}}</span>
            </div>
          }
    
          <!-- Faculty Member Selector (Only shown for Admin/HR applying on behalf of a teacher) -->
          @if (!isTeacherSelf) {
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Faculty Member *</mat-label>
              <mat-select formControlName="teacherId">
                @for (t of teachers; track t) {
                  <mat-option [value]="t.id">
                    {{t.fullName}} ({{t.employeeCode}}){{t.department ? ' — ' + t.department : ''}}
                  </mat-option>
                }
              </mat-select>
              <mat-hint>Select active faculty member for regularization</mat-hint>
            </mat-form-field>
          }
    
          <!-- Self Faculty Profile Display (Shown for Teacher self-apply) -->
          @if (isTeacherSelf) {
            <div class="self-strip">
              <div class="self-avatar"><mat-icon>account_circle</mat-icon></div>
              <div class="self-meta">
                <strong>{{myProfile?.fullName || 'Your Faculty Account'}}</strong>
                <span>Emp Code: <strong>{{myProfile?.employeeCode || 'Registered Faculty'}}</strong></span>
              </div>
              <div class="self-badge-pill">
                <mat-icon>verified_user</mat-icon>
                <span>Faculty Portal</span>
              </div>
            </div>
          }
    
          <!-- Date Selection Mode Switcher -->
          <div class="date-mode-switcher">
            <button
              type="button"
              class="mode-switch-btn"
              [class.active]="dateMode === 'single'"
              (click)="setDateMode('single')">
              <mat-icon>today</mat-icon>
              <span>Single Date</span>
            </button>
            <button
              type="button"
              class="mode-switch-btn"
              [class.active]="dateMode === 'range'"
              (click)="setDateMode('range')">
              <mat-icon>date_range</mat-icon>
              <span>Date Range (Multi-Day)</span>
            </button>
          </div>

          <!-- Date & Requested Status Row (Single Date Mode) -->
          @if (dateMode === 'single') {
            <div class="form-row">
              <mat-form-field appearance="outline" class="form-col">
                <mat-label>Occurrence Date *</mat-label>
                <input matInput [matDatepicker]="singlePicker" formControlName="attendanceDate" [max]="today" placeholder="Choose date">
                <mat-datepicker-toggle matIconSuffix [for]="singlePicker"></mat-datepicker-toggle>
                <mat-datepicker #singlePicker></mat-datepicker>
                @if (!isSundaySelected) {
                  <mat-hint>Date when punch was missed or incorrect ({{selectedDayName}})</mat-hint>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="form-col">
                <mat-label>Requested Status *</mat-label>
                <mat-select formControlName="requestedStatus">
                  <mat-option value="Present">Present (Full Day)</mat-option>
                  <mat-option value="HalfDay">Half Day</mat-option>
                </mat-select>
                <mat-hint>Target attendance mark after review</mat-hint>
              </mat-form-field>
            </div>

            <!-- Sunday / Weekly Off Blocking Alert Banner -->
            @if (isSundaySelected) {
              <div class="sunday-alert-banner">
                <div class="sab-icon"><mat-icon>event_busy</mat-icon></div>
                <div class="sab-content">
                  <strong>Weekly Off / Sunday Detected ({{selectedDateFormatted}}):</strong>
                  <span>Attendance regularization cannot be requested on a Sunday or official weekly off. Please select a valid working day when duty or classes took place.</span>
                </div>
              </div>
            }

            <!-- Already Approved Alert Banner -->
            @if (isAlreadyApproved) {
              <div class="already-status-banner approved">
                <mat-icon>check_circle</mat-icon>
                <div>
                  <strong>Already Regularized &amp; Approved ({{selectedDateFormatted}}):</strong>
                  <span>Attendance for this date has already been regularized and approved. Duplicate request cannot be submitted.</span>
                </div>
              </div>
            }

            <!-- Already Pending Alert Banner -->
            @if (isAlreadyPending) {
              <div class="already-status-banner pending">
                <mat-icon>hourglass_top</mat-icon>
                <div>
                  <strong>Request Under Review ({{selectedDateFormatted}}):</strong>
                  <span>A regularization request for this date is already submitted and pending Admin approval.</span>
                </div>
              </div>
            }
          }

          <!-- Date & Requested Status Row (Date Range Mode) -->
          @if (dateMode === 'range') {
            <div class="form-row">
              <mat-form-field appearance="outline" class="form-col" style="flex: 1.5;">
                <mat-label>Occurrence Date Range *</mat-label>
                <mat-date-range-input [rangePicker]="rangePicker" [max]="today">
                  <input matStartDate formControlName="rangeStart" placeholder="Start date">
                  <input matEndDate formControlName="rangeEnd" placeholder="End date">
                </mat-date-range-input>
                <mat-datepicker-toggle matIconSuffix [for]="rangePicker"></mat-datepicker-toggle>
                <mat-date-range-picker #rangePicker></mat-date-range-picker>
                <mat-hint>Select start and end date for missed days</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline" class="form-col" style="flex: 1;">
                <mat-label>Requested Status *</mat-label>
                <mat-select formControlName="requestedStatus">
                  <mat-option value="Present">Present (Full Day)</mat-option>
                  <mat-option value="HalfDay">Half Day</mat-option>
                </mat-select>
                <mat-hint>Status for selected dates</mat-hint>
              </mat-form-field>
            </div>

            <!-- Dynamic Multi-Date Selection Summary Deck -->
            @if (selectedDatesList.length > 0) {
              <div class="range-summary-card">
                <div class="rsc-header">
                  <mat-icon>event_available</mat-icon>
                  <strong>{{selectedDatesList.length}} Working {{selectedDatesList.length === 1 ? 'Day' : 'Days'}} Selected:</strong>
                  @if (skippedSundayCount > 0) {
                    <span class="skipped-pill">({{skippedSundayCount}} Sunday{{skippedSundayCount > 1 ? 's' : ''}} excluded)</span>
                  }
                  @if (skippedApprovedDates.length > 0) {
                    <span class="skipped-chip approved-chip" [matTooltip]="'Skipped: ' + skippedApprovedDates.join(', ')">
                      <mat-icon>check_circle</mat-icon> {{skippedApprovedDates.length}} Already Approved
                    </span>
                  }
                  @if (skippedPendingDates.length > 0) {
                    <span class="skipped-chip pending-chip" [matTooltip]="'Skipped: ' + skippedPendingDates.join(', ')">
                      <mat-icon>hourglass_top</mat-icon> {{skippedPendingDates.length}} Pending Review
                    </span>
                  }
                </div>
                <div class="dates-chip-row">
                  @for (d of selectedDatesList; track d) {
                    <span class="date-chip">{{d | date:'dd MMM (EEE)'}}</span>
                  }
                </div>
              </div>
            } @else if (form.get('rangeStart')?.value && form.get('rangeEnd')?.value && (skippedApprovedDates.length > 0 || skippedPendingDates.length > 0)) {
              <div class="range-all-skipped">
                <mat-icon>info</mat-icon>
                <span>All working dates in this selected range are already Approved or Pending Review. No new requests needed.</span>
              </div>
            }
          }
    
          <!-- In-Time & Out-Time Row -->
          <div class="form-row">
            <mat-form-field appearance="outline" class="form-col">
              <mat-label>Punch-In Time (HH:MM)</mat-label>
              <input matInput type="text" formControlName="requestedCheckIn" placeholder="e.g. 08:30" />
            </mat-form-field>
    
            <mat-form-field appearance="outline" class="form-col">
              <mat-label>Punch-Out Time (HH:MM)</mat-label>
              <input matInput type="text" formControlName="requestedCheckOut" placeholder="e.g. 15:30" />
            </mat-form-field>
          </div>
    
          <!-- Reason & Notes -->
          <div class="quick-reasons-label">Quick Reason Shortcuts:</div>
          <div class="chips-row">
            <button type="button" class="quick-chip" (click)="setReason('Forgot to punch in / out')" matButton="filled">
              ⏱️ Forgot to Punch
            </button>
            <button type="button" class="quick-chip" (click)="setReason('Biometric device offline / Fingerprint read failure')" matButton="filled">
              ⚠️ Biometric Machine Failure
            </button>
            <button type="button" class="quick-chip" (click)="setReason('Official School Tour / Field Duty(OD)')" matButton="filled">
              🚌 Official Duty / Tour
            </button>
            <button type="button" class="quick-chip" (click)="setReason('Board / University ExaminationDuty')" matButton="filled">
              📝 Exam Duty
            </button>
            <button type="button" class="quick-chip" (click)="setReason('Marked absent erroneously in manual roll-call')" matButton="filled">
              📋 Manual Roll-Call Error
            </button>
          </div>
    
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Reason / Explanation *</mat-label>
            <textarea matInput formControlName="reason" rows="3" placeholder="Explain why attendance regularization is requested..."></textarea>
          </mat-form-field>
    
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Supporting Document URL (Optional)</mat-label>
            <input matInput formControlName="attachmentUrl" placeholder="https://..." />
            <mat-hint>Link to OD duty slip, medical certificate, or exam allotment letter</mat-hint>
          </mat-form-field>
        </div>
    
        <!-- Strict Light Blue Header / Footer styling -->
        <div class="reg-dialog-footer">
          <button type="button" (click)="cancel()" matButton="filled" class="app-button-cancel">Cancel</button>
          <button class="btn-submit" type="submit"
            [disabled]="isSubmitDisabled"
            [matTooltip]="isSundaySelected && dateMode === 'single' ? 'Cannot submit regularization on a Sunday / Weekly Off' : ''" matButton="filled">
            <mat-icon>{{saving ? 'hourglass_empty' : 'send'}}</mat-icon>
            {{saving ? 'Submitting...' : (dateMode === 'range' && selectedDatesList.length > 1 ? 'Submit ' + selectedDatesList.length + ' Regularization Requests' : 'Submit Regularization Request')}}
          </button>
        </div>
      </form>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .reg-dialog-container {
      width: 100%;
      max-width: 600px;
      font-family: inherit;
      color: #0f172a;
    }
    .reg-dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
      position: relative;
    }
    .reg-dialog-icon {
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .reg-dialog-title-group {
      flex: 1;
    }
    .reg-dialog-title {
      margin: 0;
      color: #1e3a8a;
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.2px;
    }
    .reg-dialog-sub {
      color: #3b82f6;
      font-size: 0.82rem;
      font-weight: 500;
      display: block;
      margin-top: 2px;
    }
    .reg-dialog-close {
      color: #64748b;
      margin-right: -6px;
    }
    .reg-dialog-close:hover {
      color: #1e293b;
    }
    .reg-loader {
      height: 3px;
    }
    .reg-dialog-body {
      padding: 18px 22px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 72vh;
      overflow-y: auto;
    }
    .w-full {
      width: 100%;
    }
    .form-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .form-col {
      flex: 1 1 240px;
    }
    .policy-notice {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 10px 14px;
      color: #166534;
      font-size: 0.82rem;
      line-height: 1.4;
    }
    .policy-notice mat-icon {
      color: #16a34a;
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .error-banner {
      display: flex;
      gap: 8px;
      align-items: center;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 10px 14px;
      color: #991b1b;
      font-size: 0.84rem;
    }
    .error-banner mat-icon {
      color: #dc2626;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .self-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 1px solid #bbf7d0;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 4px;
    }
    .self-avatar mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #16a34a;
    }
    .self-meta {
      display: flex;
      flex-direction: column;
      font-size: 0.85rem;
      flex: 1;
    }
    .self-meta strong {
      color: #166534;
      font-size: 0.96rem;
    }
    .self-meta span {
      color: #15803d;
      font-size: 0.8rem;
    }
    .self-badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.72rem;
      font-weight: 700;
      color: #15803d;
      background: #ffffff;
      padding: 4px 10px;
      border-radius: 9999px;
      border: 1px solid #86efac;
    }
    .self-badge-pill mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: #16a34a;
    }
    .quick-reasons-label {
      font-size: 0.76rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-top: 2px;
    }
    .chips-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 4px;
    }
    .quick-chip {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 16px;
      padding: 4px 10px;
      font-size: 0.76rem;
      color: #334155;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    .quick-chip:hover {
      background: #eff6ff;
      border-color: #93c5fd;
      color: #1e40af;
    }
    .reg-dialog-footer {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      padding: 14px 20px;
      border-top: 1px solid #e2e8f0;
      background: #fafafa;
    }
    .sunday-alert-banner {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 10px;
      padding: 12px 14px;
      margin-top: -4px;
      margin-bottom: 6px;
    }
    .sab-icon mat-icon {
      color: #dc2626;
      font-size: 22px;
      width: 22px;
      height: 22px;
    }
    .sab-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 0.82rem;
      color: #991b1b;
    }
    .sab-content strong {
      font-size: 0.88rem;
      color: #7f1d1d;
    }

    .btn-submit {
      background: #2563eb;
      color: #ffffff;
    }
    .btn-submit:hover:not(:disabled) {
      background: #1d4ed8;
    }
    .btn-submit:disabled {
      background: #cbd5e1 !important;
      color: #94a3b8 !important;
      cursor: not-allowed !important;
    }
    .date-mode-switcher {
      display: inline-flex;
      background: #f1f5f9;
      padding: 4px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      gap: 4px;
      margin-bottom: 12px;
      width: 100%;
      box-sizing: border-box;
    }
    .mode-switch-btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 7px;
      border: 1px solid transparent;
      background: transparent;
      color: #64748b;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .mode-switch-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .mode-switch-btn.active {
      background: #ffffff;
      color: #1e3a8a;
      border-color: #bfdbfe;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.12);
      font-weight: 700;
    }
    .mode-switch-btn.active mat-icon {
      color: #2563eb;
    }

    .range-summary-card {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      padding: 10px 14px;
      margin-top: -4px;
      margin-bottom: 12px;
    }
    .rsc-header {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #1e40af;
      font-size: 0.84rem;
      margin-bottom: 8px;
    }
    .rsc-header mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #2563eb;
    }
    .skipped-pill {
      font-size: 0.74rem;
      color: #d97706;
      background: #fef3c7;
      padding: 1px 7px;
      border-radius: 10px;
      font-weight: 600;
    }
    .dates-chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .date-chip {
      background: #ffffff;
      color: #1d4ed8;
      border: 1px solid #93c5fd;
      padding: 3px 9px;
      border-radius: 6px;
      font-size: 0.76rem;
      font-weight: 600;
      box-shadow: 0 1px 2px rgba(37, 99, 235, 0.08);
    }
    .already-status-banner {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 8px;
      margin-top: -6px;
      margin-bottom: 12px;
      font-size: 0.82rem;
      line-height: 1.4;
    }
    .already-status-banner.approved {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
    }
    .already-status-banner.approved mat-icon {
      color: #059669;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .already-status-banner.pending {
      background: #fffbeb;
      border: 1px solid #fde68a;
      color: #92400e;
    }
    .already-status-banner.pending mat-icon {
      color: #d97706;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .skipped-chip {
      font-size: 0.74rem;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .skipped-chip mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .skipped-chip.approved-chip {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #86efac;
    }
    .skipped-chip.pending-chip {
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fcd34d;
    }
    .range-all-skipped {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fff7ed;
      border: 1px solid #fed7aa;
      color: #c2410c;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 500;
      margin-bottom: 12px;
    }
    .range-all-skipped mat-icon {
      color: #ea580c;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    @media (max-width: 600px) {
      .form-row {
        flex-direction: column;
      }
      .reg-dialog-header {
        padding: 12px 16px;
      }
      .reg-dialog-body {
        padding: 14px 16px;
      }
    }
  `]
})
export class ApplyTeacherRegularizationDialogComponent implements OnInit {
  private authService = inject(AuthService);
  form!: FormGroup;
  saving = false;
  loadingPolicy = false;
  errorMessage = '';
  todayStr = new Date().toISOString().split('T')[0];
  readonly today = new Date();
  isSundaySelected = false;
  selectedDayName = '';
  selectedDateFormatted = '';
  policy: LeavePolicySettingsDto | null = null;
  teachers: TeacherDto[] = [];
  isTeacherSelf = false;
  myProfile: any = null;

  existingRegularizations: TeacherAttendanceRegularizationDto[] = [];
  isAlreadyApproved = false;
  isAlreadyPending = false;
  skippedApprovedDates: string[] = [];
  skippedPendingDates: string[] = [];

  dateMode: 'single' | 'range' = 'single';
  selectedDatesList: Date[] = [];
  skippedSundayCount = 0;

  getSmartDefaultDate(): string {
    const d = new Date();
    // If today is Sunday (day 0), default to Saturday (previous day)
    if (d.getDay() === 0) {
      d.setDate(d.getDate() - 1);
    }
    return d.toISOString().split('T')[0];
  }

  checkOccurrenceDate(val: any): void {
    if (!val) {
      this.isSundaySelected = false;
      this.isAlreadyApproved = false;
      this.isAlreadyPending = false;
      this.selectedDayName = '';
      this.selectedDateFormatted = '';
      return;
    }
    const d = val instanceof Date ? val : new Date(val + (typeof val === 'string' && !val.includes('T') ? 'T00:00:00' : ''));
    if (isNaN(d.getTime())) {
      this.isSundaySelected = false;
      this.isAlreadyApproved = false;
      this.isAlreadyPending = false;
      return;
    }
    const dateStr = this.formatDate(d);
    const day = d.getDay(); // 0 is Sunday
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    this.selectedDayName = dayNames[day];
    this.selectedDateFormatted = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    this.isSundaySelected = (day === 0);

    const existing = this.existingRegularizations.find(r => r.attendanceDate.startsWith(dateStr));
    if (existing) {
      this.isAlreadyApproved = (existing.status === 'Approved');
      this.isAlreadyPending = (existing.status === 'Pending');
    } else {
      this.isAlreadyApproved = false;
      this.isAlreadyPending = false;
    }
  }

  setDateMode(mode: 'single' | 'range'): void {
    this.dateMode = mode;
    this.errorMessage = '';
    if (mode === 'single') {
      this.form.get('attendanceDate')?.setValidators(Validators.required);
      this.form.get('rangeStart')?.clearValidators();
      this.form.get('rangeEnd')?.clearValidators();
      if (!this.form.get('attendanceDate')?.value) {
        this.form.patchValue({ attendanceDate: this.getSmartDefaultDate() });
      }
    } else {
      this.form.get('attendanceDate')?.clearValidators();
      this.form.get('rangeStart')?.setValidators(Validators.required);
      this.form.get('rangeEnd')?.setValidators(Validators.required);
    }
    this.form.get('attendanceDate')?.updateValueAndValidity();
    this.form.get('rangeStart')?.updateValueAndValidity();
    this.form.get('rangeEnd')?.updateValueAndValidity();
    this.recomputeRangeDates();
  }

  recomputeRangeDates(): void {
    if (this.dateMode !== 'range') {
      this.selectedDatesList = [];
      this.skippedSundayCount = 0;
      this.skippedApprovedDates = [];
      this.skippedPendingDates = [];
      return;
    }
    const startVal = this.form.get('rangeStart')?.value;
    const endVal = this.form.get('rangeEnd')?.value;
    if (!startVal || !endVal) {
      this.selectedDatesList = [];
      this.skippedSundayCount = 0;
      this.skippedApprovedDates = [];
      this.skippedPendingDates = [];
      return;
    }
    const start = new Date(startVal);
    const end = new Date(endVal);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      this.selectedDatesList = [];
      this.skippedSundayCount = 0;
      this.skippedApprovedDates = [];
      this.skippedPendingDates = [];
      return;
    }
    const list: Date[] = [];
    let sundayCount = 0;
    const approvedList: string[] = [];
    const pendingList: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      const dStr = this.formatDate(cur);
      if (cur.getDay() === 0) {
        sundayCount++;
      } else {
        const existing = this.existingRegularizations.find(r => r.attendanceDate.startsWith(dStr));
        if (existing?.status === 'Approved') {
          approvedList.push(dStr);
        } else if (existing?.status === 'Pending') {
          pendingList.push(dStr);
        } else {
          list.push(new Date(cur));
        }
      }
      cur.setDate(cur.getDate() + 1);
    }
    this.selectedDatesList = list;
    this.skippedSundayCount = sundayCount;
    this.skippedApprovedDates = approvedList;
    this.skippedPendingDates = pendingList;
  }

  get isSubmitDisabled(): boolean {
    if (this.saving || this.form.invalid) return true;
    if (this.dateMode === 'single') {
      return this.isSundaySelected || this.isAlreadyApproved || this.isAlreadyPending || !this.form.get('attendanceDate')?.value;
    }
    return this.selectedDatesList.length === 0;
  }

  formatDate(d: Date | string): string {
    if (typeof d === 'string') return d.split('T')[0];
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private dialogRef: MatDialogRef<ApplyTeacherRegularizationDialogComponent>,
    private confirmDialog: ConfirmDialogService,
    @Inject(MAT_DIALOG_DATA) public data: {
      preSelectTeacherId?: string;
      targetTeacherId?: string;
      preSelectDate?: string;
      targetDate?: string;
      isTeacherSelf?: boolean;
      isTeacher?: boolean;
      myProfile?: any;
      teachers?: TeacherDto[];
      existingRegularizations?: TeacherAttendanceRegularizationDto[];
    }
  ) {
    this.isTeacherSelf = !this.authService.canManageStaff() || !!(data?.isTeacherSelf || data?.isTeacher);
    this.myProfile = data?.myProfile || null;
    this.teachers = (data?.teachers || []).filter(t => t.isActive !== false && !t.leavingDate);
    if (data?.existingRegularizations) {
      this.existingRegularizations = data.existingRegularizations;
    }
  }

  loadExistingRegularizations(teacherId: string): void {
    if (!teacherId) return;
    this.http.get<TeacherAttendanceRegularizationDto[]>(`${API_BASE}/teachers/regularizations`, {
      params: { teacherId }
    }).subscribe({
      next: list => {
        this.existingRegularizations = list || [];
        this.checkOccurrenceDate(this.form.get('attendanceDate')?.value);
        if (this.dateMode === 'range') {
          this.recomputeRangeDates();
        }
      },
      error: () => {
        this.existingRegularizations = [];
      }
    });
  }

  ngOnInit(): void {
    const defaultDate = this.data?.preSelectDate || this.data?.targetDate || this.getSmartDefaultDate();
    const defaultTeacherId = this.isTeacherSelf
      ? (this.myProfile?.id || '')
      : (this.data?.preSelectTeacherId || this.data?.targetTeacherId || (this.teachers.length > 0 ? this.teachers[0].id : ''));

    this.form = this.fb.group({
      teacherId: [defaultTeacherId, Validators.required],
      attendanceDate: [defaultDate, Validators.required],
      rangeStart: [null],
      rangeEnd: [null],
      requestedStatus: ['Present', Validators.required],
      requestedCheckIn: ['08:30'],
      requestedCheckOut: ['15:30'],
      reason: ['', [Validators.required, Validators.minLength(5)]],
      attachmentUrl: ['']
    });

    this.checkOccurrenceDate(defaultDate);
    this.form.get('attendanceDate')?.valueChanges.subscribe(val => {
      this.checkOccurrenceDate(val);
    });
    this.form.get('rangeStart')?.valueChanges.subscribe(() => this.recomputeRangeDates());
    this.form.get('rangeEnd')?.valueChanges.subscribe(() => this.recomputeRangeDates());
    this.form.get('teacherId')?.valueChanges.subscribe(tId => {
      if (tId) this.loadExistingRegularizations(tId);
    });

    if (defaultTeacherId) {
      this.loadExistingRegularizations(defaultTeacherId);
    }

    if (this.isTeacherSelf) {
      if (!this.myProfile?.id) {
        this.http.get<any>(`${API_BASE}/teachers/my-profile`).subscribe({
          next: p => {
            if (p?.isLinked) {
              this.myProfile = p;
              this.form.patchValue({ teacherId: p.id });
              this.loadExistingRegularizations(p.id);
            }
          },
          error: () => {}
        });
      } else {
        this.form.patchValue({ teacherId: this.myProfile.id });
        this.loadExistingRegularizations(this.myProfile.id);
      }
    } else {
      // Admin Mode: Load active teachers (excluding F&F settled / inactive)
      if (this.teachers.length === 0) {
        this.http.get<TeacherDto[]>(`${API_BASE}/teachers?activeOnly=true`).subscribe({
          next: list => {
            this.teachers = list.filter(t => t.isActive !== false && !t.leavingDate);
            if (!this.form.get('teacherId')?.value && this.teachers.length > 0) {
              this.form.patchValue({ teacherId: this.teachers[0].id });
              this.loadExistingRegularizations(this.teachers[0].id);
            }
          },
          error: () => {}
        });
      }
    }

    this.loadPolicy();
  }

  loadPolicy(): void {
    this.loadingPolicy = true;
    this.http.get<LeavePolicySettingsDto>(`${API_BASE}/teachers/leave-policy-settings`).subscribe({
      next: res => {
        this.policy = res;
        this.loadingPolicy = false;
      },
      error: () => {
        this.loadingPolicy = false;
      }
    });
  }

  setReason(r: string): void {
    this.form.patchValue({ reason: r });
  }

  submit(): void {
    if (this.isSubmitDisabled) return;
    this.saving = true;
    this.errorMessage = '';

    const baseVal = this.form.value;
    const datesToSubmit: string[] = [];

    if (this.dateMode === 'single') {
      datesToSubmit.push(this.formatDate(baseVal.attendanceDate));
    } else {
      for (const d of this.selectedDatesList) {
        datesToSubmit.push(this.formatDate(d));
      }
    }

    if (datesToSubmit.length === 0) {
      this.saving = false;
      this.errorMessage = 'Please select at least one valid working date.';
      return;
    }

    const requests = datesToSubmit.map(dStr => {
      const payload = {
        teacherId: baseVal.teacherId,
        attendanceDate: dStr,
        requestedStatus: baseVal.requestedStatus,
        requestedCheckIn: baseVal.requestedCheckIn,
        requestedCheckOut: baseVal.requestedCheckOut,
        reason: baseVal.reason,
        attachmentUrl: baseVal.attachmentUrl
      };
      return this.http.post(`${API_BASE}/teachers/regularizations`, payload);
    });

    forkJoin(requests).subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close({
          count: datesToSubmit.length,
          teacherId: baseVal.teacherId,
          teacherName: this.teachers.find(t => t.id === baseVal.teacherId)?.fullName || this.myProfile?.fullName || 'Faculty Member'
        });
      },
      error: err => {
        this.saving = false;
        const msg = err.error?.message || 'Failed to submit regularization request(s). Please verify monthly limits.';
        this.errorMessage = msg;
        this.confirmDialog.alert('Regularization Submission Notice', msg, 'warning');
      }
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}

// ═══════════════════════════════════════════════════════════════════
// REVIEW ATTENDANCE REGULARIZATION DIALOG (APPROVE / REJECT)
// ═══════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-review-teacher-regularization-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule
],
  template: `
    <div class="review-dialog-container">
      <!-- Strict Light Blue Header matching IMSERP UI Rule -->
      <div class="reg-dialog-header">
        <div class="reg-dialog-icon" [style.background]="isApprove ? '#16a34a' : '#dc2626'">
          <mat-icon>{{isApprove ? 'check_circle' : 'cancel'}}</mat-icon>
        </div>
        <div class="reg-dialog-title-group">
          <h2 class="reg-dialog-title">
            {{isApprove ? 'Approve Attendance Regularization' : 'Reject Regularization Request'}}
          </h2>
          <span class="reg-dialog-sub">
            {{data.regularization.teacherName}} ({{data.regularization.employeeCode}}) •
            <strong>{{data.regularization.attendanceDate | date:'dd MMM yyyy'}}</strong>
          </span>
        </div>
        <button class="reg-dialog-close" (click)="cancel()" mat-icon-button>
          <mat-icon>close</mat-icon>
        </button>
      </div>
    
      @if (saving) {
        <mat-progress-bar mode="indeterminate" class="reg-loader"></mat-progress-bar>
      }
    
      <div class="review-dialog-body">
        <div class="info-card">
          <div class="info-row">
            <span class="lbl">Occurrence Date:</span>
            <span class="val font-semibold">{{data.regularization.attendanceDate | date:'dd-MMM-yyyy'}}</span>
          </div>
          <div class="info-row">
            <span class="lbl">Requested Mark:</span>
            <span class="val font-semibold">{{data.regularization.requestedStatus}}</span>
          </div>
          @if (data.regularization.requestedCheckIn || data.regularization.requestedCheckOut) {
            <div class="info-row">
              <span class="lbl">Timestamps:</span>
              <span class="val">{{data.regularization.requestedCheckIn || '—'}} to {{data.regularization.requestedCheckOut || '—'}}</span>
            </div>
          }
          <div class="info-row">
            <span class="lbl">Reason Given:</span>
            <span class="val">{{data.regularization.reason}}</span>
          </div>
          @if (data.regularization.attachmentUrl) {
            <div class="info-row">
              <span class="lbl">Attachment:</span>
              <span class="val">
                <a [href]="data.regularization.attachmentUrl" target="_blank" rel="noopener noreferrer" class="link-btn">
                  View Attached Document ↗
                </a>
              </span>
            </div>
          }
        </div>
    
        <mat-form-field appearance="outline" class="w-full" style="margin-top: 10px;">
          <mat-label>{{isApprove ? 'Approval Remarks (Optional)' : 'Rejection Reason *'}}</mat-label>
          <textarea matInput [(ngModel)]="remarks" rows="3"
          [placeholder]="isApprove ? 'Optional sanction notes for records...' : 'State reason for rejecting regularization...'"></textarea>
        </mat-form-field>
    
        @if (errorMessage) {
          <div class="error-banner">
            <mat-icon>error</mat-icon>
            <span>{{errorMessage}}</span>
          </div>
        }
      </div>
    
      <div class="reg-dialog-footer">
        <button (click)="cancel()" matButton="filled" class="app-button-cancel">Cancel</button>
        <button [color]="isApprove ? 'primary' : 'warn'"
          (click)="confirm()" [disabled]="saving || (!isApprove && !remarks.trim())" matButton="filled" [class.app-button-update]="isApprove">
          <mat-icon>{{isApprove ? 'done_all' : 'block'}}</mat-icon>
          {{saving ? 'Processing...' : (isApprove ? 'Approve & Update Attendance' : 'Reject Request')}}
        </button>
      </div>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .review-dialog-container {
      width: 100%;
      max-width: 540px;
      font-family: inherit;
      color: #0f172a;
    }
    .reg-dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .reg-dialog-icon {
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .reg-dialog-title-group { flex: 1; }
    .reg-dialog-title {
      margin: 0;
      color: #1e3a8a;
      font-size: 1.12rem;
      font-weight: 700;
    }
    .reg-dialog-sub {
      color: #3b82f6;
      font-size: 0.82rem;
      font-weight: 500;
      display: block;
      margin-top: 2px;
    }
    .reg-dialog-close { color: #64748b; }
    .reg-dialog-close:hover { color: #1e293b; }
    .review-dialog-body {
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.84rem;
      gap: 8px;
    }
    .lbl { color: #64748b; font-weight: 500; }
    .val { color: #1e293b; }
    .link-btn { color: #2563eb; font-weight: 600; text-decoration: none; }
    .link-btn:hover { text-decoration: underline; }
    .w-full { width: 100%; }
    .reg-dialog-footer {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      padding: 14px 20px;
      border-top: 1px solid #e2e8f0;
      background: #fafafa;
    }
    .error-banner {
      display: flex;
      gap: 8px;
      align-items: center;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 10px 14px;
      color: #991b1b;
      font-size: 0.84rem;
      margin-top: 6px;
    }
  `]
})
export class ReviewTeacherRegularizationDialogComponent {
  saving = false;
  remarks = '';
  errorMessage = '';

  constructor(
    private http: HttpClient,
    private dialogRef: MatDialogRef<ReviewTeacherRegularizationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      regularization: TeacherAttendanceRegularizationDto;
      approve?: boolean;
      isApproved?: boolean;
    }
  ) {}

  get isApprove(): boolean {
    return !!(this.data?.approve ?? this.data?.isApproved);
  }

  confirm(): void {
    if (!this.isApprove && !this.remarks.trim()) return;
    this.saving = true;
    this.errorMessage = '';

    this.http.put(`${API_BASE}/teachers/regularizations/${this.data.regularization.id}/review`, {
      approve: this.isApprove,
      reviewRemarks: this.remarks.trim()
    }).subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close(true);
      },
      error: err => {
        this.saving = false;
        this.errorMessage = err.error?.message || 'Action failed. Please verify permissions.';
      }
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
