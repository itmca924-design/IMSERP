import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule, MatTabChangeEvent } from '@angular/material/tabs';
import { MatSortModule, Sort, SortDirection } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FinanceService, AccountLedgerDto, AccountType, AccountSubType } from '../../core/services/finance.service';
import { BranchService } from '../../core/services/branch.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { LedgerDialogComponent } from './ledger-dialog.component';

@Component({
  selector: 'app-chart-of-accounts',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTabsModule,
    MatSortModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule
  ],
  template: `
<div class="page-container">
  <!-- Header Bar -->
  <div class="header-card">
    <div class="header-left">
      <div class="header-icon-box">
        <mat-icon>account_tree</mat-icon>
      </div>
      <div>
        <h1 class="page-title">Chart of Accounts &amp; Asset Vault</h1>
        <p class="page-subtitle">खाता बही एवं परिसंपत्ति &bull; Server-Side Search, Filter, Sort &amp; Ledger Audit</p>
      </div>
    </div>
    <div class="header-actions">
      <button mat-stroked-button color="primary" (click)="loadLedgers()" [disabled]="loading">
        <mat-icon [class.spin-icon]="loading">refresh</mat-icon>
        <span>Refresh</span>
      </button>
      <button mat-raised-button color="primary" class="add-btn" (click)="openCreateDialog()">
        <mat-icon>add_circle</mat-icon>
        <span>Add Account Ledger</span>
      </button>
    </div>
  </div>

  <!-- KPI Overview Cards (Database Aggregated) -->
  <div class="kpi-grid">
    <div class="kpi-card asset">
      <div class="kpi-icon asset"><mat-icon>business</mat-icon></div>
      <div class="kpi-content">
        <span class="kpi-label">Total Fixed &amp; Current Assets</span>
        <span class="kpi-value">₹{{ totalAssetsValuation | number:'1.2-2' }}</span>
        <span class="kpi-sub">{{ assetCount }} Asset Accounts Configured</span>
      </div>
    </div>

    <div class="kpi-card liability">
      <div class="kpi-icon liability"><mat-icon>account_balance</mat-icon></div>
      <div class="kpi-content">
        <span class="kpi-label">Total Institutional Liabilities</span>
        <span class="kpi-value">₹{{ totalLiabilitiesValuation | number:'1.2-2' }}</span>
        <span class="kpi-sub">{{ liabilityCount }} Caution Money &amp; Term Loans</span>
      </div>
    </div>

    <div class="kpi-card equity">
      <div class="kpi-icon equity"><mat-icon>savings</mat-icon></div>
      <div class="kpi-content">
        <span class="kpi-label">Capital &amp; Corpus Fund</span>
        <span class="kpi-value">₹{{ totalEquityValuation | number:'1.2-2' }}</span>
        <span class="kpi-sub">{{ equityCount }} Promoter Equity &amp; Reserves</span>
      </div>
    </div>
  </div>

  <!-- Filter & Search Controls Card -->
  <div class="filter-card">
    <div class="filter-grid">
      <!-- Search Input with Debounce -->
      <mat-form-field appearance="outline" class="filter-item search-field">
        <mat-label>Search Code, Account Title, Description</mat-label>
        <input matInput [(ngModel)]="searchTerm" (ngModelChange)="onSearchInput($event)" (keyup.enter)="applyFilters()" placeholder="e.g. CASH-MAIN, Furniture, Loan...">
        <mat-icon matPrefix>search</mat-icon>
        <button mat-icon-button matSuffix *ngIf="searchTerm" (click)="clearSearch()">
          <mat-icon>clear</mat-icon>
        </button>
      </mat-form-field>

      <!-- Classification SubType Filter -->
      <mat-form-field appearance="outline" class="filter-item">
        <mat-label>Sub-Classification</mat-label>
        <mat-select [(ngModel)]="selectedSubType" (selectionChange)="applyFilters()">
          <mat-option [value]="null">All Sub-Types (समस्त वर्गीकरण)</mat-option>
          <mat-option [value]="AccountSubType.CurrentAsset">Current Asset (Liquid)</mat-option>
          <mat-option [value]="AccountSubType.FixedAsset">Fixed Asset (Non-Current)</mat-option>
          <mat-option [value]="AccountSubType.CurrentLiability">Current Liability</mat-option>
          <mat-option [value]="AccountSubType.LongTermLiability">Long-Term Borrowing</mat-option>
          <mat-option [value]="AccountSubType.Capital">Capital &amp; Equity</mat-option>
        </mat-select>
        <mat-icon matPrefix>category</mat-icon>
      </mat-form-field>

      <!-- Campus / Branch Filter -->
      <mat-form-field appearance="outline" class="filter-item" *ngIf="branches.length > 0">
        <mat-label>Campus / Branch</mat-label>
        <mat-select [(ngModel)]="selectedBranchId" (selectionChange)="applyFilters()">
          <mat-option [value]="null">All Branches</mat-option>
          <mat-option *ngFor="let b of branches" [value]="b.id">{{ b.name }}</mat-option>
        </mat-select>
        <mat-icon matPrefix>apartment</mat-icon>
      </mat-form-field>
    </div>
  </div>

  <!-- Tabbed Accounts View with Server-Side Grid & Proper Loader -->
  <div class="accounts-tabs-card">
    <mat-tab-group animationDuration="200ms" [selectedIndex]="selectedTabIndex" (selectedTabChange)="onTabChange($event)">
      <!-- 1. Assets Tab -->
      <mat-tab>
        <ng-template matTabLabel>
          <mat-icon class="mr-2">domain</mat-icon>
          <span>Assets ({{ assetCount }})</span>
        </ng-template>
      </mat-tab>

      <!-- 2. Liabilities Tab -->
      <mat-tab>
        <ng-template matTabLabel>
          <mat-icon class="mr-2">receipt</mat-icon>
          <span>Liabilities ({{ liabilityCount }})</span>
        </ng-template>
      </mat-tab>

      <!-- 3. Capital & Equity Tab -->
      <mat-tab>
        <ng-template matTabLabel>
          <mat-icon class="mr-2">savings</mat-icon>
          <span>Capital &amp; Equity ({{ equityCount }})</span>
        </ng-template>
      </mat-tab>

      <!-- 4. All Accounts Tab -->
      <mat-tab>
        <ng-template matTabLabel>
          <mat-icon class="mr-2">list_alt</mat-icon>
          <span>All Accounts ({{ assetCount + liabilityCount + equityCount }})</span>
        </ng-template>
      </mat-tab>
    </mat-tab-group>

    <!-- Table Container with Overlay Loader -->
    <div class="table-container-wrapper">
      <mat-progress-bar mode="indeterminate" *ngIf="loading" class="top-progress-bar"></mat-progress-bar>

      <!-- Transparent Loading Overlay with Spinner -->
      <div class="table-loading-overlay" *ngIf="loading">
        <div class="loader-content">
          <mat-spinner diameter="44" strokeWidth="4"></mat-spinner>
          <div class="loader-text-group">
            <span class="loading-title">Loading Account Ledgers</span>
            <span class="loading-sub">Fetching server-side valuations &amp; records...</span>
          </div>
        </div>
      </div>

      <div class="table-responsive">
        <table mat-table [dataSource]="ledgers" matSort (matSortChange)="onSortChange($event)" [matSortActive]="sortBy" [matSortDirection]="sortDirection" class="ledger-table">
          <!-- Code -->
          <ng-container matColumnDef="code">
            <th mat-header-cell *matHeaderCellDef mat-sort-header="code" class="col-code">CODE</th>
            <td mat-cell *matCellDef="let l" class="col-code">
              <span class="code-badge">{{ l.accountCode }}</span>
              <span class="system-pill" *ngIf="l.isDefault">System Default</span>
            </td>
          </ng-container>

          <!-- Title & Description -->
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef mat-sort-header="name" class="col-name">LEDGER TITLE &amp; DESCRIPTION</th>
            <td mat-cell *matCellDef="let l" class="col-name">
              <div class="ledger-name">{{ l.accountName }}</div>
              <div class="text-xs text-muted" *ngIf="l.description">{{ l.description }}</div>
              <div class="text-xs text-muted branch-info" *ngIf="l.branchName">&bull; Campus: {{ l.branchName }}</div>
            </td>
          </ng-container>

          <!-- Classification -->
          <ng-container matColumnDef="subtype">
            <th mat-header-cell *matHeaderCellDef mat-sort-header="subtype" class="col-subtype">CLASSIFICATION</th>
            <td mat-cell *matCellDef="let l" class="col-subtype">
              <span class="subtype-badge" [ngClass]="getSubtypeClass(l.subType)">
                {{ getSubtypeLabel(l.subType) }}
              </span>
            </td>
          </ng-container>

          <!-- Valuation / Balance -->
          <ng-container matColumnDef="balance">
            <th mat-header-cell *matHeaderCellDef mat-sort-header="balance" class="text-right col-balance">VALUATION / BALANCE</th>
            <td mat-cell *matCellDef="let l" class="text-right col-balance">
              <div class="font-bold balance-val" [ngClass]="getBalanceClass(l)">
                ₹{{ (l.currentBalance > 0 ? l.currentBalance : l.openingBalance) | number:'1.2-2' }}
              </div>
            </td>
          </ng-container>

          <!-- Actions -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="text-center col-actions">ACTIONS</th>
            <td mat-cell *matCellDef="let l" class="text-center col-actions">
              <div class="action-btn-group">
                <button mat-icon-button color="primary" matTooltip="Edit Ledger" (click)="openEditDialog(l)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" matTooltip="Delete Ledger" *ngIf="!l.isDefault" (click)="deleteLedger(l)">
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
      <div class="empty-state" *ngIf="!loading && ledgers.length === 0">
        <div class="empty-icon-circle">
          <mat-icon>account_tree</mat-icon>
        </div>
        <h3>No Account Ledgers Found</h3>
        <p>No ledgers match your search and filter criteria.</p>
        <button mat-raised-button color="primary" (click)="openCreateDialog()" style="margin-top: 12px;">
          <mat-icon>add_circle</mat-icon>
          <span>Create New Ledger</span>
        </button>
      </div>

      <!-- Paginator -->
      <div class="paginator-wrapper">
        <mat-paginator
          [length]="totalCount"
          [pageSize]="pageSize"
          [pageIndex]="pageNumber - 1"
          [pageSizeOptions]="[10, 15, 25, 50]"
          [showFirstLastButtons]="true"
          (page)="onPageChange($event)">
        </mat-paginator>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    .page-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
      background: #f8fafc;
      min-height: calc(100vh - 64px);
    }

    .header-card {
      background: #ffffff;
      border-radius: 14px;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04);
      gap: 14px;
      flex-wrap: wrap;
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
      flex-shrink: 0;

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
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
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
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }

    .kpi-card {
      background: #ffffff;
      border-radius: 14px;
      padding: 18px 20px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .kpi-icon {
      width: 46px;
      height: 46px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;

      &.asset { background: #eff6ff; color: #2563eb; }
      &.liability { background: #fef2f2; color: #dc2626; }
      &.equity { background: #f0fdf4; color: #16a34a; }
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
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      margin: 2px 0;
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
      flex: 1 1 220px;
      min-width: 200px;
      margin-bottom: -1.25em;
    }

    .search-field {
      flex: 2 1 320px;
      min-width: 260px;
    }

    /* Accounts Tab Card */
    .accounts-tabs-card {
      background: #ffffff;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      overflow: hidden;
    }

    .table-container-wrapper {
      position: relative;
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

    .ledger-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
    }

    /* Prominent Sticky Header Row Styling */
    ::ng-deep .ledger-table .mat-mdc-header-row {
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%) !important;
      position: sticky;
      top: 0;
      z-index: 20;
    }

    ::ng-deep .ledger-table th.mat-mdc-header-cell {
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

    ::ng-deep .ledger-table th.mat-sort-header-sorted {
      color: #2563eb !important;
    }

    ::ng-deep .ledger-table td.mat-mdc-cell {
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }

    .table-row:hover {
      background: #f8fafc;
    }

    .col-code { width: 170px; }
    .col-name { min-width: 280px; }
    .col-subtype { width: 200px; }
    .col-balance { width: 180px; }
    .col-actions { width: 100px; }

    .code-badge {
      display: inline-block;
      padding: 4px 8px;
      background: #eff6ff;
      color: #1d4ed8;
      font-family: monospace;
      font-weight: 700;
      font-size: 12px;
      border-radius: 6px;
    }

    .system-pill {
      display: inline-block;
      margin-left: 6px;
      padding: 2px 6px;
      background: #f1f5f9;
      color: #64748b;
      font-size: 10px;
      font-weight: 600;
      border-radius: 4px;
    }

    .ledger-name {
      font-weight: 600;
      color: #0f172a;
      font-size: 14px;
    }

    .branch-info {
      margin-top: 2px;
    }

    .subtype-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;

      &.fixed { background: #f0fdf4; color: #15803d; }
      &.current { background: #eff6ff; color: #1d4ed8; }
      &.liability-current { background: #fef2f2; color: #b91c1c; }
      &.liability-long { background: #fff7ed; color: #c2410c; }
      &.capital { background: #faf5ff; color: #7e22ce; }
    }

    .balance-val {
      font-size: 15px;

      &.text-green { color: #16a34a; }
      &.text-red { color: #dc2626; }
      &.text-slate { color: #0f172a; }
    }

    .action-btn-group {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2px;
    }

    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-xs { font-size: 11px; }
    .text-muted { color: #64748b; }
    .font-bold { font-weight: 700; }
    .mr-2 { margin-right: 6px; }

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
    }

    .paginator-wrapper {
      border-top: 1px solid #e2e8f0;
      background: #fafbfc;
    }
  `]
})
export class ChartOfAccountsComponent implements OnInit, OnDestroy {
  loading = false;
  ledgers: AccountLedgerDto[] = [];
  branches: any[] = [];

