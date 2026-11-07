import { Component, Inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

export interface MasterImportDialogData {
  type: 'classes' | 'fee-heads';
  title: string;
  subtitle: string;
  icon: string;
  templateFileName: string;
  existingItems?: { name: string; code?: string }[];
}

@Component({
  selector: 'app-master-excel-import-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatTooltipModule
  ],
  template: `
    <div class="import-dialog-container">
      <!-- Signature Light-Blue Gradient Header (Strict ERP Standard) -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>{{ data.icon || 'upload_file' }}</mat-icon>
          </div>
          <div class="header-titles">
            <h2 class="main-title">{{ data.title }}</h2>
            <p class="subtitle">
              {{ data.subtitle }} &bull; <strong>Multi-Tenant Bulk Onboarding</strong>
            </p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="dialogRef.close()" matTooltip="Close Window">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Dialog Body Content (Single Master Scrollbar) -->
      <div class="dialog-body">
        <!-- Step 1: Download Standard Template Banner -->
        <div class="template-step-banner">
          <div class="step-info">
            <div class="step-badge">STEP 1</div>
            <div class="step-text">
              <h4>Download Standard Spreadsheet Template</h4>
              <p>Download the pre-formatted Excel / CSV template aligned with your ERP database catalog.</p>
            </div>
          </div>
          <button mat-stroked-button color="primary" class="download-tpl-btn" (click)="downloadTemplate()" [disabled]="downloadingTemplate">
            <mat-icon>{{ downloadingTemplate ? 'hourglass_empty' : 'download' }}</mat-icon>
            <span>Download Template (.csv)</span>
          </button>
        </div>

        <!-- Section Rule Alert for Classes -->
        <div *ngIf="data.type === 'classes'" class="classes-rule-notice">
          <mat-icon class="notice-icon">verified</mat-icon>
          <div class="notice-text">
            <strong>Automatic Dual Section Setup:</strong> Every academic class imported will automatically have 
            <span class="highlight-tag">Section A</span> and <span class="highlight-tag">Section B</span> 
            initialized with 45-seat capacity as per standard school guidelines.
          </div>
        </div>

        <!-- Step 2: Upload Dropzone -->
        <div class="upload-zone" [class.dragover]="isDragOver" (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onDrop($event)">
          <input #fileInput type="file" accept=".xlsx,.csv" (change)="onFileSelected($event)" style="display: none;" />
          
          <div class="drop-content" *ngIf="!selectedFile">
            <div class="upload-icon-circle">
              <mat-icon>cloud_upload</mat-icon>
            </div>
            <h3>Drag &amp; drop Excel or CSV spreadsheet here</h3>
            <p class="upload-hint">Supports Microsoft Excel (.xlsx) and Comma-Separated (.csv) files</p>
            <button mat-flat-button color="primary" class="browse-btn" (click)="fileInput.click()">
              <mat-icon>folder_open</mat-icon>
              <span>Browse Computer</span>
            </button>
          </div>

          <!-- File Chosen State -->
          <div class="file-loaded-bar" *ngIf="selectedFile">
            <div class="file-meta">
              <mat-icon class="file-type-icon">description</mat-icon>
              <div class="file-details">
                <span class="file-name">{{ selectedFile.name }}</span>
                <span class="file-size">{{ (selectedFile.size / 1024).toFixed(1) }} KB</span>
              </div>
            </div>
            <div class="file-actions">
              <button mat-button color="primary" type="button" (click)="replaceFile(fileInput)">
                <mat-icon>refresh</mat-icon> Replace
              </button>
              <button mat-button color="warn" type="button" (click)="clearFile(fileInput)">
                <mat-icon>delete</mat-icon> Remove
              </button>
            </div>
          </div>
        </div>

        <!-- Strict Single Loader Rule -->
        <div *ngIf="analyzing || importing" class="single-loader-container">
          <mat-progress-bar mode="indeterminate" color="primary"></mat-progress-bar>
          <p class="loader-label">
            {{ analyzing ? 'Inspecting rows & verifying against database for duplicate prevention...' : 'Executing bulk import & saving records...' }}
          </p>
        </div>

        <!-- Step 3: Instant Live Validation Preview -->
        <div *ngIf="previewData && !analyzing" class="preview-section">
          <!-- Summary Metrics Cards -->
          <div class="preview-metrics-deck">
            <div class="metric-pill total">
              <span class="m-val">{{ previewData.totalRows }}</span>
              <span class="m-lbl">Total Rows</span>
            </div>
            <div class="metric-pill valid">
              <mat-icon>check_circle</mat-icon>
              <span class="m-val">{{ newRowsCount }}</span>
              <span class="m-lbl">New Ready to Import</span>
            </div>
            <div class="metric-pill existing" *ngIf="existingRowsCount > 0">
              <mat-icon>storage</mat-icon>
              <span class="m-val">{{ existingRowsCount }}</span>
              <span class="m-lbl">Already in Database</span>
            </div>
            <div class="metric-pill error" *ngIf="previewData.errorRows > 0">
              <mat-icon>error_outline</mat-icon>
              <span class="m-val">{{ previewData.errorRows }}</span>
              <span class="m-lbl">Validation Errors</span>
            </div>
          </div>

          <!-- Upsert Option Bar & Duplicate Prevention Guard -->
          <form [formGroup]="importOptionsForm" class="options-bar">
            <mat-slide-toggle formControlName="updateExisting" color="primary">
              <span class="toggle-text">Update existing records if found in your institute database</span>
            </mat-slide-toggle>
          </form>

          <!-- Duplicate Prevention Guidance Banner -->
          <div class="duplicate-notice-banner" *ngIf="existingRowsCount > 0">
            <mat-icon class="banner-icon">{{ isUpdateMode ? 'published_with_changes' : 'shield' }}</mat-icon>
            <div class="banner-text" *ngIf="!isUpdateMode">
              <strong>Duplicate Prevention Active:</strong> {{ existingRowsCount }} record(s) already exist in your database and will be <u>safely skipped</u> to prevent duplicates. Turn on the toggle above only if you wish to overwrite them.
            </div>
            <div class="banner-text update-active" *ngIf="isUpdateMode">
              <strong>Update Mode Active:</strong> {{ existingRowsCount }} existing record(s) will be updated with template properties. No duplicate rows will be created.
            </div>
          </div>

          <!-- Preview Grid Search & Filter Controls Toolbar -->
          <div class="preview-controls-bar">
            <!-- Search Field -->
            <div class="search-input-box">
              <mat-icon class="search-icon">search</mat-icon>
              <input 
                type="text" 
                [formControl]="previewSearchControl" 
                placeholder="Search preview rows..." 
                class="search-input-field" />
              <button 
                type="button" 
                *ngIf="previewSearchControl.value" 
                (click)="previewSearchControl.setValue('')" 
                class="clear-btn" 
                matTooltip="Clear search">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <!-- Status Filter Chips -->
            <div class="filter-chips-deck">
              <button 
                type="button" 
                class="filter-chip" 
                [class.chip-active]="statusFilterControl.value === 'All'" 
                (click)="setStatusFilter('All')">
                All ({{ previewData.totalRows }})
              </button>
              <button 
                type="button" 
                class="filter-chip chip-new" 
                [class.chip-active]="statusFilterControl.value === 'New'" 
                (click)="setStatusFilter('New')" 
                *ngIf="newRowsCount > 0">
                <mat-icon>add_circle</mat-icon>
                <span>New Ready ({{ newRowsCount }})</span>
              </button>
              <button 
                type="button" 
                class="filter-chip chip-existing" 
                [class.chip-active]="statusFilterControl.value === 'Existing'" 
                (click)="setStatusFilter('Existing')" 
                *ngIf="existingRowsCount > 0">
                <mat-icon>storage</mat-icon>
                <span>Already in DB ({{ existingRowsCount }})</span>
              </button>
              <button 
                type="button" 
                class="filter-chip chip-error" 
                [class.chip-active]="statusFilterControl.value === 'Error'" 
                (click)="setStatusFilter('Error')" 
                *ngIf="previewData.errorRows > 0">
                <mat-icon>warning</mat-icon>
                <span>Errors ({{ previewData.errorRows }})</span>
              </button>
            </div>
          </div>

          <!-- Mobile Swipe Hint -->
          <div class="mobile-swipe-hint">
            <mat-icon>swipe</mat-icon>
            <span>Swipe sideways to view full columns &bull; तालिका दाएं-बाएं स्क्रॉल करें</span>
          </div>

          <!-- Responsive Table Preview with Sortable Column Headers -->
          <div class="table-responsive preview-table-container">
            <table class="preview-table">
              <thead>
                <tr>
                  <th (click)="toggleSort('rowNumber')" class="sortable-header" style="width: 50px; text-align: center;" matTooltip="Sort by row number">
                    <div class="header-cell-inner center">
                      <span>#</span>
                      <mat-icon class="sort-icon">{{ sortColumn === 'rowNumber' ? (sortAscending ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}</mat-icon>
                    </div>
                  </th>
                  <th (click)="toggleSort('name')" class="sortable-header" matTooltip="Sort by name">
                    <div class="header-cell-inner">
                      <span>{{ data.type === 'classes' ? 'Class Name' : 'Fee Head Name' }}</span>
                      <mat-icon class="sort-icon">{{ sortColumn === 'name' ? (sortAscending ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}</mat-icon>
                    </div>
                  </th>
                  <th (click)="toggleSort('code')" class="sortable-header" style="width: 85px;" matTooltip="Sort by code">
                    <div class="header-cell-inner">
                      <span>Code</span>
                      <mat-icon class="sort-icon">{{ sortColumn === 'code' ? (sortAscending ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}</mat-icon>
                    </div>
                  </th>
                  <th (click)="toggleSort('scope')" class="sortable-header" matTooltip="Sort by scope / category">
                    <div class="header-cell-inner">
                      <span>{{ data.type === 'classes' ? 'Scope' : 'Category / Frequency' }}</span>
                      <mat-icon class="sort-icon">{{ sortColumn === 'scope' ? (sortAscending ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}</mat-icon>
                    </div>
                  </th>
                  <th *ngIf="data.type === 'classes'">Sections Initialized</th>
                  <th (click)="toggleSort('status')" class="sortable-header" style="width: 130px; white-space: nowrap;" matTooltip="Sort by status">
                    <div class="header-cell-inner">
                      <span>Status</span>
                      <mat-icon class="sort-icon">{{ sortColumn === 'status' ? (sortAscending ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}</mat-icon>
                    </div>
                  </th>
                  <th>Action / Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of pagedItems" [class.row-error]="!item.isValid" [class.row-existing]="item.status === 'Existing'">
                  <td class="row-num" style="text-align: center;">{{ item.rowNumber }}</td>
                  <td class="primary-val">
                    <strong>{{ item.className || item.feeHeadName }}</strong>
                  </td>
                  <td>
                    <code>{{ item.classCode || item.shortCode || '—' }}</code>
                  </td>
                  <td>
                    <span class="scope-chip">{{ item.academicScope || (item.category + ' &bull; ' + item.frequency) }}</span>
                  </td>
                  <td *ngIf="data.type === 'classes'">
                    <span class="section-badge">Section A</span>
                    <span class="section-badge">Section B</span>
                  </td>
                  <td style="white-space: nowrap;">
                    <span class="status-badge" [ngClass]="item.status?.toLowerCase()">
                      <mat-icon *ngIf="item.status === 'New'">add_circle</mat-icon>
                      <mat-icon *ngIf="item.status === 'Existing'">storage</mat-icon>
                      <mat-icon *ngIf="item.status === 'Error'">warning</mat-icon>
                      <span>{{ item.status === 'Existing' ? 'Already in DB' : item.status }}</span>
                    </span>
                  </td>
                  <td class="error-col">
                    <span *ngIf="item.status === 'Error'" class="error-text" [matTooltip]="item.errorMessage">
                      {{ item.errorMessage }}
                    </span>
                    <span *ngIf="item.status === 'Existing'" class="existing-note-text">
                      {{ isUpdateMode ? 'Will be updated' : 'Will be skipped (no duplicate)' }}
                    </span>
                    <span *ngIf="item.status === 'New' && item.isValid" class="success-text">
                      Valid &amp; New
                    </span>
                  </td>
                </tr>
                <tr *ngIf="filteredAndSortedItems.length === 0">
                  <td [attr.colspan]="data.type === 'classes' ? 7 : 6" class="no-records-cell" style="text-align: center; padding: 24px;">
                    <div class="empty-filter-wrap">
                      <mat-icon>search_off</mat-icon>
                      <span>No preview records match your search or filter.</span>
                      <button type="button" class="reset-filter-btn" (click)="resetPreviewFilter()">Reset Filters</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination Bar -->
          <div class="dialog-pagination-bar" *ngIf="filteredAndSortedItems.length > 0">
            <div class="pagination-summary">
              Showing <strong>{{ paginationStart }} – {{ paginationEnd }}</strong> of <strong>{{ filteredAndSortedItems.length }}</strong> rows
              <span *ngIf="filteredAndSortedItems.length !== previewData.totalRows" class="filter-count-note">
                (filtered from {{ previewData.totalRows }} total)
              </span>
            </div>
            <div class="pagination-actions">
              <label class="page-size-wrap">
                <span>Rows:</span>
                <select [value]="pageSize" (change)="onPageSizeChange($event)" class="page-size-select">
                  <option [value]="5">5</option>
                  <option [value]="10">10</option>
                  <option [value]="25">25</option>
                  <option [value]="50">50</option>
                  <option [value]="999">All</option>
                </select>
              </label>
              <button 
                type="button" 
                class="page-nav-btn" 
                [disabled]="pageIndex === 0" 
                (click)="goToPage(pageIndex - 1)" 
                matTooltip="Previous Page">
                <mat-icon>chevron_left</mat-icon>
              </button>
              <span class="page-number-display">Page {{ pageIndex + 1 }} of {{ totalPages }}</span>
              <button 
                type="button" 
                class="page-nav-btn" 
                [disabled]="pageIndex >= totalPages - 1" 
                (click)="goToPage(pageIndex + 1)" 
                matTooltip="Next Page">
                <mat-icon>chevron_right</mat-icon>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Dialog Footer Actions -->
      <div class="dialog-actions">
        <button mat-button class="cancel-btn" (click)="dialogRef.close()" [disabled]="importing">
          Cancel
        </button>
        <button 
          mat-flat-button 
          color="primary" 
          class="confirm-import-btn"
          [disabled]="!canConfirmImport || importing || analyzing"
          (click)="confirmImport()">
          <mat-icon>{{ importing ? 'hourglass_empty' : 'cloud_done' }}</mat-icon>
          <span *ngIf="isUpdateMode">
            Confirm &amp; Import / Update {{ importableCount }} Records
          </span>
          <span *ngIf="!isUpdateMode">
            Confirm &amp; Import {{ newRowsCount }} New Records
            <span *ngIf="existingRowsCount > 0" class="sub-btn-note">({{ existingRowsCount }} skipped)</span>
          </span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .import-dialog-container {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      width: 100%;
      box-sizing: border-box;
      background: #ffffff;
      overflow: hidden;
    }

    /* Strict Light-Blue Gradient Header Rule */
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;

      .header-left {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .header-icon-box {
        width: 44px;
        height: 44px;
        background: #2563eb;
        color: #ffffff;
        border-radius: 10px;
        box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;

        mat-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
        }
      }

      .header-titles {
        .main-title {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.2;
        }
        .subtitle {
          margin: 4px 0 0;
          font-size: 0.82rem;
          color: #3b82f6;

          strong {
            color: #1e40af;
            font-weight: 600;
          }
        }
      }

      .close-btn {
        width: 34px;
        height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        color: #64748b;
        background: transparent;
        border: none;
        padding: 0;
        cursor: pointer;
        transition: all 0.2s ease;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
          line-height: 20px;
        }

        &:hover {
          background: rgba(30, 58, 138, 0.08);
          color: #1e293b;
        }
      }
    }

    /* Single Scrollbar on Dialog Body */
    .dialog-body {
      padding: 20px 24px;
      overflow-y: auto;
      overflow-x: hidden;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;

      &::-webkit-scrollbar {
        width: 6px;
      }
      &::-webkit-scrollbar-track {
        background: #f8fafc;
      }
      &::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
      }
      &::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
    }

    /* Template Step Banner */
    .template-step-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 18px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 12px;
      gap: 16px;

      .step-info {
        display: flex;
        align-items: center;
        gap: 14px;

        .step-badge {
          background: #3b82f6;
          color: #ffffff;
          font-size: 0.7rem;
          font-weight: 800;
          padding: 4px 8px;
          border-radius: 6px;
          letter-spacing: 0.05em;
        }

        .step-text {
          h4 {
            margin: 0;
            font-size: 0.92rem;
            font-weight: 700;
            color: #0f172a;
          }
          p {
            margin: 2px 0 0;
            font-size: 0.78rem;
            color: #64748b;
          }
        }
      }

      .download-tpl-btn {
        flex-shrink: 0;
        font-weight: 600;
        border-color: #93c5fd;
        color: #1d4ed8;
      }
    }

    /* Classes Dual Section Alert */
    .classes-rule-notice {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      color: #1e40af;
      font-size: 0.82rem;
      line-height: 1.4;

      .notice-icon {
        color: #2563eb;
        font-size: 20px;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }

      .highlight-tag {
        display: inline-block;
        padding: 1px 7px;
        background: #dbeafe;
        border: 1px solid #93c5fd;
        border-radius: 4px;
        font-weight: 700;
        color: #1d4ed8;
        margin: 0 2px;
      }
    }

    /* Dropzone */
    .upload-zone {
      border: 2px dashed #94a3b8;
      border-radius: 14px;
      background: #fdfefe;
      padding: 22px;
      text-align: center;
      transition: all 0.2s ease;
      cursor: pointer;

      &:hover, &.dragover {
        border-color: #2563eb;
        background: #f0f7ff;
      }

      .upload-icon-circle {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #dbeafe;
        color: #2563eb;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 10px;

        mat-icon {
          font-size: 26px;
          width: 26px;
          height: 26px;
        }
      }

      h3 {
        margin: 0;
        font-size: 0.96rem;
        font-weight: 700;
        color: #1e293b;
      }

      .upload-hint {
        margin: 4px 0 12px;
        font-size: 0.78rem;
        color: #64748b;
      }

      .browse-btn {
        font-weight: 600;
        border-radius: 8px;
      }
    }

    .file-loaded-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 12px 16px;
      border-radius: 10px;

      .file-meta {
        display: flex;
        align-items: center;
        gap: 12px;

        .file-type-icon {
          color: #0284c7;
          font-size: 28px;
          width: 28px;
          height: 28px;
        }

        .file-details {
          display: flex;
          flex-direction: column;
          text-align: left;

          .file-name {
            font-size: 0.9rem;
            font-weight: 700;
            color: #0f172a;
          }
          .file-size {
            font-size: 0.74rem;
            color: #64748b;
          }
        }
      }
    }

    /* Single Loader Rule */
    .single-loader-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      background: #f8fafc;
      border-radius: 8px;

      .loader-label {
        margin: 0;
        font-size: 0.8rem;
        color: #2563eb;
        font-weight: 600;
        text-align: center;
      }
    }

    /* Preview Section */
    .preview-section {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .preview-metrics-deck {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;

        .metric-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 600;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
            line-height: 18px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .m-val {
            font-size: 0.96rem;
            font-weight: 800;
          }

          &.total {
            background: #f1f5f9;
            color: #334155;
            border: 1px solid #cbd5e1;
          }
          &.valid {
            background: #ecfdf5;
            color: #047857;
            border: 1px solid #a7f3d0;
          }
          &.existing {
            background: #fffbeb;
            color: #b45309;
            border: 1px solid #fde68a;
          }
          &.error {
            background: #fef2f2;
            color: #b91c1c;
            border: 1px solid #fecaca;
          }
        }
      }

      .options-bar {
        padding: 4px 6px;
        .toggle-text {
          font-size: 0.84rem;
          font-weight: 600;
          color: #334155;
        }
      }

      /* Duplicate Notice Banner */
      .duplicate-notice-banner {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        background: #fffbeb;
        border: 1px solid #fef3c7;
        border-left: 4px solid #f59e0b;
        border-radius: 8px;
        color: #92400e;
        font-size: 0.8rem;
        line-height: 1.4;

        .banner-icon {
          color: #d97706;
          font-size: 20px;
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }

        .update-active {
          color: #1e40af;
        }
      }

      /* Preview Controls Bar: Search & Status Filters */
      .preview-controls-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin: 4px 0 2px;
        flex-wrap: wrap;
        width: 100% !important;
        box-sizing: border-box !important;
      }

      .search-input-box {
        display: flex;
        align-items: center;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 0 10px;
        height: 38px;
        flex: 1;
        min-width: 0 !important;
        max-width: 420px;
        width: 100%;
        box-sizing: border-box !important;
        transition: all 0.2s ease;

        &:focus-within {
          border-color: #2563eb;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .search-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #64748b;
          margin-right: 6px;
        }

        .search-input-field {
          border: none;
          outline: none;
          background: transparent;
          font-size: 0.85rem;
          color: #0f172a;
          width: 100%;
          min-width: 0 !important;
          padding: 4px 0;
          box-sizing: border-box;

          &::placeholder {
            color: #94a3b8;
            font-size: 0.82rem;
          }
        }

        .clear-btn {
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
          color: #94a3b8;
          display: flex;
          align-items: center;

          &:hover {
            color: #ef4444;
          }

          mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
          }
        }
      }

      .filter-chips-deck {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .filter-chip {
        height: 32px;
        padding: 0 12px;
        border-radius: 20px;
        font-size: 0.76rem;
        font-weight: 600;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        color: #475569;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        transition: all 0.15s ease;

        mat-icon {
          font-size: 15px;
          width: 15px;
          height: 15px;
          line-height: 15px;
        }

        &:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
        }

        &.chip-active {
          background: #2563eb !important;
          border-color: #2563eb !important;
          color: #ffffff !important;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);

          mat-icon {
            color: #ffffff !important;
          }
        }

        &.chip-new:not(.chip-active) {
          color: #059669;
          border-color: #a7f3d0;
          background: #ecfdf5;
        }

        &.chip-existing:not(.chip-active) {
          color: #d97706;
          border-color: #fde68a;
          background: #fffbeb;
        }

        &.chip-error:not(.chip-active) {
          color: #dc2626;
          border-color: #fecaca;
          background: #fef2f2;
        }
      }

      /* Sortable Header */
      th.sortable-header {
        cursor: pointer;
        user-select: none;
        transition: background 0.15s ease;

        &:hover {
          background: #eff6ff !important;
          color: #1e40af;
        }

        .header-cell-inner {
          display: flex;
          align-items: center;
          gap: 4px;

          &.center {
            justify-content: center;
          }

          .sort-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
            line-height: 16px;
            color: #64748b;
            opacity: 0.8;
          }
        }
      }

      /* Pagination Bar */
      .dialog-pagination-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-top: none;
        border-radius: 0 0 10px 10px;
        font-size: 0.82rem;
        color: #64748b;
        flex-wrap: wrap;
        gap: 10px;
      }

      .pagination-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .page-size-wrap {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8rem;
      }

      .page-size-select {
        padding: 3px 6px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 0.8rem;
        background: #ffffff;
        color: #0f172a;
        outline: none;
      }

      .page-nav-btn {
        width: 28px;
        height: 28px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        background: #ffffff;
        color: #334155;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover:not(:disabled) {
          background: #eff6ff;
          border-color: #93c5fd;
          color: #2563eb;
        }

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }

      .page-number-display {
        font-weight: 600;
        color: #334155;
        font-size: 0.8rem;
      }

      .empty-filter-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px;
        color: #64748b;
        gap: 8px;

        mat-icon {
          font-size: 32px;
          width: 32px;
          height: 32px;
          color: #94a3b8;
        }

        .reset-filter-btn {
          margin-top: 6px;
          padding: 5px 12px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          font-size: 0.78rem;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;

          &:hover {
            background: #dbeafe;
          }
        }
      }

      /* Permanent Zero Horizontal Scrollbar Rule */
      .preview-table-container {
        max-height: none !important;
        overflow-x: auto !important;
        overflow-y: visible !important;
        -webkit-overflow-scrolling: touch !important;
        width: 100% !important;
        box-sizing: border-box !important;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        background: #ffffff;

        &::-webkit-scrollbar {
          height: 6px;
        }
        &::-webkit-scrollbar-track {
          background: #f8fafc;
          border-radius: 4px;
        }
        &::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        &::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      }

      .preview-table {
        width: 100% !important;
        min-width: 720px !important;
        border-collapse: collapse;
        font-size: 0.8rem;
        table-layout: auto;

        thead {
          background: #f8fafc;

          th {
            padding: 10px 14px;
            font-weight: 700;
            color: #475569;
            border-bottom: 2px solid #e2e8f0;
            text-align: left;
            white-space: nowrap !important;
          }
        }

        tbody {
          tr {
            border-bottom: 1px solid #f1f5f9;
            &:hover {
              background: #f8fafc;
            }
            &.row-error {
              background: #fff1f2;
            }
            &.row-existing {
              background: #fffdf5;
            }

            td {
              padding: 9px 14px;
              color: #334155;
              vertical-align: middle;
              white-space: nowrap !important;
            }

            .row-num {
              color: #94a3b8;
              font-size: 0.74rem;
              text-align: center;
              white-space: nowrap !important;
            }

            .primary-val {
              color: #0f172a;
              white-space: nowrap !important;
              strong {
                white-space: nowrap !important;
              }
            }

            code {
              background: #f1f5f9;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 0.76rem;
              color: #0284c7;
            }

            .scope-chip {
              background: #e0f2fe;
              color: #0369a1;
              padding: 2px 8px;
              border-radius: 999px;
              font-size: 0.72rem;
              font-weight: 600;
            }

            .section-badge {
              display: inline-block;
              padding: 2px 6px;
              background: #f0fdf4;
              border: 1px solid #bbf7d0;
              color: #166534;
              border-radius: 4px;
              font-weight: 700;
              font-size: 0.72rem;
              margin-right: 4px;
            }

            .status-badge {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 5px;
              padding: 4px 10px;
              border-radius: 999px;
              font-size: 0.74rem;
              font-weight: 700;
              white-space: nowrap;
              line-height: 1.2;

              mat-icon {
                font-size: 16px;
                width: 16px;
                height: 16px;
                line-height: 16px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                overflow: visible;
                flex-shrink: 0;
                vertical-align: middle;
              }

              span {
                white-space: nowrap;
                line-height: 1;
              }

              &.new {
                background: #dcfce7;
                color: #15803d;
                border: 1px solid #bbf7d0;
              }
              &.existing {
                background: #fef3c7;
                color: #b45309;
                border: 1px solid #fde68a;
              }
              &.error {
                background: #fee2e2;
                color: #b91c1c;
                border: 1px solid #fecaca;
              }
            }

            .error-col {
              line-height: 1.3;

              .error-text {
                color: #dc2626;
                font-weight: 600;
              }
              .existing-note-text {
                color: #b45309;
                font-weight: 600;
              }
              .success-text {
                color: #059669;
                font-weight: 600;
              }
            }
          }
        }
      }
    }

    /* Dialog Actions */
    .dialog-actions {
      border-top: 1px solid #e2e8f0;
      padding: 14px 24px;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      background: #f8fafc;
      flex-shrink: 0;

      .cancel-btn {
        color: #64748b;
        font-weight: 600;
      }

      .confirm-import-btn {
        border-radius: 8px;
        font-weight: 700;
        background: #2563eb;
        color: #ffffff;

        .sub-btn-note {
          opacity: 0.85;
          font-size: 0.75rem;
          margin-left: 4px;
        }
      }
    }

    /* ==========================================================================
       RESPONSIVE DESIGN (Strict ERP Rule: Mobile < 640px, Tablet 640-1024px, Desktop > 1024px)
       ========================================================================== */
    .mobile-swipe-hint {
      display: none;
    }

    @media (max-width: 640px) {
      .import-dialog-container {
        max-height: 94vh;
      }

      /* Header */
      .dialog-header {
        padding: 12px 14px;

        .header-left {
          gap: 10px;
        }

        .header-icon-box {
          width: 36px;
          height: 36px;
          border-radius: 8px;

          mat-icon {
            font-size: 20px;
            width: 20px;
            height: 20px;
          }
        }

        .header-titles {
          .main-title {
            font-size: 1.05rem;
          }
          .subtitle {
            font-size: 0.72rem;
            line-height: 1.25;
          }
        }
      }

      /* Body */
      .dialog-body {
        padding: 12px 14px;
        gap: 12px;
      }

      /* Step 1: Template Banner */
      .template-step-banner {
        flex-direction: column;
        align-items: stretch;
        padding: 12px 14px;
        gap: 10px;

        .step-info {
          align-items: flex-start;
          gap: 10px;

          .step-text {
            h4 {
              font-size: 0.88rem;
              line-height: 1.3;
            }
            p {
              font-size: 0.75rem;
            }
          }
        }

        .download-tpl-btn {
          width: 100%;
          justify-content: center;
          height: 38px;
        }
      }

      /* Step 2: Dropzone & File Loaded Bar */
      .upload-zone {
        padding: 16px 12px;

        .upload-icon-circle {
          width: 40px;
          height: 40px;
          mat-icon {
            font-size: 22px;
            width: 22px;
            height: 22px;
          }
        }

        h3 {
          font-size: 0.88rem;
        }

        .upload-hint {
          font-size: 0.72rem;
        }

        .browse-btn {
          width: 100%;
          justify-content: center;
        }
      }

      .file-loaded-bar {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        padding: 10px 12px;

        .file-meta {
          gap: 10px;

          .file-details {
            min-width: 0;
            .file-name {
              font-size: 0.82rem;
              word-break: break-all;
            }
            .file-size {
              font-size: 0.7rem;
            }
          }
        }

        .file-actions {
          display: flex;
          justify-content: flex-end;
          gap: 6px;

          button {
            padding: 0 8px;
            height: 32px;
            font-size: 0.78rem;
          }
        }
      }

      /* Metrics Deck */
      .preview-section .preview-metrics-deck {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;

        .metric-pill {
          justify-content: center;
          padding: 6px 8px;
          font-size: 0.74rem;

          .m-val {
            font-size: 0.88rem;
          }
        }
      }

      /* Duplicate Notice */
      .duplicate-notice-banner {
        padding: 8px 10px;
        font-size: 0.74rem;
        gap: 8px;
      }

      /* Preview Controls Bar: Search & Status Filter Chips */
      .preview-controls-bar {
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 8px !important;
        width: 100% !important;
        box-sizing: border-box !important;

        .search-input-box {
          max-width: 100% !important;
          width: 100% !important;
          min-width: 0 !important;
          height: 38px !important;
          box-sizing: border-box !important;
          flex: none !important;
        }

        .filter-chips-deck {
          width: 100% !important;
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 6px !important;
          box-sizing: border-box !important;

          .filter-chip {
            height: 32px !important;
            padding: 0 10px !important;
            font-size: 0.74rem !important;
            flex: 1 1 calc(50% - 6px) !important;
            justify-content: center !important;
            box-sizing: border-box !important;

            mat-icon {
              font-size: 14px;
              width: 14px;
              height: 14px;
              line-height: 14px;
            }
          }
        }
      }

      /* Mobile Swipe Hint */
      .mobile-swipe-hint {
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
        border: 1px dashed #bfdbfe;
        margin-bottom: 6px;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }

      /* Table Container on Mobile */
      .preview-section .preview-table-container,
      .preview-table-container {
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch !important;
        width: 100% !important;
      }

      .preview-section .preview-table,
      .preview-table {
        min-width: 700px !important;
        width: max-content !important;

        th, td {
          padding: 8px 12px !important;
          font-size: 0.76rem !important;
          white-space: nowrap !important;
        }

        .primary-val,
        .primary-val strong {
          white-space: nowrap !important;
        }
      }

      /* Pagination Bar on Mobile */
      .dialog-pagination-bar {
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 8px 10px;

        .pagination-summary {
          font-size: 0.75rem;
          text-align: center;
        }

        .pagination-actions {
          width: 100%;
          justify-content: center;
          gap: 6px;
        }
      }

      /* Dialog Footer Actions on Mobile */
      .dialog-actions {
        padding: 10px 14px;
        flex-direction: column-reverse;
        gap: 8px;

        .confirm-import-btn,
        .cancel-btn {
          width: 100%;
          justify-content: center;
          height: 40px;
        }
      }
    }

    @media (min-width: 641px) and (max-width: 1024px) {
      .preview-controls-bar {
        .search-input-box {
          max-width: 320px;
        }
      }

      .preview-table-container {
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch !important;
      }

      .preview-table {
        min-width: 680px !important;
      }
    }
  `]
})
export class MasterExcelImportDialogComponent implements OnInit {
  selectedFile: File | null = null;
  cachedCsvText: string | null = null;
  isDragOver = false;
  analyzing = false;
  importing = false;
  downloadingTemplate = false;

