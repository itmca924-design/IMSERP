import { Component, OnInit } from '@angular/core';
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
import { AuthService } from '../../core/services/auth.service';

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
    MatProgressSpinnerModule,
    MatCheckboxModule
  ],
  template: `
    <div class="login-wrapper">
      <mat-card class="login-card">
        <mat-card-header class="login-header">
          <div class="brand-badge">
            <mat-icon color="primary">school</mat-icon>
          </div>
          <mat-card-title class="title">IMSERP Vertical SaaS</mat-card-title>
          <mat-card-subtitle>Multi-Tenant Coaching Management ERP</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">

            <!-- Institute / Tenant Code -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Institute Code</mat-label>
              <input matInput formControlName="tenantCode" placeholder="e.g. APEX" (input)="onTenantCodeInput($event)">
              <mat-icon matSuffix>corporate_fare</mat-icon>
              <mat-hint>Assigned code for your coaching institute</mat-hint>
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

            <!-- Remember Me Checkbox -->
            <div class="remember-row">
              <mat-checkbox formControlName="rememberMe" color="primary">
                Keep me signed in on this device
              </mat-checkbox>
            </div>

            <!-- Session Notice or Error Banner -->
            <div *ngIf="sessionNotice" class="info-banner">
              <mat-icon>schedule</mat-icon>
              <span>{{ sessionNotice }}</span>
            </div>

            <div *ngIf="errorMessage" class="error-banner">
              <mat-icon color="warn">error</mat-icon>
              <span>{{ errorMessage }}</span>
            </div>

            <button mat-raised-button color="primary" class="full-width submit-btn" type="submit" [disabled]="loginForm.invalid || loading">
              <mat-spinner diameter="20" *ngIf="loading" style="display:inline-block; margin-right:8px;"></mat-spinner>
              <span>Sign In to Institute</span>
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-wrapper {
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0b1329 0%, #1e3a8a 100%);
    }
    .login-card {
      width: 100%;
      max-width: 420px;
      padding: 24px;
      border-radius: 16px;
      box-shadow: 0 12px 36px rgba(0,0,0,0.35) !important;
      background: #ffffff;
    }
    .login-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      margin-bottom: 22px;
      padding: 0;
    }
    .brand-badge {
      background-color: #eff6ff;
      padding: 12px;
      border-radius: 50%;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #bfdbfe;
    }
    .title {
      font-size: 1.45rem;
      font-weight: 800;
      color: #1e3a8a;
      letter-spacing: -0.02em;
    }
    .full-width {
      width: 100%;
      margin-bottom: 8px;
    }
    .remember-row {
      margin: -2px 0 10px;
      display: flex;
      align-items: center;
      ::ng-deep .mdc-label {
        font-size: 0.88rem;
        color: #475569;
        font-weight: 500;
        cursor: pointer;
      }
    }
    .submit-btn {
      padding: 12px;
      font-size: 1rem;
      font-weight: 600;
      margin-top: 6px;
      height: 48px;
      border-radius: 8px;
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
      password: ['admin123', [Validators.required]],
      rememberMe: [false]
    });
  }

  ngOnInit(): void {
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
    const rememberMe = !!val.rememberMe;

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
}

