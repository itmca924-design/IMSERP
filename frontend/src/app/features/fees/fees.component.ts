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
import { FeesService, FeeInvoicePagedItem, FeePaymentReceipt, PendingInvoicingStudent, OnlineUpiTransactionItem, GenerateInvoicesResult } from '../../core/services/fees.service';
import { BatchesService, BatchDto } from '../../core/services/batches.service';
import { SchoolService, SchoolClassDto } from '../../core/services/school.service';
import { AuthService } from '../../core/services/auth.service';
import { HostelService } from '../../core/services/hostel.service';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';
import { UpiPaymentDialogComponent, UpiPaymentDialogData } from './upi-payment-dialog.component';
import { UpiSettingsDialogComponent } from './upi-settings-dialog.component';
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
    MatDividerModule,
    IstDatetimeDirective
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

      <!-- Module Navigation / Mode Switcher -->
      <div class="fees-nav-bar">
        <button
          type="button"
          class="fees-nav-tab"
          [class.active]="currentActiveTab === 'invoices'"
          (click)="switchTab('invoices')">
          <mat-icon>receipt_long</mat-icon>
          <span>Fee Invoices &amp; Counter Dues</span>
          <span class="nav-count" *ngIf="totalCount > 0">{{ totalCount }}</span>
        </button>

        <button
          type="button"
          class="fees-nav-tab upi-nav-tab"
          [class.active]="currentActiveTab === 'upi'"
          (click)="switchTab('upi')">
          <mat-icon class="upi-nav-icon">qr_code_2</mat-icon>
          <span>Online UPI Collections &amp; Audit</span>
          <span class="nav-count upi-count" *ngIf="upiTotalCount > 0">{{ upiTotalCount }}</span>
        </button>
      </div>

      <!-- Smart Alert Banner: New Admissions Awaiting Invoicing -->
      <div class="pending-invoicing-banner" *ngIf="currentActiveTab === 'invoices' && pendingStudents.length > 0 && !bannerDismissed">
        <div class="banner-left">
          <div class="banner-badge-icon">
            <mat-icon>notification_important</mat-icon>
          </div>
          <div class="banner-text">
            <div class="banner-title-row">
              <span class="banner-pill">{{ pendingStudents.length }} NEW {{ pendingStudents.length === 1 ? 'ADMISSION' : 'ADMISSIONS' }}</span>
              <strong class="banner-heading">Awaiting Fee Invoicing (New Admissions)</strong>
            </div>
            <div class="banner-students-list">
              <span class="student-item-tag clickable" *ngFor="let s of pendingStudents | slice:0:5" (click)="generateForPendingStudent(s)" matTooltip="Click to generate invoice for {{ s.studentName }} (Roll: {{ s.rollNumber }})">
                <strong>{{ s.studentName }}</strong>
                <span class="sub-info">({{ s.className || s.batchName || 'General' }} • Roll: {{ s.rollNumber }})</span>
                <mat-icon class="tag-click-icon">open_in_new</mat-icon>
              </span>
              <span class="more-tag clickable" *ngIf="pendingStudents.length > 5" [matMenuTriggerFor]="pendingStudentsMenu" matTooltip="Click to view all {{ pendingStudents.length }} new admissions">
                +{{ pendingStudents.length - 5 }} more admissions
                <mat-icon class="tag-click-icon">expand_more</mat-icon>
              </span>
            </div>
          </div>
        </div>
        <div class="banner-actions">
          <button mat-raised-button color="accent" class="quick-gen-btn" 
            (click)="pendingStudents.length === 1 ? generateForPendingStudent(pendingStudents[0]) : openGenerateInvoicesModal()" 
            matTooltip="Open invoice generator for pending new admissions">
            <mat-icon>post_add</mat-icon>
            <span>Generate Invoices ({{ pendingStudents.length }})</span>
          </button>

          <button mat-stroked-button class="btn-pick-single" [matMenuTriggerFor]="pendingStudentsMenu" *ngIf="pendingStudents.length > 1" matTooltip="Select a specific student to invoice">
            <span>Select Student</span>
            <mat-icon>expand_more</mat-icon>
          </button>

          <mat-menu #pendingStudentsMenu="matMenu" xPosition="before" class="pending-students-menu-panel">
            <div class="menu-section-title">New Admissions Awaiting Invoices</div>
            <button mat-menu-item *ngFor="let s of pendingStudents" (click)="generateForPendingStudent(s)">
              <mat-icon style="color: #d97706;">person_add</mat-icon>
              <span>{{ s.studentName }}</span>
              <small style="color: #64748b; margin-left: 6px;">({{ s.className || s.batchName || 'General' }} • Roll #{{ s.rollNumber }})</small>
            </button>
          </mat-menu>

          <button mat-icon-button class="dismiss-btn" (click)="dismissBanner()" matTooltip="Hide alert for now">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Upcoming Billing Cycle Alert Banner: Preparation & 7-Day Advance Alert -->
      <div class="upcoming-cycle-banner" *ngIf="currentActiveTab === 'invoices' && upcomingCycle && upcomingCycle.uninvoicedStudentsCount > 0 && !upcomingBannerDismissed">
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
      <mat-card class="table-card mat-elevation-z2" *ngIf="currentActiveTab === 'invoices'">
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
              <mat-option *ngFor="let b of (selectedClassFilter ? getBatchesForClass(selectedClassFilter) : batches)" [value]="b.id">
                🎯 {{ b.name }}{{ b.className ? ' [' + b.className + ']' : '' }}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

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
                    <span class="period-badge" [class.is-multiline]="!!ft.line2" [matTooltip]="getInvoiceBillingTooltip(inv)" matTooltipClass="multiline-tooltip">
                      <mat-icon class="period-icon">calendar_month</mat-icon>
                      <span class="period-lines">
                        <span class="period-line-1">{{ ft.line1 }}</span>
                        <span class="period-line-2" *ngIf="ft.line2">{{ ft.line2 }}</span>
                      </span>
                    </span>
                  </ng-container>
                  <div *ngIf="inv.items && inv.items.length > 0" class="mini-heads-row" [matTooltip]="getInvoiceBillingTooltip(inv)" matTooltipClass="multiline-tooltip">
                    <ng-container *ngFor="let it of getSortedInvoiceItems(inv.items); let i = index">
                      <span *ngIf="i < 3" class="mini-head-chip" [class.tuition-head-chip]="isTuitionHead(it.headName)">
                        <span class="chip-title-part">{{ it.headName }}:</span>
                        <strong class="chip-amt-part">₹{{ it.amount | number:'1.0-0' }}</strong>
                        <span class="chip-month-tag" *ngIf="getHeadMonthNote(it, inv) as note">({{ note }})</span>
                      </span>
                    </ng-container>
                    <span *ngIf="inv.items.length > 3" class="mini-head-more" [matTooltip]="getInvoiceBillingTooltip(inv)" matTooltipClass="multiline-tooltip">
                      +{{ inv.items.length - 3 }} more
                    </span>
                  </div>
                  <div *ngIf="inv.cancellationReason" class="inv-audit-pill" [matTooltip]="inv.cancellationReason">
                    <mat-icon class="audit-icon">info</mat-icon>
                    <span class="audit-text">{{ inv.cancellationReason }}</span>
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
                <ng-container *ngIf="inv.cancellationReason && inv.cancellationReason.includes('[BALANCE WAIVED & SETTLED]')">
                  <span class="waived-due-pill" [matTooltip]="inv.cancellationReason">₹0.00 (Waived)</span>
                </ng-container>
                <ng-container *ngIf="!inv.cancellationReason || !inv.cancellationReason.includes('[BALANCE WAIVED & SETTLED]')">
                  <ng-container *ngIf="inv.status !== 'Cancelled'">
                    <strong class="amount-due">₹{{ inv.dueAmount | number:'1.2-2' }}</strong>
                  </ng-container>
                  <ng-container *ngIf="inv.status === 'Cancelled'">
                    <span class="cancelled-due" matTooltip="Invoice cancelled (no dues payable)">₹0.00</span>
                  </ng-container>
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
                  *ngIf="inv.cancellationReason && inv.cancellationReason.includes('[BALANCE WAIVED & SETTLED]')"
                  class="status-badge settled"
                  [matTooltip]="inv.cancellationReason"
                  [matTooltipPosition]="'above'">
                  Settled (Waived)
                </span>
                <span
                  *ngIf="!inv.cancellationReason || !inv.cancellationReason.includes('[BALANCE WAIVED & SETTLED]')"
                  [class]="'status-badge ' + inv.status.toLowerCase()"
                  [matTooltip]="inv.status === 'Cancelled' ? ('Cancelled' + (inv.cancelledAt ? ' on ' + (inv.cancelledAt | date:'mediumDate') : '') + (inv.cancellationReason ? ' | Reason: ' + inv.cancellationReason : '')) : ''"
                  [matTooltipPosition]="'above'">
                  {{ inv.status }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="text-center col-actions">
                <mat-icon class="col-header-action-icon" matTooltip="Actions">settings</mat-icon>
              </th>
              <td mat-cell *matCellDef="let inv" class="text-center col-actions">
                <div class="smart-action-group">
                  <!-- 3-Dots Action Menu Trigger -->
                  <button
                    mat-icon-button
                    disableRipple
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
                      *ngIf="inv.dueAmount > 0 && inv.status !== 'Cancelled' && !isKitOrInventoryInvoice(inv)"
                      mat-menu-item
                      (click)="openCollectFeeModal(inv)">
                      <mat-icon class="menu-icon-blue">payments</mat-icon>
                      <span>Collect Fee (फीस जमा करें)</span>
                    </button>

                    <!-- Pay via Dynamic UPI QR -->
                    <button
                      *ngIf="inv.dueAmount > 0 && inv.status !== 'Cancelled' && !isKitOrInventoryInvoice(inv)"
                      mat-menu-item
                      (click)="openUpiPaymentModal(inv)">
                      <mat-icon class="menu-icon-emerald">qr_code_2</mat-icon>
                      <span>Pay via Dynamic UPI QR</span>
                    </button>

                    <!-- Due Receipt / Demand Notice -->
                    <button
                      *ngIf="inv.dueAmount > 0 && inv.status !== 'Cancelled' && !isKitOrInventoryInvoice(inv)"
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
                      *ngIf="inv.status !== 'Cancelled' && !isKitOrInventoryInvoice(inv)"
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

      <!-- Online UPI Collections & Audit Card -->
      <mat-card class="table-card mat-elevation-z2 upi-table-card" *ngIf="currentActiveTab === 'upi'">
        <!-- UPI Insights Bar -->
        <div class="upi-summary-strip">
          <div class="upi-summary-item">
            <div class="upi-item-icon">
              <mat-icon>account_balance_wallet</mat-icon>
            </div>
            <div class="upi-item-data">
              <span class="upi-data-label">Online UPI Records</span>
              <strong class="upi-data-val">{{ upiTotalCount }} Settlements</strong>
            </div>
          </div>
          <div class="upi-summary-item">
            <div class="upi-item-icon green-icon">
              <mat-icon>verified</mat-icon>
            </div>
            <div class="upi-item-data">
              <span class="upi-data-label">Gateway Cost</span>
              <strong class="upi-data-val green-text">₹0.00 (Zero Cost / NPCI Direct)</strong>
            </div>
          </div>
          <div class="upi-summary-item">
            <div class="upi-item-icon purple-icon">
              <mat-icon>sync</mat-icon>
            </div>
            <div class="upi-item-data">
              <span class="upi-data-label">Auto-Ledger Settlement</span>
              <strong class="upi-data-val">Instant FIFO &amp; Day Book Active</strong>
            </div>
          </div>
        </div>

        <!-- Filter Toolbar -->
        <div class="filter-toolbar">
          <mat-form-field appearance="outline" class="search-field">
            <mat-icon matPrefix class="search-prefix-icon">search</mat-icon>
            <mat-label>Search by 12-digit UTR, Student Name, Roll No, Receipt No...</mat-label>
            <input
              matInput
              [(ngModel)]="upiSearchTerm"
              (keyup.enter)="onUpiSearch()"
              placeholder="e.g. 529384920194, Mantosh, RCPT-2026..."
            />
            <button mat-icon-button matSuffix *ngIf="upiSearchTerm" (click)="upiSearchTerm = ''; onUpiSearch()" aria-label="Clear">
              <mat-icon>close</mat-icon>
            </button>
          </mat-form-field>

          <button mat-stroked-button class="btn-refresh-upi" (click)="loadOnlineUpiTransactions()" [disabled]="upiLoading">
            <mat-icon [class.spin-icon]="upiLoading">refresh</mat-icon>
            <span>Refresh</span>
          </button>
        </div>

        <!-- UPI Transactions Table -->
        <mat-card-content class="table-container table-responsive">
          <table mat-table [dataSource]="upiTransactions" class="full-width upi-data-table">

            <ng-container matColumnDef="paymentDate">
              <th mat-header-cell *matHeaderCellDef>Date &amp; Time (IST)</th>
              <td mat-cell *matCellDef="let txn">
                <span class="ist-date-cell" [appIstDatetime]="txn.paymentDate" format="datetime"></span>
              </td>
            </ng-container>

            <ng-container matColumnDef="receiptNumber">
              <th mat-header-cell *matHeaderCellDef>Receipt No</th>
              <td mat-cell *matCellDef="let txn">
                <a class="rcpt-badge-link" (click)="openReceiptForUpiTxn(txn)" matTooltip="Click to view &amp; print official receipt">
                  <mat-icon class="link-icon">receipt</mat-icon>
                  <span>#{{ txn.receiptNumber }}</span>
                </a>
              </td>
            </ng-container>

            <ng-container matColumnDef="studentName">
              <th mat-header-cell *matHeaderCellDef>Student Profile</th>
              <td mat-cell *matCellDef="let txn">
                <div class="st-cell">
                  <span class="st-name-text">{{ txn.studentName }}</span>
                  <div class="st-sub-chips">
                    <span class="meta-tag roll-tag" *ngIf="txn.rollNumber">Roll: {{ txn.rollNumber }}</span>
                    <span class="meta-tag class-tag" *ngIf="txn.className || txn.batchName">{{ txn.className || txn.batchName }}</span>
                  </div>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="invoiceNumber">
              <th mat-header-cell *matHeaderCellDef>Invoice / Ref</th>
              <td mat-cell *matCellDef="let txn">
                <span class="inv-ref-text">{{ txn.invoiceNumber || 'FIFO Settlement' }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="amountPaid">
              <th mat-header-cell *matHeaderCellDef class="text-right">Amount Received</th>
              <td mat-cell *matCellDef="let txn" class="text-right">
                <strong class="upi-paid-amt">₹{{ txn.amountPaid | number:'1.2-2' }}</strong>
              </td>
            </ng-container>

            <ng-container matColumnDef="upiRrn">
              <th mat-header-cell *matHeaderCellDef>12-Digit UTR / RRN</th>
              <td mat-cell *matCellDef="let txn">
                <div class="utr-pill-wrap" *ngIf="txn.upiRrn">
                  <code class="utr-code">{{ txn.upiRrn }}</code>
                  <button mat-icon-button disableRipple class="utr-copy-btn" (click)="copyToClipboard(txn.upiRrn)" matTooltip="Copy UTR">
                    <mat-icon>content_copy</mat-icon>
                  </button>
                </div>
                <span *ngIf="!txn.upiRrn" class="text-muted">-</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="payerVpa">
              <th mat-header-cell *matHeaderCellDef>Payer / VPA</th>
              <td mat-cell *matCellDef="let txn">
                <div class="payer-info-cell">
                  <span class="vpa-text" *ngIf="txn.payerVpa">{{ txn.payerVpa }}</span>
                  <small class="payer-sub" *ngIf="txn.payerPhone || txn.payerName">
                    {{ txn.payerName || '' }} {{ txn.payerPhone ? '(' + txn.payerPhone + ')' : '' }}
                  </small>
                  <span *ngIf="!txn.payerVpa && !txn.payerPhone && !txn.payerName" class="text-muted">Bharat UPI Direct</span>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef class="text-center">Settlement Status</th>
              <td mat-cell *matCellDef="let txn" class="text-center">
                <span class="upi-status-badge verified" matTooltip="Settled to Branch Day Book &amp; P&L">
                  <mat-icon>check_circle</mat-icon>
                  <span>{{ txn.onlinePaymentStatus || 'Completed' }}</span>
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="text-center col-actions">
                <mat-icon class="col-header-action-icon" matTooltip="Actions">settings</mat-icon>
              </th>
              <td mat-cell *matCellDef="let txn" class="text-center col-actions">
                <div class="smart-action-group">
                  <button
                    mat-icon-button
                    disableRipple
                    [matMenuTriggerFor]="upiActionMenu"
                    class="btn-more-dots"
                    matTooltip="Options &amp; Actions"
                    aria-label="UPI Actions Menu">
                    <mat-icon>more_vert</mat-icon>
                  </button>

                  <mat-menu #upiActionMenu="matMenu" xPosition="before" class="smart-fees-menu">
                    <!-- View / Print Receipt -->
                    <button mat-menu-item (click)="openReceiptForUpiTxn(txn)">
                      <mat-icon class="menu-icon-green">receipt</mat-icon>
                      <span>View &amp; Print E-Receipt (रसीद)</span>
                    </button>

                    <!-- Copy UTR / RRN -->
                    <button mat-menu-item (click)="copyToClipboard(txn.upiRrn)" *ngIf="txn.upiRrn">
                      <mat-icon class="menu-icon-blue">content_copy</mat-icon>
                      <span>Copy 12-Digit UTR Ref</span>
                    </button>

                    <!-- Copy Receipt Number -->
                    <button mat-menu-item (click)="copyToClipboard(txn.receiptNumber)" *ngIf="txn.receiptNumber">
                      <mat-icon class="menu-icon-purple">tag</mat-icon>
                      <span>Copy Receipt No</span>
                    </button>
                  </mat-menu>
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="upiDisplayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: upiDisplayedColumns;"></tr>

            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell empty-cell" [attr.colspan]="upiDisplayedColumns.length">
                <div class="empty-state" *ngIf="!upiLoading">
                  <mat-icon class="empty-icon">qr_code_2</mat-icon>
                  <p>No online UPI transactions found matching the filter criteria.</p>
                </div>
              </td>
            </tr>
          </table>
        </mat-card-content>

        <mat-paginator
          [length]="upiTotalCount"
          [pageSize]="upiPageSize"
          [pageSizeOptions]="[5, 10, 20, 50]"
          [pageIndex]="upiPageIndex"
          (page)="onUpiPageChange($event)"
          showFirstLastButtons>
        </mat-paginator>
      </mat-card>

      <!-- Floating Multi-Collect Action Bar -->
      <div class="multi-collect-bar" *ngIf="selectedInvoices.length > 0">
        <div class="bar-info-section">
          <div class="bar-left">
            <div class="badge-count" [matTooltip]="selectedInvoices.length + ' invoice(s) selected'">
              {{ selectedInvoices.length }}
            </div>
            <div class="selection-info">
              <span class="sel-title" [matTooltip]="selectedStudentName">
                {{ selectedStudentName }}
                <span class="sel-roll">(Roll #{{ selectedRollNumber }})</span>
              </span>
              <small class="sel-sub">{{ selectedInvoices.length }} {{ selectedInvoices.length === 1 ? 'Invoice' : 'Invoices' }} Selected</small>
            </div>
          </div>

          <div class="bar-center">
            <span class="total-label">Total to Collect</span>
            <strong class="total-amount">₹{{ totalSelectedDue | number:'1.2-2' }}</strong>
          </div>
        </div>

        <div class="bar-actions-section">
          <button mat-button class="btn-clear" (click)="clearSelection()" matTooltip="Clear selected invoices">
            <mat-icon class="clear-icon">close</mat-icon>
            <span class="clear-text">Clear</span>
          </button>
          
          <button mat-raised-button class="btn-upi-multi" (click)="openMultiCollectUpiModal()" matTooltip="Collect payment via Dynamic UPI QR Code">
            <mat-icon class="action-btn-icon">qr_code_2</mat-icon>
            <span class="action-btn-text">Pay via UPI QR</span>
          </button>
          
          <button mat-raised-button class="btn-collect-multi" (click)="openMultiCollectModal()" matTooltip="Collect settlement payment for selected invoices">
            <mat-icon class="action-btn-icon">payments</mat-icon>
            <span class="action-btn-text">Collect Fees</span>
            <span class="action-btn-amount">₹{{ totalSelectedDue | number:'1.2-2' }}</span>
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

      .upi-settings-btn {
        height: 44px;
        font-weight: 700;
        border-radius: 8px;
        border-color: #93c5fd;
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        color: #1e40af;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        box-shadow: 0 2px 4px rgba(37, 99, 235, 0.08);

        .upi-header-icon {
          color: #2563eb;
          font-size: 20px;
          width: 20px;
          height: 20px;
        }

        &:hover {
          background: #dbeafe;
          border-color: #60a5fa;
        }
      }

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

    /* Fees Nav Switcher */
    .fees-nav-bar {
      display: flex;
      gap: 12px;
      align-items: center;
      background: #f8fafc;
      padding: 6px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      width: fit-content;

      .fees-nav-tab {
        border: none;
        background: transparent;
        padding: 8px 18px;
        border-radius: 8px;
        font-size: 0.88rem;
        font-weight: 600;
        color: #64748b;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;

        mat-icon {
          font-size: 19px;
          width: 19px;
          height: 19px;
        }

        .nav-count {
          background: #e2e8f0;
          color: #475569;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 700;
        }

        &:hover {
          color: #1e293b;
          background: #f1f5f9;
        }

        &.active {
          background: #ffffff;
          color: #2563eb;
          font-weight: 700;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);

          .nav-count {
            background: #dbeafe;
            color: #1d4ed8;
          }
        }

        &.upi-nav-tab.active {
          color: #059669;
          .upi-nav-icon { color: #059669; }
          .upi-count { background: #dcfce7; color: #15803d; }
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
        gap: 3px;
        white-space: nowrap;
        box-shadow: 0 1px 2px rgba(0,0,0,0.02);

        .chip-title-part {
          color: #334155;
          font-weight: 600;
        }

        .chip-amt-part {
          color: #0f172a;
          font-weight: 700;
        }

        .chip-month-tag {
          font-size: 0.65rem;
          color: #2563eb;
          font-weight: 600;
          background: #eff6ff;
          padding: 0 4px;
          border-radius: 4px;
        }

        &.tuition-head-chip {
          background: #eff6ff;
          color: #1e40af;
          border-color: #bfdbfe;
          font-weight: 700;

          .chip-title-part {
            color: #1e3a8a;
            font-weight: 700;
          }

          .chip-amt-part {
            color: #1e40af;
            font-weight: 800;
          }

          .chip-month-tag {
            background: #dbeafe;
            color: #1d4ed8;
          }
        }
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
            .more-tag {
              font-size: 0.78rem;
              font-weight: 700;
              color: #b45309;
              background: rgba(254, 243, 199, 0.9);
              border: 1px dashed #f59e0b;
              padding: 2px 8px;
              border-radius: 6px;
              display: inline-flex;
              align-items: center;
              gap: 3px;
              cursor: pointer;
              transition: all 0.15s ease;

              &:hover {
                background: #fde68a;
                color: #78350f;
                border-style: solid;
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

        .btn-pick-single {
          height: 38px;
          border-radius: 8px;
          border-color: #f59e0b;
          color: #92400e;
          background: rgba(255, 255, 255, 0.85);
          font-weight: 600;
          font-size: 0.82rem;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 0 10px;

          &:hover {
            background: #ffffff;
            border-color: #d97706;
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

      @media (max-width: 768px) {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;

        .banner-left {
          min-width: 0;
          width: 100%;
        }

        .banner-actions {
          width: 100%;
          justify-content: flex-end;
          flex-wrap: wrap;

          .quick-gen-btn {
            flex: 1;
            min-width: 180px;
          }
        }
      }
    }

    ::ng-deep .pending-students-menu-panel {
      max-height: 380px !important;
      min-width: 290px !important;
      border-radius: 10px !important;
      border: 1px solid #fde68a !important;
      box-shadow: 0 10px 25px rgba(217, 119, 6, 0.15) !important;

      .menu-section-title {
        padding: 8px 14px 4px !important;
        font-size: 0.75rem !important;
        font-weight: 700 !important;
        color: #92400e !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
      }

      .mat-mdc-menu-item {
        font-size: 0.84rem !important;
        height: 42px !important;
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

    .waived-due-pill {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      border-radius: 4px;
      padding: 1px 6px;
      font-size: 0.74rem;
      font-weight: 600;
      white-space: nowrap;
      cursor: help;
    }

    .inv-audit-pill {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 0.72rem;
      margin-top: 3px;
      max-width: 100%;
      cursor: help;

      .audit-icon {
        font-size: 13px;
        width: 13px;
        height: 13px;
        color: #2563eb;
      }
      .audit-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 220px;
      }
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

      .col-header-action-icon {
        font-size: 18px !important;
        width: 18px !important;
        height: 18px !important;
        line-height: 18px !important;
        color: #64748b;
        vertical-align: middle;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: color 0.15s ease;

        &:hover {
          color: #2563eb;
        }
      }
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
        border-radius: 8px !important;
        color: #475569;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        position: relative !important;
        transition: all 0.15s ease;

        ::ng-deep .mat-mdc-button-touch-target {
          display: none !important;
        }

        ::ng-deep .mat-mdc-button-persistent-ripple,
        ::ng-deep .mat-ripple {
          display: none !important;
        }

        mat-icon {
          font-size: 19px !important;
          width: 19px !important;
          height: 19px !important;
          line-height: 19px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        &:hover {
          background: #e0e7ff;
          color: #1e40af;
          border-color: #c7d2fe;
          transform: scale(1.05);
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.15);
        }
      }
    }

    .menu-icon-blue { color: #2563eb !important; }
    .menu-icon-emerald { color: #059669 !important; }
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
      z-index: 1050;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      color: #f8fafc;
      border-radius: 100px;
      padding: 8px 14px 8px 18px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.12);
      animation: dockSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      box-sizing: border-box;
      max-width: min(94vw, 980px);
      transition: all 0.25s ease;

      .bar-info-section {
        display: flex;
        align-items: center;
        gap: 16px;
        min-width: 0;
        flex: 1 1 auto;
      }

      .bar-left {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;

        .badge-count {
          width: 32px;
          height: 32px;
          min-width: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: #ffffff;
          font-weight: 800;
          font-size: 0.88rem;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
          flex-shrink: 0;
        }

        .selection-info {
          display: flex;
          flex-direction: column;
          min-width: 0;

          .sel-title {
            font-weight: 700;
            font-size: 0.92rem;
            color: #ffffff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 220px;
            display: inline-flex;
            align-items: baseline;
            gap: 5px;

            .sel-roll {
              font-weight: 500;
              color: #93c5fd;
              font-size: 0.8rem;
              white-space: nowrap;
            }
          }

          .sel-sub {
            font-size: 0.72rem;
            color: #94a3b8;
            white-space: nowrap;
          }
        }
      }

      .bar-center {
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 0 16px;
        border-left: 1px solid rgba(255, 255, 255, 0.15);
        border-right: 1px solid rgba(255, 255, 255, 0.15);
        flex-shrink: 0;

        .total-label {
          font-size: 0.7rem;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          line-height: 1.1;
        }

        .total-amount {
          font-size: 1.25rem;
          color: #4ade80;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          line-height: 1.2;
          text-shadow: 0 0 12px rgba(74, 222, 128, 0.25);
          white-space: nowrap;
        }
      }

      .bar-actions-section {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      }

      .btn-clear {
        color: #94a3b8 !important;
        font-size: 0.82rem !important;
        font-weight: 600;
        height: 38px;
        border-radius: 8px;
        padding: 0 10px !important;
        min-width: auto !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px;
        white-space: nowrap !important;
        transition: all 0.15s ease;

        .clear-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          line-height: 16px;
        }

        &:hover {
          color: #f1f5f9 !important;
          background: rgba(255, 255, 255, 0.08) !important;
        }
      }

      .btn-upi-multi,
      .btn-collect-multi {
        height: 42px !important;
        border-radius: 50px !important;
        white-space: nowrap !important;
        flex-shrink: 0 !important;
        font-weight: 700 !important;
        letter-spacing: 0.2px;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;

        ::ng-deep .mdc-button__label {
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
          white-space: nowrap !important;
          line-height: 1 !important;
        }

        .action-btn-icon {
          font-size: 19px !important;
          width: 19px !important;
          height: 19px !important;
          line-height: 19px !important;
        }
      }

      .btn-upi-multi {
        background: linear-gradient(135deg, #059669 0%, #10b981 100%) !important;
        color: #ffffff !important;
        padding: 0 18px !important;
        box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);

        &:hover {
          background: linear-gradient(135deg, #047857 0%, #059669 100%) !important;
          box-shadow: 0 6px 18px rgba(16, 185, 129, 0.45);
          transform: translateY(-1px);
        }
      }

      .btn-collect-multi {
        background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%) !important;
        color: #ffffff !important;
        padding: 0 20px !important;
        box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);

        .action-btn-amount {
          background: rgba(0, 0, 0, 0.22);
          padding: 2px 7px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.3px;
        }

        &:hover {
          background: linear-gradient(135deg, #15803d 0%, #16a34a 100%) !important;
          box-shadow: 0 6px 20px rgba(34, 197, 94, 0.5);
          transform: translateY(-1px);
        }
      }

      @keyframes dockSlideUp {
        from {
          opacity: 0;
          transform: translate(-50%, 20px) scale(0.96);
        }
        to {
          opacity: 1;
          transform: translate(-50%, 0) scale(1);
        }
      }

      /* Responsive Breakpoint 1: Medium Screens & Tablets (max-width: 900px) */
      @media (max-width: 900px) {
        border-radius: 20px;
        padding: 10px 14px;
        gap: 12px;
        bottom: 18px;

        .bar-left .selection-info .sel-title {
          max-width: 140px;
        }

        .bar-center {
          padding: 0 12px;
        }

        .btn-upi-multi {
          padding: 0 14px !important;
        }

        .btn-collect-multi {
          padding: 0 16px !important;
        }
      }

      /* Responsive Breakpoint 2: Small Tablets & Mobiles (max-width: 720px) */
      @media (max-width: 720px) {
        flex-direction: column;
        border-radius: 18px;
        padding: 12px 14px;
        gap: 10px;
        width: calc(100% - 24px);
        max-width: 480px;
        bottom: max(14px, env(safe-area-inset-bottom, 14px));

        .bar-info-section {
          width: 100%;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 8px;
        }

        .bar-center {
          border-left: none;
          border-right: none;
          padding: 0;
          align-items: flex-end;
        }

        .bar-actions-section {
          width: 100%;
          justify-content: stretch;
          gap: 8px;

          .btn-clear {
            padding: 0 6px !important;
          }

          .btn-upi-multi,
          .btn-collect-multi {
            flex: 1 1 0;
            justify-content: center;
            height: 38px !important;
            padding: 0 8px !important;
            font-size: 0.8rem !important;

            ::ng-deep .mdc-button__label {
              gap: 4px !important;
            }
          }
        }
      }

      /* Responsive Breakpoint 3: Compact Phones (max-width: 420px) */
      @media (max-width: 420px) {
        padding: 10px 12px;
        border-radius: 16px;

        .bar-left .selection-info .sel-title {
          max-width: 120px;
          font-size: 0.86rem;
        }

        .bar-center .total-amount {
          font-size: 1.1rem;
        }

        .bar-actions-section {
          .btn-clear .clear-text {
            display: none;
          }

          .btn-upi-multi .action-btn-text {
            font-size: 0.78rem;
          }

          .btn-collect-multi {
            .action-btn-text {
              font-size: 0.78rem;
            }
            .action-btn-amount {
              display: none;
            }
          }
        }
      }
    }

    /* UPI Collections Strip & Table Styles */
    .upi-summary-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      padding: 16px 20px;
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
      border-bottom: 1px solid #bbf7d0;

      .upi-summary-item {
        display: flex;
        align-items: center;
        gap: 14px;
        background: #ffffff;
        padding: 12px 16px;
        border-radius: 10px;
        border: 1px solid #dcfce7;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

        .upi-item-icon {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 22px; width: 22px; height: 22px; }

          &.green-icon {
            background: #f0fdf4;
            color: #16a34a;
          }

          &.purple-icon {
            background: #faf5ff;
            color: #9333ea;
          }
        }

        .upi-item-data {
          display: flex;
          flex-direction: column;
          gap: 2px;

          .upi-data-label {
            font-size: 0.74rem;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.02em;
          }

          .upi-data-val {
            font-size: 1.05rem;
            color: #0f172a;
            font-weight: 800;

            &.green-text {
              color: #15803d;
            }
          }
        }
      }
    }

    .btn-refresh-upi {
      height: 48px;
      border-radius: 8px;
      color: #15803d;
      border-color: #86efac;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &:hover { background: #dcfce7; }
    }

    .upi-data-table {
      .ist-date-cell {
        font-size: 0.82rem;
        color: #334155;
        font-weight: 600;
        white-space: nowrap;
      }

      .rcpt-badge-link {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: #2563eb;
        font-weight: 700;
        font-size: 0.85rem;
        cursor: pointer;
        padding: 3px 8px;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 6px;
        transition: all 0.15s ease;
        text-decoration: none;

        .link-icon { font-size: 15px; width: 15px; height: 15px; color: #2563eb; }

        &:hover {
          background: #dbeafe;
          border-color: #60a5fa;
        }
      }

      .inv-ref-text {
        font-size: 0.82rem;
        color: #475569;
        font-weight: 600;
      }

      .upi-paid-amt {
        font-size: 0.95rem;
        color: #15803d;
        font-weight: 800;
      }

      .utr-pill-wrap {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        padding: 3px 6px 3px 8px;
        border-radius: 6px;
        white-space: nowrap;
        vertical-align: middle;
        max-width: 100%;
        box-sizing: border-box;

        .utr-code {
          font-family: 'Consolas', 'Courier New', monospace;
          font-weight: 700;
          font-size: 0.8rem;
          color: #0f172a;
          white-space: nowrap;
          user-select: all;
          line-height: 1.2;
        }

        .utr-copy-btn {
          width: 22px !important;
          height: 22px !important;
          min-width: 22px !important;
          min-height: 22px !important;
          padding: 0 !important;
          margin: 0 !important;
          border: none !important;
          border-radius: 50% !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          position: relative !important;
          flex-shrink: 0 !important;
          line-height: 1 !important;
          box-sizing: border-box !important;
          background: transparent !important;
          cursor: pointer;
          transition: all 0.15s ease;

          ::ng-deep .mat-mdc-button-touch-target {
            display: none !important;
          }

          ::ng-deep .mat-mdc-button-persistent-ripple,
          ::ng-deep .mat-ripple {
            display: none !important;
          }

          mat-icon {
            font-size: 13px !important;
            width: 13px !important;
            height: 13px !important;
            line-height: 13px !important;
            color: #64748b;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            margin: 0 !important;
            padding: 0 !important;
            transition: color 0.15s ease, transform 0.15s ease;
          }

          &:hover {
            background-color: #cbd5e1 !important;
            box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.25) !important;

            mat-icon {
              color: #1e40af !important;
              transform: scale(1.08);
            }
          }

          &:active {
            background-color: #94a3b8 !important;
            transform: scale(0.95);
          }
        }
      }

      .payer-info-cell {
        display: flex;
        flex-direction: column;
        gap: 1px;

        .vpa-text {
          font-weight: 700;
          color: #1e40af;
          font-size: 0.82rem;
        }

        .payer-sub {
          color: #64748b;
          font-size: 0.74rem;
        }
      }

      .upi-status-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 10px;
        border-radius: 14px;
        font-size: 0.76rem;
        font-weight: 700;

        &.verified {
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #86efac;
          mat-icon { font-size: 14px; width: 14px; height: 14px; }
        }
      }

      .btn-view-receipt {
        height: 32px;
        font-size: 0.78rem;
        font-weight: 600;
        color: #2563eb;
        border-color: #bfdbfe;
        mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 4px; }
        &:hover { background: #eff6ff; }
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

  // Mode Navigation
  currentActiveTab: 'invoices' | 'upi' = 'invoices';

  // Online UPI Collections Data State
  upiTransactions: OnlineUpiTransactionItem[] = [];
  upiTotalCount = 0;
  upiPageIndex = 0;
  upiPageSize = 10;
  upiSearchTerm = '';
  upiLoading = false;
  upiDisplayedColumns: string[] = [
    'paymentDate',
    'receiptNumber',
    'studentName',
    'invoiceNumber',
    'amountPaid',
    'upiRrn',
    'payerVpa',
    'status',
    'actions'
  ];

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
      width: '740px',
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
        this.loadPendingStudents();

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

  getBatchesForClass(classId: string): any[] {
    if (!classId) return this.batches || [];
    return (this.batches || []).filter(b => b.classId === classId);
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

  isTuitionHead(headName?: string): boolean {
    return !!headName && /tuition/i.test(headName);
  }

  isLateFeeHead(headName?: string): boolean {
    return !!headName && /late\s*fee/i.test(headName);
  }

  getSortedInvoiceItems(items?: any[]): any[] {
    if (!items || items.length === 0) return [];
    let list = items;
    // When Late Fee Rule Auto-Compute toggle is OFF, suppress late fee fines from Billing Period / Heads grid chips
    if (!this.settingsService.lateFeeCalc()) {
      list = list.filter(it => !this.isLateFeeHead(it.headName) && it.description !== 'LateFeeFine');
    }
    return list.slice().sort((a, b) => {
      const getPriority = (name: string): number => {
        const n = (name || '').toLowerCase();
        if (n.includes('tuition')) return 1;
        if (n.includes('computer') || n.includes('exam') || n.includes('annual') || n.includes('library') || n.includes('activity') || n.includes('development')) return 2;
        if (n.includes('hostel') || n.includes('transport') || n.includes('bus') || n.includes('mess')) return 3;
        if (n.includes('kit') || n.includes('pen') || n.includes('uniform') || n.includes('dress') || n.includes('tie') || n.includes('belt') || n.includes('bag') || n.includes('book') || n.includes('station')) return 5;
        return 4;
      };
      return getPriority(a.headName) - getPriority(b.headName);
    });
  }

  getRemainingHeadsTooltip(items?: any[]): string {
    return this.getInvoiceBillingTooltip({ items });
  }

  getHeadMonthNote(it: any, inv: any): string {
    if (!it) return '';
    const name = (it.headName || '').toLowerCase();
    const isKit = /(kit|pen|tie|belt|bag|uniform|dress|book|station)/i.test(name);
    if (isKit) return 'One-time Kit';

    const months = this.getBilledMonthsList(inv);
    if (!months || months.length === 0) return '';
    if (months.length === 1) return months[0];

    const shortNames = months.map(m => m.split(' ')[0].substring(0, 3)).join(', ');
    if (it.amount > 0 && Math.round(it.amount % months.length) === 0) {
      const perMo = Math.round(it.amount / months.length);
      return `${months.length} Mos: ${shortNames} @ ₹${perMo.toLocaleString('en-IN')}/mo`;
    }
    return `${months.length} Mos: ${shortNames}`;
  }

  getInvoiceBillingTooltip(inv: any): string {
    if (!inv) return '';
    const lines: string[] = [];

    // 1. Determine months list with 1-based numbering
    const months = this.getBilledMonthsList(inv);
    if (months.length > 0) {
      lines.push(months.length > 1 ? `🗓️ Billed Months (${months.length} Months):` : '🗓️ Billed Month:');
      months.forEach((m, idx) => {
        lines.push(`  ${idx + 1}. ${m}`);
      });
      lines.push('');
    }

    // 2. Fee Heads Breakdown (Sorted with Tuition Fee first)
    const sortedItems = this.getSortedInvoiceItems(inv.items);
    if (sortedItems.length > 0) {
      lines.push('📋 Fee Heads Breakdown:');
      sortedItems.forEach((it, idx) => {
        const note = this.getHeadMonthNote(it, inv);
        const noteStr = note ? ` (${note})` : '';
        lines.push(`  ${idx + 1}. ${it.headName}: ₹${Math.round(it.amount).toLocaleString('en-IN')}${noteStr}`);
      });
      lines.push('────────────────────────');
      if (inv.totalAmount !== undefined) {
        lines.push(`Total Fee: ₹${Math.round(inv.totalAmount).toLocaleString('en-IN')}`);
      }
      if (inv.paidAmount > 0) {
        lines.push(`Paid: ₹${Math.round(inv.paidAmount).toLocaleString('en-IN')}`);
      }
      if (inv.dueAmount !== undefined) {
        lines.push(`Balance Due: ₹${Math.round(inv.dueAmount).toLocaleString('en-IN')}`);
      }
    }

    return lines.join('\n');
  }

  getBilledMonthsList(inv: any): string[] {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    let startYear = 0;
    let startMonth = 0; // 1-12
    let monthsCount = 1;

    // A. Parse from InvoiceNumber: e.g. INV-202605Q-853 or INV-HOSTEL-202610-123
    if (inv.invoiceNumber) {
      const match = inv.invoiceNumber.match(/^INV-(?:HOSTEL-)?(\d{4})(\d{2})([QHY])?-/i);
      if (match) {
        startYear = parseInt(match[1], 10);
        startMonth = parseInt(match[2], 10);
        const cycle = (match[3] || '').toUpperCase();
        if (cycle === 'Q') monthsCount = 3;
        else if (cycle === 'H') monthsCount = 6;
        else if (cycle === 'Y') monthsCount = 12;
      }
    }

    // B. Check Title: e.g. "May – July 2026 (Quarterly)"
    if (inv.title) {
      if (/quarterly/i.test(inv.title)) monthsCount = 3;
      else if (/half\s*-?\s*yearly/i.test(inv.title)) monthsCount = 6;
      else if (/annual|yearly/i.test(inv.title)) monthsCount = 12;

      if (!startMonth) {
        for (let i = 0; i < monthNames.length; i++) {
          if (new RegExp(`\\b${monthNames[i]}\\b`, 'i').test(inv.title)) {
            startMonth = i + 1;
            break;
          }
        }
      }

      if (!startYear) {
        const yearMatch = inv.title.match(/\b(20\d{2})\b/);
        if (yearMatch) {
          startYear = parseInt(yearMatch[1], 10);
        }
      }
    }

    // C. Fallback to DueDate or CreatedAt
    if (!startMonth) {
      const refDate = inv.dueDate ? new Date(inv.dueDate) : (inv.createdAt ? new Date(inv.createdAt) : new Date());
      startYear = refDate.getFullYear();
      startMonth = refDate.getMonth() + 1;
    }
    if (!startYear) startYear = new Date().getFullYear();

    // Generate month names array
    const result: string[] = [];
    for (let i = 0; i < monthsCount; i++) {
      const d = new Date(startYear, startMonth - 1 + i, 1);
      result.push(d.toLocaleString('en-IN', { month: 'long', year: 'numeric' }));
    }
    return result;
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
          if (this.pendingStudents && this.pendingStudents.length > 0 && this.invoices.length > 0) {
            const invoicedStudentIds = new Set(this.invoices.map(i => i.studentId));
            this.pendingStudents = this.pendingStudents.filter(s => !invoicedStudentIds.has(s.studentId));
          }
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
            this.loadPendingStudents();

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
            this.loadPendingStudents();
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
      width: '1240px',
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
    let defaultMonth = today.getMonth() + 1;
    let defaultYear = today.getFullYear();

    if (targetStudent?.joiningDate) {
      const joinD = new Date(targetStudent.joiningDate);
      if (!isNaN(joinD.getTime())) {
        const cutoffDay = this.settingsService.admissionCutoffDay() || 20;
        if (joinD.getDate() > cutoffDay) {
          // Dynamic Admission Cutoff Rollover (Admitted after cutoff day -> Billing rolls over to next month)
          const rollDate = new Date(joinD.getFullYear(), joinD.getMonth() + 1, 1);
          defaultMonth = rollDate.getMonth() + 1;
          defaultYear = rollDate.getFullYear();
        } else {
          defaultMonth = joinD.getMonth() + 1;
          defaultYear = joinD.getFullYear();
        }
      }
    }

    const dialogRef = this.dialog.open(GenerateInvoicesDialogComponent, {
      width: '660px',
      maxWidth: '96vw',
      data: {
        batches: this.batches,
        classes: this.schoolClasses,
        defaultBatchId: targetStudent?.batchId || this.selectedBatchFilter,
        defaultClassId: targetStudent?.classId || this.selectedClassFilter,
        targetStudentId: targetStudent?.studentId,
        targetStudentName: targetStudent?.studentName,
        targetRollNumber: targetStudent?.rollNumber,
        targetJoiningDate: targetStudent?.joiningDate,
        defaultMonth: defaultMonth,
        defaultYear: defaultYear
      }
    });

    dialogRef.afterClosed().subscribe((result: GenerateInvoicesResult | undefined) => {
      if (result) {
        if (result.generatedCount > 0) {
          this.confirmDialog.alert(
            'Invoices Generated',
            result.message || `Successfully generated ${result.generatedCount} invoice(s).`,
            'success',
            {
              titleEn: 'Invoices Generated',
              titleHi: 'इनवॉइस सफलतापूर्वक जनरेट हो गए',
              messageEn: result.message,
              messageHi: result.messageHi || result.message
            }
          );
        } else {
          this.confirmDialog.alert(
            'Invoices Not Generated',
            result.message || 'No invoices were generated for the selected month.',
            'warning',
            {
              titleEn: 'Invoices Not Generated',
              titleHi: 'इनवॉइस जनरेट नहीं हुए',
              messageEn: result.message,
              messageHi: result.messageHi || result.message
            }
          );
        }
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

  isKitOrInventoryInvoice(inv: FeeInvoicePagedItem): boolean {
    if (!inv) return false;
    return inv.invoiceCategory === 'Inventory' ||
           (!!inv.invoiceNumber && inv.invoiceNumber.startsWith('INV-KIT')) ||
           (!!inv.title && inv.title.includes('Admission Books & Uniform Kit'));
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
      width: '680px',
      maxWidth: '95vw',
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
        if (res.action === 'WaiveAndClose') {
          this.confirmDialog.alert(
            'Invoice Settled & Balance Waived',
            `Invoice ${inv.invoiceNumber} has been successfully settled.\n\n• Retained ₹${(inv.paidAmount || 0).toFixed(2)} collected in school accounts.\n• Waived remaining balance ₹${(inv.dueAmount || 0).toFixed(2)}.\n• Reason: ${res.reason}\n\nOutstanding dues for ${inv.studentName} have been cleared.`,
            'success'
          );
        } else if (res.action === 'RefundAndCancel') {
          this.confirmDialog.alert(
            'Invoice Voided & Payments Reversed',
            `Invoice ${inv.invoiceNumber} has been marked VOID.\n\n• Collected payments of ₹${(inv.paidAmount || 0).toFixed(2)} have been reversed from Day Book.\n• Reason: ${res.reason}\n\nOutstanding dues for ${inv.studentName} have been updated.`,
            'warning'
          );
        } else {
          this.confirmDialog.alert(
            'Invoice Cancelled',
            `Invoice ${inv.invoiceNumber} has been successfully cancelled and marked as VOID.\nReason: ${res.reason}\n\nOutstanding dues for ${inv.studentName} have been recalculated.`,
            'success'
          );
        }
        this.loadInvoices();
        this.loadPendingStudents();
      }
    });
  }

  loadPendingStudents(): void {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const branchId = this.authService.selectedBranchId() || undefined;
    this.loadingPending = true;
    this.feesService.getPendingInvoicingStudents(currentMonth, currentYear, branchId, true).subscribe({
      next: (list) => {
        const invoicedStudentIds = new Set((this.invoices || []).map(i => i.studentId));
        this.pendingStudents = (list || []).filter(s => !invoicedStudentIds.has(s.studentId));
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
    const branchId = this.authService.selectedBranchId() || undefined;
    this.feesService.getPendingInvoicingStudents(nextMonth, nextYear, branchId, false).subscribe({
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
      width: '660px',
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

  // =========================================================================
  // DYNAMIC UPI & ONLINE COLLECTIONS HANDLERS
  // =========================================================================

  switchTab(tab: 'invoices' | 'upi'): void {
    this.currentActiveTab = tab;
    if (tab === 'upi' && this.upiTransactions.length === 0) {
      this.loadOnlineUpiTransactions();
    }
  }

  loadOnlineUpiTransactions(): void {
    this.upiLoading = true;
    const branchId = this.authService.selectedBranchId() || undefined;
    this.feesService.getOnlineUpiTransactions(
      this.upiPageIndex + 1,
      this.upiPageSize,
      this.upiSearchTerm,
      branchId
    ).subscribe({
      next: (res) => {
        this.upiTransactions = res.items || [];
        this.upiTotalCount = res.totalCount || 0;
        this.upiLoading = false;
      },
      error: (err) => {
        this.upiLoading = false;
        console.error('Error fetching online UPI transactions:', err);
      }
    });
  }

  onUpiPageChange(event: PageEvent): void {
    this.upiPageIndex = event.pageIndex;
    this.upiPageSize = event.pageSize;
    this.loadOnlineUpiTransactions();
  }

  onUpiSearch(): void {
    this.upiPageIndex = 0;
    this.loadOnlineUpiTransactions();
  }

  openUpiPaymentModal(inv: FeeInvoicePagedItem): void {
    const dialogRef = this.dialog.open(UpiPaymentDialogComponent, {
      width: '880px',
      maxWidth: '96vw',
      panelClass: ['upi-dialog-panel', 'no-overflow-dialog'],
      data: {
        mode: 'invoice',
        invoiceId: inv.id,
        studentId: inv.studentId,
        studentName: inv.studentName,
        rollNumber: inv.rollNumber,
        className: inv.className,
        batchName: inv.batchName,
        dueAmount: inv.dueAmount,
        invoiceNumber: inv.invoiceNumber
      }
    });

    dialogRef.afterClosed().subscribe((res: FeePaymentReceipt | undefined) => {
      if (res) {
        this.loadInvoices();
        if (this.currentActiveTab === 'upi') {
          this.loadOnlineUpiTransactions();
        }
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

  openMultiCollectUpiModal(): void {
    if (this.selectedInvoices.length === 0) return;
    const first = this.selectedInvoices[0];
    const dialogRef = this.dialog.open(UpiPaymentDialogComponent, {
      width: '880px',
      maxWidth: '96vw',
      panelClass: ['upi-dialog-panel', 'no-overflow-dialog'],
      data: {
        mode: 'fifo_student',
        studentId: first.studentId,
        studentName: this.selectedStudentName,
        rollNumber: this.selectedRollNumber,
        className: first.className,
        batchName: first.batchName,
        dueAmount: this.totalSelectedDue,
        invoiceNumber: `${this.selectedInvoices.length} Invoices FIFO Settlement`
      }
    });

    dialogRef.afterClosed().subscribe((res: FeePaymentReceipt | undefined) => {
      if (res) {
        this.clearSelection();
        this.loadInvoices();
        if (this.currentActiveTab === 'upi') {
          this.loadOnlineUpiTransactions();
        }
        this.dialog.open(FeeReceiptDialogComponent, {
          width: '840px',
          maxWidth: '96vw',
          panelClass: 'receipt-dialog-panel',
          data: {
            receipt: res,
            instituteName: this.authService.currentUser()?.instituteName || 'Apex Coaching Academy',
            branchName: res.branchName || first.branchName || this.authService.getCurrentBranchName()
          }
        });
      }
    });
  }

  openUpiSettingsModal(): void {
    const dialogRef = this.dialog.open(UpiSettingsDialogComponent, {
      width: '640px',
      maxWidth: '96vw',
      panelClass: 'upi-settings-dialog-panel'
    });
    dialogRef.afterClosed().subscribe(res => {
      if (res) {
        this.confirmDialog.alert(
          'Settings Updated',
          'Dynamic UPI payment parameters and VPA have been configured successfully.'
        );
      }
    });
  }

  openReceiptForUpiTxn(txn: OnlineUpiTransactionItem): void {
    this.feesService.getReceiptByNumber(txn.receiptNumber).subscribe({
      next: (receipt) => {
        this.dialog.open(FeeReceiptDialogComponent, {
          width: '840px',
          maxWidth: '96vw',
          panelClass: 'receipt-dialog-panel',
          data: {
            receipt,
            instituteName: this.authService.currentUser()?.instituteName || 'Apex Coaching Academy',
            branchName: txn.branchName || this.authService.getCurrentBranchName()
          }
        });
      },
      error: () => {
        this.confirmDialog.alert('Receipt Error', 'Unable to load official receipt.');
      }
    });
  }

  copyToClipboard(val?: string): void {
    if (!val) return;
    navigator.clipboard?.writeText(val);
  }
}
