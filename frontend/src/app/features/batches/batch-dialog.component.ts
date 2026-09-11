import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { BatchDto, BatchesService } from '../../core/services/batches.service';
import { SubjectDto, SubjectsService } from '../../core/services/subjects.service';

@Component({
  selector: 'app-batch-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatCheckboxModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title class="dialog-header">
      <mat-icon color="primary">{{ isEditMode ? 'edit' : 'add_circle' }}</mat-icon>
      <span>{{ isEditMode ? 'Edit Academic Batch' : 'Create New Academic Batch' }}</span>
    </h2>

    <form [formGroup]="batchForm" (ngSubmit)="onSubmit()">
      <mat-dialog-content class="dialog-content">
        <div class="form-grid">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Batch Name</mat-label>
            <input matInput formControlName="name" placeholder="e.g. Class 10th Science Batch A" />
            <mat-error *ngIf="batchForm.get('name')?.hasError('required')">Batch name is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Subjects Covered (Select Chips)</mat-label>
            <mat-select formControlName="selectedSubjects" multiple placeholder="Select subjects from Master">
              <mat-select-trigger>
                <mat-chip-set>
                  <mat-chip *ngFor="let subj of batchForm.get('selectedSubjects')?.value" selected color="primary" class="selected-chip">
                    {{ subj }}
                  </mat-chip>
                </mat-chip-set>
              </mat-select-trigger>

              <!-- Sticky Search & Select All Header Box -->
              <div class="dropdown-header-container" (keydown)="$event.stopPropagation()">
                <div class="dropdown-search-box">
                  <mat-icon class="search-icon">search</mat-icon>
                  <input
                    type="text"
                    class="search-input"
                    placeholder="Search subjects..."
                    [(ngModel)]="subjectSearchTerm"
                    [ngModelOptions]="{standalone: true}"
                    (input)="$event.stopPropagation()"
                  />
                  <mat-icon *ngIf="subjectSearchTerm" class="clear-icon" (click)="subjectSearchTerm = ''; $event.stopPropagation()">close</mat-icon>
                </div>
                
                <div class="select-all-box">
                  <mat-checkbox
                    color="primary"
                    [checked]="isAllSubjectsSelected()"
                    [indeterminate]="isSomeSubjectsSelected()"
                    (change)="toggleSelectAllSubjects($event.checked)"
                    (click)="$event.stopPropagation()">
                    <span class="select-all-label">Select All / Unselect All</span>
                  </mat-checkbox>
                </div>
              </div>

              <!-- Filtered Subject Options -->
              <mat-option *ngFor="let s of getFilteredSubjects()" [value]="s.name">
                <mat-icon color="primary" class="option-icon">menu_book</mat-icon>
                <span>{{ s.name }}</span>
                <small class="option-code">({{ s.code || 'GEN' }})</small>
              </mat-option>

              <mat-option *ngIf="getFilteredSubjects().length === 0" disabled>
                <em>No matching subjects found</em>
              </mat-option>
            </mat-select>
            <mat-error *ngIf="batchForm.get('selectedSubjects')?.hasError('required')">At least one subject is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Academic Session / Year</mat-label>
            <input matInput formControlName="academicYear" placeholder="e.g. 2026-2027" />
            <mat-error *ngIf="batchForm.get('academicYear')?.hasError('required')">Academic Year is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Standard Monthly Fee (₹)</mat-label>
            <input matInput type="number" formControlName="standardMonthlyFee" placeholder="3500" />
            <mat-error *ngIf="batchForm.get('standardMonthlyFee')?.hasError('required')">Monthly fee is required</mat-error>
            <mat-error *ngIf="batchForm.get('standardMonthlyFee')?.hasError('min')">Fee must be positive</mat-error>
          </mat-form-field>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button type="button" (click)="onCancel()" [disabled]="saving">Cancel</button>
        <button mat-raised-button color="primary" type="submit" [disabled]="batchForm.invalid || saving">
          <mat-spinner diameter="20" *ngIf="saving" class="spinner"></mat-spinner>
          <span>{{ isEditMode ? 'Update Batch' : 'Save Batch' }}</span>
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
      min-width: 480px;
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
    .selected-chip {
      font-size: 0.75rem;
      height: 22px;
    }
    .dropdown-header-container {
      position: sticky;
      top: 0;
      z-index: 10;
      background: #ffffff;
      border-bottom: 1px solid #e0e0e0;
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .dropdown-search-box {
      display: flex;
      align-items: center;
      background: #f5f5f5;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 4px 8px;

      .search-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #666;
        margin-right: 6px;
      }
      .search-input {
        border: none;
        outline: none;
        background: transparent;
        width: 100%;
        font-size: 0.85rem;
      }
      .clear-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #999;
        cursor: pointer;
      }
    }
    .select-all-box {
      padding: 2px 4px;
      .select-all-label {
        font-weight: 600;
        font-size: 0.85rem;
        color: #1976d2;
      }
    }
    .option-icon {
      font-size: 18px;
      vertical-align: middle;
      margin-right: 6px;
    }
    .option-code {
      color: #888;
      margin-left: 6px;
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
export class BatchDialogComponent implements OnInit {
  batchForm!: FormGroup;
  isEditMode = false;
  saving = false;
  availableSubjects: SubjectDto[] = [];
  subjectSearchTerm = '';

  constructor(
    private fb: FormBuilder,
    private batchesService: BatchesService,
    private subjectsService: SubjectsService,
    private dialogRef: MatDialogRef<BatchDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data?: BatchDto
  ) {}

  ngOnInit(): void {
    this.isEditMode = !!this.data?.id;

    let initialSubjectList: string[] = [];
    if (this.data?.subject) {
      initialSubjectList = this.data.subject.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }

    this.batchForm = this.fb.group({
      name: [this.data?.name || '', [Validators.required, Validators.maxLength(200)]],
      selectedSubjects: [initialSubjectList, [Validators.required]],
      academicYear: [this.data?.academicYear || '2026-2027', [Validators.required]],
      standardMonthlyFee: [this.data?.standardMonthlyFee || 3500, [Validators.required, Validators.min(0)]]
    });

    this.subjectsService.getSubjects(true).subscribe({
      next: (subjects) => {
        this.availableSubjects = subjects;
      }
    });
  }

  getFilteredSubjects(): SubjectDto[] {
    if (!this.subjectSearchTerm) {
      return this.availableSubjects;
    }
    const term = this.subjectSearchTerm.toLowerCase().trim();
    return this.availableSubjects.filter(s =>
      s.name.toLowerCase().includes(term) || (s.code && s.code.toLowerCase().includes(term))
    );
  }

  getSelectedSubjects(): string[] {
    return this.batchForm.get('selectedSubjects')?.value || [];
  }

  isAllSubjectsSelected(): boolean {
    const filtered = this.getFilteredSubjects();
    if (filtered.length === 0) return false;
    const selected = this.getSelectedSubjects();
    return filtered.every(s => selected.includes(s.name));
  }

  isSomeSubjectsSelected(): boolean {
    const filtered = this.getFilteredSubjects();
    if (filtered.length === 0) return false;
    const selected = this.getSelectedSubjects();
    const count = filtered.filter(s => selected.includes(s.name)).length;
    return count > 0 && count < filtered.length;
  }

  toggleSelectAllSubjects(checked: boolean): void {
    const filteredNames = this.getFilteredSubjects().map(s => s.name);
    let currentSelected = [...this.getSelectedSubjects()];

    if (checked) {
      filteredNames.forEach(name => {
        if (!currentSelected.includes(name)) {
          currentSelected.push(name);
        }
      });
    } else {
      currentSelected = currentSelected.filter(name => !filteredNames.includes(name));
    }

    this.batchForm.get('selectedSubjects')?.setValue(currentSelected);
    this.batchForm.get('selectedSubjects')?.markAsDirty();
  }

  onSubmit(): void {
    if (this.batchForm.invalid) return;

    this.saving = true;
    const formVal = this.batchForm.value;
    const subjectsArray: string[] = formVal.selectedSubjects || [];

    const payload = {
      name: formVal.name,
      subject: subjectsArray.join(', '),
      academicYear: formVal.academicYear,
      standardMonthlyFee: formVal.standardMonthlyFee
    };

    if (this.isEditMode && this.data?.id) {
      this.batchesService.updateBatch(this.data.id, payload).subscribe({
        next: (updated) => {
          this.saving = false;
          this.dialogRef.close(updated);
        },
        error: (err) => {
          this.saving = false;
          alert(err?.error?.message || 'Error updating batch');
        }
      });
    } else {
      this.batchesService.createBatch(payload).subscribe({
        next: (created) => {
          this.saving = false;
          this.dialogRef.close(created);
        },
        error: (err) => {
          this.saving = false;
          alert(err?.error?.message || 'Error creating batch');
        }
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
