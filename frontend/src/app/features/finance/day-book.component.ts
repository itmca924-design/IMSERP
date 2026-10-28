import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FinanceService, DayBookReportDto, DayBookTransactionDto } from '../../core/services/finance.service';
import { BranchService, BranchDto } from '../../core/services/branch.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';
import { LocalDatetimePipe } from '../../shared/pipes/local-datetime.pipe';

@Component({
  selector: 'app-day-book',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatCardModule,
    MatChipsModule,
    MatPaginatorModule,
    MatSortModule,
    IstDatetimeDirective,
    LocalDatetimePipe
  ],
  template: `
<div class="page-container" [formGroup]="filterForm">
  <!-- Top Header Bar -->
  <div class="header-card no-print">
    <div class="header-left">
      <div class="header-icon-box">
        <mat-icon>auto_stories</mat-icon>
      </div>
      <div>
        <h1 class="page-title">Day Book</h1>
        <p class="page-subtitle">दैनिक रोकड़ / रोजनामचा बही &bull; Daily Chronological Cash &amp; Bank Transaction Journal</p>
      </div>
    </div>

    <!-- Smart Control Deck -->
    <div class="smart-control-deck">
      <!-- Date Presets & Picker -->
      <div class="control-unit date-unit">
        <div class="unit-icon-badge">
          <mat-icon>event</mat-icon>
        </div>
        <div class="unit-details">
          <span class="unit-label">Transaction Date</span>
          <div class="date-display-row" (click)="dayPicker.open()">
            <span class="date-text">{{ selectedDate | date:'fullDate' }}</span>
            <input matInput [matDatepicker]="dayPicker" formControlName="date" class="hidden-picker-input">
            <mat-datepicker-toggle [for]="dayPicker" class="inline-picker-toggle"></mat-datepicker-toggle>
            <mat-datepicker #dayPicker></mat-datepicker>
          </div>
        </div>
      </div>

      <div class="unit-separator" *ngIf="branches.length > 0"></div>

      <!-- Campus / Branch Filter -->
      <div class="control-unit branch-unit" *ngIf="branches.length > 0">
        <div class="unit-icon-badge">
          <mat-icon>apartment</mat-icon>
        </div>
        <div class="unit-details">
          <span class="unit-label">Campus Scope</span>
          <mat-select formControlName="branchId" class="unit-select branch-select">
            <mat-select-trigger>
              <span class="select-value-text">{{ getSelectedBranchName() }}</span>
            </mat-select-trigger>
            <mat-option [value]="null">All Campuses Consolidated</mat-option>
            <mat-option *ngFor="let b of branches" [value]="b.id">
              {{ b.name }}
            </mat-option>
          </mat-select>
        </div>
      </div>

      <div class="unit-separator"></div>

      <!-- Academic Division Scope Filter -->
      <div class="control-unit division-unit">
        <div class="unit-icon-badge">
          <mat-icon>hub</mat-icon>
        </div>
        <div class="unit-details">
          <span class="unit-label">Division Scope</span>
          <mat-select formControlName="academicScope" class="unit-select division-select">
            <mat-option value="All">All Divisions (Hybrid Consolidated)</mat-option>
            <mat-option value="School">School Operations Only</mat-option>
            <mat-option value="Coaching">Coaching / Prep Division Only</mat-option>
          </mat-select>
        </div>
      </div>

      <div class="unit-separator"></div>

      <!-- Action Buttons -->
        <div class="deck-actions">
          <button mat-button class="smart-btn refresh-btn" (click)="loadDayBook()" matTooltip="Reload Day Book" [disabled]="loading">
            <mat-icon [class.spin-icon]="loading">refresh</mat-icon>
            <span class="btn-text">Refresh</span>
          </button>

          <button mat-flat-button color="primary" class="smart-btn print-btn" (click)="printDayBook()" matTooltip="Print Daily Journal Sheet" [disabled]="loading || !report">
            <mat-icon>print</mat-icon>
            <span class="btn-text">Print Day Book</span>
          </button>

          <button mat-stroked-button class="smart-btn export-btn" (click)="exportToCSV()" matTooltip="Export to CSV / Excel" [disabled]="loading || !filteredTransactions.length">
            <mat-icon>download</mat-icon>
            <span class="btn-text">Export CSV</span>
          </button>
        </div>
      </div>
    </div>

  <!-- Loading Bar -->
  <mat-progress-bar *ngIf="loading" mode="indeterminate" class="global-progress no-print"></mat-progress-bar>

  <!-- Error Alert -->
  <div *ngIf="error" class="error-banner no-print">
    <mat-icon>error_outline</mat-icon>
    <span>{{ error }}</span>
    <button mat-button (click)="loadDayBook()">Try Again</button>
  </div>

  <!-- Date Preset Fast Switcher & Filter Pills -->
  <div class="filters-strip no-print">
    <div class="presets-group">
      <span class="strip-label">Quick Jump:</span>
      <button *ngFor="let p of quickDatePresets"
              class="preset-pill"
              [class.active]="isPresetDateActive(p.date)"
              (click)="setPresetDate(p.date)">
        {{ p.label }}
      </button>
    </div>

    <div class="type-filter-group">
      <span class="strip-label">Voucher:</span>
      <button class="filter-pill" [class.active]="voucherTypeFilter === 'All'" (click)="setVoucherFilter('All')">All ({{ report?.totalTransactions || 0 }})</button>
      <button class="filter-pill green-pill" [class.active]="voucherTypeFilter === 'Receipt'" (click)="setVoucherFilter('Receipt')">
        <mat-icon class="pill-icon">south_west</mat-icon> Receipts ({{ report?.receiptCount || 0 }})
      </button>
      <button class="filter-pill red-pill" [class.active]="voucherTypeFilter === 'Payment'" (click)="setVoucherFilter('Payment')">
        <mat-icon class="pill-icon">north_east</mat-icon> Payments ({{ report?.paymentCount || 0 }})
      </button>
    </div>

    <div class="mode-filter-group">
      <span class="strip-label">Mode:</span>
      <button class="mode-pill" [class.active]="paymentModeFilter === 'All'" (click)="setModeFilter('All')">All</button>
      <button class="mode-pill" [class.active]="paymentModeFilter === 'Cash'" (click)="setModeFilter('Cash')">Cash Only</button>
      <button class="mode-pill" [class.active]="paymentModeFilter === 'Online'" (click)="setModeFilter('Online')">UPI / Bank Only</button>
    </div>

    <!-- Search Box -->
    <div class="search-input-box">
      <mat-icon>search</mat-icon>
      <input type="text" formControlName="searchTerm" placeholder="Filter by voucher, student, payee, head...">
      <mat-icon *ngIf="searchTerm" class="clear-icon" (click)="clearSearch()">close</mat-icon>
    </div>
  </div>

  <!-- Summary KPI Cards -->
  <div class="kpi-grid no-print" *ngIf="report">
    <!-- Opening Balance Card -->
    <div class="kpi-card opening-card">
      <div class="kpi-icon-wrap opening-icon">
        <mat-icon>account_balance</mat-icon>
      </div>
      <div class="kpi-body">
        <span class="kpi-title">Opening Balance (प्रारंभिक शेष)</span>
        <span class="kpi-value">₹{{ report.openingBalance | number:'1.2-2' }}</span>
        <span class="kpi-sub">Liquid Cash &amp; Bank float at day start</span>
      </div>
    </div>

    <!-- Total Inflow (Receipts) Card -->
    <div class="kpi-card inflow-card">
      <div class="kpi-icon-wrap inflow-icon">
        <mat-icon>arrow_downward</mat-icon>
      </div>
      <div class="kpi-body">
        <span class="kpi-title">Total Receipts (कुल आवक / जमा)</span>
        <span class="kpi-value text-green">+₹{{ report.totalInflow | number:'1.2-2' }}</span>
        <div class="kpi-split">
          <span class="split-tag">Cash: ₹{{ report.cashInflow | number:'1.2-2' }}</span>
          <span class="split-tag">Bank/UPI: ₹{{ report.bankInflow | number:'1.2-2' }}</span>
        </div>
      </div>
    </div>

    <!-- Total Outflow (Payments) Card -->
    <div class="kpi-card outflow-card">
      <div class="kpi-icon-wrap outflow-icon">
        <mat-icon>arrow_upward</mat-icon>
      </div>
      <div class="kpi-body">
        <span class="kpi-title">Total Payments (कुल भुगतान / निकासी)</span>
        <span class="kpi-value text-rose">-₹{{ report.totalOutflow | number:'1.2-2' }}</span>
        <div class="kpi-split">
          <span class="split-tag">Cash: ₹{{ report.cashOutflow | number:'1.2-2' }}</span>
          <span class="split-tag">Bank/UPI: ₹{{ report.bankOutflow | number:'1.2-2' }}</span>
        </div>
      </div>
    </div>

    <!-- Closing Balance Card -->
    <div class="kpi-card closing-card">
      <div class="kpi-icon-wrap closing-icon">
        <mat-icon>savings</mat-icon>
      </div>
      <div class="kpi-body">
        <span class="kpi-title">Closing Day Balance (अंतिम रोकड़)</span>
        <span class="kpi-value text-blue">₹{{ report.closingBalance | number:'1.2-2' }}</span>
        <div class="kpi-split">
          <span class="net-tag" [class.surplus]="report.netDailyChange >= 0" [class.deficit]="report.netDailyChange < 0">
            Net Change: {{ report.netDailyChange >= 0 ? '+' : '' }}₹{{ report.netDailyChange | number:'1.2-2' }}
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- Day Book Register Table Card -->
  <div class="content-card no-print" *ngIf="report">
    <div class="card-header-row">
      <div class="card-title-wrap">
        <mat-icon class="title-icon">view_list</mat-icon>
        <span class="card-title">Chronological Day Book Register</span>
        <span class="count-badge">{{ report.totalCount !== undefined ? report.totalCount : filteredTransactions.length }} Entries</span>
      </div>
      <div class="table-legend">
        <span class="legend-item"><span class="legend-bullet receipt"></span> Receipt (Credit / Inflow)</span>
        <span class="legend-item"><span class="legend-bullet payment"></span> Payment (Debit / Outflow)</span>
      </div>
    </div>

    <!-- Table Top Progress Loader -->
    <mat-progress-bar *ngIf="loading" mode="indeterminate" class="table-progress-bar"></mat-progress-bar>

    <div class="table-container-relative">
      <!-- Loading Overlay -->
      <div class="grid-loading-overlay" *ngIf="loading">
        <div class="loader-content">
          <mat-spinner diameter="42" strokeWidth="3.5"></mat-spinner>
          <span class="loader-text">Loading Day Book records...</span>
        </div>
      </div>

      <!-- Transactions Table -->
      <div class="table-responsive" *ngIf="filteredTransactions.length > 0; else noTransactions">
        <table class="daybook-table" matSort [matSortActive]="sortBy" [matSortDirection]="sortDescending ? 'desc' : 'asc'" (matSortChange)="onSortChange($event)">
          <thead>
            <tr>
              <th class="col-index">#</th>
              <th class="col-time" mat-sort-header="timestamp">Time (IST)</th>
              <th class="col-voucher" mat-sort-header="voucherNumber">Voucher No</th>
              <th class="col-type text-center" mat-sort-header="voucherType">Type</th>
              <th class="col-account" mat-sort-header="accountHead">Account Head</th>
              <th class="col-particulars" mat-sort-header="particulars">Particulars &amp; Beneficiary</th>
              <th class="col-mode" mat-sort-header="paymentMode">Payment Mode</th>
              <th class="col-debit text-right" mat-sort-header="debitAmount">Debit / Outflow (₹)</th>
              <th class="col-credit text-right" mat-sort-header="creditAmount">Credit / Inflow (₹)</th>
              <th class="col-balance text-right" mat-sort-header="runningBalance">Running Balance (₹)</th>
            </tr>
          </thead>
          <tbody>
            <!-- Day Opening Row (shown on page 1 when no search is active) -->
            <tr class="day-opening-row" *ngIf="pageIndex === 0 && !searchTerm.trim() && voucherTypeFilter === 'All'">
              <td colspan="9">
                <div class="opening-label-wrap">
                  <mat-icon class="op-icon">history</mat-icon>
                  <strong>DAY OPENING BALANCE (प्रारंभिक शेष)</strong>
                  <span class="op-sub">as of {{ selectedDate | date:'fullDate' }} 00:00 AM IST</span>
                </div>
              </td>
              <td class="text-right opening-amount">
                <strong>₹{{ report.openingBalance | number:'1.2-2' }}</strong>
              </td>
            </tr>

            <!-- Dynamic Transactions -->
            <tr *ngFor="let t of filteredTransactions; let i = index" class="tx-row" [class.receipt-row]="t.voucherType === 'Receipt'" [class.payment-row]="t.voucherType === 'Payment'">
              <td class="col-index text-muted">{{ (pageIndex * pageSize) + i + 1 }}</td>
              <td class="col-time">
                <span class="time-text" [appIstDatetime]="t.timestamp" format="timeSec"></span>
              </td>
              <td class="col-voucher">
                <span class="voucher-tag" (click)="copyVoucher(t.voucherNumber)" matTooltip="Click to copy voucher number">
                  <span class="v-num">{{ t.voucherNumber }}</span>
                  <mat-icon class="copy-icon">content_copy</mat-icon>
                </span>
              </td>
              <td class="col-type text-center">
                <span class="badge-pill" [class.badge-receipt]="t.voucherType === 'Receipt'" [class.badge-payment]="t.voucherType === 'Payment'">
                  {{ t.voucherType }}
                </span>
              </td>
              <td class="col-account">
                <div class="head-title">{{ t.accountHead }}</div>
                <span class="scope-tag" [class.school-tag]="t.division === 'School'" [class.coaching-tag]="t.division === 'Coaching'" [class.integrated-tag]="t.division === 'Integrated'">
                  {{ t.division }}
                </span>
              </td>
              <td class="col-particulars">
                <div class="particulars-text">{{ t.particulars }}</div>
                <div class="remarks-sub" *ngIf="t.remarks">{{ t.remarks }}</div>
              </td>
              <td class="col-mode">
                <div class="mode-pill-box">
                  <mat-icon class="mode-icon">{{ getModeIcon(t.paymentMode) }}</mat-icon>
                  <span>{{ t.paymentMode }}</span>
                </div>
                <div class="ref-sub" *ngIf="t.referenceNumber">Ref: {{ t.referenceNumber }}</div>
              </td>
              <td class="col-debit text-right">
                <span *ngIf="t.debitAmount > 0" class="debit-val">₹{{ t.debitAmount | number:'1.2-2' }}</span>
                <span *ngIf="t.debitAmount === 0" class="text-muted">-</span>
              </td>
              <td class="col-credit text-right">
                <span *ngIf="t.creditAmount > 0" class="credit-val">₹{{ t.creditAmount | number:'1.2-2' }}</span>
                <span *ngIf="t.creditAmount === 0" class="text-muted">-</span>
              </td>
              <td class="col-balance text-right">
                <strong class="balance-val">₹{{ t.runningBalance | number:'1.2-2' }}</strong>
              </td>
            </tr>

            <!-- Day Summary Total Row (shown on last page or single page) -->
            <tr class="day-closing-row" *ngIf="isLastPage()">
              <td colspan="7" class="text-right">
                <strong>DAILY TOTALS &amp; CLOSING BALANCE (दैनिक सारांश):</strong>
              </td>
              <td class="text-right total-debit">
                <strong>-₹{{ report.totalOutflow | number:'1.2-2' }}</strong>
              </td>
              <td class="text-right total-credit">
                <strong>+₹{{ report.totalInflow | number:'1.2-2' }}</strong>
              </td>
              <td class="text-right grand-closing">
                <strong>₹{{ report.closingBalance | number:'1.2-2' }}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Server-Side Pagination Bar -->
      <mat-paginator
        *ngIf="(report.totalCount || 0) > 0"
        [length]="report.totalCount || 0"
        [pageSize]="pageSize"
        [pageIndex]="pageIndex"
        [pageSizeOptions]="pageSizeOptions"
        (page)="onPageChange($event)"
        showFirstLastButtons
        aria-label="Select page of Day Book transactions"
        class="custom-table-paginator no-print">
      </mat-paginator>
    </div>

    <!-- Empty State -->
    <ng-template #noTransactions>
      <div class="empty-state">
        <mat-icon class="empty-icon">event_busy</mat-icon>
        <h3>No Transactions Found For This Date</h3>
        <p>No fee receipts, expense vouchers, or payroll entries were recorded on {{ selectedDate | date:'mediumDate' }}.</p>
        <div class="empty-actions">
          <button mat-flat-button color="primary" (click)="setPreset('today')">
            <mat-icon>today</mat-icon> Go to Today
          </button>
          <button mat-stroked-button (click)="setPreset('yesterday')">
            <mat-icon>history</mat-icon> View Yesterday
          </button>
        </div>
      </div>
    </ng-template>
  </div>

  <!-- Hidden Printable A4 Day Book Sheet -->
  <div id="printableDayBook" class="only-print">
    <div class="print-header">
      <div class="print-inst-info">
        <h2 class="print-inst-name">{{ authService.getInstituteName() || 'Institution' }}</h2>
        <p class="print-inst-sub">Accounts &amp; Financial Operations</p>
        <p class="print-branch">Branch / Campus: <strong>{{ getSelectedBranchName() }}</strong> | Accounts Department</p>
      </div>
      <div class="print-badge">
        <div class="pb-title">OFFICIAL DAY BOOK</div>
        <div class="pb-sub">दैनिक रोजनामचा बही</div>
        <div class="pb-date">{{ selectedDate | date:'fullDate' }}</div>
      </div>
    </div>

    <div class="print-kpi-strip">
      <div class="pk-item">
        <span class="pk-lbl">Opening Balance</span>
        <span class="pk-val">₹{{ report?.openingBalance | number:'1.2-2' }}</span>
      </div>
      <div class="pk-item">
        <span class="pk-lbl">Total Receipts (Cr)</span>
        <span class="pk-val text-green">+₹{{ report?.totalInflow | number:'1.2-2' }}</span>
      </div>
      <div class="pk-item">
        <span class="pk-lbl">Total Payments (Dr)</span>
        <span class="pk-val text-rose">-₹{{ report?.totalOutflow | number:'1.2-2' }}</span>
      </div>
      <div class="pk-item">
        <span class="pk-lbl">Closing Day Balance</span>
        <span class="pk-val text-blue">₹{{ report?.closingBalance | number:'1.2-2' }}</span>
      </div>
    </div>

    <table class="print-table">
      <thead>
        <tr>
          <th style="width: 32px;">#</th>
          <th style="width: 75px;">Time</th>
          <th style="width: 130px;">Voucher No</th>
          <th style="width: 60px;">Type</th>
          <th>Account Head</th>
          <th>Particulars</th>
          <th style="width: 75px;">Mode</th>
          <th style="width: 90px;" class="text-right">Debit (₹)</th>
          <th style="width: 90px;" class="text-right">Credit (₹)</th>
          <th style="width: 100px;" class="text-right">Balance (₹)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td colspan="9"><strong>OPENING BALANCE B/F:</strong></td>
          <td class="text-right"><strong>₹{{ report?.openingBalance | number:'1.2-2' }}</strong></td>
        </tr>
        <tr *ngFor="let t of filteredTransactions; let i = index">
          <td>{{ i + 1 }}</td>
          <td [appIstDatetime]="t.timestamp" format="timeSec"></td>
          <td>{{ t.voucherNumber }}</td>
          <td>{{ t.voucherType }}</td>
          <td>{{ t.accountHead }}</td>
          <td>{{ t.particulars }}</td>
          <td>{{ t.paymentMode }}</td>
          <td class="text-right">{{ t.debitAmount > 0 ? (t.debitAmount | number:'1.2-2') : '-' }}</td>
          <td class="text-right">{{ t.creditAmount > 0 ? (t.creditAmount | number:'1.2-2') : '-' }}</td>
          <td class="text-right">{{ t.runningBalance | number:'1.2-2' }}</td>
        </tr>
        <tr class="print-total-row">
          <td colspan="7" class="text-right"><strong>DAILY TOTALS:</strong></td>
          <td class="text-right"><strong>₹{{ report?.totalOutflow | number:'1.2-2' }}</strong></td>
          <td class="text-right"><strong>₹{{ report?.totalInflow | number:'1.2-2' }}</strong></td>
          <td class="text-right"><strong>₹{{ report?.closingBalance | number:'1.2-2' }}</strong></td>
        </tr>
      </tbody>
    </table>

    <div class="print-signatures">
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-lbl">Cashier / Entry Operator</div>
      </div>
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-lbl">Accountant / Verifier</div>
      </div>
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-lbl">Principal / Director</div>
      </div>
    </div>
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

    /* Header Bar */
    .header-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px 20px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.04);
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
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      color: #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #bfdbfe;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.15);

      mat-icon {
        font-size: 26px;
        width: 26px;
        height: 26px;
      }
    }

    .page-title {
      font-size: 1.5rem;
      font-weight: 800;
      color: #1e3a8a;
      margin: 0;
      letter-spacing: -0.02em;
    }

    .page-subtitle {
      font-size: 0.85rem;
      color: #64748b;
      margin: 3px 0 0;
    }

    /* Smart Control Deck */
    .smart-control-deck {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 6px 10px;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
      flex-wrap: wrap;
    }

    .control-unit {
      height: 48px;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 16px;
      border-radius: 10px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        border-color: #cbd5e1;
        background: #fafbfc;
      }

      &.date-unit { min-width: 250px; }
      &.branch-unit { min-width: 260px; max-width: 380px; }
      &.division-unit { min-width: 240px; }
    }

    .unit-icon-badge {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #eff6ff;
      color: #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .unit-details {
      display: flex;
      flex-direction: column;
    }

    .unit-label {
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.04em;
    }

    .date-display-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .date-text {
      font-size: 0.88rem;
      font-weight: 700;
      color: #0f172a;
    }

    .hidden-picker-input {
      width: 0;
      height: 0;
      opacity: 0;
      padding: 0;
      border: none;
      position: absolute;
    }

    .inline-picker-toggle {
      width: 20px;
      height: 20px;
      margin-left: 2px;
      ::ng-deep .mat-mdc-icon-button {
        width: 20px;
        height: 20px;
        padding: 0;
      }
    }

    .unit-select {
      font-size: 0.88rem;
      font-weight: 700;
      color: #0f172a;
    }

    .unit-separator {
      width: 1px;
      height: 32px;
      background: #e2e8f0;
    }

    .deck-actions {
      display: flex;
      gap: 8px;
    }

    .smart-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      font-size: 0.84rem;
      padding: 0 14px;
      height: 40px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #334155;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover:not([disabled]) {
        background: #f8fafc;
        border-color: #94a3b8;
      }

      &.print-btn {
        background: #eff6ff;
        border-color: #bfdbfe;
        color: #1e40af;
        &:hover:not([disabled]) {
          background: #dbeafe;
        }
      }

      &.export-btn {
        background: #f0fdf4;
        border-color: #bbf7d0;
        color: #166534;
        &:hover:not([disabled]) {
          background: #dcfce7;
        }
      }
    }

    .spin-icon {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    /* Filters Strip */
    .filters-strip {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 18px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
    }

    .strip-label {
      font-size: 0.75rem;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-right: 6px;
    }

    .presets-group, .type-filter-group, .mode-filter-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .preset-pill, .filter-pill, .mode-pill {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 4px 12px;
      font-size: 0.78rem;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s ease;

      &:hover {
        background: #e2e8f0;
        color: #1e293b;
      }

      &.active {
        background: #2563eb;
        color: #ffffff;
        border-color: #2563eb;
      }

      &.green-pill.active {
        background: #16a34a;
        border-color: #16a34a;
      }

      &.red-pill.active {
        background: #e11d48;
        border-color: #e11d48;
      }

      .pill-icon {
        font-size: 15px;
        width: 15px;
        height: 15px;
      }
    }

    .search-input-box {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 4px 12px;
      width: 280px;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #94a3b8;
      }

      input {
        border: none;
        outline: none;
        background: transparent;
        font-size: 0.84rem;
        width: 100%;
        color: #0f172a;
      }

      .clear-icon {
        cursor: pointer;
        &:hover { color: #475569; }
      }
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
      margin-bottom: 22px;
    }

    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      transition: transform 0.2s ease, box-shadow 0.2s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 12px -2px rgba(0, 0, 0, 0.08);
      }
    }

    .kpi-icon-wrap {
      width: 52px;
      height: 52px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }

      &.opening-icon { background: #f1f5f9; color: #475569; }
      &.inflow-icon { background: #dcfce7; color: #16a34a; }
      &.outflow-icon { background: #ffe4e6; color: #e11d48; }
      &.closing-icon { background: #eff6ff; color: #2563eb; }
    }

    .kpi-body {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .kpi-title {
      font-size: 0.74rem;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.03em;
    }

    .kpi-value {
      font-size: 1.45rem;
      font-weight: 800;
      color: #0f172a;
      margin: 2px 0;
    }

    .text-green { color: #16a34a !important; }
    .text-rose { color: #e11d48 !important; }
    .text-blue { color: #2563eb !important; }

    .kpi-sub {
      font-size: 0.74rem;
      color: #94a3b8;
    }

    .kpi-split {
      display: flex;
      gap: 8px;
      margin-top: 3px;
    }

    .split-tag {
      font-size: 0.7rem;
      font-weight: 600;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 1px 6px;
      border-radius: 4px;
      color: #475569;
    }

    .net-tag {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 1px 8px;
      border-radius: 4px;

      &.surplus { background: #dcfce7; color: #15803d; }
      &.deficit { background: #ffe4e6; color: #be123c; }
    }

    /* Content Card */
    .content-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .card-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
    }

    .card-title-wrap {
      display: flex;
      align-items: center;
      gap: 10px;

      .title-icon { color: #2563eb; }
      .card-title { font-size: 1.15rem; font-weight: 800; color: #1e3a8a; }
      .count-badge {
        background: #eff6ff;
        color: #1e40af;
        border: 1px solid #bfdbfe;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 700;
      }
    }

    .table-legend {
      display: flex;
      gap: 16px;
      font-size: 0.78rem;
      color: #64748b;
      font-weight: 600;

      .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .legend-bullet {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        &.receipt { background: #22c55e; }
        &.payment { background: #f43f5e; }
      }
    }

    /* Table Progress & Container */
    .table-progress-bar {
      height: 3px;
    }

    .table-container-relative {
      position: relative;
      min-height: 220px;
    }

    .grid-loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.78);
      backdrop-filter: blur(2px);
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;

      .loader-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        background: #ffffff;
        padding: 20px 32px;
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
        border: 1px solid #bfdbfe;

        .loader-text {
          font-size: 0.88rem;
          font-weight: 600;
          color: #1e3a8a;
          letter-spacing: 0.01em;
        }
      }
    }

    /* Day Book Table */
    .table-responsive {
      overflow-x: auto;
    }

    .daybook-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;

      th {
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        color: #1e3a8a;
        font-weight: 700;
        padding: 10px 12px;
        border-top: 1px solid #bfdbfe;
        border-bottom: 2px solid #bfdbfe;
        text-align: left;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        white-space: nowrap;

        ::ng-deep .mat-sort-header-container {
          display: inline-flex;
          align-items: center;
          font-weight: 700;
          color: #1e3a8a;
        }

        &.text-right ::ng-deep .mat-sort-header-container {
          justify-content: flex-end;
        }

        &.text-center ::ng-deep .mat-sort-header-container {
          justify-content: center;
        }
      }

      td {
        padding: 12px;
        border-bottom: 1px solid #f1f5f9;
        vertical-align: middle;
      }

      tr.tx-row:hover {
        background: #f8fafc;
      }
    }

    .day-opening-row {
      background: #f8fafc;
      border-bottom: 2px solid #cbd5e1;
      .opening-label-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #334155;
        font-size: 0.86rem;
        .op-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
        .op-sub { font-size: 0.74rem; color: #64748b; margin-left: 6px; }
      }
      .opening-amount {
        font-size: 1rem;
        color: #0f172a;
      }
    }

    /* Column Widths & Alignments */
    .col-index { width: 44px; min-width: 44px; text-align: center; white-space: nowrap; }
    .col-time { width: 110px; min-width: 110px; white-space: nowrap; }
    .col-voucher { width: 180px; min-width: 180px; white-space: nowrap; }
    .col-type { width: 95px; min-width: 95px; text-align: center; white-space: nowrap; }
    .col-account { min-width: 160px; }
    .col-particulars { min-width: 250px; }
    .col-mode { width: 140px; min-width: 140px; white-space: nowrap; }
    .col-debit { width: 125px; min-width: 125px; white-space: nowrap; }
    .col-credit { width: 125px; min-width: 125px; white-space: nowrap; }
    .col-balance { width: 140px; min-width: 140px; white-space: nowrap; }

    .time-text {
      font-weight: 600;
      color: #475569;
      white-space: nowrap;
    }

    .voucher-tag {
      font-family: 'Roboto Mono', 'SF Mono', Consolas, monospace;
      font-weight: 700;
      font-size: 0.8rem;
      background: #f1f5f9;
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      color: #0f172a;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      transition: all 0.15s ease-in-out;
      user-select: none;
      vertical-align: middle;

      &:hover {
        background: #e2e8f0;
        border-color: #94a3b8;
        color: #1e40af;

        .copy-icon {
          color: #2563eb;
        }
      }

      .v-num {
        white-space: nowrap;
        display: inline-block;
      }

      .copy-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        line-height: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #64748b;
        flex-shrink: 0;
        overflow: visible;
        margin: 0;
        padding: 0;
      }
    }

    .badge-pill {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.74rem;
      font-weight: 700;
      text-transform: uppercase;

      &.badge-receipt { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
      &.badge-payment { background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; }
    }

    .head-title {
      font-weight: 700;
      color: #0f172a;
    }

    .scope-tag {
      display: inline-block;
      margin-top: 2px;
      font-size: 0.68rem;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      background: #f1f5f9;
      color: #64748b;

      &.school-tag { background: #eff6ff; color: #1e40af; }
      &.coaching-tag { background: #faf5ff; color: #6b21a8; }
      &.integrated-tag { background: #ecfdf5; color: #047857; }
    }

    .particulars-text {
      color: #1e293b;
      font-weight: 500;
      max-width: 320px;
    }

    .remarks-sub {
      font-size: 0.72rem;
      color: #64748b;
      margin-top: 2px;
    }

    .mode-pill-box {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.78rem;
      font-weight: 600;
      color: #334155;

      .mode-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #2563eb;
      }
    }

    .ref-sub {
      font-size: 0.7rem;
      color: #64748b;
      font-family: monospace;
    }

    .debit-val {
      font-weight: 700;
      color: #e11d48;
    }

    .credit-val {
      font-weight: 700;
      color: #16a34a;
    }

    .balance-val {
      color: #0f172a;
      font-size: 0.92rem;
    }

    .day-closing-row {
      background: #f8fafc;
      border-top: 2px solid #cbd5e1;
      font-size: 0.92rem;

      .total-debit { color: #e11d48; }
      .total-credit { color: #16a34a; }
      .grand-closing { color: #2563eb; font-size: 1.05rem; }
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 48px 24px;

      .empty-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #94a3b8;
        margin-bottom: 12px;
      }

      h3 {
        font-size: 1.15rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 6px;
      }

      p {
        color: #64748b;
        font-size: 0.88rem;
        max-width: 440px;
        margin: 0 auto 16px;
      }

      .empty-actions {
        display: flex;
        justify-content: center;
        gap: 12px;
      }
    }

    /* Paginator Styling */
    .custom-table-paginator {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      color: #334155;
      font-size: 0.84rem;
    }

    /* ─── Responsive Design Rules (Mobile, Tablet, Desktop) ─── */
    @media (max-width: 1024px) {
      .header-card {
        flex-direction: column;
        align-items: stretch;
        gap: 14px;
      }

      .smart-control-deck {
        width: 100%;
        box-sizing: border-box;
      }

      .control-unit.date-unit,
      .control-unit.branch-unit,
      .control-unit.division-unit {
        flex: 1 1 calc(50% - 10px);
        min-width: 200px;
        max-width: none;
      }

      .unit-separator {
        display: none;
      }

      .deck-actions {
        width: 100%;
        justify-content: flex-end;
      }

      .filters-strip {
        gap: 12px;
      }

      .search-input-box {
        width: 240px;
      }

      .kpi-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 768px) {
      .header-card {
        padding: 14px 16px;
      }

      .header-left {
        gap: 12px;
      }

      .page-title {
        font-size: 1.25rem;
      }

      .smart-control-deck {
        flex-direction: column;
        gap: 8px;
        padding: 8px;
      }

      .control-unit {
        width: 100%;
        min-width: 0 !important;
        max-width: 100% !important;
        height: 44px;
      }

      .deck-actions {
        width: 100%;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;

        .smart-btn {
          width: 100%;
          justify-content: center;
          padding: 0 8px;
          font-size: 0.78rem;

          .btn-text {
            display: inline;
          }
        }
      }

      .filters-strip {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
        padding: 12px 14px;
      }

      .presets-group,
      .type-filter-group,
      .mode-filter-group {
        display: flex;
        flex-wrap: wrap;
        width: 100%;
        gap: 6px;
      }

      .search-input-box {
        width: 100%;
        margin-left: 0;
        box-sizing: border-box;
      }

      .kpi-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      .kpi-card {
        padding: 10px 10px;
      }

      .card-header-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
      }

      .table-legend {
        width: 100%;
        justify-content: flex-start;
        gap: 12px;
      }

      .content-card {
        padding: 14px 12px;
        border-radius: 10px;
      }

      .daybook-table {
        font-size: 0.8rem;
      }

      .custom-table-paginator {
        ::ng-deep .mat-mdc-paginator-container {
          flex-wrap: wrap;
          justify-content: center;
          padding: 8px;
        }
      }
    }

    @media (max-width: 480px) {
      .header-icon-box {
        width: 40px;
        height: 40px;
        mat-icon { font-size: 22px; width: 22px; height: 22px; }
      }

      .page-title {
        font-size: 1.15rem;
      }

      .deck-actions {
        grid-template-columns: 1fr;
      }

      .preset-pill, .filter-pill, .mode-pill {
        font-size: 0.72rem;
        padding: 3px 8px;
      }
    }

    /* Print Template */
    .only-print {
      display: none;
    }

    @media print {
      .no-print { display: none !important; }
      .only-print { display: block !important; }
      body { background: #fff !important; }
      :host { padding: 0 !important; }

      .print-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding-bottom: 12px;
        border-bottom: 2px solid #0f172a;
        margin-bottom: 12px;
      }

      .print-inst-name { font-size: 1.4rem; font-weight: 800; margin: 0; color: #0f172a; }
      .print-inst-sub { font-size: 0.8rem; color: #475569; margin: 2px 0; }
      .print-branch { font-size: 0.78rem; color: #64748b; margin: 2px 0; }

      .print-badge { text-align: right; }
      .pb-title { font-size: 1.1rem; font-weight: 800; color: #1e40af; }
      .pb-sub { font-size: 0.78rem; color: #64748b; }
      .pb-date { font-size: 0.82rem; font-weight: 700; color: #0f172a; margin-top: 4px; }

      .print-kpi-strip {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        padding: 8px 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        margin-bottom: 14px;
      }

      .pk-item { display: flex; flex-direction: column; }
      .pk-lbl { font-size: 0.68rem; text-transform: uppercase; color: #64748b; font-weight: 700; }
      .pk-val { font-size: 1rem; font-weight: 800; color: #0f172a; }

      .print-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.74rem;

        th {
          background: #eff6ff !important;
          color: #1e3a8a !important;
          border-top: 1px solid #bfdbfe;
          border-bottom: 2px solid #bfdbfe;
          padding: 6px 8px;
          text-align: left;
          font-weight: 700;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        td {
          padding: 6px 8px;
          border-bottom: 1px solid #e2e8f0;
        }

        .print-total-row {
          background: #f8fafc !important;
          border-top: 2px solid #0f172a;
          font-weight: 700;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }

      .print-signatures {
        display: flex;
        justify-content: space-between;
        margin-top: 40px;
        padding-top: 12px;

        .sig-block {
          width: 180px;
          text-align: center;
        }

        .sig-line {
          height: 1px;
          background: #334155;
          margin-bottom: 6px;
        }

        .sig-lbl {
          font-size: 0.74rem;
          font-weight: 700;
          color: #475569;
        }
      }
    }
  `]
})
export class DayBookComponent implements OnInit, OnDestroy {
  loading = false;
  error: string | null = null;
  report: DayBookReportDto | null = null;

