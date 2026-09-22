import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {
  SchoolService,
  ConsolidatedStudentResultDto,
  ExamSettingDto,
  SendAnnualResultWhatsAppDto
} from '../../core/services/school.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

export interface SchoolReportCardDialogData {
  mode: 'single' | 'bulk' | 'certificate';
  className: string;
  academicYear: string;
  examType: string;
  student?: ConsolidatedStudentResultDto;
  allStudents?: ConsolidatedStudentResultDto[];
  settings?: ExamSettingDto;
  subjects: string[];
}

@Component({
  selector: 'app-school-report-card-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatChipsModule,
    MatDividerModule,
    MatProgressBarModule
  ],
  template: `
    <div class="report-card-modal-container">
      
      <!-- STRICT UI RULE: Light Blue Gradient Modal Header -->
      <div class="modal-header-bar no-print">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>{{ currentView === 'certificate' ? 'workspace_premium' : (isBulkMode ? 'print' : 'assignment_turned_in') }}</mat-icon>
          </div>
          <div class="header-title-block">
            <div class="header-title-row">
              <h2 class="modal-main-title">
                {{ currentView === 'certificate' ? 'Annual Pass & Promotion Certificate' : (isBulkMode ? 'Bulk Class Report Cards (' + (data.allStudents?.length || 0) + ' Students)' : 'Annual Progress Report & Marksheet') }}
              </h2>
              <span class="exam-pill">{{ data.examType || 'Annual Exam' }}</span>
              <span class="year-pill">{{ data.academicYear }}</span>
            </div>
            <p class="modal-sub-title">
              <span>Class: <strong>{{ data.className }}</strong></span>
              <span class="meta-dot">&bull;</span>
              <span>Institution: <strong>{{ instituteName }}</strong></span>
              <span class="meta-dot" *ngIf="!isBulkMode && activeStudent">&bull;</span>
              <span *ngIf="!isBulkMode && activeStudent">Student: <strong>{{ activeStudent.studentName }}</strong> (Roll: {{ activeStudent.rollNumber }})</span>
            </p>
          </div>
        </div>

        <div class="header-actions">
          <!-- Switch View Toggle (only for single student) -->
          <div class="view-mode-toggle" *ngIf="!isBulkMode">
            <button type="button" class="toggle-btn" [class.active]="currentView === 'marksheet'" (click)="currentView = 'marksheet'">
              <mat-icon>description</mat-icon> Marksheet
            </button>
            <button type="button" class="toggle-btn" [class.active]="currentView === 'certificate'" (click)="currentView = 'certificate'">
              <mat-icon>workspace_premium</mat-icon> Certificate
            </button>
          </div>

          <!-- WhatsApp Button (single mode only) -->
          <button mat-flat-button class="wa-btn header-btn" *ngIf="!isBulkMode && activeStudent" (click)="sendWhatsApp()" [disabled]="sendingWhatsApp" matTooltip="Send Result Summary to Parent's WhatsApp">
            <mat-icon *ngIf="!sendingWhatsApp">send</mat-icon>
            <mat-icon *ngIf="sendingWhatsApp" class="spin">sync</mat-icon>
            <span>WhatsApp</span>
          </button>

          <!-- Print Button -->
          <button mat-flat-button class="print-btn header-btn" (click)="printDocument()">
            <mat-icon>print</mat-icon>
            <span>Print {{ isBulkMode ? 'All (' + (data.allStudents?.length || 0) + ')' : '' }}</span>
          </button>

          <!-- Close Button -->
          <button mat-icon-button class="close-btn" [mat-dialog-close]="null" matTooltip="Close (Esc)">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Scrollable Printable Document Body -->
      <div class="document-scroll-viewport">

        <!-- ═══════════════════════════════════════════════════════ -->
        <!-- VIEW 1: MARKSHEET / REPORT CARD (Single or Bulk)       -->
        <!-- ═══════════════════════════════════════════════════════ -->
        <ng-container *ngIf="currentView === 'marksheet'">
          <div class="report-card-page" *ngFor="let st of studentsToRender; let sIdx = index" [class.page-break-always]="isBulkMode && sIdx < studentsToRender.length - 1">
            
            <!-- School Crest & Header -->
            <div class="rc-header-section">
              <div class="rc-header-logo">
                <div class="school-seal-circle">
                  <mat-icon>school</mat-icon>
                </div>
              </div>
              <div class="rc-header-info">
                <h1 class="rc-school-name">{{ instituteName }}</h1>
                <p class="rc-school-sub">Affiliation / Reg No: {{ data.settings?.schoolAffiliationNumber || 'CBSE/STATE-AFF-2025' }}</p>
                <p class="rc-school-address">{{ branchAddress || 'Main Campus' }}</p>
                <div class="rc-marksheet-title-strip">
                  <span class="title-text">ANNUAL PROGRESS REPORT &amp; PERFORMANCE MARKSHEET</span>
                  <span class="session-text">ACADEMIC SESSION: {{ data.academicYear }}</span>
                </div>
              </div>
              <div class="rc-header-right">
                <div class="academic-year-badge">
                  <span class="session-label">TERM</span>
                  <span class="session-val">{{ data.examType || 'ANNUAL' }}</span>
                </div>
              </div>
            </div>

            <div class="rc-divider-double"></div>

            <!-- Student Bio Profile Grid -->
            <div class="rc-student-grid">
              <div class="bio-col">
                <div class="bio-row"><span class="lbl">Student Name:</span><span class="val name-val">{{ st.studentName }}</span></div>
                <div class="bio-row"><span class="lbl">Father's Name:</span><span class="val">{{ st.fatherName || 'Guardian Record' }}</span></div>
                <div class="bio-row"><span class="lbl">Mother's Name:</span><span class="val">{{ st.motherName || 'Parent Record' }}</span></div>
                <div class="bio-row"><span class="lbl">Date of Birth:</span><span class="val">{{ st.dateOfBirth || '-' }}</span></div>
              </div>
              <div class="bio-col">
                <div class="bio-row"><span class="lbl">Class &amp; Section:</span><span class="val"><strong>{{ data.className }} {{ st.sectionName ? '(' + st.sectionName + ')' : '' }}</strong></span></div>
                <div class="bio-row"><span class="lbl">Roll Number:</span><span class="val"><strong>{{ st.rollNumber }}</strong></span></div>
                <div class="bio-row"><span class="lbl">Admission / SR No:</span><span class="val">{{ st.admissionNumber }}</span></div>
                <div class="bio-row"><span class="lbl">Annual Attendance:</span><span class="val"><strong>{{ st.presentDays }} / {{ st.totalAttendanceDays }} Days ({{ st.attendancePercentage }}%)</strong></span></div>
              </div>
            </div>

            <!-- Subject-wise Marks Table -->
            <div class="rc-table-wrapper">
              <table class="rc-marks-table">
                <thead>
                  <tr>
                    <th class="th-sno">#</th>
                    <th class="th-subject">Subject Title</th>
                    <th class="th-max">Max Marks</th>
                    <th class="th-pass">Pass Marks</th>
                    <th class="th-obt">Marks Obtained</th>
                    <th class="th-grade">Grade</th>
                    <th class="th-status">Result</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let sub of st.subjectDetails; let i = index">
                    <td class="td-sno">{{ i + 1 }}</td>
                    <td class="td-subject"><strong>{{ sub.subject }}</strong></td>
                    <td class="td-max">{{ sub.maxMarks }}</td>
                    <td class="td-pass">{{ sub.passingMarks }}</td>
                    <td class="td-obt" [class.text-absent]="sub.isAbsent" [class.text-failed]="!sub.isPassed && !sub.isAbsent">
                      <strong>{{ sub.isAbsent ? 'ABSENT' : (sub.marksObtained != null ? sub.marksObtained : '-') }}</strong>
                    </td>
                    <td class="td-grade">
                      <span class="sub-grade-pill grade-{{ sub.grade }}">{{ sub.grade }}</span>
                    </td>
                    <td class="td-status">
                      <span class="sub-status-text" [class.pass]="sub.isPassed" [class.fail]="!sub.isPassed">
                        {{ sub.isAbsent ? 'Absent' : (sub.isPassed ? 'Passed' : 'Failed') }}
                      </span>
                    </td>
                  </tr>

                  <!-- Grand Total Row -->
                  <tr class="rc-total-row">
                    <td colspan="2" class="total-label">GRAND TOTAL &amp; AGGREGATE</td>
                    <td class="total-num">{{ st.totalMax }}</td>
                    <td class="total-num">-</td>
                    <td class="total-num total-highlight">
                      <strong>{{ st.totalObtained }}</strong> / {{ st.totalMax }}
                    </td>
                    <td class="td-grade">
                      <span class="sub-grade-pill grade-{{ st.grade }}">{{ st.grade }}</span>
                    </td>
                    <td class="td-status">
                      <strong>{{ st.overallPercentage }}%</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Result Summary & Verdict Box -->
            <div class="rc-verdict-container">
              <div class="verdict-stats">
                <div class="v-stat">
                  <span class="v-lbl">Class Rank</span>
                  <span class="v-val rank-val">
                    {{ st.rank > 0 ? '#' + st.rank : 'N/A' }}
                  </span>
                </div>
                <div class="v-stat">
                  <span class="v-lbl">Overall Grade</span>
                  <span class="v-val grade-val">{{ st.grade }}</span>
                </div>
                <div class="v-stat">
                  <span class="v-lbl">Final Result</span>
                  <span class="v-val status-val" [ngClass]="st.resultStatus.toLowerCase().replace(' ', '-')">
                    {{ st.resultStatus }}
                  </span>
                </div>
              </div>

              <div class="verdict-banner" [class.banner-promoted]="st.resultStatus === 'Passed' || st.resultStatus === 'Passed with Grace'" [class.banner-compartment]="st.resultStatus === 'Compartment'" [class.banner-detained]="st.resultStatus === 'Failed' || st.resultStatus === 'Absent'">
                <mat-icon class="verdict-icon">
                  {{ (st.resultStatus === 'Passed' || st.resultStatus === 'Passed with Grace') ? 'check_circle' : (st.resultStatus === 'Compartment' ? 'warning' : 'cancel') }}
                </mat-icon>
                <div class="verdict-text">
                  <span class="verdict-heading">FINAL ACADEMIC STATUS</span>
                  <p class="verdict-desc">{{ st.promotionVerdict }}</p>
                </div>
              </div>
            </div>

            <!-- Grading Scale Legend & Remarks -->
            <div class="rc-footer-info-grid">
              <div class="grading-scale-card">
                <span class="g-title">Scholastic Grading Scale Benchmark</span>
                <div class="g-badges">
                  <span><strong>A+</strong> (90-100% Outstanding)</span>
                  <span><strong>A</strong> (80-89% Excellent)</span>
                  <span><strong>B</strong> (70-79% Very Good)</span>
                  <span><strong>C</strong> (60-69% Good)</span>
                  <span><strong>D</strong> ({{ data.settings?.passingPercentage || 33 }}-59% Pass)</span>
                  <span><strong>F</strong> (&lt; {{ data.settings?.passingPercentage || 33 }}% Needs Improvement)</span>
                </div>
              </div>

              <div class="remarks-card">
                <span class="r-title">Class Teacher's Remarks</span>
                <p class="r-text">
                  {{ st.resultStatus === 'Passed' || st.resultStatus === 'Passed with Grace' ? 'Exemplary academic effort and disciplined conduct throughout the session. Keep aiming higher!' : (st.resultStatus === 'Compartment' ? 'Needs focused attention in compartment subjects to qualify for annual promotion.' : 'Requires persistent support and comprehensive revision.') }}
                </p>
              </div>
            </div>

            <!-- Signatures Strip -->
            <div class="rc-signatures-section">
              <div class="sign-block">
                <div class="sign-line"></div>
                <strong class="sign-person-name" *ngIf="st.classTeacherName">{{ st.classTeacherName }}</strong>
                <span class="sign-title">{{ data.settings?.classTeacherSignTitle || 'Class Teacher' }}</span>
              </div>
              <div class="sign-block">
                <div class="sign-line"></div>
                <span class="sign-title">Controller of Examinations</span>
              </div>
              <div class="sign-block principal-seal-block">
                <div class="school-seal-placeholder">
                  <span>INSTITUTION<br>SEAL</span>
                </div>
                <div class="sign-line"></div>
                <span class="sign-title">{{ data.settings?.principalSignTitle || 'Principal / Headmaster' }}</span>
              </div>
            </div>

            <!-- Date of Declaration -->
            <div class="rc-issue-footer">
              <span>Date of Result Declaration: <strong>{{ todayDate }}</strong></span>
              <span>Generated via IMSERP Academic Module</span>
            </div>

          </div>
        </ng-container>

        <!-- ═══════════════════════════════════════════════════════ -->
        <!-- VIEW 2: OFFICIAL PROMOTION CERTIFICATE                  -->
        <!-- ═══════════════════════════════════════════════════════ -->
        <ng-container *ngIf="currentView === 'certificate'">
          <div class="certificate-page-wrapper">
            <div class="certificate-inner-border">
              
              <!-- Certificate Header -->
              <div class="cert-header">
                <div class="cert-emblem">
                  <mat-icon>military_tech</mat-icon>
                </div>
                <h1 class="cert-school-name">{{ instituteName }}</h1>
                <p class="cert-school-aff">Affiliated Institution &bull; Reg: {{ data.settings?.schoolAffiliationNumber || 'CBSE/STATE-AFF-2025' }}</p>
                <div class="cert-title-ribbon">
                  <span>ANNUAL PROMOTION &amp; PASS CERTIFICATE</span>
                </div>
              </div>

              <!-- Certificate Body Text -->
              <div class="cert-body" *ngIf="activeStudent">
                <p class="cert-proclamation">This is to officially certify that</p>
                <h2 class="cert-student-name">{{ activeStudent.studentName }}</h2>
                
                <p class="cert-details-text">
                  Son / Daughter of <strong>{{ activeStudent.fatherName || 'Parent/Guardian' }}</strong>, 
                  Roll Number <strong>{{ activeStudent.rollNumber }}</strong>, 
                  Scholar Register / SR Number <strong>{{ activeStudent.admissionNumber }}</strong>, 
                  has successfully appeared for and completed the <strong>{{ data.examType || 'Annual Examination' }}</strong> 
                  of <strong>{{ data.className }}</strong> for Academic Session <strong>{{ data.academicYear }}</strong>.
                </p>

                <div class="cert-highlights-grid">
                  <div class="c-stat">
                    <span class="c-lbl">Aggregate Marks</span>
                    <span class="c-val">{{ activeStudent.totalObtained }} / {{ activeStudent.totalMax }}</span>
                  </div>
                  <div class="c-stat">
                    <span class="c-lbl">Percentage</span>
                    <span class="c-val">{{ activeStudent.overallPercentage }}%</span>
                  </div>
                  <div class="c-stat">
                    <span class="c-lbl">Grade Secured</span>
                    <span class="c-val">{{ activeStudent.grade }}</span>
                  </div>
                  <div class="c-stat">
                    <span class="c-lbl">Class Rank</span>
                    <span class="c-val">#{{ activeStudent.rank > 0 ? activeStudent.rank : '1' }}</span>
                  </div>
                </div>

                <div class="cert-verdict-box">
                  <p class="verdict-lead">Official Academic Determination:</p>
                  <h3 class="verdict-title">
                    {{ activeStudent.resultStatus === 'Passed' || activeStudent.resultStatus === 'Passed with Grace' ? 'QUALIFIED &amp; PROMOTED TO THE NEXT HIGHER GRADE' : activeStudent.promotionVerdict.toUpperCase() }}
                  </h3>
                </div>
              </div>

              <!-- Certificate Signatures -->
              <div class="cert-signatures">
                <div class="cert-sign-col">
                  <span class="date-lbl">Date of Issuance:</span>
                  <span class="date-val">{{ todayDate }}</span>
                  <div class="cert-ct-box" *ngIf="activeStudent?.classTeacherName" style="margin-top: 8px;">
                    <span style="font-size: 0.72rem; color: #64748b; text-transform: uppercase; font-weight: 600; display: block;">Class Teacher:</span>
                    <strong style="font-size: 0.85rem; color: #1e3a8a;">{{ activeStudent?.classTeacherName }}</strong>
                  </div>
                </div>
                <div class="cert-seal-center">
                  <div class="cert-gold-seal">
                    <mat-icon>verified</mat-icon>
                    <span>OFFICIAL<br>STAMP</span>
                  </div>
                </div>
                <div class="cert-sign-col text-right">
                  <div class="sign-line-gold"></div>
                  <span class="sign-role">{{ data.settings?.principalSignTitle || 'Principal / Headmaster' }}</span>
                  <span class="sign-sub">{{ instituteName }}</span>
                </div>
              </div>

            </div>
          </div>
        </ng-container>

      </div>
    </div>
  `,
  styles: [`
    .report-card-modal-container {
      display: flex;
      flex-direction: column;
      height: 92vh;
      max-height: 92vh;
      width: 100%;
      background: #f1f5f9;
      overflow: hidden;
    }

    /* ─── STRICT UI RULE: Light Blue Gradient Modal Header ─── */
    .modal-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 24px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      flex-shrink: 0;
      gap: 16px;
      min-height: 64px;
      box-sizing: border-box;

      .header-left {
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;

        .header-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: #2563eb;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
          flex-shrink: 0;
          mat-icon { font-size: 24px; width: 24px; height: 24px; }
        }

        .header-title-block {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;

          .header-title-row {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;

            .modal-main-title {
              margin: 0;
              font-size: 1.12rem;
              font-weight: 700;
              color: #1e3a8a;
              letter-spacing: -0.01em;
            }

            .exam-pill {
              font-size: 0.72rem;
              font-weight: 700;
              background: #dbeafe;
              color: #1d4ed8;
              padding: 2px 8px;
              border-radius: 6px;
              border: 1px solid #93c5fd;
            }

            .year-pill {
              font-size: 0.72rem;
              font-weight: 700;
              background: #f0fdf4;
              color: #15803d;
              padding: 2px 8px;
              border-radius: 6px;
              border: 1px solid #bbf7d0;
            }
          }

          .modal-sub-title {
            margin: 0;
            font-size: 0.8rem;
            color: #3b82f6;
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;

            strong { color: #1e40af; }
            .meta-dot { color: #93c5fd; }
          }
        }
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;

        .view-mode-toggle {
          display: flex;
          background: #dbeafe;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          padding: 2px;
          gap: 2px;

          .toggle-btn {
            border: none;
            background: transparent;
            padding: 5px 12px;
            border-radius: 6px;
            font-size: 0.78rem;
            font-weight: 600;
            color: #1e40af;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: all 0.15s ease;

            mat-icon { font-size: 16px; width: 16px; height: 16px; }

            &.active {
              background: #ffffff;
              color: #2563eb;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              font-weight: 700;
            }
          }
        }

        .header-btn {
          height: 36px;
          padding: 0 14px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.82rem;
          display: flex;
          align-items: center;
          gap: 6px;
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
        }

        .wa-btn {
          background: #16a34a;
          color: #ffffff;
          &:hover { background: #15803d; }
        }

        .print-btn {
          background: #2563eb;
          color: #ffffff;
          &:hover { background: #1d4ed8; }
        }

        .close-btn {
          color: #64748b;
          &:hover { color: #1e293b; }
        }
      }
    }

    /* ─── Scroll Viewport ─── */
    .document-scroll-viewport {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
    }

    /* ─── Single Report Card Sheet (A4 Dimensions) ─── */
    .report-card-page {
      background: #ffffff;
      width: 100%;
      max-width: 820px;
      min-height: 1100px;
      padding: 36px 40px;
      box-sizing: border-box;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      border: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Header Section */
    .rc-header-section {
      display: flex;
      align-items: center;
      gap: 20px;

      .rc-header-logo {
        .school-seal-circle {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1e3a8a, #2563eb);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
          border: 2px solid #bfdbfe;
          mat-icon { font-size: 38px; width: 38px; height: 38px; }
        }
      }

      .rc-header-info {
        flex: 1 1 auto;
        text-align: center;

        .rc-school-name {
          margin: 0;
          font-size: 1.45rem;
          font-weight: 800;
          color: #0f172a;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .rc-school-sub {
          margin: 2px 0 0;
          font-size: 0.78rem;
          font-weight: 600;
          color: #64748b;
        }
        .rc-school-address {
          margin: 1px 0 6px;
          font-size: 0.75rem;
          color: #94a3b8;
        }

        .rc-marksheet-title-strip {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          padding: 4px 14px;
          border-radius: 20px;

          .title-text {
            font-size: 0.78rem;
            font-weight: 800;
            color: #1e40af;
            letter-spacing: 0.03em;
          }
          .session-text {
            font-size: 0.74rem;
            font-weight: 700;
            color: #2563eb;
          }
        }
      }

      .rc-header-right {
        .academic-year-badge {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8px 14px;
          border: 2px dashed #93c5fd;
          border-radius: 8px;
          background: #f8fafc;

          .session-label { font-size: 0.65rem; font-weight: 700; color: #64748b; }
          .session-val { font-size: 0.85rem; font-weight: 800; color: #1e3a8a; }
        }
      }
    }

    .rc-divider-double {
      height: 3px;
      border-top: 1px solid #2563eb;
      border-bottom: 1px solid #2563eb;
      margin: 4px 0;
    }

    /* Student Grid */
    .rc-student-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 18px;

      .bio-col {
        display: flex;
        flex-direction: column;
        gap: 6px;

        .bio-row {
          display: flex;
          font-size: 0.82rem;

          .lbl {
            width: 140px;
            color: #64748b;
            font-weight: 600;
          }
          .val {
            color: #0f172a;
            flex: 1 1 auto;
          }
          .name-val {
            font-weight: 800;
            color: #1e3a8a;
            text-transform: uppercase;
          }
        }
      }
    }

    /* Table Section */
    .rc-table-wrapper {
      margin: 4px 0;

      .rc-marks-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.82rem;

        th, td {
          border: 1px solid #cbd5e1;
          padding: 8px 10px;
          text-align: center;
        }

        thead {
          background: #f1f5f9;
          th {
            font-weight: 700;
            color: #1e293b;
            font-size: 0.78rem;
            text-transform: uppercase;
          }
          .th-subject { text-align: left; }
        }

        tbody {
          .td-subject { text-align: left; }
          .td-grade { font-weight: 700; }
          
          .sub-grade-pill {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 700;
            background: #e2e8f0;
            color: #334155;

            &.grade-A\\+, &.grade-A { background: #dcfce7; color: #15803d; }
            &.grade-B { background: #dbeafe; color: #1d4ed8; }
            &.grade-C { background: #fef9c3; color: #a16207; }
            &.grade-D { background: #ffedd5; color: #c2410c; }
            &.grade-F { background: #fee2e2; color: #b91c1c; }
          }

          .sub-status-text {
            font-weight: 700;
            &.pass { color: #16a34a; }
            &.fail { color: #dc2626; }
          }

          .text-absent { color: #9333ea; font-style: italic; }
          .text-failed { color: #dc2626; }

          .rc-total-row {
            background: #f8fafc;
            border-top: 2px solid #64748b;

            .total-label {
              text-align: right;
              font-weight: 800;
              color: #1e293b;
              padding-right: 16px;
            }
            .total-num {
              font-weight: 800;
              color: #0f172a;
            }
            .total-highlight {
              color: #1e3a8a;
              font-size: 0.95rem;
            }
          }
        }
      }
    }

    /* Verdict Box */
    .rc-verdict-container {
      display: flex;
      flex-direction: column;
      gap: 10px;

      .verdict-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;

        .v-stat {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          align-items: center;

          .v-lbl { font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase; }
          .v-val { font-size: 1.15rem; font-weight: 800; color: #0f172a; margin-top: 2px; }
          .rank-val { color: #2563eb; }
          .grade-val { color: #16a34a; }
          
          .status-val {
            &.passed, &.passed-with-grace { color: #16a34a; }
            &.compartment { color: #d97706; }
            &.failed, &.detained, &.absent { color: #dc2626; }
          }
        }
      }

      .verdict-banner {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 16px;
        border-radius: 6px;
        border: 1px solid transparent;

        &.banner-promoted {
          background: #f0fdf4;
          border-color: #86efac;
          .verdict-icon { color: #16a34a; }
          .verdict-heading { color: #15803d; }
          .verdict-desc { color: #166534; font-weight: 700; }
        }
        &.banner-compartment {
          background: #fffbeb;
          border-color: #fde68a;
          .verdict-icon { color: #d97706; }
          .verdict-heading { color: #b45309; }
          .verdict-desc { color: #92400e; font-weight: 700; }
        }
        &.banner-detained {
          background: #fef2f2;
          border-color: #fca5a5;
          .verdict-icon { color: #dc2626; }
          .verdict-heading { color: #b91c1c; }
          .verdict-desc { color: #991b1b; font-weight: 700; }
        }

        .verdict-icon { font-size: 26px; width: 26px; height: 26px; }
        .verdict-text {
          display: flex;
          flex-direction: column;
          .verdict-heading { font-size: 0.68rem; font-weight: 800; letter-spacing: 0.04em; }
          .verdict-desc { margin: 1px 0 0; font-size: 0.88rem; }
        }
      }
    }

    /* Footer Info */
    .rc-footer-info-grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 12px;

      .grading-scale-card, .remarks-card {
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px 12px;
        background: #f8fafc;
      }

      .g-title, .r-title {
        display: block;
        font-size: 0.72rem;
        font-weight: 800;
        color: #475569;
        text-transform: uppercase;
        margin-bottom: 4px;
      }

      .g-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        span {
          font-size: 0.7rem;
          color: #64748b;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          padding: 2px 6px;
          border-radius: 4px;
        }
      }

      .r-text {
        margin: 0;
        font-size: 0.75rem;
        color: #334155;
        font-style: italic;
        line-height: 1.35;
      }
    }

    /* Signatures Section */
    .rc-signatures-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 24px;
      padding: 0 16px;

      .sign-block {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 170px;

        .sign-line {
          width: 100%;
          height: 1px;
          background: #64748b;
          margin-bottom: 6px;
        }

        .sign-person-name {
          display: block;
          font-size: 0.8rem;
          font-weight: 700;
          color: #1e3a8a;
          margin-bottom: 2px;
        }

        .sign-title {
          font-size: 0.74rem;
          font-weight: 700;
          color: #334155;
          text-align: center;
        }
      }

      .principal-seal-block {
        position: relative;
        .school-seal-placeholder {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          border: 2px dashed #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-size: 0.58rem;
          font-weight: 800;
          color: #94a3b8;
          margin-bottom: 6px;
        }
      }
    }

    .rc-issue-footer {
      display: flex;
      justify-content: space-between;
      font-size: 0.7rem;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 8px;
      margin-top: auto;
    }

    /* ─── CERTIFICATE VIEW STYLING ─── */
    .certificate-page-wrapper {
      background: #ffffff;
      width: 100%;
      max-width: 840px;
      min-height: 595px;
      padding: 24px;
      box-sizing: border-box;
      border-radius: 8px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
      border: 8px double #d97706;
    }

    .certificate-inner-border {
      border: 2px solid #1e3a8a;
      padding: 36px 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      position: relative;
      background: radial-gradient(circle, #ffffff 60%, #fffbeb 100%);
    }

    .cert-header {
      display: flex;
      flex-direction: column;
      align-items: center;

      .cert-emblem {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: #f59e0b;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 10px rgba(245, 158, 11, 0.4);
        mat-icon { font-size: 36px; width: 36px; height: 36px; }
      }

      .cert-school-name {
        margin: 10px 0 2px;
        font-size: 1.6rem;
        font-weight: 800;
        color: #0f172a;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .cert-school-aff {
        margin: 0;
        font-size: 0.78rem;
        color: #64748b;
        font-weight: 600;
      }

      .cert-title-ribbon {
        margin-top: 14px;
        background: linear-gradient(135deg, #1e3a8a, #2563eb);
        color: #ffffff;
        padding: 6px 24px;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
      }
    }

    .cert-body {
      margin-top: 24px;
      width: 100%;

      .cert-proclamation {
        margin: 0;
        font-size: 0.88rem;
        font-style: italic;
        color: #64748b;
      }

      .cert-student-name {
        margin: 8px 0;
        font-size: 1.7rem;
        font-weight: 800;
        color: #1e3a8a;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        text-decoration: underline #d97706 2px;
        text-underline-offset: 6px;
      }

      .cert-details-text {
        margin: 16px auto;
        max-width: 650px;
        font-size: 0.95rem;
        line-height: 1.6;
        color: #334155;

        strong { color: #0f172a; }
      }

      .cert-highlights-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin: 20px auto;
        max-width: 620px;

        .c-stat {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 10px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);

          .c-lbl { display: block; font-size: 0.68rem; font-weight: 700; color: #64748b; text-transform: uppercase; }
          .c-val { display: block; font-size: 1.05rem; font-weight: 800; color: #1e3a8a; margin-top: 2px; }
        }
      }

      .cert-verdict-box {
        margin-top: 18px;
        padding: 10px 20px;
        background: #f0fdf4;
        border: 2px solid #86efac;
        border-radius: 8px;
        display: inline-block;

        .verdict-lead { margin: 0; font-size: 0.72rem; font-weight: 700; color: #15803d; text-transform: uppercase; }
        .verdict-title { margin: 2px 0 0; font-size: 1.08rem; font-weight: 800; color: #166534; }
      }
    }

    .cert-signatures {
      width: 100%;
      margin-top: 36px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 0 16px;

      .cert-sign-col {
        display: flex;
        flex-direction: column;
        width: 190px;
        text-align: left;

        .date-lbl { font-size: 0.72rem; color: #64748b; }
        .date-val { font-size: 0.82rem; font-weight: 700; color: #0f172a; }

        &.text-right {
          text-align: right;
          align-items: flex-end;
        }

        .sign-line-gold {
          width: 100%;
          height: 1px;
          background: #0f172a;
          margin-bottom: 6px;
        }

        .sign-role { font-size: 0.8rem; font-weight: 800; color: #0f172a; }
        .sign-sub { font-size: 0.72rem; color: #64748b; }
      }

      .cert-seal-center {
        .cert-gold-seal {
          width: 68px;
          height: 68px;
          border-radius: 50%;
          border: 3px double #d97706;
          background: #fffbeb;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #d97706;
          font-size: 0.55rem;
          font-weight: 800;
          box-shadow: 0 4px 10px rgba(217, 119, 6, 0.2);

          mat-icon { font-size: 22px; width: 22px; height: 22px; margin-bottom: 2px; }
        }
      }
    }

    .spin {
      animation: spin 1s linear infinite;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    /* ─── PRINT CSS (A4 Optimized) ─── */
    @media print {
      .no-print {
        display: none !important;
      }
      .report-card-modal-container {
        height: auto !important;
        max-height: none !important;
        background: transparent !important;
        overflow: visible !important;
      }
      .document-scroll-viewport {
        padding: 0 !important;
        overflow: visible !important;
        gap: 0 !important;
      }
      .report-card-page {
        box-shadow: none !important;
        border: none !important;
        width: 100% !important;
        max-width: 100% !important;
        padding: 20mm 15mm !important;
        min-height: auto !important;
      }
      .page-break-always {
        page-break-after: always !important;
        break-after: page !important;
      }
      .certificate-page-wrapper {
        box-shadow: none !important;
        width: 100% !important;
        max-width: 100% !important;
        padding: 10mm !important;
      }
      body {
        background: #ffffff !important;
      }
    }
  `]
})
export class SchoolReportCardDialogComponent implements OnInit {
  currentView: 'marksheet' | 'certificate' = 'marksheet';
  isBulkMode = false;
  activeStudent: ConsolidatedStudentResultDto | null = null;
  studentsToRender: ConsolidatedStudentResultDto[] = [];
  
