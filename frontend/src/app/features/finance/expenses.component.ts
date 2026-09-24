import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule, Sort, SortDirection } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FinanceService, ExpenseVoucherDto, ExpenseCategoryDto, ExpensePaymentMode } from '../../core/services/finance.service';
import { BranchService } from '../../core/services/branch.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { ExpenseDialogComponent } from './expense-dialog.component';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatCardModule
  ],
  template: `
<div class="page-container">
  <!-- Header Bar -->
  <div class="header-card">
    <div class="header-left">
      <div class="header-icon-box">
        <mat-icon>receipt_long</mat-icon>
      </div>
      <div>
        <h1 class="page-title">Expense Vouchers &amp; Day Book</h1>
        <p class="page-subtitle">दैनिक खर्च प्रबंधन &bull; Server-Side Search, Filter, Sort &amp; Audit Day Book</p>
      </div>
    </div>
    <div class="header-actions">
      <button mat-stroked-button color="primary" (click)="loadExpenses()" [disabled]="loading">
        <mat-icon [class.spin-icon]="loading">refresh</mat-icon>
        <span>Refresh</span>
      </button>
      <button mat-raised-button color="primary" class="add-btn" (click)="openCreateDialog()">
        <mat-icon>add_circle</mat-icon>
        <span>Record Expense Voucher</span>
      </button>
    </div>
  </div>

  <!-- KPI Summary Cards (Real-time Database Aggregated) -->
  <div class="kpi-grid">
    <div class="kpi-card total">
      <div class="kpi-icon total"><mat-icon>payments</mat-icon></div>
      <div class="kpi-content">
        <span class="kpi-label">Filtered Expenses Total</span>
        <span class="kpi-value">₹{{ totalAmountInView | number:'1.2-2' }}</span>
        <span class="kpi-sub">{{ totalCount }} total vouchers found</span>
      </div>
    </div>

    <div class="kpi-card cash">
      <div class="kpi-icon cash"><mat-icon>local_atm</mat-icon></div>
      <div class="kpi-content">
        <span class="kpi-label">Cash Outflow</span>
        <span class="kpi-value">₹{{ cashSpentInView | number:'1.2-2' }}</span>
        <span class="kpi-sub">Direct cash counter expenses</span>
      </div>
    </div>

    <div class="kpi-card bank">
      <div class="kpi-icon bank"><mat-icon>account_balance</mat-icon></div>
      <div class="kpi-content">
        <span class="kpi-label">Bank / Online Outflow</span>
        <span class="kpi-value">₹{{ bankSpentInView | number:'1.2-2' }}</span>
        <span class="kpi-sub">UPI, NEFT, RTGS &amp; Cheques</span>
      </div>
    </div>

    <div class="kpi-card top-cat">
      <div class="kpi-icon top-cat"><mat-icon>pie_chart</mat-icon></div>
      <div class="kpi-content">
        <span class="kpi-label">Primary Expense Head</span>
        <span class="kpi-value cat-name">{{ topCategoryName || 'N/A' }}</span>
        <span class="kpi-sub">{{ categories.length }} Active Categories</span>
      </div>
    </div>
  </div>

  <!-- Filter Controls Card -->
  <div class="filter-card">
    <div class="filter-grid">
      <!-- Search Input with Debounce -->
      <mat-form-field appearance="outline" class="filter-item search-field">
        <mat-label>Search Title, Voucher #, Payee, Ref</mat-label>
        <input matInput [(ngModel)]="searchTerm" (ngModelChange)="onSearchInput($event)" (keyup.enter)="applyFilters()" placeholder="e.g. Electricity, Fuel, EXP-2026...">
        <mat-icon matPrefix>search</mat-icon>
        <button mat-icon-button matSuffix *ngIf="searchTerm" (click)="clearSearch()">
          <mat-icon>clear</mat-icon>
        </button>
      </mat-form-field>

      <!-- Category Filter -->
      <mat-form-field appearance="outline" class="filter-item">
        <mat-label>Category (व्यय श्रेणी)</mat-label>
        <mat-select [(ngModel)]="selectedCategoryId" (selectionChange)="applyFilters()">
          <mat-option [value]="null">All Categories (सारे खर्च)</mat-option>
          <mat-option *ngFor="let cat of categories" [value]="cat.id">
            {{ cat.name }} ({{ cat.code }})
          </mat-option>
        </mat-select>
        <mat-icon matPrefix>category</mat-icon>
      </mat-form-field>

      <!-- Payment Mode Filter -->
      <mat-form-field appearance="outline" class="filter-item">
        <mat-label>Payment Mode (भुगतान माध्यम)</mat-label>
        <mat-select [(ngModel)]="selectedPaymentMode" (selectionChange)="applyFilters()">
          <mat-option [value]="null">All Payment Modes</mat-option>
          <mat-option [value]="ExpensePaymentMode.Cash">Cash (नकद)</mat-option>
          <mat-option [value]="ExpensePaymentMode.UPI">UPI / QR Code</mat-option>
          <mat-option [value]="ExpensePaymentMode.BankTransfer">Bank Transfer (NEFT/RTGS)</mat-option>
          <mat-option [value]="ExpensePaymentMode.Cheque">Cheque</mat-option>
          <mat-option [value]="ExpensePaymentMode.Card">Debit / Credit Card</mat-option>
        </mat-select>
        <mat-icon matPrefix>payment</mat-icon>
      </mat-form-field>

      <!-- Date Presets -->
      <mat-form-field appearance="outline" class="filter-item">
        <mat-label>Time Period</mat-label>
        <mat-select [(ngModel)]="datePreset" (selectionChange)="onPresetChange()">
          <mat-option value="this_month">This Month (इस माह)</mat-option>
          <mat-option value="today">Today Only (आज)</mat-option>
          <mat-option value="this_fy">This Financial Year (2025-26)</mat-option>
          <mat-option value="all">All Time (समस्त)</mat-option>
          <mat-option value="custom">Custom Date Range</mat-option>
        </mat-select>
        <mat-icon matPrefix>date_range</mat-icon>
      </mat-form-field>

      <!-- Branch Filter -->
      <mat-form-field appearance="outline" class="filter-item" *ngIf="branches.length > 0">
        <mat-label>Campus / Branch</mat-label>
        <mat-select [(ngModel)]="selectedBranchId" (selectionChange)="applyFilters()">
          <mat-option [value]="null">All Branches</mat-option>
          <mat-option *ngFor="let b of branches" [value]="b.id">
            {{ b.name }}
          </mat-option>
        </mat-select>
        <mat-icon matPrefix>apartment</mat-icon>
      </mat-form-field>

      <!-- Custom Date Pickers (if custom) -->
      <mat-form-field appearance="outline" class="filter-item" *ngIf="datePreset === 'custom'">
        <mat-label>From Date</mat-label>
        <input matInput [matDatepicker]="fromPicker" [(ngModel)]="customFromDate" (dateChange)="applyFilters()">
        <mat-datepicker-toggle matIconSuffix [for]="fromPicker"></mat-datepicker-toggle>
        <mat-datepicker #fromPicker></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline" class="filter-item" *ngIf="datePreset === 'custom'">
        <mat-label>To Date</mat-label>
        <input matInput [matDatepicker]="toPicker" [(ngModel)]="customToDate" (dateChange)="applyFilters()">
        <mat-datepicker-toggle matIconSuffix [for]="toPicker"></mat-datepicker-toggle>
        <mat-datepicker #toPicker></mat-datepicker>
      </mat-form-field>
    </div>
  </div>

  <!-- Vouchers Table Card with Sticky Header & Proper Overlay Loader -->
  <div class="table-card">
    <!-- Top Progress Bar during Loading -->
    <mat-progress-bar mode="indeterminate" *ngIf="loading" class="top-progress-bar"></mat-progress-bar>

    <!-- Transparent Overlay with Spinner & Label -->
    <div class="table-loading-overlay" *ngIf="loading">
      <div class="loader-content">
        <mat-spinner diameter="44" strokeWidth="4"></mat-spinner>
        <div class="loader-text-group">
          <span class="loading-title">Loading Expense Vouchers</span>
          <span class="loading-sub">Fetching records &amp; calculating totals...</span>
        </div>
      </div>
    </div>

    <!-- Responsive Table Container -->
    <div class="table-responsive">
      <table mat-table [dataSource]="vouchers" matSort (matSortChange)="onSortChange($event)" [matSortActive]="sortBy" [matSortDirection]="sortDirection" class="expense-table">
        <!-- Voucher No -->
        <ng-container matColumnDef="voucherNo">
          <th mat-header-cell *matHeaderCellDef mat-sort-header="voucherno" class="col-voucher">VOUCHER #</th>
          <td mat-cell *matCellDef="let v" class="col-voucher">
            <div class="voucher-chip">
              <mat-icon>tag</mat-icon>
              <span>{{ v.voucherNo }}</span>
            </div>
            <div class="text-xs text-muted" *ngIf="v.billInvoiceNo">Ref: {{ v.billInvoiceNo }}</div>
          </td>
        </ng-container>

        <!-- Date -->
        <ng-container matColumnDef="date">
          <th mat-header-cell *matHeaderCellDef mat-sort-header="date" class="col-date">EXPENSE DATE</th>
          <td mat-cell *matCellDef="let v" class="col-date">
            <div class="font-semibold">{{ v.expenseDate | date:'mediumDate' }}</div>
            <div class="text-xs text-muted">{{ v.expenseDate | date:'shortTime' }}</div>
          </td>
        </ng-container>

        <!-- Title & Category -->
        <ng-container matColumnDef="title">
          <th mat-header-cell *matHeaderCellDef mat-sort-header="title" class="col-title">EXPENSE TITLE &amp; DETAILS</th>
          <td mat-cell *matCellDef="let v" class="col-title">
            <div class="title-text">{{ v.title }}</div>
            <div class="meta-row">
              <span class="badge cat-badge">{{ v.categoryName }}</span>
              <span class="text-xs text-muted" *ngIf="v.vendorName">&bull; Payee: <strong>{{ v.vendorName }}</strong></span>
              <span class="text-xs text-muted" *ngIf="v.branchName">&bull; {{ v.branchName }}</span>
            </div>
            <div class="text-xs text-muted note-text" *ngIf="v.description">{{ v.description }}</div>
          </td>
        </ng-container>

        <!-- Payment Mode -->
        <ng-container matColumnDef="mode">
          <th mat-header-cell *matHeaderCellDef mat-sort-header="mode" class="col-mode">PAYMENT MODE</th>
          <td mat-cell *matCellDef="let v" class="col-mode">
            <span class="mode-badge" [ngClass]="getModeClass(v.paymentMode)">
              <mat-icon class="mode-icon">{{ getModeIcon(v.paymentMode) }}</mat-icon>
              <span>{{ getModeLabel(v.paymentMode) }}</span>
            </span>
          </td>
        </ng-container>

        <!-- Amount -->
        <ng-container matColumnDef="amount">
          <th mat-header-cell *matHeaderCellDef mat-sort-header="amount" class="text-right col-amount">AMOUNT</th>
          <td mat-cell *matCellDef="let v" class="text-right col-amount">
            <div class="amount-val">₹{{ v.amount | number:'1.2-2' }}</div>
          </td>
        </ng-container>

        <!-- Actions -->
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef class="text-center col-actions">ACTIONS</th>
          <td mat-cell *matCellDef="let v" class="text-center col-actions">
            <div class="action-btn-group">
              <button mat-icon-button color="primary" matTooltip="Edit Voucher" (click)="openEditDialog(v)">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" matTooltip="Delete Voucher" (click)="deleteVoucher(v)">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>
          </td>
        </ng-container>

        <!-- Header and Row Definitions -->
        <tr mat-header-row *matHeaderRowDef="displayedColumns; sticky: true"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="table-row"></tr>
      </table>
    </div>

    <!-- Empty State -->
    <div class="empty-state" *ngIf="!loading && vouchers.length === 0">
      <div class="empty-icon-circle">
        <mat-icon>receipt_long</mat-icon>
      </div>
      <h3>No Expense Vouchers Found</h3>
      <p>No expense vouchers match your active filters and search query.</p>
      <div class="empty-actions">
        <button mat-stroked-button (click)="resetFilters()">Clear Filters</button>
        <button mat-raised-button color="primary" (click)="openCreateDialog()">
          <mat-icon>add_circle</mat-icon>
          <span>Record New Expense</span>
        </button>
      </div>
    </div>

    <!-- Paginator -->
    <div class="paginator-wrapper">
      <mat-paginator
        [length]="totalCount"
        [pageSize]="pageSize"
        [pageIndex]="pageNumber - 1"
        [pageSizeOptions]="[10, 15, 25, 50, 100]"
        [showFirstLastButtons]="true"
        (page)="onPageChange($event)">
      </mat-paginator>
    </div>
  </div>
</div>
  `,
  styles: [`
    .page-container {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      background: #f8fafc;
      min-height: calc(100vh - 64px);
    }

    /* Header Card */
    .header-card {
      background: #ffffff;
      border-radius: 12px;
      padding: 20px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-icon-box {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: #eff6ff;
      color: #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;

      mat-icon { font-size: 26px; width: 26px; height: 26px; }
    }

    .page-title {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
      letter-spacing: -0.02em;
    }

    .page-subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 4px 0 0 0;
    }

    .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .add-btn {
      background: #2563eb !important;
      color: #ffffff !important;
    }

    .spin-icon {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 16px;
    }

    .kpi-card {
      background: #ffffff;
      border-radius: 12px;
      padding: 16px 20px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .kpi-icon {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;

      &.total { background: #eff6ff; color: #2563eb; }
      &.cash { background: #ecfdf5; color: #059669; }
      &.bank { background: #f5f3ff; color: #7c3aed; }
      &.top-cat { background: #fff7ed; color: #ea580c; }
    }

    .kpi-content {
      display: flex;
      flex-direction: column;
    }

    .kpi-label {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .kpi-value {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      margin: 2px 0;

      &.cat-name {
        font-size: 16px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 170px;
      }
    }

    .kpi-sub {
      font-size: 11px;
      color: #94a3b8;
    }

    /* Filter Card */
    .filter-card {
      background: #ffffff;
      border-radius: 12px;
      padding: 16px 20px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03);
    }

    .filter-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
    }

    .filter-item {
      flex: 1 1 200px;
      min-width: 180px;
      margin-bottom: -1.25em; /* Compensate for mat-form-field subscript space */
    }

    .search-field {
      flex: 2 1 280px;
      min-width: 250px;
    }

    /* Table Card */
    .table-card {
      position: relative;
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
      overflow: hidden;
    }

    .top-progress-bar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 60;
      height: 4px;
    }

    .table-loading-overlay {
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.78);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 50;
    }

    .loader-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      background: #ffffff;
      padding: 24px 36px;
      border-radius: 16px;
      box-shadow: 0 12px 30px -5px rgba(0, 0, 0, 0.12);
      border: 1px solid #cbd5e1;
    }

    .loader-text-group {
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .loading-title {
      font-size: 14px;
      font-weight: 700;
      color: #1e3a8a;
    }

    .loading-sub {
      font-size: 12px;
      color: #64748b;
    }

    .table-responsive {
      overflow-x: auto;
      overflow-y: visible;
    }

    .expense-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
    }

    /* Prominent Sticky Header Row Styling */
    ::ng-deep .expense-table .mat-mdc-header-row {
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%) !important;
      position: sticky;
      top: 0;
      z-index: 20;
    }

    ::ng-deep .expense-table th.mat-mdc-header-cell {
      background: #f1f5f9 !important;
      color: #1e3a8a !important;
      font-size: 11.5px !important;
      font-weight: 700 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.06em !important;
      padding: 14px 16px !important;
      border-bottom: 2px solid #cbd5e1 !important;
      white-space: nowrap !important;
    }

    ::ng-deep .expense-table th.mat-sort-header-sorted {
      color: #2563eb !important;
    }

    ::ng-deep .expense-table td.mat-mdc-cell {
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }

    .table-row:hover {
      background: #f8fafc;
    }

    .voucher-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 700;
      color: #1e40af;
      background: #eff6ff;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;

      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }

    .title-text {
      font-weight: 600;
      color: #0f172a;
      font-size: 14px;
    }

    .note-text {
      margin-top: 2px;
      font-style: italic;
    }

    .meta-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 3px;
    }

    .cat-badge {
      background: #f1f5f9;
      color: #475569;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }

    .mode-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;

      .mode-icon { font-size: 14px; width: 14px; height: 14px; }

      &.cash { background: #ecfdf5; color: #047857; }
      &.upi { background: #fdf4ff; color: #a21caf; }
      &.bank { background: #eff6ff; color: #1d4ed8; }
      &.cheque { background: #fffbeb; color: #b45309; }
      &.card { background: #f3f4f6; color: #374151; }
    }

    .amount-val {
      font-size: 15px;
      font-weight: 800;
      color: #b91c1c;
    }

    .action-btn-group {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2px;
    }

    .col-voucher { width: 140px; }
    .col-date { width: 140px; }
    .col-title { min-width: 250px; }
    .col-mode { width: 150px; }
    .col-amount { width: 140px; }
    .col-actions { width: 100px; }

    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-xs { font-size: 11px; }
    .text-muted { color: #64748b; }
    .font-semibold { font-weight: 600; }

    .empty-state {
      padding: 48px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;

      .empty-icon-circle {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #f1f5f9;
        color: #94a3b8;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 4px;
        mat-icon { font-size: 28px; width: 28px; height: 28px; }
      }

      h3 {
        font-size: 16px;
        font-weight: 700;
        color: #334155;
        margin: 0;
      }

      p {
        font-size: 13px;
        color: #64748b;
        margin: 0;
      }

      .empty-actions {
        display: flex;
        gap: 10px;
        margin-top: 14px;
      }
    }

    .paginator-wrapper {
      border-top: 1px solid #e2e8f0;
      background: #fafbfc;
    }
  `]
})
export class ExpensesComponent implements OnInit, OnDestroy {
  loading = false;
  vouchers: ExpenseVoucherDto[] = [];
  categories: ExpenseCategoryDto[] = [];
  branches: any[] = [];

