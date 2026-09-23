import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import {
  API_BASE, TeacherDto, TeacherFnFPreviewDto, CreateTeacherFnFRequestDto, TeacherFnFSettlementDto
} from './teacher.models';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-teacher-fnf',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatSelectModule,
    MatCheckboxModule, MatProgressBarModule, MatTooltipModule, MatChipsModule
  ],
  template: `
<div class="page-container">
  <!-- Header -->
  <div class="page-header">
    <div class="page-header-text">
      <h1 class="page-title"><mat-icon class="title-icon">exit_to_app</mat-icon> Teacher Exit &amp; FNF Settlement</h1>
      <p class="page-subtitle">Faculty offboarding, departmental clearances (No Dues), advance &amp; library recoveries, FNF vouchers, and official relieving certificates.</p>
    </div>
    <div class="header-actions">
      <button mat-raised-button color="primary" class="action-btn" (click)="openFnFDrawer()">
        <mat-icon>person_remove</mat-icon>
        <span>Initiate Exit / FNF</span>
      </button>
    </div>
  </div>

  <!-- KPI Summary Banner -->
  <div class="stats-grid">
    <div class="stat-card total-exits">
      <div class="stat-icon"><mat-icon>people_outline</mat-icon></div>
      <div class="stat-info">
        <span class="stat-val">{{ settlements.length }}</span>
        <span class="stat-lbl">Total Exits Recorded</span>
      </div>
    </div>
    <div class="stat-card pending">
      <div class="stat-icon"><mat-icon>hourglass_top</mat-icon></div>
      <div class="stat-info">
        <span class="stat-val">{{ getPendingCount() }}</span>
        <span class="stat-lbl">Pending / Draft FNF</span>
      </div>
    </div>
    <div class="stat-card settled">
      <div class="stat-icon"><mat-icon>verified</mat-icon></div>
      <div class="stat-info">
        <span class="stat-val">{{ getSettledCount() }}</span>
        <span class="stat-lbl">Settled &amp; Relieved</span>
      </div>
    </div>
    <div class="stat-card disbursements">
      <div class="stat-icon"><mat-icon>payments</mat-icon></div>
      <div class="stat-info">
        <span class="stat-val">₹{{ getTotalSettledAmount() | number:'1.0-0' }}</span>
        <span class="stat-lbl">Total FNF Disbursed</span>
      </div>
    </div>
  </div>

  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

  <!-- ── FNF INITIATION / EDIT DRAWER ── -->
  <div class="fnf-modal-overlay" *ngIf="showDrawer">
    <mat-card class="fnf-drawer-card mat-elevation-z4">
      <div class="drawer-header">
        <div class="hdr-icon"><mat-icon>assignment_turned_in</mat-icon></div>
        <div class="hdr-text">
          <h3>Process Full &amp; Final Settlement (FNF)</h3>
          <p>Verify clearances, compute final pro-rata dues, adjust advances, and finalize offboarding.</p>
        </div>
        <button mat-icon-button (click)="closeDrawer()"><mat-icon>close</mat-icon></button>
      </div>

      <div class="drawer-body">
        <!-- Locked Settlement Notice Banner -->
        <div class="settled-lock-banner" *ngIf="preview?.isFnFAlreadySettled">
          <div class="lock-banner-left">
            <div class="lock-icon-box"><mat-icon>lock</mat-icon></div>
            <div class="lock-banner-text">
              <span class="lock-title">Full &amp; Final Settlement Already Completed</span>
              <span class="lock-sub">{{ preview?.teacherName }} ({{ preview?.employeeCode }}) has already been offboarded and settled. Duplicate FNF processing is strictly prohibited.</span>
            </div>
          </div>
          <button mat-flat-button color="primary" type="button" class="lock-banner-btn" (click)="openExistingSettlementFromPreview()">
            <mat-icon>receipt_long</mat-icon> View Settlement Statement
          </button>
        </div>

        <!-- Step 1: Select Teacher -->
        <div class="section-block">
          <h4 class="section-title"><mat-icon>person</mat-icon> Step 1: Select Faculty Member</h4>
          <div class="form-row">
            <mat-form-field appearance="outline" class="flex-2">
              <mat-label>Select Teacher *</mat-label>
              <mat-select [(ngModel)]="formData.teacherId" (selectionChange)="onTeacherSelected()" [disabled]="!!preSelectedTeacherId">
                <mat-option *ngFor="let t of activeTeachers" [value]="t.id">
                  <strong>{{ t.fullName }}</strong> ({{ t.employeeCode }}) - {{ t.specialization || 'General' }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Resignation / Notice Date</mat-label>
              <input matInput type="date" [(ngModel)]="formData.resignationDate" (change)="recalculateDues()" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Last Working Day *</mat-label>
              <input matInput type="date" [(ngModel)]="formData.lastWorkingDate" (change)="recalculateDues()" />
            </mat-form-field>
          </div>

          <!-- Notice Period Duration Indicator -->
          <div class="notice-period-chip" *ngIf="formData.resignationDate && formData.lastWorkingDate">
            <mat-icon>schedule</mat-icon>
            <span>Notice Duration: <strong>{{ getNoticePeriodDays() }} Days</strong></span>
            <span *ngIf="getNoticePeriodDays() < 30" style="color:#b91c1c;font-weight:600;margin-left:8px;">(⚠️ Under 30-day standard norm. Notice Shortfall may apply.)</span>
            <span *ngIf="getNoticePeriodDays() >= 30" style="color:#15803d;font-weight:600;margin-left:8px;">(✓ Standard Notice Period Served)</span>
          </div>

          <div class="form-row">
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Reason for Leaving *</mat-label>
              <mat-select [(ngModel)]="formData.reasonForLeaving">
                <mat-option value="Resignation">Voluntary Resignation</mat-option>
                <mat-option value="Contract End">Contract / Session Completion</mat-option>
                <mat-option value="Relocation">Relocation / Personal</mat-option>
                <mat-option value="Retirement">Retirement</mat-option>
                <mat-option value="Medical">Medical / Health Reasons</mat-option>
                <mat-option value="Termination">Management Separation</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="flex-2">
              <mat-label>Remarks / Notes</mat-label>
              <input matInput [(ngModel)]="formData.remarks" placeholder="Handover details, performance remarks..." />
            </mat-form-field>
          </div>
        </div>

        <!-- Live Teacher Preview Audit Banner -->
        <div class="audit-summary-box" *ngIf="preview">
          <div class="audit-row">
            <div class="audit-item">
              <span class="lbl">Joining Date:</span>
              <span class="val">{{ preview.joiningDate | date:'dd MMM yyyy' }}</span>
            </div>
            <div class="audit-item">
              <span class="lbl">Monthly Gross:</span>
              <span class="val">₹{{ preview.grossMonthlySalary | number:'1.2-2' }}</span>
            </div>
            <div class="audit-item">
              <span class="lbl">Per Day Rate:</span>
              <span class="val">₹{{ preview.perDayRate | number:'1.2-2' }}</span>
            </div>
            <div class="audit-item">
              <span class="lbl">Current Month Present:</span>
              <span class="val font-bold">{{ preview.finalMonthPresentDays }} Days</span>
            </div>
          </div>
          <div class="audit-row" style="margin-top: 8px;">
            <div class="audit-item" [class.alert-danger]="preview.outstandingAdvanceBalance > 0">
              <span class="lbl">Unadjusted Advance:</span>
              <span class="val">₹{{ preview.outstandingAdvanceBalance | number:'1.2-2' }}</span>
            </div>
            <div class="audit-item" [class.alert-danger]="preview.pendingLibraryBooksCount > 0">
              <span class="lbl">Pending Library Books:</span>
              <span class="val">{{ preview.pendingLibraryBooksCount }} Books (Fine: ₹{{ preview.pendingLibraryFines }})</span>
            </div>
            <div class="audit-item" [class.alert-danger]="preview.isHostelResident">
              <span class="lbl">Staff Quarters:</span>
              <span class="val">{{ preview.isHostelResident ? 'Rm ' + preview.hostelRoomNumber + ' (Bed ' + preview.hostelBedCode + ')' : 'Not Allocated' }}</span>
            </div>
            <div class="audit-item" [class.alert-danger]="preview.isTransportStaff">
              <span class="lbl">Transport Facility:</span>
              <span class="val">{{ preview.isTransportStaff ? preview.transportRouteName + ' (' + preview.transportStopName + ')' : 'No Transport' }}</span>
            </div>
            <div class="audit-item">
              <span class="lbl">Active Assignments:</span>
              <span class="val">{{ preview.activeBatchesCount }} Batches / {{ preview.assignedSectionsCount }} Sections</span>
            </div>
            <div class="audit-item" *ngIf="preview.hasActiveLoginAccount">
              <span class="lbl">Portal Login:</span>
              <span class="val text-blue">&#64;{{ preview.loginUsername }} (Will Auto-Deactivate)</span>
            </div>
          </div>
        </div>

        <!-- Step 2: Clearances Checklist -->
        <div class="section-block">
          <h4 class="section-title"><mat-icon>fact_check</mat-icon> Step 2: Departmental Clearances (No Dues / NOC)</h4>
          <div class="clearances-grid">
            <div class="clearance-card" [class.cleared]="formData.academicClearance">
              <mat-checkbox [(ngModel)]="formData.academicClearance" color="primary">
                <strong>Academic Clearance</strong>
              </mat-checkbox>
              <div class="cl-badge-row" *ngIf="preview">
                <span class="cl-badge" [class.badge-ok]="preview.activeBatchesCount === 0 && preview.assignedSectionsCount === 0" [class.badge-pending]="preview.activeBatchesCount > 0 || preview.assignedSectionsCount > 0">
                  {{ preview.activeBatchesCount === 0 && preview.assignedSectionsCount === 0 ? '✓ Auto-Clear (0 Batches)' : ('⚠️ ' + preview.activeBatchesCount + ' Batches / ' + preview.assignedSectionsCount + ' Secs Active') }}
                </span>
              </div>
              <p>Syllabus completed, exam marks verified, syllabus register handed over.</p>
            </div>

            <div class="clearance-card" [class.cleared]="formData.libraryClearance">
              <mat-checkbox [(ngModel)]="formData.libraryClearance" color="primary">
                <strong>Library Clearance</strong>
              </mat-checkbox>
              <div class="cl-badge-row" *ngIf="preview">
                <span class="cl-badge" [class.badge-ok]="preview.pendingLibraryBooksCount === 0" [class.badge-pending]="preview.pendingLibraryBooksCount > 0">
                  {{ preview.pendingLibraryBooksCount === 0 ? '✓ Auto-Clear (0 Books)' : ('⚠️ ' + preview.pendingLibraryBooksCount + ' Book(s) Issued') }}
                </span>
              </div>
              <p>All issued books returned, no overdue fines or damage penalties pending.</p>
            </div>

            <div class="clearance-card" [class.cleared]="formData.assetClearance">
              <mat-checkbox [(ngModel)]="formData.assetClearance" color="primary">
                <strong>Inventory &amp; Asset Clearance</strong>
              </mat-checkbox>
              <div class="cl-badge-row">
                <span class="cl-badge badge-neutral">Physical Handover</span>
              </div>
              <p>Staff ID badge, classroom keys, lab equipment, laptop/tablet handed over.</p>
            </div>

            <div class="clearance-card" [class.cleared]="formData.hostelClearance">
              <mat-checkbox [(ngModel)]="formData.hostelClearance" color="primary">
                <strong>Hostel / Quarters Clearance</strong>
              </mat-checkbox>
              <div class="cl-badge-row" *ngIf="preview">
                <span class="cl-badge" [class.badge-ok]="!preview.isHostelResident" [class.badge-pending]="preview.isHostelResident">
                  {{ preview.isHostelResident ? ('⚠️ Rm ' + preview.hostelRoomNumber + ', Bed ' + preview.hostelBedCode) : '✓ Auto-Clear (Not Allotted)' }}
                </span>
              </div>
              <p>Quarters vacated, warden keys surrendered, utility bills cleared.</p>
            </div>

            <div class="clearance-card" [class.cleared]="formData.transportClearance">
              <mat-checkbox [(ngModel)]="formData.transportClearance" color="primary">
                <strong>Transport Clearance</strong>
              </mat-checkbox>
              <div class="cl-badge-row" *ngIf="preview">
                <span class="cl-badge" [class.badge-ok]="!preview.isTransportStaff" [class.badge-pending]="preview.isTransportStaff">
                  {{ preview.isTransportStaff ? ('⚠️ ' + preview.transportRouteName) : '✓ Auto-Clear (Not Allotted)' }}
                </span>
              </div>
              <p>Bus pass surrendered, transport allocation seat discontinued.</p>
            </div>
          </div>
        </div>

        <!-- Step 3: Financial Reconciliation -->
        <div class="section-block">
          <h4 class="section-title"><mat-icon>account_balance_wallet</mat-icon> Step 3: Financial Reconciliation (Payable vs Recoveries)</h4>
          <div class="financial-grid">
            <!-- Earnings / Additions -->
            <div class="fin-col earnings">
              <div class="fin-col-hdr">
                <span><mat-icon>add_circle</mat-icon> Final Month Earnings</span>
                <span class="sub-tot">+₹{{ getCalculatedTotalEarnings() | number:'1.2-2' }}</span>
              </div>
              <div class="fin-field" [style.background]="preview?.isFinalMonthSalaryPaid ? '#f0fdf4' : ''" [style.padding]="preview?.isFinalMonthSalaryPaid ? '6px 8px' : ''" [style.borderRadius]="preview?.isFinalMonthSalaryPaid ? '6px' : ''">
                <div class="fin-label-box">
                  <label>Unpaid Salary (Pro-rata):</label>
                  <span class="fin-hint auto" *ngIf="preview && !preview.isFinalMonthSalaryPaid">⚡ Auto: {{preview.finalMonthPresentDays}}d attendance</span>
                  <span class="fin-hint" style="color:#15803d;font-weight:700;" *ngIf="preview?.isFinalMonthSalaryPaid">
                    ✓ Final Month Salary Already Paid ({{preview?.finalMonthSalaryReceiptNumber}} — ₹{{preview?.finalMonthSalaryPaidAmount | number:'1.2-2'}})
                  </span>
                </div>
                <input type="number" [(ngModel)]="formData.unpaidSalary" [style.borderColor]="preview?.isFinalMonthSalaryPaid ? '#86efac' : ''" />
              </div>
              <div class="fin-field">
                <div class="fin-label-box">
                  <label>Leave Encashment (PL/EL):</label>
                  <span class="fin-hint opt">Unused PL × Daily Rate (or 0)</span>
                </div>
                <input type="number" [(ngModel)]="formData.earnedLeaveEncashment" />
              </div>
              <div class="fin-field">
                <div class="fin-label-box">
                  <label>Gratuity / Long Service Bonus:</label>
                  <span class="fin-hint opt">5+ Yrs service tenure (or 0)</span>
                </div>
                <input type="number" [(ngModel)]="formData.gratuityOrBonus" />
              </div>
              <div class="fin-field">
                <div class="fin-label-box">
                  <label>Other Additions / Allowances:</label>
                  <span class="fin-hint opt">Approved claims / travel bills (or 0)</span>
                </div>
                <input type="number" [(ngModel)]="formData.otherAdditions" />
              </div>
            </div>

            <!-- Recoveries / Deductions -->
            <div class="fin-col deductions">
              <div class="fin-col-hdr">
                <span><mat-icon>remove_circle</mat-icon> Deductions &amp; Recoveries</span>
                <span class="sub-tot">-₹{{ getCalculatedTotalDeductions() | number:'1.2-2' }}</span>
              </div>
              <div class="fin-field">
                <div class="fin-label-box">
                  <label>Outstanding Advance Recovery:</label>
                  <span class="fin-hint auto">⚡ Auto: Approved advance</span>
                </div>
                <input type="number" [(ngModel)]="formData.pendingAdvanceDeduction" />
              </div>
              <div class="fin-field">
                <div class="fin-label-box">
                  <label>Notice Shortfall Recovery:</label>
                  <span class="fin-hint opt">Shortfall days × Daily Rate (or 0)</span>
                </div>
                <input type="number" [(ngModel)]="formData.noticeShortfallDeduction" />
              </div>
              <div class="fin-field">
                <div class="fin-label-box">
                  <label>Library Dues / Lost Books:</label>
                  <span class="fin-hint auto">⚡ Auto: Overdue library fines</span>
                </div>
                <input type="number" [(ngModel)]="formData.libraryDuesDeduction" />
              </div>
              <div class="fin-field">
                <div class="fin-label-box">
                  <label>Asset Loss / Damage Deduction:</label>
                  <span class="fin-hint opt">Broken/Lost equipment cost (or 0)</span>
                </div>
                <input type="number" [(ngModel)]="formData.assetLossDeduction" />
              </div>
              <div class="fin-field">
                <div class="fin-label-box">
                  <label>Other Deductions / TDS:</label>
                  <span class="fin-hint opt">Final TDS tax deduction (or 0)</span>
                </div>
                <input type="number" [(ngModel)]="formData.otherDeductions" />
              </div>
            </div>
          </div>

          <!-- Net Settlement Strip -->
          <div class="net-settlement-strip" [class.payable]="getCalculatedNet() >= 0" [class.recoverable]="getCalculatedNet() < 0">
            <div>
              <span class="net-lbl">{{ getCalculatedNet() >= 0 ? 'NET AMOUNT PAYABLE TO TEACHER:' : 'NET AMOUNT RECOVERABLE FROM TEACHER:' }}</span>
              <p class="net-sub">{{ getCalculatedNet() >= 0 ? 'Institute will disburse this final settlement amount.' : 'Teacher must reimburse this outstanding amount.' }}</p>
            </div>
            <div class="net-amount-val">
              <span class="currency">₹</span>
              <span class="num">{{ Math.abs(getCalculatedNet()) | number:'1.2-2' }}</span>
            </div>
          </div>
        </div>

        <!-- Step 4: Payment Details & Auto-Offboarding -->
        <div class="section-block">
          <h4 class="section-title"><mat-icon>lock</mat-icon> Step 4: Settlement Execution &amp; Auto-Lockdown</h4>
          <div class="form-row">
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Disbursement Mode</mat-label>
              <mat-select [(ngModel)]="formData.paymentMode">
                <mat-option value="BankTransfer">Direct Bank Transfer (NEFT/RTGS/IMPS)</mat-option>
                <mat-option value="Cheque">Account Payee Cheque</mat-option>
                <mat-option value="UPI">UPI / Digital Payment</mat-option>
                <mat-option value="Cash">Cash Voucher</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="flex-2">
              <mat-label>Payment Reference / UTR / Cheque No.</mat-label>
              <input matInput [(ngModel)]="formData.paymentReference" placeholder="e.g. UTR-AXIS-9482942 or CHQ-001294" />
            </mat-form-field>
          </div>

          <div class="lockdown-notice-card">
            <mat-checkbox [(ngModel)]="formData.finalizeNow" color="primary">
              <strong>Execute Final Offboarding immediately upon save</strong>
            </mat-checkbox>
            <ul class="lockdown-points">
              <li>Marks teacher status as <strong>Inactive</strong> with last working day recorded.</li>
              <li>Instantly deactivates teacher's <strong>ERP Login Account</strong> (prevents portal access).</li>
              <li>Releases active coaching batch assignments and school class teacher designations.</li>
              <li>Marks all pending salary advance records as <strong>Adjusted in FNF</strong>.</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="drawer-footer">
        <button mat-button (click)="closeDrawer()">Cancel</button>

        <ng-container *ngIf="!preview?.isFnFAlreadySettled; else alreadySettledFooterBtn">
          <button mat-raised-button color="primary" [disabled]="!formData.teacherId || saving" (click)="saveFnFSettlement()">
            <mat-icon>{{ saving ? 'hourglass_empty' : 'check_circle' }}</mat-icon>
            <span>{{ formData.finalizeNow ? 'Finalize & Settle FNF' : 'Save as Draft' }}</span>
          </button>
        </ng-container>

        <ng-template #alreadySettledFooterBtn>
          <button mat-raised-button color="primary" type="button" (click)="openExistingSettlementFromPreview()">
            <mat-icon>receipt_long</mat-icon>
            <span>View Settled Statement</span>
          </button>
        </ng-template>
      </div>
    </mat-card>
  </div>

  <!-- ── SETTLEMENTS & OFFBOARDED TEACHERS TABLE ── -->
  <mat-card class="table-card mat-elevation-z2">
    <div class="table-header">
      <div class="table-title">
        <mat-icon color="primary">history_edu</mat-icon>
        <h3>Settled &amp; Relieved Teachers Directory</h3>
      </div>
      <div class="table-actions">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Search Exited Teachers...</mat-label>
          <input matInput [(ngModel)]="searchTerm" placeholder="Search by name, employee code..." />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
      </div>
    </div>

    <div class="table-responsive" *ngIf="filteredSettlements.length > 0">
      <table class="fnf-table">
        <thead>
          <tr>
            <th>Voucher #</th>
            <th>Teacher Details</th>
            <th>Last Working Day</th>
            <th>Reason</th>
            <th>Clearances</th>
            <th>Net Settlement</th>
            <th>Status</th>
            <th class="text-right">Actions / Documents</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let s of filteredSettlements">
            <td>
              <span class="voucher-code">{{ s.settlementVoucherNo }}</span>
            </td>
            <td>
              <div class="t-name"><strong>{{ s.teacherName }}</strong></div>
              <div class="t-sub">{{ s.employeeCode }} &bull; {{ s.designation || 'Faculty' }}</div>
            </td>
            <td>
              <div class="t-date">{{ s.lastWorkingDate | date:'dd MMM yyyy' }}</div>
              <small class="t-meta">Joined: {{ s.joiningDate | date:'dd MMM yyyy' }}</small>
            </td>
            <td>
              <span class="reason-pill">{{ s.reasonForLeaving }}</span>
            </td>
            <td>
              <span class="clearance-badge" [class.cleared]="s.allClearancesApproved">
                <mat-icon>{{ s.allClearancesApproved ? 'check_circle' : 'pending' }}</mat-icon>
                {{ s.allClearancesApproved ? 'All Cleared' : 'Pending' }}
              </span>
            </td>
            <td>
              <strong [class.text-green]="s.netPayableAmount >= 0" [class.text-red]="s.netPayableAmount < 0">
                ₹{{ Math.abs(s.netPayableAmount) | number:'1.2-2' }}
              </strong>
              <small class="mode-lbl">{{ s.netPayableAmount >= 0 ? 'Disbursed' : 'Recovered' }} ({{ s.paymentMode }})</small>
            </td>
            <td>
              <span class="status-pill" [class.settled]="s.status === 'Settled'" [class.draft]="s.status === 'Draft'">
                {{ s.status }}
              </span>
            </td>
            <td class="text-right actions-cell">
              <button mat-stroked-button class="doc-btn" (click)="viewSettlementStatement(s)" matTooltip="View / Print FNF Statement">
                <mat-icon>receipt_long</mat-icon> Statement
              </button>
              <button mat-raised-button color="primary" class="doc-btn primary" (click)="viewRelievingCertificate(s)" matTooltip="Generate Official Experience & Relieving Certificate">
                <mat-icon>workspace_premium</mat-icon> Certificate
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Empty State -->
    <div class="empty-state" *ngIf="filteredSettlements.length === 0 && !loading">
      <mat-icon>person_off</mat-icon>
      <h4>No Exit / FNF Settlements Found</h4>
      <p>Click "Initiate Exit / FNF" to process offboarding for faculty members who have left the institution.</p>
    </div>
  </mat-card>

  <!-- ── PRINTABLE FNF STATEMENT MODAL ── -->
  <div class="doc-modal-overlay" *ngIf="showStatementModal && activeSettlement">
    <div class="doc-modal-container">
      <div class="modal-hdr no-print">
        <div class="hdr-left">
          <div class="hdr-icon"><mat-icon>receipt_long</mat-icon></div>
          <div>
            <h3>Official Full &amp; Final Settlement Statement</h3>
            <p>{{ activeSettlement.teacherName }} ({{ activeSettlement.employeeCode }}) &bull; Voucher: {{ activeSettlement.settlementVoucherNo }}</p>
          </div>
        </div>
        <div class="btn-grp">
          <button mat-raised-button color="primary" (click)="printDocument('fnf-statement-paper')">
            <mat-icon>print</mat-icon> Print Statement (A4)
          </button>
          <button mat-icon-button (click)="showStatementModal = false"><mat-icon>close</mat-icon></button>
        </div>
      </div>

      <!-- A4 Statement Paper -->
      <div class="doc-paper" id="fnf-statement-paper">
        <div class="paper-header">
          <div class="inst-info">
            <h2>{{ instituteName }}</h2>
            <p>Faculty &amp; Staff Full &amp; Final Settlement Advice (अंतिम भुगतान विवरण)</p>
          </div>
          <div class="voucher-box">
            <span class="v-title">FNF VOUCHER</span>
            <strong class="v-num">{{ activeSettlement.settlementVoucherNo }}</strong>
          </div>
        </div>

        <div class="meta-strip">
          <div><label>Faculty Name:</label> <strong>{{ activeSettlement.teacherName }}</strong></div>
          <div><label>Employee Code:</label> <strong>{{ activeSettlement.employeeCode }}</strong></div>
          <div><label>Department / Subject:</label> <strong>{{ activeSettlement.designation || 'Academic Faculty' }}</strong></div>
          <div><label>Date of Joining:</label> <strong>{{ activeSettlement.joiningDate | date:'dd-MMM-yyyy' }}</strong></div>
          <div><label>Last Working Date:</label> <strong>{{ activeSettlement.lastWorkingDate | date:'dd-MMM-yyyy' }}</strong></div>
          <div><label>Settlement Date:</label> <strong>{{ activeSettlement.settlementDate | date:'dd-MMM-yyyy' }}</strong></div>
          <div><label>Reason for Exit:</label> <strong>{{ activeSettlement.reasonForLeaving }}</strong></div>
          <div><label>Payment Mode / Ref:</label> <strong>{{ activeSettlement.paymentMode }} ({{ activeSettlement.paymentReference || 'N/A' }})</strong></div>
        </div>

        <!-- Clearance Summary Strip -->
        <div class="clearance-summary-strip">
          <span class="cs-lbl">Departmental Clearances:</span>
          <span class="cs-badge">Academic: Cleared</span>
          <span class="cs-badge">Library: Cleared</span>
          <span class="cs-badge">Inventory/Assets: Cleared</span>
          <span class="cs-badge">Hostel/Residential: Cleared</span>
        </div>

        <!-- Two Column Breakdown -->
        <div class="breakdown-grid">
          <!-- Earnings Table -->
          <div class="bd-col">
            <table class="bd-table">
              <thead>
                <tr>
                  <th>EARNINGS &amp; ADDITIONS</th>
                  <th class="text-right">AMOUNT (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Unpaid Final Month Salary</td>
                  <td class="text-right">{{ activeSettlement.unpaidSalary | number:'1.2-2' }}</td>
                </tr>
                <tr>
                  <td>Earned Leave (PL/EL) Encashment</td>
                  <td class="text-right">{{ activeSettlement.earnedLeaveEncashment | number:'1.2-2' }}</td>
                </tr>
                <tr>
                  <td>Gratuity / Long Service Bonus</td>
                  <td class="text-right">{{ activeSettlement.gratuityOrBonus | number:'1.2-2' }}</td>
                </tr>
                <tr>
                  <td>Other Additions / Allowances</td>
                  <td class="text-right">{{ activeSettlement.otherAdditions | number:'1.2-2' }}</td>
                </tr>
                <tr class="total-row">
                  <td><strong>TOTAL GROSS EARNINGS (A)</strong></td>
                  <td class="text-right"><strong>₹{{ activeSettlement.totalEarnings | number:'1.2-2' }}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Deductions Table -->
          <div class="bd-col">
            <table class="bd-table">
              <thead>
                <tr>
                  <th>DEDUCTIONS &amp; RECOVERIES</th>
                  <th class="text-right">AMOUNT (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Pending Salary Advance Recovery</td>
                  <td class="text-right">{{ activeSettlement.pendingAdvanceDeduction | number:'1.2-2' }}</td>
                </tr>
                <tr>
                  <td>Notice Period Shortfall Recovery</td>
                  <td class="text-right">{{ activeSettlement.noticeShortfallDeduction | number:'1.2-2' }}</td>
                </tr>
                <tr>
                  <td>Library Dues / Unreturned Books</td>
                  <td class="text-right">{{ activeSettlement.libraryDuesDeduction | number:'1.2-2' }}</td>
                </tr>
                <tr>
                  <td>Asset Loss / Damage Deduction</td>
                  <td class="text-right">{{ activeSettlement.assetLossDeduction | number:'1.2-2' }}</td>
                </tr>
                <tr>
                  <td>Other Deductions / Tax</td>
                  <td class="text-right">{{ activeSettlement.otherDeductions | number:'1.2-2' }}</td>
                </tr>
                <tr class="total-row">
                  <td><strong>TOTAL DEDUCTIONS (B)</strong></td>
                  <td class="text-right"><strong>₹{{ activeSettlement.totalDeductions | number:'1.2-2' }}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Net Payable Block -->
        <div class="paper-net-block">
          <div>
            <span class="net-lbl">NET SETTLEMENT AMOUNT (A - B):</span>
            <div class="net-words">{{ getAmountInWords(Math.abs(activeSettlement.netPayableAmount)) }}</div>
          </div>
          <div class="net-val">
            <span>₹</span>{{ Math.abs(activeSettlement.netPayableAmount) | number:'1.2-2' }}
          </div>
        </div>

        <!-- Dual Signature Section -->
        <div class="paper-signatures">
          <div class="sig-box">
            <div class="sig-line"></div>
            <span>Employee / Faculty Signature</span>
            <small>I hereby confirm receipt of full and final settlement and have no further claims against the institution.</small>
          </div>
          <div class="sig-box text-center">
            <div class="stamp-box">
              <mat-icon>verified</mat-icon>
              <span>AUDITED &amp; VERIFIED</span>
            </div>
          </div>
          <div class="sig-box text-right">
            <div class="sig-line"></div>
            <span>Authorized Signatory / Principal</span>
            <small>{{ instituteName }}</small>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── PRINTABLE RELIEVING & EXPERIENCE CERTIFICATE MODAL ── -->
  <div class="doc-modal-overlay" *ngIf="showCertModal && activeSettlement">
    <div class="doc-modal-container">
      <div class="modal-hdr no-print">
        <div class="hdr-left">
          <div class="hdr-icon"><mat-icon>workspace_premium</mat-icon></div>
          <div>
            <h3>Official Relieving &amp; Experience Certificate</h3>
            <p>{{ activeSettlement.teacherName }} &bull; Formal Institutional Certificate</p>
          </div>
        </div>
        <div class="btn-grp">
          <button mat-raised-button color="primary" (click)="printDocument('relieving-cert-paper')">
            <mat-icon>print</mat-icon> Print Certificate (A4)
          </button>
          <button mat-icon-button (click)="showCertModal = false"><mat-icon>close</mat-icon></button>
        </div>
      </div>

      <!-- Certificate Paper with Border -->
      <div class="cert-paper" id="relieving-cert-paper">
        <div class="cert-border">
          <div class="cert-header">
            <div class="inst-crest">
              <mat-icon>school</mat-icon>
            </div>
            <h1 class="inst-cert-title">{{ instituteName }}</h1>
            <p class="inst-cert-sub">Accredited Academic Institution | Quality Education &amp; Holistic Development</p>
            <div class="cert-ref-strip">
              <span>Ref No: <strong>CERT/REL/{{ activeSettlement.lastWorkingDate | date:'yyyy' }}/{{ activeSettlement.employeeCode }}</strong></span>
              <span>Date of Issuance: <strong>{{ todayDate }}</strong></span>
            </div>
          </div>

          <div class="cert-title-badge">
            <h2>RELIEVING &amp; EXPERIENCE CERTIFICATE</h2>
            <span>अनुभव एवं कार्यमुक्ति प्रमाण पत्र</span>
          </div>

          <div class="cert-body-text">
            <p class="to-whom">TO WHOMSOEVER IT MAY CONCERN</p>

            <p class="body-para">
              This is to formally certify that <strong>{{ activeSettlement.teacherName }}</strong> 
              (Employee Code: <strong>{{ activeSettlement.employeeCode }}</strong>) was employed with our institution as a 
              <strong>{{ activeSettlement.designation || 'Faculty Member' }}</strong> from 
              <strong>{{ activeSettlement.joiningDate | date:'dd MMMM yyyy' }}</strong> to 
              <strong>{{ activeSettlement.lastWorkingDate | date:'dd MMMM yyyy' }}</strong>.
            </p>

            <p class="body-para">
              During their tenure with our institution, <strong>{{ activeSettlement.teacherName }}</strong> demonstrated 
              commendable dedication, pedagogical proficiency, and disciplined conduct. They successfully fulfilled all teaching, 
              evaluation, student mentoring, and departmental responsibilities assigned to them.
            </p>

            <p class="body-para">
              They have formally completed all departmental handover requirements, returned all institutional assets, and their 
              Full and Final Settlement (Voucher: <strong>{{ activeSettlement.settlementVoucherNo }}</strong>) has been amicably completed. 
              They are hereby relieved of all duties and responsibilities with effect from the close of working hours on 
              <strong>{{ activeSettlement.lastWorkingDate | date:'dd MMMM yyyy' }}</strong>.
            </p>

            <p class="body-para">
              We appreciate their valuable contributions and wish them every success in their future professional endeavors.
            </p>
          </div>

          <div class="cert-footer">
            <div class="seal-container">
              <div class="gold-seal">
                <mat-icon>verified</mat-icon>
                <span>OFFICIAL SEAL</span>
              </div>
            </div>
            <div class="principal-sig">
              <div class="sig-line-gold"></div>
              <strong>Principal / Authorized Director</strong>
              <span>{{ instituteName }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

</div>
  `,
  styles: [`
    .page-container { display: flex; flex-direction: column; gap: 20px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; }
    .page-title {
      font-size: 1.5rem; font-weight: 700; margin: 0; color: #0f172a; display: flex; align-items: center; gap: 10px;
      .title-icon { color: #2563eb; font-size: 1.7rem; width: 1.7rem; height: 1.7rem; }
    }
    .page-subtitle { color: #64748b; margin: 4px 0 0; font-size: 0.88rem; max-width: 820px; }
    .header-actions { display: flex; align-items: center; gap: 10px; }
    .action-btn { font-weight: 600; border-radius: 8px; }

    /* Stats Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .stat-card {
      background: #ffffff; border-radius: 12px; padding: 16px 18px; display: flex; align-items: center; gap: 14px;
      border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      .stat-icon {
        width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }
      .stat-info {
        .stat-val { display: block; font-size: 1.55rem; font-weight: 800; color: #0f172a; line-height: 1.1; }
        .stat-lbl { font-size: 0.76rem; font-weight: 600; color: #64748b; }
      }
      &.total-exits .stat-icon { background: #eff6ff; color: #2563eb; }
      &.pending .stat-icon { background: #fff7ed; color: #ea580c; }
      &.settled .stat-icon { background: #ecfdf5; color: #059669; }
      &.disbursements .stat-icon { background: #f5f3ff; color: #7c3aed; }
    }

    /* Modal / Drawer Overlay - AGENTS.md light blue gradient header */
    .fnf-modal-overlay, .doc-modal-overlay {
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(3px);
      z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;
    }
    .fnf-drawer-card {
      width: 100%; max-width: 860px; max-height: 90vh; border-radius: 12px; overflow: hidden;
      display: flex; flex-direction: column; padding: 0 !important; background: #fff;
    }
    .drawer-header, .modal-hdr {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe; padding: 16px 22px;
      display: flex; align-items: center; justify-content: space-between;
      .hdr-icon {
        background: #2563eb; color: #ffffff; border-radius: 10px;
        box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
        width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
        mat-icon { font-size: 22px; width: 22px; height: 22px; }
      }
      .hdr-text, .hdr-left {
        display: flex; align-items: center; gap: 12px;
        h3 { color: #1e3a8a; font-weight: 700; margin: 0; font-size: 1.15rem; }
        p { color: #3b82f6; margin: 2px 0 0; font-size: 0.8rem; }
      }
      .btn-grp { display: flex; align-items: center; gap: 10px; }
    }
    .drawer-body { padding: 20px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }
    .drawer-footer {
      padding: 14px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0;
      display: flex; justify-content: flex-end; gap: 12px;
    }

    .section-block {
      display: flex; flex-direction: column; gap: 10px;
      .section-title {
        font-size: 0.95rem; font-weight: 700; color: #1e3a8a; margin: 0;
        display: flex; align-items: center; gap: 6px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
      }
    }
    .form-row { display: flex; flex-wrap: wrap; gap: 12px; }
    .flex-1 { flex: 1; min-width: 160px; }
    .flex-2 { flex: 2; min-width: 240px; }
    .settled-lock-banner {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .lock-banner-left { display: flex; align-items: center; gap: 12px; }
    .lock-icon-box {
      background: #2563eb; color: #ffffff; border-radius: 8px;
      width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
      flex-shrink: 0;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }
    .lock-banner-text { display: flex; flex-direction: column; gap: 2px; }
    .lock-title { color: #1e3a8a; font-weight: 700; font-size: 0.92rem; }
    .lock-sub { color: #3b82f6; font-size: 0.8rem; }
    .lock-banner-btn { white-space: nowrap; }
    .notice-period-chip {
      display: inline-flex; align-items: center; gap: 6px; font-size: 0.78rem; color: #334155;
      background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 6px 12px;
      margin-top: -4px; width: fit-content;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2563eb; }
    }

    .audit-summary-box {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;
      .audit-row { display: flex; flex-wrap: wrap; gap: 16px 24px; }
      .audit-item {
        font-size: 0.82rem;
        .lbl { color: #64748b; margin-right: 4px; }
        .val { font-weight: 700; color: #1e293b; }
        &.alert-danger .val { color: #dc2626; }
        .text-blue { color: #2563eb; }
      }
    }

    .clearances-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
    .clearance-card {
      background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px;
      display: flex; flex-direction: column; gap: 4px;
      overflow: hidden;
      p { margin: 2px 0 0 28px; font-size: 0.73rem; color: #64748b; line-height: 1.3; }
      &.cleared { background: #f0fdf4; border-color: #86efac; }
      .cl-badge-row { margin: 1px 0 2px 28px; display: flex; flex-wrap: wrap; }
      .cl-badge {
        font-size: 0.68rem; font-weight: 700; padding: 2px 8px; border-radius: 10px;
        max-width: 100%; word-break: break-word; line-height: 1.3;
        &.badge-ok { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
        &.badge-pending { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        &.badge-neutral { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
      }
    }

    .financial-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .fin-col {
      border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;
      &.earnings { background: #f0fdf4; border: 1px solid #bbf7d0; }
      &.deductions { background: #fef2f2; border: 1px solid #fecaca; }
      .fin-col-hdr {
        display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 0.88rem;
        margin-bottom: 4px;
        span { display: flex; align-items: center; gap: 6px; mat-icon { font-size: 18px; width: 18px; height: 18px; } }
      }
      .fin-field {
        display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; gap: 8px;
        .fin-label-box {
          display: flex; flex-direction: column; gap: 1px;
          label { color: #334155; font-weight: 600; }
          .fin-hint {
            font-size: 0.69rem;
            &.auto { color: #0284c7; font-weight: 600; }
            &.opt { color: #64748b; font-style: italic; }
          }
        }
        input {
          width: 100px; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 6px;
          text-align: right; font-weight: 700; font-size: 0.84rem; flex-shrink: 0;
          &:focus { border-color: #2563eb; outline: none; }
        }
      }
    }

    .net-settlement-strip {
      display: flex; justify-content: space-between; align-items: center; padding: 14px 18px;
      border-radius: 8px; margin-top: 10px;
      .net-lbl { font-size: 0.88rem; font-weight: 800; letter-spacing: 0.5px; }
      .net-sub { margin: 2px 0 0; font-size: 0.74rem; }
      .net-amount-val {
        font-size: 1.6rem; font-weight: 800; display: flex; align-items: baseline; gap: 2px;
        .currency { font-size: 1.2rem; }
      }
      &.payable { background: #eff6ff; border: 1.5px solid #93c5fd; color: #1e3a8a; }
      &.recoverable { background: #fff1f2; border: 1.5px solid #fca5a5; color: #991b1b; }
    }

    .lockdown-notice-card {
      background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px;
      .lockdown-points {
        margin: 6px 0 0 24px; padding: 0; font-size: 0.76rem; color: #475569;
        li { margin-bottom: 2px; }
      }
    }

    /* Settlements Table */
    .table-card { border-radius: 12px; padding: 18px; }
    .table-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
    .table-title {
      display: flex; align-items: center; gap: 8px;
      h3 { margin: 0; font-size: 1.15rem; font-weight: 700; color: #0f172a; }
    }
    .search-field { width: 280px; }
    .fnf-table {
      width: 100%; border-collapse: collapse; font-size: 0.84rem;
      th, td { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; text-align: left; }
      th { background: #f8fafc; font-weight: 700; color: #475569; font-size: 0.76rem; text-transform: uppercase; }
      .voucher-code { font-family: monospace; font-weight: 700; color: #2563eb; }
      .t-name { font-size: 0.88rem; color: #0f172a; }
      .t-sub, .t-meta { font-size: 0.74rem; color: #64748b; }
      .reason-pill { background: #f1f5f9; padding: 3px 8px; border-radius: 4px; font-size: 0.74rem; font-weight: 600; color: #475569; }
      .clearance-badge {
        display: inline-flex; align-items: center; gap: 4px; font-size: 0.74rem; font-weight: 600;
        color: #d97706; mat-icon { font-size: 14px; width: 14px; height: 14px; }
        &.cleared { color: #16a34a; }
      }
      .mode-lbl { display: block; font-size: 0.7rem; color: #64748b; }
      .text-green { color: #15803d; }
      .text-red { color: #b91c1c; }
      .status-pill {
        padding: 3px 8px; border-radius: 12px; font-size: 0.72rem; font-weight: 700;
        &.settled { background: #dcfce7; color: #15803d; }
        &.draft { background: #fef3c7; color: #b45309; }
      }
      .actions-cell {
        display: flex; justify-content: flex-end; align-items: center; gap: 8px;
        .doc-btn {
          font-size: 0.78rem; font-weight: 600;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
        }
      }
    }

    /* Document Modals */
    .doc-modal-container {
      width: 100%; max-width: 820px; max-height: 92vh; background: #ffffff;
      border-radius: 12px; overflow-y: auto; display: flex; flex-direction: column;
    }
    .doc-paper { padding: 32px 36px; font-family: 'Segoe UI', Roboto, sans-serif; color: #1e293b; }
    .paper-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 14px;
      .inst-info h2 { margin: 0; font-size: 1.4rem; font-weight: 800; color: #0f172a; }
      .inst-info p { margin: 2px 0 0; font-size: 0.84rem; color: #64748b; }
      .voucher-box {
        text-align: right;
        .v-title { display: block; font-size: 0.75rem; font-weight: 700; color: #64748b; letter-spacing: 0.5px; }
        .v-num { font-family: monospace; font-size: 1.1rem; color: #1e40af; }
      }
    }
    .meta-strip {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px 16px;
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px;
      font-size: 0.8rem;
      label { display: block; font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 600; }
    }
    .clearance-summary-strip {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; font-size: 0.78rem;
      .cs-lbl { font-weight: 700; color: #334155; }
      .cs-badge { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
    }
    .breakdown-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .bd-table {
      width: 100%; border-collapse: collapse; font-size: 0.82rem; border: 1px solid #cbd5e1;
      th, td { padding: 6px 10px; border: 1px solid #e2e8f0; }
      th { background: #f1f5f9; font-size: 0.74rem; font-weight: 700; color: #334155; }
      .total-row { background: #f8fafc; font-weight: 700; }
    }
    .paper-net-block {
      background: #eff6ff; border: 2px solid #93c5fd; border-radius: 8px; padding: 12px 18px;
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px;
      .net-lbl { font-size: 0.85rem; font-weight: 800; color: #1e40af; }
      .net-words { font-size: 0.75rem; color: #475569; margin-top: 2px; }
      .net-val { font-size: 1.6rem; font-weight: 800; color: #1e3a8a; }
    }
    .paper-signatures {
      display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 20px;
      .sig-box {
        display: flex; flex-direction: column; gap: 4px; font-size: 0.76rem; color: #475569;
        .sig-line { width: 140px; height: 1px; background: #94a3b8; margin-bottom: 4px; }
        small { font-size: 0.68rem; color: #94a3b8; line-height: 1.2; }
      }
      .stamp-box {
        border: 1.5px dashed #cbd5e1; border-radius: 20px; padding: 4px 10px;
        display: inline-flex; align-items: center; gap: 4px; color: #94a3b8; font-size: 0.7rem; font-weight: 700;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }
    }

    /* Relieving Certificate Paper */
    .cert-paper {
      padding: 30px; font-family: 'Georgia', serif; color: #0f172a;
      .cert-border {
        border: 4px double #1e3a8a; padding: 36px 42px; position: relative; background: #ffffff;
      }
      .cert-header {
        text-align: center; border-bottom: 1.5px solid #1e3a8a; padding-bottom: 16px; margin-bottom: 24px;
        .inst-crest {
          width: 50px; height: 50px; border-radius: 50%; background: #1e3a8a; color: #fff;
          margin: 0 auto 10px; display: flex; align-items: center; justify-content: center;
          mat-icon { font-size: 30px; width: 30px; height: 30px; }
        }
        .inst-cert-title { font-size: 1.8rem; font-weight: 800; margin: 0; color: #1e3a8a; letter-spacing: 1px; }
        .inst-cert-sub { font-size: 0.85rem; color: #64748b; margin: 4px 0 12px; font-style: italic; }
        .cert-ref-strip {
          display: flex; justify-content: space-between; font-size: 0.82rem; color: #475569;
          font-family: sans-serif;
        }
      }
      .cert-title-badge {
        text-align: center; margin-bottom: 24px;
        h2 { font-size: 1.35rem; font-weight: 800; color: #1e3a8a; letter-spacing: 2px; margin: 0; }
        span { font-size: 0.85rem; color: #64748b; font-family: sans-serif; font-weight: 600; }
      }
      .cert-body-text {
        font-size: 0.95rem; line-height: 1.7; color: #1e293b; text-align: justify;
        .to-whom { font-size: 1rem; font-weight: 700; text-align: center; margin-bottom: 18px; letter-spacing: 1.5px; }
        .body-para { margin-bottom: 16px; text-indent: 28px; }
      }
      .cert-footer {
        display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; padding-top: 10px;
        .gold-seal {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          border: 2px dashed #b45309; border-radius: 50%; width: 90px; height: 90px;
          justify-content: center; color: #b45309; font-size: 0.65rem; font-weight: 800; font-family: sans-serif;
          mat-icon { font-size: 28px; width: 28px; height: 28px; color: #d97706; }
        }
        .principal-sig {
          text-align: right; display: flex; flex-direction: column; gap: 2px; font-family: sans-serif;
          .sig-line-gold { width: 170px; height: 1.5px; background: #1e3a8a; margin-bottom: 6px; margin-left: auto; }
          strong { font-size: 0.88rem; color: #0f172a; }
          span { font-size: 0.78rem; color: #64748b; }
        }
      }
    }

    .empty-state {
      text-align: center; padding: 40px 20px; color: #64748b;
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #cbd5e1; margin-bottom: 8px; }
      h4 { margin: 0 0 4px; font-size: 1.1rem; color: #1e293b; }
      p { margin: 0; font-size: 0.84rem; }
    }

    @media print {
      .no-print { display: none !important; }
      .fnf-modal-overlay, .doc-modal-overlay { position: static !important; background: transparent !important; padding: 0 !important; }
      .doc-paper, .cert-paper { padding: 0 !important; }
    }
  `]
})
export class TeacherFnFComponent implements OnInit {
  api = API_BASE;
  loading = false;
  saving = false;
  Math = Math;

