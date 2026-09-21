import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import {
  SchoolService,
  SchoolClassDto,
  SchoolSectionDto,
  PromotionCandidateDto,
  ClassExamDto,
  StudentPromotionItemDto,
  ExecutePromotionRequestDto,
  StudentPromotionHistoryDto
} from '../../core/services/school.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

interface CandidateRow extends PromotionCandidateDto {
  selected: boolean;
  resultStatus: 'Promoted' | 'Detained' | 'Passed with Grace' | 'Double Promoted';
  newRollNumber: string;
  remarks: string;
}

@Component({
  selector: 'app-student-promotion',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatCheckboxModule,
    MatTableModule,
    MatTabsModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatMenuModule,
    MatChipsModule
  ],
  template: `
    <div class="promotion-container">
      <!-- Top Page Header -->
      <div class="page-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>trending_up</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Student Promotion &amp; Academic Transition</h1>
            <p class="page-subtitle">
              Promote class batches to the next grade for new academic sessions, manage detentions, auto-assign roll numbers, and view transition audit logs.
            </p>
          </div>
        </div>
        <div class="header-actions">
          <a mat-stroked-button color="primary" routerLink="/students" class="back-link-btn">
            <mat-icon>arrow_back</mat-icon>
            <span>Back to Students</span>
          </a>
        </div>
      </div>

      <!-- Main Tabs -->
      <mat-tab-group animationDuration="200ms" class="styled-tab-group" (selectedTabChange)="onTabChange($event.index)">
        
        <!-- TAB 1: BULK PROMOTION WORKFLOW -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">upgrade</mat-icon>
            <span>Class Promotion Matrix</span>
          </ng-template>

          <div class="tab-body">
            <!-- Source & Target Selector Card -->
            <mat-card class="matrix-card mat-elevation-z2">
              <div class="matrix-grid">
                
                <!-- Left: Source Class (Promote FROM) -->
                <div class="matrix-panel source-panel">
                  <div class="panel-badge source-badge">
                    <mat-icon>school</mat-icon>
                    <span>SOURCE (Current Grade)</span>
                  </div>
                  <div class="form-row">
                    <mat-form-field appearance="outline" class="panel-field">
                      <mat-label>Promote From Class</mat-label>
                      <mat-select [(ngModel)]="fromClassId" (selectionChange)="onFromClassChange($event.value)">
                        <mat-option *ngFor="let c of classes" [value]="c.id">
                          {{ c.name }} ({{ c.sectionCount || 0 }} Sections)
                        </mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="panel-field">
                      <mat-label>Section (Optional)</mat-label>
                      <mat-select [(ngModel)]="fromSectionId" (selectionChange)="onFromSectionChange()">
                        <mat-option [value]="''">All Sections</mat-option>
                        <mat-option *ngFor="let s of fromSections" [value]="s.id">
                          {{ s.name }}
                        </mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="panel-field">
                      <mat-label>Current Academic Session</mat-label>
                      <input matInput [(ngModel)]="fromAcademicYear" (change)="loadClassExams()" placeholder="e.g. 2025-2026" />
                    </mat-form-field>
                  </div>

                  <!-- Row 2: Exam Selection & Passing Benchmark -->
                  <div class="form-row exam-config-row">
                    <mat-form-field appearance="outline" class="panel-field exam-select-field">
                      <mat-label>Evaluation Exam / Assessment</mat-label>
                      <mat-select [(ngModel)]="selectedExamId">
                        <mat-option [value]="''">All Session Exams (Aggregate Average)</mat-option>
                        <mat-option *ngFor="let ex of availableExams" [value]="ex.id">
                          {{ ex.title }} ({{ ex.subject }} - {{ ex.maxMarks }} Marks)
                        </mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="panel-field benchmark-field">
                      <mat-label>Pass Benchmark (%)</mat-label>
                      <input matInput type="number" [(ngModel)]="passingPercentage" min="1" max="100" />
                    </mat-form-field>
                  </div>

                  <div class="source-hint">
                    <mat-icon>auto_awesome</mat-icon>
                    <span>Scores &lt; {{ passingPercentage }}% or absent automatically suggest <strong>Detained (Repeat)</strong>.</span>
                  </div>
                </div>

                <!-- Center Divider Arrow -->
                <div class="matrix-arrow-box">
                  <div class="arrow-circle">
                    <mat-icon>double_arrow</mat-icon>
                  </div>
                </div>

                <!-- Right: Target Class (Promote TO) -->
                <div class="matrix-panel target-panel">
                  <div class="panel-badge target-badge">
                    <mat-icon>arrow_forward</mat-icon>
                    <span>DESTINATION (New Grade)</span>
                  </div>
                  <div class="form-row">
                    <mat-form-field appearance="outline" class="panel-field">
                      <mat-label>Promote Into Class</mat-label>
                      <mat-select [(ngModel)]="toClassId" (selectionChange)="onToClassChange($event.value)">
                        <mat-option *ngIf="destinationClasses.length === 0" disabled value="">
                          No Higher Grade Available (Terminal Class)
                        </mat-option>
                        <mat-option *ngFor="let c of destinationClasses" [value]="c.id">
                          {{ c.name }}
                        </mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="panel-field">
                      <mat-label>Target Section</mat-label>
                      <mat-select [(ngModel)]="toSectionId">
                        <mat-option *ngFor="let s of toSections" [value]="s.id">
                          {{ s.name }} (Cap: {{ s.maxCapacity || 45 }})
                        </mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="panel-field">
                      <mat-label>New Academic Session</mat-label>
                      <input matInput [(ngModel)]="toAcademicYear" placeholder="e.g. 2026-2027" />
                    </mat-form-field>
                  </div>

                  <div class="dest-hint-box">
                    <mat-icon>verified</mat-icon>
                    <span>Promoted students will roll over to <strong>{{ getToClassName() }}</strong> for session <strong>{{ toAcademicYear }}</strong>.</span>
                  </div>
                </div>
              </div>

              <div class="matrix-footer">
                <button mat-raised-button color="primary" class="load-candidates-btn" (click)="loadCandidates()" [disabled]="!fromClassId || loadingCandidates">
                  <mat-spinner diameter="18" *ngIf="loadingCandidates" class="inline-spinner"></mat-spinner>
                  <mat-icon *ngIf="!loadingCandidates">people_alt</mat-icon>
                  <span>Evaluate &amp; Load Students</span>
                </button>
              </div>
            </mat-card>

            <!-- Candidates Workspace -->
            <div *ngIf="candidatesLoaded" class="candidates-workspace">
              
              <!-- Toolbar -->
              <mat-card class="toolbar-card mat-elevation-z1">
                <div class="tb-left">
                  <mat-checkbox [checked]="isAllSelected()" [indeterminate]="isPartiallySelected()" (change)="toggleSelectAll($event.checked)" color="primary">
                    <strong>Select All ({{ candidates.length }})</strong>
                  </mat-checkbox>

                  <div class="search-wrap">
                    <mat-icon>search</mat-icon>
                    <input type="text" [(ngModel)]="searchTerm" placeholder="Search student name or SR number..." />
                  </div>
                </div>

                <div class="tb-right">
                  <!-- Roll number automation menu -->
                  <button mat-stroked-button [matMenuTriggerFor]="rollMenu" class="tool-btn">
                    <mat-icon>format_list_numbered</mat-icon>
                    <span>Auto-Assign Roll Numbers</span>
                    <mat-icon>arrow_drop_down</mat-icon>
                  </button>
                  <mat-menu #rollMenu="matMenu">
                    <button mat-menu-item (click)="autoAssignRollNumbers('alphabetical')">
                      <mat-icon>sort_by_alpha</mat-icon>
                      <span>Alphabetical (A to Z Name Order: 1, 2, 3...)</span>
                    </button>
                    <button mat-menu-item (click)="autoAssignRollNumbers('retain')">
                      <mat-icon>history</mat-icon>
                      <span>Retain Current Section Roll Numbers</span>
                    </button>
                    <button mat-menu-item (click)="autoAssignRollNumbers('sequential')">
                      <mat-icon>format_list_numbered</mat-icon>
                      <span>Sequential from 1 based on Table Order</span>
                    </button>
                  </mat-menu>

                  <!-- Set all status menu -->
                  <button mat-stroked-button [matMenuTriggerFor]="statusMenu" class="tool-btn">
                    <mat-icon>checklist</mat-icon>
                    <span>Bulk Status</span>
                    <mat-icon>arrow_drop_down</mat-icon>
                  </button>
                  <mat-menu #statusMenu="matMenu">
                    <button mat-menu-item (click)="setBulkStatus('Promoted')">
                      <mat-icon style="color:#16a34a">check_circle</mat-icon>
                      <span>Set All Selected as "Promoted"</span>
                    </button>
                    <button mat-menu-item (click)="setBulkStatus('Detained')">
                      <mat-icon style="color:#dc2626">highlight_off</mat-icon>
                      <span>Set All Selected as "Detained (Repeat)"</span>
                    </button>
                    <button mat-menu-item (click)="setBulkStatus('Passed with Grace')">
                      <mat-icon style="color:#2563eb">verified</mat-icon>
                      <span>Set All Selected as "Passed with Grace"</span>
                    </button>
                  </mat-menu>
                </div>
              </mat-card>

              <!-- Table -->
              <mat-card class="table-card mat-elevation-z2">
                <mat-progress-bar mode="indeterminate" *ngIf="loadingCandidates"></mat-progress-bar>
                
                <div class="table-responsive">
                  <table class="styled-table">
                    <thead>
                      <tr>
                        <th class="col-chk"></th>
                        <th class="col-student">Student Information</th>
                        <th class="col-current">Current Grade</th>
                        <th class="col-exam">Annual Exam Performance</th>
                        <th class="col-metrics">Attendance &amp; Fees</th>
                        <th class="col-status">Promotion Decision</th>
                        <th class="col-dest">Target Grade</th>
                        <th class="col-newroll">New Sec Roll No</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let s of filteredCandidates" [class.row-selected]="s.selected" [class.row-detained]="s.resultStatus === 'Detained'" [class.row-exam-failed]="s.examResultStatus === 'Failed' || s.examResultStatus === 'Absent'">
                        
                        <!-- Checkbox -->
                        <td class="col-chk">
                          <mat-checkbox [(ngModel)]="s.selected" color="primary"></mat-checkbox>
                        </td>

                        <!-- Student Info -->
                        <td class="col-student">
                          <div class="student-cell">
                            <div class="avatar-box">
                              <span *ngIf="!s.profilePhoto">{{ getInitials(s.studentName) }}</span>
                              <img *ngIf="s.profilePhoto" [src]="s.profilePhoto" alt="{{ s.studentName }}" />
                            </div>
                            <div class="student-meta">
                              <span class="st-name">{{ s.studentName }}</span>
                              <div class="st-sub">
                                <span class="sr-pill">SR: <strong>{{ s.admissionNumber }}</strong></span>
                                <span class="dot">&bull;</span>
                                <span>{{ s.gender || 'Student' }}</span>
                                <span class="dot" *ngIf="s.parentName">&bull;</span>
                                <span *ngIf="s.parentName">{{ s.parentName }}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <!-- Current Grade -->
                        <td class="col-current">
                          <div class="grade-badge current-grade">
                            <span class="grade-name">{{ s.currentClassName }}</span>
                            <span class="grade-sec">{{ s.currentSectionName ? 'Sec ' + s.currentSectionName : '' }}</span>
                            <span class="grade-roll">Roll: <strong>{{ s.schoolRollNumber || s.currentRollNumber }}</strong></span>
                          </div>
                        </td>

                        <!-- Annual Exam Performance -->
                        <td class="col-exam">
                          <div class="exam-perf-box" *ngIf="s.examResultStatus && s.examResultStatus !== 'No Exam Record'">
                            <div class="exam-top-row">
                              <span class="exam-score">Marks: <strong>{{ s.examMarksObtained }}</strong> / {{ s.examMaxMarks }}</span>
                              <span class="exam-pct-badge" [class.pct-pass]="(s.examPercentage || 0) >= passingPercentage" [class.pct-fail]="(s.examPercentage || 0) < passingPercentage">
                                {{ s.examPercentage }}%
                              </span>
                            </div>
                            <div class="exam-bottom-row">
                              <span class="grade-chip" *ngIf="s.examGrade">Grade: <strong>{{ s.examGrade }}</strong></span>
                              <span class="status-result-badge" [class.badge-passed]="s.examResultStatus === 'Passed'" [class.badge-failed]="s.examResultStatus === 'Failed'" [class.badge-absent]="s.examResultStatus === 'Absent'">
                                <mat-icon class="badge-icon">{{ s.examResultStatus === 'Passed' ? 'check_circle' : 'cancel' }}</mat-icon>
                                <span>{{ s.examResultStatus }}</span>
                              </span>
                            </div>
                          </div>
                          <div class="no-exam-box" *ngIf="!s.examResultStatus || s.examResultStatus === 'No Exam Record'">
                            <span class="no-exam-chip">No Exam Record</span>
                          </div>
                        </td>

                        <!-- Metrics -->
                        <td class="col-metrics">
                          <div class="metrics-stack">
                            <div class="metric-item">
                              <span class="lbl">Attendance:</span>
                              <span class="val-att" [class.att-low]="s.attendancePercentage < 75">
                                {{ s.attendancePercentage }}%
                              </span>
                            </div>
                            <div class="metric-item">
                              <span class="lbl">Pending Fees:</span>
                              <span class="val-dues" [class.has-dues]="s.pendingDues > 0">
                                {{ s.pendingDues > 0 ? ('₹' + s.pendingDues) : 'Nil (Clear)' }}
                              </span>
                            </div>
                          </div>
                        </td>

                        <!-- Status Decision -->
                        <td class="col-status">
                          <select class="custom-select status-select" [(ngModel)]="s.resultStatus" [class.status-promoted]="s.resultStatus === 'Promoted'" [class.status-detained]="s.resultStatus === 'Detained'" [class.status-grace]="s.resultStatus === 'Passed with Grace'">
                            <option value="Promoted">Promoted (Pass)</option>
                            <option value="Passed with Grace">Passed with Grace</option>
                            <option value="Double Promoted">Double Promoted</option>
                            <option value="Detained">Detained (Repeat)</option>
                          </select>
                        </td>

                        <!-- Target Grade -->
                        <td class="col-dest">
                          <div class="grade-badge target-grade" *ngIf="s.resultStatus !== 'Detained'">
                            <span class="grade-name">{{ getToClassName() }}</span>
                            <span class="grade-sec">{{ getToSectionName() }}</span>
                          </div>
                          <div class="grade-badge detained-grade" *ngIf="s.resultStatus === 'Detained'">
                            <span>Retain in {{ s.currentClassName }}</span>
                          </div>
                        </td>

                        <!-- New Roll -->
                        <td class="col-newroll">
                          <input
                            type="text"
                            class="roll-input"
                            [(ngModel)]="s.newRollNumber"
                            placeholder="Roll No"
                            [disabled]="s.resultStatus === 'Detained'"
                            [class.input-disabled]="s.resultStatus === 'Detained'"
                          />
                        </td>
                      </tr>

                      <tr *ngIf="filteredCandidates.length === 0">
                        <td colspan="8" class="empty-state">
                          <mat-icon>search_off</mat-icon>
                          <p>No matching students found.</p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Sticky Bottom Action Bar -->
                <div class="action-dock">
                  <div class="dock-summary">
                    <span class="dock-stat total">Total: <strong>{{ candidates.length }}</strong></span>
                    <span class="dock-stat selected">Selected: <strong>{{ getSelectedCount() }}</strong></span>
                    <span class="dock-stat promoted">Promoted: <strong>{{ getPromotedCount() }}</strong></span>
                    <span class="dock-stat detained">Detained: <strong>{{ getDetainedCount() }}</strong></span>
                  </div>

                  <div class="dock-btns">
                    <button mat-button type="button" (click)="candidatesLoaded = false" [disabled]="executing">Reset Selection</button>
                    <button mat-raised-button color="primary" class="execute-btn" (click)="confirmAndExecutePromotion()" [disabled]="getSelectedCount() === 0 || !toClassId || executing">
                      <mat-spinner diameter="18" *ngIf="executing" class="inline-spinner"></mat-spinner>
                      <mat-icon *ngIf="!executing">rocket_launch</mat-icon>
                      <span>Execute Class Promotion ({{ getSelectedCount() }})</span>
                    </button>
                  </div>
                </div>
              </mat-card>

            </div>

            <!-- Initial State Card -->
            <mat-card *ngIf="!candidatesLoaded" class="empty-guide-card mat-elevation-z1">
              <div class="guide-content">
                <mat-icon class="guide-icon">school</mat-icon>
                <h3>Select Source &amp; Destination Class to Begin</h3>
                <p>Choose the current grade (e.g. Class 8th) and target promotion grade (e.g. Class 9th) above, then click <strong>"Load Students for Promotion"</strong>.</p>
              </div>
            </mat-card>
          </div>
        </mat-tab>

        <!-- TAB 2: PROMOTION AUDIT HISTORY & REVERT -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">history</mat-icon>
            <span>Transition History &amp; Audit Logs</span>
          </ng-template>

          <div class="tab-body">
            <mat-card class="history-card mat-elevation-z2">
              <div class="history-filter-bar">
                <div class="hf-left">
                  <mat-form-field appearance="outline" class="filter-field">
                    <mat-label>Filter by Class</mat-label>
                    <mat-select [(ngModel)]="historyFilterClassId" (selectionChange)="loadHistory()">
                      <mat-option [value]="''">All Classes</mat-option>
                      <mat-option *ngFor="let c of classes" [value]="c.id">{{ c.name }}</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="filter-field">
                    <mat-label>Academic Session</mat-label>
                    <input matInput [(ngModel)]="historyFilterYear" (keyup.enter)="loadHistory()" placeholder="e.g. 2026-2027" />
                  </mat-form-field>

                  <button mat-stroked-button color="primary" (click)="loadHistory()" class="refresh-btn">
                    <mat-icon>refresh</mat-icon>
                    <span>Filter Logs</span>
                  </button>
                </div>
              </div>

              <mat-progress-bar mode="indeterminate" *ngIf="loadingHistory"></mat-progress-bar>

              <div class="table-responsive">
                <table class="styled-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Student</th>
                      <th>Transition Route</th>
                      <th>Academic Sessions</th>
                      <th>Exam Performance</th>
                      <th>Result Status</th>
                      <th>Promoted By</th>
                      <th class="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let h of historyItems">
                      <td>
                        <span class="date-txt">{{ h.promotionDate | date:'dd MMM yyyy, hh:mm a' }}</span>
                      </td>
                      <td>
                        <div class="st-hist-cell">
                          <strong>{{ h.studentName }}</strong>
                          <span class="sub">SR: {{ h.admissionNumber }}</span>
                        </div>
                      </td>
                      <td>
                        <div class="route-badge">
                          <span class="from">{{ h.fromClassName }} {{ h.fromSectionName ? '(' + h.fromSectionName + ')' : '' }} [Roll: {{ h.fromRollNumber || '-' }}]</span>
                          <mat-icon class="arrow">arrow_forward</mat-icon>
                          <span class="to">{{ h.toClassName }} {{ h.toSectionName ? '(' + h.toSectionName + ')' : '' }} [Roll: {{ h.toRollNumber || '-' }}]</span>
                        </div>
                      </td>
                      <td>
                        <span class="year-pill">{{ h.fromAcademicYear }} &rarr; {{ h.toAcademicYear }}</span>
                      </td>
                      <td>
                        <div *ngIf="h.examPercentage != null" class="exam-hist-badge">
                          <strong>{{ h.examPercentage }}%</strong>
                          <span *ngIf="h.examGrade" class="sub-grade">({{ h.examGrade }})</span>
                          <span *ngIf="h.examTotalMarks" class="sub-marks">{{ h.examTotalMarks }}</span>
                        </div>
                        <span *ngIf="h.examPercentage == null" class="text-muted">-</span>
                      </td>
                      <td>
                        <span class="status-chip" [class.chip-promoted]="h.resultStatus === 'Promoted'" [class.chip-detained]="h.resultStatus === 'Detained'">
                          {{ h.resultStatus }}
                        </span>
                      </td>
                      <td>
                        <span class="user-txt">{{ h.promotedBy || 'Admin' }}</span>
                      </td>
                      <td class="text-right">
                        <button mat-icon-button color="warn" (click)="revertSingleHistory(h)" matTooltip="Rollback this promotion">
                          <mat-icon>undo</mat-icon>
                        </button>
                      </td>
                    </tr>

                    <tr *ngIf="historyItems.length === 0 && !loadingHistory">
                      <td colspan="8" class="empty-state">
                        <mat-icon>assignment</mat-icon>
                        <p>No promotion transition records found.</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </mat-card>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .promotion-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-bottom: 40px;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;

      .header-left {
        display: flex;
        align-items: center;
        gap: 16px;

        .header-icon-box {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: #2563eb;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.28);
          mat-icon { font-size: 28px; width: 28px; height: 28px; }
        }

        .page-title {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 700;
          color: #1e3a8a;
        }
        .page-subtitle {
          margin: 4px 0 0;
          font-size: 0.88rem;
          color: #64748b;
          max-width: 800px;
        }
      }

      .back-link-btn {
        color: #2563eb;
        border-color: #bfdbfe;
        mat-icon { margin-right: 4px; }
      }
    }

    .styled-tab-group {
      background: transparent;
      ::ng-deep .mat-mdc-tab-header {
        background: #ffffff;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        margin-bottom: 16px;
      }
      .tab-icon { margin-right: 8px; font-size: 20px; width: 20px; height: 20px; }
    }

    .tab-body {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Matrix Card */
    .matrix-card {
      border-radius: 14px;
      padding: 20px 24px;
      background: #ffffff;
      border: 1px solid #e2e8f0;

      .matrix-grid {
        display: grid;
        grid-template-columns: 1fr 60px 1fr;
        align-items: center;
        gap: 20px;

        @media (max-width: 900px) {
          grid-template-columns: 1fr;
        }
      }

      .matrix-panel {
        padding: 16px 20px;
        border-radius: 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;

        &.source-panel {
          border-left: 4px solid #f59e0b;
        }
        &.target-panel {
          border-left: 4px solid #10b981;
        }

        .panel-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.76rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }

          &.source-badge { color: #b45309; }
          &.target-badge { color: #047857; }
        }

        .form-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
          &.exam-config-row {
            grid-template-columns: 2fr 1fr;
            margin-top: 10px;
          }
        }
        .panel-field { width: 100%; margin-bottom: -1.2em; }

        .source-hint {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 14px;
          font-size: 0.78rem;
          color: #b45309;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }

        .dest-hint-box {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 14px;
          font-size: 0.78rem;
          color: #047857;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }
      }

      .matrix-arrow-box {
        display: flex;
        align-items: center;
        justify-content: center;
        .arrow-circle {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border: 1px solid #bfdbfe;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #2563eb;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.15);
        }
      }

      .matrix-footer {
        display: flex;
        justify-content: flex-end;
        margin-top: 20px;
        padding-top: 14px;
        border-top: 1px solid #f1f5f9;

        .load-candidates-btn {
          height: 44px;
          padding: 0 24px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.94rem;
          mat-icon { margin-right: 6px; }
        }
      }
    }

    /* Candidates Workspace */
    .candidates-workspace {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-top: 18px;
    }

    /* Toolbar Card */
    .toolbar-card {
      padding: 12px 18px;
      border-radius: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      background: #ffffff;
      border: 1px solid #e2e8f0;

      .tb-left {
        display: flex;
        align-items: center;
        gap: 18px;

        .search-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 20px;
          padding: 6px 14px;
          mat-icon { font-size: 18px; width: 18px; height: 18px; color: #64748b; }
          input {
            border: none;
            outline: none;
            background: transparent;
            font-size: 0.88rem;
            width: 220px;
          }
        }
      }

      .tb-right {
        display: flex;
        gap: 10px;
        .tool-btn {
          border-radius: 8px;
          mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 4px; }
        }
      }
    }

    /* Table Card */
    .table-card {
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      background: #ffffff;
    }

    .table-responsive {
      overflow-x: auto;
    }

    .styled-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;

      thead th {
        background: #f8fafc;
        color: #475569;
        font-weight: 700;
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 14px 16px;
        border-bottom: 2px solid #e2e8f0;
        text-align: left;
      }

      tbody tr {
        border-bottom: 1px solid #f1f5f9;
        transition: background 0.15s ease;
        &:hover { background: #f8fafc; }
        &.row-selected { background: #eff6ff; }
        &.row-detained { background: #fffbeb; }
        &.row-exam-failed {
          background: #fef2f2 !important;
          border-left: 4px solid #ef4444;
        }

        td {
          padding: 12px 16px;
          vertical-align: middle;
        }
      }
    }

    /* Table Elements */
    .student-cell {
      display: flex;
      align-items: center;
      gap: 12px;

      .avatar-box {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: #e2e8f0;
        color: #334155;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
        overflow: hidden;
        flex-shrink: 0;
        img { width: 100%; height: 100%; object-fit: cover; }
      }

      .student-meta {
        display: flex;
        flex-direction: column;
        .st-name { font-weight: 600; color: #0f172a; font-size: 0.95rem; }
        .st-sub {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          color: #64748b;
          margin-top: 2px;
          .sr-pill {
            background: #f1f5f9;
            padding: 1px 6px;
            border-radius: 4px;
            color: #1e40af;
          }
          .dot { color: #cbd5e1; }
        }
      }
    }

    .grade-badge {
      display: inline-flex;
      flex-direction: column;
      gap: 2px;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 0.8rem;

      &.current-grade {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        .grade-name { font-weight: 700; color: #334155; }
        .grade-sec { color: #64748b; }
        .grade-roll { color: #2563eb; }
      }

      &.target-grade {
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        .grade-name { font-weight: 700; color: #065f46; }
        .grade-sec { color: #047857; }
      }

      &.detained-grade {
        background: #fff1f2;
        border: 1px solid #fecdd3;
        color: #9f1239;
        font-weight: 600;
      }
    }

    .exam-perf-box {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 0.78rem;

      .exam-top-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;

        .exam-score {
          color: #334155;
          strong { color: #0f172a; font-weight: 700; }
        }

        .exam-pct-badge {
          padding: 1px 6px;
          border-radius: 4px;
          font-weight: 700;
          font-size: 0.76rem;
          &.pct-pass { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
          &.pct-fail { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
        }
      }

      .exam-bottom-row {
        display: flex;
        align-items: center;
        gap: 6px;

        .grade-chip {
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          padding: 1px 6px;
          border-radius: 4px;
          color: #475569;
          font-size: 0.72rem;
          strong { color: #1e293b; }
        }

        .status-result-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 1px 6px;
          border-radius: 4px;
          font-weight: 600;
          font-size: 0.72rem;

          .badge-icon {
            font-size: 13px;
            width: 13px;
            height: 13px;
          }

          &.badge-passed {
            background: #f0fdf4;
            color: #166534;
            border: 1px solid #bbf7d0;
          }
          &.badge-failed {
            background: #fef2f2;
            color: #991b1b;
            border: 1px solid #fecaca;
          }
          &.badge-absent {
            background: #fff7ed;
            color: #c2410c;
            border: 1px solid #ffedd5;
          }
        }
      }
    }

    .no-exam-chip {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      background: #f1f5f9;
      color: #64748b;
      font-size: 0.74rem;
      border: 1px dashed #cbd5e1;
    }

    .exam-hist-badge {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 0.8rem;
      strong { color: #1e3a8a; }
      .sub-grade { font-size: 0.74rem; color: #475569; }
      .sub-marks { font-size: 0.72rem; color: #64748b; }
    }

    .metrics-stack {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 0.78rem;

      .metric-item {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        .lbl { color: #64748b; }
        .val-att { font-weight: 700; color: #16a34a; &.att-low { color: #dc2626; } }
        .val-dues { font-weight: 600; color: #16a34a; &.has-dues { color: #b91c1c; font-weight: 700; } }
      }
    }

    .status-select {
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      font-size: 0.85rem;
      font-weight: 600;
      outline: none;
      cursor: pointer;

      &.status-promoted { background: #f0fdf4; color: #166534; border-color: #86efac; }
      &.status-detained { background: #fef2f2; color: #991b1b; border-color: #fca5a5; }
      &.status-grace { background: #eff6ff; color: #1e40af; border-color: #93c5fd; }
    }

    .roll-input {
      width: 70px;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      font-size: 0.9rem;
      font-weight: 700;
      text-align: center;
      color: #1e3a8a;
      outline: none;
      &:focus { border-color: #2563eb; }
      &.input-disabled { background: #f1f5f9; color: #94a3b8; }
    }

    /* Sticky Bottom Action Dock */
    .action-dock {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      padding: 16px 24px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-top: 1px solid #bfdbfe;

      .dock-summary {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;

        .dock-stat {
          font-size: 0.9rem;
          padding: 4px 10px;
          border-radius: 6px;
          background: #ffffff;
          border: 1px solid #bfdbfe;
          color: #1e3a8a;
          strong { color: #1e40af; }
          &.promoted { border-color: #86efac; color: #166534; strong { color: #15803d; } }
          &.detained { border-color: #fca5a5; color: #991b1b; strong { color: #b91c1c; } }
        }
      }

      .dock-btns {
        display: flex;
        align-items: center;
        gap: 12px;

        .execute-btn {
          height: 44px;
          padding: 0 24px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 0.95rem;
          mat-icon { margin-right: 6px; }
        }
      }
    }

    /* Guide & History Cards */
    .empty-guide-card {
      padding: 48px;
      text-align: center;
      border-radius: 14px;
      background: #ffffff;
      border: 2px dashed #cbd5e1;

      .guide-content {
        max-width: 440px;
        margin: 0 auto;
        .guide-icon { font-size: 54px; width: 54px; height: 54px; color: #94a3b8; margin-bottom: 12px; }
        h3 { margin: 0; font-size: 1.2rem; color: #334155; font-weight: 700; }
        p { margin: 8px 0 0; color: #64748b; font-size: 0.9rem; line-height: 1.5; }
      }
    }

    .history-card {
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      background: #ffffff;

      .history-filter-bar {
        padding: 16px 20px 4px;
        .hf-left {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          .filter-field { width: 220px; margin-bottom: -1.2em; }
          .refresh-btn { height: 42px; }
        }
      }
    }

    .route-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 0.82rem;
      .from { font-weight: 600; color: #b45309; }
      .arrow { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; }
      .to { font-weight: 700; color: #047857; }
    }

    .year-pill {
      font-size: 0.8rem;
      font-weight: 600;
      background: #f1f5f9;
      padding: 3px 8px;
      border-radius: 12px;
      color: #334155;
    }

    .status-chip {
      font-size: 0.78rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
      &.chip-promoted { background: #dcfce7; color: #166534; }
      &.chip-detained { background: #fee2e2; color: #991b1b; }
    }

    .inline-spinner { display: inline-block; margin-right: 6px; }
    .empty-state {
      text-align: center;
      padding: 36px !important;
      color: #94a3b8;
      mat-icon { font-size: 36px; width: 36px; height: 36px; }
      p { margin: 6px 0 0; }
    }
  `]
})
export class StudentPromotionComponent implements OnInit {
  classes: SchoolClassDto[] = [];
  fromSections: SchoolSectionDto[] = [];
  toSections: SchoolSectionDto[] = [];