  previewData: any = null;
  existingDbItems: { name: string; code?: string }[] = [];

  importOptionsForm = new FormGroup({
    updateExisting: new FormControl(false)
  });

  // Grid search, filter, sort and pagination state
  previewSearchControl = new FormControl('');
  statusFilterControl = new FormControl('All');

  sortColumn: string = 'rowNumber';
  sortAscending: boolean = true;

  pageIndex: number = 0;
  pageSize: number = 10;

  private apiUrl = `${environment.apiUrl}/MasterImport`;

  constructor(
    public dialogRef: MatDialogRef<MasterExcelImportDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: MasterImportDialogData,
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {}

  get isUpdateMode(): boolean {
    return !!this.importOptionsForm.get('updateExisting')?.value;
  }

  get newRowsCount(): number {
    if (!this.previewData?.items) return 0;
    return this.previewData.items.filter((i: any) => i.isValid && i.status === 'New').length;
  }

  get existingRowsCount(): number {
    if (!this.previewData?.items) return 0;
    return this.previewData.items.filter((i: any) => i.status === 'Existing').length;
  }

  get importableCount(): number {
    if (this.isUpdateMode) {
      return this.newRowsCount + this.existingRowsCount;
    }
    return this.newRowsCount;
  }

  get canConfirmImport(): boolean {
    if (!this.previewData || this.analyzing || this.importing) return false;
    return this.importableCount > 0;
  }

  setStatusFilter(status: string): void {
    this.statusFilterControl.setValue(status);
  }

  resetPreviewFilter(): void {
    this.previewSearchControl.setValue('');
    this.statusFilterControl.setValue('All');
    this.pageIndex = 0;
    this.sortColumn = 'rowNumber';
    this.sortAscending = true;
    this.cdr.detectChanges();
  }

  toggleSort(column: string): void {
    if (this.sortColumn === column) {
      this.sortAscending = !this.sortAscending;
    } else {
      this.sortColumn = column;
      this.sortAscending = true;
    }
    this.cdr.detectChanges();
  }

  get filteredAndSortedItems(): any[] {
    if (!this.previewData?.items) return [];
    let items = [...this.previewData.items];

    // Status filter
    const status = this.statusFilterControl.value;
    if (status && status !== 'All') {
      items = items.filter(i => i.status === status);
    }

    // Search query filter
    const q = (this.previewSearchControl.value || '').trim().toLowerCase();
    if (q) {
      items = items.filter(i => {
        const name = (i.className || i.feeHeadName || '').toLowerCase();
        const code = (i.classCode || i.shortCode || '').toLowerCase();
        const scope = (i.academicScope || i.category || i.frequency || '').toLowerCase();
        const err = (i.errorMessage || '').toLowerCase();
        return name.includes(q) || code.includes(q) || scope.includes(q) || err.includes(q);
      });
    }

    // Sorting
    items.sort((a, b) => {
      let valA: any = a[this.sortColumn];
      let valB: any = b[this.sortColumn];

      if (this.sortColumn === 'name') {
        valA = a.className || a.feeHeadName || '';
        valB = b.className || b.feeHeadName || '';
      } else if (this.sortColumn === 'code') {
        valA = a.classCode || a.shortCode || '';
        valB = b.classCode || b.shortCode || '';
      } else if (this.sortColumn === 'scope') {
        valA = a.academicScope || (a.category + ' ' + a.frequency) || '';
        valB = b.academicScope || (b.category + ' ' + b.frequency) || '';
      } else if (this.sortColumn === 'status') {
        valA = a.status || '';
        valB = b.status || '';
      } else if (this.sortColumn === 'rowNumber') {
        valA = a.rowNumber || 0;
        valB = b.rowNumber || 0;
      }

      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      let res = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        res = valA - valB;
      } else {
        res = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
      }
      return this.sortAscending ? res : -res;
    });

    return items;
  }

