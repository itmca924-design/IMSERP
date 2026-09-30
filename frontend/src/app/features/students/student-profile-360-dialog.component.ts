import { Component, Inject, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  CoachingService,
  Student360Data,
  StudentDocumentItem,
  CreateStudentDocumentPayload,
  StudentAchievementDto,
  CreateStudentAchievementDto,
  StudentDisciplinaryDto,
  CreateStudentDisciplinaryDto,
  StudentPtmDto,
  CreateStudentPtmDto,
  StudentHealthDto,
  SaveStudentHealthDto,
  StudentSiblingDto,
  AddStudentSiblingDto,
  SiblingCandidateSearchDto
} from '../../core/services/coaching.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';

export interface StudentProfile360DialogData {
  studentId: string;
  studentName?: string;
  rollNumber?: string;
  isReadOnly?: boolean;
}

const API_BASE = 'http://localhost:5000';

@Component({
  selector: 'app-student-profile-360-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  template: `
    <div class="profile-360-container">
      <!-- AGENTS.md Compliant Light-Blue Gradient Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="header-avatar-wrap">
            <img
              *ngIf="data360?.student?.profilePhoto"
              [src]="getPhotoUrl(data360!.student.profilePhoto)"
              [alt]="data360?.student?.studentName"
              class="header-avatar-img"
            />
            <div *ngIf="!data360?.student?.profilePhoto" class="header-avatar-fallback">
              {{ getInitials(data360?.student?.studentName || data.studentName || 'S') }}
            </div>
            <div class="status-indicator" [class.active]="data360?.student?.isActive !== false"></div>
          </div>
          <div class="header-title-box">
            <div class="title-row">
              <h2 class="modal-title">{{ data360?.student?.studentName || data.studentName || 'Student Profile' }}</h2>
              <span class="status-tag" [class.active]="data360?.student?.isActive !== false">
                {{ data360?.student?.isActive !== false ? 'Active Enrolled' : 'Inactive / Left' }}
              </span>
            </div>
            <p class="modal-subtitle">
              <span *ngIf="data360?.student?.className">
                Class: <strong>{{ data360!.student.className }}{{ data360!.student.sectionName ? ' - ' + data360!.student.sectionName : '' }}</strong>
              </span>
              <span *ngIf="data360?.student?.batchName" class="meta-sep">
                &bull; Batch: <strong>{{ data360!.student.batchName }}</strong>
              </span>
              <span *ngIf="data360?.student?.batchSubject" class="meta-sep">
                &bull; Subject: <strong>{{ data360!.student.batchSubject }}</strong>
              </span>
              <span class="meta-sep">
                &bull; Class Teacher: <strong [style.color]="data360?.student?.classTeacherName ? '#1e40af' : '#b45309'">{{ data360?.student?.classTeacherName || 'Not Assigned' }}</strong>
              </span>
              <span class="meta-sep">
                &bull; Roll: <strong>{{ data360?.student?.rollNumber || data.rollNumber || 'N/A' }}</strong>
              </span>
              <span *ngIf="data360?.student?.admissionNumber" class="meta-sep">
                &bull; SR/Adm: <strong>{{ data360!.student.admissionNumber }}</strong>
              </span>
            </p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn" aria-label="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Quick Metrics Ribbon -->
      <div class="metrics-ribbon" *ngIf="data360">
        <div class="metric-pill">
          <mat-icon class="icon-att">fact_check</mat-icon>
          <span class="metric-val" [class.good]="data360.attendanceSummary.attendancePercentage >= 75" [class.warn]="data360.attendanceSummary.attendancePercentage < 75">
            {{ data360.attendanceSummary.attendancePercentage }}%
          </span>
          <span class="metric-lbl">Attendance</span>
        </div>
        <div class="metric-pill">
          <mat-icon class="icon-fee" [class.danger]="data360.feeSummary.totalPending > 0">account_balance_wallet</mat-icon>
          <span class="metric-val" [class.danger]="data360.feeSummary.totalPending > 0" [class.good]="data360.feeSummary.totalPending === 0">
            ₹{{ data360.feeSummary.totalPending | number }}
          </span>
          <span class="metric-lbl">Due Balance</span>
        </div>
        <div class="metric-pill" *ngIf="data360.facilities.hasHostel">
          <mat-icon class="icon-hostel">hotel</mat-icon>
          <span class="metric-val">{{ data360.facilities.hostelName || 'Hostel' }}</span>
          <span class="metric-lbl">Rm {{ data360.facilities.roomNumber }} ({{ data360.facilities.bedCode }})</span>
        </div>
        <div class="metric-pill" *ngIf="data360.facilities.hasTransport">
          <mat-icon class="icon-transport">directions_bus</mat-icon>
          <span class="metric-val">{{ data360.facilities.routeName || 'Transport' }}</span>
          <span class="metric-lbl">{{ data360.facilities.stopName }}</span>
        </div>
        <div class="metric-pill" *ngIf="data360.library.isMember">
          <mat-icon class="icon-lib">local_library</mat-icon>
          <span class="metric-val">{{ data360.library.currentlyIssuedCount }} Books</span>
          <span class="metric-lbl">Issued</span>
        </div>
        <div class="metric-pill" *ngIf="data360.siblings.length">
          <mat-icon class="icon-sibling">family_restroom</mat-icon>
          <span class="metric-val">{{ data360.siblings.length }} Sibling{{ data360.siblings.length > 1 ? 's' : '' }}</span>
          <span class="metric-lbl">In School</span>
        </div>
      </div>

      <!-- Feature 5: Smart Early-Warning & Performance Radar Banner -->
      <div class="alert-radar-banner" *ngIf="data360?.performanceAlert as alert"
           [class.star-performer]="alert.isStarPerformer"
           [class.has-risk]="alert.hasAttendanceWarning || alert.hasExamWarning || alert.hasAttendanceRisk || alert.hasAcademicRisk">
        <div class="banner-left">
          <div class="banner-icon-badge">
            <mat-icon *ngIf="alert.isStarPerformer">military_tech</mat-icon>
            <mat-icon *ngIf="!alert.isStarPerformer && (alert.hasAttendanceWarning || alert.hasExamWarning || alert.hasAttendanceRisk || alert.hasAcademicRisk)">crisis_alert</mat-icon>
            <mat-icon *ngIf="!alert.isStarPerformer && !alert.hasAttendanceWarning && !alert.hasExamWarning && !alert.hasAttendanceRisk && !alert.hasAcademicRisk">insights</mat-icon>
          </div>
          <div class="banner-content">
            <div class="banner-title-line">
              <span class="banner-badge" *ngIf="alert.isStarPerformer">🌟 Star Scholar & High Achiever</span>
              <span class="banner-badge risk" *ngIf="alert.hasAttendanceWarning || alert.hasExamWarning || alert.hasAttendanceRisk || alert.hasAcademicRisk">⚠️ Early Warning Alert</span>
              <span class="banner-badge normal" *ngIf="!alert.isStarPerformer && !alert.hasAttendanceWarning && !alert.hasExamWarning && !alert.hasAttendanceRisk && !alert.hasAcademicRisk">📊 Performance Status</span>
              <span class="banner-summary-text">{{ alert.attendanceAlertMessage || alert.examAlertMessage || alert.performanceBadgeText || alert.alertMessage }}</span>
            </div>
            <!-- Strengths and Weaknesses Tags -->
            <div class="subject-tags-row" *ngIf="(alert.strongSubjects && alert.strongSubjects.length > 0) || (alert.weakSubjects && alert.weakSubjects.length > 0)">
              <div class="tag-group" *ngIf="alert.strongSubjects && alert.strongSubjects.length > 0">
                <span class="tag-title strong"><mat-icon>trending_up</mat-icon> Strengths:</span>
                <span class="sub-pill strong" *ngFor="let s of alert.strongSubjects">{{ s }}</span>
              </div>
              <div class="tag-group" *ngIf="alert.weakSubjects && alert.weakSubjects.length > 0">
                <span class="tag-title weak"><mat-icon>trending_down</mat-icon> Needs Attention:</span>
                <span class="sub-pill weak" *ngFor="let w of alert.weakSubjects">{{ w }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="banner-quick-actions">
          <button mat-button class="action-btn" (click)="activeTabIndex = 3">
            <mat-icon>assignment</mat-icon> Exams
          </button>
          <button mat-button class="action-btn" (click)="activeTabIndex = 8">
            <mat-icon>gavel</mat-icon> Conduct
          </button>
          <button mat-button class="action-btn" (click)="activeTabIndex = 9">
            <mat-icon>record_voice_over</mat-icon> PTM Desk
          </button>
          <button mat-button class="action-btn" (click)="activeTabIndex = 11">
            <mat-icon>diversity_3</mat-icon> Siblings ({{ siblingsList.length || (data360?.siblings?.length ?? 0) }})
          </button>
        </div>
      </div>

      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

      <div class="modal-body" *ngIf="data360">
        <mat-tab-group animationDuration="200ms" class="custom-tabs" [(selectedIndex)]="activeTabIndex">
          
          <!-- TAB 1: OVERVIEW & BIODATA -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">person</mat-icon> Overview
            </ng-template>
            <div class="tab-content-wrap">
              <div class="dossier-grid">
                
                <!-- Personal Info Card -->
                <div class="info-card">
                  <div class="card-header">
                    <mat-icon class="sect-icon">badge</mat-icon>
                    <h3>Student Identity &amp; Biodata</h3>
                  </div>
                  <div class="info-rows">
                    <div class="info-row">
                      <span class="row-label">Full Name:</span>
                      <span class="row-val font-semibold">{{ data360.student.studentName }}</span>
                    </div>
                    <div class="info-row">
                      <span class="row-label">Date of Birth:</span>
                      <span class="row-val">
                        {{ data360.student.dateOfBirth ? (data360.student.dateOfBirth | date:'dd MMM yyyy') : 'N/A' }}
                        <small *ngIf="data360.student.age">({{ data360.student.age }} years)</small>
                      </span>
                    </div>
                    <div class="info-row">
                      <span class="row-label">Gender / Blood:</span>
                      <span class="row-val">{{ data360.student.gender || 'N/A' }} &bull; {{ data360.student.bloodGroup || 'N/A' }}</span>
                    </div>
                    <div class="info-row">
                      <span class="row-label">Category / Religion:</span>
                      <span class="row-val">{{ data360.student.category || 'General' }} &bull; {{ data360.student.religion || 'N/A' }}</span>
                    </div>
                    <div class="info-row" *ngIf="data360.student.aadhaarNumber">
                      <span class="row-label">Aadhaar UID:</span>
                      <span class="row-val font-mono">{{ data360.student.aadhaarNumber }}</span>
                    </div>
                    <div class="info-row" *ngIf="data360.student.apaarId || data360.student.penNumber">
                      <span class="row-label">APAAR / PEN:</span>
                      <span class="row-val font-mono">{{ data360.student.apaarId || data360.student.penNumber }}</span>
                    </div>
                    <div class="info-row">
                      <span class="row-label">Joining Date:</span>
                      <span class="row-val">{{ data360.student.joiningDate | date:'dd MMM yyyy' }}</span>
                    </div>
                  </div>
                </div>

                <!-- Academic & Faculty Allocation Card -->
                <div class="info-card">
                  <div class="card-header">
                    <mat-icon class="sect-icon">school</mat-icon>
                    <h3>Academic &amp; Faculty Allocation</h3>
                  </div>
                  <div class="info-rows">
                    <div class="info-row">
                      <span class="row-label">Class &amp; Section:</span>
                      <span class="row-val font-semibold">
                        {{ data360.student.className ? data360.student.className + (data360.student.sectionName ? ' - ' + data360.student.sectionName : '') : 'N/A' }}
                      </span>
                    </div>
                    <div class="info-row">
                      <span class="row-label">Enrolled Batch:</span>
                      <span class="row-val font-semibold">{{ data360.student.batchName || 'N/A' }}</span>
                    </div>
                    <div class="info-row">
                      <span class="row-label">Subject:</span>
                      <span class="row-val font-semibold" [style.color]="data360.student.batchSubject ? '#1e40af' : '#64748b'">
                        {{ data360.student.batchSubject || 'General / All Subjects' }}
                      </span>
                    </div>
                    <div class="info-row">
                      <span class="row-label">Class Teacher:</span>
                      <span class="row-val ct-highlight" *ngIf="data360.student.classTeacherName">
                        {{ data360.student.classTeacherName }}
                        <small *ngIf="data360.student.classTeacherPhone">({{ data360.student.classTeacherPhone }})</small>
                      </span>
                      <span class="row-val" *ngIf="!data360.student.classTeacherName" style="color: #b45309; font-weight: 600; font-size: 0.82rem;">
                        Not Assigned <small style="color: #64748b; font-weight: 400;">(Master Management &gt; Classes &amp; Sections)</small>
                      </span>
                    </div>
                    <div class="info-row">
                      <span class="row-label">Admission / SR No:</span>
                      <span class="row-val font-mono">{{ data360.student.admissionNumber || 'N/A' }}</span>
                    </div>
                    <div class="info-row">
                      <span class="row-label">Roll Number:</span>
                      <span class="row-val">{{ data360.student.schoolRollNumber || data360.student.rollNumber || 'N/A' }}</span>
                    </div>
                    <div class="info-row" *ngIf="data360.student.branchName">
                      <span class="row-label">Branch:</span>
                      <span class="row-val">{{ data360.student.branchName }}</span>
                    </div>
                  </div>
                </div>

                <!-- Parents & Guardian Info Card -->
                <div class="info-card">
                  <div class="card-header">
                    <mat-icon class="sect-icon">people</mat-icon>
                    <h3>Parents &amp; Emergency Contacts</h3>
                  </div>
                  <div class="info-rows">
                    <div class="info-row">
                      <span class="row-label">Father / Guardian:</span>
                      <span class="row-val font-semibold">{{ data360.student.parentName }}</span>
                    </div>
                    <div class="info-row">
                      <span class="row-label">Mother's Name:</span>
                      <span class="row-val">{{ data360.student.motherName || 'N/A' }}</span>
                    </div>
                    <div class="info-row">
                      <span class="row-label">WhatsApp Contact:</span>
                      <span class="row-val highlight-phone">
                        <mat-icon class="phone-icon">chat</mat-icon>
                        {{ data360.student.parentWhatsAppPhone }}
                      </span>
                    </div>
                    <div class="info-row" *ngIf="data360.student.emergencyContactName">
                      <span class="row-label">Emergency Contact:</span>
                      <span class="row-val">{{ data360.student.emergencyContactName }} ({{ data360.student.emergencyContactPhone || 'No Phone' }})</span>
                    </div>
                    <div class="info-row">
                      <span class="row-label">Residential Address:</span>
                      <span class="row-val address-text">{{ data360.student.address || 'Not specified' }}</span>
                    </div>
                  </div>
                </div>

                <!-- Enrollment & Previous School Info Card -->
                <div class="info-card">
                  <div class="card-header">
                    <mat-icon class="sect-icon">history_edu</mat-icon>
                    <h3>Enrollment &amp; Academic Background</h3>
                  </div>
                  <div class="info-rows">
                    <div class="info-row">
                      <span class="row-label">Enrollment Type:</span>
                      <span class="row-val">
                        <span *ngIf="data360.student.isSchoolStudent" style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600; margin-right:4px;">School</span>
                        <span *ngIf="data360.student.isCoachingStudent" style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600;">Coaching</span>
                      </span>
                    </div>
                    <div class="info-row">
                      <span class="row-label">Previous School:</span>
                      <span class="row-val">{{ data360.student.previousSchoolName || 'N/A' }}</span>
                    </div>
                    <div class="info-row">
                      <span class="row-label">Previous Board:</span>
                      <span class="row-val">{{ data360.student.previousBoard || 'N/A' }}</span>
                    </div>
                    <div class="info-row">
                      <span class="row-label">Status:</span>
                      <span class="row-val font-semibold" [style.color]="data360.student.isActive ? '#16a34a' : '#dc2626'">
                        {{ data360.student.isActive ? 'Active Enrolled' : 'Inactive / Left' }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Linked Siblings Card -->
                <div class="info-card col-span-2">
                  <div class="card-header sibling-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:8px;">
                      <mat-icon class="sect-icon sibling-icon">family_restroom</mat-icon>
                      <h3>Linked Siblings / Family Members ({{ siblingsList.length || data360.siblings.length || 0 }})</h3>
                    </div>
                    <button mat-stroked-button color="primary" class="manage-sibs-btn" (click)="activeTabIndex = 11" style="height:28px; line-height:28px; font-size:11px;">
                      <mat-icon style="font-size:14px; width:14px; height:14px;">diversity_3</mat-icon> Manage / Link Sibling
                    </button>
                  </div>
                  <div class="siblings-grid" *ngIf="data360.siblings.length">
                    <div class="sibling-chip-card" *ngFor="let sib of data360.siblings" (click)="openSibling(sib.studentId)">
                      <div class="sib-avatar-wrap">
                        <img *ngIf="sib.profilePhoto" [src]="getPhotoUrl(sib.profilePhoto)" [alt]="sib.studentName" class="sib-avatar-img" />
                        <div *ngIf="!sib.profilePhoto" class="sib-avatar-fallback">{{ getInitials(sib.studentName) }}</div>
                      </div>
                      <div class="sib-info">
                        <div class="sib-name">{{ sib.studentName }}</div>
                        <div class="sib-meta">
                          <span *ngIf="sib.className">Class {{ sib.className }}{{ sib.sectionName ? ' - ' + sib.sectionName : '' }}</span>
                          <span *ngIf="sib.batchName"> &bull; {{ sib.batchName }}</span>
                          <span> &bull; Roll: {{ sib.rollNumber }}</span>
                        </div>
                      </div>
                      <mat-icon class="view-sib-icon" matTooltip="Click to open profile">launch</mat-icon>
                    </div>
                  </div>
                  <div *ngIf="!data360.siblings.length" style="padding:12px; color:#64748b; font-size:12px; display:flex; align-items:center; gap:8px;">
                    <mat-icon style="font-size:18px; width:18px; height:18px; color:#94a3b8;">info</mat-icon>
                    No siblings linked yet. Click "Manage / Link Sibling" to map family members and configure fee concessions.
                  </div>
                </div>

              </div>
            </div>
          </mat-tab>

          <!-- TAB 2: FEE LEDGER & PAYMENTS -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">payments</mat-icon> Fee Ledger
            </ng-template>
            <div class="tab-content-wrap">
              <div class="fee-kpi-row">
                <div class="fee-kpi-card billed">
                  <span class="kpi-label">Total Invoiced</span>
                  <span class="kpi-val">₹{{ data360.feeSummary.totalInvoiced | number }}</span>
                  <span class="kpi-sub">{{ data360.feeSummary.totalInvoicesCount }} Total Invoices</span>
                </div>
                <div class="fee-kpi-card paid">
                  <span class="kpi-label">Total Received</span>
                  <span class="kpi-val">₹{{ data360.feeSummary.totalPaid | number }}</span>
                  <span class="kpi-sub">Cleared Payments</span>
                </div>
                <div class="fee-kpi-card due" [class.has-due]="data360.feeSummary.totalPending > 0">
                  <span class="kpi-label">Pending Dues</span>
                  <span class="kpi-val">₹{{ data360.feeSummary.totalPending | number }}</span>
                  <span class="kpi-sub">{{ data360.feeSummary.unpaidInvoicesCount }} Unpaid / Partial</span>
                </div>
              </div>

              <div class="section-title-wrap">
                <h4>Fee Invoices &amp; Receipts History</h4>
              </div>

              <div class="table-scroll-wrap" *ngIf="data360.feeSummary.recentInvoices?.length">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Title / Particulars</th>
                      <th>Due Date</th>
                      <th class="text-right">Total</th>
                      <th class="text-right">Paid</th>
                      <th class="text-right">Balance</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let inv of data360.feeSummary.recentInvoices">
                      <td class="font-mono">{{ inv.invoiceNumber }}</td>
                      <td>{{ inv.title }}</td>
                      <td>{{ inv.dueDate | date:'dd MMM yyyy' }}</td>
                      <td class="text-right font-semibold">₹{{ inv.totalAmount | number }}</td>
                      <td class="text-right text-success">₹{{ inv.paidAmount | number }}</td>
                      <td class="text-right" [class.text-danger]="inv.balanceAmount > 0">₹{{ inv.balanceAmount | number }}</td>
                      <td>
                        <span class="status-badge" [ngClass]="inv.status.toLowerCase()">
                          {{ inv.status }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="empty-state-box" *ngIf="!data360.feeSummary.recentInvoices?.length">
                <mat-icon>receipt_long</mat-icon>
                <p>No fee invoices recorded for this student yet.</p>
              </div>
            </div>
          </mat-tab>

          <!-- TAB 3: ATTENDANCE RADAR -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">event_available</mat-icon> Attendance
            </ng-template>
            <div class="tab-content-wrap">
              <div class="att-kpi-row">
                <div class="att-box percentage">
                  <span class="att-num">{{ data360.attendanceSummary.attendancePercentage }}%</span>
                  <span class="att-label">Cumulative Attendance</span>
                </div>
                <div class="att-box present">
                  <span class="att-num">{{ data360.attendanceSummary.presentDays }}</span>
                  <span class="att-label">Present Days</span>
                </div>
                <div class="att-box absent">
                  <span class="att-num">{{ data360.attendanceSummary.absentDays }}</span>
                  <span class="att-label">Absent Days</span>
                </div>
                <div class="att-box late">
                  <span class="att-num">{{ data360.attendanceSummary.lateDays }}</span>
                  <span class="att-label">Late Marks</span>
                </div>
                <div class="att-box leave">
                  <span class="att-num">{{ data360.attendanceSummary.leaveDays }}</span>
                  <span class="att-label">Approved Leaves</span>
                </div>
              </div>

              <div class="section-title-wrap">
                <h4>Recent 15 Attendance Logs</h4>
              </div>

              <div class="att-timeline" *ngIf="data360.attendanceSummary.recentLogs?.length">
                <div class="att-log-item" *ngFor="let log of data360.attendanceSummary.recentLogs">
                  <div class="att-date-col">
                    <span class="att-day">{{ log.date | date:'dd' }}</span>
                    <span class="att-mon">{{ log.date | date:'MMM yyyy' }}</span>
                  </div>
                  <div class="att-status-col">
                    <span class="status-badge" [ngClass]="log.status.toLowerCase()">
                      {{ log.status }}
                    </span>
                    <span class="att-source" *ngIf="log.captureSource">
                      <mat-icon class="inline-icon">fingerprint</mat-icon> {{ log.captureSource }}
                    </span>
                  </div>
                  <div class="att-remarks-col">
                    {{ log.remarks || 'Standard classroom attendance' }}
                  </div>
                </div>
              </div>

              <div class="empty-state-box" *ngIf="!data360.attendanceSummary.recentLogs?.length">
                <mat-icon>calendar_today</mat-icon>
                <p>No attendance records found for this student.</p>
              </div>
            </div>
          </mat-tab>

          <!-- TAB 4: EXAMS & ACADEMIC PERFORMANCE -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">grade</mat-icon> Academic &amp; Exams
            </ng-template>
            <div class="tab-content-wrap">
              <div class="section-title-wrap">
                <h4>Recent Assessment &amp; Examination Results</h4>
              </div>

              <div class="table-scroll-wrap" *ngIf="data360.examMarks?.length">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Exam / Test Title</th>
                      <th>Subject</th>
                      <th>Date</th>
                      <th class="text-right">Marks Scored</th>
                      <th class="text-right">Max Marks</th>
                      <th class="text-right">Percentage</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let ex of data360.examMarks">
                      <td class="font-semibold">{{ ex.testName }}</td>
                      <td>{{ ex.subjectName }}</td>
                      <td>{{ ex.testDate | date:'dd MMM yyyy' }}</td>
                      <td class="text-right font-semibold">{{ ex.marksObtained }}</td>
                      <td class="text-right">{{ ex.maxMarks }}</td>
                      <td class="text-right font-bold" [class.text-success]="ex.percentage >= 60" [class.text-danger]="ex.percentage < 33">
                        {{ ex.percentage }}%
                      </td>
                      <td>
                        <span class="status-badge" [class.paid]="ex.status === 'Passed'" [class.due]="ex.status !== 'Passed'">
                          {{ ex.status }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="empty-state-box" *ngIf="!data360.examMarks?.length">
                <mat-icon>assignment_turned_in</mat-icon>
                <p>No examination or assessment marks logged for this student yet.</p>
              </div>
            </div>
          </mat-tab>

          <!-- TAB 5: LIBRARY, HOSTEL & TRANSPORT -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">room_preferences</mat-icon> Facilities
            </ng-template>
            <div class="tab-content-wrap">
              <div class="facilities-grid">
                
                <!-- Hostel Facility Card -->
                <div class="facility-card">
                  <div class="fac-header">
                    <mat-icon class="fac-icon hostel">hotel</mat-icon>
                    <div>
                      <h4>Hostel Residential Facility</h4>
                      <span class="fac-status" [class.active]="data360.facilities.hasHostel">
                        {{ data360.facilities.hasHostel ? 'Resident Enrolled' : 'Not Enrolled / Day Scholar' }}
                      </span>
                    </div>
                  </div>
                  <div class="fac-details" *ngIf="data360.facilities.hasHostel">
                    <div class="fac-row">
                      <span>Hostel Block:</span>
                      <strong>{{ data360.facilities.hostelName }}</strong>
                    </div>
                    <div class="fac-row">
                      <span>Room &amp; Bed:</span>
                      <strong>Room {{ data360.facilities.roomNumber }} &bull; Bed {{ data360.facilities.bedCode }}</strong>
                    </div>
                    <div class="fac-row">
                      <span>Monthly Rent:</span>
                      <strong>₹{{ data360.facilities.monthlyBedRent | number }}/mo</strong>
                    </div>
                  </div>
                </div>

                <!-- Transport Facility Card -->
                <div class="facility-card">
                  <div class="fac-header">
                    <mat-icon class="fac-icon transport">directions_bus</mat-icon>
                    <div>
                      <h4>Transport &amp; Bus Service</h4>
                      <span class="fac-status" [class.active]="data360.facilities.hasTransport">
                        {{ data360.facilities.hasTransport ? 'Bus Pass Active' : 'Self Commuter' }}
                      </span>
                    </div>
                  </div>
                  <div class="fac-details" *ngIf="data360.facilities.hasTransport">
                    <div class="fac-row">
                      <span>Route Name:</span>
                      <strong>{{ data360.facilities.routeName }}</strong>
                    </div>
                    <div class="fac-row">
                      <span>Pickup / Drop Stop:</span>
                      <strong>{{ data360.facilities.stopName }}</strong>
                    </div>
                    <div class="fac-row" *ngIf="data360.facilities.vehicleNumber">
                      <span>Bus Reg No:</span>
                      <strong>{{ data360.facilities.vehicleNumber }}</strong>
                    </div>
                  </div>
                </div>

                <!-- Library Facility Card -->
                <div class="facility-card col-span-2">
                  <div class="fac-header">
                    <mat-icon class="fac-icon library">local_library</mat-icon>
                    <div>
                      <h4>Library Membership &amp; Issued Books</h4>
                      <span class="fac-status" [class.active]="data360.library.isMember">
                        {{ data360.library.isMember ? (data360.library.membershipPlan || 'Active Member') : 'Not Enrolled' }}
                      </span>
                    </div>
                  </div>

                  <div *ngIf="data360.library.isMember" class="lib-books-box">
                    <div class="lib-meta-strip">
                      <span>Card No: <strong>{{ data360.library.libraryCardNumber || 'N/A' }}</strong></span>
                      <span>Max Books Allowed: <strong>{{ data360.library.maxBooksAllowed }}</strong></span>
                      <span>Currently Holding: <strong>{{ data360.library.currentlyIssuedCount }} Books</strong></span>
                    </div>

                    <div class="table-scroll-wrap" *ngIf="data360.library.issuedBooks?.length">
                      <table class="data-table">
                        <thead>
                          <tr>
                            <th>Book Title</th>
                            <th>Accession No</th>
                            <th>Issue Date</th>
                            <th>Due Date</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr *ngFor="let b of data360.library.issuedBooks">
                            <td class="font-semibold">{{ b.bookTitle }}</td>
                            <td class="font-mono">{{ b.accessionNumber || 'N/A' }}</td>
                            <td>{{ b.issueDate | date:'dd MMM yyyy' }}</td>
                            <td>{{ b.dueDate | date:'dd MMM yyyy' }}</td>
                            <td>
                              <span class="status-badge" [class.due]="b.isOverdue" [class.paid]="!b.isOverdue">
                                {{ b.isOverdue ? 'Overdue' : 'Active Holding' }}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <p *ngIf="!data360.library.issuedBooks?.length" class="no-books-msg">
                      No books currently issued to this student.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </mat-tab>

          <!-- TAB 6: LEAVES & GATE PASSES -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">time_to_leave</mat-icon> Leaves &amp; Passes
            </ng-template>
            <div class="tab-content-wrap">
              <div class="leaves-passes-grid">
                
                <!-- Leaves Card -->
                <div class="section-card">
                  <div class="card-header">
                    <mat-icon class="sect-icon">event_busy</mat-icon>
                    <h4>Student Leave Applications ({{ data360.leaves.length || 0 }})</h4>
                  </div>
                  <div class="mini-list" *ngIf="data360.leaves.length">
                    <div class="mini-item" *ngFor="let l of data360.leaves">
                      <div class="mini-left">
                        <span class="mini-title">{{ l.reason }}</span>
                        <span class="mini-meta">{{ l.fromDate | date:'dd MMM' }} - {{ l.toDate | date:'dd MMM yyyy' }} ({{ l.totalDays }} day{{ l.totalDays > 1 ? 's' : '' }})</span>
                      </div>
                      <span class="status-badge" [ngClass]="l.status.toLowerCase()">
                        {{ l.status }}
                      </span>
                    </div>
                  </div>
                  <div class="empty-state-box" *ngIf="!data360.leaves.length">
                    <p>No leave requests found.</p>
                  </div>
                </div>

                <!-- Gate Passes Card -->
                <div class="section-card">
                  <div class="card-header">
                    <mat-icon class="sect-icon">exit_to_app</mat-icon>
                    <h4>Campus Gate Passes ({{ data360.gatePasses.length || 0 }})</h4>
                  </div>
                  <div class="mini-list" *ngIf="data360.gatePasses.length">
                    <div class="mini-item" *ngFor="let gp of data360.gatePasses">
                      <div class="mini-left">
                        <span class="mini-title">{{ gp.passNumber }} - {{ gp.reason }}</span>
                        <span class="mini-meta">Out: {{ gp.outTime | date:'dd MMM, hh:mm a' }} &bull; By: {{ gp.guardianName || 'Guardian' }}</span>
                      </div>
                      <span class="status-badge" [ngClass]="gp.status.toLowerCase()">
                        {{ gp.status }}
                      </span>
                    </div>
                  </div>
                  <div class="empty-state-box" *ngIf="!data360.gatePasses.length">
                    <p>No campus gate passes issued.</p>
                  </div>
                </div>

              </div>
            </div>
          </mat-tab>

          <!-- TAB 7: DOCUMENTS & KYC VAULT -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">folder_shared</mat-icon> KYC Documents
            </ng-template>
            <div class="tab-content-wrap">
              <!-- Top Upload Action Row -->
              <div class="doc-actions-row">
                <div class="doc-count-badge">
                  <mat-icon>verified_user</mat-icon>
                  <span>{{ data360.documents.length || 0 }} Official KYC Documents Stored</span>
                </div>
                <button mat-raised-button color="primary" (click)="showUploadForm = !showUploadForm" class="upload-btn">
                  <mat-icon>{{ showUploadForm ? 'close' : 'cloud_upload' }}</mat-icon>
                  {{ showUploadForm ? 'Cancel Upload' : 'Upload New Document' }}
                </button>
              </div>

              <!-- Upload New Document Form -->
              <div class="upload-form-card" *ngIf="showUploadForm">
                <div class="card-header">
                  <mat-icon>upload_file</mat-icon>
                  <h4>Upload Student KYC / Academic Document</h4>
                </div>
                <div class="form-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Document Type *</mat-label>
                    <mat-select [(ngModel)]="newDoc.documentType">
                      <mat-option value="Aadhaar">Aadhaar Card (आधार कार्ड)</mat-option>
                      <mat-option value="BirthCertificate">Birth Certificate (जन्म प्रमाण पत्र)</mat-option>
                      <mat-option value="TransferCertificate">Previous School TC / SLC</mat-option>
                      <mat-option value="Marksheet">Previous Class Marksheet</mat-option>
                      <mat-option value="CasteCertificate">Caste / Category Certificate</mat-option>
                      <mat-option value="IncomeCertificate">Income Certificate (EWS/RTE)</mat-option>
                      <mat-option value="MedicalRecord">Medical / Vaccination Report</mat-option>
                      <mat-option value="Other">Other Document</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Document Title *</mat-label>
                    <input matInput [(ngModel)]="newDoc.title" placeholder="e.g. Class 9 Final Marksheet">
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Document Reg / ID Number</mat-label>
                    <input matInput [(ngModel)]="newDoc.documentNumber" placeholder="e.g. UIDAI-1234 or TC-982">
                  </mat-form-field>

                  <div class="file-picker-box">
                    <label class="file-picker-lbl">Select File (PDF, Image, Scan):</label>
                    <input type="file" (change)="onFileSelected($event)" accept=".pdf,image/*" class="file-input" />
                    <span *ngIf="selectedFileName" class="selected-filename">{{ selectedFileName }}</span>
                  </div>

                  <mat-form-field appearance="outline" class="col-span-2">
                    <mat-label>Remarks / Verification Notes</mat-label>
                    <input matInput [(ngModel)]="newDoc.remarks" placeholder="Verified from original by admission desk">
                  </mat-form-field>

                  <div class="form-actions-bar col-span-2">
                    <button mat-button (click)="showUploadForm = false">Cancel</button>
                    <button mat-raised-button color="primary" (click)="saveDocument()" [disabled]="uploading || !newDoc.documentType || !newDoc.title">
                      <mat-icon *ngIf="!uploading">check</mat-icon>
                      <span>{{ uploading ? 'Uploading Document...' : 'Save & Attach Document' }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Documents List Grid -->
              <div class="docs-grid" *ngIf="data360.documents?.length">
                <div class="doc-card" *ngFor="let doc of data360.documents">
                  <div class="doc-type-icon" [ngClass]="getDocIconClass(doc.documentType)">
                    <mat-icon>{{ getDocIcon(doc.documentType) }}</mat-icon>
                  </div>
                  <div class="doc-info">
                    <div class="doc-title-row">
                      <span class="doc-title">{{ doc.title }}</span>
                      <span class="doc-type-pill">{{ doc.documentType }}</span>
                    </div>
                    <div class="doc-meta" *ngIf="doc.documentNumber">
                      <span>ID/No: <strong>{{ doc.documentNumber }}</strong></span>
                    </div>
                    <div class="doc-meta">
                      <span>Uploaded: {{ doc.createdAt | date:'dd MMM yyyy' }}</span>
                      <span *ngIf="doc.verifiedBy"> &bull; Verified By: {{ doc.verifiedBy }}</span>
                    </div>
                    <p class="doc-remarks" *ngIf="doc.remarks">{{ doc.remarks }}</p>
                  </div>
                  <div class="doc-actions">
                    <a *ngIf="doc.fileUrl" [href]="getFullUrl(doc.fileUrl)" target="_blank" mat-icon-button class="view-btn" matTooltip="View / Download Document">
                      <mat-icon>visibility</mat-icon>
                    </a>
                    <button mat-icon-button color="warn" (click)="deleteDocument(doc)" matTooltip="Delete Document">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>
              </div>

              <div class="empty-state-box" *ngIf="!data360.documents?.length && !showUploadForm">
                <mat-icon>folder_open</mat-icon>
                <p>No KYC documents uploaded for this student yet.</p>
                <button mat-stroked-button color="primary" (click)="showUploadForm = true">
                  <mat-icon>upload</mat-icon> Upload First Document
                </button>
              </div>

            </div>
          </mat-tab>

          <!-- TAB 8: ACHIEVEMENTS & WALL OF FAME (Feature 1) -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">emoji_events</mat-icon> Wall of Fame ({{ data360.achievements?.length || 0 }})
            </ng-template>
            <div class="tab-content-wrap">
              <div class="tab-action-header">
                <div>
                  <h4 class="tab-action-title">Honors, Awards &amp; Merit Accolades</h4>
                  <p class="tab-action-sub">Recognitions, badges, Olympiads, sports &amp; co-curricular achievements</p>
                </div>
                <button mat-raised-button color="primary" class="primary-gradient-btn" *ngIf="!isReadOnly" (click)="showAddAchievementForm = !showAddAchievementForm">
                  <mat-icon>{{ showAddAchievementForm ? 'close' : 'add_task' }}</mat-icon>
                  {{ showAddAchievementForm ? 'Cancel' : 'Record Achievement' }}
                </button>
              </div>

              <!-- Add Achievement Form Drawer -->
              <div class="inline-form-card" *ngIf="showAddAchievementForm">
                <div class="form-header">
                  <mat-icon>military_tech</mat-icon>
                  <h5>Record New Student Honor / Achievement</h5>
                </div>
                <div class="form-grid">
                  <div class="form-field-wrap">
                    <label>Achievement / Award Title *</label>
                    <input type="text" class="custom-input" [(ngModel)]="newAchievement.title" placeholder="e.g. 1st Prize in State Science Exhibition" />
                  </div>
                  <div class="form-field-wrap">
                    <label>Category *</label>
                    <select class="custom-input" [(ngModel)]="newAchievement.category">
                      <option value="Academic">Academic Excellence</option>
                      <option value="Sports">Sports &amp; Athletics</option>
                      <option value="Cultural">Art &amp; Cultural</option>
                      <option value="Olympiad">Olympiad / Competition</option>
                      <option value="Leadership">Leadership &amp; Service</option>
                      <option value="Other">Special Honor / Other</option>
                    </select>
                  </div>
                  <div class="form-field-wrap">
                    <label>Competition Level</label>
                    <select class="custom-input" [(ngModel)]="newAchievement.level">
                      <option value="School">School Level</option>
                      <option value="Inter-School">Inter-School</option>
                      <option value="District">District Level</option>
                      <option value="State">State Level</option>
                      <option value="National">National Level</option>
                      <option value="International">International Level</option>
                    </select>
                  </div>
                  <div class="form-field-wrap">
                    <label>Position / Standing</label>
                    <input type="text" class="custom-input" [(ngModel)]="newAchievement.position" placeholder="e.g. 1st Place, Gold Medal, Winner" />
                  </div>
                  <div class="form-field-wrap">
                    <label>Awarded Date *</label>
                    <input type="date" class="custom-input" [(ngModel)]="newAchievement.awardedDate" />
                  </div>
                  <div class="form-field-wrap">
                    <label>Awarding Body / Issued By</label>
                    <input type="text" class="custom-input" [(ngModel)]="newAchievement.issuedBy" placeholder="e.g. CBSE / State Sports Authority" />
                  </div>
                  <div class="form-field-wrap">
                    <label>Certificate / Serial No.</label>
                    <input type="text" class="custom-input" [(ngModel)]="newAchievement.certificateNumber" placeholder="e.g. CERT-2026-904" />
                  </div>
                  <div class="form-field-wrap full-col">
                    <label>Remarks / Citation</label>
                    <input type="text" class="custom-input" [(ngModel)]="newAchievement.remarks" placeholder="Key highlights or citation summary..." />
                  </div>
                </div>
                <div class="form-actions">
                  <button mat-button (click)="showAddAchievementForm = false">Cancel</button>
                  <button mat-raised-button color="primary" [disabled]="savingAchievement" (click)="saveAchievement()">
                    <mat-icon>check_circle</mat-icon> {{ savingAchievement ? 'Saving...' : 'Save Achievement' }}
                  </button>
                </div>
              </div>

              <!-- Achievements Grid -->
              <div class="achievement-grid" *ngIf="data360.achievements?.length">
                <div class="honor-card" *ngFor="let ach of data360.achievements" [ngClass]="(ach.category || 'other').toLowerCase()">
                  <div class="honor-top">
                    <div class="honor-badge-icon" [ngClass]="(ach.category || 'other').toLowerCase()">
                      <mat-icon>{{ getAchievementIcon(ach.category) }}</mat-icon>
                    </div>
                    <div class="honor-titles">
                      <div class="honor-title">{{ ach.title }}</div>
                      <div class="honor-meta">
                        <span class="honor-category-tag" [ngClass]="(ach.category || 'other').toLowerCase()">{{ ach.category }}</span>
                        <span class="level-tag" *ngIf="ach.level || ach.awardLevel">{{ ach.level || ach.awardLevel }}</span>
                        <span class="pos-tag" *ngIf="ach.position">🏆 {{ ach.position }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="honor-body">
                    <div class="honor-info-line" *ngIf="ach.issuedBy || ach.awardedBy">
                      <span class="meta-label">Organized By:</span>
                      <span class="meta-text">{{ ach.issuedBy || ach.awardedBy }}</span>
                    </div>
                    <div class="honor-info-line">
                      <span class="meta-label">Award Date:</span>
                      <span class="meta-text">{{ (ach.awardedDate || ach.awardDate) | date:'dd MMM yyyy' }}</span>
                    </div>
                    <div class="honor-info-line" *ngIf="ach.certificateNumber">
                      <span class="meta-label">Cert No:</span>
                      <span class="meta-text font-mono">{{ ach.certificateNumber }}</span>
                    </div>
                    <p class="honor-remarks" *ngIf="ach.remarks || ach.description">{{ ach.remarks || ach.description }}</p>
                  </div>
                  <div class="honor-footer">
                    <button mat-stroked-button class="print-cert-btn" (click)="printCertificate(ach)" matTooltip="Generate &amp; Print Official Certificate of Merit">
                      <mat-icon>print</mat-icon> Print Certificate
                    </button>
                    <button mat-icon-button color="warn" *ngIf="!isReadOnly" (click)="deleteAchievement(ach)" matTooltip="Delete record">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>
              </div>

              <div class="empty-state-box" *ngIf="!data360.achievements?.length && !showAddAchievementForm">
                <mat-icon>workspace_premium</mat-icon>
                <p>No honors or awards recorded yet. Click above to celebrate this student's milestone!</p>
                <button mat-stroked-button color="primary" (click)="showAddAchievementForm = true">
                  <mat-icon>add</mat-icon> Add First Achievement
                </button>
              </div>
            </div>
          </mat-tab>

          <!-- TAB 9: DISCIPLINE & CONDUCT REGISTER (Feature 2) -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">gavel</mat-icon> Discipline &amp; Conduct ({{ data360.disciplinaryRecords?.length || 0 }})
            </ng-template>
            <div class="tab-content-wrap">
              <div class="tab-action-header">
                <div>
                  <h4 class="tab-action-title">Student Behavior &amp; Conduct Diary</h4>
                  <p class="tab-action-sub">Institutional incident tracking, positive commendations, and corrective actions</p>
                </div>
                <button mat-raised-button color="primary" class="primary-gradient-btn" *ngIf="!isReadOnly" (click)="showAddDisciplineForm = !showAddDisciplineForm">
                  <mat-icon>{{ showAddDisciplineForm ? 'close' : 'add_moderator' }}</mat-icon>
                  {{ showAddDisciplineForm ? 'Cancel' : 'Log Incident / Commendation' }}
                </button>
              </div>

              <!-- Add Disciplinary Form Drawer -->
              <div class="inline-form-card" *ngIf="showAddDisciplineForm">
                <div class="form-header">
                  <mat-icon>fact_check</mat-icon>
                  <h5>Record Conduct Entry / Commendation</h5>
                </div>
                <div class="form-grid">
                  <div class="form-field-wrap">
                    <label>Incident / Record Title *</label>
                    <input type="text" class="custom-input" [(ngModel)]="newDiscipline.title" placeholder="e.g. Exemplary Honesty / Uniform Violation" />
                  </div>
                  <div class="form-field-wrap">
                    <label>Entry Type *</label>
                    <select class="custom-input" [(ngModel)]="newDiscipline.incidentType">
                      <option value="PositiveCommendation">🌟 Positive Commendation (Honor)</option>
                      <option value="MinorInfraction">⚠️ Minor Infraction (Warning)</option>
                      <option value="ModerateMisconduct">🔶 Moderate Misconduct</option>
                      <option value="SevereViolation">🚨 Severe Violation</option>
                    </select>
                  </div>
                  <div class="form-field-wrap">
                    <label>Severity Level *</label>
                    <select class="custom-input" [(ngModel)]="newDiscipline.severity">
                      <option value="Commendation">Commendation / Praise</option>
                      <option value="Low">Low Severity</option>
                      <option value="Medium">Medium Severity</option>
                      <option value="High">High Severity</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                  <div class="form-field-wrap">
                    <label>Incident Date *</label>
                    <input type="date" class="custom-input" [(ngModel)]="newDiscipline.incidentDate" />
                  </div>
                  <div class="form-field-wrap faculty-field-wrap">
                    <label>Reported By / Faculty Name</label>
                    <div class="faculty-combobox-wrap">
                      <input
                        type="text"
                        class="custom-input"
                        [(ngModel)]="newDiscipline.reportedByName"
                        (focus)="showDisciplineFacultyDropdown = true"
                        placeholder="Select faculty or type name..."
                        autocomplete="off"
                      />
                      <button type="button" class="combobox-toggle-btn" (click)="showDisciplineFacultyDropdown = !showDisciplineFacultyDropdown" tabindex="-1">
                        <mat-icon>{{ showDisciplineFacultyDropdown ? 'arrow_drop_up' : 'arrow_drop_down' }}</mat-icon>
                      </button>

                      <!-- Custom Positioned Floating Dropdown Panel Directly Below Input -->
                      <div class="faculty-dropdown-menu" *ngIf="showDisciplineFacultyDropdown">
                        <!-- 1. Assigned Class Teacher -->
                        <div class="dropdown-group-header" *ngIf="data360?.student?.classTeacherName">Assigned Class Teacher</div>
                        <div
                          class="dropdown-option-item highlight"
                          *ngIf="data360?.student?.classTeacherName"
                          (click)="selectDisciplineFaculty(data360!.student.classTeacherName + ' (Class Teacher)')"
                        >
                          <mat-icon class="item-icon star">stars</mat-icon>
                          <div class="item-text">
                            <div class="item-name">{{ data360!.student.classTeacherName }}</div>
                            <div class="item-sub">Class Teacher &bull; Sec {{ data360!.student.sectionName || 'A' }}</div>
                          </div>
                        </div>

                        <!-- 2. School Teachers -->
                        <div class="dropdown-group-header" *ngIf="schoolTeachers.length > 0">Faculty &amp; Subject Teachers</div>
                        <div
                          class="dropdown-option-item"
                          *ngFor="let t of getFilteredTeachers(newDiscipline.reportedByName)"
                          (click)="selectDisciplineFaculty(t.fullName + (t.specialization ? ' (' + t.specialization + ')' : (t.designation ? ' (' + t.designation + ')' : '')))"
                        >
                          <mat-icon class="item-icon teacher">school</mat-icon>
                          <div class="item-text">
                            <div class="item-name">{{ t.fullName }}</div>
                            <div class="item-sub">{{ t.specialization || t.designation || t.department || 'Faculty' }}</div>
                          </div>
                        </div>

                        <!-- 3. Key Authorities -->
                        <div class="dropdown-group-header">Institutional Incharges &amp; Staff</div>
                        <div
                          class="dropdown-option-item"
                          *ngFor="let auth of institutionalAuthorities"
                          (click)="selectDisciplineFaculty(auth.title)"
                        >
                          <mat-icon class="item-icon auth">{{ auth.icon }}</mat-icon>
                          <div class="item-text">
                            <div class="item-name">{{ auth.title }}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="form-field-wrap">
                    <label>Status</label>
                    <select class="custom-input" [(ngModel)]="newDiscipline.status">
                      <option value="Resolved">Resolved</option>
                      <option value="Open">Open</option>
                      <option value="UnderReview">Under Review</option>
                    </select>
                  </div>
                  <div class="form-field-wrap full-col">
                    <label>Description of Event *</label>
                    <textarea class="custom-textarea" rows="2" [(ngModel)]="newDiscipline.description" placeholder="Provide factual details of the incident or deed..."></textarea>
                  </div>
                  <div class="form-field-wrap full-col">
                    <label>Corrective Action / Recognition Awarded</label>
                    <input type="text" class="custom-input" [(ngModel)]="newDiscipline.actionTaken" placeholder="e.g. Certificate issued, Parent counseling session held, Verbal warning" />
                  </div>
                  <div class="form-field-wrap full-col checkbox-wrap">
                    <label class="checkbox-label">
                      <input type="checkbox" [(ngModel)]="newDiscipline.parentNotified" />
                      <span>Parents have been formally notified regarding this matter</span>
                    </label>
                  </div>
                </div>
                <div class="form-actions">
                  <button mat-button (click)="showAddDisciplineForm = false">Cancel</button>
                  <button mat-raised-button color="primary" [disabled]="savingDiscipline" (click)="saveDiscipline()">
                    <mat-icon>check_circle</mat-icon> {{ savingDiscipline ? 'Saving...' : 'Save Entry' }}
                  </button>
                </div>
              </div>

              <!-- Conduct List -->
              <div class="conduct-list" *ngIf="data360.disciplinaryRecords?.length">
                <div class="conduct-item" *ngFor="let rec of data360.disciplinaryRecords" [ngClass]="(rec.incidentType || 'minor').toLowerCase()">
                  <div class="conduct-icon-col">
                    <div class="type-pill-icon" [ngClass]="(rec.incidentType || 'minor').toLowerCase()">
                      <mat-icon *ngIf="rec.incidentType === 'PositiveCommendation'">thumb_up</mat-icon>
                      <mat-icon *ngIf="rec.incidentType !== 'PositiveCommendation'">report_problem</mat-icon>
                    </div>
                  </div>
                  <div class="conduct-content-col">
                    <div class="conduct-header-row">
                      <div class="conduct-title">{{ rec.title }}</div>
                      <div class="conduct-tags">
                        <span class="severity-pill" [ngClass]="(rec.severity || 'low').toLowerCase()">{{ rec.severity }}</span>
                        <span class="status-badge" [ngClass]="(rec.status || (rec.isResolved ? 'resolved' : 'open')).toLowerCase()">{{ rec.status || (rec.isResolved ? 'Resolved' : 'Open') }}</span>
                      </div>
                    </div>
                    <p class="conduct-desc">{{ rec.description }}</p>
                    <div class="conduct-meta-row">
                      <span class="meta-item"><mat-icon>calendar_today</mat-icon> {{ rec.incidentDate | date:'dd MMM yyyy' }}</span>
                      <span class="meta-item" *ngIf="rec.reportedByName || rec.reportedBy"><mat-icon>person</mat-icon> By: {{ rec.reportedByName || rec.reportedBy }}</span>
                      <span class="meta-item parent-flag" [class.notified]="rec.parentNotified">
                        <mat-icon>{{ rec.parentNotified ? 'notifications_active' : 'notifications_off' }}</mat-icon>
                        {{ rec.parentNotified ? 'Parent Notified' : 'Parent Not Notified' }}
                      </span>
                    </div>
                    <div class="conduct-action-box" *ngIf="rec.actionTaken">
                      <strong>Action / Outcome:</strong> {{ rec.actionTaken }}
                    </div>
                  </div>
                  <div class="conduct-actions-col" *ngIf="!isReadOnly">
                    <button mat-icon-button color="warn" (click)="deleteDiscipline(rec)" matTooltip="Delete entry">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>
              </div>

              <div class="empty-state-box" *ngIf="!data360.disciplinaryRecords?.length && !showAddDisciplineForm">
                <mat-icon>verified</mat-icon>
                <p>Clean conduct sheet! No disciplinary incidents or infractions logged.</p>
                <button mat-stroked-button color="primary" (click)="showAddDisciplineForm = true">
                  <mat-icon>add</mat-icon> Log New Record
                </button>
              </div>
            </div>
          </mat-tab>

          <!-- TAB 10: PTM & PARENT FEEDBACK DESK (Feature 3) -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">record_voice_over</mat-icon> PTM Desk ({{ data360.ptmRecords?.length || 0 }})
            </ng-template>
            <div class="tab-content-wrap">
              <div class="tab-action-header">
                <div>
                  <h4 class="tab-action-title">Parent-Teacher Meeting &amp; Feedback Journal</h4>
                  <p class="tab-action-sub">Record discussions, guardian feedback, pedagogical counsel, and agreed action plans</p>
                </div>
                <button mat-raised-button color="primary" class="primary-gradient-btn" *ngIf="!isReadOnly" (click)="showAddPtmForm = !showAddPtmForm">
                  <mat-icon>{{ showAddPtmForm ? 'close' : 'contact_phone' }}</mat-icon>
                  {{ showAddPtmForm ? 'Cancel' : 'Record PTM Interaction' }}
                </button>
              </div>

              <!-- Add PTM Form Drawer -->
              <div class="inline-form-card" *ngIf="showAddPtmForm">
                <div class="form-header">
                  <mat-icon>question_answer</mat-icon>
                  <h5>Log Parent-Teacher Conference</h5>
                </div>
                <div class="form-grid">
                  <div class="form-field-wrap">
                    <label>Meeting Date *</label>
                    <input type="date" class="custom-input" [(ngModel)]="newPtm.meetingDate" />
                  </div>
                  <div class="form-field-wrap">
                    <label>Attended By (Parent / Guardian) *</label>
                    <input type="text" class="custom-input" [(ngModel)]="newPtm.attendedByParentName" placeholder="e.g. Mr. Rajesh Kumar (Father)" />
                  </div>
                  <div class="form-field-wrap faculty-field-wrap">
                    <label>Teacher / Counselor Conducting PTM</label>
                    <div class="faculty-combobox-wrap">
                      <input
                        type="text"
                        class="custom-input"
                        [(ngModel)]="newPtm.teacherName"
                        (focus)="showPtmFacultyDropdown = true"
                        placeholder="Select faculty or type name..."
                        autocomplete="off"
                      />
                      <button type="button" class="combobox-toggle-btn" (click)="showPtmFacultyDropdown = !showPtmFacultyDropdown" tabindex="-1">
                        <mat-icon>{{ showPtmFacultyDropdown ? 'arrow_drop_up' : 'arrow_drop_down' }}</mat-icon>
                      </button>

                      <!-- Custom Positioned Floating Dropdown Panel Directly Below Input -->
                      <div class="faculty-dropdown-menu" *ngIf="showPtmFacultyDropdown">
                        <!-- 1. Assigned Class Teacher -->
                        <div class="dropdown-group-header" *ngIf="data360?.student?.classTeacherName">Assigned Class Teacher</div>
                        <div
                          class="dropdown-option-item highlight"
                          *ngIf="data360?.student?.classTeacherName"
                          (click)="selectPtmFaculty(data360!.student.classTeacherName + ' (Class Teacher)')"
                        >
                          <mat-icon class="item-icon star">stars</mat-icon>
                          <div class="item-text">
                            <div class="item-name">{{ data360!.student.classTeacherName }}</div>
                            <div class="item-sub">Class Teacher &bull; Sec {{ data360!.student.sectionName || 'A' }}</div>
                          </div>
                        </div>

                        <!-- 2. School Teachers -->
                        <div class="dropdown-group-header" *ngIf="schoolTeachers.length > 0">Faculty &amp; Subject Teachers</div>
                        <div
                          class="dropdown-option-item"
                          *ngFor="let t of getFilteredTeachers(newPtm.teacherName)"
                          (click)="selectPtmFaculty(t.fullName + (t.specialization ? ' (' + t.specialization + ')' : (t.designation ? ' (' + t.designation + ')' : '')))"
                        >
                          <mat-icon class="item-icon teacher">school</mat-icon>
                          <div class="item-text">
                            <div class="item-name">{{ t.fullName }}</div>
                            <div class="item-sub">{{ t.specialization || t.designation || t.department || 'Faculty' }}</div>
                          </div>
                        </div>

                        <!-- 3. Key Authorities -->
                        <div class="dropdown-group-header">Institutional Incharges &amp; Counselors</div>
                        <div
                          class="dropdown-option-item"
                          *ngFor="let auth of institutionalAuthorities"
                          (click)="selectPtmFaculty(auth.title)"
                        >
                          <mat-icon class="item-icon auth">{{ auth.icon }}</mat-icon>
                          <div class="item-text">
                            <div class="item-name">{{ auth.title }}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="form-field-wrap">
                    <label>Parent Satisfaction Level</label>
                    <select class="custom-input" [(ngModel)]="newPtm.satisfactionRating">
                      <option value="HighlySatisfied">🟢 Highly Satisfied</option>
                      <option value="Satisfied">🔵 Satisfied</option>
                      <option value="NeedsImprovement">🟠 Needs Improvement</option>
                      <option value="Dissatisfied">🔴 Dissatisfied / Escalated</option>
                    </select>
                  </div>
                  <div class="form-field-wrap full-col">
                    <label>Discussion Summary *</label>
                    <textarea class="custom-textarea" rows="2" [(ngModel)]="newPtm.discussionSummary" placeholder="Summary of agenda discussed regarding student progress, behavior, or attendance..."></textarea>
                  </div>
                  <div class="form-field-wrap full-col">
                    <label>Teacher's Remarks &amp; Suggestions</label>
                    <textarea class="custom-textarea" rows="2" [(ngModel)]="newPtm.teacherRemarks" placeholder="Teacher's guidance, areas of improvement, or appreciation..."></textarea>
                  </div>
                  <div class="form-field-wrap full-col">
                    <label>Parent Feedback / Concerns</label>
                    <textarea class="custom-textarea" rows="2" [(ngModel)]="newPtm.parentFeedback" placeholder="What the parents expressed, queries about syllabus, transport, etc..."></textarea>
                  </div>
                  <div class="form-field-wrap full-col">
                    <label>Agreed Action Points / Commitments</label>
                    <input type="text" class="custom-input" [(ngModel)]="newPtm.actionPoints" placeholder="e.g. Daily 1 hr math practice at home; Monthly progress review" />
                  </div>
                </div>
                <div class="form-actions">
                  <button mat-button (click)="showAddPtmForm = false">Cancel</button>
                  <button mat-raised-button color="primary" [disabled]="savingPtm" (click)="savePtm()">
                    <mat-icon>check_circle</mat-icon> {{ savingPtm ? 'Saving...' : 'Save PTM Record' }}
                  </button>
                </div>
              </div>

              <!-- PTM Timeline -->
              <div class="ptm-timeline" *ngIf="data360.ptmRecords?.length">
                <div class="ptm-card" *ngFor="let ptm of data360.ptmRecords">
                  <div class="ptm-card-header">
                    <div class="ptm-header-left">
                      <div class="ptm-date-badge">
                        <span class="ptm-day">{{ (ptm.meetingDate || ptm.ptmDate) | date:'dd' }}</span>
                        <span class="ptm-mon">{{ (ptm.meetingDate || ptm.ptmDate) | date:'MMM yyyy' }}</span>
                      </div>
                      <div class="ptm-meta-block">
                        <div class="ptm-attendee">Met with: <strong>{{ ptm.attendedByParentName || ptm.parentAttended }}</strong></div>
                        <div class="ptm-teacher" *ngIf="ptm.teacherName">Conducted by: <strong>{{ ptm.teacherName }}</strong></div>
                      </div>
                    </div>
                    <div class="ptm-header-right">
                      <span class="satisfaction-badge" [ngClass]="(ptm.satisfactionRating || 'satisfied').toLowerCase()">
                        {{ formatRating(ptm.satisfactionRating) }}
                      </span>
                      <button mat-icon-button color="warn" *ngIf="!isReadOnly" (click)="deletePtm(ptm)" matTooltip="Delete PTM record">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </div>
                  </div>
                  <div class="ptm-card-body">
                    <div class="ptm-section" *ngIf="ptm.discussionSummary || ptm.childStrengths">
                      <div class="ptm-sec-title"><mat-icon>forum</mat-icon> Discussion Summary &amp; Strengths</div>
                      <p class="ptm-sec-text">{{ ptm.discussionSummary || ptm.childStrengths }}</p>
                    </div>
                    <div class="ptm-dual-row">
                      <div class="ptm-box teacher-box" *ngIf="ptm.teacherRemarks">
                        <div class="box-title"><mat-icon>school</mat-icon> Teacher's Feedback</div>
                        <p>{{ ptm.teacherRemarks }}</p>
                      </div>
                      <div class="ptm-box parent-box" *ngIf="ptm.parentFeedback">
                        <div class="box-title"><mat-icon>family_restroom</mat-icon> Parent's Feedback</div>
                        <p>{{ ptm.parentFeedback }}</p>
                      </div>
                    </div>
                    <div class="ptm-action-points" *ngIf="ptm.actionPoints || ptm.areasOfImprovement">
                      <mat-icon>checklist</mat-icon>
                      <div><strong>Action Commitments:</strong> {{ ptm.actionPoints || ptm.areasOfImprovement }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="empty-state-box" *ngIf="!data360.ptmRecords?.length && !showAddPtmForm">
                <mat-icon>groups</mat-icon>
                <p>No PTM interactions recorded for this student yet.</p>
                <button mat-stroked-button color="primary" (click)="showAddPtmForm = true">
                  <mat-icon>add</mat-icon> Log First PTM Interaction
                </button>
              </div>
            </div>
          </mat-tab>

          <!-- TAB 11: COMPREHENSIVE HEALTH & MEDICAL PROFILE (Feature 4) -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">medical_services</mat-icon> Health &amp; Medical Profile
            </ng-template>
            <div class="tab-content-wrap">
              <div class="tab-action-header">
                <div>
                  <h4 class="tab-action-title">Student Health &amp; Emergency Medical Profile</h4>
                  <p class="tab-action-sub">Growth metrics, BMI tracker, allergies, emergency contacts &amp; pediatric history</p>
                </div>
                <div class="header-action-group">
                  <button mat-stroked-button class="print-medical-btn" (click)="showPrintMedicalCard = true">
                    <mat-icon>badge</mat-icon> Print Pocket Medical Card
                  </button>
                  <button mat-raised-button color="primary" class="primary-gradient-btn" *ngIf="!isReadOnly" (click)="toggleEditHealth()">
                    <mat-icon>{{ showEditHealthForm ? 'close' : 'edit' }}</mat-icon>
                    {{ showEditHealthForm ? 'Cancel Edit' : 'Update Health Record' }}
                  </button>
                </div>
              </div>

              <!-- Edit Health Form Drawer -->
              <div class="inline-form-card" *ngIf="showEditHealthForm">
                <div class="form-header">
                  <mat-icon>favorite</mat-icon>
                  <h5>Update Student Vitals &amp; Medical Record</h5>
                </div>
                <div class="form-grid">
                  <div class="form-field-wrap">
                    <label>Height (in cm)</label>
                    <input type="number" class="custom-input" [(ngModel)]="healthForm.heightCm" placeholder="e.g. 152" />
                  </div>
                  <div class="form-field-wrap">
                    <label>Weight (in kg)</label>
                    <input type="number" class="custom-input" [(ngModel)]="healthForm.weightKg" placeholder="e.g. 45.5" />
                  </div>
                  <div class="form-field-wrap">
                    <label>Blood Group</label>
                    <select class="custom-input" [(ngModel)]="healthForm.bloodGroup">
                      <option value="">Select Blood Group</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>
                  <div class="form-field-wrap">
                    <label>Vision - Left Eye</label>
                    <input type="text" class="custom-input" [(ngModel)]="healthForm.visionLeft" placeholder="e.g. 6/6 or -1.5D" />
                  </div>
                  <div class="form-field-wrap">
                    <label>Vision - Right Eye</label>
                    <input type="text" class="custom-input" [(ngModel)]="healthForm.visionRight" placeholder="e.g. 6/6 or -1.25D" />
                  </div>
                  <div class="form-field-wrap">
                    <label>Last Medical Checkup Date</label>
                    <input type="date" class="custom-input" [(ngModel)]="healthForm.lastCheckupDate" />
                  </div>
                  <div class="form-field-wrap full-col">
                    <label>Known Allergies (Food / Medicines / Environmental)</label>
                    <input type="text" class="custom-input" [(ngModel)]="healthForm.knownAllergies" placeholder="e.g. Peanuts, Penicillin, Dust, Pollen (or 'None')" />
                  </div>
                  <div class="form-field-wrap full-col">
                    <label>Chronic Medical Conditions (if any)</label>
                    <input type="text" class="custom-input" [(ngModel)]="healthForm.chronicConditions" placeholder="e.g. Childhood Asthma, Juvenile Diabetes, Epilepsy (or 'None')" />
                  </div>
                  <div class="form-field-wrap full-col">
                    <label>Regular Medications / Inhalers</label>
                    <input type="text" class="custom-input" [(ngModel)]="healthForm.regularMedications" placeholder="e.g. Asthalin Inhaler as needed; Vitamin D syrup" />
                  </div>
                  <div class="form-field-wrap">
                    <label>Emergency Doctor / Pediatrician Name</label>
                    <input type="text" class="custom-input" [(ngModel)]="healthForm.emergencyDoctorName" placeholder="Dr. S. Mehta" />
                  </div>
                  <div class="form-field-wrap">
                    <label>Doctor Emergency Contact Phone</label>
                    <input type="text" class="custom-input" [(ngModel)]="healthForm.emergencyDoctorPhone" placeholder="+91 98765 43210" />
                  </div>
                  <div class="form-field-wrap full-col">
                    <label>Doctor's Special Notes / Recommendations</label>
                    <textarea class="custom-textarea" rows="2" [(ngModel)]="healthForm.doctorNotes" placeholder="Any physical education restrictions, dietary precautions, etc..."></textarea>
                  </div>
                </div>
                <div class="form-actions">
                  <button mat-button (click)="showEditHealthForm = false">Cancel</button>
                  <button mat-raised-button color="primary" [disabled]="savingHealth" (click)="saveHealth()">
                    <mat-icon>check_circle</mat-icon> {{ savingHealth ? 'Saving...' : 'Save Health Vitals' }}
                  </button>
                </div>
              </div>

              <!-- Health Dashboard & Vitals Display -->
              <div class="health-dashboard-grid">
                
                <!-- BMI & Growth Metric Card -->
                <div class="health-card bmi-card">
                  <div class="health-card-header">
                    <mat-icon class="health-icon">accessibility_new</mat-icon>
                    <h5>Physical Growth &amp; BMI Tracker</h5>
                  </div>
                  <div class="vitals-row">
                    <div class="vital-box">
                      <span class="vital-label">Height</span>
                      <span class="vital-val">{{ data360.healthRecord?.heightCm ? (data360.healthRecord!.heightCm + ' cm') : 'Not Recorded' }}</span>
                    </div>
                    <div class="vital-box">
                      <span class="vital-label">Weight</span>
                      <span class="vital-val">{{ data360.healthRecord?.weightKg ? (data360.healthRecord!.weightKg + ' kg') : 'Not Recorded' }}</span>
                    </div>
                    <div class="vital-box bmi-highlight">
                      <span class="vital-label">BMI Score</span>
                      <span class="vital-val">{{ data360.healthRecord?.bmi ? (data360.healthRecord!.bmi | number:'1.1-1') : 'N/A' }}</span>
                    </div>
                  </div>

                  <!-- BMI Category Meter -->
                  <div class="bmi-category-meter" *ngIf="data360.healthRecord?.bmiCategory">
                    <div class="meter-bar">
                      <div class="meter-segment under" [class.current]="data360.healthRecord?.bmiCategory === 'Underweight'">Underweight (&lt;18.5)</div>
                      <div class="meter-segment normal" [class.current]="data360.healthRecord?.bmiCategory === 'Normal'">Healthy (18.5 - 24.9)</div>
                      <div class="meter-segment over" [class.current]="data360.healthRecord?.bmiCategory === 'Overweight'">Overweight (25 - 29.9)</div>
                      <div class="meter-segment obese" [class.current]="data360.healthRecord?.bmiCategory === 'Obese'">Obese (&ge;30)</div>
                    </div>
                    <div class="bmi-status-text">
                      Growth Evaluation: <strong [ngClass]="data360.healthRecord!.bmiCategory!.toLowerCase()">{{ data360.healthRecord!.bmiCategory }}</strong>
                    </div>
                  </div>
                </div>

                <!-- Emergency Medical Alert Card -->
                <div class="health-card alert-card">
                  <div class="health-card-header">
                    <mat-icon class="health-icon danger">warning</mat-icon>
                    <h5>Critical Medical Alerts &amp; Allergies</h5>
                  </div>
                  <div class="medical-alert-content">
                    <div class="alert-box" [class.has-allergy]="data360.healthRecord?.knownAllergies">
                      <div class="alert-title"><mat-icon>coronavirus</mat-icon> Known Allergies</div>
                      <p class="alert-desc">{{ data360.healthRecord?.knownAllergies || 'No known allergies reported.' }}</p>
                    </div>
                    <div class="alert-box" [class.has-condition]="data360.healthRecord?.chronicConditions">
                      <div class="alert-title"><mat-icon>healing</mat-icon> Chronic Medical Conditions</div>
                      <p class="alert-desc">{{ data360.healthRecord?.chronicConditions || 'None reported.' }}</p>
                    </div>
                    <div class="alert-box" *ngIf="data360.healthRecord?.regularMedications">
                      <div class="alert-title"><mat-icon>medication</mat-icon> Regular Medications / Inhalers</div>
                      <p class="alert-desc">{{ data360.healthRecord?.regularMedications }}</p>
                    </div>
                  </div>
                </div>

                <!-- Clinical Details & Doctor Card -->
                <div class="health-card clinical-card">
                  <div class="health-card-header">
                    <mat-icon class="health-icon">local_hospital</mat-icon>
                    <h5>Clinical Details &amp; Doctor Contacts</h5>
                  </div>
                  <div class="clinical-rows">
                    <div class="clinical-row">
                      <span class="lbl">Blood Group:</span>
                      <strong class="val blood-val">{{ data360.healthRecord?.bloodGroup || data360.student.bloodGroup || 'Not Tested' }}</strong>
                    </div>
                    <div class="clinical-row">
                      <span class="lbl">Vision Assessment:</span>
                      <span class="val">L: {{ data360.healthRecord?.visionLeft || '6/6' }} &bull; R: {{ data360.healthRecord?.visionRight || '6/6' }}</span>
                    </div>
                    <div class="clinical-row">
                      <span class="lbl">Last Campus Checkup:</span>
                      <span class="val">{{ data360.healthRecord?.lastCheckupDate ? (data360.healthRecord!.lastCheckupDate | date:'dd MMM yyyy') : 'No checkup recorded' }}</span>
                    </div>
                    <div class="clinical-row" *ngIf="data360.healthRecord?.emergencyDoctorName">
                      <span class="lbl">Pediatrician / Doctor:</span>
                      <span class="val">{{ data360.healthRecord!.emergencyDoctorName }}</span>
                    </div>
                    <div class="clinical-row" *ngIf="data360.healthRecord?.emergencyDoctorPhone">
                      <span class="lbl">Doctor Contact:</span>
                      <a [href]="'tel:' + data360.healthRecord!.emergencyDoctorPhone" class="val doc-phone">
                        <mat-icon>phone</mat-icon> {{ data360.healthRecord!.emergencyDoctorPhone }}
                      </a>
                    </div>
                    <div class="doctor-notes-box" *ngIf="data360.healthRecord?.doctorNotes || data360.healthRecord?.doctorRemarks">
                      <div class="notes-lbl">Physician's Guidance:</div>
                      <p>{{ data360.healthRecord!.doctorNotes || data360.healthRecord!.doctorRemarks }}</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </mat-tab>

          <!-- TAB 12: SIBLINGS & FAMILY LINKAGE (Feature 1) -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">diversity_3</mat-icon> Siblings &amp; Family ({{ siblingsList.length }})
            </ng-template>
            <div class="tab-content-wrap">
              <div class="tab-action-header">
                <div>
                  <h4 class="tab-action-title">Linked Siblings &amp; Family Group (भाई-बहन मैपिंग)</h4>
                  <p class="tab-action-sub">Link brother/sister profiles, set sibling fee discount, and track family ledger</p>
                </div>
                <button mat-raised-button color="primary" class="primary-gradient-btn" *ngIf="!isReadOnly" (click)="showAddSiblingForm = !showAddSiblingForm">
                  <mat-icon>{{ showAddSiblingForm ? 'close' : 'person_add' }}</mat-icon>
                  {{ showAddSiblingForm ? 'Cancel' : 'Link New Sibling' }}
                </button>
              </div>

              <!-- Add Sibling Drawer / Form Card -->
              <div class="inline-form-card" *ngIf="showAddSiblingForm">
                <div class="form-header">
                  <div class="form-header-title">
                    <mat-icon>person_add</mat-icon>
                    <h5>Search &amp; Link Student as Sibling</h5>
                  </div>
                  <span class="badge-hint"><mat-icon style="font-size:14px; width:14px; height:14px; vertical-align:middle;">travel_explore</mat-icon> Live Institution Search</span>
                </div>

                <div class="form-grid">
                  <div class="form-field-wrap full-col search-field-container">
                    <label>Search Student (Name, Admission No, Parent Phone) *</label>
                    <div class="search-input-wrap">
                      <input type="text" class="custom-input" [(ngModel)]="siblingSearchQuery" (input)="onSearchSibling()" placeholder="Type student name, admission number or parent phone..." />
                      <mat-icon class="search-icon" *ngIf="!searchingCandidates">search</mat-icon>
                      <mat-progress-spinner *ngIf="searchingCandidates" mode="indeterminate" diameter="18" class="search-spinner"></mat-progress-spinner>

                      <!-- Autocomplete Results Dropdown -->
                      <div class="candidate-dropdown" *ngIf="candidateSearchResults.length > 0">
                        <div class="candidate-item" *ngFor="let c of candidateSearchResults" (click)="selectSiblingCandidate(c)">
                          <div class="cand-avatar">{{ getInitials(c.studentName) }}</div>
                          <div class="cand-details">
                            <div class="cand-name">{{ c.studentName }}</div>
                            <div class="cand-meta">
                              <span *ngIf="c.className">Class {{ c.className }}</span>
                              <span *ngIf="c.admissionNumber"> &bull; Adm: {{ c.admissionNumber }}</span>
                              <span *ngIf="c.parentPhone"> &bull; 📞 {{ c.parentPhone }}</span>
                            </div>
                          </div>
                          <button type="button" class="cand-select-btn">Select</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Selected Candidate Preview -->
                  <div class="form-field-wrap full-col" *ngIf="selectedSiblingCandidate">
                    <div class="selected-cand-card">
                      <div class="cand-preview-info">
                        <mat-icon style="color: #16a34a; font-size: 20px; width: 20px; height: 20px;">check_circle</mat-icon>
                        <div>
                          <strong style="color: #15803d; font-size: 0.88rem;">{{ selectedSiblingCandidate.studentName }}</strong>
                          <span style="color:#475569; font-size:12px; margin-left:8px;">
                            ({{ selectedSiblingCandidate.className || 'General' }} &bull; Adm: {{ selectedSiblingCandidate.admissionNumber || 'N/A' }})
                          </span>
                        </div>
                      </div>
                      <button type="button" class="clear-cand-btn" (click)="selectedSiblingCandidate = null" title="Change selection">
                        <mat-icon style="font-size: 16px; width: 16px; height: 16px;">close</mat-icon>
                      </button>
                    </div>
                  </div>

                  <div class="form-field-wrap">
                    <label>Relationship (संबंध) *</label>
                    <select class="custom-input" [(ngModel)]="newSiblingRelationship">
                      <option value="Brother">Brother (भाई)</option>
                      <option value="Sister">Sister (बहन)</option>
                      <option value="Twin">Twin (जुड़वां)</option>
                      <option value="Cousin">Cousin (कज़िन)</option>
                    </select>
                  </div>

                  <div class="form-field-wrap">
                    <label>Sibling Concession / Fee Discount (%)</label>
                    <input type="number" class="custom-input" [(ngModel)]="newSiblingDiscount" min="0" max="100" placeholder="e.g. 15" />
                  </div>

                  <div class="form-field-wrap">
                    <label>Internal Notes / Authorization</label>
                    <input type="text" class="custom-input" [(ngModel)]="newSiblingNotes" placeholder="e.g. Approved 15% discount" />
                  </div>
                </div>

                <div class="form-actions">
                  <button mat-button type="button" (click)="showAddSiblingForm = false">Cancel</button>
                  <button mat-raised-button color="primary" class="primary-gradient-btn" [disabled]="savingSibling || !selectedSiblingCandidate" (click)="saveSiblingLink()">
                    <mat-icon>link</mat-icon> {{ savingSibling ? 'Linking...' : 'Confirm & Link Sibling' }}
                  </button>
                </div>
              </div>

              <!-- Siblings Grid Display -->
              <div class="siblings-manage-grid" *ngIf="siblingsList.length > 0">
                <div class="sibling-manage-card" *ngFor="let sib of siblingsList">
                  <div class="sib-card-top">
                    <div class="sib-avatar-large">
                      <img *ngIf="sib.profilePhoto" [src]="getPhotoUrl(sib.profilePhoto)" [alt]="sib.siblingName" />
                      <span *ngIf="!sib.profilePhoto">{{ getInitials(sib.siblingName) }}</span>
                    </div>
                    <div class="sib-main-info">
                      <div class="sib-name-row">
                        <h5>{{ sib.siblingName }}</h5>
                        <span class="sib-rel-tag">{{ sib.relationship }}</span>
                      </div>
                      <div class="sib-academic-meta">
                        <span *ngIf="sib.className">Class {{ sib.className }}{{ sib.sectionName ? ' - ' + sib.sectionName : '' }}</span>
                        <span *ngIf="sib.schoolRollNumber || sib.rollNumber"> &bull; Roll: {{ sib.schoolRollNumber || sib.rollNumber }}</span>
                        <span *ngIf="sib.admissionNumber"> &bull; Adm: {{ sib.admissionNumber }}</span>
                      </div>
                    </div>
                    <button mat-icon-button color="warn" *ngIf="!isReadOnly" (click)="deleteSiblingLink(sib)" matTooltip="Remove sibling link">
                      <mat-icon>link_off</mat-icon>
                    </button>
                  </div>

                  <div class="sib-card-badges">
                    <div class="sib-badge discount-badge" *ngIf="sib.discountPercent > 0">
                      <mat-icon>local_offer</mat-icon> Sibling Discount: <strong>{{ sib.discountPercent }}%</strong>
                    </div>
                    <div class="sib-badge fee-badge" [class.has-due]="sib.outstandingDues > 0">
                      <mat-icon>{{ sib.outstandingDues > 0 ? 'account_balance_wallet' : 'verified' }}</mat-icon>
                      {{ sib.outstandingDues > 0 ? ('Pending Due: ₹' + (sib.outstandingDues | number)) : 'Fee Cleared (₹0 Due)' }}
                    </div>
                  </div>

                  <div class="sib-card-footer" *ngIf="sib.parentPhone || sib.notes">
                    <span *ngIf="sib.parentPhone" class="parent-phone">
                      <mat-icon>call</mat-icon> {{ sib.parentName || 'Parent' }}: {{ sib.parentPhone }}
                    </span>
                    <span *ngIf="sib.notes" class="sib-notes-text">&bull; {{ sib.notes }}</span>
                  </div>
                </div>
              </div>

              <!-- Empty state -->
              <div class="empty-state-box" *ngIf="siblingsList.length === 0 && !showAddSiblingForm">
                <mat-icon class="empty-icon">diversity_3</mat-icon>
                <h5>No Siblings Linked Yet</h5>
                <p>Link brothers or sisters studying in this institution to enable unified parent portal view and sibling fee concessions.</p>
                <button mat-stroked-button color="primary" *ngIf="!isReadOnly" (click)="showAddSiblingForm = true">
                  <mat-icon>person_add</mat-icon> Link First Sibling
                </button>
              </div>

            </div>
          </mat-tab>

        </mat-tab-group>
      </div>

      <!-- Modal Footer -->
      <div class="modal-footer">
        <div class="footer-left">
          <span class="footer-branch" *ngIf="data360?.student?.branchName">
            <mat-icon class="inline-icon">store</mat-icon> {{ data360!.student.branchName }}
          </span>
        </div>
        <div class="footer-btns">
          <button mat-button (click)="dialogRef.close()">Close</button>
        </div>
      </div>

      <!-- 🏆 PRINTABLE MERIT CERTIFICATE MODAL OVERLAY (Feature 1) -->
      <div class="cert-modal-backdrop" *ngIf="activeCertificateModal" (click)="activeCertificateModal = null">
        <div class="cert-dialog-window" (click)="$event.stopPropagation()">
          <div class="cert-modal-top-bar">
            <span>Certificate of Merit &amp; Excellence Preview</span>
            <div class="top-bar-actions">
              <button mat-raised-button color="primary" class="primary-gradient-btn" (click)="triggerPrint()">
                <mat-icon>print</mat-icon> Print Certificate
              </button>
              <button mat-icon-button (click)="activeCertificateModal = null">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>

          <div class="printable-certificate-sheet" id="printCertificateArea">
            <div class="cert-inner-border">
              <div class="cert-header">
                <div class="cert-seal-icon">🏆</div>
                <h1 class="cert-school-name">{{ data360?.student?.branchName || 'INTERNATIONAL ACADEMY OF EXCELLENCE' }}</h1>
                <h3 class="cert-heading">CERTIFICATE OF MERIT &amp; ACHIEVEMENT</h3>
                <div class="cert-ribbon-sub">This accolade is proudly conferred upon</div>
              </div>

              <div class="cert-recipient-name">{{ data360?.student?.studentName }}</div>
              
              <div class="cert-recipient-meta">
                Class: <strong>{{ data360?.student?.className }}</strong> &bull; 
                Roll No: <strong>{{ data360?.student?.rollNumber }}</strong> &bull; 
                Admission No: <strong>{{ data360?.student?.admissionNumber || 'N/A' }}</strong>
              </div>

              <p class="cert-citation">
                in proud recognition of outstanding dedication, exemplary talent and securing
                <span class="cert-pos-highlight">{{ activeCertificateModal.position || 'Merit Position' }}</span>
                in <strong class="cert-event-title">{{ activeCertificateModal.title }}</strong> 
                held at the <strong>{{ activeCertificateModal.level || activeCertificateModal.awardLevel || 'Institutional' }}</strong> level.
              </p>

              <div class="cert-signatures-row">
                <div class="cert-sign-col">
                  <div class="cert-sign-line"></div>
                  <span class="cert-sign-role">Class Teacher / Event Incharge</span>
                </div>
                <div class="cert-seal-stamp">
                  <div class="stamp-circle">
                    <span>INSTITUTE SEAL</span>
                    <small>{{ (activeCertificateModal.awardedDate || activeCertificateModal.awardDate) | date:'yyyy' }}</small>
                  </div>
                  <div class="cert-date-text">Date: {{ (activeCertificateModal.awardedDate || activeCertificateModal.awardDate) | date:'dd MMM yyyy' }}</div>
                </div>
                <div class="cert-sign-col">
                  <div class="cert-sign-line"></div>
                  <span class="cert-sign-role">Principal / Director</span>
                </div>
              </div>

              <div class="cert-certno" *ngIf="activeCertificateModal.certificateNumber">
                Cert No: {{ activeCertificateModal.certificateNumber }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 🩺 PRINTABLE POCKET EMERGENCY MEDICAL CARD MODAL (Feature 4) -->
      <div class="cert-modal-backdrop" *ngIf="showPrintMedicalCard" (click)="showPrintMedicalCard = false">
        <div class="medical-dialog-window" (click)="$event.stopPropagation()">
          <div class="cert-modal-top-bar">
            <span>Student Emergency Medical Pocket Card Preview</span>
            <div class="top-bar-actions">
              <button mat-raised-button color="primary" class="primary-gradient-btn" (click)="triggerPrint()">
                <mat-icon>print</mat-icon> Print ID Card
              </button>
              <button mat-icon-button (click)="showPrintMedicalCard = false">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>

          <div class="printable-medical-card" id="printMedicalCardArea">
            <div class="med-card-header">
              <div class="med-cross"><mat-icon>local_hospital</mat-icon></div>
              <div class="med-head-title">
                <h4>EMERGENCY MEDICAL IDENTITY CARD</h4>
                <span>{{ data360?.student?.branchName || 'School & Coaching Institution' }}</span>
              </div>
            </div>

            <div class="med-card-body">
              <div class="med-profile-row">
                <div class="med-photo-box">
                  <img *ngIf="data360?.student?.profilePhoto" [src]="getPhotoUrl(data360!.student.profilePhoto)" />
                  <div *ngIf="!data360?.student?.profilePhoto" class="med-photo-fallback">
                    {{ getInitials(data360?.student?.studentName || 'S') }}
                  </div>
                </div>
                <div class="med-details-box">
                  <div class="med-name">{{ data360?.student?.studentName }}</div>
                  <div class="med-line">Class: <strong>{{ data360?.student?.className }}{{ data360?.student?.sectionName ? ' - ' + data360?.student?.sectionName : '' }}</strong> &bull; Roll: <strong>{{ data360?.student?.rollNumber }}</strong></div>
                  <div class="med-line">DOB: <strong>{{ data360?.student?.dateOfBirth ? (data360!.student.dateOfBirth | date:'dd-MM-yyyy') : 'N/A' }}</strong> &bull; Blood: <strong class="blood-highlight">{{ data360?.healthRecord?.bloodGroup || data360?.student?.bloodGroup || 'N/A' }}</strong></div>
                </div>
              </div>

              <div class="med-alert-box red" *ngIf="data360?.healthRecord?.knownAllergies">
                <strong>CRITICAL ALLERGIES:</strong> {{ data360!.healthRecord!.knownAllergies }}
              </div>
              <div class="med-alert-box amber" *ngIf="data360?.healthRecord?.chronicConditions">
                <strong>CHRONIC CONDITIONS:</strong> {{ data360!.healthRecord!.chronicConditions }}
              </div>

              <div class="med-contacts-grid">
                <div class="contact-entry">
                  <span class="label">Father / Guardian:</span>
                  <strong>{{ data360?.student?.parentName }} ({{ data360?.student?.parentWhatsAppPhone }})</strong>
                </div>
                <div class="contact-entry" *ngIf="data360?.student?.emergencyContactName">
                  <span class="label">Emergency Contact:</span>
                  <strong>{{ data360?.student?.emergencyContactName }} ({{ data360?.student?.emergencyContactPhone }})</strong>
                </div>
                <div class="contact-entry" *ngIf="data360?.healthRecord?.emergencyDoctorName">
                  <span class="label">Pediatrician:</span>
                  <strong>{{ data360?.healthRecord?.emergencyDoctorName }} ({{ data360?.healthRecord?.emergencyDoctorPhone }})</strong>
                </div>
              </div>
            </div>
            <div class="med-card-footer">
              <span>Carry on institution excursions &amp; bus transit. In medical emergency, call 108 / Institution Helpdesk.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .profile-360-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: 90vh;
      background: #f8fafc;
      font-family: inherit;
    }

    /* ── STRICT AGENTS.md Compliant Light-Blue Gradient Header ── */
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-avatar-wrap {
      position: relative;
      width: 56px;
      height: 56px;
      border-radius: 12px;
      overflow: visible;
    }

    .header-avatar-img {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      object-fit: cover;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
      border: 2px solid #ffffff;
    }

    .header-avatar-fallback {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      background: #2563eb;
      color: #ffffff;
      font-size: 1.5rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }

    .status-indicator {
      position: absolute;
      bottom: -2px;
      right: -2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #94a3b8;
      border: 2px solid #ffffff;

      &.active {
        background: #10b981;
      }
    }

    .header-title-box {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .modal-title {
      margin: 0;
      font-size: 1.35rem;
      font-weight: 700;
      color: #1e3a8a;
    }

    .status-tag {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 9999px;
      background: #f1f5f9;
      color: #64748b;

      &.active {
        background: #dcfce7;
        color: #166534;
      }
    }

    .modal-subtitle {
      margin: 0;
      font-size: 0.82rem;
      color: #3b82f6;

      strong {
        color: #1e40af;
      }
    }

    .meta-sep {
      margin-left: 4px;
    }

    .close-btn {
      color: #64748b;
      &:hover { color: #1e293b; background: rgba(30, 41, 59, 0.05); }
    }

    /* ── Metrics Ribbon ── */
    .metrics-ribbon {
      display: flex;
      gap: 12px;
      padding: 10px 24px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      overflow-x: auto;
      scrollbar-width: thin;
    }

    .metric-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      white-space: nowrap;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;

        &.icon-att { color: #0284c7; }
        &.icon-fee { color: #059669; }
        &.icon-fee.danger { color: #dc2626; }
        &.icon-hostel { color: #8b5cf6; }
        &.icon-transport { color: #f59e0b; }
        &.icon-lib { color: #0d9488; }
        &.icon-sibling { color: #6366f1; }
      }
    }

    .metric-val {
      font-size: 0.85rem;
      font-weight: 700;
      color: #0f172a;

      &.good { color: #059669; }
      &.warn { color: #d97706; }
      &.danger { color: #dc2626; }
    }

    .metric-lbl {
      font-size: 0.72rem;
      color: #64748b;
    }

    /* ── Body & Custom Tabs ── */
    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 0;
    }

    .tab-content-wrap {
      padding: 20px 24px;
    }

    .tab-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: 6px;
      vertical-align: middle;
    }

    /* ── Cards Grid ── */
    .dossier-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .col-span-2 {
      grid-column: span 2;
    }

    .info-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid #f1f5f9;

      h3, h4 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 700;
        color: #1e293b;
      }

      .sect-icon {
        color: #2563eb;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .info-rows {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.82rem;
      line-height: 1.4;
    }

    .row-label {
      color: #64748b;
      flex: 0 0 130px;
    }

    .row-val {
      color: #1e293b;
      text-align: right;
      flex: 1;

      &.font-semibold { font-weight: 600; }
      &.font-mono { font-family: monospace; letter-spacing: 0.5px; }
      &.address-text { color: #475569; font-size: 0.78rem; }
    }

    .highlight-phone {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #059669;
      font-weight: 600;

      .phone-icon {
        font-size: 15px;
        width: 15px;
        height: 15px;
      }
    }

    .ct-highlight {
      color: #1d4ed8;
      font-weight: 600;
    }

    /* ── Siblings ── */
    .siblings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }

    .sibling-chip-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: #eff6ff;
        border-color: #93c5fd;
        transform: translateY(-1px);
      }
    }

    .sib-avatar-wrap {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      overflow: hidden;
      flex-shrink: 0;
    }

    .sib-avatar-img {
      width: 40px;
      height: 40px;
      object-fit: cover;
    }

    .sib-avatar-fallback {
      width: 40px;
      height: 40px;
      background: #4f46e5;
      color: #ffffff;
      font-weight: 700;
      font-size: 1.1rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .sib-info {
      flex: 1;
      overflow: hidden;
    }

    .sib-name {
      font-weight: 700;
      font-size: 0.85rem;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sib-meta {
      font-size: 0.72rem;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .view-sib-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #3b82f6;
    }

    /* ── Fee KPIs ── */
    .fee-kpi-row, .att-kpi-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }

    .att-kpi-row {
      grid-template-columns: repeat(5, 1fr);
    }

    .fee-kpi-card, .att-box {
      padding: 16px;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: #ffffff;
      border: 1px solid #e2e8f0;

      &.billed { border-left: 4px solid #3b82f6; }
      &.paid { border-left: 4px solid #10b981; }
      &.due { border-left: 4px solid #94a3b8; }
      &.due.has-due { border-left: 4px solid #ef4444; background: #fff5f5; }

      .kpi-label { font-size: 0.75rem; color: #64748b; font-weight: 600; text-transform: uppercase; }
      .kpi-val { font-size: 1.4rem; font-weight: 800; color: #0f172a; }
      .kpi-sub { font-size: 0.72rem; color: #94a3b8; }
    }

    .att-box {
      text-align: center;
      padding: 12px 8px;

      &.percentage { border-top: 3px solid #0284c7; }
      &.present { border-top: 3px solid #10b981; }
      &.absent { border-top: 3px solid #ef4444; }
      &.late { border-top: 3px solid #f59e0b; }
      &.leave { border-top: 3px solid #8b5cf6; }

      .att-num { font-size: 1.3rem; font-weight: 800; color: #0f172a; }
      .att-label { font-size: 0.7rem; color: #64748b; }
    }

    /* ── Tables & Lists ── */
    .section-title-wrap {
      margin-bottom: 12px;
      h4 { margin: 0; font-size: 0.95rem; font-weight: 700; color: #1e293b; }
    }

    .table-scroll-wrap {
      overflow-x: auto;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: #ffffff;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;

      th {
        background: #f8fafc;
        padding: 10px 14px;
        color: #475569;
        font-weight: 600;
        text-align: left;
        border-bottom: 1px solid #e2e8f0;
        white-space: nowrap;
      }

      td {
        padding: 10px 14px;
        color: #1e293b;
        border-bottom: 1px solid #f1f5f9;
      }

      tr:last-child td { border-bottom: none; }
      tr:hover td { background: #fafafa; }
    }

    .text-right { text-align: right; }
    .text-success { color: #059669; }
    .text-danger { color: #dc2626; }
    .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; }
    .font-mono { font-family: monospace; }

    .status-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: capitalize;
      background: #f1f5f9;
      color: #475569;

      &.paid, &.passed, &.present, &.approved, &.verified, &.active {
        background: #dcfce7;
        color: #166534;
      }
      &.due, &.partial, &.overdue, &.absent, &.rejected {
        background: #fee2e2;
        color: #991b1b;
      }
      &.late, &.pending {
        background: #fef3c7;
        color: #92400e;
      }
      &.leave, &.halfday {
        background: #ede9fe;
        color: #5b21b6;
      }
    }

    /* ── Attendance Timeline ── */
    .att-timeline {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .att-log-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 10px 14px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }

    .att-date-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 60px;

      .att-day { font-size: 1.1rem; font-weight: 800; color: #1e293b; }
      .att-mon { font-size: 0.68rem; color: #64748b; text-transform: uppercase; }
    }

    .att-status-col {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 160px;
    }

    .att-source {
      font-size: 0.72rem;
      color: #64748b;
      display: inline-flex;
      align-items: center;
      gap: 2px;

      .inline-icon { font-size: 14px; width: 14px; height: 14px; }
    }

    .att-remarks-col {
      flex: 1;
      font-size: 0.8rem;
      color: #475569;
    }

    /* ── Facilities Grid ── */
    .facilities-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .facility-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
    }

    .fac-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;

      h4 { margin: 0; font-size: 0.95rem; font-weight: 700; color: #1e293b; }
    }

    .fac-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      &.hostel { color: #8b5cf6; }
      &.transport { color: #f59e0b; }
      &.library { color: #0d9488; }
    }

    .fac-status {
      font-size: 0.72rem;
      font-weight: 600;
      color: #64748b;

      &.active { color: #059669; }
    }

    .fac-details {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 0.82rem;
    }

    .fac-row {
      display: flex;
      justify-content: space-between;
      color: #64748b;

      strong { color: #1e293b; }
    }

    .lib-meta-strip {
      display: flex;
      gap: 20px;
      padding: 10px;
      background: #f8fafc;
      border-radius: 8px;
      margin-bottom: 12px;
      font-size: 0.8rem;
      color: #475569;
    }

    .no-books-msg {
      margin: 8px 0;
      font-size: 0.82rem;
      color: #64748b;
      font-style: italic;
    }

    /* ── Leaves & Passes ── */
    .leaves-passes-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .section-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
    }

    .mini-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .mini-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #f1f5f9;
    }

    .mini-left {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .mini-title {
      font-size: 0.82rem;
      font-weight: 600;
      color: #1e293b;
    }

    .mini-meta {
      font-size: 0.7rem;
      color: #64748b;
    }

    /* ── Documents KYC ── */
    .doc-actions-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .doc-count-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
      color: #059669;
      font-weight: 600;

      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }

    .upload-form-card {
      background: #ffffff;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 18px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.08);
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-top: 12px;
    }

    .file-picker-box {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px 12px;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      background: #f8fafc;
    }

    .file-picker-lbl {
      font-size: 0.75rem;
      color: #475569;
      font-weight: 600;
    }

    .file-input {
      font-size: 0.8rem;
    }

    .selected-filename {
      font-size: 0.75rem;
      color: #2563eb;
      font-weight: 600;
    }

    .form-actions-bar {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 8px;
    }

    .docs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 14px;
    }

    .doc-card {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      transition: all 0.2s ease;

      &:hover {
        border-color: #93c5fd;
        box-shadow: 0 2px 6px rgba(0,0,0,0.04);
      }
    }

    .doc-type-icon {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      &.aadhaar { background: #eff6ff; color: #2563eb; }
      &.birth { background: #fdf2f8; color: #db2777; }
      &.tc { background: #fef3c7; color: #d97706; }
      &.marksheet { background: #f0fdf4; color: #16a34a; }
      &.medical { background: #fee2e2; color: #dc2626; }
      &.other { background: #f3f4f6; color: #4b5563; }
    }

    .doc-info {
      flex: 1;
      overflow: hidden;
    }

    .doc-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .doc-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .doc-type-pill {
      font-size: 0.65rem;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      background: #f1f5f9;
      color: #475569;
    }

    .doc-meta {
      font-size: 0.72rem;
      color: #64748b;
      margin-bottom: 2px;
    }

    .doc-remarks {
      margin: 4px 0 0;
      font-size: 0.72rem;
      color: #475569;
      font-style: italic;
    }

    .doc-actions {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .view-btn {
      color: #2563eb;
    }

    /* ── Empty State ── */
    .empty-state-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
      color: #94a3b8;
      text-align: center;

      mat-icon { font-size: 40px; width: 40px; height: 40px; margin-bottom: 8px; }
      p { margin: 0 0 12px; font-size: 0.85rem; }
    }

    /* ── Modal Footer ── */
    .modal-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 24px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
    }

    .footer-branch {
      font-size: 0.8rem;
      color: #64748b;
      display: inline-flex;
      align-items: center;
      gap: 4px;

      .inline-icon { font-size: 16px; width: 16px; height: 16px; }
    }

    /* ── FEATURE 5: SMART EARLY-WARNING & PERFORMANCE RADAR ── */
    .alert-radar-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 10px 24px;
      background: #f0fdf4;
      border-bottom: 1px solid #bbf7d0;
      transition: all 0.2s ease;

      &.has-risk {
        background: #fffbeb;
        border-bottom-color: #fde68a;

        .banner-icon-badge {
          background: #f59e0b;
          color: #ffffff;
        }

        .banner-badge.risk {
          background: #fef3c7;
          color: #b45309;
        }
      }

      &.star-performer {
        background: linear-gradient(135deg, #fefce8 0%, #fef08a 100%);
        border-bottom-color: #facc15;

        .banner-icon-badge {
          background: #eab308;
          color: #ffffff;
          box-shadow: 0 4px 6px -1px rgba(234,179,8,0.3);
        }

        .banner-badge {
          background: #fef9c3;
          color: #854d0e;
        }
      }
    }

    .banner-left {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }

    .banner-icon-badge {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: #0284c7;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }

    .banner-content {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .banner-title-line {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .banner-badge {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 6px;
      background: #e0f2fe;
      color: #0369a1;

      &.normal { background: #e2e8f0; color: #334155; }
    }

    .banner-summary-text {
      font-size: 0.83rem;
      font-weight: 600;
      color: #1e293b;
    }

    .subject-tags-row {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }

    .tag-group {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .tag-title {
      font-size: 0.7rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 2px;

      mat-icon { font-size: 13px; width: 13px; height: 13px; }
      &.strong { color: #15803d; }
      &.weak { color: #b91c1c; }
    }

    .sub-pill {
      font-size: 0.68rem;
      font-weight: 600;
      padding: 1px 7px;
      border-radius: 9999px;

      &.strong { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
      &.weak { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    }

    .banner-quick-actions {
      display: flex;
      gap: 6px;
      flex-shrink: 0;

      .action-btn {
        font-size: 0.75rem;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        color: #334155;
        height: 30px;
        line-height: 28px;
        padding: 0 10px;

        mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 4px; }
        &:hover { background: #f8fafc; border-color: #cbd5e1; }
      }
    }

    /* ── COMMON HEADERS & FORMS IN TABS ── */
    .tab-action-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      gap: 16px;
      flex-wrap: wrap;
    }

    .tab-action-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: #1e293b;
    }

    .tab-action-sub {
      margin: 2px 0 0;
      font-size: 0.78rem;
      color: #64748b;
    }

    .header-action-group {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .primary-gradient-btn {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
      color: #ffffff !important;
      font-weight: 600;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(37,99,235,0.2);
    }

    .print-medical-btn {
      border-color: #0284c7;
      color: #0284c7;
      font-weight: 600;
      border-radius: 8px;
      mat-icon { margin-right: 4px; }
    }

    .inline-form-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 18px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);

      .form-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 14px;
        padding-bottom: 8px;
        border-bottom: 1px solid #f1f5f9;

        .form-header-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        mat-icon { color: #2563eb; }
        h5 { margin: 0; font-size: 0.92rem; font-weight: 700; color: #1e293b; }
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
      }

      .form-field-wrap {
        display: flex;
        flex-direction: column;
        gap: 4px;

        &.full-col { grid-column: 1 / -1; }
        &.checkbox-wrap { justify-content: center; margin-top: 6px; }

        label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #475569;
        }

        .custom-input, .custom-textarea {
          width: 100%;
          padding: 7px 10px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 0.82rem;
          outline: none;
          box-sizing: border-box;

          &:focus {
            border-color: #2563eb;
            box-shadow: 0 0 0 2px rgba(37,99,235,0.15);
          }
        }

        .faculty-combobox-wrap {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;

          .custom-input {
            width: 100%;
            padding-right: 30px;
          }

          .combobox-toggle-btn {
            position: absolute;
            right: 4px;
            background: transparent;
            border: none;
            color: #64748b;
            cursor: pointer;
            padding: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 26px;
            width: 26px;
            border-radius: 4px;

            mat-icon {
              font-size: 20px;
              width: 20px;
              height: 20px;
            }

            &:hover {
              color: #2563eb;
              background: #eff6ff;
            }
          }

          .faculty-dropdown-menu {
            position: absolute;
            top: calc(100% + 4px);
            left: 0;
            right: 0;
            background: #ffffff;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.16), 0 8px 10px -6px rgba(0,0,0,0.06);
            z-index: 100;
            max-height: 220px;
            overflow-y: auto;
            padding: 4px 0;

            .dropdown-group-header {
              padding: 6px 12px 2px;
              font-size: 0.68rem;
              font-weight: 700;
              text-transform: uppercase;
              color: #94a3b8;
              letter-spacing: 0.04em;
              border-top: 1px solid #f1f5f9;

              &:first-child {
                border-top: none;
                padding-top: 4px;
              }
            }

            .dropdown-option-item {
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 6px 12px;
              cursor: pointer;
              transition: background 0.15s;

              &:hover {
                background: #eff6ff;
              }

              &.highlight {
                background: #f0fdf4;
                &:hover {
                  background: #dcfce7;
                }
              }

              .item-icon {
                font-size: 18px;
                width: 18px;
                height: 18px;
                color: #64748b;

                &.star { color: #eab308; }
                &.teacher { color: #2563eb; }
                &.auth { color: #0284c7; }
              }

              .item-text {
                flex: 1;
                min-width: 0;
                .item-name {
                  font-size: 0.82rem;
                  font-weight: 600;
                  color: #1e293b;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                }
                .item-sub {
                  font-size: 0.7rem;
                  color: #64748b;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                }
              }
            }
          }
        }

        .checkbox-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 0.82rem;
          font-weight: 600;
          color: #1e293b;
          cursor: pointer;
        }
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 14px;
        padding-top: 10px;
        border-top: 1px solid #f1f5f9;
      }
    }

    /* ── FEATURE 1: WALL OF FAME & MERIT CERTIFICATES ── */
    .achievement-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 14px;
    }

    .honor-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);

      &:hover {
        border-color: #93c5fd;
        box-shadow: 0 4px 12px rgba(37,99,235,0.08);
        transform: translateY(-2px);
      }

      &.academic { border-left: 4px solid #2563eb; }
      &.sports { border-left: 4px solid #059669; }
      &.cultural { border-left: 4px solid #d97706; }
      &.olympiad { border-left: 4px solid #7c3aed; }
      &.leadership { border-left: 4px solid #0891b2; }
    }

    .honor-top {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      margin-bottom: 10px;
    }

    .honor-badge-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      &.academic { background: #eff6ff; color: #2563eb; }
      &.sports { background: #ecfdf5; color: #059669; }
      &.cultural { background: #fef3c7; color: #d97706; }
      &.olympiad { background: #f3e8ff; color: #7c3aed; }
      &.leadership { background: #cffafe; color: #0891b2; }
      &.other { background: #f1f5f9; color: #475569; }

      mat-icon { font-size: 22px; width: 22px; height: 22px; }
    }

    .honor-titles {
      flex: 1;
    }

    .honor-title {
      font-size: 0.9rem;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 3px;
    }

    .honor-meta {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
    }

    .honor-category-tag, .level-tag, .pos-tag {
      font-size: 0.65rem;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 4px;
    }

    .honor-category-tag { background: #f1f5f9; color: #334155; }
    .level-tag { background: #e0f2fe; color: #0369a1; }
    .pos-tag { background: #fef3c7; color: #92400e; font-weight: 700; }

    .honor-body {
      font-size: 0.78rem;
      color: #475569;
      display: flex;
      flex-direction: column;
      gap: 3px;
      margin-bottom: 12px;
    }

    .honor-info-line {
      display: flex;
      gap: 6px;
      .meta-label { color: #64748b; font-size: 0.72rem; }
      .meta-text { color: #1e293b; font-weight: 500; }
    }

    .honor-remarks {
      margin: 4px 0 0;
      font-size: 0.75rem;
      color: #64748b;
      font-style: italic;
      background: #f8fafc;
      padding: 5px 8px;
      border-radius: 6px;
    }

    .honor-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid #f1f5f9;
      padding-top: 8px;

      .print-cert-btn {
        color: #b45309;
        border-color: #fde68a;
        background: #fefce8;
        font-size: 0.75rem;
        font-weight: 600;

        mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 4px; }
        &:hover { background: #fef9c3; border-color: #facc15; }
      }
    }

    /* ── FEATURE 2: DISCIPLINARY & CONDUCT ── */
    .conduct-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .conduct-item {
      display: flex;
      gap: 12px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px;
      transition: all 0.2s ease;

      &.positivecommendation {
        border-left: 4px solid #10b981;
        background: #f0fdf4;
      }

      &.minorinfraction { border-left: 4px solid #f59e0b; }
      &.moderatemisconduct { border-left: 4px solid #f97316; }
      &.severeviolation { border-left: 4px solid #ef4444; background: #fff5f5; }
    }

    .conduct-icon-col { flex-shrink: 0; }

    .type-pill-icon {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;

      &.positivecommendation { background: #dcfce7; color: #166534; }
      &.minorinfraction { background: #fef3c7; color: #d97706; }
      &.moderatemisconduct { background: #ffedd5; color: #ea580c; }
      &.severeviolation { background: #fee2e2; color: #dc2626; }

      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .conduct-content-col { flex: 1; }

    .conduct-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 3px;
    }

    .conduct-title {
      font-size: 0.88rem;
      font-weight: 700;
      color: #0f172a;
    }

    .conduct-tags { display: flex; gap: 5px; }

    .severity-pill {
      font-size: 0.65rem;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 4px;

      &.commendation { background: #dcfce7; color: #15803d; }
      &.low { background: #f1f5f9; color: #475569; }
      &.medium { background: #fef3c7; color: #b45309; }
      &.high, &.critical { background: #fee2e2; color: #b91c1c; font-weight: 700; }
    }

    .conduct-desc {
      margin: 3px 0 6px;
      font-size: 0.8rem;
      color: #334155;
      line-height: 1.4;
    }

    .conduct-meta-row {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      font-size: 0.72rem;
      color: #64748b;
      margin-bottom: 5px;
    }

    .meta-item {
      display: inline-flex;
      align-items: center;
      gap: 3px;

      mat-icon { font-size: 13px; width: 13px; height: 13px; }
      &.parent-flag.notified { color: #059669; font-weight: 600; }
    }

    .conduct-action-box {
      font-size: 0.75rem;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      padding: 5px 8px;
      border-radius: 6px;
      color: #1e293b;
    }

    /* ── FEATURE 3: PTM DESK ── */
    .ptm-timeline {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .ptm-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }

    .ptm-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }

    .ptm-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .ptm-date-badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      color: #1d4ed8;

      .ptm-day { font-size: 1rem; font-weight: 700; line-height: 1; }
      .ptm-mon { font-size: 0.62rem; font-weight: 600; text-transform: uppercase; }
    }

    .ptm-meta-block {
      .ptm-attendee { font-size: 0.85rem; color: #1e293b; }
      .ptm-teacher { font-size: 0.75rem; color: #64748b; margin-top: 1px; }
    }

    .ptm-header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .satisfaction-badge {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 9999px;

      &.highlysatisfied { background: #dcfce7; color: #166534; }
      &.satisfied { background: #dbeafe; color: #1e40af; }
      &.needsimprovement { background: #fef3c7; color: #92400e; }
      &.dissatisfied { background: #fee2e2; color: #991b1b; }
    }

    .ptm-card-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .ptm-section {
      font-size: 0.8rem;

      .ptm-sec-title {
        font-weight: 600;
        color: #475569;
        display: flex;
        align-items: center;
        gap: 3px;
        margin-bottom: 2px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; color: #2563eb; }
      }

      .ptm-sec-text { margin: 0; color: #1e293b; line-height: 1.4; }
    }

    .ptm-dual-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    .ptm-box {
      padding: 8px 10px;
      border-radius: 8px;
      font-size: 0.78rem;

      .box-title {
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 3px;
        margin-bottom: 3px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
      }

      p { margin: 0; line-height: 1.4; }

      &.teacher-box {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        color: #166534;
        .box-title { color: #15803d; }
      }

      &.parent-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #334155;
        .box-title { color: #1e293b; }
      }
    }

    .ptm-action-points {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 7px 10px;
      border-radius: 8px;
      font-size: 0.78rem;
      color: #1e40af;

      mat-icon { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; }
    }

    /* ── FEATURE 4: HEALTH & MEDICAL PROFILE ── */
    .health-dashboard-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
    }

    .health-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);

      &.bmi-card { grid-column: span 2; }
      &.alert-card { border-top: 4px solid #ef4444; }
      &.clinical-card { grid-column: span 3; }
    }

    .health-card-header {
      display: flex;
      align-items: center;
      gap: 7px;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 8px;
      margin-bottom: 12px;

      .health-icon {
        color: #0284c7;
        font-size: 18px;
        width: 18px;
        height: 18px;

        &.danger { color: #dc2626; }
      }

      h5 { margin: 0; font-size: 0.88rem; font-weight: 700; color: #1e293b; }
    }

    .vitals-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 12px;
    }

    .vital-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px;
      text-align: center;

      .vital-label { font-size: 0.7rem; color: #64748b; display: block; margin-bottom: 2px; }
      .vital-val { font-size: 1rem; font-weight: 700; color: #0f172a; }

      &.bmi-highlight {
        background: #f0fdf4;
        border-color: #86efac;
        .vital-val { color: #166534; }
      }
    }

    .bmi-category-meter {
      margin-top: 8px;

      .meter-bar {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 3px;
        border-radius: 6px;
        overflow: hidden;
      }

      .meter-segment {
        font-size: 0.62rem;
        font-weight: 600;
        text-align: center;
        padding: 4px 2px;
        opacity: 0.5;
        transition: all 0.2s ease;

        &.under { background: #93c5fd; color: #1e3a8a; }
        &.normal { background: #86efac; color: #14532d; }
        &.over { background: #fde047; color: #713f12; }
        &.obese { background: #fca5a5; color: #7f1d1d; }

        &.current {
          opacity: 1;
          font-weight: 800;
          box-shadow: 0 0 0 2px #0f172a;
          border-radius: 4px;
        }
      }

      .bmi-status-text {
        font-size: 0.75rem;
        color: #475569;
        margin-top: 6px;
        text-align: center;

        strong.normal { color: #15803d; }
        strong.underweight { color: #1d4ed8; }
        strong.overweight { color: #b45309; }
        strong.obese { color: #b91c1c; }
      }
    }

    .medical-alert-content {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    .alert-box {
      padding: 7px 9px;
      border-radius: 6px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;

      .alert-title {
        font-size: 0.7rem;
        font-weight: 700;
        color: #475569;
        display: flex;
        align-items: center;
        gap: 3px;
        margin-bottom: 2px;
        mat-icon { font-size: 13px; width: 13px; height: 13px; }
      }

      .alert-desc { margin: 0; font-size: 0.75rem; color: #1e293b; }

      &.has-allergy {
        background: #fef2f2;
        border-color: #fecaca;
        .alert-title { color: #dc2626; }
        .alert-desc { color: #991b1b; font-weight: 600; }
      }

      &.has-condition {
        background: #fffbeb;
        border-color: #fde68a;
        .alert-title { color: #d97706; }
        .alert-desc { color: #92400e; font-weight: 600; }
      }
    }

    .clinical-rows {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;

      .clinical-row {
        font-size: 0.78rem;
        display: flex;
        flex-direction: column;
        gap: 2px;

        .lbl { color: #64748b; font-size: 0.7rem; }
        .val { color: #1e293b; font-weight: 600; }
        .blood-val { color: #dc2626; font-size: 0.9rem; }
        .doc-phone {
          color: #0284c7;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          mat-icon { font-size: 13px; width: 13px; height: 13px; }
        }
      }

      .doctor-notes-box {
        grid-column: span 3;
        background: #f8fafc;
        border: 1px dashed #cbd5e1;
        padding: 7px 10px;
        border-radius: 6px;
        font-size: 0.75rem;
        .notes-lbl { font-weight: 700; color: #475569; margin-bottom: 2px; }
        p { margin: 0; color: #1e293b; }
      }
    }

    /* ── PRINT MODALS & CERTIFICATE ENGINE ── */
    .cert-modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(4px);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .cert-dialog-window, .medical-dialog-window {
      background: #ffffff;
      border-radius: 14px;
      overflow: hidden;
      max-height: 94vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
    }

    .cert-dialog-window { width: 820px; }
    .medical-dialog-window { width: 480px; }

    .cert-modal-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 18px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      font-weight: 700;
      color: #1e3a8a;

      .top-bar-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .printable-certificate-sheet {
      padding: 24px;
      background: #fffdfa;
      overflow-y: auto;
    }

    .cert-inner-border {
      border: 6px double #1e3a8a;
      padding: 28px 32px;
      text-align: center;
      position: relative;
      background: #ffffff;
      box-shadow: inset 0 0 15px rgba(212,175,55,0.12);
    }

    .cert-seal-icon { font-size: 36px; margin-bottom: 4px; }
    .cert-school-name {
      font-size: 1.3rem;
      font-weight: 800;
      color: #1e3a8a;
      letter-spacing: 1.5px;
      margin: 0 0 4px;
      text-transform: uppercase;
    }

    .cert-heading {
      font-size: 1.05rem;
      font-weight: 700;
      color: #b45309;
      letter-spacing: 1.5px;
      margin: 0 0 8px;
    }

    .cert-ribbon-sub {
      font-size: 0.8rem;
      font-style: italic;
      color: #64748b;
      margin-bottom: 12px;
    }

    .cert-recipient-name {
      font-size: 1.5rem;
      font-weight: 800;
      color: #1e293b;
      font-family: serif;
      border-bottom: 2px solid #cbd5e1;
      display: inline-block;
      padding: 0 24px 4px;
      margin-bottom: 6px;
    }

    .cert-recipient-meta {
      font-size: 0.82rem;
      color: #475569;
      margin-bottom: 14px;
    }

    .cert-citation {
      font-size: 0.9rem;
      line-height: 1.6;
      color: #334155;
      max-width: 620px;
      margin: 0 auto 24px;

      .cert-pos-highlight {
        color: #b45309;
        font-weight: 800;
        text-decoration: underline;
      }
    }

    .cert-signatures-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 16px;
      padding: 0 16px;
    }

    .cert-sign-col {
      width: 170px;
      text-align: center;

      .cert-sign-line {
        border-bottom: 1.5px dashed #475569;
        margin-bottom: 5px;
      }

      .cert-sign-role {
        font-size: 0.72rem;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
      }
    }

    .cert-seal-stamp {
      display: flex;
      flex-direction: column;
      align-items: center;

      .stamp-circle {
        width: 64px;
        height: 64px;
        border: 2px dashed #b45309;
        border-radius: 50%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #b45309;
        font-size: 0.58rem;
        font-weight: 800;
        margin-bottom: 3px;
      }

      .cert-date-text {
        font-size: 0.72rem;
        color: #64748b;
      }
    }

    .cert-certno {
      margin-top: 16px;
      font-size: 0.68rem;
      color: #94a3b8;
      font-family: monospace;
    }

    /* Pocket Medical Card Layout */
    .printable-medical-card {
      padding: 14px;
      background: #ffffff;
      border: 2px solid #ef4444;
      border-radius: 10px;
      margin: 14px;
      font-family: inherit;
    }

    .med-card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 2px solid #ef4444;
      padding-bottom: 6px;
      margin-bottom: 8px;

      .med-cross {
        width: 28px;
        height: 28px;
        background: #ef4444;
        color: #ffffff;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }

      .med-head-title {
        h4 { margin: 0; font-size: 0.8rem; font-weight: 800; color: #dc2626; }
        span { font-size: 0.65rem; color: #64748b; font-weight: 600; }
      }
    }

    .med-profile-row {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-bottom: 8px;
    }

    .med-photo-box {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #cbd5e1;
      flex-shrink: 0;

      img { width: 100%; height: 100%; object-fit: cover; }
      .med-photo-fallback {
        width: 100%;
        height: 100%;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 1.1rem;
      }
    }

    .med-details-box {
      .med-name { font-size: 0.95rem; font-weight: 800; color: #0f172a; margin-bottom: 2px; }
      .med-line { font-size: 0.75rem; color: #334155; }
      .blood-highlight { color: #dc2626; font-size: 0.82rem; }
    }

    .med-alert-box {
      padding: 5px 8px;
      border-radius: 6px;
      font-size: 0.72rem;
      margin-bottom: 6px;

      &.red { background: #fee2e2; color: #991b1b; border: 1px solid #f87171; }
      &.amber { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
    }

    .med-contacts-grid {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: 0.72rem;
      background: #f8fafc;
      padding: 6px;
      border-radius: 6px;

      .contact-entry {
        display: flex;
        justify-content: space-between;
        .label { color: #64748b; }
      }
    }

    .med-card-footer {
      margin-top: 8px;
      font-size: 0.62rem;
      color: #94a3b8;
      text-align: center;
      border-top: 1px solid #f1f5f9;
      padding-top: 4px;
    }

    /* ── TAB 12: SIBLINGS & FAMILY STYLES ── */
    .badge-hint {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 0.72rem;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 9999px;
      border: 1px solid #bfdbfe;
    }

    .search-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;

      .custom-input {
        width: 100%;
        padding-right: 38px;
      }

      .search-icon {
        position: absolute;
        right: 12px;
        color: #94a3b8;
        font-size: 18px;
        width: 18px;
        height: 18px;
        pointer-events: none;
      }

      .search-spinner {
        position: absolute;
        right: 12px;
      }
    }

    .candidate-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background: #ffffff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.12), 0 4px 6px -2px rgba(0,0,0,0.05);
      z-index: 50;
      max-height: 220px;
      overflow-y: auto;

      .candidate-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #f1f5f9;
        transition: background 0.15s;

        &:last-child {
          border-bottom: none;
        }

        &:hover {
          background: #eff6ff;
        }

        .cand-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #2563eb;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.75rem;
          flex-shrink: 0;
        }

        .cand-details {
          flex: 1;
          .cand-name { font-weight: 600; font-size: 0.85rem; color: #0f172a; }
          .cand-meta { font-size: 0.72rem; color: #64748b; }
        }

        .cand-select-btn {
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;

          &:hover {
            background: #2563eb;
            color: #ffffff;
          }
        }
      }
    }

    .selected-cand-card {
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 1px solid #86efac;
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;

      .cand-preview-info {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .clear-cand-btn {
        background: transparent;
        border: none;
        color: #64748b;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;

        &:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }
      }
    }

    .siblings-manage-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
      margin-top: 14px;
    }

    .sibling-manage-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: all 0.2s;

      &:hover {
        border-color: #93c5fd;
        box-shadow: 0 4px 12px -2px rgba(37,99,235,0.08);
      }

      .sib-card-top {
        display: flex;
        align-items: center;
        gap: 12px;

        .sib-avatar-large {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: #eff6ff;
          color: #2563eb;
          border: 2px solid #bfdbfe;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1rem;
          flex-shrink: 0;
          overflow: hidden;

          img { width: 100%; height: 100%; object-fit: cover; }
        }

        .sib-main-info {
          flex: 1;

          .sib-name-row {
            display: flex;
            align-items: center;
            gap: 8px;

            h5 {
              margin: 0;
              font-size: 0.95rem;
              font-weight: 700;
              color: #0f172a;
            }

            .sib-rel-tag {
              background: #f1f5f9;
              color: #334155;
              padding: 1px 8px;
              border-radius: 10px;
              font-size: 0.7rem;
              font-weight: 600;
            }
          }

          .sib-academic-meta {
            font-size: 0.78rem;
            color: #64748b;
            margin-top: 2px;
          }
        }
      }

      .sib-card-badges {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;

        .sib-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;

          mat-icon { font-size: 14px; width: 14px; height: 14px; }
        }

        .discount-badge {
          background: #fef3c7;
          color: #b45309;
        }

        .fee-badge {
          background: #dcfce7;
          color: #15803d;

          &.has-due {
            background: #fee2e2;
            color: #b91c1c;
          }
        }
      }

      .sib-card-footer {
        font-size: 0.75rem;
        color: #64748b;
        border-top: 1px solid #f1f5f9;
        padding-top: 8px;
        display: flex;
        align-items: center;
        gap: 6px;

        .parent-phone {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          mat-icon { font-size: 13px; width: 13px; height: 13px; }
        }

        .sib-notes-text {
          color: #94a3b8;
          font-style: italic;
        }
      }
    }
  `]
})
export class StudentProfile360DialogComponent implements OnInit {
  loading = true;
  data360: Student360Data | null = null;
  activeTabIndex = 0;

  // Document upload state
  showUploadForm = false;
  uploading = false;
  selectedFileName = '';
  newDoc: CreateStudentDocumentPayload = {
    documentType: 'Aadhaar',
    title: '',
    documentNumber: '',
    fileUrl: '',
    fileName: '',
    fileBase64: '',
    remarks: ''
  };

  // 🏆 Printable Modals Overlay State
  activeCertificateModal: StudentAchievementDto | null = null;
  showPrintMedicalCard = false;

  // 🏆 Feature 1: Wall of Fame State
  showAddAchievementForm = false;
  savingAchievement = false;
  newAchievement: CreateStudentAchievementDto = {
    title: '',
    category: 'Academic',
    level: 'School',
    position: '1st Place',
    awardedDate: new Date().toISOString().substring(0, 10),
    issuedBy: '',
    certificateNumber: '',
    remarks: ''
  };

  // ⚠️ Feature 2: Conduct & Discipline State
  showAddDisciplineForm = false;
  savingDiscipline = false;
  newDiscipline: CreateStudentDisciplinaryDto = {
    incidentDate: new Date().toISOString().substring(0, 10),
    incidentType: 'PositiveCommendation',
    severity: 'Commendation',
    title: '',
    description: '',
    actionTaken: '',
    reportedByName: '',
    parentNotified: false,
    status: 'Resolved'
  };

  // 👨‍👩‍👧 Feature 3: PTM State
  showAddPtmForm = false;
  savingPtm = false;
  newPtm: CreateStudentPtmDto = {
    meetingDate: new Date().toISOString().substring(0, 10),
    attendedByParentName: '',
    teacherName: '',
    discussionSummary: '',
    teacherRemarks: '',
    parentFeedback: '',
    actionPoints: '',
    satisfactionRating: 'Satisfied'
  };

  // 🩺 Feature 4: Health Profile State
  showEditHealthForm = false;
  savingHealth = false;
  healthForm: SaveStudentHealthDto = {
    heightCm: null,
    weightKg: null,
    bloodGroup: '',
    visionLeft: '6/6',
    visionRight: '6/6',
    knownAllergies: '',
    chronicConditions: '',
    regularMedications: '',
    emergencyDoctorName: '',
    emergencyDoctorPhone: '',
    lastCheckupDate: null,
    doctorNotes: ''
  };

  // 👨‍👩‍👧 Feature 1: Sibling & Family State
  siblingsList: StudentSiblingDto[] = [];
  loadingSiblings = false;
  showAddSiblingForm = false;
  savingSibling = false;
  siblingSearchQuery = '';
  searchingCandidates = false;
  candidateSearchResults: SiblingCandidateSearchDto[] = [];
  selectedSiblingCandidate: SiblingCandidateSearchDto | null = null;
  newSiblingRelationship = 'Brother';
  newSiblingDiscount = 0;
  newSiblingNotes = '';

  // 👨‍🏫 Faculty / Teachers List for Combobox
  schoolTeachers: any[] = [];
  showDisciplineFacultyDropdown = false;
  showPtmFacultyDropdown = false;

  institutionalAuthorities = [
    { title: 'Discipline Incharge / Proctor', icon: 'gavel' },
    { title: 'Hostel Warden', icon: 'hotel' },
    { title: 'Sports Coach / P.E. Teacher', icon: 'sports_soccer' },
    { title: 'Librarian / Library Incharge', icon: 'local_library' },
    { title: 'Transport Incharge / Bus Driver', icon: 'directions_bus' },
    { title: 'Principal / Vice Principal', icon: 'account_balance' },
    { title: 'Academic Counselor', icon: 'psychology' }
  ];

  @HostListener('document:click', ['$event'])
  onGlobalClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.faculty-field-wrap')) {
      this.showDisciplineFacultyDropdown = false;
      this.showPtmFacultyDropdown = false;
    }
  }

  selectDisciplineFaculty(val: string): void {
    this.newDiscipline.reportedByName = val;
    this.showDisciplineFacultyDropdown = false;
  }

  selectPtmFaculty(val: string): void {
    this.newPtm.teacherName = val;
    this.showPtmFacultyDropdown = false;
  }

  getFilteredTeachers(filterText?: string | null): any[] {
    if (!filterText || !filterText.trim()) {
      return this.schoolTeachers;
    }
    const q = filterText.toLowerCase().trim();
    return this.schoolTeachers.filter(t =>
      t.fullName?.toLowerCase().includes(q) ||
      t.specialization?.toLowerCase().includes(q) ||
      t.designation?.toLowerCase().includes(q)
    );
  }

  constructor(
    public dialogRef: MatDialogRef<StudentProfile360DialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: StudentProfile360DialogData,
    private coachingService: CoachingService,
    private confirmDialog: ConfirmDialogService,
    public authService: AuthService,
    private dialog: MatDialog
  ) {}

  get isReadOnly(): boolean {
    return !!this.data?.isReadOnly || this.authService.isStudentOrParent();
  }

  ngOnInit(): void {
    this.loadProfile();
    this.loadTeachers();
  }

  loadTeachers(): void {
    this.coachingService.getTeachers().subscribe({
      next: (teachers) => {
        this.schoolTeachers = (teachers || []).filter((t: any) => t.isActive !== false);
      },
      error: () => {}
    });
  }

  loadProfile(): void {
    this.loading = true;
    this.loadSiblings();
    this.coachingService.getStudentProfile360(this.data.studentId).subscribe({
      next: (res) => {
        this.data360 = res;
        this.loading = false;
        this.syncFormsWithData();
      },
      error: () => {
        this.loading = false;
        this.confirmDialog.alert('Error', 'Could not load student 360 profile.', 'danger');
      }
    });
  }

  syncFormsWithData(): void {
    if (!this.data360) return;
    if (this.data360.healthProfile && !this.data360.healthRecord) {
      this.data360.healthRecord = this.data360.healthProfile;
    }
    const h = this.data360.healthRecord || this.data360.healthProfile;
    if (h) {
      this.healthForm = {
        heightCm: h.heightCm,
        weightKg: h.weightKg,
        bloodGroup: h.bloodGroup || this.data360.student.bloodGroup || '',
        visionLeft: h.visionLeft || '6/6',
        visionRight: h.visionRight || '6/6',
        knownAllergies: h.knownAllergies || '',
        chronicConditions: h.chronicConditions || '',
        regularMedications: h.regularMedications || '',
        emergencyDoctorName: h.emergencyDoctorName || '',
        emergencyDoctorPhone: h.emergencyDoctorPhone || '',
        lastCheckupDate: h.lastCheckupDate ? (h.lastCheckupDate as string).substring(0, 10) : null,
        doctorNotes: h.doctorNotes || h.doctorRemarks || ''
      };
    } else {
      this.healthForm.bloodGroup = this.data360.student.bloodGroup || '';
    }

    if (!this.newPtm.attendedByParentName && this.data360.student.parentName) {
      this.newPtm.attendedByParentName = this.data360.student.parentName;
    }
    if (!this.newPtm.teacherName && this.data360.student.classTeacherName) {
      this.newPtm.teacherName = this.data360.student.classTeacherName;
    }
    if (!this.newDiscipline.reportedByName && this.data360.student.classTeacherName) {
      this.newDiscipline.reportedByName = this.data360.student.classTeacherName;
    }
  }

  openSibling(siblingId: string): void {
    this.data.studentId = siblingId;
    this.loadProfile();
  }

  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;

    this.selectedFileName = file.name;
    this.newDoc.fileName = file.name;

    const reader = new FileReader();
    reader.onload = () => {
      this.newDoc.fileBase64 = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  saveDocument(): void {
    if (!this.newDoc.documentType || !this.newDoc.title) {
      this.confirmDialog.alert('Validation', 'Document Type and Title are required.', 'warning');
      return;
    }

    this.uploading = true;
    this.coachingService.addStudentDocument(this.data.studentId, this.newDoc).subscribe({
      next: (doc) => {
        this.uploading = false;
        this.showUploadForm = false;
        if (this.data360) {
          this.data360.documents = [doc, ...(this.data360.documents || [])];
        }
        this.resetUploadForm();
        this.confirmDialog.alert('Success', 'Document successfully attached to student profile.', 'success');
      },
      error: (err) => {
        this.uploading = false;
        this.confirmDialog.alert('Error', err?.error?.message || 'Failed to upload document.', 'danger');
      }
    });
  }

  deleteDocument(doc: StudentDocumentItem): void {
    this.confirmDialog.confirm('Delete Document', `Are you sure you want to remove '${doc.title}'?`, 'danger').subscribe((ok) => {
      if (!ok) return;

      this.coachingService.deleteStudentDocument(this.data.studentId, doc.id).subscribe({
        next: () => {
          if (this.data360) {
            this.data360.documents = this.data360.documents.filter(d => d.id !== doc.id);
          }
        },
        error: (err) => {
          this.confirmDialog.alert('Error', err?.error?.message || 'Could not delete document.', 'danger');
        }
      });
    });
  }

  resetUploadForm(): void {
    this.selectedFileName = '';
    this.newDoc = {
      documentType: 'Aadhaar',
      title: '',
      documentNumber: '',
      fileUrl: '',
      fileName: '',
      fileBase64: '',
      remarks: ''
    };
  }

  getDocIcon(type: string): string {
    switch (type) {
      case 'Aadhaar': return 'credit_card';
      case 'BirthCertificate': return 'child_care';
      case 'TransferCertificate': return 'swap_horiz';
      case 'Marksheet': return 'description';
      case 'MedicalRecord': return 'local_hospital';
      default: return 'insert_drive_file';
    }
  }

  getDocIconClass(type: string): string {
    switch (type) {
      case 'Aadhaar': return 'aadhaar';
      case 'BirthCertificate': return 'birth';
      case 'TransferCertificate': return 'tc';
      case 'Marksheet': return 'marksheet';
      case 'MedicalRecord': return 'medical';
      default: return 'other';
    }
  }

  getPhotoUrl(path: string | null | undefined): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      return path;
    }
    return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  getFullUrl(path: string | null | undefined): string {
    return this.getPhotoUrl(path);
  }

  getInitials(name: string): string {
    if (!name) return 'S';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  // ── 🏆 Feature 1: Wall of Fame & Merit Certificate Methods ──────────────────
  saveAchievement(): void {
    if (!this.newAchievement.title || !this.newAchievement.awardedDate) {
      this.confirmDialog.alert('Validation Error', 'Achievement Title and Awarded Date are required.', 'warning');
      return;
    }

    this.savingAchievement = true;
    this.coachingService.addStudentAchievement(this.data.studentId, this.newAchievement).subscribe({
      next: (res) => {
        this.savingAchievement = false;
        this.showAddAchievementForm = false;
        if (this.data360) {
          if (!this.data360.achievements) this.data360.achievements = [];
          this.data360.achievements.unshift(res);
        }
        this.newAchievement = {
          title: '',
          category: 'Academic',
          level: 'School',
          position: '1st Place',
          awardedDate: new Date().toISOString().substring(0, 10),
          issuedBy: '',
          certificateNumber: '',
          remarks: ''
        };
        this.confirmDialog.alert('Success', 'Student honor/achievement recorded successfully!', 'success');
      },
      error: (err) => {
        this.savingAchievement = false;
        this.confirmDialog.alert('Error', err?.error?.message || 'Failed to record achievement.', 'danger');
      }
    });
  }

  deleteAchievement(ach: StudentAchievementDto): void {
    this.confirmDialog.confirm('Delete Achievement', `Remove '${ach.title}' from student wall of fame?`, 'danger').subscribe((ok) => {
      if (!ok) return;
      this.coachingService.deleteStudentAchievement(this.data.studentId, ach.id).subscribe({
        next: () => {
          if (this.data360?.achievements) {
            this.data360.achievements = this.data360.achievements.filter(a => a.id !== ach.id);
          }
        },
        error: (err) => {
          this.confirmDialog.alert('Error', err?.error?.message || 'Could not delete achievement.', 'danger');
        }
      });
    });
  }

  printCertificate(ach: StudentAchievementDto): void {
    this.activeCertificateModal = ach;
  }

  getAchievementIcon(category: string): string {
    switch ((category || '').toLowerCase()) {
      case 'academic': return 'school';
      case 'sports': return 'sports_tennis';
      case 'cultural': return 'palette';
      case 'olympiad': return 'workspace_premium';
      case 'leadership': return 'stars';
      default: return 'military_tech';
    }
  }

  // ── ⚠️ Feature 2: Conduct & Disciplinary Methods ────────────────────────────
  saveDiscipline(): void {
    if (!this.newDiscipline.title || !this.newDiscipline.description) {
      this.confirmDialog.alert('Validation Error', 'Entry Title and Description are required.', 'warning');
      return;
    }

    this.savingDiscipline = true;
    this.coachingService.addStudentDiscipline(this.data.studentId, this.newDiscipline).subscribe({
      next: (res) => {
        this.savingDiscipline = false;
        this.showAddDisciplineForm = false;
        if (this.data360) {
          if (!this.data360.disciplinaryRecords) this.data360.disciplinaryRecords = [];
          this.data360.disciplinaryRecords.unshift(res);
        }
        this.newDiscipline = {
          incidentDate: new Date().toISOString().substring(0, 10),
          incidentType: 'PositiveCommendation',
          severity: 'Commendation',
          title: '',
          description: '',
          actionTaken: '',
          reportedByName: this.data360?.student?.classTeacherName || '',
          parentNotified: false,
          status: 'Resolved'
        };
        this.confirmDialog.alert('Success', 'Conduct diary entry logged successfully!', 'success');
      },
      error: (err) => {
        this.savingDiscipline = false;
        this.confirmDialog.alert('Error', err?.error?.message || 'Failed to save conduct entry.', 'danger');
      }
    });
  }

  deleteDiscipline(rec: StudentDisciplinaryDto): void {
    this.confirmDialog.confirm('Delete Entry', `Remove '${rec.title}' from conduct register?`, 'danger').subscribe((ok) => {
      if (!ok) return;
      this.coachingService.deleteStudentDiscipline(this.data.studentId, rec.id).subscribe({
        next: () => {
          if (this.data360?.disciplinaryRecords) {
            this.data360.disciplinaryRecords = this.data360.disciplinaryRecords.filter(r => r.id !== rec.id);
          }
        },
        error: (err) => {
          this.confirmDialog.alert('Error', err?.error?.message || 'Could not delete entry.', 'danger');
        }
      });
    });
  }

  // ── 👨‍👩‍👧 Feature 3: PTM Methods ──────────────────────────────────────────────
  savePtm(): void {
    if (!this.newPtm.attendedByParentName || !this.newPtm.meetingDate) {
      this.confirmDialog.alert('Validation Error', 'Parent Name and Meeting Date are required.', 'warning');
      return;
    }

    this.savingPtm = true;
    this.coachingService.addStudentPtm(this.data.studentId, this.newPtm).subscribe({
      next: (res) => {
        this.savingPtm = false;
        this.showAddPtmForm = false;
        if (this.data360) {
          if (!this.data360.ptmRecords) this.data360.ptmRecords = [];
          this.data360.ptmRecords.unshift(res);
        }
        this.newPtm = {
          meetingDate: new Date().toISOString().substring(0, 10),
          attendedByParentName: this.data360?.student?.parentName || '',
          teacherName: this.data360?.student?.classTeacherName || '',
          discussionSummary: '',
          teacherRemarks: '',
          parentFeedback: '',
          actionPoints: '',
          satisfactionRating: 'Satisfied'
        };
        this.confirmDialog.alert('Success', 'PTM interaction logged successfully!', 'success');
      },
      error: (err) => {
        this.savingPtm = false;
        this.confirmDialog.alert('Error', err?.error?.message || 'Failed to record PTM interaction.', 'danger');
      }
    });
  }

  deletePtm(ptm: StudentPtmDto): void {
    const ptmDateStr = (ptm.meetingDate || ptm.ptmDate) ? new Date(ptm.meetingDate || ptm.ptmDate!).toLocaleDateString() : '';
    this.confirmDialog.confirm('Delete PTM Record', `Delete PTM interaction held on ${ptmDateStr}?`, 'danger').subscribe((ok) => {
      if (!ok) return;
      this.coachingService.deleteStudentPtm(this.data.studentId, ptm.id).subscribe({
        next: () => {
          if (this.data360?.ptmRecords) {
            this.data360.ptmRecords = this.data360.ptmRecords.filter(p => p.id !== ptm.id);
          }
        },
        error: (err) => {
          this.confirmDialog.alert('Error', err?.error?.message || 'Could not delete PTM record.', 'danger');
        }
      });
    });
  }

  formatRating(rating?: string): string {
    if (!rating) return '🟢 Verified Interaction';
    switch (rating) {
      case 'HighlySatisfied': return '🟢 Highly Satisfied';
      case 'Satisfied': return '🔵 Satisfied';
      case 'NeedsImprovement': return '🟠 Needs Improvement';
      case 'Dissatisfied': return '🔴 Dissatisfied';
      default: return rating;
    }
  }

  // ── 🩺 Feature 4: Health Tracker & Pocket Medical Card ──────────────────────
  toggleEditHealth(): void {
    this.showEditHealthForm = !this.showEditHealthForm;
    if (this.showEditHealthForm) {
      this.syncFormsWithData();
    }
  }

  saveHealth(): void {
    this.savingHealth = true;
    this.coachingService.saveStudentHealth(this.data.studentId, this.healthForm).subscribe({
      next: (res) => {
        this.savingHealth = false;
        this.showEditHealthForm = false;
        if (this.data360) {
          this.data360.healthRecord = res;
          this.data360.healthProfile = res;
        }
        this.confirmDialog.alert('Success', 'Student health vitals updated successfully!', 'success');
      },
      error: (err) => {
        this.savingHealth = false;
        this.confirmDialog.alert('Error', err?.error?.message || 'Failed to update health record.', 'danger');
      }
    });
  }

  triggerPrint(): void {
    window.print();
  }

  // ── 👨‍👩‍👧 Feature 1: Sibling & Family Linkage Methods ─────────────────────────
  loadSiblings(): void {
    if (!this.data.studentId) return;
    this.loadingSiblings = true;
    this.coachingService.getStudentSiblings(this.data.studentId).subscribe({
      next: (res) => {
        this.siblingsList = res || [];
        this.loadingSiblings = false;
      },
      error: () => {
        this.loadingSiblings = false;
      }
    });
  }

  onSearchSibling(): void {
    if (!this.siblingSearchQuery || this.siblingSearchQuery.trim().length < 2) {
      this.candidateSearchResults = [];
      return;
    }
    this.searchingCandidates = true;
    this.coachingService.searchStudentsForSibling(this.siblingSearchQuery.trim(), this.data.studentId).subscribe({
      next: (res) => {
        this.candidateSearchResults = res || [];
        this.searchingCandidates = false;
      },
      error: () => {
        this.searchingCandidates = false;
      }
    });
  }

  selectSiblingCandidate(candidate: SiblingCandidateSearchDto): void {
    this.selectedSiblingCandidate = candidate;
    this.candidateSearchResults = [];
    this.siblingSearchQuery = candidate.studentName;
  }

  saveSiblingLink(): void {
    if (!this.selectedSiblingCandidate) {
      this.confirmDialog.alert('Selection Required', 'Please search and select a student to link as sibling.', 'warning');
      return;
    }

    this.savingSibling = true;
    this.coachingService.addStudentSibling(this.data.studentId, {
      siblingStudentId: this.selectedSiblingCandidate.id,
      relationship: this.newSiblingRelationship,
      discountPercent: this.newSiblingDiscount || 0,
      notes: this.newSiblingNotes
    }).subscribe({
      next: (res) => {
        this.savingSibling = false;
        this.showAddSiblingForm = false;
        this.selectedSiblingCandidate = null;
        this.siblingSearchQuery = '';
        this.newSiblingDiscount = 0;
        this.newSiblingNotes = '';
        this.siblingsList.unshift(res);
        this.loadProfile();
        this.confirmDialog.alert('Success', `${res.siblingName} has been linked as ${res.relationship} successfully!`, 'success');
      },
      error: (err) => {
        this.savingSibling = false;
        this.confirmDialog.alert('Error', err?.error?.message || 'Failed to link sibling.', 'danger');
      }
    });
  }

  deleteSiblingLink(sib: StudentSiblingDto): void {
    this.confirmDialog.confirm(
      'Remove Sibling Link',
      `Are you sure you want to remove the sibling link between this student and ${sib.siblingName}?`,
      'Yes, Remove Link',
      'Cancel',
      'danger'
    ).subscribe(confirmed => {
      if (!confirmed) return;
      this.coachingService.deleteStudentSibling(sib.id).subscribe({
        next: () => {
          this.siblingsList = this.siblingsList.filter(s => s.id !== sib.id);
          this.loadProfile();
          this.confirmDialog.alert('Success', 'Sibling link removed successfully.', 'success');
        },
        error: (err) => {
          this.confirmDialog.alert('Error', err?.error?.message || 'Failed to remove sibling link.', 'danger');
        }
      });
    });
  }
}
