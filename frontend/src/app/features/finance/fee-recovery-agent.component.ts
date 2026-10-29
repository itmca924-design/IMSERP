import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';

import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { SchoolService } from '../../core/services/school.service';
import { BatchesService } from '../../core/services/batches.service';
import { FeesService, UpiIntentResponse } from '../../core/services/fees.service';
import {
  FeeRecoveryAgentService,
  FeeRecoveryPlanItemDto,
  FeeRecoverySummaryKpiDto,
  FeePromiseItemDto,
  RunAnalysisRequest
} from '../../core/services/fee-recovery-agent.service';
import { RecordPromiseDialogComponent } from './dialogs/record-promise-dialog.component';
import { EditNudgeMessageDialogComponent } from './dialogs/edit-nudge-message-dialog.component';
import { FeeCollectionDialogComponent } from '../fees/fee-collection-dialog.component';

@Component({
  selector: 'app-fee-recovery-agent',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressBarModule,
    MatTabsModule,
    MatCheckboxModule,
    MatMenuModule
  ],
  template: `
    <div class="page-container">
      <!-- Executive Top Header Card strictly matching standard AGENTS.md light-blue header rule -->
      <div class="page-top-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>psychology</mat-icon>
          </div>
          <div class="header-text-group">
            <h2 class="main-title">Smart Fee Recovery &amp; AI Follow-up Agent</h2>
            <p class="subtitle">
              Autonomous fee risk clustering, tailored WhatsApp recovery nudges, and Promise-to-Pay (PTP) tracker.
            </p>
          </div>
        </div>

        <div class="header-action-buttons">
          <button mat-stroked-button class="run-analysis-btn" (click)="triggerAnalysis()" [disabled]="loading" matTooltip="Scan all student accounts & generate tailored recovery plans">
            <mat-icon>auto_awesome</mat-icon>
            <span>Run AI Analysis</span>
          </button>

          <button mat-flat-button class="batch-dispatch-btn" (click)="batchDispatchSelected()" [disabled]="loading || selectedPlanIds.size === 0" matTooltip="Send AI nudges to all selected students">
            <mat-icon>send</mat-icon>
            <span>Batch Dispatch ({{ selectedPlanIds.size }})</span>
          </button>
        </div>
      </div>

      <!-- Single Prominent Loader (Strict Rule) -->
      <mat-progress-bar mode="indeterminate" *ngIf="loading" class="page-loader"></mat-progress-bar>

      <!-- 4-Column Standard Executive KPI Deck -->
      <div class="kpi-grid">
        <div class="kpi-card overdue-kpi">
          <div class="kpi-icon-box">
            <mat-icon>account_balance_wallet</mat-icon>
          </div>
          <div class="kpi-meta">
            <span class="kpi-label">Total Overdue Receivables</span>
            <span class="kpi-value">₹{{ (summary?.totalOverdueAmount || 0) | number:'1.0-0' }}</span>
            <span class="kpi-sub">{{ summary?.totalDefaultersCount || 0 }} Accounts Pending</span>
          </div>
        </div>

        <div class="kpi-card critical-kpi">
          <div class="kpi-icon-box">
            <mat-icon>warning</mat-icon>
          </div>
          <div class="kpi-meta">
            <span class="kpi-label">Critical &amp; High Risk</span>
            <span class="kpi-value text-red">{{ (summary?.criticalCount || 0) + (summary?.highRiskCount || 0) }}</span>
            <span class="kpi-sub">{{ summary?.criticalCount || 0 }} Critical (&gt;45 days overdue)</span>
          </div>
        </div>

        <div class="kpi-card ptp-kpi">
          <div class="kpi-icon-box">
            <mat-icon>event_available</mat-icon>
          </div>
          <div class="kpi-meta">
            <span class="kpi-label">Active Commitments (PTP)</span>
            <span class="kpi-value text-blue">{{ summary?.activePromisesCount || 0 }}</span>
            <span class="kpi-sub">₹{{ (summary?.activePromisesAmount || 0) | number:'1.0-0' }} Promised</span>
          </div>
        </div>

        <div class="kpi-card recovered-kpi">
          <div class="kpi-icon-box">
            <mat-icon>verified</mat-icon>
          </div>
          <div class="kpi-meta">
            <span class="kpi-label">Recovered via AI Agent</span>
            <span class="kpi-value text-green">₹{{ (summary?.totalRecoveredAmount || 0) | number:'1.0-0' }}</span>
            <span class="kpi-sub">{{ summary?.recoveredCount || 0 }} Invoices Settled</span>
          </div>
        </div>
      </div>

      <!-- Reactive Filters Card -->
      <mat-card class="filter-card mat-elevation-z1">
        <form [formGroup]="filterForm" class="filter-form">
          <mat-form-field appearance="outline" class="filter-field scope-field">
            <mat-label>Division Scope</mat-label>
            <mat-select formControlName="academicScope" (selectionChange)="onScopeChanged()">
              <mat-option value="All">🏛️ All (Hybrid Consolidated)</mat-option>
              <mat-option value="School">🏫 School Division Only</mat-option>
              <mat-option value="Coaching">🎯 Coaching Division Only</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field branch-field" *ngIf="branches.length > 1">
            <mat-label>Campus / Branch</mat-label>
            <mat-select formControlName="branchId" (selectionChange)="onFilterChanged()">
              <mat-option value="">All Campuses (Consolidated)</mat-option>
              <mat-option *ngFor="let b of branches" [value]="b.id">{{ b.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>{{ selectedAcademicScope === 'School' ? 'School Class (कक्षा)' : 'Academic Class (कक्षा)' }}</mat-label>
            <mat-select formControlName="classId" (selectionChange)="onClassChanged()">
              <mat-option value="">All Classes</mat-option>
              <mat-option *ngFor="let c of classes" [value]="c.id">{{ c.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field" *ngIf="selectedAcademicScope !== 'School'">
            <mat-label>Coaching Batch</mat-label>
            <mat-select formControlName="batchId" (selectionChange)="onFilterChanged()">
              <mat-option value="">All Batches</mat-option>
              <mat-option *ngFor="let b of filteredBatches" [value]="b.id">{{ b.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Risk Category</mat-label>
            <mat-select formControlName="riskLevel" (selectionChange)="onFilterChanged()">
              <mat-option value="">All Risk Profiles</mat-option>
              <mat-option value="Critical">🔴 Critical Defaulters (&gt;45 days)</mat-option>
              <mat-option value="High">🟠 High Risk (21 - 45 days)</mat-option>
              <mat-option value="Moderate">🟡 Moderate Delay (8 - 20 days)</mat-option>
              <mat-option value="Low">🟢 Low / Recent (1 - 7 days)</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Plan Status</mat-label>
            <mat-select formControlName="status" (selectionChange)="onFilterChanged()">
              <mat-option value="">All Statuses</mat-option>
              <mat-option value="Proposed">Proposed (Awaiting Action)</mat-option>
              <mat-option value="Dispatched">Dispatched (Nudge Sent)</mat-option>
              <mat-option value="PromiseMade">Commitment Logged (PTP)</mat-option>
              <mat-option value="PromiseBroken">Commitment Broken</mat-option>
              <mat-option value="Resolved">Resolved / Paid</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field search-field">
            <mat-label>Search Student or Roll</mat-label>
            <input matInput formControlName="searchTerm" placeholder="Type student name or roll..." />
            <mat-icon matPrefix>search</mat-icon>
          </mat-form-field>
        </form>
      </mat-card>

      <!-- Main Navigation Tabs -->
      <mat-tab-group animationDuration="200ms" class="agent-tabs-wrap">
        <!-- TAB 1: AI Recovery Action Plans -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">psychology</mat-icon>
            <span>AI Recovery Action Plans</span>
            <span class="tab-badge" *ngIf="filteredPlans.length > 0">{{ filteredPlans.length }}</span>
          </ng-template>

          <div class="tab-body-container">
            <!-- Table Action Toolbar -->
            <div class="table-toolbar" *ngIf="filteredPlans.length > 0">
              <div class="toolbar-left">
                <mat-checkbox [checked]="isAllSelected()" [indeterminate]="isPartiallySelected()" (change)="toggleSelectAll($event.checked)">
                  Select All Defaulters ({{ selectedPlanIds.size }} selected)
                </mat-checkbox>
              </div>

              <div class="toolbar-right">
                <span class="last-sync" *ngIf="summary?.lastAnalysisRunAt">
                  Last AI Analysis: <strong>{{ summary?.lastAnalysisRunAt | date:'dd-MMM-yyyy hh:mm a' }}</strong>
                </span>
              </div>
            </div>

            <!-- Responsive Table Wrap -->
            <div class="table-responsive" *ngIf="!loading && filteredPlans.length > 0">
              <table class="agent-table">
                <thead>
                  <tr>
                    <th class="cb-col"></th>
                    <th>Student Details</th>
                    <th>Class / Batch</th>
                    <th class="text-right">Overdue Balance</th>
                    <th>Delay</th>
                    <th>AI Risk Assessment</th>
                    <th>Action Plan &amp; Tone</th>
                    <th>Status / Commitment</th>
                    <th class="text-center actions-th" matTooltip="Action Menu">
                      <mat-icon class="th-action-icon">settings</mat-icon>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let p of filteredPlans" [class.selected-row]="selectedPlanIds.has(p.id)">
                    <td class="cb-col">
                      <mat-checkbox [checked]="selectedPlanIds.has(p.id)" (change)="toggleSelectPlan(p.id, $event.checked)">
                      </mat-checkbox>
                    </td>

                    <td class="student-cell">
                      <div class="student-info-box">
                        <div class="stu-avatar">
                          <mat-icon>person</mat-icon>
                        </div>
                        <div class="stu-details">
                          <span class="stu-name">{{ p.studentName }}</span>
                          <span class="stu-roll">Roll: {{ p.rollNumber || p.admissionNumber || 'N/A' }}</span>
                          <span class="stu-parent" *ngIf="p.parentPhone">📱 {{ p.parentPhone }}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div class="class-batch-badge">
                        <span class="division-pill" [ngClass]="getDivisionPillClass(p)">
                          {{ getDivisionPillLabel(p) }}
                        </span>
                        <span class="c-name">{{ p.className || 'General Class' }}</span>
                        <span class="b-name" *ngIf="p.batchName">• {{ p.batchName }}</span>
                      </div>
                    </td>

                    <td class="text-right amount-col">
                      <span class="due-amt">₹{{ p.totalOverdueAmount | number:'1.0-0' }}</span>
                      <span class="inv-ref" *ngIf="p.invoiceNumber">#{{ p.invoiceNumber }}</span>
                    </td>

                    <td>
                      <span class="days-chip" [ngClass]="getDelayClass(p.daysOverdue)">
                        {{ p.daysOverdue }} days
                      </span>
                    </td>

                    <td>
                      <span class="risk-pill" [ngClass]="p.riskLevel.toLowerCase()" [matTooltip]="p.aiRationale || ''">
                        <span class="dot">●</span> {{ p.riskLevel }} Risk
                      </span>
                    </td>

                    <td>
                      <div class="strategy-box">
                        <span class="channel-pill">{{ p.recommendedChannel }}</span>
                        <span class="tone-text">{{ p.recommendedTone }}</span>
                      </div>
                    </td>

                    <td>
                      <div class="status-cell-box">
                        <span class="status-chip" [ngClass]="p.status.toLowerCase()">
                          {{ getStatusLabel(p.status) }}
                        </span>
                        <div class="promise-inline-chip" *ngIf="p.activePromiseDate">
                          📅 Promised: <strong>{{ p.activePromiseDate | date:'dd-MMM' }}</strong>
                        </div>
                      </div>
                    </td>

                    <td class="text-center actions-col">
                      <button type="button" [matMenuTriggerFor]="planActionMenu" class="action-more-btn" matTooltip="Action Menu">
                        <mat-icon>more_vert</mat-icon>
                      </button>
                      <mat-menu #planActionMenu="matMenu" xPosition="before" class="plan-actions-dropdown">
                        <button mat-menu-item (click)="openNudgeModal(p)">
                          <mat-icon style="color: #16a34a;">send</mat-icon>
                          <span>Send WhatsApp Nudge</span>
                        </button>
                        <button mat-menu-item (click)="openPromiseModal(p)">
                          <mat-icon style="color: #2563eb;">event_available</mat-icon>
                          <span>Log Promise to Pay (PTP)</span>
                        </button>
                        <button mat-menu-item (click)="openFeeCollection(p)">
                          <mat-icon style="color: #9333ea;">payments</mat-icon>
                          <span>Collect Fee &amp; Settle</span>
                        </button>
                      </mat-menu>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Empty State -->
            <div class="empty-state" *ngIf="!loading && filteredPlans.length === 0">
              <div class="empty-icon-wrap">
                <mat-icon>verified</mat-icon>
              </div>
              <h3>No Fee Overdues Found</h3>
              <p>Either all student fees are settled, or click "Run AI Analysis" to scan active rosters.</p>
              <button mat-flat-button color="primary" (click)="triggerAnalysis()">
                <mat-icon>auto_awesome</mat-icon>
                <span>Run Real-Time AI Analysis</span>
              </button>
            </div>
          </div>
        </mat-tab>

        <!-- TAB 2: Promise to Pay (PTP) Commitment Tracker -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">event_available</mat-icon>
            <span>Promise to Pay (PTP) Tracker</span>
            <span class="tab-badge ptp-badge" *ngIf="promises.length > 0">{{ promises.length }}</span>
          </ng-template>

          <div class="tab-body-container">
            <div class="table-responsive" *ngIf="!loading && promises.length > 0">
              <table class="agent-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Class / Batch</th>
                    <th class="text-right">Promised Amount</th>
                    <th>Promised Date</th>
                    <th>Contact Person &amp; Phone</th>
                    <th>Remarks / Notes</th>
                    <th>Status</th>
                    <th class="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let prom of promises">
                    <td class="student-cell">
                      <div class="stu-details">
                        <span class="stu-name">{{ prom.studentName }}</span>
                        <span class="stu-roll">Roll: {{ prom.rollNumber || 'N/A' }}</span>
                      </div>
                    </td>

                    <td>
                      <div class="class-batch-badge">
                        <span class="division-pill" [ngClass]="getDivisionPillClass(prom)">
                          {{ getDivisionPillLabel(prom) }}
                        </span>
                        <span>{{ prom.className || 'General' }}</span>
                        <span *ngIf="prom.batchName">• {{ prom.batchName }}</span>
                      </div>
                    </td>

                    <td class="text-right amount-col">
                      <span class="due-amt">₹{{ prom.promisedAmount | number:'1.0-0' }}</span>
                    </td>

                    <td>
                      <span class="promise-date-chip" [class.broken]="prom.isBroken" [class.kept]="prom.isKept">
                        {{ prom.promisedDate | date:'dd-MMM-yyyy' }}
                      </span>
                    </td>

                    <td>
                      <div class="contact-box">
                        <span class="cp-name">{{ prom.contactPerson }}</span>
                        <span class="cp-phone">📱 {{ prom.contactPhone }}</span>
                      </div>
                    </td>

                    <td class="notes-cell">
                      <span>{{ prom.notes || '—' }}</span>
                    </td>

                    <td>
                      <span class="ptp-status-pill" [class.kept]="prom.isKept" [class.broken]="prom.isBroken" [class.pending]="!prom.isKept && !prom.isBroken">
                        {{ prom.isKept ? '✅ Kept / Settled' : prom.isBroken ? '❌ Promise Broken' : '⏳ Pending' }}
                      </span>
                    </td>

                    <td class="text-right actions-col">
                      <button mat-stroked-button class="mini-btn kept-btn" *ngIf="!prom.isKept" (click)="resolvePromise(prom, true)" matTooltip="Mark as payment received">
                        Kept
                      </button>
                      <button mat-stroked-button class="mini-btn broken-btn" *ngIf="!prom.isKept && !prom.isBroken" (click)="resolvePromise(prom, false)" matTooltip="Mark as promise broken">
                        Broken
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="empty-state" *ngIf="!loading && promises.length === 0">
              <div class="empty-icon-wrap">
                <mat-icon>event_note</mat-icon>
              </div>
              <h3>No Parent Promises Logged</h3>
              <p>When parents promise a future payment date, click "Log Promise" on their fee plan.</p>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
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

    /* Strict Sharp Light Blue Gradient Header matching AGENTS.md rule */
    .page-top-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-radius: 14px;
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      box-shadow: 0 2px 8px -2px rgba(37, 99, 235, 0.1);
      flex-wrap: nowrap;

      @media (max-width: 992px) {
        flex-wrap: wrap;
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;
        flex: 1 1 auto;

        .header-icon-box {
          background: #2563eb;
          color: #ffffff;
          border-radius: 10px;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;

          mat-icon {
            font-size: 24px;
            width: 24px;
            height: 24px;
          }
        }

        .header-text-group {
          min-width: 0;

          .main-title {
            color: #1e3a8a;
            font-weight: 700;
            font-size: 1.25rem;
            margin: 0 0 2px 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .subtitle {
            color: #3b82f6;
            margin: 0;
            font-size: 0.85rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
      }

      .header-action-buttons {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
        margin-left: auto;

        button {
          white-space: nowrap;
          height: 38px;
          border-radius: 8px;
          font-weight: 600;
        }

        .run-analysis-btn {
          border-color: #93c5fd;
          color: #1d4ed8;
          background: #ffffff;
        }

        .batch-dispatch-btn {
          background: #16a34a;
          color: #ffffff;
          box-shadow: 0 2px 6px rgba(22, 163, 74, 0.3);
        }
      }
    }

    @media (max-width: 640px) {
      .page-top-header {
        padding: 12px 14px;
        gap: 12px;
        flex-direction: column;
        align-items: flex-start;

        .header-left {
          width: 100%;
          .header-text-group {
            .main-title, .subtitle { white-space: normal; }
          }
        }

        .header-action-buttons {
          width: 100%;
          flex-direction: column;
          gap: 8px;
          button { width: 100%; justify-content: center; }
        }
      }
    }

    .page-loader {
      border-radius: 4px;
    }

    /* Standard IMSERP Executive KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;

      @media (max-width: 1024px) {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }

      @media (max-width: 640px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
    }

    .kpi-card {
      background: #ffffff;
      border-radius: 12px;
      padding: 14px 16px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 14px;
      min-width: 0;
      min-height: 76px;
      box-sizing: border-box;
      transition: transform 0.15s ease, box-shadow 0.15s ease;

      @media (max-width: 640px) {
        padding: 10px 12px;
        gap: 10px;
        min-height: 68px;
        border-radius: 10px;
      }

      .kpi-icon-box {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        mat-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
        }

        @media (max-width: 640px) {
          width: 36px;
          height: 36px;
          border-radius: 8px;

          mat-icon {
            font-size: 20px;
            width: 20px;
            height: 20px;
          }
        }
      }

      .kpi-meta {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;

        .kpi-label {
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;

          @media (max-width: 640px) {
            font-size: 10px;
            letter-spacing: 0.2px;
          }
        }

        .kpi-value {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          margin: 1px 0;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;

          @media (max-width: 640px) {
            font-size: 16px;
          }
        }

        .kpi-sub {
          font-size: 11px;
          color: #94a3b8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;

          @media (max-width: 640px) {
            font-size: 10px;
          }
        }
      }

      &.overdue-kpi .kpi-icon-box { background: #eff6ff; color: #2563eb; }
      &.critical-kpi .kpi-icon-box { background: #fef2f2; color: #dc2626; }
      &.ptp-kpi .kpi-icon-box { background: #f0fdf4; color: #16a34a; }
      &.recovered-kpi .kpi-icon-box { background: #faf5ff; color: #9333ea; }
    }

    .text-red { color: #dc2626 !important; }
    .text-blue { color: #2563eb !important; }
    .text-green { color: #16a34a !important; }

    /* Filter Deck */
    .filter-card {
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      padding: 14px 18px;

      .filter-form {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;

        .filter-field {
          flex: 1 1 180px;
          min-width: 170px;
        }

        .search-field {
          flex: 2 1 240px;
        }
      }
    }

    /* Tabs Wrap */
    .agent-tabs-wrap {
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;

      .tab-icon {
        margin-right: 6px;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      .tab-badge {
        background: #2563eb;
        color: #ffffff;
        font-size: 0.7rem;
        font-weight: 800;
        padding: 2px 8px;
        border-radius: 12px;
        margin-left: 8px;

        &.ptp-badge {
          background: #16a34a;
        }
      }
    }

    .tab-body-container {
      padding: 16px 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .table-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 4px;
      border-bottom: 1px solid #f1f5f9;

      .last-sync {
        font-size: 0.78rem;
        color: #64748b;
        strong { color: #0f172a; }
      }
    }

    /* Responsive Table */
    .table-responsive {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      width: 100%;
    }

    .agent-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.88rem;

      th {
        background: #f8fafc;
        color: #475569;
        font-weight: 700;
        text-align: left;
        padding: 12px 14px;
        border-bottom: 2px solid #e2e8f0;
        white-space: nowrap;
      }

      td {
        padding: 12px 14px;
        border-bottom: 1px solid #f1f5f9;
        vertical-align: middle;
      }

      tr:hover td {
        background: #f8fafc;
      }

      .selected-row td {
        background: #eff6ff !important;
      }

      .cb-col {
        width: 40px;
        text-align: center;
      }

      .text-right {
        text-align: right;
      }
    }

    .student-info-box {
      display: flex;
      align-items: center;
      gap: 10px;

      .stu-avatar {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: #eff6ff;
        color: #2563eb;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
      }

      .stu-details {
        display: flex;
        flex-direction: column;

        .stu-name {
          font-weight: 700;
          color: #0f172a;
        }

        .stu-roll {
          font-size: 0.75rem;
          color: #64748b;
        }

        .stu-parent {
          font-size: 0.74rem;
          color: #16a34a;
          font-weight: 600;
        }
      }
    }

    .class-batch-badge {
      display: flex;
      flex-direction: column;
      font-size: 0.8rem;
      .c-name { font-weight: 600; color: #1e293b; }
      .b-name { color: #64748b; font-size: 0.75rem; }

      .division-pill {
        font-size: 0.65rem;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        display: inline-block;
        width: fit-content;
        margin-bottom: 3px;

        &.div-pill-school {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        &.div-pill-coaching {
          background: #fff7ed;
          color: #c2410c;
          border: 1px solid #fed7aa;
        }

        &.div-pill-hybrid {
          background: #f5f3ff;
          color: #6d28d9;
          border: 1px solid #ddd6fe;
        }

        &.div-pill-general {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }
      }
    }

    .amount-col {
      .due-amt {
        display: block;
        font-weight: 800;
        color: #0f172a;
        font-size: 0.95rem;
      }

      .inv-ref {
        font-size: 0.7rem;
        color: #94a3b8;
        font-family: monospace;
      }
    }

    .days-chip {
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;

      &.mild { background: #f0fdf4; color: #15803d; }
      &.moderate { background: #fefce8; color: #a16207; }
      &.high { background: #fff7ed; color: #c2410c; }
      &.critical { background: #fef2f2; color: #b91c1c; }
    }

    .risk-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 9px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 700;
      white-space: nowrap;

      .dot { font-size: 10px; }

      &.critical { background: #fee2e2; color: #991b1b; }
      &.high { background: #ffedd5; color: #9a3412; }
      &.moderate { background: #fef9c3; color: #854d0e; }
      &.low { background: #dcfce7; color: #166534; }
    }

    .strategy-box {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .channel-pill {
        font-size: 0.72rem;
        font-weight: 700;
        color: #1e40af;
        background: #dbeafe;
        padding: 2px 6px;
        border-radius: 4px;
        display: inline-block;
        width: fit-content;
      }

      .tone-text {
        font-size: 0.74rem;
        color: #64748b;
      }
    }

    .status-cell-box {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .status-chip {
        font-size: 0.72rem;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 6px;
        width: fit-content;

        &.proposed { background: #f1f5f9; color: #475569; }
        &.dispatched { background: #e0f2fe; color: #0369a1; }
        &.promisemade { background: #ecfdf5; color: #047857; }
        &.promisebroken { background: #fee2e2; color: #b91c1c; }
        &.resolved { background: #dcfce7; color: #15803d; }
      }

      .promise-inline-chip {
        font-size: 0.72rem;
        color: #047857;
      }
    }

    .actions-th {
      width: 54px;
      min-width: 54px;
      text-align: center !important;
      padding: 10px 8px !important;

      .th-action-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        line-height: 18px;
        color: #64748b;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        vertical-align: middle;
      }
    }

    .actions-col {
      white-space: nowrap;
      text-align: center !important;
      width: 54px;
      min-width: 54px;
      padding: 8px !important;

      .action-more-btn {
        width: 32px;
        height: 32px;
        min-width: 32px;
        min-height: 32px;
        padding: 0;
        margin: 0 auto;
        border: 1px solid #e2e8f0;
        border-radius: 50%;
        background: #ffffff;
        color: #475569;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        outline: none;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        transition: all 0.15s ease;

        &:hover {
          background: #eff6ff;
          color: #1d4ed8;
          border-color: #93c5fd;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.2);
          transform: scale(1.06);
        }

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          line-height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 0;
        }
      }

      .action-btn {
        margin-left: 6px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid transparent;
        cursor: pointer;
        outline: none;
        padding: 0;
        vertical-align: middle;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;

        mat-icon {
          font-size: 17px;
          width: 17px;
          height: 17px;
          line-height: 17px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
        }

        &.send-btn {
          color: #16a34a;
          background: #f0fdf4;
          border-color: #bbf7d0;
          &:hover { background: #dcfce7; transform: scale(1.08); box-shadow: 0 2px 4px rgba(22, 163, 74, 0.2); }
        }

        &.ptp-btn {
          color: #2563eb;
          background: #eff6ff;
          border-color: #bfdbfe;
          &:hover { background: #dbeafe; transform: scale(1.08); box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); }
        }

        &.pay-btn {
          color: #9333ea;
          background: #faf5ff;
          border-color: #e9d5ff;
          &:hover { background: #f3e8ff; transform: scale(1.08); box-shadow: 0 2px 4px rgba(147, 51, 234, 0.2); }
        }
      }

      .mini-btn {
        height: 28px;
        line-height: 26px;
        padding: 0 8px;
        font-size: 0.75rem;
        font-weight: 700;
        border-radius: 6px;
        margin-left: 4px;

        &.kept-btn { color: #16a34a; border-color: #86efac; background: #f0fdf4; }
        &.broken-btn { color: #dc2626; border-color: #fca5a5; background: #fef2f2; }
      }
    }

    .promise-date-chip {
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 700;
      background: #eff6ff;
      color: #1e40af;

      &.kept { background: #dcfce7; color: #15803d; }
      &.broken { background: #fee2e2; color: #b91c1c; }
    }

    .contact-box {
      display: flex;
      flex-direction: column;
      font-size: 0.8rem;
      .cp-name { font-weight: 700; color: #0f172a; }
      .cp-phone { color: #16a34a; font-weight: 600; font-size: 0.74rem; }
    }

    .ptp-status-pill {
      font-size: 0.74rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;

      &.kept { background: #dcfce7; color: #15803d; }
      &.broken { background: #fee2e2; color: #b91c1c; }
      &.pending { background: #fef9c3; color: #854d0e; }
    }

    /* Empty State */
    .empty-state {
      padding: 48px 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      color: #64748b;

      .empty-icon-wrap {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #94a3b8;

        mat-icon {
          font-size: 32px;
          width: 32px;
          height: 32px;
        }
      }

      h3 {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 700;
        color: #1e293b;
      }

      p {
        margin: 0;
        font-size: 0.88rem;
        max-width: 440px;
      }
    }
  `]
})
export class FeeRecoveryAgentComponent implements OnInit {
  private fb = inject(FormBuilder);
  private agentService = inject(FeeRecoveryAgentService);
  private authService = inject(AuthService);
  private confirmDialog = inject(ConfirmDialogService);
  private schoolService = inject(SchoolService);
  private batchesService = inject(BatchesService);
  private feesService = inject(FeesService);
  private dialog = inject(MatDialog);

