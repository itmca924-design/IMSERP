import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StudentFeeCard } from '../../core/services/fees.service';

export interface WhatsAppFeeCardDialogData {
  card: StudentFeeCard;
}

@Component({
  selector: 'app-whatsapp-fee-card-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule
  ],
  template: `
    <div class="dialog-wrapper">
      <!-- Strict Light Blue Header matching AGENTS.md rule -->
      <div class="dialog-header">
        <div class="header-icon-wrap">
          <mat-icon>share</mat-icon>
        </div>
        <div class="header-titles">
          <h2 mat-dialog-title class="main-title">Share Fee Passbook on WhatsApp</h2>
          <p class="subtitle">
            Send official fee status & 12-month passbook ledger directly to parent / guardian.
          </p>
        </div>
        <button mat-icon-button type="button" class="close-btn" (click)="onClose()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content class="dialog-content">
        <!-- Student Overview Summary Card -->
        <div class="student-summary-strip">
          <div class="avatar-pill">
            <mat-icon>person</mat-icon>
          </div>
          <div class="student-info-main">
            <div class="name-row">
              <strong class="st-name">{{ card.studentName }}</strong>
              <span class="st-class-badge">{{ getAcademicBadgeText() }}</span>
            </div>
            <div class="meta-row">
              <span>Roll: <strong>{{ card.rollNumber || '-' }}</strong></span>
              <span>•</span>
              <span>Adm No: <strong>{{ card.admissionNumber || '-' }}</strong></span>
              <span>•</span>
              <span>Session: <strong>{{ card.sessionName }}</strong></span>
            </div>
          </div>
          <div class="fee-badge-col">
            <span class="badge-label">Balance Due</span>
            <span class="badge-amount" [class.has-due]="card.totalBalanceDue > 0" [class.cleared]="card.totalBalanceDue <= 0">
              ₹{{ card.totalBalanceDue | number:'1.2-2' }}
            </span>
          </div>
        </div>

        <!-- Recipient Phone Number Form Field -->
        <div class="phone-input-section">
          <mat-form-field appearance="outline" class="w-100">
            <mat-label>Recipient Mobile / WhatsApp Number (मोबाइल नंबर)</mat-label>
            <mat-icon matPrefix class="input-icon">phone</mat-icon>
            <input
              matInput
              type="tel"
              [(ngModel)]="recipientPhone"
              placeholder="e.g. 9835728383"
              (ngModelChange)="onPhoneChange()"
            />
            <mat-hint>Enter 10-digit mobile number. Country code (+91) is added automatically.</mat-hint>
          </mat-form-field>
        </div>

        <!-- WhatsApp Message Preview -->
        <div class="preview-section">
          <div class="preview-header">
            <div class="preview-title">
              <mat-icon>chat</mat-icon>
              <span>WhatsApp Message Preview (संदेश पूर्वावलोकन)</span>
            </div>
            <button
              mat-stroked-button
              type="button"
              class="btn-copy-preview"
              (click)="copyMessage()"
              [matTooltip]="copied ? 'Copied!' : 'Copy to Clipboard'"
            >
              <mat-icon>{{ copied ? 'check' : 'content_copy' }}</mat-icon>
              <span>{{ copied ? 'Copied' : 'Copy' }}</span>
            </button>
          </div>

          <div class="message-bubble-box">
            <pre class="message-text">{{ messageText }}</pre>
          </div>
        </div>
      </mat-dialog-content>

      <!-- Standard Dialog Actions -->
      <mat-dialog-actions class="dialog-actions">
        <button mat-button type="button" class="btn-cancel" (click)="onClose()">
          Cancel
        </button>

        <button mat-stroked-button type="button" class="btn-copy-action" (click)="copyMessage()">
          <mat-icon>{{ copied ? 'check' : 'content_copy' }}</mat-icon>
          <span>{{ copied ? 'Copied to Clipboard' : 'Copy Message Text' }}</span>
        </button>

        <button
          mat-flat-button
          type="button"
          class="btn-send-wa"
          (click)="sendOnWhatsApp()"
        >
          <mat-icon>send</mat-icon>
          <span>Open & Send on WhatsApp</span>
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-wrapper {
      width: 100%;
      max-width: 650px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: inherit;
    }

    /* Strict Light Blue Gradient Header matching AGENTS.md rule */
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .header-icon-wrap {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: #2563eb;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }

    .header-icon-wrap mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .header-titles {
      flex: 1 1 auto;
    }

    .main-title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      color: #1e3a8a;
      line-height: 1.3;
    }

    .subtitle {
      margin: 3px 0 0;
      font-size: 0.8rem;
      color: #3b82f6;
    }

    .close-btn {
      color: #64748b;
    }

    .close-btn:hover {
      color: #1e293b;
    }

    /* Dialog Content */
    .dialog-content {
      padding: 16px 20px;
      max-height: 72vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    /* Student summary pill */
    .student-summary-strip {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .avatar-pill {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #dbeafe;
      color: #1d4ed8;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .student-info-main {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .name-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .st-name {
      font-size: 0.96rem;
      color: #0f172a;
    }

    .st-class-badge {
      font-size: 0.72rem;
      font-weight: 700;
      background: #e0f2fe;
      color: #0369a1;
      padding: 1px 6px;
      border-radius: 4px;
    }

    .meta-row {
      font-size: 0.78rem;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .meta-row strong {
      color: #334155;
    }

    .fee-badge-col {
      text-align: right;
      display: flex;
      flex-direction: column;
    }

    .badge-label {
      font-size: 0.68rem;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
    }

    .badge-amount {
      font-size: 1rem;
      font-weight: 800;
    }

    .badge-amount.has-due {
      color: #dc2626;
    }

    .badge-amount.cleared {
      color: #16a34a;
    }

    /* Form Field */
    .w-100 {
      width: 100%;
    }

    .input-icon {
      color: #2563eb;
      margin-right: 6px;
    }

    /* Message Preview */
    .preview-section {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
    }

    .preview-header {
      background: #f1f5f9;
      border-bottom: 1px solid #cbd5e1;
      padding: 8px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .preview-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.82rem;
      font-weight: 700;
      color: #1e3a8a;
    }

    .preview-title mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #2563eb;
    }

    .btn-copy-preview {
      font-size: 0.75rem;
      height: 28px;
      line-height: 28px;
      padding: 0 8px;
    }

    .btn-copy-preview mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      margin-right: 4px;
    }

    .message-bubble-box {
      background: #f8fafc;
      padding: 12px 14px;
      max-height: 260px;
      overflow-y: auto;
    }

    .message-text {
      margin: 0;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 0.8rem;
      color: #1e293b;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.45;
    }

    /* Dialog Actions */
    .dialog-actions {
      padding: 12px 20px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 10px;
      margin: 0;
      background: #ffffff;
    }

    .btn-cancel {
      color: #64748b;
    }

    .btn-copy-action {
      border-color: #cbd5e1;
      color: #334155;
    }

    .btn-send-wa {
      background: #16a34a !important;
      color: #ffffff !important;
      font-weight: 600;
      box-shadow: 0 2px 4px rgba(22, 163, 74, 0.25);
    }

    .btn-send-wa mat-icon {
      margin-right: 4px;
    }
  `]
})
export class WhatsAppFeeCardDialogComponent implements OnInit {
  card: StudentFeeCard;
  recipientPhone = '';
  messageText = '';
  copied = false;

