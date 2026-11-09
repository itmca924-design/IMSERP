import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { AuthService } from '../../core/services/auth.service';

export interface ClassAttendanceStudentRow {
  studentId: string;
  studentName: string;
  rollNumber: string;
  schoolRollNumber?: string | null;
  admissionNumber?: string | null;
  className?: string | null;
  sectionName?: string | null;
  profilePhoto?: string | null;
  parentWhatsAppPhone?: string | null;
  status: string;
  remarks?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
}

export interface ClassAttendanceReportDialogData {
  scope: 'school' | 'coaching';
  className: string;
  sectionName?: string;
  batchName?: string;
  attendanceDate: string;
  students: ClassAttendanceStudentRow[];
  teacherName?: string;
}

@Component({
  selector: 'app-class-attendance-report-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatChipsModule
  ],
  template: `
    <div class="class-report-modal">
      <!-- Standard Light Blue Gradient Dialog Header (Strict ERP Rule) -->
      <div class="dialog-header no-print">
        <div class="dialog-icon-box">
          <mat-icon>summarize</mat-icon>
        </div>
        <div class="dialog-title-group">
          <h2 class="dialog-title">Class Attendance Register &amp; Report (A4)</h2>
          <span class="dialog-subtitle">
            <strong>{{ displayTargetName }}</strong> &bull;
            <span>Date: {{ data.attendanceDate | date:'fullDate' }}</span> &bull;
            <span>Present: <strong>{{ presentCount }}</strong>/{{ totalCount }} ({{ attendancePercentage }}%)</span>
          </span>
        </div>
        <button mat-icon-button (click)="closeDialog()" class="dialog-close-btn" matTooltip="Close Dialog">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Action Toolbar (Hidden in Print) -->
      <div class="action-toolbar no-print">
        <div class="filter-chips">
          <button type="button" class="filter-pill" [class.active]="statusFilter === 'ALL'" (click)="statusFilter = 'ALL'">
            <span>All Students ({{ totalCount }})</span>
          </button>
          <button type="button" class="filter-pill absent" [class.active]="statusFilter === 'Absent'" (click)="statusFilter = 'Absent'">
            <mat-icon>cancel</mat-icon>
            <span>Absent Only ({{ absentCount }})</span>
          </button>
          <button type="button" class="filter-pill present" [class.active]="statusFilter === 'Present'" (click)="statusFilter = 'Present'">
            <mat-icon>check_circle</mat-icon>
            <span>Present Only ({{ presentCount }})</span>
          </button>
          @if (lateCount > 0) {
            <button type="button" class="filter-pill late" [class.active]="statusFilter === 'Late'" (click)="statusFilter = 'Late'">
              <mat-icon>schedule</mat-icon>
              <span>Late ({{ lateCount }})</span>
            </button>
          }
          @if (halfDayCount > 0) {
            <button type="button" class="filter-pill halfday" [class.active]="statusFilter === 'HalfDay'" (click)="statusFilter = 'HalfDay'">
              <mat-icon>hourglass_bottom</mat-icon>
              <span>Half-Day ({{ halfDayCount }})</span>
            </button>
          }
        </div>

        <div class="toolbar-actions">
          <button type="button" class="btn-whatsapp-share" (click)="shareClassSummaryWhatsApp()" matTooltip="Share formatted class attendance summary on WhatsApp">
            <mat-icon>share</mat-icon>
            <span>Share on WhatsApp</span>
          </button>
          <button type="button" class="btn-print-doc" (click)="printDocument()" matTooltip="Print official register sheet on A4 paper">
            <mat-icon>print</mat-icon>
            <span>Print Official A4 Sheet</span>
          </button>
        </div>
      </div>

      <!-- Scrollable Document Preview / Printable Area -->
      <div class="document-container">
        <div class="printable-document a4-sheet">

          <!-- Institute Header (100% Dynamic Multi-Tenant) -->
          <div class="report-header">
            <div class="institute-identity">
              @if (instituteLogoUrl && !logoFailed) {
                <img [src]="instituteLogoUrl" (error)="logoFailed = true" alt="Institute Crest" class="institute-logo" />
              }
              <div class="institute-meta">
                <h1 class="institute-name">{{ instituteName }}</h1>
                @if (branchAddress) {
                  <p class="institute-address">{{ branchAddress }}</p>
                }
                <div class="report-badge-strip">
                  <span class="report-type-badge">DAILY ATTENDANCE REGISTER &amp; ROSTER</span>
                  <span class="session-badge">ACADEMIC SESSION: {{ academicSession }}</span>
                </div>
              </div>
            </div>
            <div class="print-meta-right">
              <div class="meta-field">
                <span class="meta-label">Date (IST):</span>
                <strong class="meta-value">{{ data.attendanceDate | date:'dd MMMM yyyy' }}</strong>
              </div>
              <div class="meta-field">
                <span class="meta-label">Day:</span>
                <strong class="meta-value">{{ data.attendanceDate | date:'EEEE' }}</strong>
              </div>
              <div class="meta-field">
                <span class="meta-label">Target:</span>
                <strong class="meta-value">{{ displayTargetName }}</strong>
              </div>
            </div>
          </div>

          <!-- Summary Metric Deck -->
          <div class="summary-metric-deck">
            <div class="metric-card total">
              <span class="label">Total Enrolled</span>
              <span class="val">{{ totalCount }}</span>
            </div>
            <div class="metric-card present">
              <span class="label">Present</span>
              <span class="val">{{ presentCount }} <small>({{ attendancePercentage }}%)</small></span>
            </div>
            <div class="metric-card absent">
              <span class="label">Absent</span>
              <span class="val">{{ absentCount }}</span>
            </div>
            <div class="metric-card late">
              <span class="label">Late Arrivals</span>
              <span class="val">{{ lateCount }}</span>
            </div>
            <div class="metric-card halfday">
              <span class="label">Half Day / Leave</span>
              <span class="val">{{ halfDayCount }}</span>
            </div>
          </div>

          <!-- Students Roster Table -->
          <div class="roster-table-wrapper">
            <table class="roster-table">
              <thead>
                <tr>
                  <th class="col-sn">#</th>
                  <th class="col-roll">Roll No</th>
                  <th class="col-adm">Adm No</th>
                  <th class="col-name">Student Name</th>
                  <th class="col-status">Status</th>
                  <th class="col-timing">Timings (IST)</th>
                  <th class="col-phone">Parent Contact</th>
                  <th class="col-action no-print">Quick WhatsApp</th>
                  <th class="col-sign print-only">Student / Parent Sign</th>
                </tr>
              </thead>
              <tbody>
                @for (student of filteredStudents; track student.studentId; let idx = $index) {
                  <tr [class.row-absent]="student.status === 'Absent'" [class.row-late]="student.status === 'Late'">
                    <td class="col-sn">{{ idx + 1 }}</td>
                    <td class="col-roll">
                      <strong>{{ student.schoolRollNumber || student.rollNumber || '—' }}</strong>
                    </td>
                    <td class="col-adm">{{ student.admissionNumber || '—' }}</td>
                    <td class="col-name">
                      <div class="student-name-box">
                        <span class="s-name">{{ student.studentName }}</span>
                        @if (student.sectionName) {
                          <span class="s-sec">{{ student.sectionName }}</span>
                        }
                      </div>
                    </td>
                    <td class="col-status">
                      <span class="status-pill-badge" [ngClass]="student.status.toLowerCase()">
                        {{ student.status === 'HalfDay' ? 'Half Day' : student.status }}
                      </span>
                    </td>
                    <td class="col-timing">
                      @if (student.status !== 'Absent' && (student.checkInTime || student.checkOutTime)) {
                        <span>{{ student.checkInTime || '—' }} to {{ student.checkOutTime || '—' }}</span>
                      } @else {
                        <span class="text-muted">—</span>
                      }
                    </td>
                    <td class="col-phone">
                      <span>{{ student.parentWhatsAppPhone || '—' }}</span>
                    </td>
                    <td class="col-action no-print">
                      @if (student.parentWhatsAppPhone) {
                        <button type="button" class="btn-wa-single" (click)="sendParentWhatsAppAlert(student)" matTooltip="Send attendance alert to parent via WhatsApp">
                          <mat-icon>chat</mat-icon>
                          <span>Alert Parent</span>
                        </button>
                      } @else {
                        <button type="button" class="btn-wa-single missing" (click)="promptParentPhoneAndSend(student)" matTooltip="Enter parent phone number and send WhatsApp alert">
                          <mat-icon>add_call</mat-icon>
                          <span>Add &amp; Send</span>
                        </button>
                      }
                    </td>
                    <td class="col-sign print-only">
                      <div class="sign-blank"></div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Official Signatures Footer Block -->
          <div class="report-footer">
            <div class="sign-block">
              <div class="sig-space"></div>
              <div class="sign-rule"></div>
              <span class="sign-title">Class Teacher / Incharge</span>
              <span class="sign-name">{{ classTeacherName }}</span>
            </div>

            <div class="sign-block center">
              <div class="sig-space"></div>
              <div class="sign-rule"></div>
              <span class="sign-title">Academic Coordinator</span>
              <span class="sign-name">Examination &amp; Attendance Cell</span>
            </div>

            <div class="sign-block right">
              <div class="sig-space">
                @if (digitalSignatureUrl) {
                  <img [src]="digitalSignatureUrl" alt="Principal Signature" class="digital-sign-img" />
                }
              </div>
              <div class="sign-rule"></div>
              <span class="sign-title">Principal / Director</span>
              <span class="sign-name">{{ instituteName }}</span>
            </div>
          </div>

          <div class="disclaimer-strip print-only">
            <span>Generated on {{ generatedOnDate }} IST via IMSERP Smart Education Management System. Official Attendance Record.</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .class-report-modal {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
    }

    /* ─── Header Styling Matching Strict ERP Light Blue Gradient Rule ─── */
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
      flex-shrink: 0;

      .dialog-icon-box {
        background: #2563eb;
        color: #ffffff;
        border-radius: 10px;
        box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
        width: 42px;
        height: 42px;
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

      .dialog-title-group {
        flex: 1;

        .dialog-title {
          margin: 0;
          font-size: 1.18rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.25;
        }

        .dialog-subtitle {
          font-size: 0.84rem;
          color: #3b82f6;
          margin-top: 3px;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;

          strong {
            color: #1e40af;
          }
        }
      }

      .dialog-close-btn {
        color: #64748b;
        &:hover {
          color: #1e293b;
          background: #e2e8f0;
        }
      }
    }

    /* ─── Action Toolbar ─── */
    .action-toolbar {
      padding: 12px 20px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      flex-shrink: 0;

      .filter-chips {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;

        .filter-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 12px;
          border-radius: 20px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;

          mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
          }

          &:hover {
            border-color: #94a3b8;
            background: #f1f5f9;
          }

          &.active {
            background: #1e40af;
            color: #ffffff;
            border-color: #1e40af;

            &.absent {
              background: #dc2626;
              border-color: #dc2626;
            }
            &.present {
              background: #16a34a;
              border-color: #16a34a;
            }
            &.late {
              background: #d97706;
              border-color: #d97706;
            }
            &.halfday {
              background: #7c3aed;
              border-color: #7c3aed;
            }
          }
        }
      }

      .toolbar-actions {
        display: flex;
        align-items: center;
        gap: 10px;

        .btn-whatsapp-share {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #25d366;
          color: #ffffff;
          border: none;
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(37, 211, 102, 0.25);
          transition: background 0.15s ease;

          &:hover {
            background: #1ebc59;
          }

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
          }
        }

        .btn-print-doc {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 7px 16px;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);
          transition: background 0.15s ease;

          &:hover {
            background: #1d4ed8;
          }

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
          }
        }
      }
    }

    /* ─── Document Container ─── */
    .document-container {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      background: #f1f5f9;
      display: flex;
      justify-content: center;
    }

    .a4-sheet {
      width: 100%;
      max-width: 820px;
      background: #ffffff;
      padding: 30px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* ─── Institute Header ─── */
    .report-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      border-bottom: 2px solid #1e3a8a;
      padding-bottom: 14px;

      .institute-identity {
        display: flex;
        align-items: center;
        gap: 14px;

        .institute-logo {
          max-height: 60px;
          max-width: 65px;
          object-fit: contain;
        }

        .institute-meta {
          .institute-name {
            margin: 0;
            font-size: 1.35rem;
            font-weight: 800;
            color: #1e3a8a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .institute-address {
            margin: 2px 0 6px;
            font-size: 0.8rem;
            color: #475569;
          }

          .report-badge-strip {
            display: flex;
            align-items: center;
            gap: 8px;

            .report-type-badge {
              background: #1e3a8a;
              color: #ffffff;
              font-size: 0.72rem;
              font-weight: 700;
              padding: 2px 8px;
              border-radius: 4px;
              letter-spacing: 0.5px;
            }

            .session-badge {
              font-size: 0.72rem;
              font-weight: 700;
              color: #3b82f6;
              border: 1px solid #bfdbfe;
              padding: 1px 7px;
              border-radius: 4px;
              background: #eff6ff;
            }
          }
        }
      }

      .print-meta-right {
        text-align: right;
        display: flex;
        flex-direction: column;
        gap: 2px;

        .meta-field {
          font-size: 0.8rem;
          color: #64748b;

          .meta-label {
            margin-right: 4px;
          }

          .meta-value {
            color: #0f172a;
          }
        }
      }
    }

    /* ─── Summary Metric Deck ─── */
    .summary-metric-deck {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;

      .metric-card {
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        display: flex;
        flex-direction: column;

        .label {
          font-size: 0.72rem;
          text-transform: uppercase;
          color: #64748b;
          font-weight: 600;
        }

        .val {
          font-size: 1.15rem;
          font-weight: 800;
          color: #0f172a;
          margin-top: 2px;

          small {
            font-size: 0.75rem;
            font-weight: 600;
            color: #16a34a;
          }
        }

        &.present {
          border-color: #bbf7d0;
          background: #f0fdf4;
          .val { color: #15803d; }
        }

        &.absent {
          border-color: #fecaca;
          background: #fef2f2;
          .val { color: #b91c1c; }
        }

        &.late {
          border-color: #fed7aa;
          background: #fff7ed;
          .val { color: #c2410c; }
        }

        &.halfday {
          border-color: #ddd6fe;
          background: #faf5ff;
          .val { color: #6d28d9; }
        }
      }
    }

    /* ─── Roster Table ─── */
    .roster-table-wrapper {
      width: 100%;
      overflow-x: auto;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
    }

    .roster-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;

      th {
        background: #f1f5f9;
        color: #334155;
        font-weight: 700;
        text-align: left;
        padding: 8px 10px;
        border-bottom: 2px solid #cbd5e1;
        white-space: nowrap;
      }

      td {
        padding: 7px 10px;
        border-bottom: 1px solid #e2e8f0;
        color: #1e293b;
        vertical-align: middle;
      }

      tr:nth-child(even) {
        background: #fafafa;
      }

      tr.row-absent {
        background: #fff5f5;
      }

      tr.row-late {
        background: #fffbeb;
      }

      .col-sn { width: 35px; text-align: center; }
      .col-roll { width: 75px; }
      .col-adm { width: 100px; }
      .col-name { min-width: 150px; }
      .col-status { width: 85px; }
      .col-timing { width: 130px; }
      .col-phone { width: 110px; }
      .col-action { width: 110px; text-align: center; }
      .col-sign { width: 120px; }

      .student-name-box {
        display: flex;
        flex-direction: column;
        .s-name { font-weight: 600; color: #0f172a; }
        .s-sec { font-size: 0.72rem; color: #64748b; }
      }

      .status-pill-badge {
        display: inline-block;
        padding: 2px 7px;
        border-radius: 4px;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;

        &.present { background: #dcfce7; color: #166534; }
        &.absent { background: #fee2e2; color: #991b1b; }
        &.late { background: #fef3c7; color: #92400e; }
        &.halfday { background: #f3e8ff; color: #6b21a8; }
      }

      .btn-wa-single {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        color: #065f46;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 0.72rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          background: #10b981;
          color: #ffffff;
          border-color: #10b981;
        }

        mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
        }

        &.missing {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1d4ed8;
          &:hover {
            background: #2563eb;
            color: #ffffff;
            border-color: #2563eb;
          }
        }
      }
    }

    /* ─── Footer Signatures ─── */
    .report-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 24px;
      padding-top: 10px;

      .sign-block {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 160px;
        text-align: center;

        .sig-space {
          height: 44px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          width: 100%;

          .digital-sign-img {
            max-height: 42px;
            max-width: 130px;
            object-fit: contain;
            mix-blend-mode: multiply;
          }
        }

        .sign-rule {
          width: 150px;
          border-bottom: 1.5px solid #0f172a;
          margin-top: 2px;
        }

        .sign-title {
          font-size: 0.78rem;
          font-weight: 700;
          color: #0f172a;
          margin-top: 4px;
        }

        .sign-name {
          font-size: 0.7rem;
          color: #64748b;
        }
      }
    }

    .disclaimer-strip {
      text-align: center;
      font-size: 0.68rem;
      color: #94a3b8;
      border-top: 1px dashed #cbd5e1;
      padding-top: 6px;
      margin-top: 10px;
    }

    .print-only {
      display: none;
    }

    /* ─── Clean A4 Print Media Styles (Strict ERP Rule) ─── */
    @media print {
      body * {
        visibility: hidden !important;
      }

      .no-print {
        display: none !important;
      }

      .print-only {
        display: table-cell !important;
      }

      div.print-only {
        display: block !important;
      }

      .printable-document, .printable-document * {
        visibility: visible !important;
      }

      .class-report-modal {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }

      .document-container {
        padding: 0 !important;
        background: transparent !important;
        overflow: visible !important;
      }

      .a4-sheet {
        box-shadow: none !important;
        border: none !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 4mm 6mm !important;
      }

      .sign-blank {
        width: 100%;
        height: 20px;
        border-bottom: 1px dotted #94a3b8;
      }

      @page {
        size: A4 portrait;
        margin: 8mm 10mm;
      }
    }
  `]
})
export class ClassAttendanceReportDialogComponent implements OnInit {
  statusFilter: 'ALL' | 'Present' | 'Absent' | 'Late' | 'HalfDay' = 'ALL';
  logoFailed = false;
  generatedOnDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

