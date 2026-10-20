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
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';
import { InventoryService } from './inventory.service';
import { SchoolService, SchoolClassDto } from '../../core/services/school.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import {
  InventorySaleReturn,
  InventoryItem,
  StudentLookupItem,
  CreateSaleReturnDto
} from './inventory.models';

@Component({
  selector: 'app-sale-returns',
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
    MatAutocompleteModule,
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
              <mat-icon>keyboard_return</mat-icon>
            </span>
            <div>
              <h1 class="page-title">Kit &amp; Sale Returns (SR)</h1>
              <p class="page-subtitle">
                Receive returned student uniform, books, and study kits back into warehouse inventory with live stock replenishment and fee billing adjustments
              </p>
            </div>
          </div>
        </div>

        <div class="action-btn-group">
          <button
            mat-flat-button
            color="primary"
            (click)="toggleCreateForm()"
            class="erp-btn">
            <mat-icon>{{ showCreateForm ? 'close' : 'add' }}</mat-icon>
            <span>{{ showCreateForm ? 'Close Return Form' : 'New Kit Return (SR)' }}</span>
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
        <a mat-button [routerLink]="['/inventory/purchase-returns']" class="nav-tab">
          <mat-icon>assignment_return</mat-icon> Purchase Returns (PR)
        </a>
        <a mat-button [routerLink]="['/inventory/sale-returns']" class="nav-tab active-tab">
          <mat-icon>keyboard_return</mat-icon> Kit &amp; Sale Returns (SR)
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
              <span class="kpi-label">Total Kit Returns (SR)</span>
              <span class="kpi-value text-primary">{{ returnsList.length }}</span>
              <span class="kpi-meta text-muted">Returns logged</span>
            </div>
            <div class="kpi-icon-wrap bg-blue">
              <mat-icon>assignment_returned</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card mat-elevation-z1">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Total Restocked Value</span>
              <span class="kpi-value text-emerald">₹{{ totalReturnValue | number:'1.2-2' }}</span>
              <span class="kpi-meta text-muted">Kit value processed</span>
            </div>
            <div class="kpi-icon-wrap bg-emerald">
              <mat-icon>account_balance_wallet</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card mat-elevation-z1">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Units Restocked</span>
              <span class="kpi-value text-emerald">{{ totalItemsRestocked }}</span>
              <span class="kpi-meta text-muted">Items added back to store</span>
            </div>
            <div class="kpi-icon-wrap bg-emerald-light">
              <mat-icon>add_shopping_cart</mat-icon>
            </div>
          </div>
        </mat-card>

        <mat-card class="kpi-card mat-elevation-z1">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Total Units Returned</span>
              <span class="kpi-value text-indigo">{{ totalItemsReturned }}</span>
              <span class="kpi-meta text-muted">Items returned by students</span>
            </div>
            <div class="kpi-icon-wrap bg-indigo">
              <mat-icon>inventory</mat-icon>
            </div>
          </div>
        </mat-card>
      </div>

      <!-- 3. Embedded Kit Return Creation Form (No Popup Dialog!) -->
      <mat-card *ngIf="showCreateForm" class="create-form-card mat-elevation-z2">
        <div class="form-header">
          <div class="f-title-row">
            <mat-icon class="f-icon">keyboard_return</mat-icon>
            <div>
              <h2 class="f-title">Record Student Kit / Uniform Return</h2>
              <p class="f-sub">Items returned in good condition are automatically added back into live inventory.</p>
            </div>
          </div>
          <button mat-icon-button (click)="toggleCreateForm()" class="f-close-btn" matTooltip="Cancel & Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmitReturn()" class="return-form">
          <!-- Student Selector Section -->
          <div class="student-select-card">
            <div class="sec-title">
              <mat-icon>person</mat-icon>
              <span>Student / Recipient Selection</span>
            </div>

            <div class="picker-row">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Select Class</mat-label>
                <mat-select [formControl]="selectedClassCtrl" (selectionChange)="onClassChange($event.value)" placeholder="Choose Class">
                  <mat-option [value]="null">-- Select Class --</mat-option>
                  <mat-option *ngFor="let c of classesList" [value]="c.id">{{ c.name }}</mat-option>
                </mat-select>
                <mat-icon matPrefix class="prefix-icon">school</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Select Student</mat-label>
                <mat-select
                  [formControl]="selectedClassStudentCtrl"
                  (selectionChange)="onClassStudentChange($event.value)"
                  [disabled]="!selectedClassCtrl.value || loadingClassStudents"
                  placeholder="Choose Student">
                  <mat-option *ngFor="let s of classStudents" [value]="s">
                    Roll {{ s.rollNumber || '-' }} — {{ s.fullName }}
                  </mat-option>
                </mat-select>
                <mat-icon matPrefix class="prefix-icon">person</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-input">
                <mat-label>Quick Search Student (Name / Roll)</mat-label>
                <input
                  matInput
                  placeholder="Type student name..."
                  [formControl]="studentSearchCtrl"
                  [matAutocomplete]="studentAuto" />
                <mat-icon matPrefix class="prefix-icon">search</mat-icon>
                <mat-autocomplete #studentAuto="matAutocomplete" (optionSelected)="onStudentSelectedFromSearch($event.option.value)">
                  <mat-option *ngFor="let s of studentSearchResults" [value]="s">
                    <strong>{{ s.fullName }}</strong> | Roll: {{ s.rollNumber }} | Class: {{ s.className || 'N/A' }}
                  </mat-option>
                </mat-autocomplete>
              </mat-form-field>
            </div>

            <div class="meta-row">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Returned By Name*</mat-label>
                <input matInput formControlName="returnedByName" placeholder="Student or Person Name" />
                <mat-icon matPrefix class="prefix-icon">badge</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Class / Department</mat-label>
                <input matInput formControlName="departmentOrClass" placeholder="e.g. Class 10th A" />
                <mat-icon matPrefix class="prefix-icon">meeting_room</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Return Date*</mat-label>
                <input matInput type="date" formControlName="returnDate" />
                <mat-icon matPrefix class="prefix-icon">calendar_today</mat-icon>
              </mat-form-field>
            </div>
          </div>

          <!-- Items Table -->
          <div class="items-card">
            <div class="items-header-bar">
              <div class="bar-title">
                <mat-icon>undo</mat-icon>
                <span>Items Being Returned</span>
              </div>
              <button mat-stroked-button color="primary" type="button" (click)="addItemRow()" class="erp-btn">
                <mat-icon>add</mat-icon>
                <span>Add Item Line</span>
              </button>
            </div>

            <div formArrayName="items" class="items-list">
              <div
                *ngFor="let row of itemRows.controls; let i = index"
                [formGroupName]="i"
                class="item-line-box">
                <span class="line-index">#{{ i + 1 }}</span>

                <div class="item-select-wrap">
                  <mat-form-field appearance="outline" class="w-full" subscriptSizing="dynamic">
                    <mat-label>Returned Item*</mat-label>
                    <mat-select formControlName="itemId" (selectionChange)="onItemChange(i, $event.value)">
                      <mat-option *ngFor="let item of items" [value]="item.id">
                        {{ item.itemName }} ({{ item.itemCode }})
                      </mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>

                <mat-form-field appearance="outline" class="qty-field" subscriptSizing="dynamic">
                  <mat-label>Qty*</mat-label>
                  <input matInput type="number" min="1" formControlName="quantity" (input)="computeFormTotals()" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="rate-field" subscriptSizing="dynamic">
                  <mat-label>Rate / MRP (₹)*</mat-label>
                  <input matInput type="number" min="0" formControlName="unitPrice" (input)="computeFormTotals()" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="cond-field" subscriptSizing="dynamic">
                  <mat-label>Condition (Restock?)*</mat-label>
                  <mat-select formControlName="condition">
                    <mat-option value="Good/Resellable">
                      <span class="text-emerald">Good (Restock In Store)</span>
                    </mat-option>
                    <mat-option value="Damaged">
                      <span class="text-danger">Damaged (Do Not Restock)</span>
                    </mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="reason-field" subscriptSizing="dynamic">
                  <mat-label>Return Reason</mat-label>
                  <input matInput formControlName="reason" placeholder="e.g. Size exchange, TC taken" />
                </mat-form-field>

                <button
                  mat-icon-button
                  type="button"
                  (click)="removeItemRow(i)"
                  [disabled]="itemRows.length === 1"
                  color="warn"
                  matTooltip="Remove item"
                  class="del-btn">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>
            </div>
          </div>

          <!-- Bottom Summary & Refund Treatment -->
          <div class="form-bottom-row">
            <div class="treatment-box">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w-full">
                <mat-label>Refund / Financial Treatment*</mat-label>
                <mat-select formControlName="refundStatus">
                  <mat-option value="NoRefund">No Refund (Standard Free Kit Return)</mat-option>
                  <mat-option value="RefundedCash">Refunded in Cash to Student</mat-option>
                  <mat-option value="AdjustedInFees">Credit / Adjust in Student Fee Ledger</mat-option>
                </mat-select>
                <mat-icon matPrefix class="prefix-icon">payments</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w-full">
                <mat-label>Return Remarks / Notes</mat-label>
                <textarea matInput formControlName="remarks" rows="2" placeholder="Enter remarks..."></textarea>
              </mat-form-field>
            </div>

            <div class="summary-box">
              <div class="sum-row">
                <span>Total Items:</span>
                <strong>{{ formItemCount }} Pcs</strong>
              </div>
              <div class="sum-row total">
                <span>Total Return Value:</span>
                <strong class="text-emerald">₹{{ formGrandTotal | number:'1.2-2' }}</strong>
              </div>

              <div class="btn-group">
                <button mat-button type="button" (click)="toggleCreateForm()" [disabled]="submitting">
                  Cancel
                </button>
                <button
                  mat-flat-button
                  color="primary"
                  type="submit"
                  [disabled]="form.invalid || submitting || formGrandTotal <= 0"
                  class="save-btn">
                  <mat-icon>keyboard_return</mat-icon>
                  <span>{{ submitting ? 'Processing Return...' : 'Confirm Kit Return & Restock' }}</span>
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
            <mat-label>Search Return # / Student / Class / Remarks</mat-label>
            <input
              matInput
              [formControl]="filterSearchCtrl"
              placeholder="Type return number, student name, or class..." />
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

          <div class="chip-total">
            <mat-chip-set>
              <mat-chip highlighted color="primary">
                {{ totalCount }} Return(s) Logged
              </mat-chip>
            </mat-chip-set>
          </div>
        </div>
      </mat-card>

      <!-- 5. Sale Returns List Table -->
      <mat-card class="table-card mat-elevation-z1">
        <div class="table-responsive">
          <table class="erp-table" matSort (matSortChange)="onSortChange($event)">
            <thead>
              <tr>
                <th mat-sort-header="returndate" style="min-width: 140px;">DATE &amp; TIME (IST)</th>
                <th mat-sort-header="returnnumber" style="min-width: 120px;">RETURN #</th>
                <th mat-sort-header="name" style="min-width: 160px;">RETURNED BY</th>
                <th mat-sort-header="class" style="min-width: 120px;">CLASS / DEPT</th>
                <th style="min-width: 220px;">ITEMS RETURNED</th>
                <th mat-sort-header="amount" style="min-width: 110px;" class="text-right">TOTAL VALUE</th>
                <th mat-sort-header="status" style="min-width: 130px;">TREATMENT</th>
                <th style="min-width: 140px;">REMARKS</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let ret of returnsList" class="data-row">
                <td class="cell-date">
                  <span [appIstDatetime]="ret.returnDate"></span>
                </td>
                <td class="cell-code">
                  <span class="sr-code">{{ ret.returnNumber }}</span>
                </td>
                <td class="cell-name">
                  <strong>{{ ret.returnedByName }}</strong>
                </td>
                <td class="cell-dept">
                  {{ ret.departmentOrClass || '-' }}
                </td>
                <td class="cell-items">
                  <div class="item-tag-list">
                    <span *ngFor="let it of ret.items" class="item-pill" [class.damaged-pill]="it.condition === 'Damaged'">
                      {{ it.itemName }} × <strong>{{ it.quantity }}</strong>
                      <span class="cond-tag">[{{ it.condition }}]</span>
                    </span>
                  </div>
                </td>
                <td class="cell-amount text-right">
                  <strong class="text-emerald">₹{{ (ret.totalAmount || 0) | number:'1.2-2' }}</strong>
                </td>
                <td>
                  <span class="badge-status" [ngClass]="getRefundBadgeClass(ret.refundStatus)">
                    {{ ret.refundStatus }}
                  </span>
                </td>
                <td class="cell-remarks">
                  <span class="remarks-text" [matTooltip]="ret.remarks || ''">{{ ret.remarks || '-' }}</span>
                </td>
              </tr>

              <tr *ngIf="returnsList.length === 0 && !loading">
                <td colspan="8" class="empty-state">
                  <mat-icon class="empty-icon">keyboard_return</mat-icon>
                  <p class="empty-title">No Kit Returns Recorded</p>
                  <p class="empty-sub">Click 'New Kit Return (SR)' above to record a returned uniform, books, or kit.</p>
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
      background: #0284c7;
      color: #ffffff;
      border-radius: 12px;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(2, 132, 199, 0.25);
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
      &.bg-blue { background: #eff6ff; color: #2563eb; }
      &.bg-emerald { background: #ecfdf5; color: #059669; }
      &.bg-emerald-light { background: #f0fdf4; color: #16a34a; }
      &.bg-indigo { background: #eef2ff; color: #4f46e5; }
      mat-icon { font-size: 24px; width: 24px; height: 24px; }
    }
    .text-emerald { color: #059669 !important; }
    .text-primary { color: #2563eb !important; }
    .text-indigo { color: #4f46e5 !important; }
    .text-danger { color: #dc2626 !important; }
    .create-form-card {
      border: 2px solid #93c5fd;
      border-radius: 14px;
      background: #ffffff;
      overflow: hidden;
      padding: 0;
    }
    .form-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .f-title-row { display: flex; align-items: center; gap: 12px; }
    .f-icon { color: #2563eb; font-size: 28px; width: 28px; height: 28px; }
    .f-title { margin: 0; color: #1e3a8a; font-size: 1.15rem; font-weight: 800; }
    .f-sub { margin: 2px 0 0; color: #3b82f6; font-size: 0.8rem; }
    .f-close-btn { color: #1e3a8a; }
    .return-form {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .student-select-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .sec-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      color: #1e293b;
      font-size: 0.92rem;
      mat-icon { color: #2563eb; font-size: 18px; width: 18px; height: 18px; }
    }
    .picker-row {
      display: grid;
      grid-template-columns: 1fr 1.3fr 1.6fr;
      gap: 12px;
    }
    .meta-row {
      display: grid;
      grid-template-columns: 1.4fr 1.2fr 1fr;
      gap: 12px;
    }
    .items-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .items-header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px dashed #cbd5e1;
      padding-bottom: 8px;
    }
    .bar-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      color: #1e293b;
      font-size: 0.92rem;
      mat-icon { color: #059669; font-size: 20px; width: 20px; height: 20px; }
    }
    .items-list { display: flex; flex-direction: column; gap: 10px; }
    .item-line-box {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .line-index {
      font-size: 0.75rem;
      font-weight: 700;
      color: #64748b;
      background: #f1f5f9;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .item-select-wrap { flex: 3; min-width: 200px; }
    .w-full { width: 100%; }
    .qty-field { width: 85px; }
    .rate-field { width: 105px; }
    .cond-field { width: 180px; }
    .reason-field { flex: 2; min-width: 140px; }
    .del-btn { color: #94a3b8; &:hover { color: #dc2626; } }
    .form-bottom-row {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 16px;
      align-items: start;
    }
    .treatment-box { display: flex; flex-direction: column; gap: 10px; }
    .summary-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
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
        border-top: 1px dashed #86efac;
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
        &:hover { background: #f0fdf4; }
      }
      tbody td {
        padding: 12px 16px;
        color: #1e293b;
        vertical-align: middle;
      }
    }
    .text-right { text-align: right; }
    .sr-code {
      font-family: monospace;
      font-size: 0.85rem;
      font-weight: 800;
      color: #0369a1;
      background: #e0f2fe;
      padding: 3px 8px;
      border-radius: 6px;
    }
    .item-tag-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .item-pill {
      font-size: 0.78rem;
      background: #f1f5f9;
      color: #334155;
      padding: 3px 8px;
      border-radius: 4px;
      strong { color: #0f172a; }
      .cond-tag { color: #059669; font-weight: 600; }
      &.damaged-pill {
        background: #fee2e2;
        color: #991b1b;
        .cond-tag { color: #dc2626; }
      }
    }
    .badge-status {
      display: inline-flex;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
      text-transform: uppercase;
      &.badge-no-refund { background: #f1f5f9; color: #475569; }
      &.badge-cash-refund { background: #fef3c7; color: #d97706; }
      &.badge-fee-credit { background: #ecfdf5; color: #047857; }
    }
    .remarks-text {
      font-size: 0.82rem;
      color: #64748b;
      max-width: 180px;
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
      .picker-row, .meta-row { grid-template-columns: 1fr; }
      .item-line-box { flex-wrap: wrap; }
      .form-bottom-row { grid-template-columns: 1fr; }
    }
    @media (max-width: 640px) {
      .kpi-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class SaleReturnsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly inventoryService = inject(InventoryService);
  private readonly schoolService = inject(SchoolService);
  private readonly authService = inject(AuthService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  loading = false;
  submitting = false;
  showCreateForm = false;

  returnsList: InventorySaleReturn[] = [];
  items: InventoryItem[] = [];

  classesList: SchoolClassDto[] = [];
  selectedClassCtrl = this.fb.control<string | null>(null);
  selectedClassStudentCtrl = this.fb.control<StudentLookupItem | null>(null);
  classStudents: StudentLookupItem[] = [];
  loadingClassStudents = false;

  studentSearchCtrl = this.fb.control('');
  studentSearchResults: StudentLookupItem[] = [];

  form!: FormGroup;
  formGrandTotal = 0;
  formItemCount = 0;

  filterSearchCtrl = this.fb.control('');

  get itemRows(): FormArray {
    return this.form.get('items') as FormArray;
  }

  get totalReturnValue(): number {
    return this.returnsList.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  }

  get totalItemsReturned(): number {
    return this.returnsList.reduce((sum, r) => sum + (r.items ? r.items.reduce((s, it) => s + (it.quantity || 0), 0) : 0), 0);
  }

  pageIndex = 0;
  pageSize = 10;
  totalCount = 0;
  sortBy = 'returndate';
  sortDescending = true;

  get totalItemsRestocked(): number {
    return this.returnsList.reduce((sum, r) => sum + (r.items ? r.items.filter(it => it.condition === 'Good/Resellable').reduce((s, it) => s + (it.quantity || 0), 0) : 0), 0);
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
  }

  initForm(): void {
    const today = new Date().toISOString().substring(0, 10);
    this.form = this.fb.group({
      studentId: [null],
      returnedByName: ['', [Validators.required]],
      departmentOrClass: [''],
      returnDate: [today, [Validators.required]],
      refundStatus: ['NoRefund', [Validators.required]],
      remarks: [''],
      items: this.fb.array([])
    });

    this.schoolService.getClasses(true).subscribe({
      next: (classes: SchoolClassDto[]) => this.classesList = classes || []
    });

    this.studentSearchCtrl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || typeof query !== 'string' || query.trim().length < 2) return of([]);
        return this.inventoryService.searchStudents(query, this.authService.selectedBranchId() || undefined, undefined);
      })
    ).subscribe({
      next: (results) => this.studentSearchResults = results || []
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

    this.inventoryService.getItems({ branchId }).subscribe({
      next: (items) => this.items = items || []
    });
  }

  loadReturns(): void {
    this.loading = true;
    const branchId = this.authService.selectedBranchId() || undefined;

    this.inventoryService.getSaleReturnsPaged({
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

  onClassChange(classId: string | null): void {
    this.selectedClassStudentCtrl.setValue(null);
    this.classStudents = [];
    if (!classId) return;

    this.loadingClassStudents = true;
    this.inventoryService.searchStudents(undefined, this.authService.selectedBranchId() || undefined, classId).subscribe({
      next: (students) => {
        this.classStudents = students || [];
        this.loadingClassStudents = false;
      },
      error: () => this.loadingClassStudents = false
    });
  }

  onClassStudentChange(student: StudentLookupItem | null): void {
    if (student) {
      this.form.patchValue({
        studentId: student.id,
        returnedByName: student.fullName,
        departmentOrClass: `Class ${student.className || ''} ${student.sectionName || ''}`.trim()
      });
    }
  }

  onStudentSelectedFromSearch(student: StudentLookupItem): void {
    if (student) {
      this.form.patchValue({
        studentId: student.id,
        returnedByName: student.fullName,
        departmentOrClass: `Class ${student.className || ''} ${student.sectionName || ''}`.trim()
      });
      this.studentSearchCtrl.setValue('', { emitEvent: false });
      this.studentSearchResults = [];
    }
  }

  addItemRow(): void {
    const defaultItem = this.items.length > 0 ? this.items[0] : null;
    const row = this.fb.group({
      itemId: [defaultItem?.id || '', [Validators.required]],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitPrice: [defaultItem?.sellingPrice || 0, [Validators.required, Validators.min(0)]],
      condition: ['Good/Resellable', [Validators.required]],
      reason: ['']
    });
    this.itemRows.push(row);
    this.computeFormTotals();
  }

  removeItemRow(index: number): void {
    if (this.itemRows.length > 1) {
      this.itemRows.removeAt(index);
      this.computeFormTotals();
    }
  }

  onItemChange(index: number, itemId: string): void {
    const item = this.items.find(i => i.id === itemId);
    if (item) {
      const row = this.itemRows.at(index);
      row.patchValue({
        unitPrice: item.sellingPrice || 0
      });
      this.computeFormTotals();
    }
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

  getRefundBadgeClass(status: string): string {
    if (status === 'RefundedCash') return 'badge-cash-refund';
    if (status === 'AdjustedInFees') return 'badge-fee-credit';
    return 'badge-no-refund';
  }

  onSubmitReturn(): void {
    if (this.form.invalid || this.formGrandTotal <= 0) return;

    this.submitting = true;
    const val = this.form.value;
    const branchId = this.authService.selectedBranchId() || undefined;

    const dto: CreateSaleReturnDto = {
      studentId: val.studentId,
      returnedByName: val.returnedByName,
      departmentOrClass: val.departmentOrClass,
      returnDate: val.returnDate,
      refundStatus: val.refundStatus,
      remarks: val.remarks,
      branchId,
      items: val.items.map((row: any) => ({
        itemId: row.itemId,
        quantity: Number(row.quantity),
        unitPrice: Number(row.unitPrice),
        condition: row.condition,
        reason: row.reason
      }))
    };

    this.inventoryService.createSaleReturn(dto).subscribe({
      next: (res) => {
        this.submitting = false;
        this.showCreateForm = false;
        this.initForm();
        this.loadAllData();
        this.confirmDialog.alert(
          'Kit Return Recorded',
          `Return #${res.returnNumber} processed successfully. Items in good condition have been added back to store inventory.`,
          'success'
        );
      },
      error: (err) => {
        this.submitting = false;
        const msg = err?.error?.message || err?.error || 'Failed to record kit return.';
        this.confirmDialog.alert(
          'Error Recording Kit Return',
          typeof msg === 'string' ? msg : 'An unexpected error occurred.',
          'danger'
        );
      }
    });
  }
}
