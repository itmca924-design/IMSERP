import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import {
  SchoolService,
  SchoolClassDto,
  SchoolSectionDto,
  ClassExamSubjectHeaderDto,
  ClassStudentMultiSubjectRowDto,
  ClassMultiSubjectMatrixDto,
  SaveClassMultiSubjectMarksDto,
  ClassSaveStudentRowDto,
  ClassSaveCellMarkDto
} from '../../core/services/school.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

export interface SchoolClassMarksMatrixDialogData {
  classId: string;
  sectionId?: string;
  academicYear: string;
  examType: string;
  classes: SchoolClassDto[];
}

interface EditableStudentRow {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  rollNumber?: string;
  marks: {
    [examId: string]: {
      marksObtained: number | null;
      isAbsent: boolean;
      remarks?: string;
    };
  };
}

@Component({
  selector: 'app-school-class-marks-matrix-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule
  ],
  template: `
    <div class="matrix-dialog-wrapper">
      <!-- STRICT UI RULE: Light Blue Gradient Header -->
      <div class="modal-header">
        <div class="header-left-box">
          <div class="header-icon">
            <mat-icon>table_chart</mat-icon>
          </div>
          <div>
            <h2 class="modal-title">Class Multi-Subject Marks Entry Matrix</h2>
            <p class="modal-subtitle">कक्षावार सभी विषयों के अंक एक साथ प्रविष्ट व सुरक्षित करें (Multi-Subject Row Entry)।</p>
          </div>
        </div>
        <button mat-icon-button (click)="onClose()" class="close-btn" matTooltip="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Filter Controls Strip -->
      <div class="filters-strip">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="ctrl-field">
          <mat-label>Target Class *</mat-label>
          <mat-select [(value)]="selectedClassId" (selectionChange)="onClassChange()">
            <mat-option *ngFor="let c of data.classes" [value]="c.id">{{ c.name }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="ctrl-field">
          <mat-label>Section</mat-label>
          <mat-select [(value)]="selectedSectionId" (selectionChange)="loadMatrix()">
            <mat-option value="">All Sections</mat-option>
            <mat-option *ngFor="let s of sections" [value]="s.id">{{ s.name }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="ctrl-field">
          <mat-label>Academic Session *</mat-label>
          <mat-select [(value)]="selectedAcademicYear" (selectionChange)="loadMatrix()">
            <mat-option value="2024-2025">2024-2025</mat-option>
            <mat-option value="2025-2026">2025-2026</mat-option>
            <mat-option value="2026-2027">2026-2027</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="ctrl-field">
          <mat-label>Exam Type / Term *</mat-label>
          <mat-select [(value)]="selectedExamType" (selectionChange)="loadMatrix()">
            <mat-option value="Annual Exam">Annual Exam (Final)</mat-option>
            <mat-option value="Half-Yearly Exam">Half-Yearly Exam</mat-option>
            <mat-option value="Unit Test 1">Unit Test 1</mat-option>
            <mat-option value="Unit Test 2">Unit Test 2</mat-option>
            <mat-option value="Quarterly Exam">Quarterly Exam</mat-option>
            <mat-option value="Pre-Board">Pre-Board Exam</mat-option>
          </mat-select>
        </mat-form-field>

        <button mat-stroked-button color="primary" class="reload-btn" (click)="loadMatrix()" [disabled]="loading" matTooltip="Refresh data from server">
          <mat-icon>refresh</mat-icon>
          <span>Reload</span>
        </button>
      </div>

      <!-- Quick Search & Actions Strip -->
      <div class="search-actions-strip" *ngIf="!loading && subjects.length > 0">
        <div class="search-input-box">
          <mat-icon>search</mat-icon>
          <input type="text" [(ngModel)]="searchStudentText" placeholder="Search student by name or roll number...">
          <button *ngIf="searchStudentText" (click)="searchStudentText = ''" class="clear-btn">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="quick-helpers">
          <span class="info-pill">
            <mat-icon>school</mat-icon> {{ subjects.length }} Subject Papers
          </span>
          <span class="info-pill">
            <mat-icon>groups</mat-icon> {{ students.length }} Students
          </span>
          <button mat-button color="primary" (click)="markAllPresent()" matTooltip="Clear absent flag for all students">
            <mat-icon>done_all</mat-icon> Mark All Present
          </button>
        </div>
      </div>

      <!-- Matrix Content Body -->
      <div class="dialog-body">
        <!-- Loading State -->
        <div class="matrix-loading" *ngIf="loading">
          <mat-spinner diameter="44"></mat-spinner>
          <p>Loading multi-subject exam matrix for {{ getClassName() }}...</p>
        </div>

        <!-- Empty State: No Exams -->
        <div class="matrix-empty" *ngIf="!loading && subjects.length === 0">
          <mat-icon class="empty-icon">event_busy</mat-icon>
          <h3>No Exam Papers Found</h3>
          <p>
            There are no exam papers scheduled for <strong>{{ getClassName() }}</strong> under 
            <strong>{{ selectedExamType }}</strong> ({{ selectedAcademicYear }}).
          </p>
          <p class="sub-hint">Please schedule bulk exams first from the "Bulk Exam Scheduler" tab before entering marks.</p>
        </div>

        <!-- Empty State: No Students -->
        <div class="matrix-empty" *ngIf="!loading && subjects.length > 0 && students.length === 0">
          <mat-icon class="empty-icon">group_off</mat-icon>
          <h3>No Enrolled Students Found</h3>
          <p>There are no active school students enrolled in <strong>{{ getClassName() }}</strong>.</p>
        </div>

        <!-- The Multi-Subject Dynamic Grid Table -->
        <div class="table-scroll-container" *ngIf="!loading && subjects.length > 0 && students.length > 0">
          <table class="marks-matrix-table">
            <thead>
              <tr>
                <th class="th-fixed th-roll">Roll #</th>
                <th class="th-fixed th-name">Student Name</th>
                <!-- Dynamic Subject Columns -->
                <th *ngFor="let sub of subjects" class="th-subject">
                  <div class="sub-hdr">
                    <span class="sub-name" [matTooltip]="sub.subjectName">{{ sub.subjectName }}</span>
                    <span class="sub-meta">Max: {{ sub.maxMarks }} | Pass: {{ sub.passingMarks }}</span>
                  </div>
                </th>
                <!-- Summary Dynamic Columns -->
                <th class="th-summary th-total">Total</th>
                <th class="th-summary th-pct">%</th>
                <th class="th-summary th-status">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of filteredStudents; let i = index" [class.row-alt]="i % 2 === 1">
                <!-- Roll Number -->
                <td class="td-fixed td-roll">
                  <span class="roll-badge">{{ s.rollNumber || (i + 1) }}</span>
                </td>

                <!-- Student Name & Admission Number -->
                <td class="td-fixed td-name">
                  <div class="student-name-cell">
                    <strong>{{ s.studentName }}</strong>
                    <span class="adm-no">Adm: {{ s.admissionNumber }}</span>
                  </div>
                </td>

                <!-- Dynamic Subject Mark Cells -->
                <td *ngFor="let sub of subjects" class="td-mark-cell" [class.cell-absent]="s.marks[sub.examId].isAbsent">
                  <div class="mark-cell-wrapper">
                    <!-- Absent Toggle Button -->
                    <button
                      type="button"
                      class="btn-absent-toggle"
                      [class.active-absent]="s.marks[sub.examId].isAbsent"
                      (click)="toggleAbsent(s, sub.examId)"
                      [matTooltip]="s.marks[sub.examId].isAbsent ? 'Student is Absent. Click to mark Present.' : 'Mark Absent'">
                      {{ s.marks[sub.examId].isAbsent ? 'ABS' : 'P' }}
                    </button>

                    <!-- Number Input for Marks -->
                    <input
                      type="number"
                      class="mark-input"
                      [class.input-error]="isMarkOverMax(s, sub)"
                      [disabled]="s.marks[sub.examId].isAbsent"
                      [(ngModel)]="s.marks[sub.examId].marksObtained"
                      [min]="0"
                      [max]="sub.maxMarks"
                      placeholder="-"
                      (keydown)="onInputKeydown($event, i, sub.examId)">
                  </div>
                </td>

                <!-- Computed Total Marks -->
                <td class="td-summary td-total">
                  <strong>{{ calculateStudentTotal(s) }}</strong>
                  <span class="total-max">/ {{ calculateTotalMax() }}</span>
                </td>

                <!-- Computed Percentage -->
                <td class="td-summary td-pct">
                  <span class="pct-val" [class.pct-pass]="calculatePercentage(s) >= 33" [class.pct-fail]="calculatePercentage(s) < 33">
                    {{ calculatePercentage(s) | number:'1.1-1' }}%
                  </span>
                </td>

                <!-- Computed Status Badge -->
                <td class="td-summary td-status">
                  <span class="status-badge" [ngClass]="getStudentStatusClass(s)">
                    {{ getStudentStatusText(s) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="modal-footer">
        <div class="footer-left">
          <div class="footer-stat" *ngIf="students.length > 0">
            <mat-icon>check_circle</mat-icon>
            <span>Ready to save <strong>{{ students.length }}</strong> student row(s) across <strong>{{ subjects.length }}</strong> subjects.</span>
          </div>
        </div>

        <div class="footer-right">
          <button mat-stroked-button type="button" class="btn-cancel" (click)="onClose()">
            Cancel
          </button>
          <button
            mat-flat-button
            color="primary"
            class="btn-save-all"
            (click)="saveAllMarks()"
            [disabled]="saving || loading || students.length === 0 || subjects.length === 0">
            <mat-icon *ngIf="!saving">save</mat-icon>
            <mat-spinner diameter="18" *ngIf="saving"></mat-spinner>
            <span>Save All Marks (सभी अंक सेव करें)</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .matrix-dialog-wrapper {
      display: flex;
      flex-direction: column;
      height: 90vh;
      max-height: 900px;
      width: 95vw;
      max-width: 1400px;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      font-family: inherit;
    }

    /* Strict AGENTS.md Header */
    .modal-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;

      .header-left-box {
        display: flex;
        align-items: center;
        gap: 14px;

        .header-icon {
          width: 44px;
          height: 44px;
          background: #2563eb;
          color: #ffffff;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
          mat-icon { font-size: 24px; width: 24px; height: 24px; }
        }

        .modal-title {
          margin: 0;
          font-size: 19px;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.2;
        }

        .modal-subtitle {
          margin: 3px 0 0 0;
          font-size: 13px;
          color: #3b82f6;
          line-height: 1.2;
        }
      }

      .close-btn {
        color: #64748b;
        &:hover { color: #1e293b; background: rgba(0, 0, 0, 0.05); }
      }
    }

    /* Filters Strip */
    .filters-strip {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 24px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
      flex-shrink: 0;

      .ctrl-field {
        min-width: 170px;
        flex: 1;
      }

      .reload-btn {
        height: 48px;
        border-radius: 8px;
        padding: 0 16px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
    }

    /* Search & Quick Actions Strip */
    .search-actions-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 10px 24px;
      background: #ffffff;
      border-bottom: 1px solid #f1f5f9;
      flex-shrink: 0;
      flex-wrap: wrap;

      .search-input-box {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 6px 12px;
        width: 320px;
        mat-icon { color: #64748b; font-size: 20px; width: 20px; height: 20px; }
        input {
          border: none;
          background: transparent;
          outline: none;
          width: 100%;
          font-size: 13.5px;
          color: #1e293b;
        }
        .clear-btn {
          border: none;
          background: transparent;
          cursor: pointer;
          color: #94a3b8;
          display: flex;
          padding: 0;
          &:hover { color: #475569; }
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
        }
      }

      .quick-helpers {
        display: flex;
        align-items: center;
        gap: 12px;

        .info-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 16px;
          border: 1px solid #bfdbfe;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }
      }
    }

    /* Dialog Body & Scrolling */
    .dialog-body {
      flex: 1;
      overflow: hidden;
      position: relative;
      background: #ffffff;
    }

    .matrix-loading, .matrix-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 280px;
      padding: 40px 20px;
      text-align: center;
      color: #64748b;

      p { margin-top: 14px; font-size: 14.5px; }
      .empty-icon { font-size: 48px; width: 48px; height: 48px; color: #94a3b8; margin-bottom: 8px; }
      h3 { font-size: 17px; font-weight: 700; color: #1e293b; margin: 0 0 6px 0; }
      .sub-hint { font-size: 13px; color: #94a3b8; }
    }

    .table-scroll-container {
      height: 100%;
      overflow: auto;
    }

    /* Matrix Table */
    .marks-matrix-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 13.5px;

      thead {
        position: sticky;
        top: 0;
        z-index: 10;
        background: #f8fafc;
      }

      th {
        padding: 10px 14px;
        font-weight: 700;
        color: #334155;
        border-bottom: 2px solid #cbd5e1;
        border-right: 1px solid #e2e8f0;
        background: #f8fafc;
        white-space: nowrap;
        text-align: left;
      }

      td {
        padding: 8px 12px;
        border-bottom: 1px solid #f1f5f9;
        border-right: 1px solid #f1f5f9;
        vertical-align: middle;
      }

      tr.row-alt {
        background: #fafcff;
      }

      tr:hover {
        background: #f0f7ff;
      }

      /* Fixed Columns */
      .th-roll, .td-roll {
        width: 60px;
        text-align: center;
      }

      .roll-badge {
        display: inline-block;
        min-width: 26px;
        padding: 2px 6px;
        background: #e2e8f0;
        color: #334155;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 700;
        text-align: center;
      }

      .th-name, .td-name {
        min-width: 170px;
        max-width: 220px;
      }

      .student-name-cell {
        display: flex;
        flex-direction: column;
        line-height: 1.3;
        strong { color: #0f172a; }
        .adm-no { font-size: 11px; color: #64748b; }
      }

      /* Subject Header */
      .th-subject {
        min-width: 135px;
        text-align: center;
      }

      .sub-hdr {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        .sub-name { font-size: 13px; font-weight: 700; color: #1e3a8a; }
        .sub-meta { font-size: 11px; font-weight: 500; color: #64748b; }
      }

      /* Mark Input Cell */
      .td-mark-cell {
        text-align: center;
        padding: 6px;
      }

      .mark-cell-wrapper {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 2px 6px;
        transition: all 0.15s ease;

        &:focus-within {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
        }
      }

      .cell-absent .mark-cell-wrapper {
        background: #fef2f2;
        border-color: #fca5a5;
      }

      .btn-absent-toggle {
        border: none;
        background: #f1f5f9;
        color: #64748b;
        font-size: 11px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        &.active-absent {
          background: #ef4444;
          color: #ffffff;
          box-shadow: 0 1px 3px rgba(239, 68, 68, 0.3);
        }
      }

      .mark-input {
        width: 54px;
        border: none;
        outline: none;
        background: transparent;
        font-size: 13.5px;
        font-weight: 700;
        text-align: center;
        color: #0f172a;

        &::-webkit-inner-spin-button,
        &::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        &:disabled {
          color: #ef4444;
          font-weight: 700;
          cursor: not-allowed;
        }

        &.input-error {
          color: #dc2626;
          background: #fee2e2;
          border-radius: 4px;
        }
      }

      /* Summary Columns */
      .th-summary, .td-summary {
        text-align: center;
        background: #f8fafc;
        border-left: 1px solid #e2e8f0;
      }

      .th-total { min-width: 90px; }
      .th-pct { min-width: 75px; }
      .th-status { min-width: 90px; }

      .td-total {
        font-weight: 700;
        color: #1e293b;
        .total-max { font-size: 11px; color: #64748b; font-weight: normal; }
      }

      .pct-val {
        font-weight: 700;
        font-size: 13px;
        &.pct-pass { color: #16a34a; }
        &.pct-fail { color: #dc2626; }
      }

      .status-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;

        &.status-pass {
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }

        &.status-fail {
          background: #fee2e2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        &.status-compartment {
          background: #fef3c7;
          color: #b45309;
          border: 1px solid #fde68a;
        }
      }
    }

    /* Modal Footer */
    .modal-footer {
      padding: 14px 24px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;

      .footer-left {
        .footer-stat {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #16a34a;
          font-size: 13px;
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
        }
      }

      .footer-right {
        display: flex;
        align-items: center;
        gap: 12px;

        button {
          height: 44px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13.5px;
          padding: 0 20px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .btn-cancel {
          border-color: #cbd5e1;
          color: #475569;
        }

        .btn-save-all {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          box-shadow: 0 4px 10px -2px rgba(37, 99, 235, 0.35);

          &:hover:not([disabled]) {
            box-shadow: 0 6px 14px -2px rgba(37, 99, 235, 0.45);
          }
        }
      }
    }
  `]
})
export class SchoolClassMarksMatrixDialogComponent implements OnInit {
  selectedClassId = '';
  selectedSectionId = '';
  selectedAcademicYear = '2025-2026';
  selectedExamType = 'Annual Exam';

