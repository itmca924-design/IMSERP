import { Component, OnInit, Inject, computed } from '@angular/core';
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
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';

const API_BASE = 'http://localhost:5000/api';

export interface StudentHomeworkDto {
  id: string;
  tenantId: string;
  branchId?: string;
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  batchId?: string;
  batchName?: string;
  subjectId?: string;
  subjectName: string;
  teacherId?: string;
  teacherName?: string;
  title: string;
  description: string;
  assignedDate: string;
  dueDate: string;
  attachmentUrl?: string;
  attachmentFileName?: string;
  status: string;
  estimatedMinutes?: number;
  createdAt: string;
  totalSubmissions?: number;
}

export interface StudentHomeworkSubmissionDto {
  id: string;
  homeworkId: string;
  studentId: string;
  studentName: string;
  rollNumber?: string;
  admissionNumber?: string;
  submissionDate: string;
  studentRemarks?: string;
  submissionFileUrl: string;
  submissionFileName: string;
  status: string; // Submitted, Reviewed, NeedsCorrection, Approved
  teacherRemarks?: string;
  gradeOrMarks?: string;
  reviewedAt?: string;
  reviewedByTeacherName?: string;
}

export interface StudentHomeworkWithSubmissionDto extends StudentHomeworkDto {
  isSubmitted: boolean;
  mySubmission?: StudentHomeworkSubmissionDto;
}

export interface ClassStudentSubmissionRosterDto {
  studentId: string;
  studentName: string;
  rollNumber?: string;
  admissionNumber?: string;
  hasSubmitted: boolean;
  submission?: StudentHomeworkSubmissionDto;
}

export interface HomeworkStatsDto {
  totalActive: number;
  dueToday: number;
  assignedToday: number;
  completed: number;
}

