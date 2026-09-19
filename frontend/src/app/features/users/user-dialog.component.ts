import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UserDto, UsersService } from '../../core/services/users.service';
import { RoleDto, RolesService } from '../../core/services/roles.service';
import { BranchDto, BranchService } from '../../core/services/branch.service';

@Component({
  selector: 'app-user-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <div class="dialog-wrapper">
      <div class="dialog-header">
        <div class="header-icon-wrap">
          <mat-icon>{{ isEditMode ? 'manage_accounts' : 'person_add' }}</mat-icon>
        </div>
        <div class="header-titles">
          <h2 mat-dialog-title class="main-title">{{ isEditMode ? 'Edit User Credentials & Role' : 'Create New System User' }}</h2>
          <p class="subtitle">{{ isEditMode ? 'Modify account role, permissions, and campus access.' : 'Provision a new administrative account with role-based access control.' }}</p>
        </div>
        <button mat-icon-button type="button" class="close-btn" (click)="onCancel()" [disabled]="saving">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="userForm" (ngSubmit)="onSubmit()">
        <mat-dialog-content class="dialog-content">

          <!-- Info Callout -->
          <div class="info-callout">
            <mat-icon class="info-icon">auto_awesome</mat-icon>
            <div class="info-text">
              <strong>Role-Based Access Control:</strong> Users are granted permissions according to their assigned role. Branch-scoped accounts will only view data belonging to their campus.
            </div>
          </div>

          <!-- Section: Credentials & Role -->
          <div class="section-label">
            <mat-icon class="section-icon">verified_user</mat-icon>
            <span>Account Credentials &amp; Access Role</span>
          </div>

          <div class="form-grid">
            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Username *</mat-label>
              <input matInput formControlName="username" [readonly]="isEditMode" placeholder="e.g. rajesh.admin" />
              <mat-icon matSuffix color="primary">person</mat-icon>
              <mat-error *ngIf="userForm.get('username')?.hasError('required')">Username is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Assign Role &amp; Rights *</mat-label>
              <mat-select formControlName="roleId">
                <mat-option *ngFor="let role of roles" [value]="role.id">
                  {{ role.name }}
                </mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">shield</mat-icon>
              <mat-error *ngIf="userForm.get('roleId')?.hasError('required')">Role selection is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ isEditMode ? 'Password (Leave blank to keep unchanged)' : 'Account Password *' }}</mat-label>
              <input matInput [type]="hidePassword ? 'password' : 'text'" formControlName="password" placeholder="••••••••" />
              <button
                mat-icon-button
                matSuffix
                type="button"
                (click)="hidePassword = !hidePassword"
                [matTooltip]="hidePassword ? 'Show Password' : 'Hide Password'"
                aria-label="Toggle password visibility">
                <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-error *ngIf="userForm.get('password')?.hasError('required')">Password is required</mat-error>
            </mat-form-field>
          </div>

          <!-- Section: Personal Info & Branch -->
          <div class="section-label">
            <mat-icon class="section-icon">badge</mat-icon>
            <span>Personal Profile &amp; Campus Assignment</span>
          </div>

          <div class="form-grid">
            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Full Name *</mat-label>
              <input matInput formControlName="fullName" placeholder="e.g. Prof. Rajesh Sharma" />
              <mat-icon matSuffix color="primary">badge</mat-icon>
              <mat-error *ngIf="userForm.get('fullName')?.hasError('required')">Full name is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Assigned Branch Campus</mat-label>
              <mat-select formControlName="branchId" placeholder="Select Branch (Optional)">
                <mat-option [value]="null">
                  <em>🌐 All Branches / Head Office (Global)</em>
                </mat-option>
                <mat-option *ngFor="let branch of branches" [value]="branch.id">
                  🏫 {{ branch.name }} ({{ branch.code }})
                </mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">storefront</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Email Address</mat-label>
              <input matInput type="email" formControlName="email" placeholder="rajesh@apexcoaching.com" />
              <mat-icon matSuffix color="primary">mail</mat-icon>
              <mat-error *ngIf="userForm.get('email')?.hasError('email')">Invalid email address</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Phone Number</mat-label>
              <input matInput formControlName="phoneNumber" placeholder="+91 9876543210" />
              <mat-icon matSuffix color="primary">call</mat-icon>
            </mat-form-field>
          </div>

          <!-- Live Preview Card -->
          <div class="preview-box">
            <div class="preview-header">
              <mat-icon class="preview-header-icon">preview</mat-icon>
              <span>User Profile Summary</span>
            </div>
            <div class="preview-body">
              <div class="preview-item">
                <span class="preview-label">User Account:</span>
                <strong class="preview-val highlight">{{ userForm.get('fullName')?.value || userForm.get('username')?.value || '—' }} (&#64;{{ userForm.get('username')?.value || 'username' }})</strong>
              </div>
              <div class="preview-item">
                <span class="preview-label">Role &amp; Rights:</span>
                <span class="role-badge">{{ getSelectedRoleName() }}</span>
              </div>
              <div class="preview-item">
                <span class="preview-label">Campus Access:</span>
                <span class="preview-val">{{ getSelectedBranchName() }}</span>
              </div>
            </div>
          </div>

        </mat-dialog-content>

        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-button type="button" (click)="onCancel()" [disabled]="saving">Cancel</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="userForm.invalid || saving" class="submit-btn">
            <mat-spinner diameter="18" *ngIf="saving" class="btn-spinner"></mat-spinner>
            <mat-icon *ngIf="!saving">{{ isEditMode ? 'save' : 'person_add' }}</mat-icon>
            <span>{{ saving ? 'Saving...' : (isEditMode ? 'Update User' : 'Create User') }}</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
  `,
  styles: [`
    .dialog-wrapper {
      padding: 0;
      box-sizing: border-box;
      min-width: 520px;
      max-width: 620px;
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
      min-width: 210px;
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
        }
        .role-badge {
          background: #f5f3ff;
          color: #7c3aed;
          border: 1px solid #ddd6fe;
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
      .btn-spinner { margin-right: 4px; display: inline-block; }
    }

    @media (max-width: 560px) {
      .dialog-wrapper { min-width: 100% !important; }
      .form-grid {
        flex-direction: column;
        .half-width, .full-width { width: 100% !important; flex: 1 1 100% !important; }
      }
    }
  `]
})
export class UserDialogComponent implements OnInit {
  userForm!: FormGroup;
  isEditMode = false;
  saving = false;
  hidePassword = true;
  roles: RoleDto[] = [];
  branches: BranchDto[] = [];

  constructor(
    private fb: FormBuilder,
    private usersService: UsersService,
    private rolesService: RolesService,
    private branchService: BranchService,
    private dialogRef: MatDialogRef<UserDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data?: UserDto
  ) {}

  ngOnInit(): void {
    this.isEditMode = !!this.data?.id;

    this.userForm = this.fb.group({
      username: [this.data?.username || '', [Validators.required]],
      fullName: [this.data?.fullName || '', [Validators.required]],
      email: [this.data?.email || '', [Validators.email]],
      phoneNumber: [this.data?.phoneNumber || ''],
      roleId: [this.data?.roleId || '', [Validators.required]],
      branchId: [this.data?.branchId || null],
      password: [this.isEditMode ? '' : 'admin123', this.isEditMode ? [] : [Validators.required]],
      isActive: [this.data?.isActive ?? true]
    });

    this.rolesService.getRoles().subscribe({
      next: (roleList) => {
        this.roles = roleList;
      }
    });

    this.branchService.getBranches().subscribe({
      next: (branchList) => {
        this.branches = branchList;
      }
    });
  }

  getSelectedRoleName(): string {
    const roleId = this.userForm?.get('roleId')?.value;
    if (!roleId) return 'No Role Assigned';
    const found = this.roles?.find(r => r.id === roleId);
    return found ? found.name : '—';
  }

  getSelectedBranchName(): string {
    const branchId = this.userForm?.get('branchId')?.value;
    if (!branchId) return 'All Branches / Head Office (Global)';
    const found = this.branches?.find(b => b.id === branchId);
    return found ? `${found.name} (${found.code})` : 'All Branches / Head Office';
  }

  onSubmit(): void {
    if (this.userForm.invalid) return;

    this.saving = true;
    const formVal = this.userForm.value;

    if (this.isEditMode && this.data?.id) {
      this.usersService.updateUser(this.data.id, formVal).subscribe({
        next: (updated) => {
          this.saving = false;
          this.dialogRef.close(updated);
        },
        error: (err) => {
          this.saving = false;
          alert(err?.error?.message || 'Error updating user.');
        }
      });
    } else {
      this.usersService.createUser(formVal).subscribe({
        next: (created) => {
          this.saving = false;
          this.dialogRef.close(created);
        },
        error: (err) => {
          this.saving = false;
          alert(err?.error?.message || 'Error creating user.');
        }
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