  filterForm!: FormGroup;
  loading = false;

  branches: any[] = [];
  classes: any[] = [];
  batches: any[] = [];
  filteredBatches: any[] = [];

  summary: FeeRecoverySummaryKpiDto | null = null;
  plans: FeeRecoveryPlanItemDto[] = [];
  filteredPlans: FeeRecoveryPlanItemDto[] = [];
  promises: FeePromiseItemDto[] = [];

  selectedPlanIds = new Set<string>();

  ngOnInit(): void {
    this.branches = this.authService.currentUser()?.branches || [];
    const activeBranch = this.authService.selectedBranchId() || '';

    this.filterForm = this.fb.group({
      branchId: [activeBranch],
      academicScope: ['All'],
      classId: [''],
      batchId: [''],
      riskLevel: [''],
      status: [''],
      searchTerm: ['']
    });

    this.filterForm.get('searchTerm')?.valueChanges.subscribe(() => {
      this.applyClientSideFilters();
    });

    this.loadMetadata();
    this.refreshAll();
  }

  get selectedAcademicScope(): string {
    return this.filterForm?.get('academicScope')?.value || 'All';
  }

  onScopeChanged(): void {
    const scope = this.selectedAcademicScope;
    if (scope === 'School') {
      this.filterForm.patchValue({ batchId: '' }, { emitEvent: false });
    }
    this.applyClientSideFilters();
    this.refreshAll();
  }

