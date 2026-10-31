import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { environment } from '../../../environments/environment';
import { API_BASE, TeacherDto, StaffPromotionIncrementDto, CreateStaffPromotionIncrementDto, BulkIncrementDto, StaffPromotionSummaryDto, StaffAppraisalPolicy, StaffPromotionsPagedResponse } from './teacher.models';

@Component({
  selector: 'app-staff-promotions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatChipsModule,
    MatDialogModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatMenuModule
  ],
  template: `
    <div class="page-container">
      <!-- Page Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">
            <mat-icon class="title-icon">military_tech</mat-icon>
            Staff Promotions &amp; Salary Appraisals
          </h1>
          <p class="page-subtitle">
            Manage faculty and staff rank promotions, annual appraisals, and salary increment revisions with historical audit logs.
          </p>
        </div>
        <div class="header-actions">
          @if (canManagePolicy) {
            <button mat-stroked-button color="primary" class="action-btn" (click)="openPolicyModal()" matTooltip="Configure Minimum Service Tenure & Appraisal Guidelines (HR / Admin)">
              <mat-icon>tune</mat-icon>
              <span>Policy Rules</span>
            </button>
          }
          <button mat-stroked-button color="primary" class="action-btn" (click)="openBulkModal()">
            <mat-icon>auto_graph</mat-icon>
            <span>Bulk Annual Hike</span>
          </button>
          <button mat-raised-button color="primary" class="action-btn primary" (click)="openDrawer()">
            <mat-icon>add_circle</mat-icon>
            <span>New Promotion / Increment</span>
          </button>
        </div>
      </div>
    
      <!-- KPI Summary Cards - Standard Compact Horizontal Layout -->
      <div class="stats-grid">
        <mat-card class="stat-card total mat-elevation-z1">
          <div class="stat-icon"><mat-icon>assessment</mat-icon></div>
          <div class="stat-info">
            <span class="stat-lbl">Total Appraisals</span>
            <div class="stat-val-row">
              <span class="stat-val">{{ summary.totalRecords }}</span>
            </div>
          </div>
        </mat-card>
    
        <mat-card class="stat-card promo mat-elevation-z1">
          <div class="stat-icon"><mat-icon>trending_up</mat-icon></div>
          <div class="stat-info">
            <span class="stat-lbl">Role Promotions</span>
            <div class="stat-val-row">
              <span class="stat-val">{{ summary.totalPromotions }}</span>
            </div>
          </div>
        </mat-card>
    
        <mat-card class="stat-card inc mat-elevation-z1">
          <div class="stat-icon"><mat-icon>payments</mat-icon></div>
          <div class="stat-info">
            <span class="stat-lbl">Salary Increments</span>
            <div class="stat-val-row">
              <span class="stat-val">{{ summary.totalIncrements }}</span>
            </div>
          </div>
        </mat-card>
    
        <mat-card class="stat-card budget mat-elevation-z1">
          <div class="stat-icon"><mat-icon>currency_rupee</mat-icon></div>
          <div class="stat-info">
            <span class="stat-lbl">Monthly Budget Hike</span>
            <div class="stat-val-row">
              <span class="stat-val">₹{{ summary.totalMonthlyGrossHike | number:'1.0-0' }}</span>
              @if (summary.averageHikePercentage > 0) {
                <span class="stat-sub-pill">
                  Avg +{{ summary.averageHikePercentage }}%
                </span>
              }
            </div>
          </div>
        </mat-card>
      </div>
    
      <!-- Filter & Search Toolbar with Smart View Switcher -->
      <mat-card class="filter-card mat-elevation-z1">
        <div class="filter-toolbar">
          <div class="search-box">
            <mat-icon>search</mat-icon>
            <input
              type="text"
              placeholder="Search staff name, code, designation, or cycle..."
              [(ngModel)]="searchQuery"
              (ngModelChange)="onSearchInput($event)"
              (keyup.enter)="loadData()"
              />
            @if (searchQuery) {
              <button type="button" class="clear-btn" (click)="clearSearch()">
                <mat-icon>close</mat-icon>
              </button>
            }
          </div>
    
          <div class="filter-selects">
            <mat-form-field appearance="outline" class="mini-field" subscriptSizing="dynamic">
              <mat-label>Staff Type</mat-label>
              <mat-select [(ngModel)]="selectedStaffType" (selectionChange)="onFilterChange()">
                <mat-option value="All">All Staff Types</mat-option>
                <mat-option value="Teaching">Teaching Faculty</mat-option>
                <mat-option value="NonTeaching">Non-Teaching / HR</mat-option>
                <mat-option value="Administrative">Administrative</mat-option>
                <mat-option value="Support">Support Staff</mat-option>
              </mat-select>
            </mat-form-field>
    
            <mat-form-field appearance="outline" class="mini-field" subscriptSizing="dynamic">
              <mat-label>Appraisal Type</mat-label>
              <mat-select [(ngModel)]="selectedType" (selectionChange)="onFilterChange()">
                <mat-option value="">All Types</mat-option>
                <mat-option value="PromotionAndIncrement">Promotion + Increment</mat-option>
                <mat-option value="Increment">Salary Increment Only</mat-option>
                <mat-option value="Promotion">Promotion Only</mat-option>
              </mat-select>
            </mat-form-field>
    
            <mat-form-field appearance="outline" class="mini-field cycle-field" subscriptSizing="dynamic">
              <mat-label>Appraisal Cycle</mat-label>
              <mat-select [(ngModel)]="selectedCycle" (selectionChange)="onFilterChange()">
                <mat-option value="All">All Cycles</mat-option>
                @for (c of distinctCycles; track c) {
                  <mat-option [value]="c">{{ c }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
    
          <!-- Smart View Mode Toggle & Total Counter -->
          <div class="filter-controls-right">
            <div class="records-count-chip">
              <strong>{{ totalCount }}</strong> Appraisals
            </div>
            <div class="view-mode-toggle">
              <button
                type="button"
                class="view-toggle-btn"
                [class.active]="viewMode === 'table'"
                (click)="viewMode = 'table'"
                matTooltip="Table View (Dense & Detailed)"
                >
                <mat-icon>table_chart</mat-icon>
                <span>Table</span>
              </button>
              <button
                type="button"
                class="view-toggle-btn"
                [class.active]="viewMode === 'grid'"
                (click)="viewMode = 'grid'"
                matTooltip="Smart Card Grid View"
                >
                <mat-icon>grid_view</mat-icon>
                <span>Cards</span>
              </button>
            </div>
          </div>
        </div>
      </mat-card>
    
      <!-- Main Data Records Container -->
      @if (records.length > 0 || loading) {
        <div class="records-container">
          <!-- 1. Smart Table View -->
          @if (viewMode === 'table') {
            <div class="table-responsive" [class.table-loading]="loading">
              <!-- Prominent Server Loader Overlay -->
              @if (loading) {
                <div class="table-loading-overlay">
                  <div class="loading-spinner-box">
                    <div class="spinner-ring"></div>
                    <span>Fetching server records...</span>
                  </div>
                </div>
              }
              <table class="erp-table">
                <thead>
                  <tr>
                    <th class="sortable" (click)="onSort('teacherName')" matTooltip="Click to sort by Staff Member">
                      <div class="th-content">
                        <span>Staff Member</span>
                        <mat-icon class="sort-icon" [class.active]="isSorted('teacherName')">{{ getSortIcon('teacherName') }}</mat-icon>
                      </div>
                    </th>
                    <th class="sortable" (click)="onSort('type')" matTooltip="Click to sort by Appraisal Type">
                      <div class="th-content">
                        <span>Appraisal Type</span>
                        <mat-icon class="sort-icon" [class.active]="isSorted('type')">{{ getSortIcon('type') }}</mat-icon>
                      </div>
                    </th>
                    <th class="sortable" (click)="onSort('newDesignation')" matTooltip="Click to sort by Designation">
                      <div class="th-content">
                        <span>Designation Shift</span>
                        <mat-icon class="sort-icon" [class.active]="isSorted('newDesignation')">{{ getSortIcon('newDesignation') }}</mat-icon>
                      </div>
                    </th>
                    <th class="sortable" (click)="onSort('newGrossSalary')" matTooltip="Click to sort by Revised Gross CTC">
                      <div class="th-content">
                        <span>Salary Revision (Gross CTC)</span>
                        <mat-icon class="sort-icon" [class.active]="isSorted('newGrossSalary')">{{ getSortIcon('newGrossSalary') }}</mat-icon>
                      </div>
                    </th>
                    <th class="sortable" (click)="onSort('effectiveDate')" matTooltip="Click to sort by Effective Date">
                      <div class="th-content">
                        <span>Effective Date</span>
                        <mat-icon class="sort-icon" [class.active]="isSorted('effectiveDate')">{{ getSortIcon('effectiveDate') }}</mat-icon>
                      </div>
                    </th>
                    <th class="sortable" (click)="onSort('reason')" matTooltip="Click to sort by Reason/Cycle">
                      <div class="th-content">
                        <span>Reason / Cycle</span>
                        <mat-icon class="sort-icon" [class.active]="isSorted('reason')">{{ getSortIcon('reason') }}</mat-icon>
                      </div>
                    </th>
                    <th class="text-center actions-th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of records; track r) {
                    <tr class="table-data-row" (click)="openDetailDrawer(r)">
                      <td>
                        <div class="staff-id-cell">
                          <div class="staff-avatar">
                            @if (getStaffPhoto(r) && !imgErrors[r.teacherId]) {
                              <img
                                [src]="getStaffPhoto(r)"
                                (error)="imgErrors[r.teacherId] = true"
                                class="staff-photo-img"
                                [alt]="r.teacherName"
                                />
                            }
                            @if (!getStaffPhoto(r) || imgErrors[r.teacherId]) {
                              <div class="staff-initials-avatar">
                                {{ getInitials(r.teacherName) }}
                              </div>
                            }
                          </div>
                          <div>
                            <strong class="staff-name">{{ r.teacherName }}</strong>
                            <div class="staff-meta">
                              <span class="code-badge">{{ r.employeeCode }}</span>
                              <span class="type-pill" [class.teaching]="r.staffType === 'Teaching'">{{ r.staffType }}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span class="type-badge" [ngClass]="getTypeBadgeClass(r.type)">
                          {{ getTypeText(r.type) }}
                        </span>
                      </td>
                      <td>
                        @if (r.oldDesignation !== r.newDesignation || r.type === 'Promotion' || r.type === 'PromotionAndIncrement') {
                          <div class="shift-cell">
                            <span class="old-role">{{ r.oldDesignation }}</span>
                            <mat-icon class="arrow-icon">arrow_forward</mat-icon>
                            <strong class="new-role">{{ r.newDesignation }}</strong>
                          </div>
                        }
                        @if (r.oldDesignation === r.newDesignation && r.type === 'Increment') {
                          <span class="no-change">
                            {{ r.newDesignation }} (No change)
                          </span>
                        }
                      </td>
                      <td>
                        @if (r.newGrossSalary > 0) {
                          <div class="salary-cell">
                            <div class="salary-row">
                              <span class="old-sal">₹{{ r.oldGrossSalary | number:'1.0-0' }}</span>
                              <mat-icon class="arrow-icon">arrow_forward</mat-icon>
                              <strong class="new-sal">₹{{ r.newGrossSalary | number:'1.0-0' }}</strong>
                            </div>
                            @if (r.newGrossSalary > r.oldGrossSalary) {
                              <div class="hike-badge">
                                <mat-icon>trending_up</mat-icon>
                                <span>+₹{{ (r.newGrossSalary - r.oldGrossSalary) | number:'1.0-0' }} (+{{ r.incrementPercentage }}%)</span>
                              </div>
                            }
                          </div>
                        }
                        @if (r.type === 'Promotion' && r.newGrossSalary === r.oldGrossSalary) {
                          <span class="no-change">
                            ₹{{ r.oldGrossSalary | number:'1.0-0' }} (Unchanged)
                          </span>
                        }
                      </td>
                      <td>
                        <div class="date-cell">
                          <span class="date-text">{{ r.effectiveDate | date:'dd MMM yyyy' }}</span>
                        </div>
                      </td>
                      <td>
                        <span class="reason-pill" [matTooltip]="r.reason + (r.remarks ? ' • ' + r.remarks : '')">
                          {{ formatReason(r.reason) }}
                        </span>
                      </td>
                      <td class="text-center actions-td" (click)="$event.stopPropagation()">
                        <button mat-icon-button [matMenuTriggerFor]="rowMenu" class="action-menu-btn" matTooltip="More Actions">
                          <mat-icon>more_vert</mat-icon>
                        </button>
                        <mat-menu #rowMenu="matMenu" xPosition="before" class="appraisal-action-menu">
                          <button mat-menu-item (click)="openDetailDrawer(r)">
                            <mat-icon style="color: #2563eb;">visibility</mat-icon>
                            <span>View Details</span>
                          </button>
                          <button mat-menu-item (click)="viewLetter(r)">
                            <mat-icon style="color: #0284c7;">description</mat-icon>
                            <span>Official Letter</span>
                          </button>
                          <button mat-menu-item (click)="deleteRecord(r)">
                            <mat-icon style="color: #ef4444;">delete_outline</mat-icon>
                            <span style="color: #ef4444;">Delete Record</span>
                          </button>
                        </mat-menu>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
          <!-- 2. Smart Compact Card Grid View -->
          @if (viewMode === 'grid') {
            <div class="smart-cards-grid" [class.table-loading]="loading">
              <!-- Prominent Server Loader Overlay -->
              @if (loading) {
                <div class="table-loading-overlay">
                  <div class="loading-spinner-box">
                    <div class="spinner-ring"></div>
                    <span>Fetching server records...</span>
                  </div>
                </div>
              }
              @for (r of records; track r) {
                <div class="smart-record-card">
                  <div class="card-accent-bar" [ngClass]="getTypeBadgeClass(r.type)"></div>
                  <div class="card-top-header">
                    <div class="staff-header-left">
                      <div class="staff-card-avatar">
                        @if (getStaffPhoto(r) && !imgErrors[r.teacherId]) {
                          <img
                            [src]="getStaffPhoto(r)"
                            (error)="imgErrors[r.teacherId] = true"
                            class="staff-photo-img"
                            [alt]="r.teacherName"
                            />
                        }
                        @if (!getStaffPhoto(r) || imgErrors[r.teacherId]) {
                          <div class="staff-initials-avatar">
                            {{ getInitials(r.teacherName) }}
                          </div>
                        }
                      </div>
                      <div class="staff-card-title">
                        <strong class="teacher-title">{{ r.teacherName }}</strong>
                        <div class="meta-row">
                          <span class="code-tag">{{ r.employeeCode }}</span>
                          <span class="type-pill" [class.teaching]="r.staffType === 'Teaching'">{{ r.staffType }}</span>
                        </div>
                      </div>
                    </div>
                    <span class="type-badge" [ngClass]="getTypeBadgeClass(r.type)">
                      {{ getTypeText(r.type) }}
                    </span>
                  </div>
                  <!-- Compact Metrics Grid -->
                  <div class="card-metrics-box">
                    <div class="metric-row">
                      <span class="metric-label">Role Shift:</span>
                      <div class="shift-cell">
                        @if (r.oldDesignation !== r.newDesignation) {
                          <span class="old-role">{{ r.oldDesignation }}</span>
                        }
                        @if (r.oldDesignation !== r.newDesignation) {
                          <mat-icon class="arrow-icon">arrow_forward</mat-icon>
                        }
                        <strong class="new-role">{{ r.newDesignation }}</strong>
                      </div>
                    </div>
                    @if (r.newGrossSalary > 0) {
                      <div class="metric-row">
                        <span class="metric-label">Gross CTC:</span>
                        <div class="salary-inline-cell">
                          <span class="old-sal">₹{{ r.oldGrossSalary | number:'1.0-0' }}</span>
                          <mat-icon class="arrow-icon">arrow_forward</mat-icon>
                          <strong class="new-sal">₹{{ r.newGrossSalary | number:'1.0-0' }}</strong>
                          @if (r.newGrossSalary > r.oldGrossSalary) {
                            <span class="hike-chip">
                              +{{ r.incrementPercentage }}%
                            </span>
                          }
                        </div>
                      </div>
                    }
                    <div class="metric-row-footer">
                      <span class="date-tag">
                        <mat-icon>calendar_today</mat-icon>
                        {{ r.effectiveDate | date:'dd MMM yyyy' }}
                      </span>
                      <span class="cycle-tag" [matTooltip]="r.remarks || ''">
                        {{ r.reason || 'Appraisal' }}
                      </span>
                    </div>
                  </div>
                  <div class="card-action-bar">
                    <button mat-button class="card-btn inspect" (click)="openDetailDrawer(r)">
                      <mat-icon>visibility</mat-icon>
                      <span>Details</span>
                    </button>
                    <div class="right-actions">
                      <button mat-stroked-button class="card-btn letter" (click)="viewLetter(r)" matTooltip="View / Print Letter">
                        <mat-icon>description</mat-icon>
                        <span>Letter</span>
                      </button>
                      <button mat-icon-button class="card-icon-btn delete" (click)="deleteRecord(r)" matTooltip="Delete Record">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </div>
                  </div>
                </div>
              }
            </div>
          }
          <!-- 3. Smart Pagination Bar -->
          @if (totalCount > 0 || records.length > 0) {
            <div class="pagination-container">
              <div class="pagination-info">
                Showing <strong>{{ totalCount > 0 ? (currentPage - 1) * pageSize + 1 : (records.length > 0 ? 1 : 0) }}</strong> to
                <strong>{{ min(currentPage * pageSize, totalCount || records.length) }}</strong> of
                <strong>{{ totalCount || records.length }}</strong> records
              </div>
              <div class="pagination-controls">
                <div class="page-size-selector">
                  <span>Rows per page:</span>
                  <select [ngModel]="pageSize" (ngModelChange)="onPageSizeChange($event)">
                    @for (opt of pageSizeOptions; track opt) {
                      <option [value]="opt">{{ opt }}</option>
                    }
                  </select>
                </div>
                <div class="page-nav-btns">
                  <button
                    type="button"
                    class="page-nav-btn"
                    [disabled]="currentPage === 1 || loading"
                    (click)="prevPage()"
                    matTooltip="Previous Page"
                    >
                    <mat-icon>chevron_left</mat-icon>
                  </button>
                  <span class="page-counter">
                    Page <strong>{{ currentPage }}</strong> of <strong>{{ totalPages }}</strong>
                  </span>
                  <button
                    type="button"
                    class="page-nav-btn"
                    [disabled]="currentPage >= totalPages || loading"
                    (click)="nextPage()"
                    matTooltip="Next Page"
                    >
                    <mat-icon>chevron_right</mat-icon>
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    
      <!-- Empty State -->
      @if (!loading && records.length === 0) {
        <div class="empty-state">
          <div class="empty-icon-wrap">
            <mat-icon>military_tech</mat-icon>
          </div>
          <h3>No Promotion or Appraisal Records Found</h3>
          <p>Record employee promotions and salary revisions with zero-gap historical audit tracking.</p>
          <button mat-raised-button color="primary" class="primary-btn" (click)="openDrawer()">
            <mat-icon>add_circle</mat-icon>
            <span>Record First Promotion / Increment</span>
          </button>
        </div>
      }
    
      <!-- New Promotion / Appraisal Drawer / Modal -->
      @if (showDrawer) {
        <div class="modal-overlay" (click)="closeDrawer()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <!-- Strict Light Blue Header matching AGENTS.md rule -->
            <div class="modal-header">
              <div class="header-left">
                <div class="header-icon-box">
                  <mat-icon>military_tech</mat-icon>
                </div>
                <div class="header-title-box">
                  <h2 class="modal-title">Record Promotion &amp; Salary Increment</h2>
                  <p class="modal-subtitle">Official Staff Appraisal, Cadre Upgrade &amp; CTC Revision</p>
                </div>
              </div>
              <button mat-icon-button class="close-btn" (click)="closeDrawer()" matTooltip="Close">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="modal-body">
              <!-- 1. Staff Selector with In-Dropdown Search -->
              <div class="form-group">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Select Faculty / Staff Member</mat-label>
                  <mat-select
                    [(ngModel)]="formData.teacherId"
                    (selectionChange)="onTeacherSelect()"
                    placeholder="Choose employee..."
                    (openedChange)="onStaffSelectOpened($event)"
                    panelClass="staff-searchable-select-panel"
                    >
                    <mat-select-trigger>
                      @if (selectedTeacher) {
                        <span>
                          <strong>{{ selectedTeacher.fullName }}</strong> ({{ selectedTeacher.employeeCode }}) &bull; {{ selectedTeacher.designation || 'Staff' }}
                        </span>
                      }
                    </mat-select-trigger>
                    <!-- Sticky Search Option inside Dropdown Panel -->
                    <mat-option disabled class="dropdown-search-option">
                      <div class="dropdown-search-box" (click)="$event.stopPropagation()" (mousedown)="$event.stopPropagation()">
                        <mat-icon class="search-box-icon">search</mat-icon>
                        <input
                          id="staff-dropdown-search-input"
                          type="text"
                          class="search-inner-input"
                          placeholder="Search by name, employee code, role, department..."
                          [(ngModel)]="staffSearchQuery"
                          (input)="filterTeachersForSelect()"
                          (click)="$event.stopPropagation()"
                          (mousedown)="$event.stopPropagation()"
                          (keydown)="$event.stopPropagation()"
                          />
                        @if (staffSearchQuery) {
                          <button
                            type="button"
                            class="clear-mini-btn"
                            (click)="clearStaffSearch($event)"
                            (mousedown)="$event.stopPropagation()"
                            >
                            <mat-icon>close</mat-icon>
                          </button>
                        }
                      </div>
                      <div class="search-meta-bar">
                        <span>Showing <strong>{{ filteredTeachersForSelect.length }}</strong> of {{ teachers.length }} staff</span>
                      </div>
                    </mat-option>
                    <!-- No Results State -->
                    @if (filteredTeachersForSelect.length === 0) {
                      <mat-option disabled class="no-results-option">
                        <div class="no-results-wrap">
                          <mat-icon>search_off</mat-icon>
                          <span>No staff found matching "<strong>{{ staffSearchQuery }}</strong>"</span>
                        </div>
                      </mat-option>
                    }
                    <!-- Filtered Staff Options -->
                    @for (t of filteredTeachersForSelect; track t) {
                      <mat-option [value]="t.id" class="staff-option-item">
                        <div class="staff-option-content">
                          <div class="staff-opt-title">
                            <strong>{{ t.fullName }}</strong>
                            <span class="staff-opt-code">({{ t.employeeCode }})</span>
                            <span class="staff-opt-type" [class.teaching]="t.staffType === 'Teaching'">{{ t.staffType || 'Staff' }}</span>
                          </div>
                          <div class="staff-opt-subtitle">
                            <span>{{ t.designation || 'Faculty' }}</span>
                            @if (t.department) {
                              <span>&bull; {{ t.department }}</span>
                            }
                          </div>
                        </div>
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>
              <!-- Current Profile Preview Box -->
              @if (selectedTeacher) {
                <div class="current-profile-box">
                  <div class="prof-avatar">
                    <mat-icon>{{ selectedTeacher.staffType === 'Teaching' ? 'school' : 'badge' }}</mat-icon>
                  </div>
                  <div class="prof-details">
                    <div class="prof-name-row">
                      <strong>{{ selectedTeacher.fullName }}</strong>
                      <span class="code-badge">({{ selectedTeacher.employeeCode }})</span>
                      <span class="type-pill">{{ selectedTeacher.staffType || 'Teaching' }}</span>
                    </div>
                    <div class="prof-meta-row">
                      <span>Current Designation: <strong>{{ selectedTeacher.designation || 'Faculty' }}</strong></span>
                      @if (selectedTeacher.department) {
                        <span>&bull; Dept: <strong>{{ selectedTeacher.department }}</strong></span>
                      }
                    </div>
                    @if (currentSalaryInfo) {
                      <div class="prof-salary-row">
                        <span>Current Basic: <strong>₹{{ currentSalaryInfo.basicSalary | number:'1.0-0' }}</strong></span>
                        <span>&bull; HRA: <strong>₹{{ currentSalaryInfo.hra | number:'1.0-0' }}</strong></span>
                        <span>&bull; Allowances: <strong>₹{{ currentSalaryInfo.otherAllowances | number:'1.0-0' }}</strong></span>
                        <span>&bull; Current Gross: <strong class="text-primary">₹{{ currentSalaryInfo.grossSalary | number:'1.0-0' }}</strong></span>
                      </div>
                    }
                    <!-- Joining Date & Service Tenure -->
                    @if (selectedTeacher) {
                      <div class="prof-tenure-row">
                        <span>Joining: <strong>{{ (selectedTeacher.joiningDate || selectedTeacher.createdAt) | date:'mediumDate' }}</strong></span>
                        <span>&bull; Service Tenure: <strong [class.text-amber]="isUnderProbation" [class.text-green]="!isUnderProbation">{{ selectedTeacherTenureDisplay }}</strong></span>
                        @if (isUnderProbation) {
                          <span class="probation-tag">
                            <mat-icon>hourglass_top</mat-icon> Under Policy Threshold (&lt; {{ policy.minServiceMonthsForIncrement }} Mo)
                          </span>
                        }
                      </div>
                    }
                    @if (!currentSalaryInfo) {
                      <div class="prof-salary-missing-row">
                        <mat-icon class="warn-icon">warning_amber</mat-icon>
                        <span>Salary Structure not configured yet (संरचना नहीं बनी है).</span>
                        <a [routerLink]="['/teachers/salary']" [queryParams]="{ teacherId: selectedTeacher.id }" target="_blank" class="configure-link">
                          Define Salary Structure &rarr;
                        </a>
                      </div>
                    }
                  </div>
                </div>
              }
              <!-- 2. Appraisal Operation Mode -->
              <div class="form-group">
                <label class="section-label">Select Action Type:</label>
                <div class="mode-chips">
                  <button
                    type="button"
                    class="mode-chip"
                    [class.active]="formData.type === 'PromotionAndIncrement'"
                    (click)="setMode('PromotionAndIncrement')"
                    >
                    <mat-icon>auto_awesome</mat-icon>
                    <span>Promotion + Salary Increment</span>
                  </button>
                  <button
                    type="button"
                    class="mode-chip"
                    [class.active]="formData.type === 'Increment'"
                    (click)="setMode('Increment')"
                    >
                    <mat-icon>payments</mat-icon>
                    <span>Salary Increment Only</span>
                  </button>
                  <button
                    type="button"
                    class="mode-chip"
                    [class.active]="formData.type === 'Promotion'"
                    (click)="setMode('Promotion')"
                    >
                    <mat-icon>trending_up</mat-icon>
                    <span>Promotion Only (Dry)</span>
                  </button>
                </div>
                <!-- Probation Policy Advisory & Special Bypass -->
                @if (isUnderProbation) {
                  <div class="probation-policy-banner">
                    <div class="banner-top">
                      <mat-icon class="banner-icon">info</mat-icon>
                      <div class="banner-text">
                        <strong>Tenure Policy Advisory:</strong>
                        Staff member has completed <strong>{{ selectedTeacherTenureDisplay }}</strong> of service. Institute policy requires minimum <strong>{{ policy.minServiceMonthsForIncrement }} months</strong> for financial increments.
                        @if (policy.enforceDryPromotionInProbation) {
                          <span>
                            <em>"Promotion Only (Dry)"</em> is recommended during initial service duration.
                          </span>
                        }
                      </div>
                    </div>
                    @if (policy.allowSpecialBypass && canManagePolicy) {
                      <div class="bypass-box">
                        <mat-checkbox [(ngModel)]="formData.isSpecialBypass" (ngModelChange)="onBypassToggle()" color="primary">
                          <span class="bypass-chk-lbl">
                            <strong>Special Management / HR Approval Bypass (विशेष अनुमोदन)</strong>
                            <small>Authorize salary increment for staff under probation with approval justification</small>
                          </span>
                        </mat-checkbox>
                        @if (formData.isSpecialBypass) {
                          <div class="bypass-reason-wrap">
                            <mat-form-field appearance="outline" class="full-width">
                              <mat-label>Bypass Justification / Approval Authority Note *</mat-label>
                              <input matInput [(ngModel)]="formData.specialBypassReason" placeholder="e.g. Approved by Director / HR Committee for exceptional performance" />
                            </mat-form-field>
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
              <!-- 3. Promotion Section (If Mode involves Promotion) -->
              @if (formData.type === 'Promotion' || formData.type === 'PromotionAndIncrement') {
                <div class="section-box">
                  <div class="sec-title">
                    <mat-icon>badge</mat-icon>
                    <span>New Designation &amp; Department Details</span>
                  </div>
                  <div class="form-row">
                    <mat-form-field appearance="outline" class="flex-1">
                      <mat-label>New Designation (पद)</mat-label>
                      <input matInput [(ngModel)]="formData.newDesignation" placeholder="e.g. Senior PGT / HOD / Vice Principal / HR Manager" />
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="flex-1">
                      <mat-label>New Department (विभाग)</mat-label>
                      <mat-select
                        [(ngModel)]="formData.newDepartment"
                        placeholder="Select Department..."
                        (openedChange)="onDeptSelectOpened($event)"
                        panelClass="dept-searchable-select-panel"
                        >
                        <mat-select-trigger>
                          <span>{{ formData.newDepartment }}</span>
                        </mat-select-trigger>
                        <!-- Search Header inside Department Dropdown -->
                        <mat-option disabled class="dropdown-search-option">
                          <div class="dropdown-search-box" (click)="$event.stopPropagation()" (mousedown)="$event.stopPropagation()">
                            <mat-icon class="search-box-icon">search</mat-icon>
                            <input
                              id="dept-dropdown-search-input"
                              type="text"
                              class="search-inner-input"
                              placeholder="Search or filter department..."
                              [(ngModel)]="departmentSearchQuery"
                              (input)="filterDepartments()"
                              (click)="$event.stopPropagation()"
                              (mousedown)="$event.stopPropagation()"
                              (keydown)="$event.stopPropagation()"
                              />
                            @if (departmentSearchQuery) {
                              <button
                                type="button"
                                class="clear-mini-btn"
                                (click)="clearDeptSearch($event)"
                                (mousedown)="$event.stopPropagation()"
                                >
                                <mat-icon>close</mat-icon>
                              </button>
                            }
                          </div>
                        </mat-option>
                        <!-- Option for current department if not in standard list -->
                        @if (formData.newDepartment && !departments.includes(formData.newDepartment)) {
                          <mat-option [value]="formData.newDepartment">
                            <div class="dept-opt-item">
                              <mat-icon class="dept-icon">apartment</mat-icon>
                              <strong>{{ formData.newDepartment }}</strong>
                              <small style="color: #64748b; margin-left: 6px;">(Current)</small>
                            </div>
                          </mat-option>
                        }
                        <!-- Dynamic API Departments -->
                        @for (d of filteredDepartments; track d) {
                          <mat-option [value]="d">
                            <div class="dept-opt-item">
                              <mat-icon class="dept-icon">apartment</mat-icon>
                              <span>{{ d }}</span>
                            </div>
                          </mat-option>
                        }
                        @if (filteredDepartments.length === 0) {
                          <mat-option disabled class="no-results-option">
                            <div class="no-results-wrap">
                              <mat-icon>search_off</mat-icon>
                              <span>No department found matching "{{ departmentSearchQuery }}"</span>
                            </div>
                          </mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  </div>
                  <div class="quick-roles-row">
                    <span class="quick-lbl">Suggestions:</span>
                    @for (r of roleSuggestions; track r) {
                      <span class="quick-role-chip" (click)="formData.newDesignation = r">{{ r }}</span>
                    }
                  </div>
                </div>
              }
              <!-- 4. Salary Increment Section (If Mode involves Increment) -->
              @if (formData.type === 'Increment' || formData.type === 'PromotionAndIncrement') {
                <div class="section-box">
                  <div class="sec-title">
                    <mat-icon>currency_rupee</mat-icon>
                    <span>Salary Increment Revision</span>
                  </div>
                  <!-- Fast Calculation Tools -->
                  <div class="calc-toolbar">
                    <div class="calc-group">
                      <label>Percentage Hike (%):</label>
                      <div class="pct-input-wrap">
                        <input type="number" [(ngModel)]="hikePercent" (ngModelChange)="applyPercentHike()" placeholder="10" min="0" max="100" />
                        <span>%</span>
                      </div>
                    </div>
                    <div class="quick-pct-chips">
                      <button type="button" (click)="hikePercent = 5; applyPercentHike()">+5%</button>
                      <button type="button" (click)="hikePercent = 10; applyPercentHike()">+10%</button>
                      <button type="button" (click)="hikePercent = 15; applyPercentHike()">+15%</button>
                      <button type="button" (click)="hikePercent = 20; applyPercentHike()">+20%</button>
                    </div>
                  </div>
                  <div class="form-row three-cols">
                    <mat-form-field appearance="outline" class="flex-1">
                      <mat-label>New Basic Salary (₹)</mat-label>
                      <input matInput type="number" [(ngModel)]="formData.newBasicSalary" (ngModelChange)="recalcGross()" />
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="flex-1">
                      <mat-label>New HRA (₹)</mat-label>
                      <input matInput type="number" [(ngModel)]="formData.newHRA" (ngModelChange)="recalcGross()" />
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="flex-1">
                      <mat-label>New Other Allowances (₹)</mat-label>
                      <input matInput type="number" [(ngModel)]="formData.newOtherAllowances" (ngModelChange)="recalcGross()" />
                    </mat-form-field>
                  </div>
                  <!-- Live Comparison Card -->
                  <div class="live-comparison-card">
                    <div class="comp-col">
                      <span class="comp-lbl">Current Gross CTC:</span>
                      <strong class="comp-val">₹{{ currentOldGross | number:'1.0-0' }}</strong>
                    </div>
                    <mat-icon class="comp-arrow">arrow_forward</mat-icon>
                    <div class="comp-col">
                      <span class="comp-lbl">Revised Gross CTC:</span>
                      <strong class="comp-val new">₹{{ currentNewGross | number:'1.0-0' }}</strong>
                    </div>
                    @if (currentNewGross > currentOldGross) {
                      <div class="comp-delta">
                        <span class="delta-amt">+₹{{ (currentNewGross - currentOldGross) | number:'1.0-0' }} / mo</span>
                        <span class="delta-pct">(+{{ computedHikePct }}% Hike)</span>
                      </div>
                    }
                  </div>
                </div>
              }
              <!-- 5. Effective Date & Dynamic Reason / Cycle -->
              <div class="form-row">
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Effective Date (लागू होने की तिथि)</mat-label>
                  <input matInput type="date" [(ngModel)]="effectiveDateStr" (ngModelChange)="calcTeacherTenure()" />
                  <mat-hint>Date from which new designation and salary takes effect</mat-hint>
                </mat-form-field>
                <div class="flex-1 cycle-input-wrap">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Appraisal Cycle / Reason</mat-label>
                    <input matInput [(ngModel)]="formData.reason" placeholder="Type cycle name or choose from suggestions..." />
                    @if (formData.reason) {
                      <button matSuffix mat-icon-button type="button" (click)="formData.reason = ''" matTooltip="Clear">
                        <mat-icon>close</mat-icon>
                      </button>
                    }
                    <mat-hint>Dynamic cycle name set from UI</mat-hint>
                  </mat-form-field>
                  @if (availableCycles.length > 0) {
                    <div class="quick-roles-row">
                      <span class="quick-lbl">Suggestions:</span>
                      @for (c of availableCycles; track c) {
                        <span
                          class="quick-role-chip"
                          (click)="formData.reason = c"
                          [class.selected]="formData.reason === c"
                          >
                          {{ c }}
                        </span>
                      }
                    </div>
                  }
                </div>
              </div>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Appraisal Remarks / Notes (टिप्पणी)</mat-label>
                <textarea matInput [(ngModel)]="formData.remarks" rows="2" placeholder="Management notes, approval reference, or appraisal committee remarks..."></textarea>
              </mat-form-field>
            </div>
            <div class="modal-footer">
              <button mat-button class="btn-cancel" (click)="closeDrawer()" [disabled]="submitting">Cancel</button>
              <button mat-flat-button color="primary" class="btn-save" (click)="savePromotion()" [disabled]="submitting || !formData.teacherId">
                <mat-icon>{{ submitting ? 'hourglass_empty' : 'check_circle' }}</mat-icon>
                <span>{{ submitting ? 'Processing...' : 'Approve & Save Appraisal' }}</span>
              </button>
            </div>
          </div>
        </div>
      }
    
      <!-- Bulk Annual Increment Modal -->
      @if (showBulkModal) {
        <div class="modal-overlay" (click)="closeBulkModal()">
          <div class="modal-card bulk-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div class="header-left">
                <div class="header-icon-box">
                  <mat-icon>auto_graph</mat-icon>
                </div>
                <div class="header-title-box">
                  <h2 class="modal-title">Bulk Annual Salary Increment</h2>
                  <p class="modal-subtitle">Apply mass percentage or flat increment across department/grade</p>
                </div>
              </div>
              <button mat-icon-button class="close-btn" (click)="closeBulkModal()">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="modal-body">
              <div class="bulk-info-note">
                <mat-icon>info</mat-icon>
                <span>This tool applies salary increments to all active staff in the selected group. Historical logs and salary structures will be updated automatically.</span>
              </div>
              <div class="form-row">
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Target Staff Category</mat-label>
                  <mat-select [(ngModel)]="bulkData.staffType">
                    <mat-option value="All">All Staff Members</mat-option>
                    <mat-option value="Teaching">Teaching Faculty Only</mat-option>
                    <mat-option value="NonTeaching">Non-Teaching Staff Only</mat-option>
                    <mat-option value="Administrative">Administrative Staff</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Increment Type</mat-label>
                  <mat-select [(ngModel)]="bulkData.incrementType">
                    <mat-option value="Percentage">Percentage (%) Hike</mat-option>
                    <mat-option value="FixedAmount">Flat Fixed Amount (+₹)</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
              <div class="form-row">
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>{{ bulkData.incrementType === 'Percentage' ? 'Hike Percentage (%)' : 'Flat Amount (₹)' }}</mat-label>
                  <input matInput type="number" [(ngModel)]="bulkData.incrementValue" placeholder="e.g. 10" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Effective Date</mat-label>
                  <input matInput type="date" [(ngModel)]="bulkEffectiveDateStr" />
                </mat-form-field>
              </div>
              <div class="form-group full-width cycle-input-wrap">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Appraisal Cycle / Reason Description</mat-label>
                  <input matInput [(ngModel)]="bulkData.reason" placeholder="Type cycle name or choose from suggestions..." />
                  @if (bulkData.reason) {
                    <button matSuffix mat-icon-button type="button" (click)="bulkData.reason = ''" matTooltip="Clear">
                      <mat-icon>close</mat-icon>
                    </button>
                  }
                  <mat-hint>Dynamic cycle name recorded in audit log for all staff</mat-hint>
                </mat-form-field>
                @if (availableCycles.length > 0) {
                  <div class="quick-roles-row">
                    <span class="quick-lbl">Suggestions:</span>
                    @for (c of availableCycles; track c) {
                      <span
                        class="quick-role-chip"
                        (click)="bulkData.reason = c"
                        [class.selected]="bulkData.reason === c"
                        >
                        {{ c }}
                      </span>
                    }
                  </div>
                }
              </div>
            </div>
            <div class="modal-footer">
              <button mat-button class="btn-cancel" (click)="closeBulkModal()" [disabled]="submitting">Cancel</button>
              <button mat-flat-button color="primary" class="btn-save" (click)="executeBulkIncrement()" [disabled]="submitting || !bulkData.incrementValue">
                <mat-icon>{{ submitting ? 'hourglass_empty' : 'bolt' }}</mat-icon>
                <span>{{ submitting ? 'Applying...' : 'Apply Bulk Increment' }}</span>
              </button>
            </div>
          </div>
        </div>
      }
    
      <!-- Appraisal Letter Preview & Print Modal -->
      @if (showLetterModal) {
        <div class="modal-overlay" (click)="showLetterModal = false">
          <div class="modal-card letter-modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div class="header-left">
                <div class="header-icon-box">
                  <mat-icon>description</mat-icon>
                </div>
                <div class="header-title-box">
                  <h2 class="modal-title">Official Appraisal &amp; Promotion Letter</h2>
                  <p class="modal-subtitle">Official Institute Letterhead Format</p>
                </div>
              </div>
              <button mat-icon-button class="close-btn" (click)="showLetterModal = false">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            @if (selectedRecordForLetter) {
              <div class="letter-print-body" id="printable-appraisal-letter">
                <div class="letter-header">
                  <div class="institute-brand">
                    <mat-icon class="brand-icon">school</mat-icon>
                    <div>
                      <h3 class="inst-name">JNANDEEP CAMPUS</h3>
                      <p class="inst-sub">Enterprise Coaching &amp; School Education ERP</p>
                    </div>
                  </div>
                  <div class="letter-ref-box">
                    <span>Ref: <strong>JC/HR/APR/{{ selectedRecordForLetter.id.substring(0, 8).toUpperCase() }}</strong></span>
                    <span>Date: <strong>{{ selectedRecordForLetter.createdAt | date:'dd MMM yyyy' }}</strong></span>
                  </div>
                </div>
                <hr class="letter-divider" />
                <div class="recipient-box">
                  <p>To,</p>
                  <h4>{{ selectedRecordForLetter.teacherName }}</h4>
                  <p>Employee Code: <strong>{{ selectedRecordForLetter.employeeCode }}</strong></p>
                  <p>Department: <strong>{{ selectedRecordForLetter.newDepartment || selectedRecordForLetter.oldDepartment || 'Academic' }}</strong></p>
                </div>
                <div class="letter-subject">
                  <strong>SUBJECT: {{ selectedRecordForLetter.type === 'Promotion' ? 'LETTER OF PROMOTION' : 'OFFICIAL APPRAISAL & SALARY REVISION ADVICE' }}</strong>
                </div>
                <div class="letter-narrative">
                  <p>Dear <strong>{{ selectedRecordForLetter.teacherName }}</strong>,</p>
                  <p>
                    The Management and Academic Directorate are pleased to recognize your contributions, dedication, and service towards the institution. In accordance with your recent performance review, we are delighted to convey the following official revision effective from <strong>{{ selectedRecordForLetter.effectiveDate | date:'dd MMMM yyyy' }}</strong>:
                  </p>
                </div>
                <table class="letter-breakup-table">
                  <thead>
                    <tr>
                      <th>Particulars</th>
                      <th>Existing (Previous)</th>
                      <th>Revised (Approved)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Designation / Cadre</strong></td>
                      <td>{{ selectedRecordForLetter.oldDesignation }}</td>
                      <td><strong class="text-primary">{{ selectedRecordForLetter.newDesignation }}</strong></td>
                    </tr>
                    @if (selectedRecordForLetter.newGrossSalary > 0) {
                      <tr>
                        <td><strong>Basic Salary</strong></td>
                        <td>₹{{ selectedRecordForLetter.oldBasicSalary | number:'1.2-2' }}</td>
                        <td><strong>₹{{ selectedRecordForLetter.newBasicSalary | number:'1.2-2' }}</strong></td>
                      </tr>
                    }
                    @if (selectedRecordForLetter.newGrossSalary > 0) {
                      <tr>
                        <td><strong>House Rent Allowance (HRA)</strong></td>
                        <td>₹{{ selectedRecordForLetter.oldHRA | number:'1.2-2' }}</td>
                        <td><strong>₹{{ selectedRecordForLetter.newHRA | number:'1.2-2' }}</strong></td>
                      </tr>
                    }
                    @if (selectedRecordForLetter.newGrossSalary > 0) {
                      <tr>
                        <td><strong>Special / Other Allowances</strong></td>
                        <td>₹{{ selectedRecordForLetter.oldOtherAllowances | number:'1.2-2' }}</td>
                        <td><strong>₹{{ selectedRecordForLetter.newOtherAllowances | number:'1.2-2' }}</strong></td>
                      </tr>
                    }
                    @if (selectedRecordForLetter.newGrossSalary > 0) {
                      <tr class="gross-row">
                        <td><strong>TOTAL GROSS CTC (Monthly)</strong></td>
                        <td>₹{{ selectedRecordForLetter.oldGrossSalary | number:'1.2-2' }}</td>
                        <td><strong class="text-success">₹{{ selectedRecordForLetter.newGrossSalary | number:'1.2-2' }}</strong></td>
                      </tr>
                    }
                  </tbody>
                </table>
                <div class="letter-footer-note">
                  <p>All other service conditions, confidentiality agreements, and code of conduct remain in force. We look forward to your continued excellence in guiding our students towards academic success.</p>
                </div>
                <div class="sign-block">
                  <div class="sign-box">
                    <div class="sign-line"></div>
                    <strong>Director / Principal</strong>
                    <p>Authorized Signatory</p>
                  </div>
                  <div class="sign-box text-right">
                    <div class="sign-line"></div>
                    <strong>Employee Acknowledgment</strong>
                    <p>Signature &amp; Date</p>
                  </div>
                </div>
              </div>
            }
            <div class="modal-footer">
              <button mat-button class="btn-cancel" (click)="showLetterModal = false">Close</button>
              <button mat-flat-button color="primary" class="btn-save" (click)="printLetter()">
                <mat-icon>print</mat-icon>
                <span>Print Official Letter</span>
              </button>
            </div>
          </div>
        </div>
      }
    
      <!-- Staff Appraisal Policy Configuration Modal (Admin & HR) -->
      @if (showPolicyModal) {
        <div class="modal-overlay" (click)="closePolicyModal()">
          <div class="modal-card policy-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div class="header-left">
                <div class="header-icon-box">
                  <mat-icon>tune</mat-icon>
                </div>
                <div class="header-title-box">
                  <h2 class="modal-title">Staff Appraisal &amp; Promotion Policy Rules</h2>
                  <p class="modal-subtitle">Dynamic institute tenure guidelines (संस्थान पदोन्नति एवं वेतन वृद्धि नीति)</p>
                </div>
              </div>
              <button mat-icon-button class="close-btn" (click)="closePolicyModal()">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="modal-body">
              <div class="policy-info-box">
                <mat-icon>gavel</mat-icon>
                <div>
                  <strong>Central Institute Appraisal Policy</strong>
                  <p>This dynamic policy is shared by SuperAdmin, InstituteAdmin, and HR. All staff appraisal workflows automatically validate against these parameters.</p>
                </div>
              </div>
              <div class="policy-setting-row">
                <div class="setting-info">
                  <label class="setting-title">Minimum Service Tenure for Salary Increment</label>
                  <p class="setting-desc">Minimum continuous months of service required before staff qualifies for financial salary revision (e.g. 12 months = 1 Year).</p>
                </div>
                <div class="setting-input-wrap">
                  <input type="number" min="0" max="60" [(ngModel)]="policy.minServiceMonthsForIncrement" class="policy-num-input" />
                  <span class="unit-lbl">Months (माह)</span>
                </div>
              </div>
              <div class="policy-setting-row">
                <div class="setting-info">
                  <label class="setting-title">Enforce "Dry Promotion" During Initial Tenure</label>
                  <p class="setting-desc">When staff has not completed minimum tenure, require rank/cadre upgrade only without immediate salary hike.</p>
                </div>
                <div class="setting-control">
                  <mat-slide-toggle [(ngModel)]="policy.enforceDryPromotionInProbation" color="primary"></mat-slide-toggle>
                </div>
              </div>
              <div class="policy-setting-row">
                <div class="setting-info">
                  <label class="setting-title">Allow Special Management / HR Approval Bypass</label>
                  <p class="setting-desc">Permit Admin &amp; HR to grant out-of-turn financial increments with an official approval reason/justification.</p>
                </div>
                <div class="setting-control">
                  <mat-slide-toggle [(ngModel)]="policy.allowSpecialBypass" color="primary"></mat-slide-toggle>
                </div>
              </div>
              <div class="policy-roles-chip-box">
                <span class="chip-lbl">Authorized Roles:</span>
                <span class="role-badge">SuperAdmin</span>
                <span class="role-badge">InstituteAdmin</span>
                <span class="role-badge">HR Manager</span>
              </div>
            </div>
            <div class="modal-footer">
              <button mat-button class="btn-cancel" (click)="closePolicyModal()" [disabled]="savingPolicy">Cancel</button>
              <button mat-flat-button color="primary" class="btn-save" (click)="savePolicy()" [disabled]="savingPolicy">
                <mat-icon>{{ savingPolicy ? 'hourglass_empty' : 'check_circle' }}</mat-icon>
                <span>{{ savingPolicy ? 'Saving Rules...' : 'Save & Update Policy' }}</span>
              </button>
            </div>
          </div>
        </div>
      }
    
      <!-- Smart Slide-Over Detail Drawer -->
      @if (showDetailDrawer) {
        <div class="drawer-overlay" (click)="closeDetailDrawer()">
          <aside class="detail-drawer" (click)="$event.stopPropagation()">
            <!-- Header with Strict Light Blue Gradient matching AGENTS.md rule -->
            <div class="drawer-header">
              <div class="header-left">
                <div class="header-icon-box">
                  <mat-icon>military_tech</mat-icon>
                </div>
                <div class="header-title-box">
                  <h2 class="drawer-title">Staff Appraisal Record</h2>
                  <p class="drawer-subtitle">
                    Ref: <strong>JC-APR-{{ selectedRecordForDetails?.id?.substring(0, 8)?.toUpperCase() }}</strong>
                  </p>
                </div>
              </div>
              <button mat-icon-button class="close-btn" (click)="closeDetailDrawer()" matTooltip="Close">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            @if (selectedRecordForDetails) {
              <div class="drawer-body">
                <!-- Staff Summary Card -->
                <div class="drawer-card staff-summary">
                  <div class="staff-avatar-large">
                    @if (getStaffPhoto(selectedRecordForDetails) && !imgErrors[selectedRecordForDetails.teacherId]) {
                      <img
                        [src]="getStaffPhoto(selectedRecordForDetails)"
                        (error)="imgErrors[selectedRecordForDetails.teacherId] = true"
                        class="staff-photo-img"
                        [alt]="selectedRecordForDetails.teacherName"
                        />
                    }
                    @if (!getStaffPhoto(selectedRecordForDetails) || imgErrors[selectedRecordForDetails.teacherId]) {
                      <div class="staff-initials-avatar">
                        {{ getInitials(selectedRecordForDetails.teacherName) }}
                      </div>
                    }
                  </div>
                  <div class="staff-meta-details">
                    <div class="staff-title-row">
                      <h3 class="staff-name">{{ selectedRecordForDetails.teacherName }}</h3>
                      <span class="code-badge">{{ selectedRecordForDetails.employeeCode }}</span>
                      <span class="type-pill" [class.teaching]="selectedRecordForDetails.staffType === 'Teaching'">
                        {{ selectedRecordForDetails.staffType }}
                      </span>
                    </div>
                    <div class="staff-dept-row">
                      <span>Department: <strong>{{ selectedRecordForDetails.newDepartment || selectedRecordForDetails.oldDepartment || 'Academic' }}</strong></span>
                    </div>
                    <div class="appraisal-type-pill-wrap">
                      <span class="type-badge" [ngClass]="getTypeBadgeClass(selectedRecordForDetails.type)">
                        {{ getTypeText(selectedRecordForDetails.type) }}
                      </span>
                      <span class="cycle-pill">{{ selectedRecordForDetails.reason || 'Appraisal Cycle' }}</span>
                    </div>
                  </div>
                </div>
                <!-- Designation Progression Tile -->
                <div class="drawer-card">
                  <div class="card-section-title">
                    <mat-icon>badge</mat-icon>
                    <span>Designation Progression</span>
                  </div>
                  <div class="progression-box">
                    <div class="prog-col">
                      <span class="prog-lbl">Previous Cadre</span>
                      <strong class="prog-val old">{{ selectedRecordForDetails.oldDesignation || 'N/A' }}</strong>
                    </div>
                    <div class="prog-arrow-wrap">
                      <mat-icon>arrow_forward</mat-icon>
                    </div>
                    <div class="prog-col">
                      <span class="prog-lbl">Revised Cadre</span>
                      <strong class="prog-val new">{{ selectedRecordForDetails.newDesignation }}</strong>
                    </div>
                  </div>
                </div>
                <!-- Salary Structure CTC Revision Breakdown -->
                @if (selectedRecordForDetails.newGrossSalary > 0) {
                  <div class="drawer-card">
                    <div class="card-section-title">
                      <mat-icon>payments</mat-icon>
                      <span>Salary CTC Revision Breakdown</span>
                    </div>
                    @if (selectedRecordForDetails.newGrossSalary > selectedRecordForDetails.oldGrossSalary) {
                      <div class="salary-hike-banner">
                        <div class="hike-stat">
                          <span class="hike-lbl">Gross Monthly Hike</span>
                          <strong class="hike-val">+₹{{ (selectedRecordForDetails.newGrossSalary - selectedRecordForDetails.oldGrossSalary) | number:'1.0-0' }}</strong>
                        </div>
                        <div class="hike-pct-badge">
                          +{{ selectedRecordForDetails.incrementPercentage }}% Hike
                        </div>
                      </div>
                    }
                    <div class="drawer-breakdown-table">
                      <div class="b-row header">
                        <span>Component</span>
                        <span class="text-right">Previous</span>
                        <span class="text-right">Revised</span>
                      </div>
                      <div class="b-row">
                        <span>Basic Salary</span>
                        <span class="text-right old">₹{{ selectedRecordForDetails.oldBasicSalary | number:'1.0-0' }}</span>
                        <span class="text-right new">₹{{ selectedRecordForDetails.newBasicSalary | number:'1.0-0' }}</span>
                      </div>
                      <div class="b-row">
                        <span>HRA</span>
                        <span class="text-right old">₹{{ selectedRecordForDetails.oldHRA | number:'1.0-0' }}</span>
                        <span class="text-right new">₹{{ selectedRecordForDetails.newHRA | number:'1.0-0' }}</span>
                      </div>
                      <div class="b-row">
                        <span>Other / Special Allowances</span>
                        <span class="text-right old">₹{{ selectedRecordForDetails.oldOtherAllowances | number:'1.0-0' }}</span>
                        <span class="text-right new">₹{{ selectedRecordForDetails.newOtherAllowances | number:'1.0-0' }}</span>
                      </div>
                      <div class="b-row total">
                        <strong>Total Monthly Gross CTC</strong>
                        <strong class="text-right old">₹{{ selectedRecordForDetails.oldGrossSalary | number:'1.0-0' }}</strong>
                        <strong class="text-right total-new">₹{{ selectedRecordForDetails.newGrossSalary | number:'1.0-0' }}</strong>
                      </div>
                    </div>
                  </div>
                }
                <!-- Audit & Timeline Details -->
                <div class="drawer-card">
                  <div class="card-section-title">
                    <mat-icon>history</mat-icon>
                    <span>Audit &amp; Timeline Details</span>
                  </div>
                  <div class="audit-list">
                    <div class="audit-item">
                      <span class="audit-lbl">Effective Date:</span>
                      <div class="audit-val">
                        <strong>{{ selectedRecordForDetails.effectiveDate | date:'dd MMMM yyyy' }}</strong>
                        <small>(Indian Standard Time)</small>
                      </div>
                    </div>
                    <div class="audit-item">
                      <span class="audit-lbl">Recorded On:</span>
                      <div class="audit-val">
                        <span>{{ selectedRecordForDetails.createdAt | date:'dd MMM yyyy, hh:mm a' }}</span>
                      </div>
                    </div>
                    @if (selectedRecordForDetails.remarks) {
                      <div class="audit-item">
                        <span class="audit-lbl">Notes / Remarks:</span>
                        <div class="audit-val notes">
                          <span>{{ selectedRecordForDetails.remarks }}</span>
                        </div>
                      </div>
                    }
                    @if (selectedRecordForDetails.isSpecialBypass) {
                      <div class="audit-item bypass-notice">
                        <mat-icon class="shield-icon">verified_user</mat-icon>
                        <div>
                          <strong>Management Approval Bypass Authorized</strong>
                          <p>{{ selectedRecordForDetails.specialBypassReason || 'Approved by HR Committee' }}</p>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </div>
            }
            @if (selectedRecordForDetails) {
              <div class="drawer-footer">
                <button mat-stroked-button color="warn" (click)="deleteRecord(selectedRecordForDetails); closeDetailDrawer()">
                  <mat-icon>delete_outline</mat-icon>
                  <span>Delete</span>
                </button>
                <div class="footer-right">
                  <button mat-stroked-button (click)="closeDetailDrawer()">Close</button>
                  <button mat-flat-button color="primary" (click)="viewLetter(selectedRecordForDetails)">
                    <mat-icon>description</mat-icon>
                    <span>Official Letter</span>
                  </button>
                </div>
              </div>
            }
          </aside>
        </div>
      }
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .page-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 14px;

      .page-title {
        font-size: 1.45rem;
        font-weight: 700;
        margin: 0;
        color: #0f172a;
        display: flex;
        align-items: center;
        gap: 10px;

        .title-icon {
          color: #2563eb;
          font-size: 1.7rem;
          width: 1.7rem;
          height: 1.7rem;
        }
      }

      .page-subtitle {
        color: #64748b;
        margin: 4px 0 0;
        font-size: 0.86rem;
        max-width: 820px;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 10px;

        .action-btn {
          font-weight: 600;
          border-radius: 8px;
          height: 40px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
      }
    }

    /* KPI Summary Cards - Standard Compact Horizontal Layout */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;

      @media (max-width: 1024px) {
        grid-template-columns: repeat(2, 1fr);
      }

      @media (max-width: 640px) {
        grid-template-columns: 1fr;
      }
    }

    .stat-card {
      background: #ffffff !important;
      border-radius: 12px !important;
      padding: 12px 16px !important;
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      justify-content: flex-start !important;
      text-align: left !important;
      gap: 14px !important;
      min-height: unset !important;
      border: 1px solid #e2e8f0 !important;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02) !important;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
      overflow: hidden;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 14px -3px rgba(15, 23, 42, 0.08) !important;
        border-color: #cbd5e1 !important;
      }

      .stat-icon {
        width: 42px !important;
        height: 42px !important;
        border-radius: 10px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex-shrink: 0 !important;
        margin: 0 !important;

        mat-icon {
          font-size: 22px;
          width: 22px;
          height: 22px;
          color: #ffffff;
        }
      }

      .stat-info {
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        justify-content: center !important;
        text-align: left !important;
        flex: 1;
        min-width: 0;

        .stat-lbl {
          font-size: 0.72rem !important;
          font-weight: 600 !important;
          color: #64748b !important;
          text-transform: uppercase !important;
          letter-spacing: 0.4px !important;
          line-height: 1.2 !important;
          margin: 0 0 2px 0 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        .stat-val-row {
          display: flex;
          align-items: baseline;
          gap: 6px;
          flex-wrap: wrap;
        }

        .stat-val {
          display: inline-block !important;
          font-size: 1.45rem !important;
          font-weight: 700 !important;
          color: #0f172a !important;
          line-height: 1.15 !important;
          letter-spacing: -0.02em;
        }

        .stat-sub-pill {
          display: inline-flex;
          align-items: center;
          font-size: 0.7rem;
          font-weight: 600;
          color: #047857;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          padding: 1px 6px;
          border-radius: 10px;
          line-height: normal;
        }
      }

      &.total {
        border-left: 3.5px solid #2563eb !important;
        .stat-icon { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); box-shadow: 0 3px 8px rgba(37, 99, 235, 0.25); }
      }

      &.promo {
        border-left: 3.5px solid #8b5cf6 !important;
        .stat-icon { background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); box-shadow: 0 3px 8px rgba(139, 92, 246, 0.25); }
      }

      &.inc {
        border-left: 3.5px solid #10b981 !important;
        .stat-icon { background: linear-gradient(135deg, #10b981 0%, #047857 100%); box-shadow: 0 3px 8px rgba(16, 185, 129, 0.25); }
      }

      &.budget {
        border-left: 3.5px solid #f59e0b !important;
        .stat-icon { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow: 0 3px 8px rgba(245, 158, 11, 0.25); }
      }
    }

    /* Filter Toolbar */
    .filter-card {
      padding: 12px 16px !important;
      border-radius: 12px !important;
      border: 1px solid #e2e8f0 !important;
      background: #ffffff !important;
    }

    .filter-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;

      .search-box {
        flex: 1;
        min-width: 240px;
        height: 40px;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 8px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 0 12px;
        transition: all 0.2s ease;

        &:focus-within {
          border-color: #2563eb;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        mat-icon {
          color: #2563eb;
          font-size: 20px;
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }

        input {
          flex: 1;
          height: 100%;
          border: none;
          background: transparent;
          outline: none;
          font-size: 0.88rem;
          color: #0f172a;
        }

        .clear-btn {
          border: none;
          background: none;
          cursor: pointer;
          color: #94a3b8;
          padding: 0;
          display: flex;
          align-items: center;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }
      }

      .filter-selects {
        display: flex;
        align-items: center;
        gap: 10px;

        .mini-field {
          width: 175px;
          height: 40px;
          margin: 0;

          &.cycle-field {
            width: 200px;
          }

          ::ng-deep {
            .mat-mdc-form-field-subscript-wrapper {
              display: none !important;
            }
            .mat-mdc-text-field-wrapper {
              height: 40px !important;
              padding: 0 12px !important;
              background-color: #f8fafc !important;
              border-radius: 8px !important;
              box-sizing: border-box !important;
              transition: all 0.2s ease;
            }
            .mat-mdc-form-field-flex {
              height: 40px !important;
              align-items: center !important;
            }
            .mat-mdc-form-field-infix {
              min-height: unset !important;
              padding: 0 !important;
              display: flex !important;
              align-items: center !important;
              height: 100% !important;
            }
            .mat-mdc-select-value {
              font-size: 0.88rem !important;
              color: #0f172a !important;
              line-height: normal !important;
            }
            .mat-mdc-select-arrow-wrapper {
              transform: none !important;
            }
            .mat-mdc-floating-label {
              top: 20px !important;
              font-size: 0.84rem !important;
            }
            .mdc-floating-label--float-above {
              top: 19px !important;
              transform: translateY(-135%) scale(0.75) !important;
              background: #ffffff;
              padding: 0 4px;
            }
            .mdc-notched-outline__leading {
              border-top-left-radius: 8px !important;
              border-bottom-left-radius: 8px !important;
            }
            .mdc-notched-outline__trailing {
              border-top-right-radius: 8px !important;
              border-bottom-right-radius: 8px !important;
            }
            .mdc-notched-outline__leading,
            .mdc-notched-outline__notch,
            .mdc-notched-outline__trailing {
              border-color: #cbd5e1 !important;
            }
            &.mat-focused .mdc-notched-outline__leading,
            &.mat-focused .mdc-notched-outline__notch,
            &.mat-focused .mdc-notched-outline__trailing {
              border-color: #2563eb !important;
              border-width: 1.5px !important;
            }
            &.mat-focused .mat-mdc-text-field-wrapper {
              background-color: #ffffff !important;
            }
          }
        }
      }
    }

    /* Single Central Server Loading Overlay */
    .table-loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.75);
      backdrop-filter: blur(2px);
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 14px;
      pointer-events: none;
      min-height: 200px;
    }

    .loading-spinner-box {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #ffffff;
      border: 1.5px solid #93c5fd;
      padding: 10px 20px;
      border-radius: 30px;
      box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.25);
      color: #1e40af;
      font-weight: 600;
      font-size: 0.88rem;
    }

    .spinner-ring {
      width: 20px;
      height: 20px;
      border: 2.5px solid #dbeafe;
      border-top-color: #2563eb;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Records Container & Table Styles */
    .records-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
      position: relative;
    }

    .table-responsive {
      background: #ffffff;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      overflow-x: auto;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
      margin-bottom: 8px;
      position: relative;
      transition: opacity 0.2s ease;

      &.table-loading {
        opacity: 0.65;
        pointer-events: none;
      }
    }

    .smart-cards-grid {
      position: relative;
      &.table-loading {
        opacity: 0.65;
        pointer-events: none;
        transition: opacity 0.2s ease;
      }
    }

    .erp-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.84rem;

      thead tr {
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }

      th {
        padding: 10px 12px;
        font-weight: 600;
        color: #475569;
        font-size: 0.76rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        white-space: nowrap;

        &.sortable {
          cursor: pointer;
          user-select: none;
          transition: all 0.2s ease;

          .th-content {
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }

          .sort-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
            color: #94a3b8;
            transition: all 0.2s ease;

            &.active {
              color: #2563eb;
              font-weight: 700;
            }
          }

          &:hover {
            background: #f1f5f9;
            color: #1d4ed8;

            .sort-icon {
              color: #2563eb;
            }
          }
        }
      }

      td {
        padding: 10px 12px;
        border-bottom: 1px solid #f1f5f9;
        color: #1e293b;
        vertical-align: middle;
      }

      tbody tr:hover {
        background: #fafcff;
      }

      .actions-th, .actions-td {
        width: 48px;
        min-width: 48px;
        max-width: 56px;
        padding: 4px;
        text-align: center;
      }
    }

    .action-menu-btn {
      width: 32px !important;
      height: 32px !important;
      padding: 0 !important;
      color: #64748b;
      transition: all 0.2s ease;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
      &:hover {
        background: #eff6ff !important;
        color: #2563eb !important;
      }
    }

    .text-center { text-align: center; }

    .staff-id-cell {
      display: flex;
      align-items: center;
      gap: 10px;

      .staff-avatar {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        color: #1e40af;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;
        border: 1.5px solid #bfdbfe;
        box-shadow: 0 1px 3px rgba(37, 99, 235, 0.12);

        .staff-photo-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .staff-initials-avatar {
          font-size: 0.82rem;
          font-weight: 700;
          color: #1e40af;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }

      .staff-name {
        color: #0f172a;
        font-weight: 600;
        display: block;
      }

      .staff-meta {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 2px;
      }
    }

    .code-badge {
      font-size: 0.74rem;
      color: #64748b;
      font-family: monospace;
    }

    .type-pill {
      font-size: 0.7rem;
      padding: 1px 6px;
      border-radius: 6px;
      background: #f1f5f9;
      color: #475569;
      font-weight: 500;

      &.teaching {
        background: #eff6ff;
        color: #1d4ed8;
      }
    }

    .type-badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 0.74rem;
      font-weight: 600;
      white-space: nowrap;

      &.badge-both {
        background: #faf5ff;
        color: #7e22ce;
        border: 1px solid #e9d5ff;
      }

      &.badge-promo {
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
      }

      &.badge-inc {
        background: #ecfdf5;
        color: #047857;
        border: 1px solid #a7f3d0;
      }
    }

    .shift-cell {
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;

      .old-role {
        color: #64748b;
        text-decoration: line-through;
        font-size: 0.8rem;
      }

      .arrow-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        color: #2563eb;
      }

      .new-role {
        color: #1e40af;
        font-weight: 700;
      }
    }

    .salary-cell {
      display: flex;
      flex-direction: column;
      gap: 3px;

      .salary-row {
        display: flex;
        align-items: center;
        gap: 6px;

        .old-sal {
          color: #64748b;
          text-decoration: line-through;
          font-size: 0.8rem;
        }

        .new-sal {
          color: #0f172a;
          font-weight: 700;
        }
      }

      .hike-badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        color: #059669;
        font-size: 0.74rem;
        font-weight: 700;
        mat-icon { font-size: 13px; width: 13px; height: 13px; }
      }
    }

    .no-change {
      color: #64748b;
      font-size: 0.8rem;
      font-style: italic;
    }

    .date-cell {
      .date-text {
        color: #0f172a;
        font-weight: 600;
        font-size: 0.84rem;
        white-space: nowrap;
      }
    }

    .reason-pill {
      display: inline-flex;
      align-items: center;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.76rem;
      font-weight: 500;
      color: #334155;
      white-space: nowrap;
    }

    .action-btn-group {
      display: flex;
      align-items: center;
      gap: 4px;
      justify-content: flex-end;

      .mini-btn {
        width: 32px !important;
        height: 32px !important;
        padding: 0 !important;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }

        &.view { color: #2563eb; }
        &.delete { color: #f87171; &:hover { color: #dc2626; } }
      }
    }

    .text-right { text-align: right; }

    /* Filter Controls Right & View Switcher */
    .filter-controls-right {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-left: auto;

      .records-count-chip {
        font-size: 0.8rem;
        background: #eff6ff;
        color: #1e40af;
        border: 1px solid #bfdbfe;
        padding: 4px 10px;
        border-radius: 20px;
        font-weight: 500;
        strong { color: #1e3a8a; }
      }

      .view-mode-toggle {
        display: inline-flex;
        background: #f1f5f9;
        padding: 3px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;

        .view-toggle-btn {
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 4px 10px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.78rem;
          font-weight: 600;
          color: #64748b;
          transition: all 0.2s ease;

          mat-icon { font-size: 16px; width: 16px; height: 16px; }

          &.active {
            background: #ffffff;
            color: #2563eb;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          }

          &:hover:not(.active) {
            color: #1e293b;
          }
        }
      }
    }

    .table-data-row {
      cursor: pointer;
      transition: background 0.15s ease;
      &:hover {
        background: #f8fafc !important;
      }
    }

    .mini-btn.inspect { color: #0284c7; }

    @media (max-width: 768px) {
      .page-header {
        flex-direction: column;
        align-items: stretch;

        .header-actions {
          flex-direction: column;
          width: 100%;

          .action-btn {
            width: 100% !important;
            justify-content: center;
          }
        }
      }

      .stats-grid {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 10px;
      }

      .filter-controls-right {
        width: 100%;
        justify-content: space-between;
        margin-left: 0;
      }
    }

    @media (max-width: 640px) {
      .filter-toolbar {
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 10px !important;

        .search-box {
          width: 100% !important;
          min-width: 100% !important;
        }

        .filter-selects {
          width: 100% !important;
          flex-direction: column !important;
          gap: 6px !important;

          .mini-field {
            width: 100% !important;
          }
        }
      }
    }

    @media (max-width: 480px) {
      .stats-grid {
        grid-template-columns: 1fr !important;
        gap: 8px !important;
      }
    }

    /* Smart Cards Grid (Compact & Responsive) */
    .smart-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
      gap: 16px;
    }

    .smart-record-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
      display: flex;
      flex-direction: column;
      position: relative;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 16px -4px rgba(15, 23, 42, 0.08);
        border-color: #cbd5e1;
      }

      .card-accent-bar {
        height: 3px;
        width: 100%;
        background: #cbd5e1;

        &.badge-both { background: linear-gradient(90deg, #8b5cf6, #3b82f6); }
        &.badge-promo { background: #3b82f6; }
        &.badge-inc { background: #10b981; }
      }

      .card-top-header {
        padding: 12px 14px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
        border-bottom: 1px solid #f8fafc;

        .staff-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;

          .staff-card-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            color: #1e40af;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            overflow: hidden;
            border: 1.5px solid #bfdbfe;
            box-shadow: 0 1px 3px rgba(37, 99, 235, 0.12);

            .staff-photo-img {
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
            }

            .staff-initials-avatar {
              font-size: 0.84rem;
              font-weight: 700;
              color: #1e40af;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }

            mat-icon { font-size: 20px; width: 20px; height: 20px; }
          }

          .staff-card-title {
            min-width: 0;
            .teacher-title {
              display: block;
              font-size: 0.92rem;
              color: #0f172a;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .meta-row {
              display: flex;
              align-items: center;
              gap: 6px;
              margin-top: 2px;
              .code-tag { font-size: 0.72rem; color: #64748b; font-family: monospace; }
            }
          }
        }
      }

      .card-metrics-box {
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
        background: #fcfdfe;

        .metric-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.8rem;
          gap: 8px;

          .metric-label {
            color: #64748b;
            font-size: 0.74rem;
            font-weight: 500;
          }

          .shift-cell {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 0.82rem;
            .old-role { color: #94a3b8; text-decoration: line-through; font-size: 0.76rem; }
            .arrow-icon { font-size: 13px; width: 13px; height: 13px; color: #3b82f6; }
            .new-role { color: #1e3a8a; font-weight: 600; }
          }

          .salary-inline-cell {
            display: flex;
            align-items: center;
            gap: 4px;

            .old-sal { color: #94a3b8; text-decoration: line-through; font-size: 0.76rem; }
            .arrow-icon { font-size: 13px; width: 13px; height: 13px; color: #10b981; }
            .new-sal { color: #0f172a; font-weight: 700; font-size: 0.84rem; }
            .hike-chip {
              background: #ecfdf5;
              color: #047857;
              padding: 1px 5px;
              border-radius: 4px;
              font-size: 0.7rem;
              font-weight: 700;
            }
          }
        }

        .metric-row-footer {
          margin-top: 4px;
          padding-top: 8px;
          border-top: 1px dashed #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;

          .date-tag {
            font-size: 0.72rem;
            color: #64748b;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            mat-icon { font-size: 13px; width: 13px; height: 13px; }
          }

          .cycle-tag {
            font-size: 0.7rem;
            color: #3b82f6;
            background: #eff6ff;
            padding: 1px 6px;
            border-radius: 4px;
            max-width: 140px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
      }

      .card-action-bar {
        padding: 8px 12px;
        border-top: 1px solid #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #ffffff;

        .card-btn.inspect {
          font-size: 0.78rem;
          font-weight: 600;
          color: #2563eb;
          height: 30px;
          padding: 0 8px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
        }

        .right-actions {
          display: flex;
          align-items: center;
          gap: 4px;

          .card-btn.letter {
            font-size: 0.75rem;
            height: 28px;
            padding: 0 8px;
            color: #475569;
            mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 3px; }
          }

          .card-icon-btn.delete {
            width: 28px;
            height: 28px;
            padding: 0;
            color: #f87171;
            mat-icon { font-size: 16px; width: 16px; height: 16px; }
            &:hover { color: #dc2626; }
          }
        }
      }
    }

    /* Pagination Container */
    .pagination-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      font-size: 0.82rem;
      color: #64748b;
      flex-wrap: wrap;
      gap: 12px;

      .pagination-info {
        strong { color: #0f172a; }
      }

      .pagination-controls {
        display: flex;
        align-items: center;
        gap: 16px;

        .page-size-selector {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;

          select {
            padding: 4px 8px;
            border-radius: 6px;
            border: 1px solid #cbd5e1;
            background: #f8fafc;
            color: #0f172a;
            font-size: 0.8rem;
            outline: none;
            cursor: pointer;
            &:focus { border-color: #2563eb; }
          }
        }

        .page-nav-btns {
          display: flex;
          align-items: center;
          gap: 6px;

          .page-nav-btn {
            border: 1px solid #cbd5e1;
            background: #ffffff;
            border-radius: 6px;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: #334155;
            transition: all 0.15s ease;

            mat-icon { font-size: 18px; width: 18px; height: 18px; }

            &:hover:not(:disabled) {
              background: #eff6ff;
              border-color: #93c5fd;
              color: #1d4ed8;
            }

            &:disabled {
              opacity: 0.4;
              cursor: not-allowed;
            }
          }

          .page-counter {
            font-size: 0.8rem;
            padding: 0 4px;
            strong { color: #0f172a; }
          }
        }
      }
    }

    /* Slide-Over Detail Drawer */
    .drawer-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(2px);
      z-index: 1060;
      display: flex;
      justify-content: flex-end;
    }

    .detail-drawer {
      background: #ffffff;
      width: 490px;
      max-width: 96vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
      box-shadow: -8px 0 25px rgba(0, 0, 0, 0.15);
      animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1);

      .drawer-header {
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        border-bottom: 1px solid #bfdbfe;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-icon-box {
          width: 40px;
          height: 40px;
          background: #2563eb;
          color: #ffffff;
          border-radius: 10px;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 22px; width: 22px; height: 22px; }
        }

        .drawer-title {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          color: #1e3a8a;
        }

        .drawer-subtitle {
          margin: 2px 0 0;
          font-size: 0.78rem;
          color: #3b82f6;
          strong { color: #1e40af; }
        }

        .close-btn {
          color: #64748b;
          &:hover { color: #1e293b; }
        }
      }

      .drawer-body {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 16px;
        background: #f8fafc;

        .drawer-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 14px 16px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);

          .card-section-title {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.84rem;
            font-weight: 700;
            color: #1e3a8a;
            margin-bottom: 12px;
            mat-icon { font-size: 17px; width: 17px; height: 17px; color: #2563eb; }
          }

          &.staff-summary {
            display: flex;
            align-items: flex-start;
            gap: 14px;

            .staff-avatar-large {
              width: 52px;
              height: 52px;
              border-radius: 50%;
              background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
              color: #1e40af;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              overflow: hidden;
              border: 2px solid #bfdbfe;
              box-shadow: 0 2px 6px rgba(37, 99, 235, 0.15);

              .staff-photo-img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
              }

              .staff-initials-avatar {
                font-size: 1.15rem;
                font-weight: 700;
                color: #1e40af;
                letter-spacing: 0.5px;
                text-transform: uppercase;
              }

              mat-icon { font-size: 26px; width: 26px; height: 26px; }
            }

            .staff-meta-details {
              flex: 1;
              min-width: 0;

              .staff-title-row {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;

                .staff-name {
                  margin: 0;
                  font-size: 1.05rem;
                  font-weight: 700;
                  color: #0f172a;
                }
              }

              .staff-dept-row {
                font-size: 0.78rem;
                color: #64748b;
                margin-top: 3px;
                strong { color: #334155; }
              }

              .appraisal-type-pill-wrap {
                margin-top: 8px;
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;

                .cycle-pill {
                  font-size: 0.72rem;
                  background: #f1f5f9;
                  padding: 2px 8px;
                  border-radius: 10px;
                  color: #475569;
                }
              }
            }
          }

          .progression-box {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #f8fafc;
            border-radius: 8px;
            padding: 10px 14px;
            border: 1px solid #f1f5f9;

            .prog-col {
              display: flex;
              flex-direction: column;
              gap: 2px;
              .prog-lbl { font-size: 0.72rem; color: #64748b; font-weight: 500; }
              .prog-val {
                font-size: 0.88rem;
                &.old { color: #64748b; }
                &.new { color: #1e40af; font-weight: 700; }
              }
            }

            .prog-arrow-wrap {
              color: #2563eb;
              mat-icon { font-size: 18px; width: 18px; height: 18px; }
            }
          }

          .salary-hike-banner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
            border: 1px solid #a7f3d0;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 12px;

            .hike-stat {
              display: flex;
              flex-direction: column;
              .hike-lbl { font-size: 0.72rem; color: #065f46; font-weight: 500; }
              .hike-val { font-size: 1.1rem; color: #047857; font-weight: 800; }
            }

            .hike-pct-badge {
              background: #059669;
              color: #ffffff;
              padding: 4px 10px;
              border-radius: 12px;
              font-weight: 700;
              font-size: 0.8rem;
            }
          }

          .drawer-breakdown-table {
            display: flex;
            flex-direction: column;
            gap: 6px;
            font-size: 0.82rem;

            .b-row {
              display: grid;
              grid-template-columns: 2fr 1fr 1fr;
              padding: 6px 4px;
              border-bottom: 1px solid #f1f5f9;
              color: #334155;

              &.header {
                font-size: 0.72rem;
                text-transform: uppercase;
                color: #94a3b8;
                font-weight: 600;
                letter-spacing: 0.03em;
              }

              &.total {
                border-top: 2px solid #e2e8f0;
                border-bottom: none;
                padding-top: 10px;
                color: #0f172a;
                font-size: 0.88rem;

                .total-new { color: #059669; font-weight: 800; }
              }

              .old { color: #64748b; }
              .new { font-weight: 600; color: #0f172a; }
            }
          }

          .audit-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-size: 0.8rem;

            .audit-item {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 8px;

              .audit-lbl { color: #64748b; font-weight: 500; }
              .audit-val {
                text-align: right;
                color: #0f172a;
                small { color: #94a3b8; margin-left: 4px; }
                &.notes {
                  text-align: left;
                  background: #f8fafc;
                  padding: 6px 10px;
                  border-radius: 6px;
                  border: 1px solid #f1f5f9;
                  font-style: italic;
                  color: #475569;
                }
              }

              &.bypass-notice {
                background: #fef2f2;
                border: 1px solid #fecaca;
                border-radius: 8px;
                padding: 10px 12px;
                display: flex;
                align-items: flex-start;
                gap: 10px;
                color: #991b1b;

                .shield-icon { color: #dc2626; font-size: 20px; width: 20px; height: 20px; }
                strong { display: block; font-size: 0.82rem; }
                p { margin: 2px 0 0; font-size: 0.75rem; color: #b91c1c; }
              }
            }
          }
        }
      }

      .drawer-footer {
        padding: 14px 20px;
        background: #ffffff;
        border-top: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;

        .footer-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
      }
    }

    @keyframes slideInRight {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }

    /* Modal / Drawer Overlay & Container (Fully Responsive) */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      z-index: 1050;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
      overflow-y: auto;
    }

    .modal-card {
      background: #ffffff;
      border-radius: 16px;
      width: 100%;
      max-width: 680px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      overflow: hidden;
      margin: auto;
    }

    .bulk-card {
      max-width: 560px;
    }

    .letter-modal {
      max-width: 760px;
    }

    .policy-card {
      max-width: 620px;
    }

    /* Strict Light Blue Gradient Header matching AGENTS.md rule */
    .modal-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-shrink: 0;

      .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
        flex: 1;

        .header-title-box {
          min-width: 0;
          flex: 1;
        }
      }

      .header-icon-box {
        width: 42px;
        height: 42px;
        background: #2563eb;
        color: #ffffff;
        border-radius: 10px;
        box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        mat-icon { font-size: 22px; width: 22px; height: 22px; }
      }

      .modal-title {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 700;
        color: #1e3a8a;
        line-height: 1.25;
        word-break: break-word;
      }

      .modal-subtitle {
        margin: 2px 0 0;
        font-size: 0.8rem;
        color: #3b82f6;
        line-height: 1.25;
        word-break: break-word;
      }

      .close-btn {
        width: 32px !important;
        height: 32px !important;
        padding: 0 !important;
        min-width: 32px !important;
        color: #64748b !important;
        background: rgba(148, 163, 184, 0.15) !important;
        border-radius: 8px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex-shrink: 0;
        transition: all 0.2s ease;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
        &:hover { color: #0f172a !important; background: rgba(148, 163, 184, 0.3) !important; }
      }
    }

    .modal-body {
      padding: 18px 20px;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .current-profile-box {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;

      .prof-avatar {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: #eff6ff;
        color: #2563eb;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        mat-icon { font-size: 22px; width: 22px; height: 22px; }
      }

      .prof-details {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 0.82rem;

        .prof-name-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          strong { font-size: 0.95rem; color: #0f172a; word-break: break-word; }
          .code-badge {
            font-size: 0.74rem;
            color: #475569;
            background: #e2e8f0;
            padding: 1px 6px;
            border-radius: 4px;
            font-weight: 600;
            font-family: monospace;
          }
          .type-pill {
            margin-left: auto;
            font-size: 0.7rem;
            padding: 2px 7px;
            border-radius: 8px;
            background: #eff6ff;
            color: #1d4ed8;
            font-weight: 600;
          }
        }

        .prof-meta-row {
          color: #475569;
          font-size: 0.8rem;
          display: flex;
          flex-wrap: wrap;
          gap: 4px 8px;
          strong { color: #1e293b; }
        }

        .prof-salary-row {
          color: #334155;
          font-size: 0.78rem;
          display: flex;
          flex-wrap: wrap;
          gap: 4px 6px;
          margin-top: 2px;
          padding-top: 4px;
          border-top: 1px dashed #e2e8f0;
          strong { color: #1e293b; }
          .text-primary { color: #2563eb; font-weight: 700; }
        }

        .prof-tenure-row {
          color: #334155;
          font-size: 0.78rem;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 4px 8px;
          margin-top: 3px;
          padding-top: 3px;
          border-top: 1px dashed #e2e8f0;
          strong { color: #1e293b; }
          .text-amber { color: #b45309; font-weight: 700; }
          .text-green { color: #047857; font-weight: 700; }

          .probation-tag {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            background: #fffbeb;
            color: #92400e;
            border: 1px solid #fde68a;
            border-radius: 6px;
            padding: 1px 6px;
            font-size: 0.72rem;
            font-weight: 600;
            mat-icon { font-size: 14px; width: 14px; height: 14px; color: #d97706; }
          }
        }

        .prof-salary-missing-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
          padding: 6px 10px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #991b1b;
          font-size: 0.78rem;
          flex-wrap: wrap;

          .warn-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
            color: #dc2626;
          }

          .configure-link {
            color: #2563eb;
            font-weight: 600;
            text-decoration: underline;
            margin-left: auto;
            cursor: pointer;
            &:hover { color: #1d4ed8; }
          }
        }
      }
    }

    .section-label {
      font-size: 0.82rem;
      font-weight: 600;
      color: #334155;
      margin-bottom: 6px;
      display: block;
    }

    .mode-chips {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      width: 100%;

      .mode-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 8px 10px;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        color: #334155;
        border-radius: 8px;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: center;

        mat-icon { font-size: 18px; width: 18px; height: 18px; color: #64748b; flex-shrink: 0; }
        span { line-height: 1.25; }

        &:hover {
          background: #f1f5f9;
          border-color: #94a3b8;
        }

        &.active {
          background: #eff6ff;
          border-color: #2563eb;
          color: #1d4ed8;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
          mat-icon { color: #2563eb; }
        }
      }
    }

    .probation-policy-banner {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 10px;
      padding: 12px 14px;
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 10px;

      .banner-top {
        display: flex;
        align-items: flex-start;
        gap: 10px;

        .banner-icon {
          color: #d97706;
          font-size: 20px;
          width: 20px;
          height: 20px;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .banner-text {
          font-size: 0.82rem;
          color: #92400e;
          line-height: 1.4;
          strong { color: #78350f; }
          em { font-style: normal; font-weight: 600; text-decoration: underline; }
        }
      }

      .bypass-box {
        background: #ffffff;
        border: 1px dashed #f59e0b;
        border-radius: 8px;
        padding: 8px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;

        .bypass-chk-lbl {
          display: flex;
          flex-direction: column;
          gap: 1px;
          strong { font-size: 0.82rem; color: #92400e; }
          small { font-size: 0.74rem; color: #b45309; }
        }

        .bypass-reason-wrap {
          margin-top: 4px;
          mat-form-field { margin-bottom: -1.25em; }
        }
      }
    }

    /* Policy Modal Inner Styles */
    .policy-info-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      color: #1e40af;
      margin-bottom: 8px;

      mat-icon {
        color: #2563eb;
        font-size: 24px;
        width: 24px;
        height: 24px;
        flex-shrink: 0;
      }

      strong {
        font-size: 0.88rem;
        color: #1e3a8a;
        display: block;
        margin-bottom: 2px;
      }

      p {
        margin: 0;
        font-size: 0.8rem;
        line-height: 1.35;
        color: #3b82f6;
      }
    }

    .policy-setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 0;
      border-bottom: 1px solid #f1f5f9;

      .setting-info {
        flex: 1;
        min-width: 0;

        .setting-title {
          font-size: 0.88rem;
          font-weight: 600;
          color: #0f172a;
          display: block;
          margin-bottom: 3px;
        }

        .setting-desc {
          margin: 0;
          font-size: 0.78rem;
          color: #64748b;
          line-height: 1.3;
        }
      }

      .setting-input-wrap {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;

        .policy-num-input {
          width: 70px;
          padding: 7px 10px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          text-align: center;
          font-size: 0.95rem;
          font-weight: 700;
          color: #1e3a8a;
          outline: none;

          &:focus {
            border-color: #2563eb;
            box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
          }
        }

        .unit-lbl {
          font-size: 0.78rem;
          color: #64748b;
          font-weight: 500;
        }
      }

      .setting-control {
        flex-shrink: 0;
      }
    }

    .policy-roles-chip-box {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 14px;
      padding: 8px 12px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      flex-wrap: wrap;

      .chip-lbl {
        font-size: 0.76rem;
        color: #64748b;
        font-weight: 600;
      }

      .role-badge {
        font-size: 0.72rem;
        padding: 2px 8px;
        border-radius: 12px;
        background: #eff6ff;
        color: #1d4ed8;
        font-weight: 600;
        border: 1px solid #bfdbfe;
      }
    }

    .section-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;

      .sec-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 700;
        font-size: 0.88rem;
        color: #1e3a8a;
        margin-bottom: 4px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
      }
    }

    .form-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      width: 100%;

      &.three-cols {
        grid-template-columns: repeat(3, 1fr);
      }

      .flex-1 {
        width: 100%;
        min-width: 0;
      }
    }

    .full-width { width: 100%; }

    .quick-roles-row {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;

      .quick-lbl { font-size: 0.74rem; color: #64748b; }
      .quick-role-chip {
        font-size: 0.72rem;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        padding: 2px 8px;
        border-radius: 12px;
        cursor: pointer;
        color: #334155;
        transition: all 0.15s ease;
        &:hover { background: #eff6ff; border-color: #93c5fd; color: #1d4ed8; }
        &.selected {
          background: #2563eb !important;
          color: #ffffff !important;
          border-color: #2563eb !important;
          font-weight: 600;
        }
      }
    }

    .cycle-input-wrap {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .calc-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 12px;
      flex-wrap: wrap;

      .calc-group {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.82rem;
        font-weight: 600;
        color: #334155;

        .pct-input-wrap {
          display: flex;
          align-items: center;
          border: 1px solid #2563eb;
          border-radius: 6px;
          padding: 2px 6px;
          background: #eff6ff;

          input {
            width: 48px;
            border: none;
            background: transparent;
            font-size: 0.88rem;
            font-weight: 700;
            color: #1e40af;
            outline: none;
            text-align: right;
          }

          span { color: #1e40af; font-weight: 700; }
        }
      }

      .quick-pct-chips {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;

        button {
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 0.76rem;
          font-weight: 600;
          cursor: pointer;
          color: #334155;
          transition: all 0.15s ease;
          &:hover { background: #eff6ff; color: #2563eb; border-color: #93c5fd; }
        }
      }
    }

    .live-comparison-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #ffffff;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 10px 14px;
      gap: 10px;
      flex-wrap: wrap;

      .comp-col {
        display: flex;
        flex-direction: column;
        .comp-lbl { font-size: 0.72rem; color: #64748b; text-transform: uppercase; font-weight: 600; }
        .comp-val { font-size: 1.1rem; color: #0f172a; font-weight: 700; &.new { color: #166534; } }
      }

      .comp-arrow { color: #16a34a; font-size: 20px; width: 20px; height: 20px; }

      .comp-delta {
        margin-left: auto;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        .delta-amt { font-size: 0.95rem; font-weight: 800; color: #16a34a; }
        .delta-pct { font-size: 0.74rem; font-weight: 600; color: #047857; }
      }
    }

    .modal-footer {
      padding: 12px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      flex-shrink: 0;

      .btn-cancel { color: #64748b; font-weight: 500; }
      .btn-save {
        background: #2563eb !important;
        color: #ffffff !important;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 8px;
        height: 40px;
        padding: 0 18px;
      }
    }

    /* Responsive Breakpoints for Modal & Controls */
    @media (max-width: 640px) {
      .modal-overlay {
        padding: 8px !important;
        align-items: flex-end !important;
      }

      .modal-card {
        max-height: 94vh !important;
        border-radius: 18px 18px 10px 10px !important;
      }

      .modal-header {
        padding: 10px 14px !important;
        .header-icon-box {
          width: 36px !important;
          height: 36px !important;
          mat-icon { font-size: 20px; width: 20px; height: 20px; }
        }
        .modal-title { font-size: 0.98rem !important; }
        .modal-subtitle { font-size: 0.72rem !important; }
      }

      .modal-body {
        padding: 14px 12px !important;
        gap: 12px !important;
      }

      .mode-chips {
        display: flex !important;
        flex-direction: column !important;
        gap: 6px !important;
        .mode-chip {
          width: 100% !important;
          justify-content: flex-start !important;
          padding: 9px 12px !important;
        }
      }

      .form-row,
      .form-row.three-cols {
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
        .flex-1 {
          width: 100% !important;
        }
      }

      .calc-toolbar {
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 8px !important;

        .calc-group {
          justify-content: space-between !important;
        }

        .quick-pct-chips {
          display: grid !important;
          grid-template-columns: repeat(4, 1fr) !important;
          gap: 6px !important;
          width: 100% !important;
          button {
            padding: 6px 2px !important;
            text-align: center !important;
            width: 100% !important;
          }
        }
      }

      .live-comparison-card {
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 8px !important;

        .comp-col {
          flex-direction: row !important;
          justify-content: space-between !important;
          align-items: center !important;
        }

        .comp-arrow { display: none !important; }

        .comp-delta {
          margin-left: 0 !important;
          flex-direction: row !important;
          justify-content: space-between !important;
          align-items: center !important;
          border-top: 1px dashed #bbf7d0 !important;
          padding-top: 6px !important;
          width: 100% !important;
        }
      }

      .modal-footer {
        flex-direction: column-reverse !important;
        gap: 8px !important;
        padding: 10px 14px !important;

        .btn-cancel {
          width: 100% !important;
          justify-content: center !important;
        }

        .btn-save {
          width: 100% !important;
          justify-content: center !important;
          height: 42px !important;
        }
      }
    }

    .bulk-info-note {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 0.8rem;
      color: #1e40af;
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: #2563eb; flex-shrink: 0; }
    }

    /* Official Letterhead Styling for Print & Preview */
    .letter-print-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
      background: #ffffff;
      color: #0f172a;
      font-family: 'Times New Roman', Times, serif;

      .letter-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;

        .institute-brand {
          display: flex;
          align-items: center;
          gap: 12px;

          .brand-icon {
            font-size: 40px;
            width: 40px;
            height: 40px;
            color: #1e3a8a;
          }

          .inst-name {
            margin: 0;
            font-size: 1.4rem;
            color: #1e3a8a;
            font-weight: 800;
            letter-spacing: 0.05em;
          }

          .inst-sub {
            margin: 2px 0 0;
            font-size: 0.85rem;
            color: #475569;
          }
        }

        .letter-ref-box {
          display: flex;
          flex-direction: column;
          font-size: 0.82rem;
          color: #475569;
          text-align: right;
        }
      }

      .letter-divider {
        border: none;
        border-top: 2px solid #1e3a8a;
        margin: 16px 0;
      }

      .recipient-box {
        margin-bottom: 16px;
        font-size: 0.95rem;
        p { margin: 2px 0; }
        h4 { margin: 4px 0; font-size: 1.15rem; color: #0f172a; }
      }

      .letter-subject {
        margin: 16px 0;
        font-size: 1rem;
        text-decoration: underline;
        color: #1e3a8a;
      }

      .letter-narrative {
        line-height: 1.6;
        font-size: 0.95rem;
        margin-bottom: 16px;
        p { margin-bottom: 10px; }
      }

      .letter-breakup-table {
        width: 100%;
        border-collapse: collapse;
        margin: 16px 0;
        font-size: 0.9rem;

        th, td {
          border: 1px solid #cbd5e1;
          padding: 8px 12px;
          text-align: left;
        }

        th { background: #f1f5f9; color: #1e293b; }
        .gross-row { background: #f8fafc; font-size: 0.95rem; }
        .text-success { color: #166534; }
      }

      .letter-footer-note {
        font-size: 0.9rem;
        line-height: 1.5;
        margin: 20px 0;
      }

      .sign-block {
        display: flex;
        justify-content: space-between;
        margin-top: 40px;
        padding-top: 20px;

        .sign-box {
          width: 200px;
          .sign-line { border-top: 1px solid #0f172a; margin-bottom: 6px; }
          strong { font-size: 0.95rem; }
          p { margin: 2px 0 0; font-size: 0.8rem; color: #64748b; }
        }
      }
    }

    .empty-state {
      padding: 60px 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;

      .empty-icon-wrap {
        width: 64px;
        height: 64px;
        border-radius: 16px;
        background: #eff6ff;
        color: #2563eb;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 14px;
        mat-icon { font-size: 36px; width: 36px; height: 36px; }
      }

      h3 { margin: 0 0 6px; font-size: 1.25rem; color: #0f172a; }
      p { margin: 0 0 20px; color: #64748b; font-size: 0.9rem; max-width: 480px; }
      .primary-btn { font-weight: 600; border-radius: 8px; }
    }

    ::ng-deep .staff-searchable-select-panel,
    ::ng-deep .dept-searchable-select-panel {
      max-height: 420px !important;
      border-radius: 12px !important;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;

      .dropdown-search-option {
        position: sticky;
        top: 0;
        z-index: 100;
        background: #ffffff !important;
        border-bottom: 1px solid #e2e8f0;
        padding: 8px 12px !important;
        height: auto !important;
        line-height: normal !important;
        cursor: default !important;
        opacity: 1 !important;

        .dropdown-search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 6px 10px;
          transition: border-color 0.2s, box-shadow 0.2s;

          &:focus-within {
            border-color: #2563eb;
            background: #ffffff;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .search-box-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
            color: #64748b;
          }

          .search-inner-input {
            border: none;
            outline: none;
            background: transparent;
            font-size: 0.88rem;
            color: #0f172a;
            width: 100%;
            font-family: inherit;

            &::placeholder {
              color: #94a3b8;
            }
          }

          .clear-mini-btn {
            border: none;
            background: transparent;
            cursor: pointer;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #94a3b8;
            &:hover { color: #0f172a; }
            mat-icon { font-size: 16px; width: 16px; height: 16px; }
          }
        }

        .search-meta-bar {
          margin-top: 6px;
          font-size: 0.75rem;
          color: #64748b;
          display: flex;
          justify-content: space-between;
          strong { color: #2563eb; }
        }
      }

      .no-results-option {
        height: auto !important;
        padding: 16px !important;
        text-align: center;
        opacity: 1 !important;
        .no-results-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          color: #94a3b8;
          font-size: 0.85rem;
          mat-icon { font-size: 28px; width: 28px; height: 28px; color: #cbd5e1; }
          strong { color: #475569; }
        }
      }

      .staff-option-item {
        height: auto !important;
        min-height: 48px;
        padding: 8px 14px !important;
        line-height: normal !important;
        border-bottom: 1px solid #f1f5f9;

        .staff-option-content {
          display: flex;
          flex-direction: column;
          gap: 3px;
          width: 100%;

          .staff-opt-title {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.92rem;
            color: #0f172a;
            strong { font-weight: 600; }
            .staff-opt-code { color: #64748b; font-size: 0.8rem; }
            .staff-opt-type {
              margin-left: auto;
              font-size: 0.7rem;
              padding: 2px 7px;
              border-radius: 10px;
              background: #f1f5f9;
              color: #475569;
              font-weight: 600;
              &.teaching { background: #eff6ff; color: #1d4ed8; }
            }
          }

          .staff-opt-subtitle {
            font-size: 0.78rem;
            color: #64748b;
            display: flex;
            gap: 4px;
          }
        }
      }

      .dept-opt-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9rem;
        color: #1e293b;
        .dept-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #64748b;
        }
      }
    }
  `]
})
export class StaffPromotionsComponent implements OnInit {
  private api = API_BASE;
  targetTeacherIdFromRoute: string | null = null;

