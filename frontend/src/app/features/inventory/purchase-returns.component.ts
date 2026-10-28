import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';
import { InventoryService } from './inventory.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import {
  InventoryPurchaseReturn,
  InventoryVendor,
  InventoryItem,
  CreatePurchaseReturnDto
} from './inventory.models';

@Component({
  selector: 'app-purchase-returns',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatChipsModule,
    MatPaginatorModule,
    MatSortModule,
    IstDatetimeDirective
  ],
  template: `
    <div class="page-container">
      <!-- 1. Header Toolbar -->
      <div class="page-header-row">
        <div class="title-meta-wrap">
          <div class="title-badge-row">
            <span class="icon-avatar">
              <mat-icon>assignment_return</mat-icon>
            </span>
            <div>
              <h1 class="page-title">Purchase Returns &amp; Debit Notes (PR)</h1>
              <p class="page-subtitle">
                Return defective, damaged, or excess goods to suppliers with live stock deduction, debit note generation, and ledger credit
              </p>
            </div>
          </div>
        </div>

        <div class="action-btn-group">
          <button
            mat-flat-button
            color="warn"
            (click)="toggleCreateForm()"
            class="erp-btn">
            <mat-icon>{{ showCreateForm ? 'close' : 'add' }}</mat-icon>
            <span>{{ showCreateForm ? 'Close Return Form' : 'New Purchase Return (PR)' }}</span>
          </button>
          <button mat-icon-button (click)="loadAllData()" matTooltip="Refresh Data" class="refresh-btn">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
      </div>

      <!-- Module Sub-Nav Bar -->
      <div class="module-nav-bar">
        <a mat-button [routerLink]="['/inventory']" class="nav-tab">
          <mat-icon>inventory_2</mat-icon> Store &amp; Catalog
        </a>
        <a mat-button [routerLink]="['/inventory/purchase-returns']" class="nav-tab active-tab">
          <mat-icon>assignment_return</mat-icon> Purchase Returns
        </a>
        <a mat-button [routerLink]="['/inventory/sale-returns']" class="nav-tab">
          <mat-icon>keyboard_return</mat-icon> Kit &amp; Sale Returns
        </a>
        <a mat-button [routerLink]="['/inventory/vendors']" class="nav-tab">
          <mat-icon>account_balance_wallet</mat-icon> Vendors &amp; Ledger
        </a>
      </div>

      <!-- Single Prominent Loader Rule -->
      <mat-progress-bar *ngIf="loading" mode="indeterminate" class="global-loader"></mat-progress-bar>

      <!-- 2. KPI Metrics Deck -->
      <div class="kpi-grid">
        <mat-card class="kpi-card mat-elevation-z1">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Total Debit Notes (PR)</span>
              <span class="kpi-value text-danger">{{ returnsList.length }}</span>
              <span class="kpi-meta text-muted">Recorded returns</span>
            </div>
            <div class="kpi-icon-wrap bg-rose">
              <mat-icon>receipt_long</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card mat-elevation-z1">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Total Return Value</span>
              <span class="kpi-value text-danger">₹{{ totalReturnValue | number:'1.2-2' }}</span>
              <span class="kpi-meta text-muted">Debited to vendor ledger</span>
            </div>
            <div class="kpi-icon-wrap bg-red">
              <mat-icon>account_balance_wallet</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card mat-elevation-z1">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Active Vendors</span>
              <span class="kpi-value text-primary">{{ vendors.length }}</span>
              <span class="kpi-meta text-muted">Suppliers in catalog</span>
            </div>
            <div class="kpi-icon-wrap bg-blue">
              <mat-icon>storefront</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card mat-elevation-z1">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Items Returned</span>
              <span class="kpi-value text-amber">{{ totalItemsReturned }}</span>
              <span class="kpi-meta text-muted">Units deducted from stock</span>
            </div>
            <div class="kpi-icon-wrap bg-amber">
              <mat-icon>remove_shopping_cart</mat-icon>
            </div>
          </div>
        </mat-card>
      </div>

      <!-- 3. Embedded Return Creation Form (No Popup Dialog!) -->
      <mat-card *ngIf="showCreateForm" class="create-form-card mat-elevation-z2">
        <div class="form-header">
          <div class="f-title-row">
            <mat-icon class="f-icon">assignment_return</mat-icon>
            <div>
              <h2 class="f-title">Issue Purchase Return &amp; Generate Debit Note</h2>
              <p class="f-sub">Select vendor and items to return. Stock will be deducted and vendor ledger credited immediately.</p>
            </div>
          </div>
          <button mat-icon-button (click)="toggleCreateForm()" class="f-close-btn" matTooltip="Cancel & Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmitReturn()" class="return-form">
          <div class="form-top-row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Select Vendor (Supplier)*</mat-label>
              <mat-select formControlName="vendorId" placeholder="Choose vendor">
                <mat-option *ngFor="let v of vendors" [value]="v.id">
                  <strong>{{ v.vendorName }}</strong> <span *ngIf="v.phone">({{ v.phone }})</span>
                </mat-option>
              </mat-select>
              <mat-icon matPrefix class="prefix-icon">storefront</mat-icon>
              <mat-error *ngIf="form.get('vendorId')?.hasError('required')">Vendor is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Return Date (Debit Note Date)*</mat-label>
              <input matInput type="date" formControlName="returnDate" />
              <mat-icon matPrefix class="prefix-icon">calendar_today</mat-icon>
            </mat-form-field>

            <div class="add-row-action">
              <button mat-stroked-button color="primary" type="button" (click)="addItemRow()" class="erp-btn">
                <mat-icon>add</mat-icon>
                <span>Add Item Line</span>
              </button>
            </div>
          </div>

          <!-- Dynamic Item Lines -->
          <div formArrayName="items" class="items-form-array">
            <div
              *ngFor="let row of itemRows.controls; let i = index"
              [formGroupName]="i"
              class="item-line-box">

              <!-- 1. Form Controls: All in ONE horizontal line -->
              <div class="line-controls-row">
                <span class="line-index">#{{ i + 1 }}</span>

                <div class="item-select-wrap">
                  <mat-form-field appearance="outline" class="w-full" subscriptSizing="dynamic">
                    <mat-label>Item to Return*</mat-label>
                    <mat-select formControlName="itemId" (selectionChange)="onItemChange(i, $event.value)">
                      <mat-option *ngFor="let item of items" [value]="item.id">
                        {{ item.itemName }} ({{ item.itemCode }}) — Available: {{ item.currentStock }} {{ item.unitOfMeasurement }}
                      </mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>

                <mat-form-field appearance="outline" class="qty-field" subscriptSizing="dynamic">
                  <mat-label>Return Qty*</mat-label>
                  <input matInput type="number" min="1" formControlName="quantity" (input)="onQuantityChange(i)" />
                  <mat-error *ngIf="row.get('quantity')?.hasError('exceedsStock')">
                    Max: {{ getSelectedItem(i)?.currentStock }}
                  </mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" class="rate-field" subscriptSizing="dynamic">
                  <mat-label>Rate (₹)*</mat-label>
                  <input matInput type="number" min="0" formControlName="unitPrice" (input)="computeFormTotals()" />
                </mat-form-field>

                <div class="line-total-wrap">
                  <span class="lbl">TOTAL</span>
                  <span class="val">₹{{ ((row.get('quantity')?.value || 0) * (row.get('unitPrice')?.value || 0)) | number:'1.2-2' }}</span>
                </div>

                <mat-form-field appearance="outline" class="reason-field" subscriptSizing="dynamic">
                  <mat-label>Defect / Return Reason</mat-label>
                  <input matInput formControlName="reason" placeholder="e.g. Torn cover, Misprint, Wrong supply" />
                </mat-form-field>

                <button
                  mat-icon-button
                  type="button"
                  (click)="removeItemRow(i)"
                  [disabled]="itemRows.length === 1"
                  color="warn"
                  matTooltip="Remove line"
                  class="del-btn">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>

              <!-- 2. Stock Hint Meta Strip (Appears below without affecting controls row alignment!) -->
              <div class="line-meta-strip" *ngIf="getSelectedItem(i)">
                <span class="meta-pill-stock">
                  <mat-icon class="pill-icon">inventory_2</mat-icon>
                  Available in store: <strong>{{ getSelectedItem(i)?.currentStock }} {{ getSelectedItem(i)?.unitOfMeasurement }}</strong>
                </span>
                <span class="meta-pill-rack" *ngIf="getSelectedItem(i)?.rackOrLocation">
                  <mat-icon class="pill-icon">shelves</mat-icon>
                  Rack: <strong>{{ getSelectedItem(i)?.rackOrLocation }}</strong>
                </span>
              </div>
            </div>
          </div>

          <!-- Bottom Summary & Action -->
          <div class="form-bottom-row">
            <mat-form-field appearance="outline" class="remarks-field" subscriptSizing="dynamic">
              <mat-label>Remarks / Notes</mat-label>
              <textarea matInput formControlName="remarks" rows="2" placeholder="Enter any notes or reference..."></textarea>
            </mat-form-field>

            <div class="summary-box">
              <div class="sum-row">
                <span>Total Items:</span>
                <strong>{{ formItemCount }} Units</strong>
              </div>
              <div class="sum-row total">
                <span>Total Debit Note Amount:</span>
                <strong class="text-danger">₹{{ formGrandTotal | number:'1.2-2' }}</strong>
              </div>

              <div class="btn-group">
                <button mat-button type="button" (click)="toggleCreateForm()" [disabled]="submitting">
                  Cancel
                </button>
                <button
                  mat-flat-button
                  color="warn"
                  type="submit"
                  [disabled]="form.invalid || submitting || hasStockErrors() || formGrandTotal <= 0"
                  class="save-btn">
                  <mat-icon>assignment_return</mat-icon>
                  <span>{{ submitting ? 'Generating Debit Note...' : 'Confirm & Generate Debit Note' }}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </mat-card>

      <!-- 4. Filter & Search Controls Deck -->
      <mat-card class="filter-card mat-elevation-z1">
        <div class="filter-deck">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-input">
            <mat-label>Search Debit Note / Vendor / Items</mat-label>
            <input
              matInput
              [formControl]="filterSearchCtrl"
              placeholder="Search by DN number, vendor name, or remarks..." />
            <mat-icon matPrefix class="prefix-icon">search</mat-icon>
            <button
              mat-icon-button
              matSuffix
              *ngIf="filterSearchCtrl.value"
              (click)="filterSearchCtrl.setValue('')"
              matTooltip="Clear">
              <mat-icon>close</mat-icon>
            </button>
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="vendor-select">
            <mat-label>Filter by Vendor</mat-label>
            <mat-select [formControl]="filterVendorCtrl">
              <mat-option [value]="null">All Vendors</mat-option>
              <mat-option *ngFor="let v of vendors" [value]="v.id">{{ v.vendorName }}</mat-option>
            </mat-select>
            <mat-icon matPrefix class="prefix-icon">storefront</mat-icon>
          </mat-form-field>

          <div class="chip-total">
            <mat-chip-set>
              <mat-chip highlighted color="warn">
                {{ totalCount }} Debit Note(s)
              </mat-chip>
            </mat-chip-set>
          </div>
        </div>
      </mat-card>

      <!-- 5. Purchase Returns List Table -->
      <mat-card class="table-card mat-elevation-z1">
        <div class="table-responsive">
          <table class="erp-table" matSort (matSortChange)="onSortChange($event)">
            <thead>
              <tr>
                <th mat-sort-header="returndate" style="min-width: 140px;">DATE &amp; TIME (IST)</th>
                <th mat-sort-header="debitnote" style="min-width: 130px;">DEBIT NOTE #</th>
                <th mat-sort-header="vendor" style="min-width: 160px;">VENDOR / SUPPLIER</th>
                <th style="min-width: 220px;">ITEMS RETURNED</th>
                <th mat-sort-header="amount" style="min-width: 110px;" class="text-right">TOTAL AMOUNT</th>
                <th mat-sort-header="status" style="min-width: 130px;">STATUS</th>
                <th style="min-width: 140px;">REMARKS</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let ret of returnsList" class="data-row">
                <td class="cell-date">
                  <span [appIstDatetime]="ret.returnDate"></span>
                </td>
                <td class="cell-code">
                  <span class="dn-code">{{ ret.debitNoteNumber || ret.returnNumber }}</span>
                </td>
                <td class="cell-vendor">
                  <strong>{{ ret.vendorName }}</strong>
                </td>
                <td class="cell-items">
                  <div class="item-tag-list">
                    <span *ngFor="let it of ret.items" class="item-pill">
                      {{ it.itemName }} ({{ it.itemCode }}) × <strong>{{ it.quantity }}</strong>
                      <span *ngIf="it.reason" class="reason-tag">({{ it.reason }})</span>
                    </span>
                  </div>
                </td>
                <td class="cell-amount text-right">
                  <strong class="text-danger">₹{{ (ret.totalAmount || 0) | number:'1.2-2' }}</strong>
                </td>
                <td>
                  <span class="badge-status-adjusted">Adjusted in Ledger</span>
                </td>
                <td class="cell-remarks">
                  <span class="remarks-text" [matTooltip]="ret.remarks || ''">{{ ret.remarks || '-' }}</span>
                </td>
              </tr>

              <tr *ngIf="returnsList.length === 0 && !loading">
                <td colspan="7" class="empty-state">
                  <mat-icon class="empty-icon">assignment_return</mat-icon>
                  <p class="empty-title">No Purchase Returns Recorded</p>
                  <p class="empty-sub">Click 'New Purchase Return (PR)' above to record a return to vendor with debit note generation.</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <mat-paginator
          [length]="totalCount"
          [pageSize]="pageSize"
          [pageIndex]="pageIndex"
          [pageSizeOptions]="[10, 25, 50, 100]"
          (page)="onPageChange($event)"
          showFirstLastButtons
          class="erp-paginator">
        </mat-paginator>
      </mat-card>
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
    .page-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }

    .module-nav-bar {
      display: flex;
      gap: 8px;
      background: #f1f5f9;
      padding: 6px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      overflow-x: auto;
      flex-wrap: nowrap;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      &::-webkit-scrollbar {
        display: none;
      }
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
      white-space: nowrap;
      flex-shrink: 0;
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
      background: #e11d48;
      color: #ffffff;
      border-radius: 12px;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(225, 29, 72, 0.25);
      flex-shrink: 0;
      mat-icon { font-size: 26px; width: 26px; height: 26px; }
    }
    .page-title {
      font-size: 1.45rem;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      letter-spacing: -0.02em;
    }
    .page-subtitle {
      font-size: 0.85rem;
      color: #64748b;
      margin: 3px 0 0;
      line-height: 1.4;
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
      font-weight: 700;
      border-radius: 8px;
      height: 40px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .refresh-btn {
      color: #64748b;
      background: #f1f5f9;
      &:hover { color: #0f172a; background: #e2e8f0; }
    }
    .global-loader { margin: -10px 0 0; border-radius: 4px; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    .kpi-card {
      border-radius: 12px;
      padding: 16px;
      background: #ffffff;
      border: 1px solid #f1f5f9;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
    }
    .kpi-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .kpi-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .kpi-label {
      font-size: 0.78rem;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .kpi-value {
      font-size: 1.55rem;
      font-weight: 800;
      color: #0f172a;
    }
    .kpi-meta { font-size: 0.75rem; }
    .kpi-icon-wrap {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      &.bg-rose { background: #ffe4e6; color: #e11d48; }
      &.bg-red { background: #fee2e2; color: #dc2626; }
      &.bg-blue { background: #eff6ff; color: #2563eb; }
      &.bg-amber { background: #fef3c7; color: #d97706; }
      mat-icon { font-size: 24px; width: 24px; height: 24px; }
    }
    .text-danger { color: #dc2626 !important; }
    .text-primary { color: #2563eb !important; }
    .text-amber { color: #d97706 !important; }
    .create-form-card {
      border: 2px solid #fda4af;
      border-radius: 14px;
      background: #ffffff;
      overflow: hidden;
      padding: 0;
    }
    .form-header {
      background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
      border-bottom: 1px solid #fecdd3;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .f-title-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .f-icon {
      color: #e11d48;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }
    .f-title {
      margin: 0;
      color: #9f1239;
      font-size: 1.15rem;
      font-weight: 800;
    }
    .f-sub {
      margin: 2px 0 0;
      color: #be123c;
      font-size: 0.8rem;
    }
    .f-close-btn { color: #9f1239; }
    .return-form {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .form-top-row {
      display: grid;
      grid-template-columns: 1.6fr 1.2fr auto;
      gap: 14px;
      align-items: center;
    }
    .add-row-action { display: flex; align-items: center; }
    .items-form-array {
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px;
    }
    .item-line-box {
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .line-controls-row {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
    }
    .line-index {
      font-size: 0.75rem;
      font-weight: 700;
      color: #64748b;
      background: #f1f5f9;
      padding: 4px 8px;
      border-radius: 4px;
      flex-shrink: 0;
    }
    .item-select-wrap {
      flex: 3;
      min-width: 220px;
    }
    .w-full { width: 100%; }
    .qty-field { width: 100px; flex-shrink: 0; }
    .rate-field { width: 105px; flex-shrink: 0; }
    .line-total-wrap {
      width: 95px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      .lbl { font-size: 0.65rem; color: #64748b; font-weight: 700; }
      .val { font-size: 0.95rem; font-weight: 800; color: #e11d48; }
    }
    .reason-field { flex: 2; min-width: 140px; }
    .del-btn {
      color: #94a3b8;
      flex-shrink: 0;
      &:hover { color: #dc2626; }
    }

    .line-meta-strip {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-left: 36px;
      margin-top: 2px;
      flex-wrap: wrap;
    }

    .meta-pill-stock, .meta-pill-rack {
      font-size: 0.75rem;
      color: #475569;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      padding: 2px 8px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      gap: 4px;

      .pill-icon {
        font-size: 13px;
        width: 13px;
        height: 13px;
        color: #059669;
      }

      strong {
        color: #0f172a;
      }
    }

    .meta-pill-stock strong {
      color: #059669;
    }
    .form-bottom-row {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 16px;
      align-items: start;
    }
    .remarks-field { width: 100%; }
    .summary-box {
      background: #fff1f2;
      border: 1px solid #fecdd3;
      border-radius: 10px;
      padding: 14px 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .sum-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.95rem;
      color: #475569;
      &.total {
        font-size: 1.15rem;
        font-weight: 800;
        border-top: 1px dashed #fda4af;
        padding-top: 8px;
      }
    }
    .btn-group {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 6px;
    }
    .save-btn { font-weight: 700; }
    .filter-card {
      border-radius: 12px;
      padding: 12px 16px;
      background: #ffffff;
      border: 1px solid #f1f5f9;
    }
    .filter-deck {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }
    .search-input { flex: 2; min-width: 250px; }
    .vendor-select { flex: 1.2; min-width: 180px; }
    .chip-total { display: flex; align-items: center; }
    .prefix-icon { color: #3b82f6; margin-right: 6px; }
    .table-card {
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #f1f5f9;
      overflow: hidden;
      padding: 0;
    }
    .table-responsive {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      width: 100%;
    }
    .erp-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.88rem;
      thead th {
        background: #f8fafc;
        color: #475569;
        font-weight: 700;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        padding: 12px 16px;
        border-bottom: 1px solid #e2e8f0;
        white-space: nowrap;
      }
      tbody tr {
        border-bottom: 1px solid #f1f5f9;
        transition: background-color 0.15s ease;
        &:hover { background: #fdf2f4; }
      }
      tbody td {
        padding: 12px 16px;
        color: #1e293b;
        vertical-align: middle;
      }
    }
    .text-right { text-align: right; }
    .dn-code {
      font-family: monospace;
      font-size: 0.85rem;
      font-weight: 800;
      color: #be123c;
      background: #ffe4e6;
      padding: 3px 8px;
      border-radius: 6px;
    }
    .item-tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .item-pill {
      font-size: 0.78rem;
      background: #f1f5f9;
      color: #334155;
      padding: 3px 8px;
      border-radius: 4px;
      strong { color: #0f172a; }
      .reason-tag { color: #be123c; font-style: italic; }
    }
    .badge-status-adjusted {
      display: inline-flex;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
      text-transform: uppercase;
    }
    .remarks-text {
      font-size: 0.82rem;
      color: #64748b;
      max-width: 200px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }
    .empty-state {
      padding: 48px 16px;
      text-align: center;
      .empty-icon { font-size: 48px; width: 48px; height: 48px; color: #cbd5e1; margin-bottom: 8px; }
      .empty-title { font-size: 1rem; font-weight: 700; color: #475569; margin: 0; }
      .empty-sub { font-size: 0.82rem; color: #94a3b8; margin: 4px 0 0; }
    }
    @media (max-width: 1024px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .form-top-row { grid-template-columns: 1fr; }
      .item-line-box { flex-wrap: wrap; }
      .form-bottom-row { grid-template-columns: 1fr; }
    }
    @media (max-width: 640px) {
      .module-nav-bar {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
        padding: 6px;
      }
      .nav-tab {
        width: 100%;
        justify-content: center;
        font-size: 0.76rem;
        padding: 0 6px;
        height: 36px;
        gap: 4px;
        white-space: nowrap;
        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          margin-right: 2px;
        }
      }
      .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .kpi-card { padding: 10px 10px; }
      .kpi-label { font-size: 0.65rem; }
      .kpi-value { font-size: 1.15rem; }
      .kpi-icon-wrap { width: 30px; height: 30px; mat-icon { font-size: 18px; width: 18px; height: 18px; } }

      .filter-card {
        padding: 10px 12px;
      }
      .filter-deck {
        display: flex;
        flex-direction: column;
        gap: 10px;
        align-items: stretch;
      }
      .search-input, .vendor-select {
        width: 100%;
        min-width: 100%;
        margin-bottom: 0;
      }
      .chip-total {
        display: flex;
        justify-content: flex-start;
      }
    }
  `]
})
export class PurchaseReturnsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly inventoryService = inject(InventoryService);
  private readonly authService = inject(AuthService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  loading = false;
  submitting = false;
  showCreateForm = false;

  returnsList: InventoryPurchaseReturn[] = [];
  vendors: InventoryVendor[] = [];
  items: InventoryItem[] = [];

  form!: FormGroup;
  formGrandTotal = 0;
  formItemCount = 0;

  filterSearchCtrl = this.fb.control('');
  filterVendorCtrl = this.fb.control<string | null>(null);

  pageIndex = 0;
  pageSize = 10;
  totalCount = 0;
  sortBy = 'returndate';
  sortDescending = true;

  get itemRows(): FormArray {
    return this.form.get('items') as FormArray;
  }

  get totalReturnValue(): number {
    return this.returnsList.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  }

  get totalItemsReturned(): number {
    return this.returnsList.reduce((sum, r) => sum + (r.items ? r.items.reduce((s, it) => s + (it.quantity || 0), 0) : 0), 0);
  }

  ngOnInit(): void {
    this.initForm();
    this.loadAllData();

    this.filterSearchCtrl.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged()
    ).subscribe(() => {
      this.pageIndex = 0;
      this.loadReturns();
    });

    this.filterVendorCtrl.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged()
    ).subscribe(() => {
      this.pageIndex = 0;
      this.loadReturns();
    });
  }

  initForm(): void {
    const today = new Date().toISOString().substring(0, 10);
    this.form = this.fb.group({
      vendorId: [null, [Validators.required]],
      returnDate: [today, [Validators.required]],
      remarks: [''],
      items: this.fb.array([])
    });

    this.addItemRow();
  }

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
    if (this.showCreateForm && this.itemRows.length === 0) {
      this.addItemRow();
    }
  }

  loadAllData(): void {
    const branchId = this.authService.selectedBranchId() || undefined;

    this.loadReturns();

    this.inventoryService.getVendors(branchId).subscribe({
      next: (vendors) => this.vendors = vendors || []
    });

    this.inventoryService.getItems({ branchId }).subscribe({
      next: (items) => this.items = items || []
    });
  }

  loadReturns(): void {
    this.loading = true;
    const branchId = this.authService.selectedBranchId() || undefined;

    this.inventoryService.getPurchaseReturnsPaged({
      vendorId: this.filterVendorCtrl.value || undefined,
      branchId,
      search: this.filterSearchCtrl.value?.trim() || undefined,
      pageNumber: this.pageIndex + 1,
      pageSize: this.pageSize,
      sortBy: this.sortBy,
      sortDescending: this.sortDescending
    }).subscribe({
      next: (res) => {
        this.returnsList = res.items || [];
        this.totalCount = res.totalCount || 0;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  onSortChange(sort: Sort): void {
    this.sortBy = sort.active;
    this.sortDescending = sort.direction === 'desc';
    this.pageIndex = 0;
    this.loadReturns();
  }

  onPageChange(e: PageEvent): void {
    this.pageIndex = e.pageIndex;
    this.pageSize = e.pageSize;
    this.loadReturns();
  }

  addItemRow(): void {
    const availableItem = this.items.find(i => i.currentStock > 0) || (this.items.length > 0 ? this.items[0] : null);
    const row = this.fb.group({
      itemId: [availableItem?.id || '', [Validators.required]],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitPrice: [availableItem?.purchasePrice || 0, [Validators.required, Validators.min(0)]],
      reason: ['']
    });
    this.itemRows.push(row);
    this.validateStock(this.itemRows.length - 1);
    this.computeFormTotals();
  }

  removeItemRow(index: number): void {
    if (this.itemRows.length > 1) {
      this.itemRows.removeAt(index);
      this.computeFormTotals();
    }
  }

  getSelectedItem(index: number): InventoryItem | undefined {
    const itemId = this.itemRows.at(index)?.get('itemId')?.value;
    return this.items.find(i => i.id === itemId);
  }

  onItemChange(index: number, itemId: string): void {
    const item = this.items.find(i => i.id === itemId);
    if (item) {
      const row = this.itemRows.at(index);
      row.patchValue({
        unitPrice: item.purchasePrice || 0,
        quantity: Math.min(1, Math.max(0, item.currentStock))
      });
      this.validateStock(index);
      this.computeFormTotals();
    }
  }

  onQuantityChange(index: number): void {
    this.validateStock(index);
    this.computeFormTotals();
  }

  validateStock(index: number): void {
    const row = this.itemRows.at(index);
    const item = this.getSelectedItem(index);
    const qty = Number(row.get('quantity')?.value) || 0;

    if (item && qty > item.currentStock) {
      row.get('quantity')?.setErrors({ exceedsStock: true });
    } else {
      const errs = row.get('quantity')?.errors;
      if (errs && errs['exceedsStock']) {
        delete errs['exceedsStock'];
        row.get('quantity')?.setErrors(Object.keys(errs).length ? errs : null);
      }
    }
  }

  hasStockErrors(): boolean {
    for (let i = 0; i < this.itemRows.length; i++) {
      if (this.itemRows.at(i).get('quantity')?.hasError('exceedsStock')) {
        return true;
      }
    }
    return false;
  }

  computeFormTotals(): void {
    let sum = 0;
    let qtySum = 0;
    for (const ctrl of this.itemRows.controls) {
      const q = Number(ctrl.get('quantity')?.value) || 0;
      const rate = Number(ctrl.get('unitPrice')?.value) || 0;
      sum += q * rate;
      qtySum += q;
    }
    this.formGrandTotal = sum;
    this.formItemCount = qtySum;
  }

  onSubmitReturn(): void {
    if (this.form.invalid || this.hasStockErrors() || this.formGrandTotal <= 0) return;

    this.submitting = true;
    const val = this.form.value;
    const branchId = this.authService.selectedBranchId() || undefined;

    const dto: CreatePurchaseReturnDto = {
      vendorId: val.vendorId,
      returnDate: val.returnDate,
      remarks: val.remarks,
      branchId,
      items: val.items.map((row: any) => ({
        itemId: row.itemId,
        quantity: Number(row.quantity),
        unitPrice: Number(row.unitPrice),
        reason: row.reason
      }))
    };

    this.inventoryService.createPurchaseReturn(dto).subscribe({
      next: (res) => {
        this.submitting = false;
        this.showCreateForm = false;
        this.initForm();
        this.loadAllData();
        this.confirmDialog.alert(
          'Debit Note Generated',
          `Debit Note #${res.debitNoteNumber} generated successfully. Live stock has been deducted and the vendor's ledger balance has been reduced.`,
          'success'
        );
      },
      error: (err) => {
        this.submitting = false;
        const msg = err?.error?.message || err?.error || 'Failed to record purchase return.';
        this.confirmDialog.alert(
          'Error Generating Debit Note',
          typeof msg === 'string' ? msg : 'An unexpected error occurred.',
          'danger'
        );
      }
    });
  }
}
