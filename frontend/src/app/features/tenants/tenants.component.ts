import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { TenantService, TenantDto, CreateTenantDto, UpdateTenantDto } from '../../core/services/tenant.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-tenants',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatInputModule,
    MatFormFieldModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatAutocompleteModule
  ],
  template: `
    <div class="tenants-wrapper">
      <!-- Header Section -->
      <div class="page-header">
        <div class="header-titles">
          <h2 class="page-title">{{ isSuperAdmin ? 'Coaching Institutes &amp; Tenants Management' : 'My Institute Profile &amp; Settings' }}</h2>
          <p class="page-subtitle">{{ isSuperAdmin ? 'Platform SaaS provisioning, multi-tenant instances, subscription tiers, student quotas, and module licensing.' : 'Manage your institute profile, contact branding, campus branches, and view subscription entitlements.' }}</p>
        </div>
        <button mat-raised-button color="primary" class="add-btn" (click)="openCreateModal()" *ngIf="isSuperAdmin">
          <mat-icon>add_business</mat-icon>
          <span>Provision New Institute</span>
        </button>
      </div>

      <!-- KPI Summary Cards - Super Admin View -->
      <div class="kpi-container" *ngIf="isSuperAdmin">
        <mat-card class="kpi-card blue">
          <div class="kpi-inner">
            <div>
              <span class="kpi-label">Total Institutes</span>
              <span class="kpi-val">{{ tenants.length }}</span>
            </div>
            <div class="kpi-icon-box">
              <mat-icon>corporate_fare</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card emerald">
          <div class="kpi-inner">
            <div>
              <span class="kpi-label">Active Tenants</span>
              <span class="kpi-val">{{ activeCount }}</span>
            </div>
            <div class="kpi-icon-box">
              <mat-icon>check_circle</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card violet">
          <div class="kpi-inner">
            <div>
              <span class="kpi-label">Total Students Across SaaS</span>
              <span class="kpi-val">{{ totalStudents }}</span>
            </div>
            <div class="kpi-icon-box">
              <mat-icon>school</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card amber">
          <div class="kpi-inner">
            <div>
              <span class="kpi-label">Active Batches Total</span>
              <span class="kpi-val">{{ totalBatches }}</span>
            </div>
            <div class="kpi-icon-box">
              <mat-icon>groups</mat-icon>
            </div>
          </div>
        </mat-card>
      </div>

      <!-- KPI Summary Cards - Institute Admin View -->
      <div class="kpi-container" *ngIf="!isSuperAdmin">
        <mat-card class="kpi-card blue">
          <div class="kpi-inner">
            <div>
              <span class="kpi-label">Current Plan</span>
              <span class="kpi-val" style="font-size:1.35rem;">{{ currentTenantPlan }}</span>
            </div>
            <div class="kpi-icon-box">
              <mat-icon>workspace_premium</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card emerald">
          <div class="kpi-inner">
            <div>
              <span class="kpi-label">Student Quota Used</span>
              <span class="kpi-val">{{ totalStudents }} / {{ currentMaxStudents }}</span>
            </div>
            <div class="kpi-icon-box">
              <mat-icon>school</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card violet">
          <div class="kpi-inner">
            <div>
              <span class="kpi-label">Active Batches</span>
              <span class="kpi-val">{{ totalBatches }}</span>
            </div>
            <div class="kpi-icon-box">
              <mat-icon>groups</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card amber">
          <div class="kpi-inner">
            <div>
              <span class="kpi-label">Subscription Status</span>
              <span class="kpi-val" style="font-size:1.25rem;">{{ currentTenantStatus }}</span>
            </div>
            <div class="kpi-icon-box">
              <mat-icon>verified</mat-icon>
            </div>
          </div>
        </mat-card>
      </div>

      <!-- Search & Controls Bar -->
      <div class="controls-bar" *ngIf="isSuperAdmin || filteredTenants.length > 1">
        <div class="search-box">
          <mat-icon class="search-icon">search</mat-icon>
          <input type="text" placeholder="Search institute name or code..." [(ngModel)]="searchQuery" (input)="filterTenants()">
        </div>
        <button mat-stroked-button (click)="loadTenants()" class="refresh-btn" matTooltip="Refresh institutes list">
          <mat-icon [class.spin]="loading">sync</mat-icon>
          <span>Refresh</span>
        </button>
      </div>

      <!-- Institutes Grid -->
      <div class="tenants-grid" *ngIf="!loading || tenants.length > 0">
        <mat-card *ngFor="let t of filteredTenants" class="tenant-card mat-elevation-z2" [class.inactive-card]="!t.isActive">
          <div class="card-top-bar">
            <span class="code-pill">{{ t.code }}</span>
            <span class="status-badge" [class.active]="t.isActive" [class.inactive]="!t.isActive">
              {{ t.isActive ? 'Active' : 'Suspended' }}
            </span>
          </div>

          <div class="institute-identity">
            <div class="logo-box">
              <img *ngIf="t.profilePhoto" [src]="getPhotoUrl(t.profilePhoto)" [alt]="t.name" class="logo-img">
              <mat-icon *ngIf="!t.profilePhoto" class="default-logo-icon">account_balance</mat-icon>
            </div>
            <div class="name-meta">
              <h3 class="institute-name" [matTooltip]="t.name">{{ t.name }}</h3>
              <span class="created-meta">Registered {{ t.createdAt | date:'mediumDate' }}</span>
            </div>
          </div>

          <div class="info-list">
            <div class="info-item">
              <mat-icon class="item-icon">phone</mat-icon>
              <span>{{ t.contactPhone || 'No contact phone' }}</span>
            </div>
            <div class="info-item">
              <mat-icon class="item-icon">location_on</mat-icon>
              <span class="address-text" [matTooltip]="t.address || ''">{{ t.address || 'Address not configured' }}</span>
            </div>
          </div>

          <div class="metrics-strip">
            <div class="metric-cell">
              <span class="metric-count">{{ t.studentCount }}</span>
              <span class="metric-lbl">Students</span>
            </div>
            <div class="metric-divider"></div>
            <div class="metric-cell">
              <span class="metric-count">{{ t.batchCount }}</span>
              <span class="metric-lbl">Batches</span>
            </div>
            <div class="metric-divider"></div>
            <div class="metric-cell">
              <span class="metric-count">
                <mat-icon class="wa-icon" [class.wa-ready]="!!t.whatsAppPhoneId">
                  {{ t.whatsAppPhoneId ? 'verified' : 'pending' }}
                </mat-icon>
              </span>
              <span class="metric-lbl">WhatsApp</span>
            </div>
            <div class="metric-divider"></div>
            <div class="metric-cell" [matTooltip]="t.upiId ? 'UPI Active: ' + t.upiId : 'UPI Gateway Not Configured'">
              <span class="metric-count">
                <mat-icon class="upi-status-icon" [style.color]="t.upiId && t.upiQrEnabled !== false ? '#16a34a' : '#94a3b8'">
                  {{ t.upiId && t.upiQrEnabled !== false ? 'qr_code_2' : 'qr_code_scanner' }}
                </mat-icon>
              </span>
              <span class="metric-lbl">UPI Pay</span>
            </div>
          </div>

          <!-- Subscription Plan & Quota Details Strip -->
          <div class="subscription-strip" style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0; padding:8px 12px; border-radius:8px; margin: 4px 0 6px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <mat-icon style="font-size:18px; width:18px; height:18px; color:#2563eb;">verified_user</mat-icon>
              <strong style="color:#1e3a8a; font-size:12px;">{{ t.subscriptionPlan || 'FreeTrial' }}</strong>
              <span [style.background]="t.subscriptionStatus === 'Active' ? '#dcfce7' : '#e0f2fe'"
                    [style.color]="t.subscriptionStatus === 'Active' ? '#15803d' : '#0369a1'"
                    style="font-size:10px; font-weight:700; padding:2px 6px; border-radius:12px;">
                {{ t.subscriptionStatus || 'TrialActive' }}
              </span>
            </div>
            <span *ngIf="t.trialEndDate" style="font-size:11px; color:#64748b; font-weight:600;">
              {{ getTrialDaysText(t) }}
            </span>
          </div>

          <div class="tenant-limits-row">
            <span class="limit-badge">
              <mat-icon>groups</mat-icon>
              <span>Max Students: <strong>{{ t.maxStudentsLimit || 50 }}</strong></span>
            </span>
            <span class="limit-badge">
              <mat-icon>apartment</mat-icon>
              <span>Max Branches: <strong>{{ t.maxBranchesLimit || 2 }}</strong></span>
            </span>
          </div>

          <div class="tenant-modules-strip">
            <span *ngIf="isTenantModuleActive(t, 'school')" class="mod-pill school" matTooltip="School Module Active">
              <mat-icon>school</mat-icon>
              <span>School</span>
            </span>
            <span *ngIf="isTenantModuleActive(t, 'coaching')" class="mod-pill coaching" matTooltip="Coaching Module Active">
              <mat-icon>menu_book</mat-icon>
              <span>Coaching</span>
            </span>
            <span *ngIf="isTenantModuleActive(t, 'hostel')" class="mod-pill hostel" matTooltip="Hostel Module Active">
              <mat-icon>hotel</mat-icon>
              <span>Hostel</span>
            </span>
            <span *ngIf="isTenantModuleActive(t, 'library')" class="mod-pill library" matTooltip="Library Module Active">
              <mat-icon>local_library</mat-icon>
              <span>Library</span>
            </span>
            <span *ngIf="isTenantModuleActive(t, 'transport')" class="mod-pill transport" matTooltip="Transport Module Active">
              <mat-icon>directions_bus</mat-icon>
              <span>Transport</span>
            </span>
          </div>

          <div class="card-actions">
            <button mat-stroked-button color="primary" class="edit-btn" (click)="openEditModal(t)">
              <mat-icon>edit</mat-icon>
              <span>{{ isSuperAdmin ? 'Configure Institute' : 'Edit Profile' }}</span>
            </button>
            <button mat-stroked-button class="upi-action-btn" (click)="openUpiModal(t)" matTooltip="Configure Zero-Fee Dynamic UPI QR &amp; VPA">
              <mat-icon class="upi-btn-icon">qr_code_2</mat-icon>
              <span>UPI Gateway</span>
            </button>
            <button *ngIf="isSuperAdmin" mat-button [color]="t.isActive ? 'warn' : 'accent'" (click)="toggleStatus(t)">
              <mat-icon>{{ t.isActive ? 'pause_circle' : 'play_circle' }}</mat-icon>
              <span>{{ t.isActive ? 'Deactivate' : 'Activate' }}</span>
            </button>
          </div>
        </mat-card>

        <div *ngIf="filteredTenants.length === 0 && !loading" class="empty-state">
          <mat-icon class="empty-icon">domain_disabled</mat-icon>
          <h3>No Coaching Institutes Found</h3>
          <p>No institutes match your search or no tenants have been provisioned yet.</p>
          <button mat-raised-button color="primary" (click)="openCreateModal()" *ngIf="isSuperAdmin">Provision First Institute</button>
        </div>
      </div>

      <!-- Create / Edit Modal Backdrop (Clicks outside do NOT close modal to prevent accidental data loss) -->
      <div class="modal-backdrop" *ngIf="showModal">
        <div class="modal-dialog" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title-group">
              <div class="header-icon-box" [style.background]="activeModalTab === 'upi' ? '#059669' : '#2563eb'">
                <mat-icon *ngIf="!isEditing">add_business</mat-icon>
                <mat-icon *ngIf="isEditing && activeModalTab === 'profile'">business</mat-icon>
                <mat-icon *ngIf="isEditing && activeModalTab === 'upi'">qr_code_2</mat-icon>
                <mat-icon *ngIf="isEditing && activeModalTab === 'whatsapp'">chat</mat-icon>
                <mat-icon *ngIf="isEditing && activeModalTab === 'modules'">hub</mat-icon>
              </div>
              <div class="modal-title-texts">
                <h3 *ngIf="!isEditing">Provision New Institute</h3>
                <h3 *ngIf="isEditing && activeModalTab === 'profile'">{{ isSuperAdmin ? 'Configure Institute' : 'Edit Institute Profile' }}</h3>
                <h3 *ngIf="isEditing && activeModalTab === 'upi'">Dynamic UPI Gateway</h3>
                <h3 *ngIf="isEditing && activeModalTab === 'whatsapp'">WhatsApp API Integration</h3>
                <h3 *ngIf="isEditing && activeModalTab === 'modules'">Modules &amp; Licensing</h3>

                <p *ngIf="!isEditing">Deploy a new multi-tenant instance</p>
                <p *ngIf="isEditing && activeModalTab === 'profile'">Institute branding, contact phone &amp; campus address</p>
                <p *ngIf="isEditing && activeModalTab === 'upi'">0% fee direct bank settlements via UPI QR</p>
                <p *ngIf="isEditing && activeModalTab === 'whatsapp'">Automated digital fee receipts &amp; parent alerts</p>
                <p *ngIf="isEditing && activeModalTab === 'modules'">Manage active modules &amp; student/branch limits</p>
              </div>
            </div>
            <div class="modal-header-actions">
              <button
                *ngIf="isEditing && activeModalTab !== 'profile'"
                type="button"
                mat-stroked-button
                class="header-back-btn"
                (click)="activeModalTab = 'profile'"
                matTooltip="Return to Institute Profile">
                <mat-icon>arrow_back</mat-icon>
                <span class="back-text">Back</span>
              </button>
              <button mat-icon-button (click)="closeModal()" class="close-btn" matTooltip="Close dialog">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>

          <!-- Smart Modal Navigation Tabs (When Editing) -->
          <div class="modal-nav-tabs" *ngIf="isEditing">
            <button
              type="button"
              class="modal-tab-btn"
              [class.active]="activeModalTab === 'profile'"
              (click)="activeModalTab = 'profile'">
              <mat-icon>business</mat-icon>
              <span>Profile &amp; Contact</span>
            </button>

            <button
              type="button"
              class="modal-tab-btn upi-tab"
              [class.active]="activeModalTab === 'upi'"
              (click)="activeModalTab = 'upi'">
              <mat-icon class="tab-upi-icon">qr_code_2</mat-icon>
              <span>Dynamic UPI Gateway</span>
              <span *ngIf="tenantForm.get('upiId')?.value" class="tab-status-dot online" matTooltip="UPI Gateway Configured &amp; Active"></span>
              <span *ngIf="!tenantForm.get('upiId')?.value" class="tab-status-badge warn">Setup</span>
            </button>

            <button
              type="button"
              class="modal-tab-btn"
              [class.active]="activeModalTab === 'whatsapp'"
              (click)="activeModalTab = 'whatsapp'">
              <mat-icon>chat</mat-icon>
              <span>WhatsApp Alerts</span>
              <span *ngIf="tenantForm.get('whatsAppPhoneId')?.value" class="tab-status-dot online" matTooltip="WhatsApp Configured"></span>
            </button>

            <button
              type="button"
              class="modal-tab-btn"
              [class.active]="activeModalTab === 'modules'"
              (click)="activeModalTab = 'modules'">
              <mat-icon>hub</mat-icon>
              <span>Modules &amp; Licensing</span>
            </button>
          </div>

          <form [formGroup]="tenantForm" (ngSubmit)="saveTenant()" class="modal-body">
            <!-- TAB 1: Profile & Contact -->
            <div *ngIf="!isEditing || activeModalTab === 'profile'" class="tab-pane">
              <!-- Profile Photo Upload -->
              <div class="photo-upload-section">
                <div class="avatar-preview">
                  <img *ngIf="profilePhotoPreview" [src]="getPhotoUrl(profilePhotoPreview)" alt="Preview" class="preview-img">
                  <mat-icon *ngIf="!profilePhotoPreview" class="avatar-placeholder">add_photo_alternate</mat-icon>
                </div>
                <div class="upload-controls">
                  <label class="upload-btn">
                    <mat-icon>cloud_upload</mat-icon>
                    <span>{{ profilePhotoPreview ? 'Change Logo / Photo' : 'Upload Logo / Photo' }}</span>
                    <input type="file" accept="image/*" (change)="onFileSelected($event)" style="display:none;">
                  </label>
                  <button type="button" *ngIf="profilePhotoPreview" mat-button color="warn" class="remove-photo-btn" (click)="removePhoto()">
                    Remove
                  </button>
                  <span class="upload-hint">Recommended: Square PNG/JPG up to 2MB</span>
                </div>
              </div>

              <div class="form-grid">
                <!-- Code (Only for new) -->
                <mat-form-field appearance="outline" *ngIf="!isEditing" class="span-1">
                  <mat-label>Company / Institute Code (Unique)</mat-label>
                  <input matInput formControlName="code" placeholder="e.g. APEX, EXCEL" (input)="onCodeInput($event)">
                  <mat-icon matSuffix>vpn_key</mat-icon>
                  <mat-hint>Used by users to sign in</mat-hint>
                  <mat-error *ngIf="tenantForm.get('code')?.hasError('required')">Code is required</mat-error>
                </mat-form-field>

                <!-- Name -->
                <mat-form-field appearance="outline" [class.span-2]="isEditing" [class.span-1]="!isEditing">
                  <mat-label>Institute Name</mat-label>
                  <input matInput formControlName="name" placeholder="e.g. Apex Coaching Academy">
                  <mat-icon matSuffix>school</mat-icon>
                  <mat-error *ngIf="tenantForm.get('name')?.hasError('required')">Name is required</mat-error>
                </mat-form-field>

                <!-- Phone -->
                <mat-form-field appearance="outline" class="span-1">
                  <mat-label>Contact Phone</mat-label>
                  <input matInput formControlName="contactPhone" placeholder="e.g. +91 9876543210">
                  <mat-icon matSuffix>phone</mat-icon>
                </mat-form-field>

                <!-- Address -->
                <mat-form-field appearance="outline" class="span-1">
                  <mat-label>Address / City</mat-label>
                  <input matInput formControlName="address" placeholder="e.g. Main Road, Jnandeep Campus">
                  <mat-icon matSuffix>location_on</mat-icon>
                </mat-form-field>
              </div>
            </div>

            <!-- TAB 2: Dynamic UPI Payment Gateway -->
            <div *ngIf="isEditing && activeModalTab === 'upi'" class="tab-pane">
              <!-- Live Status & Gateway Intro Banner -->
              <div class="upi-config-banner">
                <div class="upi-banner-icon">
                  <mat-icon>{{ tenantForm.get('upiId')?.value ? 'verified' : 'account_balance_wallet' }}</mat-icon>
                </div>
                <div class="upi-banner-text">
                  <div class="upi-banner-header">
                    <strong>Zero-Cost Bharat Dynamic UPI Gateway (Direct Bank-to-Bank)</strong>
                    <span class="upi-live-badge" [class.active]="!!tenantForm.get('upiId')?.value">
                      <mat-icon style="font-size:12px; width:12px; height:12px; vertical-align:middle; margin-right:3px;">{{ tenantForm.get('upiId')?.value ? 'check_circle' : 'pending' }}</mat-icon><span>{{ tenantForm.get('upiId')?.value ? 'Active: ' + tenantForm.get('upiId')?.value : 'Setup Required' }}</span>
                    </span>
                  </div>
                  <p>All student fee payments made via GPay, PhonePe, Paytm, or BHIM settle <strong>instantly into your institute bank account</strong> with zero middleman gateway commission.</p>
                </div>
              </div>

              <!-- Two-Column Layout for Spacious Wide Popup -->
              <div class="upi-two-col-layout">
                <!-- Left Column: Inputs & Controls -->
                <div class="upi-col-fields">
                  <!-- Institute VPA -->
                  <mat-form-field appearance="outline" class="w-100">
                    <mat-label>Institute / Campus UPI ID (VPA)</mat-label>
                    <input
                      matInput
                      formControlName="upiId"
                      placeholder="e.g. jnandeep@sbi or 8088377282@ybl"
                      autocomplete="off"
                    />
                    <mat-icon matPrefix class="field-icon">alternate_email</mat-icon>
                    <mat-hint>The official UPI ID linked directly to your school/coaching bank account</mat-hint>
                  </mat-form-field>

                  <div class="form-grid-inner">
                    <!-- Payee Display Name -->
                    <mat-form-field appearance="outline">
                      <mat-label>Payee / Merchant Business Name</mat-label>
                      <input
                        matInput
                        formControlName="upiMerchantName"
                        placeholder="e.g. Jnandeep Campus"
                        autocomplete="off"
                      />
                      <mat-icon matPrefix class="field-icon">business</mat-icon>
                      <mat-hint>Verified name on payer app</mat-hint>
                    </mat-form-field>

                    <!-- MCC Code (Locked to 8211) -->
                    <mat-form-field appearance="outline">
                      <mat-label>Merchant Category Code (MCC)</mat-label>
                      <input
                        matInput
                        formControlName="upiMerchantCode"
                        placeholder="8211"
                        [readonly]="true"
                      />
                      <mat-icon matSuffix matTooltip="Locked to 8211 (Official NPCI Standard Code for Educational Services)" style="font-size:18px; color:#64748b;">lock</mat-icon>
                      <mat-hint class="single-line-hint" matTooltip="Official NPCI Standard Code (Fixed: 8211)">Official NPCI Standard Code (Fixed: 8211)</mat-hint>
                    </mat-form-field>
                  </div>

                  <!-- Company Settlement Bank Account Details (Mapped to Tenant & Branches) -->
                  <div class="bank-account-setup-card">
                    <div class="bank-card-header">
                      <div class="header-left">
                        <mat-icon class="bank-card-icon">account_balance</mat-icon>
                        <div class="header-titles">
                          <strong class="title">Company Settlement Bank Account</strong>
                          <span class="sub">Official Institute Bank details for NPCI direct settlements &amp; audit records</span>
                        </div>
                      </div>
                      <span class="verified-pill" *ngIf="tenantForm.get('bankAccountNumber')?.value && !tenantForm.get('bankAccountNumber')?.invalid">
                        <mat-icon style="font-size:13px; width:13px; height:13px; vertical-align:middle; margin-right:3px;">check_circle</mat-icon>
                        <span>Standard Verified</span>
                      </span>
                    </div>

                    <div class="form-grid-inner">
                      <!-- Bank Name with Autocomplete of Popular Indian Banks -->
                      <mat-form-field appearance="outline">
                        <mat-label>Bank Name</mat-label>
                        <input
                          matInput
                          formControlName="bankName"
                          placeholder="e.g. State Bank of India"
                          [matAutocomplete]="autoBank"
                          autocomplete="off"
                        />
                        <mat-icon matPrefix class="field-icon">account_balance</mat-icon>
                        <mat-autocomplete #autoBank="matAutocomplete">
                          <mat-option *ngFor="let b of filteredBanks" [value]="b">{{ b }}</mat-option>
                        </mat-autocomplete>
                        <mat-hint class="single-line-hint" matTooltip="Bank where school/coaching account is maintained">Bank where account is maintained</mat-hint>
                      </mat-form-field>

                      <!-- Account Type -->
                      <mat-form-field appearance="outline">
                        <mat-label>Account Type</mat-label>
                        <mat-select formControlName="bankAccountType">
                          <mat-option value="Current">Current Account (Institutional)</mat-option>
                          <mat-option value="Savings">Savings Account</mat-option>
                          <mat-option value="OD/CC">Cash Credit / Overdraft (CC/OD)</mat-option>
                        </mat-select>
                        <mat-icon matPrefix class="field-icon">account_box</mat-icon>
                        <mat-hint class="single-line-hint" matTooltip="Institutional standard is Current A/C">Institutional standard: Current A/C</mat-hint>
                      </mat-form-field>
                    </div>

                    <div class="form-grid-inner">
                      <!-- Bank Account Number -->
                      <mat-form-field appearance="outline">
                        <mat-label>Bank Account Number</mat-label>
                        <input
                          matInput
                          formControlName="bankAccountNumber"
                          placeholder="9 to 18 digits Account No"
                          (input)="onAccountNumberInput($event)"
                          maxlength="18"
                          autocomplete="off"
                        />
                        <mat-icon matPrefix class="field-icon">credit_card</mat-icon>
                        <mat-hint class="single-line-hint" matTooltip="9 to 18 digits numeric account number">9 to 18 numeric digits</mat-hint>
                        <mat-error *ngIf="tenantForm.get('bankAccountNumber')?.hasError('pattern')">
                          Must be 9 to 18 numeric digits
                        </mat-error>
                      </mat-form-field>

                      <!-- Confirm Account Number -->
                      <mat-form-field appearance="outline">
                        <mat-label>Confirm Account Number</mat-label>
                        <input
                          matInput
                          formControlName="confirmAccountNumber"
                          placeholder="Re-enter to verify"
                          (input)="onConfirmAccountNumberInput($event)"
                          maxlength="18"
                          autocomplete="off"
                        />
                        <mat-icon matPrefix class="field-icon">verified</mat-icon>
                        <mat-hint class="single-line-hint" matTooltip="Re-type account number to prevent typo errors">Re-type to prevent typo errors</mat-hint>
                        <mat-error *ngIf="tenantForm.get('confirmAccountNumber')?.hasError('mismatch')">
                          Account numbers do not match
                        </mat-error>
                      </mat-form-field>
                    </div>

                    <div class="form-grid-inner">
                      <!-- Bank IFSC Code -->
                      <mat-form-field appearance="outline">
                        <mat-label>Bank IFSC Code</mat-label>
                        <input
                          matInput
                          formControlName="bankIfscCode"
                          placeholder="e.g. SBIN0001234"
                          (input)="onIfscInput($event)"
                          maxlength="11"
                          style="text-transform: uppercase; font-family: monospace; font-weight: 600;"
                          autocomplete="off"
                        />
                        <mat-icon matPrefix class="field-icon">pin</mat-icon>
                        <mat-hint class="single-line-hint" matTooltip="11-character RBI standard code (e.g. SBIN0001234)">11-character RBI standard code</mat-hint>
                        <mat-error *ngIf="tenantForm.get('bankIfscCode')?.hasError('pattern')">
                          Invalid IFSC (e.g. SBIN0001234)
                        </mat-error>
                      </mat-form-field>

                      <!-- Bank Branch Location -->
                      <mat-form-field appearance="outline">
                        <mat-label>Bank Branch / City</mat-label>
                        <input
                          matInput
                          formControlName="bankBranch"
                          placeholder="e.g. Main Branch, Patna"
                          autocomplete="off"
                        />
                        <mat-icon matPrefix class="field-icon">location_city</mat-icon>
                        <mat-hint class="single-line-hint" matTooltip="Bank branch location or city">Branch location or city</mat-hint>
                      </mat-form-field>
                    </div>

                    <!-- Account Holder Legal Beneficiary Name -->
                    <mat-form-field appearance="outline" class="w-100">
                      <mat-label>Account Holder / Beneficiary Name</mat-label>
                      <input
                        matInput
                        formControlName="bankAccountHolderName"
                        placeholder="e.g. Jnandeep Campus Educational Trust"
                        autocomplete="off"
                      />
                      <mat-icon matPrefix class="field-icon">badge</mat-icon>
                      <mat-hint class="single-line-hint" matTooltip="Official beneficiary legal title registered with bank">Official beneficiary title registered with bank</mat-hint>
                    </mat-form-field>
                  </div>

                  <!-- Toggles Card -->
                  <div class="toggles-card">
                    <div class="toggle-item">
                      <div class="toggle-text">
                        <strong class="toggle-title">Enable Dynamic UPI QR on Invoices &amp; Receipts</strong>
                        <p class="toggle-sub">Shows instant scan &amp; pay QR codes on student portals, fee counters, and public receipt links.</p>
                      </div>
                      <mat-slide-toggle formControlName="upiQrEnabled" color="primary"></mat-slide-toggle>
                    </div>

                    <div class="toggle-item">
                      <div class="toggle-text">
                        <strong class="toggle-title">Automated UTR Verification &amp; Instant Settlement</strong>
                        <p class="toggle-sub">When parents submit a valid 12-digit UTR, automatically clear invoice dues, settle in Day Book, and generate receipt.</p>
                      </div>
                      <mat-slide-toggle formControlName="upiAutoVerify" color="primary"></mat-slide-toggle>
                    </div>
                  </div>
                </div>

                <!-- Right Column: Interactive Live Preview Card -->
                <div class="upi-col-preview">
                  <div class="upi-preview-card">
                    <div class="preview-header">
                      <span class="preview-title">
                        <mat-icon>smartphone</mat-icon>
                        <span>Payer Screen Live Preview</span>
                      </span>
                      <span class="commission-pill">0% Fee (NPCI)</span>
                    </div>
                    <div class="preview-body">
                      <div class="preview-details">
                        <div class="preview-row">
                          <span class="lbl">Payee:</span>
                          <strong class="val">{{ tenantForm.get('upiMerchantName')?.value || tenantForm.get('name')?.value || 'Your Institute Name' }}</strong>
                        </div>
                        <div class="preview-row">
                          <span class="lbl">UPI VPA:</span>
                          <span class="vpa-tag">{{ tenantForm.get('upiId')?.value || 'upi-id@bank (enter on left)' }}</span>
                        </div>
                        <div class="preview-row">
                          <span class="lbl">Category:</span>
                          <span class="val">8211 (Educational Services)</span>
                        </div>
                        <div class="preview-row">
                          <span class="lbl">Direct Bank:</span>
                          <span class="val" style="color:#16a34a; font-weight:700;">Instant Direct Credit</span>
                        </div>
                        <div class="preview-row" *ngIf="tenantForm.get('bankName')?.value">
                          <span class="lbl">Settlement Bank:</span>
                          <span class="val" style="font-weight:600; color:#0f172a;">{{ tenantForm.get('bankName')?.value }} ({{ getMaskedAccount() }})</span>
                        </div>
                        <div class="preview-row" *ngIf="tenantForm.get('bankIfscCode')?.value">
                          <span class="lbl">Bank IFSC:</span>
                          <span class="val" style="font-family:monospace; font-weight:700; color:#1e40af;">{{ tenantForm.get('bankIfscCode')?.value }}</span>
                        </div>
                        <div class="preview-row" *ngIf="tenantForm.get('bankAccountHolderName')?.value">
                          <span class="lbl">Beneficiary:</span>
                          <span class="val" style="font-weight:600;">{{ tenantForm.get('bankAccountHolderName')?.value }}</span>
                        </div>
                      </div>

                      <div class="supported-apps">
                        <span class="apps-label">Supported Apps:</span>
                        <div class="apps-badges">
                          <span class="app-chip gpay">Google Pay</span>
                          <span class="app-chip phonepe">PhonePe</span>
                          <span class="app-chip paytm">Paytm</span>
                          <span class="app-chip bhim">BHIM UPI</span>
                          <span class="app-chip cred">CRED</span>
                          <span class="app-chip any">Any UPI App</span>
                        </div>
                      </div>

                      <div class="settlement-verified-badge" *ngIf="tenantForm.get('bankAccountNumber')?.value">
                        <mat-icon>verified_user</mat-icon>
                        <span>Direct NPCI Settlement Bank Mapped</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- TAB 3: WhatsApp Cloud API -->
            <div *ngIf="isEditing && activeModalTab === 'whatsapp'" class="tab-pane">
              <div class="wa-config-banner">
                <div class="wa-banner-icon">
                  <mat-icon>chat</mat-icon>
                </div>
                <div class="wa-banner-text">
                  <strong>Meta Cloud WhatsApp API Integration</strong>
                  <p>Send automated digital fee receipts, balance due notices, homework alerts, and exam report cards directly to parents' WhatsApp.</p>
                </div>
              </div>

              <div class="form-grid">
                <!-- WhatsApp Phone ID -->
                <mat-form-field appearance="outline" class="span-2">
                  <mat-label>WhatsApp Phone Number ID</mat-label>
                  <input matInput formControlName="whatsAppPhoneId" placeholder="e.g. 104829103982">
                  <mat-icon matPrefix>chat</mat-icon>
                  <mat-hint>Meta Cloud API Phone Number ID</mat-hint>
                </mat-form-field>

                <!-- WhatsApp Access Token -->
                <mat-form-field appearance="outline" class="span-2">
                  <mat-label>WhatsApp Permanent Access Token</mat-label>
                  <input matInput formControlName="whatsAppAccessToken" placeholder="Meta Graph API System User Token">
                  <mat-icon matPrefix>security</mat-icon>
                  <mat-hint>System User Permanent Token from Meta Business Suite</mat-hint>
                </mat-form-field>
              </div>
            </div>

            <!-- TAB 4: Modules & Licensing -->
            <div *ngIf="!isEditing || activeModalTab === 'modules'" class="tab-pane">
              <!-- ERP Module Packaging / Subscription Selection -->
              <div class="modules-setup-block" style="margin: 0 0 16px; padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
                  <h4 class="block-title" style="display:flex; align-items:center; gap:6px; margin:0; font-size:14px; font-weight:700; color:#1e3a8a;">
                    <mat-icon style="color:#2563eb; font-size:20px; width:20px; height:20px;">hub</mat-icon>
                    <span>Subscribed Modules &amp; Licensing</span>
                  </h4>
                  <span *ngIf="!isSuperAdmin" style="font-size:11px; font-weight:700; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; padding:2px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;">
                    <mat-icon style="font-size:13px; width:13px; height:13px;">lock</mat-icon> Managed by Super Admin
                  </span>
                </div>
                <p style="margin:0 0 12px; font-size:12px; color:#64748b;">
                  {{ isSuperAdmin ? 'Configure which modules are licensed for this institute. Unchecked modules will be completely hidden from their sidebar and student forms.' : 'The functional modules enabled for your institute. Contact SaaS support to subscribe to additional modules.' }}
                </p>
                
                <div class="modules-checkbox-grid">
                  <label class="module-check-card" [style.cursor]="isSuperAdmin ? 'pointer' : 'not-allowed'">
                    <input type="checkbox" formControlName="hasSchoolModule" [style.cursor]="isSuperAdmin ? 'pointer' : 'not-allowed'">
                    <mat-icon class="mod-check-icon school">school</mat-icon>
                    <span class="mod-check-label">School Module</span>
                  </label>
                  <label class="module-check-card" [style.cursor]="isSuperAdmin ? 'pointer' : 'not-allowed'">
                    <input type="checkbox" formControlName="hasCoachingModule" [style.cursor]="isSuperAdmin ? 'pointer' : 'not-allowed'">
                    <mat-icon class="mod-check-icon coaching">menu_book</mat-icon>
                    <span class="mod-check-label">Coaching Module</span>
                  </label>
                  <label class="module-check-card" [style.cursor]="isSuperAdmin ? 'pointer' : 'not-allowed'">
                    <input type="checkbox" formControlName="hasHostelModule" [style.cursor]="isSuperAdmin ? 'pointer' : 'not-allowed'">
                    <mat-icon class="mod-check-icon hostel">hotel</mat-icon>
                    <span class="mod-check-label">Hostel &amp; Residential</span>
                  </label>
                  <label class="module-check-card" [style.cursor]="isSuperAdmin ? 'pointer' : 'not-allowed'">
                    <input type="checkbox" formControlName="hasLibraryModule" [style.cursor]="isSuperAdmin ? 'pointer' : 'not-allowed'">
                    <mat-icon class="mod-check-icon library">local_library</mat-icon>
                    <span class="mod-check-label">Library Management</span>
                  </label>
                  <label class="module-check-card" [style.cursor]="isSuperAdmin ? 'pointer' : 'not-allowed'">
                    <input type="checkbox" formControlName="hasTransportModule" [style.cursor]="isSuperAdmin ? 'pointer' : 'not-allowed'">
                    <mat-icon class="mod-check-icon transport">directions_bus</mat-icon>
                    <span class="mod-check-label">Transport &amp; Fleet</span>
                  </label>
                </div>
              </div>

              <!-- Subscription Plan & Quota Tier -->
              <div class="subscription-setup-block" style="margin: 0 0 16px; padding: 14px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
                <h4 class="block-title" style="display:flex; align-items:center; gap:6px; margin:0 0 8px; font-size:14px; font-weight:700; color:#1e3a8a;">
                  <mat-icon style="color:#2563eb; font-size:20px; width:20px; height:20px;">workspace_premium</mat-icon>
                  <span>Subscription Plan &amp; Quotas</span>
                </h4>
                <p *ngIf="!isSuperAdmin" style="margin:0 0 10px; font-size:12px; color:#1e40af;">
                  Subscription tier and limits are controlled by your SaaS administrator.
                </p>

                <div class="form-grid" *ngIf="isSuperAdmin">
                  <mat-form-field appearance="outline" class="span-1">
                    <mat-label>Subscription Plan</mat-label>
                    <input matInput formControlName="subscriptionPlan" placeholder="FreeTrial, Starter, Growth, Enterprise">
                    <mat-icon matSuffix>card_membership</mat-icon>
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="span-1">
                    <mat-label>Subscription Status</mat-label>
                    <input matInput formControlName="subscriptionStatus" placeholder="TrialActive, Active, Expired">
                    <mat-icon matSuffix>verified</mat-icon>
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="span-1">
                    <mat-label>Max Students Quota</mat-label>
                    <input matInput type="number" formControlName="maxStudentsLimit" placeholder="e.g. 50">
                    <mat-icon matSuffix>school</mat-icon>
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="span-1">
                    <mat-label>Max Branches Limit</mat-label>
                    <input matInput type="number" formControlName="maxBranchesLimit" placeholder="e.g. 2">
                    <mat-icon matSuffix>apartment</mat-icon>
                  </mat-form-field>
                </div>

                <div *ngIf="!isSuperAdmin" style="display:flex; gap:16px; flex-wrap:wrap; font-size:12px; color:#1e3a8a; background:#ffffff; padding:10px 14px; border-radius:6px; border:1px solid #dbeafe;">
                  <div>Plan: <strong>{{ tenantForm.get('subscriptionPlan')?.value || 'FreeTrial' }}</strong></div>
                  <div>Status: <strong>{{ tenantForm.get('subscriptionStatus')?.value || 'TrialActive' }}</strong></div>
                  <div>Max Students: <strong>{{ tenantForm.get('maxStudentsLimit')?.value || 50 }}</strong></div>
                  <div>Max Branches: <strong>{{ tenantForm.get('maxBranchesLimit')?.value || 2 }}</strong></div>
                </div>
              </div>
            </div>

            <!-- Initial Administrator Provisioning (Only on Create) -->
            <div *ngIf="!isEditing" class="admin-setup-block">
              <h4 class="block-title">
                <mat-icon>admin_panel_settings</mat-icon>
                <span>Initial Institute Director / Admin Credentials</span>
              </h4>
              <div class="form-grid">
                <mat-form-field appearance="outline" class="span-1">
                  <mat-label>Admin Full Name</mat-label>
                  <input matInput formControlName="adminFullName" placeholder="e.g. Dr. Rajesh Sharma">
                  <mat-icon matSuffix>person</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline" class="span-1">
                  <mat-label>Admin Username</mat-label>
                  <input matInput formControlName="adminUsername" placeholder="e.g. admin">
                  <mat-icon matSuffix>badge</mat-icon>
                  <mat-error *ngIf="tenantForm.get('adminUsername')?.hasError('required')">Username required</mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" class="span-2">
                  <mat-label>Initial Admin Password</mat-label>
                  <input matInput type="password" formControlName="adminPassword" placeholder="Minimum 6 characters">
                  <mat-icon matSuffix>lock</mat-icon>
                  <mat-error *ngIf="tenantForm.get('adminPassword')?.hasError('required')">Password required</mat-error>
                </mat-form-field>
              </div>
            </div>

            <!-- Initial Branches Provisioning (Only on Create) -->
            <div *ngIf="!isEditing" class="branches-setup-block">
              <div class="block-title-row">
                <h4 class="block-title">
                  <mat-icon>store</mat-icon>
                  <span>Institute Branches (Multi-Branch Setup)</span>
                </h4>
                <button type="button" mat-stroked-button color="primary" class="add-branch-btn" (click)="addBranchRow(false)">
                  <mat-icon>add</mat-icon>
                  <span>Add Branch</span>
                </button>
              </div>
              <p class="block-desc">Configure the initial branches for this institute (e.g. Main Branch, Delhi, Patna). You can add more later.</p>

              <div formArrayName="branches" class="branches-list">
                <div *ngFor="let br of branchesFormArray.controls; let i = index" [formGroupName]="i" class="branch-row-card">
                  <div class="branch-row-header">
                    <span class="branch-row-badge" [class.main-badge]="br.get('isMainBranch')?.value">
                      <mat-icon>{{ br.get('isMainBranch')?.value ? 'star' : 'apartment' }}</mat-icon>
                      {{ br.get('isMainBranch')?.value ? 'Main Branch (HQ)' : 'Branch #' + (i + 1) }}
                    </span>
                    <button type="button" mat-icon-button color="warn" (click)="removeBranchRow(i)" *ngIf="branchesFormArray.length > 1" matTooltip="Remove branch">
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  </div>
                  <div class="form-grid">
                    <mat-form-field appearance="outline" class="span-1">
                      <mat-label>Branch Name *</mat-label>
                      <input matInput formControlName="name" placeholder="e.g. Delhi Branch">
                      <mat-error *ngIf="br.get('name')?.hasError('required')">Branch name required</mat-error>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="span-1">
                      <mat-label>Branch Code *</mat-label>
                      <input matInput formControlName="code" placeholder="e.g. DEL" (input)="onBranchCodeInput($event, i)">
                      <mat-error *ngIf="br.get('code')?.hasError('required')">Code required</mat-error>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="span-1">
                      <mat-label>Contact Phone</mat-label>
                      <input matInput formControlName="contactPhone" placeholder="Branch phone">
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="span-1">
                      <mat-label>Branch Address</mat-label>
                      <input matInput formControlName="address" placeholder="e.g. Connaught Place, New Delhi">
                    </mat-form-field>
                  </div>
                </div>
              </div>
            </div>

            <div *ngIf="formError" class="modal-error">
              <mat-icon>error</mat-icon>
              <span>{{ formError }}</span>
            </div>

            <div class="modal-footer">
              <button
                type="button"
                mat-stroked-button
                color="primary"
                class="back-to-profile-btn"
                *ngIf="isEditing && activeModalTab !== 'profile'"
                (click)="activeModalTab = 'profile'">
                <mat-icon>arrow_back</mat-icon>
                <span>Back to Profile</span>
              </button>
              <div class="footer-right-actions">
                <button type="button" mat-button (click)="onCancel()">{{ (isEditing && activeModalTab !== 'profile') ? 'Back' : 'Cancel' }}</button>
                <button type="submit" mat-raised-button color="primary" [disabled]="tenantForm.invalid || formSaving" (click)="saveTenant()">
                  <mat-spinner diameter="18" *ngIf="formSaving" style="display:inline-block; margin-right:6px;"></mat-spinner>
                  <span>{{ isEditing ? 'Save Changes' : 'Provision Institute' }}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .tenants-wrapper {
      padding: 0 0 40px;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 20px;
      box-sizing: border-box;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;

      .header-titles {
        .page-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
          color: #1976d2;
          letter-spacing: -0.01em;
        }
        .page-subtitle {
          color: #64748b;
          margin: 4px 0 0 0;
          font-size: 0.9rem;
        }
      }

      .add-btn {
        height: 42px;
        font-weight: 600;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
    }

    .kpi-container {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;

      @media (max-width: 1024px) {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
      @media (max-width: 640px) {
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }
    }

    .kpi-card {
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06) !important;
      border: 1px solid #e2e8f0;

      .kpi-inner {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .kpi-label { font-size: 0.78rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
      .kpi-val { font-size: 1.7rem; font-weight: 800; color: #0f172a; display: block; margin-top: 4px; }

      .kpi-icon-box {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }

      &.blue { .kpi-icon-box { background: #eff6ff; color: #2563eb; } }
      &.emerald { .kpi-icon-box { background: #ecfdf5; color: #059669; } }
      &.violet { .kpi-icon-box { background: #f5f3ff; color: #7c3aed; } }
      &.amber { .kpi-icon-box { background: #fffbeb; color: #d97706; } }

      @media (max-width: 640px) {
        padding: 12px 12px;

        .kpi-label { font-size: 0.65rem; letter-spacing: 0.02em; }
        .kpi-val { font-size: 1.22rem !important; margin-top: 2px; }
        .kpi-icon-box {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
        }
      }
    }

    .controls-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;

      .search-box {
        display: flex;
        align-items: center;
        gap: 10px;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        padding: 0 16px;
        width: 380px;
        height: 42px;

        .search-icon { color: #94a3b8; font-size: 20px; width: 20px; height: 20px; }
        input {
          border: none;
          outline: none;
          font-size: 0.88rem;
          width: 100%;
          color: #1e293b;
          font-family: inherit;
        }
      }

      .refresh-btn {
        height: 42px;
        border-radius: 9px;
        font-weight: 600;
        mat-icon.spin { animation: spin 1s infinite linear; }
      }
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    .tenants-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 20px;
    }

    .tenant-card {
      border-radius: 14px;
      padding: 20px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      display: flex;
      flex-direction: column;
      gap: 14px;

      &:hover {
        transform: translateY(-3px);
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08) !important;
      }

      &.inactive-card {
        opacity: 0.75;
        background: #f8fafc;
      }
    }

    .card-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .code-pill {
        background: #dbeafe;
        color: #1e40af;
        font-weight: 800;
        font-size: 0.8rem;
        padding: 3px 10px;
        border-radius: 7px;
        letter-spacing: 0.05em;
      }

      .status-badge {
        font-size: 0.75rem;
        font-weight: 700;
        padding: 3px 9px;
        border-radius: 10px;

        &.active { background: #dcfce7; color: #15803d; }
        &.inactive { background: #fee2e2; color: #b91c1c; }
      }
    }

    .institute-identity {
      display: flex;
      align-items: center;
      gap: 14px;

      .logo-box {
        width: 52px;
        height: 52px;
        border-radius: 12px;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;

        .logo-img { width: 100%; height: 100%; object-fit: cover; }
        .default-logo-icon { color: #64748b; font-size: 28px; width: 28px; height: 28px; }
      }

      .name-meta {
        overflow: hidden;
        .institute-name {
          font-size: 1.05rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .created-meta { font-size: 0.75rem; color: #94a3b8; }
      }
    }

    .info-list {
      display: flex;
      flex-direction: column;
      gap: 6px;

      .info-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.82rem;
        color: #475569;

        .item-icon { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; }
        .address-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 260px;
        }
      }
    }

    .metrics-strip {
      display: flex;
      align-items: center;
      justify-content: space-around;
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 10px;
      padding: 10px 8px;

      .metric-cell {
        display: flex;
        flex-direction: column;
        align-items: center;

        .metric-count { font-size: 1.1rem; font-weight: 800; color: #1e293b; }
        .metric-lbl { font-size: 0.7rem; font-weight: 600; color: #64748b; text-transform: uppercase; }

        .wa-icon { font-size: 18px; width: 18px; height: 18px; color: #94a3b8; }
        .wa-icon.wa-ready { color: #16a34a; }
      }

      .metric-divider {
        width: 1px;
        height: 24px;
        background: #e2e8f0;
      }
    }

    .tenant-limits-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      font-size: 0.78rem;
      color: #475569;
      padding: 0 2px;
      flex-wrap: wrap;

      .limit-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: #f8fafc;
        border: 1px solid #f1f5f9;
        padding: 3px 8px;
        border-radius: 6px;
        mat-icon { font-size: 15px; width: 15px; height: 15px; color: #64748b; }
        strong { color: #1e293b; font-weight: 700; }
      }
    }

    .tenant-modules-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 4px 0 10px;
      padding: 8px 10px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #f1f5f9;

      .mod-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.72rem;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 6px;
        transition: all 0.15s ease;

        mat-icon { font-size: 14px; width: 14px; height: 14px; }

        &.school { background: #dbeafe; color: #1e40af; mat-icon { color: #1e40af; } }
        &.coaching { background: #fef3c7; color: #92400e; mat-icon { color: #92400e; } }
        &.hostel { background: #ede9fe; color: #5b21b6; mat-icon { color: #5b21b6; } }
        &.library { background: #dcfce7; color: #166534; mat-icon { color: #166534; } }
        &.transport { background: #fce7f3; color: #9d174d; mat-icon { color: #9d174d; } }
      }
    }

    .card-actions {
      display: flex;
      gap: 8px;
      margin-top: 4px;
      flex-wrap: wrap;

      button {
        border-radius: 8px;
        font-size: 0.82rem;
        font-weight: 600;
        height: 36px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }

      .edit-btn {
        flex: 1 1 130px;
        min-width: 120px;
      }

      .upi-action-btn {
        flex: 1 1 130px;
        min-width: 120px;
        color: #059669;
        border-color: #059669;
        .upi-btn-icon { color: #059669; }
        &:hover { background: #f0fdf4; border-color: #047857; }
      }
    }

    .modules-checkbox-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 10px;

      .module-check-card {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        transition: all 0.15s ease;

        input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: #2563eb;
        }

        .mod-check-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          &.school { color: #2563eb; }
          &.coaching { color: #d97706; }
          &.hostel { color: #7c3aed; }
          &.library { color: #059669; }
          &.transport { color: #db2777; }
        }

        .mod-check-label {
          font-size: 0.82rem;
          font-weight: 600;
          color: #1e293b;
        }

        &:hover {
          border-color: #93c5fd;
          background: #f8fafc;
        }
      }
    }

    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;

      @media (max-width: 640px) {
        padding: 6px;
      }
    }

    .modal-dialog {
      background: #ffffff;
      border-radius: 16px;
      width: 95vw;
      max-width: 1240px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 25px 60px rgba(15, 23, 42, 0.25);
      display: flex;
      flex-direction: column;

      @media (max-width: 640px) {
        width: 100%;
        max-width: 100%;
        max-height: 96vh;
        border-radius: 12px;
      }
    }

    /* Modal Navigation Tabs */
    .modal-nav-tabs {
      display: flex;
      gap: 8px;
      padding: 10px 24px 0 24px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      overflow-x: auto;
      scrollbar-width: none;
      &::-webkit-scrollbar { display: none; }
      -webkit-overflow-scrolling: touch;

      .modal-tab-btn {
        border: none;
        background: transparent;
        padding: 9px 14px;
        border-radius: 8px 8px 0 0;
        font-size: 0.85rem;
        font-weight: 600;
        color: #64748b;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        transition: all 0.2s ease;
        border-bottom: 2px solid transparent;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }

        .tab-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          margin-left: 2px;
          display: inline-block;
          &.online { background: #10b981; box-shadow: 0 0 6px rgba(16, 185, 129, 0.5); }
        }

        .tab-status-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 10px;
          margin-left: 4px;
          &.warn { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
        }

        &:hover {
          color: #1e293b;
          background: #f1f5f9;
        }

        &.active {
          color: #2563eb;
          font-weight: 700;
          background: #ffffff;
          border-bottom: 2px solid #2563eb;
        }

        &.upi-tab.active {
          color: #059669;
          border-bottom-color: #059669;
          .tab-upi-icon { color: #059669; }
        }
      }

      @media (max-width: 640px) {
        padding: 8px 12px 0 12px;
        gap: 4px;

        .modal-tab-btn {
          padding: 8px 10px;
          font-size: 0.76rem;
          gap: 4px;
          mat-icon { font-size: 15px; width: 15px; height: 15px; }
        }
      }
    }

    .tab-pane {
      display: flex;
      flex-direction: column;
      gap: 16px;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .upi-config-banner, .wa-config-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 10px;

      mat-icon { font-size: 22px; width: 22px; height: 22px; }
      strong { font-size: 0.88rem; display: block; margin-bottom: 2px; }
      p { font-size: 0.78rem; margin: 0; line-height: 1.35; }
    }

    .upi-config-banner {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      .upi-banner-icon { color: #16a34a; }
      .upi-banner-text { width: 100%; }
      .upi-banner-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 2px;
      }
      .upi-live-badge {
        font-size: 0.72rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 12px;
        background: #e2e8f0;
        color: #475569;
        &.active {
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }
      }
      strong { color: #14532d; }
      p { color: #15803d; }
    }

    /* Smart Live Preview Card */
    .upi-preview-card {
      background: #ffffff;
      border: 1px solid #d1fae5;
      border-radius: 12px;
      padding: 14px 16px;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.06);
      display: flex;
      flex-direction: column;
      gap: 10px;

      .preview-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;

        .preview-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          font-weight: 700;
          color: #065f46;
          mat-icon { font-size: 16px; width: 16px; height: 16px; color: #059669; }
        }

        .commission-pill {
          font-size: 0.68rem;
          font-weight: 800;
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;
          padding: 2px 8px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
      }

      .preview-body {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .preview-details {
          display: flex;
          flex-direction: column;
          gap: 6px;

          .preview-row {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.8rem;

            .lbl {
              color: #64748b;
              font-weight: 500;
              min-width: 95px;
            }

            .val {
              color: #1e293b;
            }

            .vpa-tag {
              background: #f0fdf4;
              color: #166534;
              font-weight: 700;
              font-family: monospace;
              font-size: 0.82rem;
              padding: 2px 8px;
              border-radius: 6px;
              border: 1px solid #bbf7d0;
            }
          }
        }

        .supported-apps {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 4px;
          padding-top: 8px;
          border-top: 1px dashed #e2e8f0;

          .apps-label {
            font-size: 0.72rem;
            font-weight: 600;
            color: #64748b;
          }

          .apps-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;

            .app-chip {
              font-size: 0.68rem;
              font-weight: 700;
              padding: 2px 7px;
              border-radius: 6px;

              &.gpay { background: #e8f0fe; color: #1967d2; }
              &.phonepe { background: #f3e8ff; color: #6b21a8; }
              &.paytm { background: #e0f2fe; color: #0284c7; }
              &.bhim { background: #fff7ed; color: #c2410c; }
              &.cred { background: #f1f5f9; color: #0f172a; }
              &.any { background: #f0fdf4; color: #15803d; border: 1px dashed #86efac; }
            }
          }
        }
      }
    }

    .wa-config-banner {
      background: #f0fdf4;
      border: 1px solid #86efac;
      .wa-banner-icon { color: #16a34a; }
      strong { color: #14532d; }
      p { color: #15803d; }
    }

    .settlement-verified-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 6px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 0.72rem;
      font-weight: 600;

      mat-icon {
        font-size: 15px;
        width: 15px;
        height: 15px;
        color: #2563eb;
      }
    }

    .bank-account-setup-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .bank-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 8px;
        border-bottom: 1px dashed #cbd5e1;
        margin-bottom: 4px;

        .header-left {
          display: flex;
          align-items: center;
          gap: 8px;

          .bank-card-icon {
            font-size: 20px;
            width: 20px;
            height: 20px;
            color: #0369a1;
          }

          .header-titles {
            .title {
              font-size: 0.86rem;
              font-weight: 700;
              color: #0f172a;
              display: block;
            }
            .sub {
              font-size: 0.72rem;
              color: #64748b;
            }
          }
        }

        .verified-pill {
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #86efac;
          border-radius: 12px;
          padding: 2px 8px;
          font-size: 0.68rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
        }
      }
    }

    .toggles-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;

      .toggle-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;

        .toggle-text {
          .toggle-title { font-size: 0.85rem; color: #1e293b; display: block; }
          .toggle-sub { font-size: 0.75rem; color: #64748b; margin: 2px 0 0; }
        }
      }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      gap: 12px;

      .modal-title-group {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
        flex: 1;

        .header-icon-box {
          background: #2563eb;
          color: #ffffff;
          border-radius: 10px;
          box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;

          mat-icon { font-size: 22px; width: 22px; height: 22px; color: #ffffff; }
        }

        .modal-title-texts {
          min-width: 0;
          flex: 1;
        }

        h3 {
          font-size: 1.05rem;
          font-weight: 700;
          color: #1e3a8a;
          margin: 0;
          line-height: 1.25;
        }
        p {
          font-size: 0.76rem;
          color: #3b82f6;
          margin: 2px 0 0;
          line-height: 1.25;
        }
      }

      .modal-header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;

        .header-back-btn {
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 600;
          height: 34px;
          padding: 0 10px;
          color: #2563eb;
          border-color: #bfdbfe;
          background: #ffffff;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
          &:hover { background: #eff6ff; border-color: #93c5fd; }
        }

        .close-btn {
          color: #64748b;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          &:hover { color: #1e293b; background: rgba(0,0,0,0.04); }
        }
      }

      @media (max-width: 640px) {
        padding: 10px 12px;
        gap: 6px;

        .modal-title-group {
          gap: 8px;

          .header-icon-box {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            mat-icon { font-size: 18px; width: 18px; height: 18px; }
          }

          h3 {
            font-size: 0.88rem;
          }
          p {
            font-size: 0.7rem;
          }
        }

        .modal-header-actions {
          gap: 4px;

          .header-back-btn {
            height: 30px;
            padding: 0 8px;
            font-size: 0.72rem;
            gap: 2px;
            mat-icon { font-size: 14px; width: 14px; height: 14px; }
          }

          .close-btn {
            width: 30px;
            height: 30px;
            mat-icon { font-size: 18px; width: 18px; height: 18px; }
          }
        }
      }
    }

    .modal-body {
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;

      @media (max-width: 640px) {
        padding: 12px 10px;
        gap: 12px;
      }
    }

    .photo-upload-section {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 12px;

      .avatar-preview {
        width: 64px;
        height: 64px;
        border-radius: 12px;
        background: #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;

        .preview-img { width: 100%; height: 100%; object-fit: cover; }
        .avatar-placeholder { color: #94a3b8; font-size: 28px; width: 28px; height: 28px; }
      }

      .upload-controls {
        display: flex;
        flex-direction: column;
        gap: 4px;

        .upload-btn {
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #eff6ff;
          color: #2563eb;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 0.82rem;
          font-weight: 600;
          border: 1px solid #bfdbfe;
          width: fit-content;
          transition: background 0.15s ease;
          &:hover { background: #dbeafe; }
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }

        .upload-hint { font-size: 0.72rem; color: #94a3b8; }
        .remove-photo-btn { font-size: 0.75rem; height: 24px; line-height: 24px; padding: 0 8px; }
      }
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;

      .span-1 { grid-column: span 1; }
      .span-2 { grid-column: span 2; }
      mat-form-field { width: 100%; }
    }

    .admin-setup-block {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      padding: 16px;

      .block-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.88rem;
        font-weight: 700;
        color: #166534;
        margin: 0 0 12px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
    }

    .branches-setup-block {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 16px;

      .block-title-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;

        .block-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.88rem;
          font-weight: 700;
          color: #1e40af;
          margin: 0;
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
        }

        .add-branch-btn {
          height: 32px;
          font-size: 0.78rem;
          font-weight: 600;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }
      }

      .block-desc {
        font-size: 0.8rem;
        color: #64748b;
        margin: 0 0 14px;
      }

      .branches-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .branch-row-card {
        background: #ffffff;
        border: 1px solid #dbeafe;
        border-radius: 10px;
        padding: 12px 14px;

        .branch-row-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;

          .branch-row-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 0.75rem;
            font-weight: 700;
            padding: 2px 10px;
            border-radius: 20px;
            background: #e2e8f0;
            color: #475569;
            mat-icon { font-size: 14px; width: 14px; height: 14px; }

            &.main-badge {
              background: #dbeafe;
              color: #1d4ed8;
            }
          }
        }
      }
    }

    .modal-error {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fee2e2;
      color: #991b1b;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.85rem;
      mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    }

    .modal-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding-top: 12px;
      border-top: 1px solid #f1f5f9;

      button {
        height: 40px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.88rem;
      }

      .back-to-profile-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #2563eb;
        border-color: #bfdbfe;
        &:hover { background: #eff6ff; }
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }

      .footer-right-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-left: auto;
      }

      @media (max-width: 640px) {
        padding-top: 10px;
        gap: 6px;

        button {
          height: 36px;
          font-size: 0.8rem;
          padding: 0 10px;
        }

        .back-to-profile-btn {
          font-size: 0.78rem;
          padding: 0 8px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }
      }
    }

    /* Two-column UPI Gateway Tab Layout */
    .upi-two-col-layout {
      display: grid;
      grid-template-columns: 1.25fr 0.75fr;
      gap: 24px;
      align-items: start;

      @media (max-width: 900px) {
        grid-template-columns: 1fr;
        gap: 16px;
      }
    }

    .upi-col-fields {
      display: flex;
      flex-direction: column;
      gap: 14px;

      mat-form-field {
        width: 100%;
        margin-bottom: 6px;
      }
    }

    .upi-col-preview {
      display: flex;
      flex-direction: column;
      gap: 14px;
      position: sticky;
      top: 0;

      @media (max-width: 820px) {
        position: static;
      }
    }

    .single-line-hint {
      white-space: nowrap !important;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 11px;
      line-height: 1.2;
      display: block;
    }

    .form-grid-inner {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      mat-form-field { 
        width: 100%; 
        margin-bottom: 6px; 
        mat-hint {
          white-space: nowrap !important;
          font-size: 11px;
          line-height: 1.2;
        }
      }

      @media (max-width: 640px) {
        grid-template-columns: 1fr;
        gap: 8px;
        mat-form-field mat-hint {
          white-space: normal;
        }
      }
    }

    .w-100 { width: 100%; }

    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 48px 20px;
      background: #ffffff;
      border-radius: 14px;
      border: 1px dashed #cbd5e1;

      .empty-icon { font-size: 48px; width: 48px; height: 48px; color: #94a3b8; margin-bottom: 12px; }
      h3 { font-size: 1.2rem; color: #1e293b; margin: 0 0 6px; }
      p { color: #64748b; font-size: 0.88rem; margin: 0 0 16px; }
    }

    .spinner-center {
      display: flex;
      justify-content: center;
      padding: 40px;
    }

    /* Complete Responsive System Across Mobile, Tablet & Desktop */
    @media (max-width: 768px) {
      .modal-backdrop {
        padding: 12px;
      }

      .modal-dialog {
        max-width: 100%;
        width: 100%;
        max-height: 94vh;
        border-radius: 12px;
      }

      .modal-header {
        padding: 14px 16px;
        .modal-title-group h3 { font-size: 1rem; }
        .modal-title-group p { font-size: 0.72rem; }
      }

      .modal-nav-tabs {
        padding: 8px 12px 0 12px;
        gap: 4px;
        .modal-tab-btn {
          padding: 8px 10px;
          font-size: 0.78rem;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }
      }

      .modal-body {
        padding: 14px 16px;
      }

      .form-grid {
        grid-template-columns: 1fr;
        .span-1, .span-2 { grid-column: span 1; }
      }

      .controls-bar {
        flex-direction: column;
        align-items: stretch;
        .search-box { width: 100%; box-sizing: border-box; }
        .refresh-btn { width: 100%; }
      }

      .tenants-grid {
        grid-template-columns: 1fr;
      }

      .photo-upload-section {
        flex-direction: column;
        align-items: flex-start;
      }
    }

    @media (max-width: 480px) {
      .modal-backdrop {
        padding: 6px;
      }

      .modal-dialog {
        max-height: 96vh;
        border-radius: 10px;
      }

      .preview-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
      }

      .toggle-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }

      .metrics-strip {
        padding: 8px 4px;
        .metric-cell .metric-count { font-size: 0.95rem; }
        .metric-cell .metric-lbl { font-size: 0.65rem; }
      }
    }
  `]
})
export class TenantsComponent implements OnInit {
  tenants: TenantDto[] = [];
  filteredTenants: TenantDto[] = [];
  loading = false;
  searchQuery = '';