  loading = false;
  submitting = false;

  records: StaffPromotionIncrementDto[] = [];
  teachers: TeacherDto[] = [];

  // In-Dropdown Search & Filter for Staff
  staffSearchQuery = '';
  filteredTeachersForSelect: TeacherDto[] = [];

  // Dynamic Departments from API & In-Dropdown Search
  departments: string[] = [];
  filteredDepartments: string[] = [];
  departmentSearchQuery = '';

  summary: StaffPromotionSummaryDto = {
    totalRecords: 0,
    totalPromotions: 0,
    totalIncrements: 0,
    totalMonthlyGrossHike: 0,
    averageHikePercentage: 0
  };

  searchQuery = '';
  selectedStaffType = 'All';
  selectedType = '';
  selectedCycle = 'All';
  distinctCycles: string[] = [];
  private searchDebounceTimer: any = null;

  // Server-Side Sorting
  sortBy = 'effectiveDate';
  sortDirection: 'asc' | 'desc' = 'desc';

  // Smart View Mode & Detail Drawer Inspector
  viewMode: 'table' | 'grid' = 'table';
  showDetailDrawer = false;
  selectedRecordForDetails: StaffPromotionIncrementDto | null = null;

  // Staff Profile Photos & Initials Fallback
  imgErrors: Record<string, boolean> = {};

