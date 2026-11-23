import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';

export interface ActionLink {
  label: string;
  routeUrl: string;
  icon: string;
  phone?: string;
}

export interface CopilotQueryResponse {
  query: string;
  intent: string;
  spokenResponseHindi: string;
  spokenResponseEnglish: string;
  formattedAnswer: string;
  highlightMetric?: string;
  highlightLabel?: string;
  actionLinks: ActionLink[];
}

@Component({
  selector: 'app-universal-voice-copilot-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatChipsModule
  ],
  template: `
    <div class="dialog-container">
      <!-- Light Blue Gradient Header -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>mic</mat-icon>
          </div>
          <div>
            <div class="badge-row">
              <span class="ai-pill">UNIVERSAL AGENTIC VOICE COPILOT</span>
              <span class="lang-pill" (click)="toggleLanguage()" matTooltip="Click to switch language">
                {{ selectedLang === 'hi-IN' ? '🇮🇳 हिंदी Voice' : '🌐 English Voice' }}
              </span>
            </div>
            <h2 class="dialog-title">Ask IMSERP Copilot Anything</h2>
            <div class="dialog-subtitle">
              Natural voice queries for student dues, daily collection, campus attendance, or instant navigation
            </div>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="closeDialog()" matTooltip="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-progress-bar *ngIf="loading" mode="indeterminate"></mat-progress-bar>

      <div class="dialog-body">
        <!-- Interactive Mic Section -->
        <div class="mic-cluster">
          <div class="mic-ripple-wrapper" [class.listening]="isListening">
            <button
              type="button"
              class="mic-circle-btn"
              [class.active]="isListening"
              (click)="toggleListening()"
              matTooltip="Click to Speak"
            >
              <mat-icon>{{ isListening ? 'mic' : 'mic_none' }}</mat-icon>
            </button>
          </div>

          <div class="mic-status-text">
            <span *ngIf="isListening" class="listening-lbl">
              <span class="sound-wave"><span></span><span></span><span></span><span></span></span>
              Listening in {{ selectedLang === 'hi-IN' ? 'Hindi' : 'English' }}... Speak now!
            </span>
            <span *ngIf="!isListening" class="idle-lbl">
              Tap mic to speak, or type your query below
            </span>
          </div>
        </div>

        <!-- Text Input & Submit Bar -->
        <div class="query-input-bar">
          <mat-icon class="input-lens">search</mat-icon>
          <input
            type="text"
            [(ngModel)]="queryText"
            (keyup.enter)="submitQuery()"
            placeholder="e.g. 'Aaj ka collection kitna hua?' or 'Aarav Sharma ki fees'..."
            class="copilot-input"
          />
          <button
            mat-flat-button
            color="primary"
            class="ask-btn"
            (click)="submitQuery()"
            [disabled]="loading || !queryText.trim()"
          >
            Ask AI
          </button>
        </div>

        <!-- Quick Query Suggestion Chips -->
        <div class="suggestion-chips">
          <span class="chips-label">Try asking:</span>
          <button type="button" class="sug-chip" (click)="runQuickQuery('Aaj ka fee collection kitna hua?')">
            💰 Today's Collection
          </button>
          <button type="button" class="sug-chip" (click)="runQuickQuery('Aaj ki student attendance kitni hai?')">
            📋 Today's Attendance
          </button>
          <button type="button" class="sug-chip" (click)="runQuickQuery('Principal morning briefing kholo')">
            🎙️ Morning Briefing
          </button>
          <button type="button" class="sug-chip" (click)="runQuickQuery('AI face attendance scanner kholo')">
            📷 AI Face Scanner
          </button>
          <button type="button" class="sug-chip" (click)="runQuickQuery('Fee recovery agent par jao')">
            ⚡ Fee Recovery Agent
          </button>
        </div>

        <!-- Copilot Response Deck -->
        <div class="response-card" *ngIf="response">
          <!-- Highlight Metric Badge if applicable -->
          <div class="metric-highlight-banner" *ngIf="response.highlightMetric">
            <div class="metric-val">{{ response.highlightMetric }}</div>
            <div class="metric-lbl">{{ response.highlightLabel || response.intent }}</div>
          </div>

          <!-- Spoken Response Controls -->
          <div class="audio-controls-row">
            <span class="spoken-lang-badge">
              <mat-icon>volume_up</mat-icon> Spoken Response ({{ selectedLang === 'hi-IN' ? 'Hindi' : 'English' }})
            </span>
            <button mat-icon-button (click)="replaySpeech()" matTooltip="Replay Spoken Audio">
              <mat-icon>replay</mat-icon>
            </button>
            <button mat-icon-button (click)="stopSpeech()" matTooltip="Stop Voice Audio">
              <mat-icon>volume_off</mat-icon>
            </button>
          </div>

          <!-- Answer Body -->
          <div class="answer-text" [innerHTML]="formatMarkdown(response.formattedAnswer)"></div>

          <!-- Action Links / Route Jumpers -->
          <div class="action-links-deck" *ngIf="response.actionLinks.length > 0">
            <span class="actions-title">Instant Actions:</span>
            <div class="action-buttons-list">
              <button
                type="button"
                *ngFor="let link of response.actionLinks"
                class="action-pill-btn"
                (click)="handleActionClick(link)"
              >
                <mat-icon>{{ link.icon }}</mat-icon>
                <span>{{ link.label }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="dialog-footer">
        <span class="copilot-tip">
          💡 Tip: You can say student names like <em>"Rahul Kumar ki fees"</em> to view instant dues & phone.
        </span>
        <button mat-button (click)="closeDialog()">Close</button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      overflow: hidden;
    }
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .header-icon-box {
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      padding: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }
    .header-icon-box mat-icon {
      font-size: 26px;
      width: 26px;
      height: 26px;
    }
    .badge-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .ai-pill {
      background: #1e40af;
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 999px;
      letter-spacing: 0.5px;
    }
    .lang-pill {
      background: #ffffff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      cursor: pointer;
    }
    .lang-pill:hover {
      background: #eff6ff;
    }
    .dialog-title {
      font-size: 18px;
      font-weight: 700;
      color: #1e3a8a;
      margin: 0 0 2px;
    }
    .dialog-subtitle {
      font-size: 12px;
      color: #3b82f6;
    }
    .close-btn {
      color: #64748b;
    }

    .dialog-body {
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Mic Section */
    .mic-cluster {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 10px 0;
    }
    .mic-ripple-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .mic-circle-btn {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      border: none;
      background: #2563eb;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(37,99,235,0.3);
      transition: all 0.2s;
    }
    .mic-circle-btn mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }
    .mic-circle-btn.active {
      background: #dc2626;
      box-shadow: 0 0 0 8px rgba(220,38,38,0.25);
      animation: pulseMic 1.2s infinite;
    }
    .mic-status-text {
      font-size: 13px;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .listening-lbl {
      color: #dc2626;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .sound-wave {
      display: inline-flex;
      align-items: flex-end;
      gap: 2px;
      height: 14px;
    }
    .sound-wave span {
      width: 3px;
      background: #dc2626;
      border-radius: 2px;
      animation: wave 1s infinite ease-in-out;
    }
    .sound-wave span:nth-child(1) { height: 6px; animation-delay: 0.1s; }
    .sound-wave span:nth-child(2) { height: 14px; animation-delay: 0.2s; }
    .sound-wave span:nth-child(3) { height: 10px; animation-delay: 0.3s; }
    .sound-wave span:nth-child(4) { height: 4px; animation-delay: 0.4s; }

    /* Input Bar */
    .query-input-bar {
      display: flex;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 4px 8px 4px 14px;
      gap: 10px;
    }
    .input-lens {
      color: #94a3b8;
    }
    .copilot-input {
      flex: 1;
      border: none;
      background: transparent;
      outline: none;
      font-size: 14px;
      color: #0f172a;
    }
    .ask-btn {
      border-radius: 8px;
    }

    /* Suggestion Chips */
    .suggestion-chips {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .chips-label {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
    }
    .sug-chip {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
      transition: all 0.2s;
    }
    .sug-chip:hover {
      background: #eff6ff;
      border-color: #93c5fd;
      color: #1e40af;
    }

    /* Response Card */
    .response-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.03);
    }
    .metric-highlight-banner {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .metric-val {
      font-size: 22px;
      font-weight: 800;
      color: #1e3a8a;
    }
    .metric-lbl {
      font-size: 12px;
      font-weight: 700;
      color: #3b82f6;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .audio-controls-row {
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px dashed #e2e8f0;
      padding-bottom: 8px;
    }
    .spoken-lang-badge {
      flex: 1;
      font-size: 12px;
      font-weight: 600;
      color: #2563eb;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .spoken-lang-badge mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .answer-text {
      font-size: 13px;
      color: #334155;
      line-height: 1.5;
    }

    /* Action Links */
    .action-links-deck {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 4px;
      border-top: 1px solid #f1f5f9;
      padding-top: 10px;
    }
    .actions-title {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
    }
    .action-buttons-list {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .action-pill-btn {
      background: #eff6ff;
      border: 1px solid #93c5fd;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 700;
      color: #1e40af;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .action-pill-btn:hover {
      background: #2563eb;
      color: #ffffff;
      border-color: #2563eb;
    }
    .action-pill-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .dialog-footer {
      border-top: 1px solid #e2e8f0;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
    }
    .copilot-tip {
      font-size: 11px;
      color: #64748b;
    }

    @keyframes pulseMic {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    @keyframes wave {
      0%, 100% { height: 4px; }
      50% { height: 14px; }
    }
  `]
})
export class UniversalVoiceCopilotDialogComponent implements OnInit, OnDestroy {
  dialogRef = inject(MatDialogRef<UniversalVoiceCopilotDialogComponent>);
  private http = inject(HttpClient);
  private router = inject(Router);
  public authService = inject(AuthService);

