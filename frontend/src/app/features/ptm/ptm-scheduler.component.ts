import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { BranchService, Branch } from '../../core/services/branch.service';
import { CoachingService } from '../../core/services/coaching.service';
import { SchoolService } from '../../core/services/school.service';
import { PtmService, PtmSession, PtmBooking, PtmStats } from '../../core/services/ptm.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

// ─── Dialog: Schedule PTM Session ──────────────────────────────────────────
@Component({
  selector: 'app-create-ptm-session-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="dialog-header-left">
          <div class="dialog-icon-box">
            <mat-icon>{{ data.isEdit ? 'edit_calendar' : 'add_circle' }}</mat-icon>
          </div>
          <div>
            <h2 class="dialog-title">{{ data.isEdit ? 'Edit PTM Session' : 'Schedule New PTM Session' }}</h2>
            <span class="dialog-subtitle">Parent-Teacher Meeting &bull; <strong>Front Desk Conference Desk</strong></span>
          </div>
        </div>
        <button mat-icon-button class="dialog-close-btn" (click)="dialogRef.close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="dialog-body">
        <div class="form-row full-width">
          <mat-form-field appearance="outline" class="w-100">
            <mat-label>Meeting Session Title *</mat-label>
            <input matInput formControlName="title" placeholder="e.g. Term 1 Progress Review PTM 2026-27" />
          </mat-form-field>
        </div>

        <div class="form-row two-col">
          <mat-form-field appearance="outline">
            <mat-label>Meeting Date *</mat-label>
            <input matInput type="date" formControlName="meetingDate" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Academic Year</mat-label>
            <input matInput formControlName="academicYear" placeholder="e.g. 2026-2027" />
          </mat-form-field>
        </div>

        <div class="form-row three-col">
          <mat-form-field appearance="outline">
            <mat-label>Start Time *</mat-label>
            <input matInput formControlName="startTime" placeholder="09:00 AM" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>End Time *</mat-label>
            <input matInput formControlName="endTime" placeholder="01:30 PM" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Meeting Mode *</mat-label>
            <mat-select formControlName="meetingMode">
              <mat-option value="In-Person">In-Person (Campus)</mat-option>
              <mat-option value="Virtual / Online">Virtual / Online (Google Meet/Zoom)</mat-option>
              <mat-option value="Hybrid">Hybrid (Both)</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row two-col">
          <mat-form-field appearance="outline">
            <mat-label>Venue Room / Meeting Link</mat-label>
            <input matInput formControlName="venueOrLink" placeholder="Auditorium / Room 104 or Meet link" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Division / Stream Scope *</mat-label>
            <mat-select formControlName="divisionScope">
              <mat-option value="All">All Streams (School & Coaching)</mat-option>
              <mat-option value="School">School Academic Classes</mat-option>
              <mat-option value="Coaching">Coaching Batches</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row two-col">
          <mat-form-field appearance="outline" *ngIf="form.get('divisionScope')?.value !== 'Coaching'">
            <mat-label>Target School Class / Scope</mat-label>
            <mat-select formControlName="targetClassName">
              <mat-option value="All Classes">All Classes (Whole School)</mat-option>
              <mat-option *ngFor="let c of classes" [value]="c.name">{{ c.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" *ngIf="form.get('divisionScope')?.value === 'Coaching'">
            <mat-label>Target Coaching Batch</mat-label>
            <mat-select formControlName="targetBatchId" (selectionChange)="onBatchChange($event.value)">
              <mat-option [value]="null">All Coaching Batches</mat-option>
              <mat-option *ngFor="let b of batches" [value]="b.id">{{ b.name }} ({{ b.subject }}){{ b.className ? ' [' + b.className + ']' : '' }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Organizer / Host Officer *</mat-label>
            <input matInput formControlName="organizerName" placeholder="Principal / Academic Coordinator" />
          </mat-form-field>
        </div>

        <div class="form-row full-width">
          <mat-form-field appearance="outline" class="w-100">
            <mat-label>Status</mat-label>
            <mat-select formControlName="status">
              <mat-option value="Scheduled">Scheduled</mat-option>
              <mat-option value="In-Progress">In-Progress</mat-option>
              <mat-option value="Completed">Completed</mat-option>
              <mat-option value="Cancelled">Cancelled</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row full-width">
          <mat-form-field appearance="outline" class="w-100">
            <mat-label>Agenda & Parent Notice Instructions</mat-label>
            <textarea matInput rows="3" formControlName="agenda" placeholder="Discussion on mid-term performance, homework regularity, and school events..."></textarea>
          </mat-form-field>
        </div>

        <div class="dialog-actions">
          <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || isSaving">
            <mat-icon>{{ isSaving ? 'hourglass_top' : 'check' }}</mat-icon>
            {{ data.isEdit ? 'Update Session' : 'Schedule Session' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .dialog-container { display: flex; flex-direction: column; width: 620px; max-width: 95vw; }
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .dialog-header-left { display: flex; align-items: center; gap: 14px; }
    .dialog-icon-box {
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      width: 42px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }
    .dialog-title { margin: 0; font-size: 1.15rem; font-weight: 700; color: #1e3a8a; }
    .dialog-subtitle { font-size: 0.8rem; color: #3b82f6; display: block; }
    .dialog-close-btn { color: #64748b; }
    .dialog-close-btn:hover { color: #1e293b; }
    .dialog-body { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
    .form-row { display: flex; gap: 14px; }
    .form-row.two-col > * { flex: 1; }
    .form-row.three-col > * { flex: 1; }
    .w-100 { width: 100%; }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; padding-top: 12px; border-top: 1px solid #f1f5f9; }
  `]
})
export class CreatePtmSessionDialogComponent implements OnInit {
  dialogRef = inject(MatDialogRef<CreatePtmSessionDialogComponent>);
  data = inject(MAT_DIALOG_DATA);
  private fb = inject(FormBuilder);
  private ptmService = inject(PtmService);
  private schoolService = inject(SchoolService);
  private coachingService = inject(CoachingService);

  form!: FormGroup;
  classes: any[] = [];
  batches: any[] = [];
  isSaving = false;

  ngOnInit() {
    const s = this.data.session;
    const defaultDate = s?.meetingDate ? s.meetingDate.split('T')[0] : new Date().toISOString().split('T')[0];

    this.form = this.fb.group({
      title: [s?.title || '', Validators.required],
      academicYear: [s?.academicYear || '2026-2027'],
      meetingDate: [defaultDate, Validators.required],
      startTime: [s?.startTime || '09:00 AM', Validators.required],
      endTime: [s?.endTime || '01:30 PM', Validators.required],
      meetingMode: [s?.meetingMode || 'In-Person', Validators.required],
      venueOrLink: [s?.venueOrLink || ''],
      divisionScope: [s?.divisionScope || 'All', Validators.required],
      targetClassName: [s?.targetClassName || 'All Classes'],
      targetBatchId: [s?.targetBatchId || null],
      targetBatchName: [s?.targetBatchName || ''],
      organizerName: [s?.organizerName || 'Academic Coordinator', Validators.required],
      agenda: [s?.agenda || ''],
      status: [s?.status || 'Scheduled']
    });

    this.loadClasses();
    this.loadBatches();
  }

  loadClasses() {
    this.schoolService.getClasses(true).subscribe({
      next: (res: any[]) => { this.classes = res || []; },
      error: () => {}
    });
  }

  loadBatches() {
    this.coachingService.getBatches().subscribe({
      next: (res: any[]) => { this.batches = res || []; },
      error: () => {}
    });
  }

  onBatchChange(batchId: string | null) {
    if (!batchId) {
      this.form.patchValue({ targetBatchName: 'All Coaching Batches' });
    } else {
      const b = this.batches.find(x => x.id === batchId);
      this.form.patchValue({ targetBatchName: b ? `${b.name} (${b.subject})` : '' });
    }
  }

  onSubmit() {
    if (this.form.invalid) return;
    this.isSaving = true;

    const payload = this.form.value;
    if (this.data.isEdit && this.data.session?.id) {
      this.ptmService.updateSession(this.data.session.id, payload).subscribe({
        next: () => {
          this.isSaving = false;
          this.dialogRef.close(true);
        },
        error: () => { this.isSaving = false; }
      });
    } else {
      this.ptmService.createSession(payload).subscribe({
        next: () => {
          this.isSaving = false;
          this.dialogRef.close(true);
        },
        error: () => { this.isSaving = false; }
      });
    }
  }
}

// ─── Dialog: Record PTM Attendance & Feedback ──────────────────────────────
@Component({
  selector: 'app-record-ptm-feedback-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="dialog-header-left">
          <div class="dialog-icon-box">
            <mat-icon>fact_check</mat-icon>
          </div>
          <div>
            <h2 class="dialog-title">Record PTM Feedback & Attendance</h2>
            <span class="dialog-subtitle">Student: <strong>{{ data.booking.studentName }}</strong> &bull; Class: <strong>{{ data.booking.className }}</strong></span>
          </div>
        </div>
        <button mat-icon-button class="dialog-close-btn" (click)="dialogRef.close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="dialog-body">
        <div class="student-meta-card">
          <div class="meta-item"><span>Roll / Reg #:</span><strong>{{ data.booking.admissionNumber || 'N/A' }}</strong></div>
          <div class="meta-item"><span>Parent Contact:</span><strong>{{ data.booking.parentName }} ({{ data.booking.parentPhone || 'No Phone' }})</strong></div>
          <div class="meta-item"><span>Meeting:</span><strong>{{ data.booking.sessionTitle }}</strong></div>
        </div>

        <div class="form-row two-col">
          <mat-form-field appearance="outline">
            <mat-label>Parent Attendance *</mat-label>
            <mat-select formControlName="parentAttended">
              <mat-option value="Both">Both (Father & Mother)</mat-option>
              <mat-option value="Father">Father Only</mat-option>
              <mat-option value="Mother">Mother Only</mat-option>
              <mat-option value="Guardian">Guardian</mat-option>
              <mat-option value="Attended">Attended</mat-option>
              <mat-option value="Absent">Absent</mat-option>
              <mat-option value="Cancelled">Cancelled</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Slot Time</mat-label>
            <input matInput formControlName="slotTime" placeholder="e.g. 10:15 AM - 10:30 AM" />
          </mat-form-field>
        </div>

        <div class="form-row full-width">
          <mat-form-field appearance="outline" class="w-100">
            <mat-label>Teacher Remarks & Observations *</mat-label>
            <textarea matInput rows="3" formControlName="teacherFeedback" placeholder="Academic progress, classroom attentiveness, homework completion..."></textarea>
          </mat-form-field>
        </div>

        <div class="form-row full-width">
          <mat-form-field appearance="outline" class="w-100">
            <mat-label>Parent Feedback & Requests</mat-label>
            <textarea matInput rows="2" formControlName="parentFeedback" placeholder="Parent remarks, study routine at home, bus/canteen concerns..."></textarea>
          </mat-form-field>
        </div>

        <div class="form-row full-width">
          <mat-form-field appearance="outline" class="w-100">
            <mat-label>Action Points / Areas for Improvement</mat-label>
            <textarea matInput rows="2" formControlName="actionPoints" placeholder="Specific steps agreed on: extra math practice, daily reading, etc."></textarea>
          </mat-form-field>
        </div>

        <div class="form-row two-col">
          <mat-form-field appearance="outline">
            <mat-label>Teacher / Attending Faculty Name</mat-label>
            <input matInput formControlName="teacherName" placeholder="Class Teacher Name" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Follow-up Required?</mat-label>
            <mat-select formControlName="followUpRequired">
              <mat-option [value]="false">No Follow-up Needed</mat-option>
              <mat-option [value]="true">Yes, Needs Follow-up</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="dialog-actions">
          <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || isSaving">
            <mat-icon>{{ isSaving ? 'hourglass_top' : 'save' }}</mat-icon>
            Save & Sync to Student Profile
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .dialog-container { display: flex; flex-direction: column; width: 620px; max-width: 95vw; }
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .dialog-header-left { display: flex; align-items: center; gap: 14px; }
    .dialog-icon-box {
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      width: 42px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }
    .dialog-title { margin: 0; font-size: 1.15rem; font-weight: 700; color: #1e3a8a; }
    .dialog-subtitle { font-size: 0.8rem; color: #3b82f6; display: block; }
    .dialog-close-btn { color: #64748b; }
    .dialog-close-btn:hover { color: #1e293b; }
    .dialog-body { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
    .student-meta-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }
    .meta-item { font-size: 0.82rem; color: #64748b; display: flex; flex-direction: column; }
    .meta-item strong { color: #1e293b; font-size: 0.88rem; }
    .form-row { display: flex; gap: 14px; }
    .form-row.two-col > * { flex: 1; }
    .w-100 { width: 100%; }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; padding-top: 12px; border-top: 1px solid #f1f5f9; }
  `]
})
export class RecordPtmFeedbackDialogComponent implements OnInit {
  dialogRef = inject(MatDialogRef<RecordPtmFeedbackDialogComponent>);
  data = inject(MAT_DIALOG_DATA);
  private fb = inject(FormBuilder);
  private ptmService = inject(PtmService);

  form!: FormGroup;
  isSaving = false;

  ngOnInit() {
    const b = this.data.booking;
    this.form = this.fb.group({
      parentAttended: [b.parentAttended === 'Pending' ? 'Both' : b.parentAttended, Validators.required],
      slotTime: [b.slotTime || ''],
      teacherName: [b.teacherName || ''],
      teacherFeedback: [b.teacherFeedback || '', Validators.required],
      parentFeedback: [b.parentFeedback || ''],
      actionPoints: [b.actionPoints || ''],
      followUpRequired: [b.followUpRequired || false]
    });
  }

  onSubmit() {
    if (this.form.invalid) return;
    this.isSaving = true;

    this.ptmService.updateBooking(this.data.booking.id, this.form.value).subscribe({
      next: () => {
        this.isSaving = false;
        this.dialogRef.close(true);
      },
      error: () => { this.isSaving = false; }
    });
  }
}

// ─── Dialog: Add Student Booking / Walk-In ──────────────────────────────────
@Component({
  selector: 'app-add-ptm-booking-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="dialog-header-left">
          <div class="dialog-icon-box">
            <mat-icon>person_add</mat-icon>
          </div>
          <div>
            <h2 class="dialog-title">Enroll Student to PTM Session</h2>
            <span class="dialog-subtitle">Session: <strong>{{ data.session.title }}</strong></span>
          </div>
        </div>
        <button mat-icon-button class="dialog-close-btn" (click)="dialogRef.close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="dialog-body">
        <div class="form-row full-width">
          <mat-form-field appearance="outline" class="w-100">
            <mat-label>Search Student (Name or Roll Number) *</mat-label>
            <input matInput [matAutocomplete]="autoStudent" [formControl]="searchControl" placeholder="Type student name..." />
            <mat-autocomplete #autoStudent="matAutocomplete" (optionSelected)="onStudentSelected($event.option.value)">
              <mat-option *ngFor="let s of studentResults" [value]="s">
                {{ s.studentName }} &bull; Roll: {{ s.admissionNumber || s.rollNumber }} ({{ s.gradeClass || 'Class' }})
              </mat-option>
            </mat-autocomplete>
          </mat-form-field>
        </div>

        <div *ngIf="selectedStudent" class="selected-student-box">
          <div class="student-name">{{ selectedStudent.studentName }}</div>
          <div class="student-details">
            Admission #: {{ selectedStudent.admissionNumber || selectedStudent.rollNumber }} &bull;
            Parent: {{ selectedStudent.parentName || 'Parent' }} ({{ selectedStudent.parentWhatsAppPhone || 'N/A' }})
          </div>
        </div>

        <div class="form-row two-col">
          <mat-form-field appearance="outline">
            <mat-label>Slot Time (Optional)</mat-label>
            <input matInput formControlName="slotTime" placeholder="e.g. 10:00 AM - 10:15 AM" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Attending Teacher</mat-label>
            <input matInput formControlName="teacherName" placeholder="Teacher Name" />
          </mat-form-field>
        </div>

        <div class="dialog-actions">
          <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="!selectedStudent || isSaving">
            <mat-icon>{{ isSaving ? 'hourglass_top' : 'check' }}</mat-icon>
            Enroll Student
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .dialog-container { display: flex; flex-direction: column; width: 540px; max-width: 95vw; }
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .dialog-header-left { display: flex; align-items: center; gap: 14px; }
    .dialog-icon-box {
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      width: 42px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }
    .dialog-title { margin: 0; font-size: 1.15rem; font-weight: 700; color: #1e3a8a; }
    .dialog-subtitle { font-size: 0.8rem; color: #3b82f6; display: block; }
    .dialog-close-btn { color: #64748b; }
    .dialog-close-btn:hover { color: #1e293b; }
    .dialog-body { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
    .selected-student-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 8px;
    }
    .student-name { font-weight: 700; color: #1e40af; font-size: 0.95rem; }
    .student-details { color: #3b82f6; font-size: 0.82rem; margin-top: 4px; }
    .form-row { display: flex; gap: 14px; }
    .form-row.two-col > * { flex: 1; }
    .w-100 { width: 100%; }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 12px; border-top: 1px solid #f1f5f9; }
  `]
})
export class AddPtmBookingDialogComponent implements OnInit {
  dialogRef = inject(MatDialogRef<AddPtmBookingDialogComponent>);
  data = inject(MAT_DIALOG_DATA);
  private fb = inject(FormBuilder);
  private coachingService = inject(CoachingService);
  private ptmService = inject(PtmService);

  form!: FormGroup;
  searchControl = this.fb.control('');
  studentResults: any[] = [];
  selectedStudent: any = null;
  isSaving = false;

  ngOnInit() {
    this.form = this.fb.group({
      slotTime: [''],
      teacherName: [this.data.session.organizerName || '']
    });

    this.searchControl.valueChanges.subscribe(val => {
      if (typeof val === 'string' && val.trim().length >= 2) {
        this.coachingService.getStudentsPaged(1, 15, val.trim()).subscribe({
          next: (res) => { this.studentResults = res.items || []; },
          error: () => {}
        });
      } else if (typeof val === 'string' && val.trim().length === 0) {
        this.studentResults = [];
      }
    });
  }

  onStudentSelected(st: any) {
    this.selectedStudent = st;
    this.searchControl.setValue(st.studentName, { emitEvent: false });
  }

  onSubmit() {
    if (!this.selectedStudent) return;
    this.isSaving = true;

    const payload = {
      ptmSessionId: this.data.session.id,
      studentId: this.selectedStudent.id,
      slotTime: this.form.value.slotTime,
      teacherName: this.form.value.teacherName
    };

    this.ptmService.createBooking(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.dialogRef.close(true);
      },
      error: () => { this.isSaving = false; }
    });
  }
}

// ─── Main Component: PtmSchedulerComponent ─────────────────────────────────
@Component({
  selector: 'app-ptm-scheduler',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatTableModule,
    MatTabsModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    <div class="page-container">
      <!-- Top Title & Action Header -->
      <div class="page-header">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>calendar_month</mat-icon>
          </div>
          <div>
            <h1 class="page-title">PTM Scheduler & Parent Desk</h1>
            <p class="page-subtitle">Schedule parent-teacher conference sessions, manage slot bookings, track parent attendance, and record action points.</p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-stroked-button color="primary" routerLink="/front-desk/visitors">
            <mat-icon>arrow_back</mat-icon> Front Desk
          </button>
          <button mat-flat-button color="primary" (click)="openScheduleSessionDialog()">
            <mat-icon>add_circle</mat-icon> Schedule PTM Session
          </button>
        </div>
      </div>

      <!-- KPI Stats Ribbon -->
      <div class="kpi-grid">
        <mat-card class="kpi-card card-blue">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Total PTM Sessions</span>
              <h2 class="kpi-value">{{ stats?.totalSessions || 0 }}</h2>
              <span class="kpi-meta">All Campus Conferences</span>
            </div>
            <div class="kpi-icon-wrapper">
              <mat-icon>event</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card card-emerald">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Upcoming Sessions</span>
              <h2 class="kpi-value">{{ stats?.upcomingSessions || 0 }}</h2>
              <span class="kpi-meta">Scheduled Next 30 Days</span>
            </div>
            <div class="kpi-icon-wrapper">
              <mat-icon>schedule</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card card-indigo">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Parent Bookings</span>
              <h2 class="kpi-value">{{ stats?.totalBookings || 0 }}</h2>
              <span class="kpi-meta">{{ stats?.totalAttended || 0 }} Attended</span>
            </div>
            <div class="kpi-icon-wrapper">
              <mat-icon>people</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card card-amber">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Parent Attendance Rate</span>
              <h2 class="kpi-value">{{ stats?.attendanceRatePercentage || 0 }}%</h2>
              <span class="kpi-meta">{{ stats?.pendingFollowUps || 0 }} Follow-ups Pending</span>
            </div>
            <div class="kpi-icon-wrapper">
              <mat-icon>pie_chart</mat-icon>
            </div>
          </div>
        </mat-card>
      </div>

      <!-- Reactive Filter Deck -->
      <mat-card class="filter-card">
        <form [formGroup]="filterForm" class="filter-form">
          <div class="filter-grid">
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Campus Branch</mat-label>
              <mat-select formControlName="branchId" (selectionChange)="onFilterChanged()">
                <mat-option value="ALL">All Campuses Consolidated</mat-option>
                <mat-option *ngFor="let b of branches" [value]="b.id">{{ b.name }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Session Status</mat-label>
              <mat-select formControlName="status" (selectionChange)="onFilterChanged()">
                <mat-option value="All">All Statuses</mat-option>
                <mat-option value="Scheduled">Scheduled</mat-option>
                <mat-option value="In-Progress">In-Progress</mat-option>
                <mat-option value="Completed">Completed</mat-option>
                <mat-option value="Cancelled">Cancelled</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Academic Year</mat-label>
              <mat-select formControlName="academicYear" (selectionChange)="onFilterChanged()">
                <mat-option value="All">All Years</mat-option>
                <mat-option value="2026-2027">2026-2027</mat-option>
                <mat-option value="2025-2026">2025-2026</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Division / Stream</mat-label>
              <mat-select formControlName="divisionScope" (selectionChange)="onFilterChanged()">
                <mat-option value="All">All Streams (School & Coaching)</mat-option>
                <mat-option value="School">School Academic Classes</mat-option>
                <mat-option value="Coaching">Coaching Batches</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field search-field">
              <mat-label>Search Session or Class</mat-label>
              <input matInput formControlName="searchTerm" placeholder="Search title, class, batch, organizer..." (keyup.enter)="onFilterChanged()" />
              <button mat-icon-button matSuffix type="button" (click)="onFilterChanged()">
                <mat-icon>search</mat-icon>
              </button>
            </mat-form-field>

            <div class="filter-actions">
              <button mat-stroked-button type="button" (click)="resetFilters()">
                <mat-icon>refresh</mat-icon> Reset
              </button>
            </div>
          </div>
        </form>
      </mat-card>

      <!-- Single Prominent Loader -->
      <div *ngIf="isLoading" class="loader-container">
        <mat-spinner diameter="44"></mat-spinner>
        <span>Loading PTM records...</span>
      </div>

      <!-- Main Tabbed Work Desk -->
      <div *ngIf="!isLoading">
        <mat-tab-group [(selectedIndex)]="activeTabIndex" animationDuration="150ms">
          <!-- Tab 1: PTM Sessions -->
          <mat-tab label="PTM Sessions (बैठक सत्र)">
            <div class="tab-content">
              <div *ngIf="sessions.length === 0" class="empty-state">
                <mat-icon class="empty-icon">event_busy</mat-icon>
                <h3>No PTM sessions found</h3>
                <p>Click "Schedule PTM Session" above to create a conference event for classes, coaching batches, and parents.</p>
              </div>

              <div *ngIf="sessions.length > 0" class="table-responsive">
                <table mat-table [dataSource]="sessions" class="ptm-table">
                  <ng-container matColumnDef="title">
                    <th mat-header-cell *matHeaderCellDef>Session Title & Scope</th>
                    <td mat-cell *matCellDef="let s">
                      <div class="title-cell">
                        <div class="name-badge-row">
                          <span class="session-name">{{ s.title }}</span>
                          <span class="stream-pill" [class.coaching]="s.divisionScope === 'Coaching'" [class.school]="s.divisionScope === 'School'">
                            {{ s.divisionScope === 'Coaching' ? 'Coaching' : (s.divisionScope === 'School' ? 'School' : 'All') }}
                          </span>
                        </div>
                        <span class="session-class-badge">
                          {{ s.divisionScope === 'Coaching' ? (s.targetBatchName || 'All Coaching Batches') : (s.targetClassName || 'All Classes') }}
                        </span>
                      </div>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="dateTime">
                    <th mat-header-cell *matHeaderCellDef>Meeting Date & Timing</th>
                    <td mat-cell *matCellDef="let s">
                      <div class="date-cell">
                        <strong>{{ s.meetingDate | date:'dd MMM yyyy':'Asia/Kolkata' }}</strong>
                        <span class="timing-badge">{{ s.startTime }} - {{ s.endTime }}</span>
                      </div>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="mode">
                    <th mat-header-cell *matHeaderCellDef>Mode & Venue</th>
                    <td mat-cell *matCellDef="let s">
                      <div class="venue-cell">
                        <span class="mode-tag" [ngClass]="s.meetingMode.toLowerCase()">{{ s.meetingMode }}</span>
                        <small class="venue-text" *ngIf="s.venueOrLink">{{ s.venueOrLink }}</small>
                      </div>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="organizer">
                    <th mat-header-cell *matHeaderCellDef>Organizer</th>
                    <td mat-cell *matCellDef="let s">
                      <span class="organizer-name">{{ s.organizerName }}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="turnout">
                    <th mat-header-cell *matHeaderCellDef>Parent Turnout</th>
                    <td mat-cell *matCellDef="let s">
                      <div class="turnout-pill">
                        <strong>{{ s.attendedCount }}</strong> / {{ s.bookingsCount }}
                        <small>Attended</small>
                      </div>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>Status</th>
                    <td mat-cell *matCellDef="let s">
                      <span class="status-badge" [ngClass]="s.status.toLowerCase()">{{ s.status }}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef class="text-right">Actions</th>
                    <td mat-cell *matCellDef="let s" class="text-right">
                      <div class="action-buttons">
                        <button mat-stroked-button color="primary" class="btn-compact" (click)="openSessionBookings(s)" matTooltip="Manage Attendance & Slot Desk">
                          <mat-icon>groups</mat-icon> Desk
                        </button>
                        <button mat-icon-button color="accent" (click)="bulkEnrollClass(s)" matTooltip="Bulk Enroll Class Students">
                          <mat-icon>group_add</mat-icon>
                        </button>
                        <button mat-icon-button (click)="openEditSessionDialog(s)" matTooltip="Edit Session">
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button mat-icon-button color="warn" (click)="deleteSession(s)" matTooltip="Delete Session">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </div>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="displayedSessionColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: displayedSessionColumns;" class="interactive-row"></tr>
                </table>
              </div>
            </div>
          </mat-tab>

          <!-- Tab 2: Parent Attendance & Slot Desk -->
          <mat-tab label="Parent Attendance & Slot Desk (उपस्थिति एवं समीक्षा)">
            <div class="tab-content">
              <div class="desk-toolbar">
                <div class="desk-session-select">
                  <mat-form-field appearance="outline" class="session-dropdown">
                    <mat-label>Selected PTM Session</mat-label>
                    <mat-select [value]="selectedSessionId" (selectionChange)="onSessionDropdownChanged($event.value)">
                      <mat-option *ngFor="let s of sessions" [value]="s.id">
                        {{ s.title }} ({{ s.meetingDate | date:'dd MMM yyyy':'Asia/Kolkata' }})
                      </mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>

                <div class="desk-actions" *ngIf="activeSession">
                  <button mat-stroked-button color="accent" (click)="bulkEnrollClass(activeSession)">
                    <mat-icon>group_add</mat-icon> Bulk Enroll All Class Students
                  </button>
                  <button mat-flat-button color="primary" (click)="openAddBookingDialog()">
                    <mat-icon>person_add</mat-icon> Enroll Student / Walk-in
                  </button>
                </div>
              </div>

              <div *ngIf="bookings.length === 0" class="empty-state">
                <mat-icon class="empty-icon">person_search</mat-icon>
                <h3>No student slots booked for this session yet</h3>
                <p>Use "Bulk Enroll All Class Students" or "Enroll Student / Walk-in" to populate parents for this meeting.</p>
              </div>

              <div *ngIf="bookings.length > 0" class="table-responsive">
                <table mat-table [dataSource]="bookings" class="bookings-table">
                  <ng-container matColumnDef="student">
                    <th mat-header-cell *matHeaderCellDef>Student & Class</th>
                    <td mat-cell *matCellDef="let b">
                      <div class="student-cell">
                        <span class="st-name">{{ b.studentName }}</span>
                        <small class="st-meta">Adm #: {{ b.admissionNumber || 'N/A' }} &bull; {{ b.className }}</small>
                      </div>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="parent">
                    <th mat-header-cell *matHeaderCellDef>Parent Details</th>
                    <td mat-cell *matCellDef="let b">
                      <div class="parent-cell">
                        <strong>{{ b.parentName || 'Parent' }}</strong>
                        <small class="phone-link">{{ b.parentPhone || 'No Phone' }}</small>
                      </div>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="slot">
                    <th mat-header-cell *matHeaderCellDef>Slot Time</th>
                    <td mat-cell *matCellDef="let b">
                      <span class="slot-pill">{{ b.slotTime || 'Open / Walk-in' }}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="attendance">
                    <th mat-header-cell *matHeaderCellDef>Attendance</th>
                    <td mat-cell *matCellDef="let b">
                      <span class="attendance-badge" [ngClass]="b.parentAttended.toLowerCase()">
                        {{ b.parentAttended }}
                      </span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="feedback">
                    <th mat-header-cell *matHeaderCellDef>Teacher Remarks & Action Points</th>
                    <td mat-cell *matCellDef="let b">
                      <div class="feedback-cell" *ngIf="b.teacherFeedback">
                        <span class="teacher-remarks">{{ b.teacherFeedback }}</span>
                        <small class="action-points" *ngIf="b.actionPoints"><strong>Action:</strong> {{ b.actionPoints }}</small>
                      </div>
                      <span *ngIf="!b.teacherFeedback" class="text-muted">No remarks yet</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="followUp">
                    <th mat-header-cell *matHeaderCellDef>Follow-up</th>
                    <td mat-cell *matCellDef="let b">
                      <span *ngIf="b.followUpRequired" class="followup-badge">
                        <mat-icon>flag</mat-icon> Required
                      </span>
                      <span *ngIf="!b.followUpRequired" class="text-muted">&mdash;</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef class="text-right">Actions</th>
                    <td mat-cell *matCellDef="let b" class="text-right">
                      <div class="action-buttons">
                        <button mat-flat-button color="primary" class="btn-compact" (click)="openRecordFeedbackDialog(b)">
                          <mat-icon>fact_check</mat-icon> Record
                        </button>
                        <button mat-icon-button color="warn" (click)="deleteBooking(b)" matTooltip="Remove Booking">
                          <mat-icon>close</mat-icon>
                        </button>
                      </div>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="displayedBookingColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: displayedBookingColumns;"></tr>
                </table>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    .page-container {
      padding: 0 0 40px;
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .header-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .header-icon {
      background: #2563eb;
      color: #ffffff;
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }
    .page-title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #0f172a;
    }
    .page-subtitle {
      margin: 4px 0 0;
      color: #64748b;
      font-size: 0.88rem;
    }
    .header-actions {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    @media (max-width: 1024px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 640px) {
      .kpi-grid { grid-template-columns: 1fr; }
    }
    .kpi-card {
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .kpi-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .kpi-label { font-size: 0.82rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-value { font-size: 1.85rem; font-weight: 800; margin: 6px 0 2px; }
    .kpi-meta { font-size: 0.78rem; opacity: 0.85; }
    .kpi-icon-wrapper {
      width: 46px;
      height: 46px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .card-blue { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
    .card-blue .kpi-icon-wrapper { background: #dbeafe; color: #2563eb; }

    .card-emerald { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    .card-emerald .kpi-icon-wrapper { background: #d1fae5; color: #059669; }

    .card-indigo { background: #eef2ff; color: #3730a3; border: 1px solid #c7d2fe; }
    .card-indigo .kpi-icon-wrapper { background: #e0e7ff; color: #4f46e5; }

    .card-amber { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
    .card-amber .kpi-icon-wrapper { background: #fef3c7; color: #d97706; }

    /* Filter Deck */
    .filter-card {
      border-radius: 12px;
      padding: 14px 18px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
    }
    .filter-grid {
      display: flex;
      gap: 14px;
      align-items: center;
      flex-wrap: wrap;
    }
    .filter-field {
      flex: 1;
      min-width: 180px;
    }
    .search-field {
      flex: 2;
      min-width: 240px;
    }
    .filter-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    /* Single Loader */
    .loader-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 0;
      gap: 16px;
      color: #64748b;
    }

    /* Tab Content & Tables */
    .tab-content {
      padding: 16px 0;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .table-responsive {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      white-space: nowrap;
    }
    th.mat-header-cell {
      background: #f8fafc;
      color: #475569;
      font-weight: 700;
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 14px 16px;
    }
    td.mat-cell {
      padding: 14px 16px;
      font-size: 0.88rem;
      color: #1e293b;
      border-bottom: 1px solid #f1f5f9;
    }
    .text-right { text-align: right; }

    .title-cell { display: flex; flex-direction: column; gap: 4px; }
    .name-badge-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .session-name { font-weight: 700; color: #1e40af; font-size: 0.95rem; }
    .stream-pill {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 4px;
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #cbd5e1;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .stream-pill.school {
      background: #eff6ff;
      color: #1d4ed8;
      border-color: #bfdbfe;
    }
    .stream-pill.coaching {
      background: #fdf4ff;
      color: #a21caf;
      border-color: #f0abfc;
    }
    .session-class-badge {
      display: inline-block;
      background: #f1f5f9;
      color: #475569;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.76rem;
      width: fit-content;
    }
    .date-cell { display: flex; flex-direction: column; gap: 2px; }
    .timing-badge { font-size: 0.78rem; color: #64748b; }
    .venue-cell { display: flex; flex-direction: column; gap: 2px; }
    .mode-tag {
      font-size: 0.76rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 6px;
      width: fit-content;
      background: #e0f2fe;
      color: #0369a1;
    }
    .venue-text { color: #64748b; font-size: 0.78rem; }
    .organizer-name { color: #334155; font-weight: 500; }
    .turnout-pill {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.82rem;
      width: fit-content;
    }
    .status-badge {
      font-size: 0.78rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 20px;
      text-transform: capitalize;
    }
    .status-badge.scheduled { background: #dbeafe; color: #1e40af; }
    .status-badge.in-progress { background: #fef3c7; color: #92400e; }
    .status-badge.completed { background: #d1fae5; color: #065f46; }
    .status-badge.cancelled { background: #fee2e2; color: #991b1b; }

    .action-buttons { display: flex; gap: 6px; justify-content: flex-end; align-items: center; }
    .btn-compact { font-size: 0.8rem; height: 32px; padding: 0 10px; }

    /* Desk Toolbar */
    .desk-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 14px;
      background: #f8fafc;
      padding: 12px 16px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
    }
    .session-dropdown { min-width: 320px; }
    .desk-actions { display: flex; gap: 10px; }

    /* Student & Parent cells in Booking desk */
    .student-cell { display: flex; flex-direction: column; gap: 2px; }
    .st-name { font-weight: 700; color: #0f172a; }
    .st-meta { color: #64748b; font-size: 0.78rem; }
    .parent-cell { display: flex; flex-direction: column; gap: 2px; }
    .phone-link { color: #2563eb; font-size: 0.78rem; }
    .slot-pill {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.78rem;
    }
    .attendance-badge {
      font-size: 0.76rem;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 12px;
    }
    .attendance-badge.pending { background: #f1f5f9; color: #64748b; }
    .attendance-badge.attended,
    .attendance-badge.both,
    .attendance-badge.father,
    .attendance-badge.mother,
    .attendance-badge.guardian { background: #d1fae5; color: #065f46; }
    .attendance-badge.absent { background: #fee2e2; color: #991b1b; }

    .feedback-cell { display: flex; flex-direction: column; gap: 2px; max-width: 300px; white-space: normal; }
    .teacher-remarks { font-size: 0.84rem; color: #1e293b; }
    .action-points { color: #2563eb; font-size: 0.78rem; }
    .followup-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #d97706;
      font-weight: 600;
      font-size: 0.78rem;
    }
    .followup-badge mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
      background: #ffffff;
      border-radius: 12px;
      border: 1px dashed #cbd5e1;
    }
    .empty-icon { font-size: 48px; width: 48px; height: 48px; color: #94a3b8; margin-bottom: 12px; }
    .empty-state h3 { margin: 0; color: #334155; font-size: 1.1rem; }
    .empty-state p { color: #64748b; font-size: 0.88rem; max-width: 440px; margin: 6px 0 0; }
  `]
})
export class PtmSchedulerComponent implements OnInit {
  private ptmService = inject(PtmService);
  private branchService = inject(BranchService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);
  private confirmDialog = inject(ConfirmDialogService);

  filterForm!: FormGroup;
  branches: Branch[] = [];
  stats: PtmStats | null = null;
  sessions: PtmSession[] = [];
  bookings: PtmBooking[] = [];
  activeSession: PtmSession | null = null;
  selectedSessionId: string | null = null;
  activeTabIndex = 0;
  isLoading = false;

  displayedSessionColumns: string[] = ['title', 'dateTime', 'mode', 'organizer', 'turnout', 'status', 'actions'];
  displayedBookingColumns: string[] = ['student', 'parent', 'slot', 'attendance', 'feedback', 'followUp', 'actions'];

  ngOnInit() {
    const activeBranch = this.authService.selectedBranchId() || 'ALL';

    this.filterForm = this.fb.group({
      branchId: [activeBranch],
      status: ['All'],
      academicYear: ['All'],
      divisionScope: ['All'],
      searchTerm: ['']
    });

    this.loadBranches();
    this.loadStats();
    this.loadSessions();
  }

  loadBranches() {
    this.branchService.getBranches().subscribe({
      next: (res) => { this.branches = res || []; },
      error: () => {}
    });
  }

  loadStats() {
    const branchId = this.filterForm.value.branchId === 'ALL' ? null : this.filterForm.value.branchId;
    this.ptmService.getStats(branchId).subscribe({
      next: (res) => { this.stats = res; },
      error: () => {}
    });
  }

  loadSessions() {
    this.isLoading = true;
    const branchId = this.filterForm.value.branchId === 'ALL' ? null : this.filterForm.value.branchId;
    const filters = {
      branchId,
      status: this.filterForm.value.status,
      academicYear: this.filterForm.value.academicYear,
      divisionScope: this.filterForm.value.divisionScope,
      searchTerm: this.filterForm.value.searchTerm
    };

    this.ptmService.getSessions(filters).subscribe({
      next: (res) => {
        this.sessions = res || [];
        this.isLoading = false;

        if (this.sessions.length > 0 && !this.selectedSessionId) {
          this.selectedSessionId = this.sessions[0].id;
          this.activeSession = this.sessions[0];
          this.loadBookingsForSelectedSession();
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.confirmDialog.alert('Error', err.error?.message || 'Failed to load PTM sessions.', 'danger');
      }
    });
  }

  onFilterChanged() {
    this.loadStats();
    this.loadSessions();
  }

  resetFilters() {
    this.filterForm.patchValue({
      status: 'All',
      academicYear: 'All',
      divisionScope: 'All',
      searchTerm: ''
    });
    this.onFilterChanged();
  }

  openScheduleSessionDialog() {
    const ref = this.dialog.open(CreatePtmSessionDialogComponent, {
      width: '640px',
      data: { isEdit: false }
    });

    ref.afterClosed().subscribe(res => {
      if (res) {
        this.confirmDialog.alert('Scheduled', 'PTM session scheduled successfully!', 'success');
        this.loadStats();
        this.loadSessions();
      }
    });
  }

  openEditSessionDialog(session: PtmSession) {
    const ref = this.dialog.open(CreatePtmSessionDialogComponent, {
      width: '640px',
      data: { isEdit: true, session }
    });

    ref.afterClosed().subscribe(res => {
      if (res) {
        this.confirmDialog.alert('Updated', 'PTM session updated successfully!', 'success');
        this.loadStats();
        this.loadSessions();
      }
    });
  }

  deleteSession(session: PtmSession) {
    this.confirmDialog.confirm(
      'Delete PTM Session?',
      `Are you sure you want to delete '${session.title}'? All enrolled bookings and records will be deleted.`,
      'Delete Session',
      'Cancel',
      'danger'
    ).subscribe(confirmed => {
      if (confirmed) {
        this.ptmService.deleteSession(session.id).subscribe({
          next: () => {
            this.confirmDialog.alert('Deleted', 'Session deleted successfully.', 'success');
            if (this.selectedSessionId === session.id) {
              this.selectedSessionId = null;
              this.activeSession = null;
            }
            this.loadStats();
            this.loadSessions();
          },
          error: (err) => {
            this.confirmDialog.alert('Error', err.error?.message || 'Failed to delete session.', 'danger');
          }
        });
      }
    });
  }

  openSessionBookings(session: PtmSession) {
    this.selectedSessionId = session.id;
    this.activeSession = session;
    this.activeTabIndex = 1;
    this.loadBookingsForSelectedSession();
  }

  onSessionDropdownChanged(sessionId: string) {
    this.selectedSessionId = sessionId;
    this.activeSession = this.sessions.find(s => s.id === sessionId) || null;
    this.loadBookingsForSelectedSession();
  }

  loadBookingsForSelectedSession() {
    if (!this.selectedSessionId) return;
    this.ptmService.getBookings({ sessionId: this.selectedSessionId }).subscribe({
      next: (res) => { this.bookings = res || []; },
      error: () => {}
    });
  }

  bulkEnrollClass(session: PtmSession) {
    this.confirmDialog.confirm(
      'Bulk Enroll Students?',
      `Enroll all active students of '${session.targetClassName || 'Whole School'}' into '${session.title}'?`,
      'Enroll All',
      'Cancel',
      'info'
    ).subscribe(confirmed => {
      if (confirmed) {
        this.isLoading = true;
        this.ptmService.bulkEnroll(session.id).subscribe({
          next: (res) => {
            this.isLoading = false;
            this.confirmDialog.alert('Enrolled', res.message, 'success');
            this.loadStats();
            this.loadSessions();
            if (this.selectedSessionId === session.id) {
              this.loadBookingsForSelectedSession();
            }
          },
          error: (err) => {
            this.isLoading = false;
            this.confirmDialog.alert('Error', err.error?.message || 'Failed to enroll students.', 'danger');
          }
        });
      }
    });
  }

  openAddBookingDialog() {
    if (!this.activeSession) return;
    const ref = this.dialog.open(AddPtmBookingDialogComponent, {
      width: '560px',
      data: { session: this.activeSession }
    });

    ref.afterClosed().subscribe(res => {
      if (res) {
        this.confirmDialog.alert('Enrolled', 'Student enrolled in PTM session.', 'success');
        this.loadStats();
        this.loadSessions();
        this.loadBookingsForSelectedSession();
      }
    });
  }

  openRecordFeedbackDialog(booking: PtmBooking) {
    const ref = this.dialog.open(RecordPtmFeedbackDialogComponent, {
      width: '640px',
      data: { booking }
    });

    ref.afterClosed().subscribe(res => {
      if (res) {
        this.confirmDialog.alert('Saved', 'Feedback saved and synchronized with Student 360 profile!', 'success');
        this.loadStats();
        this.loadSessions();
        this.loadBookingsForSelectedSession();
      }
    });
  }

  deleteBooking(booking: PtmBooking) {
    this.confirmDialog.confirm(
      'Remove Booking?',
      `Remove '${booking.studentName}' from this PTM session?`,
      'Remove',
      'Cancel',
      'danger'
    ).subscribe(confirmed => {
      if (confirmed) {
        this.ptmService.deleteBooking(booking.id).subscribe({
          next: () => {
            this.confirmDialog.alert('Removed', 'Booking removed successfully.', 'success');
            this.loadStats();
            this.loadSessions();
            this.loadBookingsForSelectedSession();
          },
          error: (err) => {
            this.confirmDialog.alert('Error', err.error?.message || 'Failed to remove booking.', 'danger');
          }
        });
      }
    });
  }
}
