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
    <h2 mat-dialog-title class="dialog-header">
      <mat-icon color="primary">{{ isEditMode ? 'edit' : 'menu_book' }}</mat-icon>
      <span>{{ isEditMode ? 'Edit Subject' : 'Add New Subject' }}</span>
    </h2>

    <form [formGroup]="subjectForm" (ngSubmit)="onSubmit()">
      <mat-dialog-content class="dialog-content">
        <div class="form-grid">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Subject Name</mat-label>
            <input matInput formControlName="name" placeholder="e.g. Physics / Mathematics" />
            <mat-error *ngIf="subjectForm.get('name')?.hasError('required')">Subject name is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Short Code</mat-label>
            <input matInput formControlName="code" placeholder="e.g. PHY / MATH" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Description</mat-label>
            <input matInput formControlName="description" placeholder="Short summary or topics covered" />
          </mat-form-field>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button type="button" (click)="onCancel()" [disabled]="saving">Cancel</button>
        <button mat-raised-button color="primary" type="submit" [disabled]="subjectForm.invalid || saving">
          <mat-spinner diameter="20" *ngIf="saving" class="spinner"></mat-spinner>
          <span>{{ isEditMode ? 'Update Subject' : 'Save Subject' }}</span>
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }
    .dialog-content {
      padding-top: 12px;
      min-width: 440px;
    }
    .form-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .full-width {
      width: 100%;
    }
    .half-width {
      flex: 1 1 45%;
    }
    .dialog-actions {
      padding: 16px 24px;
    }
    .spinner {
      display: inline-block;
      margin-right: 8px;
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