  getStaffPhoto(r: StaffPromotionIncrementDto | null | undefined): string {
    if (!r) return '';
    const photo = r.photoUrl || this.teachers.find(t => t.id === r.teacherId)?.photoUrl;
    if (!photo) return '';
    return this.getPhotoUrl(photo);
  }

  getPhotoUrl(photo?: string | null): string {
    if (!photo) return '';
    if (photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('data:')) {
      return photo;
    }
    if (photo.startsWith('/')) {
      return `${environment.apiBaseUrl}${photo}`;
    }
    return `${environment.apiBaseUrl}/${photo}`;
  }

  getInitials(name?: string): string {
    if (!name) return 'ST';
    const clean = name.replace(/^(Mr|Mrs|Ms|Dr|Er|Prof)\.?\s+/i, '').trim();
    const parts = clean.split(/\s+/).filter(p => p.length > 0);
    if (parts.length === 0) return 'ST';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  // Server-Side Pagination
  currentPage = 1;
  pageSize = 10;
  totalCount = 0;
  totalPages = 1;
  pageSizeOptions = [10, 25, 50];
  min = Math.min;

  get availableCycles(): string[] {
    const list = [...this.distinctCycles];
    const suggestions = ['Annual Appraisal Cycle', 'Merit Increment', 'Promotion & Role Upgrade', 'Probation Confirmation'];
    return Array.from(new Set([...list, ...suggestions])).filter(c => c && c.trim().length > 0);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadData();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadData();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadData();
    }
  }

