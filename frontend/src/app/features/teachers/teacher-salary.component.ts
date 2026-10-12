import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TeacherSelectorComponent } from './teacher-selector.component';
import { API_BASE, TeacherDto, SalaryDto, StaffSalaryOverviewItem, StaffSalaryDirectoryResponse, StaffSalaryDirectoryKpis } from './teacher.models';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

interface ExperienceSlabRecommendation {
  slabName: string;
  expRange: string;
  grossSalary: number;
  basicSalary: number;
  hra: number;
  otherAllowances: number;
  pfDeduction: number;
  description: string;
}

@Component({
  selector: 'app-teacher-salary',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterModule,
    MatCardModule, MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatSelectModule, MatProgressBarModule, MatProgressSpinnerModule,
    MatDividerModule, MatCheckboxModule, MatTooltipModule, MatPaginatorModule,
    TeacherSelectorComponent
  ],
  template: `
<div class="page-container">
  <!-- Modern Responsive Page Header -->
  <div class="page-header">
    <div class="header-left">
      <div class="header-icon-box">
        <mat-icon>account_balance_wallet</mat-icon>
      </div>
      <div>
        <h1 class="page-title">Staff Salary Structure Management</h1>
        <p class="page-subtitle">Configure compensation plans, experience-based pay scales, earnings, and statutory deductions.</p>
      </div>
    </div>

    <!-- Mode Selector Pills -->
    <div class="mode-pills">
      <button
        type="button"
        class="mode-pill"
        [class.active]="viewMode === 'single'"
        (click)="switchViewMode('single')"
      >
        <mat-icon>person</mat-icon>
        <span>Individual Staff View</span>
      </button>
      <button
        type="button"
        class="mode-pill"
        [class.active]="viewMode === 'batch'"
        (click)="switchViewMode('batch')"
      >
        <mat-icon>groups</mat-icon>
        <span>Batch / Multiple Staff Setup</span>
        <span class="badge-pill" *ngIf="unconfiguredCount > 0">{{ unconfiguredCount }} Missing</span>
      </button>
    </div>
  </div>

  <!-- KPI Overview Stats Grid -->
  <div class="stats-grid">
    <div class="stat-card total">
      <div class="stat-icon-wrap"><mat-icon>badge</mat-icon></div>
      <div class="stat-data">
        <span class="stat-val">{{ totalActiveStaffCount }}</span>
        <span class="stat-lbl">Total Active Staff</span>
      </div>
    </div>
    <div class="stat-card configured">
      <div class="stat-icon-wrap"><mat-icon>check_circle</mat-icon></div>
      <div class="stat-data">
        <span class="stat-val">{{ configuredCount }}</span>
        <span class="stat-lbl">Salary Configured</span>
      </div>
    </div>
    <div class="stat-card missing">
      <div class="stat-icon-wrap"><mat-icon>warning_amber</mat-icon></div>
      <div class="stat-data">
        <span class="stat-val">{{ unconfiguredCount }}</span>
        <span class="stat-lbl">Missing Salary Structure</span>
      </div>
    </div>
    <div class="stat-card average">
      <div class="stat-icon-wrap"><mat-icon>payments</mat-icon></div>
      <div class="stat-data">
        <span class="stat-val">₹{{ averageGross | number:'1.0-0' }}</span>
        <span class="stat-lbl">Average Monthly Gross</span>
      </div>
    </div>
  </div>

  <mat-progress-bar mode="indeterminate" *ngIf="loading || batchProcessing"></mat-progress-bar>

  <!-- ========================================================================= -->
  <!-- 1. INDIVIDUAL STAFF VIEW MODE -->
  <!-- ========================================================================= -->
  <div *ngIf="viewMode === 'single'" class="single-view-section">
    <!-- Clean Searchable Staff Selector -->
    <app-teacher-selector
      [preSelectId]="preSelectId"
      (teacherSelected)="onTeacherSelected($event)"
    ></app-teacher-selector>

    <div *ngIf="!selectedTeacher" class="no-selection-card mat-elevation-z1">
      <div class="empty-icon-wrap">
        <mat-icon>person_search</mat-icon>
      </div>
      <h3>Select a Faculty or Staff Member</h3>
      <p>Choose an employee from the dropdown above to view, configure, or auto-calculate their salary structure based on experience.</p>
    </div>

    <div *ngIf="selectedTeacher" class="staff-workspace">
      <!-- Staff Profile Summary Banner -->
      <div class="staff-banner-card mat-elevation-z1">
        <div class="staff-avatar-box">
          <mat-icon>{{ selectedTeacher.staffType === 'Teaching' ? 'school' : 'badge' }}</mat-icon>
        </div>
        <div class="staff-banner-info">
          <div class="banner-title-row">
            <h2 class="staff-name">{{ selectedTeacher.fullName }}</h2>
            <span class="code-pill">[{{ selectedTeacher.employeeCode }}]</span>
            <span class="type-pill" [class.teaching]="selectedTeacher.staffType === 'Teaching'">
              {{ selectedTeacher.staffType || 'Teaching' }}
            </span>
            <span class="status-badge" [class.success]="salaryStructure" [class.warn]="!salaryStructure">
              <mat-icon>{{ salaryStructure ? 'verified' : 'error_outline' }}</mat-icon>
              {{ salaryStructure ? 'Structure Configured' : 'No Structure Configured (संरचना नहीं बनी)' }}
            </span>
          </div>
          <div class="banner-meta-row">
            <span>Designation: <strong>{{ selectedTeacher.designation || 'Faculty' }}</strong></span>
            <span *ngIf="selectedTeacher.department">&bull; Dept: <strong>{{ selectedTeacher.department }}</strong></span>
            <span>&bull; Experience: <strong class="exp-highlight">{{ selectedTeacher.experienceYears || 0 }} Yrs Exp</strong></span>
          </div>
        </div>

        <div class="banner-actions">
          <button mat-stroked-button color="primary" class="action-btn" (click)="toggleForm()">
            <mat-icon>{{ showForm ? 'close' : (salaryStructure ? 'edit' : 'add_circle') }}</mat-icon>
            <span>{{ showForm ? 'Cancel' : (salaryStructure ? 'Modify Structure' : 'Set Salary Structure') }}</span>
          </button>
        </div>
      </div>

      <!-- Experience-Based Pay Matrix Smart Recommendation Card -->
      <div class="smart-exp-card" *ngIf="showForm">
        <div class="exp-card-header">
          <div class="exp-header-left">
            <mat-icon class="ai-spark-icon">auto_awesome</mat-icon>
            <div>
              <h4 class="exp-title">Experience-Based Pay Scale Recommendation (अनुभव अनुसार वेतनमान)</h4>
              <p class="exp-desc">
                {{ selectedTeacher.fullName }} has <strong>{{ selectedTeacher.experienceYears || 0 }} Years</strong> experience as 
                <strong>{{ selectedTeacher.designation || 'Faculty' }}</strong>. Recommended Pay Band: 
                <span class="band-tag">{{ getExpBandName(selectedTeacher.experienceYears || 0) }}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            class="auto-fill-btn"
            (click)="applyExperienceRecommendation(selectedTeacher)"
            matTooltip="Instantly fill Basic, HRA, Allowances, and PF according to experience slab"
          >
            <mat-icon>bolt</mat-icon>
            <span>Auto-Calculate by Exp ({{ selectedTeacher.experienceYears || 0 }}y)</span>
          </button>
        </div>

        <!-- Quick Standard Slab Chips -->
        <div class="slab-chips-row">
          <span class="slab-chips-lbl">Quick Pay Slabs:</span>
          <button
            type="button"
            class="slab-chip"
            *ngFor="let slab of getStandardSlabs(selectedTeacher.designation || '')"
            (click)="applySlab(slab)"
          >
            <span class="slab-chip-name">{{ slab.slabName }} ({{ slab.expRange }})</span>
            <span class="slab-chip-val">₹{{ slab.grossSalary | number:'1.0-0' }}</span>
          </button>
        </div>
      </div>

      <!-- Salary Form -->
      <mat-card class="form-card mat-elevation-z1" *ngIf="showForm">
        <form [formGroup]="salaryForm" (ngSubmit)="saveSalary()">
          <div class="form-grid">
            <!-- Earnings -->
            <div class="form-column earnings-col">
              <div class="column-title earnings-title">
                <mat-icon>payments</mat-icon>
                <span>Earnings (मासिक आय)</span>
              </div>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Basic Salary (मूल वेतन) ₹ *</mat-label>
                <input matInput type="number" formControlName="basicSalary" (input)="recalcLiveSalary()" min="1" placeholder="e.g. 25000">
                <mat-hint>Standard: ~50-60% of total Gross</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>HRA (मकान किराया भत्ता) ₹</mat-label>
                <input matInput type="number" formControlName="hra" (input)="recalcLiveSalary()" min="0" placeholder="e.g. 5000">
                <mat-hint>Standard: ~20-25% of Gross</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Other Allowances (विशेष/अन्य भत्ते) ₹</mat-label>
                <input matInput type="number" formControlName="otherAllowances" (input)="recalcLiveSalary()" min="0" placeholder="e.g. 3000">
                <mat-hint>DA / Conveyance / Academic Allowances</mat-hint>
              </mat-form-field>
            </div>

            <!-- Deductions -->
            <div class="form-column deductions-col">
              <div class="column-title deductions-title">
                <mat-icon>remove_circle_outline</mat-icon>
                <span>Statutory Deductions (कटौती)</span>
              </div>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>PF Deduction (भविष्य निधि) ₹</mat-label>
                <input matInput type="number" formControlName="pfDeduction" (input)="recalcLiveSalary()" min="0" placeholder="0">
                <mat-hint>12% of Basic Salary (if opted)</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>TDS Deduction (आयकर) ₹</mat-label>
                <input matInput type="number" formControlName="tdsDeduction" (input)="recalcLiveSalary()" min="0" placeholder="0">
                <mat-hint>Income Tax deduction</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Other Deductions (अन्य कटौती) ₹</mat-label>
                <input matInput type="number" formControlName="otherDeductions" (input)="recalcLiveSalary()" min="0" placeholder="0">
                <mat-hint>Society / Insurance / Welfare fund</mat-hint>
              </mat-form-field>
            </div>

            <!-- Effective Date & Summary Preview -->
            <div class="form-column summary-col">
              <div class="column-title summary-title">
                <mat-icon>calculate</mat-icon>
                <span>Live Breakdown &amp; Effective Date</span>
              </div>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Effective From (लागू होने की तिथि) *</mat-label>
                <input matInput type="date" formControlName="effectiveFrom">
              </mat-form-field>

              <!-- Live Calculated CTC Card -->
              <div class="live-calc-box">
                <div class="live-row">
                  <span>Gross Salary (CTC):</span>
                  <strong class="val-gross">₹{{ liveGrossSalary | number:'1.0-0' }}</strong>
                </div>
                <div class="live-row deduction">
                  <span>Total Deductions:</span>
                  <strong class="val-deduct">-₹{{ liveTotalDeductions | number:'1.0-0' }}</strong>
                </div>
                <div class="live-divider"></div>
                <div class="live-row net">
                  <span>Net Take-Home Pay:</span>
                  <strong class="val-net">₹{{ liveNetSalary | number:'1.0-0' }}</strong>
                </div>
              </div>
            </div>
          </div>

          <div class="form-actions">
            <button mat-button type="button" (click)="showForm = false" [disabled]="submitting">Cancel</button>
            <button mat-flat-button color="primary" type="submit" [disabled]="salaryForm.invalid || submitting" class="btn-save">
              <mat-icon>{{ submitting ? 'hourglass_empty' : 'save' }}</mat-icon>
              <span>{{ submitting ? 'Saving...' : 'Save Salary Structure' }}</span>
            </button>
          </div>
        </form>
      </mat-card>

      <!-- Salary Structure Visual Display (When not editing) -->
      <div class="salary-display-container" *ngIf="salaryStructure && !showForm">
        <mat-card class="salary-card mat-elevation-z2">
          <div class="card-top-header">
            <div>
              <span class="card-eyebrow">ACTIVE COMPENSATION STRUCTURE</span>
              <h3 class="card-main-title">{{ selectedTeacher.fullName }}</h3>
            </div>
            <div class="net-badge-large">
              <span class="badge-sub">MONTHLY TAKE-HOME</span>
              <strong class="badge-amt">₹{{ salaryStructure.netSalary | number:'1.0-0' }}</strong>
            </div>
          </div>

          <div class="breakdown-grid">
            <!-- Earnings Block -->
            <div class="breakdown-col">
              <h4 class="col-head earnings"><mat-icon>payments</mat-icon> Earnings Breakup</h4>
              <div class="sal-item">
                <span>Basic Salary (मूल वेतन):</span>
                <strong>₹{{ salaryStructure.basicSalary | number:'1.0-0' }}</strong>
              </div>
              <div class="sal-item">
                <span>House Rent Allowance (HRA):</span>
                <strong>₹{{ salaryStructure.hra | number:'1.0-0' }}</strong>
              </div>
              <div class="sal-item">
                <span>Other / Special Allowances:</span>
                <strong>₹{{ salaryStructure.otherAllowances | number:'1.0-0' }}</strong>
              </div>
              <div class="sal-item total-row gross-row">
                <span>Gross Monthly Salary:</span>
                <strong>₹{{ salaryStructure.grossSalary | number:'1.0-0' }}</strong>
              </div>
            </div>

            <!-- Deductions Block -->
            <div class="breakdown-col">
              <h4 class="col-head deductions"><mat-icon>remove_circle_outline</mat-icon> Deductions Breakup</h4>
              <div class="sal-item">
                <span>Provident Fund (PF):</span>
                <span class="ded-val">-₹{{ salaryStructure.pfDeduction | number:'1.0-0' }}</span>
              </div>
              <div class="sal-item">
                <span>Income Tax (TDS):</span>
                <span class="ded-val">-₹{{ salaryStructure.tdsDeduction | number:'1.0-0' }}</span>
              </div>
              <div class="sal-item">
                <span>Other Deductions:</span>
                <span class="ded-val">-₹{{ salaryStructure.otherDeductions | number:'1.0-0' }}</span>
              </div>
              <div class="sal-item total-row ded-row">
                <span>Total Monthly Deductions:</span>
                <strong>-₹{{ (salaryStructure.pfDeduction + salaryStructure.tdsDeduction + salaryStructure.otherDeductions) | number:'1.0-0' }}</strong>
              </div>
            </div>
          </div>

          <!-- Visual Distribution Bar -->
          <div class="distribution-bar-wrap">
            <div class="dist-meta">
              <span>Salary Composition: Basic {{ getBasicPercent() }}% &bull; HRA {{ getHraPercent() }}% &bull; Allowances {{ getAllowancesPercent() }}%</span>
              <span>Effective Since: {{ salaryStructure.effectiveFrom | date:'dd MMM yyyy' }}</span>
            </div>
            <div class="dist-bar">
              <div class="segment basic" [style.width.%]="getBasicPercent()" matTooltip="Basic Salary"></div>
              <div class="segment hra" [style.width.%]="getHraPercent()" matTooltip="HRA"></div>
              <div class="segment allowances" [style.width.%]="getAllowancesPercent()" matTooltip="Allowances"></div>
            </div>
          </div>
        </mat-card>
      </div>

      <!-- Empty State if selected teacher has no structure -->
      <div class="missing-structure-box" *ngIf="!salaryStructure && !loading && !showForm">
        <div class="missing-icon-wrap">
          <mat-icon>warning_amber</mat-icon>
        </div>
        <h3>No Salary Structure Configured Yet</h3>
        <p>This faculty member does not have an active compensation package defined. Their appraisal records and payroll require a configured structure.</p>
        <button mat-flat-button color="primary" class="primary-btn" (click)="toggleForm()">
          <mat-icon>add_circle</mat-icon>
          <span>Define Salary Structure Now</span>
        </button>
      </div>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- 2. BATCH / MULTIPLE STAFF DYNAMIC SETUP VIEW MODE -->
  <!-- ========================================================================= -->
  <div *ngIf="viewMode === 'batch'" class="batch-view-section">
    <!-- Filter & Multi-Select Action Toolbar -->
    <mat-card class="batch-toolbar-card mat-elevation-z1">
      <div class="batch-toolbar">
        <div class="search-box">
          <mat-icon>search</mat-icon>
          <input
            type="text"
            placeholder="Search staff by name, code, designation, department..."
            [(ngModel)]="batchSearchQuery"
            (ngModelChange)="onSearchChange($event)"
          />
          <button type="button" class="clear-btn" *ngIf="batchSearchQuery" (click)="clearSearch()">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="filter-dropdowns">
          <mat-form-field appearance="outline" class="mini-filter">
            <mat-label>Status Filter</mat-label>
            <mat-select [(ngModel)]="batchStatusFilter" (selectionChange)="onFilterChange()">
              <mat-option value="all">All Staff ({{ totalActiveStaffCount }})</mat-option>
              <mat-option value="missing">⚠️ Missing Structure ({{ unconfiguredCount }})</mat-option>
              <mat-option value="configured">Configured ({{ configuredCount }})</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="mini-filter">
            <mat-label>Department</mat-label>
            <mat-select [(ngModel)]="batchDeptFilter" (selectionChange)="onFilterChange()">
              <mat-option value="all">All Departments</mat-option>
              <mat-option *ngFor="let d of departments" [value]="d">{{ d }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </div>

      <!-- Multi-Select Action Strip -->
      <div class="selection-action-strip">
        <div class="selection-meta">
          <mat-checkbox
            [checked]="isAllSelected()"
            [indeterminate]="isIndeterminate()"
            (change)="toggleSelectAll($event.checked)"
          >
            <strong>{{ selectedStaffCount }}</strong> Staff Selected
          </mat-checkbox>
          <button type="button" class="quick-link-btn" (click)="selectAllMissing()">
            Filter Missing Structure ({{ unconfiguredCount }})
          </button>
        </div>

        <div class="strip-right-actions">
          <button
            mat-flat-button
            color="primary"
            class="batch-create-btn"
            [disabled]="selectedStaffCount === 0"
            (click)="openBulkModal()"
          >
            <mat-icon>auto_awesome</mat-icon>
            <span>Setup Salary for {{ selectedStaffCount }} Selected Staff</span>
          </button>
        </div>
      </div>
    </mat-card>

    <!-- Staff Overview Table (Desktop & Tablet) -->
    <div class="desktop-tablet-view table-responsive mat-elevation-z1">
      <table class="erp-table">
        <thead>
          <tr>
            <th style="width: 44px;">
              <mat-checkbox
                [checked]="isAllSelected()"
                [indeterminate]="isIndeterminate()"
                (change)="toggleSelectAll($event.checked)"
              ></mat-checkbox>
            </th>
            <th class="sortable-th" (click)="onSort('name')" matTooltip="Click to sort by Staff Name">
              <div class="th-content">
                <span>Staff Member</span>
                <mat-icon class="sort-icon" [class.active]="sortBy === 'name'">{{ getSortIcon('name') }}</mat-icon>
              </div>
            </th>
            <th class="sortable-th" (click)="onSort('designation')" matTooltip="Click to sort by Role & Department">
              <div class="th-content">
                <span>Role &amp; Department</span>
                <mat-icon class="sort-icon" [class.active]="sortBy === 'designation'">{{ getSortIcon('designation') }}</mat-icon>
              </div>
            </th>
            <th class="sortable-th" (click)="onSort('experience')" matTooltip="Click to sort by Experience">
              <div class="th-content">
                <span>Experience (अनुभव)</span>
                <mat-icon class="sort-icon" [class.active]="sortBy === 'experience'">{{ getSortIcon('experience') }}</mat-icon>
              </div>
            </th>
            <th class="sortable-th" (click)="onSort('band')" matTooltip="Click to sort by Pay Band">
              <div class="th-content">
                <span>Recommended Pay Band</span>
                <mat-icon class="sort-icon" [class.active]="sortBy === 'band'">{{ getSortIcon('band') }}</mat-icon>
              </div>
            </th>
            <th class="sortable-th" (click)="onSort('grosssalary')" matTooltip="Click to sort by Salary Amount">
              <div class="th-content">
                <span>Current Status</span>
                <mat-icon class="sort-icon" [class.active]="sortBy === 'grosssalary'">{{ getSortIcon('grosssalary') }}</mat-icon>
              </div>
            </th>
            <th class="text-right">Quick Action</th>
          </tr>
        </thead>
        <tbody>
          <!-- Loading state when filteredBatchList is empty -->
          <tr *ngIf="loading && filteredBatchList.length === 0">
            <td colspan="7" class="text-center empty-td">
              <div class="table-loader-wrap">
                <mat-spinner diameter="32"></mat-spinner>
                <span>Loading staff salary structures...</span>
              </div>
            </td>
          </tr>

          <!-- Data Rows -->
          <tr *ngFor="let item of filteredBatchList" [class.selected-row]="item.selected">
            <td>
              <mat-checkbox [(ngModel)]="item.selected" (change)="onRowSelectChange()"></mat-checkbox>
            </td>
            <td>
              <div class="staff-row-cell">
                <div class="cell-avatar">
                  <mat-icon>{{ item.teacher.staffType === 'Teaching' ? 'school' : 'badge' }}</mat-icon>
                </div>
                <div>
                  <strong class="cell-name">{{ item.teacher.fullName }}</strong>
                  <div class="cell-sub">
                    <span>{{ item.teacher.employeeCode }}</span>
                    <span class="type-badge" [class.teaching]="item.teacher.staffType === 'Teaching'">
                      {{ item.teacher.staffType || 'Staff' }}
                    </span>
                  </div>
                </div>
              </div>
            </td>
            <td>
              <div class="cell-role-wrap">
                <strong>{{ item.teacher.designation || 'Faculty' }}</strong>
                <small *ngIf="item.teacher.department">{{ item.teacher.department }}</small>
              </div>
            </td>
            <td>
              <div class="exp-pill-cell">
                <span class="exp-val">{{ item.teacher.experienceYears || 0 }} Yrs</span>
              </div>
            </td>
            <td>
              <span class="band-chip">{{ getExpBandName(item.teacher.experienceYears || 0) }}</span>
            </td>
            <td>
              <span class="status-pill configured" *ngIf="item.salary">
                <mat-icon>check_circle</mat-icon>
                <span>₹{{ item.salary.grossSalary | number:'1.0-0' }} / mo</span>
              </span>
              <span class="status-pill missing" *ngIf="!item.salary">
                <mat-icon>warning_amber</mat-icon>
                <span>Not Configured</span>
              </span>
            </td>
            <td class="text-right">
              <button mat-stroked-button class="mini-btn" (click)="configureSingleFromBatch(item.teacher)">
                <mat-icon>{{ item.salary ? 'edit' : 'add' }}</mat-icon>
                <span>{{ item.salary ? 'Edit' : 'Configure' }}</span>
              </button>
            </td>
          </tr>

          <!-- Empty State -->
          <tr *ngIf="!loading && filteredBatchList.length === 0">
            <td colspan="7" class="text-center empty-td">
              <div class="no-records-wrap">
                <mat-icon>search_off</mat-icon>
                <span>No staff members match the selected filter criteria.</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Server-Side Paginator -->
      <mat-paginator
        [length]="totalCount"
        [pageSize]="pageSize"
        [pageIndex]="pageIndex"
        [pageSizeOptions]="pageSizeOptions"
        [showFirstLastButtons]="true"
        (page)="onPageChange($event)"
        aria-label="Select page of staff salary structures"
      ></mat-paginator>
    </div>

    <!-- Mobile Cards List (Mobile screens) -->
    <div class="mobile-only-cards">
      <div class="m-staff-card mat-elevation-z1" *ngFor="let item of filteredBatchList">
        <div class="m-card-top">
          <mat-checkbox [(ngModel)]="item.selected" (change)="onRowSelectChange()"></mat-checkbox>
          <div class="m-staff-text">
            <strong>{{ item.teacher.fullName }}</strong>
            <small>({{ item.teacher.employeeCode }}) &bull; {{ item.teacher.designation || 'Staff' }}</small>
          </div>
          <span class="status-pill configured" *ngIf="item.salary">
            <span>₹{{ item.salary.grossSalary | number:'1.0-0' }}</span>
          </span>
          <span class="status-pill missing" *ngIf="!item.salary">
            <span>Not Set</span>
          </span>
        </div>
        <div class="m-card-meta">
          <span>Dept: <strong>{{ item.teacher.department || 'General' }}</strong></span>
          <span>Exp: <strong>{{ item.teacher.experienceYears || 0 }} Yrs</strong> ({{ getExpBandName(item.teacher.experienceYears || 0) }})</span>
        </div>
        <div class="m-card-bottom">
          <button mat-stroked-button class="m-config-btn" (click)="configureSingleFromBatch(item.teacher)">
            <mat-icon>{{ item.salary ? 'edit' : 'add' }}</mat-icon>
            <span>{{ item.salary ? 'Modify Structure' : 'Set Structure' }}</span>
          </button>
        </div>
      </div>

      <!-- Mobile Server-Side Paginator -->
      <mat-paginator
        *ngIf="totalCount > 0"
        [length]="totalCount"
        [pageSize]="pageSize"
        [pageIndex]="pageIndex"
        [pageSizeOptions]="pageSizeOptions"
        [showFirstLastButtons]="true"
        (page)="onPageChange($event)"
        aria-label="Select page of staff salary structures"
      ></mat-paginator>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- 3. BULK / BATCH SETUP MODAL (Strict Light Blue Header Rule) -->
  <!-- ========================================================================= -->
  <div class="modal-overlay" *ngIf="showBulkModal" (click)="closeBulkModal()">
    <div class="modal-card bulk-setup-dialog" (click)="$event.stopPropagation()">
      <!-- Strict Light Blue Header matching AGENTS.md rule -->
      <div class="modal-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>auto_awesome</mat-icon>
          </div>
          <div class="header-title-box">
            <h2 class="modal-title">Bulk Salary Structure Setup (बल्क वेतन संरचना)</h2>
            <p class="modal-subtitle">Applying compensation package for {{ selectedStaffCount }} selected staff members</p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="closeBulkModal()" matTooltip="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="modal-body">
        <!-- Choose Generation Strategy -->
        <div class="form-group">
          <label class="section-label">Select Bulk Setup Strategy (पद्धति चुनें):</label>
          <div class="bulk-strategy-chips">
            <button
              type="button"
              class="strategy-chip"
              [class.active]="bulkStrategy === 'matrix'"
              (click)="bulkStrategy = 'matrix'"
            >
              <mat-icon>auto_awesome</mat-icon>
              <div>
                <strong>Smart Experience Matrix (अनुभव अनुसार स्वतः अलग-अलग गणना)</strong>
                <small>Calculates fair salary automatically for each staff member based on their individual experience &amp; cadre</small>
              </div>
            </button>
            <button
              type="button"
              class="strategy-chip"
              [class.active]="bulkStrategy === 'uniform'"
              (click)="bulkStrategy = 'uniform'"
            >
              <mat-icon>payments</mat-icon>
              <div>
                <strong>Uniform Pay Scale (समान वेतनमान)</strong>
                <small>Applies identical Basic, HRA, and Allowance figures across all selected staff</small>
              </div>
            </button>
          </div>
        </div>

        <!-- Strategy 1: Smart Experience Matrix Preview -->
        <div class="strategy-details" *ngIf="bulkStrategy === 'matrix'">
          <div class="info-alert-box">
            <mat-icon>info</mat-icon>
            <div>
              <strong>Dynamic Experience Matrix Formula:</strong>
              <span>Suggested Gross = Cadre Base + (Exp Years &times; Step Increments). Breakdown: 55% Basic, 25% HRA, 20% Allowances, 12% PF.</span>
            </div>
          </div>

          <div class="bulk-preview-table-wrap">
            <table class="preview-mini-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Designation</th>
                  <th>Exp</th>
                  <th>Calculated Basic</th>
                  <th>HRA</th>
                  <th>Allowances</th>
                  <th>Total Gross</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let s of getSelectedStaffList()">
                  <td><strong>{{ s.fullName }}</strong></td>
                  <td>{{ s.designation || 'Faculty' }}</td>
                  <td><span class="exp-tag">{{ s.experienceYears || 0 }}y</span></td>
                  <td>₹{{ calculateExpSalary(s).basic | number:'1.0-0' }}</td>
                  <td>₹{{ calculateExpSalary(s).hra | number:'1.0-0' }}</td>
                  <td>₹{{ calculateExpSalary(s).allowances | number:'1.0-0' }}</td>
                  <td><strong class="gross-highlight">₹{{ calculateExpSalary(s).gross | number:'1.0-0' }}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Strategy 2: Uniform Pay Inputs -->
        <div class="strategy-details" *ngIf="bulkStrategy === 'uniform'">
          <div class="form-row three-cols">
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Basic Salary ₹ *</mat-label>
              <input matInput type="number" [(ngModel)]="uniformData.basicSalary" min="1" placeholder="e.g. 25000">
            </mat-form-field>
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>HRA ₹</mat-label>
              <input matInput type="number" [(ngModel)]="uniformData.hra" min="0" placeholder="e.g. 5000">
            </mat-form-field>
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Other Allowances ₹</mat-label>
              <input matInput type="number" [(ngModel)]="uniformData.otherAllowances" min="0" placeholder="e.g. 3000">
            </mat-form-field>
          </div>
          <div class="form-row three-cols">
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>PF Deduction ₹</mat-label>
              <input matInput type="number" [(ngModel)]="uniformData.pfDeduction" min="0" placeholder="0">
            </mat-form-field>
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>TDS Deduction ₹</mat-label>
              <input matInput type="number" [(ngModel)]="uniformData.tdsDeduction" min="0" placeholder="0">
            </mat-form-field>
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Other Deductions ₹</mat-label>
              <input matInput type="number" [(ngModel)]="uniformData.otherDeductions" min="0" placeholder="0">
            </mat-form-field>
          </div>
        </div>

        <mat-form-field appearance="outline" class="full-width" style="margin-top: 10px;">
          <mat-label>Effective From Date *</mat-label>
          <input matInput type="date" [(ngModel)]="bulkEffectiveDate">
        </mat-form-field>
      </div>

      <div class="modal-footer">
        <button mat-button (click)="closeBulkModal()" [disabled]="batchProcessing">Cancel</button>
        <button
          mat-flat-button
          color="primary"
          class="btn-save"
          [disabled]="batchProcessing || (bulkStrategy === 'uniform' && (!uniformData.basicSalary || uniformData.basicSalary <= 0))"
          (click)="executeBulkSalarySetup()"
        >
          <mat-icon>{{ batchProcessing ? 'hourglass_empty' : 'check_circle' }}</mat-icon>
          <span>{{ batchProcessing ? 'Applying (' + batchProgressCount + '/' + selectedStaffCount + ')...' : 'Apply & Save (' + selectedStaffCount + ' Staff)' }}</span>
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
      gap: 18px;
      padding-bottom: 30px;
    }

    /* Modern Page Header */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;

      .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
        flex: 1;

        .header-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.15);
          flex-shrink: 0;
          mat-icon { font-size: 24px; width: 24px; height: 24px; }
        }

        .page-title {
          font-size: 1.35rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          line-height: 1.25;
        }

        .page-subtitle {
          color: #64748b;
          margin: 3px 0 0;
          font-size: 0.85rem;
          line-height: 1.3;
        }
      }

      .mode-pills {
        display: flex;
        background: #f1f5f9;
        padding: 4px;
        border-radius: 12px;
        gap: 4px;

        .mode-pill {
          border: none;
          background: transparent;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 0.82rem;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;

          mat-icon { font-size: 18px; width: 18px; height: 18px; color: #64748b; }

          &:hover { color: #0f172a; }

          &.active {
            background: #ffffff;
            color: #2563eb;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
            mat-icon { color: #2563eb; }
          }

          .badge-pill {
            background: #fef2f2;
            color: #dc2626;
            font-size: 0.7rem;
            padding: 1px 6px;
            border-radius: 8px;
            font-weight: 700;
            border: 1px solid #fecaca;
          }
        }
      }
    }

    /* KPI Summary Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      width: 100%;
    }

    .stat-card {
      background: #ffffff;
      border-radius: 12px;
      padding: 12px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
      min-width: 0;

      .stat-icon-wrap {
        width: 42px;
        height: 42px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        mat-icon { font-size: 22px; width: 22px; height: 22px; color: #ffffff; }
      }

      .stat-data {
        display: flex;
        flex-direction: column;
        .stat-val { font-size: 1.45rem; font-weight: 800; color: #0f172a; line-height: 1.2; }
        .stat-lbl { font-size: 0.76rem; color: #64748b; font-weight: 600; margin-top: 2px; }
      }

      &.total .stat-icon-wrap { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); }
      &.configured .stat-icon-wrap { background: linear-gradient(135deg, #10b981 0%, #047857 100%); }
      &.missing .stat-icon-wrap { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
      &.average .stat-icon-wrap { background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); }
    }

    /* Single View Workspace Section */
    .single-view-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .staff-workspace {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Empty Selection Banner */
    .no-selection-card {
      background: #ffffff;
      border: 1px dashed #cbd5e1;
      border-radius: 14px;
      padding: 40px 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;

      .empty-icon-wrap {
        width: 56px;
        height: 56px;
        border-radius: 14px;
        background: #eff6ff;
        color: #2563eb;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;
        mat-icon { font-size: 30px; width: 30px; height: 30px; }
      }

      h3 { margin: 0 0 6px; font-size: 1.15rem; color: #0f172a; }
      p { margin: 0; color: #64748b; font-size: 0.88rem; max-width: 520px; }
    }

    /* Staff Banner Card */
    .staff-banner-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;

      .staff-avatar-box {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: #eff6ff;
        color: #2563eb;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        mat-icon { font-size: 26px; width: 26px; height: 26px; }
      }

      .staff-banner-info {
        flex: 1;
        min-width: 240px;

        .banner-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 4px;

          .staff-name { font-size: 1.15rem; font-weight: 700; color: #0f172a; margin: 0; }
          .code-pill { font-size: 0.78rem; color: #475569; font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
          .type-pill {
            font-size: 0.7rem; padding: 2px 7px; border-radius: 6px; background: #f1f5f9; color: #475569; font-weight: 600;
            &.teaching { background: #eff6ff; color: #1d4ed8; }
          }
          .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 0.74rem;
            padding: 2px 8px;
            border-radius: 10px;
            font-weight: 600;
            mat-icon { font-size: 14px; width: 14px; height: 14px; }
            &.success { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
            &.warn { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
          }
        }

        .banner-meta-row {
          color: #475569;
          font-size: 0.82rem;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          strong { color: #1e293b; }
          .exp-highlight { color: #2563eb; background: #eff6ff; padding: 1px 6px; border-radius: 4px; }
        }
      }

      .banner-actions {
        .action-btn { font-weight: 600; border-radius: 8px; }
      }
    }

    /* Experience-Based Smart Matrix Recommendation Box */
    .smart-exp-card {
      background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 14px 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;

      .exp-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;

        .exp-header-left {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          flex: 1;
          min-width: 240px;

          .ai-spark-icon { color: #2563eb; font-size: 22px; width: 22px; height: 22px; margin-top: 2px; }
          .exp-title { margin: 0; font-size: 0.95rem; font-weight: 700; color: #1e3a8a; }
          .exp-desc { margin: 3px 0 0; font-size: 0.8rem; color: #334155; }
          .band-tag { background: #2563eb; color: #ffffff; padding: 1px 6px; border-radius: 4px; font-weight: 600; font-size: 0.74rem; }
        }

        .auto-fill-btn {
          border: none;
          background: #2563eb;
          color: #ffffff;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);
          transition: background 0.15s ease;
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
          &:hover { background: #1d4ed8; }
        }
      }

      .slab-chips-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        border-top: 1px dashed #bfdbfe;
        padding-top: 10px;

        .slab-chips-lbl { font-size: 0.74rem; font-weight: 600; color: #475569; }
        .slab-chip {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 0.76rem;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s ease;
          .slab-chip-name { color: #334155; font-weight: 500; }
          .slab-chip-val { color: #15803d; font-weight: 700; }
          &:hover { background: #eff6ff; border-color: #93c5fd; }
        }
      }
    }

    /* Form Styles */
    .form-card {
      padding: 20px !important;
      border-radius: 14px !important;
      border: 1px solid #e2e8f0 !important;

      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 20px;
      }

      .form-column {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .column-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.88rem;
          font-weight: 700;
          margin-bottom: 6px;
          mat-icon { font-size: 18px; width: 18px; height: 18px; }

          &.earnings-title { color: #166534; mat-icon { color: #16a34a; } }
          &.deductions-title { color: #991b1b; mat-icon { color: #dc2626; } }
          &.summary-title { color: #1e40af; mat-icon { color: #2563eb; } }
        }
      }

      .live-calc-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;

        .live-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          color: #334155;
          .val-gross { color: #1e3a8a; font-weight: 700; }
          &.deduction .val-deduct { color: #b91c1c; font-weight: 700; }
          &.net {
            font-size: 0.95rem;
            color: #0f172a;
            .val-net { color: #15803d; font-size: 1.1rem; font-weight: 800; }
          }
        }

        .live-divider { border-top: 1px dashed #cbd5e1; margin: 4px 0; }
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 16px;
        border-top: 1px solid #f1f5f9;
        padding-top: 14px;
      }
    }

    /* Active Structure Display Card */
    .salary-card {
      border-radius: 14px !important;
      padding: 24px !important;
      border: 1px solid #e2e8f0 !important;

      .card-top-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #f1f5f9;
        padding-bottom: 16px;
        margin-bottom: 18px;
        flex-wrap: wrap;
        gap: 12px;

        .card-eyebrow { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.05em; color: #64748b; }
        .card-main-title { margin: 2px 0 0; font-size: 1.3rem; font-weight: 800; color: #0f172a; }

        .net-badge-large {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          border-radius: 10px;
          padding: 8px 16px;
          text-align: right;
          .badge-sub { font-size: 0.68rem; font-weight: 700; color: #047857; display: block; }
          .badge-amt { font-size: 1.4rem; font-weight: 800; color: #047857; line-height: 1.2; }
        }
      }

      .breakdown-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 24px;
        margin-bottom: 20px;

        .breakdown-col {
          display: flex;
          flex-direction: column;
          gap: 10px;

          .col-head {
            margin: 0;
            font-size: 0.92rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 6px;
            mat-icon { font-size: 18px; width: 18px; height: 18px; }
            &.earnings { color: #166534; mat-icon { color: #16a34a; } }
            &.deductions { color: #991b1b; mat-icon { color: #dc2626; } }
          }

          .sal-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 12px;
            background: #f8fafc;
            border-radius: 6px;
            font-size: 0.85rem;
            color: #334155;
            strong { font-weight: 700; color: #0f172a; }
            .ded-val { color: #b91c1c; font-weight: 600; }

            &.total-row {
              font-weight: 700;
              margin-top: 4px;
              &.gross-row { background: #eff6ff; color: #1e40af; strong { color: #1d4ed8; } }
              &.ded-row { background: #fef2f2; color: #991b1b; strong { color: #b91c1c; } }
            }
          }
        }
      }

      .distribution-bar-wrap {
        border-top: 1px solid #f1f5f9;
        padding-top: 14px;

        .dist-meta {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: #64748b;
          margin-bottom: 6px;
          flex-wrap: wrap;
          gap: 6px;
        }

        .dist-bar {
          height: 10px;
          border-radius: 5px;
          display: flex;
          overflow: hidden;
          background: #e2e8f0;
          .segment.basic { background: #2563eb; }
          .segment.hra { background: #38bdf8; }
          .segment.allowances { background: #a855f7; }
        }
      }
    }

    /* Missing Structure Card */
    .missing-structure-box {
      background: #ffffff;
      border: 1px dashed #f87171;
      border-radius: 14px;
      padding: 36px 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;

      .missing-icon-wrap {
        width: 52px;
        height: 52px;
        border-radius: 12px;
        background: #fef2f2;
        color: #dc2626;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;
        mat-icon { font-size: 28px; width: 28px; height: 28px; }
      }

      h3 { margin: 0 0 6px; font-size: 1.15rem; color: #991b1b; }
      p { margin: 0 0 16px; color: #64748b; font-size: 0.88rem; max-width: 480px; }
    }

    /* ========================================================================= */
    /* BATCH VIEW STYLES */
    /* ========================================================================= */
    .batch-view-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .batch-toolbar-card {
      padding: 14px 18px !important;
      border-radius: 14px !important;
      border: 1px solid #e2e8f0 !important;
      display: flex;
      flex-direction: column;
      gap: 12px;

      .batch-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
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
          padding: 6px 10px;

          mat-icon { font-size: 18px; width: 18px; height: 18px; color: #64748b; }
          input {
            border: none;
            background: transparent;
            outline: none;
            font-size: 0.88rem;
            color: #0f172a;
            width: 100%;
          }
          .clear-btn { border: none; background: transparent; cursor: pointer; color: #94a3b8; padding: 0; }
        }

        .filter-dropdowns {
          display: flex;
          gap: 10px;
          .mini-filter { width: 180px; margin-bottom: -1.25em; }
        }
      }

      .selection-action-strip {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #f1f5f9;
        padding-top: 10px;
        flex-wrap: wrap;
        gap: 10px;

        .selection-meta {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;

          .quick-link-btn {
            border: none;
            background: #eff6ff;
            color: #1d4ed8;
            font-size: 0.78rem;
            font-weight: 600;
            padding: 4px 10px;
            border-radius: 6px;
            cursor: pointer;
            &:hover { background: #dbeafe; }
          }
        }
      }
    }

    /* ERP Table Styles */
    .table-responsive {
      background: #ffffff;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      overflow-x: auto;
    }

    .erp-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.86rem;

      thead tr { background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
      th {
        padding: 12px 14px;
        font-weight: 600;
        color: #475569;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        white-space: nowrap;
      }
      th.sortable-th {
        cursor: pointer;
        user-select: none;
        transition: background 0.15s ease, color 0.15s ease;

        &:hover {
          background: #eff6ff;
          color: #1d4ed8;
          .sort-icon { color: #2563eb; }
        }

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
          vertical-align: middle;
          transition: all 0.2s ease;
          &.active {
            color: #2563eb;
            font-weight: 700;
          }
        }
      }
      td {
        padding: 12px 14px;
        border-bottom: 1px solid #f1f5f9;
        color: #1e293b;
        vertical-align: middle;
      }
      tbody tr:hover { background: #fafcff; }
      tbody tr.selected-row { background: #eff6ff !important; }
    }

    .table-loading-bar {
      width: 100%;
      height: 3px;
      overflow: hidden;
    }

    .table-loader-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 36px 20px;
      color: #64748b;
      font-size: 0.9rem;
      font-weight: 500;
    }

    .staff-row-cell {
      display: flex;
      align-items: center;
      gap: 10px;

      .cell-avatar {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        background: #eff6ff;
        color: #2563eb;
        display: flex;
        align-items: center;
        justify-content: center;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }

      .cell-name { color: #0f172a; font-weight: 600; font-size: 0.9rem; }
      .cell-sub {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.76rem;
        color: #64748b;
        font-family: monospace;
      }
    }

    .cell-role-wrap {
      display: flex;
      flex-direction: column;
      strong { color: #1e293b; font-size: 0.85rem; }
      small { color: #64748b; font-size: 0.76rem; }
    }

    .exp-pill-cell {
      .exp-val {
        background: #f1f5f9;
        color: #334155;
        padding: 2px 8px;
        border-radius: 6px;
        font-weight: 700;
        font-size: 0.78rem;
      }
    }

    .band-chip {
      background: #eff6ff;
      color: #1d4ed8;
      padding: 2px 8px;
      border-radius: 8px;
      font-size: 0.74rem;
      font-weight: 600;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &.configured { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
      &.missing { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
    }

    .mini-btn { height: 32px !important; font-size: 0.78rem !important; }

    /* Mobile Cards */
    .mobile-only-cards {
      display: none;
      flex-direction: column;
      gap: 10px;
    }

    .m-staff-card {
      background: #ffffff;
      border-radius: 12px;
      padding: 12px 14px;
      border: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .m-card-top {
        display: flex;
        align-items: center;
        gap: 8px;
        .m-staff-text {
          flex: 1;
          display: flex;
          flex-direction: column;
          strong { font-size: 0.92rem; color: #0f172a; }
          small { color: #64748b; font-size: 0.76rem; }
        }
      }

      .m-card-meta {
        font-size: 0.78rem;
        color: #475569;
        display: flex;
        justify-content: space-between;
        background: #f8fafc;
        padding: 6px 10px;
        border-radius: 6px;
      }

      .m-card-bottom {
        display: flex;
        justify-content: flex-end;
        .m-config-btn { width: 100%; justify-content: center; height: 34px; font-size: 0.8rem; }
      }
    }

    /* ========================================================================= */
    /* BULK DIALOG STYLES (Strict Light Blue Header Rule) */
    /* ========================================================================= */
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      z-index: 1050;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      overflow-y: auto;
    }

    .modal-card.bulk-setup-dialog {
      background: #ffffff;
      border-radius: 16px;
      width: 100%;
      max-width: 780px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15);
      overflow: hidden;
    }

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

        .header-title-box { min-width: 0; flex: 1; }
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

      .modal-title { margin: 0; font-size: 1.15rem; font-weight: 700; color: #1e3a8a; line-height: 1.25; word-break: break-word; }
      .modal-subtitle { margin: 2px 0 0; font-size: 0.8rem; color: #3b82f6; line-height: 1.25; word-break: break-word; }

      .close-btn {
        width: 32px !important; height: 32px !important; padding: 0 !important; min-width: 32px !important;
        color: #64748b !important; background: rgba(148, 163, 184, 0.15) !important; border-radius: 8px !important;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
        &:hover { color: #0f172a !important; }
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

    .bulk-strategy-chips {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .strategy-chip {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px 14px;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        background: #ffffff;
        text-align: left;
        cursor: pointer;
        transition: all 0.15s ease;

        mat-icon { font-size: 22px; width: 22px; height: 22px; color: #64748b; margin-top: 2px; }
        strong { font-size: 0.9rem; color: #0f172a; display: block; }
        small { color: #64748b; font-size: 0.78rem; line-height: 1.3; }

        &:hover { background: #f8fafc; border-color: #94a3b8; }
        &.active {
          background: #eff6ff;
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
          mat-icon { color: #2563eb; }
          strong { color: #1e40af; }
        }
      }
    }

    .info-alert-box {
      display: flex;
      gap: 10px;
      padding: 10px 14px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      font-size: 0.8rem;
      color: #1e40af;
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: #2563eb; flex-shrink: 0; }
      strong { display: block; margin-bottom: 2px; }
    }

    .bulk-preview-table-wrap {
      max-height: 240px;
      overflow-y: auto;
      border: 1px solid #e2e8f0;
      border-radius: 8px;

      .preview-mini-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.82rem;
        thead { background: #f8fafc; position: sticky; top: 0; th { padding: 8px 10px; font-weight: 600; color: #475569; } }
        tbody td { padding: 8px 10px; border-top: 1px solid #f1f5f9; color: #1e293b; }
        .exp-tag { background: #f1f5f9; padding: 1px 6px; border-radius: 4px; font-weight: 600; font-size: 0.74rem; }
        .gross-highlight { color: #15803d; font-weight: 700; }
      }
    }

    .form-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      width: 100%;
      &.three-cols { grid-template-columns: repeat(3, 1fr); }
      .flex-1 { width: 100%; min-width: 0; }
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
    }

    .full-width { width: 100%; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }

    /* ========================================================================= */
    /* RESPONSIVE MEDIA QUERIES */
    /* ========================================================================= */
    @media (max-width: 900px) {
      .stats-grid {
        grid-template-columns: repeat(4, 1fr) !important;
        gap: 8px;
      }
      .stat-card {
        padding: 8px 10px;
        gap: 8px;
        .stat-icon-wrap {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
        }
        .stat-data {
          .stat-val { font-size: 1.15rem; }
          .stat-lbl { font-size: 0.66rem; }
        }
      }
    }

    @media (max-width: 768px) {
      .desktop-tablet-view { display: none !important; }
      .mobile-only-cards { display: flex !important; }
      .page-header {
        flex-direction: column;
        align-items: stretch;
        .mode-pills { width: 100%; .mode-pill { flex: 1; justify-content: center; } }
      }
    }

    @media (max-width: 600px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 8px;
      }
      .stat-card {
        padding: 10px 12px;
        gap: 8px;
        .stat-icon-wrap {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
        }
        .stat-data {
          .stat-val { font-size: 1.2rem; }
          .stat-lbl { font-size: 0.7rem; }
        }
      }
      .form-row, .form-row.three-cols {
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
      }
      .modal-overlay { padding: 8px !important; align-items: flex-end !important; }
      .modal-card.bulk-setup-dialog {
        max-height: 94vh !important;
        border-radius: 18px 18px 10px 10px !important;
      }
      .modal-header {
        padding: 10px 14px !important;
        .header-icon-box { width: 36px; height: 36px; mat-icon { font-size: 20px; width: 20px; height: 20px; } }
        .modal-title { font-size: 0.98rem !important; }
      }
      .modal-body { padding: 14px 12px !important; }
      .modal-footer {
        flex-direction: column-reverse !important;
        gap: 8px !important;
        button { width: 100% !important; justify-content: center !important; }
      }
    }
  `]
})
export class TeacherSalaryComponent implements OnInit, OnDestroy {
  private api = API_BASE;
  selectedTeacher: TeacherDto | null = null;
  preSelectId: string | null = null;
  salaryStructure: SalaryDto | null = null;