  AccountType = AccountType;
  AccountSubType = AccountSubType;

  // Filter States
  selectedTabIndex = 0; // 0: Assets, 1: Liabilities, 2: Equity, 3: All
  selectedAccountType: AccountType | null = AccountType.Asset;
  selectedSubType: AccountSubType | null = null;
  selectedBranchId: string | null = null;
  searchTerm = '';

  // Server-Side Dynamic Sorting
  sortBy = 'code';
  sortDescending = false;
  sortDirection: SortDirection = 'asc';

  // Server-Side Pagination
  pageNumber = 1;
  pageSize = 15;
  totalCount = 0;

  // Database-Aggregated Valuations & Counts
  totalAssetsValuation = 0;
  totalLiabilitiesValuation = 0;
  totalEquityValuation = 0;
  assetCount = 0;
  liabilityCount = 0;
  equityCount = 0;

  displayedColumns = ['code', 'name', 'subtype', 'balance', 'actions'];

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
    ).subscribe(() => {
      this.pageNumber = 1;
      this.loadLedgers();
    });

    this.loadBranches();
    this.loadLedgers();
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

  loadBranches(): void {
    this.branchService.getBranches().subscribe({
      next: (b) => (this.branches = b || []),
      error: () => {}
    });
  }

  onTabChange(event: MatTabChangeEvent): void {
    this.selectedTabIndex = event.index;
    switch (event.index) {
      case 0:
        this.selectedAccountType = AccountType.Asset;
        break;
      case 1:
        this.selectedAccountType = AccountType.Liability;
        break;
      case 2:
        this.selectedAccountType = AccountType.Equity;
        break;
      case 3:
        this.selectedAccountType = null;
        break;
    }
    this.selectedSubType = null;
    this.pageNumber = 1;
    this.loadLedgers();
  }

  loadLedgers(): void {
    this.loading = true;
    this.financeService
      .getAccountLedgersPaged({
        pageNumber: this.pageNumber,
        pageSize: this.pageSize,
        searchTerm: this.searchTerm ? this.searchTerm.trim() : undefined,
        accountType: this.selectedAccountType,
        subType: this.selectedSubType,
        branchId: this.selectedBranchId || undefined,
        sortBy: this.sortBy,
        sortDescending: this.sortDescending
      })
      .subscribe({
        next: (res) => {
          this.ledgers = res.items || [];
          this.totalCount = res.totalCount || 0;
          this.totalAssetsValuation = res.totalAssetsValuation || 0;
          this.totalLiabilitiesValuation = res.totalLiabilitiesValuation || 0;
          this.totalEquityValuation = res.totalEquityValuation || 0;
          this.assetCount = res.assetCount || 0;
          this.liabilityCount = res.liabilityCount || 0;
          this.equityCount = res.equityCount || 0;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        }
      });
  }

  onSortChange(sort: Sort): void {
    if (!sort.active || sort.direction === '') {
      this.sortBy = 'code';
      this.sortDescending = false;
      this.sortDirection = 'asc';
    } else {
      this.sortBy = sort.active;
      this.sortDescending = sort.direction === 'desc';
      this.sortDirection = sort.direction;
    }
    this.pageNumber = 1;
    this.loadLedgers();
  }

  applyFilters(): void {
    this.pageNumber = 1;
    this.loadLedgers();
  }

  onPageChange(event: PageEvent): void {
    this.pageNumber = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadLedgers();
  }

  openCreateDialog(): void {
    const defaultType = this.selectedAccountType || AccountType.Asset;
    const ref = this.dialog.open(LedgerDialogComponent, {
      data: { defaultType },
      disableClose: true,
      autoFocus: false
    });

    ref.afterClosed().subscribe((created) => {
      if (created) {
        this.loadLedgers();
      }
    });
  }

  openEditDialog(l: AccountLedgerDto): void {
    const ref = this.dialog.open(LedgerDialogComponent, {
      data: { ledger: l },
      disableClose: true,
      autoFocus: false
    });

    ref.afterClosed().subscribe((updated) => {
      if (updated) {
        this.loadLedgers();
      }
    });
  }

  deleteLedger(l: AccountLedgerDto): void {
    this.confirmDialog
      .confirm(
        'Delete Ledger Account?',
        `Are you sure you want to delete ledger "${l.accountName}" (${l.accountCode})? This will alter financial balance reports.`,
        'Delete Ledger',
        'Cancel',
        'danger'
      )
      .subscribe((yes) => {
        if (yes) {
          this.financeService.deleteAccountLedger(l.id).subscribe({
            next: () => {
              this.loadLedgers();
            },
            error: () => {}
          });
        }
      });
  }

  getSubtypeLabel(subType: AccountSubType): string {
    switch (subType) {
      case AccountSubType.FixedAsset: return 'Fixed Asset (Non-Current)';
      case AccountSubType.CurrentAsset: return 'Current Asset (Liquid)';
      case AccountSubType.CurrentLiability: return 'Current Liability';
      case AccountSubType.LongTermLiability: return 'Long-Term Borrowing';
      case AccountSubType.Capital: return 'Capital Fund / Corpus';
      default: return 'General Ledger';
    }
  }

  getSubtypeClass(subType: AccountSubType): string {
    switch (subType) {
      case AccountSubType.FixedAsset: return 'fixed';
      case AccountSubType.CurrentAsset: return 'current';
      case AccountSubType.CurrentLiability: return 'liability-current';
      case AccountSubType.LongTermLiability: return 'liability-long';
      case AccountSubType.Capital: return 'capital';
      default: return '';
    }
  }

  getBalanceClass(l: AccountLedgerDto): string {
    if (l.accountType === AccountType.Asset) return 'text-slate';
    if (l.accountType === AccountType.Liability) return 'text-red';
    if (l.accountType === AccountType.Equity) return 'text-green';
    return 'text-slate';
  }
}
