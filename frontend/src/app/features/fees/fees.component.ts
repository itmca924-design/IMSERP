import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FeesService, FeeInvoicePagedItem, FeePaymentReceipt } from '../../core/services/fees.service';
import { BatchesService, BatchDto } from '../../core/services/batches.service';
import { AuthService } from '../../core/services/auth.service';
import { FeeCollectionDialogComponent } from './fee-collection-dialog.component';
import { FeeReceiptDialogComponent } from './fee-receipt-dialog.component';
import { FeeDueReceiptDialogComponent } from './fee-due-receipt-dialog.component';
import { StudentLedgerDialogComponent } from './student-ledger-dialog.component';
import { GenerateInvoicesDialogComponent } from './generate-invoices-dialog.component';
import { CancelInvoiceDialogComponent } from './cancel-invoice-dialog.component';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-fees',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatDialogModule,
    MatCheckboxModule
  ],
  template: `
    <div class="fees-wrapper">
      <!-- Page Title & Header Actions -->
      <div class="header-actions">
        <div class="header-text-group">
          <h2>Fee Collection & Dues Management</h2>
          <p>Record fee payments with FIFO auto-settlement, issue digital WhatsApp receipts, and track student ledger passbooks.</p>
        </div>
        <button mat-raised-button color="primary" class="generate-btn" (click)="openGenerateInvoicesModal()">
          <mat-icon>post_add</mat-icon>
          <span>Generate Monthly Invoices</span>
        </button>
      </div>

      <!-- Main Invoices Directory Card -->
      <mat-card class="table-card mat-elevation-z2">
        <!-- Filter Toolbar -->
        <div class="filter-toolbar">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search Invoices / Students / Phone...</mat-label>
            <input
              matInput
              [(ngModel)]="searchTerm"
              (keyup.enter)="onSearch()"
              placeholder="e.g. Mantosh, INV-2026, 95405..."
            />
            <button mat-icon-button matSuffix (click)="onSearch()" aria-label="Search">
              <mat-icon>search</mat-icon>
            </button>
          </mat-form-field>

          <mat-form-field appearance="outline" class="status-filter">
            <mat-label>Status Filter</mat-label>
            <mat-select [(ngModel)]="selectedStatusFilter" (selectionChange)="onFilterChange()">
              <mat-option value="">All Statuses</mat-option>
              <mat-option value="Pending">Pending</mat-option>
              <mat-option value="Partial">Partial Dues</mat-option>
              <mat-option value="Overdue">Overdue Dues</mat-option>
              <mat-option value="Paid">Fully Paid</mat-option>
              <mat-option value="Cancelled">Cancelled</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="batch-filter">
            <mat-label>Filter by Batch</mat-label>
            <mat-select [(ngModel)]="selectedBatchFilter" (selectionChange)="onFilterChange()" panelClass="batch-filter-panel">
              <mat-option value="">All Academic Batches</mat-option>
              <mat-option *ngFor="let b of batches" [value]="b.id">
                {{ b.name }}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-progress-bar mode="indeterminate" *ngIf="loading" class="grid-loader"></mat-progress-bar>

        <!-- Data Table -->
        <mat-card-content class="table-container">
          <table mat-table [dataSource]="invoices" matSort (matSortChange)="onSortChange($event)" class="full-width">
            
            <ng-container matColumnDef="select">
              <th mat-header-cell *matHeaderCellDef class="select-col">
                <mat-checkbox
                  (change)="toggleAllVisibleRows($event)"
                  [checked]="isAllSelected()"
                  [indeterminate]="isSomeSelected()"
                  [disabled]="!hasSelectableRows()"
                  matTooltip="Select all pending on this page"
                  color="primary">
                </mat-checkbox>
              </th>
              <td mat-cell *matCellDef="let inv" class="select-col">
                <mat-checkbox
                  *ngIf="canSelectInvoice(inv)"
                  (click)="$event.stopPropagation()"
                  (change)="toggleInvoiceSelection(inv)"
                  [checked]="isInvoiceSelected(inv)"
                  [disabled]="isInvoiceDisabled(inv)"
                  [matTooltip]="getSelectTooltip(inv)"
                  color="primary">
                </mat-checkbox>
              </td>
            </ng-container>

            <ng-container matColumnDef="invoiceNumber">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="invoiceNumber">Invoice No</th>
              <td mat-cell *matCellDef="let inv"><strong>{{ inv.invoiceNumber }}</strong></td>
            </ng-container>

            <ng-container matColumnDef="studentName">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="studentName">Student</th>
              <td mat-cell *matCellDef="let inv">
                <div class="st-cell">
                  <span class="st-name-text">{{ inv.studentName }}</span>
                  <small class="st-roll-text">({{ inv.rollNumber }})</small>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="batchName">
              <th mat-header-cell *matHeaderCellDef>Assigned Batch</th>
              <td mat-cell *matCellDef="let inv">{{ inv.batchName }}</td>
            </ng-container>

            <ng-container matColumnDef="title">
              <th mat-header-cell *matHeaderCellDef>Billing Period</th>
              <td mat-cell *matCellDef="let inv">{{ inv.title }}</td>
            </ng-container>

            <ng-container matColumnDef="totalAmount">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="totalAmount" class="text-right">Fee (₹)</th>
              <td mat-cell *matCellDef="let inv" class="text-right">₹{{ inv.totalAmount | number:'1.2-2' }}</td>
            </ng-container>

            <ng-container matColumnDef="paidAmount">
              <th mat-header-cell *matHeaderCellDef class="text-right">Paid (₹)</th>
              <td mat-cell *matCellDef="let inv" class="text-right amount-paid">₹{{ inv.paidAmount | number:'1.2-2' }}</td>
            </ng-container>

            <ng-container matColumnDef="dueAmount">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="dueAmount" class="text-right">Balance Due (₹)</th>
              <td mat-cell *matCellDef="let inv" class="text-right">
                <ng-container *ngIf="inv.status !== 'Cancelled'">
                  <strong class="amount-due">₹{{ inv.dueAmount | number:'1.2-2' }}</strong>
                </ng-container>
                <ng-container *ngIf="inv.status === 'Cancelled'">
                  <span class="cancelled-due" matTooltip="Invoice cancelled (no dues payable)">₹0.00</span>
                </ng-container>
              </td>
            </ng-container>

            <ng-container matColumnDef="dueDate">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="dueDate">Due Date</th>
              <td mat-cell *matCellDef="let inv">{{ inv.dueDate | date:'mediumDate' }}</td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="status" class="text-center">Status</th>
              <td mat-cell *matCellDef="let inv" class="text-center">
                <span
                  [class]="'status-badge ' + inv.status.toLowerCase()"
                  [matTooltip]="inv.status === 'Cancelled' ? ('Cancelled' + (inv.cancelledAt ? ' on ' + (inv.cancelledAt | date:'mediumDate') : '') + (inv.cancellationReason ? ' | Reason: ' + inv.cancellationReason : '')) : ''"
                  [matTooltipPosition]="'above'">
                  {{ inv.status }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="text-right">Actions</th>
              <td mat-cell *matCellDef="let inv" class="text-right">
                <div class="action-buttons">
                  <!-- Collect Fee: hide for Cancelled/Paid -->
                  <button
                    *ngIf="inv.dueAmount > 0 && inv.status !== 'Cancelled'"
                    mat-stroked-button
                    color="primary"
                    (click)="openCollectFeeModal(inv)"
                    matTooltip="Collect Fee (FIFO Settlement)">
                    <mat-icon>payments</mat-icon> Collect Fee
                  </button>

                  <!-- Due Receipt / Slip: for rows with dueAmount > 0 and not Cancelled -->
                  <button
                    *ngIf="inv.dueAmount > 0 && inv.status !== 'Cancelled'"
                    mat-icon-button
                    class="due-receipt-btn"
                    (click)="openDueReceiptModal(inv)"
                    matTooltip="Print / View Due Slip (बकाया पर्ची)">
                    <mat-icon>receipt_long</mat-icon>
                  </button>

                  <!-- View/Print Paid Receipt: for Paid invoices -->
                  <button
                    *ngIf="inv.status === 'Paid'"
                    mat-icon-button
                    class="view-receipt-btn"
                    (click)="openReceiptForInvoice(inv)"
                    matTooltip="Print / View Payment Receipt (फीस रसीद)">
                    <mat-icon>receipt</mat-icon>
                  </button>

                  <!-- WhatsApp: hide for Cancelled -->
                  <button
                    *ngIf="inv.status !== 'Cancelled'"
                    mat-icon-button
                    class="whatsapp-btn"
                    (click)="sendReminder(inv)"
                    [matTooltip]="inv.dueAmount > 0 ? 'Send WhatsApp Fee Due Reminder' : 'Send WhatsApp Paid Receipt'">
                    <svg class="wa-svg-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                  </button>

                  <!-- Passbook/Ledger always visible -->
                  <button
                    mat-icon-button
                    class="ledger-btn"
                    (click)="openStudentLedger(inv.studentId)"
                    matTooltip="View Student Passbook & Ledger">
                    <mat-icon>menu_book</mat-icon>
                  </button>

                  <!-- Cancel Invoice: only for Pending/Partial (no partial payment) -->
                  <button
                    *ngIf="inv.status === 'Pending' || inv.status === 'Partial'"
                    mat-icon-button
                    class="cancel-invoice-btn"
                    (click)="confirmCancelInvoice(inv)"
                    matTooltip="Cancel Invoice (Student Left / Error)">
                    <mat-icon>cancel</mat-icon>
                  </button>
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>

            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell empty-cell" [attr.colspan]="displayedColumns.length">
                <div class="empty-state" *ngIf="!loading">
                  <mat-icon class="empty-icon">payments</mat-icon>
                  <p>No fee invoices found matching your filter criteria.</p>
                </div>
              </td>
            </tr>
          </table>
        </mat-card-content>

        <mat-paginator
          [length]="totalCount"
          [pageSize]="pageSize"
          [pageSizeOptions]="[5, 10, 20, 50]"
          [pageIndex]="pageIndex"
          (page)="onPageChange($event)"
          showFirstLastButtons>
        </mat-paginator>
      </mat-card>

      <!-- Floating Multi-Collect Action Bar -->
      <div class="multi-collect-bar" *ngIf="selectedInvoices.length > 0">
        <div class="bar-left">
          <div class="badge-count">{{ selectedInvoices.length }}</div>
          <div class="selection-info">
            <span class="sel-title">{{ selectedStudentName }} (Roll #{{ selectedRollNumber }})</span>
            <small class="sel-sub">{{ selectedInvoices.length }} Invoice(s) Selected for Multi-Collection</small>
          </div>
        </div>

        <div class="bar-center">
          <span class="total-label">Total to Collect:</span>
          <strong class="total-amount">₹{{ totalSelectedDue | number:'1.2-2' }}</strong>
        </div>

        <div class="bar-right">
          <button mat-button class="btn-clear" (click)="clearSelection()">
            Clear
          </button>
          <button mat-raised-button class="btn-collect-multi" (click)="openMultiCollectModal()">
            <mat-icon>payments</mat-icon>
            <span>Collect Fees (₹{{ totalSelectedDue | number:'1.2-2' }})</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .fees-wrapper {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .header-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      h2 { margin: 0; font-size: 1.5rem; color: #1976d2; font-weight: 700; }
      p { margin: 4px 0 0 0; color: #666; font-size: 0.9rem; }
    }
    .generate-btn {
      height: 44px;
      font-weight: 600;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      letter-spacing: 0.02em;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
    }
    .table-card {
      border-radius: 8px;
      overflow: hidden;
      position: relative;
    }
    .filter-toolbar {
      padding: 16px 20px 0 20px;
      display: flex;
      gap: 16px;
      align-items: center;

      .search-field { width: 300px; }
      .status-filter { width: 180px; }
      .batch-filter { width: 360px; }
    }
    .grid-loader { margin-top: 4px; }
    .table-container { padding: 0; }
    .full-width { width: 100%; }
    .st-cell {
      display: flex;
      flex-direction: column;
      .st-name-text { font-weight: 600; color: #1e293b; }
      .st-roll-text { color: #64748b; font-size: 0.78rem; }
    }
    .amount-paid { color: #16a34a; font-weight: 600; }
    .amount-due { color: #dc2626; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .status-badge {
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      display: inline-block;
      &.pending  { background: #fef3c7; color: #92400e; }
      &.partial  { background: #dbeafe; color: #1e40af; }
      &.paid     { background: #dcfce7; color: #166534; }
      &.overdue  { background: #fee2e2; color: #991b1b; }
      &.cancelled { background: #f1f5f9; color: #64748b; text-decoration: line-through; cursor: help; }
    }
    .cancelled-due {
      color: #94a3b8;
      font-size: 0.85rem;
      font-weight: 500;
      text-decoration: line-through;
      cursor: help;
    }
    .action-buttons {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      white-space: nowrap;

      button.mat-mdc-icon-button {
        width: 36px !important;
        height: 36px !important;
        min-width: 36px !important;
        padding: 0 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        border-radius: 50% !important;
        background: transparent !important;

        mat-icon {
          font-size: 20px !important;
          width: 20px !important;
          height: 20px !important;
          line-height: 20px !important;
        }
      }
    }
    .whatsapp-btn {
      color: #16a34a !important;
      transition: color 0.15s ease, transform 0.15s ease, background-color 0.15s ease;

      &:hover {
        background-color: #dcfce7 !important;
        transform: scale(1.1);
      }

      .wa-svg-icon {
        width: 20px;
        height: 20px;
        fill: #16a34a;
        display: block;
        flex-shrink: 0;
      }
    }
    .due-receipt-btn {
      color: #dc2626 !important;
      transition: color 0.15s ease, transform 0.15s ease, background-color 0.15s ease;
      &:hover {
        background-color: #fee2e2 !important;
        transform: scale(1.1);
      }
    }
    .view-receipt-btn {
      color: #16a34a !important;
      transition: color 0.15s ease, transform 0.15s ease, background-color 0.15s ease;
      &:hover {
        background-color: #dcfce7 !important;
        transform: scale(1.1);
      }
    }
    .ledger-btn {
      color: #e11d48 !important;
      transition: color 0.15s ease, transform 0.15s ease, background-color 0.15s ease;
      &:hover {
        background-color: #ffe4e6 !important;
        transform: scale(1.1);
      }
    }
    .cancel-invoice-btn {
      color: #94a3b8 !important;
      transition: color 0.15s ease, transform 0.15s ease, background-color 0.15s ease;
      &:hover {
        color: #dc2626 !important;
        background-color: #fee2e2 !important;
        transform: scale(1.1);
      }
    }
    .empty-cell { padding: 40px; text-align: center; }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      color: #94a3b8;
      .empty-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 8px; }
    }
    .select-col {
      width: 48px;
      padding: 0 8px 0 16px !important;
      text-align: center;
    }
    .multi-collect-bar {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999;
      background: #0f172a;
      color: #f8fafc;
      border-radius: 50px;
      padding: 8px 16px 8px 20px;
      display: flex;
      align-items: center;
      gap: 20px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.2);
      animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      border: 1px solid rgba(255, 255, 255, 0.12);

      .bar-left {
        display: flex;
        align-items: center;
        gap: 12px;

        .badge-count {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #3b82f6;
          color: #ffffff;
          font-weight: 700;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .selection-info {
          display: flex;
          flex-direction: column;

          .sel-title {
            font-weight: 700;
            font-size: 0.92rem;
            color: #ffffff;
          }
          .sel-sub {
            font-size: 0.74rem;
            color: #94a3b8;
          }
        }
      }

      .bar-center {
        display: flex;
        align-items: baseline;
        gap: 8px;
        padding: 0 16px;
        border-left: 1px solid rgba(255, 255, 255, 0.15);
        border-right: 1px solid rgba(255, 255, 255, 0.15);

        .total-label {
          font-size: 0.8rem;
          color: #94a3b8;
        }
        .total-amount {
          font-size: 1.25rem;
          color: #4ade80;
          font-weight: 700;
        }
      }

      .bar-right {
        display: flex;
        align-items: center;
        gap: 10px;

        .btn-clear {
          color: #cbd5e1;
          font-size: 0.85rem;
          &:hover {
            color: #ffffff;
          }
        }

        .btn-collect-multi {
          background-color: #22c55e !important;
          color: #ffffff !important;
          font-weight: 700;
          border-radius: 30px;
          padding: 0 20px;
          height: 40px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 4px 12px rgba(34, 197, 94, 0.35);

          &:hover {
            background-color: #16a34a !important;
          }
        }
      }
    }

    @keyframes slideUp {
      from {
        transform: translate(-50%, 40px);
        opacity: 0;
      }
      to {
        transform: translate(-50%, 0);
        opacity: 1;
      }
    }
  `]
})
export class FeesComponent implements OnInit, OnDestroy {
  invoices: FeeInvoicePagedItem[] = [];
  batches: BatchDto[] = [];
  loading = false;
  private refreshSub?: Subscription;

