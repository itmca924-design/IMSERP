import { Component, OnInit, ViewChild, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { FeesService, FeeHead, CreateFeeHeadPayload, UpdateFeeHeadPayload } from '../../core/services/fees.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { FeeHeadsReportDialogComponent } from '../fees/fee-heads-report-dialog.component';
import { ClassFeeMatrixReportDialogComponent } from '../fees/class-fee-matrix-report-dialog.component';

@Component({
  selector: 'app-fee-heads',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatSlideToggleModule,
    MatDialogModule
  ],
  template: `
    <div class="fee-heads-container">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-text-group">
          <h2 class="page-title">
            <mat-icon class="title-icon">account_tree</mat-icon>
            Fee Heads Master
          </h2>
          <p class="page-subtitle">
            Define, categorize, and control billing frequencies for universal academic, hostel, lab, and transport fee heads across schools & coaching institutes.
          </p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button class="report-btn catalog-btn" (click)="openFeeHeadsReport()" matTooltip="Print or export official master fee heads catalog">
            <mat-icon>print</mat-icon>
            <span>Master Catalog (कैटलॉग)</span>
          </button>
          <button mat-stroked-button class="report-btn matrix-btn" (click)="openClassFeeMatrixReport()" matTooltip="Print or export class-wise fee structure matrix">
            <mat-icon>grid_view</mat-icon>
            <span>Class Fee Matrix (कक्षा-वार फ़ीस)</span>
          </button>
          <button mat-raised-button color="primary" class="add-head-btn" (click)="openAddHeadDrawer()">
            <mat-icon>add</mat-icon>
            <span>Create Fee Head</span>
          </button>
        </div>
      </div>
    
      <!-- KPI Stat Cards -->
      <div class="stats-grid">
        <div class="stat-card total">
          <div class="stat-icon"><mat-icon>calculate</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{ totalCount }}</span>
            <span class="stat-lbl">Total Fee Heads</span>
          </div>
        </div>
    
        <div class="stat-card active">
          <div class="stat-icon"><mat-icon>check_circle</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{ activeCount }}</span>
            <span class="stat-lbl">Active Heads</span>
          </div>
        </div>
    
        <div class="stat-card monthly">
          <div class="stat-icon"><mat-icon>event_repeat</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{ monthlyCount }}</span>
            <span class="stat-lbl">Monthly Recurring</span>
          </div>
        </div>
    
        <div class="stat-card categories">
          <div class="stat-icon"><mat-icon>category</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{ categoriesCount }}</span>
            <span class="stat-lbl">Unique Categories</span>
          </div>
        </div>
      </div>
    
      <!-- Add / Edit Fee Head Drawer Panel -->
      @if (showDrawer) {
        <mat-card class="form-drawer mat-elevation-z3">
          <div class="drawer-header">
            <div class="drawer-title">
              <mat-icon color="primary">{{ isEditMode ? 'edit' : 'add_circle' }}</mat-icon>
              <div>
                <strong>{{ isEditMode ? 'Edit Fee Head' : 'Create New Fee Head' }}</strong>
                <small>{{ isEditMode ? 'Update properties for ' + editingHead?.name : 'Add a new billing head with short code, category & frequency' }}</small>
              </div>
            </div>
            <button mat-icon-button (click)="closeDrawer()"><mat-icon>close</mat-icon></button>
          </div>
          <form [formGroup]="headForm" (ngSubmit)="onSubmitHead()" class="drawer-form">
            <div class="form-row">
              <mat-form-field appearance="outline" class="f-flex-2">
                <mat-label>Fee Head Name *</mat-label>
                <input matInput formControlName="name" placeholder="e.g. Tuition Fee, Exam Fee, Hostel Fee" />
                @if (headForm.get('name')?.hasError('required')) {
                  <mat-error>Name is required</mat-error>
                }
              </mat-form-field>
              <mat-form-field appearance="outline" class="f-flex-1">
                <mat-label>Short Code (Unique) *</mat-label>
                <input matInput formControlName="code" placeholder="e.g. TUI, COACH, EXAM" style="text-transform: uppercase;" />
                @if (headForm.get('code')?.hasError('required')) {
                  <mat-error>Code is required</mat-error>
                }
              </mat-form-field>
            </div>
            <div class="form-row">
              <mat-form-field appearance="outline" class="f-flex-1">
                <mat-label>Category *</mat-label>
                <mat-select formControlName="category">
                  <mat-option value="Academic">Academic (Tuition & Coaching)</mat-option>
                  <mat-option value="Infrastructure">Infrastructure (Labs & Smart Class)</mat-option>
                  <mat-option value="Activities">Activities (Sports & Cultural)</mat-option>
                  <mat-option value="Supplies">Supplies (Kit, Modules & Books)</mat-option>
                  @if (hasHostelModule) {
                    <mat-option value="Residential">Residential (Hostel & Mess)</mat-option>
                  }
                  @if (hasTransportModule) {
                    <mat-option value="Transport">Transport (Bus & Van Transit)</mat-option>
                  }
                  <mat-option value="Other">Other / Fines / Miscellaneous</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" class="f-flex-1">
                <mat-label>Applicable To *</mat-label>
                <mat-select formControlName="applicableTo">
                  @if (hasSchoolModule && hasCoachingModule) {
                    <mat-option value="Both">🔄 Both (School & Coaching)</mat-option>
                  }
                  @if (hasSchoolModule) {
                    <mat-option value="School">🏫 School Only</mat-option>
                  }
                  @if (hasCoachingModule) {
                    <mat-option value="Coaching">🎯 Coaching Only</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" class="f-flex-1">
                <mat-label>Billing Frequency *</mat-label>
                <mat-select formControlName="frequency">
                  <mat-option value="Monthly">Monthly (Recurring 12x/yr)</mat-option>
                  <mat-option value="Quarterly">Quarterly (Every 3 Months)</mat-option>
                  <mat-option value="TermWise">Term-Wise (Exams / Semesters)</mat-option>
                  <mat-option value="Annual">Annual (Once a Year - Session Start)</mat-option>
                  <mat-option value="OneTime">One-Time (At Admission / Joining)</mat-option>
                  <mat-option value="AdHoc">Ad-Hoc (On-Demand / As Needed)</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" class="f-flex-1">
                <mat-label>Sort Order</mat-label>
                <input matInput type="number" formControlName="sortOrder" min="0" placeholder="10, 20, 30..." />
              </mat-form-field>
            </div>
            <div class="form-row">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Description / Billing Note</mat-label>
                <textarea matInput formControlName="description" rows="2" placeholder="Describe when this fee is applied or specific inclusions..."></textarea>
              </mat-form-field>
            </div>
            @if (isEditMode) {
              <div class="drawer-toggles">
                <mat-slide-toggle formControlName="isActive" color="primary">
                  Fee Head Active &amp; Selectable in Matrices
                </mat-slide-toggle>
              </div>
            }
            <div class="drawer-footer">
              <button mat-button type="button" (click)="closeDrawer()" [disabled]="saving">Cancel</button>
              <button mat-raised-button color="primary" type="submit" [disabled]="headForm.invalid || saving">
                <mat-icon>{{ isEditMode ? 'check' : 'save' }}</mat-icon>
                <span>{{ isEditMode ? 'Update Fee Head' : 'Save Fee Head' }}</span>
              </button>
            </div>
          </form>
        </mat-card>
      }
    
      <!-- Search, Filters & Server-side Data Grid -->
      @if (!showDrawer) {
        <mat-card class="table-card mat-elevation-z2">
          <!-- Filter Toolbar -->
          <div class="filter-toolbar">
            <mat-form-field appearance="outline" class="search-field">
              <mat-label>Search Fee Head, Code or Description...</mat-label>
              <input matInput [(ngModel)]="searchTerm" (keyup.enter)="onSearch()" placeholder="Type and hit Enter..." />
              <button mat-icon-button matSuffix (click)="onSearch()"><mat-icon>search</mat-icon></button>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-select">
              <mat-label>Category</mat-label>
              <mat-select [(ngModel)]="selectedCategory" (selectionChange)="onFilterChange()">
                <mat-option value="All">All Categories</mat-option>
                <mat-option value="Academic">Academic</mat-option>
                <mat-option value="Infrastructure">Infrastructure</mat-option>
                <mat-option value="Activities">Activities</mat-option>
                <mat-option value="Supplies">Supplies</mat-option>
                @if (hasHostelModule) {
                  <mat-option value="Residential">Residential</mat-option>
                }
                @if (hasTransportModule) {
                  <mat-option value="Transport">Transport</mat-option>
                }
                <mat-option value="Other">Other</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-select">
              <mat-label>Frequency</mat-label>
              <mat-select [(ngModel)]="selectedFrequency" (selectionChange)="onFilterChange()">
                <mat-option value="All">All Frequencies</mat-option>
                <mat-option value="Monthly">Monthly</mat-option>
                <mat-option value="Quarterly">Quarterly</mat-option>
                <mat-option value="TermWise">Term-Wise</mat-option>
                <mat-option value="Annual">Annual</mat-option>
                <mat-option value="OneTime">One-Time</mat-option>
                <mat-option value="AdHoc">Ad-Hoc</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-select">
              <mat-label>Status</mat-label>
              <mat-select [(ngModel)]="selectedStatus" (selectionChange)="onFilterChange()">
                <mat-option [value]="null">All Status</mat-option>
                <mat-option [value]="true">Active Only</mat-option>
                <mat-option [value]="false">Inactive Only</mat-option>
              </mat-select>
            </mat-form-field>
            <div class="toolbar-actions">
              <button mat-stroked-button (click)="resetFilters()" matTooltip="Reset search & filters">
                <mat-icon>refresh</mat-icon>
                <span>Reset</span>
              </button>
            </div>
          </div>
          <!-- Responsive Grid Table -->
          <div class="mobile-table-hint">
            <mat-icon>swipe</mat-icon>
            <span>Swipe sideways to view all columns &bull; तालिका दाएं-बाएं स्क्रॉल करें</span>
          </div>
          <div class="table-container">
            <table mat-table [dataSource]="feeHeads" matSort (matSortChange)="onSortChange($event)" class="fee-heads-table">
              <!-- Code Column -->
              <ng-container matColumnDef="code">
                <th mat-header-cell *matHeaderCellDef mat-sort-header> Code </th>
                <td mat-cell *matCellDef="let head">
                  <span class="code-pill">{{ head.code }}</span>
                </td>
              </ng-container>
              <!-- Name Column -->
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef mat-sort-header> Fee Head Name </th>
                <td mat-cell *matCellDef="let head">
                  <div class="name-cell">
                    <strong>{{ head.name }}</strong>
                    @if (head.isDefault) {
                      <span class="default-badge">Preset</span>
                    }
                  </div>
                </td>
              </ng-container>
              <!-- Category Column -->
              <ng-container matColumnDef="category">
                <th mat-header-cell *matHeaderCellDef mat-sort-header> Category </th>
                <td mat-cell *matCellDef="let head">
                  <span class="category-pill" [ngClass]="'cat-' + head.category.toLowerCase()">
                    {{ head.category }}
                  </span>
                </td>
              </ng-container>
              <!-- Frequency Column -->
              <ng-container matColumnDef="frequency">
                <th mat-header-cell *matHeaderCellDef mat-sort-header> Frequency </th>
                <td mat-cell *matCellDef="let head">
                  <span class="freq-pill" [ngClass]="'freq-' + head.frequency.toLowerCase()">
                    {{ head.frequency }}
                  </span>
                </td>
              </ng-container>
              <!-- Description Column -->
              <ng-container matColumnDef="description">
                <th mat-header-cell *matHeaderCellDef> Description </th>
                <td mat-cell *matCellDef="let head" class="desc-cell">
                  <span class="desc-text" [matTooltip]="head.description || ''">{{ head.description || '—' }}</span>
                </td>
              </ng-container>
              <!-- Sort Order Column -->
              <ng-container matColumnDef="sortOrder">
                <th mat-header-cell *matHeaderCellDef mat-sort-header class="text-center"> Order </th>
                <td mat-cell *matCellDef="let head" class="text-center">
                  <span class="order-badge">{{ head.sortOrder }}</span>
                </td>
              </ng-container>
              <!-- Status Column -->
              <ng-container matColumnDef="isActive">
                <th mat-header-cell *matHeaderCellDef mat-sort-header class="text-center"> Status </th>
                <td mat-cell *matCellDef="let head" class="text-center">
                  <span class="status-chip" [class.active]="head.isActive" [class.inactive]="!head.isActive" (click)="onToggleStatus(head)">
                    <mat-icon class="status-icon">{{ head.isActive ? 'check_circle' : 'cancel' }}</mat-icon>
                    {{ head.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </td>
              </ng-container>
              <!-- Actions Column -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="text-center actions-header"> Actions </th>
                <td mat-cell *matCellDef="let head" class="text-center action-buttons">
                  <button mat-icon-button color="primary" (click)="openEditHeadDrawer(head)" matTooltip="Edit Fee Head">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button [color]="head.isActive ? 'warn' : 'accent'" (click)="onToggleStatus(head)" [matTooltip]="head.isActive ? 'Deactivate' : 'Activate'">
                    <mat-icon>{{ head.isActive ? 'pause_circle_outline' : 'play_circle_outline' }}</mat-icon>
                  </button>
                  @if (!head.isDefault) {
                    <button mat-icon-button color="warn" (click)="onDeleteHead(head)" matTooltip="Delete Fee Head">
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  }
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="table-row"></tr>
              <!-- Empty State Row -->
              <tr class="mat-row" *matNoDataRow>
                <td class="mat-cell empty-table-cell" [attr.colspan]="displayedColumns.length">
                  <div class="empty-placeholder">
                    <mat-icon>account_tree</mat-icon>
                    <h4>No fee heads found</h4>
                    <p>Try clearing filters or click <strong>Create Fee Head</strong> above.</p>
                  </div>
                </td>
              </tr>
            </table>
          </div>
          <!-- Server-side Material Paginator -->
          <mat-paginator
            [length]="totalCount"
            [pageSize]="pageSize"
            [pageSizeOptions]="[5, 10, 20, 50]"
            [pageIndex]="pageNumber - 1"
            (page)="onPageChange($event)"
            showFirstLastButtons
            aria-label="Select page of fee heads">
          </mat-paginator>
        </mat-card>
      }
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .fee-heads-container {
      padding: 0 0 40px;
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 24px;
    }

    .header-text-group {
      flex: 1;
      min-width: 280px;
    }

    .page-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.6rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 6px 0;
    }

    .title-icon {
      font-size: 30px;
      width: 30px;
      height: 30px;
      color: #2563eb;
    }

    .page-subtitle {
      color: #64748b;
      font-size: 0.95rem;
      margin: 0;
      line-height: 1.4;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;

      .report-btn {
        height: 44px;
        border-radius: 8px;
        font-weight: 600;
        letter-spacing: 0.3px;
        display: flex;
        align-items: center;
        gap: 6px;
        background: #ffffff;
        border-color: #cbd5e1;
        color: #334155;
        transition: all 0.15s ease;

        &:hover {
          background: #eff6ff;
          border-color: #93c5fd;
          color: #1d4ed8;
        }

        &.matrix-btn {
          color: #1e40af;
          border-color: #bfdbfe;
          background: #f8fafc;
          &:hover {
            background: #dbeafe;
          }
        }
      }
    }

    .add-head-btn {
      height: 44px;
      border-radius: 8px;
      font-weight: 600;
      letter-spacing: 0.3px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* KPI Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
      width: 100%;
      box-sizing: border-box;

      @media (max-width: 1024px) {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 12px !important;
      }

      @media (max-width: 640px) {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 10px !important;
        margin-bottom: 16px !important;
      }

      @media (max-width: 400px) {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 8px !important;
      }
    }

    .stat-card {
      background: #ffffff;
      border-radius: 12px;
      padding: 16px 18px;
      display: flex;
      align-items: center;
      gap: 14px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      border-left: 4px solid transparent;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      min-width: 0;
      box-sizing: border-box;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 12px rgba(0,0,0,0.08);
      }

      @media (max-width: 640px) {
        padding: 10px 12px;
        gap: 10px;
        border-radius: 10px;
        border-left-width: 3.5px;
      }

      @media (max-width: 400px) {
        padding: 8px 10px;
        gap: 8px;
        border-left-width: 3px;
      }
    }

    .stat-card.total { border-color: #3b82f6; }
    .stat-card.total .stat-icon { background: #eff6ff; color: #2563eb; }

    .stat-card.active { border-color: #10b981; }
    .stat-card.active .stat-icon { background: #ecfdf5; color: #059669; }

    .stat-card.monthly { border-color: #8b5cf6; }
    .stat-card.monthly .stat-icon { background: #f5f3ff; color: #7c3aed; }

    .stat-card.categories { border-color: #f59e0b; }
    .stat-card.categories .stat-icon { background: #fffbeb; color: #d97706; }

    .stat-icon {
      width: 44px;
      height: 44px;
      min-width: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      mat-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
      }

      @media (max-width: 640px) {
        width: 36px;
        height: 36px;
        min-width: 36px;
        border-radius: 8px;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
      }

      @media (max-width: 400px) {
        width: 32px;
        height: 32px;
        min-width: 32px;
        border-radius: 6px;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }
    }

    .stat-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }

    .stat-val {
      font-size: 1.55rem;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.1;

      @media (max-width: 640px) {
        font-size: 1.25rem;
      }

      @media (max-width: 400px) {
        font-size: 1.15rem;
      }
    }

    .stat-lbl {
      font-size: 0.8rem;
      color: #64748b;
      margin-top: 4px;
      font-weight: 500;
      line-height: 1.25;
      word-break: break-word;

      @media (max-width: 640px) {
        font-size: 0.7rem;
        margin-top: 2px;
      }

      @media (max-width: 400px) {
        font-size: 0.65rem;
        line-height: 1.15;
      }
    }

    /* Drawer Form */
    .form-drawer {
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      animation: fadeInDown 0.2s ease-out;
    }

    @keyframes fadeInDown {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid #f1f5f9;
    }

    .drawer-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .drawer-title strong {
      display: block;
      font-size: 1.15rem;
      color: #0f172a;
    }

    .drawer-title small {
      color: #64748b;
      font-size: 0.85rem;
    }

    .drawer-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-row {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    .f-flex-1 { flex: 1; min-width: 200px; }
    .f-flex-2 { flex: 2; min-width: 280px; }
    .full-width { width: 100%; }

    .drawer-toggles {
      padding: 6px 0;
    }

    .drawer-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 8px;
    }

    /* Table & Toolbar */
    .table-card {
      border-radius: 12px;
      overflow: hidden;
      background: #ffffff;
      border: 1px solid #e2e8f0;
    }

    .filter-toolbar {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 20px 8px;
      flex-wrap: wrap;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }

    .search-field {
      flex: 2;
      min-width: 260px;
    }

    .filter-select {
      flex: 1;
      min-width: 150px;
    }

    .toolbar-actions {
      display: flex;
      align-items: center;
      margin-bottom: 16px;
    }

    .mobile-table-hint {
      display: none;
      @media (max-width: 768px) {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        background: #eff6ff;
        color: #2563eb;
        font-size: 0.72rem;
        font-weight: 600;
        padding: 6px 10px;
        border-radius: 6px;
        margin: 10px 12px 6px;
        border: 1px dashed #bfdbfe;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }
    }

    .table-container {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: 0 0 12px 12px;
    }

    .fee-heads-table {
      width: 100%;
      min-width: 820px;

      th, td {
        white-space: nowrap;
      }
    }

    .code-pill {
      display: inline-block;
      font-family: monospace;
      font-size: 0.85rem;
      font-weight: 700;
      color: #1e40af;
      background: #dbeafe;
      padding: 3px 8px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }

    .name-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .default-badge {
      font-size: 0.68rem;
      font-weight: 600;
      color: #475569;
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    /* Category Pill Styles */
    .category-pill {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 3px 9px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .cat-academic { background: #eff6ff; color: #1d4ed8; }
    .cat-infrastructure { background: #e0e7ff; color: #4338ca; }
    .cat-activities { background: #fef3c7; color: #b45309; }
    .cat-supplies { background: #fae8ff; color: #86198f; }
    .cat-residential { background: #fce7f3; color: #9d174d; }
    .cat-transport { background: #ecfdf5; color: #047857; }
    .cat-other { background: #f1f5f9; color: #475569; }

    /* Frequency Pill Styles */
    .freq-pill {
      display: inline-block;
      font-size: 0.78rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 6px;
      background: #f8fafc;
      color: #334155;
      border: 1px solid #e2e8f0;
    }

    .freq-monthly { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
    .freq-annual { background: #fefce8; color: #854d0e; border-color: #fef08a; }
    .freq-onetime { background: #e0f2fe; color: #0369a1; border-color: #bae6fd; }

    .desc-cell {
      max-width: 280px;
    }

    .desc-text {
      display: inline-block;
      max-width: 260px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #64748b;
      font-size: 0.85rem;
    }

    .order-badge {
      font-weight: 600;
      color: #64748b;
      font-size: 0.85rem;
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      user-select: none;
      transition: background 0.15s ease;
    }

    .status-chip.active {
      background: #ecfdf5;
      color: #065f46;
    }

    .status-chip.inactive {
      background: #fef2f2;
      color: #991b1b;
    }

    .status-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .action-buttons {
      white-space: nowrap;
    }

    .empty-placeholder {
      padding: 40px 20px;
      text-align: center;
      color: #94a3b8;
    }

    .empty-placeholder mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
      opacity: 0.5;
    }

    .empty-placeholder h4 {
      font-size: 1.1rem;
      color: #334155;
      margin: 0 0 6px 0;
    }

    .empty-placeholder p {
      font-size: 0.88rem;
      margin: 0;
    }

    /* Responsive adjustments */
    @media (max-width: 1024px) {
      .page-header {
        flex-direction: column;
        align-items: stretch;
        gap: 14px;
      }

      .header-actions {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }

      .filter-toolbar {
        padding: 12px 14px 4px;
        gap: 10px;

        .search-field {
          flex: 1 1 100% !important;
          width: 100%;
          min-width: 100%;
        }
        .filter-select {
          flex: 1 1 calc(50% - 10px) !important;
          min-width: 140px;
        }
        .toolbar-actions {
          flex: 1 1 100%;
          width: 100%;
          justify-content: stretch;
          button {
            width: 100%;
            justify-content: center;
          }
        }
      }
    }

    @media (max-width: 640px) {
      .fee-heads-container {
        padding: 0 0 30px;
        gap: 16px;
      }

      .page-header {
        margin-bottom: 0;
        gap: 12px;
      }

      .page-title {
        font-size: 1.25rem;
        gap: 8px;
        .title-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
        }
      }

      .page-subtitle {
        font-size: 0.8rem;
        line-height: 1.35;
      }

      .header-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;

        .catalog-btn,
        .matrix-btn {
          width: 100%;
          font-size: 0.76rem;
          height: 38px;
          padding: 0 8px;
          justify-content: center;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }

        .add-head-btn {
          grid-column: span 2;
          width: 100%;
          height: 42px;
          justify-content: center;
          font-size: 0.84rem;
        }
      }


      .form-drawer {
        padding: 14px 12px;
        margin-bottom: 16px;

        .drawer-header {
          margin-bottom: 12px;
          padding-bottom: 8px;
          .drawer-title {
            gap: 8px;
            strong { font-size: 0.98rem; }
            small { font-size: 0.72rem; }
          }
        }

        .form-row {
          gap: 10px;
          .f-flex-1,
          .f-flex-2 {
            flex: 1 1 100% !important;
            min-width: 100% !important;
            width: 100% !important;
            margin-bottom: -0.5em;
          }
        }

        .drawer-footer {
          flex-direction: column-reverse;
          gap: 8px;
          width: 100%;
          margin-top: 4px;

          button {
            width: 100%;
            height: 40px;
            justify-content: center;
          }
        }
      }

      .filter-toolbar {
        padding: 12px 12px 4px;
        gap: 8px;

        .search-field,
        .filter-select {
          flex: 1 1 100% !important;
          width: 100% !important;
          min-width: 100% !important;
          margin-bottom: -0.5em;
        }

        .toolbar-actions {
          width: 100%;
          margin: 4px 0 10px 0;
          button {
            width: 100%;
            height: 40px;
            justify-content: center;
          }
        }
      }
    }

    @media (max-width: 380px) {
      .header-actions {
        grid-template-columns: 1fr;
        .catalog-btn,
        .matrix-btn,
        .add-head-btn {
          grid-column: span 1;
        }
      }
    }
  `]
})
export class FeeHeadsComponent implements OnInit {
  displayedColumns: string[] = ['code', 'name', 'category', 'frequency', 'description', 'sortOrder', 'isActive', 'actions'];
  feeHeads: FeeHead[] = [];