  // Server-side pagination & sorting state
  pageIndex = 0;
  pageSize = 25;
  pageSizeOptions: number[] = [10, 25, 50, 100];
  sortBy = 'timestamp';
  sortDescending = false;

  private searchSub?: Subscription;

  filterForm = new FormGroup({
    date: new FormControl<Date>(new Date(), { nonNullable: true }),
    branchId: new FormControl<string | null>(null),
    academicScope: new FormControl<string>('All', { nonNullable: true }),
    voucherType: new FormControl<string>('All', { nonNullable: true }),
    paymentMode: new FormControl<string>('All', { nonNullable: true }),
    searchTerm: new FormControl<string>('', { nonNullable: true })
  });

  branches: BranchDto[] = [];

  constructor(
    private financeService: FinanceService,
    private branchService: BranchService,
    public authService: AuthService,
    private dialogService: ConfirmDialogService
  ) {}

  get selectedDate(): Date {
    return this.filterForm.controls.date.value;
  }

  get selectedBranchId(): string | null {
    return this.filterForm.controls.branchId.value;
  }

  get selectedAcademicScope(): string {
    return this.filterForm.controls.academicScope.value;
  }

  get voucherTypeFilter(): string {
    return this.filterForm.controls.voucherType.value;
  }

  get paymentModeFilter(): string {
    return this.filterForm.controls.paymentMode.value;
  }