  sections: SchoolSectionDto[] = [];
  subjects: ClassExamSubjectHeaderDto[] = [];
  students: EditableStudentRow[] = [];
  searchStudentText = '';

  loading = false;
  saving = false;

  constructor(
    public dialogRef: MatDialogRef<SchoolClassMarksMatrixDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SchoolClassMarksMatrixDialogData,
    private schoolService: SchoolService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.selectedClassId = this.data.classId || (this.data.classes.length > 0 ? this.data.classes[0].id : '');
    this.selectedSectionId = this.data.sectionId || '';
    this.selectedAcademicYear = this.data.academicYear || '2025-2026';
    this.selectedExamType = this.data.examType || 'Annual Exam';

    this.onClassChange();
  }

  getClassName(): string {
    const cls = this.data.classes.find(c => c.id === this.selectedClassId);
    return cls ? cls.name : 'Selected Class';
  }

  onClassChange(): void {
    this.selectedSectionId = '';
    if (this.selectedClassId) {
      this.schoolService.getSections(this.selectedClassId).subscribe({
        next: (secs) => {
          this.sections = secs;
        }
      });
    } else {
      this.sections = [];
    }
    this.loadMatrix();
  }

  loadMatrix(): void {
    if (!this.selectedClassId) return;

    this.loading = true;
    this.schoolService.getClassMultiSubjectMarks(
      this.selectedClassId,
      this.selectedAcademicYear,
      this.selectedExamType,
      this.selectedSectionId || undefined
    ).subscribe({
      next: (res: ClassMultiSubjectMatrixDto) => {
        this.loading = false;
        this.subjects = res.subjects || [];

        // Build editable row structures
        this.students = (res.students || []).map(s => {
          const marksMap: { [examId: string]: { marksObtained: number | null; isAbsent: boolean; remarks?: string } } = {};
          
          this.subjects.forEach(sub => {
            const existingCell = s.subjectMarks?.find(m => m.examId === sub.examId);
            marksMap[sub.examId] = {
              marksObtained: existingCell && existingCell.marksObtained !== undefined && existingCell.marksObtained !== null ? existingCell.marksObtained : null,
              isAbsent: existingCell ? existingCell.isAbsent : false,
              remarks: existingCell ? existingCell.remarks : ''
            };
          });

          return {
            studentId: s.studentId,
            studentName: s.studentName,
            admissionNumber: s.admissionNumber,
            rollNumber: s.rollNumber,
            marks: marksMap
          };
        });
      },
      error: () => {
        this.loading = false;
        this.subjects = [];
        this.students = [];
      }
    });
  }

