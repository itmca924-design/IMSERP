import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';
import { InventoryService } from './inventory.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { InventoryVendorDialogComponent } from './dialogs/inventory-vendor-dialog.component';
import { VendorPaymentDialogComponent, VendorPaymentDialogResult } from './dialogs/vendor-payment-dialog.component';
import {
  InventoryVendor,
  CreateUpdateVendorDto,
  RecordVendorPaymentDto,
  VendorLedgerSummary,
  VendorLedgerEntry
} from './inventory.models';

@Component({
  selector: 'app-vendor-ledger',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatChipsModule,
    MatDialogModule,
    MatPaginatorModule,
    MatSortModule,
    IstDatetimeDirective
  ],
  template: `
    <div class="page-container">
      <!-- 1. Header Toolbar -->
      <div class="page-header-row no-print">
        <div class="title-meta-wrap">
          <div class="title-badge-row">
            <span class="icon-avatar">
              <mat-icon>account_balance_wallet</mat-icon>
            </span>
            <div>
              <h1 class="page-title">Vendors &amp; Financial Ledger</h1>
              <p class="page-subtitle">
                Track supplier directories, monitor real-time credit balances, disburse payment vouchers, and review chronological ledger statements
              </p>
            </div>
          </div>
        </div>

        <div class="action-btn-group">
          <button
            mat-flat-button
            color="primary"
            (click)="openVendorDialog()"
            class="erp-btn">
            <mat-icon>person_add</mat-icon>
            <span>New Vendor</span>
          </button>

          <button mat-icon-button (click)="loadVendors()" matTooltip="Refresh Data" class="refresh-btn">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
      </div>

      <!-- Module Sub-Nav Bar -->
      <div class="module-nav-bar no-print">
        <a mat-button [routerLink]="['/inventory']" class="nav-tab">
          <mat-icon>inventory_2</mat-icon> Store &amp; Catalog
        </a>
        <a mat-button [routerLink]="['/inventory/purchase-returns']" class="nav-tab">
          <mat-icon>assignment_return</mat-icon> Purchase Returns (PR)
        </a>
        <a mat-button [routerLink]="['/inventory/sale-returns']" class="nav-tab">
          <mat-icon>keyboard_return</mat-icon> Kit &amp; Sale Returns (SR)
        </a>
        <a mat-button [routerLink]="['/inventory/vendors']" class="nav-tab active-tab">
          <mat-icon>account_balance_wallet</mat-icon> Vendors &amp; Ledger
        </a>
      </div>

      <!-- Single Prominent Loader Rule -->
      <mat-progress-bar *ngIf="loading" mode="indeterminate" class="global-loader no-print"></mat-progress-bar>

      <!-- 2. KPI Metrics Deck -->
      <div class="kpi-grid no-print">
        <mat-card class="kpi-card mat-elevation-z1">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Active Vendors</span>
              <span class="kpi-value text-primary">{{ vendorsList.length }}</span>
              <span class="kpi-meta text-muted">Suppliers registered</span>
            </div>
            <div class="kpi-icon-wrap bg-blue">
              <mat-icon>storefront</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card mat-elevation-z1">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Total Purchased</span>
              <span class="kpi-value text-slate">₹{{ totalPurchasedValue | number:'1.2-2' }}</span>
              <span class="kpi-meta text-muted">Gross supplies billed</span>
            </div>
            <div class="kpi-icon-wrap bg-slate">
              <mat-icon>inventory_2</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card mat-elevation-z1">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Total Paid Disbursed</span>
              <span class="kpi-value text-emerald">₹{{ totalPaidValue | number:'1.2-2' }}</span>
              <span class="kpi-meta text-muted">Settled via vouchers</span>
            </div>
            <div class="kpi-icon-wrap bg-green">
              <mat-icon>verified</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card mat-elevation-z1">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Net Balance Payable</span>
              <span class="kpi-value text-danger">₹{{ totalBalanceDueValue | number:'1.2-2' }}</span>
              <span class="kpi-meta text-muted">Live liability outstanding</span>
            </div>
            <div class="kpi-icon-wrap bg-red">
              <mat-icon>payments</mat-icon>
            </div>
          </div>
        </mat-card>
      </div>

      <!-- 4. Workspace Controls & Layout View Mode Switcher -->
      <div class="workspace-nav-bar no-print">
        <div class="workspace-title-box">
          <div class="ws-icon-circle">
            <mat-icon>{{ viewMode === 'split' ? 'view_sidebar' : 'table_chart' }}</mat-icon>
          </div>
          <div>
            <h2 class="workspace-heading">
              {{ viewMode === 'split' ? 'Supplier Accounts & Live Ledger Workspace' : 'Master Supplier Directory & Balance Registry' }}
            </h2>
            <p class="workspace-subheading">
              {{ viewMode === 'split' ? 'Select a supplier from the list to review chronological transactions, disburse payment vouchers, or print statements' : 'Consolidated directory of all registered suppliers with live purchase totals and outstanding balance payables' }}
            </p>
          </div>
        </div>

        <div class="view-mode-toggle-group">
          <button
            mat-button
            type="button"
            class="toggle-mode-btn"
            [class.active-toggle]="viewMode === 'split'"
            (click)="viewMode = 'split'">
            <mat-icon>view_sidebar</mat-icon>
            <span>Split Ledger View</span>
          </button>
          <button
            mat-button
            type="button"
            class="toggle-mode-btn"
            [class.active-toggle]="viewMode === 'table'"
            (click)="viewMode = 'table'">
            <mat-icon>table_chart</mat-icon>
            <span>All Suppliers Directory</span>
          </button>
        </div>
      </div>

      <!-- 6. SPLIT VIEW: Left Supplier Cards Deck + Right Ledger Workspace -->
      <div class="ledger-layout-grid no-print" *ngIf="viewMode === 'split'">
        <!-- LEFT: Elegant Supplier Directory Card -->
        <mat-card class="directory-card mat-elevation-z1">
          <div class="card-section-header">
            <div class="section-title-wrap">
              <mat-icon class="section-icon">contacts</mat-icon>
              <div>
                <h3 class="section-title">Supplier Directory</h3>
                <span class="section-sub">{{ filteredVendors.length }} of {{ vendorsList.length }} suppliers</span>
              </div>
            </div>

            <button mat-icon-button (click)="openVendorDialog()" matTooltip="Add New Vendor" class="mini-add-btn" type="button">
              <mat-icon>person_add</mat-icon>
            </button>
          </div>

          <!-- Search & Filter Controls -->
          <div class="directory-search-wrap">
            <form [formGroup]="filterForm" class="filter-inputs">
              <mat-form-field appearance="outline" class="search-field" subscriptSizing="dynamic">
                <mat-icon matPrefix>search</mat-icon>
                <input matInput formControlName="search" placeholder="Search supplier, GST, phone...">
                <button mat-icon-button matSuffix *ngIf="filterForm.get('search')?.value" (click)="filterForm.get('search')?.setValue('')" type="button">
                  <mat-icon class="icon-xs">close</mat-icon>
                </button>
              </mat-form-field>

              <mat-form-field appearance="outline" class="select-field" subscriptSizing="dynamic">
                <mat-select formControlName="status">
                  <mat-option value="ALL">All Suppliers ({{ vendorsList.length }})</mat-option>
                  <mat-option value="DUE_ONLY">With Balance Due</mat-option>
                  <mat-option value="NIL_ONLY">Settled / Nil Balance</mat-option>
                </mat-select>
              </mat-form-field>
            </form>
          </div>

          <!-- Clean Vertical Vendor Card List (No Squished 7-Column Table!) -->
          <div class="vendor-cards-deck">
            <div
              *ngFor="let v of filteredVendors"
              (click)="selectVendor(v)"
              class="vendor-card-item"
              [class.active-vendor-card]="selectedVendor?.id === v.id">

              <div class="card-top-row">
                <div class="vendor-title-block">
                  <div class="vendor-name-row">
                    <span class="vendor-name-text">{{ v.vendorName || v.name }}</span>
                    <mat-icon *ngIf="selectedVendor?.id === v.id" class="active-dot-icon" matTooltip="Currently Active">check_circle</mat-icon>
                  </div>
                  <span *ngIf="v.contactPerson" class="vendor-contact-person">
                    {{ v.contactPerson }} {{ v.phone ? '• ' + v.phone : '' }}
                  </span>
                </div>
                <span class="balance-pill" [class.pill-due]="(v.balanceDue ?? 0) > 0" [class.pill-settled]="(v.balanceDue ?? 0) <= 0">
                  {{ (v.balanceDue ?? 0) > 0 ? ('₹' + ((v.balanceDue ?? 0) | number:'1.2-2') + ' Due') : 'Settled' }}
                </span>
              </div>

              <div class="card-bottom-row">
                <span class="gstin-badge" *ngIf="v.gstin">GST: {{ v.gstin }}</span>
                <span class="city-text" *ngIf="!v.gstin && v.address">{{ v.address }}</span>
                <span class="city-text" *ngIf="!v.gstin && !v.address">Regular Supplier</span>
                <span class="total-purchased-sub">Billed: ₹{{ (v.totalPurchased ?? 0) | number:'1.0-0' }}</span>
              </div>
            </div>

            <div *ngIf="filteredVendors.length === 0" class="empty-vendors-deck">
              <mat-icon class="empty-deck-icon">search_off</mat-icon>
              <p>No suppliers matching filter</p>
              <button mat-stroked-button color="primary" class="btn-xs" (click)="openVendorDialog()">
                <mat-icon>add</mat-icon> Add Vendor
              </button>
            </div>
          </div>
        </mat-card>

        <!-- RIGHT: Dedicated Vendor Account Ledger Statement Workspace -->
        <mat-card class="statement-card mat-elevation-z1">
          <div *ngIf="!selectedVendor" class="no-selection-state">
            <mat-icon class="big-icon">receipt_long</mat-icon>
            <h3>No Supplier Selected</h3>
            <p>Select any vendor from the directory on the left to view their detailed live account ledger, debit/credit transactions, and print statements.</p>
          </div>

          <div *ngIf="selectedVendor" class="statement-content">
            <!-- Selected Vendor Header Strip -->
            <div class="statement-header-strip">
              <div class="vendor-headline">
                <div class="avatar-box">
                  <mat-icon>store</mat-icon>
                </div>
                <div class="headline-info">
                  <div class="title-with-actions">
                    <h2 class="vendor-headline-name">{{ selectedVendor.vendorName || selectedVendor.name }}</h2>
                    <button
                      mat-button
                      class="edit-profile-btn"
                      (click)="openVendorDialog(selectedVendor)"
                      matTooltip="Edit Supplier Profile (Phone, GSTIN, Address, Payment Terms)"
                      type="button">
                      <mat-icon class="icon-xs">edit</mat-icon>
                      <span>Edit Profile</span>
                    </button>
                  </div>
                  <div class="vendor-chips-row">
                    <span *ngIf="selectedVendor.contactPerson" class="meta-tag">
                      <mat-icon class="icon-xs">person</mat-icon> {{ selectedVendor.contactPerson }}
                    </span>
                    <span *ngIf="selectedVendor.phone" class="meta-tag">
                      <mat-icon class="icon-xs">phone</mat-icon> {{ selectedVendor.phone }}
                    </span>
                    <span *ngIf="selectedVendor.email" class="meta-tag">
                      <mat-icon class="icon-xs">email</mat-icon> {{ selectedVendor.email }}
                    </span>
                    <span *ngIf="selectedVendor.gstin" class="meta-tag">
                      <mat-icon class="icon-xs">fingerprint</mat-icon> GST: {{ selectedVendor.gstin }}
                    </span>
                    <span *ngIf="selectedVendor.paymentTerms" class="meta-tag terms-tag">
                      <mat-icon class="icon-xs">schedule</mat-icon> {{ selectedVendor.paymentTerms }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="statement-balance-box" [class.balance-credit-box]="(selectedVendor.balanceDue ?? 0) < 0">
                <span class="statement-lbl">
                  {{ (selectedVendor.balanceDue ?? 0) < 0 ? 'Advance Credit Balance (Debit Note)' : ((selectedVendor.balanceDue ?? 0) === 0 ? 'Current Balance (Settled)' : 'Current Outstanding Due') }}
                </span>
                <span class="statement-amt" [class.text-danger]="(selectedVendor.balanceDue ?? 0) > 0" [class.text-emerald]="(selectedVendor.balanceDue ?? 0) < 0" [class.text-muted]="(selectedVendor.balanceDue ?? 0) === 0">
                  ₹{{ Math.abs(selectedVendor.balanceDue ?? 0) | number:'1.2-2' }}
                  <small *ngIf="(selectedVendor.balanceDue ?? 0) < 0" class="credit-pill">Credit (Supplier owes)</small>
                  <small *ngIf="(selectedVendor.balanceDue ?? 0) > 0" class="due-pill">Payable</small>
                  <small *ngIf="(selectedVendor.balanceDue ?? 0) === 0" class="settled-pill">Nil / Settled</small>
                </span>
                <div class="statement-actions-row">
                  <!-- If vendor owes refund (balanceDue < 0), show prominent 'Receive Refund' button! -->
                  <button *ngIf="(selectedVendor.balanceDue ?? 0) < 0" mat-flat-button class="btn-action btn-refund" (click)="quickRefundVendor(selectedVendor)">
                    <mat-icon class="icon-sm">call_received</mat-icon> Receive Refund
                  </button>
                  <button *ngIf="(selectedVendor.balanceDue ?? 0) >= 0" mat-flat-button color="primary" class="btn-action" (click)="quickPayVendor(selectedVendor)">
                    <mat-icon class="icon-sm">payment</mat-icon> Pay Now
                  </button>
                  <button mat-stroked-button class="btn-action" (click)="printStatement()">
                    <mat-icon class="icon-sm">print</mat-icon> Print
                  </button>
                </div>
              </div>
            </div>

            <!-- Ledger Summary Mini Cards -->
            <div class="statement-mini-grid">
              <div class="mini-stat-card">
                <span class="mini-label">Total Billed Purchases</span>
                <span class="mini-val">₹{{ (ledgerSummary?.totalPurchased ?? selectedVendor.totalPurchased ?? 0) | number:'1.2-2' }}</span>
              </div>
              <div class="mini-stat-card">
                <span class="mini-label">Total Payments Settled</span>
                <span class="mini-val text-emerald">₹{{ (ledgerSummary?.totalPaid ?? selectedVendor.totalPaid ?? 0) | number:'1.2-2' }}</span>
              </div>
              <div class="mini-stat-card">
                <span class="mini-label">Total Debit Notes (PR)</span>
                <span class="mini-val text-amber">₹{{ (ledgerSummary?.totalReturns ?? selectedVendor.totalReturns ?? 0) | number:'1.2-2' }}</span>
              </div>
              <div class="mini-stat-card" *ngIf="(ledgerSummary?.totalRefunds ?? selectedVendor.totalRefunds ?? 0) > 0">
                <span class="mini-label">Refunds Received</span>
                <span class="mini-val text-emerald">₹{{ (ledgerSummary?.totalRefunds ?? selectedVendor.totalRefunds ?? 0) | number:'1.2-2' }}</span>
              </div>
              <div class="mini-stat-card highlight-mini-card" [class.highlight-credit]="(selectedVendor.balanceDue ?? 0) < 0">
                <span class="mini-label">
                  {{ (selectedVendor.balanceDue ?? 0) < 0 ? 'Net Advance Credit' : 'Net Balance Payable' }}
                </span>
                <span class="mini-val" [class.text-danger]="(selectedVendor.balanceDue ?? 0) > 0" [class.text-emerald]="(selectedVendor.balanceDue ?? 0) < 0" [class.text-muted]="(selectedVendor.balanceDue ?? 0) === 0">
                  ₹{{ Math.abs(ledgerSummary?.balanceDue ?? selectedVendor.balanceDue ?? 0) | number:'1.2-2' }}
                  <small *ngIf="(selectedVendor.balanceDue ?? 0) < 0"> (Cr)</small>
                  <small *ngIf="(selectedVendor.balanceDue ?? 0) > 0"> (Dr)</small>
                </span>
              </div>
            </div>

            <!-- Server-Side Search, Filter & Date Bar -->
            <div class="statement-filters-bar">
              <form [formGroup]="dateFilterForm" (ngSubmit)="applyDateFilter()" class="statement-filter-deck">
                <!-- Row 1: Search, Transaction Type, Payment Mode -->
                <div class="filter-primary-row">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filter-search-box">
                    <mat-icon matPrefix>search</mat-icon>
                    <input matInput formControlName="search" placeholder="Search by voucher #, bill #, particulars, items...">
                    <button mat-icon-button matSuffix *ngIf="dateFilterForm.get('search')?.value" (click)="clearSearch()" type="button" matTooltip="Clear Search">
                      <mat-icon class="icon-xs">close</mat-icon>
                    </button>
                  </mat-form-field>

                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filter-select-box">
                    <mat-label>Transaction Type</mat-label>
                    <mat-select formControlName="entryType">
                      <mat-option value="ALL">All Types</mat-option>
                      <mat-option value="InwardPurchase">Purchases / Inwards</mat-option>
                      <mat-option value="VendorPayment">Payment Vouchers</mat-option>
                      <mat-option value="VendorRefund">Refund Receipts</mat-option>
                      <mat-option value="PurchaseReturn">Debit Notes (PR)</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filter-select-box">
                    <mat-label>Payment Mode</mat-label>
                    <mat-select formControlName="paymentMode">
                      <mat-option value="ALL">All Modes</mat-option>
                      <mat-option value="Cash">Cash</mat-option>
                      <mat-option value="BankTransfer">Bank Transfer</mat-option>
                      <mat-option value="UPI">UPI</mat-option>
                      <mat-option value="Cheque">Cheque</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>

                <!-- Row 2: Preset Chips, Date Range, Filter & Reset -->
                <div class="filter-secondary-row">
                  <div class="preset-chips-deck">
                    <button type="button" mat-button class="preset-btn" [class.active-preset]="activeDatePreset === 'ALL'" (click)="setDatePreset('ALL')">All Dates</button>
                    <button type="button" mat-button class="preset-btn" [class.active-preset]="activeDatePreset === 'THIS_MONTH'" (click)="setDatePreset('THIS_MONTH')">This Month</button>
                    <button type="button" mat-button class="preset-btn" [class.active-preset]="activeDatePreset === 'LAST_MONTH'" (click)="setDatePreset('LAST_MONTH')">Last Month</button>
                    <button type="button" mat-button class="preset-btn" [class.active-preset]="activeDatePreset === 'THIS_FY'" (click)="setDatePreset('THIS_FY')">Current FY</button>
                  </div>

                  <div class="date-controls-line">
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date-input-field">
                      <mat-label>Start Date</mat-label>
                      <input matInput type="date" formControlName="startDate" [max]="dateFilterForm.get('endDate')?.value || ''" (change)="activeDatePreset = 'CUSTOM'">
                    </mat-form-field>

                    <span class="date-sep">to</span>

                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date-input-field" [class.field-has-error]="dateFilterForm.errors?.['dateRangeInvalid']">
                      <mat-label>End Date</mat-label>
                      <input matInput type="date" formControlName="endDate" [min]="dateFilterForm.get('startDate')?.value || ''" (change)="activeDatePreset = 'CUSTOM'">
                    </mat-form-field>

                    <button mat-flat-button color="primary" type="submit" class="filter-submit-btn" [disabled]="dateFilterForm.errors?.['dateRangeInvalid']">
                      <mat-icon class="icon-sm">filter_list</mat-icon> Filter
                    </button>
                    <button mat-button type="button" (click)="resetDateFilter()" class="reset-filter-btn">
                      Reset
                    </button>
                  </div>
                </div>

                <!-- Real-time Date Range Validation Alert -->
                <div *ngIf="dateFilterForm.errors?.['dateRangeInvalid']" class="date-validation-alert">
                  <mat-icon class="icon-xs">error_outline</mat-icon>
                  <span>Start Date cannot be later than End Date. Please select a valid date range.</span>
                </div>
              </form>
            </div>

            <!-- Single Prominent Table Loader -->
            <mat-progress-bar *ngIf="loadingLedger" mode="indeterminate" class="table-loader-bar"></mat-progress-bar>

            <!-- Chronological Ledger Entries Table with Server-Side Sorting & Pagination -->
            <div class="table-responsive statement-table-wrap">
              <table class="erp-table statement-table">
                <thead>
                  <tr>
                    <th class="sortable-th" [class.active-sort]="sortBy === 'date'" (click)="onSort('date')">
                      <div class="th-content">
                        <span>Date &amp; Time (IST)</span>
                        <mat-icon class="sort-icon">{{ sortBy === 'date' ? (sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}</mat-icon>
                      </div>
                    </th>
                    <th class="sortable-th" [class.active-sort]="sortBy === 'type'" (click)="onSort('type')">
                      <div class="th-content">
                        <span>Type</span>
                        <mat-icon class="sort-icon">{{ sortBy === 'type' ? (sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}</mat-icon>
                      </div>
                    </th>
                    <th class="sortable-th" [class.active-sort]="sortBy === 'ref'" (click)="onSort('ref')">
                      <div class="th-content">
                        <span>Ref / Voucher #</span>
                        <mat-icon class="sort-icon">{{ sortBy === 'ref' ? (sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}</mat-icon>
                      </div>
                    </th>
                    <th class="sortable-th" [class.active-sort]="sortBy === 'description'" (click)="onSort('description')">
                      <div class="th-content">
                        <span>Particulars &amp; Item Details</span>
                        <mat-icon class="sort-icon">{{ sortBy === 'description' ? (sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}</mat-icon>
                      </div>
                    </th>
                    <th class="sortable-th text-right" [class.active-sort]="sortBy === 'debit'" (click)="onSort('debit')">
                      <div class="th-content th-right">
                        <span>Debit (Paid/Return)</span>
                        <mat-icon class="sort-icon">{{ sortBy === 'debit' ? (sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}</mat-icon>
                      </div>
                    </th>
                    <th class="sortable-th text-right" [class.active-sort]="sortBy === 'credit'" (click)="onSort('credit')">
                      <div class="th-content th-right">
                        <span>Credit (Purchased)</span>
                        <mat-icon class="sort-icon">{{ sortBy === 'credit' ? (sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}</mat-icon>
                      </div>
                    </th>
                    <th class="sortable-th text-right" [class.active-sort]="sortBy === 'runningBalance'" (click)="onSort('runningBalance')">
                      <div class="th-content th-right">
                        <span>Running Balance</span>
                        <mat-icon class="sort-icon">{{ sortBy === 'runningBalance' ? (sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}</mat-icon>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let e of ledgerEntries">
                    <td class="font-mono text-sm whitespace-nowrap">
                      <span [appIstDatetime]="e.date" format="datetime"></span>
                    </td>
                    <td>
                      <span class="entry-type-chip" [ngClass]="getEntryTypeClass(e.entryType)">
                        {{ getEntryTypeLabel(e.entryType) }}
                      </span>
                    </td>
                    <td class="font-mono font-medium">{{ e.referenceNumber || '—' }}</td>
                    <td class="particulars-cell">{{ e.description || e.particulars || '—' }}</td>
                    <td class="text-right font-mono text-emerald font-semibold">
                      <span *ngIf="e.debit > 0">₹{{ e.debit | number:'1.2-2' }}</span>
                      <span *ngIf="e.debit === 0" class="text-muted">—</span>
                    </td>
                    <td class="text-right font-mono text-slate font-semibold">
                      <span *ngIf="e.credit > 0">₹{{ e.credit | number:'1.2-2' }}</span>
                      <span *ngIf="e.credit === 0" class="text-muted">—</span>
                    </td>
                    <td class="text-right font-mono font-bold" [class.text-danger]="e.runningBalance > 0" [class.text-emerald]="e.runningBalance <= 0">
                      ₹{{ e.runningBalance | number:'1.2-2' }}
                    </td>
                  </tr>

                  <tr *ngIf="ledgerEntries.length === 0 && !loadingLedger">
                    <td colspan="7" class="empty-cell">
                      <div class="empty-state">
                        <mat-icon class="empty-icon">receipt</mat-icon>
                        <p>No transactions found for this supplier matching filter criteria</p>
                        <button mat-stroked-button (click)="resetDateFilter()" class="mt-2" type="button">Reset Filters</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <!-- Server-side Material Paginator -->
              <mat-paginator
                [length]="totalEntries"
                [pageSize]="pageSize"
                [pageSizeOptions]="[10, 25, 50, 100]"
                [pageIndex]="pageIndex"
                (page)="onPageChange($event)"
                showFirstLastButtons
                class="statement-paginator">
              </mat-paginator>
            </div>
          </div>
        </mat-card>
      </div>

      <!-- 7. FULL DIRECTORY TABLE VIEW (When user switches to All Suppliers Spreadsheet Mode) -->
      <mat-card class="full-directory-card mat-elevation-z1 no-print" *ngIf="viewMode === 'table'">
        <div class="card-section-header">
          <div class="section-title-wrap">
            <mat-icon class="section-icon">table_chart</mat-icon>
            <div>
              <h3 class="section-title">All Registered Suppliers Registry</h3>
              <span class="section-sub">{{ filteredVendors.length }} supplier(s) matching current criteria</span>
            </div>
          </div>

          <div class="header-right-actions">
            <form [formGroup]="filterForm" class="filter-inputs">
              <mat-form-field appearance="outline" class="search-field" subscriptSizing="dynamic">
                <mat-icon matPrefix>search</mat-icon>
                <input matInput formControlName="search" placeholder="Search supplier, GST, phone...">
              </mat-form-field>

              <mat-form-field appearance="outline" class="select-field" subscriptSizing="dynamic">
                <mat-select formControlName="status">
                  <mat-option value="ALL">All Suppliers ({{ vendorsList.length }})</mat-option>
                  <mat-option value="DUE_ONLY">With Balance Due</mat-option>
                  <mat-option value="NIL_ONLY">Settled / Nil Balance</mat-option>
                </mat-select>
              </mat-form-field>
            </form>

            <button mat-flat-button color="primary" (click)="openVendorDialog()" class="erp-btn">
              <mat-icon>person_add</mat-icon>
              <span>New Vendor</span>
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="erp-table master-directory-table" matSort (matSortChange)="onMasterSortChange($event)">
            <thead>
              <tr>
                <th mat-sort-header="vendorName">Vendor / Business Name</th>
                <th mat-sort-header="contactPerson">Contact Person &amp; Phone</th>
                <th mat-sort-header="gstin">GSTIN / PAN</th>
                <th>Address / Location</th>
                <th mat-sort-header="paymentTerms">Payment Terms</th>
                <th mat-sort-header="totalPurchased" class="text-right">Total Purchased</th>
                <th mat-sort-header="totalPaid" class="text-right">Total Paid</th>
                <th mat-sort-header="totalReturns" class="text-right">Returns</th>
                <th mat-sort-header="balanceDue" class="text-right">Balance Due</th>
                <th class="text-center" style="min-width: 140px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let v of pagedVendors" class="master-table-row">
                <td>
                  <div class="vendor-primary-name font-bold">{{ v.vendorName || v.name }}</div>
                  <span *ngIf="v.email" class="text-muted text-xs">{{ v.email }}</span>
                </td>
                <td>
                  <div>{{ v.contactPerson || '—' }}</div>
                  <div *ngIf="v.phone" class="text-muted text-xs">{{ v.phone }}</div>
                </td>
                <td>
                  <div>{{ v.gstin || '—' }}</div>
                  <div *ngIf="v.pan" class="text-muted text-xs">PAN: {{ v.pan }}</div>
                </td>
                <td class="address-cell">{{ v.address || '—' }}</td>
                <td>{{ v.paymentTerms || 'Regular' }}</td>
                <td class="text-right font-mono font-medium">₹{{ (v.totalPurchased ?? 0) | number:'1.2-2' }}</td>
                <td class="text-right font-mono text-emerald font-semibold">₹{{ (v.totalPaid ?? 0) | number:'1.2-2' }}</td>
                <td class="text-right font-mono text-muted">₹{{ (v.totalReturns ?? 0) | number:'1.2-2' }}</td>
                <td class="text-right">
                  <span class="balance-badge" 
                    [class.balance-due]="(v.balanceDue ?? 0) > 0" 
                    [class.balance-credit]="(v.balanceDue ?? 0) < 0" 
                    [class.balance-settled]="(v.balanceDue ?? 0) === 0">
                    ₹{{ Math.abs(v.balanceDue ?? 0) | number:'1.2-2' }}
                    <small *ngIf="(v.balanceDue ?? 0) < 0"> Cr</small>
                    <small *ngIf="(v.balanceDue ?? 0) > 0"> Dr</small>
                  </span>
                </td>
                <td class="text-center">
                  <div class="table-actions-group">
                    <button mat-flat-button color="primary" class="btn-xs" (click)="viewVendorLedger(v)" matTooltip="Open Live Statement">
                      <mat-icon class="icon-xs">receipt_long</mat-icon> Ledger
                    </button>
                    <button *ngIf="(v.balanceDue ?? 0) < 0" mat-stroked-button class="btn-xs btn-refund-xs" (click)="quickRefundVendor(v)" matTooltip="Receive Refund from Supplier">
                      <mat-icon class="icon-xs">call_received</mat-icon> Refund
                    </button>
                    <button *ngIf="(v.balanceDue ?? 0) >= 0" mat-stroked-button color="accent" class="btn-xs" (click)="quickPayVendor(v)" matTooltip="Disburse Payment">
                      <mat-icon class="icon-xs">payment</mat-icon> Pay
                    </button>
                    <button mat-icon-button (click)="openVendorDialog(v)" matTooltip="Edit Profile" class="btn-icon-xs">
                      <mat-icon class="icon-xs">edit</mat-icon>
                    </button>
                  </div>
                </td>
              </tr>

              <tr *ngIf="filteredVendors.length === 0">
                <td colspan="10" class="empty-cell">
                  <div class="empty-state">
                    <mat-icon class="empty-icon">search_off</mat-icon>
                    <p>No vendors found matching filter criteria</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <mat-paginator
          [length]="filteredVendors.length"
          [pageSize]="masterPageSize"
          [pageIndex]="masterPageIndex"
          [pageSizeOptions]="[10, 25, 50, 100]"
          (page)="onMasterPageChange($event)"
          showFirstLastButtons
          class="statement-paginator">
        </mat-paginator>
      </mat-card>

      <!-- 6. Executive Printable Vendor Statement of Account (Only visible on print) -->
      <div class="only-print printable-ledger-sheet" *ngIf="selectedVendor">
        <!-- 1. Institution Header -->
        <div class="print-doc-header">
          <div class="inst-info-group">
            <div class="print-logo-box" *ngIf="getInstituteLogoUrl()">
              <img [src]="getInstituteLogoUrl()" alt="Logo" class="print-inst-logo">
            </div>
            <div class="inst-info">
              <h1 class="inst-title">{{ instituteName }}</h1>
              <p class="inst-subtitle">Accounts &amp; Financial Operations &bull; Central Procurement &amp; Inventory</p>
              <p class="inst-branch">Campus / Branch: <strong>{{ activeBranchName }}</strong></p>
            </div>
          </div>
          <div class="doc-badge-block">
            <div class="badge-title">SUPPLIER STATEMENT OF ACCOUNT</div>
            <div class="badge-sub">वित्तीय आपूर्तिकर्ता खाता विवरण (लेजर)</div>
            <div class="badge-date">
              Generated: <span [appIstDatetime]="todayDate" format="datetime"></span>
            </div>
          </div>
        </div>

        <!-- 2. Vendor & Statement Details Strip -->
        <div class="print-meta-grid">
          <div class="vendor-box">
            <div class="box-label">VENDOR / SUPPLIER DETAILS</div>
            <div class="vendor-name-row">
              <strong>{{ selectedVendor.name }}</strong>
              <span *ngIf="selectedVendor.gstin" class="gst-tag">GSTIN: {{ selectedVendor.gstin }}</span>
            </div>
            <div class="vendor-details-lines">
              <span *ngIf="selectedVendor.contactPerson"><strong>Contact Person:</strong> {{ selectedVendor.contactPerson }}</span>
              <span *ngIf="selectedVendor.phone"> &bull; <strong>Phone:</strong> {{ selectedVendor.phone }}</span>
              <span *ngIf="selectedVendor.email"> &bull; <strong>Email:</strong> {{ selectedVendor.email }}</span>
              <div *ngIf="selectedVendor.address" class="address-line"><strong>Address:</strong> {{ selectedVendor.address }}</div>
              <div *ngIf="selectedVendor.bankDetails" class="bank-line"><strong>Bank / UPI:</strong> {{ selectedVendor.bankDetails }}</div>
            </div>
          </div>

          <div class="period-box">
            <div class="box-label">STATEMENT PERIOD &amp; STATUS</div>
            <div class="period-line">
              <strong>Period:</strong>
              <span *ngIf="dateFilterForm.value.startDate && dateFilterForm.value.endDate">
                {{ dateFilterForm.value.startDate }} to {{ dateFilterForm.value.endDate }}
              </span>
              <span *ngIf="!dateFilterForm.value.startDate || !dateFilterForm.value.endDate">
                Complete Transaction History (All Dates)
              </span>
            </div>
            <div class="status-callout" [class.callout-due]="(selectedVendor.balanceDue ?? 0) > 0" [class.callout-settled]="(selectedVendor.balanceDue ?? 0) <= 0">
              <span class="status-lbl">CURRENT OUTSTANDING DUE</span>
              <span class="status-val">₹{{ (selectedVendor.balanceDue ?? 0) | number:'1.2-2' }}</span>
            </div>
          </div>
        </div>

        <!-- 3. Summary KPI Box -->
        <div class="print-kpi-summary">
          <div class="print-kpi-col">
            <span class="kpi-tag">TOTAL BILLED PURCHASES</span>
            <span class="kpi-num">₹{{ (ledgerSummary?.totalPurchased ?? selectedVendor.totalPurchased ?? 0) | number:'1.2-2' }}</span>
          </div>
          <div class="print-kpi-col">
            <span class="kpi-tag">TOTAL PAYMENTS SETTLED</span>
            <span class="kpi-num text-emerald">₹{{ (ledgerSummary?.totalPaid ?? selectedVendor.totalPaid ?? 0) | number:'1.2-2' }}</span>
          </div>
          <div class="print-kpi-col">
            <span class="kpi-tag">TOTAL RETURNS / DEBIT NOTES</span>
            <span class="kpi-num text-amber">₹{{ (ledgerSummary?.totalReturns ?? selectedVendor.totalReturns ?? 0) | number:'1.2-2' }}</span>
          </div>
          <div class="print-kpi-col highlight-col">
            <span class="kpi-tag">NET BALANCE PAYABLE</span>
            <span class="kpi-num text-danger">₹{{ (ledgerSummary?.balanceDue ?? selectedVendor.balanceDue ?? 0) | number:'1.2-2' }}</span>
          </div>
        </div>

        <!-- 4. Chronological Ledger Table -->
        <table class="print-table">
          <thead>
            <tr>
              <th style="width: 32px;">#</th>
              <th style="width: 125px;">Date &amp; Time (IST)</th>
              <th style="width: 95px;">Type</th>
              <th style="width: 110px;">Ref / Voucher #</th>
              <th>Particulars &amp; Item Details</th>
              <th style="width: 105px;" class="text-right">Debit (Paid/Return)</th>
              <th style="width: 105px;" class="text-right">Credit (Purchased)</th>
              <th style="width: 110px;" class="text-right">Running Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let e of ledgerEntries; let idx = index">
              <td class="text-center font-mono">{{ idx + 1 }}</td>
              <td class="font-mono">
                <span [appIstDatetime]="e.date" format="datetime"></span>
              </td>
              <td>
                <span class="print-entry-pill">{{ getEntryTypeLabel(e.entryType) }}</span>
              </td>
              <td class="font-mono font-bold">{{ e.referenceNumber || '—' }}</td>
              <td>{{ e.description || e.particulars || '—' }}</td>
              <td class="text-right font-mono">
                <span *ngIf="e.debit > 0">₹{{ e.debit | number:'1.2-2' }}</span>
                <span *ngIf="!e.debit || e.debit === 0" class="text-muted">—</span>
              </td>
              <td class="text-right font-mono">
                <span *ngIf="e.credit > 0">₹{{ e.credit | number:'1.2-2' }}</span>
                <span *ngIf="!e.credit || e.credit === 0" class="text-muted">—</span>
              </td>
              <td class="text-right font-mono font-bold">
                ₹{{ e.runningBalance | number:'1.2-2' }}
              </td>
            </tr>
            <tr *ngIf="ledgerEntries.length === 0">
              <td colspan="8" class="text-center" style="padding: 24px; color: #64748b;">
                No transactions recorded for this vendor within the selected period.
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="tfoot-row">
              <td colspan="5" class="text-right font-bold">TOTALS &amp; CLOSING BALANCE:</td>
              <td class="text-right font-mono font-bold">₹{{ totalLedgerDebit | number:'1.2-2' }}</td>
              <td class="text-right font-mono font-bold">₹{{ totalLedgerCredit | number:'1.2-2' }}</td>
              <td class="text-right font-mono font-bold text-danger">
                ₹{{ (selectedVendor.balanceDue ?? 0) | number:'1.2-2' }}
              </td>
            </tr>
          </tfoot>
        </table>

        <!-- 5. Signatures & Verification Block -->
        <div class="print-signatures-block">
          <div class="sig-col">
            <div class="sig-line"></div>
            <span class="sig-title">Prepared By (Store / Accounts)</span>
          </div>
          <div class="sig-col">
            <div class="sig-line"></div>
            <span class="sig-title">Verified By (Accountant / CFO)</span>
          </div>
          <div class="sig-col">
            <div class="sig-line"></div>
            <span class="sig-title">Authorized Signatory / Principal</span>
          </div>
          <div class="sig-col">
            <div class="sig-line"></div>
            <span class="sig-title">Supplier Signature &amp; Stamp</span>
          </div>
        </div>

        <!-- 6. Print Footer Note -->
        <div class="print-footer-note">
          <span>This is a computer-generated ledger statement issued by IMSERP. All amounts are in INR (₹).</span>
          <span>Page 1 of 1</span>
        </div>
      </div>

      <!-- 7. Printable Master Supplier Directory (Only visible on print when no vendor is selected) -->
      <div class="only-print printable-ledger-sheet" *ngIf="!selectedVendor">
        <div class="print-doc-header">
          <div class="inst-info-group">
            <div class="print-logo-box" *ngIf="getInstituteLogoUrl()">
              <img [src]="getInstituteLogoUrl()" alt="Logo" class="print-inst-logo">
            </div>
            <div class="inst-info">
              <h1 class="inst-title">{{ instituteName }}</h1>
              <p class="inst-subtitle">Accounts &amp; Financial Operations &bull; Central Procurement &amp; Inventory</p>
              <p class="inst-branch">Campus / Branch: <strong>{{ activeBranchName }}</strong></p>
            </div>
          </div>
          <div class="doc-badge-block">
            <div class="badge-title">MASTER SUPPLIER DIRECTORY</div>
            <div class="badge-sub">आपूर्तिकर्ता सूची एवं कुल बकाया</div>
            <div class="badge-date">
              Generated: <span [appIstDatetime]="todayDate" format="datetime"></span>
            </div>
          </div>
        </div>

        <div class="print-kpi-summary">
          <div class="print-kpi-col">
            <span class="kpi-tag">TOTAL REGISTERED VENDORS</span>
            <span class="kpi-num">{{ vendorsList.length }}</span>
          </div>
          <div class="print-kpi-col">
            <span class="kpi-tag">TOTAL PURCHASES BILLED</span>
            <span class="kpi-num">₹{{ totalPurchasedValue | number:'1.2-2' }}</span>
          </div>
          <div class="print-kpi-col">
            <span class="kpi-tag">TOTAL PAYMENTS DISBURSED</span>
            <span class="kpi-num text-emerald">₹{{ totalPaidValue | number:'1.2-2' }}</span>
          </div>
          <div class="print-kpi-col highlight-col">
            <span class="kpi-tag">TOTAL OUTSTANDING BALANCE DUE</span>
            <span class="kpi-num text-danger">₹{{ totalBalanceDueValue | number:'1.2-2' }}</span>
          </div>
        </div>

        <table class="print-table">
          <thead>
            <tr>
              <th style="width: 32px;">#</th>
              <th>Vendor Name</th>
              <th>Contact &amp; Phone</th>
              <th>GSTIN / Address</th>
              <th style="width: 110px;" class="text-right">Total Purchased</th>
              <th style="width: 110px;" class="text-right">Total Paid</th>
              <th style="width: 90px;" class="text-right">Returns</th>
              <th style="width: 120px;" class="text-right">Balance Due</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let v of filteredVendors; let idx = index">
              <td class="text-center font-mono">{{ idx + 1 }}</td>
              <td><strong>{{ v.name }}</strong></td>
              <td>{{ v.contactPerson || '—' }} {{ v.phone ? '• ' + v.phone : '' }}</td>
              <td>{{ v.gstin || '—' }} {{ v.address ? '• ' + v.address : '' }}</td>
              <td class="text-right font-mono">₹{{ (v.totalPurchased ?? 0) | number:'1.2-2' }}</td>
              <td class="text-right font-mono text-emerald">₹{{ (v.totalPaid ?? 0) | number:'1.2-2' }}</td>
              <td class="text-right font-mono text-muted">₹{{ (v.totalReturns ?? 0) | number:'1.2-2' }}</td>
              <td class="text-right font-mono font-bold text-danger">₹{{ (v.balanceDue ?? 0) | number:'1.2-2' }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="tfoot-row">
              <td colspan="4" class="text-right font-bold">TOTAL CONSOLIDATED DUE:</td>
              <td class="text-right font-mono font-bold">₹{{ totalPurchasedValue | number:'1.2-2' }}</td>
              <td class="text-right font-mono font-bold">₹{{ totalPaidValue | number:'1.2-2' }}</td>
              <td class="text-right font-mono font-bold">₹{{ totalReturnsValue | number:'1.2-2' }}</td>
              <td class="text-right font-mono font-bold text-danger">₹{{ totalBalanceDueValue | number:'1.2-2' }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .page-container {
      padding: 0 0 40px;
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* 1. Header Toolbar */
    .page-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
    }

    .title-meta-wrap {
      display: flex;
      align-items: center;
      flex: 1;
      min-width: 0;
    }

    .title-badge-row {
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
    }

    .icon-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      box-shadow: 0 4px 8px -2px rgba(16, 185, 129, 0.35);
    }

    .page-title {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.01em;
    }

    .page-subtitle {
      margin: 4px 0 0;
      font-size: 13px;
      color: #64748b;
    }

    .action-btn-group {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
      margin-left: auto;
    }

    @media (max-width: 768px) {
      .page-header-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
      }
      .action-btn-group {
        width: 100%;
        justify-content: flex-start;
      }
    }

    .erp-btn {
      font-weight: 600;
      border-radius: 8px;
      padding: 0 16px;
      height: 40px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .refresh-btn {
      color: #64748b;
    }

    .module-nav-bar {
      display: flex;
      gap: 8px;
      background: #f1f5f9;
      padding: 6px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      flex-wrap: wrap;
    }

    .nav-tab {
      font-weight: 600;
      font-size: 13px;
      color: #64748b;
      border-radius: 8px;
      height: 38px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease-in-out;
    }

    .nav-tab:hover {
      background: #e2e8f0;
      color: #1e293b;
    }

    .nav-tab.active-tab {
      background: #2563eb;
      color: #ffffff;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);
    }

    /* Single Prominent Loader */
    .global-loader {
      border-radius: 4px;
      height: 4px;
    }

    /* 2. KPI Metrics Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    @media (max-width: 1024px) {
      .kpi-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 640px) {
      .kpi-grid {
        grid-template-columns: 1fr;
      }
    }

    .kpi-card {
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      padding: 16px 20px;
      background: #ffffff;
    }

    .kpi-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .kpi-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .kpi-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #64748b;
    }

    .kpi-value {
      font-size: 22px;
      font-weight: 800;
      font-family: monospace, monospace;
      letter-spacing: -0.02em;
    }

    .kpi-meta {
      font-size: 12px;
    }

    .kpi-icon-wrap {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .bg-blue { background: #eff6ff; color: #2563eb; }
    .bg-slate { background: #f8fafc; color: #475569; }
    .bg-green { background: #ecfdf5; color: #059669; }
    .bg-red { background: #fef2f2; color: #dc2626; }
    .bg-emerald-badge { background: #059669 !important; color: #ffffff !important; }

    .text-primary { color: #2563eb; }
    .text-emerald { color: #059669; }
    .text-slate { color: #334155; }
    .text-danger { color: #dc2626; }
    .text-amber { color: #d97706; }
    .text-muted { color: #94a3b8; }
    .font-mono { font-family: monospace, monospace; }
    .font-medium { font-weight: 500; }
    .font-bold { font-weight: 700; }
    .whitespace-nowrap { white-space: nowrap; }

    /* 3. Embedded Form Cards */
    .embedded-form-card {
      border-radius: 12px;
      border: 1px solid #bfdbfe;
      background: #f8fafc;
      overflow: hidden;
    }

    .payment-form-card {
      border: 1px solid #a7f3d0;
      background: #f0fdf4;
    }

    .embedded-form-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 20px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
    }

    .payment-form-card .embedded-form-header {
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      border-bottom: 1px solid #a7f3d0;
    }

    .header-badge {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #2563eb;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }

    .form-title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #1e3a8a;
    }

    .payment-form-card .form-title {
      color: #065f46;
    }

    .form-sub {
      margin: 2px 0 0;
      font-size: 12px;
      color: #3b82f6;
    }

    .payment-form-card .form-sub {
      color: #047857;
    }

    .embedded-form-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    @media (max-width: 900px) {
      .form-grid-3 {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 600px) {
      .form-grid-3 {
        grid-template-columns: 1fr;
      }
    }

    .w-full {
      width: 100%;
    }

    .payment-preview-banner {
      display: flex;
      align-items: center;
      gap: 16px;
      background: #ffffff;
      border: 1px dashed #10b981;
      border-radius: 8px;
      padding: 12px 16px;
      flex-wrap: wrap;
    }

    .preview-item {
      display: flex;
      flex-direction: column;
    }

    .preview-lbl {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
    }

    .preview-val {
      font-size: 16px;
      font-weight: 800;
      font-family: monospace, monospace;
    }

    .preview-arrow {
      color: #94a3b8;
    }

    .form-actions-bar {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
    }

    /* 4. Master-Detail Layout Grid */
    /* 5. Workspace Controls & Layout View Mode Switcher */
    .workspace-nav-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 18px;
      gap: 16px;
      flex-wrap: wrap;
    }

    .workspace-title-box {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .ws-icon-circle {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: #eff6ff;
      color: #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .workspace-heading {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
    }

    .workspace-subheading {
      margin: 2px 0 0;
      font-size: 12px;
      color: #64748b;
    }

    .view-mode-toggle-group {
      display: flex;
      background: #f1f5f9;
      padding: 4px;
      border-radius: 10px;
      gap: 4px;
    }

    .toggle-mode-btn {
      height: 34px !important;
      padding: 0 12px !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      color: #64748b !important;
      border-radius: 8px !important;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;

      mat-icon {
        font-size: 17px;
        width: 17px;
        height: 17px;
        margin-right: 4px;
      }

      &.active-toggle {
        background: #2563eb !important;
        color: #ffffff !important;
        box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
      }
    }

    /* 6. Master-Detail Split Layout Grid */
    .ledger-layout-grid {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 18px;
      align-items: start;
    }

    @media (max-width: 1100px) {
      .ledger-layout-grid {
        grid-template-columns: 1fr;
      }
    }

    .directory-card, .statement-card {
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      overflow: hidden;
      min-height: 480px;
    }

    .card-section-header {
      padding: 14px 18px;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
    }

    .section-title-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .section-icon {
      color: #2563eb;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .section-title {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
    }

    .section-sub {
      font-size: 11px;
      color: #64748b;
    }

    .mini-add-btn {
      color: #2563eb;
      background: #eff6ff;
      width: 32px;
      height: 32px;
      line-height: 32px;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        line-height: 18px;
      }

      &:hover {
        background: #dbeafe;
      }
    }

    /* Search & Filter in Supplier List */
    .directory-search-wrap {
      padding: 12px 14px 8px;
      border-bottom: 1px solid #f1f5f9;
      background: #ffffff;
    }

    .filter-inputs {
      display: flex;
      gap: 8px;
      width: 100%;
    }

    .search-field {
      flex: 1.4;
      font-size: 12px;
    }

    .select-field {
      flex: 1;
      font-size: 12px;
    }

    /* Vertical Supplier Cards Deck */
    .vendor-cards-deck {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 14px 16px;
      max-height: calc(100vh - 270px);
      min-height: 400px;
      overflow-y: auto;
    }

    .vendor-card-item {
      position: relative;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 12px;
      cursor: pointer;
      transition: all 0.15s ease-in-out;
      display: flex;
      flex-direction: column;
      gap: 6px;
      border-left: 3px solid transparent;

      &:hover {
        background: #f1f5f9;
        border-color: #cbd5e1;
        border-left-color: #93c5fd;
        transform: translateY(-1px);
      }

      &.active-vendor-card {
        background: #eff6ff;
        border-color: #3b82f6;
        border-left: 4px solid #2563eb;
        box-shadow: 0 2px 8px rgba(37, 99, 235, 0.12);

        .vendor-name-text {
          color: #1e40af;
        }
      }
    }

    .card-top-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }

    .vendor-title-block {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }

    .vendor-name-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .vendor-name-text {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .active-dot-icon {
      font-size: 15px !important;
      width: 15px !important;
      height: 15px !important;
      line-height: 15px !important;
      color: #2563eb;
    }

    .vendor-contact-person {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-bottom-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #64748b;
      border-top: 1px dashed #e2e8f0;
      padding-top: 5px;
      margin-top: 2px;
    }

    .balance-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 12px;
      white-space: nowrap;
      font-family: monospace, monospace;

      &.pill-due {
        background: #fee2e2;
        color: #b91c1c;
        border: 1px solid #fca5a5;
      }

      &.pill-settled {
        background: #dcfce7;
        color: #15803d;
        border: 1px solid #86efac;
      }
    }

    .gstin-badge {
      background: #e2e8f0;
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      color: #334155;
    }

    .city-text {
      font-size: 11px;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 130px;
    }

    .total-purchased-sub {
      font-weight: 600;
      color: #475569;
    }

    .empty-vendors-deck {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 16px;
      color: #94a3b8;
      text-align: center;
      gap: 8px;

      .empty-deck-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
      }

      p {
        margin: 0;
        font-size: 13px;
      }
    }

    /* Statement Area */
    .no-selection-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 24px;
      text-align: center;
      color: #64748b;
    }

    .big-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #cbd5e1;
      margin-bottom: 16px;
    }

    .no-selection-state h3 {
      margin: 0;
      font-size: 18px;
      color: #1e293b;
      font-weight: 700;
    }

    .no-selection-state p {
      max-width: 400px;
      margin: 8px 0 0;
      font-size: 13px;
      line-height: 1.5;
    }

    .statement-content {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .statement-header-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 18px;
      flex-wrap: wrap;
      gap: 14px;
    }

    .vendor-headline {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .avatar-box {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: #2563eb;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }

    .headline-info {
      display: flex;
      flex-direction: column;
    }

    .title-with-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .vendor-headline-name {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
    }

    .edit-profile-btn {
      height: 26px !important;
      line-height: 26px !important;
      padding: 0 10px !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      border-radius: 13px !important;
      color: #2563eb !important;
      background: #eff6ff !important;
      border: 1px solid #bfdbfe !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      cursor: pointer;
      transition: all 0.15s ease-in-out;

      mat-icon {
        font-size: 13px !important;
        width: 13px !important;
        height: 13px !important;
        line-height: 13px !important;
        margin: 0 !important;
      }

      &:hover {
        background: #dbeafe !important;
        border-color: #93c5fd !important;
        color: #1d4ed8 !important;
        box-shadow: 0 1px 3px rgba(37, 99, 235, 0.15);
      }
    }

    .vendor-chips-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
      flex-wrap: wrap;
    }

    .meta-tag {
      font-size: 11px;
      color: #475569;
      background: #e2e8f0;
      padding: 2px 7px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }

    .terms-tag {
      background: #e0f2fe;
      color: #0284c7;
    }

    .statement-balance-box {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .statement-lbl {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
    }

    .statement-amt {
      font-size: 22px;
      font-weight: 800;
      font-family: monospace, monospace;
    }

    .statement-actions-row {
      display: flex;
      gap: 8px;
      margin-top: 6px;
    }

    .btn-action {
      height: 32px !important;
      line-height: 32px !important;
      font-size: 12px !important;
      padding: 0 12px !important;
      border-radius: 6px !important;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    /* Statement mini stats */
    .statement-mini-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }

    @media (max-width: 768px) {
      .statement-mini-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .mini-stat-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;

      &.highlight-mini-card {
        background: #fef2f2;
        border-color: #fecaca;
      }
    }

    .mini-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      color: #64748b;
    }

    .mini-val {
      font-size: 15px;
      font-weight: 700;
      font-family: monospace, monospace;
      margin-top: 2px;
    }

    /* Date Filter with Real-Time Validation */
    .statement-filters-bar {
      display: flex;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
    }

    .statement-filter-deck {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
    }

    .filter-primary-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .filter-search-box {
      flex: 1;
      min-width: 250px;
    }

    .filter-select-box {
      min-width: 180px;
    }

    .filter-secondary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .preset-chips-deck {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .preset-btn {
      height: 26px !important;
      line-height: 26px !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      padding: 0 10px !important;
      border-radius: 13px !important;
      background: #e2e8f0 !important;
      color: #475569 !important;

      &:hover {
        background: #cbd5e1 !important;
      }

      &.active-preset {
        background: #2563eb !important;
        color: #ffffff !important;
      }
    }

    .date-controls-line {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .date-input-field {
      max-width: 170px;
    }

    .date-sep {
      font-size: 12px;
      color: #64748b;
      font-weight: 600;
    }

    .filter-submit-btn {
      height: 38px;
      border-radius: 6px;
      font-weight: 600;
    }

    .reset-filter-btn {
      height: 38px;
      color: #64748b;
    }

    .date-validation-alert {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      padding: 6px 12px;
      color: #dc2626;
      font-size: 12px;
      font-weight: 600;
    }

    .field-has-error {
      ::ng-deep .mat-mdc-text-field-wrapper {
        border-color: #ef4444 !important;
      }
    }

    .table-loader-bar {
      height: 3px;
      margin-bottom: -3px;
      position: relative;
      z-index: 2;
    }

    /* Statement Table */
    .statement-table-wrap {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow-x: auto;
      background: #ffffff;
    }

    .table-responsive {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      width: 100%;
    }

    .erp-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;

      th {
        background: #f8fafc;
        color: #475569;
        font-weight: 600;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 10px 14px;
        border-bottom: 1px solid #e2e8f0;
        white-space: nowrap;
        text-align: left;
      }

      td {
        padding: 10px 14px;
        border-bottom: 1px solid #f1f5f9;
        color: #1e293b;
      }
    }

    .sortable-th {
      cursor: pointer;
      user-select: none;
      transition: background 0.15s ease, color 0.15s ease;

      &:hover {
        background: #f1f5f9 !important;
        color: #0f172a !important;

        .sort-icon {
          color: #2563eb !important;
          opacity: 0.8 !important;
        }
      }

      &.active-sort {
        background: #eff6ff !important;
        color: #1e40af !important;

        .sort-icon {
          color: #2563eb !important;
          opacity: 1 !important;
        }
      }
    }

    .th-content {
      display: inline-flex;
      align-items: center;
      gap: 6px;

      &.th-right {
        justify-content: flex-end;
        width: 100%;
      }
    }

    .sort-icon {
      font-size: 15px !important;
      width: 15px !important;
      height: 15px !important;
      line-height: 15px !important;
      color: #94a3b8;
      opacity: 0.6;
      transition: all 0.15s ease;
    }

    .statement-paginator {
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 0 0 8px 8px;
    }

    .text-right { text-align: right !important; }
    .text-center { text-align: center !important; }

    .entry-type-chip {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    .chip-purchase { background: #e0f2fe; color: #0369a1; }
    .chip-payment { background: #dcfce7; color: #15803d; }
    .chip-refund { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .chip-return { background: #fef3c7; color: #b45309; }

    .particulars-cell {
      max-width: 240px;
      white-space: normal;
      font-size: 12px;
      color: #475569;
    }

    .empty-cell {
      text-align: center;
      padding: 40px !important;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      color: #94a3b8;
    }

    .empty-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    /* Full Directory Table View */
    .full-directory-card {
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      overflow: hidden;
    }

    .header-right-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .master-directory-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;

      th {
        background: #f8fafc;
        color: #475569;
        font-weight: 600;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 12px 14px;
        border-bottom: 1px solid #e2e8f0;
        white-space: nowrap;
        text-align: left;
      }

      td {
        padding: 12px 14px;
        border-bottom: 1px solid #f1f5f9;
        vertical-align: middle;
      }
    }

    .master-table-row:hover {
      background: #f8fafc;
    }

    .address-cell {
      max-width: 200px;
      white-space: normal;
      font-size: 12px;
      color: #475569;
    }

    .balance-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-family: monospace, monospace;
      font-weight: 700;
    }

    .balance-due {
      background: #fef2f2;
      color: #dc2626;
      border: 1px solid #fecaca;
    }

    .balance-credit {
      background: #ecfdf5;
      color: #059669;
      border: 1px solid #a7f3d0;
    }

    .balance-settled {
      background: #f8fafc;
      color: #64748b;
      border: 1px solid #e2e8f0;
    }

    .btn-refund-xs {
      color: #059669 !important;
      border-color: #a7f3d0 !important;
      background: #ecfdf5 !important;
      font-weight: 600;

      &:hover {
        background: #d1fae5 !important;
      }
    }

    .btn-refund {
      background: #059669 !important;
      color: #ffffff !important;
      font-weight: 600;

      &:hover {
        background: #047857 !important;
      }
    }

    .balance-credit-box {
      border-color: #a7f3d0 !important;
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%) !important;
    }

    .credit-pill {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 12px;
      background: #d1fae5;
      color: #065f46;
      margin-left: 6px;
      vertical-align: middle;
    }

    .due-pill {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 12px;
      background: #fee2e2;
      color: #b91c1c;
      margin-left: 6px;
      vertical-align: middle;
    }

    .settled-pill {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 12px;
      background: #f1f5f9;
      color: #64748b;
      margin-left: 6px;
      vertical-align: middle;
    }

    .voucher-type-switch-row {
      margin-bottom: 20px;
      display: flex;
      justify-content: flex-start;
    }

    .voucher-type-toggle {
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #cbd5e1;
      background: #ffffff;
    }

    .voucher-type-toggle mat-button-toggle {
      padding: 2px 10px;
      font-weight: 600;
      font-size: 13px;
    }

    .toggle-ic {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: 6px;
      vertical-align: middle;
    }

    .opt-credit { color: #059669; font-weight: 600; font-size: 12px; }
    .opt-due { color: #dc2626; font-weight: 600; font-size: 12px; }
    .opt-nil { color: #94a3b8; font-size: 12px; }
    .refund-mode-card { border-top: 4px solid #059669 !important; }
    .refund-preview-banner { border-left-color: #059669 !important; background: #f0fdf4 !important; }
    .sub-badge { font-size: 11px; font-weight: 600; margin-left: 4px; }
    .highlight-credit { border-top-color: #059669 !important; }

    .table-actions-group {
      display: flex;
      gap: 6px;
      align-items: center;
      justify-content: center;
    }

    .btn-xs {
      height: 28px;
      line-height: 28px;
      font-size: 11px;
      padding: 0 8px;
      border-radius: 6px;
    }

    .btn-icon-xs {
      width: 28px;
      height: 28px;
      line-height: 28px;
      color: #64748b;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      &:hover {
        color: #2563eb;
      }
    }

    .icon-xs {
      font-size: 14px;
      width: 14px;
      height: 14px;
      margin-right: 2px;
    }

    .icon-sm {
      font-size: 16px;
      width: 16px;
      height: 16px;
      margin-right: 4px;
    }

    .only-print {
      display: none;
    }

    @media print {
      .no-print {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        width: 0 !important;
      }

      .only-print {
        display: block !important;
        visibility: visible !important;
      }

      :host {
        display: block !important;
        width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
        background: #ffffff !important;
      }

      .page-container {
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        gap: 0 !important;
      }

      .printable-ledger-sheet {
        display: block !important;
        width: 100% !important;
        background: #ffffff !important;
        color: #0f172a !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        padding: 8mm 6mm !important;
        box-sizing: border-box !important;
        page-break-after: avoid;
      }

      .print-doc-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: flex-start !important;
        padding-bottom: 12px !important;
        border-bottom: 2px solid #0f172a !important;
        margin-bottom: 12px !important;

        .inst-info-group {
          display: flex !important;
          align-items: center !important;
          gap: 14px !important;
        }

        .print-logo-box {
          width: 52px !important;
          height: 52px !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          overflow: visible !important;
          flex-shrink: 0 !important;

          .print-inst-logo {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }

        .inst-title {
          font-size: 20px !important;
          font-weight: 800 !important;
          color: #0f172a !important;
          margin: 0 0 2px 0 !important;
          text-transform: uppercase !important;
          letter-spacing: -0.3px !important;
        }

        .inst-subtitle {
          font-size: 11px !important;
          color: #475569 !important;
          margin: 0 0 2px 0 !important;
        }

        .inst-branch {
          font-size: 11px !important;
          color: #1e40af !important;
          margin: 0 !important;
        }

        .doc-badge-block {
          text-align: right !important;

          .badge-title {
            font-size: 13px !important;
            font-weight: 800 !important;
            color: #1e40af !important;
            letter-spacing: 0.5px !important;
          }

          .badge-sub {
            font-size: 10px !important;
            color: #64748b !important;
          }

          .badge-date {
            font-size: 11px !important;
            font-weight: 600 !important;
            color: #0f172a !important;
            margin-top: 4px !important;
          }
        }
      }

      .print-meta-grid {
        display: grid !important;
        grid-template-columns: 1.6fr 1.2fr !important;
        gap: 12px !important;
        padding: 10px 12px !important;
        background: #f8fafc !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 6px !important;
        margin-bottom: 12px !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;

        .box-label {
          font-size: 9px !important;
          font-weight: 800 !important;
          color: #64748b !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          margin-bottom: 4px !important;
        }

        .vendor-name-row {
          font-size: 13px !important;
          color: #0f172a !important;
          margin-bottom: 3px !important;

          .gst-tag {
            font-size: 10.5px !important;
            background: #e2e8f0 !important;
            padding: 1px 6px !important;
            border-radius: 4px !important;
            margin-left: 6px !important;
            font-weight: 600 !important;
          }
        }

        .vendor-details-lines {
          font-size: 10.5px !important;
          color: #334155 !important;
          line-height: 1.35 !important;

          .address-line, .bank-line {
            margin-top: 2px !important;
          }
        }

        .period-line {
          font-size: 10.5px !important;
          color: #334155 !important;
          margin-bottom: 6px !important;
        }

        .status-callout {
          padding: 6px 10px !important;
          border-radius: 4px !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          border: 1px solid #fca5a5 !important;
          background: #fef2f2 !important;

          &.callout-settled {
            border-color: #86efac !important;
            background: #f0fdf4 !important;
            .status-val { color: #16a34a !important; }
          }

          .status-lbl {
            font-size: 9px !important;
            font-weight: 800 !important;
            color: #991b1b !important;
            text-transform: uppercase !important;
          }

          .status-val {
            font-size: 12px !important;
            font-weight: 800 !important;
            color: #dc2626 !important;
          }
        }
      }

      .print-kpi-summary {
        display: grid !important;
        grid-template-columns: repeat(4, 1fr) !important;
        gap: 8px !important;
        margin-bottom: 12px !important;

        .print-kpi-col {
          padding: 6px 8px !important;
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 6px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 2px !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;

          &.highlight-col {
            background: #fff1f2 !important;
            border-color: #fecdd3 !important;
          }

          .kpi-tag {
            font-size: 8px !important;
            font-weight: 700 !important;
            color: #64748b !important;
            text-transform: uppercase !important;
          }

          .kpi-num {
            font-size: 12px !important;
            font-weight: 800 !important;
            color: #0f172a !important;
          }
        }
      }

      .print-table {
        width: 100% !important;
        border-collapse: collapse !important;
        font-size: 9.5px !important;
        margin-bottom: 20px !important;

        th {
          background: #eff6ff !important;
          color: #1e3a8a !important;
          border-top: 1.5px solid #93c5fd !important;
          border-bottom: 2px solid #93c5fd !important;
          padding: 5px 6px !important;
          font-weight: 700 !important;
          text-align: left !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        td {
          padding: 5px 6px !important;
          border-bottom: 1px solid #e2e8f0 !important;
          color: #1e293b !important;
        }

        .print-entry-pill {
          display: inline-block !important;
          padding: 1px 4px !important;
          border-radius: 3px !important;
          font-size: 8.5px !important;
          font-weight: 700 !important;
          background: #f1f5f9 !important;
          border: 1px solid #cbd5e1 !important;
        }

        .tfoot-row td {
          background: #f8fafc !important;
          border-top: 2px solid #0f172a !important;
          border-bottom: 2px solid #0f172a !important;
          padding: 6px 8px !important;
          font-size: 10.5px !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }

      .print-signatures-block {
        display: flex !important;
        justify-content: space-between !important;
        margin-top: 40px !important;
        padding-top: 12px !important;
        page-break-inside: avoid !important;

        .sig-col {
          width: 150px !important;
          text-align: center !important;

          .sig-line {
            border-bottom: 1px dashed #475569 !important;
            margin-bottom: 6px !important;
            height: 1px !important;
          }

          .sig-title {
            font-size: 9.5px !important;
            font-weight: 700 !important;
            color: #334155 !important;
          }
        }
      }

      .print-footer-note {
        display: flex !important;
        justify-content: space-between !important;
        margin-top: 20px !important;
        padding-top: 6px !important;
        border-top: 1px solid #e2e8f0 !important;
        font-size: 8px !important;
        color: #94a3b8 !important;
        page-break-inside: avoid !important;
      }
    }
  `]
})
export class VendorLedgerComponent implements OnInit {
  readonly Math = Math;
  private readonly inventoryService = inject(InventoryService);
  public readonly authService = inject(AuthService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);

