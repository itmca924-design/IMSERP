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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { BranchService, BranchDto, CreateBranchDto, UpdateBranchDto } from '../../core/services/branch.service';
import { AuthService, BranchInfo } from '../../core/services/auth.service';

@Component({
  selector: 'app-branches',
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
    MatSlideToggleModule
  ],
  template: `
    <div class="branches-wrapper">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-titles">
          <h2 class="page-title">Branch Management</h2>
          <p class="page-subtitle">Manage multi-branch operations, campus locations, codes, and branch-level statistics.</p>
        </div>
        <button mat-raised-button color="primary" class="add-btn" (click)="openCreateModal()" *ngIf="canManageBranches">
          <mat-icon>add_business</mat-icon>
          <span>Add New Branch</span>
        </button>
      </div>

      <!-- KPI Summary Cards -->
      <div class="kpi-container">
        <mat-card class="kpi-card blue">
          <div class="kpi-inner">
            <div>
              <span class="kpi-label">Total Branches</span>
              <span class="kpi-val">{{ branches.length }}</span>
            </div>
            <div class="kpi-icon-box">
              <mat-icon>domain</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card emerald">
          <div class="kpi-inner">
            <div>
              <span class="kpi-label">Active Campuses</span>
              <span class="kpi-val">{{ activeBranchesCount }}</span>
            </div>
            <div class="kpi-icon-box">
              <mat-icon>check_circle</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card amber">
          <div class="kpi-inner">
            <div>
              <span class="kpi-label">Head Office (HQ)</span>
              <span class="kpi-val main-hq-name">{{ mainBranchName }}</span>
            </div>
            <div class="kpi-icon-box">
              <mat-icon>stars</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card violet">
          <div class="kpi-inner">
            <div>
              <span class="kpi-label">Total Students Enrolled</span>
              <span class="kpi-val">{{ totalStudents }}</span>
            </div>
            <div class="kpi-icon-box">
              <mat-icon>groups</mat-icon>
            </div>
          </div>
        </mat-card>
      </div>

      <!-- Main Content Card -->
      <mat-card class="table-card">
        <!-- Search & Actions Bar -->
        <div class="table-toolbar">
          <div class="search-box">
            <mat-icon class="search-icon">search</mat-icon>
            <input
              type="text"
              placeholder="Search by branch name, code, or address..."
              [(ngModel)]="searchQuery"
              (ngModelChange)="filterBranches()"
            />
            <button mat-icon-button *ngIf="searchQuery" (click)="searchQuery = ''; filterBranches()">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="toolbar-stats">
            Showing <strong>{{ filteredBranches.length }}</strong> of {{ branches.length }} branches
          </div>
        </div>

        <!-- Loading Spinner -->
        <div class="spinner-center" *ngIf="loading">
          <mat-spinner diameter="40"></mat-spinner>
        </div>

        <!-- Branches Table -->
        <div class="table-responsive" *ngIf="!loading">
          <table mat-table [dataSource]="filteredBranches" class="branches-table">
            <!-- Branch Name Column -->
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Branch / Campus</th>
              <td mat-cell *matCellDef="let b">
                <div class="branch-name-cell">
                  <div class="branch-avatar" [class.is-hq]="b.isMainBranch">
                    <mat-icon>{{ b.isMainBranch ? 'account_balance' : 'store' }}</mat-icon>
                  </div>
                  <div class="branch-meta">
                    <div class="name-row">
                      <span class="branch-name">{{ b.name }}</span>
                      <span class="hq-pill" *ngIf="b.isMainBranch">
                        <mat-icon>star</mat-icon> Head Office
                      </span>
                    </div>
                    <span class="branch-created">Added {{ b.createdAt | date:'mediumDate' }}</span>
                  </div>
                </div>
              </td>
            </ng-container>

            <!-- Code Column -->
            <ng-container matColumnDef="code">
              <th mat-header-cell *matHeaderCellDef>Code</th>
              <td mat-cell *matCellDef="let b">
                <span class="code-badge">{{ b.code }}</span>
              </td>
            </ng-container>

            <!-- Contact & Address Column -->
            <ng-container matColumnDef="contact">
              <th mat-header-cell *matHeaderCellDef>Contact &amp; Location</th>
              <td mat-cell *matCellDef="let b">
                <div class="contact-cell">
                  <span class="phone-item" *ngIf="b.contactPhone">
                    <mat-icon>call</mat-icon> {{ b.contactPhone }}
                  </span>
                  <span class="address-item" *ngIf="b.address" [matTooltip]="b.address">
                    <mat-icon>place</mat-icon> {{ b.address }}
                  </span>
                  <span class="empty-field" *ngIf="!b.contactPhone && !b.address">—</span>
                </div>
              </td>
            </ng-container>

            <!-- Stats Column -->
            <ng-container matColumnDef="stats">
              <th mat-header-cell *matHeaderCellDef>Enrolled Data</th>
              <td mat-cell *matCellDef="let b">
                <div class="stats-pills">
                  <span class="stat-chip blue" [matTooltip]="'Students in this branch'">
                    <mat-icon>school</mat-icon> {{ b.studentCount }} Students
                  </span>
                  <span class="stat-chip purple" [matTooltip]="'Batches in this branch'">
                    <mat-icon>class</mat-icon> {{ b.batchCount }} Batches
                  </span>
                  <span class="stat-chip green" [matTooltip]="'Rooms in this branch'">
                    <mat-icon>meeting_room</mat-icon> {{ b.roomCount }} Rooms
                  </span>
                </div>
              </td>
            </ng-container>

            <!-- Status Column -->
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let b">
                <span class="status-badge" [class.active]="b.isActive" [class.inactive]="!b.isActive">
                  <span class="status-dot"></span>
                  {{ b.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
            </ng-container>

            <!-- Actions Column -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="text-right">Actions</th>
              <td mat-cell *matCellDef="let b" class="text-right">
                <div class="actions-row">
                  <button mat-icon-button color="primary" (click)="openEditModal(b)" matTooltip="Edit Branch Details" *ngIf="canManageBranches">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    color="warn"
                    (click)="deleteBranch(b)"
                    *ngIf="canManageBranches && !b.isMainBranch"
                    matTooltip="Delete Branch"
                  >
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="branch-table-row"></tr>

            <!-- Row shown when there is no matching data -->
            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell empty-table-cell" [attr.colspan]="displayedColumns.length">
                <mat-icon>search_off</mat-icon>
                <p>No branches found matching your search criteria.</p>
              </td>
            </tr>
          </table>
        </div>
      </mat-card>

      <!-- Modal Dialog (Create / Edit Branch) -->
      <div class="modal-backdrop" *ngIf="showModal" (click)="closeModal()">
        <div class="modal-dialog" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title-group">
              <div class="modal-icon-wrap">
                <mat-icon>{{ isEditing ? 'edit_location' : 'add_business' }}</mat-icon>
              </div>
              <div>
                <h3 class="modal-title">{{ isEditing ? 'Edit Branch Details' : 'Add New Branch' }}</h3>
                <p class="modal-subtitle">{{ isEditing ? 'Update campus name, code, phone, or address.' : 'Register a new campus or regional branch for this institute.' }}</p>
              </div>
            </div>
            <button mat-icon-button (click)="closeModal()" class="close-btn" type="button">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <form [formGroup]="branchForm" (ngSubmit)="saveBranch()" class="modal-body">
            <!-- Info Callout -->
            <div class="info-callout">
              <mat-icon class="info-icon">auto_awesome</mat-icon>
              <div class="info-text">
                <strong>Multi-Campus Management:</strong> Branches enable localized fee collections, room assignments, and student batch tracking across physical campuses.
              </div>
            </div>

            <!-- Section Label -->
            <div class="section-label">
              <mat-icon class="section-icon">storefront</mat-icon>
              <span>Campus Identity &amp; Location</span>
            </div>

            <div class="form-grid">
              <mat-form-field appearance="outline" class="span-2">
                <mat-label>Branch Name *</mat-label>
                <input matInput formControlName="name" placeholder="e.g. Patna Boring Road Campus">
                <mat-icon matSuffix color="primary">store</mat-icon>
                <mat-error *ngIf="branchForm.get('name')?.hasError('required')">Branch name is required</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="span-1">
                <mat-label>Branch Code *</mat-label>
                <input matInput formControlName="code" placeholder="e.g. PAT-BR" (input)="onCodeInput($event)">
                <mat-icon matSuffix color="primary">qr_code</mat-icon>
                <mat-error *ngIf="branchForm.get('code')?.hasError('required')">Code is required</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="span-1">
                <mat-label>Contact Phone</mat-label>
                <input matInput formControlName="contactPhone" placeholder="+91 98765 43210">
                <mat-icon matSuffix color="primary">call</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline" class="span-2">
                <mat-label>Address &amp; Landmark</mat-label>
                <textarea matInput formControlName="address" rows="2" placeholder="Full physical street address, building, or landmark..."></textarea>
                <mat-icon matSuffix color="primary">place</mat-icon>
              </mat-form-field>

              <!-- Main Branch Toggle (Only when creating) -->
              <div class="span-2 toggle-row" *ngIf="!isEditing">
                <mat-slide-toggle formControlName="isMainBranch" color="primary">
                  <span>Mark as Main Branch / Head Office</span>
                </mat-slide-toggle>
              </div>

              <!-- Active Status Toggle (Only when editing) -->
              <div class="span-2 toggle-row" *ngIf="isEditing">
                <mat-slide-toggle formControlName="isActive" color="primary">
                  <span>Active Branch (Accepting students &amp; batches)</span>
                </mat-slide-toggle>
              </div>
            </div>

            <!-- Live Preview Card -->
            <div class="preview-box">
              <div class="preview-header">
                <mat-icon class="preview-header-icon">preview</mat-icon>
                <span>Branch Preview</span>
              </div>
              <div class="preview-body">
                <div class="preview-item">
                  <span class="preview-label">Branch Name:</span>
                  <strong class="preview-val highlight">{{ branchForm.get('name')?.value || '—' }}</strong>
                </div>
                <div class="preview-item">
                  <span class="preview-label">Campus Code:</span>
                  <span class="code-pill">{{ branchForm.get('code')?.value || '—' }}</span>
                </div>
                <div class="preview-item" *ngIf="branchForm.get('contactPhone')?.value">
                  <span class="preview-label">Phone:</span>
                  <span class="preview-val">{{ branchForm.get('contactPhone')?.value }}</span>
                </div>
              </div>
            </div>

            <div *ngIf="formError" class="modal-error">
              <mat-icon>error_outline</mat-icon>
              <span>{{ formError }}</span>
            </div>

            <div class="modal-footer">
              <button type="button" mat-button (click)="closeModal()">Cancel</button>
              <button type="submit" mat-raised-button color="primary" [disabled]="branchForm.invalid || formSaving" class="submit-btn">
                <mat-spinner diameter="18" *ngIf="formSaving" class="btn-spinner"></mat-spinner>
                <mat-icon *ngIf="!formSaving">{{ isEditing ? 'save' : 'add_business' }}</mat-icon>
                <span>{{ isEditing ? 'Save Changes' : 'Create Branch' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .branches-wrapper {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* Page Header */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 16px;

      .header-titles {
        .page-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1976d2;
          margin: 0;
          letter-spacing: -0.01em;
        }
        p, .page-subtitle {
          font-size: 0.9rem;
          color: #64748b;
          margin: 4px 0 0 0;
        }
      }

      .add-btn {
        height: 42px;
        border-radius: 8px;
        font-weight: 600;
        padding: 0 18px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
    }

    /* KPI Grid */
    .kpi-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .kpi-card {
      border-radius: 16px;
      padding: 20px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

      .kpi-inner {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .kpi-label {
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #64748b;
        display: block;
        margin-bottom: 6px;
      }

      .kpi-val {
        font-size: 1.8rem;
        font-weight: 800;
        color: #0f172a;
        line-height: 1.1;

        &.main-hq-name {
          font-size: 1.1rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 170px;
          display: block;
        }
      }

      .kpi-icon-box {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        mat-icon { font-size: 22px; width: 22px; height: 22px; }
      }

      &.blue {
        .kpi-icon-box { background: #eff6ff; color: #2563eb; }
      }
      &.emerald {
        .kpi-icon-box { background: #ecfdf5; color: #059669; }
      }
      &.amber {
        .kpi-icon-box { background: #fffbeb; color: #d97706; }
      }
      &.violet {
        .kpi-icon-box { background: #f5f3ff; color: #7c3aed; }
      }
    }

    /* Table Card */
    .table-card {
      border-radius: 16px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      overflow: hidden;
      padding: 0;
    }

    .table-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #f1f5f9;
      flex-wrap: wrap;
      gap: 12px;

      .search-box {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        padding: 6px 14px;
        width: 360px;
        max-width: 100%;

        .search-icon { color: #94a3b8; font-size: 20px; width: 20px; height: 20px; }
        input {
          border: none;
          background: transparent;
          outline: none;
          width: 100%;
          font-size: 0.88rem;
          color: #1e293b;
        }
      }

      .toolbar-stats {
        font-size: 0.85rem;
        color: #64748b;
      }
    }

    .table-responsive {
      overflow-x: auto;
    }

    .branches-table {
      width: 100%;
      border-collapse: collapse;

      th.mat-header-cell {
        background: #f8fafc;
        color: #475569;
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 14px 20px;
        border-bottom: 1px solid #e2e8f0;
      }

      td.mat-cell {
        padding: 16px 20px;
        border-bottom: 1px solid #f1f5f9;
        font-size: 0.88rem;
        color: #1e293b;
      }

      tr.branch-table-row:hover {
        background: #f8fafc;
        transition: background 0.15s ease;
      }
    }

    .branch-name-cell {
      display: flex;
      align-items: center;
      gap: 14px;

      .branch-avatar {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: #f1f5f9;
        color: #475569;
        display: flex;
        align-items: center;
        justify-content: center;

        &.is-hq {
          background: #eff6ff;
          color: #2563eb;
        }
      }

      .branch-meta {
        display: flex;
        flex-direction: column;
        gap: 2px;

        .name-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .branch-name {
          font-weight: 600;
          color: #0f172a;
          font-size: 0.95rem;
        }

        .hq-pill {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: #fef3c7;
          color: #b45309;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
          mat-icon { font-size: 13px; width: 13px; height: 13px; }
        }

        .branch-created {
          font-size: 0.75rem;
          color: #94a3b8;
        }
      }
    }

    .code-badge {
      display: inline-block;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      font-size: 0.8rem;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }

    .contact-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 0.82rem;

      span {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #475569;
        mat-icon { font-size: 15px; width: 15px; height: 15px; color: #94a3b8; }
      }

      .address-item {
        max-width: 280px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .empty-field { color: #cbd5e1; }
    }

    .stats-pills {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;

      .stat-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 6px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }

        &.blue { background: #eff6ff; color: #2563eb; }
        &.purple { background: #f5f3ff; color: #7c3aed; }
        &.green { background: #f0fdf4; color: #16a34a; }
      }
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 20px;

      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }

      &.active {
        background: #ecfdf5;
        color: #047857;
        .status-dot { background: #10b981; }
      }

      &.inactive {
        background: #f1f5f9;
        color: #64748b;
        .status-dot { background: #94a3b8; }
      }
    }

    .text-right { text-align: right; }
    .actions-row {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .empty-table-cell {
      text-align: center;
      padding: 48px 20px;
      color: #64748b;
      mat-icon { font-size: 40px; width: 40px; height: 40px; color: #94a3b8; margin-bottom: 8px; }
      p { margin: 0; font-size: 0.9rem; }
    }

    .spinner-center {
      display: flex;
      justify-content: center;
      padding: 48px 0;
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
      max-width: 580px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.25);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      padding: 20px 24px 16px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;

      .modal-title-group {
        display: flex;
        align-items: center;
        gap: 14px;
        flex: 1 1 auto;

        .modal-icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: #2563eb;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
          mat-icon { font-size: 24px; width: 24px; height: 24px; }
        }

        .modal-title {
          font-size: 1.18rem;
          font-weight: 700;
          color: #1e3a8a;
          margin: 0;
          line-height: 1.3;
        }

        .modal-subtitle {
          font-size: 0.79rem;
          color: #3b82f6;
          margin: 3px 0 0;
        }
      }

      .close-btn { color: #64748b; }
    }

    .modal-body {
      padding: 18px 24px 10px;
      display: flex;
      flex-direction: column;
      gap: 14px;

      .info-callout {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 13px;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 8px;

        .info-icon { color: #16a34a; font-size: 18px; width: 18px; height: 18px; margin-top: 1px; flex-shrink: 0; }
        .info-text { font-size: 0.79rem; color: #166534; line-height: 1.45; strong { font-weight: 700; } }
      }

      .section-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        font-weight: 700;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        margin-bottom: -4px;

        .section-icon { font-size: 15px; width: 15px; height: 15px; color: #94a3b8; }
      }

      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;

        .span-1 { grid-column: span 1; }
        .span-2 { grid-column: span 2; }
        mat-form-field { width: 100%; }
      }

      .toggle-row {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        padding: 10px 14px;
        border-radius: 10px;
        margin-top: 2px;
      }

      .preview-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        overflow: hidden;

        .preview-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: #f1f5f9;
          border-bottom: 1px solid #e2e8f0;
          font-size: 0.73rem;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          .preview-header-icon { font-size: 14px; width: 14px; height: 14px; color: #94a3b8; }
        }

        .preview-body {
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .preview-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.82rem;
          .preview-label { color: #64748b; }
          .preview-val {
            color: #0f172a;
            font-weight: 600;
            &.highlight { color: #2563eb; }
          }
          .code-pill {
            background: #eff6ff;
            color: #2563eb;
            border: 1px solid #bfdbfe;
            font-weight: 700;
            font-size: 0.75rem;
            padding: 1px 8px;
            border-radius: 4px;
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
      justify-content: flex-end;
      align-items: center;
      gap: 10px;
      padding-top: 14px;
      margin-top: 4px;
      border-top: 1px solid #f1f5f9;

      .submit-btn {
        height: 42px;
        font-weight: 600;
        padding: 0 20px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .btn-spinner { margin-right: 4px; display: inline-block; }
    }
  `]
})
export class BranchesComponent implements OnInit {
  branches: BranchDto[] = [];
  filteredBranches: BranchDto[] = [];
  loading = false;
  searchQuery = '';

