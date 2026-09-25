import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { API_BASE, TeacherDto, BatchDto, SubjectDto, TeacherLessonPlanDto, CreateTeacherLessonPlanDto, UpdateTeacherLessonPlanDto } from './teacher.models';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-teacher-lesson-plans',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatChipsModule, MatProgressBarModule, MatTooltipModule
  ],
  template: `
<div class="page-container">
  <!-- Page Header -->
  <div class="page-header">
    <div class="header-left">
      <div class="header-icon-box">
        <mat-icon>menu_book</mat-icon>
      </div>
      <div>
        <h1 class="page-title">Daily Lesson Plan &amp; Teacher Diary</h1>
        <p class="page-subtitle">दैनिक पाठ योजना व शिक्षक डायरी — पाठ विवरण, गृहकार्य (Homework) व सिलेबस कवरेज।</p>
      </div>
    </div>
    <div class="header-actions">
      <a mat-stroked-button routerLink="/teachers" class="back-btn">
        <mat-icon>arrow_back</mat-icon> Teachers
      </a>
      <button mat-raised-button color="primary" class="primary-btn" (click)="openAddModal()">
        <mat-icon>edit_note</mat-icon> Log Daily Lesson
      </button>
    </div>
  </div>

  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

  <!-- Metrics Cards -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-icon comp-icon"><mat-icon>done_all</mat-icon></div>
      <div class="stat-info">
        <div class="stat-value">{{getCompletedCount()}}</div>
        <div class="stat-label">Topics Completed</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon prog-icon"><mat-icon>trending_up</mat-icon></div>
      <div class="stat-info">
        <div class="stat-value">{{getInProgressCount()}}</div>
        <div class="stat-label">Topics In Progress</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon rev-icon"><mat-icon>refresh</mat-icon></div>
      <div class="stat-info">
        <div class="stat-value">{{getRevisionCount()}}</div>
        <div class="stat-label">Revision Classes</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon total-icon"><mat-icon>auto_stories</mat-icon></div>
      <div class="stat-info">
        <div class="stat-value">{{lessonPlans.length}}</div>
        <div class="stat-label">Total Diary Entries</div>
      </div>
    </div>
  </div>

  <!-- Filters -->
  <mat-card class="filter-card mat-elevation-z1">
    <div class="filter-row">
      <mat-form-field appearance="outline" class="filter-item">
        <mat-label>Teacher Filter</mat-label>
        <mat-select [(ngModel)]="filterTeacherId" (selectionChange)="loadLessonPlans()">
          <mat-option value="">All Teachers</mat-option>
          <mat-option *ngFor="let t of teachers" [value]="t.id">{{t.fullName}} ({{t.employeeCode}})</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="filter-item">
        <mat-label>Status Filter</mat-label>
        <mat-select [(ngModel)]="filterStatus" (selectionChange)="loadLessonPlans()">
          <mat-option value="">All Statuses</mat-option>
          <mat-option value="Completed">Completed</mat-option>
          <mat-option value="InProgress">In Progress</mat-option>
          <mat-option value="Revision">Revision</mat-option>
          <mat-option value="Planned">Planned</mat-option>
        </mat-select>
      </mat-form-field>

      <button mat-button color="primary" (click)="resetFilters()">
        <mat-icon>refresh</mat-icon> Reset Filters
      </button>
    </div>
  </mat-card>

  <!-- Lesson Plans Grid -->
  <div class="plans-grid" *ngIf="!loading && lessonPlans.length > 0">
    <mat-card class="plan-card mat-elevation-z2" *ngFor="let p of lessonPlans">
      <div class="plan-top-bar">
        <div class="plan-date-chip">
          <mat-icon>event</mat-icon>
          <span>{{p.planDate | date:'dd MMM yyyy'}}</span>
        </div>
        <span class="status-chip" [ngClass]="'status-' + p.status.toLowerCase()">
          {{p.status}}
        </span>
      </div>

      <div class="teacher-info-row">
        <div class="t-avatar">{{getInitials(p.teacherName)}}</div>
        <div>
          <div class="t-name">{{p.teacherName}}</div>
          <div class="t-sub">{{p.teacherCode}} &bull; <strong>{{p.subjectName}}</strong></div>
        </div>
      </div>

      <div class="topic-highlight">
        <div class="topic-title">{{p.chapterTopic}}</div>
        <div class="obj-text" *ngIf="p.learningObjectives">
          <em>Obj: {{p.learningObjectives}}</em>
        </div>
      </div>

      <div class="meta-pills">
        <span class="meta-pill" *ngIf="p.batchName"><mat-icon>class</mat-icon> {{p.batchName}}</span>
        <span class="meta-pill" *ngIf="p.classSectionName"><mat-icon>meeting_room</mat-icon> {{p.classSectionName}}</span>
        <span class="meta-pill" *ngIf="p.teachingMethodology"><mat-icon>psychology</mat-icon> {{p.teachingMethodology}}</span>
        <span class="meta-pill" *ngIf="p.completionPercentage"><mat-icon>percent</mat-icon> {{p.completionPercentage}}</span>
      </div>

      <div class="homework-box" *ngIf="p.homeworkAssigned">
        <div class="hw-title"><mat-icon>assignment_turned_in</mat-icon> Homework / गृहकार्य:</div>
        <div class="hw-content">{{p.homeworkAssigned}}</div>
      </div>

      <div class="feedback-box" *ngIf="p.principalFeedback">
        <div class="fb-title"><mat-icon>verified</mat-icon> Principal Feedback:</div>
        <div class="fb-content">{{p.principalFeedback}}</div>
      </div>

      <div class="plan-footer">
        <span class="created-at">Logged: {{p.createdAt | date:'shortTime'}}</span>
        <div class="card-actions">
          <button mat-icon-button color="primary" matTooltip="Add Principal Feedback / Edit" (click)="openEditModal(p)">
            <mat-icon>rate_review</mat-icon>
          </button>
          <button mat-icon-button color="warn" matTooltip="Delete Entry" (click)="deleteLessonPlan(p.id)">
            <mat-icon>delete</mat-icon>
          </button>
        </div>
      </div>
    </mat-card>
  </div>

  <!-- Empty State -->
  <mat-card class="empty-card mat-elevation-z1" *ngIf="!loading && lessonPlans.length === 0">
    <mat-icon class="empty-icon">menu_book</mat-icon>
    <h3>No Diary Entries Found</h3>
    <p>No lesson plans or diary entries match the selected criteria. Click below to log a new lesson entry.</p>
    <button mat-stroked-button color="primary" (click)="openAddModal()">
      <mat-icon>edit_note</mat-icon> Log Daily Lesson
    </button>
  </mat-card>
</div>

<!-- ============================================================== -->
<!-- MODAL: LOG LESSON PLAN (Strict Light-Blue Header Compliance)   -->
<!-- ============================================================== -->
<div class="modal-backdrop" *ngIf="showAddModal" (click)="closeAddModal()">
  <div class="modal-container" (click)="$event.stopPropagation()">
    <!-- Strict AGENTS.md Header -->
    <div class="modal-header">
      <div class="header-left-box">
        <div class="header-icon">
          <mat-icon>edit_note</mat-icon>
        </div>
        <div>
          <h2 class="modal-title">{{editingPlanId ? 'Edit Lesson Diary / Feedback' : 'Log Daily Lesson & Diary'}}</h2>
          <p class="modal-subtitle">शिक्षक डायरी प्रविष्टि — टॉपिक, शिक्षण विधि, एवं दिया गया गृहकार्य।</p>
        </div>
      </div>
      <button mat-icon-button (click)="closeAddModal()" class="close-btn">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <div class="modal-body">
      <div class="form-grid">
        <!-- Teacher Dropdown -->
        <mat-form-field appearance="outline" class="col-half">
          <mat-label>Teacher *</mat-label>
          <mat-select [(ngModel)]="addForm.teacherId" [disabled]="!!editingPlanId">
            <mat-option *ngFor="let t of teachers" [value]="t.id">
              {{t.fullName}} ({{t.employeeCode}})
            </mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Date -->
        <mat-form-field appearance="outline" class="col-half">
          <mat-label>Plan Date *</mat-label>
          <input matInput type="date" [(ngModel)]="addForm.planDate">
        </mat-form-field>

        <!-- Subject Dropdown (DB Bound - Full Width) -->
        <mat-form-field appearance="outline" class="col-full">
          <mat-label>Subject (विषय) *</mat-label>
          <mat-select [ngModel]="addForm.subjectId" (ngModelChange)="onSubjectSelect($event)">
            <mat-option [value]="undefined">-- Select Subject --</mat-option>
            <mat-option *ngFor="let s of subjects" [value]="s.id">
              {{s.name}} <span *ngIf="s.code">({{s.code}})</span>
            </mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Stream Type Selector: School vs Coaching -->
        <div class="col-full target-toggle-box">
          <label class="toggle-label">क्लास या बैच चुनें (Class or Batch Stream):</label>
          <div class="toggle-pills">
            <button type="button" class="pill-btn" [class.active]="streamType === 'School'" (click)="setStreamType('School')">
              <mat-icon>school</mat-icon> School Class &amp; Section
            </button>
            <button type="button" class="pill-btn" [class.active]="streamType === 'Coaching'" (click)="setStreamType('Coaching')">
              <mat-icon>class</mat-icon> Coaching Batch
            </button>
          </div>
        </div>

        <!-- If School Class Stream -->
        <ng-container *ngIf="streamType === 'School'">
          <mat-form-field appearance="outline" class="col-half">
            <mat-label>School Class (कक्षा)</mat-label>
            <mat-select [(ngModel)]="selectedClassId" (selectionChange)="onSchoolClassChange()">
              <mat-option [value]="''">-- Select School Class --</mat-option>
              <mat-option *ngFor="let c of schoolClasses" [value]="c.id">
                {{c.name}}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="col-half">
            <mat-label>Section (वर्ग)</mat-label>
            <mat-select [(ngModel)]="addForm.classSectionId">
              <mat-option [value]="undefined">-- Select Section --</mat-option>
              <mat-option *ngFor="let sec of availableSections" [value]="sec.id">
                {{sec.name}}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </ng-container>

        <!-- If Coaching Batch Stream -->
        <mat-form-field appearance="outline" class="col-full" *ngIf="streamType === 'Coaching'">
          <mat-label>Coaching Batch</mat-label>
          <mat-select [(ngModel)]="addForm.batchId">
            <mat-option [value]="undefined">-- Select Coaching Batch --</mat-option>
            <mat-option *ngFor="let b of batches" [value]="b.id">{{b.name}}</mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Chapter & Topic Taught -->
        <mat-form-field appearance="outline" class="col-full">
          <mat-label>Chapter &amp; Topic Taught *</mat-label>
          <input matInput [(ngModel)]="addForm.chapterTopic" placeholder="e.g. Chapter 6: Life Processes — Respiration Mechanism & ATP Cycle">
        </mat-form-field>

        <!-- Learning Objectives -->
        <mat-form-field appearance="outline" class="col-full">
          <mat-label>Learning Objectives / शिक्षण उद्देश्य</mat-label>
          <input matInput [(ngModel)]="addForm.learningObjectives" placeholder="Students understand aerobic vs anaerobic respiration">
        </mat-form-field>

        <!-- Teaching Methodology -->
        <mat-form-field appearance="outline" class="col-half">
          <mat-label>Teaching Methodology</mat-label>
          <mat-select [(ngModel)]="addForm.teachingMethodology">
            <mat-option value="Lecture & Board Work">Lecture &amp; Board Work</mat-option>
            <mat-option value="Interactive Discussion">Interactive Discussion</mat-option>
            <mat-option value="Laboratory / Experiment">Laboratory / Experiment</mat-option>
            <mat-option value="Doubt Clearing / Problem Solving">Doubt Clearing / Problem Solving</mat-option>
            <mat-option value="Revision & Pop Quiz">Revision &amp; Pop Quiz</mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Status -->
        <mat-form-field appearance="outline" class="col-half">
          <mat-label>Status *</mat-label>
          <mat-select [(ngModel)]="addForm.status">
            <mat-option value="Completed">Completed</mat-option>
            <mat-option value="InProgress">In Progress</mat-option>
            <mat-option value="Revision">Revision</mat-option>
            <mat-option value="Planned">Planned</mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Homework Assigned -->
        <mat-form-field appearance="outline" class="col-full">
          <mat-label>Homework / गृहकार्य Assigned</mat-label>
          <textarea matInput rows="2" [(ngModel)]="addForm.homeworkAssigned" placeholder="e.g. Solve textbook Q1 to Q6 in notebook; revise diagram for tomorrow's quiz."></textarea>
        </mat-form-field>

        <!-- Principal / Supervisor Feedback (When Editing) -->
        <mat-form-field appearance="outline" class="col-full" *ngIf="editingPlanId">
          <mat-label>Principal / Supervisor Feedback (फीडबैक)</mat-label>
          <input matInput [(ngModel)]="editFeedback" placeholder="e.g. Well planned; ensure weak students submit homework on time.">
        </mat-form-field>
      </div>
    </div>

    <div class="modal-footer">
      <button mat-button (click)="closeAddModal()">Cancel</button>
      <button mat-raised-button color="primary" class="primary-btn" [disabled]="saving || !addForm.teacherId || !addForm.subjectName || !addForm.chapterTopic" (click)="saveLessonPlan()">
        <mat-icon *ngIf="!saving">check</mat-icon>
        <span>{{saving ? 'Saving...' : (editingPlanId ? 'Update Diary Entry' : 'Save Diary Entry')}}</span>
      </button>
    </div>
  </div>
</div>
  `,
  styles: [`
    .page-container {
      padding: 24px;
      max-width: 1300px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      gap: 16px;
      flex-wrap: wrap;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .header-icon-box {
      width: 48px;
      height: 48px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
    }

    .page-title {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      color: #1e3a8a;
    }

    .page-subtitle {
      margin: 4px 0 0;
      font-size: 13px;
      color: #64748b;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: #ffffff;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      border: 1px solid #e2e8f0;
    }

    .stat-icon {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .comp-icon { background: #f0fdf4; color: #16a34a; }
    .prog-icon { background: #eff6ff; color: #2563eb; }
    .rev-icon { background: #fef3c7; color: #d97706; }
    .total-icon { background: #f8fafc; color: #475569; }

    .stat-value {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
    }

    .stat-label {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }

    .filter-card {
      padding: 14px 20px;
      margin-bottom: 20px;
      border-radius: 12px;
      background: #ffffff;
    }

    .filter-row {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .filter-item {
      width: 220px;
    }

    .plans-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 18px;
    }

    .plan-card {
      padding: 18px;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .plan-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .plan-date-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 700;
      color: #1e3a8a;
      background: #eff6ff;
      padding: 4px 8px;
      border-radius: 6px;
    }

    .plan-date-chip mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .status-chip {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
      text-transform: uppercase;
    }

    .status-completed { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
    .status-inprogress { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
    .status-revision { background: #fef3c7; color: #d97706; border: 1px solid #fde68a; }
    .status-planned { background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; }

    .teacher-info-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .t-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #2563eb;
      color: #ffffff;
      font-weight: 700;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .t-name {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }

    .t-sub {
      font-size: 12px;
      color: #64748b;
    }

    .topic-highlight {
      background: #f8fafc;
      padding: 10px 12px;
      border-radius: 8px;
      border-left: 3px solid #2563eb;
    }

    .topic-title {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 3px;
    }

    .obj-text {
      font-size: 11px;
      color: #64748b;
    }

    .meta-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .meta-pill {
      font-size: 11px;
      color: #475569;
      background: #f1f5f9;
      padding: 3px 8px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .meta-pill mat-icon {
      font-size: 13px;
      width: 13px;
      height: 13px;
      color: #64748b;
    }

    .homework-box {
      background: #f0fdf4;
      border-left: 3px solid #16a34a;
      padding: 8px 10px;
      border-radius: 4px;
      font-size: 12px;
    }

    .hw-title {
      font-weight: 700;
      color: #166534;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 2px;
    }

    .hw-title mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .hw-content {
      color: #14532d;
    }

    .feedback-box {
      background: #eff6ff;
      border-left: 3px solid #3b82f6;
      padding: 8px 10px;
      border-radius: 4px;
      font-size: 12px;
    }

    .fb-title {
      font-weight: 700;
      color: #1e40af;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 2px;
    }

    .fb-title mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .fb-content {
      color: #1e3a8a;
    }

    .plan-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 8px;
      border-top: 1px solid #f1f5f9;
      margin-top: auto;
    }

    .created-at {
      font-size: 11px;
      color: #94a3b8;
    }

    .card-actions {
      display: flex;
      gap: 2px;
    }

    .empty-card {
      text-align: center;
      padding: 48px;
      border-radius: 12px;
    }

    .empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #94a3b8;
      margin-bottom: 12px;
    }

    /* Strict Modal Styles */
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .modal-container {
      background: #ffffff;
      border-radius: 16px;
      width: 100%;
      max-width: 660px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      animation: modalFadeIn 0.2s ease-out;
    }

    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }

    .modal-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-left-box {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-icon {
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }

    .modal-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #1e3a8a;
    }

    .modal-subtitle {
      margin: 2px 0 0;
      font-size: 12px;
      color: #3b82f6;
    }

    .close-btn {
      color: #64748b;
    }

    .close-btn:hover {
      color: #1e293b;
    }

    .modal-body {
      padding: 20px;
      max-height: 70vh;
      overflow-y: auto;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .col-full {
      grid-column: span 2;
    }

    .col-half {
      grid-column: span 1;
    }

    .target-toggle-box {
      margin-bottom: 2px;
    }
    .toggle-label {
      display: block;
      font-size: 0.8rem;
      font-weight: 600;
      color: #475569;
      margin-bottom: 6px;
    }
    .toggle-pills {
      display: flex;
      gap: 10px;
    }
    .pill-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px 16px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
      color: #475569;
      font-size: 0.84rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #64748b; }
      &:hover { background: #f8fafc; border-color: #94a3b8; }
      &.active {
        background: #eff6ff;
        border-color: #2563eb;
        color: #1e40af;
        mat-icon { color: #2563eb; }
      }
    }

    .modal-footer {
      padding: 14px 20px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
  `]
})
export class TeacherLessonPlansComponent implements OnInit {
  lessonPlans: TeacherLessonPlanDto[] = [];
  teachers: TeacherDto[] = [];
  batches: BatchDto[] = [];
  schoolClasses: any[] = [];
  subjects: SubjectDto[] = [];
  availableSections: any[] = [];
  selectedClassId: string = '';
  streamType: 'School' | 'Coaching' = 'School';
  loading = false;
  saving = false;