  get filteredStudents(): EditableStudentRow[] {
    if (!this.searchStudentText.trim()) return this.students;
    const txt = this.searchStudentText.toLowerCase().trim();
    return this.students.filter(s => 
      s.studentName.toLowerCase().includes(txt) ||
      (s.rollNumber && s.rollNumber.toLowerCase().includes(txt)) ||
      s.admissionNumber.toLowerCase().includes(txt)
    );
  }

  toggleAbsent(s: EditableStudentRow, examId: string): void {
    const cell = s.marks[examId];
    if (!cell) return;
    cell.isAbsent = !cell.isAbsent;
    if (cell.isAbsent) {
      cell.marksObtained = 0;
    }
  }

  markAllPresent(): void {
    this.students.forEach(s => {
      this.subjects.forEach(sub => {
        if (s.marks[sub.examId]) {
          s.marks[sub.examId].isAbsent = false;
        }
      });
    });
  }

  isMarkOverMax(s: EditableStudentRow, sub: ClassExamSubjectHeaderDto): boolean {
    const mark = s.marks[sub.examId]?.marksObtained;
    return mark !== null && mark !== undefined && mark > sub.maxMarks;
  }

  calculateStudentTotal(s: EditableStudentRow): number {
    let sum = 0;
    this.subjects.forEach(sub => {
      const cell = s.marks[sub.examId];
      if (cell && !cell.isAbsent && cell.marksObtained !== null && cell.marksObtained !== undefined) {
        sum += Number(cell.marksObtained);
      }
    });
    return sum;
  }

