import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { AuthService, RegisterTrialTenantDto } from '../../core/services/auth.service';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';

@Component({
  selector: 'app-register-trial-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    <div class="dialog-box">
      <!-- Strict ERP Standard Header -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="icon-box">
            <mat-icon>rocket_launch</mat-icon>
          </div>
          <div>
            <h3 class="title">Create Demo Institute / 14-Day Free Trial</h3>
            <p class="subtitle">
              Instant SaaS Setup • <strong>Zero Credit Card Required</strong> • Pre-loaded Sample Data
            </p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="onCancel()" type="button" [disabled]="submitting">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-body">
        <form [formGroup]="regForm" (ngSubmit)="onSubmit()">
          
          <!-- Banner Information -->
          <div class="trial-perks-banner">
            <div class="perk-item">
              <mat-icon>verified</mat-icon>
              <span>14 Days Full Access</span>
            </div>
            <div class="perk-item">
              <mat-icon>group</mat-icon>
              <span>Up to 50 Students</span>
            </div>
            <div class="perk-item">
              <mat-icon>flash_on</mat-icon>
              <span>Instant Auto-Login</span>
            </div>
          </div>

          <!-- Section 1: Institute Info -->
          <div class="section-title">
            <mat-icon>school</mat-icon>
            <span>1. Institute Details</span>
          </div>

          <div class="form-row">
            <mat-form-field appearance="outline" class="col-7">
              <mat-label>Institute Name</mat-label>
              <input matInput formControlName="name" placeholder="e.g. Apex International Academy" (input)="onNameInput($event)">
              <mat-icon matSuffix>business</mat-icon>
              <mat-error *ngIf="regForm.get('name')?.hasError('required')">Institute name is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="col-5">
              <mat-label>Unique Code</mat-label>
              <input matInput formControlName="code" placeholder="e.g. APEX" (input)="onCodeInput($event)">
              <mat-spinner matSuffix diameter="18" *ngIf="checkingCode"></mat-spinner>
              <mat-icon matSuffix *ngIf="!checkingCode && codeStatus === 'available'" 
                        class="status-icon-ok" 
                        [matTooltip]="codeStatusMessage" 
                        matTooltipPosition="above">check_circle</mat-icon>
              <mat-icon matSuffix *ngIf="!checkingCode && codeStatus === 'taken'" 
                        class="status-icon-err" 
                        [matTooltip]="codeStatusMessage" 
                        matTooltipPosition="above">cancel</mat-icon>
              <mat-hint *ngIf="codeStatus === 'available'" class="hint-ok" [matTooltip]="codeStatusMessage" matTooltipPosition="below">
                ✓ Code is available
              </mat-hint>
              <mat-hint *ngIf="codeStatus === 'taken'" class="hint-err" [matTooltip]="codeStatusMessage" matTooltipPosition="below">
                ✗ Code already taken
              </mat-hint>
              <mat-error *ngIf="regForm.get('code')?.hasError('required')">Code is required</mat-error>
            </mat-form-field>
          </div>

          <div class="form-row">
            <mat-form-field appearance="outline" class="col-6">
              <mat-label>Mobile / WhatsApp Phone</mat-label>
              <input matInput formControlName="contactPhone" placeholder="e.g. 9876543210">
              <mat-icon matSuffix>phone</mat-icon>
              <mat-error *ngIf="regForm.get('contactPhone')?.hasError('required')">Phone is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="col-6">
              <mat-label>City / Location</mat-label>
              <input matInput formControlName="address" placeholder="e.g. Jaipur, Rajasthan">
              <mat-icon matSuffix>location_on</mat-icon>
            </mat-form-field>
          </div>

          <!-- Section 2: Modules -->
          <div class="section-title">
            <mat-icon>apps</mat-icon>
            <span>2. Select Modules to Test</span>
          </div>

          <div class="modules-grid">
            <label class="module-check" [class.selected]="regForm.get('hasSchoolModule')?.value">
              <mat-checkbox formControlName="hasSchoolModule" color="primary"></mat-checkbox>
              <div class="mod-info">
                <strong>🏫 School Management</strong>
                <span>Classes, Sections, Routine, Exams</span>
              </div>
            </label>

            <label class="module-check" [class.selected]="regForm.get('hasCoachingModule')?.value">
              <mat-checkbox formControlName="hasCoachingModule" color="primary"></mat-checkbox>
              <div class="mod-info">
                <strong>📚 Coaching & Batches</strong>
                <span>Batches, Attendance, Fees</span>
              </div>
            </label>

            <label class="module-check" [class.selected]="regForm.get('hasHostelModule')?.value">
              <mat-checkbox formControlName="hasHostelModule" color="primary"></mat-checkbox>
              <div class="mod-info">
                <strong>🏢 Hostel & Rooms</strong>
                <span>Beds, Allocations, Inmates</span>
              </div>
            </label>

            <label class="module-check" [class.selected]="regForm.get('hasLibraryModule')?.value">
              <mat-checkbox formControlName="hasLibraryModule" color="primary"></mat-checkbox>
              <div class="mod-info">
                <strong>📖 Library Management</strong>
                <span>Books, Circulation, Fines</span>
              </div>
            </label>

            <label class="module-check" [class.selected]="regForm.get('hasTransportModule')?.value">
              <mat-checkbox formControlName="hasTransportModule" color="primary"></mat-checkbox>
              <div class="mod-info">
                <strong>🚌 Transport & Routes</strong>
                <span>Vehicles, Stoppages, Pickups</span>
              </div>
            </label>
          </div>

          <!-- Section 3: Admin Credentials -->
          <div class="section-title">
            <mat-icon>admin_panel_settings</mat-icon>
            <span>3. Administrator Login Account</span>
          </div>

          <div class="form-row">
            <mat-form-field appearance="outline" class="col-4">
              <mat-label>Admin Full Name</mat-label>
              <input matInput formControlName="adminFullName" placeholder="e.g. Director Name">
              <mat-icon matSuffix>badge</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="col-4">
              <mat-label>Admin Username</mat-label>
              <input matInput formControlName="adminUsername" placeholder="e.g. admin">
              <mat-icon matSuffix>person</mat-icon>
              <mat-error *ngIf="regForm.get('adminUsername')?.hasError('required')">Username is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="col-4">
              <mat-label>Admin Password</mat-label>
              <input matInput [type]="hidePassword ? 'password' : 'text'" formControlName="adminPassword">
              <button mat-icon-button matSuffix (click)="hidePassword = !hidePassword" type="button">
                <mat-icon>{{hidePassword ? 'visibility_off' : 'visibility'}}</mat-icon>
              </button>
              <mat-error *ngIf="regForm.get('adminPassword')?.hasError('required')">Password is required</mat-error>
            </mat-form-field>
          </div>

          <!-- Section 4: Sample Demo Data -->
          <div class="sample-data-card">
            <mat-checkbox formControlName="seedSampleDemoData" color="primary">
              <div class="sample-label">
                <strong>🌟 Pre-load Ready-to-Test Sample Data (Recommended)</strong>
                <p>Creates 4 sample students, 2 active batches, fee vouchers, and teachers so you can test fee receipts, ID cards, and attendance right away!</p>
              </div>
            </mat-checkbox>
          </div>

          <div *ngIf="errorMessage" class="error-banner">
            <mat-icon>error</mat-icon>
            <span>{{ errorMessage }}</span>
          </div>

          <!-- Action Buttons -->
          <div class="dialog-actions">
            <button mat-button type="button" (click)="onCancel()" [disabled]="submitting">
              Cancel
            </button>
            <button mat-raised-button color="primary" type="submit" class="submit-action-btn" [disabled]="regForm.invalid || submitting || codeStatus === 'taken'">
              <mat-spinner diameter="20" *ngIf="submitting" style="display:inline-block; margin-right:8px;"></mat-spinner>
              <mat-icon *ngIf="!submitting">check_circle</mat-icon>
              <span>{{ submitting ? 'Provisioning Institute...' : 'Create & Launch Instant Demo' }}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  `,
  styles: [`
    .dialog-box {
      width: 100%;
      max-width: 680px;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
    }

    /* Strict Light Blue Gradient Header matching generate-invoices-dialog */
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;

      .header-left {
        display: flex;
        align-items: center;
        gap: 14px;

        .icon-box {
          background: #2563eb;
          color: #ffffff;
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
          mat-icon {
            font-size: 24px;
            width: 24px;
            height: 24px;
          }
        }

        .title {
          margin: 0;
          font-size: 1.18rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.25;
        }

        .subtitle {
          margin: 3px 0 0 0;
          font-size: 0.8rem;
          color: #3b82f6;
          strong {
            color: #1e40af;
          }
        }
      }

      .close-btn {
        color: #64748b;
        &:hover {
          color: #1e293b;
        }
      }
    }

    .dialog-body {
      padding: 20px 24px;
      max-height: 80vh;
      overflow-y: auto;
    }

    .trial-perks-banner {
      display: flex;
      justify-content: space-around;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 14px;
      margin-bottom: 18px;

      .perk-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.82rem;
        font-weight: 600;
        color: #1e40af;
        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #2563eb;
        }
      }
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.9rem;
      font-weight: 700;
      color: #0f172a;
      margin: 14px 0 10px;
      padding-bottom: 4px;
      border-bottom: 1px solid #f1f5f9;
      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #2563eb;
      }
    }

    .form-row {
      display: flex;
      gap: 12px;
      margin-bottom: 6px;
      .col-4 { flex: 4; }
      .col-5 { flex: 5; }
      .col-6 { flex: 6; }
      .col-7 { flex: 7; }
      .col-8 { flex: 8; }
      .col-12 { flex: 12; }
    }

    .modules-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }

    .module-check {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding: 8px 10px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      cursor: pointer;
      background: #ffffff;
      transition: all 0.15s ease;

      &.selected {
        border-color: #93c5fd;
        background: #f0f7ff;
      }

      .mod-info {
        display: flex;
        flex-direction: column;
        strong {
          font-size: 0.82rem;
          color: #1e293b;
        }
        span {
          font-size: 0.72rem;
          color: #64748b;
        }
      }
    }

    .sample-data-card {
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
      border: 1px solid #a7f3d0;
      border-radius: 10px;
      padding: 10px 14px;
      margin: 14px 0;

      .sample-label {
        strong {
          font-size: 0.86rem;
          color: #065f46;
          display: block;
        }
        p {
          margin: 2px 0 0 0;
          font-size: 0.76rem;
          color: #047857;
          line-height: 1.35;
        }
      }
    }

    .status-icon-ok { color: #16a34a !important; cursor: pointer; }
    .status-icon-err { color: #dc2626 !important; cursor: pointer; }
    .hint-ok { 
      color: #16a34a !important; 
      font-weight: 600; 
      white-space: nowrap; 
      cursor: help;
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }
    .hint-err { 
      color: #dc2626 !important; 
      font-weight: 600; 
      white-space: nowrap; 
      cursor: help;
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #b91c1c;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 0.84rem;
      margin-bottom: 12px;
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: #dc2626; }
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid #f1f5f9;

      .submit-action-btn {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
        color: #ffffff !important;
        font-weight: 600;
        border-radius: 8px;
        padding: 8px 20px;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
      }
    }
  `]
})
export class RegisterTrialDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  public dialogRef = inject(MatDialogRef<RegisterTrialDialogComponent>);

  regForm!: FormGroup;
  submitting = false;
  hidePassword = true;
  checkingCode = false;
  codeStatus: 'none' | 'available' | 'taken' = 'none';
  codeStatusMessage = '';
  errorMessage = '';

  private codeSubject = new Subject<string>();

  ngOnInit(): void {
    this.regForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      code: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(15)]],
      contactPhone: ['', [Validators.required]],
      address: [''],
      hasSchoolModule: [true],
      hasCoachingModule: [true],
      hasHostelModule: [false],
      hasLibraryModule: [false],
      hasTransportModule: [false],
      adminFullName: ['Demo Administrator'],
      adminUsername: ['admin', [Validators.required]],
      adminPassword: ['admin123', [Validators.required]],
      seedSampleDemoData: [true]
    });

    // Real-time debounce check for tenant code availability
    this.codeSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(code => {
        const clean = (code || '').trim().toUpperCase();
        if (clean.length < 3) {
          this.codeStatus = 'none';
          this.codeStatusMessage = '';
          this.checkingCode = false;
          return of(null);
        }
        this.checkingCode = true;
        return this.authService.checkTenantCodeAvailability(clean);
      })
    ).subscribe({
      next: (res) => {
        this.checkingCode = false;
        if (!res) return;
        if (res.available) {
          this.codeStatus = 'available';
          this.codeStatusMessage = res.message;
        } else {
          this.codeStatus = 'taken';
          this.codeStatusMessage = res.message;
        }
      },
      error: () => {
        this.checkingCode = false;
        this.codeStatus = 'none';
      }
    });
  }

  onNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input && !this.regForm.get('code')?.dirty) {
      // Auto-suggest short code from institute name
      const suggested = input.value
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .substring(0, 8);
      if (suggested.length >= 3) {
        this.regForm.get('code')?.setValue(suggested);
        this.codeSubject.next(suggested);
      }
    }
  }

  onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      input.value = input.value.toUpperCase();
      this.regForm.get('code')?.setValue(input.value, { emitEvent: false });
      this.codeSubject.next(input.value);
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onSubmit(): void {
    if (this.regForm.invalid || this.codeStatus === 'taken') return;

    this.submitting = true;
    this.errorMessage = '';

    const val = this.regForm.value;
    const dto: RegisterTrialTenantDto = {
      name: (val.name || '').trim(),
      code: (val.code || '').trim().toUpperCase(),
      contactPhone: (val.contactPhone || '').trim(),
      address: (val.address || '').trim(),
      adminFullName: (val.adminFullName || '').trim() || `${val.name} Administrator`,
      adminUsername: (val.adminUsername || 'admin').trim(),
      adminPassword: val.adminPassword || 'admin123',
      hasSchoolModule: !!val.hasSchoolModule,
      hasCoachingModule: !!val.hasCoachingModule,
      hasHostelModule: !!val.hasHostelModule,
      hasLibraryModule: !!val.hasLibraryModule,
      hasTransportModule: !!val.hasTransportModule,
      seedSampleDemoData: !!val.seedSampleDemoData
    };

    this.authService.registerTrialTenant(dto).subscribe({
      next: (res) => {
        this.submitting = false;
        this.dialogRef.close(true);
        // Instant Auto-Login: User is already logged in, navigate straight to dashboard!
        this.router.navigate(['/dashboard'], {
          queryParams: { new_demo_registered: '1', tenant: res.tenantCode }
        });
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err?.error?.message || 'Registration failed. Please check Institute Code and details.';
      }
    });
  }
}