  get pagedItems(): any[] {
    const list = this.filteredAndSortedItems;
    if (this.pageSize >= 999) return list;
    const start = this.pageIndex * this.pageSize;
    return list.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    if (this.pageSize >= 999 || this.filteredAndSortedItems.length === 0) return 1;
    return Math.ceil(this.filteredAndSortedItems.length / this.pageSize);
  }

  get paginationStart(): number {
    if (this.filteredAndSortedItems.length === 0) return 0;
    return this.pageIndex * this.pageSize + 1;
  }

  get paginationEnd(): number {
    return Math.min((this.pageIndex + 1) * this.pageSize, this.filteredAndSortedItems.length);
  }

  onPageSizeChange(e: Event): void {
    const target = e.target as HTMLSelectElement;
    this.pageSize = parseInt(target.value, 10) || 10;
    this.pageIndex = 0;
    this.cdr.detectChanges();
  }

  goToPage(index: number): void {
    if (index >= 0 && index < this.totalPages) {
      this.pageIndex = index;
      this.cdr.detectChanges();
    }
  }

  ngOnInit(): void {
    if (this.data.existingItems && this.data.existingItems.length > 0) {
      this.existingDbItems = [...this.data.existingItems];
    }
    this.fetchLiveDbCatalog();

    this.importOptionsForm.get('updateExisting')?.valueChanges.subscribe(() => {
      this.cdr.detectChanges();
    });

    this.previewSearchControl.valueChanges.subscribe(() => {
      this.pageIndex = 0;
      this.cdr.detectChanges();
    });

    this.statusFilterControl.valueChanges.subscribe(() => {
      this.pageIndex = 0;
      this.cdr.detectChanges();
    });
  }

