import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
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
import { TenantService, TenantDto, CreateTenantDto, UpdateTenantDto } from '../../core/services/tenant.service';
import { AuthService } from '../../core/services/auth.service';

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
    MatSlideToggleModule
  ],
  template: `
    <div class="tenants-wrapper">
      <!-- Header Section -->
      <div class="header-banner">
        <div class="header-titles">
          <h2>Coaching Institutes &amp; Tenants</h2>
          <p>Multi-Tenant SaaS provisioning, institute profiles, logos, and branch settings.</p>
        </div>
        <button mat-raised-button color="primary" class="action-btn" (click)="openCreateModal()" *ngIf="isSuperAdmin">
          <mat-icon>add_business</mat-icon>
          <span>Provision New Institute</span>
        </button>
      </div>

      <!-- KPI Summary Cards -->
      <div class="kpi-container">
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

      <!-- Search & Controls Bar -->
      <div class="controls-bar">
        <div class="search-box">
          <mat-icon class="search-icon">search</mat-icon>
          <input type="text" placeholder="Search institute name or code..." [(ngModel)]="searchQuery" (input)="filterTenants()">
        </div>
        <button mat-stroked-button (click)="loadTenants()" class="refresh-btn" matTooltip="Refresh institutes list">
          <mat-icon [class.spin]="loading">sync</mat-icon>
          <span>Refresh</span>
        </button>
      </div>

      <!-- Loading Spinner -->
      <div *ngIf="loading && tenants.length === 0" class="spinner-center">
        <mat-spinner diameter="44"></mat-spinner>
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
          </div>

          <div class="card-actions">
            <button mat-stroked-button color="primary" class="edit-btn" (click)="openEditModal(t)">
              <mat-icon>edit</mat-icon>
              <span>Edit Profile</span>
            </button>
            <button mat-button [color]="t.isActive ? 'warn' : 'accent'" (click)="toggleStatus(t)">
              <mat-icon>{{ t.isActive ? 'pause_circle' : 'play_circle' }}</mat-icon>
              <span>{{ t.isActive ? 'Deactivate' : 'Activate' }}</span>
            </button>
          </div>
        </mat-card>

        <div *ngIf="filteredTenants.length === 0 && !loading" class="empty-state">
          <mat-icon class="empty-icon">domain_disabled</mat-icon>
          <h3>No Coaching Institutes Found</h3>
          <p>No institutes match your search or no tenants have been provisioned yet.</p>
          <button mat-raised-button color="primary" (click)="openCreateModal()">Provision First Institute</button>
        </div>
      </div>

      <!-- Create / Edit Modal Backdrop -->
      <div class="modal-backdrop" *ngIf="showModal" (click)="closeModal()">
        <div class="modal-dialog" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title-group">
              <mat-icon color="primary">{{ isEditing ? 'edit_note' : 'add_business' }}</mat-icon>
              <h3>{{ isEditing ? 'Edit Institute Profile &amp; Photo' : 'Provision New Coaching Institute' }}</h3>
            </div>
            <button mat-icon-button (click)="closeModal()">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <form [formGroup]="tenantForm" (ngSubmit)="saveTenant()" class="modal-body">
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
                <mat-label>Institute Code (Unique)</mat-label>
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
                <input matInput formControlName="address" placeholder="e.g. 101 Knowledge Park, New Delhi">
                <mat-icon matSuffix>location_on</mat-icon>
              </mat-form-field>

              <!-- WhatsApp Phone ID -->
              <mat-form-field appearance="outline" class="span-1">
                <mat-label>WhatsApp Phone ID (Optional)</mat-label>
                <input matInput formControlName="whatsAppPhoneId" placeholder="e.g. 104829103982">
                <mat-icon matSuffix>chat</mat-icon>
              </mat-form-field>

              <!-- WhatsApp Access Token -->
              <mat-form-field appearance="outline" class="span-1">
                <mat-label>WhatsApp Access Token (Optional)</mat-label>
                <input matInput formControlName="whatsAppAccessToken" placeholder="Meta Graph API Token">
                <mat-icon matSuffix>security</mat-icon>
              </mat-form-field>
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

            <div *ngIf="formError" class="modal-error">
              <mat-icon>error</mat-icon>
              <span>{{ formError }}</span>
            </div>

            <div class="modal-footer">
              <button type="button" mat-button (click)="closeModal()">Cancel</button>
              <button type="submit" mat-raised-button color="primary" [disabled]="tenantForm.invalid || formSaving">
                <mat-spinner diameter="18" *ngIf="formSaving" style="display:inline-block; margin-right:6px;"></mat-spinner>
                <span>{{ isEditing ? 'Save Changes' : 'Provision Institute' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .tenants-wrapper {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      box-sizing: border-box;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .header-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #0b1329 0%, #1e3a8a 100%);
      color: #ffffff;
      padding: 22px 28px;
      border-radius: 14px;
      box-shadow: 0 8px 24px rgba(11, 19, 41, 0.25);

      .header-titles {
        h2 { font-size: 1.5rem; font-weight: 800; margin: 0 0 6px; letter-spacing: -0.02em; }
        p  { font-size: 0.9rem; color: #93c5fd; margin: 0; }
      }

      .action-btn {
        background: #38bdf8 !important;
        color: #0b1329 !important;
        font-weight: 700;
        border-radius: 9px;
        padding: 0 20px;
        height: 44px;
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
      }
      @media (max-width: 600px) {
        grid-template-columns: 1fr;
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

    .card-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-top: 4px;

      button {
        border-radius: 8px;
        font-size: 0.82rem;
        font-weight: 600;
        height: 36px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }

      .edit-btn { flex: 1; }
    }

    /* Modal Backdrop & Dialog */
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
    }

    .modal-dialog {
      background: #ffffff;
      border-radius: 16px;
      width: 100%;
      max-width: 620px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 24px;
      border-bottom: 1px solid #f1f5f9;

      .modal-title-group {
        display: flex;
        align-items: center;
        gap: 10px;
        h3 { font-size: 1.15rem; font-weight: 700; color: #0f172a; margin: 0; }
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }
    }

    .modal-body {
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
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

    .modal-error {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fee2e2;
      color: #991b1b;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.85rem;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding-top: 12px;
      border-top: 1px solid #f1f5f9;

      button {
        height: 40px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.88rem;
      }
    }

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

  tenantForm: FormGroup;

  constructor(
    private tenantService: TenantService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.tenantForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      contactPhone: [''],
      address: [''],
      whatsAppPhoneId: [''],
      whatsAppAccessToken: [''],
      adminUsername: ['admin', Validators.required],
      adminPassword: ['admin123', Validators.required],
      adminFullName: ['']
    });
  }

  get isSuperAdmin(): boolean {
    return this.authService.currentUser()?.role === 'SuperAdmin';
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
      adminUsername: 'admin',
      adminPassword: 'password123',
      adminFullName: ''
    });
    this.tenantForm.get('code')?.enable();
    this.showModal = true;
  }

  openEditModal(tenant: TenantDto): void {
    this.isEditing = true;
    this.editingId = tenant.id;
    this.formError = '';
    this.profilePhotoPreview = tenant.profilePhoto || null;
    this.tenantForm.patchValue({
      name: tenant.name,
      code: tenant.code,
      contactPhone: tenant.contactPhone || '',
      address: tenant.address || '',
      whatsAppPhoneId: tenant.whatsAppPhoneId || '',
      whatsAppAccessToken: ''
    });
    this.tenantForm.get('code')?.disable();
    this.showModal = true;
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
      return `http://localhost:5000${photo}`;
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

    if (this.isEditing && this.editingId) {
      const updateDto: UpdateTenantDto = {
        name: val.name.trim(),
        contactPhone: val.contactPhone?.trim() || null,
        address: val.address?.trim() || null,
        profilePhoto: this.profilePhotoPreview,
        whatsAppPhoneId: val.whatsAppPhoneId?.trim() || null,
        whatsAppAccessToken: val.whatsAppAccessToken?.trim() || null
      };

      this.tenantService.updateTenant(this.editingId, updateDto).subscribe({
        next: () => {
          this.closeModal();
          this.loadTenants();
        },
        error: (err) => {
          this.formSaving = false;
          this.formError = err?.error?.message || 'Failed to update institute details.';
        }
      });
    } else {
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
        adminFullName: val.adminFullName?.trim() || `${val.name.trim()} Administrator`
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
