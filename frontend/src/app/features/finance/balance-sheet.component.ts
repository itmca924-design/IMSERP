import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FinanceService, BalanceSheetReportDto, BalanceSheetItemDto } from '../../core/services/finance.service';
import { BranchService } from '../../core/services/branch.service';

@Component({
  selector: 'app-balance-sheet',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatTabsModule,
    MatCardModule,
    MatDialogModule
  ],
  template: `
<div class="page-container">
  <!-- Header Bar -->
  <div class="header-card no-print">
    <div class="header-left">
      <div class="header-icon-box">
        <mat-icon>account_balance_wallet</mat-icon>
      </div>
      <div>
        <h1 class="page-title">Balance Sheet</h1>
        <p class="page-subtitle">तुलन पत्र &bull; Institutional Statement of Assets, Liabilities, Capital &amp; Net Worth</p>
      </div>
    </div>
    <div class="smart-control-deck">
      <!-- As Of Date Selector -->
      <div class="control-unit date-unit" (click)="asOfPicker.open()">
        <div class="unit-icon-badge">
          <mat-icon>calendar_month</mat-icon>
        </div>
        <div class="unit-details">
          <span class="unit-label">As of Balance Date</span>
          <div class="date-display-row">
            <span class="date-text">{{ asOfDate | date:'mediumDate' }}</span>
            <input matInput [matDatepicker]="asOfPicker" [(ngModel)]="asOfDate" (dateChange)="loadReport()" class="hidden-picker-input">
            <mat-datepicker-toggle [for]="asOfPicker" class="inline-picker-toggle"></mat-datepicker-toggle>
            <mat-datepicker #asOfPicker></mat-datepicker>
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
        <button mat-button class="smart-btn refresh-btn" (click)="loadReport()" matTooltip="Recalculate Balance Sheet" [disabled]="loading">
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
      <h3>BALANCE SHEET (STATEMENT OF FINANCIAL POSITION)</h3>
      <p>As of Date: <strong>{{ report?.asOfDate | date:'fullDate' }}</strong> &bull; Campus: <strong>{{ report?.branchName }}</strong></p>
    </div>
  </div>

  <!-- Balanced Status Banner -->
  <div class="balance-banner" *ngIf="report" [ngClass]="report.isBalanced ? 'balanced' : 'unbalanced'">
    <div class="banner-left">
      <div class="status-icon">
        <mat-icon>{{ report.isBalanced ? 'check_circle' : 'error' }}</mat-icon>
      </div>
      <div>
        <h4>{{ report.isBalanced ? 'FINANCIAL POSITION IS BALANCED & AUDIT-VERIFIED' : 'BALANCE MISMATCH DETECTED' }}</h4>
        <p *ngIf="report.isBalanced">
          Total Assets (<strong>₹{{ report.totalAssets | number:'1.2-2' }}</strong>) strictly equals Total Liabilities &amp; Equity (<strong>₹{{ report.totalLiabilitiesAndEquity | number:'1.2-2' }}</strong>).
        </p>
        <p *ngIf="!report.isBalanced">
          Discrepancy of ₹{{ report.difference | number:'1.2-2' }} between Assets and Liabilities + Equity.
        </p>
      </div>
    </div>
    <div class="banner-right">
      <div class="equation-chip">
        <span>Assets = Liabilities + Equity</span>
      </div>
    </div>
  </div>

  <!-- Format Presentation Mode (T-Format vs Vertical) -->
  <div class="format-tabs-wrap no-print">
    <button class="view-btn" [class.active]="viewMode === 't_format'" (click)="viewMode = 't_format'">
      <mat-icon>view_column</mat-icon>
      <span>T-Format (Double Entry)</span>
    </button>
    <button class="view-btn" [class.active]="viewMode === 'vertical'" (click)="viewMode = 'vertical'">
      <mat-icon>view_agenda</mat-icon>
      <span>Vertical Format (Corporate)</span>
    </button>
  </div>

  <!-- 1. T-FORMAT PRESENTATION (Liabilities & Capital on Left, Assets on Right) -->
  <div class="t-format-grid" *ngIf="report && viewMode === 't_format'">
    <!-- Left Side: Liabilities & Equity -->
    <div class="sheet-column liabilities-col">
      <div class="column-header liabilities">
        <div class="col-title-group">
          <mat-icon>account_balance</mat-icon>
          <h3>Capital, Reserves &amp; Liabilities</h3>
        </div>
        <span class="col-total">₹{{ report.totalLiabilitiesAndEquity | number:'1.2-2' }}</span>
      </div>

      <div class="column-body">
        <!-- 1. Equity & Capital Section -->
        <div class="section-block">
          <div class="section-title">I. Capital Fund &amp; Reserves</div>
          <table class="item-table">
            <tbody>
              <tr *ngFor="let item of report.equityAndCapital.items" (click)="showDetails(item)" class="clickable-row">
                <td class="item-title-cell">
                  <div class="item-title">{{ item.title }}</div>
                  <div class="text-xs text-muted" *ngIf="item.note">{{ item.note }}</div>
                </td>
                <td class="text-right item-amt">{{ item.amount < 0 ? '-₹' + ((-item.amount) | number:'1.2-2') : '₹' + (item.amount | number:'1.2-2') }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="subtotal-row">
                <td>Subtotal (Capital &amp; Reserves)</td>
                <td class="text-right font-bold">₹{{ report.equityAndCapital.totalAmount | number:'1.2-2' }}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- 2. Long Term Liabilities -->
        <div class="section-block" *ngIf="report.longTermLiabilities.items.length > 0">
          <div class="section-title">II. Long-Term Borrowings</div>
          <table class="item-table">
            <tbody>
              <tr *ngFor="let item of report.longTermLiabilities.items" (click)="showDetails(item)" class="clickable-row">
                <td class="item-title-cell">
                  <div class="item-title">{{ item.title }}</div>
                  <div class="text-xs text-muted" *ngIf="item.note">{{ item.note }}</div>
                </td>
                <td class="text-right item-amt">₹{{ item.amount | number:'1.2-2' }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="subtotal-row">
                <td>Subtotal (Long-Term Loans)</td>
                <td class="text-right font-bold">₹{{ report.longTermLiabilities.totalAmount | number:'1.2-2' }}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- 3. Current Liabilities -->
        <div class="section-block">
          <div class="section-title">III. Current Liabilities &amp; Provisions</div>
          <table class="item-table">
            <tbody>
              <tr *ngFor="let item of report.currentLiabilities.items" (click)="showDetails(item)" class="clickable-row">
                <td class="item-title-cell">
                  <div class="item-title">{{ item.title }}</div>
                  <div class="text-xs text-muted" *ngIf="item.note">{{ item.note }}</div>
                </td>
                <td class="text-right item-amt">₹{{ item.amount | number:'1.2-2' }}</td>
              </tr>
              <tr *ngIf="report.currentLiabilities.items.length === 0">
                <td colspan="2" class="text-muted text-xs p-2">No current liabilities recorded.</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="subtotal-row">
                <td>Subtotal (Current Liabilities)</td>
                <td class="text-right font-bold">₹{{ report.currentLiabilities.totalAmount | number:'1.2-2' }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Grand Total Footer -->
      <div class="column-grand-total liabilities-total">
        <span>TOTAL LIABILITIES &amp; EQUITY</span>
        <span class="grand-amt">₹{{ report.totalLiabilitiesAndEquity | number:'1.2-2' }}</span>
      </div>
    </div>

    <!-- Right Side: Assets -->
    <div class="sheet-column assets-col">
      <div class="column-header assets">
        <div class="col-title-group">
          <mat-icon>business</mat-icon>
          <h3>Properties &amp; Institutional Assets</h3>
        </div>
        <span class="col-total">₹{{ report.totalAssets | number:'1.2-2' }}</span>
      </div>

      <div class="column-body">
        <!-- 1. Fixed Assets (Non-Current) -->
        <div class="section-block">
          <div class="section-title">I. Fixed Assets (Net of Depreciation)</div>
          <table class="item-table">
            <tbody>
              <tr *ngFor="let item of report.fixedAssets.items" (click)="showDetails(item)" class="clickable-row">
                <td class="item-title-cell">
                  <div class="item-title">{{ item.title }}</div>
                  <div class="text-xs text-muted" *ngIf="item.note">{{ item.note }}</div>
                </td>
                <td class="text-right item-amt">₹{{ item.amount | number:'1.2-2' }}</td>
              </tr>
              <tr *ngIf="report.fixedAssets.items.length === 0">
                <td colspan="2" class="text-muted text-xs p-2">No fixed assets registered in Chart of Accounts.</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="subtotal-row">
                <td>Subtotal (Fixed Assets)</td>
                <td class="text-right font-bold">₹{{ report.fixedAssets.totalAmount | number:'1.2-2' }}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- 2. Current Assets -->
        <div class="section-block">
          <div class="section-title">II. Current Assets &amp; Receivables</div>
          <table class="item-table">
            <tbody>
              <tr *ngFor="let item of report.currentAssets.items" (click)="showDetails(item)" class="clickable-row">
                <td class="item-title-cell">
                  <div class="item-title">
                    {{ item.title }}
                    <span class="live-pill" *ngIf="item.isDynamic">Dynamic</span>
                  </div>
                  <div class="text-xs text-muted" *ngIf="item.note">{{ item.note }}</div>
                </td>
                <td class="text-right item-amt font-semibold">₹{{ item.amount | number:'1.2-2' }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="subtotal-row">
                <td>Subtotal (Current Assets)</td>
                <td class="text-right font-bold">₹{{ report.currentAssets.totalAmount | number:'1.2-2' }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Grand Total Footer -->
      <div class="column-grand-total assets-total">
        <span>TOTAL ASSETS</span>
        <span class="grand-amt">₹{{ report.totalAssets | number:'1.2-2' }}</span>
      </div>
    </div>
  </div>

  <!-- 2. VERTICAL FORMAT PRESENTATION -->
  <div class="vertical-format-wrap" *ngIf="report && viewMode === 'vertical'">
    <!-- Assets Section -->
    <div class="vertical-card">
      <div class="vertical-card-header assets">
        <h3>1. ASSETS</h3>
        <span class="v-amt">₹{{ report.totalAssets | number:'1.2-2' }}</span>
      </div>
      <div class="vertical-card-body">
        <h4 class="sub-head">A. Fixed Assets</h4>
        <div class="v-row" *ngFor="let item of report.fixedAssets.items">
          <span>{{ item.title }}</span>
          <span class="font-bold">₹{{ item.amount | number:'1.2-2' }}</span>
        </div>
        <div class="v-subtotal">Subtotal Fixed Assets: <strong>₹{{ report.fixedAssets.totalAmount | number:'1.2-2' }}</strong></div>

        <h4 class="sub-head mt-4">B. Current Assets</h4>
        <div class="v-row" *ngFor="let item of report.currentAssets.items">
          <span>{{ item.title }}</span>
          <span class="font-bold">₹{{ item.amount | number:'1.2-2' }}</span>
        </div>
        <div class="v-subtotal">Subtotal Current Assets: <strong>₹{{ report.currentAssets.totalAmount | number:'1.2-2' }}</strong></div>
      </div>
      <div class="v-grand-total assets">
        <span>TOTAL ASSETS (A + B)</span>
        <span>₹{{ report.totalAssets | number:'1.2-2' }}</span>
      </div>
    </div>

    <!-- Liabilities & Equity Section -->
    <div class="vertical-card mt-4">
      <div class="vertical-card-header liabilities">
        <h3>2. LIABILITIES &amp; CAPITAL FUND</h3>
        <span class="v-amt">₹{{ report.totalLiabilitiesAndEquity | number:'1.2-2' }}</span>
      </div>
      <div class="vertical-card-body">
        <h4 class="sub-head">A. Capital &amp; Reserves</h4>
        <div class="v-row" *ngFor="let item of report.equityAndCapital.items">
          <span>{{ item.title }}</span>
          <span class="font-bold">{{ item.amount < 0 ? '-₹' + ((-item.amount) | number:'1.2-2') : '₹' + (item.amount | number:'1.2-2') }}</span>
        </div>
        <div class="v-subtotal">Subtotal Capital &amp; Reserves: <strong>₹{{ report.equityAndCapital.totalAmount | number:'1.2-2' }}</strong></div>

        <h4 class="sub-head mt-4">B. Liabilities</h4>
        <div class="v-row" *ngFor="let item of report.currentLiabilities.items">
          <span>{{ item.title }}</span>
          <span class="font-bold">₹{{ item.amount | number:'1.2-2' }}</span>
        </div>
        <div class="v-row" *ngFor="let item of report.longTermLiabilities.items">
          <span>{{ item.title }}</span>
          <span class="font-bold">₹{{ item.amount | number:'1.2-2' }}</span>
        </div>
        <div class="v-subtotal">Subtotal Liabilities: <strong>₹{{ (report.currentLiabilities.totalAmount + report.longTermLiabilities.totalAmount) | number:'1.2-2' }}</strong></div>
      </div>
      <div class="v-grand-total liabilities">
        <span>TOTAL LIABILITIES &amp; EQUITY (A + B)</span>
        <span>₹{{ report.totalLiabilitiesAndEquity | number:'1.2-2' }}</span>
      </div>
    </div>
  </div>

  <!-- Signatures for Print -->
  <div class="print-signatures only-print">
    <div class="sig-box">
      <div class="sig-line"></div>
      <span>Chartered Accountant / Internal Auditor</span>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <span>Chief Financial Officer / Bursar</span>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <span>President / Managing Trustee</span>
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
      gap: 12px;
      padding: 0 16px;
      border-radius: 10px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      transition: all 0.2s ease;
      cursor: pointer;

      &:hover {
        border-color: #cbd5e1;
        background: #fafbfc;
      }

      &.date-unit {
        min-width: 245px;
      }

      &.branch-unit {
        min-width: 320px;
        max-width: 440px;
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
      flex: 1;
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

    .date-display-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      height: 20px;
      width: 100%;
    }

    .date-text, .select-value-text {
      font-size: 13.5px;
      font-weight: 600;
      color: #0f172a;
      line-height: 20px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .date-text {
      min-width: 120px;
    }

    .hidden-picker-input {
      position: absolute;
      width: 0;
      height: 0;
      opacity: 0;
      pointer-events: none;
    }

    .inline-picker-toggle {
      transform: scale(0.85);
      margin: -6px -6px -6px 0;
    }

    .unit-select {
      font-size: 13.5px;
      font-weight: 600;
      color: #0f172a;
      line-height: 20px;
      width: 100%;

      &.branch-select {
        min-width: 260px;
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

    /* Balanced Status Banner */
    .balance-banner {
      border-radius: 12px;
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid;

      &.balanced {
        background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
        border-color: #86efac;
        color: #14532d;

        .status-icon { color: #16a34a; }
      }

      &.unbalanced {
        background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
        border-color: #fca5a5;
        color: #7f1d1d;

        .status-icon { color: #dc2626; }
      }
    }

    .banner-left {
      display: flex;
      align-items: center;
      gap: 14px;

      h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 0.5px;
      }

      p {
        margin: 2px 0 0;
        font-size: 12px;
      }
    }

    .status-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .equation-chip {
      background: #ffffff;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      color: #1e3a8a;
    }

    /* View Mode Tabs */
    .format-tabs-wrap {
      display: flex;
      gap: 10px;
      align-items: center;

      .view-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        color: #475569;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;

        mat-icon { font-size: 18px; width: 18px; height: 18px; }

        &.active {
          background: #2563eb;
          color: #ffffff;
          border-color: #2563eb;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
        }
      }
    }

    /* T-Format Grid */
    .t-format-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .sheet-column {
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.04);
    }

    .column-header {
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;

      &.liabilities {
        background: #eff6ff;
        border-bottom: 2px solid #bfdbfe;
        color: #1e40af;
      }

      &.assets {
        background: #f0fdf4;
        border-bottom: 2px solid #bbf7d0;
        color: #166534;
      }
    }

    .col-title-group {
      display: flex;
      align-items: center;
      gap: 8px;

      h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
      }
    }

    .col-total {
      font-size: 17px;
      font-weight: 800;
    }

    .column-body {
      flex: 1;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .section-block {
      background: #ffffff;
      border: 1px solid #f1f5f9;
      border-radius: 8px;
      overflow: hidden;
    }

    .section-title {
      background: #f8fafc;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 800;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #e2e8f0;
    }

    .item-table {
      width: 100%;
      border-collapse: collapse;

      td {
        padding: 8px 12px;
        border-bottom: 1px solid #f1f5f9;
        font-size: 13px;
      }

      .clickable-row:hover {
        background: #f8fafc;
      }

      .item-title-cell {
        vertical-align: top;
      }

      .item-title {
        font-weight: 600;
        color: #1e293b;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .live-pill {
        font-size: 9px;
        background: #e0f2fe;
        color: #0369a1;
        padding: 1px 5px;
        border-radius: 4px;
        font-weight: 700;
      }

      .subtotal-row td {
        background: #fbfcfe;
        font-size: 12px;
        padding: 8px 12px;
        color: #475569;
        border-top: 1px solid #e2e8f0;
      }
    }

    .column-grand-total {
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.5px;

      &.liabilities-total {
        background: #eff6ff;
        border-top: 2px solid #93c5fd;
        color: #1e3a8a;
      }

      &.assets-total {
        background: #f0fdf4;
        border-top: 2px solid #86efac;
        color: #14532d;
      }

      .grand-amt {
        font-size: 20px;
        font-weight: 900;
      }
    }

    /* Vertical Format */
    .vertical-card {
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
    }

    .vertical-card-header {
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;

      &.assets { background: #f0fdf4; color: #166534; }
      &.liabilities { background: #eff6ff; color: #1e40af; }

      h3 { margin: 0; font-size: 16px; font-weight: 800; }
      .v-amt { font-size: 18px; font-weight: 800; }
    }

    .vertical-card-body {
      padding: 16px 20px;

      .sub-head {
        margin: 0 0 8px;
        font-size: 13px;
        font-weight: 700;
        color: #475569;
        text-transform: uppercase;
      }

      .v-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #f1f5f9;
        font-size: 13px;
      }

      .v-subtotal {
        padding: 8px 0;
        text-align: right;
        font-size: 13px;
        color: #334155;
      }
    }

    .v-grand-total {
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 15px;
      font-weight: 800;

      &.assets { background: #dcfce7; color: #14532d; }
      &.liabilities { background: #dbeafe; color: #1e3a8a; }
    }

    .text-right { text-align: right; }
    .text-xs { font-size: 11px; }
    .text-muted { color: #64748b; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .mt-4 { margin-top: 16px; }

    /* Print only */
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
        margin-top: 60px;

        .sig-box {
          text-align: center;
          width: 220px;
          .sig-line { border-bottom: 1px solid #000; margin-bottom: 6px; }
          span { font-size: 12px; font-weight: bold; }
        }
      }
    }
  `]
})
export class BalanceSheetComponent implements OnInit {
  report: BalanceSheetReportDto | null = null;
  loading = false;
  asOfDate: Date = new Date();
  selectedBranchId: string | null = null;
  branches: any[] = [];
  viewMode: 't_format' | 'vertical' = 't_format';

  constructor(
    private financeService: FinanceService,
    private branchService: BranchService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
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
      .getBalanceSheet({
        asOfDate: this.asOfDate.toISOString(),
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

  showDetails(item: BalanceSheetItemDto): void {
    // Info tooltip/context
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
