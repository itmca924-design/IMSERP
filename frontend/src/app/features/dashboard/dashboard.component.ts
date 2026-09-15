import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { CoachingService } from '../../core/services/coaching.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    RouterModule
  ],
  template: `
    <div class="dashboard-wrapper">
      <!-- Header Banner -->
      <div class="header-banner">
        <div class="header-titles">
          <h2>Institute Performance Overview</h2>
          <p>Real-time analytics for Fees, Students, Test Exams, and WhatsApp Notifications.</p>
        </div>
        <button mat-raised-button color="primary" class="refresh-btn" (click)="loadSummary()" matTooltip="Refresh Live Analytics">
          <mat-icon [class.spin-icon]="loading">sync</mat-icon>
          <span>Refresh Analytics</span>
        </button>
      </div>

      <div *ngIf="loading && !summary" class="spinner-center">
        <mat-spinner diameter="44"></mat-spinner>
      </div>

      <ng-container *ngIf="summary">

        <!-- 1. Top KPI Stat Cards -->
        <div class="card-container">
          <mat-card class="stat-card blue mat-elevation-z2">
            <mat-card-content class="stat-content">
              <div class="stat-header">
                <span class="label">Total Active Students</span>
                <div class="stat-icon-wrap">
                  <mat-icon class="stat-icon">people</mat-icon>
                </div>
              </div>
              <div class="stat-body">
                <span class="value">{{ summary.totalStudents }}</span>
                <div class="stat-footer">
                  <span class="stat-badge-pill">Live Roster</span>
                  <span class="sub-label">Enrolled in institute</span>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card green mat-elevation-z2">
            <mat-card-content class="stat-content">
              <div class="stat-header">
                <span class="label">Monthly Fee Collected</span>
                <div class="stat-icon-wrap">
                  <mat-icon class="stat-icon">account_balance_wallet</mat-icon>
                </div>
              </div>
              <div class="stat-body">
                <span class="value">₹{{ summary.totalFeeCollectedThisMonth | number:'1.0-0' }}</span>
                <div class="stat-footer">
                  <span class="stat-badge-pill">This Month</span>
                  <span class="sub-label">Received this month</span>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card orange mat-elevation-z2">
            <mat-card-content class="stat-content">
              <div class="stat-header">
                <span class="label">Pending Fees Due</span>
                <div class="stat-icon-wrap">
                  <mat-icon class="stat-icon">warning_amber</mat-icon>
                </div>
              </div>
              <div class="stat-body">
                <span class="value">₹{{ summary.pendingFeesTotal | number:'1.0-0' }}</span>
                <div class="stat-footer">
                  <span class="stat-badge-pill">Receivables</span>
                  <span class="sub-label">Outstanding balance</span>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card purple mat-elevation-z2">
            <mat-card-content class="stat-content">
              <div class="stat-header">
                <span class="label">Tests Conducted</span>
                <div class="stat-icon-wrap">
                  <mat-icon class="stat-icon">quiz</mat-icon>
                </div>
              </div>
              <div class="stat-body">
                <span class="value">{{ summary.totalTestsConducted }}</span>
                <div class="stat-footer">
                  <span class="stat-badge-pill">Academic</span>
                  <span class="sub-label">Examinations evaluated</span>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card teal mat-elevation-z2">
            <mat-card-content class="stat-content">
              <div class="stat-header">
                <span class="label">Active Batches</span>
                <div class="stat-icon-wrap">
                  <mat-icon class="stat-icon">groups</mat-icon>
                </div>
              </div>
              <div class="stat-body">
                <span class="value">{{ summary.activeBatches }}</span>
                <div class="stat-footer">
                  <span class="stat-badge-pill">Running</span>
                  <span class="sub-label">Academic classrooms</span>
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- 2. Dynamic Interactive Charts Row -->
        <div class="charts-row">

          <!-- Left Chart: 6-Month Fee Revenue & Collection Trend -->
          <mat-card class="chart-card large-chart-card mat-elevation-z2">
            <div class="chart-header">
              <div class="chart-header-left">
                <div class="chart-icon-box blue-box">
                  <mat-icon>bar_chart</mat-icon>
                </div>
                <div>
                  <h3 class="chart-title">Monthly Revenue &amp; Collection Trend</h3>
                  <p class="chart-subtitle">6-Month database comparison: Billed Tuition Fees vs Collected Payments (₹)</p>
                </div>
              </div>
              <div class="chart-legend-pills">
                <span class="pill pill-billed"
                      [matTooltip]="getBilledBreakdownTooltip()"
                      matTooltipClass="multiline-tooltip"
                      matTooltipPosition="below">
                  <span class="legend-dot dot-billed"></span>
                  <span>Billed: ₹{{ getTotalBilled() | number:'1.0-0' }}</span>
                  <mat-icon class="pill-info-icon">info</mat-icon>
                </span>
                <span class="pill pill-collected"
                      [matTooltip]="getCollectedBreakdownTooltip()"
                      matTooltipClass="multiline-tooltip"
                      matTooltipPosition="below">
                  <span class="legend-dot dot-collected"></span>
                  <span>Collected: ₹{{ getTotalCollected() | number:'1.0-0' }}</span>
                  <mat-icon class="pill-info-icon">info</mat-icon>
                </span>
              </div>
            </div>
            <mat-card-content class="chart-canvas-box">
              <canvas #revenueChart></canvas>
            </mat-card-content>
          </mat-card>

          <!-- Right Chart: Overall Fee Recovery & Dues Donut -->
          <mat-card class="chart-card small-chart-card mat-elevation-z2">
            <div class="chart-header">
              <div class="chart-header-left">
                <div class="chart-icon-box teal-box">
                  <mat-icon>donut_large</mat-icon>
                </div>
                <div>
                  <h3 class="chart-title">Fee Recovery Ratio</h3>
                  <p class="chart-subtitle">Overall settled vs outstanding</p>
                </div>
              </div>
              <span class="recovery-badge" [class.high]="(summary.feeBreakdown?.recoveryPercentage || 0) >= 50">
                {{ summary.feeBreakdown?.recoveryPercentage || 0 }}% Settled
              </span>
            </div>
            <mat-card-content class="donut-body">
              <div class="donut-canvas-container">
                <canvas #feeBreakdownChart></canvas>
                <div class="donut-inner-stat">
                  <span class="inner-pct">{{ summary.feeBreakdown?.recoveryPercentage || 0 }}%</span>
                  <span class="inner-lbl">Recovery</span>
                </div>
              </div>
              <div class="donut-summary-list">
                <div class="summary-item">
                  <span class="item-lbl"><span class="legend-dot dot-collected"></span> Total Paid</span>
                  <strong class="item-val text-green">₹{{ summary.feeBreakdown?.totalPaid | number:'1.0-0' }}</strong>
                </div>
                <div class="summary-item">
                  <span class="item-lbl"><span class="legend-dot dot-pending"></span> Pending Dues</span>
                  <strong class="item-val text-orange">₹{{ summary.feeBreakdown?.totalPending | number:'1.0-0' }}</strong>
                </div>
                <div class="summary-item total-item"
                     matTooltip="Total Invoices Generated across institute history (Paid ₹{{ summary.feeBreakdown?.totalPaid | number:'1.0-0' }} + Pending ₹{{ summary.feeBreakdown?.totalPending | number:'1.0-0' }})"
                     matTooltipPosition="above">
                  <span class="item-lbl">Total Billed</span>
                  <strong class="item-val">₹{{ summary.feeBreakdown?.totalBilled | number:'1.0-0' }}</strong>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

        </div>

        <!-- 3. Batch Enrollment & Fee Potential Chart -->
        <mat-card class="chart-card full-chart-card mat-elevation-z2" *ngIf="summary.batchDistributions && summary.batchDistributions.length > 0">
          <div class="chart-header">
            <div class="chart-header-left">
              <div class="chart-icon-box purple-box">
                <mat-icon>school</mat-icon>
              </div>
              <div>
                <h3 class="chart-title">Batch-Wise Enrollment &amp; Monthly Revenue Capacity</h3>
                <p class="chart-subtitle">Live student enrollment distribution across active academic batches</p>
              </div>
            </div>
          </div>
          <mat-card-content class="batch-canvas-box">
            <canvas #batchChart></canvas>
          </mat-card-content>
        </mat-card>

        <!-- 4. Tables Row (Overdue Reminders & Recent Tests) -->
        <div class="bottom-grid">

          <!-- Overdue Fee Reminders -->
          <mat-card class="table-card mat-elevation-z2">
            <div class="section-header">
              <div class="section-title">
                <mat-icon class="section-icon warning-icon">warning_amber</mat-icon>
                <div>
                  <h3>Urgent Pending Fee Reminders</h3>
                  <p>Students with overdue fee invoices</p>
                </div>
              </div>
              <a mat-stroked-button color="warn" routerLink="/fees" class="view-all-btn">
                View All <mat-icon>arrow_forward</mat-icon>
              </a>
            </div>
            <mat-card-content>
              <table mat-table [dataSource]="summary.overdueInvoices" class="full-width">
                <ng-container matColumnDef="studentName">
                  <th mat-header-cell *matHeaderCellDef>Student</th>
                  <td mat-cell *matCellDef="let el">
                    <div class="student-cell">
                      <span class="student-avatar-badge">{{ (el.studentName || 'S').charAt(0).toUpperCase() }}</span>
                      <div class="student-info">
                        <strong>{{ el.studentName }}</strong>
                        <small>{{ el.rollNumber }}</small>
                      </div>
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="invoiceNumber">
                  <th mat-header-cell *matHeaderCellDef>Invoice</th>
                  <td mat-cell *matCellDef="let el">{{ el.invoiceNumber }}</td>
                </ng-container>

                <ng-container matColumnDef="dueAmount">
                  <th mat-header-cell *matHeaderCellDef class="text-right">Amount Due</th>
                  <td mat-cell *matCellDef="let el" class="amount-due text-right">
                    ₹{{ el.dueAmount | number:'1.0-0' }}
                  </td>
                </ng-container>

                <ng-container matColumnDef="dueDate">
                  <th mat-header-cell *matHeaderCellDef>Due Date</th>
                  <td mat-cell *matCellDef="let el">{{ el.dueDate | date:'mediumDate' }}</td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef class="text-right">WhatsApp</th>
                  <td mat-cell *matCellDef="let el" class="text-right">
                    <button mat-flat-button class="wa-remind-btn" (click)="sendReminder(el)" matTooltip="Send Fee Reminder on WhatsApp">
                      <mat-icon>chat</mat-icon> Remind
                    </button>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="feeColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: feeColumns;"></tr>

                <tr class="mat-row" *matNoDataRow>
                  <td class="mat-cell" [attr.colspan]="feeColumns.length">
                    <div class="empty-inline">
                      <mat-icon style="color:#16a34a">check_circle</mat-icon>
                      <span>No overdue fee invoices. All fees are up to date! 🎉</span>
                    </div>
                  </td>
                </tr>
              </table>
            </mat-card-content>
          </mat-card>

          <!-- Recent Tests -->
          <mat-card class="table-card mat-elevation-z2">
            <div class="section-header">
              <div class="section-title">
                <mat-icon class="section-icon test-icon">quiz</mat-icon>
                <div>
                  <h3>Recent Test Exams</h3>
                  <p>Last 5 exams conducted</p>
                </div>
              </div>
              <a mat-stroked-button color="primary" routerLink="/tests" class="view-all-btn">
                View All <mat-icon>arrow_forward</mat-icon>
              </a>
            </div>
            <mat-card-content>
              <table mat-table [dataSource]="summary.recentTests" class="full-width">

                <ng-container matColumnDef="title">
                  <th mat-header-cell *matHeaderCellDef>Test Title</th>
                  <td mat-cell *matCellDef="let t">
                    <div class="test-cell">
                      <strong>{{ t.title }}</strong>
                      <small>{{ t.subject }}</small>
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="batchName">
                  <th mat-header-cell *matHeaderCellDef>Batch</th>
                  <td mat-cell *matCellDef="let t">
                    <span class="batch-badge">{{ t.batchName }}</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="maxMarks">
                  <th mat-header-cell *matHeaderCellDef class="text-center">Max Marks</th>
                  <td mat-cell *matCellDef="let t" class="text-center">
                    <span class="marks-badge">{{ t.maxMarks }}</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="marksEnteredCount">
                  <th mat-header-cell *matHeaderCellDef class="text-center">Entries</th>
                  <td mat-cell *matCellDef="let t" class="text-center">
                    <span class="entries-badge" [class.no-entries]="(t.totalStudentsEvaluated ?? t.marksEnteredCount ?? 0) === 0">
                      {{ (t.totalStudentsEvaluated ?? t.marksEnteredCount ?? 0) === 0 ? 'Pending' : (t.totalStudentsEvaluated ?? t.marksEnteredCount) + ' evaluated' }}
                    </span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="testDate">
                  <th mat-header-cell *matHeaderCellDef>Date</th>
                  <td mat-cell *matCellDef="let t">{{ t.testDate | date:'mediumDate' }}</td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="testColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: testColumns;"></tr>

                <tr class="mat-row" *matNoDataRow>
                  <td class="mat-cell" [attr.colspan]="testColumns.length">
                    <div class="empty-inline">
                      <mat-icon style="color:#7c3aed">quiz</mat-icon>
                      <span>No tests scheduled yet. Go to <a routerLink="/tests">Tests</a> to schedule one.</span>
                    </div>
                  </td>
                </tr>
              </table>
            </mat-card-content>
          </mat-card>

        </div>

      </ng-container>
    </div>
  `,
  styles: [`
    .dashboard-wrapper {
      display: flex;
      flex-direction: column;
      gap: 22px;
      width: 100%;
      box-sizing: border-box;
    }

    .header-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;

      .header-titles h2 {
        margin: 0;
        font-size: 1.55rem;
        font-weight: 700;
        color: #0f172a;
        letter-spacing: -0.02em;
      }
      .header-titles p {
        margin: 4px 0 0;
        color: #64748b;
        font-size: 0.9rem;
      }

      .refresh-btn {
        height: 42px;
        font-weight: 600;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        letter-spacing: 0.02em;
      }
      .spin-icon {
        animation: spin 1s linear infinite;
      }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .spinner-center {
      display: flex;
      justify-content: center;
      padding: 60px 0;
    }

    /* ─── Top KPI Stat Cards ─── */
    .card-container {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;

      @media (max-width: 1360px) {
        grid-template-columns: repeat(3, 1fr);
      }
      @media (max-width: 768px) {
        grid-template-columns: repeat(2, 1fr);
      }
      @media (max-width: 480px) {
        grid-template-columns: 1fr;
      }
    }

    .stat-card {
      border-radius: 14px;
      border: none;
      color: #ffffff;
      overflow: hidden;
      position: relative;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, rgba(255, 255, 255, 0.5), transparent);
      }

      &:hover {
        transform: translateY(-4px);
      }

      &.blue {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 55%, #1e40af 100%);
        box-shadow: 0 10px 25px -4px rgba(37, 99, 235, 0.45) !important;
      }
      &.green {
        background: linear-gradient(135deg, #10b981 0%, #059669 55%, #047857 100%);
        box-shadow: 0 10px 25px -4px rgba(16, 185, 129, 0.45) !important;
      }
      &.orange {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 55%, #b45309 100%);
        box-shadow: 0 10px 25px -4px rgba(245, 158, 11, 0.45) !important;
      }
      &.purple {
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 55%, #6d28d9 100%);
        box-shadow: 0 10px 25px -4px rgba(139, 92, 246, 0.45) !important;
      }
      &.whatsapp {
        background: linear-gradient(135deg, #10b981 0%, #047857 100%);
      }
      &.teal {
        background: linear-gradient(135deg, #0d9488 0%, #0f766e 55%, #115e59 100%);
        box-shadow: 0 10px 25px -4px rgba(13, 148, 136, 0.45) !important;
      }
    }

    .stat-content {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 11px 14px !important;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      min-height: 96px;
    }

    .stat-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 6px;
      width: 100%;

      .label {
        font-size: 0.7rem;
        font-weight: 700;
        opacity: 0.95;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        line-height: 1.25;
        flex: 1;
        min-width: 0;
      }

      .stat-icon-wrap {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.22);
        backdrop-filter: blur(8px);
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-left: 6px;

        .stat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #ffffff;
        }
      }
    }

    .stat-body {
      display: flex;
      flex-direction: column;
      margin-top: 4px;

      .value {
        font-size: 1.55rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1.1;
        margin-bottom: 3px;
      }

      .stat-footer {
        display: flex;
        align-items: center;
        gap: 5px;
        flex-wrap: wrap;

        .stat-badge-pill {
          font-size: 0.58rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 1.5px 6px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.22);
          backdrop-filter: blur(4px);
          color: #ffffff;
          white-space: nowrap;
        }

        .sub-label {
          font-size: 0.68rem;
          opacity: 0.88;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }
    }

    /* ─── Dynamic Charts Section ─── */
    .charts-row {
      display: grid;
      grid-template-columns: 1.65fr 1fr;
      gap: 18px;
    }

    .chart-card {
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #f1f5f9;
      flex-wrap: wrap;
      gap: 12px;

      .chart-header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .chart-icon-box {
        width: 38px;
        height: 38px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        mat-icon { font-size: 22px; width: 22px; height: 22px; }

        &.blue-box   { background: #eff6ff; color: #2563eb; }
        &.teal-box   { background: #f0fdf4; color: #16a34a; }
        &.purple-box { background: #faf5ff; color: #7c3aed; }
      }

      .chart-title {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
        color: #0f172a;
      }
      .chart-subtitle {
        margin: 2px 0 0;
        font-size: 0.78rem;
        color: #64748b;
      }
    }

    .chart-legend-pills {
      display: flex;
      align-items: center;
      gap: 10px;

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        border-radius: 20px;
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        user-select: none;
        transition: transform 0.15s ease, box-shadow 0.15s ease;

        &:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .pill-info-icon {
          font-size: 15px;
          width: 15px;
          height: 15px;
          opacity: 0.8;
          margin-left: 2px;
        }

        &.pill-billed    { background: #ede9fe; color: #6d28d9; }
        &.pill-collected { background: #dcfce7; color: #15803d; }
      }
    }

    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;

      &.dot-billed    { background: #6366f1; }
      &.dot-collected { background: #10b981; }
      &.dot-pending   { background: #f59e0b; }
    }

    .recovery-badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 700;
      background: #fef3c7;
      color: #b45309;

      &.high {
        background: #dcfce7;
        color: #166534;
      }
    }

    .chart-canvas-box {
      padding: 16px 20px 20px;
      position: relative;
      height: 270px;
      width: 100%;
      box-sizing: border-box;
    }

    .batch-canvas-box {
      padding: 16px 20px 20px;
      position: relative;
      height: 220px;
      width: 100%;
      box-sizing: border-box;
    }

    /* Donut Body */
    .donut-body {
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    .donut-canvas-container {
      position: relative;
      width: 180px;
      height: 180px;

      .donut-inner-stat {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        display: flex;
        flex-direction: column;
        pointer-events: none;

        .inner-pct {
          font-size: 1.4rem;
          font-weight: 800;
          color: #0f172a;
          line-height: 1;
        }
        .inner-lbl {
          font-size: 0.72rem;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
          margin-top: 2px;
        }
      }
    }

    .donut-summary-list {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 6px;

      .summary-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.82rem;
        padding: 4px 0;

        .item-lbl {
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .item-val {
          font-weight: 700;
          color: #1e293b;
          &.text-green { color: #16a34a; }
          &.text-orange { color: #d97706; }
        }

        &.total-item {
          border-top: 1px dashed #e2e8f0;
          padding-top: 6px;
          margin-top: 2px;
          .item-lbl { font-weight: 600; color: #334155; }
        }
      }
    }

    /* ─── Tables Row ─── */
    .bottom-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 18px;
    }

    .table-card {
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05) !important;
      overflow: hidden;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #f1f5f9;

      .section-title {
        display: flex;
        align-items: center;
        gap: 12px;

        .section-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
          &.warning-icon { color: #f59e0b; }
          &.test-icon    { color: #8b5cf6; }
        }

        h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 700;
          color: #0f172a;
        }
        p {
          margin: 2px 0 0;
          font-size: 0.78rem;
          color: #64748b;
        }
      }

      .view-all-btn {
        font-size: 0.78rem;
        font-weight: 600;
        height: 32px;
        padding: 0 12px;
        border-radius: 6px;
      }
    }

    .full-width { width: 100%; }

    .student-cell {
      display: flex;
      align-items: center;
      gap: 10px;

      .student-avatar-badge {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
        color: #ffffff;
        font-weight: 700;
        font-size: 0.82rem;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 2px 6px rgba(99, 102, 241, 0.35);
      }

      .student-info {
        display: flex;
        flex-direction: column;
        strong { font-size: 0.86rem; color: #0f172a; }
        small  { font-size: 0.74rem; color: #64748b; }
      }
    }

    .amount-due {
      color: #dc2626;
      font-weight: 700;
      font-size: 0.92rem;
    }

    .wa-remind-btn {
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%) !important;
      color: white !important;
      font-size: 0.76rem !important;
      font-weight: 600 !important;
      height: 32px !important;
      line-height: 32px !important;
      padding: 0 12px !important;
      border-radius: 20px !important;
      box-shadow: 0 3px 10px rgba(34, 197, 94, 0.35) !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      transition: transform 0.15s ease, box-shadow 0.15s ease !important;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 5px 14px rgba(34, 197, 94, 0.5) !important;
      }
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }

    .test-cell {
      display: flex;
      flex-direction: column;
      strong { font-size: 0.88rem; color: #0f172a; }
      small  { font-size: 0.75rem; color: #64748b; }
    }

    .batch-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #e0f2fe;
      color: #0369a1;
      border-radius: 8px;
      font-size: 0.76rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .marks-badge {
      display: inline-block;
      padding: 2px 10px;
      background: #fef3c7;
      color: #b45309;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 700;
    }

    .entries-badge {
      display: inline-block;
      padding: 2px 10px;
      background: #dcfce7;
      color: #166534;
      border-radius: 8px;
      font-size: 0.78rem;
      font-weight: 600;
      &.no-entries { background: #fee2e2; color: #991b1b; }
    }

    .empty-inline {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 20px 16px;
      font-size: 0.88rem;
      color: #64748b;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
      a { color: #2563eb; text-decoration: none; font-weight: 600; }
    }

    /* ─── Responsive ─── */
    @media (max-width: 1024px) {
      .charts-row { grid-template-columns: 1fr; }
      .bottom-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  summary: any = null;
  loading = true;

  feeColumns = ['studentName', 'invoiceNumber', 'dueAmount', 'dueDate', 'actions'];
  testColumns = ['title', 'batchName', 'maxMarks', 'marksEnteredCount', 'testDate'];

  @ViewChild('revenueChart') revenueChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('feeBreakdownChart') feeBreakdownChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('batchChart') batchChartRef?: ElementRef<HTMLCanvasElement>;

  private revenueChart?: Chart;
  private feeBreakdownChart?: Chart;
  private batchChart?: Chart;

  constructor(
    private coachingService: CoachingService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.loadSummary();
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  loadSummary(): void {
    this.loading = true;
    this.coachingService.getDashboardSummary().subscribe({
      next: (res) => {
        this.summary = res;
        this.loading = false;
        setTimeout(() => this.initCharts(), 50);
      },
      error: () => {
        this.loading = false;
        this.confirmDialog.alert('Error', 'Failed to load dashboard analytics.', 'danger');
      }
    });
  }

  getTotalBilled(): number {
    if (!this.summary?.revenueTrends) return 0;
    return this.summary.revenueTrends.reduce((sum: number, t: any) => sum + (t.billedAmount || 0), 0);
  }

  getTotalCollected(): number {
    if (!this.summary?.revenueTrends) return 0;
    return this.summary.revenueTrends.reduce((sum: number, t: any) => sum + (t.collectedAmount || 0), 0);
  }

  getBilledBreakdownTooltip(): string {
    if (!this.summary?.revenueTrends) return 'No billing data available.';
    const activeTrends = this.summary.revenueTrends.filter((t: any) => (t.billedAmount || 0) > 0);
    if (!activeTrends.length) return 'No invoices billed in the last 6 months.';
    const lines = activeTrends.map((t: any) => `  • ${t.monthName}: ₹${Number(t.billedAmount).toLocaleString('en-IN')}`);
    return `6-Month Invoices Billed Breakdown\n\n` + lines.join('\n') + `\n\nTotal Billed: ₹${this.getTotalBilled().toLocaleString('en-IN')}`;
  }

  getCollectedBreakdownTooltip(): string {
    if (!this.summary?.revenueTrends) return 'No collection data available.';
    const activeTrends = this.summary.revenueTrends.filter((t: any) => (t.collectedAmount || 0) > 0);
    if (!activeTrends.length) return 'No fees collected in the last 6 months.';
    const lines = activeTrends.map((t: any) => `  • ${t.monthName}: ₹${Number(t.collectedAmount).toLocaleString('en-IN')}`);
    return `6-Month Fee Collections Breakdown\n\n` + lines.join('\n') + `\n\nTotal Collected: ₹${this.getTotalCollected().toLocaleString('en-IN')}`;
  }

  private destroyCharts(): void {
    if (this.revenueChart) {
      this.revenueChart.destroy();
      this.revenueChart = undefined;
    }
    if (this.feeBreakdownChart) {
      this.feeBreakdownChart.destroy();
      this.feeBreakdownChart = undefined;
    }
    if (this.batchChart) {
      this.batchChart.destroy();
      this.batchChart = undefined;
    }
  }

  private initCharts(): void {
    this.destroyCharts();
    if (!this.summary) return;

    this.renderRevenueChart();
    this.renderFeeBreakdownChart();
    this.renderBatchChart();
  }

  private renderRevenueChart(): void {
    if (!this.revenueChartRef?.nativeElement) return;
    const ctx = this.revenueChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const trends: any[] = this.summary.revenueTrends || [];
    const labels = trends.map(t => t.monthName);
    const billedData = trends.map(t => t.billedAmount);
    const collectedData = trends.map(t => t.collectedAmount);

    this.revenueChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Fees Billed',
            data: billedData,
            backgroundColor: 'rgba(99, 102, 241, 0.8)',
            hoverBackgroundColor: '#6366f1',
            borderRadius: 6,
            borderSkipped: false,
            barPercentage: 0.65,
            categoryPercentage: 0.6
          },
          {
            label: 'Fees Collected',
            data: collectedData,
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            hoverBackgroundColor: '#10b981',
            borderRadius: 6,
            borderSkipped: false,
            barPercentage: 0.65,
            categoryPercentage: 0.6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 12 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (item) => ` ${item.dataset.label}: ₹${Number(item.raw || 0).toLocaleString('en-IN')}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#64748b',
              font: { size: 12, weight: 600 }
            }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              color: '#64748b',
              font: { size: 11 },
              callback: (val) => '₹' + Number(val).toLocaleString('en-IN')
            }
          }
        }
      }
    });
  }

  private renderFeeBreakdownChart(): void {
    if (!this.feeBreakdownChartRef?.nativeElement) return;
    const ctx = this.feeBreakdownChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const breakdown = this.summary.feeBreakdown;
    const paid = breakdown?.totalPaid || 0;
    const pending = breakdown?.totalPending || 0;

    const hasData = paid > 0 || pending > 0;
    const chartData = hasData ? [paid, pending] : [1];
    const chartColors = hasData ? ['#10b981', '#f59e0b'] : ['#e2e8f0'];

    this.feeBreakdownChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: hasData ? ['Fees Paid', 'Pending Dues'] : ['No Data'],
        datasets: [
          {
            data: chartData,
            backgroundColor: chartColors,
            borderWidth: 0,
            hoverOffset: hasData ? 4 : 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '74%',
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: hasData,
            backgroundColor: '#0f172a',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (item) => ` ${item.label}: ₹${Number(item.raw || 0).toLocaleString('en-IN')}`
            }
          }
        }
      }
    });
  }

  private renderBatchChart(): void {
    if (!this.batchChartRef?.nativeElement) return;
    const ctx = this.batchChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const batches: any[] = this.summary.batchDistributions || [];
    if (batches.length === 0) return;

    const labels = batches.map(b => b.batchName);
    const studentCounts = batches.map(b => b.studentCount);
    const feeRates = batches.map(b => b.monthlyFeeRate);

    this.batchChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Enrolled Students',
            data: studentCounts,
            backgroundColor: 'rgba(59, 130, 246, 0.85)',
            hoverBackgroundColor: '#2563eb',
            borderRadius: 6,
            barPercentage: 0.5,
            yAxisID: 'y'
          },
          {
            label: 'Monthly Fee Rate (₹)',
            data: feeRates,
            backgroundColor: 'rgba(139, 92, 246, 0.45)',
            hoverBackgroundColor: '#8b5cf6',
            borderRadius: 6,
            barPercentage: 0.5,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 12,
              font: { size: 11, weight: 600 },
              color: '#475569'
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (item) => item.datasetIndex === 0
                ? ` Enrolled Students: ${item.raw}`
                : ` Standard Fee: ₹${Number(item.raw || 0).toLocaleString('en-IN')}/mo`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#334155',
              font: { size: 11, weight: 600 }
            }
          },
          y: {
            position: 'left',
            grid: { color: '#f1f5f9' },
            title: { display: true, text: 'Students', color: '#2563eb', font: { size: 11, weight: 'bold' } },
            ticks: {
              stepSize: 1,
              precision: 0,
              color: '#64748b'
            }
          },
          y1: {
            position: 'right',
            grid: { display: false },
            title: { display: true, text: 'Fee Rate (₹)', color: '#8b5cf6', font: { size: 11, weight: 'bold' } },
            ticks: {
              color: '#64748b',
              callback: (val) => '₹' + Number(val).toLocaleString('en-IN')
            }
          }
        }
      }
    });
  }

  sendReminder(invoice: any): void {
    this.confirmDialog.confirm(
      'Send WhatsApp Reminder',
      `Send fee due reminder to ${invoice.studentName}'s parent (${invoice.parentWhatsAppPhone})?`,
      'Send WhatsApp',
      'Cancel',
      'warning'
    ).subscribe((confirmed) => {
      if (!confirmed) return;

      this.coachingService.sendWhatsAppReminder(invoice.id).subscribe({
        next: () => {
          if (invoice.parentWhatsAppPhone) {
            const rawPhone = invoice.parentWhatsAppPhone.replace(/\D/g, '');
            const formattedPhone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;
            const textMsg = `*FEE DUE REMINDER*\nDear Parent, This is a gentle reminder that fee of *₹${invoice.dueAmount}* for *${invoice.studentName}* (Invoice #${invoice.invoiceNumber}) is due on ${new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.\nKindly pay at the earliest.\n\nThank you!`;
            const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(textMsg)}`;
            window.open(waUrl, '_blank');
          }
          this.confirmDialog.alert('WhatsApp Opened!', `WhatsApp message opened for ${invoice.parentWhatsAppPhone}`, 'success');
        },
        error: (err) => {
          this.confirmDialog.alert('Failed', err?.error?.message || 'Could not send WhatsApp message.', 'danger');
        }
      });
    });
  }
}
