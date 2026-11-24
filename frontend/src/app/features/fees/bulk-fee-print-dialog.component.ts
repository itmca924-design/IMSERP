import { Component, Inject, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';
import {
  FeesService,
  BulkPrintDataResponse,
  BulkDueSlipItem,
  BulkDueSlipInvoiceItem,
  BulkReceiptItem,
  BulkRegisterRow,
  UpiPaymentSettings
} from '../../core/services/fees.service';
import { SchoolService, SchoolClassDto, SchoolSectionDto } from '../../core/services/school.service';
import { BatchesService, BatchDto } from '../../core/services/batches.service';
import { AuthService } from '../../core/services/auth.service';
import { QuickSettingsService } from '../../core/services/quick-settings.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';
import { FeeCollectionDialogComponent } from './fee-collection-dialog.component';
import { FeeReceiptDialogComponent } from './fee-receipt-dialog.component';
import { FeeDueReceiptDialogComponent } from './fee-due-receipt-dialog.component';
import { StudentVoiceDialogComponent } from '../finance/dialogs/student-voice-dialog.component';
import { FeeReminderDispatchDialogComponent } from '../dashboard/dialogs/fee-reminder-dispatch-dialog.component';
import * as QRCode from '../../shared/utils/qr-code';

export interface BulkFeePrintDialogData {
  classes?: SchoolClassDto[];
  batches?: BatchDto[];
  initialDivision?: 'all' | 'school' | 'coaching';
  initialClassId?: string;
}

@Component({
  selector: 'app-bulk-fee-print-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatMenuModule,
    IstDatetimeDirective
  ],
  template: `
    <div class="bulk-dialog-shell">
      <!-- ─── Light-Blue Gradient Header (Strict ERP Rule) ─── -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>print</mat-icon>
          </div>
          <div class="header-titles">
            <h2>Fee Demand Bills, Bulk Slips &amp; Receipts Engine</h2>
            <p class="subtitle">
              Generate &amp; print class-wise or all-campus fee demand bills <strong>(4 or 8 per A4 Sheet)</strong>, due slips, payment receipts &amp; registers
              <strong>(Monthly • Quarterly • Half-Yearly • Yearly)</strong>
            </p>
          </div>
        </div>
        <button class="close-btn" (click)="dialogRef.close()" matTooltip="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- ─── Main Scrollable Body ─── -->
      <div class="dialog-body" [formGroup]="filterForm">

        <!-- 1. Document Mode & Cycle Quick Switcher Deck -->
        <div class="top-mode-bar">
          <!-- Document Type Selector -->
          <div class="doc-mode-group">
            <span class="group-label">DOCUMENT TYPE (दस्तावेज़ प्रकार)</span>
            <div class="pill-tabs">
              <button type="button" class="pill-tab due-tab"
                [class.active]="docType === 'dues'"
                (click)="onDocTypeChange('dues')">
                <mat-icon>request_quote</mat-icon>
                <span>Demand Bills &amp; Due Slips (मांग पर्ची)</span>
                <span class="count-badge">{{ isLoading ? '…' : dueSlipsTotalCount }}</span>
              </button>
              <button type="button" class="pill-tab receipt-tab"
                [class.active]="docType === 'receipts'"
                (click)="onDocTypeChange('receipts')">
                <mat-icon>receipt_long</mat-icon>
                <span>Bulk Paid Receipts (भुगतान रसीद)</span>
                <span class="count-badge">{{ isLoading ? '…' : receiptsTotalCount }}</span>
              </button>
              <button type="button" class="pill-tab register-tab"
                [class.active]="docType === 'register'"
                (click)="onDocTypeChange('register')">
                <mat-icon>table_chart</mat-icon>
                <span>Class / All Fee Register (समेकित रजिस्टर)</span>
                <span class="count-badge">{{ isLoading ? '…' : registerTotalCount }}</span>
              </button>
            </div>
          </div>

          <!-- Billing Cycle Frequency Selector -->
          <div class="cycle-mode-group">
            <span class="group-label">BILLING CYCLE (अवधि चक्र)</span>
            <div class="cycle-pills">
              <button type="button" class="cycle-pill"
                [class.active]="cycleType === 'Monthly'"
                (click)="onCycleChange('Monthly')">
                Monthly (मासिक)
              </button>
              <button type="button" class="cycle-pill"
                [class.active]="cycleType === 'Quarterly'"
                (click)="onCycleChange('Quarterly')">
                Quarterly (त्रैमासिक)
              </button>
              <button type="button" class="cycle-pill"
                [class.active]="cycleType === 'HalfYearly'"
                (click)="onCycleChange('HalfYearly')">
                Half-Yearly (अर्धवार्षिक)
              </button>
              <button type="button" class="cycle-pill"
                [class.active]="cycleType === 'Yearly'"
                (click)="onCycleChange('Yearly')">
                Yearly (वार्षिक सत्र)
              </button>
            </div>
          </div>
        </div>

        <!-- 2. Filter Control Deck (Pure Reactive Forms, Class -> Section/Batch Cascade) -->
        <div class="filter-deck">
          <!-- Tri-Modal Division Scope -->
          <div class="division-bar">
            <div class="div-pills">
              <button type="button" class="div-pill"
                [class.active]="division === 'all'"
                (click)="onDivisionChange('all')">
                <mat-icon>domain</mat-icon>
                <span>All / Hybrid Consolidated</span>
              </button>
              @if (authService.hasSchoolModule()) {
                <button type="button" class="div-pill school"
                  [class.active]="division === 'school'"
                  (click)="onDivisionChange('school')">
                  <mat-icon>school</mat-icon>
                  <span>School Division (विद्यालय)</span>
                </button>
              }
              @if (authService.hasCoachingModule()) {
                <button type="button" class="div-pill coaching"
                  [class.active]="division === 'coaching'"
                  (click)="onDivisionChange('coaching')">
                  <mat-icon>groups</mat-icon>
                  <span>Coaching Division (कोचिंग)</span>
                </button>
              }
            </div>

            <div class="arrear-toggle-wrap">
              <mat-checkbox formControlName="groupSiblingsFirst" color="primary" (change)="onFilterChange()">
                <span class="arrear-label" style="color: #1e40af; font-weight: 700;">👨‍👩‍👧‍👦 Group Siblings Together (भाई-बहन एक साथ दिखाएँ)</span>
              </mat-checkbox>
              <mat-checkbox formControlName="includeArrears" color="primary" (change)="onFilterChange()">
                <span class="arrear-label">Include Previous Months Pending Arrears (पिछला बकाया शामिल करें)</span>
              </mat-checkbox>
            </div>
          </div>

          <!-- Dropdown Controls Grid -->
          <div class="controls-grid">
            <!-- Cycle Specific Period Selector -->
            @if (cycleType === 'Monthly') {
              <mat-form-field appearance="outline" class="dense-field">
                <mat-label>Select Month (माह)</mat-label>
                <mat-select formControlName="month" (selectionChange)="onFilterChange()">
                  @for (m of monthsList; track m.value) {
                    <mat-option [value]="m.value">{{ m.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }

            @if (cycleType === 'Quarterly') {
              <mat-form-field appearance="outline" class="dense-field">
                <mat-label>Select Quarter (तिमाही)</mat-label>
                <mat-select formControlName="quarter" (selectionChange)="onFilterChange()">
                  <mat-option [value]="1">Q1: April – June (अप्रैल – जून)</mat-option>
                  <mat-option [value]="2">Q2: July – September (जुलाई – सितंबर)</mat-option>
                  <mat-option [value]="3">Q3: October – December (अक्टूबर – दिसंबर)</mat-option>
                  <mat-option [value]="4">Q4: January – March (जनवरी – मार्च)</mat-option>
                </mat-select>
              </mat-form-field>
            }

            @if (cycleType === 'HalfYearly') {
              <mat-form-field appearance="outline" class="dense-field">
                <mat-label>Select Half-Year Term (छमाही)</mat-label>
                <mat-select formControlName="halfYear" (selectionChange)="onFilterChange()">
                  <mat-option [value]="1">Term 1: April – September (प्रथम छमाही)</mat-option>
                  <mat-option [value]="2">Term 2: October – March (द्वितीय छमाही)</mat-option>
                </mat-select>
              </mat-form-field>
            }

            <!-- Year / Academic Session Start Year -->
            <mat-form-field appearance="outline" class="dense-field">
              <mat-label>{{ cycleType === 'Monthly' ? 'Calendar Year (वर्ष)' : 'Session Start Year (सत्र वर्ष)' }}</mat-label>
              <mat-select formControlName="year" (selectionChange)="onFilterChange()">
                @for (y of availableYears; track y) {
                  <mat-option [value]="y">
                    {{ cycleType === 'Monthly' ? y : (y + ' - ' + (y + 1)) }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>

            <!-- Academic Class (कक्षा) — Always First (Strict Coaching Hierarchy Rule) -->
            <mat-form-field appearance="outline" class="dense-field">
              <mat-label>Academic Class (कक्षा चुनें)</mat-label>
              <mat-select formControlName="classId" (selectionChange)="onClassChange()">
                <mat-option value="">All Classes (सभी कक्षाएं - Consolidated)</mat-option>
                @for (cls of classes; track cls.id) {
                  <mat-option [value]="cls.id">{{ cls.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <!-- Section Selector (When School or Hybrid) -->
            @if (division !== 'coaching') {
              <mat-form-field appearance="outline" class="dense-field">
                <mat-label>Section (सेक्शन)</mat-label>
                <mat-select formControlName="sectionId" (selectionChange)="onFilterChange()" [disabled]="!selectedClassId">
                  <mat-option value="">All Sections (सभी सेक्शन)</mat-option>
                  @for (sec of availableSections; track sec.id) {
                    <mat-option [value]="sec.id">Section {{ sec.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }

            <!-- Coaching Batch Selector (Cascaded strictly from Class) -->
            @if (division !== 'school') {
              <mat-form-field appearance="outline" class="dense-field">
                <mat-label>Coaching Batch (कोचिंग बैच)</mat-label>
                <mat-select formControlName="batchId" (selectionChange)="onFilterChange()">
                  <mat-option value="">All Batches ({{ selectedClassId ? 'Selected Class' : 'All Classes' }})</mat-option>
                  @for (b of cascadedBatches; track b.id) {
                    <mat-option [value]="b.id">{{ b.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }

            <!-- Print Layout Mode (For Demand Bills, Due Slips & Receipts) -->
            @if (docType !== 'register') {
              <mat-form-field appearance="outline" class="dense-field layout-select-field">
                <mat-label>Demand Bill / Print Layout (A4 लेआउट)</mat-label>
                <mat-select formControlName="printLayout">
                  <mat-option value="three_per_page">
                    <strong>3 Students / A4 (1×3 Tri-Fold Slips • 99mm Full Width)</strong>
                  </mat-option>
                  <mat-option value="four_per_page">
                    <strong>4 Students / A4 (2×2 Demand Bill Grid • Recommended)</strong>
                  </mat-option>
                  <mat-option value="eight_per_page">
                    <strong>8 Students / A4 (2×4 Pocket Slips / Diary Strips)</strong>
                  </mat-option>
                  <mat-option value="ten_per_page">
                    <strong>10 Students / A4 (2×5 Compact Slips / Token Bills)</strong>
                  </mat-option>
                  <mat-option value="twelve_per_page">
                    <strong>12 Students / A4 (2×6 Mini Slips / Diary Reminders)</strong>
                  </mat-option>
                  <mat-option value="two_per_page">
                    <span>2 Students / A4 (Half-Page Detailed)</span>
                  </mat-option>
                  <mat-option value="counterfoil">
                    <span>1 Student / A4 (Student + Office Copy)</span>
                  </mat-option>
                </mat-select>
              </mat-form-field>
            }

            <!-- Instant Server-Side Search Filter (Full Width) -->
            <mat-form-field appearance="outline" class="dense-field search-field">
              <mat-label>Server-Side Search by Student Name, Roll No, Admission No, Parent Name or Receipt Number...</mat-label>
              <mat-icon matPrefix>search</mat-icon>
              <input matInput formControlName="searchTerm" (keyup.enter)="onFilterChange()"
                placeholder="Type student name, roll number, parent name, class or receipt number to search server..." />
              @if (filterForm.get('searchTerm')?.value) {
                <button matSuffix mat-icon-button type="button" (click)="clearSearch()">
                  <mat-icon>close</mat-icon>
                </button>
              }
            </mat-form-field>
          </div>
        </div>

        <!-- 3. Single Prominent Loader (Visible Immediately Until API Response Arrives) -->
        @if (isLoading) {
          <div class="single-loader-box">
            <mat-spinner diameter="44"></mat-spinner>
            <p>Loading {{ cycleType }} Fee Ledgers, Invoices &amp; Receipts from Server...</p>
          </div>
        } @else {

          <!-- 4. KPI Summary Strip -->
          <div class="kpi-strip">
            <div class="kpi-box period-kpi">
              <span class="kpi-lbl">ACTIVE CYCLE &amp; SCOPE</span>
              <span class="kpi-val">{{ bulkData?.periodLabel || '—' }}</span>
              <span class="kpi-sub">{{ getScopeBadgeText() }}</span>
            </div>
            <div class="kpi-box">
              <span class="kpi-lbl">TOTAL FEE BILLED (कुल देय)</span>
              <span class="kpi-val">₹{{ (bulkData?.summary?.totalInvoiced || 0) | number:'1.0-0' }}</span>
              <span class="kpi-sub">{{ bulkData?.summary?.totalStudents || 0 }} Active Students</span>
            </div>
            <div class="kpi-box adv-kpi">
              <span class="kpi-lbl">ADVANCE ADJUSTED (अग्रिम समायोजन)</span>
              <span class="kpi-val">₹{{ (bulkData?.summary?.totalAdvanceAdjusted || 0) | number:'1.0-0' }}</span>
              <span class="kpi-sub">Auto FIFO Wallet Credit</span>
            </div>
            <div class="kpi-box paid-kpi">
              <span class="kpi-lbl">TOTAL COLLECTED (कुल प्राप्त)</span>
              <span class="kpi-val">₹{{ (bulkData?.summary?.totalPaid || 0) | number:'1.0-0' }}</span>
              <span class="kpi-sub">{{ bulkData?.summary?.receiptsCount || 0 }} Paid Receipts</span>
            </div>
            <div class="kpi-box due-kpi">
              <span class="kpi-lbl">NET BALANCE DUE (शुद्ध बकाया)</span>
              <span class="kpi-val">₹{{ (bulkData?.summary?.totalBalanceDue || 0) | number:'1.0-0' }}</span>
              <span class="kpi-sub">{{ bulkData?.summary?.studentsWithDues || 0 }} Students with Dues</span>
            </div>
          </div>

          <!-- ─── MODE A: BULK DUE SLIPS TABLE ─── -->
          @if (docType === 'dues') {
            <div class="table-card">
              <div class="table-toolbar">
                <div class="toolbar-left">
                  <mat-checkbox
                    color="primary"
                    [checked]="isAllDueSlipsSelected()"
                    [indeterminate]="isSomeDueSlipsSelected()"
                    (change)="toggleAllDueSlips($event.checked)">
                    <strong>Select All ({{ selectedDueStudentIds.size }} / {{ filteredDueSlips.length }} Students Selected)</strong>
                  </mat-checkbox>
                </div>
                <div class="toolbar-right">
                  <span class="selected-total-chip due">
                    Selected Net Due: <strong>₹{{ getSelectedDueSlipsTotal() | number:'1.0-2' }}</strong>
                  </span>
                </div>
              </div>

              @if (filteredDueSlips.length === 0) {
                <div class="empty-state">
                  <mat-icon>verified</mat-icon>
                  <h4>No Pending Fee Dues Found for {{ bulkData?.periodLabel }}</h4>
                  <p>All students in the selected class/division have cleared their dues for this billing cycle.</p>
                </div>
              } @else {
                <div class="table-responsive">
                  <table class="erp-table">
                    <thead>
                      <tr>
                        <th style="width: 44px; text-align: center;">#</th>
                        <th class="sortable-th" (click)="onSort('studentName')">
                          <div class="th-flex"><span>Student Details</span><mat-icon class="sort-ic">{{ getSortIcon('studentName') }}</mat-icon></div>
                        </th>
                        <th class="sortable-th" (click)="onSort('className')">
                          <div class="th-flex"><span>Class / Batch</span><mat-icon class="sort-ic">{{ getSortIcon('className') }}</mat-icon></div>
                        </th>
                        <th class="sortable-th" (click)="onSort('parentName')">
                          <div class="th-flex"><span>Parent &amp; WhatsApp</span><mat-icon class="sort-ic">{{ getSortIcon('parentName') }}</mat-icon></div>
                        </th>
                        <th>Unpaid Months / Bills</th>
                        <th class="num-col sortable-th" (click)="onSort('totalInvoiced')">
                          <div class="th-flex right"><span>Billed Fee</span><mat-icon class="sort-ic">{{ getSortIcon('totalInvoiced') }}</mat-icon></div>
                        </th>
                        <th class="num-col sortable-th" (click)="onSort('advanceAdjusted')">
                          <div class="th-flex right"><span>Adv. Adjusted</span><mat-icon class="sort-ic">{{ getSortIcon('advanceAdjusted') }}</mat-icon></div>
                        </th>
                        <th class="num-col sortable-th" (click)="onSort('paidAmount')">
                          <div class="th-flex right"><span>Paid</span><mat-icon class="sort-ic">{{ getSortIcon('paidAmount') }}</mat-icon></div>
                        </th>
                        <th class="num-col sortable-th" (click)="onSort('totalBalanceDue')">
                          <div class="th-flex right"><span>Net Balance Due</span><mat-icon class="sort-ic">{{ getSortIcon('totalBalanceDue') }}</mat-icon></div>
                        </th>
                        <th style="width: 90px; text-align: center;">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (slip of filteredDueSlips; track slip.studentId) {
                        <tr [class.row-selected]="selectedDueStudentIds.has(slip.studentId)">
                          <td style="text-align: center;">
                            <mat-checkbox color="primary"
                              (click)="$event.stopPropagation()"
                              [checked]="selectedDueStudentIds.has(slip.studentId)"
                              (change)="toggleDueSlipRow(slip.studentId, $event.checked)">
                            </mat-checkbox>
                          </td>
                          <td>
                            <div class="st-name">
                              {{ slip.studentName }}
                              @if (slip.siblingDiscountPercent && slip.siblingDiscountPercent > 0) {
                                <span class="bulk-sib-disc-pill">🎁 {{ slip.siblingDiscountPercent }}% Sibling Concession</span>
                              }
                            </div>
                            <div class="st-meta">Roll: {{ slip.rollNumber }} • Adm: {{ slip.admissionNumber }}</div>
                            @if (slip.parentPhone) {
                              <div class="st-phone">📞 {{ slip.parentPhone }}</div>
                            }
                            @if (slip.siblingsInfo && slip.siblingsInfo.length > 0) {
                              <div class="bulk-sibling-family-badge" (click)="openCombinedFamilyDemandBill(slip); $event.stopPropagation()" matTooltip="Click to view / print Combined Family Demand Bill for all siblings">
                                <span class="fam-ic">👨‍👩‍👧‍👦</span>
                                <span class="fam-txt">
                                  Sibling:
                                  @for (sib of slip.siblingsInfo; track sib.studentId; let isLast = $last) {
                                    <strong>{{ sib.studentName }}</strong> ({{ sib.className || sib.batchName || 'Gen' }}: ₹{{ sib.balanceDue | number:'1.0-0' }}){{ !isLast ? ', ' : '' }}
                                  }
                                  @if (slip.familyTotalDue && slip.familyTotalDue > slip.totalBalanceDue) {
                                    <span class="fam-tot-pill">• Family Total: ₹{{ slip.familyTotalDue | number:'1.0-0' }}</span>
                                  }
                                </span>
                              </div>
                            }
                          </td>
                          <td>
                            <span class="cls-badge">{{ slip.className || 'N/A' }}{{ slip.sectionName ? ' - ' + slip.sectionName : '' }}</span>
                            @if (slip.batchName) {
                              <div class="batch-sub">{{ slip.batchName }}</div>
                            }
                          </td>
                          <td>
                            <div class="st-name">{{ slip.parentName || '—' }}</div>
                            <div class="st-meta">{{ slip.parentPhone || 'No Phone' }}</div>
                          </td>
                          <td>
                            <div class="period-tags">
                              @for (inv of slip.invoices; track inv.invoiceId) {
                                <span class="p-tag" [class.arrear]="inv.isArrear" [matTooltip]="getInvoicePeriodLabel(inv)">
                                   {{ getInvoicePeriodLabel(inv) }} (₹{{ inv.balanceDue | number:'1.0-0' }})
                                </span>
                              }
                            </div>
                          </td>
                          <td class="num-col">₹{{ slip.totalInvoiced | number:'1.0-0' }}</td>
                          <td class="num-col adv-col">
                            @if (slip.advanceAdjusted > 0) {
                              <span>-₹{{ slip.advanceAdjusted | number:'1.0-0' }}</span>
                            } @else {
                              <span class="muted">—</span>
                            }
                          </td>
                          <td class="num-col paid-col">₹{{ slip.paidAmount | number:'1.0-0' }}</td>
                          <td class="num-col due-col">
                            @if (isHighestDue(slip)) {
                              <div class="priority-due-box blink-pulse" matTooltip="Highest Pending Dues Priority">
                                <span class="pulse-dot">🔴</span>
                                <strong>₹{{ slip.totalBalanceDue | number:'1.0-2' }}</strong>
                                <span class="high-tag">HIGH</span>
                              </div>
                            } @else {
                              <strong class="standard-due">₹{{ slip.totalBalanceDue | number:'1.0-2' }}</strong>
                            }
                          </td>
                          <td style="text-align: center;">
                            <div class="row-actions-group">
                              <button
                                type="button"
                                class="mini-voice-btn"
                                (click)="openVoiceReminder(slip)"
                                matTooltip="AI Hindi Voice Note & Audio"
                                aria-label="AI Hindi Voice Note">
                                <mat-icon style="color: #7c3aed;">mic</mat-icon>
                              </button>
                              <button
                                type="button"
                                class="more-action-btn"
                                [matMenuTriggerFor]="actionMenu"
                                matTooltip="Actions, WhatsApp & Collect Fee"
                                aria-label="Actions Menu">
                                <mat-icon>more_vert</mat-icon>
                              </button>
                              <mat-menu #actionMenu="matMenu" xPosition="before">
                                <button mat-menu-item (click)="openQuickCollect(slip)">
                                  <mat-icon style="color: #059669;">payments</mat-icon>
                                  <span>Collect Fee / Payment</span>
                                </button>
                                @if (slip.siblingsInfo && slip.siblingsInfo.length > 0) {
                                  <button mat-menu-item (click)="openCombinedFamilyDemandBill(slip)">
                                    <mat-icon style="color: #2563eb;">family_restroom</mat-icon>
                                    <span>Print Combined Family Demand Bill (भाई-बहन संयुक्त बिल)</span>
                                  </button>
                                }
                                <button mat-menu-item (click)="openWhatsAppReminder(slip)">
                                  <mat-icon style="color: #16a34a;">chat</mat-icon>
                                  <span>Send WhatsApp Due Reminder</span>
                                </button>
                                <button mat-menu-item (click)="openVoiceReminder(slip)">
                                  <mat-icon style="color: #7c3aed;">mic</mat-icon>
                                  <span>AI Hindi Voice Note</span>
                                </button>
                              </mat-menu>
                            </div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <mat-paginator class="table-paginator"
                  [length]="dueSlipsTotalCount"
                  [pageIndex]="pageIndex"
                  [pageSize]="pageSize"
                  [pageSizeOptions]="[10, 25, 50, 100]"
                  showFirstLastButtons
                  (page)="onPageChange($event)">
                </mat-paginator>
              }
            </div>
          }

          <!-- ─── MODE B: BULK PAID RECEIPTS TABLE ─── -->
          @if (docType === 'receipts') {
            <div class="table-card">
              <div class="table-toolbar">
                <div class="toolbar-left">
                  <mat-checkbox
                    color="primary"
                    [checked]="isAllReceiptsSelected()"
                    [indeterminate]="isSomeReceiptsSelected()"
                    (change)="toggleAllReceipts($event.checked)">
                    <strong>Select All ({{ selectedReceiptNumbers.size }} / {{ filteredReceipts.length }} Receipts on Page • Total {{ receiptsTotalCount }})</strong>
                  </mat-checkbox>
                </div>
                <div class="toolbar-right">
                  <span class="selected-total-chip paid">
                    Selected Receipts Paid: <strong>₹{{ getSelectedReceiptsTotal() | number:'1.0-2' }}</strong>
                  </span>
                </div>
              </div>

              @if (filteredReceipts.length === 0) {
                <div class="empty-state">
                  <mat-icon>receipt_long</mat-icon>
                  <h4>No Fee Payment Receipts Found for {{ bulkData?.periodLabel }}</h4>
                  <p>Try selecting another month, quarter, half-year, or full session year.</p>
                </div>
              } @else {
                <div class="table-responsive">
                  <table class="erp-table">
                    <thead>
                      <tr>
                        <th style="width: 44px; text-align: center;">#</th>
                        <th class="sortable-th" (click)="onSort('paymentDate')">
                          <div class="th-flex"><span>Receipt No &amp; Date</span><mat-icon class="sort-ic">{{ getSortIcon('paymentDate') }}</mat-icon></div>
                        </th>
                        <th class="sortable-th" (click)="onSort('studentName')">
                          <div class="th-flex"><span>Student Details</span><mat-icon class="sort-ic">{{ getSortIcon('studentName') }}</mat-icon></div>
                        </th>
                        <th class="sortable-th" (click)="onSort('className')">
                          <div class="th-flex"><span>Class / Batch</span><mat-icon class="sort-ic">{{ getSortIcon('className') }}</mat-icon></div>
                        </th>
                        <th class="sortable-th" (click)="onSort('periodLabel')">
                          <div class="th-flex"><span>Period Covered</span><mat-icon class="sort-ic">{{ getSortIcon('periodLabel') }}</mat-icon></div>
                        </th>
                        <th class="sortable-th" (click)="onSort('paymentMode')">
                          <div class="th-flex"><span>Payment Mode</span><mat-icon class="sort-ic">{{ getSortIcon('paymentMode') }}</mat-icon></div>
                        </th>
                        <th class="num-col sortable-th" (click)="onSort('amountPaid')">
                          <div class="th-flex right"><span>Amount Paid</span><mat-icon class="sort-ic">{{ getSortIcon('amountPaid') }}</mat-icon></div>
                        </th>
                        <th class="num-col sortable-th" (click)="onSort('advanceDepositAmount')">
                          <div class="th-flex right"><span>Advance Deposit</span><mat-icon class="sort-ic">{{ getSortIcon('advanceDepositAmount') }}</mat-icon></div>
                        </th>
                        <th class="num-col sortable-th" (click)="onSort('remainingDue')">
                          <div class="th-flex right"><span>Remaining Due</span><mat-icon class="sort-ic">{{ getSortIcon('remainingDue') }}</mat-icon></div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (rcp of filteredReceipts; track rcp.receiptNumber) {
                        <tr [class.row-selected]="selectedReceiptNumbers.has(rcp.receiptNumber)">
                          <td style="text-align: center;">
                            <mat-checkbox color="primary"
                              (click)="$event.stopPropagation()"
                              [checked]="selectedReceiptNumbers.has(rcp.receiptNumber)"
                              (change)="toggleReceiptRow(rcp.receiptNumber, $event.checked)">
                            </mat-checkbox>
                          </td>
                          <td>
                            <div class="rcp-no">{{ rcp.receiptNumber }}</div>
                            <div class="st-meta" [appIstDatetime]="rcp.paymentDate" format="shortDatetime"></div>
                          </td>
                          <td>
                            <div class="st-name">{{ rcp.studentName }}</div>
                            <div class="st-meta">Roll: {{ rcp.rollNumber }}{{ rcp.parentName ? ' • ' + rcp.parentName : '' }}</div>
                            @if (rcp.parentPhone) {
                              <div class="st-phone">📞 {{ rcp.parentPhone }}</div>
                            }
                          </td>
                          <td>
                            <span class="cls-badge">{{ rcp.className || 'N/A' }}{{ rcp.sectionName ? ' - ' + rcp.sectionName : '' }}</span>
                            @if (rcp.batchName) {
                              <div class="batch-sub">{{ rcp.batchName }}</div>
                            }
                          </td>
                          <td>
                            <span class="period-text">{{ rcp.periodLabel }}</span>
                            <div class="st-meta">Inv: {{ rcp.invoiceNumbers }}</div>
                          </td>
                          <td>
                            <span class="mode-chip">{{ rcp.paymentMode }}</span>
                            @if (rcp.transactionRef) {
                              <div class="st-meta">Ref: {{ rcp.transactionRef }}</div>
                            }
                          </td>
                          <td class="num-col paid-col">
                            <strong>₹{{ rcp.amountPaid | number:'1.0-2' }}</strong>
                          </td>
                          <td class="num-col adv-col">
                            @if (rcp.advanceDepositAmount > 0) {
                              <span class="adv-pill">+₹{{ rcp.advanceDepositAmount | number:'1.0-0' }} Adv</span>
                            } @else {
                              <span class="muted">—</span>
                            }
                          </td>
                          <td class="num-col" [class.due-col]="rcp.remainingDue > 0">
                            ₹{{ rcp.remainingDue | number:'1.0-2' }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <mat-paginator class="table-paginator"
                  [length]="receiptsTotalCount"
                  [pageIndex]="pageIndex"
                  [pageSize]="pageSize"
                  [pageSizeOptions]="[10, 25, 50, 100]"
                  showFirstLastButtons
                  (page)="onPageChange($event)">
                </mat-paginator>
              }
            </div>
          }

          <!-- ─── MODE C: CONSOLIDATED CLASS / ALL REGISTER TABLE ─── -->
          @if (docType === 'register') {
            <div class="table-card">
              <div class="table-toolbar">
                <div class="toolbar-left">
                  <strong>Consolidated Fee &amp; Dues Register — Showing {{ filteredRegisterRows.length }} of {{ registerTotalCount }} Students</strong>
                </div>
                <div class="toolbar-right">
                  <span class="selected-total-chip paid">Paid: ₹{{ (bulkData?.summary?.totalPaid || 0) | number:'1.0-0' }}</span>
                  <span class="selected-total-chip due">Due: ₹{{ (bulkData?.summary?.totalBalanceDue || 0) | number:'1.0-0' }}</span>
                </div>
              </div>

              @if (filteredRegisterRows.length === 0) {
                <div class="empty-state">
                  <mat-icon>folder_open</mat-icon>
                  <h4>No Student Fee Records Found for {{ bulkData?.periodLabel }}</h4>
                  <p>Generate monthly invoices or adjust the cycle/class filters above.</p>
                </div>
              } @else {
                <div class="table-responsive">
                  <table class="erp-table">
                    <thead>
                      <tr>
                        <th style="width: 48px;">S.No</th>
                        <th class="sortable-th" (click)="onSort('studentName')">
                          <div class="th-flex"><span>Student Name &amp; Roll</span><mat-icon class="sort-ic">{{ getSortIcon('studentName') }}</mat-icon></div>
                        </th>
                        <th class="sortable-th" (click)="onSort('className')">
                          <div class="th-flex"><span>Class / Batch</span><mat-icon class="sort-ic">{{ getSortIcon('className') }}</mat-icon></div>
                        </th>
                        <th class="sortable-th" (click)="onSort('parentName')">
                          <div class="th-flex"><span>Parent &amp; Phone</span><mat-icon class="sort-ic">{{ getSortIcon('parentName') }}</mat-icon></div>
                        </th>
                        <th class="sortable-th" (click)="onSort('monthsCount')">
                          <div class="th-flex"><span>Months Billed</span><mat-icon class="sort-ic">{{ getSortIcon('monthsCount') }}</mat-icon></div>
                        </th>
                        <th class="num-col sortable-th" (click)="onSort('totalInvoiced')">
                          <div class="th-flex right"><span>Total Billed</span><mat-icon class="sort-ic">{{ getSortIcon('totalInvoiced') }}</mat-icon></div>
                        </th>
                        <th class="num-col sortable-th" (click)="onSort('advanceAdjusted')">
                          <div class="th-flex right"><span>Adv. Adjusted</span><mat-icon class="sort-ic">{{ getSortIcon('advanceAdjusted') }}</mat-icon></div>
                        </th>
                        <th class="num-col sortable-th" (click)="onSort('totalPaid')">
                          <div class="th-flex right"><span>Total Paid</span><mat-icon class="sort-ic">{{ getSortIcon('totalPaid') }}</mat-icon></div>
                        </th>
                        <th class="num-col sortable-th" (click)="onSort('balanceDue')">
                          <div class="th-flex right"><span>Balance Due</span><mat-icon class="sort-ic">{{ getSortIcon('balanceDue') }}</mat-icon></div>
                        </th>
                        <th class="sortable-th" (click)="onSort('status')">
                          <div class="th-flex"><span>Status</span><mat-icon class="sort-ic">{{ getSortIcon('status') }}</mat-icon></div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of filteredRegisterRows; track row.studentId; let i = $index) {
                        <tr>
                          <td>{{ (pageIndex * pageSize) + i + 1 }}</td>
                          <td>
                            <div class="st-name">{{ row.studentName }}</div>
                            <div class="st-meta">Roll: {{ row.rollNumber }}</div>
                            @if (row.parentPhone) {
                              <div class="st-phone">📞 {{ row.parentPhone }}</div>
                            }
                          </td>
                          <td>
                            <span class="cls-badge">{{ row.className || 'N/A' }}{{ row.sectionName ? ' - ' + row.sectionName : '' }}</span>
                            @if (row.batchName) {
                              <div class="batch-sub">{{ row.batchName }}</div>
                            }
                          </td>
                          <td>
                            <div class="st-name">{{ row.parentName || '—' }}</div>
                            <div class="st-meta">{{ row.parentPhone || '—' }}</div>
                          </td>
                          <td>
                            <span class="period-text">{{ row.periodsSummary }}</span>
                          </td>
                          <td class="num-col">₹{{ row.totalInvoiced | number:'1.0-0' }}</td>
                          <td class="num-col adv-col">
                            {{ row.advanceAdjusted > 0 ? ('-₹' + (row.advanceAdjusted | number:'1.0-0')) : '—' }}
                          </td>
                          <td class="num-col paid-col">₹{{ row.totalPaid | number:'1.0-0' }}</td>
                          <td class="num-col due-col">
                            <strong>₹{{ row.balanceDue | number:'1.0-2' }}</strong>
                          </td>
                          <td>
                            <span class="status-pill" [ngClass]="row.status.toLowerCase()">
                              {{ row.status }}
                            </span>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <mat-paginator class="table-paginator"
                  [length]="registerTotalCount"
                  [pageIndex]="pageIndex"
                  [pageSize]="pageSize"
                  [pageSizeOptions]="[10, 25, 50, 100]"
                  showFirstLastButtons
                  (page)="onPageChange($event)">
                </mat-paginator>
              }
            </div>
          }
        }
      </div>

      <!-- ─── Sticky Responsive Action Footer ─── -->
      <div class="dialog-footer">
        <div class="footer-info">
          <mat-icon>info</mat-icon>
          <span>
            @if (docType === 'dues') {
              Ready to print <strong>{{ selectedDueStudentIds.size }}</strong> official Fee Due Slips ({{ bulkData?.periodLabel }})
            } @else if (docType === 'receipts') {
              Ready to print <strong>{{ selectedReceiptNumbers.size }}</strong> official Fee Payment Receipts ({{ bulkData?.periodLabel }})
            } @else {
              Ready to print Consolidated Fee &amp; Dues Register for <strong>{{ filteredRegisterRows.length }}</strong> students
            }
          </span>
        </div>
        <div class="footer-actions">
          <button mat-stroked-button type="button" (click)="dialogRef.close()">
            Close
          </button>
          <button id="app-filled-btn" mat-flat-button type="button" class="print-cta-btn"
            [disabled]="isLoading || isPrintDisabled()"
            (click)="executeBulkPrint()">
            <mat-icon>print</mat-icon>
            <span>
              @if (docType === 'dues') {
                Print Demand Bills / Slips ({{ selectedDueStudentIds.size }})
              } @else if (docType === 'receipts') {
                Print Selected Receipts ({{ selectedReceiptNumbers.size }})
              } @else {
                Print Consolidated Register ({{ filteredRegisterRows.length }})
              }
            </span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .bulk-dialog-shell {
      display: flex;
      flex-direction: column;
      height: 88vh;
      max-height: 92vh;
      width: 100%;
      background: #f8fafc;
      overflow: hidden;
    }

    /* ─── Light-Blue Gradient Header (Strict ERP Rule) ─── */
    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 24px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      flex-shrink: 0;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
    }

    .header-icon-box {
      width: 44px;
      height: 44px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .header-titles {
      min-width: 0;
    }

    .header-titles h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #1e3a8a;
      line-height: 1.25;
    }

    .header-titles .subtitle {
      margin: 3px 0 0;
      font-size: 12.5px;
      color: #3b82f6;
      line-height: 1.4;
    }

    .header-titles .subtitle strong {
      color: #1e40af;
    }

    .close-btn {
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s;
      flex-shrink: 0;
    }

    .close-btn:hover {
      color: #1e293b;
      background: #ffffff;
    }

    /* ─── Scrollable Body ─── */
    .dialog-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      padding: 14px 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scrollbar-width: thin;
      scrollbar-color: #94a3b8 #f1f5f9;
    }

    .dialog-body::-webkit-scrollbar {
      width: 7px;
    }
    .dialog-body::-webkit-scrollbar-track {
      background: #f1f5f9;
    }
    .dialog-body::-webkit-scrollbar-thumb {
      background: #94a3b8;
      border-radius: 4px;
    }

    /* ─── Top Mode & Cycle Switcher ─── */
    .top-mode-bar {
      flex-shrink: 0;
      display: grid;
      grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
      gap: 12px;
      background: #ffffff;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
    }

    .group-label {
      display: block;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: #64748b;
      margin-bottom: 5px;
    }

    .pill-tabs, .cycle-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .pill-tab {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 10px;
      border-radius: 7px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #334155;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.18s;
      white-space: nowrap;
    }

    .pill-tab mat-icon {
      font-size: 17px;
      width: 17px;
      height: 17px;
    }

    .pill-tab .count-badge {
      padding: 1px 7px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      background: #e2e8f0;
      color: #1e293b;
    }

    .pill-tab.due-tab.active {
      background: #fef2f2;
      border-color: #dc2626;
      color: #b91c1c;
    }
    .pill-tab.due-tab.active .count-badge {
      background: #dc2626;
      color: #ffffff;
    }

    .pill-tab.receipt-tab.active {
      background: #ecfdf5;
      border-color: #059669;
      color: #047857;
    }
    .pill-tab.receipt-tab.active .count-badge {
      background: #059669;
      color: #ffffff;
    }

    .pill-tab.register-tab.active {
      background: #eff6ff;
      border-color: #2563eb;
      color: #1d4ed8;
    }
    .pill-tab.register-tab.active .count-badge {
      background: #2563eb;
      color: #ffffff;
    }

    .cycle-pill {
      padding: 6px 9px;
      border-radius: 7px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #334155;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.18s;
      flex: 1 1 auto;
      text-align: center;
      white-space: nowrap;
    }

    .cycle-pill.active {
      background: #1e40af;
      border-color: #1e3a8a;
      color: #ffffff;
      box-shadow: 0 2px 6px rgba(30, 64, 175, 0.25);
    }

    /* ─── Filter Control Deck ─── */
    .filter-deck {
      flex-shrink: 0;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .division-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      padding-bottom: 10px;
      border-bottom: 1px dashed #e2e8f0;
    }

    .div-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .div-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #475569;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .div-pill mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .div-pill.active {
      background: #eff6ff;
      border-color: #2563eb;
      color: #1d4ed8;
    }

    .arrear-label {
      font-size: 12.5px;
      font-weight: 600;
      color: #334155;
    }

    .controls-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 14px;
      align-items: center;
    }

    .dense-field {
      flex: 1 1 200px;
      min-width: 180px;
      width: auto;
    }

    :host ::ng-deep .dense-field .mat-mdc-form-field-subscript-wrapper {
      display: none !important;
    }

    :host ::ng-deep .dense-field .mat-mdc-text-field-wrapper {
      padding: 0 12px;
    }

    .search-field {
      flex: 1 1 100% !important;
      width: 100% !important;
      min-width: 100% !important;
    }

    /* ─── KPI Summary Strip ─── */
    .kpi-strip {
      flex-shrink: 0;
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
    }

    .kpi-box {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .kpi-box.period-kpi {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-color: #bfdbfe;
    }

    .kpi-box.adv-kpi {
      background: #f5f3ff;
      border-color: #ddd6fe;
    }

    .kpi-box.paid-kpi {
      background: #ecfdf5;
      border-color: #a7f3d0;
    }

    .kpi-box.due-kpi {
      background: #fef2f2;
      border-color: #fecaca;
    }

    .kpi-lbl {
      font-size: 10px;
      font-weight: 800;
      color: #64748b;
      letter-spacing: 0.05em;
    }

    .kpi-val {
      font-size: 17px;
      font-weight: 800;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .kpi-box.paid-kpi .kpi-val { color: #047857; }
    .kpi-box.due-kpi .kpi-val { color: #b91c1c; }
    .kpi-box.adv-kpi .kpi-val { color: #6d28d9; }
    .kpi-box.period-kpi .kpi-val { color: #1e3a8a; font-size: 15px; }

    .kpi-sub {
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
    }

    /* ─── Single Loader ─── */
    .single-loader-box {
      flex-shrink: 0;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 48px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      color: #475569;
      font-weight: 600;
    }

    /* ─── Table Card & Responsive Table ─── */
    .table-card {
      flex-shrink: 0;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
    }

    .table-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      padding: 10px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .selected-total-chip {
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
    }

    .selected-total-chip.due {
      background: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
    }

    .selected-total-chip.paid {
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
    }

    .table-responsive {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .erp-table {
      width: 100%;
      border-collapse: collapse;
    }

    .erp-table th {
      position: sticky;
      top: 0;
      z-index: 2;
      background: #f1f5f9;
      color: #334155;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.025em;
      padding: 9px 10px;
      text-align: left;
      border-bottom: 1px solid #cbd5e1;
      white-space: nowrap;
    }

    .erp-table th.sortable-th {
      cursor: pointer;
      user-select: none;
      transition: background 0.15s, color 0.15s;
    }

    .erp-table th.sortable-th:hover {
      background: #e2e8f0;
      color: #1d4ed8;
    }

    .th-flex {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .th-flex.right {
      justify-content: flex-end;
      width: 100%;
    }

    .sort-ic {
      font-size: 15px !important;
      width: 15px !important;
      height: 15px !important;
      color: #64748b;
      transition: color 0.15s;
    }

    .erp-table th.sortable-th:hover .sort-ic {
      color: #1d4ed8;
    }

    .table-paginator {
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .erp-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 12.5px;
      color: #1e293b;
      vertical-align: middle;
      white-space: nowrap;
    }

    .erp-table tbody tr {
      transition: background 0.15s;
    }

    .erp-table tbody tr:hover {
      background: #f8fafc;
    }

    .erp-table tbody tr.row-selected {
      background: #eff6ff;
    }

    .num-col {
      text-align: right !important;
      font-variant-numeric: tabular-nums;
    }

    .st-name {
      font-weight: 700;
      color: #0f172a;
    }

    .st-meta {
      font-size: 11px;
      color: #64748b;
      white-space: normal;
      max-width: 220px;
      line-height: 1.3;
    }

    .st-phone {
      font-size: 10.5px;
      font-weight: 600;
      color: #0f766e;
      margin-top: 2px;
      line-height: 1.2;
    }

    .bulk-sib-disc-pill {
      display: inline-block;
      margin-left: 5px;
      padding: 1px 6px;
      border-radius: 4px;
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
      font-size: 10px;
      font-weight: 700;
      vertical-align: middle;
    }

    .bulk-sibling-family-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
      padding: 2.5px 7px;
      border-radius: 5px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #93c5fd;
      color: #1e3a8a;
      font-size: 10.5px;
      line-height: 1.3;
      max-width: 260px;
      white-space: normal;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        border-color: #2563eb;
        box-shadow: 0 2px 6px rgba(37, 99, 235, 0.18);
      }

      .fam-tot-pill {
        color: #b91c1c;
        font-weight: 800;
        margin-left: 3px;
      }
    }

    .period-text {
      display: block;
      font-weight: 600;
      color: #1e293b;
      white-space: normal;
      max-width: 210px;
      line-height: 1.3;
    }

    .rcp-no {
      font-weight: 700;
      color: #1d4ed8;
      font-family: monospace;
      font-size: 12.5px;
    }

    .cls-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      background: #eff6ff;
      color: #1e40af;
      font-weight: 700;
      font-size: 11.5px;
    }

    .batch-sub {
      font-size: 11px;
      color: #6d28d9;
      font-weight: 600;
      margin-top: 2px;
      white-space: normal;
      max-width: 190px;
      line-height: 1.25;
    }

    .period-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      max-width: 260px;
      white-space: normal;
    }

    .p-tag {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      background: #f1f5f9;
      color: #334155;
      font-size: 11px;
      font-weight: 600;
    }

    .p-tag.arrear {
      background: #fff7ed;
      color: #c2410c;
      border: 1px solid #fed7aa;
    }

    .paid-col { color: #047857; font-weight: 600; }
    .due-col { color: #b91c1c; }
    .adv-col { color: #6d28d9; font-weight: 600; }

    /* ─── Red Pulse Blinking Priority Indicator (Highest Dues) ─── */
    @keyframes redBlinkPulse {
      0% {
        background: #fee2e2;
        border-color: #ef4444;
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5);
      }
      50% {
        background: #fecaca;
        border-color: #dc2626;
        box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.18);
      }
      100% {
        background: #fee2e2;
        border-color: #ef4444;
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5);
      }
    }

    .priority-due-box {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid #ef4444;
      color: #991b1b;
      font-weight: 700;
      white-space: nowrap;
    }

    .priority-due-box.blink-pulse {
      animation: redBlinkPulse 1.6s infinite ease-in-out;
    }

    .priority-due-box .pulse-dot {
      font-size: 8px;
      line-height: 1;
    }

    .priority-due-box .high-tag {
      font-size: 9px;
      font-weight: 800;
      padding: 1px 4px;
      border-radius: 4px;
      background: #dc2626;
      color: #ffffff;
      letter-spacing: 0.04em;
      line-height: 1.2;
    }

    .standard-due {
      font-weight: 700;
      color: #b91c1c;
    }

    /* ─── Smart Row Actions: Quick Voice & 3-Dots Action Menu ─── */
    .row-actions-group {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      white-space: nowrap;
    }

    .mini-voice-btn {
      width: 28px;
      height: 28px;
      min-width: 28px;
      min-height: 28px;
      padding: 0;
      box-sizing: border-box;
      border: 1px solid #ddd6fe;
      border-radius: 50%;
      background: #f5f3ff;
      color: #7c3aed;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(124, 58, 237, 0.15);
      transition: all 0.18s ease;

      mat-icon {
        font-size: 15px;
        width: 15px;
        height: 15px;
        line-height: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      &:hover {
        background: #ede9fe;
        border-color: #c4b5fd;
        transform: scale(1.06);
      }
    }

    .more-action-btn {
      width: 28px;
      height: 28px;
      min-width: 28px;
      min-height: 28px;
      padding: 0;
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      border-radius: 50%;
      background: #f8fafc;
      color: #475569;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
      transition: all 0.18s ease;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        line-height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      &:hover {
        background: #eff6ff;
        border-color: #93c5fd;
        color: #1e40af;
        transform: scale(1.06);
      }
    }

    /* ─── Instant Quick Collect Row Button ─── */
    .row-collect-btn {
      --mat-button-filled-container-color: #059669 !important;
      --mat-button-filled-label-text-color: #ffffff !important;
      background: linear-gradient(135deg, #059669 0%, #047857 100%) !important;
      color: #ffffff !important;
      height: 28px !important;
      line-height: 28px !important;
      padding: 0 10px !important;
      font-size: 11.5px !important;
      font-weight: 700 !important;
      border-radius: 6px !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 3px !important;
      box-shadow: 0 1px 3px rgba(5, 150, 105, 0.25) !important;
      border: none !important;
      cursor: pointer !important;
    }

    .row-collect-btn:hover {
      background: linear-gradient(135deg, #047857 0%, #065f46 100%) !important;
    }

    .row-collect-btn mat-icon {
      font-size: 15px !important;
      width: 15px !important;
      height: 15px !important;
    }

    .adv-pill {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 999px;
      background: #f5f3ff;
      color: #6d28d9;
      border: 1px solid #ddd6fe;
      font-size: 11px;
      font-weight: 700;
    }

    .mode-chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      background: #f1f5f9;
      color: #0f172a;
      font-size: 11.5px;
      font-weight: 700;
    }

    .status-pill {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .status-pill.paid { background: #ecfdf5; color: #047857; }
    .status-pill.partial { background: #fffbeb; color: #b45309; }
    .status-pill.unpaid { background: #fef2f2; color: #b91c1c; }

    .empty-state {
      padding: 40px 20px;
      text-align: center;
      color: #64748b;
    }

    .empty-state mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #94a3b8;
      margin-bottom: 8px;
    }

    .empty-state h4 {
      margin: 0 0 4px;
      font-size: 15px;
      color: #1e293b;
    }

    .empty-state p {
      margin: 0;
      font-size: 13px;
    }

    /* ─── Sticky Footer ─── */
    .dialog-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      padding: 14px 24px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    .footer-info {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #475569;
    }

    .footer-info mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #2563eb;
    }

    .footer-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .print-cta-btn {
      --mat-button-filled-container-color: #2563eb !important;
      --mat-button-filled-label-text-color: #ffffff !important;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
      color: #ffffff !important;
      font-weight: 700 !important;
      padding: 0 20px !important;
      height: 40px !important;
      border-radius: 8px !important;
    }

    /* ─── 100% Pure Responsive Breakpoints (Mobile < 640px, Tablet 640px - 1024px) ─── */
    @media (max-width: 1024px) {
      .top-mode-bar {
        grid-template-columns: minmax(0, 1fr);
      }
      .kpi-strip {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      .bulk-dialog-shell {
        height: 100dvh !important;
        max-height: 100dvh !important;
        border-radius: 0 !important;
      }
      .dialog-header {
        padding: 10px 14px;
        gap: 10px;
      }
      .header-icon-box {
        width: 36px;
        height: 36px;
        border-radius: 8px;
      }
      .header-icon-box mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
      .header-titles h2 {
        font-size: 14px;
      }
      .header-titles .subtitle {
        font-size: 11px;
      }
      .close-btn {
        width: 32px;
        height: 32px;
      }
      .dialog-body {
        padding: 10px 12px;
        gap: 10px;
      }
      .top-mode-bar {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px 10px;
      }
      .pill-tabs, .cycle-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .pill-tab, .cycle-pill {
        flex: 1 1 auto;
        justify-content: center;
        padding: 6px 8px;
        font-size: 11px;
        box-sizing: border-box;
      }
      .filter-deck {
        padding: 10px 12px;
        gap: 8px;
      }
      .division-bar {
        padding-bottom: 8px;
        gap: 8px;
        flex-direction: column;
        align-items: stretch;
      }
      .div-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        width: 100%;
      }
      .div-pill {
        flex: 1 1 auto;
        justify-content: center;
        padding: 5px 8px;
        font-size: 11px;
        box-sizing: border-box;
      }
      .controls-grid {
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: stretch;
      }
      .dense-field {
        flex: 0 0 auto !important;
        width: 100% !important;
        min-width: 100% !important;
        height: auto !important;
        margin-bottom: 0 !important;
      }
      .kpi-strip {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .kpi-strip .kpi-box:last-child {
        grid-column: span 2;
      }
      .kpi-box {
        padding: 8px 10px;
      }
      .kpi-val {
        font-size: 15px;
      }
      .table-toolbar {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        padding: 8px 12px;
      }
      .toolbar-right {
        width: 100%;
        display: flex;
        justify-content: flex-end;
      }
      .dialog-footer {
        flex-direction: column;
        align-items: stretch;
        padding: 10px 14px;
        gap: 8px;
      }
      .footer-info {
        font-size: 11.5px;
      }
      .footer-actions {
        width: 100%;
        flex-direction: column;
        gap: 8px;
      }
      .footer-actions button {
        width: 100%;
      }
    }
  `]
})
export class BulkFeePrintDialogComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private feesService = inject(FeesService);
  private schoolService = inject(SchoolService);
  private batchesService = inject(BatchesService);
  public authService = inject(AuthService);
  public settingsService = inject(QuickSettingsService);
  private confirmDialog = inject(ConfirmDialogService);
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  filterForm!: FormGroup;
  classes: SchoolClassDto[] = [];
  allBatches: BatchDto[] = [];
  availableSections: SchoolSectionDto[] = [];

  isLoading = true;
  bulkData: BulkPrintDataResponse | null = null;

  // Server-Side Pagination & Sorting State
  pageIndex = 0;
  pageSize = 10;
  sortBy = '';
  sortDescending = false;

  selectedDueStudentIds = new Set<string>();
  selectedReceiptNumbers = new Set<string>();

  monthsList = [
    { value: 4, label: 'April (अप्रैल)' },
    { value: 5, label: 'May (मई)' },
    { value: 6, label: 'June (जून)' },
    { value: 7, label: 'July (जुलाई)' },
    { value: 8, label: 'August (अगस्त)' },
    { value: 9, label: 'September (सितंबर)' },
    { value: 10, label: 'October (अक्टूबर)' },
    { value: 11, label: 'November (नवंबर)' },
    { value: 12, label: 'December (दिसंबर)' },
    { value: 1, label: 'January (जनवरी)' },
    { value: 2, label: 'February (फरवरी)' },
    { value: 3, label: 'March (मार्च)' }
  ];

  availableYears: number[] = [];
  payeeUpiId = 'imserp.fees@sbi';
  payeeMerchantName = '';

  constructor(
    public dialogRef: MatDialogRef<BulkFeePrintDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: BulkFeePrintDialogData
  ) {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    // Dynamically resolve active session from QuickSettingsService or active date
    const sessionMatch = this.settingsService.academicSession()?.match(/^(\d{4})/);
    const sessionStartYear = sessionMatch ? parseInt(sessionMatch[1], 10) : (curMonth >= 4 ? curYear : curYear - 1);
    const initialCalendarYear = curYear;
    this.availableYears = [sessionStartYear + 1, sessionStartYear, sessionStartYear - 1];

    const defaultQuarter = curMonth >= 4 && curMonth <= 6 ? 1
      : curMonth >= 7 && curMonth <= 9 ? 2
      : curMonth >= 10 && curMonth <= 12 ? 3 : 4;
    const defaultHalfYear = curMonth >= 4 && curMonth <= 9 ? 1 : 2;

    this.filterForm = this.fb.group({
      docType: new FormControl<'dues' | 'receipts' | 'register'>('dues'),
      cycleType: new FormControl<'Monthly' | 'Quarterly' | 'HalfYearly' | 'Yearly'>('Monthly'),
      month: new FormControl<number>(curMonth),
      year: new FormControl<number>(initialCalendarYear),
      quarter: new FormControl<number>(defaultQuarter),
      halfYear: new FormControl<number>(defaultHalfYear),
      division: new FormControl<string>(data?.initialDivision || 'all'),
      classId: new FormControl<string>(data?.initialClassId || ''),
      sectionId: new FormControl<string>(''),
      batchId: new FormControl<string>(''),
      includeArrears: new FormControl<boolean>(true),
      groupSiblingsFirst: new FormControl<boolean>(false),
      printLayout: new FormControl<'three_per_page' | 'four_per_page' | 'eight_per_page' | 'ten_per_page' | 'twelve_per_page' | 'two_per_page' | 'counterfoil'>('four_per_page'),
      searchTerm: new FormControl<string>('')
    });
  }

  ngOnInit(): void {
    if (this.data?.classes?.length) {
      this.classes = this.data.classes;
    } else {
      this.schoolService.getClasses().subscribe({
        next: (cls: SchoolClassDto[]) => {
          this.classes = cls;
          this.syncSections();
          this.cdr.markForCheck();
        }
      });
    }

    if (this.data?.batches?.length) {
      this.allBatches = this.data.batches;
    } else {
      this.batchesService.getBatches().subscribe({
        next: (b: BatchDto[]) => {
          this.allBatches = b;
          this.cdr.markForCheck();
        }
      });
    }

    this.feesService.getUpiPaymentSettings().subscribe({
      next: (settings: UpiPaymentSettings) => {
        this.payeeUpiId = settings.effectiveUpiId || settings.upiId || 'imserp.fees@sbi';
        this.payeeMerchantName = settings.effectiveMerchantName || settings.upiMerchantName || this.authService.getInstituteName();
      },
      error: () => {
        this.payeeMerchantName = this.authService.getInstituteName();
      }
    });

    // Server-side debounced search
    this.filterForm.get('searchTerm')?.valueChanges
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.pageIndex = 0;
        this.loadBulkData();
      });

    this.syncSections();
    this.loadBulkData();
  }

  ngOnDestroy(): void {
    const frame = document.getElementById('imserp-bulk-print-frame');
    if (frame) {
      try { frame.remove(); } catch (_) {}
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  getInvoicePeriodLabel(inv: BulkDueSlipInvoiceItem): string {
    const period = (inv?.period || '').trim();
    const title = (inv?.title || '').trim();

    // 1. If period already contains Quarterly, Half-Yearly, Yearly, Annual, or a range (–), use period
    if (period && (/(Quarterly|Half-Yearly|Yearly|Annual)/i.test(period) || period.includes('–') || period.includes(' - '))) {
      return period;
    }

    // 2. If title contains Quarterly, Half-Yearly, Yearly, Annual, or a range (–), use title
    if (title && (/(Quarterly|Half-Yearly|Yearly|Annual)/i.test(title) || title.includes('–') || title.includes(' - '))) {
      return title;
    }

    // 3. For monthly invoices: e.g. "October 2026 Fee (Monthly)" -> "October 2026"
    if (title && /\(Monthly\)/i.test(title)) {
      return title.replace(/\s*Fee\s*\(Monthly\)\s*$/i, '').replace(/\s*\(Monthly\)\s*$/i, '').trim();
    }

    return period || title || '';
  }

  get docType(): 'dues' | 'receipts' | 'register' {
    return this.filterForm.get('docType')?.value || 'dues';
  }

  get dueSlipsTotalCount(): number {
    return this.bulkData?.pagination?.dueSlipsTotalCount ?? (this.bulkData?.dueSlips?.length || 0);
  }

  get receiptsTotalCount(): number {
    return this.bulkData?.pagination?.receiptsTotalCount ?? (this.bulkData?.receipts?.length || 0);
  }

  get registerTotalCount(): number {
    return this.bulkData?.pagination?.registerTotalCount ?? (this.bulkData?.registerRows?.length || 0);
  }

  get cycleType(): 'Monthly' | 'Quarterly' | 'HalfYearly' | 'Yearly' {
    return this.filterForm.get('cycleType')?.value || 'Monthly';
  }

  get division(): string {
    return this.filterForm.get('division')?.value || 'all';
  }

  get selectedClassId(): string {
    return this.filterForm.get('classId')?.value || '';
  }

  get cascadedBatches(): BatchDto[] {
    if (!this.selectedClassId) return this.allBatches;
    return this.allBatches.filter(b => b.classId === this.selectedClassId);
  }

  setControl(name: string, val: any): void {
    this.filterForm.get(name)?.setValue(val);
    this.cdr.markForCheck();
  }

  onDocTypeChange(type: 'dues' | 'receipts' | 'register'): void {
    if (this.docType === type) return;
    this.filterForm.get('docType')?.setValue(type, { emitEvent: false });
    this.pageIndex = 0;
    this.sortBy = '';
    this.sortDescending = false;
    this.loadBulkData();
  }

  onFilterChange(): void {
    this.pageIndex = 0;
    this.loadBulkData();
  }

  clearSearch(): void {
    this.filterForm.get('searchTerm')?.setValue('', { emitEvent: false });
    this.pageIndex = 0;
    this.loadBulkData();
  }

  onSort(column: string): void {
    if (this.sortBy === column) {
      this.sortDescending = !this.sortDescending;
    } else {
      this.sortBy = column;
      this.sortDescending = false;
    }
    this.pageIndex = 0;
    this.loadBulkData();
  }

  getSortIcon(column: string): string {
    if (!this.sortBy) {
      if (column === 'totalBalanceDue' || column === 'remainingDue' || column === 'balanceDue') {
        return 'arrow_downward';
      }
      return 'unfold_more';
    }
    if (this.sortBy !== column) return 'unfold_more';
    return this.sortDescending ? 'arrow_downward' : 'arrow_upward';
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadBulkData();
  }

  onCycleChange(cycle: 'Monthly' | 'Quarterly' | 'HalfYearly' | 'Yearly'): void {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const sessionMatch = this.settingsService.academicSession()?.match(/^(\d{4})/);
    const sessionStartYear = sessionMatch ? parseInt(sessionMatch[1], 10) : (curMonth >= 4 ? curYear : curYear - 1);

    this.filterForm.patchValue({
      cycleType: cycle,
      year: cycle === 'Monthly' ? curYear : sessionStartYear
    });
    this.pageIndex = 0;
    this.loadBulkData();
  }

  onDivisionChange(div: string): void {
    this.filterForm.patchValue({
      division: div,
      sectionId: '',
      batchId: ''
    });
    this.pageIndex = 0;
    this.loadBulkData();
  }

  onClassChange(): void {
    this.filterForm.patchValue({
      sectionId: '',
      batchId: ''
    });
    this.syncSections();
    this.pageIndex = 0;
    this.loadBulkData();
  }

  private syncSections(): void {
    const cls = this.classes.find(c => c.id === this.selectedClassId);
    this.availableSections = cls?.sections || [];
  }

  loadBulkData(): void {
    this.isLoading = true;
    const raw = this.filterForm.getRawValue();
    const activeBranchId = this.authService.selectedBranchId() || undefined;

    this.feesService.getBulkPrintData({
      cycleType: raw.cycleType,
      year: raw.year,
      month: raw.month,
      quarter: raw.quarter,
      halfYear: raw.halfYear,
      division: raw.division,
      classId: raw.classId || null,
      sectionId: raw.sectionId || null,
      batchId: raw.batchId || null,
      branchId: activeBranchId || null,
      includeArrears: raw.includeArrears,
      groupSiblingsFirst: !!raw.groupSiblingsFirst,
      searchTerm: (raw.searchTerm || '').trim() || null,
      sortBy: this.sortBy || null,
      sortDescending: this.sortDescending,
      pageNumber: this.pageIndex + 1,
      pageSize: this.pageSize
    }).subscribe({
      next: (res) => {
        this.bulkData = res;
        this.selectedDueStudentIds.clear();
        this.selectedReceiptNumbers.clear();
        // Dynamic Available Years from Database (Zero Hardcoding)
        if (res.availableYears && res.availableYears.length > 0) {
          this.availableYears = res.availableYears;
          const currentYear = this.filterForm.get('year')?.value;
          if (currentYear && !this.availableYears.includes(currentYear)) {
            this.filterForm.patchValue({ year: this.availableYears[0] }, { emitEvent: false });
          }
        }
        const dueTotal = res.pagination?.dueSlipsTotalCount ?? (res.dueSlips || []).length;
        const rcpTotal = res.pagination?.receiptsTotalCount ?? (res.receipts || []).length;
        if (this.docType === 'dues' && dueTotal === 0 && rcpTotal > 0 && this.pageIndex === 0) {
          this.filterForm.get('docType')?.setValue('receipts', { emitEvent: false });
        }
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        const msg = err?.status === 404
          ? 'New Bulk Print API endpoint (/api/fees/bulk-print-data) was not found on the running backend server. Please restart the Backend API (Visual Studio / dotnet run) once so the new C# code loads.'
          : (err?.error?.message || 'Unable to load bulk fee records. Please try again.');
        this.confirmDialog.alert('Error Loading Bulk Fee Data', msg, 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  get filteredDueSlips(): BulkDueSlipItem[] {
    const list = [...(this.bulkData?.dueSlips || [])];
    if (this.filterForm.get('groupSiblingsFirst')?.value) {
      return list;
    }
    if (!this.sortBy) {
      return list.sort((a, b) => (b.totalBalanceDue || 0) - (a.totalBalanceDue || 0) || (b.totalInvoiced || 0) - (a.totalInvoiced || 0));
    }
    return list;
  }

  get filteredReceipts(): BulkReceiptItem[] {
    const list = [...(this.bulkData?.receipts || [])];
    if (!this.sortBy) {
      return list.sort((a, b) => (b.remainingDue || 0) - (a.remainingDue || 0) || (b.amountPaid || 0) - (a.amountPaid || 0));
    }
    return list;
  }

  get filteredRegisterRows(): BulkRegisterRow[] {
    const list = [...(this.bulkData?.registerRows || [])];
    if (this.filterForm.get('groupSiblingsFirst')?.value) {
      return list;
    }
    if (!this.sortBy) {
      return list.sort((a, b) => (b.balanceDue || 0) - (a.balanceDue || 0) || (b.totalInvoiced || 0) - (a.totalInvoiced || 0));
    }
    return list;
  }

  // Selection Helpers
  isAllDueSlipsSelected(): boolean {
    const rows = this.filteredDueSlips;
    return rows.length > 0 && rows.every(r => this.selectedDueStudentIds.has(r.studentId));
  }

  isSomeDueSlipsSelected(): boolean {
    const rows = this.filteredDueSlips;
    const count = rows.filter(r => this.selectedDueStudentIds.has(r.studentId)).length;
    return count > 0 && count < rows.length;
  }

  toggleAllDueSlips(checked: boolean): void {
    for (const r of this.filteredDueSlips) {
      if (checked) this.selectedDueStudentIds.add(r.studentId);
      else this.selectedDueStudentIds.delete(r.studentId);
    }
  }

  toggleDueSlipRow(studentId: string, checked?: boolean): void {
    const isChecked = checked !== undefined ? checked : !this.selectedDueStudentIds.has(studentId);
    if (isChecked) this.selectedDueStudentIds.add(studentId);
    else this.selectedDueStudentIds.delete(studentId);

    // When Group Siblings Together is active, auto-select/unselect matching siblings on the page
    if (this.filterForm.get('groupSiblingsFirst')?.value) {
      const targetSlip = this.filteredDueSlips.find(s => s.studentId === studentId);
      if (targetSlip?.siblingsInfo?.length) {
        for (const sib of targetSlip.siblingsInfo) {
          if (this.filteredDueSlips.some(s => s.studentId === sib.studentId)) {
            if (isChecked) this.selectedDueStudentIds.add(sib.studentId);
            else this.selectedDueStudentIds.delete(sib.studentId);
          }
        }
      }
    }
  }

  openCombinedFamilyDemandBill(slip: BulkDueSlipItem): void {
    if (!slip) return;
    const dialogRef = this.dialog.open(FeeDueReceiptDialogComponent, {
      width: '840px',
      maxWidth: '96vw',
      panelClass: 'receipt-dialog-panel',
      data: {
        studentId: slip.studentId,
        studentName: slip.studentName,
        rollNumber: slip.rollNumber,
        batchName: slip.batchName,
        className: slip.className,
        sectionName: slip.sectionName,
        parentWhatsAppPhone: slip.parentPhone,
        instituteName: this.authService.getInstituteName(),
        branchName: slip.branchName || this.authService.getCurrentBranchName(),
        initialCombinedFamilyMode: true
      }
    });

    dialogRef.afterClosed().subscribe((action) => {
      if (action === 'COLLECT_NOW') {
        this.openQuickCollect(slip);
      }
    });
  }

  private renderSiblingFamilyNoteHtml(slip: BulkDueSlipItem, compact = false): string {
    const sibsWithDues = (slip.siblingsInfo || []).filter(s => s.balanceDue > 0);
    if (sibsWithDues.length === 0) return '';
    const sibText = sibsWithDues
      .map(s => `${s.studentName} (${s.className || s.batchName || 'Gen'}: ₹${Number(s.balanceDue).toLocaleString('en-IN')})`)
      .join(', ');
    const famTotal = Number(slip.familyTotalDue || (slip.totalBalanceDue + sibsWithDues.reduce((a, b) => a + b.balanceDue, 0))).toLocaleString('en-IN');
    if (compact) {
      return `<div style="font-size:6.8px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;border-radius:3px;padding:1.5px 4px;margin-bottom:2px;display:flex;justify-content:space-between;gap:4px;white-space:nowrap;overflow:hidden;"><span>👨‍👩‍👧‍👦 Sibling: <strong>${sibText}</strong></span><strong style="color:#b91c1c;">Family Total: ₹${famTotal}</strong></div>`;
    }
    return `<div style="font-size:8px;background:#eff6ff;border:1px solid #93c5fd;color:#1e3a8a;border-radius:4px;padding:2.5px 6px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;gap:6px;"><span>👨‍👩‍👧‍👦 <strong>Family Sibling Dues:</strong> ${sibText}</span><strong style="color:#b91c1c;white-space:nowrap;">Total Family Due: ₹${famTotal}</strong></div>`;
  }

  getSelectedDueSlipsTotal(): number {
    return this.filteredDueSlips
      .filter(s => this.selectedDueStudentIds.has(s.studentId))
      .reduce((acc, s) => acc + (s.totalBalanceDue || 0), 0);
  }

  isAllReceiptsSelected(): boolean {
    const rows = this.filteredReceipts;
    return rows.length > 0 && rows.every(r => this.selectedReceiptNumbers.has(r.receiptNumber));
  }

  isSomeReceiptsSelected(): boolean {
    const rows = this.filteredReceipts;
    const count = rows.filter(r => this.selectedReceiptNumbers.has(r.receiptNumber)).length;
    return count > 0 && count < rows.length;
  }

  toggleAllReceipts(checked: boolean): void {
    for (const r of this.filteredReceipts) {
      if (checked) this.selectedReceiptNumbers.add(r.receiptNumber);
      else this.selectedReceiptNumbers.delete(r.receiptNumber);
    }
  }

  toggleReceiptRow(receiptNumber: string, checked?: boolean): void {
    const isChecked = checked !== undefined ? checked : !this.selectedReceiptNumbers.has(receiptNumber);
    if (isChecked) this.selectedReceiptNumbers.add(receiptNumber);
    else this.selectedReceiptNumbers.delete(receiptNumber);
  }

  getSelectedReceiptsTotal(): number {
    return this.filteredReceipts
      .filter(r => this.selectedReceiptNumbers.has(r.receiptNumber))
      .reduce((acc, r) => acc + (r.amountPaid || 0), 0);
  }

  getScopeBadgeText(): string {
    const cls = this.classes.find(c => c.id === this.selectedClassId);
    const clsText = cls ? cls.name : 'All Classes';
    const divText = this.division === 'school' ? 'School Division' : this.division === 'coaching' ? 'Coaching Division' : 'All Divisions';
    return `${clsText} • ${divText}`;
  }

  isHighestDue(slip: BulkDueSlipItem): boolean {
    if (!slip || !slip.totalBalanceDue || slip.totalBalanceDue <= 0) return false;
    const allDues = (this.bulkData?.dueSlips || []).map(s => s.totalBalanceDue || 0);
    if (!allDues.length) return false;
    const maxDue = Math.max(...allDues);
    return maxDue > 0 && slip.totalBalanceDue === maxDue;
  }

  openQuickCollect(slip: BulkDueSlipItem): void {
    if (!slip) return;
    const dialogRef = this.dialog.open(FeeCollectionDialogComponent, {
      width: '880px',
      maxWidth: '96vw',
      panelClass: 'responsive-fee-collection-dialog',
      data: {
        studentId: slip.studentId,
        studentName: slip.studentName,
        rollNumber: slip.rollNumber,
        className: slip.className,
        sectionName: slip.sectionName,
        batchName: slip.batchName,
        parentWhatsAppPhone: slip.parentPhone,
        totalOutstandingDue: slip.totalBalanceDue,
        initialAmount: slip.totalBalanceDue,
        branchName: slip.branchName || this.authService.getCurrentBranchName()
      }
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res) {
        this.loadBulkData();
        this.dialog.open(FeeReceiptDialogComponent, {
          width: '840px',
          maxWidth: '96vw',
          panelClass: 'receipt-dialog-panel',
          data: {
            receipt: res,
            instituteName: this.authService.getInstituteName(),
            branchName: res.branchName || slip.branchName || this.authService.getCurrentBranchName()
          }
        });
      }
    });
  }

  openVoiceReminder(slip: BulkDueSlipItem): void {
    if (!slip) return;
    const firstInv = slip.invoices?.[0];
    const dialogRef = this.dialog.open(StudentVoiceDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      data: {
        plan: {
          id: firstInv?.invoiceId || slip.studentId,
          studentId: slip.studentId,
          studentName: slip.studentName,
          rollNumber: slip.rollNumber,
          className: slip.className || '',
          sectionName: slip.sectionName || '',
          batchName: slip.batchName || '',
          parentName: slip.parentName || '',
          totalOverdueAmount: slip.totalBalanceDue,
          parentPhone: slip.parentPhone,
          invoiceNumber: firstInv?.invoiceNumber || 'FEE-DUE',
          dueDate: firstInv?.dueDate || null,
          alreadyRemindedToday: false
        },
        instituteName: this.authService.getInstituteName(),
        dueDay: firstInv?.dueDate ? new Date(firstInv.dueDate).getDate() : 10,
        initialGender: 'Female'
      }
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res?.dispatched) {
        this.confirmDialog.alert(
          'AI Voice Reminder Dispatched',
          `AI Hindi Voice reminder successfully sent to ${slip.studentName} (+${slip.parentPhone || ''}).`
        );
      }
    });
  }

  openWhatsAppReminder(slip: BulkDueSlipItem): void {
    if (!slip) return;
    const firstInv = slip.invoices?.[0];
    const isSchool = slip.division?.toLowerCase() === 'school' || (!!slip.className && !slip.batchName);
    const isCoaching = slip.division?.toLowerCase() === 'coaching' || !!slip.batchName;

    this.dialog.open(FeeReminderDispatchDialogComponent, {
      width: '780px',
      maxWidth: '96vw',
      data: {
        mode: 'single',
        invoice: {
          id: firstInv?.invoiceId || slip.studentId,
          studentId: slip.studentId,
          studentName: slip.studentName,
          rollNumber: slip.rollNumber,
          className: slip.className,
          invoiceNumber: firstInv?.invoiceNumber || 'FEE-DUE',
          totalAmount: slip.totalInvoiced || slip.totalBalanceDue,
          paidAmount: slip.paidAmount || 0,
          dueAmount: slip.totalBalanceDue,
          status: 'Overdue',
          dueDate: firstInv?.dueDate || new Date(),
          parentWhatsAppPhone: slip.parentPhone,
          alreadyRemindedToday: false,
          isSchoolStudent: isSchool,
          isCoachingStudent: isCoaching,
          scopeTag: slip.division || (isCoaching ? 'Coaching' : 'School')
        },
        instituteName: this.authService.getInstituteName()
      }
    });
  }

  isPrintDisabled(): boolean {
    if (this.docType === 'dues') return this.selectedDueStudentIds.size === 0;
    if (this.docType === 'receipts') return this.selectedReceiptNumbers.size === 0;
    return this.filteredRegisterRows.length === 0;
  }

  // ─── Dynamic Multi-Page A4 Print Engine (Zero Hardcoding) ───
  async executeBulkPrint(): Promise<void> {
    const instituteName = this.authService.getInstituteName();
    const logoUrl = this.authService.getInstituteLogoUrl();
    const sealUrl = this.authService.getOfficialSealUrl();
    const sigUrl = this.authService.getDigitalSignatureUrl();
    const user = this.authService.currentUser();
    const activeBranchId = this.authService.selectedBranchId() || user?.branchId;
    const activeBranch = user?.branches?.find(b => b.id === activeBranchId);
    const branchName = this.bulkData?.branchName || activeBranch?.name || user?.branchName || '';
    const address = (user as any)?.instituteAddress || '';
    const phone = (user as any)?.contactPhone || '';
    const email = (user as any)?.contactEmail || '';
    const authorityName = user?.fullName || 'Authorized Signatory';
    const printLayout = this.filterForm.get('printLayout')?.value || 'four_per_page';
    const footerNoteEn = this.settingsService.receiptFooterNoteEnglish();
    const footerNoteHi = this.settingsService.receiptFooterNoteHindi();
    const showOnReceipt = this.settingsService.showFooterNoteOnReceipt();
    const showOnDue = this.settingsService.showFooterNoteOnDueSlip();
    const nowIstStr = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    let bodyHtml = '';
    if (this.docType === 'dues') {
      const slips = this.filteredDueSlips.filter(s => this.selectedDueStudentIds.has(s.studentId));

      // Asynchronously pre-generate UPI QR Code for each due slip
      await Promise.all(slips.map(async slip => {
        if (slip.totalBalanceDue > 0) {
          const amount = slip.totalBalanceDue;
          const payee = (this.payeeUpiId || '').trim();
          const name = (this.payeeMerchantName || instituteName || 'Institute').trim();
          const student = (slip.studentName || '').trim();
          const shortRef = (slip.invoices?.[0]?.invoiceNumber || slip.studentId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-12);
          const cleanNote = shortRef ? `Fee Due ${shortRef}` : 'Fee Payment';

          if (payee) {
            const upiUri = `upi://pay?pa=${payee}&pn=${encodeURIComponent(name)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(cleanNote)}`;
            try {
              slip.qrDataUrl = await QRCode.toDataURL(upiUri, {
                width: 360,
                margin: 2,
                errorCorrectionLevel: 'M',
                color: { dark: '#000000', light: '#ffffff' }
              });
            } catch (err) {
              console.error('Failed to generate due slip QR code:', err);
            }
          }
        }
      }));

      bodyHtml = this.buildBulkDueSlipsHtml(slips, {
        instituteName, logoUrl, sealUrl, sigUrl, branchName, address, phone, email, authorityName, printLayout, nowIstStr,
        footerNoteEn, footerNoteHi, showOnReceipt, showOnDue
      });
    } else if (this.docType === 'receipts') {
      const receipts = this.filteredReceipts.filter(r => this.selectedReceiptNumbers.has(r.receiptNumber));

      // Asynchronously pre-generate QR Code for each receipt
      await Promise.all(receipts.map(async rcp => {
        try {
          if (rcp.remainingDue > 0) {
            const amount = rcp.remainingDue;
            const payee = (this.payeeUpiId || '').trim();
            const name = (this.payeeMerchantName || instituteName || 'Institute').trim();
            const shortRef = (rcp.receiptNumber || '').replace(/[^a-zA-Z0-9]/g, '').slice(-12);
            const cleanNote = shortRef ? `Fee Receipt ${shortRef}` : 'Fee Payment';

            if (payee) {
              const upiUri = `upi://pay?pa=${payee}&pn=${encodeURIComponent(name)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(cleanNote)}`;
              rcp.qrDataUrl = await QRCode.toDataURL(upiUri, {
                width: 420,
                margin: 4,
                errorCorrectionLevel: 'M',
                color: { dark: '#000000', light: '#ffffff' }
              });
            }
          } else {
            const verifyPayload = `IMSERP_FEE_VERIFIED|${rcp.receiptNumber}|${rcp.studentName}|Roll:${rcp.rollNumber || 'NA'}|Paid:INR_${rcp.amountPaid}|Date:${rcp.paymentDate}|Status:CLEARED`;
            rcp.qrDataUrl = await QRCode.toDataURL(verifyPayload, {
              width: 360,
              margin: 4,
              errorCorrectionLevel: 'M',
              color: { dark: '#000000', light: '#ffffff' }
            });
          }
        } catch (err) {
          console.error('Failed to generate receipt QR code:', err);
        }
      }));

      bodyHtml = this.buildBulkReceiptsHtml(receipts, {
        instituteName, logoUrl, sealUrl, sigUrl, branchName, address, phone, email, authorityName, printLayout, nowIstStr,
        footerNoteEn, footerNoteHi, showOnReceipt, showOnDue
      });
    } else {
      bodyHtml = this.buildConsolidatedRegisterHtml(this.filteredRegisterRows, {
        instituteName, logoUrl, sealUrl, sigUrl, branchName, address, phone, email, authorityName, nowIstStr
      });
    }

    this.triggerIframePrint(bodyHtml);
  }

  private renderSlipHeader(meta: any, docTitleEn: string, docTitleHi: string, badgeColor: string): string {
    const logoHtml = meta.logoUrl
      ? `<img src="${meta.logoUrl}" class="inst-logo" alt="Logo" onerror="this.style.display='none'" />`
      : '';
    const contactLine = [meta.address, meta.phone ? `Ph: ${meta.phone}` : '', meta.email].filter(Boolean).join(' • ');
    return `
      <div class="slip-header">
        <div class="inst-brand">
          ${logoHtml}
          <div class="inst-text">
            <div class="inst-name">${meta.instituteName}</div>
            ${meta.branchName ? `<div class="inst-branch">Campus / Branch: ${meta.branchName}</div>` : ''}
            ${contactLine ? `<div class="inst-contact">${contactLine}</div>` : ''}
          </div>
        </div>
        <div class="doc-badge" style="border-color:${badgeColor}; color:${badgeColor};">
          <div class="en">${docTitleEn}</div>
          <div class="hi">${docTitleHi}</div>
        </div>
      </div>
    `;
  }

  private renderSingleDueSlipCard(slip: BulkDueSlipItem, copyLabel: string, meta: any): string {
    const rowsHtml = slip.invoices.map((inv, idx) => {
      const headsLines = (inv.heads || []).map((h, hIdx) => `
        <div class="due-head-line">
          <span class="head-num">${hIdx + 1}.</span>
          <span class="head-name">${h.headName}:</span>
          <span class="head-amount">₹${Number(h.amount).toLocaleString('en-IN')}</span>
        </div>
      `).join('');
      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td>
            <strong>${this.getInvoicePeriodLabel(inv)}</strong> ${inv.isArrear ? '<span class="arr-tag">Arrear</span>' : ''}
            ${headsLines ? `<div class="sub-heads due-item-heads-list">${headsLines}</div>` : ''}
          </td>
          <td>${inv.invoiceNumber}</td>
          <td class="r">₹${Number(inv.finalAmount).toLocaleString('en-IN')}</td>
          <td class="r">${inv.advanceAdjustedAmount > 0 ? '-₹' + Number(inv.advanceAdjustedAmount).toLocaleString('en-IN') : '—'}</td>
          <td class="r">${inv.paidAmount > 0 ? '₹' + Number(inv.paidAmount).toLocaleString('en-IN') : '—'}</td>
          <td class="r"><strong style="color:#b91c1c;">₹${Number(inv.balanceDue).toLocaleString('en-IN')}</strong></td>
        </tr>
      `;
    }).join('');

    return `
      <div class="slip-card due-card">
        <div class="copy-tag">${copyLabel}</div>
        ${this.renderSlipHeader(meta, 'FEE DEMAND & DUE SLIP', 'शुल्क बकाया मांग पर्ची', '#b91c1c')}
        <div class="st-grid">
          <div><span>Student Name (विद्यार्थी):</span> <strong>${slip.studentName}</strong></div>
          <div><span>Roll / Adm No:</span> <strong>${slip.rollNumber} / ${slip.admissionNumber}</strong></div>
          <div><span>Class / Section:</span> <strong>${slip.className || 'N/A'}${slip.sectionName ? ' - ' + slip.sectionName : ''}${slip.batchName ? ' (' + slip.batchName + ')' : ''}</strong></div>
          <div><span>Billing Cycle:</span> <strong>${slip.periodLabel}</strong></div>
          <div><span>Parent / Guardian:</span> <strong>${slip.parentName || '—'} (${slip.parentPhone || '—'})</strong></div>
          <div><span>Date (IST):</span> <strong>${meta.nowIstStr}</strong></div>
        </div>
        <table class="p-table">
          <thead>
            <tr>
              <th style="width:32px;">#</th>
              <th>Fee Period &amp; Head Particulars (विवरण)</th>
              <th>Invoice No</th>
              <th class="r">Billed</th>
              <th class="r">Adv. Adj</th>
              <th class="r">Paid</th>
              <th class="r">Net Due</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="3" class="r"><strong>TOTAL PAYABLE DUES (कुल देय बकाया राशि):</strong></td>
              <td class="r"><strong>₹${Number(slip.totalInvoiced).toLocaleString('en-IN')}</strong></td>
              <td class="r"><strong>${slip.advanceAdjusted > 0 ? '-₹' + Number(slip.advanceAdjusted).toLocaleString('en-IN') : '—'}</strong></td>
              <td class="r"><strong>₹${Number(slip.paidAmount).toLocaleString('en-IN')}</strong></td>
              <td class="r due-grand"><strong>₹${Number(slip.totalBalanceDue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
            </tr>
          </tfoot>
        </table>
        ${this.renderSiblingFamilyNoteHtml(slip, false)}
        <div class="slip-footer">
          <div class="note">
            ${meta.showOnDue && meta.footerNoteHi ? `<div><strong>नोट:</strong> ${meta.footerNoteHi}</div>` : ''}
            ${meta.showOnDue && meta.footerNoteEn ? `<div><strong>Note:</strong> ${meta.footerNoteEn}</div>` : ''}
            ${!meta.showOnDue || (!meta.footerNoteHi && !meta.footerNoteEn) ? `<strong>Notice (सूचना):</strong> कृपया निर्धारित तिथि तक विद्यालय/संस्थान कार्यालय या UPI / ऑनलाइन माध्यम से बकाया शुल्क जमा करें।` : ''}
          </div>
          ${slip.qrDataUrl ? `
            <div class="qr-box">
              <img src="${slip.qrDataUrl}" class="qr-img" alt="UPI QR Code" />
              <div class="qr-lbl">Scan to Pay ₹${Number(slip.totalBalanceDue).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
              <div class="qr-sub">BHIM UPI / Any UPI App</div>
            </div>
          ` : ''}
          <div class="sig-box">
            ${meta.sigUrl ? `<img src="${meta.sigUrl}" class="sig-img" alt="Sign" onerror="this.style.display='none'" />` : ''}
            <div class="sig-line">${meta.authorityName}</div>
            <div class="sig-sub">Authorized Signatory</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderGrid4DueSlipCard(slip: BulkDueSlipItem, meta: any): string {
    const rowsHtml = slip.invoices.map((inv, idx) => {
      const heads = inv.heads || [];
      const periodLabel = this.getInvoicePeriodLabel(inv);
      const paidOrAdv = (inv.paidAmount > 0 || inv.advanceAdjustedAmount > 0)
        ? '₹' + Number(inv.paidAmount + inv.advanceAdjustedAmount).toLocaleString('en-IN')
        : '—';

      if (heads.length > 1) {
        // Multi-head invoice: Period header row, then each head with amount in Billed column, then Subtotal row
        const headRows = heads.map((h, hIdx) => `
          <tr class="g4-head-row">
            <td class="g4-head-name-td">&nbsp;&nbsp;${hIdx + 1}. ${h.headName}</td>
            <td class="r g4-head-amt-td">₹${Number(h.amount).toLocaleString('en-IN')}</td>
            <td class="r g4-dim-td">—</td>
            <td class="r g4-dim-td">—</td>
          </tr>
        `).join('');

        return `
          <tr class="g4-period-row">
            <td colspan="4">
              <strong>${periodLabel}</strong> ${inv.isArrear ? '<span class="arr-pill">Arrear</span>' : ''}
            </td>
          </tr>
          ${headRows}
          <tr class="g4-subtotal-row">
            <td class="g4-subtotal-lbl"><em>${periodLabel} Total:</em></td>
            <td class="r g4-subtotal-billed"><strong>₹${Number(inv.finalAmount).toLocaleString('en-IN')}</strong></td>
            <td class="r">${paidOrAdv}</td>
            <td class="r"><strong style="color:#b91c1c;">₹${Number(inv.balanceDue).toLocaleString('en-IN')}</strong></td>
          </tr>
        `;
      } else if (heads.length === 1) {
        // Single head invoice: Period and head in 1 row with amount in Billed column
        return `
          <tr class="g4-single-row">
            <td>
              <strong>${periodLabel}</strong> ${inv.isArrear ? '<span class="arr-pill">Arrear</span>' : ''}
              <div class="g4-single-head-sub">1. ${heads[0].headName}</div>
            </td>
            <td class="r" style="vertical-align:middle;"><strong>₹${Number(heads[0].amount || inv.finalAmount).toLocaleString('en-IN')}</strong></td>
            <td class="r" style="vertical-align:middle;">${paidOrAdv}</td>
            <td class="r" style="vertical-align:middle;"><strong style="color:#b91c1c;">₹${Number(inv.balanceDue).toLocaleString('en-IN')}</strong></td>
          </tr>
        `;
      } else {
        // Fallback for invoice with no heads broken down
        return `
          <tr class="g4-single-row">
            <td>
              <strong>${periodLabel}</strong> ${inv.isArrear ? '<span class="arr-pill">Arrear</span>' : ''}
            </td>
            <td class="r" style="vertical-align:middle;"><strong>₹${Number(inv.finalAmount).toLocaleString('en-IN')}</strong></td>
            <td class="r" style="vertical-align:middle;">${paidOrAdv}</td>
            <td class="r" style="vertical-align:middle;"><strong style="color:#b91c1c;">₹${Number(inv.balanceDue).toLocaleString('en-IN')}</strong></td>
          </tr>
        `;
      }
    }).join('');

    return `
      <div class="slip-card card-grid-4">
        <div>
          <div class="grid4-header">
            <div class="grid4-brand">
              ${meta.logoUrl ? `<img src="${meta.logoUrl}" class="grid4-logo" alt="Logo" onerror="this.style.display='none'" />` : ''}
              <div class="grid4-inst-info">
                <div class="grid4-inst-name">${meta.instituteName}</div>
                ${meta.branchName ? `<div class="grid4-inst-sub">Campus: ${meta.branchName}</div>` : ''}
                ${meta.phone ? `<div class="grid4-inst-contact">📞 ${meta.phone}</div>` : ''}
              </div>
            </div>
            <div class="grid4-badge">
              <span class="g4-badge-title">DEMAND BILL</span>
              <span class="g4-badge-hi">मांग पर्ची</span>
            </div>
          </div>

          <div class="grid4-meta-grid">
            <div><span class="lbl">Student:</span> <strong>${slip.studentName}</strong> (R: ${slip.rollNumber || '—'})</div>
            <div><span class="lbl">Class/Sec:</span> <strong>${slip.className || 'N/A'}${slip.sectionName ? '-' + slip.sectionName : ''}${slip.batchName ? ' (' + slip.batchName + ')' : ''}</strong></div>
            <div><span class="lbl">Adm No:</span> <strong>${slip.admissionNumber || '—'}</strong></div>
            <div><span class="lbl">Cycle:</span> <strong>${slip.periodLabel}</strong></div>
            <div><span class="lbl">Parent:</span> <strong>${slip.parentName || '—'}</strong></div>
            <div><span class="lbl">Mobile:</span> <strong>${slip.parentPhone || '—'}</strong></div>
          </div>

          <table class="grid4-table">
            <thead>
              <tr>
                <th style="width: 52%;">Fee Particulars / Heads</th>
                <th class="r" style="width: 16%;">Billed</th>
                <th class="r" style="width: 14%;">Paid</th>
                <th class="r" style="width: 18%;">Net Due</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          <div class="grid4-due-banner">
            <span class="g4-due-lbl">TOTAL BALANCE DUE (कुल देय बकाया):</span>
            <span class="g4-due-amount">₹${Number(slip.totalBalanceDue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          ${this.renderSiblingFamilyNoteHtml(slip, true)}
        </div>

        <div class="grid4-footer">
          <div class="grid4-notice">
            <div class="g4-note">कृपया देय तिथि से पूर्व शुल्क जमा कराएं।</div>
            <div class="g4-date">Printed (IST): ${meta.nowIstStr}</div>
          </div>
          ${slip.qrDataUrl ? `
            <div class="grid4-qr">
              <img src="${slip.qrDataUrl}" class="g4-qr-img" alt="UPI QR" />
              <span class="g4-qr-txt">Scan UPI to Pay</span>
            </div>
          ` : ''}
          <div class="grid4-sig">
            ${meta.sigUrl ? `<img src="${meta.sigUrl}" style="max-height:20px;display:block;margin:0 auto 1px;" alt="Sign" onerror="this.style.display='none'" />` : ''}
            <div class="g4-sig-line">${meta.authorityName}</div>
            <div class="g4-sig-sub">Auth Signatory</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderGrid8DueSlipCard(slip: BulkDueSlipItem, meta: any): string {
    const arrearsTotal = slip.invoices.filter(i => i.isArrear).reduce((acc, curr) => acc + (curr.balanceDue || 0), 0);

    return `
      <div class="slip-card card-grid-8">
        <div>
          <div class="grid8-header">
            <div class="g8-brand">
              ${meta.logoUrl ? `<img src="${meta.logoUrl}" class="g8-logo" alt="Logo" onerror="this.style.display='none'" />` : ''}
              <div class="g8-inst-info">
                <div class="g8-inst">${meta.instituteName}</div>
                ${meta.branchName ? `<div class="g8-branch">Campus: ${meta.branchName}</div>` : ''}
              </div>
            </div>
            <div class="g8-badge">FEE DEMAND SLIP (मांग पर्ची)</div>
          </div>

          <div class="grid8-info">
            <div class="g8-row">
              <span><strong>${slip.studentName}</strong> (Roll: ${slip.rollNumber || '—'}, Adm: ${slip.admissionNumber || '—'})</span>
              <span>Class: <strong>${slip.className || 'N/A'}${slip.sectionName ? '-' + slip.sectionName : ''}</strong></span>
            </div>
            <div class="g8-row">
              <span>Parent: ${slip.parentName || '—'} (📞 ${slip.parentPhone || '—'})</span>
              <span>Cycle: <strong>${slip.periodLabel}</strong></span>
            </div>
          </div>

          <div class="grid8-summary">
            <div class="g8-stat"><span>Billed:</span> <strong>₹${Number(slip.totalInvoiced).toLocaleString('en-IN')}</strong></div>
            ${arrearsTotal > 0 ? `<div class="g8-stat" style="color:#c2410c;"><span>Arrears:</span> <strong>₹${Number(arrearsTotal).toLocaleString('en-IN')}</strong></div>` : ''}
            <div class="g8-stat"><span>Paid:</span> <strong>₹${Number(slip.paidAmount + slip.advanceAdjusted).toLocaleString('en-IN')}</strong></div>
            <div class="g8-net-due">
              <span>NET DUE:</span>
              <strong>₹${Number(slip.totalBalanceDue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>
          ${this.renderSiblingFamilyNoteHtml(slip, true)}
        </div>

        <div class="grid8-footer">
          <div class="g8-foot-left">
            <span>Pay before due date to avoid late fine • IST: ${meta.nowIstStr}</span>
          </div>
          ${slip.qrDataUrl ? `
            <div class="grid8-qr">
              <img src="${slip.qrDataUrl}" class="g8-qr-img" alt="QR" />
              <span>Scan UPI</span>
            </div>
          ` : ''}
          <div class="grid8-sig">
            <div class="g8-sig-line">Auth. Signatory</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderGrid3DueSlipCard(slip: BulkDueSlipItem, meta: any): string {
    const rowsHtml = slip.invoices.map((inv) => {
      const heads = inv.heads || [];
      const periodLabel = this.getInvoicePeriodLabel(inv);
      const paidOrAdv = (inv.paidAmount > 0 || inv.advanceAdjustedAmount > 0)
        ? '₹' + Number(inv.paidAmount + inv.advanceAdjustedAmount).toLocaleString('en-IN')
        : '—';

      if (heads.length > 1) {
        const headRows = heads.map((h, hIdx) => `
          <tr class="g3-head-row">
            <td class="g3-head-name-td">&nbsp;&nbsp;${hIdx + 1}. ${h.headName}</td>
            <td class="r g3-head-amt-td">₹${Number(h.amount).toLocaleString('en-IN')}</td>
            <td class="r g3-dim-td">—</td>
            <td class="r g3-dim-td">—</td>
          </tr>
        `).join('');

        return `
          <tr class="g3-period-row">
            <td colspan="4">
              <strong>${periodLabel}</strong> ${inv.isArrear ? '<span class="arr-pill">Arrear</span>' : ''}
            </td>
          </tr>
          ${headRows}
          <tr class="g3-subtotal-row">
            <td class="g3-subtotal-lbl"><em>${periodLabel} Total:</em></td>
            <td class="r g3-subtotal-billed"><strong>₹${Number(inv.finalAmount).toLocaleString('en-IN')}</strong></td>
            <td class="r">${paidOrAdv}</td>
            <td class="r"><strong style="color:#b91c1c;">₹${Number(inv.balanceDue).toLocaleString('en-IN')}</strong></td>
          </tr>
        `;
      } else if (heads.length === 1) {
        return `
          <tr class="g3-single-row">
            <td>
              <strong>${periodLabel}</strong> ${inv.isArrear ? '<span class="arr-pill">Arrear</span>' : ''}
              <div class="g3-single-head-sub">1. ${heads[0].headName}</div>
            </td>
            <td class="r" style="vertical-align:middle;"><strong>₹${Number(heads[0].amount || inv.finalAmount).toLocaleString('en-IN')}</strong></td>
            <td class="r" style="vertical-align:middle;">${paidOrAdv}</td>
            <td class="r" style="vertical-align:middle;"><strong style="color:#b91c1c;">₹${Number(inv.balanceDue).toLocaleString('en-IN')}</strong></td>
          </tr>
        `;
      } else {
        return `
          <tr class="g3-single-row">
            <td>
              <strong>${periodLabel}</strong> ${inv.isArrear ? '<span class="arr-pill">Arrear</span>' : ''}
            </td>
            <td class="r" style="vertical-align:middle;"><strong>₹${Number(inv.finalAmount).toLocaleString('en-IN')}</strong></td>
            <td class="r" style="vertical-align:middle;">${paidOrAdv}</td>
            <td class="r" style="vertical-align:middle;"><strong style="color:#b91c1c;">₹${Number(inv.balanceDue).toLocaleString('en-IN')}</strong></td>
          </tr>
        `;
      }
    }).join('');

    return `
      <div class="slip-card card-grid-3">
        <div>
          <div class="g3-header">
            <div class="g3-brand">
              ${meta.logoUrl ? `<img src="${meta.logoUrl}" class="g3-logo" alt="Logo" onerror="this.style.display='none'" />` : ''}
              <div class="g3-inst-info">
                <div class="g3-inst-name">${meta.instituteName}</div>
                <div class="g3-inst-meta">${meta.branchName ? 'Campus: ' + meta.branchName : ''} ${meta.phone ? '• 📞 ' + meta.phone : ''} ${meta.address ? '• ' + meta.address : ''}</div>
              </div>
            </div>
            <div class="g3-badge">
              <span class="g3-badge-title">FEE DEMAND BILL</span>
              <span class="g3-badge-hi">मांग पर्ची</span>
            </div>
          </div>

          <div class="g3-meta-grid">
            <div><span class="lbl">Student:</span> <strong>${slip.studentName}</strong> (R: ${slip.rollNumber || '—'}, Adm: ${slip.admissionNumber || '—'})</div>
            <div><span class="lbl">Class / Sec:</span> <strong>${slip.className || 'N/A'}${slip.sectionName ? ' - ' + slip.sectionName : ''}${slip.batchName ? ' (' + slip.batchName + ')' : ''}</strong></div>
            <div><span class="lbl">Parent / Guardian:</span> <strong>${slip.parentName || '—'}</strong> (${slip.parentPhone || 'No Phone'})</div>
            <div><span class="lbl">Cycle:</span> <strong>${slip.periodLabel}</strong> • IST: ${meta.nowIstStr}</div>
          </div>

          <table class="g3-table">
            <thead>
              <tr>
                <th style="width: 52%;">Fee Particulars / Heads</th>
                <th class="r" style="width: 16%;">Billed</th>
                <th class="r" style="width: 14%;">Paid</th>
                <th class="r" style="width: 18%;">Net Due</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          <div class="g3-due-banner">
            <span class="g3-due-lbl">TOTAL BALANCE DUE (कुल देय बकाया):</span>
            <span class="g3-due-amount">₹${Number(slip.totalBalanceDue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          ${this.renderSiblingFamilyNoteHtml(slip, false)}
        </div>

        <div class="g3-footer">
          <div class="g3-notice">
            <div class="g3-note">कृपया देय तिथि से पूर्व विद्यालय/संस्थान कार्यालय या UPI द्वारा शुल्क जमा कराएं।</div>
            <div class="g3-date">Official Fee Demand Slip • ${meta.nowIstStr}</div>
          </div>
          ${slip.qrDataUrl ? `
            <div class="g3-qr">
              <img src="${slip.qrDataUrl}" class="g3-qr-img" alt="UPI QR" />
              <span class="g3-qr-txt">Scan UPI</span>
            </div>
          ` : ''}
          <div class="g3-sig">
            ${meta.sigUrl ? `<img src="${meta.sigUrl}" style="max-height:18px;display:block;margin:0 auto 1px;" alt="Sign" onerror="this.style.display='none'" />` : ''}
            <div class="g3-sig-line">${meta.authorityName}</div>
            <div class="g3-sig-sub">Auth Signatory</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderGrid10DueSlipCard(slip: BulkDueSlipItem, meta: any): string {
    const arrearsTotal = slip.invoices.filter(i => i.isArrear).reduce((acc, curr) => acc + (curr.balanceDue || 0), 0);

    return `
      <div class="slip-card card-grid-10">
        <div class="g10-top">
          <div class="g10-header">
            <div class="g10-brand">
              ${meta.logoUrl ? `<img src="${meta.logoUrl}" class="g10-logo" alt="Logo" onerror="this.style.display='none'" />` : ''}
              <div class="g10-inst-info">
                <div class="g10-inst">${meta.instituteName}</div>
                ${meta.branchName ? `<div class="g10-branch">Campus: ${meta.branchName}</div>` : ''}
              </div>
            </div>
            <div class="g10-badge">FEE DEMAND SLIP (मांग पर्ची)</div>
          </div>

          <div class="g10-info">
            <div class="g10-row">
              <span class="g10-st-name"><strong>${slip.studentName}</strong> (R: ${slip.rollNumber || '—'}, Adm: ${slip.admissionNumber || '—'})</span>
              <span class="g10-cls">Class: <strong>${slip.className || 'N/A'}${slip.sectionName ? '-' + slip.sectionName : ''}</strong></span>
            </div>
            <div class="g10-row g10-sub-row">
              <span>Parent: ${slip.parentName || '—'} (📞 ${slip.parentPhone || '—'})</span>
              <span>Cycle: <strong>${slip.periodLabel}</strong></span>
            </div>
          </div>

          <div class="g10-summary">
            <div class="g10-stat"><span>Billed:</span> <strong>₹${Number(slip.totalInvoiced).toLocaleString('en-IN')}</strong></div>
            ${arrearsTotal > 0 ? `<div class="g10-stat" style="color:#c2410c;"><span>Arrears:</span> <strong>₹${Number(arrearsTotal).toLocaleString('en-IN')}</strong></div>` : ''}
            <div class="g10-stat"><span>Paid:</span> <strong>₹${Number(slip.paidAmount + slip.advanceAdjusted).toLocaleString('en-IN')}</strong></div>
            <div class="g10-net-due">
              <span>NET DUE:</span>
              <strong>₹${Number(slip.totalBalanceDue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>
        </div>

        <div class="g10-footer">
          <div class="g10-foot-left">
            <span>Pay before due date to avoid late fine • IST: ${meta.nowIstStr}</span>
          </div>
          ${slip.qrDataUrl ? `
            <div class="g10-qr">
              <img src="${slip.qrDataUrl}" class="g10-qr-img" alt="QR" />
              <span>Scan UPI</span>
            </div>
          ` : ''}
          <div class="g10-sig">
            <div class="g10-sig-line">Auth. Signatory</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderGrid12DueSlipCard(slip: BulkDueSlipItem, meta: any): string {
    const arrearsTotal = slip.invoices.filter(i => i.isArrear).reduce((acc, curr) => acc + (curr.balanceDue || 0), 0);

    return `
      <div class="slip-card card-grid-12">
        <div class="g12-top">
          <div class="g12-header">
            <div class="g12-brand">
              ${meta.logoUrl ? `<img src="${meta.logoUrl}" class="g12-logo" alt="Logo" onerror="this.style.display='none'" />` : ''}
              <div class="g12-inst-info">
                <div class="g12-inst">${meta.instituteName}</div>
                ${meta.branchName ? `<div class="g12-branch">${meta.branchName}</div>` : ''}
              </div>
            </div>
            <div class="g12-badge">DEMAND SLIP</div>
          </div>

          <div class="g12-info">
            <div class="g12-row">
              <span class="g12-st-name"><strong>${slip.studentName}</strong> (R: ${slip.rollNumber || '—'})</span>
              <span class="g12-cls">Class: <strong>${slip.className || 'N/A'}${slip.sectionName ? '-' + slip.sectionName : ''}</strong></span>
            </div>
            <div class="g12-row g12-sub-row">
              <span>Adm: <strong>${slip.admissionNumber || '—'}</strong> • Parent: ${slip.parentName || '—'}</span>
              <span>📞 ${slip.parentPhone || '—'}</span>
            </div>
          </div>

          <div class="g12-summary">
            <div class="g12-stat"><span>Cycle:</span> <strong>${slip.periodLabel}</strong></div>
            <div class="g12-stat"><span>Billed:</span> <strong>₹${Number(slip.totalInvoiced).toLocaleString('en-IN')}</strong></div>
            ${arrearsTotal > 0 ? `<div class="g12-stat" style="color:#c2410c;"><span>Arr:</span> <strong>₹${Number(arrearsTotal).toLocaleString('en-IN')}</strong></div>` : ''}
            <div class="g12-stat"><span>Paid:</span> <strong>₹${Number(slip.paidAmount + slip.advanceAdjusted).toLocaleString('en-IN')}</strong></div>
            <div class="g12-net-due">
              <span>DUE:</span>
              <strong>₹${Number(slip.totalBalanceDue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>
        </div>

        <div class="g12-footer">
          <div class="g12-foot-left">
            <span>Pay before due date • IST: ${meta.nowIstStr}</span>
          </div>
          ${slip.qrDataUrl ? `
            <div class="g12-qr">
              <img src="${slip.qrDataUrl}" class="g12-qr-img" alt="QR" />
              <span>UPI Pay</span>
            </div>
          ` : ''}
          <div class="g12-sig">
            <div class="g12-sig-line">Auth. Signatory</div>
          </div>
        </div>
      </div>
    `;
  }

  private buildBulkDueSlipsHtml(slips: BulkDueSlipItem[], meta: any): string {
    const pages: string[] = [];

    if (meta.printLayout === 'three_per_page') {
      // 3 Students per A4 Page (1x3 Tri-Fold with horizontal tear divider between cards)
      for (let i = 0; i < slips.length; i += 3) {
        const pageSlips = slips.slice(i, i + 3);
        const cardDivs = pageSlips.map(s => this.renderGrid3DueSlipCard(s, meta));
        const dividerHtml = `
          <div class="grid-cut-divider">
            <span class="cut-sc">✂</span>
            <span class="cut-line"></span>
            <span class="cut-txt">CUT / TEAR HERE (यहाँ से काटें / अलग करें)</span>
            <span class="cut-line"></span>
            <span class="cut-sc flip">✂</span>
          </div>
        `;
        pages.push(`
          <div class="a4-page page-layout-3">
            ${cardDivs.join(dividerHtml)}
          </div>
        `);
      }
    } else if (meta.printLayout === 'four_per_page') {
      // 4 Students per A4 Page (2x2 Grid with horizontal tear divider between Row 1 & Row 2)
      for (let i = 0; i < slips.length; i += 4) {
        const pageSlips = slips.slice(i, i + 4);
        const rowDivs: string[] = [];

        for (let r = 0; r < pageSlips.length; r += 2) {
          const s1 = pageSlips[r];
          const s2 = pageSlips[r + 1];
          const card1 = this.renderGrid4DueSlipCard(s1, meta);
          const card2 = s2
            ? this.renderGrid4DueSlipCard(s2, meta)
            : '<div class="slip-card card-grid-4 placeholder-card"></div>';

          rowDivs.push(`
            <div class="grid-row-2">
              ${card1}
              ${card2}
            </div>
          `);
        }

        const dividerHtml = `
          <div class="grid-cut-divider">
            <span class="cut-sc">✂</span>
            <span class="cut-line"></span>
            <span class="cut-txt">CUT / TEAR HERE (यहाँ से काटें / अलग करें)</span>
            <span class="cut-line"></span>
            <span class="cut-sc flip">✂</span>
          </div>
        `;
        pages.push(`
          <div class="a4-page page-layout-4">
            ${rowDivs.join(dividerHtml)}
          </div>
        `);
      }
    } else if (meta.printLayout === 'eight_per_page') {
      // 8 Students per A4 Page (2x4 Grid with horizontal tear dividers between each row)
      for (let i = 0; i < slips.length; i += 8) {
        const pageSlips = slips.slice(i, i + 8);
        const rowDivs: string[] = [];

        for (let r = 0; r < pageSlips.length; r += 2) {
          const s1 = pageSlips[r];
          const s2 = pageSlips[r + 1];
          const card1 = this.renderGrid8DueSlipCard(s1, meta);
          const card2 = s2
            ? this.renderGrid8DueSlipCard(s2, meta)
            : '<div class="slip-card card-grid-8 placeholder-card"></div>';

          rowDivs.push(`
            <div class="grid-row-2">
              ${card1}
              ${card2}
            </div>
          `);
        }

        const dividerHtml = `
          <div class="grid-cut-divider mini">
            <span class="cut-sc">✂</span>
            <span class="cut-line"></span>
            <span class="cut-txt">CUT HERE (यहाँ से काटें)</span>
            <span class="cut-line"></span>
            <span class="cut-sc flip">✂</span>
          </div>
        `;
        pages.push(`
          <div class="a4-page page-layout-8">
            ${rowDivs.join(dividerHtml)}
          </div>
        `);
      }
    } else if (meta.printLayout === 'ten_per_page') {
      // 10 Students per A4 Page (2x5 Grid with horizontal tear dividers between each row)
      for (let i = 0; i < slips.length; i += 10) {
        const pageSlips = slips.slice(i, i + 10);
        const rowDivs: string[] = [];

        for (let r = 0; r < pageSlips.length; r += 2) {
          const s1 = pageSlips[r];
          const s2 = pageSlips[r + 1];
          const card1 = this.renderGrid10DueSlipCard(s1, meta);
          const card2 = s2
            ? this.renderGrid10DueSlipCard(s2, meta)
            : '<div class="slip-card card-grid-10 placeholder-card"></div>';

          rowDivs.push(`
            <div class="grid-row-2">
              ${card1}
              ${card2}
            </div>
          `);
        }

        const dividerHtml = `
          <div class="grid-cut-divider mini">
            <span class="cut-sc">✂</span>
            <span class="cut-line"></span>
            <span class="cut-txt">CUT HERE (यहाँ से काटें)</span>
            <span class="cut-line"></span>
            <span class="cut-sc flip">✂</span>
          </div>
        `;
        pages.push(`
          <div class="a4-page page-layout-10">
            ${rowDivs.join(dividerHtml)}
          </div>
        `);
      }
    } else if (meta.printLayout === 'twelve_per_page') {
      // 12 Students per A4 Page (2x6 Grid with horizontal tear dividers between each row)
      for (let i = 0; i < slips.length; i += 12) {
        const pageSlips = slips.slice(i, i + 12);
        const rowDivs: string[] = [];

        for (let r = 0; r < pageSlips.length; r += 2) {
          const s1 = pageSlips[r];
          const s2 = pageSlips[r + 1];
          const card1 = this.renderGrid12DueSlipCard(s1, meta);
          const card2 = s2
            ? this.renderGrid12DueSlipCard(s2, meta)
            : '<div class="slip-card card-grid-12 placeholder-card"></div>';

          rowDivs.push(`
            <div class="grid-row-2">
              ${card1}
              ${card2}
            </div>
          `);
        }

        const dividerHtml = `
          <div class="grid-cut-divider micro">
            <span class="cut-sc">✂</span>
            <span class="cut-line"></span>
            <span class="cut-txt">CUT HERE</span>
            <span class="cut-line"></span>
            <span class="cut-sc flip">✂</span>
          </div>
        `;
        pages.push(`
          <div class="a4-page page-layout-12">
            ${rowDivs.join(dividerHtml)}
          </div>
        `);
      }
    } else if (meta.printLayout === 'counterfoil') {
      // 1 Student per A4 (Student Copy + Office Counterfoil)
      for (const slip of slips) {
        pages.push(`
          <div class="a4-page">
            <div class="counterfoil-page">
              ${this.renderSingleDueSlipCard(slip, 'PARENT / STUDENT COPY (अभिभावक प्रति)', meta)}
              <div class="cut-line">✂ — — — — — — — — — DETACH OFFICE COUNTERFOIL HERE — — — — — — — — — ✂</div>
              ${this.renderSingleDueSlipCard(slip, 'OFFICE COUNTERFOIL COPY (कार्यालय प्रति)', meta)}
            </div>
          </div>
        `);
      }
    } else {
      // 2 Students per A4 (Half-Page Detailed)
      for (let i = 0; i < slips.length; i += 2) {
        const first = slips[i];
        const second = slips[i + 1];
        pages.push(`
          <div class="a4-page">
            <div class="grid-2-page">
              ${this.renderSingleDueSlipCard(first, 'OFFICIAL FEE DEMAND SLIP (मांग पर्ची)', meta)}
              ${second ? `<div class="cut-line">✂ — — — — — — — — — CUT HERE FOR NEXT STUDENT — — — — — — — — — ✂</div>` : ''}
              ${second ? this.renderSingleDueSlipCard(second, 'OFFICIAL FEE DEMAND SLIP (मांग पर्ची)', meta) : ''}
            </div>
          </div>
        `);
      }
    }

    return pages.join('');
  }

  private renderGrid4ReceiptCard(rcp: BulkReceiptItem, meta: any): string {
    const payDateIst = new Date(rcp.paymentDate).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const rowsHtml = (rcp.lineItems || []).slice(0, 4).map(li => `
      <tr>
        <td><strong>${li.particulars}</strong></td>
        <td>${li.invoiceNumber}</td>
        <td class="r"><strong>₹${Number(li.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
      </tr>
    `).join('');

    return `
      <div class="slip-card card-grid-4">
        <div>
          <div class="grid4-header">
            <div class="grid4-brand">
              ${meta.logoUrl ? `<img src="${meta.logoUrl}" class="grid4-logo" alt="Logo" onerror="this.style.display='none'" />` : ''}
              <div class="grid4-inst-info">
                <div class="grid4-inst-name">${meta.instituteName}</div>
                ${meta.branchName ? `<div class="grid4-inst-sub">Campus: ${meta.branchName}</div>` : ''}
                ${meta.phone ? `<div class="grid4-inst-contact">📞 ${meta.phone}</div>` : ''}
              </div>
            </div>
            <div class="grid4-badge rcp-badge">
              <span class="g4-badge-title">PAYMENT RECEIPT</span>
              <span class="g4-badge-hi">शुल्क रसीद</span>
            </div>
          </div>

          <div class="grid4-meta-grid">
            <div><span class="lbl">Receipt No:</span> <strong style="color:#047857;">${rcp.receiptNumber}</strong></div>
            <div><span class="lbl">Date:</span> <strong>${payDateIst}</strong></div>
            <div><span class="lbl">Student:</span> <strong>${rcp.studentName}</strong> (R: ${rcp.rollNumber || '—'})</div>
            <div><span class="lbl">Class/Sec:</span> <strong>${rcp.className || 'N/A'}${rcp.sectionName ? '-' + rcp.sectionName : ''}</strong></div>
            <div><span class="lbl">Parent:</span> <strong>${rcp.parentName || '—'}</strong></div>
            <div><span class="lbl">Mode/Cycle:</span> <strong>${rcp.paymentMode} • ${rcp.periodLabel}</strong></div>
          </div>

          <table class="grid4-table">
            <thead>
              <tr>
                <th>Fee Head Particulars</th>
                <th>Invoice</th>
                <th class="r">Amount Paid</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          <div class="grid4-due-banner rcp-banner">
            <span class="g4-due-lbl">TOTAL AMOUNT RECEIVED (कुल प्राप्त):</span>
            <span class="g4-due-amount">₹${Number(rcp.amountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>

          ${rcp.remainingDue > 0 ? `
            <div style="font-size:8px;color:#b91c1c;margin-bottom:3px;font-weight:700;">Remaining Balance Due: ₹${Number(rcp.remainingDue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          ` : ''}
        </div>

        <div class="grid4-footer">
          <div class="grid4-notice">
            <div class="g4-note">Official computer-generated payment receipt. Thank you!</div>
            <div class="g4-date">Printed: ${meta.nowIstStr}</div>
          </div>
          ${rcp.qrDataUrl ? `
            <div class="grid4-qr">
              <img src="${rcp.qrDataUrl}" class="g4-qr-img" alt="QR" />
              <span class="g4-qr-txt">${rcp.remainingDue > 0 ? 'Pay Balance' : 'Verified'}</span>
            </div>
          ` : ''}
          <div class="grid4-sig">
            ${meta.sigUrl ? `<img src="${meta.sigUrl}" style="max-height:20px;display:block;margin:0 auto 1px;" alt="Sign" onerror="this.style.display='none'" />` : ''}
            <div class="g4-sig-line">${meta.authorityName}</div>
            <div class="g4-sig-sub">Cashier / Signatory</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderGrid8ReceiptCard(rcp: BulkReceiptItem, meta: any): string {
    return `
      <div class="slip-card card-grid-8">
        <div>
          <div class="grid8-header">
            <div class="g8-brand">
              ${meta.logoUrl ? `<img src="${meta.logoUrl}" class="g8-logo" alt="Logo" onerror="this.style.display='none'" />` : ''}
              <div class="g8-inst-info">
                <div class="g8-inst">${meta.instituteName}</div>
                ${meta.branchName ? `<div class="g8-branch">Campus: ${meta.branchName}</div>` : ''}
              </div>
            </div>
            <div class="grid8-badge rcp-badge">FEE RECEIPT (रसीद)</div>
          </div>

          <div class="grid8-info">
            <div class="g8-row">
              <span><strong>${rcp.studentName}</strong> (R: ${rcp.rollNumber || '—'})</span>
              <span>Rcpt: <strong style="color:#047857;">${rcp.receiptNumber}</strong></span>
            </div>
            <div class="g8-row">
              <span>Class: ${rcp.className || 'N/A'}${rcp.sectionName ? '-' + rcp.sectionName : ''}</span>
              <span>Cycle: <strong>${rcp.periodLabel}</strong></span>
            </div>
          </div>

          <div class="grid8-summary">
            <div class="g8-stat"><span>Mode:</span> <strong>${rcp.paymentMode}</strong></div>
            <div class="g8-net-due rcp-due">
              <span>RECEIVED:</span>
              <strong>₹${Number(rcp.amountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>
        </div>

        <div class="grid8-footer">
          <div class="g8-foot-left">
            <span>Verified Fee Receipt • ${meta.nowIstStr}</span>
          </div>
          ${rcp.qrDataUrl ? `
            <div class="grid8-qr">
              <img src="${rcp.qrDataUrl}" class="g8-qr-img" alt="QR" />
              <span>Verify</span>
            </div>
          ` : ''}
          <div class="grid8-sig">
            <div class="g8-sig-line">Cashier</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderSingleReceiptCard(rcp: BulkReceiptItem, copyLabel: string, meta: any): string {
    const payDateIst = new Date(rcp.paymentDate).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const rowsHtml = (rcp.lineItems || []).map(li => `
      <tr>
        <td style="text-align:center;">${li.index}</td>
        <td><strong>${li.particulars}</strong></td>
        <td>${li.invoiceNumber}</td>
        <td class="r"><strong>₹${Number(li.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
      </tr>
    `).join('');

    return `
      <div class="slip-card rcp-card">
        <div class="copy-tag paid-tag">${copyLabel}</div>
        ${this.renderSlipHeader(meta, 'FEE PAYMENT RECEIPT', 'शुल्क भुगतान रसीद', '#047857')}
        <div class="st-grid">
          <div><span>Receipt No (रसीद संख्या):</span> <strong style="color:#1d4ed8;">${rcp.receiptNumber}</strong></div>
          <div><span>Payment Date (IST):</span> <strong>${payDateIst}</strong></div>
          <div><span>Student Name (विद्यार्थी):</span> <strong>${rcp.studentName} (Roll: ${rcp.rollNumber})</strong></div>
          <div><span>Class / Batch:</span> <strong>${rcp.className || 'N/A'}${rcp.sectionName ? ' - ' + rcp.sectionName : ''}${rcp.batchName ? ' (' + rcp.batchName + ')' : ''}</strong></div>
          <div><span>Parent / Guardian:</span> <strong>${rcp.parentName || '—'} (${rcp.parentPhone || '—'})</strong></div>
          <div><span>Period &amp; Mode:</span> <strong>${rcp.periodLabel} • ${rcp.paymentMode}</strong></div>
        </div>
        <table class="p-table">
          <thead>
            <tr>
              <th style="width:32px;">#</th>
              <th>Fee Head / Payment Particulars (भुगतान विवरण)</th>
              <th>Invoice Ref</th>
              <th class="r">Amount Paid (राशि)</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            ${rcp.advanceAdjustedAmount > 0 ? `
              <tr>
                <td colspan="3" class="r">Previous Advance Auto-Adjusted (पूर्व अग्रिम समायोजन ${rcp.advanceAdjustedFromReceipt ? '• ' + rcp.advanceAdjustedFromReceipt : ''}):</td>
                <td class="r" style="color:#6d28d9;"><strong>₹${Number(rcp.advanceAdjustedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
              </tr>
            ` : ''}
            <tr>
              <td colspan="3" class="r"><strong>TOTAL AMOUNT RECEIVED (कुल प्राप्त राशि):</strong></td>
              <td class="r paid-grand"><strong>₹${Number(rcp.amountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
            </tr>
          </tfoot>
        </table>
        <div class="bal-strip">
          <span>Remaining Ledger Due: <strong>₹${Number(rcp.remainingDue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
          ${rcp.studentAdvanceBalance > 0 ? `<span style="color:#047857;">Advance Wallet Credit (अग्रिम जमा शेष): <strong>+₹${Number(rcp.studentAdvanceBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>` : ''}
        </div>
        <div class="slip-footer">
          <div class="note">
            ${meta.showOnReceipt && meta.footerNoteEn ? `<div><strong>Note:</strong> ${meta.footerNoteEn}</div>` : ''}
            ${meta.showOnReceipt && meta.footerNoteHi ? `<div><strong>नोट:</strong> ${meta.footerNoteHi}</div>` : ''}
            ${!meta.showOnReceipt || (!meta.footerNoteEn && !meta.footerNoteHi) ? `<strong>Thank You!</strong> Official computer-generated fee receipt.` : ''}
          </div>
          ${rcp.qrDataUrl ? `
            <div class="qr-box">
              <img src="${rcp.qrDataUrl}" class="qr-img" alt="QR Code" />
              <div class="qr-lbl">${rcp.remainingDue > 0 ? 'Scan to Pay Balance' : 'Verified Official Receipt'}</div>
              <div class="qr-sub">${rcp.remainingDue > 0 ? 'BHIM UPI' : 'IMSERP Security Seal'}</div>
            </div>
          ` : ''}
          <div class="sig-box">
            ${meta.sigUrl ? `<img src="${meta.sigUrl}" class="sig-img" alt="Sign" onerror="this.style.display='none'" />` : ''}
            <div class="sig-line">${meta.authorityName}</div>
            <div class="sig-sub">Authorized Cashier / Signatory</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderGrid3ReceiptCard(rcp: BulkReceiptItem, meta: any): string {
    const payDateIst = new Date(rcp.paymentDate).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const rowsHtml = (rcp.lineItems || []).slice(0, 4).map(li => `
      <tr>
        <td><strong>${li.particulars}</strong></td>
        <td>${li.invoiceNumber}</td>
        <td class="r"><strong>₹${Number(li.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
      </tr>
    `).join('');

    return `
      <div class="slip-card card-grid-3">
        <div>
          <div class="g3-header">
            <div class="g3-brand">
              ${meta.logoUrl ? `<img src="${meta.logoUrl}" class="g3-logo" alt="Logo" onerror="this.style.display='none'" />` : ''}
              <div class="g3-inst-info">
                <div class="g3-inst-name">${meta.instituteName}</div>
                <div class="g3-inst-meta">${meta.branchName ? 'Campus: ' + meta.branchName : ''} ${meta.phone ? '• 📞 ' + meta.phone : ''} ${meta.address ? '• ' + meta.address : ''}</div>
              </div>
            </div>
            <div class="g3-badge rcp-badge">
              <span class="g3-badge-title">PAYMENT RECEIPT</span>
              <span class="g3-badge-hi">शुल्क रसीद</span>
            </div>
          </div>

          <div class="g3-meta-grid">
            <div><span class="lbl">Receipt No:</span> <strong style="color:#047857;">${rcp.receiptNumber}</strong> • Date: ${payDateIst}</div>
            <div><span class="lbl">Student:</span> <strong>${rcp.studentName}</strong> (Roll: ${rcp.rollNumber || '—'}, Adm: ${rcp.admissionNumber || '—'})</div>
            <div><span class="lbl">Class / Sec:</span> <strong>${rcp.className || 'N/A'}${rcp.sectionName ? ' - ' + rcp.sectionName : ''}</strong> • Parent: ${rcp.parentName || '—'}</div>
            <div><span class="lbl">Mode / Cycle:</span> <strong>${rcp.paymentMode} • ${rcp.periodLabel}</strong></div>
          </div>

          <table class="g3-table">
            <thead>
              <tr>
                <th>Fee Head Particulars</th>
                <th>Invoice Ref</th>
                <th class="r">Amount Paid</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          <div class="g3-due-banner rcp-banner">
            <span class="g3-due-lbl">TOTAL AMOUNT RECEIVED (कुल प्राप्त):</span>
            <span class="g3-due-amount">₹${Number(rcp.amountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>

          ${rcp.remainingDue > 0 ? `
            <div style="font-size:8px;color:#b91c1c;margin-bottom:3px;font-weight:700;">Remaining Balance Due: ₹${Number(rcp.remainingDue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          ` : ''}
        </div>

        <div class="g3-footer">
          <div class="g3-notice">
            <div class="g3-note">Official computer-generated payment receipt. Thank you!</div>
            <div class="g3-date">Printed: ${meta.nowIstStr}</div>
          </div>
          ${rcp.qrDataUrl ? `
            <div class="g3-qr">
              <img src="${rcp.qrDataUrl}" class="g3-qr-img" alt="QR" />
              <span class="g3-qr-txt">${rcp.remainingDue > 0 ? 'Pay Balance' : 'Verified'}</span>
            </div>
          ` : ''}
          <div class="g3-sig">
            ${meta.sigUrl ? `<img src="${meta.sigUrl}" style="max-height:18px;display:block;margin:0 auto 1px;" alt="Sign" onerror="this.style.display='none'" />` : ''}
            <div class="g3-sig-line">${meta.authorityName}</div>
            <div class="g3-sig-sub">Cashier / Signatory</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderGrid10ReceiptCard(rcp: BulkReceiptItem, meta: any): string {
    return `
      <div class="slip-card card-grid-10">
        <div class="g10-top">
          <div class="g10-header">
            <div class="g10-brand">
              ${meta.logoUrl ? `<img src="${meta.logoUrl}" class="g10-logo" alt="Logo" onerror="this.style.display='none'" />` : ''}
              <div class="g10-inst-info">
                <div class="g10-inst">${meta.instituteName}</div>
                ${meta.branchName ? `<div class="g10-branch">Campus: ${meta.branchName}</div>` : ''}
              </div>
            </div>
            <div class="g10-badge rcp-badge">FEE RECEIPT (रसीद)</div>
          </div>

          <div class="g10-info">
            <div class="g10-row">
              <span class="g10-st-name"><strong>${rcp.studentName}</strong> (R: ${rcp.rollNumber || '—'})</span>
              <span class="g10-cls">Rcpt: <strong style="color:#047857;">${rcp.receiptNumber}</strong></span>
            </div>
            <div class="g10-row g10-sub-row">
              <span>Class: <strong>${rcp.className || 'N/A'}${rcp.sectionName ? '-' + rcp.sectionName : ''}</strong></span>
              <span>Cycle: <strong>${rcp.periodLabel}</strong> • Parent: ${rcp.parentName || '—'}</span>
            </div>
          </div>

          <div class="g10-summary">
            <div class="g10-stat"><span>Mode:</span> <strong>${rcp.paymentMode}</strong></div>
            <div class="g10-net-due rcp-due">
              <span>RECEIVED:</span>
              <strong>₹${Number(rcp.amountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>
        </div>

        <div class="g10-footer">
          <div class="g10-foot-left">
            <span>Verified Fee Receipt • ${meta.nowIstStr}</span>
          </div>
          ${rcp.qrDataUrl ? `
            <div class="g10-qr">
              <img src="${rcp.qrDataUrl}" class="g10-qr-img" alt="QR" />
              <span>Verify</span>
            </div>
          ` : ''}
          <div class="g10-sig">
            <div class="g10-sig-line">Cashier</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderGrid12ReceiptCard(rcp: BulkReceiptItem, meta: any): string {
    return `
      <div class="slip-card card-grid-12">
        <div class="g12-top">
          <div class="g12-header">
            <div class="g12-brand">
              ${meta.logoUrl ? `<img src="${meta.logoUrl}" class="g12-logo" alt="Logo" onerror="this.style.display='none'" />` : ''}
              <div class="g12-inst-info">
                <div class="g12-inst">${meta.instituteName}</div>
                ${meta.branchName ? `<div class="g12-branch">${meta.branchName}</div>` : ''}
              </div>
            </div>
            <div class="g12-badge rcp-badge">FEE RECEIPT</div>
          </div>

          <div class="g12-info">
            <div class="g12-row">
              <span class="g12-st-name"><strong>${rcp.studentName}</strong> (R: ${rcp.rollNumber || '—'})</span>
              <span class="g12-cls">Rcpt: <strong style="color:#047857;">${rcp.receiptNumber}</strong></span>
            </div>
            <div class="g12-row g12-sub-row">
              <span>Class: <strong>${rcp.className || 'N/A'}${rcp.sectionName ? '-' + rcp.sectionName : ''}</strong></span>
              <span>Parent: ${rcp.parentName || '—'}</span>
            </div>
          </div>

          <div class="g12-summary">
            <div class="g12-stat"><span>Cycle:</span> <strong>${rcp.periodLabel}</strong></div>
            <div class="g12-stat"><span>Mode:</span> <strong>${rcp.paymentMode}</strong></div>
            <div class="g12-net-due rcp-due">
              <span>RCVD:</span>
              <strong>₹${Number(rcp.amountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>
        </div>

        <div class="g12-footer">
          <div class="g12-foot-left">
            <span>Verified Fee Receipt • ${meta.nowIstStr}</span>
          </div>
          ${rcp.qrDataUrl ? `
            <div class="g12-qr">
              <img src="${rcp.qrDataUrl}" class="g12-qr-img" alt="QR" />
              <span>Verify</span>
            </div>
          ` : ''}
          <div class="g12-sig">
            <div class="g12-sig-line">Cashier</div>
          </div>
        </div>
      </div>
    `;
  }

  private buildBulkReceiptsHtml(receipts: BulkReceiptItem[], meta: any): string {
    const pages: string[] = [];

    if (meta.printLayout === 'three_per_page') {
      // 3 Receipts per A4 Page (1x3 Tri-Fold with horizontal tear divider between cards)
      for (let i = 0; i < receipts.length; i += 3) {
        const pageReceipts = receipts.slice(i, i + 3);
        const cardDivs = pageReceipts.map(r => this.renderGrid3ReceiptCard(r, meta));
        const dividerHtml = `
          <div class="grid-cut-divider">
            <span class="cut-sc">✂</span>
            <span class="cut-line"></span>
            <span class="cut-txt">CUT / TEAR HERE (यहाँ से काटें / अलग करें)</span>
            <span class="cut-line"></span>
            <span class="cut-sc flip">✂</span>
          </div>
        `;
        pages.push(`
          <div class="a4-page page-layout-3">
            ${cardDivs.join(dividerHtml)}
          </div>
        `);
      }
    } else if (meta.printLayout === 'four_per_page') {
      // 4 Receipts per A4 Page (2x2 Grid with horizontal tear divider between Row 1 & Row 2)
      for (let i = 0; i < receipts.length; i += 4) {
        const pageReceipts = receipts.slice(i, i + 4);
        const rowDivs: string[] = [];

        for (let r = 0; r < pageReceipts.length; r += 2) {
          const r1 = pageReceipts[r];
          const r2 = pageReceipts[r + 1];
          const card1 = this.renderGrid4ReceiptCard(r1, meta);
          const card2 = r2
            ? this.renderGrid4ReceiptCard(r2, meta)
            : '<div class="slip-card card-grid-4 placeholder-card"></div>';

          rowDivs.push(`
            <div class="grid-row-2">
              ${card1}
              ${card2}
            </div>
          `);
        }

        const dividerHtml = `
          <div class="grid-cut-divider">
            <span class="cut-sc">✂</span>
            <span class="cut-line"></span>
            <span class="cut-txt">CUT / TEAR HERE (यहाँ से काटें / अलग करें)</span>
            <span class="cut-line"></span>
            <span class="cut-sc flip">✂</span>
          </div>
        `;
        pages.push(`
          <div class="a4-page page-layout-4">
            ${rowDivs.join(dividerHtml)}
          </div>
        `);
      }
    } else if (meta.printLayout === 'eight_per_page') {
      // 8 Receipts per A4 Page (2x4 Grid with horizontal tear dividers between each row)
      for (let i = 0; i < receipts.length; i += 8) {
        const pageReceipts = receipts.slice(i, i + 8);
        const rowDivs: string[] = [];

        for (let r = 0; r < pageReceipts.length; r += 2) {
          const r1 = pageReceipts[r];
          const r2 = pageReceipts[r + 1];
          const card1 = this.renderGrid8ReceiptCard(r1, meta);
          const card2 = r2
            ? this.renderGrid8ReceiptCard(r2, meta)
            : '<div class="slip-card card-grid-8 placeholder-card"></div>';

          rowDivs.push(`
            <div class="grid-row-2">
              ${card1}
              ${card2}
            </div>
          `);
        }

        const dividerHtml = `
          <div class="grid-cut-divider mini">
            <span class="cut-sc">✂</span>
            <span class="cut-line"></span>
            <span class="cut-txt">CUT HERE (यहाँ से काटें)</span>
            <span class="cut-line"></span>
            <span class="cut-sc flip">✂</span>
          </div>
        `;
        pages.push(`
          <div class="a4-page page-layout-8">
            ${rowDivs.join(dividerHtml)}
          </div>
        `);
      }
    } else if (meta.printLayout === 'ten_per_page') {
      // 10 Receipts per A4 Page (2x5 Grid with horizontal tear dividers between each row)
      for (let i = 0; i < receipts.length; i += 10) {
        const pageReceipts = receipts.slice(i, i + 10);
        const rowDivs: string[] = [];

        for (let r = 0; r < pageReceipts.length; r += 2) {
          const r1 = pageReceipts[r];
          const r2 = pageReceipts[r + 1];
          const card1 = this.renderGrid10ReceiptCard(r1, meta);
          const card2 = r2
            ? this.renderGrid10ReceiptCard(r2, meta)
            : '<div class="slip-card card-grid-10 placeholder-card"></div>';

          rowDivs.push(`
            <div class="grid-row-2">
              ${card1}
              ${card2}
            </div>
          `);
        }

        const dividerHtml = `
          <div class="grid-cut-divider mini">
            <span class="cut-sc">✂</span>
            <span class="cut-line"></span>
            <span class="cut-txt">CUT HERE (यहाँ से काटें)</span>
            <span class="cut-line"></span>
            <span class="cut-sc flip">✂</span>
          </div>
        `;
        pages.push(`
          <div class="a4-page page-layout-10">
            ${rowDivs.join(dividerHtml)}
          </div>
        `);
      }
    } else if (meta.printLayout === 'twelve_per_page') {
      // 12 Receipts per A4 Page (2x6 Grid with horizontal tear dividers between each row)
      for (let i = 0; i < receipts.length; i += 12) {
        const pageReceipts = receipts.slice(i, i + 12);
        const rowDivs: string[] = [];

        for (let r = 0; r < pageReceipts.length; r += 2) {
          const r1 = pageReceipts[r];
          const r2 = pageReceipts[r + 1];
          const card1 = this.renderGrid12ReceiptCard(r1, meta);
          const card2 = r2
            ? this.renderGrid12ReceiptCard(r2, meta)
            : '<div class="slip-card card-grid-12 placeholder-card"></div>';

          rowDivs.push(`
            <div class="grid-row-2">
              ${card1}
              ${card2}
            </div>
          `);
        }

        const dividerHtml = `
          <div class="grid-cut-divider micro">
            <span class="cut-sc">✂</span>
            <span class="cut-line"></span>
            <span class="cut-txt">CUT HERE</span>
            <span class="cut-line"></span>
            <span class="cut-sc flip">✂</span>
          </div>
        `;
        pages.push(`
          <div class="a4-page page-layout-12">
            ${rowDivs.join(dividerHtml)}
          </div>
        `);
      }
    } else if (meta.printLayout === 'counterfoil') {
      // 1 Receipt per A4 (Student Copy + Office Counterfoil)
      for (const rcp of receipts) {
        pages.push(`
          <div class="a4-page">
            <div class="counterfoil-page">
              ${this.renderSingleReceiptCard(rcp, 'STUDENT / PARENT COPY (विद्यार्थी प्रति)', meta)}
              <div class="cut-line">✂ — — — — — — — — — DETACH OFFICE COUNTERFOIL HERE — — — — — — — — — ✂</div>
              ${this.renderSingleReceiptCard(rcp, 'OFFICE COUNTERFOIL COPY (कार्यालय प्रति)', meta)}
            </div>
          </div>
        `);
      }
    } else {
      // 2 Receipts per A4 Page
      for (let i = 0; i < receipts.length; i += 2) {
        const first = receipts[i];
        const second = receipts[i + 1];
        pages.push(`
          <div class="a4-page">
            <div class="grid-2-page">
              ${this.renderSingleReceiptCard(first, 'OFFICIAL FEE PAYMENT RECEIPT (भुगतान रसीद)', meta)}
              ${second ? `<div class="cut-line">✂ — — — — — — — — — CUT HERE FOR NEXT RECEIPT — — — — — — — — — ✂</div>` : ''}
              ${second ? this.renderSingleReceiptCard(second, 'OFFICIAL FEE PAYMENT RECEIPT (भुगतान रसीद)', meta) : ''}
            </div>
          </div>
        `);
      }
    }

    return pages.join('');
  }

  private buildConsolidatedRegisterHtml(rows: BulkRegisterRow[], meta: any): string {
    const rowsHtml = rows.map((r, i) => `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td><strong>${r.studentName}</strong><br/><span style="font-size:10px;color:#64748b;">Roll: ${r.rollNumber}</span></td>
        <td>${r.className || 'N/A'}${r.sectionName ? ' - ' + r.sectionName : ''}${r.batchName ? '<br/><span style="font-size:10px;">' + r.batchName + '</span>' : ''}</td>
        <td>${r.parentName || '—'}<br/><span style="font-size:10px;color:#64748b;">${r.parentPhone || ''}</span></td>
        <td>${r.periodsSummary}</td>
        <td class="r">₹${Number(r.totalInvoiced).toLocaleString('en-IN')}</td>
        <td class="r">${r.advanceAdjusted > 0 ? '-₹' + Number(r.advanceAdjusted).toLocaleString('en-IN') : '—'}</td>
        <td class="r" style="color:#047857;font-weight:700;">₹${Number(r.totalPaid).toLocaleString('en-IN')}</td>
        <td class="r" style="color:#b91c1c;font-weight:700;">₹${Number(r.balanceDue).toLocaleString('en-IN')}</td>
        <td style="text-align:center;font-weight:700;">${r.status}</td>
      </tr>
    `).join('');

    const sum = this.bulkData?.summary;
    return `
      <div class="a4-page">
        ${this.renderSlipHeader(meta, 'CONSOLIDATED FEE & DUES REGISTER', 'समेकित शुल्क एवं बकाया रजिस्टर', '#1e40af')}
        <div class="st-grid" style="margin-bottom:10px;">
          <div><span>Billing Cycle:</span> <strong>${this.bulkData?.periodLabel || ''}</strong></div>
          <div><span>Scope:</span> <strong>${this.getScopeBadgeText()}</strong></div>
          <div><span>Printed On (IST):</span> <strong>${meta.nowIstStr}</strong></div>
          <div><span>Total Students:</span> <strong>${rows.length}</strong></div>
        </div>
        <table class="p-table">
          <thead>
            <tr>
              <th style="width:32px;">S.No</th>
              <th>Student Name &amp; Roll</th>
              <th>Class / Batch</th>
              <th>Parent &amp; Phone</th>
              <th>Months Billed</th>
              <th class="r">Total Billed</th>
              <th class="r">Adv. Adjusted</th>
              <th class="r">Total Paid</th>
              <th class="r">Balance Due</th>
              <th style="text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="5" class="r"><strong>GRAND TOTAL (कुल योग):</strong></td>
              <td class="r"><strong>₹${Number(sum?.totalInvoiced || 0).toLocaleString('en-IN')}</strong></td>
              <td class="r"><strong>-₹${Number(sum?.totalAdvanceAdjusted || 0).toLocaleString('en-IN')}</strong></td>
              <td class="r" style="color:#047857;"><strong>₹${Number(sum?.totalPaid || 0).toLocaleString('en-IN')}</strong></td>
              <td class="r" style="color:#b91c1c;"><strong>₹${Number(sum?.totalBalanceDue || 0).toLocaleString('en-IN')}</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  private triggerIframePrint(contentHtml: string): void {
    const instituteTitle = this.authService.getInstituteName() || 'IMSERP Demand Bills';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title></title>
        <style>
          @page {
            size: A4 portrait;
            margin: 0mm !important;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            color: #0f172a;
            background: #ffffff;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .a4-page {
            display: block;
            width: 100%;
            page-break-after: always;
            break-after: page;
            box-sizing: border-box;
            padding: 4mm 6mm;
            height: auto;
          }
          .a4-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }

          /* 3 Students per A4 (1x3 Tri-Fold with horizontal cut dividers) */
          .page-layout-3 {
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            gap: 4mm;
            box-sizing: border-box;
            height: 297mm;
            max-height: 297mm;
            padding: 4mm 6mm;
          }

          /* 4 Students per A4 (2x2 Grid with horizontal cut divider) */
          .page-layout-4 {
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            gap: 4mm;
            box-sizing: border-box;
            height: 297mm;
            max-height: 297mm;
            padding: 4mm 6mm;
          }

          /* 8 Students per A4 (2x4 Grid with horizontal cut dividers) */
          .page-layout-8 {
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            gap: 2.5mm;
            box-sizing: border-box;
            height: 297mm;
            max-height: 297mm;
            padding: 4mm 6mm;
          }

          /* 10 Students per A4 (2x5 Grid with horizontal cut dividers) */
          .page-layout-10 {
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            gap: 2.8mm;
            box-sizing: border-box;
            height: 297mm;
            max-height: 297mm;
            padding: 4mm 6mm;
          }

          /* 12 Students per A4 (2x6 Grid with horizontal cut dividers) */
          .page-layout-12 {
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            gap: 2.5mm;
            box-sizing: border-box;
            height: 297mm;
            max-height: 297mm;
            padding: 4mm 6mm;
          }

          .grid-row-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5mm;
            box-sizing: border-box;
            width: 100%;
          }

          /* Horizontal Tear / Cut Divider across the page with scissors */
          .grid-cut-divider {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            height: 6mm;
            box-sizing: border-box;
            color: #475569;
            font-size: 8px;
            font-weight: 700;
            letter-spacing: 0.5px;
            margin: 0;
            padding: 0;
          }
          .grid-cut-divider .cut-line {
            flex: 1;
            border-top: 1.5px dashed #475569;
            height: 0;
          }
          .grid-cut-divider .cut-sc {
            font-size: 13px;
            color: #1e293b;
            line-height: 1;
          }
          .grid-cut-divider .cut-sc.flip {
            transform: scaleX(-1);
          }
          .grid-cut-divider .cut-txt {
            background: #f1f5f9;
            border: 1px dashed #94a3b8;
            border-radius: 10px;
            padding: 1px 8px;
            white-space: nowrap;
          }

          .grid-cut-divider.mini {
            height: 3.5mm;
            font-size: 6.5px;
            gap: 6px;
          }
          .grid-cut-divider.mini .cut-sc {
            font-size: 10px;
          }
          .grid-cut-divider.mini .cut-txt {
            padding: 0.5px 6px;
            font-size: 6px;
          }

          .grid-cut-divider.micro {
            height: 2.8mm;
            font-size: 5.5px;
            gap: 4px;
          }
          .grid-cut-divider.micro .cut-sc {
            font-size: 8px;
          }
          .grid-cut-divider.micro .cut-txt {
            padding: 0.2px 4px;
            font-size: 5px;
          }

          /* 2 Students per A4 (Half-Page) */
          .grid-2-page {
            display: flex;
            flex-direction: column;
            gap: 12px;
            box-sizing: border-box;
          }

          /* Counterfoil (1 Student per A4) */
          .counterfoil-page {
            display: flex;
            flex-direction: column;
            gap: 12px;
            box-sizing: border-box;
          }

          .slip-card {
            border: 1.5px solid #1e293b;
            border-radius: 8px;
            padding: 8px 10px;
            position: relative;
            background: #ffffff;
            box-sizing: border-box;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .placeholder-card {
            border: 1px dashed #cbd5e1 !important;
            visibility: hidden;
          }

          /* ── 4-per-page (2x2) Card Styling ── */
          .card-grid-4 {
            border: 1.5px dashed #475569;
            border-radius: 6px;
            padding: 5px 7px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-sizing: border-box;
            page-break-inside: avoid;
            break-inside: avoid;
            background: #ffffff;
            height: 135mm;
            max-height: 135mm;
            overflow: hidden;
          }
          .grid4-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1.5px solid #cbd5e1;
            padding-bottom: 4px;
            margin-bottom: 4px;
            gap: 6px;
          }
          .grid4-brand {
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
          }
          .grid4-logo {
            width: 28px;
            height: 28px;
            object-fit: contain;
            flex-shrink: 0;
          }
          .grid4-inst-info {
            min-width: 0;
          }
          .grid4-inst-name {
            font-size: 11px;
            font-weight: 800;
            color: #0f172a;
            line-height: 1.2;
            text-transform: uppercase;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .grid4-inst-sub {
            font-size: 8.5px;
            font-weight: 700;
            color: #1e40af;
            line-height: 1.2;
          }
          .grid4-inst-contact {
            font-size: 8px;
            color: #64748b;
            line-height: 1.1;
          }
          .grid4-badge {
            border: 1.5px solid #dc2626;
            background: #fef2f2;
            color: #b91c1c;
            border-radius: 4px;
            padding: 2px 5px;
            text-align: center;
            flex-shrink: 0;
          }
          .grid4-badge.rcp-badge {
            border-color: #059669;
            background: #ecfdf5;
            color: #047857;
          }
          .g4-badge-title {
            display: block;
            font-size: 8.5px;
            font-weight: 800;
            letter-spacing: 0.04em;
            line-height: 1.1;
          }
          .g4-badge-hi {
            display: block;
            font-size: 7.5px;
            font-weight: 700;
            line-height: 1.1;
          }

          .grid4-meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2.5px 6px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 4px 6px;
            font-size: 8.5px;
            margin-bottom: 4px;
            line-height: 1.25;
          }
          .grid4-meta-grid .lbl {
            color: #64748b;
          }
          .grid4-meta-grid strong {
            color: #0f172a;
          }

          .grid4-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8px;
            margin-bottom: 4px;
            table-layout: fixed;
          }
          .grid4-table th {
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 2.5px 4px;
            text-align: left;
            font-weight: 800;
            font-size: 8px;
            color: #1e293b;
          }
          .grid4-table td {
            border: 1px solid #e2e8f0;
            padding: 2px 4px;
            line-height: 1.25;
          }
          .grid4-table .r {
            text-align: right;
            white-space: nowrap;
          }
          .grid4-table .arr-pill {
            display: inline-block;
            background: #fff7ed;
            color: #c2410c;
            border: 1px solid #fdba74;
            border-radius: 2px;
            padding: 0 3px;
            font-size: 7px;
            font-weight: 700;
            line-height: 1.2;
          }
          .g4-period-row td {
            background: #f8fafc;
            font-size: 8px;
            font-weight: 800;
            color: #0f172a;
            border-top: 1.5px solid #cbd5e1;
            padding: 2.5px 4px;
          }
          .g4-head-row td {
            border-top: 1px dotted #e2e8f0;
            border-bottom: 1px dotted #e2e8f0;
            font-size: 7.5px;
            padding: 1.5px 4px;
          }
          .g4-head-name-td {
            color: #334155;
            font-weight: 600;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .g4-head-amt-td {
            font-weight: 700;
            color: #0f172a;
          }
          .g4-dim-td {
            color: #94a3b8;
            font-size: 7px;
          }
          .g4-subtotal-row td {
            background: #f8fafc;
            border-top: 1px dashed #cbd5e1;
            border-bottom: 1px solid #cbd5e1;
            font-size: 8px;
            padding: 2px 4px;
          }
          .g4-subtotal-lbl {
            text-align: right;
            font-weight: 700;
            color: #475569;
            font-size: 7.5px;
          }
          .g4-subtotal-billed {
            color: #0f172a;
            font-weight: 800;
          }
          .g4-single-row td {
            font-size: 8px;
            padding: 2.5px 4px;
          }
          .g4-single-head-sub {
            font-size: 7.5px;
            color: #475569;
            font-weight: 600;
            margin-top: 1px;
          }

          .grid4-due-banner {
            background: #fef2f2;
            border: 1.5px solid #f87171;
            border-radius: 4px;
            padding: 3px 6px;
            margin-bottom: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .grid4-due-banner.rcp-banner {
            background: #ecfdf5;
            border-color: #34d399;
          }
          .g4-due-lbl {
            font-size: 8.5px;
            font-weight: 800;
            color: #991b1b;
          }
          .grid4-due-banner.rcp-banner .g4-due-lbl {
            color: #065f46;
          }
          .g4-due-amount {
            font-size: 11px;
            font-weight: 900;
            color: #b91c1c;
          }
          .grid4-due-banner.rcp-banner .g4-due-amount {
            color: #047857;
          }

          .grid4-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 6px;
            border-top: 1px dashed #cbd5e1;
            padding-top: 4px;
          }
          .grid4-notice {
            flex: 1 1 auto;
            min-width: 0;
          }
          .g4-note {
            font-size: 7.5px;
            color: #475569;
            line-height: 1.25;
          }
          .g4-date {
            font-size: 7px;
            color: #94a3b8;
            margin-top: 1px;
          }
          .grid4-qr {
            display: flex;
            flex-direction: column;
            align-items: center;
            flex-shrink: 0;
          }
          .g4-qr-img {
            width: 40px;
            height: 40px;
            object-fit: contain;
            display: block;
          }
          .g4-qr-txt {
            font-size: 6.5px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 1px;
          }
          .grid4-sig {
            text-align: center;
            min-width: 65px;
            flex-shrink: 0;
          }
          .g4-sig-line {
            font-size: 8px;
            font-weight: 700;
            border-top: 1px solid #334155;
            padding-top: 1px;
            color: #0f172a;
          }
          .g4-sig-sub {
            font-size: 7px;
            color: #64748b;
          }

          /* ── 8-per-page (2x4) Card Styling ── */
          .card-grid-8 {
            position: relative;
            border: 1px dashed #475569;
            border-radius: 4px;
            padding: 3px 5px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-sizing: border-box;
            page-break-inside: avoid;
            break-inside: avoid;
            background: #ffffff;
            height: 58mm;
            max-height: 58mm;
            overflow: hidden;
          }
          .grid8-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 2px;
            margin-bottom: 2px;
            gap: 4px;
          }
          .g8-brand {
            display: flex;
            align-items: center;
            gap: 4px;
            min-width: 0;
            max-width: 68%;
          }
          .g8-logo {
            width: 18px;
            height: 18px;
            object-fit: contain;
            flex-shrink: 0;
            border-radius: 2px;
          }
          .g8-inst-info {
            min-width: 0;
          }
          .g8-inst {
            font-size: 8px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.1;
          }
          .g8-branch {
            font-size: 6.5px;
            font-weight: 700;
            color: #1e40af;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.1;
          }
          .g8-badge {
            font-size: 7px;
            font-weight: 800;
            color: #b91c1c;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 3px;
            padding: 1px 3px;
            white-space: nowrap;
          }
          .g8-badge.rcp-badge {
            color: #047857;
            background: #ecfdf5;
            border-color: #a7f3d0;
          }
          .grid8-info {
            font-size: 7.5px;
            line-height: 1.25;
            margin-bottom: 2px;
          }
          .g8-row {
            display: flex;
            justify-content: space-between;
            gap: 4px;
            white-space: nowrap;
            overflow: hidden;
          }
          .grid8-summary {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 3px;
            padding: 2px 4px;
            margin-bottom: 2px;
          }
          .g8-stat {
            font-size: 7px;
            color: #475569;
          }
          .g8-net-due {
            background: #fef2f2;
            border: 1px solid #f87171;
            border-radius: 3px;
            padding: 1px 4px;
            font-size: 8px;
            font-weight: 800;
            color: #b91c1c;
          }
          .g8-net-due.rcp-due {
            background: #ecfdf5;
            border-color: #34d399;
            color: #047857;
          }
          .grid8-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px dashed #cbd5e1;
            padding-top: 2px;
            gap: 4px;
          }
          .g8-foot-left {
            flex: 1 1 auto;
            font-size: 6.5px;
            color: #64748b;
            line-height: 1.1;
          }
          .grid8-qr {
            display: flex;
            flex-direction: column;
            align-items: center;
            flex-shrink: 0;
          }
          .g8-qr-img {
            width: 32px;
            height: 32px;
            object-fit: contain;
            display: block;
          }
          .grid8-qr span {
            font-size: 5.5px;
            font-weight: 700;
          }
          .grid8-sig {
            text-align: center;
            flex-shrink: 0;
            min-width: 48px;
          }
          .g8-sig-line {
            font-size: 6.8px;
            font-weight: 700;
            border-top: 0.8px solid #334155;
            padding-top: 1px;
          }

          /* ── 3-per-page (1x3) Card Styling (Tri-Fold Slips • 99mm) ── */
          .card-grid-3 {
            border: 1.5px dashed #475569;
            border-radius: 6px;
            padding: 5px 8px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-sizing: border-box;
            page-break-inside: avoid;
            break-inside: avoid;
            background: #ffffff;
            height: 88mm;
            max-height: 88mm;
            overflow: hidden;
            width: 100%;
          }
          .g3-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1.5px solid #cbd5e1;
            padding-bottom: 3px;
            margin-bottom: 3px;
            gap: 8px;
          }
          .g3-brand {
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
          }
          .g3-logo {
            width: 26px;
            height: 26px;
            object-fit: contain;
            flex-shrink: 0;
          }
          .g3-inst-info {
            min-width: 0;
          }
          .g3-inst-name {
            font-size: 11px;
            font-weight: 800;
            color: #0f172a;
            line-height: 1.2;
            text-transform: uppercase;
          }
          .g3-inst-meta {
            font-size: 8px;
            font-weight: 600;
            color: #475569;
            line-height: 1.2;
          }
          .g3-badge {
            border: 1.5px solid #dc2626;
            background: #fef2f2;
            color: #b91c1c;
            border-radius: 4px;
            padding: 2px 6px;
            text-align: center;
            flex-shrink: 0;
          }
          .g3-badge.rcp-badge {
            border-color: #059669;
            background: #ecfdf5;
            color: #047857;
          }
          .g3-badge-title {
            display: block;
            font-size: 8.5px;
            font-weight: 800;
            letter-spacing: 0.04em;
            line-height: 1.1;
          }
          .g3-badge-hi {
            display: block;
            font-size: 7.5px;
            font-weight: 700;
            line-height: 1.1;
          }
          .g3-meta-grid {
            display: grid;
            grid-template-columns: 1.2fr 1fr 1.2fr 1.2fr;
            gap: 3px 6px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 3px 6px;
            font-size: 8px;
            margin-bottom: 3px;
            line-height: 1.25;
          }
          .g3-meta-grid .lbl {
            color: #64748b;
          }
          .g3-meta-grid strong {
            color: #0f172a;
          }
          .g3-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8px;
            margin-bottom: 3px;
            table-layout: fixed;
          }
          .g3-table th {
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 2px 4px;
            text-align: left;
            font-weight: 800;
            font-size: 7.5px;
            color: #1e293b;
          }
          .g3-table td {
            border: 1px solid #e2e8f0;
            padding: 1.5px 4px;
            line-height: 1.2;
          }
          .g3-table .r {
            text-align: right;
            white-space: nowrap;
          }
          .g3-period-row td {
            background: #f8fafc;
            font-size: 7.5px;
            font-weight: 800;
            color: #0f172a;
            border-top: 1.5px solid #cbd5e1;
            padding: 2px 4px;
          }
          .g3-head-row td {
            border-top: 1px dotted #e2e8f0;
            border-bottom: 1px dotted #e2e8f0;
            font-size: 7px;
            padding: 1px 4px;
          }
          .g3-head-name-td {
            color: #334155;
            font-weight: 600;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .g3-head-amt-td {
            font-weight: 700;
            color: #0f172a;
          }
          .g3-dim-td {
            color: #94a3b8;
            font-size: 7px;
          }
          .g3-subtotal-row td {
            background: #f8fafc;
            border-top: 1px dashed #cbd5e1;
            border-bottom: 1px solid #cbd5e1;
            font-size: 7.5px;
            padding: 1.5px 4px;
          }
          .g3-subtotal-lbl {
            text-align: right;
            font-weight: 700;
            color: #475569;
            font-size: 7px;
          }
          .g3-subtotal-billed {
            color: #0f172a;
            font-weight: 800;
          }
          .g3-single-row td {
            font-size: 7.5px;
            padding: 2px 4px;
          }
          .g3-single-head-sub {
            font-size: 7px;
            color: #475569;
            font-weight: 600;
            margin-top: 1px;
          }
          .g3-due-banner {
            background: #fef2f2;
            border: 1.5px solid #f87171;
            border-radius: 4px;
            padding: 2px 6px;
            margin-bottom: 3px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .g3-due-banner.rcp-banner {
            background: #ecfdf5;
            border-color: #34d399;
          }
          .g3-due-lbl {
            font-size: 8px;
            font-weight: 800;
            color: #991b1b;
          }
          .g3-due-banner.rcp-banner .g3-due-lbl {
            color: #065f46;
          }
          .g3-due-amount {
            font-size: 10px;
            font-weight: 900;
            color: #b91c1c;
          }
          .g3-due-banner.rcp-banner .g3-due-amount {
            color: #047857;
          }
          .g3-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 6px;
            border-top: 1px dashed #cbd5e1;
            padding-top: 2px;
          }
          .g3-notice {
            flex: 1 1 auto;
            min-width: 0;
          }
          .g3-note {
            font-size: 7px;
            color: #475569;
            line-height: 1.2;
          }
          .g3-date {
            font-size: 6.5px;
            color: #94a3b8;
            margin-top: 1px;
          }
          .g3-qr {
            display: flex;
            flex-direction: column;
            align-items: center;
            flex-shrink: 0;
          }
          .g3-qr-img {
            width: 32px;
            height: 32px;
            object-fit: contain;
            display: block;
          }
          .g3-qr-txt {
            font-size: 6px;
            font-weight: 800;
            color: #0f172a;
          }
          .g3-sig {
            text-align: center;
            min-width: 65px;
            flex-shrink: 0;
          }
          .g3-sig-line {
            font-size: 7.5px;
            font-weight: 700;
            border-top: 1px solid #334155;
            padding-top: 1px;
            color: #0f172a;
          }
          .g3-sig-sub {
            font-size: 6.5px;
            color: #64748b;
          }

          /* ── 10-per-page (2x5) Card Styling (Compact Slips / Token Bills) ── */
          .card-grid-10 {
            border: 1px dashed #475569;
            border-radius: 4px;
            padding: 3px 6px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-sizing: border-box;
            page-break-inside: avoid;
            break-inside: avoid;
            background: #ffffff;
            height: 53mm;
            max-height: 53mm;
            overflow: hidden;
          }
          .g10-top {
            display: flex;
            flex-direction: column;
            gap: 2.5px;
          }
          .g10-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 2px;
            gap: 4px;
          }
          .g10-brand {
            display: flex;
            align-items: center;
            gap: 4px;
            min-width: 0;
            max-width: 70%;
          }
          .g10-logo {
            width: 18px;
            height: 18px;
            object-fit: contain;
            flex-shrink: 0;
            border-radius: 2px;
          }
          .g10-inst-info {
            min-width: 0;
          }
          .g10-inst {
            font-size: 8px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.1;
          }
          .g10-branch {
            font-size: 6.5px;
            font-weight: 700;
            color: #1e40af;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1;
          }
          .g10-badge {
            font-size: 7px;
            font-weight: 800;
            color: #b91c1c;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 2px;
            padding: 1px 4px;
            white-space: nowrap;
          }
          .g10-badge.rcp-badge {
            color: #047857;
            background: #ecfdf5;
            border-color: #a7f3d0;
          }
          .g10-info {
            font-size: 7.2px;
            line-height: 1.25;
          }
          .g10-row {
            display: flex;
            justify-content: space-between;
            gap: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .g10-sub-row {
            color: #475569;
            font-size: 6.8px;
          }
          .g10-st-name {
            color: #0f172a;
          }
          .g10-cls {
            color: #1e293b;
          }
          .g10-summary {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 3px;
            padding: 2px 4px;
            font-size: 7.2px;
          }
          .g10-stat span {
            color: #64748b;
          }
          .g10-stat strong {
            color: #0f172a;
          }
          .g10-net-due {
            background: #fee2e2;
            color: #991b1b;
            padding: 1px 5px;
            border-radius: 2px;
            font-weight: 800;
            font-size: 8px;
          }
          .g10-net-due.rcp-due {
            background: #d1fae5;
            color: #065f46;
          }
          .g10-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px dashed #cbd5e1;
            padding-top: 2px;
            font-size: 6.5px;
            color: #64748b;
          }
          .g10-foot-left {
            flex: 1 1 auto;
            line-height: 1.1;
          }
          .g10-qr {
            display: flex;
            flex-direction: column;
            align-items: center;
            flex-shrink: 0;
            margin: 0 4px;
          }
          .g10-qr-img {
            width: 25px;
            height: 25px;
            object-fit: contain;
          }
          .g10-qr span {
            font-size: 5.5px;
            font-weight: 700;
            color: #0f172a;
          }
          .g10-sig {
            text-align: center;
            flex-shrink: 0;
            min-width: 48px;
          }
          .g10-sig-line {
            font-size: 6.5px;
            font-weight: 700;
            color: #334155;
            border-top: 0.8px solid #475569;
            padding-top: 1px;
          }

          /* ── 12-per-page (2x6) Card Styling (Mini Diary Reminders) ── */
          .card-grid-12 {
            border: 1px dashed #475569;
            border-radius: 4px;
            padding: 3px 5px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-sizing: border-box;
            page-break-inside: avoid;
            break-inside: avoid;
            background: #ffffff;
            height: 44mm;
            max-height: 44mm;
            overflow: hidden;
          }
          .g12-top {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .g12-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 1.5px;
            gap: 4px;
          }
          .g12-brand {
            display: flex;
            align-items: center;
            gap: 3.5px;
            min-width: 0;
            max-width: 72%;
          }
          .g12-logo {
            width: 16px;
            height: 16px;
            object-fit: contain;
            flex-shrink: 0;
            border-radius: 2px;
          }
          .g12-inst-info {
            min-width: 0;
          }
          .g12-inst {
            font-size: 7.5px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.1;
          }
          .g12-branch {
            font-size: 6px;
            font-weight: 700;
            color: #1e40af;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1;
          }
          .g12-badge {
            font-size: 6.5px;
            font-weight: 800;
            color: #b91c1c;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 2px;
            padding: 1px 3px;
            white-space: nowrap;
          }
          .g12-badge.rcp-badge {
            color: #047857;
            background: #ecfdf5;
            border-color: #a7f3d0;
          }
          .g12-info {
            font-size: 7px;
            line-height: 1.25;
          }
          .g12-row {
            display: flex;
            justify-content: space-between;
            gap: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .g12-sub-row {
            color: #475569;
            font-size: 6.5px;
          }
          .g12-st-name {
            color: #0f172a;
          }
          .g12-summary {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 3px;
            padding: 1.5px 3.5px;
            font-size: 7px;
          }
          .g12-stat span {
            color: #64748b;
          }
          .g12-stat strong {
            color: #0f172a;
          }
          .g12-net-due {
            background: #fee2e2;
            color: #991b1b;
            padding: 1px 4px;
            border-radius: 2px;
            font-weight: 800;
            font-size: 7.5px;
          }
          .g12-net-due.rcp-due {
            background: #d1fae5;
            color: #065f46;
          }
          .g12-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px dashed #cbd5e1;
            padding-top: 1.5px;
            font-size: 6px;
            color: #64748b;
          }
          .g12-foot-left {
            flex: 1 1 auto;
            line-height: 1.1;
          }
          .g12-qr {
            display: flex;
            flex-direction: column;
            align-items: center;
            flex-shrink: 0;
            margin: 0 4px;
          }
          .g12-qr-img {
            width: 22px;
            height: 22px;
            object-fit: contain;
          }
          .g12-qr span {
            font-size: 5px;
            font-weight: 700;
            color: #0f172a;
          }
          .g12-sig {
            text-align: center;
            flex-shrink: 0;
            min-width: 42px;
          }
          .g12-sig-line {
            font-size: 6px;
            font-weight: 700;
            color: #334155;
            border-top: 0.8px solid #475569;
            padding-top: 0.5px;
          }

          /* General components */
          .copy-tag { display: inline-block; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; margin-bottom: 4px; }
          .copy-tag.paid-tag { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
          .slip-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 6px; gap: 8px; }
          .inst-brand { display: flex; align-items: center; gap: 8px; }
          .inst-logo { width: 38px; height: 38px; object-fit: contain; }
          .inst-name { font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; }
          .inst-branch { font-size: 10.5px; font-weight: 700; color: #1e40af; }
          .inst-contact { font-size: 9.5px; color: #475569; }
          .doc-badge { border: 1.5px solid #1e40af; border-radius: 6px; padding: 3px 8px; text-align: right; }
          .doc-badge .en { font-size: 10.5px; font-weight: 800; }
          .doc-badge .hi { font-size: 9.5px; font-weight: 700; }
          .st-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px 8px; font-size: 10px; background: #f8fafc; padding: 5px 7px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 6px; }
          .st-grid span { color: #64748b; }
          .p-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 6px; }
          .p-table th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 4px 5px; text-align: left; font-size: 9.5px; }
          .p-table td { border: 1px solid #cbd5e1; padding: 4px 5px; vertical-align: top; }
          .p-table .r { text-align: right; }
          .sub-heads { font-size: 9px; color: #475569; margin-top: 2px; }
          .due-item-heads-list { display: flex; flex-direction: column; gap: 0.5px; margin-top: 1.5px; }
          .due-head-line { display: flex; align-items: baseline; gap: 3px; font-size: 8.5px; line-height: 1.15; color: #334155; }
          .head-num { color: #dc2626; font-weight: 700; font-size: 8px; min-width: 10px; }
          .head-name { color: #475569; font-weight: 500; }
          .head-amount { color: #991b1b; font-weight: 700; margin-left: auto; white-space: nowrap; }
          .arr-tag { background: #fff7ed; color: #c2410c; border: 1px solid #fdba74; font-size: 8.5px; padding: 1px 3px; border-radius: 3px; font-weight: 700; }
          .due-grand { background: #fef2f2; color: #b91c1c; font-size: 11.5px; }
          .paid-grand { background: #ecfdf5; color: #047857; font-size: 11.5px; }
          .bal-strip { display: flex; justify-content: space-between; font-size: 10px; background: #f8fafc; padding: 4px 7px; border: 1px dashed #cbd5e1; border-radius: 4px; margin-bottom: 5px; }
          .slip-footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 5px; }
          .note { font-size: 9px; color: #475569; max-width: 48%; line-height: 1.3; }
          .qr-box { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; flex-shrink: 0; min-width: 90px; }
          .qr-img { width: 78px; height: 78px; object-fit: contain; border: none; background: #ffffff; padding: 0; display: block; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .qr-lbl { font-size: 8px; font-weight: 800; color: #0f172a; margin-top: 2px; white-space: nowrap; }
          .qr-sub { font-size: 7.5px; font-weight: 600; color: #64748b; white-space: nowrap; }
          .sig-box { text-align: center; min-width: 110px; }
          .sig-img { max-height: 24px; object-fit: contain; display: block; margin: 0 auto 2px; }
          .sig-line { font-size: 9.5px; font-weight: 700; border-top: 1px solid #334155; padding-top: 2px; }
          .sig-sub { font-size: 8.5px; color: #64748b; }
          .cut-line { text-align: center; font-size: 9.5px; color: #64748b; margin: 6px 0; font-weight: 700; letter-spacing: 0.05em; }
        </style>
      </head>
      <body>${contentHtml}</body>
      </html>
    `;

    let iframe = document.getElementById('imserp-bulk-print-frame') as HTMLIFrameElement;
    if (iframe) {
      try { iframe.remove(); } catch (_) {}
    }

    iframe = document.createElement('iframe');
    iframe.id = 'imserp-bulk-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '100vw';
    iframe.style.height = '100vh';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-9999';
    iframe.style.visibility = 'visible';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const triggerNow = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Print trigger failed:', err);
        window.print();
      }
    };

    const imgs = doc.querySelectorAll('img');
    if (imgs.length === 0) {
      setTimeout(triggerNow, 150);
    } else {
      let loaded = 0;
      let triggered = false;
      const safeTrigger = () => {
        if (!triggered) {
          triggered = true;
          triggerNow();
        }
      };

      imgs.forEach((img) => {
        if (img.complete) {
          loaded++;
        } else {
          img.onload = () => {
            loaded++;
            if (loaded >= imgs.length) safeTrigger();
          };
          img.onerror = () => {
            loaded++;
            if (loaded >= imgs.length) safeTrigger();
          };
        }
      });

      if (loaded >= imgs.length) {
        setTimeout(safeTrigger, 150);
      } else {
        setTimeout(safeTrigger, 500);
      }
    }
  }
}
