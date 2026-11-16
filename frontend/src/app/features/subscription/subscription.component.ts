import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterModule } from '@angular/router';
import { TenantService, MySubscriptionDto, TenantDto, SubscriptionPricingConfig } from '../../core/services/tenant.service';
import { AuthService } from '../../core/services/auth.service';
import { SubscriptionRenewalDialogComponent } from './subscription-renewal-dialog.component';
import { ManageSubscriptionDialogComponent } from './manage-subscription-dialog.component';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    RouterModule
  ],
  template: `
    <div class="subscription-page-container">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-titles">
          <div class="title-row">
            <h2 class="page-title">Subscription &amp; SaaS Plan Licensing</h2>
            <span class="plan-pill" [class.trial]="isTrial" [class.premium]="!isTrial">
              <mat-icon>{{ isTrial ? 'access_time' : 'verified' }}</mat-icon>
              {{ subData?.subscriptionPlan || 'FreeTrial' }}
            </span>
          </div>
          <p class="page-subtitle">
            Institute tier details, active module entitlements, student capacity quota, and trial duration.
          </p>
        </div>
    
        @if (isSuperAdmin) {
          <div class="header-actions">
            <button color="primary" class="superadmin-manage-btn" (click)="openSuperAdminManageDialog()" matButton="filled">
              <mat-icon>verified</mat-icon>
              <span>Manage &amp; Extend Plan</span>
            </button>
            <a matButton="filled" color="primary" routerLink="/admin/tenants" class="manage-tenants-btn">
              <mat-icon>corporate_fare</mat-icon>
              <span>Tenants Grid</span>
            </a>
          </div>
        }
      </div>
    
      <!-- SuperAdmin Scope Selector (View & Manage Any Institute) -->
      @if (isSuperAdmin && tenants.length > 0) {
        <div class="scope-selector-card mat-elevation-z1">
          <div class="scope-label-side">
            <mat-icon class="scope-icon">swap_horizontal_circle</mat-icon>
            <div>
              <strong>SuperAdmin Scope: Inspect &amp; Extend Any Institute</strong>
              <p>Select institute to check expiry countdown, upgrade to Premium, or add 15 days, 1 month, 2 months.</p>
            </div>
          </div>
          <mat-form-field appearance="outline" class="scope-select-field" subscriptSizing="dynamic">
            <mat-label>Select Institute to Manage</mat-label>
            <mat-select [value]="selectedTenantId" (selectionChange)="onTenantScopeChange($event.value)">
              <mat-option [value]="null">🏢 Current Institute / Platform Console</mat-option>
              @for (t of tenants; track t) {
                <mat-option [value]="t.id">
                  🏫 {{ t.name }} ({{ t.code }})
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      }
    
      @if (!loading && subData) {
        <div class="content-body">
          <!-- Subscription Expired / Locked Alert Notice -->
          @if (isExpired) {
            <div class="expired-alert-card mat-elevation-z2">
              <div class="alert-icon-box danger">
                <mat-icon>lock_clock</mat-icon>
              </div>
              <div class="alert-content">
                <div class="alert-title-row">
                  <h4>Subscription Expired / Free Trial Concluded</h4>
                  @if (subData.trialEndDate) {
                    <span class="expiry-date-badge danger">
                      Concluded on {{ subData.trialEndDate | date:'mediumDate' }}
                    </span>
                  }
                </div>
                <p>
                  Your institute's trial period or subscription has ended. Routine operations and feature access are currently locked. Renew your plan or select an upgraded edition to resume immediate access.
                </p>
              </div>
              <button color="warn" class="upgrade-btn danger" (click)="openRenewalDialog()" matButton="filled">
                <mat-icon>credit_score</mat-icon>
                <span>Renew Plan Now</span>
              </button>
            </div>
          }
          <!-- Trial Alert Notice (if FreeTrial and active) -->
          @if (isTrial) {
            <div class="trial-alert-card mat-elevation-z1">
              <div class="alert-icon-box">
                <mat-icon>hourglass_top</mat-icon>
              </div>
              <div class="alert-content">
                <div class="alert-title-row">
                  <h4>Free Trial Active — {{ trialDaysRemaining }} Days Left</h4>
                  @if (subData.trialEndDate) {
                    <span class="expiry-date">Expires on {{ subData.trialEndDate | date:'mediumDate' }}</span>
                  }
                </div>
                <p>
                  Your institute is currently enjoying full access to provisioned modules under the complimentary trial period. Upgrade to a permanent tier to guarantee uninterrupted student management, fee records, and biometric integrations.
                </p>
              </div>
              <button color="accent" class="upgrade-btn" (click)="contactForUpgrade()" matButton="filled">
                <mat-icon>upgrade</mat-icon>
                <span>Upgrade to Premium</span>
              </button>
            </div>
          }
          <!-- 4-Column Plan Overview Metrics with Expiry Countdown -->
          <div class="metrics-grid">
            <!-- Plan Info Card -->
            <mat-card class="metric-card hero-gradient">
              <div class="card-inner">
                <div class="metric-meta">
                  <span class="metric-title">Active Edition</span>
                  <span class="metric-highlight">{{ subData.subscriptionPlan }}</span>
                  <span class="metric-sub">{{ subData.subscriptionStatus }} &bull; {{ subData.instituteName }}</span>
                </div>
                <div class="card-icon-bubble">
                  <mat-icon>workspace_premium</mat-icon>
                </div>
              </div>
            </mat-card>
            <!-- Subscription Validity & Expiry Countdown Card -->
            <mat-card class="metric-card countdown-card" [class.urgent]="trialDaysRemaining <= 10 && !isExpired" [class.expired]="isExpired">
              <div class="card-inner">
                <div class="metric-meta">
                  <span class="metric-title">Subscription Validity</span>
                  @if (!isExpired) {
                    <span class="metric-highlight">
                      {{ trialDaysRemaining }} <small>Days Left</small>
                    </span>
                  }
                  @if (isExpired) {
                    <span class="metric-highlight danger">
                      EXPIRED <small>(0 Days)</small>
                    </span>
                  }
                  @if (subData.trialEndDate) {
                    <span class="metric-sub">
                      Valid until {{ subData.trialEndDate | date:'mediumDate' }}
                    </span>
                  }
                  @if (!subData.trialEndDate) {
                    <span class="metric-sub">
                      Continuous / Permanent Plan
                    </span>
                  }
                </div>
                <div class="card-icon-bubble" [ngClass]="isExpired ? 'danger' : (trialDaysRemaining <= 10 ? 'amber' : 'emerald')">
                  <mat-icon>{{ isExpired ? 'error' : (trialDaysRemaining <= 10 ? 'alarm' : 'schedule') }}</mat-icon>
                </div>
              </div>
              @if (isSuperAdmin) {
                <div class="countdown-footer">
                  <button color="primary" class="quick-extend-link" (click)="openSuperAdminManageDialog()" matButton="filled">
                    <mat-icon>add_alarm</mat-icon>
                    <span>Extend (+15d / +1m / +2m)</span>
                  </button>
                </div>
              }
            </mat-card>
            <!-- Student Capacity Meter Card -->
            <mat-card class="metric-card">
              <div class="card-inner">
                <div class="metric-meta">
                  <span class="metric-title">Student Admissions Quota</span>
                  <span class="metric-highlight">{{ subData.studentCount }} <small>/ {{ subData.maxStudentsLimit }}</small></span>
                  <span class="metric-sub">{{ studentUsagePercent }}% capacity consumed</span>
                </div>
                <div class="card-icon-bubble blue">
                  <mat-icon>school</mat-icon>
                </div>
              </div>
              <mat-progress-bar mode="determinate" [value]="studentUsagePercent" class="quota-progress-bar" [color]="studentUsagePercent > 85 ? 'warn' : 'primary'"></mat-progress-bar>
            </mat-card>
            <!-- Branches Master Meter Card -->
            <mat-card class="metric-card">
              <div class="card-inner">
                <div class="metric-meta">
                  <span class="metric-title">Multi-Branch License</span>
                  <span class="metric-highlight">{{ subData.branchCount }} <small>/ {{ subData.maxBranchesLimit }}</small></span>
                  <span class="metric-sub">{{ branchUsagePercent }}% branch slots assigned</span>
                </div>
                <div class="card-icon-bubble emerald">
                  <mat-icon>apartment</mat-icon>
                </div>
              </div>
              <mat-progress-bar mode="determinate" [value]="branchUsagePercent" class="quota-progress-bar" color="primary"></mat-progress-bar>
            </mat-card>
          </div>
          <!-- 5 Core Modules Licensing Status -->
          <mat-card class="section-card mat-elevation-z1">
            <div class="section-header">
              <div class="section-title-wrap">
                <div class="section-icon-box">
                  <mat-icon>hub</mat-icon>
                </div>
                <div>
                  <h3 class="section-title">5 Core Functional Modules Entitlement</h3>
                  <p class="section-desc">Active modules are unlocked and visible across your sidebar and workflows. Disabled modules are restricted by platform licensing.</p>
                </div>
              </div>
              <span class="managed-tag">
                <mat-icon>shield</mat-icon> Provisioned by Super Admin
              </span>
            </div>
            <div class="modules-grid">
              <!-- School Module -->
              <div class="module-status-tile" [class.unlocked]="subData.hasSchoolModule">
                <div class="tile-icon-box school">
                  <mat-icon>domain</mat-icon>
                </div>
                <div class="tile-info">
                  <div class="tile-title-row">
                    <span class="tile-name">School Academic</span>
                    <span class="tile-badge" [class.active]="subData.hasSchoolModule">
                      {{ subData.hasSchoolModule ? 'Active' : 'Locked' }}
                    </span>
                  </div>
                  <p class="tile-details">Classes, Sections, Student Promotion, Academic Routine &amp; School Exams.</p>
                </div>
              </div>
              <!-- Coaching Module -->
              <div class="module-status-tile" [class.unlocked]="subData.hasCoachingModule">
                <div class="tile-icon-box coaching">
                  <mat-icon>school</mat-icon>
                </div>
                <div class="tile-info">
                  <div class="tile-title-row">
                    <span class="tile-name">Coaching &amp; Tuitions</span>
                    <span class="tile-badge" [class.active]="subData.hasCoachingModule">
                      {{ subData.hasCoachingModule ? 'Active' : 'Locked' }}
                    </span>
                  </div>
                  <p class="tile-details">Academic Batches, Classrooms, Test Series &amp; Monthly Tuition Fees.</p>
                </div>
              </div>
              <!-- Hostel Module -->
              <div class="module-status-tile" [class.unlocked]="subData.hasHostelModule">
                <div class="tile-icon-box hostel">
                  <mat-icon>apartment</mat-icon>
                </div>
                <div class="tile-info">
                  <div class="tile-title-row">
                    <span class="tile-name">Hostel &amp; Residential</span>
                    <span class="tile-badge" [class.active]="subData.hasHostelModule">
                      {{ subData.hasHostelModule ? 'Active' : 'Locked' }}
                    </span>
                  </div>
                  <p class="tile-details">Hostel Buildings, Bed Allotment, Room Rent, Mess &amp; Resident Lists.</p>
                </div>
              </div>
              <!-- Library Module -->
              <div class="module-status-tile" [class.unlocked]="subData.hasLibraryModule">
                <div class="tile-icon-box library">
                  <mat-icon>local_library</mat-icon>
                </div>
                <div class="tile-info">
                  <div class="tile-title-row">
                    <span class="tile-name">Library Management</span>
                    <span class="tile-badge" [class.active]="subData.hasLibraryModule">
                      {{ subData.hasLibraryModule ? 'Active' : 'Locked' }}
                    </span>
                  </div>
                  <p class="tile-details">Catalog, Circulation Issue/Return, Fines &amp; Reading Shifts.</p>
                </div>
              </div>
              <!-- Transport Module -->
              <div class="module-status-tile" [class.unlocked]="subData.hasTransportModule">
                <div class="tile-icon-box transport">
                  <mat-icon>directions_bus</mat-icon>
                </div>
                <div class="tile-info">
                  <div class="tile-title-row">
                    <span class="tile-name">Transport &amp; Fleet</span>
                    <span class="tile-badge" [class.active]="subData.hasTransportModule">
                      {{ subData.hasTransportModule ? 'Active' : 'Locked' }}
                    </span>
                  </div>
                  <p class="tile-details">Vehicles Fleet, Bus Routes, Stop Allotment &amp; Transport Fees.</p>
                </div>
              </div>
            </div>
          </mat-card>
          <!-- SuperAdmin Dynamic SaaS Pricing Configurator Panel -->
          @if (isSuperAdmin) {
            <mat-card class="section-card mat-elevation-z2 config-deck-card">
              <div class="section-header">
                <div class="section-title-wrap">
                  <div class="section-icon-box admin-config-icon">
                    <mat-icon>tune</mat-icon>
                  </div>
                  <div>
                    <h3 class="section-title">Platform SaaS Pricing &amp; Plans Configuration</h3>
                    <p class="section-desc">Platform SuperAdmin dynamic pricing control. Changes update instantly across public registration, 3-month trial banners, and customer renewal screens.</p>
                  </div>
                </div>
                <span class="managed-tag superadmin-tag">
                  <mat-icon>admin_panel_settings</mat-icon> SuperAdmin Exclusive
                </span>
              </div>

              <form [formGroup]="pricingForm" (ngSubmit)="savePricingConfig()" class="pricing-config-form">
                <div class="config-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Plan Title / Edition</mat-label>
                    <input matInput formControlName="planName" placeholder="e.g. Premium Enterprise Edition">
                    <mat-icon matSuffix>verified</mat-icon>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Trial Duration (Days)</mat-label>
                    <input matInput type="number" formControlName="trialDurationDays" min="1">
                    <span matSuffix class="field-suffix">Days</span>
                    <mat-hint>90 Days = 3 Months</mat-hint>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Trial Charge (₹)</mat-label>
                    <input matInput type="number" formControlName="trialFee" min="0">
                    <span matPrefix class="currency-prefix">₹&nbsp;</span>
                    <mat-hint>Effective ₹1,000 / month</mat-hint>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Annual One-Time Price (₹)</mat-label>
                    <input matInput type="number" formControlName="annualOneTimePrice" min="0">
                    <span matPrefix class="currency-prefix">₹&nbsp;</span>
                    <mat-hint>Customer pays ₹10,000 / year</mat-hint>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Monthly Billing Rate (₹)</mat-label>
                    <input matInput type="number" formControlName="monthlyRate" min="0">
                    <span matPrefix class="currency-prefix">₹&nbsp;</span>
                    <mat-hint>Customer pays ₹1,000 / month (₹12,000 / yr)</mat-hint>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Software One-Time Setup Fee (₹)</mat-label>
                    <input matInput type="number" formControlName="softwareSetupFee" min="0">
                    <span matPrefix class="currency-prefix">₹&nbsp;</span>
                    <mat-hint>Setup / License onboarding fee (₹15,000)</mat-hint>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Max Students Limit</mat-label>
                    <input matInput type="number" formControlName="maxStudentsLimit" min="10">
                    <mat-icon matSuffix>school</mat-icon>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Max Branches Limit</mat-label>
                    <input matInput type="number" formControlName="maxBranchesLimit" min="1">
                    <mat-icon matSuffix>apartment</mat-icon>
                  </mat-form-field>
                </div>

                <div class="config-actions-row">
                  <button type="submit" color="primary" matButton="filled" [disabled]="savingPricing" class="save-pricing-btn">
                    <mat-icon>{{ savingPricing ? 'hourglass_top' : 'save' }}</mat-icon>
                    <span>{{ savingPricing ? 'Saving Pricing...' : 'Save SaaS Pricing Configuration' }}</span>
                  </button>
                </div>
              </form>
            </mat-card>
          }

          <!-- Dynamic SaaS Plans & Billing Selection -->
          <div class="tiers-section">
            <div class="tiers-header">
              <h3>Choose the Right Plan for Your Growing Institution</h3>
              <p>Dynamic enterprise subscriptions with scalable student capacities, multi-campus management, and full modules access.</p>
            </div>

            <!-- Billing Toggle: Annual vs Monthly -->
            <div class="billing-toggle-container">
              <div class="billing-toggle-pill">
                <button type="button" 
                  class="toggle-btn" 
                  [class.active]="selectedBillingCycle === 'Annual'"
                  (click)="selectedBillingCycle = 'Annual'">
                  <mat-icon>calendar_today</mat-icon>
                  <span>Annual One-Time</span>
                  <span class="save-badge">SAVE ₹{{ (pricingConfig?.annualMonthlyTotal || 12000) - (pricingConfig?.annualOneTimePrice || 10000) | number }}</span>
                </button>
                <button type="button" 
                  class="toggle-btn" 
                  [class.active]="selectedBillingCycle === 'Monthly'"
                  (click)="selectedBillingCycle = 'Monthly'">
                  <mat-icon>date_range</mat-icon>
                  <span>Monthly Billing</span>
                </button>
              </div>
            </div>

            <div class="tiers-grid two-columns">
              <!-- Premium Annual One-Time Plan Card -->
              <mat-card class="tier-card popular-tier" [class.highlighted]="selectedBillingCycle === 'Annual'">
                <div class="popular-ribbon">RECOMMENDED • BEST VALUE</div>
                <div class="tier-card-header">
                  <div class="tier-title-wrap">
                    <span class="tier-name">{{ pricingConfig?.planName || 'Premium Enterprise Edition' }}</span>
                    <span class="tier-tagline">Complete 5-Module Powerhouse &bull; Annual Lump-sum</span>
                  </div>
                  <div class="tier-price-box">
                    <div class="main-price">
                      <span class="currency">₹</span>
                      <span class="amount">{{ pricingConfig?.annualOneTimePrice || 10000 | number }}</span>
                      <span class="period">/ year</span>
                    </div>
                    <div class="price-sub">
                      + ₹{{ pricingConfig?.softwareSetupFee || 15000 | number }} One-Time Software Setup Fee
                    </div>
                    <div class="total-first-year">
                      <strong>Total First Year: ₹{{ (pricingConfig?.annualOneTimePrice || 10000) + (pricingConfig?.softwareSetupFee || 15000) | number }}</strong>
                    </div>
                  </div>
                </div>

                <div class="tier-savings-banner">
                  <mat-icon>savings</mat-icon>
                  <span>Save ₹{{ (pricingConfig?.annualMonthlyTotal || 12000) - (pricingConfig?.annualOneTimePrice || 10000) | number }} yearly compared to monthly billing</span>
                </div>

                <ul class="tier-features">
                  <li><mat-icon>check_circle</mat-icon> Up to {{ pricingConfig?.maxStudentsLimit || 1000 }} Students Capacity</li>
                  <li><mat-icon>check_circle</mat-icon> Up to {{ pricingConfig?.maxBranchesLimit || 5 }} Campus Branches</li>
                  <li><mat-icon>check_circle</mat-icon> All 5 Modules Included (School, Coaching, Hostel, Library, Transport)</li>
                  <li><mat-icon>check_circle</mat-icon> Biometric Attendance &amp; Hardware Auto-Sync</li>
                  <li><mat-icon>check_circle</mat-icon> WhatsApp Cloud Messaging &amp; Voice AI Recovery</li>
                  <li><mat-icon>check_circle</mat-icon> Full Accounting, P&amp;L, Day Book &amp; FIFO Fee Ledgers</li>
                  <li><mat-icon>check_circle</mat-icon> Priority Dedicated Support &amp; SLA</li>
                </ul>

                <button color="primary" class="tier-action-btn prominent" (click)="contactForUpgrade('Annual')" matButton="filled">
                  <mat-icon>workspace_premium</mat-icon>
                  <span>Select Annual Plan (₹{{ (pricingConfig?.annualOneTimePrice || 10000) + (pricingConfig?.softwareSetupFee || 15000) | number }})</span>
                </button>
              </mat-card>

              <!-- Premium Monthly Billing Plan Card -->
              <mat-card class="tier-card" [class.highlighted]="selectedBillingCycle === 'Monthly'">
                <div class="monthly-ribbon">FLEXIBLE MONTHLY</div>
                <div class="tier-card-header">
                  <div class="tier-title-wrap">
                    <span class="tier-name">{{ pricingConfig?.planName || 'Premium Enterprise Edition' }}</span>
                    <span class="tier-tagline">Complete 5-Module Powerhouse &bull; Monthly Schedule</span>
                  </div>
                  <div class="tier-price-box">
                    <div class="main-price">
                      <span class="currency">₹</span>
                      <span class="amount">{{ pricingConfig?.monthlyRate || 1000 | number }}</span>
                      <span class="period">/ month</span>
                    </div>
                    <div class="price-sub">
                      + ₹{{ pricingConfig?.softwareSetupFee || 15000 | number }} One-Time Software Setup Fee
                    </div>
                    <div class="total-first-year">
                      <strong>First Month: ₹{{ (pricingConfig?.monthlyRate || 1000) + (pricingConfig?.softwareSetupFee || 15000) | number }}</strong>
                      <span class="sub-text">(then ₹{{ pricingConfig?.monthlyRate || 1000 | number }}/mo)</span>
                    </div>
                  </div>
                </div>

                <div class="tier-savings-banner neutral">
                  <mat-icon>calendar_view_month</mat-icon>
                  <span>Total Annual Cost: ₹{{ (pricingConfig?.annualMonthlyTotal || 12000) + (pricingConfig?.softwareSetupFee || 15000) | number }} (₹12,000 sub + ₹15,000 setup)</span>
                </div>

                <ul class="tier-features">
                  <li><mat-icon>check_circle</mat-icon> Up to {{ pricingConfig?.maxStudentsLimit || 1000 }} Students Capacity</li>
                  <li><mat-icon>check_circle</mat-icon> Up to {{ pricingConfig?.maxBranchesLimit || 5 }} Campus Branches</li>
                  <li><mat-icon>check_circle</mat-icon> All 5 Modules Included (School, Coaching, Hostel, Library, Transport)</li>
                  <li><mat-icon>check_circle</mat-icon> Biometric Attendance &amp; Hardware Auto-Sync</li>
                  <li><mat-icon>check_circle</mat-icon> WhatsApp Cloud Messaging &amp; Voice AI Recovery</li>
                  <li><mat-icon>check_circle</mat-icon> Full Accounting, P&amp;L, Day Book &amp; FIFO Fee Ledgers</li>
                  <li><mat-icon>check_circle</mat-icon> Cancel or switch to annual anytime</li>
                </ul>

                <button color="primary" class="tier-action-btn" (click)="contactForUpgrade('Monthly')" matButton="filled">
                  <mat-icon>credit_score</mat-icon>
                  <span>Select Monthly Plan (₹{{ (pricingConfig?.monthlyRate || 1000) + (pricingConfig?.softwareSetupFee || 15000) | number }})</span>
                </button>
              </mat-card>
            </div>
          </div>
        </div>
      }
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .subscription-page-container {
      padding: 0 0 40px;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 24px;
      font-family: 'Inter', system-ui, sans-serif;
      box-sizing: border-box;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;

      .title-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .page-title {
        font-size: 1.55rem;
        font-weight: 800;
        color: #0f172a;
        margin: 0;
        letter-spacing: -0.02em;
      }

      .plan-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8rem;
        font-weight: 700;
        padding: 4px 12px;
        border-radius: 20px;

        &.trial {
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
        }

        &.premium {
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #86efac;
        }

        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }

      .page-subtitle {
        color: #64748b;
        font-size: 0.88rem;
        margin: 4px 0 0;
      }
    }

    .spinner-wrap {
      display: flex;
      justify-content: center;
      padding: 60px 0;
    }

    .content-body {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    /* Trial Notice Banner */
    .trial-alert-card {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-radius: 14px;
      padding: 18px 24px;
      display: flex;
      align-items: center;
      gap: 18px;
      flex-wrap: wrap;

      .alert-icon-box {
        background: #2563eb;
        color: #ffffff;
        border-radius: 12px;
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 8px -2px rgba(37,99,235,0.3);
        flex-shrink: 0;
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }

      .alert-content {
        flex: 1;
        min-width: 260px;

        .alert-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 4px;

          h4 {
            margin: 0;
            font-size: 1.1rem;
            font-weight: 700;
            color: #1e3a8a;
          }

          .expiry-date {
            font-size: 0.78rem;
            font-weight: 600;
            background: #dbeafe;
            color: #1e40af;
            padding: 2px 8px;
            border-radius: 6px;
          }
        }

        p {
          margin: 0;
          font-size: 0.84rem;
          color: #3b82f6;
          line-height: 1.45;
        }
      }

      .upgrade-btn {
        background: #2563eb !important;
        color: #ffffff !important;
        font-weight: 700;
        height: 40px;
        border-radius: 8px;
        padding: 0 18px;
        box-shadow: 0 4px 10px rgba(37,99,235,0.25);
      }
    }

    .expired-alert-card {
      background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
      border: 1px solid #fecdd3;
      border-radius: 12px;
      padding: 18px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;

      .alert-icon-box.danger {
        background: #e11d48;
        color: #ffffff;
        border-radius: 12px;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 8px -2px rgba(225,29,72,0.3);
        flex-shrink: 0;
        mat-icon { font-size: 26px; width: 26px; height: 26px; }
      }

      .alert-content {
        flex: 1;
        min-width: 260px;

        .alert-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 4px;

          h4 {
            margin: 0;
            font-size: 1.15rem;
            font-weight: 800;
            color: #9f1239;
          }

          .expiry-date-badge.danger {
            font-size: 0.78rem;
            font-weight: 700;
            background: #fda4af;
            color: #881337;
            padding: 2px 8px;
            border-radius: 6px;
          }
        }

        p {
          margin: 0;
          font-size: 0.86rem;
          color: #be123c;
          line-height: 1.45;
          font-weight: 500;
        }
      }

      .upgrade-btn.danger {
        background: #e11d48 !important;
        color: #ffffff !important;
        font-weight: 700;
        height: 42px;
        border-radius: 8px;
        padding: 0 20px;
        box-shadow: 0 4px 10px rgba(225,29,72,0.3);
      }
    }

    .superadmin-manage-btn {
      background: #2563eb !important;
      color: #ffffff !important;
      font-weight: 700;
      height: 40px;
      border-radius: 8px;
      box-shadow: 0 4px 10px rgba(37,99,235,0.25);
    }

    .scope-selector-card {
      background: #ffffff;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;

      .scope-label-side {
        display: flex;
        align-items: center;
        gap: 12px;

        .scope-icon {
          color: #2563eb;
          font-size: 28px;
          width: 28px;
          height: 28px;
        }

        strong {
          color: #1e3a8a;
          font-size: 0.95rem;
        }

        p {
          margin: 2px 0 0;
          font-size: 0.8rem;
          color: #64748b;
        }
      }

      .scope-select-field {
        min-width: 320px;
      }
    }

    /* 4-Column Metrics */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
    }

    .metric-card {
      border-radius: 14px;
      padding: 20px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      gap: 14px;

      &.hero-gradient {
        background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
        color: #ffffff;
        border: none;

        .metric-title { color: #bfdbfe; }
        .metric-highlight { color: #ffffff; }
        .metric-sub { color: #93c5fd; }
        .card-icon-bubble { background: rgba(255, 255, 255, 0.15); color: #ffffff; }
      }

      &.countdown-card {
        &.urgent {
          border-color: #fde68a;
          background: #fffbeb;
        }
        &.expired {
          border-color: #fecdd3;
          background: #fff1f2;
        }

        .card-icon-bubble.amber {
          background: #fef3c7;
          color: #d97706;
        }

        .card-icon-bubble.emerald {
          background: #dcfce7;
          color: #15803d;
        }

        .card-icon-bubble.danger {
          background: #fee2e2;
          color: #dc2626;
        }

        .metric-highlight.danger {
          color: #dc2626;
        }

        .countdown-footer {
          border-top: 1px solid #f1f5f9;
          padding-top: 8px;
          display: flex;
          justify-content: flex-end;

          .quick-extend-link {
            font-size: 0.8rem;
            font-weight: 700;
          }
        }
      }

      .card-inner {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .metric-meta {
        display: flex;
        flex-direction: column;
        gap: 4px;

        .metric-title { font-size: 0.8rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
        .metric-highlight { font-size: 1.6rem; font-weight: 800; color: #0f172a; small { font-size: 1rem; color: #94a3b8; } }
        .metric-sub { font-size: 0.78rem; color: #64748b; }
      }

      .card-icon-bubble {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;

        &.blue { background: #eff6ff; color: #2563eb; }
        &.emerald { background: #ecfdf5; color: #059669; }
        mat-icon { font-size: 22px; width: 22px; height: 22px; }
      }

      .quota-progress-bar {
        border-radius: 6px;
        height: 7px;
      }
    }

    /* Section Card */
    .section-card {
      border-radius: 16px;
      padding: 24px;
      border: 1px solid #e2e8f0;
      background: #ffffff;

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 20px;
        flex-wrap: wrap;
        gap: 12px;

        .section-title-wrap {
          display: flex;
          align-items: center;
          gap: 12px;

          .section-icon-box {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            background: #eff6ff;
            color: #2563eb;
            display: flex;
            align-items: center;
            justify-content: center;
            mat-icon { font-size: 22px; width: 22px; height: 22px; }
          }

          .section-title { font-size: 1.15rem; font-weight: 700; color: #0f172a; margin: 0; }
          .section-desc { font-size: 0.8rem; color: #64748b; margin: 2px 0 0; }
        }

        .managed-tag {
          font-size: 0.75rem;
          font-weight: 600;
          color: #2563eb;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          padding: 4px 10px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          mat-icon { font-size: 14px; width: 14px; height: 14px; }
        }
      }
    }

    /* Modules Grid */
    .modules-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 14px;
    }

    .module-status-tile {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: #f8fafc;
      opacity: 0.65;
      transition: all 0.2s ease;

      &.unlocked {
        background: #ffffff;
        opacity: 1;
        border-color: #cbd5e1;
        box-shadow: 0 2px 6px rgba(15,23,42,0.03);
      }

      .tile-icon-box {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        &.school { background: #dbeafe; color: #1e40af; }
        &.coaching { background: #fef3c7; color: #92400e; }
        &.hostel { background: #ede9fe; color: #5b21b6; }
        &.library { background: #dcfce7; color: #166534; }
        &.transport { background: #fce7f3; color: #9d174d; }

        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }

      .tile-info {
        flex: 1;

        .tile-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;

          .tile-name { font-size: 0.88rem; font-weight: 700; color: #1e293b; }

          .tile-badge {
            font-size: 0.68rem;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 6px;
            background: #f1f5f9;
            color: #94a3b8;

            &.active {
              background: #dcfce7;
              color: #15803d;
            }
          }
        }

        .tile-details { font-size: 0.74rem; color: #64748b; margin: 0; line-height: 1.4; }
      }
    }

    /* Tier Cards & Dynamic Pricing */
    .tiers-section {
      display: flex;
      flex-direction: column;
      gap: 16px;

      .tiers-header {
        text-align: center;
        h3 { font-size: 1.3rem; font-weight: 800; color: #0f172a; margin: 0 0 4px; }
        p { font-size: 0.85rem; color: #64748b; margin: 0; }
      }
    }

    /* Billing Toggle Pill */
    .billing-toggle-container {
      display: flex;
      justify-content: center;
      margin: 8px 0 16px;

      .billing-toggle-pill {
        display: inline-flex;
        background: #f1f5f9;
        padding: 4px;
        border-radius: 9999px;
        border: 1px solid #e2e8f0;

        .toggle-btn {
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 8px 18px;
          border-radius: 9999px;
          font-size: 0.86rem;
          font-weight: 700;
          color: #64748b;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;

          mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
          }

          &.active {
            background: #2563eb;
            color: #ffffff;
            box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);

            .save-badge {
              background: #fef08a;
              color: #854d0e;
            }
          }

          .save-badge {
            background: #dbeafe;
            color: #1e40af;
            font-size: 0.7rem;
            font-weight: 800;
            padding: 2px 7px;
            border-radius: 6px;
          }
        }
      }
    }

    /* SuperAdmin Pricing Configurator */
    .config-deck-card {
      border: 1.5px solid #bfdbfe;
      background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);

      .admin-config-icon {
        background: #1e40af !important;
        color: #ffffff;
      }

      .superadmin-tag {
        background: #dbeafe;
        color: #1e40af;
        border: 1px solid #93c5fd;
      }

      .pricing-config-form {
        margin-top: 14px;

        .config-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;

          mat-form-field {
            width: 100%;

            input[type=number]::-webkit-inner-spin-button,
            input[type=number]::-webkit-outer-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }
            input[type=number] {
              -moz-appearance: textfield;
            }
          }

          .currency-prefix {
            font-weight: 700;
            color: #1e40af;
          }

          .field-suffix {
            font-size: 0.8rem;
            font-weight: 500;
            color: #64748b;
            padding-right: 6px;
            white-space: nowrap;
          }
        }

        .config-actions-row {
          display: flex;
          justify-content: flex-end;
          margin-top: 10px;

          .save-pricing-btn {
            height: 44px;
            padding: 0 24px;
            font-weight: 700;
            background: #2563eb;
            color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
          }
        }
      }
    }

    .tiers-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 24px;

      &.two-columns {
        grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
      }
    }

    .tier-card {
      border-radius: 16px;
      padding: 24px;
      border: 1.5px solid #e2e8f0;
      background: #ffffff;
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 16px;
      transition: all 0.25s ease;

      &.popular-tier {
        border: 2px solid #2563eb;
        box-shadow: 0 10px 25px -4px rgba(37,99,235,0.15) !important;
      }

      &.highlighted {
        border-color: #2563eb;
        box-shadow: 0 12px 30px -4px rgba(37,99,235,0.2) !important;
      }

      .popular-ribbon {
        position: absolute;
        top: -12px;
        right: 20px;
        background: #2563eb;
        color: #ffffff;
        font-size: 0.68rem;
        font-weight: 800;
        padding: 4px 12px;
        border-radius: 12px;
        letter-spacing: 0.06em;
      }

      .monthly-ribbon {
        position: absolute;
        top: -12px;
        right: 20px;
        background: #0f172a;
        color: #ffffff;
        font-size: 0.68rem;
        font-weight: 800;
        padding: 4px 12px;
        border-radius: 12px;
        letter-spacing: 0.06em;
      }

      .tier-card-header {
        display: flex;
        flex-direction: column;
        gap: 8px;
        border-bottom: 1px solid #f1f5f9;
        padding-bottom: 14px;

        .tier-title-wrap {
          display: flex;
          flex-direction: column;
          gap: 2px;
          .tier-name { font-size: 1.25rem; font-weight: 800; color: #0f172a; }
          .tier-tagline { font-size: 0.78rem; color: #64748b; }
        }

        .tier-price-box {
          margin-top: 4px;

          .main-price {
            display: flex;
            align-items: baseline;
            gap: 2px;

            .currency { font-size: 1.3rem; font-weight: 800; color: #1e3a8a; }
            .amount { font-size: 2.2rem; font-weight: 900; color: #1e3a8a; letter-spacing: -0.03em; }
            .period { font-size: 0.88rem; color: #64748b; font-weight: 600; margin-left: 4px; }
          }

          .price-sub {
            font-size: 0.8rem;
            color: #475569;
            font-weight: 600;
            margin-top: 2px;
          }

          .total-first-year {
            font-size: 0.86rem;
            color: #1e40af;
            margin-top: 4px;

            .sub-text {
              font-size: 0.78rem;
              color: #64748b;
              font-weight: normal;
              margin-left: 4px;
            }
          }
        }
      }

      .tier-savings-banner {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        color: #1e40af;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 0.8rem;
        font-weight: 600;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #2563eb;
        }

        &.neutral {
          background: #f8fafc;
          border-color: #e2e8f0;
          color: #475569;
          mat-icon { color: #64748b; }
        }
      }

      .tier-features {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;

        li {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.84rem;
          color: #334155;

          mat-icon { font-size: 16px; width: 16px; height: 16px; color: #16a34a; flex-shrink: 0; }
        }
      }

      .tier-action-btn {
        height: 44px;
        border-radius: 9px;
        font-weight: 700;
        font-size: 0.88rem;

        &.prominent {
          background: #2563eb;
          color: #ffffff;
        }
      }
    }
  `]
})
export class SubscriptionComponent implements OnInit {
  private tenantService = inject(TenantService);
  private fb = inject(FormBuilder);
  readonly authService = inject(AuthService);