  private fetchLiveDbCatalog(): void {
    if (this.data.type === 'classes') {
      this.http.get<any[]>(`${environment.apiUrl}/school/classes`).subscribe({
        next: (res) => {
          if (Array.isArray(res) && res.length > 0) {
            this.existingDbItems = res.map(c => ({ name: c.name, code: c.code }));
            if (this.cachedCsvText) {
              this.parseCsvClientSide(this.cachedCsvText);
            }
          }
        },
        error: () => {}
      });
    } else {
      this.http.get<any>(`${environment.apiUrl}/fees/heads?activeOnly=false`).subscribe({
        next: (res) => {
          const list = Array.isArray(res) ? res : (res?.items || []);
          if (list.length > 0) {
            this.existingDbItems = list.map((h: any) => ({ name: h.name, code: h.code }));
            if (this.cachedCsvText) {
              this.parseCsvClientSide(this.cachedCsvText);
            }
          }
        },
        error: () => {}
      });
    }
  }

  downloadTemplate(): void {
    let csvContent = '';
    let fileName = '';

    if (this.data.type === 'classes') {
      fileName = this.data.templateFileName || 'IMSERP_Classes_Master_Template.csv';
      csvContent = 
`ClassName,ClassCode,AcademicScope,DisplayOrder
Play Group,PG,Both,1
Nursery,NUR,Both,2
LKG,LKG,Both,3
UKG,UKG,Both,4
Class 1,CLS01,Both,5
Class 2,CLS02,Both,6
Class 3,CLS03,Both,7
Class 4,CLS04,Both,8
Class 5,CLS05,Both,9
Class 6,CLS06,Both,10
Class 7,CLS07,Both,11
Class 8,CLS08,Both,12
Class 9,CLS09,Both,13
Class 10,CLS10,Both,14
Class 11,CLS11,Both,15
Class 12,CLS12,Both,16`;
    } else {
      fileName = this.data.templateFileName || 'IMSERP_Fee_Heads_Master_Template.csv';
      csvContent = 
`FeeHeadName,ShortCode,Category,Frequency,ApplicableTo,SortOrder,Description
School Tuition Fee,TUI,Academic,Monthly,School,10,Monthly Academic Tuition Fee
Coaching Tuition Fee,COACH,Academic,Monthly,Coaching,15,Monthly Coaching Batch Academic Tuition Fee
Admission & Registration Fee,ADM,Academic,OneTime,Both,20,One-Time admission charge and student kit
School Examination Fee,EXAM,Academic,TermWise,Both,30,Terminal and half-yearly examination charges
Annual Development Charge,ANNUAL,Infrastructure,Annual,Both,40,Campus infrastructure & annual maintenance
Computer & Smart Lab Fee,COMP,Academic,Monthly,Both,50,Interactive smart board and IT computer lab
Sports & Physical Activity,SPORT,Activities,Annual,School,60,Sports coaching, physical equipment and games
Library & Reading Room Fee,LIB,Academic,Monthly,Both,65,Library subscription, journals and reading room
Transport Bus Fee,TRANS,Transport,Monthly,Both,70,Monthly bus conveyance & stoppage charges
Hostel & Accommodation Fee,HOSTEL,Residential,Monthly,Both,75,Hostel boarding and room accommodation charges
Mess & Dining Fee,MESS,Residential,Monthly,Both,80,Hostel mess meals, breakfast and dining charges
Attendance Absence Fine,ATTN_FINE,Fine,Monthly,Both,90,Fine levied for unauthorized absence without leave
Late Payment Penalty Fine,LATE_FEE,Fine,Monthly,Both,100,Late payment penalty charge on overdue invoice`;
    }

    try {
      // Add UTF-8 BOM (\uFEFF) so Excel opens without encoding issues
      const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      this.confirmDialog.alert('Download Error', 'Could not initiate template file download.', 'danger');
    }
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragOver = false;
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      this.handleFile(e.dataTransfer.files[0]);
    }
  }

  onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  handleFile(file: File): void {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.csv') {
      this.confirmDialog.alert('Invalid File Format', 'Please upload a Microsoft Excel (.xlsx) or CSV (.csv) file.', 'warning');
      return;
    }
    this.selectedFile = file;

    if (ext === '.csv') {
      this.analyzing = true;
      this.cdr.detectChanges();

      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const text = (e.target?.result as string) || '';
          this.cachedCsvText = text;
          this.parseCsvClientSide(text);
        } catch (err: any) {
          this.confirmDialog.alert('CSV Parse Error', err?.message || 'Could not parse CSV file.', 'danger');
        } finally {
          this.analyzing = false;
          this.cdr.detectChanges();
        }
      };
      reader.onerror = () => {
        this.analyzing = false;
        this.cdr.detectChanges();
        this.confirmDialog.alert('File Read Error', 'Failed to read file contents from your browser.', 'danger');
      };
      reader.readAsText(file, 'utf-8');
    } else {
      this.uploadAndPreviewServer();
    }
  }

  clearFile(fileInput?: HTMLInputElement): void {
    this.selectedFile = null;
    this.cachedCsvText = null;
    this.previewData = null;
    this.analyzing = false;
    this.importing = false;
    this.previewSearchControl.setValue('', { emitEvent: false });
    this.statusFilterControl.setValue('All', { emitEvent: false });
    this.pageIndex = 0;
    this.sortColumn = 'rowNumber';
    this.sortAscending = true;
    if (fileInput) {
      fileInput.value = '';
    }
    this.cdr.detectChanges();
  }

  replaceFile(fileInput: HTMLInputElement): void {
    this.clearFile(fileInput);
    fileInput.click();
  }

  parseCsvClientSide(text: string): void {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      this.confirmDialog.alert('Empty File', 'The uploaded CSV file contains no data rows.', 'warning');
      return;
    }

    const headers = this.splitCsvLine(lines[0]).map(h => h.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
    const items: any[] = [];
    
    // In-file duplicate trackers
    const seenNamesInFile = new Set<string>();
    const seenCodesInFile = new Set<string>();

    // Database duplicate trackers
    const existingNamesSet = new Set<string>(
      this.existingDbItems.map(x => (x.name || '').trim().toLowerCase()).filter(Boolean)
    );
    const existingCodesSet = new Set<string>(
      this.existingDbItems.map(x => (x.code || '').trim().toLowerCase()).filter(Boolean)
    );

    for (let i = 1; i < lines.length; i++) {
      const vals = this.splitCsvLine(lines[i]);
      if (vals.every(v => !v.trim())) continue;

      const rowMap: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowMap[h] = vals[idx]?.trim() || '';
      });

      if (this.data.type === 'classes') {
        const className = rowMap['classname'] || rowMap['class'] || rowMap['name'] || '';
        const classCode = rowMap['classcode'] || rowMap['code'] || rowMap['shortcode'] || '';
        const scope = rowMap['academicscope'] || rowMap['scope'] || 'Both';
        const displayOrder = parseInt(rowMap['displayorder'] || rowMap['order'] || `${i}`, 10) || i;

        const lowerName = className.trim().toLowerCase();
        const lowerCode = classCode.trim().toLowerCase();
        let isValid = true;
        let status = 'New';
        let errorMessage: string | null = null;

        if (!className) {
          isValid = false;
          status = 'Error';
          errorMessage = 'Class Name is mandatory.';
        } else if (seenNamesInFile.has(lowerName)) {
          isValid = false;
          status = 'Error';
          errorMessage = `Duplicate class '${className}' in file.`;
        } else if (lowerCode && seenCodesInFile.has(lowerCode)) {
          isValid = false;
          status = 'Error';
          errorMessage = `Duplicate class code '${classCode}' in file.`;
        } else {
          seenNamesInFile.add(lowerName);
          if (lowerCode) seenCodesInFile.add(lowerCode);

          if (existingNamesSet.has(lowerName)) {
            status = 'Existing';
            isValid = true;
            errorMessage = `Class already exists in your institute database.`;
          } else if (lowerCode && existingCodesSet.has(lowerCode)) {
            status = 'Existing';
            isValid = true;
            errorMessage = `Class code already exists in your institute database.`;
          }
        }

        items.push({
          rowNumber: i + 1,
          className,
          classCode: classCode.toUpperCase(),
          academicScope: this.normalizeScope(scope),
          displayOrder,
          autoSections: ['A', 'B'],
          isValid,
          status,
          errorMessage
        });
      } else {
        const name = rowMap['feeheadname'] || rowMap['headname'] || rowMap['name'] || '';
        const code = rowMap['shortcode'] || rowMap['code'] || '';
        const category = rowMap['category'] || 'Academic';
        const frequency = rowMap['frequency'] || 'Monthly';
        const applicableTo = rowMap['applicableto'] || rowMap['scope'] || 'Both';
        const sortOrder = parseInt(rowMap['sortorder'] || `${i * 10}`, 10) || (i * 10);
        const desc = rowMap['description'] || rowMap['desc'] || '';

        const lowerName = name.trim().toLowerCase();
        const lowerCode = code.trim().toLowerCase();

        let isValid = true;
        let status = 'New';
        let errorMessage: string | null = null;

        if (!name) {
          isValid = false;
          status = 'Error';
          errorMessage = 'Fee Head Name is mandatory.';
        } else if (!code) {
          isValid = false;
          status = 'Error';
          errorMessage = 'Short Code is mandatory.';
        } else if (seenCodesInFile.has(lowerCode)) {
          isValid = false;
          status = 'Error';
          errorMessage = `Duplicate Short Code '${code}' in file.`;
        } else if (seenNamesInFile.has(lowerName)) {
          isValid = false;
          status = 'Error';
          errorMessage = `Duplicate Fee Head '${name}' in file.`;
        } else {
          seenCodesInFile.add(lowerCode);
          seenNamesInFile.add(lowerName);

          if (existingCodesSet.has(lowerCode)) {
            status = 'Existing';
            isValid = true;
            errorMessage = `Short Code '${code}' already exists in your catalog.`;
          } else if (existingNamesSet.has(lowerName)) {
            status = 'Existing';
            isValid = true;
            errorMessage = `Fee Head '${name}' already exists in your catalog.`;
          }
        }

        items.push({
          rowNumber: i + 1,
          feeHeadName: name,
          shortCode: code.toUpperCase(),
          category: this.normalizeCategory(category),
          frequency: this.normalizeFrequency(frequency),
          applicableTo: this.normalizeScope(applicableTo),
          sortOrder,
          description: desc,
          isValid,
          status,
          errorMessage
        });
      }
    }

    this.previewData = {
      totalRows: items.length,
      validRows: items.filter(i => i.isValid).length,
      errorRows: items.filter(i => !i.isValid).length,
      items
    };
    this.cdr.detectChanges();
  }

  private splitCsvLine(line: string): string[] {
    const list: string[] = [];
    let inQuotes = false;
    let current = '';

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        list.push(current.trim());
        current = '';
      } else {
        current += c;
      }
    }
    list.push(current.trim());
    return list;
  }

  private normalizeScope(scope: string): string {
    const s = (scope || '').toLowerCase();
    if (s.includes('coach')) return 'Coaching';
    if (s.includes('school')) return 'School';
    return 'Both';
  }

  private normalizeCategory(cat: string): string {
    const c = (cat || '').toLowerCase();
    if (c.includes('infra')) return 'Infrastructure';
    if (c.includes('activ') || c.includes('sport')) return 'Activities';
    if (c.includes('suppl') || c.includes('book')) return 'Supplies';
    if (c.includes('resid') || c.includes('hostel') || c.includes('mess')) return 'Residential';
    if (c.includes('trans') || c.includes('bus')) return 'Transport';
    if (c.includes('fine') || c.includes('late')) return 'Fine';
    return 'Academic';
  }

  private normalizeFrequency(freq: string): string {
    const f = (freq || '').toLowerCase();
    if (f.includes('quarter')) return 'Quarterly';
    if (f.includes('term') || f.includes('exam')) return 'TermWise';
    if (f.includes('annu') || f.includes('year')) return 'Annual';
    if (f.includes('one') || f.includes('admis')) return 'OneTime';
    return 'Monthly';
  }

  uploadAndPreviewServer(): void {
    if (!this.selectedFile) return;

    this.analyzing = true;
    this.previewData = null;

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    const url = `${this.apiUrl}/${this.data.type}/preview`;
    this.http.post<any>(url, formData).subscribe({
      next: (resp) => {
        this.analyzing = false;
        this.previewData = resp;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.analyzing = false;
        this.cdr.detectChanges();
        if (err.status === 0) {
          this.confirmDialog.alert('Server Unreachable', 'Backend server is not running on http://localhost:5000. Please start your backend via Visual Studio or `dotnet run` in backend/IMSERP.API.', 'warning');
        } else {
          const msg = err?.error?.message || 'Failed to inspect file. Please ensure spreadsheet columns match template.';
          this.confirmDialog.alert('File Inspection Error', msg, 'danger');
        }
      }
    });
  }

  confirmImport(): void {
    if (!this.previewData || !this.previewData.items || this.previewData.items.length === 0) return;

    const updateExisting = this.isUpdateMode;
    
    // Duplicate prevention: If not updating existing, only send genuinely NEW valid items
    const itemsToImport = updateExisting
      ? this.previewData.items.filter((i: any) => i.isValid)
      : this.previewData.items.filter((i: any) => i.isValid && i.status === 'New');

    if (itemsToImport.length === 0) {
      if (!updateExisting && this.existingRowsCount > 0) {
        this.confirmDialog.alert(
          'Duplicate Entry Prevented',
          `All ${this.existingRowsCount} records in this file already exist in your database. No duplicate entries will be created. If you wish to overwrite them, turn on 'Update existing records'.`,
          'info'
        );
      } else {
        this.confirmDialog.alert('No Valid Rows', 'There are no valid records in this file to import.', 'warning');
      }
      return;
    }

    this.importing = true;
    const payload = {
      updateExisting,
      items: itemsToImport
    };

    const url = `${this.apiUrl}/${this.data.type}/confirm`;
    this.http.post<any>(url, payload).subscribe({
      next: (res) => {
        this.importing = false;
        this.dialogRef.close({
          success: true,
          message: res.message || 'Bulk import completed successfully.'
        });
      },
      error: (err) => {
        this.importing = false;
        this.cdr.detectChanges();
        console.error('Master import confirm error:', err);
        if (err.status === 0) {
          this.confirmDialog.alert('Server Offline', 'Backend server is not running on http://localhost:5000. Please start backend via `dotnet run` to save records.', 'warning');
        } else {
          const msg = err?.error?.message || 
                      err?.error?.detail || 
                      err?.error?.title || 
                      (typeof err?.error === 'string' ? err.error : null) || 
                      err?.message || 
                      'Failed to save imported records. Please check data constraints.';
          this.confirmDialog.alert('Import Failed', msg, 'danger');
        }
      }
    });
  }
}
