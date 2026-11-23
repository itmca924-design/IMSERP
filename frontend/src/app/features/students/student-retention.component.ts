import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import {
  StudentRetentionService,
  StudentDropoutRiskItemDto,
  StudentDropoutRiskSummaryKpiDto,
  StudentRetentionAnalysisResponse
} from '../../core/services/student-retention.service';
import { AuthService } from '../../core/services/auth.service';
import { SchoolService, SchoolClassDto } from '../../core/services/school.service';
import { BatchesService, BatchDto } from '../../core/services/batches.service';
import { BranchService, BranchDto } from '../../core/services/branch.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { LocalDatetimePipe } from '../../shared/pipes/local-datetime.pipe';
import { RecordCounselingDialogComponent } from './dialogs/record-counseling-dialog.component';
import { CounselingHistoryDialogComponent } from './dialogs/counseling-history-dialog.component';

@Component({
  selector: 'app-student-retention',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatDialogModule,
    MatChipsModule,
    LocalDatetimePipe
  ],
  template: `
    <div class="page-container">
      <!-- Page Header -->
      <div class="page-header-deck">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>psychology</mat-icon>
          </div>
          <div class="header-titles">
            <div class="title-row">
              <h1 class="page-title">Student Retention &amp; Early Warning Agent</h1>
              <span class="agent-pulse-pill">
                <span class="pulse-dot"></span>
                AI Agent Active
              </span>
            </div>
            <p class="page-subtitle">
              Autonomous multi-signal dropout risk detector analyzing attendance anomalies, fee overdue patterns, and academic test signals before students disengage.
            </p>
          </div>
        </div>

        <div class="header-action-buttons">
          <button class="run-scan-btn" (click)="loadRetentionData()" [disabled]="loading" matTooltip="Refresh early warning AI analysis" mat-flat-button color="primary">
            <mat-icon>auto_awesome</mat-icon>
            <span>Run AI Scan</span>
          </button>
          <button class="export-btn" (click)="exportToCsv()" [disabled]="loading || items.length === 0" matTooltip="Export retention risk list to CSV" mat-stroked-button>
            <mat-icon>file_download</mat-icon>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <!-- Single Prominent Loader (Strict Rule) -->
      @if (loading) {
        <mat-progress-bar mode="indeterminate" class="page-loader"></mat-progress-bar>
      }

      <!-- KPI Summary Deck (Standard Height & Fully Responsive Grid) -->
      <div class="kpi-grid">
        <!-- 1. Total Monitored -->
        <mat-card class="kpi-card total-monitored mat-elevation-z1" matTooltip="Total active students under retention monitoring">
          <div class="kpi-content">
            <div class="kpi-meta">
              <span class="kpi-label" title="Monitored Students">Monitored Students</span>
              <span class="kpi-value">{{ summary.totalStudentsMonitored | number }}</span>
              <span class="kpi-hint">School &amp; Coaching</span>
            </div>
            <div class="kpi-icon-box total">
              <mat-icon>groups</mat-icon>
            </div>
          </div>
        </mat-card>

        <!-- 2. Critical Risk (Red) -->
        <mat-card class="kpi-card critical-risk mat-elevation-z1" (click)="setRiskFilter('critical')" matTooltip="Click to filter Critical Risk students (Score >= 70%)">
          <div class="kpi-content">
            <div class="kpi-meta">
              <span class="kpi-label" title="Critical Dropout Risk">Critical Risk</span>
              <span class="kpi-value critical">{{ summary.criticalRiskCount | number }}</span>
              <span class="kpi-hint">&ge; 70% • Immediate</span>
            </div>
            <div class="kpi-icon-box critical">
              <mat-icon>warning</mat-icon>
            </div>
          </div>
        </mat-card>

        <!-- 3. Moderate Attention (Amber) -->
        <mat-card class="kpi-card moderate-risk mat-elevation-z1" (click)="setRiskFilter('moderate')" matTooltip="Click to filter Moderate Attention students (Score 40-69%)">
          <div class="kpi-content">
            <div class="kpi-meta">
              <span class="kpi-label" title="Moderate Attention">Moderate Attention</span>
              <span class="kpi-value moderate">{{ summary.moderateRiskCount | number }}</span>
              <span class="kpi-hint">40-69% • Nudge &amp; Call</span>
            </div>
            <div class="kpi-icon-box moderate">
              <mat-icon>notification_important</mat-icon>
            </div>
          </div>
        </mat-card>

        <!-- 4. Safe / Regular (Green) -->
        <mat-card class="kpi-card safe-profile mat-elevation-z1" (click)="setRiskFilter('safe')" matTooltip="Click to filter Safe & Regular students (Score < 40%)">
          <div class="kpi-content">
            <div class="kpi-meta">
              <span class="kpi-label" title="Safe & Regular">Safe &amp; Regular</span>
              <span class="kpi-value safe">{{ summary.safeCount | number }}</span>
              <span class="kpi-hint">&lt; 40% • Healthy</span>
            </div>
            <div class="kpi-icon-box safe">
              <mat-icon>verified</mat-icon>
            </div>
          </div>
        </mat-card>

        <!-- 5. Potential Fee at Risk -->
        <mat-card class="kpi-card fee-risk mat-elevation-z1" matTooltip="Total overdue fee tied to at-risk students">
          <div class="kpi-content">
            <div class="kpi-meta">
              <span class="kpi-label" title="Overdue Fee at Risk">Fee at Risk</span>
              <span class="kpi-value fee">₹{{ summary.potentialFeeAtRisk | number:'1.0-0' }}</span>
              <span class="kpi-hint">At-Risk Overdue</span>
            </div>
            <div class="kpi-icon-box fee">
              <mat-icon>currency_rupee</mat-icon>
            </div>
          </div>
        </mat-card>

        <!-- 6. Retained Students -->
        <mat-card class="kpi-card retained mat-elevation-z1" matTooltip="Students successfully retained through counseling">
          <div class="kpi-content">
            <div class="kpi-meta">
              <span class="kpi-label" title="Students Retained">Retained</span>
              <span class="kpi-value retained">{{ summary.studentsRetainedCount | number }}</span>
              <span class="kpi-hint">{{ summary.interventionsCompletedCount }} Interventions</span>
            </div>
            <div class="kpi-icon-box retained">
              <mat-icon>sentiment_very_satisfied</mat-icon>
            </div>
          </div>
        </mat-card>
      </div>

      <!-- Reactive Filter Bar -->
      <mat-card class="filter-card mat-elevation-z1">
        <form [formGroup]="filterForm" class="filter-form">
          <div class="filter-row">

            <!-- Branch Selector (Multi-Branch) -->
            @if (branches.length > 1) {
              <mat-form-field appearance="outline" class="filter-field branch-field">
                <mat-label>Campus / Branch</mat-label>
                <mat-select formControlName="branchId">
                  <mat-option value="">🏢 All Campuses Consolidated</mat-option>
                  @for (b of branches; track b.id) {
                    <mat-option [value]="b.id">{{ b.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }

            <!-- Academic Scope (Tri-Modal: All, School, Coaching) -->
            <mat-form-field appearance="outline" class="filter-field scope-field">
              <mat-label>Division Scope</mat-label>
              <mat-select formControlName="academicScope">
                <mat-option value="all">🌐 Universal (School + Coaching)</mat-option>
                @if (hasSchoolModule) {
                  <mat-option value="school">🏫 School Students Only</mat-option>
                }
                @if (hasCoachingModule) {
                  <mat-option value="coaching">🎯 Coaching Students Only</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <!-- School Class Cascading Selector -->
            @if (filterForm.get('academicScope')?.value !== 'coaching' && classes.length > 0) {
              <mat-form-field appearance="outline" class="filter-field class-field">
                <mat-label>School Class (कक्षा)</mat-label>
                <mat-select formControlName="classId">
                  <mat-option value="">✨ All Classes</mat-option>
                  @for (c of classes; track c.id) {
                    <mat-option [value]="c.id">{{ c.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }

            <!-- Coaching Batch Cascading Selector -->
            @if (filterForm.get('academicScope')?.value !== 'school' && batches.length > 0) {
              <mat-form-field appearance="outline" class="filter-field batch-field">
                <mat-label>Coaching Batch</mat-label>
                <mat-select formControlName="batchId">
                  <mat-option value="">✨ All Batches</mat-option>
                  @for (b of filteredBatches; track b.id) {
                    <mat-option [value]="b.id">{{ b.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }

            <!-- Risk Level Filter -->
            <mat-form-field appearance="outline" class="filter-field risk-field">
              <mat-label>Risk Category</mat-label>
              <mat-select formControlName="riskLevel">
                <mat-option value="all">All Profiles</mat-option>
                <mat-option value="critical">🚨 Critical Risk (70-100%)</mat-option>
                <mat-option value="moderate">⚠️ Moderate Attention (40-69%)</mat-option>
                <mat-option value="safe">✅ Safe / Healthy (0-39%)</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Search Field -->
            <mat-form-field appearance="outline" class="filter-field search-field">
              <mat-label>Search Student / Parent / Phone</mat-label>
              <input matInput formControlName="search" placeholder="Name, Roll, Adm, Phone..." />
              <mat-icon matSuffix color="primary">search</mat-icon>
            </mat-form-field>

            <!-- Reset Button -->
            <button type="button" class="reset-btn" (click)="resetFilters()" mat-button>
              <mat-icon>filter_alt_off</mat-icon>
              <span>Reset</span>
            </button>

          </div>
        </form>
      </mat-card>

      <!-- Main Data Table Deck -->
      <mat-card class="table-card mat-elevation-z1">
        <div class="table-card-header">
          <div class="table-header-left">
            <h2 class="table-title">Identified Dropout Risk Profiles</h2>
            <span class="record-badge">Showing {{ items.length }} of {{ totalCount }} students</span>
          </div>

          <!-- Quick legend -->
          <div class="risk-legend">
            <span class="legend-item"><span class="legend-dot critical"></span> Critical (&ge;70%)</span>
            <span class="legend-item"><span class="legend-dot moderate"></span> Moderate (40-69%)</span>
            <span class="legend-item"><span class="legend-dot safe"></span> Safe (&lt;40%)</span>
          </div>
        </div>

        @if (!loading && items.length === 0) {
          <div class="empty-state-box">
            <div class="empty-icon-box">
              <mat-icon>sentiment_satisfied_alt</mat-icon>
            </div>
            <h3>No High-Risk Profiles Found</h3>
            <p>Great news! Either all students have healthy attendance, regular fee payments, and consistent test scores, or your active filter has zero matching records.</p>
            <button mat-stroked-button color="primary" (click)="resetFilters()">Clear Filters</button>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="erp-retention-table">
              <thead>
                <tr>
                  <th class="col-student">Student Details</th>
                  <th class="col-risk">AI Dropout Risk</th>
                  <th class="col-signals">Multi-Signal Drivers</th>
                  <th class="col-action">Recommended AI Action</th>
                  <th class="col-intervene text-right">Intervention Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (s of items; track s.studentId) {
                  <tr class="student-row" [class.row-critical]="s.riskLevel === 'Critical'" [class.row-moderate]="s.riskLevel === 'Moderate'">
                    
                    <!-- Student Info -->
                    <td class="col-student">
                      <div class="student-cell">
                        <div class="avatar-box" [ngClass]="s.riskLevel.toLowerCase()">
                          @if (s.photoUrl) {
                            <img [src]="s.photoUrl" alt="" class="avatar-img" />
                          } @else {
                            <mat-icon class="avatar-icon">person</mat-icon>
                          }
                        </div>
                        <div class="student-meta">
                          <div class="name-line">
                            <span class="st-name">{{ s.studentName }}</span>
                            @if (s.isSchoolStudent && s.isCoachingStudent) {
                              <span class="division-pill hybrid">Hybrid</span>
                            } @else if (s.isSchoolStudent) {
                              <span class="division-pill school">School</span>
                            } @else {
                              <span class="division-pill coaching">Coaching</span>
                            }
                          </div>
                          <div class="meta-line">
                            <span>Roll: <strong>{{ s.rollNumber || '—' }}</strong></span>
                            @if (s.admissionNumber) {
                              <span>• Adm: <strong>{{ s.admissionNumber }}</strong></span>
                            }
                            <span>• {{ s.className || s.batchName || 'General' }}</span>
                          </div>
                          <div class="parent-line">
                            <mat-icon class="mini-ic">person_outline</mat-icon>
                            <span>{{ s.parentName }}</span>
                            @if (s.parentPhone) {
                              <span class="phone-link" (click)="openDirectPhone(s.parentPhone)">
                                <mat-icon class="mini-ic">call</mat-icon> {{ s.parentPhone }}
                              </span>
                            }
                          </div>
                        </div>
                      </div>
                    </td>

                    <!-- AI Dropout Risk Score & Meter -->
                    <td class="col-risk">
                      <div class="risk-gauge-cell">
                        <div class="score-pill" [ngClass]="s.riskLevel.toLowerCase()">
                          <span class="score-num">{{ s.riskScore }}%</span>
                          <span class="score-level">{{ s.riskLevel }}</span>
                        </div>
                        <div class="gauge-bar">
                          <div class="gauge-fill" [ngClass]="s.riskLevel.toLowerCase()" [style.width.%]="s.riskScore"></div>
                        </div>
                        <span class="risk-factor-text">{{ s.primaryRiskFactor }}</span>
                      </div>
                    </td>

                    <!-- Multi-Signal Drivers: Attendance, Fee, Academics -->
                    <td class="col-signals">
                      <div class="signals-cell">
                        <!-- Attendance Signal -->
                        <div class="signal-pill" [class.danger]="s.attendancePercentage < 65 || s.consecutiveAbsentDays >= 3" [class.warn]="s.attendancePercentage < 75" [class.good]="s.attendancePercentage >= 75">
                          <mat-icon class="sig-ic">event_available</mat-icon>
                          <span>Attendance: <strong>{{ s.attendancePercentage }}%</strong></span>
                          @if (s.consecutiveAbsentDays >= 2) {
                            <span class="absent-badge">{{ s.consecutiveAbsentDays }}d Abs</span>
                          }
                        </div>

                        <!-- Fee Overdue Signal -->
                        <div class="signal-pill" [class.danger]="s.overdueFeeAmount > 5000 || s.overdueFeeDays > 60" [class.warn]="s.overdueFeeAmount > 0" [class.good]="s.overdueFeeAmount === 0">
                          <mat-icon class="sig-ic">payment</mat-icon>
                          <span>Overdue: <strong>₹{{ s.overdueFeeAmount | number:'1.0-0' }}</strong></span>
                          @if (s.overdueFeeDays > 0) {
                            <span class="overdue-days">({{ s.overdueFeeDays }}d)</span>
                          }
                        </div>

                        <!-- Academic Marks Signal -->
                        @if (s.latestTestPercentage !== undefined && s.latestTestPercentage !== null) {
                          <div class="signal-pill" [class.danger]="s.latestTestPercentage < 35" [class.warn]="s.latestTestPercentage < 50" [class.good]="s.latestTestPercentage >= 50">
                            <mat-icon class="sig-ic">grade</mat-icon>
                            <span>Test Avg: <strong>{{ s.latestTestPercentage }}%</strong></span>
                          </div>
                        }
                      </div>
                    </td>

                    <!-- AI Recommended Action -->
                    <td class="col-action">
                      <div class="action-recommendation-cell">
                        <div class="recommendation-badge" [ngClass]="s.riskLevel.toLowerCase()">
                          <mat-icon class="rec-ic">lightbulb</mat-icon>
                          <span class="rec-text">{{ s.recommendedAction }}</span>
                        </div>
                        @if (s.lastInterventionOutcome) {
                          <div class="last-intervention-note">
                            <mat-icon class="sub-ic">history</mat-icon>
                            <span>Last Status: <strong>{{ s.lastInterventionOutcome }}</strong> ({{ s.lastInterventionDate | localDatetime:'date' }})</span>
                          </div>
                        }
                      </div>
                    </td>

                    <!-- Intervention Action Buttons -->
                    <td class="col-intervene text-right">
                      <div class="action-buttons-cell">
                        <!-- Quick WhatsApp Outreach -->
                        <button
                          type="button"
                          class="action-btn wa-btn"
                          (click)="sendWhatsAppNudge(s)"
                          matTooltip="Dispatch empathetic WhatsApp outreach to parent"
                          mat-button>
                          <mat-icon class="wa-ic">chat</mat-icon>
                          <span>WhatsApp</span>
                        </button>

                        <!-- Log Counseling Intervention -->
                        <button
                          type="button"
                          class="action-btn counsel-btn"
                          (click)="openRecordCounselingDialog(s)"
                          matTooltip="Log parent meeting, telephonic counseling & outcome"
                          mat-flat-button
                          color="primary">
                          <mat-icon>support_agent</mat-icon>
                          <span>Counsel</span>
                        </button>

                        <!-- History Audit -->
                        <button
                          type="button"
                          class="action-btn history-btn"
                          (click)="openCounselingHistoryDialog(s)"
                          [matTooltip]="s.previousInterventionsCount > 0 ? ('View ' + s.previousInterventionsCount + ' past interventions') : 'No prior history'"
                          mat-icon-button>
                          <mat-icon [class.has-history]="s.previousInterventionsCount > 0">history</mat-icon>
                        </button>
                      </div>
                    </td>

                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination Bar -->
          <div class="pagination-footer">
            <span class="page-info">Showing page {{ currentPage }} ({{ items.length }} of {{ totalCount }} students)</span>
            <div class="pagination-controls">
              <button mat-icon-button (click)="onPageChange(currentPage - 1)" [disabled]="currentPage <= 1 || loading">
                <mat-icon>chevron_left</mat-icon>
              </button>
              <span class="current-page-num">{{ currentPage }}</span>
              <button mat-icon-button (click)="onPageChange(currentPage + 1)" [disabled]="items.length < pageSize || loading">
                <mat-icon>chevron_right</mat-icon>
              </button>
            </div>
          </div>
        }
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

    /* Page Header */
    .page-header-deck {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;

      .header-left {
        display: flex;
        align-items: center;
        gap: 14px;

        .header-icon-box {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 6px 12px -2px rgba(79, 70, 229, 0.3);

          mat-icon { font-size: 28px; width: 28px; height: 28px; }
        }

        .header-titles {
          .title-row {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;

            .page-title {
              margin: 0;
              font-size: 1.35rem;
              font-weight: 700;
              color: #0f172a;
              letter-spacing: -0.02em;
            }

            .agent-pulse-pill {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 3px 10px;
              background: #ecfdf5;
              border: 1px solid #a7f3d0;
              border-radius: 14px;
              font-size: 0.72rem;
              font-weight: 700;
              color: #047857;

              .pulse-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: #10b981;
                box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
              }
            }
          }

          .page-subtitle {
            margin: 4px 0 0;
            font-size: 0.82rem;
            color: #64748b;
            max-width: 850px;
            line-height: 1.4;
          }
        }
      }

      .header-action-buttons {
        display: flex;
        align-items: center;
        gap: 10px;

        .run-scan-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          border-radius: 8px;
        }

        .export-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          border-radius: 8px;
          color: #334155;
        }
      }
    }

    .page-loader {
      border-radius: 4px;
    }

    /* KPI Deck (Standard Compact Height & Responsive Grid) */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 12px;

      @media (max-width: 1366px) {
        grid-template-columns: repeat(3, 1fr);
      }

      @media (max-width: 840px) {
        grid-template-columns: repeat(2, 1fr);
      }

      @media (max-width: 520px) {
        grid-template-columns: 1fr;
      }

      .kpi-card {
        border-radius: 10px;
        padding: 10px 14px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-height: 74px;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 14px -3px rgba(0,0,0,0.08);
        }

        .kpi-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          width: 100%;
        }

        .kpi-meta {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
          flex: 1 1 auto;

          .kpi-label {
            font-size: 0.70rem;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .kpi-value {
            font-size: 1.28rem;
            font-weight: 800;
            color: #0f172a;
            line-height: 1.15;
            margin: 2px 0 1px;

            &.critical { color: #dc2626; }
            &.moderate { color: #d97706; }
            &.safe { color: #16a34a; }
            &.fee { color: #7c3aed; }
            &.retained { color: #2563eb; }
          }

          .kpi-hint {
            font-size: 0.68rem;
            color: #94a3b8;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }

        .kpi-icon-box {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;

          mat-icon { font-size: 19px; width: 19px; height: 19px; }

          &.total { background: #e0e7ff; color: #4338ca; }
          &.critical { background: #fee2e2; color: #dc2626; }
          &.moderate { background: #fef3c7; color: #d97706; }
          &.safe { background: #dcfce7; color: #16a34a; }
          &.fee { background: #ede9fe; color: #7c3aed; }
          &.retained { background: #dbeafe; color: #2563eb; }
        }
      }
    }

    /* Filter Card */
    .filter-card {
      border-radius: 12px;
      padding: 16px 20px;
      background: #ffffff;
      border: 1px solid #e2e8f0;

      .filter-form {
        width: 100%;
      }

      .filter-row {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;

        .filter-field {
          flex: 1 1 160px;
          min-width: 150px;
          margin-bottom: -1.25em; // Standard Angular Material form-field spacing fix
        }

        .search-field {
          flex: 2 1 240px;
        }

        .reset-btn {
          color: #64748b;
          height: 48px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
      }
    }

    /* Table Card */
    .table-card {
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      overflow: hidden;

      .table-card-header {
        padding: 16px 20px;
        border-bottom: 1px solid #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;

        .table-header-left {
          display: flex;
          align-items: center;
          gap: 10px;

          .table-title {
            margin: 0;
            font-size: 1.05rem;
            font-weight: 700;
            color: #1e293b;
          }

          .record-badge {
            font-size: 0.75rem;
            padding: 2px 8px;
            background: #f1f5f9;
            color: #475569;
            border-radius: 12px;
          }
        }

        .risk-legend {
          display: flex;
          align-items: center;
          gap: 14px;
          font-size: 0.74rem;
          color: #64748b;

          .legend-item {
            display: flex;
            align-items: center;
            gap: 5px;

            .legend-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;

              &.critical { background: #dc2626; }
              &.moderate { background: #f59e0b; }
              &.safe { background: #16a34a; }
            }
          }
        }
      }
    }

    /* Responsive Table */
    .table-responsive {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .erp-retention-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.83rem;
      text-align: left;

      thead th {
        padding: 12px 16px;
        background: #f8fafc;
        color: #475569;
        font-weight: 600;
        border-bottom: 1px solid #e2e8f0;
        white-space: nowrap;
      }

      tbody tr {
        border-bottom: 1px solid #f1f5f9;
        transition: background-color 0.12s ease;

        &:hover {
          background-color: #f8fafc;
        }

        &.row-critical {
          background-color: #fffaf9;
          &:hover { background-color: #fff1f0; }
        }

        &.row-moderate {
          background-color: #fffdfa;
          &:hover { background-color: #fefce8; }
        }
      }

      td {
        padding: 14px 16px;
        vertical-align: middle;
      }
    }

    /* Student Cell */
    .student-cell {
      display: flex;
      align-items: center;
      gap: 12px;

      .avatar-box {
        width: 42px;
        height: 42px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        overflow: hidden;

        &.critical { background: #fee2e2; color: #dc2626; }
        &.moderate { background: #fef3c7; color: #d97706; }
        &.safe { background: #dcfce7; color: #16a34a; }

        .avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .avatar-icon { font-size: 22px; width: 22px; height: 22px; }
      }

      .student-meta {
        display: flex;
        flex-direction: column;
        gap: 2px;

        .name-line {
          display: flex;
          align-items: center;
          gap: 6px;

          .st-name {
            font-size: 0.92rem;
            font-weight: 700;
            color: #0f172a;
          }

          .division-pill {
            font-size: 0.68rem;
            font-weight: 600;
            padding: 1px 6px;
            border-radius: 4px;

            &.school { background: #dbeafe; color: #1e40af; }
            &.coaching { background: #f3e8ff; color: #6b21a8; }
            &.hybrid { background: #dcfce7; color: #166534; }
          }
        }

        .meta-line {
          font-size: 0.76rem;
          color: #64748b;
          strong { color: #334155; }
        }

        .parent-line {
          font-size: 0.74rem;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 4px;

          .mini-ic { font-size: 13px; width: 13px; height: 13px; color: #94a3b8; }
          .phone-link {
            display: inline-flex;
            align-items: center;
            gap: 2px;
            color: #2563eb;
            cursor: pointer;
            &:hover { text-decoration: underline; }
          }
        }
      }
    }

    /* Risk Gauge Cell */
    .risk-gauge-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 150px;

      .score-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 8px;
        border-radius: 6px;
        width: fit-content;

        .score-num { font-weight: 800; font-size: 0.85rem; }
        .score-level { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; }

        &.critical { background: #fee2e2; color: #991b1b; }
        &.moderate { background: #fef3c7; color: #92400e; }
        &.safe { background: #dcfce7; color: #166534; }
      }

      .gauge-bar {
        width: 100%;
        height: 6px;
        background: #e2e8f0;
        border-radius: 3px;
        overflow: hidden;

        .gauge-fill {
          height: 100%;
          border-radius: 3px;
          &.critical { background: #ef4444; }
          &.moderate { background: #f59e0b; }
          &.safe { background: #22c55e; }
        }
      }

      .risk-factor-text {
        font-size: 0.72rem;
        color: #64748b;
        max-width: 200px;
        white-space: normal;
        line-height: 1.3;
      }
    }

    /* Signals Cell */
    .signals-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 170px;

      .signal-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.76rem;
        padding: 2px 6px;
        border-radius: 4px;
        background: #f8fafc;
        color: #475569;
        width: fit-content;

        .sig-ic { font-size: 14px; width: 14px; height: 14px; color: #64748b; }
        strong { color: #0f172a; }

        &.danger {
          background: #fef2f2;
          color: #991b1b;
          .sig-ic { color: #dc2626; }
        }
        &.warn {
          background: #fffbeb;
          color: #92400e;
          .sig-ic { color: #d97706; }
        }
        &.good {
          background: #f0fdf4;
          color: #166534;
          .sig-ic { color: #16a34a; }
        }

        .absent-badge {
          background: #dc2626;
          color: #ffffff;
          padding: 1px 4px;
          border-radius: 3px;
          font-size: 0.68rem;
          font-weight: 700;
        }

        .overdue-days {
          font-size: 0.7rem;
          color: #dc2626;
        }
      }
    }

    /* Recommendation Cell */
    .action-recommendation-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 220px;

      .recommendation-badge {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 0.78rem;
        line-height: 1.35;

        .rec-ic { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px; }

        &.critical {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #9f1239;
          .rec-ic { color: #e11d48; }
        }
        &.moderate {
          background: #fffbeb;
          border: 1px solid #fef3c7;
          color: #92400e;
          .rec-ic { color: #d97706; }
        }
        &.safe {
          background: #f0fdf4;
          border: 1px solid #dcfce7;
          color: #166534;
          .rec-ic { color: #16a34a; }
        }
      }

      .last-intervention-note {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.72rem;
        color: #64748b;
        .sub-ic { font-size: 13px; width: 13px; height: 13px; }
        strong { color: #334155; }
      }
    }

    /* Action Buttons Cell */
    .action-buttons-cell {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;

      .action-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        border-radius: 6px;
        height: 32px;
        padding: 0 10px;

        &.wa-btn {
          color: #15803d;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          &:hover { background: #dcfce7; }
          .wa-ic { font-size: 16px; width: 16px; height: 16px; color: #16a34a; }
        }

        &.counsel-btn {
          border-radius: 6px;
          height: 32px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }

        &.history-btn {
          width: 32px;
          height: 32px;
          color: #94a3b8;
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
          .has-history { color: #3b82f6; }
        }
      }
    }

    /* Pagination */
    .pagination-footer {
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid #f1f5f9;
      font-size: 0.8rem;
      color: #64748b;

      .pagination-controls {
        display: flex;
        align-items: center;
        gap: 8px;

        .current-page-num {
          font-weight: 700;
          color: #1e293b;
          padding: 0 4px;
        }
      }
    }

    /* Empty state */
    .empty-state-box {
      padding: 60px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: #64748b;

      .empty-icon-box {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #94a3b8;
        margin-bottom: 14px;
        mat-icon { font-size: 32px; width: 32px; height: 32px; }
      }

      h3 { margin: 0 0 6px; font-size: 1.15rem; color: #1e293b; }
      p { margin: 0 0 16px; font-size: 0.85rem; max-width: 480px; line-height: 1.45; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudentRetentionComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private retentionService = inject(StudentRetentionService);
  private authService = inject(AuthService);
  private schoolService = inject(SchoolService);
  private batchesService = inject(BatchesService);
  private branchesService = inject(BranchService);
  private dialog = inject(MatDialog);
  private confirmDialog = inject(ConfirmDialogService);
  private cdr = inject(ChangeDetectorRef);

  filterForm!: FormGroup;
  loading = false;
  items: StudentDropoutRiskItemDto[] = [];
  totalCount = 0;
  currentPage = 1;
  pageSize = 20;

  summary: StudentDropoutRiskSummaryKpiDto = {
    totalStudentsMonitored: 0,
    criticalRiskCount: 0,
    moderateRiskCount: 0,
    safeCount: 0,
    potentialFeeAtRisk: 0,
    interventionsCompletedCount: 0,
    studentsRetainedCount: 0
  };

  branches: BranchDto[] = [];
  classes: SchoolClassDto[] = [];
  batches: BatchDto[] = [];
  filteredBatches: BatchDto[] = [];

  hasSchoolModule = true;
  hasCoachingModule = true;

  private filterSub?: Subscription;

  ngOnInit(): void {
    const user = this.authService.currentUser();
    const activeBranchId = this.authService.selectedBranchId() || user?.branchId || '';

    this.hasSchoolModule = this.authService.hasSchoolModule();
    this.hasCoachingModule = this.authService.hasCoachingModule();

    this.filterForm = this.fb.group({
      branchId: [activeBranchId],
      academicScope: ['all'],
      classId: [''],
      batchId: [''],
      riskLevel: ['all'],
      search: ['']
    });

    this.loadBranches();
    this.loadClasses();
    this.loadBatches();

    // Auto-filter batches when classId changes (Strict Cascading Hierarchy rule)
    this.filterForm.get('classId')?.valueChanges.subscribe((selectedClassId) => {
      this.cascadeBatches(selectedClassId);
    });

    // Reactive filter auto-dispatch with debounce
    this.filterSub = this.filterForm.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)))
      .subscribe(() => {
        this.currentPage = 1;
        this.loadRetentionData();
      });

    this.loadRetentionData();
  }

  ngOnDestroy(): void {
    this.filterSub?.unsubscribe();
  }

  loadBranches(): void {
    this.branchesService.getBranches().subscribe({
      next: (bList: BranchDto[]) => {
        this.branches = bList || [];
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  loadClasses(): void {
    this.schoolService.getClasses().subscribe({
      next: (cList: SchoolClassDto[]) => {
        this.classes = cList || [];
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  loadBatches(): void {
    this.batchesService.getBatches().subscribe({
      next: (bList: BatchDto[]) => {
        this.batches = bList || [];
        this.cascadeBatches(this.filterForm.get('classId')?.value);
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  private cascadeBatches(classId?: string | null): void {
    if (!classId) {
      this.filteredBatches = [...this.batches];
    } else {
      // Find matching class name
      const selClass = this.classes.find(c => c.id === classId);
      const className = selClass?.name?.toLowerCase().trim();
      this.filteredBatches = this.batches.filter(b => {
        if (!className) return true;
        return b.name.toLowerCase().includes(className);
      });
    }
    this.cdr.markForCheck();
  }

  loadRetentionData(): void {
    this.loading = true;
    this.cdr.markForCheck();

    const fv = this.filterForm.value;

    this.retentionService.getRetentionAnalysis({
      branchId: fv.branchId || null,
      classId: fv.classId || null,
      batchId: fv.batchId || null,
      academicScope: fv.academicScope || 'all',
      riskLevel: fv.riskLevel || 'all',
      search: fv.search || null,
      page: this.currentPage,
      pageSize: this.pageSize
    }).subscribe({
      next: (res: StudentRetentionAnalysisResponse) => {
        this.items = res.items || [];
        this.totalCount = res.totalCount || 0;
        this.summary = res.summary || this.summary;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.cdr.markForCheck();
        this.confirmDialog.alert(
          'Analysis Error',
          err?.error?.message || err?.message || 'Failed to load retention analysis.',
          'danger'
        );
      }
    });
  }

  setRiskFilter(level: 'critical' | 'moderate' | 'safe'): void {
    this.filterForm.patchValue({ riskLevel: level });
  }

  resetFilters(): void {
    const activeBranchId = this.authService.selectedBranchId() || this.authService.currentUser()?.branchId || '';
    this.filterForm.reset({
      branchId: activeBranchId,
      academicScope: 'all',
      classId: '',
      batchId: '',
      riskLevel: 'all',
      search: ''
    });
  }

  onPageChange(newPage: number): void {
    if (newPage < 1) return;
    this.currentPage = newPage;
    this.loadRetentionData();
  }

  openRecordCounselingDialog(student: StudentDropoutRiskItemDto): void {
    const dialogRef = this.dialog.open(RecordCounselingDialogComponent, {
      width: '680px',
      maxWidth: '96vw',
      panelClass: 'responsive-counseling-dialog',
      data: { student }
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res) {
        this.loadRetentionData();
      }
    });
  }

  openCounselingHistoryDialog(student: StudentDropoutRiskItemDto): void {
    this.dialog.open(CounselingHistoryDialogComponent, {
      width: '740px',
      maxWidth: '96vw',
      panelClass: 'responsive-counseling-dialog',
      data: { student }
    });
  }

  sendWhatsAppNudge(student: StudentDropoutRiskItemDto): void {
    if (!student.parentPhone) {
      this.confirmDialog.alert('Missing Contact', 'Parent WhatsApp phone number is not available for this student.', 'warning');
      return;
    }

    const message = student.generatedOutreachMessageHindi;

    this.confirmDialog.confirm(
      'Send WhatsApp Early Warning',
      `Dispatch empathetic retention message to ${student.parentName} (${student.parentPhone})?\n\n"${message}"`,
      'Send WhatsApp',
      'Cancel',
      'info'
    ).subscribe((confirmed) => {
      if (!confirmed) return;

      this.loading = true;
      this.cdr.markForCheck();

      this.retentionService.sendWhatsAppOutreach({
        studentId: student.studentId,
        recipientPhone: student.parentPhone,
        messageText: message,
        language: 'Hindi'
      }).subscribe({
        next: (res) => {
          this.loading = false;
          this.cdr.markForCheck();

          // Also launch WhatsApp Web link for immediate direct fallback
          const cleanedPhone = student.parentPhone.replace(/\D/g, '');
          const waUrl = `https://wa.me/91${cleanedPhone.startsWith('91') ? cleanedPhone.slice(2) : cleanedPhone}?text=${encodeURIComponent(message)}`;
          window.open(waUrl, '_blank');

          this.confirmDialog.alert(
            'Outreach Dispatched',
            `Retention intervention logged and WhatsApp message opened for ${student.studentName}.`,
            'success'
          );
          this.loadRetentionData();
        },
        error: (err) => {
          this.loading = false;
          this.cdr.markForCheck();
          this.confirmDialog.alert('Dispatch Error', err?.error?.message || err?.message || 'Failed to dispatch WhatsApp.', 'danger');
        }
      });
    });
  }

  openDirectPhone(phone: string): void {
    window.open(`tel:${phone}`, '_self');
  }

  exportToCsv(): void {
    if (this.items.length === 0) return;

    const headers = [
      'Student Name',
      'Roll Number',
      'Admission Number',
      'Class / Batch',
      'Parent Name',
      'Parent Phone',
      'Risk Score (%)',
      'Risk Category',
      'Attendance (%)',
      'Consecutive Absents',
      'Overdue Fee (INR)',
      'Overdue Days',
      'Test Score (%)',
      'Primary Risk Factor',
      'Recommended Action'
    ];

    const rows = this.items.map(s => [
      `"${s.studentName}"`,
      `"${s.rollNumber || ''}"`,
      `"${s.admissionNumber || ''}"`,
      `"${s.className || s.batchName || ''}"`,
      `"${s.parentName}"`,
      `"${s.parentPhone}"`,
      s.riskScore,
      `"${s.riskLevel}"`,
      s.attendancePercentage,
      s.consecutiveAbsentDays,
      s.overdueFeeAmount,
      s.overdueFeeDays,
      s.latestTestPercentage !== undefined ? s.latestTestPercentage : '',
      `"${s.primaryRiskFactor.replace(/"/g, '""')}"`,
      `"${s.recommendedAction.replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Student_Retention_Risk_Report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
