import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { SubjectDto, SubjectsService } from '../../core/services/subjects.service';

@Component({
  selector: 'app-subject-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
  template: `
    <div class="dialog-wrapper">
      <div class="dialog-header">
        <div class="header-icon-wrap">
          <mat-icon>{{ isEditMode ? 'edit_note' : 'menu_book' }}</mat-icon>
        </div>
        <div class="header-titles">
          <h2 mat-dialog-title class="main-title">{{ isEditMode ? 'Edit Academic Subject' : 'Create New Subject' }}</h2>
          <p class="subtitle">{{ isEditMode ? 'Modify subject title, code, and curriculum description.' : 'Register a new subject for assignment across batches and classes.' }}</p>
        </div>
        <button mat-icon-button type="button" class="close-btn" (click)="onCancel()" [disabled]="saving">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="subjectForm" (ngSubmit)="onSubmit()">
        <mat-dialog-content class="dialog-content">

          <!-- Info Callout -->
          <div class="info-callout">
            <mat-icon class="info-icon">auto_awesome</mat-icon>
            <div class="info-text">
              <strong>Subject Master Catalog:</strong> Subjects defined here are immediately selectable when creating academic batches, scheduling lectures, and recording test marks.
            </div>
          </div>

          <!-- Section Label -->
          <div class="section-label">
            <mat-icon class="section-icon">category</mat-icon>
            <span>Subject Information &amp; Code</span>
          </div>

          <div class="form-grid">
            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Subject Name *</mat-label>
              <input matInput formControlName="name" placeholder="e.g. Physics, Chemistry, Mathematics" />
              <mat-icon matSuffix color="primary">menu_book</mat-icon>
              <mat-error *ngIf="subjectForm.get('name')?.hasError('required')">Subject name is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Short Code *</mat-label>
              <input matInput formControlName="code" placeholder="e.g. PHY, CHE, MATH" />
              <mat-icon matSuffix color="primary">tag</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Description &amp; Syllabus Notes</mat-label>
              <input matInput formControlName="description" placeholder="Brief topics, syllabus reference, or textbook name" />
              <mat-icon matSuffix color="primary">notes</mat-icon>
            </mat-form-field>
          </div>

          <!-- Live Preview Card -->
          <div class="preview-box">
            <div class="preview-header">
              <mat-icon class="preview-header-icon">preview</mat-icon>
              <span>Subject Preview</span>
            </div>
            <div class="preview-body">
              <div class="preview-item">
                <span class="preview-label">Subject Title:</span>
                <strong class="preview-val highlight">{{ subjectForm.get('name')?.value || '—' }}</strong>
              </div>
              <div class="preview-item">
                <span class="preview-label">Short Code:</span>
                <span class="code-pill">{{ subjectForm.get('code')?.value || 'GEN' }}</span>
              </div>
              <div class="preview-item" *ngIf="subjectForm.get('description')?.value">
                <span class="preview-label">Notes:</span>
                <span class="preview-val text-truncate">{{ subjectForm.get('description')?.value }}</span>
              </div>
            </div>
          </div>

        </mat-dialog-content>

        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-button type="button" (click)="onCancel()" [disabled]="saving">Cancel</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="subjectForm.invalid || saving" class="submit-btn">
            <mat-spinner diameter="18" *ngIf="saving" class="btn-spinner"></mat-spinner>
            <mat-icon *ngIf="!saving">{{ isEditMode ? 'save' : 'add_task' }}</mat-icon>
            <span>{{ saving ? 'Saving...' : (isEditMode ? 'Update Subject' : 'Save Subject') }}</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
  `,
  styles: [`
    .dialog-wrapper {
      padding: 0;
      box-sizing: border-box;
      min-width: 480px;
      max-width: 560px;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 20px 24px 16px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;

      .header-icon-wrap {
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

      .header-titles {
        flex: 1 1 auto;
        .main-title {
          margin: 0;
          font-size: 1.18rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.3;
        }
        .subtitle {
          margin: 3px 0 0;
          font-size: 0.79rem;
          color: #3b82f6;
        }
      }

      .close-btn { color: #64748b; }
    }

    .dialog-content {
      padding: 18px 24px 10px !important;
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-height: 70vh;
      overflow-y: auto;
    }

    .info-callout {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 13px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;

      .info-icon { color: #16a34a; font-size: 18px; width: 18px; height: 18px; margin-top: 1px; flex-shrink: 0; }
      .info-text { font-size: 0.79rem; color: #166534; line-height: 1.45; strong { font-weight: 700; } }
    }

    .section-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      margin-bottom: -4px;

      .section-icon { font-size: 15px; width: 15px; height: 15px; color: #94a3b8; }
    }

    .form-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .full-width {
      width: 100%;
      flex: 1 1 100%;
    }
    .half-width {
      flex: 1 1 calc(50% - 6px);
      min-width: 200px;
    }

    .preview-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;

      .preview-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        background: #f1f5f9;
        border-bottom: 1px solid #e2e8f0;
        font-size: 0.73rem;
        font-weight: 700;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        .preview-header-icon { font-size: 14px; width: 14px; height: 14px; color: #94a3b8; }
      }

      .preview-body {
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .preview-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.82rem;
        .preview-label { color: #64748b; }
        .preview-val {
          color: #0f172a;
          font-weight: 600;
          &.highlight { color: #2563eb; }
          &.text-truncate {
            max-width: 65%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
        .code-pill {
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
          font-weight: 700;
          font-size: 0.75rem;
          padding: 1px 8px;
          border-radius: 4px;
        }
      }
    }

    .dialog-actions {
      padding: 13px 24px 20px;
      border-top: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      gap: 10px;

      .submit-btn {
        height: 42px;
        font-weight: 600;
        padding: 0 20px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .btn-spinner { margin-right: 4px; }
    }

    @media (max-width: 520px) {
      .dialog-wrapper { min-width: 100% !important; }
      .form-grid {
        flex-direction: column;
        .half-width, .full-width { width: 100% !important; flex: 1 1 100% !important; }
      }
    }
  `]
})
export class SubjectDialogComponent implements OnInit {
  subjectForm!: FormGroup;
  isEditMode = false;
  saving = false;

  constructor(
    private fb: FormBuilder,
    private subjectsService: SubjectsService,
    private dialogRef: MatDialogRef<SubjectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data?: SubjectDto
  ) {}

  ngOnInit(): void {
    this.isEditMode = !!this.data?.id;

    this.subjectForm = this.fb.group({
      name: [this.data?.name || '', [Validators.required, Validators.maxLength(100)]],
      code: [this.data?.code || '', [Validators.maxLength(50)]],
      description: [this.data?.description || '', [Validators.maxLength(250)]],
      isActive: [this.data?.isActive ?? true]
    });
  }

  onSubmit(): void {
    if (this.subjectForm.invalid) return;

    this.saving = true;
    const formVal = this.subjectForm.value;

    if (this.isEditMode && this.data?.id) {
      this.subjectsService.updateSubject(this.data.id, formVal).subscribe({
        next: (updated) => {
          this.saving = false;
          this.dialogRef.close(updated);
        },
        error: (err) => {
          this.saving = false;
          alert(err?.error?.message || 'Error updating subject.');
        }
      });
    } else {
      this.subjectsService.createSubject(formVal).subscribe({
        next: (created) => {
          this.saving = false;
          this.dialogRef.close(created);
        },
        error: (err) => {
          this.saving = false;
          alert(err?.error?.message || 'Error creating subject.');
        }
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
