import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';

export interface StudentMonthlySlipRecord {
  attendanceDate: string;
  status: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  remarks?: string | null;
}

export interface StudentMonthlySlipDialogData {
  student: {
    id: string;
    studentName: string;
    rollNumber?: string;
    admissionNumber?: string;
    className?: string;
    sectionName?: string;
    parentWhatsAppPhone?: string;
    parentPhone?: string;
    profilePhoto?: string;
  };
  month: number;
  year: number;
  monthName: string;
  stats: {
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    holidays: number;
    totalHeld: number;
    totalMonthDays: number;
    compliancePct: number;
  };
  records: StudentMonthlySlipRecord[];
}

@Component({
  selector: 'app-student-monthly-slip-dialog',
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
    <div class="monthly-slip-modal">
      <!-- Standard Light Blue Header -->
      <div class="dialog-header no-print">
        <div class="dialog-icon-box">
          <mat-icon>receipt_long</mat-icon>
        </div>
        <div class="dialog-title-group">
          <h2 class="dialog-title">Student Monthly Attendance Card / Slip (A4)</h2>
          <span class="dialog-subtitle">
            <strong>{{ data.student.studentName }}</strong> &bull;
            <span>{{ data.monthName }} {{ data.year }}</span> &bull;
            <span>Compliance: <strong>{{ data.stats.compliancePct }}%</strong></span>
          </span>
        </div>
        <button mat-icon-button (click)="closeDialog()" class="dialog-close-btn" matTooltip="Close Dialog">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Action Toolbar -->
      <div class="action-toolbar no-print">
        <div class="slip-meta-summary">
          <span class="meta-pill">Total Days: <strong>{{ data.stats.totalMonthDays }}</strong></span>
          <span class="meta-pill present">Present: <strong>{{ data.stats.present }}</strong></span>
          <span class="meta-pill absent">Absent: <strong>{{ data.stats.absent }}</strong></span>
          <span class="meta-pill compliance">Compliance: <strong>{{ data.stats.compliancePct }}%</strong></span>
        </div>

        <div class="toolbar-actions">
          <button type="button" class="btn-whatsapp-share" (click)="shareMonthlySlipWhatsApp()" matTooltip="Send monthly card summary to parent on WhatsApp">
            <mat-icon>chat</mat-icon>
            <span>WhatsApp to Parent</span>
          </button>
          <button type="button" class="btn-print-doc" (click)="printDocument()" matTooltip="Print official attendance slip on A4 paper">
            <mat-icon>print</mat-icon>
            <span>Print A4 Slip</span>
          </button>
        </div>
      </div>

      <!-- Scrollable Preview Area -->
      <div class="document-container">
        <div class="printable-document a4-sheet">

          <!-- Institute Header -->
          <div class="report-header">
            <div class="institute-identity">
              @if (instituteLogoUrl && !logoFailed) {
                <img [src]="instituteLogoUrl" (error)="logoFailed = true" alt="Crest Logo" class="institute-logo" />
              }
              <div class="institute-meta">
                <h1 class="institute-name">{{ instituteName }}</h1>
                @if (branchAddress) {
                  <p class="institute-address">{{ branchAddress }}</p>
                }
                <div class="report-badge-strip">
                  <span class="report-type-badge">MONTHLY STUDENT ATTENDANCE REPORT CARD</span>
                  <span class="month-badge">{{ data.monthName | uppercase }} {{ data.year }}</span>
                </div>
              </div>
            </div>
            <div class="print-meta-right">
              <div class="meta-field">
                <span class="meta-label">Session:</span>
                <strong class="meta-value">{{ academicSession }}</strong>
              </div>
              <div class="meta-field">
                <span class="meta-label">Generated:</span>
                <strong class="meta-value">{{ generatedOnDate }}</strong>
              </div>
            </div>
          </div>

          <!-- Student Profile Strip -->
          <div class="student-profile-strip">
            <div class="sp-field">
              <span class="sp-label">Student Name:</span>
              <strong class="sp-val">{{ data.student.studentName }}</strong>
            </div>
            <div class="sp-field">
              <span class="sp-label">Class &amp; Section:</span>
              <strong class="sp-val">{{ data.student.className || '—' }} {{ data.student.sectionName ? '(' + data.student.sectionName + ')' : '' }}</strong>
            </div>
            <div class="sp-field">
              <span class="sp-label">Roll Number:</span>
              <strong class="sp-val">{{ data.student.rollNumber || '—' }}</strong>
            </div>
            <div class="sp-field">
              <span class="sp-label">Admission No:</span>
              <strong class="sp-val">{{ data.student.admissionNumber || '—' }}</strong>
            </div>
            <div class="sp-field">
              <span class="sp-label">Parent Phone:</span>
              <strong class="sp-val">{{ data.student.parentWhatsAppPhone || data.student.parentPhone || '—' }}</strong>
            </div>
          </div>

          <!-- Monthly Metrics KPI Cards -->
          <div class="summary-metric-deck">
            <div class="metric-card total">
              <span class="label">Working Days Held</span>
              <span class="val">{{ data.stats.totalHeld }}</span>
            </div>
            <div class="metric-card present">
              <span class="label">Present Days</span>
              <span class="val">{{ data.stats.present }}</span>
            </div>
            <div class="metric-card absent">
              <span class="label">Absent Days</span>
              <span class="val">{{ data.stats.absent }}</span>
            </div>
            <div class="metric-card late">
              <span class="label">Late / Half Days</span>
              <span class="val">{{ data.stats.late + data.stats.halfDay }}</span>
            </div>
            <div class="metric-card compliance">
              <span class="label">Compliance Score</span>
              <span class="val">{{ data.stats.compliancePct }}%</span>
            </div>
          </div>

          <!-- Daily Status Register Table -->
          <div class="roster-table-wrapper">
            <table class="roster-table">
              <thead>
                <tr>
                  <th style="width: 100px;">Date</th>
                  <th style="width: 110px;">Day</th>
                  <th style="width: 100px;">Status</th>
                  <th style="width: 130px;">Check-In</th>
                  <th style="width: 130px;">Check-Out</th>
                  <th>Remarks / Subject</th>
                </tr>
              </thead>
              <tbody>
                @for (rec of data.records; track rec.attendanceDate) {
                  <tr [class.row-absent]="rec.status === 'Absent'">
                    <td><strong>{{ rec.attendanceDate | date:'dd MMM yyyy' }}</strong></td>
                    <td>{{ rec.attendanceDate | date:'EEEE' }}</td>
                    <td>
                      <span class="status-pill-badge" [ngClass]="rec.status.toLowerCase()">
                        {{ rec.status === 'HalfDay' ? 'Half Day' : rec.status }}
                      </span>
                    </td>
                    <td>{{ rec.checkInTime || '—' }}</td>
                    <td>{{ rec.checkOutTime || '—' }}</td>
                    <td>{{ rec.remarks || '—' }}</td>
                  </tr>
                }
                @if (data.records.length === 0) {
                  <tr>
                    <td colspan="6" style="text-align: center; color: #64748b; padding: 20px;">
                      No individual attendance records logged for this month.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Footer Signatures -->
          <div class="report-footer">
            <div class="sign-block">
              <div class="sig-space"></div>
              <div class="sign-rule"></div>
              <span class="sign-title">Class Teacher Signature</span>
            </div>

            <div class="sign-block center">
              <div class="sig-space"></div>
              <div class="sign-rule"></div>
              <span class="sign-title">Parent / Guardian Signature</span>
            </div>

            <div class="sign-block right">
              <div class="sig-space">
                @if (digitalSignatureUrl) {
                  <img [src]="digitalSignatureUrl" alt="Principal Signature" class="digital-sign-img" />
                }
              </div>
              <div class="sign-rule"></div>
              <span class="sign-title">Principal / Controller</span>
              <span class="sign-name">{{ instituteName }}</span>
            </div>
          </div>

          <div class="disclaimer-strip print-only">
            <span>Generated on {{ generatedOnDate }} IST via IMSERP Smart Campus. Official Student Attendance Record.</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }

    .monthly-slip-modal {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
    }

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

        mat-icon { font-size: 24px; width: 24px; height: 24px; }
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

          strong { color: #1e40af; }
        }
      }

      .dialog-close-btn {
        color: #64748b;
        &:hover { color: #1e293b; background: #e2e8f0; }
      }
    }

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

      .slip-meta-summary {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;

        .meta-pill {
          font-size: 0.8rem;
          padding: 4px 10px;
          border-radius: 12px;
          background: #e2e8f0;
          color: #334155;
          font-weight: 500;

          &.present { background: #dcfce7; color: #166534; }
          &.absent { background: #fee2e2; color: #991b1b; }
          &.compliance { background: #dbeafe; color: #1e40af; }
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

          &:hover { background: #1ebc59; }
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
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

          &:hover { background: #1d4ed8; }
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
        }
      }
    }

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
          max-height: 56px;
          max-width: 60px;
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

            .month-badge {
              font-size: 0.72rem;
              font-weight: 700;
              color: #2563eb;
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
          .meta-label { margin-right: 4px; }
          .meta-value { color: #0f172a; }
        }
      }
    }

    .student-profile-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 10px 14px;
      border-radius: 6px;

      .sp-field {
        display: flex;
        flex-direction: column;
        .sp-label { font-size: 0.72rem; color: #64748b; text-transform: uppercase; font-weight: 600; }
        .sp-val { font-size: 0.86rem; color: #0f172a; margin-top: 1px; }
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
        &.absent { border-color: #fecaca; background: #fef2f2; .val { color: #b91c1c; } }
        &.late { border-color: #fed7aa; background: #fff7ed; .val { color: #c2410c; } }
        &.compliance { border-color: #bfdbfe; background: #eff6ff; .val { color: #1d4ed8; } }
      }
    }

    .roster-table-wrapper {
      width: 100%;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow-x: auto;
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
      }

      td {
        padding: 7px 10px;
        border-bottom: 1px solid #e2e8f0;
        color: #1e293b;
      }

      tr:nth-child(even) { background: #fafafa; }
      tr.row-absent { background: #fff5f5; }

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

    @media print {
      body * { visibility: hidden !important; }
      .no-print { display: none !important; }
      .print-only { display: block !important; }
      .printable-document, .printable-document * { visibility: visible !important; }

      .monthly-slip-modal {
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

      @page {
        size: A4 portrait;
        margin: 8mm 10mm;
      }
    }
  `]
})
export class StudentMonthlySlipDialogComponent implements OnInit {
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
    const yr = this.data.year || new Date().getFullYear();
    const m = this.data.month || (new Date().getMonth() + 1);
    return m >= 4 ? `${yr}-${yr + 1}` : `${yr - 1}-${yr}`;
  }

  constructor(
    public dialogRef: MatDialogRef<StudentMonthlySlipDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: StudentMonthlySlipDialogData,
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

  shareMonthlySlipWhatsApp(): void {
    let phone = this.cleanPhone(this.data.student.parentWhatsAppPhone || this.data.student.parentPhone || '');
    if (!phone) {
      const entered = window.prompt(`Enter parent WhatsApp mobile number for ${this.data.student.studentName}:`, '');
      if (!entered) return;
      phone = this.cleanPhone(entered);
    }

    const rollStr = this.data.student.rollNumber ? ` (Roll: ${this.data.student.rollNumber})` : '';
    const classStr = this.data.student.className ? `, Class: ${this.data.student.className}` : '';

    const msg =
`📄 *${this.instituteName.toUpperCase()}*
*MONTHLY ATTENDANCE REPORT CARD*
━━━━━━━━━━━━━━━━━━
👤 *Student:* ${this.data.student.studentName}${rollStr}${classStr}
🗓️ *Month:* ${this.data.monthName} ${this.data.year}
━━━━━━━━━━━━━━━━━━
📅 *Total Working Days Held:* ${this.data.stats.totalHeld}
✅ *Present Days:* ${this.data.stats.present}
❌ *Absent Days:* ${this.data.stats.absent}
⏰ *Late / Half Days:* ${this.data.stats.late + this.data.stats.halfDay}
📊 *Compliance Score:* ${this.data.stats.compliancePct}%
━━━━━━━━━━━━━━━━━━
_Official Attendance Statement from ${this.instituteName}._
_For queries, please contact the campus office._`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }
}