  calculateTotalMax(): number {
    return this.subjects.reduce((sum, sub) => sum + sub.maxMarks, 0);
  }

  calculatePercentage(s: EditableStudentRow): number {
    const totalMax = this.calculateTotalMax();
    if (totalMax === 0) return 0;
    const totalObt = this.calculateStudentTotal(s);
    return (totalObt / totalMax) * 100;
  }

  getStudentStatusText(s: EditableStudentRow): string {
    const totalMax = this.calculateTotalMax();
    if (totalMax === 0) return 'PENDING';

    let hasAnyMark = false;
    let failedCount = 0;

    for (const sub of this.subjects) {
      const cell = s.marks[sub.examId];
      if (cell && (cell.marksObtained !== null || cell.isAbsent)) {
        hasAnyMark = true;
        if (cell.isAbsent || (cell.marksObtained !== null && cell.marksObtained < sub.passingMarks)) {
          failedCount++;
        }
      }
    }

    if (!hasAnyMark) return 'PENDING';
    if (failedCount === 0) return 'PASS';
    if (failedCount <= 2) return 'COMPARTMENT';
    return 'FAIL';
  }

  getStudentStatusClass(s: EditableStudentRow): string {
    const status = this.getStudentStatusText(s);
    if (status === 'PASS') return 'status-pass';
    if (status === 'FAIL') return 'status-fail';
    if (status === 'COMPARTMENT') return 'status-compartment';
    return 'status-pending';
  }