  pageIndex = 0;
  pageSize = 10;
  totalCount = 0;
  searchTerm = '';
  selectedStatusFilter = '';
  selectedBatchFilter = '';
  sortBy = 'dueDate';
  sortDescending = true;

  displayedColumns = [
    'select',
    'invoiceNumber',
    'studentName',
    'batchName',
    'title',
    'totalAmount',
    'paidAmount',
    'dueAmount',
    'dueDate',
    'status',
    'actions'
  ];

  selectedInvoices: FeeInvoicePagedItem[] = [];

  get selectedStudentId(): string | null {
    return this.selectedInvoices.length > 0 ? this.selectedInvoices[0].studentId : null;
  }

  get selectedStudentName(): string {
    return this.selectedInvoices.length > 0 ? this.selectedInvoices[0].studentName : '';
  }

  get selectedRollNumber(): string {
    return this.selectedInvoices.length > 0 ? this.selectedInvoices[0].rollNumber : '';
  }

  get totalSelectedDue(): number {
    return this.selectedInvoices.reduce((acc, curr) => acc + curr.dueAmount, 0);
  }

  canSelectInvoice(inv: FeeInvoicePagedItem): boolean {
    return inv.dueAmount > 0 && inv.status !== 'Cancelled' && inv.status !== 'Paid';
  }

