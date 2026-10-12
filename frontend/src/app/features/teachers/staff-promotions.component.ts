import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
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
import { API_BASE, TeacherDto, StaffPromotionIncrementDto, CreateStaffPromotionIncrementDto, BulkIncrementDto, StaffPromotionSummaryDto } from './teacher.models';

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
    MatDialogModule
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

      <!-- KPI Summary Cards (Clean Center Aligned Numbers) -->
      <div class="stats-grid">
        <mat-card class="stat-card total mat-elevation-z1">
          <div class="stat-icon"><mat-icon>assessment</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{ summary.totalRecords }}</span>
            <span class="stat-lbl">Total Appraisals</span>
          </div>
        </mat-card>

        <mat-card class="stat-card promo mat-elevation-z1">
          <div class="stat-icon"><mat-icon>trending_up</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{ summary.totalPromotions }}</span>
            <span class="stat-lbl">Role Promotions</span>
          </div>
        </mat-card>

        <mat-card class="stat-card inc mat-elevation-z1">
          <div class="stat-icon"><mat-icon>payments</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{ summary.totalIncrements }}</span>
            <span class="stat-lbl">Salary Increments</span>
          </div>
        </mat-card>

        <mat-card class="stat-card budget mat-elevation-z1">
          <div class="stat-icon"><mat-icon>currency_rupee</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">₹{{ summary.totalMonthlyGrossHike | number:'1.0-0' }}</span>
            <span class="stat-lbl">Monthly Budget Hike (Avg: {{ summary.averageHikePercentage }}%)</span>
          </div>
        </mat-card>
      </div>

      <!-- Filter & Search Toolbar -->
      <mat-card class="filter-card mat-elevation-z1">
        <div class="filter-toolbar">
          <div class="search-box">
            <mat-icon>search</mat-icon>
            <input
              type="text"
              placeholder="Search staff name, code, designation, or reason..."
              [(ngModel)]="searchQuery"
              (ngModelChange)="applyFilters()"
            />
            <button *ngIf="searchQuery" type="button" class="clear-btn" (click)="searchQuery = ''; applyFilters()">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="filter-selects">
            <mat-form-field appearance="outline" class="mini-field">
              <mat-label>Staff Type</mat-label>
              <mat-select [(ngModel)]="selectedStaffType" (selectionChange)="applyFilters()">
                <mat-option value="All">All Staff Types</mat-option>
                <mat-option value="Teaching">Teaching Faculty</mat-option>
                <mat-option value="NonTeaching">Non-Teaching / HR</mat-option>
                <mat-option value="Administrative">Administrative</mat-option>
                <mat-option value="Support">Support Staff</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="mini-field">
              <mat-label>Appraisal Type</mat-label>
              <mat-select [(ngModel)]="selectedType" (selectionChange)="applyFilters()">
                <mat-option value="">All Types</mat-option>
                <mat-option value="PromotionAndIncrement">Promotion + Increment</mat-option>
                <mat-option value="Increment">Salary Increment Only</mat-option>
                <mat-option value="Promotion">Promotion Only</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>
      </mat-card>

      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

      <!-- Main Data Table / Mobile Card View -->
      <div class="records-container" *ngIf="!loading && filteredRecords.length > 0">
        <!-- Desktop Table View -->
        <div class="table-responsive desktop-only">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Appraisal Type</th>
                <th>Designation Shift</th>
                <th>Salary Revision (Gross CTC)</th>
                <th>Effective Date</th>
                <th>Reason / Cycle</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of filteredRecords">
                <td>
                  <div class="staff-id-cell">
                    <div class="staff-avatar">
                      <mat-icon>{{ r.staffType === 'Teaching' ? 'school' : 'badge' }}</mat-icon>
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
                  <div class="shift-cell" *ngIf="r.oldDesignation !== r.newDesignation || r.type === 'Promotion' || r.type === 'PromotionAndIncrement'">
                    <span class="old-role">{{ r.oldDesignation }}</span>
                    <mat-icon class="arrow-icon">arrow_forward</mat-icon>
                    <strong class="new-role">{{ r.newDesignation }}</strong>
                  </div>
                  <span class="no-change" *ngIf="r.oldDesignation === r.newDesignation && r.type === 'Increment'">
                    {{ r.newDesignation }} (No change)
                  </span>
                </td>
                <td>
                  <div class="salary-cell" *ngIf="r.newGrossSalary > 0">
                    <div class="salary-row">
                      <span class="old-sal">₹{{ r.oldGrossSalary | number:'1.0-0' }}</span>
                      <mat-icon class="arrow-icon">arrow_forward</mat-icon>
                      <strong class="new-sal">₹{{ r.newGrossSalary | number:'1.0-0' }}</strong>
                    </div>
                    <div class="hike-badge" *ngIf="r.newGrossSalary > r.oldGrossSalary">
                      <mat-icon>trending_up</mat-icon>
                      <span>+₹{{ (r.newGrossSalary - r.oldGrossSalary) | number:'1.0-0' }} (+{{ r.incrementPercentage }}%)</span>
                    </div>
                  </div>
                  <span class="no-change" *ngIf="r.type === 'Promotion' && r.newGrossSalary === r.oldGrossSalary">
                    ₹{{ r.oldGrossSalary | number:'1.0-0' }} (Unchanged)
                  </span>
                </td>
                <td>
                  <div class="date-cell">
                    <strong>{{ r.effectiveDate | date:'dd MMM yyyy' }}</strong>
                    <small>Indian Standard Time</small>
                  </div>
                </td>
                <td>
                  <span class="reason-pill" [matTooltip]="r.remarks || ''">{{ r.reason || 'Appraisal' }}</span>
                </td>
                <td class="text-right">
                  <div class="action-btn-group">
                    <button mat-icon-button class="mini-btn view" (click)="viewLetter(r)" matTooltip="View / Print Appraisal Letter">
                      <mat-icon>description</mat-icon>
                    </button>
                    <button mat-icon-button class="mini-btn delete" (click)="deleteRecord(r)" matTooltip="Delete Audit Record">
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile / Tablet Card View -->
        <div class="mobile-only cards-list">
          <mat-card class="mobile-record-card mat-elevation-z1" *ngFor="let r of filteredRecords">
            <div class="m-card-header">
              <div class="m-staff-info">
                <strong>{{ r.teacherName }}</strong>
                <span class="m-code">({{ r.employeeCode }})</span>
                <span class="type-pill" [class.teaching]="r.staffType === 'Teaching'">{{ r.staffType }}</span>
              </div>
              <span class="type-badge" [ngClass]="getTypeBadgeClass(r.type)">
                {{ getTypeText(r.type) }}
              </span>
            </div>

            <!-- Role Shift -->
            <div class="m-data-row" *ngIf="r.oldDesignation !== r.newDesignation || r.type !== 'Increment'">
              <span class="m-lbl">Designation:</span>
              <div class="shift-cell">
                <span class="old-role">{{ r.oldDesignation }}</span>
                <mat-icon class="arrow-icon">arrow_forward</mat-icon>
                <strong class="new-role">{{ r.newDesignation }}</strong>
              </div>
            </div>

            <!-- Salary Shift -->
            <div class="m-data-row" *ngIf="r.newGrossSalary > 0">
              <span class="m-lbl">Gross CTC:</span>
              <div class="salary-cell">
                <span class="old-sal">₹{{ r.oldGrossSalary | number:'1.0-0' }}</span>
                <mat-icon class="arrow-icon">arrow_forward</mat-icon>
                <strong class="new-sal">₹{{ r.newGrossSalary | number:'1.0-0' }}</strong>
                <span class="hike-badge-m" *ngIf="r.newGrossSalary > r.oldGrossSalary">
                  +{{ r.incrementPercentage }}%
                </span>
              </div>
            </div>

            <div class="m-card-footer">
              <div class="m-footer-left">
                <span class="m-date">Effective: {{ r.effectiveDate | date:'dd MMM yyyy' }}</span>
                <span class="reason-pill-m">{{ r.reason }}</span>
              </div>
              <div class="action-btn-group">
                <button mat-stroked-button class="m-action-btn" (click)="viewLetter(r)">
                  <mat-icon>description</mat-icon> Letter
                </button>
                <button mat-icon-button class="mini-btn delete" (click)="deleteRecord(r)">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>
            </div>
          </mat-card>
        </div>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="!loading && filteredRecords.length === 0">
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

      <!-- New Promotion / Appraisal Drawer / Modal -->
      <div class="modal-overlay" *ngIf="showDrawer" (click)="closeDrawer()">
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
                    <span *ngIf="selectedTeacher">
                      <strong>{{ selectedTeacher.fullName }}</strong> ({{ selectedTeacher.employeeCode }}) &bull; {{ selectedTeacher.designation || 'Staff' }}
                    </span>
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
                      <button
                        type="button"
                        class="clear-mini-btn"
                        *ngIf="staffSearchQuery"
                        (click)="clearStaffSearch($event)"
                        (mousedown)="$event.stopPropagation()"
                      >
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>
                    <div class="search-meta-bar">
                      <span>Showing <strong>{{ filteredTeachersForSelect.length }}</strong> of {{ teachers.length }} staff</span>
                    </div>
                  </mat-option>

                  <!-- No Results State -->
                  <mat-option disabled *ngIf="filteredTeachersForSelect.length === 0" class="no-results-option">
                    <div class="no-results-wrap">
                      <mat-icon>search_off</mat-icon>
                      <span>No staff found matching "<strong>{{ staffSearchQuery }}</strong>"</span>
                    </div>
                  </mat-option>

                  <!-- Filtered Staff Options -->
                  <mat-option *ngFor="let t of filteredTeachersForSelect" [value]="t.id" class="staff-option-item">
                    <div class="staff-option-content">
                      <div class="staff-opt-title">
                        <strong>{{ t.fullName }}</strong>
                        <span class="staff-opt-code">({{ t.employeeCode }})</span>
                        <span class="staff-opt-type" [class.teaching]="t.staffType === 'Teaching'">{{ t.staffType || 'Staff' }}</span>
                      </div>
                      <div class="staff-opt-subtitle">
                        <span>{{ t.designation || 'Faculty' }}</span>
                        <span *ngIf="t.department">&bull; {{ t.department }}</span>
                      </div>
                    </div>
                  </mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <!-- Current Profile Preview Box -->
            <div class="current-profile-box" *ngIf="selectedTeacher">
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
                  <span *ngIf="selectedTeacher.department">&bull; Dept: <strong>{{ selectedTeacher.department }}</strong></span>
                </div>
                <div class="prof-salary-row" *ngIf="currentSalaryInfo">
                  <span>Current Basic: <strong>₹{{ currentSalaryInfo.basicSalary | number:'1.0-0' }}</strong></span>
                  <span>&bull; HRA: <strong>₹{{ currentSalaryInfo.hra | number:'1.0-0' }}</strong></span>
                  <span>&bull; Allowances: <strong>₹{{ currentSalaryInfo.otherAllowances | number:'1.0-0' }}</strong></span>
                  <span>&bull; Current Gross: <strong class="text-primary">₹{{ currentSalaryInfo.grossSalary | number:'1.0-0' }}</strong></span>
                </div>
                <div class="prof-salary-missing-row" *ngIf="!currentSalaryInfo">
                  <mat-icon class="warn-icon">warning_amber</mat-icon>
                  <span>Salary Structure not configured yet (संरचना नहीं बनी है).</span>
                  <a [routerLink]="['/teachers/salary']" [queryParams]="{ teacherId: selectedTeacher.id }" target="_blank" class="configure-link">
                    Define Salary Structure &rarr;
                  </a>
                </div>
              </div>
            </div>

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
            </div>

            <!-- 3. Promotion Section (If Mode involves Promotion) -->
            <div class="section-box" *ngIf="formData.type === 'Promotion' || formData.type === 'PromotionAndIncrement'">
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
                        <button
                          type="button"
                          class="clear-mini-btn"
                          *ngIf="departmentSearchQuery"
                          (click)="clearDeptSearch($event)"
                          (mousedown)="$event.stopPropagation()"
                        >
                          <mat-icon>close</mat-icon>
                        </button>
                      </div>
                    </mat-option>

                    <!-- Option for current department if not in standard list -->
                    <mat-option *ngIf="formData.newDepartment && !departments.includes(formData.newDepartment)" [value]="formData.newDepartment">
                      <div class="dept-opt-item">
                        <mat-icon class="dept-icon">apartment</mat-icon>
                        <strong>{{ formData.newDepartment }}</strong>
                        <small style="color: #64748b; margin-left: 6px;">(Current)</small>
                      </div>
                    </mat-option>

                    <!-- Dynamic API Departments -->
                    <mat-option *ngFor="let d of filteredDepartments" [value]="d">
                      <div class="dept-opt-item">
                        <mat-icon class="dept-icon">apartment</mat-icon>
                        <span>{{ d }}</span>
                      </div>
                    </mat-option>

                    <mat-option disabled *ngIf="filteredDepartments.length === 0" class="no-results-option">
                      <div class="no-results-wrap">
                        <mat-icon>search_off</mat-icon>
                        <span>No department found matching "{{ departmentSearchQuery }}"</span>
                      </div>
                    </mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
              <div class="quick-roles-row">
                <span class="quick-lbl">Suggestions:</span>
                <span class="quick-role-chip" *ngFor="let r of roleSuggestions" (click)="formData.newDesignation = r">{{ r }}</span>
              </div>
            </div>

            <!-- 4. Salary Increment Section (If Mode involves Increment) -->
            <div class="section-box" *ngIf="formData.type === 'Increment' || formData.type === 'PromotionAndIncrement'">
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
                <div class="comp-delta" *ngIf="currentNewGross > currentOldGross">
                  <span class="delta-amt">+₹{{ (currentNewGross - currentOldGross) | number:'1.0-0' }} / mo</span>
                  <span class="delta-pct">(+{{ computedHikePct }}% Hike)</span>
                </div>
              </div>
            </div>

            <!-- 5. Effective Date & Reason -->
            <div class="form-row">
              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>Effective Date (लागू होने की तिथि)</mat-label>
                <input matInput type="date" [(ngModel)]="effectiveDateStr" />
                <mat-hint>Date from which new designation and salary takes effect</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>Appraisal Cycle / Reason</mat-label>
                <mat-select [(ngModel)]="formData.reason">
                  <mat-option value="Annual Appraisal Cycle (वार्षिक वेतन वृद्धि)">Annual Appraisal Cycle</mat-option>
                  <mat-option value="Outstanding Performance (उत्कृष्ट प्रदर्शन)">Outstanding Performance</mat-option>
                  <mat-option value="Cadre Promotion (पदोनति)">Cadre Promotion</mat-option>
                  <mat-option value="Probation Confirmation (पुष्टिकरण)">Probation Confirmation</mat-option>
                  <mat-option value="Special Retention Revision">Special Retention Revision</mat-option>
                </mat-select>
              </mat-form-field>
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

      <!-- Bulk Annual Increment Modal -->
      <div class="modal-overlay" *ngIf="showBulkModal" (click)="closeBulkModal()">
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

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Appraisal Cycle Description</mat-label>
              <input matInput [(ngModel)]="bulkData.reason" placeholder="e.g. Annual Appraisal Cycle 2026-27" />
            </mat-form-field>
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

      <!-- Appraisal Letter Preview & Print Modal -->
      <div class="modal-overlay" *ngIf="showLetterModal" (click)="showLetterModal = false">
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

          <div class="letter-print-body" *ngIf="selectedRecordForLetter" id="printable-appraisal-letter">
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
                <tr *ngIf="selectedRecordForLetter.newGrossSalary > 0">
                  <td><strong>Basic Salary</strong></td>
                  <td>₹{{ selectedRecordForLetter.oldBasicSalary | number:'1.2-2' }}</td>
                  <td><strong>₹{{ selectedRecordForLetter.newBasicSalary | number:'1.2-2' }}</strong></td>
                </tr>
                <tr *ngIf="selectedRecordForLetter.newGrossSalary > 0">
                  <td><strong>House Rent Allowance (HRA)</strong></td>
                  <td>₹{{ selectedRecordForLetter.oldHRA | number:'1.2-2' }}</td>
                  <td><strong>₹{{ selectedRecordForLetter.newHRA | number:'1.2-2' }}</strong></td>
                </tr>
                <tr *ngIf="selectedRecordForLetter.newGrossSalary > 0">
                  <td><strong>Special / Other Allowances</strong></td>
                  <td>₹{{ selectedRecordForLetter.oldOtherAllowances | number:'1.2-2' }}</td>
                  <td><strong>₹{{ selectedRecordForLetter.newOtherAllowances | number:'1.2-2' }}</strong></td>
                </tr>
                <tr class="gross-row" *ngIf="selectedRecordForLetter.newGrossSalary > 0">
                  <td><strong>TOTAL GROSS CTC (Monthly)</strong></td>
                  <td>₹{{ selectedRecordForLetter.oldGrossSalary | number:'1.2-2' }}</td>
                  <td><strong class="text-success">₹{{ selectedRecordForLetter.newGrossSalary | number:'1.2-2' }}</strong></td>
                </tr>
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

          <div class="modal-footer">
            <button mat-button class="btn-cancel" (click)="showLetterModal = false">Close</button>
            <button mat-flat-button color="primary" class="btn-save" (click)="printLetter()">
              <mat-icon>print</mat-icon>
              <span>Print Official Letter</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
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

    /* KPI Summary Cards - Consistent Center Aligned Layout */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 16px;
    }

    .stat-card {
      background: #ffffff !important;
      border-radius: 14px !important;
      padding: 16px 14px !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      gap: 8px !important;
      min-height: 125px !important;
      border: 1px solid #e2e8f0 !important;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02) !important;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;

      &:hover {
        transform: translateY(-3px);
        box-shadow: 0 10px 20px -5px rgba(15, 23, 42, 0.08) !important;
        border-color: #cbd5e1 !important;
      }

      .stat-icon {
        width: 44px !important;
        height: 44px !important;
        border-radius: 12px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex-shrink: 0 !important;
        margin: 0 auto !important;

        mat-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
          color: #ffffff;
        }
      }

      .stat-info {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
        width: 100% !important;

        .stat-val {
          display: block !important;
          font-size: 1.75rem !important;
          font-weight: 800 !important;
          color: #0f172a !important;
          line-height: 1.15 !important;
          letter-spacing: -0.02em;
          text-align: center !important;
          width: 100% !important;
          margin: 0 auto !important;
        }

        .stat-lbl {
          font-size: 0.76rem !important;
          font-weight: 600 !important;
          color: #64748b !important;
          margin-top: 3px !important;
          display: block !important;
          text-align: center !important;
          width: 100% !important;
          line-height: 1.25 !important;
        }
      }

      &.total .stat-icon { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25); }
      &.promo .stat-icon { background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); box-shadow: 0 4px 10px rgba(139, 92, 246, 0.25); }
      &.inc .stat-icon { background: linear-gradient(135deg, #10b981 0%, #047857 100%); box-shadow: 0 4px 10px rgba(16, 185, 129, 0.25); }
      &.budget .stat-icon { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow: 0 4px 10px rgba(245, 158, 11, 0.25); }
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
        display: flex;
        align-items: center;
        gap: 8px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 7px 12px;

        mat-icon {
          color: #2563eb;
          font-size: 20px;
          width: 20px;
          height: 20px;
        }

        input {
          flex: 1;
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
          margin-bottom: -1.25em;
        }
      }
    }

    /* Table Styles */
    .table-responsive {
      background: #ffffff;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      overflow-x: auto;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
    }

    .erp-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.86rem;

      thead tr {
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }

      th {
        padding: 12px 16px;
        font-weight: 600;
        color: #475569;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        white-space: nowrap;
      }

      td {
        padding: 14px 16px;
        border-bottom: 1px solid #f1f5f9;
        color: #1e293b;
        vertical-align: middle;
      }

      tbody tr:hover {
        background: #fafcff;
      }
    }

    .staff-id-cell {
      display: flex;
      align-items: center;
      gap: 10px;

      .staff-avatar {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: #eff6ff;
        color: #2563eb;
        display: flex;
        align-items: center;
        justify-content: center;
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
      strong { color: #0f172a; display: block; }
      small { color: #94a3b8; font-size: 0.72rem; }
    }

    .reason-pill {
      display: inline-block;
      max-width: 160px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.76rem;
      color: #334155;
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

    /* Mobile Only Cards */
    .desktop-only { display: block; }
    .mobile-only { display: none; }

    @media (max-width: 768px) {
      .desktop-only { display: none; }
      .mobile-only { display: block; }

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

    .cards-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .mobile-record-card {
      padding: 14px !important;
      border-radius: 12px !important;
      border: 1px solid #e2e8f0 !important;
      background: #ffffff !important;
      display: flex;
      flex-direction: column;
      gap: 10px;

      .m-card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
      }

      .m-staff-info {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        strong { font-size: 0.95rem; color: #0f172a; }
        .m-code { color: #64748b; font-size: 0.78rem; }
      }

      .m-data-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.82rem;
        .m-lbl { color: #64748b; }
      }

      .hike-badge-m {
        background: #ecfdf5;
        color: #047857;
        padding: 1px 6px;
        border-radius: 6px;
        font-weight: 700;
        font-size: 0.72rem;
        margin-left: 6px;
      }

      .m-card-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #f1f5f9;
        padding-top: 8px;

        .m-footer-left {
          display: flex;
          flex-direction: column;
          gap: 2px;
          .m-date { font-size: 0.75rem; color: #64748b; font-weight: 500; }
          .reason-pill-m { font-size: 0.72rem; color: #1e40af; }
        }

        .m-action-btn {
          height: 32px !important;
          font-size: 0.78rem !important;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
        }
      }
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
        &:hover { background: #eff6ff; border-color: #93c5fd; color: #1d4ed8; }
      }
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
  filteredRecords: StaffPromotionIncrementDto[] = [];
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
    reason: 'Annual Appraisal Cycle (वार्षिक वेतन वृद्धि)',
    remarks: ''
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
    reason: 'Annual Appraisal Cycle 2026-27'
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
    this.loadData();
    this.loadTeachers();
  }

  loadData() {
    this.loading = true;
    this.http.get<{ summary: StaffPromotionSummaryDto, records: StaffPromotionIncrementDto[] }>(`${this.api}/staff-promotions`).subscribe({
      next: (res) => {
        this.loading = false;
        this.records = res?.records || [];
        this.summary = res?.summary || {
          totalRecords: 0, totalPromotions: 0, totalIncrements: 0, totalMonthlyGrossHike: 0, averageHikePercentage: 0
        };
        this.applyFilters();
      },
      error: () => {
        this.loading = false;
        this.records = [];
        this.applyFilters();
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
    const q = (this.searchQuery || '').trim().toLowerCase();
    this.filteredRecords = this.records.filter(r => {
      const matchSearch = !q ||
        r.teacherName.toLowerCase().includes(q) ||
        r.employeeCode.toLowerCase().includes(q) ||
        r.newDesignation.toLowerCase().includes(q) ||
        (r.reason && r.reason.toLowerCase().includes(q));

      const matchStaffType = this.selectedStaffType === 'All' ||
        (r.staffType && r.staffType.toLowerCase() === this.selectedStaffType.toLowerCase());

      const matchType = !this.selectedType || r.type === this.selectedType;

      return matchSearch && matchStaffType && matchType;
    });
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
      reason: 'Annual Appraisal Cycle (वार्षिक वेतन वृद्धि)',
      remarks: ''
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
      return;
    }

    this.selectedTeacher = this.teachers.find(t => t.id === this.formData.teacherId) || null;
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
        this.loadData();
        this.loadTeachers();
      },
      error: (err) => {
        this.submitting = false;
        alert(err?.error?.message || 'Failed to record staff promotion.');
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
      reason: 'Annual Appraisal Cycle 2026-27'
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
        alert(res?.message || 'Bulk increment applied successfully.');
        this.loadData();
      },
      error: (err) => {
        this.submitting = false;
        alert(err?.error?.message || 'Failed to apply bulk increment.');
      }
    });
  }

  // Delete Action
  deleteRecord(r: StaffPromotionIncrementDto) {
    if (!confirm(`Are you sure you want to delete this promotion/appraisal audit record for ${r.teacherName}?`)) return;

    this.http.delete(`${this.api}/staff-promotions/${r.id}`).subscribe({
      next: () => this.loadData(),
      error: (err) => alert(err?.error?.message || 'Failed to delete record.')
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
}
