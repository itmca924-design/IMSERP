import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RoleDto } from '../../core/services/roles.service';

export interface RoleEditDialogData {
  role?: RoleDto;
  isNew?: boolean;
}

@Component({
  selector: 'app-role-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="dialog-container">
      <!-- Strict Light Blue Gradient Header matching AGENTS.md rule -->
      <div class="dialog-header">
        <div class="header-icon-box">
          <mat-icon>{{ data.isNew ? 'add_moderator' : 'security' }}</mat-icon>
        </div>
        <div class="header-text">
          <h2 class="main-title">{{ data.isNew ? 'Create New Role' : 'Edit Role: ' + (data.role?.name || 'Role') }}</h2>
          <p class="subtitle">{{ data.isNew ? 'Define a new system role and its basic properties' : 'Modify role title, description, and operational status' }}</p>
        </div>
        <button mat-icon-button type="button" class="close-btn" (click)="onCancel()" title="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Form Content -->
      <form [formGroup]="form" (ngSubmit)="onSave()">
        <mat-dialog-content class="dialog-body">
          <div class="form-fields">
            <!-- Role Name -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Role Title / Name *</mat-label>
              <input matInput formControlName="name" placeholder="e.g. Accounts & Finance / Faculty">
              <mat-icon matSuffix style="color:#64748b">badge</mat-icon>
              <mat-error *ngIf="form.get('name')?.hasError('required')">Role name is required</mat-error>
            </mat-form-field>

            <!-- Role Description -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Role Description</mat-label>
              <textarea matInput formControlName="description" rows="3" placeholder="Describe module scope and permissions for this role..."></textarea>
              <mat-hint>Summary displayed in permissions matrix</mat-hint>
            </mat-form-field>

            <!-- Active Status Toggle -->
            <div class="status-toggle-row">
              <div class="status-info">
                <span class="status-title">Role Status</span>
                <span class="status-desc">Allow users to be assigned and log in with this role</span>
              </div>
              <mat-slide-toggle formControlName="isActive" color="primary">
                {{ form.get('isActive')?.value ? 'Active' : 'Disabled' }}
              </mat-slide-toggle>
            </div>
          </div>
        </mat-dialog-content>

        <!-- Dialog Footer Actions -->
        <mat-dialog-actions align="end" class="dialog-footer">
          <button mat-button type="button" class="cancel-btn" (click)="onCancel()">Cancel</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving" class="submit-btn">
            <mat-spinner diameter="18" *ngIf="saving" style="display:inline-block;margin-right:6px"></mat-spinner>
            <mat-icon *ngIf="!saving">{{ data.isNew ? 'add' : 'check' }}</mat-icon>
            <span>{{ data.isNew ? 'Create Role' : 'Save Changes' }}</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
  `,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-radius: 12px;
      background: #ffffff;
    }
    /* Strict AGENTS.md Light Blue Gradient Header */
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
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
      flex-shrink: 0;
      mat-icon { font-size: 24px; width: 24px; height: 24px; }
    }
    .header-text {
      flex: 1;
      min-width: 0;
      .main-title {
        color: #1e3a8a;
        font-weight: 700;
        font-size: 1.15rem;
        margin: 0;
        line-height: 1.3;
      }
      .subtitle {
        color: #3b82f6;
        font-size: 0.8rem;
        margin: 2px 0 0;
        line-height: 1.3;
      }
    }
    .close-btn {
      color: #64748b;
      transition: color 0.2s ease;
      &:hover { color: #1e293b; background: rgba(0,0,0,0.05); }
    }
    .dialog-body {
      padding: 24px 20px 12px !important;
      overflow-y: auto;
    }
    .form-fields {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .full-width {
      width: 100%;
    }
    .status-toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      margin-top: 4px;
    }
    .status-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .status-title {
      font-size: 0.88rem;
      font-weight: 600;
      color: #1e293b;
    }
    .status-desc {
      font-size: 0.75rem;
      color: #64748b;
    }
    .dialog-footer {
      padding: 14px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin: 0 !important;
    }
    .cancel-btn {
      color: #64748b;
    }
    .submit-btn {
      font-weight: 600;
    }
  `]
})
export class RoleEditDialogComponent implements OnInit {
  form!: FormGroup;
  saving = false;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<RoleEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RoleEditDialogData
  ) { }

  ngOnInit(): void {
    this.form = this.fb.group({
      name: [this.data.role?.name || '', [Validators.required]],
      description: [this.data.role?.description || ''],
      isActive: [this.data.role ? this.data.role.isActive : true]
    });
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onSave(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value);
  }
}