  loading = false;
  loadingLedger = false;

  viewMode: 'split' | 'table' = 'split';
  activeDatePreset: 'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_FY' | 'CUSTOM' = 'ALL';

  // Master Directory Table Grid State
  masterPageIndex = 0;
  masterPageSize = 10;
  masterSortBy = 'vendorName';
  masterSortAsc = true;

  // Server-side Ledger Grid State
  pageIndex = 0;
  pageSize = 10;
  totalEntries = 0;
  sortBy = 'date';
  sortDirection: 'asc' | 'desc' = 'asc';

  vendorsList: InventoryVendor[] = [];
  selectedVendor: InventoryVendor | null = null;

  ledgerSummary: VendorLedgerSummary | null = null;
  ledgerEntries: VendorLedgerEntry[] = [];

  // Reactive Forms
  filterForm!: FormGroup;
  dateFilterForm!: FormGroup;

  ngOnInit(): void {
    this.initForms();
    this.loadVendors();
  }

  private initForms(): void {
    this.filterForm = this.fb.group({
      search: [''],
      status: ['ALL']
    });

    this.filterForm.valueChanges.subscribe(() => {
      this.masterPageIndex = 0;
    });

    this.dateFilterForm = this.fb.group(
      {
        search: [''],
        entryType: ['ALL'],
        paymentMode: ['ALL'],
        startDate: [''],
        endDate: ['']
      },
      {
        validators: (group: AbstractControl): ValidationErrors | null => {
          const start = group.get('startDate')?.value;
          const end = group.get('endDate')?.value;
          if (start && end && start > end) {
            return { dateRangeInvalid: true };
          }
          return null;
        }
      }
    );

    // Instant server-side search with debounce
    this.dateFilterForm.get('search')?.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged()
    ).subscribe(() => {
      this.loadLedger(0);
    });

