import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { InventoryCategory, CreateUpdateCategoryDto } from '../inventory.models';

export interface InventoryCategoryDialogData {
  isEdit: boolean;
  category?: InventoryCategory;
  branchId?: string;
}

@Component({
  selector: 'app-inventory-category-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="dialog-container">
      <!-- Strict ERP Light-Blue Gradient Header -->
      <div class="dialog-header">
        <div class="dialog-header-left">
          <div class="header-icon-box">
            <mat-icon>{{ data.isEdit ? 'edit' : 'category' }}</mat-icon>
          </div>
          <div class="header-title-wrap">
            <h2>{{ data.isEdit ? 'Edit Stock Category' : 'Add New Stock Category' }}</h2>
            <p>{{ data.isEdit ? 'Update category name, code, or description' : 'Define an inventory classification (Stationery, Uniforms, Books, Labs, Sports)' }}</p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="onCancel()" type="button">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-dialog-content class="dialog-body">
          <div class="form-grid">
            <!-- Category Name -->
            <mat-form-field appearance="outline" class="col-span-2">
              <mat-label>Category Name</mat-label>
              <input matInput formControlName="name" placeholder="e.g. Stationery & Consumables, Science Lab, Sports" />
              <mat-error *ngIf="form.get('name')?.hasError('required')">
                Category name is required
              </mat-error>
            </mat-form-field>

            <!-- Category Code -->
            <mat-form-field appearance="outline">
              <mat-label>Category Code / SKU Prefix</mat-label>
              <input matInput formControlName="code" placeholder="e.g. STAT, UNIF, BOOK, LAB, SPORT" style="text-transform: uppercase" />
              <mat-hint>Short unique identifier (letters & numbers)</mat-hint>
              <mat-error *ngIf="form.get('code')?.hasError('required')">
                Category code is required
              </mat-error>
            </mat-form-field>

            <!-- Status Toggle -->
            <div class="toggle-field">
              <mat-slide-toggle formControlName="isActive" color="primary">
                <span>Active Category</span>
              </mat-slide-toggle>
            </div>

            <!-- Description -->
            <mat-form-field appearance="outline" class="col-span-2">
              <mat-label>Description / Scope</mat-label>
              <textarea matInput formControlName="description" rows="3" placeholder="Brief note on what items belong to this category"></textarea>
            </mat-form-field>
          </div>
        </mat-dialog-content>

        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-button type="button" (click)="onCancel()" [disabled]="submitting">
            Cancel
          </button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting">
            <mat-spinner diameter="18" *ngIf="submitting" class="spinner-btn"></mat-spinner>
            <span>{{ data.isEdit ? 'Update Category' : 'Save Category' }}</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
  `,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      min-width: 440px;
    }
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top-left-radius: 12px;
      border-top-right-radius: 12px;
    }
    .dialog-header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-icon-box {
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .header-title-wrap h2 {
      color: #1e3a8a;
      font-weight: 700;
      margin: 0;
      font-size: 1.12rem;
      letter-spacing: -0.01em;
    }
    .header-title-wrap p {
      color: #3b82f6;
      margin: 2px 0 0;
      font-size: 0.8rem;
    }
    .close-btn {
      color: #64748b;
      &:hover {
        color: #1e293b;
      }
    }
    .dialog-body {
      padding: 20px;
      max-height: 65vh;
      overflow-y: auto;
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      align-items: center;
    }
    .col-span-2 {
      grid-column: span 2;
    }
    .toggle-field {
      display: flex;
      align-items: center;
      padding-top: 6px;
    }
    .dialog-actions {
      padding: 12px 20px 16px;
      border-top: 1px solid #f1f5f9;
      gap: 8px;
    }
    .spinner-btn {
      display: inline-block;
      margin-right: 8px;
    }
    @media (max-width: 500px) {
      .dialog-container { min-width: 100%; }
      .form-grid { grid-template-columns: 1fr; }
      .col-span-2 { grid-column: span 1; }
    }
  `]
})
export class InventoryCategoryDialogComponent implements OnInit {
  form!: FormGroup;
  submitting = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<InventoryCategoryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: InventoryCategoryDialogData
  ) {}

  ngOnInit(): void {
    const c = this.data.category;
    this.form = this.fb.group({
      name: [c?.name || '', [Validators.required, Validators.maxLength(100)]],
      code: [c?.code || '', [Validators.required, Validators.maxLength(30)]],
      description: [c?.description || ''],
      isActive: [c?.isActive ?? true]
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    const val = this.form.value;
    const result: CreateUpdateCategoryDto = {
      name: val.name.trim(),
      code: val.code.trim().toUpperCase(),
      description: val.description?.trim() || undefined,
      isActive: !!val.isActive,
      branchId: this.data.branchId
    };

    this.dialogRef.close(result);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
