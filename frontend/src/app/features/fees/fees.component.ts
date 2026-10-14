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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { FeesService, FeeInvoicePagedItem, FeePaymentReceipt, PendingInvoicingStudent } from '../../core/services/fees.service';
import { BatchesService, BatchDto } from '../../core/services/batches.service';
import { SchoolService, SchoolClassDto } from '../../core/services/school.service';
import { AuthService } from '../../core/services/auth.service';
import { HostelService } from '../../core/services/hostel.service';
import { FeeCollectionDialogComponent } from './fee-collection-dialog.component';
import { FeeReceiptDialogComponent } from './fee-receipt-dialog.component';
import { FeeDueReceiptDialogComponent } from './fee-due-receipt-dialog.component';
import { StudentLedgerDialogComponent } from './student-ledger-dialog.component';
import { GenerateInvoicesDialogComponent } from './generate-invoices-dialog.component';
import { CancelInvoiceDialogComponent } from './cancel-invoice-dialog.component';
import { FeeMasterDialogComponent } from './fee-master-dialog.component';
import { EditInvoiceDialogComponent } from './edit-invoice-dialog.component';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { QuickSettingsService } from '../../core/services/quick-settings.service';

export interface UpcomingBillingCycleInfo {
  month: number;
  year: number;
  monthName: string;
  daysRemaining: number;
  uninvoicedStudentsCount: number;
  defaultDueDate: string;
  students: PendingInvoicingStudent[];
}

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
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatDividerModule
  ],
  template: `
    <div class="fees-wrapper">
      <!-- Page Title & Header Actions -->
      <div class="header-actions">
        <div class="header-text-group">
          <h2>Fee Collection & Dues Management</h2>
          <p>Record fee payments with FIFO auto-settlement, issue digital WhatsApp receipts, and track student ledger passbooks.</p>
        </div>
        <div class="header-action-buttons">
          <button mat-stroked-button class="fee-master-btn" (click)="openFeeMasterModal()">
            <mat-icon color="primary">tune</mat-icon>
            <span>Fee Heads & Structure</span>
          </button>
          <button mat-raised-button color="primary" class="generate-btn" (click)="openGenerateInvoicesModal()">
            <mat-icon>post_add</mat-icon>
            <span>Generate Monthly Invoices</span>
            <span class="autopilot-chip" *ngIf="settingsService.autoPilotInvoicing()" matTooltip="Auto-Pilot Mode Active (Auto-bills on 25th of month)">🤖 Auto-Pilot ON</span>
          </button>
        </div>
      </div>

      <!-- Smart Alert Banner: New Admissions Awaiting Invoicing -->
      <div class="pending-invoicing-banner" *ngIf="pendingStudents.length > 0 && !bannerDismissed">
        <div class="banner-left">
          <div class="banner-badge-icon">
            <mat-icon>notification_important</mat-icon>
          </div>
          <div class="banner-text">
            <div class="banner-title-row">
              <span class="banner-pill">{{ pendingStudents.length }} NEW {{ pendingStudents.length === 1 ? 'ADMISSION' : 'ADMISSIONS' }}</span>
              <strong class="banner-heading">Awaiting Fee Invoicing for {{ getCurrentMonthYearName() }}</strong>
            </div>
            <div class="banner-students-list">
              <span class="student-item-tag clickable" *ngFor="let s of pendingStudents" (click)="generateForPendingStudent(s)" matTooltip="Click to open invoice generator for {{ s.studentName }}">
                <strong>{{ s.studentName }}</strong>
                <span class="sub-info">({{ s.className || s.batchName || 'General' }} • Roll: {{ s.rollNumber }})</span>
                <mat-icon class="tag-click-icon">open_in_new</mat-icon>
              </span>
            </div>
          </div>
        </div>
        <div class="banner-actions">
          <button mat-raised-button color="accent" class="quick-gen-btn" (click)="pendingStudents.length === 1 ? generateForPendingStudent(pendingStudents[0]) : generateForAllPending()">
            <mat-icon>post_add</mat-icon>
            <span *ngIf="pendingStudents.length === 1">Generate Invoice for {{ pendingStudents[0].studentName }}</span>
            <span *ngIf="pendingStudents.length > 1">Generate Invoices ({{ pendingStudents.length }} Admissions)</span>
          </button>
          <button mat-icon-button class="dismiss-btn" (click)="dismissBanner()" matTooltip="Hide alert for now">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Upcoming Billing Cycle Alert Banner: Preparation & 7-Day Advance Alert -->
      <div class="upcoming-cycle-banner" *ngIf="upcomingCycle && upcomingCycle.uninvoicedStudentsCount > 0 && !upcomingBannerDismissed">
        <div class="banner-left">
          <div class="banner-badge-icon">
            <mat-icon>calendar_month</mat-icon>
          </div>
          <div class="banner-text">
            <div class="banner-title-row">
              <span class="banner-pill-upcoming">UPCOMING BILLING CYCLE</span>
              <strong class="banner-heading">{{ upcomingCycle.monthName }} {{ upcomingCycle.year }} Fee Collection Preparation</strong>
              <span class="banner-badge-count">📢 {{ upcomingCycle.uninvoicedStudentsCount }} {{ upcomingCycle.uninvoicedStudentsCount === 1 ? 'Student' : 'Students' }} Awaiting Invoicing</span>
            </div>
            <p class="banner-subtitle">
              Current cycle is settled. Pre-generate {{ upcomingCycle.monthName }} monthly invoices now so automated WhatsApp fee reminders (7-day advance notice) can dispatch to parents before the due date ({{ upcomingCycle.defaultDueDate | date:'dd MMM yyyy' }}).
            </p>
            <div class="banner-students-list" *ngIf="upcomingCycle.students.length > 0">
              <span class="student-item-tag" *ngFor="let s of upcomingCycle.students | slice:0:6" matTooltip="Awaiting {{ upcomingCycle.monthName }} Invoice">
                <strong>{{ s.studentName }}</strong>
                <span class="sub-info">({{ s.className || s.batchName || 'General' }} • Roll: {{ s.rollNumber }})</span>
              </span>
              <span class="more-tag" *ngIf="upcomingCycle.students.length > 6">
                +{{ upcomingCycle.students.length - 6 }} more students
              </span>
            </div>
          </div>
        </div>
        <div class="banner-actions">
          <button mat-raised-button color="primary" class="quick-gen-btn" (click)="openGenerateInvoicesForUpcomingCycle()">
            <mat-icon>bolt</mat-icon>
            <span>Generate {{ upcomingCycle.monthName }} Invoices (1-Click)</span>
          </button>
          <button mat-icon-button class="dismiss-btn" (click)="dismissUpcomingBanner()" matTooltip="Hide alert for now">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Main Invoices Directory Card -->
      <mat-card class="table-card mat-elevation-z2">
        <!-- Filter Toolbar -->
        <div class="filter-toolbar">
          <mat-form-field appearance="outline" class="search-field">
            <mat-icon matPrefix class="search-prefix-icon">search</mat-icon>
            <mat-label>Search Invoices, Students, Phone...</mat-label>
            <input
              matInput
              [(ngModel)]="searchTerm"
              (keyup.enter)="onSearch()"
              placeholder="e.g. Mantosh, INV-2026, 95405..."
            />
            <button mat-icon-button matSuffix *ngIf="searchTerm" (click)="searchTerm = ''; onSearch()" aria-label="Clear">
              <mat-icon>close</mat-icon>
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

          <mat-form-field appearance="outline" class="class-filter" *ngIf="hasSchoolModule">
            <mat-label>Filter by School Class</mat-label>
            <mat-select [(ngModel)]="selectedClassFilter" (selectionChange)="onFilterChange()" panelClass="class-filter-panel">
              <mat-option value="">All School Classes</mat-option>
              <mat-option *ngFor="let c of schoolClasses" [value]="c.id">
                🏫 {{ c.name }} {{ c.code ? '(' + c.code + ')' : '' }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="batch-filter" *ngIf="hasCoachingModule">
            <mat-label>Filter by Coaching Batch</mat-label>
            <mat-select [(ngModel)]="selectedBatchFilter" (selectionChange)="onFilterChange()" panelClass="batch-filter-panel">
              <mat-option value="">All Coaching Batches</mat-option>
              <mat-option *ngFor="let b of batches" [value]="b.id">
                🎯 {{ b.name }}
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
              <th mat-header-cell *matHeaderCellDef>Class &amp; Batch</th>
              <td mat-cell *matCellDef="let inv">
                <div class="academic-enrollment-cell">
                  <div *ngIf="inv.className" class="academic-row school-row" matTooltip="Billed School Class">
                    <span class="badge-icon">🏫</span>
                    <span class="academic-val">{{ inv.className }}<span *ngIf="inv.sectionName" class="sec-tag"> ({{ inv.sectionName }})</span></span>
                  </div>
                  <div *ngIf="inv.currentClassName && inv.className && inv.currentClassName !== inv.className" class="academic-row current-class-row" matTooltip="Student Promoted to higher class">
                    <span class="badge-icon">🚀</span>
                    <span class="academic-val">Now in {{ inv.currentClassName }}<span *ngIf="inv.currentSectionName" class="sec-tag"> ({{ inv.currentSectionName }})</span></span>
                  </div>
                  <div *ngIf="inv.batchName" class="academic-row batch-row" matTooltip="Enrolled Coaching Batch">
                    <span class="badge-icon">🎯</span>
                    <span class="academic-val">{{ inv.batchName }}</span>
                  </div>
                  <div *ngIf="!inv.className && !inv.batchName" class="text-muted" style="font-size: 0.8rem;">
                    Unassigned
                  </div>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="title">
              <th mat-header-cell *matHeaderCellDef class="col-billing-head">Billing Period / Heads</th>
              <td mat-cell *matCellDef="let inv" class="col-billing-head">
                <div class="billing-head-container">
                  <ng-container *ngIf="formatBillingTitle(inv.title) as ft">
                    <span class="period-badge" [class.is-multiline]="!!ft.line2">
                      <mat-icon class="period-icon">calendar_month</mat-icon>
                      <span class="period-lines">
                        <span class="period-line-1">{{ ft.line1 }}</span>
                        <span class="period-line-2" *ngIf="ft.line2">{{ ft.line2 }}</span>
                      </span>
                    </span>
                  </ng-container>
                  <div *ngIf="inv.items && inv.items.length > 0" class="mini-heads-row">
                    <ng-container *ngFor="let it of inv.items; let i = index">
                      <span *ngIf="i < 2" class="mini-head-chip">
                        {{ it.headName }}: ₹{{ it.amount | number:'1.0-0' }}
                      </span>
                    </ng-container>
                    <span *ngIf="inv.items.length > 2" class="mini-head-more" [matTooltip]="getRemainingHeadsTooltip(inv.items)">
                      +{{ inv.items.length - 2 }} more
                    </span>
                  </div>
                </div>
              </td>
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
              <th mat-header-cell *matHeaderCellDef mat-sort-header="dueDate" class="col-due-date">Due Date</th>
              <td mat-cell *matCellDef="let inv" class="col-due-date">
                <span class="due-date-pill">{{ inv.dueDate | date:'dd-MMM-yyyy' }}</span>
              </td>
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
              <th mat-header-cell *matHeaderCellDef class="text-center col-actions">Actions</th>
              <td mat-cell *matCellDef="let inv" class="text-center col-actions">
                <div class="smart-action-group">
                  <!-- 3-Dots Action Menu Trigger -->
                  <button
                    mat-icon-button
                    [matMenuTriggerFor]="actionMenu"
                    class="btn-more-dots"
                    matTooltip="Options & Actions"
                    aria-label="Actions Menu">
                    <mat-icon>more_vert</mat-icon>
                  </button>

                  <!-- 3-Dots Menu (Lazy rendered by Angular Material) -->
                  <mat-menu #actionMenu="matMenu" xPosition="before" class="smart-fees-menu">
                    <!-- Collect Fee -->
                    <button
                      *ngIf="inv.dueAmount > 0 && inv.status !== 'Cancelled'"
                      mat-menu-item
                      (click)="openCollectFeeModal(inv)">
                      <mat-icon class="menu-icon-blue">payments</mat-icon>
                      <span>Collect Fee (फीस जमा करें)</span>
                    </button>

                    <!-- Due Receipt / Demand Notice -->
                    <button
                      *ngIf="inv.dueAmount > 0 && inv.status !== 'Cancelled'"
                      mat-menu-item
                      (click)="openDueReceiptModal(inv)">
                      <mat-icon class="menu-icon-amber">receipt_long</mat-icon>
                      <span>Print Due Slip (बकाया पर्ची)</span>
                    </button>

                    <!-- View / Print Paid Receipt -->
                    <button
                      *ngIf="inv.status === 'Paid'"
                      mat-menu-item
                      (click)="openReceiptForInvoice(inv)">
                      <mat-icon class="menu-icon-green">receipt</mat-icon>
                      <span>Print Payment Receipt (रसीद)</span>
                    </button>

                    <!-- Send WhatsApp Receipt / Reminder -->
                    <button
                      *ngIf="inv.status !== 'Cancelled'"
                      mat-menu-item
                      (click)="sendReminder(inv)">
                      <mat-icon class="menu-icon-green">chat</mat-icon>
                      <span>{{ inv.dueAmount > 0 ? 'Send WhatsApp Due Notice' : 'Send WhatsApp Paid Receipt' }}</span>
                    </button>

                    <!-- Student Ledger / Passbook -->
                    <button
                      mat-menu-item
                      (click)="openStudentLedger(inv.studentId)">
                      <mat-icon class="menu-icon-rose">menu_book</mat-icon>
                      <span>Student Ledger & Passbook</span>
                    </button>

                    <!-- Edit / Add Fee Heads -->
                    <button
                      *ngIf="inv.status === 'Pending' && inv.paidAmount === 0"
                      mat-menu-item
                      (click)="openEditInvoiceModal(inv)">
                      <mat-icon class="menu-icon-purple">edit_note</mat-icon>
                      <span>Edit / Add Fee Heads</span>
                    </button>

                    <!-- Cancel Invoice -->
                    <ng-container *ngIf="inv.status === 'Pending' || inv.status === 'Partial'">
                      <mat-divider></mat-divider>
                      <button
                        mat-menu-item
                        class="cancel-menu-item"
                        (click)="confirmCancelInvoice(inv)">
                        <mat-icon class="menu-icon-red">cancel</mat-icon>
                        <span class="text-danger">Cancel Invoice (रद्द करें)</span>
                      </button>
                    </ng-container>
                  </mat-menu>
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
    .header-action-buttons {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;

      .fee-master-btn {
        height: 44px;
        font-weight: 600;
        border-radius: 8px;
        border-color: #cbd5e1;
        background: #ffffff;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #1e293b;
        &:hover {
          background: #f8fafc;
          border-color: #94a3b8;
        }
      }
    }
    .billing-head-container {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 4px 0;
    }
    .period-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.73rem;
      font-weight: 600;
      color: #1e40af;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 2px 8px;
      border-radius: 12px;
      width: fit-content;
      line-height: 1.25;
      white-space: nowrap;

      &.is-multiline {
        align-items: flex-start;
        padding: 4px 10px;
        white-space: normal;
        border-radius: 8px;

        .period-icon {
          margin-top: 2px;
        }

        .period-lines {
          display: flex;
          flex-direction: column;
          gap: 1px;
          line-height: 1.35;
        }

        .period-line-1 {
          font-weight: 700;
          color: #1e3a8a;
        }

        .period-line-2 {
          font-weight: 500;
          color: #2563eb;
        }
      }

      .period-icon {
        font-size: 13px;
        width: 13px;
        height: 13px;
        color: #3b82f6;
        flex-shrink: 0;
      }
    }
    .mini-heads-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 2px;

      .mini-head-chip {
        font-size: 0.7rem;
        background: #f0fdf4;
        color: #15803d;
        border: 1px solid #bbf7d0;
        padding: 1px 6px;
        border-radius: 8px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        white-space: nowrap;
        box-shadow: 0 1px 2px rgba(0,0,0,0.02);
      }

      .mini-head-more {
        font-size: 0.68rem;
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
        padding: 1px 6px;
        border-radius: 8px;
        font-weight: 700;
        cursor: help;
        display: inline-flex;
        align-items: center;
        white-space: nowrap;
      }
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

      .autopilot-chip {
        background: #10b981;
        color: #ffffff;
        font-size: 0.68rem;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 10px;
        margin-left: 4px;
        letter-spacing: 0.02em;
        box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        display: inline-flex;
        align-items: center;
      }
    }
    .pending-invoicing-banner {
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
      border: 1.5px solid #fde68a;
      border-left: 5px solid #f59e0b;
      border-radius: 10px;
      padding: 12px 18px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      box-shadow: 0 2px 8px rgba(245, 158, 11, 0.12);
      animation: fadeIn 0.25s ease-in-out;

      .banner-left {
        display: flex;
        align-items: center;
        gap: 14px;
        flex: 1;
        min-width: 280px;

        .banner-badge-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: #fef3c7;
          border: 1px solid #fcd34d;
          color: #d97706;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;

          mat-icon {
            font-size: 22px;
            width: 22px;
            height: 22px;
          }
        }

        .banner-text {
          display: flex;
          flex-direction: column;
          gap: 4px;

          .banner-title-row {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;

            .banner-pill {
              background: #d97706;
              color: #ffffff;
              font-size: 0.68rem;
              font-weight: 800;
              letter-spacing: 0.05em;
              padding: 2px 7px;
              border-radius: 12px;
              text-transform: uppercase;
            }

            .banner-heading {
              font-size: 0.92rem;
              color: #92400e;
            }
          }

          .banner-students-list {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;

            .student-item-tag {
              font-size: 0.82rem;
              color: #78350f;
              background: rgba(255, 255, 255, 0.65);
              padding: 2px 8px;
              border-radius: 6px;
              border: 1px solid #fde68a;
              display: inline-flex;
              align-items: center;
              gap: 4px;
              transition: all 0.15s ease;

              &.clickable {
                cursor: pointer;

                &:hover {
                  background: #ffffff;
                  border-color: #d97706;
                  box-shadow: 0 2px 5px rgba(217, 119, 6, 0.15);
                  transform: translateY(-1px);
                }
              }

              .tag-click-icon {
                font-size: 13px;
                width: 13px;
                height: 13px;
                color: #d97706;
              }

              .sub-info {
                color: #b45309;
                margin-left: 4px;
                font-size: 0.76rem;
              }
            }
          }
        }
      }

      .banner-actions {
        display: flex;
        align-items: center;
        gap: 8px;

        .quick-gen-btn {
          font-weight: 700;
          border-radius: 8px;
          height: 38px;
          padding: 0 16px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #d97706;
          color: #ffffff;
          box-shadow: 0 2px 6px rgba(217, 119, 6, 0.3);
          transition: all 0.15s ease;

          &:hover {
            background: #b45309;
          }

          .btn-spinner {
            display: inline-block;
            margin-right: 4px;
          }
        }

        .dismiss-btn {
          color: #92400e;
          width: 32px;
          height: 32px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      }
    }

    .upcoming-cycle-banner {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1.5px solid #bfdbfe;
      border-left: 5px solid #2563eb;
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
      animation: fadeIn 0.25s ease-in-out;

      .banner-left {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        flex: 1;
        min-width: 280px;

        .banner-badge-icon {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: #2563eb;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 8px rgba(37, 99, 235, 0.25);
          margin-top: 2px;

          mat-icon {
            font-size: 24px;
            width: 24px;
            height: 24px;
          }
        }

        .banner-text {
          display: flex;
          flex-direction: column;
          gap: 6px;

          .banner-title-row {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;

            .banner-pill-upcoming {
              background: #1e40af;
              color: #ffffff;
              font-size: 0.68rem;
              font-weight: 800;
              letter-spacing: 0.05em;
              padding: 2px 8px;
              border-radius: 12px;
              text-transform: uppercase;
            }

            .banner-heading {
              font-size: 0.95rem;
              font-weight: 700;
              color: #1e3a8a;
            }

            .banner-badge-count {
              background: #fef3c7;
              color: #b45309;
              border: 1px solid #fde68a;
              font-size: 0.72rem;
              font-weight: 700;
              padding: 2px 8px;
              border-radius: 12px;
            }
          }

          .banner-subtitle {
            color: #2563eb;
            font-size: 0.82rem;
            margin: 0;
            line-height: 1.45;
          }

          .banner-students-list {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 2px;

            .student-item-tag {
              font-size: 0.78rem;
              color: #1e40af;
              background: rgba(255, 255, 255, 0.85);
              padding: 2px 8px;
              border-radius: 6px;
              border: 1px solid #bfdbfe;
              display: inline-flex;
              align-items: center;
              gap: 4px;

              .sub-info {
                color: #3b82f6;
                font-size: 0.73rem;
              }
            }

            .more-tag {
              font-size: 0.75rem;
              font-weight: 600;
              color: #1e40af;
              background: #dbeafe;
              padding: 2px 7px;
              border-radius: 6px;
            }
          }
        }
      }

      .banner-actions {
        display: flex;
        align-items: center;
        gap: 8px;

        .quick-gen-btn {
          font-weight: 600;
          border-radius: 8px;
          height: 38px;
          padding: 0 16px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
          transition: all 0.15s ease;

          &:hover {
            background: #1d4ed8;
          }
        }

        .dismiss-btn {
          color: #64748b;
          width: 32px;
          height: 32px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;

          &:hover {
            color: #1e293b;
          }
        }
      }
    }

    .table-card {
      border-radius: 8px;
      overflow: hidden;
      position: relative;
    }
    .filter-toolbar {
      padding: 16px 20px 8px 20px;
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;

      .search-field { 
        flex: 2 1 240px;
        min-width: 200px;
        .search-prefix-icon {
          color: #64748b;
          margin-right: 6px;
        }
      }
      .status-filter {
        flex: 1 1 140px;
        min-width: 130px;
      }
      .class-filter {
        flex: 1.2 1 180px;
        min-width: 160px;
      }
      .batch-filter {
        flex: 1.2 1 190px;
        min-width: 170px;
      }
    }
    .academic-enrollment-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 3px 0;

      .academic-row {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.76rem;
        padding: 2px 7px;
        border-radius: 6px;
        width: fit-content;
        line-height: 1.25;

        &.school-row {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #dbeafe;
          font-weight: 600;
          .sec-tag {
            color: #3b82f6;
            font-weight: 500;
          }
        }

        &.current-class-row {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
          font-weight: 600;
          font-size: 0.73rem;
          .sec-tag {
            color: #059669;
            font-weight: 500;
          }
        }

        &.batch-row {
          background: #faf5ff;
          color: #7e22ce;
          border: 1px solid #f3e8ff;
          font-weight: 600;
        }

        .badge-icon {
          font-size: 0.82rem;
          line-height: 1;
        }
      }
    }
    .grid-loader { margin-top: 4px; }
    .table-container {
      padding: 0;
      overflow-x: auto;
      width: 100%;
      position: relative;
    }
    .full-width {
      width: 100%;
      min-width: 100%;
      border-collapse: collapse;
    }

    /* Compact ERP Table Cells */
    .mat-mdc-table .mat-mdc-cell,
    .mat-mdc-table .mat-mdc-header-cell {
      padding: 7px 8px !important;
    }

    .select-col,
    .mat-column-select {
      width: 36px !important;
      min-width: 36px !important;
      padding: 0 4px 0 8px !important;
      text-align: center !important;
    }

    .mat-column-invoiceNumber {
      white-space: nowrap !important;
      font-size: 0.8rem;
      font-weight: 700;
      color: #1e3a8a;
      width: 105px;
      min-width: 95px;
    }

    .mat-column-studentName {
      min-width: 105px;
      .st-name-text {
        font-weight: 700;
        color: #0f172a;
        font-size: 0.84rem;
        white-space: nowrap;
      }
      .st-roll-text {
        color: #64748b;
        font-size: 0.74rem;
      }
    }

    .mat-column-batchName {
      min-width: 85px;
    }

    .col-billing-head,
    .mat-column-title {
      min-width: 140px;
    }

    .mat-column-totalAmount,
    .mat-column-paidAmount,
    .mat-column-dueAmount {
      white-space: nowrap !important;
      min-width: 68px;
      font-size: 0.83rem;
    }

    .col-due-date,
    .mat-column-dueDate {
      white-space: nowrap !important;
      min-width: 80px !important;
      width: 82px;

      .due-date-pill {
        white-space: nowrap !important;
        font-weight: 500;
        color: #334155;
        font-size: 0.78rem;
        display: inline-block;
      }
    }

    .mat-column-status {
      white-space: nowrap !important;
      min-width: 68px !important;
      text-align: center;
      .status-badge {
        padding: 2px 7px;
        font-size: 0.7rem;
      }
    }

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

    /* PERMANENT STICKY RIGHT ACTIONS COLUMN (Zero horizontal scroll needed!) */
    .col-actions,
    .mat-column-actions {
      position: sticky !important;
      right: 0 !important;
      background: #ffffff !important;
      z-index: 10 !important;
      box-shadow: -4px 0 8px -2px rgba(0, 0, 0, 0.08) !important;
      width: 48px !important;
      min-width: 48px !important;
      max-width: 50px !important;
      white-space: nowrap !important;
      text-align: center !important;
      padding: 0 4px !important;
    }

    th.col-actions,
    th.mat-column-actions {
      position: sticky !important;
      right: 0 !important;
      background: #f8fafc !important;
      z-index: 11 !important;
      box-shadow: -4px 0 8px -2px rgba(0, 0, 0, 0.08) !important;
      text-align: center !important;
    }

    tr.mat-mdc-row:hover .mat-column-actions {
      background: #f1f5f9 !important;
    }

    .smart-action-group {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;

      .btn-more-dots {
        width: 32px !important;
        height: 32px !important;
        min-width: 32px !important;
        padding: 0 !important;
        border-radius: 6px !important;
        color: #475569;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        transition: all 0.15s ease;

        mat-icon {
          font-size: 19px !important;
          width: 19px !important;
          height: 19px !important;
          line-height: 19px !important;
        }

        &:hover {
          background: #e0e7ff;
          color: #1e40af;
          border-color: #c7d2fe;
          transform: scale(1.05);
        }
      }
    }

    .menu-icon-blue { color: #2563eb !important; }
    .menu-icon-amber { color: #d97706 !important; }
    .menu-icon-green { color: #16a34a !important; }
    .menu-icon-rose { color: #e11d48 !important; }
    .menu-icon-purple { color: #7c3aed !important; }
    .menu-icon-red { color: #dc2626 !important; }

    .cancel-menu-item {
      &:hover {
        background-color: #fef2f2 !important;
      }
      .text-danger {
        color: #dc2626;
        font-weight: 500;
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

    /* All Mode Responsive Layout Rules */
    @media (max-width: 1024px) {
      .filter-toolbar {
        gap: 8px;
        .search-field { flex: 2 1 200px; }
        .status-filter { flex: 1 1 120px; }
        .class-filter { flex: 1 1 150px; }
        .batch-filter { flex: 1 1 160px; }
      }
    }

    @media (max-width: 768px) {
      .header-actions {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;

        .header-action-buttons {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;

          button {
            width: 100%;
            justify-content: center;
          }
        }
      }

      .filter-toolbar {
        padding: 12px 14px 0 14px;
        flex-direction: column;
        align-items: stretch;

        .search-field,
        .status-filter,
        .class-filter,
        .batch-filter {
          width: 100% !important;
          min-width: 100% !important;
          flex: none;
        }
      }

      .multi-collect-bar {
        width: calc(100% - 24px);
        max-width: 500px;
        flex-direction: column;
        gap: 10px;
        padding: 12px 16px;
        border-radius: 16px;

        .bar-center {
          border: none;
          padding: 0;
        }

        .bar-right {
          width: 100%;
          justify-content: space-between;
        }
      }
    }
  `]
})
export class FeesComponent implements OnInit, OnDestroy {
  invoices: FeeInvoicePagedItem[] = [];
  batches: BatchDto[] = [];
  schoolClasses: SchoolClassDto[] = [];
  loading = false;
  private refreshSub?: Subscription;

