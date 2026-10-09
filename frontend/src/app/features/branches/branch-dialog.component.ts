import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { BranchDto, BranchService, CreateBranchDto, UpdateBranchDto } from '../../core/services/branch.service';

export interface BranchDialogData {
  branch?: BranchDto;
  isFirstBranch?: boolean;
}

@Component({
  selector: 'app-branch-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatIconModule
  ],
  template: `
    <div class="dialog-wrapper">
      <!-- Standard Dialog Header (Consistent with Batches & IMSERP Design) -->
      <div class="dialog-header">
        <div class="header-icon-wrap">
          <mat-icon>{{ isEditMode ? 'edit_location' : 'add_business' }}</mat-icon>
        </div>
        <div class="header-titles">
          <h2 mat-dialog-title class="main-title">{{ isEditMode ? 'Edit Branch Details' : 'Add New Branch' }}</h2>
          <p class="subtitle">{{ isEditMode ? 'Update campus name, code, phone, or location details.' : 'Register a new campus or physical branch for this institute.' }}</p>
        </div>
        <button mat-icon-button type="button" class="close-btn" (click)="onCancel()" [disabled]="saving">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-progress-bar mode="indeterminate" *ngIf="saving" class="dialog-loader"></mat-progress-bar>

      <form [formGroup]="branchForm" (ngSubmit)="onSubmit()">
        <mat-dialog-content class="dialog-content">

          <!-- Info Callout -->
          <div class="info-callout">
            <mat-icon class="info-icon">auto_awesome</mat-icon>
            <div class="info-text">
              <strong>Multi-Campus Infrastructure:</strong> Branches enable localized fee collections, classroom allocations, teacher rosters, and batch tracking across physical centers.
            </div>
          </div>

          <!-- Section: Identity & Location -->
          <div class="section-label">
            <mat-icon class="section-icon">storefront</mat-icon>
            <span>Campus Identity &amp; Location</span>
          </div>

          <div class="form-grid">
            <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
              <mat-label>Branch Name *</mat-label>
              <input matInput formControlName="name" placeholder="e.g. Zenith Coaching Academy - South Extension" />
              <mat-icon matSuffix color="primary">store</mat-icon>
              <mat-error *ngIf="branchForm.get('name')?.hasError('required')">Branch name is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-width" subscriptSizing="dynamic">
              <mat-label>Branch Code *</mat-label>
              <input matInput formControlName="code" placeholder="e.g. SOUTH, MAIN, EXT" (input)="onCodeInput($event)" />
              <mat-icon matSuffix color="primary">qr_code</mat-icon>
              <mat-hint *ngIf="!isEditMode">Uppercase unique code</mat-hint>
              <mat-error *ngIf="branchForm.get('code')?.hasError('required')">Code is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-width" subscriptSizing="dynamic">
              <mat-label>Contact Phone</mat-label>
              <input matInput formControlName="contactPhone" placeholder="+91 98765 43210" />
              <mat-icon matSuffix color="primary">call</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
              <mat-label>Address &amp; Landmark</mat-label>
              <textarea matInput formControlName="address" rows="2" placeholder="Full physical street address, institutional area, or landmark..."></textarea>
              <mat-icon matSuffix color="primary">place</mat-icon>
            </mat-form-field>

            <!-- Main Branch Toggle (Creating only) -->
            <div class="full-width toggle-card" *ngIf="!isEditMode">
              <mat-slide-toggle formControlName="isMainBranch" color="primary">
                <span class="toggle-text">Mark as Main Branch / Head Office</span>
              </mat-slide-toggle>
            </div>

            <!-- Active Status Toggle (Editing only) -->
            <div class="full-width toggle-card" *ngIf="isEditMode">
              <mat-slide-toggle formControlName="isActive" color="primary">
                <span class="toggle-text">Active Branch (Accepting student admissions &amp; batches)</span>
              </mat-slide-toggle>
            </div>
          </div>

          <!-- Live Summary Preview Card -->
          <div class="preview-box">
            <div class="preview-header">
              <div class="preview-title-wrap">
                <mat-icon class="preview-header-icon">summarize</mat-icon>
                <span>Branch Summary Preview</span>
              </div>
              <span class="code-pill" *ngIf="branchForm.get('code')?.value">{{ branchForm.get('code')?.value }}</span>
            </div>
            <div class="preview-body">
              <div class="preview-main-row">
                <span class="preview-label">Branch:</span>
                <strong class="preview-val highlight">{{ branchForm.get('name')?.value || '—' }}</strong>
              </div>
              <div class="preview-meta-row" *ngIf="branchForm.get('contactPhone')?.value || branchForm.get('address')?.value">
                <span *ngIf="branchForm.get('contactPhone')?.value" class="meta-item">
                  <mat-icon class="meta-icon">call</mat-icon>
                  <span>{{ branchForm.get('contactPhone')?.value }}</span>
                </span>
                <span *ngIf="branchForm.get('contactPhone')?.value && branchForm.get('address')?.value" class="meta-dot">•</span>
                <span *ngIf="branchForm.get('address')?.value" class="meta-item meta-addr" [title]="branchForm.get('address')?.value">
                  <mat-icon class="meta-icon">place</mat-icon>
                  <span>{{ branchForm.get('address')?.value }}</span>
                </span>
              </div>
            </div>
          </div>

          <!-- Error Alert Banner -->
          <div *ngIf="errorMessage" class="error-banner">
            <mat-icon>error_outline</mat-icon>
            <span>{{ errorMessage }}</span>
          </div>

        </mat-dialog-content>

        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-button type="button" (click)="onCancel()" [disabled]="saving">Cancel</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="branchForm.invalid || saving" class="submit-btn">
            <mat-spinner diameter="18" *ngIf="saving" class="btn-spinner"></mat-spinner>
            <mat-icon *ngIf="!saving">{{ isEditMode ? 'save' : 'add_business' }}</mat-icon>
            <span>{{ saving ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Create Branch') }}</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      max-width: 100%;
    }

    .dialog-wrapper {
      padding: 0;
      box-sizing: border-box;
      width: 100%;
      max-width: 660px;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    form {
      display: flex;
      flex-direction: column;
      min-height: 0;
      flex: 1 1 auto;
      width: 100%;
      box-sizing: border-box;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px 24px 14px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      flex-shrink: 0;

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

    .dialog-loader {
      margin: 0;
      height: 3px;
    }

    .dialog-content {
      padding: 16px 24px 20px !important;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: calc(85vh - 130px);
      overflow-y: auto;
      box-sizing: border-box;

      &::-webkit-scrollbar {
        width: 6px;
      }
      &::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
      }
      &::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
    }

    .info-callout {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 8px 12px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;

      .info-icon { color: #16a34a; font-size: 18px; width: 18px; height: 18px; margin-top: 1px; flex-shrink: 0; }
      .info-text { font-size: 0.77rem; color: #166534; line-height: 1.4; strong { font-weight: 700; } }
    }

    .section-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.73rem;
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
      gap: 10px;
      width: 100%;
      box-sizing: border-box;
    }
    .full-width {
      width: 100%;
      flex: 1 1 100%;
      min-width: 0;
    }
    .half-width {
      flex: 1 1 calc(50% - 5px);
      min-width: 0;
    }

    .toggle-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 9px 14px;
      border-radius: 10px;
      margin-top: 2px;
      box-sizing: border-box;
      width: 100%;

      .toggle-text {
        font-size: 0.84rem;
        font-weight: 500;
        color: #334155;
      }
    }

    .preview-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 4px;
      width: 100%;
      box-sizing: border-box;

      .preview-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 7px 14px;
        background: #f1f5f9;
        border-bottom: 1px solid #e2e8f0;
        font-size: 0.73rem;
        font-weight: 700;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.05em;

        .preview-title-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          .preview-header-icon { font-size: 15px; width: 15px; height: 15px; color: #94a3b8; flex-shrink: 0; }
          span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        }

        .code-pill {
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
          font-weight: 700;
          font-size: 0.72rem;
          padding: 1px 7px;
          border-radius: 4px;
          letter-spacing: 0.03em;
          flex-shrink: 0;
        }
      }

      .preview-body {
        padding: 9px 14px;
        display: flex;
        flex-direction: column;
        gap: 5px;
        box-sizing: border-box;
      }

      .preview-main-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.82rem;
        min-width: 0;
        .preview-label { color: #64748b; font-weight: 500; flex-shrink: 0; }
        .preview-val {
          color: #0f172a;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          &.highlight { color: #2563eb; }
        }
      }

      .preview-meta-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        font-size: 0.78rem;
        color: #475569;
        min-width: 0;

        .meta-item {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          min-width: 0;
          .meta-icon { font-size: 13px; width: 13px; height: 13px; color: #64748b; flex-shrink: 0; }
          &.meta-addr {
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
        .meta-dot { color: #94a3b8; font-weight: 700; font-size: 0.8rem; }
      }
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fee2e2;
      color: #991b1b;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.85rem;
      box-sizing: border-box;
      width: 100%;
      mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    }

    .dialog-actions {
      padding: 12px 20px 16px;
      border-top: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      flex-shrink: 0;
      box-sizing: border-box;
      width: 100%;

      .submit-btn {
        height: 40px;
        font-weight: 600;
        padding: 0 18px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .btn-spinner { margin-right: 4px; }
    }

    @media (max-width: 600px) {
      .dialog-header {
        padding: 12px 14px 10px;
        gap: 10px;
        .header-icon-wrap {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          mat-icon { font-size: 20px; width: 20px; height: 20px; }
        }
        .header-titles {
          .main-title { font-size: 1.02rem; }
          .subtitle { font-size: 0.72rem; }
        }
      }

      .dialog-content {
        padding: 12px 14px 16px !important;
        gap: 10px;
      }

      .form-grid {
        flex-direction: column;
        gap: 8px;
        .half-width, .full-width {
          width: 100% !important;
          flex: 1 1 100% !important;
          min-width: 0 !important;
        }
      }

      .toggle-card {
        padding: 8px 12px;
        .toggle-text { font-size: 0.8rem; }
      }

      .preview-box {
        .preview-header { padding: 6px 10px; }
        .preview-body { padding: 8px 10px; }
        .preview-meta-row {
          .meta-item.meta-addr { max-width: 200px; }
        }
      }

      .dialog-actions {
        padding: 10px 14px 14px;
        gap: 8px;
        .submit-btn {
          height: 38px;
          padding: 0 14px;
          font-size: 0.84rem;
        }
      }
    }
  `]
})
export class BranchDialogComponent implements OnInit {
  branchForm: FormGroup;
  isEditMode = false;
  saving = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private branchService: BranchService,
    private dialogRef: MatDialogRef<BranchDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data?: BranchDialogData
  ) {
    this.isEditMode = !!data?.branch;

    this.branchForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      contactPhone: [''],
      address: [''],
      isMainBranch: [false],
      isActive: [true]
    });
  }

  ngOnInit(): void {
    if (this.isEditMode && this.data?.branch) {
      const b = this.data.branch;
      this.branchForm.patchValue({
        name: b.name,
        code: b.code,
        contactPhone: b.contactPhone || '',
        address: b.address || '',
        isMainBranch: b.isMainBranch,
        isActive: b.isActive
      });
      this.branchForm.get('code')?.disable();
    } else {
      this.branchForm.patchValue({
        isMainBranch: !!this.data?.isFirstBranch,
        isActive: true
      });
      this.branchForm.get('code')?.enable();
    }
  }

  onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      input.value = input.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      this.branchForm.get('code')?.setValue(input.value, { emitEvent: false });
    }
  }

  onSubmit(): void {
    if (this.branchForm.invalid || this.saving) return;

    this.saving = true;
    this.errorMessage = '';
    const val = this.branchForm.getRawValue();

    if (this.isEditMode && this.data?.branch) {
      const updateDto: UpdateBranchDto = {
        name: val.name.trim(),
        contactPhone: val.contactPhone?.trim() || null,
        address: val.address?.trim() || null,
        isActive: val.isActive
      };

      this.branchService.updateBranch(this.data.branch.id, updateDto).subscribe({
        next: (res) => {
          this.dialogRef.close(res || true);
        },
        error: (err) => {
          this.saving = false;
          this.errorMessage = err?.error?.message || 'Failed to update branch details.';
        }
      });
    } else {
      const createDto: CreateBranchDto = {
        name: val.name.trim(),
        code: val.code.trim().toUpperCase(),
        contactPhone: val.contactPhone?.trim() || null,
        address: val.address?.trim() || null,
        isMainBranch: !!val.isMainBranch
      };

      this.branchService.createBranch(createDto).subscribe({
        next: (res) => {
          this.dialogRef.close(res || true);
        },
        error: (err) => {
          this.saving = false;
          this.errorMessage = err?.error?.message || 'Failed to create branch.';
        }
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
