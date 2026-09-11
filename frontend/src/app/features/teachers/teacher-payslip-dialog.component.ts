import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { SalaryPaymentDto, TeacherDto } from './teacher.models';

export interface PayslipDialogData {
  payment: SalaryPaymentDto;
  teacher: TeacherDto;
  instituteName?: string;
}

@Component({
  selector: 'app-teacher-payslip-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatDividerModule],
  template: `
    <div class="payslip-modal-container">
      <!-- Top Action Bar (hidden in print) -->
      <div class="modal-actions no-print">
        <span class="modal-title"><mat-icon>receipt_long</mat-icon> Staff Salary Payslip</span>
        <div class="btn-group">
          <button mat-raised-button color="primary" (click)="printPayslip()">
            <mat-icon>print</mat-icon> Print / Download PDF
          </button>
          <button mat-icon-button (click)="dialogRef.close()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Printable Payslip Document -->
      <div class="payslip-paper" id="payslip-paper">
        <!-- Header -->
        <div class="paper-header">
          <div class="inst-info">
            <div class="logo-mark"><mat-icon>school</mat-icon></div>
            <div>
              <h2 class="inst-name">{{ data.instituteName || 'Apex Coaching Academy' }}</h2>
              <p class="inst-subtitle">Faculty & Staff Payroll Management | Monthly Pay Advice</p>
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
            <span class="meta-val"><strong>{{ data.payment.monthName }} {{ data.payment.paymentYear }}</strong></span>
          </div>
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
            <div class="info-row"><span class="k">Employee Code:</span><span class="v">{{ data.payment.employeeCode }}</span></div>
            <div class="info-row"><span class="k">Specialization / Subject:</span><span class="v">{{ data.teacher.specialization || 'Academic Faculty' }}</span></div>
          </div>
          <div class="details-col">
            <div class="info-row"><span class="k">Contact Number:</span><span class="v">{{ data.teacher.phoneNumber }}</span></div>
            <div class="info-row"><span class="k">Experience:</span><span class="v">{{ data.teacher.experienceYears }} Years</span></div>
            <div class="info-row" *ngIf="data.payment.transactionRef"><span class="k">Transaction Ref:</span><span class="v">{{ data.payment.transactionRef }}</span></div>
          </div>
        </div>

        <!-- Attendance Summary Row -->
        <div class="attendance-summary-box">
          <div class="att-item">
            <span class="att-lbl">Present Days:</span>
            <span class="att-val green">{{ data.payment.presentDays }} Days</span>
          </div>
          <div class="att-item">
            <span class="att-lbl">Absent Days:</span>
            <span class="att-val" [class.red]="data.payment.absentDays > 0">{{ data.payment.absentDays }} Days</span>
          </div>
          <div class="att-item att-remarks" *ngIf="data.payment.remarks">
            <span class="att-lbl">Attendance Remarks:</span>
            <span class="att-val-sub">{{ data.payment.remarks }}</span>
          </div>
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
              <tr>
                <td>Gross Base Salary & Allowances</td>
                <td class="text-right">₹{{ data.payment.grossAmount | number:'1.2-2' }}</td>
                <td>Attendance & Other Deductions</td>
                <td class="text-right">₹{{ data.payment.deductions | number:'1.2-2' }}</td>
              </tr>
              <tr>
                <td>&nbsp;</td>
                <td></td>
                <td>Advance Salary Adjusted</td>
                <td class="text-right">₹{{ data.payment.advanceAdjusted | number:'1.2-2' }}</td>
              </tr>
              <tr class="total-row">
                <td><strong>Total Gross Earnings (A)</strong></td>
                <td class="text-right"><strong>₹{{ data.payment.grossAmount | number:'1.2-2' }}</strong></td>
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
            <div class="sig-line"></div>
            <span>Employee / Faculty Signature</span>
          </div>
          <div class="sig-box text-center">
            <div class="stamp-placeholder">
              <mat-icon>verified</mat-icon>
              <span>Verified & Audited</span>
            </div>
          </div>
          <div class="sig-box text-right">
            <div class="sig-line"></div>
            <span>Authorized Signatory / Director</span>
          </div>
        </div>

        <div class="paper-disclaimer">
          <p>This is a computer-generated salary slip from {{ data.instituteName || 'Apex Coaching Academy' }} ERP. Valid without physical stamp if electronically audited.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .payslip-modal-container {
      width: 100%; max-width: 780px; background: #fff; border-radius: 12px; overflow: hidden;
      display: flex; flex-direction: column;
    }
    .modal-actions {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 20px; background: #0f172a; color: #fff;
      .modal-title { font-size: 1.05rem; font-weight: 600; display: flex; align-items: center; gap: 8px; mat-icon { font-size: 20px; } }
      .btn-group { display: flex; align-items: center; gap: 8px; }
    }
    .payslip-paper {
      padding: 32px 36px; color: #1e293b; font-family: 'Segoe UI', Roboto, sans-serif;
    }
    .paper-header {
      display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a;
      padding-bottom: 16px; margin-bottom: 16px;
    }
    .inst-info {
      display: flex; align-items: center; gap: 14px;
      .logo-mark {
        width: 48px; height: 48px; border-radius: 10px; background: #1e40af; color: #fff;
        display: flex; align-items: center; justify-content: center;
        mat-icon { font-size: 28px; width: 28px; height: 28px; }
      }
      .inst-name { margin: 0; font-size: 1.35rem; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
      .inst-subtitle { margin: 2px 0 0; font-size: 0.8rem; color: #64748b; }
    }
    .payslip-badge {
      text-align: right;
      .badge-title { display: block; font-size: 1.1rem; font-weight: 800; color: #1e40af; letter-spacing: 1px; }
      .badge-sub { font-size: 0.8rem; color: #64748b; font-weight: 600; }
    }
    .meta-strip {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 16px; margin-bottom: 18px;
    }
    .meta-item {
      display: flex; flex-direction: column; gap: 2px;
      .meta-label { font-size: 0.72rem; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; }
      .meta-val { font-size: 0.88rem; color: #0f172a; }
      .receipt-no { font-family: monospace; font-weight: 700; color: #1e40af; }
      .mode-pill { font-weight: 600; color: #0284c7; }
    }
    .details-section {
      display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
      background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 16px;
    }
    .details-col { display: flex; flex-direction: column; gap: 6px; }
    .info-row {
      display: flex; justify-content: space-between; font-size: 0.84rem;
      .k { color: #64748b; }
      .v { color: #0f172a; }
    }
    .attendance-summary-box {
      display: flex; align-items: center; gap: 24px; background: #f0fdf4; border: 1px solid #bbf7d0;
      border-radius: 8px; padding: 8px 16px; margin-bottom: 18px; font-size: 0.83rem;
      .att-item { display: flex; align-items: center; gap: 6px; }
      .att-lbl { color: #166534; font-weight: 600; }
      .att-val { font-weight: 700; &.green { color: #15803d; } &.red { color: #b91c1c; } }
      .att-remarks { color: #64748b; font-size: 0.78rem; margin-left: auto; }
    }
    .breakdown-table-wrapper {
      margin-bottom: 18px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;
    }
    .payslip-table {
      width: 100%; border-collapse: collapse; font-size: 0.84rem;
      th, td { padding: 8px 14px; border: 1px solid #e2e8f0; }
      .th-earnings { background: #eff6ff; color: #1e40af; font-weight: 700; text-align: center; }
      .th-deductions { background: #fef2f2; color: #991b1b; font-weight: 700; text-align: center; }
      .sub-head th { background: #f8fafc; font-size: 0.75rem; color: #64748b; font-weight: 600; text-transform: uppercase; }
      .text-right { text-align: right; }
      .total-row { background: #f8fafc; border-top: 2px solid #cbd5e1; }
    }
    .net-payable-strip {
      display: flex; justify-content: space-between; align-items: center;
      background: #0f172a; color: #fff; padding: 14px 20px; border-radius: 8px; margin-bottom: 30px;
      .net-left { display: flex; flex-direction: column; gap: 4px; }
      .net-label { font-size: 0.88rem; font-weight: 800; letter-spacing: 0.5px; color: #93c5fd; }
      .net-words { font-size: 0.76rem; color: #cbd5e1; em { font-style: normal; color: #facc15; font-weight: 600; } }
      .net-right {
        display: flex; align-items: baseline; gap: 4px;
        .net-currency { font-size: 1.2rem; font-weight: 700; color: #4ade80; }
        .net-amount { font-size: 1.6rem; font-weight: 800; color: #4ade80; }
      }
    }
    .footer-signatures {
      display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 36px; padding-top: 10px;
    }
    .sig-box {
      display: flex; flex-direction: column; align-items: flex-start; gap: 6px; font-size: 0.78rem; color: #64748b;
      .sig-line { width: 140px; height: 1px; background: #94a3b8; margin-bottom: 4px; }
      &.text-center { align-items: center; }
      &.text-right { align-items: flex-end; }
    }
    .stamp-placeholder {
      display: flex; align-items: center; gap: 4px; border: 1.5px dashed #cbd5e1;
      padding: 4px 10px; border-radius: 20px; color: #94a3b8; font-size: 0.72rem;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .paper-disclaimer {
      margin-top: 24px; padding-top: 12px; border-top: 1px dashed #e2e8f0; text-align: center;
      p { margin: 0; font-size: 0.68rem; color: #94a3b8; }
    }

  `]
})
export class TeacherPayslipDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<TeacherPayslipDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PayslipDialogData
  ) {}

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
            .logo-mark { width: 48px; height: 48px; border-radius: 10px; background: #1e40af; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 24px; }
            .inst-name { font-size: 1.35rem; font-weight: 800; color: #0f172a; }
            .inst-subtitle { font-size: 0.8rem; color: #64748b; margin-top: 2px; }
            .payslip-badge { text-align: right; }
            .badge-title { display: block; font-size: 1.1rem; font-weight: 800; color: #1e40af; letter-spacing: 1px; }
            .badge-sub { font-size: 0.8rem; color: #64748b; font-weight: 600; }
            .meta-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 16px; margin-bottom: 18px; }
            .meta-label { font-size: 0.72rem; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; display: block; }
            .meta-val { font-size: 0.88rem; color: #0f172a; display: block; }
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
            .net-payable-strip { display: flex; justify-content: space-between; align-items: center; background: #0f172a; color: #fff; padding: 14px 20px; border-radius: 8px; margin-bottom: 30px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .net-label { font-size: 0.88rem; font-weight: 800; letter-spacing: 0.5px; color: #93c5fd; }
            .net-words { font-size: 0.76rem; color: #cbd5e1; margin-top: 4px; }
            .net-words em { font-style: normal; color: #facc15; font-weight: 600; }
            .net-right { display: flex; align-items: baseline; gap: 4px; }
            .net-currency { font-size: 1.2rem; font-weight: 700; color: #4ade80; }
            .net-amount { font-size: 1.6rem; font-weight: 800; color: #4ade80; }
            .footer-signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 36px; padding-top: 10px; }
            .sig-box { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; font-size: 0.78rem; color: #64748b; }
            .sig-line { width: 140px; height: 1px; background: #94a3b8; margin-bottom: 4px; }
            .sig-center { align-items: center; }
            .sig-right { align-items: flex-end; }
            .stamp-placeholder { display: flex; align-items: center; gap: 4px; border: 1.5px dashed #cbd5e1; padding: 4px 10px; border-radius: 20px; color: #94a3b8; font-size: 0.72rem; }
            .paper-disclaimer { margin-top: 24px; padding-top: 12px; border-top: 1px dashed #e2e8f0; text-align: center; font-size: 0.68rem; color: #94a3b8; }
            @media print {
              body { padding: 0; }
              @page { margin: 15mm; size: A4; }
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
