import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule, ReactiveFormsModule, FormBuilder,
  FormGroup, FormArray, Validators, AbstractControl
} from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CoachingService } from '../../core/services/coaching.service';
import { SchoolService, SchoolClassDto, SchoolSectionDto, SectionPeriodRoutineDto } from '../../core/services/school.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { SubjectsService, SubjectDto } from '../../core/services/subjects.service';
import { LocalDatetimePipe } from '../../shared/pipes/local-datetime.pipe';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';
import { AuthService } from '../../core/services/auth.service';
import { ExamAdmitCardDialogComponent } from './exam-admit-card-dialog.component';
import { ExamResultDialogComponent } from './exam-result-dialog.component';

@Component({
  selector: 'app-tests',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatCardModule, MatTableModule, MatPaginatorModule, MatSortModule,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatCheckboxModule, MatProgressBarModule, MatProgressSpinnerModule,
    MatTooltipModule, MatChipsModule, MatDividerModule,
    MatDialogModule, LocalDatetimePipe, IstDatetimeDirective
  ],
  template: `
    <div class="tests-wrapper">

      <!-- Executive Printable Exam Schedule Header (Only visible on print) -->
      <div class="print-schedule-header print-only">
        <div class="print-brand-box">
          <h1 class="print-inst-name">{{ instituteName }}</h1>
          <h2 class="print-doc-title">EXAMINATION &amp; TEST SCHEDULE TIMETABLE</h2>
          <div class="print-meta-row">
            <span><strong>Generated Date:</strong> <span [appIstDatetime]="todayDate" format="datetime"></span></span>
            <span class="meta-sep">&bull;</span>
            <span><strong>Batch:</strong> {{ activeBatchName }}</span>
            <span class="meta-sep">&bull;</span>
            <span><strong>Total Exams:</strong> {{ tests.length }}</span>
          </div>
        </div>
      </div>

      <!-- Page Header -->
      <div class="header-actions no-print">
        <div class="header-text-group">
          <h2>Test Exams &amp; Marks Entry</h2>
          <p>Bulk-schedule exams with date &amp; time, enter marks, and send WhatsApp report cards.</p>
        </div>
        <div class="header-buttons-row">
          <button mat-stroked-button class="print-schedule-btn" (click)="printSchedule()" matTooltip="Print Exam Schedule Timetable">
            <mat-icon>print</mat-icon> Print Schedule
          </button>
          <button *ngIf="isUserAdmin" mat-raised-button color="primary" class="add-btn" (click)="toggleBulkPlanner()">
            <mat-icon>{{ showBulkPlanner ? 'close' : 'add_circle' }}</mat-icon>
            {{ showBulkPlanner ? 'Close Scheduler' : 'Schedule Exam Session' }}
          </button>
        </div>
      </div>

      <!-- ════════════════════════════════════════ -->
      <!-- BULK EXAM SCHEDULER PANEL                -->
      <!-- ════════════════════════════════════════ -->
      <mat-card *ngIf="showBulkPlanner" class="planner-card mat-elevation-z3 no-print">
        <mat-card-content>

          <!-- Top row -->
          <div class="planner-header">
            <div class="planner-title">
              <mat-icon color="primary">event_note</mat-icon>
              <div>
                <span class="title-text">Bulk Exam Scheduler</span>
                <span class="title-sub">Plan multiple tests across subjects in a single workflow</span>
              </div>
            </div>
            <div class="planner-header-actions">
              <!-- Type Switcher (Visible only for Hybrid Institutes) -->
              <div class="planner-type-switcher" *ngIf="isHybridInstitute">
                <button type="button" class="type-pill-btn" [class.active]="plannerCategory === 'school'" (click)="setPlannerCategory('school')">
                  <mat-icon>school</mat-icon> <span>School Class Exam</span>
                </button>
                <button type="button" class="type-pill-btn" [class.active]="plannerCategory === 'coaching'" (click)="setPlannerCategory('coaching')">
                  <mat-icon>groups</mat-icon> <span>Coaching Batch Test</span>
                </button>
              </div>
              <span class="row-count-badge">{{ examRows.length }} Exam{{ examRows.length !== 1 ? 's' : '' }} Planned</span>
            </div>
          </div>

          <!-- Quick apply Default Class (School Mode) -->
          <div class="shared-batch-row" *ngIf="plannerCategory === 'school'">
            <mat-form-field appearance="outline" class="batch-selector" subscriptSizing="dynamic">
              <mat-label>Default Class for All Rows</mat-label>
              <mat-select [(ngModel)]="sharedClassId" (selectionChange)="onSharedClassChange()" panelClass="smart-batch-panel">
                <mat-option value="">-- Choose School Class --</mat-option>
                <mat-option *ngFor="let c of schoolClasses" [value]="c.id">
                  {{ c.name }} {{ c.code ? '(' + c.code + ')' : '' }}
                </mat-option>
              </mat-select>
              <mat-icon matSuffix>school</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="section-selector" subscriptSizing="dynamic" *ngIf="sharedClassId && sectionsForSharedClass.length > 0">
              <mat-label>Default Section (Optional)</mat-label>
              <mat-select [(ngModel)]="sharedSectionId" (selectionChange)="applySharedSectionToAll()" panelClass="smart-batch-panel">
                <mat-option value="">-- All Sections --</mat-option>
                <mat-option *ngFor="let s of sectionsForSharedClass" [value]="s.id">{{ s.name }}</mat-option>
              </mat-select>
              <mat-icon matSuffix>meeting_room</mat-icon>
            </mat-form-field>

            <span class="batch-tip" *ngIf="sharedClassId">
              <mat-icon>check_circle</mat-icon> Applied class to all rows
            </span>
          </div>

          <!-- Quick apply Default Batch (Coaching Mode) -->
          <div class="shared-batch-row" *ngIf="plannerCategory === 'coaching'">
            <mat-form-field appearance="outline" class="batch-selector" subscriptSizing="dynamic">
              <mat-label>Default Batch for All Rows</mat-label>
              <mat-select [(ngModel)]="sharedBatchId" (selectionChange)="applyBatchToAll()" panelClass="smart-batch-panel">
                <mat-option value="">-- Choose Batch --</mat-option>
                <mat-option *ngFor="let b of batches" [value]="b.id">{{ b.name }}</mat-option>
              </mat-select>
              <mat-icon matSuffix>groups</mat-icon>
            </mat-form-field>
            <span class="batch-tip" *ngIf="sharedBatchId">
              <mat-icon>check_circle</mat-icon> Applied to all rows
            </span>
          </div>

          <!-- Dynamic Exam Rows Form -->
          <div [formGroup]="bulkForm" class="planner-grid-wrapper">

            <!-- Desktop / Tablet Column Header (School Mode) -->
            <div class="row-labels school-mode" *ngIf="plannerCategory === 'school'">
              <span class="lbl-num">#</span>
              <span>Class *</span>
              <span>Section</span>
              <span>Subject *</span>
              <span>Exam Title *</span>
              <span>Date *</span>
              <span>Time</span>
              <span class="text-center lbl-marks">Marks *</span>
              <span class="text-center">Action</span>
            </div>

            <!-- Desktop / Tablet Column Header (Coaching Mode) -->
            <div class="row-labels coaching-mode" *ngIf="plannerCategory === 'coaching'">
              <span class="lbl-num">#</span>
              <span>Batch *</span>
              <span>Subject *</span>
              <span>Exam Title *</span>
              <span>Date *</span>
              <span>Time</span>
              <span class="text-center lbl-marks">Marks *</span>
              <span class="text-center">Action</span>
            </div>

            <!-- Form rows -->
            <ng-container formArrayName="exams">
              <div *ngFor="let row of examRows; let i = index"
                   [formGroupName]="i"
                   class="exam-row"
                   [ngClass]="plannerCategory === 'school' ? 'school-mode' : 'coaching-mode'"
                   [class.exam-row-error]="row.invalid && row.touched">

                <!-- Row number -->
                <div class="cell-num">
                  <span class="row-num">{{ i + 1 }}</span>
                </div>

                <!-- School Mode: Class -->
                <div class="cell-class" *ngIf="plannerCategory === 'school'">
                  <mat-form-field appearance="outline" class="field-compact" subscriptSizing="dynamic">
                    <mat-select formControlName="classId" placeholder="Select class..." panelClass="smart-batch-panel" (selectionChange)="onRowClassChange(i)">
                      <mat-option *ngFor="let c of schoolClasses" [value]="c.id">{{ c.name }}</mat-option>
                    </mat-select>
                    <mat-error *ngIf="row.get('classId')?.invalid">Required</mat-error>
                  </mat-form-field>
                </div>

                <!-- School Mode: Section -->
                <div class="cell-section" *ngIf="plannerCategory === 'school'">
                  <mat-form-field appearance="outline" class="field-compact" subscriptSizing="dynamic">
                    <mat-select formControlName="sectionId" placeholder="All Sections" panelClass="smart-batch-panel">
                      <mat-option value="">All</mat-option>
                      <mat-option *ngFor="let s of sectionsForRow(i)" [value]="s.id">{{ s.name }}</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>

                <!-- Coaching Mode: Batch -->
                <div class="cell-batch" *ngIf="plannerCategory === 'coaching'">
                  <mat-form-field appearance="outline" class="field-compact" subscriptSizing="dynamic">
                    <mat-select formControlName="batchId" placeholder="Select batch..." panelClass="smart-batch-panel">
                      <mat-option *ngFor="let b of batches" [value]="b.id">{{ b.name }}</mat-option>
                    </mat-select>
                    <mat-error *ngIf="row.get('batchId')?.invalid">Required</mat-error>
                  </mat-form-field>
                </div>

                <!-- Subject -->
                <div class="cell-subject">
                  <mat-form-field appearance="outline" class="field-compact" subscriptSizing="dynamic">
                    <mat-select formControlName="subject" placeholder="Subject..." panelClass="smart-subject-panel"
                                (openedChange)="onSubjectSelectOpened(i, $event)">
                      <mat-select-trigger>{{ examRows[i].get('subject')?.value || '' }}</mat-select-trigger>
                      <mat-option disabled class="select-search-option">
                        <div class="select-search-wrap" (click)="$event.stopPropagation()" (mousedown)="$event.stopPropagation()">
                          <mat-icon class="search-box-icon">search</mat-icon>
                          <input class="select-search-input"
                                 placeholder="Search subject..."
                                 [value]="subjectSearchTexts[i] || ''"
                                 (input)="filterSubjectsForRow(i, $event)"
                                 (click)="$event.stopPropagation()"
                                 (mousedown)="$event.stopPropagation()"
                                 (keydown)="$event.stopPropagation()"
                                 (keyup)="$event.stopPropagation()">
                          <button mat-icon-button type="button" class="clear-search-btn" *ngIf="subjectSearchTexts[i]"
                                  (click)="clearSubjectSearch(i, $event)" (mousedown)="$event.stopPropagation()">
                            <mat-icon>close</mat-icon>
                          </button>
                        </div>
                      </mat-option>
                      <mat-option *ngFor="let s of (filteredSubjectsPerRow[i] || allSubjects)" [value]="s.name">
                        <div class="subject-option-row">
                          <mat-icon class="sub-icon">menu_book</mat-icon>
                          <span>{{ s.name }}</span>
                          <span class="sub-code" *ngIf="s.code">{{ s.code }}</span>
                        </div>
                      </mat-option>
                      <mat-option disabled *ngIf="(filteredSubjectsPerRow[i] || allSubjects).length === 0" class="no-subjects-option">
                        <span class="no-subjects-text">No matching subjects</span>
                      </mat-option>
                    </mat-select>
                    <mat-error *ngIf="row.get('subject')?.invalid">Required</mat-error>
                  </mat-form-field>
                </div>

                <!-- Title -->
                <div class="cell-title">
                  <mat-form-field appearance="outline" class="field-compact" subscriptSizing="dynamic">
                    <input matInput formControlName="title" placeholder="e.g. Unit Test 3 - Electricity">
                    <mat-error *ngIf="row.get('title')?.invalid">Required</mat-error>
                  </mat-form-field>
                </div>

                <!-- Date -->
                <div class="cell-date">
                  <mat-form-field appearance="outline" class="field-compact" subscriptSizing="dynamic">
                    <input matInput formControlName="examDate" type="date">
                    <mat-error *ngIf="row.get('examDate')?.invalid">Required</mat-error>
                  </mat-form-field>
                </div>

                <!-- Time -->
                <div class="cell-time">
                  <mat-form-field appearance="outline" class="field-compact" subscriptSizing="dynamic">
                    <input matInput formControlName="examTime" type="time">
                  </mat-form-field>
                </div>

                <!-- Max Marks -->
                <div class="cell-marks">
                  <mat-form-field appearance="outline" class="field-compact" subscriptSizing="dynamic">
                    <input matInput formControlName="maxMarks" type="number" min="1" placeholder="50">
                    <mat-error *ngIf="row.get('maxMarks')?.invalid">Min 1</mat-error>
                  </mat-form-field>
                </div>

                <!-- Delete -->
                <div class="cell-del">
                  <button mat-icon-button color="warn" (click)="removeRow(i)"
                          [disabled]="examRows.length === 1" matTooltip="Remove row">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>

              </div>
            </ng-container>
          </div>

          <!-- Planner Footer -->
          <div class="planner-footer">
            <button mat-stroked-button color="primary" (click)="addRow()" [disabled]="examRows.length >= 20">
              <mat-icon>add</mat-icon>
              Add Another Exam Row
              <span *ngIf="examRows.length >= 20" style="font-size:0.75rem;margin-left:4px">(max 20)</span>
            </button>
            <div class="planner-actions">
              <button mat-button (click)="toggleBulkPlanner()" [disabled]="saving">Cancel</button>
              <button mat-raised-button color="primary" (click)="saveBulkPlanner()" [disabled]="saving">
                <mat-icon>{{ saving ? 'hourglass_empty' : 'rocket_launch' }}</mat-icon>
                {{ saving ? 'Scheduling...' : 'Schedule All ' + examRows.length + ' Exam' + (examRows.length !== 1 ? 's' : '') }}
              </button>
            </div>
          </div>

        </mat-card-content>
      </mat-card>

      <!-- ════════════════════════════════════════ -->
      <!-- PURE ANGULAR MATERIAL MARKS ENTRY PANEL  -->
      <!-- ════════════════════════════════════════ -->
      <mat-card *ngIf="selectedTest" class="marks-card mat-elevation-z4 no-print">
        <mat-card-header class="marks-card-header">
          <div class="marks-header-content">
            <div class="marks-title-row">
              <div class="marks-title-left">
                <mat-icon class="marks-header-icon">assignment_turned_in</mat-icon>
                <div class="marks-heading-wrap">
                  <span class="marks-badge-tag">EXAM EVALUATION</span>
                  <h3 class="marks-main-title">
                    {{ selectedTest.isMarksLocked ? 'Official Marks:' : (selectedTest.evaluationStatus === 'SubmittedForApproval' ? 'Review Evaluated Marks:' : 'Enter Marks:') }}
                    <strong>{{ selectedTest.title }}</strong>
                  </h3>
                </div>
              </div>
              <div class="marks-header-right">
                <button *ngIf="canViewResults(selectedTest)" mat-stroked-button class="result-btn" (click)="openResults(selectedTest)" matTooltip="View Leaderboard &amp; Student Result Cards">
                  <mat-icon>emoji_events</mat-icon> Results &amp; Cards
                </button>
                <button mat-icon-button color="warn" class="close-btn" (click)="selectedTest = null" matTooltip="Close Marks Entry">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>

            <!-- Material Chips for Exam Metadata -->
            <div class="marks-chips-bar">
              <mat-chip-set aria-label="Test Details">
                <mat-chip class="custom-chip chip-subject">
                  <mat-icon matChipAvatar>menu_book</mat-icon>
                  {{ selectedTest.subject }}
                </mat-chip>
                <mat-chip class="custom-chip chip-batch" *ngIf="selectedTest.className">
                  <mat-icon matChipAvatar>school</mat-icon>
                  Class: <strong>{{ selectedTest.className }} {{ selectedTest.sectionName ? '(' + selectedTest.sectionName + ')' : '' }}</strong>
                </mat-chip>
                <mat-chip class="custom-chip chip-batch" *ngIf="!selectedTest.className && selectedTest.batchName">
                  <mat-icon matChipAvatar>groups</mat-icon>
                  {{ selectedTest.batchName }}
                </mat-chip>
                <mat-chip class="custom-chip chip-marks">
                  <mat-icon matChipAvatar>military_tech</mat-icon>
                  Max Marks: <strong>{{ selectedTest.maxMarks }}</strong>
                </mat-chip>
                <mat-chip class="custom-chip chip-date" *ngIf="selectedTest.testDate">
                  <mat-icon matChipAvatar>schedule</mat-icon>
                  <span [appIstDatetime]="selectedTest.testDate" format="datetime"></span>
                </mat-chip>
                <mat-chip class="custom-chip" *ngIf="selectedTest.evaluatorTeacherName">
                  <mat-icon matChipAvatar>person</mat-icon>
                  Evaluator: <strong>{{ selectedTest.evaluatorTeacherName }}</strong>
                </mat-chip>
                <mat-chip class="custom-chip" [ngClass]="getWorkflowStatusInfo(selectedTest).class">
                  <mat-icon matChipAvatar>{{ getWorkflowStatusInfo(selectedTest).icon }}</mat-icon>
                  {{ getWorkflowStatusInfo(selectedTest).label }}
                </mat-chip>
              </mat-chip-set>
            </div>
          </div>
        </mat-card-header>

        <!-- Locked Banner -->
        <div class="test-lock-alert" *ngIf="selectedTest.isMarksLocked">
          <div class="lock-alert-content">
            <mat-icon class="lock-icon">lock</mat-icon>
            <div>
              <span class="lock-title">Marks Officially Approved &amp; Locked</span>
              <span class="lock-desc">
                Approved by <strong>{{ selectedTest.marksLockedBy || 'Principal' }}</strong>
                on <span [appIstDatetime]="selectedTest.marksLockedAt" format="datetime"></span>.
                Marks edits are frozen.
                <span *ngIf="selectedTest.evaluationRemarks"> Note: "{{ selectedTest.evaluationRemarks }}"</span>
              </span>
            </div>
          </div>
          <button *ngIf="isUserAdmin" mat-stroked-button color="warn" class="unlock-btn" (click)="unlockMarks(selectedTest)">
            <mat-icon>lock_open</mat-icon> Unlock Marks (Admin Override)
          </button>
        </div>

        <!-- Revision Requested Banner -->
        <div class="revision-alert" *ngIf="!selectedTest.isMarksLocked && (selectedTest.evaluationStatus === 'RevisionRequested' || selectedTest.evaluationStatus === 'NeedsRevision')">
          <mat-icon>warning</mat-icon>
          <div>
            <span class="revision-title">Revision Requested by Principal / Administrator</span>
            <span class="revision-desc">{{ selectedTest.evaluationRemarks || 'Please review entered marks and re-submit for approval.' }}</span>
          </div>
        </div>

        <mat-divider></mat-divider>

        <mat-progress-bar mode="indeterminate" *ngIf="marksLoading" class="marks-loader"></mat-progress-bar>

        <mat-card-content class="marks-card-content">

          <!-- Desktop / Laptop / Tablet: Pure Angular Material Table -->
          <div class="desktop-marks-container" *ngIf="!marksLoading">
            <table mat-table [dataSource]="marksGrid" class="full-width marks-mat-table">

              <!-- # / Rank Column -->
              <ng-container matColumnDef="index">
                <th mat-header-cell *matHeaderCellDef class="col-index">#</th>
                <td mat-cell *matCellDef="let item; let i = index" class="col-index">
                  <span class="rank-circle">{{ i + 1 }}</span>
                </td>
              </ng-container>

              <!-- Roll Number Column -->
              <ng-container matColumnDef="rollNumber">
                <th mat-header-cell *matHeaderCellDef class="col-roll">Roll No</th>
                <td mat-cell *matCellDef="let item" class="col-roll">
                  <span class="roll-pill">{{ item.rollNumber || 'N/A' }}</span>
                </td>
              </ng-container>

              <!-- Student Name Column -->
              <ng-container matColumnDef="studentName">
                <th mat-header-cell *matHeaderCellDef class="col-name">Student Name</th>
                <td mat-cell *matCellDef="let item" class="col-name">
                  <div class="student-info-cell">
                    <span class="student-avatar-letter">{{ item.studentName ? item.studentName.charAt(0) : 'S' }}</span>
                    <strong class="student-display-name">{{ item.studentName }}</strong>
                  </div>
                </td>
              </ng-container>

              <!-- Marks Obtained Column -->
              <ng-container matColumnDef="marksObtained">
                <th mat-header-cell *matHeaderCellDef class="col-marks">
                  Marks (Max: {{ selectedTest.maxMarks }})
                </th>
                <td mat-cell *matCellDef="let item" class="col-marks">
                  <div class="marks-input-cell">
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="marks-mat-field">
                      <input matInput type="number" [(ngModel)]="item.marksObtained"
                             [disabled]="item.isAbsent || selectedTest.isMarksLocked"
                             [max]="selectedTest.maxMarks" min="0"
                             placeholder="0"
                             class="marks-input-left"
                             [class.over-limit]="!item.isAbsent && item.marksObtained > selectedTest.maxMarks">
                      <span matSuffix class="marks-suffix-tag">/&nbsp;{{ selectedTest.maxMarks }}</span>
                    </mat-form-field>
                    <span class="over-limit-hint" *ngIf="!item.isAbsent && item.marksObtained > selectedTest.maxMarks">
                      Exceeds max
                    </span>
                  </div>
                </td>
              </ng-container>

              <!-- Absent Checkbox Column -->
              <ng-container matColumnDef="isAbsent">
                <th mat-header-cell *matHeaderCellDef class="col-absent text-center">Absent?</th>
                <td mat-cell *matCellDef="let item" class="col-absent text-center">
                  <mat-checkbox [(ngModel)]="item.isAbsent" [disabled]="selectedTest.isMarksLocked" color="warn" (change)="onAbsentToggle(item)">
                    <span class="absent-flag" *ngIf="item.isAbsent">ABSENT</span>
                  </mat-checkbox>
                </td>
              </ng-container>

              <!-- Remarks Column -->
              <ng-container matColumnDef="remarks">
                <th mat-header-cell *matHeaderCellDef class="col-remarks text-center">Remarks</th>
                <td mat-cell *matCellDef="let item" class="col-remarks">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="remarks-mat-field">
                    <input matInput [(ngModel)]="item.remarks" [disabled]="selectedTest.isMarksLocked" placeholder="Optional comments..." class="remarks-input-left">
                    <mat-icon matSuffix class="remarks-icon">edit_note</mat-icon>
                  </mat-form-field>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="marksColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: marksColumns;"
                  class="student-mark-row"
                  [class.student-absent-row]="row.isAbsent"></tr>

              <tr class="mat-row" *matNoDataRow>
                <td class="mat-cell empty-cell" [attr.colspan]="marksColumns.length">
                  <div class="empty-state">
                    <mat-icon class="empty-icon">person_off</mat-icon>
                    <p>No students enrolled in this batch.</p>
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <!-- Mobile (<600px): Responsive Material Card View per student -->
          <div class="mobile-marks-cards" *ngIf="!marksLoading">
            <div *ngFor="let item of marksGrid; let i = index"
                 class="student-card-item"
                 [class.student-card-absent]="item.isAbsent">

              <!-- Card Header -->
              <div class="student-card-top">
                <div class="student-card-profile">
                  <span class="rank-circle-small">{{ i + 1 }}</span>
                  <span class="student-avatar-letter-small">{{ item.studentName ? item.studentName.charAt(0) : 'S' }}</span>
                  <div class="student-card-titles">
                    <span class="student-card-name">{{ item.studentName }}</span>
                    <span class="roll-pill-small">{{ item.rollNumber || 'No Roll' }}</span>
                  </div>
                </div>
                <mat-checkbox [(ngModel)]="item.isAbsent" [disabled]="selectedTest.isMarksLocked" color="warn" (change)="onAbsentToggle(item)">
                  <span class="absent-flag" *ngIf="item.isAbsent">ABSENT</span>
                  <span class="absent-hint" *ngIf="!item.isAbsent">Mark Absent</span>
                </mat-checkbox>
              </div>

              <!-- Card Inputs -->
              <div class="student-card-inputs">
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mobile-marks-field">
                  <mat-label>Marks Obtained</mat-label>
                  <input matInput type="number" [(ngModel)]="item.marksObtained"
                         [disabled]="item.isAbsent || selectedTest.isMarksLocked"
                         [max]="selectedTest.maxMarks" min="0" placeholder="0"
                         [class.over-limit]="!item.isAbsent && item.marksObtained > selectedTest.maxMarks">
                  <span matSuffix class="marks-suffix-tag">/ {{ selectedTest.maxMarks }}</span>
                </mat-form-field>

                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mobile-remarks-field">
                  <mat-label>Remarks (Optional)</mat-label>
                  <input matInput [(ngModel)]="item.remarks" [disabled]="selectedTest.isMarksLocked" placeholder="Optional comments...">
                </mat-form-field>
              </div>
            </div>

            <div class="empty-state" *ngIf="marksGrid.length === 0">
              <mat-icon class="empty-icon">person_off</mat-icon>
              <p>No students enrolled in this batch.</p>
            </div>
          </div>

          <!-- Bottom Action Bar -->
          <div class="marks-footer">
            <div class="whatsapp-dispatch-box" *ngIf="!selectedTest.isMarksLocked">
              <mat-checkbox [(ngModel)]="notifyParents" color="primary">
                <div class="whatsapp-label">
                  <span class="whatsapp-icon-circle">
                    <mat-icon>chat</mat-icon>
                  </span>
                  <div>
                    <span class="whatsapp-title">Send WhatsApp Report Cards to Parents</span>
                    <span class="whatsapp-sub">Instant automated scorecard dispatch via WhatsApp Gateway</span>
                  </div>
                </div>
              </mat-checkbox>
            </div>

            <div class="marks-submit-actions">
              <button mat-stroked-button (click)="selectedTest = null">Cancel / Back</button>

              <!-- TEACHER ACTIONS (For Faculty/Teachers submitting marks) -->
              <button *ngIf="!selectedTest.isMarksLocked && !isUserAdmin" mat-stroked-button color="primary" class="draft-marks-btn" (click)="saveMarks(false)" [disabled]="savingMarks || approvingMarks">
                <mat-progress-spinner *ngIf="savingMarks" diameter="16" mode="indeterminate" class="btn-spinner"></mat-progress-spinner>
                <mat-icon *ngIf="!savingMarks">save</mat-icon>
                {{ savingMarks ? 'Saving...' : 'Save Draft' }}
              </button>

              <button *ngIf="!selectedTest.isMarksLocked && !isUserAdmin" mat-raised-button color="primary" class="save-marks-btn" (click)="saveMarks(true)" [disabled]="savingMarks || approvingMarks">
                <mat-progress-spinner *ngIf="savingMarks" diameter="16" mode="indeterminate" class="btn-spinner"></mat-progress-spinner>
                <mat-icon *ngIf="!savingMarks">send</mat-icon>
                {{ savingMarks ? 'Submitting...' : 'Save & Submit to Principal' }}
              </button>

              <!-- ADMIN / PRINCIPAL ACTIONS (For Admin reviewing & moderating marks) -->
              <button *ngIf="isUserAdmin && !selectedTest.isMarksLocked" mat-stroked-button color="primary" class="draft-marks-btn" (click)="saveMarks(false)" [disabled]="savingMarks || approvingMarks" matTooltip="Save any moderation corrections before approving">
                <mat-progress-spinner *ngIf="savingMarks" diameter="16" mode="indeterminate" class="btn-spinner"></mat-progress-spinner>
                <mat-icon *ngIf="!savingMarks">save</mat-icon>
                {{ savingMarks ? 'Saving...' : 'Save Corrections' }}
              </button>

              <button *ngIf="isUserAdmin && !selectedTest.isMarksLocked && (selectedTest.evaluationStatus === 'SubmittedForApproval' || selectedTest.evaluationStatus === 'MarksEntered')"
                      mat-stroked-button color="warn" (click)="rejectForRevisionDirect(selectedTest)" [disabled]="savingMarks || approvingMarks" matTooltip="Send back to teacher with notes for re-checking">
                <mat-icon>replay</mat-icon> Send Back for Revision
              </button>

              <button *ngIf="isUserAdmin && !selectedTest.isMarksLocked"
                      mat-raised-button color="accent" class="approve-marks-direct-btn" (click)="openApprovalModal(selectedTest)" [disabled]="savingMarks || approvingMarks" matTooltip="Review summary & officially approve and freeze marks">
                <mat-progress-spinner *ngIf="approvingMarks" diameter="16" mode="indeterminate" class="btn-spinner"></mat-progress-spinner>
                <mat-icon *ngIf="!approvingMarks">verified</mat-icon>
                {{ approvingMarks ? 'Locking...' : 'Principal Approve & Lock' }}
              </button>

              <button *ngIf="isUserAdmin && selectedTest.isMarksLocked" mat-stroked-button color="warn" (click)="unlockMarks(selectedTest)">
                <mat-icon>lock_open</mat-icon> Unlock Marks
              </button>
            </div>
          </div>

        </mat-card-content>
      </mat-card>

      <!-- ════════════════════════════════════════ -->
      <!-- TESTS GRID (MAIN LIST)                   -->
      <!-- ════════════════════════════════════════ -->
      <mat-card *ngIf="!selectedTest && !showBulkPlanner" class="table-card mat-elevation-z2">

        <!-- Search and Filter Bar -->
        <div class="filter-toolbar no-print">
          <!-- Hybrid Module Category Tabs (Only if institute has both School & Coaching) -->
          <div class="category-tabs-bar" *ngIf="isHybridInstitute">
            <button type="button" class="cat-tab-btn" [class.active]="selectedCategory === 'all'" (click)="setCategoryFilter('all')">
              <mat-icon>grid_view</mat-icon> All Exams
            </button>
            <button type="button" class="cat-tab-btn" [class.active]="selectedCategory === 'school'" (click)="setCategoryFilter('school')">
              <mat-icon>school</mat-icon> School Classes
            </button>
            <button type="button" class="cat-tab-btn" [class.active]="selectedCategory === 'coaching'" (click)="setCategoryFilter('coaching')">
              <mat-icon>groups</mat-icon> Coaching Batches
            </button>
          </div>

          <div class="filters-input-row">
            <mat-form-field appearance="outline" class="search-field" subscriptSizing="dynamic">
              <mat-label>Search Tests / Subject / Title...</mat-label>
              <input matInput [(ngModel)]="searchTerm" (keyup.enter)="onSearch()" />
              <mat-icon matPrefix>search</mat-icon>
              <button mat-icon-button matSuffix (click)="onSearch()" matTooltip="Search">
                <mat-icon>arrow_forward</mat-icon>
              </button>
            </mat-form-field>

            <!-- School Class & Section Filters (Visible when category is 'all' or 'school', AND hasSchool) -->
            <ng-container *ngIf="hasSchool && (selectedCategory === 'school' || selectedCategory === 'all')">
              <mat-form-field appearance="outline" class="filter-dropdown" subscriptSizing="dynamic">
                <mat-label>Filter by School Class</mat-label>
                <mat-select [(ngModel)]="selectedClassFilter" (selectionChange)="onClassFilterChange()">
                  <mat-option value="">All Classes</mat-option>
                  <mat-option *ngFor="let c of schoolClasses" [value]="c.id">{{ c.name }}</mat-option>
                </mat-select>
                <mat-icon matSuffix>school</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline" class="filter-dropdown section-filter" subscriptSizing="dynamic" *ngIf="selectedClassFilter && sectionsForFilterClass.length > 0">
                <mat-label>Section</mat-label>
                <mat-select [(ngModel)]="selectedSectionFilter" (selectionChange)="onFilterChange()">
                  <mat-option value="">All Sections</mat-option>
                  <mat-option *ngFor="let s of sectionsForFilterClass" [value]="s.id">{{ s.name }}</mat-option>
                </mat-select>
                <mat-icon matSuffix>meeting_room</mat-icon>
              </mat-form-field>
            </ng-container>

            <!-- Coaching Batch Filter (Visible when category is 'all' or 'coaching', AND hasCoaching) -->
            <mat-form-field appearance="outline" class="filter-dropdown batch-filter" subscriptSizing="dynamic" *ngIf="hasCoaching && (selectedCategory === 'coaching' || selectedCategory === 'all')">
              <mat-label>Filter by Coaching Batch</mat-label>
              <mat-select [(ngModel)]="selectedBatchFilter" (selectionChange)="onFilterChange()">
                <mat-option value="">All Batches</mat-option>
                <mat-option *ngFor="let b of batches" [value]="b.id">{{ b.name }}</mat-option>
              </mat-select>
              <mat-icon matSuffix>filter_list</mat-icon>
            </mat-form-field>
          </div>
        </div>

        <mat-card-content class="table-container">
          <div class="responsive-table-wrap">
            <table mat-table [dataSource]="tests" matSort (matSortChange)="onSortChange($event)" class="full-width">

              <!-- Title Column -->
              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef mat-sort-header="title">Test Title &amp; Status</th>
                <td mat-cell *matCellDef="let t">
                  <div class="test-title-cell">
                    <div class="title-and-badge">
                      <strong class="title-heading">{{ t.title }}</strong>
                      <span class="workflow-status-badge" [ngClass]="getWorkflowStatusInfo(t).class">
                        <mat-icon>{{ getWorkflowStatusInfo(t).icon }}</mat-icon>
                        {{ getWorkflowStatusInfo(t).label }}
                      </span>
                    </div>
                    <div class="test-meta-sub">
                      <span class="evaluator-sub" *ngIf="t.evaluatorTeacherName">
                        <mat-icon>person</mat-icon> Evaluator: <strong>{{ t.evaluatorTeacherName }}</strong>
                        <span *ngIf="t.totalCopiesIssued">({{ t.totalCopiesIssued }} copies)</span>
                      </span>
                      <span class="my-bundle-chip" *ngIf="!isUserAdmin && isMyBundle(t)">
                        <mat-icon>assignment_ind</mat-icon> Assigned to You
                      </span>
                      <span class="marks-count" *ngIf="t.totalStudentsEvaluated > 0">
                        <mat-icon>people</mat-icon> {{ t.totalStudentsEvaluated }} evaluated
                      </span>
                      <span class="marks-count pending-count" *ngIf="!t.totalStudentsEvaluated && t.evaluationStatus !== 'Evaluating'">
                        <mat-icon>pending_actions</mat-icon> Pending evaluation
                      </span>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- Target Group (Class / Batch) Column -->
              <ng-container matColumnDef="batchName">
                <th mat-header-cell *matHeaderCellDef mat-sort-header="batchName">
                  {{ isHybridInstitute ? 'Class / Batch' : (hasSchool ? 'Class & Section' : 'Coaching Batch') }}
                </th>
                <td mat-cell *matCellDef="let t">
                  <!-- School Class Tag -->
                  <span class="school-class-tag" *ngIf="t.className">
                    <mat-icon class="group-icon">school</mat-icon>
                    <strong>{{ t.className }}</strong>
                    <span class="sec-badge" *ngIf="t.sectionName">({{ t.sectionName }})</span>
                  </span>

                  <!-- Coaching Batch Tag -->
                  <span class="batch-name-tag" *ngIf="!t.className && t.batchName && t.batchName !== 'General'">
                    <mat-icon class="group-icon">groups</mat-icon>
                    <span>{{ t.batchName }}</span>
                  </span>

                  <!-- General Tag if neither -->
                  <span class="general-tag" *ngIf="!t.className && (!t.batchName || t.batchName === 'General')">
                    General
                  </span>
                </td>
              </ng-container>

              <!-- Subject Column -->
              <ng-container matColumnDef="subject">
                <th mat-header-cell *matHeaderCellDef mat-sort-header="subject">Subject</th>
                <td mat-cell *matCellDef="let t">
                  <span class="subject-tag">{{ t.subject }}</span>
                </td>
              </ng-container>

              <!-- Max Marks Column -->
              <ng-container matColumnDef="maxMarks">
                <th mat-header-cell *matHeaderCellDef mat-sort-header="maxMarks" class="text-center">Max Marks</th>
                <td mat-cell *matCellDef="let t" class="text-center">
                  <span class="max-marks-badge">{{ t.maxMarks }}</span>
                </td>
              </ng-container>

              <!-- Exam Date & Time Column -->
              <ng-container matColumnDef="testDate">
                <th mat-header-cell *matHeaderCellDef mat-sort-header="testDate">Exam Date</th>
                <td mat-cell *matCellDef="let t">
                  <div class="date-cell">
                    <span class="date-text" [appIstDatetime]="t.testDate" format="date"></span>
                    <span class="time-badge" [appIstDatetime]="t.testDate" format="time"></span>
                  </div>
                </td>
              </ng-container>

              <!-- Actions Column -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="text-right no-print">Actions</th>
                <td mat-cell *matCellDef="let t" class="text-right no-print">
                  <div class="action-buttons no-print">
                    <!-- Admin Only: Bundle Handover / Tracking -->
                    <button *ngIf="isUserAdmin && !t.isMarksLocked" mat-stroked-button class="bundle-btn" (click)="openBundleModal(t)" matTooltip="Assign / Track Physical Copy Bundle Handover">
                      <mat-icon>inventory_2</mat-icon> {{ t.evaluatorTeacherId ? 'Bundle' : 'Assign Bundle' }}
                    </button>

                    <!-- Marking Foil / Award Sheet: Admin OR Assigned Teacher (Only before exam is officially locked) -->
                    <button *ngIf="(isUserAdmin || isMyBundle(t)) && !t.isMarksLocked" mat-stroked-button class="foil-btn" (click)="openAwardSheetModal(t)" matTooltip="Print Blank Award Sheet (Marking Foil)">
                      <mat-icon>receipt_long</mat-icon> Foil
                    </button>


                    <!-- Enter / Review / View Marks Button (If permitted) -->
                    <button *ngIf="canEnterMarks(t)" mat-raised-button color="primary" (click)="openMarksGrid(t)"
                            class="enter-marks-btn"
                            [matTooltip]="t.isMarksLocked ? 'View Officially Locked Marks' : (t.evaluationStatus === 'SubmittedForApproval' ? 'Review & Verify Evaluated Marks' : 'Enter / Update Marks')">
                      <mat-icon>{{ t.isMarksLocked ? 'lock' : (t.evaluationStatus === 'SubmittedForApproval' ? 'rate_review' : 'edit_note') }}</mat-icon>
                      {{ t.isMarksLocked ? 'Marks 🔒' : (t.evaluationStatus === 'SubmittedForApproval' ? 'Review Marks' : 'Enter Marks') }}
                    </button>

                    <!-- If Teacher but bundle is not assigned yet and exam is not locked -->
                    <button *ngIf="!isUserAdmin && !canEnterMarks(t) && !t.isMarksLocked" mat-stroked-button class="enter-marks-disabled-btn" disabled
                            [matTooltip]="!t.evaluatorTeacherId ? 'Bundle not yet assigned by Admin / Exam Cell' : 'Bundle assigned to ' + (t.evaluatorTeacherName || 'another evaluator')">
                      <mat-icon>lock</mat-icon> Enter Marks
                    </button>

                    <!-- Quick Unlock for Admin if locked -->
                    <button *ngIf="isUserAdmin && t.isMarksLocked" mat-icon-button color="warn" (click)="unlockMarks(t)" matTooltip="Unlock Marks (Admin Override)">
                      <mat-icon>lock_open</mat-icon>
                    </button>

                    <!-- Results Button: Only visible once enter marks is officially locked & approved -->
                    <button *ngIf="canViewResults(t)" mat-stroked-button class="result-btn" (click)="openResults(t)" matTooltip="View Leaderboard &amp; Student Result Cards">
                      <mat-icon>emoji_events</mat-icon> Results
                    </button>

                    <!-- Admin Only Actions: Admit Cards and Delete (Hidden when exam results are officially locked) -->
                    <button *ngIf="isUserAdmin && !t.isMarksLocked" mat-stroked-button class="admit-card-btn" (click)="openAdmitCards(t)" matTooltip="Generate &amp; Print Admit Cards / Hall Tickets">
                      <mat-icon>confirmation_number</mat-icon>
                    </button>
                    <button *ngIf="isUserAdmin && !t.isMarksLocked" mat-icon-button color="warn" (click)="deleteTest(t)" matTooltip="Delete Test">
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
              <tr class="mat-row" *matNoDataRow>
                <td class="mat-cell empty-cell" [attr.colspan]="displayedColumns.length">
                  <div class="empty-state" *ngIf="!loading">
                    <mat-icon class="empty-icon">quiz</mat-icon>
                    <p>No tests found. Click <strong>Schedule Exam Session</strong> to get started.</p>
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </mat-card-content>

        <mat-paginator [length]="totalCount" [pageSize]="pageSize" [pageSizeOptions]="[5,10,20,50]"
                       [pageIndex]="pageIndex" (page)="onPageChange($event)" showFirstLastButtons
                       class="no-print">
        </mat-paginator>

        <!-- Printable Footer with Signatures (Only visible on print) -->
        <div class="print-schedule-footer print-only">
          <div class="print-sig-col">
            <div class="sig-line">Exam Coordinator</div>
          </div>
          <div class="print-sig-col">
            <div class="sig-line">Academic Head</div>
          </div>
          <div class="print-sig-col">
            <div class="sig-line">Principal / Director</div>
          </div>
        </div>
      </mat-card>

      <!-- ════════════════════════════════════════ -->
      <!-- MODAL 1: COPY BUNDLE HANDOVER TRACKING   -->
      <!-- ════════════════════════════════════════ -->
      <div class="custom-modal-backdrop no-print" *ngIf="showBundleModal" (click)="closeBundleModal()">
        <div class="custom-modal-dialog" (click)="$event.stopPropagation()">
          <!-- Consistent Light Blue Gradient Header -->
          <div class="modal-dialog-header">
            <div class="modal-icon-box">
              <mat-icon>inventory_2</mat-icon>
            </div>
            <div class="modal-title-wrap">
              <h3>Assign Copy Bundle to Evaluator Teacher</h3>
              <p>Physical paper bundles handover &amp; checking tracking for <strong>{{ bundleTest?.title }}</strong></p>
            </div>
            <button mat-icon-button class="modal-close-btn" (click)="closeBundleModal()" matTooltip="Close">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <!-- Modal Body -->
          <div class="modal-dialog-body" [formGroup]="bundleForm">
            <div class="workflow-info-banner">
              <mat-icon>info</mat-icon>
              <div>
                <strong>Evaluation Workflow:</strong> Exam Coordinator hands over physical answer sheets to the designated teacher. Upon completion, teacher inputs marks and submits for Principal approval.
              </div>
            </div>

            <!-- Exam Details Specification Card -->
            <div class="exam-spec-card" *ngIf="bundleTest">
              <div class="exam-spec-header">
                <div class="spec-title-group">
                  <span class="spec-exam-type">{{ bundleTest.className ? 'SCHOOL EXAMINATION' : 'COACHING TEST' }}</span>
                  <h4 class="spec-title">{{ bundleTest.title }}</h4>
                </div>
                <span class="spec-marks-badge">Max Marks: {{ bundleTest.maxMarks }}</span>
              </div>
              <div class="exam-spec-grid">
                <div class="spec-item">
                  <mat-icon>school</mat-icon>
                  <div>
                    <label>{{ bundleTest.className ? 'Target Class / Section' : 'Coaching Batch' }}</label>
                    <strong>
                      {{ bundleTest.className ? bundleTest.className + (bundleTest.sectionName ? ' (' + bundleTest.sectionName + ')' : '') : (bundleTest.batchName || 'General') }}
                    </strong>
                  </div>
                </div>
                <div class="spec-item">
                  <mat-icon>menu_book</mat-icon>
                  <div>
                    <label>Subject</label>
                    <strong>{{ bundleTest.subject || 'N/A' }}</strong>
                  </div>
                </div>
                <div class="spec-item">
                  <mat-icon>event</mat-icon>
                  <div>
                    <label>Exam Date &amp; Time (IST)</label>
                    <strong>
                      <span [appIstDatetime]="bundleTest.testDate" format="date"></span>
                      <span *ngIf="bundleTest.testTime"> ({{ bundleTest.testTime }})</span>
                    </strong>
                  </div>
                </div>
                <div class="spec-item">
                  <mat-icon>assignment_ind</mat-icon>
                  <div>
                    <label>Current Assigned Faculty</label>
                    <strong [class.unassigned-text]="!bundleTest.evaluatorTeacherName && !bundleForm.get('evaluatorTeacherId')?.value">
                      {{ bundleTest.evaluatorTeacherName || (getSelectedTeacherName(bundleForm.get('evaluatorTeacherId')?.value) ? getSelectedTeacherName(bundleForm.get('evaluatorTeacherId')?.value) + ' (Suggested)' : 'Not Assigned Yet') }}
                      <span *ngIf="bundleTest.evaluatorTeacherPhone || getSelectedTeacherPhone(bundleForm.get('evaluatorTeacherId')?.value)" class="spec-sub-phone">
                        ({{ bundleTest.evaluatorTeacherPhone || getSelectedTeacherPhone(bundleForm.get('evaluatorTeacherId')?.value) }})
                      </span>
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div class="modal-form-grid">
              <mat-form-field appearance="outline" class="full-col">
                <mat-label>Evaluator / Checking Teacher *</mat-label>
                <mat-select formControlName="evaluatorTeacherId" placeholder="Select Subject Teacher"
                            panelClass="smart-teacher-panel"
                            (openedChange)="onTeacherSelectOpened($event)">
                  <mat-select-trigger>
                    <div class="selected-teacher-trigger" *ngIf="bundleForm.get('evaluatorTeacherId')?.value">
                      <mat-icon class="trigger-icon">person</mat-icon>
                      <span class="trigger-name">{{ getSelectedTeacherName(bundleForm.get('evaluatorTeacherId')?.value) }}</span>
                      <span class="trigger-badge" *ngIf="getSelectedTeacherCode(bundleForm.get('evaluatorTeacherId')?.value)">
                        {{ getSelectedTeacherCode(bundleForm.get('evaluatorTeacherId')?.value) }}
                      </span>
                      <span class="trigger-phone" *ngIf="getSelectedTeacherPhone(bundleForm.get('evaluatorTeacherId')?.value)">
                        • {{ getSelectedTeacherPhone(bundleForm.get('evaluatorTeacherId')?.value) }}
                      </span>
                    </div>
                  </mat-select-trigger>

                  <!-- Sticky Search Option Inside Dropdown Panel -->
                  <mat-option disabled class="select-search-option">
                    <div class="select-search-wrap" (click)="$event.stopPropagation()" (mousedown)="$event.stopPropagation()">
                      <mat-icon class="search-box-icon">search</mat-icon>
                      <input class="select-search-input teacher-search-box"
                             placeholder="Search teacher by name, code, phone, subject..."
                             [value]="teacherSearchText || ''"
                             (input)="filterTeachers($event)"
                             (click)="$event.stopPropagation()"
                             (mousedown)="$event.stopPropagation()"
                             (keydown)="$event.stopPropagation()"
                             (keyup)="$event.stopPropagation()">
                      <button mat-icon-button type="button" class="clear-search-btn" *ngIf="teacherSearchText"
                              (click)="clearTeacherSearch($event)" (mousedown)="$event.stopPropagation()">
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>
                  </mat-option>

                  <!-- Filtered Teachers Options -->
                  <mat-option *ngFor="let tch of filteredTeachers" [value]="tch.id" class="teacher-select-option">
                    <div class="teacher-option-row">
                      <div class="tch-avatar">
                        {{ (tch.fullName || tch.name || 'T').charAt(0).toUpperCase() }}
                      </div>
                      <div class="tch-details">
                        <div class="tch-title-line">
                          <strong class="tch-name">{{ tch.fullName || tch.name }}</strong>
                          <span class="tch-code-badge" *ngIf="tch.employeeCode">{{ tch.employeeCode }}</span>
                          <span class="tch-desig" *ngIf="tch.designation">{{ tch.designation }}</span>
                        </div>
                        <div class="tch-meta-line">
                          <span class="tch-phone" *ngIf="tch.phoneNumber">
                            <mat-icon>phone</mat-icon> {{ tch.phoneNumber }}
                          </span>
                          <span class="tch-spec" *ngIf="tch.specialization">
                            <mat-icon>school</mat-icon> {{ tch.specialization }}
                          </span>
                          <span class="tch-dept" *ngIf="tch.department && !tch.specialization">
                            <mat-icon>business</mat-icon> {{ tch.department }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </mat-option>

                  <mat-option disabled *ngIf="filteredTeachers.length === 0" class="no-subjects-option">
                    <span class="no-subjects-text">No faculty found matching "{{ teacherSearchText }}"</span>
                  </mat-option>
                </mat-select>
                <mat-icon matPrefix>person</mat-icon>
                <mat-hint>
                  <span *ngIf="autoSuggestReason && !bundleTest?.evaluatorTeacherId" class="auto-fill-hint-pill">
                    <mat-icon>auto_awesome</mat-icon> Auto-filled: <strong>{{ autoSuggestReason }}</strong>
                  </span>
                  <span *ngIf="!autoSuggestReason || bundleTest?.evaluatorTeacherId">
                    Choose the faculty member responsible for physical paper checking &amp; marks entry.
                  </span>
                </mat-hint>
                <mat-error *ngIf="bundleForm.get('evaluatorTeacherId')?.invalid">Please select an evaluator teacher.</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Total Copies Issued in Bundle</mat-label>
                <input matInput type="number" formControlName="totalCopiesIssued" min="1" placeholder="e.g. 45">
                <mat-icon matPrefix>layers</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Evaluation Due Date</mat-label>
                <input matInput type="date" formControlName="evaluationDueDate">
                <mat-icon matPrefix>event</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Bundle Status</mat-label>
                <mat-select formControlName="evaluationStatus">
                  <mat-option value="Scheduled">Scheduled (Not yet handed over)</mat-option>
                  <mat-option value="Evaluating">Evaluating (Copies Handed to Teacher)</mat-option>
                  <mat-option value="CopiesReturned">Copies Returned by Teacher</mat-option>
                </mat-select>
                <mat-icon matPrefix>flag</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Copies Returned Date (If Returned)</mat-label>
                <input matInput type="date" formControlName="copiesSubmittedDate">
                <mat-icon matPrefix>done_all</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-col">
                <mat-label>Handover Instructions / Remarks</mat-label>
                <textarea matInput rows="2" formControlName="evaluationRemarks" placeholder="e.g. Ensure strict marking on Section B, return with award foil by Friday."></textarea>
                <mat-icon matPrefix>edit_note</mat-icon>
              </mat-form-field>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="modal-dialog-footer">
            <button mat-stroked-button (click)="openAwardSheetModal(bundleTest)" type="button">
              <mat-icon>print</mat-icon> Print Blank Award Foil
            </button>
            <div class="footer-spacer"></div>
            <button mat-stroked-button (click)="closeBundleModal()" type="button">Cancel</button>
            <button mat-raised-button color="primary" (click)="saveBundleAssignment()" [disabled]="savingBundle || bundleForm.invalid">
              <mat-icon>{{ savingBundle ? 'hourglass_empty' : 'check_circle' }}</mat-icon>
              {{ savingBundle ? 'Saving...' : 'Save & Assign Bundle' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ════════════════════════════════════════ -->
      <!-- MODAL 2: PRINCIPAL APPROVAL & SEAL       -->
      <!-- ════════════════════════════════════════ -->
      <div class="custom-modal-backdrop no-print" *ngIf="showApprovalModal" (click)="closeApprovalModal()">
        <div class="custom-modal-dialog" (click)="$event.stopPropagation()">
          <!-- Light Blue Gradient Header -->
          <div class="modal-dialog-header">
            <div class="modal-icon-box" style="background: #16a34a;">
              <mat-icon>verified</mat-icon>
            </div>
            <div class="modal-title-wrap">
              <h3>Principal Final Approval &amp; Official Seal</h3>
              <p>Review &amp; finalize results for <strong>{{ approvalTest?.title }}</strong> ({{ approvalTest?.subject }})</p>
            </div>
            <button mat-icon-button class="modal-close-btn" (click)="closeApprovalModal()" matTooltip="Close">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <!-- Modal Body -->
          <div class="modal-dialog-body">
            <div class="approval-summary-card">
              <div class="summary-stat-row">
                <div class="stat-pill">
                  <span class="stat-lbl">Batch:</span>
                  <span class="stat-val">{{ approvalTest?.batchName || 'General' }}</span>
                </div>
                <div class="stat-pill">
                  <span class="stat-lbl">Max Marks:</span>
                  <span class="stat-val">{{ approvalTest?.maxMarks }}</span>
                </div>
                <div class="stat-pill">
                  <span class="stat-lbl">Evaluated Students:</span>
                  <span class="stat-val font-bold">{{ approvalTest?.totalStudentsEvaluated || 0 }}</span>
                </div>
                <div class="stat-pill">
                  <span class="stat-lbl">Evaluator:</span>
                  <span class="stat-val">{{ approvalTest?.evaluatorTeacherName || 'Teacher' }}</span>
                </div>
              </div>

              <div class="approval-hierarchy-box">
                <div class="hierarchy-step done">
                  <mat-icon>schedule</mat-icon>
                  <span>1. Exam Held</span>
                </div>
                <div class="hierarchy-arrow">➔</div>
                <div class="hierarchy-step done">
                  <mat-icon>edit_note</mat-icon>
                  <span>2. Copies Checked &amp; Entered by Teacher</span>
                </div>
                <div class="hierarchy-arrow">➔</div>
                <div class="hierarchy-step active">
                  <mat-icon>admin_panel_settings</mat-icon>
                  <span>3. Principal Verification &amp; Seal</span>
                </div>
              </div>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Principal Approval Remarks / Moderation Notes</mat-label>
              <textarea matInput rows="3" [(ngModel)]="approvalRemarks" placeholder="e.g. Verified by Principal. Marks approved for parent scorecard dispatch and report card printing."></textarea>
            </mat-form-field>
          </div>

          <!-- Modal Footer -->
          <div class="modal-dialog-footer">
            <button mat-stroked-button color="warn" (click)="promptRejectRevision()" [disabled]="approvingMarks">
              <mat-icon>replay</mat-icon> Send Back for Revision
            </button>
            <div class="footer-spacer"></div>
            <button mat-stroked-button (click)="closeApprovalModal()">Cancel</button>
            <button mat-raised-button color="primary" class="approve-seal-btn" (click)="confirmApproveAndLock()" [disabled]="approvingMarks">
              <mat-progress-spinner *ngIf="approvingMarks" diameter="16" mode="indeterminate" class="btn-spinner"></mat-progress-spinner>
              <mat-icon *ngIf="!approvingMarks">verified</mat-icon>
              {{ approvingMarks ? 'Approving...' : 'Approve & Freeze Marks 🔒' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ════════════════════════════════════════ -->
      <!-- MODAL 3: MARKING FOIL / AWARD SHEET      -->
      <!-- ════════════════════════════════════════ -->
      <div class="custom-modal-backdrop" *ngIf="showAwardSheetModal" (click)="closeAwardSheetModal()">
        <div class="custom-modal-dialog award-sheet-dialog" (click)="$event.stopPropagation()">
          <!-- Light Blue Gradient Header (no-print) -->
          <div class="modal-dialog-header no-print">
            <div class="modal-icon-box">
              <mat-icon>description</mat-icon>
            </div>
            <div class="modal-title-wrap">
              <h3>Official Marking Foil / Blank Award Sheet</h3>
              <p>Physical answer sheet checking &amp; manual tabulation sheet</p>
            </div>
            <button mat-icon-button class="modal-close-btn" (click)="closeAwardSheetModal()" matTooltip="Close">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <!-- Printable Award Sheet Body -->
          <div class="modal-dialog-body award-sheet-scrollable" id="awardSheetPrintArea">
            <div class="award-sheet-paper">
              <div class="award-sheet-inst-header">
                <h2 class="inst-name-print">{{ instituteName }}</h2>
                <h4 class="sheet-title-print">EXAMINATION MARKS TABULATION FOIL / AWARD SHEET</h4>
                <div class="sheet-meta-grid">
                  <div><strong>Exam Title:</strong> {{ awardSheetData?.testTitle }}</div>
                  <div><strong>Subject:</strong> {{ awardSheetData?.subject }}</div>
                  <div><strong>Batch / Class:</strong> {{ awardSheetData?.batchName }}</div>
                  <div><strong>Exam Date:</strong> <span [appIstDatetime]="awardSheetData?.testDate" format="date"></span></div>
                  <div><strong>Max Marks:</strong> {{ awardSheetData?.maxMarks }}</div>
                  <div><strong>Evaluator Teacher:</strong> {{ awardSheetData?.evaluatorTeacherName || 'To Be Assigned' }}</div>
                  <div><strong>Copies Issued:</strong> {{ awardSheetData?.totalCopiesIssued || awardSheetData?.items?.length }}</div>
                  <div><strong>Generated At:</strong> <span [appIstDatetime]="todayDate" format="datetime"></span></div>
                </div>
              </div>

              <div *ngIf="loadingAwardSheet" class="text-center p-4">
                <mat-progress-bar mode="indeterminate"></mat-progress-bar>
                <p class="mt-2 text-slate-500">Generating Marking Foil...</p>
              </div>

              <table class="award-foil-table" *ngIf="!loadingAwardSheet && awardSheetData?.items">
                <thead>
                  <tr>
                    <th style="width: 45px;">Sl. No.</th>
                    <th style="width: 100px;">Roll No</th>
                    <th>Student Full Name</th>
                    <th style="width: 90px;">Max Marks</th>
                    <th style="width: 110px;">Marks in Figures</th>
                    <th style="width: 140px;">Marks in Words</th>
                    <th style="width: 90px;">Absent (A)</th>
                    <th style="width: 120px;">Examiner Initial</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let item of awardSheetData?.items; let idx = index">
                    <td class="text-center">{{ idx + 1 }}</td>
                    <td class="text-center font-mono">{{ item.rollNumber || '—' }}</td>
                    <td><strong>{{ item.studentName }}</strong></td>
                    <td class="text-center">{{ awardSheetData?.maxMarks }}</td>
                    <td class="text-center">{{ item.isAbsent ? 'ABSENT' : (item.marksObtained !== null ? item.marksObtained : '') }}</td>
                    <td></td>
                    <td class="text-center">{{ item.isAbsent ? '✓' : '' }}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>

              <!-- Signatures Row -->
              <div class="award-foil-signatures">
                <div class="foil-sig-box">
                  <div class="sig-line-top"></div>
                  <span>Signature of Examiner (Teacher)</span>
                  <small>{{ awardSheetData?.evaluatorTeacherName || 'Name: ________________' }}</small>
                </div>
                <div class="foil-sig-box">
                  <div class="sig-line-top"></div>
                  <span>Exam Controller / Coordinator</span>
                  <small>Verified Copies Count</small>
                </div>
                <div class="foil-sig-box">
                  <div class="sig-line-top"></div>
                  <span>Principal / Director</span>
                  <small>Official Seal &amp; Approval</small>
                </div>
              </div>
            </div>
          </div>

          <!-- Modal Footer (no-print) -->
          <div class="modal-dialog-footer no-print">
            <button mat-stroked-button (click)="closeAwardSheetModal()">Close</button>
            <div class="footer-spacer"></div>
            <button mat-raised-button color="primary" (click)="printAwardSheet()">
              <mat-icon>print</mat-icon> Print Award Sheet
            </button>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .tests-wrapper {
      display: flex;
      flex-direction: column;
      gap: 24px;
      width: 100%;
      box-sizing: border-box;
    }

    /* ─── Header ─── */
    .header-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .header-text-group h2 {
      margin: 0;
      font-size: 1.5rem;
      color: #1976d2;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .header-text-group p {
      margin: 4px 0 0;
      color: #64748b;
      font-size: 0.92rem;
    }
    .add-btn {
      height: 44px;
      font-weight: 600;
      letter-spacing: 0.02em;
      border-radius: 8px;
    }

    /* ─── Bulk Planner Card ─── */
    .planner-card {
      border-radius: 12px;
      border-top: 4px solid #3b82f6;
      background: #ffffff;
    }
    .planner-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .planner-title {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: #3b82f6;
        margin-top: 2px;
      }
      .title-text {
        display: block;
        font-size: 1.15rem;
        font-weight: 700;
        color: #0f172a;
      }
      .title-sub {
        display: block;
        font-size: 0.85rem;
        color: #64748b;
        margin-top: 2px;
      }
    }
    .row-count-badge {
      background: #eff6ff;
      color: #1d4ed8;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 0.88rem;
      font-weight: 600;
      border: 1px solid #bfdbfe;
    }
    .planner-header-actions {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }
    .planner-type-switcher {
      display: inline-flex;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 24px;
      padding: 3px;
      gap: 4px;

      .type-pill-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 14px;
        border-radius: 20px;
        border: none;
        background: transparent;
        color: #64748b;
        font-size: 0.84rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }

        &:hover {
          color: #1e293b;
        }

        &.active {
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);

          mat-icon {
            color: #ffffff;
          }
        }
      }
    }
    .shared-batch-row {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 18px;
      flex-wrap: wrap;
      .batch-selector { flex: 0 0 340px; }
      .section-selector { flex: 0 0 220px; }
      .batch-tip {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.85rem;
        color: #16a34a;
        font-weight: 600;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
    }

    /* ── Planner Grid & Column Labels ── */
    .planner-grid-wrapper {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: 8px;
      padding-bottom: 4px;
    }

    .row-labels {
      display: grid;
      gap: 8px;
      padding: 10px 10px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 8px 8px 0 0;
      font-size: 0.74rem;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      box-sizing: border-box;
      min-width: 820px;
      width: 100%;
      .lbl-num { text-align: center; }
      .lbl-marks { text-align: center; white-space: nowrap; }

      &.coaching-mode {
        grid-template-columns: 32px minmax(130px, 1.3fr) minmax(110px, 1.2fr) minmax(140px, 1.6fr) 125px 85px 75px 38px;
      }
      &.school-mode {
        grid-template-columns: 32px minmax(110px, 1.2fr) 75px minmax(110px, 1.2fr) minmax(130px, 1.5fr) 125px 85px 75px 38px;
      }
    }

    .exam-row {
      display: grid;
      gap: 8px;
      align-items: flex-start;
      padding: 8px 10px;
      border: 1px solid #e2e8f0;
      border-top: none;
      background: #ffffff;
      transition: background 0.15s ease;
      box-sizing: border-box;
      min-width: 820px;
      width: 100%;
      &:hover { background: #f8fafc; }
      &.exam-row-error { background: #fffbfb; border-color: #fecaca; }
      &:last-child { border-radius: 0 0 8px 8px; }

      &.coaching-mode {
        grid-template-columns: 32px minmax(130px, 1.3fr) minmax(110px, 1.2fr) minmax(140px, 1.6fr) 125px 85px 75px 38px;
      }
      &.school-mode {
        grid-template-columns: 32px minmax(110px, 1.2fr) 75px minmax(110px, 1.2fr) minmax(130px, 1.5fr) 125px 85px 75px 38px;
      }
    }

    .cell-num, .cell-del {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 40px;
    }
    .cell-del button {
      width: 34px !important;
      height: 34px !important;
      padding: 0 !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }
    .cell-marks {
      input {
        text-align: center;
        font-weight: 700;
      }
    }
    .cell-class, .cell-section, .cell-batch, .cell-subject, .cell-title,
    .cell-date, .cell-time, .cell-marks, .cell-num, .cell-del {
      min-width: 0;
      box-sizing: border-box;
    }

    .field-compact {
      width: 100%;
      ::ng-deep .mat-mdc-text-field-wrapper {
        height: 40px !important;
        padding: 0 8px !important;
        display: flex !important;
        align-items: center !important;
        background-color: #ffffff;
      }
      ::ng-deep .mat-mdc-form-field-flex {
        height: 100% !important;
        display: flex !important;
        align-items: center !important;
      }
      ::ng-deep .mat-mdc-form-field-infix {
        min-height: unset !important;
        padding: 0 !important;
        display: flex !important;
        align-items: center !important;
        height: 100% !important;
      }
      ::ng-deep input.mat-mdc-input-element,
      ::ng-deep .mat-mdc-select-value {
        font-size: 0.88rem;
        line-height: normal !important;
        vertical-align: middle !important;
      }
      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        padding: 2px 4px 0 4px !important;
        font-size: 0.72rem;
      }
      ::ng-deep .mat-mdc-form-field-error {
        font-size: 0.72rem;
        font-weight: 600;
        color: #dc2626;
        display: block;
        line-height: 1.2;
      }
    }

    .row-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #e0e7ff;
      color: #3730a3;
      font-size: 0.76rem;
      font-weight: 700;
    }
    /* ─── Smart Dropdown Panels ─── */
    ::ng-deep .smart-batch-panel {
      min-width: 380px !important;
      max-width: 520px !important;
      border-radius: 8px !important;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;

      .mat-mdc-option {
        min-height: 44px !important;
        padding: 8px 16px !important;
        border-bottom: 1px solid #f8fafc;

        &:last-child {
          border-bottom: none;
        }

        .mdc-list-item__primary-text {
          white-space: nowrap !important;
          overflow: visible !important;
          font-size: 0.88rem;
          color: #1e293b;
          font-weight: 500;
        }

        &:hover:not(.mdc-list-item--disabled) {
          background-color: #f8fafc !important;
        }

        &.mdc-list-item--selected:not(.mdc-list-item--disabled) {
          background-color: #eff6ff !important;
          .mdc-list-item__primary-text {
            color: #2563eb !important;
            font-weight: 600;
          }
        }
      }
    }

    ::ng-deep .smart-subject-panel {
      min-width: 320px !important;
      max-width: 440px !important;
      border-radius: 8px !important;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
    }

    ::ng-deep .select-search-option {
      height: auto !important;
      min-height: unset !important;
      padding: 0 !important;
      position: sticky !important;
      top: 0 !important;
      z-index: 10 !important;
      background: #ffffff !important;
      border-bottom: 1px solid #e2e8f0 !important;
      cursor: default !important;

      &.mat-mdc-option[aria-disabled="true"],
      &.mdc-list-item--disabled {
        opacity: 1 !important;
        pointer-events: auto !important;
        cursor: default !important;
      }

      .mdc-list-item__primary-text {
        width: 100% !important;
        pointer-events: auto !important;
        padding: 0 !important;
      }

      &:hover, &:focus {
        background: #ffffff !important;
      }
    }

    .select-search-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #ffffff;
      width: 100%;
      box-sizing: border-box;

      .search-box-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #94a3b8;
        flex-shrink: 0;
      }

      .select-search-input {
        flex: 1 1 auto;
        padding: 7px 10px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 0.85rem;
        outline: none;
        color: #0f172a;
        background: #f8fafc;
        box-sizing: border-box;
        pointer-events: auto !important;
        cursor: text !important;

        &:focus {
          border-color: #3b82f6;
          background: #ffffff;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
        }
      }

      .clear-search-btn {
        width: 24px;
        height: 24px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #94a3b8;
        }
      }
    }

    ::ng-deep .no-subjects-option {
      text-align: center;
      color: #94a3b8 !important;
      font-size: 0.85rem;
      padding: 16px !important;
      justify-content: center !important;
    }

    .subject-option-row {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      .sub-icon { font-size: 16px; width: 16px; height: 16px; color: #6366f1; }
      .sub-code {
        margin-left: auto;
        font-size: 0.72rem;
        background: #f1f5f9;
        color: #6366f1;
        padding: 2px 6px;
        border-radius: 6px;
      }
    }
    .mobile-only-label { display: none; }
    .planner-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 18px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      flex-wrap: wrap;
      gap: 12px;
    }
    .planner-actions { display: flex; gap: 12px; flex-wrap: wrap; }

    /* ═════════════════════════════════════════════ */
    /* PURE ANGULAR MATERIAL MARKS ENTRY STYLES     */
    /* ═════════════════════════════════════════════ */
    .marks-card {
      border-radius: 12px;
      border-left: 5px solid #6366f1;
      background: #ffffff;
      overflow: hidden;
    }
    .marks-card-header {
      padding: 16px 20px 14px;
      background: linear-gradient(180deg, #f8faff 0%, #f1f5f9 100%);
    }
    .marks-header-content {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .marks-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    }
    .marks-title-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .marks-header-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: #6366f1;
    }
    .marks-heading-wrap {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .marks-badge-tag {
      font-size: 0.7rem;
      font-weight: 700;
      color: #6366f1;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .marks-main-title {
      margin: 0;
      font-size: 1.25rem;
      color: #0f172a;
      font-weight: 600;
      strong {
        color: #1e293b;
        font-weight: 800;
      }
    }
    .close-btn {
      width: 38px;
      height: 38px;
    }
    .marks-chips-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .custom-chip {
      font-size: 0.82rem !important;
      font-weight: 600 !important;
      border-radius: 20px !important;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .chip-subject { background: #ede9fe !important; color: #6d28d9 !important; }
    .chip-batch   { background: #e0f2fe !important; color: #0284c7 !important; }
    .chip-marks   { background: #fef3c7 !important; color: #b45309 !important; }
    .chip-date    { background: #f1f5f9 !important; color: #475569 !important; }

    .marks-loader { margin: 0; }
    .marks-card-content {
      padding: 16px 20px 24px;
    }

    /* ── Marks Mat-Table (Desktop & Tablet) ── */
    .desktop-marks-container {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
    }
    .marks-mat-table {
      width: 100%;
      border-collapse: collapse;

      th.mat-header-cell {
        background: #f8fafc;
        color: #475569;
        font-weight: 700;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 12px 14px;
        border-bottom: 2px solid #e2e8f0;
        white-space: nowrap;
      }
      td.mat-cell {
        padding: 10px 14px;
        border-bottom: 1px solid #e2e8f0;
        vertical-align: middle;
      }
    }
    .student-mark-row {
      transition: background 0.15s ease;
      &:hover { background: #f8fafc; }
    }
    .student-absent-row {
      background: #fff1f2 !important;
      opacity: 0.85;
    }

    /* Table Column Sizing */
    .col-index { width: 50px; text-align: center; }
    .col-roll  { width: 140px; }
    .col-name  { min-width: 200px; }
    .col-marks { width: 170px; }
    .col-absent{ width: 100px; }
    .col-remarks{ min-width: 200px; }

    .rank-circle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #f1f5f9;
      color: #64748b;
      font-size: 0.82rem;
      font-weight: 700;
    }
    .roll-pill {
      display: inline-block;
      padding: 4px 10px;
      background: #f1f5f9;
      color: #334155;
      border-radius: 6px;
      font-size: 0.82rem;
      font-weight: 700;
      font-family: monospace;
      letter-spacing: 0.02em;
    }
    .student-info-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .student-avatar-letter {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: white;
      font-size: 0.85rem;
      font-weight: 700;
    }
    .student-display-name {
      color: #0f172a;
      font-size: 0.92rem;
    }

    /* Marks input in table */
    .marks-input-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .marks-mat-field {
      width: 145px;
      ::ng-deep .mat-mdc-text-field-wrapper {
        padding: 0 10px !important;
        height: 40px !important;
        display: flex !important;
        align-items: center !important;
      }
      ::ng-deep .mat-mdc-form-field-flex {
        height: 100% !important;
        display: flex !important;
        align-items: center !important;
      }
      ::ng-deep .mat-mdc-form-field-infix {
        min-height: unset !important;
        padding: 0 !important;
        display: flex !important;
        align-items: center !important;
        height: 100% !important;
        flex: 1 1 auto !important;
        min-width: 0 !important;
      }
      ::ng-deep input.mat-mdc-input-element,
      input.marks-input-left,
      input.marks-input-centered {
        font-weight: 700;
        font-size: 0.95rem;
        color: #0f172a;
        text-align: left !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        line-height: normal !important;
        vertical-align: middle !important;
        width: 100% !important;
        min-width: 0 !important;
        -moz-appearance: textfield;
      }
      ::ng-deep input.mat-mdc-input-element::placeholder,
      input.marks-input-left::placeholder,
      input.marks-input-centered::placeholder {
        text-align: left !important;
      }
      ::ng-deep input.mat-mdc-input-element::-webkit-outer-spin-button,
      ::ng-deep input.mat-mdc-input-element::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      ::ng-deep .mat-mdc-form-field-icon-suffix {
        display: flex !important;
        align-items: center !important;
        padding: 0 !important;
        white-space: nowrap !important;
        flex-shrink: 0 !important;
      }
    }
    .marks-suffix-tag {
      font-size: 0.8rem;
      color: #64748b;
      font-weight: 600;
      white-space: nowrap !important;
      display: inline-flex !important;
      align-items: center !important;
      line-height: 1;
      flex-shrink: 0 !important;
      margin-left: 2px;
    }
    .over-limit {
      color: #dc2626 !important;
    }
    .over-limit-hint {
      font-size: 0.7rem;
      color: #dc2626;
      font-weight: 600;
      text-align: center;
    }
    .remarks-mat-field {
      width: 100%;
      min-width: 160px;
      ::ng-deep .mat-mdc-text-field-wrapper {
        padding: 0 10px !important;
        height: 40px !important;
        display: flex !important;
        align-items: center !important;
      }
      ::ng-deep .mat-mdc-form-field-flex {
        height: 100% !important;
        display: flex !important;
        align-items: center !important;
      }
      ::ng-deep .mat-mdc-form-field-infix {
        min-height: unset !important;
        padding: 0 !important;
        display: flex !important;
        align-items: center !important;
        height: 100% !important;
      }
      ::ng-deep input.mat-mdc-input-element,
      input.remarks-input-left,
      input.remarks-input-centered {
        text-align: left !important;
        font-size: 0.88rem;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        line-height: normal !important;
        vertical-align: middle !important;
      }
      ::ng-deep input.mat-mdc-input-element::placeholder,
      input.remarks-input-left::placeholder,
      input.remarks-input-centered::placeholder {
        text-align: left !important;
      }
      ::ng-deep .mat-mdc-form-field-icon-suffix {
        display: flex !important;
        align-items: center !important;
        padding: 0 !important;
      }
    }
    .remarks-icon {
      color: #94a3b8;
      font-size: 18px;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .absent-flag {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 800;
      color: #dc2626;
      background: #fee2e2;
      padding: 2px 6px;
      border-radius: 4px;
      letter-spacing: 0.04em;
    }

    /* Mobile Cards View (hidden by default on desktop/tablet) */
    .mobile-marks-cards {
      display: none;
    }

    /* ── Marks Footer ── */
    .marks-footer {
      margin-top: 24px;
      padding-top: 18px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .whatsapp-dispatch-box {
      display: flex;
      align-items: center;
    }
    .whatsapp-label {
      display: flex;
      align-items: center;
      gap: 10px;
      text-align: left;
    }
    .whatsapp-icon-circle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #25d366;
      color: white;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .whatsapp-title {
      display: block;
      font-size: 0.92rem;
      font-weight: 700;
      color: #0f172a;
    }
    .whatsapp-sub {
      display: block;
      font-size: 0.76rem;
      color: #64748b;
    }
    .marks-submit-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .btn-spinner {
      display: inline-block;
      margin-right: 6px;
      vertical-align: middle;
    }
    .save-marks-btn {
      height: 44px;
      font-weight: 700;
      letter-spacing: 0.02em;
      border-radius: 8px;
      padding: 0 20px;
    }

    /* ═════════════════════════════════════════════ */
    /* TESTS LIST TABLE (MAIN)                      */
    /* ═════════════════════════════════════════════ */
    .table-card {
      border-radius: 12px;
      overflow: hidden;
      background: #ffffff;
    }
    .filter-toolbar {
      padding: 16px 20px 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #fafafa;
      border-bottom: 1px solid #f1f5f9;
    }
    .category-tabs-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;

      .cat-tab-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 16px;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        color: #475569;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #64748b;
        }

        &:hover {
          border-color: #94a3b8;
          color: #0f172a;
          background: #f8fafc;
        }

        &.active {
          background: #2563eb;
          border-color: #2563eb;
          color: #ffffff;
          box-shadow: 0 2px 6px -1px rgba(37, 99, 235, 0.3);

          mat-icon {
            color: #ffffff;
          }
        }
      }
    }
    .filters-input-row {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      flex-wrap: wrap;

      .search-field { flex: 1 1 280px; }
      .filter-dropdown { flex: 0 1 240px; }
      .section-filter { flex: 0 1 160px; }
      .batch-filter { flex: 0 1 240px; }
    }
    .grid-loader { margin: 0; }
    .table-container { padding: 0; }
    .responsive-table-wrap {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .full-width { width: 100%; }

    .test-title-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 6px 0;
    }
    .title-heading {
      color: #0f172a;
      font-size: 0.95rem;
      font-weight: 700;
    }
    .marks-count {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.76rem;
      color: #16a34a;
      font-weight: 600;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    .pending-count {
      color: #d97706;
    }
    .batch-name-tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.82rem;
      font-weight: 600;
      color: #0284c7;
      background: #f0f9ff;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid #bae6fd;

      .group-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #0284c7;
      }
    }
    .school-class-tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.82rem;
      font-weight: 600;
      color: #15803d;
      background: #f0fdf4;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid #bbf7d0;

      .group-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #16a34a;
      }

      .sec-badge {
        font-size: 0.75rem;
        background: #dcfce7;
        color: #166534;
        padding: 1px 5px;
        border-radius: 3px;
        font-weight: 700;
      }
    }
    .general-tag {
      display: inline-block;
      font-size: 0.82rem;
      font-weight: 600;
      color: #64748b;
      background: #f1f5f9;
      padding: 4px 10px;
      border-radius: 6px;
    }
    .subject-tag {
      display: inline-block;
      font-size: 0.82rem;
      font-weight: 600;
      color: #475569;
    }
    .max-marks-badge {
      display: inline-block;
      padding: 4px 12px;
      background: #fef3c7;
      color: #b45309;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 700;
      border: 1px solid #fde68a;
    }
    .date-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .date-text {
      color: #0f172a;
      font-size: 0.88rem;
      font-weight: 600;
    }
    .time-badge {
      font-size: 0.76rem;
      color: #6366f1;
      font-weight: 700;
      background: #f5f3ff;
      padding: 2px 6px;
      border-radius: 6px;
      width: fit-content;
    }
    .text-right  { text-align: right; }
    .text-center { text-align: center; }
    .action-buttons {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      white-space: nowrap;
    }
    .enter-marks-btn {
      font-size: 0.82rem;
      font-weight: 600;
      border-radius: 6px;
      height: 36px;
      padding: 0 12px;
    }
    .admit-card-btn {
      font-size: 0.82rem;
      font-weight: 600;
      border-radius: 6px;
      height: 36px;
      padding: 0 12px;
      border-color: #6366f1;
      color: #4f46e5;
      background: #f5f3ff;
      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-right: 4px;
      }
      &:hover {
        background: #ede9fe;
      }
    }
    .result-btn {
      font-size: 0.82rem;
      font-weight: 600;
      border-radius: 6px;
      height: 36px;
      padding: 0 12px;
      border-color: #059669;
      color: #047857;
      background: #ecfdf5;
      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-right: 4px;
      }
      &:hover {
        background: #d1fae5;
      }
    }
    .marks-header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* ─── Workflow Badges & Action Buttons ─── */
    .title-and-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .workflow-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.73rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      white-space: nowrap;
      mat-icon {
        font-size: 13px;
        width: 13px;
        height: 13px;
      }
    }
    .badge-scheduled {
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #bfdbfe;
    }
    .badge-evaluating {
      background: #fff7ed;
      color: #c2410c;
      border: 1px solid #fdba74;
    }
    .badge-returned {
      background: #f5f3ff;
      color: #6d28d9;
      border: 1px solid #ddd6fe;
    }
    .badge-entered {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }
    .badge-submitted {
      background: #fefce8;
      color: #a16207;
      border: 1px solid #fde047;
    }
    .badge-locked {
      background: #f0fdf4;
      color: #15803d;
      border: 1px solid #86efac;
    }
    .badge-revision {
      background: #fff1f2;
      color: #be123c;
      border: 1px solid #fecdd3;
    }
    .test-meta-sub {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 2px;
    }
    .evaluator-sub {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.78rem;
      color: #475569;
      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        color: #2563eb;
      }
      strong {
        color: #0f172a;
      }
    }
    .bundle-btn {
      font-size: 0.82rem;
      font-weight: 600;
      border-radius: 6px;
      height: 36px;
      padding: 0 10px;
      border-color: #f97316;
      color: #ea580c;
      background: #fff7ed;
      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-right: 4px;
      }
      &:hover {
        background: #ffedd5;
      }
    }
    .foil-btn {
      font-size: 0.82rem;
      font-weight: 600;
      border-radius: 6px;
      height: 36px;
      padding: 0 10px;
      border-color: #0284c7;
      color: #0369a1;
      background: #f0f9ff;
      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-right: 4px;
      }
      &:hover {
        background: #e0f2fe;
      }
    }
    .result-btn {
      font-size: 0.82rem;
      font-weight: 600;
      border-radius: 6px;
      height: 36px;
      padding: 0 10px;
      border-color: #10b981;
      color: #059669;
      background: #ecfdf5;
      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-right: 4px;
        color: #10b981;
      }
      &:hover {
        background: #d1fae5;
      }
    }
    .result-btn-disabled,
    .enter-marks-disabled-btn {
      font-size: 0.82rem;
      font-weight: 500;
      border-radius: 6px;
      height: 36px;
      padding: 0 10px;
      border-color: #e2e8f0 !important;
      color: #94a3b8 !important;
      background: #f8fafc !important;
      cursor: not-allowed !important;
      opacity: 0.75;
      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        margin-right: 4px;
        color: #cbd5e1;
      }
    }
    .my-bundle-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.74rem;
      font-weight: 700;
      color: #15803d;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      padding: 2px 8px;
      border-radius: 12px;
      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        color: #16a34a;
      }
    }
    .approval-btn {
      font-size: 0.82rem;
      font-weight: 700;
      border-radius: 6px;
      height: 36px;
      padding: 0 12px;
      background: linear-gradient(135deg, #059669 0%, #10b981 100%) !important;
      color: #ffffff !important;
      box-shadow: 0 2px 4px rgba(16,185,129,0.3);
      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-right: 4px;
      }
    }
    .draft-marks-btn {
      font-weight: 600;
      height: 40px;
      border-radius: 8px;
    }
    .approve-marks-direct-btn {
      background: linear-gradient(135deg, #059669 0%, #10b981 100%) !important;
      color: #ffffff !important;
      font-weight: 700;
      height: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(16,185,129,0.35);
    }
    .test-lock-alert {
      margin: 16px 20px 0;
      padding: 14px 18px;
      background: #f0fdf4;
      border: 1.5px solid #86efac;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      .lock-alert-content {
        display: flex;
        align-items: center;
        gap: 12px;
        .lock-icon {
          color: #16a34a;
          font-size: 28px;
          width: 28px;
          height: 28px;
        }
        .lock-title {
          display: block;
          font-size: 0.96rem;
          font-weight: 700;
          color: #14532d;
        }
        .lock-desc {
          display: block;
          font-size: 0.82rem;
          color: #15803d;
          margin-top: 2px;
        }
      }
      .unlock-btn {
        border-color: #ef4444;
        color: #dc2626;
        font-weight: 600;
      }
    }
    .revision-alert {
      margin: 16px 20px 0;
      padding: 14px 18px;
      background: #fff1f2;
      border: 1.5px solid #fecdd3;
      border-radius: 10px;
      display: flex;
      align-items: center;
      gap: 14px;
      mat-icon {
        color: #e11d48;
        font-size: 28px;
        width: 28px;
        height: 28px;
        flex-shrink: 0;
      }
      .revision-title {
        display: block;
        font-size: 0.95rem;
        font-weight: 700;
        color: #9f1239;
      }
      .revision-desc {
        display: block;
        font-size: 0.84rem;
        color: #be123c;
        margin-top: 2px;
      }
    }

    /* ─── Custom Modals (Strict Light Blue Header Rule) ─── */
    .custom-modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.5);
      backdrop-filter: blur(4px);
      z-index: 1050;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
      overflow-y: auto;
    }
    .custom-modal-dialog {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25);
      width: 100%;
      max-width: 680px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.96) translateY(8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .modal-dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 18px 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      flex-shrink: 0;
    }
    .modal-icon-box {
      width: 44px;
      height: 44px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      mat-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
      }
    }
    .modal-title-wrap {
      flex: 1;
      min-width: 0;
      h3 {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 700;
        color: #1e3a8a;
        line-height: 1.3;
      }
      p {
        margin: 3px 0 0;
        font-size: 0.85rem;
        color: #3b82f6;
        line-height: 1.4;
        strong {
          color: #1e40af;
        }
      }
    }
    .modal-close-btn {
      color: #64748b;
      margin-left: auto;
      flex-shrink: 0;
      &:hover {
        color: #1e293b;
        background: rgba(219, 234, 254, 0.6);
      }
    }
    .modal-dialog-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .modal-dialog-footer {
      padding: 16px 24px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    .footer-spacer {
      flex: 1;
    }
    /* ─── Smart Teacher Dropdown Panel ─── */
    ::ng-deep .smart-teacher-panel {
      min-width: 360px !important;
      max-width: 540px !important;
      border-radius: 10px !important;
      box-shadow: 0 14px 30px -5px rgba(15, 23, 42, 0.2), 0 8px 10px -6px rgba(15, 23, 42, 0.1) !important;

      .mat-mdc-option {
        min-height: 52px !important;
        padding: 8px 14px !important;
        border-bottom: 1px solid #f1f5f9;

        &:last-child {
          border-bottom: none;
        }

        &.mdc-list-item--selected:not(.mdc-list-item--disabled) {
          background-color: #eff6ff !important;
        }
      }
    }

    .selected-teacher-trigger {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.9rem;
      font-weight: 600;
      color: #0f172a;
      .trigger-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #2563eb;
      }
      .trigger-name {
        color: #1e3a8a;
      }
      .trigger-badge {
        background: #e0e7ff;
        color: #3730a3;
        font-size: 0.72rem;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 4px;
        letter-spacing: 0.02em;
      }
      .trigger-phone {
        font-size: 0.8rem;
        color: #64748b;
        font-weight: 500;
      }
    }

    .teacher-option-row {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
    }
    .tch-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: #ffffff;
      font-size: 0.82rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);
    }
    .tch-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }
    .tch-title-line {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .tch-name {
      font-size: 0.88rem;
      font-weight: 700;
      color: #0f172a;
    }
    .tch-code-badge {
      background: #e0e7ff;
      color: #3730a3;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;
    }
    .tch-desig {
      font-size: 0.74rem;
      color: #0284c7;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      padding: 0 5px;
      border-radius: 3px;
    }
    .tch-meta-line {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.76rem;
      color: #64748b;
      span {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        mat-icon {
          font-size: 13px;
          width: 13px;
          height: 13px;
        }
      }
    }

    /* Exam Details Specification Card */
    .exam-spec-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .exam-spec-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #cbd5e1;
    }
    .spec-title-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .spec-exam-type {
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #2563eb;
      text-transform: uppercase;
    }
    .spec-title {
      margin: 0;
      font-size: 0.98rem;
      font-weight: 700;
      color: #0f172a;
    }
    .spec-marks-badge {
      background: #ecfdf5;
      color: #059669;
      border: 1px solid #a7f3d0;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      white-space: nowrap;
    }
    .exam-spec-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px 16px;
    }
    .spec-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 0.8rem;
      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #3b82f6;
        margin-top: 2px;
        flex-shrink: 0;
      }
      div {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      label {
        font-size: 0.7rem;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        font-weight: 600;
      }
      strong {
        color: #1e293b;
        font-size: 0.82rem;
      }
      .unassigned-text {
        color: #d97706;
        font-style: italic;
      }
      .spec-sub-phone {
        font-weight: normal;
        color: #64748b;
      }
    }

    .auto-fill-hint-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      color: #1e40af;
      font-weight: 500;
      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        color: #2563eb;
      }
      strong {
        color: #1e3a8a;
        font-weight: 700;
      }
    }

    .modal-form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      .full-col {
        grid-column: 1 / -1;
      }
    }
    .workflow-info-banner {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.85rem;
      color: #166534;
      mat-icon {
        color: #16a34a;
        font-size: 20px;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        margin-top: 1px;
      }
    }
    .approval-summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .summary-stat-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      @media (max-width: 640px) {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    .stat-pill {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      .stat-lbl {
        font-size: 0.72rem;
        color: #64748b;
        font-weight: 600;
        text-transform: uppercase;
      }
      .stat-val {
        font-size: 0.92rem;
        font-weight: 700;
        color: #0f172a;
      }
    }
    .approval-hierarchy-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 12px 16px;
      gap: 8px;
      flex-wrap: wrap;
    }
    .hierarchy-step {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #64748b;
      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
      &.done {
        color: #1e40af;
        mat-icon { color: #2563eb; }
      }
      &.active {
        color: #15803d;
        font-weight: 700;
        mat-icon { color: #16a34a; }
      }
    }
    .hierarchy-arrow {
      color: #93c5fd;
      font-weight: 700;
    }
    .approve-seal-btn {
      background: #16a34a !important;
      color: #ffffff !important;
    }

    /* ─── Award Sheet Marking Foil Layout ─── */
    .award-sheet-dialog {
      max-width: 900px;
      width: 96vw;
    }
    .award-sheet-scrollable {
      max-height: 75vh;
      overflow-y: auto;
      background: #f8fafc;
      padding: 24px;
    }
    .award-sheet-paper {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 32px 36px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.06);
      border-radius: 4px;
    }
    .award-sheet-inst-header {
      text-align: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 16px;
      .inst-name-print {
        margin: 0;
        font-size: 1.45rem;
        font-weight: 800;
        text-transform: uppercase;
        color: #0f172a;
        letter-spacing: -0.01em;
      }
      .sheet-title-print {
        margin: 4px 0 0;
        font-size: 0.98rem;
        font-weight: 700;
        color: #1e40af;
        letter-spacing: 0.05em;
      }
      .sheet-meta-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px 16px;
        margin-top: 14px;
        text-align: left;
        font-size: 0.82rem;
        color: #334155;
        border-top: 1px dashed #cbd5e1;
        padding-top: 10px;
      }
    }
    .award-foil-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
      border: 1.5px solid #0f172a;
      th {
        background: #f1f5f9;
        color: #0f172a;
        font-weight: 700;
        font-size: 0.8rem;
        text-transform: uppercase;
        border: 1px solid #94a3b8;
        padding: 8px 10px;
        text-align: left;
      }
      td {
        border: 1px solid #cbd5e1;
        padding: 8px 10px;
        font-size: 0.85rem;
        color: #0f172a;
      }
    }
    .award-foil-signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 54px;
      padding-top: 10px;
      .foil-sig-box {
        width: 220px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        .sig-line-top {
          width: 100%;
          border-top: 1.5px solid #334155;
          margin-bottom: 6px;
        }
        span {
          font-size: 0.82rem;
          font-weight: 700;
          color: #0f172a;
        }
        small {
          font-size: 0.74rem;
          color: #64748b;
          margin-top: 2px;
        }
      }
    }
    .empty-cell {
      padding: 48px;
      text-align: center;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      color: #94a3b8;
      .empty-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 8px;
        color: #cbd5e1;
      }
      p { margin: 0; font-size: 0.95rem; }
    }

    /* ═════════════════════════════════════════════ */
    /* RESPONSIVE DESIGN (Mobile, Tablet, Desktop)  */
    /* ═════════════════════════════════════════════ */

    /* Tablet (768px - 1024px) */
    @media (max-width: 1024px) {
      .row-labels.coaching-mode,
      .exam-row.coaching-mode {
        grid-template-columns: 32px minmax(130px, 1.3fr) minmax(110px, 1.2fr) minmax(140px, 1.6fr) 125px 85px 75px 38px;
        gap: 6px;
      }
      .row-labels.school-mode,
      .exam-row.school-mode {
        grid-template-columns: 32px minmax(110px, 1.2fr) 75px minmax(110px, 1.2fr) minmax(130px, 1.5fr) 125px 85px 75px 38px;
        gap: 6px;
      }
      .shared-batch-row .batch-selector,
      .shared-batch-row .section-selector {
        flex: 1 1 100%;
      }
      .marks-mat-table {
        th.mat-header-cell, td.mat-cell {
          padding: 8px 10px;
        }
      }
    }

    /* Mobile & Small Tablets (< 768px) */
    @media (max-width: 768px) {
      .tests-wrapper { gap: 16px; }

      .header-actions {
        flex-direction: column;
        align-items: stretch;
      }
      .add-btn { width: 100%; }

      /* Bulk planner mobile view */
      .planner-header { flex-direction: column; gap: 8px; }
      .row-labels { display: none !important; }

      .exam-row {
        display: flex !important;
        flex-direction: column !important;
        gap: 10px !important;
        padding: 14px !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 8px !important;
        margin-bottom: 12px !important;
        background: #fdfdfd !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important;
      }
      .cell-num {
        align-self: flex-start;
      }
      .mobile-only-label {
        display: inline !important;
      }
      .planner-footer {
        flex-direction: column;
        align-items: stretch;
        gap: 14px;
        button { width: 100%; }
      }
      .planner-actions {
        flex-direction: column;
        width: 100%;
        button { width: 100%; }
      }

      /* Marks Entry Mobile Switch: Hide table, Show responsive cards */
      .desktop-marks-container {
        display: none !important;
      }
      .mobile-marks-cards {
        display: flex !important;
        flex-direction: column;
        gap: 12px;
      }
      .student-card-item {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 14px;
        background: #ffffff;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        display: flex;
        flex-direction: column;
        gap: 12px;
        transition: all 0.2s ease;
      }
      .student-card-absent {
        background: #fff5f5 !important;
        border-color: #fecaca !important;
      }
      .student-card-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #f1f5f9;
        padding-bottom: 10px;
      }
      .student-card-profile {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .rank-circle-small {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #f1f5f9;
        color: #475569;
        font-size: 0.75rem;
        font-weight: 700;
      }
      .student-avatar-letter-small {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #6366f1;
        color: white;
        font-size: 0.78rem;
        font-weight: 700;
      }
      .student-card-titles {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .student-card-name {
        font-size: 0.92rem;
        font-weight: 700;
        color: #0f172a;
      }
      .roll-pill-small {
        font-size: 0.72rem;
        font-weight: 700;
        color: #64748b;
      }
      .absent-hint {
        font-size: 0.76rem;
        color: #64748b;
      }
      .student-card-inputs {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .mobile-marks-field, .mobile-remarks-field {
        width: 100%;
      }

      /* Marks footer mobile */
      .marks-footer {
        flex-direction: column;
        align-items: stretch;
      }
      .marks-submit-actions {
        flex-direction: column;
        width: 100%;
        button { width: 100%; }
      }
      .filter-toolbar {
        flex-direction: column;
        padding: 14px;
        .search-field, .batch-filter {
          width: 100%;
          min-width: 100%;
        }
      }
    }

    /* Small Mobile (< 480px) */
    @media (max-width: 480px) {
      .header-text-group h2 { font-size: 1.35rem; }
      .marks-main-title { font-size: 1.05rem; }
      .marks-chips-bar { flex-direction: column; align-items: flex-start; }
      .whatsapp-label { align-items: flex-start; }
    }

    /* Print Header & Schedule Styles */
    .header-buttons-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .print-schedule-btn {
      height: 44px;
      border-radius: 8px;
      font-weight: 600;
      color: #334155;
      border-color: #cbd5e1;
      mat-icon {
        color: #2563eb;
        margin-right: 6px;
      }
      &:hover {
        background-color: #f1f5f9;
      }
    }

    .print-only {
      display: none;
    }

    @media print {
      .no-print,
      .mat-column-actions,
      .action-buttons,
      mat-paginator,
      .filter-toolbar,
      .header-actions {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      .print-only {
        display: block !important;
      }

      :host {
        display: block !important;
        width: 100% !important;
      }

      .tests-wrapper {
        gap: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
      }

      .table-card {
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        margin: 0 !important;
        background: transparent !important;
      }

      .table-container,
      .responsive-table-wrap {
        overflow: visible !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        border: none !important;
        box-shadow: none !important;
      }

      /* Executive Print Header */
      .print-schedule-header {
        border-bottom: 2.5px solid #0f172a;
        padding-bottom: 12px;
        margin-bottom: 16px;

        .print-inst-name {
          margin: 0;
          font-size: 1.4rem;
          font-weight: 800;
          text-transform: uppercase;
          color: #0f172a;
          letter-spacing: -0.01em;
        }

        .print-doc-title {
          margin: 4px 0 0 0;
          font-size: 1.05rem;
          font-weight: 700;
          color: #1e40af;
          letter-spacing: 0.04em;
        }

        .print-meta-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 6px;
          font-size: 0.82rem;
          color: #475569;

          .meta-sep {
            color: #94a3b8;
          }
        }
      }

      /* Clean Full-Width Printable Table */
      table.full-width {
        width: 100% !important;
        min-width: 100% !important;
        border-collapse: collapse !important;
        border: 1.5px solid #0f172a !important;

        th.mat-header-cell {
          background-color: #f1f5f9 !important;
          color: #0f172a !important;
          font-weight: 800 !important;
          font-size: 0.78rem !important;
          text-transform: uppercase !important;
          padding: 8px 10px !important;
          border: 1px solid #cbd5e1 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        td.mat-cell {
          padding: 8px 10px !important;
          font-size: 0.85rem !important;
          color: #0f172a !important;
          border: 1px solid #e2e8f0 !important;
        }

        .test-title-cell {
          gap: 0 !important;
          .title-heading {
            font-weight: 700 !important;
            font-size: 0.88rem !important;
            color: #0f172a !important;
          }
          .marks-count {
            display: none !important;
          }
        }

        .batch-name-tag, .subject-tag {
          background: transparent !important;
          border: none !important;
          padding: 0 !important;
          font-weight: 600 !important;
          color: #1e293b !important;
          font-size: 0.84rem !important;
        }

        .max-marks-badge {
          background: #f8fafc !important;
          border: 1px solid #94a3b8 !important;
          color: #0f172a !important;
          font-weight: 700 !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
          font-size: 0.82rem !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .date-cell {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;

          .date-text {
            font-weight: 600 !important;
            color: #0f172a !important;
            font-size: 0.82rem !important;
          }
          .time-badge {
            background: transparent !important;
            color: #475569 !important;
            border: 1px solid #cbd5e1 !important;
            font-size: 0.75rem !important;
            padding: 1px 5px !important;
            border-radius: 3px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      }

      /* Print Footer Signatures */
      .print-schedule-footer {
        display: flex !important;
        justify-content: space-between !important;
        margin-top: 48px !important;
        padding-top: 10px !important;

        .print-sig-col {
          width: 170px;
          text-align: center;
        }

        .sig-line {
          border-top: 1.5px solid #475569;
          padding-top: 6px;
          font-size: 0.76rem;
          font-weight: 700;
          color: #1e293b;
          text-transform: uppercase;
        }
      }

      /* Award Sheet Modal Print Overrides */
      .custom-modal-backdrop {
        position: static !important;
        width: 100% !important;
        height: auto !important;
        background: transparent !important;
        padding: 0 !important;
        display: block !important;
        box-shadow: none !important;
      }
      .award-sheet-dialog {
        max-width: 100% !important;
        width: 100% !important;
        box-shadow: none !important;
        border: none !important;
        background: transparent !important;
      }
      .award-sheet-scrollable {
        max-height: none !important;
        overflow: visible !important;
        padding: 0 !important;
        background: transparent !important;
      }
      .award-sheet-paper {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        width: 100% !important;
      }
    }
  `]
})
export class TestsComponent implements OnInit {
  // Tests List
  tests: any[] = [];
  batches: any[] = [];
  allSubjects: SubjectDto[] = [];

