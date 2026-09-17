import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { LoadingService } from './core/services/loading.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, MatProgressSpinnerModule, MatIconModule],
  template: `
    <router-outlet></router-outlet>

    @if (loadingService.isLoading()) {
      <div class="global-screen-lock" role="alert" aria-busy="true">
        <div class="loader-glass-card">
          <div class="spinner-brand-wrap">
            <mat-spinner diameter="48" strokeWidth="4"></mat-spinner>
            <mat-icon class="brand-center-icon">school</mat-icon>
          </div>
          <div class="loader-text-group">
            <h4 class="loader-title">Please Wait</h4>
            <p class="loader-desc">{{ loadingService.loadingMessage() }}</p>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .global-screen-lock {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      z-index: 999999;
      background: rgba(11, 19, 41, 0.45);
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: all !important;
      user-select: none;
      cursor: wait !important;
      animation: fadeIn 0.18s ease-out;
    }

    .loader-glass-card {
      background: rgba(255, 255, 255, 0.96);
      padding: 22px 30px;
      border-radius: 18px;
      box-shadow: 0 24px 50px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.5);
      display: flex;
      align-items: center;
      gap: 18px;
      max-width: 440px;
      animation: scaleUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .spinner-brand-wrap {
      position: relative;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      .brand-center-icon {
        position: absolute;
        font-size: 22px;
        width: 22px;
        height: 22px;
        color: #2563eb;
        pointer-events: none;
      }
    }

    .loader-text-group {
      display: flex;
      flex-direction: column;
      gap: 3px;

      .loader-title {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: -0.01em;
      }

      .loader-desc {
        margin: 0;
        font-size: 0.85rem;
        color: #64748b;
        font-weight: 500;
        line-height: 1.35;
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes scaleUp {
      from { transform: scale(0.92); opacity: 0.8; }
      to { transform: scale(1); opacity: 1; }
    }
  `]
})
export class AppComponent {
  constructor(public loadingService: LoadingService) {}
}
