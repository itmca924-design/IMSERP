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
import { StudentLeaveDto } from './student-leaves.component';

const API_BASE = 'http://localhost:5000/api';

export interface HolidayDto {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  type: string;
}

// ─── Calendar Day Model ───────────────────────────────────────────────────────
interface CalDay {
  date: string;     // YYYY-MM-DD local
  day: number;
  isLeave: boolean;
  checked: boolean; // true = keep | false = cancel this day
  isSunday: boolean;
  isSat: boolean;
  isToday: boolean;
  isHoliday?: boolean;
  holidayTitle?: string;
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
// 1. REQUEST STUDENT LEAVE CANCELLATION DIALOG (FULL OR PARTIAL DATES)
// ═══════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-request-student-leave-cancel-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatRadioModule, MatTooltipModule
  ],
  template: `
    <div class="fd-dialog-md">

      <!-- ── Header (Strict Light-Blue Gradient Styling) ── -->
      <div class="fd-dialog-header">
        <div class="fd-dialog-icon"><mat-icon>event_busy</mat-icon></div>
        <div class="fd-dialog-title-group">
          <h2 class="fd-dialog-title">Request Student Leave Cancellation</h2>
          <span class="fd-dialog-sub">
            {{leave.studentName}} &bull; Roll: <strong>{{leave.rollNumber}}</strong>
            <span *ngIf="leave.className"> &bull; {{leave.className}}</span>
            <span *ngIf="leave.sectionName">({{leave.sectionName}})</span>
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
                <mat-icon>date_range</mat-icon> Sanctioned Leave Period
              </span>
              <span class="overview-days-badge">{{leave.totalDays}} Total Day(s) &bull; {{leave.leaveCategory}}</span>
            </div>
            <div class="overview-meta">
              <span>
                Dates: <strong>{{formatDisplayDate(leave.fromDate)}}</strong>
                &nbsp;→&nbsp;
                <strong>{{formatDisplayDate(leave.toDate)}}</strong>
              </span>
              <span *ngIf="leave.reason">Reason: <em>"{{leave.reason}}"</em></span>
            </div>
          </div>

          <!-- ── Cancellation Mode ── -->
          <div class="cancellation-mode-box">
            <label class="mode-label">Cancellation Option *</label>
            <mat-radio-group formControlName="cancellationType"
                             (change)="onModeChange()"
                             class="mode-radio-group">

              <mat-radio-button value="full" color="primary">
                <div class="radio-content">
                  <strong>Cancel Entire Leave Period</strong>
                  <span>Revoke all {{leave.totalDays}} days — restores working attendance register for student</span>
                </div>
              </mat-radio-button>

              <mat-radio-button value="partial" color="primary">
                <div class="radio-content">
                  <strong>Partial Date Cancellation (Date-by-Date Calendar)</strong>
                  <span>Pick specific days — uncheck the days you want cancelled (e.g. if student attends school early)</span>
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
              <span class="leg-item"><span class="leg-swatch keep"></span> Keeping (Active Leave)</span>
              <span class="leg-item"><span class="leg-swatch cancel"></span> Cancelling (Will Attend)</span>
              <span class="leg-item" *ngIf="hasAnyCancelled"><span class="leg-swatch already-cancelled"></span> Already Cancelled</span>
              <span class="leg-item"><span class="leg-swatch hol"></span> Holiday</span>
              <span class="leg-item"><span class="leg-swatch sun"></span> Sunday</span>
            </div>

            <!-- Month Card -->
            <div class="cal-month-card" *ngFor="let m of calMonths">
              <div class="cal-month-title">{{m.label}}</div>

              <!-- Day of Week Header -->
              <div class="cal-dow-row">
                <span class="cal-dow" *ngFor="let d of dowLabels"
                      [class.sun-dow]="d === 'Sun'"
                      [class.sat-dow]="d === 'Sat'">{{d}}</span>
              </div>

              <!-- Weeks Grid -->
              <div class="cal-week-row" *ngFor="let week of m.weeks">
                <ng-container *ngFor="let cell of week">

                  <!-- Empty padding cell -->
                  <div class="cal-cell empty" *ngIf="!cell"></div>

                  <!-- Date cell -->
                  <div class="cal-cell"
                       *ngIf="cell"
                       [class.cal-leave]="cell.isLeave && !cell.isCancelled"
                       [class.cal-keep]="cell.isLeave && cell.checked && !cell.isCancelled"
                       [class.cal-cancelling]="cell.isLeave && !cell.checked && !cell.isCancelled"
                       [class.cal-exempt]="!cell.isLeave || cell.isCancelled"
                       [class.cal-cancelled]="cell.isCancelled"
                       [class.cal-sun]="cell.isSunday"
                       [class.cal-hol]="cell.isHoliday"
                       (click)="toggleDay(cell)">

                    <span class="cal-day-num">{{cell.day}}</span>

                    <!-- Status Tag -->
                    <span class="cal-day-badge" *ngIf="cell.isCancelled">
                      🚫 Cancelled
                    </span>
                    <span class="cal-day-badge" *ngIf="cell.isLeave && !cell.isCancelled">
                      {{cell.checked ? '✓ Leave' : '✕ Cancel'}}
                    </span>
                    <span class="cal-day-sub" *ngIf="!cell.isLeave && !cell.isCancelled && cell.isHoliday" [title]="cell.holidayTitle || 'Holiday'">
                      ⭐ Holiday
                    </span>
                    <span class="cal-day-sub" *ngIf="!cell.isLeave && !cell.isCancelled && !cell.isHoliday && cell.isSunday">
                      Sunday Off
                    </span>

                  </div>
                </ng-container>
              </div>
            </div>

            <!-- Live Selection Summary -->
            <div class="cal-summary-strip" [class.has-cancels]="cancelledCount > 0">
              <mat-icon>{{cancelledCount > 0 ? 'check_circle' : 'info'}}</mat-icon>
              <span *ngIf="cancelledCount === 0">
                Click on the days above to uncheck &amp; mark them for cancellation.
              </span>
              <span *ngIf="cancelledCount > 0">
                <strong>{{cancelledCount}} day(s)</strong> selected for cancellation:
                <em>{{cancelledDateRangesStr}}</em>
                &bull; Remaining active leave: <strong>{{remainingCount}} day(s)</strong>
              </span>
            </div>

          </div>

          <!-- ── Reason Input ── -->
          <mat-form-field appearance="outline" class="w-100 reason-field">
            <mat-label>Reason for Cancellation *</mat-label>
            <textarea matInput
                      formControlName="reason"
                      rows="3"
                      placeholder="e.g. Student recovered early from fever, attending class from 29th..."></textarea>
            <mat-error *ngIf="form.get('reason')?.hasError('required')">
              Reason is required for school records.
            </mat-error>
          </mat-form-field>

          <!-- ── Warning / Notice ── -->
          <div class="cancellation-info-box">
            <mat-icon>info</mat-icon>
            <div>
              <strong>What happens upon approval?</strong>
              <p>
                The Class Teacher or School Admin will review this request. Once approved, the attendance
                register ('L' marks) for the cancelled days will be removed so the student can be marked Present.
              </p>
            </div>
          </div>

        </div>

        <!-- ── Footer Actions ── -->
        <div class="fd-dialog-actions">
          <button mat-stroked-button type="button" (click)="cancel()">Dismiss</button>
          <button mat-raised-button
                  color="warn"
                  type="submit"
                  [disabled]="form.invalid || submitting || (isPartialMode && cancelledCount === 0)">
            <mat-icon>{{submitting ? 'hourglass_top' : 'send'}}</mat-icon>
            <span>{{submitting ? 'Submitting...' : 'Submit Cancellation Request'}}</span>
          </button>
        </div>

      </form>
    </div>
  `,
  styles: [`
    .fd-dialog-md {
      width: 100%;
      max-width: 720px;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .fd-dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      .fd-dialog-icon {
        background: #2563eb;
        color: #ffffff;
        border-radius: 10px;
        box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        mat-icon { font-size: 22px; width: 22px; height: 22px; }
      }
      .fd-dialog-title-group {
        flex: 1;
        .fd-dialog-title {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          color: #1e3a8a;
        }
        .fd-dialog-sub {
          font-size: 0.82rem;
          color: #3b82f6;
          margin-top: 2px;
          display: block;
        }
      }
      .fd-dialog-close {
        color: #64748b;
        &:hover { color: #1e293b; background: #e2e8f0; }
      }
    }
    .fd-dialog-body {
      padding: 20px;
      max-height: 72vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .leave-overview-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      .overview-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
        .overview-title {
          font-weight: 700;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 6px;
          mat-icon { font-size: 18px; width: 18px; height: 18px; color: #3b82f6; }
        }
        .overview-days-badge {
          background: #dbeafe;
          color: #1e40af;
          font-size: 0.76rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
        }
      }
      .overview-meta {
        font-size: 0.85rem;
        color: #475569;
        display: flex;
        flex-direction: column;
        gap: 4px;
        em { color: #64748b; }
      }
    }
    .cancellation-mode-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      background: #ffffff;
      .mode-label {
        display: block;
        font-size: 0.82rem;
        font-weight: 700;
        color: #334155;
        margin-bottom: 8px;
      }
      .mode-radio-group {
        display: flex;
        flex-direction: column;
        gap: 10px;
        mat-radio-button {
          .radio-content {
            display: flex;
            flex-direction: column;
            strong { font-size: 0.9rem; color: #1e293b; }
            span { font-size: 0.78rem; color: #64748b; }
          }
        }
      }
    }
    .calendar-wrap {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 14px;
      background: #f8fafc;
      .cal-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 12px;
        font-size: 0.75rem;
        color: #475569;
        .leg-item {
          display: flex;
          align-items: center;
          gap: 6px;
          .leg-swatch {
            width: 14px;
            height: 14px;
            border-radius: 4px;
            &.keep { background: #dbeafe; border: 1px solid #3b82f6; }
            &.cancel { background: #fee2e2; border: 1px solid #ef4444; }
            &.already-cancelled { background: #f1f5f9; border: 1.5px dashed #94a3b8; }
            &.hol { background: #fef3c7; border: 1px solid #f59e0b; }
            &.sun { background: #ffe4e6; border: 1px solid #f43f5e; }
          }
        }
      }
      .cal-month-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 10px;
        margin-bottom: 10px;
        .cal-month-title {
          font-weight: 700;
          font-size: 0.92rem;
          color: #1e3a8a;
          margin-bottom: 8px;
          text-align: center;
        }
        .cal-dow-row {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          text-align: center;
          font-size: 0.75rem;
          font-weight: 700;
          color: #64748b;
          margin-bottom: 6px;
          .sun-dow { color: #e11d48; }
          .sat-dow { color: #4f46e5; }
        }
        .cal-week-row {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
          margin-bottom: 4px;
          .cal-cell {
            min-height: 48px;
            border-radius: 6px;
            padding: 4px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-size: 0.78rem;
            position: relative;
            user-select: none;
            transition: all 0.15s ease;
            &.empty { background: transparent; }
            .cal-day-num { font-weight: 700; }
            .cal-day-badge {
              font-size: 0.65rem;
              font-weight: 700;
              margin-top: 2px;
            }
            .cal-day-sub {
              font-size: 0.62rem;
              margin-top: 2px;
            }
            &.cal-keep {
              background: #eff6ff;
              border: 1.5px solid #3b82f6;
              color: #1e40af;
              cursor: pointer;
              &:hover { background: #dbeafe; transform: scale(1.02); }
            }
            &.cal-cancelling {
              background: #fef2f2;
              border: 1.5px dashed #ef4444;
              color: #b91c1c;
              cursor: pointer;
              &:hover { background: #fee2e2; transform: scale(1.02); }
            }
            &.cal-exempt {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              color: #94a3b8;
              cursor: default;
            }
            &.cal-cancelled {
              background: #f1f5f9;
              border: 1.5px dashed #cbd5e1;
              color: #94a3b8;
              text-decoration: line-through;
              cursor: not-allowed;
            }
            &.cal-sun {
              background: #fff1f2;
              border-color: #fecdd3;
              color: #be123c;
            }
            &.cal-hol {
              background: #fffbeb;
              border-color: #fde68a;
              color: #b45309;
            }
          }
        }
      }
      .cal-summary-strip {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.82rem;
        color: #475569;
        padding: 8px 12px;
        border-radius: 6px;
        background: #f1f5f9;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: #3b82f6; }
        &.has-cancels {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
          mat-icon { color: #ef4444; }
        }
      }
    }
    .w-100 { width: 100%; }
    .cancellation-info-box {
      display: flex;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 8px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: #16a34a; flex-shrink: 0; margin-top: 1px; }
      strong { font-size: 0.84rem; display: block; margin-bottom: 2px; }
      p { margin: 0; font-size: 0.78rem; line-height: 1.35; color: #15803d; }
    }
    .fd-dialog-actions {
      padding: 12px 20px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      button { font-weight: 600; border-radius: 6px; }
    }
  `]
})
export class RequestStudentLeaveCancellationDialogComponent implements OnInit {
  leave: StudentLeaveDto;
  form: FormGroup;
  submitting = false;