  // Paging & Server state
  totalCount = 0;
  pageNumber = 1;
  pageSize = 10;
  sortBy = 'sortOrder';
  sortDescending = false;

  // Search & Filter state
  searchTerm = '';
  selectedCategory = 'All';
  selectedFrequency = 'All';
  selectedStatus: boolean | null = null;

  // KPI summary stats
  activeCount = 0;
  monthlyCount = 0;
  categoriesCount = 0;

  // Drawer / Form state
  showDrawer = false;
  isEditMode = false;
  editingHead: FeeHead | null = null;
  headForm!: FormGroup;

  loading = false;
  saving = false;

  readonly authService = inject(AuthService);
  private dialog = inject(MatDialog);

  get hasSchoolModule(): boolean { return this.authService.hasSchoolModule(); }
  get hasCoachingModule(): boolean { return this.authService.hasCoachingModule(); }
  get hasHostelModule(): boolean { return this.authService.hasHostelModule(); }
  get hasLibraryModule(): boolean { return this.authService.hasLibraryModule(); }
  get hasTransportModule(): boolean { return this.authService.hasTransportModule(); }

  getDefaultApplicableTo(): string {
    if (this.hasSchoolModule && this.hasCoachingModule) return 'Both';
    if (this.hasCoachingModule) return 'Coaching';
    return 'School';
  }