  showModal = false;
  isEditing = false;
  editingId?: string;
  formSaving = false;
  formError = '';

  branchForm: FormGroup;
  displayedColumns: string[] = ['name', 'code', 'contact', 'stats', 'status', 'actions'];

  constructor(
    private branchService: BranchService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.branchForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      contactPhone: [''],
      address: [''],
      isMainBranch: [false],
      isActive: [true]
    });
  }

  get canManageBranches(): boolean {
    const role = this.authService.currentUser()?.role;
    return role === 'SuperAdmin' || role === 'InstituteAdmin';
  }

  get activeBranchesCount(): number {
    return this.branches.filter(b => b.isActive).length;
  }

  get mainBranchName(): string {
    const main = this.branches.find(b => b.isMainBranch);
    return main ? main.name : '—';
  }

  get totalStudents(): number {
    return this.branches.reduce((acc, b) => acc + (b.studentCount || 0), 0);
  }

  ngOnInit(): void {
    this.loadBranches();
  }

  loadBranches(): void {
    this.loading = true;
    this.branchService.getAllBranches().subscribe({
      next: (data) => {
        this.branches = data || [];
        this.filterBranches();
        this.loading = false;
        const branchInfos: BranchInfo[] = (data || []).map(b => ({
          id: b.id,
          tenantId: b.tenantId,
          name: b.name,
          code: b.code,
          address: b.address,
          contactPhone: b.contactPhone,
          isMainBranch: b.isMainBranch,
          isActive: b.isActive,
          createdAt: b.createdAt
        }));
        this.authService.updateBranches(branchInfos);
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  filterBranches(): void {
    const q = (this.searchQuery || '').trim().toLowerCase();
    if (!q) {
      this.filteredBranches = [...this.branches];
    } else {
      this.filteredBranches = this.branches.filter(b =>
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        (b.address && b.address.toLowerCase().includes(q))
      );
    }
  }

  openCreateModal(): void {
    this.isEditing = false;
    this.editingId = undefined;
    this.formError = '';
    this.branchForm.reset({
      name: '',
      code: '',
      contactPhone: '',
      address: '',
      isMainBranch: this.branches.length === 0,
      isActive: true
    });
    this.branchForm.get('code')?.enable();
    this.showModal = true;
  }

  openEditModal(branch: BranchDto): void {
    this.isEditing = true;
    this.editingId = branch.id;
    this.formError = '';
    this.branchForm.patchValue({
      name: branch.name,
      code: branch.code,
      contactPhone: branch.contactPhone || '',
      address: branch.address || '',
      isMainBranch: branch.isMainBranch,
      isActive: branch.isActive
    });
    this.branchForm.get('code')?.disable();
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.formSaving = false;
    this.formError = '';
  }

  onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      input.value = input.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      this.branchForm.get('code')?.setValue(input.value, { emitEvent: false });
    }
  }

  saveBranch(): void {
    if (this.branchForm.invalid) return;

    this.formSaving = true;
    this.formError = '';
    const val = this.branchForm.getRawValue();

    if (this.isEditing && this.editingId) {
      const updateDto: UpdateBranchDto = {
        name: val.name.trim(),
        contactPhone: val.contactPhone?.trim() || null,
        address: val.address?.trim() || null,
        isActive: val.isActive
      };

      this.branchService.updateBranch(this.editingId, updateDto).subscribe({
        next: () => {
          this.closeModal();
          this.loadBranches();
        },
        error: (err) => {
          this.formSaving = false;
          this.formError = err?.error?.message || 'Failed to update branch details.';
        }
      });
    } else {
      const createDto: CreateBranchDto = {
        name: val.name.trim(),
        code: val.code.trim().toUpperCase(),
        contactPhone: val.contactPhone?.trim() || null,
        address: val.address?.trim() || null,
        isMainBranch: !!val.isMainBranch
      };

      this.branchService.createBranch(createDto).subscribe({
        next: () => {
          this.closeModal();
          this.loadBranches();
        },
        error: (err) => {
          this.formSaving = false;
          this.formError = err?.error?.message || 'Failed to create branch.';
        }
      });
    }
  }

  deleteBranch(branch: BranchDto): void {
    if (branch.isMainBranch) {
      alert('The Main Branch (Head Office) cannot be deleted.');
      return;
    }

    if (!confirm(`Are you sure you want to delete branch "${branch.name}" (${branch.code})? This action cannot be undone.`)) {
      return;
    }

    this.branchService.deleteBranch(branch.id).subscribe({
      next: () => {
        this.loadBranches();
      },
      error: (err) => {
        alert(err?.error?.message || 'Cannot delete branch because active records or students are assigned to it.');
      }
    });
  }
}