  loadMetadata(): void {
    this.schoolService.getClasses().subscribe({
      next: (cls) => (this.classes = cls),
      error: (err) => console.error('Failed to load classes', err)
    });

    this.batchesService.getBatches().subscribe({
      next: (b) => {
        this.batches = b;
        this.filteredBatches = b;
      },
      error: (err) => console.error('Failed to load batches', err)
    });
  }

  onClassChanged(): void {
    const selectedClassId = this.filterForm.get('classId')?.value;
    if (selectedClassId) {
      this.filteredBatches = this.batches.filter((b) => b.classId === selectedClassId);
    } else {
      this.filteredBatches = this.batches;
    }
    this.filterForm.patchValue({ batchId: '' });
    this.applyClientSideFilters();
    this.refreshAll();
  }

  onFilterChanged(): void {
    this.applyClientSideFilters();
    this.refreshAll();
  }

  refreshAll(): void {
    this.loading = true;
    const { branchId, academicScope, classId, batchId, riskLevel, status } = this.filterForm.value;

    this.agentService.getSummary(branchId, academicScope).subscribe({
      next: (sum) => (this.summary = sum),
      error: (err) => console.error('Summary error', err)
    });

    this.agentService.getPlans(branchId, classId, batchId, riskLevel, status, academicScope).subscribe({
      next: (data) => {
        this.plans = data;
        this.applyClientSideFilters();
        this.loading = false;
      },
      error: (err) => {
        this.plans = [];
        this.filteredPlans = [];
        this.loading = false;
        this.confirmDialog.alert('Fetch Error', err.error?.message || 'Could not load fee recovery plans.', 'danger');
      }
    });

    this.agentService.getPromises(branchId, false, academicScope).subscribe({
      next: (prom) => (this.promises = prom),
      error: (err) => console.error('Promises error', err)
    });
  }

