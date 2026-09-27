import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';
import { API_BASE, HolidayDto, LeaveDto, RequestLeaveCancellationDto, ReviewLeaveCancellationDto } from './teacher.models';

// ─── Calendar Day Model ───────────────────────────────────────────────────────
interface CalDay {
  date: string;     // YYYY-MM-DD
  day: number;
  isLeave: boolean;
  checked: boolean; // true = keep | false = cancel this day
  isSunday: boolean;
  isSat: boolean;
  isToday: boolean;
  isHoliday?: boolean;
  holidayTitle?: string;
  isWeeklyOff?: boolean;
  isCancelled?: boolean;
}
interface CalMonth {
  label: string;
  year: number;
  month: number;
  weeks: (CalDay | null)[][];
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const DOW_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// ═══════════════════════════════════════════════════════════════════
// 1. REQUEST LEAVE CANCELLATION DIALOG (FULL OR PARTIAL DATES)
// ═══════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-request-leave-cancellation-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatRadioModule, MatTooltipModule
  ],
  template: `
    <div class="fd-dialog-md">

      <!-- ── Header ── -->
      <div class="fd-dialog-header">
        <div class="fd-dialog-icon"><mat-icon>event_busy</mat-icon></div>
        <div class="fd-dialog-title-group">
          <h2 class="fd-dialog-title">Request Leave Cancellation</h2>
          <span class="fd-dialog-sub">
            {{leave.teacherName}} ({{leave.employeeCode}}) &bull;
            <strong>{{formatLeaveType(leave.leaveType)}}</strong>
          </span>
        </div>
        <button mat-icon-button class="fd-dialog-close" (click)="cancel()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="fd-dialog-body">

          <!-- ── Leave Summary Banner ── -->
          <div class="leave-overview-card">
            <div class="overview-header">
              <span class="overview-title">
                <mat-icon>date_range</mat-icon> Current Sanctioned Period
              </span>
              <span class="overview-days-badge">{{leave.totalDays}} Total Day(s)</span>
            </div>
            <div class="overview-meta">
              <span>
                Dates: <strong>{{leave.fromDate | date:'dd MMM yyyy'}}</strong>
                &nbsp;→&nbsp;
                <strong>{{leave.toDate | date:'dd MMM yyyy'}}</strong>
              </span>
              <span *ngIf="leave.reason">Reason: <em>"{{leave.reason}}"</em></span>
            </div>
          </div>

          <!-- ── Cancellation Mode ── -->
          <div class="cancellation-mode-box">
            <label class="mode-label">Cancellation Type *</label>
            <mat-radio-group formControlName="cancellationType"
                             (change)="onModeChange()"
                             class="mode-radio-group">

              <mat-radio-button value="full" color="primary">
                <div class="radio-content">
                  <strong>Cancel Entire Leave</strong>
                  <span>Revoke all {{leave.totalDays}} days — full restoration to working roster &amp; leave quota</span>
                </div>
              </mat-radio-button>

              <mat-radio-button value="partial" color="primary">
                <div class="radio-content">
                  <strong>Partial Date Cancellation</strong>
                  <span>Pick specific days below — uncheck the days you want cancelled</span>
                </div>
              </mat-radio-button>

            </mat-radio-group>
          </div>

          <!-- ═══════════════════════════════════════════════════════════
               SMART CALENDAR — visible only when "partial" is chosen
               ═══════════════════════════════════════════════════════════ -->
          <div class="calendar-wrap" *ngIf="isPartialMode">

            <!-- Legend -->
            <div class="cal-legend">
              <span class="legend-item">
                <span class="legend-dot keep-dot"></span> Checked = Keep
              </span>
              <span class="legend-item">
                <span class="legend-dot cancel-dot"></span> Unchecked = Cancel
              </span>
              <span class="legend-item">
                <span class="legend-dot holiday-dot"></span> 🏖️ Holiday (Exempt)
              </span>
              <span class="legend-item">
                <span class="legend-dot off-dot"></span> ☀️ Sunday (Exempt)
              </span>
              <span class="legend-item" *ngIf="hasAnyCancelled">
                <span class="legend-dot" style="background:#dc2626;"></span> 🚫 Already Cancelled
              </span>
            </div>

            <!-- One block per calendar month -->
            <div class="cal-month-block" *ngFor="let cm of calMonths">

              <div class="cal-month-header">
                <mat-icon class="cal-hdr-icon">calendar_month</mat-icon>
                <span>{{cm.label}}</span>
              </div>

              <!-- Grid -->
              <div class="cal-grid">
                <!-- Day-of-week labels -->
                <div class="cal-dow" *ngFor="let lbl of dowLabels">{{lbl}}</div>

                <ng-container *ngFor="let week of cm.weeks">
                  <ng-container *ngFor="let cell of week">

                    <!-- Empty filler -->
                    <div class="cal-cell cal-empty" *ngIf="!cell"></div>

                    <!-- 1. Declared School Holiday (Exempt - Not deducted from quota) -->
                    <div class="cal-cell cal-exempt cal-holiday"
                         *ngIf="cell && cell.isHoliday"
                         [matTooltip]="(cell.holidayTitle || 'Official Holiday') + ' — Not deducted from leave quota'">
                      <span class="cal-num">{{cell.day}}</span>
                      <span class="cal-tag">🏖️ Holiday</span>
                    </div>

                    <!-- 2. Sunday / Weekly Off (Exempt - Not deducted from quota) -->
                    <div class="cal-cell cal-exempt cal-weekly-off"
                         *ngIf="cell && cell.isWeeklyOff"
                         matTooltip="Sunday (Weekly Off) — Not deducted from leave quota">
                      <span class="cal-num">{{cell.day}}</span>
                      <span class="cal-tag">☀️ Off</span>
                    </div>

                    <!-- 2b. Already Cancelled Day (Approved cancellation) -->
                    <div class="cal-cell cal-exempt cal-cancelled"
                         *ngIf="cell && cell.isCancelled"
                         matTooltip="This day was already cancelled and removed from leave">
                      <span class="cal-num">{{cell.day}}</span>
                      <span class="cal-tag">🚫 Cancelled</span>
                    </div>

                    <!-- 3. Actual Working Leave Day (Interactive: Keep / Cancel) -->
                    <div class="cal-cell cal-leave"
                         *ngIf="cell && cell.isLeave && !cell.isCancelled"
                         [class.is-keep]="cell.checked"
                         [class.is-cancel]="!cell.checked"
                         (click)="toggleDay(cell)"
                         [matTooltip]="cell.checked
                           ? 'Click to mark for cancellation'
                           : 'Click to restore this day'">
                      <span class="cal-num">{{cell.day}}</span>
                      <mat-icon class="cal-chk-icon">
                        {{cell.checked ? 'check_circle' : 'cancel'}}
                      </mat-icon>
                      <span class="cal-tag" *ngIf="cell.isSat">Sat</span>
                    </div>

                    <!-- 4. Ordinary day outside leave span (display only) -->
                    <div class="cal-cell cal-other"
                         *ngIf="cell && !cell.isLeave && !cell.isHoliday && !cell.isWeeklyOff && !cell.isCancelled"
                         [class.cal-weekend]="cell.isSunday || cell.isSat"
                         [class.cal-today]="cell.isToday">
                      <span class="cal-num">{{cell.day}}</span>
                      <span class="cal-tag" *ngIf="cell.isSunday">Sun</span>
                      <span class="cal-tag" *ngIf="cell.isSat">Sat</span>
                    </div>

                  </ng-container>
                </ng-container>
              </div>
            </div>

            <!-- Warning: non-contiguous selection -->
            <div class="cal-warn" *ngIf="nonContiguousWarn">
              <mat-icon>warning</mat-icon>
              <span>The system supports cancellation of a <strong>contiguous date block</strong>.
                    Please uncheck consecutive days only.</span>
            </div>

            <!-- Hint: nothing unchecked yet -->
            <div class="cal-warn cal-warn-info"
                 *ngIf="cancelDaysList.length === 0 && !nonContiguousWarn">
              <mat-icon>touch_app</mat-icon>
              <span>Tap a <strong>blue tile</strong> to mark that day for cancellation.</span>
            </div>

            <!-- Live Summary Pill -->
            <div class="summary-pill" *ngIf="cancelDaysList.length > 0 && !nonContiguousWarn">
              <div class="pill-side cancel-side">
                <mat-icon>event_busy</mat-icon>
                <div>
                  <div class="pill-count">{{cancelDaysList.length}} Day(s)</div>
                  <div class="pill-sub">Will be cancelled</div>
                </div>
              </div>

              <mat-icon class="pill-arrow">arrow_forward</mat-icon>

              <div class="pill-side keep-side">
                <mat-icon>event_available</mat-icon>
                <div>
                  <div class="pill-count">{{keepDaysList.length}} Day(s)</div>
                  <div class="pill-sub">Will remain</div>
                </div>
              </div>

              <div class="pill-range">
                {{cancelDaysList[0] | date:'d MMM'}}
                <span *ngIf="cancelDaysList.length > 1">
                  &nbsp;–&nbsp;{{cancelDaysList[cancelDaysList.length-1] | date:'d MMM yyyy'}}
                </span>
                <span *ngIf="cancelDaysList.length === 1">
                  &nbsp;{{cancelDaysList[0] | date:'yyyy'}}
                </span>
              </div>
            </div>

          </div>
          <!-- /calendar-wrap -->

          <!-- ── Reason ── -->
          <mat-form-field appearance="outline" class="fd-field-full">
            <mat-label>Reason for Cancellation *</mat-label>
            <textarea matInput formControlName="reason" rows="3"
              placeholder="e.g. Reported back early, personal work completed, tour rescheduled...">
            </textarea>
          </mat-form-field>

          <!-- ── Policy Notice ── -->
          <div class="policy-notice-box">
            <mat-icon>info</mat-icon>
            <div>
              <strong>Audit &amp; Roster Impact:</strong> Once approved by Administration, the
              selected date(s) will be removed from leave registers, restored to working
              attendance, and the deducted leave balance will be credited back.
            </div>
          </div>

          <!-- ── Backend Error ── -->
          <div class="error-banner" *ngIf="backendError">
            <mat-icon>error_outline</mat-icon>
            <span>{{backendError}}</span>
          </div>

        </div>

        <div class="fd-dialog-footer">
          <button mat-stroked-button type="button" (click)="cancel()">Close</button>
          <button mat-flat-button color="warn" type="submit" [disabled]="!canSubmit()">
            <mat-icon>{{saving ? 'hourglass_empty' : 'send'}}</mat-icon>
            {{saving ? 'Submitting...' : 'Submit Cancellation Request'}}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    /* ── Container ── */
    :host {
      display: block;
      width: 100%;
      overflow: hidden;
    }
    .fd-dialog-md {
      width: 100%;
      box-sizing: border-box;
      overflow: hidden;
    }

    /* ── Header ── */
    .fd-dialog-header {
      display: flex; align-items: center; gap: 14px; padding: 20px 24px 14px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
    }
    .fd-dialog-icon {
      background: #2563eb; color: #fff; border-radius: 10px; width: 44px; height: 44px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25); flex-shrink: 0;
    }
    .fd-dialog-title  { color: #1e3a8a; font-weight: 700; font-size: 1.05rem; margin: 0; }
    .fd-dialog-sub    { color: #3b82f6; font-size: 0.82rem; display: block; margin-top: 2px; }
    .fd-dialog-sub strong { color: #1e40af; }
    .fd-dialog-title-group { flex: 1; min-width: 0; }
    .fd-dialog-close  { color: #64748b; margin-left: auto; flex-shrink: 0; }
    .fd-dialog-close:hover { color: #1e293b; }

    /* ── Body / Footer ── */
    .fd-dialog-body {
      padding: 18px 24px; display: flex; flex-direction: column; gap: 14px;
      box-sizing: border-box; max-height: 74vh; overflow-y: auto; overflow-x: hidden;
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 transparent;
    }
    .fd-dialog-body::-webkit-scrollbar { width: 4px; }
    .fd-dialog-body::-webkit-scrollbar-track { background: transparent; }
    .fd-dialog-body::-webkit-scrollbar-thumb {
      background: #cbd5e1; border-radius: 4px;
    }
    .fd-dialog-body::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    .fd-dialog-footer {
      display: flex; gap: 12px; justify-content: flex-end;
      padding: 14px 24px; border-top: 1px solid #e2e8f0; background: #fafafa;
    }
    .fd-field-full { width: 100%; display: block; }

    /* ── Leave overview card ── */
    .leave-overview-card {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 12px 16px; display: flex; flex-direction: column; gap: 6px;
    }
    .overview-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; }
    .overview-title  {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 0.82rem; font-weight: 700; color: #1e293b;
    }
    .overview-title mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2563eb; }
    .overview-days-badge {
      background: #eff6ff; color: #1e40af; font-weight: 700; font-size: 0.76rem;
      padding: 3px 10px; border-radius: 20px; border: 1px solid #bfdbfe;
    }
    .overview-meta { display: flex; flex-direction: column; gap: 4px; font-size: 0.78rem; color: #64748b; }
    .overview-meta strong { color: #0f172a; }

    /* ── Mode selector ── */
    .cancellation-mode-box {
      border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 16px; background: #fff;
    }
    .mode-label {
      font-size: 0.75rem; font-weight: 700; color: #475569;
      text-transform: uppercase; letter-spacing: 0.4px; display: block; margin-bottom: 10px;
    }
    .mode-radio-group { display: flex; flex-direction: column; gap: 10px; }
    .radio-content { display: flex; flex-direction: column; gap: 2px; }
    .radio-content strong { font-size: 0.84rem; color: #1e293b; }
    .radio-content span   { font-size: 0.74rem; color: #64748b; }

    /* Fix Angular Material radio button label alignment */
    ::ng-deep .cancellation-mode-box .mdc-form-field {
      align-items: flex-start !important;
    }
    ::ng-deep .cancellation-mode-box .mdc-radio {
      margin-top: 1px;
      flex-shrink: 0;
    }
    ::ng-deep .cancellation-mode-box .mdc-form-field > label {
      padding-left: 4px;
      cursor: pointer;
    }

    /* ═══════════════════════════════
       CALENDAR STYLES
       ═══════════════════════════════ */
    .calendar-wrap {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;
      padding: 14px 16px; display: flex; flex-direction: column; gap: 12px;
      animation: calSlideIn 0.22s ease;
    }
    @keyframes calSlideIn {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Legend */
    .cal-legend {
      display: flex; gap: 14px; flex-wrap: wrap;
      font-size: 0.74rem; color: #475569; font-weight: 600;
    }
    .legend-item { display: inline-flex; align-items: center; gap: 5px; }
    .legend-dot  { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .keep-dot    { background: #2563eb; }
    .cancel-dot  { background: #ef4444; }
    .holiday-dot { background: #16a34a; }
    .off-dot     { background: #94a3b8; }

    /* Month block */
    .cal-month-block { display: flex; flex-direction: column; gap: 6px; }
    .cal-month-header {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 0.86rem; font-weight: 700; color: #1e40af;
      padding-bottom: 6px; border-bottom: 1px dashed #bfdbfe;
    }
    .cal-hdr-icon { font-size: 17px; width: 17px; height: 17px; color: #2563eb; }

    /* Calendar Grid */
    .cal-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 3px;
    }

    /* Day-of-week header */
    .cal-dow {
      text-align: center; font-size: 0.66rem; font-weight: 700;
      color: #94a3b8; padding: 4px 0; text-transform: uppercase;
    }

    /* Base cell */
    .cal-cell {
      aspect-ratio: 1 / 1.15;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      border-radius: 8px; position: relative;
      user-select: none; min-width: 0; box-sizing: border-box;
    }
    .cal-num { font-size: 0.8rem; font-weight: 700; line-height: 1; }
    .cal-tag { font-size: 0.52rem; font-weight: 600; line-height: 1; margin-top: 1px;
               text-transform: uppercase; letter-spacing: 0.3px; }

    /* Empty filler */
    .cal-empty { background: transparent; }

    /* Non-leave day */
    .cal-other {
      background: #fff; color: #94a3b8;
      border: 1px solid #f1f5f9;
    }
    .cal-other.cal-weekend { color: #cbd5e1; background: #fafafa; }
    .cal-other.cal-today   { border: 1.5px solid #bfdbfe; color: #2563eb; font-weight: 800; }

    /* LEAVE tile — KEEP (blue gradient, pre-checked) */
    .cal-leave.is-keep {
      background: linear-gradient(145deg, #1d4ed8 0%, #3b82f6 100%);
      color: #ffffff; cursor: pointer;
      box-shadow: 0 3px 8px rgba(37,99,235,0.35);
      border: 2px solid transparent;
      transition: transform 0.14s ease, box-shadow 0.14s ease;
    }
    .cal-leave.is-keep:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(37,99,235,0.45);
    }
    .cal-leave.is-keep .cal-tag { color: rgba(255,255,255,0.75); }

    /* LEAVE tile — CANCEL (red, unchecked) */
    .cal-leave.is-cancel {
      background: #fff5f5; color: #dc2626; cursor: pointer;
      border: 2px solid #fca5a5; text-decoration: line-through;
      transition: transform 0.14s ease, box-shadow 0.14s ease;
    }
    .cal-leave.is-cancel:hover {
      transform: scale(1.07);
      box-shadow: 0 4px 12px rgba(220,38,38,0.2);
    }
    .cal-leave.is-cancel .cal-tag { color: #f87171; text-decoration: none; }

    /* ── Exempt Holiday Tile (e.g. 2 Oct Gandhi Jayanti) ── */
    .cal-cell.cal-exempt.cal-holiday {
      background: #f0fdf4;
      border: 1.5px dashed #86efac;
      color: #15803d;
      cursor: help;
      transition: transform 0.12s ease;
    }
    .cal-cell.cal-exempt.cal-holiday:hover {
      transform: scale(1.05);
      box-shadow: 0 2px 8px rgba(22, 163, 74, 0.15);
    }
    .cal-cell.cal-exempt.cal-holiday .cal-num {
      color: #166534;
      font-weight: 800;
    }
    .cal-cell.cal-exempt.cal-holiday .cal-tag {
      color: #15803d;
      font-size: 0.52rem;
      font-weight: 700;
      background: #dcfce7;
      padding: 1px 4px;
      border-radius: 4px;
    }

    /* ── Exempt Sunday / Weekly Off Tile (e.g. 4 Oct) ── */
    .cal-cell.cal-exempt.cal-weekly-off {
      background: #f8fafc;
      border: 1.5px dashed #cbd5e1;
      color: #64748b;
      cursor: help;
      transition: transform 0.12s ease;
    }
    .cal-cell.cal-exempt.cal-weekly-off:hover {
      transform: scale(1.05);
      box-shadow: 0 2px 8px rgba(100, 116, 139, 0.15);
    }
    .cal-cell.cal-exempt.cal-weekly-off .cal-num {
      color: #475569;
      font-weight: 700;
    }
    .cal-cell.cal-exempt.cal-weekly-off .cal-tag {
      color: #64748b;
      font-size: 0.52rem;
      font-weight: 700;
      background: #f1f5f9;
      padding: 1px 4px;
      border-radius: 4px;
    }

    /* ── Exempt Already Cancelled Tile (e.g. 29 Sep) ── */
    .cal-cell.cal-exempt.cal-cancelled {
      background: #f8fafc;
      border: 1.5px dashed #cbd5e1;
      color: #94a3b8;
      cursor: not-allowed;
      opacity: 0.85;
      .cal-num {
        color: #94a3b8;
        font-weight: 700;
        text-decoration: line-through;
      }
      .cal-tag {
        color: #dc2626;
        font-size: 0.52rem;
        font-weight: 700;
        background: #fee2e2;
        padding: 1px 4px;
        border-radius: 4px;
        text-decoration: none;
      }
    }

    /* Weekend override for leave tiles */
    .cal-leave.cal-weekend.is-keep {
      background: linear-gradient(145deg, #6d28d9 0%, #a78bfa 100%);
    }

    /* Check / cancel icon inside tile */
    .cal-chk-icon {
      font-size: 11px; width: 11px; height: 11px;
      position: absolute; bottom: 3px; right: 3px;
    }
    .is-keep   .cal-chk-icon { color: rgba(255,255,255,0.85); }
    .is-cancel .cal-chk-icon { color: #ef4444; }

    /* ── Warnings ── */
    .cal-warn {
      display: flex; align-items: flex-start; gap: 8px;
      background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;
      padding: 9px 12px; font-size: 0.78rem; color: #92400e; line-height: 1.45;
    }
    .cal-warn.cal-warn-info { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
    .cal-warn mat-icon { font-size: 17px; width: 17px; height: 17px; flex-shrink: 0; margin-top: 1px; }

    /* ── Live Summary Pill ── */
    .summary-pill {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      background: #fff; border: 1.5px solid #e2e8f0; border-radius: 10px;
      padding: 10px 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .pill-side { display: inline-flex; align-items: center; gap: 8px; flex: 1; min-width: 110px; }
    .pill-side mat-icon { font-size: 22px; width: 22px; height: 22px; flex-shrink: 0; }
    .cancel-side mat-icon { color: #dc2626; }
    .keep-side   mat-icon { color: #16a34a; }
    .pill-count  { font-size: 1.05rem; font-weight: 800; line-height: 1; }
    .cancel-side .pill-count { color: #dc2626; }
    .keep-side   .pill-count { color: #16a34a; }
    .pill-sub    { font-size: 0.68rem; color: #64748b; font-weight: 600; }
    .pill-arrow  { color: #94a3b8; font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
    .pill-range  {
      width: 100%; text-align: center;
      font-size: 0.74rem; font-weight: 700; color: #475569;
      border-top: 1px dashed #e2e8f0; padding-top: 7px; margin-top: 2px;
    }

    /* ── Policy notice ── */
    .policy-notice-box {
      display: flex; gap: 10px; align-items: flex-start;
      background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;
      padding: 10px 14px; font-size: 0.78rem; color: #1e40af; line-height: 1.45;
    }
    .policy-notice-box mat-icon {
      font-size: 18px; width: 18px; height: 18px; color: #2563eb; flex-shrink: 0;
    }

    /* ── Error banner ── */
    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
      padding: 8px 12px; font-size: 0.8rem; color: #b91c1c;
    }
    .error-banner mat-icon { font-size: 18px; width: 18px; height: 18px; color: #ef4444; flex-shrink: 0; }

    /* ── Mobile ── */
    @media (max-width: 520px) {
      .fd-dialog-header { padding: 14px 16px 12px; }
      .fd-dialog-body   { padding: 12px 14px; gap: 10px; max-height: 65vh; }
      .fd-dialog-footer { padding: 10px 16px; }
      .fd-dialog-footer button { flex: 1; }
      .cal-legend { gap: 8px; }
      .summary-pill { gap: 6px; padding: 8px 10px; }
    }
  `]
})
export class RequestLeaveCancellationDialogComponent implements OnInit {
  leave!: LeaveDto;
  holidays: HolidayDto[] = [];
  form!: FormGroup;
  saving = false;
  backendError = '';