  loading = false;
  isListening = false;
  queryText = '';
  selectedLang = 'hi-IN';
  response: CopilotQueryResponse | null = null;

  private recognition: any = null;

  ngOnInit(): void {
    this.initSpeechRecognition();
  }

  ngOnDestroy(): void {
    this.stopSpeech();
    this.stopListening();
  }

  toggleLanguage(): void {
    this.selectedLang = this.selectedLang === 'hi-IN' ? 'en-IN' : 'hi-IN';
    if (this.isListening) {
      this.stopListening();
      this.startListening();
    }
  }

  private initSpeechRecognition(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;

    this.recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      this.queryText = transcript;
      this.isListening = false;
      this.submitQuery();
    };

    this.recognition.onerror = () => {
      this.isListening = false;
    };

    this.recognition.onend = () => {
      this.isListening = false;
    };
  }

  toggleListening(): void {
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  startListening(): void {
    if (!this.recognition) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }
    this.recognition.lang = this.selectedLang;
    this.isListening = true;
    try {
      this.recognition.start();
    } catch {}
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.isListening = false;
  }

  submitQuery(): void {
    const q = this.queryText.trim();
    if (!q) return;

    this.loading = true;
    this.stopListening();

    const branchId = this.authService.selectedBranchId();
    const url = `${environment.apiUrl}/api/copilot/universal-query`;

    this.http.post<CopilotQueryResponse>(url, {
      query: q,
      branchId: branchId || undefined,
      language: this.selectedLang
    }).subscribe({
      next: res => {
        this.loading = false;
        this.response = res;
        this.speakAnswer(res);
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  runQuickQuery(prompt: string): void {
    this.queryText = prompt;
    this.submitQuery();
  }

  speakAnswer(res: CopilotQueryResponse): void {
    if (!('speechSynthesis' in window)) return;
    this.stopSpeech();

    const textToSpeak = this.selectedLang === 'hi-IN'
      ? (res.spokenResponseHindi || res.spokenResponseEnglish)
      : (res.spokenResponseEnglish || res.spokenResponseHindi);

    if (!textToSpeak) return;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = this.selectedLang;
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  }

  replaySpeech(): void {
    if (this.response) {
      this.speakAnswer(this.response);
    }
  }

  stopSpeech(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  handleActionClick(link: ActionLink): void {
    this.stopSpeech();
    this.dialogRef.close();
    if (link.phone) {
      window.open(link.routeUrl, '_blank');
    } else {
      this.router.navigateByUrl(link.routeUrl);
    }
  }

  formatMarkdown(md: string): string {
    if (!md) return '';
    return md
      .replace(/### (.*)/g, '<h4 style="margin:4px 0 8px; color:#1e3a8a; font-weight:700;">$1</h4>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n- (.*)/g, '<div style="margin:3px 0; padding-left:8px;">• $1</div>')
      .replace(/\n/g, '<br/>');
  }

  closeDialog(): void {
    this.stopSpeech();
    this.stopListening();
    this.dialogRef.close();
  }
}
