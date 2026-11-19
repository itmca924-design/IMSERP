import { Component, OnInit, Inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterModule } from '@angular/router';
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
import { RequestStudentLeaveCancellationDialogComponent, ReviewStudentLeaveCancellationDialogComponent } from './student-leave-cancel-dialog.component';
import { environment } from '../../../environments/environment';

const API_BASE = environment.apiUrl;

export interface StudentLeaveDto {
  id: string;
  tenantId: string;
  branchId?: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  className?: string;
  sectionName?: string;
  batchId?: string;
  batchName?: string;
  coachingRollNumber?: string;
  parentContactNumber?: string;
  leaveCategory: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  attachmentUrl?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | 'CancellationRequested' | 'PartiallyCancelled';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
  attendanceMarked: boolean;
  appliedBy: string;
  createdAt: string;
  updatedAt: string;
  isCancellationRequested?: boolean;
  isPartialCancellation?: boolean;
  cancellationFromDate?: string;
  cancellationToDate?: string;
  cancellationReason?: string;
  cancellationRequestedAt?: string;
  cancellationReviewedBy?: string;
  cancellationReviewedAt?: string;
  cancellationReviewRemarks?: string;
  isCancellationApproved?: boolean;
}

export interface StudentLeaveStatsDto {
  totalLeaves: number;
  pendingLeaves: number;
  approvedLeaves: number;
  rejectedLeaves: number;
  todayOnLeave: number;
  cancellationPendingLeaves?: number;
}