  ExpensePaymentMode = ExpensePaymentMode;

  // Filter States
  searchTerm = '';
  selectedCategoryId: string | null = null;
  selectedPaymentMode: ExpensePaymentMode | null = null;
  selectedBranchId: string | null = null;
  datePreset: 'this_month' | 'today' | 'this_fy' | 'all' | 'custom' = 'this_month';
  customFromDate: Date | null = null;
  customToDate: Date | null = null;

  // Server-Side Sorting States
  sortBy = 'date';
  sortDescending = true;
  sortDirection: SortDirection = 'desc';

  // Server-Side Pagination States
  pageNumber = 1;
  pageSize = 15;
  totalCount = 0;

  // Server-Side Aggregated KPI States
  totalAmountInView = 0;
  cashSpentInView = 0;
  bankSpentInView = 0;
  topCategoryName = '';

  displayedColumns = ['voucherNo', 'date', 'title', 'mode', 'amount', 'actions'];

  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  constructor(
    private financeService: FinanceService,
    private branchService: BranchService,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.searchSub = this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged()
    ).subscribe((term) => {
      this.pageNumber = 1;
      this.loadExpenses();
    });

    this.loadCategories();
    this.loadBranches();
    this.loadExpenses();
  }

  ngOnDestroy(): void {
    if (this.searchSub) {
      this.searchSub.unsubscribe();
    }
  }

  onSearchInput(val: string): void {
    this.searchSubject.next(val);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.searchSubject.next('');
  }

  loadCategories(): void {
    this.financeService.getExpenseCategories().subscribe({
      next: (c) => (this.categories = c || []),
      error: () => {}
    });
  }

  loadBranches(): void {
    this.branchService.getBranches().subscribe({
      next: (b) => (this.branches = b || []),
      error: () => {}
    });
  }

  loadExpenses(): void {
    this.loading = true;
    let from: string | undefined;
    let to: string | undefined;

    const now = new Date();
    if (this.datePreset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      from = start.toISOString();
      to = end.toISOString();
    } else if (this.datePreset === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      from = start.toISOString();
      to = end.toISOString();
    } else if (this.datePreset === 'this_fy') {
      const curYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const start = new Date(curYear, 3, 1, 0, 0, 0);
      const end = new Date(curYear + 1, 2, 31, 23, 59, 59);
      from = start.toISOString();
      to = end.toISOString();
    } else if (this.datePreset === 'custom' && this.customFromDate && this.customToDate) {
      from = this.customFromDate.toISOString();
      to = this.customToDate.toISOString();
    }

    this.financeService
      .getExpensesPaged({
        pageNumber: this.pageNumber,
        pageSize: this.pageSize,
        searchTerm: this.searchTerm ? this.searchTerm.trim() : undefined,
        categoryId: this.selectedCategoryId || undefined,
        branchId: this.selectedBranchId || undefined,
        paymentMode: this.selectedPaymentMode,
        sortBy: this.sortBy,
        sortDescending: this.sortDescending,
        fromDate: from,
        toDate: to
      })
      .subscribe({
        next: (res) => {
          this.vouchers = res.items || [];
          this.totalCount = res.totalCount || 0;
          this.totalAmountInView = res.totalFilteredAmount ?? 0;
          this.cashSpentInView = res.totalCashAmount ?? 0;
          this.bankSpentInView = res.totalBankAmount ?? 0;
          this.calculateTopCategory();
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        }
      });
  }

  calculateTopCategory(): void {
    if (this.vouchers.length === 0) {
      this.topCategoryName = '';
      return;
    }
    const catMap = new Map<string, number>();
    for (const v of this.vouchers) {
      const current = catMap.get(v.categoryName) || 0;
      catMap.set(v.categoryName, current + v.amount);
    }
    let max = 0;
    let topName = '';
    catMap.forEach((amt, name) => {
      if (amt > max) {
        max = amt;
        topName = name;
      }
    });
    this.topCategoryName = topName;
  }

  onSortChange(sort: Sort): void {
    if (!sort.active || sort.direction === '') {
      this.sortBy = 'date';
      this.sortDescending = true;
      this.sortDirection = 'desc';
    } else {
      this.sortBy = sort.active;
      this.sortDescending = sort.direction === 'desc';
      this.sortDirection = sort.direction;
    }
    this.pageNumber = 1;
    this.loadExpenses();
  }

  onPresetChange(): void {
    if (this.datePreset !== 'custom') {
      this.pageNumber = 1;
      this.loadExpenses();
    }
  }

  applyFilters(): void {
    this.pageNumber = 1;
    this.loadExpenses();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedCategoryId = null;
    this.selectedPaymentMode = null;
    this.selectedBranchId = null;
    this.datePreset = 'this_month';
    this.customFromDate = null;
    this.customToDate = null;
    this.sortBy = 'date';
    this.sortDescending = true;
    this.sortDirection = 'desc';
    this.pageNumber = 1;
    this.loadExpenses();
  }

  onPageChange(event: PageEvent): void {
    this.pageNumber = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadExpenses();
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(ExpenseDialogComponent, {
      data: { categories: this.categories },
      disableClose: true,
      autoFocus: false
    });

    ref.afterClosed().subscribe((created) => {
      if (created) {
        this.loadExpenses();
        this.loadCategories();
      }
    });
  }

  openEditDialog(v: ExpenseVoucherDto): void {
    const ref = this.dialog.open(ExpenseDialogComponent, {
      data: { voucher: v, categories: this.categories },
      disableClose: true,
      autoFocus: false
    });

    ref.afterClosed().subscribe((updated) => {
      if (updated) {
        this.loadExpenses();
      }
    });
  }

  deleteVoucher(v: ExpenseVoucherDto): void {
    this.confirmDialog
      .confirm(
        'Delete Expense Voucher?',
        `Are you sure you want to delete voucher "${v.voucherNo}" (${v.title} - ₹${v.amount})? This will alter financial reports.`,
        'Delete Voucher',
        'Cancel',
        'danger'
      )
      .subscribe((yes) => {
        if (yes) {
          this.financeService.deleteExpense(v.id).subscribe({
            next: () => {
              this.loadExpenses();
            },
            error: () => {}
          });
        }
      });
  }

  getModeLabel(mode: ExpensePaymentMode): string {
    switch (mode) {
      case ExpensePaymentMode.Cash: return 'Cash';
      case ExpensePaymentMode.UPI: return 'UPI / QR';
      case ExpensePaymentMode.BankTransfer: return 'Bank Transfer';
      case ExpensePaymentMode.Cheque: return 'Cheque';
      case ExpensePaymentMode.Card: return 'Card';
      default: return 'Other';
    }
  }

  getModeIcon(mode: ExpensePaymentMode): string {
    switch (mode) {
      case ExpensePaymentMode.Cash: return 'local_atm';
      case ExpensePaymentMode.UPI: return 'qr_code_2';
      case ExpensePaymentMode.BankTransfer: return 'account_balance';
      case ExpensePaymentMode.Cheque: return 'description';
      case ExpensePaymentMode.Card: return 'credit_card';
      default: return 'payments';
    }
  }

  getModeClass(mode: ExpensePaymentMode): string {
    switch (mode) {
      case ExpensePaymentMode.Cash: return 'cash';
      case ExpensePaymentMode.UPI: return 'upi';
      case ExpensePaymentMode.BankTransfer: return 'bank';
      case ExpensePaymentMode.Cheque: return 'cheque';
      case ExpensePaymentMode.Card: return 'card';
      default: return '';
    }
  }
}