  constructor(
    public dialogRef: MatDialogRef<WhatsAppFeeCardDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: WhatsAppFeeCardDialogData
  ) {
    this.card = data.card;
  }

  ngOnInit(): void {
    const rawPhone = this.card.parentWhatsAppPhone || this.card.emergencyContactPhone || '';
    this.recipientPhone = rawPhone;
    this.buildMessage();
  }

  onPhoneChange(): void {
    this.buildMessage();
  }

  getAcademicBadgeText(): string {
    const card = this.card;
    if (!card) return '-';
    if (card.batchName) {
      if (card.isSchoolStudent && card.className) {
        return `${card.batchName} • School: ${card.className}${card.sectionName ? ' (' + card.sectionName + ')' : ''}`;
      }
      if (card.className) {
        return `${card.batchName} • Academic Class: ${card.className}`;
      }
      return card.batchName;
    }
    const sec = card.sectionName ? ` (${card.sectionName})` : '';
    return `${card.className || '-'}${sec}`;
  }

  getSessionRangeLabel(card: any): string {
    if (!card || !card.months || card.months.length === 0) return 'Session Total';
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const parsed: { monthIdx: number; year: number }[] = [];
    for (const m of card.months) {
      if (!m.monthName) continue;
      const parts = m.monthName.trim().split(' ');
      if (parts.length < 2) continue;
      const mIdx = monthNames.indexOf(parts[0]);
      const yr = parseInt(parts[parts.length - 1], 10);
      if (mIdx !== -1 && !isNaN(yr)) parsed.push({ monthIdx: mIdx, year: yr });
    }
    if (parsed.length === 0) return 'Session Total';
    parsed.sort((a, b) => (a.year * 12 + a.monthIdx) - (b.year * 12 + b.monthIdx));
    const first = parsed[0];
    const last = parsed[parsed.length - 1];
    const f = `${shortMonths[first.monthIdx]} '${String(first.year).slice(-2)}`;
    const l = `${shortMonths[last.monthIdx]} '${String(last.year).slice(-2)}`;
    return first.monthIdx === last.monthIdx && first.year === last.year ? f : `${f} – ${l}`;
  }