  applyClientSideFilters(): void {
    const search = (this.filterForm.get('searchTerm')?.value || '').trim().toLowerCase();
    const scope = this.selectedAcademicScope;
    const classId = this.filterForm.get('classId')?.value;
    const batchId = this.filterForm.get('batchId')?.value;
    const risk = this.filterForm.get('riskLevel')?.value;
    const status = this.filterForm.get('status')?.value;

    this.filteredPlans = this.plans.filter((p) => {
      // 1. Division Scope Filter
      const tag = this.getDivisionPillLabel(p).toLowerCase();
      if (scope === 'School') {
        if (tag === 'coaching') return false;
      } else if (scope === 'Coaching') {
        if (tag === 'school') return false;
      }

      // 2. Class Filter
      if (classId) {
        const selectedCls = this.classes.find((c) => c.id === classId);
        if (selectedCls && p.className && p.className.toLowerCase() !== selectedCls.name.toLowerCase()) {
          return false;
        }
      }

      // 3. Batch Filter
      if (batchId) {
        const selectedB = this.batches.find((b) => b.id === batchId);
        if (selectedB && p.batchName && p.batchName.toLowerCase() !== selectedB.name.toLowerCase()) {
          return false;
        }
      }

      // 4. Risk Category Filter
      if (risk && p.riskLevel !== risk) {
        return false;
      }

      // 5. Plan Status Filter
      if (status && p.status !== status) {
        return false;
      }

      // 6. Search Term Filter
      if (search) {
        const name = (p.studentName || '').toLowerCase();
        const roll = (p.rollNumber || '').toLowerCase();
        const adm = (p.admissionNumber || '').toLowerCase();
        const parent = (p.parentName || '').toLowerCase();
        if (!name.includes(search) && !roll.includes(search) && !adm.includes(search) && !parent.includes(search)) {
          return false;
        }
      }

      return true;
    });
  }