  // Calendar state
  calMonths: CalMonth[]  = [];
  allLeaveDays: CalDay[] = [];
  cancelDaysList: string[] = [];
  keepDaysList:   string[] = [];
  nonContiguousWarn = false;

  readonly dowLabels = DOW_LABELS;

  get isPartialMode(): boolean {
    return this.form?.get('cancellationType')?.value === 'partial';
  }

  get hasAnyCancelled(): boolean {
    return !!(
      (this.leave?.isCancellationApproved === true || this.leave?.status === 'PartiallyCancelled') &&
      this.leave?.cancellationFromDate
    );
  }

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private dialogRef: MatDialogRef<RequestLeaveCancellationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { leave: LeaveDto; holidays?: HolidayDto[] }
  ) {}

  ngOnInit() {
    this.leave = this.data.leave;
    if (this.data.holidays && this.data.holidays.length > 0) {
      this.holidays = this.data.holidays;
    }
    this.form = this.fb.group({
      cancellationType: ['full', Validators.required],
      reason: ['', [Validators.required, Validators.minLength(5)]]
    });

    this.buildCalendar();

    // Fetch official holidays if not provided via data
    if (this.holidays.length === 0) {
      this.http.get<HolidayDto[]>(`${API_BASE}/holidays?activeOnly=true`).subscribe({
        next: (hList) => {
          this.holidays = hList || [];
          this.buildCalendar();
        },
        error: () => {}
      });
    }
  }

  // ── Build calendar months ────────────────────────────────────────
  buildCalendar() {
    const from  = this.parseDate(this.leave.fromDate);
    const to    = this.parseDate(this.leave.toDate);
    const today = new Date(); today.setHours(0,0,0,0);

    // Collect all date strings in the leave period span
    const spanDates = new Set<string>();
    const cur = new Date(from);
    while (cur <= to) { spanDates.add(this.toISO(cur)); cur.setDate(cur.getDate() + 1); }

    // Which months to render
    const months: { y: number; m: number }[] = [];
    const mCur = new Date(from.getFullYear(), from.getMonth(), 1);
    const mEnd = new Date(to.getFullYear(),   to.getMonth(),   1);
    while (mCur <= mEnd) {
      months.push({ y: mCur.getFullYear(), m: mCur.getMonth() });
      mCur.setMonth(mCur.getMonth() + 1);
    }

    this.allLeaveDays = [];

    this.calMonths = months.map(({ y, m }) => {
      const label    = `${MONTH_NAMES[m]} ${y}`;
      const firstDay = new Date(y, m, 1);
      const lastDay  = new Date(y, m + 1, 0);

      // Remap JS Sunday(0)→6, Mon(1)→0 … Sat(6)→5  (Mon-first grid)
      const remap = (d: number) => (d === 0 ? 6 : d - 1);
      const offset = remap(firstDay.getDay());

      const cells: (CalDay | null)[] = Array(offset).fill(null);

      for (let d = 1; d <= lastDay.getDate(); d++) {
        const dt       = new Date(y, m, d);
        const iso      = this.toISO(dt);
        const dow      = dt.getDay();
        const isInSpan = spanDates.has(iso);

        // Check if this date was already cancelled in a previously approved cancellation
        const isAlreadyCancelled = !!(
          (this.leave.isCancellationApproved === true || this.leave.status === 'PartiallyCancelled' || this.leave.status === 'Cancelled') &&
          this.leave.cancellationFromDate &&
          this.leave.cancellationToDate &&
          iso >= this.leave.cancellationFromDate.split('T')[0] &&
          iso <= this.leave.cancellationToDate.split('T')[0]
        );

        // Check if declared holiday
        const matchedH = this.holidays.find(h => {
          const hStart = (h.startDate || '').split('T')[0];
          const hEnd   = (h.endDate || '').split('T')[0] || hStart;
          return iso >= hStart && iso <= hEnd;
        });

        const isSun = dow === 0;
        const isSat = dow === 6;

        // Exempt days within the leave period (official holiday or Sunday)
        const isExemptHoliday = isInSpan && !isAlreadyCancelled && !!matchedH;
        const isExemptOff     = isInSpan && !isAlreadyCancelled && isSun && !matchedH;

        // Actual working leave day: in span, but not already cancelled, and not an exempt holiday or Sunday
        const isLeave = isInSpan && !isAlreadyCancelled && !isExemptHoliday && !isExemptOff;

        const cell: CalDay = {
          date:         iso,
          day:          d,
          isLeave,
          checked:      isLeave,  // pre-checked = keep
          isSunday:     isSun,
          isSat:        isSat,
          isToday:      dt.getTime() === today.getTime(),
          isHoliday:    isExemptHoliday,
          holidayTitle: matchedH ? matchedH.title : undefined,
          isWeeklyOff:  isExemptOff,
          isCancelled:  isAlreadyCancelled
        };
        cells.push(cell);
        if (isLeave) this.allLeaveDays.push(cell);
      }

      // Pad to multiple-of-7
      while (cells.length % 7 !== 0) cells.push(null);

      const weeks: (CalDay | null)[][] = [];
      for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

      return { label, year: y, month: m, weeks };
    });

    this.updateSummary();
  }

  // ── Toggle a leave-day tile ──────────────────────────────────────
  toggleDay(cell: CalDay) {
    if (!cell.isLeave) return;
    cell.checked = !cell.checked;
    this.updateSummary();
  }

  // ── Recompute summary after any toggle ──────────────────────────
  updateSummary() {
    this.cancelDaysList = this.allLeaveDays
      .filter(d => !d.checked).map(d => d.date).sort();
    this.keepDaysList   = this.allLeaveDays
      .filter(d =>  d.checked).map(d => d.date).sort();

    this.nonContiguousWarn =
      this.cancelDaysList.length > 1 && !this.isContiguous(this.cancelDaysList);
  }

  isContiguous(dates: string[]): boolean {
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const next = new Date(dates[i]);
      const ms = next.getTime() - prev.getTime();
      if (ms === 86_400_000) continue; // consecutive days

      // If separated by exempt days (holidays/Sundays), consider them continuous
      let allBetweenExempt = true;
      const check = new Date(prev);
      check.setDate(check.getDate() + 1);
      while (check < next) {
        const iso = this.toISO(check);
        const isSun = check.getDay() === 0;
        const isH = this.holidays.some(h => {
          const s = (h.startDate || '').split('T')[0];
          const e = (h.endDate || '').split('T')[0] || s;
          return iso >= s && iso <= e;
        });
        if (!isSun && !isH) {
          allBetweenExempt = false;
          break;
        }
        check.setDate(check.getDate() + 1);
      }

      if (!allBetweenExempt) return false;
    }
    return true;
  }

  // ── Reset calendar when mode switches ───────────────────────────
  onModeChange() {
    this.allLeaveDays.forEach(d => d.checked = true);
    this.updateSummary();
  }

  // ── Can submit? ──────────────────────────────────────────────────
  canSubmit(): boolean {
    if (this.form.invalid || this.saving) return false;
    if (this.isPartialMode) {
      if (this.cancelDaysList.length === 0) return false;
      if (this.nonContiguousWarn)           return false;
    }
    return true;
  }

  // ── Submit ───────────────────────────────────────────────────────
  submit() {
    if (!this.canSubmit()) return;
    this.saving = true;
    this.backendError = '';

    const isPartial = this.isPartialMode;
    const payload: RequestLeaveCancellationDto = {
      isPartialCancellation: isPartial,
      cancelFromDate: isPartial ? this.cancelDaysList[0] : undefined,
      cancelToDate:   isPartial ? this.cancelDaysList[this.cancelDaysList.length - 1] : undefined,
      reason: this.form.get('reason')!.value
    };

    this.http
      .post(`${API_BASE}/teachers/leaves/${this.leave.id}/request-cancellation`, payload)
      .subscribe({
        next:  ()  => { this.saving = false; this.dialogRef.close(true); },
        error: err => {
          this.saving = false;
          this.backendError = err.error?.message || 'Failed to submit cancellation request.';
        }
      });
  }

  cancel() { this.dialogRef.close(false); }

  formatLeaveType(type: string): string {
    if (!type) return 'Leave';
    return type.replace(/([A-Z])/g, ' $1').trim();
  }

  private parseDate(d: string): Date {
    const s = (d || '').split('T')[0];
    const parts = s.split('-').map(Number);
    if (parts.length === 3) {
      return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    }
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  private toISO(dt: Date): string {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}


// ═══════════════════════════════════════════════════════════════════
// 2. REVIEW LEAVE CANCELLATION DIALOG (ADMIN / HR APPROVAL)
// ═══════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-review-leave-cancellation-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule,
    MatIconModule, MatFormFieldModule, MatInputModule
  ],
  template: `
    <div class="fd-dialog-review">
      <div class="fd-dialog-header">
        <div class="fd-dialog-icon">
          <mat-icon>fact_check</mat-icon>
        </div>
        <div class="fd-dialog-title-group">
          <h2 class="fd-dialog-title">Review Cancellation Request</h2>
          <span class="fd-dialog-sub">{{leave.teacherName}} ({{leave.employeeCode}})</span>
        </div>
        <button mat-icon-button class="fd-dialog-close" (click)="cancel()"><mat-icon>close</mat-icon></button>
      </div>

      <div class="fd-dialog-body">
        <!-- Request Details -->
        <div class="review-meta-box">
          <div class="meta-row">
            <span class="meta-label">Original Leave:</span>
            <span class="meta-val">
              <strong>{{formatLeaveType(leave.leaveType)}}</strong>
              ({{leave.fromDate | date:'dd MMM yyyy'}} to {{leave.toDate | date:'dd MMM yyyy'}} • {{leave.totalDays}} Days)
            </span>
          </div>

          <div class="meta-row highlight-row">
            <span class="meta-label">Cancellation Scope:</span>
            <span class="meta-val">
              <strong *ngIf="!leave.isPartialCancellation" class="badge-full">Full Cancellation (All {{leave.totalDays}} Days)</strong>
              <strong *ngIf="leave.isPartialCancellation" class="badge-partial">
                Partial ({{leave.cancellationFromDate | date:'dd MMM yyyy'}} to {{leave.cancellationToDate | date:'dd MMM yyyy'}})
              </strong>
            </span>
          </div>

          <div class="meta-row">
            <span class="meta-label">Employee Reason:</span>
            <span class="meta-val reason-val">{{leave.cancellationReason || '—'}}</span>
          </div>

          <div class="meta-row" *ngIf="leave.cancellationRequestedAt">
            <span class="meta-label">Requested On:</span>
            <span class="meta-val">{{leave.cancellationRequestedAt | date:'dd MMM yyyy, hh:mm a'}}</span>
          </div>
        </div>

        <mat-form-field appearance="outline" class="fd-field-full">
          <mat-label>Administrative Remarks (Optional)</mat-label>
          <textarea matInput [(ngModel)]="remarks" rows="2" placeholder="e.g. Approved as requested / Verified report on duty..."></textarea>
        </mat-form-field>

        <div class="error-banner" *ngIf="backendError">
          <mat-icon>error_outline</mat-icon>
          <span>{{backendError}}</span>
        </div>
      </div>

      <div class="fd-dialog-footer">
        <button mat-stroked-button class="btn-cancel-flat" type="button" (click)="cancel()" [disabled]="submitting">
          Cancel
        </button>
        <div class="footer-actions">
          <button mat-stroked-button class="btn-smart-reject" type="button" (click)="decide(false)" [disabled]="submitting">
            <mat-icon>cancel</mat-icon>
            <span>Reject Request</span>
          </button>
          <button mat-flat-button class="btn-smart-approve" type="button" (click)="decide(true)" [disabled]="submitting">
            <mat-icon [class.spin]="submitting">{{submitting ? 'refresh' : 'check_circle'}}</mat-icon>
            <span>{{submitting ? 'Processing...' : 'Approve & Sync Roster'}}</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .fd-dialog-review { width: 100%; max-width: 600px; box-sizing: border-box; }
    .fd-dialog-header {
      display: flex; align-items: center; gap: 14px; padding: 20px 24px 14px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
    }
    .fd-dialog-icon {
      background: #2563eb; color: #fff; border-radius: 10px; width: 44px; height: 44px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25); flex-shrink: 0;
    }
    .fd-dialog-title { color: #1e3a8a; font-weight: 700; font-size: 1.05rem; margin: 0; }
    .fd-dialog-sub { color: #3b82f6; font-size: 0.82rem; margin-top: 2px; }
    .fd-dialog-title-group { flex: 1; min-width: 0; }
    .fd-dialog-close { color: #64748b; margin-left: auto; flex-shrink: 0; }
    .fd-dialog-body { padding: 18px 24px; display: flex; flex-direction: column; gap: 14px; box-sizing: border-box; }
    .fd-dialog-footer {
      display: flex; justify-content: space-between; align-items: center; gap: 12px;
      padding: 14px 24px; border-top: 1px solid #e2e8f0; background: #fafafa;
    }
    .footer-actions { display: flex; gap: 10px; align-items: center; }
    .btn-cancel-flat {
      color: #64748b !important; border-color: #cbd5e1 !important; font-weight: 500 !important;
      border-radius: 8px !important; height: 38px !important;
    }
    .btn-cancel-flat:hover { background: #f1f5f9 !important; color: #1e293b !important; }
    .btn-smart-reject {
      color: #dc2626 !important; border-color: #fca5a5 !important; background: #fff5f5 !important;
      font-weight: 600 !important; border-radius: 8px !important; padding: 0 16px !important;
      height: 38px !important; white-space: nowrap !important; transition: all 0.15s ease;
      display: inline-flex !important; align-items: center !important; gap: 6px !important;
    }
    .btn-smart-reject:hover { background: #fee2e2 !important; border-color: #f87171 !important; color: #b91c1c !important; }
    .btn-smart-reject mat-icon { font-size: 18px; width: 18px; height: 18px; color: #dc2626; margin: 0; }
    .btn-smart-approve {
      background: linear-gradient(135deg, #2563eb, #1d4ed8) !important; color: #ffffff !important;
      font-weight: 600 !important; border-radius: 8px !important; padding: 0 20px !important;
      height: 38px !important; white-space: nowrap !important;
      box-shadow: 0 2px 6px rgba(37,99,235,0.28) !important; transition: all 0.15s ease;
      display: inline-flex !important; align-items: center !important; gap: 6px !important;
    }
    .btn-smart-approve:hover {
      background: linear-gradient(135deg, #1d4ed8, #1e40af) !important;
      box-shadow: 0 4px 10px rgba(37,99,235,0.38) !important;
    }
    .btn-smart-approve mat-icon { font-size: 18px; width: 18px; height: 18px; color: #fff; margin: 0; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }
    .fd-field-full { width: 100%; display: block; }

    .review-meta-box {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px;
      display: flex; flex-direction: column; gap: 8px; font-size: 0.82rem;
    }
    .meta-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .meta-label { color: #64748b; font-weight: 600; flex-shrink: 0; }
    .meta-val { color: #1e293b; text-align: right; }
    .highlight-row { background: #fff; border-radius: 6px; padding: 6px 8px; border: 1px dashed #cbd5e1; }
    .badge-full    { color: #dc2626; }
    .badge-partial { color: #d97706; }
    .reason-val    { font-style: italic; color: #475569; }

    .error-banner {
      display: flex; align-items: center; gap: 8px; background: #fef2f2;
      border: 1px solid #fecaca; border-radius: 8px; padding: 8px 12px;
      font-size: 0.8rem; color: #b91c1c;
    }
    .error-banner mat-icon { font-size: 18px; width: 18px; height: 18px; color: #ef4444; flex-shrink: 0; }

    @media (max-width: 520px) {
      .fd-dialog-header { padding: 14px 16px 12px; }
      .fd-dialog-body   { padding: 14px 16px; gap: 10px; }
      .fd-dialog-footer { padding: 10px 16px; flex-direction: column-reverse; gap: 8px; }
      .footer-actions   { width: 100%; flex-direction: column; gap: 8px; }
      .btn-cancel-flat, .btn-smart-reject, .btn-smart-approve { width: 100%; justify-content: center; }
    }
  `]
})
export class ReviewLeaveCancellationDialogComponent {
  leave: LeaveDto;
  remarks = '';
  submitting = false;
  backendError = '';

  constructor(
    private http: HttpClient,
    private dialogRef: MatDialogRef<ReviewLeaveCancellationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { leave: LeaveDto }
  ) {
    this.leave = data.leave;
  }

  formatLeaveType(type: string): string {
    if (!type) return 'Leave';
    return type.replace(/([A-Z])/g, ' $1').trim();
  }

  decide(approve: boolean) {
    this.submitting = true;
    this.backendError = '';

    const payload: ReviewLeaveCancellationDto = {
      approve: approve,
      reviewRemarks: this.remarks
    };

    this.http.put(`${API_BASE}/teachers/leaves/${this.leave.id}/review-cancellation`, payload).subscribe({
      next: () => {
        this.submitting = false;
        this.dialogRef.close(true);
      },
      error: err => {
        this.submitting = false;
        this.backendError = err.error?.message || 'Failed to submit review.';
      }
    });
  }

  cancel() { this.dialogRef.close(false); }
}
