import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TeacherSelectorComponent } from './teacher-selector.component';
import { API_BASE, TeacherDto, LeaveDto } from './teacher.models';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-teacher-leaves',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, MatCardModule, MatButtonModule,
    MatIconModule, MatInputModule, MatFormFieldModule, MatSelectModule,
    MatProgressBarModule, MatTooltipModule, TeacherSelectorComponent
  ],
  template: `
<div class="page-container">
  <div class="page-header">
    <div>
      <h1 class="page-title"><mat-icon>beach_access</mat-icon> Leave Management</h1>
      <p class="page-subtitle">Track and manage faculty leave applications, approvals, and balance history.</p>
    </div>
  </div>

  <app-teacher-selector [preSelectId]="preSelectId" (teacherSelected)="onTeacherSelected($event)"></app-teacher-selector>

  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

  <div *ngIf="!selectedTeacher" class="no-selection">
    <mat-icon>person_search</mat-icon>
    <p>Please select a faculty member above to view leave records.</p>
  </div>

  <div *ngIf="selectedTeacher">
    <div class="section-header">
      <h3>{{selectedTeacher.fullName}} — Leave Applications</h3>
      <button mat-raised-button color="primary" (click)="showForm = !showForm">
        <mat-icon>{{showForm ? 'close' : 'add'}}</mat-icon>
        {{showForm ? 'Cancel' : 'Apply Leave'}}
      </button>
    </div>

    <!-- Leave Application Form -->
    <mat-card class="form-card mat-elevation-z1" *ngIf="showForm">
      <form [formGroup]="leaveForm" (ngSubmit)="applyLeave()">
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label>Leave Type *</mat-label>
            <mat-select formControlName="leaveType">
              <mat-option value="CasualLeave">Casual Leave</mat-option>
              <mat-option value="SickLeave">Sick Leave</mat-option>
              <mat-option value="EarnedLeave">Earned Leave</mat-option>
              <mat-option value="UnpaidLeave">Unpaid Leave</mat-option>
              <mat-option value="EmergencyLeave">Emergency Leave</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>From Date *</mat-label>
            <input matInput type="date" formControlName="fromDate">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>To Date *</mat-label>
            <input matInput type="date" formControlName="toDate">
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Reason</mat-label>
            <input matInput formControlName="reason" placeholder="Medical, personal, etc.">
          </mat-form-field>
        </div>
        <div class="form-actions">
          <button mat-button type="button" (click)="showForm = false">Cancel</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="leaveForm.invalid">
            <mat-icon>send</mat-icon> Submit Leave Request
          </button>
        </div>
      </form>
    </mat-card>

    <!-- Stats Row -->
    <div class="stats-row" *ngIf="leaves.length > 0">
      <div class="stat-chip pending"><span>{{pendingCount}}</span><small>Pending</small></div>
      <div class="stat-chip approved"><span>{{approvedCount}}</span><small>Approved</small></div>
      <div class="stat-chip rejected"><span>{{rejectedCount}}</span><small>Rejected</small></div>
      <div class="stat-chip days"><span>{{totalApprovedDays}}</span><small>Days Approved</small></div>
    </div>

    <!-- Leaves Table -->
    <mat-card class="table-card mat-elevation-z1" *ngIf="leaves.length > 0">
      <table class="leave-table">
        <thead>
          <tr>
            <th>Leave Type</th><th>From</th><th>To</th><th>Days</th>
            <th>Reason</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let l of leaves">
            <td><span class="type-chip">{{l.leaveType | titlecase}}</span></td>
            <td>{{l.fromDate | date:'dd MMM yyyy'}}</td>
            <td>{{l.toDate | date:'dd MMM yyyy'}}</td>
            <td><strong>{{l.totalDays}}</strong> day(s)</td>
            <td>{{l.reason || '—'}}</td>
            <td><span class="status-badge" [ngClass]="l.status.toLowerCase()">{{l.status}}</span></td>
            <td>
              <button mat-icon-button color="primary" *ngIf="l.status === 'Pending'"
                (click)="approveLeave(l.id, true)" matTooltip="Approve leave">
                <mat-icon>check_circle</mat-icon>
              </button>
              <button mat-icon-button color="warn" *ngIf="l.status === 'Pending'"
                (click)="approveLeave(l.id, false)" matTooltip="Reject leave">
                <mat-icon>cancel</mat-icon>
              </button>
              <span *ngIf="l.status !== 'Pending'" style="color:#94a3b8;font-size:.8rem;">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </mat-card>

    <div class="empty-state" *ngIf="leaves.length === 0 && !loading && !showForm">
      <mat-icon>beach_access</mat-icon>
      <p>No leave applications recorded for this faculty member.</p>
    </div>
  </div>
</div>
  `,
  styles: [`
    .page-container { display:flex; flex-direction:column; gap:20px; }
    .page-header { display:flex; justify-content:space-between; align-items:center; }
    .page-title { font-size:1.5rem; font-weight:700; margin:0; color:#1976d2; display:flex; align-items:center; gap:8px;
      mat-icon{font-size:1.5rem;width:1.5rem;height:1.5rem;} }
    .page-subtitle { color:#666; margin:4px 0 0; font-size:.9rem; }
    .no-selection { display:flex; flex-direction:column; align-items:center; padding:60px; color:#94a3b8; background:#f8fafc; border-radius:12px;
      mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px;} p{margin:0;font-size:.95rem;} }
    .section-header { display:flex; justify-content:space-between; align-items:center;
      h3{margin:0;font-weight:700;font-size:1.05rem;} }
    .form-card { padding:24px; border-radius:12px; }
    .form-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:0 16px; }
    .full-width { grid-column:1/-1; }
    .form-actions { display:flex; justify-content:flex-end; gap:12px; margin-top:8px; }
    .stats-row { display:flex; gap:12px; flex-wrap:wrap; }
    .stat-chip { text-align:center; padding:14px 24px; border-radius:10px; min-width:90px;
      span{display:block;font-size:1.4rem;font-weight:700;} small{font-size:.72rem;color:#64748b;}
      &.pending{background:#fff8e1; span{color:#f57f17;}} &.approved{background:#e8f5e9; span{color:#2e7d32;}}
      &.rejected{background:#ffebee; span{color:#c62828;}} &.days{background:#e3f2fd; span{color:#1565c0;}} }
    .table-card { border-radius:10px; overflow:hidden; padding:0; }
    .leave-table { width:100%; border-collapse:collapse; font-size:.85rem;
      th,td{padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:left;}
      th{background:#f8fafc;font-weight:600;color:#64748b;font-size:.78rem;}
      tr:last-child td{border-bottom:none;} tr:hover td{background:#f8fafc;} }
    .type-chip { background:#e8eaf6; color:#3949ab; font-size:.72rem; padding:3px 8px; border-radius:8px; font-weight:600; white-space:nowrap; }
    .status-badge { padding:3px 10px; border-radius:10px; font-size:.75rem; font-weight:600;
      &.pending{background:#fff8e1;color:#f57f17;} &.approved{background:#e8f5e9;color:#2e7d32;}
      &.rejected{background:#ffebee;color:#c62828;} }
    .empty-state { display:flex; flex-direction:column; align-items:center; padding:40px; color:#94a3b8; background:#f8fafc; border-radius:12px;
      mat-icon{font-size:40px;width:40px;height:40px;margin-bottom:8px;} p{margin:0;} }
  `]
})
export class TeacherLeavesComponent implements OnInit {
  private api = API_BASE;
  selectedTeacher: TeacherDto | null = null;
  preSelectId: string | null = null;
  leaves: LeaveDto[] = [];
  loading = false; showForm = false;
  leaveForm!: FormGroup;