  filterTeacherId: string = '';
  filterStatus: string = '';

  showAddModal = false;
  editingPlanId: string | null = null;
  editFeedback: string = '';

  addForm: CreateTeacherLessonPlanDto = {
    teacherId: '',
    planDate: new Date().toISOString().substring(0, 10),
    subjectName: '',
    chapterTopic: '',
    learningObjectives: '',
    teachingMethodology: 'Lecture & Board Work',
    homeworkAssigned: '',
    status: 'Completed',
    completionPercentage: '100%'
  };

  constructor(
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit() {
    this.loadTeachers();
    this.loadBatches();
    this.loadSchoolClasses();
    this.loadSubjects();
    this.loadLessonPlans();
  }

  loadSchoolClasses() {
    this.http.get<any[]>(`${API_BASE}/school/classes?activeOnly=true`).subscribe({
      next: res => this.schoolClasses = res || [],
      error: () => this.schoolClasses = []
    });
  }

  loadSubjects() {
    this.http.get<SubjectDto[]>(`${API_BASE}/subjects?activeOnly=true`).subscribe({
      next: res => this.subjects = res || [],
      error: () => this.subjects = []
    });
  }

  setStreamType(type: 'School' | 'Coaching') {
    this.streamType = type;
    if (type === 'School') {
      this.addForm.batchId = undefined;
    } else {
      this.addForm.classSectionId = undefined;
      this.selectedClassId = '';
      this.availableSections = [];
    }
  }

  onSchoolClassChange() {
    this.addForm.classSectionId = undefined;
    const cls = this.schoolClasses.find(c => c.id === this.selectedClassId);
    this.availableSections = cls?.sections || [];
    if (this.availableSections.length === 1) {
      this.addForm.classSectionId = this.availableSections[0].id;
    }
  }

  onSubjectSelect(subId: string) {
    const sub = this.subjects.find(s => s.id === subId);
    if (sub) {
      this.addForm.subjectId = sub.id;
      this.addForm.subjectName = sub.name;
    } else {
      this.addForm.subjectId = undefined;
      this.addForm.subjectName = '';
    }
  }

  loadTeachers() {
    this.http.get<TeacherDto[]>(`${API_BASE}/teachers`).subscribe({
      next: res => this.teachers = res.filter(t => t.isActive),
      error: () => {}
    });
  }

  loadBatches() {
    this.http.get<BatchDto[]>(`${API_BASE}/batches`).subscribe({
      next: res => this.batches = res,
      error: () => {}
    });
  }

  loadLessonPlans() {
    this.loading = true;
    let url = `${API_BASE}/teachers/lesson-plans?`;
    if (this.filterTeacherId) url += `teacherId=${this.filterTeacherId}&`;
    if (this.filterStatus) url += `status=${this.filterStatus}&`;

    this.http.get<TeacherLessonPlanDto[]>(url).subscribe({
      next: res => {
        this.lessonPlans = res;
        this.loading = false;
      },
      error: () => {
        this.lessonPlans = [];
        this.loading = false;
      }
    });
  }

  resetFilters() {
    this.filterTeacherId = '';
    this.filterStatus = '';
    this.loadLessonPlans();
  }

  getCompletedCount(): number {
    return this.lessonPlans.filter(p => p.status === 'Completed').length;
  }

  getInProgressCount(): number {
    return this.lessonPlans.filter(p => p.status === 'InProgress').length;
  }

  getRevisionCount(): number {
    return this.lessonPlans.filter(p => p.status === 'Revision').length;
  }

  getInitials(name: string): string {
    if (!name) return 'ST';
    const clean = name.replace(/[()[\]{}_-]/g, ' ').replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const parts = clean.split(/\s+/).filter(p => p.length > 0);
    if (parts.length === 0) return 'ST';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  openAddModal() {
    this.editingPlanId = null;
    this.editFeedback = '';
    this.streamType = 'School';
    this.selectedClassId = '';
    this.availableSections = [];
    this.addForm = {
      teacherId: this.teachers.length > 0 ? this.teachers[0].id : '',
      planDate: new Date().toISOString().substring(0, 10),
      subjectName: '',
      chapterTopic: '',
      learningObjectives: '',
      teachingMethodology: 'Lecture & Board Work',
      homeworkAssigned: '',
      status: 'Completed',
      completionPercentage: '100%'
    };
    this.showAddModal = true;
  }

  openEditModal(plan: TeacherLessonPlanDto) {
    this.editingPlanId = plan.id;
    this.editFeedback = plan.principalFeedback || '';
    if (plan.classSectionId) {
      this.streamType = 'School';
      const foundCls = this.schoolClasses.find(c => c.sections?.some((s: any) => s.id === plan.classSectionId));
      if (foundCls) {
        this.selectedClassId = foundCls.id;
        this.availableSections = foundCls.sections || [];
      }
    } else if (plan.batchId) {
      this.streamType = 'Coaching';
      this.selectedClassId = '';
      this.availableSections = [];
    } else {
      this.streamType = 'School';
      this.selectedClassId = '';
      this.availableSections = [];
    }

    this.addForm = {
      teacherId: plan.teacherId,
      planDate: plan.planDate ? plan.planDate.substring(0, 10) : new Date().toISOString().substring(0, 10),
      batchId: plan.batchId,
      classSectionId: plan.classSectionId,
      subjectId: plan.subjectId,
      subjectName: plan.subjectName,
      chapterTopic: plan.chapterTopic,
      learningObjectives: plan.learningObjectives || '',
      teachingMethodology: plan.teachingMethodology || 'Lecture & Board Work',
      homeworkAssigned: plan.homeworkAssigned || '',
      status: plan.status,
      completionPercentage: plan.completionPercentage || '100%',
      studentResponse: plan.studentResponse || '',
      remarks: plan.remarks || ''
    };
    this.showAddModal = true;
  }

  closeAddModal() {
    this.showAddModal = false;
  }

  saveLessonPlan() {
    if (!this.addForm.teacherId || !this.addForm.subjectName || !this.addForm.chapterTopic) {
      this.confirmDialog.alert('Required Fields', 'Please fill in all required fields (Teacher, Subject, Chapter/Topic).', 'warning');
      return;
    }

    this.saving = true;

    if (this.editingPlanId) {
      const updateDto: UpdateTeacherLessonPlanDto = {
        chapterTopic: this.addForm.chapterTopic,
        learningObjectives: this.addForm.learningObjectives,
        homeworkAssigned: this.addForm.homeworkAssigned,
        status: this.addForm.status,
        completionPercentage: this.addForm.completionPercentage,
        studentResponse: this.addForm.studentResponse,
        remarks: this.addForm.remarks,
        principalFeedback: this.editFeedback,
        subjectId: this.addForm.subjectId,
        subjectName: this.addForm.subjectName,
        batchId: this.addForm.batchId,
        classSectionId: this.addForm.classSectionId
      };

      this.http.put(`${API_BASE}/teachers/lesson-plans/${this.editingPlanId}`, updateDto).subscribe({
        next: () => {
          this.saving = false;
          this.showAddModal = false;
          this.confirmDialog.alert('Updated', 'Diary entry updated successfully!', 'success');
          this.loadLessonPlans();
        },
        error: () => {
          this.saving = false;
          this.confirmDialog.alert('Error', 'Failed to update diary entry. Please try again.', 'danger');
        }
      });
    } else {
      this.http.post<TeacherLessonPlanDto>(`${API_BASE}/teachers/lesson-plans`, this.addForm).subscribe({
        next: () => {
          this.saving = false;
          this.showAddModal = false;
          this.confirmDialog.alert('Logged', 'Lesson plan logged successfully!', 'success');
          this.loadLessonPlans();
        },
        error: () => {
          this.saving = false;
          this.confirmDialog.alert('Error', 'Failed to save lesson plan. Please try again.', 'danger');
        }
      });
    }
  }

  deleteLessonPlan(id: string) {
    this.confirmDialog.danger('Delete Diary Entry?', 'Are you sure you want to delete this diary / lesson plan record?').subscribe(ok => {
      if (!ok) return;

      this.http.delete(`${API_BASE}/teachers/lesson-plans/${id}`).subscribe({
        next: () => {
          this.confirmDialog.alert('Deleted', 'Lesson plan record deleted successfully.', 'success');
          this.loadLessonPlans();
        },
        error: () => this.confirmDialog.alert('Error', 'Failed to delete record.', 'danger')
      });
    });
  }
}