@Component({
  selector: 'app-homework-diary',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule, MatProgressBarModule,
    IstDatetimeDirective
  ],
  template: `
    <div class="hw-page-container">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>menu_book</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Digital Homework & Daily Classwork Diary</h1>
            <p class="page-subtitle">
              Manage subject homework assignments, worksheets, student copy submissions & digital grading
            </p>
          </div>
        </div>

        <div class="header-actions">
          <!-- View switcher tab for admins/teachers -->
          <div class="role-view-switch" *ngIf="!isStudentOrParent">
            <button class="switch-pill" [class.active]="activeTab === 'teacher'" (click)="setTab('teacher')">
              <mat-icon>co_present</mat-icon>
              <span>Teacher / Admin View</span>
            </button>
            <button class="switch-pill" [class.active]="activeTab === 'student'" (click)="setTab('student')">
              <mat-icon>school</mat-icon>
              <span>Student Portal View</span>
            </button>
          </div>

          <button mat-stroked-button class="refresh-btn" (click)="refreshCurrentView()" [disabled]="loading">
            <mat-icon [class.spin]="loading">refresh</mat-icon>
            <span>Refresh</span>
          </button>

          <button mat-raised-button class="create-btn" *ngIf="activeTab === 'teacher'" (click)="openHomeworkDialog()">
            <mat-icon>add_circle</mat-icon>
            <span>Assign Homework</span>
          </button>
        </div>
      </div>

      <!-- TEACHER / ADMIN VIEW -->
      <ng-container *ngIf="activeTab === 'teacher'">
        <!-- Stats Bar -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon-wrap blue"><mat-icon>assignment</mat-icon></div>
            <div class="stat-details">
              <div class="stat-value">{{stats.totalActive}}</div>
              <div class="stat-label">Active Assignments</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon-wrap amber"><mat-icon>alarm</mat-icon></div>
            <div class="stat-details">
              <div class="stat-value">{{stats.dueToday}}</div>
              <div class="stat-label">Due Today</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon-wrap green"><mat-icon>today</mat-icon></div>
            <div class="stat-details">
              <div class="stat-value">{{stats.assignedToday}}</div>
              <div class="stat-label">Assigned Today</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon-wrap purple"><mat-icon>task_alt</mat-icon></div>
            <div class="stat-details">
              <div class="stat-value">{{stats.completed}}</div>
              <div class="stat-label">Completed Tasks</div>
            </div>
          </div>
        </div>

        <!-- Filter Bar -->
        <div class="filter-card">
          <div class="filter-row">
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Filter by Class</mat-label>
              <mat-select [(ngModel)]="filterClassId" (selectionChange)="onClassChange()">
                <mat-option value="">All Classes</mat-option>
                <mat-option *ngFor="let c of classes" [value]="c.id">{{c.name}}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field" *ngIf="availableSections.length > 0">
              <mat-label>Section</mat-label>
              <mat-select [(ngModel)]="filterSectionId" (selectionChange)="loadHomework()">
                <mat-option value="">All Sections</mat-option>
                <mat-option *ngFor="let s of availableSections" [value]="s.id">{{s.name}}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Status</mat-label>
              <mat-select [(ngModel)]="filterStatus" (selectionChange)="loadHomework()">
                <mat-option value="">All Statuses</mat-option>
                <mat-option value="Active">Active</mat-option>
                <mat-option value="Completed">Completed</mat-option>
                <mat-option value="Archived">Archived</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Search Title / Subject</mat-label>
              <input matInput [(ngModel)]="searchTerm" placeholder="Search..." (keyup.enter)="loadHomework()">
            </mat-form-field>

            <div class="view-toggle">
              <button mat-icon-button [class.active-view]="viewMode==='grid'" (click)="viewMode='grid'" matTooltip="Grid View">
                <mat-icon>grid_view</mat-icon>
              </button>
              <button mat-icon-button [class.active-view]="viewMode==='table'" (click)="viewMode='table'" matTooltip="Table View">
                <mat-icon>format_list_bulleted</mat-icon>
              </button>
            </div>
          </div>
        </div>

        <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

        <!-- Empty State -->
        <div class="empty-state" *ngIf="!loading && filteredItems.length === 0">
          <div class="empty-icon-wrap"><mat-icon>menu_book</mat-icon></div>
          <h3>No Homework Assigned</h3>
          <p>No homework tasks found matching the selected filters. Click "Assign Homework" to post a new worksheet or assignment.</p>
          <button mat-raised-button class="create-btn" (click)="openHomeworkDialog()">
            <mat-icon>add</mat-icon> Assign First Homework
          </button>
        </div>

        <!-- GRID VIEW -->
        <div class="hw-grid" *ngIf="!loading && viewMode==='grid' && filteredItems.length > 0">
          <div class="hw-card" *ngFor="let h of filteredItems">
            <div class="hw-card-top">
              <span class="subject-badge">{{h.subjectName || 'General'}}</span>
              <div class="top-badges">
                <span class="submissions-badge" (click)="openSubmissionsRoster(h)" matTooltip="View Student Submissions">
                  <mat-icon>task</mat-icon> {{h.totalSubmissions || 0}} Submissions
                </span>
                <span class="status-pill" [ngClass]="h.status.toLowerCase()">{{h.status}}</span>
              </div>
            </div>

            <h3 class="hw-title">{{h.title}}</h3>

            <div class="hw-meta-chips">
              <span class="meta-chip class-chip" *ngIf="h.className">
                <mat-icon>domain</mat-icon>
                {{h.className}}<span *ngIf="h.sectionName"> ({{h.sectionName}})</span>
              </span>
              <span class="meta-chip batch-chip" *ngIf="!h.className && h.batchName">
                <mat-icon>class</mat-icon> {{h.batchName}}
              </span>
              <span class="meta-chip teacher-chip" *ngIf="h.teacherName">
                <mat-icon>person</mat-icon> {{h.teacherName}}
              </span>
              <span class="meta-chip time-chip" *ngIf="h.estimatedMinutes">
                <mat-icon>timer</mat-icon> {{h.estimatedMinutes}} min
              </span>
            </div>

            <p class="hw-desc">{{h.description}}</p>

            <!-- Attachment / Worksheet file button if attached -->
            <div class="worksheet-attach-box" *ngIf="h.attachmentUrl">
              <a [href]="getFileUrl(h.attachmentUrl)" target="_blank" class="worksheet-link" [matTooltip]="h.attachmentFileName || 'Download Worksheet / Assignment File'">
                <mat-icon class="attach-lead-icon">attach_file</mat-icon>
                <div class="link-texts">
                  <span class="link-label">Worksheet / Material:</span>
                  <span class="filename">{{h.attachmentFileName || 'Download Worksheet / Assignment File'}}</span>
                </div>
                <mat-icon class="external-icon">open_in_new</mat-icon>
              </a>
            </div>

            <div class="hw-card-footer">
              <div class="hw-dates-bar">
                <div class="date-item">
                  <span class="date-lbl">Assigned:</span>
                  <span class="date-val" [appIstDatetime]="h.assignedDate"></span>
                </div>
                <div class="date-item" [class.due-alert]="isDueSoon(h.dueDate)">
                  <span class="date-lbl">Due:</span>
                  <span class="date-val" [appIstDatetime]="h.dueDate"></span>
                </div>
              </div>

              <div class="hw-actions-bar">
                <button mat-stroked-button class="view-submissions-btn" (click)="openSubmissionsRoster(h)" matTooltip="Review Student Solutions">
                  <mat-icon>fact_check</mat-icon>
                  <span>Review ({{h.totalSubmissions || 0}})</span>
                </button>
                <div class="action-btns-right">
                  <button mat-icon-button (click)="openHomeworkDialog(h)" matTooltip="Edit Assignment">
                    <mat-icon class="action-ic edit">edit</mat-icon>
                  </button>
                  <button mat-icon-button (click)="toggleComplete(h)" [matTooltip]="h.status==='Completed'?'Mark Active':'Mark Complete'">
                    <mat-icon class="action-ic complete" [class.done]="h.status==='Completed'">
                      {{h.status==='Completed' ? 'check_circle' : 'check_circle_outline'}}
                    </mat-icon>
                  </button>
                  <button mat-icon-button (click)="deleteHomework(h)" matTooltip="Delete">
                    <mat-icon class="action-ic delete">delete</mat-icon>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- TABLE VIEW -->
        <div class="hw-table-wrap" *ngIf="!loading && viewMode==='table' && filteredItems.length > 0">
          <table class="hw-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Title & Description</th>
                <th>Class / Section</th>
                <th>Teacher</th>
                <th>Worksheet</th>
                <th>Submissions</th>
                <th>Assigned Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let h of filteredItems">
                <td>
                  <span class="subject-badge">{{h.subjectName}}</span>
                </td>
                <td>
                  <div class="tbl-title">{{h.title}}</div>
                  <div class="tbl-desc">{{h.description}}</div>
                </td>
                <td>
                  <span *ngIf="h.className">{{h.className}}<span *ngIf="h.sectionName"> - {{h.sectionName}}</span></span>
                  <span *ngIf="!h.className && h.batchName">{{h.batchName}}</span>
                </td>
                <td>{{h.teacherName || '—'}}</td>
                <td>
                  <a *ngIf="h.attachmentUrl" [href]="getFileUrl(h.attachmentUrl)" target="_blank" class="tbl-file-link" matTooltip="Open Worksheet">
                    <mat-icon>attachment</mat-icon>
                    <span>File</span>
                  </a>
                  <span *ngIf="!h.attachmentUrl" class="text-muted">—</span>
                </td>
                <td>
                  <button mat-stroked-button class="tbl-submissions-btn" (click)="openSubmissionsRoster(h)">
                    <mat-icon>how_to_reg</mat-icon>
                    <span>{{h.totalSubmissions || 0}} Submissions</span>
                  </button>
                </td>
                <td><span [appIstDatetime]="h.assignedDate"></span></td>
                <td>
                  <span [class.due-alert-text]="isDueSoon(h.dueDate)" [appIstDatetime]="h.dueDate"></span>
                </td>
                <td>
                  <span class="status-pill" [ngClass]="h.status.toLowerCase()">{{h.status}}</span>
                </td>
                <td>
                  <div class="tbl-actions">
                    <button mat-icon-button (click)="openHomeworkDialog(h)" matTooltip="Edit">
                      <mat-icon class="action-ic edit">edit</mat-icon>
                    </button>
                    <button mat-icon-button (click)="toggleComplete(h)" matTooltip="Toggle Status">
                      <mat-icon class="action-ic complete">{{h.status==='Completed'?'check_circle':'check_circle_outline'}}</mat-icon>
                    </button>
                    <button mat-icon-button (click)="deleteHomework(h)" matTooltip="Delete">
                      <mat-icon class="action-ic delete">delete</mat-icon>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ng-container>

      <!-- STUDENT PORTAL VIEW (MY HOMEWORK & ASSIGNMENTS) -->
      <ng-container *ngIf="activeTab === 'student'">
        <div class="student-portal-banner">
          <div class="banner-main">
            <div class="banner-icon"><mat-icon>backpack</mat-icon></div>
            <div class="banner-text">
              <h3>My Homework & Assignment Solutions</h3>
              <p>View assignments posted by your subject teachers, download worksheets, and upload your completed solution copy.</p>
            </div>
          </div>

          <!-- Preview as Student (Teacher/Admin view switcher: Class -> Section -> Student) -->
          <div class="student-preview-switcher" *ngIf="!isStudentOrParent">
            <div class="preview-badge">
              <mat-icon>school</mat-icon>
              <span>Student Preview:</span>
            </div>

            <!-- Class Select -->
            <mat-form-field appearance="outline" class="preview-select-field class-field" [matTooltip]="(isTeacher && !isAdmin && hasAssignedClass) ? '🔒 Assigned class for your teaching profile (Locked)' : ''">
              <mat-label>Class (कक्षा) <span *ngIf="isTeacher && !isAdmin && hasAssignedClass">🔒</span></mat-label>
              <mat-select [(ngModel)]="previewClassId" (selectionChange)="onPreviewClassChange()" [disabled]="isTeacher && !isAdmin && hasAssignedClass">
                <mat-option *ngFor="let c of classes" [value]="c.id">{{c.name}}</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Section Select -->
            <mat-form-field appearance="outline" class="preview-select-field section-field" *ngIf="previewSections.length > 0" [matTooltip]="(isTeacher && !isAdmin && hasAssignedSection) ? '🔒 Assigned section locked' : ''">
              <mat-label>Section (वर्ग) <span *ngIf="isTeacher && !isAdmin && hasAssignedSection">🔒</span></mat-label>
              <mat-select [(ngModel)]="previewSectionId" (selectionChange)="onPreviewSectionChange()" [disabled]="isTeacher && !isAdmin && hasAssignedSection">
                <mat-option value="">All Sections</mat-option>
                <mat-option *ngFor="let s of previewSections" [value]="s.id">{{s.name}}</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Student Select -->
            <mat-form-field appearance="outline" class="preview-select-field student-field">
              <mat-label>Student (विद्यार्थी)</mat-label>
              <mat-select [(ngModel)]="selectedPreviewStudentId" (selectionChange)="onPreviewStudentChange()" [disabled]="previewStudents.length === 0">
                <mat-option *ngIf="previewStudents.length === 0" value="">No Students Found</mat-option>
                <mat-option *ngFor="let s of previewStudents" [value]="s.id">
                  {{s.studentName}} <span *ngIf="s.rollNumber">(Roll: {{s.rollNumber}})</span>
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>

        <!-- Student Sub-Filter Tabs Bar -->
        <div class="student-tabs-bar" *ngIf="!loadingStudent && studentHomeworks.length > 0">
          <div class="filter-pills">
            <button class="filter-tab-pill" [class.active]="studentFilterStatus === 'all'" (click)="studentFilterStatus = 'all'">
              <mat-icon>assignment</mat-icon>
              <span>All Homework ({{studentHomeworks.length}})</span>
            </button>
            <button class="filter-tab-pill pending" [class.active]="studentFilterStatus === 'pending'" (click)="studentFilterStatus = 'pending'">
              <mat-icon>pending_actions</mat-icon>
              <span>Pending Submission ({{pendingHomeworkCount}})</span>
            </button>
            <button class="filter-tab-pill submitted" [class.active]="studentFilterStatus === 'submitted'" (click)="studentFilterStatus = 'submitted'">
              <mat-icon>check_circle</mat-icon>
              <span>Submitted ({{submittedHomeworkCount}})</span>
            </button>
          </div>
        </div>

        <!-- VISIBLE STUDENT LOADER -->
        <div class="student-loading-container" *ngIf="loadingStudent">
          <div class="student-loader-spinner"></div>
          <div class="loader-text-box">
            <h4>Loading Homework for Selected Student...</h4>
            <p>Fetching assigned worksheets, instructions & submission copy status</p>
          </div>
        </div>

        <!-- Empty state for student -->
        <div class="empty-state" *ngIf="!loadingStudent && filteredStudentHomeworks.length === 0">
          <div class="empty-icon-wrap"><mat-icon>sentiment_satisfied_alt</mat-icon></div>
          <h3>{{studentFilterStatus === 'pending' ? 'No Homework Pending!' : (studentFilterStatus === 'submitted' ? 'No Submitted Homework' : 'No Homework Assigned')}}</h3>
          <p>{{studentFilterStatus === 'pending' ? 'Awesome! You have completed and submitted all assigned homework.' : (studentFilterStatus === 'submitted' ? 'You have not submitted any homework solutions yet.' : 'Check back later for updates from your teachers.')}}</p>
        </div>

        <!-- Student Homework Cards Grid -->
        <div class="student-hw-grid" *ngIf="!loadingStudent && filteredStudentHomeworks.length > 0">
          <div class="student-hw-card" *ngFor="let sh of filteredStudentHomeworks" [class.is-submitted]="sh.isSubmitted">
            <div class="student-card-header">
              <div class="header-badges">
                <span class="subject-badge">{{sh.subjectName}}</span>
                <span class="meta-chip teacher-chip" *ngIf="sh.teacherName">
                  <mat-icon>person</mat-icon> {{sh.teacherName}}
                </span>
              </div>
              <div>
                <span class="submission-status-pill" [ngClass]="sh.isSubmitted ? (sh.mySubmission?.status?.toLowerCase() || 'submitted') : 'pending'">
                  <mat-icon class="pill-icon">{{sh.isSubmitted ? 'check_circle' : 'pending'}}</mat-icon>
                  <span>{{sh.isSubmitted ? (sh.mySubmission?.status || 'Submitted') : 'Pending Submission'}}</span>
                </span>
              </div>
            </div>

            <h3 class="student-hw-title">{{sh.title}}</h3>
            <p class="student-hw-desc">{{sh.description}}</p>

            <!-- Teacher Worksheet Attached -->
            <div class="worksheet-attach-box" *ngIf="sh.attachmentUrl">
              <a [href]="getFileUrl(sh.attachmentUrl)" target="_blank" class="worksheet-link" [matTooltip]="sh.attachmentFileName || 'Download Assignment Material'">
                <mat-icon class="attach-lead-icon">download_for_offline</mat-icon>
                <div class="link-texts">
                  <span class="link-label">Teacher's Worksheet / Questions:</span>
                  <span class="filename">{{sh.attachmentFileName || 'Download Assignment Material'}}</span>
                </div>
                <mat-icon class="external-icon">open_in_new</mat-icon>
              </a>
            </div>

            <!-- Submission Details Card if submitted -->
            <div class="submission-details-box" *ngIf="sh.isSubmitted && sh.mySubmission">
              <div class="sub-header">
                <span class="sub-label"><mat-icon>task</mat-icon> Your Submitted Solution:</span>
                <span class="sub-date" [appIstDatetime]="sh.mySubmission.submissionDate"></span>
              </div>
              <div class="sub-file-row">
                <a [href]="getFileUrl(sh.mySubmission.submissionFileUrl)" target="_blank" class="sub-file-link" [matTooltip]="sh.mySubmission.submissionFileName || 'View Solution Copy'">
                  <mat-icon>description</mat-icon>
                  <span class="sub-filename">{{sh.mySubmission.submissionFileName || 'View Solution Copy'}}</span>
                  <mat-icon class="ext-sm">open_in_new</mat-icon>
                </a>
              </div>
              <div class="sub-remarks" *ngIf="sh.mySubmission.studentRemarks">
                <strong>Your Notes:</strong> <span>{{sh.mySubmission.studentRemarks}}</span>
              </div>

              <!-- Teacher Review Feedback if graded -->
              <div class="teacher-feedback-card" *ngIf="sh.mySubmission.status === 'Approved' || sh.mySubmission.status === 'NeedsCorrection' || sh.mySubmission.gradeOrMarks || sh.mySubmission.teacherRemarks">
                <div class="feedback-title">
                  <mat-icon>rate_review</mat-icon>
                  <span>Teacher Review & Feedback</span>
                  <span class="grade-badge" *ngIf="sh.mySubmission.gradeOrMarks">Grade: {{sh.mySubmission.gradeOrMarks}}</span>
                </div>
                <p class="feedback-text" *ngIf="sh.mySubmission.teacherRemarks">{{sh.mySubmission.teacherRemarks}}</p>
                <small class="feedback-meta" *ngIf="sh.mySubmission.reviewedByTeacherName">
                  Reviewed by {{sh.mySubmission.reviewedByTeacherName}}
                </small>
              </div>
            </div>

            <div class="student-card-footer">
              <div class="due-info" [class.due-alert]="!sh.isSubmitted && isDueSoon(sh.dueDate)">
                <span class="due-lbl">Due Date:</span>
                <span class="due-val" [appIstDatetime]="sh.dueDate"></span>
              </div>

              <div class="student-action">
                <button mat-raised-button class="submit-solution-btn" (click)="openStudentSubmitDialog(sh)">
                  <mat-icon>{{sh.isSubmitted ? 'edit' : 'upload_file'}}</mat-icon>
                  <span>{{sh.isSubmitted ? 'Re-upload / Update Solution' : 'Upload & Submit Solution'}}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .hw-page-container { padding: 0 0 40px; display: flex; flex-direction: column; gap: 20px; box-sizing: border-box; width: 100%; }
    .page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; background: #fff; padding: 20px 24px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-icon-box { width: 48px; height: 48px; border-radius: 12px; background: #2563eb; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25); }
    .page-title { margin: 0; font-size: 20px; font-weight: 800; color: #1e3a8a; }
    .page-subtitle { margin: 4px 0 0; font-size: 13px; color: #64748b; }
    .header-actions { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .create-btn { background: #2563eb !important; color: #fff !important; font-weight: 700; padding: 0 20px; height: 42px; border-radius: 8px; }
    .refresh-btn { border-color: #cbd5e1; color: #475569; height: 42px; border-radius: 8px; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    /* Role switcher pills */
    .role-view-switch { display: flex; background: #f1f5f9; padding: 4px; border-radius: 10px; border: 1px solid #cbd5e1; gap: 4px; }
    .switch-pill { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border: none; background: transparent; color: #64748b; font-weight: 600; font-size: 13px; border-radius: 8px; cursor: pointer; transition: all 0.15s; }
    .switch-pill.active { background: #ffffff; color: #1e40af; font-weight: 700; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .switch-pill mat-icon { font-size: 18px; width: 18px; height: 18px; }

    /* Stats Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .stat-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; display: flex; align-items: center; gap: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .stat-icon-wrap { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .stat-icon-wrap.blue { background: #eff6ff; color: #2563eb; }
    .stat-icon-wrap.amber { background: #fffbeb; color: #d97706; }
    .stat-icon-wrap.green { background: #f0fdf4; color: #16a34a; }
    .stat-icon-wrap.purple { background: #faf5ff; color: #9333ea; }
    .stat-value { font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1.1; }
    .stat-label { font-size: 12px; font-weight: 600; color: #64748b; margin-top: 2px; }

    /* Filter Card */
    .filter-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .filter-row { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
    .filter-field { flex: 1; min-width: 180px; }
    .filter-field ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    .view-toggle { display: flex; gap: 4px; background: #f1f5f9; padding: 4px; border-radius: 8px; border: 1px solid #cbd5e1; }
    .view-toggle button { color: #64748b; border-radius: 6px; }
    .active-view { background: #fff !important; color: #2563eb !important; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

    /* Grid Layout */
    .hw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 18px; }
    .hw-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); transition: transform 0.15s, box-shadow 0.15s; min-width: 0; max-width: 100%; box-sizing: border-box; overflow: hidden; }
    .hw-card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.08); border-color: #cbd5e1; }
    .hw-card-top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
    .top-badges { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .subject-badge { background: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #bfdbfe; flex-shrink: 0; }
    .submissions-badge { background: #f0fdf4; color: #166534; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 20px; border: 1px solid #bbf7d0; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; transition: background 0.15s; flex-shrink: 0; }
    .submissions-badge:hover { background: #dcfce7; }
    .submissions-badge mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .status-pill { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; text-transform: capitalize; flex-shrink: 0; }
    .status-pill.active { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
    .status-pill.completed { background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; }
    .status-pill.archived { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .hw-title { margin: 0; font-size: 15px; font-weight: 700; color: #1e293b; line-height: 1.3; word-break: break-word; }
    .hw-meta-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .meta-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; }
    .meta-chip mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .class-chip { background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; }
    .teacher-chip { background: #faf5ff; color: #7e22ce; border: 1px solid #f3e8ff; }
    .time-chip { background: #fffbeb; color: #b45309; border: 1px solid #fef3c7; }
    .hw-desc { margin: 0; font-size: 13px; color: #475569; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }

    /* Worksheet attachment link box */
    .worksheet-attach-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
      overflow: hidden;
      transition: all 0.15s ease;
    }
    .worksheet-attach-box:hover {
      background: #eff6ff;
      border-color: #bfdbfe;
    }
    .worksheet-link {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #2563eb;
      text-decoration: none;
      font-size: 12px;
      font-weight: 600;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }
    .worksheet-link:hover { text-decoration: none; }
    .attach-lead-icon { font-size: 20px; width: 20px; height: 20px; color: #2563eb; flex-shrink: 0; }
    .worksheet-link .link-texts {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
      gap: 1px;
      overflow: hidden;
    }
    .worksheet-link .link-label {
      font-size: 11px;
      font-weight: 700;
      color: #2563eb;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.3;
    }
    .worksheet-link .filename {
      font-size: 12px;
      font-weight: 600;
      color: #1e40af;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      line-height: 1.3;
    }
    .external-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #94a3b8;
      flex-shrink: 0;
      margin-left: auto;
      transition: color 0.15s ease;
    }
    .worksheet-attach-box:hover .external-icon { color: #2563eb; }

    .hw-card-footer { margin-top: auto; border-top: 1px solid #f1f5f9; padding-top: 10px; display: flex; flex-direction: column; gap: 8px; }
    .hw-dates-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11.5px; background: #f8fafc; padding: 6px 10px; border-radius: 6px; border: 1px solid #f1f5f9; }
    .date-item { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; flex-shrink: 0; }
    .date-lbl { color: #64748b; font-weight: 600; white-space: nowrap; }
    .date-val { color: #1e293b; font-weight: 700; white-space: nowrap; }
    .due-alert .date-val { color: #dc2626; font-weight: 800; }
    .due-alert-text { color: #dc2626; font-weight: 700; white-space: nowrap; }
    .hw-actions-bar { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .action-btns-right { display: flex; align-items: center; gap: 2px; }
    .view-submissions-btn { height: 32px; font-size: 11px; font-weight: 700; color: #2563eb; border-color: #bfdbfe; background: #eff6ff; display: inline-flex; align-items: center; gap: 4px; padding: 0 10px; }
    .view-submissions-btn:hover { background: #dbeafe; }
    .view-submissions-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .action-ic { font-size: 18px; width: 18px; height: 18px; }
    .action-ic.edit { color: #2563eb; }
    .action-ic.complete { color: #16a34a; }
    .action-ic.complete.done { color: #059669; }
    .action-ic.delete { color: #ef4444; }

    /* Table Layout */
    .hw-table-wrap { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .hw-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    .hw-table th { background: #f8fafc; color: #475569; font-weight: 700; padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .hw-table td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; color: #1e293b; vertical-align: middle; }
    .hw-table tr:hover { background: #f8fafc; }
    .tbl-title { font-weight: 700; color: #1e293b; }
    .tbl-desc { font-size: 12px; color: #64748b; margin-top: 2px; max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tbl-file-link { display: inline-flex; align-items: center; gap: 4px; color: #2563eb; font-weight: 600; text-decoration: none; }
    .tbl-file-link:hover { text-decoration: underline; }
    .tbl-file-link mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .tbl-submissions-btn { height: 30px; font-size: 11px; font-weight: 700; color: #0f766e; border-color: #99f6e4; background: #f0fdfa; display: inline-flex; align-items: center; gap: 4px; padding: 0 8px; }
    .tbl-submissions-btn mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .tbl-actions { display: flex; gap: 4px; }
    .text-muted { color: #94a3b8; }

    /* Student Portal Banner & Filter Tabs */
    .student-portal-banner {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .banner-main { display: flex; align-items: center; gap: 16px; }
    .banner-icon { width: 44px; height: 44px; border-radius: 10px; background: #2563eb; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.2); flex-shrink: 0; }
    .banner-text h3 { margin: 0; font-size: 16px; font-weight: 800; color: #1e3a8a; }
    .banner-text p { margin: 3px 0 0; font-size: 13px; color: #3b82f6; }

    .student-preview-switcher {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(4px);
      padding: 6px 14px;
      border-radius: 10px;
      border: 1px solid #bfdbfe;
      box-shadow: 0 1px 3px rgba(37,99,235,0.08);
      flex-wrap: wrap;
    }
    .preview-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #1e40af; white-space: nowrap; }
    .preview-badge mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
    .preview-select-field { width: 175px; }
    .preview-select-field.class-field { width: 190px; }
    .preview-select-field.section-field { width: 175px; }
    .preview-select-field.student-field { width: 310px; }
    .preview-select-field ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    .preview-select-field ::ng-deep .mat-mdc-text-field-wrapper { height: 42px; background: #fff !important; }
    .preview-select-field ::ng-deep .mat-mdc-form-field-flex { height: 42px; align-items: center; }

    .student-tabs-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: #fff;
      padding: 10px 16px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .filter-pills { display: flex; gap: 8px; flex-wrap: wrap; }
    .filter-tab-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #64748b;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .filter-tab-pill:hover { background: #f1f5f9; color: #1e293b; }
    .filter-tab-pill.active { background: #2563eb; color: #fff; border-color: #2563eb; font-weight: 700; }
    .filter-tab-pill.pending.active { background: #d97706; color: #fff; border-color: #d97706; }
    .filter-tab-pill.submitted.active { background: #16a34a; color: #fff; border-color: #16a34a; }
    .filter-tab-pill mat-icon { font-size: 16px; width: 16px; height: 16px; }

    /* Student Grid Layout */
    .student-hw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 18px; }
    .student-hw-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.04);
      transition: transform 0.15s, box-shadow 0.15s;
      min-width: 0;
      max-width: 100%;
      box-sizing: border-box;
      overflow: hidden;
    }
    .student-hw-card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.08); }
    .student-hw-card.is-submitted { border-left: 4px solid #10b981; }
    .student-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
    .header-badges { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .submission-status-pill { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: capitalize; flex-shrink: 0; }
    .submission-status-pill.pending { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
    .submission-status-pill.submitted { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .submission-status-pill.approved { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .submission-status-pill.needscorrection { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
    .pill-icon { font-size: 14px; width: 14px; height: 14px; }
    .student-hw-title { margin: 0; font-size: 16px; font-weight: 700; color: #1e293b; line-height: 1.3; word-break: break-word; }
    .student-hw-desc { margin: 0; font-size: 13px; color: #475569; line-height: 1.5; white-space: pre-line; word-break: break-word; }

    /* Student Submission Details Box */
    .submission-details-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 12px;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
      overflow: hidden;
    }
    .sub-header { display: flex; justify-content: space-between; align-items: center; font-weight: 700; color: #0f172a; flex-wrap: wrap; gap: 6px; }
    .sub-label { display: flex; align-items: center; gap: 4px; color: #059669; }
    .sub-label mat-icon { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; }
    .sub-date { color: #64748b; font-size: 11px; font-weight: 500; }
    .sub-file-row { display: flex; align-items: center; max-width: 100%; min-width: 0; }
    .sub-file-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #2563eb;
      text-decoration: none;
      font-weight: 700;
      background: #fff;
      padding: 5px 10px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
      transition: all 0.15s ease;
    }
    .sub-file-link:hover { background: #eff6ff; border-color: #93c5fd; }
    .sub-file-link mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2563eb; flex-shrink: 0; }
    .sub-file-link .sub-filename {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      flex: 1;
    }
    .ext-sm { font-size: 12px; width: 12px; height: 12px; color: #94a3b8; flex-shrink: 0; margin-left: 4px; }
    .sub-remarks { color: #475569; word-break: break-word; overflow-wrap: break-word; }

    /* Teacher Feedback Card */
    .teacher-feedback-card {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 4px;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }
    .feedback-title { display: flex; align-items: center; gap: 6px; font-weight: 700; color: #1e40af; font-size: 12px; flex-wrap: wrap; }
    .feedback-title mat-icon { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; }
    .grade-badge { margin-left: auto; background: #2563eb; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 800; }
    .feedback-text { margin: 2px 0 0; color: #1e3a8a; font-size: 12px; word-break: break-word; }
    .feedback-meta { color: #64748b; font-size: 11px; }

    .student-card-footer { margin-top: auto; border-top: 1px solid #f1f5f9; padding-top: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
    .due-info { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; white-space: nowrap; }
    .due-lbl { color: #64748b; font-weight: 600; white-space: nowrap; }
    .due-val { color: #1e293b; font-weight: 700; white-space: nowrap; }
    .submit-solution-btn { background: #2563eb !important; color: #fff !important; font-weight: 700; border-radius: 8px; font-size: 12px; height: 36px; white-space: nowrap; }

    /* Prominent Student Loader */
    .student-loading-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 55px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      min-height: 220px;
    }
    .student-loader-spinner {
      width: 44px;
      height: 44px;
      border: 4px solid #eff6ff;
      border-top: 4px solid #2563eb;
      border-radius: 50%;
      animation: studentSpin 0.75s linear infinite;
    }
    @keyframes studentSpin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .loader-text-box { text-align: center; }
    .loader-text-box h4 { margin: 0; font-size: 15px; font-weight: 700; color: #1e3a8a; }
    .loader-text-box p { margin: 4px 0 0; font-size: 12.5px; color: #64748b; }

    /* Empty state */
    .empty-state { background: #fff; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 60px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .empty-icon-wrap { width: 64px; height: 64px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; }
    .empty-icon-wrap mat-icon { font-size: 32px; width: 32px; height: 32px; }
    .empty-state h3 { margin: 0; font-size: 18px; color: #1e293b; font-weight: 700; }
    .empty-state p { margin: 0; font-size: 13px; color: #64748b; max-width: 440px; }

    /* ========================================================================= */
    /* RESPONSIVE BREAKPOINTS (ALL MODES: DESKTOP, LAPTOP, TABLET, MOBILE) */
    /* ========================================================================= */
    @media (max-width: 1024px) {
      .student-hw-grid, .hw-grid {
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
        gap: 14px;
      }
    }

    @media (max-width: 768px) {
      .page-header {
        padding: 16px;
        flex-direction: column;
        align-items: stretch;
        gap: 14px;
      }
      .header-actions {
        width: 100%;
        justify-content: flex-start;
      }
      .role-view-switch {
        width: 100%;
        display: flex;
      }
      .switch-pill {
        flex: 1;
        justify-content: center;
      }

      .student-portal-banner {
        padding: 14px 16px;
        flex-direction: column;
        align-items: stretch;
      }
      .student-preview-switcher {
        width: 100%;
        box-sizing: border-box;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }
      .preview-select-field,
      .preview-select-field.class-field,
      .preview-select-field.section-field,
      .preview-select-field.student-field {
        width: 100% !important;
      }

      .student-tabs-bar {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
        padding: 10px 12px;
      }
      .filter-pills {
        overflow-x: auto;
        padding-bottom: 4px;
        width: 100%;
        flex-wrap: nowrap;
      }
      .filter-tab-pill {
        white-space: nowrap;
        flex-shrink: 0;
      }

      .filter-card {
        padding: 14px 16px;
      }
      .filter-row {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }
      .filter-field {
        width: 100%;
        min-width: 100%;
      }
      .view-toggle {
        width: 100%;
        justify-content: center;
      }

      .student-hw-grid, .hw-grid {
        grid-template-columns: 1fr;
        gap: 14px;
      }
    }

    @media (max-width: 480px) {
      .stats-grid {
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .stat-card {
        padding: 12px 14px;
        gap: 10px;
      }
      .stat-icon-wrap {
        width: 36px;
        height: 36px;
      }
      .stat-value {
        font-size: 20px;
      }
      .student-hw-card, .hw-card {
        padding: 14px 16px;
      }
      .student-card-footer {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }
      .student-action {
        width: 100%;
      }
      .submit-solution-btn {
        width: 100%;
        justify-content: center;
      }
      .hw-actions-bar {
        flex-wrap: wrap;
      }
      .view-submissions-btn {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class HomeworkDiaryComponent implements OnInit {
  homeworkList: StudentHomeworkDto[] = [];
  studentHomeworks: StudentHomeworkWithSubmissionDto[] = [];
  classes: any[] = [];
  availableSections: any[] = [];
  teachers: any[] = [];
  subjects: any[] = [];

  loading = false;
  loadingStudent = false;
  viewMode: 'grid' | 'table' = 'grid';
  activeTab: 'teacher' | 'student' = 'teacher';

  filterClassId = '';
  filterSectionId = '';
  filterStatus = '';
  searchTerm = '';

  stats: HomeworkStatsDto = {
    totalActive: 0,
    dueToday: 0,
    assignedToday: 0,
    completed: 0
  };

  previewClassId = '';
  previewSectionId = '';
  previewSections: any[] = [];
  previewStudents: any[] = [];
  selectedPreviewStudentId = '';
  studentFilterStatus: 'all' | 'pending' | 'submitted' = 'all';

  hasAssignedClass = false;
  hasAssignedSection = false;

  get isAdmin(): boolean {
    const role = (this.authService.currentUser()?.role || '').toLowerCase();
    return role.includes('admin') || role.includes('super');
  }

  get isTeacher(): boolean {
    const role = (this.authService.currentUser()?.role || '').toLowerCase();
    return role.includes('teacher') || role.includes('faculty') || (!this.isAdmin && this.hasAssignedClass);
  }

  get pendingHomeworkCount(): number {
    return this.studentHomeworks.filter(h => !h.isSubmitted).length;
  }

  get submittedHomeworkCount(): number {
    return this.studentHomeworks.filter(h => h.isSubmitted).length;
  }

  get filteredStudentHomeworks(): StudentHomeworkWithSubmissionDto[] {
    if (this.studentFilterStatus === 'pending') {
      return this.studentHomeworks.filter(h => !h.isSubmitted);
    }
    if (this.studentFilterStatus === 'submitted') {
      return this.studentHomeworks.filter(h => h.isSubmitted);
    }
    return this.studentHomeworks;
  }

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService,
    public authService: AuthService
  ) {}

  get isStudentOrParent(): boolean {
    const role = this.authService.currentUser()?.role;
    return role === 'Student' || role === 'Parent';
  }

  ngOnInit(): void {
    if (this.isStudentOrParent) {
      this.activeTab = 'student';
      this.loadStudentHomework();
    } else {
      this.activeTab = 'teacher';
      this.loadClasses();
      this.loadTeachers();
      this.loadSubjects();
      this.loadStats();
      this.loadHomework();
    }
  }

  initTeacherPreviewClass(): void {
    const user: any = this.authService.currentUser();
    const userId = user?.userId || user?.id;
    const userFullName = (user?.fullName || user?.name || '').trim().toLowerCase();

    const teacher = this.teachers?.find(t =>
      (userId && t.userId && t.userId === userId) ||
      (userFullName && t.fullName && t.fullName.trim().toLowerCase() === userFullName) ||
      (userFullName && t.name && t.name.trim().toLowerCase() === userFullName)
    );

    let assignedClassId = '';
    let assignedSectionId = '';

    if (this.classes?.length) {
      for (const c of this.classes) {
        const sec = c.sections?.find((s: any) =>
          (teacher && s.classTeacherId && s.classTeacherId === teacher.id) ||
          (teacher?.fullName && s.classTeacherName && s.classTeacherName.trim().toLowerCase() === teacher.fullName.trim().toLowerCase()) ||
          (teacher?.name && s.classTeacherName && s.classTeacherName.trim().toLowerCase() === teacher.name.trim().toLowerCase())
        );
        if (sec) {
          assignedClassId = c.id;
          assignedSectionId = sec.id;
          break;
        }
      }
    }

    if (assignedClassId) {
      this.previewClassId = assignedClassId;
      this.hasAssignedClass = true;
      if (assignedSectionId) {
        this.previewSectionId = assignedSectionId;
        this.hasAssignedSection = true;
      }
    } else if (this.classes?.length > 0) {
      this.previewClassId = this.classes[0].id;
      this.previewSectionId = '';
      this.hasAssignedClass = false;
      this.hasAssignedSection = false;
    }

    const foundClass = this.classes.find(c => c.id === this.previewClassId);
    this.previewSections = foundClass?.sections || [];

    this.fetchStudentsForPreview();
  }

  onPreviewClassChange(): void {
    const foundClass = this.classes.find(c => c.id === this.previewClassId);
    this.previewSections = foundClass?.sections || [];
    this.previewSectionId = '';
    this.studentHomeworks = [];
    this.fetchStudentsForPreview(true);
  }

  onPreviewSectionChange(): void {
    this.studentHomeworks = [];
    this.fetchStudentsForPreview(true);
  }

  fetchStudentsForPreview(withMinDelay = false): void {
    if (!this.previewClassId) return;
    this.loadingStudent = true;
    let url = `${API_BASE}/homework/preview-students?classId=${this.previewClassId}`;
    if (this.previewSectionId) {
      url += `&sectionId=${this.previewSectionId}`;
    }

    this.http.get<any[]>(url).subscribe({
      next: r => {
        this.previewStudents = r || [];
        if (this.previewStudents.length > 0) {
          this.selectedPreviewStudentId = this.previewStudents[0].id;
        } else {
          this.selectedPreviewStudentId = '';
        }
        this.loadStudentHomework(withMinDelay);
      },
      error: () => {
        this.previewStudents = [];
        this.selectedPreviewStudentId = '';
        this.loadStudentHomework(withMinDelay);
      }
    });
  }

  onPreviewStudentChange(): void {
    this.studentHomeworks = [];
    this.loadStudentHomework(true);
  }

  setTab(tab: 'teacher' | 'student'): void {
    this.activeTab = tab;
    if (tab === 'student') {
      if (!this.isStudentOrParent) {
        if (!this.previewClassId && this.classes.length > 0) {
          this.initTeacherPreviewClass();
        } else if (this.selectedPreviewStudentId) {
          this.loadStudentHomework();
        } else if (this.previewClassId) {
          this.fetchStudentsForPreview();
        }
      } else {
        this.loadStudentHomework();
      }
    } else {
      this.loadHomework();
    }
  }

  refreshCurrentView(): void {
    if (this.activeTab === 'student') {
      this.loadStudentHomework();
    } else {
      this.loadHomework();
    }
  }

  getFileUrl(url?: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    return `http://localhost:5000${url.startsWith('/') ? '' : '/'}${url}`;
  }

  loadClasses(): void {
    this.http.get<any[]>(`${API_BASE}/school/classes`).subscribe({
      next: r => {
        this.classes = r;
        if (!this.previewClassId && this.classes.length > 0) {
          this.initTeacherPreviewClass();
        }
      },
      error: () => this.classes = []
    });
  }

  loadTeachers(): void {
    this.http.get<any[]>(`${API_BASE}/teachers`).subscribe({
      next: r => {
        this.teachers = r;
        if (!this.previewClassId && this.classes.length > 0) {
          this.initTeacherPreviewClass();
        }
      },
      error: () => this.teachers = []
    });
  }

  loadSubjects(): void {
    this.http.get<any[]>(`${API_BASE}/subjects`).subscribe({
      next: r => this.subjects = r,
      error: () => this.subjects = []
    });
  }

  onClassChange(): void {
    this.filterSectionId = '';
    const found = this.classes.find(c => c.id === this.filterClassId);
    this.availableSections = found?.sections || [];
    this.loadHomework();
  }

  loadStats(): void {
    this.http.get<HomeworkStatsDto>(`${API_BASE}/homework/stats`).subscribe({
      next: s => this.stats = s,
      error: () => {}
    });
  }

  loadHomework(): void {
    this.loading = true;
    let url = `${API_BASE}/homework`;
    const params: string[] = [];
    if (this.filterClassId) params.push(`classId=${this.filterClassId}`);
    if (this.filterSectionId) params.push(`sectionId=${this.filterSectionId}`);
    if (this.filterStatus) params.push(`status=${this.filterStatus}`);
    if (params.length > 0) url += '?' + params.join('&');

    this.http.get<StudentHomeworkDto[]>(url).subscribe({
      next: r => {
        this.homeworkList = r;
        this.loading = false;
        this.loadStats();
      },
      error: () => {
        this.homeworkList = [];
        this.loading = false;
      }
    });
  }

  loadStudentHomework(withMinDelay = false): void {
    this.loadingStudent = true;
    let url = `${API_BASE}/homework/my-homework`;
    if (this.selectedPreviewStudentId) {
      url += `?studentId=${this.selectedPreviewStudentId}`;
    }

    const startTime = Date.now();
    this.http.get<StudentHomeworkWithSubmissionDto[]>(url).subscribe({
      next: r => {
        const elapsed = Date.now() - startTime;
        const remainingDelay = withMinDelay ? Math.max(0, 450 - elapsed) : 0;
        setTimeout(() => {
          this.studentHomeworks = r;
          this.loadingStudent = false;
        }, remainingDelay);
      },
      error: () => {
        const elapsed = Date.now() - startTime;
        const remainingDelay = withMinDelay ? Math.max(0, 450 - elapsed) : 0;
        setTimeout(() => {
          this.studentHomeworks = [];
          this.loadingStudent = false;
        }, remainingDelay);
      }
    });
  }

  get filteredItems(): StudentHomeworkDto[] {
    if (!this.searchTerm.trim()) return this.homeworkList;
    const s = this.searchTerm.toLowerCase().trim();
    return this.homeworkList.filter(h =>
      h.title.toLowerCase().includes(s) ||
      h.subjectName.toLowerCase().includes(s) ||
      h.description.toLowerCase().includes(s)
    );
  }

  isDueSoon(dueDate: string): boolean {
    if (!dueDate) return false;
    const due = new Date(dueDate).getTime();
    const now = Date.now();
    const diffHours = (due - now) / (1000 * 3600);
    return diffHours <= 24;
  }

  openHomeworkDialog(item?: StudentHomeworkDto): void {
    const ref = this.dialog.open(HomeworkFormDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      disableClose: false,
      data: {
        homework: item,
        classes: this.classes,
        teachers: this.teachers,
        subjects: this.subjects,
        currentUser: this.authService.currentUser()
      }
    });

    ref.afterClosed().subscribe((res: any) => {
      if (!res) return;
      this.loadHomework();
      if (res.action === 'created') {
        this.confirmDialog.alert(
          'Homework Assigned 🎉',
          `Homework "${res.title}" has been assigned and published successfully!`,
          'success'
        );
      } else if (res.action === 'updated') {
        this.confirmDialog.alert(
          'Homework Updated 🎉',
          `Assignment "${res.title}" details updated successfully!`,
          'success'
        );
      }
    });
  }

  openSubmissionsRoster(homework: StudentHomeworkDto): void {
    this.dialog.open(HomeworkSubmissionsDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      data: homework
    }).afterClosed().subscribe(() => {
      this.loadHomework();
    });
  }

  openStudentSubmitDialog(homework: StudentHomeworkWithSubmissionDto): void {
    this.dialog.open(StudentHomeworkSubmitDialogComponent, {
      width: '580px',
      maxWidth: '95vw',
      data: {
        homework,
        studentId: this.selectedPreviewStudentId || undefined
      }
    }).afterClosed().subscribe((res: any) => {
      if (res?.submitted) {
        this.loadStudentHomework();
      }
    });
  }

  toggleComplete(h: StudentHomeworkDto): void {
    const newStatus = h.status === 'Completed' ? 'Active' : 'Completed';
    this.http.put(`${API_BASE}/homework/${h.id}`, {
      title: h.title,
      description: h.description,
      dueDate: h.dueDate,
      status: newStatus,
      attachmentUrl: h.attachmentUrl,
      attachmentFileName: h.attachmentFileName,
      estimatedMinutes: h.estimatedMinutes
    }).subscribe({
      next: () => {
        this.loadHomework();
        this.confirmDialog.alert(
          'Status Updated',
          `Homework "${h.title}" marked as ${newStatus}.`,
          'success'
        );
      },
      error: () => this.confirmDialog.alert('Error', 'Failed to update status.', 'danger')
    });
  }

  deleteHomework(h: StudentHomeworkDto): void {
    this.confirmDialog.confirm(
      'Delete Homework Assignment',
      `Are you sure you want to permanently delete "${h.title}"?`,
      'Delete Assignment',
      'Cancel',
      'danger'
    ).subscribe(ok => {
      if (!ok) return;
      this.http.delete(`${API_BASE}/homework/${h.id}`).subscribe({
        next: () => {
          this.loadHomework();
          this.confirmDialog.alert('Homework Deleted', 'The homework assignment has been deleted.', 'success');
        },
        error: () => this.confirmDialog.alert('Error', 'Failed to delete homework.', 'danger')
      });
    });
  }
}