  triggerAnalysis(): void {
    this.loading = true;
    const { branchId, academicScope, classId, batchId } = this.filterForm.value;
    const req: RunFeeRecoveryAnalysisRequestDto = {
      branchId: branchId || null,
      classId: classId || null,
      batchId: batchId || null,
      minDaysOverdue: 1,
      academicScope: academicScope || 'All'
    };

    this.agentService.runAnalysis(req).subscribe({
      next: (res) => {
        this.loading = false;
        this.confirmDialog.alert(
          'AI Analysis Completed',
          `AI Recovery Agent analyzed all fee records and generated ${res.length} tailored recovery plans.`,
          'success'
        );
        this.refreshAll();
      },
      error: (err) => {
        this.loading = false;
        this.confirmDialog.alert('Analysis Failed', err.error?.message || 'Failed to complete fee recovery analysis.', 'danger');
      }
    });
  }

  // Row Selection logic
  toggleSelectPlan(id: string, checked: boolean): void {
    if (checked) this.selectedPlanIds.add(id);
    else this.selectedPlanIds.delete(id);
  }

  toggleSelectAll(checked: boolean): void {
    if (checked) {
      this.filteredPlans.forEach((p) => this.selectedPlanIds.add(p.id));
    } else {
      this.selectedPlanIds.clear();
    }
  }