  isInvoiceDisabled(inv: FeeInvoicePagedItem): boolean {
    if (!this.canSelectInvoice(inv)) return true;
    if (this.selectedStudentId && inv.studentId !== this.selectedStudentId) {
      return true; // only allow selecting for the same student
    }
    return false;
  }

  getSelectTooltip(inv: FeeInvoicePagedItem): string {
    if (this.selectedStudentId && inv.studentId !== this.selectedStudentId) {
      return `Multi-collect is per student. Only ${this.selectedStudentName}'s invoices can be selected together.`;
    }
    return 'Select for multi-invoice payment collection';
  }

  isInvoiceSelected(inv: FeeInvoicePagedItem): boolean {
    return this.selectedInvoices.some(i => i.id === inv.id);
  }

  toggleInvoiceSelection(inv: FeeInvoicePagedItem): void {
    const idx = this.selectedInvoices.findIndex(i => i.id === inv.id);
    if (idx >= 0) {
      this.selectedInvoices.splice(idx, 1);
    } else {
      if (this.selectedStudentId && this.selectedStudentId !== inv.studentId) {
        this.selectedInvoices = [inv];
      } else {
        this.selectedInvoices.push(inv);
      }
    }
  }

  hasSelectableRows(): boolean {
    return this.invoices.some(i => this.canSelectInvoice(i));
  }

