import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BatchesService, BatchDto } from '../../core/services/batches.service';
import { CoachingService } from '../../core/services/coaching.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

export interface QuickBatchMentorDialogData {
  batchId: string;
  batchName: string;
  className?: string | null;
  currentMentorTeacherId?: string | null;
  currentMentorTeacherName?: string | null;
}

@Component({
  selector: 'app-quick-batch-mentor-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  template: `
    <div class="quick-mentor-wrapper">
      <!-- Strict Light-Blue Gradient Header (AGENTS.md Standard) -->
      <div class="modal-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>supervisor_account</mat-icon>
          </div>
          <div>
            <h2 class="modal-title">
              Assign Batch Mentor / In-charge
              <span class="hindi-sub">(बैच मेंटर / प्रभारी शिक्षक)</span>
            </h2>
            <p class="modal-subtitle">
              Batch: <strong>{{ data.batchName }}</strong>
              <span *ngIf="data.className">&bull; Class: <strong>{{ data.className }}</strong></span>
            </p>
          </div>
        </div>
        <button mat-icon-button type="button" class="close-btn" (click)="onCancel()" [disabled]="saving">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-progress-bar mode="indeterminate" *ngIf="loading || saving" class="header-progress"></mat-progress-bar>

      <div class="modal-body">
        <!-- Explanatory Banner -->
        <div class="mentor-info-card">
          <mat-icon class="card-icon">info</mat-icon>
          <div class="card-text">
            <strong>Role of Batch Mentor:</strong> The designated faculty member is directly responsible for daily lecture coordination, student attendance follow-ups, Daily Practice Problems (DPP), and parent communication for this coaching batch.
          </div>
        </div>

        <form [formGroup]="mentorForm" (ngSubmit)="onSubmit()" class="mentor-form">
          <div class="field-container">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Designated Faculty / Teacher</mat-label>
              <mat-select formControlName="mentorTeacherId" placeholder="Select faculty mentor" panelClass="smooth-dropdown-panel">
                <mat-select-trigger>
                  {{ getSelectedTeacherName() }}
                </mat-select-trigger>
                <mat-option [value]="null">
                  <div class="teacher-option-row unassigned-option">
                    <mat-icon class="opt-icon text-muted">person_off</mat-icon>
                    <span class="text-muted">None / Remove Mentor (कोई मेंटर नहीं)</span>
                  </div>
                </mat-option>
                <mat-option *ngFor="let t of teachers" [value]="t.id">
                  <div class="teacher-option-row">
                    <mat-icon color="primary" class="opt-icon">person</mat-icon>
                    <span class="teacher-name">{{ t.fullName || t.name }}</span>
                    <span class="subject-badge" *ngIf="t.specialization || t.department || t.designation || t.subject">{{ t.specialization || t.department || t.designation || t.subject }}</span>
                    <span class="phone-badge" *ngIf="t.phoneNumber || t.phone">📞 {{ t.phoneNumber || t.phone }}</span>
                  </div>
                </mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">assignment_ind</mat-icon>
            </mat-form-field>
          </div>

          <!-- Current Assignment Card if any -->
          <div class="current-mentor-banner" *ngIf="data.currentMentorTeacherName">
            <div class="badge-label">CURRENT ASSIGNMENT:</div>
            <div class="mentor-name-row">
              <mat-icon>verified</mat-icon>
              <span>{{ data.currentMentorTeacherName }}</span>
            </div>
          </div>

          <div class="modal-actions">
            <button mat-button type="button" (click)="onCancel()" [disabled]="saving">Cancel</button>
            <button mat-raised-button color="primary" type="submit" [disabled]="saving || loading" class="save-btn">
              <mat-icon *ngIf="!saving">how_to_reg</mat-icon>
              <span>{{ saving ? 'Saving Assignment...' : 'Save Mentor Assignment' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .quick-mentor-wrapper {
      width: 100%;
      min-width: 320px;
      max-width: 560px;
      box-sizing: border-box;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 18px 24px 16px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      min-width: 0;
    }

    .header-icon-box {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: #2563eb;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
      mat-icon { font-size: 24px; width: 24px; height: 24px; }
    }

    .modal-title {
      margin: 0;
      font-size: 1.12rem;
      font-weight: 700;
      color: #1e3a8a;
      line-height: 1.3;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .hindi-sub {
      font-size: 0.85rem;
      font-weight: 500;
      color: #3b82f6;
    }

    .modal-subtitle {
      margin: 3px 0 0;
      font-size: 0.78rem;
      color: #3b82f6;
      strong { color: #1e40af; }
    }

    .close-btn {
      color: #64748b;
      &:hover { color: #1e293b; }
    }

    .header-progress {
      margin-top: -4px;
    }

    .modal-body {
      padding: 20px 24px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      background: #ffffff;
    }

    .mentor-info-card {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;

      .card-icon {
        color: #16a34a;
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-top: 1px;
        flex-shrink: 0;
      }

      .card-text {
        font-size: 0.8rem;
        color: #166534;
        line-height: 1.45;
        strong { font-weight: 700; }
      }
    }

    .mentor-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .full-width {
      width: 100%;
    }

    .teacher-option-row {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      .opt-icon { font-size: 18px; width: 18px; height: 18px; }
      .teacher-name { font-weight: 600; color: #0f172a; }
      .subject-badge {
        font-size: 0.72rem;
        background: #eff6ff;
        color: #1d4ed8;
        padding: 1px 6px;
        border-radius: 4px;
      }
      .phone-badge {
        font-size: 0.72rem;
        color: #64748b;
        margin-left: auto;
      }
    }

    .unassigned-option {
      color: #64748b;
    }

    .current-mentor-banner {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      .badge-label {
        font-size: 0.7rem;
        font-weight: 700;
        color: #1d4ed8;
        letter-spacing: 0.05em;
      }
      .mentor-name-row {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.85rem;
        font-weight: 700;
        color: #1e3a8a;
        mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2563eb; }
      }
    }

    .modal-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 10px;
      border-top: 1px solid #f1f5f9;

      .save-btn {
        background: #2563eb;
        color: #ffffff;
        font-weight: 600;
        height: 40px;
        padding: 0 18px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);
        &:hover:not(:disabled) { background: #1d4ed8; }
      }
    }

    @media (max-width: 640px) {
      .quick-mentor-wrapper {
        min-width: 100%;
      }
      .modal-header {
        padding: 14px 16px;
      }
      .modal-body {
        padding: 16px;
      }
      .modal-actions {
        flex-direction: column-reverse;
        button { width: 100%; justify-content: center; }
      }
    }
  `]
})
export class QuickBatchMentorDialogComponent implements OnInit {
  mentorForm: FormGroup;
  teachers: any[] = [];
  loading = false;
  saving = false;

  constructor(
    private fb: FormBuilder,
    private batchesService: BatchesService,
    private coachingService: CoachingService,
    private confirmDialog: ConfirmDialogService,
    public dialogRef: MatDialogRef<QuickBatchMentorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: QuickBatchMentorDialogData
  ) {
    this.mentorForm = this.fb.group({
      mentorTeacherId: [this.data.currentMentorTeacherId || null]
    });
  }

  ngOnInit(): void {
    this.loadTeachers();
  }

  loadTeachers(): void {
    this.loading = true;
    this.coachingService.getTeachers().subscribe({
      next: (list) => {
        this.teachers = list || [];
        this.loading = false;
      },
      error: () => {
        this.teachers = [];
        this.loading = false;
      }
    });
  }

  getSelectedTeacherName(): string {
    const id = this.mentorForm?.get('mentorTeacherId')?.value;
    if (!id) return 'None / Remove Mentor (कोई मेंटर नहीं)';
    const t = this.teachers.find(x => x.id === id);
    if (!t) return this.data?.currentMentorTeacherName || 'None';
    const name = t.fullName || t.name;
    const spec = t.specialization || t.department || t.designation || t.subject;
    return spec ? `${name} (${spec})` : name;
  }

  onSubmit(): void {
    this.saving = true;
    const selectedTeacherId = this.mentorForm.value.mentorTeacherId;

    this.batchesService.assignBatchMentor(this.data.batchId, selectedTeacherId).subscribe({
      next: (updatedBatch) => {
        this.saving = false;
        this.dialogRef.close(updatedBatch);
      },
      error: (err) => {
        this.saving = false;
        this.confirmDialog.alert(
          'Assignment Error',
          err?.error?.message || 'Failed to update batch mentor assignment. Please try again.'
        );
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
