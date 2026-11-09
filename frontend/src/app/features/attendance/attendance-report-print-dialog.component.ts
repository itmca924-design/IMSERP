import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';

export interface ReportPrintRow {
  personId: string;
  personName: string;
  code: string;
  groupName: string;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  holidayDays: number;
  totalWorkingDays: number;
  attendancePercentage: number;
  schoolClass?: string | null;
  coachingBatch?: string | null;
  schoolRoll?: string | null;
  coachingRoll?: string | null;
}

export interface AttendanceReportPrintDialogData {
  reportType: 'student' | 'teacher';
  month: number;
  year: number;
  monthName: string;
  scopeText: string;
  totalCount: number;
  rows: ReportPrintRow[];
  totalWorkingDays: number;
  elapsedWorkingDays?: number;
}

@Component({
  selector: 'app-attendance-report-print-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <div class="print-preview-modal">
      <!-- Standard Light Blue Gradient Dialog Header (Strict ERP Rule) -->
      <div class="dialog-header no-print">
        <div class="dialog-icon-box">
          <mat-icon>print</mat-icon>
        </div>
        <div class="dialog-title-group">
          <h2 class="dialog-title">Official Attendance Report &amp; Register Preview (A4)</h2>
          <span class="dialog-subtitle">
            <strong>{{ data.scopeText }}</strong> &bull;
            <span>{{ data.monthName }} {{ data.year }}</span> &bull;
            <span>Total: <strong>{{ data.rows.length }}</strong> {{ data.reportType === 'student' ? 'Students' : 'Faculty' }}</span> &bull;
            <span>Avg Attendance: <strong>{{ avgPercentage }}%</strong></span>
          </span>
        </div>
        <button mat-icon-button (click)="closeDialog()" class="dialog-close-btn" matTooltip="Close Dialog">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Action Toolbar (Hidden in Print) -->
      <div class="action-toolbar no-print">
        <div class="filter-chips">
          <button type="button" class="filter-pill" [class.active]="filterMode === 'ALL'" (click)="filterMode = 'ALL'">
            <span>All ({{ data.rows.length }})</span>
          </button>
          <button type="button" class="filter-pill present" [class.active]="filterMode === 'HIGH'" (click)="filterMode = 'HIGH'" title="75% and above">
            <mat-icon>check_circle</mat-icon>
            <span>&ge; 75% ({{ highAttendanceCount }})</span>
          </button>
          <button type="button" class="filter-pill absent" [class.active]="filterMode === 'LOW'" (click)="filterMode = 'LOW'" title="Less than 75% shortage">
            <mat-icon>warning</mat-icon>
            <span>&lt; 75% ({{ lowAttendanceCount }})</span>
          </button>
        </div>

        <div class="toolbar-actions">
          @if (availableClasses.length > 0) {
            <div class="class-wa-deck">
              <select class="class-select-dropdown" [(ngModel)]="selectedWaClass">
                <option value="" disabled selected>Class...</option>
                @for (cls of availableClasses; track cls) {
                  <option [value]="cls">{{ cls }} ({{ getClassStudentCount(cls) }})</option>
                }
              </select>
              <button matButton="filled" class="mat-action-btn btn-class-whatsapp" (click)="shareSpecificClassWhatsApp()" [disabled]="!selectedWaClass" title="Send selected class WhatsApp roster">
                <mat-icon>chat</mat-icon>
                <span>Send Class</span>
              </button>
            </div>
          }
          <button matButton="filled" class="mat-action-btn btn-whatsapp-share" (click)="shareSummaryWhatsApp()" title="Share overall attendance summary on WhatsApp">
            <mat-icon>share</mat-icon>
            <span>Summary</span>
          </button>
          <button matButton="filled" color="primary" class="mat-action-btn btn-print-doc" (click)="printDocument()" title="Print or save as PDF">
            <mat-icon>print</mat-icon>
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      <!-- Scrollable Preview Area -->
      <div class="document-container">
        <div class="printable-document a4-sheet" id="printable-attendance-register">

          <!-- Official Institute Header (100% Dynamic Multi-Tenant) -->
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
                  <span class="report-type-badge">
                    {{ data.reportType === 'student' ? 'MONTHLY STUDENT ATTENDANCE REGISTER & COMPLIANCE' : 'FACULTY MONTHLY ATTENDANCE REGISTER & WORK REPORT' }}
                  </span>
                  <span class="period-badge">{{ data.monthName | uppercase }} {{ data.year }}</span>
                  <span class="session-badge">SESSION: {{ academicSession }}</span>
                </div>
              </div>
            </div>
            <div class="print-meta-right">
              <div class="meta-field">
                <span class="meta-label">Scope:</span>
                <strong class="meta-value">{{ data.scopeText }}</strong>
              </div>
              <div class="meta-field">
                <span class="meta-label">Working Days:</span>
                <strong class="meta-value">{{ data.totalWorkingDays }} Days</strong>
              </div>
              <div class="meta-field">
                <span class="meta-label">Generated:</span>
                <strong class="meta-value">{{ generatedOnDate }}</strong>
              </div>
            </div>
          </div>

          <!-- Summary Metric Deck -->
          <div class="summary-metric-deck">
            <div class="metric-card total">
              <span class="label">Total {{ data.reportType === 'student' ? 'Students' : 'Faculty' }}</span>
              <span class="val">{{ data.rows.length }}</span>
            </div>
            <div class="metric-card present">
              <span class="label">Avg Compliance</span>
              <span class="val">{{ avgPercentage }}%</span>
            </div>
            <div class="metric-card high">
              <span class="label">Regular (&ge; 75%)</span>
              <span class="val">{{ highAttendanceCount }}</span>
            </div>
            <div class="metric-card shortage">
              <span class="label">Shortage (&lt; 75%)</span>
              <span class="val">{{ lowAttendanceCount }}</span>
            </div>
            <div class="metric-card days">
              <span class="label">Total Working Days</span>
              <span class="val">{{ data.totalWorkingDays }}</span>
            </div>
          </div>

          <!-- Roster Table -->
          <div class="roster-table-wrapper">
            <table class="roster-table">
              <thead>
                <tr>
                  <th class="col-sn">#</th>
                  <th class="col-code">{{ data.reportType === 'student' ? 'Roll No' : 'Code' }}</th>
                  <th class="col-name">{{ data.reportType === 'student' ? 'Student Name' : 'Faculty Name' }}</th>
                  <th class="col-group">{{ data.reportType === 'student' ? 'Class / Section' : 'Department' }}</th>
                  <th class="col-num">Present</th>
                  <th class="col-num">Absent</th>
                  <th class="col-num">Late</th>
                  <th class="col-num">Half Days</th>
                  <th class="col-num">Total Held</th>
                  <th class="col-pct">Attendance %</th>
                  <th class="col-sign print-only">Student / Parent Sign</th>
                </tr>
              </thead>
              <tbody>
                @for (row of filteredRows; track row.personId; let idx = $index) {
                  <tr [class.row-shortage]="row.attendancePercentage < 75" [class.row-high]="row.attendancePercentage >= 90">
                    <td class="col-sn">{{ idx + 1 }}</td>
                    <td class="col-code">
                      <strong>{{ row.schoolRoll || row.code || '—' }}</strong>
                    </td>
                    <td class="col-name">
                      <div class="name-cell-wrap">
                        <span class="person-name">{{ row.personName }}</span>
                        <button type="button" class="btn-row-wa no-print" (click)="shareIndividualStudentWhatsApp(row)" title="Send individual attendance slip on WhatsApp">
                          <mat-icon>chat</mat-icon>
                        </button>
                      </div>
                    </td>
                    <td class="col-group">
                      <span>{{ row.schoolClass || row.groupName || '—' }}</span>
                    </td>
                    <td class="col-num present-num">
                      <strong>{{ row.presentDays }}</strong>
                    </td>
                    <td class="col-num absent-num">
                      <span [class.text-danger]="row.absentDays > 0">{{ row.absentDays }}</span>
                    </td>
                    <td class="col-num late-num">{{ row.lateDays }}</td>
                    <td class="col-num">{{ row.halfDays }}</td>
                    <td class="col-num">{{ row.totalWorkingDays }}</td>
                    <td class="col-pct">
                      <span class="pct-badge" [ngClass]="row.attendancePercentage >= 75 ? 'pct-good' : 'pct-low'">
                        {{ row.attendancePercentage }}%
                      </span>
                    </td>
                    <td class="col-sign print-only">
                      <div class="sign-blank"></div>
                    </td>
                  </tr>
                }
                @if (filteredRows.length === 0) {
                  <tr>
                    <td colspan="11" class="text-center text-muted" style="padding: 24px;">
                      No records match the selected filter criteria.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Official Footer Signatures -->
          <div class="report-footer">
            <div class="sign-block">
              <div class="sig-space"></div>
              <div class="sign-rule"></div>
              <span class="sign-title">Prepared By / Class Incharge</span>
              <span class="sign-name">{{ activeUserName }}</span>
            </div>

            <div class="sign-block center">
              <div class="sig-space"></div>
              <div class="sign-rule"></div>
              <span class="sign-title">Academic &amp; Attendance Cell</span>
              <span class="sign-name">Examination &amp; Compliance Authority</span>
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
            <span>Generated on {{ generatedOnDate }} IST via IMSERP Smart Campus. Official Academic Record.</span>
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

    .print-preview-modal {
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
      padding: 8px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: nowrap; /* Stays strictly on one line on desktop */
      flex-shrink: 0;

      .filter-chips {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: nowrap;
        flex-shrink: 0;

        .filter-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          border-radius: 20px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;

          mat-icon {
            font-size: 15px;
            width: 15px;
            height: 15px;
          }

          &:hover {
            border-color: #94a3b8;
            background: #f1f5f9;
          }

          &.active {
            background: #1e40af;
            color: #ffffff;
            border-color: #1e40af;

            &.present {
              background: #16a34a;
              border-color: #16a34a;
            }
            &.absent {
              background: #dc2626;
              border-color: #dc2626;
            }
          }
        }
      }

      .toolbar-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: nowrap;
        flex-shrink: 0;

        .class-wa-deck {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #f0fdf4;
          border: 1.5px solid #86efac;
          padding: 2px 3px 2px 8px;
          border-radius: 10px;
          flex-shrink: 0;
          box-sizing: border-box;

          .class-select-dropdown {
            border: 1px solid #bbf7d0;
            background: #ffffff;
            color: #166534;
            font-size: 0.8rem;
            font-weight: 700;
            padding: 0 8px;
            height: 32px;
            line-height: 32px;
            border-radius: 6px;
            outline: none;
            cursor: pointer;
            max-width: 170px;

            &:focus {
              border-color: #16a34a;
            }
          }

          .btn-class-whatsapp {
            height: 32px !important;
            min-height: 32px !important;
            line-height: 32px !important;
            padding: 0 10px !important;
            border-radius: 6px !important;
            font-size: 0.8rem !important;
          }
        }

        .mat-action-btn {
          height: 36px !important;
          min-height: 36px !important;
          border-radius: 8px !important;
          font-size: 0.82rem !important;
          font-weight: 600 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 6px !important;
          padding: 0 14px !important;
          white-space: nowrap !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.2) !important;
          transition: all 0.15s ease !important;

          .mdc-button__label {
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }

          mat-icon {
            font-size: 18px !important;
            width: 18px !important;
            height: 18px !important;
            line-height: 18px !important;
            margin-right: 1px !important;
          }

          &.btn-class-whatsapp {
            background-color: #16a34a !important;
            color: #ffffff !important;

            &:hover:not([disabled]) {
              background-color: #15803d !important;
              box-shadow: 0 2px 6px rgba(22, 163, 74, 0.35) !important;
            }

            &[disabled],
            &:disabled {
              background-color: #86efac !important;
              color: #f0fdf4 !important;
              opacity: 0.65 !important;
              cursor: not-allowed !important;
              box-shadow: none !important;
            }
          }

          &.btn-whatsapp-share {
            background-color: #059669 !important;
            color: #ffffff !important;

            &:hover:not([disabled]) {
              background-color: #047857 !important;
              box-shadow: 0 2px 6px rgba(5, 150, 105, 0.35) !important;
            }
          }

          &.btn-print-doc {
            background-color: #2563eb !important;
            color: #ffffff !important;

            &:hover:not([disabled]) {
              background-color: #1d4ed8 !important;
              box-shadow: 0 2px 6px rgba(37, 99, 235, 0.35) !important;
            }
          }
        }
      }
    }

    /* ─── Document Container ─── */
    .document-container {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px;
      background: #f1f5f9;
      display: flex;
      justify-content: center;
      align-items: flex-start;

      /* Sleek modern scrollbar */
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 transparent;
      &::-webkit-scrollbar { width: 6px; }
      &::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }
      &::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    }

    .a4-sheet {
      width: 100%;
      max-width: 1140px;
      min-height: auto;
      background: #ffffff;
      padding: 32px 36px;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

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
          max-height: 58px;
          max-width: 62px;
          object-fit: contain;
        }

        .institute-meta {
          .institute-name {
            margin: 0;
            font-size: 1.3rem;
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
            }

            .period-badge {
              font-size: 0.72rem;
              font-weight: 700;
              color: #2563eb;
              border: 1px solid #bfdbfe;
              padding: 1px 7px;
              border-radius: 4px;
              background: #eff6ff;
            }

            .session-badge {
              font-size: 0.72rem;
              font-weight: 600;
              color: #64748b;
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
          .meta-label { margin-right: 4px; }
          .meta-value { color: #0f172a; }
        }
      }
    }

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
        }

        &.present { border-color: #bbf7d0; background: #f0fdf4; .val { color: #15803d; } }
        &.high { border-color: #bfdbfe; background: #eff6ff; .val { color: #1d4ed8; } }
        &.shortage { border-color: #fecaca; background: #fef2f2; .val { color: #b91c1c; } }
      }
    }

    .roster-table-wrapper {
      width: 100%;
      min-height: 260px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow-x: auto;
      overflow-y: visible;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 #f8fafc;
      &::-webkit-scrollbar { width: 6px; height: 6px; }
      &::-webkit-scrollbar-track { background: #f8fafc; }
      &::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      &::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    }

    .roster-table {
      width: 100%;
      min-width: 900px;
      border-collapse: collapse;
      font-size: 0.84rem;

      th {
        background: #f8fafc;
        color: #1e293b;
        font-weight: 700;
        text-align: left;
        padding: 11px 12px;
        border-bottom: 2px solid #cbd5e1;
        white-space: nowrap;
      }

      td {
        padding: 10px 12px;
        border-bottom: 1px solid #e2e8f0;
        color: #1e293b;
        vertical-align: middle;
      }

      tr:nth-child(even) { background: #fafafa; }
      tr.row-shortage { background: #fff5f5; }

      .col-sn { width: 45px; text-align: center; }
      .col-code { width: 90px; text-align: center; }
      .col-name {
        min-width: 170px;
        font-weight: 600;

        .name-cell-wrap {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .btn-row-wa {
          border: none;
          background: #f0fdf4;
          color: #16a34a;
          width: 26px;
          height: 26px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;

          &:hover {
            background: #16a34a;
            color: #ffffff;
            transform: scale(1.08);
          }

          mat-icon { font-size: 15px; width: 15px; height: 15px; }
        }
      }
      .col-group { min-width: 130px; }
      .col-num { width: 75px; text-align: center; }
      .col-pct { width: 115px; text-align: center; white-space: nowrap; }
      .col-sign { width: 140px; }

      .present-num { color: #166534; font-weight: 700; }
      .absent-num { font-weight: 600; }
      .text-danger { color: #dc2626; }

      .pct-badge {
        display: inline-block;
        padding: 2px 7px;
        border-radius: 4px;
        font-size: 0.76rem;
        font-weight: 700;

        &.pct-good { background: #dcfce7; color: #166534; }
        &.pct-low { background: #fee2e2; color: #991b1b; }
      }
    }

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
          height: 42px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          width: 100%;

          .digital-sign-img {
            max-height: 40px;
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

        .sign-name { font-size: 0.7rem; color: #64748b; }
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

    .print-only { display: none; }

    /* ─── Tablet Responsiveness (641px - 1024px) ─── */
    @media (max-width: 1024px) {
      .print-preview-modal {
        max-height: 96vh;
      }
      .action-toolbar {
        padding: 8px 12px;
        gap: 8px;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      .document-container {
        padding: 16px 12px;
      }
      .a4-sheet {
        padding: 20px 16px;
      }
      .summary-metric-deck {
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }
      .report-footer {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 12px;
        width: 100%;

        .sign-block {
          min-width: 0;
          flex: 1;

          .sign-rule {
            width: 120px;
            max-width: 90%;
          }
        }
      }
    }

    /* ─── Mobile Responsiveness (≤ 640px) ─── */
    @media (max-width: 640px) {
      .print-preview-modal {
        max-height: 100dvh;
        height: 100dvh;
        border-radius: 0;
      }

      .dialog-header {
        padding: 10px 12px;
        gap: 10px;

        .dialog-icon-box {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }

        .dialog-title {
          font-size: 0.95rem;
        }

        .dialog-subtitle {
          font-size: 0.72rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      }

      .action-toolbar {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        padding: 8px 10px;
        flex-wrap: wrap;

        .filter-chips {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          flex-wrap: nowrap;
          padding-bottom: 2px;
        }

        .toolbar-actions {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;

          .class-wa-deck {
            grid-column: span 2;
            width: 100%;
            display: flex;
            box-sizing: border-box;

            .class-select-dropdown {
              flex: 1;
              min-width: 0;
              max-width: none;
            }
            .btn-class-whatsapp {
              flex-shrink: 0;
            }
          }

          .btn-whatsapp-share,
          .btn-print-doc {
            width: 100%;
            justify-content: center;
            padding: 8px 10px;
            font-size: 0.8rem;
          }
        }
      }

      .document-container {
        padding: 8px;
      }

      .a4-sheet {
        padding: 14px 10px;
        gap: 12px;
        border-radius: 6px;
      }

      .report-header {
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 8px;

        .institute-identity {
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 6px;

          .institute-logo {
            max-height: 44px;
            max-width: 48px;
          }
          .institute-name {
            font-size: 1.05rem;
          }
          .report-badge-strip {
            justify-content: center;
          }
        }

        .print-meta-right {
          text-align: center;
          align-items: center;
        }
      }

      .summary-metric-deck {
        grid-template-columns: repeat(2, 1fr);
        gap: 6px;

        .metric-card:last-child:nth-child(odd) {
          grid-column: span 2;
        }
      }

      .roster-table-wrapper {
        min-height: auto;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      .report-footer {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        margin-top: 20px;
        padding-top: 12px;
        width: 100%;
        box-sizing: border-box;

        .sign-block {
          width: 100%;
          max-width: 260px;
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;

          .sig-space {
            height: 38px;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            width: 100%;

            .digital-sign-img {
              max-height: 36px;
              max-width: 120px;
              object-fit: contain;
              mix-blend-mode: multiply;
            }
          }

          .sign-rule {
            width: 180px;
            max-width: 85%;
            border-bottom: 1.5px solid #0f172a;
            margin-top: 2px;
          }

          .sign-title {
            font-size: 0.82rem;
            font-weight: 700;
            color: #0f172a;
            margin-top: 4px;
            white-space: normal;
          }

          .sign-name {
            font-size: 0.72rem;
            color: #64748b;
            white-space: normal;
          }
        }
      }
    }

    @media print {
      body * { visibility: hidden !important; }
      .no-print { display: none !important; }
      .print-only { display: table-cell !important; }
      div.print-only { display: block !important; }
      .printable-document, .printable-document * { visibility: visible !important; }

      .print-preview-modal {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
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
export class AttendanceReportPrintDialogComponent implements OnInit, OnDestroy {
  filterMode: 'ALL' | 'HIGH' | 'LOW' = 'ALL';
  selectedWaClass: string = '';
  logoFailed = false;
  generatedOnDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

  get instituteName(): string { return this.authService.getInstituteName() || 'Institution'; }
  get instituteLogoUrl(): string | null { return this.authService.getInstituteLogoUrl(); }
  get digitalSignatureUrl(): string | null { return this.authService.getDigitalSignatureUrl(); }
  get activeUserName(): string { return this.authService.currentUser()?.fullName || 'Academic Incharge'; }

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
    const yr = this.data.year || new Date().getFullYear();
    const m = this.data.month || (new Date().getMonth() + 1);
    return m >= 4 ? `${yr}-${yr + 1}` : `${yr - 1}-${yr}`;
  }

  get avgPercentage(): number {
    const rows = this.data.rows || [];
    if (rows.length === 0) return 0;
    const sum = rows.reduce((acc, r) => acc + (r.attendancePercentage || 0), 0);
    return Math.round(sum / rows.length);
  }

  get highAttendanceCount(): number {
    return (this.data.rows || []).filter(r => r.attendancePercentage >= 75).length;
  }

  get lowAttendanceCount(): number {
    return (this.data.rows || []).filter(r => r.attendancePercentage < 75).length;
  }

  get filteredRows(): ReportPrintRow[] {
    const list = this.data.rows || [];
    if (this.filterMode === 'HIGH') return list.filter(r => r.attendancePercentage >= 75);
    if (this.filterMode === 'LOW') return list.filter(r => r.attendancePercentage < 75);
    return list;
  }

  get availableClasses(): string[] {
    const set = new Set<string>();
    for (const r of this.data.rows || []) {
      const cls = r.schoolClass || r.groupName;
      if (cls) set.add(cls.trim());
    }
    const arr = Array.from(set);
    return arr.sort();
  }

  getClassStudentCount(className: string): number {
    return (this.data.rows || []).filter(r => (r.schoolClass || r.groupName)?.trim() === className.trim()).length;
  }

  constructor(
    public dialogRef: MatDialogRef<AttendanceReportPrintDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AttendanceReportPrintDialogData,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    if (this.availableClasses.length > 0) {
      this.selectedWaClass = this.availableClasses[0];
    }
  }

  closeDialog(): void {
    this.dialogRef.close();
  }

  printDocument(): void {
    const printContent = document.getElementById('printable-attendance-register');
    if (!printContent) {
      window.print();
      return;
    }

    // Use an isolated hidden iframe so Chrome Print Preview never closes, flickers, or conflicts with the UI
    let iframe = document.getElementById('attendance-print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'attendance-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Attendance Report - ${this.data.monthName} ${this.data.year}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 8mm 10mm 10mm 10mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #0f172a;
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 9pt;
          }
          .a4-sheet {
            width: 100%;
            background: #ffffff;
            padding: 0;
            margin: 0;
          }
          .report-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 10px;
            margin-bottom: 12px;
          }
          .institute-identity {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .institute-logo {
            max-height: 58px;
            max-width: 62px;
            object-fit: contain;
          }
          .institute-meta .institute-name {
            margin: 0;
            font-size: 1.25rem;
            font-weight: 800;
            color: #1e3a8a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .institute-meta .institute-address {
            margin: 2px 0 4px;
            font-size: 0.78rem;
            color: #475569;
          }
          .report-badge-strip {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
          }
          .report-type-badge {
            background: #1e3a8a;
            color: #ffffff;
            font-size: 0.65rem;
            font-weight: 800;
            padding: 2px 8px;
            border-radius: 4px;
            letter-spacing: 0.5px;
          }
          .period-badge {
            background: #eff6ff;
            color: #1e40af;
            border: 1px solid #bfdbfe;
            font-size: 0.65rem;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 4px;
          }
          .session-badge {
            font-size: 0.65rem;
            font-weight: 600;
            color: #64748b;
          }
          .print-meta-right {
            text-align: right;
            font-size: 0.76rem;
            color: #475569;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .print-meta-right .meta-value {
            color: #0f172a;
            font-weight: 700;
          }
          .summary-metric-deck {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
          }
          .metric-card {
            flex: 1;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 6px 8px;
            background: #f8fafc;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .metric-card.present { border-color: #bbf7d0; background: #f0fdf4; }
          .metric-card.present .val { color: #15803d; }
          .metric-card.high { border-color: #bfdbfe; background: #eff6ff; }
          .metric-card.high .val { color: #1d4ed8; }
          .metric-card.shortage { border-color: #fecaca; background: #fef2f2; }
          .metric-card.shortage .val { color: #b91c1c; }
          .metric-card .label { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; color: #64748b; }
          .metric-card .val { font-size: 1.1rem; font-weight: 800; color: #0f172a; }
          .roster-table-wrapper {
            width: 100%;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            overflow: visible;
          }
          .roster-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8pt;
          }
          .roster-table th {
            background: #f1f5f9;
            color: #0f172a;
            font-weight: 700;
            text-align: left;
            padding: 6px 8px;
            border-bottom: 1.5px solid #0f172a;
            white-space: nowrap;
          }
          .roster-table td {
            padding: 5px 8px;
            border-bottom: 1px solid #e2e8f0;
            color: #1e293b;
            vertical-align: middle;
          }
          .roster-table tr:nth-child(even) { background: #fafafa; }
          .col-sn { width: 35px; text-align: center; }
          .col-code { width: 70px; text-align: center; }
          .col-name { font-weight: 600; }
          .col-num { width: 60px; text-align: center; }
          .col-pct { width: 80px; text-align: center; }
          .col-sign { width: 120px; }
          .present-num { color: #15803d; font-weight: 700; }
          .pct-badge {
            display: inline-block;
            padding: 1px 6px;
            border-radius: 4px;
            font-size: 7.5pt;
            font-weight: 700;
          }
          .pct-good { background: #dcfce7; color: #166534; }
          .pct-low { background: #fee2e2; color: #991b1b; }
          .report-footer {
            margin-top: 20px;
            page-break-inside: avoid;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            padding-top: 8px;
          }
          .sign-block {
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 140px;
            text-align: center;
          }
          .sig-space, .sig-placeholder {
            height: 36px;
            display: flex;
            align-items: flex-end;
            justify-content: center;
          }
          .digital-sign-img {
            max-height: 34px;
            max-width: 110px;
            object-fit: contain;
          }
          .sign-rule {
            width: 130px;
            border-bottom: 1.5px solid #0f172a;
            margin-top: 2px;
          }
          .sign-title, .sig-title {
            font-size: 0.75rem;
            font-weight: 700;
            color: #0f172a;
            margin-top: 4px;
          }
          .sign-name, .sig-sub {
            font-size: 0.68rem;
            color: #64748b;
          }
          .generated-footer-note {
            margin-top: 12px;
            text-align: center;
            font-size: 0.65rem;
            color: #94a3b8;
          }
          .print-only { display: table-cell !important; }
          .no-print { display: none !important; }
        </style>
      </head>
      <body>
        <div class="a4-sheet">
          ${printContent.innerHTML}
        </div>
      </body>
      </html>
    `);
    doc.close();

    // Trigger isolated print safely after images and markup parse
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 300);
  }

  ngOnDestroy(): void {
    const existing = document.getElementById('attendance-print-iframe');
    if (existing) {
      existing.remove();
    }
  }

  shareSummaryWhatsApp(): void {
    const msg =
`📊 *${this.instituteName.toUpperCase()}*
*${this.data.reportType === 'student' ? 'STUDENT' : 'FACULTY'} ATTENDANCE SUMMARY*
━━━━━━━━━━━━━━━━━━
🏫 *Scope:* ${this.data.scopeText}
🗓️ *Month:* ${this.data.monthName} ${this.data.year}
👥 *Total Strength:* ${this.data.rows.length}
✅ *Avg Attendance:* ${this.avgPercentage}%
🟢 *Compliant (&ge; 75%):* ${this.highAttendanceCount}
🔴 *Shortage (&lt; 75%):* ${this.lowAttendanceCount}
📅 *Total Working Days:* ${this.data.totalWorkingDays}
━━━━━━━━━━━━━━━━━━
_Official Report from ${this.instituteName}._`;

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  shareSpecificClassWhatsApp(): void {
    if (!this.selectedWaClass) return;
    const classRows = (this.data.rows || []).filter(r => (r.schoolClass || r.groupName)?.trim() === this.selectedWaClass.trim());
    if (classRows.length === 0) return;

    const totalStudents = classRows.length;
    const avgAttendance = Math.round(classRows.reduce((acc, r) => acc + (r.attendancePercentage || 0), 0) / totalStudents);
    const regularCount = classRows.filter(r => r.attendancePercentage >= 75).length;
    const shortageCount = classRows.filter(r => r.attendancePercentage < 75).length;

    let rosterList = '';
    classRows.forEach((r, idx) => {
      const roll = r.schoolRoll || r.code ? `(Roll #${r.schoolRoll || r.code})` : '';
      const statusIcon = r.attendancePercentage >= 75 ? '🟢' : '🔴';
      rosterList += `${idx + 1}. *${r.personName}* ${roll}: ${r.presentDays}/${r.totalWorkingDays} days (${r.attendancePercentage}%) ${statusIcon}\n`;
    });

    const msg =
`📊 *${this.instituteName.toUpperCase()}*
*CLASS MONTHLY ATTENDANCE REGISTER*
━━━━━━━━━━━━━━━━━━━━
🏫 *Class / Division:* ${this.selectedWaClass}
🗓️ *Month:* ${this.data.monthName} ${this.data.year}
📅 *Working Days:* ${this.data.totalWorkingDays} Days
👥 *Class Strength:* ${totalStudents} Students
📈 *Class Avg Attendance:* ${avgAttendance}%
🟢 *Regular (≥ 75%):* ${regularCount}
🔴 *Shortage (< 75%):* ${shortageCount}
━━━━━━━━━━━━━━━━━━━━
📋 *STUDENT-WISE ATTENDANCE LIST:*
${rosterList}━━━━━━━━━━━━━━━━━━━━
_Official Monthly Record • ${this.instituteName}_`;

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  shareIndividualStudentWhatsApp(row: ReportPrintRow): void {
    const statusIcon = row.attendancePercentage >= 75 ? '🟢 Regular' : '🔴 Shortage';
    const msg =
`📋 *${this.instituteName.toUpperCase()}*
*MONTHLY ATTENDANCE SLIP*
━━━━━━━━━━━━━━━━━━━━
👤 *Student:* ${row.personName}
🔢 *Roll No:* ${row.schoolRoll || row.code || '—'}
🏫 *Class:* ${row.schoolClass || row.groupName || '—'}
🗓️ *Month:* ${this.data.monthName} ${this.data.year}
📅 *Total Working Days:* ${row.totalWorkingDays} Days
━━━━━━━━━━━━━━━━━━━━
✅ *Present Days:* ${row.presentDays}
❌ *Absent Days:* ${row.absentDays}
⏰ *Late Days:* ${row.lateDays}
🌓 *Half Days:* ${row.halfDays}
📊 *Attendance:* ${row.attendancePercentage}% (${statusIcon})
━━━━━━━━━━━━━━━━━━━━
_Dear Parent, please ensure regular attendance for academic success._
_${this.instituteName}_`;

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }
}

