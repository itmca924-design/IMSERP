import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { HttpClient } from '@angular/common/http';
import { BatchesService, BatchDto } from '../../core/services/batches.service';
import { SchoolService } from '../../core/services/school.service';
import { FeesService, StudentFeeCard } from '../../core/services/fees.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { FeeCollectionDialogComponent } from '../fees/fee-collection-dialog.component';
import { FeeReceiptDialogComponent } from '../fees/fee-receipt-dialog.component';
import { FeeReminderDispatchDialogComponent, FeeReminderDispatchItem } from '../dashboard/dialogs/fee-reminder-dispatch-dialog.component';
import { WhatsAppFeeCardDialogComponent } from '../fees/whatsapp-fee-card-dialog.component';
import { environment } from '../../../environments/environment';

export interface ClassOption {
  id: string;
  name: string;
}

export interface StudentFeeRow {
  id: string;
  studentName: string;
  rollNumber?: string;
  coachingRollNumber?: string;
  admissionNumber?: string;
  fatherName?: string;
  mobileNumber?: string;
  parentWhatsAppPhone?: string;
  monthlyFee: number;
  totalBilled: number;
  totalPaid: number;
  balanceDue: number;
  status: 'Paid' | 'Partial' | 'Due';
  profilePhoto?: string;
  photoFailed?: boolean;
}

