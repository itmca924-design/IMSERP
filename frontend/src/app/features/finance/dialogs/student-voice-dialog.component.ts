import { Component, Inject, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FeeRecoveryPlanItemDto, FeeRecoveryAgentService } from '../../../core/services/fee-recovery-agent.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

export interface StudentVoiceDialogData {
  plan: FeeRecoveryPlanItemDto;
  instituteName: string;
  dueDay: number;
  initialGender?: string;
}

@Component({
  selector: 'app-student-voice-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule
  ],
  template: `
    <div class="dialog-container">
      <!-- Strict light-blue gradient header matching AGENTS.md rule -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>record_voice_over</mat-icon>
          </div>
          <div>
            <h2 class="main-title">AI Hindi Voice Note &amp; Audio Dispatch</h2>
            <p class="subtitle">
              Student: <strong>{{ data.plan.studentName }}</strong> ({{ data.plan.className || 'General' }}) • Due: <strong>₹{{ data.plan.totalOverdueAmount | number:'1.0-0' }}</strong>
            </p>
          </div>
        </div>
        <button (click)="closeDialog()" class="close-btn" matTooltip="Close" mat-icon-button>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-body">
        <!-- Voice Gender & Audio Controls Header -->
        <div class="voice-config-bar">
          <div class="gender-pill-group">
            <span class="config-label">AI Voice:</span>
            <button
              type="button"
              class="gender-btn"
              [class.active]="selectedGender === 'Female'"
              (click)="changeGender('Female')">
              👩 Swara (Female)
            </button>
            <button
              type="button"
              class="gender-btn"
              [class.active]="selectedGender === 'Male'"
              (click)="changeGender('Male')">
              👨 Madhur (Male)
            </button>
          </div>

          <div class="audio-state-tag">
            <mat-icon class="pulse-icon" [class.playing]="isPlaying">graphic_eq</mat-icon>
            <span>{{ isPlaying ? 'Playing Audio...' : 'Audio Ready (MP3)' }}</span>
          </div>
        </div>

        <!-- Audio Player Card -->
        <div class="audio-player-card">
          <button
            type="button"
            class="play-circle-btn"
            [class.playing]="isPlaying"
            (click)="togglePlayVoice()"
            [disabled]="isLoadingAudio"
            matTooltip="Play / Pause Audio Note">
            <mat-icon>{{ isPlaying ? 'pause' : 'play_arrow' }}</mat-icon>
          </button>

          <div class="player-info">
            <div class="player-title">
              <strong>Personalized Voice Note</strong> (Hindi Neural TTS)
            </div>
            <div class="player-sub">
              Target Parent: <strong>{{ data.plan.parentName || 'अभिभावक' }}</strong> (Phone: {{ data.plan.parentPhone || 'N/A' }})
            </div>
            @if (isLoadingAudio) {
              <mat-progress-bar mode="indeterminate" class="audio-loader"></mat-progress-bar>
            }
          </div>
        </div>

        <!-- Spoken Script Preview Box -->
        <div class="script-preview-card">
          <div class="script-title-row">
            <mat-icon class="script-icon">chat</mat-icon>
            <span>AI Voice Script (उच्चारण एवं संदेश प्रारूप):</span>
          </div>
          <p class="script-content">
            "नमस्ते <strong>{{ data.plan.parentName || 'अभिभावक' }}</strong> जी! <strong>{{ data.instituteName }}</strong> से सादर अनुरोध है। आपके सुपुत्र/सुपुत्री <strong>{{ data.plan.studentName }}</strong> ({{ data.plan.className || 'General' }}) की फीस <strong>₹{{ data.plan.totalOverdueAmount | number:'1.0-0' }}</strong> देय है। फीस जमा करने की नियत तारीख <strong>{{ data.dueDay }} तारीख</strong> है। कृपया समय पर फीस जमा कराकर सहयोग प्रदान करें। धन्यवाद!"
          </p>
        </div>

        <!-- How It Works Guidance -->
        <div class="guidance-box">
          <mat-icon class="info-icon">info</mat-icon>
          <div>
            <strong>स्वच्छ एवं पेशेवर WhatsApp डिलीवरी:</strong>
            <p style="margin: 2px 0 0;">
              1. <strong>'Download MP3'</strong> बटन दबाएँ (ऑडियो फाइल तुरंत डाउनलोड होगी)।<br/>
              2. <strong>'Open in WhatsApp'</strong> दबाएँ और डाउनलोड हुआ ऑडियो चैट में अटैच (📎) कर दें—पैरेंट को असली ग्रीन प्ले बटन वाला वॉयस नोट मिलेगा!
            </p>
          </div>
        </div>

        <!-- Optional Audio Web Link Toggle -->
        <div class="link-toggle-row">
          <label class="checkbox-label">
            <input type="checkbox" [checked]="includeListenLink" (change)="includeListenLink = $any($event.target).checked" />
            <span>संदेश के अंदर ऑनलाइन सुनने का वेब लिंक भी जोड़ें (Include Web Audio Link)</span>
          </label>
        </div>
      </div>

      <!-- Dialog Footer Action Buttons -->
      <div class="dialog-actions">
        <button type="button" class="action-btn cancel-btn" (click)="closeDialog()" matButton="outlined">
          Close
        </button>

        <button
          type="button"
          class="action-btn download-btn"
          (click)="downloadMp3Audio()"
          [disabled]="isDownloadingAudio"
          matTooltip="Download MP3 voice file to attach in WhatsApp"
          matButton="filled">
          <mat-icon>{{ isDownloadingAudio ? 'hourglass_top' : 'download' }}</mat-icon>
          <span>{{ isDownloadingAudio ? 'Downloading...' : 'Download MP3' }}</span>
        </button>

        <button
          type="button"
          class="action-btn wa-share-btn"
          (click)="openDirectWhatsAppWithVoice()"
          matTooltip="Open parent's chat on WhatsApp Web with text & voice note"
          matButton="filled">
          <mat-icon>chat</mat-icon>
          <span>Open in WhatsApp</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 580px;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-sizing: border-box;
    }

    /* Standard AGENTS.md light blue header rule */
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;

      .header-left {
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;

        .header-icon-box {
          background: #2563eb;
          color: #ffffff;
          border-radius: 10px;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
          width: 44px;
          height: 44px;
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

        .main-title {
          color: #1e3a8a;
          font-weight: 700;
          font-size: 1.15rem;
          margin: 0 0 2px 0;
        }

        .subtitle {
          color: #3b82f6;
          margin: 0;
          font-size: 0.82rem;

          strong {
            color: #1e40af;
          }
        }
      }

      .close-btn {
        color: #64748b;
        &:hover { color: #1e293b; }
      }
    }

    .dialog-body {
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-sizing: border-box;

      .voice-config-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;

        .gender-pill-group {
          display: flex;
          align-items: center;
          gap: 6px;

          .config-label {
            font-size: 0.8rem;
            font-weight: 600;
            color: #475569;
          }

          .gender-btn {
            border: 1px solid #cbd5e1;
            background: #f8fafc;
            border-radius: 6px;
            padding: 4px 10px;
            font-size: 0.78rem;
            font-weight: 600;
            color: #64748b;
            cursor: pointer;
            transition: all 0.2s;

            &.active {
              background: #eff6ff;
              color: #1d4ed8;
              border-color: #93c5fd;
              font-weight: 700;
            }
          }
        }

        .audio-state-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.76rem;
          font-weight: 600;
          color: #6d28d9;
          background: #f5f3ff;
          border: 1px solid #ddd6fe;
          padding: 3px 10px;
          border-radius: 12px;

          .pulse-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
            &.playing {
              color: #dc2626;
              animation: pulse 1s infinite alternate;
            }
          }
        }
      }

      .audio-player-card {
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 14px 16px;
        display: flex;
        align-items: center;
        gap: 14px;

        .play-circle-btn {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: none;
          background: #2563eb;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          box-shadow: 0 4px 10px -2px rgba(37, 99, 235, 0.4);
          transition: all 0.2s;

          mat-icon {
            font-size: 30px;
            width: 30px;
            height: 30px;
          }

          &:hover {
            transform: scale(1.05);
            background: #1d4ed8;
          }

          &.playing {
            background: #dc2626;
            box-shadow: 0 4px 10px -2px rgba(220, 38, 38, 0.4);
          }
        }

        .player-info {
          flex: 1 1 auto;
          min-width: 0;

          .player-title {
            color: #1e293b;
            font-size: 0.95rem;
            margin-bottom: 2px;
          }

          .player-sub {
            color: #64748b;
            font-size: 0.8rem;
            strong { color: #334155; }
          }

          .audio-loader {
            margin-top: 8px;
            border-radius: 4px;
          }
        }
      }

      .script-preview-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-left: 4px solid #2563eb;
        border-radius: 8px;
        padding: 12px 14px;

        .script-title-row {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #1e3a8a;
          font-size: 0.78rem;
          font-weight: 700;
          margin-bottom: 6px;

          .script-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
            color: #2563eb;
          }
        }

        .script-content {
          margin: 0;
          color: #334155;
          font-size: 0.88rem;
          line-height: 1.6;
        }
      }

      .guidance-box {
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 8px;
        padding: 10px 12px;
        display: flex;
        align-items: flex-start;
        gap: 8px;
        font-size: 0.78rem;
        color: #1e40af;
        line-height: 1.4;

        .info-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #2563eb;
          flex-shrink: 0;
          margin-top: 1px;
        }
      }

      .link-toggle-row {
        display: flex;
        align-items: center;
        padding: 4px 0;

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
          color: #475569;
          cursor: pointer;

          input[type="checkbox"] {
            cursor: pointer;
            width: 16px;
            height: 16px;
          }
        }
      }
    }

    .dialog-actions {
      border-top: 1px solid #e2e8f0;
      padding: 12px 20px;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 10px;
      background: #f8fafc;

      .action-btn {
        font-size: 0.82rem;
        font-weight: 600;
        border-radius: 8px;
        padding: 8px 14px;
        display: inline-flex;
        align-items: center;
        gap: 6px;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }

      .cancel-btn {
        color: #64748b;
        border-color: #cbd5e1;
      }

      .download-btn {
        background: #3b82f6;
        color: #ffffff;
      }

      .wa-share-btn {
        background: #25d366;
        color: #ffffff;
        box-shadow: 0 2px 6px -1px rgba(37, 211, 102, 0.4);

        &:hover {
          background: #1eb855;
        }
      }
    }

    @keyframes pulse {
      0% { transform: scale(1); opacity: 0.7; }
      100% { transform: scale(1.15); opacity: 1; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudentVoiceDialogComponent implements OnInit, OnDestroy {
  selectedGender = 'Female';
  isPlaying = false;
  isLoadingAudio = false;
  isDownloadingAudio = false;
  includeListenLink = false;
  audioPlayer: HTMLAudioElement | null = null;

  constructor(
    public dialogRef: MatDialogRef<StudentVoiceDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: StudentVoiceDialogData,
    private agentService: FeeRecoveryAgentService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {
    if (data.initialGender) {
      this.selectedGender = data.initialGender;
    }
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer = null;
    }
  }

  changeGender(gender: string): void {
    if (this.selectedGender === gender) return;
    this.selectedGender = gender;
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer = null;
      this.isPlaying = false;
    }
    this.cdr.markForCheck();
  }

  togglePlayVoice(): void {
    if (this.isPlaying && this.audioPlayer) {
      this.audioPlayer.pause();
      this.isPlaying = false;
      this.cdr.markForCheck();
      return;
    }

    if (this.audioPlayer) {
      this.audioPlayer.play().then(() => {
        this.isPlaying = true;
        this.cdr.markForCheck();
      }).catch(() => {
        this.isPlaying = false;
        this.cdr.markForCheck();
      });
      return;
    }

    this.isLoadingAudio = true;
    this.cdr.markForCheck();

    const url = this.agentService.getStudentVoiceUrl(this.data.plan.id, this.selectedGender);
    this.audioPlayer = new Audio(url);

    this.audioPlayer.oncanplay = () => {
      this.isLoadingAudio = false;
      this.audioPlayer?.play().catch(() => {
        this.isPlaying = false;
      });
      this.isPlaying = true;
      this.cdr.markForCheck();
    };

    this.audioPlayer.onended = () => {
      this.isPlaying = false;
      this.cdr.markForCheck();
    };

    this.audioPlayer.onerror = () => {
      this.isLoadingAudio = false;
      this.isPlaying = false;
      this.cdr.markForCheck();
      this.confirmDialog.alert('Audio Error', 'Could not stream AI voice note. Please check server connection.', 'danger');
    };
  }

  downloadMp3Audio(): void {
    this.isDownloadingAudio = true;
    this.cdr.markForCheck();

    const url = this.agentService.getStudentVoiceUrl(this.data.plan.id, this.selectedGender);
    const fileName = `${this.data.plan.studentName || 'student'}_fee_reminder.mp3`;

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        this.isDownloadingAudio = false;
        this.cdr.markForCheck();

        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
      })
      .catch(() => {
        this.isDownloadingAudio = false;
        this.cdr.markForCheck();

        // Direct anchor fallback
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
  }

  openDirectWhatsAppWithVoice(): void {
    const rawPhone = this.data.plan.parentPhone || '';
    if (!rawPhone) {
      this.confirmDialog.alert('No Phone Number', `Student ${this.data.plan.studentName} has no parent WhatsApp phone recorded in admissions profile.`, 'warning');
      return;
    }

    const cleanPhone = this.normalizePhone(rawPhone);
    const parentName = this.data.plan.parentName || 'अभिभावक';
    
    let audioLinkBlock = '';
    if (this.includeListenLink) {
      const listenUrl = this.agentService.getStudentVoiceListenUrl(this.data.plan.id, this.selectedGender);
      audioLinkBlock = `\n🎙️ *AI वॉयस संदेश यहाँ सुनें:*\n${listenUrl}\n`;
    }

    const message = `🔔 *फीस भुगतान अनुस्मारक | FEE PAYMENT NOTICE*\n\n` +
      `नमस्ते ${parentName} जी,\n` +
      `${this.data.instituteName} से सादर अनुरोध है कि आपके सुपुत्र/सुपुत्री *${this.data.plan.studentName}* (${this.data.plan.className || 'General'}) की फीस *₹${this.data.plan.totalOverdueAmount}* देय है।\n\n` +
      `📅 नियत देय तिथि: *${this.data.dueDay} तारीख*\n` +
      audioLinkBlock + '\n' +
      `कृपया समय पर फीस जमा कराकर सहयोग प्रदान करें।\nधन्यवाद,\n*${this.data.instituteName}*`;

    const encoded = encodeURIComponent(message);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encoded}`;
    window.open(waUrl, '_blank');
  }

  closeDialog(): void {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer = null;
    }
    this.dialogRef.close();
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\\D/g, '');
    if (digits.length === 10) return '91' + digits;
    if (digits.length === 12 && digits.startsWith('91')) return digits;
    return digits;
  }
}