  get instituteName(): string {
    return this.authService.getInstituteName() || 'Institution';
  }

  get instituteLogoUrl(): string | null {
    return this.authService.getInstituteLogoUrl();
  }

  get digitalSignatureUrl(): string | null {
    return this.authService.getDigitalSignatureUrl();
  }

  get branchAddress(): string {
    const user = this.authService.currentUser();
    const activeBranchId = this.authService.selectedBranchId() || user?.branchId;
    const branch = user?.branches?.find(b => b.id === activeBranchId);
    if (branch) {
      const parts = [branch.address, branch.city, branch.state ? (branch.pincode ? `${branch.state} - ${branch.pincode}` : branch.state) : branch.pincode].filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
      return branch.name || user?.branchName || '';
    }
    return user?.branchName || '';
  }

  get academicSession(): string {
    const d = new Date(this.data.attendanceDate || new Date());
    const yr = d.getFullYear();
    const m = d.getMonth() + 1;
    return m >= 4 ? `${yr}-${yr + 1}` : `${yr - 1}-${yr}`;
  }

  get displayTargetName(): string {
    if (this.data.scope === 'school') {
      const cls = this.data.className || 'Class';
      const sec = this.data.sectionName && this.data.sectionName !== 'All Sections' ? ` (Section ${this.data.sectionName})` : '';
      return `${cls}${sec}`;
    }
    return this.data.batchName || this.data.className || 'Coaching Batch';
  }