    // Dropdown filters: Transaction Type & Payment Mode
    this.dateFilterForm.get('entryType')?.valueChanges.subscribe(() => {
      this.loadLedger(0);
    });

    this.dateFilterForm.get('paymentMode')?.valueChanges.subscribe(() => {
      this.loadLedger(0);
    });
  }

  loadVendors(selectedId?: string): void {
    this.loading = true;
    const branchId = this.authService.selectedBranchId() || undefined;

    this.inventoryService.getVendors(branchId).subscribe({
      next: (vendors) => {
        this.vendorsList = vendors;
        this.loading = false;

        if (selectedId) {
          const match = vendors.find(v => v.id === selectedId);
          if (match) {
            this.selectVendor(match);
            return;
          }
        }

        // If a vendor was already selected, update reference
        if (this.selectedVendor) {
          const updated = vendors.find(v => v.id === this.selectedVendor!.id);
          if (updated) {
            this.selectedVendor = updated;
            this.loadLedger(this.pageIndex);
          } else if (vendors.length > 0) {
            this.selectVendor(vendors[0]);
          } else {
            this.selectedVendor = null;
            this.ledgerEntries = [];
            this.ledgerSummary = null;
          }
        } else if (vendors.length > 0) {
          // Auto select first vendor for convenience
          this.selectVendor(vendors[0]);
        }
      },
      error: () => {
        this.loading = false;
        this.confirmDialog.alert('Error', 'Failed to load vendors list. Please try again.');
      }
    });
  }

  get filteredVendors(): InventoryVendor[] {
    const search = (this.filterForm?.get('search')?.value || '').toLowerCase().trim();
    const status = this.filterForm?.get('status')?.value || 'ALL';

    return this.vendorsList.filter(v => {
      // Status filter
      if (status === 'DUE_ONLY' && (v.balanceDue ?? 0) <= 0) return false;
      if (status === 'NIL_ONLY' && (v.balanceDue ?? 0) > 0) return false;

      // Text search
      if (!search) return true;
      const name = (v.vendorName || v.name || '').toLowerCase();
      const phone = (v.phone || '').toLowerCase();
      const contact = (v.contactPerson || '').toLowerCase();
      const gstin = (v.gstin || '').toLowerCase();

      return name.includes(search) || phone.includes(search) || contact.includes(search) || gstin.includes(search);
    });
  }

  onMasterSortChange(sort: Sort): void {
    this.masterSortBy = sort.active;
    this.masterSortAsc = sort.direction !== 'desc';
    this.masterPageIndex = 0;
  }

  onMasterPageChange(event: PageEvent): void {
    this.masterPageIndex = event.pageIndex;
    this.masterPageSize = event.pageSize;
  }

  get pagedVendors(): InventoryVendor[] {
    let list = [...this.filteredVendors];
    if (this.masterSortBy) {
      list.sort((a: any, b: any) => {
        let valA = a[this.masterSortBy] ?? a.vendorName ?? a.name ?? '';
        let valB = b[this.masterSortBy] ?? b.vendorName ?? b.name ?? '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return this.masterSortAsc ? -1 : 1;
        if (valA > valB) return this.masterSortAsc ? 1 : -1;
        return 0;
      });
    }
    const start = this.masterPageIndex * this.masterPageSize;
    return list.slice(start, start + this.masterPageSize);
  }

  get totalPurchasedValue(): number {
    return this.vendorsList.reduce((acc, v) => acc + (v.totalPurchased || 0), 0);
  }

  get totalPaidValue(): number {
    return this.vendorsList.reduce((acc, v) => acc + (v.totalPaid || 0), 0);
  }

  get totalBalanceDueValue(): number {
    return this.vendorsList.reduce((acc, v) => acc + (v.balanceDue || 0), 0);
  }

  get totalReturnsValue(): number {
    return this.vendorsList.reduce((acc, v) => acc + (v.totalReturns || 0), 0);
  }

  get instituteName(): string {
    return this.authService.getInstituteName() || 'Institution';
  }

  get activeBranchName(): string {
    const user = this.authService.currentUser();
    const selId = this.authService.selectedBranchId();
    if (selId && user?.branches) {
      const b = user.branches.find(x => x.id === selId);
      if (b) return b.name;
    }
    return user?.branchName || 'Main Branch';
  }

  get todayDate(): Date {
    return new Date();
  }

  get totalLedgerDebit(): number {
    return this.ledgerEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
  }

  get totalLedgerCredit(): number {
    return this.ledgerEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
  }

  selectVendor(vendor: InventoryVendor): void {
    this.selectedVendor = vendor;
    this.loadLedger(0);
  }

  loadLedger(page: number = this.pageIndex): void {
    if (!this.selectedVendor) return;

    this.pageIndex = page;
    this.loadingLedger = true;

    const val = this.dateFilterForm.value;
    const branchId = this.authService.selectedBranchId() || undefined;

    this.inventoryService.getVendorLedger(this.selectedVendor.id, {
      startDate: val.startDate || undefined,
      endDate: val.endDate || undefined,
      search: val.search?.trim() || undefined,
      entryType: val.entryType && val.entryType !== 'ALL' ? val.entryType : undefined,
      paymentMode: val.paymentMode && val.paymentMode !== 'ALL' ? val.paymentMode : undefined,
      sortBy: this.sortBy,
      sortDirection: this.sortDirection,
      pageNumber: this.pageIndex + 1,
      pageSize: this.pageSize,
      branchId
    }).subscribe({
      next: (summary) => {
        this.ledgerSummary = summary;
        this.ledgerEntries = summary.entries || [];
        this.totalEntries = summary.totalCount ?? this.ledgerEntries.length;
        this.loading = false;
        this.loadingLedger = false;
      },
      error: () => {
        this.loading = false;
        this.loadingLedger = false;
        this.confirmDialog.alert('Error', 'Unable to retrieve vendor account ledger.');
      }
    });
  }

  onSort(column: string): void {
    if (this.sortBy === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortDirection = 'asc';
    }
    this.loadLedger(0);
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadLedger(this.pageIndex);
  }

  clearSearch(): void {
    this.dateFilterForm.get('search')?.setValue('');
  }

  applyDateFilter(): void {
    if (!this.selectedVendor) return;
    if (this.dateFilterForm.errors?.['dateRangeInvalid']) {
      this.confirmDialog.alert('Invalid Date Range', 'Start Date cannot be later than End Date. Please select a valid period.');
      return;
    }
    this.loadLedger(0);
  }

  resetDateFilter(): void {
    this.activeDatePreset = 'ALL';
    this.dateFilterForm.patchValue({
      startDate: '',
      endDate: '',
      search: '',
      entryType: 'ALL',
      paymentMode: 'ALL'
    }, { emitEvent: false });
    this.loadLedger(0);
  }

  setDatePreset(preset: 'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_FY'): void {
    this.activeDatePreset = preset;
    const today = new Date();
    const pad = (n: number) => n < 10 ? `0${n}` : `${n}`;
    const formatYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let start = '';
    let end = '';

    if (preset === 'THIS_MONTH') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      start = formatYmd(firstDay);
      end = formatYmd(today);
    } else if (preset === 'LAST_MONTH') {
      const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      start = formatYmd(firstDayLastMonth);
      end = formatYmd(lastDayLastMonth);
    } else if (preset === 'THIS_FY') {
      // Indian Financial Year: April 1 to March 31
      const curYear = today.getFullYear();
      const fyStartYear = today.getMonth() >= 3 ? curYear : curYear - 1;
      start = `${fyStartYear}-04-01`;
      end = formatYmd(today);
    }

    this.dateFilterForm.patchValue({
      startDate: start,
      endDate: end
    }, { emitEvent: false });

    this.applyDateFilter();
  }

  openVendorDialog(vendor?: InventoryVendor): void {
    const dialogRef = this.dialog.open(InventoryVendorDialogComponent, {
      width: '580px',
      data: {
        isEdit: !!vendor,
        vendor: vendor ? { ...vendor } : undefined,
        branchId: this.authService.selectedBranchId() || undefined
      }
    });

    dialogRef.afterClosed().subscribe((result: CreateUpdateVendorDto | undefined) => {
      if (!result) return;

      this.loading = true;
      if (vendor?.id) {
        this.inventoryService.updateVendor(vendor.id, result).subscribe({
          next: () => {
            this.loading = false;
            const name = result.vendorName || result.name || 'Vendor';
            this.confirmDialog.alert('Vendor Updated', `Supplier details for '${name}' have been successfully updated.`);
            this.loadVendors(vendor.id);
          },
          error: (err) => {
            this.loading = false;
            const msg = err?.error?.message || 'Failed to update vendor.';
            this.confirmDialog.alert('Error', msg);
          }
        });
      } else {
        this.inventoryService.createVendor(result).subscribe({
          next: (created) => {
            this.loading = false;
            const name = created.vendorName || created.name || 'Vendor';
            this.confirmDialog.alert('Vendor Registered', `Supplier '${name}' registered successfully!`);
            this.loadVendors(created.id);
          },
          error: (err) => {
            this.loading = false;
            const msg = err?.error?.message || 'Failed to register vendor.';
            this.confirmDialog.alert('Error', msg);
          }
        });
      }
    });
  }

  viewVendorLedger(vendor: InventoryVendor): void {
    this.selectVendor(vendor);
    this.viewMode = 'split';
  }

  openPaymentDialog(vendor: InventoryVendor, mode: 'Disbursement' | 'Refund' = 'Disbursement'): void {
    const dialogRef = this.dialog.open(VendorPaymentDialogComponent, {
      width: '620px',
      data: {
        vendor,
        vendorsList: this.vendorsList,
        mode,
        branchId: this.authService.selectedBranchId() || undefined
      }
    });

    dialogRef.afterClosed().subscribe((result: VendorPaymentDialogResult | undefined) => {
      if (result && result.success) {
        const title = result.isRefund ? 'Refund Receipt Recorded' : 'Payment Recorded';
        const msg = result.isRefund
          ? `Vendor Refund Receipt ${result.voucherNumber} for ₹${result.amount} successfully recorded and credited to account!`
          : `Payment Voucher ${result.voucherNumber} for ₹${result.amount} successfully recorded and debited to vendor account!`;

        this.confirmDialog.alert(title, msg);
        this.loadVendors(result.vendorId);
      }
    });
  }

  quickRefundVendor(vendor: InventoryVendor): void {
    this.openPaymentDialog(vendor, 'Refund');
  }

  quickPayVendor(vendor: InventoryVendor): void {
    this.openPaymentDialog(vendor, 'Disbursement');
  }

  getEntryTypeClass(type: string): string {
    switch (type) {
      case 'InwardPurchase':
      case 'PURCHASE':
        return 'chip-purchase';
      case 'VendorPayment':
      case 'PAYMENT':
        return 'chip-payment';
      case 'VendorRefund':
      case 'REFUND':
        return 'chip-refund';
      case 'PurchaseReturn':
      case 'PURCHASE_RETURN':
        return 'chip-return';
      default:
        return '';
    }
  }

  getEntryTypeLabel(type: string): string {
    switch (type) {
      case 'InwardPurchase':
      case 'PURCHASE':
        return 'INWARD / BILL';
      case 'VendorPayment':
      case 'PAYMENT':
        return 'PAYMENT VOUCHER';
      case 'VendorRefund':
      case 'REFUND':
        return 'REFUND RECEIPT';
      case 'PurchaseReturn':
      case 'PURCHASE_RETURN':
        return 'DEBIT NOTE (PR)';
      default:
        return type;
    }
  }

  getInstituteLogoUrl(): string | null {
    return this.authService.getInstituteLogoUrl();
  }

  printStatement(): void {
    window.print();
  }
}
