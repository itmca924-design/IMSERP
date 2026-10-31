import { Component, inject, ChangeDetectionStrategy } from '@angular/core';

import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterModule, MatIconModule, MatTooltipModule],
  template: `
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

        <!-- Right: Status Indicator & Version Badge -->
        <div class="footer-right">
          <div class="status-indicator" matTooltip="Cloud API &amp; Database live and healthy">
            <span class="pulse-dot"></span>
            <span class="status-text">System Live</span>
          </div>
          <div class="version-badge" matTooltip="School ERP Engine Version">
            {{ appVersion }}
          </div>
        </div>
      </div>
    </footer>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host {
      display: block;
      flex-shrink: 0;
      z-index: 10;
    }

    .app-footer {
      background-color: #ffffff;
      border-top: 1px solid #e2e8f0;
      box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.03);
      color: #64748b;
      font-size: 0.8rem;
      padding: 9px 24px;
      margin-top: auto;
      transition: all 0.2s ease-in-out;
    }

    .footer-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      max-width: 100%;
    }

    /* Left Section */
    .footer-left {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .brand-line {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #334155;
        font-weight: 500;

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
        font-size: 0.72rem;
        color: #94a3b8;
        padding-left: 22px;
      }
    }

    /* Center Links */
    .footer-center {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;

      .footer-link {
        color: #64748b;
        text-decoration: none;
        font-weight: 500;
        font-size: 0.8rem;
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

    /* Right Badges */
    .footer-right {
      display: flex;
      align-items: center;
      gap: 12px;

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
    }

    /* Responsive adjustments */
    @media (max-width: 960px) and (min-width: 641px) {
      .footer-container {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }

      .footer-left .tagline {
        padding-left: 0;
      }

      .footer-center {
        width: 100%;
        justify-content: flex-start;
      }

      .footer-right {
        width: 100%;
        justify-content: space-between;
      }
    }

    /* Mobile Compact (<= 640px) - Option 1 Standard */
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
        width: auto !important;
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
    }
  `]
})
export class FooterComponent {
  private authService = inject(AuthService);

  readonly currentYear: number = new Date().getFullYear();
  readonly appVersion: string = 'v1.0.0 PRO';

  get instituteName(): string {
    return this.authService.currentUser()?.instituteName || 'Apex Coaching Academy';
  }
}