  isAllSelected(): boolean {
    return this.filteredPlans.length > 0 && this.selectedPlanIds.size === this.filteredPlans.length;
  }

  isPartiallySelected(): boolean {
    return this.selectedPlanIds.size > 0 && this.selectedPlanIds.size < this.filteredPlans.length;
  }

  batchDispatchSelected(): void {
    if (this.selectedPlanIds.size === 0) return;

    this.confirmDialog.confirm(
      'Batch Dispatch AI Nudges',
      `Are you sure you want to dispatch personalized WhatsApp recovery messages to all ${this.selectedPlanIds.size} selected parents?`,
      'Yes, Dispatch All',
      'Cancel',
      'info'
    ).subscribe((confirmed) => {
      if (!confirmed) return;

      this.loading = true;
      const ids = Array.from(this.selectedPlanIds);
      this.agentService.batchDispatchNudges(ids).subscribe({
        next: (count) => {
          this.loading = false;
          this.selectedPlanIds.clear();
          this.confirmDialog.alert(
            'Dispatch Complete',
            `Successfully dispatched ${count} personalized recovery nudges via WhatsApp.`,
            'success'
          );
          this.refreshAll();
        },
        error: (err) => {
          this.loading = false;
          this.confirmDialog.alert('Dispatch Error', err.error?.message || 'Batch dispatch failed.', 'danger');
        }
      });
    });
  }

