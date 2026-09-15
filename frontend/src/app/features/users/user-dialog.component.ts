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
    <h2 mat-dialog-title class="dialog-header">
      <mat-icon color="primary">{{ isEditMode ? 'manage_accounts' : 'person_add' }}</mat-icon>
      <span>{{ isEditMode ? 'Edit User Credentials & Role' : 'Create New System User' }}</span>
    </h2>

    <form [formGroup]="userForm" (ngSubmit)="onSubmit()">
      <mat-dialog-content class="dialog-content">
        <div class="form-grid">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Username</mat-label>
            <input matInput formControlName="username" [readonly]="isEditMode" placeholder="e.g. rajesh.admin" />
            <mat-error *ngIf="userForm.get('username')?.hasError('required')">Username is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Assign Role & Page Rights</mat-label>
            <mat-select formControlName="roleId">
              <mat-option *ngFor="let role of roles" [value]="role.id">
                {{ role.name }}
              </mat-option>
            </mat-select>
            <mat-error *ngIf="userForm.get('roleId')?.hasError('required')">Role selection is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Full Name</mat-label>
            <input matInput formControlName="fullName" placeholder="e.g. Prof. Rajesh Sharma" />
            <mat-error *ngIf="userForm.get('fullName')?.hasError('required')">Full name is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Assigned Branch Campus</mat-label>
            <mat-select formControlName="branchId" placeholder="Select Branch (Optional)">
              <mat-option [value]="null">
                <em>All Branches / Head Office (Global)</em>
              </mat-option>
              <mat-option *ngFor="let branch of branches" [value]="branch.id">
                <mat-icon color="primary">store</mat-icon>
                <span>{{ branch.name }} ({{ branch.code }})</span>
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Email Address</mat-label>
            <input matInput type="email" formControlName="email" placeholder="rajesh@apexcoaching.com" />
            <mat-error *ngIf="userForm.get('email')?.hasError('email')">Invalid email address</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Phone Number</mat-label>
            <input matInput formControlName="phoneNumber" placeholder="+91 9876543210" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ isEditMode ? 'Password (Leave blank to keep unchanged)' : 'Account Password' }}</mat-label>
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
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button type="button" (click)="onCancel()" [disabled]="saving">Cancel</button>
        <button mat-raised-button color="primary" type="submit" [disabled]="userForm.invalid || saving">
          <mat-spinner diameter="20" *ngIf="saving" class="spinner"></mat-spinner>
          <span>{{ isEditMode ? 'Update User' : 'Create User' }}</span>
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
    .dialog-actions {
      padding: 16px 24px;
    }
    .spinner {
      display: inline-block;
      margin-right: 8px;
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