  constructor(
    private fb: FormBuilder,
    private feesService: FeesService,
    private confirmDialog: ConfirmDialogService
  ) {}

  openFeeHeadsReport(): void {
    this.dialog.open(FeeHeadsReportDialogComponent, {
      width: '1100px',
      maxWidth: '96vw',
      maxHeight: '94vh',
      panelClass: 'responsive-report-dialog',
      data: {
        initialCategory: this.selectedCategory !== 'All' ? this.selectedCategory : undefined,
        initialFrequency: this.selectedFrequency !== 'All' ? this.selectedFrequency : undefined
      }
    });
  }

  openClassFeeMatrixReport(): void {
    this.dialog.open(ClassFeeMatrixReportDialogComponent, {
      width: '1300px',
      maxWidth: '98vw',
      maxHeight: '94vh',
      panelClass: 'responsive-report-dialog',
      data: {}
    });
  }

  ngOnInit(): void {
    this.initForm();
    this.loadFeeHeadsPaged();
    this.loadKpiSummaries();
  }

  initForm(): void {
    this.headForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      category: ['Academic', Validators.required],
      frequency: ['Monthly', Validators.required],
      applicableTo: [this.getDefaultApplicableTo(), Validators.required],
      description: [''],
      sortOrder: [10, [Validators.required, Validators.min(0)]],
      isActive: [true]
    });
  }

  loadFeeHeadsPaged(): void {
    this.loading = true;
    this.feesService.getFeeHeadsPaged(
      this.pageNumber,
      this.pageSize,
      this.searchTerm,
      this.selectedCategory,
      this.selectedFrequency,
      this.selectedStatus === null ? undefined : this.selectedStatus,
      this.sortBy,
      this.sortDescending
    ).subscribe({
      next: (res) => {
        this.feeHeads = res.items || [];
        this.totalCount = res.totalCount || 0;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.confirmDialog.alert('Fetch Error', err?.error?.message || 'Failed to load fee heads from server.', 'danger');
      }
    });
  }

  loadKpiSummaries(): void {
    this.feesService.getFeeHeads(false).subscribe({
      next: (all) => {
        if (!all) return;
        this.activeCount = all.filter(h => h.isActive).length;
        this.monthlyCount = all.filter(h => h.frequency === 'Monthly' && h.isActive).length;
        this.categoriesCount = new Set(all.map(h => h.category)).size;
      },
      error: () => {}
    });
  }

  onSearch(): void {
    this.pageNumber = 1;
    this.loadFeeHeadsPaged();
  }

  onFilterChange(): void {
    this.pageNumber = 1;
    this.loadFeeHeadsPaged();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = 'All';
    this.selectedFrequency = 'All';
    this.selectedStatus = null;
    this.pageNumber = 1;
    this.sortBy = 'sortOrder';
    this.sortDescending = false;
    this.loadFeeHeadsPaged();
  }

  onSortChange(sort: Sort): void {
    if (!sort.active || sort.direction === '') {
      this.sortBy = 'sortOrder';
      this.sortDescending = false;
    } else {
      this.sortBy = sort.active;
      this.sortDescending = sort.direction === 'desc';
    }
    this.loadFeeHeadsPaged();
  }

  onPageChange(event: PageEvent): void {
    this.pageNumber = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadFeeHeadsPaged();
  }

  openAddHeadDrawer(): void {
    this.isEditMode = false;
    this.editingHead = null;
    this.headForm.reset({
      name: '',
      code: '',
      category: 'Academic',
      applicableTo: this.getDefaultApplicableTo(),
      frequency: 'Monthly',
      description: '',
      sortOrder: (this.totalCount + 1) * 10,
      isActive: true
    });
    this.showDrawer = true;
  }

  openEditHeadDrawer(head: FeeHead): void {
    this.isEditMode = true;
    this.editingHead = head;
    this.headForm.patchValue({
      name: head.name,
      code: head.code,
      category: head.category,
      applicableTo: head.applicableTo || this.getDefaultApplicableTo(),
      frequency: head.frequency,
      description: head.description || '',
      sortOrder: head.sortOrder,
      isActive: head.isActive
    });
    this.showDrawer = true;
  }

  closeDrawer(): void {
    this.showDrawer = false;
    this.editingHead = null;
  }

  onSubmitHead(): void {
    if (this.headForm.invalid) return;

    this.saving = true;
    const formVal = this.headForm.value;

    if (this.isEditMode && this.editingHead) {
      const payload: UpdateFeeHeadPayload = {
        name: formVal.name.trim(),
        code: formVal.code.trim().toUpperCase(),
        category: formVal.category,
        applicableTo: formVal.applicableTo || this.getDefaultApplicableTo(),
        frequency: formVal.frequency,
        description: formVal.description?.trim(),
        sortOrder: formVal.sortOrder || 0,
        isActive: formVal.isActive,
        isDefault: this.editingHead.isDefault
      };

      this.feesService.updateFeeHead(this.editingHead.id, payload).subscribe({
        next: (updated) => {
          this.saving = false;
          this.closeDrawer();
          this.loadFeeHeadsPaged();
          this.loadKpiSummaries();
          this.confirmDialog.alert('Fee Head Updated', `Fee Head '${updated.name}' updated successfully.`, 'success');
        },
        error: (err) => {
          this.saving = false;
          this.confirmDialog.alert('Update Failed', err?.error?.message || err?.error || 'Failed to update fee head.', 'danger');
        }
      });
    } else {
      const payload: CreateFeeHeadPayload = {
        name: formVal.name.trim(),
        code: formVal.code.trim().toUpperCase(),
        category: formVal.category,
        applicableTo: formVal.applicableTo || this.getDefaultApplicableTo(),
        frequency: formVal.frequency,
        description: formVal.description?.trim(),
        sortOrder: formVal.sortOrder || 0,
        isActive: formVal.isActive !== false,
        isDefault: false
      };

      this.feesService.saveFeeHead(payload).subscribe({
        next: (created) => {
          this.saving = false;
          this.closeDrawer();
          this.loadFeeHeadsPaged();
          this.loadKpiSummaries();
          this.confirmDialog.alert('Fee Head Created', `Fee Head '${created.name}' created successfully.`, 'success');
        },
        error: (err) => {
          this.saving = false;
          this.confirmDialog.alert('Creation Failed', err?.error?.message || err?.error || 'Failed to create fee head.', 'danger');
        }
      });
    }
  }

  onToggleStatus(head: FeeHead): void {
    const action = head.isActive ? 'Deactivate' : 'Activate';
    this.confirmDialog.confirm(
      `${action} Fee Head`,
      `Are you sure you want to ${action.toLowerCase()} fee head '${head.name}'?`,
      action
    ).subscribe((confirmed) => {
      if (confirmed) {
        this.feesService.toggleFeeHeadStatus(head.id).subscribe({
          next: (res) => {
            this.confirmDialog.alert('Status Updated', res?.message || `Fee head is now ${head.isActive ? 'Inactive' : 'Active'}.`, 'success');
            this.loadFeeHeadsPaged();
            this.loadKpiSummaries();
          },
          error: (err) => {
            this.confirmDialog.alert('Action Failed', err?.error?.message || 'Failed to toggle fee head status.', 'danger');
          }
        });
      }
    });
  }

  onDeleteHead(head: FeeHead): void {
    this.confirmDialog.danger(
      'Delete Fee Head',
      `Are you sure you want to delete '${head.name}' (${head.code})? If this head is already linked to student invoices or fee structures, it will be safely deactivated to protect accounting ledgers.`,
      'Delete'
    ).subscribe((confirmed) => {
      if (confirmed) {
        this.feesService.deleteFeeHead(head.id).subscribe({
          next: (res) => {
            this.confirmDialog.alert('Action Completed', res?.message || 'Fee head deleted successfully.', 'success');
            this.loadFeeHeadsPaged();
            this.loadKpiSummaries();
          },
          error: (err) => {
            this.confirmDialog.alert('Delete Failed', err?.error?.message || 'Failed to delete fee head.', 'danger');
          }
        });
      }
    });
  }
}
