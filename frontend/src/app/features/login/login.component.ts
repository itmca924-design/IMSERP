import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../core/services/auth.service';
import { RegisterTrialDialogComponent } from './register-trial-dialog.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="login-wrapper">
      <!-- Ambient light blobs in background -->
      <div class="ambient-glow"></div>

      <mat-card class="login-card">
        <!-- Top decorative gradient line -->
        <div class="card-accent-line"></div>

        <div class="login-header">
          <div class="brand-logo-box">
            <mat-icon class="brand-icon">school</mat-icon>
          </div>
          <h1 class="brand-title">ERP Vertical SaaS</h1>
          
          <div class="subtitle-badge">
            <span class="tenant-pill">Multi-Tenant</span>
            <span class="subtitle-text">All-in-One Education ERP</span>
          </div>

          <div class="module-tags-row">
            <span class="module-tag">School</span>
            <span class="tag-sep">•</span>
            <span class="module-tag">Coaching</span>
            <span class="tag-sep">•</span>
            <span class="module-tag">Hostel</span>
            <span class="tag-sep">•</span>
            <span class="module-tag">Library</span>
            <span class="tag-sep">•</span>
            <span class="module-tag">Transport</span>
          </div>
        </div>

        <mat-card-content class="form-content">
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">

            <!-- Institute / Tenant Code -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Institute Code</mat-label>
              <input matInput formControlName="tenantCode" placeholder="e.g. APEX" (input)="onTenantCodeInput($event)">
              <mat-icon matSuffix>corporate_fare</mat-icon>
              <mat-hint>Assigned code for your institute</mat-hint>
              <mat-error *ngIf="loginForm.get('tenantCode')?.hasError('required')">Institute Code is required</mat-error>
            </mat-form-field>

            <!-- Username -->
            <mat-form-field appearance="outline" class="full-width" style="margin-top: 6px;">
              <mat-label>Username</mat-label>
              <input matInput formControlName="username" placeholder="e.g. admin, faculty, accountant">
              <mat-icon matSuffix>person</mat-icon>
              <mat-error *ngIf="loginForm.get('username')?.hasError('required')">Username is required</mat-error>
            </mat-form-field>

            <!-- Password -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input matInput [type]="hidePassword ? 'password' : 'text'" formControlName="password">
              <button mat-icon-button matSuffix (click)="hidePassword = !hidePassword" type="button">
                <mat-icon>{{hidePassword ? 'visibility_off' : 'visibility'}}</mat-icon>
              </button>
              <mat-error *ngIf="loginForm.get('password')?.hasError('required')">Password is required</mat-error>
            </mat-form-field>

            <!-- Session Notice or Error Banner -->
            <div *ngIf="sessionNotice" class="info-banner">
              <mat-icon>schedule</mat-icon>
              <span>{{ sessionNotice }}</span>
            </div>

            <div *ngIf="errorMessage" class="error-banner">
              <mat-icon color="warn">error</mat-icon>
              <span>{{ errorMessage }}</span>
            </div>

            <button mat-raised-button class="full-width submit-btn" type="submit" [disabled]="loginForm.invalid || loading">
              <mat-spinner diameter="20" *ngIf="loading" style="display:inline-block; margin-right:8px;"></mat-spinner>
              <span>Sign In to Institute</span>
              <mat-icon class="btn-arrow" *ngIf="!loading">arrow_forward</mat-icon>
            </button>

            <!-- Action Divider -->
            <div class="or-divider">
              <span class="line"></span>
              <span class="text">or explore software</span>
              <span class="line"></span>
            </div>

            <!-- Demo and Registration Actions -->
            <div class="demo-actions-row">
              <button type="button" mat-stroked-button class="create-tenant-btn" (click)="openRegisterTrialDialog()">
                <mat-icon>rocket_launch</mat-icon>
                <span>Create Institute (14-Day Free Demo)</span>
              </button>

              <button type="button" class="quick-demo-link" (click)="fillDemoCredentials()">
                <mat-icon>flash_on</mat-icon>
                <span>Try 1-Click Interactive Demo</span>
              </button>
            </div>

            <!-- Enterprise Trust Footer -->
            <div class="security-footer">
              <mat-icon class="sec-icon">verified_user</mat-icon>
              <span>256-Bit SSL Encrypted • Enterprise Cloud</span>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-wrapper {
      min-height: 100vh;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #0b1329;
      background-image: 
        radial-gradient(circle at 50% 20%, #1e3a8a 0%, #0b1329 65%, #030712 100%),
        radial-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px);
      background-size: 100% 100%, 28px 28px;
      overflow: hidden;
      padding: 20px;
      box-sizing: border-box;
    }
    .ambient-glow {
      position: absolute;
      width: 520px;
      height: 520px;
      background: radial-gradient(circle, rgba(37, 99, 235, 0.28) 0%, rgba(59, 130, 246, 0.08) 50%, transparent 70%);
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      filter: blur(40px);
      z-index: 1;
    }
    .login-card {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 440px;
      padding: 32px 28px 26px;
      border-radius: 20px;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08) !important;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      overflow: hidden;
    }
    .card-accent-line {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #2563eb 0%, #38bdf8 50%, #6366f1 100%);
    }
    .login-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      margin-bottom: 22px;
    }
    .brand-logo-box {
      width: 54px;
      height: 54px;
      border-radius: 14px;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 18px -2px rgba(37, 99, 235, 0.4);
      margin-bottom: 12px;
      .brand-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
        color: #ffffff;
      }
    }
    .brand-title {
      font-size: 1.45rem;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.025em;
      margin: 0 0 8px 0;
    }
    .subtitle-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f0f7ff;
      border: 1px solid #bfdbfe;
      border-radius: 20px;
      padding: 4px 10px;
      margin-bottom: 8px;
      box-shadow: 0 1px 3px rgba(37, 99, 235, 0.06);
    }
    .tenant-pill {
      background: #2563eb;
      color: #ffffff;
      font-size: 0.66rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 10px;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }
    .subtitle-text {
      font-size: 0.78rem;
      font-weight: 700;
      color: #1e40af;
      letter-spacing: -0.01em;
      white-space: nowrap;
    }
    .module-tags-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 0.74rem;
      color: #64748b;
      font-weight: 600;
      letter-spacing: 0.01em;
      white-space: nowrap;
    }
    .tag-sep {
      color: #94a3b8;
      font-size: 0.7rem;
    }
    .module-tag {
      color: #475569;
    }
    .form-content {
      padding: 0;
    }
    .full-width {
      width: 100%;
      margin-bottom: 8px;
    }
    .submit-btn {
      width: 100%;
      height: 48px;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
      color: #ffffff !important;
      font-size: 0.98rem;
      font-weight: 600;
      border-radius: 10px;
      margin-top: 6px;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      &:hover:not([disabled]) {
        box-shadow: 0 8px 22px rgba(37, 99, 235, 0.5);
        transform: translateY(-1px);
      }
      .btn-arrow {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-left: 4px;
        vertical-align: middle;
      }
    }
    .security-footer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 18px;
      font-size: 0.74rem;
      color: #64748b;
      font-weight: 500;
      .sec-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #10b981;
      }
    }
    .or-divider {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 16px 0 12px;
      .line {
        flex: 1;
        height: 1px;
        background: #e2e8f0;
      }
      .text {
        font-size: 0.74rem;
        color: #94a3b8;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
    }
    .demo-actions-row {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
      width: 100%;
    }
    .create-tenant-btn {
      width: 100%;
      height: 44px;
      border: 1.5px solid #bfdbfe !important;
      background: #eff6ff !important;
      color: #1d4ed8 !important;
      font-weight: 700 !important;
      border-radius: 10px !important;
      font-size: 0.90rem !important;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
      &:hover {
        background: #dbeafe !important;
        border-color: #93c5fd !important;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
      }
      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #2563eb;
      }
    }
    .quick-demo-link {
      background: none;
      border: none;
      color: #475569;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 6px;
      transition: color 0.15s ease;
      &:hover {
        color: #2563eb;
        text-decoration: underline;
      }
      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #f59e0b;
      }
    }
    .info-banner {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background-color: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 500;
      margin-bottom: 12px;
      mat-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; margin-top: 1px; }
      span { flex: 1; line-height: 1.4; }
    }
    .error-banner {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background-color: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 500;
      margin-bottom: 12px;
      mat-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; margin-top: 1px; color: #dc2626 !important; }
      span { flex: 1; line-height: 1.4; }
    }
  `]
})
export class LoginComponent implements OnInit {
  private dialog = inject(MatDialog, { optional: true });
  loginForm: FormGroup;
  hidePassword = true;
  loading = false;
  errorMessage = '';
  sessionNotice = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    const defaultCode = this.authService.getLastTenantCode();
    this.loginForm = this.fb.group({
      tenantCode: [defaultCode, [Validators.required]],
      username: ['admin', [Validators.required]],
      password: ['admin123', [Validators.required]]
    });
  }

  ngOnInit(): void {
    // Immediately close any open modal dialogs or popups upon entering login
    try {
      this.dialog?.closeAll();
    } catch (e) {
      console.warn('Could not close dialogs on login init:', e);
    }

    const reason = this.route.snapshot.queryParams['reason'];
    if (reason === 'idle_timeout') {
      this.sessionNotice = 'Your session expired due to inactivity. Please sign in again.';
    } else if (reason === 'session_expired') {
      this.sessionNotice = 'Your security session has expired. Please sign in again.';
    }
  }

  onTenantCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      input.value = input.value.toUpperCase();
      this.loginForm.get('tenantCode')?.setValue(input.value, { emitEvent: false });
    }
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.loading = true;
    this.errorMessage = '';
    this.sessionNotice = '';

    const val = this.loginForm.value;
    const credentials = {
      tenantCode: (val.tenantCode || '').trim().toUpperCase(),
      username: (val.username || '').trim(),
      password: val.password
    };
    const rememberMe = true;

    this.authService.login(credentials, rememberMe).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Authentication failed. Please check Institute Code and credentials.';
      }
    });
  }

  openRegisterTrialDialog(): void {
    this.dialog?.open(RegisterTrialDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      disableClose: true
    });
  }

  fillDemoCredentials(): void {
    this.loginForm.patchValue({
      tenantCode: 'APEX',
      username: 'admin',
      password: 'admin123'
    });
    this.onSubmit();
  }
}