  buildMessage(): void {
    const card = this.card;
    const paidMonths = (card.months || []).filter(m => m.status === 'Paid').map(m => m.monthShort);
    const dueMonths = (card.months || []).filter(m => m.status === 'Due' || m.status === 'Overdue').map(m => `${m.monthShort} (₹${m.balanceDue})`);
    const sessionRange = this.getSessionRangeLabel(card);

    const lines: string[] = [
      `🏛️ *${(card.instituteName || 'JnanDeep Campus').toUpperCase()}*`,
      `📄 *STUDENT FEE PASSBOOK (${sessionRange}) / शुल्क विवरण पत्र*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👤 *Student Name:* ${card.studentName}`,
      `🆔 *Admission No:* ${card.admissionNumber || '-'} | *Roll No:* ${card.rollNumber || '-'}`,
      card.batchName ? `🎯 *Coaching Batch:* ${this.getAcademicBadgeText()}` : `📚 *Class & Section:* ${this.getAcademicBadgeText()}`,
      `📅 *Academic Session:* ${card.sessionName}`,
      `👨‍👦 *Parent / Guardian:* ${card.parentName || card.motherName || '-'}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💰 *FEE FINANCIAL SUMMARY:*`,
      `• *Monthly Fee Rate:* ₹${card.monthlyFeeRate.toLocaleString('en-IN')}/mo`,
      `• *Session Total (${sessionRange}):* ₹${card.totalAnnualFee.toLocaleString('en-IN')}`,
      card.totalConcession > 0 ? `• *Concession Granted:* -₹${card.totalConcession.toLocaleString('en-IN')}` : '',
      `• *Total Paid Amount:* ₹${card.totalPaid.toLocaleString('en-IN')}`,
      `• *Net Balance Due:* ₹${card.totalBalanceDue.toLocaleString('en-IN')}`,
      card.pendingLibraryFine > 0 ? `• *Library Dues:* ₹${card.pendingLibraryFine.toLocaleString('en-IN')}` : '',
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📋 *STATUS BREAKDOWN:*`,
      paidMonths.length > 0 ? `✅ *Paid Months (${paidMonths.length}):* ${paidMonths.join(', ')}` : `• *Paid Months:* None`,
      dueMonths.length > 0 ? `⚠️ *Pending Dues (${dueMonths.length}):* ${dueMonths.join(', ')}` : `✅ *All monthly fees cleared!*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      card.totalBalanceDue > 0
        ? `⚠️ *NOTICE:* Please clear the outstanding dues of *₹${card.totalBalanceDue.toLocaleString('en-IN')}* at the institute cash counter or online on or before the 10th of the month.`
        : `🎉 *CLEARANCE:* All academic fees for Session ${card.sessionName} have been fully paid. Thank you!`,
      `\n📍 *Office:* ${card.instituteAddress || 'Parsa, Saran, Bihar'}`,
      card.institutePhone ? `📞 *Helpline / WhatsApp:* ${card.institutePhone}` : ''
    ].filter(Boolean);

    this.messageText = lines.join('\n');
  }

  copyMessage(): void {
    if (!this.messageText) return;
    navigator.clipboard.writeText(this.messageText).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2500);
    }).catch(() => {});
  }

  sendOnWhatsApp(): void {
    // 1. Copy message
    this.copyMessage();

    // 2. Clean phone number for wa.me
    let cleanPhone = (this.recipientPhone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    } else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
      cleanPhone = '91' + cleanPhone.substring(1);
    }

    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(this.messageText)}`
      : `https://wa.me/?text=${encodeURIComponent(this.messageText)}`;

    // 3. Open WhatsApp Web / App
    window.open(waUrl, '_blank');

    // 4. Close dialog
    this.dialogRef.close(true);
  }

  onClose(): void {
    this.dialogRef.close(false);
  }
}