  pendingStudents: PendingInvoicingStudent[] = [];
  loadingPending = false;
  generatingPending = false;
  bannerDismissed = false;

  upcomingCycle: UpcomingBillingCycleInfo | null = null;
  upcomingBannerDismissed = false;
  loadingUpcoming = false;

  pageIndex = 0;
  pageSize = 10;
  totalCount = 0;
  searchTerm = '';
  selectedStatusFilter = '';
  selectedBatchFilter = '';
  selectedClassFilter = '';
  sortBy = 'createdAt';
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
      width: '640px',
      maxWidth: '96vw',
      data: {
        studentId: first.studentId,
        studentName: first.studentName,
        rollNumber: first.rollNumber,
        className: first.className,
        sectionName: first.sectionName,
        batchName: first.batchName,
        parentWhatsAppPhone: first.parentWhatsAppPhone,
        totalOutstandingDue: totalAmount,
        initialAmount: totalAmount,
        selectedInvoicesCount: invCount,
        selectedInvoicesDetails: invTitles,
        branchName: this.authService.getCurrentBranchName()
      }
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res) {
        this.clearSelection();
        this.loadInvoices();

        // Immediately open official Fee Payment Receipt Dialog
        this.dialog.open(FeeReceiptDialogComponent, {
          width: '840px',
          maxWidth: '96vw',
          panelClass: 'receipt-dialog-panel',
          data: {
            receipt: res,
            instituteName: this.authService.currentUser()?.instituteName || 'Apex Coaching Academy',
            branchName: this.authService.getCurrentBranchName()
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
    private schoolService: SchoolService,
    private confirmDialog: ConfirmDialogService,
    private authService: AuthService,
    private hostelService: HostelService,
    public settingsService: QuickSettingsService,
    private dialog: MatDialog
  ) {}

  get hasSchoolModule(): boolean { return this.authService.hasSchoolModule(); }
  get hasCoachingModule(): boolean { return this.authService.hasCoachingModule(); }
  get hasHostelModule(): boolean { return this.authService.hasHostelModule(); }
  get hasLibraryModule(): boolean { return this.authService.hasLibraryModule(); }
  get hasTransportModule(): boolean { return this.authService.hasTransportModule(); }

  ngOnInit(): void {
    if (this.hasCoachingModule) this.loadBatches();
    if (this.hasSchoolModule) this.loadSchoolClasses();
    this.loadInvoices();
    this.loadPendingStudents();
    this.loadUpcomingBillingCycle();

    this.refreshSub = this.feesService.refreshRequired$.subscribe(() => {
      this.loadInvoices();
      this.loadPendingStudents();
      this.loadUpcomingBillingCycle();
    });
  }

  formatBillingTitle(title: string): { line1: string; line2?: string } {
    if (!title) return { line1: '' };
    // Check if title has a range (dash/hyphen/en-dash) and mentions Quarterly or Half-Yearly
    const isMultiPeriod = /quarterly|half\s*-?\s*yearly/i.test(title);
    if (isMultiPeriod) {
      // Split on en-dash (–), em-dash (—), or hyphen (-)
      const match = title.match(/^(.+?)\s*([–—-]\s*)(.+)$/);
      if (match) {
        return {
          line1: match[1].trim() + ' –',
          line2: match[3].trim()
        };
      }
    }
    return { line1: title };
  }

  getRemainingHeadsTooltip(items?: any[]): string {
    if (!items || items.length <= 2) return '';
    return items.slice(2).map(it => `${it.headName}: ₹${it.amount}`).join('\n');
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

  loadSchoolClasses(): void {
    this.schoolService.getClasses().subscribe({
      next: (data) => (this.schoolClasses = data),
      error: (err) => console.error('Error fetching school classes:', err)
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
        this.selectedClassFilter,
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
    if (!sortState.direction) {
      this.sortBy = 'createdAt';
      this.sortDescending = true;
    } else {
      this.sortBy = sortState.active;
      this.sortDescending = sortState.direction === 'desc';
    }
    this.pageIndex = 0;
    this.loadInvoices();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadInvoices();
  }

  openCollectFeeModal(inv: FeeInvoicePagedItem): void {
    // Lookup active hostel allocation for this student to show bed info in dialog
    this.hostelService.getAllocations('Active', inv.studentId).subscribe({
      next: (allocations) => {
        const alloc = allocations.find(a => a.studentId === inv.studentId);
        const hostelInfo = alloc
          ? `${alloc.hostelName} - Rm ${alloc.roomNumber} (Bed ${alloc.bedCode})`
          : undefined;

        const dialogRef = this.dialog.open(FeeCollectionDialogComponent, {
          width: '740px',
          maxWidth: '96vw',
          data: {
            studentId: inv.studentId,
            studentName: inv.studentName,
            rollNumber: inv.rollNumber,
            className: inv.className,
            sectionName: inv.sectionName,
            batchName: inv.batchName,
            parentWhatsAppPhone: inv.parentWhatsAppPhone,
            totalOutstandingDue: inv.dueAmount,
            hostelInfo,
            items: inv.items,
            branchName: inv.branchName || this.authService.getCurrentBranchName(),
            invoiceDueDate: inv.dueDate,
            invoiceTitle: inv.title
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
                instituteName: this.authService.currentUser()?.instituteName || 'Apex Coaching Academy',
                branchName: res.branchName || inv.branchName || this.authService.getCurrentBranchName()
              }
            });
          }
        });
      },
      error: () => {
        // If allocation lookup fails, still open dialog without hostel info
        const dialogRef = this.dialog.open(FeeCollectionDialogComponent, {
          width: '740px',
          maxWidth: '96vw',
          data: {
            studentId: inv.studentId,
            studentName: inv.studentName,
            rollNumber: inv.rollNumber,
            className: inv.className,
            sectionName: inv.sectionName,
            batchName: inv.batchName,
            parentWhatsAppPhone: inv.parentWhatsAppPhone,
            totalOutstandingDue: inv.dueAmount,
            items: inv.items,
            branchName: inv.branchName || this.authService.getCurrentBranchName(),
            invoiceDueDate: inv.dueDate,
            invoiceTitle: inv.title
          }
        });

        dialogRef.afterClosed().subscribe((res: FeePaymentReceipt | undefined) => {
          if (res) {
            this.loadInvoices();
            this.dialog.open(FeeReceiptDialogComponent, {
              width: '840px',
              maxWidth: '96vw',
              panelClass: 'receipt-dialog-panel',
              data: {
                receipt: res,
                instituteName: this.authService.currentUser()?.instituteName || 'Apex Coaching Academy',
                branchName: res.branchName || inv.branchName || this.authService.getCurrentBranchName()
              }
            });
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
        instituteName: this.authService.currentUser()?.instituteName || 'Apex Coaching Academy',
        branchName: inv.branchName || this.authService.getCurrentBranchName()
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
          this.feesService.getReceiptByNumber(payment.receiptNumber).subscribe({
            next: (receipt) => {
              this.dialog.open(FeeReceiptDialogComponent, {
                width: '840px',
                maxWidth: '96vw',
                panelClass: 'receipt-dialog-panel',
                data: {
                  receipt,
                  instituteName: this.authService.currentUser()?.instituteName || 'Apex Coaching Academy',
                  branchName: receipt.branchName || inv.branchName || ledger.branchName || this.authService.getCurrentBranchName()
                }
              });
            },
            error: () => {
              const fallbackItems = inv.items && inv.items.length > 0
                ? inv.items.map((it, idx) => ({
                    itemIndex: idx + 1,
                    particulars: it.headName,
                    subTitle: inv.title,
                    reference: inv.invoiceNumber,
                    amount: it.amount
                  }))
                : [{
                    itemIndex: 1,
                    particulars: inv.title || 'Tuition & Coaching Fee Settlement',
                    subTitle: 'Fee Payment',
                    reference: inv.invoiceNumber,
                    amount: payment.amountPaid
                  }];

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
                remarks: payment.remarks,
                items: fallbackItems,
                branchName: inv.branchName || ledger.branchName || this.authService.getCurrentBranchName()
              };

              this.dialog.open(FeeReceiptDialogComponent, {
                width: '840px',
                maxWidth: '96vw',
                panelClass: 'receipt-dialog-panel',
                data: {
                  receipt: receiptData,
                  instituteName: this.authService.currentUser()?.instituteName || 'Apex Coaching Academy',
                  branchName: inv.branchName || ledger.branchName || this.authService.getCurrentBranchName()
                }
              });
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

  openGenerateInvoicesModal(targetStudent?: PendingInvoicingStudent): void {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    const dialogRef = this.dialog.open(GenerateInvoicesDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      data: {
        batches: this.batches,
        classes: this.schoolClasses,
        defaultBatchId: targetStudent?.batchId || this.selectedBatchFilter,
        defaultClassId: targetStudent?.classId || this.selectedClassFilter,
        targetStudentId: targetStudent?.studentId,
        targetStudentName: targetStudent?.studentName,
        targetRollNumber: targetStudent?.rollNumber,
        defaultMonth: currentMonth,
        defaultYear: currentYear
      }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.confirmDialog.alert(
          'Invoices Generated',
          result.message || `Successfully generated invoice(s).`,
          'success'
        );
        this.pageIndex = 0;
        this.loadInvoices();
        this.loadPendingStudents();
      }
    });
  }

  openFeeMasterModal(): void {
    const dialogRef = this.dialog.open(FeeMasterDialogComponent, {
      width: '1150px',
      maxWidth: '96vw',
      disableClose: false,
      autoFocus: false,
      restoreFocus: false
    });

    dialogRef.afterClosed().subscribe(() => {
      this.loadInvoices();
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

  openEditInvoiceModal(inv: FeeInvoicePagedItem): void {
    const studentBatch = this.batches.find(b => b.name === inv.batchName);
    const dialogRef = this.dialog.open(EditInvoiceDialogComponent, {
      width: '860px',
      maxWidth: '96vw',
      data: {
        invoice: inv,
        standardMonthlyFee: studentBatch?.standardMonthlyFee
      }
    });

    dialogRef.afterClosed().subscribe((refreshed) => {
      if (refreshed) {
        this.loadInvoices();
        this.loadPendingStudents();
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
        this.loadPendingStudents();
      }
    });
  }

  loadPendingStudents(): void {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    this.loadingPending = true;
    this.feesService.getPendingInvoicingStudents(currentMonth, currentYear).subscribe({
      next: (list) => {
        this.pendingStudents = list || [];
        this.loadingPending = false;
      },
      error: (err) => {
        console.error('Failed to load pending invoicing students', err);
        this.loadingPending = false;
      }
    });
  }

  generateForPendingStudent(student: PendingInvoicingStudent): void {
    this.openGenerateInvoicesModal(student);
  }

  generateForAllPending(): void {
    this.openGenerateInvoicesModal();
  }

  dismissBanner(): void {
    this.bannerDismissed = true;
  }

  loadUpcomingBillingCycle(): void {
    const today = new Date();
    let nextMonth = today.getMonth() + 2; // JS getMonth() 0-based; so current month = getMonth()+1, next month = getMonth()+2
    let nextYear = today.getFullYear();
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }

    const nextMonthDate = new Date(nextYear, nextMonth - 1, 1);
    const monthName = nextMonthDate.toLocaleString('en-IN', { month: 'long' });

    const diffTime = nextMonthDate.getTime() - today.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const dueDateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-10`;

    // Only notify during the last 7 days of the current month (e.g. 25th onwards for October)
    if (daysRemaining > 7) {
      this.upcomingCycle = null;
      return;
    }

    this.loadingUpcoming = true;
    this.feesService.getPendingInvoicingStudents(nextMonth, nextYear).subscribe({
      next: (list) => {
        this.loadingUpcoming = false;
        if (list && list.length > 0) {
          this.upcomingCycle = {
            month: nextMonth,
            year: nextYear,
            monthName,
            daysRemaining,
            uninvoicedStudentsCount: list.length,
            defaultDueDate: dueDateStr,
            students: list
          };
        } else {
          this.upcomingCycle = null;
        }
      },
      error: (err) => {
        this.loadingUpcoming = false;
        console.error('Failed to load upcoming cycle pending students', err);
      }
    });
  }

  openGenerateInvoicesForUpcomingCycle(): void {
    if (!this.upcomingCycle) return;

    const dialogRef = this.dialog.open(GenerateInvoicesDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      data: {
        batches: this.batches,
        classes: this.schoolClasses,
        defaultMonth: this.upcomingCycle.month,
        defaultYear: this.upcomingCycle.year
      }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.confirmDialog.alert(
          'Invoices Generated',
          result.message || `Successfully generated ${this.upcomingCycle?.monthName} invoice(s).`,
          'success'
        );
        this.pageIndex = 0;
        this.loadInvoices();
        this.loadPendingStudents();
        this.loadUpcomingBillingCycle();
      }
    });
  }

  dismissUpcomingBanner(): void {
    this.upcomingBannerDismissed = true;
  }

  getCurrentMonthYearName(): string {
    const today = new Date();
    return today.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  }
}
