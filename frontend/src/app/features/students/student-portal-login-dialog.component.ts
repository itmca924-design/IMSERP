import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CoachingService, StudentPortalLoginInfoDto, CreateStudentPortalLoginRequestDto } from '../../core/services/coaching.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { environment } from '../../../environments/environment';

export interface StudentPortalLoginDialogData {
  studentId: string;
  studentName: string;
  admissionNumber?: string | null;
  rollNumber?: string | null;
  profilePhoto?: string | null;
}

@Component({
  selector: 'app-student-portal-login-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    <div class="dialog-container">
      <!-- Standard Light Blue Gradient Dialog Header (IMSERP Strict UI Rule) -->
      <div class="dialog-header">
        <div class="header-icon-box">
          <mat-icon>vpn_key</mat-icon>
        </div>
        <div class="header-text">
          <h2 class="dialog-title">Student &amp; Parent Portal Logins</h2>
          <p class="dialog-subtitle">
            <strong>{{ data.studentName }}</strong>
            <span *ngIf="loginInfo?.classOrBatch">&nbsp;•&nbsp;{{ loginInfo?.classOrBatch }}</span>
            <span *ngIf="loginInfo?.admissionNumber || loginInfo?.rollNumber">&nbsp;•&nbsp;Adm/Roll: <strong>{{ loginInfo?.admissionNumber || loginInfo?.rollNumber }}</strong></span>
          </p>
        </div>
        <button mat-icon-button class="dialog-close-btn" (click)="closeDialog()" [disabled]="saving">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

      <div class="dialog-body" *ngIf="!loading && loginInfo">
        <!-- Quick Action: Both Accounts 1-Click Provisioning -->
        <div class="both-provision-banner" *ngIf="!loginInfo.hasStudentAccount && !loginInfo.hasParentAccount">
          <div class="banner-text">
            <mat-icon class="banner-icon">bolt</mat-icon>
            <div>
              <strong>Quick 1-Click Setup:</strong>
              <p>Generate both Student and Parent portal accounts simultaneously with recommended credentials.</p>
            </div>
          </div>
          <button mat-raised-button color="primary" class="btn-both-setup" (click)="createBothAccounts()" [disabled]="saving">
            <mat-icon *ngIf="!saving">rocket_launch</mat-icon>
            <mat-spinner diameter="18" *ngIf="saving"></mat-spinner>
            <span>Create Both Logins Now</span>
          </button>
        </div>

        <div class="accounts-grid">
          <!-- 🎓 Student Portal Account Card -->
          <div class="account-card student-card" [class.is-active]="loginInfo.hasStudentAccount">
            <div class="card-head">
              <div class="card-title-box">
                <div class="card-icon student-ico" [class.has-avatar]="!!(studentPhotoPreview || loginInfo.profilePhoto || data.profilePhoto)">
                  <img *ngIf="studentPhotoPreview || loginInfo.profilePhoto || data.profilePhoto" [src]="getPhotoUrl(studentPhotoPreview || loginInfo.profilePhoto || data.profilePhoto)" [alt]="data.studentName" class="student-avatar-img" />
                  <mat-icon *ngIf="!(studentPhotoPreview || loginInfo.profilePhoto || data.profilePhoto)">school</mat-icon>
                </div>
                <div>
                  <h3 class="card-title">Student Login Account</h3>
                  <span class="card-role-desc">Role: Student Portal User</span>
                </div>
              </div>
              <span class="status-pill" [class.active]="loginInfo.hasStudentAccount">
                <mat-icon>{{ loginInfo.hasStudentAccount ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                <span>{{ loginInfo.hasStudentAccount ? 'Active (@' + loginInfo.studentUsername + ')' : 'Not Created' }}</span>
              </span>
            </div>

            <!-- Student Photo Upload Strip -->
            <div class="photo-upload-strip">
              <div class="avatar-preview-box">
                <img *ngIf="studentPhotoPreview || loginInfo.profilePhoto || data.profilePhoto" 
                     [src]="getPhotoUrl(studentPhotoPreview || loginInfo.profilePhoto || data.profilePhoto)" 
                     class="avatar-preview-img" alt="Student Photo" />
                <mat-icon *ngIf="!(studentPhotoPreview || loginInfo.profilePhoto || data.profilePhoto)" class="avatar-fallback-icon">account_circle</mat-icon>
              </div>
              <div class="photo-meta-group">
                <div class="photo-title">Student Profile Photo</div>
                <div class="photo-hint">PNG, JPG or WEBP up to 2MB</div>
                <div class="photo-buttons">
                  <input type="file" #studentPhotoInput (change)="onStudentPhotoSelected($event)" accept="image/png,image/jpeg,image/webp" style="display: none;" />
                  <button mat-stroked-button type="button" class="upload-btn" (click)="studentPhotoInput.click()">
                    <mat-icon>photo_camera</mat-icon>
                    <span>{{ (studentPhotoPreview || loginInfo.profilePhoto || data.profilePhoto) ? 'Change Photo' : 'Upload Photo' }}</span>
                  </button>
                  <button mat-button color="warn" type="button" class="remove-btn" *ngIf="studentPhotoPreview || loginInfo.profilePhoto || data.profilePhoto" (click)="removeStudentPhoto()">
                    <mat-icon>delete_outline</mat-icon>
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="card-fields">
              <mat-form-field appearance="outline" class="input-field" subscriptSizing="dynamic">
                <mat-label>Student Username</mat-label>
                <input matInput [(ngModel)]="studentUsername" [disabled]="loginInfo.hasStudentAccount && !editingStudentUsername" placeholder="e.g. adm2026.102" />
                <button mat-icon-button matSuffix *ngIf="loginInfo.hasStudentAccount && !editingStudentUsername" (click)="editingStudentUsername = true" matTooltip="Edit username">
                  <mat-icon class="suffix-btn-icon">edit</mat-icon>
                </button>
                <button mat-icon-button matSuffix (click)="copyText(studentUsername, 'Student Username')" matTooltip="Copy username">
                  <mat-icon class="suffix-btn-icon">content_copy</mat-icon>
                </button>
              </mat-form-field>

              <mat-form-field appearance="outline" class="input-field" subscriptSizing="dynamic">
                <mat-label>{{ loginInfo.hasStudentAccount ? 'Set New Password' : 'Password' }}</mat-label>
                <input matInput [type]="hideStudentPassword ? 'password' : 'text'" [(ngModel)]="studentPassword" placeholder="e.g. Student@2026" />
                <button mat-icon-button matSuffix type="button" (click)="hideStudentPassword = !hideStudentPassword" matTooltip="Toggle password visibility">
                  <mat-icon class="suffix-btn-icon">{{ hideStudentPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                <button mat-icon-button matSuffix type="button" (click)="copyText(studentPassword, 'Student Password')" matTooltip="Copy password">
                  <mat-icon class="suffix-btn-icon">content_copy</mat-icon>
                </button>
              </mat-form-field>
            </div>

            <div class="card-action-bar">
              <span class="cred-hint" *ngIf="!loginInfo.hasStudentAccount">
                <mat-icon class="hint-ico">info_outline</mat-icon> Default: Admission/Roll No &bull; DOB
              </span>
              <span class="cred-hint active" *ngIf="loginInfo.hasStudentAccount">
                <mat-icon class="hint-ico">verified</mat-icon> Account linked &amp; ready to sign in
              </span>

              <button mat-stroked-button color="primary" class="btn-account-action" (click)="createStudentAccount()" [disabled]="saving">
                <mat-icon>{{ loginInfo.hasStudentAccount ? 'lock_reset' : 'person_add' }}</mat-icon>
                <span>{{ loginInfo.hasStudentAccount ? 'Reset Password' : 'Create Student Login' }}</span>
              </button>
            </div>
          </div>

          <!-- 👨‍👩‍👦 Parent Portal Account Card -->
          <div class="account-card parent-card" [class.is-active]="loginInfo.hasParentAccount">
            <div class="card-head">
              <div class="card-title-box">
                <div class="card-icon parent-ico"><mat-icon>family_restroom</mat-icon></div>
                <div>
                  <h3 class="card-title">Parent Login Account</h3>
                  <span class="card-role-desc">Parent: <strong>{{ loginInfo.parentName || 'Guardian' }}</strong></span>
                </div>
              </div>
              <span class="status-pill" [class.active]="loginInfo.hasParentAccount">
                <mat-icon>{{ loginInfo.hasParentAccount ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                <span>{{ loginInfo.hasParentAccount ? 'Active (@' + loginInfo.parentUsername + ')' : 'Not Created' }}</span>
              </span>
            </div>

            <!-- Sibling Link Alert if Parent Phone matches other children -->
            <div class="sibling-link-banner" *ngIf="loginInfo.isParentLinkedToSiblings">
              <mat-icon>groups</mat-icon>
              <span>Shared Parent Phone linked to sibling(s): <strong>{{ loginInfo.siblingNames.join(', ') }}</strong>. Creating/linking this login grants single-parent access for all children!</span>
            </div>

            <div class="card-fields">
              <mat-form-field appearance="outline" class="input-field" subscriptSizing="dynamic">
                <mat-label>Parent Mobile / Username</mat-label>
                <input matInput [(ngModel)]="parentUsername" [disabled]="loginInfo.hasParentAccount" placeholder="e.g. 9876543210" />
                <button mat-icon-button matSuffix (click)="copyText(parentUsername, 'Parent Username')" matTooltip="Copy username">
                  <mat-icon class="suffix-btn-icon">content_copy</mat-icon>
                </button>
              </mat-form-field>

              <mat-form-field appearance="outline" class="input-field" subscriptSizing="dynamic">
                <mat-label>{{ loginInfo.hasParentAccount ? 'Set New Password' : 'Password' }}</mat-label>
                <input matInput [type]="hideParentPassword ? 'password' : 'text'" [(ngModel)]="parentPassword" placeholder="e.g. Parent@2026" />
                <button mat-icon-button matSuffix type="button" (click)="hideParentPassword = !hideParentPassword" matTooltip="Toggle password visibility">
                  <mat-icon class="suffix-btn-icon">{{ hideParentPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                <button mat-icon-button matSuffix type="button" (click)="copyText(parentPassword, 'Parent Password')" matTooltip="Copy password">
                  <mat-icon class="suffix-btn-icon">content_copy</mat-icon>
                </button>
              </mat-form-field>
            </div>

            <div class="card-action-bar">
              <span class="cred-hint" *ngIf="!loginInfo.hasParentAccount">
                <mat-icon class="hint-ico">info_outline</mat-icon> Default: WhatsApp Mobile &bull; Parent&#64;2026
              </span>
              <span class="cred-hint active" *ngIf="loginInfo.hasParentAccount">
                <mat-icon class="hint-ico">verified</mat-icon> Account linked &amp; ready to sign in
              </span>

              <button mat-stroked-button color="primary" class="btn-account-action" (click)="createParentAccount()" [disabled]="saving">
                <mat-icon>{{ loginInfo.hasParentAccount ? 'lock_reset' : 'person_add' }}</mat-icon>
                <span>{{ loginInfo.hasParentAccount ? 'Reset Password' : 'Create Parent Login' }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- WhatsApp Credential Sharing Strip -->
        <div class="whatsapp-share-strip" *ngIf="loginInfo.hasStudentAccount || loginInfo.hasParentAccount">
          <div class="wa-left">
            <div class="wa-ico-box"><mat-icon>chat</mat-icon></div>
            <div class="wa-text-box">
              <span class="wa-title">Send Credentials to Parent via WhatsApp</span>
              <span class="wa-sub">Directly forward portal link, student and parent credentials to <strong>+91 {{ loginInfo.parentPhone || 'Phone' }}</strong></span>
            </div>
          </div>
          <div class="wa-actions">
            <button mat-stroked-button class="btn-copy-wa" (click)="copyWhatsAppMessage()" matTooltip="Copy pre-formatted text">
              <mat-icon>content_copy</mat-icon> Copy Text
            </button>
            <button mat-raised-button class="btn-open-wa" (click)="openWhatsApp()" [disabled]="!loginInfo.parentPhone" matTooltip="Open WhatsApp Web / App">
              <mat-icon>send</mat-icon> Open WhatsApp
            </button>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <button mat-stroked-button (click)="closeDialog()">Close</button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      max-width: 820px;
      width: 100%;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
    }

    /* Standard Light Blue Gradient Dialog Header (Strict IMSERP Rule) */
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
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
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      mat-icon { font-size: 24px; width: 24px; height: 24px; }
    }
    .header-text {
      flex: 1;
      min-width: 0;
    }
    .dialog-title {
      margin: 0;
      font-size: 1.18rem;
      font-weight: 700;
      color: #1e3a8a;
      line-height: 1.3;
    }
    .dialog-subtitle {
      margin: 3px 0 0 0;
      font-size: 0.84rem;
      color: #3b82f6;
      strong { color: #1e40af; }
    }
    .dialog-close-btn {
      color: #64748b;
      &:hover { color: #1e293b; background: rgba(0,0,0,0.05); }
    }

    .dialog-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      max-height: calc(85vh - 120px);
      overflow-y: auto;
    }

    /* Quick Both Setup Banner */
    .both-provision-banner {
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 1px solid #bbf7d0;
      border-radius: 10px;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .banner-text {
      display: flex;
      align-items: center;
      gap: 12px;
      strong { color: #166534; font-size: 0.92rem; }
      p { margin: 2px 0 0 0; font-size: 0.8rem; color: #15803d; }
    }
    .banner-icon {
      color: #16a34a;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }
    .btn-both-setup {
      background: #16a34a !important;
      color: #ffffff !important;
      font-weight: 600;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    /* Accounts Grid */
    .accounts-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      @media (max-width: 680px) {
        grid-template-columns: 1fr;
      }
    }
    .account-card {
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      background: #ffffff;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      transition: all 0.2s ease;

      &.is-active {
        border-color: #bfdbfe;
        background: #f8faff;
      }
    }
    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }
    .card-title-box {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .card-icon {
      width: 38px;
      height: 38px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
      &.student-ico { background: #eff6ff; color: #2563eb; }
      &.parent-ico { background: #fdf2f8; color: #db2777; }
      &.has-avatar {
        background: #f1f5f9;
        border: 1px solid #bfdbfe;
        .student-avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
      }
    }

    .photo-upload-strip {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 10px;

      .avatar-preview-box {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border: 2px solid #3b82f6;
        box-shadow: 0 2px 6px rgba(59, 130, 246, 0.2);
        flex-shrink: 0;

        .avatar-preview-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .avatar-fallback-icon {
          font-size: 34px;
          width: 34px;
          height: 34px;
          color: #94a3b8;
        }
      }

      .photo-meta-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;

        .photo-title {
          font-size: 0.8rem;
          font-weight: 700;
          color: #1e293b;
        }
        .photo-hint {
          font-size: 0.7rem;
          color: #64748b;
        }
        .photo-buttons {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 2px;

          .upload-btn {
            height: 26px;
            font-size: 0.72rem;
            padding: 0 8px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            border-color: #93c5fd;
            color: #1d4ed8;
            mat-icon { font-size: 14px; width: 14px; height: 14px; }
          }
          .remove-btn {
            height: 26px;
            font-size: 0.72rem;
            padding: 0 4px;
            color: #ef4444;
            mat-icon { font-size: 14px; width: 14px; height: 14px; }
          }
        }
      }
    }
    .card-title {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 700;
      color: #0f172a;
    }
    .card-role-desc {
      font-size: 0.74rem;
      color: #64748b;
      strong { color: #1e293b; }
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 20px;
      background: #f1f5f9;
      color: #64748b;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }

      &.active {
        background: #ecfdf5;
        color: #059669;
        border: 1px solid #a7f3d0;
      }
    }

    .sibling-link-banner {
      background: #fdf4ff;
      border: 1px solid #f0abfc;
      border-radius: 8px;
      padding: 8px 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.76rem;
      color: #86198f;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #a855f7; flex-shrink: 0; }
    }

    .card-fields {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .input-field {
      width: 100%;
    }
    .suffix-btn-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #64748b;
    }

    .card-action-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-top: auto;
      padding-top: 8px;
      border-top: 1px dashed #e2e8f0;
      flex-wrap: wrap;
    }
    .cred-hint {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.72rem;
      color: #64748b;
      .hint-ico { font-size: 14px; width: 14px; height: 14px; }
      &.active { color: #059669; font-weight: 600; }
    }
    .btn-account-action {
      font-size: 0.8rem;
      font-weight: 600;
      border-radius: 7px;
    }

    /* WhatsApp Credential Strip */
    .whatsapp-share-strip {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 10px;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .wa-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .wa-ico-box {
      width: 36px;
      height: 36px;
      background: #22c55e;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }
    .wa-text-box {
      display: flex;
      flex-direction: column;
    }
    .wa-title {
      font-size: 0.88rem;
      font-weight: 700;
      color: #14532d;
    }
    .wa-sub {
      font-size: 0.76rem;
      color: #166534;
      strong { color: #0f172a; }
    }
    .wa-actions {
      display: flex;
      gap: 8px;
    }
    .btn-copy-wa {
      border-color: #86efac;
      color: #166534;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .btn-open-wa {
      background: #22c55e !important;
      color: #ffffff !important;
      font-size: 0.8rem;
      font-weight: 700;
      border-radius: 7px;
    }

    .dialog-footer {
      padding: 12px 20px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      background: #f8fafc;
    }
  `]
})
export class StudentPortalLoginDialogComponent implements OnInit {
  loading = true;
  saving = false;
  loginInfo: StudentPortalLoginInfoDto | null = null;

  studentUsername = '';
  studentPassword = '';
  hideStudentPassword = true;
  editingStudentUsername = false;
  studentPhotoPreview: string | null = null;

  parentUsername = '';
  parentPassword = '';
  hideParentPassword = true;

  constructor(
    private dialogRef: MatDialogRef<StudentPortalLoginDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: StudentPortalLoginDialogData,
    private coachingService: CoachingService,
    private confirmDialog: ConfirmDialogService
  ) {}

  getPhotoUrl(photo: string | null | undefined): string {
    if (!photo) return '';
    if (photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('data:')) {
      return photo;
    }
    return `${environment.apiBaseUrl}${photo.startsWith('/') ? photo : '/' + photo}`;
  }

  onStudentPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (file.size > 2 * 1024 * 1024) {
      this.confirmDialog.alert('File Too Large', 'Please select an image smaller than 2MB.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.studentPhotoPreview = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  removeStudentPhoto(): void {
    this.studentPhotoPreview = '';
    if (this.loginInfo) this.loginInfo.profilePhoto = '';
    this.data.profilePhoto = '';
  }

  ngOnInit(): void {
    this.loadLoginInfo();
  }

  loadLoginInfo(): void {
    this.loading = true;
    this.coachingService.getStudentPortalLogins(this.data.studentId).subscribe({
      next: (res) => {
        this.loginInfo = res;
        this.studentUsername = res.studentUsername || res.defaultStudentUsername;
        this.studentPassword = res.defaultStudentPassword;

        this.parentUsername = res.parentUsername || res.defaultParentUsername;
        this.parentPassword = res.defaultParentPassword;

        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.confirmDialog.alert('Error', err?.error?.message || 'Failed to fetch portal login details.', 'danger');
      }
    });
  }

  createStudentAccount(): void {
    if (!this.studentUsername.trim()) {
      this.confirmDialog.alert('Validation', 'Please enter student username.', 'warning');
      return;
    }
    if (!this.studentPassword.trim()) {
      this.confirmDialog.alert('Validation', 'Please enter student password.', 'warning');
      return;
    }

    this.saving = true;
    const payload: CreateStudentPortalLoginRequestDto = {
      accountType: 'Student',
      studentUsername: this.studentUsername.trim(),
      studentPassword: this.studentPassword.trim(),
      resetExistingPassword: !!this.loginInfo?.hasStudentAccount,
      studentProfilePhoto: this.studentPhotoPreview || undefined
    };

    this.coachingService.createStudentPortalLogin(this.data.studentId, payload).subscribe({
      next: (res) => {
        this.saving = false;
        this.loginInfo = res.loginInfo;
        if (res.loginInfo?.profilePhoto) {
          this.studentPhotoPreview = null;
          this.data.profilePhoto = res.loginInfo.profilePhoto;
        }
        this.studentUsername = res.loginInfo.studentUsername || this.studentUsername;
        this.editingStudentUsername = false;
        this.confirmDialog.alert('Success', res.message || 'Student account processed successfully.', 'success');
      },
      error: (err) => {
        this.saving = false;
        this.confirmDialog.alert('Error', err?.error?.message || 'Failed to process student account.', 'danger');
      }
    });
  }

  createParentAccount(): void {
    if (!this.parentUsername.trim()) {
      this.confirmDialog.alert('Validation', 'Please enter parent username / phone.', 'warning');
      return;
    }
    if (!this.parentPassword.trim()) {
      this.confirmDialog.alert('Validation', 'Please enter parent password.', 'warning');
      return;
    }

    this.saving = true;
    const payload: CreateStudentPortalLoginRequestDto = {
      accountType: 'Parent',
      parentUsername: this.parentUsername.trim(),
      parentPassword: this.parentPassword.trim(),
      resetExistingPassword: !!this.loginInfo?.hasParentAccount
    };

    this.coachingService.createStudentPortalLogin(this.data.studentId, payload).subscribe({
      next: (res) => {
        this.saving = false;
        this.loginInfo = res.loginInfo;
        this.parentUsername = res.loginInfo.parentUsername || this.parentUsername;
        this.confirmDialog.alert('Success', res.message || 'Parent account processed successfully.', 'success');
      },
      error: (err) => {
        this.saving = false;
        this.confirmDialog.alert('Error', err?.error?.message || 'Failed to process parent account.', 'danger');
      }
    });
  }

  createBothAccounts(): void {
    if (!this.studentUsername.trim() || !this.parentUsername.trim()) {
      this.confirmDialog.alert('Validation', 'Please ensure both usernames are filled.', 'warning');
      return;
    }

    this.saving = true;
    const payload: CreateStudentPortalLoginRequestDto = {
      accountType: 'Both',
      studentUsername: this.studentUsername.trim(),
      studentPassword: this.studentPassword.trim(),
      parentUsername: this.parentUsername.trim(),
      parentPassword: this.parentPassword.trim(),
      resetExistingPassword: false,
      studentProfilePhoto: this.studentPhotoPreview || undefined
    };

    this.coachingService.createStudentPortalLogin(this.data.studentId, payload).subscribe({
      next: (res) => {
        this.saving = false;
        this.loginInfo = res.loginInfo;
        if (res.loginInfo?.profilePhoto) {
          this.studentPhotoPreview = null;
          this.data.profilePhoto = res.loginInfo.profilePhoto;
        }
        this.loginInfo = res.loginInfo;
        this.studentUsername = res.loginInfo.studentUsername || this.studentUsername;
        this.parentUsername = res.loginInfo.parentUsername || this.parentUsername;
        this.confirmDialog.alert('Success', res.message || 'Both portal accounts created successfully!', 'success');
      },
      error: (err) => {
        this.saving = false;
        this.confirmDialog.alert('Error', err?.error?.message || 'Failed to create accounts.', 'danger');
      }
    });
  }

  get formattedWhatsAppMessage(): string {
    const origin = window.location.origin;
    const sUser = this.loginInfo?.studentUsername || this.studentUsername;
    const pUser = this.loginInfo?.parentUsername || this.parentUsername;

    return `*Jnandeep Campus ERP - Portal Login Credentials*\n` +
      `Dear ${this.loginInfo?.parentName || 'Parent'},\n` +
      `Aapke ward *${this.data.studentName}* ke online ERP portal accounts configure kar diye gaye hain:\n\n` +
      `🎓 *Student Portal Login:*\n` +
      `• Username: ${sUser}\n` +
      `• Password: ${this.studentPassword}\n\n` +
      `👨‍👩‍👦 *Parent Portal Login:*\n` +
      `• Username: ${pUser}\n` +
      `• Password: ${this.parentPassword}\n\n` +
      `🌐 *Login Link:* ${origin}/login\n` +
      `_Keep your credentials confidential._`;
  }

  copyWhatsAppMessage(): void {
    this.copyText(this.formattedWhatsAppMessage, 'WhatsApp Credential Message');
  }

  openWhatsApp(): void {
    const phone = (this.loginInfo?.parentPhone || '').replace(/[^0-9]/g, '');
    if (!phone) {
      this.confirmDialog.alert('Missing Phone', 'Parent phone number is not available.', 'warning');
      return;
    }
    const cleanPhone = phone.length === 10 ? '91' + phone : phone;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(this.formattedWhatsAppMessage)}`;
    window.open(url, '_blank');
  }

  copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.confirmDialog.alert('Copied', `${label} copied to clipboard!`, 'info');
    });
  }

  closeDialog(): void {
    this.dialogRef.close(this.loginInfo);
  }
}
