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

      <div class="login-split-container">
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
                <p class="fp-desc">12-Month Passbook, FIFO Auto-Settlement, Dynamic UPI QR &amp; 1-Click WhatsApp Receipts.</p>
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
                <p class="fp-desc">Biometric Thumb, RFID Smart Card &amp; QR Attendance, Daily CW/HW Diary &amp; Instant Parent WhatsApp Alerts.</p>
              </div>
            </div>

            <!-- 3. AI Recovery & Accounting -->
            <div class="feature-point-card">
              <div class="fp-icon-box violet-glow">
                <mat-icon>psychology</mat-icon>
              </div>
              <div class="fp-content">
                <div class="fp-title-row">
                  <span class="fp-title">AI Fee Recovery &amp; Financial Accounting</span>
                  <span class="fp-check">✓</span>
                </div>
                <p class="fp-desc">Predictive Defaulter Follow-ups, Live Day Book, Profit &amp; Loss &amp; Automated Balance Sheet.</p>
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

        <!-- RIGHT SIDE: Bold Executive Login Command Card -->
        <div class="login-panel-right">
          <div class="login-card">
            <!-- Top Metallic Gold-to-Electric-Blue Accent Bar -->
            <div class="card-accent-line"></div>

            <!-- Bold Executive Dark-Sapphire Hero Header -->
            <div class="login-exec-header">
              <div class="exec-header-glow"></div>
              <div class="exec-top-row">
                <div class="brand-crest-shield" title="Secure Portal Login">
                  <mat-icon class="brand-icon">admin_panel_settings</mat-icon>
                  <span class="shield-key-dot">
                    <mat-icon>vpn_key</mat-icon>
                  </span>
                </div>
                <div class="exec-title-block">
                  <div class="exec-badge-row">
                    <span class="tenant-pill">MULTI-TENANT</span>
                    <span class="cloud-pill">ENTERPRISE SAAS</span>
                  </div>
                  <h2 class="brand-title">ERP Vertical SaaS</h2>
                  <p class="brand-sub">All-in-One Education Command Center</p>
                </div>
              </div>

              <div class="module-tags-row">
                <span class="module-chip">School</span>
                <span class="module-chip">Coaching</span>
                <span class="module-chip highlight">Biometric/RFID</span>
                <span class="module-chip">Hostel</span>
                <span class="module-chip">Library</span>
                <span class="module-chip">Transport</span>
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
                <mat-form-field appearance="outline" class="full-width macho-field">
                  <mat-label>Institute / Company Code</mat-label>
                  <input matInput formControlName="tenantCode" placeholder="e.g. JNANDEEP, APEX, ZENITH" (input)="onTenantCodeInput($event)">
                  <mat-icon matSuffix class="field-suffix-icon">corporate_fare</mat-icon>
                  @if (loginForm.get('tenantCode')?.hasError('required')) {
                    <mat-error>Company Code is required</mat-error>
                  }
                </mat-form-field>

                <!-- Username -->
                <mat-form-field appearance="outline" class="full-width macho-field">
                  <mat-label>Username / Login ID</mat-label>
                  <input matInput formControlName="username" placeholder="e.g. admin, principal, accountant">
                  <mat-icon matSuffix class="field-suffix-icon">person</mat-icon>
                  @if (loginForm.get('username')?.hasError('required')) {
                    <mat-error>Username is required</mat-error>
                  }
                </mat-form-field>

                <!-- Password -->
                <mat-form-field appearance="outline" class="full-width macho-field">
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
                    <span>Launch New Institute (14-Day Free Trial)</span>
                  </button>

                  <button id="app-filled-btn" type="button" class="quick-demo-btn" (click)="fillDemoCredentials()">
                    <mat-icon>bolt</mat-icon>
                    <span>1-Click Instant Live Demo Access</span>
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
      overflow-y: auto;
      overflow-x: hidden;
      overscroll-behavior: none;
      -webkit-overflow-scrolling: touch;
      padding: 14px 36px;
      box-sizing: border-box;
    }

    .campus-bg-overlay {
      position: fixed;
      inset: 0;
      background:
        linear-gradient(102deg, rgba(6, 12, 30, 0.80) 0%, rgba(10, 20, 48, 0.58) 42%, rgba(15, 23, 42, 0.16) 72%, rgba(10, 18, 40, 0.35) 100%),
        radial-gradient(circle at 20% 25%, rgba(37, 99, 235, 0.15) 0%, transparent 55%);
      pointer-events: none;
      z-index: 1;
    }

    .ambient-glow-left {
      position: fixed;
      width: 540px;
      height: 540px;
      background: radial-gradient(circle, rgba(56, 189, 248, 0.16) 0%, rgba(37, 99, 235, 0.06) 50%, transparent 70%);
      top: 15%;
      left: 8%;
      pointer-events: none;
      filter: blur(50px);
      z-index: 2;
    }

    .ambient-glow-right {
      position: fixed;
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, rgba(37, 99, 235, 0.28) 0%, rgba(245, 158, 11, 0.14) 55%, transparent 75%);
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
      max-width: 1380px;
      display: grid;
      grid-template-columns: minmax(0, 1.36fr) 435px;
      gap: 40px;
      align-items: center;
      margin: 0 auto;
    }

    /* ─── LEFT HERO SHOWCASE ──────────────────────────────────────────────── */
    .hero-showcase {
      display: flex;
      flex-direction: column;
      gap: 14px;
      color: #ffffff;
      padding-right: 8px;
      min-width: 0;
      width: 100%;
      box-sizing: border-box;
    }

    .hero-top-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      align-self: flex-start;
      max-width: 100%;
      box-sizing: border-box;
      background: rgba(37, 99, 235, 0.32);
      border: 1px solid rgba(96, 165, 250, 0.5);
      backdrop-filter: blur(10px);
      padding: 5px 14px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #e0f2fe;
      box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);

      .pulse-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #4ade80;
        box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.28);
        flex-shrink: 0;
      }

      .badge-sparkle {
        font-size: 15px;
        width: 15px;
        height: 15px;
        color: #fbbf24;
        flex-shrink: 0;
      }
    }

    .hero-main-title {
      font-size: clamp(1.65rem, 2.35vw, 2.35rem);
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.025em;
      margin: 0;
      color: #ffffff;
      text-shadow: 0 2px 16px rgba(0, 0, 0, 0.45);

      .hero-gradient-text {
        display: block;
        background: linear-gradient(90deg, #60a5fa 0%, #38bdf8 45%, #fbbf24 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
    }

    .hero-subtitle {
      font-size: 0.88rem;
      line-height: 1.48;
      color: #cbd5e1;
      margin: 0;
      max-width: 700px;
      font-weight: 500;
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.4);
    }

    /* Point-Wise Feature Cards Grid */
    .feature-points-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 11px;
      margin-top: 2px;
    }

    .feature-point-card {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 11px 14px;
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.66);
      border: 1px solid rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.4);
      transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;

      &.highlight-card {
        border-color: rgba(56, 189, 248, 0.45);
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.78) 0%, rgba(12, 74, 110, 0.55) 100%);
      }

      &:hover {
        transform: translateY(-2px);
        background: rgba(15, 23, 42, 0.82);
        border-color: rgba(96, 165, 250, 0.55);
      }

      .fp-icon-box {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        color: #ffffff;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }

        &.emerald-glow {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
        }
        &.sky-glow {
          background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
          box-shadow: 0 4px 12px rgba(14, 165, 233, 0.45);
        }
        &.violet-glow {
          background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.35);
        }
        &.amber-glow {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.35);
        }
        &.rose-glow {
          background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
          box-shadow: 0 4px 12px rgba(244, 63, 94, 0.35);
        }
        &.cyan-glow {
          background: linear-gradient(135deg, #06b6d4 0%, #0284c7 100%);
          box-shadow: 0 4px 12px rgba(6, 182, 212, 0.35);
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
          margin-bottom: 3px;
        }

        .fp-title {
          font-size: 0.84rem;
          font-weight: 700;
          color: #f8fafc;
          letter-spacing: -0.01em;
          line-height: 1.2;
        }

        .fp-check {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 17px;
          height: 17px;
          border-radius: 50%;
          background: rgba(74, 222, 128, 0.2);
          color: #4ade80;
          font-size: 0.68rem;
          font-weight: 800;
          flex-shrink: 0;
        }

        .fp-hw-tag {
          display: inline-flex;
          align-items: center;
          padding: 1px 6px;
          border-radius: 999px;
          background: rgba(56, 189, 248, 0.22);
          border: 1px solid rgba(56, 189, 248, 0.5);
          color: #7dd3fc;
          font-size: 0.6rem;
          font-weight: 800;
          letter-spacing: 0.04em;
          flex-shrink: 0;
        }

        .fp-desc {
          margin: 0;
          font-size: 0.74rem;
          line-height: 1.38;
          color: #cbd5e1;
          font-weight: 400;
        }
      }
    }

    /* Bottom Trust Strip */
    .hero-trust-strip {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-top: 2px;

      .trust-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.65);
        border: 1px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(8px);
        font-size: 0.73rem;
        font-weight: 600;
        color: #f1f5f9;

        mat-icon {
          font-size: 15px;
          width: 15px;
          height: 15px;
          color: #38bdf8;
        }
      }
    }

    /* ─── RIGHT LOGIN CARD PANEL (MACHO EXECUTIVE EDITION) ────────────────── */
    .login-panel-right {
      display: flex;
      justify-content: flex-end;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }

    .login-card {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 435px;
      min-width: 0;
      box-sizing: border-box;
      border-radius: 22px;
      box-shadow:
        0 30px 70px -12px rgba(2, 6, 23, 0.8),
        0 0 0 1px rgba(255, 255, 255, 0.28),
        0 0 35px rgba(37, 99, 235, 0.25) !important;
      background: #ffffff;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .card-accent-line {
      height: 5px;
      width: 100%;
      background: linear-gradient(90deg, #f59e0b 0%, #38bdf8 50%, #2563eb 100%);
    }

    /* Bold Dark-Sapphire Executive Header Banner inside Card */
    .login-exec-header {
      position: relative;
      background: linear-gradient(135deg, #091128 0%, #172554 55%, #1e3a8a 100%);
      padding: 16px 22px 14px;
      color: #ffffff;
      border-bottom: 1px solid rgba(59, 130, 246, 0.25);
      overflow: hidden;

      .exec-header-glow {
        position: absolute;
        top: -40px;
        right: -30px;
        width: 150px;
        height: 150px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(56, 189, 248, 0.28) 0%, transparent 70%);
        pointer-events: none;
      }

      .exec-top-row {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 11px;
      }

      .brand-crest-shield {
        position: relative;
        width: 50px;
        height: 50px;
        border-radius: 14px;
        background: linear-gradient(135deg, #2563eb 0%, #0284c7 100%);
        border: 1.5px solid rgba(147, 197, 253, 0.65);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 20px rgba(37, 99, 235, 0.55), inset 0 1px 1px rgba(255, 255, 255, 0.35);
        flex-shrink: 0;

        .brand-icon {
          font-size: 27px;
          width: 27px;
          height: 27px;
          color: #ffffff;
        }

        .shield-key-dot {
          position: absolute;
          bottom: -4px;
          right: -4px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          border: 2px solid #0f172a;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);

          mat-icon {
            font-size: 11px;
            width: 11px;
            height: 11px;
            color: #0f172a;
            font-weight: 900;
          }
        }
      }

      .exec-title-block {
        display: flex;
        flex-direction: column;
        min-width: 0;

        .exec-badge-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 3px;
        }

        .tenant-pill {
          background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
          color: #0f172a;
          font-size: 0.6rem;
          font-weight: 800;
          padding: 1.5px 7px;
          border-radius: 6px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .cloud-pill {
          background: rgba(56, 189, 248, 0.18);
          border: 1px solid rgba(56, 189, 248, 0.4);
          color: #7dd3fc;
          font-size: 0.6rem;
          font-weight: 800;
          padding: 1px 7px;
          border-radius: 6px;
          letter-spacing: 0.05em;
        }

        .brand-title {
          font-size: 1.28rem;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.02em;
          margin: 0;
          line-height: 1.15;
        }

        .brand-sub {
          font-size: 0.74rem;
          color: #93c5fd;
          font-weight: 600;
          margin: 2px 0 0;
        }
      }

      .module-tags-row {
        position: relative;
        z-index: 1;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;

        .module-chip {
          font-size: 0.61rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #e2e8f0;
          letter-spacing: 0.01em;
          white-space: nowrap;

          &.highlight {
            background: rgba(16, 185, 129, 0.22);
            border-color: rgba(52, 211, 153, 0.45);
            color: #6ee7b7;
          }
        }
      }
    }

    /* Form Section */
    .form-content {
      padding: 14px 24px 16px;
      background: linear-gradient(180deg, #f8fafc 0%, #ffffff 35%);
    }

    .portal-divider-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;

      .p-line {
        flex: 1;
        height: 1px;
        background: linear-gradient(90deg, transparent, #cbd5e1, transparent);
      }

      .p-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.66rem;
        font-weight: 800;
        color: #1e3a8a;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        padding: 2px 10px;
        border-radius: 999px;
        letter-spacing: 0.06em;

        mat-icon {
          font-size: 13px;
          width: 13px;
          height: 13px;
          color: #2563eb;
        }
      }
    }

    .full-width {
      width: 100%;
      margin-bottom: 2px;
    }

    .field-suffix-icon {
      color: #1e40af;
    }

    /* High-Impact Macho Sign-In Button */
    .macho-submit-btn {
      width: 100%;
      height: 44px;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 45%, #2563eb 100%) !important;
      color: #ffffff !important;
      font-size: 0.88rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      border-radius: 11px;
      border: 1px solid rgba(96, 165, 250, 0.4) !important;
      margin-top: 2px;
      cursor: pointer;
      box-shadow: 0 10px 24px -4px rgba(30, 58, 138, 0.55);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;

      &:hover:not([disabled]) {
        background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #0284c7 100%) !important;
        box-shadow: 0 14px 28px -4px rgba(37, 99, 235, 0.65);
        transform: translateY(-1px);
      }

      &:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .btn-lock-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #38bdf8;
      }

      .btn-arrow {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-left: 2px;
      }
    }

    .or-divider {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 10px 0 8px;
      .line {
        flex: 1;
        height: 1px;
        background: #e2e8f0;
      }
      .text {
        font-size: 0.68rem;
        color: #64748b;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
    }

    .demo-actions-row {
      display: grid;
      grid-template-columns: 1fr;
      gap: 7px;
      width: 100%;
    }

    .create-tenant-btn {
      width: 100%;
      height: 38px;
      border: 1.5px solid #93c5fd !important;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important;
      color: #1e3a8a !important;
      font-weight: 800 !important;
      border-radius: 10px !important;
      font-size: 0.8rem !important;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      transition: all 0.2s ease;

      &:hover {
        background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%) !important;
        border-color: #60a5fa !important;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.18);
      }

      mat-icon {
        font-size: 17px;
        width: 17px;
        height: 17px;
        color: #2563eb;
      }
    }

    .quick-demo-btn {
      width: 100%;
      height: 34px;
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%) !important;
      border: 1px solid #fcd34d !important;
      color: #92400e !important;
      font-size: 0.76rem;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border-radius: 9px;
      transition: all 0.15s ease;

      &:hover {
        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important;
        color: #78350f !important;
        transform: translateY(-1px);
      }

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #d97706;
      }
    }

    .security-footer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px dashed #e2e8f0;
      font-size: 0.69rem;
      color: #475569;
      font-weight: 600;
      .sec-icon {
        font-size: 15px;
        width: 15px;
        height: 15px;
        color: #10b981;
      }
    }

    .info-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background-color: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.78rem;
      font-weight: 500;
      margin: 2px 0 6px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
      span { flex: 1; line-height: 1.3; }
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background-color: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.78rem;
      font-weight: 500;
      margin: 2px 0 6px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; color: #dc2626 !important; }
      span { flex: 1; line-height: 1.3; }
    }

    /* ─── RESPONSIVE BREAKPOINTS (Tablet & Mobile) ────────────────────────── */
    @media (max-width: 1080px) {
      .login-wrapper {
        align-items: flex-start;
        justify-content: center;
        padding: 18px 16px 32px;
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
          gap: 10px;
          margin-bottom: 8px;
        }

        .brand-crest-shield {
          width: 42px;
          height: 42px;
          border-radius: 11px;
          .brand-icon {
            font-size: 22px;
            width: 22px;
            height: 22px;
          }
          .shield-key-dot {
            width: 17px;
            height: 17px;
            bottom: -3px;
            right: -3px;
            mat-icon {
              font-size: 10px;
              width: 10px;
              height: 10px;
            }
          }
        }

        .exec-title-block {
          .brand-title {
            font-size: 1.12rem;
          }
          .brand-sub {
            font-size: 0.68rem;
          }
          .tenant-pill, .cloud-pill {
            font-size: 0.55rem;
            padding: 1px 5px;
          }
        }

        .module-tags-row {
          gap: 4px;
          .module-chip {
            font-size: 0.58rem;
            padding: 2px 5.5px;
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
