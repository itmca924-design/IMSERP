import { Component, OnInit } from '@angular/core';
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
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

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
            <h2 class="main-title">School & Coaching Fee Heads & Fee Matrix</h2>
            <p class="sub-title">Configure universal fee heads & assign class/batch-wise fee schedules for Schools, Coaching, or Integrated dual models.</p>
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
                    <mat-option value="Residential">
                      <div class="opt-content">
                        <div class="opt-header-row">
                          <span class="category-tag cat-residential">Residential</span>
                          <span>Hostel &amp; Mess</span>
                        </div>
                        <span class="opt-desc">Hostel room rent, food mess &amp; boarding facilities</span>
                      </div>
                    </mat-option>
                    <mat-option value="Transport">
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
              <table class="styled-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Fee Head Name</th>
                    <th>Category</th>
                    <th>Frequency</th>
                    <th>Description</th>
                    <th class="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let h of feeHeads">
                    <td><span class="code-pill">{{ h.code }}</span></td>
                    <td><strong>{{ h.name }}</strong></td>
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
                  <tr *ngIf="feeHeads.length === 0">
                    <td colspan="6" class="empty-state">No fee heads found. Click "Load Standard Fee Presets" above to auto-populate standard school & coaching heads.</td>
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
                <!-- Dual Switcher: shown when both or either exist -->
                <div class="target-toggle" *ngIf="schoolClasses.length > 0 && batches.length > 0">
                  <button type="button"
                          class="toggle-btn"
                          [class.active]="targetType === 'class'"
                          (click)="setTargetType('class')">
                    <mat-icon>school</mat-icon>
                    <span>School Class</span>
                    <span class="count-pill">{{ schoolClasses.length }}</span>
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
                <mat-form-field appearance="outline" class="select-target-full" *ngIf="targetType === 'class'">
                  <mat-label>Assign Fee For: School Class</mat-label>
                  <mat-select [(ngModel)]="selectedClassId" (selectionChange)="loadStructureForSelection()" panelClass="target-select-panel">
                    <mat-option *ngFor="let c of schoolClasses" [value]="c.id">
                      🏫 {{ c.name }} {{ c.code ? '(' + c.code + ')' : '' }}
                    </mat-option>
                  </mat-select>
                  <mat-icon matPrefix class="dropdown-prefix-icon" color="primary">school</mat-icon>
                </mat-form-field>

                <!-- Dropdown when targetType === 'batch' -->
                <mat-form-field appearance="outline" class="select-target-full" *ngIf="targetType === 'batch'">
                  <mat-label>Assign Fee For: Coaching Batch</mat-label>
                  <mat-select [(ngModel)]="selectedBatchId" (selectionChange)="loadStructureForSelection()" panelClass="target-select-panel">
                    <mat-option *ngFor="let b of batches" [value]="b.id">
                      🎯 {{ b.name }}{{ b.subject ? ' (' + b.subject + ')' : '' }}
                    </mat-option>
                  </mat-select>
                  <mat-icon matPrefix class="dropdown-prefix-icon" color="primary">groups</mat-icon>
                </mat-form-field>
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
                      <mat-checkbox [(ngModel)]="row.isActive" (change)="calculateTotals()" color="primary"></mat-checkbox>
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
                        <input matInput type="number" [(ngModel)]="row.amount" (input)="calculateTotals()" [disabled]="!row.isActive" min="0" />
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
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      min-width: 820px;
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
        border-bottom: 1px solid #cbd5e1;
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
  `]
})
export class FeeMasterDialogComponent implements OnInit {
  feeHeads: FeeHead[] = [];
  schoolClasses: SchoolClassDto[] = [];
  batches: BatchDto[] = [];

  targetType: 'class' | 'batch' = 'batch';
  selectedClassId?: string;
  selectedBatchId?: string;

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
  }> = [];

  totalMonthlyAmount: number = 0;
  totalAnnualExtras: number = 0;
  savingMatrix = false;

  constructor(
    private fb: FormBuilder,
    private feesService: FeesService,
    private batchesService: BatchesService,
    private schoolService: SchoolService,
    private confirmDialog: ConfirmDialogService,
    private dialogRef: MatDialogRef<FeeMasterDialogComponent>
  ) {}

  ngOnInit(): void {
    this.initHeadForm();
    this.loadFeeHeads();
    this.loadClassesAndBatches();
  }

  initHeadForm(): void {
    this.headForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      category: ['Academic', Validators.required],
      frequency: ['Monthly', Validators.required],
      description: [''],
      sortOrder: [10]
    });
  }

  resetHeadForm(): void {
    this.headForm.reset({
      category: 'Academic',
      frequency: 'Monthly',
      sortOrder: 10
    });
  }

  loadFeeHeads(): void {
    this.feesService.getFeeHeads(true).subscribe({
      next: (heads) => {
        this.feeHeads = heads;
        if (this.hasActiveSelection()) {
          this.loadStructureForSelection();
        }
      },
      error: (err) => console.error('Failed to load fee heads', err)
    });
  }

  loadClassesAndBatches(): void {
    this.schoolService.getClasses(false).subscribe({
      next: (classes) => {
        this.schoolClasses = classes || [];
        this.determineDefaultTarget();
      },
      error: (err) => console.error('Failed to load school classes', err)
    });

    this.batchesService.getBatches().subscribe({
      next: (batches) => {
        this.batches = batches || [];
        this.determineDefaultTarget();
      },
      error: (err) => console.error('Failed to load batches', err)
    });
  }

  determineDefaultTarget(): void {
    // If target already configured, don't overwrite
    if (this.targetType === 'class' && this.selectedClassId) return;
    if (this.targetType === 'batch' && this.selectedBatchId) return;

    if (this.schoolClasses.length > 0 && this.batches.length === 0) {
      this.targetType = 'class';
      this.selectedClassId = this.schoolClasses[0].id;
    } else if (this.batches.length > 0 && this.schoolClasses.length === 0) {
      this.targetType = 'batch';
      this.selectedBatchId = this.batches[0].id;
    } else if (this.schoolClasses.length > 0 && this.batches.length > 0) {
      // Integrated dual model: default to School Class or keep batch if selected
      if (!this.selectedClassId && !this.selectedBatchId) {
        this.targetType = 'class';
        this.selectedClassId = this.schoolClasses[0].id;
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
      if (!this.selectedClassId && this.schoolClasses.length > 0) {
        this.selectedClassId = this.schoolClasses[0].id;
      }
    } else {
      if (!this.selectedBatchId && this.batches.length > 0) {
        this.selectedBatchId = this.batches[0].id;
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

        // Build a row for every fee head
        this.matrixRows = this.feeHeads.map(head => {
          const existing = structMap.get(head.id);
          let defaultAmt = 0;
          let defaultActive = false;

          if (existing) {
            defaultAmt = existing.amount;
            defaultActive = existing.isActive;
          } else {
            // Sensible defaults
            if (head.code === 'TUI') {
              if (this.targetType === 'batch') {
                const currentBatch = this.batches.find(b => b.id === this.selectedBatchId);
                defaultAmt = currentBatch?.standardMonthlyFee || 2000;
              } else {
                defaultAmt = 1500;
              }
              defaultActive = true;
            } else if (head.code === 'COACH') {
              defaultAmt = this.targetType === 'batch' ? 1500 : 0;
              defaultActive = this.targetType === 'batch';
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
            isActive: defaultActive
          };
        });

        this.calculateTotals();
      },
      error: (err) => console.error('Failed to load structure', err)
    });
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
        amount: Number(r.amount) || 0,
        applicableMonth: r.applicableMonth,
        isActive: r.isActive
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