  // Matrix selections
  fromClassId: string = '';
  fromSectionId: string = '';
  fromAcademicYear: string = '2025-2026';

  toClassId: string = '';
  toSectionId: string = '';
  toAcademicYear: string = '2026-2027';

  // Exam configuration
  availableExams: ClassExamDto[] = [];
  selectedExamId: string = '';
  passingPercentage: number = 33;

  // Candidates
  candidates: CandidateRow[] = [];
  candidatesLoaded = false;
  loadingCandidates = false;
  searchTerm = '';
  executing = false;

  // History Tab
  historyItems: StudentPromotionHistoryDto[] = [];
  loadingHistory = false;
  historyFilterClassId = '';
  historyFilterYear = '';

  constructor(
    private schoolService: SchoolService,
    private confirmDialog: ConfirmDialogService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.initDefaultAcademicYears();
    this.route.queryParams.subscribe(params => {
      if (params['fromClassId']) {
        this.fromClassId = params['fromClassId'];
      }
      if (params['academicYear']) {
        this.fromAcademicYear = params['academicYear'];
      }
    });
    this.loadClasses();
  }

  initDefaultAcademicYears(): void {
    const currentYear = new Date().getFullYear();
    this.fromAcademicYear = `${currentYear - 1}-${currentYear}`;
    this.toAcademicYear = `${currentYear}-${currentYear + 1}`;
  }

