import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../core/services/auth.service';
import { RegisterTrialDialogComponent } from './register-trial-dialog.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="login-wrapper">
      <!-- Backdrop Overlay Layers -->
      <div class="campus-bg-overlay"></div>
      <div class="ambient-glow-left"></div>
      <div class="ambient-glow-right"></div>

      <!-- Interactive Live Campus Clock Tower Overlay (Synchronized to Indian Standard Time) -->
      <svg
        class="campus-clock-tower-svg"
        viewBox="0 0 1376 768"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Live Campus Clock Tower">
        <defs>
          <!-- Red Neon LED Glow Filter for Digital Clock -->
          <filter id="tower-led-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="0.7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <!-- Analog Clock Dial Gradient & Shadow -->
          <radialGradient id="dial-face-gradient" cx="45%" cy="38%" r="60%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="80%" stop-color="#f8fafc" />
            <stop offset="100%" stop-color="#cbd5e1" />
          </radialGradient>

          <!-- Subtle Bezel Gradient -->
          <linearGradient id="bezel-metal-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#475569" />
            <stop offset="50%" stop-color="#1e293b" />
            <stop offset="100%" stop-color="#0f172a" />
          </linearGradient>
        </defs>

        <g class="tower-clock-cluster">
          <title>Campus Tower Clock • Live Indian Standard Time (IST): {{ liveTimeFullTooltip }}</title>

          <!-- ─── 1. GRAND ANALOG ROUND CLOCK (Full Space Coverage: Center 688.5, 216.5 | Outer Radius: 23.0) ─── -->
          <!-- Outer Bezel Ring (Completely fills the full recessed tower wall space) -->
          <circle cx="688.5" cy="216.5" r="23.0" fill="url(#bezel-metal-gradient)" stroke="#090d16" stroke-width="1.2" />
          <!-- Dial Face -->
          <circle cx="688.5" cy="216.5" r="21.6" fill="url(#dial-face-gradient)" stroke="#64748b" stroke-width="0.6" />
          <!-- Minute Track Ring -->
          <circle cx="688.5" cy="216.5" r="19.5" fill="none" stroke="#94a3b8" stroke-width="0.45" stroke-dasharray="0.6 2.0" />

          <!-- Hour Markers (Cardinal 12, 3, 6, 9) -->
          <line x1="688.5" y1="197" x2="688.5" y2="201.2" stroke="#0f172a" stroke-width="1.7" stroke-linecap="round" />
          <line x1="708" y1="216.5" x2="703.8" y2="216.5" stroke="#0f172a" stroke-width="1.7" stroke-linecap="round" />
          <line x1="688.5" y1="236" x2="688.5" y2="231.8" stroke="#0f172a" stroke-width="1.7" stroke-linecap="round" />
          <line x1="669" y1="216.5" x2="673.2" y2="216.5" stroke="#0f172a" stroke-width="1.7" stroke-linecap="round" />

          <!-- Minor Hour Markers (1, 2, 4, 5, 7, 8, 10, 11) -->
          <line x1="698.25" y1="199.6" x2="696.75" y2="202.2" stroke="#64748b" stroke-width="0.9" stroke-linecap="round" />
          <line x1="705.4" y1="206.75" x2="702.8" y2="208.25" stroke="#64748b" stroke-width="0.9" stroke-linecap="round" />
          <line x1="705.4" y1="226.25" x2="702.8" y2="224.75" stroke="#64748b" stroke-width="0.9" stroke-linecap="round" />
          <line x1="698.25" y1="233.4" x2="696.75" y2="230.8" stroke="#64748b" stroke-width="0.9" stroke-linecap="round" />
          <line x1="678.75" y1="233.4" x2="680.25" y2="230.8" stroke="#64748b" stroke-width="0.9" stroke-linecap="round" />
          <line x1="671.6" y1="226.25" x2="674.2" y2="224.75" stroke="#64748b" stroke-width="0.9" stroke-linecap="round" />
          <line x1="671.6" y1="206.75" x2="674.2" y2="208.25" stroke="#64748b" stroke-width="0.9" stroke-linecap="round" />
          <line x1="678.75" y1="199.6" x2="680.25" y2="202.2" stroke="#64748b" stroke-width="0.9" stroke-linecap="round" />

          <!-- Hour Hand -->
          <line
            x1="688.5" y1="216.5"
            x2="688.5" y2="204.5"
            stroke="#0f172a"
            stroke-width="2.2"
            stroke-linecap="round"
            [attr.transform]="'rotate(' + hourAngle + ' 688.5 216.5)'" />

          <!-- Minute Hand -->
          <line
            x1="688.5" y1="216.5"
            x2="688.5" y2="199"
            stroke="#1e293b"
            stroke-width="1.5"
            stroke-linecap="round"
            [attr.transform]="'rotate(' + minuteAngle + ' 688.5 216.5)'" />

          <!-- Second Hand (Vibrant Red with Extended Tail) -->
          <line
            x1="688.5" y1="221"
            x2="688.5" y2="198"
            stroke="#ef4444"
            stroke-width="0.85"
            stroke-linecap="round"
            [attr.transform]="'rotate(' + secondAngle + ' 688.5 216.5)'" />

          <!-- Center Pivot Pin -->
          <circle cx="688.5" cy="216.5" r="1.8" fill="#f59e0b" stroke="#78350f" stroke-width="0.5" />

          <!-- Glass Reflection Highlight -->
          <path
            d="M 672 208 A 18 18 0 0 1 705 208 A 17 6.5 0 0 0 672 208 Z"
            fill="rgba(255, 255, 255, 0.28)"
            pointer-events="none" />

          <!-- ─── 2. DIGITAL LED CLOCK (Center: 686.5, 256 | UNTOUCHED) ─── -->
          <!-- Outer Black Metal Box (Spans entire alcove seamlessly from left 668.5) -->
          <rect x="668.5" y="248.5" width="36" height="15" rx="2" fill="#090d16" stroke="#1e293b" stroke-width="0.8" />
          <!-- Inner Recessed LED Display Screen -->
          <rect x="669.5" y="249.5" width="34" height="13" rx="1.2" fill="#020408" />

          <!-- Ghost Inactive 7-Segment Digits (88:88) for authentic LCD/LED realism -->
          <text
            x="686.5"
            y="259.2"
            text-anchor="middle"
            fill="rgba(239, 68, 68, 0.12)"
            font-size="8.2"
            font-family="'Consolas', 'Courier New', monospace"
            font-weight="900"
            letter-spacing="0.6">88:88</text>

          <!-- Glowing Active Red LED Digits with Blinking Colon -->
          <text
            x="686.5"
            y="259.2"
            text-anchor="middle"
            fill="#ff2b2b"
            filter="url(#tower-led-glow)"
            font-size="8.2"
            font-family="'Consolas', 'Courier New', monospace"
            font-weight="900"
            letter-spacing="0.6">{{ digitalHours }}<tspan [attr.fill]="isSecondTickEven ? '#ff2b2b' : 'rgba(255,43,43,0.18)'">:</tspan>{{ digitalMinutes }}</text>

          <!-- Subtle Top Border Highlight on Digital Display -->
          <line x1="670" y1="250" x2="703" y2="250" stroke="rgba(255,255,255,0.08)" stroke-width="0.5" />
        </g>
      </svg>

      <div class="login-split-container" [class.drawer-collapsed]="!isDrawerOpen">
        <!-- LEFT SIDE: Enterprise ERP Feature Showcase -->
        <div class="hero-showcase">
          <div class="hero-top-badge">
            <span class="pulse-dot"></span>
            <mat-icon class="badge-sparkle">auto_awesome</mat-icon>
            <span>INDIA'S NEXT-GEN AI, BIOMETRIC &amp; RFID EDUCATION CLOUD</span>
          </div>

          <h1 class="hero-main-title">
            Complete Digital Ecosystem for
            <span class="hero-gradient-text">Schools, Coaching &amp; Campuses</span>
          </h1>

          <p class="hero-subtitle">
            One unified multi-tenant command center to automate Admissions, Biometric &amp; RFID Attendance, Fee Ledgers, HRMS Payroll, Inventory &amp; Parent Communication across all branches.
          </p>

          @if (!isDrawerOpen) {
            <div class="hero-cta-wrap">
              <button type="button" class="hero-open-drawer-cta" (click)="openDrawer()">
                <mat-icon>login</mat-icon>
                <span>Sign In to Institute Portal</span>
                <mat-icon class="cta-arrow">arrow_forward</mat-icon>
              </button>
            </div>
          }

          <!-- Point-Wise Feature Highlights Grid -->
          <div class="feature-points-grid">
            <!-- 1. Student Fee Ledger & FIFO -->
            <div class="feature-point-card">
              <div class="fp-icon-box emerald-glow">
                <mat-icon>account_balance_wallet</mat-icon>
              </div>
              <div class="fp-content">
                <div class="fp-title-row">
                  <span class="fp-title">Student Fee Ledger &amp; Advance Wallet</span>
                  <span class="fp-check">✓</span>
                </div>
                <p class="fp-desc">12-Month Passbook, FIFO Auto-Settlement, Dynamic UPI QR &amp; Auto WhatsApp Receipts.</p>
              </div>
            </div>

            <!-- 2. Biometric, RFID & CW/HW Diary -->
            <div class="feature-point-card highlight-card">
              <div class="fp-icon-box sky-glow">
                <mat-icon>fingerprint</mat-icon>
              </div>
              <div class="fp-content">
                <div class="fp-title-row">
                  <span class="fp-title">Biometric, RFID &amp; Daily CW/HW Diary</span>
                  <span class="fp-hw-tag">LIVE SYNC</span>
                </div>
                <p class="fp-desc">Biometric Thumb, RFID Smart Attendance, Daily CW/HW Diary &amp; WhatsApp Alerts.</p>
              </div>
            </div>

            <!-- 3. AI WhatsApp Voice & Fee Recovery -->
            <div class="feature-point-card">
              <div class="fp-icon-box violet-glow">
                <mat-icon>record_voice_over</mat-icon>
              </div>
              <div class="fp-content">
                <div class="fp-title-row">
                  <span class="fp-title">AI WhatsApp Voice &amp; Fee Recovery</span>
                  <span class="fp-voice-tag">AI VOICE + WA</span>
                </div>
                <p class="fp-desc">Automated WhatsApp AI Voice Notes, Normal Text Messages, Defaulter Recovery &amp; Day Book.</p>
              </div>
            </div>

            <!-- 4. HRMS & Faculty Payroll -->
            <div class="feature-point-card">
              <div class="fp-icon-box amber-glow">
                <mat-icon>badge</mat-icon>
              </div>
              <div class="fp-content">
                <div class="fp-title-row">
                  <span class="fp-title">HRMS, Biometric Payroll &amp; Lecture Ledger</span>
                  <span class="fp-check">✓</span>
                </div>
                <p class="fp-desc">Biometric Staff Punch, Leave Approvals, Automated Salary Slips &amp; Full-and-Final Settlement.</p>
              </div>
            </div>

            <!-- 5. Inventory & Student Kit Store -->
            <div class="feature-point-card">
              <div class="fp-icon-box rose-glow">
                <mat-icon>inventory_2</mat-icon>
              </div>
              <div class="fp-content">
                <div class="fp-title-row">
                  <span class="fp-title">Inventory, Store &amp; Student Kit Billing</span>
                  <span class="fp-check">✓</span>
                </div>
                <p class="fp-desc">Books, Uniforms &amp; Dress Stock Inward/Outward with Student Advance Fee Adjustment.</p>
              </div>
            </div>

            <!-- 6. 360 Campus Operations -->
            <div class="feature-point-card">
              <div class="fp-icon-box cyan-glow">
                <mat-icon>school</mat-icon>
              </div>
              <div class="fp-content">
                <div class="fp-title-row">
                  <span class="fp-title">Exams, Library, Hostel &amp; GPS Transport</span>
                  <span class="fp-check">✓</span>
                </div>
                <p class="fp-desc">Admit Cards, Board Report Cards, Barcode Library, Hostel Beds &amp; RFID/GPS Bus Tracking.</p>
              </div>
            </div>
          </div>

          <!-- Bottom Trust Metrics Bar -->
          <div class="hero-trust-strip">
            <div class="trust-pill">
              <mat-icon>fingerprint</mat-icon>
              <span>Biometric &amp; RFID Hardware Ready</span>
            </div>
            <div class="trust-pill">
              <mat-icon>domain</mat-icon>
              <span>Multi-Branch Consolidated</span>
            </div>
            <div class="trust-pill">
              <mat-icon>hub</mat-icon>
              <span>School + Coaching Hybrid</span>
            </div>
            <div class="trust-pill">
              <mat-icon>verified_user</mat-icon>
              <span>256-Bit Bank-Grade Cloud</span>
            </div>
          </div>
        </div>

        <!-- RIGHT SIDE: Bold Executive Login Command Card / Slide Drawer -->
        <div class="login-panel-right" [class.drawer-open]="isDrawerOpen" [class.drawer-closed]="!isDrawerOpen">
          <div class="login-card">
            <!-- Left Edge Pull / Collapse Tab -->
            <button
              type="button"
              class="card-edge-tab"
              (click)="closeDrawer()"
              title="Minimize to View Full Campus">
              <mat-icon>chevron_right</mat-icon>
            </button>

            <!-- Signature Light-Blue Gradient Header (Strict ERP Standard) -->
            <div class="login-exec-header">
              <div class="exec-top-row">
                <div class="exec-brand-left">
                  <div class="brand-crest-shield" title="Secure Portal Login">
                    <mat-icon class="brand-icon">admin_panel_settings</mat-icon>
                  </div>
                  <div class="exec-title-block">
                    <h2 class="brand-title">ERP Vertical SaaS</h2>
                    <p class="brand-sub">All-in-One Education Command Center</p>
                  </div>
                </div>
                <div class="exec-badges-right">
                  <div class="badges-dock-row">
                    <span class="tenant-pill">MULTI-TENANT</span>
                    <button
                      type="button"
                      class="card-dock-collapse-btn"
                      (click)="closeDrawer()"
                      title="Minimize to View Full Campus">
                      <mat-icon>chevron_right</mat-icon>
                    </button>
                  </div>
                  <span class="cloud-pill">ENTERPRISE SAAS</span>
                </div>
              </div>

              <div class="module-tags-row">
                <span class="module-chip"><mat-icon>school</mat-icon> School</span>
                <span class="module-chip"><mat-icon>menu_book</mat-icon> Coaching</span>
                <span class="module-chip highlight"><mat-icon>fingerprint</mat-icon> Biometric/RFID</span>
                <span class="module-chip"><mat-icon>hotel</mat-icon> Hostel</span>
                <span class="module-chip"><mat-icon>local_library</mat-icon> Library</span>
                <span class="module-chip"><mat-icon>directions_bus</mat-icon> Transport</span>
              </div>
            </div>

            <!-- Form Body -->
            <div class="form-content">
              <div class="portal-divider-bar">
                <span class="p-line"></span>
                <span class="p-badge">
                  <mat-icon>lock</mat-icon>
                  AUTHORIZED PORTAL LOGIN
                </span>
                <span class="p-line"></span>
              </div>

              <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
                <!-- Company / Tenant Code -->
                <mat-form-field appearance="outline" class="full-width macho-field" subscriptSizing="dynamic">
                  <mat-label>Institute / Company Code</mat-label>
                  <input matInput formControlName="tenantCode" placeholder="e.g. JNANDEEP, APEX, ZENITH" (input)="onTenantCodeInput($event)">
                  <mat-icon matSuffix class="field-suffix-icon">corporate_fare</mat-icon>
                  @if (loginForm.get('tenantCode')?.hasError('required')) {
                    <mat-error>Company Code is required</mat-error>
                  }
                </mat-form-field>

                <!-- Username -->
                <mat-form-field appearance="outline" class="full-width macho-field" subscriptSizing="dynamic">
                  <mat-label>Username / Login ID</mat-label>
                  <input matInput formControlName="username" placeholder="e.g. admin, principal, accountant">
                  <mat-icon matSuffix class="field-suffix-icon">person</mat-icon>
                  @if (loginForm.get('username')?.hasError('required')) {
                    <mat-error>Username is required</mat-error>
                  }
                </mat-form-field>

                <!-- Password -->
                <mat-form-field appearance="outline" class="full-width macho-field" subscriptSizing="dynamic">
                  <mat-label>Security Password</mat-label>
                  <input matInput [type]="hidePassword ? 'password' : 'text'" formControlName="password">
                  <button matSuffix (click)="hidePassword = !hidePassword" type="button" mat-icon-button>
                    <mat-icon class="field-suffix-icon">{{hidePassword ? 'visibility_off' : 'visibility'}}</mat-icon>
                  </button>
                  @if (loginForm.get('password')?.hasError('required')) {
                    <mat-error>Password is required</mat-error>
                  }
                </mat-form-field>

                <!-- Session Notice or Error Banner -->
                @if (sessionNotice) {
                  <div class="info-banner">
                    <mat-icon>schedule</mat-icon>
                    <span>{{ sessionNotice }}</span>
                  </div>
                }

                @if (errorMessage) {
                  <div class="error-banner">
                    <mat-icon color="warn">error</mat-icon>
                    <span>{{ errorMessage }}</span>
                  </div>
                }

                <!-- High-Impact Macho Sign-In Button -->
                <button id="app-filled-btn" class="full-width macho-submit-btn" type="submit" [disabled]="loginForm.invalid || loading">
                  <mat-icon class="btn-lock-icon">login</mat-icon>
                  <span>SIGN IN TO INSTITUTE</span>
                  <mat-icon class="btn-arrow">arrow_forward</mat-icon>
                </button>

                <!-- Action Divider -->
                <div class="or-divider">
                  <span class="line"></span>
                  <span class="text">or explore live platform</span>
                  <span class="line"></span>
                </div>

                <!-- Demo and Registration Actions -->
                <div class="demo-actions-row">
                  <button id="app-filled-btn" type="button" class="create-tenant-btn" (click)="openRegisterTrialDialog()">
                    <mat-icon>rocket_launch</mat-icon>
                    <span>14-Day Free Trial</span>
                  </button>

                  <button id="app-filled-btn" type="button" class="quick-demo-btn" (click)="fillDemoCredentials()">
                    <mat-icon>bolt</mat-icon>
                    <span>1-Click Live Demo</span>
                  </button>
                </div>

                <!-- Enterprise Trust Footer -->
                <div class="security-footer">
                  <mat-icon class="sec-icon">verified_user</mat-icon>
                  <span>256-Bit SSL Encrypted • ISO-Grade Cloud Infrastructure</span>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <!-- Floating Dock Tab when Drawer is Minimized -->
      <button
        type="button"
        class="floating-portal-dock"
        [class.dock-visible]="!isDrawerOpen"
        (click)="openDrawer()"
        title="Open Portal Login">
        <div class="dock-pulse-ring"></div>
        <div class="dock-icon-box">
          <mat-icon>admin_panel_settings</mat-icon>
        </div>
        <div class="dock-content">
          <span class="dock-tag">SECURE ACCESS</span>
          <span class="dock-title">PORTAL LOGIN</span>
        </div>
        <mat-icon class="dock-arrow-icon">arrow_back</mat-icon>
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host {
      display: block;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100vw;
      height: 100vh;
      height: 100dvh;
      overflow: hidden;
      overscroll-behavior: none;
      -webkit-overflow-scrolling: touch;
      touch-action: pan-y;
      z-index: 1;
    }

    .login-wrapper {
      width: 100%;
      height: 100%;
      min-height: 100%;
      max-height: 100%;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #0b1329;
      background-image: url('/assets/images/campus-login-bg.jpg?v=2');
      background-position: center center;
      background-size: cover;
      background-repeat: no-repeat;
      overflow: hidden;
      overscroll-behavior: none;
      -webkit-overflow-scrolling: touch;
      padding: 20px 36px 16px;
      box-sizing: border-box;
    }

    .campus-bg-overlay {
      position: fixed;
      inset: 0;
      background:
        linear-gradient(102deg, rgba(6, 12, 30, 0.85) 0%, rgba(10, 20, 48, 0.62) 36%, rgba(15, 23, 42, 0.12) 65%, rgba(10, 18, 40, 0.35) 100%),
        radial-gradient(circle at 18% 22%, rgba(37, 99, 235, 0.14) 0%, transparent 52%);
      pointer-events: none;
      z-index: 1;
    }

    .ambient-glow-left {
      position: fixed;
      width: 480px;
      height: 480px;
      background: radial-gradient(circle, rgba(56, 189, 248, 0.14) 0%, rgba(37, 99, 235, 0.05) 50%, transparent 70%);
      top: 10%;
      left: 5%;
      pointer-events: none;
      filter: blur(50px);
      z-index: 2;
    }

    .campus-clock-tower-svg {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 2;

      .tower-clock-cluster {
        cursor: pointer;
        pointer-events: auto;
        transition: filter 0.25s ease;

        &:hover {
          filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.5));
        }
      }
    }

    .ambient-glow-right {
      position: fixed;
      width: 480px;
      height: 480px;
      background: radial-gradient(circle, rgba(37, 99, 235, 0.25) 0%, rgba(245, 158, 11, 0.12) 55%, transparent 75%);
      top: 50%;
      right: 5%;
      transform: translateY(-50%);
      pointer-events: none;
      filter: blur(50px);
      z-index: 2;
    }

    .login-split-container {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 1440px;
      display: grid;
      grid-template-columns: minmax(0, 420px) 420px;
      justify-content: space-between;
      gap: 30px;
      align-items: center;
      margin: 0 auto;
      transition: all 0.48s cubic-bezier(0.16, 1, 0.3, 1);

      &.drawer-collapsed {
        grid-template-columns: minmax(0, 420px) 0px;
        gap: 0;
      }
    }

    /* ─── LEFT HERO SHOWCASE (SINGLE SLIM COLUMN ON FAR LEFT) ──────────────── */
    .hero-showcase {
      display: flex;
      flex-direction: column;
      gap: 11px;
      color: #ffffff;
      padding-right: 0;
      min-width: 0;
      width: 100%;
      max-width: 420px;
      box-sizing: border-box;
      transition: all 0.4s ease;
    }

    .hero-cta-wrap {
      margin-top: 2px;
      animation: ctaFadeIn 0.35s ease;
    }

    .hero-open-drawer-cta {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff;
      border: 1px solid rgba(147, 197, 253, 0.6);
      border-radius: 10px;
      padding: 9px 20px;
      font-size: 0.84rem;
      font-weight: 800;
      letter-spacing: 0.02em;
      cursor: pointer;
      box-shadow: 0 6px 20px rgba(37, 99, 235, 0.45);
      transition: all 0.22s ease;
      width: fit-content;

      &:hover {
        background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
        transform: translateY(-2px);
        box-shadow: 0 10px 26px rgba(37, 99, 235, 0.6);

        .cta-arrow {
          transform: translateX(4px);
        }
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      .cta-arrow {
        transition: transform 0.2s ease;
      }
    }

    @keyframes ctaFadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .hero-top-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      align-self: flex-start;
      max-width: 100%;
      box-sizing: border-box;
      background: rgba(37, 99, 235, 0.35);
      border: 1px solid rgba(96, 165, 250, 0.55);
      backdrop-filter: blur(10px);
      padding: 4px 11px;
      border-radius: 999px;
      font-size: 0.64rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      color: #e0f2fe;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);

      .pulse-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #4ade80;
        box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.3);
        flex-shrink: 0;
      }

      .badge-sparkle {
        font-size: 14px;
        width: 14px;
        height: 14px;
        color: #fbbf24;
        flex-shrink: 0;
      }
    }

    .hero-main-title {
      font-size: 1.42rem;
      font-weight: 800;
      line-height: 1.22;
      letter-spacing: -0.02em;
      margin: 0;
      color: #ffffff;
      text-shadow: 0 2px 14px rgba(0, 0, 0, 0.55);

      .hero-gradient-text {
        display: block;
        background: linear-gradient(90deg, #60a5fa 0%, #38bdf8 45%, #fbbf24 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
    }

    .hero-subtitle {
      font-size: 0.75rem;
      line-height: 1.38;
      color: #cbd5e1;
      margin: 0;
      font-weight: 500;
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
    }

    /* Point-Wise Feature Cards Grid (Single Column Left Stack with comfortable gap) */
    .feature-points-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 9px;
      margin-top: 3px;
      width: 100%;
    }

    .feature-point-card {
      display: flex;
      align-items: center;
      gap: 11px;
      padding: 8px 12px;
      border-radius: 11px;
      background: rgba(15, 23, 42, 0.74);
      border: 1px solid rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-shadow: 0 4px 16px -4px rgba(0, 0, 0, 0.45);
      transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;

      &.highlight-card {
        border-color: rgba(56, 189, 248, 0.45);
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.84) 0%, rgba(12, 74, 110, 0.58) 100%);
      }

      &:hover {
        transform: translateX(3px);
        background: rgba(15, 23, 42, 0.90);
        border-color: rgba(96, 165, 250, 0.6);
      }

      .fp-icon-box {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        color: #ffffff;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }

        &.emerald-glow {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35);
        }
        &.sky-glow {
          background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
          box-shadow: 0 2px 8px rgba(14, 165, 233, 0.45);
        }
        &.violet-glow {
          background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
          box-shadow: 0 2px 8px rgba(139, 92, 246, 0.35);
        }
        &.amber-glow {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          box-shadow: 0 2px 8px rgba(245, 158, 11, 0.35);
        }
        &.rose-glow {
          background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
          box-shadow: 0 2px 8px rgba(244, 63, 94, 0.35);
        }
        &.cyan-glow {
          background: linear-gradient(135deg, #06b6d4 0%, #0284c7 100%);
          box-shadow: 0 2px 8px rgba(6, 182, 212, 0.35);
        }
      }

      .fp-content {
        flex: 1;
        min-width: 0;

        .fp-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          margin-bottom: 2px;
        }

        .fp-title {
          font-size: 0.79rem;
          font-weight: 700;
          color: #f8fafc;
          letter-spacing: -0.01em;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .fp-check {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 15px;
          height: 15px;
          border-radius: 50%;
          background: rgba(74, 222, 128, 0.2);
          color: #4ade80;
          font-size: 0.62rem;
          font-weight: 800;
          flex-shrink: 0;
        }

        .fp-hw-tag {
          display: inline-flex;
          align-items: center;
          padding: 1px 5px;
          border-radius: 999px;
          background: rgba(56, 189, 248, 0.22);
          border: 1px solid rgba(56, 189, 248, 0.5);
          color: #7dd3fc;
          font-size: 0.56rem;
          font-weight: 800;
          letter-spacing: 0.04em;
          flex-shrink: 0;
        }

        .fp-voice-tag {
          display: inline-flex;
          align-items: center;
          padding: 1px 5px;
          border-radius: 999px;
          background: rgba(168, 85, 247, 0.22);
          border: 1px solid rgba(168, 85, 247, 0.5);
          color: #d8b4fe;
          font-size: 0.56rem;
          font-weight: 800;
          letter-spacing: 0.04em;
          flex-shrink: 0;
        }

        .fp-desc {
          margin: 0;
          font-size: 0.69rem;
          line-height: 1.26;
          color: #94a3b8;
          font-weight: 400;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }
    }

    /* Bottom Trust Strip (2x2 Grid under the left column) */
    .hero-trust-strip {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-top: 6px;
      width: 100%;

      .trust-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 5px 10px;
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.72);
        border: 1px solid rgba(255, 255, 255, 0.16);
        backdrop-filter: blur(8px);
        font-size: 0.66rem;
        font-weight: 600;
        color: #e2e8f0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;

        mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
          color: #38bdf8;
          flex-shrink: 0;
        }
      }
    }

    /* ─── RIGHT LOGIN CARD PANEL (ANIMATED SLIDE DRAWER EDITION) ─────────── */
    .login-panel-right {
      display: flex;
      justify-content: flex-end;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      transition: transform 0.48s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.38s ease;

      &.drawer-open {
        transform: translateX(0);
        opacity: 1;
        pointer-events: auto;
        animation: drawerSlideIn 0.55s cubic-bezier(0.16, 1, 0.3, 1);
      }

      &.drawer-closed {
        transform: translateX(calc(100% + 80px)) !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    }

    @keyframes drawerSlideIn {
      0% {
        transform: translateX(110%);
        opacity: 0;
      }
      100% {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .login-card {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 420px;
      min-width: 0;
      box-sizing: border-box;
      border-radius: 20px;
      box-shadow:
        0 24px 50px -10px rgba(2, 6, 23, 0.75),
        0 0 0 1px rgba(255, 255, 255, 0.28),
        0 0 30px rgba(37, 99, 235, 0.20) !important;
      background: #ffffff;
      overflow: visible;
      display: flex;
      flex-direction: column;
    }

    .card-edge-tab {
      position: absolute;
      left: -22px;
      top: 50%;
      transform: translateY(-50%);
      width: 24px;
      height: 50px;
      border-radius: 8px 0 0 8px;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      border: 1px solid #1e40af;
      border-right: none;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: -4px 6px 14px rgba(37, 99, 235, 0.35);
      z-index: 25;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      outline: none;

      mat-icon {
        font-size: 17px;
        width: 17px;
        height: 17px;
        color: #ffffff !important;
        font-weight: 700;
      }

      &:hover {
        background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
        left: -26px;
        width: 28px;
        box-shadow: -6px 8px 18px rgba(37, 99, 235, 0.45);
      }
    }

    /* Signature Light-Blue Gradient Header Banner (Strict ERP Standard) */
    .login-exec-header {
      position: relative;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      padding: 12px 18px 10px;
      border-bottom: 1px solid #bfdbfe;
      border-radius: 20px 20px 0 0;
      overflow: hidden;

      .exec-top-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .exec-brand-left {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .brand-crest-shield {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 8px rgba(37, 99, 235, 0.25);
        flex-shrink: 0;

        .brand-icon {
          font-size: 22px;
          width: 22px;
          height: 22px;
          color: #ffffff;
        }
      }

      .exec-title-block {
        display: flex;
        flex-direction: column;
        min-width: 0;

        .brand-title {
          font-size: 1.10rem;
          font-weight: 800;
          color: #1e3a8a;
          letter-spacing: -0.02em;
          margin: 0;
          line-height: 1.15;
        }

        .brand-sub {
          font-size: 0.70rem;
          color: #3b82f6;
          font-weight: 600;
          margin: 1px 0 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      .exec-badges-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 3px;
        flex-shrink: 0;

        .badges-dock-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .card-dock-collapse-btn {
          width: 26px;
          height: 24px;
          border-radius: 6px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border: 1px solid #1e40af;
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          outline: none;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.35);
          transition: all 0.18s ease;

          mat-icon {
            font-size: 17px;
            width: 17px;
            height: 17px;
            color: #ffffff !important;
            font-weight: 700;
          }

          &:hover {
            background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
            border-color: #172554;
            transform: scale(1.1);
            box-shadow: 0 4px 10px rgba(37, 99, 235, 0.5);
          }
        }

        .tenant-pill {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          font-size: 0.58rem;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .cloud-pill {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
          font-size: 0.58rem;
          font-weight: 800;
          padding: 1.5px 6px;
          border-radius: 4px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
      }

      .module-tags-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 8px;
        padding-top: 7px;
        border-top: 1px solid rgba(191, 219, 254, 0.7);

        .module-chip {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 0.62rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #334155;
          letter-spacing: 0.01em;
          white-space: nowrap;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);

          mat-icon {
            font-size: 11px;
            width: 11px;
            height: 11px;
            color: #2563eb;
          }

          &.highlight {
            background: #ecfdf5;
            border-color: #a7f3d0;
            color: #047857;

            mat-icon {
              color: #059669;
            }
          }
        }
      }
    }

    /* Form Section */
    .form-content {
      padding: 10px 18px 12px;
      background: linear-gradient(180deg, #f8fafc 0%, #ffffff 35%);
      border-radius: 0 0 20px 20px;
      overflow: hidden;
    }

    .portal-divider-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;

      .p-line {
        flex: 1;
        height: 1px;
        background: linear-gradient(90deg, transparent, #cbd5e1, transparent);
      }

      .p-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.62rem;
        font-weight: 800;
        color: #1e3a8a;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        padding: 1.5px 8px;
        border-radius: 999px;
        letter-spacing: 0.05em;

        mat-icon {
          font-size: 12px;
          width: 12px;
          height: 12px;
          color: #2563eb;
        }
      }
    }

    .full-width {
      width: 100%;
    }

    .macho-field {
      margin-bottom: 5px;

      ::ng-deep {
        .mat-mdc-form-field-subscript-wrapper {
          font-size: 0.68rem;
          padding: 0 4px;
        }
        .mat-mdc-text-field-wrapper {
          padding-top: 0 !important;
          padding-bottom: 0 !important;
        }
        .mat-mdc-form-field-infix {
          min-height: 40px !important;
          padding-top: 7px !important;
          padding-bottom: 7px !important;
        }
        .mat-mdc-input-element {
          font-size: 0.86rem;
          font-weight: 600;
          color: #0f172a;
        }
        .mat-mdc-form-field-label {
          font-size: 0.82rem;
        }
        .mat-mdc-form-field-icon-suffix {
          align-self: center;
          display: inline-flex;
          align-items: center;
        }
      }
    }

    .field-suffix-icon {
      color: #1e40af;
      font-size: 18px !important;
      width: 18px !important;
      height: 18px !important;
    }

    /* High-Impact Macho Sign-In Button */
    .macho-submit-btn {
      width: 100%;
      height: 38px;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 45%, #2563eb 100%) !important;
      color: #ffffff !important;
      font-size: 0.82rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      border-radius: 9px;
      border: 1px solid rgba(96, 165, 250, 0.4) !important;
      margin-top: 4px;
      cursor: pointer;
      box-shadow: 0 8px 18px -4px rgba(30, 58, 138, 0.50);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;

      &:hover:not([disabled]) {
        background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #0284c7 100%) !important;
        box-shadow: 0 10px 22px -4px rgba(37, 99, 235, 0.60);
        transform: translateY(-1px);
      }

      &:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .btn-lock-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #38bdf8;
      }

      .btn-arrow {
        font-size: 16px;
        width: 16px;
        height: 16px;
        margin-left: 2px;
      }
    }

    .or-divider {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 6px 0 5px;
      .line {
        flex: 1;
        height: 1px;
        background: #e2e8f0;
      }
      .text {
        font-size: 0.62rem;
        color: #64748b;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
    }

    .demo-actions-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      width: 100%;
    }

    .create-tenant-btn {
      width: 100%;
      height: 32px;
      border: 1.5px solid #93c5fd !important;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important;
      color: #1e3a8a !important;
      font-weight: 800 !important;
      border-radius: 8px !important;
      font-size: 0.72rem !important;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: all 0.2s ease;
      white-space: nowrap;

      &:hover {
        background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%) !important;
        border-color: #60a5fa !important;
        transform: translateY(-1px);
        box-shadow: 0 4px 10px rgba(37, 99, 235, 0.16);
      }

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        color: #2563eb;
      }
    }

    .quick-demo-btn {
      width: 100%;
      height: 32px;
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%) !important;
      border: 1px solid #fcd34d !important;
      color: #92400e !important;
      font-size: 0.72rem;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      border-radius: 8px;
      transition: all 0.15s ease;
      white-space: nowrap;

      &:hover {
        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important;
        color: #78350f !important;
        transform: translateY(-1px);
      }

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        color: #d97706;
      }
    }

    .security-footer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      margin-top: 6px;
      padding-top: 5px;
      border-top: 1px dashed #e2e8f0;
      font-size: 0.65rem;
      color: #475569;
      font-weight: 600;
      .sec-icon {
        font-size: 13px;
        width: 13px;
        height: 13px;
        color: #10b981;
      }
    }

    .info-banner {
      display: flex;
      align-items: center;
      gap: 6px;
      background-color: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 500;
      margin: 2px 0 5px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; flex-shrink: 0; }
      span { flex: 1; line-height: 1.25; }
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 6px;
      background-color: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 500;
      margin: 2px 0 5px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; flex-shrink: 0; color: #dc2626 !important; }
      span { flex: 1; line-height: 1.25; }
    }

    /* ─── FLOATING PORTAL DOCK (When drawer is collapsed) ─────────────────── */
    .floating-portal-dock {
      position: fixed;
      right: 0;
      top: 50%;
      transform: translateY(-50%) translateX(110%);
      z-index: 999;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 10px 18px 10px 14px;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.94) 0%, rgba(30, 58, 138, 0.94) 100%);
      border: 1.5px solid rgba(96, 165, 250, 0.6);
      border-right: none;
      border-radius: 36px 0 0 36px;
      box-shadow: -8px 14px 36px rgba(2, 6, 23, 0.65), 0 0 30px rgba(37, 99, 235, 0.4);
      backdrop-filter: blur(14px);
      cursor: pointer;
      color: #ffffff;
      outline: none;
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
      pointer-events: none;
      opacity: 0;

      &.dock-visible {
        transform: translateY(-50%) translateX(0);
        pointer-events: auto;
        opacity: 1;
      }

      &:hover {
        padding-left: 20px;
        background: linear-gradient(135deg, rgba(30, 58, 138, 0.98) 0%, rgba(37, 99, 235, 0.98) 100%);
        border-color: #93c5fd;
        box-shadow: -10px 18px 42px rgba(2, 6, 23, 0.75), 0 0 40px rgba(59, 130, 246, 0.6);

        .dock-icon-box {
          transform: rotate(-10deg) scale(1.1);
          background: #ffffff;
          color: #1e40af;
        }

        .dock-arrow-icon {
          transform: translateX(-4px);
        }
      }

      .dock-pulse-ring {
        position: absolute;
        inset: -3px;
        border-radius: 38px 0 0 38px;
        border: 2px solid rgba(147, 197, 253, 0.5);
        animation: dockGlowPulse 2.4s cubic-bezier(0.24, 0, 0.38, 1) infinite;
        pointer-events: none;
      }

      .dock-icon-box {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
        transition: all 0.25s ease;

        mat-icon {
          font-size: 22px;
          width: 22px;
          height: 22px;
        }
      }

      .dock-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        line-height: 1.15;
      }

      .dock-tag {
        font-size: 0.58rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        color: #93c5fd;
        text-transform: uppercase;
      }

      .dock-title {
        font-size: 0.88rem;
        font-weight: 800;
        letter-spacing: 0.03em;
        color: #ffffff;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
      }

      .dock-arrow-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #60a5fa;
        margin-left: 2px;
        transition: transform 0.2s ease;
      }
    }

    @keyframes dockGlowPulse {
      0%, 100% {
        opacity: 0.3;
        transform: scale(1);
      }
      50% {
        opacity: 0.85;
        transform: scale(1.02);
      }
    }

    /* ─── RESPONSIVE BREAKPOINTS (Tablet & Mobile) ────────────────────────── */
    @media (max-width: 1080px) {
      .login-wrapper {
        align-items: flex-start;
        justify-content: center;
        padding: 18px 16px 32px;
        overflow-y: auto;
      }

      .login-split-container {
        grid-template-columns: minmax(0, 1fr);
        gap: 22px;
        width: 100%;
        max-width: 580px;
        box-sizing: border-box;
      }

      .login-panel-right {
        order: 1;
        justify-content: center;
        width: 100%;

        &.drawer-closed {
          display: none;
        }

        &.drawer-open {
          animation: none;
          transform: none;
        }
      }

      .card-edge-tab {
        display: none;
      }

      .floating-portal-dock {
        bottom: 24px;
        top: auto;
        right: 20px;
        border-radius: 30px;
        border-right: 1.5px solid rgba(96, 165, 250, 0.6);
        transform: translateY(140%);
        &.dock-visible {
          transform: translateY(0);
        }
      }

      .login-card {
        max-width: 100%;
      }

      .hero-showcase {
        order: 2;
        padding-right: 0;
        text-align: center;
        align-items: center;
        width: 100%;

        .hero-top-badge {
          align-self: center;
        }

        .feature-points-grid {
          width: 100%;
          text-align: left;
        }

        .hero-trust-strip {
          width: 100%;
          justify-content: center;
        }
      }
    }

    @media (max-width: 640px) {
      .login-wrapper {
        padding: 10px 12px 24px;
      }

      .login-split-container {
        gap: 18px;
        max-width: 100%;
      }

      .login-exec-header {
        padding: 12px 14px 10px;

        .exec-top-row {
          gap: 8px;
        }

        .exec-brand-left {
          gap: 10px;
        }

        .brand-crest-shield {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          .brand-icon {
            font-size: 22px;
            width: 22px;
            height: 22px;
          }
        }

        .exec-title-block {
          .brand-title {
            font-size: 1.1rem;
          }
          .brand-sub {
            font-size: 0.68rem;
          }
        }

        .exec-badges-right {
          gap: 3px;
          .tenant-pill, .cloud-pill {
            font-size: 0.55rem;
            padding: 1.5px 5px;
          }
        }

        .module-tags-row {
          margin-top: 8px;
          padding-top: 8px;
          gap: 3px;
          .module-chip {
            font-size: 0.58rem;
            padding: 2px 5px;
            mat-icon {
              font-size: 11px;
              width: 11px;
              height: 11px;
            }
          }
        }
      }

      .form-content {
        padding: 12px 14px 14px;
      }

      .portal-divider-bar {
        margin-bottom: 10px;
        .p-badge {
          font-size: 0.6rem;
          padding: 2px 8px;
        }
      }

      .hero-top-badge {
        font-size: 0.62rem;
        padding: 4px 10px;
        letter-spacing: 0.03em;
        gap: 5px;
      }

      .feature-points-grid {
        grid-template-columns: minmax(0, 1fr);
        gap: 8px;
      }

      .feature-point-card {
        padding: 10px 12px;
        gap: 10px;
        box-sizing: border-box;
      }

      .hero-trust-strip {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;

        .trust-pill {
          justify-content: center;
          font-size: 0.65rem;
          padding: 5px 6px;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      .hero-main-title {
        font-size: 1.28rem;
      }

      .hero-subtitle {
        font-size: 0.78rem;
      }

      .macho-submit-btn {
        height: 40px;
        font-size: 0.82rem;
      }

      .or-divider {
        margin: 6px 0;
      }

      .create-tenant-btn {
        height: 36px;
        font-size: 0.75rem !important;
      }

      .quick-demo-btn {
        height: 32px;
        font-size: 0.72rem;
      }

      .security-footer {
        margin-top: 8px;
        font-size: 0.63rem;
        text-align: center;
      }
    }
  `]
})
export class LoginComponent implements OnInit, OnDestroy {
  // ─── Live Campus Clock Tower Engine (IST Asia/Kolkata) ──────
  hourAngle = 0;
  minuteAngle = 0;
  secondAngle = 0;
  digitalHours = '12';
  digitalMinutes = '00';
  isSecondTickEven = true;
  liveTimeFullTooltip = '';
  private clockTimerId: any;

  private updateCampusClock(): void {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true
    });

    const parts = formatter.formatToParts(now);
    let hour12 = 12;
    let minute = 0;
    let second = 0;
    let dayPeriod = 'AM';

    for (const part of parts) {
      if (part.type === 'hour') hour12 = parseInt(part.value, 10) || 12;
      else if (part.type === 'minute') minute = parseInt(part.value, 10) || 0;
      else if (part.type === 'second') second = parseInt(part.value, 10) || 0;
      else if (part.type === 'dayPeriod') dayPeriod = part.value.toUpperCase();
    }

    // Mathematical rotation angles for analog clock hands
    this.secondAngle = Math.round(second * 6);
    this.minuteAngle = Number((minute * 6 + second * 0.1).toFixed(1));
    this.hourAngle = Number(((hour12 % 12) * 30 + minute * 0.5 + second * (0.5 / 60)).toFixed(1));

    // Digital LED clock formatted display
    this.digitalHours = hour12 < 10 ? '0' + hour12 : '' + hour12;
    this.digitalMinutes = minute < 10 ? '0' + minute : '' + minute;
    this.isSecondTickEven = second % 2 === 0;

    const secStr = second < 10 ? '0' + second : '' + second;
    this.liveTimeFullTooltip = `${this.digitalHours}:${this.digitalMinutes}:${secStr} ${dayPeriod} IST`;
  }

  private dialog = inject(MatDialog, { optional: true });
  loginForm: FormGroup;
  hidePassword = true;
  loading = false;
  errorMessage = '';
  sessionNotice = '';

  /** Sliding Drawer state: panel is open by default, animated from right */
  isDrawerOpen = true;

  toggleDrawer(): void {
    this.isDrawerOpen = !this.isDrawerOpen;
  }

  openDrawer(): void {
    this.isDrawerOpen = true;
  }

  closeDrawer(): void {
    this.isDrawerOpen = false;
  }

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
    this.updateCampusClock();
    this.clockTimerId = setInterval(() => {
      this.updateCampusClock();
    }, 1000);

    // Lock body and html scrolling on mobile while on login screen
    try {
      document.body.classList.add('login-page-active');
      document.documentElement.classList.add('login-page-active');
    } catch (_) {}

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
    } else if (reason === 'kicked_out') {
      this.sessionNotice = 'Your account was logged in from another browser or device. This session has been terminated.';
    }
  }

  ngOnDestroy(): void {
    if (this.clockTimerId) {
      clearInterval(this.clockTimerId);
      this.clockTimerId = null;
    }

    // Release mobile viewport lock upon leaving login screen
    try {
      document.body.classList.remove('login-page-active');
      document.documentElement.classList.remove('login-page-active');
    } catch (_) {}
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
        this.errorMessage = err?.error?.message || 'Authentication failed. Please check Company Code and credentials.';
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
