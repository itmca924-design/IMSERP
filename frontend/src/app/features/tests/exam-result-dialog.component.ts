import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { CoachingService } from '../../core/services/coaching.service';
import { AuthService } from '../../core/services/auth.service';

export interface ExamResultDialogData {
  testId: string;
  testTitle?: string;
  subject?: string;
  maxMarks?: number;
  batchName?: string;
  testDate?: string;
}

interface StudentRankRow {
  studentId: string;
  studentName: string;
  rollNumber: string;
  marksObtained: number;
  percentage: number;
  rank: number;
  isAbsent: boolean;
  remarks: string;
  grade: string;
  gradeClass: string;
  parentWhatsAppPhone?: string;
  parentName?: string;
  className?: string;
  sectionName?: string;
  batchName?: string;
  isSchoolStudent?: boolean;
  isCoachingStudent?: boolean;
  enrollmentType?: string;
  schoolRollNumber?: string;
  coachingRollNumber?: string;
}

@Component({
  selector: 'app-exam-result-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatChipsModule,
    MatDividerModule
  ],
  template: `
    <div class="result-modal-container">

      <!-- ═══════════════════════════════════════════════ -->
      <!-- MODAL TOOLBAR (hidden on print)                 -->
      <!-- ═══════════════════════════════════════════════ -->
      <div class="modal-actions no-print">
        <div class="modal-title">
          <div class="title-badge">
            <mat-icon>emoji_events</mat-icon>
          </div>
          <div class="title-text-group">
            <div class="title-row">
              <span class="main-title">Exam Result &amp; Report Cards</span>
              <span class="exam-title-badge" *ngIf="data.testTitle">{{ data.testTitle }}</span>
            </div>
            <span class="sub-title">
              <span class="meta-item"><mat-icon class="sub-icon">class</mat-icon>{{ data.batchName || 'Batch' }}</span>
              <span class="meta-dot">&bull;</span>
              <span class="meta-item"><mat-icon class="sub-icon">subject</mat-icon>{{ data.subject || 'Subject' }}</span>
              <span class="meta-dot">&bull;</span>
              <span class="meta-item">Max: {{ data.maxMarks }} Marks</span>
            </span>
          </div>
        </div>

        <div class="btn-group">
          <!-- View Toggle Tabs -->
          <div class="view-toggle-group">
            <button type="button" class="view-tab" [class.active]="viewMode === 'leaderboard'" (click)="viewMode = 'leaderboard'">
              <mat-icon>leaderboard</mat-icon> Leaderboard
            </button>
            <button type="button" class="view-tab" [class.active]="viewMode === 'cards'" (click)="viewMode = 'cards'">
              <mat-icon>badge</mat-icon> Result Cards
            </button>
          </div>

          <div class="header-divider"></div>

          <!-- WhatsApp Summary Button -->
          <button mat-flat-button class="header-action-btn wa-btn" (click)="shareClassSummaryWhatsApp()"
                  *ngIf="rankedList.length > 0" matTooltip="Share Performance Summary on WhatsApp">
            <svg class="wa-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            <span>WhatsApp Summary</span>
          </button>

          <!-- Print Button -->
          <button mat-flat-button class="header-action-btn print-btn" (click)="printResults()" matTooltip="Print Result / Cards">
            <mat-icon>print</mat-icon>
            <span>Print</span>
          </button>

          <!-- Close Button -->
          <button mat-icon-button class="header-close-btn" [mat-dialog-close]="null" matTooltip="Close (Esc)">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Loading -->
      <mat-progress-bar mode="indeterminate" *ngIf="loading" class="top-loader no-print"></mat-progress-bar>

      <!-- ═══════════════════════════════════════════════ -->
      <!-- STATS SUMMARY BAR                               -->
      <!-- ═══════════════════════════════════════════════ -->
      <div class="stats-bar no-print" *ngIf="!loading && rankedList.length > 0">
        <div class="stat-chip stat-total">
          <mat-icon>group</mat-icon>
          <div>
            <span class="stat-num">{{ totalAppeared }}</span>
            <span class="stat-lbl">Appeared</span>
          </div>
        </div>
        <div class="stat-chip stat-topper">
          <mat-icon>military_tech</mat-icon>
          <div>
            <span class="stat-num">{{ topperMarks }}<span class="stat-denom">/{{ data.maxMarks }}</span></span>
            <span class="stat-lbl">Highest</span>
          </div>
        </div>
        <div class="stat-chip stat-avg">
          <mat-icon>analytics</mat-icon>
          <div>
            <span class="stat-num">{{ averageMarks | number:'1.1-1' }}</span>
            <span class="stat-lbl">Average</span>
          </div>
        </div>
        <div class="stat-chip stat-pass">
          <mat-icon>check_circle</mat-icon>
          <div>
            <span class="stat-num">{{ passCount }}</span>
            <span class="stat-lbl">Passed</span>
          </div>
        </div>
        <div class="stat-chip stat-absent">
          <mat-icon>person_off</mat-icon>
          <div>
            <span class="stat-num">{{ absentCount }}</span>
            <span class="stat-lbl">Absent</span>
          </div>
        </div>
        <div class="stat-chip stat-pass-pct">
          <mat-icon>percent</mat-icon>
          <div>
            <span class="stat-num">{{ passPercentage | number:'1.0-0' }}%</span>
            <span class="stat-lbl">Pass Rate</span>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════ -->
      <!-- VIEW: LEADERBOARD TABLE                         -->
      <!-- ═══════════════════════════════════════════════ -->
      <div class="leaderboard-wrap" *ngIf="viewMode === 'leaderboard' && !loading">

        <!-- Print-only header (shown only when printing) -->
        <div class="print-page-header print-only">
          <div class="print-institute-name">{{ instituteName }}</div>
          <div class="print-exam-title">{{ data.testTitle }} — Result Sheet</div>
          <div class="print-meta">Batch: {{ data.batchName }} &nbsp;|&nbsp; Subject: {{ data.subject }} &nbsp;|&nbsp; Max Marks: {{ data.maxMarks }}</div>
        </div>

        <div class="no-data-state" *ngIf="rankedList.length === 0">
          <div class="no-data-icon-box">
            <mat-icon>assignment_late</mat-icon>
          </div>
          <p>No marks have been entered for this exam yet.</p>
          <span>Use &ldquo;Enter Marks&rdquo; on the Tests page to record student scores first.</span>
        </div>

        <div class="leaderboard-table-wrap" *ngIf="rankedList.length > 0">
          <table class="leaderboard-table">
            <thead>
              <tr>
                <th class="col-rank">Rank</th>
                <th class="col-roll">Roll No.</th>
                <th class="col-name">Student Name</th>
                <th class="col-class">Class / Stream</th>
                <th class="col-marks">Marks</th>
                <th class="col-pct">%</th>
                <th class="col-grade">Grade</th>
                <th class="col-status">Status</th>
                <th class="col-remarks no-print">Remarks</th>
                <th class="col-actions no-print">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of rankedList"
                  [class.row-gold]="s.rank === 1 && !s.isAbsent"
                  [class.row-silver]="s.rank === 2 && !s.isAbsent"
                  [class.row-bronze]="s.rank === 3 && !s.isAbsent"
                  [class.row-absent]="s.isAbsent">
                <!-- Rank -->
                <td class="col-rank">
                  <span class="rank-badge" *ngIf="!s.isAbsent && s.rank === 1">🥇 1</span>
                  <span class="rank-badge" *ngIf="!s.isAbsent && s.rank === 2">🥈 2</span>
                  <span class="rank-badge" *ngIf="!s.isAbsent && s.rank === 3">🥉 3</span>
                  <span class="rank-num"   *ngIf="!s.isAbsent && s.rank > 3">#{{ s.rank }}</span>
                  <span class="rank-absent" *ngIf="s.isAbsent">—</span>
                </td>
                <!-- Roll No -->
                <td class="col-roll">
                  <span class="roll-tag">{{ s.rollNumber || '—' }}</span>
                </td>
                <!-- Name -->
                <td class="col-name">
                  <div class="name-cell">
                    <span class="avatar-letter" [class.avatar-absent]="s.isAbsent">
                      {{ s.studentName.charAt(0).toUpperCase() }}
                    </span>
                    <div class="name-and-parent">
                      <span class="student-name">{{ s.studentName }}</span>
                      <span class="parent-sub" *ngIf="s.parentName">S/O, D/O: {{ s.parentName }}</span>
                    </div>
                  </div>
                </td>
                <!-- Class / Stream -->
                <td class="col-class">
                  <div class="class-stream-cell">
                    <!-- Dual enrolled (School + Coaching) -->
                    <ng-container *ngIf="s.isSchoolStudent && s.isCoachingStudent">
                      <span class="stream-pill dual-pill">
                        <mat-icon class="pill-icon">verified</mat-icon> School + Coaching
                      </span>
                      <div class="stream-meta-rows">
                        <div class="meta-row school-row" *ngIf="s.className">
                          <mat-icon class="meta-icon">domain</mat-icon>
                          <span class="meta-title">{{ s.className }}</span>
                          <span class="sec-badge" *ngIf="s.sectionName">{{ s.sectionName }}</span>
                        </div>
                        <div class="meta-row coaching-row" *ngIf="s.batchName">
                          <mat-icon class="meta-icon">school</mat-icon>
                          <span class="meta-title">{{ s.batchName }}</span>
                        </div>
                      </div>
                    </ng-container>

                    <!-- School Only -->
                    <ng-container *ngIf="s.isSchoolStudent && !s.isCoachingStudent">
                      <span class="stream-pill school-pill">
                        <mat-icon class="pill-icon">domain</mat-icon> School
                      </span>
                      <div class="stream-meta-rows">
                        <div class="meta-row school-row">
                          <mat-icon class="meta-icon">domain</mat-icon>
                          <span class="meta-title">{{ s.className || 'School' }}</span>
                          <span class="sec-badge" *ngIf="s.sectionName">{{ s.sectionName }}</span>
                        </div>
                      </div>
                    </ng-container>

                    <!-- Coaching Only -->
                    <ng-container *ngIf="!s.isSchoolStudent && s.isCoachingStudent">
                      <span class="stream-pill coaching-pill">
                        <mat-icon class="pill-icon">school</mat-icon> Coaching
                      </span>
                      <div class="stream-meta-rows">
                        <div class="meta-row coaching-row">
                          <mat-icon class="meta-icon">school</mat-icon>
                          <span class="meta-title">{{ s.batchName || data.batchName || 'Coaching Batch' }}</span>
                        </div>
                      </div>
                    </ng-container>

                    <!-- Fallback / Neither explicit -->
                    <ng-container *ngIf="!s.isSchoolStudent && !s.isCoachingStudent">
                      <div class="stream-meta-rows">
                        <div class="meta-row">
                          <mat-icon class="meta-icon">class</mat-icon>
                          <span class="meta-title">{{ s.className || s.batchName || data.batchName || '—' }}</span>
                          <span class="sec-badge" *ngIf="s.sectionName">{{ s.sectionName }}</span>
                        </div>
                      </div>
                    </ng-container>
                  </div>
                </td>
                <!-- Marks -->
                <td class="col-marks">
                  <span *ngIf="!s.isAbsent" class="marks-val">{{ s.marksObtained }}</span>
                  <span *ngIf="s.isAbsent" class="absent-label">AB</span>
                </td>
                <!-- Percentage -->
                <td class="col-pct">
                  <span *ngIf="!s.isAbsent" class="pct-val">{{ s.percentage | number:'1.1-1' }}%</span>
                  <span *ngIf="s.isAbsent">—</span>
                </td>
                <!-- Grade -->
                <td class="col-grade">
                  <span *ngIf="!s.isAbsent" class="grade-badge" [ngClass]="s.gradeClass">{{ s.grade }}</span>
                  <span *ngIf="s.isAbsent">—</span>
                </td>
                <!-- Status -->
                <td class="col-status">
                  <span *ngIf="s.isAbsent" class="status-badge status-absent">Absent</span>
                  <span *ngIf="!s.isAbsent && s.percentage >= 35" class="status-badge status-pass">Pass</span>
                  <span *ngIf="!s.isAbsent && s.percentage < 35" class="status-badge status-fail">Fail</span>
                </td>
                <!-- Remarks -->
                <td class="col-remarks no-print">
                  <span class="remarks-text">{{ s.remarks || '—' }}</span>
                </td>
                <!-- Actions -->
                <td class="col-actions no-print">
                  <div class="row-act-btns">
                    <button mat-icon-button class="mini-wa-btn" (click)="shareWhatsApp(s)"
                            [disabled]="!s.parentWhatsAppPhone" matTooltip="WhatsApp Result to Parent">
                      <mat-icon>chat</mat-icon>
                    </button>
                    <button mat-icon-button class="mini-print-btn" (click)="printSingleCard(s)"
                            matTooltip="Print Individual Card">
                      <mat-icon>print</mat-icon>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Print footer -->
        <div class="print-footer print-only" *ngIf="rankedList.length > 0">
          <div class="print-stats-row">
            <span>Total Appeared: {{ totalAppeared }}</span>
            <span>Highest: {{ topperMarks }}/{{ data.maxMarks }}</span>
            <span>Average: {{ averageMarks | number:'1.1-1' }}</span>
            <span>Pass: {{ passCount }} ({{ passPercentage | number:'1.0-0' }}%)</span>
            <span>Absent: {{ absentCount }}</span>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════ -->
      <!-- VIEW: INDIVIDUAL RESULT CARDS (Print per card)  -->
      <!-- ═══════════════════════════════════════════════ -->
      <div class="result-cards-wrap" *ngIf="viewMode === 'cards' && !loading">

        <div class="no-data-state" *ngIf="rankedList.length === 0">
          <div class="no-data-icon-box">
            <mat-icon>assignment_late</mat-icon>
          </div>
          <p>No marks have been entered for this exam yet.</p>
          <span>Use &ldquo;Enter Marks&rdquo; on the Tests page to record student scores first.</span>
        </div>

        <div class="cards-grid" *ngIf="rankedList.length > 0">
          <div class="result-card" *ngFor="let s of rankedList">

            <!-- Card Header -->
            <div class="rc-header">
              <div class="rc-logo-area">
                <img *ngIf="logoUrl && !logoFailed" [src]="logoUrl" (error)="logoFailed = true" class="rc-inst-logo" alt="Logo" />
                <div class="rc-logo-circle" *ngIf="!logoUrl || logoFailed">
                  <mat-icon>school</mat-icon>
                </div>
              </div>
              <div class="rc-institute-info">
                <div class="rc-institute-name">{{ instituteName }}</div>
                <div class="rc-card-type">Official Student Result &amp; Performance Card</div>
              </div>
              <div class="rc-grade-seal" [ngClass]="s.isAbsent ? 'seal-absent' : s.gradeClass">
                <span class="seal-grade">{{ s.isAbsent ? 'AB' : s.grade }}</span>
                <span class="seal-label">Grade</span>
              </div>
            </div>

            <div class="rc-divider"></div>

            <!-- Student Info -->
            <div class="rc-student-section">
              <div class="rc-avatar" [class.rc-avatar-absent]="s.isAbsent">
                {{ s.studentName.charAt(0).toUpperCase() }}
              </div>
              <div class="rc-student-details">
                <div class="rc-student-name">{{ s.studentName }}</div>
                <div class="rc-meta-row">
                  <span class="rc-meta-pill"><mat-icon>badge</mat-icon>Roll: {{ s.rollNumber || 'N/A' }}</span>
                  <span class="rc-meta-pill stream-dual-pill" *ngIf="s.isSchoolStudent && s.isCoachingStudent">
                    <mat-icon>verified</mat-icon>School + Coaching
                  </span>
                  <span class="rc-meta-pill stream-school-pill" *ngIf="s.className">
                    <mat-icon>domain</mat-icon>{{ s.className }}<span *ngIf="s.sectionName"> ({{ s.sectionName }})</span>
                  </span>
                  <span class="rc-meta-pill"><mat-icon>school</mat-icon>{{ s.batchName || data.batchName }}</span>
                  <span class="rc-meta-pill" *ngIf="s.parentName"><mat-icon>person</mat-icon>{{ s.parentName }}</span>
                </div>
              </div>
            </div>

            <!-- Exam Details -->
            <div class="rc-exam-section">
              <div class="rc-exam-detail"><span class="rc-label">Exam</span><span class="rc-val">{{ data.testTitle }}</span></div>
              <div class="rc-exam-detail"><span class="rc-label">Subject</span><span class="rc-val">{{ data.subject }}</span></div>
              <div class="rc-exam-detail"><span class="rc-label">Max Marks</span><span class="rc-val">{{ data.maxMarks }}</span></div>
            </div>

            <div class="rc-divider"></div>

            <!-- Score Display -->
            <div class="rc-score-section">
              <div class="rc-score-box" *ngIf="!s.isAbsent">
                <div class="rc-score-label">Marks Obtained</div>
                <div class="rc-score-main">
                  <span class="rc-score-num">{{ s.marksObtained }}</span>
                  <span class="rc-score-max">/ {{ data.maxMarks }}</span>
                </div>
                <div class="rc-score-bar">
                  <div class="rc-score-fill" [style.width.%]="s.percentage"
                       [class.fill-excellent]="s.percentage >= 85"
                       [class.fill-good]="s.percentage >= 60 && s.percentage < 85"
                       [class.fill-average]="s.percentage >= 35 && s.percentage < 60"
                       [class.fill-fail]="s.percentage < 35"></div>
                </div>
              </div>
              <div class="rc-score-box rc-absent-box" *ngIf="s.isAbsent">
                <mat-icon>person_off</mat-icon>
                <div class="rc-absent-text">Absent</div>
              </div>

              <div class="rc-score-stats" *ngIf="!s.isAbsent">
                <div class="rc-stat">
                  <span class="rc-stat-val">{{ s.percentage | number:'1.1-1' }}%</span>
                  <span class="rc-stat-lbl">Percentage</span>
                </div>
                <div class="rc-stat rc-stat-rank">
                  <span class="rc-stat-val rank-val">#{{ s.rank }}</span>
                  <span class="rc-stat-lbl">Class Rank</span>
                </div>
                <div class="rc-stat">
                  <span class="rc-stat-val">{{ averageMarks | number:'1.1-1' }}</span>
                  <span class="rc-stat-lbl">Class Avg</span>
                </div>
              </div>
            </div>

            <!-- Status + Remarks -->
            <div class="rc-footer-row">
              <span class="rc-status-chip"
                    [class.chip-pass]="!s.isAbsent && s.percentage >= 35"
                    [class.chip-fail]="!s.isAbsent && s.percentage < 35"
                    [class.chip-absent]="s.isAbsent">
                <mat-icon>{{ s.isAbsent ? 'person_off' : (s.percentage >= 35 ? 'verified' : 'cancel') }}</mat-icon>
                {{ s.isAbsent ? 'Absent' : (s.percentage >= 35 ? 'Passed' : 'Needs Improvement') }}
              </span>
              <span class="rc-remarks" *ngIf="s.remarks">{{ s.remarks }}</span>
            </div>

            <!-- Card Actions (no-print) -->
            <div class="rc-card-actions no-print">
              <button mat-stroked-button class="card-wa-btn" (click)="shareWhatsApp(s)"
                      [disabled]="!s.parentWhatsAppPhone" matTooltip="Send to Parent on WhatsApp">
                <mat-icon>chat</mat-icon> WhatsApp
              </button>
              <button mat-stroked-button class="card-p-btn" (click)="printSingleCard(s)"
                      matTooltip="Print this Card Only">
                <mat-icon>print</mat-icon> Print
              </button>
            </div>

            <div class="rc-sign-area print-only">
              <div class="rc-sign-box">
                <div class="rc-sign-line"></div>
                <div class="rc-sign-label">Class Teacher</div>
              </div>
              <div class="rc-sign-box">
                <div class="rc-sign-line"></div>
                <div class="rc-sign-label">Principal / Director</div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    :host {
      display: block;
      font-family: inherit;
      color: #1e293b;
    }

    .result-modal-container {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      overflow: hidden;
      background: #f8fafc;
      width: 100%;
    }

    /* ─── Top Toolbar (Fee Collection Style Light Header) ─── */
    .modal-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
      gap: 16px;
      min-height: 62px;
      box-sizing: border-box;
    }
    .modal-title {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex: 1 1 auto;
    }
    .title-badge {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 4px 10px rgba(245, 158, 11, 0.25);
      mat-icon { font-size: 22px; width: 22px; height: 22px; }
    }
    .title-text-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .main-title {
      font-size: 1.08rem;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.01em;
      white-space: nowrap;
    }
    .exam-title-badge {
      font-size: 0.72rem;
      font-weight: 700;
      background: #eff6ff;
      color: #2563eb;
      padding: 2px 8px;
      border-radius: 5px;
      border: 1px solid #bfdbfe;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
    .sub-title {
      font-size: 0.78rem;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;

      .meta-item {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; color: #64748b; }
      }
      .meta-dot { color: #cbd5e1; font-weight: bold; }
    }

    .btn-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    /* Segmented View Switcher (Leaderboard vs Cards) */
    .view-toggle-group {
      display: flex;
      background: #e2e8f0;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 3px;
      gap: 2px;

      .view-tab {
        border: none;
        background: transparent;
        padding: 5px 12px;
        border-radius: 6px;
        font-size: 0.78rem;
        font-weight: 600;
        color: #475569;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 5px;
        transition: all 0.15s ease;
        white-space: nowrap;

        mat-icon { font-size: 16px; width: 16px; height: 16px; color: #64748b; }

        &:hover {
          color: #0f172a;
          background: rgba(255, 255, 255, 0.6);
        }

        &.active {
          background: #ffffff;
          color: #2563eb;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
          font-weight: 700;
          mat-icon { color: #2563eb; }
        }
      }
    }

    .header-divider {
      width: 1px;
      height: 24px;
      background: #cbd5e1;
      margin: 0 2px;
    }

    .header-action-btn {
      height: 35px !important;
      padding: 0 12px !important;
      border-radius: 7px !important;
      font-size: 0.78rem !important;
      font-weight: 600 !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      letter-spacing: 0.02em !important;
      white-space: nowrap !important;
      transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease !important;

      mat-icon { font-size: 16px; width: 16px; height: 16px; }

      &.wa-btn {
        background: #16a34a !important;
        color: #ffffff !important;
        box-shadow: 0 2px 6px rgba(22, 163, 74, 0.25);
        .wa-icon { width: 15px; height: 15px; fill: #ffffff; }
        &:hover {
          background: #15803d !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(22, 163, 74, 0.35);
        }
      }

      &.print-btn {
        background: #0284c7 !important;
        color: #ffffff !important;
        box-shadow: 0 2px 6px rgba(2, 132, 199, 0.25);
        &:hover {
          background: #0369a1 !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(2, 132, 199, 0.35);
        }
      }
    }

    .header-close-btn {
      color: #64748b !important;
      width: 34px !important;
      height: 34px !important;
      border-radius: 7px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: all 0.15s ease !important;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
      &:hover {
        background: #fee2e2 !important;
        color: #dc2626 !important;
      }
    }

    /* ─── Stats Bar ─── */
    .stats-bar {
      display: flex;
      gap: 12px;
      padding: 12px 24px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      overflow-x: auto;
      flex-shrink: 0;
    }
    .stat-chip {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 0.8rem;
      flex-shrink: 0;
      border: 1px solid transparent;
      mat-icon { font-size: 22px; width: 22px; height: 22px; }
    }
    .stat-num {
      display: block;
      font-size: 1.1rem;
      font-weight: 800;
      line-height: 1.2;
    }
    .stat-denom {
      font-size: 0.8rem;
      font-weight: 500;
      color: #64748b;
    }
    .stat-lbl {
      display: block;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.85;
    }
    .stat-total   { background: #eff6ff; color: #1d4ed8; border-color: #dbeafe; }
    .stat-topper  { background: #fefce8; color: #a16207; border-color: #fef08a; }
    .stat-avg     { background: #f5f3ff; color: #6d28d9; border-color: #ede9fe; }
    .stat-pass    { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
    .stat-absent  { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
    .stat-pass-pct{ background: #ecfeff; color: #0e7490; border-color: #cffafe; }

    /* ─── Leaderboard ─── */
    .leaderboard-wrap {
      padding: 20px 24px;
      overflow-y: auto;
      flex: 1;
    }
    .leaderboard-table-wrap {
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow-x: auto;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .leaderboard-table {
      width: 100%;
      min-width: 1020px;
      border-collapse: collapse;
      font-size: 0.88rem;

      thead th {
        background: #f8fafc;
        padding: 12px 14px;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #64748b;
        font-weight: 700;
        border-bottom: 2px solid #e2e8f0;
        text-align: left;
        white-space: nowrap;
      }
      tbody tr {
        border-bottom: 1px solid #f1f5f9;
        transition: background 0.12s ease;
        &:hover { background: #f8fafc; }
        &.row-gold   { background: #fffdf0; }
        &.row-silver { background: #fbfbfb; }
        &.row-bronze { background: #fff9f5; }
        &.row-absent { opacity: 0.65; background: #fafafa; }
      }
      tbody td {
        padding: 11px 14px;
        vertical-align: middle;
      }
    }

    .col-rank   { width: 65px; }
    .col-roll   { width: 95px; }
    .col-name   { min-width: 170px; }
    .col-class  { min-width: 190px; }
    .col-marks  { width: 85px; }
    .col-pct    { width: 75px; }
    .col-grade  { width: 70px; }
    .col-status { width: 85px; }
    .col-remarks{ width: 120px; }
    .col-actions{ width: 100px; text-align: right; min-width: 100px; padding-right: 20px !important; }

    /* Class & Stream Styling */
    .class-stream-cell {
      display: flex;
      flex-direction: column;
      gap: 5px;
      align-items: flex-start;
      min-width: 0;
    }
    .stream-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.70rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 9999px;
      letter-spacing: 0.02em;
      white-space: nowrap;

      .pill-icon {
        font-size: 12px;
        width: 12px;
        height: 12px;
      }
      &.dual-pill {
        background: #fdf4ff;
        color: #9333ea;
        border: 1px solid #f0abfc;
      }
      &.school-pill {
        background: #f0fdf4;
        color: #16a34a;
        border: 1px solid #bbf7d0;
      }
      &.coaching-pill {
        background: #eff6ff;
        color: #2563eb;
        border: 1px solid #bfdbfe;
      }
    }
    .stream-meta-rows {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 0.78rem;

      .meta-row {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: #334155;

        .meta-icon {
          font-size: 13px;
          width: 13px;
          height: 13px;
          flex-shrink: 0;
        }
        &.school-row {
          color: #047857;
          font-weight: 600;
          .meta-icon { color: #10b981; }
        }
        &.coaching-row {
          color: #4338ca;
          font-weight: 500;
          .meta-icon { color: #6366f1; }
        }
        .meta-title {
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 170px;
        }
        .sec-badge {
          background: #ecfdf5;
          color: #065f46;
          border: 1px solid #a7f3d0;
          border-radius: 3px;
          padding: 1px 4px;
          font-size: 0.68rem;
          font-weight: 700;
          margin-left: 2px;
        }
      }
    }
    .stream-dual-pill {
      background: #fdf4ff !important;
      color: #9333ea !important;
      border: 1px solid #f0abfc !important;
    }
    .stream-school-pill {
      background: #f0fdf4 !important;
      color: #16a34a !important;
      border: 1px solid #bbf7d0 !important;
    }

    .rank-badge {
      font-size: 0.88rem;
      font-weight: 700;
      white-space: nowrap;
    }
    .rank-num {
      font-size: 0.82rem;
      font-weight: 600;
      color: #64748b;
    }
    .rank-absent { color: #94a3b8; }
    .roll-tag {
      font-size: 0.78rem;
      font-family: monospace;
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      color: #475569;
    }
    .name-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .avatar-letter {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      color: #ffffff;
      font-weight: 700;
      font-size: 0.8rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      &.avatar-absent {
        background: #94a3b8;
      }
    }
    .name-and-parent {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .student-name {
      font-weight: 600;
      color: #0f172a;
    }
    .parent-sub {
      font-size: 0.74rem;
      color: #64748b;
    }
    .marks-val {
      font-weight: 700;
      color: #0f172a;
      font-size: 0.92rem;
    }
    .absent-label {
      font-weight: 700;
      color: #ef4444;
      font-size: 0.82rem;
    }
    .pct-val {
      font-weight: 600;
      color: #475569;
    }
    .grade-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .grade-a-plus { background: #dcfce7; color: #15803d; }
    .grade-a      { background: #dbeafe; color: #1d4ed8; }
    .grade-b      { background: #e0e7ff; color: #4338ca; }
    .grade-c      { background: #fef9c3; color: #a16207; }
    .grade-d      { background: #ffedd5; color: #c2410c; }
    .grade-f      { background: #fee2e2; color: #b91c1c; }

    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 0.74rem;
      font-weight: 600;
    }
    .status-pass   { background: #dcfce7; color: #15803d; }
    .status-fail   { background: #fee2e2; color: #dc2626; }
    .status-absent { background: #f3f4f6; color: #6b7280; }
    .remarks-text  { font-size: 0.78rem; color: #64748b; font-style: italic; }

    .row-act-btns {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
    }
    .mini-wa-btn,
    .mini-print-btn {
      width: 32px !important;
      height: 32px !important;
      min-width: 32px !important;
      min-height: 32px !important;
      max-width: 32px !important;
      max-height: 32px !important;
      padding: 0 !important;
      margin: 0 !important;
      border-radius: 50% !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      box-sizing: border-box !important;
      transition: all 0.18s ease-in-out !important;

      ::ng-deep .mat-mdc-button-touch-target {
        display: none !important;
      }

      mat-icon {
        font-size: 18px !important;
        width: 18px !important;
        height: 18px !important;
        line-height: 18px !important;
        margin: 0 !important;
        padding: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
    }
    .mini-wa-btn {
      color: #059669 !important;
      &:hover:not(:disabled) {
        background: #dcfce7 !important;
        box-shadow: 0 2px 8px rgba(5, 150, 105, 0.25) !important;
      }
      &:disabled {
        opacity: 0.35 !important;
        cursor: not-allowed !important;
      }
    }
    .mini-print-btn {
      color: #0284c7 !important;
      &:hover:not(:disabled) {
        background: #e0f2fe !important;
        box-shadow: 0 2px 8px rgba(2, 132, 199, 0.25) !important;
      }
    }

    /* ─── Result Cards Grid ─── */
    .result-cards-wrap {
      padding: 20px 24px;
      overflow-y: auto;
      flex: 1;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
    }
    .result-card {
      background: #ffffff;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      display: flex;
      flex-direction: column;
      gap: 14px;
      position: relative;
      transition: box-shadow 0.15s ease;
      &:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
    }
    .rc-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .rc-logo-area {
      flex-shrink: 0;
    }
    .rc-inst-logo {
      height: 38px;
      width: auto;
      max-width: 70px;
      object-fit: contain;
    }
    .rc-logo-circle {
      width: 38px;
      height: 38px;
      border-radius: 8px;
      background: #eff6ff;
      color: #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }
    .rc-institute-info {
      flex: 1;
      min-width: 0;
    }
    .rc-institute-name {
      font-size: 0.88rem;
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .rc-card-type {
      font-size: 0.72rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .rc-grade-seal {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 2px solid currentColor;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .seal-grade {
      font-size: 1rem;
      font-weight: 800;
      line-height: 1;
    }
    .seal-label {
      font-size: 0.55rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.85;
    }
    .seal-absent { color: #94a3b8; border-color: #cbd5e1; }

    .rc-divider {
      height: 1px;
      background: #f1f5f9;
    }

    .rc-student-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .rc-avatar {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #4338ca);
      color: #ffffff;
      font-size: 1rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      &.rc-avatar-absent { background: #94a3b8; }
    }
    .rc-student-details {
      flex: 1;
      min-width: 0;
    }
    .rc-student-name {
      font-size: 0.96rem;
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .rc-meta-row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 4px;
    }
    .rc-meta-pill {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 0.74rem;
      background: #f1f5f9;
      color: #475569;
      padding: 2px 7px;
      border-radius: 4px;
      mat-icon { font-size: 12px; width: 12px; height: 12px; }
    }

    .rc-exam-section {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px;
      background: #f8fafc;
      border-radius: 8px;
      padding: 8px 12px;
    }
    .rc-exam-detail {
      display: flex;
      flex-direction: column;
    }
    .rc-label {
      font-size: 0.68rem;
      text-transform: uppercase;
      color: #94a3b8;
      font-weight: 600;
    }
    .rc-val {
      font-size: 0.8rem;
      font-weight: 600;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .rc-score-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .rc-score-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px;
      text-align: center;
      &.rc-absent-box {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        color: #ef4444;
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
        .rc-absent-text { font-size: 1rem; font-weight: 700; }
      }
    }
    .rc-score-label {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .rc-score-main {
      display: flex;
      align-items: baseline;
      justify-content: center;
      gap: 4px;
    }
    .rc-score-num {
      font-size: 1.8rem;
      font-weight: 800;
      color: #0f172a;
      line-height: 1;
    }
    .rc-score-max {
      font-size: 0.92rem;
      color: #64748b;
      font-weight: 500;
    }
    .rc-score-bar {
      height: 6px;
      background: #e2e8f0;
      border-radius: 3px;
      overflow: hidden;
      margin-top: 8px;
    }
    .rc-score-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s ease;
      &.fill-excellent { background: #10b981; }
      &.fill-good      { background: #3b82f6; }
      &.fill-average   { background: #f59e0b; }
      &.fill-fail      { background: #ef4444; }
    }

    .rc-score-stats {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px;
      text-align: center;
    }
    .rc-stat {
      background: #f8fafc;
      border-radius: 8px;
      padding: 6px 4px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .rc-stat-val {
      font-size: 0.95rem;
      font-weight: 700;
      color: #0f172a;
      &.rank-val { color: #f59e0b; }
    }
    .rc-stat-lbl {
      font-size: 0.66rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #64748b;
    }

    .rc-footer-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .rc-status-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.76rem;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 9999px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    .chip-pass   { background: #dcfce7; color: #15803d; }
    .chip-fail   { background: #fee2e2; color: #dc2626; }
    .chip-absent { background: #f3f4f6; color: #6b7280; }
    .rc-remarks  { font-size: 0.74rem; color: #64748b; font-style: italic; }

    .rc-card-actions {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }
    .card-wa-btn {
      flex: 1;
      color: #059669;
      border-color: #a7f3d0;
      background: #f0fdf4;
      font-weight: 600;
      font-size: 0.78rem;
      height: 32px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
      &:hover { background: #dcfce7; }
    }
    .card-p-btn {
      color: #0284c7;
      border-color: #bae6fd;
      background: #f0f9ff;
      font-weight: 600;
      font-size: 0.78rem;
      height: 32px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
      &:hover { background: #e0f2fe; }
    }

    /* ─── Empty state ─── */
    .no-data-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 56px 24px;
      text-align: center;
      background: #ffffff;
      border: 1.5px dashed #cbd5e1;
      border-radius: 12px;
      margin: 20px auto;
      max-width: 480px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);

      .no-data-icon-box {
        width: 58px;
        height: 58px;
        border-radius: 14px;
        background: #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 14px;
        border: 1px solid #e2e8f0;
        mat-icon { font-size: 30px; width: 30px; height: 30px; color: #64748b; margin: 0; }
      }

      p { font-size: 1.05rem; font-weight: 700; margin: 0 0 6px; color: #0f172a; }
      span { font-size: 0.85rem; color: #64748b; }
    }

    /* ─── Print Styles ─── */
    .print-only { display: none; }

    @media print {
      .no-print { display: none !important; }
      .print-only { display: block !important; }

      body, html {
        background: #ffffff !important;
      }
      .result-modal-container {
        max-height: none !important;
        overflow: visible !important;
        background: #ffffff !important;
      }
      .leaderboard-wrap, .result-cards-wrap {
        padding: 0 !important;
        overflow: visible !important;
      }

      /* Print Header */
      .print-page-header {
        text-align: center;
        padding-bottom: 12px;
        margin-bottom: 16px;
        border-bottom: 2px solid #0f172a;
      }
      .print-institute-name {
        font-size: 1.3rem;
        font-weight: 800;
        text-transform: uppercase;
        color: #0f172a;
      }
      .print-exam-title {
        font-size: 1.05rem;
        font-weight: 700;
        color: #334155;
        margin: 4px 0;
      }
      .print-meta {
        font-size: 0.85rem;
        color: #64748b;
      }

      /* Print Footer */
      .print-footer {
        margin-top: 16px;
        padding-top: 10px;
        border-top: 1px solid #cbd5e1;
      }
      .print-stats-row {
        display: flex;
        justify-content: space-around;
        font-size: 0.8rem;
        font-weight: 600;
        color: #334155;
      }

      /* Cards Grid in Print */
      .cards-grid {
        display: block !important;
      }
      .result-card {
        page-break-inside: avoid;
        break-inside: avoid;
        border: 2px solid #0f172a !important;
        box-shadow: none !important;
        margin-bottom: 24px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .rc-sign-area {
        display: flex !important;
        justify-content: space-between;
        margin-top: 30px;
        padding-top: 8px;
      }
      .rc-sign-box {
        text-align: center;
      }
      .rc-sign-line {
        border-top: 1px solid #475569;
        width: 130px;
        margin-bottom: 4px;
      }
      .rc-sign-label {
        font-size: 0.72rem;
        font-weight: 600;
        color: #475569;
      }

      /* Status chips — force colors in print */
      .chip-pass   { background: #dcfce7 !important; color: #15803d !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .chip-fail   { background: #fee2e2 !important; color: #dc2626 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .chip-absent { background: #f3f4f6 !important; color: #6b7280 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .grade-badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `]
})
export class ExamResultDialogComponent implements OnInit {
  loading = false;
  viewMode: 'leaderboard' | 'cards' = 'leaderboard';
  rankedList: StudentRankRow[] = [];

