import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { FinanceService, ProfitLossReportDto } from '../../core/services/finance.service';
import { BranchService } from '../../core/services/branch.service';

@Component({
  selector: 'app-profit-loss',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatCardModule
  ],
  template: `
<div class="page-container">
  <!-- Header Bar -->
  <div class="header-card no-print">
    <div class="header-left">
      <div class="header-icon-box">
        <mat-icon>query_stats</mat-icon>
      </div>
      <div>
        <h1 class="page-title">Profit &amp; Loss Statement</h1>
        <p class="page-subtitle">लाभ एवं हानि खाता &bull; Comprehensive Income &amp; Operating Expenditure Statement</p>
      </div>
    </div>
    <div class="smart-control-deck">
      <!-- Financial Year Selector -->
      <div class="control-unit">
        <div class="unit-icon-badge">
          <mat-icon>date_range</mat-icon>
        </div>
        <div class="unit-details">
          <span class="unit-label">Financial Period</span>
          <mat-select [(ngModel)]="selectedFy" (selectionChange)="loadReport()" class="unit-select fy-select">
            <mat-option value="2026-2027">FY 2026 - 2027 (Current)</mat-option>
            <mat-option value="2025-2026">FY 2025 - 2026</mat-option>
            <mat-option value="2024-2025">FY 2024 - 2025</mat-option>
          </mat-select>
        </div>
      </div>

      <div class="unit-separator" *ngIf="branches.length > 0"></div>

      <!-- Branch Filter -->
      <div class="control-unit" *ngIf="branches.length > 0">
        <div class="unit-icon-badge">
          <mat-icon>apartment</mat-icon>
        </div>
        <div class="unit-details">
          <span class="unit-label">Campus Scope</span>
          <mat-select [(ngModel)]="selectedBranchId" (selectionChange)="loadReport()" class="unit-select branch-select">
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

      <!-- Action Buttons -->
      <div class="deck-actions">
        <button mat-button class="smart-btn refresh-btn" (click)="loadReport()" matTooltip="Recalculate Profit & Loss" [disabled]="loading">
          <mat-icon [class.spin-icon]="loading">refresh</mat-icon>
          <span>Recalculate</span>
        </button>

        <button mat-flat-button class="smart-btn print-btn" (click)="printReport()" matTooltip="Print or Export Financial Statement">
          <mat-icon>print</mat-icon>
          <span>Print Statement</span>
        </button>
      </div>
    </div>
  </div>

  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

  <!-- Printable Header (Visible Only on Print) -->
  <div class="print-header only-print">
    <div class="print-title-box">
      <h2>IMSERP EDUCATIONAL INSTITUTION</h2>
      <h3>PROFIT &amp; LOSS STATEMENT (INCOME &amp; EXPENDITURE A/C)</h3>
      <p>Financial Period: <strong>{{ report?.financialYear }}</strong> ({{ report?.fromDate | date:'mediumDate' }} to {{ report?.toDate | date:'mediumDate' }}) &bull; Campus: <strong>{{ report?.branchName }}</strong></p>
    </div>
  </div>

  <!-- KPI Metrics Grid -->
  <div class="kpi-grid" *ngIf="report">
    <div class="kpi-card income">
      <div class="kpi-icon income"><mat-icon>trending_up</mat-icon></div>
      <div class="kpi-info">
        <span class="kpi-label">Gross Revenue (Incomes)</span>
        <span class="kpi-value text-green">₹{{ report.totalDirectIncome | number:'1.2-2' }}</span>
        <span class="kpi-sub">Fees, tuition, transport, hostel &amp; fines</span>
      </div>
    </div>

    <div class="kpi-card payroll">
      <div class="kpi-icon payroll"><mat-icon>groups</mat-icon></div>
      <div class="kpi-info">
        <span class="kpi-label">Staff Payroll Outflow</span>
        <span class="kpi-value text-orange">₹{{ report.totalPayrollExpense | number:'1.2-2' }}</span>
        <span class="kpi-sub">{{ getPayrollShare() }}% of total expenditure</span>
      </div>
    </div>

    <div class="kpi-card opex">
      <div class="kpi-icon opex"><mat-icon>storefront</mat-icon></div>
      <div class="kpi-info">
        <span class="kpi-label">Operational Outflow</span>
        <span class="kpi-value text-amber">₹{{ report.totalOperatingExpense | number:'1.2-2' }}</span>
        <span class="kpi-sub">Campus rent, fuel, utilities &amp; supplies</span>
      </div>
    </div>

    <div class="kpi-card surplus" [ngClass]="{ 'loss': !report.isSurplus }">
      <div class="kpi-icon" [ngClass]="report.isSurplus ? 'surplus' : 'loss'">
        <mat-icon>{{ report.isSurplus ? 'verified' : 'warning' }}</mat-icon>
      </div>
      <div class="kpi-info">
        <span class="kpi-label">{{ report.isSurplus ? 'Net Operating Surplus (Profit)' : 'Net Operating Deficit (Loss)' }}</span>
        <span class="kpi-value" [ngClass]="report.isSurplus ? 'text-green' : 'text-red'">
          ₹{{ (report.isSurplus ? report.netProfitOrLoss : -report.netProfitOrLoss) | number:'1.2-2' }}
        </span>
        <span class="kpi-sub">Net Profit Margin: <strong>{{ report.profitMarginPercentage }}%</strong></span>
      </div>
    </div>
  </div>

  <!-- Two-Column Statement Layout (Incomes vs Expenses) -->
  <div class="statement-grid" *ngIf="report">
    <!-- Left Column: Incomes / Receipts -->
    <div class="statement-card income-side">
      <div class="statement-header income">
        <div class="card-title-group">
          <mat-icon>add_circle_outline</mat-icon>
          <h3>Direct Incomes &amp; Academic Receipts (Credit)</h3>
        </div>
        <span class="header-total text-green">₹{{ report.totalDirectIncome | number:'1.2-2' }}</span>
      </div>

      <div class="statement-body">
        <table class="statement-table">
          <thead>
            <tr>
              <th>Particulars (Fee Heads)</th>
              <th class="text-right">Share %</th>
              <th class="text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let inc of report.incomes">
              <td>
                <div class="head-title">{{ inc.headName }}</div>
                <div class="progress-wrap">
                  <div class="progress-bar-fill green" [style.width.%]="inc.percentageOfTotal"></div>
                </div>
              </td>
              <td class="text-right text-muted">{{ inc.percentageOfTotal }}%</td>
              <td class="text-right font-bold">₹{{ inc.amount | number:'1.2-2' }}</td>
            </tr>
            <tr *ngIf="report.incomes.length === 0">
              <td colspan="3" class="text-center text-muted empty-cell">No fee receipts recorded in this financial period.</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="total-row income-total">
              <td>Total Receipts &amp; Incomes (A)</td>
              <td class="text-right">100.0%</td>
              <td class="text-right">₹{{ report.totalDirectIncome | number:'1.2-2' }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Right Column: Operating & Personnel Expenditures -->
    <div class="statement-card expense-side">
      <div class="statement-header expense">
        <div class="card-title-group">
          <mat-icon>remove_circle_outline</mat-icon>
          <h3>Expenditures &amp; Operational Costs (Debit)</h3>
        </div>
        <span class="header-total text-red">₹{{ report.totalExpense | number:'1.2-2' }}</span>
      </div>

      <div class="statement-body">
        <table class="statement-table">
          <thead>
            <tr>
              <th>Particulars (Expense Heads)</th>
              <th class="text-right">Share %</th>
              <th class="text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let exp of report.expenses">
              <td>
                <div class="head-title">
                  {{ exp.headName }}
                  <span class="payroll-tag" *ngIf="exp.isPayroll">HR / Payroll</span>
                </div>
                <div class="progress-wrap">
                  <div class="progress-bar-fill red" [style.width.%]="exp.percentageOfTotal"></div>
                </div>
              </td>
              <td class="text-right text-muted">{{ exp.percentageOfTotal }}%</td>
              <td class="text-right font-bold">₹{{ exp.amount | number:'1.2-2' }}</td>
            </tr>
            <tr *ngIf="report.expenses.length === 0">
              <td colspan="3" class="text-center text-muted empty-cell">No expense vouchers or salary payments recorded in this period.</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="total-row expense-total">
              <td>Total Operating Costs (B)</td>
              <td class="text-right">100.0%</td>
              <td class="text-right">₹{{ report.totalExpense | number:'1.2-2' }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>

  <!-- Summary Balance Strip -->
  <div class="summary-balance-strip" *ngIf="report" [ngClass]="report.isSurplus ? 'surplus' : 'deficit'">
    <div class="strip-left">
      <mat-icon class="strip-icon">{{ report.isSurplus ? 'monetization_on' : 'error' }}</mat-icon>
      <div>
        <h4>{{ report.isSurplus ? 'NET SURPLUS TRANSFERRED TO BALANCE SHEET EQUITY' : 'NET OPERATING DEFICIT (LOSS)' }}</h4>
        <p>Calculation: Total Incomes (₹{{ report.totalDirectIncome | number:'1.2-2' }}) &minus; Total Expenditures (₹{{ report.totalExpense | number:'1.2-2' }})</p>
      </div>
    </div>
    <div class="strip-right">
      <div class="strip-amount">{{ report.netProfitOrLoss < 0 ? '-₹' + ((-report.netProfitOrLoss) | number:'1.2-2') : '₹' + (report.netProfitOrLoss | number:'1.2-2') }}</div>
      <div class="strip-margin">{{ report.profitMarginPercentage }}% Net Profit Margin</div>
    </div>
  </div>

  <!-- 12-Month Monthly Trend Grid -->
  <div class="trend-card no-print" *ngIf="report && report.monthlyTrends.length > 0">
    <div class="trend-header">
      <div class="card-title-group">
        <mat-icon>calendar_month</mat-icon>
        <h3>Monthly Financial Breakdown &amp; Cash Flow Trends</h3>
      </div>
      <span class="text-xs text-muted">12-Month Progression (April &minus; March)</span>
    </div>

    <div class="trend-table-wrapper">
      <table class="trend-table">
        <thead>
          <tr>
            <th>Month</th>
            <th class="text-right">Fees Collected (₹)</th>
            <th class="text-right">Total Outflow (₹)</th>
            <th class="text-right">Net Surplus (₹)</th>
            <th class="text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let m of report.monthlyTrends">
            <td class="font-bold">{{ m.monthName }}</td>
            <td class="text-right text-green font-semibold">₹{{ m.totalIncome | number:'1.2-2' }}</td>
            <td class="text-right text-red font-semibold">₹{{ m.totalExpense | number:'1.2-2' }}</td>
            <td class="text-right font-bold" [ngClass]="m.netSurplus > 0 ? 'text-green' : (m.netSurplus < 0 ? 'text-red' : 'text-muted')">
              {{ m.netSurplus < 0 ? '-₹' + ((-m.netSurplus) | number:'1.2-2') : '₹' + (m.netSurplus | number:'1.2-2') }}
            </td>
            <td class="text-center">
              <span class="status-pill" [ngClass]="m.netSurplus > 0 ? 'pill-surplus' : (m.netSurplus < 0 ? 'pill-deficit' : 'pill-neutral')">
                {{ m.netSurplus > 0 ? 'Surplus' : (m.netSurplus < 0 ? 'Deficit' : 'Nil') }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Signature Row (Print Only) -->
  <div class="print-signatures only-print">
    <div class="sig-box">
      <div class="sig-line"></div>
      <span>Prepared By (Accountant)</span>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <span>Verified By (Finance Head)</span>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <span>Authorized Signatory (Director / Principal)</span>
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
    }

    .header-card {
      background: #ffffff;
      border-radius: 14px;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid #e2e8f0;
      box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.04);
      gap: 16px;
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
      background: #2563eb;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
      flex-shrink: 0;
    }

    .page-title {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
    }

    .page-subtitle {
      margin: 4px 0 0;
      font-size: 13px;
      color: #64748b;
    }

    /* Smart Control Deck Styling */
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
      gap: 10px;
      padding: 0 12px;
      border-radius: 10px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      transition: all 0.2s ease;

      &:hover {
        border-color: #cbd5e1;
        background: #fafbfc;
      }
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
      justify-content: center;
      height: 100%;
      min-width: 0;
    }

    .unit-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      line-height: 1.1;
      margin-bottom: 2px;
      display: block;
    }

    .select-value-text {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      line-height: 20px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .unit-select {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      line-height: 20px;

      &.fy-select {
        min-width: 140px;
      }

      &.branch-select {
        min-width: 160px;
        max-width: 220px;
      }
    }

    ::ng-deep .unit-select .mat-mdc-select-trigger {
      height: 20px;
      display: inline-flex;
      align-items: center;
    }

    .unit-separator {
      width: 1px;
      height: 30px;
      background: #e2e8f0;
    }

    .deck-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .smart-btn {
      height: 38px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 14px;
      transition: all 0.2s ease;

      mat-icon { font-size: 18px; width: 18px; height: 18px; }

      &.refresh-btn {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        color: #334155;

        &:hover {
          background: #f1f5f9;
          border-color: #94a3b8;
          color: #0f172a;
        }
      }

      &.print-btn {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        color: #ffffff;
        box-shadow: 0 2px 4px -1px rgba(37, 99, 235, 0.25);

        &:hover {
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.35);
        }
      }
    }

    .spin-icon {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    /* Responsive Media Queries for All Screen Sizes */
    @media (max-width: 1100px) {
      .header-card {
        flex-direction: column;
        align-items: stretch;
        gap: 14px;
      }

      .header-left {
        width: 100%;
      }

      .smart-control-deck {
        width: 100%;
        box-sizing: border-box;
      }
    }

    @media (max-width: 768px) {
      .smart-control-deck {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        padding: 10px;
      }

      .control-unit {
        width: 100%;
      }

      .unit-details {
        width: 100%;
      }

      .unit-select.fy-select,
      .unit-select.branch-select {
        min-width: 0;
        width: 100%;
        max-width: none;
      }

      .unit-separator {
        display: none;
      }

      .deck-actions {
        width: 100%;
        display: flex;
        gap: 8px;
      }

      .smart-btn {
        flex: 1;
        justify-content: center;
      }
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }

    .kpi-card {
      background: #ffffff;
      border-radius: 12px;
      padding: 18px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      display: flex;
      align-items: center;
      gap: 14px;

      &.surplus {
        border-color: #86efac;
        background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%);
      }

      &.loss {
        border-color: #fca5a5;
        background: linear-gradient(135deg, #fef2f2 0%, #ffffff 100%);
      }
    }

    .kpi-icon {
      width: 46px;
      height: 46px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;

      &.income { background: #dcfce7; color: #15803d; }
      &.payroll { background: #ffedd5; color: #c2410c; }
      &.opex { background: #fef3c7; color: #b45309; }
      &.surplus { background: #bbf7d0; color: #166534; }
      &.loss { background: #fee2e2; color: #b91c1c; }
    }

    .kpi-info {
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
      font-size: 21px;
      font-weight: 800;
      margin: 2px 0;
    }

    .kpi-sub {
      font-size: 11px;
      color: #94a3b8;
    }

    .text-green { color: #15803d; }
    .text-orange { color: #c2410c; }
    .text-amber { color: #b45309; }
    .text-red { color: #b91c1c; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .text-muted { color: #64748b; }

    /* Statement Grid */
    .statement-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .statement-card {
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.04);
    }

    .statement-header {
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;

      &.income {
        background: #f0fdf4;
        border-bottom: 2px solid #bbf7d0;
        color: #166534;
      }

      &.expense {
        background: #fef2f2;
        border-bottom: 2px solid #fecaca;
        color: #991b1b;
      }
    }

    .card-title-group {
      display: flex;
      align-items: center;
      gap: 10px;

      h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
      }
    }

    .header-total {
      font-size: 18px;
      font-weight: 800;
    }

    .statement-body {
      padding: 12px 16px;
    }

    .statement-table {
      width: 100%;
      border-collapse: collapse;

      th {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #64748b;
        padding: 8px 12px;
        border-bottom: 1px solid #e2e8f0;
      }

      td {
        padding: 10px 12px;
        border-bottom: 1px solid #f1f5f9;
        font-size: 13px;
      }

      .head-title {
        font-weight: 600;
        color: #1e293b;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .payroll-tag {
        font-size: 10px;
        background: #ffedd5;
        color: #c2410c;
        padding: 1px 6px;
        border-radius: 4px;
        font-weight: 700;
      }

      .progress-wrap {
        height: 4px;
        background: #f1f5f9;
        border-radius: 2px;
        margin-top: 4px;
        width: 100%;
        overflow: hidden;
      }

      .progress-bar-fill {
        height: 100%;
        border-radius: 2px;
        &.green { background: #22c55e; }
        &.red { background: #ef4444; }
      }

      .empty-cell {
        padding: 24px;
      }

      .total-row td {
        font-weight: 800;
        font-size: 14px;
        padding: 12px;
      }

      .income-total td {
        background: #f0fdf4;
        color: #166534;
        border-top: 2px solid #86efac;
      }

      .expense-total td {
        background: #fef2f2;
        color: #991b1b;
        border-top: 2px solid #fca5a5;
      }
    }

    /* Summary Balance Strip */
    .summary-balance-strip {
      border-radius: 12px;
      padding: 18px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid;

      &.surplus {
        background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
        border-color: #6ee7b7;
        color: #065f46;

        .strip-icon { color: #059669; }
        .strip-amount { color: #047857; }
      }

      &.deficit {
        background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
        border-color: #fecdd3;
        color: #9f1239;

        .strip-icon { color: #e11d48; }
        .strip-amount { color: #be123c; }
      }
    }

    .strip-left {
      display: flex;
      align-items: center;
      gap: 14px;

      .strip-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
      }

      h4 {
        margin: 0;
        font-size: 16px;
        font-weight: 800;
        letter-spacing: 0.5px;
      }

      p {
        margin: 4px 0 0;
        font-size: 12px;
        opacity: 0.85;
      }
    }

    .strip-right {
      text-align: right;

      .strip-amount {
        font-size: 28px;
        font-weight: 900;
      }

      .strip-margin {
        font-size: 12px;
        font-weight: 700;
        opacity: 0.9;
      }
    }

    /* Monthly Trend Card */
    .trend-card {
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      padding: 18px 20px;
    }

    .trend-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .trend-table-wrapper {
      overflow-x: auto;
    }

    .trend-table {
      width: 100%;
      border-collapse: collapse;

      th {
        font-size: 11px;
        text-transform: uppercase;
        color: #64748b;
        padding: 8px 12px;
        border-bottom: 1px solid #e2e8f0;
      }

      td {
        padding: 10px 12px;
        border-bottom: 1px solid #f8fafc;
        font-size: 13px;
      }
    }

    .status-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 9999px;

      &.pill-surplus { background: #dcfce7; color: #15803d; }
      &.pill-deficit { background: #fee2e2; color: #b91c1c; }
      &.pill-neutral { background: #f1f5f9; color: #64748b; }
    }

    /* Print Only Styles */
    .only-print { display: none; }

    @media print {
      .no-print { display: none !important; }
      .only-print { display: block !important; }
      .page-container { padding: 0; max-width: 100%; }

      .print-header {
        text-align: center;
        border-bottom: 2px solid #000;
        padding-bottom: 12px;
        margin-bottom: 16px;

        h2 { margin: 0; font-size: 20px; }
        h3 { margin: 4px 0; font-size: 16px; color: #333; }
        p { margin: 0; font-size: 12px; }
      }

      .print-signatures {
        display: flex !important;
        justify-content: space-between;
        margin-top: 50px;
        padding-top: 20px;

        .sig-box {
          text-align: center;
          width: 200px;
          .sig-line { border-bottom: 1px solid #000; margin-bottom: 6px; }
          span { font-size: 12px; font-weight: bold; }
        }
      }
    }
  `]
})
export class ProfitLossComponent implements OnInit {
  report: ProfitLossReportDto | null = null;
  loading = false;
  selectedFy = '2025-2026';
  selectedBranchId: string | null = null;
  branches: any[] = [];

  constructor(
    private financeService: FinanceService,
    private branchService: BranchService
  ) {}

  ngOnInit(): void {
    // Current Indian Financial Year
    const now = new Date();
    const curYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    this.selectedFy = `${curYear}-${curYear + 1}`;

    this.loadBranches();
    this.loadReport();
  }

  loadBranches(): void {
    this.branchService.getBranches().subscribe({
      next: (b) => (this.branches = b || []),
      error: () => {}
    });
  }

  loadReport(): void {
    this.loading = true;
    this.financeService
      .getProfitLoss({
        financialYear: this.selectedFy,
        branchId: this.selectedBranchId || undefined
      })
      .subscribe({
        next: (data) => {
          this.report = data;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        }
      });
  }

  getPayrollShare(): number {
    if (!this.report || this.report.totalExpense === 0) return 0;
    return Math.round((this.report.totalPayrollExpense / this.report.totalExpense) * 100);
  }

  getSelectedBranchName(): string {
    if (!this.selectedBranchId) return 'All Campuses Consolidated';
    const b = this.branches.find((x) => x.id === this.selectedBranchId);
    return b ? b.name : 'All Campuses Consolidated';
  }

  printReport(): void {
    window.print();
  }
}