  // License & Module helpers
  get hasSchool(): boolean {
    return this.authService.hasSchoolModule();
  }

  get hasCoaching(): boolean {
    return this.authService.hasCoachingModule();
  }

  get isHybridInstitute(): boolean {
    return this.hasSchool && this.hasCoaching;
  }

  // Category filter: 'all' | 'school' | 'coaching'
  selectedCategory: 'all' | 'school' | 'coaching' = 'all';

  // School Classes & Sections state
  schoolClasses: SchoolClassDto[] = [];
  selectedClassFilter = '';
  selectedSectionFilter = '';
  sectionsForFilterClass: SchoolSectionDto[] = [];

  // Bulk planner category: 'school' | 'coaching'
  plannerCategory: 'school' | 'coaching' = 'school';
  showBulkPlanner = false;
  sharedBatchId = '';
  sharedClassId = '';
  sharedSectionId = '';
  sectionsForSharedClass: SchoolSectionDto[] = [];

  // Class-specific subject cache: classId -> SubjectDto[]
  classSubjectsCache = new Map<string, SubjectDto[]>();

  bulkForm: FormGroup;
  saving = false;
  subjectSearchTexts: string[] = [];
  filteredSubjectsPerRow: SubjectDto[][] = [];

  // Marks entry state
  selectedTest: any = null;
  marksGrid: any[] = [];
  marksColumns = ['index', 'rollNumber', 'studentName', 'marksObtained', 'isAbsent', 'remarks'];
  marksLoading = false;
  notifyParents = true;
  savingMarks = false;