  get searchTerm(): string {
    return this.filterForm.controls.searchTerm.value;
  }

  ngOnInit(): void {
    const activeBranch = this.authService.selectedBranchId();
    if (activeBranch) {
      this.filterForm.patchValue({ branchId: activeBranch }, { emitEvent: false });
    }

    // Reactive Filter Listeners - Reset to Page 0 on filter change
    this.filterForm.get('date')?.valueChanges.subscribe(() => {
      this.pageIndex = 0;
      this.loadDayBook();
    });

    this.filterForm.get('branchId')?.valueChanges.subscribe(() => {
      this.pageIndex = 0;
      this.loadDayBook();
    });

    this.filterForm.get('academicScope')?.valueChanges.subscribe(() => {
      this.pageIndex = 0;
      this.loadDayBook();
    });

    this.filterForm.get('voucherType')?.valueChanges.subscribe(() => {
      this.pageIndex = 0;
      this.loadDayBook();
    });

    this.filterForm.get('paymentMode')?.valueChanges.subscribe(() => {
      this.pageIndex = 0;
      this.loadDayBook();
    });

    // Server-Side Search with 350ms debounce
    this.searchSub = this.filterForm.get('searchTerm')?.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged()
    ).subscribe(() => {
      this.pageIndex = 0;
      this.loadDayBook();
    });