  get classTeacherName(): string {
    return this.data.teacherName || this.authService.currentUser()?.fullName || 'Class Teacher';
  }

  get totalCount(): number {
    return this.data.students?.length || 0;
  }

  get presentCount(): number {
    return (this.data.students || []).filter(s => s.status === 'Present').length;
  }

  get absentCount(): number {
    return (this.data.students || []).filter(s => s.status === 'Absent').length;
  }

  get lateCount(): number {
    return (this.data.students || []).filter(s => s.status === 'Late').length;
  }

  get halfDayCount(): number {
    return (this.data.students || []).filter(s => s.status === 'HalfDay').length;
  }

  get attendancePercentage(): number {
    if (this.totalCount === 0) return 0;
    return Math.round((this.presentCount / this.totalCount) * 100);
  }

  get filteredStudents(): ClassAttendanceStudentRow[] {
    const list = this.data.students || [];
    if (this.statusFilter === 'ALL') return list;
    return list.filter(s => s.status === this.statusFilter);
  }

  constructor(
    public dialogRef: MatDialogRef<ClassAttendanceReportDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ClassAttendanceReportDialogData,
    private authService: AuthService
  ) {}

  ngOnInit(): void {}

  closeDialog(): void {
    this.dialogRef.close();
  }

  printDocument(): void {
    window.print();
  }

