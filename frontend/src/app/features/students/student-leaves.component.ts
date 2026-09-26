import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';

const API_BASE = 'http://localhost:5000/api';

export interface StudentLeaveDto {
  id: string;
  tenantId: string;
  branchId?: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  className?: string;
  sectionName?: string;
  parentContactNumber?: string;
  leaveCategory: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  attachmentUrl?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
  attendanceMarked: boolean;
  appliedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentLeaveStatsDto {
  totalLeaves: number;
  pendingLeaves: number;
  approvedLeaves: number;
  rejectedLeaves: number;
  todayOnLeave: number;
}

@Component({
  selector: 'app-student-leaves',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule,
    MatProgressBarModule, MatDividerModule
  ],
  template: `
    <div class="leaves-page-container">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>event_busy</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Student Leave Applications & Attendance Linkage</h1>
            <p class="page-subtitle">
              Manage student leave requests, medical slips, approvals, and automated attendance register synchronization
            </p>
          </div>
        </div>

        <div class="header-actions">
          <a mat-stroked-button class="refresh-btn" routerLink="/students/gate-pass" style="color:#2563eb; border-color:#bfdbfe;">
            <mat-icon>badge</mat-icon>
            <span>Gate Pass</span>
          </a>
          <button mat-stroked-button class="refresh-btn" (click)="loadLeaves()" [disabled]="loading">
            <mat-icon [class.spin]="loading">refresh</mat-icon>
            <span>Refresh</span>
          </button>
          <button mat-raised-button class="create-btn" (click)="openApplyDialog()">
            <mat-icon>add_circle</mat-icon>
            <span>Apply Student Leave</span>
          </button>
        </div>
      </div>

      <!-- Role Scope Banner -->
      <div class="role-scope-notice teacher" *ngIf="isTeacher">
        <mat-icon>school</mat-icon>
        <span><strong>Class Teacher Scope Active:</strong> Showing leave applications for students belonging to your assigned Class & Section. You can review and approve them directly.</span>
      </div>
      <div class="role-scope-notice student" *ngIf="isStudentOrParent">
        <mat-icon>account_circle</mat-icon>
        <span><strong>{{currentRoleLabel}} Portal View:</strong> Displaying leave applications for your ward. Once submitted, your Class Teacher or School Admin will review and sanction attendance.</span>
      </div>

      <!-- Stats Bar -->
      <div class="stats-grid">
        <div class="stat-card stat-total">
          <div class="stat-icon-wrap"><mat-icon>description</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{stats.totalLeaves}}</span>
            <span class="stat-lbl">Total Applications</span>
          </div>
        </div>

        <div class="stat-card stat-pending">
          <div class="stat-icon-wrap"><mat-icon>pending_actions</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{stats.pendingLeaves}}</span>
            <span class="stat-lbl">Pending Review</span>
          </div>
          <div class="pulse-badge" *ngIf="stats.pendingLeaves > 0">Action Required</div>
        </div>

        <div class="stat-card stat-approved">
          <div class="stat-icon-wrap"><mat-icon>check_circle</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{stats.approvedLeaves}}</span>
            <span class="stat-lbl">Approved Leaves</span>
          </div>
        </div>

        <div class="stat-card stat-today">
          <div class="stat-icon-wrap"><mat-icon>person_off</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{stats.todayOnLeave}}</span>
            <span class="stat-lbl">Students on Leave Today</span>
          </div>
        </div>
      </div>

      <!-- Controls & Filter Strip -->
      <div class="controls-card">
        <div class="filter-row">
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Status</mat-label>
            <mat-select [(ngModel)]="filterStatus" (selectionChange)="loadLeaves()">
              <mat-option value="">All Statuses</mat-option>
              <mat-option value="Pending">⏳ Pending Review</mat-option>
              <mat-option value="Approved">✅ Approved</mat-option>
              <mat-option value="Rejected">❌ Rejected</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Leave Category</mat-label>
            <mat-select [(ngModel)]="filterCategory" (selectionChange)="loadLeaves()">
              <mat-option value="">All Categories</mat-option>
              <mat-option value="Medical">🏥 Medical / Sick</mat-option>
              <mat-option value="Family Function">🎉 Family Function / Wedding</mat-option>
              <mat-option value="Emergency">🚨 Urgent / Family Emergency</mat-option>
              <mat-option value="Planned">✈️ Planned Vacation</mat-option>
              <mat-option value="Other">📝 Other Reasons</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Class</mat-label>
            <mat-select [(ngModel)]="filterClassId" (selectionChange)="loadLeaves()">
              <mat-option value="">All Classes</mat-option>
              <mat-option *ngFor="let c of classes" [value]="c.id">{{c.name}}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field search-field">
            <mat-label>Search Student, Roll #, Reason</mat-label>
            <input matInput [(ngModel)]="searchTerm" placeholder="Search..." (keyup.enter)="loadLeaves()">
          </mat-form-field>

          <!-- Sharp SVG View Toggle -->
          <div class="view-toggle">
            <button type="button" class="toggle-btn" [class.active-view]="viewMode==='grid'" (click)="viewMode='grid'" matTooltip="Card Grid View">
              <svg class="toggle-svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <rect x="3" y="3" width="8" height="8" rx="1.5" />
                <rect x="13" y="3" width="8" height="8" rx="1.5" />
                <rect x="3" y="13" width="8" height="8" rx="1.5" />
                <rect x="13" y="13" width="8" height="8" rx="1.5" />
              </svg>
            </button>
            <button type="button" class="toggle-btn" [class.active-view]="viewMode==='table'" (click)="viewMode='table'" matTooltip="Table List View">
              <svg class="toggle-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="9" y1="6" x2="21" y2="6"></line>
                <line x1="9" y1="12" x2="21" y2="12"></line>
                <line x1="9" y1="18" x2="21" y2="18"></line>
                <circle cx="4.5" cy="6" r="1.5" fill="currentColor" stroke="none"></circle>
                <circle cx="4.5" cy="12" r="1.5" fill="currentColor" stroke="none"></circle>
                <circle cx="4.5" cy="18" r="1.5" fill="currentColor" stroke="none"></circle>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="!loading && filteredLeaves.length === 0">
        <div class="empty-icon-wrap"><mat-icon>event_available</mat-icon></div>
        <h3>No Student Leave Requests Found</h3>
        <p>No leave records match the current filter selection. Click "Apply Student Leave" to submit a new application.</p>
        <button mat-raised-button class="create-btn" (click)="openApplyDialog()">
          <mat-icon>add_circle</mat-icon> Apply First Leave
        </button>
      </div>

      <!-- GRID VIEW -->
      <div class="leaves-grid" *ngIf="!loading && viewMode==='grid' && filteredLeaves.length > 0">
        <div class="leave-card" *ngFor="let item of filteredLeaves" [ngClass]="item.status.toLowerCase()">
          <!-- Card Header Strip -->
          <div class="card-head">
            <div class="student-avatar-box">
              <mat-icon>person</mat-icon>
            </div>
            <div class="student-head-info">
              <h3 class="student-name" (click)="viewLeaveDetails(item)">{{item.studentName}}</h3>
              <div class="student-sub">
                <span>Roll: <strong>{{item.rollNumber}}</strong></span>
                <span *ngIf="item.className">&bull; Class: <strong>{{item.className}}</strong></span>
              </div>
            </div>
            <span class="status-pill" [ngClass]="item.status.toLowerCase()">
              {{item.status}}
            </span>
          </div>

          <!-- Category & Days Info -->
          <div class="category-strip">
            <span class="cat-chip" [ngClass]="getCategoryClass(item.leaveCategory)">
              <mat-icon class="cat-ic">{{getCategoryIcon(item.leaveCategory)}}</mat-icon>
              <span>{{item.leaveCategory}}</span>
            </span>
            <span class="duration-badge">
              <strong>{{item.totalDays}} {{item.totalDays > 1 ? 'Days' : 'Day'}}</strong>
            </span>
          </div>

          <!-- Date Range Box -->
          <div class="dates-box">
            <div class="date-col">
              <span class="dt-lbl">FROM</span>
              <span class="dt-val">{{formatToISTDate(item.fromDate)}}</span>
            </div>
            <mat-icon class="dt-arrow">arrow_forward</mat-icon>
            <div class="date-col">
              <span class="dt-lbl">TO</span>
              <span class="dt-val">{{formatToISTDate(item.toDate)}}</span>
            </div>
          </div>

          <!-- Reason -->
          <p class="leave-reason" title="{{item.reason}}">{{item.reason}}</p>

          <!-- Attendance Linkage Status -->
          <div class="linkage-status-box" [class.linked]="item.attendanceMarked" [class.unlinked]="!item.attendanceMarked">
            <mat-icon class="link-ic">{{item.attendanceMarked ? 'check_circle' : (item.status === 'Pending' ? 'schedule' : 'cancel')}}</mat-icon>
            <div class="link-text">
              <strong *ngIf="item.attendanceMarked">Attendance Linked ('L' Marked in Register)</strong>
              <strong *ngIf="!item.attendanceMarked && item.status === 'Pending'">Attendance Pending Approval</strong>
              <strong *ngIf="!item.attendanceMarked && item.status === 'Rejected'">Leave Rejected (Not Linked)</strong>
              <span>{{item.appliedBy ? 'Applied by ' + item.appliedBy : 'Parent Application'}}</span>
            </div>
          </div>

          <!-- Attachment tag if any -->
          <div class="att-row" *ngIf="item.attachmentUrl">
            <mat-icon>attachment</mat-icon>
            <a [href]="item.attachmentUrl" target="_blank">View Medical Slip / Attachment</a>
          </div>

          <!-- Reviewer Tag if reviewed -->
          <div class="reviewer-tag" *ngIf="item.reviewedBy">
            <mat-icon>verified</mat-icon>
            <span>Reviewed by: <strong>{{item.reviewedBy}}</strong></span>
          </div>

          <!-- Card Action Footer -->
          <div class="card-footer">
            <button mat-stroked-button class="view-btn" (click)="viewLeaveDetails(item)">
              <mat-icon>visibility</mat-icon> View
            </button>

            <div class="action-buttons">
              <!-- Approve button if pending or rejected (Only for Teachers / Admins) -->
              <button mat-flat-button class="approve-btn" *ngIf="!isStudentOrParent && item.status !== 'Approved'" (click)="quickReview(item, 'Approved')" matTooltip="Approve & Link Attendance">
                <mat-icon>check</mat-icon> Approve
              </button>

              <!-- Reject button if pending or approved (Only for Teachers / Admins) -->
              <button mat-stroked-button class="reject-btn" *ngIf="!isStudentOrParent && item.status !== 'Rejected'" (click)="quickReview(item, 'Rejected')" matTooltip="Reject Application">
                <mat-icon>close</mat-icon> Reject
              </button>

              <!-- Delete (Admins/Teachers or pending applications) -->
              <button mat-icon-button class="del-btn" *ngIf="!isStudentOrParent || item.status === 'Pending'" (click)="deleteLeave(item)" matTooltip="Delete Application">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- TABLE VIEW -->
      <div class="table-card-wrap" *ngIf="!loading && viewMode==='table' && filteredLeaves.length > 0">
        <table class="leaves-table">
          <thead>
            <tr>
              <th>Student Details</th>
              <th>Category</th>
              <th>From Date</th>
              <th>To Date</th>
              <th>Days</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Attendance Register Link</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of filteredLeaves" [ngClass]="item.status.toLowerCase() + '-tr'">
              <td>
                <div class="tbl-student-name" (click)="viewLeaveDetails(item)">{{item.studentName}}</div>
                <div class="tbl-student-sub">Roll: {{item.rollNumber}} &bull; {{item.className || 'General'}}</div>
              </td>
              <td>
                <span class="cat-chip" [ngClass]="getCategoryClass(item.leaveCategory)">
                  {{item.leaveCategory}}
                </span>
              </td>
              <td><strong>{{formatToISTDate(item.fromDate)}}</strong></td>
              <td><strong>{{formatToISTDate(item.toDate)}}</strong></td>
              <td><span class="days-pill">{{item.totalDays}} d</span></td>
              <td>
                <div class="tbl-reason" title="{{item.reason}}">{{item.reason | slice:0:55}}...</div>
              </td>
              <td>
                <span class="status-pill" [ngClass]="item.status.toLowerCase()">
                  {{item.status}}
                </span>
              </td>
              <td>
                <div class="link-tag" [class.linked]="item.attendanceMarked">
                  <mat-icon class="lt-ic">{{item.attendanceMarked ? 'check_circle' : 'schedule'}}</mat-icon>
                  <span>{{item.attendanceMarked ? 'Synced (Leave Mark)' : 'Pending / Not Synced'}}</span>
                </div>
              </td>
              <td>
                <div class="tbl-actions">
                  <button mat-icon-button (click)="viewLeaveDetails(item)" matTooltip="View Slip">
                    <mat-icon style="color:#2563eb;">visibility</mat-icon>
                  </button>
                  <button mat-icon-button *ngIf="!isStudentOrParent && item.status !== 'Approved'" (click)="quickReview(item, 'Approved')" matTooltip="Approve & Link">
                    <mat-icon style="color:#16a34a;">check_circle</mat-icon>
                  </button>
                  <button mat-icon-button *ngIf="!isStudentOrParent && item.status !== 'Rejected'" (click)="quickReview(item, 'Rejected')" matTooltip="Reject">
                    <mat-icon style="color:#dc2626;">cancel</mat-icon>
                  </button>
                  <button mat-icon-button *ngIf="!isStudentOrParent || item.status === 'Pending'" (click)="deleteLeave(item)" matTooltip="Delete">
                    <mat-icon style="color:#64748b;">delete</mat-icon>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .leaves-page-container { padding: 24px; display: flex; flex-direction: column; gap: 20px; background: #f8fafc; min-height: 100vh; }
    .page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; background: #fff; padding: 20px 24px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-icon-box { background: #2563eb; color: #fff; border-radius: 12px; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25); }
    .header-icon-box mat-icon { font-size: 26px; width: 26px; height: 26px; }
    .page-title { margin: 0; font-size: 20px; font-weight: 800; color: #1e3a8a; }
    .page-subtitle { margin: 4px 0 0; font-size: 13px; color: #64748b; }
    .header-actions { display: flex; align-items: center; gap: 10px; }
    .refresh-btn { color: #475569; }
    .create-btn { background: #2563eb !important; color: #fff !important; font-weight: 700; border-radius: 8px; }
    .spin { animation: spin 1s infinite linear; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    /* Stats */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    .stat-card { background: #fff; border-radius: 12px; padding: 18px 20px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; align-items: center; gap: 16px; position: relative; }
    .stat-icon-wrap { width: 46px; height: 46px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .stat-icon-wrap mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .stat-total .stat-icon-wrap { background: #eff6ff; color: #2563eb; }
    .stat-pending .stat-icon-wrap { background: #fffbeb; color: #d97706; }
    .stat-approved .stat-icon-wrap { background: #f0fdf4; color: #16a34a; }
    .stat-today .stat-icon-wrap { background: #fef2f2; color: #dc2626; }
    .stat-val { font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1; }
    .stat-lbl { font-size: 12px; color: #64748b; margin-top: 4px; display: block; font-weight: 600; }
    .pulse-badge { position: absolute; top: 12px; right: 14px; background: #f59e0b; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 10px; letter-spacing: 0.3px; }

    /* Controls Strip */
    .controls-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .filter-row { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
    .filter-field { width: 170px; margin-bottom: -1.25em; }
    .search-field { flex: 1; min-width: 220px; }
    .view-toggle { display: inline-flex; align-items: center; gap: 3px; background: #f8fafc; border: 1.5px solid #94a3b8; border-radius: 8px; padding: 3px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .toggle-btn { width: 34px !important; height: 34px !important; min-width: 34px !important; padding: 0 !important; margin: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; border-radius: 6px !important; border: 1px solid transparent !important; background: transparent; color: #334155; cursor: pointer; transition: all 0.15s ease-in-out; }
    .toggle-btn:hover:not(.active-view) { background: #e2e8f0; color: #0f172a; }
    .toggle-btn.active-view { background: #2563eb !important; color: #ffffff !important; border-color: #1d4ed8 !important; box-shadow: 0 2px 4px rgba(37,99,235,0.35) !important; }
    .toggle-svg { display: block; width: 18px; height: 18px; }

    /* Grid View */
    .leaves-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 18px; }
    .leave-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 12px; transition: transform 0.15s, box-shadow 0.15s; }
    .leave-card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.08); border-color: #cbd5e1; }
    .leave-card.pending { border-left: 4px solid #f59e0b; }
    .leave-card.approved { border-left: 4px solid #16a34a; }
    .leave-card.rejected { border-left: 4px solid #dc2626; opacity: 0.9; }

    .card-head { display: flex; align-items: center; gap: 12px; }
    .student-avatar-box { width: 42px; height: 42px; border-radius: 10px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; }
    .student-avatar-box mat-icon { font-size: 24px; }
    .student-head-info { flex: 1; min-width: 0; }
    .student-name { margin: 0; font-size: 15.5px; font-weight: 800; color: #0f172a; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .student-name:hover { color: #2563eb; text-decoration: underline; }
    .student-sub { font-size: 11.5px; color: #64748b; margin-top: 2px; }

    .status-pill { font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .status-pill.pending { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
    .status-pill.approved { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
    .status-pill.rejected { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }

    .category-strip { display: flex; justify-content: space-between; align-items: center; }
    .cat-chip { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; }
    .cat-ic { font-size: 13px; width: 13px; height: 13px; }
    .cat-medical { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .cat-family { background: #faf5ff; color: #7e22ce; border: 1px solid #e9d5ff; }
    .cat-urgent { background: #fff7ed; color: #ea580c; border: 1px solid #fed7aa; }
    .cat-planned { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
    .cat-other { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

    .duration-badge { font-size: 11.5px; color: #0f172a; background: #f1f5f9; padding: 2px 8px; border-radius: 6px; }

    .dates-box { display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; }
    .date-col { display: flex; flex-direction: column; }
    .dt-lbl { font-size: 9.5px; font-weight: 800; color: #64748b; letter-spacing: 0.5px; }
    .dt-val { font-size: 12.5px; font-weight: 700; color: #0f172a; }
    .dt-arrow { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; }

    .leave-reason { margin: 0; font-size: 13px; color: #334155; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

    .linkage-status-box { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; font-size: 11.5px; }
    .linkage-status-box.linked { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
    .linkage-status-box.unlinked { background: #f8fafc; border: 1px solid #e2e8f0; color: #64748b; }
    .link-ic { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; }
    .link-text { display: flex; flex-direction: column; }
    .link-text strong { font-size: 11.5px; }
    .link-text span { font-size: 10.5px; color: #64748b; }

    .att-row { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #2563eb; }
    .att-row mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .att-row a { color: #2563eb; text-decoration: none; font-weight: 600; }
    .att-row a:hover { text-decoration: underline; }

    .card-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 10px; margin-top: auto; }
    .view-btn { font-size: 11.5px; font-weight: 700; height: 32px; padding: 0 10px; color: #1e3a8a; }
    .view-btn mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 4px; }
    .action-buttons { display: flex; align-items: center; gap: 6px; }
    .approve-btn { background: #16a34a !important; color: #fff !important; font-size: 11.5px; font-weight: 700; height: 32px; border-radius: 6px; }
    .approve-btn mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 2px; }
    .reject-btn { color: #dc2626; border-color: #fecaca; font-size: 11.5px; font-weight: 700; height: 32px; border-radius: 6px; }
    .reject-btn mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 2px; }
    .del-btn { color: #94a3b8; width: 32px !important; height: 32px !important; padding: 0 !important; }
    .del-btn:hover { color: #dc2626; }

    .role-scope-notice { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-radius: 8px; font-size: 13px; line-height: 1.4; }
    .role-scope-notice.teacher { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
    .role-scope-notice.student { background: #fdf4ff; border: 1px solid #f0abfc; color: #86198f; }
    .role-scope-notice mat-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }

    .reviewer-tag { display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 11.5px; color: #334155; }
    .reviewer-tag mat-icon { font-size: 14px; width: 14px; height: 14px; color: #2563eb; }

    /* Table styles */
    .table-card-wrap { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .leaves-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    .leaves-table th { background: #f8fafc; color: #475569; font-weight: 700; padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .leaves-table td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; color: #1e293b; vertical-align: middle; }
    .leaves-table tr:hover { background: #f8fafc; }
    .tbl-student-name { font-weight: 700; color: #0f172a; cursor: pointer; }
    .tbl-student-name:hover { color: #2563eb; text-decoration: underline; }
    .tbl-student-sub { font-size: 11px; color: #64748b; }
    .days-pill { font-weight: 700; background: #eff6ff; color: #1e40af; padding: 2px 7px; border-radius: 4px; font-size: 11px; }
    .tbl-reason { max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #475569; }
    .link-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600; color: #64748b; }
    .link-tag.linked { color: #15803d; }
    .lt-ic { font-size: 15px; width: 15px; height: 15px; }
    .tbl-actions { display: flex; align-items: center; gap: 4px; }

    /* Empty state */
    .empty-state { background: #fff; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 60px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .empty-icon-wrap { width: 64px; height: 64px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; }
    .empty-icon-wrap mat-icon { font-size: 32px; width: 32px; height: 32px; }
    .empty-state h3 { margin: 0; font-size: 18px; color: #1e293b; font-weight: 700; }
    .empty-state p { margin: 0; font-size: 13px; color: #64748b; max-width: 440px; }

    /* Responsive */
    @media (max-width: 768px) {
      .leaves-page-container { padding: 12px; gap: 14px; }
      .page-header { padding: 14px; flex-direction: column; align-items: flex-start; gap: 14px; }
      .header-actions { width: 100%; display: flex; justify-content: space-between; }
      .filter-row { flex-direction: column; align-items: stretch; gap: 10px; }
      .filter-field { width: 100% !important; min-width: 100% !important; }
      .search-field { width: 100% !important; }
      .controls-card { padding: 14px; }
      .stats-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class StudentLeavesComponent implements OnInit {
  leaves: StudentLeaveDto[] = [];
  classes: any[] = [];
  loading = false;
  viewMode: 'grid' | 'table' = 'grid';

  filterStatus = '';
  filterCategory = '';
  filterClassId = '';
  searchTerm = '';

  stats: StudentLeaveStatsDto = {
    totalLeaves: 0,
    pendingLeaves: 0,
    approvedLeaves: 0,
    rejectedLeaves: 0,
    todayOnLeave: 0
  };

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService,
    public authService: AuthService
  ) {}

  get isStudentOrParent(): boolean {
    const role = this.authService.currentUser()?.role || '';
    return role === 'Student' || role === 'Parent';
  }

  get isTeacher(): boolean {
    const role = this.authService.currentUser()?.role || '';
    return role === 'Teacher';
  }

  get currentRoleLabel(): string {
    return this.authService.currentUser()?.role || 'Admin';
  }

  formatToISTDate(dateVal: string | Date | undefined): string {
    if (!dateVal) return '—';
    try {
      let s = String(dateVal);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T00:00:00';
      const d = new Date(s);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return String(dateVal);
    }
  }

  ngOnInit(): void {
    this.loadClasses();
    this.loadStats();
    this.loadLeaves();
  }

  loadClasses(): void {
    this.http.get<any[]>(`${API_BASE}/school/classes`).subscribe({
      next: r => this.classes = r,
      error: () => this.classes = []
    });
  }

  loadStats(): void {
    this.http.get<StudentLeaveStatsDto>(`${API_BASE}/studentleaves/stats`).subscribe({
      next: s => this.stats = s,
      error: () => {}
    });
  }

  loadLeaves(): void {
    this.loading = true;
    let url = `${API_BASE}/studentleaves`;
    const params: string[] = [];
    if (this.filterStatus) params.push(`status=${encodeURIComponent(this.filterStatus)}`);
    if (this.filterCategory) params.push(`category=${encodeURIComponent(this.filterCategory)}`);
    if (this.filterClassId) params.push(`classId=${this.filterClassId}`);
    if (this.searchTerm.trim()) params.push(`search=${encodeURIComponent(this.searchTerm.trim())}`);
    if (params.length > 0) url += '?' + params.join('&');

    this.http.get<StudentLeaveDto[]>(url).subscribe({
      next: r => {
        this.leaves = r;
        this.loading = false;
        this.loadStats();
      },
      error: () => {
        this.leaves = [];
        this.loading = false;
      }
    });
  }

  get filteredLeaves(): StudentLeaveDto[] {
    return this.leaves;
  }

  getCategoryClass(cat: string): string {
    switch (cat) {
      case 'Medical': return 'cat-medical';
      case 'Family Function': return 'cat-family';
      case 'Emergency': return 'cat-urgent';
      case 'Planned': return 'cat-planned';
      default: return 'cat-other';
    }
  }

  getCategoryIcon(cat: string): string {
    switch (cat) {
      case 'Medical': return 'medical_services';
      case 'Family Function': return 'celebration';
      case 'Emergency': return 'emergency';
      case 'Planned': return 'flight';
      default: return 'event_note';
    }
  }

  openApplyDialog(): void {
    const ref = this.dialog.open(ApplyStudentLeaveDialogComponent, {
      width: '620px',
      maxWidth: '95vw',
      data: { classes: this.classes }
    });

    ref.afterClosed().subscribe((res: any) => {
      if (!res) return;
      this.loadLeaves();
      this.confirmDialog.alert(
        'Leave Application Submitted 🎉',
        `Leave for ${res.studentName} (${res.totalDays} days) has been submitted for approval.`,
        'success'
      );
    });
  }

  quickReview(item: StudentLeaveDto, status: 'Approved' | 'Rejected'): void {
    const actionText = status === 'Approved' ? 'Approve Application' : 'Reject Application';
    const confirmMsg = status === 'Approved'
      ? `Are you sure you want to APPROVE leave for ${item.studentName}? Attendance register will automatically be marked 'L' (Leave) from ${this.formatToISTDate(item.fromDate)} to ${this.formatToISTDate(item.toDate)}.`
      : `Are you sure you want to REJECT leave for ${item.studentName}? Any sanctioned attendance link will be removed.`;

    this.confirmDialog.confirm(
      `${actionText} (${item.studentName})`,
      confirmMsg,
      actionText,
      'Cancel',
      status === 'Approved' ? 'info' : 'danger'
    ).subscribe(ok => {
      if (!ok) return;

      this.http.put<any>(`${API_BASE}/studentleaves/${item.id}/review`, {
        status: status,
        reviewRemarks: status === 'Approved' ? 'Approved by Class Teacher / Academic Office' : 'Declined by Class Teacher / Academic Office'
      }).subscribe({
        next: (res) => {
          this.loadLeaves();
          this.loadStats();
          const alertNote = res?.whatsappAlertDispatched ? ' 📱 WhatsApp status alert sent to parent.' : '';
          this.confirmDialog.alert(
            `Leave ${status} 🎉`,
            `Leave application for ${item.studentName} has been ${status.toLowerCase()} by ${res?.reviewedBy || 'Academic Office'} and attendance records synchronized.${alertNote}`,
            'success'
          );
        },
        error: (err) => {
          const msg = err.error?.message || 'Failed to update leave review status.';
          this.confirmDialog.alert('Review Action Failed', msg, 'danger');
        }
      });
    });
  }

  viewLeaveDetails(item: StudentLeaveDto): void {
    this.dialog.open(ViewStudentLeaveDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: { leave: item }
    });
  }

  deleteLeave(item: StudentLeaveDto): void {
    this.confirmDialog.confirm(
      'Delete Leave Application',
      `Are you sure you want to permanently delete leave application for ${item.studentName} (${this.formatToISTDate(item.fromDate)} - ${this.formatToISTDate(item.toDate)})?`,
      'Delete Application',
      'Cancel',
      'danger'
    ).subscribe(ok => {
      if (!ok) return;
      this.http.delete(`${API_BASE}/studentleaves/${item.id}`).subscribe({
        next: () => {
          this.loadLeaves();
          this.confirmDialog.alert('Application Deleted', 'Leave application has been removed.', 'success');
        },
        error: () => this.confirmDialog.alert('Error', 'Failed to delete application.', 'danger')
      });
    });
  }
}

// =========================================================================
// Apply Student Leave Dialog (Strict AGENTS.md light-blue header)
// =========================================================================

@Component({
  selector: 'app-apply-student-leave-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule
  ],
  template: `
    <div class="apply-dialog-wrap">
      <!-- Strict AGENTS.md Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>edit_calendar</mat-icon>
          </div>
          <div>
            <h2 class="modal-title">Apply Student Leave</h2>
            <p class="modal-subtitle">
              <strong style="color:#1e40af">Student Attendance Sanction</strong>
              <span> &bull; Parent / Student Official Absence Request</span>
            </p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close(false)" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Form Body -->
      <div class="modal-body">
        <!-- Student Selection -->
        <mat-form-field appearance="outline" class="full-field">
          <mat-label>Select Student (विद्यार्थी चयन करें) *</mat-label>
          <mat-select [(ngModel)]="model.studentId" required (selectionChange)="onStudentSelect()">
            <mat-option *ngFor="let s of students" [value]="s.id">
              {{s.studentName}} (Roll: {{s.rollNumber || '—'}}) &bull; {{s.className || 'General'}}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Leave Category *</mat-label>
            <mat-select [(ngModel)]="model.leaveCategory" required>
              <mat-option value="Medical">🏥 Medical / Illness</mat-option>
              <mat-option value="Family Function">🎉 Family Function / Wedding</mat-option>
              <mat-option value="Emergency">🚨 Urgent / Family Emergency</mat-option>
              <mat-option value="Planned">✈️ Planned Vacation / Travel</mat-option>
              <mat-option value="Other">📝 Other Specific Reason</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Applied By</mat-label>
            <mat-select [(ngModel)]="model.appliedBy">
              <mat-option value="Parent">Parent / Guardian</mat-option>
              <mat-option value="Student">Student</mat-option>
              <mat-option value="Class Teacher">Class Teacher</mat-option>
              <mat-option value="Admin">Academic Office</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Date Range with Strict Greater Than / Less Than Validation -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>From Date (आरंभ तिथि) *</mat-label>
            <input matInput type="date" [(ngModel)]="fromDateStr" (change)="validateDates()" required />
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field">
            <mat-label>To Date (समाप्ति तिथि) *</mat-label>
            <input matInput type="date" [(ngModel)]="toDateStr" [min]="fromDateStr" (change)="validateDates()" required />
          </mat-form-field>
        </div>

        <!-- Date Error Banner -->
        <div class="date-error-banner" *ngIf="dateError">
          <mat-icon>error</mat-icon>
          <span>{{ dateError }}</span>
        </div>

        <!-- Duration Summary -->
        <div class="duration-summary" *ngIf="!dateError && calculatedDays > 0">
          <mat-icon>schedule</mat-icon>
          <span>Total Sanction Period: <strong>{{calculatedDays}} {{calculatedDays > 1 ? 'Days' : 'Day'}}</strong> (Both dates inclusive)</span>
        </div>

        <mat-form-field appearance="outline" class="full-field">
          <mat-label>Reason for Leave (छुट्टी का कारण) *</mat-label>
          <textarea matInput [(ngModel)]="model.reason" rows="3" placeholder="Explain health condition, doctor advice, family travel details..." required></textarea>
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Parent / Guardian Phone</mat-label>
            <input matInput [(ngModel)]="model.parentContactNumber" placeholder="+91 9876543210" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Attachment / Medical Slip Link</mat-label>
            <input matInput [(ngModel)]="model.attachmentUrl" placeholder="https://... (Optional doc/prescription)" />
          </mat-form-field>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button mat-button (click)="dialogRef.close(false)" class="cancel-btn">Cancel</button>
        <button mat-raised-button class="save-btn" (click)="submitLeave()" [disabled]="saving || !model.studentId || !model.reason || !fromDateStr || !toDateStr || !!dateError">
          <mat-icon>send</mat-icon>
          <span>Submit Application</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .apply-dialog-wrap { display: flex; flex-direction: column; background: #fff; border-radius: 12px; overflow: hidden; }
    .modal-header { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-bottom: 1px solid #bfdbfe; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .header-icon-box { background: #2563eb; color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25); width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
    .modal-title { color: #1e3a8a; font-weight: 700; margin: 0; font-size: 18px; }
    .modal-subtitle { color: #3b82f6; margin: 3px 0 0; font-size: 12px; }
    .close-btn { color: #64748b; }
    .close-btn:hover { color: #1e293b; }

    .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 14px; max-height: 72vh; overflow-y: auto; }
    .form-row { display: flex; gap: 14px; }
    .form-field { flex: 1; }
    .full-field { width: 100%; }

    .date-error-banner { display: flex; align-items: center; gap: 10px; background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 8px; padding: 10px 14px; color: #991b1b; font-size: 13px; font-weight: 600; }
    .date-error-banner mat-icon { font-size: 20px; width: 20px; height: 20px; color: #dc2626; flex-shrink: 0; }

    .duration-summary { display: flex; align-items: center; gap: 8px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 8px 12px; color: #1e40af; font-size: 12.5px; }
    .duration-summary mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }

    .modal-footer { padding: 14px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px; }
    .cancel-btn { color: #64748b; }
    .save-btn { background: #2563eb !important; color: #fff !important; font-weight: 700; }
  `]
})
export class ApplyStudentLeaveDialogComponent implements OnInit {
  students: any[] = [];
  saving = false;
  fromDateStr = '';
  toDateStr = '';
  dateError = '';
  calculatedDays = 0;

  model: any = {
    studentId: '',
    leaveCategory: 'Medical',
    appliedBy: 'Parent',
    reason: '',
    parentContactNumber: '',
    attachmentUrl: ''
  };

  constructor(
    public dialogRef: MatDialogRef<ApplyStudentLeaveDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    const role = this.authService.currentUser()?.role;
    if (role === 'Parent') this.model.appliedBy = 'Parent';
    else if (role === 'Student') this.model.appliedBy = 'Student';
    else if (role === 'Teacher') this.model.appliedBy = 'Class Teacher';

    const pad = (n: number) => n.toString().padStart(2, '0');
    const now = new Date();
    this.fromDateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    this.toDateStr = this.fromDateStr;
    this.validateDates();
    this.loadStudents();
  }

  loadStudents(): void {
    this.http.get<any[]>(`${API_BASE}/students`).subscribe({
      next: res => {
        this.students = res;
        if (this.students.length > 0) {
          this.model.studentId = this.students[0].id;
          this.onStudentSelect();
        }
      },
      error: () => this.students = []
    });
  }

  onStudentSelect(): void {
    const s = this.students.find(x => x.id === this.model.studentId);
    if (s) {
      this.model.parentContactNumber = s.fatherPhone || s.emergencyContact || '';
    }
  }

  validateDates(): void {
    if (this.fromDateStr && this.toDateStr) {
      if (this.toDateStr < this.fromDateStr) {
        this.dateError = 'To Date cannot be earlier than From Date (समाप्ति तिथि, आरंभ तिथि से पहले नहीं हो सकती).';
        this.calculatedDays = 0;
        return;
      }
      const d1 = new Date(this.fromDateStr);
      const d2 = new Date(this.toDateStr);
      const diffTime = d2.getTime() - d1.getTime();
      this.calculatedDays = Math.round(diffTime / (1000 * 3600 * 24)) + 1;
    }
    this.dateError = '';
  }

  submitLeave(): void {
    this.validateDates();
    if (this.dateError) return;

    this.saving = true;
    const payload = {
      studentId: this.model.studentId,
      leaveCategory: this.model.leaveCategory,
      fromDate: `${this.fromDateStr}T00:00:00`,
      toDate: `${this.toDateStr}T23:59:59`,
      reason: this.model.reason,
      parentContactNumber: this.model.parentContactNumber,
      attachmentUrl: this.model.attachmentUrl,
      appliedBy: this.model.appliedBy
    };

    this.http.post<any>(`${API_BASE}/studentleaves`, payload).subscribe({
      next: (created) => {
        this.saving = false;
        const student = this.students.find(x => x.id === this.model.studentId);
        this.dialogRef.close({
          studentName: student ? student.studentName : 'Student',
          totalDays: created.totalDays
        });
      },
      error: (err) => {
        this.saving = false;
        const msg = err.error?.message || 'Failed to submit leave application.';
        this.confirmDialog.alert('Application Conflict / Error', msg, 'danger');
      }
    });
  }
}

// =========================================================================
// Official View Leave Application Slip Dialog (Strict AGENTS.md light-blue header)
// =========================================================================

@Component({
  selector: 'app-view-student-leave-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="view-dialog-wrap">
      <!-- Strict AGENTS.md Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>receipt_long</mat-icon>
          </div>
          <div>
            <h2 class="modal-title">Official Student Leave Record</h2>
            <p class="modal-subtitle">
              <strong style="color:#1e40af">{{data.leave.studentName}}</strong>
              <span> &bull; Roll: {{data.leave.rollNumber}} &bull; {{data.leave.status}}</span>
            </p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-stroked-button class="print-btn" (click)="printSlip()">
            <mat-icon>print</mat-icon> Print Slip
          </button>
          <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Printable Slip Content -->
      <div class="slip-paper" id="printable-leave-slip">
        <!-- Institution Header -->
        <div class="slip-hdr">
          <h1 class="inst-name">APEX SCHOOL & ACADEMY</h1>
          <p class="inst-sub">Student Absence Sanction Record & Attendance Linkage Certificate</p>
          <div class="slip-badge" [ngClass]="data.leave.status.toLowerCase()">
            LEAVE STATUS: {{data.leave.status.toUpperCase()}}
          </div>
        </div>

        <div class="divider-line"></div>

        <!-- Student Meta Table -->
        <div class="meta-grid">
          <div class="meta-item">
            <span class="m-lbl">STUDENT NAME</span>
            <span class="m-val">{{data.leave.studentName}}</span>
          </div>
          <div class="meta-item">
            <span class="m-lbl">ROLL NUMBER</span>
            <span class="m-val">{{data.leave.rollNumber || '—'}}</span>
          </div>
          <div class="meta-item">
            <span class="m-lbl">CLASS / SECTION</span>
            <span class="m-val">{{data.leave.className || 'General'}}</span>
          </div>
          <div class="meta-item">
            <span class="m-lbl">LEAVE CATEGORY</span>
            <span class="m-val">{{data.leave.leaveCategory}}</span>
          </div>
          <div class="meta-item">
            <span class="m-lbl">FROM DATE</span>
            <span class="m-val">{{formatDate(data.leave.fromDate)}}</span>
          </div>
          <div class="meta-item">
            <span class="m-lbl">TO DATE</span>
            <span class="m-val">{{formatDate(data.leave.toDate)}}</span>
          </div>
          <div class="meta-item">
            <span class="m-lbl">TOTAL DURATION</span>
            <span class="m-val highlight">{{data.leave.totalDays}} Days</span>
          </div>
          <div class="meta-item">
            <span class="m-lbl">PARENT CONTACT</span>
            <span class="m-val">{{data.leave.parentContactNumber || '—'}}</span>
          </div>
        </div>

        <!-- Attendance Linkage Note -->
        <div class="link-banner" [class.linked]="data.leave.attendanceMarked">
          <mat-icon>{{data.leave.attendanceMarked ? 'verified' : 'info'}}</mat-icon>
          <div>
            <strong>{{data.leave.attendanceMarked ? 'Attendance Linked (Sanctioned Leave)' : 'Attendance Not Linked'}}</strong>
            <p *ngIf="data.leave.attendanceMarked">
              This student's attendance register for the sanctioned date range is marked 'L' (Sanctioned Leave). Percentage will not be penalized as uninformed absence.
            </p>
            <p *ngIf="!data.leave.attendanceMarked">
              Application is either pending approval or rejected.
            </p>
          </div>
        </div>

        <!-- Reason -->
        <div class="section-box">
          <span class="box-title">STATEMENT / REASON OF ABSENCE:</span>
          <p class="box-content">{{data.leave.reason}}</p>
        </div>

        <!-- Remarks if any -->
        <div class="section-box" *ngIf="data.leave.reviewRemarks">
          <span class="box-title">REVIEW REMARKS / INSTRUCTIONS:</span>
          <p class="box-content">{{data.leave.reviewRemarks}}</p>
        </div>

        <!-- Attachment -->
        <div class="att-box" *ngIf="data.leave.attachmentUrl">
          <mat-icon>attach_file</mat-icon>
          <span>Supporting Document: <a [href]="data.leave.attachmentUrl" target="_blank">{{data.leave.attachmentUrl}}</a></span>
        </div>

        <!-- Signature Block -->
        <div class="sign-grid">
          <div class="sign-cell">
            <div class="sign-dash"></div>
            <span>Parent / Guardian Signature</span>
          </div>
          <div class="sign-cell">
            <div class="sign-dash"></div>
            <span>Class Teacher Signature</span>
          </div>
          <div class="sign-cell">
            <div class="sign-dash"></div>
            <span>Principal / Academic Head</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .view-dialog-wrap { display: flex; flex-direction: column; background: #f1f5f9; border-radius: 12px; overflow: hidden; max-height: 90vh; }
    .modal-header { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-bottom: 1px solid #bfdbfe; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .header-icon-box { background: #2563eb; color: #ffffff; border-radius: 10px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; }
    .modal-title { color: #1e3a8a; font-weight: 700; margin: 0; font-size: 17px; }
    .modal-subtitle { color: #3b82f6; margin: 2px 0 0; font-size: 11.5px; }
    .header-actions { display: flex; align-items: center; gap: 8px; }
    .print-btn { background: #2563eb; color: #fff; font-weight: 700; border-radius: 6px; }
    .close-btn { color: #64748b; }

    /* Paper */
    .slip-paper { background: #fff; margin: 20px; padding: 30px 36px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow-y: auto; border: 1px solid #e2e8f0; font-family: sans-serif; color: #1e293b; }
    .slip-hdr { text-align: center; margin-bottom: 16px; }
    .inst-name { font-size: 20px; font-weight: 900; margin: 0; color: #1e3a8a; letter-spacing: 1px; }
    .inst-sub { font-size: 11px; color: #64748b; margin: 3px 0 10px; font-weight: 600; }
    .slip-badge { display: inline-block; font-size: 10.5px; font-weight: 800; padding: 3px 12px; border-radius: 12px; text-transform: uppercase; }
    .slip-badge.pending { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
    .slip-badge.approved { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
    .slip-badge.rejected { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }

    .divider-line { height: 2px; background: #e2e8f0; margin: 16px 0; }

    .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 18px; }
    .meta-item { display: flex; flex-direction: column; }
    .m-lbl { font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 0.5px; }
    .m-val { font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px; }
    .m-val.highlight { color: #2563eb; }

    .link-banner { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 8px; font-size: 12px; margin-bottom: 18px; background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; }
    .link-banner.linked { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
    .link-banner mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .link-banner p { margin: 2px 0 0; font-size: 11px; }

    .section-box { margin-bottom: 16px; }
    .box-title { font-size: 10.5px; font-weight: 800; color: #64748b; letter-spacing: 0.5px; display: block; margin-bottom: 4px; }
    .box-content { font-size: 13.5px; line-height: 1.5; color: #1e293b; margin: 0; background: #f8fafc; padding: 10px 12px; border-radius: 6px; border: 1px solid #e2e8f0; }

    .att-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 8px 12px; font-size: 11.5px; display: flex; align-items: center; gap: 6px; margin-bottom: 24px; }
    .att-box mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2563eb; }

    .sign-grid { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 10px; }
    .sign-cell { display: flex; flex-direction: column; align-items: center; text-align: center; width: 160px; }
    .sign-dash { width: 130px; border-bottom: 1px solid #64748b; margin-bottom: 6px; }
    .sign-cell span { font-size: 10.5px; font-weight: 700; color: #475569; }
  `]
})
export class ViewStudentLeaveDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ViewStudentLeaveDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { leave: StudentLeaveDto }
  ) {}

  formatDate(d?: string): string {
    if (!d) return '—';
    try {
      let s = String(d);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T00:00:00';
      return new Date(s).toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return String(d);
    }
  }

  printSlip(): void {
    const printContent = document.getElementById('printable-leave-slip');
    if (!printContent) return;
    const win = window.open('', '', 'width=800,height=800');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Student Leave Slip - ${this.data.leave.studentName}</title>
          <style>
            body { font-family: sans-serif; margin: 30px; color: #000; }
            .inst-name { font-size: 20px; font-weight: bold; text-align: center; margin: 0; }
            .inst-sub { font-size: 11px; text-align: center; margin: 4px 0 12px; color: #444; }
            .slip-badge { text-align: center; font-weight: bold; font-size: 11px; margin-bottom: 10px; }
            .divider-line { border-bottom: 2px solid #000; margin: 15px 0; }
            .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
            .m-lbl { font-size: 9px; font-weight: bold; color: #555; }
            .m-val { font-size: 12px; font-weight: bold; }
            .box-title { font-size: 10px; font-weight: bold; margin-bottom: 4px; display: block; }
            .box-content { font-size: 12px; margin: 0 0 15px; border: 1px solid #ccc; padding: 8px; }
            .sign-grid { display: flex; justify-content: space-between; margin-top: 50px; }
            .sign-cell { text-align: center; width: 160px; font-size: 10px; font-weight: bold; }
            .sign-dash { border-bottom: 1px solid #000; margin-bottom: 4px; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    win.document.close();
  }
}
