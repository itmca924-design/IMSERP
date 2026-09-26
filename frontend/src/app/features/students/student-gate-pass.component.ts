import { Component, OnInit, inject, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { AuthService } from '../../core/services/auth.service';

const API_BASE = 'http://localhost:5000/api';

export interface StudentGatePassItem {
  id: string;
  gatePassNumber: string;
  studentId: string;
  studentName: string;
  className?: string;
  sectionName?: string;
  rollNumber?: string;
  reason: string;
  reasonCategory: string;
  outDateTime: string;
  expectedReturnTime?: string;
  actualReturnTime?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Returned' | string;
  parentGuardianName?: string;
  parentContactNumber?: string;
  parentRelation?: string;
  approvedBy?: string;
  approvedAt?: string;
  approvalRemarks?: string;
  securityGuardName?: string;
  remarks?: string;
  createdAt: string;
}

@Component({
  selector: 'app-student-gate-pass',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDialogModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatChipsModule
  ],
  template: `
    <div class="sgp-page">
      <!-- Top Banner / Header -->
      <div class="sgp-header-card">
        <div class="sgp-header-left">
          <div class="sgp-header-icon">
            <mat-icon>badge</mat-icon>
          </div>
          <div>
            <div class="sgp-title-row">
              <h1 class="sgp-title">
                {{ isStudentOrParent ? 'My Gate Pass Portal' : 'Student Gate Pass Management' }}
              </h1>
              <span class="sgp-badge-role">{{ currentRoleLabel }}</span>
            </div>
            <p class="sgp-subtitle">
              {{ isStudentOrParent 
                  ? 'Submit early-exit gate pass requests, track real-time approval status, and print digital exit slips.' 
                  : 'Review student early-exit requests, issue instant gate passes, and track campus exit/return logs.' }}
            </p>
          </div>
        </div>
        <div class="sgp-header-actions">
          <button mat-stroked-button class="sgp-secondary-btn" routerLink="/students/leaves">
            <mat-icon>event_busy</mat-icon> Leave Requests
          </button>
          <button mat-stroked-button class="sgp-secondary-btn" *ngIf="!isStudentOrParent" routerLink="/front-desk/visitors">
            <mat-icon>transfer_within_a_station</mat-icon> Front Desk
          </button>
          <button mat-raised-button class="sgp-primary-btn" (click)="openRequestModal()">
            <mat-icon>add_circle</mat-icon> Request Gate Pass
          </button>
        </div>
      </div>

      <!-- Linked Student Info Card (Student / Parent View) -->
      <div class="sgp-student-profile-strip" *ngIf="isStudentOrParent && studentProfile">
        <div class="profile-avatar">
          <mat-icon>school</mat-icon>
        </div>
        <div class="profile-info">
          <div class="profile-name">{{ studentProfile.studentName }}</div>
          <div class="profile-meta">
            <span>Class: <strong>{{ studentProfile.className }} - {{ studentProfile.sectionName }}</strong></span>
            <span *ngIf="studentProfile.rollNumber">Roll No: <strong>{{ studentProfile.rollNumber }}</strong></span>
            <span *ngIf="studentProfile.parentPhone">Parent Phone: <strong>{{ studentProfile.parentPhone }}</strong></span>
          </div>
        </div>
        <div class="profile-tip">
          <mat-icon>info</mat-icon>
          <span>Gate pass must be approved by school administration before campus exit. Show pass number at security gate.</span>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="sgp-stats-grid">
        <div class="stat-card stat-all" (click)="filterStatus = ''; applyFilters()">
          <div class="stat-icon-box">
            <mat-icon>receipt_long</mat-icon>
          </div>
          <div class="stat-content">
            <div class="stat-val">{{ stats.total }}</div>
            <div class="stat-lbl">Total Passes</div>
          </div>
        </div>

        <div class="stat-card stat-pending" (click)="filterStatus = 'Pending'; applyFilters()">
          <div class="stat-icon-box">
            <mat-icon>pending_actions</mat-icon>
          </div>
          <div class="stat-content">
            <div class="stat-val">{{ stats.pending }}</div>
            <div class="stat-lbl">Pending Approval</div>
          </div>
          <span class="stat-sub-badge" *ngIf="stats.pending > 0">Under Review</span>
        </div>

        <div class="stat-card stat-approved" (click)="filterStatus = 'Approved'; applyFilters()">
          <div class="stat-icon-box">
            <mat-icon>verified</mat-icon>
          </div>
          <div class="stat-content">
            <div class="stat-val">{{ stats.approved }}</div>
            <div class="stat-lbl">Approved</div>
          </div>
          <span class="stat-sub-badge" *ngIf="stats.approved > 0">Ready to Exit</span>
        </div>

        <div class="stat-card stat-returned" (click)="filterStatus = 'Returned'; applyFilters()">
          <div class="stat-icon-box">
            <mat-icon>keyboard_return</mat-icon>
          </div>
          <div class="stat-content">
            <div class="stat-val">{{ stats.returned }}</div>
            <div class="stat-lbl">Returned</div>
          </div>
        </div>

        <div class="stat-card stat-rejected" (click)="filterStatus = 'Rejected'; applyFilters()">
          <div class="stat-icon-box">
            <mat-icon>cancel</mat-icon>
          </div>
          <div class="stat-content">
            <div class="stat-val">{{ stats.rejected }}</div>
            <div class="stat-lbl">Rejected</div>
          </div>
        </div>
      </div>

      <!-- Filters & Controls Bar -->
      <div class="sgp-controls-card">
        <div class="controls-row">
          <!-- Search input -->
          <div class="search-box">
            <mat-icon class="search-icon">search</mat-icon>
            <input 
              type="text" 
              [(ngModel)]="searchQuery" 
              (keyup.enter)="loadGatePasses()"
              placeholder="Search by Pass #, student, reason..." 
              class="search-input" />
            <button mat-icon-button *ngIf="searchQuery" (click)="searchQuery = ''; loadGatePasses()">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <!-- Status Filter -->
          <mat-form-field appearance="outline" class="filter-field" subscriptSizing="dynamic">
            <mat-label>Status</mat-label>
            <mat-select [(ngModel)]="filterStatus" (selectionChange)="applyFilters()">
              <mat-option value="">All Statuses</mat-option>
              <mat-option value="Pending">Pending Approval</mat-option>
              <mat-option value="Approved">Approved</mat-option>
              <mat-option value="Returned">Returned</mat-option>
              <mat-option value="Rejected">Rejected</mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Category Filter -->
          <mat-form-field appearance="outline" class="filter-field" subscriptSizing="dynamic">
            <mat-label>Reason Category</mat-label>
            <mat-select [(ngModel)]="filterCategory" (selectionChange)="applyFilters()">
              <mat-option value="">All Categories</mat-option>
              <mat-option *ngFor="let cat of reasonCategories" [value]="cat">{{ cat }}</mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Refresh Button -->
          <button mat-stroked-button class="filter-btn" (click)="loadGatePasses()" [disabled]="loading">
            <mat-icon [class.spinning]="loading">refresh</mat-icon> Refresh
          </button>

          <!-- View Toggle -->
          <div class="view-toggle">
            <button mat-icon-button [class.active-mode]="viewMode === 'grid'" (click)="viewMode = 'grid'" matTooltip="Card View">
              <mat-icon>grid_view</mat-icon>
            </button>
            <button mat-icon-button [class.active-mode]="viewMode === 'table'" (click)="viewMode = 'table'" matTooltip="Table View">
              <mat-icon>view_list</mat-icon>
            </button>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div class="loading-state" *ngIf="loading">
        <mat-icon class="spinning">refresh</mat-icon>
        <p>Loading gate passes...</p>
      </div>

      <!-- Empty State -->
      <div class="sgp-empty-state" *ngIf="!loading && filteredPasses.length === 0">
        <div class="empty-icon-wrap">
          <mat-icon>receipt_long</mat-icon>
        </div>
        <h3>No Gate Passes Found</h3>
        <p *ngIf="filterStatus || filterCategory || searchQuery">
          No records match your selected filters. Try changing or clearing them.
        </p>
        <p *ngIf="!filterStatus && !filterCategory && !searchQuery">
          {{ isStudentOrParent ? "You have not submitted any gate pass requests yet." : "No gate pass requests recorded in the system yet." }}
        </p>
        <button mat-raised-button class="sgp-primary-btn" (click)="openRequestModal()">
          <mat-icon>add_circle</mat-icon> Submit New Request
        </button>
      </div>

      <!-- GRID VIEW -->
      <div class="sgp-cards-grid" *ngIf="!loading && viewMode === 'grid' && filteredPasses.length > 0">
        <div class="pass-card" *ngFor="let p of filteredPasses" [class]="'border-' + p.status.toLowerCase()">
          <!-- Card Header -->
          <div class="pass-card-header">
            <div class="pass-num-pill">
              <mat-icon>confirmation_number</mat-icon>
              <span>{{ p.gatePassNumber }}</span>
            </div>
            <span class="status-pill status-{{ p.status.toLowerCase() }}">
              <mat-icon>{{ getStatusIcon(p.status) }}</mat-icon>
              {{ p.status }}
            </span>
          </div>

          <!-- Student Row (visible to admin or when showing student details) -->
          <div class="pass-student-block">
            <div class="student-avatar-circle">
              <mat-icon>person</mat-icon>
            </div>
            <div class="student-meta-group">
              <div class="student-name-text">{{ p.studentName }}</div>
              <div class="student-class-text">
                {{ p.className }} {{ p.sectionName }}
                <span *ngIf="p.rollNumber">· Roll: {{ p.rollNumber }}</span>
              </div>
            </div>
          </div>

          <!-- Reason & Category -->
          <div class="pass-reason-box">
            <span class="category-tag">{{ p.reasonCategory }}</span>
            <p class="reason-full-text">{{ p.reason }}</p>
          </div>

          <!-- Timing Strip -->
          <div class="pass-times-strip">
            <div class="time-col">
              <span class="time-label"><mat-icon>flight_takeoff</mat-icon> Out Time</span>
              <span class="time-val">{{ p.outDateTime | date:'hh:mm a':'Asia/Kolkata' }}</span>
              <span class="time-sub">{{ p.outDateTime | date:'dd MMM yyyy':'Asia/Kolkata' }}</span>
            </div>
            <div class="time-col" *ngIf="p.expectedReturnTime">
              <span class="time-label"><mat-icon>flight_land</mat-icon> Expected Return</span>
              <span class="time-val">{{ p.expectedReturnTime | date:'hh:mm a':'Asia/Kolkata' }}</span>
              <span class="time-sub">{{ p.expectedReturnTime | date:'dd MMM yyyy':'Asia/Kolkata' }}</span>
            </div>
            <div class="time-col" *ngIf="p.actualReturnTime">
              <span class="time-label" style="color:#16a34a;"><mat-icon>task_alt</mat-icon> Returned At</span>
              <span class="time-val" style="color:#16a34a;">{{ p.actualReturnTime | date:'hh:mm a':'Asia/Kolkata' }}</span>
              <span class="time-sub">{{ p.actualReturnTime | date:'dd MMM yyyy':'Asia/Kolkata' }}</span>
            </div>
          </div>

          <!-- Parent / Guardian Meta -->
          <div class="pass-guardian-strip" *ngIf="p.parentGuardianName || p.parentContactNumber">
            <mat-icon>contact_phone</mat-icon>
            <span>
              {{ p.parentGuardianName }} 
              <span *ngIf="p.parentRelation">({{ p.parentRelation }})</span>
              <strong *ngIf="p.parentContactNumber"> · {{ p.parentContactNumber }}</strong>
            </span>
          </div>

          <!-- Approver Details -->
          <div class="pass-approval-box" *ngIf="p.approvedBy">
            <mat-icon [style.color]="p.status === 'Approved' ? '#16a34a' : '#dc2626'">
              {{ p.status === 'Approved' ? 'check_circle' : 'cancel' }}
            </mat-icon>
            <div>
              <div class="approver-name">
                {{ p.status === 'Approved' ? 'Approved by' : 'Rejected by' }} <strong>{{ p.approvedBy }}</strong>
              </div>
              <div class="approver-time" *ngIf="p.approvedAt">
                {{ p.approvedAt | date:'hh:mm a · dd MMM yyyy':'Asia/Kolkata' }}
              </div>
              <div class="approval-remarks" *ngIf="p.approvalRemarks">
                "{{ p.approvalRemarks }}"
              </div>
            </div>
          </div>

          <!-- Card Actions -->
          <div class="pass-card-footer">
            <button mat-button class="view-slip-btn" (click)="viewDigitalPass(p)">
              <mat-icon>visibility</mat-icon> View / Print Slip
            </button>

            <div class="footer-right-actions">
              <!-- Student: Cancel Pending Request -->
              <button mat-button color="warn" class="cancel-pass-btn" 
                *ngIf="p.status === 'Pending' && isStudentOrParent" 
                (click)="cancelPass(p)">
                <mat-icon>close</mat-icon> Cancel
              </button>

              <!-- Admin/Staff: Quick Actions -->
              <ng-container *ngIf="!isStudentOrParent">
                <button mat-icon-button style="color:#16a34a;" *ngIf="p.status === 'Pending'" 
                  (click)="reviewPass(p, 'Approve')" matTooltip="Approve Gate Pass">
                  <mat-icon>check_circle</mat-icon>
                </button>
                <button mat-icon-button color="warn" *ngIf="p.status === 'Pending'" 
                  (click)="reviewPass(p, 'Reject')" matTooltip="Reject Request">
                  <mat-icon>cancel</mat-icon>
                </button>
                <button mat-icon-button style="color:#2563eb;" *ngIf="p.status === 'Approved'" 
                  (click)="markStudentReturned(p)" matTooltip="Mark Returned">
                  <mat-icon>keyboard_return</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="deletePass(p)" matTooltip="Delete">
                  <mat-icon>delete</mat-icon>
                </button>
              </ng-container>
            </div>
          </div>
        </div>
      </div>

      <!-- TABLE VIEW -->
      <div class="sgp-table-card" *ngIf="!loading && viewMode === 'table' && filteredPasses.length > 0">
        <div class="table-responsive">
          <table class="sgp-table">
            <thead>
              <tr>
                <th>Gate Pass #</th>
                <th>Student</th>
                <th>Reason & Category</th>
                <th>Guardian Contact</th>
                <th>Out Time</th>
                <th>Expected Return</th>
                <th>Status</th>
                <th>Approval Details</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of filteredPasses" [class.row-pending]="p.status === 'Pending'">
                <td>
                  <span class="tbl-pass-num">{{ p.gatePassNumber }}</span>
                </td>
                <td>
                  <div class="tbl-student-name">{{ p.studentName }}</div>
                  <div class="tbl-student-meta">
                    {{ p.className }} {{ p.sectionName }}
                    <span *ngIf="p.rollNumber">· Roll: {{ p.rollNumber }}</span>
                  </div>
                </td>
                <td>
                  <span class="category-tag-sm">{{ p.reasonCategory }}</span>
                  <div class="tbl-reason">{{ p.reason | slice:0:45 }}{{ p.reason.length > 45 ? '...' : '' }}</div>
                </td>
                <td>
                  <div *ngIf="p.parentGuardianName">{{ p.parentGuardianName }}</div>
                  <div class="tbl-phone" *ngIf="p.parentContactNumber">
                    <mat-icon>phone</mat-icon> {{ p.parentContactNumber }}
                  </div>
                  <span *ngIf="!p.parentGuardianName && !p.parentContactNumber">—</span>
                </td>
                <td>
                  <div class="time-val">{{ p.outDateTime | date:'hh:mm a':'Asia/Kolkata' }}</div>
                  <div class="time-sub">{{ p.outDateTime | date:'dd MMM':'Asia/Kolkata' }}</div>
                </td>
                <td>
                  <div *ngIf="p.expectedReturnTime">
                    <div class="time-val">{{ p.expectedReturnTime | date:'hh:mm a':'Asia/Kolkata' }}</div>
                    <div class="time-sub">{{ p.expectedReturnTime | date:'dd MMM':'Asia/Kolkata' }}</div>
                  </div>
                  <div *ngIf="p.actualReturnTime" style="color:#16a34a; font-size:11px; margin-top:2px;">
                    Ret: {{ p.actualReturnTime | date:'hh:mm a':'Asia/Kolkata' }}
                  </div>
                  <span *ngIf="!p.expectedReturnTime && !p.actualReturnTime">—</span>
                </td>
                <td>
                  <span class="status-pill status-{{ p.status.toLowerCase() }}">
                    <mat-icon>{{ getStatusIcon(p.status) }}</mat-icon>
                    {{ p.status }}
                  </span>
                </td>
                <td>
                  <div *ngIf="p.approvedBy" class="tbl-approver">{{ p.approvedBy }}</div>
                  <div *ngIf="p.approvedAt" class="time-sub">
                    {{ p.approvedAt | date:'hh:mm a · dd MMM':'Asia/Kolkata' }}
                  </div>
                  <span *ngIf="!p.approvedBy" class="tbl-pending-lbl">Pending Review</span>
                </td>
                <td style="text-align: right;">
                  <div class="tbl-actions">
                    <button mat-icon-button (click)="viewDigitalPass(p)" matTooltip="View / Print Slip">
                      <mat-icon>visibility</mat-icon>
                    </button>

                    <button mat-icon-button color="warn" *ngIf="p.status === 'Pending' && isStudentOrParent" 
                      (click)="cancelPass(p)" matTooltip="Cancel Request">
                      <mat-icon>close</mat-icon>
                    </button>

                    <ng-container *ngIf="!isStudentOrParent">
                      <button mat-icon-button style="color:#16a34a;" *ngIf="p.status === 'Pending'" 
                        (click)="reviewPass(p, 'Approve')" matTooltip="Approve">
                        <mat-icon>check_circle</mat-icon>
                      </button>
                      <button mat-icon-button color="warn" *ngIf="p.status === 'Pending'" 
                        (click)="reviewPass(p, 'Reject')" matTooltip="Reject">
                        <mat-icon>cancel</mat-icon>
                      </button>
                      <button mat-icon-button style="color:#2563eb;" *ngIf="p.status === 'Approved'" 
                        (click)="markStudentReturned(p)" matTooltip="Mark Returned">
                        <mat-icon>keyboard_return</mat-icon>
                      </button>
                      <button mat-icon-button color="warn" (click)="deletePass(p)" matTooltip="Delete">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </ng-container>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- REQUEST GATE PASS MODAL TEMPLATE (Strict Light Blue Header)   -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <ng-template #requestDialogTpl let-dialogRef>
      <div class="sgp-modal">
        <div class="sgp-modal-header">
          <div class="sgp-modal-icon">
            <mat-icon>badge</mat-icon>
          </div>
          <div class="sgp-modal-header-titles">
            <h2 class="sgp-modal-title">Request Student Gate Pass</h2>
            <p class="sgp-modal-sub">
              Fill early-exit details for review by administration & security.
            </p>
          </div>
          <button mat-icon-button class="sgp-modal-close" (click)="dialogRef.close()">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="sgp-modal-body">
          <!-- Student Selection (Staff view) OR Student Badge (Student View) -->
          <div class="student-select-section" *ngIf="!isStudentOrParent">
            <div class="form-row-2">
              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Select Class</mat-label>
                <mat-select [(ngModel)]="selectedClass" (selectionChange)="onClassChange()">
                  <mat-option value="">-- All Classes --</mat-option>
                  <mat-option *ngFor="let c of classList" [value]="c">{{ c }}</mat-option>
                </mat-select>
                <mat-icon matPrefix>domain</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Select Student *</mat-label>
                <mat-select [(ngModel)]="requestForm.studentId" required (selectionChange)="onStudentSelected()">
                  <mat-option *ngFor="let s of filteredStaffStudents" [value]="s.id">
                    {{ s.studentName }} <span *ngIf="s.rollNumber">(Roll: {{ s.rollNumber }})</span>
                  </mat-option>
                </mat-select>
                <mat-icon matPrefix>school</mat-icon>
              </mat-form-field>
            </div>
          </div>

          <div class="student-locked-badge" *ngIf="isStudentOrParent && studentProfile">
            <mat-icon>verified_user</mat-icon>
            <div>
              <div class="locked-name">{{ studentProfile.studentName }}</div>
              <div class="locked-meta">
                Class: {{ studentProfile.className }} - {{ studentProfile.sectionName }} · Roll: {{ studentProfile.rollNumber }}
              </div>
            </div>
          </div>

          <!-- Reason Category -->
          <div class="form-row-2">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Reason Category *</mat-label>
              <mat-select [(ngModel)]="requestForm.reasonCategory" required>
                <mat-option *ngFor="let cat of reasonCategories" [value]="cat">{{ cat }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Parent / Guardian Relation</mat-label>
              <mat-select [(ngModel)]="requestForm.parentRelation">
                <mat-option value="Father">Father</mat-option>
                <mat-option value="Mother">Mother</mat-option>
                <mat-option value="Guardian">Local Guardian</mat-option>
                <mat-option value="Self">Self / Senior Student</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <!-- Reason Description -->
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Detailed Reason for Early Exit *</mat-label>
            <textarea 
              matInput 
              rows="3" 
              [(ngModel)]="requestForm.reason" 
              required
              placeholder="e.g. Doctor appointment scheduled at 11:30 AM, family emergency, feeling unwell..."></textarea>
          </mat-form-field>

          <!-- Expected Return Time Toggle & Picker -->
          <div class="return-toggle-row">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="willReturn" (change)="onReturnToggle()">
              <span>Student will return to campus today</span>
            </label>
          </div>

          <div class="form-row-2" *ngIf="willReturn">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Expected Return Time *</mat-label>
              <input matInput type="time" [(ngModel)]="expectedReturnTimeStr">
            </mat-form-field>
          </div>

          <!-- Parent Contact Info -->
          <div class="form-row-2">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Parent / Guardian Name</mat-label>
              <input matInput [(ngModel)]="requestForm.parentGuardianName" placeholder="Father or Mother's name">
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Parent Contact Phone *</mat-label>
              <input matInput [(ngModel)]="requestForm.parentContactNumber" placeholder="10-digit mobile number">
            </mat-form-field>
          </div>

          <!-- Remarks / Security info for Staff -->
          <div *ngIf="!isStudentOrParent">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Security Guard Name (Optional)</mat-label>
              <input matInput [(ngModel)]="requestForm.securityGuardName" placeholder="e.g. Guard Ram Singh">
            </mat-form-field>
          </div>
        </div>

        <div class="sgp-modal-footer">
          <button mat-button (click)="dialogRef.close()" [disabled]="submitting">Cancel</button>
          <button mat-raised-button class="sgp-primary-btn" 
            (click)="submitGatePass(dialogRef)" 
            [disabled]="submitting || !requestForm.reason || (!isStudentOrParent && !requestForm.studentId)">
            <mat-icon *ngIf="!submitting">check</mat-icon>
            <mat-icon *ngIf="submitting" class="spinning">refresh</mat-icon>
            {{ submitting ? 'Submitting...' : 'Submit Request' }}
          </button>
        </div>
      </div>
    </ng-template>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- DIGITAL GATE PASS SLIP / PRINT MODAL (Strict Light Blue Header)-->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <ng-template #slipDialogTpl let-dialogRef>
      <div class="sgp-modal slip-modal-wrap" *ngIf="selectedPass">
        <div class="sgp-modal-header no-print">
          <div class="sgp-modal-icon">
            <mat-icon>confirmation_number</mat-icon>
          </div>
          <div class="sgp-modal-header-titles">
            <h2 class="sgp-modal-title">Student Gate Pass Slip</h2>
            <p class="sgp-modal-sub">
              Pass No: <strong>{{ selectedPass.gatePassNumber }}</strong> · {{ selectedPass.studentName }}
            </p>
          </div>
          <button mat-icon-button class="sgp-modal-close" (click)="dialogRef.close()">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="sgp-modal-body slip-body" id="printable-gate-pass">
          <!-- Official Gate Pass Printable Card -->
          <div class="official-slip-card">
            <!-- Header -->
            <div class="slip-institute-header">
              <div class="slip-logo-box">
                <mat-icon>school</mat-icon>
              </div>
              <div class="slip-institute-titles">
                <h3>CAMPUS STUDENT GATE PASS</h3>
                <span class="slip-sub">Official Early Exit Authorization</span>
              </div>
              <div class="slip-qr-box">
                <div class="qr-mock">
                  <mat-icon>qr_code_2</mat-icon>
                  <span>{{ selectedPass.gatePassNumber }}</span>
                </div>
              </div>
            </div>

            <!-- Pass Number & Status Ribbon -->
            <div class="slip-ribbon-bar">
              <div class="ribbon-pass-no">
                PASS #: <strong>{{ selectedPass.gatePassNumber }}</strong>
              </div>
              <div class="ribbon-status" [class]="'ribbon-' + selectedPass.status.toLowerCase()">
                {{ selectedPass.status | uppercase }}
              </div>
            </div>

            <!-- Student Grid -->
            <div class="slip-details-grid">
              <div class="slip-field">
                <label>Student Name</label>
                <strong>{{ selectedPass.studentName }}</strong>
              </div>
              <div class="slip-field">
                <label>Class & Section</label>
                <strong>{{ selectedPass.className }} - {{ selectedPass.sectionName }}</strong>
              </div>
              <div class="slip-field">
                <label>Roll Number</label>
                <strong>{{ selectedPass.rollNumber || 'N/A' }}</strong>
              </div>
              <div class="slip-field">
                <label>Parent / Guardian</label>
                <strong>{{ selectedPass.parentGuardianName || 'Parent' }} ({{ selectedPass.parentRelation || 'Guardian' }})</strong>
              </div>
              <div class="slip-field">
                <label>Parent Contact Phone</label>
                <strong>{{ selectedPass.parentContactNumber || 'N/A' }}</strong>
              </div>
              <div class="slip-field">
                <label>Exit Category</label>
                <strong>{{ selectedPass.reasonCategory }}</strong>
              </div>
            </div>

            <!-- Reason Full -->
            <div class="slip-reason-box">
              <label>Reason for Early Exit:</label>
              <p>{{ selectedPass.reason }}</p>
            </div>

            <!-- Time Details -->
            <div class="slip-time-grid">
              <div class="slip-time-card">
                <label>Authorized Out Time</label>
                <div class="time-big">{{ selectedPass.outDateTime | date:'hh:mm a':'Asia/Kolkata' }}</div>
                <div class="date-sub">{{ selectedPass.outDateTime | date:'EEEE, dd MMMM yyyy':'Asia/Kolkata' }}</div>
              </div>
              <div class="slip-time-card" *ngIf="selectedPass.expectedReturnTime">
                <label>Expected Return Time</label>
                <div class="time-big">{{ selectedPass.expectedReturnTime | date:'hh:mm a':'Asia/Kolkata' }}</div>
                <div class="date-sub">{{ selectedPass.expectedReturnTime | date:'EEEE, dd MMMM yyyy':'Asia/Kolkata' }}</div>
              </div>
            </div>

            <!-- Approval Stamp Strip -->
            <div class="slip-approval-strip">
              <div class="stamp-box" *ngIf="selectedPass.status === 'Approved'">
                <div class="stamp-badge">
                  <mat-icon>verified</mat-icon> APPROVED
                </div>
                <div class="stamp-meta">
                  Approved by: <strong>{{ selectedPass.approvedBy || 'Administration' }}</strong><br>
                  At: {{ selectedPass.approvedAt | date:'dd MMM yyyy, hh:mm a':'Asia/Kolkata' }}
                </div>
              </div>

              <div class="stamp-box-pending" *ngIf="selectedPass.status === 'Pending'">
                <div class="stamp-badge-pending">
                  <mat-icon>hourglass_top</mat-icon> PENDING APPROVAL
                </div>
                <div class="stamp-meta">
                  This request is awaiting authorization from school admin/warden.
                </div>
              </div>

              <div class="security-signature-box">
                <div class="signature-line"></div>
                <span>Security Officer Exit Signature</span>
              </div>
            </div>

            <!-- Bottom Disclaimer -->
            <div class="slip-disclaimer">
              * Student must present this pass at the security gate before leaving campus. Parents are notified upon gate pass generation.
            </div>
          </div>
        </div>

        <div class="sgp-modal-footer no-print">
          <button mat-button (click)="dialogRef.close()">Close</button>
          <button mat-raised-button class="sgp-primary-btn" (click)="printSlip()">
            <mat-icon>print</mat-icon> Print Gate Pass
          </button>
        </div>
      </div>
    </ng-template>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- APPROVE / REJECT MODAL (Strict Light Blue Header)               -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <ng-template #reviewDialogTpl let-dialogRef>
      <div class="sgp-modal" *ngIf="reviewingPass">
        <div class="sgp-modal-header">
          <div class="sgp-modal-icon" [style.background]="reviewAction === 'Approve' ? '#16a34a' : '#dc2626'">
            <mat-icon>{{ reviewAction === 'Approve' ? 'check_circle' : 'cancel' }}</mat-icon>
          </div>
          <div class="sgp-modal-header-titles">
            <h2 class="sgp-modal-title">{{ reviewAction }} Gate Pass</h2>
            <p class="sgp-modal-sub">
              Pass: <strong>{{ reviewingPass.gatePassNumber }}</strong> · {{ reviewingPass.studentName }}
            </p>
          </div>
          <button mat-icon-button class="sgp-modal-close" (click)="dialogRef.close()">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="sgp-modal-body">
          <p style="color:#475569; font-size:13.5px; margin-bottom:14px;">
            Are you sure you want to <strong>{{ reviewAction | lowercase }}</strong> the early-exit gate pass for 
            <strong>{{ reviewingPass.studentName }}</strong> ({{ reviewingPass.className }} {{ reviewingPass.sectionName }})?
          </p>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Remarks / Notes (Optional)</mat-label>
            <input matInput [(ngModel)]="reviewRemarks" placeholder="e.g. Verified with parent via phone call">
          </mat-form-field>
        </div>

        <div class="sgp-modal-footer">
          <button mat-button (click)="dialogRef.close()" [disabled]="submitting">Cancel</button>
          <button mat-raised-button 
            [style.background]="reviewAction === 'Approve' ? '#16a34a' : '#dc2626'" 
            style="color:#fff;" 
            (click)="confirmReview(dialogRef)" 
            [disabled]="submitting">
            <mat-icon>{{ reviewAction === 'Approve' ? 'check' : 'close' }}</mat-icon>
            Confirm {{ reviewAction }}
          </button>
        </div>
      </div>
    </ng-template>
  `,
  styles: [`
    .sgp-page {
      padding: 0 0 40px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      background: #f8fafc;
      min-height: 100vh;
      box-sizing: border-box;
      font-family: inherit;
    }

    /* ── Header Card ─────────────────────────────────────────────── */
    .sgp-header-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 20px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      flex-wrap: wrap;
    }
    .sgp-header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .sgp-header-icon {
      width: 52px;
      height: 52px;
      border-radius: 12px;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(37, 99, 235, 0.28);
    }
    .sgp-header-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }
    .sgp-title-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .sgp-title {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
      letter-spacing: -0.3px;
    }
    .sgp-badge-role {
      background: #eff6ff;
      color: #2563eb;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 20px;
      border: 1px solid #bfdbfe;
    }
    .sgp-subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 4px 0 0;
    }
    .sgp-header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .sgp-primary-btn {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
      color: #ffffff !important;
      font-weight: 600 !important;
      border-radius: 9px !important;
      padding: 0 18px !important;
      height: 40px !important;
      box-shadow: 0 3px 8px rgba(37, 99, 235, 0.25) !important;
    }
    .sgp-secondary-btn {
      border-color: #cbd5e1 !important;
      color: #334155 !important;
      font-weight: 500 !important;
      border-radius: 9px !important;
      height: 40px !important;
    }

    /* ── Student Profile Banner ──────────────────────────────────── */
    .sgp-student-profile-strip {
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
      flex-wrap: wrap;
    }
    .profile-avatar {
      width: 42px;
      height: 42px;
      border-radius: 10px;
      background: #16a34a;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .profile-info { flex: 1; min-width: 200px; }
    .profile-name { font-size: 15px; font-weight: 700; color: #14532d; }
    .profile-meta { font-size: 12.5px; color: #166534; display: flex; gap: 14px; flex-wrap: wrap; margin-top: 2px; }
    .profile-meta strong { color: #0f172a; }
    .profile-tip {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #15803d;
      background: rgba(255, 255, 255, 0.7);
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid #bbf7d0;
      max-width: 480px;
    }
    .profile-tip mat-icon { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; }

    /* ── Stats Grid ──────────────────────────────────────────────── */
    .sgp-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 14px;
    }
    .stat-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 14px;
      cursor: pointer;
      position: relative;
      transition: all 0.2s ease;
    }
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    }
    .stat-icon-box {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .stat-val { font-size: 22px; font-weight: 700; line-height: 1.2; }
    .stat-lbl { font-size: 12px; color: #64748b; font-weight: 500; margin-top: 2px; }
    .stat-sub-badge {
      position: absolute;
      top: 10px;
      right: 10px;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 10px;
    }

    .stat-all .stat-icon-box { background: #eff6ff; color: #2563eb; }
    .stat-all .stat-val { color: #1e3a8a; }

    .stat-pending .stat-icon-box { background: #fffbeb; color: #d97706; }
    .stat-pending .stat-val { color: #b45309; }
    .stat-pending .stat-sub-badge { background: #fef3c7; color: #92400e; }

    .stat-approved .stat-icon-box { background: #f0fdf4; color: #16a34a; }
    .stat-approved .stat-val { color: #15803d; }
    .stat-approved .stat-sub-badge { background: #dcfce7; color: #166534; }

    .stat-returned .stat-icon-box { background: #f8fafc; color: #475569; }
    .stat-returned .stat-val { color: #334155; }

    .stat-rejected .stat-icon-box { background: #fef2f2; color: #dc2626; }
    .stat-rejected .stat-val { color: #991b1b; }

    /* ── Controls Bar ────────────────────────────────────────────── */
    .sgp-controls-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 16px;
    }
    .controls-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .search-box {
      flex: 1;
      min-width: 240px;
      display: flex;
      align-items: center;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 0 10px;
      height: 40px;
    }
    .search-icon { color: #64748b; font-size: 20px; width: 20px; height: 20px; margin-right: 8px; }
    .search-input {
      border: none;
      background: transparent;
      outline: none;
      width: 100%;
      font-size: 13.5px;
      color: #0f172a;
    }
    .filter-field {
      width: 180px;
    }
    .filter-btn {
      height: 40px !important;
      border-radius: 8px !important;
      color: #475569 !important;
      border-color: #cbd5e1 !important;
    }
    .view-toggle {
      display: flex;
      background: #f1f5f9;
      border-radius: 8px;
      padding: 2px;
      margin-left: auto;
    }
    .view-toggle button {
      width: 36px;
      height: 36px;
      border-radius: 6px;
      color: #64748b;
    }
    .view-toggle button.active-mode {
      background: #ffffff;
      color: #2563eb;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    /* ── Cards Grid ──────────────────────────────────────────────── */
    .sgp-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 18px;
    }
    .pass-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      transition: all 0.2s ease;
      position: relative;
    }
    .pass-card:hover {
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
      transform: translateY(-2px);
    }
    .pass-card.border-pending { border-top: 4px solid #f59e0b; }
    .pass-card.border-approved { border-top: 4px solid #16a34a; }
    .pass-card.border-returned { border-top: 4px solid #3b82f6; }
    .pass-card.border-rejected { border-top: 4px solid #ef4444; }

    .pass-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .pass-num-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 4px 10px;
      border-radius: 8px;
      font-weight: 700;
      color: #1e3a8a;
      font-size: 13px;
    }
    .pass-num-pill mat-icon { font-size: 16px; width: 16px; height: 16px; color: #3b82f6; }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11.5px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 20px;
    }
    .status-pill mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .status-pending { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
    .status-approved { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
    .status-returned { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
    .status-rejected { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }

    /* Student Block */
    .pass-student-block {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #e2e8f0;
    }
    .student-avatar-circle {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #eff6ff;
      color: #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .student-name-text { font-size: 14.5px; font-weight: 700; color: #0f172a; }
    .student-class-text { font-size: 12px; color: #64748b; }

    /* Reason box */
    .pass-reason-box {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .category-tag {
      align-self: flex-start;
      background: #f1f5f9;
      color: #475569;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 6px;
    }
    .category-tag-sm {
      background: #f1f5f9;
      color: #475569;
      font-size: 10.5px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
    }
    .reason-full-text {
      font-size: 13px;
      color: #334155;
      margin: 0;
      line-height: 1.45;
    }

    /* Times strip */
    .pass-times-strip {
      display: flex;
      gap: 12px;
      background: #f8fafc;
      border-radius: 10px;
      padding: 10px 12px;
      border: 1px solid #f1f5f9;
    }
    .time-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .time-label {
      font-size: 10.5px;
      font-weight: 600;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .time-label mat-icon { font-size: 12px; width: 12px; height: 12px; }
    .time-val { font-size: 13px; font-weight: 700; color: #0f172a; }
    .time-sub { font-size: 11px; color: #64748b; }

    /* Guardian & Approver */
    .pass-guardian-strip {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #475569;
    }
    .pass-guardian-strip mat-icon { font-size: 14px; width: 14px; height: 14px; color: #94a3b8; }

    .pass-approval-box {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;
    }
    .pass-approval-box mat-icon { font-size: 18px; width: 18px; height: 18px; margin-top: 1px; }
    .approver-name { font-size: 12px; color: #334155; }
    .approver-time { font-size: 11px; color: #64748b; }
    .approval-remarks { font-size: 11.5px; font-style: italic; color: #475569; margin-top: 2px; }

    /* Card Footer */
    .pass-card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid #f1f5f9;
      padding-top: 10px;
      margin-top: auto;
    }
    .view-slip-btn {
      color: #2563eb !important;
      font-weight: 600 !important;
      font-size: 12.5px !important;
    }
    .footer-right-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .cancel-pass-btn {
      font-size: 12px !important;
      font-weight: 600 !important;
    }

    /* ── Table View ──────────────────────────────────────────────── */
    .sgp-table-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }
    .table-responsive { overflow-x: auto; }
    .sgp-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;
    }
    .sgp-table th {
      background: #f8fafc;
      color: #475569;
      font-weight: 700;
      padding: 14px 16px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }
    .sgp-table td {
      padding: 13px 16px;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
      vertical-align: middle;
    }
    .sgp-table tr:hover { background: #f8fafc; }
    .sgp-table tr.row-pending { background: #fffdf5; }
    .tbl-pass-num {
      font-weight: 700;
      color: #1e3a8a;
      background: #eff6ff;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 12px;
    }
    .tbl-student-name { font-weight: 600; color: #0f172a; }
    .tbl-student-meta { font-size: 11.5px; color: #64748b; }
    .tbl-reason { font-size: 12px; color: #475569; margin-top: 2px; }
    .tbl-phone { font-size: 11.5px; color: #64748b; display: flex; align-items: center; gap: 3px; }
    .tbl-phone mat-icon { font-size: 12px; width: 12px; height: 12px; }
    .tbl-approver { font-weight: 600; color: #334155; font-size: 12px; }
    .tbl-pending-lbl { font-size: 11.5px; color: #d97706; font-style: italic; }
    .tbl-actions { display: flex; align-items: center; justify-content: flex-end; gap: 4px; }

    /* ── Empty State & Spinners ──────────────────────────────────── */
    .sgp-empty-state {
      background: #ffffff;
      border: 1px dashed #cbd5e1;
      border-radius: 14px;
      padding: 48px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .empty-icon-wrap {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #eff6ff;
      color: #3b82f6;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .empty-icon-wrap mat-icon { font-size: 32px; width: 32px; height: 32px; }
    .sgp-empty-state h3 { margin: 0; font-size: 17px; font-weight: 700; color: #0f172a; }
    .sgp-empty-state p { margin: 0; font-size: 13.5px; color: #64748b; max-width: 440px; }

    .loading-state {
      padding: 48px;
      text-align: center;
      color: #64748b;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    .spinning { animation: spin 1s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    /* ═══════════════════════════════════════════════════════════════ */
    /* STRICT MODAL STYLING (User Rule Compliance)                    */
    /* Header background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) */
    /* Header border: 1px solid #bfdbfe                               */
    /* Icon box: background #2563eb, color #fff, border-radius 10px    */
    /* Main Title: #1e3a8a, 700 weight                                */
    /* Subtitle: #3b82f6                                              */
    /* Close button: #64748b                                          */
    /* ═══════════════════════════════════════════════════════════════ */
    .sgp-modal {
      min-width: 580px;
      max-width: 680px;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
    }
    .slip-modal-wrap {
      min-width: 650px;
      max-width: 720px;
    }
    .sgp-modal-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 20px 24px 16px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
    }
    .sgp-modal-icon {
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
      flex-shrink: 0;
    }
    .sgp-modal-header-titles { flex: 1; }
    .sgp-modal-title {
      color: #1e3a8a;
      font-weight: 700;
      font-size: 1.15rem;
      margin: 0;
      letter-spacing: -0.2px;
    }
    .sgp-modal-sub {
      color: #3b82f6;
      font-size: 0.82rem;
      margin: 2px 0 0;
    }
    .sgp-modal-close {
      color: #64748b !important;
      margin-left: auto;
    }
    .sgp-modal-close:hover { color: #1e293b !important; }

    .sgp-modal-body {
      padding: 22px 24px;
      max-height: 65vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .sgp-modal-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .form-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .w-full { width: 100%; }

    .student-locked-badge {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 10px 14px;
      color: #1e3a8a;
      margin-bottom: 4px;
    }
    .locked-name { font-weight: 700; font-size: 14px; }
    .locked-meta { font-size: 12px; color: #3b82f6; }

    .return-toggle-row {
      margin: 2px 0 6px;
    }
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
      cursor: pointer;
    }

    /* ── Digital Printable Slip ─────────────────────────────────── */
    .official-slip-card {
      border: 2px solid #0f172a;
      border-radius: 8px;
      padding: 20px;
      background: #ffffff;
      color: #0f172a;
    }
    .slip-institute-header {
      display: flex;
      align-items: center;
      gap: 14px;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 12px;
    }
    .slip-logo-box {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      background: #1e3a8a;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .slip-institute-titles { flex: 1; }
    .slip-institute-titles h3 { margin: 0; font-size: 16px; font-weight: 800; letter-spacing: 0.5px; }
    .slip-sub { font-size: 12px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
    .slip-qr-box { text-align: center; }
    .qr-mock {
      display: flex;
      flex-direction: column;
      align-items: center;
      border: 1px dashed #64748b;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .qr-mock mat-icon { font-size: 32px; width: 32px; height: 32px; color: #0f172a; }
    .qr-mock span { font-size: 9px; font-weight: 700; }

    .slip-ribbon-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f1f5f9;
      padding: 8px 12px;
      border-radius: 6px;
      margin-bottom: 14px;
      font-size: 13px;
    }
    .ribbon-status {
      font-weight: 800;
      font-size: 12px;
      padding: 3px 10px;
      border-radius: 4px;
    }
    .ribbon-pending { background: #fef3c7; color: #92400e; }
    .ribbon-approved { background: #dcfce7; color: #166534; }
    .ribbon-returned { background: #dbeafe; color: #1e40af; }
    .ribbon-rejected { background: #fee2e2; color: #991b1b; }

    .slip-details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px 14px;
      margin-bottom: 14px;
      font-size: 12.5px;
    }
    .slip-field label {
      display: block;
      font-size: 10.5px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
    }
    .slip-field strong { font-size: 13px; color: #0f172a; }

    .slip-reason-box {
      background: #f8fafc;
      border-left: 3px solid #2563eb;
      padding: 8px 12px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 14px;
    }
    .slip-reason-box label { font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; }
    .slip-reason-box p { margin: 2px 0 0; font-size: 13px; color: #1e293b; }

    .slip-time-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
    }
    .slip-time-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px;
      text-align: center;
    }
    .slip-time-card label { font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; }
    .slip-time-card .time-big { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    .slip-time-card .date-sub { font-size: 11px; color: #64748b; }

    .slip-approval-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px dashed #94a3b8;
      padding-top: 14px;
      margin-top: 10px;
    }
    .stamp-box {
      border: 2px solid #16a34a;
      border-radius: 6px;
      padding: 6px 12px;
      background: #f0fdf4;
      display: inline-block;
    }
    .stamp-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 800;
      color: #15803d;
      letter-spacing: 0.5px;
    }
    .stamp-meta { font-size: 10.5px; color: #166534; margin-top: 2px; }

    .stamp-box-pending {
      border: 2px dashed #d97706;
      border-radius: 6px;
      padding: 6px 12px;
      background: #fffbeb;
    }
    .stamp-badge-pending {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 800;
      color: #b45309;
    }

    .security-signature-box {
      text-align: center;
      width: 200px;
    }
    .signature-line {
      border-bottom: 1px solid #0f172a;
      margin-bottom: 4px;
      height: 36px;
    }
    .security-signature-box span { font-size: 10.5px; color: #64748b; font-weight: 600; }

    .slip-disclaimer {
      font-size: 10.5px;
      color: #64748b;
      margin-top: 12px;
      font-style: italic;
    }

    /* Print styles */
    @media print {
      body * { visibility: hidden; }
      #printable-gate-pass, #printable-gate-pass * { visibility: visible; }
      #printable-gate-pass {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        padding: 20px;
      }
      .no-print { display: none !important; }
    }

    @media (max-width: 640px) {
      .sgp-page { padding: 12px; }
      .sgp-modal, .slip-modal-wrap { min-width: 100%; }
      .form-row-2, .slip-details-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class StudentGatePassComponent implements OnInit {
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  public authService = inject(AuthService);

  @ViewChild('requestDialogTpl') requestDialogTpl!: TemplateRef<any>;
  @ViewChild('slipDialogTpl') slipDialogTpl!: TemplateRef<any>;
  @ViewChild('reviewDialogTpl') reviewDialogTpl!: TemplateRef<any>;

  gatePasses: StudentGatePassItem[] = [];
  allStudents: any[] = [];
  studentProfile: any = null;

  loading = false;
  submitting = false;
  viewMode: 'grid' | 'table' = 'grid';

  searchQuery = '';
  filterStatus = '';
  filterCategory = '';

  reasonCategories = [
    'Medical Emergency',
    'Family Emergency',
    'Doctor Appointment',
    'Early Pickup',
    'Event',
    'Personal / Other'
  ];

  stats = {
    total: 0,
    pending: 0,
    approved: 0,
    returned: 0,
    rejected: 0
  };

  // Dialog State
  requestForm: any = {
    studentId: '',
    reasonCategory: 'Early Pickup',
    reason: '',
    expectedReturnTime: null,
    parentGuardianName: '',
    parentContactNumber: '',
    parentRelation: 'Father',
    securityGuardName: '',
    remarks: ''
  };

  willReturn = false;
  expectedReturnTimeStr = '';

  selectedPass: StudentGatePassItem | null = null;
  reviewingPass: StudentGatePassItem | null = null;
  reviewAction: 'Approve' | 'Reject' = 'Approve';
  reviewRemarks = '';

  get isStudentOrParent(): boolean {
    const role = this.authService.currentUser()?.role || '';
    return role === 'Student' || role === 'Parent';
  }

  get currentRoleLabel(): string {
    return this.authService.currentUser()?.role || 'Staff';
  }

  ngOnInit(): void {
    this.loadStudentProfile();
    this.loadGatePasses();
    if (!this.isStudentOrParent) {
      this.loadAllStudents();
    }
  }

  loadStudentProfile(): void {
    this.http.get<any>(`${API_BASE}/front-desk/gate-passes/my-profile`).subscribe({
      next: (profile) => {
        if (profile?.isStudentOrParent) {
          this.studentProfile = profile;
          this.requestForm.studentId = profile.studentId;
          this.requestForm.parentGuardianName = profile.parentName || '';
          this.requestForm.parentContactNumber = profile.parentPhone || '';
        }
      },
      error: () => {}
    });
  }

  selectedClass = '';
  classList: string[] = [];
  filteredStaffStudents: any[] = [];

  loadAllStudents(): void {
    this.http.get<any[]>(`${API_BASE}/students`).subscribe({
      next: (res) => {
        this.allStudents = res || [];
        this.filteredStaffStudents = this.allStudents;
        const set = new Set<string>();
        for (const s of this.allStudents) {
          const cls = (s.className ? (s.className + (s.sectionName ? ' - ' + s.sectionName : '')) : (s.className || '')).trim();
          if (cls) set.add(cls);
        }
        this.classList = Array.from(set).sort();
      },
      error: () => {
        this.allStudents = [];
        this.filteredStaffStudents = [];
      }
    });
  }

  onClassChange(): void {
    this.requestForm.studentId = '';
    if (!this.selectedClass) {
      this.filteredStaffStudents = this.allStudents;
    } else {
      this.filteredStaffStudents = this.allStudents.filter(s => {
        const cls = (s.className ? (s.className + (s.sectionName ? ' - ' + s.sectionName : '')) : (s.className || '')).trim();
        return cls === this.selectedClass;
      });
    }
  }

  onStudentSelected(): void {
    const s = this.allStudents.find(x => x.id === this.requestForm.studentId);
    if (s) {
      this.requestForm.parentGuardianName = s.parentName || s.fatherName || '';
      this.requestForm.parentContactNumber = s.parentWhatsAppPhone || s.emergencyContactPhone || '';
    }
  }

  loadGatePasses(): void {
    this.loading = true;
    const params: any = {};
    if (this.filterStatus && this.filterStatus !== 'All') params.status = this.filterStatus;
    if (this.searchQuery.trim()) params.search = this.searchQuery.trim();

    this.http.get<StudentGatePassItem[]>(`${API_BASE}/front-desk/gate-passes`, { params }).subscribe({
      next: (data) => {
        this.gatePasses = data || [];
        this.computeStats();
        this.loading = false;
      },
      error: (err) => {
        this.gatePasses = [];
        this.loading = false;
        this.snack.open('Failed to load gate passes: ' + (err.error?.message || err.message), 'Close', { duration: 4000 });
      }
    });
  }

  computeStats(): void {
    this.stats.total = this.gatePasses.length;
    this.stats.pending = this.gatePasses.filter(p => p.status === 'Pending').length;
    this.stats.approved = this.gatePasses.filter(p => p.status === 'Approved').length;
    this.stats.returned = this.gatePasses.filter(p => p.status === 'Returned').length;
    this.stats.rejected = this.gatePasses.filter(p => p.status === 'Rejected').length;
  }

  get filteredPasses(): StudentGatePassItem[] {
    return this.gatePasses.filter(p => {
      if (this.filterCategory && p.reasonCategory !== this.filterCategory) return false;
      return true;
    });
  }

  applyFilters(): void {
    this.loadGatePasses();
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'Approved': return 'verified';
      case 'Pending': return 'hourglass_top';
      case 'Returned': return 'keyboard_return';
      case 'Rejected': return 'cancel';
      default: return 'help_outline';
    }
  }

  onReturnToggle(): void {
    if (!this.willReturn) {
      this.expectedReturnTimeStr = '';
      this.requestForm.expectedReturnTime = null;
    }
  }

  openRequestModal(): void {
    this.requestForm.reason = '';
    this.requestForm.reasonCategory = 'Early Pickup';
    this.willReturn = false;
    this.expectedReturnTimeStr = '';

    if (this.isStudentOrParent && this.studentProfile) {
      this.requestForm.studentId = this.studentProfile.studentId;
      this.requestForm.parentGuardianName = this.studentProfile.parentName || '';
      this.requestForm.parentContactNumber = this.studentProfile.parentPhone || '';
    } else if (this.allStudents.length > 0 && !this.requestForm.studentId) {
      this.requestForm.studentId = this.allStudents[0].id;
      this.onStudentSelected();
    }

    this.dialog.open(this.requestDialogTpl, {
      width: '650px',
      disableClose: true
    });
  }

  submitGatePass(dialogRef: MatDialogRef<any>): void {
    if (!this.requestForm.reason?.trim()) {
      this.snack.open('Please provide a reason for the gate pass.', 'Close', { duration: 3000 });
      return;
    }

    if (!this.isStudentOrParent && !this.requestForm.studentId) {
      this.snack.open('Please select a student.', 'Close', { duration: 3000 });
      return;
    }

    // Build return datetime if toggled
    if (this.willReturn && this.expectedReturnTimeStr) {
      const today = new Date();
      const [hh, mm] = this.expectedReturnTimeStr.split(':');
      today.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
      this.requestForm.expectedReturnTime = today.toISOString();
    } else {
      this.requestForm.expectedReturnTime = null;
    }

    this.submitting = true;
    this.http.post<StudentGatePassItem>(`${API_BASE}/front-desk/gate-passes`, this.requestForm).subscribe({
      next: (created) => {
        this.submitting = false;
        dialogRef.close();
        this.snack.open(`Gate pass ${created.gatePassNumber} requested successfully!`, 'Close', { duration: 4000 });
        this.loadGatePasses();
      },
      error: (err) => {
        this.submitting = false;
        this.snack.open(err.error?.message || 'Failed to submit gate pass request.', 'Close', { duration: 4500 });
      }
    });
  }

  viewDigitalPass(pass: StudentGatePassItem): void {
    this.selectedPass = pass;
    this.dialog.open(this.slipDialogTpl, {
      width: '720px'
    });
  }

  printSlip(): void {
    window.print();
  }

  cancelPass(pass: StudentGatePassItem): void {
    if (!confirm(`Are you sure you want to cancel your gate pass request (${pass.gatePassNumber})?`)) return;

    this.http.delete(`${API_BASE}/front-desk/gate-passes/${pass.id}`).subscribe({
      next: () => {
        this.snack.open('Gate pass request cancelled.', 'Close', { duration: 3000 });
        this.loadGatePasses();
      },
      error: (err) => {
        this.snack.open(err.error?.message || 'Could not cancel pass.', 'Close', { duration: 4000 });
      }
    });
  }

  // ── Admin Review Actions ──────────────────────────────────────────
  reviewPass(pass: StudentGatePassItem, action: 'Approve' | 'Reject'): void {
    this.reviewingPass = pass;
    this.reviewAction = action;
    this.reviewRemarks = '';

    this.dialog.open(this.reviewDialogTpl, {
      width: '520px'
    });
  }

  confirmReview(dialogRef: MatDialogRef<any>): void {
    if (!this.reviewingPass) return;
    this.submitting = true;

    const payload = {
      action: this.reviewAction,
      approvalRemarks: this.reviewRemarks
    };

    this.http.put(`${API_BASE}/front-desk/gate-passes/${this.reviewingPass.id}/approve`, payload).subscribe({
      next: () => {
        this.submitting = false;
        dialogRef.close();
        this.snack.open(`Gate pass ${this.reviewAction.toLowerCase()}d successfully.`, 'Close', { duration: 3000 });
        this.loadGatePasses();
      },
      error: (err) => {
        this.submitting = false;
        this.snack.open(err.error?.message || 'Review action failed.', 'Close', { duration: 4000 });
      }
    });
  }

  markStudentReturned(pass: StudentGatePassItem): void {
    if (!confirm(`Mark student ${pass.studentName} as returned to campus?`)) return;

    this.http.put(`${API_BASE}/front-desk/gate-passes/${pass.id}/return`, {}).subscribe({
      next: () => {
        this.snack.open('Student marked as returned to campus.', 'Close', { duration: 3000 });
        this.loadGatePasses();
      },
      error: (err) => {
        this.snack.open(err.error?.message || 'Failed to mark return.', 'Close', { duration: 4000 });
      }
    });
  }

  deletePass(pass: StudentGatePassItem): void {
    if (!confirm(`Delete gate pass ${pass.gatePassNumber}?`)) return;

    this.http.delete(`${API_BASE}/front-desk/gate-passes/${pass.id}`).subscribe({
      next: () => {
        this.snack.open('Gate pass deleted.', 'Close', { duration: 3000 });
        this.loadGatePasses();
      },
      error: (err) => {
        this.snack.open(err.error?.message || 'Failed to delete gate pass.', 'Close', { duration: 4000 });
      }
    });
  }
}