  loading = false;
  submitting = false;
  showForm = false;
  viewMode: 'single' | 'batch' = 'batch';

  allTeachers: TeacherDto[] = [];
  salaryMap = new Map<string, SalaryDto | null>();
  departments: string[] = [];

  // Batch Table & Server-Side Grid State
  filteredBatchList: StaffSalaryOverviewItem[] = [];
  batchSearchQuery = '';
  batchStatusFilter = 'all';
  batchDeptFilter = 'all';
  sortBy = 'name';
  sortDescending = false;
  pageIndex = 0;
  pageSize = 10;
  totalCount = 0;
  pageSizeOptions = [10, 25, 50, 100];

  totalActiveStaffCount = 0;
  configuredCount = 0;
  unconfiguredCount = 0;
  averageGross = 0;

  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  // Bulk Modal State
  showBulkModal = false;
  bulkStrategy: 'matrix' | 'uniform' = 'matrix';
  batchProcessing = false;
  batchProgressCount = 0;
  bulkEffectiveDate = new Date().toISOString().split('T')[0];

  uniformData = {
    basicSalary: 25000,
    hra: 5000,
    otherAllowances: 2500,
    pfDeduction: 0,
    tdsDeduction: 0,
    otherDeductions: 0
  };

  // Single Form State
  salaryForm!: FormGroup;
  liveGrossSalary = 0;
  liveTotalDeductions = 0;
  liveNetSalary = 0;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(p => {
      if (p['teacherId']) {
        this.preSelectId = p['teacherId'];
        this.viewMode = 'single';
      }
    });

