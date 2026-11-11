import { Component, Inject, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { CoachingService } from '../../../core/services/coaching.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

export interface FeeReminderDispatchItem {
  id?: string;
  studentId?: string;
  studentName: string;
  rollNumber?: string;
  className?: string;
  profilePhoto?: string;
  invoiceNumber?: string;
  totalAmount?: number;
  paidAmount?: number;
  dueAmount: number;
  status?: string;
  dueDate: string | Date;
  parentWhatsAppPhone?: string;
  selected?: boolean;
  dispatched?: boolean;
  alreadyRemindedToday?: boolean;
  lastRemindedAt?: string | Date;
  lastReminderType?: string;
  isSchoolStudent?: boolean;
  isCoachingStudent?: boolean;
  scopeTag?: string;
}

export interface FeeReminderDispatchDialogData {
  mode: 'single' | 'bulk';
  invoice?: FeeReminderDispatchItem;
  invoices?: FeeReminderDispatchItem[];
  instituteName: string;
}

@Component({
  selector: 'app-fee-reminder-dispatch-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatCheckboxModule
  ],
  template: `
    <div class="dispatch-dialog-wrap">
      <!-- Strict AGENTS.md Light Blue Gradient Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>{{ isBulkMode ? 'campaign' : 'chat' }}</mat-icon>
          </div>
          <div>
            <h2 class="modal-title">
              {{ isBulkMode ? 'Bulk WhatsApp Fee Reminders' : 'Send WhatsApp Fee Reminder' }}
            </h2>
            <p class="modal-subtitle">
              <strong style="color: #1e40af">{{ data.instituteName }}</strong>
              <span> &bull; {{ isBulkMode ? 'Manual Multi-Student Dispatch' : 'Personalized Student Dispatch' }}</span>
            </p>
          </div>
        </div>
        <button type="button" (click)="dialogRef.close()" class="close-btn" matTooltip="Close" aria-label="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Dialog Body -->
      <div class="modal-body">
        <!-- Message Type Selector (Agentic AI Toggle) -->
        <div class="msg-type-card">
          <div class="msg-type-header">
            <mat-icon class="ai-spark-icon">auto_awesome</mat-icon>
            <span class="ai-label">Agentic AI Message Format:</span>
          </div>
          <div class="type-pill-group">
            <button
              type="button"
              class="type-pill-btn"
              [class.active]="messageType === 'invoice'"
              (click)="selectMessageType('invoice')">
              <mat-icon>receipt_long</mat-icon>
              <div class="type-text">
                <span class="title">Invoice Message</span>
                <span class="sub">औपचारिक इनवॉइस विवरण</span>
              </div>
            </button>

            <button
              type="button"
              class="type-pill-btn"
              [class.active]="messageType === 'normal'"
              (click)="selectMessageType('normal')">
              <mat-icon>chat_bubble_outline</mat-icon>
              <div class="type-text">
                <span class="title">Normal / Friendly Nudge</span>
                <span class="sub">विनम्र स्मरण संदेश</span>
              </div>
            </button>
          </div>
        </div>

        <!-- ─── SINGLE MODE VIEW ─── -->
        @if (!isBulkMode && targetSingle) {
          <div class="single-card-wrap">
            <div class="student-meta-banner">
              <div class="stu-badge">
                <span class="avatar">{{ (targetSingle.studentName || 'S').charAt(0).toUpperCase() }}</span>
                <div>
                  <div class="stu-name-row">
                    <h4 class="name">{{ targetSingle.studentName }}</h4>
                    <span class="admission-scope-badge" [ngClass]="getScopeBadgeClass(targetSingle)">
                      {{ getScopeBadgeLabel(targetSingle) }}
                    </span>
                  </div>
                  <span class="roll">Roll: {{ targetSingle.rollNumber || 'N/A' }} • {{ targetSingle.className || 'General' }} • Inv: #{{ targetSingle.invoiceNumber || 'N/A' }}</span>
                </div>
              </div>
              <div class="due-badge">
                <span class="due-label">Pending Dues:</span>
                <span class="due-val">₹{{ targetSingle.dueAmount | number:'1.0-0' }}</span>
                @if ((targetSingle.paidAmount || 0) > 0 && (targetSingle.dueAmount || 0) > 0) {
                  <span class="partial-paid-badge">Partial • Paid ₹{{ targetSingle.paidAmount | number:'1.0-0' }}</span>
                }
              </div>
            </div>

            <!-- Message Preview Bubble -->
            <div class="wa-preview-box">
              <div class="wa-preview-header">
                <div class="wa-brand">
                  <mat-icon style="color: #25d366;">chat</mat-icon>
                  <span>WhatsApp Message Preview (Editable)</span>
                </div>
                <button type="button" class="copy-text-btn" (click)="copyCurrentMessage()" matTooltip="Copy Message">
                  <mat-icon>content_copy</mat-icon> Copy
                </button>
              </div>
              <textarea
                class="wa-message-textarea"
                rows="8"
                [(ngModel)]="activeMessageText">
              </textarea>
              <div class="phone-meta-row">
                <mat-icon class="ph-icon">phone_android</mat-icon>
                <span>Target Phone: <strong>{{ targetSingle.parentWhatsAppPhone || 'Phone Not Available' }}</strong></span>
              </div>
            </div>
          </div>
        }

        <!-- ─── BULK MODE VIEW ─── -->
        @if (isBulkMode) {
          <div class="bulk-card-wrap">
            <!-- Summary Action Bar -->
            <div class="bulk-summary-bar">
              <div class="select-all-box">
                <mat-checkbox
                  [checked]="isAllSelected"
                  [indeterminate]="isPartiallySelected"
                  (change)="toggleSelectAll($event.checked)">
                  <strong>Select All Defaulters</strong>
                </mat-checkbox>
                <span class="counter-badge">
                  {{ selectedCount }} of {{ studentList.length }} Selected
                </span>
              </div>
              <div class="total-due-chip">
                <span>Selected Dues:</span>
                <strong>₹{{ selectedTotalDue | number:'1.0-0' }}</strong>
              </div>
            </div>

            <!-- Message Template Notice -->
            <div class="template-notice">
              <mat-icon>info</mat-icon>
              <span>
                {{ messageType === 'invoice' ? 'Invoices format: औपचारिक इनवॉइस नंबर, बकाया राशि और ड्यू डेट शामिल रहेगा।' : 'Normal format: विनम्र स्मरण संदेश व समय पर फीस जमा करने का अनुरोध रहेगा।' }}
              </span>
            </div>

            <!-- Students Scrollable Table List -->
            <div class="bulk-list-container">
              <table class="bulk-table">
                <thead>
                  <tr>
                    <th class="cb-th"></th>
                    <th>Student Details</th>
                    <th>Invoice</th>
                    <th class="text-right">Dues</th>
                    <th>Parent Phone</th>
                    <th class="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  @for (s of studentList; track s.invoiceNumber || s.studentName) {
                    <tr [class.selected-row]="s.selected" [class.dispatched-row]="s.dispatched || s.alreadyRemindedToday">
                      <td class="cb-td">
                        <mat-checkbox [(ngModel)]="s.selected" [disabled]="!!s.alreadyRemindedToday" (change)="onStudentSelectChange()"></mat-checkbox>
                      </td>
                      <td class="stu-col">
                        <div class="stu-info-flex">
                          <div class="stu-name-row">
                            <strong class="stu-name">{{ s.studentName }}</strong>
                            <span class="admission-scope-badge" [ngClass]="getScopeBadgeClass(s)">
                              {{ getScopeBadgeLabel(s) }}
                            </span>
                            @if (isSibling(s)) {
                              <span class="sibling-badge" matTooltip="Shares phone with sibling in list">
                                <mat-icon>people</mat-icon> Sibling
                              </span>
                            }
                          </div>
                          <small class="stu-roll">Roll: {{ s.rollNumber || 'N/A' }} • {{ s.className || 'General' }}</small>
                          @if (s.alreadyRemindedToday) {
                            <span class="already-today-tag">
                              <mat-icon>done_all</mat-icon> Sent Today
                            </span>
                          }
                        </div>
                      </td>
                      <td class="inv-col">
                        <span class="inv-tag">#{{ s.invoiceNumber }}</span>
                      </td>
                      <td class="due-col text-right">
                        <div class="due-col-stack">
                          <span class="due-text">₹{{ s.dueAmount | number:'1.0-0' }}</span>
                          @if ((s.paidAmount || 0) > 0 && (s.dueAmount || 0) > 0) {
                            <span class="partial-paid-badge" [matTooltip]="'Total: ₹' + (s.totalAmount || (s.paidAmount! + s.dueAmount)) + ' | Paid: ₹' + s.paidAmount">
                              Partial • Paid ₹{{ s.paidAmount | number:'1.0-0' }}
                            </span>
                          }
                        </div>
                      </td>
                      <td class="phone-col">
                        @if (s.parentWhatsAppPhone) {
                          <span class="phone-tag">
                            <mat-icon>chat</mat-icon>
                            {{ s.parentWhatsAppPhone }}
                          </span>
                        } @else {
                          <span class="no-phone-tag">No Phone</span>
                        }
                      </td>
                      <td class="action-col text-center">
                        @if (s.alreadyRemindedToday) {
                          <span class="dispatched-badge" matTooltip="Reminder already sent today">
                            <mat-icon>done_all</mat-icon> Sent Today
                          </span>
                        } @else if (s.dispatched) {
                          <span class="dispatched-badge" matTooltip="Already opened in WhatsApp">
                            <mat-icon>check_circle</mat-icon> Sent
                          </span>
                        } @else {
                          <button
                            type="button"
                            class="dispatch-wa-btn"
                            (click)="sendSingleFromBulk(s)"
                            [disabled]="!s.parentWhatsAppPhone"
                            matTooltip="Open in WhatsApp Web with pre-filled message"
                            matButton="filled">
                            <mat-icon>chat</mat-icon>
                            <span>Send</span>
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      </div>

      <!-- Dialog Footer Actions -->
      <div class="modal-footer">
        <button type="button" class="cancel-btn" (click)="dialogRef.close()" matButton="outlined">
          Close
        </button>

        @if (!isBulkMode && targetSingle) {
          <button
            type="button"
            class="open-wa-btn"
            (click)="dispatchSingleWhatsApp(targetSingle)"
            [disabled]="!targetSingle.parentWhatsAppPhone"
            matTooltip="Launch WhatsApp Web or Desktop App"
            matButton="filled">
            <mat-icon>chat</mat-icon>
            <span>Open in WhatsApp</span>
          </button>
        }

        @if (isBulkMode) {
          <button
            type="button"
            class="open-wa-btn"
            (click)="dispatchFirstSelected()"
            [disabled]="selectedCount === 0"
            matTooltip="Start sending to selected students in order"
            matButton="filled">
            <mat-icon>send</mat-icon>
            <span>Start Dispatch ({{ selectedCount }})</span>
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .dispatch-dialog-wrap {
      display: flex;
      flex-direction: column;
      width: 100%;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-sizing: border-box;
    }

    /* Strict AGENTS.md Header */
    .modal-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;

      .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;

        .header-icon-box {
          background: #2563eb;
          color: #ffffff;
          border-radius: 10px;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;

          mat-icon {
            font-size: 22px;
            width: 22px;
            height: 22px;
          }
        }

        .modal-title {
          margin: 0;
          font-size: 1.12rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.25;
        }

        .modal-subtitle {
          margin: 2px 0 0;
          font-size: 0.8rem;
          color: #3b82f6;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      .close-btn {
        color: #64748b;
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        min-width: 36px;
        min-height: 36px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: rgba(148, 163, 184, 0.2);
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          color: #1e293b;
          background: rgba(148, 163, 184, 0.35);
        }

        mat-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          width: 20px;
          height: 20px;
          line-height: 20px;
          margin: 0;
        }
      }
    }

    .modal-body {
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-height: calc(85vh - 120px);
      overflow-y: auto;
      box-sizing: border-box;

      &::-webkit-scrollbar { width: 6px; }
      &::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 #f8fafc;
    }

    /* Agentic AI Message Type Selector */
    .msg-type-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .msg-type-header {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #1e3a8a;
        font-size: 0.82rem;
        font-weight: 700;

        .ai-spark-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #2563eb;
        }
      }

      .type-pill-group {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;

        @media (max-width: 540px) {
          grid-template-columns: 1fr;
        }
      }

      .type-pill-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        background: #ffffff;
        border: 1.5px solid #cbd5e1;
        border-radius: 8px;
        cursor: pointer;
        text-align: left;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

        mat-icon {
          color: #64748b;
          font-size: 20px;
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }

        .type-text {
          display: flex;
          flex-direction: column;
          min-width: 0;

          .title {
            font-size: 0.85rem;
            font-weight: 700;
            color: #1e293b;
          }

          .sub {
            font-size: 0.72rem;
            color: #64748b;
          }
        }

        &:hover {
          border-color: #93c5fd;
          background: #eff6ff;
        }

        &.active {
          border-color: #2563eb;
          background: #eff6ff;
          box-shadow: 0 0 0 1px #2563eb;

          mat-icon {
            color: #2563eb;
          }

          .type-text .title {
            color: #1d4ed8;
          }
        }
      }
    }

    /* Single Mode Wrap */
    .single-card-wrap {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .student-meta-banner {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 10px 14px;
        flex-wrap: wrap;
        gap: 10px;

        .stu-badge {
          display: flex;
          align-items: center;
          gap: 10px;

          .avatar {
            width: 34px;
            height: 34px;
            border-radius: 8px;
            background: #2563eb;
            color: #ffffff;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .name {
            margin: 0;
            font-size: 0.95rem;
            color: #0f172a;
          }

          .roll {
            font-size: 0.75rem;
            color: #64748b;
          }
        }

        .due-badge {
          display: flex;
          align-items: center;
          gap: 6px;

          .due-label {
            font-size: 0.8rem;
            color: #475569;
          }

          .due-val {
            font-size: 1.05rem;
            font-weight: 800;
            color: #dc2626;
          }
        }
      }

      .wa-preview-box {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;

        .wa-preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .wa-brand {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.82rem;
            font-weight: 700;
            color: #15803d;
          }

          .copy-text-btn {
            border: 1px solid #cbd5e1;
            background: #f8fafc;
            border-radius: 6px;
            padding: 3px 8px;
            font-size: 0.72rem;
            font-weight: 600;
            color: #475569;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 4px;

            mat-icon { font-size: 14px; width: 14px; height: 14px; }
            &:hover { background: #eff6ff; color: #1d4ed8; }
          }
        }

        .wa-message-textarea {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 10px;
          font-family: inherit;
          font-size: 0.85rem;
          color: #0f172a;
          line-height: 1.45;
          resize: vertical;
          box-sizing: border-box;
          background: #fdfdfd;

          &:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
          }
        }

        .phone-meta-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          color: #475569;
          .ph-icon { font-size: 16px; width: 16px; height: 16px; color: #16a34a; }
        }
      }
    }

    /* Bulk Mode Wrap */
    .bulk-card-wrap {
      display: flex;
      flex-direction: column;
      gap: 10px;

      .bulk-summary-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 8px 14px;
        flex-wrap: wrap;
        gap: 8px;

        .select-all-box {
          display: flex;
          align-items: center;
          gap: 10px;

          .counter-badge {
            background: #e0f2fe;
            color: #0369a1;
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 0.76rem;
            font-weight: 700;
          }
        }

        .total-due-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.82rem;
          color: #475569;

          strong {
            color: #dc2626;
            font-size: 0.95rem;
          }
        }
      }

      .template-notice {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 0.78rem;
        color: #1e40af;

        mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; flex-shrink: 0; }
      }

      .bulk-list-container {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        overflow-x: auto;
        max-height: 280px;

        &::-webkit-scrollbar { height: 6px; width: 6px; }
        &::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }
        scrollbar-width: thin;
      }

      .bulk-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.82rem;

        th {
          background: #f8fafc;
          padding: 8px 10px;
          color: #475569;
          font-weight: 700;
          border-bottom: 1.5px solid #e2e8f0;
          white-space: nowrap;
          text-align: left;
        }

        td {
          padding: 8px 10px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
          transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        tbody tr {
          transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease;

          &:hover {
            box-shadow: inset 3px 0 0 #2563eb;

            td {
              background-color: #f0f7ff !important;
            }
          }
        }

        tr.selected-row td {
          background: #eff6ff;
        }

        tr.selected-row:hover td {
          background: #dbeafe !important;
        }

        tr.dispatched-row td {
          opacity: 0.85;
        }

        .cb-th, .cb-td {
          width: 36px;
          text-align: center;
        }

        .stu-col {
          padding: 8px 10px;

          .stu-info-flex {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 3px;

            .stu-name-row {
              display: flex;
              align-items: center;
              gap: 6px;
              flex-wrap: wrap;
            }

            .admission-scope-badge {
              font-size: 0.65rem;
              font-weight: 700;
              letter-spacing: 0.02em;
              padding: 1px 6px;
              border-radius: 4px;
              display: inline-flex;
              align-items: center;
              line-height: 1.4;
              white-space: nowrap;

              &.badge-school {
                background: #eff6ff;
                color: #1d4ed8;
                border: 1px solid #bfdbfe;
              }

              &.badge-coaching {
                background: #f5f3ff;
                color: #6d28d9;
                border: 1px solid #ddd6fe;
              }

              &.badge-hybrid {
                background: linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%);
                color: #047857;
                border: 1px solid #86efac;
              }
            }

            .sibling-badge {
              display: inline-flex;
              align-items: center;
              gap: 2px;
              font-size: 0.65rem;
              font-weight: 700;
              padding: 1px 5px;
              border-radius: 4px;
              background: #fef3c7;
              color: #b45309;
              border: 1px solid #fde68a;
              line-height: 1.4;
              white-space: nowrap;

              mat-icon {
                font-size: 11px;
                width: 11px;
                height: 11px;
                line-height: 11px;
              }
            }

            .stu-name {
              color: #0f172a;
              font-size: 0.85rem;
              font-weight: 700;
              line-height: 1.25;
              white-space: nowrap;
            }

            .stu-roll {
              color: #64748b;
              font-size: 0.73rem;
              line-height: 1.2;
              white-space: nowrap;
            }
          }
        }

        .inv-tag {
          font-family: monospace;
          color: #475569;
          font-size: 0.75rem;
        }

        .due-col-stack {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .due-text {
          font-weight: 700;
          color: #dc2626;
        }

        .partial-paid-badge {
          font-size: 0.62rem;
          font-weight: 700;
          padding: 1px 5px;
          border-radius: 4px;
          background: #fffbeb;
          color: #b45309;
          border: 1px solid #fde68a;
          white-space: nowrap;
          line-height: 1.25;
        }

        .phone-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #15803d;
          font-size: 0.75rem;
          white-space: nowrap;
          mat-icon { font-size: 14px; width: 14px; height: 14px; color: #25d366; }
        }

        .no-phone-tag {
          color: #94a3b8;
          font-size: 0.72rem;
          font-style: italic;
        }

        .dispatched-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 0.72rem;
          color: #16a34a;
          font-weight: 700;
          margin-right: 6px;
          mat-icon { font-size: 14px; width: 14px; height: 14px; }
        }

        .already-today-tag {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 0.68rem;
          color: #0369a1;
          background: #e0f2fe;
          border: 1px solid #bae6fd;
          padding: 1px 5px;
          border-radius: 4px;
          font-weight: 700;
          margin-top: 2px;
          width: fit-content;
          mat-icon { font-size: 12px; width: 12px; height: 12px; color: #0284c7; }
        }

        .dispatch-wa-btn {
          background: #25d366;
          color: #ffffff;
          padding: 4px 8px;
          font-size: 0.72rem;
          font-weight: 600;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 3px;

          mat-icon { font-size: 14px; width: 14px; height: 14px; }
          &:hover { background: #1eb855; }
          &:disabled { background: #e2e8f0; color: #94a3b8; cursor: not-allowed; }
        }
      }
    }

    .modal-footer {
      border-top: 1px solid #e2e8f0;
      padding: 12px 20px;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 10px;
      background: #f8fafc;

      .cancel-btn {
        color: #64748b;
        border-color: #cbd5e1;
      }

      .open-wa-btn {
        background: #25d366;
        color: #ffffff;
        font-weight: 700;
        box-shadow: 0 2px 6px rgba(37, 211, 102, 0.3);

        &:hover { background: #1eb855; }
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeeReminderDispatchDialogComponent implements OnInit {
  isBulkMode = false;
  messageType: 'invoice' | 'normal' = 'invoice';
  targetSingle: FeeReminderDispatchItem | null = null;
  studentList: FeeReminderDispatchItem[] = [];
  activeMessageText = '';

  constructor(
    public dialogRef: MatDialogRef<FeeReminderDispatchDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FeeReminderDispatchDialogData,
    private coachingService: CoachingService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {
    this.isBulkMode = data.mode === 'bulk';
    if (this.isBulkMode && data.invoices) {
      this.studentList = data.invoices.map(x => ({
        ...x,
        selected: !x.alreadyRemindedToday,
        dispatched: x.alreadyRemindedToday || false
      }));
    } else if (data.invoice) {
      this.targetSingle = { ...data.invoice };
    }
  }

  ngOnInit(): void {
    this.updateActiveMessage();
  }

  selectMessageType(type: 'invoice' | 'normal'): void {
    if (this.messageType === type) return;
    this.messageType = type;
    this.updateActiveMessage();
    this.cdr.markForCheck();
  }

  updateActiveMessage(): void {
    if (this.targetSingle) {
      this.activeMessageText = this.messageType === 'invoice'
        ? this.buildInvoiceMessage(this.targetSingle)
        : this.buildNormalMessage(this.targetSingle);
    }
  }

  buildInvoiceMessage(inv: FeeReminderDispatchItem): string {
    const inst = this.data.instituteName || 'Institute';
    const sName = inv.studentName || 'Student';
    const roll = inv.rollNumber || 'N/A';
    const cls = inv.className || 'General';
    const scope = this.getScopeBadgeLabel(inv);
    const invNo = inv.invoiceNumber || 'INV';
    const amt = inv.dueAmount != null ? inv.dueAmount : 0;
    const paid = inv.paidAmount || 0;
    const total = inv.totalAmount || (paid + amt);
    const dDate = inv.dueDate
      ? new Date(inv.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'Due Soon';

    const amountBreakdown = paid > 0
      ? `• Total Fee Amount: ₹${total}\n• Amount Paid (Partial): ₹${paid}\n• Remaining Balance Due: *₹${amt}*`
      : `• Pending Dues: *₹${amt}*`;

    return `*FEE DUE INVOICE REMINDER*\n🏛️ *${inst}*\n━━━━━━━━━━━━━━━━━━━━━━\nDear Parent,\nThis is an official fee payment intimation for your ward *${sName}* (Class: *${cls}* | Roll: *${roll}* | Division: *${scope}*).\n\n📋 *Invoice Summary:*\n• Invoice No: #${invNo}\n${amountBreakdown}\n• Due Date: ${dDate}\n\n💳 *Payment Clearance:*\nKindly clear the pending fee dues at your earliest convenience via Online UPI or at the Campus Accounts Desk.\n\nThank you for your cooperation!`;
  }

  getScopeBadgeLabel(s: any): string {
    if (s?.scopeTag) return s.scopeTag;
    if (s?.isSchoolStudent && s?.isCoachingStudent) return 'School + Coaching';
    if (s?.isCoachingStudent) return 'Coaching';
    return 'School';
  }

  getScopeBadgeClass(s: any): string {
    const label = this.getScopeBadgeLabel(s);
    if (label.includes('+')) return 'badge-hybrid';
    if (label === 'Coaching') return 'badge-coaching';
    return 'badge-school';
  }

  isSibling(s: any): boolean {
    if (!s?.parentWhatsAppPhone) return false;
    const clean = s.parentWhatsAppPhone.replace(/\D/g, '');
    if (clean.length < 10) return false;
    const target = clean.slice(-10);
    return this.studentList.filter(x => x.parentWhatsAppPhone && x.parentWhatsAppPhone.replace(/\D/g, '').endsWith(target)).length > 1;
  }

  buildNormalMessage(inv: FeeReminderDispatchItem): string {
    const inst = this.data.instituteName || 'Institute';
    const sName = inv.studentName || 'Student';
    const roll = inv.rollNumber || 'N/A';
    const cls = inv.className || 'General';
    const scope = this.getScopeBadgeLabel(inv);
    const amt = inv.dueAmount != null ? inv.dueAmount : 0;
    const paid = inv.paidAmount || 0;
    const total = inv.totalAmount || (paid + amt);
    const dDate = inv.dueDate
      ? new Date(inv.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '';
    const dateNotice = dDate ? `\n📅 नियत देय तिथि (Due Date): *${dDate}*\n` : '';

    const feeSentence = paid > 0
      ? `संस्थान के रिकॉर्ड अनुसार आपके बच्चे *${sName}* (कक्षा/बैच: *${cls}* | Roll: *${roll}* | विभाग: *${scope}*) की कुल फीस *₹${total}* में से *₹${paid}* (आंशिक भुगतान) जमा हो चुकी है तथा शेष बकाया राशि *₹${amt}* देय है।`
      : `संस्थान के रिकॉर्ड अनुसार आपके बच्चे *${sName}* (कक्षा/बैच: *${cls}* | Roll: *${roll}* | विभाग: *${scope}*) की फीस *₹${amt}* देय है।`;

    return `*FEE REMINDER NOTICE*\n🏛️ *${inst}*\n━━━━━━━━━━━━━━━━━━━━━━\nआदरणीय अभिभावक जी,\nसादर प्रणाम।\n\n${feeSentence}${dateNotice}\nबच्चे की नियमित पढ़ाई, उपस्थिति और आगामी परीक्षाओं की सुचारू निरंतरता हेतु कृपया शेष फीस समय पर संस्थान कार्यालय में जमा कराएं अथवा ऑनलाइन माध्यम से भुगतान करें।\n\nसधन्यवाद,\n*${inst} (Accounts Office)*`;
  }

  get isAllSelected(): boolean {
    return this.studentList.length > 0 && this.studentList.every(s => s.selected);
  }

  get isPartiallySelected(): boolean {
    const count = this.selectedCount;
    return count > 0 && count < this.studentList.length;
  }

  get selectedCount(): number {
    return this.studentList.filter(s => s.selected).length;
  }

  get selectedTotalDue(): number {
    return this.studentList.filter(s => s.selected).reduce((acc, curr) => acc + (curr.dueAmount || 0), 0);
  }

  toggleSelectAll(checked: boolean): void {
    this.studentList.forEach(s => s.selected = checked);
    this.cdr.markForCheck();
  }

  onStudentSelectChange(): void {
    this.cdr.markForCheck();
  }

  copyCurrentMessage(): void {
    if (!this.activeMessageText) return;
    navigator.clipboard.writeText(this.activeMessageText).then(() => {
      this.confirmDialog.alert('Copied!', 'WhatsApp message copied to clipboard.', 'success');
    });
  }

  dispatchSingleWhatsApp(inv: FeeReminderDispatchItem): void {
    if (!inv.parentWhatsAppPhone) {
      this.confirmDialog.alert('No Phone', 'Parent WhatsApp phone number is not available for this student.', 'warning');
      return;
    }

    if (inv.alreadyRemindedToday) {
      this.confirmDialog.alert('Already Reminded Today', `Fee reminder has already been dispatched to ${inv.studentName} today. Per-day single message limit is active.`, 'info');
      return;
    }

    const rawPhone = inv.parentWhatsAppPhone.replace(/\D/g, '');
    const formattedPhone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;
    const msg = this.activeMessageText || (this.messageType === 'invoice' ? this.buildInvoiceMessage(inv) : this.buildNormalMessage(inv));
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;

    this.coachingService.logReminderDispatched({
      studentId: inv.studentId || inv.id || '',
      studentName: inv.studentName,
      recipientPhone: inv.parentWhatsAppPhone,
      reminderType: 'WhatsApp',
      invoiceId: inv.id
    }).subscribe({ error: () => {} });

    window.open(waUrl, '_blank');
    inv.dispatched = true;
    inv.alreadyRemindedToday = true;
    this.cdr.markForCheck();
  }

  sendSingleFromBulk(s: FeeReminderDispatchItem): void {
    if (!s.parentWhatsAppPhone) return;

    if (s.alreadyRemindedToday) {
      this.confirmDialog.alert('Already Reminded Today', `Fee reminder has already been sent to ${s.studentName} today.`, 'info');
      return;
    }

    const msg = this.messageType === 'invoice' ? this.buildInvoiceMessage(s) : this.buildNormalMessage(s);
    const rawPhone = s.parentWhatsAppPhone.replace(/\D/g, '');
    const formattedPhone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;

    this.coachingService.logReminderDispatched({
      studentId: s.studentId || s.id || '',
      studentName: s.studentName,
      recipientPhone: s.parentWhatsAppPhone,
      reminderType: 'WhatsApp',
      invoiceId: s.id
    }).subscribe({ error: () => {} });

    window.open(waUrl, '_blank');
    s.dispatched = true;
    s.alreadyRemindedToday = true;
    s.selected = false;
    this.cdr.markForCheck();
  }

  dispatchFirstSelected(): void {
    const nextPending = this.studentList.find(s => s.selected && s.parentWhatsAppPhone && !s.dispatched && !s.alreadyRemindedToday);
    if (nextPending) {
      this.sendSingleFromBulk(nextPending);
    } else {
      const anySelected = this.studentList.find(s => s.selected && s.parentWhatsAppPhone);
      if (anySelected) {
        this.sendSingleFromBulk(anySelected);
      } else {
        this.confirmDialog.alert('All Sent', 'All selected students have either been dispatched or already reminded today.', 'info');
      }
    }
  }
}