  // Evaluator Teacher & Copy Bundle Tracking State
  showBundleModal = false;
  bundleTest: any = null;
  bundleForm: FormGroup;
  savingBundle = false;
  teachersList: any[] = [];
  filteredTeachers: any[] = [];
  teacherSearchText = '';
  schoolRoutines: SectionPeriodRoutineDto[] = [];
  autoSuggestReason = '';

  // Principal Final Approval Modal State
  showApprovalModal = false;
  approvalTest: any = null;
  approvalRemarks = 'Verified and approved for official publication.';
  approvingMarks = false;

  // Award Sheet Marking Foil State
  showAwardSheetModal = false;
  awardSheetData: any = null;
  loadingAwardSheet = false;

  // Grid state
  pageIndex = 0;
  pageSize = 10;
  totalCount = 0;
  searchTerm = '';
  selectedBatchFilter = '';
  sortBy = 'testDate';
  sortDescending = true;
  loading = false;

  displayedColumns = ['title', 'batchName', 'subject', 'maxMarks', 'testDate', 'actions'];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private coachingService: CoachingService,
    private schoolService: SchoolService,
    private confirmDialog: ConfirmDialogService,
    private subjectsService: SubjectsService,
    private fb: FormBuilder,
    private dialog: MatDialog,
    public authService: AuthService
  ) {
    this.bulkForm = this.fb.group({ exams: this.fb.array([]) });
    this.bundleForm = this.fb.group({
      evaluatorTeacherId: ['', Validators.required],
      totalCopiesIssued: [0, [Validators.required, Validators.min(1)]],
      evaluationDueDate: [''],
      evaluationStatus: ['Evaluating', Validators.required],
      copiesSubmittedDate: [''],
      evaluationRemarks: ['']
    });

    this.bundleForm.get('evaluationStatus')?.valueChanges.subscribe(status => {
      if (status === 'CopiesReturned' && !this.bundleForm.get('copiesSubmittedDate')?.value) {
        const todayIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
        this.bundleForm.patchValue({ copiesSubmittedDate: todayIst });
      }
    });
  }

  get isUserAdmin(): boolean {
    return this.authService.isAdmin();
  }

  currentTeacherId: string | null = null;

  get isTeacher(): boolean {
    return this.authService.isTeacher();
  }

  loadCurrentTeacher(): void {
    if (this.isTeacher) {
      this.coachingService.getMyTeacherProfile().subscribe({
        next: res => {
          if (res && res.teacherId) {
            this.currentTeacherId = res.teacherId;
          }
        },
        error: err => console.error('Error loading teacher profile:', err)
      });
    }
  }

  isMyBundle(test: any): boolean {
    if (!test) return false;
    if (this.isUserAdmin) return true;
    if (this.currentTeacherId && test.evaluatorTeacherId) {
      if (test.evaluatorTeacherId.toLowerCase() === this.currentTeacherId.toLowerCase()) {
        return true;
      }
    }
    const currentName = this.authService.currentUser()?.fullName?.toLowerCase()?.trim();
    if (currentName && test.evaluatorTeacherName) {
      if (test.evaluatorTeacherName.toLowerCase().trim() === currentName) {
        return true;
      }
    }
    return false;
  }

  canEnterMarks(test: any): boolean {
    if (!test) return false;
    if (this.isUserAdmin) return true;
    return this.isMyBundle(test) && !!test.evaluatorTeacherId;
  }

  canViewResults(test: any): boolean {
    if (!test) return false;
    return !!(test.isMarksLocked || test.evaluationStatus === 'ApprovedAndLocked' || test.evaluationStatus === 'MarksLocked');
  }

  get instituteName(): string {
    return this.authService.currentUser()?.instituteName || 'Institute Examination Cell';
  }

  get todayDate(): Date {
    return new Date();
  }

  get activeBatchName(): string {
    if (this.selectedCategory === 'school') {
      if (!this.selectedClassFilter) return 'All School Classes';
      const c = this.schoolClasses.find(x => x.id === this.selectedClassFilter);
      return c ? c.name : 'School Class';
    }
    if (!this.selectedBatchFilter) return 'All Batches';
    const b = this.batches.find(x => x.id === this.selectedBatchFilter);
    return b ? b.name : 'All Batches';
  }

  printSchedule(): void {
    window.print();
  }

  openAdmitCards(test: any): void {
    this.dialog.open(ExamAdmitCardDialogComponent, {
      width: '1280px',
      maxWidth: '96vw',
      maxHeight: '94vh',
      panelClass: 'admit-card-dialog-panel',
      data: {
        testId: test.id,
        testTitle: test.title
      }
    });
  }

  openResults(test: any): void {
    this.dialog.open(ExamResultDialogComponent, {
      width: '1240px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      panelClass: 'result-dialog-panel',
      data: {
        testId: test.id,
        testTitle: test.title,
        subject: test.subject,
        maxMarks: test.maxMarks,
        batchName: test.className ? `${test.className}${test.sectionName ? ' (' + test.sectionName + ')' : ''}` : test.batchName,
        testDate: test.testDate
      }
    });
  }

  get examRows(): AbstractControl[] {
    return (this.bulkForm.get('exams') as FormArray).controls;
  }

  private get examsArray(): FormArray {
    return this.bulkForm.get('exams') as FormArray;
  }

  private buildRow(batchId = '', classId = '', sectionId = ''): FormGroup {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const isSchool = this.plannerCategory === 'school';
    return this.fb.group({
      batchId: [batchId, isSchool ? [] : [Validators.required]],
      classId: [classId, isSchool ? [Validators.required] : []],
      sectionId: [sectionId],
      subject: ['', Validators.required],
      title: ['', Validators.required],
      examDate: [today, Validators.required],
      examTime: ['09:00'],
      maxMarks: [50, [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
    if (this.hasSchool && !this.hasCoaching) {
      this.selectedCategory = 'school';
      this.plannerCategory = 'school';
    } else if (!this.hasSchool && this.hasCoaching) {
      this.selectedCategory = 'coaching';
      this.plannerCategory = 'coaching';
    } else {
      this.selectedCategory = 'all';
      this.plannerCategory = 'school';
    }

    this.loadCurrentTeacher();
    if (this.hasCoaching) {
      this.loadBatches();
    }
    if (this.hasSchool) {
      this.loadSchoolClasses();
      this.loadSchoolRoutines();
    }
    this.loadTests();
    this.loadSubjects();
    this.loadTeachers();
  }

  loadTeachers(): void {
    this.coachingService.getTeachers().subscribe({
      next: list => {
        this.teachersList = list || [];
        this.filteredTeachers = [...this.teachersList];
      },
      error: err => console.error('Error loading teachers:', err)
    });
  }

  loadBatches(): void {
    this.coachingService.getBatches().subscribe({
      next: b => this.batches = b,
      error: err => console.error(err)
    });
  }

  loadSchoolClasses(): void {
    this.schoolService.getClasses(true).subscribe({
      next: list => { this.schoolClasses = list || []; },
      error: err => console.error('Error loading school classes:', err)
    });
  }

  loadSubjects(): void {
    this.subjectsService.getSubjects(true).subscribe({
      next: list => { this.allSubjects = list; },
      error: err => console.error(err)
    });
  }

  // ─── Filter Helpers ───────────────────────────
  setCategoryFilter(cat: 'all' | 'school' | 'coaching'): void {
    this.selectedCategory = cat;
    if (cat === 'school') {
      this.selectedBatchFilter = '';
    } else if (cat === 'coaching') {
      this.selectedClassFilter = '';
      this.selectedSectionFilter = '';
      this.sectionsForFilterClass = [];
    }
    this.pageIndex = 0;
    this.loadTests();
  }

  onClassFilterChange(): void {
    this.selectedSectionFilter = '';
    if (this.selectedClassFilter) {
      const cls = this.schoolClasses.find(c => c.id === this.selectedClassFilter);
      this.sectionsForFilterClass = cls?.sections || [];
    } else {
      this.sectionsForFilterClass = [];
    }
    this.pageIndex = 0;
    this.loadTests();
  }

  onFilterChange(): void {
    this.pageIndex = 0;
    this.loadTests();
  }

  // ─── Bulk Planner ──────────────────────────────
  setPlannerCategory(cat: 'school' | 'coaching'): void {
    if (this.plannerCategory === cat) return;
    this.plannerCategory = cat;
    this.examsArray.controls.forEach(row => {
      if (cat === 'school') {
        row.get('classId')?.setValidators(Validators.required);
        row.get('classId')?.updateValueAndValidity();
        row.get('batchId')?.clearValidators();
        row.get('batchId')?.setValue('');
        row.get('batchId')?.updateValueAndValidity();
      } else {
        row.get('batchId')?.setValidators(Validators.required);
        row.get('batchId')?.updateValueAndValidity();
        row.get('classId')?.clearValidators();
        row.get('classId')?.setValue('');
        row.get('classId')?.updateValueAndValidity();
        row.get('sectionId')?.setValue('');
      }
    });
  }

  toggleBulkPlanner(): void {
    this.showBulkPlanner = !this.showBulkPlanner;
    if (this.showBulkPlanner) {
      this.examsArray.clear();
      this.subjectSearchTexts = [];
      this.filteredSubjectsPerRow = [];
      this.sharedBatchId = '';
      this.sharedClassId = '';
      this.sharedSectionId = '';
      this.sectionsForSharedClass = [];
      this.addRow();
    }
  }

  addRow(): void {
    const row = this.buildRow(
      this.plannerCategory === 'coaching' ? this.sharedBatchId : '',
      this.plannerCategory === 'school' ? this.sharedClassId : '',
      this.plannerCategory === 'school' ? this.sharedSectionId : ''
    );
    const rowIndex = this.examsArray.length;
    this.examsArray.push(row);
    this.subjectSearchTexts.push('');
    this.filteredSubjectsPerRow.push([...this.allSubjects]);

    if (this.plannerCategory === 'school' && this.sharedClassId) {
      this.loadSubjectsForClassRow(rowIndex, this.sharedClassId);
    }
  }

  removeRow(i: number): void {
    if (this.examsArray.length <= 1) return;
    this.examsArray.removeAt(i);
    this.subjectSearchTexts.splice(i, 1);
    this.filteredSubjectsPerRow.splice(i, 1);
  }

  applyBatchToAll(): void {
    this.examsArray.controls.forEach(ctrl => {
      ctrl.get('batchId')?.setValue(this.sharedBatchId);
    });
  }

  onSharedClassChange(): void {
    this.sharedSectionId = '';
    if (this.sharedClassId) {
      const cls = this.schoolClasses.find(c => c.id === this.sharedClassId);
      this.sectionsForSharedClass = cls?.sections || [];
    } else {
      this.sectionsForSharedClass = [];
    }
    this.examsArray.controls.forEach((ctrl, idx) => {
      ctrl.get('classId')?.setValue(this.sharedClassId);
      ctrl.get('sectionId')?.setValue('');
      if (this.sharedClassId) {
        this.loadSubjectsForClassRow(idx, this.sharedClassId);
      }
    });
  }

  applySharedSectionToAll(): void {
    this.examsArray.controls.forEach(ctrl => {
      ctrl.get('sectionId')?.setValue(this.sharedSectionId);
    });
  }

  sectionsForRow(i: number): SchoolSectionDto[] {
    const classId = this.examRows[i]?.get('classId')?.value;
    if (!classId) return [];
    const cls = this.schoolClasses.find(c => c.id === classId);
    return cls?.sections || [];
  }

  onRowClassChange(i: number): void {
    const row = this.examRows[i];
    row.get('sectionId')?.setValue('');
    const classId = row.get('classId')?.value;
    if (classId) {
      this.loadSubjectsForClassRow(i, classId);
    } else {
      this.filteredSubjectsPerRow[i] = [...this.allSubjects];
    }
  }

  loadSubjectsForClassRow(i: number, classId: string): void {
    if (this.classSubjectsCache.has(classId)) {
      const cached = this.classSubjectsCache.get(classId)!;
      this.filteredSubjectsPerRow[i] = cached.length > 0 ? cached : [...this.allSubjects];
      return;
    }

    this.subjectsService.getClassSubjects(classId).subscribe({
      next: (classSubs) => {
        if (classSubs && classSubs.length > 0) {
          const mapped: SubjectDto[] = classSubs.map(cs => ({
            id: cs.subjectId,
            name: cs.subjectName,
            code: cs.subjectCode,
            isActive: true,
            createdAt: cs.createdAt
          }));
          this.classSubjectsCache.set(classId, mapped);
          this.filteredSubjectsPerRow[i] = mapped;
        } else {
          this.classSubjectsCache.set(classId, [...this.allSubjects]);
          this.filteredSubjectsPerRow[i] = [...this.allSubjects];
        }
      },
      error: () => {
        this.filteredSubjectsPerRow[i] = [...this.allSubjects];
      }
    });
  }

  filterSubjectsForRow(i: number, event: Event): void {
    const term = (event.target as HTMLInputElement).value?.toLowerCase() ?? '';
    this.subjectSearchTexts[i] = term;
    const baseList = (this.plannerCategory === 'school' && this.examRows[i]?.get('classId')?.value)
      ? (this.classSubjectsCache.get(this.examRows[i].get('classId')?.value) || this.allSubjects)
      : this.allSubjects;

    if (!term.trim()) {
      this.filteredSubjectsPerRow[i] = [...baseList];
      return;
    }
    this.filteredSubjectsPerRow[i] = baseList.filter(
      s => (s.name && s.name.toLowerCase().includes(term)) ||
           (s.code && s.code.toLowerCase().includes(term))
    );
  }

  clearSubjectSearch(i: number, event: Event): void {
    event.stopPropagation();
    this.subjectSearchTexts[i] = '';
    const baseList = (this.plannerCategory === 'school' && this.examRows[i]?.get('classId')?.value)
      ? (this.classSubjectsCache.get(this.examRows[i].get('classId')?.value) || this.allSubjects)
      : this.allSubjects;
    this.filteredSubjectsPerRow[i] = [...baseList];
  }

  onSubjectSelectOpened(i: number, isOpen: boolean): void {
    if (isOpen) {
      setTimeout(() => {
        const inputEl = document.querySelector(`.smart-subject-panel .select-search-input`) as HTMLInputElement;
        if (inputEl) inputEl.focus();
      }, 100);
    } else {
      this.subjectSearchTexts[i] = '';
      const baseList = (this.plannerCategory === 'school' && this.examRows[i]?.get('classId')?.value)
        ? (this.classSubjectsCache.get(this.examRows[i].get('classId')?.value) || this.allSubjects)
        : this.allSubjects;
      this.filteredSubjectsPerRow[i] = [...baseList];
    }
  }

  saveBulkPlanner(): void {
    this.examsArray.controls.forEach(c => c.markAllAsTouched());

    if (this.bulkForm.invalid) {
      const targetLabel = this.plannerCategory === 'school' ? 'Class' : 'Batch';
      this.confirmDialog.alert('Validation Error', `Please fill in all required fields (${targetLabel}, Subject, Title, Date) for every row.`, 'warning');
      return;
    }

    const payload = this.examsArray.controls.map(row => {
      const v = row.value;
      const dateStr = v.examDate;
      const timeStr = v.examTime || '09:00';
      let isoDate: string;
      try {
        if (dateStr) {
          const combined = new Date(`${dateStr}T${timeStr}:00+05:30`);
          isoDate = !isNaN(combined.getTime()) ? combined.toISOString() : new Date().toISOString();
        } else {
          isoDate = new Date().toISOString();
        }
      } catch {
        isoDate = new Date().toISOString();
      }

      return {
        batchId: this.plannerCategory === 'coaching' ? (v.batchId || null) : null,
        classId: this.plannerCategory === 'school' ? (v.classId || null) : null,
        sectionId: this.plannerCategory === 'school' ? (v.sectionId || null) : null,
        subject: v.subject,
        title: v.title,
        maxMarks: Number(v.maxMarks),
        testDate: isoDate
      };
    });

    const categoryTitle = this.plannerCategory === 'school' ? 'School Class Exam' : 'Coaching Batch Test';
    this.confirmDialog.confirm(
      `Schedule ${categoryTitle} Session`,
      `Schedule ${payload.length} exam${payload.length !== 1 ? 's' : ''}? They will appear in the Tests grid immediately.`,
      `Schedule All ${payload.length}`,
      'Cancel',
      'success'
    ).subscribe(confirmed => {
      if (!confirmed) return;
      this.saving = true;

      this.coachingService.createBulkTests(payload).subscribe({
        next: (results: any[]) => {
          this.saving = false;
          this.showBulkPlanner = false;
          this.pageIndex = 0;
          this.loadTests();
          this.confirmDialog.alert(
            '🎉 Exams Scheduled!',
            `${results.length} exam${results.length !== 1 ? 's' : ''} successfully scheduled. Students can now be evaluated.`,
            'success'
          );
        },
        error: err => {
          this.saving = false;
          this.confirmDialog.alert('Error', err?.error?.message || err?.error?.detail || 'Failed to schedule exams.', 'danger');
        }
      });
    });
  }

  // ─── Tests Grid ────────────────────────────────
  loadTests(): void {
    this.loading = true;
    this.coachingService.getTestsPaged(
      this.pageIndex + 1,
      this.pageSize,
      this.searchTerm,
      this.selectedBatchFilter || undefined,
      this.sortBy,
      this.sortDescending,
      this.selectedClassFilter || undefined,
      this.selectedSectionFilter || undefined,
      this.selectedCategory
    ).subscribe({
      next: result => { this.tests = result.items; this.totalCount = result.totalCount; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  onSearch(): void { this.pageIndex = 0; this.loadTests(); }

  onSortChange(s: Sort): void {
    this.sortBy = s.active || 'testDate';
    this.sortDescending = s.direction === 'desc';
    this.pageIndex = 0;
    this.loadTests();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadTests();
  }

  // ─── Marks Entry ───────────────────────────────
  openMarksGrid(test: any): void {
    if (!this.canEnterMarks(test)) {
      this.confirmDialog.alert(
        'Access Restricted 🔒',
        !test.evaluatorTeacherId
          ? 'Physical answer sheet bundle has not yet been assigned to any teacher by the Admin / Exam Cell.'
          : `This exam bundle is assigned to ${test.evaluatorTeacherName || 'another evaluator'}. You cannot enter marks.`,
        'warning'
      );
      return;
    }
    this.selectedTest = test;
    this.marksLoading = true;
    this.marksGrid = [];

    // Load batch or class students and existing marks in parallel
    forkJoin({
      students: this.coachingService.getStudents(test.batchId, test.classId, test.sectionId),
      existingMarks: this.coachingService.getTestMarks(test.id)
    }).subscribe({
      next: ({ students, existingMarks }) => {
        this.marksLoading = false;
        const marksMap = new Map<string, any>();
        (existingMarks || []).forEach((m: any) => {
          marksMap.set(m.studentId?.toLowerCase(), m);
        });

        this.marksGrid = (students || []).map((s: any) => {
          const existing = marksMap.get(s.id?.toLowerCase());
          return {
            studentId: s.id,
            studentName: s.studentName,
            rollNumber: s.rollNumber,
            marksObtained: existing ? existing.marksObtained : 0,
            isAbsent: existing ? existing.isAbsent : false,
            remarks: existing ? (existing.remarks || '') : ''
          };
        });
      },
      error: () => {
        this.marksLoading = false;
        this.confirmDialog.alert('Error', 'Failed to load students and marks.', 'danger');
      }
    });
  }

  onAbsentToggle(item: any): void {
    if (item.isAbsent) item.marksObtained = 0;
  }

  // ─── Evaluation Workflow & Status Helpers ───────────────────
  getWorkflowStatusInfo(test: any): { label: string; class: string; icon: string } {
    if (!test) return { label: 'Scheduled', class: 'badge-scheduled', icon: 'event' };
    if (test.isMarksLocked || test.evaluationStatus === 'ApprovedAndLocked' || test.evaluationStatus === 'MarksLocked') {
      return { label: 'Approved & Locked 🔒', class: 'badge-locked', icon: 'verified' };
    }
    switch (test.evaluationStatus) {
      case 'Evaluating':
      case 'CopiesUnderEvaluation':
        return { label: `Evaluating (${test.evaluatorTeacherName || 'Teacher'})`, class: 'badge-evaluating', icon: 'pending' };
      case 'CopiesReturned':
      case 'EvaluationCompleted':
        return { label: 'Copies Returned', class: 'badge-returned', icon: 'assignment_turned_in' };
      case 'MarksEntered':
        return { label: 'Marks Drafted', class: 'badge-entered', icon: 'edit_note' };
      case 'SubmittedForApproval':
        return { label: 'Pending Principal Approval', class: 'badge-submitted', icon: 'hourglass_top' };
      case 'RevisionRequested':
      case 'NeedsRevision':
        return { label: 'Revision Requested', class: 'badge-revision', icon: 'error_outline' };
      case 'Scheduled':
        return {
          label: test.evaluatorTeacherName ? `Bundle Scheduled (${test.evaluatorTeacherName})` : 'Exam Scheduled',
          class: 'badge-scheduled',
          icon: 'event'
        };
      default:
        return { label: 'Exam Scheduled', class: 'badge-scheduled', icon: 'event' };
    }
  }

  // ─── Modal 1: Copy Bundle Handover Tracking ─────────────────
  openBundleModal(test: any): void {
    this.bundleTest = test;
    this.teacherSearchText = '';
    this.filteredTeachers = [...this.teachersList];

    // Base date for default evaluation due date: must NOT be earlier than exam date
    let baseDate = new Date();
    if (test.testDate) {
      const examDate = new Date(test.testDate);
      if (!isNaN(examDate.getTime()) && examDate > baseDate) {
        baseDate = examDate;
      }
    }
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 3);
    const defaultDue = d.toISOString().split('T')[0];

    // Ensure teacher id matches case-insensitively with teachersList item id, or auto-detect
    let matchedTeacherId = '';
    this.autoSuggestReason = '';
    if (test.evaluatorTeacherId) {
      const match = this.teachersList.find(
        t => (t.id || '').toLowerCase() === (test.evaluatorTeacherId || '').toLowerCase()
      );
      matchedTeacherId = match ? match.id : test.evaluatorTeacherId;
    } else {
      const detected = this.autoDetectEvaluatorTeacherId(test);
      if (detected.teacherId) {
        matchedTeacherId = detected.teacherId;
        this.autoSuggestReason = detected.reason;
      }
    }

    // Fallback: If routines were not yet loaded, load and re-detect
    if (!matchedTeacherId && test.classId && (!this.schoolRoutines || this.schoolRoutines.length === 0)) {
      this.schoolService.getAllSectionRoutines().subscribe({
        next: routines => {
          this.schoolRoutines = routines || [];
          if (!this.bundleForm.get('evaluatorTeacherId')?.value) {
            const reDetected = this.autoDetectEvaluatorTeacherId(test);
            if (reDetected.teacherId) {
              this.autoSuggestReason = reDetected.reason;
              this.bundleForm.patchValue({ evaluatorTeacherId: reDetected.teacherId });
            }
          }
        }
      });
    }

    const suggestedCopies = test.totalCopiesIssued ?? (test.studentCount || (test.totalStudentsEvaluated > 0 ? test.totalStudentsEvaluated : null));

    let mappedStatus = test.evaluationStatus || 'Scheduled';
    if (mappedStatus === 'CopiesUnderEvaluation') mappedStatus = 'Evaluating';
    if (mappedStatus === 'EvaluationCompleted') mappedStatus = 'CopiesReturned';

    this.bundleForm.patchValue({
      evaluatorTeacherId: matchedTeacherId,
      totalCopiesIssued: suggestedCopies,
      evaluationDueDate: test.evaluationDueDate ? new Date(test.evaluationDueDate).toISOString().split('T')[0] : defaultDue,
      evaluationStatus: mappedStatus,
      copiesSubmittedDate: test.copiesSubmittedDate ? new Date(test.copiesSubmittedDate).toISOString().split('T')[0] : '',
      evaluationRemarks: test.evaluationRemarks || ''
    });
    this.showBundleModal = true;
  }

  loadSchoolRoutines(): void {
    this.schoolService.getAllSectionRoutines().subscribe({
      next: routines => {
        this.schoolRoutines = routines || [];
      },
      error: err => console.error('Error loading school routines:', err)
    });
  }

  autoDetectEvaluatorTeacherId(test: any): { teacherId: string; reason: string } {
    if (!test) return { teacherId: '', reason: '' };

    // 1. If test already has evaluator assigned, preserve it
    if (test.evaluatorTeacherId) {
      const match = this.teachersList.find(
        t => (t.id || '').toLowerCase() === (test.evaluatorTeacherId || '').toLowerCase()
      );
      if (match) {
        return { teacherId: match.id, reason: 'Assigned Evaluator' };
      }
    }

    // 2. School Mode:
    if (test.classId) {
      const cleanSub = (test.subject || '').trim().toLowerCase();

      // 2a. Section + Subject Routine Match
      if (cleanSub && this.schoolRoutines && this.schoolRoutines.length > 0) {
        if (test.sectionId) {
          const secRoutine = this.schoolRoutines.find(r =>
            (r.sectionId || '').toLowerCase() === (test.sectionId || '').toLowerCase() &&
            (r.subject || '').trim().toLowerCase() === cleanSub
          );
          if (secRoutine && secRoutine.teacherId) {
            const t = this.teachersList.find(x => (x.id || '').toLowerCase() === (secRoutine.teacherId || '').toLowerCase());
            if (t) return { teacherId: t.id, reason: `Subject Faculty for ${test.sectionName || 'Section'} (${test.subject})` };
          }
        }

        // Class + Subject Routine Match (exact or substring)
        const classRoutine = this.schoolRoutines.find(r =>
          (r.classId || '').toLowerCase() === (test.classId || '').toLowerCase() &&
          (
            (r.subject || '').trim().toLowerCase() === cleanSub ||
            cleanSub.includes((r.subject || '').trim().toLowerCase()) ||
            (r.subject || '').trim().toLowerCase().includes(cleanSub)
          )
        );
        if (classRoutine && classRoutine.teacherId) {
          const t = this.teachersList.find(x => (x.id || '').toLowerCase() === (classRoutine.teacherId || '').toLowerCase());
          if (t) return { teacherId: t.id, reason: `Subject Faculty for Class (${test.subject})` };
        }
      }

      // 2b. Designated Class Teacher of Section or Class
      const cls = this.schoolClasses?.find(c => (c.id || '').toLowerCase() === (test.classId || '').toLowerCase());
      if (cls && cls.sections && cls.sections.length > 0) {
        let targetSection = test.sectionId
          ? cls.sections.find(s => (s.id || '').toLowerCase() === (test.sectionId || '').toLowerCase())
          : cls.sections.find(s => !!s.classTeacherId) || cls.sections[0];

        if (targetSection?.classTeacherId) {
          const t = this.teachersList.find(x => (x.id || '').toLowerCase() === (targetSection.classTeacherId || '').toLowerCase());
          if (t) return { teacherId: t.id, reason: `Class Teacher of ${cls.name}${targetSection.name ? ' (' + targetSection.name + ')' : ''}` };
        }
      }
    }

    // 3. Coaching Mode:
    if (test.batchId) {
      const batch = this.batches?.find(b => (b.id || '').toLowerCase() === (test.batchId || '').toLowerCase());
      const bTeacherId = batch?.teacherId || batch?.facultyId || batch?.trainerId;
      if (bTeacherId) {
        const t = this.teachersList.find(x => (x.id || '').toLowerCase() === (bTeacherId || '').toLowerCase());
        if (t) return { teacherId: t.id, reason: `Designated Batch Faculty (${batch.name || 'Batch'})` };
      }
    }

    // 4. Specialization or Department Match across Teachers List
    if (test.subject && this.teachersList && this.teachersList.length > 0) {
      const cleanSub = (test.subject || '').trim().toLowerCase();
      const specMatch = this.teachersList.find(t => {
        const spec = (t.specialization || '').toLowerCase();
        const dept = (t.department || '').toLowerCase();
        return (spec && (cleanSub.includes(spec) || spec.includes(cleanSub))) ||
               (dept && (cleanSub.includes(dept) || dept.includes(cleanSub)));
      });
      if (specMatch) {
        return { teacherId: specMatch.id, reason: `Subject Specialist (${specMatch.specialization || specMatch.department})` };
      }
    }

    return { teacherId: '', reason: '' };
  }

  filterTeachers(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.teacherSearchText = input.value || '';
    const query = this.teacherSearchText.trim().toLowerCase();
    if (!query) {
      this.filteredTeachers = [...this.teachersList];
      return;
    }
    this.filteredTeachers = this.teachersList.filter(t => {
      const name = (t.fullName || t.name || '').toLowerCase();
      const code = (t.employeeCode || '').toLowerCase();
      const phone = (t.phoneNumber || '').toLowerCase();
      const spec = (t.specialization || '').toLowerCase();
      const dept = (t.department || '').toLowerCase();
      const desig = (t.designation || '').toLowerCase();
      return name.includes(query) || code.includes(query) || phone.includes(query) ||
             spec.includes(query) || dept.includes(query) || desig.includes(query);
    });
  }

  clearTeacherSearch(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.teacherSearchText = '';
    this.filteredTeachers = [...this.teachersList];
  }

  onTeacherSelectOpened(isOpen: boolean): void {
    if (isOpen) {
      this.teacherSearchText = '';
      this.filteredTeachers = [...this.teachersList];
      setTimeout(() => {
        const el = document.querySelector('.smart-teacher-panel .select-search-input') as HTMLInputElement;
        if (el) el.focus();
      }, 100);
    }
  }

  getSelectedTeacher(teacherId: string): any {
    if (!teacherId || !this.teachersList) return null;
    const tid = teacherId.toLowerCase();
    return this.teachersList.find(t => (t.id || '').toLowerCase() === tid) || null;
  }

  getSelectedTeacherName(teacherId: string): string {
    const tch = this.getSelectedTeacher(teacherId);
    return tch ? (tch.fullName || tch.name || 'Teacher') : '';
  }

  getSelectedTeacherCode(teacherId: string): string {
    const tch = this.getSelectedTeacher(teacherId);
    return tch?.employeeCode || '';
  }

  getSelectedTeacherPhone(teacherId: string): string {
    const tch = this.getSelectedTeacher(teacherId);
    return tch?.phoneNumber || '';
  }

  closeBundleModal(): void {
    this.showBundleModal = false;
    this.bundleTest = null;
  }

  saveBundleAssignment(): void {
    if (!this.bundleTest || this.bundleForm.invalid) return;
    const v = this.bundleForm.value;
    this.savingBundle = true;

    const payload = {
      evaluatorTeacherId: v.evaluatorTeacherId,
      evaluationStatus: v.evaluationStatus,
      evaluationDueDate: v.evaluationDueDate ? new Date(v.evaluationDueDate + 'T18:00:00+05:30').toISOString() : null,
      totalCopiesIssued: Number(v.totalCopiesIssued),
      copiesSubmittedDate: v.copiesSubmittedDate ? new Date(v.copiesSubmittedDate + 'T18:00:00+05:30').toISOString() : null,
      evaluationRemarks: v.evaluationRemarks
    };

    this.coachingService.updateTestEvaluationWorkflow(this.bundleTest.id, payload).subscribe({
      next: () => {
        this.savingBundle = false;
        this.closeBundleModal();
        this.loadTests();
        this.confirmDialog.alert('Bundle Assigned! 📦', 'Physical copy bundle and evaluator teacher workflow updated successfully.', 'success');
      },
      error: err => {
        this.savingBundle = false;
        this.confirmDialog.alert('Error', err?.error?.message || 'Failed to update bundle assignment.', 'danger');
      }
    });
  }

  // ─── Modal 2: Principal Approval & Seal ─────────────────────
  openApprovalModal(test: any): void {
    this.approvalTest = test;
    this.approvalRemarks = 'Verified and approved for official publication.';
    this.showApprovalModal = true;
  }

  closeApprovalModal(): void {
    this.showApprovalModal = false;
    this.approvalTest = null;
  }

  confirmApproveAndLock(): void {
    if (!this.approvalTest) return;
    this.confirmDialog.confirm(
      'Approve & Freeze Marks 🔒',
      `Officially approve results for "${this.approvalTest.title}"? Once locked, teacher marks editing is frozen and official results are published.`,
      'Approve & Lock',
      'Cancel',
      'success'
    ).subscribe(ok => {
      if (!ok) return;
      this.approvingMarks = true;
      this.coachingService.approveAndLockTestMarks(this.approvalTest.id, this.approvalRemarks).subscribe({
        next: () => {
          this.approvingMarks = false;
          this.closeApprovalModal();
          this.selectedTest = null;
          this.loadTests();
          this.confirmDialog.alert('Approved & Locked! 🏆', 'Test marks have been officially approved by Principal/Admin and locked against edits.', 'success');
        },
        error: err => {
          this.approvingMarks = false;
          this.confirmDialog.alert('Error', err?.error?.message || 'Failed to approve marks.', 'danger');
        }
      });
    });
  }

  rejectForRevisionDirect(test: any): void {
    this.approvalTest = test;
    this.promptRejectRevision();
  }

  promptRejectRevision(): void {
    if (!this.approvalTest) return;
    this.confirmDialog.prompt(
      'Send Back for Revision ⚠️',
      `Specify the corrections and revision remarks required for faculty <strong>${this.approvalTest.evaluatorTeacherName || 'Evaluator'}</strong>:`,
      {
        inputLabel: 'Revision Remarks / Corrections Required *',
        inputPlaceholder: 'e.g. Please re-check question 4 marking scheme for roll number 3 and 7',
        confirmText: 'Send for Revision',
        cancelText: 'Cancel',
        type: 'warning',
        inputType: 'textarea'
      }
    ).subscribe(reason => {
      if (!reason || !reason.trim()) return;

      this.approvingMarks = true;
      this.coachingService.rejectTestMarksForRevision(this.approvalTest.id, reason.trim()).subscribe({
        next: () => {
          this.approvingMarks = false;
          this.closeApprovalModal();
          if (this.selectedTest && this.selectedTest.id === this.approvalTest?.id) {
            this.selectedTest.evaluationStatus = 'RevisionRequested';
            this.selectedTest.isMarksLocked = false;
            this.selectedTest.evaluationRemarks = reason.trim();
          }
          this.loadTests();
          this.confirmDialog.alert('Revision Requested ⚠️', `Marks sent back to evaluator teacher with remarks: "${reason.trim()}".`, 'warning');
        },
        error: err => {
          this.approvingMarks = false;
          this.confirmDialog.alert('Error', err?.error?.message || 'Failed to send back for revision.', 'danger');
        }
      });
    });
  }

  unlockMarks(test: any): void {
    this.confirmDialog.prompt(
      'Admin Authorization: Unlock Marks 🔓',
      `You are unlocking officially approved examination marks for <strong>"${test.title}"</strong>. Please provide an administrative reason for the audit trail:`,
      {
        inputLabel: 'Reason for Unlocking *',
        inputPlaceholder: 'e.g. Correction needed in student marks as per re-evaluation request',
        confirmText: 'Unlock Marks',
        cancelText: 'Cancel',
        type: 'warning',
        inputType: 'textarea'
      }
    ).subscribe(reason => {
      if (!reason || !reason.trim()) return;

      this.coachingService.unlockTestMarks(test.id, reason.trim()).subscribe({
        next: () => {
          this.loadTests();
          if (this.selectedTest?.id === test.id) {
            this.selectedTest.isMarksLocked = false;
            this.selectedTest.evaluationStatus = 'MarksEntered';
          }
          this.confirmDialog.alert('Marks Unlocked 🔓', 'Test marks have been unlocked for corrections.', 'success');
        },
        error: err => {
          this.confirmDialog.alert('Error', err?.error?.message || 'Failed to unlock marks.', 'danger');
        }
      });
    });
  }

  submitForPrincipalApproval(test: any): void {
    this.confirmDialog.confirm(
      'Submit to Principal for Approval 📤',
      `Submit marks of "${test.title}" to the Principal/Administrator for official verification and locking?`,
      'Submit for Approval',
      'Cancel',
      'info'
    ).subscribe(ok => {
      if (!ok) return;
      this.coachingService.submitTestForApproval(test.id).subscribe({
        next: () => {
          this.loadTests();
          if (this.selectedTest?.id === test.id) {
            this.selectedTest.evaluationStatus = 'SubmittedForApproval';
          }
          this.confirmDialog.alert('Submitted Successfully! 📋', 'Marks submitted to Principal/Admin for official approval and locking.', 'success');
        },
        error: err => {
          this.confirmDialog.alert('Error', err?.error?.message || 'Failed to submit marks for approval.', 'danger');
        }
      });
    });
  }

  // ─── Modal 3: Marking Foil / Award Sheet ─────────────────────
  openAwardSheetModal(test: any): void {
    this.awardSheetData = null;
    this.loadingAwardSheet = true;
    this.showAwardSheetModal = true;
    this.coachingService.getTestAwardSheet(test.id).subscribe({
      next: data => {
        this.awardSheetData = data;
        this.loadingAwardSheet = false;
      },
      error: () => {
        this.loadingAwardSheet = false;
        this.confirmDialog.alert('Error', 'Failed to generate marking foil / award sheet.', 'danger');
        this.showAwardSheetModal = false;
      }
    });
  }

  closeAwardSheetModal(): void {
    this.showAwardSheetModal = false;
    this.awardSheetData = null;
  }

  printAwardSheet(): void {
    window.print();
  }

  // ─── Marks Saving (Draft or Submit to Principal) ─────────────
  saveMarks(andSubmit = false): void {
    if (!this.selectedTest) return;

    const overMax = this.marksGrid.some(m => !m.isAbsent && m.marksObtained > this.selectedTest.maxMarks);
    if (overMax) {
      this.confirmDialog.alert('Validation', `Marks cannot exceed maximum (${this.selectedTest.maxMarks}).`, 'warning');
      return;
    }

    const actionTitle = andSubmit ? 'Save & Submit to Principal' : 'Save Marks Draft';
    const actionMsg = andSubmit
      ? `Save marks and immediately submit to Principal/Admin for official verification?`
      : `Save marks draft for ${this.marksGrid.length} students in "${this.selectedTest.title}"${this.notifyParents ? ' and send WhatsApp report cards' : ''}?`;

    this.confirmDialog.confirm(
      actionTitle,
      actionMsg,
      andSubmit ? 'Save & Submit' : 'Save Draft',
      'Cancel',
      'success'
    ).subscribe(confirmed => {
      if (!confirmed) return;
      this.savingMarks = true;
      this.coachingService.saveBulkMarks({
        testId: this.selectedTest.id,
        marksList: this.marksGrid,
        notifyParentsViaWhatsApp: this.notifyParents
      }).subscribe({
        next: () => {
          if (andSubmit) {
            this.coachingService.submitTestForApproval(this.selectedTest.id).subscribe({
              next: () => {
                this.savingMarks = false;
                this.selectedTest = null;
                this.loadTests();
                this.confirmDialog.alert(
                  'Submitted to Principal! 📋',
                  `Marks saved and officially submitted to Principal/Administrator for verification & approval.`,
                  'success'
                );
              },
              error: err => {
                this.savingMarks = false;
                this.selectedTest = null;
                this.loadTests();
                this.confirmDialog.alert('Saved with Warning', 'Marks were saved, but submission notification failed: ' + (err?.error?.message || ''), 'warning');
              }
            });
          } else {
            this.savingMarks = false;
            this.selectedTest = null;
            this.loadTests();
            this.confirmDialog.alert('Marks Saved! 🎉',
              `Marks draft saved for ${this.marksGrid.length} students.${this.notifyParents ? ' WhatsApp report cards dispatched!' : ''}`, 'success');
          }
        },
        error: err => {
          this.savingMarks = false;
          this.confirmDialog.alert('Error', err?.error?.message || 'Failed to save marks.', 'danger');
        }
      });
    });
  }

  deleteTest(test: any): void {
    this.confirmDialog.confirm(
      'Delete Test',
      `Are you sure you want to delete "${test.title}" (${test.subject})? All marks associated with this test will also be deleted.`,
      'Delete Test',
      'Cancel',
      'danger'
    ).subscribe(confirmed => {
      if (!confirmed) return;
      this.loading = true;
      this.coachingService.deleteTest(test.id).subscribe({
        next: () => {
          this.loading = false;
          if (this.selectedTest?.id === test.id) {
            this.selectedTest = null;
          }
          this.loadTests();
          this.confirmDialog.alert('Deleted', `Test "${test.title}" was successfully deleted.`, 'success');
        },
        error: err => {
          this.loading = false;
          this.confirmDialog.alert('Error', err?.error?.message || 'Failed to delete test.', 'danger');
        }
      });
    });
  }
}