  openNudgeModal(plan: FeeRecoveryPlanItemDto): void {
    const isPaid = plan.status === 'Resolved' || plan.totalOverdueAmount <= 0;
    const instName = this.authService.getInstituteName() || 'Jnandeep Campus';
    const parentGreeting = plan.parentName ? `Dear ${plan.parentName}` : 'Respected Parent / Guardian';

    if (isPaid) {
      const settledMsg =
        `✅ *FEE PAYMENT ACKNOWLEDGMENT* - ${instName}\n\n` +
        `${parentGreeting},\n` +
        `We acknowledge with thanks that the educational fee for *${plan.studentName}* (${plan.className || 'General'}) has been successfully paid and settled.\n\n` +
        `• Current Outstanding Balance: *₹0.00*\n` +
        `• Status: *Settled & Cleared*\n\n` +
        `Thank you for your continued cooperation and support.\n\n` +
        `— Accounts Department, ${instName}`;

      this.showNudgeDialog(plan, settledMsg);
      return;
    }

    if (plan.invoiceId) {
      this.loading = true;
      this.feesService.getInvoiceUpiIntent(plan.invoiceId).subscribe({
        next: (upi: UpiIntentResponse) => {
          this.loading = false;
          const payPortalUrl = `${window.location.origin}/pay/${plan.invoiceId}`;
          const currentDue = upi.dueAmount > 0 ? upi.dueAmount : plan.totalOverdueAmount;

          const paymentBlock =
            `💳 *Instant Online UPI Payment:*\n` +
            `• Payee UPI ID (VPA): \`${upi.payeeUpiId}\`\n` +
            `• Payee Name: *${upi.payeeName}*\n` +
            `• Payable Amount: *₹${currentDue}*\n\n` +
            `👉 *Click to Pay Online (GPay / PhonePe / Paytm / QR):*\n` +
            `${payPortalUrl}\n\n`;

          let enriched = plan.generatedMessage || '';
          if (enriched.includes('upi://pay')) {
            const upiIndex = enriched.indexOf('upi://pay');
            const endLine = enriched.indexOf('\n', upiIndex);
            if (endLine !== -1) {
              enriched = enriched.substring(0, upiIndex) + payPortalUrl + enriched.substring(endLine);
            }
          }

          if (enriched.includes('Kindly remit the payment online')) {
            enriched = enriched.replace(
              'Kindly remit the payment online via UPI or at the school counter to avoid late fee charges.',
              paymentBlock + 'Kindly remit the payment via the link above or at the school counter to avoid late fee charges.'
            );
          } else if (!enriched.includes(payPortalUrl)) {
            enriched += `\n\n${paymentBlock}`;
          }

          this.showNudgeDialog(plan, enriched, upi);
        },
        error: () => {
          this.loading = false;
          this.showNudgeDialog(plan, plan.generatedMessage);
        }
      });
    } else {
      this.showNudgeDialog(plan, plan.generatedMessage);
    }
  }

