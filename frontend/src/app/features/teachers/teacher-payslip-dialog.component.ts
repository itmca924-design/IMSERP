import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { API_BASE, SalaryPaymentDto, TeacherDto } from './teacher.models';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

export interface PayslipDialogData {
  payment: SalaryPaymentDto;
  teacher: TeacherDto;
  instituteName?: string;
  branchName?: string;
  logoUrl?: string;
}

@Component({
  selector: 'app-teacher-payslip-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="payslip-modal-container">
      <!-- Top Action Bar (hidden in print) -->
      <div class="modal-actions no-print">
        <div class="modal-hdr-left">
          <div class="modal-hdr-icon" [class.has-logo-img]="logoUrl && !headerLogoFailed">
            @if (logoUrl && !headerLogoFailed) {
              <img [src]="logoUrl" (error)="headerLogoFailed = true" alt="Logo" class="header-logo-img">
            }
            @if (!logoUrl || headerLogoFailed) {
              <mat-icon>receipt_long</mat-icon>
            }
          </div>
          <div>
            <h3 class="modal-hdr-title">Staff Salary Payslip</h3>
            <p class="modal-hdr-sub">{{ data.teacher.fullName }} ({{ data.teacher.employeeCode }}) &bull; {{ data.payment.monthName }}</p>
          </div>
        </div>
        <div class="btn-group">
          <button class="whatsapp-btn" [disabled]="sendingWhatsApp" (click)="sendWhatsApp()" matTooltip="Send Payslip on WhatsApp" matButton="filled">
            <mat-icon>send</mat-icon>
            <span>{{ sendingWhatsApp ? 'Sending...' : 'Send WhatsApp' }}</span>
          </button>
          <button color="primary" class="print-btn" (click)="printPayslip()" matTooltip="Print Payslip" matButton="filled">
            <mat-icon>print</mat-icon> <span>Print / PDF</span>
          </button>
          <button class="header-close-btn" (click)="dialogRef.close()" matTooltip="Close" mat-icon-button>
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>
    
      <!-- Printable Payslip Document -->
      <div class="payslip-paper" id="payslip-paper">
        <!-- Header -->
        <div class="paper-header">
          <div class="inst-info">
            @if (logoUrl && !logoFailed) {
              <div class="logo-mark transparent-logo-mark" [class.has-img]="true">
                <img [src]="logoUrl" (error)="logoFailed = true" alt="Logo" class="inst-logo-img">
              </div>
            }
            <div>
              <h2 class="inst-name">{{ data.instituteName || authService.currentUser()?.instituteName || 'Salary Payslip' }}</h2>
              <p class="inst-subtitle">Faculty & Staff Payroll Management | Monthly Pay Advice</p>
              @if (effectiveBranchName) {
                <p class="inst-branch">
                  <span class="branch-pill">🏛️ Branch: {{ effectiveBranchName }}</span>
                  <span class="branch-dept-sep">|</span>
                  <span class="branch-dept">Payroll & Accounts Division</span>
                </p>
              }
            </div>
          </div>
          <div class="payslip-badge">
            <span class="badge-title">SALARY PAYSLIP</span>
            <span class="badge-sub">वेतन पर्ची</span>
          </div>
        </div>
    
        <div class="meta-strip">
          <div class="meta-item">
            <span class="meta-label">Pay Period / Month:</span>
            <span class="meta-val"><strong>{{ data.payment.monthName }}</strong></span>
          </div>
          @if (effectiveBranchName) {
            <div class="meta-item branch-meta-item">
              <span class="meta-label">Branch / Campus:</span>
              <span class="meta-val branch-val">🏛️ {{ effectiveBranchName }}</span>
            </div>
          }
          <div class="meta-item">
            <span class="meta-label">Receipt / Voucher No:</span>
            <span class="meta-val receipt-no">{{ data.payment.receiptNumber }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Payment Date:</span>
            <span class="meta-val">{{ data.payment.paymentDate | date:'dd-MMM-yyyy' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Payment Mode:</span>
            <span class="meta-val mode-pill">{{ data.payment.paymentMode }}</span>
          </div>
        </div>
    
        <!-- Faculty Details Grid -->
        <div class="details-section">
          <div class="details-col">
            <div class="info-row"><span class="k">Faculty Name:</span><span class="v"><strong>{{ data.payment.teacherName }}</strong></span></div>
            <div class="info-row"><span class="k">Employee Code:</span><span class="v code-badge">{{ data.payment.employeeCode }}</span></div>
            <div class="info-row"><span class="k">Specialization / Subject:</span><span class="v">{{ data.teacher.specialization || 'Academic Faculty' }}</span></div>
          </div>
          <div class="details-col">
            <div class="info-row"><span class="k">Contact Number:</span><span class="v">{{ data.teacher.phoneNumber || '—' }}</span></div>
            <div class="info-row"><span class="k">Experience:</span><span class="v">{{ data.teacher.experienceYears ? data.teacher.experienceYears + ' Years' : '—' }}</span></div>
            @if (data.payment.transactionRef) {
              <div class="info-row"><span class="k">Transaction Ref:</span><span class="v font-mono">{{ data.payment.transactionRef }}</span></div>
            }
          </div>
        </div>
    
        <!-- Attendance Summary Row -->
        <div class="attendance-summary-box">
          @if (hasAttendanceData) {
            @if (data.payment.workingDays) {
              <div class="att-item">
                <span class="att-lbl">Working Days:</span>
                <span class="att-val">{{ data.payment.workingDays }} Days</span>
              </div>
            }
            @if (data.payment.presentDays > 0) {
              <div class="att-item">
                <span class="att-lbl">Present Days:</span>
                <span class="att-val green">{{ data.payment.presentDays }} Days</span>
              </div>
            }
            @if ((data.payment.lopDays || data.payment.absentDays || 0) > 0) {
              <div class="att-item">
                <span class="att-lbl">Absent / LOP:</span>
                <span class="att-val red">{{ data.payment.lopDays || data.payment.absentDays }} Days</span>
              </div>
            }
            @if ((data.payment.paidLeaveDays || 0) > 0) {
              <div class="att-item">
                <span class="att-lbl">Paid Leaves:</span>
                <span class="att-val green">{{ data.payment.paidLeaveDays }} Days</span>
              </div>
            }
          }
          @if (!hasAttendanceData) {
            <div class="att-item">
              <span class="att-lbl">Payroll Cycle:</span>
              <span class="att-val blue">Standard Monthly Disbursal</span>
            </div>
          }
          @if (data.payment.remarks) {
            <div class="att-item att-remarks">
              <span class="att-lbl">Details:</span>
              <span class="att-val-sub">{{ data.payment.remarks }}</span>
            </div>
          }
        </div>
    
        <!-- Earnings & Deductions Table -->
        <div class="breakdown-table-wrapper">
          <table class="payslip-table">
            <thead>
              <tr>
                <th colspan="2" class="th-earnings">EARNINGS (आय)</th>
                <th colspan="2" class="th-deductions">DEDUCTIONS (कटौती)</th>
              </tr>
              <tr class="sub-head">
                <th>Description</th>
                <th class="text-right">Amount (₹)</th>
                <th>Description</th>
                <th class="text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <!-- Row 1: Basic / Gross vs Attendance LOP -->
              <tr>
                <td>{{ data.payment.basicSalary != null ? 'Basic Salary' : 'Gross Base Salary & Allowances' }}</td>
                <td class="text-right">₹{{ (data.payment.basicSalary != null ? data.payment.basicSalary : data.payment.grossAmount) | number:'1.2-2' }}</td>
                <td>Attendance Loss of Pay (LOP)</td>
                <td class="text-right" [class.text-danger]="(data.payment.attendanceDeduction || 0) > 0">
                  ₹{{ (data.payment.attendanceDeduction != null ? data.payment.attendanceDeduction : (data.payment.deductions - (data.payment.pfDeduction || 0) - (data.payment.tdsDeduction || 0))) | number:'1.2-2' }}
                </td>
              </tr>
              <!-- Row 2: HRA vs Statutory (PF / TDS) -->
              @if (data.payment.basicSalary != null) {
                <tr>
                  <td>House Rent Allowance (HRA)</td>
                  <td class="text-right">₹{{ (data.payment.hra || 0) | number:'1.2-2' }}</td>
                  <td>Provident Fund (PF)</td>
                  <td class="text-right">₹{{ (data.payment.pfDeduction || 0) | number:'1.2-2' }}</td>
                </tr>
              }
              <!-- Row 3: Other Allowances vs TDS / Tax -->
              @if (data.payment.basicSalary != null) {
                <tr>
                  <td>Other Allowances</td>
                  <td class="text-right">₹{{ (data.payment.otherAllowances || 0) | number:'1.2-2' }}</td>
                  <td>TDS / Tax Deduction</td>
                  <td class="text-right">₹{{ (data.payment.tdsDeduction || 0) | number:'1.2-2' }}</td>
                </tr>
              }
              <!-- Row 4: Facilities (Hostel / Transport) if applicable -->
              @if (((data.payment.hostelDeduction || 0) + (data.payment.transportDeduction || 0)) > 0) {
                <tr>
                  <td>&nbsp;</td>
                  <td></td>
                  <td>Facilities (Hostel / Transport)</td>
                  <td class="text-right">₹{{ ((data.payment.hostelDeduction || 0) + (data.payment.transportDeduction || 0)) | number:'1.2-2' }}</td>
                </tr>
              }
              <!-- Advance Adjusted Row -->
              <tr>
                @if ((data.payment.arrearsAmount || 0) > 0) {
                  <td style="color:#059669; font-weight:700;">
                    Previous Month Arrears (पिछला बकाया)
                    @if (data.payment.arrearsRemarks) {
                      <div style="font-size:10px; color:#047857; font-weight:normal;">
                        {{ data.payment.arrearsRemarks }}
                      </div>
                    }
                  </td>
                }
                @if ((data.payment.arrearsAmount || 0) > 0) {
                  <td class="text-right" style="color:#059669; font-weight:700;">
                    +₹{{ data.payment.arrearsAmount | number:'1.2-2' }}
                  </td>
                }
                @if (!(data.payment.arrearsAmount || 0)) {
                  <td>&nbsp;</td>
                }
                @if (!(data.payment.arrearsAmount || 0)) {
                  <td></td>
                }
                <td>Advance Salary Adjusted</td>
                <td class="text-right">₹{{ data.payment.advanceAdjusted | number:'1.2-2' }}</td>
              </tr>
              <tr class="total-row">
                <td><strong>Total Gross Earnings (A)</strong></td>
                <td class="text-right"><strong>₹{{ ((data.payment.grossAmount || 0) + (data.payment.arrearsAmount || 0)) | number:'1.2-2' }}</strong></td>
                <td><strong>Total Deductions (B)</strong></td>
                <td class="text-right"><strong>₹{{ (data.payment.deductions + data.payment.advanceAdjusted) | number:'1.2-2' }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
    
        <!-- Net Payable Block -->
        <div class="net-payable-strip">
          <div class="net-left">
            <span class="net-label">NET TAKE-HOME SALARY (A - B):</span>
            <span class="net-words">Amount in words: <em>{{ getAmountInWords(data.payment.netPaid) }}</em></span>
          </div>
          <div class="net-right">
            <span class="net-currency">₹</span>
            <span class="net-amount">{{ data.payment.netPaid | number:'1.2-2' }}</span>
          </div>
        </div>
    
        <!-- Signatures & Disclaimer Footer -->
        <div class="footer-signatures">
          <div class="sig-box">
            <div class="sig-space"></div>
            <div class="sig-line"></div>
            <span class="sig-title">Employee / Faculty Signature</span>
          </div>
          <div class="sig-box text-center">
            @if (officialSealUrl) {
              <div class="seal-container">
                <img [src]="officialSealUrl" alt="Official Seal" class="uploaded-official-seal-img" />
              </div>
            }
            @if (!officialSealUrl) {
              <div class="stamp-placeholder">
                <mat-icon>verified</mat-icon>
                <span>Verified &amp; Audited</span>
              </div>
            }
            <span class="sig-title">Institutional Official Seal</span>
          </div>
          <div class="sig-box text-right">
            @if (digitalSignatureUrl) {
              <div class="digital-sign-wrapper">
                <img [src]="digitalSignatureUrl" alt="Authorized Signature" class="digital-sign-img" />
              </div>
            }
            @if (!digitalSignatureUrl) {
              <div class="sig-space"></div>
            }
            <div class="sig-line"></div>
            <span class="sig-title">Authorized Signatory / Principal</span>
          </div>
        </div>
    
        <div class="paper-disclaimer">
          <p>This is a computer-generated salary slip from {{ data.instituteName || authService.currentUser()?.instituteName || authService.getInstituteName() || 'Institution' }} ERP. Valid without physical stamp if electronically audited.</p>
        </div>
      </div>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host {
      display: block;
    }
    .payslip-modal-container {
      width: 100%; max-width: 820px; background: #fff; border-radius: 12px; overflow: hidden;
      display: flex; flex-direction: column; max-height: 90vh;
    }
    .modal-actions {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 20px; flex-shrink: 0;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      .modal-hdr-left {
        display: flex; align-items: center; gap: 10px;
        .modal-hdr-icon {
          background: #2563eb; color: #ffffff; border-radius: 10px;
          box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
          width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
          overflow: hidden; flex-shrink: 0;
          mat-icon { font-size: 19px; width: 19px; height: 19px; }
          &.has-logo-img {
            background: #ffffff;
            border: 1px solid #bfdbfe;
            padding: 2px;
          }
          .header-logo-img {
            width: 100%; height: 100%; object-fit: contain; border-radius: 6px;
          }
        }
        .modal-hdr-title { margin: 0; font-size: 1.05rem; font-weight: 700; color: #1e3a8a; }
        .modal-hdr-sub { margin: 1px 0 0; font-size: 0.76rem; color: #3b82f6; }
      }
      .btn-group {
        display: flex; align-items: center; gap: 8px;
        .whatsapp-btn {
          background: #16a34a; color: #ffffff; border: none; font-weight: 600; height: 32px; font-size: 0.8rem;
          display: inline-flex; align-items: center; gap: 5px; padding: 0 10px; border-radius: 6px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin: 0; }
          &:hover { background: #15803d; }
        }
        .print-btn {
          height: 32px; font-size: 0.8rem;
          display: inline-flex; align-items: center; gap: 5px; padding: 0 10px; border-radius: 6px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin: 0; }
        }
        .header-close-btn {
          width: 32px !important;
          height: 32px !important;
          min-width: 32px !important;
          padding: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 6px !important;
          color: #64748b !important;
          margin-left: 4px;
          cursor: pointer !important;
          transition: background 0.15s, color 0.15s;
          mat-icon {
            font-size: 20px !important;
            width: 20px !important;
            height: 20px !important;
            line-height: 20px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          &:hover {
            color: #1e293b !important;
            background: rgba(30, 41, 59, 0.08) !important;
          }
        }
      }
    }
    .payslip-paper {
      padding: 14px 22px 16px; color: #1e293b; font-family: 'Segoe UI', Roboto, sans-serif;
      overflow-y: auto; flex: 1 1 auto;
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 transparent;
      &::-webkit-scrollbar { width: 6px; }
      &::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    }
    .paper-header {
      display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e3a8a;
      padding-bottom: 6px; margin-bottom: 8px;
    }
    .inst-info {
      display: flex; align-items: center; gap: 10px;
      .logo-mark {
        width: 38px; height: 38px; background: transparent !important; border: none !important; box-shadow: none !important;
        display: flex; align-items: center; justify-content: center; overflow: visible; flex-shrink: 0;
        &.has-img { background: transparent !important; border: none !important; padding: 0 !important; }
        .inst-logo-img { width: 100%; height: 100%; object-fit: contain; background: transparent !important; border: none !important; }
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }
      .inst-name { margin: 0; font-size: 1.15rem; font-weight: 800; color: #0f172a; letter-spacing: -0.3px; line-height: 1.15; }
      .inst-subtitle { margin: 1px 0 0; font-size: 0.72rem; color: #64748b; }
      .inst-branch {
        margin: 2px 0 0; font-size: 0.72rem; color: #1e40af; font-weight: 600; display: flex; align-items: center; gap: 6px;
        .branch-pill { background: #eff6ff; color: #1e40af; padding: 1px 6px; border-radius: 4px; border: 1px solid #bfdbfe; font-size: 0.68rem; font-weight: 700; }
        .branch-dept-sep { color: #94a3b8; }
        .branch-dept { color: #64748b; font-size: 0.68rem; }
      }
    }
    .payslip-badge {
      text-align: right;
      .badge-title { display: block; font-size: 0.95rem; font-weight: 800; color: #1e40af; letter-spacing: 0.5px; line-height: 1.1; }
      .badge-sub { font-size: 0.7rem; color: #64748b; font-weight: 600; }
    }
    .meta-strip {
      display: flex; flex-wrap: wrap; gap: 6px 14px;
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 12px; margin-bottom: 8px;
    }
    .meta-item {
      display: flex; flex-direction: column; gap: 1px; min-width: 95px; flex: 1 1 auto;
      .meta-label { font-size: 0.64rem; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.3px; }
      .meta-val { font-size: 0.8rem; color: #0f172a; font-weight: 600; }
      .branch-val { color: #1e40af; font-weight: 700; }
      .receipt-no { font-family: monospace; font-weight: 700; color: #1e40af; }
      .mode-pill { font-weight: 600; color: #0284c7; }
    }
    .details-section {
      display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
      background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 12px; margin-bottom: 8px;
    }
    .details-col { display: flex; flex-direction: column; gap: 3px; }
    .info-row {
      display: flex; justify-content: space-between; font-size: 0.78rem;
      .k { color: #64748b; }
      .v { color: #0f172a; font-weight: 500; }
      .code-badge { font-weight: 700; color: #1e40af; font-family: monospace; }
      .font-mono { font-family: monospace; }
    }
    .attendance-summary-box {
      display: flex; align-items: center; gap: 16px; background: #f0fdf4; border: 1px solid #bbf7d0;
      border-radius: 6px; padding: 5px 12px; margin-bottom: 8px; font-size: 0.78rem;
      .att-item { display: flex; align-items: center; gap: 5px; }
      .att-lbl { color: #166534; font-weight: 600; }
      .att-val { font-weight: 700; &.green { color: #15803d; } &.red { color: #b91c1c; } &.blue { color: #1d4ed8; } }
      .att-remarks { color: #64748b; font-size: 0.74rem; margin-left: auto; }
    }
    .breakdown-table-wrapper {
      margin-bottom: 8px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;
    }
    .payslip-table {
      width: 100%; border-collapse: collapse; font-size: 0.78rem;
      th, td { padding: 4px 10px; border: 1px solid #e2e8f0; line-height: 1.25; }
      .th-earnings { background: #eff6ff; color: #1e40af; font-weight: 700; text-align: center; border-bottom: 2px solid #3b82f6; }
      .th-deductions { background: #fef2f2; color: #991b1b; font-weight: 700; text-align: center; border-bottom: 2px solid #ef4444; }
      .sub-head th { background: #f8fafc; font-size: 0.68rem; color: #64748b; font-weight: 700; text-transform: uppercase; }
      .text-right { text-align: right; font-variant-numeric: tabular-nums; }
      .total-row { background: #f8fafc; border-top: 1.5px solid #cbd5e1; font-weight: 700; }
    }
    .net-payable-strip {
      display: flex; justify-content: space-between; align-items: center;
      background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%);
      color: #fff; padding: 8px 16px; border-radius: 6px; margin-bottom: 8px;
      box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.15);
      .net-left { display: flex; flex-direction: column; gap: 2px; }
      .net-label { font-size: 0.78rem; font-weight: 800; letter-spacing: 0.3px; color: #93c5fd; }
      .net-words { font-size: 0.7rem; color: #cbd5e1; em { font-style: normal; color: #fde047; font-weight: 600; } }
      .net-right {
        display: flex; align-items: baseline; gap: 3px;
        .net-currency { font-size: 1rem; font-weight: 700; color: #4ade80; }
        .net-amount { font-size: 1.3rem; font-weight: 800; color: #4ade80; letter-spacing: -0.3px; }
      }
    }
    .footer-signatures {
      display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-top: 10px; padding-top: 2px;
      align-items: flex-end;
    }
    .sig-box {
      display: flex; flex-direction: column; align-items: flex-start; gap: 3px; font-size: 0.72rem; color: #64748b;
      .sig-space { height: 48px; width: 100%; }
      .sig-line { width: 120px; height: 1.5px; background: #94a3b8; margin-bottom: 2px; }
      .sig-title { font-weight: 600; color: #475569; font-size: 0.72rem; }
      &.text-center {
        align-items: center;
        .seal-container {
          height: 52px; display: flex; align-items: center; justify-content: center; margin-bottom: 2px;
        }
      }
      &.text-right { align-items: flex-end; }
    }
    .uploaded-official-seal-img {
      max-width: 52px; max-height: 52px; object-fit: contain; display: block; margin: 0 auto;
      filter: drop-shadow(0 2px 3px rgba(0,0,0,0.06));
    }
    .digital-sign-wrapper {
      display: flex; align-items: flex-end; justify-content: flex-end; height: 48px; margin-bottom: 2px;
    }
    .digital-sign-img {
      max-height: 42px; max-width: 110px; object-fit: contain; display: block; mix-blend-mode: multiply;
    }
    .stamp-placeholder {
      display: flex; align-items: center; gap: 4px; border: 1.5px dashed #cbd5e1;
      padding: 2px 7px; border-radius: 14px; color: #94a3b8; font-size: 0.68rem;
      height: 44px; box-sizing: border-box; margin-bottom: 2px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    .paper-disclaimer {
      margin-top: 6px; padding-top: 4px; border-top: 1px dashed #e2e8f0; text-align: center;
      p { margin: 0; font-size: 0.62rem; color: #94a3b8; }
    }

  `]
})
export class TeacherPayslipDialogComponent {
  logoUrl: string | null = null;
  logoFailed = false;
  headerLogoFailed = false;
  sendingWhatsApp = false;

  get officialSealUrl(): string | null {
    return this.authService.getOfficialSealUrl();
  }

  get digitalSignatureUrl(): string | null {
    return this.authService.getDigitalSignatureUrl();
  }

  get effectiveBranchName(): string {
    if (this.data?.branchName) return this.data.branchName;
    const authBranch = this.authService.getCurrentBranchName();
    if (authBranch) return authBranch;
    return '';
  }

  get hasAttendanceData(): boolean {
    const p = this.data?.payment;
    if (!p) return false;
    return (p.workingDays != null && p.workingDays > 0) ||
           (p.presentDays != null && p.presentDays > 0) ||
           (p.absentDays != null && p.absentDays > 0) ||
           (p.lopDays != null && p.lopDays > 0) ||
           (p.paidLeaveDays != null && p.paidLeaveDays > 0);
  }

  constructor(
    public dialogRef: MatDialogRef<TeacherPayslipDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PayslipDialogData,
    public authService: AuthService,
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService
  ) {
    const rawLogo = data.logoUrl || this.authService.currentUser()?.profilePhoto;
    this.logoUrl = this.authService.resolveLogoUrl(rawLogo);
  }

  sendWhatsApp() {
    this.sendingWhatsApp = true;
    this.http.post<any>(`${API_BASE}/teachers/salary-payments/${this.data.payment.id}/send-whatsapp`, {}).subscribe({
      next: (res) => {
        this.sendingWhatsApp = false;
        this.confirmDialog.alert('WhatsApp Sent', res?.message || 'Salary slip sent to teacher on WhatsApp!', 'success');
      },
      error: (err) => {
        this.sendingWhatsApp = false;
        this.confirmDialog.alert('Error', err?.error?.message || 'Failed to dispatch WhatsApp message.', 'danger');
      }
    });
  }

  printPayslip() {
    const el = document.getElementById('payslip-paper');
    if (!el) return;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>Salary Payslip - ${this.data.payment.teacherName}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; background: #fff; color: #1e293b; padding: 24px; }
            .payslip-paper { max-width: 780px; margin: 0 auto; }
            .paper-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 16px; }
            .inst-info { display: flex; align-items: center; gap: 14px; }
            .logo-mark { width: 48px; height: 48px; background: transparent !important; border: none !important; display: flex; align-items: center; justify-content: center; overflow: visible; flex-shrink: 0; }
            .logo-mark.has-img { background: transparent !important; border: none !important; padding: 0 !important; }
            .inst-logo-img { width: 100%; height: 100%; object-fit: contain; background: transparent !important; border: none !important; }
            .inst-name { font-size: 1.35rem; font-weight: 800; color: #0f172a; }
            .inst-subtitle { font-size: 0.8rem; color: #64748b; margin-top: 2px; }
            .inst-branch { font-size: 0.74rem; color: #1e40af; font-weight: 600; margin-top: 3px; display: flex; align-items: center; gap: 6px; }
            .branch-pill { background: #eff6ff; color: #1e40af; padding: 2px 7px; border-radius: 4px; border: 1px solid #bfdbfe; font-size: 0.72rem; }
            .branch-dept-sep { color: #94a3b8; }
            .branch-dept { color: #64748b; font-size: 0.7rem; }
            .payslip-badge { text-align: right; }
            .badge-title { display: block; font-size: 1.1rem; font-weight: 800; color: #1e40af; letter-spacing: 1px; }
            .badge-sub { font-size: 0.8rem; color: #64748b; font-weight: 600; }
            .meta-strip { display: flex; flex-wrap: wrap; gap: 12px 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 16px; margin-bottom: 18px; }
            .meta-label { font-size: 0.72rem; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; display: block; }
            .meta-val { font-size: 0.88rem; color: #0f172a; display: block; }
            .branch-val { color: #1e40af; font-weight: 700; }
            .receipt-no { font-family: monospace; font-weight: 700; color: #1e40af; }
            .mode-pill { font-weight: 600; color: #0284c7; }
            .details-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 16px; }
            .info-row { display: flex; justify-content: space-between; font-size: 0.84rem; margin-bottom: 6px; }
            .info-row .k { color: #64748b; }
            .attendance-summary-box { display: flex; align-items: center; gap: 24px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 8px 16px; margin-bottom: 18px; font-size: 0.83rem; }
            .att-item { display: flex; align-items: center; gap: 6px; }
            .att-lbl { color: #166534; font-weight: 600; }
            .att-val-green { font-weight: 700; color: #15803d; }
            .att-val-red { font-weight: 700; color: #b91c1c; }
            .att-remarks { color: #64748b; font-size: 0.78rem; margin-left: auto; }
            .breakdown-table-wrapper { margin-bottom: 18px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
            table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
            th, td { padding: 8px 14px; border: 1px solid #e2e8f0; }
            .th-earnings { background: #eff6ff; color: #1e40af; font-weight: 700; text-align: center; }
            .th-deductions { background: #fef2f2; color: #991b1b; font-weight: 700; text-align: center; }
            .sub-head th { background: #f8fafc; font-size: 0.75rem; color: #64748b; font-weight: 600; text-transform: uppercase; }
            .text-right { text-align: right; }
            .total-row { background: #f8fafc; border-top: 2px solid #cbd5e1; }
            .net-payable-strip { display: flex; justify-content: space-between; align-items: center; background: #1e3a8a; color: #fff; padding: 12px 18px; border-radius: 8px; margin-bottom: 24px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .net-label { font-size: 0.88rem; font-weight: 800; letter-spacing: 0.5px; color: #93c5fd; }
            .net-words { font-size: 0.76rem; color: #cbd5e1; margin-top: 4px; }
            .net-words em { font-style: normal; color: #facc15; font-weight: 600; }
            .net-right { display: flex; align-items: baseline; gap: 4px; }
            .net-currency { font-size: 1.2rem; font-weight: 700; color: #4ade80; }
            .net-amount { font-size: 1.5rem; font-weight: 800; color: #4ade80; }
            .footer-signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 24px; padding-top: 10px; align-items: flex-end; }
            .sig-box { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; font-size: 0.78rem; color: #64748b; }
            .sig-space { height: 48px; width: 100%; }
            .sig-line { width: 140px; height: 1.5px; background: #94a3b8; margin-bottom: 4px; }
            .sig-title { font-weight: 600; color: #475569; font-size: 0.78rem; }
            .sig-center { align-items: center; }
            .sig-right { align-items: flex-end; }
            .seal-container { height: 52px; display: flex; align-items: center; justify-content: center; margin-bottom: 2px; }
            .uploaded-official-seal-img { max-width: 54px; max-height: 54px; object-fit: contain; display: block; margin: 0 auto; }
            .digital-sign-wrapper { display: flex; align-items: flex-end; justify-content: flex-end; height: 48px; margin-bottom: 2px; }
            .digital-sign-img { max-height: 42px; max-width: 120px; object-fit: contain; display: block; mix-blend-mode: multiply; }
            .stamp-placeholder { display: flex; align-items: center; gap: 4px; border: 1.5px dashed #cbd5e1; padding: 4px 10px; border-radius: 20px; color: #94a3b8; font-size: 0.72rem; }
            .paper-disclaimer { margin-top: 20px; padding-top: 10px; border-top: 1px dashed #e2e8f0; text-align: center; font-size: 0.68rem; color: #94a3b8; }
            @media print {
              body { padding: 0; }
              @page { margin: 8mm 10mm; size: A4 portrait; }
            }
          </style>
        </head>
        <body>
          ${el.outerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }

  getAmountInWords(amount: number): string {
    return convertToIndianWords(Math.round(amount)) + ' Rupees Only';
  }
}

function convertToIndianWords(n: number): string {
  if (n === 0) return 'Zero';
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function numToWords(num: number): string {
    let str = '';
    if (num >= 10000000) {
      str += numToWords(Math.floor(num / 10000000)) + ' Crore ';
      num %= 10000000;
    }
    if (num >= 100000) {
      str += numToWords(Math.floor(num / 100000)) + ' Lakh ';
      num %= 100000;
    }
    if (num >= 1000) {
      str += numToWords(Math.floor(num / 1000)) + ' Thousand ';
      num %= 1000;
    }
    if (num >= 100) {
      str += numToWords(Math.floor(num / 100)) + ' Hundred ';
      num %= 100;
    }
    if (num > 0) {
      if (num < 20) str += units[num] + ' ';
      else str += tens[Math.floor(num / 10)] + ' ' + (num % 10 > 0 ? units[num % 10] + ' ' : '');
    }
    return str.trim();
  }

  return numToWords(n);
}
