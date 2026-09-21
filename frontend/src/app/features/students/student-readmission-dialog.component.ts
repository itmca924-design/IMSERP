import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CoachingService } from '../../core/services/coaching.service';
import { SchoolService, SchoolClassDto, SchoolSectionDto } from '../../core/services/school.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

export interface StudentReadmissionDialogData {
  student: any;
}

@Component({
  selector: 'app-student-readmission-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <div class="readmit-dialog-wrapper">
      <!-- Dialog Header (Strict ERP Light Blue Gradient Rule) -->
      <div class="readmit-dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>replay</mat-icon>
          </div>
          <div>
            <h2 class="dialog-title">Student Re-Admission Workflow</h2>
            <div class="student-meta-strip">
              <span class="st-name">{{ student?.studentName }}</span>
              <span class="meta-dot">•</span>
              <span>Prev Roll: <strong>{{ student?.rollNumber }}</strong></span>
              <span class="meta-dot" *ngIf="student?.admissionNumber">•</span>
              <span *ngIf="student?.admissionNumber">SR No: <strong>{{ student?.admissionNumber }}</strong></span>
              <span class="meta-dot" *ngIf="student?.tcNumber">•</span>
              <span class="tc-pill" *ngIf="student?.tcNumber">TC: <strong>{{ student?.tcNumber }}</strong></span>
            </div>
          </div>
        </div>
        <div class="header-right">
          <button mat-icon-button class="close-btn" (click)="closeDialog()" matTooltip="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Departure Info Banner -->
      <div class="departure-summary-banner">
        <div class="banner-item">
          <span class="lbl">Previous Status:</span>
          <span class="val status-tag">Left / TC Issued</span>
        </div>
        <div class="banner-item" *ngIf="student?.leavingDate">
          <span class="lbl">Departure Date:</span>
          <span class="val">{{ student?.leavingDate | date:'mediumDate' }}</span>
        </div>
        <div class="banner-item" *ngIf="student?.leavingReason">
          <span class="lbl">Departure Reason:</span>
          <span class="val">{{ student?.leavingReason }}</span>
        </div>
        <div class="banner-item">
          <span class="lbl">Last Enrolled In:</span>
          <span class="val">{{ student?.className ? (student?.className + ' - ' + (student?.sectionName || 'A')) : (student?.batchName || 'N/A') }}</span>
        </div>
      </div>

      <!-- Re-Admission Form -->
      <form [formGroup]="readmitForm" (ngSubmit)="submitReAdmission()" class="readmit-form">
        <div class="form-body">
          
          <div class="form-row two-col">
            <!-- Re-Admission Date -->
            <mat-form-field appearance="outline">
              <mat-label>Re-Admission Date</mat-label>
              <input matInput type="date" formControlName="reAdmissionDate" required />
              <mat-error *ngIf="readmitForm.get('reAdmissionDate')?.hasError('required')">Date is required</mat-error>
            </mat-form-field>

            <!-- Re-Admission Fee -->
            <mat-form-field appearance="outline">
              <mat-label>Re-Admission Fee (₹)</mat-label>
              <input matInput type="number" min="0" step="50" formControlName="reAdmissionFee" placeholder="0" />
              <mat-hint>Set ₹0 if waived. If > 0, an invoice will be generated.</mat-hint>
            </mat-form-field>
          </div>

          <!-- Academic Stream & Class Allocation -->
          <div class="section-divider">
            <span>Academic Allocation for Re-Admission</span>
          </div>

          <div class="form-row two-col" *ngIf="student?.isSchoolStudent !== false">
            <!-- Target Class -->
            <mat-form-field appearance="outline">
              <mat-label>Target School Class</mat-label>
              <mat-select formControlName="classId" (selectionChange)="onClassChange($event.value)">
                <mat-option *ngFor="let c of classes" [value]="c.id">
                  {{ c.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Target Section -->
            <mat-form-field appearance="outline">
              <mat-label>Target Section</mat-label>
              <mat-select formControlName="sectionId">
                <mat-option *ngFor="let s of filteredSections" [value]="s.id">
                  {{ s.name }} (Max: {{ s.maxCapacity }})
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="form-row two-col">
            <!-- Target Coaching Batch (if applicable) -->
            <mat-form-field appearance="outline" *ngIf="student?.isCoachingStudent">
              <mat-label>Coaching Batch</mat-label>
              <mat-select formControlName="batchId">
                <mat-option *ngFor="let b of batches" [value]="b.id">
                  {{ b.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <!-- New Roll Number -->
            <mat-form-field appearance="outline">
              <mat-label>New Roll Number (Optional)</mat-label>
              <input matInput formControlName="newRollNumber" placeholder="Keep blank to retain existing" />
              <mat-hint>Leave blank to keep existing roll number</mat-hint>
            </mat-form-field>
          </div>

          <!-- Remarks -->
          <div class="form-row">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Re-Admission Remarks / Reason</mat-label>
              <textarea matInput rows="2" formControlName="remarks" placeholder="e.g. Student re-enrolled after return from hometown / family medical leave"></textarea>
            </mat-form-field>
          </div>

          <!-- Reset TC Checkbox -->
          <div class="checkbox-row">
            <mat-checkbox formControlName="resetTC" color="primary">
              <strong>Reset &amp; Archive Prior TC / Clearance Record</strong>
              <div class="checkbox-subtext">Marks student fully active and clears previous departure flag so student can resume regular attendance and exams.</div>
            </mat-checkbox>
          </div>

        </div>

        <!-- Footer Actions -->
        <div class="readmit-dialog-footer">
          <button type="button" mat-stroked-button (click)="closeDialog()" [disabled]="submitting">
            Cancel
          </button>
          <button type="submit" mat-flat-button color="primary" class="btn-confirm-readmit" [disabled]="readmitForm.invalid || submitting">
            <mat-spinner diameter="18" *ngIf="submitting" style="display: inline-block; margin-right: 8px;"></mat-spinner>
            <mat-icon *ngIf="!submitting">how_to_reg</mat-icon>
            <span>Confirm Re-Admission</span>
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .readmit-dialog-wrapper {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      width: 100%;
      min-width: 0;
      max-width: 680px;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
    }

    /* Strict Header Styling matching AGENTS.md */
    .readmit-dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .header-icon-box {
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .dialog-title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      color: #1e3a8a;
    }

    .student-meta-strip {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.82rem;
      color: #3b82f6;
      margin-top: 3px;
    }

    .student-meta-strip strong {
      color: #1e40af;
    }

    .tc-pill {
      background: #fee2e2;
      color: #b91c1c;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 0.76rem;
      border: 1px solid #fca5a5;
    }

    .close-btn {
      color: #64748b;
      transition: color 0.15s;
    }
    .close-btn:hover {
      color: #1e293b;
    }

    /* Summary Banner */
    .departure-summary-banner {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 10px 20px;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px 16px;
      font-size: 0.82rem;
    }

    .banner-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .banner-item .lbl {
      color: #64748b;
      font-weight: 500;
    }

    .banner-item .val {
      color: #0f172a;
      font-weight: 600;
    }

    .status-tag {
      background: #fef2f2;
      color: #dc2626;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 0.75rem;
      border: 1px solid #fecaca;
    }

    /* Form Body */
    .readmit-form {
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }

    .form-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .form-row {
      display: flex;
      gap: 16px;
      width: 100%;
    }

    .form-row.two-col > * {
      flex: 1;
    }

    .w-full {
      width: 100%;
    }

    .section-divider {
      margin: 6px 0;
      display: flex;
      align-items: center;
      color: #475569;
      font-size: 0.82rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .section-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e2e8f0;
      margin-left: 12px;
    }

    .checkbox-row {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 10px 14px;
    }

    .checkbox-subtext {
      font-size: 0.78rem;
      color: #15803d;
      font-weight: normal;
      margin-top: 2px;
      margin-left: 28px;
    }

    /* Footer */
    .readmit-dialog-footer {
      border-top: 1px solid #e2e8f0;
      padding: 14px 20px;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      background: #f8fafc;
    }

    .btn-confirm-readmit {
      background: #2563eb !important;
      color: #ffffff !important;
      font-weight: 600;
      padding: 0 20px;
    }

    @media (max-width: 600px) {
      .readmit-dialog-header {
        padding: 12px 14px;
        align-items: flex-start;
      }
      .header-left {
        gap: 10px;
        align-items: flex-start;
      }
      .header-icon-box {
        width: 36px;
        height: 36px;
        border-radius: 8px;
      }
      .dialog-title {
        font-size: 1.02rem;
      }
      .student-meta-strip {
        font-size: 0.76rem;
        flex-wrap: wrap;
        gap: 4px;
      }
      .departure-summary-banner {
        grid-template-columns: 1fr;
        gap: 8px;
        padding: 10px 14px;
      }
      .form-body {
        padding: 14px;
        gap: 10px;
      }
      .form-row.two-col {
        flex-direction: column;
        gap: 8px;
      }
      .readmit-dialog-footer {
        padding: 12px 14px;
        flex-direction: column-reverse;
        gap: 8px;
      }
      .readmit-dialog-footer button {
        width: 100%;
      }
    }
  `]
})
export class StudentReadmissionDialogComponent implements OnInit {
  student: any;
  readmitForm!: FormGroup;
  classes: SchoolClassDto[] = [];
  allSections: SchoolSectionDto[] = [];
  filteredSections: SchoolSectionDto[] = [];
  batches: any[] = [];
  submitting = false;

  constructor(
    private dialogRef: MatDialogRef<StudentReadmissionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: StudentReadmissionDialogData,
    private fb: FormBuilder,
    private coachingService: CoachingService,
    private schoolService: SchoolService,
    private confirmDialog: ConfirmDialogService
  ) {
    this.student = data.student;
  }

  ngOnInit(): void {
    const today = new Date().toISOString().substring(0, 10);
    this.readmitForm = this.fb.group({
      reAdmissionDate: [today, Validators.required],
      reAdmissionFee: [0, [Validators.min(0)]],
      classId: [this.student?.classId || null],
      sectionId: [this.student?.sectionId || null],
      batchId: [this.student?.batchId || null],
      newRollNumber: [''],
      remarks: ['Student re-admitted after review', Validators.required],
      resetTC: [true]
    });

    this.loadClassesAndBatches();
  }

  loadClassesAndBatches(): void {
    this.schoolService.getClasses(true).subscribe({
      next: (cls) => {
        this.classes = cls;
        if (this.student?.classId) {
          this.onClassChange(this.student.classId);
        }
      }
    });

    this.schoolService.getSections().subscribe({
      next: (secs) => {
        this.allSections = secs;
        if (this.student?.classId) {
          this.filteredSections = secs.filter(s => s.classId === this.student.classId);
        }
      }
    });

    this.coachingService.getBatches().subscribe({
      next: (b) => {
        this.batches = b;
      }
    });
  }

  onClassChange(classId: string): void {
    if (!classId) {
      this.filteredSections = [];
      this.readmitForm.patchValue({ sectionId: null });
      return;
    }
    this.filteredSections = this.allSections.filter(s => s.classId === classId);
    if (!this.filteredSections.some(s => s.id === this.readmitForm.get('sectionId')?.value)) {
      this.readmitForm.patchValue({ sectionId: this.filteredSections[0]?.id || null });
    }
  }

  closeDialog(result?: any): void {
    this.dialogRef.close(result);
  }

  submitReAdmission(): void {
    if (this.readmitForm.invalid || this.submitting) return;

    this.submitting = true;
    const formVal = this.readmitForm.value;

    const payload = {
      reAdmissionDate: new Date(formVal.reAdmissionDate).toISOString(),
      remarks: formVal.remarks,
      classId: formVal.classId || undefined,
      sectionId: formVal.sectionId || undefined,
      batchId: formVal.batchId || undefined,
      newRollNumber: formVal.newRollNumber?.trim() || undefined,
      reAdmissionFee: Number(formVal.reAdmissionFee) || 0,
      resetTC: formVal.resetTC === true
    };

    this.coachingService.reAdmitStudent(this.student.id, payload).subscribe({
      next: (res) => {
        this.submitting = false;
        this.confirmDialog.alert(
          'Re-Admission Complete',
          res?.message || `${this.student.studentName} has been successfully re-admitted to the institution.`,
          'success'
        );
        this.closeDialog({ reAdmitted: true, student: this.student });
      },
      error: (err) => {
        this.submitting = false;
        this.confirmDialog.alert(
          'Re-Admission Failed',
          err.error?.message || 'Failed to re-admit student. Please try again.',
          'danger'
        );
      }
    });
  }
}