  onInputKeydown(event: KeyboardEvent, studentIndex: number, currentExamId: string): void {
    // Navigate smoothly across rows on Enter or ArrowDown
    if (event.key === 'Enter' || event.key === 'ArrowDown') {
      const nextRow = studentIndex + 1;
      if (nextRow < this.filteredStudents.length) {
        // focus next row input
      }
    }
  }

  saveAllMarks(): void {
    // Check if any mark exceeds maximum
    for (const s of this.students) {
      for (const sub of this.subjects) {
        if (this.isMarkOverMax(s, sub)) {
          this.confirmDialog.alert(
            'Invalid Marks Entered',
            `Marks for student "${s.studentName}" in "${sub.subjectName}" (${s.marks[sub.examId].marksObtained}) cannot exceed Maximum Marks (${sub.maxMarks}).`,
            'warning'
          );
          return;
        }
      }
    }

    this.saving = true;

    const rowsPayload: ClassSaveStudentRowDto[] = this.students.map(s => {
      const cellMarks: ClassSaveCellMarkDto[] = this.subjects.map(sub => {
        const cell = s.marks[sub.examId];
        return {
          examId: sub.examId,
          marksObtained: cell && !cell.isAbsent && cell.marksObtained !== null ? Number(cell.marksObtained) : null,
          isAbsent: cell ? cell.isAbsent : false,
          remarks: cell?.remarks || undefined
        };
      });

      return {
        studentId: s.studentId,
        subjectMarks: cellMarks
      };
    });

    const payload: SaveClassMultiSubjectMarksDto = {
      classId: this.selectedClassId,
      academicYear: this.selectedAcademicYear,
      examType: this.selectedExamType,
      rows: rowsPayload
    };

    this.schoolService.saveClassMultiSubjectMarks(payload).subscribe({
      next: (res) => {
        this.saving = false;
        this.confirmDialog.alert(
          'Marks Saved Successfully! 🎉',
          res.message || 'Multi-subject exam marks for all students saved successfully!',
          'success'
        );
        this.dialogRef.close({ saved: true });
      },
      error: (err) => {
        this.saving = false;
        this.confirmDialog.alert(
          'Save Failed',
          err.error?.message || 'Error occurred while saving multi-subject marks to database.',
          'danger'
        );
      }
    });
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