// =========================================================================
// Homework Form Dialog Component (Strict AGENTS.md light-blue header)
// =========================================================================

@Component({
  selector: 'app-homework-form-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatProgressBarModule,
    IstDatetimeDirective
  ],
  template: `
    <div class="hw-dialog-wrap">
      <!-- Strict AGENTS.md Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>{{isEdit ? 'edit_note' : 'post_add'}}</mat-icon>
          </div>
          <div>
            <h2 class="modal-title">{{isEdit ? 'Edit Homework Assignment' : 'Assign New Homework'}}</h2>
            <p class="modal-subtitle">
              <strong style="color:#1e40af">{{isEdit ? model.title : 'School & Coaching Daily Diary'}}</strong>
              <span> &bull; Post instructions, worksheets, and submission deadlines</span>
            </p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close(false)" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Form Body -->
      <div class="modal-body">
        <div class="form-row">
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Class (कक्षा)</mat-label>
            <mat-select [(ngModel)]="model.classId" (selectionChange)="onClassSelect()" [disabled]="isTeacher && !isAdmin">
              <mat-option *ngFor="let c of data.classes" [value]="c.id">{{c.name}}</mat-option>
            </mat-select>
            <mat-hint *ngIf="isTeacher && !isAdmin" class="assigned-hint">
              🔒 Assigned class for your teaching profile
            </mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field" *ngIf="dialogSections.length > 0">
            <mat-label>Section (वर्ग)</mat-label>
            <mat-select [(ngModel)]="model.sectionId" [disabled]="isTeacher && !isAdmin && hasAssignedSection">
              <mat-option value="">All Sections</mat-option>
              <mat-option *ngFor="let s of dialogSections" [value]="s.id">{{s.name}}</mat-option>
            </mat-select>
            <mat-hint *ngIf="isTeacher && !isAdmin && hasAssignedSection" class="assigned-hint">
              🔒 Assigned section locked
            </mat-hint>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Subject (विषय) *</mat-label>
            <mat-select [(ngModel)]="model.subjectName" (selectionChange)="onSubjectSelect($event.value)">
              <mat-optgroup label="Class Curriculum Subjects" *ngIf="classSubjects.length > 0">
                <mat-option *ngFor="let s of classSubjects" [value]="s.subjectName">
                  ⭐ {{s.subjectName}} <span *ngIf="s.teacherName">({{s.teacherName}})</span>
                </mat-option>
              </mat-optgroup>
              <mat-optgroup label="Standard / Other Subjects">
                <mat-option value="Mathematics">Mathematics</mat-option>
                <mat-option value="Science">Science</mat-option>
                <mat-option value="English">English</mat-option>
                <mat-option value="Hindi">Hindi</mat-option>
                <mat-option value="Social Science">Social Science</mat-option>
                <mat-option value="Physics">Physics</mat-option>
                <mat-option value="Chemistry">Chemistry</mat-option>
                <mat-option value="Biology">Biology</mat-option>
                <mat-option value="Computer">Computer</mat-option>
                <mat-option value="General">General / All Subjects</mat-option>
              </mat-optgroup>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Teacher Incharge</mat-label>
            <mat-select [(ngModel)]="model.teacherId" (selectionChange)="onTeacherSelect()" [disabled]="isTeacher && !isAdmin">
              <mat-option value="">Select Teacher</mat-option>
              <mat-option *ngFor="let t of data.teachers" [value]="t.id">{{t.fullName || t.name}}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-field">
          <mat-label>Homework Title / Chapter (शीर्षक / अध्याय)</mat-label>
          <input matInput [(ngModel)]="model.title" placeholder="e.g. Chapter 4: Quadratic Equations - Ex 4.2 Q1 to Q5" required />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-field">
          <mat-label>Instructions & Work Details (निर्देश एवं विवरण)</mat-label>
          <textarea matInput [(ngModel)]="model.description" rows="3" placeholder="Detail the questions to solve, textbook pages, diagrams or notes to prepare..." required></textarea>
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Submission Due Date & Time (IST) *</mat-label>
            <input matInput type="datetime-local" [(ngModel)]="dueDateStr" (ngModelChange)="onDueDateChange()" required />
            <mat-hint class="ist-time-hint" *ngIf="dueDatePreviewIso">
              <span class="ist-badge">
                <mat-icon class="ist-ic">schedule</mat-icon>
                IST: <strong [appIstDatetime]="dueDatePreviewIso" format="datetime"></strong>
              </span>
            </mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Est. Duration (Minutes)</mat-label>
            <input matInput type="number" [(ngModel)]="model.estimatedMinutes" placeholder="30" />
          </mat-form-field>
        </div>

        <!-- File Upload Section for Worksheet / PDF / Docs -->
        <div class="upload-section">
          <div class="upload-header">
            <mat-icon>cloud_upload</mat-icon>
            <span class="upload-title">Attach Worksheet or Question Paper (PDF / Image / Word)</span>
          </div>

          <div class="upload-box" *ngIf="!model.attachmentUrl">
            <input type="file" #fileInput (change)="onFileSelected($event)" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style="display:none" />
            <button mat-stroked-button type="button" class="choose-file-btn" (click)="fileInput.click()" [disabled]="uploading">
              <mat-icon>upload_file</mat-icon>
              <span>{{uploading ? 'Uploading File...' : 'Choose Worksheet / File'}}</span>
            </button>
            <span class="upload-hint">Supported: PDF, JPG, PNG, DOCX (Max: 30 MB)</span>
          </div>

          <div class="attached-file-card" *ngIf="model.attachmentUrl">
            <div class="file-icon-wrap"><mat-icon>task</mat-icon></div>
            <div class="file-details">
              <div class="file-name">{{model.attachmentFileName || 'Worksheet File Attached'}}</div>
              <a [href]="getFileUrl(model.attachmentUrl)" target="_blank" class="preview-link">
                Preview Attached File <mat-icon>open_in_new</mat-icon>
              </a>
            </div>
            <button mat-icon-button type="button" (click)="removeAttachment()" matTooltip="Remove File" class="remove-btn">
              <mat-icon>delete_outline</mat-icon>
            </button>
          </div>

          <mat-progress-bar mode="indeterminate" *ngIf="uploading"></mat-progress-bar>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button mat-button (click)="dialogRef.close(false)" class="cancel-btn">Cancel</button>
        <button mat-raised-button class="save-btn" (click)="saveHomework()" [disabled]="saving || !model.title || !model.description || uploading">
          <mat-icon>{{isEdit ? 'save' : 'send'}}</mat-icon>
          <span>{{isEdit ? 'Save Changes' : 'Assign Homework'}}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .hw-dialog-wrap { display: flex; flex-direction: column; background: #fff; border-radius: 12px; overflow: hidden; }
    /* Strict AGENTS.md Header */
    .modal-header { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-bottom: 1px solid #bfdbfe; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .header-icon-box { background: #2563eb; color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25); width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
    .modal-title { color: #1e3a8a; font-weight: 700; margin: 0; font-size: 18px; }
    .modal-subtitle { color: #3b82f6; margin: 3px 0 0; font-size: 12px; }
    .close-btn { color: #64748b; }
    .close-btn:hover { color: #1e293b; }

    .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 14px; max-height: 70vh; overflow-y: auto; }
    .form-row { display: flex; gap: 14px; }
    .form-field { flex: 1; }
    .full-field { width: 100%; }

    /* Assigned hints & IST Badge */
    .assigned-hint { color: #0284c7; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
    .ist-time-hint { margin-top: 2px; }
    .ist-badge { display: inline-flex; align-items: center; gap: 4px; color: #1e40af; font-size: 11.5px; font-weight: 600; background: #eff6ff; padding: 2px 8px; border-radius: 4px; border: 1px solid #bfdbfe; }
    .ist-badge mat-icon { font-size: 13px; width: 13px; height: 13px; color: #2563eb; }
    .ist-badge strong { color: #1e3a8a; }

    /* Upload Section */
    .upload-section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
    .upload-header { display: flex; align-items: center; gap: 8px; color: #1e40af; font-size: 13px; font-weight: 700; }
    .upload-header mat-icon { font-size: 20px; width: 20px; height: 20px; color: #2563eb; }
    .upload-box { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .choose-file-btn { border-color: #cbd5e1; color: #1e293b; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
    .upload-hint { font-size: 12px; color: #64748b; }
    .attached-file-card { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; gap: 12px; }
    .file-icon-wrap { width: 36px; height: 36px; border-radius: 8px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; }
    .file-details { flex: 1; }
    .file-name { font-weight: 700; color: #0f172a; font-size: 13px; }
    .preview-link { font-size: 12px; color: #2563eb; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; margin-top: 2px; }
    .preview-link mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .remove-btn { color: #ef4444; }

    .modal-footer { padding: 14px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px; }
    .cancel-btn { color: #64748b; }
    .save-btn { background: #2563eb !important; color: #fff !important; font-weight: 700; }
  `]
})
export class HomeworkFormDialogComponent implements OnInit {
  isEdit = false;
  saving = false;
  uploading = false;
  isTeacher = false;
  isAdmin = false;
  hasAssignedSection = false;
  dialogSections: any[] = [];
  dueDateStr = '';
  dueDatePreviewIso = '';