@Component({
  selector: 'app-coaching-fee-vouchers',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatDialogModule,
    MatMenuModule
  ],
  template: `
    <div class="page-container">
      <!-- Page Header -->
      <div class="page-header">
        <div class="title-area">
          <div class="header-icon-box">
            <mat-icon>receipt_long</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Batch Fee Vouchers & Dues (कोचिंग फीस एवं बकाया)</h1>
            <p class="page-subtitle">Track batch-wise monthly fee collection, outstanding balances, and WhatsApp due receipts with Class ➔ Batch cascade.</p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-flat-button color="primary" class="header-action-btn" (click)="openBulkFees()">
            <mat-icon>account_balance_wallet</mat-icon>
            <span>Open Fee Management</span>
          </button>
        </div>
      </div>

      <!-- Single Prominent Loading Bar -->
      @if (loading) {
        <mat-progress-bar mode="indeterminate" class="global-loader"></mat-progress-bar>
      }

      <!-- Cascading Filter Deck (Class ➔ Batches) -->
      <mat-card class="filter-card mat-elevation-z1">
        <form [formGroup]="filterForm" class="filter-form">
          <!-- Step 1: Class Selector -->
          <mat-form-field appearance="outline" class="filter-control">
            <mat-label>Academic Class (कक्षा)</mat-label>
            <mat-select formControlName="classId" (selectionChange)="onClassChange($event.value)">
              <mat-option value="">-- All Classes (सभी कक्षाएं) --</mat-option>
              @for (c of classes; track c.id) {
                <mat-option [value]="c.id">{{ c.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <!-- Step 2: Cascading Batch Selector -->
          <mat-form-field appearance="outline" class="filter-control highlight-control">
            <mat-label>Coaching Batch (बैच चयन) *</mat-label>
            <mat-select formControlName="batchId" (selectionChange)="onBatchChange($event.value)">
              @if (filteredBatches.length === 0) {
                <mat-option disabled>No batches available for selected class</mat-option>
              }
              @for (b of filteredBatches; track b.id) {
                <mat-option [value]="b.id">
                  <strong>{{ b.name }}</strong> ({{ b.subject || 'All Subjects' }} • ₹{{ b.standardMonthlyFee || 0 }}/mo)
                </mat-option>
              }
            </mat-select>
          </mat-form-field>

          <!-- Dues Status Filter -->
          <mat-form-field appearance="outline" class="filter-control status-control">
            <mat-label>Due Status Filter</mat-label>
            <mat-select formControlName="statusFilter" (selectionChange)="applyFilters()">
              <mat-option value="ALL">All Students</mat-option>
              <mat-option value="DUE">Outstanding Dues Only</mat-option>
              <mat-option value="PAID">Fully Cleared Only</mat-option>
            </mat-select>
          </mat-form-field>
        </form>

        <!-- Selected Batch Meta Strip -->
        @if (selectedBatch) {
          <div class="batch-meta-strip">
            <div class="meta-pill">
              <mat-icon>class</mat-icon>
              <span>Batch: <strong>{{ selectedBatch.name }}</strong></span>
            </div>
            <div class="meta-pill fee-pill">
              <mat-icon>payments</mat-icon>
              <span>Standard Monthly Fee: <strong>₹{{ selectedBatch.standardMonthlyFee || 0 }} / student</strong></span>
            </div>
            <div class="meta-pill count-pill">
              <mat-icon>people</mat-icon>
              <span>Enrolled Students: <strong>{{ students.length }}</strong></span>
            </div>
          </div>
        }
      </mat-card>

      <!-- Financial KPI Deck -->
      @if (selectedBatchId && students.length > 0) {
        <div class="kpi-deck">
          <mat-card class="kpi-card total">
            <div class="kpi-content">
              <div class="kpi-info">
                <span class="kpi-label">Total Monthly Expected</span>
                <span class="kpi-value">₹{{ totalExpected | number }}</span>
              </div>
              <div class="kpi-icon total"><mat-icon>account_balance</mat-icon></div>
            </div>
          </mat-card>

          <mat-card class="kpi-card collected">
            <div class="kpi-content">
              <div class="kpi-info">
                <span class="kpi-label">Total Collected</span>
                <span class="kpi-value text-green">₹{{ totalCollected | number }}</span>
              </div>
              <div class="kpi-icon collected"><mat-icon>paid</mat-icon></div>
            </div>
          </mat-card>

          <mat-card class="kpi-card pending">
            <div class="kpi-content">
              <div class="kpi-info">
                <span class="kpi-label">Outstanding Dues</span>
                <span class="kpi-value text-red">₹{{ totalDues | number }}</span>
              </div>
              <div class="kpi-icon pending"><mat-icon>money_off</mat-icon></div>
            </div>
          </mat-card>

          <mat-card class="kpi-card recovery">
            <div class="kpi-content">
              <div class="kpi-info">
                <span class="kpi-label">Fee Recovery Rate</span>
                <span class="kpi-value text-blue">{{ recoveryRate }}%</span>
              </div>
              <div class="kpi-icon recovery"><mat-icon>trending_up</mat-icon></div>
            </div>
          </mat-card>
        </div>

        <!-- Student Ledger Table Card -->
        <mat-card class="table-card mat-elevation-z1">
          <div class="table-toolbar">
            <h3 class="toolbar-title">Batch Student Ledgers ({{ filteredStudents.length }})</h3>
          </div>

          <div class="table-responsive">
            <table mat-table [dataSource]="filteredStudents" class="erp-table">
              <!-- Roll No -->
              <ng-container matColumnDef="rollNo">
                <th mat-header-cell *matHeaderCellDef style="width: 80px;">Roll No</th>
                <td mat-cell *matCellDef="let s">
                  <span class="roll-badge">{{ s.coachingRollNumber || s.rollNumber || '—' }}</span>
                </td>
              </ng-container>

              <!-- Student Details -->
              <ng-container matColumnDef="studentName">
                <th mat-header-cell *matHeaderCellDef>Student & Guardian</th>
                <td mat-cell *matCellDef="let s">
                  <div class="student-info-cell">
                    <div class="avatar-box" [style.background]="!s.profilePhoto || s.photoFailed ? getAvatarBg(s.studentName) : '#e2e8f0'">
                      @if (s.profilePhoto && !s.photoFailed) {
                        <img [src]="getPhotoUrl(s.profilePhoto)" (error)="s.photoFailed = true" alt="Photo" class="avatar-img" />
                      } @else {
                        <span class="avatar-initials">{{ getInitials(s.studentName) }}</span>
                      }
                    </div>
                    <div class="info-texts">
                      <span class="name-text">{{ s.studentName }}</span>
                      <span class="sub-text">Father: {{ s.fatherName || '—' }} • Adm: {{ s.admissionNumber || 'N/A' }}</span>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- Monthly Fee -->
              <ng-container matColumnDef="monthlyFee">
                <th mat-header-cell *matHeaderCellDef style="text-align: right;">Monthly Fee</th>
                <td mat-cell *matCellDef="let s" style="text-align: right; font-weight: 600;">
                  ₹{{ s.monthlyFee | number }}
                </td>
              </ng-container>

              <!-- Paid Amount -->
              <ng-container matColumnDef="paid">
                <th mat-header-cell *matHeaderCellDef style="text-align: right;">Total Paid</th>
                <td mat-cell *matCellDef="let s" style="text-align: right; color: #16a34a; font-weight: 700;">
                  ₹{{ s.totalPaid | number }}
                </td>
              </ng-container>

              <!-- Balance Due -->
              <ng-container matColumnDef="balance">
                <th mat-header-cell *matHeaderCellDef style="text-align: right;">Balance Due</th>
                <td mat-cell *matCellDef="let s" style="text-align: right;">
                  <span [class.dues-text]="s.balanceDue > 0" [class.cleared-text]="s.balanceDue === 0">
                    ₹{{ s.balanceDue | number }}
                  </span>
                </td>
              </ng-container>

              <!-- Status -->
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef style="width: 80px; text-align: center;">Status</th>
                <td mat-cell *matCellDef="let s" style="text-align: center;">
                  <span class="status-tag" [class.paid]="s.status === 'Paid'" [class.partial]="s.status === 'Partial'" [class.due]="s.status === 'Due'">
                    {{ s.status }}
                  </span>
                </td>
              </ng-container>

              <!-- Actions -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef style="width: 130px; text-align: right;">Actions</th>
                <td mat-cell *matCellDef="let s" style="text-align: right;">
                  <div class="actions-group">
                    @if (s.balanceDue > 0) {
                      <button mat-button class="collect-btn" (click)="openFeeCollection(s)" matTooltip="Collect Fee Payment">
                        <mat-icon>add_card</mat-icon> Collect
                      </button>
                    } @else {
                      <span class="settled-pill" matTooltip="All Dues Fully Settled (फीस पूर्णतः जमा)">
                        <mat-icon class="settled-icon">check_circle</mat-icon>
                        <span>Settled</span>
                      </span>
                      <button mat-icon-button class="receipt-btn" (click)="openReceipt(s)" matTooltip="View / Print Receipt">
                        <mat-icon>receipt_long</mat-icon>
                      </button>
                    }

                    <!-- 3-Dots Context Menu with WhatsApp & Utilities -->
                    <button mat-icon-button [matMenuTriggerFor]="rowMenu" class="more-opts-btn" matTooltip="More Options">
                      <mat-icon>more_vert</mat-icon>
                    </button>
                    <mat-menu #rowMenu="matMenu">
                      <button mat-menu-item (click)="shareWhatsApp(s)">
                        <mat-icon style="color: #16a34a;">chat</mat-icon>
                        <span>{{ s.balanceDue > 0 ? 'Send WhatsApp Due Reminder' : 'Send WhatsApp Payment Receipt' }}</span>
                      </button>
                      @if (s.balanceDue <= 0) {
                        <button mat-menu-item (click)="openFeeCollection(s)">
                          <mat-icon style="color: #2563eb;">add_circle</mat-icon>
                          <span>Deposit Advance (अग्रिम शुल्क)</span>
                        </button>
                        <button mat-menu-item (click)="openReceipt(s)">
                          <mat-icon style="color: #0284c7;">receipt_long</mat-icon>
                          <span>View Official Receipt</span>
                        </button>
                      } @else {
                        <button mat-menu-item (click)="openReceipt(s)">
                          <mat-icon style="color: #0284c7;">receipt_long</mat-icon>
                          <span>Payment History</span>
                        </button>
                      }
                    </mat-menu>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns;"></tr>
            </table>
          </div>
        </mat-card>
      } @else if (selectedBatchId && !loading && students.length === 0) {
        <mat-card class="notice-card mat-elevation-z1">
          <mat-icon class="notice-icon">group_off</mat-icon>
          <h3>No Students in Selected Batch</h3>
          <p>Please allocate students to <strong>{{ selectedBatch?.name }}</strong> to manage fee vouchers.</p>
        </mat-card>
      } @else if (!selectedBatchId) {
        <mat-card class="notice-card mat-elevation-z1">
          <mat-icon class="notice-icon">touch_app</mat-icon>
          <h3>Please Select an Academic Class and Coaching Batch</h3>
          <p>Select a coaching batch from the filter deck above to view student fee ledgers and collection metrics.</p>
        </mat-card>
      }
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

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      padding: 18px 24px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }

    .title-area {
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
      mat-icon { font-size: 26px; width: 26px; height: 26px; }
    }

    .page-title {
      font-size: 1.4rem;
      font-weight: 700;
      color: #1e3a8a;
      margin: 0;
    }

    .page-subtitle {
      font-size: 0.86rem;
      color: #64748b;
      margin: 3px 0 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-action-btn {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
      color: #ffffff !important;
      font-weight: 700 !important;
      font-size: 0.88rem !important;
      padding: 0 18px !important;
      height: 42px !important;
      border-radius: 10px !important;
      box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25) !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 8px !important;
      white-space: nowrap !important;
      cursor: pointer;
      border: none !important;
      transition: all 0.2s ease !important;

      &:hover {
        background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%) !important;
        transform: translateY(-1px);
        box-shadow: 0 6px 14px rgba(37, 99, 235, 0.35) !important;
      }

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        margin: 0 !important;
        color: #ffffff !important;
      }

      span {
        white-space: nowrap !important;
      }
    }

    .global-loader {
      border-radius: 4px;
      overflow: hidden;
    }

    .filter-card {
      padding: 18px 22px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
    }

    .filter-form {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
    }

    .filter-control {
      flex: 1 1 240px;
      min-width: 220px;
    }

    .highlight-control {
      flex: 1 1 300px;
    }

    .status-control {
      flex: 1 1 200px;
    }

    .batch-meta-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px dashed #e2e8f0;
    }

    .meta-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f1f5f9;
      color: #334155;
      padding: 5px 12px;
      border-radius: 8px;
      font-size: 0.82rem;
      border: 1px solid #e2e8f0;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2563eb; }
    }

    .fee-pill {
      background: #ecfdf5;
      border-color: #a7f3d0;
      color: #065f46;
      mat-icon { color: #059669; }
    }

    .count-pill {
      background: #eff6ff;
      border-color: #bfdbfe;
      color: #1e40af;
      mat-icon { color: #2563eb; }
    }

    .kpi-deck {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .kpi-card {
      border-radius: 12px;
      padding: 16px 20px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
    }

    .kpi-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .kpi-info {
      display: flex;
      flex-direction: column;
    }

    .kpi-label {
      font-size: 0.78rem;
      text-transform: uppercase;
      font-weight: 600;
      color: #64748b;
      letter-spacing: 0.03em;
    }

    .kpi-value {
      font-size: 1.55rem;
      font-weight: 700;
      color: #1e293b;
      line-height: 1.2;
      margin-top: 3px;
    }

    .text-green { color: #16a34a; }
    .text-red { color: #dc2626; }
    .text-blue { color: #2563eb; }

    .kpi-icon {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      mat-icon { font-size: 24px; width: 24px; height: 24px; }
      &.total { background: #f1f5f9; color: #475569; }
      &.collected { background: #dcfce7; color: #16a34a; }
      &.pending { background: #fee2e2; color: #dc2626; }
      &.recovery { background: #dbeafe; color: #2563eb; }
    }

    .table-card {
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      padding: 16px;
    }

    .table-toolbar {
      margin-bottom: 14px;
    }

    .toolbar-title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: #1e3a8a;
    }

    .table-responsive {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      scrollbar-width: none; /* Firefox */
      -ms-overflow-style: none; /* IE / Edge */

      &::-webkit-scrollbar {
        display: none; /* Chrome, Safari, Opera */
        width: 0;
        height: 0;
      }
    }

    .erp-table {
      width: 100%;
      background: #ffffff;
      border-collapse: collapse;

      th {
        background: #f8fafc;
        color: #475569;
        font-weight: 600;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        padding: 10px 10px;
        border-bottom: 1px solid #e2e8f0;
        white-space: nowrap;
      }

      td {
        padding: 10px 10px;
        border-bottom: 1px solid #f1f5f9;
        font-size: 0.86rem;
        color: #1e293b;
        white-space: nowrap;
      }

      tr:hover td {
        background: #f8fafc;
      }
    }

    .student-info-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .avatar-box {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      color: #64748b;
      flex-shrink: 0;

      .avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .avatar-initials {
        color: #ffffff;
        font-weight: 700;
        font-size: 0.84rem;
        line-height: 1;
        letter-spacing: 0.5px;
      }
    }

    .info-texts {
      display: flex;
      flex-direction: column;
    }

    .name-text {
      font-weight: 600;
      color: #0f172a;
    }

    .sub-text {
      font-size: 0.74rem;
      color: #64748b;
    }

    .roll-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      background: #eff6ff;
      color: #1d4ed8;
      font-weight: 700;
      font-size: 0.82rem;
      border: 1px solid #bfdbfe;
    }

    .dues-text {
      color: #dc2626;
      font-weight: 700;
    }

    .cleared-text {
      color: #16a34a;
      font-weight: 600;
    }

    .status-tag {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.74rem;
      font-weight: 700;
      border: 1px solid;

      &.paid {
        background: #ecfdf5;
        border-color: #a7f3d0;
        color: #065f46;
      }

      &.partial {
        background: #fef3c7;
        border-color: #fde68a;
        color: #92400e;
      }

      &.due {
        background: #fef2f2;
        border-color: #fecaca;
        color: #991b1b;
      }
    }

    .actions-group {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
    }

    .collect-btn {
      color: #2563eb;
      font-weight: 600;
      font-size: 0.82rem;
      mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
      &:hover { background: #eff6ff; }
    }

    .settled-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
      background: #f0fdf4;
      color: #166534;
      border: 1px solid #bbf7d0;
      letter-spacing: 0.2px;

      .settled-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        color: #16a34a;
      }
    }

    .receipt-btn {
      color: #0284c7;
      &:hover { background: #f0f9ff; }
    }

    .more-opts-btn {
      color: #64748b;
      &:hover { background: #f1f5f9; }
    }

    .whatsapp-btn {
      color: #16a34a;
      &:hover { background: #f0fdf4; }
    }

    .notice-card {
      padding: 48px 24px;
      text-align: center;
      border-radius: 12px;
      border: 1px dashed #cbd5e1;
      background: #f8fafc;
      color: #64748b;
      .notice-icon { font-size: 48px; width: 48px; height: 48px; color: #3b82f6; margin-bottom: 8px; }
      h3 { font-size: 1.15rem; color: #1e3a8a; margin: 0 0 6px; font-weight: 700; }
      p { font-size: 0.88rem; max-width: 500px; margin: 0 auto 16px; line-height: 1.5; }
    }

    @media (max-width: 1024px) {
      .kpi-deck {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 640px) {
      .kpi-deck {
        grid-template-columns: 1fr;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachingFeeVouchersComponent implements OnInit {
  filterForm: FormGroup;
  classes: ClassOption[] = [];
  allBatches: BatchDto[] = [];
  filteredBatches: BatchDto[] = [];
  selectedBatch: BatchDto | null = null;
  selectedBatchId: string = '';

  students: StudentFeeRow[] = [];
  filteredStudents: StudentFeeRow[] = [];
  columns: string[] = ['rollNo', 'studentName', 'monthlyFee', 'paid', 'balance', 'status', 'actions'];

  loading = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private batchesService: BatchesService,
    private schoolService: SchoolService,
    private feesService: FeesService,
    private auth: AuthService,
    private router: Router,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {
    this.filterForm = this.fb.group({
      classId: [''],
      batchId: [''],
      statusFilter: ['ALL']
    });
  }

  ngOnInit(): void {
    this.loadClasses();
    this.loadBatches();
  }

  loadClasses(): void {
    this.schoolService.getClasses(true, 'Coaching').subscribe({
      next: res => {
        this.classes = (res || []).map(c => ({ id: c.id, name: c.name }));
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  loadBatches(): void {
    this.loading = true;
    this.batchesService.getBatches().subscribe({
      next: batches => {
        this.allBatches = batches || [];
        this.filterBatchesByClass();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onClassChange(classId: string): void {
    this.filterBatchesByClass();
    this.filterForm.patchValue({ batchId: '' });
    this.selectedBatchId = '';
    this.selectedBatch = null;
    this.students = [];
    this.filteredStudents = [];
    this.cdr.markForCheck();
  }

  filterBatchesByClass(): void {
    const selectedClassId = this.filterForm.get('classId')?.value;
    if (!selectedClassId) {
      this.filteredBatches = [...this.allBatches];
    } else {
      this.filteredBatches = this.allBatches.filter(b => b.classId === selectedClassId || !b.classId);
    }
  }

  onBatchChange(batchId: string): void {
    this.selectedBatchId = batchId;
    this.selectedBatch = this.allBatches.find(b => b.id === batchId) || null;
    if (batchId) {
      this.loadBatchLedgers(batchId);
    } else {
      this.students = [];
      this.filteredStudents = [];
    }
    this.cdr.markForCheck();
  }

  loadBatchLedgers(batchId: string): void {
    this.loading = true;
    const batchStandardFee = Number(this.selectedBatch?.standardMonthlyFee || 0);

    // Call the enterprise fee engine to get fully reconciled student fee ledgers
    this.feesService.getStudentFeeCardsByClass(undefined, undefined, batchId).subscribe({
      next: (cards: StudentFeeCard[]) => {
        if (cards && cards.length > 0) {
          this.students = cards.map((c: StudentFeeCard) => {
            const monthlyFee = Number(c.monthlyFeeRate || 0) > 0 
              ? Number(c.monthlyFeeRate) 
              : batchStandardFee;
            const totalPaid = Number(c.totalPaid || 0);
            const balanceDue = Number(c.totalBalanceDue || 0);
            const totalBilled = Number(c.totalAnnualFee || 0) > 0 
              ? Number(c.totalAnnualFee) 
              : (totalPaid + balanceDue > 0 ? totalPaid + balanceDue : monthlyFee);

            let status: 'Paid' | 'Partial' | 'Due' = 'Due';
            if (balanceDue === 0 && (totalPaid > 0 || totalBilled > 0)) {
              status = 'Paid';
            } else if (totalPaid > 0 && balanceDue > 0) {
              status = 'Partial';
            } else {
              status = 'Due';
            }

            return {
              id: c.studentId,
              studentName: c.studentName,
              rollNumber: c.rollNumber || undefined,
              coachingRollNumber: c.coachingRollNumber || undefined,
              admissionNumber: c.admissionNumber || undefined,
              fatherName: c.parentName || undefined,
              mobileNumber: c.parentWhatsAppPhone || c.emergencyContactPhone || undefined,
              parentWhatsAppPhone: c.parentWhatsAppPhone || undefined,
              monthlyFee: monthlyFee,
              totalBilled: totalBilled,
              totalPaid: totalPaid,
              balanceDue: balanceDue,
              status: status,
              profilePhoto: c.profilePhoto || undefined,
              photoFailed: false
            };
          });

          this.applyFilters();
          this.loading = false;
          this.cdr.markForCheck();
        } else {
          // Fallback to students list if no fee card records found
          this.loadStudentsFallback(batchId, batchStandardFee);
        }
      },
      error: (err) => {
        console.warn('Error loading dynamic fee cards, using fallback:', err);
        this.loadStudentsFallback(batchId, batchStandardFee);
      }
    });
  }

  private loadStudentsFallback(batchId: string, monthlyRate: number): void {
    this.http.get<any>(`${environment.apiUrl}/students/paged?batchId=${batchId}&pageSize=500`).subscribe({
      next: res => {
        const items = res.items || [];
        this.students = items.map((s: any) => {
          const totalPaid = (s.totalPaid !== undefined && s.totalPaid !== null) ? Number(s.totalPaid) : 0;
          const billed = monthlyRate;
          const balance = Math.max(0, billed - totalPaid);
          let status: 'Paid' | 'Partial' | 'Due' = 'Due';
          if (balance === 0 && totalPaid > 0) status = 'Paid';
          else if (totalPaid > 0 && balance > 0) status = 'Partial';

          return {
            id: s.id,
            studentName: s.studentName,
            rollNumber: s.rollNumber,
            coachingRollNumber: s.coachingRollNumber,
            admissionNumber: s.admissionNumber,
            fatherName: s.fatherName || s.parentName,
            mobileNumber: s.mobileNumber || s.parentWhatsAppPhone,
            parentWhatsAppPhone: s.parentWhatsAppPhone,
            monthlyFee: billed,
            totalBilled: billed,
            totalPaid: totalPaid,
            balanceDue: balance,
            status: status,
            profilePhoto: s.profilePhoto,
            photoFailed: false
          };
        });

        this.applyFilters();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  getPhotoUrl(photo?: string | null): string {
    if (!photo) return '';
    return this.auth.resolveLogoUrl(photo) || '';
  }

  getInitials(name: string): string {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  getAvatarBg(name: string): string {
    if (!name) return '#2563eb';
    const colors = [
      '#2563eb', '#059669', '#7c3aed', '#d97706', '#0891b2', '#e11d48', '#4f46e5', '#0284c7'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  applyFilters(): void {
    const filter = this.filterForm.get('statusFilter')?.value;
    if (filter === 'DUE') {
      this.filteredStudents = this.students.filter(s => s.balanceDue > 0);
    } else if (filter === 'PAID') {
      this.filteredStudents = this.students.filter(s => s.balanceDue === 0);
    } else {
      this.filteredStudents = [...this.students];
    }
    this.cdr.markForCheck();
  }

  get totalExpected(): number {
    return this.students.reduce((sum, s) => sum + s.monthlyFee, 0);
  }

  get totalCollected(): number {
    return this.students.reduce((sum, s) => sum + s.totalPaid, 0);
  }

  get totalDues(): number {
    return this.students.reduce((sum, s) => sum + s.balanceDue, 0);
  }

  get recoveryRate(): number {
    const total = this.totalCollected + this.totalDues;
    if (total <= 0) return 0;
    return Math.min(100, Math.round((this.totalCollected / total) * 100));
  }

  openBulkFees(): void {
    this.router.navigate(['/fees']);
  }

  openFeeCollection(s: StudentFeeRow): void {
    const dialogRef = this.dialog.open(FeeCollectionDialogComponent, {
      width: '880px',
      maxWidth: '96vw',
      panelClass: 'erp-custom-dialog',
      data: {
        studentId: s.id,
        studentName: s.studentName,
        rollNumber: s.coachingRollNumber || s.rollNumber,
        className: this.selectedBatch?.className || 'Coaching',
        batchName: this.selectedBatch?.name,
        dueAmount: s.balanceDue
      }
    });

    dialogRef.afterClosed().subscribe((collected: boolean) => {
      if (collected && this.selectedBatchId) {
        this.loadBatchLedgers(this.selectedBatchId);
      }
    });
  }

  shareWhatsApp(s: StudentFeeRow): void {
    const phone = s.parentWhatsAppPhone || s.mobileNumber || '';
    const className = this.selectedBatch?.className
      ? `${this.selectedBatch.className} • ${this.selectedBatch.name}`
      : (this.selectedBatch?.name || 'Coaching');

    const item: FeeReminderDispatchItem = {
      id: s.id,
      studentId: s.id,
      studentName: s.studentName,
      rollNumber: s.coachingRollNumber || s.rollNumber,
      className: className,
      profilePhoto: s.profilePhoto,
      totalAmount: s.totalPaid + s.balanceDue,
      paidAmount: s.totalPaid,
      dueAmount: s.balanceDue,
      status: s.status,
      dueDate: new Date(),
      parentWhatsAppPhone: phone,
      isCoachingStudent: true,
      scopeTag: 'Coaching'
    };

    this.dialog.open(FeeReminderDispatchDialogComponent, {
      width: '740px',
      maxWidth: '96vw',
      panelClass: 'erp-custom-dialog',
      data: {
        mode: 'single',
        invoice: item,
        instituteName: this.auth.getInstituteName() || 'Jnandeep Campus'
      }
    });
  }

  openReceipt(s: StudentFeeRow): void {
    this.feesService.getStudentLedger(s.id).subscribe({
      next: (ledger) => {
        const lastPayment = ledger?.payments && ledger.payments.length > 0 ? ledger.payments[0] : null;
        if (lastPayment && lastPayment.receiptNumber) {
          this.feesService.getReceiptByNumber(lastPayment.receiptNumber).subscribe({
            next: (res) => {
              this.dialog.open(FeeReceiptDialogComponent, {
                width: '840px',
                maxWidth: '96vw',
                panelClass: 'receipt-dialog-panel',
                data: {
                  receipt: res,
                  instituteName: this.auth.getInstituteName(),
                  branchName: this.auth.getCurrentBranchName()
                }
              });
            },
            error: () => {
              this.shareWhatsApp(s);
            }
          });
        } else {
          this.shareWhatsApp(s);
        }
      },
      error: () => {
        this.shareWhatsApp(s);
      }
    });
  }
}