  // Computed stats
  totalAppeared = 0;
  absentCount = 0;
  topperMarks = 0;
  averageMarks = 0;
  passCount = 0;
  passPercentage = 0;
  logoFailed = false;

  constructor(
    public dialogRef: MatDialogRef<ExamResultDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ExamResultDialogData,
    private coachingService: CoachingService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadResults();
  }

  get logoUrl(): string | null {
    return this.authService.getInstituteLogoUrl();
  }

  get instituteName(): string {
    return this.authService.currentUser()?.instituteName || 'Apex Coaching Academy';
  }

  private loadResults(): void {
    if (!this.data.testId) return;
    this.loading = true;

    this.coachingService.getTestReportCard(this.data.testId).subscribe({
      next: (report: any) => {
        this.loading = false;
        if (report) {
          if (report.testTitle && !this.data.testTitle) this.data.testTitle = report.testTitle;
          if (report.subject && !this.data.subject) this.data.subject = report.subject;
          if (report.maxMarks && !this.data.maxMarks) this.data.maxMarks = report.maxMarks;
          if (report.batchName && !this.data.batchName) this.data.batchName = report.batchName;
        }

        const students: any[] = report?.rankings || report?.rankedList || report?.students || [];
        this.rankedList = students.map((s: any) => ({
          studentId: s.studentId,
          studentName: s.studentName || '',
          rollNumber: s.rollNumber || '',
          marksObtained: s.marksObtained ?? 0,
          percentage: s.percentage ?? 0,
          rank: s.rank ?? 0,
          isAbsent: s.isAbsent ?? false,
          remarks: s.remarks || '',
          parentWhatsAppPhone: s.parentWhatsAppPhone || '',
          parentName: s.parentName || '',
          className: s.className || '',
          sectionName: s.sectionName || '',
          batchName: s.batchName || this.data.batchName || '',
          isSchoolStudent: !!s.isSchoolStudent,
          isCoachingStudent: !!s.isCoachingStudent,
          enrollmentType: s.enrollmentType || '',
          schoolRollNumber: s.schoolRollNumber || '',
          coachingRollNumber: s.coachingRollNumber || '',
          grade: this.computeGrade(s.percentage ?? 0, s.isAbsent ?? false),
          gradeClass: this.computeGradeClass(s.percentage ?? 0, s.isAbsent ?? false)
        }));

        this.computeStats();
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private computeGrade(pct: number, isAbsent: boolean): string {
    if (isAbsent) return 'AB';
    if (pct >= 90) return 'A+';
    if (pct >= 75) return 'A';
    if (pct >= 60) return 'B';
    if (pct >= 45) return 'C';
    if (pct >= 35) return 'D';
    return 'F';
  }

  private computeGradeClass(pct: number, isAbsent: boolean): string {
    if (isAbsent) return 'grade-f';
    if (pct >= 90) return 'grade-a-plus';
    if (pct >= 75) return 'grade-a';
    if (pct >= 60) return 'grade-b';
    if (pct >= 45) return 'grade-c';
    if (pct >= 35) return 'grade-d';
    return 'grade-f';
  }

  private computeStats(): void {
    this.absentCount  = this.rankedList.filter(s => s.isAbsent).length;
    const appeared    = this.rankedList.filter(s => !s.isAbsent);
    this.totalAppeared = appeared.length;
    this.passCount    = appeared.filter(s => s.percentage >= 35).length;
    this.topperMarks  = appeared.length > 0 ? Math.max(...appeared.map(s => s.marksObtained)) : 0;
    this.averageMarks = appeared.length > 0
      ? appeared.reduce((sum, s) => sum + s.marksObtained, 0) / appeared.length
      : 0;
    this.passPercentage = appeared.length > 0
      ? (this.passCount / appeared.length) * 100
      : 0;
  }

  printResults(): void {
    if (this.rankedList.length === 0) return;

    if (this.viewMode === 'cards') {
      this.printAllCards();
    } else {
      this.printLeaderboardSheet();
    }
  }

  printLeaderboardSheet(): void {
    const printWindow = window.open('', '_blank', 'width=950,height=800');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Result Sheet - ${this.data.testTitle || 'Exam'}</title>
        <style>
          @page { size: A4 portrait; margin: 8mm 10mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 10px; color: #0f172a; background: #ffffff; position: relative; font-size: 12px; }
          
          /* Background Watermark */
          .watermark-bg {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-28deg);
            font-size: 46px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            color: rgba(15, 23, 42, 0.04);
            white-space: nowrap;
            pointer-events: none;
            z-index: 0;
            user-select: none;
          }

          .content-wrap { position: relative; z-index: 1; }

          /* Header */
          .header { border-bottom: 2.5px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; text-align: center; }
          .inst-name { font-size: 20px; font-weight: 800; text-transform: uppercase; color: #0f172a; letter-spacing: -0.01em; margin: 0; }
          .sheet-title { font-size: 13px; font-weight: 700; color: #1e40af; letter-spacing: 0.05em; margin: 3px 0 0 0; text-transform: uppercase; }
          .meta-strip { display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin-top: 6px; font-weight: 600; }

          /* Stats Summary Bar */
          .stats-row { display: flex; justify-content: space-around; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 7px 10px; margin-bottom: 12px; }
          .stats-item { text-align: center; }
          .stats-lbl { font-size: 9.5px; color: #64748b; text-transform: uppercase; font-weight: 700; display: block; }
          .stats-val { font-size: 13.5px; color: #0f172a; font-weight: 800; }

          /* Merit Table */
          table { width: 100%; border-collapse: collapse; border: 1.5px solid #0f172a; margin-bottom: 18px; }
          th { background: #f1f5f9; color: #0f172a; font-weight: 800; font-size: 10.5px; text-transform: uppercase; padding: 7px 8px; border: 1px solid #cbd5e1; text-align: left; }
          td { padding: 6px 8px; border: 1px solid #e2e8f0; color: #0f172a; font-size: 11.5px; }
          .rank-col { font-weight: 800; text-align: center; width: 45px; }
          .roll-col { font-weight: 600; font-family: monospace; width: 85px; }
          .class-col { width: 135px; font-size: 10px; }
          .marks-col { font-weight: 800; text-align: center; width: 65px; }
          .pct-col { font-weight: 700; text-align: center; width: 60px; }
          .grade-col { font-weight: 800; text-align: center; width: 50px; }
          .status-col { font-weight: 700; text-align: center; width: 65px; }
          .status-pass { color: #16a34a; }
          .status-fail { color: #dc2626; }
          .status-absent { color: #64748b; }

          /* Signatures */
          .signatures { display: flex; justify-content: space-between; margin-top: 36px; padding-top: 10px; }
          .sig-col { width: 160px; text-align: center; }
          .sig-line { border-top: 1.5px solid #475569; padding-top: 5px; font-size: 10.5px; font-weight: 700; color: #1e293b; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="watermark-bg">${this.instituteName}</div>
        <div class="content-wrap">
          <div class="header">
            <h1 class="inst-name">${this.instituteName}</h1>
            <div class="sheet-title">EXAMINATION RESULT &amp; MERIT LIST</div>
            <div class="meta-strip">
              <span><strong>Exam:</strong> ${this.data.testTitle || 'Exam'}</span>
              <span><strong>Batch:</strong> ${this.data.batchName || 'All'}</span>
              <span><strong>Subject:</strong> ${this.data.subject || 'All'}</span>
              <span><strong>Max Marks:</strong> ${this.data.maxMarks}</span>
            </div>
          </div>

          <div class="stats-row">
            <div class="stats-item"><span class="stats-lbl">Appeared</span><span class="stats-val">${this.totalAppeared}</span></div>
            <div class="stats-item"><span class="stats-lbl">Highest Score</span><span class="stats-val">${this.topperMarks} / ${this.data.maxMarks}</span></div>
            <div class="stats-item"><span class="stats-lbl">Class Average</span><span class="stats-val">${this.averageMarks.toFixed(1)}</span></div>
            <div class="stats-item"><span class="stats-lbl">Passed</span><span class="stats-val">${this.passCount} (${this.passPercentage.toFixed(0)}%)</span></div>
            <div class="stats-item"><span class="stats-lbl">Absent</span><span class="stats-val">${this.absentCount}</span></div>
          </div>

          <table>
            <thead>
              <tr>
                <th class="rank-col">Rank</th>
                <th class="roll-col">Roll No.</th>
                <th>Student Name</th>
                <th class="class-col">Class / Stream</th>
                <th class="marks-col">Marks</th>
                <th class="pct-col">Pct %</th>
                <th class="grade-col">Grade</th>
                <th class="status-col">Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${this.rankedList.map(s => `
                <tr>
                  <td class="rank-col">${s.isAbsent ? '—' : '#' + s.rank}</td>
                  <td class="roll-col">${s.rollNumber || '—'}</td>
                  <td><strong>${s.studentName}</strong> ${s.parentName ? `<span style="color:#64748b;font-size:10px;">(S/O: ${s.parentName})</span>` : ''}</td>
                  <td class="class-col">
                    ${s.isSchoolStudent && s.isCoachingStudent ? `
                      <div style="font-weight:700; color:#7e22ce; font-size:9px; text-transform:uppercase; margin-bottom:1px;">★ School + Coaching</div>
                      <div style="color:#047857; font-weight:700; font-size:10.5px;">${s.className || 'Class'}${s.sectionName ? ' (' + s.sectionName + ')' : ''}</div>
                      <div style="color:#4338ca; font-size:9.5px;">${s.batchName || ''}</div>
                    ` : s.isSchoolStudent ? `
                      <div style="font-weight:700; color:#15803d; font-size:9px; text-transform:uppercase;">School Only</div>
                      <div style="font-weight:600; font-size:10.5px;">${s.className || ''}${s.sectionName ? ' (' + s.sectionName + ')' : ''}</div>
                    ` : `
                      <div style="font-weight:700; color:#2563eb; font-size:9px; text-transform:uppercase;">Coaching</div>
                      <div style="font-size:10px;">${s.batchName || this.data.batchName || ''}</div>
                    `}
                  </td>
                  <td class="marks-col">${s.isAbsent ? 'AB' : s.marksObtained}</td>
                  <td class="pct-col">${s.isAbsent ? '—' : s.percentage.toFixed(1) + '%'}</td>
                  <td class="grade-col">${s.isAbsent ? 'AB' : s.grade}</td>
                  <td class="status-col ${s.isAbsent ? 'status-absent' : (s.percentage >= 35 ? 'status-pass' : 'status-fail')}">
                    ${s.isAbsent ? 'ABSENT' : (s.percentage >= 35 ? 'PASS' : 'FAIL')}
                  </td>
                  <td style="color:#64748b;font-size:11px;">${s.remarks || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="signatures">
            <div class="sig-col"><div class="sig-line">Class Teacher</div></div>
            <div class="sig-col"><div class="sig-line">Exam Coordinator</div></div>
            <div class="sig-col"><div class="sig-line">Principal / Director</div></div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  }

  printAllCards(): void {
    const printWindow = window.open('', '_blank', 'width=950,height=800');
    if (!printWindow) return;

    const cardsHtml = this.rankedList.map((s, idx) => `
      <div class="card ${idx < this.rankedList.length - 1 ? 'page-break' : ''}">
        <div class="watermark">${this.instituteName}</div>
        <div class="card-inner">
          <div class="header">
            <div>
              <div class="inst-name">${this.instituteName}</div>
              <div class="card-title">Official Student Result &amp; Performance Card</div>
            </div>
            <div class="grade-badge">
              <span style="font-size:16px;">${s.isAbsent ? 'AB' : s.grade}</span>
              <span style="font-size:8px;">GRADE</span>
            </div>
          </div>
          <div class="student-row">
            <div>
              <div class="st-name">${s.studentName}</div>
              <div class="st-meta">Roll No: <strong>${s.rollNumber || 'N/A'}</strong> ${s.isSchoolStudent && s.isCoachingStudent ? `&nbsp;|&nbsp; <span style="background:#fdf4ff;color:#9333ea;font-weight:700;padding:1px 5px;border-radius:3px;border:1px solid #f0abfc;">★ School + Coaching</span>` : ''}</div>
              <div class="st-meta">${s.className ? `Class: <strong>${s.className}${s.sectionName ? ' (' + s.sectionName + ')' : ''}</strong> &nbsp;|&nbsp; ` : ''}Batch: <strong>${s.batchName || this.data.batchName || 'N/A'}</strong></div>
              ${s.parentName ? `<div class="st-meta">Parent: <strong>${s.parentName}</strong></div>` : ''}
            </div>
            <div style="text-align:right;">
              <div class="st-meta">Exam: <strong>${this.data.testTitle || 'Exam'}</strong></div>
              <div class="st-meta">Subject: <strong>${this.data.subject || 'All'}</strong></div>
              <div class="st-meta">Max Marks: <strong>${this.data.maxMarks}</strong></div>
            </div>
          </div>
          <div class="score-grid">
            <div>
              <div class="score-lbl">Marks Obtained</div>
              <div class="score-val">${s.isAbsent ? 'ABSENT' : s.marksObtained + ' / ' + this.data.maxMarks}</div>
            </div>
            <div>
              <div class="score-lbl">Percentage</div>
              <div class="score-val">${s.isAbsent ? '—' : s.percentage.toFixed(1) + '%'}</div>
            </div>
            <div>
              <div class="score-lbl">Class Rank</div>
              <div class="score-val">${s.isAbsent ? '—' : '#' + s.rank}</div>
            </div>
            <div>
              <div class="score-lbl">Status</div>
              <div class="score-val" style="color: ${s.isAbsent ? '#64748b' : (s.percentage >= 35 ? '#16a34a' : '#dc2626')};">
                ${s.isAbsent ? 'Absent' : (s.percentage >= 35 ? 'PASS' : 'FAIL')}
              </div>
            </div>
          </div>
          ${s.remarks ? `<div style="font-size:11.5px; color:#475569; margin-bottom:12px;"><strong>Remarks:</strong> ${s.remarks}</div>` : ''}
          <div class="signatures">
            <div class="sig-line">Class Teacher</div>
            <div class="sig-line">Controller of Exam</div>
            <div class="sig-line">Principal / Director</div>
          </div>
        </div>
      </div>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Result Cards - ${this.data.testTitle || 'Exam'}</title>
        <style>
          @page { size: A5 landscape; margin: 8mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 12px; color: #1e293b; background: #ffffff; }
          .card { position: relative; overflow: hidden; border: 2px solid #0f172a; border-radius: 12px; padding: 22px; max-width: 650px; margin: 0 auto 20px auto; background: #ffffff; }
          .page-break { page-break-after: always; break-after: page; }
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-25deg);
            font-size: 38px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: rgba(15, 23, 42, 0.04);
            white-space: nowrap;
            pointer-events: none;
            z-index: 0;
            user-select: none;
          }
          .card-inner { position: relative; z-index: 1; }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
          .inst-name { font-size: 19px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin: 0; }
          .card-title { font-size: 12px; font-weight: 600; color: #64748b; margin-top: 3px; }
          .grade-badge { width: 48px; height: 48px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; border: 2px solid #0f172a; }
          .student-row { display: flex; justify-content: space-between; margin-bottom: 14px; }
          .st-name { font-size: 17px; font-weight: 700; color: #0f172a; }
          .st-meta { font-size: 12px; color: #475569; margin-top: 3px; }
          .score-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; margin-bottom: 14px; }
          .score-lbl { font-size: 10.5px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 3px; }
          .score-val { font-size: 19px; font-weight: 800; color: #0f172a; }
          .signatures { display: flex; justify-content: space-between; margin-top: 30px; padding-top: 8px; }
          .sig-line { border-top: 1px solid #94a3b8; width: 135px; text-align: center; padding-top: 5px; font-size: 11px; font-weight: 600; }
        </style>
      </head>
      <body>
        ${cardsHtml}
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  }

  printSingleCard(student: StudentRankRow): void {
    const cardHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Result Card - ${student.studentName}</title>
        <style>
          @page { size: A5 landscape; margin: 8mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 16px; color: #1e293b; background: #ffffff; }
          .card { position: relative; overflow: hidden; border: 2px solid #0f172a; border-radius: 12px; padding: 22px; max-width: 650px; margin: 0 auto; box-sizing: border-box; background: #ffffff; }
          
          /* Background Watermark */
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-25deg);
            font-size: 38px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: rgba(15, 23, 42, 0.04);
            white-space: nowrap;
            pointer-events: none;
            z-index: 0;
            user-select: none;
          }

          .card-inner { position: relative; z-index: 1; }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
          .inst-name { font-size: 19px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin: 0; }
          .card-title { font-size: 12px; font-weight: 600; color: #64748b; margin-top: 3px; }
          .grade-badge { width: 48px; height: 48px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; border: 2px solid #0f172a; }
          .student-row { display: flex; justify-content: space-between; margin-bottom: 14px; }
          .st-name { font-size: 17px; font-weight: 700; color: #0f172a; }
          .st-meta { font-size: 12px; color: #475569; margin-top: 3px; }
          .score-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; margin-bottom: 14px; }
          .score-lbl { font-size: 10.5px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 3px; }
          .score-val { font-size: 19px; font-weight: 800; color: #0f172a; }
          .signatures { display: flex; justify-content: space-between; margin-top: 32px; padding-top: 8px; }
          .sig-line { border-top: 1px solid #94a3b8; width: 135px; text-align: center; padding-top: 5px; font-size: 11px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="watermark">${this.instituteName}</div>
          <div class="card-inner">
            <div class="header">
              <div>
                <div class="inst-name">${this.instituteName}</div>
                <div class="card-title">Official Student Result &amp; Performance Card</div>
              </div>
              <div class="grade-badge">
                <span style="font-size:16px;">${student.isAbsent ? 'AB' : student.grade}</span>
                <span style="font-size:8px;">GRADE</span>
              </div>
            </div>
            <div class="student-row">
              <div>
                <div class="st-name">${student.studentName}</div>
                <div class="st-meta">Roll No: <strong>${student.rollNumber || 'N/A'}</strong> ${student.isSchoolStudent && student.isCoachingStudent ? `&nbsp;|&nbsp; <span style="background:#fdf4ff;color:#9333ea;font-weight:700;padding:1px 5px;border-radius:3px;border:1px solid #f0abfc;">★ School + Coaching</span>` : ''}</div>
                <div class="st-meta">${student.className ? `Class: <strong>${student.className}${student.sectionName ? ' (' + student.sectionName + ')' : ''}</strong> &nbsp;|&nbsp; ` : ''}Batch: <strong>${student.batchName || this.data.batchName || 'N/A'}</strong></div>
                ${student.parentName ? `<div class="st-meta">Parent: <strong>${student.parentName}</strong></div>` : ''}
              </div>
              <div style="text-align:right;">
                <div class="st-meta">Exam: <strong>${this.data.testTitle || 'Exam'}</strong></div>
                <div class="st-meta">Subject: <strong>${this.data.subject || 'All'}</strong></div>
                <div class="st-meta">Max Marks: <strong>${this.data.maxMarks}</strong></div>
              </div>
            </div>
            <div class="score-grid">
              <div>
                <div class="score-lbl">Marks Obtained</div>
                <div class="score-val">${student.isAbsent ? 'ABSENT' : student.marksObtained + ' / ' + this.data.maxMarks}</div>
              </div>
              <div>
                <div class="score-lbl">Percentage</div>
                <div class="score-val">${student.isAbsent ? '—' : student.percentage.toFixed(1) + '%'}</div>
              </div>
              <div>
                <div class="score-lbl">Class Rank</div>
                <div class="score-val">${student.isAbsent ? '—' : '#' + student.rank}</div>
              </div>
              <div>
                <div class="score-lbl">Status</div>
                <div class="score-val" style="color: ${student.isAbsent ? '#64748b' : (student.percentage >= 35 ? '#16a34a' : '#dc2626')};">
                  ${student.isAbsent ? 'Absent' : (student.percentage >= 35 ? 'PASS' : 'FAIL')}
                </div>
              </div>
            </div>
            ${student.remarks ? `<div style="font-size:11.5px; color:#475569; margin-bottom:12px;"><strong>Remarks:</strong> ${student.remarks}</div>` : ''}
            <div class="signatures">
              <div class="sig-line">Class Teacher</div>
              <div class="sig-line">Controller of Exam</div>
              <div class="sig-line">Principal / Director</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;
    printWindow.document.write(cardHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  }

  shareWhatsApp(student: StudentRankRow): void {
    if (!student.parentWhatsAppPhone) return;
    const rawPhone = student.parentWhatsAppPhone.replace(/\D/g, '');
    const formattedPhone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;

    const statusEmoji = student.isAbsent ? '⚪' : (student.percentage >= 35 ? '✅' : '⚠️');
    const statusText = student.isAbsent ? 'ABSENT' : (student.percentage >= 35 ? 'PASSED' : 'NEEDS IMPROVEMENT');

    const classInfo = (student.isSchoolStudent && student.isCoachingStudent)
      ? `${student.className || ''}${student.sectionName ? ' (' + student.sectionName + ')' : ''} & ${student.batchName || this.data.batchName || ''} (School + Coaching)`
      : student.isSchoolStudent
      ? `${student.className || ''}${student.sectionName ? ' (' + student.sectionName + ')' : ''} (School)`
      : `${student.batchName || this.data.batchName || ''} (Coaching)`;

    const textMsg = `*📊 EXAM RESULT & PERFORMANCE REPORT*\n` +
      `*Institute*: ${this.instituteName}\n` +
      `*Exam*: ${this.data.testTitle || 'Test'}\n` +
      `*Subject*: ${this.data.subject || 'All'}\n\n` +
      `*Student*: ${student.studentName}\n` +
      `*Roll Number*: ${student.rollNumber || '—'}\n` +
      `*Class/Program*: ${classInfo}\n\n` +
      `*Marks Obtained*: ${student.isAbsent ? 'ABSENT' : student.marksObtained + ' / ' + this.data.maxMarks}\n` +
      `*Percentage*: ${student.isAbsent ? '—' : student.percentage.toFixed(1) + '%'}\n` +
      `*Class Rank*: ${student.isAbsent ? '—' : '#' + student.rank}\n` +
      `*Grade*: ${student.grade}\n` +
      `*Result Status*: ${statusEmoji} *${statusText}*\n` +
      (student.remarks ? `*Remarks*: ${student.remarks}\n` : '') +
      `\n*Class Highlights*:\n` +
      `• Highest Score: ${this.topperMarks} / ${this.data.maxMarks}\n` +
      `• Class Average: ${this.averageMarks.toFixed(1)}\n` +
      `• Pass Rate: ${this.passPercentage.toFixed(0)}%\n\n` +
      `Best regards,\n*${this.instituteName}*`;

    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(textMsg)}`;
    window.open(waUrl, '_blank');
  }

  shareClassSummaryWhatsApp(): void {
    const textMsg = `*📊 CLASS EXAM SUMMARY REPORT*\n` +
      `*Institute*: ${this.instituteName}\n` +
      `*Exam*: ${this.data.testTitle || 'Test'}\n` +
      `*Subject*: ${this.data.subject || 'All'}\n` +
      `*Class/Batch*: ${this.data.batchName || '—'}\n` +
      `*Max Marks*: ${this.data.maxMarks}\n\n` +
      `*Performance Overview*:\n` +
      `• Total Appeared: ${this.totalAppeared}\n` +
      `• Absent: ${this.absentCount}\n` +
      `• Highest Mark: ${this.topperMarks} / ${this.data.maxMarks}\n` +
      `• Class Average: ${this.averageMarks.toFixed(1)}\n` +
      `• Passed: ${this.passCount} (${this.passPercentage.toFixed(0)}%)\n\n` +
      `*Top Rankers*:\n` +
      this.rankedList.filter(s => !s.isAbsent).slice(0, 3).map((s, i) =>
        `${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} #${s.rank} ${s.studentName}: ${s.marksObtained}/${this.data.maxMarks} (${s.percentage.toFixed(1)}%)`
      ).join('\n') +
      `\n\n*${this.instituteName}*`;

    const waUrl = `https://wa.me/?text=${encodeURIComponent(textMsg)}`;
    window.open(waUrl, '_blank');
  }
}