    this.loadBranches();
    this.loadDayBook();
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  loadBranches(): void {
    this.branchService.getBranches().subscribe({
      next: (res) => {
        this.branches = res || [];
      },
      error: () => {}
    });
  }

  getSelectedBranchName(): string {
    if (!this.selectedBranchId) return 'All Campuses Consolidated';
    const found = this.branches.find(b => b.id === this.selectedBranchId);
    return found ? found.name : 'All Campuses Consolidated';
  }

  onDateChanged(): void {
    this.pageIndex = 0;
    this.loadDayBook();
  }

  onSortChange(sort: Sort): void {
    this.sortBy = sort.active || 'timestamp';
    this.sortDescending = sort.direction === 'desc';
    this.pageIndex = 0;
    this.loadDayBook();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadDayBook();
  }

  isLastPage(): boolean {
    if (!this.report) return false;
    const totalCount = this.report.totalCount ?? (this.report.transactions?.length || 0);
    const totalPages = this.report.totalPages || (totalCount > 0 ? Math.ceil(totalCount / this.pageSize) : 1);
    return this.pageIndex >= totalPages - 1;
  }

  loadDayBook(): void {
    this.loading = true;
    this.error = null;

    const dateStr = this.formatDateParam(this.selectedDate);

    this.financeService.getDayBook({
      date: dateStr,
      branchId: this.selectedBranchId || undefined,
      voucherType: this.voucherTypeFilter !== 'All' ? this.voucherTypeFilter : undefined,
      paymentMode: this.paymentModeFilter !== 'All' ? this.paymentModeFilter : undefined,
      academicScope: this.selectedAcademicScope,
      searchTerm: this.searchTerm.trim() ? this.searchTerm.trim() : undefined,
      sortBy: this.sortBy,
      sortDescending: this.sortDescending,
      pageNumber: this.pageIndex + 1,
      pageSize: this.pageSize
    }).subscribe({
      next: (res) => {
        this.report = res;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || err?.message || 'Could not load Day Book records for the selected date.';
      }
    });
  }