  private showNudgeDialog(plan: FeeRecoveryPlanItemDto, customMessage?: string, upiIntent?: UpiIntentResponse): void {
    const dialogRef = this.dialog.open(EditNudgeMessageDialogComponent, {
      width: '560px',
      data: { plan, customMessage, upiIntent }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // Direct Free WhatsApp Launch (Opens WhatsApp Web or App with pre-filled message)
        if (result.channel === 'WhatsApp' && plan.parentPhone) {
          const rawPhone = plan.parentPhone.replace(/\D/g, '');
          const formattedPhone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;
          const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(result.message)}`;
          window.open(waUrl, '_blank');
        }

        this.loading = true;
        this.agentService.dispatchNudge(plan.id, result.message, result.channel).subscribe({
          next: () => {
            this.loading = false;
            this.confirmDialog.alert(
              'WhatsApp Dispatched & Logged',
              `WhatsApp chat opened with pre-filled message for ${plan.studentName}. Recovery plan status updated to Dispatched.`,
              'success'
            );
            this.refreshAll();
          },
          error: (err) => {
            this.loading = false;
            this.confirmDialog.alert('Dispatch Failed', err.error?.message || 'Could not send WhatsApp nudge.', 'danger');
          }
        });
      }
    });
  }

  openPromiseModal(plan: FeeRecoveryPlanItemDto): void {
    const dialogRef = this.dialog.open(RecordPromiseDialogComponent, {
      width: '520px',
      data: { plan }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loading = true;
        const req = {
          studentId: plan.studentId,
          recoveryPlanId: plan.id,
          invoiceId: plan.invoiceId,
          promisedAmount: result.promisedAmount,
          promisedDate: result.promisedDate.toISOString(),
          contactPerson: result.contactPerson,
          contactPhone: result.contactPhone,
          notes: result.notes
        };

        this.agentService.recordPromise(req).subscribe({
          next: () => {
            this.loading = false;
            this.confirmDialog.alert(
              'Commitment Logged',
              `Promise to Pay for ₹${result.promisedAmount} recorded for ${plan.studentName}. Follow-up tracked automatically.`,
              'success'
            );
            this.refreshAll();
          },
          error: (err) => {
            this.loading = false;
            this.confirmDialog.alert('Record Failed', err.error?.message || 'Could not log promise.', 'danger');
          }
        });
      }
    });
  }

  openFeeCollection(plan: FeeRecoveryPlanItemDto): void {
    this.loading = true;
    this.feesService.getStudentLedger(plan.studentId).subscribe({
      next: (ledger) => {
        this.loading = false;
        const matchedInv = (ledger?.invoices || []).find((i) => i.id === plan.invoiceId)
          || (ledger?.invoices || []).find((i) => i.dueAmount > 0);

        const outstandingAmount = matchedInv ? matchedInv.dueAmount : plan.totalOverdueAmount;

        const dialogRef = this.dialog.open(FeeCollectionDialogComponent, {
          width: '740px',
          maxWidth: '96vw',
          data: {
            studentId: plan.studentId,
            studentName: plan.studentName,
            rollNumber: plan.rollNumber || plan.admissionNumber || '',
            className: plan.className,
            sectionName: plan.sectionName,
            batchName: plan.batchName,
            parentWhatsAppPhone: plan.parentPhone || '',
            totalOutstandingDue: outstandingAmount,
            initialAmount: outstandingAmount,
            items: matchedInv?.items,
            invoiceDueDate: matchedInv?.dueDate,
            invoiceTitle: matchedInv?.invoiceNumber ? `Invoice #${matchedInv.invoiceNumber}` : (plan.invoiceNumber ? `Invoice #${plan.invoiceNumber}` : 'Fee Payment'),
            branchName: this.authService.getCurrentBranchName?.() || ''
          }
        });

        dialogRef.afterClosed().subscribe((collected) => {
          if (collected) {
            this.refreshAll();
          }
        });
      },
      error: () => {
        this.loading = false;
        const dialogRef = this.dialog.open(FeeCollectionDialogComponent, {
          width: '740px',
          maxWidth: '96vw',
          data: {
            studentId: plan.studentId,
            studentName: plan.studentName,
            rollNumber: plan.rollNumber || plan.admissionNumber || '',
            className: plan.className,
            sectionName: plan.sectionName,
            batchName: plan.batchName,
            parentWhatsAppPhone: plan.parentPhone || '',
            totalOutstandingDue: plan.totalOverdueAmount,
            initialAmount: plan.totalOverdueAmount,
            invoiceTitle: plan.invoiceNumber ? `Invoice #${plan.invoiceNumber}` : 'Fee Payment',
            branchName: this.authService.getCurrentBranchName?.() || ''
          }
        });

        dialogRef.afterClosed().subscribe((collected) => {
          if (collected) {
            this.refreshAll();
          }
        });
      }
    });
  }

  resolvePromise(promise: FeePromiseItemDto, isKept: boolean): void {
    const actionName = isKept ? 'Kept & Settled' : 'Broken';
    this.confirmDialog.confirm(
      `Mark Promise as ${actionName}?`,
      `Are you sure you want to mark the payment commitment for ${promise.studentName} (₹${promise.promisedAmount}) as ${actionName}?`,
      'Confirm',
      'Cancel',
      isKept ? 'info' : 'danger'
    ).subscribe((confirmed) => {
      if (!confirmed) return;

      this.loading = true;
      this.agentService.updatePromiseStatus(promise.id, isKept, !isKept, isKept ? promise.promisedAmount : undefined).subscribe({
        next: () => {
          this.loading = false;
          this.confirmDialog.alert('Updated', `Promise status marked as ${actionName}.`, 'success');
          this.refreshAll();
        },
        error: (err) => {
          this.loading = false;
          this.confirmDialog.alert('Update Failed', err.error?.message || 'Could not update promise status.', 'danger');
        }
      });
    });
  }

  getDelayClass(days: number): string {
    if (days > 45) return 'critical';
    if (days > 20) return 'high';
    if (days > 7) return 'moderate';
    return 'mild';
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'Proposed': return 'Proposed';
      case 'Dispatched': return 'Nudge Sent';
      case 'PromiseMade': return 'PTP Logged';
      case 'PromiseBroken': return 'PTP Broken';
      case 'PromiseKept': return 'PTP Settled';
      case 'Resolved': return 'Paid / Resolved';
      default: return status;
    }
  }

  getDivisionPillLabel(item: any): string {
    if (item.divisionTag && item.divisionTag !== 'General') {
      return item.divisionTag;
    }
    if (item.isSchoolStudent && item.isCoachingStudent) return 'Hybrid';
    if (item.isSchoolStudent) return 'School';
    if (item.isCoachingStudent) return 'Coaching';
    if (item.batchName) return 'Coaching';
    return 'School';
  }

  getDivisionPillClass(item: { isSchoolStudent?: boolean; isCoachingStudent?: boolean; divisionTag?: string }): string {
    const tag = this.getDivisionPillLabel(item).toLowerCase();
    return `div-pill-${tag}`;
  }
}
type RunFeeRecoveryAnalysisRequestDto = RunAnalysisRequest;

