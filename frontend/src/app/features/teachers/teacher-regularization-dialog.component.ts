import { Component, Inject, OnInit, inject } from '@angular/core';
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
import { AuthService } from '../../core/services/auth.service';
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
    MatTooltipModule
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
        <button mat-icon-button class="reg-dialog-close" (click)="cancel()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-progress-bar *ngIf="loadingPolicy || saving" mode="indeterminate" class="reg-loader"></mat-progress-bar>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="reg-dialog-body">

          <!-- Policy Guidance Banner -->
          <div class="policy-notice" *ngIf="policy">
            <mat-icon>info</mat-icon>
            <div>
              <strong>Regularization Guidelines:</strong> Requests must be submitted within 
              <strong>{{policy.maxRegularizationDaysBackdated}} days</strong> of the occurrence. 
              Maximum <strong>{{policy.maxRegularizationPerMonth}} requests</strong> allowed per calendar month.
            </div>
          </div>

          <!-- Error Alert Banner -->
          <div class="error-banner" *ngIf="errorMessage">
            <mat-icon>error</mat-icon>
            <span>{{errorMessage}}</span>
          </div>

          <!-- Faculty Member Selector (Only shown for Admin/HR applying on behalf of a teacher) -->
          <mat-form-field appearance="outline" class="w-full" *ngIf="!isTeacherSelf">
            <mat-label>Faculty Member *</mat-label>
            <mat-select formControlName="teacherId">
              <mat-option *ngFor="let t of teachers" [value]="t.id">
                {{t.fullName}} ({{t.employeeCode}}){{t.department ? ' — ' + t.department : ''}}
              </mat-option>
            </mat-select>
            <mat-hint>Select active faculty member for regularization</mat-hint>
          </mat-form-field>

          <!-- Self Faculty Profile Display (Shown for Teacher self-apply) -->
          <div class="self-strip" *ngIf="isTeacherSelf">
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

          <!-- Date & Requested Status Row -->
          <div class="form-row">
            <mat-form-field appearance="outline" class="form-col">
              <mat-label>Occurrence Date *</mat-label>
              <input matInput type="date" formControlName="attendanceDate" [max]="todayStr" />
              <mat-hint *ngIf="!isSundaySelected">Date when punch was missed or incorrect ({{selectedDayName}})</mat-hint>
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
          <div class="sunday-alert-banner" *ngIf="isSundaySelected">
            <div class="sab-icon"><mat-icon>event_busy</mat-icon></div>
            <div class="sab-content">
              <strong>Weekly Off / Sunday Detected ({{selectedDateFormatted}}):</strong>
              <span>Attendance regularization cannot be requested on a Sunday or official weekly off. Please select a valid working day when duty or classes took place.</span>
            </div>
          </div>

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
            <button type="button" class="quick-chip" (click)="setReason('Forgot to punch in / out')">
              ⏱️ Forgot to Punch
            </button>
            <button type="button" class="quick-chip" (click)="setReason('Biometric device offline / Fingerprint read failure')">
              ⚠️ Biometric Machine Failure
            </button>
            <button type="button" class="quick-chip" (click)="setReason('Official School Tour / Field Duty (OD)')">
              🚌 Official Duty / Tour
            </button>
            <button type="button" class="quick-chip" (click)="setReason('Board / University Examination Duty')">
              📝 Exam Duty
            </button>
            <button type="button" class="quick-chip" (click)="setReason('Marked absent erroneously in manual roll-call')">
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
          <button mat-stroked-button type="button" (click)="cancel()">Cancel</button>
          <button mat-flat-button class="btn-submit" type="submit" 
            [disabled]="saving || form.invalid || isSundaySelected"
            [matTooltip]="isSundaySelected ? 'Cannot submit regularization on a Sunday / Weekly Off' : ''">
            <mat-icon>{{saving ? 'hourglass_empty' : 'send'}}</mat-icon>
            {{saving ? 'Submitting...' : 'Submit Regularization Request'}}
          </button>
        </div>
      </form>
    </div>
  `,
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
  isSundaySelected = false;
  selectedDayName = '';
  selectedDateFormatted = '';
  policy: LeavePolicySettingsDto | null = null;
  teachers: TeacherDto[] = [];
  isTeacherSelf = false;
  myProfile: any = null;

  getSmartDefaultDate(): string {
    const d = new Date();
    // If today is Sunday (day 0), default to Saturday (previous day)
    if (d.getDay() === 0) {
      d.setDate(d.getDate() - 1);
    }
    return d.toISOString().split('T')[0];
  }

  checkOccurrenceDate(dateStr: string): void {
    if (!dateStr) {
      this.isSundaySelected = false;
      this.selectedDayName = '';
      this.selectedDateFormatted = '';
      return;
    }
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) {
      this.isSundaySelected = false;
      return;
    }
    const day = d.getDay(); // 0 is Sunday
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    this.selectedDayName = dayNames[day];
    this.selectedDateFormatted = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    this.isSundaySelected = (day === 0);
  }

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private dialogRef: MatDialogRef<ApplyTeacherRegularizationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      preSelectTeacherId?: string;
      targetTeacherId?: string;
      preSelectDate?: string;
      targetDate?: string;
      isTeacherSelf?: boolean;
      isTeacher?: boolean;
      myProfile?: any;
      teachers?: TeacherDto[];
    }
  ) {
    this.isTeacherSelf = this.authService.isTeacher() || !!(data?.isTeacherSelf || data?.isTeacher);
    this.myProfile = data?.myProfile || null;
    this.teachers = (data?.teachers || []).filter(t => t.isActive !== false && !t.leavingDate);
  }

  ngOnInit(): void {
    const defaultDate = this.data?.preSelectDate || this.data?.targetDate || this.getSmartDefaultDate();
    const defaultTeacherId = this.isTeacherSelf
      ? (this.myProfile?.id || '')
      : (this.data?.preSelectTeacherId || this.data?.targetTeacherId || (this.teachers.length > 0 ? this.teachers[0].id : ''));

    this.form = this.fb.group({
      teacherId: [defaultTeacherId, Validators.required],
      attendanceDate: [defaultDate, Validators.required],
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

    if (this.isTeacherSelf) {
      if (!this.myProfile?.id) {
        this.http.get<any>(`${API_BASE}/teachers/my-profile`).subscribe({
          next: p => {
            if (p?.isLinked) {
              this.myProfile = p;
              this.form.patchValue({ teacherId: p.id });
            }
          },
          error: () => {}
        });
      } else {
        this.form.patchValue({ teacherId: this.myProfile.id });
      }
    } else {
      // Admin Mode: Load active teachers (excluding F&F settled / inactive)
      if (this.teachers.length === 0) {
        this.http.get<TeacherDto[]>(`${API_BASE}/teachers?activeOnly=true`).subscribe({
          next: list => {
            this.teachers = list.filter(t => t.isActive !== false && !t.leavingDate);
            if (!this.form.get('teacherId')?.value && this.teachers.length > 0) {
              this.form.patchValue({ teacherId: this.teachers[0].id });
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
    if (this.form.invalid) return;
    this.saving = true;
    this.errorMessage = '';

    const payload = this.form.value;
    this.http.post(`${API_BASE}/teachers/regularizations`, payload).subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close(true);
      },
      error: err => {
        this.saving = false;
        this.errorMessage = err.error?.message || 'Failed to submit regularization request. Please check limits.';
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
        <div class="reg-dialog-icon">
          <mat-icon>{{data.approve ? 'check_circle' : 'cancel'}}</mat-icon>
        </div>
        <div class="reg-dialog-title-group">
          <h2 class="reg-dialog-title">
            {{data.approve ? 'Approve Attendance Regularization' : 'Reject Regularization Request'}}
          </h2>
          <span class="reg-dialog-sub">
            {{data.regularization.teacherName}} ({{data.regularization.employeeCode}}) • 
            <strong>{{data.regularization.attendanceDate | date:'dd MMM yyyy'}}</strong>
          </span>
        </div>
        <button mat-icon-button class="reg-dialog-close" (click)="cancel()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-progress-bar *ngIf="saving" mode="indeterminate" class="reg-loader"></mat-progress-bar>

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
          <div class="info-row" *ngIf="data.regularization.requestedCheckIn || data.regularization.requestedCheckOut">
            <span class="lbl">Timestamps:</span>
            <span class="val">{{data.regularization.requestedCheckIn || '—'}} to {{data.regularization.requestedCheckOut || '—'}}</span>
          </div>
          <div class="info-row">
            <span class="lbl">Reason Given:</span>
            <span class="val">{{data.regularization.reason}}</span>
          </div>
          <div class="info-row" *ngIf="data.regularization.attachmentUrl">
            <span class="lbl">Attachment:</span>
            <span class="val">
              <a [href]="data.regularization.attachmentUrl" target="_blank" rel="noopener noreferrer" class="link-btn">
                View Attached Document ↗
              </a>
            </span>
          </div>
        </div>

        <mat-form-field appearance="outline" class="w-full" style="margin-top: 10px;">
          <mat-label>{{data.approve ? 'Approval Remarks (Optional)' : 'Rejection Reason *'}}</mat-label>
          <textarea matInput [(ngModel)]="remarks" rows="3" 
            [placeholder]="data.approve ? 'Optional sanction notes for records...' : 'State reason for rejecting regularization...'"></textarea>
        </mat-form-field>

        <div class="error-banner" *ngIf="errorMessage">
          <mat-icon>error</mat-icon>
          <span>{{errorMessage}}</span>
        </div>
      </div>

      <div class="reg-dialog-footer">
        <button mat-stroked-button (click)="cancel()">Cancel</button>
        <button mat-flat-button [color]="data.approve ? 'primary' : 'warn'" 
          (click)="confirm()" [disabled]="saving || (!data.approve && !remarks.trim())">
          <mat-icon>{{data.approve ? 'done_all' : 'block'}}</mat-icon>
          {{saving ? 'Processing...' : (data.approve ? 'Approve & Update Attendance' : 'Reject Request')}}
        </button>
      </div>
    </div>
  `,
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
      approve: boolean;
    }
  ) {}

  confirm(): void {
    if (!this.data.approve && !this.remarks.trim()) return;
    this.saving = true;
    this.errorMessage = '';

    this.http.put(`${API_BASE}/teachers/regularizations/${this.data.regularization.id}/review`, {
      approve: this.data.approve,
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
