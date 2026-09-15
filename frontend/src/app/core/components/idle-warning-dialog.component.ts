import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'app-idle-warning-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule
  ],
  template: `
    <div class="idle-modal-container">
      <div class="idle-icon-wrapper">
        <mat-icon class="warning-icon">hourglass_top</mat-icon>
      </div>

      <h2 class="idle-title">Session Inactivity Warning</h2>
      <p class="idle-desc">
        You have been inactive for a while. To protect your institute's data, your session will automatically expire in:
      </p>

      <div class="countdown-badge">
        <span class="countdown-number">{{ secondsRemaining }}</span>
        <span class="countdown-unit">seconds</span>
      </div>

      <mat-progress-bar mode="determinate" [value]="progressPercent" color="warn" class="countdown-bar"></mat-progress-bar>

      <div class="modal-actions">
        <button mat-flat-button color="primary" class="stay-btn" (click)="stayLoggedIn()">
          <mat-icon>check_circle</mat-icon>
          <span>Stay Logged In</span>
        </button>

        <button mat-stroked-button color="warn" class="logout-btn" (click)="logoutNow()">
          <mat-icon>logout</mat-icon>
          <span>Logout Now</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .idle-modal-container {
      padding: 24px 20px 20px;
      text-align: center;
      max-width: 400px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-sizing: border-box;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .idle-icon-wrapper {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: #fef3c7;
      border: 2px solid #f59e0b;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
      animation: pulse 1.8s infinite;

      .warning-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: #d97706;
      }
    }

    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
      70% { box-shadow: 0 0 0 14px rgba(245, 158, 11, 0); }
      100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
    }

    .idle-title {
      font-size: 1.25rem;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 8px;
      letter-spacing: -0.01em;
    }

    .idle-desc {
      font-size: 0.88rem;
      color: #64748b;
      margin: 0 0 16px;
      line-height: 1.45;
    }

    .countdown-badge {
      display: flex;
      align-items: baseline;
      gap: 6px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 12px;
      padding: 8px 22px;
      margin-bottom: 16px;

      .countdown-number {
        font-size: 2.2rem;
        font-weight: 900;
        color: #dc2626;
        line-height: 1;
      }

      .countdown-unit {
        font-size: 0.88rem;
        font-weight: 700;
        color: #991b1b;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
    }

    .countdown-bar {
      width: 100%;
      height: 6px;
      border-radius: 3px;
      margin-bottom: 22px;
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      width: 100%;

      button {
        flex: 1;
        height: 42px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.88rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }

      .stay-btn {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        color: #ffffff;
      }
    }
  `]
})
export class IdleWarningDialogComponent implements OnInit, OnDestroy {
  secondsRemaining: number = 60;
  totalSeconds: number = 60;
  private intervalTimer: any;

  constructor(
    public dialogRef: MatDialogRef<IdleWarningDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { seconds: number }
  ) {
    if (data?.seconds) {
      this.secondsRemaining = data.seconds;
      this.totalSeconds = data.seconds;
    }
  }

  get progressPercent(): number {
    return (this.secondsRemaining / this.totalSeconds) * 100;
  }

  ngOnInit(): void {
    this.intervalTimer = setInterval(() => {
      this.secondsRemaining--;
      if (this.secondsRemaining <= 0) {
        clearInterval(this.intervalTimer);
        this.dialogRef.close('timeout');
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }
  }

  stayLoggedIn(): void {
    this.dialogRef.close('stay');
  }

  logoutNow(): void {
    this.dialogRef.close('logout');
  }
}