  model: any = {
    classId: '',
    sectionId: '',
    batchId: '',
    subjectName: 'Mathematics',
    teacherId: '',
    teacherName: '',
    title: '',
    description: '',
    dueDate: '',
    attachmentUrl: '',
    attachmentFileName: '',
    estimatedMinutes: 30
  };

  constructor(
    public dialogRef: MatDialogRef<HomeworkFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService
  ) {}

  private formatLocalIsoDatetime(d: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = d.getDate();
    const h = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${y}-${m}-${day}T${h}:${min}`;
  }

  ngOnInit(): void {
    const role = (this.data?.currentUser?.role || '').toLowerCase();
    this.isAdmin = role.includes('admin') || role.includes('super');

    const userFullName = (this.data?.currentUser?.fullName || this.data?.currentUser?.name || '').trim().toLowerCase();
    const userId = this.data?.currentUser?.userId || this.data?.currentUser?.id;

    const currentTeacher = this.data.teachers?.find((t: any) =>
      (userId && t.userId && t.userId === userId) ||
      (userFullName && t.fullName && t.fullName.trim().toLowerCase() === userFullName) ||
      (userFullName && t.name && t.name.trim().toLowerCase() === userFullName)
    );

    // Identify if user is teacher
    if (role.includes('teacher') || role.includes('faculty') || (!this.isAdmin && currentTeacher)) {
      this.isTeacher = true;
    }

    if (this.data?.homework) {
      this.isEdit = true;
      const h = this.data.homework;
      this.model = { ...h };
      if (h.dueDate) {
        this.dueDateStr = h.dueDate.replace(' ', 'T').slice(0, 16);
      }
      this.onClassSelect();
      this.updatePreviewIso();
    } else {
      // Default due date tomorrow at 5:00 PM IST (17:00 Asia/Kolkata)
      const nowUtc = new Date();
      const istOffsetMs = 5.5 * 60 * 60 * 1000;
      const istNow = new Date(nowUtc.getTime() + (nowUtc.getTimezoneOffset() * 60000) + istOffsetMs);
      const istTomorrow = new Date(istNow);
      istTomorrow.setDate(istTomorrow.getDate() + 1);
      istTomorrow.setHours(17, 0, 0, 0);
      this.dueDateStr = this.formatLocalIsoDatetime(istTomorrow);
      this.updatePreviewIso();

      // If teacher found, assign teacher incharge
      if (currentTeacher) {
        this.model.teacherId = currentTeacher.id;
        this.model.teacherName = currentTeacher.fullName || currentTeacher.name;
      }

      // Autopopulate class & section for Teacher
      if (this.isTeacher) {
        this.autopopulateTeacherClass(currentTeacher);
      }
    }
  }

  private autopopulateTeacherClass(teacher: any): void {
    let assignedClassId = '';
    let assignedSectionId = '';

    // 1. Look in loaded classes for any section where this teacher is assigned as class teacher
    if (this.data.classes?.length) {
      for (const c of this.data.classes) {
        const sec = c.sections?.find((s: any) =>
          (teacher && s.classTeacherId && s.classTeacherId === teacher.id) ||
          (teacher?.fullName && s.classTeacherName && s.classTeacherName.trim().toLowerCase() === teacher.fullName.trim().toLowerCase()) ||
          (teacher?.name && s.classTeacherName && s.classTeacherName.trim().toLowerCase() === teacher.name.trim().toLowerCase())
        );
        if (sec) {
          assignedClassId = c.id;
          assignedSectionId = sec.id;
          break;
        }
      }
    }

    // 2. If found, apply immediately
    if (assignedClassId) {
      this.model.classId = assignedClassId;
      this.onClassSelect();
      if (assignedSectionId) {
        this.model.sectionId = assignedSectionId;
        this.hasAssignedSection = true;
      }
    } else if (this.data.classes?.length > 0) {
      // Fallback: Default to first class if teacher has no explicit section yet
      this.model.classId = this.data.classes[0].id;
      this.onClassSelect();
      if (this.dialogSections.length > 0) {
        this.model.sectionId = this.dialogSections[0].id;
      }
    }

    // 3. Query teacher batch/timetable assignments from backend to get most accurate timetable link
    if (teacher?.id) {
      this.http.get<any[]>(`${API_BASE}/teachers/${teacher.id}/batch-assignments`).subscribe({
        next: (assignments) => {
          if (assignments && assignments.length > 0) {
            const activeAssign = assignments.find((a: any) => a.classId);
            if (activeAssign) {
              this.model.classId = activeAssign.classId;
              this.onClassSelect();
              if (activeAssign.sectionId) {
                this.model.sectionId = activeAssign.sectionId;
                this.hasAssignedSection = true;
              }
              if (activeAssign.subject) {
                this.model.subjectName = activeAssign.subject;
              }
            }
          }
        },
        error: () => {}
      });
    }
  }

  updatePreviewIso(): void {
    if (!this.dueDateStr) {
      this.dueDatePreviewIso = '';
      return;
    }
    const clean = this.dueDateStr.length === 16 ? this.dueDateStr + ':00' : this.dueDateStr;
    this.dueDatePreviewIso = clean.includes('+') || clean.includes('Z') ? clean : `${clean}+05:30`;
  }

  onDueDateChange(): void {
    this.updatePreviewIso();
  }

  classSubjects: any[] = [];
  loadingClassSubjects = false;

  onClassSelect(): void {
    const found = this.data.classes?.find((c: any) => c.id === this.model.classId);
    this.dialogSections = found?.sections || [];

    if (this.model.classId) {
      this.loadingClassSubjects = true;
      this.http.get<any[]>(`${API_BASE}/subjects/classes/${this.model.classId}`).subscribe({
        next: (subs) => {
          this.loadingClassSubjects = false;
          this.classSubjects = subs || [];
          if (!this.isEdit && this.classSubjects.length > 0 && (!this.model.subjectName || this.model.subjectName === 'Mathematics')) {
            this.onSubjectSelect(this.classSubjects[0].subjectName);
          }
        },
        error: () => {
          this.loadingClassSubjects = false;
          this.classSubjects = [];
        }
      });
    } else {
      this.classSubjects = [];
    }
  }

  onSubjectSelect(subName: string): void {
    this.model.subjectName = subName;
    const found = this.classSubjects.find(cs => cs.subjectName.toLowerCase() === (subName || '').toLowerCase());
    if (found?.teacherId) {
      this.model.teacherId = found.teacherId;
      this.onTeacherSelect();
    }
  }

  onTeacherSelect(): void {
    const t = this.data.teachers?.find((x: any) => x.id === this.model.teacherId);
    if (t) {
      this.model.teacherName = t.fullName || t.name;
      if (this.isAdmin && !this.model.classId) {
        this.autopopulateTeacherClass(t);
      }
    }
  }

  getFileUrl(url?: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    return `http://localhost:5000${url.startsWith('/') ? '' : '/'}${url}`;
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files?.[0];
    if (!file) return;

    this.uploading = true;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', 'worksheet');

    this.http.post<any>(`${API_BASE}/homework/upload`, formData).subscribe({
      next: res => {
        this.uploading = false;
        this.model.attachmentUrl = res.fileUrl;
        this.model.attachmentFileName = res.fileName || file.name;
      },
      error: () => {
        this.uploading = false;
        this.confirmDialog.alert('Upload Failed', 'Failed to upload attachment file. Please try again.', 'danger');
      }
    });
  }