  isAllSelected(): boolean {
    const selectable = this.invoices.filter(i => this.canSelectInvoice(i));
    if (selectable.length === 0) return false;
    const studentId = this.selectedStudentId || selectable[0].studentId;
    const studentSelectable = selectable.filter(i => i.studentId === studentId);
    return studentSelectable.length > 0 && studentSelectable.every(i => this.isInvoiceSelected(i));
  }

  isSomeSelected(): boolean {
    return this.selectedInvoices.length > 0 && !this.isAllSelected();
  }

  toggleAllVisibleRows(event: any): void {
    if (event.checked) {
      const selectable = this.invoices.filter(i => this.canSelectInvoice(i));
      if (selectable.length === 0) return;
      const studentId = this.selectedStudentId || selectable[0].studentId;
      const forStudent = selectable.filter(i => i.studentId === studentId);
      this.selectedInvoices = [...forStudent];
    } else {
      this.clearSelection();
    }
  }

  clearSelection(): void {
    this.selectedInvoices = [];
  }

  openMultiCollectModal(): void {
    if (this.selectedInvoices.length === 0) return;

    const first = this.selectedInvoices[0];
    const totalAmount = this.totalSelectedDue;
    const invCount = this.selectedInvoices.length;
    const invTitles = this.selectedInvoices.map(i => i.title).join(', ');

    const dialogRef = this.dialog.open(FeeCollectionDialogComponent, {
      width: '540px',
      data: {
        studentId: first.studentId,
        studentName: first.studentName,
        rollNumber: first.rollNumber,
        batchName: first.batchName,
        parentWhatsAppPhone: first.parentWhatsAppPhone,
        totalOutstandingDue: totalAmount,
        initialAmount: totalAmount,
        selectedInvoicesCount: invCount,
        selectedInvoicesDetails: invTitles
      }
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res) {
        this.clearSelection();
        this.loadInvoices();

        // Immediately open official Fee Payment Receipt Dialog
        this.dialog.open(FeeReceiptDialogComponent, {
          width: '840px',
          data: {
            receipt: res,
            instituteName: this.authService.currentUser()?.instituteName || 'Saraswati Coaching Classes'
          }
        });
      }
    });
  }

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private feesService: FeesService,
    private batchesService: BatchesService,
    private confirmDialog: ConfirmDialogService,
    private authService: AuthService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadBatches();
    this.loadInvoices();

    this.refreshSub = this.feesService.refreshRequired$.subscribe(() => {
      this.loadInvoices();
    });
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  loadBatches(): void {
    this.batchesService.getBatches().subscribe({
      next: (data) => (this.batches = data),
      error: (err) => console.error('Error fetching batches:', err)
    });
  }

  loadInvoices(): void {
    this.loading = true;
    this.feesService
      .getInvoicesPaged(
        this.pageIndex + 1,
        this.pageSize,
        this.searchTerm,
        this.selectedBatchFilter,
        this.selectedStatusFilter,
        this.sortBy,
        this.sortDescending
      )
      .subscribe({
        next: (result) => {
          this.invoices = result.items;
          this.totalCount = result.totalCount;
          this.loading = false;
          // Keep only still-valid selections
          this.selectedInvoices = this.selectedInvoices.filter(sel =>
            this.invoices.some(inv => inv.id === sel.id && this.canSelectInvoice(inv))
          );
        },
        error: (err) => {
          this.loading = false;
          console.error('Error fetching fee invoices:', err);
        }
      });
  }

  onSearch(): void {
    this.pageIndex = 0;
    this.loadInvoices();
  }

  onFilterChange(): void {
    this.pageIndex = 0;
    this.loadInvoices();
  }

  onSortChange(sortState: Sort): void {
    this.sortBy = sortState.active || 'dueDate';
    this.sortDescending = sortState.direction === 'desc';
    this.pageIndex = 0;
    this.loadInvoices();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadInvoices();
  }

  openCollectFeeModal(inv: FeeInvoicePagedItem): void {
    const dialogRef = this.dialog.open(FeeCollectionDialogComponent, {
      width: '540px',
      data: {
        studentId: inv.studentId,
        studentName: inv.studentName,
        rollNumber: inv.rollNumber,
        batchName: inv.batchName,
        parentWhatsAppPhone: inv.parentWhatsAppPhone,
        totalOutstandingDue: inv.dueAmount
      }
    });

    dialogRef.afterClosed().subscribe((res: FeePaymentReceipt | undefined) => {
      if (res) {
        this.loadInvoices();

        // Immediately open official Fee Payment Receipt Dialog
        this.dialog.open(FeeReceiptDialogComponent, {
          width: '840px',
          maxWidth: '96vw',
          panelClass: 'receipt-dialog-panel',
          data: {
            receipt: res,
            instituteName: this.authService.currentUser()?.instituteName || 'Saraswati Coaching Classes'
          }
        });
      }
    });
  }

  openDueReceiptModal(inv: FeeInvoicePagedItem): void {
    const dialogRef = this.dialog.open(FeeDueReceiptDialogComponent, {
      width: '840px',
      maxWidth: '96vw',
      panelClass: 'receipt-dialog-panel',
      data: {
        studentId: inv.studentId,
        invoiceId: inv.id,
        studentName: inv.studentName,
        rollNumber: inv.rollNumber,
        batchName: inv.batchName,
        parentWhatsAppPhone: inv.parentWhatsAppPhone,
        invoice: inv,
        instituteName: this.authService.currentUser()?.instituteName || 'Saraswati Coaching Classes'
      }
    });

    dialogRef.afterClosed().subscribe((action) => {
      if (action === 'COLLECT_NOW') {
        this.openCollectFeeModal(inv);
      }
    });
  }

  openReceiptForInvoice(inv: FeeInvoicePagedItem): void {
    this.feesService.getStudentLedger(inv.studentId).subscribe({
      next: (ledger) => {
        const payment = ledger.payments.find(p => p.invoiceNumber === inv.invoiceNumber) || ledger.payments[0];
        if (payment) {
          const receiptData: FeePaymentReceipt = {
            paymentId: payment.paymentId,
            receiptNumber: payment.receiptNumber,
            studentName: ledger.studentName,
            rollNumber: ledger.rollNumber,
            batchName: ledger.batchName,
            parentName: ledger.parentName,
            parentPhone: ledger.parentWhatsAppPhone,
            invoiceNumber: inv.invoiceNumber,
            amountPaid: payment.amountPaid,
            remainingDue: ledger.totalOutstandingDue,
            paymentDate: payment.paymentDate,
            mode: payment.mode,
            transactionRef: payment.transactionRef,
            remarks: payment.remarks
          };

          this.dialog.open(FeeReceiptDialogComponent, {
            width: '840px',
            maxWidth: '96vw',
            panelClass: 'receipt-dialog-panel',
            data: {
              receipt: receiptData,
              instituteName: this.authService.currentUser()?.instituteName || 'Saraswati Coaching Classes'
            }
          });
        } else {
          this.confirmDialog.alert('Receipt', 'No payment receipt record found for this invoice.', 'info');
        }
      },
      error: (err) => console.error('Error fetching ledger for receipt:', err)
    });
  }

  openStudentLedger(studentId: string): void {
    const dialogRef = this.dialog.open(StudentLedgerDialogComponent, {
      width: '980px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      panelClass: 'ledger-dialog-panel',
      data: { studentId }
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res?.refreshed) {
        this.loadInvoices();
      }
    });
  }

  openGenerateInvoicesModal(): void {
    const dialogRef = this.dialog.open(GenerateInvoicesDialogComponent, {
      width: '520px',
      data: {
        batches: this.batches,
        defaultBatchId: this.selectedBatchFilter
      }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.confirmDialog.alert(
          'Monthly Invoices Generated',
          result.message || `Successfully generated ${result.generatedCount} monthly invoices.`,
          'success'
        );
        this.pageIndex = 0;
        this.loadInvoices();
      }
    });
  }

  sendReminder(inv: FeeInvoicePagedItem): void {
    const isPaid = inv.dueAmount === 0;
    const actionTitle = isPaid ? 'Send WhatsApp Receipt' : 'Send WhatsApp Reminder';
    const actionMsg = isPaid
      ? `Dispatch fee paid receipt WhatsApp message to ${inv.studentName}'s Parent (${inv.parentWhatsAppPhone})?`
      : `Dispatch fee due reminder WhatsApp message to ${inv.studentName}'s Parent (${inv.parentWhatsAppPhone})?`;

    this.confirmDialog.confirm(
      actionTitle,
      actionMsg,
      'Send WhatsApp',
      'Cancel',
      isPaid ? 'success' : 'info'
    ).subscribe((confirmed) => {
      if (confirmed) {
        this.feesService.sendWhatsAppReminder(inv.id).subscribe({
          next: () => {
            if (inv.parentWhatsAppPhone) {
              const rawPhone = inv.parentWhatsAppPhone.replace(/\D/g, '');
              const formattedPhone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;
              let textMsg = '';
              if (isPaid) {
                textMsg = `*FEE PAYMENT RECEIPT*\nDear Parent, Payment of *₹${inv.totalAmount}* for *${inv.studentName}* (Invoice #${inv.invoiceNumber} - ${inv.title}) has been received & settled.\nRemaining Balance: *₹0.00*.\n\nThank you for choosing Apex Coaching Academy!`;
              } else {
                textMsg = `*FEE DUE REMINDER*\nDear Parent, This is a gentle reminder that fee of *₹${inv.dueAmount}* for *${inv.studentName}* (Invoice #${inv.invoiceNumber}) is pending.\nKindly pay at the earliest.\n\nThank you!`;
              }
              const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(textMsg)}`;
              window.open(waUrl, '_blank');
            }

            this.confirmDialog.alert('WhatsApp Dispatched', `WhatsApp message opened for ${inv.parentWhatsAppPhone}!`, 'success');
          },
          error: (err) => {
            this.confirmDialog.alert('Dispatch Failed', err?.error?.message || 'Error sending WhatsApp message', 'danger');
          }
        });
      }
    });
  }

  confirmCancelInvoice(inv: FeeInvoicePagedItem): void {
    const dialogRef = this.dialog.open(CancelInvoiceDialogComponent, {
      width: '520px',
      data: {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        title: inv.title,
        studentName: inv.studentName,
        rollNumber: inv.rollNumber,
        batchName: inv.batchName,
        totalAmount: inv.totalAmount,
        paidAmount: inv.paidAmount,
        dueAmount: inv.dueAmount
      }
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res?.cancelled) {
        this.confirmDialog.alert(
          'Invoice Cancelled',
          `Invoice ${inv.invoiceNumber} has been successfully cancelled and marked as VOID.\nReason: ${res.reason}\n\nOutstanding dues for ${inv.studentName} have been recalculated.`,
          'success'
        );
        this.loadInvoices();
      }
    });
  }
}