  showModal = false;
  isEditing = false;
  editingId?: string;
  formSaving = false;
  formError = '';
  profilePhotoPreview: string | null = null;

  activeModalTab: 'profile' | 'upi' | 'whatsapp' | 'modules' = 'profile';

  tenantForm: FormGroup;

  popularBanks: string[] = [
    'State Bank of India',
    'HDFC Bank',
    'ICICI Bank',
    'Punjab National Bank',
    'Bank of Baroda',
    'Axis Bank',
    'Canara Bank',
    'Union Bank of India',
    'Bank of India',
    'Indian Bank',
    'Central Bank of India',
    'Kotak Mahindra Bank',
    'IndusInd Bank',
    'Bandhan Bank',
    'IDBI Bank',
    'Yes Bank',
    'Federal Bank',
    'UCO Bank',
    'Bank of Maharashtra',
    'Indian Overseas Bank',
    'Punjab & Sind Bank',
    'RBL Bank',
    'AU Small Finance Bank',
    'South Indian Bank',
    'Karur Vysya Bank'
  ];

  get filteredBanks(): string[] {
    const val = (this.tenantForm?.get('bankName')?.value || '').toLowerCase().trim();
    if (!val) return this.popularBanks;
    return this.popularBanks.filter(b => b.toLowerCase().includes(val));
  }