  removeAttachment(): void {
    this.model.attachmentUrl = '';
    this.model.attachmentFileName = '';
  }

  saveHomework(): void {
    const cleanDueDate = this.dueDatePreviewIso || (this.dueDateStr ? this.dueDateStr + ':00+05:30' : null);
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const assignedDateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}+05:30`;

    this.saving = true;
    if (this.isEdit) {
      this.http.put(`${API_BASE}/homework/${this.model.id}`, {
        title: this.model.title,
        description: this.model.description,
        dueDate: cleanDueDate,
        status: this.model.status || 'Active',
        attachmentUrl: this.model.attachmentUrl,
        attachmentFileName: this.model.attachmentFileName,
        estimatedMinutes: this.model.estimatedMinutes
      }).subscribe({
        next: () => {
          this.saving = false;
          this.dialogRef.close({ action: 'updated', title: this.model.title });
        },
        error: () => {
          this.saving = false;
          this.confirmDialog.alert('Save Failed', 'Failed to update homework assignment.', 'danger');
        }
      });
    } else {
      this.http.post(`${API_BASE}/homework`, {
        classId: this.model.classId || null,
        sectionId: this.model.sectionId || null,
        batchId: this.model.batchId || null,
        subjectName: this.model.subjectName,
        teacherId: this.model.teacherId || null,
        teacherName: this.model.teacherName || null,
        title: this.model.title,
        description: this.model.description,
        assignedDate: assignedDateStr,
        dueDate: cleanDueDate,
        attachmentUrl: this.model.attachmentUrl,
        attachmentFileName: this.model.attachmentFileName,
        estimatedMinutes: this.model.estimatedMinutes
      }).subscribe({
        next: () => {
          this.saving = false;
          this.dialogRef.close({ action: 'created', title: this.model.title });
        },
        error: () => {
          this.saving = false;
          this.confirmDialog.alert('Creation Failed', 'Failed to create homework assignment.', 'danger');
        }
      });
    }
  }
}

// =========================================================================
// TEACHER: HOMEWORK SUBMISSIONS & EVALUATION DIALOG (Strict AGENTS.md light-blue header)
// =========================================================================

@Component({
  selector: 'app-homework-submissions-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatProgressBarModule,
    MatTooltipModule, IstDatetimeDirective
  ],
  template: `
    <div class="submissions-dialog-wrap">
      <!-- Strict AGENTS.md Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>assignment_turned_in</mat-icon>
          </div>
          <div>
            <h2 class="modal-title">Student Submissions & Evaluation</h2>
            <p class="modal-subtitle">
              <strong style="color:#1e40af">{{homework.title}}</strong>
              <span> &bull; {{homework.subjectName}} ({{homework.className || 'All'}}<span *ngIf="homework.sectionName"> - {{homework.sectionName}}</span>)</span>
            </p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close(false)" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Quick Summary Stats -->
      <div class="sub-stats-bar">
        <div class="sub-stat-pill">
          <span class="sub-stat-num">{{roster.length}}</span>
          <span class="sub-stat-txt">Total Students</span>
        </div>
        <div class="sub-stat-pill green">
          <span class="sub-stat-num">{{submittedCount}}</span>
          <span class="sub-stat-txt">Submitted</span>
        </div>
        <div class="sub-stat-pill amber">
          <span class="sub-stat-num">{{roster.length - submittedCount}}</span>
          <span class="sub-stat-txt">Pending</span>
        </div>
        <div class="sub-stat-pill blue">
          <span class="sub-stat-num">{{approvedCount}}</span>
          <span class="sub-stat-txt">Approved / Graded</span>
        </div>

