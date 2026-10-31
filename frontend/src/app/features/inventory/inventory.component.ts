import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AuthService, BranchInfo } from '../../core/services/auth.service';
import { BranchService } from '../../core/services/branch.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';
import { InventoryService } from './inventory.service';
import {
  InventoryDashboardStats,
  InventoryCategory,
  CreateUpdateCategoryDto,
  InventoryVendor,
  InventoryItem,
  InventoryInward,
  InventoryOutward,
  InventoryStockAdjustment,
  CreateUpdateItemDto,
  CreateUpdateVendorDto,
  CreateInwardDto,
  CreateOutwardDto,
  CreateStockAdjustmentDto,
  PagedResult
} from './inventory.models';
import { InventoryCategoryDialogComponent } from './dialogs/inventory-category-dialog.component';
import { InventoryItemDialogComponent } from './dialogs/inventory-item-dialog.component';
import { InventoryVendorDialogComponent } from './dialogs/inventory-vendor-dialog.component';
import { InventoryInwardDialogComponent } from './dialogs/inventory-inward-dialog.component';
import { InventoryOutwardDialogComponent } from './dialogs/inventory-outward-dialog.component';
import { InventoryAdjustDialogComponent } from './dialogs/inventory-adjust-dialog.component';
import { InventoryOutwardReceiptDialogComponent } from './dialogs/inventory-outward-receipt-dialog.component';
import { InventoryInwardReceiptDialogComponent } from './dialogs/inventory-inward-receipt-dialog.component';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTabsModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatDialogModule,
    MatSlideToggleModule,
    MatMenuModule,
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
              <mat-icon>inventory_2</mat-icon>
            </span>
            <div>
              <h1 class="page-title">Inventory & Stock Management</h1>
              <p class="page-subtitle">
                Centralized store operations, student kit & uniform distribution, stationery consumables, asset tracking & live stock audit
              </p>
            </div>
          </div>
        </div>
    
        <div class="action-btn-group">
          <button mat-stroked-button color="primary" (click)="openInwardDialog()" class="erp-btn">
            <mat-icon>add_shopping_cart</mat-icon>
            <span>Inward Stock (GRN)</span>
          </button>
          <button mat-stroked-button color="accent" (click)="openOutwardDialog()" class="erp-btn">
            <mat-icon>outbox</mat-icon>
            <span>Issue Stock / Kit Sale</span>
          </button>
          <button mat-stroked-button (click)="openCategoryDialog()" class="erp-btn" matTooltip="Create a new Inventory Classification / Category">
            <mat-icon>category</mat-icon>
            <span>Add Category</span>
          </button>
          <button mat-flat-button color="primary" (click)="openItemDialog()" class="erp-btn">
            <mat-icon>add</mat-icon>
            <span>Add Item</span>
          </button>
          <button mat-icon-button (click)="refreshAll()" matTooltip="Refresh All Data" class="refresh-btn">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
      </div>
    
      <!-- Module Sub-Nav Bar -->
      <div class="module-nav-bar">
        <a mat-button [routerLink]="['/inventory']" class="nav-tab active-tab">
          <mat-icon>inventory_2</mat-icon> Store &amp; Catalog
        </a>
        <a mat-button [routerLink]="['/inventory/purchase-returns']" class="nav-tab">
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
      @if (loading) {
        <mat-progress-bar mode="indeterminate" class="global-loader"></mat-progress-bar>
      }
    
      <!-- 2. KPI Metrics Deck -->
      <div class="kpi-grid">
        <!-- KPI 1: Total Items -->
        <mat-card class="kpi-card mat-elevation-z1">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Total Catalog Items</span>
              <span class="kpi-value">{{ dashboardStats?.totalItemsCount || items.length }}</span>
              <span class="kpi-meta text-muted">{{ categories.length }} Active Categories</span>
            </div>
            <div class="kpi-icon-wrap bg-blue">
              <mat-icon>category</mat-icon>
            </div>
          </div>
        </mat-card>
    
        <!-- KPI 2: Total Valuation -->
        <mat-card class="kpi-card mat-elevation-z1">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Total Stock Valuation</span>
              <span class="kpi-value text-primary">₹{{ (dashboardStats?.totalStockValuation || totalComputedValuation) | number:'1.2-2' }}</span>
              <span class="kpi-meta text-muted">At Cost / Purchase Price</span>
            </div>
            <div class="kpi-icon-wrap bg-emerald">
              <mat-icon>account_balance_wallet</mat-icon>
            </div>
          </div>
        </mat-card>
    
        <!-- KPI 3: Low Stock Warning -->
        <mat-card class="kpi-card mat-elevation-z1" [class.alert-border]="(dashboardStats?.lowStockCount || lowStockCount) > 0">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Low Stock Alerts</span>
              <span class="kpi-value text-amber">{{ dashboardStats?.lowStockCount || lowStockCount }}</span>
              <span class="kpi-meta text-amber">Below reorder threshold</span>
            </div>
            <div class="kpi-icon-wrap bg-amber">
              <mat-icon>warning_amber</mat-icon>
            </div>
          </div>
        </mat-card>
    
        <!-- KPI 4: Monthly Inward Purchases -->
        <mat-card class="kpi-card mat-elevation-z1">
          <div class="kpi-content">
            <div class="kpi-info">
              <span class="kpi-label">Inward Purchases (This Month)</span>
              <span class="kpi-value text-indigo">₹{{ (dashboardStats?.inwardsAmountThisMonth || 0) | number:'1.2-2' }}</span>
              <span class="kpi-meta text-muted">{{ dashboardStats?.inwardCountThisMonth || 0 }} GRN Bills Received</span>
            </div>
            <div class="kpi-icon-wrap bg-indigo">
              <mat-icon>shopping_bag</mat-icon>
            </div>
          </div>
        </mat-card>
      </div>
    
      <!-- 3. Reactive Forms Filter Deck -->
      <mat-card class="filter-card mat-elevation-z1">
        <form [formGroup]="filterForm" class="filter-form-layout">
          <!-- Branch Selector -->
          <mat-form-field appearance="outline" class="filter-field branch-field">
            <mat-label>Campus / Branch</mat-label>
            <mat-select formControlName="branchId">
              <mat-option [value]="null">All Campuses Consolidated</mat-option>
              @for (b of branches; track b) {
                <mat-option [value]="b.id">{{ b.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
    
          <!-- Search Term -->
          <mat-form-field appearance="outline" class="filter-field search-field">
            <mat-label>Search Items / SKU / Rack</mat-label>
            <input matInput formControlName="searchTerm" placeholder="Search by name, SKU, or rack..." />
            @if (filterForm.get('searchTerm')?.value) {
              <button mat-icon-button matSuffix (click)="clearSearch()" type="button">
                <mat-icon>close</mat-icon>
              </button>
            }
            @if (!filterForm.get('searchTerm')?.value) {
              <mat-icon matSuffix>search</mat-icon>
            }
          </mat-form-field>
    
          <!-- Category Filter -->
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Category</mat-label>
            <mat-select formControlName="categoryId">
              <mat-option [value]="null">All Categories</mat-option>
              @for (cat of categories; track cat) {
                <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
    
          <!-- Item Type Filter -->
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Item Classification</mat-label>
            <mat-select formControlName="itemType">
              <mat-option value="All">All Classifications</mat-option>
              <mat-option value="Consumable">Consumables (Pens, Pencils, Paper)</mat-option>
              <mat-option value="Kit/Sellable">Kit / Sellable (Uniforms, Books)</mat-option>
              <mat-option value="Asset">Fixed Assets (PCs, Labs, Benches)</mat-option>
            </mat-select>
          </mat-form-field>
    
          <!-- Low Stock Toggle -->
          <div class="toggle-wrap">
            <mat-slide-toggle formControlName="lowStockOnly" color="warn">
              <span class="toggle-label">Low Stock Only</span>
            </mat-slide-toggle>
          </div>
        </form>
      </mat-card>
    
      <!-- 4. Pure Angular Material Tabs Structure -->
      <mat-card class="content-tabs-card mat-elevation-z1">
        <mat-tab-group [(selectedIndex)]="activeTabIndex" (selectedIndexChange)="onTabChange($event)" animationDuration="200ms" class="erp-tab-group">
          <!-- TAB 1: Items Catalog & Stock -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">view_list</mat-icon>
              <span>Items Catalog ({{ itemsTotalCount }})</span>
            </ng-template>
    
            <div class="tab-body">
              <div class="table-responsive">
                <table class="erp-table" matSort (matSortChange)="onItemsSortChange($event)">
                  <thead>
                    <tr>
                      <th mat-sort-header="itemCode">Item Code / SKU</th>
                      <th mat-sort-header="itemName">Item Name &amp; Specifications</th>
                      <th mat-sort-header="categoryName">Category</th>
                      <th mat-sort-header="itemType">Classification</th>
                      <th mat-sort-header="unitOfMeasurement">UOM</th>
                      <th mat-sort-header="currentStock">Current Stock</th>
                      <th mat-sort-header="purchasePrice">Purchase Rate</th>
                      <th mat-sort-header="sellingPrice">Selling / Kit MRP</th>
                      <th mat-sort-header="minStockAlertLevel">Alert Level</th>
                      <th mat-sort-header="rackOrLocation">Rack Location</th>
                      <th class="text-right action-th">
                        <span class="action-header-wrap" matTooltip="Row Actions">
                          <mat-icon class="th-action-icon">settings</mat-icon>
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (itm of items; track itm) {
                      <tr [class.low-stock-row]="itm.currentStock <= itm.minStockAlertLevel">
                        <!-- Code -->
                        <td>
                          <span class="code-pill">{{ itm.itemCode }}</span>
                        </td>
                        <!-- Name -->
                        <td>
                          <div class="item-title-wrap">
                            <strong class="item-name">{{ itm.itemName }}</strong>
                            @if (itm.description) {
                              <span class="item-desc">{{ itm.description }}</span>
                            }
                          </div>
                        </td>
                        <!-- Category -->
                        <td>
                          <mat-chip class="category-chip">{{ itm.categoryName }}</mat-chip>
                        </td>
                        <!-- Classification -->
                        <td>
                          <span class="type-badge" [ngClass]="'type-' + itm.itemType.toLowerCase().replace('/', '-')">
                            {{ itm.itemType }}
                          </span>
                        </td>
                        <!-- UOM -->
                        <td>{{ itm.unitOfMeasurement }}</td>
                        <!-- Current Stock -->
                        <td>
                          <span class="stock-badge" [ngClass]="getStockStatusClass(itm)">
                            <strong>{{ itm.currentStock }}</strong> {{ itm.unitOfMeasurement }}
                          </span>
                        </td>
                        <!-- Purchase Price -->
                        <td>₹{{ itm.purchasePrice | number:'1.2-2' }}</td>
                        <!-- Selling Price -->
                        <td>
                          @if (itm.sellingPrice > 0) {
                            <span class="text-success font-semibold">
                              ₹{{ itm.sellingPrice | number:'1.2-2' }}
                            </span>
                          }
                          @if (itm.sellingPrice === 0) {
                            <span class="text-muted">—</span>
                          }
                        </td>
                        <!-- Min Alert -->
                        <td>
                          <span class="text-muted">{{ itm.minStockAlertLevel }} {{ itm.unitOfMeasurement }}</span>
                        </td>
                        <!-- Rack -->
                        <td>
                          @if (itm.rackOrLocation) {
                            <span class="rack-badge">
                              <mat-icon>shelves</mat-icon>
                              <span>{{ itm.rackOrLocation }}</span>
                            </span>
                          }
                          @if (!itm.rackOrLocation) {
                            <span class="text-muted">—</span>
                          }
                        </td>
                        <!-- Actions 3-Dots Menu -->
                        <td class="text-right action-cell">
                          <button mat-icon-button [matMenuTriggerFor]="itemMenu" class="action-menu-trigger" matTooltip="Item Actions">
                            <mat-icon>more_vert</mat-icon>
                          </button>
                          <mat-menu #itemMenu="matMenu" xPosition="before" class="erp-action-menu">
                            <button mat-menu-item (click)="openAdjustDialog(itm)">
                              <mat-icon class="text-amber">tune</mat-icon>
                              <span>Adjust / Reconcile Stock</span>
                            </button>
                            <button mat-menu-item (click)="openItemDialog(itm)">
                              <mat-icon class="text-primary">edit</mat-icon>
                              <span>Edit Item Details</span>
                            </button>
                            <button mat-menu-item (click)="deleteItem(itm)">
                              <mat-icon class="text-danger">delete_outline</mat-icon>
                              <span>Delete Item</span>
                            </button>
                          </mat-menu>
                        </td>
                      </tr>
                    }
    
                    @if (!loading && items.length === 0) {
                      <tr>
                        <td colspan="11" class="empty-cell">
                          <mat-icon class="empty-icon">inventory_2</mat-icon>
                          <p class="empty-text">No inventory items found matching your filters.</p>
                          <button mat-stroked-button color="primary" (click)="openItemDialog()">
                            <mat-icon>add</mat-icon>
                            <span>Add Your First Item</span>
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
    
              <mat-paginator
                [length]="itemsTotalCount"
                [pageSize]="itemsPageSize"
                [pageIndex]="itemsPageIndex"
                [pageSizeOptions]="[10, 25, 50, 100]"
                (page)="onItemsPageChange($event)"
                showFirstLastButtons
                class="erp-paginator">
              </mat-paginator>
            </div>
          </mat-tab>
    
          <!-- TAB 2: Stock Inward (Purchases / GRN) -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">add_shopping_cart</mat-icon>
              <span>Stock Inward / GRN ({{ inwardsTotalCount }})</span>
            </ng-template>
    
            <div class="tab-body">
              <div class="tab-toolbar">
                <div class="tab-search-box">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="tab-search-field">
                    <mat-icon matPrefix>search</mat-icon>
                    <input matInput [formControl]="inwardsSearchCtrl" placeholder="Search Inward #, invoice, supplier, items..." />
                    @if (inwardsSearchCtrl.value) {
                      <button mat-icon-button matSuffix (click)="inwardsSearchCtrl.setValue('')" type="button">
                        <mat-icon>close</mat-icon>
                      </button>
                    }
                  </mat-form-field>
                </div>
                <button mat-flat-button color="primary" (click)="openInwardDialog()">
                  <mat-icon>add</mat-icon>
                  <span>New Inward Entry</span>
                </button>
              </div>
    
              <div class="table-responsive">
                <table class="erp-table" matSort (matSortChange)="onInwardsSortChange($event)">
                  <thead>
                    <tr>
                      <th mat-sort-header="inwardNumber">Inward (GRN) #</th>
                      <th mat-sort-header="inwardDate">Inward Date (IST)</th>
                      <th mat-sort-header="invoiceBillNumber">Invoice / Bill #</th>
                      <th mat-sort-header="vendorName">Supplier / Vendor</th>
                      <th>Items Count</th>
                      <th>Items Received Preview</th>
                      <th mat-sort-header="netAmount">Net Bill Amount</th>
                      <th mat-sort-header="paymentStatus">Payment Status</th>
                      <th mat-sort-header="paymentMode">Payment Mode</th>
                      <th style="width: 80px; text-align: center;">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (inw of inwards; track inw) {
                      <tr>
                        <td><strong class="code-pill">{{ inw.inwardNumber }}</strong></td>
                        <td><span [appIstDatetime]="inw.inwardDate" format="date"></span></td>
                        <td>{{ inw.invoiceBillNumber || '—' }}</td>
                        <td><strong>{{ inw.vendorName }}</strong></td>
                        <td><mat-chip>{{ inw.items.length }} Item(s)</mat-chip></td>
                        <td>
                          <div class="lines-preview">
                            @for (line of inw.items.slice(0, 3); track line) {
                              <span class="line-chip">
                                {{ line.itemName }} ({{ line.quantity }})
                              </span>
                            }
                            @if (inw.items.length > 3) {
                              <span class="line-chip-more">
                                +{{ inw.items.length - 3 }} more
                              </span>
                            }
                          </div>
                        </td>
                        <td><strong class="text-primary">₹{{ inw.netAmount | number:'1.2-2' }}</strong></td>
                        <td>
                          <span class="status-chip" [ngClass]="'status-' + inw.paymentStatus.toLowerCase()">
                            {{ inw.paymentStatus }}
                          </span>
                        </td>
                        <td>{{ inw.paymentMode }}</td>
                        <td class="text-center action-cell">
                          <button mat-icon-button class="print-row-btn" (click)="printInwardSlip(inw)" matTooltip="Print / View GRN Receipt Slip" type="button">
                            <mat-icon>print</mat-icon>
                          </button>
                        </td>
                      </tr>
                    }
    
                    @if (!loading && inwards.length === 0) {
                      <tr>
                        <td colspan="10" class="empty-cell">
                          <mat-icon class="empty-icon">shopping_bag</mat-icon>
                          <p class="empty-text">No stock inward records found.</p>
                          <button mat-stroked-button color="primary" (click)="openInwardDialog()">Record First Stock Inward</button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
    
              <mat-paginator
                [length]="inwardsTotalCount"
                [pageSize]="inwardsPageSize"
                [pageIndex]="inwardsPageIndex"
                [pageSizeOptions]="[10, 25, 50, 100]"
                (page)="onInwardsPageChange($event)"
                showFirstLastButtons
                class="erp-paginator">
              </mat-paginator>
            </div>
          </mat-tab>
    
          <!-- TAB 3: Stock Outward & Distribution -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">outbox</mat-icon>
              <span>Outward & Kit Distribution ({{ outwardsTotalCount }})</span>
            </ng-template>
    
            <div class="tab-body">
              <div class="tab-toolbar">
                <div class="tab-search-box">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="tab-search-field">
                    <mat-icon matPrefix>search</mat-icon>
                    <input matInput [formControl]="outwardsSearchCtrl" placeholder="Search Issue #, recipient, class, remarks..." />
                    @if (outwardsSearchCtrl.value) {
                      <button mat-icon-button matSuffix (click)="outwardsSearchCtrl.setValue('')" type="button">
                        <mat-icon>close</mat-icon>
                      </button>
                    }
                  </mat-form-field>
                </div>
                <button mat-flat-button color="accent" (click)="openOutwardDialog()">
                  <mat-icon>add</mat-icon>
                  <span>Issue Stock / Kit</span>
                </button>
              </div>
    
              <div class="table-responsive">
                <table class="erp-table" matSort (matSortChange)="onOutwardsSortChange($event)">
                  <thead>
                    <tr>
                      <th mat-sort-header="issueNumber">Issue #</th>
                      <th mat-sort-header="issueDate">Date (IST)</th>
                      <th mat-sort-header="issueType">Distribution Mode</th>
                      <th mat-sort-header="issuedToName">Recipient Name</th>
                      <th mat-sort-header="departmentOrClass">Class / Dept</th>
                      <th>Items Distributed</th>
                      <th mat-sort-header="totalAmount">Total Value</th>
                      <th mat-sort-header="paymentStatus">Payment Status</th>
                      <th style="width: 100px; text-align: center;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (out of outwards; track out) {
                      <tr [class.row-cancelled]="out.paymentStatus === 'Cancelled'">
                        <td><strong class="code-pill">{{ out.issueNumber }}</strong></td>
                        <td><span [appIstDatetime]="out.issueDate" format="date"></span></td>
                        <td>
                          <span class="mode-badge" [ngClass]="out.issueType === 'StudentKitSale' ? 'mode-student' : 'mode-staff'">
                            {{ out.issueType === 'StudentKitSale' ? 'Student Kit Sale' : 'Staff / Dept Issue' }}
                          </span>
                        </td>
                        <td><strong>{{ out.issuedToName }}</strong></td>
                        <td>{{ out.departmentOrClass || '—' }}</td>
                        <td>
                          <div class="lines-preview">
                            @for (line of out.items.slice(0, 3); track line) {
                              <span class="line-chip">
                                {{ line.itemName }} ({{ line.quantity }})
                              </span>
                            }
                            @if (out.items.length > 3) {
                              <span class="line-chip-more">
                                +{{ out.items.length - 3 }} more
                              </span>
                            }
                          </div>
                        </td>
                        <td>
                          @if (out.totalAmount > 0) {
                            <strong class="text-success">₹{{ out.totalAmount | number:'1.2-2' }}</strong>
                          }
                          @if (out.totalAmount === 0) {
                            <span class="text-muted">Free Issue</span>
                          }
                        </td>
                        <td>
                          <span class="status-chip" [ngClass]="out.paymentStatus === 'Cancelled' ? 'status-cancelled' : ('status-' + (out.paymentStatus || '').toLowerCase().replace('/', '-'))">
                            @if (out.paymentStatus === 'Cancelled') {
                              <mat-icon class="cancel-icon-inline">undo</mat-icon>
                            }
                            {{ out.paymentStatus === 'Cancelled' ? 'Cancelled (Restored)' : (out.paymentStatus === 'AddedToFeeBill' ? 'Charged to Fee Card' : out.paymentStatus) }}
                          </span>
                        </td>
                        <td style="text-align: center;">
                          <div class="row-actions-group">
                            @if (out.paymentStatus !== 'Cancelled') {
                              <button mat-icon-button class="print-row-btn" (click)="printOutwardSlip(out)" matTooltip="Print Store Issue Slip / Bill" type="button">
                                <mat-icon>print</mat-icon>
                              </button>
                            }
                            @if (out.paymentStatus !== 'Cancelled') {
                              <button mat-icon-button color="warn" (click)="cancelOutward(out)" matTooltip="Cancel Issue & Return Stock to Inventory" type="button">
                                <mat-icon>undo</mat-icon>
                              </button>
                            }
                            @if (out.paymentStatus === 'Cancelled') {
                              <span class="text-muted" style="font-size: 11px; font-weight: 600;">Restored</span>
                            }
                          </div>
                        </td>
                      </tr>
                    }
    
                    @if (!loading && outwards.length === 0) {
                      <tr>
                        <td colspan="9" class="empty-cell">
                          <mat-icon class="empty-icon">outbox</mat-icon>
                          <p class="empty-text">No outward issues recorded yet.</p>
                          <button mat-stroked-button color="primary" (click)="openOutwardDialog()">Issue First Stock</button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
    
              <mat-paginator
                [length]="outwardsTotalCount"
                [pageSize]="outwardsPageSize"
                [pageIndex]="outwardsPageIndex"
                [pageSizeOptions]="[10, 25, 50, 100]"
                (page)="onOutwardsPageChange($event)"
                showFirstLastButtons
                class="erp-paginator">
              </mat-paginator>
            </div>
          </mat-tab>
    
          <!-- TAB 4: Vendors / Suppliers -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">storefront</mat-icon>
              <span>Vendors Directory ({{ vendorsTotalCount }})</span>
            </ng-template>
    
            <div class="tab-body">
              <div class="tab-toolbar">
                <div class="tab-search-box">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="tab-search-field">
                    <mat-icon matPrefix>search</mat-icon>
                    <input matInput [formControl]="vendorsSearchCtrl" placeholder="Search supplier, contact, GST, phone..." />
                    @if (vendorsSearchCtrl.value) {
                      <button mat-icon-button matSuffix (click)="vendorsSearchCtrl.setValue('')" type="button">
                        <mat-icon>close</mat-icon>
                      </button>
                    }
                  </mat-form-field>
                </div>
                <button mat-flat-button color="primary" (click)="openVendorDialog()">
                  <mat-icon>add_business</mat-icon>
                  <span>Add Vendor</span>
                </button>
              </div>
    
              <div class="table-responsive">
                <table class="erp-table" matSort (matSortChange)="onVendorsSortChange($event)">
                  <thead>
                    <tr>
                      <th mat-sort-header="vendorName">Vendor / Business Name</th>
                      <th mat-sort-header="contactPerson">Contact Person</th>
                      <th mat-sort-header="phone">Phone / Mobile</th>
                      <th mat-sort-header="email">Email</th>
                      <th mat-sort-header="gstin">GSTIN / PAN</th>
                      <th mat-sort-header="paymentTerms">Payment Terms</th>
                      <th>Address</th>
                      <th class="text-right action-th">
                        <span class="action-header-wrap" matTooltip="Row Actions">
                          <mat-icon class="th-action-icon">settings</mat-icon>
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (v of vendors; track v) {
                      <tr>
                        <td><strong>{{ v.vendorName }}</strong></td>
                        <td>{{ v.contactPerson || '—' }}</td>
                        <td>
                          @if (v.phone) {
                            <span class="phone-link">
                              <mat-icon class="inline-icon">phone</mat-icon> {{ v.phone }}
                            </span>
                          }
                          @if (!v.phone) {
                            <span class="text-muted">—</span>
                          }
                        </td>
                        <td>{{ v.email || '—' }}</td>
                        <td>
                          <div class="tax-info">
                            @if (v.gstin) {
                              <span class="tax-pill">GST: {{ v.gstin }}</span>
                            }
                            @if (v.pan) {
                              <span class="tax-pill">PAN: {{ v.pan }}</span>
                            }
                            @if (!v.gstin && !v.pan) {
                              <span class="text-muted">—</span>
                            }
                          </div>
                        </td>
                        <td>{{ v.paymentTerms || '—' }}</td>
                        <td><span class="address-text">{{ v.address || '—' }}</span></td>
                        <td class="text-right action-cell">
                          <button mat-icon-button [matMenuTriggerFor]="vendorMenu" class="action-menu-trigger" matTooltip="Vendor Actions">
                            <mat-icon>more_vert</mat-icon>
                          </button>
                          <mat-menu #vendorMenu="matMenu" xPosition="before" class="erp-action-menu">
                            <button mat-menu-item (click)="openVendorDialog(v)">
                              <mat-icon class="text-primary">edit</mat-icon>
                              <span>Edit Vendor</span>
                            </button>
                            <button mat-menu-item (click)="deleteVendor(v)">
                              <mat-icon class="text-danger">delete_outline</mat-icon>
                              <span>Delete Vendor</span>
                            </button>
                          </mat-menu>
                        </td>
                      </tr>
                    }
    
                    @if (!loading && vendors.length === 0) {
                      <tr>
                        <td colspan="8" class="empty-cell">
                          <mat-icon class="empty-icon">storefront</mat-icon>
                          <p class="empty-text">No registered suppliers yet.</p>
                          <button mat-stroked-button color="primary" (click)="openVendorDialog()">
                            <mat-icon>add_business</mat-icon>
                            <span>Add First Supplier</span>
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
    
              <mat-paginator
                [length]="vendorsTotalCount"
                [pageSize]="vendorsPageSize"
                [pageIndex]="vendorsPageIndex"
                [pageSizeOptions]="[10, 25, 50, 100]"
                (page)="onVendorsPageChange($event)"
                showFirstLastButtons
                class="erp-paginator">
              </mat-paginator>
            </div>
          </mat-tab>
    
          <!-- TAB 5: Categories Master -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">category</mat-icon>
              <span>Categories Master ({{ categories.length }})</span>
            </ng-template>
    
            <div class="tab-body">
              <div class="tab-toolbar">
                <span class="tab-info-text">Stock Categories Master: Classification for consumables, kits, uniforms, books & fixed assets</span>
                <button mat-flat-button color="primary" (click)="openCategoryDialog()">
                  <mat-icon>add</mat-icon>
                  <span>Add Category</span>
                </button>
              </div>
    
              <div class="table-responsive">
                <table class="erp-table">
                  <thead>
                    <tr>
                      <th>Category Code</th>
                      <th>Category Name</th>
                      <th>Description / Scope</th>
                      <th>Linked Items</th>
                      <th>Status</th>
                      <th class="text-right action-th">
                        <span class="action-header-wrap" matTooltip="Row Actions">
                          <mat-icon class="th-action-icon">settings</mat-icon>
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (cat of categories; track cat) {
                      <tr>
                        <td><strong class="code-pill">{{ cat.code }}</strong></td>
                        <td><strong>{{ cat.name }}</strong></td>
                        <td><span class="text-muted">{{ cat.description || '—' }}</span></td>
                        <td>
                          <mat-chip class="category-chip">{{ cat.activeItemsCount || 0 }} Item(s)</mat-chip>
                        </td>
                        <td>
                          <span class="status-chip" [ngClass]="cat.isActive ? 'status-paid' : 'status-free-complimentary'">
                            {{ cat.isActive ? 'Active' : 'Inactive' }}
                          </span>
                        </td>
                        <td class="text-right action-cell">
                          <button mat-icon-button [matMenuTriggerFor]="catMenu" class="action-menu-trigger" matTooltip="Category Actions">
                            <mat-icon>more_vert</mat-icon>
                          </button>
                          <mat-menu #catMenu="matMenu" xPosition="before" class="erp-action-menu">
                            <button mat-menu-item (click)="openCategoryDialog(cat)">
                              <mat-icon class="text-primary">edit</mat-icon>
                              <span>Edit Category</span>
                            </button>
                            <button mat-menu-item (click)="deleteCategory(cat)">
                              <mat-icon class="text-danger">delete_outline</mat-icon>
                              <span>Delete Category</span>
                            </button>
                          </mat-menu>
                        </td>
                      </tr>
                    }
    
                    @if (!loading && categories.length === 0) {
                      <tr>
                        <td colspan="6" class="empty-cell">
                          <mat-icon class="empty-icon">category</mat-icon>
                          <p class="empty-text">No inventory categories found.</p>
                          <button mat-stroked-button color="primary" (click)="openCategoryDialog()">
                            <mat-icon>add</mat-icon>
                            <span>Add First Category</span>
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </mat-tab>
    
          <!-- TAB 6: Low Stock & Reorder Alerts -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon text-amber">warning_amber</mat-icon>
              <span>Reorder Alerts ({{ getLowStockItems().length }})</span>
            </ng-template>
    
            <div class="tab-body">
              @if (getLowStockItems().length > 0) {
                <div class="alert-banner">
                  <mat-icon>notification_important</mat-icon>
                  <div class="alert-banner-text">
                    <strong>{{ getLowStockItems().length }} Item(s) Need Reordering!</strong>
                    <span>These items have reached or fallen below the minimum safety threshold. Please issue a purchase order to prevent shortage.</span>
                  </div>
                </div>
              }
    
              <div class="table-responsive">
                <table class="erp-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Item Name</th>
                      <th>Category</th>
                      <th>Classification</th>
                      <th>Current Stock</th>
                      <th>Reorder Level</th>
                      <th>Deficit / Shortage</th>
                      <th>Purchase Rate</th>
                      <th>Rack Location</th>
                      <th class="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (itm of getLowStockItems(); track itm) {
                      <tr>
                        <td><span class="code-pill">{{ itm.itemCode }}</span></td>
                        <td><strong>{{ itm.itemName }}</strong></td>
                        <td>{{ itm.categoryName }}</td>
                        <td>{{ itm.itemType }}</td>
                        <td>
                          <span class="stock-badge badge-low-stock">
                            {{ itm.currentStock }} {{ itm.unitOfMeasurement }}
                          </span>
                        </td>
                        <td>{{ itm.minStockAlertLevel }} {{ itm.unitOfMeasurement }}</td>
                        <td>
                          <strong class="text-danger">
                            -{{ itm.minStockAlertLevel - itm.currentStock > 0 ? (itm.minStockAlertLevel - itm.currentStock) : 0 }} {{ itm.unitOfMeasurement }}
                          </strong>
                        </td>
                        <td>₹{{ itm.purchasePrice | number:'1.2-2' }}</td>
                        <td>{{ itm.rackOrLocation || '—' }}</td>
                        <td class="text-right">
                          <button mat-stroked-button color="primary" (click)="reorderItem(itm)">
                            <mat-icon>add_shopping_cart</mat-icon>
                            <span>Reorder Now</span>
                          </button>
                        </td>
                      </tr>
                    }
    
                    @if (getLowStockItems().length === 0) {
                      <tr>
                        <td colspan="10" class="empty-cell">
                          <mat-icon class="empty-icon text-success">verified</mat-icon>
                          <p class="empty-text text-success">All items are well-stocked! No low stock reorder alerts at this time.</p>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </mat-tab>
    
          <!-- TAB 6: Stock Audit & Adjustments History -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">history</mat-icon>
              <span>Audit & Adjustments ({{ adjustments.length }})</span>
            </ng-template>
    
            <div class="tab-body">
              <div class="tab-toolbar">
                <span class="tab-info-text">Audit trails for physical count reconciliation, damages, and loss write-offs</span>
              </div>
    
              <div class="table-responsive">
                <table class="erp-table">
                  <thead>
                    <tr>
                      <th>Date & Time (IST)</th>
                      <th>Item Code</th>
                      <th>Item Name</th>
                      <th>Adjustment Type</th>
                      <th>Previous Stock</th>
                      <th>Adjusted Qty</th>
                      <th>New Resulting Stock</th>
                      <th>Reason / Audit Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (adj of adjustments; track adj) {
                      <tr>
                        <td><span [appIstDatetime]="adj.adjustedAt" format="datetime"></span></td>
                        <td><span class="code-pill">{{ adj.itemCode }}</span></td>
                        <td><strong>{{ adj.itemName }}</strong></td>
                        <td>
                          <span class="type-badge">{{ adj.adjustmentType }}</span>
                        </td>
                        <td>{{ adj.previousStock }}</td>
                        <td>
                          <strong [ngClass]="adj.adjustedQuantity >= 0 ? 'text-success' : 'text-danger'">
                            {{ adj.adjustedQuantity > 0 ? '+' : '' }}{{ adj.adjustedQuantity }}
                          </strong>
                        </td>
                        <td><strong>{{ adj.newStock }}</strong></td>
                        <td>{{ adj.reason || '—' }}</td>
                      </tr>
                    }
    
                    @if (!loading && adjustments.length === 0) {
                      <tr>
                        <td colspan="8" class="empty-cell">
                          <mat-icon class="empty-icon">tune</mat-icon>
                          <p class="empty-text">No audit stock adjustments recorded yet.</p>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>
      </mat-card>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
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
      flex-wrap: wrap;
      gap: 16px;
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
    .title-badge-row {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .icon-avatar {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff;
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
      mat-icon { font-size: 26px; width: 26px; height: 26px; }
    }
    .page-title {
      font-size: 1.45rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
      letter-spacing: -0.02em;
    }
    .page-subtitle {
      font-size: 0.86rem;
      color: #64748b;
      margin: 2px 0 0;
    }
    .action-btn-group {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .erp-btn {
      font-weight: 600;
      border-radius: 8px;
    }
    .refresh-btn {
      color: #64748b;
      &:hover { color: #1e293b; background: #f1f5f9; }
    }
    .global-loader {
      border-radius: 4px;
      margin: -10px 0;
    }

    /* KPI Deck - Compact & Sleek Height */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    .kpi-card {
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      padding: 10px 14px;
      transition: transform 0.2s, box-shadow 0.2s;
      &:hover { transform: translateY(-2px); box-shadow: 0 8px 12px -3px rgba(0,0,0,0.06); }
    }
    .alert-border {
      border-color: #fcd34d !important;
      background: #fffbeb !important;
    }
    .kpi-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .kpi-info {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
      flex: 1;
    }
    .kpi-label {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #64748b;
      line-height: 1.2;
    }
    .kpi-value {
      font-size: 1.35rem;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.15;
    }
    .kpi-meta {
      font-size: 0.72rem;
      line-height: 1.2;
    }
    .kpi-icon-wrap {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }
    .bg-blue { background: #eff6ff; color: #2563eb; }
    .bg-emerald { background: #ecfdf5; color: #059669; }
    .bg-amber { background: #fef3c7; color: #d97706; }
    .bg-indigo { background: #e0e7ff; color: #4f46e5; }

    /* Filter Deck */
    .filter-card {
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      padding: 16px 20px 4px;
      background: #ffffff;
    }
    .filter-form-layout {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }
    .filter-field {
      flex: 1;
      min-width: 170px;
      margin-bottom: -1.25em;
    }
    .search-field {
      flex: 2;
      min-width: 240px;
    }
    .branch-field {
      flex: 1.5;
      min-width: 200px;
    }
    .toggle-wrap {
      display: flex;
      align-items: center;
      padding-bottom: 12px;
      .toggle-label { font-size: 0.88rem; font-weight: 600; color: #334155; }
    }

    /* Tabs & Tables */
    .content-tabs-card {
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      padding: 0;
      overflow: hidden;
    }
    .tab-body {
      padding: 20px;
    }
    .tab-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 10px;
    }
    .tab-info-text {
      color: #64748b;
      font-size: 0.88rem;
      font-weight: 500;
    }
    .tab-search-box {
      flex: 1;
      min-width: 260px;
    }
    .tab-search-field {
      width: 100%;
      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }
    }
    .erp-paginator {
      border-top: 1px solid #e2e8f0;
      background: #fafafa;
    }
    .tab-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: 6px;
    }

    /* Alert Banner */
    .alert-banner {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      mat-icon { color: #d97706; font-size: 24px; width: 24px; height: 24px; }
      .alert-banner-text {
        display: flex;
        flex-direction: column;
        strong { color: #92400e; font-size: 0.92rem; }
        span { color: #b45309; font-size: 0.82rem; }
      }
    }

    /* Responsive Table Styles */
    .table-responsive {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .erp-table {
      width: 100%;
      border-collapse: collapse;
      white-space: nowrap;
      th {
        background: #f8fafc;
        color: #475569;
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 12px 16px;
        border-bottom: 1px solid #e2e8f0;
        text-align: left;
      }
      td {
        padding: 12px 16px;
        border-bottom: 1px solid #f1f5f9;
        color: #1e293b;
        font-size: 0.88rem;
      }
      tr:hover { background: #f8fafc; }
    }
    .low-stock-row {
      background: #fffdf5;
    }

    /* Badges & Chips */
    .code-pill {
      font-family: monospace;
      font-size: 0.8rem;
      font-weight: 700;
      background: #eff6ff;
      color: #1e40af;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid #bfdbfe;
    }
    .item-title-wrap {
      display: flex;
      flex-direction: column;
      .item-name { color: #0f172a; font-size: 0.92rem; }
      .item-desc { color: #64748b; font-size: 0.78rem; max-width: 280px; overflow: hidden; text-overflow: ellipsis; }
    }
    .category-chip {
      font-size: 0.75rem;
      min-height: 24px;
      padding: 0 8px;
    }
    .type-badge {
      font-size: 0.74rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      background: #f1f5f9;
      color: #334155;
    }
    .type-consumable { background: #ecfdf5; color: #047857; }
    .type-kit-sellable { background: #eff6ff; color: #1d4ed8; }
    .type-asset { background: #fdf4ff; color: #86198f; }

    .stock-badge {
      font-size: 0.88rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 6px;
    }
    .badge-in-stock { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
    .badge-low-stock { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
    .badge-out-stock { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }

    .rack-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.8rem;
      color: #475569;
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 4px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #64748b; }
    }
    .mode-badge {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
    }
    .mode-student { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .mode-staff { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }

    .status-chip {
      font-size: 0.74rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      text-transform: capitalize;
    }
    .status-paid { background: #dcfce7; color: #15803d; }
    .status-pending { background: #fef3c7; color: #b45309; }
    .status-free-complimentary { background: #f1f5f9; color: #475569; }
    .status-addedtofeebill { background: #e0e7ff; color: #4338ca; }
    .status-cancelled {
      background: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .cancel-icon-inline {
      font-size: 13px !important;
      width: 13px !important;
      height: 13px !important;
      line-height: 13px;
    }
    .row-cancelled {
      background: #fafafa !important;
      opacity: 0.85;
      td { color: #64748b; }
    }

    .row-actions-group {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2px;
    }
    .print-row-btn {
      color: #2563eb;
      &:hover { background: #eff6ff; }
    }

    .lines-preview {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
      max-width: 300px;
    }
    .line-chip {
      font-size: 0.74rem;
      background: #f1f5f9;
      color: #334155;
      padding: 1px 6px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }
    .line-chip-more {
      font-size: 0.72rem;
      color: #64748b;
      font-weight: 600;
    }
    .phone-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #2563eb;
      font-weight: 500;
    }
    .inline-icon { font-size: 15px; width: 15px; height: 15px; color: #64748b; }
    .tax-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .tax-pill {
      font-size: 0.72rem;
      background: #f1f5f9;
      color: #475569;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .address-text {
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: inline-block;
    }

    /* Actions */
    .action-th {
      width: 56px;
      text-align: right;
      padding-right: 16px !important;
      vertical-align: middle;
    }
    .action-header-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      color: #64748b;
      .th-action-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        line-height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
    .action-cell {
      white-space: nowrap;
      text-align: right;
      padding-right: 16px !important;
      vertical-align: middle;
    }
    .action-menu-trigger {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 34px !important;
      height: 34px !important;
      min-width: 34px !important;
      max-width: 34px !important;
      padding: 0 !important;
      margin: 0 !important;
      border-radius: 50% !important;
      color: #64748b;
      position: relative;
      overflow: hidden;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        background: #eff6ff !important;
        color: #1e40af !important;
        box-shadow: 0 2px 6px rgba(37, 99, 235, 0.16) !important;
      }

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        line-height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0;
      }

      ::ng-deep .mat-mdc-button-persistent-ripple,
      ::ng-deep .mat-mdc-button-ripple,
      ::ng-deep .mat-mdc-focus-indicator {
        border-radius: 50% !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }
      ::ng-deep .mat-mdc-button-touch-target {
        display: none !important;
      }
    }
    .action-btn {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 32px !important;
      height: 32px !important;
      min-width: 32px !important;
      padding: 0 !important;
      border-radius: 50% !important;
      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        line-height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
    .adjust-btn { color: #d97706; &:hover { background: #fef3c7; } }
    .edit-btn { color: #2563eb; &:hover { background: #eff6ff; } }
    .delete-btn { color: #dc2626; &:hover { background: #fef2f2; } }

    /* Empty state */
    .empty-cell {
      text-align: center;
      padding: 40px 20px !important;
    }
    .empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #94a3b8;
      margin-bottom: 8px;
    }
    .empty-text {
      font-size: 0.95rem;
      color: #64748b;
      margin: 0 0 12px;
    }

    /* Utilities */
    .text-primary { color: #2563eb; }
    .text-indigo { color: #4f46e5; }
    .text-success { color: #16a34a; }
    .text-amber { color: #d97706; }
    .text-danger { color: #dc2626; }
    .text-muted { color: #94a3b8; }
    .font-semibold { font-weight: 600; }
    .text-right { text-align: right; }

    /* Responsive Breakpoints */
    @media (max-width: 1024px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
    }
    @media (max-width: 640px) {
      .page-header-row {
        position: relative;
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }
      .title-meta-wrap {
        padding-right: 44px;
      }
      .page-title {
        font-size: 1.25rem;
      }
      .page-subtitle {
        font-size: 0.8rem;
      }
      .action-btn-group {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        width: 100%;
      }
      .action-btn-group .erp-btn {
        width: 100%;
        justify-content: center;
        font-size: 0.76rem;
        padding: 0 6px;
        height: 38px;
        gap: 4px;
        span {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          margin-right: 2px;
        }
      }
      .action-btn-group .refresh-btn {
        position: absolute;
        top: 2px;
        right: 0;
        background: #f1f5f9;
        border-radius: 8px;
      }
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
      .kpi-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .kpi-card {
        padding: 8px 10px;
        min-height: auto;
      }
      .kpi-content {
        gap: 6px;
      }
      .kpi-label {
        font-size: 0.64rem;
        letter-spacing: 0.01em;
        line-height: 1.2;
      }
      .kpi-value {
        font-size: 1.15rem;
        line-height: 1.2;
      }
      .kpi-meta {
        font-size: 0.65rem;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .kpi-icon-wrap {
        width: 30px;
        height: 30px;
        border-radius: 6px;
        flex-shrink: 0;
        mat-icon { font-size: 17px; width: 17px; height: 17px; }
      }
      .filter-card {
        padding: 12px 12px 4px;
      }
      .filter-form-layout { flex-direction: column; align-items: stretch; gap: 8px; }
      .filter-field, .search-field, .branch-field { width: 100%; min-width: 100%; }
    }
  `]
})
export class InventoryComponent implements OnInit, OnDestroy {
  private readonly inventoryService = inject(InventoryService);
  private readonly authService = inject(AuthService);
  private readonly branchService = inject(BranchService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);

  loading = false;
  activeTabIndex = 0;

  // Data collections
  dashboardStats: InventoryDashboardStats | null = null;
  categories: InventoryCategory[] = [];
  vendors: InventoryVendor[] = [];
  items: InventoryItem[] = [];
  inwards: InventoryInward[] = [];
  outwards: InventoryOutward[] = [];
  adjustments: InventoryStockAdjustment[] = [];
  branches: BranchInfo[] = [];

  // Reactive Filter Form
  filterForm!: FormGroup;
  private filterSub?: Subscription;

  // Tab 0: Items Catalog Paged State
  itemsPageIndex = 0;
  itemsPageSize = 10;
  itemsTotalCount = 0;
  itemsSortBy = 'itemName';
  itemsSortDescending = false;

  // Tab 1: Stock Inward Paged State
  inwardsSearchCtrl = new FormControl('');
  inwardsPageIndex = 0;
  inwardsPageSize = 10;
  inwardsTotalCount = 0;
  inwardsSortBy = 'inwardDate';
  inwardsSortDescending = true;
  private inwardsSearchSub?: Subscription;

  // Tab 2: Stock Outward Paged State
  outwardsSearchCtrl = new FormControl('');
  outwardsPageIndex = 0;
  outwardsPageSize = 10;
  outwardsTotalCount = 0;
  outwardsSortBy = 'issueDate';
  outwardsSortDescending = true;
  private outwardsSearchSub?: Subscription;

  // Tab 3: Vendors Directory Paged State
  vendorsSearchCtrl = new FormControl('');
  vendorsPageIndex = 0;
  vendorsPageSize = 10;
  vendorsTotalCount = 0;
  vendorsSortBy = 'vendorName';
  vendorsSortDescending = false;
  private vendorsSearchSub?: Subscription;

  get totalComputedValuation(): number {
    return this.dashboardStats?.totalStockValuation ??
      this.items.reduce((acc, itm) => acc + (itm.purchasePrice * itm.currentStock), 0);
  }

  get lowStockCount(): number {
    return this.dashboardStats?.lowStockCount ??
      this.items.filter(i => i.currentStock <= i.minStockAlertLevel).length;
  }

  ngOnInit(): void {
    // 1. Initialize Reactive Filter Form
    const initialBranch = this.authService.selectedBranchId() || null;
    this.filterForm = this.fb.group({
      branchId: [initialBranch],
      searchTerm: [''],
      categoryId: [null],
      itemType: ['All'],
      lowStockOnly: [false]
    });

    // 2. Load Branches for Branch isolation
    this.loadBranches();

    // 3. Initial Data Load
    this.refreshAll();

    // 4. React to filter changes with debounce
    this.filterSub = this.filterForm.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    ).subscribe(() => {
      this.itemsPageIndex = 0;
      this.loadItems();
    });

    this.inwardsSearchSub = this.inwardsSearchCtrl.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged()
    ).subscribe(() => {
      this.inwardsPageIndex = 0;
      this.loadInwards();
    });

    this.outwardsSearchSub = this.outwardsSearchCtrl.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged()
    ).subscribe(() => {
      this.outwardsPageIndex = 0;
      this.loadOutwards();
    });

    this.vendorsSearchSub = this.vendorsSearchCtrl.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged()
    ).subscribe(() => {
      this.vendorsPageIndex = 0;
      this.loadVendors();
    });
  }

  ngOnDestroy(): void {
    this.filterSub?.unsubscribe();
    this.inwardsSearchSub?.unsubscribe();
    this.outwardsSearchSub?.unsubscribe();
    this.vendorsSearchSub?.unsubscribe();
  }

  loadBranches(): void {
    this.branchService.getBranches().subscribe({
      next: b => {
        this.branches = b;
      },
      error: () => {}
    });
  }

  onTabChange(index: number): void {
    this.activeTabIndex = index;
    if (index === 0) this.loadItems();
    else if (index === 1) this.loadInwards();
    else if (index === 2) this.loadOutwards();
    else if (index === 3) this.loadVendors();
  }

  refreshAll(): void {
    const branchId = this.filterForm.get('branchId')?.value || undefined;
    this.loading = true;

    // Load Dashboard stats
    this.inventoryService.getDashboardStats(branchId).subscribe({
      next: s => { this.dashboardStats = s; },
      error: () => {}
    });

    // Load Categories
    this.inventoryService.getCategories(branchId).subscribe({
      next: c => { this.categories = c; },
      error: () => {}
    });

    // Load Adjustments
    this.inventoryService.getAdjustments(undefined, branchId).subscribe({
      next: adj => { this.adjustments = adj; },
      error: () => {}
    });

    // Always fetch vendors so they are readily available for Inward Dialog & Reorder
    this.inventoryService.getVendors(branchId).subscribe({
      next: v => { this.vendors = v; },
      error: () => {}
    });

    // Also load recent inwards for historical vendor lookup
    this.inventoryService.getInwards({ branchId }).subscribe({
      next: inws => { this.inwards = inws; },
      error: () => {}
    });

    // Load active tab data
    if (this.activeTabIndex === 0) this.loadItems();
    else if (this.activeTabIndex === 1) this.loadInwards();
    else if (this.activeTabIndex === 2) this.loadOutwards();
    else if (this.activeTabIndex === 3) this.loadVendors();
    else this.loadItems();
  }

  loadItems(): void {
    this.loading = true;
    const f = this.filterForm.value;
    this.inventoryService.getItemsPaged({
      search: f.searchTerm?.trim() || undefined,
      categoryId: f.categoryId || undefined,
      itemType: f.itemType,
      lowStockOnly: f.lowStockOnly ? true : undefined,
      branchId: f.branchId || undefined,
      activeOnly: true,
      pageNumber: this.itemsPageIndex + 1,
      pageSize: this.itemsPageSize,
      sortBy: this.itemsSortBy,
      sortDescending: this.itemsSortDescending
    }).subscribe({
      next: res => {
        this.items = res.items;
        this.itemsTotalCount = res.totalCount;
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        console.error('Failed to load items:', err);
      }
    });
  }

  onItemsSortChange(sort: Sort): void {
    this.itemsSortBy = sort.active;
    this.itemsSortDescending = sort.direction === 'desc';
    this.itemsPageIndex = 0;
    this.loadItems();
  }

  onItemsPageChange(e: PageEvent): void {
    this.itemsPageIndex = e.pageIndex;
    this.itemsPageSize = e.pageSize;
    this.loadItems();
  }

  loadInwards(): void {
    this.loading = true;
    const branchId = this.filterForm.get('branchId')?.value || undefined;
    this.inventoryService.getInwardsPaged({
      branchId,
      search: this.inwardsSearchCtrl.value?.trim() || undefined,
      pageNumber: this.inwardsPageIndex + 1,
      pageSize: this.inwardsPageSize,
      sortBy: this.inwardsSortBy,
      sortDescending: this.inwardsSortDescending
    }).subscribe({
      next: res => {
        this.inwards = res.items;
        this.inwardsTotalCount = res.totalCount;
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        console.error('Failed to load inwards:', err);
      }
    });
  }

  onInwardsSortChange(sort: Sort): void {
    this.inwardsSortBy = sort.active;
    this.inwardsSortDescending = sort.direction === 'desc';
    this.inwardsPageIndex = 0;
    this.loadInwards();
  }

  onInwardsPageChange(e: PageEvent): void {
    this.inwardsPageIndex = e.pageIndex;
    this.inwardsPageSize = e.pageSize;
    this.loadInwards();
  }

  loadOutwards(): void {
    this.loading = true;
    const branchId = this.filterForm.get('branchId')?.value || undefined;
    this.inventoryService.getOutwardsPaged({
      branchId,
      search: this.outwardsSearchCtrl.value?.trim() || undefined,
      pageNumber: this.outwardsPageIndex + 1,
      pageSize: this.outwardsPageSize,
      sortBy: this.outwardsSortBy,
      sortDescending: this.outwardsSortDescending
    }).subscribe({
      next: res => {
        this.outwards = res.items;
        this.outwardsTotalCount = res.totalCount;
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        console.error('Failed to load outwards:', err);
      }
    });
  }

  onOutwardsSortChange(sort: Sort): void {
    this.outwardsSortBy = sort.active;
    this.outwardsSortDescending = sort.direction === 'desc';
    this.outwardsPageIndex = 0;
    this.loadOutwards();
  }

  onOutwardsPageChange(e: PageEvent): void {
    this.outwardsPageIndex = e.pageIndex;
    this.outwardsPageSize = e.pageSize;
    this.loadOutwards();
  }

  loadVendors(): void {
    this.loading = true;
    const branchId = this.filterForm.get('branchId')?.value || undefined;
    this.inventoryService.getVendorsPaged({
      branchId,
      search: this.vendorsSearchCtrl.value?.trim() || undefined,
      pageNumber: this.vendorsPageIndex + 1,
      pageSize: this.vendorsPageSize,
      sortBy: this.vendorsSortBy,
      sortDescending: this.vendorsSortDescending
    }).subscribe({
      next: res => {
        this.vendors = res.items;
        this.vendorsTotalCount = res.totalCount;
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        console.error('Failed to load vendors:', err);
      }
    });
  }

  onVendorsSortChange(sort: Sort): void {
    this.vendorsSortBy = sort.active;
    this.vendorsSortDescending = sort.direction === 'desc';
    this.vendorsPageIndex = 0;
    this.loadVendors();
  }

  onVendorsPageChange(e: PageEvent): void {
    this.vendorsPageIndex = e.pageIndex;
    this.vendorsPageSize = e.pageSize;
    this.loadVendors();
  }

  clearSearch(): void {
    this.filterForm.get('searchTerm')?.setValue('');
  }

  getLowStockItems(): InventoryItem[] {
    return this.items.filter(i => i.currentStock <= i.minStockAlertLevel);
  }

  getStockStatusClass(itm: InventoryItem): string {
    if (itm.currentStock <= 0) return 'badge-out-stock';
    if (itm.currentStock <= itm.minStockAlertLevel) return 'badge-low-stock';
    return 'badge-in-stock';
  }

  // =========================================================================
  // Dialog Actions
  // =========================================================================

  openItemDialog(item?: InventoryItem): void {
    const dialogRef = this.dialog.open(InventoryItemDialogComponent, {
      width: '780px',
      maxWidth: '96vw',
      disableClose: true,
      data: {
        isEdit: !!item,
        item,
        categories: this.categories,
        branchId: this.filterForm.get('branchId')?.value || undefined
      }
    });

    dialogRef.afterClosed().subscribe((res: CreateUpdateItemDto | undefined) => {
      if (!res) return;

      this.loading = true;
      if (item) {
        this.inventoryService.updateItem(item.id, res).subscribe({
          next: () => {
            this.confirmDialog.alert('Item Updated', `"${res.itemName}" has been updated successfully.`, 'success');
            this.refreshAll();
          },
          error: err => {
            this.loading = false;
            this.confirmDialog.alert('Error', err?.error?.message || err?.error || 'Failed to update item.', 'danger');
          }
        });
      } else {
        this.inventoryService.createItem(res).subscribe({
          next: () => {
            this.confirmDialog.alert('Item Created', `"${res.itemName}" added to catalog successfully.`, 'success');
            this.refreshAll();
          },
          error: err => {
            this.loading = false;
            this.confirmDialog.alert('Error', err?.error?.message || err?.error || 'Failed to create item.', 'danger');
          }
        });
      }
    });
  }

  deleteItem(item: InventoryItem): void {
    this.confirmDialog.confirm(
      'Delete Inventory Item',
      `Are you sure you want to delete "${item.itemName}" (${item.itemCode})? If it has historical purchases or issues, it will be deactivated.`,
      'Delete',
      'Cancel',
      'danger'
    ).subscribe(ok => {
      if (!ok) return;

      this.loading = true;
      this.inventoryService.deleteItem(item.id).subscribe({
        next: res => {
          this.confirmDialog.alert('Item Deleted', res.message || 'Item removed successfully.', 'info');
          this.refreshAll();
        },
        error: err => {
          this.loading = false;
          this.confirmDialog.alert('Error', err?.error?.message || err?.error || 'Failed to delete item.', 'danger');
        }
      });
    });
  }

  openVendorDialog(vendor?: InventoryVendor): void {
    const dialogRef = this.dialog.open(InventoryVendorDialogComponent, {
      width: '740px',
      maxWidth: '96vw',
      disableClose: true,
      data: {
        isEdit: !!vendor,
        vendor,
        branchId: this.filterForm.get('branchId')?.value || undefined
      }
    });

    dialogRef.afterClosed().subscribe((res: CreateUpdateVendorDto | undefined) => {
      if (!res) return;

      this.loading = true;
      if (vendor) {
        this.inventoryService.updateVendor(vendor.id, res).subscribe({
          next: () => {
            this.confirmDialog.alert('Vendor Updated', `Vendor "${res.vendorName}" updated successfully.`, 'success');
            this.refreshAll();
          },
          error: err => {
            this.loading = false;
            this.confirmDialog.alert('Error', err?.error?.message || err?.error || 'Failed to update vendor.', 'danger');
          }
        });
      } else {
        this.inventoryService.createVendor(res).subscribe({
          next: () => {
            this.confirmDialog.alert('Vendor Registered', `Vendor "${res.vendorName}" registered successfully.`, 'success');
            this.refreshAll();
          },
          error: err => {
            this.loading = false;
            this.confirmDialog.alert('Error', err?.error?.message || err?.error || 'Failed to add vendor.', 'danger');
          }
        });
      }
    });
  }

  deleteVendor(vendor: InventoryVendor): void {
    this.confirmDialog.confirm(
      'Delete Vendor',
      `Are you sure you want to delete vendor "${vendor.vendorName}"?`,
      'Delete',
      'Cancel',
      'danger'
    ).subscribe(ok => {
      if (!ok) return;

      this.loading = true;
      this.inventoryService.deleteVendor(vendor.id).subscribe({
        next: () => {
          this.confirmDialog.alert('Vendor Deleted', 'Vendor removed successfully.', 'info');
          this.refreshAll();
        },
        error: err => {
          this.loading = false;
          this.confirmDialog.alert('Error', err?.error?.message || err?.error || 'Failed to delete vendor.', 'danger');
        }
      });
    });
  }

  openCategoryDialog(category?: InventoryCategory): void {
    const dialogRef = this.dialog.open(InventoryCategoryDialogComponent, {
      width: '580px',
      maxWidth: '96vw',
      disableClose: true,
      data: {
        isEdit: !!category,
        category,
        branchId: this.filterForm.get('branchId')?.value || undefined
      }
    });

    dialogRef.afterClosed().subscribe((res: CreateUpdateCategoryDto | undefined) => {
      if (!res) return;

      this.loading = true;
      if (category) {
        this.inventoryService.updateCategory(category.id, res).subscribe({
          next: () => {
            this.confirmDialog.alert('Category Updated', `Category "${res.name}" updated successfully.`, 'success');
            this.refreshAll();
          },
          error: err => {
            this.loading = false;
            this.confirmDialog.alert('Error', err?.error?.message || err?.error || 'Failed to update category.', 'danger');
          }
        });
      } else {
        this.inventoryService.createCategory(res).subscribe({
          next: () => {
            this.confirmDialog.alert('Category Created', `Category "${res.name}" created successfully.`, 'success');
            this.refreshAll();
          },
          error: err => {
            this.loading = false;
            this.confirmDialog.alert('Error', err?.error?.message || err?.error || 'Failed to create category.', 'danger');
          }
        });
      }
    });
  }

  deleteCategory(category: InventoryCategory): void {
    if (category.activeItemsCount > 0) {
      this.confirmDialog.alert('Cannot Delete', `Category "${category.name}" has ${category.activeItemsCount} items linked to it. Please reassign or delete items first.`, 'warning');
      return;
    }

    this.confirmDialog.confirm(
      'Delete Category',
      `Are you sure you want to delete category "${category.name}" (${category.code})?`,
      'Delete',
      'Cancel',
      'danger'
    ).subscribe(ok => {
      if (!ok) return;

      this.loading = true;
      this.inventoryService.deleteCategory(category.id).subscribe({
        next: () => {
          this.confirmDialog.alert('Category Deleted', 'Category removed successfully.', 'info');
          this.refreshAll();
        },
        error: err => {
          this.loading = false;
          this.confirmDialog.alert('Error', err?.error?.message || err?.error || 'Failed to delete category.', 'danger');
        }
      });
    });
  }

  reorderItem(item: InventoryItem): void {
    const deficit = Math.max(1, (item.minStockAlertLevel || 0) - (item.currentStock || 0));

    // Auto-detect vendor: check previous inwards for this item, or pick first registered supplier
    const lastInward = this.inwards?.find(inw => inw.items?.some(it => it.itemId === item.id && inw.vendorId));
    const preferredVendor = (this.vendors || []).find(v => !v.vendorName.toLowerCase().includes('direct')) || (this.vendors || [])[0];
    const vendorId = lastInward?.vendorId || preferredVendor?.id;

    this.openInwardDialog({
      itemId: item.id,
      quantity: deficit,
      unitPrice: item.purchasePrice || 0,
      vendorId,
      remarks: `Auto-reorder for low stock safety threshold (Deficit: ${deficit} ${item.unitOfMeasurement})`
    });
  }

  openInwardDialog(prefill?: { itemId: string; quantity: number; unitPrice: number; vendorId?: string; remarks?: string }): void {
    if (this.items.length === 0) {
      this.confirmDialog.alert('Catalog Empty', 'Please add inventory items to the catalog first before recording stock inward.', 'warning');
      return;
    }

    const launchModal = (vendorList: InventoryVendor[]) => {
      const preferred = vendorList.find(v => !v.vendorName.toLowerCase().includes('direct')) || vendorList[0];
      const resolvedPrefill = prefill ? {
        ...prefill,
        vendorId: prefill.vendorId || preferred?.id
      } : undefined;

      const dialogRef = this.dialog.open(InventoryInwardDialogComponent, {
        width: '1180px',
        maxWidth: '96vw',
        disableClose: true,
        data: {
          vendors: vendorList,
          items: this.items,
          branchId: this.filterForm.get('branchId')?.value || undefined,
          prefill: resolvedPrefill
        }
      });

      dialogRef.afterClosed().subscribe((res: CreateInwardDto | undefined) => {
        if (!res) return;

        this.loading = true;
        this.inventoryService.createInward(res).subscribe({
          next: r => {
            this.confirmDialog.alert('Stock Inward Recorded', `GRN ${r.inwardNumber} saved successfully and item physical stock has been updated.`, 'success');
            this.refreshAll();

            // Auto-fetch and show the print GRN receipt slip
            this.inventoryService.getInwards({ branchId: this.filterForm.get('branchId')?.value || undefined }).subscribe(inws => {
              const created = (inws || []).find(i => i.inwardNumber === r.inwardNumber);
              if (created) {
                this.printInwardSlip(created);
              }
            });
          },
          error: err => {
            this.loading = false;
            this.confirmDialog.alert('Error', err?.error?.message || err?.error || 'Failed to save stock inward.', 'danger');
          }
        });
      });
    };

    if (this.vendors && this.vendors.length > 0) {
      launchModal(this.vendors);
    } else {
      const branchId = this.filterForm.get('branchId')?.value || undefined;
      this.inventoryService.getVendors(branchId).subscribe({
        next: vList => {
          this.vendors = vList;
          launchModal(vList);
        },
        error: () => {
          launchModal([]);
        }
      });
    }
  }

  printInwardSlip(inw: InventoryInward): void {
    this.dialog.open(InventoryInwardReceiptDialogComponent, {
      width: '880px',
      maxWidth: '96vw',
      data: {
        inward: inw,
        instituteName: this.authService.currentUser()?.instituteName,
        branchName: this.authService.currentUser()?.branchName,
        logoUrl: this.authService.getInstituteLogoUrl()
      }
    });
  }

  openOutwardDialog(presetType?: 'StudentKitSale' | 'StaffDepartmentIssue'): void {
    if (this.items.length === 0) {
      this.confirmDialog.alert('Catalog Empty', 'Please add inventory items to the catalog first.', 'warning');
      return;
    }

    const dialogRef = this.dialog.open(InventoryOutwardDialogComponent, {
      width: '1140px',
      maxWidth: '96vw',
      disableClose: true,
      data: {
        items: this.items,
        branchId: this.filterForm.get('branchId')?.value || undefined,
        presetIssueType: presetType
      }
    });

    dialogRef.afterClosed().subscribe((res: CreateOutwardDto | undefined) => {
      if (!res) return;

      this.loading = true;
      this.inventoryService.createOutward(res).subscribe({
        next: r => {
          this.confirmDialog.alert('Stock Issued', `Issue ${r.issueNumber} completed successfully. Stock deducted in real time.`, 'success');
          this.refreshAll();

          // Auto-fetch and show the print receipt slip so storekeeper can print immediately
          this.inventoryService.getOutwards({ branchId: this.filterForm.get('branchId')?.value || undefined }).subscribe(outs => {
            const created = (outs || []).find(o => o.issueNumber === r.issueNumber);
            if (created) {
              this.printOutwardSlip(created);
            }
          });
        },
        error: err => {
          this.loading = false;
          this.confirmDialog.alert('Issue Failed', err?.error?.message || err?.error || 'Failed to issue stock.', 'danger');
        }
      });
    });
  }

  printOutwardSlip(out: InventoryOutward): void {
    this.dialog.open(InventoryOutwardReceiptDialogComponent, {
      width: '880px',
      maxWidth: '96vw',
      data: {
        outward: out,
        instituteName: this.authService.currentUser()?.instituteName,
        branchName: this.authService.currentUser()?.branchName,
        logoUrl: this.authService.getInstituteLogoUrl()
      }
    });
  }

  cancelOutward(out: InventoryOutward): void {
    if (out.paymentStatus === 'Cancelled') {
      this.confirmDialog.alert('Already Cancelled', `Issue ${out.issueNumber} is already cancelled and items are restored.`, 'info');
      return;
    }

    const itemsSummary = (out.items || []).map(i => `${i.quantity}x ${i.itemName}`).join(', ');
    this.confirmDialog.confirm(
      'Cancel Stock Issue & Restore Items',
      `Are you sure you want to cancel Outward Issue "${out.issueNumber}" for ${out.issuedToName}?\n\nItems to be returned to store inventory stock:\n• ${itemsSummary}\n\nAny pending kit fee invoices will also be cancelled.`,
      'Yes, Cancel & Restore Stock'
    ).subscribe((confirmed) => {
      if (confirmed) {
        this.loading = true;
        this.inventoryService.cancelOutward(out.id, 'Cancelled via Outward Table').subscribe({
          next: (res) => {
            this.confirmDialog.alert('Stock Restored', res?.message || `Outward ${out.issueNumber} cancelled and stock restored to inventory.`, 'success');
            this.refreshAll();
          },
          error: (err) => {
            this.loading = false;
            this.confirmDialog.alert('Action Failed', err?.error?.message || 'Failed to cancel outward issue.', 'danger');
          }
        });
      }
    });
  }

  openAdjustDialog(item: InventoryItem): void {
    const dialogRef = this.dialog.open(InventoryAdjustDialogComponent, {
      width: '540px',
      maxWidth: '94vw',
      disableClose: true,
      data: { item }
    });

    dialogRef.afterClosed().subscribe((res: CreateStockAdjustmentDto | undefined) => {
      if (!res) return;

      this.loading = true;
      this.inventoryService.createAdjustment(res).subscribe({
        next: r => {
          this.confirmDialog.alert('Stock Adjusted', r.message || 'Physical stock updated successfully.', 'success');
          this.refreshAll();
        },
        error: err => {
          this.loading = false;
          this.confirmDialog.alert('Error', err?.error?.message || err?.error || 'Failed to adjust stock.', 'danger');
        }
      });
    });
  }
}
