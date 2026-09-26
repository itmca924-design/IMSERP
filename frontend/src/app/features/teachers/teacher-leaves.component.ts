import { Component, OnInit, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { API_BASE, TeacherDto, LeaveDto } from './teacher.models';

// ═══════════════════════════════════════════════════════════════════
// REJECT TEACHER LEAVE DIALOG
// ═══════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-reject-teacher-leave-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="fd-dialog-sm">
      <div class="fd-dialog-header">
        <div class="fd-dialog-icon">
          <mat-icon>cancel</mat-icon>
        </div>
        <div class="fd-dialog-title-group">
          <h2 class="fd-dialog-title">Reject Faculty Leave Request</h2>
          <span class="fd-dialog-sub">{{data.teacherName}} ({{data.employeeCode}}) — <strong>{{data.leaveType}}</strong></span>
        </div>
        <button mat-icon-button class="fd-dialog-close" (click)="cancel()"><mat-icon>close</mat-icon></button>
      </div>

      <div class="fd-dialog-body">
        <div class="rejection-notice">
          <mat-icon>info</mat-icon>
          <div>
            <strong>Rejection Reason Required:</strong> Please specify the cause for rejecting this faculty leave application. This reason will be recorded and visible to the faculty member.
          </div>
        </div>

        <div class="quick-causes">
          <div class="quick-causes-label">Common Rejection Reasons:</div>
          <div class="causes-chips">
            <button type="button" class="cause-chip" (click)="setReason('No substitute faculty available for assigned lectures')">
              👨‍🏫 No Substitute Available
            </button>
            <button type="button" class="cause-chip" (click)="setReason('Scheduled school examination / assessment duty')">
              📝 Exam Duty Scheduled
            </button>
            <button type="button" class="cause-chip" (click)="setReason('Exceeded permissible casual / medical leave limit')">
              ⚠️ Leave Quota Exceeded
            </button>
            <button type="button" class="cause-chip" (click)="setReason('Short notice / Prior approval required')">
              ⏱️ Short Notice
            </button>
          </div>
        </div>

        <mat-form-field appearance="outline" class="fd-field-full">
          <mat-label>Rejection Reason / Cause *</mat-label>
          <textarea matInput [(ngModel)]="reason" rows="3" placeholder="Explain the reason for rejecting this leave..."></textarea>
          <mat-hint *ngIf="!reason.trim()" class="rejection-error-hint">
            * Please enter or select a rejection reason before rejecting
          </mat-hint>
        </mat-form-field>
      </div>

      <div class="fd-dialog-footer">
        <button mat-stroked-button (click)="cancel()">Cancel</button>
        <button mat-flat-button color="warn" (click)="confirm()" [disabled]="saving || !reason.trim()">
          <mat-icon>block</mat-icon>
          {{saving ? 'Rejecting...' : 'Reject Leave Application'}}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .fd-dialog-sm { width: 100%; max-width: 480px; box-sizing: border-box; }
    .fd-dialog-header {
      display: flex; align-items: center; gap: 14px; padding: 20px 24px 14px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
    }
    .fd-dialog-icon {
      background: #ef4444; color: #fff; border-radius: 10px; width: 44px; height: 44px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(239,68,68,0.25); flex-shrink: 0;
    }
    .fd-dialog-title { color: #1e3a8a; font-weight: 700; font-size: 1.05rem; margin: 0; line-height: 1.2; }
    .fd-dialog-sub { color: #3b82f6; font-size: 0.82rem; }
    .fd-dialog-sub strong { color: #1e40af; }
    .fd-dialog-title-group { flex: 1; min-width: 0; }
    .fd-dialog-close { color: #64748b; margin-left: auto; flex-shrink: 0; }
    .fd-dialog-body { padding: 18px 24px; display: flex; flex-direction: column; gap: 14px; box-sizing: border-box; }
    .fd-dialog-footer { display: flex; gap: 12px; justify-content: flex-end; padding: 14px 24px; border-top: 1px solid #e2e8f0; }
    .fd-field-full { width: 100%; display: block; }

    .rejection-notice {
      display: flex; gap: 10px; align-items: flex-start;
      background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
      padding: 10px 14px; color: #991b1b; font-size: 0.82rem; line-height: 1.4;
    }
    .rejection-notice mat-icon { font-size: 18px; width: 18px; height: 18px; color: #dc2626; flex-shrink: 0; margin-top: 1px; }

    .quick-causes-label {
      font-size: 0.76rem; font-weight: 600; color: #64748b;
      text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 6px;
    }
    .causes-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .cause-chip {
      background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 16px;
      padding: 4px 10px; font-size: 0.76rem; color: #334155; cursor: pointer;
      transition: all 0.15s ease; white-space: nowrap;
    }
    .cause-chip:hover { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }
    .rejection-error-hint { color: #dc2626; font-size: 0.75rem; font-weight: 500; }

    @media (max-width: 520px) {
      .fd-dialog-header { padding: 14px 16px 12px; gap: 10px; }
      .fd-dialog-icon { width: 36px; height: 36px; }
      .fd-dialog-title { font-size: 0.95rem; }
      .fd-dialog-body { padding: 14px 16px; gap: 10px; }
      .fd-dialog-footer { padding: 10px 16px; gap: 8px; }
      .fd-dialog-footer button { flex: 1 1 auto; }
    }
  `]
})
export class RejectTeacherLeaveDialogComponent {
  saving = false;
  reason = '';

  constructor(
    private dialogRef: MatDialogRef<RejectTeacherLeaveDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { id: string; teacherName: string; employeeCode: string; leaveType: string },
    private http: HttpClient
  ) {}

  setReason(r: string) { this.reason = r; }

  confirm() {
    if (!this.reason.trim()) return;
    this.saving = true;
    this.http.put(`${API_BASE}/teachers/leaves/${this.data.id}/approve`, {
      approve: false,
      rejectionReason: this.reason.trim()
    }).subscribe({
      next: () => { this.saving = false; this.dialogRef.close(true); },
      error: () => { this.saving = false; }
    });
  }

  cancel() { this.dialogRef.close(false); }
}

// ═══════════════════════════════════════════════════════════════════
// APPLY TEACHER LEAVE DIALOG
// ═══════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-apply-teacher-leave-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <div class="fd-dialog-md">
      <div class="fd-dialog-header">
        <div class="fd-dialog-icon">
          <mat-icon>beach_access</mat-icon>
        </div>
        <div class="fd-dialog-title-group">
          <h2 class="fd-dialog-title">{{isTeacherSelf ? 'Apply for Leave' : 'Submit Faculty Leave Application'}}</h2>
          <span class="fd-dialog-sub">{{isTeacherSelf ? 'Application will be submitted to Admin / Principal for approval' : 'Submit leave on behalf of a faculty member'}}</span>
        </div>
        <button mat-icon-button class="fd-dialog-close" (click)="cancel()"><mat-icon>close</mat-icon></button>
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="fd-dialog-body">

          <!-- If Teacher is self-applying: Readonly banner -->
          <div class="profile-strip" *ngIf="isTeacherSelf && myProfile">
            <div class="profile-avatar"><mat-icon>school</mat-icon></div>
            <div class="profile-info">
              <div class="profile-name">{{myProfile.fullName}}</div>
              <div class="profile-meta">
                <span>Code: <strong>{{myProfile.employeeCode}}</strong></span>
                <span *ngIf="myProfile.department">Dept: <strong>{{myProfile.department}}</strong></span>
                <span *ngIf="myProfile.designation">Role: <strong>{{myProfile.designation}}</strong></span>
              </div>
            </div>
          </div>

          <!-- If Admin: Teacher selector -->
          <mat-form-field appearance="outline" class="fd-field-full" *ngIf="!isTeacherSelf">
            <mat-label>Select Faculty Member *</mat-label>
            <mat-select formControlName="teacherId">
              <mat-option *ngFor="let t of teachers" [value]="t.id">
                {{t.fullName}} ({{t.employeeCode}}){{t.department ? ' — ' + t.department : ''}}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <div class="form-row">
            <mat-form-field appearance="outline" class="form-col">
              <mat-label>Leave Type *</mat-label>
              <mat-select formControlName="leaveType">
                <mat-option value="CasualLeave">Casual Leave</mat-option>
                <mat-option value="SickLeave">Sick Leave</mat-option>
                <mat-option value="EarnedLeave">Earned Leave</mat-option>
                <mat-option value="UnpaidLeave">Unpaid Leave</mat-option>
                <mat-option value="EmergencyLeave">Emergency Leave</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="form-col">
              <mat-label>From Date *</mat-label>
              <input matInput type="date" formControlName="fromDate" (change)="calcDays()" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="form-col">
              <mat-label>To Date *</mat-label>
              <input matInput type="date" formControlName="toDate" (change)="calcDays()" />
            </mat-form-field>
          </div>

          <div class="days-badge-wrap" *ngIf="totalDays > 0">
            <mat-icon style="font-size:16px;width:16px;height:16px;color:#2563eb;">date_range</mat-icon>
            <span>Total Duration: <strong>{{totalDays}} Day(s)</strong></span>
          </div>

          <mat-form-field appearance="outline" class="fd-field-full">
            <mat-label>Reason for Leave *</mat-label>
            <textarea matInput formControlName="reason" rows="3" placeholder="Provide medical reason, personal emergency, family function, etc..."></textarea>
          </mat-form-field>
        </div>

        <div class="fd-dialog-footer">
          <button mat-stroked-button type="button" (click)="cancel()">Cancel</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving">
            <mat-icon>send</mat-icon>
            {{saving ? 'Submitting...' : 'Submit Application'}}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .fd-dialog-md { width: 100%; max-width: 540px; box-sizing: border-box; }
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
    .fd-dialog-footer { display: flex; gap: 12px; justify-content: flex-end; padding: 14px 24px; border-top: 1px solid #e2e8f0; }
    .fd-field-full { width: 100%; display: block; }
    .form-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .form-col { flex: 1; min-width: 140px; }

    .profile-strip {
      display: flex; align-items: center; gap: 12px;
      background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 10px 14px;
    }
    .profile-avatar {
      width: 38px; height: 38px; border-radius: 8px; background: #16a34a; color: #fff;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .profile-name { font-size: 14px; font-weight: 700; color: #14532d; }
    .profile-meta { font-size: 12px; color: #166534; display: flex; gap: 12px; flex-wrap: wrap; margin-top: 2px; }
    .profile-meta strong { color: #0f172a; }

    .days-badge-wrap {
      display: inline-flex; align-items: center; gap: 6px;
      background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;
      padding: 6px 12px; font-size: 13px; color: #1e40af; width: fit-content;
    }

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
export class ApplyTeacherLeaveDialogComponent implements OnInit {
  form!: FormGroup;
  saving = false;
  totalDays = 0;
  isTeacherSelf = false;
  teachers: TeacherDto[] = [];
  myProfile: any = null;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ApplyTeacherLeaveDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { isTeacher: boolean; teachers: TeacherDto[]; myProfile: any },
    private http: HttpClient
  ) {
    this.isTeacherSelf = data.isTeacher;
    this.teachers = data.teachers || [];
    this.myProfile = data.myProfile;
  }

  ngOnInit() {
    this.form = this.fb.group({
      teacherId: [this.isTeacherSelf ? (this.myProfile?.id || '') : '', Validators.required],
      leaveType: ['CasualLeave', Validators.required],
      fromDate: ['', Validators.required],
      toDate: ['', Validators.required],
      reason: ['', Validators.required]
    });
  }

  calcDays() {
    const from = this.form.get('fromDate')?.value;
    const to = this.form.get('toDate')?.value;
    if (from && to) {
      const d1 = new Date(from);
      const d2 = new Date(to);
      const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      this.totalDays = diff > 0 ? diff : 0;
    } else {
      this.totalDays = 0;
    }
  }

  submit() {
    if (this.form.invalid) return;
    this.saving = true;
    this.http.post(`${API_BASE}/teachers/leaves`, this.form.value).subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close(true);
      },
      error: () => {
        this.saving = false;
      }
    });
  }

  cancel() { this.dialogRef.close(false); }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN TEACHER LEAVES COMPONENT
// ═══════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-teacher-leaves',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, MatCardModule, MatButtonModule,
    MatIconModule, MatInputModule, MatFormFieldModule, MatSelectModule,
    MatProgressBarModule, MatTooltipModule, MatDialogModule
  ],
  template: `
    <div class="fd-page">

      <!-- ── Page Header ── -->
      <div class="page-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>beach_access</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Faculty Leave Management</h1>
            <p class="page-subtitle">
              {{ isTeacher 
                ? 'Apply for leave, track application status, and view your sanctioned leave records' 
                : 'Review and approve faculty leave requests, track attendance linkage, and manage leave records' }}
            </p>
          </div>
        </div>

        <div class="header-actions">
          <button mat-stroked-button class="refresh-btn" (click)="loadAll()" [disabled]="loading">
            <mat-icon [class.spin]="loading">refresh</mat-icon>
            <span>Refresh</span>
          </button>
          <button mat-flat-button class="btn-primary" (click)="openApplyDialog()">
            <mat-icon>add</mat-icon>
            <span>Apply Leave</span>
          </button>
        </div>
      </div>

      <mat-progress-bar *ngIf="loading" mode="indeterminate" class="fd-loader"></mat-progress-bar>

      <!-- ── Teacher Scope Notice Banner ── -->
      <div class="role-scope-notice teacher" *ngIf="isTeacher">
        <mat-icon>account_circle</mat-icon>
        <span>
          <strong>Faculty Portal View:</strong> Displaying leave requests for <strong>{{myProfile?.fullName || 'Your Account'}}</strong>{{myProfile?.employeeCode ? ' (Code: ' + myProfile.employeeCode + ')' : ''}}. Submitted applications are forwarded to School Administration / Principal for review.
        </span>
      </div>

      <!-- ── Stats Cards (Full Width Edge to Edge) ── -->
      <div class="stats-grid" [class.stats-teacher]="isTeacher">
        <div class="stat-card stat-amber">
          <mat-icon class="stat-icon">pending_actions</mat-icon>
          <div class="stat-body">
            <div class="stat-num">{{stats.pending}}</div>
            <div class="stat-label">Pending Review</div>
          </div>
          <div class="pulse-badge" *ngIf="stats.pending > 0 && canApproveLeave">Action Required</div>
        </div>

        <div class="stat-card stat-green">
          <mat-icon class="stat-icon">check_circle</mat-icon>
          <div class="stat-body">
            <div class="stat-num">{{stats.approvedThisMonth}}</div>
            <div class="stat-label">Approved (This Month)</div>
          </div>
        </div>

        <div class="stat-card stat-slate" *ngIf="!isTeacher">
          <mat-icon class="stat-icon">person_off</mat-icon>
          <div class="stat-body">
            <div class="stat-num">{{stats.onLeaveToday}}</div>
            <div class="stat-label">On Leave Today</div>
          </div>
        </div>

        <div class="stat-card stat-blue">
          <mat-icon class="stat-icon">event_note</mat-icon>
          <div class="stat-body">
            <div class="stat-num">{{stats.totalThisYear}}</div>
            <div class="stat-label">Total Applications (Year)</div>
          </div>
        </div>
      </div>

      <!-- ── Main Card (Filter Strip + Table) ── -->
      <div class="content-card">

        <!-- ── Filter Bar ── -->
        <div class="filter-bar">
          <mat-form-field appearance="outline" class="filter-field" subscriptSizing="dynamic">
            <mat-label>Status</mat-label>
            <mat-select [(ngModel)]="filterStatus" (selectionChange)="loadLeaves()">
              <mat-option value="All">All Statuses</mat-option>
              <mat-option value="Pending">⏳ Pending Review</mat-option>
              <mat-option value="Approved">✅ Approved</mat-option>
              <mat-option value="Rejected">❌ Rejected</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field" subscriptSizing="dynamic">
            <mat-label>Leave Type</mat-label>
            <mat-select [(ngModel)]="filterLeaveType" (selectionChange)="loadLeaves()">
              <mat-option value="All">All Types</mat-option>
              <mat-option value="CasualLeave">Casual Leave</mat-option>
              <mat-option value="SickLeave">Sick Leave</mat-option>
              <mat-option value="EarnedLeave">Earned Leave</mat-option>
              <mat-option value="UnpaidLeave">Unpaid Leave</mat-option>
              <mat-option value="EmergencyLeave">Emergency Leave</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field filter-field-full-mobile" *ngIf="!isTeacher" subscriptSizing="dynamic">
            <mat-label>Faculty Member</mat-label>
            <mat-select [(ngModel)]="filterTeacherId" (selectionChange)="loadLeaves()">
              <mat-option value="">All Faculty</mat-option>
              <mat-option *ngFor="let t of teachers" [value]="t.id">{{t.fullName}} ({{t.employeeCode}})</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field-search" subscriptSizing="dynamic">
            <mat-icon matPrefix class="filter-icon">search</mat-icon>
            <input matInput [(ngModel)]="searchQuery" (input)="loadLeaves()" placeholder="Search faculty name, code, reason..." />
            <button mat-icon-button matSuffix *ngIf="searchQuery" (click)="searchQuery=''; loadLeaves()" style="color:#94a3b8;">
              <mat-icon style="font-size:18px;">close</mat-icon>
            </button>
          </mat-form-field>
        </div>

        <!-- ── Leaves Table ── -->
        <div class="fd-table-wrap" *ngIf="filteredLeaves.length > 0; else noLeaves">
          <table class="fd-table">
            <thead>
              <tr>
                <th *ngIf="!isTeacher">Faculty Member</th>
                <th>Leave Type</th>
                <th>Duration & Dates</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Reviewed By</th>
                <th>Applied On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let l of filteredLeaves" [class.row-pending]="l.status === 'Pending'">
                <!-- Faculty Member (Admin View) -->
                <td *ngIf="!isTeacher">
                  <div class="teacher-info-cell">
                    <div class="teacher-avatar"><mat-icon>person</mat-icon></div>
                    <div>
                      <div class="teacher-name">{{l.teacherName}}</div>
                      <div class="teacher-code">{{l.employeeCode}}</div>
                    </div>
                  </div>
                </td>

                <!-- Leave Type -->
                <td>
                  <span class="leave-type-chip type-{{l.leaveType.toLowerCase()}}">
                    {{formatLeaveType(l.leaveType)}}
                  </span>
                </td>

                <!-- Dates -->
                <td>
                  <div class="date-range-text">
                    <span class="date-bold">{{l.fromDate | date:'dd MMM yyyy'}}</span>
                    <span class="date-sep">to</span>
                    <span class="date-bold">{{l.toDate | date:'dd MMM yyyy'}}</span>
                  </div>
                </td>

                <!-- Days -->
                <td>
                  <span class="days-badge">{{l.totalDays}} Day{{l.totalDays > 1 ? 's' : ''}}</span>
                </td>

                <!-- Reason -->
                <td>
                  <div class="reason-cell">
                    <span class="reason-text">{{l.reason || '—'}}</span>
                  </div>
                </td>

                <!-- Status -->
                <td>
                  <span class="status-badge status-{{l.status.toLowerCase()}}">
                    <mat-icon>{{getStatusIcon(l.status)}}</mat-icon>
                    {{l.status}}
                  </span>
                </td>

                <!-- Approver / Rejection Reason -->
                <td>
                  <div *ngIf="l.status === 'Approved'" class="approver-info">
                    <div class="approver-name">✅ {{l.approvedBy || 'Admin'}}</div>
                    <div class="approver-date" *ngIf="l.approvedAt">{{l.approvedAt | date:'dd MMM, hh:mm a'}}</div>
                  </div>
                  <div *ngIf="l.status === 'Rejected'" class="rejection-info">
                    <div class="rejection-name">❌ {{l.approvedBy || 'Admin'}}</div>
                    <div class="rejection-reason-text" *ngIf="l.rejectionReason" [matTooltip]="l.rejectionReason">
                      {{l.rejectionReason | slice:0:30}}{{l.rejectionReason.length > 30 ? '...' : ''}}
                    </div>
                  </div>
                  <span class="na-text" *ngIf="l.status === 'Pending'">⏳ Awaiting Review</span>
                </td>

                <!-- Applied Date -->
                <td>
                  <div class="applied-date">{{l.createdAt | date:'dd MMM yyyy'}}</div>
                </td>

                <!-- Actions -->
                <td>
                  <div class="action-btns">
                    <!-- ADMIN ACTIONS -->
                    <ng-container *ngIf="canApproveLeave">
                      <button mat-icon-button class="btn-approve" *ngIf="l.status === 'Pending'"
                        (click)="quickApprove(l)" matTooltip="Approve Leave (Syncs Attendance)">
                        <mat-icon>check_circle</mat-icon>
                      </button>
                      <button mat-icon-button class="btn-reject" *ngIf="l.status === 'Pending'"
                        (click)="openRejectDialog(l)" matTooltip="Reject Leave Application">
                        <mat-icon>cancel</mat-icon>
                      </button>
                      <button mat-icon-button color="warn" (click)="deleteLeave(l)" matTooltip="Delete Application">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </ng-container>

                    <!-- TEACHER ACTIONS (Faculty can only cancel their own Pending requests) -->
                    <button mat-icon-button color="warn" *ngIf="isTeacher && l.status === 'Pending'"
                      (click)="deleteLeave(l)" matTooltip="Cancel Leave Application">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ng-template #noLeaves>
          <div class="empty-state">
            <mat-icon>beach_access</mat-icon>
            <p>No faculty leave records found for the selected criteria.</p>
            <button mat-stroked-button (click)="openApplyDialog()">
              <mat-icon>add</mat-icon> Apply First Leave
            </button>
          </div>
        </ng-template>

      </div>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    .fd-page {
      font-family: 'Inter', sans-serif;
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding-bottom: 40px;
    }

    /* ── Page Header ── */
    .page-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px; background: #fff;
      border: 1px solid #e2e8f0; border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,.05);
      flex-wrap: wrap; gap: 16px;
    }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-icon-box {
      width: 48px; height: 48px; border-radius: 12px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 10px rgba(37,99,235,.28); color: #fff;
    }
    .page-title { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0; }
    .page-subtitle { font-size: 0.82rem; color: #64748b; margin: 2px 0 0; }
    .header-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .refresh-btn { color: #64748b !important; border-color: #e2e8f0 !important; }
    .btn-primary { background: linear-gradient(135deg, #2563eb, #1d4ed8) !important; color: #fff !important; }

    .fd-loader { margin: 0; border-radius: 4px; }

    /* ── Role Scope Notice ── */
    .role-scope-notice {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 18px; border-radius: 10px; font-size: 0.84rem; line-height: 1.4;
    }
    .role-scope-notice.teacher {
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 1px solid #bbf7d0; color: #166534;
    }
    .role-scope-notice.teacher mat-icon { color: #16a34a; font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }

    /* ── Stats Grid ── */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      width: 100%;
    }
    .stats-grid.stats-teacher {
      grid-template-columns: repeat(3, 1fr);
    }
    @media (max-width: 1024px) {
      .stats-grid, .stats-grid.stats-teacher {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    @media (max-width: 600px) {
      .stats-grid, .stats-grid.stats-teacher {
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }
    }
    @media (max-width: 420px) {
      .stats-grid, .stats-grid.stats-teacher {
        grid-template-columns: 1fr;
      }
    }

    .stat-card {
      background: #fff; border-radius: 12px; padding: 18px 20px;
      display: flex; align-items: center; gap: 14px;
      box-shadow: 0 1px 4px rgba(0,0,0,.05); border: 1px solid #e2e8f0;
      position: relative; transition: transform .2s, box-shadow .2s;
    }
    .stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 14px rgba(0,0,0,.08); }
    .stat-icon {
      font-size: 30px; width: 36px; height: 36px; line-height: 36px;
      display: inline-flex; align-items: center; justify-content: center;
      overflow: visible !important; flex-shrink: 0;
    }
    .stat-num { font-size: 1.8rem; font-weight: 700; line-height: 1; }
    .stat-label { font-size: 0.72rem; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: .3px; font-weight: 600; }
    .stat-blue .stat-icon  { color: #2563eb; }  .stat-blue .stat-num  { color: #2563eb; }
    .stat-green .stat-icon { color: #16a34a; }  .stat-green .stat-num { color: #16a34a; }
    .stat-slate .stat-icon { color: #475569; }  .stat-slate .stat-num { color: #475569; }
    .stat-amber .stat-icon  { color: #d97706; } .stat-amber .stat-num  { color: #d97706; }

    .pulse-badge {
      position: absolute; top: 12px; right: 14px;
      background: #f59e0b; color: #fff; font-size: 10px; font-weight: 800;
      padding: 2px 7px; border-radius: 10px; letter-spacing: 0.3px;
    }

    /* ── Main Content Card ── */
    .content-card {
      background: #fff; border-radius: 12px; border: 1px solid #e2e8f0;
      box-shadow: 0 1px 4px rgba(0,0,0,.05); overflow: hidden; width: 100%;
    }

    /* ── Filter Bar ── */
    .filter-bar {
      display: flex; gap: 12px; align-items: center;
      padding: 16px 20px 10px; flex-wrap: wrap;
    }
    .filter-field { flex: 0 0 170px; min-width: 140px; }
    .filter-field-search { flex: 1 1 240px; min-width: 200px; }
    .filter-icon {
      color: #64748b; margin-right: 8px; margin-left: 2px;
      font-size: 20px; width: 20px; height: 20px;
      display: inline-flex; align-items: center; justify-content: center;
    }

    @media (max-width: 768px) {
      .filter-bar { padding: 12px 14px 6px; gap: 8px; }
      .filter-field { flex: 1 1 calc(50% - 4px); min-width: 140px; width: auto; }
      .filter-field.filter-field-full-mobile { flex: 1 1 100%; min-width: 100%; }
      .filter-field-search { flex: 1 1 100%; min-width: 100%; }
      .page-header { padding: 14px 16px; flex-direction: column; align-items: flex-start; gap: 12px; }
      .header-actions { width: 100%; justify-content: flex-start; }
    }

    /* ── Table ── */
    .fd-table-wrap { padding: 0 20px 20px; overflow-x: auto; }
    .fd-table { width: 100%; border-collapse: collapse; font-size: 0.83rem; }
    .fd-table th {
      padding: 10px 12px; text-align: left; background: #f1f5f9; color: #475569;
      font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: .3px;
      border-bottom: 2px solid #e2e8f0; white-space: nowrap;
    }
    .fd-table td { padding: 12px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .fd-table tr:hover td { background: #f8fafc; }
    .fd-table tr.row-pending td { background: #fffdf5; }

    .teacher-info-cell { display: flex; align-items: center; gap: 10px; }
    .teacher-avatar {
      width: 32px; height: 32px; border-radius: 8px; background: #eff6ff; color: #2563eb;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .teacher-avatar mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .teacher-name { font-weight: 600; color: #0f172a; font-size: 0.84rem; }
    .teacher-code { font-size: 0.72rem; color: #64748b; font-family: monospace; }

    .leave-type-chip {
      display: inline-block; font-size: 0.7rem; font-weight: 600; padding: 2px 8px;
      border-radius: 8px; white-space: nowrap; text-transform: capitalize;
    }
    .type-casualleave    { background: #e0e7ff; color: #3730a3; }
    .type-sickleave      { background: #fee2e2; color: #991b1b; }
    .type-earnedleave    { background: #fef3c7; color: #92400e; }
    .type-unpaidleave    { background: #f1f5f9; color: #475569; }
    .type-emergencyleave { background: #ffedd5; color: #9a3412; }

    .date-range-text { display: flex; align-items: center; gap: 4px; font-size: 0.8rem; }
    .date-bold { font-weight: 600; color: #0f172a; }
    .date-sep { color: #94a3b8; font-size: 0.75rem; }

    .days-badge {
      display: inline-block; background: #f1f5f9; color: #334155; font-size: 0.72rem;
      font-weight: 700; padding: 2px 7px; border-radius: 6px; border: 1px solid #cbd5e1;
    }

    .reason-cell { max-width: 220px; }
    .reason-text { font-size: 0.78rem; color: #475569; word-break: break-word; }

    .status-badge {
      display: inline-flex; align-items: center; gap: 3px; font-size: 0.72rem;
      font-weight: 600; padding: 3px 8px; border-radius: 20px; white-space: nowrap;
    }
    .status-badge mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .status-pending  { background: #fef3c7; color: #92400e; }
    .status-approved { background: #d1fae5; color: #065f46; }
    .status-rejected { background: #fee2e2; color: #991b1b; }

    .approver-info { font-size: 0.76rem; }
    .approver-name { font-weight: 600; color: #166534; }
    .approver-date { font-size: 0.7rem; color: #64748b; }
    .rejection-info { font-size: 0.76rem; }
    .rejection-name { font-weight: 600; color: #991b1b; }
    .rejection-reason-text { font-size: 0.7rem; color: #b91c1c; font-style: italic; }
    .na-text { color: #94a3b8; font-size: 0.76rem; }
    .applied-date { font-size: 0.76rem; color: #64748b; }

    .action-btns { display: flex; align-items: center; gap: 4px; }
    .btn-approve { color: #16a34a !important; }
    .btn-reject { color: #dc2626 !important; }

    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      padding: 40px; color: #94a3b8; background: #fff;
    }
    .empty-state mat-icon { font-size: 40px; width: 40px; height: 40px; margin-bottom: 8px; color: #cbd5e1; }
    .empty-state p { margin: 0 0 14px; font-size: 0.88rem; }
  `]
})
export class TeacherLeavesComponent implements OnInit {
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);
  private confirm = inject(ConfirmDialogService);

  leaves: LeaveDto[] = [];
  teachers: TeacherDto[] = [];
  myProfile: any = null;
  loading = false;

  // Filters
  filterStatus = 'All';
  filterLeaveType = 'All';
  filterTeacherId = '';
  searchQuery = '';

  // Stats
  stats = {
    pending: 0,
    approvedThisMonth: 0,
    onLeaveToday: 0,
    totalThisYear: 0
  };

  get isTeacher(): boolean {
    return this.authService.isTeacher();
  }

  get canApproveLeave(): boolean {
    return this.authService.isAdmin() || this.authService.isHR();
  }

  get filteredLeaves(): LeaveDto[] {
    return this.leaves.filter(l => {
      // Status filter
      if (this.filterStatus !== 'All' && l.status !== this.filterStatus) return false;
      // Leave Type filter
      if (this.filterLeaveType !== 'All' && l.leaveType !== this.filterLeaveType) return false;
      // Search query
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const matchName = l.teacherName?.toLowerCase().includes(q);
        const matchCode = l.employeeCode?.toLowerCase().includes(q);
        const matchReason = l.reason?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchReason) return false;
      }
      return true;
    });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(p => {
      if (p['teacherId']) this.filterTeacherId = p['teacherId'];
    });
    this.loadAll();
  }

  loadAll() {
    this.loadStats();
    this.loadLeaves();
    if (!this.isTeacher) {
      this.loadTeachers();
    } else {
      this.loadMyProfile();
    }
  }

  loadMyProfile() {
    this.http.get<any>(`${API_BASE}/teachers/my-profile`).subscribe({
      next: p => {
        if (p?.isLinked) {
          this.myProfile = p;
        }
      },
      error: () => {}
    });
  }

  loadTeachers() {
    this.http.get<TeacherDto[]>(`${API_BASE}/teachers`).subscribe({
      next: t => this.teachers = t,
      error: () => {}
    });
  }

  loadStats() {
    this.http.get<any>(`${API_BASE}/teachers/leaves/stats`).subscribe({
      next: s => {
        this.stats.pending = s.pending || 0;
        this.stats.approvedThisMonth = s.approvedThisMonth || 0;
        this.stats.onLeaveToday = s.onLeaveToday || 0;
        this.stats.totalThisYear = s.totalThisYear || 0;
        if (s.isTeacher && s.teacherName) {
          this.myProfile = { fullName: s.teacherName, id: s.teacherId };
        }
      },
      error: () => {}
    });
  }

  loadLeaves() {
    this.loading = true;
    const params: any = {};
    if (this.filterStatus && this.filterStatus !== 'All') params.status = this.filterStatus;
    if (this.filterTeacherId) params.teacherId = this.filterTeacherId;
    if (this.searchQuery) params.search = this.searchQuery;

    this.http.get<LeaveDto[]>(`${API_BASE}/teachers/all-leaves`, { params }).subscribe({
      next: r => {
        this.leaves = r;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  openApplyDialog() {
    const ref = this.dialog.open(ApplyTeacherLeaveDialogComponent, {
      data: {
        isTeacher: this.isTeacher,
        teachers: this.teachers,
        myProfile: this.myProfile
      },
      disableClose: true,
      maxWidth: '92vw',
      width: '520px'
    });
    ref.afterClosed().subscribe(res => {
      if (res) {
        this.loadAll();
      }
    });
  }

  quickApprove(l: LeaveDto) {
    this.confirm.confirm(
      'Approve Faculty Leave',
      `Approve <strong>${l.leaveType}</strong> application for <strong>${l.teacherName}</strong> (${l.totalDays} days: ${l.fromDate.substring(0, 10)} to ${l.toDate.substring(0, 10)})?<br><br><span style="color:#16a34a; font-size:12px;">Attendance for these days will automatically be synchronized as "Leave".</span>`,
      'Approve & Sync', 'cancel'
    ).subscribe(ok => {
      if (!ok) return;
      this.http.put(`${API_BASE}/teachers/leaves/${l.id}/approve`, {
        approve: true
      }).subscribe({
        next: () => {
          this.loadAll();
        },
        error: () => {}
      });
    });
  }

  openRejectDialog(l: LeaveDto) {
    const ref = this.dialog.open(RejectTeacherLeaveDialogComponent, {
      data: {
        id: l.id,
        teacherName: l.teacherName,
        employeeCode: l.employeeCode,
        leaveType: l.leaveType
      },
      disableClose: true,
      maxWidth: '92vw',
      width: '460px'
    });
    ref.afterClosed().subscribe(res => {
      if (res) {
        this.loadAll();
      }
    });
  }

  deleteLeave(l: LeaveDto) {
    const isSelfCancel = this.isTeacher && l.status === 'Pending';
    const title = isSelfCancel ? 'Cancel Leave Application' : 'Delete Leave Record';
    const msg = isSelfCancel 
      ? `Are you sure you want to cancel your leave application for <strong>${l.fromDate.substring(0, 10)}</strong>?`
      : `Delete leave record for <strong>${l.teacherName}</strong>?`;

    this.confirm.confirm(title, msg, isSelfCancel ? 'Cancel Leave' : 'Delete', 'Dismiss').subscribe(ok => {
      if (!ok) return;
      this.http.delete(`${API_BASE}/teachers/leaves/${l.id}`).subscribe({
        next: () => {
          this.loadAll();
        },
        error: () => {}
      });
    });
  }

  formatLeaveType(type: string): string {
    if (!type) return 'Leave';
    return type.replace(/([A-Z])/g, ' $1').trim();
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'Approved': return 'check_circle';
      case 'Rejected': return 'cancel';
      default: return 'hourglass_top';
    }
  }
}