        <!-- Filter Toggle -->
        <div class="filter-toggle">
          <button class="toggle-btn" [class.active]="filterRoster==='all'" (click)="filterRoster='all'">All ({{roster.length}})</button>
          <button class="toggle-btn" [class.active]="filterRoster==='submitted'" (click)="filterRoster='submitted'">Submitted ({{submittedCount}})</button>
          <button class="toggle-btn" [class.active]="filterRoster==='pending'" (click)="filterRoster='pending'">Pending ({{roster.length - submittedCount}})</button>
        </div>
      </div>

      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

      <!-- Submissions List / Table -->
      <div class="modal-body">
        <div class="empty-roster" *ngIf="!loading && filteredRoster.length === 0">
          <mat-icon>inbox</mat-icon>
          <p>No students match the selected filter.</p>
        </div>

        <div class="student-submission-item" *ngFor="let item of filteredRoster">
          <div class="item-left">
            <div class="student-avatar" [class.submitted]="item.hasSubmitted">
              <mat-icon>{{item.hasSubmitted ? 'assignment_turned_in' : 'pending_actions'}}</mat-icon>
            </div>
            <div class="student-info">
              <div class="student-name">
                {{item.studentName}}
                <span class="roll-badge" *ngIf="item.rollNumber">Roll: {{item.rollNumber}}</span>
                <span class="adm-badge" *ngIf="item.admissionNumber">Adm: {{item.admissionNumber}}</span>
              </div>