  instituteName = 'School of Excellence';
  branchAddress = '';
  todayDate = '';
  sendingWhatsApp = false;

  constructor(
    public dialogRef: MatDialogRef<SchoolReportCardDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SchoolReportCardDialogData,
    private schoolService: SchoolService,
    private authService: AuthService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user?.instituteName) {
      this.instituteName = user.instituteName;
    }
    if (user?.branchName) {
      this.branchAddress = user.branchName;
    }

    const today = new Date();
    this.todayDate = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    if (this.data.mode === 'bulk') {
      this.isBulkMode = true;
      this.currentView = 'marksheet';
      this.studentsToRender = this.data.allStudents || [];
      if (this.studentsToRender.length > 0) {
        this.activeStudent = this.studentsToRender[0];
      }
    } else if (this.data.mode === 'certificate') {
      this.isBulkMode = false;
      this.currentView = 'certificate';
      this.activeStudent = this.data.student || null;
      if (this.activeStudent) {
        this.studentsToRender = [this.activeStudent];
      }
    } else {
      this.isBulkMode = false;
      this.currentView = 'marksheet';
      this.activeStudent = this.data.student || null;
      if (this.activeStudent) {
        this.studentsToRender = [this.activeStudent];
      }
    }
  }

  printDocument(): void {
    window.print();
  }

  sendWhatsApp(): void {
    if (!this.activeStudent) return;

    const phone = this.activeStudent.parentWhatsAppPhone;
    if (!phone) {
      this.confirmDialog.alert(
        'WhatsApp Number Missing',
        `Parent's WhatsApp contact number is not recorded for ${this.activeStudent.studentName}. Please update student profile.`,
        'warning'
      );
      return;
    }

    this.sendingWhatsApp = true;
    const payload: SendAnnualResultWhatsAppDto = {
      studentId: this.activeStudent.studentId,
      studentName: this.activeStudent.studentName,
      recipientPhone: phone,
      examTitle: `${this.data.className} ${this.data.examType || 'Annual Examination'}`,
      academicYear: this.data.academicYear,
      totalObtained: this.activeStudent.totalObtained,
      totalMax: this.activeStudent.totalMax,
      percentage: this.activeStudent.overallPercentage,
      grade: this.activeStudent.grade,
      resultStatus: this.activeStudent.resultStatus,
      rank: this.activeStudent.rank > 0 ? this.activeStudent.rank : undefined
    };

    this.schoolService.sendAnnualResultWhatsApp(payload).subscribe({
      next: (res) => {
        this.sendingWhatsApp = false;
        this.confirmDialog.alert('WhatsApp Sent! 📱', res.message || 'Result summary successfully sent to parent.', 'success');
      },
      error: (err) => {
        this.sendingWhatsApp = false;
        // Fallback: Open wa.me web link directly if server gateway fails or mock
        const msg = encodeURIComponent(
          `*${this.instituteName} - ANNUAL EXAM RESULT (${this.data.academicYear})*\n\n` +
          `Dear Parent, performance report for *${this.activeStudent?.studentName}* (Roll: ${this.activeStudent?.rollNumber}, Class: ${this.data.className}):\n` +
          `• Total Marks: *${this.activeStudent?.totalObtained} / ${this.activeStudent?.totalMax}* (${this.activeStudent?.overallPercentage}%)\n` +
          `• Overall Grade: *${this.activeStudent?.grade}* | Class Rank: *#${this.activeStudent?.rank || '1'}*\n` +
          `• Result: *${this.activeStudent?.resultStatus}*\n` +
          `• Verdict: *${this.activeStudent?.promotionVerdict}*\n\n` +
          `Congratulations on completing the academic session!`
        );
        window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
      }
    });
  }
}