  private formatDateParam(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Dynamic Quick Relative Date Presets
  get quickDatePresets(): { id: string; label: string; date: Date }[] {
    const today = new Date();
    const y = new Date();
    y.setDate(today.getDate() - 1);
    const d2 = new Date();
    d2.setDate(today.getDate() - 2);
    const d3 = new Date();
    d3.setDate(today.getDate() - 3);

    return [
      { id: 'today', label: 'Today', date: today },
      { id: 'yesterday', label: 'Yesterday', date: y },
      { id: 'd2', label: this.formatPresetDateLabel(d2), date: d2 },
      { id: 'd3', label: this.formatPresetDateLabel(d3), date: d3 }
    ];
  }

  private formatPresetDateLabel(d: Date): string {
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(d);
  }

  setPresetDate(d: Date): void {
    this.pageIndex = 0;
    this.filterForm.patchValue({ date: new Date(d) });
  }

  isPresetDateActive(d: Date): boolean {
    return this.selectedDate.toDateString() === d.toDateString();
  }

  setPreset(preset: string): void {
    this.pageIndex = 0;
    const today = new Date();
    if (preset === 'today') {
      this.filterForm.patchValue({ date: today });
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(today.getDate() - 1);
      this.filterForm.patchValue({ date: y });
    }
  }

  isPresetActive(preset: string): boolean {
    const d = this.selectedDate;
    if (preset === 'today') {
      const t = new Date();
      return d.toDateString() === t.toDateString();
    }
    if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return d.toDateString() === y.toDateString();
    }
    return false;
  }

