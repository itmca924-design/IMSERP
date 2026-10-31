import { Component, Inject, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';

import { FormBuilder, FormGroup, FormControl, FormGroupDirective, NgForm, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ErrorStateMatcher } from '@angular/material/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { UserDto, UsersService } from '../../core/services/users.service';
import { AuthService } from '../../core/services/auth.service';
import { RoleDto, RolesService } from '../../core/services/roles.service';
import { BranchDto, BranchService } from '../../core/services/branch.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { environment } from '../../../environments/environment';

/** Immediate Error State Matcher so errors & duplicates show up as soon as typed/invalid */
export class ImmediateErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    return !!(control && (control.invalid || control.hasError('duplicate')) && (control.dirty || control.touched || !!control.value || form?.submitted));
  }
}

@Component({
  selector: 'app-user-dialog',
  standalone: true,
  imports: [
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
    
      <form [formGroup]="userForm" (ngSubmit)="onSubmit()" class="dialog-form">
        <mat-dialog-content class="dialog-content">
    
          <!-- Section: Profile Photo -->
          <div class="photo-upload-row">
            <div class="avatar-preview-box">
              @if (photoPreview) {
                <img [src]="photoPreview" class="avatar-preview-img" alt="User Avatar" />
              }
              @if (!photoPreview) {
                <mat-icon class="avatar-fallback-icon">account_circle</mat-icon>
              }
            </div>
            <div class="photo-meta-group">
              <div class="photo-title">Profile Image (Avatar)</div>
              <div class="photo-hint">PNG, JPG or WEBP up to 2MB. Saved as fast-loading disk file.</div>
              <div class="photo-buttons">
                <input type="file" #fileInput (change)="onFileSelected($event)" accept="image/png,image/jpeg,image/webp" style="display: none;" />
                <button mat-stroked-button type="button" class="upload-btn" (click)="fileInput.click()">
                  <mat-icon>photo_camera</mat-icon>
                  <span>{{ photoPreview ? 'Change Photo' : 'Upload Photo' }}</span>
                </button>
                @if (photoPreview) {
                  <button mat-button color="warn" type="button" class="remove-btn" (click)="removePhoto()">
                    <mat-icon>delete_outline</mat-icon>
                    <span>Remove</span>
                  </button>
                }
              </div>
            </div>
          </div>
    
          <!-- Section: Credentials & Role -->
          <div class="section-label">
            <mat-icon class="section-icon">verified_user</mat-icon>
            <span>Account Credentials &amp; Access Role</span>
          </div>
    
          <div class="form-grid">
            <mat-form-field appearance="outline" class="half-width" subscriptSizing="dynamic">
              <mat-label>Username *</mat-label>
              <input matInput formControlName="username" [readonly]="isEditMode" placeholder="e.g. rajesh.admin" />
              <mat-icon matSuffix color="primary">person</mat-icon>
              @if (userForm.get('username')?.hasError('required')) {
                <mat-error>Username is required</mat-error>
              }
            </mat-form-field>
    
            <mat-form-field appearance="outline" class="half-width" subscriptSizing="dynamic">
              <mat-label>Assign Role &amp; Rights *</mat-label>
              <mat-select formControlName="roleId">
                @for (role of roles; track role) {
                  <mat-option [value]="role.id">
                    {{ role.name }}
                  </mat-option>
                }
              </mat-select>
              <mat-icon matSuffix color="primary">shield</mat-icon>
              @if (userForm.get('roleId')?.hasError('required')) {
                <mat-error>Role selection is required</mat-error>
              }
            </mat-form-field>
    
            <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
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
              @if (userForm.get('password')?.hasError('required')) {
                <mat-error>Password is required</mat-error>
              }
            </mat-form-field>
          </div>
    
          <!-- Section: Personal Info & Branch -->
          <div class="section-label">
            <mat-icon class="section-icon">badge</mat-icon>
            <span>Personal Profile &amp; Campus Assignment</span>
          </div>
    
          <div class="form-grid">
            <mat-form-field appearance="outline" class="half-width" subscriptSizing="dynamic">
              <mat-label>Full Name *</mat-label>
              <input matInput formControlName="fullName" placeholder="e.g. Prof. Rajesh Sharma" />
              <mat-icon matSuffix color="primary">badge</mat-icon>
              @if (userForm.get('fullName')?.hasError('required')) {
                <mat-error>Full name is required</mat-error>
              }
            </mat-form-field>
    
            <mat-form-field appearance="outline" class="half-width" subscriptSizing="dynamic">
              <mat-label>Assigned Branch Campus</mat-label>
              <mat-select formControlName="branchId" placeholder="Select Branch (Optional)">
                <mat-option [value]="null">
                  <em>🌐 All Branches / Head Office (Global)</em>
                </mat-option>
                @for (branch of branches; track branch) {
                  <mat-option [value]="branch.id">
                    🏫 {{ branch.name }} ({{ branch.code }})
                  </mat-option>
                }
              </mat-select>
              <mat-icon matSuffix color="primary">storefront</mat-icon>
            </mat-form-field>
    
            <mat-form-field appearance="outline" class="half-width" subscriptSizing="dynamic">
              <mat-label>Email Address</mat-label>
              <input
                matInput
                type="email"
                formControlName="email"
                [errorStateMatcher]="errorMatcher"
                (blur)="checkEmailDuplicate()"
                placeholder="rajesh@apexcoaching.com" />
              <mat-icon matSuffix [color]="emailDuplicate || userForm.get('email')?.hasError('duplicate') ? 'warn' : 'primary'">mail</mat-icon>
              @if (emailDuplicate || userForm.get('email')?.hasError('duplicate')) {
                <mat-error>
                  Email already registered with another user
                </mat-error>
              }
              @if (userForm.get('email')?.hasError('email') && !emailDuplicate && !userForm.get('email')?.hasError('duplicate')) {
                <mat-error>
                  Invalid email address format
                </mat-error>
              }
            </mat-form-field>
    
            <mat-form-field appearance="outline" class="half-width" subscriptSizing="dynamic">
              <mat-label>Phone Number</mat-label>
              <input
                matInput
                formControlName="phoneNumber"
                [errorStateMatcher]="errorMatcher"
                (blur)="checkPhoneDuplicate()"
                placeholder="+91 9876543210" />
              <mat-icon matSuffix [color]="phoneDuplicate || userForm.get('phoneNumber')?.hasError('duplicate') ? 'warn' : 'primary'">call</mat-icon>
              @if (phoneDuplicate || userForm.get('phoneNumber')?.hasError('duplicate')) {
                <mat-error>
                  Phone number already registered with another user
                </mat-error>
              }
            </mat-form-field>
          </div>
    
          <!-- Highlight Conflict Banner if Duplicates Detected -->
          @if (emailDuplicate || phoneDuplicate) {
            <div class="duplicate-banner">
              <mat-icon class="dup-icon">error</mat-icon>
              <div class="dup-text">
                @if (emailDuplicate) {
                  <div><strong>Email Already Exists:</strong> This email is already registered with another user in the database.</div>
                }
                @if (phoneDuplicate) {
                  <div><strong>Phone Already Exists:</strong> This mobile number is already registered with another user in the database.</div>
                }
              </div>
            </div>
          }
    
          <!-- Live Preview Card -->
          <div class="preview-box">
            <div class="preview-header">
              <div class="preview-title-wrap">
                <mat-icon class="preview-header-icon">preview</mat-icon>
                <span>User Profile Summary</span>
              </div>
              <span class="role-badge">{{ getSelectedRoleName() }}</span>
            </div>
            <div class="preview-body">
              <div class="preview-item">
                <span class="preview-label">User Account:</span>
                <strong class="preview-val highlight">{{ userForm.get('fullName')?.value || userForm.get('username')?.value || '—' }} (&#64;{{ userForm.get('username')?.value || 'username' }})</strong>
              </div>
              <div class="preview-item">
                <span class="preview-label">Campus Access:</span>
                <span class="preview-val campus-val">{{ getSelectedBranchName() }}</span>
              </div>
            </div>
          </div>
    
        </mat-dialog-content>
    
        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-button type="button" (click)="onCancel()" [disabled]="saving">Cancel</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="userForm.invalid || emailDuplicate || phoneDuplicate || saving" class="submit-btn">
            @if (saving) {
              <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
            }
            @if (!saving) {
              <mat-icon>{{ isEditMode ? 'save' : 'person_add' }}</mat-icon>
            }
            <span>{{ saving ? 'Saving...' : (isEditMode ? 'Update User' : 'Create User') }}</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host {
      display: block;
      width: 100%;
      box-sizing: border-box;
    }

    .dialog-wrapper {
      padding: 0;
      box-sizing: border-box;
      width: 100%;
      display: flex;
      flex-direction: column;
    }

    .dialog-form {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      overflow: hidden;
      width: 100%;
      box-sizing: border-box;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px 12px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      flex-shrink: 0;
      width: 100%;
      box-sizing: border-box;

      .header-icon-wrap {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }

      .header-titles {
        flex: 1 1 auto;
        min-width: 0;
        .main-title {
          margin: 0;
          font-size: 1.08rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .subtitle {
          margin: 2px 0 0;
          font-size: 0.75rem;
          color: #3b82f6;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      .close-btn { color: #64748b; flex-shrink: 0; }

      @media (max-width: 520px) {
        padding: 10px 12px;
        gap: 8px;
        .header-icon-wrap { width: 32px; height: 32px; border-radius: 8px; mat-icon { font-size: 18px; width: 18px; height: 18px; } }
        .header-titles {
          .main-title { font-size: 0.95rem; }
          .subtitle { font-size: 0.7rem; }
        }
      }
    }

    .dialog-content {
      padding: 12px 20px 4px !important;
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;

      &::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
    }

    :host ::ng-deep .mat-mdc-dialog-content {
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
      &::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
    }

    .photo-upload-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 10px;
      flex-shrink: 0;

      .avatar-preview-box {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border: 2px solid #3b82f6;
        box-shadow: 0 2px 6px rgba(59, 130, 246, 0.25);
        flex-shrink: 0;

        .avatar-preview-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .avatar-fallback-icon {
          font-size: 42px;
          width: 42px;
          height: 42px;
          color: #94a3b8;
        }
      }

      .photo-meta-group {
        flex: 1;
        min-width: 0;
        .photo-title {
          font-size: 0.8rem;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 1px;
        }
        .photo-hint {
          font-size: 0.7rem;
          color: #64748b;
          margin-bottom: 5px;
        }
        .photo-buttons {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;

          .upload-btn {
            height: 28px;
            line-height: 28px;
            font-size: 0.74rem;
            padding: 0 10px;
            color: #2563eb;
            border-color: #bfdbfe;
            white-space: nowrap;
            mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 4px; }
          }

          .remove-btn {
            height: 28px;
            line-height: 28px;
            font-size: 0.74rem;
            padding: 0 8px;
            white-space: nowrap;
            mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 2px; }
          }
        }
      }

      @media (max-width: 520px) {
        padding: 8px 10px;
        gap: 10px;
        .photo-title { font-size: 0.76rem; }
        .photo-hint { display: none; }
      }
    }

    .section-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.72rem;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-top: 2px;
      margin-bottom: -3px;

      .section-icon { font-size: 15px; width: 15px; height: 15px; color: #94a3b8; }
    }

    .form-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .full-width {
      width: 100%;
      flex: 1 1 100%;
    }
    .half-width {
      flex: 1 1 calc(50% - 4px);
      min-width: 200px;

      @media (max-width: 520px) {
        flex: 1 1 100% !important;
        min-width: 100% !important;
        width: 100% !important;
      }
    }

    .duplicate-banner {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 12px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      color: #b91c1c;
      font-size: 0.78rem;
      flex-shrink: 0;
      animation: fadeIn 0.2s ease-in-out;

      .dup-icon { font-size: 18px; width: 18px; height: 18px; color: #dc2626; flex-shrink: 0; margin-top: 1px; }
      .dup-text { line-height: 1.4; strong { font-weight: 700; color: #991b1b; } }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .preview-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      margin-top: 2px;
      margin-bottom: 2px;
      flex-shrink: 0;

      .preview-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 4px 10px;
        background: #f1f5f9;
        border-bottom: 1px solid #e2e8f0;

        .preview-title-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          .preview-header-icon { font-size: 15px; width: 15px; height: 15px; color: #94a3b8; }
        }

        .role-badge {
          background: #f5f3ff;
          color: #7c3aed;
          border: 1px solid #ddd6fe;
          font-weight: 700;
          font-size: 0.72rem;
          padding: 1px 7px;
          border-radius: 4px;
        }
      }

      .preview-body {
        padding: 5px 10px 6px;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .preview-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.78rem;
        line-height: 1.3;
        .preview-label { color: #64748b; font-size: 0.73rem; flex-shrink: 0; }
        .preview-val {
          color: #0f172a;
          font-weight: 600;
          text-align: right;
          word-break: break-word;
          &.highlight { color: #2563eb; }
          &.campus-val { color: #0284c7; }
        }
      }
    }

    .dialog-actions {
      padding: 8px 20px 12px;
      border-top: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 48px;
      flex-shrink: 0;

      .submit-btn {
        height: 38px;
        font-weight: 600;
        padding: 0 18px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .btn-spinner { margin-right: 4px; display: inline-block; }
    }

    @media (max-width: 600px) {
      .dialog-wrapper {
        min-width: 100%;
        max-width: 100%;
      }
      .half-width {
        flex: 1 1 100%;
      }
    }
  `]
})
export class UserDialogComponent implements OnInit, OnDestroy {
  userForm!: FormGroup;
  isEditMode = false;
  saving = false;
  hidePassword = true;
  roles: RoleDto[] = [];
  branches: BranchDto[] = [];
  emailDuplicate = false;
  phoneDuplicate = false;
  errorMatcher = new ImmediateErrorStateMatcher();

  photoPreview: string | null = null;
  private subs = new Subscription();

  constructor(
    private fb: FormBuilder,
    private usersService: UsersService,
    private rolesService: RolesService,
    private branchService: BranchService,
    private confirmDialog: ConfirmDialogService,
    private authService: AuthService,
    private dialogRef: MatDialogRef<UserDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data?: UserDto
  ) {}

  ngOnInit(): void {
    this.isEditMode = !!this.data?.id;

    if (this.data?.profilePhoto) {
      this.photoPreview = this.getPhotoUrl(this.data.profilePhoto);
    }

    this.userForm = this.fb.group({
      username: [this.data?.username || '', [Validators.required]],
      fullName: [this.data?.fullName || '', [Validators.required]],
      email: [this.data?.email || '', [Validators.email]],
      phoneNumber: [this.data?.phoneNumber || ''],
      roleId: [this.data?.roleId || '', [Validators.required]],
      branchId: [this.data?.branchId || null],
      password: [this.isEditMode ? '' : 'admin123', this.isEditMode ? [] : [Validators.required]],
      isActive: [this.data?.isActive ?? true],
      profilePhoto: [this.data?.profilePhoto || '']
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

    // Real-time RxJS Debounced Duplicate Checks
    const emailSub = this.userForm.get('email')?.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged()
    ).subscribe((val) => {
      this.checkEmailDuplicate(val);
    });
    if (emailSub) this.subs.add(emailSub);

    const phoneSub = this.userForm.get('phoneNumber')?.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged()
    ).subscribe((val) => {
      this.checkPhoneDuplicate(val);
    });
    if (phoneSub) this.subs.add(phoneSub);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  checkEmailDuplicate(emailRaw?: string): void {
    const email = (emailRaw !== undefined ? emailRaw : this.userForm.get('email')?.value)?.trim();
    const ctrl = this.userForm.get('email');

    if (!email) {
      this.emailDuplicate = false;
      this.clearDuplicateError(ctrl);
      return;
    }

    // In Edit mode, if email is unchanged, ignore
    if (this.isEditMode && this.data?.email?.trim().toLowerCase() === email.toLowerCase()) {
      this.emailDuplicate = false;
      this.clearDuplicateError(ctrl);
      return;
    }

    const excludeId = this.isEditMode ? this.data?.id : undefined;
    this.usersService.checkDuplicate(undefined, email, excludeId).subscribe({
      next: (res) => {
        this.emailDuplicate = !!res.emailExists;
        if (this.emailDuplicate) {
          this.setDuplicateError(ctrl);
        } else {
          this.clearDuplicateError(ctrl);
        }
      },
      error: () => {
        this.emailDuplicate = false;
        this.clearDuplicateError(ctrl);
      }
    });
  }

  checkPhoneDuplicate(phoneRaw?: string): void {
    const phone = (phoneRaw !== undefined ? phoneRaw : this.userForm.get('phoneNumber')?.value)?.trim();
    const ctrl = this.userForm.get('phoneNumber');

    if (!phone) {
      this.phoneDuplicate = false;
      this.clearDuplicateError(ctrl);
      return;
    }

    // In Edit mode, if phone is unchanged, ignore
    if (this.isEditMode && this.data?.phoneNumber?.trim() === phone) {
      this.phoneDuplicate = false;
      this.clearDuplicateError(ctrl);
      return;
    }

    const excludeId = this.isEditMode ? this.data?.id : undefined;
    this.usersService.checkDuplicate(phone, undefined, excludeId).subscribe({
      next: (res) => {
        this.phoneDuplicate = !!res.phoneExists;
        if (this.phoneDuplicate) {
          this.setDuplicateError(ctrl);
        } else {
          this.clearDuplicateError(ctrl);
        }
      },
      error: () => {
        this.phoneDuplicate = false;
        this.clearDuplicateError(ctrl);
      }
    });
  }

  private setDuplicateError(ctrl: AbstractControl | null): void {
    if (!ctrl) return;
    const errors = ctrl.errors || {};
    ctrl.setErrors({ ...errors, duplicate: true });
    ctrl.markAsDirty();
    ctrl.markAsTouched();
  }

  private clearDuplicateError(ctrl: AbstractControl | null): void {
    if (!ctrl || !ctrl.hasError('duplicate')) return;
    const errors = { ...ctrl.errors };
    delete errors['duplicate'];
    ctrl.setErrors(Object.keys(errors).length > 0 ? errors : null);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (file.size > 2 * 1024 * 1024) {
      this.confirmDialog.alert('File Too Large', 'Please select an image smaller than 2MB.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      this.photoPreview = base64;
      this.userForm.patchValue({ profilePhoto: base64 });
      this.userForm.markAsDirty();
    };
    reader.readAsDataURL(file);
  }

  removePhoto(): void {
    this.photoPreview = null;
    this.userForm.patchValue({ profilePhoto: '' });
    this.userForm.markAsDirty();
  }

  getPhotoUrl(photo?: string | null): string {
    if (!photo) return '';
    if (photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('data:')) return photo;
    if (photo.startsWith('/uploads/')) return `${environment.apiBaseUrl}${photo}`;
    if (photo.startsWith('/')) return photo;
    return `${environment.apiBaseUrl}/${photo}`;
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
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    if (this.emailDuplicate) {
      this.confirmDialog.alert('Duplicate Email', 'The entered email address is already registered with another user.', 'warning');
      return;
    }

    if (this.phoneDuplicate) {
      this.confirmDialog.alert('Duplicate Phone Number', 'The entered phone number is already registered with another user.', 'warning');
      return;
    }

    this.saving = true;
    const formVal = this.userForm.value;
    const email = formVal.email?.trim();
    const phone = formVal.phoneNumber?.trim();
    const excludeId = this.isEditMode ? this.data?.id : undefined;

    this.usersService.checkDuplicate(phone, email, excludeId).subscribe({
      next: (dupRes) => {
        if (dupRes.emailExists) {
          this.saving = false;
          this.emailDuplicate = true;
          this.setDuplicateError(this.userForm.get('email'));
          this.confirmDialog.alert('Duplicate Email', 'The entered email address is already registered with another user.', 'warning');
          return;
        }

        if (dupRes.phoneExists) {
          this.saving = false;
          this.phoneDuplicate = true;
          this.setDuplicateError(this.userForm.get('phoneNumber'));
          this.confirmDialog.alert('Duplicate Phone Number', 'The entered phone number is already registered with another user.', 'warning');
          return;
        }

        this.executeSave(formVal);
      },
      error: () => {
        this.executeSave(formVal);
      }
    });
  }

  private executeSave(formVal: any): void {
    if (this.isEditMode && this.data?.id) {
      this.usersService.updateUser(this.data.id, formVal).subscribe({
        next: (updated) => {
          this.saving = false;
          if (this.authService.currentUser()?.userId === updated.id) {
            this.authService.updateUserProfilePhoto(updated.profilePhoto);
          }
          this.confirmDialog.alert('User Updated', `User "${updated.username}" credentials updated successfully.`, 'success')
            .subscribe(() => this.dialogRef.close(true));
        },
        error: (err) => {
          this.saving = false;
          const msg = err?.error?.message || 'Failed to update user profile.';
          this.confirmDialog.alert('Update Failed', msg, 'danger');
        }
      });
    } else {
      this.usersService.createUser(formVal).subscribe({
        next: (created) => {
          this.saving = false;
          this.confirmDialog.alert('User Created', `User "${created.username}" created successfully.`, 'success')
            .subscribe(() => this.dialogRef.close(true));
        },
        error: (err) => {
          this.saving = false;
          const msg = err?.error?.message || 'Failed to create user account.';
          this.confirmDialog.alert('Creation Failed', msg, 'danger');
        }
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
