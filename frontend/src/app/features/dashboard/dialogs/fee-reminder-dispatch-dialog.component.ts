import { Component, Inject, OnInit, OnDestroy, Optional, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { CoachingService } from '../../../core/services/coaching.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { FeeRecoveryAgentService } from '../../../core/services/fee-recovery-agent.service';
import { AuthService } from '../../../core/services/auth.service';

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
              {{ isBulkMode ? 'Bulk WhatsApp Fee Reminders' : (isPaidSingle ? 'Send WhatsApp Payment Receipt' : 'Send WhatsApp Fee Reminder') }}
            </h2>
            <p class="modal-subtitle">
              <strong style="color: #1e40af">{{ data.instituteName }}</strong>
              <span> &bull; {{ isBulkMode ? 'Manual Multi-Student Dispatch' : (isPaidSingle ? 'Paid Receipt Dispatch' : 'Personalized Student Dispatch') }}</span>
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

            <button
              type="button"
              class="type-pill-btn"
              [class.active]="messageType === 'voice'"
              (click)="selectMessageType('voice')">
              <mat-icon>record_voice_over</mat-icon>
              <div class="type-text">
                <span class="title">Voice Message</span>
                <span class="sub">वॉयस संदेश व ऑडियो</span>
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
                <div class="stu-details">
                  <div class="stu-name-row">
                    <h4 class="name">{{ targetSingle.studentName }}</h4>
                    <span class="admission-scope-badge" [ngClass]="getScopeBadgeClass(targetSingle)">
                      {{ getScopeBadgeLabel(targetSingle) }}
                    </span>
                  </div>
                  <div class="stu-tags-row">
                    <span class="meta-tag"><mat-icon>school</mat-icon> {{ targetSingle.className || 'General' }}</span>
                    @if (targetSingle.rollNumber) {
                      <span class="meta-tag"><mat-icon>badge</mat-icon> Roll: {{ targetSingle.rollNumber }}</span>
                    }
                    @if (targetSingle.invoiceNumber) {
                      <span class="meta-tag"><mat-icon>receipt</mat-icon> #{{ targetSingle.invoiceNumber }}</span>
                    }
                  </div>
                </div>
              </div>

              <!-- Dues Status Pod -->
              <div class="due-card-pod" [class.is-paid]="isPaidSingle">
                <div class="due-pod-top">
                  <mat-icon class="due-pod-icon">{{ isPaidSingle ? 'verified' : 'pending_actions' }}</mat-icon>
                  <span class="due-label">{{ isPaidSingle ? 'Payment Status' : 'Pending Dues' }}</span>
                </div>
                <div class="due-amount-display">
                  {{ isPaidSingle ? 'PAID / ₹0' : ('₹' + (targetSingle.dueAmount | number:'1.0-0')) }}
                </div>
                @if (!isPaidSingle && (targetSingle.paidAmount || 0) > 0) {
                  <span class="partial-tag">Partial Paid: ₹{{ targetSingle.paidAmount | number:'1.0-0' }}</span>
                }
              </div>
            </div>

            <!-- Smart AI Voice Studio Card -->
            @if (messageType === 'voice') {
              <div class="voice-audio-card smart-voice-card">
                <!-- Top config bar: Voice selection + Speed + Waveform -->
                <div class="voice-top-header">
                  <div class="voice-talent-wrap">
                    <span class="section-label">🎙️ AI Hindi Voice:</span>
                    <div class="talent-pill-group">
                      <button
                        type="button"
                        class="talent-btn"
                        [class.active]="selectedVoiceGender === 'Female'"
                        (click)="setVoiceGender('Female')">
                        <span class="talent-avatar female">👩</span>
                        <div class="talent-info">
                          <span class="t-name">Swara</span>
                          <span class="t-desc">प्राकृतिक हिंदी (Female)</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        class="talent-btn"
                        [class.active]="selectedVoiceGender === 'Male'"
                        (click)="setVoiceGender('Male')">
                        <span class="talent-avatar male">👨</span>
                        <div class="talent-info">
                          <span class="t-name">Madhur</span>
                          <span class="t-desc">स्पष्ट हिंदी (Male)</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  <!-- Voice Speed & Equalizer -->
                  <div class="voice-meta-tools">
                    <div class="speed-toggle-wrap">
                      <span class="tool-label">Speed:</span>
                      <button type="button" class="speed-btn" [class.active]="speechRate === 0.9" (click)="setSpeechRate(0.9)">0.9x</button>
                      <button type="button" class="speed-btn" [class.active]="speechRate === 1.0" (click)="setSpeechRate(1.0)">1.0x</button>
                      <button type="button" class="speed-btn" [class.active]="speechRate === 1.15" (click)="setSpeechRate(1.15)">1.2x</button>
                    </div>
                    <div class="lang-toggle-wrap">
                      <span class="tool-label">Lang:</span>
                      <button type="button" class="lang-btn" [class.active]="speechLang === 'hi-IN'" (click)="setSpeechLang('hi-IN')">
                        🇮🇳 HIN
                      </button>
                      <button type="button" class="lang-btn" [class.active]="speechLang === 'en-IN'" (click)="setSpeechLang('en-IN')">
                        🔤 ENG
                      </button>
                    </div>

                    <div class="audio-wave-badge" [class.is-playing]="isPlayingAudio">
                      <div class="equalizer-bars" [class.animating]="isPlayingAudio">
                        <span class="bar bar-1"></span>
                        <span class="bar bar-2"></span>
                        <span class="bar bar-3"></span>
                        <span class="bar bar-4"></span>
                        <span class="bar bar-5"></span>
                      </div>
                      <span class="wave-status-text">
                        {{ isLoadingVoice ? 'Connecting AI Voice...' : (isPlayingAudio ? 'Speaking Voice Note...' : 'Voice Ready') }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Voice Action Bar -->
                <div class="voice-smart-actions">
                  <button
                    type="button"
                    class="main-voice-play-btn"
                    [class.playing]="isPlayingAudio"
                    (click)="togglePlaySpeech()"
                    matTooltip="Play / Stop Voice Note in natural Hindi">
                    <mat-icon>{{ isLoadingVoice ? 'hourglass_top' : (isPlayingAudio ? 'stop_circle' : 'play_circle') }}</mat-icon>
                    <span>{{ isLoadingVoice ? 'Loading AI Voice...' : (isPlayingAudio ? 'Stop Voice (रोकें)' : 'Play Voice Note (सुनें)') }}</span>
                  </button>

                  <button
                    type="button"
                    class="main-voice-download-btn"
                    (click)="downloadVoiceAudio()"
                    [disabled]="isDownloadingAudio"
                    matTooltip="Download MP3 audio to attach in WhatsApp chat">
                    <mat-icon>{{ isDownloadingAudio ? 'hourglass_top' : 'download_for_offline' }}</mat-icon>
                    <span>{{ isDownloadingAudio ? 'Generating MP3...' : 'Download MP3 Note' }}</span>
                  </button>

                  <div class="pronounce-badge" [matTooltip]="'Natural AI Neural Hindi Voice: ' + activeInstituteName">
                    <mat-icon>record_voice_over</mat-icon>
                    <span>वॉइस: <strong>{{ activeInstituteName }}</strong></span>
                  </div>
                </div>

                <!-- WhatsApp Audio Attachment Guidance Tip -->
                <div class="voice-hint-tip">
                  <mat-icon class="hint-icon">lightbulb</mat-icon>
                  <span>WhatsApp चैट में असली ग्रीन प्ले बटन वाला वॉयस नोट भेजने के लिए <strong>'Download MP3 Note'</strong> करें और चैट में अटैच (📎) कर भेजें।</span>
                </div>
              </div>
            }

            <!-- Message Preview Bubble -->
            <div class="wa-preview-box">
              <div class="wa-preview-header">
                <div class="wa-brand">
                  <mat-icon style="color: #25d366;">chat</mat-icon>
                  <span>WhatsApp Message Preview (Editable)</span>
                </div>
                <div class="header-action-tools">
                  <button
                    type="button"
                    class="listen-speech-mini-btn"
                    [class.is-playing]="isPlayingAudio"
                    (click)="togglePlaySpeech()"
                    [matTooltip]="isPlayingAudio ? 'Stop Voice Playback' : 'Listen to message in Hindi voice'">
                    <mat-icon>{{ isPlayingAudio ? 'stop' : 'volume_up' }}</mat-icon>
                    <span>{{ isPlayingAudio ? 'Stop' : 'Listen' }}</span>
                  </button>
                  <button type="button" class="copy-text-btn" (click)="copyCurrentMessage()" matTooltip="Copy Message">
                    <mat-icon>content_copy</mat-icon> Copy
                  </button>
                </div>
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
                {{ messageType === 'invoice' ? 'Invoices format: औपचारिक इनवॉइस नंबर, बकाया राशि और ड्यू डेट शामिल रहेगा।' : (messageType === 'normal' ? 'Normal format: विनम्र स्मरण संदेश व समय पर फीस जमा करने का अनुरोध रहेगा।' : 'Voice format: अभिभावक को हिंदी में वॉयस स्मरण संदेश व नियत देय तिथि के साथ आधिकारिक विवरण भेजा जाएगा।') }}
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
                        <mat-checkbox [(ngModel)]="s.selected" (change)="onStudentSelectChange()"></mat-checkbox>
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
                        <button
                          type="button"
                          class="dispatch-wa-btn"
                          (click)="sendSingleFromBulk(s)"
                          [disabled]="!s.parentWhatsAppPhone"
                          [matTooltip]="(s.alreadyRemindedToday || s.dispatched) ? 'Send another WhatsApp reminder' : 'Open in WhatsApp Web with pre-filled message'"
                          matButton="filled">
                          <mat-icon>{{ (s.alreadyRemindedToday || s.dispatched) ? 'done_all' : 'chat' }}</mat-icon>
                          <span>{{ (s.alreadyRemindedToday || s.dispatched) ? 'Re-send' : 'Send' }}</span>
                        </button>
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
      max-width: 820px;
      min-width: 320px;
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
      padding: 18px 22px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-height: calc(88vh - 125px);
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
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap: 10px;

        @media (max-width: 600px) {
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
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 12px 16px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        flex-wrap: wrap;
        gap: 14px;

        .stu-badge {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 240px;
          flex: 1 1 auto;

          .avatar {
            width: 44px;
            height: 44px;
            border-radius: 10px;
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: #ffffff;
            font-weight: 800;
            font-size: 1.15rem;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
            flex-shrink: 0;
          }

          .stu-details {
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-width: 0;

            .stu-name-row {
              display: flex;
              align-items: center;
              gap: 8px;
              flex-wrap: wrap;

              .name {
                margin: 0;
                font-size: 1.05rem;
                font-weight: 700;
                color: #0f172a;
                text-transform: capitalize;
              }
            }

            .stu-tags-row {
              display: flex;
              align-items: center;
              gap: 6px;
              flex-wrap: wrap;

              .meta-tag {
                display: inline-flex;
                align-items: center;
                gap: 3px;
                font-size: 0.72rem;
                color: #475569;
                background: #f1f5f9;
                border: 1px solid #e2e8f0;
                padding: 1px 6px;
                border-radius: 4px;
                font-weight: 500;

                mat-icon {
                  font-size: 13px;
                  width: 13px;
                  height: 13px;
                  color: #64748b;
                }
              }
            }
          }
        }

        .due-card-pod {
          background: #fef2f2;
          border: 1.5px solid #fecaca;
          border-radius: 10px;
          padding: 8px 14px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          min-width: 130px;
          box-shadow: 0 1px 2px rgba(239, 68, 68, 0.06);

          .due-pod-top {
            display: flex;
            align-items: center;
            gap: 4px;

            .due-pod-icon {
              font-size: 15px;
              width: 15px;
              height: 15px;
              color: #dc2626;
            }

            .due-label {
              font-size: 0.72rem;
              font-weight: 700;
              color: #991b1b;
              text-transform: uppercase;
              letter-spacing: 0.03em;
            }
          }

          .due-amount-display {
            font-size: 1.25rem;
            font-weight: 800;
            color: #b91c1c;
            line-height: 1.2;
            margin-top: 2px;
          }

          .partial-tag {
            font-size: 0.64rem;
            font-weight: 700;
            color: #b45309;
            background: #fef3c7;
            padding: 1px 5px;
            border-radius: 3px;
            margin-top: 3px;
          }

          &.is-paid {
            background: #f0fdf4;
            border-color: #bbf7d0;

            .due-pod-icon { color: #16a34a; }
            .due-label { color: #166534; }
            .due-amount-display { color: #15803d; }
          }
        }
      }

      /* Smart AI Voice Card */
      .voice-audio-card.smart-voice-card {
        background: linear-gradient(135deg, #f0fdf4 0%, #eff6ff 60%, #faf5ff 100%);
        border: 1.5px solid #bfdbfe;
        border-radius: 12px;
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        box-shadow: 0 2px 6px rgba(37, 99, 235, 0.06);

        .voice-top-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;

          .voice-talent-wrap {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;

            .section-label {
              font-size: 0.8rem;
              font-weight: 700;
              color: #1e3a8a;
            }

            .talent-pill-group {
              display: flex;
              align-items: center;
              gap: 8px;

              .talent-btn {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background: #ffffff;
                border: 1.5px solid #cbd5e1;
                border-radius: 8px;
                padding: 5px 12px;
                cursor: pointer;
                transition: all 0.2s ease;
                text-align: left;

                .talent-avatar {
                  font-size: 1.1rem;
                  line-height: 1;
                }

                .talent-info {
                  display: flex;
                  flex-direction: column;

                  .t-name {
                    font-size: 0.82rem;
                    font-weight: 700;
                    color: #1e293b;
                  }

                  .t-desc {
                    font-size: 0.65rem;
                    color: #64748b;
                  }
                }

                &:hover {
                  background: #f8fafc;
                  border-color: #93c5fd;
                }

                &.active {
                  background: #eff6ff;
                  border-color: #2563eb;
                  box-shadow: 0 0 0 1px #2563eb;

                  .talent-info .t-name {
                    color: #1d4ed8;
                  }
                }
              }
            }
          }

          .voice-meta-tools {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;

            .speed-toggle-wrap {
              display: flex;
              align-items: center;
              gap: 4px;
              background: #ffffff;
              border: 1px solid #cbd5e1;
              padding: 2px 6px;
              border-radius: 6px;

              .tool-label {
                font-size: 0.7rem;
                font-weight: 700;
                color: #64748b;
                margin-right: 2px;
              }

              .speed-btn {
                background: transparent;
                border: none;
                padding: 2px 6px;
                font-size: 0.72rem;
                font-weight: 700;
                color: #475569;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.15s ease;

                &:hover { background: #f1f5f9; }

                &.active {
                  background: #2563eb;
                  color: #ffffff;
                }
              }
            }

            .lang-toggle-wrap {
              display: flex;
              align-items: center;
              gap: 4px;
              background: #ffffff;
              border: 1px solid #cbd5e1;
              padding: 2px 6px;
              border-radius: 6px;

              .tool-label {
                font-size: 0.7rem;
                font-weight: 700;
                color: #64748b;
                margin-right: 2px;
              }

              .lang-btn {
                background: transparent;
                border: none;
                padding: 2px 8px;
                font-size: 0.72rem;
                font-weight: 700;
                color: #475569;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.15s ease;
                letter-spacing: 0.03em;

                &:hover { background: #f1f5f9; }

                &.active {
                  background: #7c3aed;
                  color: #ffffff;
                }
              }
            }

            .audio-wave-badge {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              background: #ffffff;
              border: 1px solid #cbd5e1;
              padding: 4px 10px;
              border-radius: 6px;

              .equalizer-bars {
                display: inline-flex;
                align-items: flex-end;
                gap: 2px;
                height: 14px;

                .bar {
                  width: 3px;
                  background: #16a34a;
                  border-radius: 2px;
                  height: 4px;
                  transition: height 0.2s ease;
                }

                &.animating {
                  .bar-1 { animation: eqAnim 0.6s ease-in-out infinite alternate; }
                  .bar-2 { animation: eqAnim 0.8s ease-in-out infinite alternate 0.2s; }
                  .bar-3 { animation: eqAnim 0.5s ease-in-out infinite alternate 0.4s; }
                  .bar-4 { animation: eqAnim 0.7s ease-in-out infinite alternate 0.1s; }
                  .bar-5 { animation: eqAnim 0.9s ease-in-out infinite alternate 0.3s; }
                }
              }

              .wave-status-text {
                font-size: 0.72rem;
                font-weight: 600;
                color: #475569;
              }

              &.is-playing {
                border-color: #16a34a;
                background: #f0fdf4;

                .wave-status-text {
                  color: #15803d;
                  font-weight: 700;
                }
              }
            }
          }
        }

        .voice-smart-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;

          .main-voice-play-btn {
            height: 38px;
            padding: 0 16px;
            background: #16a34a;
            color: #ffffff;
            border: none;
            border-radius: 8px;
            font-size: 0.82rem;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            gap: 7px;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(22, 163, 74, 0.3);
            transition: all 0.2s ease;

            mat-icon { font-size: 20px; width: 20px; height: 20px; }

            &:hover {
              background: #15803d;
              transform: translateY(-1px);
              box-shadow: 0 4px 10px rgba(22, 163, 74, 0.35);
            }

            &.playing {
              background: #dc2626;
              box-shadow: 0 2px 6px rgba(220, 38, 38, 0.35);
              &:hover { background: #b91c1c; }
            }
          }

          .main-voice-download-btn {
            height: 38px;
            padding: 0 14px;
            background: #ffffff;
            color: #0369a1;
            border: 1.5px solid #7dd3fc;
            border-radius: 8px;
            font-size: 0.78rem;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            transition: all 0.2s ease;

            mat-icon { font-size: 18px; width: 18px; height: 18px; color: #0284c7; }

            &:hover:not(:disabled) {
              background: #f0f9ff;
              border-color: #38bdf8;
              transform: translateY(-1px);
            }

            &:disabled {
              opacity: 0.6;
              cursor: not-allowed;
            }
          }

          .pronounce-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: #f8fafc;
            border: 1px dashed #cbd5e1;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 0.72rem;
            color: #475569;
            margin-left: auto;

            mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2563eb; }
            strong { color: #1e3a8a; }
          }
        }

        .voice-hint-tip {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          color: #0369a1;
          background: rgba(224, 242, 254, 0.6);
          border: 1px solid #bae6fd;
          padding: 6px 10px;
          border-radius: 6px;
          line-height: 1.35;

          .hint-icon { font-size: 15px; width: 15px; height: 15px; color: #0284c7; flex-shrink: 0; }
        }
      }

      @keyframes eqAnim {
        0% { height: 3px; opacity: 0.5; }
        100% { height: 14px; opacity: 1; }
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

          .header-action-tools {
            display: flex;
            align-items: center;
            gap: 6px;

            .listen-speech-mini-btn {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              padding: 4px 8px;
              font-size: 0.72rem;
              font-weight: 600;
              color: #2563eb;
              background: #eff6ff;
              border: 1px solid #bfdbfe;
              border-radius: 6px;
              cursor: pointer;
              transition: all 0.15s ease;

              mat-icon { font-size: 14px; width: 14px; height: 14px; }

              &:hover {
                background: #dbeafe;
              }

              &.is-playing {
                background: #fee2e2;
                color: #dc2626;
                border-color: #fca5a5;
              }
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

    @media (max-width: 640px) {
      .dispatch-dialog-wrap {
        min-width: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        border-radius: 0 !important;
      }

      .modal-header {
        padding: 10px 14px;
        .header-left {
          gap: 8px;
          .header-icon-box {
            width: 32px;
            height: 32px;
            min-width: 32px;
            border-radius: 8px;
            mat-icon { font-size: 17px; width: 17px; height: 17px; }
          }
          .modal-title {
            font-size: 0.95rem;
            line-height: 1.2;
          }
          .modal-subtitle {
            font-size: 0.68rem;
            line-height: 1.2;
          }
        }
      }

      .modal-body {
        padding: 10px 12px;
        gap: 10px;
      }

      .format-type-selector {
        display: flex;
        flex-direction: column;
        gap: 6px;

        .type-btn {
          padding: 8px 12px;
        }
      }

      .student-meta-banner,
      .single-student-card {
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 12px !important;
        padding: 10px 12px !important;

        .stu-badge {
          width: 100% !important;
          flex: none !important;
          min-width: 0 !important;
          align-items: flex-start !important;

          .avatar {
            width: 40px !important;
            height: 40px !important;
            font-size: 1.05rem !important;
            border-radius: 8px !important;
          }

          .stu-details {
            width: 100% !important;
            min-width: 0 !important;

            .stu-name-row {
              gap: 6px !important;
              .name {
                font-size: 0.98rem !important;
              }
            }

            .stu-tags-row {
              display: flex !important;
              flex-wrap: wrap !important;
              gap: 5px !important;
              margin-top: 2px !important;

              .meta-tag {
                font-size: 0.72rem !important;
                padding: 2px 7px !important;
                white-space: normal !important;
                word-break: break-word !important;
                line-height: 1.3 !important;

                mat-icon {
                  font-size: 14px !important;
                  width: 14px !important;
                  height: 14px !important;
                }
              }
            }
          }
        }

        .due-card-pod {
          width: 100% !important;
          flex-direction: row !important;
          justify-content: space-between !important;
          align-items: center !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
          padding: 8px 12px !important;
          margin-top: 2px !important;

          .due-pod-top {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 6px !important;

            .due-pod-icon {
              font-size: 18px !important;
              width: 18px !important;
              height: 18px !important;
            }

            .due-label {
              font-size: 0.72rem !important;
            }
          }

          .due-amount-display {
            margin-top: 0 !important;
            font-size: 1.25rem !important;
            font-weight: 800 !important;
          }
        }
      }

      .smart-voice-card {
        padding: 10px 12px;
        gap: 10px;

        .voice-top-header {
          flex-direction: column;
          align-items: stretch;
          gap: 10px;
        }

        .talent-pill-group {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;

          .talent-btn {
            padding: 6px 8px;
            .talent-info {
              .t-name { font-size: 0.8rem; }
              .t-desc { font-size: 0.62rem; }
            }
          }
        }

        .voice-meta-tools {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: flex-start;
        }

        .voice-smart-actions {
          flex-direction: column;
          gap: 8px;

          .main-voice-play-btn, .main-voice-download-btn {
            width: 100% !important;
            justify-content: center !important;
          }
        }
      }

      .modal-footer {
        flex-direction: column-reverse;
        gap: 8px;
        padding: 10px 14px;

        button {
          width: 100% !important;
          justify-content: center !important;
        }
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeeReminderDispatchDialogComponent implements OnInit, OnDestroy {
  isBulkMode = false;
  messageType: 'invoice' | 'normal' | 'voice' = 'invoice';
  targetSingle: FeeReminderDispatchItem | null = null;
  studentList: FeeReminderDispatchItem[] = [];
  activeMessageText = '';

  selectedVoiceGender: 'Female' | 'Male' = 'Male';
  speechRate = 1.0;
  speechLang: 'hi-IN' | 'en-IN' = 'hi-IN';
  isPlayingAudio = false;
  isLoadingVoice = false;
  isDownloadingAudio = false;
  availableVoices: SpeechSynthesisVoice[] = [];
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private activeAudio: HTMLAudioElement | null = null;
  private authService = inject(AuthService);

  get activeInstituteName(): string {
    const fromData = this.data?.instituteName?.trim();
    if (fromData) return fromData;
    const fromAuth = this.authService.getInstituteName()?.trim();
    if (fromAuth) return fromAuth;
    return this.speechLang === 'hi-IN' ? 'संस्थान प्रशासन' : 'Institute Office';
  }

  constructor(
    public dialogRef: MatDialogRef<FeeReminderDispatchDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FeeReminderDispatchDialogData,
    private coachingService: CoachingService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef,
    @Optional() private feeRecoveryService?: FeeRecoveryAgentService
  ) {
    this.isBulkMode = data.mode === 'bulk';
    if (this.isBulkMode && data.invoices) {
      this.studentList = data.invoices.map(x => ({
        ...x,
        selected: true,
        dispatched: x.alreadyRemindedToday || false
      }));
    } else if (data.invoice) {
      this.targetSingle = { ...data.invoice };
    }
  }

  ngOnInit(): void {
    this.updateActiveMessage();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  ngOnDestroy(): void {
    this.stopAudio();
  }

  loadVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.availableVoices = window.speechSynthesis.getVoices();
  }

  selectMessageType(type: 'invoice' | 'normal' | 'voice'): void {
    if (this.messageType === type) return;
    this.stopAudio();
    this.messageType = type;
    this.updateActiveMessage();
    this.cdr.markForCheck();
  }

  setVoiceGender(gender: 'Female' | 'Male'): void {
    if (this.selectedVoiceGender === gender) return;
    this.selectedVoiceGender = gender;
    if (this.isPlayingAudio) {
      this.stopAudio();
      this.playCurrentMessageSpeech();
    }
    this.cdr.markForCheck();
  }

  setSpeechRate(rate: number): void {
    this.speechRate = rate;
    if (this.activeAudio) {
      this.activeAudio.playbackRate = rate;
    } else if (this.isPlayingAudio) {
      this.stopAudio();
      this.playCurrentMessageSpeech();
    }
    this.cdr.markForCheck();
  }

  setSpeechLang(lang: 'hi-IN' | 'en-IN'): void {
    if (this.speechLang === lang) return;
    this.speechLang = lang;
    if (this.isPlayingAudio) {
      this.stopAudio();
      this.playCurrentMessageSpeech();
    }
    this.cdr.markForCheck();
  }

  updateActiveMessage(): void {
    if (this.targetSingle) {
      if (this.messageType === 'invoice') {
        this.activeMessageText = this.buildInvoiceMessage(this.targetSingle);
      } else if (this.messageType === 'normal') {
        this.activeMessageText = this.buildNormalMessage(this.targetSingle);
      } else {
        this.activeMessageText = this.buildVoiceMessage(this.targetSingle);
      }
    }
  }

  get isPaidSingle(): boolean {
    return !this.isBulkMode && !!this.targetSingle && (this.targetSingle.dueAmount === 0 || this.targetSingle.status === 'Paid');
  }

  buildInvoiceMessage(inv: FeeReminderDispatchItem): string {
    const inst = this.activeInstituteName;
    const sName = inv.studentName || 'Student';
    const roll = inv.rollNumber || 'N/A';
    const cls = inv.className || 'General';
    const scope = this.getScopeBadgeLabel(inv);
    const invNo = inv.invoiceNumber || 'INV';
    const amt = inv.dueAmount != null ? inv.dueAmount : 0;
    const paid = inv.paidAmount || 0;
    const total = inv.totalAmount || (paid + amt);

    if (amt === 0 || inv.status === 'Paid') {
      return `*FEE PAYMENT RECEIPT & ACKNOWLEDGEMENT*\n🏛️ *${inst}*\n━━━━━━━━━━━━━━━━━━━━━━\nDear Parent,\nThis is an official fee payment acknowledgement for your ward *${sName}* (Class: *${cls}* | Roll: *${roll}* | Division: *${scope}*).\n\n📋 *Payment Receipt Summary:*\n• Invoice No: #${invNo}\n• Total Amount Paid: *₹${paid || total}*\n• Status: *Fully Paid / Cleared (₹0 Due)*\n\nThank you for your timely payment and continued cooperation!${this.buildSlipSection(inv)}\n\n*Accounts Department*\n*${inst}*`;
    }

    const rawDueDate = inv.dueDate ? new Date(inv.dueDate) : null;
    const isOverdue = rawDueDate ? rawDueDate < new Date() : false;
    const dDate = rawDueDate
      ? rawDueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'Due Soon';
    const dueDateLine = isOverdue
      ? `• Due Date: ~~${dDate}~~ ⚠️ *OVERDUE — Payment Pending Since ${dDate}*`
      : `• Due Date: ${dDate}`;

    const amountBreakdown = paid > 0
      ? `• Total Fee Amount: ₹${total}\n• Amount Paid (Partial): ₹${paid}\n• Remaining Balance Due: *₹${amt}*`
      : `• Pending Dues: *₹${amt}*`;

    const urgencyLine = isOverdue
      ? `\n\n🚨 *URGENT:* The fee due date has already passed. Immediate clearance is required to avoid any disruption to your ward's academic continuity.`
      : '';

    return `*FEE DUE INVOICE REMINDER*\n🏛️ *${inst}*\n━━━━━━━━━━━━━━━━━━━━━━\nDear Parent,\nThis is an official fee payment intimation for your ward *${sName}* (Class: *${cls}* | Roll: *${roll}* | Division: *${scope}*).\n\n📋 *Invoice Summary:*\n• Invoice No: #${invNo}\n${amountBreakdown}\n${dueDateLine}${urgencyLine}\n\n💳 *Payment Clearance:*\nKindly clear the pending fee dues at your earliest convenience via Online UPI or at the Campus Accounts Desk.${this.buildSlipSection(inv)}\n\nThank you for your cooperation!`;
  }

  buildVoiceMessage(inv: FeeReminderDispatchItem): string {
    const inst = this.activeInstituteName;
    const sName = inv.studentName || 'Student';
    const roll = inv.rollNumber || 'N/A';
    const cls = inv.className || 'General';
    const scope = this.getScopeBadgeLabel(inv);
    const amt = inv.dueAmount != null ? inv.dueAmount : 0;
    const paid = inv.paidAmount || 0;
    const total = inv.totalAmount || (paid + amt);
    const invNo = inv.invoiceNumber || 'INV';

    if (amt === 0 || inv.status === 'Paid') {
      return `🎙️ *FEE PAYMENT VOICE ACKNOWLEDGEMENT*\n🏛️ *${inst}*\n━━━━━━━━━━━━━━━━━━━━━━\nनमस्ते अभिभावक जी!\n${inst} से सादर प्रणाम।\n\nसंस्थान रिकॉर्ड अनुसार आपके बच्चे *${sName}* (कक्षा: *${cls}* | Roll: *${roll}* | विभाग: *${scope}*) की फीस *₹${paid || total}* (इनवॉइस: #${invNo}) प्राप्त हो चुकी है। वर्तमान में कोई बकाया शेष नहीं है। समय पर भुगतान हेतु हार्दिक धन्यवाद!${this.buildSlipSection(inv)}\n\nसधन्यवाद,\n*Accounts Office, ${inst}*`;
    }

    const rawDueDate2 = inv.dueDate ? new Date(inv.dueDate) : null;
    const isOverdue2 = rawDueDate2 ? rawDueDate2 < new Date() : false;
    const dDate = rawDueDate2
      ? rawDueDate2.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'शीघ्र';

    const feeLine = paid > 0
      ? `कुल फीस *₹${total}* में से जमा राशि *₹${paid}* के उपरांत शेष बकाया राशि *₹${amt}* है।`
      : `बकाया फीस राशि *₹${amt}* देय है।`;

    const dueDateHindi = isOverdue2
      ? `⚠️ *देय तिथि ${dDate} बीत चुकी है — फीस अभी भी बकाया है (OVERDUE)।*`
      : `📅 नियत देय तिथि (Due Date): *${dDate}*`;

    const urgencyHindi = isOverdue2
      ? `\n\n🚨 *अत्यावश्यक सूचना:* फीस जमा करने की अंतिम तिथि निकल चुकी है। कृपया अविलंब (तुरंत) फीस जमा कराएं अन्यथा बच्चे की पढ़ाई एवं परीक्षा में बाधा उत्पन्न हो सकती है।`
      : '';

    return `🎙️ *OFFICIAL FEE DUE VOICE REMINDER*\n🏛️ *${inst}*\n━━━━━━━━━━━━━━━━━━━━━━\nनमस्ते अभिभावक जी!\n${inst} से सादर अनुरोध है।\n\nसंस्थान रिकॉर्ड अनुसार आपके बच्चे *${sName}* (कक्षा: *${cls}* | Roll: *${roll}* | विभाग: *${scope}*) की ${feeLine}\n\n${dueDateHindi}${urgencyHindi}\n\nबच्चे की नियमित पढ़ाई एवं परीक्षा की निरंतरता हेतु कृपया शेष फीस समय पर ऑनलाइन UPI या संस्थान काउंटर पर जमा कराएं।${this.buildSlipSection(inv)}\n\nसधन्यवाद,\n*Accounts Office, ${inst}*`;
  }

  /** Public fee-slip / payment page link for WhatsApp */
  private buildSlipLink(inv: FeeReminderDispatchItem): string {
    if (!inv?.id) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/pay/${inv.id}`;
  }

  /** Standard WhatsApp slip-link block appended to all message types */
  private buildSlipSection(inv: FeeReminderDispatchItem): string {
    const link = this.buildSlipLink(inv);
    if (!link) return '';
    const isPaid = (inv.dueAmount === 0 || inv.status === 'Paid');
    if (isPaid) {
      return `\n\n━━━━━━━━━━━━━━━━━━━━━━\n📥 *Fee Receipt / रसीद डाउनलोड करें:*\n🔗 ${link}\n_(उपरोक्त लिंक पर क्लिक करके अपनी आधिकारिक फीस रसीद PDF डाउनलोड करें।)_`;
    }
    return `\n\n━━━━━━━━━━━━━━━━━━━━━━\n📥 *Fee Due Slip / पर्ची डाउनलोड एवं भुगतान:*\n🔗 ${link}\n_(उपरोक्त लिंक पर क्लिक करके फीस मांग पत्र / पर्ची PDF डाउनलोड करें अथवा ऑनलाइन UPI से भुगतान करें।)_`;
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
    const inst = this.activeInstituteName;
    const sName = inv.studentName || 'Student';
    const roll = inv.rollNumber || 'N/A';
    const cls = inv.className || 'General';
    const scope = this.getScopeBadgeLabel(inv);
    const amt = inv.dueAmount != null ? inv.dueAmount : 0;
    const paid = inv.paidAmount || 0;
    const total = inv.totalAmount || (paid + amt);
    const invNo = inv.invoiceNumber || 'INV';

    if (amt === 0 || inv.status === 'Paid') {
      return `*FEE PAYMENT ACKNOWLEDGEMENT*\n🏛️ *${inst}*\n━━━━━━━━━━━━━━━━━━━━━━\nआदरणीय अभिभावक जी,\n सादर प्रणाम।\n\nसंस्थान के रिकॉर्ड अनुसार आपके बच्चे *${sName}* (कक्षा/बैच: *${cls}* | Roll: *${roll}* | विभाग: *${scope}*) की फीस *₹${paid || total}* (इनवॉइस: #${invNo}) सफलतापूर्वक प्राप्त हो चुकी है। वर्तमान में कोई बकाया शेष नहीं है।\n\nसमय पर भुगतान हेतु आपका हार्दिक धन्यवाद।${this.buildSlipSection(inv)}\n\nसधन्यवाद,\n*${inst} (Accounts Office)*`;
    }

    const rawDueDate3 = inv.dueDate ? new Date(inv.dueDate) : null;
    const isOverdue3 = rawDueDate3 ? rawDueDate3 < new Date() : false;
    const dDate = rawDueDate3
      ? rawDueDate3.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '';
    const dateNotice = dDate
      ? isOverdue3
        ? `\n⚠️ *देय तिथि ${dDate} बीत चुकी है — फीस अभी भी बकाया है (OVERDUE)।*\n`
        : `\n📅 नियत देय तिथि (Due Date): *${dDate}*\n`
      : '';

    const urgencyNotice = isOverdue3
      ? `\n🚨 *अत्यावश्यक:* फीस जमा करने की अंतिम तिथि निकल चुकी है। कृपया अविलंब फीस जमा कराएं।\n`
      : '';

    const feeSentence = paid > 0
      ? `संस्थान के रिकॉर्ड अनुसार आपके बच्चे *${sName}* (कक्षा/बैच: *${cls}* | Roll: *${roll}* | विभाग: *${scope}*) की कुल फीस *₹${total}* में से *₹${paid}* (आंशिक भुगतान) जमा हो चुकी है तथा शेष बकाया राशि *₹${amt}* देय है।`
      : `संस्थान के रिकॉर्ड अनुसार आपके बच्चे *${sName}* (कक्षा/बैच: *${cls}* | Roll: *${roll}* | विभाग: *${scope}*) की फीस *₹${amt}* देय है।`;

    return `*FEE REMINDER NOTICE*\n🏛️ *${inst}*\n━━━━━━━━━━━━━━━━━━━━━━\nआदरणीय अभिभावक जी,\nसादर प्रणाम।\n\n${feeSentence}${dateNotice}${urgencyNotice}\nबच्चे की नियमित पढ़ाई, उपस्थिति और आगामी परीक्षाओं की सुचारू निरंतरता हेतु कृपया शेष फीस समय पर संस्थान कार्यालय में जमा कराएं अथवा ऑनलाइन माध्यम से भुगतान करें।${this.buildSlipSection(inv)}\n\nसधन्यवाद,\n*${inst} (Accounts Office)*`;
  }

  togglePlaySpeech(): void {
    if (this.isPlayingAudio) {
      this.stopAudio();
    } else {
      this.playCurrentMessageSpeech();
    }
  }

  stopAudio(): void {
    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
      } catch (e) {
        console.warn('Audio pause error', e);
      }
      this.activeAudio = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        console.warn('Speech cancel error', e);
      }
    }
    this.isPlayingAudio = false;
    this.isLoadingVoice = false;
    this.activeUtterance = null;
    this.cdr.markForCheck();
  }

  /** Builds a crystal-clear, smart natural spoken announcement for voice playback (pure speech, no emojis/markdown/URLs) */
  buildNaturalSpokenScript(): string {
    const s = this.targetSingle;
    const isHindi = this.speechLang === 'hi-IN';
    const inst = this.activeInstituteName;

    if (!s) {
      return this.cleanTextForNaturalSpeech(this.activeMessageText);
    }

    const sName = s.studentName || (isHindi ? 'विद्यार्थी' : 'Student');
    const amt = s.dueAmount != null ? s.dueAmount : 0;

    if (amt === 0 || s.status === 'Paid') {
      if (isHindi) {
        return `नमस्ते अभिभावक जी! ${inst} से सादर प्रणाम। आपके बच्चे ${sName} की फीस प्राप्त हो चुकी है। संस्थान में वर्तमान में कोई बकाया शेष नहीं है। समय पर भुगतान के लिए आपका बहुत-बहुत धन्यवाद!`;
      } else {
        return `Hello respected parent! Greetings from ${inst}. We have received the fee payment for your ward ${sName}. There are currently no pending dues. Thank you for your timely payment!`;
      }
    }

    const rawDueDate = s.dueDate ? new Date(s.dueDate) : null;
    const isOverdue = rawDueDate ? rawDueDate < new Date() : false;

    if (isHindi) {
      let datePhrase = '';
      if (rawDueDate) {
        const day = rawDueDate.getDate();
        const months = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
        const month = months[rawDueDate.getMonth()];
        const yr = rawDueDate.getFullYear();
        datePhrase = `${day} ${month} ${yr}`;
      }

      const overduePhrase = isOverdue && datePhrase
        ? `जिसकी अंतिम देय तिथि ${datePhrase} बीत चुकी है, और फीस अभी तक बकाया है।`
        : (datePhrase ? `जिसकी अंतिम तिथि ${datePhrase} है।` : '');

      const urgencyPhrase = isOverdue
        ? `यह एक अत्यावश्यक सूचना है। कृपया अविलंब बकाया फीस का भुगतान करें, ताकि बच्चे की नियमित पढ़ाई और परीक्षा में कोई रुकावट न आए।`
        : `कृपया नियत समय पर फीस जमा कराने का कष्ट करें।`;

      return `नमस्ते अभिभावक जी! ${inst} से सादर अनुरोध है। संस्थान रिकॉर्ड के अनुसार, आपके बच्चे ${sName} की कुल बकाया फीस राशि ${amt} रुपए देय है। ${overduePhrase} ${urgencyPhrase} आप संस्थान काउंटर पर आकर या ऑनलाइन यू पी आई के माध्यम से तुरंत भुगतान कर सकते हैं। धन्यवाद!`;
    } else {
      const dDate = rawDueDate
        ? rawDueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';

      const overduePhrase = isOverdue && dDate
        ? `The due date was ${dDate}, and the payment is now overdue.`
        : (dDate ? `The due date is ${dDate}.` : '');

      const urgencyPhrase = isOverdue
        ? `This is an urgent reminder. Please clear the pending fee immediately to ensure your child's classes and examinations continue smoothly.`
        : `Kindly ensure timely fee clearance.`;

      return `Hello respected parent! This is an important notification from ${inst}. As per our records, your ward ${sName} has an outstanding fee amount of ${amt} rupees. ${overduePhrase} ${urgencyPhrase} You can make the payment conveniently via online UPI or at the campus accounts desk. Thank you!`;
    }
  }

  /** Cleans up raw WhatsApp markdown, emojis, URLs, and technical codes for smooth TTS reading */
  cleanTextForNaturalSpeech(text: string): string {
    if (!text) return '';
    const isHindi = this.speechLang === 'hi-IN';
    return text
      // 1. Remove URLs
      .replace(/https?:\/\/\S+/gi, '')
      // 2. Remove emojis (pictographs, symbols, flags)
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      // 3. Remove header titles like *OFFICIAL FEE DUE VOICE REMINDER*, *FEE DUE INVOICE REMINDER*
      .replace(/\*+(?:OFFICIAL|FEE DUE|INVOICE|PAYMENT|REMINDER|NOTICE)[^*]*\*+/gi, '')
      // 4. Remove divider lines and markdown symbols
      .replace(/[━─_=~*#•|`]/g, ' ')
      // 5. Remove technical IDs and roll codes that sound noisy
      .replace(/#?INV-[\w-]+/gi, '')
      .replace(/Roll:\s*[\w-]+/gi, '')
      // 6. Remove parenthetical link hints: (लिंक पर क्लिक करके...)
      .replace(/\(लिंक[^)]*\)/gi, '')
      // 7. Natural phonetic replacements
      .replace(/₹\s*(\d+)/g, isHindi ? '$1 रुपए' : '$1 rupees')
      .replace(/\bUPI\b/gi, isHindi ? 'यू पी आई' : 'U P I')
      .replace(/\bOVERDUE\b/gi, isHindi ? 'समय सीमा समाप्त' : 'overdue')
      .replace(/\s+/g, ' ')
      .trim();
  }

  playCurrentMessageSpeech(): void {
    this.stopAudio();

    // Priority 1: High-fidelity AI Neural Voice from backend (Madhur Neural = genuine Gents/Male, Swara Neural = Ladies)
    if (this.targetSingle && this.feeRecoveryService) {
      const s = this.targetSingle;
      const rawDueDate = s.dueDate ? new Date(s.dueDate) : null;
      const dueDay = rawDueDate ? rawDueDate.getDate() : 10;
      const monthName = rawDueDate
        ? rawDueDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
        : new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });

      const req = {
        parentName: 'अभिभावक',
        studentName: s.studentName,
        className: s.className || 'General',
        dueAmount: s.dueAmount != null ? s.dueAmount : 0,
        dueDay: dueDay,
        monthName: monthName,
        instituteName: this.activeInstituteName,
        voiceGender: this.selectedVoiceGender // 'Male' -> hi-IN-MadhurNeural (100% Gents), 'Female' -> hi-IN-SwaraNeural
      };

      this.isLoadingVoice = true;
      this.isPlayingAudio = true;
      this.cdr.markForCheck();

      this.feeRecoveryService.previewVoice(req).subscribe({
        next: (res) => {
          this.isLoadingVoice = false;
          if (res?.audioBase64) {
            try {
              const audio = new Audio('data:audio/mp3;base64,' + res.audioBase64);
              audio.playbackRate = this.speechRate ?? 1.0;
              this.activeAudio = audio;

              audio.onplay = () => {
                this.isPlayingAudio = true;
                this.isLoadingVoice = false;
                this.cdr.markForCheck();
              };
              audio.onended = () => {
                this.isPlayingAudio = false;
                this.activeAudio = null;
                this.cdr.markForCheck();
              };
              audio.onerror = (e) => {
                console.warn('Audio element error, falling back to local TTS', e);
                this.activeAudio = null;
                this.playLocalWebSpeech();
              };

              audio.play().catch(err => {
                console.warn('Audio play promise rejected, falling back to local TTS', err);
                this.activeAudio = null;
                this.playLocalWebSpeech();
              });
            } catch (err) {
              console.warn('Failed to construct Audio, falling back to local TTS', err);
              this.playLocalWebSpeech();
            }
          } else {
            this.playLocalWebSpeech();
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn('previewVoice API error, falling back to local TTS', err);
          this.isLoadingVoice = false;
          this.playLocalWebSpeech();
        }
      });
      return;
    }

    // Fallback: If no single target or service unavailable, use local browser speech
    this.playLocalWebSpeech();
  }

  playLocalWebSpeech(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.confirmDialog.alert('Speech Unsupported', 'Speech synthesis is not supported on this browser device.', 'warning');
      this.isPlayingAudio = false;
      this.cdr.markForCheck();
      return;
    }

    // Use clean natural spoken script for voice mode or clean the active message
    let spokenText = '';
    if (this.messageType === 'voice' && this.targetSingle) {
      spokenText = this.buildNaturalSpokenScript();
    } else {
      const rawText = this.activeMessageText || (this.targetSingle ? this.buildVoiceMessage(this.targetSingle) : '');
      spokenText = this.cleanTextForNaturalSpeech(rawText);
    }

    if (!spokenText.trim()) {
      this.isPlayingAudio = false;
      this.cdr.markForCheck();
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.lang = this.speechLang;
      utterance.rate = this.speechRate ?? 1.0;

      // Refresh voices list in case Chrome loaded them after init
      const freshVoices = window.speechSynthesis.getVoices();
      if (freshVoices.length > 0) {
        this.availableVoices = freshVoices;
      }

      const voices = this.availableVoices.length > 0 ? this.availableVoices : freshVoices;
      if (voices.length > 0) {
        const isHindi = this.speechLang === 'hi-IN';

        if (isHindi) {
          const hiVoices = voices.filter(v => v.lang.toLowerCase().startsWith('hi'));
          const pool = hiVoices.length > 0 ? hiVoices : voices;

          if (this.selectedVoiceGender === 'Female') {
            // Swara: Natural online voice > Google हिन्दी > Kalpana > Heera > female > any Hindi
            const fVoice = pool.find(v => /swara/i.test(v.name))
              ?? pool.find(v => /google\s*हिन्दी/i.test(v.name))
              ?? pool.find(v => /kalpana|heera/i.test(v.name))
              ?? pool.find(v => /female/i.test(v.name))
              ?? pool[0];
            if (fVoice) utterance.voice = fVoice;
            utterance.pitch = 1.02; // Clean, natural, friendly female tone
          } else {
            // Madhur: Dedicated male voice if installed, else deep masculine pitch 0.72
            const mVoice = pool.find(v => /madhur/i.test(v.name))
              ?? pool.find(v => /hemant/i.test(v.name))
              ?? pool.find(v => /\bmale\b/i.test(v.name) && !/female/i.test(v.name))
              ?? pool.find(v => /google\s*हिन्दी/i.test(v.name))
              ?? pool[pool.length > 1 ? 1 : 0]
              ?? pool[0];
            if (mVoice) utterance.voice = mVoice;
            const isDedicatedMale = mVoice && /madhur|hemant|\bmale\b/i.test(mVoice.name);
            utterance.pitch = isDedicatedMale ? 1.0 : 0.72; // 0.72 lowers female voice into authentic male register
          }
        } else {
          // English mode
          const enVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
          const pool = enVoices.length > 0 ? enVoices : voices;

          if (this.selectedVoiceGender === 'Female') {
            const fVoice = pool.find(v => /neerja|zira|samantha/i.test(v.name))
              ?? pool.find(v => /google uk english female|google us english/i.test(v.name))
              ?? pool.find(v => /female/i.test(v.name))
              ?? pool[0];
            if (fVoice) utterance.voice = fVoice;
            utterance.pitch = 1.02;
          } else {
            const mVoice = pool.find(v => /prabhat|david|mark|george/i.test(v.name))
              ?? pool.find(v => /google uk english male/i.test(v.name))
              ?? pool.find(v => /\bmale\b/i.test(v.name))
              ?? pool[0];
            if (mVoice) utterance.voice = mVoice;
            utterance.pitch = 0.94;
          }
        }
      }

      utterance.onstart = () => {
        this.isPlayingAudio = true;
        this.isLoadingVoice = false;
        this.cdr.markForCheck();
      };

      utterance.onend = () => {
        this.isPlayingAudio = false;
        this.activeUtterance = null;
        this.cdr.markForCheck();
      };

      utterance.onerror = (e) => {
        console.warn('Speech error', e);
        this.isPlayingAudio = false;
        this.activeUtterance = null;
        this.cdr.markForCheck();
      };

      this.activeUtterance = utterance;
      // Stagger slightly to allow audio device initialization
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 50);
    } catch (err) {
      console.warn('Speech error', err);
      this.isPlayingAudio = false;
      this.activeUtterance = null;
      this.cdr.markForCheck();
    }
  }

  downloadVoiceAudio(): void {
    if (this.isDownloadingAudio || !this.targetSingle) return;
    this.isDownloadingAudio = true;
    this.cdr.markForCheck();

    const req = {
      parentName: 'अभिभावक',
      studentName: this.targetSingle.studentName,
      className: this.targetSingle.className || 'General',
      dueAmount: this.targetSingle.dueAmount,
      dueDay: 10,
      monthName: new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
      instituteName: this.activeInstituteName,
      voiceGender: this.selectedVoiceGender
    };

    if (this.feeRecoveryService) {
      this.feeRecoveryService.previewVoice(req).subscribe({
        next: (res) => {
          this.isDownloadingAudio = false;
          if (res?.audioBase64) {
            this.triggerAudioDownload(res.audioBase64, `Voice_Reminder_${this.targetSingle?.studentName.replace(/\s+/g, '_')}.mp3`);
            this.confirmDialog.alert('Audio Downloaded', 'MP3 voice note downloaded successfully. You can attach it directly into WhatsApp chat.', 'success');
          } else {
            this.confirmDialog.alert('Voice Note Ready', 'Speech audio is ready. You can listen directly using the Play Voice button.', 'info');
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.isDownloadingAudio = false;
          this.confirmDialog.alert('Voice Note Ready', 'Speech audio is ready. You can listen directly using the Play Voice button.', 'info');
          this.cdr.markForCheck();
        }
      });
    } else {
      this.isDownloadingAudio = false;
      this.confirmDialog.alert('Voice Note Ready', 'Speech audio is ready. You can listen directly using the Play Voice button.', 'info');
      this.cdr.markForCheck();
    }
  }

  private triggerAudioDownload(base64: string, filename: string): void {
    try {
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Error downloading audio:', e);
    }
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
    this.stopAudio();
    if (!inv.parentWhatsAppPhone) {
      this.confirmDialog.alert('No Phone', 'Parent WhatsApp phone number is not available for this student.', 'warning');
      return;
    }

    const rawPhone = inv.parentWhatsAppPhone.replace(/\D/g, '');
    const formattedPhone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;
    const msg = this.activeMessageText || (
      this.messageType === 'invoice' ? this.buildInvoiceMessage(inv) :
      (this.messageType === 'normal' ? this.buildNormalMessage(inv) : this.buildVoiceMessage(inv))
    );
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

    // Auto-close dialog smoothly after launching WhatsApp
    setTimeout(() => {
      this.dialogRef.close({ dispatched: true });
    }, 450);
  }

  sendSingleFromBulk(s: FeeReminderDispatchItem): void {
    if (!s.parentWhatsAppPhone) return;

    const msg = this.messageType === 'invoice' ? this.buildInvoiceMessage(s) :
      (this.messageType === 'normal' ? this.buildNormalMessage(s) : this.buildVoiceMessage(s));
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
    const nextPending = this.studentList.find(s => s.selected && s.parentWhatsAppPhone && !s.dispatched);
    if (nextPending) {
      this.sendSingleFromBulk(nextPending);
    } else {
      const anySelected = this.studentList.find(s => s.selected && s.parentWhatsAppPhone);
      if (anySelected) {
        this.sendSingleFromBulk(anySelected);
      } else {
        this.confirmDialog.alert('All Sent', 'All selected students have either been dispatched or already reminded.', 'info');
      }
    }
  }
}

