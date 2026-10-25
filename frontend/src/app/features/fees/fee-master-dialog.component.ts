import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FeesService, FeeHead, ClassFeeStructureItem, SaveClassFeeStructureBatch } from '../../core/services/fees.service';
import { BatchesService, BatchDto } from '../../core/services/batches.service';
import { SchoolService, SchoolClassDto } from '../../core/services/school.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { QuickSettingsService } from '../../core/services/quick-settings.service';

@Component({
  selector: 'app-fee-master-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatCheckboxModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-title-bar">
        <div class="title-with-icon">
          <div class="icon-bubble">
            <mat-icon>account_balance</mat-icon>
          </div>
          <div>
            <h2 class="main-title">{{ dialogTitle }}</h2>
            <p class="sub-title">{{ dialogSubtitle }}</p>
          </div>
        </div>
        <button mat-icon-button type="button" class="close-btn" (click)="onClose()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-tab-group class="fee-tabs" animationDuration="150ms">
        <!-- TAB 1: Fee Heads Master Catalog -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">category</mat-icon>
            <span>Fee Heads Master ({{ feeHeads.length }})</span>
          </ng-template>

          <div class="tab-content">
            <!-- Add / Edit Fee Head Panel -->
            <div class="add-head-box">
              <div class="box-header">
                <strong><mat-icon>add_circle</mat-icon> Create / Update Fee Head</strong>
                <button mat-stroked-button type="button" class="preset-btn" (click)="seedStandardHeads()" [disabled]="seedingPresets">
                  <mat-spinner diameter="16" *ngIf="seedingPresets" class="btn-spinner"></mat-spinner>
                  <mat-icon *ngIf="!seedingPresets">sync</mat-icon>
                  <span>Sync Fee Heads from Database</span>
                </button>
              </div>
              <form [formGroup]="headForm" (ngSubmit)="onSaveHead()" class="head-form-grid">
                <mat-form-field appearance="outline" class="field-col">
                  <mat-label>Fee Head Name</mat-label>
                  <input matInput formControlName="name" placeholder="e.g. Tuition Fee, Exam Fee, Coaching Fee" />
                  <mat-error *ngIf="headForm.get('name')?.hasError('required')">Name is required</mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" class="field-col">
                  <mat-label>Short Code (Unique)</mat-label>
                  <input matInput formControlName="code" placeholder="e.g. TUI, COACH, EXAM, COMP" style="text-transform: uppercase;" />
                  <mat-error *ngIf="headForm.get('code')?.hasError('required')">Code is required</mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" class="field-col">
                  <mat-label>Category</mat-label>
                  <mat-select formControlName="category" panelClass="smooth-dropdown-panel fee-category-panel">
                    <mat-select-trigger>
                      <span class="category-tag" [ngClass]="'cat-' + (headForm.get('category')?.value || 'academic').toLowerCase()">
                        {{ headForm.get('category')?.value || 'Select Category' }}
                      </span>
                    </mat-select-trigger>
                    <mat-option value="Academic">
                      <div class="opt-content">
                        <div class="opt-header-row">
                          <span class="category-tag cat-academic">Academic</span>
                          <span>Tuition &amp; Coaching</span>
                        </div>
                        <span class="opt-desc">Monthly tuition, regular classroom courses &amp; test guidance</span>
                      </div>
                    </mat-option>
                    <mat-option value="Infrastructure">
                      <div class="opt-content">
                        <div class="opt-header-row">
                          <span class="category-tag cat-infrastructure">Infrastructure</span>
                          <span>Lab &amp; Smart Class</span>
                        </div>
                        <span class="opt-desc">Computer lab, smart room, Physics/Chemistry/Bio consumables</span>
                      </div>
                    </mat-option>
                    <mat-option value="Activities">
                      <div class="opt-content">
                        <div class="opt-header-row">
                          <span class="category-tag cat-activities">Activities</span>
                          <span>Sports &amp; Culture</span>
                        </div>
                        <span class="opt-desc">Annual sports day, tournaments, cultural functions &amp; events</span>
                      </div>
                    </mat-option>
                    <mat-option value="Supplies">
                      <div class="opt-content">
                        <div class="opt-header-row">
                          <span class="category-tag cat-supplies">Supplies</span>
                          <span>Modules, Uniform &amp; Kit</span>
                        </div>
                        <span class="opt-desc">Printed DPPs, formula sheets, school diary, tie &amp; ID card</span>
                      </div>
                    </mat-option>
                    <mat-option value="Residential" *ngIf="hasHostelModule">
                      <div class="opt-content">
                        <div class="opt-header-row">
                          <span class="category-tag cat-residential">Residential</span>
                          <span>Hostel &amp; Mess</span>
                        </div>
                        <span class="opt-desc">Hostel room rent, food mess &amp; boarding facilities</span>
                      </div>
                    </mat-option>
                    <mat-option value="Transport" *ngIf="hasTransportModule">
                      <div class="opt-content">
                        <div class="opt-header-row">
                          <span class="category-tag cat-transport">Transport</span>
                          <span>Bus &amp; Van Facility</span>
                        </div>
                        <span class="opt-desc">Monthly student pickup &amp; drop transit facility</span>
                      </div>
                    </mat-option>
                    <mat-option value="Other">
                      <div class="opt-content">
                        <div class="opt-header-row">
                          <span class="category-tag cat-other">Other</span>
                          <span>Administrative &amp; Misc</span>
                        </div>
                        <span class="opt-desc">Miscellaneous charges, fines &amp; ad-hoc expenses</span>
                      </div>
                    </mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="field-col">
                  <mat-label>Frequency</mat-label>
                  <mat-select formControlName="frequency" panelClass="smooth-dropdown-panel fee-frequency-panel">
                    <mat-select-trigger>
                      <span class="freq-tag">
                        {{ headForm.get('frequency')?.value || 'Select Frequency' }}
                      </span>
                    </mat-select-trigger>
                    <mat-option value="Monthly">
                      <div class="opt-content">
                        <div class="opt-header-row">
                          <span class="freq-tag">Monthly</span>
                          <span>Recurring Monthly</span>
                        </div>
                        <span class="opt-desc">Billed in every monthly billing cycle (12 times/year)</span>
                      </div>
                    </mat-option>
                    <mat-option value="Quarterly">
                      <div class="opt-content">
                        <div class="opt-header-row">
                          <span class="freq-tag">Quarterly</span>
                          <span>Quarterly Cycle</span>
                        </div>
                        <span class="opt-desc">Billed once every 3 months installment</span>
                      </div>
                    </mat-option>
                    <mat-option value="Annual">
                      <div class="opt-content">
                        <div class="opt-header-row">
                          <span class="freq-tag">Annual</span>
                          <span>Once a Year</span>
                        </div>
                        <span class="opt-desc">Billed once per academic session (e.g. Session start in April)</span>
                      </div>
                    </mat-option>
                    <mat-option value="OneTime">
                      <div class="opt-content">
                        <div class="opt-header-row">
                          <span class="freq-tag">One-Time</span>
                          <span>At Admission / Joining</span>
                        </div>
                        <span class="opt-desc">One-time registration, admission fee or starter kit</span>
                      </div>
                    </mat-option>
                    <mat-option value="TermWise">
                      <div class="opt-content">
                        <div class="opt-header-row">
                          <span class="freq-tag">Term-Wise</span>
                          <span>Exam / Semester Terms</span>
                        </div>
                        <span class="opt-desc">Levied during Half-Yearly or Final exam cycles</span>
                      </div>
                    </mat-option>
                    <mat-option value="AdHoc">
                      <div class="opt-content">
                        <div class="opt-header-row">
                          <span class="freq-tag">Ad-Hoc</span>
                          <span>As Needed</span>
                        </div>
                        <span class="opt-desc">Levied on-demand for special events or custom charges</span>
                      </div>
                    </mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="field-col">
                  <mat-label>Applicable To</mat-label>
                  <mat-select formControlName="applicableTo" panelClass="smooth-dropdown-panel">
                    <mat-option *ngIf="hasSchoolModule && hasCoachingModule" value="Both">🔄 Both (School &amp; Coaching)</mat-option>
                    <mat-option *ngIf="hasSchoolModule" value="School">🏫 School Only</mat-option>
                    <mat-option *ngIf="hasCoachingModule" value="Coaching">🎯 Coaching Only</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="field-col full-width">
                  <mat-label>Description / Note</mat-label>
                  <input matInput formControlName="description" placeholder="Brief description of when this fee is levied" />
                </mat-form-field>

                <div class="form-action-col">
                  <button mat-raised-button color="primary" type="submit" [disabled]="headForm.invalid || savingHead">
                    <mat-spinner diameter="18" *ngIf="savingHead" class="btn-spinner"></mat-spinner>
                    <mat-icon *ngIf="!savingHead">save</mat-icon>
                    <span>Save Fee Head</span>
                  </button>
                  <button mat-button type="button" *ngIf="headForm.dirty" (click)="resetHeadForm()">Cancel</button>
                </div>
              </form>
            </div>

            <!-- Existing Fee Heads Table -->
            <div class="heads-table-wrapper">
              <div class="heads-toolbar-row">
                <div class="heads-search-bar">
                  <mat-icon>search</mat-icon>
                  <input
                    type="text"
                    placeholder="Search fee heads by name, code, category, frequency..."
                    [(ngModel)]="headSearchQuery"
                    (input)="filterFeeHeadsMaster()"
                  />
                  <button mat-icon-button type="button" class="clear-search-btn" *ngIf="headSearchQuery" (click)="clearHeadSearch()">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
                <div class="heads-meta-pill" *ngIf="feeHeads.length > 0">
                  <span>{{ filteredFeeHeads.length }} of {{ feeHeads.length }} Fee Heads</span>
                </div>
              </div>

              <table class="styled-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Fee Head Name</th>
                    <th>Applicable To</th>
                    <th>Category</th>
                    <th>Frequency</th>
                    <th>Description</th>
                    <th class="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let h of filteredFeeHeads">
                    <td><span class="code-pill">{{ h.code }}</span></td>
                    <td><strong>{{ h.name }}</strong></td>
                    <td>
                      <span class="scope-badge" [ngClass]="'scope-' + (h.applicableTo || 'both').toLowerCase()">
                        {{ (h.applicableTo || 'Both') === 'Both' ? '🔄 Both' : ((h.applicableTo === 'School') ? '🏫 School' : '🎯 Coaching') }}
                      </span>
                    </td>
                    <td><span class="category-tag" [ngClass]="'cat-' + h.category.toLowerCase()">{{ h.category }}</span></td>
                    <td><span class="freq-tag">{{ h.frequency }}</span></td>
                    <td class="desc-cell">{{ h.description || '—' }}</td>
                    <td class="text-center">
                      <button mat-icon-button color="warn" (click)="onDeactivateHead(h)" matTooltip="Deactivate this Fee Head" *ngIf="!h.isDefault">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                      <span class="default-badge" *ngIf="h.isDefault">Default</span>
                    </td>
                  </tr>
                  <tr *ngIf="filteredFeeHeads.length === 0 && feeHeads.length > 0">
                    <td colspan="7" class="empty-state">No fee heads found matching "{{ headSearchQuery }}".</td>
                  </tr>
                  <tr *ngIf="feeHeads.length === 0">
                    <td colspan="7" class="empty-state">No fee heads found. Click "Sync Fee Heads from Database" above to auto-populate standard school & coaching heads.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </mat-tab>

        <!-- TAB 2: Fee Structure Matrix (School Classes & Coaching Batches) -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">grid_view</mat-icon>
            <span>Fee Structure Matrix</span>
          </ng-template>

          <div class="tab-content">
            <!-- Target Selector Toolbar Card -->
            <div class="matrix-selector-card">
              <!-- Top Row: Mode Toggle & Summary Cards -->
              <div class="selector-top-row">
                <!-- Dual Switcher: shown only when BOTH modules are active and items exist -->
                <div class="target-toggle" *ngIf="hasSchoolModule && hasCoachingModule && schoolClasses.length > 0 && batches.length > 0">
                  <button type="button"
                          class="toggle-btn"
                          [class.active]="targetType === 'class'"
                          (click)="setTargetType('class')">
                    <mat-icon>school</mat-icon>
                    <span>School Class</span>
                    <span class="count-pill">{{ schoolOnlyClasses.length }}</span>
                  </button>
                  <button type="button"
                          class="toggle-btn"
                          [class.active]="targetType === 'batch'"
                          (click)="setTargetType('batch')">
                    <mat-icon>groups</mat-icon>
                    <span>Coaching Batch</span>
                    <span class="count-pill">{{ batches.length }}</span>
                  </button>
                </div>

                <!-- Summary Cards (Monthly & Annual Totals) -->
                <div class="summary-cards" *ngIf="matrixRows.length > 0">
                  <div class="sum-card monthly">
                    <span class="sum-label">Total Monthly Bill:</span>
                    <strong class="sum-val">₹{{ totalMonthlyAmount | number:'1.2-2' }}</strong>
                  </div>
                  <div class="sum-card annual">
                    <span class="sum-label">Annual / One-Time Extras:</span>
                    <strong class="sum-val">₹{{ totalAnnualExtras | number:'1.2-2' }}</strong>
                  </div>
                </div>
              </div>

              <!-- Bottom Row: Large Full-Width Selection Dropdown -->
              <div class="selector-dropdown-row">
                <!-- Dropdown when targetType === 'class' -->
                <mat-form-field appearance="outline" class="select-target-full" *ngIf="hasSchoolModule && targetType === 'class'">
                  <mat-label>Assign Fee For: School Class</mat-label>
                  <mat-select [(ngModel)]="selectedClassId" (selectionChange)="loadStructureForSelection()" panelClass="target-select-panel">
                    <mat-option *ngFor="let c of schoolOnlyClasses" [value]="c.id">
                      🏫 {{ c.name }} {{ c.code ? '(' + c.code + ')' : '' }}
                    </mat-option>
                  </mat-select>
                  <mat-icon matPrefix class="dropdown-prefix-icon" color="primary">school</mat-icon>
                </mat-form-field>

                <!-- Coaching Batch: Single / Combined Sub-Toggle + Dropdowns -->
                <div class="coaching-section-wrap" *ngIf="hasCoachingModule && targetType === 'batch'">

                  <!-- Single vs Combined toggle -->
                  <div class="coaching-scope-toggle">
                    <button type="button"
                            class="scope-btn"
                            [class.active]="coachingScope === 'single'"
                            (click)="setCoachingScope('single')">
                      <mat-icon>school</mat-icon>
                      <div class="scope-btn-text">
                        <span class="scope-btn-title">Single Class Batch</span>
                        <span class="scope-btn-sub">एक class → batch select करें</span>
                      </div>
                      <span class="count-pill">{{ singleClassBatches.length }}</span>
                    </button>
                    <button type="button"
                            class="scope-btn"
                            [class.active]="coachingScope === 'combined'"
                            (click)="setCoachingScope('combined')">
                      <mat-icon>layers</mat-icon>
                      <div class="scope-btn-text">
                        <span class="scope-btn-title">Combined / Multi-Class</span>
                        <span class="scope-btn-sub">Class 1st–5th जैसी combined batches</span>
                      </div>
                      <span class="count-pill">{{ combinedBatches.length }}</span>
                    </button>
                  </div>

                  <!-- Single Class mode: class filter + batch dropdown -->
                  <div class="batch-selector-dual-row" *ngIf="coachingScope === 'single'">
                    <mat-form-field appearance="outline" class="select-class-filter">
                      <mat-label>Academic Class (कक्षा)</mat-label>
                      <mat-select [(ngModel)]="batchClassFilter" (selectionChange)="onBatchClassFilterChange()" panelClass="target-select-panel">
                        <mat-option value="">✨ All Classes</mat-option>
                        <mat-option *ngFor="let c of coachingEligibleClasses" [value]="c.id">
                          🏫 {{ c.name }}
                        </mat-option>
                      </mat-select>
                      <mat-icon matPrefix class="dropdown-prefix-icon" color="primary">school</mat-icon>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="select-batch-target">
                      <mat-label>Batch Select करें</mat-label>
                      <mat-select [(ngModel)]="selectedBatchId" (selectionChange)="loadStructureForSelection()" panelClass="target-select-panel">
                        <mat-option *ngFor="let b of filteredSingleBatches" [value]="b.id">
                          🎯 {{ b.name }}{{ b.subject ? ' — ' + b.subject : '' }}
                        </mat-option>
                        <mat-option *ngIf="filteredSingleBatches.length === 0" disabled>
                          No single-class batches found
                        </mat-option>
                      </mat-select>
                      <mat-icon matPrefix class="dropdown-prefix-icon" color="primary">groups</mat-icon>
                    </mat-form-field>
                  </div>

                  <!-- Combined mode: only combined/multi-class batches -->
                  <mat-form-field appearance="outline" class="select-target-full" *ngIf="coachingScope === 'combined'">
                    <mat-label>Combined Batch Select करें</mat-label>
                    <mat-select [(ngModel)]="selectedBatchId" (selectionChange)="loadStructureForSelection()" panelClass="target-select-panel">
                      <mat-option *ngFor="let b of combinedBatches" [value]="b.id">
                        🔗 {{ b.name }}{{ b.subject ? ' — ' + b.subject : '' }}
                      </mat-option>
                      <mat-option *ngIf="combinedBatches.length === 0" disabled>
                        No combined batches found. Create one in Batch Master.
                      </mat-option>
                    </mat-select>
                    <mat-icon matPrefix class="dropdown-prefix-icon" color="primary">layers</mat-icon>
                  </mat-form-field>

                </div>
              </div>
            </div>

            <!-- Structure Grid Table -->
            <div class="matrix-table-wrapper" *ngIf="(targetType === 'class' && selectedClassId) || (targetType === 'batch' && selectedBatchId)">
              <table class="styled-table matrix-table">
                <thead>
                  <tr>
                    <th style="width: 40px;">Active</th>
                    <th>Fee Head</th>
                    <th>Category</th>
                    <th>Frequency</th>
                    <th style="width: 180px;">Amount (₹)</th>
                    <th style="width: 220px;">Applicable Month</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of matrixRows" [class.row-disabled]="!row.isActive">
                    <td>
                      <mat-checkbox [(ngModel)]="row.isActive" (change)="onRowActiveChange(row)" color="primary"></mat-checkbox>
                    </td>
                    <td>
                      <strong>{{ row.feeHeadName }}</strong>
                      <span class="code-sub">({{ row.feeHeadCode }})</span>
                    </td>
                    <td>
                      <span class="category-tag" [ngClass]="'cat-' + row.category.toLowerCase()">{{ row.category }}</span>
                    </td>
                    <td><span class="freq-tag">{{ row.frequency }}</span></td>
                    <td>
                      <mat-form-field appearance="outline" class="inline-amt-field" density="compact">
                        <span matPrefix class="rupee-prefix">₹&nbsp;</span>
                        <input matInput type="number" [ngModel]="row.isActive ? row.amount : 0" (ngModelChange)="row.amount = $event; onAmountChange(row)" [disabled]="!row.isActive" min="0" />
                      </mat-form-field>
                    </td>
                    <td>
                      <mat-form-field appearance="outline" class="inline-month-field" density="compact">
                        <mat-select [(ngModel)]="row.applicableMonth" [disabled]="!row.isActive || row.frequency === 'Monthly'">
                          <mat-option [value]="null">All Months (Recurring)</mat-option>
                          <mat-option [value]="4">April (Session Start)</mat-option>
                          <mat-option [value]="5">May</mat-option>
                          <mat-option [value]="6">June</mat-option>
                          <mat-option [value]="7">July</mat-option>
                          <mat-option [value]="8">August</mat-option>
                          <mat-option [value]="9">September (Term 1 Exam)</mat-option>
                          <mat-option [value]="10">October</mat-option>
                          <mat-option [value]="11">November</mat-option>
                          <mat-option [value]="12">December</mat-option>
                          <mat-option [value]="1">January</mat-option>
                          <mat-option [value]="2">February (Final Exam)</mat-option>
                          <mat-option [value]="3">March</mat-option>
                        </mat-select>
                      </mat-form-field>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div class="matrix-save-bar">
                <span class="save-hint">💡 Changes will apply to generated invoices for this {{ targetType === 'class' ? 'School Class' : 'Coaching Batch' }}.</span>
                <button mat-raised-button color="primary" class="save-matrix-btn" (click)="onSaveMatrix()" [disabled]="savingMatrix">
                  <mat-spinner diameter="18" *ngIf="savingMatrix" class="btn-spinner"></mat-spinner>
                  <mat-icon *ngIf="!savingMatrix">save</mat-icon>
                  <span>Save {{ targetType === 'class' ? 'Class' : 'Batch' }} Fee Structure</span>
                </button>
              </div>
            </div>

            <div *ngIf="!(targetType === 'class' ? selectedClassId : selectedBatchId)" class="no-selection-hint">
              <mat-icon>touch_app</mat-icon>
              <p>Please select a {{ targetType === 'class' ? 'School Class' : 'Coaching Batch' }} above to configure its Fee Structure Matrix.</p>
            </div>
          </div>
        </mat-tab>

        <!-- TAB 3: Admission & Billing Policy (दाखिला व बिलिंग नीति) -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">policy</mat-icon>
            <span>Billing &amp; Cutoff Policy</span>
          </ng-template>

          <div class="tab-content policy-tab-content">
            <form [formGroup]="policyForm" (ngSubmit)="onSavePolicy()" class="policy-form">

              <!-- Dynamic Admission Cutoff Card -->
              <div class="policy-card">
                <div class="policy-card-header">
                  <div class="policy-header-icon-box">
                    <mat-icon>calendar_month</mat-icon>
                  </div>
                  <div class="policy-header-text">
                    <h3 class="policy-card-title">Admission Invoicing Cutoff Day (दाखिला कटऑफ दिन)</h3>
                    <p class="policy-card-desc">Configure the monthly cutoff date that divides same-month billing from next-month rollover for new admissions.</p>
                  </div>
                  <span class="policy-active-badge">Active Rule: Day 1–{{ policyForm.get('admissionCutoffDay')?.value }}</span>
                </div>

                <div class="policy-card-body">
                  <div class="policy-input-row">
                    <mat-form-field appearance="outline" class="cutoff-field">
                      <mat-label>Admission Cutoff Day (1 – 28)</mat-label>
                      <input matInput type="number" formControlName="admissionCutoffDay" min="1" max="28" placeholder="20" />
                      <span matSuffix style="font-size: 0.82rem; color: #64748b; font-weight: 600; margin-right: 8px;">th of each month</span>
                      <mat-error *ngIf="policyForm.get('admissionCutoffDay')?.hasError('required')">Cutoff day is required</mat-error>
                      <mat-error *ngIf="policyForm.get('admissionCutoffDay')?.hasError('min') || policyForm.get('admissionCutoffDay')?.hasError('max')">Must be between 1 and 28</mat-error>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="policy-select-field">
                      <mat-label>Rollover Behavior (कटऑफ बाद का नियम)</mat-label>
                      <mat-select formControlName="admissionRolloverPolicy">
                        <mat-option value="NextMonthFull">Start Full Billing from 1st of Next Month (अगले माह से पूरा बिल)</mat-option>
                      </mat-select>
                    </mat-form-field>
                  </div>

                  <!-- Visual Rule Simulation & Preview Box -->
                  <div class="rule-preview-grid">
                    <div class="preview-tile same-month">
                      <div class="tile-badge on-time">
                        <mat-icon>check_circle</mat-icon>
                        <span>CURRENT MONTH BILLING</span>
                      </div>
                      <div class="tile-headline">Day 1 to Day {{ policyForm.get('admissionCutoffDay')?.value || 20 }}</div>
                      <p class="tile-detail">
                        Students admitted on or before the <strong>{{ policyForm.get('admissionCutoffDay')?.value || 20 }}th</strong> are billed for the full current month, bundling initial Tuition and One-Time Registration fees.
                      </p>
                    </div>

                    <div class="preview-tile next-month">
                      <div class="tile-badge rollover">
                        <mat-icon>trending_flat</mat-icon>
                        <span>NEXT MONTH ROLLOVER</span>
                      </div>
                      <div class="tile-headline">Day {{ (policyForm.get('admissionCutoffDay')?.value || 20) + 1 }} to Month-End</div>
                      <p class="tile-detail">
                        Students admitted after the <strong>{{ policyForm.get('admissionCutoffDay')?.value || 20 }}th</strong> are exempt for the remaining joining month. First billing begins automatically on the 1st of next month.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Session / Financial Year Alignment Card -->
              <div class="policy-card">
                <div class="policy-card-header">
                  <div class="policy-header-icon-box fy-icon">
                    <mat-icon>account_balance</mat-icon>
                  </div>
                  <div class="policy-header-text">
                    <h3 class="policy-card-title">Academic &amp; Financial Session Alignment (सत्र चक्र)</h3>
                    <p class="policy-card-desc">Session starts in April and ends in March as per Indian Education System standard.</p>
                  </div>
                  <span class="policy-active-badge fy-badge">Cycle: April – March</span>
                </div>

                <div class="policy-card-body">
                  <mat-form-field appearance="outline" class="cutoff-field">
                    <mat-label>Session Start Month</mat-label>
                    <mat-select formControlName="financialYearStartMonth">
                      <mat-option [value]="4">April (अप्रैल - Standard School Session Start)</mat-option>
                      <mat-option [value]="1">January (जनवरी - Calendar Year Cycle)</mat-option>
                      <mat-option [value]="7">July (जुलाई - University / Mid-Year Cycle)</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>
              </div>

              <!-- Strict Registration & One-Time Fee Safeguard Banner -->
              <div class="policy-safeguard-banner">
                <div class="sg-icon-box">
                  <mat-icon>security</mat-icon>
                </div>
                <div class="sg-content">
                  <div class="sg-title">
                    <strong>Universal One-Time &amp; Registration Fee Protection</strong>
                    <span class="sg-badge">ZERO REPEAT GUARANTEED</span>
                  </div>
                  <p class="sg-text">
                    One-Time fees (Registration Fee, Admission Fee, Kit Fee) are strictly bundled <strong>EXCLUSIVELY</strong> in the student's initial invoice. In all subsequent months, quarters, half-yearly runs, and in the <strong>Fee Card (Passbook)</strong>, Registration fees <strong>NEVER repeat</strong>.
                  </p>
                </div>
              </div>

              <!-- Save Policy Actions Bar -->
              <div class="policy-save-bar">
                <button mat-raised-button color="primary" type="submit" class="save-policy-btn" [disabled]="savingPolicy || policyForm.invalid">
                  <mat-spinner diameter="18" *ngIf="savingPolicy" class="btn-spinner"></mat-spinner>
                  <mat-icon *ngIf="!savingPolicy">save</mat-icon>
                  <span>Save Billing &amp; Cutoff Policies</span>
                </button>
              </div>

            </form>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      min-width: min(1080px, 92vw);
    }
    ::ng-deep .fee-tabs {
      .mat-mdc-tab-header-pagination {
        display: none !important;
      }
      .mat-mdc-tab-header {
        overflow-x: auto;
      }
      .mat-mdc-tab-label-container {
        overflow: visible !important;
      }
    }
    .dialog-title-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;

      .title-with-icon {
        display: flex;
        align-items: center;
        gap: 12px;

        .icon-bubble {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #2563eb;
        }

        .main-title {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          color: #0f172a;
        }
        .sub-title {
          margin: 2px 0 0;
          font-size: 0.78rem;
          color: #64748b;
        }
      }
    }
    .tab-content {
      padding: 18px 20px;
      overflow-y: auto;
      max-height: 68vh;
    }
    .add-head-box {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 18px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);

      .box-header {
        color: #1e293b;
        font-size: 0.9rem;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;

        strong {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .preset-btn {
          font-size: 0.78rem;
          height: 32px;
          line-height: 32px;
          color: #0284c7;
          border-color: #bae6fd;
          background: #f0f9ff;
          mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
            margin-right: 4px;
          }
        }
      }

      .head-form-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;

        .field-col {
          flex: 1 1 calc(25% - 12px);
          min-width: 170px;
        }
        .full-width {
          flex: 1 1 100%;
        }
        .form-action-col {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          justify-content: flex-end;
        }
      }
    }
    .heads-toolbar-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      gap: 12px;

      .heads-search-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #ffffff;
        border: 1.5px solid #cbd5e1;
        border-radius: 8px;
        padding: 5px 12px;
        width: 380px;
        max-width: 100%;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;

        &:focus-within {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
        }

        mat-icon {
          color: #94a3b8;
          font-size: 20px;
          width: 20px;
          height: 20px;
        }

        input {
          border: none;
          outline: none;
          background: transparent;
          font-size: 0.86rem;
          color: #0f172a;
          flex: 1;
        }

        .clear-search-btn {
          width: 22px;
          height: 22px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
            color: #94a3b8;
          }
        }
      }

      .heads-meta-pill {
        font-size: 0.78rem;
        font-weight: 600;
        color: #475569;
        background: #f1f5f9;
        padding: 4px 10px;
        border-radius: 20px;
        border: 1px solid #e2e8f0;
      }
    }
    .styled-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;

      th {
        background: #f1f5f9;
        color: #475569;
        font-weight: 700;
        text-align: left;
        padding: 10px 12px;
        border-bottom: 2px solid #cbd5e1;
        position: sticky;
        top: 0;
        z-index: 10;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
      }
      td {
        padding: 8px 12px;
        border-bottom: 1px solid #f1f5f9;
        vertical-align: middle;
      }
      tr:hover {
        background: #f8fafc;
      }
    }
    .code-pill {
      font-family: monospace;
      font-weight: 700;
      background: #e2e8f0;
      color: #334155;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.78rem;
    }
    .code-sub {
      color: #64748b;
      font-size: 0.76rem;
      font-family: monospace;
      margin-left: 4px;
    }
    .category-tag {
      font-size: 0.72rem;
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 600;
      display: inline-block;

      &.cat-academic { background: #dbeafe; color: #1d4ed8; }
      &.cat-infrastructure { background: #fef3c7; color: #b45309; }
      &.cat-activities { background: #dcfce7; color: #15803d; }
      &.cat-supplies { background: #f3e8ff; color: #7e22ce; }
      &.cat-residential { background: #ffe4e6; color: #be123c; }
      &.cat-transport { background: #ffedd5; color: #c2410c; }
      &.cat-other { background: #f1f5f9; color: #475569; }
    }
    .freq-tag {
      font-size: 0.75rem;
      color: #475569;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .scope-badge {
      font-size: 0.72rem;
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      white-space: nowrap;

      &.scope-school { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
      &.scope-coaching { background: #faf5ff; color: #7e22ce; border: 1px solid #e9d5ff; }
      &.scope-both { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
    }
    .default-badge {
      font-size: 0.68rem;
      background: #e0f2fe;
      color: #0369a1;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }
    .matrix-selector-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 18px 8px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);

      .selector-top-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 12px;

        .target-toggle {
          display: inline-flex;
          background: #e2e8f0;
          border-radius: 8px;
          padding: 3px;
          border: 1px solid #cbd5e1;

          .toggle-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 7px 14px;
            font-size: 0.84rem;
            font-weight: 600;
            border: none;
            background: transparent;
            color: #64748b;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.15s ease;

            mat-icon {
              font-size: 18px;
              width: 18px;
              height: 18px;
            }

            .count-pill {
              background: #cbd5e1;
              color: #334155;
              padding: 1px 6px;
              border-radius: 10px;
              font-size: 0.7rem;
            }

            &.active {
              background: #ffffff;
              color: #0284c7;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);

              .count-pill {
                background: #e0f2fe;
                color: #0369a1;
              }
            }
          }
        }

        .summary-cards {
          display: flex;
          gap: 12px;
          align-items: center;

          .sum-card {
            padding: 6px 14px;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            min-width: 130px;

            .sum-label {
              font-size: 0.7rem;
              font-weight: 500;
            }
            .sum-val {
              font-size: 1.1rem;
              font-weight: 700;
            }

            &.monthly {
              background: #ecfdf5;
              border: 1px solid #a7f3d0;
              color: #047857;
            }
            &.annual {
              background: #fdf4ff;
              border: 1px solid #f5d0fe;
              color: #a21caf;
            }
          }
        }
      }

      .selector-dropdown-row {
        width: 100%;

        .select-target-full {
          width: 100%;
          margin-bottom: -0.75em;

          .dropdown-prefix-icon {
            margin-right: 8px;
          }
        }

        .batch-selector-dual-row {
          width: 100%;
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 12px;
          align-items: center;

          @media (max-width: 768px) {
            grid-template-columns: 1fr;
            gap: 6px;
          }

          .select-class-filter, .select-batch-target {
            width: 100%;
            margin-bottom: -0.75em;

            .dropdown-prefix-icon {
              margin-right: 8px;
            }
          }
        }
      }

      /* Coaching single/combined scope section */
      .coaching-section-wrap {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 12px;

        .coaching-scope-toggle {
          display: flex;
          gap: 8px;
          background: #f1f5f9;
          border-radius: 10px;
          padding: 4px;

          @media (max-width: 640px) {
            flex-direction: column;
          }

          .scope-btn {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            border: 1.5px solid transparent;
            border-radius: 8px;
            background: transparent;
            cursor: pointer;
            transition: all 0.18s ease;
            text-align: left;

            mat-icon {
              font-size: 20px;
              width: 20px;
              height: 20px;
              color: #64748b;
              flex-shrink: 0;
            }

            .scope-btn-text {
              flex: 1;
              display: flex;
              flex-direction: column;
              gap: 1px;

              .scope-btn-title {
                font-size: 0.84rem;
                font-weight: 600;
                color: #334155;
              }
              .scope-btn-sub {
                font-size: 0.72rem;
                color: #64748b;
              }
            }

            .count-pill {
              background: #cbd5e1;
              color: #334155;
              padding: 2px 7px;
              border-radius: 10px;
              font-size: 0.71rem;
              font-weight: 700;
              flex-shrink: 0;
            }

            &:hover {
              background: #e2e8f0;
            }

            &.active {
              background: #ffffff;
              border-color: #2563eb;
              box-shadow: 0 1px 4px rgba(37,99,235,0.15);

              mat-icon { color: #2563eb; }

              .scope-btn-text .scope-btn-title { color: #1e40af; }

              .count-pill {
                background: #dbeafe;
                color: #1d4ed8;
              }
            }
          }
        }

        .batch-selector-dual-row {
          width: 100%;
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 12px;
          align-items: center;

          @media (max-width: 768px) {
            grid-template-columns: 1fr;
            gap: 6px;
          }

          .select-class-filter, .select-batch-target {
            width: 100%;
            margin-bottom: -0.75em;
            .dropdown-prefix-icon { margin-right: 8px; }
          }
        }

        .select-target-full {
          width: 100%;
          margin-bottom: -0.75em;
          .dropdown-prefix-icon { margin-right: 8px; }
        }
      }
    }


    @media (max-width: 900px) {
      .matrix-selector-card {
        padding: 12px 14px 6px;

        .selector-top-row {
          flex-direction: column;
          align-items: stretch;
          gap: 12px;

          .target-toggle {
            width: 100%;
            display: flex;
            .toggle-btn {
              flex: 1;
              justify-content: center;
            }
          }

          .summary-cards {
            width: 100%;
            display: flex;
            justify-content: space-between;
            .sum-card {
              flex: 1;
            }
          }
        }
      }

      .dialog-container {
        min-width: 100% !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
      }
      .tab-content {
        padding: 12px 14px;
      }
      .head-form-grid .field-col {
        flex: 1 1 100% !important;
        min-width: 100% !important;
      }
      .matrix-save-bar {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;

        .save-hint {
          text-align: center;
          width: 100%;
        }

        .save-matrix-btn {
          width: 100%;
        }
      }
    }
    .inline-amt-field {
      width: 130px;
      margin-bottom: -1.25em;
      .rupee-prefix {
        font-weight: 600;
        color: #64748b;
      }
    }
    .inline-month-field {
      width: 200px;
      margin-bottom: -1.25em;
    }
    .row-disabled {
      opacity: 0.5;
    }
    .matrix-save-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 16px;
      padding-top: 14px;
      padding-bottom: 8px;
      border-top: 1px solid #e2e8f0;

      .save-hint {
        font-size: 0.8rem;
        color: #64748b;
        flex: 1;
        min-width: 220px;
      }

      .save-matrix-btn {
        min-height: 42px;
        padding: 0 20px;
        font-weight: 600;
        white-space: normal;
        text-align: center;
        line-height: 1.3;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border-radius: 8px;
        box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
        flex-shrink: 0;

        span {
          display: inline-block;
          word-break: normal;
        }
      }
    }
    .btn-spinner {
      display: inline-block;
      margin-right: 6px;
    }
    .no-selection-hint {
      text-align: center;
      padding: 40px;
      color: #94a3b8;
      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 8px;
      }
    }
    .policy-tab-content {
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .policy-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .policy-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);

      .policy-card-header {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 18px;
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        border-bottom: 1px solid #bfdbfe;

        .policy-header-icon-box {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: #2563eb;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(37,99,235,0.3);
          mat-icon { font-size: 20px; width: 20px; height: 20px; }

          &.fy-icon {
            background: #7c3aed;
            box-shadow: 0 2px 6px rgba(124,58,237,0.3);
          }
        }

        .policy-header-text {
          flex: 1;
          .policy-card-title {
            margin: 0;
            font-size: 0.96rem;
            font-weight: 700;
            color: #1e3a8a;
          }
          .policy-card-desc {
            margin: 2px 0 0;
            font-size: 0.77rem;
            color: #3b82f6;
          }
        }

        .policy-active-badge {
          padding: 4px 12px;
          background: #dbeafe;
          color: #1d4ed8;
          font-size: 0.76rem;
          font-weight: 700;
          border-radius: 20px;
          border: 1px solid #93c5fd;

          &.fy-badge {
            background: #ede9fe;
            color: #6d28d9;
            border-color: #c4b5fd;
          }
        }
      }

      .policy-card-body {
        padding: 18px 20px;

        .policy-input-row {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 16px;
          margin-bottom: 12px;

          @media (max-width: 640px) {
            grid-template-columns: 1fr;
          }
        }

        .cutoff-field, .policy-select-field {
          width: 100%;
        }

        .rule-preview-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-top: 10px;

          @media (max-width: 640px) {
            grid-template-columns: 1fr;
          }

          .preview-tile {
            padding: 14px 16px;
            border-radius: 10px;
            border: 1px solid;
            display: flex;
            flex-direction: column;
            gap: 6px;

            &.same-month {
              background: #f0fdf4;
              border-color: #86efac;
              .tile-badge {
                color: #15803d;
                background: #dcfce7;
              }
              .tile-headline {
                color: #166534;
              }
            }

            &.next-month {
              background: #eff6ff;
              border-color: #93c5fd;
              .tile-badge {
                color: #1d4ed8;
                background: #dbeafe;
              }
              .tile-headline {
                color: #1e40af;
              }
            }

            .tile-badge {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              align-self: flex-start;
              padding: 2px 8px;
              border-radius: 6px;
              font-size: 0.72rem;
              font-weight: 700;
              letter-spacing: 0.04em;
              mat-icon { font-size: 14px; width: 14px; height: 14px; }
            }

            .tile-headline {
              font-size: 1.05rem;
              font-weight: 700;
            }

            .tile-detail {
              margin: 0;
              font-size: 0.78rem;
              color: #475569;
              line-height: 1.45;
              strong { color: #0f172a; }
            }
          }
        }
      }
    }

    .policy-safeguard-banner {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 14px 18px;
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
      border: 1px solid #a7f3d0;
      border-left: 4px solid #10b981;
      border-radius: 10px;

      .sg-icon-box {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: #059669;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 2px 6px rgba(5,150,105,0.3);
        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }

      .sg-content {
        flex: 1;

        .sg-title {
          display: flex;
          align-items: center;
          gap: 8px;
          strong {
            font-size: 0.88rem;
            color: #064e3b;
          }
          .sg-badge {
            background: #d1fae5;
            color: #047857;
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 0.7rem;
            font-weight: 800;
            border: 1px solid #6ee7b7;
          }
        }

        .sg-text {
          margin: 4px 0 0;
          font-size: 0.78rem;
          color: #065f46;
          line-height: 1.45;
          strong { color: #022c22; }
        }
      }
    }

    .policy-save-bar {
      display: flex;
      justify-content: flex-end;
      padding-top: 10px;

      .save-policy-btn {
        min-height: 42px;
        padding: 0 22px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 8px;
        box-shadow: 0 2px 6px rgba(37,99,235,0.25);
      }
    }
  `]
})
export class FeeMasterDialogComponent implements OnInit {
  private authService = inject(AuthService);

  get hasSchoolModule(): boolean { return this.authService.hasSchoolModule(); }
  get hasCoachingModule(): boolean { return this.authService.hasCoachingModule(); }
  get hasHostelModule(): boolean { return this.authService.hasHostelModule(); }
  get hasLibraryModule(): boolean { return this.authService.hasLibraryModule(); }
  get hasTransportModule(): boolean { return this.authService.hasTransportModule(); }

  get dialogTitle(): string {
    if (this.hasSchoolModule && this.hasCoachingModule) {
      return 'School & Coaching Fee Heads & Fee Matrix';
    } else if (this.hasCoachingModule) {
      return 'Coaching Fee Heads & Fee Matrix';
    } else {
      return 'School Fee Heads & Fee Matrix';
    }
  }

  get dialogSubtitle(): string {
    if (this.hasSchoolModule && this.hasCoachingModule) {
      return 'Configure universal fee heads & assign class/batch-wise fee schedules for Schools, Coaching, or Integrated dual models.';
    } else if (this.hasCoachingModule) {
      return 'Configure coaching fee heads & assign batch-wise monthly tuition, test series and module fees.';
    } else {
      return 'Configure school fee heads & assign class-wise monthly tuition, term-wise and annual fee structures.';
    }
  }

  feeHeads: FeeHead[] = [];
  filteredFeeHeads: FeeHead[] = [];
  headSearchQuery = '';
  schoolClasses: SchoolClassDto[] = [];
  batches: BatchDto[] = [];

  targetType: 'class' | 'batch' = 'batch';
  selectedClassId?: string;
  selectedBatchId?: string;
  batchClassFilter: string = '';

  coachingScope: 'single' | 'combined' = 'single';

  get schoolOnlyClasses(): SchoolClassDto[] {
    return (this.schoolClasses || []).filter(c => c.academicScope !== 'Coaching');
  }

  get coachingEligibleClasses(): SchoolClassDto[] {
    return (this.schoolClasses || []).filter(c => c.academicScope !== 'School');
  }

  isCombinedBatch(b: any): boolean {
    if (!b?.classId) return true;
    return !!(b?.name && (
      b.name.match(/class\s*\d+.*(?:to|-).*\d+/i) ||
      b.name.toLowerCase().includes('combined') ||
      b.name.toLowerCase().includes('multi-class') ||
      b.name.toLowerCase().includes('foundation')
    ));
  }

  get singleClassBatches(): BatchDto[] {
    return (this.batches || []).filter(b => !this.isCombinedBatch(b));
  }

  get combinedBatches(): BatchDto[] {
    return (this.batches || []).filter(b => this.isCombinedBatch(b));
  }

  get filteredBatches(): BatchDto[] {
    if (!this.batchClassFilter) return this.batches;
    // Combined/multi-class batches have no classId or cover range — always show them regardless of filter
    return (this.batches || []).filter(b => this.isCombinedBatch(b) || b.classId === this.batchClassFilter);
  }

  get filteredSingleBatches(): BatchDto[] {
    const singles = this.singleClassBatches;
    if (!this.batchClassFilter) return singles;
    return singles.filter(b => b.classId === this.batchClassFilter);
  }

  setCoachingScope(scope: 'single' | 'combined'): void {
    this.coachingScope = scope;
    this.selectedBatchId = '';
    this.matrixRows = [];
    this.batchClassFilter = '';
    if (scope === 'single' && this.filteredSingleBatches.length > 0) {
      this.selectedBatchId = this.filteredSingleBatches[0].id;
      this.loadStructureForSelection();
    } else if (scope === 'combined' && this.combinedBatches.length > 0) {
      this.selectedBatchId = this.combinedBatches[0].id;
      this.loadStructureForSelection();
    }
  }

  onBatchClassFilterChange(): void {
    const list = this.filteredBatches;
    if (list.length > 0) {
      if (!list.some(b => b.id === this.selectedBatchId)) {
        this.selectedBatchId = list[0].id;
        this.loadStructureForSelection();
      }
    } else {
      this.selectedBatchId = '';
      this.matrixRows = [];
    }
  }

  getSelectedBatch(): BatchDto | undefined {
    return this.batches.find(b => b.id === this.selectedBatchId);
  }

  getSelectedBatchClassName(): string {
    const b = this.getSelectedBatch();
    return b?.className || '';
  }

  headForm!: FormGroup;
  savingHead = false;
  seedingPresets = false;

  matrixRows: Array<{
    id?: string;
    feeHeadId: string;
    feeHeadName: string;
    feeHeadCode: string;
    category: string;
    frequency: string;
    amount: number;
    applicableMonth: number | null;
    isActive: boolean;
    applicableTo?: string;
  }> = [];

  totalMonthlyAmount: number = 0;
  totalAnnualExtras: number = 0;
  savingMatrix = false;

  policyForm!: FormGroup;
  savingPolicy = false;

  constructor(
    private fb: FormBuilder,
    private feesService: FeesService,
    private batchesService: BatchesService,
    private schoolService: SchoolService,
    private confirmDialog: ConfirmDialogService,
    public settingsService: QuickSettingsService,
    private dialogRef: MatDialogRef<FeeMasterDialogComponent>
  ) {}

  ngOnInit(): void {
    this.initHeadForm();
    this.initPolicyForm();
    this.loadFeeHeads();
    this.loadClassesAndBatches();
  }

  initPolicyForm(): void {
    this.policyForm = this.fb.group({
      admissionCutoffDay: [this.settingsService.admissionCutoffDay() || 20, [Validators.required, Validators.min(1), Validators.max(28)]],
      admissionRolloverPolicy: [this.settingsService.admissionRolloverPolicy() || 'NextMonthFull', Validators.required],
      financialYearStartMonth: [this.settingsService.financialYearStartMonth() || 4, Validators.required]
    });
  }

  onSavePolicy(): void {
    if (this.policyForm.invalid) return;
    this.savingPolicy = true;
    const { admissionCutoffDay, admissionRolloverPolicy, financialYearStartMonth } = this.policyForm.value;
    this.settingsService.updateBillingCutoffSettings(Number(admissionCutoffDay), admissionRolloverPolicy, Number(financialYearStartMonth)).subscribe({
      next: () => {
        this.savingPolicy = false;
        this.confirmDialog.alert(
          'Billing Policy Saved',
          `Admission cutoff day successfully set to Day ${admissionCutoffDay} of each month. Invoicing engine and student fee card passbook are now active with this policy.`,
          'success'
        );
      },
      error: (err) => {
        this.savingPolicy = false;
        this.confirmDialog.alert('Save Failed', err?.error?.message || 'Failed to update billing policies.', 'danger');
      }
    });
  }

  getDefaultApplicableTo(): string {
    if (this.hasSchoolModule && this.hasCoachingModule) return 'Both';
    if (this.hasCoachingModule) return 'Coaching';
    return 'School';
  }

  initHeadForm(): void {
    this.headForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      category: ['Academic', Validators.required],
      frequency: ['Monthly', Validators.required],
      applicableTo: [this.getDefaultApplicableTo(), Validators.required],
      description: [''],
      sortOrder: [10]
    });
  }

  resetHeadForm(): void {
    this.headForm.reset({
      category: 'Academic',
      frequency: 'Monthly',
      applicableTo: this.getDefaultApplicableTo(),
      sortOrder: 10
    });
  }

  loadFeeHeads(): void {
    this.feesService.getFeeHeads(true).subscribe({
      next: (heads) => {
        this.feeHeads = heads || [];
        this.filterFeeHeadsMaster();
        if (this.hasActiveSelection()) {
          this.loadStructureForSelection();
        }
      },
      error: (err) => console.error('Failed to load fee heads', err)
    });
  }

  filterFeeHeadsMaster(): void {
    const q = (this.headSearchQuery || '').trim().toLowerCase();

    let list = this.feeHeads.filter(h => {
      // 1. School vs Coaching scope
      const scope = h.applicableTo || 'Both';
      if (!this.hasSchoolModule && scope === 'School') return false;
      if (!this.hasCoachingModule && scope === 'Coaching') return false;

      // 2. Hostel module restriction
      if (!this.hasHostelModule && (h.category === 'Residential' || h.code === 'HOSTEL' || h.code === 'MESS')) return false;

      // 3. Transport module restriction
      if (!this.hasTransportModule && (h.category === 'Transport' || h.code === 'TRANS')) return false;

      // 4. Library module restriction
      if (!this.hasLibraryModule && h.code === 'LIB') return false;

      return true;
    });

    if (q) {
      list = list.filter(h =>
        (h.name && h.name.toLowerCase().includes(q)) ||
        (h.code && h.code.toLowerCase().includes(q)) ||
        (h.category && h.category.toLowerCase().includes(q)) ||
        (h.frequency && h.frequency.toLowerCase().includes(q)) ||
        (h.applicableTo && h.applicableTo.toLowerCase().includes(q)) ||
        (h.description && h.description.toLowerCase().includes(q))
      );
    }
    this.filteredFeeHeads = list;
  }

  clearHeadSearch(): void {
    this.headSearchQuery = '';
    this.filterFeeHeadsMaster();
  }

  loadClassesAndBatches(): void {
    if (this.hasSchoolModule) {
      this.schoolService.getClasses(false).subscribe({
        next: (classes) => {
          this.schoolClasses = classes || [];
          this.determineDefaultTarget();
        },
        error: (err) => console.error('Failed to load school classes', err)
      });
    } else {
      this.schoolClasses = [];
    }

    if (this.hasCoachingModule) {
      this.batchesService.getBatches().subscribe({
        next: (batches) => {
          this.batches = batches || [];
          this.determineDefaultTarget();
        },
        error: (err) => console.error('Failed to load batches', err)
      });
    } else {
      this.batches = [];
    }

    this.determineDefaultTarget();
  }

  determineDefaultTarget(): void {
    if (!this.hasSchoolModule && this.hasCoachingModule) {
      this.targetType = 'batch';
      if (!this.selectedBatchId && this.batches.length > 0) {
        this.selectedBatchId = this.batches[0].id;
      }
    } else if (this.hasSchoolModule && !this.hasCoachingModule) {
      this.targetType = 'class';
      if (!this.selectedClassId && this.schoolOnlyClasses.length > 0) {
        this.selectedClassId = this.schoolOnlyClasses[0].id;
      }
    } else {
      // Both modules active
      if (this.targetType === 'class' && this.selectedClassId) return;
      if (this.targetType === 'batch' && this.selectedBatchId) return;

      if (this.batches.length > 0 && this.schoolClasses.length === 0) {
        this.targetType = 'batch';
        this.selectedBatchId = this.batches[0].id;
      } else if (this.schoolClasses.length > 0 && this.batches.length === 0) {
        this.targetType = 'class';
        this.selectedClassId = this.schoolOnlyClasses.length > 0 ? this.schoolOnlyClasses[0].id : this.schoolClasses[0].id;
      } else if (this.batches.length > 0) {
        this.targetType = 'batch';
        this.selectedBatchId = this.batches[0].id;
      } else if (this.schoolClasses.length > 0) {
        this.targetType = 'class';
        this.selectedClassId = this.schoolOnlyClasses.length > 0 ? this.schoolOnlyClasses[0].id : this.schoolClasses[0].id;
      }
    }

    if (this.hasActiveSelection()) {
      this.loadStructureForSelection();
    }
  }

  setTargetType(type: 'class' | 'batch'): void {
    if (this.targetType === type) return;
    this.targetType = type;

    if (type === 'class') {
      if (!this.selectedClassId && this.schoolOnlyClasses.length > 0) {
        this.selectedClassId = this.schoolOnlyClasses[0].id;
      }
    } else {
      if (!this.selectedBatchId) {
        if (this.coachingScope === 'combined' && this.combinedBatches.length > 0) {
          this.selectedBatchId = this.combinedBatches[0].id;
        } else if (this.filteredSingleBatches.length > 0) {
          this.selectedBatchId = this.filteredSingleBatches[0].id;
        } else if (this.batches.length > 0) {
          this.selectedBatchId = this.batches[0].id;
        }
      }
    }

    this.loadStructureForSelection();
  }

  hasActiveSelection(): boolean {
    return (this.targetType === 'class' && !!this.selectedClassId) ||
           (this.targetType === 'batch' && !!this.selectedBatchId);
  }

  loadStructureForSelection(): void {
    const classId = this.targetType === 'class' ? this.selectedClassId : undefined;
    const batchId = this.targetType === 'batch' ? this.selectedBatchId : undefined;
    if (!classId && !batchId) return;

    this.feesService.getClassFeeStructures(classId, batchId).subscribe({
      next: (structures) => {
        const structMap = new Map<string, ClassFeeStructureItem>();
        structures.forEach(s => structMap.set(s.feeHeadId, s));

        // Filter fee heads relevant to the selected mode (School Class vs Coaching Batch) and active modules
        const relevantHeads = this.feeHeads.filter(head => {
          const scope = head.applicableTo || 'Both';
          if (!this.hasSchoolModule && scope === 'School') return false;
          if (!this.hasCoachingModule && scope === 'Coaching') return false;
          if (!this.hasHostelModule && (head.category === 'Residential' || head.code === 'HOSTEL' || head.code === 'MESS')) return false;
          if (!this.hasTransportModule && (head.category === 'Transport' || head.code === 'TRANS')) return false;
          if (!this.hasLibraryModule && head.code === 'LIB') return false;

          if (this.targetType === 'class') {
            return scope === 'School' || scope === 'Both';
          } else {
            return scope === 'Coaching' || scope === 'Both';
          }
        });

        // Build a row for relevant fee heads
        this.matrixRows = relevantHeads.map(head => {
          const existing = structMap.get(head.id);
          let defaultAmt = 0;
          let defaultActive = false;

          if (existing) {
            defaultAmt = existing.isActive ? existing.amount : 0;
            defaultActive = existing.isActive;
          } else {
            // Sensible defaults
            if (head.code === 'COACH') {
              if (this.targetType === 'batch') {
                const currentBatch = this.batches.find(b => b.id === this.selectedBatchId);
                defaultAmt = currentBatch?.standardMonthlyFee || 2000;
                defaultActive = true;
              } else {
                defaultAmt = 0;
                defaultActive = false;
              }
            } else if (head.code === 'TUI') {
              defaultAmt = 1500;
              defaultActive = this.targetType === 'class';
            } else if (head.code === 'COMP') {
              defaultAmt = 200;
              defaultActive = this.targetType === 'class';
            }
          }

          let appMonth: number | null = null;
          if (existing && existing.applicableMonth !== undefined) {
            appMonth = existing.applicableMonth;
          } else if (head.frequency === 'Annual' || head.frequency === 'OneTime') {
            appMonth = 4; // April default
          }

          return {
            id: existing?.id,
            feeHeadId: head.id,
            feeHeadName: head.name,
            feeHeadCode: head.code,
            category: head.category,
            frequency: head.frequency,
            amount: defaultAmt,
            applicableMonth: appMonth,
            isActive: defaultActive,
            applicableTo: head.applicableTo || 'Both'
          };
        });

        this.calculateTotals();
      },
      error: (err) => console.error('Failed to load structure', err)
    });
  }

  onRowActiveChange(row: any): void {
    if (!row.isActive) {
      row.amount = 0;
    }
    this.calculateTotals();
  }

  onAmountChange(row: any): void {
    const amt = Number(row.amount) || 0;
    if (amt > 0 && !row.isActive) {
      row.isActive = true;
    }
    this.calculateTotals();
  }

  calculateTotals(): void {
    let monthly = 0;
    let annual = 0;

    for (const r of this.matrixRows) {
      if (!r.isActive) continue;
      const amt = Number(r.amount) || 0;
      if (r.frequency === 'Monthly' || r.applicableMonth === null) {
        monthly += amt;
      } else {
        annual += amt;
      }
    }

    this.totalMonthlyAmount = monthly;
    this.totalAnnualExtras = annual;
  }

  onSaveHead(): void {
    if (this.headForm.invalid) return;
    this.savingHead = true;

    this.feesService.saveFeeHead(this.headForm.value).subscribe({
      next: () => {
        this.savingHead = false;
        this.resetHeadForm();
        this.loadFeeHeads();
        this.confirmDialog.alert('Fee Head Saved', 'Fee Head created/updated successfully.', 'success');
      },
      error: (err) => {
        this.savingHead = false;
        this.confirmDialog.alert('Save Failed', err?.error?.message || err?.error || 'Failed to save fee head', 'danger');
      }
    });
  }

  onDeactivateHead(head: FeeHead): void {
    this.confirmDialog.danger(
      'Deactivate Fee Head',
      `Are you sure you want to deactivate '${head.name}'?`,
      'Deactivate'
    ).subscribe((confirmed) => {
      if (confirmed) {
        this.feesService.deleteFeeHead(head.id).subscribe({
          next: () => {
            this.confirmDialog.alert('Deactivated', `'${head.name}' deactivated successfully.`, 'success');
            this.loadFeeHeads();
          },
          error: (err) => this.confirmDialog.alert('Deactivate Failed', err?.error?.message || err?.error || 'Failed to deactivate fee head', 'danger')
        });
      }
    });
  }

  seedStandardHeads(): void {
    this.seedingPresets = true;
    this.feesService.getFeeHeads(true).subscribe({
      next: (heads) => {
        this.feeHeads = heads;
        this.seedingPresets = false;
        this.confirmDialog.alert('Fee Catalog Synced', `Successfully loaded ${heads.length} fee heads from the database.`, 'success');
        if (this.hasActiveSelection()) {
          this.loadStructureForSelection();
        }
      },
      error: (err) => {
        this.seedingPresets = false;
        this.confirmDialog.alert('Sync Failed', err?.error?.message || 'Could not refresh fee heads from server', 'danger');
      }
    });
  }

  onSaveMatrix(): void {
    const classId = this.targetType === 'class' ? this.selectedClassId : undefined;
    const batchId = this.targetType === 'batch' ? this.selectedBatchId : undefined;
    if (!classId && !batchId) return;

    this.savingMatrix = true;

    const payload: SaveClassFeeStructureBatch = {
      classId: classId,
      batchId: batchId,
      items: this.matrixRows.map(r => ({
        id: r.id,
        classId: classId,
        batchId: batchId,
        feeHeadId: r.feeHeadId,
        amount: r.isActive ? (Number(r.amount) || 0) : 0,
        applicableMonth: r.applicableMonth,
        isActive: !!r.isActive
      }))
    };

    this.feesService.saveClassFeeStructures(payload).subscribe({
      next: () => {
        this.savingMatrix = false;
        const targetLabel = this.targetType === 'class' ? 'School Class' : 'Coaching Batch';
        this.confirmDialog.alert(
          'Fee Structure Saved',
          `${targetLabel} fee structure saved successfully!`,
          'success'
        );
        this.loadStructureForSelection();
      },
      error: (err) => {
        this.savingMatrix = false;
        this.confirmDialog.alert(
          'Save Failed',
          err?.error?.message || err?.error || 'Failed to save fee structure',
          'danger'
        );
      }
    });
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