  get pendingCount() { return this.leaves.filter(l => l.status === 'Pending').length; }
  get approvedCount() { return this.leaves.filter(l => l.status === 'Approved').length; }
  get rejectedCount() { return this.leaves.filter(l => l.status === 'Rejected').length; }
  get totalApprovedDays() { return this.leaves.filter(l => l.status === 'Approved').reduce((s, l) => s + l.totalDays, 0); }

  constructor(private http: HttpClient, private route: ActivatedRoute, private fb: FormBuilder, private confirmDialog: ConfirmDialogService) {}

  ngOnInit() {
    this.route.queryParams.subscribe(p => { if (p['teacherId']) this.preSelectId = p['teacherId']; });
    this.leaveForm = this.fb.group({
      leaveType: ['CasualLeave', Validators.required],
      fromDate: ['', Validators.required],
      toDate: ['', Validators.required],
      reason: ['']
    });
  }

  onTeacherSelected(t: TeacherDto) { this.selectedTeacher = t; this.loadLeaves(); }

  loadLeaves() {
    if (!this.selectedTeacher) return;
    this.loading = true;
    this.http.get<LeaveDto[]>(`${this.api}/teachers/${this.selectedTeacher.id}/leaves`).subscribe({
      next: r => { this.leaves = r; this.loading = false; }, error: () => this.loading = false
    });
  }

  applyLeave() {
    if (!this.selectedTeacher || this.leaveForm.invalid) return;
    this.http.post<LeaveDto>(`${this.api}/teachers/leaves`, {
      teacherId: this.selectedTeacher.id, ...this.leaveForm.value
    }).subscribe({
      next: () => {
        this.showForm = false;
        this.leaveForm.reset({ leaveType: 'CasualLeave' });
        this.loadLeaves();
        this.confirmDialog.alert('Leave Submitted', 'Leave application submitted successfully!', 'success');
      },
      error: e => this.confirmDialog.alert('Error', e?.error?.message || 'Error applying leave.', 'danger')
    });
  }

  approveLeave(id: string, approve: boolean) {
    const title = approve ? 'Approve Leave Application' : 'Reject Leave Application';
    const msg = approve ? 'Are you sure you want to approve this faculty leave application?' : 'Are you sure you want to reject this faculty leave application?';
    this.confirmDialog.confirm(title, msg, approve ? 'Approve' : 'Reject', 'Cancel', approve ? 'info' : 'danger').subscribe(confirmed => {
      if (confirmed) {
        this.http.put(`${this.api}/teachers/leaves/${id}/approve`, {
          approve, rejectionReason: approve ? null : 'Not approved by management'
        }).subscribe({
          next: () => {
            this.loadLeaves();
            this.confirmDialog.alert('Leave Updated', approve ? 'Leave application approved!' : 'Leave application rejected.', approve ? 'success' : 'warning');
          }
        });
      }
    });
  }
}