              <div class="item-meta" *ngIf="item.hasSubmitted && item.submission">
                <span class="submission-date">
                  Submitted: <span [appIstDatetime]="item.submission.submissionDate"></span>
                </span>
                <span class="remarks-tag" *ngIf="item.submission.studentRemarks">
                  <strong>Notes:</strong> {{item.submission.studentRemarks}}
                </span>
              </div>
              <div class="item-meta pending-text" *ngIf="!item.hasSubmitted">
                <mat-icon class="sm-ic">schedule</mat-icon> Not submitted yet
              </div>
            </div>
          </div>

          <div class="item-right">
            <!-- Download / View Solution File -->
            <div *ngIf="item.hasSubmitted && item.submission">
              <a [href]="getFileUrl(item.submission.submissionFileUrl)" target="_blank" class="solution-file-link" matTooltip="Click to open student's solution copy">
                <mat-icon>description</mat-icon>
                <span>{{item.submission.submissionFileName || 'View Copy'}}</span>
                <mat-icon class="sm-ext">open_in_new</mat-icon>
              </a>
            </div>

            <!-- Status Pill -->
            <span class="status-badge" [ngClass]="item.hasSubmitted ? (item.submission?.status?.toLowerCase() || 'submitted') : 'pending'">
              {{item.hasSubmitted ? (item.submission?.status || 'Submitted') : 'Pending'}}
            </span>

            <!-- Review / Grading Action Button -->
            <div *ngIf="item.hasSubmitted && item.submission">
              <button mat-stroked-button class="review-btn" (click)="toggleReviewForm(item)">
                <mat-icon>rate_review</mat-icon>
                <span>{{item.submission.reviewedAt ? 'Update Grade' : 'Grade & Review'}}</span>
              </button>
            </div>
          </div>

          <!-- Inline Review Form Drawer -->
          <div class="inline-review-card" *ngIf="item.hasSubmitted && item.submission && isReviewing(item.studentId)">
            <div class="review-inputs-row">
              <mat-form-field appearance="outline" class="grade-field">
                <mat-label>Grade / Marks</mat-label>
                <input matInput [(ngModel)]="reviewModels[item.studentId].gradeOrMarks" placeholder="e.g. A+, 9/10" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="status-select-field">
                <mat-label>Review Status</mat-label>
                <mat-select [(ngModel)]="reviewModels[item.studentId].status">
                  <mat-option value="Approved">Approved / Completed</mat-option>
                  <mat-option value="NeedsCorrection">Needs Correction</mat-option>
                  <mat-option value="Reviewed">Reviewed</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="feedback-field">
                <mat-label>Teacher Remarks / Feedback</mat-label>
                <input matInput [(ngModel)]="reviewModels[item.studentId].teacherRemarks" placeholder="e.g. Well done! Neat work, check question 3 formula." />
              </mat-form-field>

