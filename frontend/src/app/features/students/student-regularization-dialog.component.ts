import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';

const API_BASE = 'http://localhost:5000/api';

export interface StudentRegularizationDialogData {
  studentId?: string;
  studentName?: string;
  rollNumber?: string;
  className?: string;
  sectionName?: string;
  attendanceDate?: string;
}

export interface StudentAttendanceRegularizationDto {
  id: string;
  tenantId: string;
  branchId?: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  attendanceDate: string;
  requestedStatus: string;
  reasonCategory: string;
  reason: string;
  attachmentUrl?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
  appliedBy: string;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════
// 1. APPLY STUDENT ATTENDANCE REGULARIZATION DIALOG
// ═══════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-apply-student-regularization-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatTooltipModule, MatProgressBarModule
  ],
  template: `
    <div class="fd-dialog-md">
      <!-- Header (Light Blue Gradient Matching ERP Rule) -->
      <div class="fd-dialog-header">
        <div class="fd-dialog-icon"><mat-icon>edit_calendar</mat-icon></div>
        <div class="fd-dialog-title-group">
          <h2 class="fd-dialog-title">Request Attendance Regularization</h2>
          <span class="fd-dialog-sub">
            Submit a correction or On-Duty (OD) request for a past date to be verified by Class Teacher
          </span>
        </div>
        <button mat-icon-button class="fd-dialog-close" (click)="dialogRef.close(false)" type="button">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-progress-bar mode="indeterminate" *ngIf="submitting"></mat-progress-bar>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="fd-dialog-body">

          <!-- Student Profile Summary Pill -->
          <div class="student-info-pill" *ngIf="preselectedStudent">
            <div class="pill-avatar">{{ getInitials(preselectedStudent.studentName) }}</div>
            <div class="pill-details">
              <strong>{{ preselectedStudent.studentName }}</strong>
              <small>Roll No: {{ preselectedStudent.rollNumber }} &bull; Class: {{ preselectedStudent.className || 'General' }} {{ preselectedStudent.sectionName ? '(' + preselectedStudent.sectionName + ')' : '' }}</small>
            </div>
            <span class="locked-badge"><mat-icon>verified</mat-icon> Selected</span>
          </div>

          <!-- Student Selector (if not preselected) -->
          <mat-form-field appearance="outline" class="w-100" *ngIf="!preselectedStudent">
            <mat-label>Select Student *</mat-label>
            <mat-select formControlName="studentId">
              <mat-option *ngFor="let s of studentsList" [value]="s.id">
                {{ s.studentName }} (Roll: {{ s.rollNumber }}) - {{ s.className || '' }} {{ s.sectionName || '' }}
              </mat-option>
            </mat-select>
            <mat-error *ngIf="form.get('studentId')?.hasError('required')">Please select a student.</mat-error>
          </mat-form-field>

          <!-- Attendance Date & Category Row -->
          <div class="form-row">
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Attendance Date *</mat-label>
              <input matInput type="date" formControlName="attendanceDate" [max]="todayStr">
              <mat-error *ngIf="form.get('attendanceDate')?.hasError('required')">Date is required.</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Reason Category *</mat-label>
              <mat-select formControlName="reasonCategory">
                <mat-option value="OnDuty">🏆 On-Duty (OD) / Competition / Event</mat-option>
                <mat-option value="Medical">🩺 Medical Sickness / Certificate</mat-option>
                <mat-option value="RollCallError">📋 Roll Call Error (Present in Class)</mat-option>
                <mat-option value="PunchMiss">⏱️ RFID / Biometric Gate Miss</mat-option>
                <mat-option value="Other">📝 Other Valid Ground</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <!-- Requested Status & Document URL -->
          <div class="form-row">
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Requested Status *</mat-label>
              <mat-select formControlName="requestedStatus">
                <mat-option value="Present">Present</mat-option>
                <mat-option value="Late">Late Arrival</mat-option>
                <mat-option value="HalfDay">Half Day</mat-option>
                <mat-option value="Leave">Excused / Medical Leave</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Attachment / Proof URL (Optional)</mat-label>
              <input matInput formControlName="attachmentUrl" placeholder="https://... or certificate drive link">
              <mat-icon matSuffix>attachment</mat-icon>
            </mat-form-field>
          </div>

          <!-- Reason / Details -->
          <mat-form-field appearance="outline" class="w-100">
            <mat-label>Reason & Justification *</mat-label>
            <textarea matInput formControlName="reason" rows="3" placeholder="Provide detailed justification (e.g. participated in Inter-school basketball championship, was present in biology lab during roll call, etc.)"></textarea>
            <mat-error *ngIf="form.get('reason')?.hasError('required')">Reason is required for school records.</mat-error>
          </mat-form-field>

          <!-- Explanatory Notice -->
          <div class="info-alert-strip">
            <mat-icon>info</mat-icon>
            <div>
              <strong>Class Teacher Verification:</strong>
              <p>Once submitted, this request will appear in your Class Teacher's regularizations inbox. When approved, the attendance register will be automatically updated.</p>
            </div>
          </div>

          <!-- Error message -->
          <div class="error-msg-strip" *ngIf="errorMsg">
            <mat-icon>error_outline</mat-icon>
            <span>{{ errorMsg }}</span>
          </div>

        </div>

        <!-- Dialog Actions -->
        <div class="fd-dialog-actions">
          <button mat-stroked-button type="button" (click)="dialogRef.close(false)" [disabled]="submitting">Cancel</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || submitting">
            <mat-icon>{{ submitting ? 'hourglass_top' : 'send' }}</mat-icon>
            <span>{{ submitting ? 'Submitting...' : 'Submit Request' }}</span>
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .fd-dialog-md {
      width: 100%;
      max-width: 650px;
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
      gap: 14px;
      max-height: 70vh;
      overflow-y: auto;
    }
    .student-info-pill {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      .pill-avatar {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: #2563eb;
        color: #ffffff;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.9rem;
      }
      .pill-details {
        flex: 1;
        display: flex;
        flex-direction: column;
        strong { color: #0f172a; font-size: 0.95rem; }
        small { color: #64748b; font-size: 0.8rem; }
      }
      .locked-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        background: #e0f2fe;
        color: #0369a1;
        font-size: 0.75rem;
        font-weight: 600;
        border-radius: 9999px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
      }
    }
    .form-row {
      display: flex;
      gap: 14px;
    }
    .flex-1 { flex: 1; }
    .w-100 { width: 100%; }
    .info-alert-strip {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 14px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      mat-icon { color: #2563eb; font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; margin-top: 1px; }
      strong { color: #1e40af; font-size: 0.85rem; display: block; margin-bottom: 2px; }
      p { color: #3b82f6; font-size: 0.8rem; margin: 0; line-height: 1.35; }
    }
    .error-msg-strip {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #fee2e2;
      border: 1px solid #fca5a5;
      color: #991b1b;
      border-radius: 6px;
      font-size: 0.85rem;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .fd-dialog-actions {
      padding: 12px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
  `]
})
export class ApplyStudentRegularizationDialogComponent implements OnInit {
  form!: FormGroup;
  submitting = false;
  errorMsg = '';
  todayStr = new Date().toISOString().split('T')[0];
  preselectedStudent: StudentRegularizationDialogData | null = null;
  studentsList: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<ApplyStudentRegularizationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: StudentRegularizationDialogData | null,
    private fb: FormBuilder,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    if (this.data && this.data.studentId) {
      this.preselectedStudent = this.data;
    }