  onPageSizeChange(newSize: any) {
    this.pageSize = Number(newSize);
    this.currentPage = 1;
    this.loadData();
  }

  onSort(column: string) {
    if (this.sortBy === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortDirection = column === 'effectiveDate' ? 'desc' : 'asc';
    }
    this.currentPage = 1;
    this.loadData();
  }

  getSortIcon(column: string): string {
    if (this.sortBy !== column) return 'unfold_more';
    return this.sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  isSorted(column: string): boolean {
    return this.sortBy === column;
  }

  onSearchInput(value: string) {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.currentPage = 1;
      this.loadData();
    }, 350);
  }

  clearSearch() {
    this.searchQuery = '';
    this.currentPage = 1;
    this.loadData();
  }

  onFilterChange() {
    this.currentPage = 1;
    this.loadData();
  }

  openDetailDrawer(r: StaffPromotionIncrementDto) {
    this.selectedRecordForDetails = r;
    this.showDetailDrawer = true;
  }

  closeDetailDrawer() {
    this.showDetailDrawer = false;
    this.selectedRecordForDetails = null;
  }

  // Policy, Access Control & Tenure State
  private authService = inject(AuthService, { optional: true });
  private confirmDialog = inject(ConfirmDialogService);
  get canManagePolicy(): boolean {
    return this.authService ? (this.authService.isAdmin() || this.authService.isHR()) : true;
  }
  showPolicyModal = false;
  savingPolicy = false;
  policy: StaffAppraisalPolicy = {
    minServiceMonthsForIncrement: 12,
    enforceDryPromotionInProbation: true,
    allowSpecialBypass: true,
    bypassApprovalRole: 'SuperAdmin,InstituteAdmin,HR'
  };

  selectedTeacherTenureMonths: number = 0;
  selectedTeacherTenureDisplay: string = '';
  isUnderProbation: boolean = false;

  // New Promotion / Increment Drawer Modal
  showDrawer = false;
  selectedTeacher: TeacherDto | null = null;
  currentSalaryInfo: any = null;

  formData: CreateStaffPromotionIncrementDto = {
    teacherId: '',
    type: 'PromotionAndIncrement',
    newDesignation: '',
    newDepartment: '',
    newBasicSalary: 0,
    newHRA: 0,
    newOtherAllowances: 0,
    effectiveDate: '',
    reason: '',
    remarks: '',
    isSpecialBypass: false,
    specialBypassReason: ''
  };

  hikePercent: number = 10;
  effectiveDateStr = new Date().toISOString().substring(0, 10);

  roleSuggestions = [
    'PRT Teacher', 'TGT Teacher', 'PGT Teacher',
    'Subject HOD', 'Academic Coordinator', 'Vice Principal',
    'Principal', 'HR Executive', 'HR Manager', 'Senior Accountant'
  ];

  // Bulk Modal
  showBulkModal = false;
  bulkData: BulkIncrementDto = {
    staffType: 'All',
    department: 'All',
    incrementType: 'Percentage',
    incrementValue: 10,
    effectiveDate: '',
    reason: ''
  };
  bulkEffectiveDateStr = new Date().toISOString().substring(0, 10);

  // Letter Preview Modal
  showLetterModal = false;
  selectedRecordForLetter: StaffPromotionIncrementDto | null = null;

  constructor(private http: HttpClient, private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['teacherId']) {
        this.targetTeacherIdFromRoute = params['teacherId'];
      }
    });
    this.loadPolicy();
    this.loadData();
    this.loadTeachers();
  }

  loadData() {
    this.loading = true;
    let params = new HttpParams()
      .set('pageNumber', this.currentPage.toString())
      .set('pageSize', this.pageSize.toString())
      .set('sortBy', this.sortBy)
      .set('sortDirection', this.sortDirection);

    if (this.searchQuery && this.searchQuery.trim()) {
      params = params.set('search', this.searchQuery.trim());
    }
    if (this.selectedStaffType && this.selectedStaffType !== 'All') {
      params = params.set('staffType', this.selectedStaffType);
    }
    if (this.selectedType) {
      params = params.set('type', this.selectedType);
    }
    if (this.selectedCycle && this.selectedCycle !== 'All') {
      params = params.set('cycle', this.selectedCycle);
    }

    this.http.get<StaffPromotionsPagedResponse>(`${this.api}/staff-promotions`, { params }).subscribe({
      next: (res) => {
        this.records = res?.records || [];
        this.totalCount = res?.totalCount ?? (res?.summary?.totalRecords || this.records.length);
        this.currentPage = res?.pageNumber ?? this.currentPage;
        this.pageSize = res?.pageSize ?? this.pageSize;
        this.totalPages = res?.totalPages ?? Math.max(1, Math.ceil(this.totalCount / this.pageSize));
        this.distinctCycles = res?.distinctCycles || [];
        this.summary = res?.summary || {
          totalRecords: this.totalCount, totalPromotions: 0, totalIncrements: 0, totalMonthlyGrossHike: 0, averageHikePercentage: 0
        };
        setTimeout(() => {
          this.loading = false;
        }, 200);
      },
      error: () => {
        this.loading = false;
        this.records = [];
        this.totalCount = 0;
        this.totalPages = 1;
      }
    });
  }

  loadPolicy() {
    this.http.get<StaffAppraisalPolicy>(`${this.api}/staff-promotions/policy`).subscribe({
      next: (res) => {
        if (res) {
          this.policy = res;
          this.calcTeacherTenure();
        }
      },
      error: (err) => console.warn('Could not load staff appraisal policy', err)
    });
  }

  openPolicyModal() {
    this.showPolicyModal = true;
  }

  closePolicyModal() {
    this.showPolicyModal = false;
  }

  savePolicy() {
    this.savingPolicy = true;
    this.http.post<StaffAppraisalPolicy>(`${this.api}/staff-promotions/policy`, this.policy).subscribe({
      next: (res) => {
        this.savingPolicy = false;
        if (res) this.policy = res;
        this.showPolicyModal = false;
        this.calcTeacherTenure();
        this.confirmDialog.alert('Policy Rules Updated', 'Staff Appraisal & Promotion Policy rules have been successfully saved.', 'success');
      },
      error: (err) => {
        this.savingPolicy = false;
        this.confirmDialog.alert('Update Failed', err?.error?.message || 'Failed to update policy settings.', 'danger');
      }
    });
  }

  loadTeachers() {
    this.http.get<TeacherDto[]>(`${this.api}/teachers?activeOnly=true`).subscribe({
      next: (res) => {
        this.teachers = res || [];
        this.filteredTeachersForSelect = [...this.teachers];
        this.extractDepartmentsFromTeachers();
        if (this.targetTeacherIdFromRoute) {
          const found = this.teachers.find(t => t.id === this.targetTeacherIdFromRoute);
          if (found) {
            this.openDrawer(this.targetTeacherIdFromRoute);
          }
        }
      },
      error: () => {
        this.teachers = [];
        this.filteredTeachersForSelect = [];
        this.extractDepartmentsFromTeachers();
      }
    });
  }

  extractDepartmentsFromTeachers() {
    const fromTeachers = Array.from(new Set(
      this.teachers
        .map(t => (t.department || '').trim())
        .filter(d => d.length > 0)
    )).sort();

    const standardDepts = [
      'Academic Administration',
      'Administration & HR',
      'Art & Craft Department',
      'Biology Department',
      'Chemistry Department',
      'Commerce & Accounts',
      'Computer Science & IT',
      'English Department',
      'Finance & Accounts',
      'Hindi Department',
      'History & Civics',
      'Mathematics Department',
      'Music & Performing Arts',
      'Physical Education & Sports',
      'Physics Department',
      'Primary Wing (PRT)',
      'Science Department',
      'Social Science Department'
    ];

    const merged = Array.from(new Set([...fromTeachers, ...standardDepts])).sort();
    this.departments = merged;
    this.filteredDepartments = [...this.departments];
  }

  filterTeachersForSelect() {
    const q = (this.staffSearchQuery || '').trim().toLowerCase();
    if (!q) {
      this.filteredTeachersForSelect = [...this.teachers];
      return;
    }
    this.filteredTeachersForSelect = this.teachers.filter(t =>
      (t.fullName && t.fullName.toLowerCase().includes(q)) ||
      (t.employeeCode && t.employeeCode.toLowerCase().includes(q)) ||
      (t.designation && t.designation.toLowerCase().includes(q)) ||
      (t.department && t.department.toLowerCase().includes(q)) ||
      (t.staffType && String(t.staffType).toLowerCase().includes(q))
    );
  }

  clearStaffSearch(e?: Event) {
    if (e) e.stopPropagation();
    this.staffSearchQuery = '';
    this.filteredTeachersForSelect = [...this.teachers];
    setTimeout(() => {
      const inp = document.getElementById('staff-dropdown-search-input') as HTMLInputElement;
      if (inp) inp.focus();
    }, 50);
  }

  onStaffSelectOpened(opened: boolean) {
    if (opened) {
      this.staffSearchQuery = '';
      this.filteredTeachersForSelect = [...this.teachers];
      setTimeout(() => {
        const inp = document.getElementById('staff-dropdown-search-input') as HTMLInputElement;
        if (inp) inp.focus();
      }, 100);
    }
  }

  filterDepartments() {
    const q = (this.departmentSearchQuery || '').trim().toLowerCase();
    if (!q) {
      this.filteredDepartments = [...this.departments];
      return;
    }
    this.filteredDepartments = this.departments.filter(d => d.toLowerCase().includes(q));
  }

  clearDeptSearch(e?: Event) {
    if (e) e.stopPropagation();
    this.departmentSearchQuery = '';
    this.filteredDepartments = [...this.departments];
    setTimeout(() => {
      const inp = document.getElementById('dept-dropdown-search-input') as HTMLInputElement;
      if (inp) inp.focus();
    }, 50);
  }

  onDeptSelectOpened(opened: boolean) {
    if (opened) {
      this.departmentSearchQuery = '';
      this.filteredDepartments = [...this.departments];
      setTimeout(() => {
        const inp = document.getElementById('dept-dropdown-search-input') as HTMLInputElement;
        if (inp) inp.focus();
      }, 100);
    }
  }

  applyFilters() {
    this.currentPage = 1;
    this.loadData();
  }

  openDrawer(preselectedTeacherId?: string) {
    this.staffSearchQuery = '';
    this.filteredTeachersForSelect = [...this.teachers];
    this.departmentSearchQuery = '';
    this.filteredDepartments = [...this.departments];

    this.formData = {
      teacherId: preselectedTeacherId || (this.teachers[0]?.id || ''),
      type: 'PromotionAndIncrement',
      newDesignation: '',
      newDepartment: '',
      newBasicSalary: 0,
      newHRA: 0,
      newOtherAllowances: 0,
      effectiveDate: new Date().toISOString(),
      reason: (this.distinctCycles && this.distinctCycles.length > 0) ? this.distinctCycles[0] : '',
      remarks: '',
      isSpecialBypass: false,
      specialBypassReason: ''
    };
    this.hikePercent = 10;
    this.effectiveDateStr = new Date().toISOString().substring(0, 10);
    this.onTeacherSelect();
    this.showDrawer = true;
  }

  closeDrawer() {
    this.showDrawer = false;
  }

  onTeacherSelect() {
    if (!this.formData.teacherId) {
      this.selectedTeacher = null;
      this.currentSalaryInfo = null;
      this.calcTeacherTenure();
      return;
    }

    this.selectedTeacher = this.teachers.find(t => t.id === this.formData.teacherId) || null;
    this.calcTeacherTenure();

    if (this.selectedTeacher) {
      this.formData.newDesignation = this.selectedTeacher.designation || '';
      this.formData.newDepartment = this.selectedTeacher.department || '';

      // Fetch teacher's current active salary structure
      this.http.get<any>(`${this.api}/teachers/${this.selectedTeacher.id}/salary`).subscribe({
        next: (sal) => {
          if (sal && sal.basicSalary > 0) {
            this.currentSalaryInfo = {
              basicSalary: sal.basicSalary || 0,
              hra: sal.hra || 0,
              otherAllowances: sal.otherAllowances || 0,
              grossSalary: sal.grossSalary || ((sal.basicSalary || 0) + (sal.hra || 0) + (sal.otherAllowances || 0))
            };
            if (this.formData.type === 'Promotion') {
              this.formData.newBasicSalary = this.currentSalaryInfo.basicSalary;
              this.formData.newHRA = this.currentSalaryInfo.hra;
              this.formData.newOtherAllowances = this.currentSalaryInfo.otherAllowances;
            } else {
              this.applyPercentHike();
            }
          } else {
            this.currentSalaryInfo = null;
            this.formData.newBasicSalary = 0;
            this.formData.newHRA = 0;
            this.formData.newOtherAllowances = 0;
          }
        },
        error: () => {
          this.currentSalaryInfo = null;
          this.formData.newBasicSalary = 0;
          this.formData.newHRA = 0;
          this.formData.newOtherAllowances = 0;
        }
      });
    }
  }

  calcTeacherTenure() {
    if (!this.selectedTeacher) {
      this.selectedTeacherTenureMonths = 0;
      this.selectedTeacherTenureDisplay = '';
      this.isUnderProbation = false;
      return;
    }

    const joinStr = this.selectedTeacher.joiningDate || this.selectedTeacher.createdAt;
    if (!joinStr) {
      this.selectedTeacherTenureMonths = 0;
      this.selectedTeacherTenureDisplay = 'N/A';
      this.isUnderProbation = false;
      return;
    }

    const joinDate = new Date(joinStr);
    const effDate = this.effectiveDateStr ? new Date(this.effectiveDateStr) : new Date();
    let months = (effDate.getFullYear() - joinDate.getFullYear()) * 12 + (effDate.getMonth() - joinDate.getMonth());
    if (effDate.getDate() < joinDate.getDate()) months--;
    this.selectedTeacherTenureMonths = Math.max(0, months);

    const yrs = Math.floor(this.selectedTeacherTenureMonths / 12);
    const remMo = this.selectedTeacherTenureMonths % 12;
    this.selectedTeacherTenureDisplay = yrs > 0
      ? `${yrs} yr ${remMo} mo (${this.selectedTeacherTenureMonths} mos)`
      : `${this.selectedTeacherTenureMonths} month(s)`;

    const minMonths = this.policy?.minServiceMonthsForIncrement ?? 12;
    const enforce = this.policy?.enforceDryPromotionInProbation ?? true;

    this.isUnderProbation = enforce && (this.selectedTeacherTenureMonths < minMonths);

    // If staff is under probation threshold and bypass is not active, enforce Promotion Only (Dry)
    if (this.isUnderProbation && !this.formData.isSpecialBypass) {
      this.formData.type = 'Promotion';
    }
  }

  onBypassToggle() {
    if (!this.formData.isSpecialBypass && this.isUnderProbation) {
      this.formData.type = 'Promotion';
    } else if (this.formData.isSpecialBypass && this.formData.type === 'Promotion') {
      this.formData.type = 'PromotionAndIncrement';
      this.applyPercentHike();
    }
  }

  setMode(type: string) {
    this.formData.type = type;
    if (type === 'Promotion') {
      if (this.currentSalaryInfo) {
        this.formData.newBasicSalary = this.currentSalaryInfo.basicSalary;
        this.formData.newHRA = this.currentSalaryInfo.hra;
        this.formData.newOtherAllowances = this.currentSalaryInfo.otherAllowances;
      }
    } else {
      this.applyPercentHike();
    }
  }

  applyPercentHike() {
    if (!this.currentSalaryInfo) return;
    const factor = 1 + ((this.hikePercent || 0) / 100);
    this.formData.newBasicSalary = Math.round(this.currentSalaryInfo.basicSalary * factor);
    this.formData.newHRA = Math.round(this.currentSalaryInfo.hra * factor);
    this.formData.newOtherAllowances = Math.round(this.currentSalaryInfo.otherAllowances * factor);
  }

  recalcGross() {
    // Trigger change detection for live comparison box
  }

  get currentOldGross(): number {
    return this.currentSalaryInfo ? this.currentSalaryInfo.grossSalary : 0;
  }

  get currentNewGross(): number {
    return (this.formData.newBasicSalary || 0) + (this.formData.newHRA || 0) + (this.formData.newOtherAllowances || 0);
  }

  get computedHikePct(): number {
    if (this.currentOldGross <= 0) return 0;
    return Math.round(((this.currentNewGross - this.currentOldGross) / this.currentOldGross) * 100);
  }

  savePromotion() {
    if (!this.formData.teacherId) return;

    if (this.isUnderProbation && this.formData.type !== 'Promotion' && !this.formData.isSpecialBypass) {
      this.confirmDialog.alert(
        'Tenure Requirement Notice',
        `Staff member has completed only ${this.selectedTeacherTenureMonths} month(s) of service. Institute policy requires minimum ${this.policy.minServiceMonthsForIncrement} months for financial increments. Please select 'Promotion Only (Dry)' or authorize a Special Management/HR Approval Bypass.`,
        'warning'
      );
      return;
    }

    this.submitting = true;
    this.formData.effectiveDate = new Date(this.effectiveDateStr).toISOString();

    if (this.formData.type === 'Promotion') {
      this.formData.newBasicSalary = this.currentSalaryInfo?.basicSalary || 0;
      this.formData.newHRA = this.currentSalaryInfo?.hra || 0;
      this.formData.newOtherAllowances = this.currentSalaryInfo?.otherAllowances || 0;
    }

    this.http.post(`${this.api}/staff-promotions`, this.formData).subscribe({
      next: () => {
        this.submitting = false;
        this.closeDrawer();
        this.confirmDialog.alert(
          'Appraisal Recorded',
          `Staff promotion and salary appraisal record for ${this.selectedTeacher?.fullName || 'staff member'} has been successfully saved.`,
          'success'
        );
        this.loadData();
        this.loadTeachers();
      },
      error: (err) => {
        this.submitting = false;
        this.confirmDialog.alert('Promotion Save Failed', err?.error?.message || 'Failed to record staff promotion.', 'danger');
      }
    });
  }

  // Bulk Modal Actions
  openBulkModal() {
    this.bulkData = {
      staffType: 'All',
      department: 'All',
      incrementType: 'Percentage',
      incrementValue: 10,
      effectiveDate: new Date().toISOString(),
      reason: (this.distinctCycles && this.distinctCycles.length > 0) ? this.distinctCycles[0] : ''
    };
    this.bulkEffectiveDateStr = new Date().toISOString().substring(0, 10);
    this.showBulkModal = true;
  }

  closeBulkModal() {
    this.showBulkModal = false;
  }

  executeBulkIncrement() {
    this.submitting = true;
    this.bulkData.effectiveDate = new Date(this.bulkEffectiveDateStr).toISOString();

    this.http.post<any>(`${this.api}/staff-promotions/bulk-increment`, this.bulkData).subscribe({
      next: (res) => {
        this.submitting = false;
        this.closeBulkModal();
        this.confirmDialog.alert('Bulk Increment Applied', res?.message || 'Bulk increment applied successfully across selected staff members.', 'success');
        this.loadData();
      },
      error: (err) => {
        this.submitting = false;
        this.confirmDialog.alert('Bulk Increment Failed', err?.error?.message || 'Failed to apply bulk increment.', 'danger');
      }
    });
  }

  // Delete Action
  deleteRecord(r: StaffPromotionIncrementDto) {
    this.confirmDialog.danger(
      'Delete Promotion Audit Record',
      `Are you sure you want to delete this promotion/appraisal audit record for ${r.teacherName}? This action cannot be undone.`
    ).subscribe(confirmed => {
      if (!confirmed) return;

      this.http.delete(`${this.api}/staff-promotions/${r.id}`).subscribe({
        next: () => {
          this.confirmDialog.alert('Record Deleted', 'Promotion audit record has been deleted.', 'success');
          this.loadData();
        },
        error: (err) => this.confirmDialog.alert('Delete Failed', err?.error?.message || 'Failed to delete record.', 'danger')
      });
    });
  }

  // Letter Preview
  viewLetter(r: StaffPromotionIncrementDto) {
    this.selectedRecordForLetter = r;
    this.showLetterModal = true;
  }

  printLetter() {
    window.print();
  }

  getTypeBadgeClass(type: string): string {
    switch (type) {
      case 'PromotionAndIncrement': return 'badge-both';
      case 'Promotion': return 'badge-promo';
      case 'Increment': return 'badge-inc';
      default: return 'badge-both';
    }
  }

  getTypeText(type: string): string {
    switch (type) {
      case 'PromotionAndIncrement': return 'Promotion + Increment';
      case 'Promotion': return 'Promotion Only';
      case 'Increment': return 'Salary Increment';
      default: return type;
    }
  }

  formatReason(reason?: string): string {
    if (!reason) return 'Appraisal';
    // Remove Hindi parenthetical text like (वार्षिक वेतन वृद्धि)
    let clean = reason.replace(/\s*\([^)]*\)/g, '').trim();
    return clean || reason;
  }
}