              <button mat-raised-button class="save-review-btn" (click)="submitReview(item)" [disabled]="reviewSaving">
                <mat-icon>check</mat-icon>
                <span>Save Grade</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button mat-button (click)="dialogRef.close(false)" class="close-modal-btn">Done</button>
      </div>
    </div>
  `,
  styles: [`
    .submissions-dialog-wrap { display: flex; flex-direction: column; background: #fff; border-radius: 12px; overflow: hidden; max-height: 90vh; }
    /* Strict AGENTS.md Header */
    .modal-header { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-bottom: 1px solid #bfdbfe; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .header-icon-box { background: #2563eb; color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25); width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
    .modal-title { color: #1e3a8a; font-weight: 700; margin: 0; font-size: 18px; }
    .modal-subtitle { color: #3b82f6; margin: 3px 0 0; font-size: 12px; }
    .close-btn { color: #64748b; }
    .close-btn:hover { color: #1e293b; }

    /* Quick stats bar */
    .sub-stats-bar { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 12px 24px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .sub-stat-pill { display: flex; align-items: baseline; gap: 6px; background: #fff; border: 1px solid #e2e8f0; padding: 4px 12px; border-radius: 20px; }
    .sub-stat-num { font-size: 16px; font-weight: 800; color: #0f172a; }
    .sub-stat-txt { font-size: 11px; font-weight: 600; color: #64748b; }
    .sub-stat-pill.green .sub-stat-num { color: #16a34a; }
    .sub-stat-pill.amber .sub-stat-num { color: #d97706; }
    .sub-stat-pill.blue .sub-stat-num { color: #2563eb; }

    .filter-toggle { margin-left: auto; display: flex; gap: 4px; background: #e2e8f0; padding: 3px; border-radius: 8px; }
    .toggle-btn { border: none; background: transparent; padding: 4px 10px; font-size: 12px; font-weight: 600; color: #475569; border-radius: 6px; cursor: pointer; }
    .toggle-btn.active { background: #fff; color: #1e40af; font-weight: 700; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }

    .modal-body { padding: 16px 24px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; max-height: calc(90vh - 180px); }
    .empty-roster { text-align: center; padding: 40px; color: #94a3b8; }
    .empty-roster mat-icon { font-size: 40px; width: 40px; height: 40px; margin-bottom: 8px; }

    /* Roster item card */
    .student-submission-item { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
    .student-submission-item:hover { border-color: #cbd5e1; }
    .item-left { display: flex; align-items: center; gap: 14px; }
    .student-avatar { width: 40px; height: 40px; border-radius: 50%; background: #f1f5f9; color: #94a3b8; display: flex; align-items: center; justify-content: center; }
    .student-avatar.submitted { background: #ecfdf5; color: #10b981; }
    .student-name { font-weight: 700; color: #1e293b; font-size: 14px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .roll-badge, .adm-badge { background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 4px; }
    .item-meta { font-size: 12px; color: #64748b; margin-top: 3px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .pending-text { color: #b45309; display: flex; align-items: center; gap: 4px; }
    .sm-ic { font-size: 14px; width: 14px; height: 14px; }

    .item-right { display: flex; align-items: center; gap: 12px; margin-left: 54px; flex-wrap: wrap; }
    .solution-file-link { display: inline-flex; align-items: center; gap: 6px; background: #eff6ff; color: #1d4ed8; text-decoration: none; font-size: 12px; font-weight: 700; padding: 5px 12px; border-radius: 6px; border: 1px solid #bfdbfe; }
    .solution-file-link:hover { background: #dbeafe; }
    .solution-file-link mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .sm-ext { font-size: 12px; width: 12px; height: 12px; color: #60a5fa; }
    .status-badge { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; text-transform: capitalize; }
    .status-badge.pending { background: #f8fafc; color: #94a3b8; border: 1px solid #e2e8f0; }
    .status-badge.submitted { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .status-badge.approved { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .status-badge.needscorrection { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
    .review-btn { height: 32px; font-size: 11px; font-weight: 700; color: #2563eb; border-color: #cbd5e1; }

    /* Inline review card */
    .inline-review-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-left: 54px; }
    .review-inputs-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .grade-field { width: 120px; }
    .status-select-field { width: 180px; }
    .feedback-field { flex: 1; min-width: 220px; }
    .review-inputs-row ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    .save-review-btn { background: #16a34a !important; color: #fff !important; font-weight: 700; height: 42px; border-radius: 6px; }

    .modal-footer { padding: 12px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; }
    .close-modal-btn { font-weight: 700; color: #475569; }
  `]
})
export class HomeworkSubmissionsDialogComponent implements OnInit {
  roster: ClassStudentSubmissionRosterDto[] = [];
  loading = false;
  reviewSaving = false;
  filterRoster: 'all' | 'submitted' | 'pending' = 'all';

  reviewModels: { [studentId: string]: { gradeOrMarks: string; status: string; teacherRemarks: string; active: boolean } } = {};

  constructor(
    public dialogRef: MatDialogRef<HomeworkSubmissionsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public homework: StudentHomeworkDto,
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.loadRoster();
  }

  getFileUrl(url?: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    return `http://localhost:5000${url.startsWith('/') ? '' : '/'}${url}`;
  }

  loadRoster(): void {
    this.loading = true;
    this.http.get<ClassStudentSubmissionRosterDto[]>(`${API_BASE}/homework/${this.homework.id}/submissions`).subscribe({
      next: res => {
        this.roster = res;
        this.loading = false;
        // Prepopulate review models
        this.roster.forEach(r => {
          this.reviewModels[r.studentId] = {
            gradeOrMarks: r.submission?.gradeOrMarks || '',
            status: r.submission?.status || 'Approved',
            teacherRemarks: r.submission?.teacherRemarks || '',
            active: false
          };
        });
      },
      error: () => {
        this.roster = [];
        this.loading = false;
      }
    });
  }

  get submittedCount(): number {
    return this.roster.filter(r => r.hasSubmitted).length;
  }

  get approvedCount(): number {
    return this.roster.filter(r => r.submission?.status === 'Approved').length;
  }

  get filteredRoster(): ClassStudentSubmissionRosterDto[] {
    if (this.filterRoster === 'submitted') return this.roster.filter(r => r.hasSubmitted);
    if (this.filterRoster === 'pending') return this.roster.filter(r => !r.hasSubmitted);
    return this.roster;
  }

  isReviewing(studentId: string): boolean {
    return !!this.reviewModels[studentId]?.active;
  }

  toggleReviewForm(item: ClassStudentSubmissionRosterDto): void {
    if (!this.reviewModels[item.studentId]) {
      this.reviewModels[item.studentId] = {
        gradeOrMarks: item.submission?.gradeOrMarks || '',
        status: item.submission?.status || 'Approved',
        teacherRemarks: item.submission?.teacherRemarks || '',
        active: true
      };
    } else {
      this.reviewModels[item.studentId].active = !this.reviewModels[item.studentId].active;
    }
  }

  submitReview(item: ClassStudentSubmissionRosterDto): void {
    if (!item.submission) return;
    const model = this.reviewModels[item.studentId];
    this.reviewSaving = true;

    this.http.put(`${API_BASE}/homework/submissions/${item.submission.id}/review`, {
      status: model.status || 'Approved',
      gradeOrMarks: model.gradeOrMarks,
      teacherRemarks: model.teacherRemarks
    }).subscribe({
      next: () => {
        this.reviewSaving = false;
        model.active = false;
        this.loadRoster();
        this.confirmDialog.alert('Graded Successfully 🎉', `Submission review for ${item.studentName} updated.`, 'success');
      },
      error: () => {
        this.reviewSaving = false;
        this.confirmDialog.alert('Error', 'Failed to save review.', 'danger');
      }
    });
  }
}

// =========================================================================
// STUDENT: SUBMIT HOMEWORK SOLUTION DIALOG (Strict AGENTS.md light-blue header)
// =========================================================================

@Component({
  selector: 'app-student-homework-submit-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatProgressBarModule
  ],
  template: `
    <div class="student-submit-dialog-wrap">
      <!-- Strict AGENTS.md Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>upload_file</mat-icon>
          </div>
          <div>
            <h2 class="modal-title">{{homework.isSubmitted ? 'Update Homework Solution' : 'Submit Homework Solution'}}</h2>
            <p class="modal-subtitle">
              <strong style="color:#1e40af">{{homework.title}}</strong>
              <span> &bull; {{homework.subjectName}}</span>
            </p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close(false)" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="modal-body">
        <div class="instructions-card">
          <mat-icon>info</mat-icon>
          <div>
            <strong>Teacher's Assignment:</strong> {{homework.description}}
          </div>
        </div>

        <!-- File Upload Section -->
        <div class="upload-box-container">
          <label class="field-label">Upload Solution Copy (PDF, Scanned Photo, or Document) *</label>

          <div class="upload-dropzone" *ngIf="!submissionFileUrl">
            <input type="file" #solFileInput (change)="onFileSelected($event)" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style="display:none" />
            <mat-icon class="drop-icon">cloud_upload</mat-icon>
            <div class="drop-title">Select or Take Photo of Your Completed Copy</div>
            <div class="drop-sub">PDF, PNG, JPG, or DOC (Max: 30 MB)</div>
            <button mat-raised-button type="button" class="choose-sol-btn" (click)="solFileInput.click()" [disabled]="uploading">
              <mat-icon>attach_file</mat-icon>
              <span>{{uploading ? 'Uploading Copy...' : 'Choose / Take Photo'}}</span>
            </button>
          </div>

          <div class="uploaded-card" *ngIf="submissionFileUrl">
            <div class="icon-wrap"><mat-icon>task</mat-icon></div>
            <div class="sol-info">
              <div class="sol-name">{{submissionFileName}}</div>
              <a [href]="getFileUrl(submissionFileUrl)" target="_blank" class="preview-sol">
                Verify Uploaded File <mat-icon>open_in_new</mat-icon>
              </a>
            </div>
            <button mat-icon-button (click)="removeFile()" matTooltip="Change File" class="remove-btn">
              <mat-icon>delete_outline</mat-icon>
            </button>
          </div>

          <mat-progress-bar mode="indeterminate" *ngIf="uploading"></mat-progress-bar>
        </div>

        <mat-form-field appearance="outline" class="full-field">
          <mat-label>Student Remarks / Notes for Teacher (Optional)</mat-label>
          <textarea matInput [(ngModel)]="studentRemarks" rows="3" placeholder="e.g. Completed all 5 questions on notebook page 24. Had doubt in Q3."></textarea>
        </mat-form-field>
      </div>

      <div class="modal-footer">
        <button mat-button (click)="dialogRef.close(false)" class="cancel-btn">Cancel</button>
        <button mat-raised-button class="submit-btn" (click)="submitHomework()" [disabled]="submitting || !submissionFileUrl || uploading">
          <mat-icon>send</mat-icon>
          <span>{{homework.isSubmitted ? 'Re-submit Solution' : 'Submit Homework'}}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .student-submit-dialog-wrap { display: flex; flex-direction: column; background: #fff; border-radius: 12px; overflow: hidden; }
    /* Strict AGENTS.md Header */
    .modal-header { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-bottom: 1px solid #bfdbfe; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .header-icon-box { background: #2563eb; color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25); width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
    .modal-title { color: #1e3a8a; font-weight: 700; margin: 0; font-size: 18px; }
    .modal-subtitle { color: #3b82f6; margin: 3px 0 0; font-size: 12px; }
    .close-btn { color: #64748b; }
    .close-btn:hover { color: #1e293b; }

    .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; max-height: 70vh; overflow-y: auto; }
    .instructions-card { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 14px; font-size: 12px; color: #1e3a8a; display: flex; gap: 10px; align-items: flex-start; }
    .instructions-card mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; flex-shrink: 0; margin-top: 1px; }

    .upload-box-container { display: flex; flex-direction: column; gap: 8px; }
    .field-label { font-size: 13px; font-weight: 700; color: #1e293b; }
    .upload-dropzone { border: 2px dashed #cbd5e1; border-radius: 10px; padding: 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; background: #f8fafc; }
    .drop-icon { font-size: 36px; width: 36px; height: 36px; color: #2563eb; }
    .drop-title { font-size: 14px; font-weight: 700; color: #0f172a; }
    .drop-sub { font-size: 12px; color: #64748b; margin-bottom: 8px; }
    .choose-sol-btn { background: #2563eb !important; color: #fff !important; font-weight: 700; }

    .uploaded-card { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; gap: 12px; }
    .icon-wrap { width: 36px; height: 36px; border-radius: 8px; background: #dcfce7; color: #16a34a; display: flex; align-items: center; justify-content: center; }
    .sol-info { flex: 1; }
    .sol-name { font-weight: 700; color: #166534; font-size: 13px; }
    .preview-sol { font-size: 12px; color: #15803d; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; margin-top: 2px; }
    .preview-sol mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .remove-btn { color: #dc2626; }

    .full-field { width: 100%; }
    .modal-footer { padding: 14px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px; }
    .cancel-btn { color: #64748b; }
    .submit-btn { background: #2563eb !important; color: #fff !important; font-weight: 700; }
  `]
})
export class StudentHomeworkSubmitDialogComponent implements OnInit {
  homework: StudentHomeworkWithSubmissionDto;
  studentId?: string;
  submissionFileUrl = '';
  submissionFileName = '';
  studentRemarks = '';
  uploading = false;
  submitting = false;

  constructor(
    public dialogRef: MatDialogRef<StudentHomeworkSubmitDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService
  ) {
    if (data?.homework) {
      this.homework = data.homework;
      this.studentId = data.studentId;
    } else {
      this.homework = data;
    }
  }

  ngOnInit(): void {
    if (this.homework.mySubmission) {
      this.submissionFileUrl = this.homework.mySubmission.submissionFileUrl;
      this.submissionFileName = this.homework.mySubmission.submissionFileName;
      this.studentRemarks = this.homework.mySubmission.studentRemarks || '';
    }
  }

  getFileUrl(url?: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    return `http://localhost:5000${url.startsWith('/') ? '' : '/'}${url}`;
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files?.[0];
    if (!file) return;

    this.uploading = true;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', 'submission');

    this.http.post<any>(`${API_BASE}/homework/upload`, formData).subscribe({
      next: res => {
        this.uploading = false;
        this.submissionFileUrl = res.fileUrl;
        this.submissionFileName = res.fileName || file.name;
      },
      error: () => {
        this.uploading = false;
        this.confirmDialog.alert('Upload Failed', 'Failed to upload solution copy file. Please try again.', 'danger');
      }
    });
  }

  removeFile(): void {
    this.submissionFileUrl = '';
    this.submissionFileName = '';
  }

  submitHomework(): void {
    if (!this.submissionFileUrl) {
      this.confirmDialog.alert('Missing File', 'Please upload your completed homework copy before submitting.', 'danger');
      return;
    }

    this.submitting = true;
    this.http.post(`${API_BASE}/homework/${this.homework.id}/submit`, {
      studentId: this.studentId || undefined,
      submissionFileUrl: this.submissionFileUrl,
      submissionFileName: this.submissionFileName,
      studentRemarks: this.studentRemarks
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.confirmDialog.alert(
          'Homework Submitted 🎉',
          `Your homework solution for "${this.homework.title}" has been submitted successfully to your teacher!`,
          'success'
        );
        this.dialogRef.close({ submitted: true });
      },
      error: (err) => {
        this.submitting = false;
        this.confirmDialog.alert(
          'Submission Failed',
          err.error?.message || 'Could not submit homework. Please try again.',
          'danger'
        );
      }
    });
  }
}