  dowLabels = DOW_LABELS;
  calMonths: CalMonth[] = [];
  holidays: HolidayDto[] = [];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    public dialogRef: MatDialogRef<RequestStudentLeaveCancellationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { leave: StudentLeaveDto }
  ) {
    this.leave = data.leave;
    this.form = this.fb.group({
      cancellationType: ['full', Validators.required],
      reason: ['', [Validators.required, Validators.minLength(5)]]
    });
  }

  ngOnInit() {
    this.loadHolidaysAndBuild();
  }

  get isPartialMode(): boolean {
    return this.form.get('cancellationType')?.value === 'partial';
  }

  get hasAnyCancelled(): boolean {
    return this.calMonths.some(m => m.weeks.some(w => w.some(c => c?.isCancelled)));
  }

  get cancelledCount(): number {
    let count = 0;
    for (const m of this.calMonths) {
      for (const w of m.weeks) {
        for (const c of w) {
          if (c && c.isLeave && !c.checked && !c.isCancelled) {
            count++;
          }
        }
      }
    }
    return count;
  }

  get remainingCount(): number {
    let count = 0;
    for (const m of this.calMonths) {
      for (const w of m.weeks) {
        for (const c of w) {
          if (c && c.isLeave && c.checked && !c.isCancelled) {
            count++;
          }
        }
      }
    }
    return count;
  }

  get cancelledDateRangesStr(): string {
    const dates: string[] = [];
    for (const m of this.calMonths) {
      for (const w of m.weeks) {
        for (const c of w) {
          if (c && c.isLeave && !c.checked && !c.isCancelled) {
            dates.push(c.date);
          }
        }
      }
    }
    if (dates.length === 0) return '';
    dates.sort();
    return dates.map(d => this.formatDisplayDate(d)).join(', ');
  }

  onModeChange() {
    if (this.isPartialMode) {
      // Default: leave all checked so user unchecks the days they want cancelled
      for (const m of this.calMonths) {
        for (const w of m.weeks) {
          for (const c of w) {
            if (c && c.isLeave) c.checked = true;
          }
        }
      }
    }
  }

  toggleDay(cell: CalDay) {
    if (!this.isPartialMode || !cell.isLeave || cell.isCancelled) return;
    cell.checked = !cell.checked;
  }

  loadHolidaysAndBuild() {
    const fromYear = new Date(this.leave.fromDate).getFullYear();
    const toYear = new Date(this.leave.toDate).getFullYear();
    this.http.get<HolidayDto[]>(`${API_BASE}/holidays?year=${fromYear}`).subscribe({
      next: list => {
        this.holidays = list || [];
        this.buildCalendar();
      },
      error: () => {
        this.holidays = [];
        this.buildCalendar();
      }
    });
  }

  buildCalendar() {
    this.calMonths = [];
    const fromDt = this.parseLocalDate(this.leave.fromDate);
    const toDt = this.parseLocalDate(this.leave.toDate);

    let curYear = fromDt.getFullYear();
    let curMonth = fromDt.getMonth(); // 0-indexed
    const endYear = toDt.getFullYear();
    const endMonth = toDt.getMonth();

    while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
      const monthCal = this.generateMonthGrid(curYear, curMonth, fromDt, toDt);
      this.calMonths.push(monthCal);
      curMonth++;
      if (curMonth > 11) {
        curMonth = 0;
        curYear++;
      }
    }
  }

  generateMonthGrid(year: number, month: number, leaveFrom: Date, leaveTo: Date): CalMonth {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = this.getLocalDateString(new Date());

    const isPrevCancelled = (dtStr: string): boolean => {
      if (!this.leave.isCancellationApproved && this.leave.status !== 'PartiallyCancelled') return false;
      if (!this.leave.cancellationFromDate || !this.leave.cancellationToDate) return false;
      const cFrom = this.leave.cancellationFromDate.split('T')[0];
      const cTo = this.leave.cancellationToDate.split('T')[0];
      return dtStr >= cFrom && dtStr <= cTo;
    };

    const days: (CalDay | null)[] = [];
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = Mon
    for (let p = 0; p < firstDow; p++) days.push(null);

    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d);
      const dtStr = this.getLocalDateString(dt);
      const isSun = dt.getDay() === 0;
      const isSat = dt.getDay() === 6;

      const isInsideLeave = dt >= leaveFrom && dt <= leaveTo;
      const holiday = this.holidays.find(h => {
        const hStart = h.startDate.split('T')[0];
        const hEnd = h.endDate.split('T')[0];
        return dtStr >= hStart && dtStr <= hEnd;
      });

      const alreadyCancelled = isPrevCancelled(dtStr);

      days.push({
        date: dtStr,
        day: d,
        isLeave: isInsideLeave && !alreadyCancelled,
        checked: true,
        isSunday: isSun,
        isSat: isSat,
        isToday: dtStr === todayStr,
        isHoliday: !!holiday,
        holidayTitle: holiday?.name,
        isCancelled: alreadyCancelled
      });
    }

    const weeks: (CalDay | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      const chunk = days.slice(i, i + 7);
      while (chunk.length < 7) chunk.push(null);
      weeks.push(chunk);
    }

    return {
      label: `${MONTH_NAMES[month]} ${year}`,
      year,
      month,
      weeks
    };
  }

  parseLocalDate(dStr: string): Date {
    const parts = dStr.split('T')[0].split('-');
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }

  getLocalDateString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  formatDisplayDate(dStr: string): string {
    if (!dStr) return '';
    const dt = this.parseLocalDate(dStr);
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  cancel() {
    this.dialogRef.close();
  }

  submit() {
    if (this.form.invalid) return;

    const isPartial = this.isPartialMode;
    let cFrom: string | null = null;
    let cTo: string | null = null;

    if (isPartial) {
      const cancelledDates: string[] = [];
      for (const m of this.calMonths) {
        for (const w of m.weeks) {
          for (const c of w) {
            if (c && c.isLeave && !c.checked && !c.isCancelled) {
              cancelledDates.push(c.date);
            }
          }
        }
      }
      if (cancelledDates.length === 0) return;
      cancelledDates.sort();
      cFrom = cancelledDates[0];
      cTo = cancelledDates[cancelledDates.length - 1];
    }

    this.submitting = true;
    const payload = {
      isPartialCancellation: isPartial,
      cancellationFromDate: cFrom,
      cancellationToDate: cTo,
      reason: this.form.get('reason')?.value?.trim()
    };

    this.http.post(`${API_BASE}/studentleaves/${this.leave.id}/request-cancellation`, payload).subscribe({
      next: (res: any) => {
        this.submitting = false;
        this.dialogRef.close({ success: true, message: res?.message || 'Cancellation request submitted.' });
      },
      error: err => {
        this.submitting = false;
        alert(err?.error?.message || 'Failed to submit cancellation request.');
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// 2. REVIEW STUDENT LEAVE CANCELLATION DIALOG (APPROVE / REJECT)
// ═══════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-review-student-leave-cancel-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule,
    MatIconModule, MatFormFieldModule, MatInputModule, MatTooltipModule
  ],
  template: `
    <div class="fd-dialog-md">

      <!-- Header (Strict Light-Blue Gradient) -->
      <div class="fd-dialog-header">
        <div class="fd-dialog-icon"><mat-icon>rule</mat-icon></div>
        <div class="fd-dialog-title-group">
          <h2 class="fd-dialog-title">Review Student Leave Cancellation</h2>
          <span class="fd-dialog-sub">
            {{leave.studentName}} &bull; Roll: <strong>{{leave.rollNumber}}</strong>
            <span *ngIf="leave.className"> &bull; {{leave.className}}</span>
          </span>
        </div>
        <button mat-icon-button class="fd-dialog-close" (click)="dialogRef.close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="fd-dialog-body">

        <!-- Banner of requested dates -->
        <div class="review-banner">
          <div class="rev-row">
            <span class="rev-k">Original Sanctioned Leave:</span>
            <span class="rev-v">
              <strong>{{formatDisplay(leave.fromDate)}}</strong> to <strong>{{formatDisplay(leave.toDate)}}</strong>
              ({{leave.totalDays}} days &bull; {{leave.leaveCategory}})
            </span>
          </div>
          <div class="rev-row highlight">
            <span class="rev-k">Cancellation Scope:</span>
            <span class="rev-v">
              <strong *ngIf="!leave.isPartialCancellation">Full Cancellation (All Days)</strong>
              <strong *ngIf="leave.isPartialCancellation" style="color:#b91c1c;">
                Partial: {{formatDisplay(leave.cancellationFromDate)}} to {{formatDisplay(leave.cancellationToDate)}}
              </strong>
            </span>
          </div>
          <div class="rev-row" *ngIf="leave.cancellationReason">
            <span class="rev-k">Parent / Student Reason:</span>
            <span class="rev-v"><em>"{{leave.cancellationReason}}"</em></span>
          </div>
          <div class="rev-row" *ngIf="leave.cancellationRequestedAt">
            <span class="rev-k">Requested On:</span>
            <span class="rev-v">{{leave.cancellationRequestedAt | date:'dd-MMM-yyyy, hh:mm a'}}</span>
          </div>
        </div>

        <!-- Remarks Input -->
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Class Teacher / Admin Remarks (Optional)</mat-label>
          <textarea matInput [(ngModel)]="remarks" rows="3"
                    placeholder="e.g. Verified student returned to school. Attendance register synced."></textarea>
        </mat-form-field>

        <div class="review-note">
          <mat-icon>info</mat-icon>
          <span>
            <strong>Note:</strong> Approving will remove the 'L' (Leave) status from the student attendance register for the cancelled date(s), allowing the student to be marked Present.
          </span>
        </div>

      </div>

      <!-- Action Buttons -->
      <div class="fd-dialog-actions space-between">
        <button mat-stroked-button color="warn" [disabled]="submitting" (click)="review(false)">
          <mat-icon>cancel</mat-icon> Reject Cancellation
        </button>
        <div class="right-btns">
          <button mat-stroked-button type="button" (click)="dialogRef.close()">Cancel</button>
          <button mat-raised-button color="primary" [disabled]="submitting" (click)="review(true)" style="background:#16a34a;color:#fff;">
            <mat-icon>check_circle</mat-icon> Approve Cancellation
          </button>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .fd-dialog-md {
      width: 100%;
      max-width: 620px;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .fd-dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      .fd-dialog-icon {
        background: #2563eb;
        color: #ffffff;
        border-radius: 10px;
        box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        mat-icon { font-size: 22px; width: 22px; height: 22px; }
      }
      .fd-dialog-title-group {
        flex: 1;
        .fd-dialog-title {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          color: #1e3a8a;
        }
        .fd-dialog-sub {
          font-size: 0.82rem;
          color: #3b82f6;
          margin-top: 2px;
          display: block;
        }
      }
      .fd-dialog-close {
        color: #64748b;
        &:hover { color: #1e293b; background: #e2e8f0; }
      }
    }
    .fd-dialog-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .review-banner {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 0.86rem;
      .rev-row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        .rev-k { color: #64748b; font-weight: 600; }
        .rev-v { color: #1e293b; text-align: right; }
        &.highlight {
          background: #eff6ff;
          padding: 6px 10px;
          border-radius: 6px;
          border: 1px solid #bfdbfe;
        }
      }
    }
    .w-100 { width: 100%; }
    .review-note {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 6px;
      background: #fefce8;
      border: 1px solid #fef08a;
      color: #854d0e;
      font-size: 0.78rem;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #ca8a04; flex-shrink: 0; }
    }
    .fd-dialog-actions {
      padding: 12px 20px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      display: flex;
      align-items: center;
      &.space-between { justify-content: space-between; }
      .right-btns { display: flex; gap: 8px; }
      button { font-weight: 600; border-radius: 6px; }
    }
  `]
})
export class ReviewStudentLeaveCancellationDialogComponent {
  leave: StudentLeaveDto;
  remarks = '';
  submitting = false;

  constructor(
    private http: HttpClient,
    public dialogRef: MatDialogRef<ReviewStudentLeaveCancellationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { leave: StudentLeaveDto }
  ) {
    this.leave = data.leave;
  }

  formatDisplay(d?: string): string {
    if (!d) return '—';
    const parts = d.split('T')[0].split('-');
    const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  review(approve: boolean) {
    this.submitting = true;
    const payload = {
      approve,
      reviewRemarks: this.remarks?.trim() || null
    };

    this.http.put(`${API_BASE}/studentleaves/${this.leave.id}/review-cancellation`, payload).subscribe({
      next: (res: any) => {
        this.submitting = false;
        this.dialogRef.close({ success: true, message: res?.message || 'Cancellation reviewed.' });
      },
      error: err => {
        this.submitting = false;
        alert(err?.error?.message || 'Failed to review cancellation.');
      }
    });
  }
}
