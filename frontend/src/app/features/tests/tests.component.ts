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
import { CoachingService } from '../../core/services/coaching.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { SubjectsService, SubjectDto } from '../../core/services/subjects.service';
import { LocalDatetimePipe } from '../../shared/pipes/local-datetime.pipe';
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
    MatSelectModule, MatCheckboxModule, MatProgressBarModule,
    MatTooltipModule, MatChipsModule, MatDividerModule,
    MatDialogModule, LocalDatetimePipe
  ],
  template: `
    <div class="tests-wrapper">

      <!-- Executive Printable Exam Schedule Header (Only visible on print) -->
      <div class="print-schedule-header print-only">
        <div class="print-brand-box">
          <h1 class="print-inst-name">{{ instituteName }}</h1>
          <h2 class="print-doc-title">EXAMINATION &amp; TEST SCHEDULE TIMETABLE</h2>
          <div class="print-meta-row">
            <span><strong>Generated Date:</strong> {{ todayDate | date:'dd MMM yyyy, hh:mm a' }}</span>
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
          <button mat-raised-button color="primary" class="add-btn" (click)="toggleBulkPlanner()">
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
            <span class="row-count-badge">{{ examRows.length }} Exam{{ examRows.length !== 1 ? 's' : '' }} Planned</span>
          </div>

          <!-- Quick apply batch to all -->
          <div class="shared-batch-row">
            <mat-form-field appearance="outline" class="batch-selector" subscriptSizing="dynamic">
              <mat-label>Default Batch for All Rows</mat-label>
              <mat-select [(ngModel)]="sharedBatchId" (selectionChange)="applyBatchToAll()" panelClass="smart-batch-panel">
                <mat-option value="">-- Choose Batch --</mat-option>
                <mat-option *ngFor="let b of batches" [value]="b.id">{{ b.name }}</mat-option>
              </mat-select>
              <mat-icon matSuffix>group</mat-icon>
            </mat-form-field>
            <span class="batch-tip" *ngIf="sharedBatchId">
              <mat-icon>check_circle</mat-icon> Applied to all empty rows
            </span>
          </div>

          <!-- Dynamic Exam Rows Form -->
          <div [formGroup]="bulkForm" class="planner-grid-wrapper">

            <!-- Desktop / Tablet Column Header -->
            <div class="row-labels">
              <span class="lbl-num">#</span>
              <span>Batch *</span>
              <span>Subject *</span>
              <span>Exam Title *</span>
              <span>Date *</span>
              <span>Time</span>
              <span>Max Marks *</span>
              <span class="text-center">Action</span>
            </div>

            <!-- Form rows -->
            <ng-container formArrayName="exams">
              <div *ngFor="let row of examRows; let i = index"
                   [formGroupName]="i"
                   class="exam-row"
                   [class.exam-row-error]="row.invalid && row.touched">

                <!-- Row number -->
                <div class="cell-num">
                  <span class="row-num">{{ i + 1 }}</span>
                </div>

                <!-- Batch -->
                <div class="cell-batch">
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
                  <h3 class="marks-main-title">Enter Marks: <strong>{{ selectedTest.title }}</strong></h3>
                </div>
              </div>
              <div class="marks-header-right">
                <button mat-stroked-button class="result-btn" (click)="openResults(selectedTest)" matTooltip="View Leaderboard &amp; Student Result Cards">
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
                <mat-chip class="custom-chip chip-batch">
                  <mat-icon matChipAvatar>groups</mat-icon>
                  {{ selectedTest.batchName }}
                </mat-chip>
                <mat-chip class="custom-chip chip-marks">
                  <mat-icon matChipAvatar>military_tech</mat-icon>
                  Max Marks: <strong>{{ selectedTest.maxMarks }}</strong>
                </mat-chip>
                <mat-chip class="custom-chip chip-date" *ngIf="selectedTest.testDate">
                  <mat-icon matChipAvatar>schedule</mat-icon>
                  {{ selectedTest.testDate | localDatetime:'datetime' }}
                </mat-chip>
              </mat-chip-set>
            </div>
          </div>
        </mat-card-header>

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
                             [disabled]="item.isAbsent"
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
                  <mat-checkbox [(ngModel)]="item.isAbsent" color="warn" (change)="onAbsentToggle(item)">
                    <span class="absent-flag" *ngIf="item.isAbsent">ABSENT</span>
                  </mat-checkbox>
                </td>
              </ng-container>

              <!-- Remarks Column -->
              <ng-container matColumnDef="remarks">
                <th mat-header-cell *matHeaderCellDef class="col-remarks text-center">Remarks</th>
                <td mat-cell *matCellDef="let item" class="col-remarks">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="remarks-mat-field">
                    <input matInput [(ngModel)]="item.remarks" placeholder="Optional comments..." class="remarks-input-left">
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
                <mat-checkbox [(ngModel)]="item.isAbsent" color="warn" (change)="onAbsentToggle(item)">
                  <span class="absent-flag" *ngIf="item.isAbsent">ABSENT</span>
                  <span class="absent-hint" *ngIf="!item.isAbsent">Mark Absent</span>
                </mat-checkbox>
              </div>

              <!-- Card Inputs -->
              <div class="student-card-inputs">
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mobile-marks-field">
                  <mat-label>Marks Obtained</mat-label>
                  <input matInput type="number" [(ngModel)]="item.marksObtained"
                         [disabled]="item.isAbsent"
                         [max]="selectedTest.maxMarks" min="0" placeholder="0"
                         [class.over-limit]="!item.isAbsent && item.marksObtained > selectedTest.maxMarks">
                  <span matSuffix class="marks-suffix-tag">/ {{ selectedTest.maxMarks }}</span>
                </mat-form-field>

                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mobile-remarks-field">
                  <mat-label>Remarks (Optional)</mat-label>
                  <input matInput [(ngModel)]="item.remarks" placeholder="Optional comments...">
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
            <div class="whatsapp-dispatch-box">
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
              <button mat-stroked-button (click)="selectedTest = null">Cancel</button>
              <button mat-raised-button color="primary" class="save-marks-btn" (click)="saveMarks()" [disabled]="savingMarks">
                <mat-icon>{{ savingMarks ? 'hourglass_empty' : 'verified' }}</mat-icon>
                {{ savingMarks ? 'Saving...' : 'Save Marks & Dispatch' }}
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
          <mat-form-field appearance="outline" class="search-field" subscriptSizing="dynamic">
            <mat-label>Search Tests / Subject / Batch...</mat-label>
            <input matInput [(ngModel)]="searchTerm" (keyup.enter)="onSearch()" />
            <mat-icon matPrefix>search</mat-icon>
            <button mat-icon-button matSuffix (click)="onSearch()" matTooltip="Search">
              <mat-icon>arrow_forward</mat-icon>
            </button>
          </mat-form-field>

          <mat-form-field appearance="outline" class="batch-filter" subscriptSizing="dynamic">
            <mat-label>Filter by Batch</mat-label>
            <mat-select [(ngModel)]="selectedBatchFilter" (selectionChange)="onFilterChange()">
              <mat-option value="">All Batches</mat-option>
              <mat-option *ngFor="let b of batches" [value]="b.id">{{ b.name }}</mat-option>
            </mat-select>
            <mat-icon matSuffix>filter_list</mat-icon>
          </mat-form-field>
        </div>

        <mat-progress-bar mode="indeterminate" *ngIf="loading" class="grid-loader no-print"></mat-progress-bar>

        <mat-card-content class="table-container">
          <div class="responsive-table-wrap">
            <table mat-table [dataSource]="tests" matSort (matSortChange)="onSortChange($event)" class="full-width">

              <!-- Title Column -->
              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef mat-sort-header="title">Test Title</th>
                <td mat-cell *matCellDef="let t">
                  <div class="test-title-cell">
                    <strong class="title-heading">{{ t.title }}</strong>
                    <span class="marks-count" *ngIf="t.totalStudentsEvaluated > 0">
                      <mat-icon>people</mat-icon> {{ t.totalStudentsEvaluated }} evaluated
                    </span>
                    <span class="marks-count pending-count" *ngIf="!t.totalStudentsEvaluated">
                      <mat-icon>pending_actions</mat-icon> Pending evaluation
                    </span>
                  </div>
                </td>
              </ng-container>

              <!-- Batch Column -->
              <ng-container matColumnDef="batchName">
                <th mat-header-cell *matHeaderCellDef mat-sort-header="batchName">Batch</th>
                <td mat-cell *matCellDef="let t">
                  <span class="batch-name-tag">{{ t.batchName }}</span>
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
                <th mat-header-cell *matHeaderCellDef mat-sort-header="testDate">Exam Date &amp; Time</th>
                <td mat-cell *matCellDef="let t">
                  <div class="date-cell">
                    <span class="date-text">{{ t.testDate | localDatetime:'date' }}</span>
                    <span class="time-badge">{{ t.testDate | localDatetime:'time' }}</span>
                  </div>
                </td>
              </ng-container>

              <!-- Actions Column -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="text-right no-print">Actions</th>
                <td mat-cell *matCellDef="let t" class="text-right no-print">
                  <div class="action-buttons no-print">
                    <button mat-stroked-button class="admit-card-btn" (click)="openAdmitCards(t)" matTooltip="Generate &amp; Print Admit Cards / Hall Tickets">
                      <mat-icon>confirmation_number</mat-icon> Admit Cards
                    </button>
                    <button mat-stroked-button class="result-btn" (click)="openResults(t)" matTooltip="View Leaderboard &amp; Student Result Cards">
                      <mat-icon>emoji_events</mat-icon> Results
                    </button>
                    <button mat-raised-button color="primary" (click)="openMarksGrid(t)"
                            class="enter-marks-btn" matTooltip="Enter / Update Marks">
                      <mat-icon>edit_note</mat-icon> Enter Marks
                    </button>
                    <button mat-icon-button color="warn" (click)="deleteTest(t)" matTooltip="Delete Test">
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
    .shared-batch-row {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 18px;
      flex-wrap: wrap;
      .batch-selector { flex: 0 0 380px; }
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

    /* ── Column Labels for Planner ── */
    .row-labels {
      display: grid;
      grid-template-columns: 36px 1.2fr 1fr 1.5fr 140px 105px 95px 44px;
      gap: 10px;
      padding: 10px 8px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 8px 8px 0 0;
      font-size: 0.76rem;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      .lbl-num { text-align: center; }
    }
    .exam-row {
      display: grid;
      grid-template-columns: 36px 1.2fr 1fr 1.5fr 140px 105px 95px 44px;
      gap: 10px;
      align-items: flex-start;
      padding: 8px 8px;
      border: 1px solid #e2e8f0;
      border-top: none;
      background: #ffffff;
      transition: background 0.15s ease;
      &:hover { background: #f8fafc; }
      &.exam-row-error { background: #fffbfb; border-color: #fecaca; }
      &:last-child { border-radius: 0 0 8px 8px; }
    }
    .cell-num, .cell-del {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 42px;
    }
    .cell-batch, .cell-subject, .cell-title,
    .cell-date, .cell-time, .cell-marks { width: 100%; }
    .field-compact {
      width: 100%;
      ::ng-deep .mat-mdc-text-field-wrapper {
        height: 42px !important;
        padding: 0 10px !important;
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
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: #e0e7ff;
      color: #3730a3;
      font-size: 0.78rem;
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
      padding: 18px 20px 14px;
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      background: #fafafa;
      border-bottom: 1px solid #f1f5f9;
      .search-field { flex: 1 1 300px; }
      .batch-filter { flex: 1 1 240px; }
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
      display: inline-block;
      font-size: 0.82rem;
      font-weight: 600;
      color: #0284c7;
      background: #f0f9ff;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid #bae6fd;
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
      .row-labels {
        grid-template-columns: 32px 1fr 1fr 1.2fr 130px 95px 85px 40px;
        gap: 6px;
      }
      .exam-row {
        grid-template-columns: 32px 1fr 1fr 1.2fr 130px 95px 85px 40px;
        gap: 6px;
      }
      .shared-batch-row .batch-selector {
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
    }
  `]
})
export class TestsComponent implements OnInit {
  // Tests List
  tests: any[] = [];
  batches: any[] = [];
  allSubjects: SubjectDto[] = [];

