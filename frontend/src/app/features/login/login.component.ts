import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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
    MatProgressSpinnerModule
  ],
  template: `
    <div class="login-wrapper">
      <mat-card class="login-card">
        <mat-card-header class="login-header">
          <div class="brand-badge">
            <mat-icon color="primary">school</mat-icon>
          </div>
          <mat-card-title class="title">IMSERP Vertical SaaS</mat-card-title>
          <mat-card-subtitle>Coaching & Tuition Management Portal</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Username</mat-label>
              <input matInput formControlName="username" placeholder="e.g. admin, teacher, accountant">
              <mat-icon matSuffix>person</mat-icon>
              <mat-error *ngIf="loginForm.get('username')?.hasError('required')">Username is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input matInput [type]="hidePassword ? 'password' : 'text'" formControlName="password">
              <button mat-icon-button matSuffix (click)="hidePassword = !hidePassword" type="button">
                <mat-icon>{{hidePassword ? 'visibility_off' : 'visibility'}}</mat-icon>
              </button>
              <mat-error *ngIf="loginForm.get('password')?.hasError('required')">Password is required</mat-error>
            </mat-form-field>

            <div *ngIf="errorMessage" class="error-banner">
              <mat-icon color="warn">error</mat-icon>
              <span>{{ errorMessage }}</span>
            </div>

            <button mat-raised-button color="primary" class="full-width submit-btn" type="submit" [disabled]="loginForm.invalid || loading">
              <mat-spinner diameter="20" *ngIf="loading" style="display:inline-block; margin-right:8px;"></mat-spinner>
              <span>Sign In</span>
            </button>
          </form>

          <div class="quick-demo-roles">
            <p><strong>Demo Roles Quick Login:</strong></p>
            <div class="role-buttons">
              <button mat-stroked-button (click)="fillCredentials('admin', 'admin123')">Director (Admin)</button>
              <button mat-stroked-button (click)="fillCredentials('teacher', 'teacher123')">Faculty (Teacher)</button>
              <button mat-stroked-button (click)="fillCredentials('accountant', 'account123')">Accountant</button>
            </div>
          </div>
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
      background: linear-gradient(135deg, #1e88e5 0%, #1565c0 100%);
    }
    .login-card {
      width: 100%;
      max-width: 420px;
      padding: 24px;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2) !important;
    }
    .login-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      margin-bottom: 24px;
      padding: 0;
    }
    .brand-badge {
      background-color: #e3f2fd;
      padding: 12px;
      border-radius: 50%;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1976d2;
    }
    .full-width {
      width: 100%;
      margin-bottom: 8px;
    }
    .submit-btn {
      padding: 12px;
      font-size: 1rem;
      font-weight: 600;
      margin-top: 12px;
      height: 48px;
      border-radius: 8px;
    }
    .error-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background-color: #ffebee;
      color: #c62828;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.9rem;
      margin-bottom: 12px;
    }
    .quick-demo-roles {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #eee;
      text-align: center;
      font-size: 0.85rem;
      color: #666;
    }
    .role-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      margin-top: 8px;

      button {
        font-size: 0.75rem;
      }
    }
  `]
})
export class LoginComponent {
  loginForm: FormGroup;
  hidePassword = true;
  loading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      username: ['admin', [Validators.required]],
      password: ['admin123', [Validators.required]]
    });
  }

  fillCredentials(user: string, pass: string) {
    this.loginForm.patchValue({ username: user, password: pass });
    this.errorMessage = '';
  }

  onSubmit() {
    if (this.loginForm.invalid) return;

    this.loading = true;
    this.errorMessage = '';

    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Authentication failed. Please check credentials.';
      }
    });
  }
}