  setVoucherFilter(type: string): void {
    this.pageIndex = 0;
    this.filterForm.patchValue({ voucherType: type });
  }

  setModeFilter(mode: string): void {
    this.pageIndex = 0;
    this.filterForm.patchValue({ paymentMode: mode });
  }

  clearSearch(): void {
    this.pageIndex = 0;
    this.filterForm.patchValue({ searchTerm: '' });
  }

  // Returns server-filtered, sorted and paged transactions
  get filteredTransactions(): DayBookTransactionDto[] {
    return this.report?.transactions || [];
  }

  formatToISTTime(dateVal: string | Date | undefined): string {
    if (!dateVal) return '-';
    let str = String(dateVal).trim();
    if (!str.endsWith('Z') && !str.includes('+') && str.includes('T')) {
      str += 'Z';
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return String(dateVal);

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(d);
  }

  getModeIcon(mode: string): string {
    if (!mode) return 'payment';
    const m = mode.toLowerCase();
    if (m.includes('cash')) return 'payments';
    if (m.includes('upi') || m.includes('online')) return 'qr_code_2';
    if (m.includes('bank') || m.includes('neft')) return 'account_balance';
    if (m.includes('cheque')) return 'receipt';
    return 'credit_card';
  }

  copyVoucher(voucherNo: string): void {
    if (!voucherNo) return;
    navigator.clipboard.writeText(voucherNo).then(() => {
      this.dialogService.alert(
        'Voucher Copied (वाउचर कॉपी किया गया)',
        `Voucher number "${voucherNo}" has been copied to your clipboard successfully.`,
        'success'
      );
    });
  }

  printDayBook(): void {
    window.print();
  }

  exportToCSV(): void {
    if (!this.report?.transactions.length) return;

    const total = this.report.totalCount || this.report.transactions.length;
    // If the server has more matching records than the current page, fetch all for full CSV export
    if (total > this.report.transactions.length) {
      this.loading = true;
      const dateStr = this.formatDateParam(this.selectedDate);
      this.financeService.getDayBook({
        date: dateStr,
        branchId: this.selectedBranchId || undefined,
        voucherType: this.voucherTypeFilter !== 'All' ? this.voucherTypeFilter : undefined,
        paymentMode: this.paymentModeFilter !== 'All' ? this.paymentModeFilter : undefined,
        academicScope: this.selectedAcademicScope,
        searchTerm: this.searchTerm.trim() ? this.searchTerm.trim() : undefined,
        sortBy: this.sortBy,
        sortDescending: this.sortDescending,
        pageNumber: 1,
        pageSize: 10000
      }).subscribe({
        next: (fullReport) => {
          this.loading = false;
          this.downloadCSV(fullReport.transactions);
        },
        error: () => {
          this.loading = false;
          this.downloadCSV(this.report!.transactions);
          this.dialogService.alert(
            'Notice (सूचना)',
            'Could not retrieve full dataset from server. Exported current visible page records.',
            'warning'
          );
        }
      });
    } else {
      this.downloadCSV(this.report.transactions);
    }
  }

  private downloadCSV(transactions: DayBookTransactionDto[]): void {
    if (!transactions.length) return;

    const headers = [
      '#',
      'Time (IST)',
      'Voucher No',
      'Type',
      'Account Head',
      'Division',
      'Particulars',
      'Payment Mode',
      'Reference No',
      'Debit Outflow (INR)',
      'Credit Inflow (INR)',
      'Running Balance (INR)'
    ];

    const rows = transactions.map((t, idx) => [
      (idx + 1).toString(),
      `"${this.formatToISTTime(t.timestamp)}"`,
      `"${t.voucherNumber}"`,
      `"${t.voucherType}"`,
      `"${t.accountHead}"`,
      `"${t.division}"`,
      `"${(t.particulars || '').replace(/"/g, '""')}"`,
      `"${t.paymentMode}"`,
      `"${t.referenceNumber || ''}"`,
      t.debitAmount.toFixed(2),
      t.creditAmount.toFixed(2),
      t.runningBalance.toFixed(2)
    ]);

    const csvContent = [
      `"DAY BOOK JOURNAL - ${this.formatDateParam(this.selectedDate)}"`,
      `"Campus: ${this.getSelectedBranchName()}"`,
      `"Opening Balance: INR ${this.report?.openingBalance.toFixed(2) || '0.00'}"`,
      `"Total Receipts: INR ${this.report?.totalInflow.toFixed(2) || '0.00'}"`,
      `"Total Payments: INR ${this.report?.totalOutflow.toFixed(2) || '0.00'}"`,
      `"Closing Balance: INR ${this.report?.closingBalance.toFixed(2) || '0.00'}"`,
      '',
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DayBook_${this.formatDateParam(this.selectedDate)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
