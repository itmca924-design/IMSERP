import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SchoolService } from '../../core/services/school.service';
import { TeacherDto } from '../teachers/teacher.models';

export interface QuickClassTeacherDialogData {
  sectionId: string;
  sectionName: string;
  className: string;
  currentClassTeacherId?: string | null;
  currentClassTeacherName?: string | null;
  teachers: TeacherDto[];
}

@Component({
  selector: 'app-quick-class-teacher-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  template: `
    <div class="dialog-container">
      <!-- Strict Light Blue Header matching Rule -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>supervisor_account</mat-icon>
          </div>
          <div>
            <h2 class="dialog-title">Assign Class Teacher</h2>
            <p class="dialog-subtitle">
              Section Incharge for <strong>{{ data.className }} - {{ data.sectionName }}</strong>
            </p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="onClose()" matTooltip="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-progress-bar mode="indeterminate" *ngIf="saving"></mat-progress-bar>

      <div class="dialog-body">
        <!-- Current Status Banner -->
        <div class="current-status-banner" [class.assigned]="data.currentClassTeacherId" [class.unassigned]="!data.currentClassTeacherId">
          <mat-icon class="status-icon">{{ data.currentClassTeacherId ? 'verified' : 'info' }}</mat-icon>
          <div class="status-text">
            <span class="status-label">Current Class Teacher:</span>
            <strong class="status-val">{{ data.currentClassTeacherName || 'No Teacher Assigned Yet' }}</strong>
          </div>
        </div>

        <!-- Conflict Alert if teacher is assigned elsewhere -->
        <div class="conflict-alert" *ngIf="conflictNotice">
          <div class="conflict-icon">
            <mat-icon>warning_amber</mat-icon>
          </div>
          <div class="conflict-content">
            <strong>Reassignment Notice</strong>
            <p>{{ conflictNotice }}</p>
            <small>Clicking "Confirm Transfer" will move this teacher to <strong>{{ data.className }} - {{ data.sectionName }}</strong>.</small>
          </div>
        </div>

        <!-- Teacher Selection Dropdown -->
        <div class="form-section">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Select Faculty (कक्षा अध्यापक)</mat-label>
            <mat-select [(ngModel)]="selectedTeacherId" (selectionChange)="onTeacherChange()" placeholder="Choose teacher...">
              <mat-option [value]="null">-- None (Unassigned) --</mat-option>
              <mat-option *ngFor="let t of availableTeachers" [value]="t.id">
                <span class="teacher-opt">
                  <strong>{{ t.fullName }}</strong>
                  <span class="teacher-code">({{ t.employeeCode }})</span>
                  <span class="teacher-phone" *ngIf="t.phoneNumber">📞 {{ t.phoneNumber }}</span>
                  <span class="inactive-badge" *ngIf="!t.isActive" style="color: #ef4444; font-size: 0.75rem; margin-left: 6px;">(Inactive / Exited)</span>
                </span>
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Selected Teacher Card Preview -->
        <div class="teacher-preview-card" *ngIf="selectedTeacher">
          <div class="preview-avatar">
            <mat-icon>account_circle</mat-icon>
          </div>
          <div class="preview-details">
            <div class="preview-name">{{ selectedTeacher.fullName }}</div>
            <div class="preview-sub">
              <span>Code: <strong>{{ selectedTeacher.employeeCode }}</strong></span>
              <span *ngIf="selectedTeacher.phoneNumber">&bull; 📞 {{ selectedTeacher.phoneNumber }}</span>
              <span *ngIf="selectedTeacher.specialization">&bull; {{ selectedTeacher.specialization }}</span>
            </div>
          </div>
        </div>

        <div class="role-help-note">
          <mat-icon>lightbulb</mat-icon>
          <span>The Class Teacher is responsible for student attendance, report card signatures, class discipline, and direct parent communications for this section.</span>
        </div>
      </div>

      <!-- Dialog Actions -->
      <div class="dialog-actions">
        <button mat-button class="btn-cancel" (click)="onClose()" [disabled]="saving">Cancel</button>
        <button mat-flat-button color="warn" class="btn-unassign" *ngIf="data.currentClassTeacherId && selectedTeacherId === null" (click)="saveAssignment(false)" [disabled]="saving">
          <mat-icon>person_remove</mat-icon> Remove Class Teacher
        </button>
        <button mat-flat-button color="primary" class="btn-save" *ngIf="!conflictNotice" (click)="saveAssignment(false)" [disabled]="saving || !hasChanged">
          <mat-icon>{{ saving ? 'hourglass_empty' : 'save' }}</mat-icon> Save Assignment
        </button>
        <button mat-flat-button color="accent" class="btn-confirm-transfer" *ngIf="conflictNotice" (click)="saveAssignment(true)" [disabled]="saving">
          <mat-icon>swap_horiz</mat-icon> Confirm & Transfer
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      width: 100%;
      max-width: 520px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* Strict Light Blue Gradient Header */
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .header-icon-box {
      width: 44px;
      height: 44px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
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

    .dialog-subtitle {
      margin: 2px 0 0;
      font-size: 0.85rem;
      color: #3b82f6;
    }

    .dialog-subtitle strong {
      color: #1e40af;
    }

    .close-btn {
      color: #64748b;
      transition: color 0.15s ease;
    }

    .close-btn:hover {
      color: #1e293b;
    }

    /* Dialog Body */
    .dialog-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .current-status-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 8px;
      font-size: 0.88rem;
    }

    .current-status-banner.assigned {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
    }

    .current-status-banner.unassigned {
      background: #fefce8;
      border: 1px solid #fef08a;
      color: #854d0e;
    }

    .status-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .status-text {
      display: flex;
      flex-direction: column;
    }

    .status-label {
      font-size: 0.76rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.85;
    }

    .status-val {
      font-size: 0.95rem;
    }

    .conflict-alert {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      gap: 12px;
      color: #92400e;
      font-size: 0.85rem;
    }

    .conflict-icon mat-icon {
      color: #d97706;
    }

    .conflict-content p {
      margin: 4px 0 6px;
      line-height: 1.35;
    }

    .full-width {
      width: 100%;
    }

    .teacher-opt {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.9rem;
    }

    .teacher-code {
      color: #64748b;
      font-size: 0.8rem;
    }

    .teacher-phone {
      color: #2563eb;
      font-size: 0.8rem;
      margin-left: auto;
    }

    .teacher-preview-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .preview-avatar mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: #3b82f6;
    }

    .preview-name {
      font-weight: 600;
      color: #0f172a;
      font-size: 0.95rem;
    }

    .preview-sub {
      font-size: 0.8rem;
      color: #64748b;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .role-help-note {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #eff6ff;
      border: 1px solid #dbeafe;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 0.8rem;
      color: #1e40af;
      line-height: 1.35;
    }

    .role-help-note mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #2563eb;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .dialog-actions {
      padding: 14px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
    }

    .btn-save {
      background: #2563eb !important;
      color: #ffffff !important;
      font-weight: 600;
    }

    .btn-confirm-transfer {
      background: #d97706 !important;
      color: #ffffff !important;
      font-weight: 600;
    }
  `]
})
export class QuickClassTeacherDialogComponent implements OnInit {
  selectedTeacherId: string | null = null;
  selectedTeacher: TeacherDto | null = null;
  availableTeachers: TeacherDto[] = [];
  conflictNotice: string | null = null;
  saving = false;

  constructor(
    public dialogRef: MatDialogRef<QuickClassTeacherDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: QuickClassTeacherDialogData,
    private schoolService: SchoolService
  ) {}

  ngOnInit() {
    this.selectedTeacherId = this.data.currentClassTeacherId || null;
    this.availableTeachers = (this.data.teachers || []).filter(t => t.isActive);
    if (this.data.currentClassTeacherId && !this.availableTeachers.some(t => t.id === this.data.currentClassTeacherId)) {
      const cur = (this.data.teachers || []).find(t => t.id === this.data.currentClassTeacherId);
      if (cur) this.availableTeachers.unshift(cur);
    }
    this.updateSelectedTeacher();
  }

  get hasChanged(): boolean {
    const cur = this.data.currentClassTeacherId || null;
    return this.selectedTeacherId !== cur;
  }

  onTeacherChange() {
    this.conflictNotice = null;
    this.updateSelectedTeacher();
  }

  updateSelectedTeacher() {
    if (this.selectedTeacherId) {
      this.selectedTeacher = this.availableTeachers.find(t => t.id === this.selectedTeacherId) || this.data.teachers.find(t => t.id === this.selectedTeacherId) || null;
    } else {
      this.selectedTeacher = null;
    }
  }

  saveAssignment(force: boolean = false) {
    this.saving = true;
    this.conflictNotice = null;

    this.schoolService.quickAssignClassTeacher(this.data.sectionId, this.selectedTeacherId, force).subscribe({
      next: (res) => {
        this.saving = false;
        this.dialogRef.close({
          success: true,
          sectionId: this.data.sectionId,
          classTeacherId: this.selectedTeacherId,
          classTeacherName: this.selectedTeacher ? this.selectedTeacher.fullName : null,
          message: res?.message
        });
      },
      error: (err) => {
        this.saving = false;
        if (err.status === 409 && err.error?.requiresConfirmation) {
          this.conflictNotice = err.error.message;
        } else {
          alert(err.error?.message || 'Failed to update Class Teacher assignment.');
        }
      }
    });
  }

  onClose() {
    this.dialogRef.close(null);
  }
}