  getClassRank(cls: SchoolClassDto | undefined): number {
    if (!cls) return 0;
    const name = (cls.name || '').toLowerCase().trim();
    if (name.includes('play') || name.includes('pg')) return -3;
    if (name.includes('nursery')) return -2;
    if (name.includes('lkg')) return -1;
    if (name.includes('ukg') || name.includes('kg')) return 0;
    if (name.includes('10+2') || name.includes('12')) return 12;
    if (name.includes('10+1') || name.includes('11')) return 11;
    const match = name.match(/(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return cls.displayOrder || 0;
  }

  get destinationClasses(): SchoolClassDto[] {
    if (!this.fromClassId) return [];
    const fromCls = this.classes.find(c => c.id === this.fromClassId);
    if (!fromCls) return [];
    const fromRank = this.getClassRank(fromCls);
    return this.classes
      .filter(c => this.getClassRank(c) > fromRank)
      .sort((a, b) => this.getClassRank(a) - this.getClassRank(b));
  }

  loadClasses(): void {
    this.schoolService.getClasses(true).subscribe({
      next: (res) => {
        this.classes = res.sort((a, b) => this.getClassRank(a) - this.getClassRank(b));
        // Auto-select first class as From and next higher as To if available
        if (this.classes.length > 0) {
          if (!this.fromClassId) {
            this.fromClassId = this.classes[0].id;
          }
          this.onFromClassChange(this.fromClassId);
        }
      }
    });
  }

  onFromClassChange(classId: string): void {
    this.candidatesLoaded = false;
    this.fromSectionId = '';
    this.selectedExamId = '';
    this.schoolService.getSections(classId).subscribe({
      next: (sections) => {
        this.fromSections = sections;
      }
    });
    this.loadClassExams();

    // Auto suggest immediate next higher class
    const available = this.destinationClasses;
    if (available.length > 0) {
      this.toClassId = available[0].id;
      this.onToClassChange(this.toClassId);
    } else {
      this.toClassId = '';
      this.toSections = [];
      this.toSectionId = '';
    }
  }

  loadClassExams(): void {
    if (!this.fromClassId) {
      this.availableExams = [];
      this.selectedExamId = '';
      return;
    }
    this.schoolService.getClassExams(this.fromClassId, this.fromAcademicYear).subscribe({
      next: (exams) => {
        this.availableExams = exams;
        const annual = exams.find(e => e.examType?.toLowerCase().includes('annual') || e.title?.toLowerCase().includes('annual') || e.title?.toLowerCase().includes('final'));
        if (annual) {
          this.selectedExamId = annual.id;
        } else if (exams.length > 0) {
          this.selectedExamId = exams[0].id;
        } else {
          this.selectedExamId = '';
        }
      },
      error: () => {
        this.availableExams = [];
        this.selectedExamId = '';
      }
    });
  }

  onFromSectionChange(): void {
    this.candidatesLoaded = false;
  }

  onToClassChange(classId: string): void {
    this.toSectionId = '';
    this.schoolService.getSections(classId).subscribe({
      next: (sections) => {
        this.toSections = sections;
        if (sections.length > 0) {
          this.toSectionId = sections[0].id;
        }
      }
    });
  }

  loadCandidates(): void {
    if (!this.fromClassId) return;

    this.loadingCandidates = true;
    this.schoolService.getPromotionCandidates(
      this.fromClassId,
      this.fromSectionId || undefined,
      this.fromAcademicYear,
      this.selectedExamId || undefined,
      this.passingPercentage
    ).subscribe({
      next: (res) => {
        this.loadingCandidates = false;
        let rollCounter = 1;
        this.candidates = res.map((c) => {
          const autoStatus: 'Promoted' | 'Detained' = (c.suggestedStatus as any) || (c.examResultStatus === 'Failed' || c.examResultStatus === 'Absent' ? 'Detained' : 'Promoted');
          const isDetained = autoStatus === 'Detained';
          const roll = isDetained ? (c.schoolRollNumber || c.currentRollNumber || '') : (rollCounter++).toString();

          return {
            ...c,
            selected: true,
            resultStatus: autoStatus,
            newRollNumber: roll,
            remarks: c.examResultStatus && c.examResultStatus !== 'No Exam Record'
              ? `Annual Exam: ${c.examResultStatus} (${c.examPercentage || 0}%, Grade: ${c.examGrade || '-'})`
              : ''
          };
        });
        this.candidatesLoaded = true;
      },
      error: (err) => {
        this.loadingCandidates = false;
        this.confirmDialog.alert('Load Failed', err?.error?.message || 'Failed to load candidates for promotion.', 'danger');
      }
    });
  }

  get filteredCandidates(): CandidateRow[] {
    if (!this.searchTerm.trim()) return this.candidates;
    const term = this.searchTerm.toLowerCase().trim();
    return this.candidates.filter(c =>
      c.studentName.toLowerCase().includes(term) ||
      c.admissionNumber.toLowerCase().includes(term) ||
      (c.schoolRollNumber && c.schoolRollNumber.toLowerCase().includes(term))
    );
  }

  // Selection helpers
  isAllSelected(): boolean {
    return this.candidates.length > 0 && this.candidates.every(c => c.selected);
  }

  isPartiallySelected(): boolean {
    return this.candidates.some(c => c.selected) && !this.isAllSelected();
  }

  toggleSelectAll(checked: boolean): void {
    this.candidates.forEach(c => c.selected = checked);
  }

  getSelectedCount(): number {
    return this.candidates.filter(c => c.selected).length;
  }

  getPromotedCount(): number {
    return this.candidates.filter(c => c.selected && c.resultStatus !== 'Detained').length;
  }

  getDetainedCount(): number {
    return this.candidates.filter(c => c.selected && c.resultStatus === 'Detained').length;
  }

  // Automation
  autoAssignRollNumbers(mode: 'alphabetical' | 'retain' | 'sequential'): void {
    if (mode === 'alphabetical') {
      const sorted = [...this.candidates].sort((a, b) => a.studentName.localeCompare(b.studentName));
      let roll = 1;
      sorted.forEach(c => {
        if (c.resultStatus !== 'Detained') {
          c.newRollNumber = (roll++).toString();
        }
      });
    } else if (mode === 'retain') {
      this.candidates.forEach(c => {
        if (c.resultStatus !== 'Detained') {
          c.newRollNumber = c.schoolRollNumber || c.currentRollNumber || '';
        }
      });
    } else if (mode === 'sequential') {
      let roll = 1;
      this.candidates.forEach(c => {
        if (c.resultStatus !== 'Detained') {
          c.newRollNumber = (roll++).toString();
        }
      });
    }
  }

  setBulkStatus(status: 'Promoted' | 'Detained' | 'Passed with Grace'): void {
    this.candidates.forEach(c => {
      if (c.selected) {
        c.resultStatus = status;
        if (status === 'Detained') {
          c.newRollNumber = c.schoolRollNumber || c.currentRollNumber;
        }
      }
    });
  }

  getToClassName(): string {
    const cls = this.classes.find(c => c.id === this.toClassId);
    return cls ? cls.name : 'Target Class';
  }

  getToSectionName(): string {
    const sec = this.toSections.find(s => s.id === this.toSectionId);
    return sec ? `(Sec ${sec.name})` : '';
  }

  getInitials(name: string): string {
    if (!name) return 'S';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  // Execution
  confirmAndExecutePromotion(): void {
    const selected = this.candidates.filter(c => c.selected);
    if (selected.length === 0) {
      this.confirmDialog.alert('No Selection', 'Please select at least one student for promotion.', 'warning');
      return;
    }

    const fromCls = this.classes.find(c => c.id === this.fromClassId);
    const toCls = this.classes.find(c => c.id === this.toClassId);

    if (!fromCls || !toCls) {
      this.confirmDialog.alert('Selection Error', 'Please select both Source Class and a valid higher Destination Class.', 'warning');
      return;
    }

    if (this.getClassRank(toCls) <= this.getClassRank(fromCls)) {
      this.confirmDialog.alert(
        'Invalid Promotion Target',
        `Destination class "${toCls.name}" must be a higher grade than source class "${fromCls.name}". Promoting to the same or a lower class is strictly not permitted.`,
        'danger'
      );
      return;
    }

    const fromClsName = fromCls.name;
    const toClsName = toCls.name;
    const promotedCnt = this.getPromotedCount();
    const detainedCnt = this.getDetainedCount();

    this.confirmDialog.confirm(
      'Confirm Class Promotion',
      `Are you sure you want to execute class promotion from "${fromClsName}" to "${toClsName}"?\n\n` +
      `• Total Selected: ${selected.length} students\n` +
      `• Promoted to ${toClsName}: ${promotedCnt} students\n` +
      `• Detained (Retained in ${fromClsName}): ${detainedCnt} students\n` +
      `• Target Academic Session: ${this.toAcademicYear}\n\n` +
      `This will update the students' class and section allocations while archiving full transition history.`,
      'Confirm & Promote Now',
      'Cancel',
      'info'
    ).subscribe((confirmed) => {
      if (!confirmed) return;

      this.executing = true;
      const payload: ExecutePromotionRequestDto = {
        fromClassId: this.fromClassId,
        fromSectionId: this.fromSectionId || undefined,
        fromAcademicYear: this.fromAcademicYear,
        toClassId: this.toClassId,
        toSectionId: this.toSectionId || undefined,
        toAcademicYear: this.toAcademicYear,
        promotions: selected.map(c => ({
          studentId: c.studentId,
          resultStatus: c.resultStatus,
          newRollNumber: c.newRollNumber,
          remarks: c.remarks || undefined,
          examPercentage: c.examPercentage,
          examTotalMarks: c.examMarksObtained !== undefined && c.examMaxMarks ? `${c.examMarksObtained}/${c.examMaxMarks}` : undefined,
          examGrade: c.examGrade,
          examResultStatus: c.examResultStatus
        }))
      };

      this.schoolService.executePromotion(payload).subscribe({
        next: (res) => {
          this.executing = false;
          this.confirmDialog.alert('Promotion Completed! 🎉', res.message, 'success');
          this.candidatesLoaded = false;
          this.loadCandidates();
        },
        error: (err) => {
          this.executing = false;
          this.confirmDialog.alert('Promotion Failed', err?.error?.message || 'Failed to execute promotion.', 'danger');
        }
      });
    });
  }

  // History Tab
  onTabChange(tabIndex: number): void {
    if (tabIndex === 1 && this.historyItems.length === 0) {
      this.loadHistory();
    }
  }

  loadHistory(): void {
    this.loadingHistory = true;
    this.schoolService.getPromotionHistory(
      this.historyFilterClassId || undefined,
      this.historyFilterYear || undefined
    ).subscribe({
      next: (res) => {
        this.loadingHistory = false;
        this.historyItems = res.items;
      },
      error: () => {
        this.loadingHistory = false;
      }
    });
  }

  revertSingleHistory(h: StudentPromotionHistoryDto): void {
    this.confirmDialog.danger(
      'Rollback Promotion',
      `Are you sure you want to rollback promotion for "${h.studentName}" back to "${h.fromClassName}"?`
    ).subscribe((confirmed) => {
      if (!confirmed) return;

      this.schoolService.revertPromotion([h.id]).subscribe({
        next: (res) => {
          this.confirmDialog.alert('Rollback Success', res.message, 'success');
          this.loadHistory();
        },
        error: (err) => {
          this.confirmDialog.alert('Rollback Failed', err?.error?.message || 'Failed to revert promotion.', 'danger');
        }
      });
    });
  }
}
