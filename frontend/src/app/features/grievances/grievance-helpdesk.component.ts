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
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { BranchService, Branch } from '../../core/services/branch.service';
import { CoachingService } from '../../core/services/coaching.service';
import { GrievanceService, GrievanceTicket, GrievanceComment, GrievanceStats } from '../../core/services/grievance.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

// ─── Dialog: Log New Grievance Ticket ──────────────────────────────────────
@Component({
  selector: 'app-log-grievance-dialog',
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
    MatAutocompleteModule,
    MatSlideToggleModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="dialog-header-left">
          <div class="dialog-icon-box">
            <mat-icon>report_problem</mat-icon>
          </div>
          <div>
            <h2 class="dialog-title">Log Grievance / Complain Ticket</h2>
            <span class="dialog-subtitle">Parent, Student & Staff Redressal &bull; <strong>Front Desk Helpdesk</strong></span>
          </div>
        </div>
        <button mat-icon-button class="dialog-close-btn" (click)="dialogRef.close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="dialog-body">
        <!-- Student Link Toggle -->
        <div class="student-toggle-bar">
          <mat-slide-toggle [checked]="isStudentLinked" (change)="toggleStudentLink($event.checked)">
            Relates to an Enrolled Student?
          </mat-slide-toggle>
        </div>

        <div *ngIf="isStudentLinked" class="form-row full-width">
          <mat-form-field appearance="outline" class="w-100">
            <mat-label>Search Student (Name or Roll #)</mat-label>
            <input matInput [matAutocomplete]="autoStudent" [formControl]="studentSearchControl" placeholder="Type name or roll number..." />
            <mat-autocomplete #autoStudent="matAutocomplete" (optionSelected)="onStudentSelected($event.option.value)">
              <mat-option *ngFor="let s of studentResults" [value]="s">
                {{ s.studentName }} &bull; Roll: {{ s.admissionNumber || s.rollNumber }} ({{ s.gradeClass || 'Class' }})
              </mat-option>
            </mat-autocomplete>
          </mat-form-field>
        </div>

        <div *ngIf="selectedStudent && isStudentLinked" class="selected-student-box">
          <div class="student-name">{{ selectedStudent.studentName }}</div>
          <div class="student-details">
            Class: {{ selectedStudent.gradeClass || 'N/A' }} &bull;
            Parent: {{ selectedStudent.parentName || 'Parent' }} &bull;
            Phone: {{ selectedStudent.parentWhatsAppPhone || 'N/A' }}
          </div>
        </div>

        <div class="form-row three-col">
          <mat-form-field appearance="outline">
            <mat-label>Raised By Name *</mat-label>
            <input matInput formControlName="raisedByName" placeholder="Parent or Staff Name" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Raised By Role *</mat-label>
            <mat-select formControlName="raisedByRole">
              <mat-option value="Parent">Parent</mat-option>
              <mat-option value="Student">Student</mat-option>
              <mat-option value="Staff">Staff Member</mat-option>
              <mat-option value="Visitor">Visitor / Public</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Contact Phone *</mat-label>
            <input matInput formControlName="contactPhone" placeholder="Mobile number" />
          </mat-form-field>
        </div>

        <div class="form-row two-col">
          <mat-form-field appearance="outline">
            <mat-label>Category *</mat-label>
            <mat-select formControlName="category">
              <mat-option value="Academic">Academic (Teaching, Homework, Exams)</mat-option>
              <mat-option value="Fee & Billing">Fee & Billing (Receipts, Dues, Concessions)</mat-option>
              <mat-option value="Transport">Transport (Bus Route, Delays, Safety)</mat-option>
              <mat-option value="Hostel">Hostel & Mess (Food, Hygiene, Rooms)</mat-option>
              <mat-option value="Discipline & Safety">Discipline & Safety (Peer conflict, bullying)</mat-option>
              <mat-option value="Infrastructure">Infrastructure (Water, Fans, Cleanliness)</mat-option>
              <mat-option value="Staff Behavior">Staff / Faculty Behavior</mat-option>
              <mat-option value="Other">Other / General Issue</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Priority Level *</mat-label>
            <mat-select formControlName="priority">
              <mat-option value="Low">Low (General suggestion)</mat-option>
              <mat-option value="Medium">Medium (Standard query)</mat-option>
              <mat-option value="High">High (Needs quick resolution)</mat-option>
              <mat-option value="Urgent">Urgent (Immediate attention)</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row full-width">
          <mat-form-field appearance="outline" class="w-100">
            <mat-label>Grievance Subject / Title *</mat-label>
            <input matInput formControlName="subject" placeholder="Brief subject of the complaint..." />
          </mat-form-field>
        </div>

        <div class="form-row full-width">
          <mat-form-field appearance="outline" class="w-100">
            <mat-label>Detailed Description of Issue *</mat-label>
            <textarea matInput rows="3" formControlName="description" placeholder="Describe the grievance in detail with dates, places, persons involved..."></textarea>
          </mat-form-field>
        </div>

        <div class="form-row two-col">
          <mat-form-field appearance="outline">
            <mat-label>Assignee / Department Officer</mat-label>
            <input matInput formControlName="assignedToName" placeholder="e.g. Transport Manager / Principal Office" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Contact Email (Optional)</mat-label>
            <input matInput formControlName="contactEmail" placeholder="parent@gmail.com" />
          </mat-form-field>
        </div>

        <div class="dialog-actions">
          <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || isSaving">
            <mat-icon>{{ isSaving ? 'hourglass_top' : 'send' }}</mat-icon>
            Log Grievance Ticket
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .dialog-container { display: flex; flex-direction: column; width: 640px; max-width: 95vw; }
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
    .student-toggle-bar {
      background: #f8fafc;
      padding: 8px 14px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      margin-bottom: 4px;
    }
    .selected-student-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 4px;
    }
    .student-name { font-weight: 700; color: #1e40af; font-size: 0.92rem; }
    .student-details { color: #3b82f6; font-size: 0.8rem; margin-top: 2px; }
    .form-row { display: flex; gap: 14px; }
    .form-row.two-col > * { flex: 1; }
    .form-row.three-col > * { flex: 1; }
    .w-100 { width: 100%; }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 12px; border-top: 1px solid #f1f5f9; }
  `]
})
export class LogGrievanceDialogComponent implements OnInit {
  dialogRef = inject(MatDialogRef<LogGrievanceDialogComponent>);
  private fb = inject(FormBuilder);
  private coachingService = inject(CoachingService);
  private grievanceService = inject(GrievanceService);

  form!: FormGroup;
  studentSearchControl = this.fb.control('');
  studentResults: any[] = [];
  selectedStudent: any = null;
  isStudentLinked = true;
  isSaving = false;

  ngOnInit() {
    this.form = this.fb.group({
      divisionScope: ['All'],
      raisedByName: ['', Validators.required],
      raisedByRole: ['Parent', Validators.required],
      contactPhone: ['', Validators.required],
      contactEmail: [''],
      category: ['Academic', Validators.required],
      priority: ['Medium', Validators.required],
      subject: ['', Validators.required],
      description: ['', Validators.required],
      assignedToName: ['Grievance Redressal Desk']
    });

    this.studentSearchControl.valueChanges.subscribe(val => {
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

  toggleStudentLink(linked: boolean) {
    this.isStudentLinked = linked;
    if (!linked) {
      this.selectedStudent = null;
      this.studentSearchControl.setValue('');
    }
  }

  onStudentSelected(st: any) {
    this.selectedStudent = st;
    this.studentSearchControl.setValue(st.studentName, { emitEvent: false });

    // Auto-fill parent info if blank
    if (!this.form.value.raisedByName && st.parentName) {
      this.form.patchValue({
        raisedByName: `${st.parentName} (Parent)`,
        contactPhone: st.parentWhatsAppPhone || ''
      });
    }

    // Auto-detect division scope from student
    if (st.classId && st.batchId) {
      this.form.patchValue({ divisionScope: 'Dual' });
    } else if (st.batchId) {
      this.form.patchValue({ divisionScope: 'Coaching' });
    } else if (st.classId) {
      this.form.patchValue({ divisionScope: 'School' });
    }
  }

  onSubmit() {
    if (this.form.invalid) return;
    this.isSaving = true;

    const payload = {
      studentId: this.isStudentLinked ? this.selectedStudent?.id : null,
      divisionScope: this.form.value.divisionScope,
      raisedByName: this.form.value.raisedByName,
      raisedByRole: this.form.value.raisedByRole,
      contactPhone: this.form.value.contactPhone,
      contactEmail: this.form.value.contactEmail,
      category: this.form.value.category,
      priority: this.form.value.priority,
      subject: this.form.value.subject,
      description: this.form.value.description,
      assignedToName: this.form.value.assignedToName
    };

    this.grievanceService.createTicket(payload).subscribe({
      next: (ticket) => {
        this.isSaving = false;
        this.dialogRef.close(ticket);
      },
      error: () => { this.isSaving = false; }
    });
  }
}

// ─── Dialog: Grievance Details, Resolution & Activity Log ──────────────────
@Component({
  selector: 'app-grievance-details-dialog',
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
    MatChipsModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="dialog-header-left">
          <div class="dialog-icon-box">
            <mat-icon>confirmation_number</mat-icon>
          </div>
          <div>
            <h2 class="dialog-title">Ticket {{ ticket.ticketNumber }}</h2>
            <span class="dialog-subtitle">Status: <strong [style.color]="getStatusColor(ticket.status)">{{ ticket.status }}</strong> &bull; Priority: <strong>{{ ticket.priority }}</strong></span>
          </div>
        </div>
        <button mat-icon-button class="dialog-close-btn" (click)="dialogRef.close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-body">
        <!-- Overview Banner -->
        <div class="ticket-overview-card">
          <div class="overview-row">
            <div class="overview-item">
              <span class="overview-lbl">Category:</span>
              <strong class="cat-pill">{{ ticket.category }}</strong>
            </div>
            <div class="overview-item">
              <span class="overview-lbl">Raised By:</span>
              <strong>{{ ticket.raisedByName }} ({{ ticket.raisedByRole }})</strong>
            </div>
            <div class="overview-item">
              <span class="overview-lbl">Phone:</span>
              <strong>{{ ticket.contactPhone }}</strong>
            </div>
            <div class="overview-item" *ngIf="ticket.studentName">
              <span class="overview-lbl">Student:</span>
              <strong>{{ ticket.studentName }} ({{ ticket.className || 'Class' }})</strong>
            </div>
          </div>

          <div class="subject-box">
            <span class="subject-title">{{ ticket.subject }}</span>
            <p class="desc-text">{{ ticket.description }}</p>
          </div>
        </div>

        <!-- Resolution Status Action Form -->
        <form [formGroup]="statusForm" (ngSubmit)="onUpdateStatus()" class="status-update-card">
          <h4 class="card-heading">
            <mat-icon>published_with_changes</mat-icon> Update Ticket Status & Redressal
          </h4>
          <div class="form-row three-col">
            <mat-form-field appearance="outline">
              <mat-label>Status *</mat-label>
              <mat-select formControlName="status">
                <mat-option value="Open">Open</mat-option>
                <mat-option value="Under Review">Under Review</mat-option>
                <mat-option value="In Progress">In Progress</mat-option>
                <mat-option value="Resolved">Resolved</mat-option>
                <mat-option value="Closed">Closed</mat-option>
                <mat-option value="Rejected">Rejected</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Assigned Officer</mat-label>
              <input matInput formControlName="assignedToName" placeholder="Staff Name" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Resolved By Name</mat-label>
              <input matInput formControlName="resolvedByName" placeholder="Officer Name" />
            </mat-form-field>
          </div>

          <div class="form-row full-width">
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>Resolution Notes / Redressal Summary</mat-label>
              <textarea matInput rows="2" formControlName="resolutionSummary" placeholder="Steps taken to resolve this grievance, outcome, and parent communication..."></textarea>
            </mat-form-field>
          </div>

          <div class="status-btn-row">
            <button mat-flat-button color="primary" type="submit" [disabled]="statusForm.invalid || isUpdatingStatus">
              <mat-icon>{{ isUpdatingStatus ? 'hourglass_top' : 'check_circle' }}</mat-icon>
              Save Status Update
            </button>
          </div>
        </form>

        <!-- Discussion & Timeline Activity Log -->
        <div class="timeline-section">
          <h4 class="card-heading">
            <mat-icon>forum</mat-icon> Activity Log & Notes ({{ comments.length }})
          </h4>

          <div class="timeline-list">
            <div *ngFor="let c of comments" class="timeline-item" [ngClass]="{ 'internal-note': c.isInternal }">
              <div class="timeline-header">
                <span class="author-tag">
                  <strong>{{ c.authorName }}</strong>
                  <small class="role-badge">({{ c.authorRole }})</small>
                </span>
                <span class="timeline-date">{{ c.createdAt | date:'dd MMM yyyy, hh:mm a':'Asia/Kolkata' }}</span>
              </div>
              <div class="timeline-body">{{ c.comment }}</div>
            </div>
          </div>

          <!-- Add Note Form -->
          <form [formGroup]="commentForm" (ngSubmit)="onAddComment()" class="add-note-form">
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>Add Note or Reply...</mat-label>
              <input matInput formControlName="comment" placeholder="Write an update, parent response, or staff note..." />
              <button mat-icon-button matSuffix color="primary" type="submit" [disabled]="commentForm.invalid || isAddingComment">
                <mat-icon>send</mat-icon>
              </button>
            </mat-form-field>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container { display: flex; flex-direction: column; width: 680px; max-width: 95vw; }
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
    .dialog-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; max-height: 80vh; overflow-y: auto; }
    .ticket-overview-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .overview-row { display: flex; flex-wrap: wrap; gap: 16px; }
    .overview-item { font-size: 0.82rem; color: #64748b; display: flex; flex-direction: column; }
    .overview-item strong { color: #1e293b; font-size: 0.88rem; }
    .cat-pill {
      background: #dbeafe;
      color: #1e40af;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.78rem;
      width: fit-content;
    }
    .subject-box { border-top: 1px solid #e2e8f0; padding-top: 10px; }
    .subject-title { font-weight: 700; color: #0f172a; font-size: 1rem; display: block; }
    .desc-text { color: #475569; font-size: 0.88rem; margin: 4px 0 0; line-height: 1.5; }

    .status-update-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .card-heading {
      margin: 0;
      font-size: 0.92rem;
      font-weight: 700;
      color: #1e3a8a;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .card-heading mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .form-row { display: flex; gap: 12px; }
    .form-row.three-col > * { flex: 1; }
    .w-100 { width: 100%; }
    .status-btn-row { display: flex; justify-content: flex-end; }

    .timeline-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .timeline-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 220px;
      overflow-y: auto;
    }
    .timeline-item {
      background: #f1f5f9;
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .timeline-item.internal-note {
      background: #fef3c7;
      border-left: 3px solid #d97706;
    }
    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.78rem;
    }
    .author-tag { color: #1e40af; }
    .role-badge { color: #64748b; font-size: 0.74rem; margin-left: 4px; }
    .timeline-date { color: #94a3b8; font-size: 0.74rem; }
    .timeline-body { color: #334155; font-size: 0.85rem; line-height: 1.4; }
    .add-note-form { margin-top: 4px; }
  `]
})
export class GrievanceDetailsDialogComponent implements OnInit {
  dialogRef = inject(MatDialogRef<GrievanceDetailsDialogComponent>);
  data = inject(MAT_DIALOG_DATA);
  private fb = inject(FormBuilder);
  private grievanceService = inject(GrievanceService);
  private authService = inject(AuthService);

  ticket!: GrievanceTicket;
  comments: GrievanceComment[] = [];
  statusForm!: FormGroup;
  commentForm!: FormGroup;
  isUpdatingStatus = false;
  isAddingComment = false;

  ngOnInit() {
    this.ticket = this.data.ticket;
    this.comments = this.data.comments || [];

    const currentUser = this.authService.currentUser();
    const staffName = currentUser?.fullName || 'Staff / Redressal Desk';

    this.statusForm = this.fb.group({
      status: [this.ticket.status, Validators.required],
      assignedToName: [this.ticket.assignedToName || 'Grievance Desk'],
      resolvedByName: [this.ticket.resolvedByName || staffName],
      resolutionSummary: [this.ticket.resolutionSummary || '']
    });

    this.commentForm = this.fb.group({
      comment: ['', Validators.required]
    });
  }

  getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'resolved':
      case 'closed': return '#059669';
      case 'in progress': return '#d97706';
      case 'under review': return '#2563eb';
      case 'rejected': return '#dc2626';
      default: return '#64748b';
    }
  }

  onUpdateStatus() {
    if (this.statusForm.invalid) return;
    this.isUpdatingStatus = true;

    this.grievanceService.updateStatus(this.ticket.id, this.statusForm.value).subscribe({
      next: () => {
        this.isUpdatingStatus = false;
        this.ticket.status = this.statusForm.value.status;
        this.ticket.resolutionSummary = this.statusForm.value.resolutionSummary;
        this.ticket.resolvedByName = this.statusForm.value.resolvedByName;
        // Refresh comments list
        this.grievanceService.getTicketDetails(this.ticket.id).subscribe({
          next: (res) => { this.comments = res.comments || []; }
        });
      },
      error: () => { this.isUpdatingStatus = false; }
    });
  }

  onAddComment() {
    if (this.commentForm.invalid) return;
    this.isAddingComment = true;

    const currentUser = this.authService.currentUser();
    const payload = {
      authorName: currentUser?.fullName || 'Staff',
      authorRole: 'Admin',
      comment: this.commentForm.value.comment,
      isInternal: false
    };

    this.grievanceService.addComment(this.ticket.id, payload).subscribe({
      next: (comment) => {
        this.isAddingComment = false;
        this.comments.push(comment);
        this.commentForm.reset();
      },
      error: () => { this.isAddingComment = false; }
    });
  }
}