  cleanPhone(phone: string): string {
    if (!phone) return '';
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 10) cleaned = '91' + cleaned;
    return cleaned;
  }

  /**
   * Generates and shares a structured, professional WhatsApp summary message
   * to the class group or administrative staff.
   */
  shareClassSummaryWhatsApp(): void {
    const dStr = new Date(this.data.attendanceDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const absents = (this.data.students || [])
      .filter(s => s.status === 'Absent')
      .map(s => `• ${s.schoolRollNumber || s.rollNumber || '—'}: ${s.studentName}`);

    const absentListStr = absents.length > 0
      ? absents.join('\n')
      : 'None (100% Present!)';

    const msg =
`📋 *${this.instituteName.toUpperCase()}*
*DAILY CLASS ATTENDANCE REPORT*
━━━━━━━━━━━━━━━━━━
🏫 *Class / Batch:* ${this.displayTargetName}
📅 *Date:* ${dStr}
👥 *Total Enrolled:* ${this.totalCount}
✅ *Present:* ${this.presentCount} (${this.attendancePercentage}%)
❌ *Absent:* ${this.absentCount}
⏰ *Late / Half Day:* ${this.lateCount + this.halfDayCount}
━━━━━━━━━━━━━━━━━━
🔴 *Absent Students List:*
${absentListStr}
━━━━━━━━━━━━━━━━━━
👨‍🏫 *Teacher Incharge:* ${this.classTeacherName}
_Generated via IMSERP Smart Campus_`;

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  /**
   * Sends an official individual absence notice to the parent on WhatsApp
   */
  sendParentWhatsAppAlert(student: ClassAttendanceStudentRow): void {
    const phone = this.cleanPhone(student.parentWhatsAppPhone || '');
    if (!phone) {
      this.promptParentPhoneAndSend(student);
      return;
    }

    const dStr = new Date(this.data.attendanceDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const rollStr = student.schoolRollNumber || student.rollNumber ? ` (Roll: ${student.schoolRollNumber || student.rollNumber})` : '';
    const statusText = student.status === 'Absent' ? 'ABSENT' : student.status.toUpperCase();

    const msg =
`Dear Parent,
This is an official attendance notice from *${this.instituteName}*.

Your ward *${student.studentName}*${rollStr}, ${this.displayTargetName}, was marked *${statusText}* on *${dStr}*.

If this was unplanned or in case of illness, please notify the school office / class teacher.
Regards,
*${this.instituteName}*`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  promptParentPhoneAndSend(student: ClassAttendanceStudentRow): void {
    const phoneInput = window.prompt(`Enter parent WhatsApp mobile number for ${student.studentName}:`, student.parentWhatsAppPhone || '');
    if (!phoneInput) return;
    student.parentWhatsAppPhone = phoneInput.trim();
    this.sendParentWhatsAppAlert(student);
  }
}

