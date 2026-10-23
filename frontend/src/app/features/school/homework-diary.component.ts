import { Component, OnInit, Inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';
import { HindiTransliterationService, HINDI_QUICK_PRESETS } from '../../core/services/hindi-transliteration.service';
import { BatchesService, BatchDto } from '../../core/services/batches.service';
import { HwCheckPanelComponent, HwAnalyticsPanelComponent } from './homework-hw-check.component';
import { environment } from '../../../environments/environment';

const API_BASE = environment.apiUrl;

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

export type HwStatus = 'Pending' | 'Completed' | 'Partial' | 'NotDone';

export interface DailySubjectTaskItem {
  subject: string;
  task: string;
  isHindiMode?: boolean;
  teacherId?: string | null;
  teacherName?: string | null;
  status?: HwStatus | null;
  statusRemark?: string | null;
  checkedAt?: string | null;
  checkedByName?: string | null;
}

export interface DailyStudentDiaryRow {
  studentId: string;
  studentName: string;
  rollNumber?: string;
  admissionNumber?: string;
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  batchId?: string;
  batchName?: string;
  isAbsent: boolean;
  attendanceStatus?: string;
  classWork: DailySubjectTaskItem[];
  homeWork: DailySubjectTaskItem[];
  remarks?: string;
  diaryId?: string;
  parentWhatsAppPhone?: string;
}

export interface DailyDiaryReportHeader {
  tenantName?: string;
  institutionName?: string;
  tenantAddress?: string;
  subtitleOrAddress?: string;
  reportTitle: string;
  reportDate?: string;
  diaryDate?: string;
  className?: string;
  sectionName?: string;
  batchName?: string;
  classTeacherName?: string | null;
  items?: DailyStudentDiaryRow[];
  rows?: DailyStudentDiaryRow[];
  previousHwDate?: string | null;
  previousHw?: {
    studentId: string;
    studentName: string;
    rollNumber: string;
    isAbsent: boolean;
    homeWork: DailySubjectTaskItem[];
  }[] | null;
}


@Component({
  selector: 'app-homework-diary',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule, MatProgressBarModule,
    MatMenuModule, IstDatetimeDirective, HwCheckPanelComponent, HwAnalyticsPanelComponent
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

          <button mat-raised-button class="create-btn" *ngIf="activeTab === 'teacher' && diarySubTab === 'worksheets'" (click)="openHomeworkDialog()">
            <mat-icon>add_circle</mat-icon>
            <span>Assign Homework</span>
          </button>
        </div>
      </div>

      <!-- TEACHER / ADMIN VIEW -->
      <ng-container *ngIf="activeTab === 'teacher'">
        <!-- Sub-Navigation Bar: Daily Diary Sheet vs Check HW vs Analytics vs Worksheets -->
        <div class="diary-subtabs-nav notranslate" translate="no">
          <button class="subtab-pill" [class.active]="diarySubTab === 'daily-diary'" (click)="setDiarySubTab('daily-diary')">
            <div class="subtab-icon-wrap"><mat-icon>menu_book</mat-icon></div>
            <div class="pill-labels">
              <span class="pill-title">Daily CW &amp; HW Diary</span>
              <span class="pill-desc">Daily Sheet, Assigning &amp; Print Report</span>
            </div>
            <span class="pill-badge">Daily Report</span>
          </button>
          <button class="subtab-pill" [class.active]="diarySubTab === 'check-hw'" (click)="setDiarySubTab('check-hw')">
            <div class="subtab-icon-wrap"><mat-icon>fact_check</mat-icon></div>
            <div class="pill-labels">
              <span class="pill-title">Check H.W.</span>
              <span class="pill-desc">Same-Day / Next-Day Verification &amp; Ticks</span>
            </div>
            <span class="pill-badge">Verify Ticks</span>
          </button>
          <button class="subtab-pill" [class.active]="diarySubTab === 'hw-analytics'" (click)="setDiarySubTab('hw-analytics')">
            <div class="subtab-icon-wrap"><mat-icon>insights</mat-icon></div>
            <div class="pill-labels">
              <span class="pill-title">H.W. Analytics</span>
              <span class="pill-desc">Student &amp; Subject Wise Defaulter Analysis</span>
            </div>
          </button>
          <button class="subtab-pill" [class.active]="diarySubTab === 'worksheets'" (click)="setDiarySubTab('worksheets')">
            <div class="subtab-icon-wrap"><mat-icon>assignment</mat-icon></div>
            <div class="pill-labels">
              <span class="pill-title">Worksheets &amp; Copy Submissions</span>
              <span class="pill-desc">Subject Assignments &amp; Digital Copy Submissions</span>
            </div>
          </button>
          <a class="subtab-pill" routerLink="/school/good-manners" style="text-decoration: none;">
            <div class="subtab-icon-wrap" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff;"><mat-icon>hotel_class</mat-icon></div>
            <div class="pill-labels">
              <span class="pill-title">Good Manners &amp; Behaviour</span>
              <span class="pill-desc">Daily Conduct, Stars &amp; Report</span>
            </div>
            <span class="pill-badge" style="background: #fef3c7; color: #b45309; border-color: #fde68a;">⭐ Daily Report</span>
          </a>
          <a class="subtab-pill" routerLink="/school/monthly-performance" style="text-decoration: none;">
            <div class="subtab-icon-wrap" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff;"><mat-icon>insights</mat-icon></div>
            <div class="pill-labels">
              <span class="pill-title">Monthly Performance</span>
              <span class="pill-desc">360° Scorecard &amp; Ranks</span>
            </div>
            <span class="pill-badge" style="background: #e0f2fe; color: #0369a1; border-color: #bae6fd;">📊 Monthly Report</span>
          </a>
        </div>

        <!-- =================================================================== -->
        <!-- TAB 1: DAILY CLASSWORK & HOMEWORK DIARY SHEET (REPORT READY)       -->
        <!-- =================================================================== -->
        <ng-container *ngIf="diarySubTab === 'daily-diary'">
          <!-- Scope Switcher Pill Tabs -->
          <div class="scope-nav-container">
            <div class="scope-pills">
              <button
                type="button"
                class="scope-pill-btn"
                [class.active]="diaryScope === 'school'"
                (click)="setDiaryScope('school')">
                <mat-icon>school</mat-icon>
                <span>School Classes (स्कूल कक्षाएं)</span>
              </button>

              <button
                type="button"
                class="scope-pill-btn"
                [class.active]="diaryScope === 'coaching'"
                (click)="setDiaryScope('coaching')">
                <mat-icon>groups</mat-icon>
                <span>Coaching Batches (कोचिंग बैचेस)</span>
              </button>
            </div>

            <div class="scope-meta-badge">
              <mat-icon>verified</mat-icon>
              <span *ngIf="diaryScope === 'school'">Scope: <strong>School Classwork &amp; Homework Diary</strong></span>
              <span *ngIf="diaryScope === 'coaching'">Scope: <strong>Coaching Batch DPP &amp; Daily Diary</strong></span>
            </div>
          </div>

          <!-- Filter & Action Controls Card -->
          <div class="daily-diary-filter-card">
            <div class="dd-filter-row">
              <mat-form-field appearance="outline" class="dd-date-field">
                <mat-label>Diary Date (तारीख)</mat-label>
                <input matInput type="date" [(ngModel)]="diaryDate" (change)="loadDailyDiary()">
              </mat-form-field>

              <ng-container *ngIf="diaryScope === 'school'">
                <mat-form-field appearance="outline" class="dd-class-field" [class.field-locked]="isClassTeacherLocked">
                  <mat-label>Select Class (कक्षा) *</mat-label>
                  <mat-select [(ngModel)]="diaryClassId" (selectionChange)="onDiaryClassChange()" [disabled]="isClassTeacherLocked">
                    <mat-option *ngFor="let c of classes" [value]="c.id" [class.ct-highlight-opt]="isClassTeacherOf(c)">
                      {{c.name}}
                      <span class="ct-pill-badge" *ngIf="isClassTeacherOf(c)">⭐ Class Teacher</span>
                    </mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="dd-section-field" *ngIf="diarySections.length > 0" [class.field-locked]="isClassTeacherLocked && !!teacherAssignedSectionId">
                  <mat-label>Section (वर्ग)</mat-label>
                  <mat-select [(ngModel)]="diarySectionId" (selectionChange)="onDiarySectionChange()" [disabled]="isClassTeacherLocked && !!teacherAssignedSectionId">
                    <mat-option value="">All Sections</mat-option>
                    <mat-option *ngFor="let s of diarySections" [value]="s.id">{{s.name}}</mat-option>
                  </mat-select>
                </mat-form-field>
              </ng-container>

              <ng-container *ngIf="diaryScope === 'coaching'">
                <mat-form-field appearance="outline" class="dd-class-field">
                  <mat-label>Academic Class (कक्षा)</mat-label>
                  <mat-select [(ngModel)]="diaryCoachingClassId" (selectionChange)="onDiaryCoachingClassChange()">
                    <mat-option value="">All Classes (सभी कक्षाएं)</mat-option>
                    <mat-option *ngFor="let c of classes" [value]="c.id">{{c.name}}</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="dd-batch-field">
                  <mat-label>Select Coaching Batch (बैच) *</mat-label>
                  <mat-select [(ngModel)]="diaryBatchId" (selectionChange)="onDiaryBatchChange()">
                    <mat-option *ngIf="filteredCoachingBatches.length === 0" disabled value="">
                      No Batches Found for this Class
                    </mat-option>
                    <mat-option *ngFor="let b of filteredCoachingBatches" [value]="b.id">
                      {{b.name}} <span *ngIf="b.subject || b.courseName">({{b.subject || b.courseName}})</span>
                    </mat-option>
                  </mat-select>
                </mat-form-field>
              </ng-container>

              <!-- Student Filter Dropdown (All Students vs Individual Student) - Expanded Full Width -->
              <mat-form-field appearance="outline" class="dd-student-field" *ngIf="diaryStudents.length > 0">
                <mat-label>Student (विद्यार्थी)</mat-label>
                <mat-select [(ngModel)]="selectedDiaryStudentId" (selectionChange)="onDiaryStudentSelectChange()" panelClass="dd-student-select-panel">
                  <mat-option value="">👥 All Students (सम्पूर्ण {{ diaryScope === 'coaching' ? 'बैच' : 'कक्षा' }} - {{diaryStudents.length}} बच्चे)</mat-option>
                  <mat-option *ngFor="let st of diaryStudents" [value]="st.studentId">
                    👤 {{st.studentName}} <span *ngIf="st.rollNumber">(Roll: {{st.rollNumber}})</span>
                  </mat-option>
                </mat-select>
              </mat-form-field>

              <div class="dd-action-buttons">
                <button mat-stroked-button class="quickfill-toggle-btn" (click)="commonQuickFill.isOpen = !commonQuickFill.isOpen" [disabled]="diaryScope === 'school' ? !diaryClassId : !diaryBatchId">
                  <mat-icon>{{commonQuickFill.isOpen ? 'expand_less' : 'bolt'}}</mat-icon>
                  <span>{{commonQuickFill.isOpen ? 'Hide Quick Fill' : 'Quick Fill Common Work'}}</span>
                </button>

                <button mat-stroked-button class="print-report-btn" (click)="openDailyDiaryReportDialog()" [disabled]="diaryStudents.length === 0">
                  <mat-icon>print</mat-icon>
                  <span>Print / WhatsApp Report</span>
                </button>

                <button mat-raised-button class="save-diary-btn" (click)="saveDailyDiary()" [disabled]="savingDiary || diaryStudents.length === 0">
                  <mat-icon *ngIf="!savingDiary">save</mat-icon>
                  <mat-icon *ngIf="savingDiary" class="spin">sync</mat-icon>
                  <span>{{savingDiary ? 'Saving...' : 'Save Diary Sheet'}}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Quick Fill Accordion Panel -->
          <div class="quickfill-container" *ngIf="commonQuickFill.isOpen && (diaryScope === 'school' ? !!diaryClassId : !!diaryBatchId)">
            <div class="qf-header">
              <div class="qf-title-box">
                <div class="qf-icon-wrap" [class.student-mode-icon]="!!selectedDiaryStudent">
                  <mat-icon>{{selectedDiaryStudent ? 'person' : 'flash_on'}}</mat-icon>
                </div>
                <div>
                  <h4 *ngIf="!selectedDiaryStudent">1-Click Apply Common Daily Tasks to All Present Students</h4>
                  <h4 *ngIf="selectedDiaryStudent">
                    1-Click Apply Task to: <span class="student-target-name">{{selectedDiaryStudent.studentName}}</span>
                    <span *ngIf="selectedDiaryStudent.rollNumber">(Roll: {{selectedDiaryStudent.rollNumber}})</span>
                  </h4>
                  <p *ngIf="!selectedDiaryStudent">Type daily C.W. &amp; H.W. for Hindi, English, Math, etc. once, then click "Apply to All Present" to fill the entire class in 1 second.</p>
                  <p *ngIf="selectedDiaryStudent">Type tasks below and click "Apply to {{selectedDiaryStudent.studentName}}" to assign customized tasks for this student.</p>
                </div>
              </div>
              <div class="qf-actions-wrap">
                <button mat-flat-button class="apply-all-btn" [class.student-mode]="!!selectedDiaryStudent" (click)="applyCommonToAllPresent()" [disabled]="diaryStudents.length === 0">
                  <mat-icon>{{selectedDiaryStudent ? 'person_add' : 'done_all'}}</mat-icon>
                  <span *ngIf="!selectedDiaryStudent">Apply to All Present ({{diaryEligibleForWorkCount}})</span>
                  <span *ngIf="selectedDiaryStudent">Apply to {{selectedDiaryStudent.studentName}}</span>
                </button>
                <button mat-stroked-button class="qf-switch-all-btn" *ngIf="selectedDiaryStudent" (click)="selectedDiaryStudentId = ''">
                  <mat-icon>groups</mat-icon>
                  <span>Show All Class</span>
                </button>
              </div>
            </div>

            <div class="qf-grids">
              <!-- Class Work Column -->
              <div class="qf-col">
                <div class="qf-col-title cw-title">
                  <div class="title-left">
                    <mat-icon>edit_note</mat-icon>
                    <span>CLASS WORK (C.W.)</span>
                  </div>
                  <button mat-button class="qf-add-btn" (click)="addSubjectTask(commonQuickFill.classWork)">
                    <mat-icon>add</mat-icon> Add Subject
                  </button>
                </div>
                <div class="qf-task-rows">
                  <div class="qf-task-block" *ngFor="let item of commonQuickFill.classWork; let i = index">
                    <div class="qf-task-item">
                      <select class="qf-subject-select" [(ngModel)]="item.subject" (change)="onSubjectChange(item)">
                        <option *ngFor="let s of subjectOptions" [value]="s">{{s}}</option>
                      </select>
                      <div class="qf-task-input-wrap">
                        <input
                          #cwQuickInput
                          type="text"
                          class="qf-task-input"
                          [(ngModel)]="item.task"
                          (keydown)="onTaskKeydown($event, item, cwQuickInput)"
                          (blur)="onTaskBlur(item)"
                          [placeholder]="isHindiActive(item) ? 'हिन्दी C.W. (जैसे: ki + Space दबाएं = कि)...' : 'e.g. B to U, 1 to 10 counting...'"
                        >
                        <div class="qf-input-badges">
                          <button
                            type="button"
                            class="lang-pill notranslate"
                            translate="no"
                            [class.active]="isHindiActive(item)"
                            (click)="toggleHindiMode(item)"
                            [matTooltip]="isHindiActive(item) ? '🇮🇳 हिन्दी टाइपिंग चालू है (ki + Space = कि). Click to switch to English' : 'Click to enable Hindi phonetic typing'">
                            <span class="notranslate" translate="no">{{isHindiActive(item) ? '🇮🇳 हिन्दी' : 'ENG'}}</span>
                          </button>
                          <button
                            type="button"
                            class="convert-pill"
                            *ngIf="isHindiActive(item) && hasEnglish(item.task)"
                            (click)="convertTaskToHindi(item)"
                            matTooltip="Convert typed English text into Hindi (हिन्दी में बदलें)">
                            <mat-icon>translate</mat-icon>
                            <span>बदलें</span>
                          </button>
                        </div>
                      </div>
                      <button class="qf-remove-btn" (click)="removeSubjectTask(commonQuickFill.classWork, i)" *ngIf="commonQuickFill.classWork.length > 1">
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>

                    <!-- Junior Class Quick Presets for Hindi -->
                    <div class="hindi-presets-bar" *ngIf="isHindiActive(item)">
                      <span class="preset-label">⚡ त्वरित कार्य:</span>
                      <div class="preset-chips-scroll">
                        <button type="button" class="preset-chip" *ngFor="let preset of hindiPresets" (click)="applyHindiPreset(item, preset)">
                          {{preset}}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Home Work Column -->
              <div class="qf-col">
                <div class="qf-col-title hw-title">
                  <div class="title-left">
                    <mat-icon>home</mat-icon>
                    <span>HOME WORK (H.W.)</span>
                  </div>
                  <button mat-button class="qf-add-btn" (click)="addSubjectTask(commonQuickFill.homeWork)">
                    <mat-icon>add</mat-icon> Add Subject
                  </button>
                </div>
                <div class="qf-task-rows">
                  <div class="qf-task-block" *ngFor="let item of commonQuickFill.homeWork; let i = index">
                    <div class="qf-task-item">
                      <select class="qf-subject-select" [(ngModel)]="item.subject" (change)="onSubjectChange(item)">
                        <option *ngFor="let s of subjectOptions" [value]="s">{{s}}</option>
                      </select>
                      <div class="qf-task-input-wrap">
                        <input
                          #hwQuickInput
                          type="text"
                          class="qf-task-input"
                          [(ngModel)]="item.task"
                          (keydown)="onTaskKeydown($event, item, hwQuickInput)"
                          (blur)="onTaskBlur(item)"
                          [placeholder]="isHindiActive(item) ? 'हिन्दी H.W. (e.g. C.W. जैसा, Page 14 — ki + Space)...' : 'e.g. Same as C.W., Page 14 Practice...'"
                        >
                        <div class="qf-input-badges">
                          <button
                            type="button"
                            class="lang-pill notranslate"
                            translate="no"
                            [class.active]="isHindiActive(item)"
                            (click)="toggleHindiMode(item)"
                            [matTooltip]="isHindiActive(item) ? '🇮🇳 हिन्दी टाइपिंग चालू है (ki + Space = कि). Click to switch to English' : 'Click to enable Hindi phonetic typing'">
                            <span class="notranslate" translate="no">{{isHindiActive(item) ? '🇮🇳 हिन्दी' : 'ENG'}}</span>
                          </button>
                          <button
                            type="button"
                            class="convert-pill"
                            *ngIf="isHindiActive(item) && hasEnglish(item.task)"
                            (click)="convertTaskToHindi(item)"
                            matTooltip="Convert typed English text into Hindi (हिन्दी में बदलें)">
                            <mat-icon>translate</mat-icon>
                            <span>बदलें</span>
                          </button>
                        </div>
                      </div>
                      <button class="qf-remove-btn" (click)="removeSubjectTask(commonQuickFill.homeWork, i)" *ngIf="commonQuickFill.homeWork.length > 1">
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>

                    <!-- Junior Class Quick Presets for Hindi -->
                    <div class="hindi-presets-bar" *ngIf="isHindiActive(item)">
                      <span class="preset-label">⚡ त्वरित कार्य:</span>
                      <div class="preset-chips-scroll">
                        <button type="button" class="preset-chip" *ngFor="let preset of hindiPresets" (click)="applyHindiPreset(item, preset)">
                          {{preset}}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State: No Class Selected -->
          <div class="empty-diary-state" *ngIf="!diaryClassId">
            <div class="empty-icon-wrap"><mat-icon>auto_stories</mat-icon></div>
            <h3>Select a Class to Open Daily Diary</h3>
            <p>Please select a class (e.g. Play, Nursery, LKG, UKG, Class 1) above to load students, sync attendance, and manage daily C.W. &amp; H.W.</p>
          </div>

          <!-- Empty State: No Students Found in Selected Class -->
          <div class="empty-diary-state" *ngIf="diaryClassId && !loadingDiary && diaryStudents.length === 0">
            <div class="empty-icon-wrap"><mat-icon>group_off</mat-icon></div>
            <h3>No Students Found in this Class</h3>
            <p>No active students are enrolled in the selected class or section.</p>
          </div>

          <!-- Student Roster Diary Table -->
          <div class="diary-roster-card" *ngIf="diaryClassId && !loadingDiary && diaryStudents.length > 0">
            <div class="roster-header-bar">
              <div class="roster-summary">
                <ng-container *ngIf="!selectedDiaryStudent">
                  <span class="count-pill all">Total Students: <strong>{{diaryStudents.length}}</strong></span>
                  <span class="count-pill present">Present: <strong>{{diaryPresentCount}}</strong></span>
                  <span class="count-pill late" *ngIf="diaryLateCount > 0">Late: <strong>{{diaryLateCount}}</strong></span>
                  <span class="count-pill halfday" *ngIf="diaryHalfDayCount > 0">Half Day: <strong>{{diaryHalfDayCount}}</strong></span>
                  <span class="count-pill absent">Absent: <strong>{{diaryAbsentCount}}</strong></span>
                  <span class="count-pill leave" *ngIf="diaryLeaveCount > 0">Leave: <strong>{{diaryLeaveCount}}</strong></span>
                  <span class="count-pill not-marked" *ngIf="diaryNotMarkedCount > 0">Not Marked: <strong>{{diaryNotMarkedCount}}</strong></span>
                </ng-container>

                <ng-container *ngIf="selectedDiaryStudent">
                  <span class="count-pill student-focus">
                    <mat-icon class="pill-ic">person</mat-icon>
                    Selected: <strong>{{selectedDiaryStudent.studentName}}</strong>
                    <span *ngIf="selectedDiaryStudent.rollNumber">(Roll: {{selectedDiaryStudent.rollNumber}})</span>
                  </span>
                  <button mat-button class="view-all-pill-btn" (click)="selectedDiaryStudentId = ''">
                    <mat-icon>groups</mat-icon>
                    <span>View All Class ({{diaryStudents.length}})</span>
                  </button>
                  <div class="student-stepper-btns">
                    <button mat-button class="step-student-btn" (click)="prevDiaryStudent()" [disabled]="!canPrevStudent" matTooltip="Previous Student">
                      <mat-icon>chevron_left</mat-icon> Prev
                    </button>
                    <button mat-button class="step-student-btn" (click)="nextDiaryStudent()" [disabled]="!canNextStudent" matTooltip="Next Student">
                      Next <mat-icon>chevron_right</mat-icon>
                    </button>
                  </div>
                </ng-container>
              </div>
              <div class="roster-help">
                <mat-icon>verified</mat-icon>
                <span *ngIf="!selectedDiaryStudent">Showing all students. Use the Student dropdown above to edit an individual child's tasks.</span>
                <span *ngIf="selectedDiaryStudent">Individual Mode: Editing tasks specifically for {{selectedDiaryStudent.studentName}}.</span>
              </div>
            </div>

            <div class="diary-table-responsive">
              <table class="diary-entry-table">
                <thead>
                  <tr>
                    <th style="width: 44px;" class="text-center">#</th>
                    <th style="width: 210px;">Student Details</th>
                    <th style="width: 125px;" class="text-center">Attendance</th>
                    <th style="min-width: 380px;">CLASS WORK (C.W.)</th>
                    <th style="min-width: 300px;">HOME WORK (H.W.)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let s of filteredDiaryStudents; let idx = index" [class.student-absent-row]="s.isAbsent" [class.student-notmarked-row]="!s.isAbsent && s.attendanceStatus === 'NotMarked'">
                    <td class="text-center idx-cell">{{diaryStudents.indexOf(s) + 1}}</td>
                    <td class="student-info-cell">
                      <div class="student-info-header">
                        <div class="student-name-text">{{s.studentName}}</div>
                        <div class="student-actions-cluster">
                          <button type="button" class="st-main-wa-btn" (click)="sendStudentWhatsAppFromMain(s)" [matTooltip]="'Open WhatsApp for ' + s.studentName">
                            <mat-icon>chat</mat-icon>
                          </button>
                          <button mat-icon-button class="student-action-dots-btn" [matMenuTriggerFor]="studentActionMenu" matTooltip="Student actions">
                            <mat-icon>more_vert</mat-icon>
                          </button>
                        </div>
                      </div>
                      <div class="student-meta-sub">
                        <span *ngIf="s.rollNumber">Roll: {{s.rollNumber}}</span>
                        <span *ngIf="s.admissionNumber">Adm: {{s.admissionNumber}}</span>
                        <span *ngIf="s.className">{{s.className}}</span>
                      </div>
                      <div class="student-general-note-pill" *ngIf="s.remarks" (click)="openRemarkDialog(s)" [matTooltip]="s.remarks">
                        <mat-icon>chat_bubble</mat-icon>
                        <span class="note-pill-text">{{s.remarks}}</span>
                        <mat-icon class="note-pill-del" (click)="$event.stopPropagation(); s.remarks = ''">close</mat-icon>
                      </div>

                      <mat-menu #studentActionMenu="matMenu">
                        <button mat-menu-item (click)="sendStudentWhatsAppFromMain(s)">
                          <mat-icon class="text-success">chat</mat-icon>
                          <span>Send WhatsApp to Parent</span>
                        </button>
                        <button mat-menu-item (click)="openRemarkDialog(s)">
                          <mat-icon color="primary">edit_note</mat-icon>
                          <span>{{ s.remarks ? 'Edit General Note' : 'Add General Note' }}</span>
                        </button>
                        <button mat-menu-item *ngIf="s.remarks" (click)="s.remarks = ''">
                          <mat-icon class="text-danger">clear</mat-icon>
                          <span>Clear General Note</span>
                        </button>
                        <button mat-menu-item (click)="clearStudentTasks(s)" [disabled]="!hasStudentTasks(s)">
                          <mat-icon class="text-danger">delete_sweep</mat-icon>
                          <span>Clear All Tasks</span>
                        </button>
                      </mat-menu>
                    </td>
                    <td class="attendance-cell text-center">
                      <span class="att-status-badge" [ngClass]="getAttendanceBadgeClass(s)">
                        <mat-icon>{{getAttendanceIcon(s)}}</mat-icon>
                        <span>{{getAttendanceLabel(s)}}</span>
                      </span>
                    </td>

                    <!-- If Student is Absent -->
                    <ng-container *ngIf="s.isAbsent">
                      <td colspan="2" class="absent-banner-cell">
                        <div class="row-absent-badge-wrap">
                          <span class="roster-absent-pill" [class.leave]="s.attendanceStatus === 'Leave'">
                            {{s.attendanceStatus === 'Leave' ? 'ON LEAVE TODAY' : 'ABSENT TODAY'}}
                          </span>
                          <span class="absent-hint-text">
                            {{s.attendanceStatus === 'Leave' ? 'Student is officially on leave today.' : 'Student is marked absent in daily attendance.'}}
                          </span>
                        </div>
                      </td>
                    </ng-container>

                    <!-- If Attendance is NOT MARKED: Disabled / Locked Banner -->
                    <ng-container *ngIf="!s.isAbsent && s.attendanceStatus === 'NotMarked'">
                      <td colspan="2" class="notmarked-banner-cell">
                        <div class="row-notmarked-badge-wrap">
                          <span class="roster-notmarked-pill">
                            <mat-icon>lock</mat-icon>
                            <span>ATTENDANCE NOT MARKED &bull; DIARY LOCKED</span>
                          </span>
                          <span class="notmarked-hint-text">
                            Please mark attendance first in Attendance Management to unlock diary entry.
                          </span>
                        </div>
                      </td>
                    </ng-container>

                    <!-- If Student is Present / Late (Attending) -->
                    <ng-container *ngIf="!s.isAbsent && s.attendanceStatus !== 'NotMarked'">
                      <!-- C.W. Cell -->
                      <td class="tasks-entry-cell">
                        <div class="entry-task-list">
                          <div class="entry-task-block" *ngFor="let cw of s.classWork; let cIdx = index">
                            <div class="entry-task-row">
                              <select class="entry-sub-select" [(ngModel)]="cw.subject" (change)="onSubjectChange(cw)">
                                <option *ngFor="let opt of subjectOptions" [value]="opt">{{opt}}</option>
                              </select>
                              <span class="task-arrow">&rarr;</span>
                              <div class="entry-input-wrap">
                                <input
                                  #cwRowInput
                                  type="text"
                                  class="entry-task-input"
                                  [(ngModel)]="cw.task"
                                  (keydown)="onTaskKeydown($event, cw, cwRowInput)"
                                  (blur)="onTaskBlur(cw)"
                                  [placeholder]="isHindiActive(cw) ? 'हिन्दी C.W. (ki + Space = कि)...' : 'Enter classwork task...'"
                                >
                                <button
                                  type="button"
                                  class="row-lang-pill notranslate"
                                  translate="no"
                                  [class.active]="isHindiActive(cw)"
                                  (click)="toggleHindiMode(cw)"
                                  [matTooltip]="isHindiActive(cw) ? 'हिन्दी मोड चालू (ki + Space = कि). Click to switch to English' : 'Click to enable Hindi phonetic typing'">
                                  <span class="notranslate" translate="no">{{isHindiActive(cw) ? '🇮🇳' : 'EN'}}</span>
                                </button>
                                <button
                                  type="button"
                                  class="row-convert-pill"
                                  *ngIf="isHindiActive(cw) && hasEnglish(cw.task)"
                                  (click)="convertTaskToHindi(cw)"
                                  matTooltip="Convert to Hindi (हिन्दी में बदलें)">
                                  अ
                                </button>
                              </div>

                              <!-- Subject-wise C.W. Note / Status Button -->
                              <button
                                type="button"
                                class="cw-sub-note-btn"
                                [class.has-note]="cw.statusRemark"
                                [ngClass]="getCwNoteBadgeClass(cw.statusRemark)"
                                [matMenuTriggerFor]="cwRowNoteMenu"
                                matTooltip="Click to set subject-wise C.W. note (Checked, Remember, etc.)">
                                <span class="note-btn-label">{{ cw.statusRemark || '+ Note' }}</span>
                                <mat-icon class="note-btn-caret">arrow_drop_down</mat-icon>
                              </button>
                              <mat-menu #cwRowNoteMenu="matMenu" class="cw-note-dropdown-panel">
                                <button mat-menu-item (click)="cw.statusRemark = '✅ Checked'">
                                  <span class="cw-item-opt ok">✅ Checked</span>
                                </button>
                                <button mat-menu-item (click)="cw.statusRemark = '⏳ Unchecked'">
                                  <span class="cw-item-opt warn">⏳ Unchecked</span>
                                </button>
                                <button mat-menu-item (click)="cw.statusRemark = '🧠 Remember'">
                                  <span class="cw-item-opt purple">🧠 Remember</span>
                                </button>
                                <button mat-menu-item (click)="cw.statusRemark = '❌ No Remember'">
                                  <span class="cw-item-opt red">❌ No Remember</span>
                                </button>
                                <button mat-menu-item (click)="cw.statusRemark = '⭐ Very Good'">
                                  <span class="cw-item-opt gold">⭐ Very Good</span>
                                </button>
                                <button mat-menu-item (click)="cw.statusRemark = '✍️ Needs Writing'">
                                  <span class="cw-item-opt blue">✍️ Needs Writing</span>
                                </button>
                                <div class="cw-menu-divider"></div>
                                <button mat-menu-item (click)="openCustomCwNoteDialog(cw, s)">
                                  <mat-icon color="primary">edit_note</mat-icon>
                                  <span>Custom Note / Type...</span>
                                </button>
                                <button mat-menu-item *ngIf="cw.statusRemark" (click)="cw.statusRemark = ''">
                                  <mat-icon class="text-danger">clear</mat-icon>
                                  <span class="text-danger">Clear Note</span>
                                </button>
                              </mat-menu>

                              <button type="button" class="entry-del-btn" (click)="removeSubjectTask(s.classWork, cIdx)">
                                <mat-icon>close</mat-icon>
                              </button>
                            </div>
                            <div class="row-mini-presets" *ngIf="isHindiActive(cw) && !cw.task">
                              <button type="button" class="mini-chip" *ngFor="let p of hindiMiniPresets" (click)="applyHindiPreset(cw, p)">{{p}}</button>
                            </div>
                          </div>
                        </div>
                        <button type="button" class="add-sub-link-btn" (click)="addSubjectTask(s.classWork)">
                          <mat-icon>add</mat-icon>
                          <span>Add Subject</span>
                        </button>
                      </td>

                      <!-- H.W. Cell -->
                      <td class="tasks-entry-cell">
                        <div class="entry-task-list">
                          <div class="entry-task-block" *ngFor="let hw of s.homeWork; let hIdx = index">
                            <div class="entry-task-row">
                              <select class="entry-sub-select" [(ngModel)]="hw.subject" (change)="onSubjectChange(hw)">
                                <option *ngFor="let opt of subjectOptions" [value]="opt">{{opt}}</option>
                              </select>
                              <span class="task-arrow">&rarr;</span>
                              <div class="entry-input-wrap">
                                <input
                                  #hwRowInput
                                  type="text"
                                  class="entry-task-input"
                                  [(ngModel)]="hw.task"
                                  (keydown)="onTaskKeydown($event, hw, hwRowInput)"
                                  (blur)="onTaskBlur(hw)"
                                  [placeholder]="isHindiActive(hw) ? 'हिन्दी H.W. (ki + Space = कि)...' : 'Enter homework task...'"
                                >
                                <button
                                  type="button"
                                  class="row-lang-pill notranslate"
                                  translate="no"
                                  [class.active]="isHindiActive(hw)"
                                  (click)="toggleHindiMode(hw)"
                                  [matTooltip]="isHindiActive(hw) ? 'हिन्दी मोड चालू (ki + Space = कि). Click to switch to English' : 'Click to enable Hindi phonetic typing'">
                                  <span class="notranslate" translate="no">{{isHindiActive(hw) ? '🇮🇳' : 'EN'}}</span>
                                </button>
                                <button
                                  type="button"
                                  class="row-convert-pill"
                                  *ngIf="isHindiActive(hw) && hasEnglish(hw.task)"
                                  (click)="convertTaskToHindi(hw)"
                                  matTooltip="Convert to Hindi (हिन्दी में बदलें)">
                                  अ
                                </button>
                              </div>
                              <button type="button" class="entry-del-btn" (click)="removeSubjectTask(s.homeWork, hIdx)">
                                <mat-icon>close</mat-icon>
                              </button>
                            </div>
                            <div class="hw-entry-meta" *ngIf="hw.teacherName">
                              <span>Assigned by {{hw.teacherName}}</span>
                            </div>
                            <div class="row-mini-presets" *ngIf="isHindiActive(hw) && !hw.task">
                              <button type="button" class="mini-chip" *ngFor="let p of hindiMiniPresets" (click)="applyHindiPreset(hw, p)">{{p}}</button>
                            </div>
                          </div>
                        </div>
                        <button type="button" class="add-sub-link-btn" (click)="addSubjectTask(s.homeWork)">
                          <mat-icon>add</mat-icon>
                          <span>Add Subject</span>
                        </button>
                      </td>
                    </ng-container>


                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Bottom Floating Action Bar -->
            <div class="diary-bottom-action-bar">
              <div class="bottom-left-summary">
                <span *ngIf="!selectedDiaryStudent">
                  Showing <strong>{{diaryStudents.length}}</strong> students &bull; 
                  <strong>{{diaryPresentCount}}</strong> Present
                  <span *ngIf="diaryLateCount > 0"> &bull; <strong>{{diaryLateCount}}</strong> Late</span>
                  <span *ngIf="diaryHalfDayCount > 0"> &bull; <strong>{{diaryHalfDayCount}}</strong> Half Day</span>
                  <span *ngIf="diaryNotMarkedCount > 0"> &bull; <strong>{{diaryNotMarkedCount}}</strong> Not Marked</span>
                  &bull; <strong class="text-red">{{diaryAbsentCount}}</strong> Absent
                  <span *ngIf="diaryLeaveCount > 0"> &bull; <strong class="text-purple">{{diaryLeaveCount}}</strong> Leave</span>
                </span>
                <span *ngIf="selectedDiaryStudent">Showing student: <strong>{{selectedDiaryStudent.studentName}}</strong> (1 of {{diaryStudents.length}} in class)</span>
              </div>
              <div class="bottom-right-actions">
                <button mat-stroked-button class="print-report-btn" (click)="openDailyDiaryReportDialog()">
                  <mat-icon>print</mat-icon>
                  <span>Print / WhatsApp Report</span>
                </button>
                <button mat-raised-button class="save-diary-btn" (click)="saveDailyDiary()" [disabled]="savingDiary">
                  <mat-icon *ngIf="!savingDiary">save</mat-icon>
                  <mat-icon *ngIf="savingDiary" class="spin">sync</mat-icon>
                  <span>{{savingDiary ? 'Saving...' : 'Save All Changes'}}</span>
                </button>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- =================================================================== -->
        <!-- TAB: CHECK HOMEWORK (SAME-DAY / NEXT-DAY / BACK-DATED VERIFICATION) -->
        <!-- =================================================================== -->
        <ng-container *ngIf="diarySubTab === 'check-hw'">
          <app-hw-check-panel
            [classes]="classes"
            [classId]="diaryClassId"
            [sectionId]="diarySectionId"
            [isClassTeacherLocked]="isClassTeacherLocked"
            [teacherAssignedSectionId]="teacherAssignedSectionId"
            (openReport)="openReportFromCheckHw($event)"
            (saved)="onHwCheckSaved()">
          </app-hw-check-panel>
        </ng-container>

        <!-- =================================================================== -->
        <!-- TAB: HOMEWORK COMPLETION ANALYTICS & DEFAULTER LIST                -->
        <!-- =================================================================== -->
        <ng-container *ngIf="diarySubTab === 'hw-analytics'">
          <app-hw-analytics-panel
            [classes]="classes"
            [classId]="diaryClassId"
            [sectionId]="diarySectionId"
            [isClassTeacherLocked]="isClassTeacherLocked"
            [teacherAssignedSectionId]="teacherAssignedSectionId">
          </app-hw-analytics-panel>
        </ng-container>

        <!-- =================================================================== -->
        <!-- TAB 2: WORKSHEETS & ASSIGNMENTS (HIGHER CLASSES / DIGITAL COPY)    -->
        <!-- =================================================================== -->
        <ng-container *ngIf="diarySubTab === 'worksheets'">
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

        <!-- Scope Switcher Pill Tabs -->
        <div class="scope-nav-container">
          <div class="scope-pills">
            <button
              type="button"
              class="scope-pill-btn"
              [class.active]="worksheetScope === 'school'"
              (click)="setWorksheetScope('school')">
              <mat-icon>school</mat-icon>
              <span>School Classes (स्कूल कक्षाएं)</span>
            </button>

            <button
              type="button"
              class="scope-pill-btn"
              [class.active]="worksheetScope === 'coaching'"
              (click)="setWorksheetScope('coaching')">
              <mat-icon>groups</mat-icon>
              <span>Coaching Batches (कोचिंग बैचेस)</span>
            </button>
          </div>

          <div class="scope-meta-badge">
            <mat-icon>assignment</mat-icon>
            <span *ngIf="worksheetScope === 'school'">Scope: <strong>School Class Assignments</strong></span>
            <span *ngIf="worksheetScope === 'coaching'">Scope: <strong>Coaching Batch DPPs &amp; Practice Sheets</strong></span>
          </div>
        </div>

        <!-- Filter Bar -->
        <div class="filter-card">
          <div class="filter-row">
            <ng-container *ngIf="worksheetScope === 'school'">
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
            </ng-container>

            <ng-container *ngIf="worksheetScope === 'coaching'">
              <mat-form-field appearance="outline" class="filter-field">
                <mat-label>Academic Class (कक्षा)</mat-label>
                <mat-select [(ngModel)]="filterCoachingClassId" (selectionChange)="onWorksheetCoachingClassChange()">
                  <mat-option value="">All Classes (सभी कक्षाएं)</mat-option>
                  <mat-option *ngFor="let c of classes" [value]="c.id">{{c.name}}</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="filter-field">
                <mat-label>Filter by Batch</mat-label>
                <mat-select [(ngModel)]="filterBatchId" (selectionChange)="loadHomework()">
                  <mat-option value="">All Batches</mat-option>
                  <mat-option *ngFor="let b of filteredWorksheetBatches" [value]="b.id">{{b.name}}</mat-option>
                </mat-select>
              </mat-form-field>
            </ng-container>

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

    /* ========================================================================= */
    /* DAILY CLASSWORK & HOMEWORK DIARY STYLES                                   */
    /* ========================================================================= */
    .diary-subtabs-nav {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      background: #ffffff;
      padding: 6px;
      border-radius: 12px;
      border: 1px solid #bfdbfe;
      position: sticky;
      top: 0;
      z-index: 20;
      box-shadow: 0 4px 14px rgba(15,23,42,0.08);
    }
    .subtab-pill {
      flex: 1;
      min-width: 240px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      border: 1.5px solid transparent;
      border-radius: 12px;
      background: transparent;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s ease;
      position: relative;
    }
    .subtab-icon-wrap {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.2s ease;
    }
    .subtab-pill:hover {
      background: #f1f5f9;
    }
    .subtab-pill:hover .subtab-icon-wrap {
      background: #eff6ff;
      color: #2563eb;
      border-color: #bfdbfe;
    }
    .subtab-pill.active {
      background: #ffffff;
      border-color: #bfdbfe;
      box-shadow: 0 2px 8px rgba(37,99,235,0.08);
    }
    .subtab-pill.active .subtab-icon-wrap {
      background: #2563eb;
      color: #ffffff;
      border-color: #2563eb;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }
    .subtab-icon-wrap mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
      line-height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: visible;
    }
    .pill-labels {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .pill-title {
      font-size: 14px;
      font-weight: 800;
      color: #334155;
    }
    .subtab-pill.active .pill-title {
      color: #1e3a8a;
    }
    .pill-desc {
      font-size: 11.5px;
      color: #64748b;
    }
    .pill-badge {
      margin-left: auto;
      background: #eff6ff;
      color: #2563eb;
      font-size: 11px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 12px;
      border: 1px solid #bfdbfe;
    }

    /* Scope Switcher Pill Tabs */
    .scope-nav-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }
    .scope-pills {
      display: inline-flex;
      background: #e2e8f0;
      padding: 4px;
      border-radius: 10px;
      gap: 4px;
    }
    .scope-pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: none;
      background: transparent;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .scope-pill-btn:hover {
      color: #1e293b;
    }
    .scope-pill-btn.active {
      background: #ffffff;
      color: #1d4ed8;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      font-weight: 700;
    }
    .scope-pill-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .scope-meta-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 500;
    }
    .scope-meta-badge mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #2563eb;
    }

    /* Filter Card for Daily Diary */
    .daily-diary-filter-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .dd-filter-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .dd-date-field { min-width: 165px; flex: 0 0 auto; }
    .dd-class-field { min-width: 175px; flex: 0 0 auto; }
    .dd-section-field { min-width: 130px; flex: 0 0 auto; }
    .dd-batch-field { min-width: 230px; flex: 0 0 auto; }
    .dd-student-field {
      flex: 1 1 340px;
      min-width: 280px;
      max-width: 100%;
    }
    .dd-student-field ::ng-deep .mat-mdc-select-value {
      max-width: 100%;
    }
    .dd-student-field ::ng-deep .mat-mdc-select-value-text {
      font-weight: 700;
      color: #1e3a8a;
      font-size: 13px;
    }
    ::ng-deep .dd-student-select-panel {
      min-width: 360px !important;
      max-width: 92vw !important;
    }
    .field-locked ::ng-deep .mat-mdc-text-field-wrapper {
      background-color: #f1f5f9 !important;
      cursor: not-allowed !important;
    }
    .field-locked ::ng-deep .mat-mdc-select-value-text {
      color: #1e40af !important;
      font-weight: 800 !important;
    }
    .ct-pill-badge {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      border-radius: 4px;
      font-size: 10.5px;
      font-weight: 800;
      padding: 1px 6px;
      margin-left: 6px;
    }
    .ct-highlight-opt {
      background: #eff6ff !important;
      font-weight: 800 !important;
      color: #1d4ed8 !important;
    }
    .daily-diary-filter-card ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    
    .dd-action-buttons {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-left: auto;
      flex-wrap: wrap;
    }
    .quickfill-toggle-btn {
      border-color: #cbd5e1;
      color: #0f172a;
      font-weight: 600;
      border-radius: 8px;
      height: 42px;
    }
    .print-report-btn {
      border-color: #93c5fd;
      color: #1d4ed8;
      background: #eff6ff;
      font-weight: 700;
      border-radius: 8px;
      height: 42px;
    }
    .save-diary-btn {
      background: #2563eb !important;
      color: #ffffff !important;
      font-weight: 700;
      border-radius: 8px;
      height: 42px;
      padding: 0 20px;
    }

    /* Quick Fill Panel */
    .quickfill-container {
      background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
      border: 1.5px solid #bfdbfe;
      border-radius: 12px;
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-shadow: 0 2px 8px rgba(37,99,235,0.05);
    }
    .qf-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }
    .qf-title-box {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .qf-icon-wrap {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #2563eb;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(37,99,235,0.25);
    }
    .qf-icon-wrap.student-mode-icon {
      background: #7c3aed;
      box-shadow: 0 2px 6px rgba(124,58,237,0.25);
    }
    .qf-title-box h4 {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
      color: #1e3a8a;
    }
    .student-target-name {
      color: #7c3aed;
      font-weight: 900;
    }
    .qf-title-box p {
      margin: 2px 0 0;
      font-size: 12px;
      color: #475569;
    }
    .qf-actions-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .apply-all-btn {
      background: #16a34a !important;
      color: #ffffff !important;
      font-weight: 800;
      border-radius: 8px;
      height: 38px;
      padding: 0 18px;
      box-shadow: 0 2px 6px rgba(22,163,74,0.2);
    }
    .apply-all-btn.student-mode {
      background: #7c3aed !important;
      box-shadow: 0 2px 6px rgba(124,58,237,0.25) !important;
    }
    .qf-switch-all-btn {
      border-color: #cbd5e1;
      color: #475569;
      background: #ffffff;
      font-weight: 700;
      border-radius: 8px;
      height: 38px;
    }

    .qf-grids {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 800px) {
      .qf-grids { grid-template-columns: 1fr; }
    }
    .qf-col {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .qf-col-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      font-weight: 800;
      padding-bottom: 8px;
      border-bottom: 1px solid #f1f5f9;
    }
    .title-left {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .cw-title { color: #1d4ed8; }
    .hw-title { color: #059669; }
    .qf-add-btn {
      font-size: 12px;
      font-weight: 700;
      color: #2563eb;
      padding: 0 8px;
      height: 28px;
      line-height: 28px;
    }
    .qf-task-rows {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .qf-task-block {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .qf-task-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .qf-subject-select {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12.5px;
      font-weight: 700;
      color: #1e293b;
      min-width: 105px;
      outline: none;
    }
    .qf-task-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
      flex: 1;
    }
    .qf-task-input {
      width: 100%;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 120px 6px 12px;
      font-size: 13px;
      color: #0f172a;
      outline: none;
      box-sizing: border-box;
    }
    .qf-task-input:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 2px rgba(37,99,235,0.1);
    }
    .qf-input-badges {
      position: absolute;
      right: 6px;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .lang-pill {
      font-size: 10.5px;
      font-weight: 800;
      border-radius: 4px;
      padding: 2px 7px;
      cursor: pointer;
      border: 1px solid #cbd5e1;
      background: #f1f5f9;
      color: #475569;
      transition: all 0.15s ease;
    }
    .lang-pill.active {
      border-color: #93c5fd;
      background: #eff6ff;
      color: #1d4ed8;
      box-shadow: 0 1px 3px rgba(37,99,235,0.15);
    }
    .convert-pill {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 10.5px;
      font-weight: 800;
      border-radius: 4px;
      padding: 2px 7px;
      cursor: pointer;
      border: 1px solid #86efac;
      background: #f0fdf4;
      color: #15803d;
      box-shadow: 0 1px 3px rgba(22,163,74,0.15);
      animation: pulseConvert 1.5s infinite;
    }
    @keyframes pulseConvert {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    .convert-pill mat-icon {
      font-size: 13px;
      width: 13px;
      height: 13px;
    }
    .convert-pill:hover {
      background: #dcfce7;
      border-color: #4ade80;
    }
    .hindi-presets-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      background: #f8fafc;
      border-radius: 6px;
      border: 1px dashed #bfdbfe;
    }
    .preset-label {
      font-size: 11px;
      font-weight: 700;
      color: #1e40af;
      white-space: nowrap;
    }
    .preset-chips-scroll {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }
    .preset-chip {
      background: #ffffff;
      border: 1px solid #93c5fd;
      color: #1e3a8a;
      border-radius: 4px;
      padding: 2px 7px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    .preset-chip:hover {
      background: #eff6ff;
      border-color: #2563eb;
      color: #1d4ed8;
      transform: translateY(-1px);
    }
    .qf-remove-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 4px;
      border-radius: 4px;
    }
    .qf-remove-btn:hover { color: #dc2626; background: #fee2e2; }
    .qf-remove-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }

    /* Student Roster Card */
    .diary-roster-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      display: flex;
      flex-direction: column;
    }
    .roster-header-bar {
      padding: 14px 20px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }
    .roster-summary {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .count-pill {
      font-size: 12px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 20px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .count-pill.all { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
    .count-pill.present { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    .count-pill.late { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
    .count-pill.halfday { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
    .count-pill.absent { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .count-pill.leave { background: #faf5ff; color: #7e22ce; border: 1px solid #e9d5ff; }
    .count-pill.not-marked { background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; }
    .count-pill.student-focus {
      background: #f5f3ff;
      color: #6d28d9;
      border: 1.5px solid #c4b5fd;
      font-weight: 700;
    }
    .pill-ic { font-size: 15px; width: 15px; height: 15px; }
    .view-all-pill-btn {
      font-size: 11.5px;
      font-weight: 700;
      color: #2563eb;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      height: 28px;
      line-height: 28px;
      padding: 0 8px;
    }
    .view-all-pill-btn mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 4px; }
    .student-stepper-btns {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .step-student-btn {
      font-size: 11.5px;
      font-weight: 700;
      color: #475569;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      height: 28px;
      line-height: 28px;
      padding: 0 8px;
    }
    .step-student-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .step-student-btn:hover:not(:disabled) {
      background: #e2e8f0;
      color: #0f172a;
    }
    .roster-help {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #64748b;
    }
    .roster-help mat-icon { font-size: 16px; width: 16px; height: 16px; color: #059669; }

    .diary-table-responsive {
      width: 100%;
      overflow-x: auto;
    }
    .diary-entry-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .diary-entry-table th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 800;
      padding: 11px 12px;
      border-bottom: 1.5px solid #cbd5e1;
      text-align: left;
      white-space: nowrap;
    }
    .diary-entry-table td {
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
      background: #ffffff;
      box-sizing: border-box;
    }
    .idx-cell { font-weight: 800; color: #64748b; text-align: center; }
    .student-info-cell { min-width: 190px; }
    .student-info-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
    }
    .student-actions-cluster {
      display: flex;
      align-items: center;
      gap: 3px;
      flex-shrink: 0;
    }
    .st-main-wa-btn {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #86efac;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
      transition: all 0.15s ease;
      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        line-height: 14px;
      }
      &:hover {
        background: #16a34a;
        color: #ffffff;
        border-color: #16a34a;
        transform: scale(1.1);
      }
    }
    .student-action-dots-btn {
      width: 24px !important;
      height: 24px !important;
      line-height: 24px !important;
      color: #94a3b8;
      padding: 0 !important;
      flex-shrink: 0;
      mat-icon {
        font-size: 17px !important;
        width: 17px !important;
        height: 17px !important;
        line-height: 17px !important;
      }
      &:hover {
        color: #1e293b;
        background: #f1f5f9;
        border-radius: 4px;
      }
    }
    .student-name-text { font-size: 14px; font-weight: 800; color: #0f172a; }
    .student-meta-sub {
      font-size: 11.5px;
      color: #64748b;
      font-weight: 600;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 3px;
    }
    .student-general-note-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      margin-top: 6px;
      cursor: pointer;
      max-width: 100%;
      box-shadow: 0 1px 2px rgba(37,99,235,0.06);
      transition: all 0.15s ease;
      &:hover {
        background: #dbeafe;
        border-color: #93c5fd;
      }
      mat-icon {
        font-size: 13px !important;
        width: 13px !important;
        height: 13px !important;
        line-height: 13px !important;
        color: #2563eb;
      }
      .note-pill-text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 120px;
      }
      .note-pill-del {
        font-size: 12px !important;
        width: 12px !important;
        height: 12px !important;
        line-height: 12px !important;
        color: #64748b;
        margin-left: 2px;
        &:hover { color: #dc2626; }
      }
    }

    /* Attendance Status Read-Only Badge */
    .att-status-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 11.5px;
      font-weight: 800;
      letter-spacing: 0.5px;
      cursor: default;
      user-select: none;
      border: 1.5px solid #86efac;
      background: #f0fdf4;
      color: #16a34a;
      white-space: nowrap;
    }
    .att-status-badge mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .att-status-badge.status-present {
      background: #f0fdf4;
      color: #16a34a;
      border-color: #86efac;
    }
    .att-status-badge.status-late {
      background: #fffbeb;
      color: #d97706;
      border-color: #fcd34d;
    }
    .att-status-badge.status-halfday {
      background: #f0f9ff;
      color: #0284c7;
      border-color: #7dd3fc;
    }
    .att-status-badge.status-absent, .att-status-badge.is-absent {
      background: #fee2e2;
      color: #dc2626;
      border-color: #f87171;
    }
    .att-status-badge.status-leave {
      background: #faf5ff;
      color: #9333ea;
      border-color: #d8b4fe;
    }
    .att-status-badge.status-notmarked {
      background: #f1f5f9;
      color: #64748b;
      border-color: #cbd5e1;
    }
    .roster-absent-pill.leave {
      background: #faf5ff;
      color: #9333ea;
      border-color: #d8b4fe;
    }
    .text-purple { color: #9333ea; }

    /* Absent Row Styling */
    .student-absent-row td {
      background: #fff8f8;
    }
    /* Not Marked Row Styling */
    .student-notmarked-row td {
      background: #fafafa;
    }
    .notmarked-banner-cell {
      text-align: center;
      vertical-align: middle !important;
      padding: 16px !important;
      background: #f8fafc;
    }
    .row-notmarked-badge-wrap {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
    }
    .roster-notmarked-pill {
      background: #f1f5f9;
      color: #475569;
      border: 1.5px dashed #94a3b8;
      font-weight: 800;
      font-size: 12px;
      letter-spacing: 0.8px;
      padding: 5px 18px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .roster-notmarked-pill mat-icon { font-size: 16px; width: 16px; height: 16px; color: #64748b; }
    .notmarked-hint-text {
      font-size: 11.5px;
      color: #64748b;
      font-weight: 600;
    }
    .absent-banner-cell {
      text-align: center;
      vertical-align: middle !important;
      padding: 16px !important;
    }
    .row-absent-badge-wrap {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .roster-absent-pill {
      background: #fee2e2;
      color: #dc2626;
      border: 1.5px solid #f87171;
      font-weight: 900;
      font-size: 13px;
      letter-spacing: 2px;
      padding: 4px 24px;
      border-radius: 999px;
      box-shadow: 0 1px 3px rgba(220,38,38,0.1);
    }
    .absent-hint-text {
      font-size: 11px;
      color: #991b1b;
      opacity: 0.8;
    }

    /* Task Entry Cells in Roster */
    .tasks-entry-cell {
      min-width: 280px;
    }
    .entry-task-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .entry-task-block {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .entry-task-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .entry-sub-select {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 11.5px;
      font-weight: 700;
      color: #1e293b;
      width: 95px;
      outline: none;
      flex-shrink: 0;
    }
    .task-arrow {
      color: #94a3b8;
      font-weight: 700;
      flex-shrink: 0;
    }
    .entry-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
      flex: 1;
      min-width: 140px;
    }
    .entry-task-input {
      width: 100%;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 5px 56px 5px 8px;
      font-size: 12.5px;
      color: #0f172a;
      outline: none;
      box-sizing: border-box;
    }
    .entry-task-input:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 2px rgba(37,99,235,0.1);
    }
    .row-lang-pill {
      position: absolute;
      right: 4px;
      font-size: 9.5px;
      font-weight: 800;
      border-radius: 3px;
      padding: 1px 5px;
      border: 1px solid #cbd5e1;
      background: #f1f5f9;
      color: #475569;
      cursor: pointer;
    }
    .row-lang-pill.active {
      border-color: #93c5fd;
      background: #eff6ff;
      color: #1d4ed8;
    }
    .row-convert-pill {
      position: absolute;
      right: 32px;
      font-size: 10px;
      font-weight: 900;
      border-radius: 3px;
      padding: 1px 5px;
      border: 1px solid #86efac;
      background: #f0fdf4;
      color: #15803d;
      cursor: pointer;
    }
    .row-mini-presets {
      display: flex;
      align-items: center;
      gap: 3px;
      flex-wrap: wrap;
      padding-left: 108px;
    }
    .mini-chip {
      font-size: 9.5px;
      padding: 1px 5px;
      border-radius: 3px;
      border: 1px solid #bfdbfe;
      background: #f8fafc;
      color: #1e40af;
      cursor: pointer;
      transition: all 0.12s ease;
    }
    .mini-chip:hover {
      background: #eff6ff;
      border-color: #2563eb;
    }
    .entry-del-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 3px;
      border-radius: 4px;
      flex-shrink: 0;
    }
    .entry-del-btn:hover { color: #dc2626; background: #fee2e2; }
    .entry-del-btn mat-icon { font-size: 15px; width: 15px; height: 15px; }

    /* C.W. Subject-wise Note Pill Button & Presets */
    .cw-sub-note-btn {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      height: 28px;
      padding: 0 7px;
      border-radius: 5px;
      font-size: 11px;
      font-weight: 700;
      border: 1px dashed #cbd5e1;
      background: #f8fafc;
      color: #64748b;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      transition: all 0.15s ease;

      &:hover {
        background: #eff6ff;
        border-color: #93c5fd;
        color: #1e40af;
      }

      .note-btn-label {
        max-width: 92px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .note-btn-caret {
        font-size: 14px;
        width: 14px;
        height: 14px;
        line-height: 14px;
        opacity: 0.7;
        margin-left: -2px;
      }

      &.has-note {
        border-style: solid;
      }
      &.cw-note-checked {
        background: #dcfce7;
        color: #15803d;
        border-color: #86efac;
      }
      &.cw-note-unchecked {
        background: #fef3c7;
        color: #b45309;
        border-color: #fde68a;
      }
      &.cw-note-remember {
        background: #f3e8ff;
        color: #7e22ce;
        border-color: #d8b4fe;
      }
      &.cw-note-noremeber {
        background: #fee2e2;
        color: #dc2626;
        border-color: #fca5a5;
      }
      &.cw-note-good {
        background: #ecfdf5;
        color: #047857;
        border-color: #a7f3d0;
      }
      &.cw-note-writing {
        background: #eff6ff;
        color: #1d4ed8;
        border-color: #bfdbfe;
      }
      &.cw-note-custom {
        background: #e0f2fe;
        color: #0369a1;
        border-color: #bae6fd;
      }
    }

    .cw-note-dropdown-panel {
      .cw-item-opt {
        font-size: 12px;
        font-weight: 700;
        &.ok { color: #15803d; }
        &.warn { color: #b45309; }
        &.purple { color: #7e22ce; }
        &.red { color: #dc2626; }
        &.gold { color: #b45309; }
        &.blue { color: #1d4ed8; }
      }
      .cw-menu-divider {
        height: 1px;
        background: #e2e8f0;
        margin: 4px 0;
      }
    }

    .hw-status-group { display: inline-flex; gap: 3px; flex-shrink: 0; }
    .hw-status-btn {
      width: 24px; height: 24px; border-radius: 6px; border: 1px solid #cbd5e1;
      background: #ffffff; color: #94a3b8; font-size: 13px; font-weight: 800;
      line-height: 1; cursor: pointer; padding: 0; transition: all 0.12s ease;
    }
    .hw-status-btn:hover { background: #f1f5f9; }
    .hw-status-btn.st-completed.active { background: #dcfce7; border-color: #16a34a; color: #15803d; }
    .hw-status-btn.st-partial.active { background: #fef3c7; border-color: #d97706; color: #b45309; }
    .hw-status-btn.st-notdone.active { background: #fee2e2; border-color: #dc2626; color: #b91c1c; }
    .hw-entry-meta { font-size: 10.5px; color: #64748b; font-weight: 600; margin: 2px 0 0 2px; display: flex; gap: 6px; flex-wrap: wrap; }

    .add-sub-link-btn {
      background: transparent;
      border: none;
      color: #2563eb;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 4px 0 0 0;
      margin-top: 4px;
    }
    .add-sub-link-btn mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .add-sub-link-btn:hover { text-decoration: underline; }

    .remarks-cell {
      width: 150px;
      vertical-align: middle !important;
    }
    .remarks-cell-content {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .remark-pill-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      padding: 5px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      max-width: 110px;
      transition: all 0.15s ease;
      box-shadow: 0 1px 2px rgba(37,99,235,0.06);
    }
    .remark-pill-badge:hover {
      background: #dbeafe;
      border-color: #93c5fd;
      transform: translateY(-1px);
    }
    .remark-pill-badge .r-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: #2563eb;
      flex-shrink: 0;
    }
    .remark-pill-badge .r-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 65px;
    }
    .remark-pill-badge .r-edit {
      font-size: 13px;
      width: 13px;
      height: 13px;
      color: #64748b;
      opacity: 0.6;
      flex-shrink: 0;
    }
    .add-note-cell-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 5px 10px;
      border-radius: 8px;
      border: 1px dashed #cbd5e1;
      background: #f8fafc;
      color: #64748b;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
      white-space: nowrap;
    }
    .add-note-cell-btn:hover:not(:disabled) {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #1d4ed8;
      border-style: solid;
    }
    .add-note-cell-btn mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
    }
    .add-note-cell-btn:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
    .row-menu-btn {
      width: 28px !important;
      height: 28px !important;
      line-height: 28px !important;
      padding: 0 !important;
      color: #64748b;
      flex-shrink: 0;
    }
    .row-menu-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      line-height: 18px;
    }
    .row-menu-btn:hover {
      color: #0f172a;
      background: #f1f5f9;
    }

    /* Floating / Sticky Bottom Bar */
    .diary-bottom-action-bar {
      padding: 14px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }
    .bottom-left-summary {
      font-size: 13px;
      color: #475569;
    }
    .bottom-left-summary strong { color: #0f172a; }
    .text-red { color: #dc2626 !important; }
    .bottom-right-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    /* Empty Diary Prompt */
    .empty-diary-state {
      background: #ffffff;
      border: 1.5px dashed #cbd5e1;
      border-radius: 12px;
      padding: 50px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    .empty-diary-state h3 { margin: 0; font-size: 17px; font-weight: 700; color: #1e3a8a; }
    .empty-diary-state p { margin: 0; font-size: 13px; color: #64748b; max-width: 480px; }

    /* ========================================================================= */
    /* RESPONSIVE DESIGN: TABLET (640px - 1024px) & MOBILE (< 640px)             */
    /* ========================================================================= */
    @media (max-width: 1024px) {
      .diary-subtabs-nav {
        gap: 8px;
        padding: 6px;
      }
      .subtab-pill {
        flex: 1 1 calc(50% - 8px);
        min-width: 200px;
        padding: 10px 14px;
      }
      .dd-filter-row {
        gap: 10px;
      }
      .dd-action-buttons {
        margin-left: 0;
        width: 100%;
        justify-content: flex-start;
      }
      .qf-grids {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .hw-page-container {
        gap: 14px;
        padding-bottom: 24px;
      }
      .page-header {
        padding: 14px;
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }
      .header-left {
        gap: 12px;
      }
      .header-icon-box {
        width: 40px;
        height: 40px;
        border-radius: 10px;
      }
      .page-title {
        font-size: 17px;
      }
      .page-subtitle {
        font-size: 12px;
      }
      .header-actions {
        width: 100%;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }
      .role-view-switch {
        width: 100%;
      }
      .switch-pill {
        flex: 1;
        justify-content: center;
        padding: 8px 10px;
        font-size: 12px;
      }
      .refresh-btn {
        width: 100%;
        justify-content: center;
      }

      /* Subtabs Navigation on Mobile */
      .diary-subtabs-nav {
        flex-direction: column;
        gap: 6px;
        padding: 6px;
      }
      .subtab-pill {
        flex: 1 1 100%;
        min-width: 100%;
        padding: 8px 12px;
        gap: 10px;
      }
      .subtab-pill mat-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
      }
      .pill-title {
        font-size: 13px;
      }
      .pill-desc {
        display: none;
      }
      .pill-badge {
        font-size: 10px;
        padding: 2px 6px;
      }

      /* Filter Card */
      .daily-diary-filter-card {
        padding: 12px;
      }
      .dd-filter-row {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }
      .dd-date-field,
      .dd-class-field,
      .dd-section-field,
      .dd-student-field {
        width: 100%;
        min-width: 0;
      }
      .dd-action-buttons {
        width: 100%;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        margin-left: 0;
      }
      .dd-action-buttons button {
        width: 100%;
        justify-content: center;
      }

      /* Quick Fill Panel */
      .quickfill-container {
        padding: 12px;
      }
      .qf-header-bar {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }
      .qf-header-actions {
        width: 100%;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }
      .qf-header-actions button {
        width: 100%;
        justify-content: center;
      }
      .qf-task-row {
        flex-direction: column;
        align-items: stretch;
        gap: 6px;
        position: relative;
        padding-right: 32px;
      }
      .qf-subject-select {
        width: 100%;
      }
      .qf-task-input-wrap {
        width: 100%;
      }
      .qf-remove-btn {
        position: absolute;
        right: 0;
        top: 6px;
      }

      /* Roster Header */
      .roster-header-bar {
        padding: 12px;
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }
      .roster-summary {
        flex-wrap: wrap;
        gap: 6px;
      }
      .count-pill {
        font-size: 11px;
        padding: 3px 8px;
      }

      /* Diary Table Responsive */
      .diary-table-responsive {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      .diary-entry-table {
        min-width: 780px;
      }

      /* Bottom Action Bar */
      .diary-bottom-action-bar {
        padding: 12px;
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }
      .bottom-right-actions {
        width: 100%;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }
      .bottom-right-actions button {
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

  // Daily Classwork & Homework Diary State
  diarySubTab: 'daily-diary' | 'check-hw' | 'hw-analytics' | 'worksheets' = 'daily-diary';
  diaryDate: string = this.getTodayDateString();
  diaryClassId = '';
  diarySectionId = '';
  diarySections: any[] = [];
  diaryStudents: DailyStudentDiaryRow[] = [];
  selectedDiaryStudentId = '';
  loadingDiary = false;
  savingDiary = false;

  // Class Teacher Lock & Highlight State
  isClassTeacherLocked = false;
  teacherAssignedClassId = '';
  teacherAssignedClassName = '';
  teacherAssignedSectionId = '';
  teacherAssignedSectionName = '';
  linkedTeacher: any = null;

  get filteredDiaryStudents(): DailyStudentDiaryRow[] {
    if (!this.selectedDiaryStudentId) {
      return this.diaryStudents;
    }
    return this.diaryStudents.filter(s => s.studentId === this.selectedDiaryStudentId);
  }

  get selectedDiaryStudent(): DailyStudentDiaryRow | undefined {
    return this.diaryStudents.find(s => s.studentId === this.selectedDiaryStudentId);
  }

  get canPrevStudent(): boolean {
    if (!this.selectedDiaryStudentId || !this.diaryStudents.length) return false;
    return this.diaryStudents.findIndex(s => s.studentId === this.selectedDiaryStudentId) > 0;
  }

  get canNextStudent(): boolean {
    if (!this.diaryStudents.length) return false;
    if (!this.selectedDiaryStudentId) return this.diaryStudents.length > 0;
    const idx = this.diaryStudents.findIndex(s => s.studentId === this.selectedDiaryStudentId);
    return idx >= 0 && idx < this.diaryStudents.length - 1;
  }

  // Dynamic Subjects from API
  subjectOptions: string[] = [];
  classAllocatedSubjects: any[] = [];

  commonQuickFill = {
    isOpen: true,
    classWork: [] as DailySubjectTaskItem[],
    homeWork: [] as DailySubjectTaskItem[]
  };

  get diaryPresentCount(): number {
    return this.diaryStudents.filter(s => !s.isAbsent && (s.attendanceStatus || 'Present').toLowerCase() === 'present').length;
  }

  get diaryLateCount(): number {
    return this.diaryStudents.filter(s => !s.isAbsent && (s.attendanceStatus || '').toLowerCase() === 'late').length;
  }

  get diaryHalfDayCount(): number {
    return this.diaryStudents.filter(s => !s.isAbsent && (s.attendanceStatus || '').toLowerCase() === 'halfday').length;
  }

  get diaryAbsentCount(): number {
    return this.diaryStudents.filter(s => s.isAbsent || (s.attendanceStatus || '').toLowerCase() === 'absent').length;
  }

  get diaryLeaveCount(): number {
    return this.diaryStudents.filter(s => (s.attendanceStatus || '').toLowerCase() === 'leave').length;
  }

  get diaryNotMarkedCount(): number {
    return this.diaryStudents.filter(s => !s.isAbsent && (s.attendanceStatus || '').toLowerCase() === 'notmarked').length;
  }

  isStudentAttending(student: DailyStudentDiaryRow): boolean {
    if (student.isAbsent) return false;
    const status = (student.attendanceStatus || '').toLowerCase();
    return status === 'present' || status === 'late' || status === 'halfday';
  }

  get diaryEligibleForWorkCount(): number {
    return this.diaryStudents.filter(s => this.isStudentAttending(s)).length;
  }

  filterClassId = '';
  filterSectionId = '';
  filterStatus = '';
  searchTerm = '';

  // Coaching Batches & Dual-Mode Scope State
  batches: BatchDto[] = [];
  diaryScope: 'school' | 'coaching' = 'school';
  diaryCoachingClassId = '';
  diaryBatchId = '';
  worksheetScope: 'school' | 'coaching' = 'school';
  filterCoachingClassId = '';
  filterBatchId = '';

  get filteredCoachingBatches(): BatchDto[] {
    if (!this.diaryCoachingClassId) {
      return this.batches;
    }
    const target = this.diaryCoachingClassId.toLowerCase();
    return this.batches.filter(b => (b.classId || '').toLowerCase() === target);
  }

  get filteredWorksheetBatches(): BatchDto[] {
    if (!this.filterCoachingClassId) {
      return this.batches;
    }
    const target = this.filterCoachingClassId.toLowerCase();
    return this.batches.filter(b => (b.classId || '').toLowerCase() === target);
  }

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

  hindiPresets = HINDI_QUICK_PRESETS;
  hindiMiniPresets = ["'क' से 'ज्ञ'", "'कि' से 'की'", "दो अक्षर शब्द", "मात्रा अभ्यास", "सुलेख", "कविता"];

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService,
    public authService: AuthService,
    public hindiTrans: HindiTransliterationService,
    private batchesService: BatchesService
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
      this.loadBatches();
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

  loadBatches(): void {
    this.batchesService.getBatches().subscribe({
      next: b => {
        this.batches = b || [];
        if (this.diaryScope === 'coaching') {
          if (!this.diaryCoachingClassId && this.diaryClassId && this.batches.some(x => (x.classId || '').toLowerCase() === this.diaryClassId.toLowerCase())) {
            this.diaryCoachingClassId = this.diaryClassId;
          }
          this.onDiaryCoachingClassChange();
        }
        if (this.worksheetScope === 'coaching' && !this.filterBatchId && this.batches.length > 0) {
          this.filterBatchId = this.batches[0].id;
        }
      },
      error: () => this.batches = []
    });
  }

  setDiaryScope(scope: 'school' | 'coaching'): void {
    if (this.diaryScope === scope) return;
    this.diaryScope = scope;
    this.selectedDiaryStudentId = '';
    this.diaryStudents = [];
    if (scope === 'school') {
      if (!this.diaryClassId && this.classes.length > 0) {
        this.diaryClassId = this.classes[0].id;
      }
      this.onDiaryClassChange();
    } else {
      if (this.diaryClassId && this.batches.some(b => (b.classId || '').toLowerCase() === this.diaryClassId.toLowerCase())) {
        this.diaryCoachingClassId = this.diaryClassId;
      } else if (!this.diaryCoachingClassId && this.classes.length > 0) {
        const classWithBatch = this.classes.find(c => this.batches.some(b => (b.classId || '').toLowerCase() === c.id.toLowerCase()));
        this.diaryCoachingClassId = classWithBatch ? classWithBatch.id : '';
      }
      this.onDiaryCoachingClassChange();
    }
  }

  onDiaryCoachingClassChange(): void {
    const available = this.filteredCoachingBatches;
    if (available.length > 0) {
      if (!available.some(b => b.id === this.diaryBatchId)) {
        this.diaryBatchId = available[0].id;
      }
      this.onDiaryBatchChange();
    } else {
      this.diaryBatchId = '';
      this.diaryStudents = [];
      this.selectedDiaryStudentId = '';
    }
  }

  onDiaryBatchChange(): void {
    this.selectedDiaryStudentId = '';
    this.updateDynamicSubjectOptions();
    this.loadDailyDiary();
  }

  onWorksheetCoachingClassChange(): void {
    const available = this.filteredWorksheetBatches;
    if (available.length > 0) {
      if (!available.some(b => b.id === this.filterBatchId)) {
        this.filterBatchId = available[0].id;
      }
    } else {
      this.filterBatchId = '';
    }
    this.loadHomework();
  }

  setWorksheetScope(scope: 'school' | 'coaching'): void {
    if (this.worksheetScope === scope) return;
    this.worksheetScope = scope;
    if (scope === 'school') {
      this.filterBatchId = '';
    } else {
      this.filterClassId = '';
      this.filterSectionId = '';
      const available = this.filteredWorksheetBatches;
      if (!this.filterBatchId && available.length > 0) {
        this.filterBatchId = available[0].id;
      }
    }
    this.loadHomework();
  }

  setDiarySubTab(tab: 'daily-diary' | 'check-hw' | 'hw-analytics' | 'worksheets'): void {
    this.diarySubTab = tab;
    if (tab === 'daily-diary') {
      if (this.diaryScope === 'school') {
        if (this.diaryClassId) {
          this.loadDailyDiary();
        } else if (this.classes.length > 0) {
          this.diaryClassId = this.classes[0].id;
          this.onDiaryClassChange();
        }
      } else {
        if (this.diaryBatchId) {
          this.loadDailyDiary();
        } else if (this.batches.length > 0) {
          this.diaryBatchId = this.batches[0].id;
          this.onDiaryBatchChange();
        }
      }
    } else if (tab === 'check-hw' || tab === 'hw-analytics') {
      if (!this.diaryClassId && this.classes.length > 0) {
        this.diaryClassId = this.classes[0].id;
        this.onDiaryClassChange();
      }
    } else {
      this.loadHomework();
    }
  }

  onHwCheckSaved(): void {
    if (this.diaryScope === 'school' && this.diaryClassId) {
      this.loadDailyDiary();
    } else if (this.diaryScope === 'coaching' && this.diaryBatchId) {
      this.loadDailyDiary();
    }
  }

  getTodayDateString(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDisplayDate(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  }

  onDiaryClassChange(): void {
    this.diarySectionId = '';
    this.selectedDiaryStudentId = '';
    const found = this.classes.find(c => c.id === this.diaryClassId);
    this.diarySections = found?.sections || [];

    if (this.diaryClassId) {
      this.http.get<any[]>(`${API_BASE}/subjects/classes/${this.diaryClassId}`).subscribe({
        next: classSubs => {
          this.classAllocatedSubjects = classSubs || [];
          this.updateDynamicSubjectOptions();
          this.loadDailyDiary();
        },
        error: () => {
          this.classAllocatedSubjects = [];
          this.updateDynamicSubjectOptions();
          this.loadDailyDiary();
        }
      });
    } else {
      this.classAllocatedSubjects = [];
      this.updateDynamicSubjectOptions();
      this.loadDailyDiary();
    }
  }

  onDiarySectionChange(): void {
    this.selectedDiaryStudentId = '';
    this.loadDailyDiary();
  }

  onDiaryStudentSelectChange(): void {
    if (this.selectedDiaryStudent) {
      const cw = (this.selectedDiaryStudent.classWork || []).filter(t => t.task && t.task.trim().length > 0);
      const hw = (this.selectedDiaryStudent.homeWork || []).filter(t => t.task && t.task.trim().length > 0);
      if (cw.length > 0) {
        this.commonQuickFill.classWork = cw.map(x => ({ ...x }));
      }
      if (hw.length > 0) {
        this.commonQuickFill.homeWork = hw.map(x => ({ ...x }));
      }
    }
  }

  prevDiaryStudent(): void {
    if (!this.diaryStudents.length) return;
    const idx = this.diaryStudents.findIndex(s => s.studentId === this.selectedDiaryStudentId);
    if (idx > 0) {
      this.selectedDiaryStudentId = this.diaryStudents[idx - 1].studentId;
      this.onDiaryStudentSelectChange();
    } else if (idx === 0) {
      this.selectedDiaryStudentId = '';
    }
  }

  nextDiaryStudent(): void {
    if (!this.diaryStudents.length) return;
    if (!this.selectedDiaryStudentId) {
      this.selectedDiaryStudentId = this.diaryStudents[0].studentId;
      this.onDiaryStudentSelectChange();
    } else {
      const idx = this.diaryStudents.findIndex(s => s.studentId === this.selectedDiaryStudentId);
      if (idx >= 0 && idx < this.diaryStudents.length - 1) {
        this.selectedDiaryStudentId = this.diaryStudents[idx + 1].studentId;
        this.onDiaryStudentSelectChange();
      }
    }
  }

  updateDynamicSubjectOptions(): void {
    const set = new Set<string>();

    // 1. Class allocated curriculum subjects (highest priority)
    if (this.classAllocatedSubjects && this.classAllocatedSubjects.length > 0) {
      for (const cs of this.classAllocatedSubjects) {
        const name = cs.subjectName || cs.name;
        if (name && name.trim()) set.add(name.trim());
      }
    }

    // 2. All active subjects from API
    if (this.subjects && this.subjects.length > 0) {
      for (const s of this.subjects) {
        const name = s.name || s.subjectName;
        if (name && name.trim()) set.add(name.trim());
      }
    }

    this.subjectOptions = Array.from(set);

    // Initialize or refresh commonQuickFill tasks from dynamic API subjects
    if (this.subjectOptions.length > 0) {
      const top = this.subjectOptions.slice(0, Math.min(3, this.subjectOptions.length));
      const cwHasText = this.commonQuickFill.classWork.some(t => t.task && t.task.trim().length > 0);
      const hwHasText = this.commonQuickFill.homeWork.some(t => t.task && t.task.trim().length > 0);

      if (!cwHasText || this.commonQuickFill.classWork.length === 0) {
        this.commonQuickFill.classWork = top.map(sub => ({ subject: sub, task: '' }));
      }
      if (!hwHasText || this.commonQuickFill.homeWork.length === 0) {
        this.commonQuickFill.homeWork = top.map(sub => ({ subject: sub, task: '' }));
      }
    }
  }

  loadDailyDiary(): void {
    if (this.diaryScope === 'school' && !this.diaryClassId) return;
    if (this.diaryScope === 'coaching' && !this.diaryBatchId) return;
    this.loadingDiary = true;
    let url = `${API_BASE}/homework/daily-diary?date=${this.diaryDate}`;
    if (this.diaryScope === 'school') {
      if (this.diaryClassId) url += `&classId=${this.diaryClassId}`;
      if (this.diarySectionId) url += `&sectionId=${this.diarySectionId}`;
    } else {
      if (this.diaryBatchId) url += `&batchId=${this.diaryBatchId}`;
    }

    this.http.get<DailyStudentDiaryRow[]>(url).subscribe({
      next: r => {
        const dynamicTopSubs = this.subjectOptions.slice(0, Math.min(2, this.subjectOptions.length));
        const defaultCW = dynamicTopSubs.length > 0
          ? dynamicTopSubs.map(s => ({ subject: s, task: '' }))
          : [{ subject: '', task: '' }];
        const defaultHW = dynamicTopSubs.length > 0
          ? dynamicTopSubs.map(s => ({ subject: s, task: '' }))
          : [{ subject: '', task: '' }];

        this.diaryStudents = (r || []).map(item => ({
          ...item,
          classWork: item.classWork && item.classWork.length > 0
            ? item.classWork
            : defaultCW.map(x => ({ ...x })),
          homeWork: item.homeWork && item.homeWork.length > 0
            ? item.homeWork
            : defaultHW.map(x => ({ ...x }))
        }));
        if (this.selectedDiaryStudentId && !this.diaryStudents.some(s => s.studentId === this.selectedDiaryStudentId)) {
          this.selectedDiaryStudentId = '';
        }
        this.loadingDiary = false;
      },
      error: () => {
        this.diaryStudents = [];
        this.loadingDiary = false;
      }
    });
  }

  applyCommonToAllPresent(): void {
    if (!this.diaryStudents || this.diaryStudents.length === 0) {
      this.confirmDialog.alert('No Students', 'Please select a class with active students first.', 'warning');
      return;
    }

    const cwToCopy = this.commonQuickFill.classWork
      .filter(t => t.task && t.task.trim().length > 0)
      .map(t => ({ subject: t.subject, task: t.task.trim() }));

    const hwToCopy = this.commonQuickFill.homeWork
      .filter(t => t.task && t.task.trim().length > 0)
      .map(t => ({ subject: t.subject, task: t.task.trim() }));

    if (cwToCopy.length === 0 && hwToCopy.length === 0) {
      this.confirmDialog.alert(
        'Empty Tasks',
        'Please write at least one classwork or homework task in the Quick Fill panel before applying.',
        'warning'
      );
      return;
    }

    // Merge with existing tasks so existing teacherName, status (Completed, Partial, NotDone) are preserved
    const mergeTasks = (existingList: DailySubjectTaskItem[] | undefined, incomingList: { subject: string; task: string }[]) => {
      return incomingList.map(inc => {
        const prev = (existingList || []).find(p =>
          (p.subject || '').trim().toLowerCase() === inc.subject.trim().toLowerCase() &&
          (p.task || '').trim().toLowerCase() === inc.task.trim().toLowerCase()
        );
        return prev ? { ...prev, subject: inc.subject, task: inc.task } : { subject: inc.subject, task: inc.task };
      });
    };

    // Individual Student Assignment Mode
    if (this.selectedDiaryStudent) {
      this.selectedDiaryStudent.classWork = mergeTasks(this.selectedDiaryStudent.classWork, cwToCopy);
      this.selectedDiaryStudent.homeWork = mergeTasks(this.selectedDiaryStudent.homeWork, hwToCopy);
      this.confirmDialog.alert(
        'Task Assigned to Student 🎉',
        `Classwork & Homework successfully assigned specifically to ${this.selectedDiaryStudent.studentName}.`,
        'success'
      );
      return;
    }

    // Whole Class Common Assignment Mode: ONLY apply to students who are genuinely attending!
    let appliedCount = 0;
    for (const s of this.diaryStudents) {
      if (this.isStudentAttending(s)) {
        s.classWork = mergeTasks(s.classWork, cwToCopy);
        s.homeWork = mergeTasks(s.homeWork, hwToCopy);
        appliedCount++;
      } else if ((s.attendanceStatus || '').toLowerCase() === 'notmarked') {
        // Unmarked students must NOT have common tasks copied! Reset their tasks so common fill does not apply to them
        s.classWork = this.getDefaultTasksForStudent();
        s.homeWork = this.getDefaultTasksForStudent();
      }
    }

    if (appliedCount === 0) {
      this.confirmDialog.alert(
        'No Present Students',
        'No students are marked Present or Late today. Please mark student attendance first.',
        'warning'
      );
      return;
    }

    this.confirmDialog.alert(
      'Common Work Applied to Class 🎉',
      `Classwork & Homework successfully filled for ${appliedCount} present students. Unmarked and absent students were skipped.`,
      'success'
    );
  }

  // ===== H.W. CHECK: per-point status that prints as tick marks on the parent report =====
  readonly hwStatusOptions: { value: HwStatus; icon: string; label: string }[] = [
    { value: 'Completed', icon: '✔', label: 'Completed' },
    { value: 'Partial', icon: '◐', label: 'Partial' },
    { value: 'NotDone', icon: '✘', label: 'Not Done' }
  ];

  hwStatusOf(hw: DailySubjectTaskItem): HwStatus {
    return (hw.status as HwStatus) || 'Pending';
  }

  setHwStatus(hw: DailySubjectTaskItem, status: HwStatus): void {
    hw.status = this.hwStatusOf(hw) === status ? 'Pending' : status;
  }

  markAllHomeworkCompleted(): void {
    const targets = this.selectedDiaryStudent ? [this.selectedDiaryStudent] : this.diaryStudents;
    let points = 0;
    for (const s of targets) {
      if (!this.isStudentAttending(s)) continue;
      for (const hw of s.homeWork || []) {
        if (hw.task && hw.task.trim()) {
          hw.status = 'Completed';
          points++;
        }
      }
    }
    if (points === 0) {
      this.confirmDialog.alert('No Homework Points', 'Please assign homework to present students first, then mark it as checked.', 'warning');
      return;
    }
    this.confirmDialog.alert(
      'Marked Completed',
      `${points} homework point(s) marked Completed. Now tap ✘ (Not Done) or ◐ (Partial) on the points a student did not finish, then click "Save Diary Sheet".`,
      'success'
    );
  }

  addSubjectTask(list: DailySubjectTaskItem[], defaultSubject?: string): void {
    const sub = defaultSubject || (this.subjectOptions.length > 0 ? this.subjectOptions[0] : '');
    list.push({ subject: sub, task: '' });
  }

  removeSubjectTask(list: DailySubjectTaskItem[], index: number): void {
    if (list && list.length > 0) {
      list.splice(index, 1);
    }
  }

  isHindiActive(item: DailySubjectTaskItem): boolean {
    if (item.isHindiMode !== undefined) {
      return item.isHindiMode;
    }
    return this.hindiTrans.isHindiSubject(item.subject);
  }

  toggleHindiMode(item: DailySubjectTaskItem): void {
    item.isHindiMode = !this.isHindiActive(item);
  }

  onSubjectChange(item: DailySubjectTaskItem): void {
    // Reset manual override so mode matches the new subject
    delete item.isHindiMode;
  }

  hasEnglish(text?: string): boolean {
    return !!text && /[a-zA-Z]/.test(text);
  }

  async onTaskKeydown(event: KeyboardEvent, item: DailySubjectTaskItem, inputEl: HTMLInputElement): Promise<void> {
    if (!this.isHindiActive(item)) return;

    if (event.key === ' ' || event.key === 'Enter') {
      const cursorPos = inputEl.selectionStart ?? (item.task ? item.task.length : 0);
      const textBeforeCursor = (item.task || '').slice(0, cursorPos);
      const textAfterCursor = (item.task || '').slice(cursorPos);

      // Match the English word immediately before cursor
      const match = textBeforeCursor.match(/([a-zA-Z0-9'"`]+)$/);
      if (match) {
        const englishWord = match[1];
        event.preventDefault();

        const convertedWord = await this.hindiTrans.transliterateWord(englishWord);
        const prefix = textBeforeCursor.slice(0, textBeforeCursor.length - englishWord.length);
        const delimiter = event.key === 'Enter' ? '' : ' ';

        item.task = prefix + convertedWord + delimiter + textAfterCursor;

        // Restore cursor position after the converted word + delimiter
        setTimeout(() => {
          const newPos = prefix.length + convertedWord.length + delimiter.length;
          inputEl.setSelectionRange(newPos, newPos);
        }, 0);
      }
    }
  }

  async onTaskBlur(item: DailySubjectTaskItem): Promise<void> {
    if (this.isHindiActive(item) && item.task && this.hasEnglish(item.task)) {
      item.task = await this.hindiTrans.transliterateSentence(item.task);
    }
  }

  async convertTaskToHindi(item: DailySubjectTaskItem): Promise<void> {
    if (!item.task || !item.task.trim()) return;
    item.task = await this.hindiTrans.transliterateSentence(item.task);
  }

  applyHindiPreset(item: DailySubjectTaskItem, preset: string): void {
    if (!item.task || !item.task.trim()) {
      item.task = preset;
    } else {
      item.task = item.task.trim() + ', ' + preset;
    }
  }

  getCwNoteBadgeClass(note?: string | null): string {
    if (!note) return 'cw-note-empty';
    const n = note.toLowerCase();
    if (n.includes('checked') && !n.includes('un')) return 'cw-note-checked';
    if (n.includes('uncheck')) return 'cw-note-unchecked';
    if (n.includes('no remember')) return 'cw-note-noremeber';
    if (n.includes('remember')) return 'cw-note-remember';
    if (n.includes('good')) return 'cw-note-good';
    if (n.includes('writing') || n.includes('handwriting')) return 'cw-note-writing';
    return 'cw-note-custom';
  }

  openCustomCwNoteDialog(cw: DailySubjectTaskItem, student: DailyStudentDiaryRow): void {
    const dialogRef = this.dialog.open(StudentRemarkDialogComponent, {
      width: '440px',
      data: {
        studentName: `${student.studentName} (${cw.subject || 'Classwork'})`,
        remarks: cw.statusRemark || ''
      }
    });
    dialogRef.afterClosed().subscribe(res => {
      if (res?.saved !== undefined) {
        cw.statusRemark = res.remarks || '';
      }
    });
  }

  getAttendanceLabel(student: DailyStudentDiaryRow): string {
    if (student.isAbsent) return 'ABSENT';
    const status = (student.attendanceStatus || '').toLowerCase();
    switch (status) {
      case 'late': return 'LATE';
      case 'halfday': return 'HALF DAY';
      case 'leave': return 'LEAVE';
      case 'notmarked': return 'NOT MARKED';
      case 'absent': return 'ABSENT';
      case 'present': default: return 'PRESENT';
    }
  }

  getAttendanceIcon(student: DailyStudentDiaryRow): string {
    if (student.isAbsent) return 'cancel';
    const status = (student.attendanceStatus || '').toLowerCase();
    switch (status) {
      case 'late': return 'schedule';
      case 'halfday': return 'hourglass_bottom';
      case 'leave': return 'event_busy';
      case 'notmarked': return 'help_outline';
      case 'absent': return 'cancel';
      case 'present': default: return 'check_circle';
    }
  }

  getAttendanceBadgeClass(student: DailyStudentDiaryRow): string {
    if (student.isAbsent) return 'status-absent is-absent';
    const status = (student.attendanceStatus || '').toLowerCase();
    switch (status) {
      case 'late': return 'status-late';
      case 'halfday': return 'status-halfday';
      case 'leave': return 'status-leave is-absent';
      case 'notmarked': return 'status-notmarked';
      case 'absent': return 'status-absent is-absent';
      case 'present': default: return 'status-present';
    }
  }

  getDefaultTasksForStudent(): DailySubjectTaskItem[] {
    const dynamicTopSubs = this.subjectOptions.slice(0, Math.min(2, this.subjectOptions.length));
    return dynamicTopSubs.length > 0
      ? dynamicTopSubs.map(s => ({ subject: s, task: '' }))
      : [{ subject: '', task: '' }];
  }

  hasStudentTasks(student: DailyStudentDiaryRow): boolean {
    const hasCw = (student.classWork || []).some(t => t.task && t.task.trim().length > 0);
    const hasHw = (student.homeWork || []).some(t => t.task && t.task.trim().length > 0);
    return hasCw || hasHw;
  }

  clearStudentTasks(student: DailyStudentDiaryRow): void {
    student.classWork = this.getDefaultTasksForStudent();
    student.homeWork = this.getDefaultTasksForStudent();
    student.remarks = '';
  }

  sendStudentWhatsAppFromMain(student: DailyStudentDiaryRow): void {
    const text = this.generateSingleStudentWhatsAppText(student);
    const phone = (student.parentWhatsAppPhone || '').trim();
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }

    if (cleanPhone && cleanPhone.length >= 10) {
      const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      const url = `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
      this.http.post<any>(`${API_BASE}/homework/daily-diary/send-whatsapp-single`, {
        studentId: student.studentId,
        studentName: student.studentName,
        rollNumber: student.rollNumber || '',
        phone: student.parentWhatsAppPhone,
        messageText: text
      }).subscribe({ error: () => {} });
    } else {
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
      this.confirmDialog.alert(
        'WhatsApp Opened 📱',
        `No phone number found in ${student.studentName}'s profile. The personalized daily diary text has been copied to your clipboard and WhatsApp Web opened so you can select the parent.`,
        'info'
      );
    }
  }

  generateSingleStudentWhatsAppText(r: DailyStudentDiaryRow): string {
    const school = this.authService.getInstituteName() || 'School & Coaching ERP';
    const cls = r.className || (this.classes.find(c => c.id === this.diaryClassId)?.name) || 'Class';
    const date = this.formatDisplayDate(this.diaryDate);

    let text = `🏫 *${school}*\n`;
    text += `📋 *DAILY DIARY & HOMEWORK UPDATE*\n`;
    text += `👤 *Student:* ${r.studentName}${r.rollNumber ? ' (Roll: ' + r.rollNumber + ')' : ''}\n`;
    text += `📅 *Date:* ${date}  |  *Class:* ${cls}\n`;
    text += `───────────────────────────\n`;

    if (r.isAbsent) {
      text += `❌ *Status: ABSENT TODAY*\n`;
      text += `_Student was marked absent in attendance._\n`;
    } else {
      const cwList = (r.classWork || []).filter(c => c.task && c.task.trim().length > 0);
      if (cwList.length > 0) {
        text += `📝 *CLASS WORK (C.W.):*\n`;
        for (const cw of cwList) {
          text += `• [${cw.subject || 'General'}]: ${cw.task}`;
          if (cw.statusRemark && cw.statusRemark.trim().length > 0) {
            text += ` 📌 _${cw.statusRemark.trim()}_`;
          }
          text += `\n`;
        }
      }

      const hwList = (r.homeWork || []).filter(h => h.task && h.task.trim().length > 0);
      if (hwList.length > 0) {
        text += `\n🏠 *HOME WORK (H.W.):*\n`;
        for (const hw of hwList) {
          let tick = '⏳';
          if (hw.status === 'Completed') tick = '✔';
          else if (hw.status === 'Partial') tick = '◐';
          else if (hw.status === 'NotDone') tick = '✘';
          text += `• [${hw.subject || 'General'}]: ${hw.task} ${tick}`;
          if (hw.statusRemark && hw.statusRemark.trim().length > 0 && hw.statusRemark !== 'Unchecked') {
            text += ` (${hw.statusRemark.trim()})`;
          }
          text += `\n`;
        }
      }

      if (r.remarks && r.remarks.trim().length > 0) {
        text += `\n💬 *Teacher Note:* ${r.remarks.trim()}\n`;
      }
    }

    text += `───────────────────────────\n`;
    text += `⭐ *DISCIPLINE  |  GOOD HABITS  |  BRIGHT FUTURE* ⭐`;
    return text;
  }

  getAttendanceTooltip(student: DailyStudentDiaryRow): string {
    const status = (student.attendanceStatus || '').toLowerCase();
    if (student.isAbsent || status === 'absent') {
      return 'Marked Absent today. Click to switch to Present';
    }
    if (status === 'leave') {
      return 'Student is on Leave today. Click to switch to Present';
    }
    if (status === 'late') {
      return 'Marked LATE in attendance today. Click to switch to Absent';
    }
    if (status === 'halfday') {
      return 'Marked HALF DAY in attendance today. Click to switch to Absent';
    }
    if (status === 'notmarked') {
      return 'Attendance not yet marked today. Click to mark Present';
    }
    return 'Marked PRESENT today. Click to switch to Absent';
  }

  toggleStudentAbsent(student: DailyStudentDiaryRow): void {
    const status = (student.attendanceStatus || '').toLowerCase();
    if (student.isAbsent || status === 'absent' || status === 'leave') {
      student.isAbsent = false;
      student.attendanceStatus = 'Present';
    } else if (status === 'notmarked') {
      // If student was NOT MARKED, clicking it marks them Present today
      student.isAbsent = false;
      student.attendanceStatus = 'Present';
    } else {
      // If student was Present / Late, clicking toggles them to Absent
      student.isAbsent = true;
      student.attendanceStatus = 'Absent';
      student.classWork = this.getDefaultTasksForStudent();
      student.homeWork = this.getDefaultTasksForStudent();
    }
  }

  saveDailyDiary(): void {
    if (this.diaryScope === 'school' && !this.diaryClassId) {
      this.confirmDialog.alert('Select Class', 'Please select a class to save the diary for.', 'warning');
      return;
    }
    if (this.diaryScope === 'coaching' && !this.diaryBatchId) {
      this.confirmDialog.alert('Select Batch', 'Please select a coaching batch to save the diary for.', 'warning');
      return;
    }
    if (!this.diaryStudents || this.diaryStudents.length === 0) {
      this.confirmDialog.alert('No Students', 'No student entries found to save.', 'warning');
      return;
    }

    this.savingDiary = true;
    const payload = {
      diaryDate: this.diaryDate,
      classId: this.diaryScope === 'school' ? (this.diaryClassId || undefined) : undefined,
      sectionId: this.diaryScope === 'school' ? (this.diarySectionId || undefined) : undefined,
      batchId: this.diaryScope === 'coaching' ? (this.diaryBatchId || undefined) : undefined,
      items: this.diaryStudents.map(s => ({
        studentId: s.studentId,
        isAbsent: s.isAbsent,
        attendanceStatus: s.attendanceStatus,
        classWork: (s.classWork || []).filter(w => w.task && w.task.trim().length > 0),
        homeWork: (s.homeWork || []).filter(w => w.task && w.task.trim().length > 0),
        remarks: s.remarks || undefined
      }))
    };

    this.http.post(`${API_BASE}/homework/daily-diary/bulk`, payload).subscribe({
      next: () => {
        this.savingDiary = false;
        this.confirmDialog.alert(
          'Daily Diary Saved 🎉',
          `Daily Classwork & Homework Diary for date ${this.formatDisplayDate(this.diaryDate)} has been saved successfully! Click "Print / WhatsApp Report" to view or share the printable report.`,
          'success'
        );
      },
      error: (err) => {
        this.savingDiary = false;
        this.confirmDialog.alert('Save Failed', err.error?.message || 'Could not save daily diary sheet. Please try again.', 'danger');
      }
    });
  }

  openReportFromCheckHw(evt: { classId: string; sectionId: string; date: string }): void {
    if (evt.classId) this.diaryClassId = evt.classId;
    if (evt.sectionId !== undefined) this.diarySectionId = evt.sectionId;
    if (evt.date) this.diaryDate = evt.date;
    const selectedClass = this.classes.find(c => c.id === this.diaryClassId);
    this.diarySections = selectedClass?.sections || [];
    this.openDailyDiaryReportDialog({
      classId: this.diaryClassId,
      sectionId: this.diarySectionId,
      date: this.diaryDate
    });
  }

  openDailyDiaryReportDialog(customData?: { classId?: string; sectionId?: string; date?: string; batchId?: string }): void {
    const classId = customData?.classId || (this.diaryScope === 'school' ? this.diaryClassId : undefined);
    const sectionId = customData?.sectionId !== undefined ? customData.sectionId : (this.diaryScope === 'school' ? this.diarySectionId : undefined);
    const batchId = customData?.batchId || (this.diaryScope === 'coaching' ? this.diaryBatchId : undefined);
    const date = customData?.date || this.diaryDate;
    const selectedClass = classId ? this.classes.find(c => c.id === classId) : undefined;
    const selectedSection = (selectedClass?.sections || this.diarySections).find((s: any) => s.id === sectionId);
    const selectedBatch = batchId ? this.batches.find(b => b.id === batchId) : undefined;

    this.dialog.open(DailyDiaryReportDialogComponent, {
      width: '1320px',
      maxWidth: '96vw',
      maxHeight: '94vh',
      data: {
        date: date,
        classId: classId,
        sectionId: sectionId,
        batchId: batchId,
        className: selectedBatch ? selectedBatch.name : (selectedClass?.name || 'Class'),
        sectionName: selectedSection?.name || '',
        subjectOptions: this.subjectOptions,
        students: customData ? null : (this.selectedDiaryStudent ? [this.selectedDiaryStudent] : this.diaryStudents)
      }
    });
  }

  openRemarkDialog(student: DailyStudentDiaryRow): void {
    if (student.isAbsent || student.attendanceStatus === 'NotMarked') return;
    const selectedClass = this.classes.find(c => c.id === this.diaryClassId);
    const selectedSection = (selectedClass?.sections || this.diarySections).find((s: any) => s.id === this.diarySectionId);
    const classLabel = selectedSection?.name ? `${selectedClass?.name || ''} (${selectedSection.name})` : (selectedClass?.name || '');

    const ref = this.dialog.open(StudentRemarkDialogComponent, {
      width: '540px',
      maxWidth: '94vw',
      data: {
        studentName: student.studentName,
        rollNumber: student.rollNumber,
        className: classLabel,
        remarks: student.remarks || ''
      }
    });

    ref.afterClosed().subscribe(res => {
      if (res && res.saved !== undefined) {
        student.remarks = res.remarks;
      }
    });
  }

  refreshCurrentView(): void {
    if (this.activeTab === 'student') {
      this.loadStudentHomework();
    } else {
      if (this.diarySubTab === 'daily-diary') {
        this.loadDailyDiary();
      } else {
        this.loadHomework();
      }
    }
  }

  getFileUrl(url?: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    return `${environment.apiBaseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  isClassTeacherOf(c: any): boolean {
    if (this.isClassTeacherLocked && c.id === this.teacherAssignedClassId) return true;
    if (this.linkedTeacher) {
      return (c.sections || []).some((s: any) =>
        (s.classTeacherId && s.classTeacherId === this.linkedTeacher.id) ||
        (this.linkedTeacher.fullName && s.classTeacherName && s.classTeacherName.trim().toLowerCase() === this.linkedTeacher.fullName.trim().toLowerCase())
      );
    }
    const userFullName = (this.authService.currentUser()?.fullName || '').trim().toLowerCase();
    if (userFullName) {
      return (c.sections || []).some((s: any) =>
        s.classTeacherName && s.classTeacherName.trim().toLowerCase() === userFullName
      );
    }
    return false;
  }

  checkAndLockClassTeacher(): void {
    if (this.authService.isAdmin()) {
      this.isClassTeacherLocked = false;
      return;
    }

    const currentUser = this.authService.currentUser();
    const userFullName = (currentUser?.fullName || (currentUser as any)?.name || '').trim().toLowerCase();
    const userId = currentUser?.userId || (currentUser as any)?.id;

    // 1. Find linked teacher in this.teachers
    const currentTeacher = this.teachers.find(t =>
      (userId && t.userId && t.userId === userId) ||
      (userFullName && t.fullName && t.fullName.trim().toLowerCase() === userFullName)
    );
    this.linkedTeacher = currentTeacher;

    // 2. Look for any section where this teacher is assigned as class teacher
    let matchedClass: any = null;
    let matchedSection: any = null;

    if (this.classes && this.classes.length > 0) {
      for (const c of this.classes) {
        const sec = (c.sections || []).find((s: any) =>
          (currentTeacher && s.classTeacherId && s.classTeacherId === currentTeacher.id) ||
          (userFullName && s.classTeacherName && s.classTeacherName.trim().toLowerCase() === userFullName)
        );
        if (sec) {
          matchedClass = c;
          matchedSection = sec;
          break;
        }
      }
    }

    if (matchedClass) {
      this.isClassTeacherLocked = true;
      this.teacherAssignedClassId = matchedClass.id;
      this.teacherAssignedClassName = matchedClass.name;
      this.teacherAssignedSectionId = matchedSection?.id || '';
      this.teacherAssignedSectionName = matchedSection?.name || '';

      this.diaryClassId = matchedClass.id;
      this.onDiaryClassChange();
      if (matchedSection?.id) {
        this.diarySectionId = matchedSection.id;
        this.onDiarySectionChange();
      }
    }
  }

  loadClasses(): void {
    this.http.get<any[]>(`${API_BASE}/school/classes`).subscribe({
      next: r => {
        this.classes = r;
        this.checkAndLockClassTeacher();
        if (!this.previewClassId && this.classes.length > 0) {
          this.initTeacherPreviewClass();
        }
        if (!this.diaryClassId && this.classes.length > 0) {
          this.diaryClassId = this.classes[0].id;
          this.onDiaryClassChange();
        }
      },
      error: () => this.classes = []
    });
  }

  loadTeachers(): void {
    this.http.get<any[]>(`${API_BASE}/teachers`).subscribe({
      next: r => {
        this.teachers = r;
        this.checkAndLockClassTeacher();
        if (!this.previewClassId && this.classes.length > 0) {
          this.initTeacherPreviewClass();
        }
      },
      error: () => this.teachers = []
    });
  }

  loadSubjects(): void {
    this.http.get<any[]>(`${API_BASE}/subjects?activeOnly=true`).subscribe({
      next: r => {
        this.subjects = r || [];
        this.updateDynamicSubjectOptions();
      },
      error: () => {
        this.subjects = [];
        this.updateDynamicSubjectOptions();
      }
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
    if (this.worksheetScope === 'school') {
      if (this.filterClassId) params.push(`classId=${this.filterClassId}`);
      if (this.filterSectionId) params.push(`sectionId=${this.filterSectionId}`);
    } else {
      if (this.filterBatchId) params.push(`batchId=${this.filterBatchId}`);
    }
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
        batches: this.batches,
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
        <!-- Scope Switcher Pill Tabs -->
        <div class="scope-nav-container" *ngIf="!isEdit">
          <div class="scope-pills">
            <button
              type="button"
              class="scope-pill-btn"
              [class.active]="targetScope === 'school'"
              (click)="targetScope = 'school'">
              <mat-icon>school</mat-icon>
              <span>School Class</span>
            </button>
            <button
              type="button"
              class="scope-pill-btn"
              [class.active]="targetScope === 'coaching'"
              (click)="targetScope = 'coaching'">
              <mat-icon>groups</mat-icon>
              <span>Coaching Batch</span>
            </button>
          </div>
        </div>

        <div class="form-row" *ngIf="targetScope === 'school'">
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

        <div class="form-row" *ngIf="targetScope === 'coaching'">
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Academic Class (कक्षा)</mat-label>
            <mat-select [(ngModel)]="dialogCoachingClassId" (selectionChange)="onDialogCoachingClassChange()">
              <mat-option value="">All Classes (सभी कक्षाएं)</mat-option>
              <mat-option *ngFor="let c of data.classes" [value]="c.id">{{c.name}}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Coaching Batch (बैच) *</mat-label>
            <mat-select [(ngModel)]="model.batchId" required>
              <mat-option *ngIf="filteredDialogBatches.length === 0" disabled value="">
                No Batches Found for this Class
              </mat-option>
              <mat-option *ngFor="let b of filteredDialogBatches" [value]="b.id">
                {{b.name}} <span *ngIf="b.subject || b.courseName">({{b.subject || b.courseName}})</span>
              </mat-option>
            </mat-select>
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
              <mat-optgroup label="All School Subjects" *ngIf="allSubjects.length > 0">
                <mat-option *ngFor="let s of allSubjects" [value]="s.name || s.subjectName">
                  {{s.name || s.subjectName}} <span *ngIf="s.code">({{s.code}})</span>
                </mat-option>
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

    /* Scope Switcher Pill Tabs */
    .scope-nav-container { display: flex; align-items: center; margin-bottom: 4px; }
    .scope-pills { display: inline-flex; background: #e2e8f0; padding: 4px; border-radius: 10px; gap: 4px; }
    .scope-pill-btn { display: inline-flex; align-items: center; gap: 8px; border: none; background: transparent; padding: 6px 14px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; color: #475569; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
    .scope-pill-btn:hover { color: #1e293b; }
    .scope-pill-btn.active { background: #ffffff; color: #1d4ed8; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); font-weight: 700; }
    .scope-pill-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }

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
  targetScope: 'school' | 'coaching' = 'school';
  dialogSections: any[] = [];
  allSubjects: any[] = [];
  dueDateStr = '';
  dueDatePreviewIso = '';
  dialogCoachingClassId = '';

  get filteredDialogBatches(): any[] {
    if (!this.dialogCoachingClassId) {
      return this.data.batches || [];
    }
    const target = this.dialogCoachingClassId.toLowerCase();
    return (this.data.batches || []).filter((b: any) => (b.classId || '').toLowerCase() === target);
  }

  onDialogCoachingClassChange(): void {
    const available = this.filteredDialogBatches;
    if (available.length > 0) {
      if (!available.some((b: any) => b.id === this.model.batchId)) {
        this.model.batchId = available[0].id;
      }
    } else {
      this.model.batchId = '';
    }
  }

  model: any = {
    classId: '',
    sectionId: '',
    batchId: '',
    subjectName: '',
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
    this.allSubjects = this.data?.subjects || [];
    if (this.allSubjects.length === 0) {
      this.http.get<any[]>(`${API_BASE}/subjects?activeOnly=true`).subscribe({
        next: (subs) => {
          this.allSubjects = subs || [];
          if (!this.isEdit && !this.model.subjectName && this.allSubjects.length > 0) {
            this.model.subjectName = this.allSubjects[0].name || this.allSubjects[0].subjectName;
          }
        },
        error: () => this.allSubjects = []
      });
    } else if (!this.isEdit && !this.model.subjectName && this.allSubjects.length > 0) {
      this.model.subjectName = this.allSubjects[0].name || this.allSubjects[0].subjectName;
    }

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
      if (h.batchId) {
        this.targetScope = 'coaching';
        const foundBatch = (this.data.batches || []).find((b: any) => b.id === h.batchId);
        if (foundBatch?.classId) {
          this.dialogCoachingClassId = foundBatch.classId;
        }
      } else {
        this.targetScope = 'school';
      }
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
          if (!this.isEdit && this.classSubjects.length > 0) {
            this.onSubjectSelect(this.classSubjects[0].subjectName);
          } else if (!this.isEdit && !this.model.subjectName && this.allSubjects.length > 0) {
            this.model.subjectName = this.allSubjects[0].name || this.allSubjects[0].subjectName;
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
    return `${environment.apiBaseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
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
        classId: this.targetScope === 'school' ? (this.model.classId || null) : null,
        sectionId: this.targetScope === 'school' ? (this.model.sectionId || null) : null,
        batchId: this.targetScope === 'coaching' ? (this.model.batchId || null) : null,
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
    return `${environment.apiBaseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
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
    return `${environment.apiBaseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
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

// =============================================================================
// DAILY DIARY PRINTABLE & WHATSAPP REPORT DIALOG COMPONENT
// =============================================================================
@Component({
  selector: 'app-daily-diary-report-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatDialogModule, MatTooltipModule, MatMenuModule],
  template: `
    <div class="report-dialog-container">
      <!-- Dialog Header matching strict UI guidelines -->
      <div class="modal-header">
        <!-- Main Top Bar: Logo, Title, Primary Actions & Close -->
        <div class="header-main-row">
          <div class="header-left">
            <div class="header-logo-card" [class.has-logo]="logoUrl && !logoFailed">
              <img *ngIf="logoUrl && !logoFailed" [src]="logoUrl" (error)="logoFailed = true" alt="Institute Logo" class="header-logo-img" />
              <div *ngIf="!logoUrl || logoFailed" class="fallback-icon-wrap">
                <mat-icon>school</mat-icon>
              </div>
            </div>
            <div class="header-title-box">
              <div class="title-with-badge">
                <h2 class="dialog-title">Daily CW &amp; HW Report</h2>
                <span class="report-badge">Daily Diary</span>
              </div>
              <div class="dialog-quick-meta">
                <span class="quick-meta-pill"><mat-icon>event</mat-icon> Date: <strong>{{formattedDate}}</strong></span>
                <span class="quick-meta-pill"><mat-icon>domain</mat-icon> Class: <strong>{{reportHeader?.className || data.className}}</strong></span>
                <span *ngIf="reportHeader?.sectionName || data.sectionName" class="quick-meta-pill sec-pill">Sec <strong>{{reportHeader?.sectionName || data.sectionName}}</strong></span>
                <span class="quick-meta-pill count-pill"><mat-icon>groups</mat-icon> <strong>{{rows.length}} Students</strong></span>
              </div>
            </div>
          </div>

          <!-- Top-Right Primary Action Buttons -->
          <div class="header-primary-actions">
            <!-- 1-Click Automated Send to All Parents -->
            <button mat-flat-button class="auto-wa-parents-btn" (click)="sendAutomatedWhatsAppToAllParents()" [disabled]="sendingWhatsApp || rows.length === 0" matTooltip="Automatically dispatch personalized daily diary to all parents via WhatsApp">
              <mat-icon *ngIf="!sendingWhatsApp">bolt</mat-icon>
              <mat-icon *ngIf="sendingWhatsApp" class="spin">sync</mat-icon>
              <span>{{ sendingWhatsApp ? 'Sending...' : '⚡ Auto Send Parents' }}</span>
            </button>

            <!-- 1-Click Direct WhatsApp Share to Class Group -->
            <button mat-flat-button class="group-wa-btn" (click)="shareToClassGroupWhatsApp()" matTooltip="Directly open WhatsApp to share summary with class group">
              <mat-icon>send</mat-icon>
              <span>📲 Send to Group</span>
            </button>

            <!-- 1-Click Send to Individual Student via WhatsApp -->
            <button mat-flat-button class="individual-wa-header-btn" [matMenuTriggerFor]="individualStudentSendMenu" matTooltip="Open WhatsApp for individual student parent">
              <mat-icon>chat</mat-icon>
              <span>💬 Send Individual</span>
              <mat-icon class="drop-arrow-icon">arrow_drop_down</mat-icon>
            </button>
            <mat-menu #individualStudentSendMenu="matMenu" class="individual-wa-menu-panel">
              <div class="wa-menu-header-title">Select Student to Open WhatsApp:</div>
              <button mat-menu-item *ngFor="let r of rows" (click)="sendIndividualStudentWhatsApp(r)">
                <mat-icon class="text-success">chat</mat-icon>
                <div class="st-wa-menu-item-row">
                  <span class="st-name-txt"><strong>{{ r.studentName }}</strong> <small *ngIf="r.rollNumber">(Roll {{r.rollNumber}})</small></span>
                  <span class="st-phone-pill" *ngIf="r.parentWhatsAppPhone">📱 {{ r.parentWhatsAppPhone }}</span>
                  <span class="st-phone-pill warn" *ngIf="!r.parentWhatsAppPhone">⚠️ No Phone</span>
                </div>
              </button>
            </mat-menu>

            <!-- Print Report A4 -->
            <button mat-flat-button class="print-action-btn" (click)="printReport()" matTooltip="A4 Printable Landscape Sheet">
              <mat-icon>print</mat-icon>
              <span>Print (A4)</span>
            </button>

            <!-- Close Dialog -->
            <button mat-icon-button class="close-btn" (click)="dialogRef.close()" matTooltip="Close (Esc)">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>

        <!-- Sub-Toolbar: Secondary Tools & Copy Actions -->
        <div class="header-sub-toolbar">
          <div class="sub-toolbar-left">
            <!-- Previous H.W. Included Toggle Pill -->
            <button mat-stroked-button class="toggle-prev-hw-btn"
                    *ngIf="reportHeader?.previousHw && reportHeader!.previousHw!.length > 0"
                    [class.active]="includePreviousHw"
                    (click)="includePreviousHw = !includePreviousHw"
                    matTooltip="Click to include or exclude previous day homework verification from print and WhatsApp">
              <mat-icon>{{ includePreviousHw ? 'check_box' : 'check_box_outline_blank' }}</mat-icon>
              <span>Previous H.W. ({{ includePreviousHw ? 'Included' : 'Excluded' }})</span>
            </button>

            <span class="sub-toolbar-hint" *ngIf="!reportHeader?.previousHw || reportHeader!.previousHw!.length === 0">
              <mat-icon class="hint-icon">verified</mat-icon> Complete C.W. &amp; H.W. Daily Report Overview
            </span>
          </div>

          <div class="sub-toolbar-right">
            <span class="manual-copy-label">Manual Copy:</span>
            <button mat-stroked-button class="copy-pill-btn" (click)="copyClassSummaryWhatsApp()" matTooltip="Copy compact Class Summary">
              <mat-icon>forum</mat-icon>
              <span>Copy Group</span>
            </button>

            <button mat-stroked-button class="copy-pill-btn" (click)="copyWhatsAppText()" matTooltip="Copy full student-by-student diary">
              <mat-icon>format_list_numbered</mat-icon>
              <span>Copy Student-wise</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Printable Report Body -->
      <div class="modal-body-scroll">
        <div class="print-paper-sheet" id="printableDiaryReport">
          <!-- Institute Header -->
          <div class="report-top-header">
            <h1 class="school-title">{{ reportHeader?.tenantName || authService.getInstituteName() || 'Daily Diary Report' }}</h1>
            <div class="school-address-text" *ngIf="reportHeader?.tenantAddress">{{ reportHeader?.tenantAddress }}</div>
          </div>

          <!-- Main Navy Title Banner -->
          <div class="navy-title-banner">
            <span>STUDENT DAILY CLASS WORK &amp; HOME WORK REPORT</span>
          </div>

          <!-- Meta Bar (Date & Class) -->
          <div class="report-meta-bar">
            <div class="meta-class">
              <span class="lbl">Class:</span>
              <span class="val">{{reportHeader?.className || data.className}}</span>
              <span class="sec-val" *ngIf="reportHeader?.sectionName || data.sectionName">({{reportHeader?.sectionName || data.sectionName}})</span>
            </div>
            <div class="meta-date-pill">
              <span class="date-lbl">Date :</span>
              <span class="date-val">{{formattedDate}}</span>
            </div>
          </div>

          <!-- Grid Table -->
          <table class="report-data-table">
            <colgroup>
              <col class="col-sno">
              <col class="col-name">
              <col class="col-class">
              <col class="col-cw">
              <col class="col-cw-rem">
              <col class="col-hw">
              <col class="col-hw-rem">
            </colgroup>
            <thead>
              <tr>
                <th class="col-sno">S. No.</th>
                <th class="col-name">Student Name</th>
                <th class="col-class">Class</th>
                <th class="col-cw">CLASS WORK (C.W.)</th>
                <th class="col-cw-rem">Remarks</th>
                <th class="col-hw">HOME WORK (H.W.)</th>
                <th class="col-hw-rem">Remarks</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of rows; let i = index" [class.absent-row]="row.isAbsent">
                <td class="col-sno-data text-center">{{i + 1}}</td>
                <td class="col-name-data">
                  <div class="name-row-flex">
                    <span class="name-bold">{{row.studentName}}</span>
                    <button type="button" class="row-wa-badge-btn hide-on-print" (click)="sendIndividualStudentWhatsApp(row)" [matTooltip]="'Open WhatsApp for ' + row.studentName">
                      <mat-icon>chat</mat-icon>
                      <span>WhatsApp</span>
                    </button>
                  </div>
                  <div class="sub-roll" *ngIf="row.rollNumber">Roll: {{row.rollNumber}}</div>
                </td>
                <td class="col-class-data text-center">{{row.className || reportHeader?.className || data.className}}</td>

                <!-- Absent / Unmarked Student: Subjects } Absent matching reference photo rows 7 & 8 -->
                <ng-container *ngIf="isAbsentStudent(row)">
                  <td class="col-bracket-cell text-center" colspan="2">
                    <div class="absent-bracket-layout">
                      <div class="absent-subjects-col">
                        <span class="subject-pill" *ngFor="let s of getClassSubjects()" [ngClass]="getSubjectColorClass(s)">{{s}}</span>
                      </div>
                      <svg class="brace-svg" viewBox="0 0 14 56" preserveAspectRatio="none">
                        <path d="M 2 2 C 8 8, 8 22, 13 28 C 8 34, 8 48, 2 54" fill="none" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round" />
                      </svg>
                      <span class="absent-text-red">Absent</span>
                    </div>
                  </td>
                  <td class="col-bracket-cell text-center" colspan="2">
                    <div class="absent-bracket-layout">
                      <div class="absent-subjects-col">
                        <span class="subject-pill" *ngFor="let s of getClassSubjects()" [ngClass]="getSubjectColorClass(s)">{{s}}</span>
                      </div>
                      <svg class="brace-svg" viewBox="0 0 14 56" preserveAspectRatio="none">
                        <path d="M 2 2 C 8 8, 8 22, 13 28 C 8 34, 8 48, 2 54" fill="none" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round" />
                      </svg>
                      <span class="absent-text-red">Absent</span>
                    </div>
                  </td>
                </ng-container>

                <!-- Attending Student (Present / Late / HalfDay) with active tasks -->
                <ng-container *ngIf="!isAbsentStudent(row)">
                  <td class="col-work-data">
                    <div class="task-entry" *ngFor="let cw of getActiveTasks(row.classWork)">
                      <span class="subject-pill" [ngClass]="getSubjectColorClass(cw.subject)">{{cw.subject}}</span>
                      <span class="task-arrow">&rarr;</span>
                      <span class="task-text">{{cw.task}}</span>
                      <span class="task-teacher" *ngIf="cw.teacherName || reportHeader?.classTeacherName">({{cw.teacherName || reportHeader?.classTeacherName}})</span>
                    </div>
                  </td>
                  <td class="col-rem-data text-center">
                    <div class="rem-content" *ngIf="getCwRemarksList(row).length > 0">
                      <div class="hw-rem-item" *ngFor="let cr of getCwRemarksList(row)" [ngClass]="cr.colorClass">
                        <span class="rem-label">
                          <strong *ngIf="cr.subject">[{{ cr.subject }}]: </strong>{{ cr.text }}
                        </span>
                      </div>
                    </div>
                    <span class="empty-dash" *ngIf="getCwRemarksList(row).length === 0">—</span>
                  </td>
                  <td class="col-work-data">
                    <div class="task-entry" *ngFor="let hw of getActiveTasks(row.homeWork)">
                      <span class="subject-pill" [ngClass]="getSubjectColorClass(hw.subject)">{{hw.subject}}</span>
                      <span class="task-arrow">&rarr;</span>
                      <span class="task-text">{{hw.task}}</span>
                      <span class="task-teacher" *ngIf="hw.teacherName || reportHeader?.classTeacherName">({{hw.teacherName || reportHeader?.classTeacherName}})</span>
                      <span class="hw-tick" [ngClass]="hwTickClass(hw)" [attr.title]="hwTickTitle(hw)">{{hwTickSymbol(hw)}}</span>
                    </div>
                    <div class="hw-summary" *ngIf="hwSummary(row) as sm">H.W. Done: {{sm}}</div>
                  </td>
                  <td class="col-rem-data text-center">
                    <div class="rem-content" *ngIf="getHwRemarks(row).length > 0">
                      <div class="hw-rem-item" *ngFor="let rem of getHwRemarks(row)" [ngClass]="'rem-' + rem.status.toLowerCase()">
                        <span class="rem-tick">{{ rem.symbol }}</span>
                        <span class="rem-label">{{ rem.text }}</span>
                      </div>
                    </div>
                    <span class="empty-dash" *ngIf="getHwRemarks(row).length === 0">—</span>
                  </td>
                </ng-container>
              </tr>
            </tbody>
          </table>

          <!-- PREVIOUS DAY'S HOMEWORK VERIFICATION (if available for this class) -->
          <div class="prev-hw-section" *ngIf="includePreviousHw && reportHeader?.previousHw && reportHeader!.previousHw!.length > 0">
            <div class="prev-hw-banner">
              <mat-icon class="ph-icon">verified</mat-icon>
              <span>PREVIOUS HOMEWORK VERIFICATION (गत दिवस गृहकार्य जाँच - तारीख: {{ formattedPreviousHwDate }})</span>
            </div>
            <table class="report-data-table prev-hw-table">
              <colgroup>
                <col style="width: 4%;">
                <col style="width: 16%;">
                <col style="width: 6%;">
                <col style="width: 62%;">
                <col style="width: 12%;">
              </colgroup>
              <thead>
                <tr>
                  <th class="col-sno">S. No.</th>
                  <th class="col-name">Student Name</th>
                  <th class="col-class">Roll</th>
                  <th class="col-hw">PREVIOUS H.W. POINTS &amp; VERIFICATION STATUS</th>
                  <th style="width: 12%; text-align: center;">Summary</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let prow of reportHeader!.previousHw; let pi = index">
                  <td class="col-sno-data text-center">{{ pi + 1 }}</td>
                  <td class="col-name-data">
                    <div class="name-bold">{{ prow.studentName }}</div>
                  </td>
                  <td class="col-class-data text-center">{{ prow.rollNumber }}</td>
                  <td class="col-work-data">
                    <div class="task-entry" *ngFor="let phw of getActiveTasks(prow.homeWork)">
                      <span class="subject-pill" [ngClass]="getSubjectColorClass(phw.subject)">{{ phw.subject }}</span>
                      <span class="task-arrow">&rarr;</span>
                      <span class="task-text">{{ phw.task }}</span>
                      <span class="task-teacher" *ngIf="phw.teacherName || reportHeader?.classTeacherName">({{ phw.teacherName || reportHeader?.classTeacherName }})</span>
                      <span class="hw-tick" [ngClass]="hwTickClass(phw)" [attr.title]="hwTickTitle(phw)">{{ hwTickSymbol(phw) }}</span>
                    </div>
                  </td>
                  <td class="text-center">
                    <span class="prev-score-chip" *ngIf="previousHwSummary(prow) as psm">{{ psm }}</span>
                    <span class="absent-text-red" *ngIf="prow.isAbsent">Absent</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="report-legend">✔ Completed &nbsp;·&nbsp; ◐ Partial &nbsp;·&nbsp; ✘ Not Done &nbsp;·&nbsp; ⏳ Not checked yet</div>
          <div class="sign-row">
            <div>Class Teacher: <strong>{{ reportHeader?.classTeacherName || '__________________' }}</strong></div>
            <div>Parent's Signature: __________________</div>
          </div>

          <!-- Bottom Navy Banner -->
          <div class="navy-footer-banner">
            <span>DISCIPLINE &nbsp; | &nbsp; GOOD HABITS &nbsp; | &nbsp; BRIGHT FUTURE</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .report-dialog-container {
      display: flex;
      flex-direction: column;
      height: 88vh;
      max-height: 88vh;
      background: #f1f5f9;
      border-radius: 12px;
      overflow: hidden;
    }
    
    /* Strict Light Blue Gradient Dialog Header */
    .modal-header {
      flex-shrink: 0;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 0;
      display: flex;
      flex-direction: column;
      position: relative;
      z-index: 10;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
    }

    .header-main-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 18px 10px 18px;
      gap: 16px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
      min-width: 0;
    }

    .header-logo-card {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: #ffffff;
      border: 1.5px solid #bfdbfe;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      padding: 3px;
      box-sizing: border-box;
      overflow: hidden;

      .header-logo-img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        border-radius: 9px;
      }

      .fallback-icon-wrap {
        width: 100%;
        height: 100%;
        border-radius: 9px;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        mat-icon {
          font-size: 26px;
          width: 26px;
          height: 26px;
        }
      }
    }

    .header-title-box {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .title-with-badge {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .dialog-title {
      margin: 0;
      font-size: 19px;
      font-weight: 800;
      color: #1e3a8a;
      letter-spacing: -0.2px;
      line-height: 1.2;
      white-space: nowrap;
    }

    .report-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      background: #dbeafe;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      letter-spacing: 0.3px;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .dialog-quick-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: nowrap;
    }

    .quick-meta-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11.5px;
      font-weight: 600;
      color: #2563eb;
      background: rgba(255, 255, 255, 0.75);
      border: 1px solid #bfdbfe;
      padding: 1.5px 7px;
      border-radius: 5px;
      white-space: nowrap;

      mat-icon {
        font-size: 13.5px;
        width: 13.5px;
        height: 13.5px;
        color: #1d4ed8;
      }
      strong {
        color: #1e3a8a;
        font-weight: 700;
      }
      &.sec-pill {
        background: #eff6ff;
        color: #1e40af;
      }
      &.count-pill {
        background: #eff6ff;
        color: #0369a1;
      }
    }

    .header-primary-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .auto-wa-parents-btn {
      background: linear-gradient(135deg, #059669 0%, #10b981 100%) !important;
      color: #ffffff !important;
      font-weight: 700 !important;
      border-radius: 8px !important;
      font-size: 12px !important;
      height: 38px !important;
      padding: 0 14px !important;
      white-space: nowrap !important;
      box-shadow: 0 2px 6px rgba(16, 185, 129, 0.35) !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      transition: all 0.15s ease !important;
      &:hover {
        background: linear-gradient(135deg, #047857 0%, #059669 100%) !important;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(16, 185, 129, 0.4) !important;
      }
      &:disabled { opacity: 0.65; cursor: not-allowed; transform: none; }
    }
    .auto-wa-parents-btn mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .auto-wa-parents-btn mat-icon.spin { animation: spinWa 1s linear infinite; }
    @keyframes spinWa { 100% { transform: rotate(360deg); } }

    .group-wa-btn {
      background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%) !important;
      color: #ffffff !important;
      font-weight: 700 !important;
      border-radius: 8px !important;
      font-size: 12px !important;
      height: 38px !important;
      padding: 0 14px !important;
      white-space: nowrap !important;
      box-shadow: 0 2px 6px rgba(14, 165, 233, 0.3) !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      transition: all 0.15s ease !important;
      &:hover {
        background: linear-gradient(135deg, #0369a1 0%, #0284c7 100%) !important;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(14, 165, 233, 0.35) !important;
      }
    }
    .group-wa-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .individual-wa-header-btn {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
      color: #ffffff !important;
      font-weight: 700 !important;
      border-radius: 8px !important;
      font-size: 12px !important;
      height: 38px !important;
      padding: 0 12px !important;
      white-space: nowrap !important;
      box-shadow: 0 2px 6px rgba(16, 185, 129, 0.25) !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      border: none !important;
      cursor: pointer !important;
      transition: all 0.15s ease !important;
      &:hover {
        background: linear-gradient(135deg, #059669 0%, #047857 100%) !important;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(16, 185, 129, 0.35) !important;
      }
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      .drop-arrow-icon { font-size: 18px; width: 18px; height: 18px; margin-left: -2px; }
    }

    .individual-wa-menu-panel {
      max-height: 380px;
      .wa-menu-header-title {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        color: #64748b;
        padding: 8px 14px 4px;
        letter-spacing: 0.5px;
      }
      .st-wa-menu-item-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        width: 100%;
        .st-name-txt {
          font-size: 13px;
          color: #0f172a;
          small { color: #64748b; margin-left: 3px; }
        }
        .st-phone-pill {
          font-size: 11px;
          background: #eff6ff;
          color: #1e40af;
          border: 1px solid #bfdbfe;
          padding: 1px 7px;
          border-radius: 4px;
          font-weight: 600;
          &.warn { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
        }
      }
    }

    .print-action-btn {
      background: #2563eb !important;
      color: #ffffff !important;
      font-weight: 700 !important;
      border-radius: 8px !important;
      font-size: 12px !important;
      height: 38px !important;
      padding: 0 14px !important;
      white-space: nowrap !important;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3) !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      transition: all 0.15s ease !important;
      &:hover {
        background: #1d4ed8 !important;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(37, 99, 235, 0.35) !important;
      }
    }
    .print-action-btn mat-icon { font-size: 17px; width: 17px; height: 17px; }

    .close-btn {
      color: #64748b;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      transition: all 0.15s ease;
      &:hover { color: #0f172a; background: rgba(0, 0, 0, 0.06); }
    }

    /* Sub-Toolbar styling */
    .header-sub-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 18px;
      background: rgba(255, 255, 255, 0.55);
      border-top: 1px solid rgba(191, 219, 254, 0.8);
      gap: 12px;
    }

    .sub-toolbar-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sub-toolbar-hint {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11.5px;
      font-weight: 600;
      color: #3b82f6;
      .hint-icon {
        font-size: 15px;
        width: 15px;
        height: 15px;
        color: #2563eb;
      }
    }

    .sub-toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .manual-copy-label {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .copy-pill-btn {
      color: #1e40af !important;
      border: 1px solid #bfdbfe !important;
      background: #ffffff !important;
      font-weight: 700 !important;
      border-radius: 6px !important;
      font-size: 11px !important;
      height: 30px !important;
      padding: 0 10px !important;
      white-space: nowrap !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      transition: all 0.15s ease !important;
      &:hover {
        background: #eff6ff !important;
        border-color: #93c5fd !important;
        color: #1d4ed8 !important;
      }
    }
    .copy-pill-btn mat-icon { font-size: 14px; width: 14px; height: 14px; color: #2563eb; }

    .modal-body-scroll {
      flex: 1;
      min-height: 0;
      padding: 18px;
      overflow-y: auto;
      overflow-x: auto;
      display: flex;
      justify-content: center;
      background: #cbd5e1;
    }

    /* Printable Sheet Layout matching user reference photo */
    .print-paper-sheet {
      background: #ffffff;
      width: 100%;
      max-width: 1140px;
      border: 1.5px solid #0f172a;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.18), 0 8px 10px -6px rgba(0,0,0,0.15);
      padding: 20px 22px;
      box-sizing: border-box;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      height: fit-content;
      margin: 0 auto 30px;
      overflow-x: auto;
    }

    .report-top-header { text-align: center; margin-bottom: 12px; padding-top: 4px; }
    .school-title {
      margin: 0;
      font-size: 24px;
      font-weight: 900;
      color: #1e3a8a;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      line-height: 1.2;
    }
    .school-address-text {
      font-size: 14px;
      font-weight: 700;
      color: #334155;
      margin-top: 4px;
    }

    /* Navy Banners */
    .navy-title-banner {
      background: #1e3a8a;
      color: #ffffff;
      text-align: center;
      padding: 7px 14px;
      border-radius: 4px;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .navy-footer-banner {
      background: #1e3a8a;
      color: #ffffff;
      text-align: center;
      padding: 7px 14px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 12px;
    }

    .report-meta-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding: 2px 4px;
    }
    .meta-class { font-size: 14px; font-weight: 700; color: #0f172a; }
    .meta-class .lbl { color: #475569; margin-right: 4px; }
    .meta-class .val { color: #1e3a8a; }
    .meta-class .sec-val { color: #64748b; margin-left: 4px; }
    .meta-date-pill {
      border: 1.5px solid #1e3a8a;
      background: #eff6ff;
      color: #1e3a8a;
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    /* Report Data Table with Crisp Dark Borders & 100% Proportional Budgeting */
    .report-data-table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      border: 1.5px solid #0f172a;
      font-size: 12.5px;
    }
    .report-data-table th, .report-data-table td {
      border: 1.5px solid #0f172a;
      padding: 7px 8px;
      vertical-align: middle;
      box-sizing: border-box;
      overflow: hidden;
    }
    .report-data-table th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 800;
      text-align: center;
      font-size: 12px;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    .col-sno { width: 4%; }
    .col-name { width: 14%; text-align: left !important; }
    .col-class { width: 5%; }
    .col-cw { width: 27%; }
    .col-cw-rem { width: 11%; text-align: center; }
    .col-hw { width: 26%; }
    .col-hw-rem { width: 13%; text-align: center; }

    .text-center { text-align: center; }
    .col-sno-data { font-weight: 800; color: #1e293b; text-align: center; }
    .col-name-data { text-align: left; }
    .name-bold { font-weight: 800; color: #0f172a; font-size: 13px; word-break: break-word; }
    .sub-roll { font-size: 11px; color: #64748b; font-weight: 600; }
    .col-class-data { font-weight: 700; color: #1e3a8a; text-align: center; }
    .name-row-flex {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }
    .row-wa-btn {
      width: 24px;
      height: 24px;
      line-height: 24px;
      border-radius: 50%;
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #86efac;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
      padding: 0;
      flex-shrink: 0;
      &:hover {
        background: #16a34a;
        color: #ffffff;
        border-color: #16a34a;
        transform: scale(1.1);
      }
    }
    .row-wa-btn mat-icon { font-size: 13.5px; width: 13.5px; height: 13.5px; line-height: 13.5px; }

    .row-wa-badge-btn {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #86efac;
      border-radius: 5px;
      padding: 2px 7px;
      font-size: 10.5px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
      flex-shrink: 0;
      mat-icon {
        font-size: 13px !important;
        width: 13px !important;
        height: 13px !important;
        line-height: 13px !important;
      }
      &:hover {
        background: #16a34a;
        color: #ffffff;
        border-color: #15803d;
        transform: scale(1.05);
      }
    }

    .col-absent-cell {
      background: #fff5f5;
      padding: 10px !important;
      text-align: center;
      vertical-align: middle !important;
    }
    .col-absent-merged {
      background: #fff5f5;
      padding: 12px !important;
    }
    .report-absent-badge {
      display: inline-block;
      background: #fee2e2;
      color: #dc2626;
      border: 1.5px solid #f87171;
      font-weight: 900;
      font-size: 13px;
      letter-spacing: 2px;
      padding: 4px 22px;
      border-radius: 999px;
      box-shadow: 0 1px 2px rgba(220,38,38,0.1);
    }
    .report-absent-badge.badge-leave {
      background: #faf5ff;
      color: #9333ea;
      border-color: #d8b4fe;
      box-shadow: 0 1px 2px rgba(147,51,234,0.1);
    }

    .col-bracket-cell {
      padding: 8px 10px !important;
      vertical-align: middle !important;
      text-align: center !important;
      background: #ffffff;
    }
    .absent-bracket-layout {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .absent-subjects-col {
      display: inline-flex;
      flex-direction: column;
      gap: 4px;
      align-items: flex-start;
    }
    .brace-svg {
      width: 14px;
      align-self: stretch;
      min-height: 48px;
      flex-shrink: 0;
    }
    .absent-text-red {
      font-size: 15px;
      font-weight: 800;
      color: #dc2626;
      letter-spacing: 0.3px;
    }

    .col-notmarked-cell {
      background: #fafafa;
      padding: 10px !important;
      text-align: center;
      vertical-align: middle !important;
    }
    .report-dash {
      font-size: 16px;
      font-weight: 700;
      color: #94a3b8;
    }
    .col-work-data { text-align: left; }
    .task-entry {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 3px 5px;
      margin-bottom: 4px;
      line-height: 1.35;
    }
    .task-entry:last-child { margin-bottom: 0; }
    .task-arrow { font-weight: 700; color: #64748b; }
    .task-text { font-weight: 600; color: #1e293b; font-size: 12.5px; word-break: break-word; }
    .task-teacher { font-size: 10px; font-weight: 700; color: #64748b; font-style: italic; white-space: nowrap; }
    .task-entry .hw-tick { margin-left: auto; font-weight: 900; font-size: 13px; flex-shrink: 0; }
    .hw-tick.hw-completed { color: #15803d; }
    .hw-tick.hw-partial { color: #b45309; }
    .hw-tick.hw-notdone { color: #dc2626; }
    .hw-tick.hw-pending { color: #94a3b8; font-size: 11px; }
    .hw-summary { margin-top: 3px; font-size: 10.5px; font-weight: 800; color: #1e3a8a; }
    .report-legend { margin-top: 6px; text-align: center; font-size: 11px; font-weight: 700; color: #475569; }
    .sign-row { display: flex; justify-content: space-between; margin-top: 14px; font-size: 12px; font-weight: 700; color: #0f172a; }
    .no-tasks-text { color: #94a3b8; text-align: center; }
    
    .col-rem-data { text-align: center; vertical-align: middle !important; font-size: 11px; padding: 6px 6px !important; }
    .rem-content { display: flex; flex-direction: column; gap: 4px; align-items: center; justify-content: center; width: 100%; }
    .rem-text-badge {
      display: inline-block;
      padding: 3px 7px;
      border-radius: 5px;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.25;
      word-break: normal;
      overflow-wrap: normal;
      hyphens: none;
      white-space: normal;
      text-align: center;
      box-sizing: border-box;
      max-width: 100%;
    }
    .rem-text-badge.cw { background: #f0fdf4; color: #15803d; border: 1px solid #86efac; }
    .hw-rem-item {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 2.5px 6px;
      border-radius: 5px;
      font-size: 11px;
      font-weight: 800;
      white-space: normal;
      line-height: 1.2;
      text-align: center;
      box-sizing: border-box;
      max-width: 100%;
    }
    .hw-rem-item.rem-completed { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .hw-rem-item.rem-notdone { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }
    .hw-rem-item.rem-partial { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .hw-rem-item.rem-pending { background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; }
    .rem-tick { font-weight: 900; font-size: 11.5px; flex-shrink: 0; }
    .rem-label { font-weight: 800; font-size: 11px; letter-spacing: 0.1px; word-break: normal; hyphens: none; }
    .empty-dash { color: #94a3b8; font-weight: 700; font-size: 14px; }

    /* Subject pill styling matching user's photo */
    .subject-pill {
      display: inline-block;
      padding: 1px 7px;
      border-radius: 4px;
      font-size: 11.5px;
      font-weight: 800;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .sub-theme-0 { background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe; } /* Lavender Purple */
    .sub-theme-1 { background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; } /* Sky Blue */
    .sub-theme-2 { background: #dcfce7; color: #15803d; border: 1px solid #86efac; } /* Emerald Green */
    .sub-theme-3 { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; } /* Amber Gold */
    .sub-theme-4 { background: #fce7f3; color: #be185d; border: 1px solid #fbcfe8; } /* Rose Pink */
    .sub-theme-5 { background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; } /* Royal Indigo */
    .sub-theme-6 { background: #ccfbf1; color: #0f766e; border: 1px solid #99f6e4; } /* Teal Mint */
    .sub-theme-7 { background: #ffedd5; color: #c2410c; border: 1px solid #fed7aa; } /* Coral Orange */

    .prev-hw-section {
      margin-top: 14px;
      page-break-inside: avoid;
    }
    .prev-hw-banner {
      background: #1e3a8a;
      color: #ffffff;
      padding: 6px 12px;
      font-size: 11.5px;
      font-weight: 800;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 6px;
      border: 1.5px solid #0f172a;
      border-bottom: none;
    }
    .prev-hw-banner .ph-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .prev-score-chip {
      background: #dcfce7;
      color: #15803d;
      font-weight: 800;
      font-size: 11px;
      border-radius: 999px;
      padding: 2px 8px;
    }
    @media (max-width: 900px) {
      .header-main-row {
        flex-direction: column;
        align-items: stretch;
        padding: 12px 14px;
        gap: 10px;
      }
      .header-left {
        width: 100%;
      }
      .header-primary-actions {
        width: 100%;
        flex-wrap: wrap;
        justify-content: flex-start;
      }
      .header-sub-toolbar {
        flex-direction: column;
        align-items: stretch;
        padding: 8px 14px;
        gap: 8px;
      }
      .sub-toolbar-right {
        width: 100%;
        flex-wrap: wrap;
      }
      .modal-body-scroll {
        padding: 10px 4px 24px;
      }
      .print-paper-sheet {
        padding: 14px 8px;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      .report-data-table {
        min-width: 720px;
      }
    }

    @media (max-width: 540px) {
      .header-primary-actions button {
        flex: 1 1 100%;
      }
      .sub-toolbar-right button {
        flex: 1 1 100%;
      }
      .dialog-quick-meta {
        flex-wrap: wrap;
      }
      .school-title {
        font-size: 18px;
      }
    }

    @media print {
      body * { visibility: hidden !important; }
      .print-paper-sheet, .print-paper-sheet * { visibility: visible !important; }
      .print-paper-sheet {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        width: 100vw !important;
        max-width: 100vw !important;
        box-shadow: none !important;
        border: 1.5px solid #000 !important;
        margin: 0 !important;
        padding: 4mm 6mm !important;
        box-sizing: border-box !important;
      }
      .report-data-table {
        border: 1.5px solid #000 !important;
        width: 100% !important;
        table-layout: fixed !important;
        border-collapse: collapse !important;
        font-size: 11px !important;
      }
      .report-data-table th, .report-data-table td {
        border: 1px solid #000 !important;
        padding: 3.5px 5px !important;
        box-sizing: border-box !important;
      }
      .col-sno { width: 4% !important; }
      .col-name { width: 14% !important; }
      .col-class { width: 5% !important; }
      .col-cw { width: 27% !important; }
      .col-cw-rem { width: 11% !important; }
      .col-hw { width: 26% !important; }
      .col-hw-rem { width: 13% !important; }
      .navy-title-banner, .navy-footer-banner, .subject-pill, .rem-text-badge, .hw-rem-item {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .row-wa-btn, .hide-on-print {
        display: none !important;
      }
      @page {
        size: A4 landscape;
        margin: 5mm 6mm;
      }
    }
  `]
})
export class DailyDiaryReportDialogComponent implements OnInit {
  reportHeader?: DailyDiaryReportHeader;
  rows: DailyStudentDiaryRow[] = [];
  includePreviousHw = false;
  loading = false;
  sendingWhatsApp = false;
  logoFailed = false;

  constructor(
    public dialogRef: MatDialogRef<DailyDiaryReportDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService,
    public authService: AuthService
  ) {
    if (data?.students) {
      this.rows = data.students;
    }
  }

  get logoUrl(): string | null {
    return this.authService.getInstituteLogoUrl();
  }

  get formattedDate(): string {
    const raw = this.reportHeader?.reportDate || this.reportHeader?.diaryDate || this.data.date;
    if (!raw) return '';
    const parts = raw.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return raw;
  }

  getActiveTasks(tasks?: DailySubjectTaskItem[]): DailySubjectTaskItem[] {
    if (!tasks) return [];
    return tasks.filter(t => t.task && t.task.trim().length > 0);
  }

  hwTickSymbol(hw: DailySubjectTaskItem): string {
    switch (hw.status || 'Pending') {
      case 'Completed': return '✔';
      case 'Partial': return '◐';
      case 'NotDone': return '✘';
      default: return '⏳';
    }
  }

  hwTickClass(hw: DailySubjectTaskItem): string {
    return 'hw-' + (hw.status || 'Pending').toLowerCase();
  }

  hwTickTitle(hw: DailySubjectTaskItem): string {
    const labels: Record<string, string> = { Completed: 'Completed', Partial: 'Partially done', NotDone: 'Not done', Pending: 'Not checked yet' };
    const base = labels[hw.status || 'Pending'] || 'Not checked yet';
    return hw.statusRemark ? `${base} - ${hw.statusRemark}` : base;
  }

  /** "done / total" for the H.W. points of a student, only once at least one point has been checked. */
  hwSummary(row: DailyStudentDiaryRow): string | null {
    const tasks = this.getActiveTasks(row.homeWork);
    if (tasks.length === 0) return null;
    if (!tasks.some(t => (t.status || 'Pending') !== 'Pending')) return null;
    const done = tasks.reduce((n, t) => n + (t.status === 'Completed' ? 1 : (t.status === 'Partial' ? 0.5 : 0)), 0);
    return `${done} / ${tasks.length}`;
  }

  get formattedPreviousHwDate(): string {
    const raw = this.reportHeader?.previousHwDate;
    if (!raw) return '';
    const parts = raw.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return raw;
  }

  previousHwSummary(prow: any): string | null {
    const tasks = this.getActiveTasks(prow.homeWork);
    if (tasks.length === 0) return null;
    const done = tasks.reduce((n: number, t: DailySubjectTaskItem) => n + (t.status === 'Completed' ? 1 : (t.status === 'Partial' ? 0.5 : 0)), 0);
    return `${done} / ${tasks.length}`;
  }

  getClassSubjects(): string[] {
    const list: string[] = [];
    for (const r of this.rows) {
      for (const cw of r.classWork || []) {
        if (cw.subject && cw.subject.trim() && cw.task && cw.task.trim().length > 0) {
          const s = cw.subject.trim();
          if (!list.includes(s)) list.push(s);
        }
      }
      for (const hw of r.homeWork || []) {
        if (hw.subject && hw.subject.trim() && hw.task && hw.task.trim().length > 0) {
          const s = hw.subject.trim();
          if (!list.includes(s)) list.push(s);
        }
      }
    }
    if (list.length > 0) {
      return list;
    }
    // If no student has work yet, check if subjectOptions was passed
    if (this.data?.subjectOptions && Array.isArray(this.data.subjectOptions) && this.data.subjectOptions.length > 0) {
      return this.data.subjectOptions;
    }
    return [];
  }

  isAbsentStudent(row: DailyStudentDiaryRow): boolean {
    if (row.isAbsent) return true;
    const status = (row.attendanceStatus || '').toLowerCase();
    if (status === 'absent' || status === 'leave' || status === 'notmarked') return true;
    const hasCw = this.getActiveTasks(row.classWork).length > 0;
    const hasHw = this.getActiveTasks(row.homeWork).length > 0;
    return !hasCw && !hasHw;
  }

  getCwRemarks(row: DailyStudentDiaryRow): string {
    const taskRemarks = (row.classWork || [])
      .filter(cw => cw.statusRemark && cw.statusRemark.trim().length > 0)
      .map(cw => cw.statusRemark!.trim());
    if (taskRemarks.length > 0) {
      return taskRemarks.join(', ');
    }
    return (row.remarks || '').trim();
  }

  getCwRemarksList(row: DailyStudentDiaryRow): { subject: string; text: string; colorClass: string }[] {
    const list: { subject: string; text: string; colorClass: string }[] = [];
    for (const cw of this.getActiveTasks(row.classWork)) {
      if (cw.statusRemark && cw.statusRemark.trim().length > 0) {
        const txt = cw.statusRemark.trim();
        let cls = 'rem-pending';
        const l = txt.toLowerCase();
        if (l.includes('checked') && !l.includes('un')) cls = 'rem-completed';
        else if (l.includes('uncheck')) cls = 'rem-pending';
        else if (l.includes('no remember')) cls = 'rem-notdone';
        else if (l.includes('remember')) cls = 'rem-partial';
        else if (l.includes('good')) cls = 'rem-completed';
        list.push({ subject: cw.subject, text: txt, colorClass: cls });
      }
    }
    if (list.length === 0 && row.remarks && row.remarks.trim().length > 0) {
      list.push({ subject: '', text: row.remarks.trim(), colorClass: 'rem-partial' });
    }
    return list;
  }

  getHwRemarks(row: DailyStudentDiaryRow): { text: string; status: string; symbol: string }[] {
    const list: { text: string; status: string; symbol: string }[] = [];
    for (const hw of this.getActiveTasks(row.homeWork)) {
      const status = hw.status || 'Pending';
      const symbol = this.hwTickSymbol(hw);
      const text = (hw.statusRemark && hw.statusRemark.trim().length > 0)
        ? hw.statusRemark.trim()
        : (status === 'Completed' ? 'Completed' : (status === 'Partial' ? 'Partial' : (status === 'NotDone' ? 'Not Done' : 'Unchecked')));
      list.push({ text, status, symbol });
    }
    return list;
  }

  ngOnInit(): void {
    this.fetchFreshReport();
  }

  fetchFreshReport(): void {
    let url = `${API_BASE}/homework/daily-diary/report?date=${this.data.date}`;
    if (this.data.batchId) url += `&batchId=${this.data.batchId}`;
    if (this.data.classId) url += `&classId=${this.data.classId}`;
    if (this.data.sectionId) url += `&sectionId=${this.data.sectionId}`;

    this.http.get<any>(url).subscribe({
      next: r => {
        const rawRows: DailyStudentDiaryRow[] = r?.rows || r?.items || [];
        this.reportHeader = {
          tenantName: r?.institutionName || r?.tenantName,
          institutionName: r?.institutionName || r?.tenantName,
          tenantAddress: r?.subtitleOrAddress || r?.tenantAddress,
          subtitleOrAddress: r?.subtitleOrAddress || r?.tenantAddress,
          reportTitle: r?.reportTitle || (this.data.batchId ? 'BATCH DAILY DPP & HOME WORK REPORT' : 'STUDENT DAILY CLASS WORK & HOME WORK REPORT'),
          reportDate: r?.diaryDate || r?.reportDate,
          diaryDate: r?.diaryDate || r?.reportDate,
          className: r?.batchName ? ('Batch: ' + r.batchName) : (r?.className || this.data.className),
          sectionName: r?.sectionName || this.data.sectionName,
          batchName: r?.batchName,
          classTeacherName: r?.classTeacherName,
          items: rawRows,
          rows: rawRows,
          previousHwDate: r?.previousHwDate,
          previousHw: r?.previousHw
        };

        if (rawRows.length > 0) {
          if (this.data?.students && Array.isArray(this.data.students) && this.data.students.length > 0) {
            const memoryMap = new Map<string, DailyStudentDiaryRow>(
              this.data.students.map((s: DailyStudentDiaryRow) => [s.studentId, s])
            );
            rawRows.forEach(r => {
              const mem = memoryMap.get(r.studentId);
              if (mem) {
                (r.classWork || []).forEach((cw: DailySubjectTaskItem) => {
                  const match = (mem.classWork || []).find((mc: DailySubjectTaskItem) =>
                    (mc.subject || '').trim().toLowerCase() === (cw.subject || '').trim().toLowerCase()
                  );
                  if (match?.statusRemark) cw.statusRemark = match.statusRemark;
                });
                if (!r.remarks && mem.remarks) r.remarks = mem.remarks;
              }
            });
          }

          if (this.data?.students && this.data.students.length === 1) {
            const single = rawRows.filter((x: any) => x.studentId === this.data.students[0].studentId);
            this.rows = single.length > 0 ? single : rawRows;
          } else {
            this.rows = rawRows;
          }
        } else if (this.data?.students && this.data.students.length > 0) {
          this.rows = this.data.students;
        }
      },
      error: () => {
        if (this.data?.students && this.data.students.length > 0) {
          this.rows = this.data.students;
        }
      }
    });
  }

  printReport(): void {
    const el = document.getElementById('printableDiaryReport');
    if (!el) {
      window.print();
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${this.reportHeader?.tenantName || this.authService.getInstituteName() || 'Daily Diary Report'} - Daily Diary Report</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #ffffff;
            color: #0f172a;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            width: 100%;
          }
          @page {
            size: A4 landscape;
            margin: 5mm 6mm;
          }
          .print-paper-sheet {
            width: 100% !important;
            max-width: 100% !important;
            border: 1.5px solid #0f172a !important;
            box-shadow: none !important;
            padding: 5mm 7mm !important;
            margin: 0 !important;
            box-sizing: border-box !important;
          }
          .report-top-header { text-align: center; margin-bottom: 6px; }
          .school-title {
            margin: 0;
            font-size: 20px;
            font-weight: 900;
            color: #1e3a8a;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            line-height: 1.2;
          }
          .school-address-text {
            font-size: 12px;
            font-weight: 700;
            color: #334155;
            margin-top: 2px;
          }
          .navy-title-banner {
            background: #1e3a8a !important;
            color: #ffffff !important;
            text-align: center;
            padding: 5px 12px;
            border-radius: 4px;
            font-size: 12.5px;
            font-weight: 800;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin: 5px 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .navy-footer-banner {
            background: #1e3a8a !important;
            color: #ffffff !important;
            text-align: center;
            padding: 5px 12px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-top: 7px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .report-meta-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 5px;
            padding: 2px 0;
          }
          .meta-class { font-size: 12.5px; font-weight: 700; color: #0f172a; }
          .meta-class .lbl { color: #475569; margin-right: 4px; }
          .meta-class .val { color: #1e3a8a; }
          .meta-date-pill {
            border: 1.5px solid #1e3a8a;
            background: #eff6ff !important;
            color: #1e3a8a;
            padding: 2px 10px;
            border-radius: 20px;
            font-size: 11.5px;
            font-weight: 800;
          }
          .report-data-table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            border: 1.5px solid #0f172a !important;
            font-size: 11px !important;
          }
          .report-data-table th, .report-data-table td {
            border: 1.2px solid #0f172a !important;
            padding: 3.5px 5px !important;
            vertical-align: middle !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }
          .report-data-table th {
            background: #f1f5f9 !important;
            color: #0f172a !important;
            font-weight: 800 !important;
            text-align: center !important;
            font-size: 11px !important;
            letter-spacing: 0.3px !important;
            text-transform: uppercase !important;
          }
          .col-sno { width: 4% !important; }
          .col-name { width: 14% !important; text-align: left !important; }
          .col-class { width: 5% !important; }
          .col-cw { width: 27% !important; }
          .col-cw-rem { width: 11% !important; text-align: center !important; }
          .col-hw { width: 26% !important; }
          .col-hw-rem { width: 13% !important; text-align: center !important; }
          .col-rem-data { text-align: center; vertical-align: middle !important; font-size: 10.5px !important; padding: 3px 4px !important; }
          .rem-content { display: flex !important; flex-direction: column !important; gap: 3px !important; align-items: center !important; justify-content: center !important; width: 100% !important; }
          .rem-text-badge {
            display: inline-block !important;
            padding: 2px 5px !important;
            border-radius: 4px !important;
            font-size: 10px !important;
            font-weight: 700 !important;
            word-break: normal !important;
            overflow-wrap: normal !important;
            hyphens: none !important;
            white-space: normal !important;
            line-height: 1.25 !important;
            text-align: center !important;
            box-sizing: border-box !important;
            max-width: 100% !important;
          }
          .rem-text-badge.cw { background: #f0fdf4 !important; color: #15803d !important; border: 1px solid #86efac !important; }
          .hw-rem-item {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 3px !important;
            padding: 2px 5px !important;
            border-radius: 4px !important;
            font-size: 10px !important;
            font-weight: 800 !important;
            white-space: normal !important;
            line-height: 1.2 !important;
            text-align: center !important;
            box-sizing: border-box !important;
            max-width: 100% !important;
          }
          .hw-rem-item.rem-completed { background: #dcfce7 !important; color: #15803d !important; border: 1px solid #86efac !important; }
          .hw-rem-item.rem-notdone { background: #fee2e2 !important; color: #dc2626 !important; border: 1px solid #fca5a5 !important; }
          .hw-rem-item.rem-partial { background: #fef3c7 !important; color: #b45309 !important; border: 1px solid #fde68a !important; }
          .hw-rem-item.rem-pending { background: #f1f5f9 !important; color: #64748b !important; border: 1px solid #cbd5e1 !important; }
          .rem-tick { font-weight: 900 !important; font-size: 11px !important; flex-shrink: 0 !important; }
          .rem-label { font-weight: 800 !important; font-size: 10px !important; word-break: normal !important; hyphens: none !important; }
          .empty-dash { color: #94a3b8 !important; font-weight: 700 !important; font-size: 13px !important; }
          .text-center { text-align: center !important; }
          .col-sno-data { font-weight: 800 !important; color: #1e293b !important; text-align: center !important; }
          .col-name-data { text-align: left !important; }
          .name-bold { font-weight: 800 !important; color: #0f172a !important; font-size: 11.5px !important; word-break: break-word !important; }
          .sub-roll { font-size: 10px !important; color: #64748b !important; font-weight: 600 !important; }
          .col-class-data { font-weight: 700 !important; color: #1e3a8a !important; text-align: center !important; }
          .col-work-data { text-align: left !important; }
          .task-entry {
            display: flex !important;
            align-items: baseline !important;
            flex-wrap: wrap !important;
            gap: 2px 4px !important;
            margin-bottom: 2.5px !important;
            line-height: 1.3 !important;
          }
          .task-entry:last-child { margin-bottom: 0 !important; }
          .task-arrow { font-weight: 700 !important; color: #64748b !important; }
          .task-text { font-weight: 600 !important; color: #1e293b !important; font-size: 11px !important; word-break: break-word !important; }
          .task-teacher { font-size: 9px !important; font-weight: 700 !important; color: #64748b !important; font-style: italic !important; white-space: nowrap !important; }
          .task-entry .hw-tick { margin-left: auto !important; font-weight: 900 !important; font-size: 12px !important; flex-shrink: 0 !important; }
          .hw-tick.hw-completed { color: #15803d !important; }
          .hw-tick.hw-partial { color: #b45309 !important; }
          .hw-tick.hw-notdone { color: #dc2626 !important; }
          .hw-tick.hw-pending { color: #94a3b8 !important; font-size: 10px !important; }
          .hw-summary { margin-top: 2px !important; font-size: 9.5px !important; font-weight: 800 !important; color: #1e3a8a !important; }
          .report-legend { margin-top: 5px !important; text-align: center !important; font-size: 10px !important; font-weight: 700 !important; color: #475569 !important; }
          .sign-row { display: flex !important; justify-content: space-between !important; margin-top: 10px !important; font-size: 11px !important; font-weight: 700 !important; color: #0f172a !important; }
          .prev-hw-section {
            margin-top: 12px;
            page-break-inside: avoid;
          }
          .prev-hw-banner {
            background: #1e3a8a !important;
            color: #ffffff !important;
            padding: 4px 8px;
            font-size: 11px;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 6px;
            border: 1.2px solid #0f172a;
            border-bottom: none;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .prev-score-chip {
            background: #dcfce7 !important;
            color: #15803d !important;
            font-weight: 800;
            font-size: 10px;
            border-radius: 999px;
            padding: 2px 6px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .subject-pill {
            display: inline-block;
            padding: 1px 6px;
            border-radius: 4px;
            font-size: 10.5px;
            font-weight: 800;
            white-space: nowrap;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .sub-theme-0 { background: #f3e8ff !important; color: #7e22ce !important; border: 1px solid #d8b4fe !important; }
          .sub-theme-1 { background: #e0f2fe !important; color: #0284c7 !important; border: 1px solid #bae6fd !important; }
          .sub-theme-2 { background: #dcfce7 !important; color: #15803d !important; border: 1px solid #86efac !important; }
          .sub-theme-3 { background: #fef3c7 !important; color: #b45309 !important; border: 1px solid #fde68a !important; }
          .sub-theme-4 { background: #fce7f3 !important; color: #be185d !important; border: 1px solid #fbcfe8 !important; }
          .sub-theme-5 { background: #e0e7ff !important; color: #4338ca !important; border: 1px solid #c7d2fe !important; }
          .sub-theme-6 { background: #ccfbf1 !important; color: #0f766e !important; border: 1px solid #99f6e4 !important; }
          .sub-theme-7 { background: #ffedd5 !important; color: #c2410c !important; border: 1px solid #fed7aa !important; }
          
          .col-bracket-cell {
            padding: 6px 8px !important;
            vertical-align: middle !important;
            text-align: center !important;
          }
          .absent-bracket-layout {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          }
          .absent-subjects-col {
            display: inline-flex;
            flex-direction: column;
            gap: 3px;
            align-items: flex-start;
          }
          .brace-svg {
            width: 12px;
            align-self: stretch;
            min-height: 44px;
          }
          .absent-text-red {
            font-size: 13.5px;
            font-weight: 800;
            color: #dc2626 !important;
          }
        </style>
      </head>
      <body>
        ${el.innerHTML}
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  }

  getClassSummaryText(): string {
    const school = this.reportHeader?.tenantName || this.authService.getInstituteName() || 'Daily Diary';
    const address = this.reportHeader?.tenantAddress || '';
    const cls = this.reportHeader?.className || this.data.className || 'All Classes';
    const sec = this.reportHeader?.sectionName || this.data.sectionName;
    const classLabel = sec ? `${cls} (${sec})` : cls;
    const date = this.formattedDate;

    // Collect distinct subject-wise C.W. and H.W.
    const cwMap = new Map<string, string>();
    const hwMap = new Map<string, string>();
    const absentList: string[] = [];

    for (const r of this.rows) {
      if (this.isAbsentStudent(r)) {
        absentList.push(r.studentName);
      }
      for (const cw of r.classWork || []) {
        if (cw.subject && cw.task && cw.task.trim()) {
          const s = cw.subject.trim();
          if (!cwMap.has(s)) cwMap.set(s, cw.task.trim());
        }
      }
      for (const hw of r.homeWork || []) {
        if (hw.subject && hw.task && hw.task.trim()) {
          const s = hw.subject.trim();
          if (!hwMap.has(s)) hwMap.set(s, hw.task.trim());
        }
      }
    }

    let text = `🏫 *${school}*\n`;
    if (address) text += `📍 ${address}\n`;
    text += `\n📋 *DAILY CLASS WORK & HOME WORK REPORT*\n`;
    text += `📅 *Date:* ${date}  |  *Class:* ${classLabel}\n`;
    text += `───────────────────────────\n`;

    text += `📝 *TODAY'S CLASS WORK (C.W.):*\n`;
    if (cwMap.size > 0) {
      cwMap.forEach((task, subj) => {
        text += `• *[${subj}]:* ${task}\n`;
      });
    } else {
      text += `• No Class Work recorded today\n`;
    }
    text += `\n`;

    text += `🏠 *TODAY'S HOME WORK (H.W.):*\n`;
    if (hwMap.size > 0) {
      hwMap.forEach((task, subj) => {
        text += `• *[${subj}]:* ${task}\n`;
      });
    } else {
      text += `• No Home Work recorded today\n`;
    }
    text += `\n`;

    if (this.includePreviousHw && this.reportHeader?.previousHw && this.reportHeader.previousHw.length > 0) {
      const prevTotal = this.reportHeader.previousHw.reduce((n, p) => n + (p.homeWork || []).length, 0);
      const prevDone = this.reportHeader.previousHw.reduce((n, p) => n + (p.homeWork || []).filter(h => h.status === 'Completed').length, 0);
      text += `✅ *PREVIOUS H.W. VERIFIED (${this.formattedPreviousHwDate}):* ${prevDone}/${prevTotal} completed\n\n`;
    }

    text += `❌ *ABSENT STUDENTS:* `;
    if (absentList.length > 0) {
      text += `${absentList.join(', ')}\n`;
    } else {
      text += `None (All Present ✅)\n`;
    }

    text += `───────────────────────────\n`;
    text += `⭐ *DISCIPLINE  |  GOOD HABITS  |  BRIGHT FUTURE* ⭐`;
    return text;
  }

  copyClassSummaryWhatsApp(): void {
    const text = this.getClassSummaryText();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.confirmDialog.alert('Class Summary Copied 📋', 'Class summary copied to clipboard! You can now paste it into your WhatsApp group chat.', 'success');
      }).catch(() => {
        this.confirmDialog.alert('WhatsApp Text', text, 'info');
      });
    } else {
      this.confirmDialog.alert('WhatsApp Text', text, 'info');
    }
  }

  shareToClassGroupWhatsApp(): void {
    const text = this.getClassSummaryText();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  generateStudentWhatsAppText(r: DailyStudentDiaryRow): string {
    const school = this.reportHeader?.tenantName || this.authService.getInstituteName() || 'Daily Diary';
    const address = this.reportHeader?.tenantAddress || '';
    const cls = this.reportHeader?.className || this.data.className || 'All Classes';
    const sec = this.reportHeader?.sectionName || this.data.sectionName;
    const classLabel = sec ? `${cls} (${sec})` : cls;
    const date = this.formattedDate;

    let text = `🏫 *${school}*\n`;
    if (address) text += `📍 ${address}\n`;
    text += `📋 *STUDENT DAILY DIARY REPORT*\n`;
    text += `📅 *Date:* ${date}  |  *Class:* ${classLabel}\n`;
    text += `👤 *Student:* *${r.studentName}*${r.rollNumber ? ' (Roll: #' + r.rollNumber + ')' : ''}\n`;
    text += `───────────────────────────\n`;

    if (this.isAbsentStudent(r)) {
      text += `❌ *STATUS: ABSENT TODAY*\n`;
      text += `Student was marked absent today in class attendance.\n\n`;
      text += `📝 *TODAY'S CLASS WORK (For Home Study):*\n`;
      const cwList = this.getActiveTasks(r.classWork);
      if (cwList.length > 0) {
        for (const cw of cwList) text += `• *[${cw.subject}]:* ${cw.task}\n`;
      } else {
        text += `• Same as class routine\n`;
      }
      text += `\n🏠 *TODAY'S HOME WORK:*\n`;
      const hwList = this.getActiveTasks(r.homeWork);
      if (hwList.length > 0) {
        for (const hw of hwList) text += `• *[${hw.subject}]:* ${hw.task}\n`;
      } else {
        text += `• Check with classmate\n`;
      }
    } else {
      const cwParts = this.getActiveTasks(r.classWork).map(c => {
        let line = `• *[${c.subject}]:* ${c.task}`;
        if (c.teacherName) line += ` (${c.teacherName})`;
        if (c.statusRemark && c.statusRemark.trim().length > 0) line += ` 📌 _${c.statusRemark.trim()}_`;
        return line;
      }).join('\n');
      text += `📝 *CLASS WORK (C.W.):*\n${cwParts || '• No specific C.W. recorded'}\n`;
      if (r.remarks && r.remarks.trim()) text += `💬 *Student Note:* ${r.remarks.trim()}\n`;
      text += `\n`;

      const hwParts = this.getActiveTasks(r.homeWork).map(h => `• *[${h.subject}]:* ${h.task} ${this.hwTickSymbol(h)}`).join('\n');
      text += `🏠 *HOME WORK (H.W.):*\n${hwParts || '• No specific H.W. assigned'}\n`;
      const hwRemList = this.getHwRemarks(r).filter(x => x.text && x.text !== 'Unchecked');
      if (hwRemList.length > 0) {
        text += `📌 *H.W. Status / Remarks:* ${hwRemList.map(x => `${x.symbol} ${x.text}`).join(', ')}\n`;
      }

      if (this.includePreviousHw && this.reportHeader?.previousHw) {
        const prev = this.reportHeader.previousHw.find(p => p.studentId === r.studentId);
        if (prev && prev.homeWork && prev.homeWork.length > 0) {
          const prevParts = (prev.homeWork as DailySubjectTaskItem[]).map(h => `[${h.subject}] ${h.task} ${this.hwTickSymbol(h)}`).join(' | ');
          text += `⏮️ *PREV H.W. CHECKED (${this.formattedPreviousHwDate}):* ${prevParts}\n`;
        }
      }
    }

    text += `───────────────────────────\n`;
    text += `⭐ *DISCIPLINE  |  GOOD HABITS  |  BRIGHT FUTURE* ⭐`;
    return text;
  }

  copyWhatsAppText(): void {
    const school = this.reportHeader?.tenantName || this.authService.getInstituteName() || 'Daily Diary';
    const address = this.reportHeader?.tenantAddress || '';
    const cls = this.reportHeader?.className || this.data.className || 'All Classes';
    const date = this.formattedDate;

    let text = `🏫 *${school}*\n`;
    if (address) text += `📍 ${address}\n`;
    text += `📋 *STUDENT DAILY CLASS WORK & HOME WORK REPORT*\n`;
    text += `📅 *Date:* ${date}  |  *Class:* ${cls}\n`;
    text += `───────────────────────────\n`;

    const prevMap = new Map<string, any>();
    if (this.includePreviousHw && this.reportHeader?.previousHw) {
      for (const p of this.reportHeader.previousHw) prevMap.set(p.studentId, p);
    }

    let i = 1;
    for (const r of this.rows) {
      text += `*${i}. ${r.studentName}*${r.rollNumber ? ' (Roll: ' + r.rollNumber + ')' : ''}\n`;
      if (r.isAbsent) {
        text += `   ❌ *ABSENT*\n\n`;
      } else {
        const cwParts = (r.classWork || []).filter(c => c.task).map(c => {
          let line = `[${c.subject}] ${c.task}`;
          if (c.teacherName) line += ` (${c.teacherName})`;
          if (c.statusRemark && c.statusRemark.trim().length > 0) line += ` [${c.statusRemark.trim()}]`;
          return line;
        }).join(' | ');
        const hwParts = (r.homeWork || []).filter(h => h.task).map(h => `[${h.subject}] ${h.task}${h.teacherName ? ' (' + h.teacherName + ')' : ''} ${this.hwTickSymbol(h)}`).join(' | ');
        text += `   📝 *C.W:* ${cwParts || 'No work recorded'}\n`;
        if (r.remarks && r.remarks.trim()) text += `      💬 *Student Note:* ${r.remarks.trim()}\n`;
        text += `   🏠 *H.W:* ${hwParts || 'No work recorded'}\n`;
        const hwRemList = this.getHwRemarks(r).filter(x => x.text && x.text !== 'Unchecked');
        if (hwRemList.length > 0) {
          text += `      📌 *H.W. Remarks:* ${hwRemList.map(x => `${x.symbol} ${x.text}`).join(', ')}\n`;
        }
        const prev = this.includePreviousHw ? prevMap.get(r.studentId) : null;
        if (prev && prev.homeWork && prev.homeWork.length > 0) {
          const prevParts = (prev.homeWork as DailySubjectTaskItem[]).map(h => `[${h.subject}] ${h.task} ${this.hwTickSymbol(h)}`).join(' | ');
          text += `   ⏮️ *PREV H.W (${this.formattedPreviousHwDate}):* ${prevParts}\n`;
        }
        text += `\n`;
      }
      i++;
    }

    text += `───────────────────────────\n`;
    text += `⭐ *DISCIPLINE  |  GOOD HABITS  |  BRIGHT FUTURE* ⭐`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.confirmDialog.alert('Student-wise Diary Copied 📋', 'Student-wise detailed report copied to clipboard! You can now paste it into your WhatsApp chat.', 'success');
      }).catch(() => {
        this.confirmDialog.alert('WhatsApp Text', text, 'info');
      });
    } else {
      this.confirmDialog.alert('WhatsApp Text', text, 'info');
    }
  }

  sendAutomatedWhatsAppToAllParents(): void {
    if (this.sendingWhatsApp || this.rows.length === 0) return;

    this.sendingWhatsApp = true;
    const items = this.rows.map(r => ({
      studentId: r.studentId,
      studentName: r.studentName,
      rollNumber: r.rollNumber || '',
      phone: r.parentWhatsAppPhone || '',
      messageText: this.generateStudentWhatsAppText(r)
    }));

    this.http.post<any>(`${API_BASE}/homework/daily-diary/send-whatsapp-all`, {
      diaryDate: this.reportHeader?.diaryDate || this.data.date || new Date().toISOString(),
      classId: this.data.classId || null,
      sectionId: this.data.sectionId || null,
      items
    }).subscribe({
      next: (res) => {
        this.sendingWhatsApp = false;
        let details = `Daily CW & HW report has been successfully delivered to ${res.sentCount} parent(s) via WhatsApp.`;
        if (res.skippedCount > 0 && res.skippedRecipients?.length > 0) {
          details += `\n\nNotice: ${res.skippedCount} student(s) skipped due to missing phone number:\n• ${res.skippedRecipients.join('\n• ')}`;
        }
        this.confirmDialog.alert(
          'WhatsApp Dispatch Complete 🚀',
          details,
          res.sentCount > 0 ? 'success' : 'warning'
        );
      },
      error: (err) => {
        this.sendingWhatsApp = false;
        this.confirmDialog.alert(
          'Dispatch Error',
          err?.error?.message || 'Unable to dispatch WhatsApp messages. Please verify gateway connectivity.',
          'danger'
        );
      }
    });
  }

  sendIndividualStudentWhatsApp(row: DailyStudentDiaryRow): void {
    const text = this.generateStudentWhatsAppText(row);
    const phone = (row.parentWhatsAppPhone || '').trim();
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }

    if (cleanPhone && cleanPhone.length >= 10) {
      const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      const url = `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
      this.http.post<any>(`${API_BASE}/homework/daily-diary/send-whatsapp-single`, {
        studentId: row.studentId,
        studentName: row.studentName,
        rollNumber: row.rollNumber || '',
        phone: row.parentWhatsAppPhone,
        messageText: text
      }).subscribe({ error: () => {} });
    } else {
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
      this.confirmDialog.alert(
        'WhatsApp Opened',
        `No phone number found in ${row.studentName}'s profile. The personalized diary text has been copied to your clipboard and WhatsApp share window opened.`,
        'info'
      );
    }
  }

  getSubjectColorClass(subject: string): string {
    if (!subject) return 'sub-theme-0';
    let hash = 0;
    const clean = subject.trim().toLowerCase();
    for (let i = 0; i < clean.length; i++) {
      hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % 8;
    return `sub-theme-${idx}`;
  }
}

// ===========================================================================
// STUDENT REMARK / NOTE DIALOG COMPONENT
// ===========================================================================
@Component({
  selector: 'app-student-remark-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="remark-dialog-container">
      <div class="dialog-header-custom">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>edit_note</mat-icon>
          </div>
          <div>
            <h2 class="dialog-title">Student Daily Remark</h2>
            <div class="dialog-subtitle">
              <span>👤 <strong>{{ data.studentName }}</strong></span>
              <span *ngIf="data.rollNumber" class="meta-dot">&bull; Roll: <strong>{{ data.rollNumber }}</strong></span>
              <span *ngIf="data.className" class="meta-dot">&bull; Class: <strong>{{ data.className }}</strong></span>
            </div>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="dialogRef.close()" matTooltip="Close (Esc)">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-body">
        <div class="preset-section">
          <span class="preset-title">⚡ Quick Presets:</span>
          <div class="preset-chips">
            <button type="button" class="preset-chip" *ngFor="let p of quickPresets" (click)="applyPreset(p)">
              {{ p }}
            </button>
          </div>
        </div>

        <div class="remark-input-group">
          <label class="remark-lbl">Teacher's Note / Remark:</label>
          <textarea
            class="remark-textarea"
            rows="4"
            [(ngModel)]="remarkText"
            placeholder="Type special note, copy checking feedback, or instructions for parents..."
            maxlength="300"
          ></textarea>
          <div class="textarea-foot">
            <span class="hint">Visible on student daily diary & print/WhatsApp reports</span>
            <span class="char-count">{{ (remarkText || '').length }}/300</span>
          </div>
        </div>
      </div>

      <div class="dialog-actions">
        <button mat-button class="clear-btn" *ngIf="remarkText" (click)="remarkText = ''">
          <mat-icon>backspace</mat-icon> Clear Note
        </button>
        <span class="spacer"></span>
        <button mat-stroked-button (click)="dialogRef.close()">Cancel</button>
        <button mat-raised-button class="save-btn" (click)="save()">
          <mat-icon>check</mat-icon> Save Remark
        </button>
      </div>
    </div>
  `,
  styles: [`
    .remark-dialog-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      font-family: inherit;
    }
    .dialog-header-custom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-icon-box {
      width: 42px;
      height: 42px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .dialog-title {
      margin: 0;
      font-size: 17px;
      font-weight: 700;
      color: #1e3a8a;
    }
    .dialog-subtitle {
      margin-top: 3px;
      font-size: 12.5px;
      color: #3b82f6;
    }
    .dialog-subtitle strong { color: #1e40af; }
    .meta-dot { margin-left: 6px; }
    .close-btn { color: #64748b; }
    .close-btn:hover { color: #1e293b; }

    .dialog-body {
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .preset-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .preset-title {
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .preset-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .preset-chip {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      color: #334155;
      border-radius: 20px;
      padding: 4px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
    }
    .preset-chip:hover {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #1d4ed8;
      transform: translateY(-1px);
    }
    .remark-input-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .remark-lbl {
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
    }
    .remark-textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 13.5px;
      font-family: inherit;
      color: #0f172a;
      outline: none;
      resize: vertical;
      transition: border-color 0.15s ease;
    }
    .remark-textarea:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
    }
    .textarea-foot {
      display: flex;
      justify-content: space-between;
      font-size: 11.5px;
      color: #64748b;
    }
    .char-count { font-weight: 600; }

    .dialog-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }
    .dialog-actions .spacer { flex: 1; }
    .clear-btn { color: #dc2626 !important; font-weight: 600; }
    .save-btn {
      background: #2563eb !important;
      color: #ffffff !important;
      font-weight: 700;
      border-radius: 8px;
      padding: 0 20px;
    }
  `]
})
export class StudentRemarkDialogComponent {
  remarkText = '';
  quickPresets = [
    '✅ Complete Homework',
    '📚 Incomplete Homework',
    '✅ Checked',
    '⏳ Unchecked',
    '🧠 Remember',
    '❌ No Remember',
    '📓 Notebook not brought',
    '✍️ Needs handwriting improvement',
    '⭐ Good work / Very well done',
    '⏳ Late submission',
    '📞 Please contact teacher',
    '📝 Practice needed at home'
  ];

  constructor(
    public dialogRef: MatDialogRef<StudentRemarkDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { studentName: string; rollNumber?: string; className?: string; remarks?: string }
  ) {
    this.remarkText = data?.remarks || '';
  }

  applyPreset(preset: string): void {
    if (!this.remarkText || this.remarkText.trim() === '') {
      this.remarkText = preset;
    } else if (!this.remarkText.includes(preset)) {
      this.remarkText = `${this.remarkText.trim()}, ${preset}`;
    }
  }

  save(): void {
    this.dialogRef.close({ saved: true, remarks: (this.remarkText || '').trim() });
  }
}