// ─── Main Component: GrievanceHelpdeskComponent ───────────────────────────
@Component({
  selector: 'app-grievance-helpdesk',
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
            <mat-icon>support_agent</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Parent & Student Grievance Helpdesk</h1>
            <p class="page-subtitle">Centralized ticketing desk for academic, transport, fee, hostel, and campus infrastructure grievances.</p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-stroked-button color="primary" routerLink="/front-desk/visitors">
            <mat-icon>arrow_back</mat-icon> Front Desk
          </button>
          <button mat-flat-button color="primary" (click)="openLogGrievanceDialog()">
            <mat-icon>add_circle</mat-icon> Log New Grievance
          </button>
        </div>
      </div>

      <!-- KPI Stats Ribbon -->
      <div class="kpi-grid">
        <mat-card class="kpi-card card-blue">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Total Grievances</span>
              <h2 class="kpi-value">{{ stats?.totalTickets || 0 }}</h2>
              <span class="kpi-meta">All Campus Tickets</span>
            </div>
            <div class="kpi-icon-wrapper">
              <mat-icon>confirmation_number</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card card-amber">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Open & In Review</span>
              <h2 class="kpi-value">{{ stats?.openTickets || 0 }}</h2>
              <span class="kpi-meta">Awaiting Resolution</span>
            </div>
            <div class="kpi-icon-wrapper">
              <mat-icon>hourglass_empty</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card card-indigo">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">In Progress</span>
              <h2 class="kpi-value">{{ stats?.inProgressTickets || 0 }}</h2>
              <span class="kpi-meta">Under Department Action</span>
            </div>
            <div class="kpi-icon-wrapper">
              <mat-icon>engineering</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card card-emerald">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Resolved & Closed</span>
              <h2 class="kpi-value">{{ stats?.resolvedTickets || 0 }}</h2>
              <span class="kpi-meta">{{ stats?.resolutionRatePercentage || 0 }}% Resolution Rate</span>
            </div>
            <div class="kpi-icon-wrapper">
              <mat-icon>task_alt</mat-icon>
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
              <mat-label>Status</mat-label>
              <mat-select formControlName="status" (selectionChange)="onFilterChanged()">
                <mat-option value="All">All Statuses</mat-option>
                <mat-option value="Open">Open</mat-option>
                <mat-option value="Under Review">Under Review</mat-option>
                <mat-option value="In Progress">In Progress</mat-option>
                <mat-option value="Resolved">Resolved</mat-option>
                <mat-option value="Closed">Closed</mat-option>
                <mat-option value="Rejected">Rejected</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Category</mat-label>
              <mat-select formControlName="category" (selectionChange)="onFilterChanged()">
                <mat-option value="All">All Categories</mat-option>
                <mat-option value="Academic">Academic</mat-option>
                <mat-option value="Fee & Billing">Fee & Billing</mat-option>
                <mat-option value="Transport">Transport</mat-option>
                <mat-option value="Hostel">Hostel</mat-option>
                <mat-option value="Discipline & Safety">Discipline & Safety</mat-option>
                <mat-option value="Infrastructure">Infrastructure</mat-option>
                <mat-option value="Staff Behavior">Staff Behavior</mat-option>
                <mat-option value="Other">Other</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Priority</mat-label>
              <mat-select formControlName="priority" (selectionChange)="onFilterChanged()">
                <mat-option value="All">All Priorities</mat-option>
                <mat-option value="Urgent">Urgent</mat-option>
                <mat-option value="High">High</mat-option>
                <mat-option value="Medium">Medium</mat-option>
                <mat-option value="Low">Low</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Division / Stream</mat-label>
              <mat-select formControlName="divisionScope" (selectionChange)="onFilterChanged()">
                <mat-option value="All">All Streams (School & Coaching)</mat-option>
                <mat-option value="School">School Division</mat-option>
                <mat-option value="Coaching">Coaching Division</mat-option>
                <mat-option value="Dual">Dual Enrolled</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field search-field">
              <mat-label>Search Tickets</mat-label>
              <input matInput formControlName="searchTerm" placeholder="Search ticket #, subject, student, phone..." (keyup.enter)="onFilterChanged()" />
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
        <span>Loading grievance tickets...</span>
      </div>

      <!-- Main Tickets Table -->
      <div *ngIf="!isLoading">
        <div *ngIf="tickets.length === 0" class="empty-state">
          <mat-icon class="empty-icon">inbox</mat-icon>
          <h3>No grievances found</h3>
          <p>No complaints or grievance tickets match the current filters. Click "Log New Grievance" to create one.</p>
        </div>

        <div *ngIf="tickets.length > 0" class="table-responsive">
          <table mat-table [dataSource]="tickets" class="tickets-table">
            <ng-container matColumnDef="ticketNumber">
              <th mat-header-cell *matHeaderCellDef>Ticket #</th>
              <td mat-cell *matCellDef="let t">
                <span class="ticket-chip" (click)="openTicketDetails(t)" matTooltip="Click to View & Resolve">
                  {{ t.ticketNumber }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="subject">
              <th mat-header-cell *matHeaderCellDef>Subject & Category</th>
              <td mat-cell *matCellDef="let t">
                <div class="subject-cell">
                  <span class="subj-text">{{ t.subject }}</span>
                  <div class="meta-row">
                    <span class="category-pill">{{ t.category }}</span>
                    <span class="comments-count" *ngIf="t.commentsCount > 0">
                      <mat-icon>forum</mat-icon> {{ t.commentsCount }}
                    </span>
                  </div>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="raisedBy">
              <th mat-header-cell *matHeaderCellDef>Raised By</th>
              <td mat-cell *matCellDef="let t">
                <div class="raised-cell">
                  <strong>{{ t.raisedByName }}</strong>
                  <span class="role-pill">{{ t.raisedByRole }} &bull; {{ t.contactPhone }}</span>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="student">
              <th mat-header-cell *matHeaderCellDef>Related Student & Stream</th>
              <td mat-cell *matCellDef="let t">
                <div class="student-cell" *ngIf="t.studentName">
                  <div class="st-stream-row">
                    <strong>{{ t.studentName }}</strong>
                    <span class="stream-pill" [class.coaching]="t.divisionScope === 'Coaching'" [class.school]="t.divisionScope === 'School'" [class.dual]="t.divisionScope === 'Dual'">
                      {{ t.divisionScope || 'Student' }}
                    </span>
                  </div>
                  <small>{{ t.className || 'Class' }} &bull; {{ t.admissionNumber || 'N/A' }}</small>
                </div>
                <div *ngIf="!t.studentName" class="general-cell">
                  <span class="text-muted">General Campus</span>
                  <span class="stream-pill" *ngIf="t.divisionScope && t.divisionScope !== 'All'" [class.coaching]="t.divisionScope === 'Coaching'" [class.school]="t.divisionScope === 'School'">
                    {{ t.divisionScope }}
                  </span>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="priority">
              <th mat-header-cell *matHeaderCellDef>Priority</th>
              <td mat-cell *matCellDef="let t">
                <span class="priority-pill" [ngClass]="t.priority.toLowerCase()">
                  {{ t.priority }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let t">
                <span class="status-badge" [ngClass]="t.status.toLowerCase().replace(' ', '-')">
                  {{ t.status }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="created">
              <th mat-header-cell *matHeaderCellDef>Logged At</th>
              <td mat-cell *matCellDef="let t">
                <span class="date-text">{{ t.createdAt | date:'dd MMM yyyy':'Asia/Kolkata' }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="text-right">Actions</th>
              <td mat-cell *matCellDef="let t" class="text-right">
                <div class="action-buttons">
                  <button mat-stroked-button color="primary" class="btn-compact" (click)="openTicketDetails(t)">
                    <mat-icon>visibility</mat-icon> View & Resolve
                  </button>
                  <button mat-icon-button color="warn" (click)="deleteTicket(t)" matTooltip="Delete Ticket">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="interactive-row"></tr>
          </table>
        </div>
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

    .card-amber { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
    .card-amber .kpi-icon-wrapper { background: #fef3c7; color: #d97706; }

    .card-indigo { background: #eef2ff; color: #3730a3; border: 1px solid #c7d2fe; }
    .card-indigo .kpi-icon-wrapper { background: #e0e7ff; color: #4f46e5; }

    .card-emerald { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    .card-emerald .kpi-icon-wrapper { background: #d1fae5; color: #059669; }

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
      min-width: 160px;
    }
    .search-field {
      flex: 2;
      min-width: 220px;
    }
    .filter-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    /* Loader */
    .loader-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 0;
      gap: 16px;
      color: #64748b;
    }

    /* Table */
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

    .ticket-chip {
      background: #eff6ff;
      color: #1e40af;
      font-weight: 700;
      font-family: monospace;
      font-size: 0.86rem;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid #bfdbfe;
      cursor: pointer;
    }
    .ticket-chip:hover { background: #dbeafe; }

    .subject-cell { display: flex; flex-direction: column; gap: 4px; max-width: 320px; }
    .subj-text { font-weight: 600; color: #0f172a; white-space: normal; }
    .meta-row { display: flex; align-items: center; gap: 8px; }
    .category-pill {
      background: #f1f5f9;
      color: #475569;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.74rem;
    }
    .comments-count {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      color: #2563eb;
      font-size: 0.74rem;
    }
    .comments-count mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .raised-cell { display: flex; flex-direction: column; gap: 2px; }
    .role-pill { color: #64748b; font-size: 0.76rem; }
    .student-cell { display: flex; flex-direction: column; gap: 2px; }
    .st-stream-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .general-cell { display: flex; align-items: center; gap: 6px; }
    .student-cell small { color: #64748b; font-size: 0.76rem; }

    .stream-pill {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 2px 6px;
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
    .stream-pill.dual {
      background: #ecfdf5;
      color: #047857;
      border-color: #a7f3d0;
    }

    .priority-pill {
      font-size: 0.76rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      text-transform: uppercase;
    }
    .priority-pill.urgent { background: #fee2e2; color: #991b1b; }
    .priority-pill.high { background: #fef3c7; color: #92400e; }
    .priority-pill.medium { background: #dbeafe; color: #1e40af; }
    .priority-pill.low { background: #f1f5f9; color: #64748b; }

    .status-badge {
      font-size: 0.76rem;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 20px;
      text-transform: capitalize;
    }
    .status-badge.open { background: #f1f5f9; color: #334155; }
    .status-badge.under-review { background: #e0f2fe; color: #0369a1; }
    .status-badge.in-progress { background: #fef3c7; color: #92400e; }
    .status-badge.resolved, .status-badge.closed { background: #d1fae5; color: #065f46; }
    .status-badge.rejected { background: #fee2e2; color: #991b1b; }

    .date-text { color: #64748b; font-size: 0.82rem; }
    .action-buttons { display: flex; gap: 6px; justify-content: flex-end; align-items: center; }
    .btn-compact { font-size: 0.8rem; height: 32px; padding: 0 10px; }

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
export class GrievanceHelpdeskComponent implements OnInit {
  private grievanceService = inject(GrievanceService);
  private branchService = inject(BranchService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);
  private confirmDialog = inject(ConfirmDialogService);

  filterForm!: FormGroup;
  branches: Branch[] = [];
  stats: GrievanceStats | null = null;
  tickets: GrievanceTicket[] = [];
  isLoading = false;

  displayedColumns: string[] = ['ticketNumber', 'subject', 'raisedBy', 'student', 'priority', 'status', 'created', 'actions'];

  ngOnInit() {
    const activeBranch = this.authService.selectedBranchId() || 'ALL';

    this.filterForm = this.fb.group({
      branchId: [activeBranch],
      status: ['All'],
      category: ['All'],
      priority: ['All'],
      divisionScope: ['All'],
      searchTerm: ['']
    });

    this.loadBranches();
    this.loadStats();
    this.loadTickets();
  }

  loadBranches() {
    this.branchService.getBranches().subscribe({
      next: (res) => { this.branches = res || []; },
      error: () => {}
    });
  }

  loadStats() {
    const branchId = this.filterForm.value.branchId === 'ALL' ? null : this.filterForm.value.branchId;
    this.grievanceService.getStats(branchId).subscribe({
      next: (res) => { this.stats = res; },
      error: () => {}
    });
  }

  loadTickets() {
    this.isLoading = true;
    const branchId = this.filterForm.value.branchId === 'ALL' ? null : this.filterForm.value.branchId;
    const filters = {
      branchId,
      status: this.filterForm.value.status,
      category: this.filterForm.value.category,
      priority: this.filterForm.value.priority,
      divisionScope: this.filterForm.value.divisionScope,
      searchTerm: this.filterForm.value.searchTerm
    };

    this.grievanceService.getTickets(filters).subscribe({
      next: (res) => {
        this.tickets = res || [];
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.confirmDialog.alert('Error', err.error?.message || 'Failed to load grievances.', 'danger');
      }
    });
  }

  onFilterChanged() {
    this.loadStats();
    this.loadTickets();
  }

  resetFilters() {
    this.filterForm.patchValue({
      status: 'All',
      category: 'All',
      priority: 'All',
      divisionScope: 'All',
      searchTerm: ''
    });
    this.onFilterChanged();
  }

  openLogGrievanceDialog() {
    const ref = this.dialog.open(LogGrievanceDialogComponent, {
      width: '660px'
    });

    ref.afterClosed().subscribe(res => {
      if (res) {
        this.confirmDialog.alert('Ticket Logged', `Grievance ticket '${res.ticketNumber}' has been created successfully.`, 'success');
        this.loadStats();
        this.loadTickets();
      }
    });
  }

  openTicketDetails(ticket: GrievanceTicket) {
    this.isLoading = true;
    this.grievanceService.getTicketDetails(ticket.id).subscribe({
      next: (res) => {
        this.isLoading = false;
        const ref = this.dialog.open(GrievanceDetailsDialogComponent, {
          width: '700px',
          data: { ticket: res.ticket, comments: res.comments }
        });

        ref.afterClosed().subscribe(() => {
          this.loadStats();
          this.loadTickets();
        });
      },
      error: (err) => {
        this.isLoading = false;
        this.confirmDialog.alert('Error', err.error?.message || 'Failed to load ticket details.', 'danger');
      }
    });
  }

  deleteTicket(ticket: GrievanceTicket) {
    this.confirmDialog.confirm(
      'Delete Grievance Ticket?',
      `Are you sure you want to delete ticket '${ticket.ticketNumber}'? All activity notes will be removed.`,
      'Delete Ticket',
      'Cancel',
      'danger'
    ).subscribe(confirmed => {
      if (confirmed) {
        this.grievanceService.deleteTicket(ticket.id).subscribe({
          next: () => {
            this.confirmDialog.alert('Deleted', 'Grievance ticket deleted successfully.', 'success');
            this.loadStats();
            this.loadTickets();
          },
          error: (err) => {
            this.confirmDialog.alert('Error', err.error?.message || 'Failed to delete ticket.', 'danger');
          }
        });
      }
    });
  }
}
