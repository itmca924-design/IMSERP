import { Component, inject, ChangeDetectionStrategy } from '@angular/core';

import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterModule, MatIconModule, MatTooltipModule],
  host: {
    '[class.is-collapsed]': 'isCollapsed'
  },
  template: `
    <div class="footer-grid-wrapper">
      <footer class="app-footer">
        <div class="footer-container">
          <!-- Left: Copyright and Institute Info -->
          <div class="footer-left">
            <div class="brand-line">
              <mat-icon class="footer-brand-icon">school</mat-icon>
              <span class="copyright-text">
                &copy; {{ currentYear }} <strong>{{ instituteName }}</strong>. All rights reserved.
              </span>
            </div>
            <span class="tagline">Enterprise Coaching Management &amp; Analytics ERP</span>
          </div>

          <!-- Center: Quick Helpful Links -->
          <div class="footer-center">
            <a routerLink="/dashboard" class="footer-link">Dashboard</a>
            <span class="divider-dot">&bull;</span>
            <a routerLink="/whatsapp" class="footer-link">WhatsApp Logs</a>
            <span class="divider-dot">&bull;</span>
            <a routerLink="/developer" class="footer-link" matTooltip="Developer & Technical Team Details">Support &amp; Help</a>
            <span class="divider-dot">&bull;</span>
            <a href="javascript:void(0)" class="footer-link" matTooltip="Privacy Policy &amp; Terms">Privacy &amp; Security</a>
          </div>

          <!-- Right: Status Indicator, Version Badge & Minimize Toggle -->
          <div class="footer-right">
            <div class="status-indicator" matTooltip="Cloud API &amp; Database live and healthy">
              <span class="pulse-dot"></span>
              <span class="status-text">System Live</span>
            </div>
            <div class="version-badge" matTooltip="School ERP Engine Version">
              {{ appVersion }}
            </div>
            <button 
              type="button" 
              class="footer-toggle-btn minimize-btn" 
              (click)="toggleFooter()" 
              matTooltip="Minimize Footer (Maximize working area for 19-inch screens)" 
              aria-label="Minimize Footer">
              <mat-icon class="toggle-icon">keyboard_arrow_down</mat-icon>
            </button>
          </div>
        </div>
      </footer>
    </div>

    <!-- Floating Expand Pill when Footer is Minimized -->
    @if (isCollapsed) {
      <button 
        type="button" 
        class="footer-expand-tab" 
        (click)="toggleFooter()" 
        matTooltip="Show Footer &amp; System Status" 
        aria-label="Show Footer">
        <span class="pulse-dot-mini"></span>
        <mat-icon class="expand-icon">keyboard_arrow_up</mat-icon>
        <span class="expand-label">Footer</span>
      </button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host {
      display: grid;
      grid-template-rows: 1fr;
      transition: grid-template-rows 0.32s cubic-bezier(0.16, 1, 0.3, 1);
      flex-shrink: 0;
      z-index: 10;
      width: 100%;

      &.is-collapsed {
        grid-template-rows: 0fr;
      }
    }

    .footer-grid-wrapper {
      overflow: hidden;
      min-height: 0;
    }

    .app-footer {
      background-color: #ffffff;
      border-top: 1px solid #e2e8f0;
      box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.03);
      color: #64748b;
      font-size: 0.8rem;
      padding: 9px 24px;
      margin-top: auto;
      transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.24s ease;
      transform: translateY(0);
      opacity: 1;
    }

    :host.is-collapsed .app-footer {
      transform: translateY(100%);
      opacity: 0;
      pointer-events: none;
    }

    .footer-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: nowrap;
      width: 100%;
      box-sizing: border-box;
    }

    /* Left Section */
    .footer-left {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex-shrink: 0;
      white-space: nowrap;

      .brand-line {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #334155;
        font-weight: 500;
        font-size: 0.78rem;

        .footer-brand-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #1976d2;
        }

        strong {
          color: #0f172a;
          font-weight: 600;
        }
      }

      .tagline {
        font-size: 0.7rem;
        color: #94a3b8;
        padding-left: 22px;
      }
    }

    /* Center Links */
    .footer-center {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      flex-shrink: 1;
      white-space: nowrap;

      .footer-link {
        color: #64748b;
        text-decoration: none;
        font-weight: 500;
        font-size: 0.78rem;
        transition: color 0.15s ease-in-out;

        &:hover {
          color: #1976d2;
          text-decoration: underline;
        }
      }

      .divider-dot {
        color: #cbd5e1;
        font-size: 0.75rem;
      }
    }

    /* Right Badges & Controls */
    .footer-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
      white-space: nowrap;

      .status-indicator {
        display: flex;
        align-items: center;
        gap: 6px;
        background-color: #f0fdf4;
        border: 1px solid #bbf7d0;
        color: #166534;
        padding: 3px 10px;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: default;

        .pulse-dot {
          width: 7px;
          height: 7px;
          background-color: #22c55e;
          border-radius: 50%;
          display: inline-block;
          box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
          animation: pulse 2s infinite cubic-bezier(0.66, 0, 0, 1);
        }

        @keyframes pulse {
          to {
            box-shadow: 0 0 0 6px rgba(34, 197, 94, 0);
          }
        }
      }

      .version-badge {
        background-color: #f1f5f9;
        border: 1px solid #e2e8f0;
        color: #475569;
        padding: 3px 9px;
        border-radius: 6px;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.4px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }

      .footer-toggle-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        border: 1px solid #cbd5e1;
        background: #f8fafc;
        border-radius: 6px;
        color: #64748b;
        cursor: pointer;
        outline: none;
        transition: all 0.18s ease;

        .toggle-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          line-height: 16px;
          transition: transform 0.18s ease;
        }

        &:hover {
          background: #eff6ff;
          border-color: #93c5fd;
          color: #2563eb;
          transform: translateY(1px);
        }

        &:active {
          background: #dbeafe;
        }
      }
    }

    /* Floating Expand Tab at Bottom Right */
    .footer-expand-tab {
      position: fixed;
      bottom: 8px;
      right: 24px;
      z-index: 99;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 12px 4px 10px;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid #bfdbfe;
      border-radius: 9999px;
      box-shadow: 0 4px 14px -2px rgba(37, 99, 235, 0.22), 0 2px 6px rgba(0, 0, 0, 0.05);
      color: #1e40af;
      font-size: 0.72rem;
      font-weight: 600;
      cursor: pointer;
      outline: none;
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      animation: tabPopIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);

      .pulse-dot-mini {
        width: 6px;
        height: 6px;
        background-color: #22c55e;
        border-radius: 50%;
        display: inline-block;
        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
        animation: pulse 2s infinite cubic-bezier(0.66, 0, 0, 1);
      }

      .expand-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #2563eb;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .expand-label {
        letter-spacing: 0.3px;
        color: #1e3a8a;
      }

      &:hover {
        background: #eff6ff;
        border-color: #60a5fa;
        color: #1d4ed8;
        transform: translateY(-2px);
        box-shadow: 0 6px 18px -2px rgba(37, 99, 235, 0.32);

        .expand-icon {
          transform: translateY(-2px);
          color: #1d4ed8;
        }

        .expand-label {
          color: #1d4ed8;
        }
      }

      &:active {
        transform: translateY(0) scale(0.96);
      }
    }

    @keyframes tabPopIn {
      0% {
        transform: translateY(18px) scale(0.85);
        opacity: 0;
      }
      100% {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
    }

    /* Compact Desktops, 19-inch Monitors (1366x768, 1440x900) & Laptops */
    @media (max-width: 1440px) {
      .app-footer {
        padding: 7px 18px;
      }

      .footer-container {
        gap: 10px;
        flex-wrap: nowrap !important;
      }

      .footer-left {
        .brand-line {
          font-size: 0.75rem;
        }
        .tagline {
          display: none !important;
        }
      }

      .footer-center {
        gap: 8px;
        .footer-link {
          font-size: 0.74rem;
        }
      }

      .footer-right {
        gap: 7px;
        .status-indicator {
          padding: 2px 8px;
          font-size: 0.7rem;
        }
        .version-badge {
          padding: 2px 7px;
          font-size: 0.68rem;
        }
        .footer-toggle-btn {
          width: 22px;
          height: 22px;
          .toggle-icon {
            font-size: 15px;
            width: 15px;
            height: 15px;
          }
        }
      }
    }

    /* Tablet & Smaller Desktop Screens (641px - 1024px) */
    @media (max-width: 1024px) and (min-width: 641px) {
      .app-footer {
        padding: 7px 14px;
      }

      .footer-container {
        flex-direction: row;
        flex-wrap: nowrap !important;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
      }

      .footer-left {
        .brand-line {
          font-size: 0.74rem;
        }
        .tagline {
          display: none !important;
        }
      }

      .footer-center {
        display: none !important;
      }

      .footer-right {
        gap: 6px;
        flex-shrink: 0;
      }
    }

    /* Mobile Compact (<= 640px) */
    @media (max-width: 640px) {
      .app-footer {
        padding: 8px 12px !important;
      }

      .footer-container {
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 5px !important;
        text-align: center !important;
      }

      .footer-left {
        align-items: center !important;
        text-align: center !important;

        .brand-line {
          justify-content: center !important;
          font-size: 0.74rem !important;
          flex-wrap: wrap !important;
          gap: 4px !important;

          .footer-brand-icon {
            font-size: 14px !important;
            width: 14px !important;
            height: 14px !important;
          }
        }

        .tagline {
          display: none !important;
        }
      }

      .footer-center {
        display: none !important;
      }

      .footer-right {
        width: 100% !important;
        justify-content: center !important;
        align-items: center !important;
        gap: 8px !important;

        .status-indicator {
          padding: 2px 8px !important;
          font-size: 0.7rem !important;
        }

        .version-badge {
          padding: 2px 7px !important;
          font-size: 0.68rem !important;
        }
      }

      .footer-expand-tab {
        right: 12px;
        padding: 2px 8px 3px 6px;
        font-size: 0.68rem;

        .expand-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
        }
      }
    }

    @media print {
      :host,
      .app-footer,
      .footer-expand-tab {
        display: none !important;
      }
    }
  `]
})
export class FooterComponent {
  private authService = inject(AuthService);

  readonly currentYear: number = new Date().getFullYear();
  readonly appVersion: string = 'v1.0.0 PRO';

  isCollapsed: boolean = false;

  constructor() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        this.isCollapsed = localStorage.getItem('imserp_footer_collapsed') === 'true';
      }
    } catch {
      this.isCollapsed = false;
    }
  }

  get instituteName(): string {
    return this.authService.getInstituteName();
  }

  toggleFooter(): void {
    this.isCollapsed = !this.isCollapsed;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('imserp_footer_collapsed', String(this.isCollapsed));
      }
    } catch {
      // safe fallback if storage blocked
    }
  }
}