    const defaultDate = this.data?.attendanceDate || this.todayStr;

    this.form = this.fb.group({
      studentId: [this.preselectedStudent?.studentId || '', Validators.required],
      attendanceDate: [defaultDate, Validators.required],
      requestedStatus: ['Present', Validators.required],
      reasonCategory: ['OnDuty', Validators.required],
      reason: ['', [Validators.required, Validators.minLength(5)]],
      attachmentUrl: ['']
    });

    if (!this.preselectedStudent) {
      this.loadStudents();
    }
  }

  loadStudents(): void {
    this.http.get<any[]>(`${API_BASE}/students`).subscribe({
      next: (list) => {
        this.studentsList = list || [];
      },
      error: () => {
        this.studentsList = [];
      }
    });
  }

  getInitials(name?: string): string {
    if (!name) return 'ST';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  submit(): void {
    if (this.form.invalid) return;
    this.submitting = true;
    this.errorMsg = '';

    const payload = this.form.value;
    this.http.post(`${API_BASE}/student-regularizations`, payload).subscribe({
      next: (res) => {
        this.submitting = false;
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.submitting = false;
        this.errorMsg = err.error?.message || 'Failed to submit regularization request. Please check inputs.';
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// 2. REVIEW STUDENT ATTENDANCE REGULARIZATION DIALOG (TEACHER / ADMIN)
// ═══════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-review-student-regularization-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatTooltipModule, MatProgressBarModule
  ],
  template: `
    <div class="fd-dialog-md">
      <!-- Header -->
      <div class="fd-dialog-header">
        <div class="fd-dialog-icon"><mat-icon>fact_check</mat-icon></div>
        <div class="fd-dialog-title-group">
          <h2 class="fd-dialog-title">Review Attendance Regularization</h2>
          <span class="fd-dialog-sub">
            Verify student's justification &amp; approve attendance record update
          </span>
        </div>
        <button mat-icon-button class="fd-dialog-close" (click)="dialogRef.close(false)" type="button">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-progress-bar mode="indeterminate" *ngIf="submitting"></mat-progress-bar>

      <div class="fd-dialog-body">

        <!-- Student & Date Overview Card -->
        <div class="review-details-card">
          <div class="detail-row">
            <span class="lbl">Student:</span>
            <strong class="val student-val">{{ reg.studentName }} (Roll: {{ reg.rollNumber }})</strong>
          </div>
          <div class="detail-row" *ngIf="reg.className">
            <span class="lbl">Class & Section:</span>
            <span class="val">{{ reg.className }} {{ reg.sectionName ? '- Section ' + reg.sectionName : '' }}</span>
          </div>
          <div class="detail-row">
            <span class="lbl">Attendance Date:</span>
            <strong class="val date-val">{{ reg.attendanceDate | date:'EEEE, dd MMMM yyyy' }}</strong>
          </div>
          <div class="detail-row">
            <span class="lbl">Category:</span>
            <span class="cat-pill" [ngClass]="reg.reasonCategory.toLowerCase()">
              {{ getCategoryLabel(reg.reasonCategory) }}
            </span>
          </div>
          <div class="detail-row">
            <span class="lbl">Requested Status:</span>
            <span class="status-pill present">{{ reg.requestedStatus }}</span>
          </div>
          <div class="detail-row" *ngIf="reg.attachmentUrl">
            <span class="lbl">Supporting Proof:</span>
            <a [href]="reg.attachmentUrl" target="_blank" class="attachment-link">
              <mat-icon>open_in_new</mat-icon> View Attached Document
            </a>
          </div>
          <div class="reason-quote-box">
            <span class="quote-lbl">Student / Parent Justification:</span>
            <p class="quote-text">{{ reg.reason }}</p>
          </div>
        </div>

        <!-- Decision Selector -->
        <div class="decision-section">
          <label class="decision-lbl">Decision *</label>
          <div class="decision-buttons">
            <button type="button" class="decision-btn approve-btn" [class.selected]="decision === 'Approve'" (click)="decision = 'Approve'">
              <mat-icon>check_circle</mat-icon>
              <div>
                <strong>Approve Request</strong>
                <small>Updates attendance to {{ approvedStatus }}</small>
              </div>
            </button>
            <button type="button" class="decision-btn reject-btn" [class.selected]="decision === 'Reject'" (click)="decision = 'Reject'">
              <mat-icon>cancel</mat-icon>
              <div>
                <strong>Reject Request</strong>
                <small>Leaves attendance unchanged</small>
              </div>
            </button>
          </div>
        </div>

        <!-- Custom Status Override if Approved -->
        <mat-form-field appearance="outline" class="w-100" *ngIf="decision === 'Approve'">
          <mat-label>Final Attendance Status</mat-label>
          <mat-select [(ngModel)]="approvedStatus">
            <mat-option value="Present">Present (Default)</mat-option>
            <mat-option value="Late">Late Arrival</mat-option>
            <mat-option value="HalfDay">Half Day</mat-option>
            <mat-option value="Leave">Sanctioned Leave / OD</mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Remarks Input -->
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>{{ decision === 'Approve' ? 'Teacher Remarks (Optional)' : 'Rejection Reason *' }}</mat-label>
          <textarea matInput [(ngModel)]="reviewRemarks" rows="2" [placeholder]="decision === 'Approve' ? 'e.g. Verified with event coordinator, present confirmed.' : 'Please explain why this request is rejected...'"></textarea>
        </mat-form-field>

        <!-- Error Msg -->
        <div class="error-msg-strip" *ngIf="errorMsg">
          <mat-icon>error_outline</mat-icon>
          <span>{{ errorMsg }}</span>
        </div>

      </div>

      <!-- Dialog Actions -->
      <div class="fd-dialog-actions">
        <button mat-stroked-button type="button" (click)="dialogRef.close(false)" [disabled]="submitting">Dismiss</button>
        <button mat-raised-button
                [color]="decision === 'Approve' ? 'primary' : 'warn'"
                (click)="submitDecision()"
                [disabled]="submitting || (decision === 'Reject' && (!reviewRemarks || reviewRemarks.trim().length === 0))">
          <mat-icon>{{ submitting ? 'hourglass_top' : (decision === 'Approve' ? 'check' : 'close') }}</mat-icon>
          <span>{{ submitting ? 'Processing...' : (decision === 'Approve' ? 'Confirm Approval' : 'Confirm Rejection') }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .fd-dialog-md {
      width: 100%;
      max-width: 600px;
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
      gap: 14px;
      max-height: 70vh;
      overflow-y: auto;
    }
    .review-details-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      .detail-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.88rem;
        .lbl { color: #64748b; }
        .val { color: #0f172a; }
        .student-val { font-size: 0.95rem; color: #1e3a8a; }
        .date-val { color: #0f172a; }
      }
      .cat-pill {
        display: inline-flex;
        padding: 3px 8px;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
        background: #e0e7ff;
        color: #4338ca;
        &.onduty { background: #fef3c7; color: #92400e; }
        &.medical { background: #fee2e2; color: #991b1b; }
        &.rollcallerror { background: #e0f2fe; color: #0369a1; }
        &.punchmiss { background: #f3e8ff; color: #6b21a8; }
      }
      .status-pill.present {
        background: #dcfce7;
        color: #15803d;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 0.78rem;
        font-weight: 600;
      }
      .attachment-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: #2563eb;
        font-weight: 600;
        font-size: 0.82rem;
        text-decoration: none;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
        &:hover { text-decoration: underline; }
      }
      .reason-quote-box {
        margin-top: 6px;
        padding: 10px;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        .quote-lbl { font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px; }
        .quote-text { margin: 0; font-size: 0.88rem; color: #1e293b; line-height: 1.4; }
      }
    }
    .decision-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      .decision-lbl { font-size: 0.85rem; font-weight: 600; color: #334155; }
      .decision-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        .decision-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 8px;
          border: 2px solid #e2e8f0;
          background: #ffffff;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s ease;
          mat-icon { font-size: 24px; width: 24px; height: 24px; }
          strong { display: block; font-size: 0.9rem; }
          small { display: block; font-size: 0.75rem; color: #64748b; margin-top: 2px; }
          &.approve-btn {
            mat-icon { color: #16a34a; }
            &:hover { border-color: #86efac; background: #f0fdf4; }
            &.selected { border-color: #16a34a; background: #dcfce7; }
          }
          &.reject-btn {
            mat-icon { color: #dc2626; }
            &:hover { border-color: #fca5a5; background: #fef2f2; }
            &.selected { border-color: #dc2626; background: #fee2e2; }
          }
        }
      }
    }
    .w-100 { width: 100%; }
    .error-msg-strip {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #fee2e2;
      border: 1px solid #fca5a5;
      color: #991b1b;
      border-radius: 6px;
      font-size: 0.85rem;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .fd-dialog-actions {
      padding: 12px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
  `]
})
export class ReviewStudentRegularizationDialogComponent {
  submitting = false;
  errorMsg = '';
  decision: 'Approve' | 'Reject' = 'Approve';
  approvedStatus = 'Present';
  reviewRemarks = '';

  constructor(
    public dialogRef: MatDialogRef<ReviewStudentRegularizationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public reg: StudentAttendanceRegularizationDto,
    private http: HttpClient
  ) {
    if (reg.requestedStatus) {
      this.approvedStatus = reg.requestedStatus;
    }
  }

  getCategoryLabel(cat: string): string {
    switch (cat) {
      case 'OnDuty': return '🏆 On-Duty (OD)';
      case 'Medical': return '🩺 Medical Excused';
      case 'RollCallError': return '📋 Roll Call Error';
      case 'PunchMiss': return '⏱️ RFID Miss';
      default: return '📝 ' + cat;
    }
  }

  submitDecision(): void {
    this.submitting = true;
    this.errorMsg = '';

    const payload = {
      approve: this.decision === 'Approve',
      reviewRemarks: this.reviewRemarks?.trim(),
      approvedStatus: this.approvedStatus
    };

    this.http.put(`${API_BASE}/student-regularizations/${this.reg.id}/review`, payload).subscribe({
      next: () => {
        this.submitting = false;
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.submitting = false;
        this.errorMsg = err.error?.message || 'Failed to update regularization request.';
      }
    });
  }
}