  constructor(
    private tenantService: TenantService,
    private authService: AuthService,
    private confirmDialog: ConfirmDialogService,
    private fb: FormBuilder
  ) {
    this.tenantForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      contactPhone: [''],
      address: [''],
      whatsAppPhoneId: [''],
      whatsAppAccessToken: [''],
      upiId: [''],
      upiMerchantName: [''],
      upiMerchantCode: ['8211'],
      upiQrEnabled: [true],
      upiAutoVerify: [true],
      bankName: [''],
      bankAccountNumber: ['', [Validators.pattern('^[0-9]{9,18}$')]],
      confirmAccountNumber: [''],
      bankIfscCode: ['', [Validators.pattern('^[A-Z]{4}0[A-Z0-9]{6}$')]],
      bankAccountHolderName: [''],
      bankAccountType: ['Current'],
      bankBranch: [''],
      adminUsername: ['admin', Validators.required],
      adminPassword: ['admin123', Validators.required],
      adminFullName: [''],
      hasSchoolModule: [true],
      hasCoachingModule: [true],
      hasHostelModule: [false],
      hasLibraryModule: [false],
      hasTransportModule: [false],
      subscriptionPlan: ['FreeTrial'],
      subscriptionStatus: ['TrialActive'],
      maxStudentsLimit: [50],
      maxBranchesLimit: [2],
      branches: this.fb.array([])
    });
  }

  get branchesFormArray(): FormArray {
    return this.tenantForm.get('branches') as FormArray;
  }

  addBranchRow(isMain = false): void {
    const defaultName = isMain ? 'Main Branch' : '';
    const defaultCode = isMain ? 'MAIN' : '';
    this.branchesFormArray.push(this.fb.group({
      name: [defaultName, Validators.required],
      code: [defaultCode, Validators.required],
      contactPhone: [''],
      address: [''],
      isMainBranch: [isMain]
    }));
  }

  removeBranchRow(index: number): void {
    if (this.branchesFormArray.length > 1) {
      this.branchesFormArray.removeAt(index);
    }
  }

  onBranchCodeInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      input.value = input.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      this.branchesFormArray.at(index).get('code')?.setValue(input.value, { emitEvent: false });
    }
  }

  onAccountNumberInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      input.value = input.value.replace(/[^0-9]/g, '');
      this.tenantForm.get('bankAccountNumber')?.setValue(input.value, { emitEvent: false });
      this.validateAccountMatch();
    }
  }

  onConfirmAccountNumberInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      input.value = input.value.replace(/[^0-9]/g, '');
      this.tenantForm.get('confirmAccountNumber')?.setValue(input.value, { emitEvent: false });
      this.validateAccountMatch();
    }
  }

  onIfscInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      this.tenantForm.get('bankIfscCode')?.setValue(input.value, { emitEvent: false });
    }
  }

  validateAccountMatch(): void {
    const acc = this.tenantForm.get('bankAccountNumber')?.value?.trim();
    const confirm = this.tenantForm.get('confirmAccountNumber')?.value?.trim();
    const confirmCtrl = this.tenantForm.get('confirmAccountNumber');
    if (acc && confirm && acc !== confirm) {
      confirmCtrl?.setErrors({ mismatch: true });
    } else if (confirmCtrl?.hasError('mismatch')) {
      confirmCtrl.setErrors(null);
    }
  }

  getMaskedAccount(): string {
    const acc = this.tenantForm.get('bankAccountNumber')?.value;
    if (!acc || acc.length < 4) return '••••';
    return '••••' + acc.slice(-4);
  }

  get isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
  }

  get currentTenantPlan(): string {
    const t = this.tenants[0];
    return t?.subscriptionPlan || this.authService.subscriptionPlan();
  }

  get currentTenantStatus(): string {
    const t = this.tenants[0];
    return t?.subscriptionStatus || this.authService.subscriptionStatus();
  }

  get currentMaxStudents(): number {
    const t = this.tenants[0];
    return t?.maxStudentsLimit || 50;
  }

  getTrialDaysText(t: TenantDto): string {
    if (!t.trialEndDate) return '';
    const diff = Math.ceil((new Date(t.trialEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 0) return `${diff} days trial`;
    if (diff === 0) return 'Trial expires today';
    return 'Trial expired';
  }

  get activeCount(): number {
    return this.tenants.filter(t => t.isActive).length;
  }

  get totalStudents(): number {
    return this.tenants.reduce((acc, t) => acc + (t.studentCount || 0), 0);
  }

  get totalBatches(): number {
    return this.tenants.reduce((acc, t) => acc + (t.batchCount || 0), 0);
  }

  ngOnInit(): void {
    this.loadTenants();
  }

  loadTenants(): void {
    this.loading = true;
    this.tenantService.getAllTenants().subscribe({
      next: (data) => {
        this.tenants = data || [];
        this.filterTenants();
        this.loading = false;
        const currentTenantId = this.authService.currentUser()?.tenantId;
        const current = this.tenants.find(t => t.id === currentTenantId || t.id === this.editingId);
        if (current && current.profilePhoto) {
          this.authService.updateTenantProfile(current.profilePhoto, current.name, current.code);
        }
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  filterTenants(): void {
    const q = (this.searchQuery || '').trim().toLowerCase();
    if (!q) {
      this.filteredTenants = [...this.tenants];
    } else {
      this.filteredTenants = this.tenants.filter(t =>
        t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)
      );
    }
  }

  openCreateModal(): void {
    this.isEditing = false;
    this.editingId = undefined;
    this.formError = '';
    this.profilePhotoPreview = null;
    this.tenantForm.reset({
      name: '',
      code: '',
      contactPhone: '',
      address: '',
      whatsAppPhoneId: '',
      whatsAppAccessToken: '',
      upiId: '',
      upiMerchantName: '',
      upiMerchantCode: '8211',
      upiQrEnabled: true,
      upiAutoVerify: true,
      bankName: '',
      bankAccountNumber: '',
      confirmAccountNumber: '',
      bankIfscCode: '',
      bankAccountHolderName: '',
      bankAccountType: 'Current',
      bankBranch: '',
      adminUsername: 'admin',
      adminPassword: 'password123',
      adminFullName: '',
      hasSchoolModule: true,
      hasCoachingModule: true,
      hasHostelModule: false,
      hasLibraryModule: false,
      hasTransportModule: false,
      subscriptionPlan: 'FreeTrial',
      subscriptionStatus: 'TrialActive',
      maxStudentsLimit: 50,
      maxBranchesLimit: 2
    });
    this.branchesFormArray.clear();
    this.addBranchRow(true);
    this.tenantForm.get('adminUsername')?.setValidators([Validators.required]);
    this.tenantForm.get('adminUsername')?.updateValueAndValidity();
    this.tenantForm.get('adminPassword')?.setValidators([Validators.required]);
    this.tenantForm.get('adminPassword')?.updateValueAndValidity();
    this.tenantForm.get('code')?.enable();
    this.tenantForm.get('hasSchoolModule')?.enable();
    this.tenantForm.get('hasCoachingModule')?.enable();
    this.tenantForm.get('hasHostelModule')?.enable();
    this.tenantForm.get('hasLibraryModule')?.enable();
    this.tenantForm.get('hasTransportModule')?.enable();
    this.tenantForm.get('subscriptionPlan')?.enable();
    this.tenantForm.get('subscriptionStatus')?.enable();
    this.tenantForm.get('maxStudentsLimit')?.enable();
    this.tenantForm.get('maxBranchesLimit')?.enable();
    this.showModal = true;
  }

  isTenantModuleActive(t: TenantDto, moduleKey: 'school' | 'coaching' | 'hostel' | 'library' | 'transport'): boolean {
    const currentUser = this.authService.currentUser();
    // If this card is for the currently signed-in tenant, dynamically track authService signals!
    if (currentUser && (currentUser.tenantId === t.id || currentUser.tenantCode === t.code)) {
      if (moduleKey === 'school') return this.authService.hasSchoolModule();
      if (moduleKey === 'coaching') return this.authService.hasCoachingModule();
      if (moduleKey === 'hostel') return this.authService.hasHostelModule();
      if (moduleKey === 'library') return this.authService.hasLibraryModule();
      if (moduleKey === 'transport') return this.authService.hasTransportModule();
    }
    // For other tenants in the list
    if (moduleKey === 'school') return t.hasSchoolModule ?? true;
    if (moduleKey === 'coaching') return t.hasCoachingModule ?? true;
    if (moduleKey === 'hostel') return !!t.hasHostelModule;
    if (moduleKey === 'library') return !!t.hasLibraryModule;
    if (moduleKey === 'transport') return !!t.hasTransportModule;
    return false;
  }

  openEditModal(tenant: TenantDto): void {
    this.isEditing = true;
    this.editingId = tenant.id;
    this.activeModalTab = 'profile';
    this.formError = '';
    this.profilePhotoPreview = tenant.profilePhoto || null;
    this.branchesFormArray.clear();
    this.tenantForm.patchValue({
      name: tenant.name,
      code: tenant.code,
      contactPhone: tenant.contactPhone || '',
      address: tenant.address || '',
      whatsAppPhoneId: tenant.whatsAppPhoneId || '',
      whatsAppAccessToken: '',
      upiId: tenant.upiId || '',
      upiMerchantName: tenant.upiMerchantName || tenant.name || '',
      upiMerchantCode: tenant.upiMerchantCode || '8211',
      upiQrEnabled: tenant.upiQrEnabled !== false,
      upiAutoVerify: tenant.upiAutoVerify !== false,
      bankName: tenant.bankName || '',
      bankAccountNumber: tenant.bankAccountNumber || '',
      confirmAccountNumber: tenant.bankAccountNumber || '',
      bankIfscCode: tenant.bankIfscCode || '',
      bankAccountHolderName: tenant.bankAccountHolderName || tenant.name || '',
      bankAccountType: tenant.bankAccountType || 'Current',
      bankBranch: tenant.bankBranch || '',
      hasSchoolModule: this.isTenantModuleActive(tenant, 'school'),
      hasCoachingModule: this.isTenantModuleActive(tenant, 'coaching'),
      hasHostelModule: this.isTenantModuleActive(tenant, 'hostel'),
      hasLibraryModule: this.isTenantModuleActive(tenant, 'library'),
      hasTransportModule: this.isTenantModuleActive(tenant, 'transport'),
      subscriptionPlan: tenant.subscriptionPlan || 'FreeTrial',
      subscriptionStatus: tenant.subscriptionStatus || 'TrialActive',
      maxStudentsLimit: tenant.maxStudentsLimit || 50,
      maxBranchesLimit: tenant.maxBranchesLimit || 2
    });
    this.tenantForm.get('adminUsername')?.clearValidators();
    this.tenantForm.get('adminUsername')?.updateValueAndValidity();
    this.tenantForm.get('adminPassword')?.clearValidators();
    this.tenantForm.get('adminPassword')?.updateValueAndValidity();
    this.tenantForm.get('code')?.disable();

    if (!this.isSuperAdmin) {
      this.tenantForm.get('hasSchoolModule')?.disable();
      this.tenantForm.get('hasCoachingModule')?.disable();
      this.tenantForm.get('hasHostelModule')?.disable();
      this.tenantForm.get('hasLibraryModule')?.disable();
      this.tenantForm.get('hasTransportModule')?.disable();
      this.tenantForm.get('subscriptionPlan')?.disable();
      this.tenantForm.get('subscriptionStatus')?.disable();
      this.tenantForm.get('maxStudentsLimit')?.disable();
      this.tenantForm.get('maxBranchesLimit')?.disable();
    } else {
      this.tenantForm.get('hasSchoolModule')?.enable();
      this.tenantForm.get('hasCoachingModule')?.enable();
      this.tenantForm.get('hasHostelModule')?.enable();
      this.tenantForm.get('hasLibraryModule')?.enable();
      this.tenantForm.get('hasTransportModule')?.enable();
      this.tenantForm.get('subscriptionPlan')?.enable();
      this.tenantForm.get('subscriptionStatus')?.enable();
      this.tenantForm.get('maxStudentsLimit')?.enable();
      this.tenantForm.get('maxBranchesLimit')?.enable();
    }

    this.showModal = true;
  }

  openUpiModal(tenant: TenantDto): void {
    this.openEditModal(tenant);
    this.activeModalTab = 'upi';
  }

  onCancel(): void {
    if (this.isEditing && this.activeModalTab !== 'profile') {
      this.activeModalTab = 'profile';
    } else {
      this.closeModal();
    }
  }

  closeModal(): void {
    this.showModal = false;
    this.formSaving = false;
    this.formError = '';
    this.profilePhotoPreview = null;
  }

  onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      input.value = input.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      this.tenantForm.get('code')?.setValue(input.value, { emitEvent: false });
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.formError = '';

      try {
        // High performance client-side compression to ~25-40KB for instant loading
        this.profilePhotoPreview = await this.compressImage(file, 400, 400, 0.85);
      } catch {
        // Fallback to standard reader if canvas is unavailable
        const reader = new FileReader();
        reader.onload = () => {
          this.profilePhotoPreview = reader.result as string;
        };
        reader.readAsDataURL(file);
      }
    }
  }

  private compressImage(file: File, maxWidth = 400, maxHeight = 400, quality = 0.85): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(reader.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(reader.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  getPhotoUrl(photo?: string | null): string {
    if (!photo) return '';
    if (photo.startsWith('/uploads/')) {
      return `${environment.apiBaseUrl}${photo}`;
    }
    return photo;
  }

  removePhoto(): void {
    this.profilePhotoPreview = null;
  }

  saveTenant(): void {
    if (this.tenantForm.invalid) return;

    this.formSaving = true;
    this.formError = '';
    const val = this.tenantForm.getRawValue();
    const targetId = this.editingId || this.authService.currentUser()?.tenantId;

    if (this.isEditing && targetId) {
      const updateDto: UpdateTenantDto = {
        name: val.name?.trim() || '',
        contactPhone: val.contactPhone?.trim() || null,
        address: val.address?.trim() || null,
        profilePhoto: this.profilePhotoPreview,
        whatsAppPhoneId: val.whatsAppPhoneId?.trim() || null,
        whatsAppAccessToken: val.whatsAppAccessToken?.trim() || null,
        upiId: val.upiId?.trim() || null,
        upiMerchantName: val.upiMerchantName?.trim() || null,
        upiMerchantCode: val.upiMerchantCode?.trim() || '8211',
        upiQrEnabled: val.upiQrEnabled !== false,
        upiAutoVerify: val.upiAutoVerify !== false,
        bankName: val.bankName?.trim() || null,
        bankAccountNumber: val.bankAccountNumber?.trim() || null,
        bankIfscCode: val.bankIfscCode?.trim()?.toUpperCase() || null,
        bankAccountHolderName: val.bankAccountHolderName?.trim() || null,
        bankAccountType: val.bankAccountType?.trim() || 'Current',
        bankBranch: val.bankBranch?.trim() || null,
        hasSchoolModule: val.hasSchoolModule,
        hasCoachingModule: val.hasCoachingModule,
        hasHostelModule: val.hasHostelModule,
        hasLibraryModule: val.hasLibraryModule,
        hasTransportModule: val.hasTransportModule,
        subscriptionPlan: val.subscriptionPlan,
        subscriptionStatus: val.subscriptionStatus,
        maxStudentsLimit: val.maxStudentsLimit ? Number(val.maxStudentsLimit) : undefined,
        maxBranchesLimit: val.maxBranchesLimit ? Number(val.maxBranchesLimit) : undefined
      };

      // Realtime instantaneous reflection on the sidebar header right when clicking Save Changes!
      this.authService.updateTenantProfile(this.profilePhotoPreview, updateDto.name);
      if (this.authService.currentUser()?.tenantId === targetId) {
        this.authService.updateTenantModules({
          hasSchoolModule: val.hasSchoolModule,
          hasCoachingModule: val.hasCoachingModule,
          hasHostelModule: val.hasHostelModule,
          hasLibraryModule: val.hasLibraryModule,
          hasTransportModule: val.hasTransportModule
        });
        this.authService.updateSubscription({
          subscriptionPlan: val.subscriptionPlan,
          subscriptionStatus: val.subscriptionStatus,
          maxStudentsLimit: val.maxStudentsLimit ? Number(val.maxStudentsLimit) : undefined,
          maxBranchesLimit: val.maxBranchesLimit ? Number(val.maxBranchesLimit) : undefined
        });
      }

      this.tenantService.updateTenant(targetId, updateDto).subscribe({
        next: (res: any) => {
          this.formSaving = false;
          // Optimistically update tenant card in list
          const idx = this.tenants.findIndex(t => t.id === targetId);
          if (idx !== -1) {
            this.tenants[idx] = {
              ...this.tenants[idx],
              ...updateDto,
              id: targetId,
              profilePhoto: res?.profilePhoto || updateDto.profilePhoto
            };
          }
          this.authService.updateTenantProfile(res?.profilePhoto || updateDto.profilePhoto, updateDto.name, res?.code);
          this.closeModal();
          this.loadTenants();
          this.confirmDialog.alert(
            'Institute Settings Saved',
            'Institute profile and Dynamic UPI Gateway settings have been saved successfully.',
            'success'
          );
        },
        error: (err) => {
          this.formSaving = false;
          this.formError = err?.error?.message || 'Failed to update institute details.';
        }
      });
    } else {
      const branchesList = (this.branchesFormArray.value || [])
        .filter((b: any) => b.name && b.name.trim().length > 0)
        .map((b: any) => ({
          name: b.name.trim(),
          code: (b.code || 'MAIN').trim().toUpperCase(),
          contactPhone: b.contactPhone?.trim() || null,
          address: b.address?.trim() || null,
          isMainBranch: !!b.isMainBranch
        }));

      const createDto: CreateTenantDto = {
        name: val.name.trim(),
        code: val.code.trim().toUpperCase(),
        contactPhone: val.contactPhone?.trim() || null,
        address: val.address?.trim() || null,
        profilePhoto: this.profilePhotoPreview,
        whatsAppPhoneId: val.whatsAppPhoneId?.trim() || null,
        whatsAppAccessToken: val.whatsAppAccessToken?.trim() || null,
        adminUsername: val.adminUsername.trim(),
        adminPassword: val.adminPassword,
        adminFullName: val.adminFullName?.trim() || `${val.name.trim()} Administrator`,
        branches: branchesList,
        hasSchoolModule: val.hasSchoolModule,
        hasCoachingModule: val.hasCoachingModule,
        hasHostelModule: val.hasHostelModule,
        hasLibraryModule: val.hasLibraryModule,
        hasTransportModule: val.hasTransportModule,
        subscriptionPlan: val.subscriptionPlan || 'FreeTrial',
        maxStudentsLimit: val.maxStudentsLimit ? Number(val.maxStudentsLimit) : 50,
        maxBranchesLimit: val.maxBranchesLimit ? Number(val.maxBranchesLimit) : 2
      };

      this.tenantService.createTenant(createDto).subscribe({
        next: () => {
          this.closeModal();
          this.loadTenants();
        },
        error: (err) => {
          this.formSaving = false;
          this.formError = err?.error?.message || 'Failed to provision institute.';
        }
      });
    }
  }

  toggleStatus(tenant: TenantDto): void {
    this.tenantService.toggleTenantStatus(tenant.id).subscribe({
      next: (res) => {
        tenant.isActive = res.isActive;
      },
      error: () => {}
    });
  }
}