@Component({
  selector: 'app-student-leaves',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, RouterModule, MatDialogModule, MatButtonModule, MatIconModule,
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
          <a matButton="filled" class="refresh-btn" routerLink="/students/gate-pass" style="color:#2563eb; border-color:#bfdbfe;">
            <mat-icon>badge</mat-icon>
            <span>Gate Pass</span>
          </a>
          <button class="refresh-btn" (click)="loadLeaves()" [disabled]="loading" matButton="filled">
            <mat-icon [class.spin]="loading">refresh</mat-icon>
            <span>Refresh</span>
          </button>
          <button class="create-btn" (click)="openApplyDialog()" matButton="filled">
            <mat-icon>add_circle</mat-icon>
            <span>Apply Student Leave</span>
          </button>
        </div>
      </div>
    
      <!-- Role Scope Banner -->
      @if (isTeacher) {
        <div class="role-scope-notice teacher">
          <mat-icon>school</mat-icon>
          <span><strong>Class Teacher Scope Active:</strong> Showing leave applications for students belonging to your assigned Class & Section. You can review and approve them directly.</span>
        </div>
      }
      @if (isStudentOrParent) {
        <div class="role-scope-notice student">
          <mat-icon>account_circle</mat-icon>
          <span><strong>{{currentRoleLabel}} Portal View:</strong> Displaying leave applications for your ward. Once submitted, your Class Teacher or School Admin will review and sanction attendance.</span>
        </div>
      }
    
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
          @if (stats.pendingLeaves > 0) {
            <div class="pulse-badge">Action Required</div>
          }
        </div>
    
        <div class="stat-card stat-approved">
          <div class="stat-icon-wrap"><mat-icon>check_circle</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{stats.approvedLeaves}}</span>
            <span class="stat-lbl">Approved Leaves</span>
          </div>
        </div>
    
        @if (stats.cancellationPendingLeaves && stats.cancellationPendingLeaves > 0) {
          <div class="stat-card stat-cancel-pending">
            <div class="stat-icon-wrap"><mat-icon>event_busy</mat-icon></div>
            <div class="stat-info">
              <span class="stat-val">{{stats.cancellationPendingLeaves}}</span>
              <span class="stat-lbl">Cancellation Pending</span>
            </div>
            <div class="pulse-badge" style="background:#ea580c;">Review Needed</div>
          </div>
        }
    
        <div class="stat-card stat-today">
          <div class="stat-icon-wrap"><mat-icon>person_off</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{stats.todayOnLeave}}</span>
            <span class="stat-lbl">Students on Leave Today</span>
          </div>
        </div>
      </div>
    
      <!-- Controls & Filter Strip (Pure Reactive Forms) -->
      <div class="controls-card">
        <form [formGroup]="filterForm" class="filter-form">
          <!-- Dual-Mode Scope Switcher Pills -->
          <div class="scope-pill-row">
            <div class="scope-pills">
              <button type="button" class="scope-pill" [class.active]="filterForm.get('academicScope')?.value === 'All'" (click)="setScope('All')" matButton="filled">
                <mat-icon>domain</mat-icon> All Enrolments
              </button>
              <button type="button" class="scope-pill" [class.active]="filterForm.get('academicScope')?.value === 'School'" (click)="setScope('School')" matButton="filled">
                <mat-icon>school</mat-icon> School Academic Classes
              </button>
              <button type="button" class="scope-pill" [class.active]="filterForm.get('academicScope')?.value === 'Coaching'" (click)="setScope('Coaching')" matButton="filled">
                <mat-icon>groups</mat-icon> Coaching Batches
              </button>
            </div>
          </div>
    
          <div class="filter-row">
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Status</mat-label>
              <mat-select formControlName="status" (selectionChange)="loadLeaves()">
                <mat-option value="">All Statuses</mat-option>
                <mat-option value="Pending">⏳ Pending Review</mat-option>
                <mat-option value="Approved">✅ Approved</mat-option>
                <mat-option value="CancellationRequested">⏳ Cancellation Pending</mat-option>
                <mat-option value="PartiallyCancelled">⚡ Partially Cancelled</mat-option>
                <mat-option value="Cancelled">🚫 Cancelled</mat-option>
                <mat-option value="Rejected">❌ Rejected</mat-option>
              </mat-select>
            </mat-form-field>
    
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Leave Category</mat-label>
              <mat-select formControlName="category" (selectionChange)="loadLeaves()">
                <mat-option value="">All Categories</mat-option>
                <mat-option value="Medical">🏥 Medical / Sick</mat-option>
                <mat-option value="Family Function">🎉 Family Function / Wedding</mat-option>
                <mat-option value="Emergency">🚨 Urgent / Family Emergency</mat-option>
                <mat-option value="Planned">✈️ Planned Vacation</mat-option>
                <mat-option value="Other">📝 Other Reasons</mat-option>
              </mat-select>
            </mat-form-field>
    
            <!-- Academic Class Filter (when Scope is All, School, or Coaching) -->
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>{{ filterForm.get('academicScope')?.value === 'Coaching' ? 'Academic Class (कक्षा)' : 'School Class' }}</mat-label>
              <mat-select formControlName="classId" (selectionChange)="onClassFilterChanged()">
                <mat-option value="">All Classes</mat-option>
                @for (c of classes; track c) {
                  <mat-option [value]="c.id">{{c.name}}</mat-option>
                }
              </mat-select>
            </mat-form-field>
    
            <!-- Coaching Batch Filter (when Scope is All or Coaching) -->
            @if (filterForm.get('academicScope')?.value !== 'School') {
              <mat-form-field appearance="outline" class="filter-field">
                <mat-label>Coaching Batch</mat-label>
                <mat-select formControlName="batchId" (selectionChange)="loadLeaves()">
                  <mat-option value="">All Batches</mat-option>
                  @for (b of filteredBatches; track b) {
                    <mat-option [value]="b.id">{{b.name}} ({{b.subject}}){{ b.className ? ' [' + b.className + ']' : '' }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }
    
            <mat-form-field appearance="outline" class="filter-field search-field">
              <mat-label>Search Student, Roll #, Batch, Reason</mat-label>
              <input matInput formControlName="searchTerm" placeholder="Search..." (keyup.enter)="loadLeaves()">
              <button matSuffix type="button" (click)="loadLeaves()" mat-icon-button>
                <mat-icon>search</mat-icon>
              </button>
            </mat-form-field>
    
            <button type="button" class="reset-btn app-button-cancel" (click)="resetFilters()" matButton="filled">
              <mat-icon>refresh</mat-icon> Reset
            </button>
    
            <!-- Sharp SVG View Toggle -->
            <div class="view-toggle">
              <button type="button" class="toggle-btn" [class.active-view]="viewMode==='grid'" (click)="viewMode='grid'" matTooltip="Card Grid View" mat-icon-button>
                <svg class="toggle-svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <rect x="3" y="3" width="8" height="8" rx="1.5" />
                  <rect x="13" y="3" width="8" height="8" rx="1.5" />
                  <rect x="3" y="13" width="8" height="8" rx="1.5" />
                  <rect x="13" y="13" width="8" height="8" rx="1.5" />
                </svg>
              </button>
              <button type="button" class="toggle-btn" [class.active-view]="viewMode==='table'" (click)="viewMode='table'" matTooltip="Table List View" mat-icon-button>
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
        </form>
      </div>
    
      @if (loading) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }
    
      <!-- Empty State -->
      @if (!loading && filteredLeaves.length === 0) {
        <div class="empty-state">
          <div class="empty-icon-wrap"><mat-icon>event_available</mat-icon></div>
          <h3>No Student Leave Requests Found</h3>
          <p>No leave records match the current filter selection. Click "Apply Student Leave" to submit a new application.</p>
          <button class="create-btn" (click)="openApplyDialog()" matButton="filled">
            <mat-icon>add_circle</mat-icon> Apply First Leave
          </button>
        </div>
      }
    
      <!-- GRID VIEW -->
      @if (!loading && viewMode==='grid' && filteredLeaves.length > 0) {
        <div class="leaves-grid">
          @for (item of filteredLeaves; track item) {
            <div class="leave-card" [ngClass]="item.status.toLowerCase()">
              <!-- Card Header Strip -->
              <div class="card-head">
                <div class="student-avatar-box">
                  <mat-icon>person</mat-icon>
                </div>
                <div class="student-head-info">
                  <h3 class="student-name" (click)="viewLeaveDetails(item)">{{item.studentName}}</h3>
                  <div class="student-sub">
                    <span>Roll: <strong>{{item.rollNumber}}</strong></span>
                    @if (item.coachingRollNumber) {
                      <span>&bull; C-Roll: <strong>{{item.coachingRollNumber}}</strong></span>
                    }
                    @if (item.className) {
                      <span>&bull; Class: <strong>{{item.className}}</strong></span>
                    }
                    @if (item.batchName) {
                      <span class="badge-batch">&bull; <mat-icon>groups</mat-icon> <strong>{{item.batchName}}</strong></span>
                    }
                  </div>
                </div>
                <span class="status-pill" [ngClass]="item.status.toLowerCase()">
                  {{item.status === 'CancellationRequested' ? '⏳ Cancel Requested' : (item.status === 'PartiallyCancelled' ? '⚡ Partially Cancelled' : item.status)}}
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
                  @if (item.attendanceMarked) {
                    <strong>Attendance Linked ('L' Marked in Register)</strong>
                  }
                  @if (!item.attendanceMarked && item.status === 'Pending') {
                    <strong>Attendance Pending Approval</strong>
                  }
                  @if (!item.attendanceMarked && item.status === 'Rejected') {
                    <strong>Leave Rejected (Not Linked)</strong>
                  }
                  <span>{{item.appliedBy ? 'Applied by ' + item.appliedBy : 'Parent Application'}}</span>
                </div>
              </div>
              <!-- Attachment tag if any -->
              @if (item.attachmentUrl) {
                <div class="att-row">
                  <mat-icon>attachment</mat-icon>
                  <a [href]="item.attachmentUrl" target="_blank">View Medical Slip / Attachment</a>
                </div>
              }
              <!-- Reviewer Tag if reviewed -->
              @if (item.reviewedBy) {
                <div class="reviewer-tag">
                  <mat-icon>verified</mat-icon>
                  <span>Reviewed by: <strong>{{item.reviewedBy}}</strong></span>
                </div>
              }
              <!-- Card Action Footer -->
              <div class="card-footer">
                <button class="view-btn" (click)="viewLeaveDetails(item)" matButton="filled">
                  <mat-icon>visibility</mat-icon> View
                </button>
                <!-- Cancellation Actions -->
                @if ((item.status === 'Approved' || item.status === 'PartiallyCancelled') && !item.isCancellationRequested) {
                  <button class="cancel-leave-btn"
                    (click)="openRequestCancellationDialog(item)"
                    matTooltip="Request full or partial cancellation with interactive calendar" matButton="filled">
                    <mat-icon>event_busy</mat-icon> Cancel Leave
                  </button>
                }
                @if ((item.status === 'CancellationRequested' || item.isCancellationRequested) && !isStudentOrParent) {
                  <button class="review-cancel-btn"
                    (click)="openReviewCancellationDialog(item)"
                    matTooltip="Review requested leave cancellation" matButton="filled">
                    <mat-icon>rule</mat-icon> Review Cancellation
                  </button>
                }
                @if ((item.status === 'CancellationRequested' || item.isCancellationRequested) && isStudentOrParent) {
                  <span class="pending-cancel-badge">
                    <mat-icon>hourglass_top</mat-icon> Cancellation Under Review
                  </span>
                }
                <div class="action-buttons">
                  <!-- Approve button if pending (Only for Teachers / Admins) -->
                  @if (!isStudentOrParent && item.status === 'Pending') {
                    <button class="approve-btn" (click)="quickReview(item, 'Approved')" matTooltip="Approve & Link Attendance" matButton="filled">
                      <mat-icon>check</mat-icon> Approve
                    </button>
                  }
                  <!-- Reject button if pending (Only for Teachers / Admins) -->
                  @if (!isStudentOrParent && item.status === 'Pending') {
                    <button class="reject-btn" (click)="quickReview(item, 'Rejected')" matTooltip="Reject Application" matButton="filled">
                      <mat-icon>close</mat-icon> Reject
                    </button>
                  }
                  <!-- Delete (Admins/Teachers or pending applications) -->
                  @if (!isStudentOrParent || item.status === 'Pending') {
                    <button class="del-btn" (click)="deleteLeave(item)" matTooltip="Delete Application" mat-icon-button>
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }
    
      <!-- TABLE VIEW -->
      @if (!loading && viewMode==='table' && filteredLeaves.length > 0) {
        <div class="table-card-wrap">
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
              @for (item of filteredLeaves; track item) {
                <tr [ngClass]="item.status.toLowerCase() + '-tr'">
                  <td>
                    <div class="tbl-student-name" (click)="viewLeaveDetails(item)">{{item.studentName}}</div>
                    <div class="tbl-student-sub">
                      <span>Roll: {{item.rollNumber}}</span>
                      @if (item.coachingRollNumber) {
                        <span> &bull; C-Roll: {{item.coachingRollNumber}}</span>
                      }
                      @if (item.className) {
                        <span> &bull; {{item.className}}</span>
                      }
                      @if (item.batchName) {
                        <span class="tbl-batch-badge"> &bull; <mat-icon>groups</mat-icon> {{item.batchName}}</span>
                      }
                    </div>
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
                      {{item.status === 'CancellationRequested' ? '⏳ Cancel Requested' : (item.status === 'PartiallyCancelled' ? '⚡ Partially Cancelled' : item.status)}}
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
                      <button (click)="viewLeaveDetails(item)" matTooltip="View Slip" mat-icon-button>
                        <mat-icon style="color:#2563eb;">visibility</mat-icon>
                      </button>
                      <!-- Cancel Leave Button on Approved / PartiallyCancelled -->
                      @if ((item.status === 'Approved' || item.status === 'PartiallyCancelled') && !item.isCancellationRequested) {
                        <button
                          (click)="openRequestCancellationDialog(item)" matTooltip="Cancel Leave / Partial Dates" mat-icon-button>
                          <mat-icon style="color:#dc2626;">event_busy</mat-icon>
                        </button>
                      }
                      <!-- Review Cancellation Button on CancellationRequested for Teacher/Admin -->
                      @if ((item.status === 'CancellationRequested' || item.isCancellationRequested) && !isStudentOrParent) {
                        <button
                          (click)="openReviewCancellationDialog(item)" matTooltip="Review Leave Cancellation" mat-icon-button>
                          <mat-icon style="color:#ea580c;">rule</mat-icon>
                        </button>
                      }
                      @if (!isStudentOrParent && item.status === 'Pending') {
                        <button (click)="quickReview(item, 'Approved')" matTooltip="Approve & Link" mat-icon-button>
                          <mat-icon style="color:#16a34a;">check_circle</mat-icon>
                        </button>
                      }
                      @if (!isStudentOrParent && item.status === 'Pending') {
                        <button (click)="quickReview(item, 'Rejected')" matTooltip="Reject" mat-icon-button>
                          <mat-icon style="color:#dc2626;">cancel</mat-icon>
                        </button>
                      }
                      @if (!isStudentOrParent || item.status === 'Pending') {
                        <button (click)="deleteLeave(item)" matTooltip="Delete" mat-icon-button>
                          <mat-icon style="color:#64748b;">delete</mat-icon>
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .leaves-page-container { padding: 0 0 40px; display: flex; flex-direction: column; gap: 20px; box-sizing: border-box; width: 100%; }
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

    /* Scope Switcher */
    .scope-pill-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #f1f5f9; }
    .scope-pills { display: inline-flex; background: #f1f5f9; padding: 4px; border-radius: 10px; gap: 4px; }
    .scope-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 8px; border: none; background: transparent; color: #64748b; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s ease-in-out; }
    .scope-pill mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .scope-pill:hover:not(.active) { color: #1e293b; background: rgba(255,255,255,0.6); }
    .scope-pill.active { background: #ffffff; color: #1e40af; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-weight: 700; }

    /* Batch & Coaching Badges */
    .badge-batch, .tbl-batch-badge { display: inline-flex; align-items: center; gap: 3px; color: #7c3aed; font-weight: 700; }
    .badge-batch mat-icon, .tbl-batch-badge mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .coaching-roll-badge { color: #2563eb; font-weight: 700; }
    .reset-btn { color: #64748b; height: 48px; border-radius: 8px; }

    /* Stats */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    .stat-card { background: #fff; border-radius: 12px; padding: 18px 20px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; align-items: center; gap: 16px; position: relative; }
    .stat-icon-wrap { width: 46px; height: 46px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .stat-icon-wrap mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .stat-total .stat-icon-wrap { background: #eff6ff; color: #2563eb; }
    .stat-pending .stat-icon-wrap { background: #fffbeb; color: #d97706; }
    .stat-approved .stat-icon-wrap { background: #f0fdf4; color: #16a34a; }
    .stat-today .stat-icon-wrap { background: #fef2f2; color: #dc2626; }
    .stat-cancel-pending .stat-icon-wrap { background: #fff7ed; color: #ea580c; }
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
    .leave-card.pending { }
    .leave-card.approved { }
    .leave-card.rejected { opacity: 0.9; }

    .card-head { display: flex; align-items: center; gap: 12px; }
    .student-avatar-box { width: 42px; height: 42px; border-radius: 10px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; }
    .student-avatar-box mat-icon { font-size: 24px; }
    .student-head-info { flex: 1; min-width: 0; }
    .student-name { margin: 0; font-size: 15.5px; font-weight: 800; color: #0f172a; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .student-name:hover { color: #2563eb; text-decoration: underline; }
    .student-sub { font-size: 11.5px; color: #64748b; margin-top: 2px; }

    .leave-card.cancellationrequested { background: #fffaf0; }
    .leave-card.partiallycancelled { }
    .leave-card.cancelled { opacity: 0.8; }

    .status-pill { font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .status-pill.pending { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
    .status-pill.approved { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
    .status-pill.cancellationrequested { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
    .status-pill.partiallycancelled { background: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe; }
    .status-pill.cancelled { background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; }
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
    .cancel-leave-btn { color: #dc2626 !important; border-color: #fecaca !important; font-size: 11.5px; font-weight: 700; height: 32px; border-radius: 6px; }
    .cancel-leave-btn:hover { background: #fef2f2 !important; }
    .cancel-leave-btn mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 2px; }
    .review-cancel-btn { background: #ea580c !important; color: #fff !important; font-size: 11.5px; font-weight: 700; height: 32px; border-radius: 6px; }
    .review-cancel-btn mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 2px; }
    .pending-cancel-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #ea580c; background: #fff7ed; border: 1px solid #fed7aa; padding: 4px 8px; border-radius: 6px; }
    .pending-cancel-badge mat-icon { font-size: 14px; width: 14px; height: 14px; }

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
      .leaves-page-container { padding: 8px 0; gap: 14px; }
      .page-header { padding: 14px; flex-direction: column; align-items: stretch; gap: 14px; }
      .header-actions {
        width: 100%;
        display: grid !important;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .header-actions a, .header-actions button {
        width: 100% !important;
        justify-content: center;
        margin: 0 !important;
      }
      .create-btn {
        grid-column: span 2;
        height: 42px !important;
      }
      .refresh-btn {
        height: 38px !important;
      }
      .scope-pill-row {
        width: 100%;
        margin-bottom: 8px;
      }
      .scope-pills {
        display: grid;
        grid-template-columns: 1fr;
        width: 100%;
        min-width: 0;
      }
      .scope-pill {
        width: 100%;
        min-width: 0;
        min-height: 40px;
        justify-content: flex-start;
        text-align: left;
        padding: 8px 12px;
        font-size: 12px;
        white-space: normal;
      }
      :host ::ng-deep .scope-pill .mdc-button__label {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 6px;
        white-space: normal;
        text-align: left;
      }
      .scope-pill mat-icon {
        flex: 0 0 16px;
      }
      .stats-grid {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 10px !important;
      }
      .stat-card {
        padding: 12px 14px;
        gap: 10px;
        border-radius: 10px;
      }
      .stat-icon-wrap {
        width: 38px;
        height: 38px;
        border-radius: 8px;
      }
      .stat-icon-wrap mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
      .stat-val {
        font-size: 19px;
      }
      .stat-lbl {
        font-size: 11px;
        line-height: 1.2;
      }
      .pulse-badge {
        font-size: 8.5px;
        padding: 1px 5px;
        top: 8px;
        right: 8px;
      }
      .filter-row { flex-direction: column; align-items: stretch; gap: 10px; }
      .filter-field { width: 100% !important; min-width: 100% !important; margin-bottom: 0; }
      .search-field { width: 100% !important; }
      .view-toggle { align-self: flex-end; }
      .controls-card { padding: 12px 14px; }
      .leaves-grid { grid-template-columns: 1fr; gap: 12px; }
    }
  `]
})
export class StudentLeavesComponent implements OnInit {
  leaves: StudentLeaveDto[] = [];
  classes: any[] = [];
  batches: any[] = [];
  loading = false;
  viewMode: 'grid' | 'table' = 'grid';

  filterForm: FormGroup;

  stats: StudentLeaveStatsDto = {
    totalLeaves: 0,
    pendingLeaves: 0,
    approvedLeaves: 0,
    rejectedLeaves: 0,
    todayOnLeave: 0
  };

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService,
    private route: ActivatedRoute,
    public authService: AuthService
  ) {
    this.filterForm = this.fb.group({
      academicScope: ['All'],
      status: [''],
      category: [''],
      classId: [''],
      batchId: [''],
      searchTerm: ['']
    });
  }

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
    this.loadBatches();
    this.loadStats();

    this.route.queryParams.subscribe(params => {
      let changed = false;
      if (params['scope']) {
        this.filterForm.patchValue({ academicScope: params['scope'] }, { emitEvent: false });
        changed = true;
      }
      if (params['classId']) {
        this.filterForm.patchValue({ classId: params['classId'] }, { emitEvent: false });
        changed = true;
      }
      if (params['batchId']) {
        this.filterForm.patchValue({ batchId: params['batchId'] }, { emitEvent: false });
        changed = true;
      }
      this.loadLeaves();
    });
  }

  loadClasses(): void {
    this.http.get<any[]>(`${API_BASE}/school/classes`).subscribe({
      next: r => this.classes = r || [],
      error: () => this.classes = []
    });
  }

  loadBatches(): void {
    this.http.get<any[]>(`${API_BASE}/batches`).subscribe({
      next: r => this.batches = r || [],
      error: () => this.batches = []
    });
  }

  get filteredBatches(): any[] {
    const classId = this.filterForm.get('classId')?.value;
    if (!classId) return this.batches;
    return this.batches.filter(b => (b.classId || '').toLowerCase() === classId.toLowerCase());
  }

  onClassFilterChanged(): void {
    const currentBatchId = this.filterForm.get('batchId')?.value;
    if (currentBatchId) {
      const stillValid = this.filteredBatches.some(b => (b.id || '').toLowerCase() === currentBatchId.toLowerCase());
      if (!stillValid) {
        this.filterForm.patchValue({ batchId: '' }, { emitEvent: false });
      }
    }
    this.loadLeaves();
  }

  setScope(scope: 'All' | 'School' | 'Coaching'): void {
    this.filterForm.patchValue({
      academicScope: scope,
      batchId: scope === 'School' ? '' : this.filterForm.value.batchId
    });
    this.loadLeaves();
  }

  resetFilters(): void {
    this.filterForm.reset({
      academicScope: 'All',
      status: '',
      category: '',
      classId: '',
      batchId: '',
      searchTerm: ''
    });
    this.loadLeaves();
  }

  loadStats(): void {
    const val = this.filterForm.value;
    const params: string[] = [];
    if (val.classId) params.push(`classId=${val.classId}`);
    if (val.batchId) params.push(`batchId=${val.batchId}`);
    if (val.academicScope && val.academicScope !== 'All') params.push(`academicScope=${encodeURIComponent(val.academicScope)}`);
    const query = params.length > 0 ? `?${params.join('&')}` : '';
    this.http.get<StudentLeaveStatsDto>(`${API_BASE}/studentleaves/stats${query}`).subscribe({
      next: s => this.stats = s,
      error: () => {}
    });
  }

  loadLeaves(): void {
    this.loading = true;
    const val = this.filterForm.value;
    let url = `${API_BASE}/studentleaves`;
    const params: string[] = [];
    if (val.status) params.push(`status=${encodeURIComponent(val.status)}`);
    if (val.category) params.push(`category=${encodeURIComponent(val.category)}`);
    if (val.classId) params.push(`classId=${val.classId}`);
    if (val.batchId) params.push(`batchId=${val.batchId}`);
    if (val.academicScope && val.academicScope !== 'All') params.push(`academicScope=${encodeURIComponent(val.academicScope)}`);
    if (val.searchTerm?.trim()) params.push(`search=${encodeURIComponent(val.searchTerm.trim())}`);
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
    const val = this.filterForm.value;
    const ref = this.dialog.open(ApplyStudentLeaveDialogComponent, {
      width: 'min(760px, 96vw)',
      maxWidth: '96vw',
      data: {
        classes: this.classes,
        dialogScope: val.academicScope || 'All',
        classId: val.classId,
        batchId: val.batchId
      }
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

  openRequestCancellationDialog(item: StudentLeaveDto): void {
    const ref = this.dialog.open(RequestStudentLeaveCancellationDialogComponent, {
      width: '740px',
      maxWidth: '95vw',
      data: { leave: item }
    });

    ref.afterClosed().subscribe((res: any) => {
      if (res?.success) {
        this.loadLeaves();
        this.confirmDialog.alert(
          'Cancellation Submitted 🎉',
          res.message || 'Leave cancellation request has been submitted for review.',
          'success'
        );
      }
    });
  }

  openReviewCancellationDialog(item: StudentLeaveDto): void {
    const ref = this.dialog.open(ReviewStudentLeaveCancellationDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      data: { leave: item }
    });

    ref.afterClosed().subscribe((res: any) => {
      if (res?.success) {
        this.loadLeaves();
        this.confirmDialog.alert(
          'Cancellation Processed 🎉',
          res.message || 'Leave cancellation has been processed and attendance synchronized.',
          'success'
        );
      }
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
        <button (click)="dialogRef.close(false)" class="close-btn" mat-icon-button>
          <mat-icon>close</mat-icon>
        </button>
      </div>
    
      <!-- Form Body -->
      <div class="modal-body">
        <!-- Stream Scope Switcher -->
        <div class="dialog-scope-bar">
          <div class="dialog-pills">
            <button type="button" class="d-pill" [class.active]="dialogScope === 'All'" (click)="setDialogScope('All')" matButton="filled">All Students</button>
            <button type="button" class="d-pill" [class.active]="dialogScope === 'School'" (click)="setDialogScope('School')" matButton="filled">School Classes</button>
            <button type="button" class="d-pill" [class.active]="dialogScope === 'Coaching'" (click)="setDialogScope('Coaching')" matButton="filled">Coaching Batches</button>
          </div>
        </div>
    
        <!-- Coaching Filter: Academic Class & Coaching Batch -->
        @if (dialogScope === 'Coaching') {
          <div class="form-row" style="display: flex; gap: 12px; margin-bottom: 12px;">
            <mat-form-field appearance="outline" style="flex: 1;">
              <mat-label>Academic Class (कक्षा)</mat-label>
              <mat-select [(ngModel)]="dialogCoachingClassId" (selectionChange)="onDialogCoachingClassChange()">
                <mat-option value="">All Academic Classes</mat-option>
                @for (c of classes; track c) {
                  <mat-option [value]="c.id">{{c.name}}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" style="flex: 1;">
              <mat-label>Coaching Batch</mat-label>
              <mat-select [(ngModel)]="dialogBatchId" (selectionChange)="onDialogBatchChange()">
                <mat-option value="">All Batches</mat-option>
                @for (b of dialogFilteredBatches; track b) {
                  <mat-option [value]="b.id">{{b.name}} ({{b.subject}}){{ b.className ? ' [' + b.className + ']' : '' }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
        }
    
        <!-- Student Selection -->
        <mat-form-field appearance="outline" class="full-field">
          <mat-label>Select Student (विद्यार्थी चयन करें) *</mat-label>
          <mat-select [(ngModel)]="model.studentId" required (selectionChange)="onStudentSelect()">
            @for (s of filteredStudents; track s) {
              <mat-option [value]="s.id">
                {{s.studentName}} (Roll: {{s.coachingRollNumber || s.rollNumber || '—'}}) &bull; {{s.batchName ? ('Batch: ' + s.batchName) : (s.className || 'General')}}
              </mat-option>
            }
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
    
        <!-- ========================================================================= -->
        <!-- Visual Interactive Range Calendar with Holidays, Sundays, & Pre-Applied Leaves -->
        <!-- ========================================================================= -->
        <div class="range-calendar-card">
          <!-- Calendar Header Toolbar -->
          <div class="cal-toolbar">
            <div class="cal-nav-group">
              <button type="button" class="cal-nav-btn" (click)="changeMonth(-1)" title="Previous Month">
                <mat-icon>chevron_left</mat-icon>
              </button>
              <span class="cal-month-title">{{currentMonthLabel}}</span>
              <button type="button" class="cal-nav-btn" (click)="changeMonth(1)" title="Next Month">
                <mat-icon>chevron_right</mat-icon>
              </button>
              <button type="button" class="cal-today-btn" (click)="goToToday()">Today</button>
            </div>

            <!-- Quick Presets -->
            <div class="cal-presets">
              <button type="button" class="preset-chip" (click)="selectPreset('today')">Today (1d)</button>
              <button type="button" class="preset-chip" (click)="selectPreset('tomorrow')">Tomorrow</button>
              <button type="button" class="preset-chip" (click)="selectPreset('next3')">Next 3 Days</button>
              <button type="button" class="preset-chip" (click)="selectPreset('week')">7 Days</button>
            </div>
          </div>

          <!-- Selection Range Capsule -->
          <div class="cal-range-summary">
            <div class="range-info">
              <mat-icon>date_range</mat-icon>
              @if (selectedStartDate && selectedEndDate) {
                <span>Selected Range: <strong>{{formatPrettyDate(selectedStartDate)}}</strong> &rarr; <strong>{{formatPrettyDate(selectedEndDate)}}</strong></span>
              } @else if (selectedStartDate) {
                <span>From: <strong>{{formatPrettyDate(selectedStartDate)}}</strong> <em class="click-hint">(Click ending date on calendar)</em></span>
              } @else {
                <span class="click-hint">Click a start date and an end date on the calendar</span>
              }
            </div>
            @if (selectedStartDate) {
              <button type="button" class="cal-reset-btn" (click)="clearSelection()" title="Reset Selected Dates">
                <mat-icon>restart_alt</mat-icon> Clear
              </button>
            }
          </div>

          <!-- Calendar Matrix (Grid) -->
          <div class="cal-grid" (mouseleave)="onCalendarMouseLeave()">
            <!-- Days of Week Header -->
            <div class="cal-dow-row">
              <div class="cal-dow-cell sun-head">SUN (OFF)</div>
              <div class="cal-dow-cell">MON</div>
              <div class="cal-dow-cell">TUE</div>
              <div class="cal-dow-cell">WED</div>
              <div class="cal-dow-cell">THU</div>
              <div class="cal-dow-cell">FRI</div>
              <div class="cal-dow-cell">SAT</div>
            </div>

            <!-- Weeks -->
            @for (week of calendarWeeks; track $index) {
              <div class="cal-week-row">
                @for (cell of week; track cell.dateStr) {
                  <div class="cal-day-box"
                       [class.dimmed]="!cell.isCurrentMonth"
                       [class.is-today]="cell.isToday"
                       [class.is-sunday]="cell.isSunday"
                       [class.has-holiday]="!!cell.holiday"
                       [class.has-leave]="!!cell.existingLeave"
                       [class.is-start]="cell.isStart"
                       [class.is-end]="cell.isEnd"
                       [class.in-range]="cell.isInRange"
                       [class.in-hover]="cell.isInHover"
                       (click)="onDayClick(cell)"
                       (mouseenter)="onDayHover(cell)"
                       [title]="getCellTooltip(cell)">
                    
                    <div class="cell-top">
                      <span class="day-number">{{cell.dayNum}}</span>
                      @if (cell.isToday) {
                        <span class="today-indicator" title="Today"></span>
                      }
                    </div>

                    <div class="cell-pill-stack">
                      @if (cell.isSunday) {
                        <span class="pill-badge pill-sun">Sunday Off</span>
                      }
                      @if (cell.holiday) {
                        <span class="pill-badge pill-holiday" [title]="cell.holiday.title">🎉 {{cell.holiday.title}}</span>
                      }
                      @if (cell.existingLeave) {
                        <span class="pill-badge pill-leave" [title]="'Pre-applied: ' + cell.existingLeave.leaveCategory + ' (' + cell.existingLeave.status + ')'">
                          🏖️ {{cell.existingLeave.status}}
                        </span>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Color Legend -->
          <div class="cal-legend-bar">
            <span class="legend-unit"><span class="leg-dot dot-range"></span> Selected Range</span>
            <span class="legend-unit"><span class="leg-dot dot-sunday"></span> Sunday (Weekly Off)</span>
            <span class="legend-unit"><span class="leg-dot dot-holiday"></span> Public Holiday</span>
            <span class="legend-unit"><span class="leg-dot dot-preapplied"></span> Pre-Applied Leave</span>
            <span class="legend-unit"><span class="leg-dot dot-working"></span> Working Day</span>
          </div>

          <!-- Metrics Breakdown Card -->
          @if (selectedStartDate) {
            <div class="cal-metrics-deck">
              <div class="metric-card">
                <span class="m-label">Total Span</span>
                <span class="m-val">{{totalSpanDays}} {{totalSpanDays > 1 ? 'Days' : 'Day'}}</span>
              </div>
              <div class="metric-card rose-tint">
                <span class="m-label">Sundays (Excluded)</span>
                <span class="m-val">-{{rangeSundaysCount}}</span>
              </div>
              <div class="metric-card purple-tint">
                <span class="m-label">Holidays (Excluded)</span>
                <span class="m-val">-{{rangeHolidaysCount}}</span>
              </div>
              <div class="metric-card highlight-card">
                <span class="m-label">Net Sanction Days</span>
                <span class="m-val">{{netWorkingDays}} Working {{netWorkingDays === 1 ? 'Day' : 'Days'}}</span>
              </div>
            </div>
          }

          <!-- Conflict / Date Error Banner -->
          @if (dateError) {
            <div class="date-error-banner">
              <mat-icon>warning</mat-icon>
              <span>{{ dateError }}</span>
            </div>
          }
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
        <button (click)="dialogRef.close(false)" class="cancel-btn app-button-cancel" matButton="filled">Cancel</button>
        <button class="save-btn" (click)="submitLeave()" [disabled]="saving || !model.studentId || !model.reason || !selectedStartDate || !selectedEndDate || !!dateError || netWorkingDays <= 0" matButton="filled">
          <mat-icon>send</mat-icon>
          <span>Submit Application</span>
        </button>
      </div>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .apply-dialog-wrap { display: flex; flex-direction: column; background: #fff; border-radius: 12px; overflow: hidden; }
    .modal-header { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-bottom: 1px solid #bfdbfe; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .header-icon-box { background: #2563eb; color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25); width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
    .modal-title { color: #1e3a8a; font-weight: 700; margin: 0; font-size: 18px; }
    .modal-subtitle { color: #3b82f6; margin: 3px 0 0; font-size: 12px; }
    .close-btn { color: #64748b; }
    .close-btn:hover { color: #1e293b; }

    .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; max-height: 75vh; overflow-y: auto; }
    .form-row { display: flex; gap: 14px; }
    .form-field { flex: 1; }
    .full-field { width: 100%; }

    .dialog-scope-bar { margin-bottom: 2px; }
    .dialog-pills { display: inline-flex; background: #f1f5f9; padding: 3px; border-radius: 8px; gap: 4px; }
    .d-pill { border: none; background: transparent; padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; color: #64748b; cursor: pointer; transition: all 0.15s ease-in-out; }
    .d-pill.active { background: #fff; color: #1e40af; font-weight: 700; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }

    /* Interactive Calendar Range Picker Styles */
    .range-calendar-card { border: 1px solid #cbd5e1; border-radius: 10px; background: #ffffff; padding: 12px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .cal-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
    .cal-nav-group { display: flex; align-items: center; gap: 6px; }
    .cal-nav-btn { width: 30px; height: 30px; border: 1px solid #cbd5e1; background: #fff; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: #475569; transition: all 0.15s; }
    .cal-nav-btn:hover { background: #eff6ff; color: #1e40af; border-color: #93c5fd; }
    .cal-nav-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .cal-month-title { font-size: 14px; font-weight: 700; color: #1e3a8a; min-width: 130px; text-align: center; }
    .cal-today-btn { border: 1px solid #bfdbfe; background: #eff6ff; color: #1e40af; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; cursor: pointer; }
    .cal-today-btn:hover { background: #dbeafe; }

    .cal-presets { display: flex; gap: 5px; flex-wrap: wrap; }
    .preset-chip { border: 1px solid #e2e8f0; background: #f8fafc; color: #475569; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; cursor: pointer; transition: all 0.15s; }
    .preset-chip:hover { background: #e0f2fe; color: #0284c7; border-color: #7dd3fc; }

    .cal-range-summary { display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 12px; font-size: 12px; color: #1e293b; }
    .range-info { display: flex; align-items: center; gap: 6px; color: #1e40af; }
    .range-info mat-icon { font-size: 17px; width: 17px; height: 17px; color: #2563eb; }
    .click-hint { color: #64748b; font-style: italic; font-weight: 400; }
    .cal-reset-btn { background: transparent; border: none; color: #dc2626; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px; cursor: pointer; }
    .cal-reset-btn mat-icon { font-size: 15px; width: 15px; height: 15px; }

    .cal-grid { display: flex; flex-direction: column; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .cal-dow-row { display: grid; grid-template-columns: repeat(7, 1fr); background: #f8fafc; border-bottom: 1px solid #e2e8f0; text-align: center; }
    .cal-dow-cell { padding: 6px 2px; font-size: 10.5px; font-weight: 700; color: #475569; text-transform: uppercase; }
    .cal-dow-cell.sun-head { color: #dc2626; background: #fef2f2; }

    .cal-week-row { display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 1px solid #f1f5f9; }
    .cal-week-row:last-child { border-bottom: none; }
    .cal-day-box { min-height: 52px; padding: 4px; border-right: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 2px; cursor: pointer; transition: background 0.15s, border-color 0.15s; position: relative; background: #ffffff; user-select: none; }
    .cal-day-box:last-child { border-right: none; }
    .cal-day-box.dimmed { opacity: 0.35; background: #fafafa; }
    .cal-day-box.is-sunday { background: #fff8f8; }
    .cal-day-box.has-holiday { background: #faf5ff; }
    .cal-day-box.has-leave { background: #fffbeb; }
    .cal-day-box:hover { background: #f0fdf4; outline: 1.5px solid #22c55e; z-index: 2; }

    .cal-day-box.is-start { background: #2563eb !important; color: #ffffff !important; border-top-left-radius: 8px; border-bottom-left-radius: 8px; z-index: 3; }
    .cal-day-box.is-end { background: #2563eb !important; color: #ffffff !important; border-top-right-radius: 8px; border-bottom-right-radius: 8px; z-index: 3; }
    .cal-day-box.is-start.is-end { border-radius: 8px !important; }
    .cal-day-box.in-range { background: #dbeafe !important; color: #1e40af; border-radius: 0; }
    .cal-day-box.in-hover { background: #eff6ff; outline: 1px dashed #3b82f6; }

    .cell-top { display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; font-weight: 700; }
    .cal-day-box.is-start .day-number, .cal-day-box.is-end .day-number { color: #ffffff !important; }
    .cal-day-box.in-range .day-number { color: #1e40af; }
    .today-indicator { width: 5px; height: 5px; border-radius: 50%; background: #2563eb; }
    .cal-day-box.is-start .today-indicator, .cal-day-box.is-end .today-indicator { background: #ffffff; }

    .cell-pill-stack { display: flex; flex-direction: column; gap: 2px; margin-top: auto; }
    .pill-badge { font-size: 9px; font-weight: 700; padding: 1px 3px; border-radius: 3px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.2; text-align: center; }
    .pill-sun { background: #fee2e2; color: #991b1b; }
    .pill-holiday { background: #ede9fe; color: #6b21a8; }
    .pill-leave { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }

    .cal-legend-bar { display: flex; gap: 10px; flex-wrap: wrap; font-size: 11px; color: #475569; padding: 2px; }
    .legend-unit { display: inline-flex; align-items: center; gap: 4px; }
    .leg-dot { width: 10px; height: 10px; border-radius: 3px; }
    .dot-range { background: #2563eb; }
    .dot-sunday { background: #fca5a5; }
    .dot-holiday { background: #d8b4fe; }
    .dot-preapplied { background: #fcd34d; }
    .dot-working { background: #cbd5e1; }

    .cal-metrics-deck { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; }
    @media (max-width: 640px) { .cal-metrics-deck { grid-template-columns: repeat(2, 1fr); } }
    .metric-card { display: flex; flex-direction: column; gap: 1px; padding: 6px 8px; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; }
    .m-label { font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; }
    .m-val { font-size: 13px; font-weight: 700; color: #0f172a; }
    .rose-tint .m-val { color: #be123c; }
    .purple-tint .m-val { color: #7e22ce; }
    .highlight-card { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-color: #bfdbfe; }
    .highlight-card .m-label { color: #1e40af; }
    .highlight-card .m-val { color: #1e3a8a; font-size: 14.5px; }

    .date-error-banner { display: flex; align-items: center; gap: 8px; background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 8px; padding: 8px 12px; color: #991b1b; font-size: 12px; font-weight: 600; }
    .date-error-banner mat-icon { font-size: 18px; width: 18px; height: 18px; color: #dc2626; flex-shrink: 0; }

    .modal-footer { padding: 14px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px; }
    .cancel-btn { color: #64748b; }
    .save-btn { background: #2563eb !important; color: #fff !important; font-weight: 700; }
  `]
})
export class ApplyStudentLeaveDialogComponent implements OnInit {
  students: any[] = [];
  classes: any[] = [];
  batches: any[] = [];
  dialogCoachingClassId = '';
  dialogBatchId = '';
  saving = false;
  dialogScope: 'All' | 'School' | 'Coaching' = 'All';

  // Range Calendar States
  holidays: any[] = [];
  holidayDatesMap: Map<string, any> = new Map<string, any>();
  studentLeaves: any[] = [];
  activeStudentLeavesMap: Map<string, any> = new Map<string, any>();

  calYear: number = new Date().getFullYear();
  calMonth: number = new Date().getMonth();
  calendarWeeks: any[][] = [];

  selectedStartDate: string = '';
  selectedEndDate: string = '';
  hoverDate: string = '';
  fromDateStr = '';
  toDateStr = '';

  dateError = '';
  totalSpanDays = 0;
  rangeSundaysCount = 0;
  rangeHolidaysCount = 0;
  netWorkingDays = 0;
  overlapLeaves: any[] = [];

  monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

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

  get currentMonthLabel(): string {
    return `${this.monthNames[this.calMonth]} ${this.calYear}`;
  }

  get dialogFilteredBatches(): any[] {
    if (!this.dialogCoachingClassId) return this.batches;
    return this.batches.filter(b => (b.classId || '').toLowerCase() === this.dialogCoachingClassId.toLowerCase());
  }

  onDialogCoachingClassChange(): void {
    if (this.dialogBatchId) {
      const stillValid = this.dialogFilteredBatches.some(b => (b.id || '').toLowerCase() === this.dialogBatchId.toLowerCase());
      if (!stillValid) {
        this.dialogBatchId = '';
      }
    }
    this.onDialogBatchChange();
  }

  onDialogBatchChange(): void {
    if (this.model.studentId) {
      const exists = this.filteredStudents.some(s => s.id === this.model.studentId);
      if (!exists) {
        this.model.studentId = this.filteredStudents.length > 0 ? this.filteredStudents[0].id : '';
        this.onStudentSelect();
      }
    }
  }

  get filteredStudents(): any[] {
    let list = this.students;
    if (this.dialogScope === 'School') {
      list = list.filter(s => s.isSchoolStudent || s.classId || s.className);
    } else if (this.dialogScope === 'Coaching') {
      list = list.filter(s => s.isCoachingStudent || s.batchId || s.batchName);
      if (this.dialogCoachingClassId) {
        const batchIdsForClass = new Set(
          this.batches
            .filter(b => (b.classId || '').toLowerCase() === this.dialogCoachingClassId.toLowerCase())
            .map(b => (b.id || '').toLowerCase())
        );
        list = list.filter(s =>
          ((s.classId || '').toLowerCase() === this.dialogCoachingClassId.toLowerCase()) ||
          (s.batchId && batchIdsForClass.has(s.batchId.toLowerCase()))
        );
      }
      if (this.dialogBatchId) {
        list = list.filter(s => (s.batchId || '').toLowerCase() === this.dialogBatchId.toLowerCase());
      }
    }
    return list;
  }

  setDialogScope(scope: 'All' | 'School' | 'Coaching'): void {
    this.dialogScope = scope;
    if (this.model.studentId) {
      const exists = this.filteredStudents.some(s => s.id === this.model.studentId);
      if (!exists && this.filteredStudents.length > 0) {
        this.model.studentId = this.filteredStudents[0].id;
        this.onStudentSelect();
      }
    }
  }

  ngOnInit(): void {
    if (this.data?.dialogScope) this.dialogScope = this.data.dialogScope;
    if (this.data?.scope) this.dialogScope = this.data.scope;
    if (this.data?.classId) this.dialogCoachingClassId = this.data.classId;
    if (this.data?.batchId) this.dialogBatchId = this.data.batchId;
    if (this.data?.studentId) this.model.studentId = this.data.studentId;

    const role = this.authService.currentUser()?.role;
    if (role === 'Parent') this.model.appliedBy = 'Parent';
    else if (role === 'Student') this.model.appliedBy = 'Student';
    else if (role === 'Teacher') this.model.appliedBy = 'Class Teacher';

    const now = new Date();
    this.calYear = now.getFullYear();
    this.calMonth = now.getMonth();
    const todayStr = this.formatDate(now);
    this.selectedStartDate = todayStr;
    this.selectedEndDate = todayStr;
    this.fromDateStr = todayStr;
    this.toDateStr = todayStr;

    this.loadMetadata();
    this.loadHolidays();
    this.loadStudents();
  }

  loadMetadata(): void {
    this.http.get<any[]>(`${API_BASE}/school/classes?activeOnly=true`).subscribe({
      next: res => { this.classes = res || []; },
      error: () => { this.classes = []; }
    });
    this.http.get<any[]>(`${API_BASE}/batches`).subscribe({
      next: res => { this.batches = res || []; },
      error: () => { this.batches = []; }
    });
  }

  loadHolidays(): void {
    this.http.get<any[]>(`${API_BASE}/holidays?activeOnly=true`).subscribe({
      next: res => {
        this.holidays = res || [];
        this.holidayDatesMap.clear();
        for (const h of this.holidays) {
          if (!h.startDate) continue;
          const s = this.parseDate(h.startDate.split('T')[0]);
          const e = h.endDate ? this.parseDate(h.endDate.split('T')[0]) : new Date(s);
          for (let cur = new Date(s); cur <= e; cur.setDate(cur.getDate() + 1)) {
            this.holidayDatesMap.set(this.formatDate(cur), h);
          }
        }
        this.recalculateRange();
        this.buildCalendar();
      },
      error: () => {
        this.holidays = [];
        this.holidayDatesMap.clear();
        this.buildCalendar();
      }
    });
  }

  loadStudents(): void {
    this.http.get<any[]>(`${API_BASE}/students`).subscribe({
      next: res => {
        this.students = res || [];
        if (!this.model.studentId && this.filteredStudents.length > 0) {
          this.model.studentId = this.filteredStudents[0].id;
        }
        if (this.model.studentId) {
          this.onStudentSelect();
        }
      },
      error: () => this.students = []
    });
  }

  loadStudentLeaves(): void {
    if (!this.model.studentId) {
      this.studentLeaves = [];
      this.activeStudentLeavesMap.clear();
      this.recalculateRange();
      this.buildCalendar();
      return;
    }

    this.http.get<any[]>(`${API_BASE}/studentleaves?studentId=${this.model.studentId}`).subscribe({
      next: res => {
        this.studentLeaves = res || [];
        this.activeStudentLeavesMap.clear();
        for (const l of this.studentLeaves) {
          if (l.status === 'Rejected' || l.status === 'Cancelled') continue;
          const sStr = (l.fromDate || '').split('T')[0];
          const eStr = (l.toDate || '').split('T')[0];
          if (!sStr || !eStr) continue;
          const s = this.parseDate(sStr);
          const e = this.parseDate(eStr);
          for (let cur = new Date(s.getFullYear(), s.getMonth(), s.getDate()); cur <= e; cur.setDate(cur.getDate() + 1)) {
            this.activeStudentLeavesMap.set(this.formatDate(cur), l);
          }
        }
        this.recalculateRange();
        this.buildCalendar();
      },
      error: () => {
        this.studentLeaves = [];
        this.activeStudentLeavesMap.clear();
        this.recalculateRange();
        this.buildCalendar();
      }
    });
  }

  onStudentSelect(): void {
    const s = this.students.find(x => x.id === this.model.studentId);
    if (s) {
      this.model.parentContactNumber = s.fatherPhone || s.parentWhatsAppPhone || s.emergencyContact || s.parentContactNumber || '';
    }
    this.loadStudentLeaves();
  }

  // --- Date and Calendar Helpers ---

  pad(n: number): string {
    return n.toString().padStart(2, '0');
  }

  formatDate(d: Date): string {
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`;
  }

  parseDate(s: string): Date {
    const parts = s.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  formatPrettyDate(str: string): string {
    if (!str) return '—';
    const parts = str.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = d.getDate();
    const m = this.monthNames[d.getMonth()].substring(0, 3);
    const y = d.getFullYear();
    return `${day} ${m} ${y}`;
  }

  changeMonth(delta: number): void {
    this.calMonth += delta;
    if (this.calMonth < 0) {
      this.calMonth = 11;
      this.calYear--;
    } else if (this.calMonth > 11) {
      this.calMonth = 0;
      this.calYear++;
    }
    this.buildCalendar();
  }

  goToToday(): void {
    const now = new Date();
    this.calYear = now.getFullYear();
    this.calMonth = now.getMonth();
    this.buildCalendar();
  }

  clearSelection(): void {
    this.selectedStartDate = '';
    this.selectedEndDate = '';
    this.hoverDate = '';
    this.fromDateStr = '';
    this.toDateStr = '';
    this.recalculateRange();
    this.buildCalendar();
  }

  selectPreset(preset: 'today' | 'tomorrow' | 'next3' | 'week'): void {
    const now = new Date();
    if (preset === 'today') {
      const s = this.formatDate(now);
      this.selectedStartDate = s;
      this.selectedEndDate = s;
    } else if (preset === 'tomorrow') {
      const tom = new Date(now);
      tom.setDate(tom.getDate() + 1);
      const s = this.formatDate(tom);
      this.selectedStartDate = s;
      this.selectedEndDate = s;
    } else if (preset === 'next3') {
      const s = this.formatDate(now);
      const end = new Date(now);
      end.setDate(end.getDate() + 2);
      this.selectedStartDate = s;
      this.selectedEndDate = this.formatDate(end);
    } else if (preset === 'week') {
      const s = this.formatDate(now);
      const end = new Date(now);
      end.setDate(end.getDate() + 6);
      this.selectedStartDate = s;
      this.selectedEndDate = this.formatDate(end);
    }
    this.hoverDate = '';
    this.fromDateStr = this.selectedStartDate;
    this.toDateStr = this.selectedEndDate;

    const parts = this.selectedStartDate.split('-').map(Number);
    this.calYear = parts[0];
    this.calMonth = parts[1] - 1;

    this.recalculateRange();
    this.buildCalendar();
  }

  onDayClick(cell: any): void {
    const clicked = cell.dateStr;
    if (!this.selectedStartDate || (this.selectedStartDate && this.selectedEndDate)) {
      this.selectedStartDate = clicked;
      this.selectedEndDate = '';
      this.hoverDate = '';
    } else if (this.selectedStartDate && !this.selectedEndDate) {
      if (clicked < this.selectedStartDate) {
        this.selectedEndDate = this.selectedStartDate;
        this.selectedStartDate = clicked;
      } else {
        this.selectedEndDate = clicked;
      }
      this.hoverDate = '';
    }

    this.fromDateStr = this.selectedStartDate;
    this.toDateStr = this.selectedEndDate || this.selectedStartDate;
    this.recalculateRange();
    this.buildCalendar();
  }

  onDayHover(cell: any): void {
    if (this.selectedStartDate && !this.selectedEndDate) {
      this.hoverDate = cell.dateStr;
      this.buildCalendar();
    }
  }

  onCalendarMouseLeave(): void {
    if (this.selectedStartDate && !this.selectedEndDate) {
      this.hoverDate = '';
      this.buildCalendar();
    }
  }

  recalculateRange(): void {
    this.totalSpanDays = 0;
    this.rangeSundaysCount = 0;
    this.rangeHolidaysCount = 0;
    this.netWorkingDays = 0;
    this.overlapLeaves = [];
    this.dateError = '';

    if (!this.selectedStartDate) return;

    const startStr = this.selectedStartDate;
    const endStr = this.selectedEndDate || this.selectedStartDate;

    const dStart = this.parseDate(startStr);
    const dEnd = this.parseDate(endStr);

    const seenOverlapIds = new Set<string>();

    for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
      const curStr = this.formatDate(d);
      this.totalSpanDays++;

      const isSun = d.getDay() === 0;
      const holiday = this.holidayDatesMap.get(curStr);
      const existing = this.activeStudentLeavesMap.get(curStr);

      if (existing && !seenOverlapIds.has(existing.id)) {
        seenOverlapIds.add(existing.id);
        this.overlapLeaves.push(existing);
      }

      if (isSun) {
        this.rangeSundaysCount++;
      } else if (holiday) {
        this.rangeHolidaysCount++;
      } else {
        this.netWorkingDays++;
      }
    }

    if (this.overlapLeaves.length > 0) {
      const leaveDesc = this.overlapLeaves
        .map(l => `${l.fromDate.split('T')[0]} to ${l.toDate.split('T')[0]} (${l.status})`)
        .join(', ');
      this.dateError = `Selected date range overlaps with existing leave application for this student: ${leaveDesc}. Please select non-overlapping dates.`;
    } else if (this.netWorkingDays === 0) {
      this.dateError = 'Selected date range contains only Sundays or declared Public Holidays (no working batch/class days to sanction).';
    }
  }

  buildCalendar(): void {
    const firstDayOfMonth = new Date(this.calYear, this.calMonth, 1);
    const startDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = new Date(this.calYear, this.calMonth + 1, 0).getDate();
    const prevMonthDays = new Date(this.calYear, this.calMonth, 0).getDate();

    const todayStr = this.formatDate(new Date());

    const effectiveStart = this.selectedStartDate;
    const effectiveEnd = this.selectedEndDate;
    const isSelecting = !!(this.selectedStartDate && !this.selectedEndDate && this.hoverDate);
    let hoverStart = effectiveStart;
    let hoverEnd = effectiveEnd;

    if (isSelecting) {
      if (this.hoverDate < this.selectedStartDate) {
        hoverStart = this.hoverDate;
        hoverEnd = this.selectedStartDate;
      } else {
        hoverStart = this.selectedStartDate;
        hoverEnd = this.hoverDate;
      }
    }

    const cells: any[] = [];

    // Previous month trailing days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(this.calYear, this.calMonth - 1, prevMonthDays - i);
      cells.push(this.createCellData(d, false, todayStr, effectiveStart, effectiveEnd, hoverStart, hoverEnd, isSelecting));
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(this.calYear, this.calMonth, day);
      cells.push(this.createCellData(d, true, todayStr, effectiveStart, effectiveEnd, hoverStart, hoverEnd, isSelecting));
    }

    // Next month leading days to complete grid
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(this.calYear, this.calMonth + 1, day);
      cells.push(this.createCellData(d, false, todayStr, effectiveStart, effectiveEnd, hoverStart, hoverEnd, isSelecting));
    }

    this.calendarWeeks = [];
    for (let i = 0; i < cells.length; i += 7) {
      this.calendarWeeks.push(cells.slice(i, i + 7));
    }
  }

  createCellData(
    d: Date,
    isCurrentMonth: boolean,
    todayStr: string,
    effectiveStart: string,
    effectiveEnd: string,
    hoverStart: string,
    hoverEnd: string,
    isSelecting: boolean
  ): any {
    const dStr = this.formatDate(d);
    const isSunday = d.getDay() === 0;
    const holiday = this.holidayDatesMap.get(dStr) || null;
    const existingLeave = this.activeStudentLeavesMap.get(dStr) || null;

    const isStart = dStr === effectiveStart;
    const isEnd = dStr === (effectiveEnd || effectiveStart);
    const isInRange = !!(effectiveStart && effectiveEnd && dStr >= effectiveStart && dStr <= effectiveEnd);
    const isInHover = !!(isSelecting && dStr >= hoverStart && dStr <= hoverEnd);

    return {
      date: d,
      dateStr: dStr,
      dayNum: d.getDate(),
      isCurrentMonth,
      isToday: dStr === todayStr,
      isSunday,
      holiday,
      existingLeave,
      isStart,
      isEnd,
      isInRange,
      isInHover
    };
  }

  getCellTooltip(cell: any): string {
    const parts: string[] = [this.formatPrettyDate(cell.dateStr)];
    if (cell.isToday) parts.push('(Today)');
    if (cell.isSunday) parts.push('Weekly Off (Sunday - not counted in leave)');
    if (cell.holiday) parts.push(`Public Holiday: ${cell.holiday.title} (not counted in leave)`);
    if (cell.existingLeave) parts.push(`Pre-applied Leave: ${cell.existingLeave.leaveCategory} [${cell.existingLeave.status}]`);
    return parts.join(' • ');
  }

  submitLeave(): void {
    this.recalculateRange();
    if (this.dateError || !this.selectedStartDate || !this.selectedEndDate || this.netWorkingDays <= 0) return;

    this.saving = true;
    const payload = {
      studentId: this.model.studentId,
      leaveCategory: this.model.leaveCategory,
      fromDate: `${this.selectedStartDate}T00:00:00`,
      toDate: `${this.selectedEndDate}T23:59:59`,
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
          <button class="print-btn" (click)="printSlip()" matButton="filled">
            <mat-icon>print</mat-icon> Print Slip
          </button>
          <button (click)="dialogRef.close()" class="close-btn" mat-icon-button>
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>
    
      <!-- Printable Slip Content -->
      <div class="slip-paper" id="printable-leave-slip">
        <!-- Institution Header -->
        <div class="slip-hdr">
          <h1 class="inst-name">{{instituteName}}</h1>
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
          @if (data.leave.coachingRollNumber) {
            <div class="meta-item">
              <span class="m-lbl">COACHING ROLL #</span>
              <span class="m-val">{{data.leave.coachingRollNumber}}</span>
            </div>
          }
          @if (data.leave.className) {
            <div class="meta-item">
              <span class="m-lbl">CLASS / SECTION</span>
              <span class="m-val">{{data.leave.className}}{{data.leave.sectionName ? ' - ' + data.leave.sectionName : ''}}</span>
            </div>
          }
          @if (data.leave.batchName) {
            <div class="meta-item">
              <span class="m-lbl">COACHING BATCH</span>
              <span class="m-val highlight">{{data.leave.batchName}}</span>
            </div>
          }
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
            @if (data.leave.attendanceMarked) {
              <p>
                This student's attendance register for the sanctioned date range is marked 'L' (Sanctioned Leave). Percentage will not be penalized as uninformed absence.
              </p>
            }
            @if (!data.leave.attendanceMarked) {
              <p>
                Application is either pending approval or rejected.
              </p>
            }
          </div>
        </div>
    
        <!-- Reason -->
        <div class="section-box">
          <span class="box-title">STATEMENT / REASON OF ABSENCE:</span>
          <p class="box-content">{{data.leave.reason}}</p>
        </div>
    
        <!-- Cancellation Details Audit Block if requested or processed -->
        @if (data.leave.isCancellationRequested || data.leave.status === 'CancellationRequested' || data.leave.status === 'PartiallyCancelled' || data.leave.status === 'Cancelled') {
          <div class="section-box cancellation-audit-box">
            <span class="box-title" style="color:#c2410c;">CANCELLATION &amp; ATTENDANCE AUDIT:</span>
            <div class="cancel-audit-details">
              <div class="audit-item">
                <strong>Status:</strong>
                <span class="status-pill" [ngClass]="data.leave.status.toLowerCase()">
                  {{data.leave.status === 'CancellationRequested' ? '⏳ Cancel Requested' : (data.leave.status === 'PartiallyCancelled' ? '⚡ Partially Cancelled' : data.leave.status)}}
                </span>
              </div>
              @if (data.leave.cancellationFromDate && data.leave.cancellationToDate) {
                <div class="audit-item">
                  <strong>Cancelled Period:</strong> {{formatDate(data.leave.cancellationFromDate)}} to {{formatDate(data.leave.cancellationToDate)}}
                  @if (data.leave.isPartialCancellation) {
                    <span class="badge-partial">(Partial Cancellation)</span>
                  }
                </div>
              }
              @if (data.leave.cancellationReason) {
                <div class="audit-item">
                  <strong>Parent/Student Reason:</strong> <em>"{{data.leave.cancellationReason}}"</em>
                </div>
              }
              @if (data.leave.cancellationReviewedBy) {
                <div class="audit-item">
                  <strong>Reviewed By:</strong> {{data.leave.cancellationReviewedBy}}
                  @if (data.leave.cancellationReviewedAt) {
                    <span> on {{data.leave.cancellationReviewedAt | date:'dd-MMM-yyyy, hh:mm a'}}</span>
                  }
                </div>
              }
              @if (data.leave.cancellationReviewRemarks) {
                <div class="audit-item">
                  <strong>Reviewer Remarks:</strong> {{data.leave.cancellationReviewRemarks}}
                </div>
              }
            </div>
          </div>
        }
    
        <!-- Remarks if any -->
        @if (data.leave.reviewRemarks) {
          <div class="section-box">
            <span class="box-title">REVIEW REMARKS / INSTRUCTIONS:</span>
            <p class="box-content">{{data.leave.reviewRemarks}}</p>
          </div>
        }
    
        <!-- Attachment -->
        @if (data.leave.attachmentUrl) {
          <div class="att-box">
            <mat-icon>attach_file</mat-icon>
            <span>Supporting Document: <a [href]="data.leave.attachmentUrl" target="_blank">{{data.leave.attachmentUrl}}</a></span>
          </div>
        }
    
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
  changeDetection: ChangeDetectionStrategy.Eager,
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

    .cancellation-audit-box { background: #fffaf0; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px 14px; }
    .cancel-audit-details { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; color: #431407; margin-top: 6px; }
    .audit-item { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .badge-partial { background: #ede9fe; color: #6d28d9; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }

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
    @Inject(MAT_DIALOG_DATA) public data: { leave: StudentLeaveDto },
    public authService: AuthService
  ) {}

  get instituteName(): string {
    return this.authService.currentUser()?.instituteName || 'ACADEMIC INSTITUTION';
  }

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