  subData: MySubscriptionDto | null = null;
  pricingConfig: SubscriptionPricingConfig | null = null;
  pricingForm!: FormGroup;
  savingPricing = false;
  selectedBillingCycle: 'Annual' | 'Monthly' = 'Annual';
  loading = false;

  get isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
  }

  private dialog = inject(MatDialog);
  private confirmDialog = inject(ConfirmDialogService);

  get isExpired(): boolean {
    return this.subData?.isSubscriptionExpired === true ||
           this.subData?.subscriptionStatus === 'Expired' ||
           (this.subData?.subscriptionPlan === 'FreeTrial' && this.trialDaysRemaining <= 0);
  }

  get isTrial(): boolean {
    return !this.isExpired && (this.subData?.subscriptionPlan === 'FreeTrial' || this.subData?.subscriptionStatus === 'TrialActive');
  }

  get trialDaysRemaining(): number {
    if (this.subData?.trialDaysLeft !== undefined && this.subData?.trialDaysLeft !== null) {
      return this.subData.trialDaysLeft;
    }
    if (this.subData?.trialEndDate) {
      const diff = Math.ceil((new Date(this.subData.trialEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(0, diff);
    }
    return 90;
  }

  get studentUsagePercent(): number {
    if (!this.subData || !this.subData.maxStudentsLimit) return 0;
    return Math.min(100, Math.round((this.subData.studentCount / this.subData.maxStudentsLimit) * 100));
  }

  get branchUsagePercent(): number {
    if (!this.subData || !this.subData.maxBranchesLimit) return 0;
    return Math.min(100, Math.round((this.subData.branchCount / this.subData.maxBranchesLimit) * 100));
  }

  tenants: TenantDto[] = [];
  selectedTenantId: string | null = null;

  ngOnInit(): void {
    this.pricingForm = this.fb.group({
      planName: ['Premium Enterprise Edition', Validators.required],
      trialDurationDays: [90, [Validators.required, Validators.min(1)]],
      trialFee: [3000, [Validators.required, Validators.min(0)]],
      annualOneTimePrice: [10000, [Validators.required, Validators.min(0)]],
      monthlyRate: [1000, [Validators.required, Validators.min(0)]],
      annualMonthlyTotal: [12000, [Validators.required, Validators.min(0)]],
      softwareSetupFee: [15000, [Validators.required, Validators.min(0)]],
      maxStudentsLimit: [1000, [Validators.required, Validators.min(1)]],
      maxBranchesLimit: [5, [Validators.required, Validators.min(1)]]
    });

    if (this.isSuperAdmin) {
      this.tenantService.getAllTenants().subscribe({
        next: (list: TenantDto[]) => {
          this.tenants = list || [];
        }
      });
    }

    this.loadSubscription();
    this.loadPricingConfig();
  }

  loadPricingConfig(): void {
    this.tenantService.getSubscriptionPricingConfig().subscribe({
      next: (cfg) => {
        if (cfg) {
          this.pricingConfig = cfg;
          this.pricingForm.patchValue({
            planName: cfg.planName || 'Premium Enterprise Edition',
            trialDurationDays: cfg.trialDurationDays || 90,
            trialFee: cfg.trialFee ?? 3000,
            annualOneTimePrice: cfg.annualOneTimePrice ?? 10000,
            monthlyRate: cfg.monthlyRate ?? 1000,
            annualMonthlyTotal: cfg.annualMonthlyTotal ?? 12000,
            softwareSetupFee: cfg.softwareSetupFee ?? 15000,
            maxStudentsLimit: cfg.maxStudentsLimit ?? 1000,
            maxBranchesLimit: cfg.maxBranchesLimit ?? 5
          });
        }
      },
      error: (err) => console.error('Failed to load pricing config:', err)
    });
  }

  savePricingConfig(): void {
    if (this.pricingForm.invalid) {
      this.confirmDialog.alert('Invalid Form', 'Please enter valid positive amounts and numbers.', 'warning');
      return;
    }

    this.confirmDialog.confirm(
      'Confirm SaaS Pricing Update',
      'Are you sure you want to save and update the SaaS pricing configuration? The new trial duration, trial fee, annual, and monthly pricing will update dynamically across all institute registrations and subscription renewal portals.',
      'Yes, Save Configuration',
      'Cancel',
      'info'
    ).subscribe((confirmed) => {
      if (!confirmed) return;

      this.savingPricing = true;
      const val = this.pricingForm.value;
      val.annualMonthlyTotal = (Number(val.monthlyRate) || 1000) * 12;

      this.tenantService.updateSubscriptionPricingConfig(val).subscribe({
        next: () => {
          this.savingPricing = false;
          this.loadPricingConfig();
          this.confirmDialog.alert(
            'SaaS Pricing Updated',
            'SaaS Pricing Configuration updated successfully. All customer trial and renewal portals will now dynamically reflect these prices!',
            'success'
          );
        },
        error: (err) => {
          this.savingPricing = false;
          const msg = err?.error?.message || 'Failed to update SaaS pricing configuration.';
          this.confirmDialog.alert('Error', msg, 'danger');
        }
      });
    });
  }

  loadSubscription(tenantId?: string | null): void {
    this.loading = true;
    this.tenantService.getMySubscription(tenantId || undefined).subscribe({
      next: (data) => {
        this.subData = data;
        if (data.pricingConfig) {
          this.pricingConfig = data.pricingConfig;
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load subscription info:', err);
        this.loading = false;
      }
    });
  }

  onTenantScopeChange(tenantId: string | null): void {
    this.selectedTenantId = tenantId;
    this.loadSubscription(tenantId);
  }

  openSuperAdminManageDialog(tier?: string): void {
    if (!this.subData) return;
    const dialogRef = this.dialog.open(ManageSubscriptionDialogComponent, {
      width: '600px',
      maxWidth: '96vw',
      data: {
        ...this.subData,
        subscriptionPlan: tier || this.subData.subscriptionPlan
      }
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res?.updated) {
        this.loadSubscription(this.selectedTenantId);
        const msg = res?.res?.message || 'Subscription validity and plan updated successfully!';
        this.confirmDialog.alert('Subscription Updated', msg, 'success');
      }
    });
  }

  openRenewalDialog(tier = 'Annual'): void {
    const dialogRef = this.dialog.open(SubscriptionRenewalDialogComponent, {
      width: '600px',
      maxWidth: '95vw',
      data: {
        subData: this.subData,
        pricingConfig: this.pricingConfig,
        initialCycle: tier === 'Monthly' ? 'Monthly' : 'Annual'
      }
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res?.renewedTier) {
        this.loadSubscription(this.selectedTenantId);
        this.confirmDialog.alert(
          'Renewal Submitted',
          `Your ${res.billingCycle} renewal request (₹${res.amount?.toLocaleString('en-IN')}) has been registered. Platform SuperAdmin has been notified for immediate activation!`,
          'success'
        );
      }
    });
  }

  contactForUpgrade(tier = 'Annual'): void {
    if (this.isSuperAdmin) {
      this.openSuperAdminManageDialog('Premium');
    } else {
      this.openRenewalDialog(tier);
    }
  }
}