  // Bulk planner state
  showBulkPlanner = false;
  sharedBatchId = '';
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
    private confirmDialog: ConfirmDialogService,
    private subjectsService: SubjectsService,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private authService: AuthService
  ) {
    this.bulkForm = this.fb.group({ exams: this.fb.array([]) });
  }

  get instituteName(): string {
    return this.authService.currentUser()?.instituteName || 'Apex Coaching Academy';
  }

  get todayDate(): Date {
    return new Date();
  }

  get activeBatchName(): string {
    if (!this.selectedBatchFilter) return 'All Batches';
    const b = this.batches.find(x => x.id === this.selectedBatchFilter);
    return b ? b.name : 'All Batches';
  }

  printSchedule(): void {
    window.print();
  }

  openAdmitCards(test: any): void {
    this.dialog.open(ExamAdmitCardDialogComponent, {
      width: '1020px',
      maxWidth: '96vw',
      maxHeight: '92vh',
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
        batchName: test.batchName,
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

  private buildRow(batchId = ''): FormGroup {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return this.fb.group({
      batchId: [batchId, Validators.required],
      subject: ['', Validators.required],
      title: ['', Validators.required],
      examDate: [today, Validators.required],
      examTime: ['09:00'],
      maxMarks: [50, [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
    this.loadBatches();
    this.loadTests();
    this.loadSubjects();
  }

  loadBatches(): void {
    this.coachingService.getBatches().subscribe({
      next: b => this.batches = b,
      error: err => console.error(err)
    });
  }

  loadSubjects(): void {
    this.subjectsService.getSubjects(true).subscribe({
      next: list => { this.allSubjects = list; },
      error: err => console.error(err)
    });
  }

  // ─── Bulk Planner ──────────────────────────────
  toggleBulkPlanner(): void {
    this.showBulkPlanner = !this.showBulkPlanner;
    if (this.showBulkPlanner) {
      this.examsArray.clear();
      this.subjectSearchTexts = [];
      this.filteredSubjectsPerRow = [];
      this.addRow();
    }
  }

  addRow(): void {
    const row = this.buildRow(this.sharedBatchId);
    this.examsArray.push(row);
    this.subjectSearchTexts.push('');
    this.filteredSubjectsPerRow.push([...this.allSubjects]);
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

  filterSubjectsForRow(i: number, event: Event): void {
    const term = (event.target as HTMLInputElement).value?.toLowerCase() ?? '';
    this.subjectSearchTexts[i] = term;
    if (!term.trim()) {
      this.filteredSubjectsPerRow[i] = [...this.allSubjects];
      return;
    }
    this.filteredSubjectsPerRow[i] = this.allSubjects.filter(
      s => (s.name && s.name.toLowerCase().includes(term)) ||
           (s.code && s.code.toLowerCase().includes(term))
    );
  }

  clearSubjectSearch(i: number, event: Event): void {
    event.stopPropagation();
    this.subjectSearchTexts[i] = '';
    this.filteredSubjectsPerRow[i] = [...this.allSubjects];
  }

  onSubjectSelectOpened(i: number, isOpen: boolean): void {
    if (isOpen) {
      setTimeout(() => {
        const inputEl = document.querySelector(`.smart-subject-panel .select-search-input`) as HTMLInputElement;
        if (inputEl) inputEl.focus();
      }, 100);
    } else {
      this.subjectSearchTexts[i] = '';
      this.filteredSubjectsPerRow[i] = [...this.allSubjects];
    }
  }

  saveBulkPlanner(): void {
    this.examsArray.controls.forEach(c => c.markAllAsTouched());

    if (this.bulkForm.invalid) {
      this.confirmDialog.alert('Validation Error', 'Please fill in all required fields (Batch, Subject, Title, Date) for every row.', 'warning');
      return;
    }

    const payload = this.examsArray.controls.map(row => {
      const v = row.value;
      const dateStr = v.examDate;
      const timeStr = v.examTime || '09:00';
      let isoDate: string;
      try {
        if (dateStr) {
          // Parse explicitly in IST (Indian Standard Time, UTC+05:30) and convert to UTC ISO
          const combined = new Date(`${dateStr}T${timeStr}:00+05:30`);
          isoDate = !isNaN(combined.getTime()) ? combined.toISOString() : new Date().toISOString();
        } else {
          isoDate = new Date().toISOString();
        }
      } catch {
        isoDate = new Date().toISOString();
      }

      return {
        batchId: v.batchId,
        subject: v.subject,
        title: v.title,
        maxMarks: Number(v.maxMarks),
        testDate: isoDate
      };
    });

    this.confirmDialog.confirm(
      'Schedule Exam Session',
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
      this.selectedBatchFilter,
      this.sortBy,
      this.sortDescending
    ).subscribe({
      next: result => { this.tests = result.items; this.totalCount = result.totalCount; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  onSearch(): void { this.pageIndex = 0; this.loadTests(); }
  onFilterChange(): void { this.pageIndex = 0; this.loadTests(); }

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
    this.selectedTest = test;
    this.marksLoading = true;
    this.marksGrid = [];

    // Load batch students and existing marks in parallel
    forkJoin({
      students: this.coachingService.getStudents(test.batchId),
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

  saveMarks(): void {
    if (!this.selectedTest) return;

    const overMax = this.marksGrid.some(m => !m.isAbsent && m.marksObtained > this.selectedTest.maxMarks);
    if (overMax) {
      this.confirmDialog.alert('Validation', `Marks cannot exceed maximum (${this.selectedTest.maxMarks}).`, 'warning');
      return;
    }

    this.confirmDialog.confirm(
      'Save Marks',
      `Save marks for all ${this.marksGrid.length} students in "${this.selectedTest.title}"${this.notifyParents ? ' and send WhatsApp report cards' : ''}?`,
      'Save & Dispatch', 'Cancel', 'success'
    ).subscribe(confirmed => {
      if (!confirmed) return;
      this.savingMarks = true;
      this.coachingService.saveBulkMarks({
        testId: this.selectedTest.id,
        marksList: this.marksGrid,
        notifyParentsViaWhatsApp: this.notifyParents
      }).subscribe({
        next: () => {
          this.savingMarks = false;
          this.selectedTest = null;
          this.loadTests();
          this.confirmDialog.alert('Marks Saved! 🎉',
            `Marks saved for ${this.marksGrid.length} students.${this.notifyParents ? ' WhatsApp report cards dispatched!' : ''}`, 'success');
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