    const today = new Date().toISOString().split('T')[0];
    this.salaryForm = this.fb.group({
      basicSalary: [null, [Validators.required, Validators.min(1)]],
      hra: [0],
      otherAllowances: [0],
      pfDeduction: [0],
      tdsDeduction: [0],
      otherDeductions: [0],
      effectiveFrom: [today, Validators.required]
    });

    this.searchSub = this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged()
    ).subscribe(() => {
      this.pageIndex = 0;
      this.loadSalaryDirectory();
    });

    this.loadSalaryDirectory();
  }

  ngOnDestroy() {
    this.searchSub?.unsubscribe();
  }

  loadSalaryDirectory() {
    this.loading = true;
    let params = new HttpParams()
      .set('pageNumber', (this.pageIndex + 1).toString())
      .set('pageSize', this.pageSize.toString())
      .set('status', this.batchStatusFilter)
      .set('department', this.batchDeptFilter)
      .set('sortBy', this.sortBy)
      .set('sortDescending', this.sortDescending.toString());

    if (this.batchSearchQuery?.trim()) {
      params = params.set('searchTerm', this.batchSearchQuery.trim());
    }

    this.http.get<StaffSalaryDirectoryResponse>(`${this.api}/teachers/salary-directory`, { params }).subscribe({
      next: (res) => {
        this.loading = false;
        if (!res) return;
        this.filteredBatchList = res.items || [];
        this.totalCount = res.totalCount || 0;
        if (res.kpis) {
          this.totalActiveStaffCount = res.kpis.totalActiveStaff || 0;
          this.configuredCount = res.kpis.salaryConfigured || 0;
          this.unconfiguredCount = res.kpis.missingSalaryStructure || 0;
          this.averageGross = res.kpis.averageMonthlyGross || 0;
        }
        if (res.departments && res.departments.length > 0) {
          this.departments = res.departments;
        }

        // Cache salary records for loaded teachers
        this.filteredBatchList.forEach(item => {
          if (item.salary) {
            this.salaryMap.set(item.teacher.id, item.salary);
          }
        });

        // If pre-selected teacher ID, load immediately
        if (this.preSelectId && !this.selectedTeacher) {
          const found = this.filteredBatchList.find(b => b.teacher.id === this.preSelectId);
          if (found) {
            this.onTeacherSelected(found.teacher);
          }
        }
      },
      error: (err) => {
        this.loading = false;
        console.error('Failed to load salary directory', err);
      }
    });
  }

  switchViewMode(mode: 'single' | 'batch') {
    this.viewMode = mode;
  }

  onTeacherSelected(t: TeacherDto) {
    this.selectedTeacher = t;
    this.showForm = false;
    this.loadSalary();
  }

  toggleForm() {
    this.showForm = !this.showForm;
    if (this.showForm) {
      if (this.salaryStructure) {
        this.salaryForm.patchValue({
          basicSalary: this.salaryStructure.basicSalary,
          hra: this.salaryStructure.hra,
          otherAllowances: this.salaryStructure.otherAllowances,
          pfDeduction: this.salaryStructure.pfDeduction,
          tdsDeduction: this.salaryStructure.tdsDeduction,
          otherDeductions: this.salaryStructure.otherDeductions,
          effectiveFrom: this.salaryStructure.effectiveFrom?.split('T')[0] || new Date().toISOString().split('T')[0]
        });
      } else {
        // Auto-recommend by experience if new
        if (this.selectedTeacher) {
          this.applyExperienceRecommendation(this.selectedTeacher);
        } else {
          this.salaryForm.reset({
            basicSalary: null, hra: 0, otherAllowances: 0,
            pfDeduction: 0, tdsDeduction: 0, otherDeductions: 0,
            effectiveFrom: new Date().toISOString().split('T')[0]
          });
        }
      }
      this.recalcLiveSalary();
    }
  }

  loadSalary() {
    if (!this.selectedTeacher) return;
    this.loading = true;
    this.http.get<SalaryDto | null>(`${this.api}/teachers/${this.selectedTeacher.id}/salary`).subscribe({
      next: (r) => {
        this.salaryStructure = (r && r.basicSalary > 0) ? r : null;
        this.loading = false;
        if (this.salaryStructure && this.showForm) {
          this.salaryForm.patchValue({
            basicSalary: this.salaryStructure.basicSalary,
            hra: this.salaryStructure.hra,
            otherAllowances: this.salaryStructure.otherAllowances,
            pfDeduction: this.salaryStructure.pfDeduction,
            tdsDeduction: this.salaryStructure.tdsDeduction,
            otherDeductions: this.salaryStructure.otherDeductions,
            effectiveFrom: this.salaryStructure.effectiveFrom?.split('T')[0]
          });
          this.recalcLiveSalary();
        }
      },
      error: () => {
        this.salaryStructure = null;
        this.loading = false;
      }
    });
  }

  recalcLiveSalary() {
    const val = this.salaryForm.value;
    const basic = Number(val.basicSalary || 0);
    const hra = Number(val.hra || 0);
    const otherAllow = Number(val.otherAllowances || 0);
    const pf = Number(val.pfDeduction || 0);
    const tds = Number(val.tdsDeduction || 0);
    const otherDed = Number(val.otherDeductions || 0);

    this.liveGrossSalary = basic + hra + otherAllow;
    this.liveTotalDeductions = pf + tds + otherDed;
    this.liveNetSalary = Math.max(0, this.liveGrossSalary - this.liveTotalDeductions);
  }

  // =========================================================================
  // EXPERIENCE & CADRE CALCULATION ENGINE
  // =========================================================================
  getExpBandName(exp: number): string {
    if (exp <= 2) return 'Fresher Band (0-2 Yrs)';
    if (exp <= 5) return 'Mid-Level Band (2-5 Yrs)';
    if (exp <= 8) return 'Senior Faculty (5-8 Yrs)';
    return 'Lead / HOD Band (8+ Yrs)';
  }

  calculateExpSalary(teacher: TeacherDto) {
    const exp = Number(teacher.experienceYears || 0);
    const des = (teacher.designation || '').toLowerCase();

    // Base Gross based on Cadre
    let baseGross = 25000;
    let stepIncrement = 1800; // Increment per year of experience

    if (des.includes('pgt')) {
      baseGross = 34000;
      stepIncrement = 2500;
    } else if (des.includes('tgt')) {
      baseGross = 28000;
      stepIncrement = 2000;
    } else if (des.includes('prt') || des.includes('primary')) {
      baseGross = 22000;
      stepIncrement = 1500;
    } else if (des.includes('hod') || des.includes('principal') || des.includes('coordinator')) {
      baseGross = 50000;
      stepIncrement = 3500;
    } else if (teacher.staffType === 'NonTeaching' || des.includes('accountant') || des.includes('admin')) {
      baseGross = 20000;
      stepIncrement = 1500;
    }

    const calculatedGross = Math.round(baseGross + (exp * stepIncrement));

    // Breakdown: 55% Basic, 25% HRA, 20% Other Allowances
    const basic = Math.round(calculatedGross * 0.55);
    const hra = Math.round(calculatedGross * 0.25);
    const allowances = Math.round(calculatedGross - (basic + hra));
    const pf = Math.round(basic * 0.12); // Optional 12% PF on Basic

    return { gross: calculatedGross, basic, hra, allowances, pf };
  }

  getStandardSlabs(designation: string): ExperienceSlabRecommendation[] {
    const des = (designation || '').toLowerCase();
    let mult = 1.0;
    if (des.includes('pgt')) mult = 1.35;
    else if (des.includes('prt')) mult = 0.85;
    else if (des.includes('hod') || des.includes('principal')) mult = 1.8;

    return [
      {
        slabName: 'Fresher / Entry Band',
        expRange: '0-2 Yrs',
        grossSalary: Math.round(24000 * mult),
        basicSalary: Math.round(24000 * mult * 0.55),
        hra: Math.round(24000 * mult * 0.25),
        otherAllowances: Math.round(24000 * mult * 0.20),
        pfDeduction: Math.round(24000 * mult * 0.55 * 0.12),
        description: 'Entry grade faculty compensation'
      },
      {
        slabName: 'Mid-Level Band',
        expRange: '2-5 Yrs',
        grossSalary: Math.round(34000 * mult),
        basicSalary: Math.round(34000 * mult * 0.55),
        hra: Math.round(34000 * mult * 0.25),
        otherAllowances: Math.round(34000 * mult * 0.20),
        pfDeduction: Math.round(34000 * mult * 0.55 * 0.12),
        description: 'Experienced classroom faculty'
      },
      {
        slabName: 'Senior Faculty Band',
        expRange: '5-8 Yrs',
        grossSalary: Math.round(45000 * mult),
        basicSalary: Math.round(45000 * mult * 0.55),
        hra: Math.round(45000 * mult * 0.25),
        otherAllowances: Math.round(45000 * mult * 0.20),
        pfDeduction: Math.round(45000 * mult * 0.55 * 0.12),
        description: 'Senior grade educator'
      },
      {
        slabName: 'Lead / HOD Band',
        expRange: '8+ Yrs',
        grossSalary: Math.round(60000 * mult),
        basicSalary: Math.round(60000 * mult * 0.55),
        hra: Math.round(60000 * mult * 0.25),
        otherAllowances: Math.round(60000 * mult * 0.20),
        pfDeduction: Math.round(60000 * mult * 0.55 * 0.12),
        description: 'Department Head & Academic leadership'
      }
    ];
  }

  applyExperienceRecommendation(teacher: TeacherDto) {
    const calc = this.calculateExpSalary(teacher);
    this.salaryForm.patchValue({
      basicSalary: calc.basic,
      hra: calc.hra,
      otherAllowances: calc.allowances,
      pfDeduction: calc.pf,
      tdsDeduction: 0,
      otherDeductions: 0,
      effectiveFrom: new Date().toISOString().split('T')[0]
    });
    this.recalcLiveSalary();
  }

  applySlab(slab: ExperienceSlabRecommendation) {
    this.salaryForm.patchValue({
      basicSalary: slab.basicSalary,
      hra: slab.hra,
      otherAllowances: slab.otherAllowances,
      pfDeduction: slab.pfDeduction,
      tdsDeduction: 0,
      otherDeductions: 0,
      effectiveFrom: new Date().toISOString().split('T')[0]
    });
    this.recalcLiveSalary();
  }

  saveSalary() {
    if (!this.selectedTeacher || this.salaryForm.invalid) {
      this.salaryForm.markAllAsTouched();
      return;
    }
    const val = this.salaryForm.value;
    if (!val.basicSalary || val.basicSalary <= 0) {
      this.confirmDialog.alert('Invalid Salary', 'Basic salary must be greater than 0.', 'warning');
      return;
    }

    this.submitting = true;
    this.http.post<SalaryDto>(`${this.api}/teachers/${this.selectedTeacher.id}/salary`, val).subscribe({
      next: (r) => {
        this.salaryStructure = r;
        this.salaryMap.set(this.selectedTeacher!.id, r);
        const item = this.filteredBatchList.find(b => b.teacher.id === this.selectedTeacher!.id);
        if (item) {
          item.salary = r;
          item.status = 'configured';
        }
        this.submitting = false;
        this.showForm = false;
        this.confirmDialog.alert('Salary Structure Saved', `Salary structure saved successfully for ${this.selectedTeacher!.fullName}!`, 'success');
        this.loadSalaryDirectory();
      },
      error: (e) => {
        this.submitting = false;
        this.confirmDialog.alert('Error', e?.error?.message || 'Error saving salary structure.', 'danger');
      }
    });
  }

  // Percentage Helpers for Visual Bar
  getBasicPercent(): number {
    if (!this.salaryStructure || this.salaryStructure.grossSalary <= 0) return 55;
    return Math.round((this.salaryStructure.basicSalary / this.salaryStructure.grossSalary) * 100);
  }

  getHraPercent(): number {
    if (!this.salaryStructure || this.salaryStructure.grossSalary <= 0) return 25;
    return Math.round((this.salaryStructure.hra / this.salaryStructure.grossSalary) * 100);
  }

  getAllowancesPercent(): number {
    if (!this.salaryStructure || this.salaryStructure.grossSalary <= 0) return 20;
    return Math.max(0, 100 - (this.getBasicPercent() + this.getHraPercent()));
  }

  // =========================================================================
  // SERVER-SIDE BATCH / GRID METHODS
  // =========================================================================
  onSort(col: string) {
    if (this.sortBy === col) {
      this.sortDescending = !this.sortDescending;
    } else {
      this.sortBy = col;
      this.sortDescending = false;
    }
    this.pageIndex = 0;
    this.loadSalaryDirectory();
  }

  getSortIcon(col: string): string {
    if (this.sortBy !== col) return 'unfold_more';
    return this.sortDescending ? 'arrow_downward' : 'arrow_upward';
  }

  onSearchChange(term: string) {
    this.searchSubject.next(term);
  }

  clearSearch() {
    this.batchSearchQuery = '';
    this.pageIndex = 0;
    this.loadSalaryDirectory();
  }

  onFilterChange() {
    this.pageIndex = 0;
    this.loadSalaryDirectory();
  }

  onPageChange(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadSalaryDirectory();
  }

  selectAllMissing() {
    this.batchStatusFilter = 'missing';
    this.pageIndex = 0;
    this.loadSalaryDirectory();
  }

  get selectedStaffCount(): number {
    return this.filteredBatchList.filter(i => i.selected).length;
  }

  isAllSelected(): boolean {
    return this.filteredBatchList.length > 0 && this.filteredBatchList.every(i => i.selected);
  }

  isIndeterminate(): boolean {
    const sel = this.selectedStaffCount;
    return sel > 0 && sel < this.filteredBatchList.length;
  }

  toggleSelectAll(checked: boolean) {
    this.filteredBatchList.forEach(i => i.selected = checked);
  }

  onRowSelectChange() {
    // triggers CD
  }

  configureSingleFromBatch(teacher: TeacherDto) {
    this.selectedTeacher = teacher;
    this.viewMode = 'single';
    this.showForm = true;
    this.loadSalary();
  }

  getSelectedStaffList(): TeacherDto[] {
    return this.filteredBatchList.filter(i => i.selected).map(i => i.teacher);
  }

  openBulkModal() {
    this.bulkEffectiveDate = new Date().toISOString().split('T')[0];
    this.showBulkModal = true;
  }

  closeBulkModal() {
    this.showBulkModal = false;
  }

  executeBulkSalarySetup() {
    const targets = this.getSelectedStaffList();
    if (targets.length === 0) return;

    this.batchProcessing = true;
    this.batchProgressCount = 0;

    let completed = 0;
    const total = targets.length;

    targets.forEach(t => {
      let payload: any;

      if (this.bulkStrategy === 'matrix') {
        const calc = this.calculateExpSalary(t);
        payload = {
          basicSalary: calc.basic,
          hra: calc.hra,
          otherAllowances: calc.allowances,
          pfDeduction: calc.pf,
          tdsDeduction: 0,
          otherDeductions: 0,
          effectiveFrom: this.bulkEffectiveDate
        };
      } else {
        payload = {
          basicSalary: this.uniformData.basicSalary,
          hra: this.uniformData.hra,
          otherAllowances: this.uniformData.otherAllowances,
          pfDeduction: this.uniformData.pfDeduction,
          tdsDeduction: this.uniformData.tdsDeduction,
          otherDeductions: this.uniformData.otherDeductions,
          effectiveFrom: this.bulkEffectiveDate
        };
      }

      this.http.post<SalaryDto>(`${this.api}/teachers/${t.id}/salary`, payload).subscribe({
        next: (res) => {
          completed++;
          this.batchProgressCount = completed;
          this.salaryMap.set(t.id, res);
          const item = this.filteredBatchList.find(b => b.teacher.id === t.id);
          if (item) {
            item.salary = res;
            item.status = 'configured';
            item.selected = false;
          }

          if (completed === total) {
            this.finishBulkOperation(total);
          }
        },
        error: () => {
          completed++;
          this.batchProgressCount = completed;
          if (completed === total) {
            this.finishBulkOperation(total);
          }
        }
      });
    });
  }

  finishBulkOperation(total: number) {
    this.batchProcessing = false;
    this.showBulkModal = false;
    this.confirmDialog.alert(
      'Batch Salary Setup Complete',
      `Salary structures successfully created and activated for ${total} staff members!`,
      'success'
    );
    this.loadSalaryDirectory();
  }
}
