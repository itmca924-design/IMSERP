import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { API_BASE, LeaveDto, RequestLeaveCancellationDto, ReviewLeaveCancellationDto } from './teacher.models';

// ═══════════════════════════════════════════════════════════════════
// 1. REQUEST LEAVE CANCELLATION DIALOG (FULL OR PARTIAL DATES)
// ═══════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-request-leave-cancellation-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatRadioModule
  ],
  template: `
    <div class="fd-dialog-md">
      <!-- Strict Light Blue Header Rule -->
      <div class="fd-dialog-header">
        <div class="fd-dialog-icon">
          <mat-icon>event_busy</mat-icon>
        </div>
        <div class="fd-dialog-title-group">
          <h2 class="fd-dialog-title">Request Leave Cancellation</h2>
          <span class="fd-dialog-sub">
            {{leave.teacherName}} ({{leave.employeeCode}}) • <strong>{{formatLeaveType(leave.leaveType)}}</strong>
          </span>
        </div>
        <button mat-icon-button class="fd-dialog-close" (click)="cancel()"><mat-icon>close</mat-icon></button>
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="fd-dialog-body">

          <!-- Original Leave Summary Banner -->
          <div class="leave-overview-card">
            <div class="overview-header">
              <span class="overview-title"><mat-icon>date_range</mat-icon> Current Sanctioned Period</span>
              <span class="overview-days-badge">{{leave.totalDays}} Total Day(s)</span>
            </div>
            <div class="overview-meta">
              <span>Dates: <strong>{{leave.fromDate | date:'dd MMM yyyy'}}</strong> to <strong>{{leave.toDate | date:'dd MMM yyyy'}}</strong></span>
              <span *ngIf="leave.reason">Reason: <em>"{{leave.reason}}"</em></span>
            </div>
          </div>

          <!-- Cancellation Mode Selector -->
          <div class="cancellation-mode-box">
            <label class="mode-label">Cancellation Type *</label>
            <mat-radio-group formControlName="cancellationType" (change)="onModeChange()" class="mode-radio-group">
              <mat-radio-button value="full" color="primary">
                <div class="radio-content">
                  <strong>Cancel Entire Leave</strong>
                  <span>Revoke all {{leave.totalDays}} days (Full restoration to working roster & leave quota)</span>
                </div>
              </mat-radio-button>

              <mat-radio-button value="partial" color="primary">
                <div class="radio-content">
                  <strong>Partial Date Cancellation</strong>
                  <span>Cancel only a specific date range (e.g. reported back early or shortened leave)</span>
                </div>
              </mat-radio-button>
            </mat-radio-group>
          </div>

          <!-- Partial Date Range Inputs (Shown when partial selected) -->
          <div class="partial-dates-wrap" *ngIf="form.get('cancellationType')?.value === 'partial'">
            <div class="form-row">
              <mat-form-field appearance="outline" class="form-col">
                <mat-label>Cancel From Date *</mat-label>
                <input matInput type="date" formControlName="cancelFromDate"
                  [min]="minDate" [max]="maxDate" (change)="calcPartialDays()" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="form-col">
                <mat-label>Cancel To Date *</mat-label>
                <input matInput type="date" formControlName="cancelToDate"
                  [min]="form.get('cancelFromDate')?.value || minDate" [max]="maxDate" (change)="calcPartialDays()" />
              </mat-form-field>
            </div>

            <!-- Date range error banner -->
            <div class="date-error-banner" *ngIf="form.hasError('dateRangeInvalid')">
              <mat-icon>warning</mat-icon>
              <span>"Cancel To Date" must be on or after "Cancel From Date".</span>
            </div>

            <!-- Partial Calculation Preview Pill -->
            <div class="partial-preview-pill" *ngIf="cancelDaysCount > 0 && !form.hasError('dateRangeInvalid')">
              <div class="preview-item cancel-item">
                <mat-icon>cancel</mat-icon>
                <span>Cancelling: <strong>{{cancelDaysCount}} Day(s)</strong></span>
              </div>
              <div class="preview-sep">➔</div>
              <div class="preview-item remain-item">
                <mat-icon>check_circle</mat-icon>
                <span>Remaining Sanctioned: <strong>{{remainDaysCount}} Day(s)</strong></span>
              </div>
            </div>
          </div>

          <!-- Reason for cancellation -->
          <mat-form-field appearance="outline" class="fd-field-full">
            <mat-label>Reason for Cancellation *</mat-label>
            <textarea matInput formControlName="reason" rows="3"
              placeholder="e.g. Personal work finished early, tour got rescheduled, reported back on duty..."></textarea>
          </mat-form-field>

          <!-- Policy Notice -->
          <div class="policy-notice-box">
            <mat-icon>info</mat-icon>
            <div>
              <strong>Audit & Roster Impact:</strong> Once the cancellation is approved by Administration, the selected date(s) will be removed from leave registers, restored to working attendance, and your deducted leave balance will be credited back.
            </div>
          </div>

          <!-- Backend Error Banner -->
          <div class="error-banner" *ngIf="backendError">
            <mat-icon>error_outline</mat-icon>
            <span>{{backendError}}</span>
          </div>

        </div>

        <div class="fd-dialog-footer">
          <button mat-stroked-button type="button" (click)="cancel()">Cancel</button>
          <button mat-flat-button color="warn" type="submit" [disabled]="form.invalid || saving">
            <mat-icon>send</mat-icon>
            {{saving ? 'Submitting Request...' : 'Submit Cancellation Request'}}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .fd-dialog-md { width: 100%; max-width: 560px; box-sizing: border-box; }
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
    .fd-dialog-sub strong { color: #1e40af; }
    .fd-dialog-title-group { flex: 1; min-width: 0; }
    .fd-dialog-close { color: #64748b; margin-left: auto; flex-shrink: 0; }
    .fd-dialog-body { padding: 18px 24px; display: flex; flex-direction: column; gap: 14px; box-sizing: border-box; }
    .fd-dialog-footer { display: flex; gap: 12px; justify-content: flex-end; padding: 14px 24px; border-top: 1px solid #e2e8f0; }
    .fd-field-full { width: 100%; display: block; }
    .form-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .form-col { flex: 1; min-width: 140px; }

    .leave-overview-card {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px;
      display: flex; flex-direction: column; gap: 6px;
    }
    .overview-header { display: flex; justify-content: space-between; align-items: center; }
    .overview-title { display: inline-flex; align-items: center; gap: 6px; font-size: 0.82rem; font-weight: 700; color: #1e293b; }
    .overview-title mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2563eb; }
    .overview-days-badge {
      background: #eff6ff; color: #1e40af; font-weight: 700; font-size: 0.76rem;
      padding: 3px 8px; border-radius: 6px; border: 1px solid #bfdbfe;
    }
    .overview-meta { display: flex; flex-direction: column; gap: 4px; font-size: 0.78rem; color: #64748b; }
    .overview-meta strong { color: #0f172a; }

    .cancellation-mode-box {
      border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 14px; background: #fff;
    }
    .mode-label { font-size: 0.78rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.3px; display: block; margin-bottom: 8px; }
    .mode-radio-group { display: flex; flex-direction: column; gap: 10px; }
    .radio-content { display: flex; flex-direction: column; gap: 2px; margin-left: 6px; }
    .radio-content strong { font-size: 0.84rem; color: #1e293b; }
    .radio-content span { font-size: 0.74rem; color: #64748b; }

    .partial-dates-wrap {
      background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 12px 14px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .partial-preview-pill {
      display: flex; align-items: center; justify-content: space-around;
      background: #fff; border: 1px solid #fcd34d; border-radius: 8px; padding: 8px 12px;
      font-size: 0.8rem;
    }
    .preview-item { display: inline-flex; align-items: center; gap: 5px; }
    .preview-item mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .cancel-item { color: #dc2626; }
    .remain-item { color: #16a34a; }
    .preview-sep { color: #94a3b8; font-weight: 700; }

    .policy-notice-box {
      display: flex; gap: 10px; align-items: flex-start;
      background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;
      padding: 10px 14px; font-size: 0.78rem; color: #1e40af; line-height: 1.4;
    }
    .policy-notice-box mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; flex-shrink: 0; }

    .date-error-banner, .error-banner {
      display: flex; align-items: center; gap: 8px; background: #fef2f2;
      border: 1px solid #fecaca; border-radius: 8px; padding: 8px 12px;
      font-size: 0.8rem; color: #b91c1c;
    }
    .date-error-banner mat-icon, .error-banner mat-icon { font-size: 18px; width: 18px; height: 18px; color: #ef4444; flex-shrink: 0; }

    @media (max-width: 520px) {
      .fd-dialog-header { padding: 14px 16px 12px; }
      .fd-dialog-body { padding: 14px 16px; gap: 10px; }
      .form-row { flex-direction: column; gap: 8px; }
      .form-col { min-width: 100%; }
      .fd-dialog-footer { padding: 10px 16px; }
      .fd-dialog-footer button { flex: 1; }
    }
  `]
})
export class RequestLeaveCancellationDialogComponent implements OnInit {
  leave: LeaveDto;
  form!: FormGroup;
  saving = false;
  backendError = '';
  minDate = '';
  maxDate = '';
  cancelDaysCount = 0;
  remainDaysCount = 0;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private dialogRef: MatDialogRef<RequestLeaveCancellationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { leave: LeaveDto }
  ) {
    this.leave = data.leave;
  }

  ngOnInit() {
    this.minDate = this.leave.fromDate.substring(0, 10);
    this.maxDate = this.leave.toDate.substring(0, 10);

    this.form = this.fb.group({
      cancellationType: ['full', Validators.required],
      cancelFromDate: [this.minDate],
      cancelToDate: [this.maxDate],
      reason: ['', Validators.required]
    }, {
      validators: [this.dateRangeValidator]
    });

    this.calcPartialDays();
  }

  formatLeaveType(type: string): string {
    if (!type) return 'Leave';
    return type.replace(/([A-Z])/g, ' $1').trim();
  }

  onModeChange() {
    const mode = this.form.get('cancellationType')?.value;
    if (mode === 'full') {
      this.form.patchValue({
        cancelFromDate: this.minDate,
        cancelToDate: this.maxDate
      });
      this.cancelDaysCount = this.leave.totalDays;
      this.remainDaysCount = 0;
    } else {
      this.calcPartialDays();
    }
  }

  calcPartialDays() {
    const from = this.form.get('cancelFromDate')?.value;
    const to = this.form.get('cancelToDate')?.value;
    if (from && to && to >= from) {
      const d1 = new Date(from);
      const d2 = new Date(to);
      const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      this.cancelDaysCount = Math.min(diff, this.leave.totalDays);
      this.remainDaysCount = Math.max(0, this.leave.totalDays - this.cancelDaysCount);
    } else {
      this.cancelDaysCount = 0;
      this.remainDaysCount = this.leave.totalDays;
    }
  }

  dateRangeValidator(control: AbstractControl): ValidationErrors | null {
    const type = control.get('cancellationType')?.value;
    if (type === 'partial') {
      const from = control.get('cancelFromDate')?.value;
      const to = control.get('cancelToDate')?.value;
      if (from && to && to < from) {
        return { dateRangeInvalid: true };
      }
    }
    return null;
  }

  submit() {
    if (this.form.invalid) return;
    this.saving = true;
    this.backendError = '';

    const isPartial = this.form.get('cancellationType')?.value === 'partial';
    const payload: RequestLeaveCancellationDto = {
      isPartialCancellation: isPartial,
      cancelFromDate: isPartial ? this.form.get('cancelFromDate')?.value : undefined,
      cancelToDate: isPartial ? this.form.get('cancelToDate')?.value : undefined,
      reason: this.form.get('reason')?.value
    };

    this.http.post(`${API_BASE}/teachers/leaves/${this.leave.id}/request-cancellation`, payload).subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close(true);
      },
      error: err => {
        this.saving = false;
        this.backendError = err.error?.message || 'Failed to submit cancellation request.';
      }
    });
  }

  cancel() { this.dialogRef.close(false); }
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
    .btn-cancel-flat:hover {
      background: #f1f5f9 !important; color: #1e293b !important;
    }
    .btn-smart-reject {
      color: #dc2626 !important; border-color: #fca5a5 !important; background: #fff5f5 !important;
      font-weight: 600 !important; border-radius: 8px !important; padding: 0 16px !important;
      height: 38px !important; white-space: nowrap !important; transition: all 0.15s ease;
      display: inline-flex !important; align-items: center !important; gap: 6px !important;
    }
    .btn-smart-reject:hover {
      background: #fee2e2 !important; border-color: #f87171 !important; color: #b91c1c !important;
    }
    .btn-smart-reject mat-icon {
      font-size: 18px; width: 18px; height: 18px; color: #dc2626; margin: 0;
    }
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
    .btn-smart-approve mat-icon {
      font-size: 18px; width: 18px; height: 18px; color: #fff; margin: 0;
    }
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
    .badge-full { color: #dc2626; }
    .badge-partial { color: #d97706; }
    .reason-val { font-style: italic; color: #475569; }

    .error-banner {
      display: flex; align-items: center; gap: 8px; background: #fef2f2;
      border: 1px solid #fecaca; border-radius: 8px; padding: 8px 12px;
      font-size: 0.8rem; color: #b91c1c;
    }
    .error-banner mat-icon { font-size: 18px; width: 18px; height: 18px; color: #ef4444; flex-shrink: 0; }

    @media (max-width: 520px) {
      .fd-dialog-header { padding: 14px 16px 12px; }
      .fd-dialog-body { padding: 14px 16px; gap: 10px; }
      .fd-dialog-footer { padding: 10px 16px; flex-direction: column-reverse; gap: 8px; }
      .footer-actions { width: 100%; flex-direction: column; gap: 8px; }
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