  settlements: TeacherFnFSettlementDto[] = [];
  activeTeachers: TeacherDto[] = [];
  searchTerm = '';

  // Drawer state
  showDrawer = false;
  preSelectedTeacherId: string | null = null;
  preview: TeacherFnFPreviewDto | null = null;
  pendingViewTeacherId: string | null = null;
  pendingTeacherId: string | null = null;

  // Documents state
  showStatementModal = false;
  showCertModal = false;
  activeSettlement: TeacherFnFSettlementDto | null = null;

  todayDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  instituteName = 'Apex Coaching Academy';

  formData: CreateTeacherFnFRequestDto = {
    teacherId: '',
    resignationDate: new Date().toISOString().split('T')[0],
    lastWorkingDate: new Date().toISOString().split('T')[0],
    reasonForLeaving: 'Resignation',
    remarks: '',
    academicClearance: true,
    libraryClearance: true,
    assetClearance: true,
    hostelClearance: true,
    transportClearance: true,
    workingDaysInFinalMonth: 0,
    unpaidSalary: 0,
    earnedLeaveEncashment: 0,
    gratuityOrBonus: 0,
    otherAdditions: 0,
    pendingAdvanceDeduction: 0,
    noticeShortfallDeduction: 0,
    libraryDuesDeduction: 0,
    assetLossDeduction: 0,
    otherDeductions: 0,
    paymentMode: 'BankTransfer',
    paymentReference: '',
    finalizeNow: true
  };

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private confirmDialog: ConfirmDialogService,
    private authService: AuthService
  ) {
    const inst = this.authService.currentUser()?.instituteName;
    if (inst) this.instituteName = inst;
  }

  ngOnInit(): void {
    this.loadSettlements();
    this.loadActiveTeachers();

    this.route.queryParams.subscribe(params => {
      if (params['viewSettlementTeacherId']) {
        this.pendingViewTeacherId = params['viewSettlementTeacherId'];
        this.checkPendingQueryTeacherAction();
      } else if (params['teacherId']) {
        this.pendingTeacherId = params['teacherId'];
        this.checkPendingQueryTeacherAction();
      }
    });
  }

  loadSettlements(): void {
    this.loading = true;
    this.http.get<TeacherFnFSettlementDto[]>(`${this.api}/teachers/fnf-settlements`).subscribe({
      next: (res) => {
        this.settlements = res || [];
        this.loading = false;
        this.checkPendingQueryTeacherAction();
      },
      error: () => {
        this.settlements = [];
        this.loading = false;
      }
    });
  }

  checkPendingQueryTeacherAction(): void {
    if (this.pendingViewTeacherId && this.settlements.length > 0) {
      const s = this.settlements.find(x => x.teacherId === this.pendingViewTeacherId);
      if (s) {
        this.viewSettlementStatement(s);
        this.pendingViewTeacherId = null;
      }
    } else if (this.pendingTeacherId && this.settlements.length > 0) {
      const settled = this.settlements.find(x => x.teacherId === this.pendingTeacherId && x.status === 'Settled');
      if (settled) {
        // Teacher is already settled! Directly open their settlement statement
        this.viewSettlementStatement(settled);
        this.pendingTeacherId = null;
      } else if (!this.loading) {
        // Teacher is not settled yet, open the FNF initiation drawer
        this.preSelectedTeacherId = this.pendingTeacherId;
        this.openFnFDrawer(this.pendingTeacherId);
        this.pendingTeacherId = null;
      }
    }
  }

  openExistingSettlementFromPreview(): void {
    if (!this.formData.teacherId) return;
    const s = this.settlements.find(x => x.teacherId === this.formData.teacherId && x.status === 'Settled');
    this.closeDrawer();
    if (s) {
      this.viewSettlementStatement(s);
    } else {
      this.loadSettlements();
    }
  }

  loadActiveTeachers(): void {
    this.http.get<TeacherDto[]>(`${this.api}/teachers?activeOnly=true`).subscribe({
      next: (res) => this.activeTeachers = res || [],
      error: () => this.activeTeachers = []
    });
  }

  get filteredSettlements(): TeacherFnFSettlementDto[] {
    if (!this.searchTerm.trim()) return this.settlements;
    const term = this.searchTerm.trim().toLowerCase();
    return this.settlements.filter(s =>
      s.teacherName.toLowerCase().includes(term) ||
      s.employeeCode.toLowerCase().includes(term) ||
      s.settlementVoucherNo.toLowerCase().includes(term)
    );
  }

  getPendingCount(): number {
    return this.settlements.filter(s => s.status === 'Draft').length;
  }

  getSettledCount(): number {
    return this.settlements.filter(s => s.status === 'Settled').length;
  }

  getTotalSettledAmount(): number {
    return this.settlements.reduce((sum, s) => sum + (s.status === 'Settled' ? s.netPayableAmount : 0), 0);
  }

  openFnFDrawer(teacherId?: string): void {
    this.formData = {
      teacherId: teacherId || '',
      resignationDate: new Date().toISOString().split('T')[0],
      lastWorkingDate: new Date().toISOString().split('T')[0],
      reasonForLeaving: 'Resignation',
      remarks: '',
      academicClearance: true,
      libraryClearance: true,
      assetClearance: true,
      hostelClearance: true,
      transportClearance: true,
      workingDaysInFinalMonth: 0,
      unpaidSalary: 0,
      earnedLeaveEncashment: 0,
      gratuityOrBonus: 0,
      otherAdditions: 0,
      pendingAdvanceDeduction: 0,
      noticeShortfallDeduction: 0,
      libraryDuesDeduction: 0,
      assetLossDeduction: 0,
      otherDeductions: 0,
      paymentMode: 'BankTransfer',
      paymentReference: '',
      finalizeNow: true
    };
    this.preview = null;
    this.showDrawer = true;

    if (teacherId) {
      this.onTeacherSelected();
    }
  }

  closeDrawer(): void {
    this.showDrawer = false;
    this.preSelectedTeacherId = null;
    this.preview = null;
  }

  getNoticePeriodDays(): number {
    if (!this.formData.resignationDate || !this.formData.lastWorkingDate) return 0;
    const r = new Date(this.formData.resignationDate);
    const l = new Date(this.formData.lastWorkingDate);
    const diffMs = l.getTime() - r.getTime();
    return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  }

  onTeacherSelected(): void {
    if (!this.formData.teacherId) return;

    this.http.get<TeacherFnFPreviewDto>(`${this.api}/teachers/${this.formData.teacherId}/fnf-preview`).subscribe({
      next: (prev) => {
        this.preview = prev;

        if (prev.isFnFAlreadySettled) {
          this.confirmDialog.alert(
            'Already Settled',
            `${prev.teacherName} has already completed Full & Final Settlement (FNF).`,
            'info'
          );
        }

        this.formData.workingDaysInFinalMonth = prev.finalMonthPresentDays;
        this.formData.unpaidSalary = prev.suggestedUnpaidSalary;
        this.formData.pendingAdvanceDeduction = prev.outstandingAdvanceBalance;
        this.formData.libraryDuesDeduction = prev.pendingLibraryFines;

        // Auto-evaluate clearances
        this.formData.academicClearance = prev.activeBatchesCount === 0 && prev.assignedSectionsCount === 0;
        this.formData.libraryClearance = prev.pendingLibraryBooksCount === 0;
        this.formData.assetClearance = true;
        this.formData.hostelClearance = !prev.isHostelResident;
        this.formData.transportClearance = !prev.isTransportStaff;
      },
      error: (err) => {
        this.confirmDialog.alert('Error', err?.error?.message || 'Could not fetch teacher dues preview.', 'danger');
      }
    });
  }

  recalculateDues(): void {
    if (!this.preview) return;
    if (this.preview.isFinalMonthSalaryPaid) {
      this.formData.unpaidSalary = 0;
      return;
    }
    const lastDate = new Date(this.formData.lastWorkingDate);
    const day = lastDate.getDate();
    this.formData.workingDaysInFinalMonth = Math.min(day, 30);
    this.formData.unpaidSalary = Math.round(this.formData.workingDaysInFinalMonth * this.preview.perDayRate);
  }

  getCalculatedTotalEarnings(): number {
    return (this.formData.unpaidSalary || 0) +
           (this.formData.earnedLeaveEncashment || 0) +
           (this.formData.gratuityOrBonus || 0) +
           (this.formData.otherAdditions || 0);
  }

  getCalculatedTotalDeductions(): number {
    return (this.formData.pendingAdvanceDeduction || 0) +
           (this.formData.noticeShortfallDeduction || 0) +
           (this.formData.libraryDuesDeduction || 0) +
           (this.formData.assetLossDeduction || 0) +
           (this.formData.otherDeductions || 0);
  }

  getCalculatedNet(): number {
    return this.getCalculatedTotalEarnings() - this.getCalculatedTotalDeductions();
  }

  saveFnFSettlement(): void {
    if (!this.formData.teacherId) {
      this.confirmDialog.alert('Teacher Required', 'Please select a teacher to process FNF.', 'warning');
      return;
    }

    if (this.preview?.isFnFAlreadySettled) {
      this.confirmDialog.alert(
        'Settlement Locked',
        `${this.preview.teacherName} has already completed Full & Final Settlement. Duplicate settlement is strictly locked.`,
        'warning'
      );
      return;
    }

    // Block finalize if hostel not cleared
    if (this.preview?.isHostelResident && !this.formData.hostelClearance) {
      this.confirmDialog.alert(
        'Hostel Clearance Pending',
        `${this.preview.teacherName} still has active Staff Quarters (Rm ${this.preview.hostelRoomNumber}, Bed ${this.preview.hostelBedCode}). Please mark "Hostel / Quarters Clearance" after room is vacated and keys surrendered.`,
        'warning'
      );
      return;
    }

    // Block finalize if transport not cleared
    if (this.preview?.isTransportStaff && !this.formData.transportClearance) {
      this.confirmDialog.alert(
        'Transport Clearance Pending',
        `${this.preview.teacherName} still has active transport allocation (${this.preview.transportRouteName}). Please mark "Transport Clearance" after bus pass is surrendered.`,
        'warning'
      );
      return;
    }

    // Warn (soft block) if library books pending
    if ((this.preview?.pendingLibraryBooksCount ?? 0) > 0 && !this.formData.libraryClearance) {
      this.confirmDialog.alert(
        'Library Clearance Pending',
        `${this.preview?.pendingLibraryBooksCount} library book(s) still issued to this teacher. Please ensure all books are returned and "Library Clearance" is ticked before finalizing.`,
        'warning'
      );
      return;
    }

    const net = this.getCalculatedNet();
    const actionWord = this.formData.finalizeNow ? 'finalize offboarding and settle' : 'save draft for';
    const amountStr = net >= 0 ? `disburse ₹${Math.round(net)}` : `recover ₹${Math.abs(Math.round(net))}`;

    this.confirmDialog.danger(
      'Confirm FNF Settlement',
      `Are you sure you want to ${actionWord} this settlement (${amountStr})? ${this.formData.finalizeNow ? 'The teacher and portal login will be immediately deactivated.' : ''}`,
      this.formData.finalizeNow ? 'Finalize & Settle' : 'Save Draft'
    ).subscribe(confirmed => {
      if (!confirmed) return;

      this.saving = true;
      this.http.post<TeacherFnFSettlementDto>(`${this.api}/teachers/${this.formData.teacherId}/fnf-settlements`, this.formData).subscribe({
        next: (res) => {
          this.saving = false;
          this.closeDrawer();
          this.loadSettlements();
          this.loadActiveTeachers();
          this.confirmDialog.alert('Settlement Complete', `FNF voucher ${res.settlementVoucherNo} processed successfully!`, 'success');
        },
        error: (err) => {
          this.saving = false;
          this.confirmDialog.alert('Settlement Failed', err?.error?.message || 'Error processing FNF settlement.', 'danger');
        }
      });
    });
  }

  viewSettlementStatement(s: TeacherFnFSettlementDto): void {
    this.activeSettlement = s;
    this.showStatementModal = true;
  }

  viewRelievingCertificate(s: TeacherFnFSettlementDto): void {
    this.activeSettlement = s;
    this.showCertModal = true;
  }

  printDocument(elementId: string): void {
    const el = document.getElementById(elementId);
    if (!el) return;

    const printWin = window.open('', '_blank', 'width=900,height=750');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>${elementId === 'fnf-statement-paper' ? 'FNF Statement' : 'Relieving Certificate'} - ${this.activeSettlement?.teacherName}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; background: #fff; padding: 24px; color: #1e293b; }
            .doc-paper, .cert-paper { max-width: 800px; margin: 0 auto; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 11px; }
            .text-right { text-align: right; }
            .total-row { background: #f1f5f9; font-weight: bold; }
            @page { size: A4; margin: 12mm; }
          </style>
        </head>
        <body>
          ${el.outerHTML}
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
      printWin.close();
    }, 500);
  }

  getAmountInWords(num: number): string {
    if (!num) return 'Zero Rupees Only';
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n: number): string => {
      let str = '';
      if (n >= 10000000) { str += inWords(Math.floor(n / 10000000)) + 'Crore '; n %= 10000000; }
      if (n >= 100000) { str += inWords(Math.floor(n / 100000)) + 'Lakh '; n %= 100000; }
      if (n >= 1000) { str += inWords(Math.floor(n / 1000)) + 'Thousand '; n %= 1000; }
      if (n >= 100) { str += inWords(Math.floor(n / 100)) + 'Hundred '; n %= 100; }
      if (n > 0) {
        if (n < 20) str += a[n];
        else str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
      }
      return str;
    };

    return inWords(Math.round(num)).trim() + ' Rupees Only';
  }
}
